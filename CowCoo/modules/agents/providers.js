import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const RuleDir = path.join(_dirname, "rule");

const SparkProvider = {
  name: "spark",

  decryptKey(keyEncrypted) {
    if (!keyEncrypted) return "";
    try {
      return Buffer.from(keyEncrypted, "base64").toString("utf8");
    } catch {
      return null;
    }
  },

  buildBody(model, promptConfig, prompt) {
    const body = {
      model: model.name,
      messages: [{ role: "user", content: prompt }],
      stream: model.stream ?? false,
      max_tokens: model.max_tokens ?? 4096,
      temperature: model.temperature ?? 0.6,
      top_p: model.top_p ?? 0.5,
      stop: promptConfig.stop_words
    };
    if (promptConfig.tools?.web_search) {
      body.tools = [{ type: "web_search", web_search: promptConfig.tools.web_search }];
    }
    return body;
  },

  parseResponse(responseData) {
    if (responseData.error || responseData.code !== 0) {
      const errMsg = responseData.error?.message || responseData.message || "未知API错误";
      const errCode = responseData.error?.code || responseData.code;
      if (errCode === 11200) {
        return { success: false, content: "API授权凭证无效或已过期", authError: true };
      }
      return { success: false, content: `API返回错误 (${errMsg})` };
    }
    const aiContent = responseData.choices?.[0]?.message?.content;
    if (typeof aiContent === "string" && aiContent.trim() !== "") {
      return { success: true, content: aiContent };
    }
    return { success: false, content: "API成功响应，但未返回有效内容" };
  },

  shouldRetry(httpStatus) {
    return httpStatus === 429 || httpStatus >= 500 || httpStatus === 408;
  }
};

const GLMProvider = {
  name: "glm",

  decryptKey(keyEncrypted) {
    if (!keyEncrypted) return "";
    try {
      return Buffer.from(keyEncrypted, "base64").toString("utf8");
    } catch {
      return null;
    }
  },

  buildBody(model, promptConfig, prompt) {
    const stopWords = Array.isArray(promptConfig.stop_words) ? promptConfig.stop_words.slice(0, 4) : promptConfig.stop_words;
    return {
      model: model.name,
      messages: [{ role: "user", content: prompt }],
      stream: model.stream ?? false,
      max_tokens: model.max_tokens ?? 4096,
      temperature: model.temperature ?? 0.6,
      top_p: model.top_p ?? 0.5,
      stop: stopWords
    };
  },

  parseResponse(responseData) {
    if (responseData.error) {
      const errMsg = responseData.error.message || "未知API错误";
      const errCode = responseData.error.code;
      if (errCode === "401" || String(errMsg).toLowerCase().includes("unauthorized") || String(errMsg).toLowerCase().includes("api key")) {
        return { success: false, content: "GLM API授权凭证无效或已过期", authError: true };
      }
      return { success: false, content: `GLM API返回错误 (${errMsg})` };
    }
    const message = responseData.choices?.[0]?.message;
    const aiContent =
      typeof message?.content === "string" && message.content.trim() !== ""
        ? message.content
        : null;
    if (aiContent) {
      return { success: true, content: aiContent };
    }
    return { success: false, content: "GLM API成功响应，但未返回有效内容" };
  },

  shouldRetry(httpStatus) {
    return httpStatus === 429 || httpStatus >= 500 || httpStatus === 408;
  }
};

const PROVIDERS = {
  spark: SparkProvider,
  glm4: GLMProvider,
  glm4_6v: GLMProvider,
  glm4_7: GLMProvider
};

const Cooldown_Ms = 60_000;
const Max_Failures = 3;

async function loadProviderSpecs(Hades) {
  const specs = [];
  try {
    const files = await fs.readdir(RuleDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
    for (const file of jsonFiles) {
      try {
        const raw = await fs.readFile(path.join(RuleDir, file), "utf-8");
        const spec = JSON.parse(raw);
        if (spec && spec.name && PROVIDERS[spec.name]) {
          specs.push(spec);
        }
      } catch {}
    }
  } catch {}
  return specs;
}

export function ProviderPool(Hades) {
  const _providers = [];
  let _index = 0;
  const _health = new Map();

  function register(spec) {
    const providerDef = PROVIDERS[spec.name];
    if (!providerDef) return;
    _providers.push({ ...spec, provider: providerDef });
    if (!_health.has(spec.name)) {
      _health.set(spec.name, { failures: 0, lastFailTime: 0, cooldownUntil: 0 });
    }
  }

  function size() {
    return _providers.filter((p) => p.enabled !== false).length;
  }

  function isHealthy(name) {
    const h = _health.get(name);
    if (!h) return false;
    return Date.now() > h.cooldownUntil;
  }

  function next() {
    const healthy = _providers.filter((p) => p.enabled !== false && isHealthy(p.name));
    const list = healthy.length > 0 ? healthy : _providers.filter((p) => p.enabled !== false);
    if (list.length === 0) return null;
    const picked = list[_index % list.length];
    _index = (_index + 1) % list.length;
    return picked;
  }

  function markSuccess(name) {
    const h = _health.get(name);
    if (h) {
      h.failures = 0;
      h.cooldownUntil = 0;
    }
  }

  function markFailed(name) {
    const h = _health.get(name);
    if (h) {
      h.failures++;
      h.lastFailTime = Date.now();
      if (h.failures >= Max_Failures) {
        h.cooldownUntil = Date.now() + Cooldown_Ms;
      }
    }
  }

  function getStatus() {
    return _providers.map((p) => ({
      name: p.name,
      enabled: p.enabled !== false,
      healthy: isHealthy(p.name),
      failures: _health.get(p.name)?.failures ?? 0
    }));
  }

  return { register, next, markSuccess, markFailed, size, getStatus };
}

export { SparkProvider, GLMProvider, PROVIDERS, loadProviderSpecs, RuleDir };
export default { ProviderPool, SparkProvider, GLMProvider, PROVIDERS, loadProviderSpecs, RuleDir };