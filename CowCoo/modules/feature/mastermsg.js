import path from "node:path";
import fs from "node:fs";

export function MasterMsg(ctx = {}) {
    const { common, yaml, getYzPath } = ctx;

    async function sendMasterMsg(msg, e = null, delay = 0) {
        async function MasterAc() {
            if (typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady && typeof Bot.ready !== 'function')) {
                let retries = 0;
                const maxRetries = 15;
                while ((typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady)) && retries < maxRetries) {
                    if (typeof Bot !== "undefined" && ((typeof Bot.isReady === 'boolean' && Bot.isReady) || (Bot.master && Bot.master.length > 0))) break;
                    await common.sleep(300 + retries * 20);
                    retries++;
                }
            } else if (typeof Bot !== "undefined" && typeof Bot.ready === 'function') {
                try {
                    await Bot.ready();
                } catch {}
            }

            if (typeof Bot === "undefined") return [];

            let MastersRaw = [];

            const CfgMsg = Bot.getConfig?.('masterQQ') || Bot.getConfig?.('master');
            if (CfgMsg) {
                MastersRaw.push(...(Array.isArray(CfgMsg) ? CfgMsg : [CfgMsg]));
            }

            if (MastersRaw.length === 0 && Bot.master?.length > 0) {
                MastersRaw.push(...(Array.isArray(Bot.master) ? Bot.master : [Bot.master]));
            }

            if (MastersRaw.length === 0) {
                try {
                    const yzPath = getYzPath();
                    const configPath = path.join(yzPath, 'config', 'config', 'other.yaml');
                    const configData = fs.existsSync(configPath) ? (yaml.load?.(fs.readFileSync(configPath, 'utf8')) ?? null) : null;

                    if (configData) {
                        const confMasterQQ = configData.masterQQ;
                        const confMasterField = configData.master;

                        if (confMasterQQ) {
                            MastersRaw.push(...(Array.isArray(confMasterQQ) ? confMasterQQ : [confMasterQQ]));
                        }
                        if (confMasterField) {
                            MastersRaw.push(...(Array.isArray(confMasterField)
                                ? confMasterField.map(item => typeof item === 'string' && item.includes(':') ? item.split(':')[1] : item)
                                : [confMasterField]));
                        }
                    }
                } catch {}
            }

            return [...new Set(MastersRaw)]
                .map(id => {
                    let strID = String(id).trim();
                    if (/^[zZ][1-9][0-9]{4,14}$/.test(strID)) {
                        strID = strID.substring(1);
                    }
                    return strID;
                })
                .filter(id => /^[1-9][0-9]{4,14}$/.test(id));
        }

        if (typeof Bot !== "undefined" && typeof Bot.sendMasterMsg === 'function') {
            if (delay > 0) {
                await common.sleep(delay);
            }
            try {
                const targetBots = e?.self_id ? [String(e.self_id)] : undefined;
                await Bot.sendMasterMsg(msg, targetBots, 0);
                return;
            } catch {}
        }

        const MasterQQList = await MasterAc();

        if (!MasterQQList?.length || typeof Bot === "undefined" || typeof Bot.pickUser !== 'function') {
            return;
        }

        if (delay > 0) {
            await common.sleep(delay);
        }

        const selfIds = new Set();
        if (e?.self_id) selfIds.add(String(e.self_id));
        if (Bot?.uin && typeof Bot.uin[Symbol.iterator] === 'function') {
            for (const u of Bot.uin) selfIds.add(String(u));
        } else if (Bot?.uin) {
            selfIds.add(String(Bot.uin));
        }

        const botIds = new Set();
        if (Bot?.bots && typeof Bot.bots === 'object') {
            for (const botId of Object.keys(Bot.bots)) {
                botIds.add(String(botId));
            }
        }

        const validMasters = MasterQQList.filter(id => {
            const strId = String(id);
            if (selfIds.has(strId)) return false;
            if (botIds.has(strId)) return false;
            return true;
        });

        if (!validMasters.length) return;

        for (const masterId of validMasters) {
            try {
                await Bot.pickUser(masterId)?.sendMsg?.(msg);
            } catch {}
        }
    }

    return { sendMasterMsg };
}

export default { MasterMsg };