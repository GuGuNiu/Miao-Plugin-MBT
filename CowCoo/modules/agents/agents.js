import path from "node:path";
import { fileURLToPath } from "node:url";
import { ProviderPool, loadProviderSpecs } from "./providers.js";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const LocalPromptPath = path.join(_dirname, "rule", "prompt.json");

function buildPrompt(systemTemplate, operationName, error, context) {
    return systemTemplate
        .replace('${operationName}', operationName)
        .replace("${error.message || 'N/A'}", error.message ?? 'N/A')
        .replace("${error.code || 'N/A'}", error.code ?? 'N/A')
        .replace("${context || '无'}", context || '无');
}

function sanitizeResponse(content) {
    if (!content || typeof content !== "string") return content;
    let text = content.trim();

    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    const markerIdx = text.search(/##\s*核心原因/i);
    if (markerIdx > 0) {
        text = text.slice(markerIdx).trim();
    }

    return text;
}

async function callProvider(providerSpec, requestBody, Hades) {
    const { provider, api, name } = providerSpec;
    const maxRetries = api.max_retries ?? 2;
    let retryCount = 0;

    const magicWord = provider.decryptKey(api.key_encrypted);
    if (magicWord === null) return { success: false, content: `模型 ${name} 密钥解析异常`, authError: true };
    if (!magicWord) return { success: false, content: `模型 ${name} 配置缺失`, authError: true };

    while (retryCount < maxRetries) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), api.timeout_ms ?? 30000);

            const response = await fetch(api.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${magicWord}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(id);

            if (!response.ok) {
                if (provider.shouldRetry(response.status)) {
                    Hades?.D?.(`[云露] [${name}] API重试(${response.status}) ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    await new Promise(r => setTimeout(r, (api.retry_delay_ms ?? 500) * retryCount));
                    continue;
                } else {
                    if (response.status === 401) {
                        return { success: false, content: `模型 ${name} 授权失败`, authError: true };
                    }
                    return { success: false, content: `模型 ${name} 请求失败(HTTP ${response.status})` };
                }
            }

            const responseData = await response.json();
            return provider.parseResponse(responseData);

        } catch (aiError) {
            if (aiError.name === 'AbortError' || aiError.message.includes('network') || aiError.message.includes('fetch')) {
                Hades?.D?.(`[云露] [${name}] 网络异常重试... ${retryCount + 1}/${maxRetries}`);
                retryCount++;
                await new Promise(r => setTimeout(r, (api.retry_delay_ms ?? 500) * retryCount));
            } else {
                return { success: false, content: `模型 ${name} 连接异常: ${aiError.message}` };
            }
        }
    }
    return { success: false, content: `模型 ${name} 多次重试后仍无响应` };
}

export function Agent(ctx = {}) {
    const { Ananke, Nomos, HadesEntry, getCore, fallbackConfig = null } = ctx;

    const getHades = (logger) => HadesEntry ? HadesEntry({}, logger || getCore()) : (logger || console);

    let _pool = null;

    async function loadConfig(logger) {
        const Hades = getHades(logger);

        try {
            const raw = await Ananke.readFile(LocalPromptPath, 'utf-8');
            if (raw) {
                return JSON.parse(raw);
            }
        } catch { }

        if (Nomos?.getCRPData) {
            try {
                const crppRaw = await Nomos.getCRPData('prompt', Hades);
                if (crppRaw) {
                    return JSON.parse(crppRaw);
                }
            } catch { }
        }

        if (typeof fallbackConfig === 'function') {
            Hades?.W?.('agents: 本地与前置库均不可用, 使用回退配置');
            return await fallbackConfig(Hades);
        }

        return null;
    }

    async function getPool(Hades) {
        if (_pool) return _pool;

        _pool = ProviderPool(Hades);
        const specs = await loadProviderSpecs(Hades);

        for (const spec of specs) {
            if (spec.enabled === false) {
                Hades?.D?.(`[云露] AI模型 ${spec.name} 已禁用, 跳过`);
                continue;
            }
            _pool.register(spec);
            Hades?.D?.(`[云露] AI模型 ${spec.name} 注册成功 (priority: ${spec.priority ?? 99})`);
        }

        return _pool;
    }

    async function consult(operationName, error, context, logger) {
        const Hades = getHades(logger);

        const config = await loadConfig(Hades);
        if (!config?.ai_config) return "云露分析中断：无法加载AI配置。";

        const promptConfig = config.ai_config.prompt;
        if (!promptConfig?.system) return "云露分析中断：无法同步诊断方案。";

        const pool = await getPool(Hades);
        if (pool.size() === 0) return "云露分析失败：无可用AI模型。";

        const prompt = buildPrompt(promptConfig.system, operationName, error, context);

        const maxAttempts = pool.size();
        let lastError = "未知错误";

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const providerSpec = pool.next();
            if (!providerSpec) continue;

            const { provider, model, name } = providerSpec;
            Hades?.D?.(`[云露] 咨询 → 模型: ${name} (${attempt + 1}/${maxAttempts})`);

            const requestBody = provider.buildBody(model, promptConfig, prompt);
            const result = await callProvider(providerSpec, requestBody, Hades);

            if (result.success) {
                pool.markSuccess(name);
                Hades?.D?.(`[云露] 模型 ${name} 响应成功`);
                return sanitizeResponse(result.content);
            }

            pool.markFailed(name);
            lastError = result.content;
            Hades?.D?.(`[云露] 模型 ${name} 失败: ${result.content}`);

            if (result.authError) {
                Hades?.W?.(`[云露] 模型 ${name} 授权异常`);
            }
        }

        return `云露分析失败：所有AI模型均不可用。最后错误: ${lastError}`;
    }

    return { consult, loadConfig, LocalPromptPath };
}

export default { Agent };