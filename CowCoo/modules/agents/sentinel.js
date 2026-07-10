export async function Diagnostic(ctx = {}, e = null) {
    const {
        HotModule, DocHub, ErrDoc,
        Ananke, Nomos, HadesEntry, getCore, getHades,
        MiaoPluginMBT, Pheme, CommunityMBT
    } = ctx;

    const Hades = getHades ? getHades(getCore?.()) : (getCore?.() || console);
    const results = [];
    let allPass = true;

    function check(layer, name, pass, detail = '') {
        results.push({ layer, name, pass: !!pass, detail });
        if (!pass) allPass = false;
    }

    Hades?.D?.('═══ 哨兵诊断开始 ═══');

    check('基础', 'HotModule 可用', !!HotModule?.load);

    let agentMod = null;
    try {
        agentMod = await HotModule.load('agents');
        check('基础', 'agents 模块加载', !!agentMod);
    } catch (err) {
        check('基础', 'agents 模块加载', false, err?.message);
    }

const AgentFn = agentMod?.Agent ?? agentMod?.default?.Agent;
check('基础', 'Agent 函数可用', typeof AgentFn === 'function');

    const isStub = DocHub?._consultOracle?.toString()?.includes('不可用') && !DocHub?.report?.toString()?.includes('try');
    check('基础', 'DocHub 非空桩', !isStub && !!DocHub?.report);

    check('基础', 'ErrDoc 非空桩', !!ErrDoc?.diagnose && ErrDoc?.diagnose?.toString()?.length > 10);

    try {
        let promptPath = null;
if (typeof AgentFn === 'function') {
    const agentInst = AgentFn({ Ananke, Nomos, HadesEntry, getCore });
            promptPath = agentInst?.LocalPromptPath;
        }
        if (promptPath) {
            const raw = await Ananke.readFile(promptPath, 'utf-8');
            const parsed = JSON.parse(raw);
            check('基础', 'prompt.json 可加载', !!parsed?.ai_config);
        } else {
            const pathMod = await import('node:path');
            const fsMod = await import('node:fs/promises');
            const candidates = [
                pathMod.join(MiaoPluginMBT?.Paths?.OpsPath || '', 'modules', 'agents', 'rule', 'prompt.json'),
                pathMod.join(MiaoPluginMBT?.Paths?.Target?.Example || '', 'CowCoo', 'modules', 'agents', 'rule', 'prompt.json'),
            ];
            let loaded = false;
            for (const p of candidates) {
                try {
                    const raw = await fsMod.readFile(p, 'utf-8');
                    const parsed = JSON.parse(raw);
                    if (parsed?.ai_config) { loaded = true; break; }
                } catch {}
            }
            check('基础', 'prompt.json 可加载', loaded, loaded ? '' : '所有候选路径均失败');
        }
    } catch (err) {
        check('基础', 'prompt.json 可加载', false, err?.message);
    }

    Hades?.D?.('─── 适配器模块诊断 ───');

    let dockerMod = null;
    try {
        dockerMod = await HotModule.load('docker');
        check('适配器', 'docker.js 模块加载', !!dockerMod);
    } catch (err) {
        check('适配器', 'docker.js 模块加载', false, err?.message);
    }

const DockerFn = dockerMod?.Docker ?? dockerMod?.default?.Docker;
check('适配器', 'Docker 函数可用', typeof DockerFn === 'function');

    let dockerInst = null;
    try {
        if (typeof DockerFn === 'function') dockerInst = DockerFn({});
        check('适配器', 'DockerMod.isDockerEnv 可调用', typeof dockerInst?.isDockerEnv === 'function');
    } catch (err) {
        check('适配器', 'DockerMod.isDockerEnv 可调用', false, err?.message);
    }

    try {
        const isDocker = dockerInst?.isDockerEnv?.();
        check('适配器', 'isDockerEnv 返回布尔值', typeof isDocker === 'boolean', `isDocker=${isDocker}`);
    } catch (err) {
        check('适配器', 'isDockerEnv 返回布尔值', false, err?.message);
    }

    try {
        const profile = await dockerInst?.getHostProfile?.(Hades);
        check('适配器', 'getHostProfile 返回对象', !!profile && typeof profile === 'object',
            `platform=${profile?.platform}, isDocker=${profile?.isDocker}`);
    } catch (err) {
        check('适配器', 'getHostProfile 返回对象', false, err?.message);
    }

    try {
        const args = [];
        const result = dockerInst?.applyBrowserArgs?.(args);
        check('适配器', 'applyBrowserArgs 不抛异常', Array.isArray(result || args));
    } catch (err) {
        check('适配器', 'applyBrowserArgs 不抛异常', false, err?.message);
    }

    let protocolMod = null;
    try {
        protocolMod = await HotModule.load('protocol');
        check('适配器', 'protocol.js 模块加载', !!protocolMod);
    } catch (err) {
        check('适配器', 'protocol.js 模块加载', false, err?.message);
    }

const ProtocolFn = protocolMod?.Protocol ?? protocolMod?.default?.Protocol;
check('适配器', 'Protocol 函数可用', typeof ProtocolFn === 'function');

    let protocolInst = null;
    try {
        if (typeof ProtocolFn === 'function') protocolInst = ProtocolFn({ DockerMod: dockerInst });
        check('适配器', 'ProtocolMod.isOneBotFamily 可调用', typeof protocolInst?.isOneBotFamily === 'function');
    } catch (err) {
        check('适配器', 'ProtocolMod.isOneBotFamily 可调用', false, err?.message);
    }

    try {
        const familyResult = protocolInst?.isOneBotFamily?.(e);
        check('适配器', 'isOneBotFamily 返回布尔值', typeof familyResult === 'boolean');
    } catch (err) {
        check('适配器', 'isOneBotFamily 返回布尔值', false, err?.message);
    }

    try {
        const oneBot = protocolInst?.isOneBot?.();
        check('适配器', 'isOneBot 返回布尔值', typeof oneBot === 'boolean');
    } catch (err) {
        check('适配器', 'isOneBot 返回布尔值', false, err?.message);
    }

    try {
        const dockerResult = protocolInst?.isDocker?.();
        check('适配器', 'isDocker 委托 DockerMod', typeof dockerResult === 'boolean');
    } catch (err) {
        check('适配器', 'isDocker 委托 DockerMod', false, err?.message);
    }

    try {
        const imgType = protocolInst?.adaptImgType?.('png');
        check('适配器', 'adaptImgType 返回字符串', typeof imgType === 'string' && ['png', 'webp'].includes(imgType),
            `imgType=${imgType}`);
    } catch (err) {
        check('适配器', 'adaptImgType 返回字符串', false, err?.message);
    }

    try {
        const nonPng = protocolInst?.adaptImgType?.('jpg');
        check('适配器', 'adaptImgType 透传非png', nonPng === 'jpg');
    } catch (err) {
        check('适配器', 'adaptImgType 透传非png', false, err?.message);
    }

    Hades?.D?.('─── 主插件诊断 ───');

    check('主插件', 'DocHub.report 可调用', typeof DocHub?.report === 'function');

    try {
        const masterMsgMod = await HotModule.load('mastermsg');
        check('主插件', 'mastermsg.js 模块加载', !!masterMsgMod);
const MasterMsgFn = masterMsgMod?.MasterMsg ?? masterMsgMod?.default?.MasterMsg;
check('主插件', 'MasterMsg 函数可用', typeof MasterMsgFn === 'function');
    } catch (err) {
        check('主插件', 'mastermsg.js 模块加载', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const hasDelegate = src.includes("if (MasterMsg?.sendMasterMsg) return MasterMsg.sendMasterMsg(msg, e, delay);");
        check('主插件', 'SendMasterMsg 委托 MasterMsg 子模块', hasDelegate);

        const noInlineMasterAc = !src.includes('async function MasterAc()');
        check('主插件', 'MasterAc 内联实现已移除', noInlineMasterAc);

        const hasVarDecl = src.includes('let MasterMsg = null;');
        check('主插件', 'MasterMsg 变量声明存在', hasVarDecl);

        const hasLoadFn = src.includes('async function MasterMsgModule()');
        check('主插件', 'MasterMsgModule 加载函数存在', hasLoadFn);
    } catch (err) {
        check('主插件', 'SendMasterMsg 外置验证', false, err?.message);
    }

    try {
        await ErrDoc?.loadConfig?.();
        const testErr = new TypeError('test error for diagnosis');
        testErr.code = 'TEST_CODE';
        const diag = DocHub._diagnose('测试操作', testErr, '测试上下文');
        check('主插件', '_diagnose 返回报告', !!diag?.summary && diag?.suggestions !== undefined,
            `summary长度=${diag?.summary?.length || 0}, suggestions长度=${diag?.suggestions?.length || 0}`);
    } catch (err) {
        check('主插件', '_diagnose 返回报告', false, err?.message);
    }

    try {
        const typeErr = new TypeError('Cannot read properties of null');
        const type = DocHub._extractErrType(typeErr);
        check('主插件', '_extractErrType 分类正确', type === '类型错误');
    } catch (err) {
        check('主插件', '_extractErrType 分类正确', false, err?.message);
    }

    try {
        const testErr = new Error('测试用：模拟主插件操作失败');
        const aiResult = await DocHub._consultOracle('主插件测试', testErr, '这是一条测试上下文', Hades);
        check('主插件', '_consultOracle 返回结果', typeof aiResult === 'string' && aiResult.length > 0,
            `AI回复长度: ${aiResult?.length || 0}`);
    } catch (err) {
        check('主插件', '_consultOracle 返回结果', false, err?.message);
    }

    try {
        const testErr = new Error('测试用：模拟主插件完整报告流程');
        await DocHub.report(null, '主插件诊断测试', testErr, '自动化测试上下文', Hades).catch(() => {});
        check('主插件', 'report 完整流程不抛异常', true);
    } catch (err) {
        check('主插件', 'report 完整流程不抛异常', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const adapterDelegates = src.includes('ProtocolMod ? ProtocolMod.isOneBotFamily') &&
            src.includes('ProtocolMod ? ProtocolMod.adaptImgType');
        check('主插件', 'MBTAdapterEnv 门面委托适配器', adapterDelegates);

        const imgDelegates = src.includes('static ToImgSeg(input, options = {})') &&
            src.includes('static async ReplyImg(e, input, fallbackText') &&
            src.includes('const toBase64Url =') &&
            src.includes('const toFileUrl =');
        check('主插件', 'ToImgSeg/ReplyImg 内联实现完整', imgDelegates);

        const hostDelegate = src.includes('DockerMod?.getHostProfile');
        check('主插件', 'Nomos.getHostProfile 委托 DockerMod', hostDelegate);

        const browserDelegate = src.includes("DockerMod?.applyBrowserArgs?.(launchOptions.args)");
        check('主插件', 'Morpheus 浏览器启动委托 DockerMod', browserDelegate);
    } catch (err) {
        check('主插件', '主插件门面委托验证', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const hasVarDecl = src.includes('let DockerMod = null;') &&
            src.includes('let ProtocolMod = null;');
        check('主插件', '适配器变量声明存在', hasVarDecl);
    } catch (err) {
        check('主插件', '适配器变量声明存在', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const loadFns = src.includes('async function DockerModule()') &&
            src.includes('async function ProtocolModule()');
        check('主插件', '适配器加载函数存在', loadFns);
    } catch (err) {
        check('主插件', '适配器加载函数存在', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const initSection = src.substring(src.indexOf('async function initModules()'), src.indexOf('async function initModules()') + 800);
        const order = initSection.indexOf('DockerModule') < initSection.indexOf('ProtocolModule') &&
            initSection.indexOf('ProtocolModule') < initSection.indexOf('DocHubModule') &&
            initSection.indexOf('DocHubModule') < initSection.indexOf('MasterMsgModule') &&
            initSection.indexOf('MasterMsgModule') < initSection.indexOf('ExportModule') &&
            initSection.indexOf('ExportModule') < initSection.indexOf('CreFaceModule') &&
            initSection.indexOf('CreFaceModule') < initSection.indexOf('MapTileModule') &&
            initSection.indexOf('MapTileModule') < initSection.indexOf('CommunityModule') &&
            initSection.indexOf('CommunityModule') < initSection.indexOf('SentinelModule');
        check('主插件', 'initModules 加载顺序正确', order);
    } catch (err) {
        check('主插件', 'initModules 加载顺序正确', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const sentinelNearLoaders = src.indexOf('async function SentinelModule()') < src.indexOf('const _wFallback');
        const sentinelNotAtBottom = !src.endsWith("Hades.D('哨兵模块已加载');\n        }\n    }\n}\nawait SentinelModule();\n");
        check('主插件', 'SentinelModule 已迁移', sentinelNearLoaders && sentinelNotAtBottom);
    } catch (err) {
        check('主插件', 'SentinelModule 已迁移', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const noOldLogs = !src.includes("Hades.D('错误报告模块已加载')") &&
            !src.includes("Hades.D(`社区图库模块已加载") &&
            !src.includes("Hades.D('哨兵模块已加载')");
        check('主插件', '加载函数日志已精简', noOldLogs);
    } catch (err) {
        check('主插件', '加载函数日志已精简', false, err?.message);
    }

    Hades?.D?.('─── 角色头像模块诊断 ───');

    let creFaceMod = null;
    try {
        creFaceMod = await HotModule.load('creface');
        check('头像模块', 'creface.js 模块加载', !!creFaceMod);
    } catch (err) {
        check('头像模块', 'creface.js 模块加载', false, err?.message);
    }

const CreFaceFn = creFaceMod?.CreFace ?? creFaceMod?.default?.CreFace;
check('头像模块', 'CreFace 函数可用', typeof CreFaceFn === 'function');

    let creFaceInst = null;
    try {
        if (typeof CreFaceFn === 'function') {
            creFaceInst = CreFaceFn({ MiaoPluginMBT, Nomos, Ananke, toFileUrl: (p) => p ? `file://${String(p).replace(/\\/g,'/')}` : '' });
        }
        check('头像模块', 'CreFace 实例化成功', !!creFaceInst);
    } catch (err) {
        check('头像模块', 'CreFace 实例化成功', false, err?.message);
    }

    check('头像模块', 'ResolveFace 可调用', typeof creFaceInst?.ResolveFace === 'function');
    check('头像模块', 'FindZZZIcon 可调用', typeof creFaceInst?.FindZZZIcon === 'function');
    check('头像模块', 'ResolveWavesFace 可调用', typeof creFaceInst?.ResolveWavesFace === 'function');
    check('头像模块', 'ResolveCREFace 可调用', typeof creFaceInst?.ResolveCREFace === 'function');

    try {
        const gsResult = await creFaceInst?.ResolveFace?.('gs', '__nonexistent_test__');
        check('头像模块', 'ResolveFace gs 返回 null', gsResult === null);
    } catch (err) {
        check('头像模块', 'ResolveFace gs 返回 null', false, err?.message);
    }

    try {
        const zzzResult = await creFaceInst?.FindZZZIcon?.('__nonexistent_test__');
        check('头像模块', 'FindZZZIcon 不存在角色返回 null', zzzResult === null);
    } catch (err) {
        check('头像模块', 'FindZZZIcon 不存在角色返回 null', false, err?.message);
    }

    try {
        const wavesResult = creFaceInst?.ResolveWavesFace?.('__nonexistent_test__');
        check('头像模块', 'ResolveWavesFace 不存在角色返回 null', wavesResult === null);
    } catch (err) {
        check('头像模块', 'ResolveWavesFace 不存在角色返回 null', false, err?.message);
    }

    try {
        const unifiedResult = await creFaceInst?.ResolveCREFace?.('unknown', '__nonexistent_test__');
        check('头像模块', 'ResolveCREFace 未知游戏返回 null', unifiedResult === null);
    } catch (err) {
        check('头像模块', 'ResolveCREFace 未知游戏返回 null', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const hasVarDecl = src.includes('let CreFaceMod = null;');
        check('头像模块', 'CreFaceMod 变量声明存在', hasVarDecl);

        const hasStub = src.includes('const _CreFaceStub');
        check('头像模块', '_CreFaceStub fallback 存在', hasStub);

        const hasLoadFn = src.includes('async function CreFaceModule()');
        check('头像模块', 'CreFaceModule 加载函数存在', hasLoadFn);

        const hasRegister = src.includes('modPath("feature", "creface.js")');
        check('头像模块', 'HotModule 注册 creface', hasRegister);

        const noOldResolveFace = !src.includes('static async ResolveFace(gameKey, CREName)');
        check('头像模块', 'Tianshu.ResolveFace 已移除', noOldResolveFace);

        const noOldFindZZZIcon = !src.includes('static async FindZZZIcon(charName)');
        check('头像模块', 'Tianshu.FindZZZIcon 已移除', noOldFindZZZIcon);

        const noOldZZZTitleFace = !src.includes('static async _resolveZZZTitleFaceUrl(primaryName)');
        check('头像模块', 'Presenter._resolveZZZTitleFaceUrl 已移除', noOldZZZTitleFace);

        const hasDelegation = src.includes('CreFaceMod.ResolveFace') &&
            src.includes('CreFaceMod.FindZZZIcon') &&
            src.includes('CreFaceMod.ResolveWavesFace');
        check('头像模块', '调用点委托 CreFaceMod', hasDelegation);

        const noOldWavesInlineIcon = !src.includes('_wavesRoleDataMap?.get(charName)?.icon') &&
            !src.includes('_wavesRoleDataMap?.get(displayName)?.icon');
        check('头像模块', '鸣潮头像内联表达式已移除', noOldWavesInlineIcon);
    } catch (err) {
        check('头像模块', '源码验证', false, err?.message);
    }

    Hades?.D?.('─── 社区图库模块诊断 ───');

    check('社区模块', 'CommunityMBT 已加载', !!CommunityMBT);

    try {
        const opsMod = await HotModule.load('ops');
        check('社区模块', 'index.js 模块加载', !!opsMod);
    } catch (err) {
        check('社区模块', 'index.js 模块加载', false, err?.message);
    }

    try {
        const opsPath = MiaoPluginMBT?.Paths?.OpsPath;
        if (opsPath) {
            const pathMod = await import('node:path');
            const fsMod = await import('node:fs/promises');
            const opsFile = pathMod.join(opsPath, 'modules', 'community', 'index.js');
            const src = await fsMod.readFile(opsFile, 'utf-8');
            check('社区模块', 'index.js 引用 DocHub', src.includes('DocHub'));
            check('社区模块', 'index.js 调用 DocHub.report', src.includes('DocHub.report'));
        } else {
            check('社区模块', 'index.js 引用 DocHub', false, 'OpsPath 未知');
        }
    } catch (err) {
        check('社区模块', 'index.js 引用 DocHub', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');
        const ctxHasDocHub = src.includes("DocHub,") && src.includes("CommunityModule");
        check('社区模块', 'ctx 传递 DocHub 给 ops', ctxHasDocHub);
    } catch (err) {
        check('社区模块', 'ctx 传递 DocHub 给 ops', false, err?.message);
    }

    Hades?.D?.('─── Worker 线程诊断 ───');

    let workerInst = null;
    try {
        workerInst = await HotModule.load('worker', { dirNames: Nomos?.DirNames || [] });
        check('Worker', 'Worker 模块加载', !!workerInst?.run);
    } catch (err) {
        check('Worker', 'Worker 模块加载', false, err?.message);
    }

    try {
        const result = await workerInst.run('SCAN_STATS', { repos: [], _dirNames: [] });
        check('Worker', 'SCAN_STATS 正常执行', !!result);
    } catch (err) {
        check('Worker', 'SCAN_STATS 正常执行', false, err?.message);
    } finally {
        HotModule?.terminate?.('worker');
    }

    try {
        const workerInst2 = await HotModule.load('worker', { dirNames: Nomos?.DirNames || [] });
        let workerError = null;
        try {
            await workerInst2.run('INVALID_TYPE', {});
        } catch (err) {
            workerError = err;
        }
        check('Worker', '错误传播至主线程', !!workerError);
        HotModule.terminate('worker');
    } catch (err) {
        check('Worker', '错误传播至主线程', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');
        const dispatchSyncSection = src.substring(
            src.indexOf('dispatchSync'),
            src.indexOf('dispatchSync') + 500
        );
        check('Worker', 'dispatchSync 接入 DocHub', dispatchSyncSection.includes('DocHub'));
    } catch (err) {
        check('Worker', 'dispatchSync 接入 DocHub', false, err?.message);
    }

    try {
        const fallbackResult = await Ananke?.dispatchSync?.([]);
        check('Worker', '回退机制可用', fallbackResult && typeof fallbackResult === 'object',
            `result=${JSON.stringify(fallbackResult)}`);
    } catch (err) {
        check('Worker', '回退机制可用', false, err?.message);
    }

    Hades?.D?.('─── HMR 级联诊断 ───');

    try {
        const snap = HotModule.snapshot?.();
        check('HMR', 'agents 已注册', !!snap?.agents);
        check('HMR', 'dochub 已注册', !!snap?.dochub);
        check('HMR', 'docker 已注册', !!snap?.docker);
        check('HMR', 'protocol 已注册', !!snap?.protocol);
        check('HMR', 'creface 已注册', !!snap?.creface);
    } catch (err) {
        check('HMR', '模块注册验证', false, err?.message);
    }

    try {
        const snap = HotModule.snapshot?.();
        const agentGen = snap?.agents?.gen ?? 0;
        check('HMR', 'agents 代际追踪', agentGen >= 0, `gen=${agentGen}`);
    } catch (err) {
        check('HMR', 'agents 代际追踪', false, err?.message);
    }

    check('HMR', 'DocHub 代际刷新就绪', typeof DocHub?._resetAgent === 'function');

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const listenerSection = src.substring(
            src.indexOf('moduleReloadListener'),
            src.indexOf('moduleReloadListener') + 600
        );
        check('HMR', 'moduleReloadListener 已替换旧名', !listenerSection.includes('docHubReloadListener'));
        check('HMR', 'moduleReloadListener 委托 reloadModules', listenerSection.includes('reloadModules'));

        const reloadFnSection = src.substring(
            src.indexOf('async function reloadModules()'),
            src.indexOf('async function reloadModules()') + 800
        );

        const includesAdapterReload = reloadFnSection.includes('HotModule.reload("docker")') &&
            reloadFnSection.includes('HotModule.reload("protocol")') &&
            reloadFnSection.includes('HotModule.reload("agents")') &&
            reloadFnSection.includes('HotModule.reload("dochub")');
        check('HMR', 'reloadModules 包含适配器重载', includesAdapterReload);

        const hasExplicitReload = reloadFnSection.includes('HotModule.reload("docker")') &&
            reloadFnSection.includes('HotModule.reload("protocol")') &&
            reloadFnSection.includes('HotModule.reload("dochub")');
        check('HMR', 'reloadModules 显式 reload 缓存', hasExplicitReload);

        const includesFullCascade = reloadFnSection.includes('HotModule.reload("ops")') &&
            reloadFnSection.includes('HotModule.reload("sentinel")') &&
            reloadFnSection.includes('HotModule.reload("creface")') &&
            reloadFnSection.includes('HotModule.reload("maptile")');
        check('HMR', 'reloadModules 含全链路级联', includesFullCascade);

const busOffIdx = src.indexOf('bus.off("reload", moduleReloadListener)');
const busOnIdx = src.indexOf('bus.on("reload", moduleReloadListener)');
check('HMR', 'bus 绑定 moduleReloadListener', busOffIdx !== -1 && busOnIdx !== -1);
    } catch (err) {
        check('HMR', 'moduleReloadListener 验证', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const reloadSection = src.substring(
            src.indexOf("async function reloadModules()"),
            src.indexOf("async function reloadModules()") + 800
        );
        const hasAdapterCascade = reloadSection.includes('HotModule.reload("docker")') &&
            reloadSection.includes('HotModule.reload("protocol")');
        check('HMR', 'ops-reload 级联包含适配器', hasAdapterCascade);

        const hasSentinelCascade = reloadSection.includes('HotModule.reload("sentinel")');
        check('HMR', 'ops-reload 级联包含 sentinel', hasSentinelCascade);
    } catch (err) {
        check('HMR', 'ops-reload 级联包含适配器', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const adapterDir = pathMod.join(MiaoPluginMBT?.Paths?.OpsPath || '', 'modules', 'adapter');
        const files = await fsMod.readdir(adapterDir);
        check('HMR', 'adapter 目录含两模块', files.includes('docker.js') && files.includes('protocol.js'),
            `files=${files.join(',')}`);
    } catch (err) {
        check('HMR', 'adapter 目录含两模块', false, err?.message);
    }

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const modulesDir = pathMod.join(MiaoPluginMBT?.Paths?.OpsPath || '', 'modules');

        const diagDir = pathMod.join(modulesDir, 'agents', 'diagnostic');
        const diagFiles = await fsMod.readdir(diagDir);
        check('HMR', 'agents/diagnostic 含两模块', diagFiles.includes('dochub.js') && diagFiles.includes('errdoc.js'),
            `files=${diagFiles.join(',')}`);

        const agentsDir = pathMod.join(modulesDir, 'agents');
        const agentsFiles = await fsMod.readdir(agentsDir);
        check('HMR', 'agents 根含 sentinel', agentsFiles.includes('sentinel.js'),
            `files=${agentsFiles.join(',')}`);

        const infraDir = pathMod.join(modulesDir, 'infra');
        const infraFiles = await fsMod.readdir(infraDir);
        check('HMR', 'infra 目录含 worker', infraFiles.includes('worker.js'),
            `files=${infraFiles.join(',')}`);

        const featureDir = pathMod.join(modulesDir, 'feature');
        const featureFiles = await fsMod.readdir(featureDir);
        check('HMR', 'feature 目录含四模块', featureFiles.includes('export.js') && featureFiles.includes('mastermsg.js') && featureFiles.includes('creface.js') && featureFiles.includes('maptile.js'),
            `files=${featureFiles.join(',')}`);

        const oldToolsDir = pathMod.join(modulesDir, 'tools');
        let toolsExists = false;
        try { await fsMod.readdir(oldToolsDir); toolsExists = true; } catch {}
        check('HMR', 'tools 目录已移除', !toolsExists, toolsExists ? 'tools/ 仍存在' : '');
    } catch (err) {
        check('HMR', '新目录结构验证', false, err?.message);
    }

    Hades?.D?.('─── 常量定义诊断 ───');

    try {
        const fsMod = await import('node:fs/promises');
        const pathMod = await import('node:path');
        const corePath = pathMod.join(MiaoPluginMBT.Paths.Target.Example, '咕咕牛图库管理器.js');
        const src = await fsMod.readFile(corePath, 'utf-8');

        const hasFiveConstants = src.includes('Git_Timeout_Err_Codes') &&
            src.includes('Git_Network_Err_Keywords') &&
            src.includes('Help_Fallback_Lines') &&
            src.includes('Commit_Prefix_Map') &&
            src.includes('Commit_Game_Prefixes');
        check('常量', '五项基础常量均已定义', hasFiveConstants);

        const hasGitErrorConstants = src.includes('Git_Strike_Strategies') &&
            src.includes('Git_H2_Errors') &&
            src.includes('Git_Log_Whitelist') &&
            src.includes('Git_Diag128_Patterns');
        check('常量', 'git_errors 四项扩展常量均已定义', hasGitErrorConstants);

        const poseidonDelegates = src.includes('static STRATEGIES = Git_Strike_Strategies') &&
            src.includes('static H2_ERRORS = Git_H2_Errors') &&
            src.includes('static LOG_WHITELIST = Git_Log_Whitelist');
        check('常量', 'PoseidonSpear 委托常量引用', poseidonDelegates);

        const diag128UsesConst = src.includes('for (const p of Git_Diag128_Patterns)');
        check('常量', 'diagnose128 使用 Git_Diag128_Patterns', diag128UsesConst);
    } catch (err) {
        check('常量', '常量定义验证', false, err?.message);
    }

    const summary = {
        success: allPass,
        total: results.length,
        passed: results.filter(r => r.pass).length,
        failed: results.filter(r => !r.pass).length,
        results
    };

    Hades?.D?.(`═══ Sentinel 诊断完成: ${summary.passed}/${summary.total} 通过 ═══`);
    return summary;
}

export function formatReport(summary) {
    if (!summary) return '诊断结果为空';
    const lines = [
        `╔══════════════════════════════════╗`,
        `║       Sentinel 哨兵诊断报告       ║`,
        `╚══════════════════════════════════╝`,
        ``,
        `总结: ${summary.passed}/${summary.total} 通过 ${summary.failed > 0 ? `(${summary.failed} 失败)` : '✓ 全部通过'}`,
        `状态: ${summary.success ? '✅ 全域诊断链路正常' : '❌ 存在断链'}`,
        ``
    ];

    const layers = [...new Set(summary.results.map(r => r.layer))];
    for (const layer of layers) {
        const layerResults = summary.results.filter(r => r.layer === layer);
        const layerPass = layerResults.filter(r => r.pass).length;
        lines.push(`【${layer}】${layerPass}/${layerResults.length}`);
        for (const r of layerResults) {
            lines.push(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

export function Sentinel(ctx = {}) {
    const {
        HotModule, DocHub, ErrDoc,
        Ananke, Nomos, HadesEntry, getCore, getHades,
        MiaoPluginMBT, Pheme, CommunityMBT
    } = ctx;

    const Hades = getHades ? getHades(getCore?.()) : (getCore?.() || console);

    class Sentinel extends plugin {
        constructor() {
            super({
                name: '『咕咕牛』哨兵',
                dsc: '全域诊断监控',
                event: 'message',
                priority: 200,
                rule: [
                    { reg: /^#咕咕牛诊断$/i, fnc: 'Diag', permission: 'master' },
                ],
            });
        }

        async Diag(e) {
            try {
                await Pheme.quote(e, '哨兵正在执行诊断...');
                const diagCtx = {
                    HotModule, DocHub, ErrDoc,
                    Ananke, Nomos, HadesEntry, getCore, getHades,
                    MiaoPluginMBT, Pheme, CommunityMBT
                };
                const summary = await Diagnostic(diagCtx, e);
                const report = formatReport(summary);
                Hades.D(report);
                await Pheme.quote(e, report);
            } catch (err) {
                Hades.E('哨兵诊断失败:', err);
                await Pheme.quote(e, `哨兵诊断执行异常: ${err?.message || err}`);
            }
            return true;
        }
    }

    return Sentinel;
}

export default { Diagnostic, formatReport, Sentinel };