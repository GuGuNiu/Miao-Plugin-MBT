export function ErrDoc(Nomos) {
    const history = new Map();
    let config = null;

    async function loadConfig() {
        if (config) return config;
        config = await Nomos.getDiagnosisConfig();
        return config;
    }

    function shouldReport(opName, errCode) {
        const key = `${opName}:${errCode}`;
        const now = Date.now();
        const debounceMs = config?.diagnosis?.debounce_ms || 5000;
        if (history.has(key)) {
            const last = history.get(key);
            if (now - last < debounceMs) return false;
        }
        history.set(key, now);
        if (history.size > 50) history.clear();
        return true;
    }

    function diagnose(err) {
        const msg = ((err?.message || "") + (err?.stderr || "")).toLowerCase();
        const rules = config?.diagnosis?.rules;

        if (rules) {
            for (const [type, rule] of Object.entries(rules)) {
                if (rule.keywords?.some(kw => msg.includes(kw.toLowerCase()))) {
                    return type;
                }
            }
        }

        return 'UNKNOWN';
    }

    function getSuggestions(type) {
        const rules = config?.diagnosis?.rules;
        const common = config?.diagnosis?.common_suggestions || [];
        const typeSuggestions = rules?.[type]?.suggestions || [];
        return [...typeSuggestions, ...common];
    }

    function isSystemStressed() {
        try {
            const mem = process.memoryUsage().rss;
            const threshold = (config?.diagnosis?.memory_threshold_gb || 1.2) * 1024 * 1024 * 1024;
            if (mem > threshold) return true;
        } catch {}
        return false;
    }

    return { loadConfig, shouldReport, diagnose, getSuggestions, isSystemStressed };
}

export default { ErrDoc };
