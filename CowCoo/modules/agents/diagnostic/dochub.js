import path from "node:path";
import fsPromises from "node:fs/promises";
import { ErrDoc } from "./errdoc.js";

function markdownToHtml(md) {
    if (!md || typeof md !== 'string') return '<p>暂无分析内容</p>';

    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(code.trim());
        return `\x00CODEBLOCK${idx}\x00`;
    });

    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/(#[\u4e00-\u9fa5\w-]+)/g, '<span class="cmd-highlight">$1</span>');

    const lines = html.split('\n');
    const out = [];
    let inUl = false;
    for (const line of lines) {
        if (/^\s*[-*]\s+/.test(line)) {
            if (!inUl) { out.push('<ul>'); inUl = true; }
            out.push('<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>');
        } else {
            if (inUl) { out.push('</ul>'); inUl = false; }
            out.push(line);
        }
    }
    if (inUl) out.push('</ul>');
    html = out.join('\n');

    html = html.split(/\n\n+/).map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.match(/^<(h\d|ul|pre)/) || trimmed.startsWith('\x00CODEBLOCK')) return trimmed;
        return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_, idx) => {
        return '<pre><code>' + codeBlocks[Number(idx)] + '</code></pre>';
    });

    return html;
}

export function DocHub(ctx = {}) {
    const {
        Ananke, Nomos, HadesEntry, getCore, getHades,
        MiaoPluginMBT, Morpheus, Pheme, Version,
        HotModule = null
    } = ctx;

    const errDoc = ErrDoc(Nomos);

    let _oracleAgent = null;
    let _agentGen = -1;

    async function getOracleAgent() {
        const curGen = HotModule && HotModule.snapshot ? (() => {
            try { return HotModule.snapshot().agents?.gen ?? 0; } catch { return 0; }
        })() : 0;

        if (_oracleAgent && _agentGen === curGen) return _oracleAgent;

        const agentCtx = { Ananke, Nomos, HadesEntry, getCore, MiaoPluginMBT };
        agentCtx.fallbackConfig = async (Hades) => {
            const config = await Nomos.getOracleConfig(Hades);
            return config?.ai_config ? config : null;
        };

        if (HotModule) {
            const mod = await HotModule.load('agents');
        const fn = mod?.Agent ?? mod?.default?.Agent;
        _oracleAgent = fn ? fn(agentCtx) : null;
        } else {
            const { Agent } = await import("../agents.js");
            _oracleAgent = Agent(agentCtx);
        }
        _agentGen = curGen;
        return _oracleAgent;
    }

    function _extractErrSource(err) {
        const line = err?.stack?.split('\n').find(l => l.trim().startsWith('at '));
        return line?.match(/:(\d+):\d+\)?$/)?.[1] ?? null;
    }

    function _extractErrType(err) {
        if (!err) return null;
        const msg = err.message || "";
        const name = err.name || "";
        if (name === 'ReferenceError' || msg.includes('is not defined')) return "未定义变量";
        if (name === 'TypeError') return "类型错误";
        if (name === 'SyntaxError') return "语法错误";
        if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) return "请求超时";
        if (msg.includes('permission denied') || msg.includes('EACCES')) return "权限缺失";
        return null;
    }

    function _diagnose(opName, err, ctx = "") {
        const report = {
            summary: `操作 [${opName}] 失败了！`,
            contextInfo: ctx || "（无额外上下文信息）",
            suggestions: "",
            stack: err?.stack || "（调用栈信息丢失）",
        };

        if (err?.message) report.summary += `\n错误信息: ${err.message}`;
        if (err?.code) report.summary += ` (Code: ${err.code})`;

        const type = errDoc.diagnose(err);
        const suggs = errDoc.getSuggestions(type);

        report.suggestions = [...new Set(suggs)].join("\n");

        const stderr = err?.stderr || "";
        const stdout = err?.stdout || "";
        if (stdout || stderr) {
            report.contextInfo += "\n\n--- 进程输出 ---";
            const maxLen = 600;
            if (stdout.trim()) report.contextInfo += `\n[stdout]:\n${stdout.substring(0, maxLen)}...`;
            if (stderr.trim()) report.contextInfo += `\n[stderr]:\n${stderr.substring(0, maxLen)}...`;
        }

        return report;
    }

    async function _consultOracle(operationName, error, context, logger) {
        try {
            const agent = await getOracleAgent();
            if (!agent) {
                getHades(logger)?.D?.('agents 模块未加载，跳过AI分析');
                return "云露分析服务暂时不可用。";
            }
            return await agent.consult(operationName, error, context, logger);
        } catch (err) {
            getHades(logger)?.D?.(`agents 模块不可用: ${err?.message}`);
            return "云露分析服务暂时不可用。";
        }
    }

    async function report(e, opName, err, ctx = "", logger = getCore()) {
        const baseCtx = e ? [
            (e.raw_message || e.msg) && `触发命令: ${e.raw_message || e.msg}`,
            e.user_id && `发送者: ${e.user_id}`,
            e.group_id && `群组: ${e.group_id}`
        ].filter(Boolean).join(" | ") : "";
        ctx = baseCtx ? (ctx ? `${baseCtx}\n附加信息: ${ctx}` : baseCtx) : ctx;

        const Hades = HadesEntry({}, logger?.error ? logger : getCore());
        const errCode = err?.code || '未知';

        await errDoc.loadConfig();

        if (!errDoc.shouldReport(opName, errCode)) {
            return;
        }

        Hades.E(`[${opName}] 失败:`, err?.message, err?.stack ? `\nStack in report.` : "");

        const diagnosis = _diagnose(opName, err, ctx);
        const aiSolution = await _consultOracle(opName, err, diagnosis.contextInfo, Hades)
            .catch(() => (Hades.D(`AI服务不可用`), "云露分析服务暂时不可用。"));

        const isStressed = errDoc.isSystemStressed();
        let imgBuffer = null;

        if (!isStressed) {
            try {
                const context = await Nomos.getContext();
                const activeRepos = Nomos.ScanQueue(MiaoPluginMBT.Paths, MiaoPluginMBT.MBTConfig, context);
                const repoStatuses = (await Promise.all(activeRepos.map(async repo => {
                    if (!(await Ananke.Audit(repo.path, true))) return null;
                    return { num: repo.num, ...(await Nomos.getRepoStatus(repo.gitPath)) };
                }))).filter(Boolean);
                const primaryRepo = repoStatuses.find(r => r.num === 1) ?? repoStatuses[0];
                const activeRepoNums = new Set(repoStatuses.map(r => r.num));
                const shortSha = primaryRepo?.sha?.slice(0, 25) ?? 'unknown';

                const coreStats = await (async () => {
                    const corePath = path.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
                    if (!(await Ananke.Audit(corePath, false))) return { size: 'N/A', mtime: 'N/A' };
                    const stats = await fsPromises.stat(corePath);
                    return {
                        size: stats.size < 1048576 ? `${(stats.size / 1024).toFixed(2)} KB` : `${(stats.size / 1048576).toFixed(2)} MB`,
                        mtime: stats.mtime.toLocaleString('zh-CN')
                    };
                })().catch(() => ({ size: 'N/A', mtime: 'N/A' }));

                const snap = {
                    git: { sha: shortSha, branch: primaryRepo?.branch || 'unknown' },
                    repos: Array.from({ length: 5 }, (_, i) => ({ num: i + 2, active: activeRepoNums.has(i + 2) })),
                    system: Nomos.getHostEnv(),
                    core: { version: Version, ...coreStats, active: activeRepoNums.has(1) }
                };
                const tplResult = await Nomos.getTemplate('error_report.html');

                if (tplResult.success) {
                    const OpsName = (e?.msg?.startsWith('#') && !opName.startsWith('#')) ? `#${opName}` : opName;
                    const ViewProps = {
                        operationName: OpsName,
                        errMsg: err.message || "Unknown Error",
                        errCode: errCode,
                        errorSource: _extractErrSource(err),
                        errType: _extractErrType(err),
                        contextInfo: diagnosis.contextInfo,
                        suggestions: diagnosis.suggestions.split('\n'),
                        aiSolutionText: aiSolution,
                        aiSolutionHtml: markdownToHtml(aiSolution),
                        stackTrace: diagnosis.stack ? diagnosis.stack.substring(0, 1200) : null,
                        snapshot: snap,
                        error: err,
                        timestamp: new Date().toLocaleString()
                    };

                    imgBuffer = await Morpheus.shot("Error-Report", {
                        htmlContent: tplResult.data,
                        data: ViewProps,
                        logger: Hades,
                        MorpheusSignal: true
                    });
                }
            } catch (renderErr) {
                Hades.E(`报告渲染失败:`, renderErr);
                imgBuffer = null;
            }
        }

        const msg = [
            `[${opName}] 失败!`,
            `错误: ${err?.message}`,
            `建议: \n${diagnosis.suggestions}`,
            `\n云露分析: ${aiSolution.slice(0, 1000)}`
        ].join('\n');

        try {
            imgBuffer ? await Pheme.img(e, imgBuffer, msg, Hades) : await Pheme.send(e, msg);
        } catch (sendErr) {
            Hades.E(`报告发送失败:`, sendErr);
            Pheme.sendFail(e, opName, err, sendErr).catch(() => {});
        }
    }

    const DocHub = { report, _diagnose, _consultOracle, _extractErrSource, _extractErrType, _resetAgent: () => { _oracleAgent = null; _agentGen = -1; } };

    return { DocHub, ErrDoc: errDoc };
}

export default { DocHub };