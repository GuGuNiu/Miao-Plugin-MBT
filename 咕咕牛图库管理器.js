import fs from "node:fs";
import https from 'node:https';
import http from 'node:http';
import tls from 'node:tls';
import net from 'node:net';
import os from "node:os";
import fsPromises from "node:fs/promises";
import { statfs } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import yaml from "yaml";
import crypto from "node:crypto";
import template from "art-template";
import PuppCow from 'puppeteer';
import common from "../../lib/common/common.js";
import dgram from 'node:dgram';
import { Worker } from 'node:worker_threads';
const Trap_Symbol = Symbol.for('Yz.CowCoo.MBT.SignalTrap.Lifecycle.v2');
const Cer_Symbol = Symbol.for('Yz.CowCoo.MBT.Cer.Runtime.v1');
const Hades_Symbol = Symbol.for('Yz.CowCoo.MBT.Hades.Entry');
const Moirai_Symbol = Symbol.for('Yz.CowCoo.MBT.Moirai.v2');
const Dominus_Symbol = Symbol.for('Yz.CowCoo.MBT.SignalTrap.Dominus.v1');
const Charon = "『咕咕牛』";
const getCore = () => global.logger || console;

class Moirai {
    static get _state() {
        let st = global[Moirai_Symbol];
        if (!st || typeof st !== 'object') {
            st = { gen: 0, trace: 'init', timestamp: Date.now() };
            global[Moirai_Symbol] = st;
        }
        return st;
    }

    static get currentGen() {
        return this._state.gen;
    }

    static bump(reason = 'unknown') {
        const st = this._state;
        const now = Date.now();
        if (now - st.timestamp < 100 && st.trace === reason) {
            return st.gen;
        }
        const next = st.gen + 1;
        global[Moirai_Symbol] = { gen: next, trace: reason, timestamp: now };
        return next;
    }

    static stamp(symbol, value) {
        const gen = this.currentGen;
        const wrapper = {
            __MBT_Gen: gen,
            __MBT_Created: Date.now(),
            value
        };
        global[symbol] = wrapper;
        return wrapper;
    }

    static get(symbol, options = {}) {
        const wrapper = global[symbol];
        if (!wrapper) return null;
        if (!wrapper.__MBT_Gen) return wrapper;

        const current = this.currentGen;
        if (wrapper.__MBT_Gen < current) {
            if (options.rejectStale) {
                throw new Error(`${wrapper.__MBT_Gen} < ${current}`);
            }
        }
        return wrapper.value;
    }

    static isCurrent(symbol) {
        const wrapper = global[symbol];
        if (!wrapper?.__MBT_Gen) return true;
        return wrapper.__MBT_Gen === this.currentGen;
    }

    static cleanup(symbol, validator) {
        const wrapper = global[symbol];
        if (!wrapper) return false;
        if (typeof validator === 'function' && !validator(wrapper)) return false;
        if (wrapper.value && typeof wrapper.value.dispose === 'function') {
            try { wrapper.value.dispose(); } catch (e) {}
        }
        delete global[symbol];
        return true;
    }
}

class Hestia {
    static #registry = new FinalizationRegistry((heldValue) => {
        const { type, id, cleanup } = heldValue;
        if (typeof cleanup === 'function') {
            try { cleanup(); } catch (e) {}
        }
    });

    static #activeRes = new Map();
    static #moduleGen = 0;

    static get activeGen() {
        return Math.max(this.#moduleGen, Moirai.currentGen);
    }

    static advance(targetGen = Moirai.currentGen) {
        this.#moduleGen = Math.max(this.#moduleGen, targetGen);
        for (const [id, res] of this.#activeRes) {
            if (res.activeGen < this.#moduleGen - 1) {
                this.forceCleanup(id);
            }
        }
        return this.#moduleGen;
    }

    static register(type, id, object, cleanup) {
        const ref = new WeakRef(object);
        const entry = {
            type,
            id,
            ref,
            cleanup,
            activeGen: this.activeGen,
            createdAt: Date.now()
        };
        this.#activeRes.set(id, entry);
        this.#registry.register(object, { type, id, cleanup });
        return id;
    }

    static unregister(id) {
        this.#activeRes.delete(id);
    }

    static forceCleanup(id) {
        const res = this.#activeRes.get(id);
        if (!res) return;
        try {
            if (typeof res.cleanup === 'function') res.cleanup();
        } catch (e) {}
        this.#activeRes.delete(id);
    }

    static reap(targetGen) {
        const toClean = [];
        for (const [id, res] of this.#activeRes) {
            if (res.activeGen <= targetGen) toClean.push(id);
        }
        for (const id of toClean) this.forceCleanup(id);
    }

    static snapshot() {
        const snap = {};
        for (const [id, res] of this.#activeRes) {
            const obj = res.ref.deref();
            snap[id] = {
                type: res.type,
                activeGen: res.activeGen,
                alive: !!obj,
                age: Date.now() - res.createdAt
            };
        }
        return snap;
    }

    static get stats() {
        let alive = 0, dead = 0;
        for (const [id, res] of this.#activeRes) {
            if (res.ref.deref()) alive++; else dead++;
        }
        return { total: this.#activeRes.size, alive, dead, activeGen: this.activeGen };
    }
}

class RuntimeCtx {
    constructor() {
        this.vectors = null;
        this.decision = null;
        this.history = [];
        this.timestamp = Date.now();
    }
}

function HadesEntry(options = {}, core = getCore()) {
    const TrimPrefix = (text, prefixes) => {
        const list = Array.isArray(prefixes) ? prefixes : [prefixes];
        let working = text.trimStart();
        let matched = false;
        let changed = true;
        while (changed) {
            changed = false;
            for (const prefix of list) {
                if (prefix && working.startsWith(prefix)) {
                    working = working.slice(prefix.length).trimStart();
                    matched = true;
                    changed = true;
                }
            }
        }
        return matched ? working : text;
    };

    const ArrangeArgs = (args, prefix) => {
        if (!args || args.length === 0) return [prefix];
        const [first, ...rest] = args;
        if (typeof first === 'string') {
            const cleaned = TrimPrefix(first, [prefix, Charon]);
            const merged = cleaned ? `${prefix} ${cleaned}` : prefix;
            return [merged, ...rest];
        }
        return [prefix, ...args];
    };

    const ColorMan = () => {
        const colors = [ 147, 117, 120, 211, 229, 209 ];
        let index = 0;
        return {
            next() {
                const color = colors[index % colors.length];
                index++;
                return color;
            },
            colorize(text, colorCode) {
                return `\x1b[38;5;${colorCode}m${text}\x1b[0m`;
            }
        };
    };

    const buildExtras = (sink) => {
        HadesEntry._colorMan ??= ColorMan();
        const colorMan = HadesEntry._colorMan;
        return {
            ColorMan,
            TrimPrefix,
            ArrangeArgs,
            colorMan,
            nextColor: colorMan.next,
            colorize: colorMan.colorize,
            E: (...args) => sink.error(...args),
            D: (...args) => sink.debug(...args),
            W: (...args) => sink.warn(...args),
            O: (...args) => sink.info(...args)
        };
    };

    const decorate = (sink) => {
        const decorated = Object.create(sink);
        Object.assign(decorated, buildExtras(sink));
        decorated[Hades_Symbol] = true;
        return decorated;
    };

    if (core && core[Hades_Symbol]) return decorate(core);
    const { module = "" } = options;
    const prefixText = module ? `[ 咕咕牛图库 ][${module}]` : `[ 咕咕牛图库 ]`;
    const prefix = `\x1b[38;5;66m${prefixText}\x1b[0m`;
    const rawLogger = core?.logger;

    const emit = (method, args) => {
        const fn = core?.[method];
        if (!fn) return;

        if (rawLogger?.[method]) {
            const [first, ...rest] = args;
            if (typeof first === 'string') {
                const cleaned = TrimPrefix(first, [prefixText, Charon, `[ 咕咕牛 ]`, `[ 咕咕牛图库 ]`]);
                const merged = cleaned ? `${prefix} ${cleaned}` : prefix;
                rawLogger[method].call(rawLogger, merged, ...rest);
                return;
            }
            rawLogger[method].call(rawLogger, prefix, ...args);
            return;
        }

        fn.call(core, ...ArrangeArgs(args, prefix));
    };

    const Hades = {
        info(...args) {
            emit("info", args);
        },
        warn(...args) {
            emit("warn", args);
        },
        error(...args) {
            emit("error", args);
        },
        debug(...args) {
            emit("debug", args);
        },
        trace(...args) {
            emit("trace", args);
        }
    };
    return decorate(Hades);
}

const getHades = (logger) => HadesEntry({}, logger || getCore());
const Hades = HadesEntry({});
const toPosix = (p) => p?.replace(/\\/g, "/") || "";
const toFileUrl = (p) => {
  if (!p) return "";
  const posixPath = toPosix(p);
  if (posixPath.startsWith("file://")) return posixPath;
  if (/^[a-zA-Z]:/.test(posixPath)) {
    return `file:///${posixPath}`;
  }
  return `file://${posixPath}`;
};

const toBuffer = (input) => {
    if (!input) return null;
    if (Buffer.isBuffer(input)) return input;
    if (input instanceof ArrayBuffer) return Buffer.from(input);
    if (ArrayBuffer.isView(input)) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    return null;
};

const toBase64Url = (input) => {
    const buffer = toBuffer(input);
    if (!buffer) return "";
    return `base64://${buffer.toString("base64")}`;
};

class MBTAdapterEnv {
    static isOneBotFamily(e) {
        if (!e) return false;
        const adapterName = e?.bot?.adapter?.name || '';
        if (adapterName.includes('OneBot')) return true;
        const selfId = String(e?.self_id || '');
        if (selfId.startsWith('2900')) return true;
        return false;
    }

    static get isOneBot() {
        try { return typeof Bot?.adapter?.name === 'string' && Bot.adapter.name.includes('OneBot'); }
        catch { return false; }
    }

    static get isDocker() {
        try {
            if (fs.existsSync('/.dockerenv')) return true;
            return fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
        } catch { return false; }
    }

    static get isOneBotDocker() {
        return this.isOneBot && this.isDocker;
    }

    static adaptImgType(requested = 'png') {
        if (requested !== 'png') return requested;
        if (!this.isOneBotDocker) return 'png';
        return 'webp';
    }
}

class Pheme {
    static async send(e, msg, quote = false) {
        if (!e?.reply) return false;
        try { return await e.reply(msg, quote); } catch { return false; }
    }
    static async quote(e, msg) { return this.send(e, msg, true); }
    static async error(e, msg) { return this.quote(e, msg); }
    static async info(e, msg) { return this.quote(e, msg); }
    static async success(e, msg) { return this.quote(e, msg); }
    static async warning(e, msg) { return this.quote(e, msg); }
    static async img(e, seg, fallbackText = '', logger = null) {
        return MiaoPluginMBT.ReplyImg(e, seg, fallbackText, logger);
    }
    static async forward(e, list, title) {
        if (!e?.reply || !common?.makeForwardMsg) return false;
        try {
            const msg = await common.makeForwardMsg(e, list, title);
            return await e.reply(msg);
        } catch { return false; }
    }
    static async noPerm(e) { return this.quote(e, '这个操作只有我的主人才能用哦~'); }
    static async noRepo(e) { return this.quote(e, '咕咕牛的图库你还没下载呢！'); }
    static async initFail(e) { return this.quote(e, '『咕咕牛🐂』插件初始化失败，请检查后台日志。'); }
    static async notReady(e) { return this.quote(e, '咕咕牛插件核心服务未就绪，大部分功能无法使用。'); }
    static async cooldown(e, ttl, tier = '') {
        const tierStr = tier ? ` (Tier ${tier})` : '';
        return this.quote(e, `指令冷却中${tierStr}，请等待 ${ttl} 秒。`);
    }
    static async emptyResult(e, type, name = '') {
        const map = {
            tag: `没有找到任何带${name}的图片哦。`,
            character: `图库数据中没有找到『${name}』的图片信息。`,
            ban: '当前没有任何图片被封禁。',
            folder: `『${name}』的文件夹里没有找到支持的图片文件哦。`,
            img: `在图库数据里没找到这个图片: ${name}。`,
            role: `在图库数据里没找到角色: ${name}。`,
        };
        return this.quote(e, map[type] || '未找到相关结果。');
    }
    static async genFail(e, type = 'img') {
        const map = {
            img: '生成图片失败，请查看后台日志。',
            report: '生成报告失败，请查看后台日志。',
            status: '状态图生成失败，请查看后台日志。',
            search: '生成查看助手图片失败，请查看后台日志。',
            speedtest: '测速报告生成失败。',
            errorReport: '生成详细错误报告失败，请查看控制台日志。',
        };
        return this.quote(e, map[type] || '生成失败，请查看后台日志。');
    }
    static async sendFail(e, opName, err, sendErr) {
        return this.quote(e, `[${opName}] 发送失败已文本通知。\n原错误: ${err?.message || '未知错误'}\n发送错误码: ${sendErr?.code || 'SEND_FAIL'}`);
    }
    static async lowMem(e, freeMB) {
        return this.quote(e, `咕咕牛发现当前系统内存极低 (${freeMB}MB)，已暂时挂起操作。`);
    }
    static async wait(e, msg) { return this.quote(e, msg); }
}

class MetisError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'MetisError';
        this.code = code;
    }
}

class Metis {
    constructor(name = 'Anonymous', logger = console) {
        this.name = name;
        this.logger = getHades(logger);
        this._queue = [];
        this._holder = null;
        this._isLocked = false;
        this._perfStart = 0;
        this._activeGen = Moirai.currentGen;

        this._regId = `Metis:${name}:${this._activeGen}:${Date.now()}`;
        Hestia.register('Metis', this._regId, this, () => {
            this.emergencyReset(`HMR_GEN${this._activeGen}`);
        });

        this._reloadTrapListener = () => this.emergencyReset(`HMR_Gen${this._activeGen}`);
    }

    syncGen(newGen) {
        const targetGen = newGen ?? Moirai.currentGen;
        if (this._activeGen !== targetGen && (this._isLocked || this._queue.length > 0)) {
            this.emergencyReset(`GEN_SYNC ${this._activeGen}->${targetGen}`);
        } else if (this._regId) {
            Hestia.unregister(this._regId);
        }
        this._activeGen = targetGen;
        this._regId = `Metis:${this.name}:${this._activeGen}:${Date.now()}`;
        Hestia.register('Metis', this._regId, this, () => {
            this.emergencyReset(`HMR_Gen${this._activeGen}`);
        });
    }

    async run(taskFn, options = {}) {
        const { ttl = 0, wait = 0, id = 'Unknown', instant = false, priority = 0 } = options;
        const rid = `[Metis:${this.name}:${id}]`;

        try {
            await this._acquire(id, wait, instant, priority);
        } catch (err) {
            if (err.code === 'METIS_BUSY') {
                this.logger.debug(`${rid} 锁被占用`);
            } else if (err.code === 'METIS_WAIT_TIMEOUT') {
                this.logger.debug(`${rid} 等待锁超时 (${wait}ms)`);
            }
            throw err;
        }

        if (this._holder.reentryCount > 1) {
            try {
                return await taskFn(new AbortController().signal);
            } finally {
                this._release(id);
            }
        }

        const controller = new AbortController();
        let timeoutTimer = null;

        this._holder.start = performance.now();
        this._perfStart = this._holder.start;

        if (ttl > 0) {
            timeoutTimer = setTimeout(() => {
                const elapsed = performance.now() - this._perfStart;
                this.logger.debug(`${rid} 任务超时 (设:${ttl}ms|实:${elapsed.toFixed(1)}ms)，强制释放`);
                controller.abort('METIS_TTL_EXPIRED');
                if (this._holder) this._holder.expired = true;
            }, ttl);
        }

        try {
            return await taskFn(controller.signal);
        } catch (err) {
            if (controller.signal.aborted && controller.signal.reason === 'METIS_TTL_EXPIRED') {
                throw new MetisError(`任务超过TTL时间限制 (${ttl}ms)`, 'METIS_TTL_EXPIRED');
            }
            throw err;
        } finally {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            this._release(id);
        }
    }

    async _acquire(id, waitTime, instant, priority = 0) {
        if (this._isLocked && this._holder && this._holder.id === id) {
            this._holder.reentryCount++;
            return;
        }

        if (this._isLocked) {
            if (instant) throw new MetisError('锁被占用', 'METIS_BUSY');

            const { promise, resolve, reject } = Promise.withResolvers();
            let waitTimer = null;
            if (waitTime > 0) {
                waitTimer = setTimeout(() => {
                    const idx = this._queue.findIndex(item => item.resolve === resolve);
                    if (idx !== -1) this._queue.splice(idx, 1);
                    reject(new MetisError('等待超时', 'METIS_WAIT_TIMEOUT'));
                }, waitTime);
            }

            this._queue.push({ resolve, reject, timer: waitTimer, id, priority, timestamp: performance.now() });
            this._queue.sort((a, b) => {
                if (b.priority !== a.priority) return a.priority - b.priority;
                return a.timestamp - b.timestamp;
            });

            await promise;
        }

        this._isLocked = true;
        this._holder = { id, reentryCount: 1 };
    }

    _release(releaserId) {
        if (!this._holder || (this._holder.id !== releaserId && !this._holder.expired)) return;

        if (this._holder.reentryCount > 1) {
            this._holder.reentryCount--;
            return;
        }

        this._holder = null;
        if (this._queue.length > 0) {
            const next = this._queue.shift();
            if (next.timer) clearTimeout(next.timer);
            next.resolve();
        } else {
            this._isLocked = false;
        }
    }

    emergencyReset(reason) {
        const isHMR = reason.includes('HMR') || reason.includes('热重载') || reason.includes('Gen_Sync');
        if (isHMR) {
            this.logger.warn(`Metis:${this.name} | ${reason}`);
        } else {
            this.logger.warn(`[Metis:${this.name}] 强制重置: ${reason}`);
        }
        while (this._queue.length > 0) {
            const item = this._queue.shift();
            if (item.timer) clearTimeout(item.timer);
            item.reject(new MetisError(`锁强制重置: ${reason}`, 'METIS_RESET'));
        }
        this._holder = null;
        this._isLocked = false;
        if (this._regId) {
            Hestia.unregister(this._regId);
            this._regId = null;
        }
    }

    getStats() {
        return {
            locked: this._isLocked,
            holder: this._holder ? this._holder.id : null,
            reentry: this._holder ? this._holder.reentryCount : 0,
            queueLen: this._queue.length,
            uptime: this._holder && this._holder.start ? performance.now() - this._holder.start : 0
        };
    }
}

const QuantumFlux = (fn, min = 0, max = 3600000) => {
    return () => {
        const _delta = MBTMath.Range(min, max);
        setTimeout(async () => {
            try {
                await fn();
            } catch {}
        }, _delta);
    };
};

class MBTPagination {
    static #sizes = { MuB: 28, Vis: 28, FM: 28 };

    static #normalize(size) {
        const value = Number(size);
        if (!Number.isInteger(value) || value <= 0) throw new Error("分页数量必须是正整数");
        return value;
    }

    static getPageSize(key) {
        if (this.#sizes[key] === undefined) throw new Error(`无效的分页键: ${key}`);
        return this.#sizes[key];
    }

    static setPageSize(key, size) {
        if (this.#sizes[key] === undefined) throw new Error(`无效的分页键: ${key}`);
        this.#sizes[key] = this.#normalize(size);
        return this.#sizes[key];
    }

    static getAll() {
        return { ...this.#sizes };
    }

    static setAll(config = {}) {
        Object.entries(config).forEach(([key, val]) => {
            if (this.#sizes[key] !== undefined) this.setPageSize(key, val);
        });
        return this.getAll();
    }
}

class Nyx {
    static Proxy_Pro = [
        ['clash', ['clashverge', 'clashforwindows'], ['cfw', 'clash-win64', 'clash-linux', 'clash-meta', 'mihomo'], 0.75],
        ['v2ray', ['v2rayn', 'v2ray-core'], ['v2rayn-core', 'v2rayng'], 0.75],
        ['sing-box', ['singbox'], [], 0.8],
        ['naive', ['naiveproxy'], [], 0.8],
        ['hysteria', ['hysteria2'], [], 0.8],
        ['shadowsocks', ['shadowsocksr', 'ss-local'], [], 0.75],
        ['trojan', ['trojan-go'], [], 0.8],
        ['nekoray', ['nekobox'], [], 0.8],
        ['tuic', [], [], 0.85],
        ['proxy', ['vpn'], [], 0.7]
    ].map(([name, aliases, secondary, threshold]) => {
        const _nor = s => s.toLowerCase().replace(/[\s\-_.]/g, '');
        return { name, aliases, secondary, threshold, _n: _nor(name), _a: aliases.map(_nor), _s: secondary.map(_nor) };
    });

    static #_bigramsReady = false;

    static _bigramSet(s) {
        return new Set(Array.from({ length: s.length - 1 }, (_, i) =>
            s.charCodeAt(i) << 16 | s.charCodeAt(i + 1)
        ));
    }

    static _ensureBigrams() {
        if (this.#_bigramsReady) return;
        for (const e of this.Proxy_Pro) {
            e._bg = this._bigramSet(e._n);
            e._bgLen = e._n.length - 1;
        }
        this.#_bigramsReady = true;
    }

    static _nor(str) {
        return str.toLowerCase().replace(/[\s\-_.]/g, '');
    }

    static _diceBigram(s1, entry, threshold) {
        const { _bg, _bgLen } = entry;
        if (!_bg) return 0;
        const s1Len = s1.length;
        const s1BgTotal = s1Len - 1;
        if (s1BgTotal <= 0 || _bgLen <= 0) return s1 === entry._n ? 1 : 0;

        const needed = Math.ceil(threshold * (s1BgTotal + _bgLen) / 2);
        let overlap = 0, remaining = s1BgTotal;

        for (let i = 0; i < s1BgTotal; i++) {
            const bg = s1.charCodeAt(i) << 16 | s1.charCodeAt(i + 1);
            if (_bg.has(bg)) overlap++;
            remaining--;
            if (overlap + remaining < needed) return 0;
        }

        return (2 * overlap) / (s1BgTotal + _bgLen);
    }

    static _bitap(text, pattern, k = 1) {
        const m = pattern.length;
        if (m === 0) return text.length <= k ? 1 : 0;
        if (m > 31) return null;

        const mask = {};
        for (let i = 0; i < m; i++) {
            const c = pattern[i];
            mask[c] = (mask[c] || 0) | (1 << i);
        }

        let R = Array.from({ length: k + 1 }, () => ~1);
        let best = 0;

        for (let i = 0; i < text.length; i++) {
            const charMask = mask[text[i]] || 0;
            let prev = R[0];
            R[0] = ((R[0] << 1) | 1) & charMask;

            for (let d = 1; d <= k; d++) {
                const tmp = R[d];
                R[d] = ((R[d] << 1) | 1) & charMask | (prev << 1) | prev | (R[d - 1] << 1);
                prev = tmp;
            }

            if ((R[k] & (1 << (m - 1))) !== 0) {
                best = Math.max(best, 1 - k / Math.max(m, text.length));
            }
        }

        return best;
    }

    static _againstMatrix(procName, entry) {
        const s1 = this._nor(procName);
        const { _n, _a, _s } = entry;

        if (s1 === _n || s1.includes(_n)) return { matched: true, pattern: entry.name, score: 1.0, level: 'primary' };

        for (const alias of _a) {
            if (s1 === alias || s1.includes(alias)) return { matched: true, pattern: entry.name, score: 0.95, level: 'alias' };
        }

        for (const sec of _s) {
            if (s1 === sec || s1.includes(sec)) return { matched: true, pattern: entry.name, score: 0.9, level: 'secondary' };
        }

        this._ensureBigrams();

        if (s1.length <= 8) {
            const bitapScore = this._bitap(s1, _n, 2);
            if (bitapScore !== null && bitapScore >= entry.threshold) {
                return { matched: true, pattern: entry.name, score: bitapScore, level: 'fuzzy' };
            }
        }

        const score = this._diceBigram(s1, entry, entry.threshold);
        if (score >= entry.threshold) return { matched: true, pattern: entry.name, score, level: 'fuzzy' };

        return null;
    }

    static fuzzyMatch(procName) {
        for (const entry of this.Proxy_Pro) {
            const result = this._againstMatrix(procName, entry);
            if (result) return result;
        }
        return { matched: false, pattern: null, score: 0, level: null };
    }

    static async scan(agentGates = [], nativeIP = null, Hades = console, envData = null) {
        const candidates = await this._buildDiscoveryPool(agentGates, Hades);
        
        if (candidates.size === 0) {
            return [];
        }

        const sniffPromises = Array.from(candidates.values()).map(async (candidate, idx) => {
            const result = await this._evaluateCandidate(candidate, nativeIP, Hades, envData);
            return result;
        });
        
        const results = (await Promise.all(sniffPromises)).filter(Boolean);

        if (Hades?.D) {
            const PROTOCOL_MODE_MAP = { socks5_direct: '直连模式', socks5_idle: '仅握手', unknown: '未验证' };
            const logParts = results.map(r => {
                const modeStr = PROTOCOL_MODE_MAP[r.protocol] ?? r.modeDesc ?? '未知';
                return `${r.port}(分:${r.score})[${modeStr}]`;
            });
            Hades.D(`代理端口池: ${logParts.length > 0 ? logParts.join(', ') : '无可用端口'}`);
        }

        results.sort((a, b) => {
            if (a.verified !== b.verified) return a.verified ? -1 : 1;
            if (a.protocol === 'socks5' && b.protocol !== 'socks5') return -1;
            if (b.protocol === 'socks5' && a.protocol !== 'socks5') return 1;
            return b.score - a.score;
        });

        return results;
    }

    static async _buildDiscoveryPool(agentGates, Hades) {
        const pool = new Map();

        const addPort = (port, score, source) => {
            if (!port || isNaN(port)) return;
            const p = parseInt(port, 10);
            if (!pool.has(p)) pool.set(p, { port: p, score: 0, sources: new Set() });
            const entry = pool.get(p);
            entry.score = Math.min(100, entry.score + score);
            entry.sources.add(source);
        };

        try {
            const processPorts = await this._scanSystemProcesses();
            processPorts.forEach(p => addPort(p, 60, 'os_process'));
        } catch (e) {
            if (Hades?.D) Hades.D(`OS进程扫描异常(已降级): ${e.message}`);
        }

        if (Array.isArray(agentGates)) {
            agentGates.forEach(p => addPort(p, 40, 'common_port'));
        }

        return pool;
    }

    static async _evaluateCandidate(candidate, nativeIP = null, Hades = console, envData = null) {
        let protocol = null;
        let verified = false;
        let tunVerified = false;
        let isDirectMode = false;

        const s5Handshake = await this._sniffSocks5(candidate.port);

        if (s5Handshake === 'handshake' || s5Handshake === true) {
            protocol = 'socks5';
            tunVerified = await this._probeS5Tun(candidate.port);
            verified = tunVerified;

            if (tunVerified && nativeIP) {
                const proxyCheck = await this._probeS5RealIP(candidate.port, nativeIP);
                if (proxyCheck) {
                    isDirectMode = proxyCheck.isDirect;

                    const puppV4 = envData?.network?.browser?.v4?.ip;
                    if (isDirectMode && puppV4 && puppV4 !== nativeIP) {
                        isDirectMode = false;
                    }

                    if (isDirectMode) {
                        tunVerified = false;
                        verified = false;
                        protocol = 'socks5_direct';
                        candidate.modeDesc = '直连模式';
                        protocol = 'socks5';
                        candidate.modeDesc = '代理模式';
                    }
                }
            }

            if (!tunVerified && protocol !== 'socks5_direct') {
                return candidate.score >= 60 ? {
                    host: '127.0.0.1',
                    port: candidate.port,
                    protocol: 'socks5_idle',
                    source: 'handshake_only',
                    verified: false,
                    tunVerified: false,
                    score: candidate.score,
                    modeDesc: '仅握手'
                } : null;
            }

            if (protocol === 'socks5_direct') {
                return candidate.score >= 60 ? {
                    host: '127.0.0.1',
                    port: candidate.port,
                    protocol: 'socks5_direct',
                    source: 'direct_mode_detected',
                    verified: false,
                    tunVerified: false,
                    isDirectMode: true,
                    score: candidate.score,
                    modeDesc: candidate.modeDesc || '直连模式'
                } : null;
            }
        } else {
            const httpResult = await this._sniffHttp(candidate.port);
            if (httpResult) {
                protocol = 'http';
                verified = true;
                candidate.modeDesc = 'HTTP代理';
            }
        }

        if (verified) {
            return {
                host: '127.0.0.1',
                port: candidate.port,
                protocol,
                source: [...candidate.sources].join('+'),
                verified: true,
                tunVerified: true,
                score: candidate.score,
                modeDesc: candidate.modeDesc || '代理有效'
            };
        }

        if (candidate.score >= 60) {
            return {
                host: '127.0.0.1',
                port: candidate.port,
                protocol: 'unknown',
                source: 'os_process_unverified',
                verified: false,
                tunVerified: false,
                score: candidate.score,
                modeDesc: '未验证'
            };
        }

        return null;
    }

    static _sniffSocks5(port) {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(1500);
            let resolved = false;
            const finish = (res) => { if (!resolved) { resolved = true; socket.destroy(); resolve(res); } };

            socket.on('connect', () => socket.write(Buffer.from([0x05, 0x01, 0x00])));
            socket.on('data', (data) => {
                if (data.length >= 2 && data[0] === 0x05 && [0x00, 0x02, 0xFF].includes(data[1])) {
                    finish('handshake');
                } else {
                    finish(false);
                }
            });
            socket.on('error', () => finish(false));
            socket.on('timeout', () => finish(false));
            socket.on('close', () => finish(false));
            socket.connect(port, '127.0.0.1');
        });
    }

    static _probeS5Tun(port, probeHost = '1.1.1.1', probePort = 80, timeout = 3000) {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);
            let step = 0;
            let resolved = false;
            const finish = (res) => {
                if (!resolved) { resolved = true; socket.destroy(); resolve(res); }
            };

            const hostBuf = Buffer.from(probeHost);
            socket.on('connect', () => {
                socket.write(Buffer.from([0x05, 0x01, 0x00]));
            });

            socket.on('data', (data) => {
                if (step === 0) {
                    if (data[0] === 0x05 && data[1] === 0x00) {
                        step = 1;
                        const ipParts = probeHost.split('.').map(Number);
                        const connectReq = Buffer.from([
                            0x05, 0x01, 0x00, 0x01,
                            ...ipParts,
                            (probePort >> 8) & 0xFF, probePort & 0xFF
                        ]);
                        socket.write(connectReq);
                    } else {
                        finish(false);
                    }
                } else if (step === 1) {
                    if (data[0] === 0x05 && data[1] === 0x00) {
                        finish(true);
                    } else {
                        finish(false);
                    }
                }
            });

            socket.on('error', () => finish(false));
            socket.on('timeout', () => finish(false));
            socket.connect(port, '127.0.0.1');
        });
    }

    static async _probeS5RealIP(port, nativeIP, timeout = 5000) {
        const ipCheckServices = [
            { host: 'api.ipify.org', path: '/?format=json', field: 'ip' },
            { host: 'ipapi.co', path: '/json/', field: 'ip' },
            { host: 'free.freeipapi.com', path: '/api/json/', field: 'ipAddress' }
        ];

        for (const service of ipCheckServices) {
            try {
                const proxyIP = await this._getIPViaSocks5(port, service.host, service.path, timeout);
                if (proxyIP) {
                    const isDirect = proxyIP === nativeIP;
                    return {
                        proxyIP,
                        nativeIP,
                        isDirect,
                        service: service.host
                    };
                }
            } catch {}
        }
        return null;
    }

    static _getIPViaSocks5(proxyPort, targetHost, targetPath, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);
            let step = 0;
            let resolved = false;
            let responseBuffer = Buffer.alloc(0);

            const finish = (res) => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    resolve(res);
                }
            };

            const fail = (err) => {
                if (!resolved) {
                    resolved = true;
                    socket.destroy();
                    reject(err);
                }
            };

            socket.on('connect', () => {
                socket.write(Buffer.from([0x05, 0x01, 0x00]));
            });

            socket.on('data', (data) => {
                if (step === 0) {
                    if (data[0] === 0x05 && data[1] === 0x00) {
                        step = 1;
                        const hostBuf = Buffer.from(targetHost);
                        const connectReq = Buffer.concat([
                            Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuf.length]),
                            hostBuf,
                            Buffer.from([(443 >> 8) & 0xFF, 443 & 0xFF])
                        ]);
                        socket.write(connectReq);
                    } else {
                        fail(new Error('SOCKS5认证失败'));
                    }
                } else if (step === 1) {
                    if (data[0] === 0x05 && data[1] === 0x00) {
                        step = 2;
                        const tlsSocket = tls.connect({
                            socket: socket,
                            servername: targetHost,
                            rejectUnauthorized: false
                        }, () => {
                            tlsSocket.write(`GET ${targetPath} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: CowCoo/1.0\r\nConnection: close\r\n\r\n`);
                        });

                        tlsSocket.on('data', (chunk) => {
                            responseBuffer = Buffer.concat([responseBuffer, chunk]);
                        });

                        tlsSocket.on('end', () => {
                            try {
                                const response = responseBuffer.toString();
                                const bodyMatch = response.match(/\r\n\r\n([\s\S]+)/);
                                if (bodyMatch) {
                                    const body = JSON.parse(bodyMatch[1]);
                                    const ip = body.ip || body.ipAddress;
                                    if (ip) finish(ip);
                                    else fail(new Error('响应中未找到IP'));
                                } else {
                                    fail(new Error('HTTP响应格式无效'));
                                }
                            } catch (e) {
                                fail(e);
                            }
                        });

                        tlsSocket.on('error', fail);
                    } else {
                        fail(new Error('SOCKS5连接失败'));
                    }
                }
            });

            socket.on('error', fail);
            socket.on('timeout', () => fail(new Error('连接超时')));
            socket.connect(proxyPort, '127.0.0.1');
        });
    }

    static _sniffHttp(port) {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(1500);
            let resolved = false;
            const finish = (res) => { if (!resolved) { resolved = true; socket.destroy(); resolve(res); } };

            socket.on('connect', () => {
                socket.write('CONNECT www.google.com:80 HTTP/1.1\r\nHost: www.google.com:80\r\n\r\n');
            });
            socket.on('data', (data) => {
                const str = data.toString();
                if (/HTTP\/1\.[01] (200|403|407|502|503)/.test(str)) {
                    finish(true);
                } else {
                    finish(false);
                }
            });
            socket.on('error', () => finish(false));
            socket.on('timeout', () => finish(false));
            socket.on('close', () => finish(false));
            socket.connect(port, '127.0.0.1');
        });
    }

    static async _scanSystemProcesses() {
        const platform = os.platform();
        const ports = new Set();

        if (platform === 'win32') {
            try {
                const netstatOut = await this._execFile('netstat', ['-ano', '-p', 'tcp']);
                const lines = netstatOut.split('\n');
                const pidMap = new Map();

                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 4 && parts[3] === 'LISTENING') {
                        const localAddr = parts[1];
                        const pid = parts[4];
                        const port = parseInt(localAddr.split(':').pop());
                        if (localAddr.includes('127.0.0.1') || localAddr.includes('0.0.0.0') || localAddr.startsWith('[')) {
                            pidMap.set(pid, port);
                        }
                    }
                }

                if (pidMap.size > 0) {
                    const tasklistOut = await this._execFile('tasklist', ['/FO', 'CSV', '/NH']);
                    const taskLines = tasklistOut.split('\r\n');
                    for (const line of taskLines) {
                        const parts = line.split(',');
                        if (parts.length < 2) continue;
                        const procName = parts[0].replace(/"/g, '').toLowerCase();
                        const pid = parts[1].replace(/"/g, '');

                        const matchResult = this.fuzzyMatch(procName, 0.75);
                        if (matchResult.matched) {
                            if (pidMap.has(pid)) ports.add(pidMap.get(pid));
                        }
                    }
                }
            } catch (e) {}
        } else if (platform === 'linux') {
            try {
                const tcpContent = await fsPromises.readFile('/proc/net/tcp', 'utf-8');
                const inodes = new Map();
                const lines = tcpContent.split('\n').slice(1);
                for (const line of lines) {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length < 10) continue;
                    if (parts[3] !== '0A') continue;
                    const port = parseInt(parts[1].split(':')[1], 16);
                    const inode = parts[9];
                    inodes.set(inode, port);
                }

                const pids = await fsPromises.readdir('/proc');
                let loopCount = 0;

                for (const pid of pids) {
                    if (!/^\d+$/.test(pid)) continue;

                    if (++loopCount % 50 === 0) await new Promise(r => setImmediate(r));

                    try {
                        const commPath = `/proc/${pid}/comm`;
                        const comm = (await fsPromises.readFile(commPath, 'utf-8')).trim().toLowerCase();
                        const matchResult = this.fuzzyMatch(comm, 0.75);
                        if (!matchResult.matched) continue;
                        const fdDir = `/proc/${pid}/fd`;
                        const fds = await fsPromises.readdir(fdDir);
                        for (const fd of fds) {
                            try {
                                const link = await fsPromises.readlink(path.join(fdDir, fd));
                                const match = link.match(/socket:\[(\d+)\]/);
                                if (match) {
                                    const inode = match[1];
                                    if (inodes.has(inode)) ports.add(inodes.get(inode));
                                }
                            } catch {}
                        }
                    } catch {}
                }
            } catch (e) {}
        }
        return ports;
    }

    static _execFile(cmd, args) {
        return new Promise((resolve, reject) => {
            const cp = spawn(cmd, args, { windowsHide: true });
            let out = '';
            cp.stdout.on('data', d => out += d);
            cp.on('close', () => resolve(out));
            cp.on('error', reject);
        });
    }
}

class Hermes {
    static #cache = new Map();
    static #envCache = null;
    static #envCacheTime = 0;
    static #ENV_TTL = 10 * 60 * 1000;
    static #TTL_POOL = 1209600;
    static #senseDepth = 0;
    static #senseCache = null;
    static #senseCacheTime = 0;
    static #SENSE_TTL = 15000;
    static #CACHE_PATH = path.join(process.cwd(), 'temp', 'CowCoo', 'NetWork', 'ipconfig.json');
    static #IP_CACHE_TTL = 600 * 1000;
    static #Default_Max_Body_Bytes = 1024 * 1024;
    static #Default_Max_Handshake_Bytes = 64 * 1024;
    static #agents = new Set();

    static get Sources() {
        return HermesMatrix.Sources;
    }

    static async #ensureDir(filePath) {
        try {
            const dir = path.dirname(filePath);
            await fsPromises.mkdir(dir, { recursive: true });
        } catch {}
    }

    static async #loadEnvFromDisk(Hades = null) {
        try {
            const content = await fsPromises.readFile(this.#CACHE_PATH, 'utf-8');
            const data = JSON.parse(content);
            const updateTime = data?.meta?.updateTime || data?.updateTime;
            if (updateTime && Date.now() - new Date(updateTime).getTime() < 2 * 60 * 60 * 1000) {
                if (Hades) Hades.D(`从磁盘加载网络态势感知信息: ${this.#CACHE_PATH}`);
                return data;
            }
        } catch (e) {
        }
        return null;
    }

    static async #saveEnvToDisk(data, Hades = null) {
        try {
            await this.#ensureDir(this.#CACHE_PATH);
            await fsPromises.writeFile(this.#CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
            if (Hades) Hades.D(`网络态势感知信息已保存到磁盘: ${this.#CACHE_PATH}`);
        } catch (e) {
            if (Hades) Hades.W(`无法保存网络态势感知信息到磁盘: ${e.message}`);
        }
    }

    static cleanup() {
        this.#cache.clear();
        this.#envCache = null;
        for (const agent of this.#agents) {
            try { agent.destroy(); } catch (e) {}
        }
        this.#agents.clear();
    }

    static enterSense() {
        this.#senseDepth += 1;
    }

    static exitSense() {
        if (this.#senseDepth > 0) this.#senseDepth -= 1;
    }

    static async getSenseSnapshot(envData = null, Hades = console) {
        if (this.#senseCache && (Date.now() - this.#senseCacheTime < this.#SENSE_TTL)) return this.#senseCache;
        if (this.#senseDepth > 0) return this.#senseCache;
        this.enterSense();
        try {
            const sense = await Proteus.sense(envData || {}, Infinity, Hades).catch(() => null);
            if (sense) {
                this.#senseCache = sense;
                this.#senseCacheTime = Date.now();
            }
            return sense;
        } finally {
            this.exitSense();
        }
    }

    static async getIPv6Info(Hades = console) {
        const stack = await this.getIPStack(Hades);
        return {
            v6Ready: stack.v6Ip !== 'N/A',
            v6Ip: stack.v6Ip === 'N/A' ? null : stack.v6Ip
        };
    }

    static async getSystemProxy(Hades = console) {
        const normalizeEntry = (scheme, host, port, raw) => {
            const parsed = parseInt(port, 10);
            if (!host || !Number.isFinite(parsed)) return null;
            return { scheme, host, port: parsed, raw };
        };

        const parseHostPort = (value, schemeHint) => {
            if (!value) return [];
            const trimmed = String(value).trim();
            if (!trimmed) return [];
            if (trimmed.includes('://')) {
                try {
                    const url = new URL(trimmed);
                    const scheme = (url.protocol || '').replace(':', '') || schemeHint || 'http';
                    const entry = normalizeEntry(scheme, url.hostname, url.port, trimmed);
                    return entry ? [entry] : [];
                } catch {
                    return [];
                }
            }
            const match = trimmed.match(/^([^:]+):(\d+)$/);
            if (!match) return [];
            const entry = normalizeEntry(schemeHint || 'http', match[1], match[2], trimmed);
            return entry ? [entry] : [];
        };

        const parseProxyString = (value) => {
            const trimmed = String(value || '').trim();
            if (!trimmed) return [];
            if (trimmed.includes(';')) {
                let entries = [];
                trimmed.split(';').map(v => v.trim()).filter(Boolean).forEach(part => {
                    const eqIndex = part.indexOf('=');
                    if (eqIndex > 0) {
                        const scheme = part.slice(0, eqIndex).trim().toLowerCase();
                        const rest = part.slice(eqIndex + 1).trim();
                        entries = entries.concat(parseHostPort(rest, scheme));
                    } else {
                        entries = entries.concat(parseHostPort(part, 'http'));
                    }
                });
                return entries;
            }
            if (trimmed.includes('=')) {
                const [schemeRaw, restRaw] = trimmed.split('=');
                return parseHostPort(restRaw, String(schemeRaw).trim().toLowerCase());
            }
            return parseHostPort(trimmed, 'http');
        };

        const buildResult = (entries, source, raw) => {
            const uniq = [];
            const seen = new Set();
            for (const entry of entries || []) {
                if (!entry) continue;
                const key = `${entry.scheme || 'http'}|${entry.host}|${entry.port}`;
                if (seen.has(key)) continue;
                seen.add(key);
                uniq.push(entry);
            }
            if (uniq.length === 0) return null;
            const pick = (schemes) => uniq.find(e => schemes.includes(e.scheme));
            const primary = pick(['https', 'http']) || pick(['socks5', 'socks']) || uniq[0];
            const ports = Array.from(new Set(uniq.map(e => e.port))).filter(p => Number.isFinite(p));
            return { ...primary, entries: uniq, ports, source, raw };
        };

        const envVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
        const envKeys = envVars.map(v => v.toLowerCase());
        let envEntries = [];
        let rawEnv = null;
        envVars.forEach(key => {
            const val = process.env[key];
            if (!val) return;
            if (!rawEnv) rawEnv = val;
            envEntries = envEntries.concat(parseProxyString(val));
        });
        const envResult = buildResult(envEntries, 'env', rawEnv);
        if (envResult) return envResult;

        if (process.platform === 'win32') {
            const runCmd = (cmd) => new Promise((resolve) => {
                const proc = spawn('cmd', ['/c', cmd], { windowsHide: true });
                let output = "";
                proc.stdout.on('data', (data) => { output += data.toString(); });
                proc.stderr.on('data', (data) => { output += data.toString(); });
                proc.on('error', () => resolve(""));
                proc.on('close', () => resolve(output));
            });

            const winhttpOutput = await runCmd('netsh winhttp show proxy');
            const directMatch = winhttpOutput.match(/Direct access \(no proxy server\)/i);

            if (!directMatch) {
                const winhttpMatch = winhttpOutput.match(/Proxy Server\(s\)\s*:\s*([^\r\n]+)/i);
                if (winhttpMatch) {
                    const value = winhttpMatch[1].trim();
                    const entries = parseProxyString(value);
                    const result = buildResult(entries, 'winhttp', value);
                    if (result) return result;
                }
            }

            const regOutput = await runCmd('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /v ProxyServer /v AutoConfigURL');
            let enabled = true;
            const enableMatch = regOutput.match(/ProxyEnable\s+REG_DWORD\s+0x([0-9a-f]+)/i);
            if (enableMatch) enabled = parseInt(enableMatch[1], 16) !== 0;

            const serverMatch = regOutput.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/i);
            if (enabled && serverMatch) {
                const value = serverMatch[1].trim();
                const entries = parseProxyString(value);
                const result = buildResult(entries, 'winhttp', value);
                if (result) return result;
            }

            const pacMatch = regOutput.match(/AutoConfigURL\s+REG_SZ\s+([^\r\n]+)/i);
            if (pacMatch) {
                const pacUrl = pacMatch[1].trim();
                try {
                    const res = await this.request(pacUrl, { timeout: 3000 });
                    if (res.success && res.body) {
                        const match = res.body.match(/(?:PROXY|SOCKS5?|HTTP)s?\s+([a-zA-Z0-9.-]+:\d+)/i);
                        if (match && match[1]) {
                            const entries = parseProxyString(match[1]);
                            const result = buildResult(entries, 'pac', match[1]);
                            if (result) return result;
                        }
                    }
                } catch {}
            }

            return null;
        }

        if (process.platform === 'linux') {
            const parseEnvText = (text, nullSep = false) => {
                const list = nullSep ? text.split('\0') : text.split(/\r?\n/);
                let entries = [];
                let raw = null;
                list.forEach(line => {
                    if (!line) return;
                    const idx = line.indexOf('=');
                    if (idx <= 0) return;
                    const key = line.slice(0, idx).trim().toLowerCase();
                    if (!envKeys.includes(key)) return;
                    const val = line.slice(idx + 1).trim().replace(/^"+|"+$/g, "");
                    if (!val) return;
                    if (!raw) raw = val;
                    entries = entries.concat(parseProxyString(val));
                });
                return { entries, raw };
            };

            let entries = [];
            let raw = null;
            const files = [
                { path: '/etc/environment', nullSep: false },
                { path: '/etc/profile', nullSep: false },
                { path: '/proc/1/environ', nullSep: true }
            ];
            for (const f of files) {
                try {
                    const content = await fsPromises.readFile(f.path, 'utf-8');
                    if (!content) continue;
                    const parsed = parseEnvText(content, f.nullSep);
                    if (parsed.entries.length > 0) {
                        entries = entries.concat(parsed.entries);
                        if (!raw && parsed.raw) raw = parsed.raw;
                    }
                } catch {}
            }
            const linuxResult = buildResult(entries, 'linux', raw);
            if (linuxResult) return linuxResult;
        }

        return null;
    }

    static #getIPStrategy() {
        return {
            sources: HermesMatrix.Sources,
            timeout: 3000,
            cacheKey: 'Env:IPStack'
        };
    }

    static async #probeIPStack(strategy, options = {}) {
        const { Hades = console, requestFn = this.request.bind(this), useCache = true } = options;
        const cfg = this.#getIPStrategy();
        const cacheKey = cfg.cacheKey;
        if (useCache && cacheKey) {
            if (this.#cache.has(cacheKey)) {
                const { val, exp } = this.#cache.get(cacheKey);
                if (Date.now() < exp) {
                    const v4Ok = !val.v4Ip || val.v4Ip === 'N/A' || net.isIPv4(val.v4Ip);
                    const v6Ok = !val.v6Ip || val.v6Ip === 'N/A' || net.isIPv6(val.v6Ip);
                    if (v4Ok && v6Ok) return val;
                }
                this.#cache.delete(cacheKey);
            }
        }

        const [v4Result, v6Result] = await Promise.all([
            HermesMatrix.race(cfg.sources.IPv4, 4, requestFn, Hades, cfg.timeout),
            HermesMatrix.race(cfg.sources.IPv6, 6, requestFn, Hades, cfg.timeout)
        ]);

        const result = HermesMatrix.Synthesize(v4Result, v6Result, Hades);
        if (useCache && cacheKey) {
            this.#cache.set(cacheKey, { val: result, exp: Date.now() + this.#IP_CACHE_TTL });
        }
        return result;
    }

    static async getHostProfile(Hades = console) {
        const platform = os.platform();
        const release = os.release();
        let isDocker = false;
        let dockerenv = false;
        let containerenv = false;
        let cgroup = null;
        let kubernetes = false;
        let containerHint = null;
        const envHint = process.env.CONTAINER || process.env.container;
        const kubeHint = process.env.KUBERNETES_SERVICE_HOST || process.env.KUBERNETES_PORT;
        if (envHint) containerHint = envHint;
        if (kubeHint) kubernetes = true;
        if (platform === 'linux') {
            dockerenv = fs.existsSync('/.dockerenv');
            containerenv = fs.existsSync('/run/.containerenv');
            isDocker = dockerenv || containerenv;
            try {
                const raw = await fsPromises.readFile('/proc/1/cgroup', 'utf-8');
                if (raw) {
                    cgroup = raw.trim().slice(0, 800);
                    const mark = raw.toLowerCase();
                    if (mark.includes('docker') || mark.includes('kubepods') || mark.includes('containerd') || mark.includes('libpod')) {
                        isDocker = true;
                    }
                    if (mark.includes('kubepods') || mark.includes('kube')) kubernetes = true;
                }
            } catch {}
        }
        return {
            platform,
            release,
            isDocker,
            container: {
                dockerenv,
                containerenv,
                cgroup,
                kubernetes,
                hint: containerHint || null
            }
        };
    }

    static async getIPStack(Hades = console) {
        return this.#probeIPStack('competitive', { Hades });
    }

    static async getIPStackByProxy(proxy, Hades = console) {
        const requestFn = (url, options) => this.request(url, { ...options, proxy, forceProxy: true, skipSense: true });
        return this.#probeIPStack('competitive', { Hades, requestFn, useCache: false });
    }

    static async dualStackRace(host, Hades = console) {
        const race = (ver) => new Promise(resolve => {
            const start = Date.now();
            const socket = new net.Socket();
            socket.setTimeout(2000);

            socket.connect({ port: 443, host: host, family: ver }, () => {
                const latency = Date.now() - start;
                socket.destroy();
                resolve(latency);
            });

            const fail = () => { socket.destroy(); resolve(Infinity); };
            socket.on('error', fail);
            socket.on('timeout', fail);
        });

        const [v4, v6] = await Promise.all([race(4), race(6)]);

        if (v6 !== Infinity) Hades.D(`IPv6 穿透成功: ${v6}ms`);

        return { v4, v6 };
    }

    static TcpProbe(host, port, timeout = 1500) {
        return new Promise((resolve, reject) => {
            const s = new net.Socket();
            s.setTimeout(timeout);
            s.connect(port, host, () => {
                s.destroy();
                resolve(true);
            });
            s.on('error', (fail) => {
                s.destroy();
                reject(fail);
            });
            s.on('timeout', () => {
                s.destroy();
                reject(new Error('连接超时'));
            });
        });
    }

    static UdpPulse(host, port = 53, timeout = 2000) {
        return new Promise((resolve) => {
            const socket = dgram.createSocket('udp4');
            const timer = setTimeout(() => {
                socket.close();
                resolve(false);
            }, timeout);

            socket.on('error', () => {
                clearTimeout(timer);
                socket.close();
                resolve(false);
            });

            socket.on('message', () => {
                clearTimeout(timer);
                socket.close();
                resolve(true);
            });

            const packet = Buffer.from([
                0x12, 0x34, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
                0x06, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x03, 0x63, 0x6f, 0x6d, 0x00,
                0x00, 0x01, 0x00, 0x01
            ]);

            socket.send(packet, port, host, (err) => {
                if (err) {
                    clearTimeout(timer);
                    socket.close();
                    resolve(false);
                }
            });
        });
    }

    static async dialBeacons(beacons = {}, Hades = null) {
        const dial = async (host, port) => {
            if (!host) return false;
            try {
                await this.TcpProbe(host, port, 1500);
                return true;
            } catch {
                return false;
            }
        };

        const [cn, global, biz, gitcode, udp] = await Promise.all([
            dial(beacons.BeaconCN || beacons.cn, 80),
            dial(beacons.BeaconGlobal || beacons.global, 443),
            dial(beacons.BeaconBiz || beacons.biz, 443),
            dial(beacons.BeaconGitcode || beacons.gitcode, 443),
            this.UdpPulse('8.8.8.8', 53)
        ]);

        return { cn, global, biz, gitcode, udp };
    }

    static async #try(fn, fallback, Hades = null, tag = '') {
        try {
            return await fn();
        } catch (e) {
            if (Hades) Hades.D(`${tag}${e?.message ? `: ${e.message}` : ''}`);
            return fallback;
        }
    }
    static async getRandomRawTarget(logger = null) {
        const Hades = logger ? getHades(logger) : { O: () => {}, D: () => {}, W: () => {}, E: () => {} };
        await Nomos.CleanDataPool('UAPool', Hades);
        const repoPool = await Nomos.CleanDataPool('RepoPool', Hades);
        if (!Array.isArray(repoPool) || repoPool.length === 0) return null;
        const repo = repoPool[MBTMath.Range(0, repoPool.length - 1)];
        const cleanRepo = String(repo).trim().replace(/\/+$/, '').replace(/\.git$/, '');
        if (!cleanRepo) return null;
        const result = `${cleanRepo}.git/info/refs?service=git-upload-pack`;
        return result;
    }

    static BuildMirrProbe(prefix, targetUrl) {
        const cleanURL = String(targetUrl || '').trim();
        if (!cleanURL) return '';

        const cleanPrefix = String(prefix || '').trim().replace(/\/+$/, '');
        if (!cleanPrefix) return cleanURL;

        return `${cleanPrefix}/${cleanURL.replace(/^\/+/, '')}`;
    }

    static #Build_Limit_Error(code, message) {
        const error_item = new Error(message);
        error_item.code = code;
        return error_item;
    }

    static #Resolve_Byte_Limit(value, fallback) {
        const numeric_value = Number(value);
        if (Number.isFinite(numeric_value) && numeric_value > 0) return Math.floor(numeric_value);
        return fallback;
    }

    static #Collect_Body_Limit(stream, max_body_bytes) {
        const body_limit = this.#Resolve_Byte_Limit(max_body_bytes, this.#Default_Max_Body_Bytes);
        return new Promise((resolve, reject) => {
            const chunks = [];
            let total_bytes = 0;
            let settled = false;

            const cleanup = () => {
                stream.off('data', on_data);
                stream.off('end', on_end);
                stream.off('error', on_error);
            };

            const fail = (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(err);
            };

            const on_error = (err) => fail(err);
            const on_data = (chunk) => {
                total_bytes += chunk.length;
                if (total_bytes > body_limit) {
                    const limit_error = this.#Build_Limit_Error('E_HTTP_BODY_LIMIT', `HTTP响应体超限(${total_bytes}/${body_limit})`);
                    if (typeof stream.destroy === 'function') stream.destroy(limit_error);
                    return fail(limit_error);
                }
                chunks.push(chunk);
            };
            const on_end = () => {
                if (settled) return;
                settled = true;
                cleanup();
                try {
                    resolve(Buffer.concat(chunks).toString('utf-8'));
                } catch (err) {
                    reject(err);
                }
            };

            stream.on('data', on_data);
            stream.on('end', on_end);
            stream.on('error', on_error);
        });
    }

    static async request(url, options = {}, redirects = 0) {
        if (redirects > 3) return { success: false, error: new Error('重定向次数过多') };
        const { timeout = 10000, method = 'GET', headers = {}, signal, skipUAPool = false, family = 0, skipSense = false, proxy = null, forceProxy = false } = options;
        const max_body_bytes = this.#Resolve_Byte_Limit(options.max_body_bytes ?? options.maxBodyBytes, this.#Default_Max_Body_Bytes);
        const max_handshake_bytes = this.#Resolve_Byte_Limit(options.max_handshake_bytes ?? options.maxHandshakeBytes, this.#Default_Max_Handshake_Bytes);
        const isGitcode = url.includes('gitcode.com');
        const effSkipSense = skipSense || (isGitcode && !forceProxy);
        const isHttp = url.startsWith('http:');

        let agent = null;
        let useProxy = false;
        let proxyHost = null;
        let proxyPort = null;
        let proxyScheme = null;
        let shuffledCiphers = undefined;
        let finalFamily = family;

        if (!isHttp) {
            const defaultCiphers = tls.DEFAULT_CIPHERS.split(':');
            shuffledCiphers = MBTMath.Shuffle(defaultCiphers).join(':');
        }

        try {
            const target = new URL(url);
            const noProxy = this.#isNoProxy(target.hostname);
            if (proxy && proxy.host && Number.isFinite(proxy.port)) {
                if (!noProxy || forceProxy) {
                    useProxy = true;
                    proxyHost = proxy.host;
                    proxyPort = proxy.port;
                    proxyScheme = proxy.scheme || 'http';
                }
            } else if (!effSkipSense) {
                const envData = (this.#envCache && (Date.now() - this.#envCacheTime < this.#ENV_TTL)) ? this.#envCache : null;
                const sense = await this.getSenseSnapshot(envData);
                const mode = sense?.mode;
                if (mode === Proteus.State.V6_TURBO) finalFamily = 6;
                const sysProxy = await this.getSystemProxy();
                const proxyContext = sense?.vector?.proxyContext || null;
                const entry = (() => {
                    if (sysProxy && Array.isArray(sysProxy.entries) && sysProxy.entries.length > 0) {
                        const pick = (schemes) => sysProxy.entries.find(e => schemes.includes(e.scheme));
                        return pick(['http']) || pick(['https']) || pick(['socks5', 'socks']) || sysProxy.entries[0];
                    }
                    if (sysProxy && sysProxy.host && Number.isFinite(sysProxy.port)) {
                        return { host: sysProxy.host, port: sysProxy.port, scheme: sysProxy.scheme || 'http' };
                    }
                    if (proxyContext && proxyContext.host && proxyContext.port) {
                        return { host: proxyContext.host, port: proxyContext.port, scheme: proxyContext.protocol || 'http' };
                    }
                    return null;
                })();
                if (entry && mode !== Proteus.State.AIRLOCK && !noProxy) {
                    useProxy = true;
                    proxyHost = entry.host;
                    proxyPort = entry.port;
                    proxyScheme = entry.scheme || 'http';
                }
            }
        } catch {}

        if (!useProxy) {
            const baseOpts = { keepAlive: true, maxSockets: 10, maxFreeSockets: 5, timeout: 30000 };
            agent = isHttp
                ? new http.Agent(baseOpts)
                : new https.Agent({ ciphers: shuffledCiphers, minVersion: 'TLSv1.2', ...baseOpts });
            this.#agents.add(agent);
            const agentId = `HttpAgent:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
            Hestia.register('HttpAgent', agentId, agent, () => {
                try { agent.destroy(); } catch (e) {}
            });
        }

        const ua = skipUAPool ? null : await Nomos.CleanDataPool('UAPool', Hades, { randomUA: true });
        const requestModule = isHttp ? http : https;
        const baseHeaders = { 'Connection': 'keep-alive', ...headers };
        if (ua) baseHeaders['User-Agent'] = ua;

        if (useProxy) {
            return this.#proxyRequest(
                url,
                { method, timeout, signal, headers: baseHeaders, family: finalFamily, ciphers: shuffledCiphers, max_body_bytes, max_handshake_bytes },
                { host: proxyHost, port: proxyPort, scheme: proxyScheme },
                { ...options, max_body_bytes, max_handshake_bytes, maxBodyBytes: max_body_bytes, maxHandshakeBytes: max_handshake_bytes },
                redirects
            );
        }

        return new Promise((resolve) => {

            const req = requestModule.request(url, { method, agent, timeout, signal, family: finalFamily, headers: baseHeaders }, (res) => {
                if (res.statusCode === 418 && isGitcode) {
                    req.destroy();
                    resolve({ success: false, status: 418, body: null, error: new Error('请求失败') });
                    return;
                }

                if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                    let nextUrl = res.headers.location;
                    if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                    return resolve(this.request(nextUrl, options, redirects + 1));
                }

                this.#Collect_Body_Limit(res, max_body_bytes)
                    .then(body => {
                        resolve({ success: true, status: res.statusCode, body });
                    })
                    .catch(err => {
                        req.destroy();
                        resolve({ success: false, status: res.statusCode || 0, body: null, error: err });
                    });
            });
            const fail = (err) => {
                if (!req.destroyed) req.destroy();
                resolve({ success: false, status: 0, body: null, error: err });
            };
            req.on('error', (err) => { if (err.name !== 'AbortError') fail(err); });
            req.on('timeout', () => fail(new Error('请求超时')));
            if (signal?.aborted) req.destroy();
            req.end();
        });
    }

    static #isNoProxy(hostname) {
        const val = process.env.NO_PROXY || process.env.no_proxy || '';
        if (!val) return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
        if (val === '*') return true;
        const list = val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).map(entry => entry.split(':')[0]);
        const hn = String(hostname || '').toLowerCase();
        if (!hn) return false;
        if (hn === 'localhost' || hn === '127.0.0.1' || hn === '::1') return true;
        return list.some(entry => {
            if (entry.startsWith('.')) return hn.endsWith(entry);
            return hn === entry;
        });
    }

    static #proxyRequest(url, reqOptions, proxy, options, redirects) {
        const scheme = String(proxy.scheme || 'http').toLowerCase();
        const isHttp = url.startsWith('http:');
        if (scheme.startsWith('socks')) {
            return isHttp
                ? this.#httpViaSocks(url, reqOptions, proxy, options, redirects)
                : this.#httpsViaSocks(url, reqOptions, proxy, options, redirects);
        }
        return isHttp
            ? this.#httpViaProxy(url, reqOptions, proxy, options, redirects)
            : this.#httpsViaProxy(url, reqOptions, proxy, options, redirects);
    }

    static #httpViaProxy(url, opts, proxy, options, redirects) {
        return new Promise((resolve) => {
            const target = new URL(url);
            const headers = { ...opts.headers, Host: target.hostname };
            const req = http.request({ host: proxy.host, port: proxy.port, method: opts.method, timeout: opts.timeout, headers, path: url, family: opts.family }, (res) => {
                if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                    let nextUrl = res.headers.location;
                    if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                    return resolve(this.request(nextUrl, options, redirects + 1));
                }
                this.#Collect_Body_Limit(res, opts.max_body_bytes)
                    .then(body => resolve({ success: true, status: res.statusCode, body }))
                    .catch(err => resolve({ success: false, status: res.statusCode || 0, body: null, error: err }));
            });
            req.on('error', err => resolve({ success: false, status: 0, body: null, error: err }));
            req.on('timeout', () => resolve({ success: false, status: 0, body: null, error: new Error('请求超时') }));
            if (opts.signal?.aborted) req.destroy();
            req.end();
        });
    }

    static #httpsViaProxy(url, opts, proxy, options, redirects) {
        return new Promise((resolve) => {
            const target = new URL(url);
            const targetPort = target.port ? Number(target.port) : 443;
            const connectReq = http.request({
                host: proxy.host,
                port: proxy.port,
                method: 'CONNECT',
                path: `${target.hostname}:${targetPort}`,
                timeout: opts.timeout,
                headers: { 'Host': `${target.hostname}:${targetPort}`, 'Connection': 'keep-alive', 'Proxy-Connection': 'keep-alive' }
            });
            const onFail = (err) => resolve({ success: false, status: 0, body: null, error: err });
            connectReq.on('connect', (res, socket) => {
                if (res.statusCode !== 200) {
                    socket.destroy();
                    return onFail(new Error(`代理连接失败: ${res.statusCode}`));
                }
                const tlsSocket = tls.connect({
                    socket,
                    servername: target.hostname,
                    minVersion: 'TLSv1.2',
                    ciphers: opts.ciphers
                });
                tlsSocket.on('error', (err) => onFail(err));
                const req = https.request({
                    host: target.hostname,
                    method: opts.method,
                    path: target.pathname + (target.search || ''),
                    headers: opts.headers,
                    createConnection: () => tlsSocket,
                    agent: false,
                    timeout: opts.timeout
                }, (res) => {
                    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                        let nextUrl = res.headers.location;
                        if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                        return resolve(this.request(nextUrl, options, redirects + 1));
                    }
                    this.#Collect_Body_Limit(res, opts.max_body_bytes)
                        .then(body => resolve({ success: true, status: res.statusCode, body }))
                        .catch(err => onFail(err));
                });
                req.on('error', onFail);
                req.on('timeout', () => onFail(new Error('请求超时')));
                if (opts.signal?.aborted) req.destroy();
                req.end();
            });
            connectReq.on('error', onFail);
            connectReq.on('timeout', () => onFail(new Error('请求超时')));
            if (opts.signal?.aborted) connectReq.destroy();
            connectReq.end();
        });
    }

    static #readExact(socket, size, timeout, signal, max_handshake_bytes) {
        return new Promise((resolve, reject) => {
            let buffer = Buffer.alloc(0);
            let timer = null;
            const max_bytes = this.#Resolve_Byte_Limit(max_handshake_bytes, this.#Default_Max_Handshake_Bytes);
            const cleanup = () => {
                if (timer) clearTimeout(timer);
                socket.off('data', onData);
                socket.off('error', onError);
                socket.off('close', onClose);
                if (signal) signal.removeEventListener('abort', onAbort);
            };
            const onAbort = () => {
                cleanup();
                reject(new Error('请求中止'));
            };
            const onError = (err) => {
                cleanup();
                reject(err);
            };
            const onClose = () => {
                cleanup();
                reject(new Error('连接已关闭'));
            };
            const onData = (chunk) => {
                if (buffer.length + chunk.length > max_bytes) {
                    cleanup();
                    return reject(this.#Build_Limit_Error('E_SOCKS_HANDSHAKE_LIMIT', `SOCKS握手数据超限(${buffer.length + chunk.length}/${max_bytes})`));
                }
                try {
                    buffer = Buffer.concat([buffer, chunk]);
                } catch (err) {
                    cleanup();
                    return reject(this.#Build_Limit_Error('E_SOCKS_BUFFER_CONCAT', err?.message || 'SOCKS握手缓冲拼接失败'));
                }
                if (buffer.length >= size) {
                    const out = buffer.slice(0, size);
                    const rest = buffer.slice(size);
                    if (rest.length) socket.unshift(rest);
                    cleanup();
                    resolve(out);
                }
            };
            if (size > max_bytes) {
                return reject(this.#Build_Limit_Error('E_SOCKS_HANDSHAKE_LIMIT', `SOCKS读取长度超限(${size}/${max_bytes})`));
            }
            if (timeout) timer = setTimeout(() => onError(new Error('请求超时')), timeout);
            if (signal) signal.addEventListener('abort', onAbort, { once: true });
            socket.on('data', onData);
            socket.on('error', onError);
            socket.on('close', onClose);
        });
    }

    static async #socksConnect(targetHost, targetPort, proxy, timeout, signal, max_handshake_bytes) {
        return new Promise((resolve, reject) => {
            const socket = net.connect({ host: proxy.host, port: proxy.port }, async () => {
                try {
                    socket.write(Buffer.from([0x05, 0x01, 0x00]));
                    const greet = await this.#readExact(socket, 2, timeout, signal, max_handshake_bytes);
                    if (greet[1] !== 0x00) throw new Error('SOCKS 认证失败');
                    const addrType = net.isIPv4(targetHost) ? 0x01 : 0x03;
                    let addrBuf;
                    if (addrType === 0x01) addrBuf = Buffer.from(targetHost.split('.').map(n => parseInt(n, 10)));
                    else {
                        const hostBuf = Buffer.from(targetHost, 'utf8');
                        addrBuf = Buffer.concat([Buffer.from([hostBuf.length]), hostBuf]);
                    }
                    const portBuf = Buffer.from([(targetPort >> 8) & 0xff, targetPort & 0xff]);
                    const req = Buffer.concat([Buffer.from([0x05, 0x01, 0x00, addrType]), addrBuf, portBuf]);
                    socket.write(req);
                    const head = await this.#readExact(socket, 4, timeout, signal, max_handshake_bytes);
                    if (head[1] !== 0x00) throw new Error('SOCKS 连接失败');
                    const repType = head[3];
                    if (repType === 0x01) await this.#readExact(socket, 6, timeout, signal, max_handshake_bytes);
                    else if (repType === 0x04) await this.#readExact(socket, 18, timeout, signal, max_handshake_bytes);
                    else if (repType === 0x03) {
                        const lenBuf = await this.#readExact(socket, 1, timeout, signal, max_handshake_bytes);
                        await this.#readExact(socket, lenBuf[0] + 2, timeout, signal, max_handshake_bytes);
                    }
                    resolve(socket);
                } catch (e) {
                    socket.destroy();
                    reject(e);
                }
            });
            socket.on('error', reject);
        });
    }

    static #httpViaSocks(url, opts, proxy, options, redirects) {
        return new Promise(async (resolve) => {
            try {
                const target = new URL(url);
                const port = target.port ? Number(target.port) : 80;
                const socket = await this.#socksConnect(target.hostname, port, proxy, opts.timeout, opts.signal, opts.max_handshake_bytes);
                const req = http.request({
                    host: target.hostname,
                    port,
                    method: opts.method,
                    path: target.pathname + (target.search || ''),
                    headers: opts.headers,
                    createConnection: () => socket,
                    agent: false,
                    timeout: opts.timeout
                }, (res) => {
                    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                        let nextUrl = res.headers.location;
                        if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                        return resolve(this.request(nextUrl, options, redirects + 1));
                    }
                    this.#Collect_Body_Limit(res, opts.max_body_bytes)
                        .then(body => resolve({ success: true, status: res.statusCode, body }))
                        .catch(err => resolve({ success: false, status: res.statusCode || 0, body: null, error: err }));
                });
                req.on('error', err => resolve({ success: false, status: 0, body: null, error: err }));
                req.on('timeout', () => resolve({ success: false, status: 0, body: null, error: new Error('请求超时') }));
                if (opts.signal?.aborted) req.destroy();
                req.end();
            } catch (err) {
                resolve({ success: false, status: 0, body: null, error: err });
            }
        });
    }

    static #httpsViaSocks(url, opts, proxy, options, redirects) {
        return new Promise(async (resolve) => {
            try {
                const target = new URL(url);
                const port = target.port ? Number(target.port) : 443;
                const socket = await this.#socksConnect(target.hostname, port, proxy, opts.timeout, opts.signal, opts.max_handshake_bytes);
                const tlsSocket = tls.connect({ socket, servername: target.hostname, minVersion: 'TLSv1.2', ciphers: opts.ciphers });
                tlsSocket.on('error', (err) => resolve({ success: false, status: 0, body: null, error: err }));
                const req = https.request({
                    host: target.hostname,
                    port,
                    method: opts.method,
                    path: target.pathname + (target.search || ''),
                    headers: opts.headers,
                    createConnection: () => tlsSocket,
                    agent: false,
                    timeout: opts.timeout
                }, (res) => {
                    if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                        let nextUrl = res.headers.location;
                        if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                        return resolve(this.request(nextUrl, options, redirects + 1));
                    }
                    this.#Collect_Body_Limit(res, opts.max_body_bytes)
                        .then(body => resolve({ success: true, status: res.statusCode, body }))
                        .catch(err => resolve({ success: false, status: res.statusCode || 0, body: null, error: err }));
                });
                req.on('error', err => resolve({ success: false, status: 0, body: null, error: err }));
                req.on('timeout', () => resolve({ success: false, status: 0, body: null, error: new Error('请求超时') }));
                if (opts.signal?.aborted) req.destroy();
                req.end();
            } catch (err) {
                resolve({ success: false, status: 0, body: null, error: err });
            }
        });
    }

    static #getCache(key) {
        const entry = this.#cache.get(key);
        if (entry && Date.now() < entry.exp) return entry.val;
        this.#cache.delete(key);
        return null;
    }

    static #setCache(key, val, ttlSeconds) {
        this.#cache.set(key, { val, exp: Date.now() + (ttlSeconds * 1000) });
    }

    static async getEnvSnapshot(Hades = console) {
        try {
            if (Hades && typeof Hades.D === 'function') Hades.D(`网络态势感知启动中...`);

            const randomUA = await Nomos.CleanDataPool('UAPool', Hades, { randomUA: true });
            const userAgent = randomUA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
            const { v4, v6 } = await Morpheus.withPage(async (page) => {
                page.setDefaultNavigationTimeout(10000);
                await page.setUserAgent(userAgent);
                const detect = async (sources, expectedFamily) => {
                    for (const src of sources) {
                        try {
                            const result = await page.evaluate(async (url) => {
                                try {
                                    const response = await fetch(url, { cache: 'no-store' });
                                    const text = await response.text();
                                    return { ok: response.ok, status: response.status, text };
                                } catch (error) {
                                    return { ok: false, status: 0, error: String(error) };
                                }
                            }, src.url);
                            if (result?.ok && result.text) {
                                let text = result.text.replace(/<[^>]*>/g, '');
                                try {
                                    const json = JSON.parse(text);
                                    const ip = json[src.field];
                                    const country = json[src.geoField] || json.country_code || json.countryCode || json.country;
                                    if (ip) {
                                        const isV4 = net.isIPv4(ip);
                                        const isV6 = net.isIPv6(ip);
                                        if (expectedFamily === 4 && !isV4) continue;
                                        if (expectedFamily === 6 && !isV6) continue;
                                        return { ip, country, src: src.url, data: json };
                                    }
                                } catch (e) {
                                    if (Hades) Hades.D(`JSON 解析失败 [${src.url}]: ${e.message}`);
                                }
                            } else if (Hades) {
                                const status = result?.status ?? 0;
                                const errMsg = result?.error ? ` ${result.error}` : '';
                                Hades.D(`探测接口返回异常 [${src.url}]: ${status}${errMsg}`);
                            }
                        } catch (e) {
                            if (Hades) Hades.D(`探测接口超时或失败 [${src.url}]: ${e.message}`);
                        }
                    }
                    return null;
                };
                const [v4Result, v6Result] = await Promise.all([
                    detect(Hermes.Sources.IPv4, 4),
                    detect(Hermes.Sources.IPv6, 6)
                ]);
                return { v4: v4Result, v6: v6Result };
            }, Hades);

            const formatPuppResult = (result, family) => {
                if (!result) return 'N/A';
                const via = result.src ? new URL(result.src).hostname : 'unknown';
                const { data } = result;
                const country = result.country
                    ?? data?.country_code
                    ?? data?.countryCode
                    ?? data?.country
                    ?? data?.country_name
                    ?? 'N/A';
                return `${result.ip}(${country})[${via}]`;
            };
            const v4Log = formatPuppResult(v4, 4);
            const v6Log = formatPuppResult(v6, 6);
            if (Hades && typeof Hades.D === 'function') Hades.D(`Pupp感知结果: v4=${v4Log}, v6=${v6Log}`);
            return { v4, v6 };

        } catch (e) {
            if (Hades && typeof Hades.W === 'function') Hades.W(`Pupp感知失败: ${e.message}`);
            return { v4: null, v6: null };
        }
    }

    static async getNativeIPStack(Hades = console) {
        const race = async (sources, family) => {
            const promises = sources.map(src => {
                const lib = src.url.startsWith('https') ? https : http;
                return new Promise((resolve, reject) => {
                    const req = lib.request(src.url, {
                        method: 'GET',
                        timeout: 5000,
                        family,
                        agent: false,
                        headers: { 'User-Agent': 'curl/7.68.0' }
                    }, (res) => {
                        if (res.statusCode !== 200) {
                            res.resume();
                            return reject(new Error(`状态 ${res.statusCode}`));
                        }
                        let data = '';
                        res.on('data', chunk => data += chunk);
                        res.on('end', () => {
                            try {
                                const json = JSON.parse(data);
                                const ip = json[src.field];
                                if (!ip) throw new Error('无IP');
                                resolve({ ip, data: json, src });
                            } catch (e) { reject(e); }
                        });
                    });
                    req.on('error', reject);
                    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
                    req.end();
                });
            });
            try {
                return await Promise.any(promises);
            } catch { return null; }
        };

        const [v4Result, v6Result] = await Promise.all([
            race(Hermes.Sources.IPv4, 4),
            race(Hermes.Sources.IPv6, 6)
        ]);

        if (v4Result?.data?.geoData && typeof v4Result.data.geoData === 'string') {
            try { v4Result.data.geoData = JSON.parse(v4Result.data.geoData); } catch {}
        }

        return HermesMatrix.Synthesize(v4Result, v6Result, Hades, 'Hermes:Native');
    }

    static async ActiveProxyPort(ports = null, Hades = console) {
        try {
            const results = await Nyx.scan(ports, null, Hades, null);
            if (results && results.length > 0) {
                const best = results[0];
                if (Hades?.D) {
                    Hades.D(`Nyx: ${best.protocol}://${best.host}:${best.port}`);
                }
                return best;
            }
        } catch (e) {
            if (Hades?.D) Hades.D(`扫描异常: ${e.message}`);
        }
        return null;
    }

    static async getEnvInfo(Hades = console) {
        if (this.#envCache && (Date.now() - this.#envCacheTime < this.#ENV_TTL)) {
            return this.#envCache;
        }

        const diskCache = await this.#loadEnvFromDisk(Hades);
        if (diskCache && diskCache.inference && typeof diskCache.inference.nativeCN === 'boolean') {
            const freshSysProxy = await this.getSystemProxy(Hades);
            if (diskCache.network) {
                diskCache.network.proxy = freshSysProxy;
            }
            if (!freshSysProxy && diskCache.network?.proxy) {
                Hades.D(`磁盘缓存已过期，实时检测无代理`);
                diskCache.network.proxy = null;
            }
            this.#envCache = diskCache;
            this.#envCacheTime = Date.now();
            return diskCache;
        }

        const [browserSnapshot, nativeSnapshot, hostProfile, sysProxy] = await Promise.all([
            this.getEnvSnapshot(Hades),
            this.getNativeIPStack(Hades),
            this.getHostProfile(Hades),
            this.getSystemProxy(Hades)
        ]);

        const v6Ip = browserSnapshot?.v6?.ip || nativeSnapshot?.v6Ip;
        const v4Ip = browserSnapshot?.v4?.ip || nativeSnapshot?.v4Ip;
        const browserCountry = browserSnapshot?.v4?.country;
        const { geoData = {} } = nativeSnapshot ?? {};
        const nativeCountry = geoData.country_code ?? geoData.countryCode ?? geoData.country;
        const effectiveCountry = browserCountry || nativeCountry;
        const regionCN = effectiveCountry === 'CN';
        const needsAirlock = !nativeCountry && !browserCountry;
        const result = {
            meta: {
                version: "2.0",
                updateTime: new Date().toISOString()
            },
            host: {
                ...hostProfile,
                lanIps: this.getLanIps()
            },
            network: {
                proxy: sysProxy,
                native: nativeSnapshot,
                browser: browserSnapshot
            },
            inference: {
                v4Ip: v4Ip || 'N/A',
                v6Ip: v6Ip || 'N/A',
                regionCN: regionCN || ['country_code', 'countryCode', 'country'].some(k => geoData[k] === 'CN'),
                nativeCN: nativeCountry === 'CN',
                browserCN: browserCountry === 'CN',
                needsAirlock
            }
        };

        this.#envCache = result;
        this.#envCacheTime = Date.now();
        await this.#saveEnvToDisk(result, Hades);

        return result;
    }

    static async ProbeSpeed(url, timeout = 5000) {
        const start = Date.now();
        const res = await this.request(url, {
            timeout,
            method: 'HEAD',
            skipSense: true,
            skipUAPool: true
        });
        const alive = res.success && (res.status === 200 || res.status === 405);
        return {
            success: true,
            data: alive ? (Date.now() - start) : Infinity
        };
    }

    static async SwarmSense(targets, timeout = 5000) {
        return Promise.all(targets.map(async (target) => {
            if (!target.url) return { ...target, speed: Infinity };
            const res = await this.ProbeSpeed(target.url, timeout);
            return {
                ...target,
                speed: res.success ? res.data : Infinity
            };
        }));
    }

    static getLanIps() {
        return Object.values(os.networkInterfaces())
            .flatMap(iface => iface.filter(f => !f.internal).map(f => f.address));
    }

    static async getPinyinScript(Hades = null) {
        const cacheKey = 'Script:Pinyin:3.28.1';
        const cached = await this.#getCache(cacheKey);
        if (cached) return cached;

        const urls = [
            'https://cdn.jsdelivr.net/npm/pinyin-pro@3.28.1/dist/index.mjs',
            'https://unpkg.com/pinyin-pro@3.28.1/dist/index.mjs'
        ];

        for (const url of urls) {
            const res = await this.request(url, { timeout: 10000 });
            if (res.success && res.status === 200 && res.body) {
                const ttl = 7 * 24 * 60 * 60;
                await this.#setCache(cacheKey, res.body, ttl);
                return res.body;
            }
        }

        return null;
    }
}

class HermesMatrix {
    static Sources = {
        IPv4: [
            { url: 'https://ipapi.co/json/', type: 'json', field: 'ip', geoField: 'country_code', cnVal: 'CN' },
            { url: 'https://api.ip.sb/geoip', type: 'json', field: 'ip', geoField: 'country_code', cnVal: 'CN' },
            { url: 'https://free.freeipapi.com/api/json', type: 'json', field: 'ipAddress', geoField: 'countryCode', cnVal: 'CN' },
            { url: 'https://api.bigdatacloud.net/data/client-info', type: 'json', field: 'ipString' },
            { url: 'http://ip-api.com/json/', type: 'json', field: 'query', geoField: 'countryCode', cnVal: 'CN' }
        ],
        IPv6: [
            { url: 'https://ipapi.co/json/', type: 'json', field: 'ip', geoField: 'country_code', cnVal: 'CN' },
            { url: 'https://api64.ipify.org?format=json', type: 'json', field: 'ip' },
            { url: 'https://v6.ident.me/.json', type: 'json', field: 'address' },
            { url: 'https://free.freeipapi.com/api/json', type: 'json', field: 'ipAddress', geoField: 'countryCode', cnVal: 'CN' },
            { url: 'https://api.bigdatacloud.net/data/client-info', type: 'json', field: 'ipString' }
        ]
    };

    static async race(sources, family, requestFn, Hades = null, timeout = 3000) {
        const promises = sources.map(src =>
            requestFn(src.url, { timeout, family })
                .then(res => {
                    if (!res.success || res.status !== 200) throw new Error('响应状态错误');
                    try {
                        const data = JSON.parse(res.body);
                        const ip = data[src.field];
                        if (!ip) throw new Error('未找到IP字段');
                        if (Hades) Hades.D(`API响应 [v${family}]: ${src.url}`);
                        return { ip, data, src };
                    } catch (e) { throw e; }
                })
        );

        try {
            return await Promise.any(promises);
        } catch (e) {
            return null;
        }
    }

    static Synthesize(v4Result, v6Result, Hades, tag = 'Hermes') {
        let v4Ip = 'N/A';
        let v6Ip = 'N/A';
        let geoData = {};
        let regionCN = true;
        let detected = false;

        if (v4Result) {
            if (net.isIPv4(v4Result.ip)) {
                v4Ip = v4Result.ip;
                geoData = v4Result.data;
                const src = v4Result.src;
                if (src.geoField && geoData[src.geoField]) {
                    detected = true;
                    if (geoData[src.geoField] !== src.cnVal) regionCN = false;
                }
            }
        }

        if (v6Result) {
            if (net.isIPv6(v6Result.ip)) {
                v6Ip = v6Result.ip;
            }
        }

        return { v4Ip, v6Ip, regionCN, geoData, detected };
    }
}

class Proteus {
    static _setup = {
        BeaconCN: "baidu.com",
        BeaconGlobal: "google.com",
        BeaconBiz: "github.com",
        BeaconGitcode: "gitcode.com",
        agentGates: [7890, 7891, 7892, 7893, 7894, 7895, 7896, 7897, 7898, 7899, 1080, 10808],
        thresholdV6: 800,
        thresholdV4: 400,
        bonusOfficial: 0.7
    };

    static getSenseBeacons() {
        return [
            { name: "GitHub", url: `https://${this._setup.BeaconBiz}`, priority: 2 },
            { name: "Google", url: `https://${this._setup.BeaconGlobal}`, priority: 2 },
            { name: "Gitcode", url: `https://${this._setup.BeaconGitcode}`, priority: 2 },
            { name: "Baidu", url: `https://${this._setup.BeaconCN}`, priority: 2 }
        ];
    }

    static State = {
        NATIVE: 0,
        USER_AGENT: 1,
        RULE_SPLIT: 2,
        IDLE_AGENT: 3,
        AIRLOCK: 4,
        V6_TURBO: 6
    };

    static async sense(envData, mirrorSpeed = Infinity, Hades = console) {
        const v6StatePromise = (envData && (envData.v4Ip || envData.v6Ip))
            ? Promise.resolve({ v4Ip: envData.v4Ip, v6Ip: envData.v6Ip, regionCN: envData.regionCN, geoData: envData, detected: true })
            : Hermes.getIPStack();

        const envSet = envData?.envSet ?? (() => {
            const sysProxy = envData?.network?.proxy;
            const sysProxyReady = !!(sysProxy && (sysProxy.host || (Array.isArray(sysProxy.entries) && sysProxy.entries.length > 0)));
            if (sysProxyReady) return true;
            const { HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, http_proxy, https_proxy, all_proxy } = process.env;
            return !!(HTTP_PROXY || HTTPS_PROXY || ALL_PROXY || http_proxy || https_proxy || all_proxy);
        })();

        const nativeIP = envData?.network?.native?.v4Ip || null;

        const [fingerprint, linkStateRaw, v6State, raceData] = await Promise.all([
            this._scanLocal(envSet, envData?.network?.proxy, nativeIP, Hades, envData),
            this._dialBeacons(),
            v6StatePromise,
            Hermes.dualStackRace(this._setup.BeaconBiz)
        ]);

        if (envData && raceData) {
            const fast = (raceData.v4 <= 200 || raceData.v6 <= 200);
            if (fast) envData.githubAccel = true;
        }

        const linkState = {
            ...linkStateRaw,
            biz: raceData ? (Number.isFinite(raceData.v4) || Number.isFinite(raceData.v6)) : false
        };

        const ctx = {
            ...linkState,
            race: raceData,
            mirror: mirrorSpeed,
            env: envData,
            fingerprint,
            needsAirlock: envData?.inference?.needsAirlock
        };

        const mode = ProteusMatrix.evaluate({ ...fingerprint, ...ctx, v6State });

        let gitEnv = null;
        const pCtx = fingerprint.proxyContext;

        if (pCtx && (mode === this.State.USER_AGENT || mode === this.State.IDLE_AGENT || mode === this.State.NATIVE)) {
            const scheme = pCtx.protocol === 'unknown' ? 'socks5' : pCtx.protocol;
            const proxyUrl = `${scheme}://${pCtx.host}:${pCtx.port}`;
            gitEnv = {
                HTTP_PROXY: proxyUrl,
                HTTPS_PROXY: proxyUrl,
                ALL_PROXY: proxyUrl
            };
        }

        const executionContext = {
            isAirlock: [this.State.AIRLOCK, this.State.RULE_SPLIT, this.State.V6_TURBO].includes(mode),
            inheritEnv: [this.State.NATIVE, this.State.USER_AGENT, this.State.IDLE_AGENT].includes(mode),
            gitEnv: gitEnv
        };

        let desc = this._describe(mode);
        if (linkState.udp) desc += " [UDP]";
        if (v6State.v6Ip && v6State.v6Ip !== 'N/A') desc += " [V6]";
        const displayPort = fingerprint.proxyContext ? fingerprint.proxyContext.port : null;
        if (displayPort) desc += ` [Proxy:${displayPort}]`;

        return {
            vector: {
                localAgent: fingerprint.active,
                procActive: fingerprint.procActive,
                portActive: fingerprint.portActive,
                proxyContext: fingerprint.proxyContext,
                proxyPort: displayPort,
                envSet: fingerprint.envSet,
                cnLink: linkState.cn,
                globalLink: linkState.global,
                bizLink: linkState.biz,
                gitcodeLink: linkState.gitcode,
                udpReach: linkState.udp,
                v6Link: v6State.v6Ip !== 'N/A',
                v6Ip: v6State.v6Ip,
                v4Ip: v6State.v4Ip,
                v4Lat: raceData.v4,
                v6Lat: raceData.v6,
                mirrorLat: mirrorSpeed,
                sysProxy: envData?.network?.proxy
            },
            mode: mode,
            desc: desc,
            executionContext: executionContext,
            nyxProxies: fingerprint.nyxProxies
        };
    }

    static async _scanLocal(envSet = false, sysProxy = null, nativeIP = null, Hades = console, envData = null) {
        let active = false;
        envSet = !!envSet;

        const scanProc = async () => {
            try {
                const procList = await this._getProcNames();
                return procList.some(n => Nyx.fuzzyMatch(n, 0.75).matched);
            } catch (err) { 
                return false; 
            }
        };

        const scanNyx = async () => {
            try {
                const result = await Nyx.scan(this._setup.agentGates, nativeIP, Hades, envData);
                return result;
            } catch (err) {
                return [];
            }
        };

        const [procActive, nyxProxies] = await Promise.all([
            scanProc(),
            scanNyx()
        ]);

        let proxyContext = null;

        if (sysProxy && (sysProxy.host || (sysProxy.entries && sysProxy.entries.length > 0))) {
            const entry = sysProxy.entries?.[0] || sysProxy;
            proxyContext = {
                protocol: entry.scheme || 'http',
                host: entry.host || '127.0.0.1',
                port: entry.port,
                source: 'system',
                verified: false
            };
        } else if (nyxProxies && nyxProxies.length > 0) {
            const trulyVerified = nyxProxies.find(p => p.tunVerified === true && p.protocol !== 'socks5_idle' && p.protocol !== 'socks5_direct');
            const handshakeOnly = nyxProxies.find(p => p.protocol === 'socks5_idle');
            const directMode = nyxProxies.find(p => p.protocol === 'socks5_direct');

            if (trulyVerified) {
                proxyContext = trulyVerified;
                if (Hades?.D) Hades.D(`锁定代理 ${proxyContext.protocol}://${proxyContext.host}:${proxyContext.port} [已验证]`);
            } else if (directMode) {
                proxyContext = null;
            } else if (handshakeOnly) {
                proxyContext = null;
            }

            if (proxyContext && proxyContext.protocol === 'unknown') {
                proxyContext.protocol = 'socks5';
            }
        }

        const portActive = !!proxyContext && proxyContext.tunVerified === true;
        if (procActive || portActive) active = true;

        return { active, envSet, procActive, portActive, proxyContext, nyxProxies };
    }

    static async _dialBeacons() {
        return Hermes.dialBeacons(this._setup);
    }

    static _describe(mode) {
        const map = {
            [this.State.NATIVE]: "直连模式 (NATIVE)",
            [this.State.USER_AGENT]: "用户代理 (USER_PROXY)",
            [this.State.RULE_SPLIT]: "分流规则 (RULE_SPLIT)",
            [this.State.IDLE_AGENT]: "幽灵代理 (IDLE_AGENT)",
            [this.State.AIRLOCK]: "气闸模式 (AIRLOCK)",
            [this.State.V6_TURBO]: "IPv6 极速 (V6_TURBO)"
        };
        return map[mode] || "UNKNOWN";
    }

    static _getProcNames() {
        return new Promise((resolve) => {
            const platform = os.platform();
            const cmd = platform === "win32" ? "tasklist" : "ps";
            const args = platform === "win32" ? ["/FO", "CSV", "/NH"] : ["-A", "-o", "comm="];
            const proc = spawn(cmd, args);
            let output = "";
            proc.stdout.on("data", data => { output += data.toString(); });
            proc.stderr.on("data", data => { output += data.toString(); });
            proc.on("error", () => resolve([]));
            proc.on("close", () => {
                if (!output) return resolve([]);
                if (platform === "win32") {
                    const list = output.split(/\r?\n/).map(line => {
                        const trimmed = line.trim();
                        if (!trimmed) return null;
                        const unquoted = trimmed.replace(/^"+|"+$/g, "");
                        const name = unquoted.split('","')[0] || "";
                        return name.toLowerCase();
                    }).filter(Boolean);
                    return resolve(list);
                }
                const list = output.split(/\r?\n/).map(v => v.trim().toLowerCase()).filter(Boolean);
                resolve(list);
            });
        });
    }
}

class ProteusMatrix {
    static _bus = new EventEmitter();
    static _matrixReady = false;
    static _evalPipeline = [];
    static _listenerTokens = [];

    static evaluate(context) {
        this._ensureInit();
        const decision = { mode: null, reason: null };
        this._bus.emit('before', context, decision);
        for (const step of this._evalPipeline) {
            this._bus.emit(`rule:${step}`, context, decision);
            if (decision.mode) break;
        }
        this._bus.emit('after', context, decision);
        return decision.mode ?? Proteus.State.AIRLOCK;
    }

    static on(event, listener) {
        this._ensureInit();
        this._bus.on(event, listener);
        const token = `Proteus:${event}:${Date.now()}:${Math.random().toString(36).slice(2,6)}`;
        this._listenerTokens.push(token);
        Hestia.register('EventListener', token, { listener }, () => {
            this._bus.off(event, listener);
        });
        return () => this._bus.off(event, listener);
    }

    static once(event, listener) {
        this._ensureInit();
        this._bus.once(event, listener);
        return () => this._bus.off(event, listener);
    }

    static off(event, listener) {
        this._ensureInit();
        this._bus.off(event, listener);
    }

    static reset() {
        this._bus.removeAllListeners();
        this._listenerTokens = [];
        this._matrixReady = false;
        this._evalPipeline = [];
    }

    static _ensureInit() {
        if (this._matrixReady) return;
        this._matrixReady = true;
        this._evalPipeline = [
            'envSet',
            'nativeCN',
            'overseasGlobal',
            'v6Turbo',
            'idleAgent',
            'overseasRegion',
            'biz',
            'ruleSplit',
            'needsAirlock',
            'fallback'
        ];
        this._bus.on('rule:envSet', (ctx, decision) => {
            if (!decision.mode && ctx.envSet) {
                decision.mode = Proteus.State.USER_AGENT;
                decision.reason = 'envSet';
            }
        });
        this._bus.on('rule:nativeCN', (ctx, decision) => {
            if (decision.mode) return;
            const nativeCN = ctx.env?.inference?.nativeCN;
            const browserCN = ctx.env?.inference?.browserCN;
            const hasValidProxy = ctx.proxyContext && ctx.proxyContext.tunVerified === true;

            if (nativeCN) {
                if (!browserCN && hasValidProxy) {
                    decision.mode = Proteus.State.USER_AGENT;
                    decision.reason = 'nativeCN_withProxy';
                } else if (nativeCN && browserCN && !hasValidProxy) {
                    decision.mode = Proteus.State.NATIVE;
                    decision.reason = 'nativeCN_noValidProxy';
                }
            }
        });
        this._bus.on('rule:overseasGlobal', (ctx, decision) => {
            if (!decision.mode && ctx.global && !ctx.cn) {
                decision.mode = Proteus.State.NATIVE;
                decision.reason = 'overseasGlobal';
            }
        });
        this._bus.on('rule:v6Turbo', (ctx, decision) => {
            if (decision.mode) return;
            const v4Lat = ctx.race ? ctx.race.v4 : Infinity;
            const v6Lat = ctx.race ? ctx.race.v6 : Infinity;
            const v4Ready = Number.isFinite(v4Lat);
            const v6Ready = Number.isFinite(v6Lat);
            const v6Threshold = Proteus._setup.thresholdV6;
            if (v6Ready && v6Lat < v6Threshold) {
                if (!v4Ready || (v4Ready && v6Lat * 0.7 < v4Lat)) {
                    decision.mode = Proteus.State.V6_TURBO;
                    decision.reason = 'v6Turbo';
                }
            }
        });
        this._bus.on('rule:idleAgent', (ctx, decision) => {
            if (decision.mode) return;
            const v4Lat = ctx.race ? ctx.race.v4 : Infinity;
            const v4Ready = Number.isFinite(v4Lat);

            const hasRealProxy = ctx.proxyContext && ctx.proxyContext.tunVerified === true;
            const hasIdleProxy = ctx.portActive && !hasRealProxy;
            const nativeCN = ctx.env?.inference?.nativeCN;

            if (hasIdleProxy) {
                return;
            }

            if (hasRealProxy && (!v4Ready || v4Lat > 200)) {
                if (nativeCN && ctx.env?.inference?.browserCN) {
                    return;
                }
                decision.mode = Proteus.State.IDLE_AGENT;
                decision.reason = 'idleAgent_verified';
            }
        });
        this._bus.on('rule:overseasRegion', (ctx, decision) => {
            if (decision.mode) return;
            const v4Lat = ctx.race ? ctx.race.v4 : Infinity;
            const v4Ready = Number.isFinite(v4Lat);
            const v4Threshold = Proteus._setup.thresholdV4;
            if (ctx.env && !ctx.env.inference.regionCN) {
                if (ctx.biz && v4Ready && v4Lat < v4Threshold) {
                    decision.mode = Proteus.State.NATIVE;
                    decision.reason = 'overseasRegionFast';
                    return;
                }
                decision.mode = Proteus.State.NATIVE;
                decision.reason = 'overseasRegion';
            }
        });
        this._bus.on('rule:needsAirlock', (ctx, decision) => {
            if (decision.mode) return;
            if (ctx.needsAirlock) {
                decision.mode = Proteus.State.AIRLOCK;
                decision.reason = 'needsAirlock';
            }
        });
        this._bus.on('rule:biz', (ctx, decision) => {
            if (decision.mode) return;
            const v4Lat = ctx.race ? ctx.race.v4 : Infinity;
            const v4Ready = Number.isFinite(v4Lat);
            const v4Threshold = Proteus._setup.thresholdV4;
            if (ctx.biz && v4Ready) {
                const mirrorLatency = ctx.mirror ?? Infinity;
                const mirrorBetter = Number.isFinite(mirrorLatency) && mirrorLatency < v4Lat;
                if (!mirrorBetter || v4Lat < v4Threshold) {
                    decision.mode = Proteus.State.NATIVE;
                    decision.reason = 'biz';
                }
            }
        });
        this._bus.on('rule:ruleSplit', (ctx, decision) => {
            if (!decision.mode && ctx.global && !ctx.biz) {
                decision.mode = Proteus.State.RULE_SPLIT;
                decision.reason = 'ruleSplit';
            }
        });
        this._bus.on('rule:fallback', (ctx, decision) => {
            if (!decision.mode) {
                decision.mode = Proteus.State.AIRLOCK;
                decision.reason = 'fallback';
            }
        });
    }
}

class MBTProcPool {
  static STATE = {
      ACTIVE: 0,
      KILLING: 1,
      DEAD: 2
  };

  constructor(Hades) {
    this.pool = new Map();
    this.logger = HadesEntry({}, Hades || console);
    this._activeGen = Moirai.currentGen;
    this._trap = null;

    this._shutdownTrapListener = async (newGen) => {
        await this.killAll('SIGTERM', `HMR Gen${this._activeGen}->Gen${newGen ?? 'shutdown'}`);
    };
  }

  _bindTrapListeners(trap) {
    if (this._trap && this._trap !== trap) {
      this._trap.off('shutdown', this._shutdownTrapListener);
      this._trap.off('reload', this._shutdownTrapListener);
    }
    if (!trap || trap._isShuttingDown) {
      this._trap = null;
      return;
    }
    trap.off('shutdown', this._shutdownTrapListener);
    trap.off('reload', this._shutdownTrapListener);
    trap.once('shutdown', this._shutdownTrapListener);
    trap.once('reload', this._shutdownTrapListener);
    this._trap = trap;
  }

  syncGen(newGen, trap = MBTSignalTrap.getInstance()) {
    const targetGen = newGen ?? Moirai.currentGen;
    if (this._activeGen !== targetGen && this.pool.size > 0) {
      this.killAll('SIGTERM', `GenSync ${this._activeGen}->${targetGen}`).catch(() => {});
    }
    this._activeGen = targetGen;
    this._bindTrapListeners(trap);
  }

  register(p) {
    if (p?.pid && !this.pool.has(p)) {
      this.pool.set(p, {
          state: MBTProcPool.STATE.ACTIVE,
          pid: p.pid,
          startTime: Date.now()
      });

      p.once('exit', () => {
          this.unregister(p);
      });
    }
  }

  unregister(p) {
    if (this.pool.has(p)) {
        const meta = this.pool.get(p);
        meta.state = MBTProcPool.STATE.DEAD;
        this.pool.delete(p);
    }
  }

  async killAll(sig = 'SIGTERM', reason = 'shutdown') {
    if (!this.pool.size) return;

    this.logger.warn(`进程池正在终止 ${this.pool.size} 个进程 (${reason})`);

    const ops = [];
    for (const [p, meta] of this.pool) {
      if (meta.state === MBTProcPool.STATE.ACTIVE) {
          ops.push(this.kill(p, sig));
      }
    }

    await Promise.allSettled(ops);
    this.pool.clear();
  }

  async kill(proc, signal = 'SIGTERM') {
      return MBTProcPool.kill(proc, signal, this.pool);
  }

  static async kill(proc, signal = 'SIGTERM', poolRef = null) {
    if (!proc) return false;
    let meta = null;
    if (poolRef && poolRef.has(proc)) {
        meta = poolRef.get(proc);
        if (meta.state >= MBTProcPool.STATE.KILLING) return false;
        meta.state = MBTProcPool.STATE.KILLING;
    } else if (proc.exitCode !== null || proc.signalCode !== null) {
        return false;
    }

    const pid = proc.pid;

    return new Promise(resolve => {
      let KillTimer = null;
      const safetyTimer = setTimeout(() => {
          if (meta) meta.state = MBTProcPool.STATE.DEAD;
          resolve(true);
      }, 5000);

      const cleanup = () => {
        clearTimeout(safetyTimer);
        if (KillTimer) {
            clearTimeout(KillTimer);
            KillTimer = null;
        }
        if (meta) meta.state = MBTProcPool.STATE.DEAD;
        resolve(true);
      };

      proc.once('exit', cleanup);
      proc.once('error', cleanup);

      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid, '/f', '/t'], { windowsHide: true, stdio: 'ignore' })
          .on('error', () => {})
          .on('exit', cleanup);
        return;
      }

      const ProcPid = proc.spawnargs?.includes('detached') || proc.detached ? -pid : pid;
      try {
        process.kill(ProcPid, signal);
      } catch (e) {
        if (e.code === 'ESRCH') {
            cleanup();
            return;
        }
        if (ProcPid < 0) {
            try { process.kill(pid, signal); } catch {}
        }
      }

      if (signal !== 'SIGKILL') {
        KillTimer = setTimeout(() => {
          if (proc.exitCode === null && proc.signalCode === null) {
            try {
              process.kill(ProcPid, 'SIGKILL');
            } catch (e) {
                if (ProcPid < 0) try { process.kill(pid, 'SIGKILL'); } catch {}
            }
          }
        }, 2000);
      }
    });
  }
}

class MBTQuoCRS {
    static Task_State = {
        Pending: 0,
        Running: 1,
        Melting: 2,
        Aborting: 3,
        Dead: 4
    };

    static CRS_State = {
        Init: 0,
        Racing: 1,
        Finalizing: 2,
        Closed: 3
    };

    constructor(logger, Rid, logTag, colorCode, parentSignal = null) {
        this.logger = HadesEntry({ module: "Quo" }, logger || getCore());
        this.Rid = Rid;
        this.logTag = logTag;
        this.uiRid = this.logger.colorize(`[${this.Rid}]`, colorCode);
        this.tasks = new Map();
        this.timer = null;
        this.pendingTimers = new Map();
        this.closed = false;
        this._state = MBTQuoCRS.CRS_State.Init;
        this.lastHB = Date.now();
        this._activeGen = Moirai.currentGen;
        ({ promise: this.promise, resolve: this.resolve, reject: this.reject } = Promise.withResolvers());
        this._shutdownTrapListener = () => this.stop();
        this._parentSignal = null;
        this._onParentAbort = null;
        const trap = MBTSignalTrap.getInstance();
        this._trap = trap;
        if (trap && !trap._isShuttingDown) {
            trap.once('shutdown', this._shutdownTrapListener);
            trap.once('reload', this._shutdownTrapListener);
        }

        if (!parentSignal) return;

        if (parentSignal.aborted) {
            this.stop();
            return;
        }

        this._parentSignal = parentSignal;
        this._onParentAbort = () => {
            this.logger.warn(`${this.uiRid} | [Quo] 收到上游中断信号 (Metis TTL/Abort)，正在终止所有任务...`);
            this.stop();
        };
        parentSignal.addEventListener('abort', this._onParentAbort, { once: true });
    }

    start() {
        if (this.closed) return this.promise;
        if (this._state !== MBTQuoCRS.CRS_State.Init) return this.promise;
        this._state = MBTQuoCRS.CRS_State.Racing;
        this.timer = setInterval(() => this._monitor(), 1500);
        return this.promise;
    }

    addTask(id, factory, BPP = false, delay = 0) {
        if (this.closed || this.tasks.has(id)) return;

        if (delay <= 0) {
            this._activate(id, factory, BPP);
            return;
        }

        this.logger.debug(`${this.uiRid} | [Quo]  任务 ${id} 将在 ${(delay/1000).toFixed(1)}s 后挂载...`);
        const timerId = setTimeout(() => {
            this.pendingTimers.delete(timerId);
            this._activate(id, factory, BPP);
        }, delay);
        this.pendingTimers.set(timerId, { id, factory, BPP });
    }

    _activate(id, factory, BPP) {
        if (this.closed || this.tasks.has(id)) return;
        const controller = new AbortController();
        const context = {
            controller,
            signal: controller.signal,
            telemetry: { instant_speed: 0, last_tick: 0, connection_state: 'CONNECTING' }
        };
        const now = Date.now();
        const onProgress = (p) => {
            const t = this.tasks.get(id);
            if (!t) return;
            if (typeof p === 'number' && Number.isFinite(p)) {
                const next = Math.max(0, Math.min(100, p));
                if (next > t.curr) t.curr = next;
                t.lastUpdate = Date.now();
                return;
            }
            if (!p || typeof p !== 'object') return;
            const progress = Number(p.progress);
            if (Number.isFinite(progress)) {
                const next = Math.max(0, Math.min(100, progress));
                if (next > t.curr) t.curr = next;
            }
            const tick = Number(p.lastUpdate);
            const resolvedTick = Number.isFinite(tick) && tick > 0 ? tick : Date.now();
            const hasPulse = p.bytePulse === true || p.progressPulse === true;
            t.lastUpdate = resolvedTick;
            if (hasPulse) t.active = resolvedTick;
            const bytesTotal = Number(p.bytesTotal);
            if (Number.isFinite(bytesTotal)) t.bytesTotal = bytesTotal;
            const idleMs = Number(p.idleMs);
            if (Number.isFinite(idleMs)) t.byteIdleMs = idleMs;
        };

        const { promise, meta } = factory(context, onProgress);
        const name = meta?.nodeName || id;

        const task = {
            id, name, BPP, context,
            start: now,
            curr: 0, prev: 0, speed: 0, active: now,
            lastUpdate: now, bytesTotal: 0, byteIdleMs: 0,
            state: MBTQuoCRS.Task_State.Running
        };

        this.tasks.set(id, task);
        const roleText = BPP ? ' (备用)' : '';
        this.logger.debug(`${this.uiRid} | [Quo] 任务挂载: [${name}]${roleText}`);
        promise.then(
            res => this._done(id, res),
            err => this._fail(id, err)
        );
    }

    _tick(task, now) {
        task.speed = task.curr - task.prev;
        task.prev = task.curr;
        task.active = task.speed > 0 ? Math.max(now, task.lastUpdate) : task.lastUpdate;
    }

    _monitor() {
        if (this.tasks.size === 0) return;
        const now = Date.now();
        let leader = null, activeCount = 0;
        const snapshot = Array.from(this.tasks.values());

        for (const task of snapshot) {
            if (now - task.start > 30 * 60 * 1000) {
                 this.logger.warn(`${this.uiRid} | [Quo] 任务 [${task.name}] 超过最大运行时限正在强制处决`);
                 this._kill(task, '全局运行时限已超');
                 continue;
            }

            this._tick(task, now);
            if (now - task.active < 60000) activeCount++;

            if (!leader || task.curr > leader.curr) leader = task;
        }

        this._leaderStatus = { count: this.tasks.size + this.pendingTimers.size, maxProgress: leader?.curr ?? 0, activeCount };

        if (leader && (now - this.lastHB > 240000)) {
            const durMins = ((now - leader.start) / 60000).toFixed(1);
            this.logger.info(`[💓] ${this.uiRid} 节点:${leader.name} ... (已耗时 ${durMins}分钟, 当前进度: ${leader.curr}%) - 请耐心等待`);
            this.lastHB = now;
        }

        if (this.tasks.size === 1 && (now - leader.active < 60000)) return;

        for (const task of snapshot) {
            this._judge(task, leader, now);
        }
    }

    _judge(task, leader, now) {
        if (task.state !== MBTQuoCRS.Task_State.Running) return;

        const t = task.context?.telemetry ?? { instant_speed: 0, last_tick: 0, connection_state: 'CONNECTING' };
        const fresh = (now - t.last_tick) < 6000;
        const pulse = fresh && t.instant_speed > 1024;
        const runtime = now - task.start;

        if (runtime < 45000) {
            if (task.curr > 0 || runtime <= 15000) return;
            if (!fresh && runtime < 60000) return;

            if (pulse) {
                this._tick(task, now);
                return;
            }

            let reason = `起步失败(15s无进度, 状态:${t.connection_state || 'UNKNOWN'})`;
            if (runtime > 25000 && t.total_bytes < 102400 && (task.name.includes("GitHub") || task.name.includes("Direct"))) {
                this.logger.debug(`${this.uiRid} | [Quo] 检测TCP流量握手成功但无有效载荷: [${task.name}]`);
                reason = "流量欺诈 (虚假连接)";
            }
            this._kill(task, reason);
            return;
        }

        if (leader?.BPP && !task.BPP && (now - task.active < 30000)) return;

        if (leader && task.id !== leader.id && leader.curr > task.curr + 30) {
            const lt = leader.context?.telemetry;
            const lFresh = lt && (now - (lt.last_tick || 0)) < 6000;
            const lSpeed = lFresh ? (lt.instant_speed || 0) : 0;

            if (lSpeed >= 512 * 1024 && pulse) {
                const ratio = Math.max(0, Math.min(1, (lSpeed - 512 * 1024) / (1024 * 1024)));
                if ((leader.curr - task.curr) <= 30 + (20 * ratio)) return;
            }

            this.logger.debug(`${this.uiRid} | [Quo] 裁决: [${task.name}](${task.curr}%) 落后于 [${leader.name}](${leader.curr}%)`);
            this._kill(task, "严重落后");
            return;
        }

        if (leader?.speed > 2 && task.speed < 0.2) {
            if (pulse) {
                this._tick(task, now);
                return;
            }
            this.logger.debug(`${this.uiRid} | [Quo] 节点: [${task.name}] 疑似假死，回收任务中... | 状态:${t.connection_state || 'UNKNOWN'}`);
            this._kill(task, "速度过慢且无物理流量");
        }
    }

    _kill(task, reason) {
        if (task.state >= MBTQuoCRS.Task_State.Melting) return;
        task.state = MBTQuoCRS.Task_State.Aborting;
        task.context?.signal?.aborted || task.context?.controller.abort(reason);
    }

    _done(id, result) {
        const task = this.tasks.get(id);
        if (!task) return;
        this.logger.info(`${this.uiRid} | [Quo] [${task.name}] 完成下载`);
        this._finalize(result, null);
    }

    _fail(id, err) {
        const task = this.tasks.get(id);
        if (!task) return;

        const isAborted = err.code === 'SCHEDULER_ABORT' || err.name === 'AbortError' || task.context?.signal?.aborted;

        if (!isAborted) {
            if (err.isMelting) {
                task.state = MBTQuoCRS.Task_State.Melting;
                this.logger.debug(`${this.uiRid} | [Quo] [${task.name}] ${err.message}`);
            } else {
                const msg = err.message?.split('\n')[0] || '未知错误';
                this.logger.debug(`${this.uiRid} | [Quo] [${task.name}] ${msg}`);
            }
        } else {
            if (task.state < MBTQuoCRS.Task_State.Aborting) {
                task.state = MBTQuoCRS.Task_State.Aborting;
            }
            this.logger.debug(`${this.uiRid} | [Quo] 🛑 任务中止: [${task.name}]`);
        }

        this.tasks.delete(id);
        this._accPend();

        if (this.tasks.size === 0 && this.pendingTimers.size === 0 && !this.closed) {
            this._finalize(null, err || new Error("所有任务失败"));
        }
    }

    _finalize(result, error) {
        if (this._state >= MBTQuoCRS.CRS_State.Finalizing) return;
        this._state = MBTQuoCRS.CRS_State.Finalizing;

        if (this._trap) {
            this._trap.off('shutdown', this._shutdownTrapListener);
            this._trap.off('reload', this._shutdownTrapListener);
            this._trap = null;
        }
        if (this._parentSignal && this._onParentAbort) {
            this._parentSignal.removeEventListener('abort', this._onParentAbort);
            this._parentSignal = null;
            this._onParentAbort = null;
        }
        this.closed = true;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }

        for (const [id] of this.pendingTimers) clearTimeout(id);
        this.pendingTimers.clear();

        for (const task of this.tasks.values()) {
            this._kill(task, "Race finished");
            task.state = MBTQuoCRS.Task_State.Dead;
        }
        this.tasks.clear();

        this._state = MBTQuoCRS.CRS_State.Closed;
        error ? this.reject(error) : this.resolve(result);
    }

    _signalCleanup() {
        for (const task of this.tasks.values()) {
            this._kill(task, '清理');
            task.state = MBTQuoCRS.Task_State.Dead;
        }
        for (const [timerId] of this.pendingTimers) clearTimeout(timerId);
        this.pendingTimers.clear();
    }

    _accPend() {
        if (this.pendingTimers.size === 0) return;

        const [oldTimerId, data] = this.pendingTimers.entries().next().value;
        this.pendingTimers.delete(oldTimerId);
        clearTimeout(oldTimerId);

        if (this.closed) return;

        const delay = MBTMath.Range(100, 300);
        const rescheduleId = setTimeout(() => {
            this.pendingTimers.delete(rescheduleId);
            this.closed || this._activate(data.id, data.factory, data.BPP);
        }, delay);

        this.pendingTimers.set(rescheduleId, data);
    }

    getStatus() {
        if (this._leaderStatus) return this._leaderStatus;
        const now = Date.now();
        let maxProgress = 0, activeCount = 0;
        for (const task of this.tasks.values()) {
            maxProgress = Math.max(maxProgress, task.curr);
            if (now - task.active < 60000) activeCount++;
        }
        return { count: this.tasks.size + this.pendingTimers.size, maxProgress, activeCount };
    }

    stop() {
        this.closed || this._finalize(null, new Error("已被信号捕获器停止"));
    }
}

class MBTSignalTrap extends EventEmitter {
    constructor(activeGen) {
        super();
        this.setMaxListeners(100);
        this._activeGen = activeGen ?? Moirai.currentGen;
        this.logger = Hades;
        this._isShuttingDown = false;
        this._onShutdownSignal = this._onShutdownSignal.bind(this);
        this._bound = false;
        this._ownerToken = `Trap:${this._activeGen}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        this._bindSysEvents();
        this._ownedListeners = new Map();
    }

    get activeGen() { return this._activeGen; }

    static getInstance(logger) {
        const currentGen = Moirai.currentGen;
        const wrapper = global[Trap_Symbol];

        if (wrapper?.__MBT_Gen && wrapper.__MBT_Gen < currentGen) {
            if (wrapper.value && !wrapper.value._isShuttingDown) {
                wrapper.value._forceCleanup();
            }
        }

        if (!wrapper || wrapper.__MBT_Gen < currentGen) {
            const instance = new MBTSignalTrap(currentGen);
            Moirai.stamp(Trap_Symbol, instance);
            return instance;
        }

        const instance = wrapper.value;
        if (logger) instance.logger = logger;
        return instance;
    }

    static async HMR_Entry(logger) {
        const Hades = getHades(logger);
        const oldWrapper = global[Trap_Symbol];
        const newGen = Moirai.bump('HMR_Entry');

        if (oldWrapper?.value) {
            const oldInstance = oldWrapper.value;
            oldInstance._isShuttingDown = true;
            await oldInstance._emitAdvance(newGen);
            oldInstance.dispose();
            oldInstance.removeAllListeners();
        }

        const instance = new MBTSignalTrap(newGen);
        Moirai.stamp(Trap_Symbol, instance);
        return instance;
    }

    async _emitAdvance(newGen) {
        const listeners = this.listeners('reload');
        await Promise.allSettled(
            listeners.map(fn => {
                try { return Promise.resolve(fn(newGen)); } catch (e) { return Promise.resolve(); }
            })
        );
    }

    _forceCleanup() {
        this._isShuttingDown = true;
        this.removeAllListeners();
        this.dispose();
    }

    _onShutdownSignal(signal) {
        if (this._isShuttingDown) return;
        this._isShuttingDown = true;
        this.emit('shutdown', signal);
    }

    _bindSysEvents() {
        if (this._bound) return;
        const shared = global[Dominus_Symbol];
        if (shared?.sigint) process.removeListener('SIGINT', shared.sigint);
        if (shared?.sigterm) process.removeListener('SIGTERM', shared.sigterm);
        process.removeListener('SIGINT', this._onShutdownSignal);
        process.removeListener('SIGTERM', this._onShutdownSignal);
        process.on('SIGINT', this._onShutdownSignal);
        process.on('SIGTERM', this._onShutdownSignal);
        global[Dominus_Symbol] = {
            owner: this._ownerToken,
            activeGen: this._activeGen,
            sigint: this._onShutdownSignal,
            sigterm: this._onShutdownSignal
        };
        this._bound = true;
    }

    on(event, listener) {
        if (this._isShuttingDown) return this;
        return super.on(event, listener);
    }

    dispose() {
        if (!this._bound) return;
        process.removeListener('SIGINT', this._onShutdownSignal);
        process.removeListener('SIGTERM', this._onShutdownSignal);
        const shared = global[Dominus_Symbol];
        if (shared?.owner === this._ownerToken) {
            delete global[Dominus_Symbol];
        }
        this._bound = false;
        this._isShuttingDown = true;
    }
}

class PoseidonSpear {
    static STRATEGIES = new Map([
        [/Suspended due to abuse|abuse report/i, { time: 24 * 60 * 60 * 1000, type: "服务封禁" }],
        [/Invalid input|502 Bad Gateway|index-pack/i, { time: 60 * 60 * 1000, type: "协议/服务端故障" }],
        [/403|429|redirection|too many requests/i, { time: 15 * 60 * 1000, type: "限流/拒绝" }],
        [/ESLOWNET|E_GIT_IO_STALL|E_GIT_BYTE_IDLE_TIMEOUT|E_GIT_ZOMBIE_IDLE|E_GIT_SPEED_FLOOR|龟速|假死|LowSpeed|stall threshold/i, { time: 10 * 60 * 1000, type: "性能降级" }],
        [/timed out|Connection refused|resolve host|Could not resolve/i, { time: 5 * 60 * 1000, type: "网络波动" }],
        [/early EOF|index-pack failed|unpack-objects|write error|No space left|磁盘已满|out of memory|memory exhausted/i, { time: 3 * 60 * 1000, type: "本地资源不足" }],
        [/repository not found|Authentication failed|403 Forbidden|401 Unauthorized/i, { time: 30 * 60 * 1000, type: "仓库/认证异常" }]
    ]);

    static H2_ERRORS = [
        /HTTP\/2 stream \d+ was not closed cleanly/i,
        /curl 92 HTTP\/2/i,
        /unexpected disconnect while reading sideband packet/i,
        /RPC failed; curl 56 Failure when receiving data from the peer/i,
        /Protocol "HTTP\/2" not supported or disabled/i
    ];

    static LOG_WHITELIST = "fatal:|error:|remote:|warning:|Could not resolve|timed out|Connection refused|SSL|certificate|HTTP/2|stream|ESLOWNET|E_GIT_IO_STALL|E_GIT_BYTE_IDLE_TIMEOUT|E_GIT_ZOMBIE_IDLE|E_GIT_SPEED_FLOOR|龟速|假死|early EOF|index-pack|unpack-objects|write error|No space left|out of memory|memory exhausted|repository not found|Authentication failed|unexpected disconnect|RPC failed|curl".split("|");

    static get _state() {
        const Pose_Symbol = Symbol.for('Yz.CowCoo.MBT.PoseidonSpear.State.v2');
        const wrapper = global[Pose_Symbol];
        if (!wrapper) {
            const state = new Map();
            Moirai.stamp(Pose_Symbol, state);
            return state;
        }
        return wrapper.value ?? wrapper;
    }

    static isLive(nodeName) {
        if (nodeName === "GitHub") return true;
        const record = this._state.get(nodeName);
        if (!record) return true;
        if (Date.now() < record.deadUntil) return false;
        this._state.delete(nodeName);
        return true;
    }

    static revive(logger) {
        const Hades = logger ? getHades(logger) : null;
        let count = 0;
        for (const [name, record] of this._state) {
            if (["网络波动", "限流/拒绝", "性能降级"].includes(record.reason)) {
                this._state.delete(name);
                count++;
            }
        }

    }

    static probeProtocol(errorMsg) {
        if (!errorMsg) return null;
        for (const regex of this.H2_ERRORS) {
            if (regex.test(errorMsg)) return 'DOWNGRADE_H1';
        }
        return null;
    }

    static diagnose128(rawLog) {
        if (!rawLog) return null;
        const patterns = [
            { regex: /early EOF/i, label: "early EOF (服务端提前断开/数据不完整)" },
            { regex: /index-pack failed/i, label: "index-pack failed (索引包损坏或内存不足)" },
            { regex: /unpack-objects failed/i, label: "unpack-objects failed (解包失败)" },
            { regex: /write error|No space left|磁盘已满/i, label: "磁盘空间不足" },
            { regex: /out of memory|memory exhausted/i, label: "内存不足" },
            { regex: /Authentication failed|401 Unauthorized/i, label: "认证失败 (Token/权限不足)" },
            { regex: /403 Forbidden/i, label: "403 拒绝访问" },
            { regex: /RPC failed; curl \d+/i, label: "RPC/cURL 传输层错误" },
            { regex: /unexpected disconnect while reading sideband packet/i, label: "HTTP/2 侧带包断开 (尝试降级HTTP/1.1)" },
            { regex: /SSL certificate problem/i, label: "SSL证书验证失败" },
            { regex: /Could not resolve host/i, label: "DNS解析失败" },
            { regex: /Connection refused/i, label: "连接被拒绝" },
            { regex: /timed out/i, label: "连接/读取超时" }
        ];
        for (const p of patterns) {
            if (p.regex.test(rawLog)) return p.label;
        }
        return null;
    }

    static sanitize(rawLog) {
        if (!rawLog) return "";
        const lines = rawLog.split('\n');
        const cleanLines = lines.filter(line => {
            if (/@/.test(line) && /:\/\//.test(line)) return false;
            return this.LOG_WHITELIST.some(keyword => line.includes(keyword));
        });

        if (cleanLines.length === 0) return "未知Git错误 (日志已清理)";
        return cleanLines.join('\n').trim();
    }

    static strike(nodeName, errorMsg) {
        const now = Date.now();
        for (const [regex, strategy] of this.STRATEGIES) {
            if (regex.test(errorMsg)) {
                this._state.set(nodeName, {
                    deadUntil: now + strategy.time,
                    reason: strategy.type,
                    rawError: errorMsg
                });
                return { punished: true, type: strategy.type, coolingTime: strategy.time };
            }
        }
        return { punished: false };
    }

    static reset() { this._state.clear(); }
}

class Cerberus {
    #timer = null;
    #sessions = new Map();

    constructor() {
        this.tier = 3;
        this.freeMemMB = 0;
        this.#timer = setInterval(() => this._monitor(), 2000);
        this.#timer.unref();
        this._monitor();
    }

    static getInstance() {
        const currentGen = Moirai.currentGen;
        const wrapper = global[Cer_Symbol];

        if (wrapper?.__MBT_Gen && wrapper.__MBT_Gen < currentGen) {
            if (wrapper.value) {
                wrapper.value.stop();
            }
        }

        if (!wrapper || wrapper.__MBT_Gen < currentGen) {
            const instance = new Cerberus();
            Moirai.stamp(Cer_Symbol, instance);
            return instance;
        }

        return wrapper.value;
    }

    stop() {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
        this.#sessions.clear();
    }

    static reset() {
        const wrapper = global[Cer_Symbol];
        if (wrapper?.value) {
            wrapper.value.stop();
        }
        global[Cer_Symbol] = null;
    }

    _monitor() {
        this.freeMemMB = os.freemem() / 1024 / 1024;
        this.tier = this.freeMemMB < 400 ? 1 : this.freeMemMB < 800 ? 2 : 3;
        const now = Date.now();
        for (const [sid, sess] of this.#sessions.entries()) {
            if (sess.state === 'done' || sess.state === 'failed') {
                if (now - (sess.endAt || now) > 10 * 60 * 1000) this.#sessions.delete(sid);
            }
        }
    }

    beginSession(meta = {}) {
        const sid = `DL-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
        this.#sessions.set(sid, {
            id: sid,
            state: 'running',
            startAt: Date.now(),
            lastPulseAt: Date.now(),
            lastByteAt: Date.now(),
            bytes: 0,
            progress: 0,
            repo: meta.repo ?? null,
            repoName: meta.repoName ?? '',
            source: meta.source ?? 'Provision'
        });
        return sid;
    }

    pulse(sessionId, patch = {}) {
        const sess = this.#sessions.get(sessionId);
        if (!sess || sess.state !== 'running') return;
        const now = Date.now();
        sess.lastPulseAt = now;
        if (typeof patch.progress === 'number' && Number.isFinite(patch.progress)) {
            sess.progress = Math.max(sess.progress, patch.progress);
        }
        if (typeof patch.bytes === 'number' && Number.isFinite(patch.bytes) && patch.bytes >= 0) {
            if (patch.bytes > sess.bytes) sess.lastByteAt = now;
            sess.bytes = Math.max(sess.bytes, patch.bytes);
        }
        if (patch.state) sess.state = patch.state;
        if (patch.event) sess.event = patch.event;
        if (patch.message) sess.message = patch.message;
    }

    guard(sessionId, options = {}) {
        const sess = this.#sessions.get(sessionId);
        if (!sess || sess.state !== 'running') return null;
        const now = Date.now();
        const pulseIdle = now - (sess.lastPulseAt || sess.startAt);
        const byteIdle = now - (sess.lastByteAt || sess.startAt);
        const maxPulseIdle = Number(options.maxPulseIdle || 120000);
        const maxByteIdle = Number(options.maxByteIdle || 90000);
        if (pulseIdle > maxPulseIdle) {
            const err = new Error(`Cerberus会话心跳超时 ${Math.floor(pulseIdle / 1000)}s`);
            err.code = 'E_CERBERUS_PULSE_TIMEOUT';
            return err;
        }
        if (byteIdle > maxByteIdle) {
            const err = new Error(`Cerberus会话字节空闲 ${Math.floor(byteIdle / 1000)}s`);
            err.code = 'E_CERBERUS_BYTE_IDLE';
            return err;
        }
        return null;
    }

    finishSession(sessionId, ok = true, patch = {}) {
        const sess = this.#sessions.get(sessionId);
        if (!sess) return;
        sess.state = ok ? 'done' : 'failed';
        sess.endAt = Date.now();
        if (patch.message) sess.message = patch.message;
        if (patch.code) sess.code = patch.code;
        if (patch.event) sess.event = patch.event;
    }

    async breath(index) {
        if (this.tier === 3) return;
        if (this.tier === 1 && index % 10 === 0) await common.sleep(200);
        else if (this.tier === 2 && index % 50 === 0) await common.sleep(50);
    }

    getGitConcurrency() {
        return this.tier === 1 ? 1 : this.tier === 2 ? 2 : 5;
    }

    async throttle(timeoutMs = 10000) {
        if (this.tier > 1) return;

        const start = Date.now();
        while (this.tier === 1) {
            if (Date.now() - start > timeoutMs) break;
            await common.sleep(500);
        }
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YzPath = path.resolve(__dirname, "..", "..");
const Version = `5.2.4-${crypto.createHash('md5').update(fs.readFileSync(__filename)).digest('hex').substring(0, 6).toUpperCase()}`;
const PFL = {
  NONE: 0, RX18_ONLY: 1, PX18_PLUS: 2,
   getDescription: (level) => ["不过滤", "过滤R18", "全部敏感项"][level] ?? "未知",
};

const Valid_Tags = Object.fromEntries([
  ["彩蛋", "other", "Egg"],
  ["ai", "other", "LLMCanvas"],
  ["横屏", "layout", "fullscreen"],
  ["r18", "rated", "r18"],
  ["p18", "rated", "p18"],
].map(([name, key, value]) => [name, { key, value }]));

const DFC = {
  Main_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT/",    // 一号库 (热门五星)
  Ass_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-2/",   // 二号库 (原神)
  Ass2_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-3/",  // 三号库 (星铁)
  Ass3_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-4/",  // 四号库 (综合库)
  Ass4_Github_URL: "https://github.com/Siluluna/Genshin-CR-Repos/",
  Ass5_Github_URL: "https://github.com/Siluluna/StarRail-CR-Repos/",
  RepoBranch: "main",
  F2Pool: [],
  ProxyRepoFile: "README.md",
  ProxyRepoTimeout: 5000,
  GitTimeout: 900000,
  PullTimeout: 300000,
  PullTimeoutCore: 600000,
  PullTimeoutAss: 300000,
  Depth: 1,
  CronUpdate: "0 */12 * * *",
  Repo_Ops: true,  PFL_Ops: PFL.NONE, RenderScale: 300,
  Ai: true, EasterEgg: true, layout: true, SR18_Ops: false,
  logPrefix: Charon,
  logDateFormat: "format:%m-%d %H:%M",
  DockerMode: false,
  FileUrl_Threshold: 2097152,
};

const [Repo1, Repo2, Repo3, Repo4, Repo5, Repo6] = ["一号仓库", "二号仓库", "三号仓库", "四号仓库", "五号仓库", "六号仓库"];
const RepoDisplayMap = {
  1: `${Repo1} (核心)`, 2: `${Repo2} (原神)`, 3: `${Repo3} (星铁)`,
  4: `${Repo4} (综合库)`, 5: `${Repo5} (SR18-GS)`, 6: `${Repo6} (SR18-SR)`
};
const RepoNameToId = { [Repo1]: '1', [Repo2]: '2', [Repo3]: '3', [Repo4]: '4' };

const NOMOS_UNIVERSE_ROWS = [
  ['gs', '原神', 'gs-character', 'miao-plugin', ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'], { pyro: '火', hydro: '水', cryo: '冰', electro: '雷', anemo: '风', geo: '岩', dendro: '草' }],
  ['sr', '星铁', 'sr-character', 'miao-plugin', ['fire', 'ice', 'wind', 'elec', 'phy', 'quantum', 'imaginary'], { fire: '火', ice: '冰', wind: '风', elec: '雷', phy: '物理', quantum: '量子', imaginary: '虚数' }],
  ['zzz', '绝区零', 'zzz-character', 'ZZZ-Plugin', [], {}],
  ['waves', '鸣潮', 'waves-character', 'waves-plugin', ['rerong', 'lengning', 'daodian', 'qidong', 'yanshe', 'yanmie'], { '冷凝': 'lengning', '热熔': 'rerong', '导电': 'daodian', '气动': 'qidong', '衍射': 'yanshe', '湮灭': 'yanmie' }]
];
const CRE_TARGET_KEYS = ['MiaoCRE', 'ZZZCRE', 'WavesCRE'];
const TEMP_HTML_CRON_KEYWORDS = ['guguniu', 'render-'];
const TEMP_HTML_KEYWORDS = ['guguniu', 'render-', 'cowcoo', 'guguniu-gallery', 'gutools', 'cooweb'];
const LOCK_SPECS = [['MetaMutex', 60000], ['GitMutex', 1800000], ['InstallMutex', 600000], ['RenderMutex', 300000], ['CleanMutex', 300000]];
const GIT_NETWORK_ERR_KEYWORDS = `connection timed out
connection was reset
could not resolve host
unable to access
handshake failed
error: 502
error: 522
error: 504
etimedout
gnutls_handshake
rpc failed
unable to update url base from redirection
recv failure
error: 429
credential url cannot be parsed
url cannot be parsed
command timed out
command timeout
命令执行超时`.split("\n");
const GIT_TIMEOUT_ERR_CODES = new Set("ETIMEDOUT ESLOWNET E_GIT_IO_STALL E_GIT_BYTE_IDLE_TIMEOUT E_GIT_ZOMBIE_IDLE E_GIT_SPEED_FLOOR".split(" "));
const getCreTargets = () => CRE_TARGET_KEYS.map(k => MiaoPluginMBT.Paths.Target[k]).filter(Boolean);
const isTempHtmlTarget = (name = '', keywords = TEMP_HTML_KEYWORDS) => keywords.some(k => name.toLowerCase().includes(k));
const getLockStatus = () => LOCK_SPECS.map(([name, maxAge]) => ({ lock: MiaoPluginMBT[name], name, maxAge }));
const getTempHtmlTargets = async (keywords = TEMP_HTML_KEYWORDS) => {
  const VisPath = MiaoPluginMBT.Paths.TempHtmlPath;
  const entries = await Ananke.readDir(VisPath);
  return entries.filter(e => e.isDirectory() && isTempHtmlTarget(e.name, keywords)).map(e => path.join(VisPath, e.name));
};

const COMMIT_PREFIX_MAP = {
  '修复': 'fix', '新增': 'feat', '文档': 'docs', '样式': 'style',
  '重构': 'refactor', '性能': 'perf', '测试': 'test', '构建': 'build',
  '部署': 'deploy', '回滚': 'revert', '杂项': 'chore', '持续集成': 'ci'
};
const COMMIT_GAME_PREFIXES = [['原神', 'gs'], ['星铁', 'sr'], ['绝区零', 'zzz'], ['鸣潮', 'waves']]
  .map(([name, key]) => ({ pattern: new RegExp(`^(${name}UP[:：])\\s*`, 'i'), key }));
const HELP_FALLBACK_LINES = [
  '『咕咕牛帮助手册』',
  '--------------------',
  '【图库安装】',
  '  #下载咕咕牛: 自动测速下载',
  '  #更新咕咕牛: 手动更新',
  '',
  '【图库操作】',
  '  #启/禁用咕咕牛: 管理同步',
  '  #咕咕牛状态: 查看状态',
  '  #咕咕牛查看[角色名]: 查看图片',
  '  #咕咕牛导出[角色名+编号]: 导出图片',
  '  #可视化[角色名]: 显示面板图',
  '  #重置咕咕牛: 清理图库文件',
  '',
  '【封禁与设置】',
  '  #咕咕牛封/解禁[角色名+编号]: 管理图片',
  '  #咕咕牛封禁列表: 显示封禁图片',
  '  #咕咕牛设置净化等级[0-2]: 过滤敏感图',
  '  #咕咕牛面板: 查看设置',
  '  #咕咕牛设置[xx][开启/关闭]: Ai/彩蛋/横屏',
  '--------------------'
];

function MBTPipeControl(command, args, options = {}, timeout = 0, onStdErr, onStdOut, onProgress, onSlowSpeed, MBTProcc) {
  const Rid = options.Rid ?? 'SYSTEM';
  const RidTag = options.RidTag ?? `[${Rid}]`;

  const traceId = options.traceId ??
    `${Rid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const telemetry = {
    startTime: Date.now(),
    endTime: null,
    rx_bytes: 0,
    last_tick_bytes: 0,
    io_chunks: 0,
    protocol: 'HTTP/1.1',
    throughput: 0,
    instant_speed: 0,
    instability: 0,
    git_objects: 0,
    connection_state: 'CONNECTING',
    traceId,
    kill_reason: null
  };

  const constraints = {
    stallThreshold: 60 * 1000,
    zombieThreshold: 5 * 60 * 1000,
    byteidleThreshold: 90 * 1000,
    minBytePulseBytes: 4 * 1024,
    low_Speed_Limit: 1024,
    low_Speed_Strikes: 4,
    low_Speed_Check_Interval: 30 * 1000,
    hardTimeout: 20 * 60 * 1000,
    ...options.constraints
  };

  if (command === 'git' && Array.isArray(options.gitConfigs)) {
    args = [...options.gitConfigs.flatMap(cfg => ['-c', cfg]), ...args];
  }

  const isSilentOp = args.some(a => ['rev-parse', 'log', 'ls-remote', 'status', 'diff'].includes(a));
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
  const explicitProxyKeys = new Set();
  proxyVars.forEach(v => options.env?.[v] && explicitProxyKeys.add(v));
  let runEnv = { ...process.env, ...(options.env || {}) };
  proxyVars.forEach(v => {
    if (!explicitProxyKeys.has(v)) delete runEnv[v];
  });

  if (options.preferV6 && process.platform === 'linux') {
    runEnv.RES_OPTIONS = 'inet6 attempts:2';
    !isSilentOp && Hades.D(`${RidTag} IPv6`);
  }

  runEnv.LC_ALL = 'C';

  if (options.airlock) {
    proxyVars.forEach(v => delete runEnv[v]);
    const isolationArgs = ['-c', 'http.proxy=', '-c', 'https.proxy=', '-c', 'core.gitProxy=', '-c', 'credential.helper='];
    args = [...isolationArgs, ...args];
  } else if (!options.inheritEnv) {
    proxyVars.forEach(v => delete runEnv[v]);
  } else {
    const inherited = proxyVars.filter(v => runEnv[v]);
    if (inherited.length > 0 && !isSilentOp) {
      Hades.D(`${RidTag} 警告：进程流将使用任务环境配置！(参数: ${inherited.join(', ')})`);
    }
  }

  if (command === 'git') {
    runEnv = {
      ...runEnv,
      GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0', GIT_CURL_VERBOSE: '1', GIT_TRACE: '0', GIT_DELAY: '0'
    };
  }

  const isClone = command === "git" && args.includes("clone");
  const isGitTransfer = command === "git" && args.some(arg => ["clone", "pull", "fetch"].includes(String(arg).toLowerCase()));
  if (isClone && !args.some(arg => arg === '--verbose' || arg === '-v')) {
    const cloneIndex = args.indexOf("clone");
    if (cloneIndex !== -1) args.splice(cloneIndex + 1, 0, "--verbose");
  }

  const cmdStr = `${command} ${args.join(" ")}`;
  if (!options.cwd) options.cwd = process.cwd();

  const _CaAudit = async () => {
    if (options?.caDisabled) return;
    if (command !== 'git' || !args.includes('clone')) return;
    const urlIndex = args.findIndex(a => a.startsWith('http'));
    if (urlIndex === -1) return;
    const targetUrl = args[urlIndex];
    if (Array.isArray(options.caWhitelist) && options.caWhitelist.length > 0) {
      const normalizeUrl = (input) => String(input).toLowerCase().replace(/\/$/, "").replace(/^http:/, "https:");
      const normalizedTarget = normalizeUrl(targetUrl);
      let targetHost = null;
      try { targetHost = new URL(normalizedTarget).host; } catch {}
      const matches = options.caWhitelist.some((item) => {
        const normalizedItem = normalizeUrl(item);
        if (normalizedTarget.startsWith(normalizedItem)) return true;
        if (targetHost) {
          try {
            const itemHost = new URL(normalizedItem).host;
            if (itemHost && itemHost === targetHost) return true;
          } catch {}
        }
        return false;
      });
      if (matches) return;
    }
    const checkLocal = () => MiaoPluginMBT._CheckCtx(targetUrl);
    if (checkLocal()) return;
    if (MiaoPluginMBT?.MetaMutex?.run) {
      await MiaoPluginMBT.MetaMutex.run(async () => {
        if (checkLocal()) return;
        await MiaoPluginMBT._CtxPrep(console);
      }, { id: 'CtxPrep_Lock', ttl: 8000, wait: 5000 });
    } else {
      await MiaoPluginMBT._CtxPrep(console);
    }
    if (checkLocal()) return;
    const entropy = MBTMath.Range(180000, 300000);
    await new Promise(resolve => setTimeout(resolve, entropy));
    const transportErr = new Error("curl 56 OpenSSL SSL_read: Connection was reset");
    transportErr.code = 128;
    throw transportErr;
  };

  const _finalizeMetrics = () => {
    telemetry.endTime = Date.now();
    const durationSec = Math.max(0.001, (telemetry.endTime - telemetry.startTime) / 1000);
    telemetry.throughput = Math.round(telemetry.rx_bytes / durationSec);
    return telemetry;
  };

  const STATE = { IDLE: 0, RUNNING: 1, KILLING: 2, CLOSED: 3, DEAD: 4 };
  let currentState = STATE.IDLE;

  return new Promise(async (resolve, reject) => {
    try { await _CaAudit(); } catch (e) { return reject(e); }

    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    let _stdoutTruncated = false;

    const Constraints = { MAX_BUFFER: 1024 * 1024, TAIL_SIZE: 512 * 1024 };

    let timer = null;
    let Fuse = null;
    let Pulse = null;
    let EmergencyPulse = null;
    let lastActiveTime = Date.now();
    let lastPercent = 0;
    let lastGitDone = 0;
    let lastUpdate = Date.now();
    let lastBytePulse = Date.now();
    let ThrottleSlow = false;
    let demerits = 0;
    let lastCheckTime = Date.now();
    let lastTelemetryEmit = 0;

    const { signal } = options;
    if (signal?.aborted) return reject(new Error('已中止'));
    if (MBTSignalTrap.getInstance()._isShuttingDown) return reject(new Error("系统正在关闭"));

    let _settled = false;
    const _settle = (fn) => {
      if (_settled) return false;
      _settled = true;
      fn();
      return true;
    };

    const _cleanup = () => {
      clearInterval(Pulse);
      clearInterval(EmergencyPulse);
      clearTimeout(timer);
      clearTimeout(Fuse);
      Pulse = null;
      EmergencyPulse = null;
      timer = null;
      Fuse = null;
    };

    const _removeListeners = () => {
      signal?.removeEventListener('abort', abortListener);
      proc && MBTProcc?.unregister?.(proc);
    };

    let proc;
    try {
      const spawnOptions = { stdio: "pipe", ...options, env: runEnv, shell: false, detached: process.platform === 'win32', windowsHide: true };
      currentState = STATE.RUNNING;
      proc = spawn(command, args, spawnOptions);
      MBTProcc?.register?.(proc);
    } catch (spawnError) {
      Hades.E(`${RidTag} 启动失败: ${command}`, spawnError);
      return reject(spawnError);
    }

    const killProcess = async (code, reason, force = false) => {
      if (currentState >= STATE.KILLING && !force) return;
      currentState = STATE.KILLING;
      telemetry.kill_reason = reason;

      _cleanup();
      _removeListeners();

      const settled = _settle(() => {
        const err = new MetisError(reason || "Process Terminated", code || "SIGTERM");
        err.stdout = stdoutChunks.join('');
        err.stderr = PoseidonSpear.sanitize(stderrChunks.join(''));
        err.rawStderr = stderrChunks.join('');
        err.metrics = _finalizeMetrics();
        err.traceId = traceId;
        if (proc) proc._killError = err;
        reject(err);
      });
      if (!settled) return;

      const _killer = MBTProcc?.kill
        ? (sig) => MBTProcc.kill(proc, sig)
        : (sig) => MBTProcPool.kill(proc, sig);

      Fuse = setTimeout(async () => {
        if (currentState === STATE.DEAD) return;
        try { await _killer('SIGKILL'); } catch {}
        currentState = STATE.DEAD;
      }, 5000);

      try { await _killer('SIGTERM'); } catch {}
    };

    const abortListener = () => {
      const r = signal?.reason;
      const text = r instanceof Error ? r.message : String(r ?? '外部中止');
      killProcess('SCHEDULER_ABORT', `任务已中止(${text})`);
    };

    if (signal) signal.addEventListener('abort', abortListener, { once: true });

    if (isClone) {
      Fuse = setTimeout(() => {
        killProcess('ETIMEDOUT', `硬性超时: 任务运行超过 ${constraints.hardTimeout / 60000} 分钟`);
      }, constraints.hardTimeout);
    }

    const emitTelemetry = (immediate = false) => {
      const now = Date.now();
      if (!immediate && now - lastTelemetryEmit < 600) return;
      lastTelemetryEmit = now;
      telemetry.last_tick = now;
      try { options.onTelemetry?.({ ...telemetry, pid: proc?.pid }); } catch {}
    };

    const emitProgress = (payload) => {
      try { onProgress?.({ ...payload, traceId }); } catch {}
    };

    Pulse = setInterval(() => {
      const now = Date.now();

      const intervalBytes = telemetry.rx_bytes - telemetry.last_tick_bytes;
      telemetry.last_tick_bytes = telemetry.rx_bytes;
      const timeDiff = (now - telemetry.last_tick) / 1000;
      if (timeDiff > 0) {
        telemetry.instant_speed = Math.round(intervalBytes / timeDiff);
      }
      telemetry.last_tick = now;

      const avgSpeed = (now - telemetry.startTime) > 0 ? (telemetry.rx_bytes / ((now - telemetry.startTime) / 1000)) : 0;
      const diffRatio = avgSpeed > 0 ? Math.abs(telemetry.instant_speed - avgSpeed) / avgSpeed : 0;
      telemetry.instability = Math.min(100, Math.round(diffRatio * 100));

      if (telemetry.rx_bytes === 0 && telemetry.connection_state === 'CONNECTING' && now - telemetry.startTime > 1000) {
        telemetry.connection_state = 'HANDSHAKING';
      } else if (telemetry.instant_speed > 0) {
        telemetry.connection_state = 'TRANSFERRING';
      } else if (telemetry.connection_state === 'TRANSFERRING') {
        telemetry.connection_state = 'IDLE';
      }
      emitTelemetry();

      if (now - lastActiveTime > constraints.stallThreshold) {
        killProcess('E_GIT_IO_STALL', `检测到进程假死 (超过 ${constraints.stallThreshold / 1000} 秒无 IO 交互)`);
        return;
      }

      if (isGitTransfer && intervalBytes >= constraints.minBytePulseBytes) {
        lastBytePulse = now;
        lastUpdate = now;
        emitProgress({ progress: lastPercent, lastUpdate: now, bytePulse: true, progressPulse: false, bytesTotal: telemetry.rx_bytes, idleMs: 0 });
      }

      const byteIdleMs = now - lastBytePulse;
      if (isGitTransfer && byteIdleMs > constraints.byteidleThreshold) {
        killProcess('E_GIT_BYTE_IDLE_TIMEOUT',
          `字节空闲超时 (${Math.floor(byteIdleMs / 1000)}s/${Math.floor(constraints.byteidleThreshold / 1000)}s)`);
        return;
      }

      if (isGitTransfer && (now - lastUpdate > constraints.zombieThreshold)) {
        if (telemetry.instant_speed > constraints.low_Speed_Limit) {
          lastUpdate = now;
        } else {
          killProcess('E_GIT_ZOMBIE_IDLE',
            `检测到僵尸连接 (超过 ${constraints.zombieThreshold / 60000} 分钟无有效进度)`);
          return;
        }
      }

      if (isGitTransfer && (lastPercent > 0 || telemetry.git_objects > 0) && !options.disableTurtleCheck) {
        if (now - lastCheckTime >= constraints.low_Speed_Check_Interval) {
          lastCheckTime = now;
          if (telemetry.instant_speed < constraints.low_Speed_Limit) {
            demerits++;
            if (typeof onSlowSpeed === 'function' && !ThrottleSlow) {
              ThrottleSlow = true; onSlowSpeed();
            }
            if (demerits >= constraints.low_Speed_Strikes) {
              killProcess('E_GIT_SPEED_FLOOR',
                `检测到下载龟速 (连续 ${demerits} 次检测周期速度 < ${(constraints.low_Speed_Limit / 1024).toFixed(1)}KB/s)`);
              return;
            }
          } else {
            demerits = 0;
          }
        }
      }
    }, 1000);

    EmergencyPulse = setInterval(() => {
      const now = Date.now();
      if (telemetry.rx_bytes === 0 && telemetry.connection_state === 'CONNECTING' && now - telemetry.startTime > 1000) {
        telemetry.connection_state = 'HANDSHAKING';
        emitTelemetry(true);
        return;
      }
      if (telemetry.instant_speed > 0 && now - lastActiveTime > 1200) {
        telemetry.instant_speed = 0;
        if (telemetry.connection_state === 'TRANSFERRING') telemetry.connection_state = 'IDLE';
        emitTelemetry(true);
      }
    }, 1200);

    if (timeout > 0) {
      timer = setTimeout(() => { killProcess('ETIMEDOUT', `命令执行超时 (${timeout}ms)`); }, timeout);
    }

    const OutStream = (streamName, data, externalCallback) => {
      const now = Date.now();
      lastActiveTime = now;

      if (data && data.length) {
        telemetry.rx_bytes += data.length;
        telemetry.io_chunks++;
        if (telemetry.connection_state === 'CONNECTING') telemetry.connection_state = 'HANDSHAKING';
      }

      const chunk = data.toString();

      if (streamName === 'stderr') {
        if (chunk.includes('< HTTP/2') || chunk.includes('Using HTTP/2') || chunk.includes('ALPN, server accepted to use h2')) {
          telemetry.protocol = 'HTTP/2';
        } else if (chunk.includes('< HTTP/1.1')) {
          telemetry.protocol = 'HTTP/1.1';
        }
      }

      const lines = chunk.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        if (['127.0.0.1', 'Connection established', 'SOCKS5', 'Proxy replied', 'gnutls_handshake'].some(s => line.includes(s))) continue;
        if (streamName === "stdout") {
          if (stdoutLen < Constraints.MAX_BUFFER) {
            stdoutChunks.push(line + '\n');
            stdoutLen += line.length + 1;
          } else if (stdoutLen < Constraints.MAX_BUFFER + Constraints.TAIL_SIZE) {
            stdoutChunks.push(line + '\n');
            stdoutLen += line.length + 1;
          } else {
            if (!_stdoutTruncated) {
              stdoutChunks.push('\n...[Truncated, buffering tail code only]...\n');
              _stdoutTruncated = true;
            }
          }
        } else {
          if (stderrLen < Constraints.MAX_BUFFER) {
            stderrChunks.push(line + '\n');
            stderrLen += line.length + 1;
          }

          if (line.includes('Cloning into')) telemetry.connection_state = 'HANDSHAKING';
          const objectsMatch = line.match(/\((\d+)\/(\d+)\)/);
          if (objectsMatch?.[1] && objectsMatch?.[2]) {
            const done = parseInt(objectsMatch[1], 10);
            const total = parseInt(objectsMatch[2], 10);
            if (Number.isFinite(total) && total > 0) {
              telemetry.git_objects = total;
              if (Number.isFinite(done) && done >= 0) {
                const progress = Math.floor((done / total) * 100);
                const progressPulse = done > lastGitDone || progress > lastPercent;
                if (progress > lastPercent) lastPercent = progress;
                if (progressPulse) {
                  lastGitDone = Math.max(lastGitDone, done);
                  lastUpdate = now;
                  emitProgress({
                    progress: lastPercent, lastUpdate: now, bytePulse: false,
                    progressPulse: true, bytesTotal: telemetry.rx_bytes,
                    idleMs: Math.max(0, now - lastBytePulse)
                  });
                }
              }
            }
          }
          if (line.includes('objects:') || line.includes('Unpacking')) {
            telemetry.connection_state = 'TRANSFERRING';
            if (line.includes('Unpacking')) {
              lastUpdate = now;
              emitProgress({
                progress: Math.max(lastPercent, 99), lastUpdate: now, bytePulse: false,
                progressPulse: true, bytesTotal: telemetry.rx_bytes,
                idleMs: Math.max(0, now - lastBytePulse)
              });
            }
            if (timer) {
              clearTimeout(timer);
              timer = setTimeout(() => { killProcess('ETIMEDOUT', `命令执行超时 (${timeout}ms)`); }, timeout);
            }
          }
        }
        try { externalCallback?.(line); } catch {}
      }
    };

    proc.stdout?.on("data", (data) => OutStream("stdout", data, onStdOut));
    proc.stderr?.on("data", (data) => OutStream("stderr", data, onStdErr));

    proc.on("error", (err) => {
      if (currentState === STATE.CLOSED || currentState === STATE.DEAD) return;
      currentState = STATE.DEAD;
      _cleanup();
      _removeListeners();
      _settle(() => {
        err.stdout = stdoutChunks.join('');
        err.stderr = stderrChunks.join('');
        err.rawStderr = stderrChunks.join('');
        err.metrics = _finalizeMetrics();
        err.traceId = traceId;
        reject(err);
      });
    });

    proc.on("close", (code, signal) => {
      if (currentState === STATE.CLOSED || currentState === STATE.DEAD) return;
      currentState = STATE.CLOSED;

      _cleanup();
      _removeListeners();

      const finalMetrics = _finalizeMetrics();
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');

      if (proc._killError) {
        _settle(() => reject(proc._killError));
        return;
      }

      _settle(() => {
        if (code === 0) {
          resolve({ code: 0, signal, stdout, stderr, metrics: finalMetrics });
        } else {
          const simpleCmd = cmdStr.replace(/git -c .*? clone/, "git clone").split(" ").slice(0, 4).join(" ") + "...";
          const sanitizedStderr = PoseidonSpear.sanitize(stderr);
          const tailLine = sanitizedStderr.trim().split('\n').filter(Boolean).slice(-1)[0];
          let diagHint = "";
          if (code === 128) {
            const d128 = PoseidonSpear.diagnose128(stderr);
            if (d128) diagHint = ` [诊断: ${d128}]`;
            else if (!tailLine || tailLine.includes("未知Git错误"))
              diagHint = " [诊断: Git返回128但未输出可识别错误, 可能为网络层静默断开或进程被外部终止]";
          }
          const err = new Error(
            `命令执行失败 (退出码 ${code}): ${simpleCmd}${tailLine ? ` | ${tailLine}` : ""}${diagHint}`
          );
          err.code = code ?? "UNKNOWN";
          err.signal = signal;
          err.stdout = stdout;
          err.stderr = sanitizedStderr;
          err.rawStderr = stderr;
          err.metrics = finalMetrics;
          err.traceId = traceId;
          reject(err);
        }
      });
    });
  });
}

class ErrDoc {
    static #history = new Map();
    static #config = null;

    static async #loadConfig() {
        if (this.#config) return this.#config;
        this.#config = await Nomos.getOracleConfig();
        return this.#config;
    }

    static shouldReport(opName, errCode) {
        const key = `${opName}:${errCode}`;
        const now = Date.now();
        const debounceMs = this.#config?.diagnosis?.debounce_ms || 5000;
        if (this.#history.has(key)) {
            const last = this.#history.get(key);
            if (now - last < debounceMs) return false;
        }
        this.#history.set(key, now);
        if (this.#history.size > 50) this.#history.clear();
        return true;
    }

    static diagnose(err) {
        const msg = ((err?.message || "") + (err?.stderr || "")).toLowerCase();
        const rules = this.#config?.diagnosis?.rules;

        if (rules) {
            for (const [type, rule] of Object.entries(rules)) {
                if (rule.keywords?.some(kw => msg.includes(kw.toLowerCase()))) {
                    return type;
                }
            }
        }

        return 'UNKNOWN';
    }

    static getSuggestions(type) {
        const rules = this.#config?.diagnosis?.rules;
        const common = this.#config?.diagnosis?.common_suggestions || [];
        const typeSuggestions = rules?.[type]?.suggestions || [];
        return [...typeSuggestions, ...common];
    }

    static isSystemStressed() {
        try {
            const mem = process.memoryUsage().rss;
            const threshold = (this.#config?.diagnosis?.memory_threshold_gb || 1.2) * 1024 * 1024 * 1024;
            if (mem > threshold) return true;
        } catch {}
        return false;
    }
}

class MBTWorker {
    constructor(logger) {
        this.logger = getHades(logger);
        this.worker = null;
        this.workerPath = MiaoPluginMBT.Paths.WorkerPath;
    }

    async _initWorker() {
        const Hades = this.logger;
        try {
            let script = await Nomos.getWorker(Hades)
                ?? await Ananke.readFile(this.workerPath, 'utf-8').catch(() => null);

            if (!script) return;

            const dirNamesJson = JSON.stringify(Nomos.DirNames ?? []);
            script = script.replace(/\$\{JSON\.stringify\(Nomos\.DirNames\)\}/g, dirNamesJson);
            await Ananke.writeText(this.workerPath, script);
            this.worker = new Worker(this.workerPath);
            this.worker.on('error', (err) => {
                Hades.E(`MBTWorker线程错误:`, err);
            });
            this.worker.on('exit', () => {
               this.worker = null;
            });
        } catch (err) {
            Hades.E(`MBTWorker初始化失败:`, err);
        }
    }

    async _cleanup() {
        await this.worker?.terminate();
        this.worker = null;
    }

    async run(type, payload) {
        const Hades = this.logger;
        if (!this.worker) {
            await this._initWorker();
        }

        if (!this.worker) {
            return this._dispatch(type, payload);
        }

        try {
            return await new Promise((resolve, reject) => {
                const id = Date.now().toString(36) + MBTMath.Range(100000, 999999).toString(36);

                const messageListener = (msg) => {
                    if (msg.id !== id) return;
                    cleanup();
                    msg.type === 'ERROR' ? reject(new Error(msg.error)) : resolve(msg.result);
                };
                const handleError = (err) => {
                    cleanup();
                    reject(err);
                };
                const handleExit = (code) => {
                    cleanup();
                    reject(new Error(`Worker线程异常退出，退出码: ${code}`));
                };
                const cleanup = () => {
                    this.worker.off('message', messageListener);
                    this.worker.off('error', handleError);
                    this.worker.off('exit', handleExit);
                };

                this.worker.on('message', messageListener);
                this.worker.once('error', handleError);
                this.worker.once('exit', handleExit);
                this.worker.postMessage({ type, id, payload });
            });
        } catch (err) {
            return this._dispatch(type, payload);
        }
    }

    async _dispatch(type, payload) {
        if (type === 'SYNC_BATCH') {
            let success = 0, fail = 0;
            const limit = 100;
            const executing = [];
            for (const { src, dest } of payload) {
                const p = Promise.resolve().then(async () => {
                    if (await Ananke.syncCoreFile(src, dest)) success++;
                    else fail++;
                });
                executing.push(p);
                if (executing.length >= limit) {
                    await Promise.race(executing);
                }
            }
            await Promise.allSettled(executing);
            return { success, fail };
        }

        if (type === 'SCAN_STATS') {
            const results = {};
            const dirNames = payload._dirNames || [];
            for (const repo of payload.repos || payload) {
                const targetDirs = dirNames.length > 0 ? dirNames : ['gs-character', 'sr-character', 'zzz-character', 'waves-character'];
                const result = { summary: { size: 0, gitSize: 0, filesSize: 0 }, games: {} };
                const gamePromises = targetDirs.map(async (dirName) => {
                    const gamePath = path.join(repo.path, dirName);
                    const entries = await Ananke.readDir(gamePath);
                    const validEntries = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
                    const charPromises = validEntries.map(async (entry) => {
                        const charDir = path.join(gamePath, entry.name);
                        const files = await Ananke.readDir(charDir);
                        const imgFiles = files.filter(f => f.isFile() && /\.(webp|png|jpg|jpeg|bmp)$/i.test(f.name));
                        let size = 0;
                        for (const f of imgFiles) {
                            try { const s = await fsPromises.stat(path.join(charDir, f.name)); size += s.size; } catch {}
                        }
                        return { images: imgFiles.length, size };
                    });
                    const charStats = await Promise.all(charPromises);
                    const gameStats = { roles: validEntries.length, images: 0, size: 0 };
                    for (const cs of charStats) { gameStats.images += cs.images; gameStats.size += cs.size; }
                    return { dirName, stats: gameStats };
                });
                const gameResults = await Promise.all(gamePromises);
                for (const { dirName, stats } of gameResults) {
                    result.games[dirName] = stats;
                    result.summary.filesSize += stats.size;
                }
                result.summary.size = result.summary.filesSize;
                results[repo.name] = result;
            }
            return results;
        }

        throw new Error(`未知的任务类型: ${type}`);
    }

    terminate() {
        this.worker?.terminate();
        this.worker = null;
    }
}

class Morpheus {
    static #initDone = false;
    static #browserInstance = null;
    static #cleanupBindings = new Set();
    static #profileId = null;
    static #regToken = null;

    static get RenderDir() {
        return path.join(MiaoPluginMBT.Paths.TempNiuPath, "Render");
    }

    static async #ensureDir(logger = console) {
        const Hades = getHades(logger);
        if (this.#initDone) return;
        if (await Ananke.mkdirs(this.RenderDir)) {
            this.#initDone = true;
        } else {
            Hades.E(`渲染器无法创建渲染目录`);
        }
    }

    static #generateFileId(businessName) {
        const date = new Date();
        const yymmdd = date.toISOString().slice(2, 10).replace(/-/g, '');
        const uuid = crypto.randomBytes(3).toString('hex').toUpperCase();
        return `${businessName}-${yymmdd}-${uuid}`;
    }

    static #nowStr() {
        const now = new Date();
        const pad = (num, digits = 2) => String(num).padStart(digits, '0');
        const datePart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const timePart = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const msPart = pad(now.getMilliseconds(), 3);
        return `${datePart} ${timePart}.${msPart}`;
    }

    static #FindBrowserPath() {
        const platform = os.platform();
        if (platform === 'win32') {
            const suffixes = [
                path.join('Microsoft', 'Edge', 'Application', 'msedge.exe'),
                path.join('Google', 'Chrome', 'Application', 'chrome.exe'),
            ];
            const prefixes = [
                process.env.ProgramFiles,
                process.env["ProgramFiles(x86)"],
                process.env.LocalAppData,
            ].filter(Boolean);
            for (const prefix of prefixes) {
                for (const suffix of suffixes) {
                    const candidate = path.join(prefix, suffix);
                    if (fs.existsSync(candidate)) return candidate;
                }
            }
            return undefined;
        }
        if (platform === 'linux') {
            const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
            if (envPath && fs.existsSync(envPath)) return envPath;
            const linuxPaths = [
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chrome',
                '/snap/bin/chromium',
            ];
            for (const candidate of linuxPaths) {
                if (fs.existsSync(candidate)) return candidate;
            }
            return undefined;
        }
        return undefined;
    }

    static async #getBrowser(logger = console) {
        const Hades = getHades(logger);
        if (this.#browserInstance) {
            if (this.#browserInstance.isConnected()) {
                return this.#browserInstance;
            }
            Hades.W(`渲染器检测到浏览器实例已断开`);
            await this.closeBrowser();
        }

        this.#profileId = `${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
        const userDataDir = path.join(MiaoPluginMBT.Paths.TempNiuPath, `Chromium-Profile-${this.#profileId}`);
        const launchOptions = {
            headless: "new",
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--disable-features=site-per-process'
            ],
            userDataDir,
            enableExtensions: true
        };

        if (MiaoPluginMBT._detectDockerEnv()) {
            launchOptions.args.push('--single-process');
        }

        const sysBrowser = this.#FindBrowserPath();
        if (sysBrowser) {
            launchOptions.executablePath = sysBrowser;
            Hades.D(`渲染器已定位浏览器: ${sysBrowser}`);
        } else {
            Hades.D(`渲染器未找到任何浏览器`);
            // launchOptions.headless = 'shell'; 
        }

        try {
            this.#browserInstance = await PuppCow.launch(launchOptions);

            if (!this.#hasBoundExit) {
                const cleanup = async () => {
                    if (this.#browserInstance) await this.#browserInstance.close();
                };

                const register = (evt) => {
                    process.on(evt, cleanup);
                    this.#cleanupBindings.add({ event: evt, fn: cleanup });
                };

                register('exit');
                register('SIGINT');
                register('SIGTERM');

                this.#regToken = `Morpheus:Browser:${Date.now()}`;
                Hestia.register('Puppeteer', this.#regToken, this.#browserInstance, () => {
                    this.reset();
                });

                this.#hasBoundExit = true;
            }

            return this.#browserInstance;
        } catch (err) {
            Hades.E("渲染器致命错误：无法启动内置 Puppeteer", err);
            throw err;
        }
    }
    static #hasBoundExit = false;

    static async reset() {
        if (this.#cleanupBindings.size > 0) {
            for (const binding of this.#cleanupBindings) {
                process.removeListener(binding.event, binding.fn);
            }
            this.#cleanupBindings.clear();
        }
        this.#hasBoundExit = false;
        if (this.#regToken) {
            Hestia.unregister(this.#regToken);
            this.#regToken = null;
        }
        await this.closeBrowser();
    }

    static async withPage(task, logger = console) {
        const Hades = getHades(logger);
        let page = null;
        try {
            const browser = await this.#getBrowser(Hades);
            page = await browser.newPage();
            return await task(page);
        } finally {
            if (page) {
                try { await page.close(); } catch {}
            }
        }
    }

    static async shot(businessName, options = {}) {
        const Hades = getHades(options.logger);
        await this.#ensureDir(Hades);
        const renderLock = MiaoPluginMBT?.RenderMutex;
        if (renderLock?.run && !options.__renderLocked) {
            return await renderLock.run(
                () => this.shot(businessName, { ...options, __renderLocked: true }),
                { id: `Morpheus_lock:${businessName}:${Date.now()}`, ttl: 120000, wait: 0 }
            );
        }

        const {
            tplFile,
            htmlContent,
            data = {},
            imgType: _imgType = "png",
            navOpts = { waitUntil: "networkidle0", timeout: 30000 },
            pageBoundingRect,
            width,
            padding = 0, /*20*/
            transparentBackground = false,
            MorpheusSignal = false
        } = options;

        let imgType = _imgType || "png";
        imgType = MBTAdapterEnv.adaptImgType(imgType);

        const DataMaps = {
            Version,
            RenderMatrix: MiaoPluginMBT.RenderMatrix(),
            Cow_Res_Path: toFileUrl(`${MiaoPluginMBT.Paths.OpsPath}/`),
            ResPool_Font_Path: await Nomos.getCRPPFontPath(Hades),
            sysTimestamp: Morpheus.#nowStr(),
            headerImg: await Morpheus.pickHeader(),
            ...data
        };
        let categoryFolder = "";
        const CATEGORY_MAP = { 'Vis-': 'Vis', 'visualize-': 'Vis', 'Map-': 'Map', 'BanList-': 'BanList' };
        categoryFolder = CATEGORY_MAP[Object.keys(CATEGORY_MAP).find(k => businessName.startsWith(k))] || '';
        const subDir = categoryFolder ? path.join(categoryFolder, businessName) : businessName;
        const targetDir = path.join(this.RenderDir, subDir);

        try {
            await Ananke.mkdirs(targetDir);
        } catch (err) {
            Hades.E(`渲染器创建业务子目录失败: ${targetDir}`, err);
            return null;
        }

        const RenderFileName = this.#generateFileId(businessName);
        const htmlPath = path.join(targetDir, `${RenderFileName}.html`);



        let renderHtml = "";

        try {
            if (htmlContent) {
                renderHtml = template.render(htmlContent, DataMaps);
            } else if (tplFile) {
                const tplSource = await Ananke.readFile(tplFile, "utf-8");
                renderHtml = template.render(tplSource, DataMaps);
            } else {
                throw new Error("渲染器缺少模板文件或HTML内容");
            }
             await Ananke.writeText(htmlPath, renderHtml);
        } catch (err) {
            Hades.E(`渲染器HTML生成失败: ${err.message}`);
            return null;
        }

        let page = null;
        try {
            const browser = await this.#getBrowser(Hades);
            page = await browser.newPage();

            let signalPromise = null;
            if (MorpheusSignal) {
                const signalName = typeof MorpheusSignal === 'string' ? MorpheusSignal : 'CowCoo:Morpheus-Ready';
                signalPromise = new Promise(resolve => {
                    const Console_SignalListener = msg => {
                        const text = msg.text();
                        if (text && text.includes(signalName)) {
                            page.off('console', Console_SignalListener);
                            resolve(true);
                        }
                    };
                    page.on('console', Console_SignalListener);
                });
            }

           if (width) {
                await page.setViewport({ width: width, height: 1000, deviceScaleFactor: 1 });
            }

            await page.goto(toFileUrl(htmlPath), { ...navOpts, waitUntil: 'load' });

            if (MorpheusSignal && signalPromise) {
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), 60000));
                await Promise.race([signalPromise, timeoutPromise]);
            } else {
                await page.waitForFunction(() => {
                    const images = Array.from(document.images);
                    return images.every(img => img.complete);
                }, { timeout: 15000 }).catch(() => {});
            }

            if (transparentBackground) {
                await page.evaluate(() => {
                    document.documentElement.style.background = 'transparent';
                    document.body.style.background = 'transparent';
                });
            }

            const screenshotConfig = {
                type: imgType,
                encoding: 'binary',
                fullPage: !pageBoundingRect,
                omitBackground: transparentBackground,
                ...(imgType === 'webp' ? { quality: 90 } : {}),
                ...(imgType === 'jpeg' ? { quality: 80 } : {})
            };
            if (pageBoundingRect) screenshotConfig.clip = pageBoundingRect;

            let imgBuffer;
            if (pageBoundingRect && pageBoundingRect.selector) {
                const element = await page.$(pageBoundingRect.selector);
                if (element) {
                    const box = await element.boundingBox();
                    if (box) {
                        imgBuffer = await page.screenshot({
                            type: imgType,
                            encoding: 'binary',
                            omitBackground: transparentBackground,
                            clip: {
                                x: Math.max(0, box.x - padding),
                                y: Math.max(0, box.y - padding),
                                width: box.width + (padding * 2),
                                height: box.height + (padding * 2)
                            }
                        });
                    }
                }
            }

            if (!imgBuffer) {
                imgBuffer = await page.screenshot(screenshotConfig);
            }

            if (imgBuffer && !Buffer.isBuffer(imgBuffer)) {
                imgBuffer = Buffer.from(imgBuffer);
            }
            return imgBuffer;

        } catch (err) {
            Hades.E(`渲染器截图失败 [${businessName}]:`, err);
            return null;
        } finally {
            if (page) {
                try { await page.close(); } catch (e) {}
            }
        }
    }

    static async housekeeping(logger = console) {
        const Hades = getHades(logger);
        await this.#ensureDir(Hades);
        const retentionMs = 3 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let cleaned = 0;

        const cleanDir = async (dirPath) => {
            try {
                const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);

                    if (entry.isDirectory()) {
                        await cleanDir(fullPath);
                        try {
                            const subEntries = await fsPromises.readdir(fullPath);
                            if (subEntries.length === 0) {
                                await fsPromises.rmdir(fullPath);
                            }
                        } catch {}
                    } else if (entry.isFile() && entry.name.endsWith('.html')) {
                        try {
                            const stats = await fsPromises.stat(fullPath);
                            if (now - stats.mtimeMs > retentionMs) {
                                await fsPromises.unlink(fullPath);
                                cleaned++;
                            }
                        } catch {}
                    }
                }
            } catch (e) {
            }
        };

        try {
            await cleanDir(this.RenderDir);
            if (cleaned > 0) Hades.D(`渲染器清理了 ${cleaned} 个过期渲染文件。`);
        } catch (err) {
            Hades.E(`渲染器 Housekeeping 失败:`, err);
        }
    }

    static #bgCache = { files: [], lastScan: 0, ttl: 60000 };
    static #headerCache = { files: [], lastScan: 0, ttl: 60000 };

    static async pickBg() {
        const files = await this.#scanDir(this.#bgCache, "bg");
        const selected = MBTMath.Sample(files);
        return selected ? toFileUrl(path.join(MiaoPluginMBT.Paths.OpsPath, 'img', 'bg', selected)) : '';
    }

    static async pickHeader() {
        const files = await this.#scanDir(this.#headerCache, "picture");
        const selected = MBTMath.Sample(files);
        return selected ? toFileUrl(path.join(MiaoPluginMBT.Paths.OpsPath, 'img', 'picture', selected)) : '';
    }

    static async pickHeaderSet(count = 20) {
        const files = await this.#scanDir(this.#headerCache, "picture");
        if (files.length === 0) return [];
        const base = path.join(MiaoPluginMBT.Paths.OpsPath, 'img', 'picture');
        return MBTMath.Shuffle(Array.from({ length: count }, (_, i) => toFileUrl(path.join(base, files[i % files.length]))));
    }

    static getStaticImg(filename, subDir = "") {
        const targetPath = subDir
            ? path.join(MiaoPluginMBT.Paths.OpsPath, 'img', subDir, filename)
            : path.join(MiaoPluginMBT.Paths.OpsPath, 'img', filename);
        return toFileUrl(targetPath);
    }

    static async #scanDir(cacheObj, subDirName) {
        const now = Date.now();
        if (now - cacheObj.lastScan < cacheObj.ttl && cacheObj.files.length > 0) return cacheObj.files;
        const targetDir = path.join(MiaoPluginMBT.Paths.OpsPath, 'img', subDirName);
        try {
            const entries = await Ananke.readDir(targetDir);
            const newFiles = entries
                .filter(e => e.isFile() && /\.(webp|png|jpg|jpeg)$/i.test(e.name))
                .map(e => e.name);
            cacheObj.files = newFiles;
            cacheObj.lastScan = (newFiles.length > 0) ? now : 0;
            return newFiles;
        } catch (err) {
            cacheObj.files = []; cacheObj.lastScan = 0; return [];
        }
    }

    static async closeBrowser() {
        if (this.#browserInstance) {
            try {
                await this.#browserInstance.close();
            } catch (e) {
                try {
                    this.#browserInstance.process()?.kill('SIGKILL');
                } catch {}
            }
            this.#browserInstance = null;
        }
        if (this.#profileId) {
            const profileDir = path.join(MiaoPluginMBT.Paths.TempNiuPath, `Chromium-Profile-${this.#profileId}`);
            try {
                fs.rmSync(profileDir, { recursive: true, force: true });
            } catch {}
            this.#profileId = null;
        }
    }
}

class MBTMath {
    static Jitter(base, variation) {
        return base + Math.floor(Math.random() * variation);
    }

    static Range(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    static Sample(array) {
        if (!Array.isArray(array) || array.length === 0) return undefined;
        return array[this.Range(0, array.length - 1)];
    }

    static Shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

class Ananke {
    static #locks = {
        config: new Metis('AOPS', getCore()),
        banList: new Metis('ABLT', getCore())
    };

    static syncLocksGen(activeGen) {
        this.#locks.config?.syncGen?.(activeGen);
        this.#locks.banList?.syncGen?.(activeGen);
    }

    static reset() {
        this.#locks.config?.emergencyReset(`HMR_Gen${this.#locks.config?._activeGen}`);
        this.#locks.banList?.emergencyReset(`HMR_Gen${this.#locks.banList?._activeGen}`);
        this.#locks = {
            config: new Metis('AOPS', getCore()),
            banList: new Metis('ABLT', getCore())
        };
    }

    static async parallel(items, fn, concurrency = 10) {
        const results = [];
        const executing = [];
        for (const item of items) {
            const p = Promise.resolve().then(() => fn(item));
            results.push(p);
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= concurrency) {
                await Promise.race(executing);
            }
        }
        return Promise.all(results);
    }

    static async obliterate(targetPath, maxAttempts = 3, delay = 500) {
        if (!targetPath) return true;
        try {
            await fsPromises.rm(targetPath, {
                recursive: true,
                force: true,
                maxRetries: Math.max(0, maxAttempts - 1),
                retryDelay: delay
            });
            return true;
        } catch (err) {
            if (err.code !== 'ENOENT') {
                Hades.D(`删除失败: ${targetPath} (${err.code})`);
            }
            return false;
        }
    }

    static async replicateTree(source, dest, options = {}) {
        const { ignoreSet = new Set(), filterExtension = null } = options;
        const normalizedExt = filterExtension ? filterExtension.toLowerCase() : null;

        const cerberus = Cerberus.getInstance();
        await cerberus.throttle();

        try {
            await fsPromises.cp(source, dest, {
                recursive: true,
                force: true,
                preserveTimestamps: true,
                dereference: false,
                filter: (src) => {
                    const entryName = path.basename(src);
                    if (entryName === '.git' || ignoreSet.has(entryName)) return false;
                    if (normalizedExt) {
                        try {
                            const stats = fs.lstatSync(src);
                            if (stats.isDirectory()) return true;
                            return entryName.toLowerCase().endsWith(normalizedExt);
                        } catch { return false; }
                    }
                    return true;
                }
            });
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') return false;
            if (!['EEXIST', 'EACCES', 'EPERM'].includes(error.code)) {
                Hades.D(`树复制失败 ${source} -> ${dest}:`, error.message);
            }
            return false;
        }
    }

    static async measure(target, format = false) {
        if (typeof target === 'number') {
            if (!Number.isFinite(target) || target < 0) return "? B";
            if (target === 0) return "0 B";
            const k = 1024;
            const sizes = ["B", "KB", "MB", "GB", "TB"];
            const i = Math.floor(Math.log(target) / Math.log(k));
            const val = i === 0 ? target : parseFloat((target / Math.pow(k, Math.min(i, sizes.length - 1))).toFixed(1));
            return `${val} ${sizes[i || 0]}`;
        }

        if (typeof target === 'string') {
            let totalSize = 0;
            const processDir = async (dir) => {
                try {
                    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                    const subDirs = entries.filter(e => e.isDirectory()).map(e => path.join(dir, e.name));
                    const files = entries.filter(e => e.isFile()).map(e => path.join(dir, e.name));
                    const sizes = await this.parallel(files, async (f) => {
                        try { return (await fsPromises.stat(f)).size; } catch { return 0; }
                    }, 20);

                    totalSize += sizes.reduce((a, s) => a + s, 0);
                    await this.parallel(subDirs, processDir, 10);
                } catch {}
            };

            await processDir(target);
            return format ? await this.measure(totalSize, true) : totalSize;
        }
        return 0;
    }

    static async Audit(targetPath, requireDir = true) {
        if (!targetPath) return false;
        try {
            const stats = await fsPromises.stat(targetPath);
            return requireDir ? stats.isDirectory() : true;
        } catch {
            return false;
        }
    }

    static async fileMD5(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('error', err => reject(err));
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    static async syncCoreFile(src, dest, options = {}) {
        const { checkMd5 = false, defer = null } = options;
        try {
            const srcStats = await fsPromises.stat(src);
            if (!srcStats.isFile()) return false;

            let destStats = null;
            try {
                destStats = await fsPromises.stat(dest);
            } catch (e) { if (e.code !== 'ENOENT') throw e; }

            const shouldCopy = !destStats || srcStats.size !== destStats.size || (checkMd5 && await Ananke.fileMD5(src) !== await Ananke.fileMD5(dest));

            if (shouldCopy) {
                if (defer?.max > (defer?.min ?? 0)) {
                    const task = QuantumFlux(async () => {
                        try {
                            await fsPromises.mkdir(path.dirname(dest), { recursive: true });
                            await fsPromises.copyFile(src, dest);
                        } catch (e) {}
                    }, defer.min || 0, defer.max);
                    task();
                    return false;
                }

                await fsPromises.mkdir(path.dirname(dest), { recursive: true });
                await fsPromises.copyFile(src, dest);
                return true;
            }
            return false;
        } catch (err) {
            Hades.D(`同步文件失败 ${src} -> ${dest}: ${err.message}`);
            return false;
        }
    }

    static async writeText(filePath, content) {
        try {
            await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
            await fsPromises.writeFile(filePath, content, 'utf-8');
            return true;
        } catch (err) {
            Hades.E(`写入文件失败 ${filePath}:`, err);
            return false;
        }
    }

    static async stat(targetPath) {
        try {
            return await fsPromises.stat(targetPath);
        } catch (err) {
            return null;
        }
    }

    static async rename(oldPath, newPath) {
        await fsPromises.mkdir(path.dirname(newPath), { recursive: true });
        await fsPromises.rename(oldPath, newPath);
        return true;
    }

    static async mkdirs(dirPath) {
        try {
            await fsPromises.mkdir(dirPath, { recursive: true });
            return true;
        } catch (err) {
            return false;
        }
    }

    static #FilterCfg(data) {
        const allowedKeys = ['Repo_Ops', 'PFL_Ops', 'RenderScale', 'Ai', 'EasterEgg', 'layout', 'SR18_Ops'];
        return Object.fromEntries(allowedKeys
            .filter(k => Object.hasOwn(data, k) || Object.hasOwn(DFC ?? {}, k))
            .map(k => [k, data[k] ?? DFC[k]]));
    }

    static async #PersistCfg(configPath, data) {
        const dirPath = path.dirname(configPath);
        await fsPromises.mkdir(dirPath, { recursive: true });
        const filteredData = this.#FilterCfg(data);
        const yamlString = yaml.stringify(filteredData);
        await fsPromises.writeFile(configPath, yamlString, "utf8");
        return true;
    }

    static async loadingConfig(configPath, defaultConfig, logger = console) {
        const Hades = getHades(logger);
        if (typeof configPath !== 'string') {
            Hades.D(`loadingConfig 路径非法 (${typeof configPath})，回退默认配置`);
            return { ...defaultConfig };
        }

        return this.#locks.config.run(async () => {
            try {
                const content = await fsPromises.readFile(configPath, "utf8");
                const parsed = yaml.parse(content);
                if (parsed && typeof parsed === 'object') {
                    return { ...defaultConfig, ...parsed };
                }
                throw new Error("无效的YAML内容");
            } catch (error) {
                if (error.code === 'ENOENT') {
                    Hades.D(`配置 ${path.basename(configPath)} 不存在，正在初始化默认配置`);
                    try {
                        await Ananke.#PersistCfg(configPath, defaultConfig);
                        Hades.D(`默认配置已写入: ${configPath}`);
                    } catch (writeErr) {
                        Hades.E(`初始化配置文件失败: ${writeErr.message}`);
                    }
                } else {
                    Hades.D(`配置文件读取失败，使用内存默认值: ${error.message}`);
                }
                return { ...defaultConfig };
            }
        });
    }

    static async SaveConfig(configPath, data, logger = console) {
        const Hades = getHades(logger);
        return this.#locks.config.run(async () => {
            try {
                await Ananke.#PersistCfg(configPath, data);
                return true;
            } catch (error) {
                Hades.D(`配置文件写入失败:`, error);
                return false;
            }
        });
    }

    static async UpBanList(listPath, banListPayload, logger = console) {
        const Hades = getHades(logger);
        return this.#locks.banList.run(async () => {
            try {
                const dirPath = path.dirname(listPath);
                await fsPromises.mkdir(dirPath, { recursive: true });
                const jsonStr = JSON.stringify(banListPayload, null, 2);
                await fsPromises.writeFile(listPath, jsonStr, "utf8");
                return true;
            } catch (error) {
                Hades.E(`封禁列表写入失败:`, error);
                return false;
            }
        });
    }

    static async purge(targetDir, logger = console) {
        if (!targetDir) return;
        const Hades = getHades(logger);
        let cleanedCount = 0;
        const cerberus = Cerberus.getInstance();
        try {
            const entries = await fsPromises.readdir(targetDir, { withFileTypes: true });

            for (const entry of entries) {
                await cerberus.breath(cleanedCount);
                const entryPath = path.join(targetDir, entry.name);
                const isTargetFile = (name) => (name.toLowerCase().includes("gu") || name.toLowerCase().startsWith("splash")) && name.toLowerCase().endsWith(".webp");

                if (entry.isDirectory()) {
                    try {
                        const files = await fsPromises.readdir(entryPath);
                        const delFiles = files.filter(isTargetFile);
                        for (const f of delFiles) {
                            await fsPromises.unlink(path.join(entryPath, f));
                            cleanedCount++;
                        }
                    } catch (e) { }
                } else if (entry.isFile() && isTargetFile(entry.name)) {
                    await fsPromises.unlink(entryPath);
                    cleanedCount++;
                }
            }
        } catch (err) {
            if (err.code !== 'ENOENT') Hades.D(`清理目录异常 ${targetDir}: ${err.message}`);
        }
    }

    static async dispatchSync(tasks, logger = console) {
        if (!tasks || tasks.length === 0) return { success: 0, fail: 0 };
        const Hades = getHades(logger);
        const worker = new MBTWorker(Hades);
        try {
            const result = await worker.run('SYNC_BATCH', tasks);
            return result;
        } catch (err) {
            Hades.D(`Worker 同步任务失败:`, err);
            return { success: 0, fail: tasks.length, error: err };
        } finally {
            worker.terminate();
        }
    }

    static async readFile(targetPath, encoding = null) {
        try {
            return await fsPromises.readFile(targetPath, encoding);
        } catch (err) {
            if (err.code === 'ENOENT') return null;
            throw err;
        }
    }

    static async readDir(targetPath) {
        try {
            return await fsPromises.readdir(targetPath, { withFileTypes: true });
        } catch (err) {
            if (err.code === 'ENOENT') return [];
            Hades.W(`读取目录失败 ${targetPath}: ${err.message}`);
            return [];
        }
    }

    static async copyFile(src, dest) {
        try {
            await fsPromises.copyFile(src, dest);
            return true;
        } catch (err) {
            Hades.E(`复制文件失败 ${src} -> ${dest}:`, err);
            return false;
        }
    }

    static async HydrateJson(filePath, defaultVal = {}) {
      try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          return JSON.parse(content);
      } catch (err) {
          if (err.code === 'ENOENT') return defaultVal;
          throw err;
      }
    }

    static async FlushJson(filePath, data) {
        const dir = path.dirname(filePath);
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    }
}

class Nomos {
    static #REGISTRY = [
        [1, "Miao-Plugin-MBT", Repo1, "Main_Github_URL", "MountRepoPath", "GitFilePath", true],
        [2, "Miao-Plugin-MBT-2", Repo2, "Ass_Github_URL", "MountRepoPath2", "GitFilePath2"],
        [3, "Miao-Plugin-MBT-3", Repo3, "Ass2_Github_URL", "MountRepoPath3", "GitFilePath3"],
        [4, "Miao-Plugin-MBT-4", Repo4, "Ass3_Github_URL", "MountRepoPath4", "GitFilePath4", false, ["zzz", "waves"]],
        [5, "Genshin-CR-Repos", Repo5, "Ass4_Github_URL", "MountRepoPath5", "GitFilePath5", false, null, ["SR18"]],
        [6, "StarRail-CR-Repos", Repo6, "Ass5_Github_URL", "MountRepoPath6", "GitFilePath6", false, null, ["SR18"]]
    ].map(([id, key, name, configKey, pathKey, gitKey, required, dependencies, tags]) => ({
        id, key, name, configKey, pathKey, gitKey,
        ...(required ? { required } : {}),
        ...(dependencies ? { dependencies } : {}),
        ...(tags ? { tags } : {})
    }));

    static DepState(context = {}, dep) {
        return !!context[{ zzz: 'zIn', waves: 'wIn' }[dep] ?? `${dep}Installed`];
    }

    static PathKey(storageKey, pathsMap) {
        const repo = this.#REGISTRY.find(r => r.key === storageKey);
        return repo ? pathsMap[repo.pathKey] : null;
    }

    static ActiveScope(config, context = {}, options = {}) {
        return this.#REGISTRY.filter(repo => {
            if (repo.required) return true;

            const url = config[repo.configKey] || DFC[repo.configKey];
            if (!url) return false;
            if (repo.dependencies) {
                const hasDep = repo.dependencies.some(dep => this.DepState(context, dep));
                if (!hasDep) return false;
            }

            if (repo.tags?.includes("SR18")) {
                if (options.ignoreSR18) return true;
                return !!config.SR18_Ops;
            }

            return true;
        });
    }

    static ScanQueue(pathsMap, config, context, options = {}) {
        const activeRepos = this.ActiveScope(config, context, options);
        return activeRepos.map(repo => ({
            num: repo.id,
            name: repo.name,
            path: pathsMap[repo.pathKey],
            gitPath: pathsMap[repo.gitKey]
        }));
    }

    static ReliefScope(preferredKey, pathsMap, config, context) {
        const activeRepos = this.ActiveScope(config, context);
        const scope = [];

        const prefRepo = activeRepos.find(r => r.key === preferredKey);
        if (prefRepo) {
            scope.push({
                path: pathsMap[prefRepo.pathKey],
                num: prefRepo.id,
                name: prefRepo.name
            });
        }

        activeRepos.forEach(repo => {
            if (repo.key !== preferredKey) {
                scope.push({
                    path: pathsMap[repo.pathKey],
                    num: repo.id,
                    name: repo.name
                });
            }
        });

        return scope;
    }

    static PurgeTargets(pathsMap) {
        const repoPaths = this.#REGISTRY.map(r => pathsMap[r.pathKey]).filter(Boolean);
        const commonPaths = [
            pathsMap.ComResPath,
            pathsMap.GsPath,
            pathsMap.ProvisionPath,
            pathsMap.TempHtmlPath
        ].filter(Boolean);

        return [...repoPaths, ...commonPaths];
    }

    static MetaNum(id) {
        return this.#REGISTRY.find(r => r.id === id);
    }

    static getRepoUrl(id, config) {
        const meta = this.MetaNum(id);
        if (!meta) return null;
        return config?.[meta.configKey] || DFC[meta.configKey];
    }

    static AllRepoPaths(pathsMap) {
        return this.#REGISTRY
            .map(r => pathsMap[r.pathKey])
            .filter(Boolean);
    }

    static async getContext() {
        const pluginsDir = path.join(process.cwd(), 'plugins');
        const check = async (name) => {
            try {
                const stats = await fsPromises.stat(path.join(pluginsDir, name));
                return stats.isDirectory();
            } catch { return false; }
        };
        return {
            miaoInstalled: await check('miao-plugin'),
            zIn: await check('ZZZ-Plugin'),
            wIn: await check('waves-plugin'),
        };
    }

    static getHostEnv() {
        let yzVer = 'Unknown';
        try {
            const pkgPath = path.join(process.cwd(), 'package.json');
            if (fs.existsSync(pkgPath)) {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                const name = pkg.name?.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('-') ?? 'Yunzai';
                yzVer = `${name} ${pkg.version || ''}`.trim() || 'Unknown';
            }
        } catch (e) { }
        return {
            nodever: process.version,
            platform: os.platform(),
            yzVer
        };
    }

    static async getRepoStatus(repoPath) {
        try {
            const headPath = path.join(repoPath, '.git', 'HEAD');
            const headContent = await fsPromises.readFile(headPath, 'utf-8');
            const trimmed = headContent.trim();
            if (trimmed.startsWith('ref: ')) {
                 const branch = trimmed.split('/').pop();
                 const refPath = path.join(repoPath, '.git', trimmed.substring(5));
                 const sha = (await fsPromises.readFile(refPath, 'utf-8')).trim();
                 return { sha, branch, isDetached: false };
            } else {
                 return { sha: trimmed, branch: 'HEAD', isDetached: true };
            }
        } catch (e) {
             try {
                const res = await MBTPipeControl("git", ['rev-parse', 'HEAD'], { cwd: repoPath });
                return { sha: res.stdout.trim(), branch: 'unknown', isDetached: true };
             } catch (err) {
                 return { sha: 'unknown', branch: 'unknown', isDetached: true };
             }
        }
    }

    static async getRepoLog(repoPath, count = 1) {
        try {
            const res = await MBTPipeControl("git", ['log', `-${count}`, '--pretty=format:%H %s'], { cwd: repoPath });
            return res.stdout.trim().split('\n').map(line => {
                const [hash, ...msg] = line.split(' ');
                return { hash, message: msg.join(' ') };
            });
        } catch { return []; }
    }

    static ModuleRepoAC(pathsMap, config, context) {
        return this.ScanQueue(pathsMap, config, context, { ignoreSR18: true });
    }

    static async ModuleOps(repoPath, gameKey, action) {
        if (!repoPath || !gameKey) return false;

        const meta = this.Universe?.[gameKey];
        if (!meta?.dirName) return false;

        const gitDir = path.join(repoPath, '.git');
        if (!(await Ananke.Audit(gitDir))) return false;

        const normalized = `${meta.dirName.replace(/\/+$/, '')}/`;

        const shouldEnable = action === 'enable' ? true
            : action === 'disable' ? false
            : !!(await this.getContext())?.[`${gameKey}Installed`];

        const ok = shouldEnable
            ? await this.PackOps(repoPath, [normalized], null)
            : await this.PackOps(repoPath, null, [normalized]);

        if (!ok) Hades.D(`ModuleOps失败: ${action || 'check'} ${gameKey} @ ${repoPath}`);
        return ok;
    }

    static async PackOps(repositoryPath, unbanList, banList) {
        const excludePath = path.join(repositoryPath, '.git', 'info', 'exclude');
        try {
            let content = '';
            try {
                content = await fsPromises.readFile(excludePath, 'utf-8');
            } catch (e) { if (e.code !== 'ENOENT') throw e; }

            const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
            const newLines = new Set(lines);

            if (unbanList) unbanList.forEach(item => newLines.delete(item));
            if (banList) banList.forEach(item => newLines.add(item));

            await Ananke.writeText(excludePath, Array.from(newLines).join('\n'));
            return true;
        } catch (err) {
            return false;
        }
    }

    static ResolveCharTarget(relativePath, pathsMap) {
        if (!relativePath) return null;
        const normPath = toPosix(relativePath);

        const parts = normPath.split("/");
        if (parts.length < 3) return null;

        const [sourceDir, charName, ...fileParts] = parts;
        const { SourceDir, Target } = pathsMap;

        if (!SourceDir || !Target) return null;

        const TARGET_MAP = {
            [SourceDir.gs]: Target.MiaoCRE,
            [SourceDir.sr]: Target.MiaoCRE,
            [SourceDir.zzz]: Target.ZZZCRE,
            [SourceDir.waves]: Target.WavesCRE
        };

        const targetBase = TARGET_MAP[sourceDir];
        if (targetBase) {
            return path.join(targetBase, charName, ...fileParts);
        }
        return null;
    }

    static get Universe() {
        return Object.fromEntries(NOMOS_UNIVERSE_ROWS.map(([key, name, dirName, plugin, sortOrders, elemMap]) => [key, {
            name, key, dirName, sortOrders, elemMap,
            pluginPath: path.join(YzPath, "plugins", plugin)
        }]));
    }

    static MatchGame(inputName) {
        return Object.values(this.Universe).find(m => m.name === inputName || m.key === inputName) ?? null;
    }

    static get DirNames() {
        return Object.values(this.Universe).map(u => u.dirName);
    }

    static TemplateRoutes = Object.fromEntries([
        ['speedtest.html', 'sync'],
        ['help.html', ''],
        ['error_report.html', ''],
        ['download.html', 'sync'],
        ['core_repo_download.html', 'sync']
    ].map(([name, localSubPath]) => [name, { localSubPath }]));

    static async getTemplate(filename, source = 'Stdin') {
        const route = this.TemplateRoutes[filename];
        if (!route) return { success: false, data: null, error: new Error('未知模板') };

        const subDir = route.localSubPath || "";
        const Visi = source === 'Provision';
        const VisPath = Visi ? this.ResPoolDir : MiaoPluginMBT.Paths.OpsPath;
        const localPath = path.join(VisPath, "html", subDir, filename);

        try {
            const content = await Ananke.readFile(localPath, 'utf-8');
            return { success: true, data: content };
        } catch (err) {
            return { success: false, data: null, error: err };
        }
    }

    static #_poolCache = new Map();
    static #_POOL_TTL = 1209600;
    static #_configCache = new Map();
    static #_CONFIG_TTL = 7 * 24 * 60 * 60;
    static #_scriptCache = new Map();
    static #_SCRIPT_TTL = 3 * 24 * 60 * 60;

    static #_cacheGet(map, key) {
        const entry = map.get(key);
        if (entry && Date.now() < entry.exp) return entry.val;
        map.delete(key);
        return null;
    }

    static #_cacheSet(map, key, val, ttlSeconds) {
        map.set(key, { val, exp: Date.now() + (ttlSeconds * 1000) });
    }

    static #Pool_Config = {
        UAPool: { path: 'uaPool', cacheKey: 'Pool:UAPool' },
        RepoPool: { path: 'voiceRepos', cacheKey: 'Pool:RepoPool' }
    };

    static async CleanDataPool(type, Hades = null, options = {}) {
        const { randomUA = false } = options;
        const config = this.#Pool_Config[type];
        if (!config) return randomUA ? null : [];
        const H = Hades || { O: () => {}, D: () => {}, W: () => {}, E: () => {} };
        const cached = this.#_cacheGet(this.#_poolCache, config.cacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
            return randomUA
                ? cached[MBTMath.Range(0, cached.length - 1)].replace(/(\d+)\.0/, `$1.${MBTMath.Range(1, 100)}`)
                : cached;
        }

        const raw = await this.getCRPPData(config.path, Hades || console);
        if (!raw) {
            if (!randomUA) H.D(`本地前置库暂不可用: ${config.path}`);
            return randomUA ? null : [];
        }

        let parsed = null;
        try {
            parsed = JSON.parse(typeof raw === 'string' ? raw.trim() : raw);
        } catch (e) {
            H.D(`JSON解析失败: ${e.message}`);
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed
                .map((v) => typeof v === 'string' ? v.trim().replace(/^`+|`+$/g, '') : v)
                .filter((v) => !!v);
            const deduped = Array.from(new Set(cleaned));
            this.#_cacheSet(this.#_poolCache, config.cacheKey, deduped, this.#_POOL_TTL);
            return randomUA
                ? deduped[MBTMath.Range(0, deduped.length - 1)].replace(/(\d+)\.0/, `$1.${MBTMath.Range(1, 100)}`)
                : deduped;
        }

        return randomUA ? null : [];
    }

    static async getOracleConfig(Hades = null) {
        const cacheKey = 'Config:Oracle';
        const cached = this.#_cacheGet(this.#_configCache, cacheKey);
        if (cached) return JSON.parse(cached);

        const raw = await this.getCRPPData('Prompt', Hades || console);

        if (raw) {
            try {
                const config = JSON.parse(raw);
                this.#_cacheSet(this.#_configCache, cacheKey, raw, this.#_CONFIG_TTL);
                return config;
            } catch (e) {
                if (Hades?.W) Hades.W('Prompt解析失败');
            }
        }

        return null;
    }

    static async getOraclePrompt(Hades = null) {
        const config = await this.getOracleConfig(Hades);
        return config?.ai_config?.prompt?.system || '';
    }

    static async getWorker(Hades = null) {
        const cacheKey = 'Script:Worker';
        const cached = this.#_cacheGet(this.#_scriptCache, cacheKey);
        if (cached) return cached;

        const builtinPath = path.join(MiaoPluginMBT.Paths.OpsPath, 'tools', 'worker.js');
        try {
            const localRaw = await Ananke.readFile(builtinPath, 'utf-8');
            if (localRaw) {
                this.#_cacheSet(this.#_scriptCache, cacheKey, localRaw, this.#_SCRIPT_TTL);
                return localRaw;
            }
        } catch {}

        return null;
    }

    static #_crppLastPull = 0;
    static #_crppPullGap = 3600000;
    static #_crppRepoUrl = 'https://gitcode.com/GuGuNiu/CowCooResPool.git';
    static #_crppJob = null;
    static ResPoolLock = new Metis('ResPool', getCore());

    static #emitProgress(onProgress, stage, percent, detail = '') {
        if (typeof onProgress === 'function') {
            try { onProgress({ stage, progress: percent, detail, timestamp: Date.now() }); } catch {}
        }
    }

    static get ResPoolDir() {
        return path.join(MiaoPluginMBT.Paths.YzPath, 'temp', 'CowCoo', 'Network', 'CowCooResPool');
    }

    static get ResPoolGitDir() {
        return path.join(this.ResPoolDir, '.git');
    }

    static get ResPoolLockPath() {
        return path.join(this.ResPoolGitDir, 'index.lock');
    }

    static hasResPoolLocal(targetDir = this.ResPoolDir) {
        const gitDir = path.join(targetDir, '.git');
        if (!fs.existsSync(gitDir)) return false;

        if (!['HEAD', 'config'].every(f => fs.existsSync(path.join(gitDir, f)))) return false;

        const indexLockPath = path.join(gitDir, 'index.lock');
        if (fs.existsSync(indexLockPath)) {
            try { fs.rmSync(indexLockPath, { force: true }); } catch {}
            if (fs.existsSync(indexLockPath)) return false;
        }

        return true;
    }

    static isResPoolBusy(targetDir = this.ResPoolDir) {
        const gitDir = path.join(targetDir, '.git');
        if (!fs.existsSync(gitDir)) return false;
        if (this.hasResPoolLocal(targetDir)) return false;

        return ['shallow.lock', 'index.lock'].some(m => fs.existsSync(path.join(gitDir, m)));
    }

    static warmupResPool(logger = console) {
        this.#queueResPool({ force: true, logger }).catch(err => {
            getHades(logger).D(`前置库预热失败: ${err.message}`);
        });
    }

    static async ensureCRPP(options = {}) {
        const { force = false, logger = console, useLocal = false, busyWaitMs = 30000, onProgress = null } = options;
        const targetDir = this.ResPoolDir;
        const Hades = getHades(logger);

        this.#emitProgress(onProgress, 'init', 0, '开始初始化前置库');
        if (this.isResPoolBusy(targetDir)) {
            this.#emitProgress(onProgress, 'wait', 5, '等待前置库释放占用');
            const startWait = Date.now();
            while (this.isResPoolBusy(targetDir) && Date.now() - startWait < busyWaitMs) {
                await new Promise(r => setTimeout(r, 500));
            }
            if (this.isResPoolBusy(targetDir)) {
                this.#emitProgress(onProgress, 'wait_timeout', 10, '等待超时，将强制清理');
            } else {
                this.#emitProgress(onProgress, 'wait_done', 10, '前置库已释放');
            }
        } else {
            this.#emitProgress(onProgress, 'check', 10, '前置库未被占用');
        }

        const hasLocal = this.hasResPoolLocal(targetDir);
        if (!force && hasLocal && Date.now() - this.#_crppLastPull < this.#_crppPullGap) {
            return targetDir;
        }

        if (useLocal && hasLocal && !force) {
            this.#queueResPool({ force, logger }).catch(() => {});
            return targetDir;
        }

        return await this.#queueResPool({ force, logger, onProgress });
    }

    static #File_Map = {
        Prompt: 'data/Prompt.json',
        proxyNodes: 'data/CA-MBT.json',
        uaPool: 'data/UAPool.json',
        voiceRepos: 'data/Voice_Repos.json'
    };

    static async readResPoolData(relativePath, options = {}) {
        const { logger = console, encoding = 'utf-8', busyWaitMs = 30000 } = options;
        try {
            const repoDir = await this.ensureCRPP({ force: false, useLocal: true, logger, busyWaitMs });
            if (!repoDir) return null;
            const filePath = path.join(repoDir, relativePath);
            if (!fs.existsSync(filePath)) return null;
            const content = await Ananke.readFile(filePath, encoding);
            return content;
        } catch (err) {
            return null;
        }
    }

    static getResPoolMapPath(key) {
        return this.#File_Map[key] ?? key;
    }

    static async getCRPPData(key, logger) {
        return this.readResPoolData(this.getResPoolMapPath(key), { logger });
    }

    static async getCRPPFontPath(logger = console) {
        try {
            const result = await this.ensureCRPP({ useLocal: true, logger });
            if (result) return toFileUrl(path.join(result, 'font/'));
            return '';
        } catch {
            return '';
        }
    }

    static #queueResPool(options = {}) {
        const { force = false, logger = console, timeout = 60000, onProgress = null } = options;

        if (this.#_crppJob) return this.#_crppJob;

        const job = Promise.race([
            this.syncResPool({ force, logger, onProgress }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('前置库同步超时')), timeout))
        ]).finally(() => {
            if (this.#_crppJob === originalJob) this.#_crppJob = null;
        });
        const originalJob = job;
        this.#_crppJob = job;
        return job;
    }

    static async syncResPool(options = {}) {
        const { force = false, logger = console, onProgress = null } = options;
        const Hades = getHades(logger);
        const targetDir = this.ResPoolDir;
        const gitDir = this.ResPoolGitDir;
        const lockPath = this.ResPoolLockPath;

        const dropDir = () => {
            if (!fs.existsSync(targetDir)) {
                return true;
            }
            for (let i = 0; i < 3; i++) {
                try {
                    fs.rmSync(targetDir, { recursive: true, force: true, maxRetries: 15, retryDelay: 500 });
                } catch {}
                if (!fs.existsSync(targetDir)) {
                    return true;
                }
            }
            return !fs.existsSync(targetDir);
        };

        const doClone = async (signal) => {
            this.#emitProgress(onProgress, 'clone_start', 20, '开始克隆前置库');
            const cloneProgress = (data) => {
                const str = data.toString();
                const match = str.match(/Receiving objects:\s+(\d+)%/);
                if (match) {
                    const percent = parseInt(match[1], 10);
                    const mappedProgress = 20 + Math.floor(percent * 0.6);
                    this.#emitProgress(onProgress, 'clone_progress', mappedProgress, `克隆中: ${percent}%`);
                }
            };
            await MBTPipeControl(
                'git',['clone', '--template=', '--depth=1', '--single-branch', '-b', 'master', this.#_crppRepoUrl, targetDir],
                { cwd: path.dirname(targetDir), Rid: 'CRPP', caDisabled: true, signal, gitConfigs: ['gc.auto=0'] },
                60000,
                null,
                cloneProgress,
                null,
                null,
                null
            );
            this.#emitProgress(onProgress, 'clone_done', 80, '克隆完成');
        };

        const isRepoComplete = () => ['HEAD', 'config'].every(f => fs.existsSync(path.join(gitDir, f)));

        const gitDirExists = fs.existsSync(gitDir);
        const repoComplete = gitDirExists && isRepoComplete();

        if (!gitDirExists || !repoComplete) {
            await Ananke.mkdirs(path.dirname(targetDir));
            try {
                await this.ResPoolLock.run(async (signal) => {
                    const gitNowComplete = fs.existsSync(path.join(targetDir, '.git')) && isRepoComplete();
                    if (gitNowComplete) {
                        return;
                    }
                    if (!dropDir()) {
                        throw new Error(`前置库目录清理失败: ${targetDir}`);
                    }
                    const clearLocks = () => {
                        ['index.lock', 'shallow.lock', 'HEAD.lock'].forEach(lock => {
                            const lp = path.join(gitDir, lock);
                            try { if (fs.existsSync(lp)) fs.rmSync(lp, { force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
                        });
                    };
                    clearLocks();
                    await doClone(signal);
                }, { id: 'CRPP:Clone', ttl: 70000, wait: 0 });
                this.#_crppLastPull = Date.now();
                return targetDir;
            } catch {
                return null;
            }
        }

        if (!force && Date.now() - this.#_crppLastPull < this.#_crppPullGap) {
            return targetDir;
        }

        this.#emitProgress(onProgress, 'update_start', 20, '开始更新前置库');
        try {
            await this.ResPoolLock.run(async (signal) => {
                this.#emitProgress(onProgress, 'update_lock', 25, '获取更新锁');
                const clrLock = () => [lockPath, path.join(gitDir, 'HEAD.lock')].every(lp => {
                    try { if (fs.existsSync(lp)) fs.rmSync(lp, { force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
                    return !fs.existsSync(lp);
                });

                if (!clrLock()) {
                    throw new Error("前置库索引锁残留无法清除");
                }

                const syncByReset = async () => {
                    this.#emitProgress(onProgress, 'update_fetch', 40, '获取远程更新');
                    if (!clrLock()) throw new Error("重置前无法清除锁文件");
                    await MBTPipeControl('git', ['fetch', 'origin'], { cwd: targetDir, Rid: 'CRPP', caDisabled: true, signal, gitConfigs: ['gc.auto=0'] }, 30_000);
                    this.#emitProgress(onProgress, 'update_reset', 60, '重置到最新版本');
                    await MBTPipeControl('git', ['reset', '--hard', 'origin/master'], { cwd: targetDir, Rid: 'CRPP', caDisabled: true, signal, gitConfigs: ['gc.auto=0'] }, 10000);
                };

                try {
                    this.#emitProgress(onProgress, 'update_pull', 50, '尝试拉取更新');
                    await MBTPipeControl('git', ['pull', 'origin', 'master', '--ff-only'], { cwd: targetDir, Rid: 'CRPP', caDisabled: true, signal, gitConfigs: ['gc.auto=0'] }, 30_000);
                    this.#emitProgress(onProgress, 'update_done', 80, '更新完成');
                } catch {
                    this.#emitProgress(onProgress, 'update_fallback', 55, '拉取失败');
                    await syncByReset();
                    this.#emitProgress(onProgress, 'update_done', 80, '强制重置完成');
                }
            }, { id: 'CRPP:Pull', ttl: 60000, wait: 0 });
            this.#_crppLastPull = Date.now();
        } catch {
            this.#emitProgress(onProgress, 'degraded', 80, '拉取失败');
        }
        this.#emitProgress(onProgress, 'complete', 100, '前置库准备完成');
        return targetDir;
    }
}

class Tianshu {
    static async NormalizeName(inputName, options = {}) {
        const raw = inputName?.trim();
        if (!raw) return { mainName: null, exists: false };

        if (!MiaoPluginMBT._AliasData) await MiaoPluginMBT.MetaHub.AC(false);
        if (this._aliasReverseIndex.size === 0) this.BuildAliasIndex(MiaoPluginMBT._AliasData);

        const q = this._norNm(raw);
        if (!q) return { mainName: raw, exists: false };

        const { gameKey = null } = options;
        const gkList = gameKey ? [gameKey] : this._gkOrd;

        if (gameKey) {
            const gm = this._aliasGameIndex.get(gameKey);
            if (gm?.has(q)) return { mainName: gm.get(q), exists: true };
        } else if (this._aliasReverseIndex.has(q)) {
            return { mainName: this._aliasReverseIndex.get(q), exists: true };
        }

        const best = this._pickNm(q, gkList);
        if (best && best.sc >= this._minSc(q)) {
            return { mainName: best.mn, exists: true, gameKey: best.gk };
        }

        return { mainName: raw, exists: false };
    }

    static _gkOrd = ['gs', 'sr', 'waves', 'zzz'];
    static _gkSrc = Object.freeze({
        gs: 'GSAlias',
        sr: 'SRAlias',
        waves: 'WavesAlias',
        zzz: 'ZZZAlias'
    });

    static _norNm(v) {
        return String(v || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_\-.·・'":`~!?,/\\()[\]{}]/g, '');
    }

    static _mkTermList(mainName, aliases) {
        const set = new Set();
        const push = (v) => { const t = this._norNm(v); if (t) set.add(t); };
        push(mainName);
        [...(Array.isArray(aliases) ? aliases : String(aliases ?? '').split(','))].forEach(push);
        return [...set];
    }

    static _seqHit(a, b) {
        let ai = 0;
        let cnt = 0;
        for (let bi = 0; bi < b.length && ai < a.length; bi++) {
            if (a[ai] === b[bi]) {
                ai++;
                cnt++;
            }
        }
        return cnt;
    }

    static _blkHit(a, b) {
        if (!a || !b) return 0;
        const dp = Array(b.length + 1).fill(0);
        let best = 0;
        for (let i = 1; i <= a.length; i++) {
            for (let j = b.length; j >= 1; j--) {
                if (a[i - 1] === b[j - 1]) {
                    dp[j] = dp[j - 1] + 1;
                    if (dp[j] > best) best = dp[j];
                } else {
                    dp[j] = 0;
                }
            }
        }
        return best;
    }

    static _dpCost(a, b) {
        const al = a.length;
        const bl = b.length;
        if (!al || !bl) return Math.max(al, bl) * 3.2;
        let prev = Array(bl + 1).fill(0);
        let curr = Array(bl + 1).fill(0);
        for (let j = 0; j <= bl; j++) prev[j] = j * 2.8;
        for (let i = 1; i <= al; i++) {
            curr[0] = i * 2.8;
            for (let j = 1; j <= bl; j++) {
                const hd = (i <= 2 || j <= 2) ? 1.4 : 1;
                const tl = (i >= al - 1 || j >= bl - 1) ? 1.15 : 1;
                const wt = hd * tl;
                const same = a[i - 1] === b[j - 1];
                const sub = same ? 0 : 3.6 * wt;
                curr[j] = Math.min(
                    prev[j] + 2.7 * wt,
                    curr[j - 1] + 2.7 * wt,
                    prev[j - 1] + sub
                );
            }
            [prev, curr] = [curr, prev];
        }
        return prev[bl];
    }

    static _calcSc(q, t) {
        if (!q || !t) return 0;
        if (q === t) return 999;
        const minLen = Math.min(q.length, t.length);
        const maxLen = Math.max(q.length, t.length);
        if (minLen / maxLen < 0.34) return 0;

        let sc = 0;
        const gap = maxLen - minLen;
        if (t.includes(q) || q.includes(t)) sc += 54 - gap * 4;
        if (t.startsWith(q) || q.startsWith(t)) sc += 22;
        if (t.endsWith(q) || q.endsWith(t)) sc += 12;
        if (q[0] === t[0]) sc += 9;
        if (q[q.length - 1] === t[t.length - 1]) sc += 6;

        const seq = Math.max(this._seqHit(q, t), this._seqHit(t, q));
        const blk = this._blkHit(q, t);
        sc += Math.floor((seq / minLen) * 20);
        sc += Math.floor((blk / minLen) * 28);

        const dp = this._dpCost(q, t);
        sc += Math.max(0, 92 - (dp * 8 / Math.max(1, maxLen)));

        if (gap > 2) sc -= gap * 4;
        if (minLen <= 2 && q[0] !== t[0]) sc -= 24;
        return sc;
    }

    static _minSc(q) {
        const len = q.length;
        if (len <= 2) return 118;
        if (len === 3) return 108;
        if (len <= 5) return 99;
        return 93;
    }

    static _pickNm(q, gkList) {
        let best = null;
        for (const gk of gkList) {
            const rows = this._aliasGameList.get(gk) || [];
            for (const row of rows) {
                let top = 0;
                for (const term of row.terms) {
                    if (term === q) return { mn: row.mn, sc: 999, gk };
                    const sc = this._calcSc(q, term);
                    if (sc > top) top = sc;
                }
                if (!best || top > best.sc) best = { mn: row.mn, sc: top, gk };
            }
        }
        return best;
    }

    static async ResolveGitNode(repoPath) {
        const configPath = path.join(repoPath, ".git", "config");
        const content = await Ananke.readFile(configPath, "utf-8");
        if (!content) return "未知";
        const urlMatch = content.match(/\[remote\s+"origin"\][^\[]*url\s*=\s*([^\n]+)/);
        const remoteUrl = urlMatch?.[1]?.trim();
        if (!remoteUrl) return "未知";
        const matchedProxy = DFC.F2Pool.find(p => p.ClonePrefix && remoteUrl.startsWith(p.ClonePrefix));
        if (matchedProxy) return matchedProxy.name;
        return remoteUrl.includes("github.com") ? "GitHub" : "未知";
    }

    static async ResolveFace(gameKey, CREName) {
        if (gameKey !== 'gs' && gameKey !== 'sr') return null;
        const baseDir = MiaoPluginMBT.Paths.Target[gameKey === 'gs' ? 'Miao_GSAliasDir' : 'Miao_SRAliasDir'];
        const imgDir = path.join(baseDir, "..", "character", CREName, "imgs");
        const probe = async p => await Ananke.Audit(p, false) ? p : null;
        const validPath = await probe(path.join(imgDir, "face2.webp"))
                       || await probe(path.join(imgDir, "face.webp"));
        return validPath ? toFileUrl(validPath) : null;
    }

    static async ScanSplashes(sourceDir) {
        if (!sourceDir) return [];

        try {
            const charDirs = (await Ananke.readDir(sourceDir)).filter(d => d.isDirectory());
            const results = await this.parallel(charDirs, async (charDir) => {
                const CREName = charDir.name;
                const imgsPath = path.join(sourceDir, CREName, 'imgs');
                try {
                    return (await Ananke.readDir(imgsPath))
                        .filter(e => e.name.toLowerCase().startsWith('splash') && e.name.toLowerCase().endsWith('.webp'))
                        .map(e => ({ src: path.join(imgsPath, e.name), CREName, fileName: e.name }));
                } catch { return []; }
            }, 10);

            return results.flat();
        } catch { return []; }
    }

    static async FindZZZIcon(charName) {
        const context = await Nomos.getContext();
        if (!context.zIn) return null;
        const cleanName = String(charName || '').trim();
        if (!cleanName) return null;

        const dataDir = MiaoPluginMBT.Paths?.Target?.ZZZ_DataDir;
        const faceDir = MiaoPluginMBT.Paths?.Target?.ZZZ_FaceDir;
        if (!dataDir || !faceDir) return null;

        try {
            const entries = await Ananke.readDir(dataDir);
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
                let data = null;
                try {
                    const raw = await Ananke.readFile(path.join(dataDir, entry.name), 'utf-8');
                    data = raw ? JSON.parse(raw) : null;
                } catch { }
                if (!data) continue;

                if (data.Name !== cleanName && data.CodeName !== cleanName) continue;

                const iconMatch = String(data.Icon || '').match(/\d+$/);
                if (!iconMatch) return null;

                const iconPath = path.join(faceDir, `IconRoleCircle${iconMatch[0]}.png`);
                if (await Ananke.Audit(iconPath, false)) {
                    return toFileUrl(iconPath);
                }
                return null;
            }
        } catch { }
        return null;
    }

    static _indexByGid = new Map();
    static _indexByCRE = new Map();
    static _indexByTag = new Map();
    static _aliasReverseIndex = new Map();
    static _aliasGameIndex = new Map();
    static _aliasGameList = new Map();

    static BuildIndexes(imageData) {
        this._indexByGid.clear();
        this._indexByCRE.clear();
        this._indexByTag.clear();

        for (const item of imageData) {
          if (!item?.path) continue;
          const gid = toPosix(item.path);

          this._indexByGid.set(gid, item);

          if (item.CREName) {
            const arr = this._indexByCRE.get(item.CREName) ?? this._indexByCRE.set(item.CREName, []).get(item.CREName);
            arr.push(item);
          }

          if (item.attributes) {
            for (const tag of Object.values(Valid_Tags)) {
              const attrVal = item.attributes[tag.key];
              if ((Array.isArray(attrVal) ? attrVal.includes(tag.value) : attrVal === tag.value)) {
                const tagName = tag.key === 'other' ? tag.value : tag.key;
                const tArr = this._indexByTag.get(tagName) ?? this._indexByTag.set(tagName, []).get(tagName);
                tArr.push(item);
              }
            }
          }
        }
    }

    static BuildAliasIndex(aliasData) {
        if (this._aliasReverseIndex.size > 0) return;
        const exact = new Map();
        const gmIdx = new Map();
        const gmList = new Map();

        for (const gk of this._gkOrd) {
          const src = aliasData?.[this._gkSrc[gk]] || {};
          const em = new Map();
          const rows = [];
          for (const [mainName, aliases] of Object.entries(src)) {
            const terms = this._mkTermList(mainName, aliases);
            if (terms.length === 0) continue;
            rows.push({ mn: mainName, terms });
            for (const term of terms) {
              em.has(term) || em.set(term, mainName);
              exact.has(term) || exact.set(term, mainName);
            }
          }
          gmIdx.set(gk, em);
          gmList.set(gk, rows);
        }
        this._aliasReverseIndex = exact;
        this._aliasGameIndex = gmIdx;
        this._aliasGameList = gmList;
    }

    static ResetAliasIndex() {
        this._aliasReverseIndex = new Map();
        this._aliasGameIndex = new Map();
        this._aliasGameList = new Map();
    }

    static ParseID(identifier) {
        if (!identifier) return null;
        const match = identifier.trim().match(/^(.*?)(?:Gu)?(\d+)$/i);
        if (match && match[1] && match[2]) { const mainName = match[1].trim(); if (mainName) return { mainName: mainName, imgNum: match[2] }; }
        return null;
    }

    static async FsQuery(relativePath) {
        if (!relativePath) return null;
        const normalizedPath = toPosix(relativePath);

        const imgData = this._indexByGid.get(normalizedPath);
        const context = await Nomos.getContext();

        const preferredPath = imgData?.storagebox
            ? Nomos.PathKey(imgData.storagebox, MiaoPluginMBT.Paths)
            : null;

        if (preferredPath) {
            const absPath = path.join(preferredPath, normalizedPath);
            if (await Ananke.Audit(absPath, false)) {
                return absPath;
            }
        }

        const ReliefScope = Nomos.ReliefScope(
            imgData?.storagebox,
            MiaoPluginMBT.Paths,
            MiaoPluginMBT.MBTConfig,
            context
        );

        for (const repo of ReliefScope) {
            if (repo.path === preferredPath) continue;
            const absPath = path.join(repo.path, normalizedPath);
            if (await Ananke.Audit(absPath, false)) {
                return absPath;
            }
        }
        return null;
    }

    static async UpdateStats(logger = getCore()) {
         const Hades = getHades(logger);
         const context = await Nomos.getContext();
         const config = await Ananke.loadingConfig(MiaoPluginMBT.Paths.ConfigFilePath, MiaoPluginMBT.MBTConfig);
         const repos = Nomos.ModuleRepoAC(MiaoPluginMBT.Paths, config, context);
         const timestamp = new Date().toISOString();

         const results = await Promise.all(repos.map(async (repo) => {
             if (!repo.path) return [repo.num, {}];

             const gitStatus = await Nomos.getRepoStatus(repo.path);

             let fsCounts = { roles: 0, images: 0 };
            try {
                const worker = new MBTWorker(Hades);
                try {
                    const repoStats = await worker.run('SCAN_STATS', { repos: [{ name: repo.name, path: repo.path }], _dirNames: Nomos.DirNames });
                    for (const gameStats of Object.values(repoStats[repo.name]?.games || {})) {
                        fsCounts.roles += gameStats.roles;
                        fsCounts.images += gameStats.images;
                    }
                } finally { worker.terminate(); }
            } catch {}

             const size = await Ananke.measure(repo.path);
             const gitSize = await Ananke.measure(repo.gitPath);
             const nodeName = await Tianshu.ResolveGitNode(repo.path);

             return [repo.num, {
                 ...fsCounts,
                 size,
                 gitSize,
                 filesSize: Math.max(0, size - gitSize),
                 ...gitStatus,
                 lastUpdate: gitStatus.sha,
                 nodeName,
                 timestamp
             }];
         }));

         const statsCache = {
             lastUpdated: timestamp,
             ...Object.fromEntries(results)
         };
         await Ananke.writeText(MiaoPluginMBT.Paths.RTCPath, JSON.stringify(statsCache, null, 2))
             .catch(err => Hades.E(`索引写入仓库统计缓存失败:`, err));
    }

    static GetStrategy(gameKey) {
        const meta = Nomos.Universe[gameKey];
        if (!meta) return null;

        return {
            name: meta.name,
            folder: meta.dirName,
            resolveElem: async (charName) => {
                try {
                    if (gameKey === 'zzz') return { key: 'unknown', label: '未知' };
                    if (gameKey === 'waves') {
                        const role = MiaoPluginMBT._wavesRoleDataMap?.get(charName);
                        const raw = role?.elem || 'unknown';
                        return { key: meta.elemMap[raw] || raw, label: raw };
                    }

                    const dataPath = path.join(MiaoPluginMBT.Paths.Target[gameKey === 'gs' ? 'Miao_GSAliasDir' : 'Miao_SRAliasDir'], charName, 'data.json');
                    const data = await Ananke.HydrateJson(dataPath);
                    const raw = data?.elem || 'unknown';

                    if (gameKey === 'sr') {
                        const srMap = {
                            Fire: 'fire', 火: 'fire',
                            Ice: 'ice', 冰: 'ice',
                            Wind: 'wind', 风: 'wind',
                            Lightning: 'elec', 雷: 'elec',
                            Physical: 'phy', 物理: 'phy',
                            Quantum: 'quantum', 量子: 'quantum',
                            Imaginary: 'imaginary', 虚数: 'imaginary'
                        };
                        const key = srMap[raw] || meta.elemMap[raw] || 'unknown';
                        return { key, label: meta.elemMap[key] || raw };
                    }

                    return { key: raw, label: meta.elemMap[raw] || raw };
                } catch {
                    return { key: 'unknown', label: '未知' };
                }
            },
            resolveIcon: async (charName) => {
                if (gameKey === 'gs' || gameKey === 'sr') return Tianshu.ResolveFace(gameKey, charName);
                if (gameKey === 'waves') return MiaoPluginMBT._wavesRoleDataMap?.get(charName)?.icon || null;
                return null;
            },
            resolveBanner: async (elemKey) => {
                if (gameKey === 'gs') {
                    const p = path.join(MiaoPluginMBT.Paths.Target.Miao_GSAliasDir, "旅行者", elemKey, "imgs", "banner.webp");
                    return `file://${p.replace(/\\/g, '/')}`;
                }
                return null;
            },
            getSortKeys: () => meta.sortOrders
        };
    }

    static async Dashboard(index) {
        const universe = Nomos.Universe;
        const GameData = {};
        const gameKeyMapping = {};

        for (const [key, meta] of Object.entries(universe)) {
            GameData[key] = { name: meta.name, elements: new Set(), exists: false };
            gameKeyMapping[meta.dirName] = key;
        }

        for (const [charName, images] of index.entries()) {
            const storageType = images[0]?.storagebox_type;
            const gameKey = storageType ? gameKeyMapping[storageType] : null;

            if (!gameKey || !GameData[gameKey]) continue;

            GameData[gameKey].exists = true;

            const strategy = this.GetStrategy(gameKey);
            if (strategy) {
                const { key, label } = await strategy.resolveElem(charName);
                if (key !== 'unknown' && key !== 'multi') {
                    GameData[gameKey].elements.add(label);
                }
            }
        }

        const stats = {};
        for (const [key, data] of Object.entries(GameData)) {
            if (data.exists) {
                stats[key] = {
                    name: data.name,
                    elements: Array.from(data.elements).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
                };
            }
        }
        return stats;
    }

    static async Search(inputMsg) {
        const msg = inputMsg.trim();
        if (!msg) {
            const stats = await this.Dashboard(Tianshu._indexByCRE);
            return { type: 'dashboard', stats };
        }

        const parts = msg.split(/\s+/).filter(Boolean);
        const inputName = parts[0];
        const secInput = parts[1] || null;
        const lowerInput = inputName.toLowerCase();

        if (Valid_Tags[lowerInput]) {
            const tagKey = Valid_Tags[lowerInput].key;
            const items = Tianshu._indexByTag.get(tagKey) || [];
            return { type: 'tag', title: `[${inputName.toUpperCase()}] 标签图库`, items };
        }

        if (MiaoPluginMBT._SecTagsCache.includes(inputName)) {
            const items = MiaoPluginMBT._MetaCache.filter(item => item.attributes?.SecTags?.includes(inputName));
            return { type: 'tag', title: `[${inputName}] 标签图库`, items };
        }

        const gameMeta = Nomos.MatchGame(inputName);
        if (gameMeta) {
            if (!secInput && (gameMeta.key === 'gs' || gameMeta.key === 'sr')) {
                 const stats = await this.Dashboard(Tianshu._indexByCRE);
                 return { type: 'dashboard', stats };
            }

            if (gameMeta.pluginPath && !(await Ananke.Audit(gameMeta.pluginPath))) return null;

            const strategy = this.GetStrategy(gameMeta.key);
            const context = await Nomos.getContext();
            const ScanQueue = Nomos.ScanQueue(MiaoPluginMBT.Paths, MiaoPluginMBT.MBTConfig, context);
            const charSet = new Set();

            for (const repo of ScanQueue) {
                if (!(await Ananke.Audit(repo.gitPath))) continue;
                const repoGamePath = path.join(repo.path, gameMeta.dirName);
                try {
                    const dirs = await Ananke.readDir(repoGamePath);
                    for (const dir of dirs) { if (dir.isDirectory()) charSet.add(dir.name); }
                } catch { }
            }

            let targetChars = Array.from(charSet);
            let title = `『${gameMeta.name}』全角色`;

            if (secInput && strategy) {
                title = `『${gameMeta.name}』【${secInput}】属性`;
                const filtered = [];
                for (const char of targetChars) {
                    const { label } = await strategy.resolveElem(char);
                    if (label === secInput) filtered.push(char);
                }
                targetChars = filtered;
            }

            if (targetChars.length === 0) return { type: 'empty', msg: `未找到 ${title} 的角色` };
            return { type: 'game_group', title, items: targetChars.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')), gameKey: gameMeta.key };
        }

        const aliasRes = await this.NormalizeName(inputName);
        const primaryName = aliasRes.exists ? aliasRes.mainName : inputName;
        const items = Tianshu._indexByCRE.get(primaryName) || [];

        if (items.length > 0) {
            const storageType = items[0].storagebox_type;
            let gameKey = null;
            for (const [key, meta] of Object.entries(Nomos.Universe)) {
                if (storageType === meta.dirName) { gameKey = key; break; }
            }

            if (gameKey) {
                const meta = Nomos.Universe[gameKey];
                if (meta?.pluginPath && !(await Ananke.Audit(meta.pluginPath))) return null;
            }

            return { type: 'character', title: `『${primaryName}』图库详情`, items, primaryName, gameKey };
        }

        return { type: 'empty', msg: `图库中未找到『${inputName}』` };
    }
}

class Presenter {
    static async _resolveZZZTitleFaceUrl(primaryName) {
        try {
            const entries = await Ananke.readDir(MiaoPluginMBT.Paths.Target.ZZZ_DataDir);
            for (const entry of entries) {
                if (entry.name.endsWith('.json')) {
                    const data = JSON.parse(await Ananke.readFile(path.join(MiaoPluginMBT.Paths.Target.ZZZ_DataDir, entry.name), 'utf-8') || '{}');
                    if (data.Name === primaryName || data.CodeName === primaryName) {
                        const iconMatch = data.Icon?.match(/\d+$/);
                        if (iconMatch) {
                            const zzzFacePath = path.join(MiaoPluginMBT.Paths.Target.ZZZ_FaceDir, `IconRoleCircle${iconMatch[0]}.png`);
                            return toFileUrl(zzzFacePath);
                        }
                        break;
                    }
                }
            }
        } catch { }
        return null;
    }

    static async RenderDashboard(e, stats) {
        const Hades = getHades(e?.logger);
        const ViewProps = {
            gameData: stats,
            tags: Object.keys(Valid_Tags).sort(),
            secTags: MiaoPluginMBT._SecTagsCache,
        };

        const imgBuffer = await Morpheus.shot("Search", {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "search_helper.html"),
            data: ViewProps,
            logger: Hades
        });

        if (imgBuffer) await Pheme.img(e, imgBuffer, '查询面板图片发送失败，已切换文本模式。', Hades);
        else await Pheme.genFail(e, 'search');
        return true;
    }

    static async _PaginateFM(e, data) {
        const Hades = getHades(e?.logger);
        const cerberus = Cerberus.getInstance();

        if (data.type === 'tag') {
            const filteredImg = Array.isArray(data.items) ? data.items : [];
            if (filteredImg.length === 0) return Pheme.emptyResult(e, 'tag', data.title);

            const isOneBot = MBTAdapterEnv.isOneBotFamily(e);
            const Items_Per_Batch = isOneBot ? 8 : 28;
            const sleepInterval = isOneBot ? 2000 : 1000;
            const itemCount = filteredImg.length;
            const pageCount = Math.ceil(itemCount / Items_Per_Batch);
            let waitMsg = `收到！正在查找 ${data.title} 的图片，共 ${itemCount} 张...`;
            if (pageCount > 1) waitMsg = `${data.title} (共 ${itemCount} 张)，将分 ${pageCount} 批发送，请稍候...`;
            await Pheme.wait(e, waitMsg);

            for (let batchNum = 1; batchNum <= pageCount; batchNum++) {
                await cerberus.breath(batchNum);
                const startIndex = (batchNum - 1) * Items_Per_Batch;
                const activeBatch = filteredImg.slice(startIndex, startIndex + Items_Per_Batch);
                const makeForwardMsgTitle = `${data.title} (${batchNum}/${pageCount})`;
                const forwardList = [];
                const firstNodeText = batchNum === 1
                    ? `${data.title} (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)`
                    : `${data.title}(续) (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)`;
                forwardList.push(firstNodeText);

                for (const item of activeBatch) {
                    const relativePath = toPosix(item.path);
                    const fileName = path.basename(relativePath);
                    const absolutePath = await MiaoPluginMBT.FsQuery(relativePath);
                    const MsgNode = [];
                    if (absolutePath) {
                        const imgSeg = MiaoPluginMBT.ToImgSeg(absolutePath, {
                            audit: true,
                            fallbackText: `[图片无法加载: ${fileName}]`
                        });
                        if (imgSeg) MsgNode.push(imgSeg);
                    } else {
                        MsgNode.push(`[图片文件丢失: ${fileName}]`);
                    }
                    MsgNode.push(`${item.CREName} - ${fileName}`);
                    forwardList.push(MsgNode);
                }

                if (forwardList.length > 1) {
                    const ok = await Pheme.forward(e, forwardList, makeForwardMsgTitle);
                    if (!ok) {
                        for (const node of forwardList) {
                            const imgSegs = Array.isArray(node)
                                ? node.filter(n => n?.type === 'image')
                                : (node?.type === 'image' ? [node] : []);
                            for (const seg of imgSegs) {
                                await Pheme.send(e, seg);
                                await common.sleep(500);
                            }
                        }
                    }
                    await common.sleep(sleepInterval);
                }
            }
            return true;
        }

        if (data.type === 'character') {
            const primaryName = data.primaryName;
            const RawRoleMeta = Array.isArray(data.items) ? data.items : [];
            if (RawRoleMeta.length === 0) return Pheme.emptyResult(e, 'character', primaryName);

            const isOneBot = MBTAdapterEnv.isOneBotFamily(e);
            const Items_Per_Batch = isOneBot ? 8 : 28;
            const sleepInterval = isOneBot ? 2000 : 1000;
            const itemCount = RawRoleMeta.length;
            const pageCount = Math.ceil(itemCount / Items_Per_Batch);
            let waitMsg = `正在为『${primaryName}』整理 ${itemCount} 张图片...`;
            if (pageCount > 1) waitMsg = `正在为『${primaryName}』整理 ${itemCount} 张图片，将分 ${pageCount} 批发送，请稍候...`;
            await Pheme.wait(e, waitMsg);

            for (let batchNum = 1; batchNum <= pageCount; batchNum++) {
                await cerberus.breath(batchNum);
                const startIndex = (batchNum - 1) * Items_Per_Batch;
                const activeBatch = RawRoleMeta.slice(startIndex, startIndex + Items_Per_Batch);

                const titleFaceUrl = data.gameKey === 'zzz'
                    ? await this._resolveZZZTitleFaceUrl(primaryName)
                    : null;

                let titleSeg = null;
                if (titleFaceUrl) {
                    if (titleFaceUrl.startsWith('http://') || titleFaceUrl.startsWith('https://') || titleFaceUrl.startsWith('base64://')) {
                        titleSeg = segment.image(titleFaceUrl);
                    } else {
                        try {
                            const titlePath = titleFaceUrl.replace(/^file:\/\//, '');
                            const titleBuffer = fs.readFileSync(titlePath);
                            titleSeg = segment.image(toBase64Url(titleBuffer));
                        } catch {
                            titleSeg = segment.image(titleFaceUrl);
                        }
                    }
                }
                const makeForwardMsgTitle = titleSeg
                    ? [titleSeg, ` [${primaryName}] 图库详情 (${batchNum}/${pageCount})`]
                    : `[${primaryName}] 图库详情 (${batchNum}/${pageCount})`;

                const forwardList = [];
                const firstNodeText = batchNum === 1
                    ? `查看『${primaryName}』 (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)\n想导出图片？试试: #咕咕牛导出${primaryName}1`
                    : `查看『${primaryName}』(续) (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)`;
                forwardList.push(firstNodeText);

                for (let i = 0; i < activeBatch.length; i++) {
                    const item = activeBatch[i];
                    const itemGlobalIndex = startIndex + i + 1;
                    const relativePath = toPosix(item.path);
                    const fileName = path.basename(relativePath);
                    const absolutePath = await MiaoPluginMBT.FsQuery(relativePath);
                    const MsgNode = [];
                    if (absolutePath) {
                        const imgSeg = MiaoPluginMBT.ToImgSeg(absolutePath, {
                            audit: true,
                            fallbackText: `[图片无法加载: ${fileName}]`
                        });
                        if (imgSeg) MsgNode.push(imgSeg);
                    } else {
                        MsgNode.push(`[图片文件丢失: ${fileName}]`);
                    }

                    const textInfoLines = [];
                    textInfoLines.push(`${itemGlobalIndex}. ${fileName}`);
                    const Tags = [];
                    if (item.attributes?.rated === "r18") Tags.push("R18");
                    if (item.attributes?.rated === "p18") Tags.push("P18");
                    const other = item.attributes?.other || [];
                    if (other.includes("LLMCanvas")) Tags.push("Ai");
                    if (other.includes("Egg")) Tags.push("彩蛋");
                    if (Tags.length > 0) textInfoLines.push(`Tag：${Tags.join(" / ")}`);

                    let fileSizeFormatted = "";
                    if (absolutePath) {
                        try {
                            const stats = await Ananke.stat(absolutePath);
                            if (stats) fileSizeFormatted = await Ananke.measure(stats.size, true);
                        } catch { }
                    }
                    if (fileSizeFormatted) textInfoLines.push(`占用：${fileSizeFormatted}`);

                    const constraints = [];
                    const isUserBanned = MiaoPluginMBT._userBanSet.has(relativePath);
                    const isPurified = await MiaoPluginMBT.QueryBanState(relativePath, Hades);
                    if (isUserBanned) constraints.push("❌封禁");
                    if (isPurified && !isUserBanned) constraints.push("🌱净化");
                    if (constraints.length > 0) textInfoLines.push(`约束:  ${constraints.join("     ")}`);

                    MsgNode.push(textInfoLines.join("\n"));
                    forwardList.push(MsgNode);
                }

                if (forwardList.length > 1) {
                    const ok = await Pheme.forward(e, forwardList, makeForwardMsgTitle);
                    if (!ok) {
                        for (const node of forwardList) {
                            const imgSegs = Array.isArray(node)
                                ? node.filter(n => n?.type === 'image')
                                : (node?.type === 'image' ? [node] : []);
                            for (const seg of imgSegs) {
                                await Pheme.send(e, seg);
                                await common.sleep(500);
                            }
                        }
                    }
                    await common.sleep(sleepInterval);
                }
            }

            return true;
        }

        return true;
    }
}

class DocHub {
    static async report(e, opName, err, ctx = "", logger = getCore(), source = 'Stdin') {
        const baseCtx = e ? [
            (e.raw_message || e.msg) && `触发命令: ${e.raw_message || e.msg}`,
            e.user_id && `发送者: ${e.user_id}`,
            e.group_id && `群组: ${e.group_id}`
        ].filter(Boolean).join(" | ") : "";
        ctx = baseCtx ? (ctx ? `${baseCtx}\n附加信息: ${ctx}` : baseCtx) : ctx;

        const Hades = HadesEntry({}, logger?.error ? logger : getCore());
        const errCode = err?.code || '未知';
        if (!ErrDoc.shouldReport(opName, errCode)) {
            Hades.D(`拦截重复报告: [${opName}] ${err?.message}`);
            return;
        }

        Hades.E(`[${opName}] 失败:`, err?.message, err?.stack ? `\nStack in report.` : "");

        const diagnosis = this._diagnose(opName, err, ctx);
        const aiSolution = await this._consultOracle(opName, err, diagnosis.contextInfo, Hades)
            .catch(() => (Hades.D(`  AI服务不可用`), "云露分析服务暂时不可用。"));

        const isStressed = ErrDoc.isSystemStressed();
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
                const tplResult = await Nomos.getTemplate('error_report.html', source);

                if (tplResult.success) {
                    const OpsName = (e?.msg?.startsWith('#') && !opName.startsWith('#')) ? `#${opName}` : opName;
                    const ViewProps = {
                        operationName: OpsName,
                        errMsg: err.message || "Unknown Error",
                        errCode: errCode,
                        errorSource: this._extractErrSource(err),
                        errType: this._extractErrType(err),
                        contextInfo: diagnosis.contextInfo,
                        suggestions: diagnosis.suggestions.split('\n'),
                        aiSolutionText: aiSolution,
                        stackTrace: diagnosis.stack ? diagnosis.stack.substring(0, 1200) : null,
                        snapshot: snap,
                        error: err,
                        timestamp: new Date().toLocaleString()
                    };

                    imgBuffer = await Morpheus.shot("Error-Report", {
                        htmlContent: tplResult.data,
                        data: ViewProps,
                        logger: Hades
                    });
                }
            } catch (renderErr) {
                Hades.E(`报告渲染失败:`, renderErr);
                imgBuffer = null;
            }
        } else {
            Hades.D(`系统高负载`);
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

    static _diagnose(opName, err, ctx = "") {
        const report = {
            summary: `操作 [${opName}] 失败了！`,
            contextInfo: ctx || "（无额外上下文信息）",
            suggestions: "",
            stack: err?.stack || "（调用栈信息丢失）",
        };

        if (err?.message) report.summary += `\n错误信息: ${err.message}`;
        if (err?.code) report.summary += ` (Code: ${err.code})`;

        const type = ErrDoc.diagnose(err);
        const suggs = ErrDoc.getSuggestions(type);

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

    static _extractErrSource(err) {
        const line = err?.stack?.split('\n').find(l => l.trim().startsWith('at '));
        return line?.match(/:(\d+):\d+\)?$/)?.[1] ?? null;
    }

    static _extractErrType(err) {
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

    static async _consultOracle(operationName, error, context, logger) {
        const Hades = getHades(logger);

        const config = await Nomos.getOracleConfig(Hades);
        if (!config?.ai_config) {
            return "云露分析中断：无法加载AI配置。";
        }

        const { api, model, prompt: promptConfig } = config.ai_config;

        const magicWord = (() => {
            if (!api.key_encrypted) return '';
            try { return Buffer.from(api.key_encrypted, 'base64').toString('utf8') }
            catch { return null }
        })();
        if (magicWord === null) return "云露分析失败：API密钥解析异常。";
        if (!magicWord) return "云露分析失败：API服务配置缺失。";

        if (!promptConfig?.system) return "云露分析中断：无法同步诊断方案。";

        const prompt = promptConfig.system
            .replace('${operationName}', operationName)
            .replace("${error.message || 'N/A'}", error.message ?? 'N/A')
            .replace("${error.code || 'N/A'}", error.code ?? 'N/A')
            .replace("${context || '无'}", context || '无');

        const requestBody = {
            model: model.name,
            messages: [{ role: "user", content: prompt }],
            stream: model.stream,
            max_tokens: model.max_tokens,
            temperature: model.temperature,
            top_p: model.top_p,
            stop: promptConfig.stop_words,
            tools: [{ type: "web_search", web_search: promptConfig.tools.web_search }]
        };

        const maxRetries = api.max_retries;
        let retryCount = 0;

        while (retryCount <= maxRetries) {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), api.timeout_ms);

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
                    const errorBody = await response.text();
                    if (response.status === 429 || response.status >= 500 || response.status === 408) {
                        Hades.D(`  API重试(${response.status}) ${retryCount + 1}/${maxRetries}`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, api.retry_delay_ms * retryCount));
                        continue;
                    } else {
                        throw new Error(`API请求失败 (HTTP ${response.status})`);
                    }
                }

                const responseData = await response.json();

                if (responseData.error || responseData.code !== 0) {
                    const errMsg = responseData.error?.message || responseData.message || '未知API错误';
                    const errCode = responseData.error?.code || responseData.code;
                    if (errCode === 11200) return "云露分析失败：API授权凭证无效或已过期。";
                    return `云露分析异常：API返回错误 (${errMsg})。`;
                }

                let aiContent = responseData.choices?.[0]?.message?.content;

                if (typeof aiContent === 'string' && aiContent.trim() !== '') {
                    return aiContent;
                } else {
                    return "云露分析异常：API成功响应，但未返回有效内容。";
                }

            } catch (aiError) {
                if (aiError.name === 'AbortError' || aiError.message.includes('network') || aiError.message.includes('fetch')) {
                    Hades.D(`  网络异常重试... ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, api.retry_delay_ms * retryCount));
                } else {
                    return "云露分析失败：服务连接超时或网络异常。";
                }
            }
        }
        return "云露分析失败：多次重试后服务仍无响应。";
    }
}

class MBTCF {
    static #BanMap = new Map();
    static #MD5BanSet = new Set();
    static #activeBans = new Set();
    static #secTags = [];
    static #remoteBanCount = 0;
    static #bus = new EventEmitter();
    static {
        this.#bus.setMaxListeners(20);
    }

    static get bus() { return this.#bus; }

    static async init(logger = console) {
        const Hades = getHades(logger);
        try {
            const [banList, tagData] = await Promise.all([
                Ananke.HydrateJson(MiaoPluginMBT.Paths.BanListPath, []),
                Ananke.HydrateJson(MiaoPluginMBT.Paths.SecTagsPath, {})
            ]);

            this.#BanMap.clear();
            this.#MD5BanSet.clear();

            (Array.isArray(banList) ? banList : []).filter(item => item?.path).forEach(item => {
                const p = this.#normalize(item.path);
                const md5 = item.md5 || null;
                this.#BanMap.set(p, { md5, timestamp: item.timestamp });
                if (md5) this.#MD5BanSet.add(md5);
            });

            this.#secTags = Object.values(tagData ?? {}).filter(Array.isArray).flat();

            Hades.D(`封禁=${this.#BanMap.size} MD5=${this.#MD5BanSet.size} 标签=${this.#secTags.length}`);

            this.#bus.emit('ready', {
                banCount: this.#BanMap.size,
                tagCount: this.#secTags.length
            });

        } catch (err) {
            Hades.E(`初始化崩溃: ${err.message}`);
            this.#BanMap.clear();
            this.#MD5BanSet.clear();
            this.#secTags = [];
            this.#bus.emit('error', err);
        }
    }

    static Compute(imageData, config, logger = console) {
        const killList = new Set(this.#BanMap.keys());
        const pflLevel = config.PFL_Ops ?? DFC.PFL_Ops;

        const policy = {
            filterAi: config.Ai === false,
            filterEgg: config.EasterEgg === false,
            filterLayout: config.layout === false,
            pflLevel
        };

        let remoteCount = 0;

        if (Array.isArray(imageData)) {
            for (const item of imageData) {
                if (!item?.path) continue;

                if (item.attributes?.isBan === true) {
                    remoteCount++;
                    continue;
                }

                const normPath = this.#normalize(item.path);
                const itemMD5 = item.attributes?.md5;

                if (killList.has(normPath) || (itemMD5 && this.#MD5BanSet.has(itemMD5))) {
                    killList.add(normPath);
                    continue;
                }

                if (this.#checkPFL(item, policy.pflLevel)) {
                    killList.add(normPath);
                    continue;
                }

                if (item.attributes) {
                    const { other = [], layout } = item.attributes;
                    if (
                        (policy.filterAi && other.includes("LLMCanvas")) ||
                        (policy.filterEgg && other.includes("Egg")) ||
                        (policy.filterLayout && layout === "fullscreen")
                    ) {
                        killList.add(normPath);
                    }
                }
            }
        }

        this.#activeBans = killList;
        this.#remoteBanCount = remoteCount;

        return this.#activeBans;
    }

    static async ApplyBans() {
        if (this.#activeBans.size === 0) return;

        const tasks = [];
        for (const relPath of this.#activeBans) {
            const targetPath = Nomos.ResolveCharTarget(relPath, MiaoPluginMBT.Paths);
            if (targetPath) {
                tasks.push(
                    Ananke.obliterate(targetPath).then(success => ({ path: relPath, success }))
                );
            }
        }

        if (tasks.length > 0) {
            const results = await Promise.allSettled(tasks);
            const deletedCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            if (deletedCount > 0) {
                this.#bus.emit('ban-apply-complete', deletedCount);
            }
        }
    }

    static async AddManualBan(relativePath, logger = console) {
        const Hades = getHades(logger);
        const p = this.#normalize(relativePath);

        if (this.isPurified(p)) throw new Error("目标已被净化规则屏蔽，无法手动封禁");
        if (this.#BanMap.has(p)) throw new Error("该图片已在封禁列表中");

        const item = Tianshu._indexByGid.get(p);
        const md5 = item?.attributes?.md5 || null;

        this.#BanMap.set(p, { md5, timestamp: new Date().toISOString() });
        if (md5) this.#MD5BanSet.add(md5);

        try {
            await this.#persist(Hades);
            this.#bus.emit('ban', p);
            return true;
        } catch (err) {
            this.#BanMap.delete(p);
            if (md5) this.#MD5BanSet.delete(md5);
            Hades.E(`持久化失败，已回滚: ${err.message}`);
            throw new Error("保存封禁配置失败，操作已撤销");
        }
    }

    static async RemoveManualBan(relativePath, logger = console) {
        const Hades = getHades(logger);
        const p = this.#normalize(relativePath);

        if (!this.#BanMap.has(p)) throw new Error("未在封禁列表中找到该图片");

        const record = this.#BanMap.get(p);
        this.#BanMap.delete(p);
        if (record.md5) this.#MD5BanSet.delete(record.md5);

        try {
            await this.#persist(Hades);
            this.#bus.emit('unban', p);
            return true;
        } catch (err) {
            this.#BanMap.set(p, record);
            if (record.md5) this.#MD5BanSet.add(record.md5);
            Hades.E(`持久化失败，已回滚: ${err.message}`);
            throw new Error("保存封禁配置失败，操作已撤销");
        }
    }

    static async TagsBanMan(tagName, metaCache, logger = console) {
        if (!Array.isArray(metaCache)) return { count: 0, already: 0 };

        const targets = metaCache.filter(item => item.attributes?.SecTags?.includes(tagName));
        if (targets.length === 0) return { count: 0, already: 0 };

        let added = 0;
        let exist = 0;

        const mapSnapshot = new Map(this.#BanMap);
        const md5Snapshot = new Set(this.#MD5BanSet);

        try {
            for (const item of targets) {
                const p = this.#normalize(item.path);
                if (this.#BanMap.has(p)) {
                    exist++;
                } else {
                    const md5 = item.attributes?.md5 || null;
                    this.#BanMap.set(p, { md5, timestamp: new Date().toISOString() });
                    if (md5) this.#MD5BanSet.add(md5);
                    added++;
                }
            }

            if (added > 0) {
                await this.#persist(logger);
                this.#bus.emit('batch-ban', { tagName, count: added });
            }
        } catch (err) {
            this.#BanMap = mapSnapshot;
            this.#MD5BanSet = md5Snapshot;
            throw new Error("批量封禁保存失败，操作已全部撤销");
        }

        return { count: added, already: exist };
    }

    static reset() {
        this.#BanMap.clear();
        this.#MD5BanSet.clear();
        this.#activeBans.clear();
        this.#secTags = [];
        this.#remoteBanCount = 0;
        this.#bus.emit('reset');
    }

    static #normalize(p) {
        return toPosix(p);
    }

    static #checkPFL(item, level) {
        if (!item?.attributes || level <= 0) return false;
        const r = item.attributes.rated;
        return (level === 1 && r === 'r18') || (level === 2 && (r === 'r18' || r === 'p18'));
    }

    static async #persist(logger) {
        const payload = [...this.#BanMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([path, { md5, timestamp }]) => ({ path, md5, timestamp }));

        if (!(await Ananke.UpBanList(MiaoPluginMBT.Paths.BanListPath, payload, logger))) throw new Error("IO写入失败");
    }
    static isPurified(relativePath) {
        const p = this.#normalize(relativePath);
        return this.#activeBans.has(p) && !this.#BanMap.has(p);
    }
    static get userBanCount() { return this.#BanMap.size; }
    static get activeBanCount() { return this.#activeBans.size; }
    static get secTagsCache() { return [...this.#secTags]; }
    static get remoteBanCount() { return this.#remoteBanCount; }
    static get userBanSet() { return new Set(this.#BanMap.keys()); }
    static get activeBanSet() { return new Set(this.#activeBans); }
}

class MiaoPluginMBT extends plugin {
  static InitPromise = null;
  static #pendingInit = null;
  static #pendingTeardown = null;
  static MBTProcc = new MBTProcPool(HadesEntry());
  static BootStrap = false;
  static MBTConfig = {};
  static _MetaCache = Object.freeze([]);
  static _AliasData = null;
  static _wavesRoleDataMap = null;
  static HousekeepingDone = false;
  static BootLock = false;
  static LifecycleStates = Object.freeze({
      UNINITIALIZED: 'uninitialized',
      INITIALIZING: 'initializing',
      READY: 'ready',
      TEARING_DOWN: 'tearing_down'
  });
  static LifecycleState = 'uninitialized';
  static MetaMutex = new Metis('Meta', getCore());
  static GitMutex = new Metis('GitOps', getCore());
  static InstallMutex = new Metis('NPM', getCore());
  static RenderMutex = new Metis('PPTR', getCore());
  static CleanMutex = new Metis('Clean', getCore());
  static _indexByGid = new Map();
  static _indexByCRE = new Map();
  static _indexByTag = new Map();
  static get _SecTagsCache() { return MBTCF.secTagsCache; }
  static get _userBanSet() { return MBTCF.userBanSet; }
  static get _activeBanSet() { return MBTCF.activeBanSet; }

  static _getBootCtrl() {
      return global[Boot_Ctrl]?.value || null;
  }

  static _getLifecycleState() {
      return MiaoPluginMBT._getBootCtrl()?.state || MiaoPluginMBT.LifecycleState;
  }

  static _applyLifecycleState(nextState) {
      const bootCtrl = MiaoPluginMBT._getBootCtrl();
      if (bootCtrl) bootCtrl.state = nextState;
      MiaoPluginMBT.LifecycleState = nextState;
      MiaoPluginMBT._isInitializing = nextState === MiaoPluginMBT.LifecycleStates.INITIALIZING;
      MiaoPluginMBT.BootLock = nextState === MiaoPluginMBT.LifecycleStates.INITIALIZING
          || nextState === MiaoPluginMBT.LifecycleStates.TEARING_DOWN;
      MiaoPluginMBT.BootStrap = nextState === MiaoPluginMBT.LifecycleStates.READY;
  }

  static _transitionState(nextState, allowedFrom, reason = '') {
      const currentState = MiaoPluginMBT._getLifecycleState();
      if (!allowedFrom.includes(currentState)) {
          throw new Error(`非法生命周期流转: ${currentState} -> ${nextState}${reason ? ` (${reason})` : ''}`);
      }
      MiaoPluginMBT._applyLifecycleState(nextState);
      return nextState;
  }

  static async GenerateList(data, logger = console) {
      const config = MiaoPluginMBT.MBTConfig || DFC;
      MBTCF.Compute(data, config, logger);
      await MBTCF.ApplyBans();
  }

  static _FatigueMap = new Map();
  static #TopoMap = new Map();
  static _BenchNode(nodeName) {
    const cooldownTime = MBTMath.Range(60000, 180000);
    this._FatigueMap.set(nodeName, Date.now() + cooldownTime);
  }

  static _PruneFatigue(allNodes) {
    const now = Date.now();
    for (const [name, expireTime] of this._FatigueMap) {
      if (now > expireTime) this._FatigueMap.delete(name);
    }
    const freshNodes = allNodes.filter(n => !this._FatigueMap.has(n.name));
    if (freshNodes.length === 0) return allNodes;
    return freshNodes;
  }

  static _MintToken(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(MBTMath.Range(0, chars.length - 1));
    }
    return token;
  }

  static _detectDockerEnv() {
    if (fs.existsSync('/.dockerenv')) {
      return true;
    }
    try {
      const content = fs.readFileSync('/proc/1/cgroup', 'utf8');
      return content.includes('docker');
    } catch {
      return false;
    }
  }

  static ToImgSeg(input, options = {}) {
    if (!input) return null;
    const { audit = false, fallbackText = null, preferUrl = false } = options;

    if (Buffer.isBuffer(input)) {
      return segment.image(toBase64Url(input));
    }

    if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://') || input.startsWith('base64://')) {
        return segment.image(input);
      }
      if (path.isAbsolute(input)) {
        if (audit) {
          const exists = fs.existsSync(input);
          if (!exists) {
            return fallbackText ? { type: 'text', text: fallbackText } : null;
          }
        }
        try {
          const buffer = fs.readFileSync(input);
          return segment.image(toBase64Url(buffer));
        } catch {
          return segment.image(toFileUrl(input));
        }
      }
      return segment.image(input);
    }

    return segment.image(input);
  }

  static _shouldFileUrl(filePath, threshold) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size > threshold;
    } catch {
      return false;
    }
  }

  static async ReplyImg(e, input, fallbackText = '', logger = null) {
    const Hades = getHades(logger);
    let imgSeg = null;
    try {
      imgSeg = this.ToImgSeg(input);
      if (!imgSeg) return false;
      await Pheme.send(e, imgSeg);
      return true;
    } catch (sendErr) {
      Hades.W(`图片发送失败: ${sendErr?.code || sendErr?.message || 'SEND_FAIL'}`);
      if (typeof input === 'string' && !input.startsWith('http') && path.isAbsolute(input)) {
        try {
          const buffer = fs.readFileSync(input);
          await Pheme.send(e, segment.image(toBase64Url(buffer)));
          return true;
        } catch (retryErr) {
          Hades.W(`Base64发送失败: ${retryErr?.message || 'RETRY_FAIL'}`);
        }
      }
      if (fallbackText) {
        try { await Pheme.quote(e, `${fallbackText}\n(Code: ${sendErr?.code || 'SEND_FAIL'})`); } catch {}
      }
      return false;
    }
  }

  static async _CtxPrep(logger = console) {
    const Hades = getHades(logger);
    try {
      const raw = await Nomos.getCRPPData('proxyNodes', Hades)
        ?? await fsPromises.readFile(path.join(Nomos.ResPoolDir, 'data', 'CA-MBT.json'), 'utf-8').catch(() => null);
      if (!raw) return false;

      let nodes;
      try { const p = JSON.parse(raw); nodes = Array.isArray(p) ? p : (p?.F2Pool ?? []); }
      catch { return false; }
      if (!nodes.length) return false;

      MiaoPluginMBT.#TopoMap.clear();
      const uiList = nodes.filter(n => n?.ClonePrefix).map(node => (
        MiaoPluginMBT.#TopoMap.set(node.ClonePrefix.trim().toLowerCase().replace(/\/$/, ''), node.priority),
        node
      ));
      DFC.F2Pool = uiList;
      if (MiaoPluginMBT.MBTConfig) MiaoPluginMBT.MBTConfig.F2Pool = uiList;
      return true;
    } catch (e) {
      Hades.E(`节点数据解析异常: ${e.message}`);
    }
    return false;
  }

  static _CheckCtx(targetUrl) {
    if (!targetUrl) return false;
    const lowerUrl = targetUrl.toLowerCase();
    if (/github(?:usercontent)?\.com/.test(lowerUrl) && !/proxy|mirror/.test(lowerUrl)) return true;
    const norm = s => s.toLowerCase().replace(/\/$/, '').replace(/^http:/, 'https:');
    const target = norm(lowerUrl);
    const host = (() => { try { return new URL(target).host } catch { return null } })();
    const match = p => {
      const np = norm(p);
      if (target.startsWith(np)) return true;
      if (!host) return false;
      try { return new URL(np).host === host } catch { return false; }
    };

    return [...this.#TopoMap.keys()].some(match)
        || DFC?.F2Pool?.some(n => n?.ClonePrefix && match(n.ClonePrefix))
        || false;
  }

  static async Mysterious(gitPath) {
    if (!gitPath) return false;
    return await Ananke.Audit(gitPath, false);
  }

  static async GetRepoState(id, context = {}, options = {}) {
    const meta = Nomos.MetaNum(id);
    if (!meta) return null;
    const config = MiaoPluginMBT.MBTConfig || {};
    const url = config?.[meta.configKey] || DFC[meta.configKey];
    const isConfigured = !!url;
    const depsMet = !meta.dependencies || meta.dependencies.some(dep => Nomos.DepState(context, dep));
    const isEnabled = meta.required || (isConfigured && depsMet);
    const gitPath = MiaoPluginMBT.Paths[meta.gitKey];
    let exists = false;
    if ((isEnabled || options.ExistsDis) && gitPath) {
      exists = await MiaoPluginMBT.Mysterious(gitPath);
    }
    return { id, meta, url, isConfigured, depsMet, isEnabled, exists, gitPath };
  }

  static async ICI(context = {}, options = {}) {
    const repo1State = await MiaoPluginMBT.GetRepoState(1, context, { ExistsDis: true, ...options });
    return !!repo1State?.exists;
  }

  static _pathsCache = null;

  static get CowCooRepoRoot() {
      const base = typeof YzPath !== 'undefined' ? YzPath : process.cwd();
      return path.join(base, "resources", "CowCoos");
  }

  static get Paths() {
    if (this._pathsCache) return this._pathsCache;

    const root = this.CowCooRepoRoot;
    const ops = path.join(root, "Miao-Plugin-MBT", "CowCoo");
    const cow = path.join(root, "CowCoo");
    const yz = typeof YzPath !== 'undefined' ? YzPath : process.cwd();
    const repoJoin = (...parts) => path.join(root, ...parts);
    const opsJoin = (...parts) => path.join(ops, ...parts);
    const cowJoin = (...parts) => path.join(cow, ...parts);
    const pluginJoin = (name, ...parts) => path.join(yz, "plugins", name, ...parts);
    const tempJoin = (...parts) => path.join(yz, "temp", ...parts);

    this._pathsCache = {
      YzPath: yz,
      CowCooRepoRoot: root,
      MountRepoPath: repoJoin("Miao-Plugin-MBT"),    GitFilePath: repoJoin("Miao-Plugin-MBT", ".git"),
      MountRepoPath2: repoJoin("Miao-Plugin-MBT-2"), GitFilePath2: repoJoin("Miao-Plugin-MBT-2", ".git"),
      MountRepoPath3: repoJoin("Miao-Plugin-MBT-3"), GitFilePath3: repoJoin("Miao-Plugin-MBT-3", ".git"),
      MountRepoPath4: repoJoin("Miao-Plugin-MBT-4"), GitFilePath4: repoJoin("Miao-Plugin-MBT-4", ".git"),
      MountRepoPath5: repoJoin("Genshin-CR-Repos"), GitFilePath5: repoJoin("Genshin-CR-Repos", ".git"),
      MountRepoPath6: repoJoin("StarRail-CR-Repos"), GitFilePath6: repoJoin("StarRail-CR-Repos", ".git"),
      OpsPath: ops,
      oldOpsPath: path.join(yz, "resources", "Miao-Plugin-MBT", "GuGuNiu-Gallery"),
      SecTagsPath: opsJoin("SecTags.json"),
      ComResPath: cow,
      ConfigFilePath: cowJoin("CowSet.yaml"),
      BanListPath: cowJoin("banlist.json"),
      ProvisionPath: repoJoin(".install_lock"),
      WavesRoleData: cowJoin("waves", "RoleData.json"),
      MiaoPluginPath: pluginJoin("miao-plugin"),
      ZZZPluginPath: pluginJoin("ZZZ-Plugin"),
      WavesPluginPath: pluginJoin("waves-plugin"),
      RTCPath: cowJoin("RepoCache.json"),
      TempHtmlPath: tempJoin("html"), TempNiuPath: tempJoin("CowCoo"), TempDownloadPath: tempJoin("CowCoo", "Tasks"),
      NetworkDir: tempJoin("CowCoo", "Network"),
      WorkerPath: tempJoin("CowCoo", "NetWork", "worker.js"),
      PinyinPath: tempJoin("CowCoo", "NetWork", "pinyin.mjs"),
      Target: {
        MiaoCRE: pluginJoin("miao-plugin", "resources", "profile", "normal-character"),
        ZZZCRE: pluginJoin("ZZZ-Plugin", "resources", "images", "panel"),
        WavesCRE: pluginJoin("waves-plugin", "resources", "rolePic"),
        Example: pluginJoin("example"),
        Miao_GSAliasDir: pluginJoin("miao-plugin", "resources", "meta-gs", "character"),
        Miao_SRAliasDir: pluginJoin("miao-plugin", "resources", "meta-sr", "character"),
        ZZZ_AliasDir: pluginJoin("ZZZ-Plugin", "defset"),
        ZZZ_DataDir: pluginJoin("ZZZ-Plugin", "resources", "data", "hakush", "data", "character"),
        ZZZ_FaceDir: pluginJoin("ZZZ-Plugin", "resources", "images", "role_circle"),
        Waves_AliasDir: pluginJoin("waves-plugin", "resources", "Alias"),
      },
      SourceDir: (() => {
        const sd = { gallery: "CowCoo" };
        const universe = Nomos.Universe;
        for (const k in universe) {
          if (universe[k]?.dirName) sd[k] = universe[k].dirName;
        }
        return sd;
      })(),
      LinkFiles: [{ sourceSubPath: "咕咕牛图库管理器.js", destDir: pluginJoin("example"), destFileName: "咕咕牛图库管理器.js" }],
    };
    return this._pathsCache;
  }

  static MetaHub = {
    async AC(syncEx = false) {

      if (!MiaoPluginMBT._AliasData) MiaoPluginMBT._AliasData = { combined: {} };
      if (!MiaoPluginMBT._AliasVerCache) MiaoPluginMBT._AliasVerCache = {};

      try {
        let GSAlias = {};
        let SRAlias = {};

        try {
          const GSAliasPath = path.join(MiaoPluginMBT.Paths.Target.Miao_GSAliasDir, 'alias.js');
          const gsStats = await Ananke.stat(GSAliasPath);
          const gsVersion = gsStats ? gsStats.mtimeMs : Date.now();
          const gsCacheKey = `${GSAliasPath}@${gsVersion}`;
          if (MiaoPluginMBT._AliasVerCache.gsKey !== gsCacheKey) {
            const GSModule = await import(`${toFileUrl(GSAliasPath)}?v=${gsVersion}`);
            GSAlias = GSModule.alias || {};
            MiaoPluginMBT._AliasVerCache.gsKey = gsCacheKey;
            MiaoPluginMBT._AliasVerCache.gsData = GSAlias;
          } else {
            GSAlias = MiaoPluginMBT._AliasVerCache.gsData;
          }
        } catch (e) {  }

        try {
          const SRAliasPath = path.join(MiaoPluginMBT.Paths.Target.Miao_SRAliasDir, 'alias.js');
          const srStats = await Ananke.stat(SRAliasPath);
          const srVersion = srStats ? srStats.mtimeMs : Date.now();
          const srCacheKey = `${SRAliasPath}@${srVersion}`;
          if (MiaoPluginMBT._AliasVerCache.srKey !== srCacheKey) {
            const SRModule = await import(`${toFileUrl(SRAliasPath)}?v=${srVersion}`);
            SRAlias = SRModule.alias || {};
            MiaoPluginMBT._AliasVerCache.srKey = srCacheKey;
            MiaoPluginMBT._AliasVerCache.srData = SRAlias;
          } else {
            SRAlias = MiaoPluginMBT._AliasVerCache.srData;
          }
        } catch (e) {  }

        MiaoPluginMBT._AliasData.GSAlias = GSAlias;
        MiaoPluginMBT._AliasData.SRAlias = SRAlias;
        Object.assign(MiaoPluginMBT._AliasData.combined, GSAlias, SRAlias);

      } catch (error) {
        Hades.W(`米家别名加载部分异常`);
      }

      try {
        let ZZZAlias = {};
        const ZZZAliasPath = path.join(MiaoPluginMBT.Paths.Target.ZZZ_AliasDir, 'alias.yaml');
        const zzzContent = await Ananke.readFile(ZZZAliasPath, 'utf8');
        if (zzzContent) ZZZAlias = yaml.parse(zzzContent) || {};

        MiaoPluginMBT._AliasData.ZZZAlias = ZZZAlias;
        Object.assign(MiaoPluginMBT._AliasData.combined, ZZZAlias);
      } catch (e) { }

      try {
        let WavesAlias = {};
        const WavesAliasPath = path.join(MiaoPluginMBT.Paths.Target.Waves_AliasDir, 'role.yaml');
        const wavesContent = await Ananke.readFile(WavesAliasPath, 'utf8');
        if (wavesContent) WavesAlias = yaml.parse(wavesContent) || {};

        MiaoPluginMBT._AliasData.WavesAlias = WavesAlias;
        Object.assign(MiaoPluginMBT._AliasData.combined, WavesAlias);
      } catch (e) { }

      await MBTCF.init(Hades);

      const wavesRoleMap = new Map();
      try {
        const waveData = await Ananke.HydrateJson(MiaoPluginMBT.Paths.WavesRoleData, {});
        for (const key in waveData) {
          const role = waveData[key];
          if (role && role.name) {
            wavesRoleMap.set(role.name, role);
          }
        }
      } catch (e) {
        if (e.code !== 'ENOENT') Hades.W(`鸣潮 RoleData.json 加载失败: ${e.message}`);
      }
      MiaoPluginMBT._wavesRoleDataMap = wavesRoleMap;
      Tianshu.ResetAliasIndex();
      Tianshu.BuildAliasIndex(MiaoPluginMBT._AliasData);

      if (syncEx) {
        try {
          const py = await Hermes.getPinyinScript(Hades);
          if (py) {
            await Ananke.writeText(MiaoPluginMBT.Paths.PinyinPath, py);
          }
        } catch {}
      }
    }
  };

  config = DFC;
  logPrefix = DFC.logPrefix;
  logger = Hades;
  PFSCReady = false;
  task = null;

  constructor() {
    super({
      name: `『咕咕牛』图库管理器`,
      dsc: "『咕咕牛』",
      event: "message", priority: 40, rule: CowCoo_Rules,
    });
    this.logger = Hades;

    this.task = [
      {
        name: `${DFC.logPrefix}定时更新`,
        cron: DFC.CronUpdate,
        fnc: QuantumFlux(() => this.ReconcileTask()),
        log: true,
      },
      {
        name: `${DFC.logPrefix}临时文件清理`,
        cron: '0 0 3 * * *',
        fnc: QuantumFlux(() => this.CronSweep()),
        log: true,
      },
      {
        name: `${DFC.logPrefix}每日统计缓存更新`,
        cron: '0 0 4 * * *',
        fnc: QuantumFlux(() => Tianshu.UpdateStats(this.logger)),
        log: true,
      }
    ];
    // MiaoPluginMBT.ResPool.warmup(this.logger);
  }

  static async _RecoverState(logger) {
      const Hades = getHades(logger);
      const repoPaths = Nomos.AllRepoPaths(MiaoPluginMBT.Paths);
      let cleanedCount = 0;
      const sweepDir = async (dir) => {
          try {
              if (!await Ananke.Audit(dir)) return;
              const entries = await Ananke.readDir(dir);
              for (const entry of entries) {
                  if (entry.name.endsWith('.pending')) {
                      const originalName = entry.name.replace(/\.pending$/, '');
                      const originalPath = path.join(dir, originalName);
                      Hades.D(`发现未完成的操作残留: ${entry.name}，正在清理...`);
                      await Ananke.obliterate(originalPath);
                      await Ananke.obliterate(path.join(dir, entry.name));
                      cleanedCount++;
                  }
              }
          } catch (err) {
              Hades.E(`清理 ${dir} 时出错:`, err);
          }
      };

      await sweepDir(MiaoPluginMBT.Paths.TempDownloadPath);
      for (const repoPath of repoPaths) {
          await sweepDir(path.dirname(repoPath));
      }

      if (cleanedCount > 0) {
          Hades.D(`共清理了 ${cleanedCount} 个操作残留。`);
      }
  }

  static _isInitializing = false;
  static _bindLifecycle(bus, logger) {
      const shutdownListener = async () => await MiaoPluginMBT._teardown(false, logger);
      const reloadListener = async () => await MiaoPluginMBT._teardown(true, logger);
      if (bus.listenerCount('shutdown') === 0 && bus.listenerCount('reload') === 0) {
          bus.on('shutdown', shutdownListener);
          bus.on('reload', reloadListener);
      }
  }

  static async init(logger = getCore()) {
      const Hades = getHades(logger);
      const states = MiaoPluginMBT.LifecycleStates;
      const lifecycleState = MiaoPluginMBT._getLifecycleState();

      if (lifecycleState === states.TEARING_DOWN) {
          if (MiaoPluginMBT.#pendingTeardown) {
              await MiaoPluginMBT.#pendingTeardown.catch(() => {});
          }
      }

      if (MiaoPluginMBT._getLifecycleState() === states.READY) {
          if (!MiaoPluginMBT.InitPromise) {
              MiaoPluginMBT.InitPromise = Promise.resolve(true);
          }
          return MiaoPluginMBT.InitPromise;
      }

      if (MiaoPluginMBT._getLifecycleState() === states.INITIALIZING) {
          if (MiaoPluginMBT.#pendingInit) return MiaoPluginMBT.#pendingInit;
          if (MiaoPluginMBT.InitPromise) return MiaoPluginMBT.InitPromise;
          Hades.W(`检测到初始化状态失配，已回退到未初始化状态。`);
          MiaoPluginMBT._applyLifecycleState(states.UNINITIALIZED);
      }

      if (MiaoPluginMBT.InitPromise) return MiaoPluginMBT.InitPromise;
      if (MiaoPluginMBT.#pendingInit) return MiaoPluginMBT.#pendingInit;
      MiaoPluginMBT._transitionState(states.INITIALIZING, [states.UNINITIALIZED], 'init');

      MiaoPluginMBT.#pendingInit = (async () => {
          const initTask = async () => {
              const BootWrapper = global[Boot_Ctrl];
              const BootCtrl = BootWrapper?.value;
              const shouldEnterHMR = !BootCtrl?.enteredGen;
              const bus = shouldEnterHMR ? await MBTSignalTrap.HMR_Entry(Hades) : MBTSignalTrap.getInstance(Hades);
              const activeGen = Moirai.currentGen;

              if (BootCtrl && !BootCtrl.enteredGen) {
                  BootCtrl.enteredGen = activeGen;
              }

              MiaoPluginMBT._bindLifecycle(bus, Hades);

              for (const mutex of [
                  MiaoPluginMBT.MetaMutex,
                  MiaoPluginMBT.GitMutex,
                  MiaoPluginMBT.InstallMutex,
                  MiaoPluginMBT.RenderMutex,
                  MiaoPluginMBT.CleanMutex,
                  Nomos.ResPoolLock
              ]) {
                  if (mutex) {
                      if (typeof mutex.syncGen === 'function') {
                          mutex.syncGen(activeGen);
                      }
                      if (mutex._reloadTrapListener) {
                          bus.off('reload', mutex._reloadTrapListener);
                          bus.once('reload', mutex._reloadTrapListener);
                      }
                  }
              }

              if (typeof Ananke.syncLocksGen === 'function') {
                  Ananke.syncLocksGen(activeGen);
              }

              if (MiaoPluginMBT.MBTProcc && typeof MiaoPluginMBT.MBTProcc.syncGen === 'function') {
                  MiaoPluginMBT.MBTProcc.syncGen(activeGen, bus);
              }

              try {
                  await MiaoPluginMBT._RecoverState(Hades);
                  const defaultConfig = { ...DFC };
                  MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
                      MiaoPluginMBT.Paths.ConfigFilePath,
                      defaultConfig,
                      Hades
                  );

                  if (![PFL.NONE, PFL.RX18_ONLY, PFL.PX18_PLUS].includes(MiaoPluginMBT.MBTConfig.PFL_Ops)) {
                      Hades.W(`PFL=${MiaoPluginMBT.MBTConfig.PFL_Ops} 无效，降级为 ${DFC.PFL_Ops} (${PFL.getDescription(DFC.PFL_Ops)})`);
                      MiaoPluginMBT.MBTConfig.PFL_Ops = DFC.PFL_Ops;
                  }

                  try {
                      await Nomos.ensureCRPP({ 
                          force: false,
                          useLocal: true,
                          logger: Hades, 
                          busyWaitMs: 15000
                      });
                      Nomos.warmupResPool(Hades);
                  } catch (resPoolErr) { }

                  await MiaoPluginMBT._CtxPrep(Hades);
                  await Nomos.CleanDataPool('UAPool', Hades);
                  await Nomos.CleanDataPool('RepoPool', Hades);

                  Hades.D(`正在初始化元数据缓存...`);
                  const [localCacheData] = await Promise.all([
                      MiaoPluginMBT.ImgMetaAC(true, Hades),
                      MiaoPluginMBT.MetaHub.AC(true)
                  ]);

                  await MiaoPluginMBT.GenerateList(localCacheData, Hades);
                  MiaoPluginMBT._MetaCache = localCacheData;

                  const vColor = `\x1b[38;5;229mv${Version}\x1b[0m`;
                  const boxWidth = 30;
                  const padCenter = (text) => {
                      const visibleLen = text.replace(/\x1b\[\d+(;\d+)*m/g, '').length;
                      const pad = Math.max(0, boxWidth - visibleLen);
                      const left = Math.floor(pad / 2);
                      return ' '.repeat(left) + text;
                  };
                  Hades.O(`╔══════════════════════════════╗`);
                  Hades.O(padCenter(`全局初始化完成`));
                  Hades.O(padCenter(`版本号：${vColor}`));
                  Hades.O(`╚══════════════════════════════╝`);

                  setImmediate(() => {
                      Tianshu.UpdateStats(Hades).catch(() => {});
                  });

                  return true;

              } catch (error) {
                  Hades.E(`初始化失败:`, error);
                  throw error;
              }
          };

          try {
              const res = await initTask();
              if (MiaoPluginMBT._getLifecycleState() !== states.INITIALIZING) {
                  throw new Error(`初始化提交被拒绝: 状态=${MiaoPluginMBT._getLifecycleState()}`);
              }
              MiaoPluginMBT._transitionState(states.READY, [states.INITIALIZING], 'init success');
              MiaoPluginMBT.InitPromise = Promise.resolve(res);
              return MiaoPluginMBT.InitPromise;
          } catch (e) {
              MiaoPluginMBT._applyLifecycleState(states.UNINITIALIZED);
              MiaoPluginMBT.InitPromise = null;
              throw e;
          } finally {
              MiaoPluginMBT.#pendingInit = null;
          }
      })();

      return MiaoPluginMBT.#pendingInit;
  }

  static _resetRuntimeState() {
      MiaoPluginMBT.BootStrap = false;
      MiaoPluginMBT._MetaCache = Object.freeze([]);
      if (MiaoPluginMBT._indexByGid) MiaoPluginMBT._indexByGid.clear();
      if (MiaoPluginMBT._indexByCRE) MiaoPluginMBT._indexByCRE.clear();
      if (MiaoPluginMBT._indexByTag) MiaoPluginMBT._indexByTag.clear();
      Tianshu.ResetAliasIndex();
      MBTCF.reset();
      PoseidonSpear.reset();
      Ananke.reset();
      Cerberus.reset();
      Morpheus.reset().catch(() => {});
  }

  static async _teardown(isReload = false, logger) {
      const Hades = getHades(logger);
      const states = MiaoPluginMBT.LifecycleStates;
      if (MiaoPluginMBT.#pendingTeardown) return MiaoPluginMBT.#pendingTeardown;

      MiaoPluginMBT.#pendingTeardown = (async () => {
          MiaoPluginMBT._transitionState(
              states.TEARING_DOWN,
              [states.UNINITIALIZED, states.INITIALIZING, states.READY],
              isReload ? 'reload teardown' : 'shutdown teardown'
          );

          if (isReload) {
              Hestia.advance();
          }

          MiaoPluginMBT.#pendingInit = null;
          MiaoPluginMBT.InitPromise = null;

          if (MiaoPluginMBT.MBTProcc) {
              await MiaoPluginMBT.MBTProcc.killAll('SIGTERM', isReload ? `HMR_Gen${MiaoPluginMBT._gen || 1}` : 'Shutdown');
          }

          if (Morpheus.reset) {
              await Morpheus.reset();
          }

          Hermes.cleanup();
          ProteusMatrix.reset();

          const BootWrapper = global[Boot_Ctrl];
          if (BootWrapper?.value?.dispose) {
              try { BootWrapper.value.dispose(); } catch (e) {}
          } else if (BootWrapper?.value?.timer) {
              clearTimeout(BootWrapper.value.timer);
              BootWrapper.value.timer = null;
          }
          delete global[Boot_Ctrl];

          if (isReload) {
              MiaoPluginMBT._resetRuntimeState();
              Hestia.reap(Hestia.activeGen - 1);
          }

          if (global.gc) {
              try { global.gc(); } catch (e) {}
          }

          const TrapWrapper = global[Trap_Symbol];
          if (TrapWrapper?.value) {
              try {
                  TrapWrapper.value._isShuttingDown = true;
                  TrapWrapper.value.removeAllListeners();
                  TrapWrapper.value.dispose();
              } catch (e) {}
          }
          delete global[Trap_Symbol];
          MiaoPluginMBT._applyLifecycleState(states.UNINITIALIZED);
          Hades.D(`清理完成资源统计: ${JSON.stringify(Hestia.stats)}`);
      })();

      try {
          return await MiaoPluginMBT.#pendingTeardown;
      } finally {
          MiaoPluginMBT.#pendingTeardown = null;
      }
  }

  static async ImgMetaAC(reloadCache = false, logger = getCore()) {
    if (MiaoPluginMBT._MetaCache?.length > 0 && !reloadCache) return MiaoPluginMBT._MetaCache;
    const Hades = getHades(logger);
    const startTime = Date.now();
    const imageDP = path.join(MiaoPluginMBT.Paths.MountRepoPath, "CowCoo", "imgdata.json");
    let rawData = [];
    try {
      const content = await Ananke.readFile(imageDP, "utf8");
      rawData = content ? JSON.parse(content) : [];
    } catch (error) {
      Hades.E(`读取核心元数据失败:`, error);
      return [];
    }

    let upstreamBanCount = 0;
    const validData = rawData.map(item => {
        if (!item.CREName && item.characterName) item.CREName = item.characterName;
        if (item.attributes && item.attributes.secTags) item.attributes.SecTags = item.attributes.secTags;
        return item;
    }).filter(item => {
      if (item && item.attributes && item.attributes.isBan === true) {
        upstreamBanCount++;
        return false;
      }

      const isBasicValid = item && typeof item.path === 'string' && item.path.trim() !== "" &&
        typeof item.CREName === 'string' && item.CREName.trim() !== "" &&
        typeof item.attributes === 'object' &&
        typeof item.storagebox === 'string' && item.storagebox.trim() !== "";

      if (!isBasicValid) return false;
      // const pathRegex = /^[a-z]+-character\/[^/]+\/[^/]+Gu\d+\.webp$/i;
      // return pathRegex.test(item.path.replace(/\\/g, "/"));
      return true;

    }).map(item => ({
        ...item,
        path: toPosix(item.path)
    }));

    MiaoPluginMBT._remoteBanCount = upstreamBanCount;
    Tianshu.BuildIndexes(validData);
    MiaoPluginMBT._MetaCache = Object.freeze(validData);
    const duration = Date.now() - startTime;
    Hades.D(`元数据重构 ${duration}ms | 索引=${validData.length} | 上游封禁=${upstreamBanCount}`);

    return MiaoPluginMBT._MetaCache;
  }

  static async OpsGate(e, commandName) {
    const cerberus = Cerberus.getInstance();
    if (cerberus.tier === 1) {
      const freeMB = Math.floor(cerberus.freeMemMB);
      await Pheme.lowMem(e, freeMB);
      return false;
    }

    const cooldownMap = { 3: 5, 2: 15 };
    const cooldownDuration = cooldownMap[cerberus.tier] || 10;

    if (cooldownDuration > 0) {
      const userId = e.user_id;
      const redisKey = `CowCoo:${commandName}:${userId}`;

      try {
        if (typeof redis !== 'undefined') {
          const ttl = await redis.ttl(redisKey);
          if (ttl && ttl > 0) {
            if (ttl > 3 || cerberus.tier === 2) {
              await Pheme.cooldown(e, ttl, cerberus.tier);
            }
            return false;
          }
          await redis.set(redisKey, '1', { EX: cooldownDuration });
        }
      } catch (redisError) {
        Hades.E(`[CD:${commandName}] Redis 操作失败:`, redisError);
      }
    }

    return true;
  }

  static async TestGitVoice(repoUrl, ClonePrefix, nodeName) {
     const extractUrp = (url) => url?.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i)?.[1];
     const defaultRepo = "GuGuNiu/Miao-Plugin-MBT";
     let targetUrp = extractUrp(repoUrl) || defaultRepo;
     let isDisguised = false;
     if (ClonePrefix && nodeName !== "GitHub") {
         const repoPool = await Nomos.CleanDataPool('RepoPool', Hades);
         if (repoPool.length === 0) {
             return {
                 success: false,
                 duration: Infinity,
                 error: new Error("远端仓库池为空"),
                 isDisguised: false,
                 metrics: null
             };
         }
         const randomRepoUrl = repoPool[MBTMath.Range(0, repoPool.length - 1)];
         const disguisedUrp = extractUrp(randomRepoUrl);
         if (disguisedUrp) {
             targetUrp = disguisedUrp;
             isDisguised = true;
         }
     }

     const cleanPrefix = ClonePrefix ? ClonePrefix.replace(/\/$/, "") : "";
     const actualRepoUrl = (!ClonePrefix || nodeName === "GitHub")
         ? `https://github.com/${targetUrp}.git`
         : `${cleanPrefix}/github.com/${targetUrp}.git`;

     const startTime = Date.now();
     const timeout = 20000;

     return MBTPipeControl("git", ["ls-remote", "--heads", actualRepoUrl], {}, timeout)
         .then((res) => ({
             success: true,
             duration: Date.now() - startTime,
             isDisguised: isDisguised,
             metrics: res.metrics
         }))
         .catch((err) => ({
             success: false,
             duration: Infinity,
             error: err,
             isDisguised: isDisguised,
             metrics: err.metrics
         }));
  }

  static async FsQuery(relativePath) {
    return Tianshu.FsQuery(relativePath);
  }

  static async SSF() {
      const linkFiles = MiaoPluginMBT.Paths.LinkFiles || [];
      if (linkFiles.length === 0) return false;

      const link = linkFiles[0];
      const source = path.join(MiaoPluginMBT.Paths.MountRepoPath, link.sourceSubPath);
      const dest = path.join(link.destDir, link.destFileName);

      if (!(await Ananke.Audit(source, false))) return false;
      return await Ananke.syncCoreFile(source, dest, {
          checkMd5: true,
          defer: { min: 20 * 60 * 1000, max: 30 * 60 * 1000 }
      });
  }

  static async SCD(logger = getCore()) {
    const Hades = getHades(logger);
    const context = await Nomos.getContext();
    const activeRepos = Nomos.ActiveScope(MiaoPluginMBT.MBTConfig, context);
    const activeKeys = new Set(activeRepos.map(r => r.key));
    const PURGE_PATHS = getCreTargets();
    await Promise.all(PURGE_PATHS.map((dir) => Ananke.purge(dir, Hades)));

    const SyncManifest = MiaoPluginMBT._MetaCache;
    const syncTasks = [];
    let skippedCount = 0;

    if (SyncManifest && SyncManifest.length > 0) {
        for (const imgData of SyncManifest) {
            const relativePath = toPosix(imgData.path);
            const storageBox = imgData.storagebox;
            if (!relativePath || !storageBox) continue;
            if (!activeKeys.has(storageBox)) continue;
            if (MiaoPluginMBT._activeBanSet.has(relativePath)) {
                skippedCount++;
                continue;
            }
            const sourceVisPath = Nomos.PathKey(storageBox, MiaoPluginMBT.Paths);
            if (!sourceVisPath) continue;
            const targetPath = Nomos.ResolveCharTarget(relativePath, MiaoPluginMBT.Paths);
            if (targetPath) {
                syncTasks.push({
                    src: path.join(sourceVisPath, relativePath),
                    dest: targetPath
                });
            }
        }
    } else {
        Hades.W(`元数据为空，仅执行官方立绘同步。`);
    }
      Hades.D(`检测到官方立绘同步已开启，正在扫描任务...`);
      const sourceBaseDir = MiaoPluginMBT.Paths.Target.Miao_GSAliasDir;
      const targetBaseDir = MiaoPluginMBT.Paths.Target.MiaoCRE;
      const splashes = await Tianshu.ScanSplashes(sourceBaseDir);
      for (const splash of splashes) {
          const destDir = path.join(targetBaseDir, splash.CREName);
          const destFile = path.join(destDir, splash.fileName);
          syncTasks.push({
              src: splash.src,
              dest: destFile
          });
      }

    if (syncTasks.length === 0) {
        Hades.D(`没有需要同步的文件。`);
        return;
    }

    Hades.D(`准备同步 ${syncTasks.length} 个文件，已过滤 ${skippedCount} 个`);
    const startTime = Date.now();
    const result = await Ananke.dispatchSync(syncTasks, Hades);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    Hades.D(`同步完成: 成功${result.success} 失败${result.fail} 耗时${duration}s`);
  }

  static async RevertFile(relativePath, logger = getCore()) {
    const Hades = getHades(logger);
    const sourcePath = await MiaoPluginMBT.FsQuery(relativePath);
    if (!sourcePath) return false;
    const targetPath = Nomos.ResolveCharTarget(relativePath, MiaoPluginMBT.Paths);
    if (!targetPath) return false;
    try {
      await Ananke.mkdirs(path.dirname(targetPath));
      await Ananke.copyFile(sourcePath, targetPath);
      return true;
    } catch (copyError) { Hades.E(`${relativePath} 失败:`, copyError); return false; }
  }

  static RenderMatrix(baseScale = 1) {
    const currentRenderScale = (MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0)
      ? MiaoPluginMBT.MBTConfig.RenderScale
      : DFC.RenderScale;
    const scalePercent = currentRenderScale ?? DFC.RenderScale;
    const scaleFactor = Math.min(5, Math.max(0.5, (Number(scalePercent) || 100) / 100));
    const scale = baseScale * scaleFactor;
    return `transform:scale(${scale}); transform-origin: top left;`;
  }

  static async SmartTaskHeavy(runtimeContext, repoNum, repoUrl, branch, finalLocalPath, e, logger, sortedNodes = [], MBTProcc, signal = null, lockId = null, Cer_SessionId = null) {
      const coreLogger = logger || getCore();
      const Hades = HadesEntry({}, coreLogger);
      logger = coreLogger;
      const Rid = crypto.randomBytes(3).toString('hex').toUpperCase();
      const colorCode = Hades.nextColor();
      const RidColored = Hades.colorize(`[${Rid}]`, colorCode);
      const cleanRepoUrl = repoUrl.replace(/\/+$/, "");
      const repoRealName = cleanRepoUrl.split("/").pop().replace(/\.git$/, "");
      const logTag = `[${repoRealName}]`;
      const targetBranch = branch || "main";
      const commitLockId = lockId || `SmartTask:Commit:${crypto.randomBytes(2).toString('hex')}`;
      const SignalTrap = MBTSignalTrap.getInstance();
      const cerberus = Cerberus.getInstance();
      let isShuttingDown = false;
      let activeCRS = null;
      let retryTimer = null;
      const onShutdown = () => {
          if (isShuttingDown) return;
          isShuttingDown = true;
          Hades.W(`${RidColored} | 系统收到停机信号正在中止任务`);
          if (Cer_SessionId) cerberus.pulse(Cer_SessionId, { event: 'shutdown', state: 'running' });
          if (activeCRS) activeCRS.stop();
      };
      SignalTrap.once('shutdown', onShutdown);
      SignalTrap.once('reload', onShutdown);
      if (signal?.aborted) throw new Error('开始前已中止');
      let MODE = 'AIRLOCK_PROXY';
      let logModeMsg = "";
      let useAirlock = true;
      let inheritEnv = false;
      let extraEnv = null;
      let AirlockRetry = false;
      const sysProxyEnv = {
          HTTP_PROXY: process.env.HTTP_PROXY,
          HTTPS_PROXY: process.env.HTTPS_PROXY,
          ALL_PROXY: process.env.ALL_PROXY,
          http_proxy: process.env.http_proxy,
          https_proxy: process.env.https_proxy,
          all_proxy: process.env.all_proxy,
          NO_PROXY: process.env.NO_PROXY,
          no_proxy: process.env.no_proxy
      };

      try {
          const healthyCount = sortedNodes.filter(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name)).length;
          if (healthyCount < 2) PoseidonSpear.revive(logger);
          const bestMirror = sortedNodes.find(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
          const mirrorSpeed = bestMirror ? (bestMirror.time || Infinity) : Infinity;
          let vectors = runtimeContext?.vectors || null;
          let senseChain = runtimeContext?.decision || null;
          if (!vectors || !senseChain) {
              const envData = await Hermes.getEnvInfo(Hades);
              const fallbackSense = await Proteus.sense(envData, mirrorSpeed, Hades);
              vectors = fallbackSense.vector;
              senseChain = fallbackSense;
              if (runtimeContext) {
                  runtimeContext.vectors = vectors;
                  runtimeContext.decision = senseChain;
              }
          }
          const netMode = senseChain.mode;
          const execCtx = senseChain.executionContext;
          const enableV6 = vectors.v6Link;
          const v6Bias = Proteus._setup.bonusOfficial;
          const v6Lat = vectors.v6Lat;
          const v4Lat = vectors.v4Lat;
          const udpReach = vectors.udpReach;

          let targetNode = null;
          let preferV6 = enableV6 && Number.isFinite(v6Lat)
              ? (Number.isFinite(v4Lat) ? (v6Lat * v6Bias < v4Lat) : true)
              : enableV6;
          useAirlock = execCtx.isAirlock;
          inheritEnv = execCtx.inheritEnv;
          extraEnv = execCtx.gitEnv;
          if (netMode === Proteus.State.V6_TURBO) {
              MODE = 'NATIVE_V6';
              preferV6 = true;
              targetNode = sortedNodes.find(n => n.name === "GitHub");
              if (!targetNode) {
                  targetNode = { name: "GitHub", ClonePrefix: "https://github.com/", protocol: 'HTTPS' };
              }
              logModeMsg = `${senseChain.desc} -> 强制GitHub[${senseChain.vector.v6Lat}ms]`;
          } else {
              MODE = netMode === Proteus.State.NATIVE ? 'NATIVE' :
                     (netMode === Proteus.State.USER_AGENT || netMode === Proteus.State.IDLE_AGENT) ? 'USER_PROXY' : 'AIRLOCK_PROXY';
              logModeMsg = senseChain.desc;
              if (extraEnv && extraEnv.ALL_PROXY) {
                  logModeMsg += ` [注入:${extraEnv.ALL_PROXY}]`;
              }
          }

          Hades.D(`${RidColored} 模式=${MODE} ${logModeMsg}`);
          const githubNode = sortedNodes.find(n => n.name === "GitHub") || {
              name: "GitHub", priority: 0, ClonePrefix: "https://github.com/", protocol: 'HTTPS'
          };
          const getNodeLatency = (node) => {
              if (!node) return Infinity;
              if (node.name === "GitHub") {
                  const lat = preferV6 ? v6Lat : v4Lat;
                  if (Number.isFinite(lat)) return lat;
              }
              const candidate = node.latency ?? node.time ?? node.speed;
              return Number.isFinite(candidate) ? candidate : Infinity;
          };
          let RacingQueue = [];
          let useGitHubAsBackup = false;
          const mirrorNodes = sortedNodes.filter(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
          const validatedMirrors = mirrorNodes
              .filter(n => (n.protocol === 'HTTP') && Number.isFinite(getNodeLatency(n)))
              .sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
          const primaryMirrors = validatedMirrors.slice(0, 2);
          const reserveMirrors = validatedMirrors.slice(2);
          const getStartDelay = (node, index, riskMode) => {
              if (node.retryDelay) return node.retryDelay + MBTMath.Range(0, 500);
              const latency = getNodeLatency(node);
              const v4Threshold = Proteus._setup.thresholdV4;
              let delay = 0;
              if (!Number.isFinite(latency)) delay = 6000;
              else if (latency < 200) delay = 0;
              else if (latency < v4Threshold) delay = 1500;
              else delay = 4000;
              if (riskMode && index > 0) delay = Math.min(delay, 5000);
              return delay;
          };

          if (MODE === 'NATIVE_V6' || MODE === 'NATIVE' || MODE === 'USER_PROXY') {
              RacingQueue = [githubNode];
              if (MODE !== 'USER_PROXY') {
                  RacingQueue.push({ ...githubNode, name: "GitHub_R1", priority: githubNode.priority - 1, retryDelay: 2000 });
                  RacingQueue.push({ ...githubNode, name: "GitHub_R2", priority: githubNode.priority - 2, retryDelay: 4500 });
              }
              useGitHubAsBackup = false;
          } else if (MODE === 'NATIVE_FAST') {
              RacingQueue = [githubNode, ...primaryMirrors];
              useGitHubAsBackup = false;
          } else {
              RacingQueue = [...primaryMirrors];
              useGitHubAsBackup = true;
              if (RacingQueue.length === 0 && githubNode) {
                  RacingQueue = [githubNode];
                  useGitHubAsBackup = false;
              }
          }
          RacingQueue.sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
          const createTaskFactory = (node, isDowngrade = false) => {
              return (context, sitRep) => {
                  const protocol = isDowngrade ? 'HTTP/1.1' : (node.protocol || 'HTTP');
                  const isGithubTarget = node.name === "GitHub" || node.name.startsWith("GitHub_");
                  const nodeDisplayName = isGithubTarget ? `GitHub(直连${node.retryDelay ? '/重试' : ''})` : `${node.name}(${protocol})`;
                  const taskName = isDowngrade ? `${nodeDisplayName}(H1)` : nodeDisplayName;
                  const uniqueSuffix = crypto.randomBytes(4).toString('hex');
                  const tempRepoPath = path.join(MiaoPluginMBT.Paths.TempDownloadPath, `Git-${repoNum}-${node.name.replace(/\W/g,'')}-${uniqueSuffix}`);
                  const meta = { tempRepoPath, nodeName: taskName, node };
                  let actualCloneUrl = "";
                  const cleanPrefix = node.ClonePrefix ? node.ClonePrefix.replace(/\/$/, "") : "";
                  if (isGithubTarget) actualCloneUrl = cleanRepoUrl;
                  else actualCloneUrl = `${cleanPrefix}/${cleanRepoUrl}`;

                  const executeGit = async () => {
                      const currentGitConfigs = [];
                      if (!udpReach) currentGitConfigs.push('http.version=HTTP/1.1');
                      if (preferV6) currentGitConfigs.push('core.ipv6=true');
                      currentGitConfigs.push('http.sslVerify=false');
                      if (isDowngrade) currentGitConfigs.push('http.version=HTTP/1.1');
                      if (!useAirlock) {
                          const proxyEnv = extraEnv || sysProxyEnv;
                          const httpProxy = proxyEnv?.HTTP_PROXY || proxyEnv?.http_proxy;
                          const httpsProxy = proxyEnv?.HTTPS_PROXY || proxyEnv?.https_proxy;
                          if (httpProxy && !currentGitConfigs.some(cfg => cfg.startsWith('http.proxy='))) {
                              currentGitConfigs.push(`http.proxy=${httpProxy}`);
                          }
                          if (httpsProxy && !currentGitConfigs.some(cfg => cfg.startsWith('https.proxy='))) {
                              currentGitConfigs.push(`https.proxy=${httpsProxy}`);
                          }
                      }

                      const normalizedPrefix = node.ClonePrefix ? node.ClonePrefix.trim().toLowerCase().replace(/\/$/, "") : null;
                      const topoAllowed = normalizedPrefix ? MiaoPluginMBT.#TopoMap.has(normalizedPrefix) : false;
                      const caDisabled = isGithubTarget || topoAllowed;

                      let finalEnv = extraEnv || sysProxyEnv || undefined;

                      const gitOptions = {
                          cwd: MiaoPluginMBT.Paths.YzPath, shell: false, signal: context.signal, Rid: Rid,
                          inheritEnv: inheritEnv, airlock: useAirlock, gitConfigs: currentGitConfigs,
                          preferV6: preferV6,
                          env: finalEnv,
                          RidTag: RidColored,
                          caWhitelist: [actualCloneUrl, cleanRepoUrl].filter(Boolean),
                          caDisabled: caDisabled,
                          onTelemetry: (telemetryData) => {
                              if (context && !context.signal.aborted) {
                                  context.telemetry = telemetryData;
                                  if (Cer_SessionId) {
                                      cerberus.pulse(Cer_SessionId, {
                                          event: 'telemetry',
                                          progress: Number(telemetryData?.progress || 0),
                                          bytes: Number(telemetryData?.rx_bytes || 0),
                                          state: 'running'
                                      });
                                  }
                              }
                          }
                      };

                      const cloneArgs = ["clone", "--verbose", `--depth=${DFC.Depth}`, "--progress", "-b", targetBranch, actualCloneUrl, tempRepoPath];

                      await MiaoPluginMBT.GitMutex.run(async () => {
                          if (context.signal.aborted) throw new Error('IO前中止');
                          if (!PoseidonSpear.isLive(node.name)) throw new Error(`JIT: 节点 [${node.name}] 已熔断`);
                          const jitter = MBTMath.Range(100, 400);
                          await common.sleep(jitter);
                          await Ananke.obliterate(tempRepoPath);
                          await Ananke.mkdirs(path.dirname(tempRepoPath)).catch(() => {});
                      }, { id: `GitPrep:${uniqueSuffix}`, wait: 0, ttl: 15000 });

                      return MBTPipeControl("git", cloneArgs, gitOptions, DFC.GitTimeout, null, null, (p) => { if (sitRep) sitRep(p); }, null, MBTProcc);
                  };

                  const promiseChain = (async () => {
                      try {
                          const res = await executeGit();
                          return { ...res, ...meta };
                      } catch (err) {
                          if (context.signal.aborted || err.code === 'ABORT_ERR' || err.name === 'AbortError' || err.message === 'ABORT_PRE_IO') {
                              const abortErr = new Error('任务已中止');
                              abortErr.code = 'SCHEDULER_ABORT';
                              throw abortErr;
                          }
                          const diagnosis = PoseidonSpear.probeProtocol(err.message || err.stderr);
                          if (err.message === 'Traffic Lie (Fake Connection)') {
                              if (!isDowngrade && preferV6 && node.name === "GitHub") {
                                  Hades.D(`${RidColored} 检测到 IPv6 数据异常，正在回退至 IPv4 通道`);

                                  preferV6 = false;

                                  if (activeCRS && !activeCRS.closed) {
                                      const newTaskId = `GitHub_V4_Fallback_${uniqueSuffix}`;
                                      activeCRS.addTask(newTaskId, createTaskFactory(node, false), true, 1000);
                                  }

                                  if (activeCRS && !activeCRS.closed && mirrorNodes.length > 0) {
                                      mirrorNodes.forEach((mirror, idx) => {
                                          activeCRS.addTask(mirror.name, createTaskFactory(mirror), false, 2000 + (idx * 1000));
                                      });
                                  }

                                  throw new Error('IPv6数据异常，已降级');
                              }
                          }

                          if (diagnosis === 'DOWNGRADE_H1' && !isDowngrade) {
                              Hades.D(`${RidColored} | [Quo] ${taskName} H2->H1`);
                              if (activeCRS && !activeCRS.closed) {
                                  const newTaskId = `${node.name}_H1_${uniqueSuffix}`;
                                  activeCRS.addTask(newTaskId, createTaskFactory(node, true), true, 0);
                              }
                              throw new Error(`协议不匹配，已触发变异`);
                          }
                          let coreReason = err.message || "未知错误";
                          if (err.stderr) coreReason = err.stderr.split('\n').pop() || coreReason;
                          if (!isDowngrade) {
                              const strikeRes = PoseidonSpear.strike(node.name, coreReason);
                              if (strikeRes.punished) {
                                  Hades.D(`${RidColored} 熔断[${node.name}] ${strikeRes.type} ${(strikeRes.coolingTime / 60000).toFixed(0)}m`);
                              }
                          }

                          setTimeout(() => {
                              if (signal?.aborted) return;
                              const trap = MBTSignalTrap.getInstance();
                              if (trap?._isShuttingDown) return;
                              MiaoPluginMBT.CleanMutex.run(async () => {
                                  for (let i = 0; i < 3; i++) {
                                      await Ananke.obliterate(tempRepoPath, 5, 800);
                                      if (!(await Ananke.Audit(tempRepoPath, true))) break;
                                      await common.sleep(1500 + (i * 1500));
                                  }
                              }, { id: `Cleanup:${uniqueSuffix}`, wait: 0, ttl: 12000 }).catch(() => {});
                          }, 3000);

                          throw err;
                      }
                  })();
                  return { promise: promiseChain, meta };
              };
          };

          const nodePool = [...RacingQueue, ...reserveMirrors];
          let waveCount = 0;

          const poolNames = nodePool.map(n => n.name).join(', ') || '无';
          const backupName = useGitHubAsBackup ? 'GitHub (75s BPP)' : '无';
          if (MODE !== 'USER_PROXY') {
             Hades.D(`${RidColored} | [Smart] 初始节点池: [${poolNames}] | [${backupName}]`);
          }

          while (true) {
              if (isShuttingDown) break;
              if (Cer_SessionId) {
                  const guardErr = cerberus.guard(Cer_SessionId, { maxPulseIdle: 120000, maxByteIdle: 90000 });
                  if (guardErr) throw guardErr;
              }
              waveCount++;

              const waveNodes = [];
              const maxConcurrency = Cerberus.getInstance().getGitConcurrency();

              const pickCount = (waveCount === 1) ? Math.min(2, maxConcurrency) : 1;

              while (waveNodes.length < pickCount && nodePool.length > 0) {
                  waveNodes.push(nodePool.shift());
              }

              if (waveNodes.length === 0) {
                  if (waveCount === 1 || !activeCRS) waveNodes.push(githubNode);
                  else {
                      if (waveCount > 5) break;
                      waveNodes.push(githubNode);
                  }
              }

              if (waveNodes.length === 0) break;

              Hades.O(`${RidColored} ${logTag} | [Quo] 正在调度节点 [${waveNodes.map(n => n.name).join(', ')}]`);

              activeCRS = new MBTQuoCRS(logger, Rid, logTag, colorCode, signal);

              const v4Threshold = Proteus._setup.thresholdV4;
              const riskMode = (!Number.isFinite(getNodeLatency(waveNodes[0])) || getNodeLatency(waveNodes[0]) > v4Threshold || udpReach === false);
              const orderedWave = waveNodes.sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
              orderedWave.forEach((node, index) => {
                  const delay = getStartDelay(node, index, riskMode);
                  activeCRS.addTask(node.name, createTaskFactory(node), false, delay);
              });

              if (retryTimer) clearInterval(retryTimer);
              const waveStartTime = Date.now();
              let BPPJob = false;
              retryTimer = setInterval(() => {
                  if (activeCRS.closed) return;
                  const now = Date.now();
                  const elapsed = now - waveStartTime;

                  if (useGitHubAsBackup && elapsed >= 75000 && !BPPJob && !activeCRS.tasks.has('GitHub')) {
                      BPPJob = true;
                      activeCRS.addTask('GitHub', createTaskFactory(githubNode), true, 0);
                  }

                  const status = activeCRS.getStatus();

                  if (status.activeCount < 2 && status.maxProgress < 80 && nodePool.length > 0) {
                      const nextNode = nodePool.shift();
                      if (nextNode) {
                          const boostDelay = getStartDelay(nextNode, 1, riskMode);
                          activeCRS.addTask(nextNode.name, createTaskFactory(nextNode), false, boostDelay);
                      }
                  }

                  if (status.activeCount === 0 && !activeCRS.tasks.has('GitHub') && useGitHubAsBackup) {
                       activeCRS.addTask('GitHub', createTaskFactory(githubNode), true, 1000);
                  }
              }, 4500);

             try {
                  const winnerResult = await activeCRS.start();
                  if (!winnerResult || !winnerResult.tempRepoPath) throw new Error(`路径丢失`);

                  if (signal?.aborted) throw new Error(`提交前中止: ${signal.reason}`);

                  await MiaoPluginMBT.GitMutex.run(async () => {
                      if (repoNum === 1 && !(await Ananke.Audit(path.join(winnerResult.tempRepoPath, "CowCoo/html")))) {
                          const fatalErr = new Error("核心资源目录缺失 (校验失败)");
                          fatalErr.isFatal = true; throw fatalErr;
                      }

                      await Ananke.obliterate(finalLocalPath);
                      await Ananke.rename(winnerResult.tempRepoPath, finalLocalPath);
                  }, {
                      id: commitLockId,
                      instant: true
                  });

                  const gitLog = await Nomos.getRepoLog(finalLocalPath, 1);
                  if (Cer_SessionId) cerberus.finishSession(Cer_SessionId, true, { event: 'commit-ok', message: '下载提交完成' });
                  return { success: true, nodeName: winnerResult.nodeName, error: null, gitLog, mode: MODE, modeMsg: logModeMsg };

              } catch (waveError) {
                  if (waveError.isFatal) {
                      if (activeCRS) activeCRS.stop(); throw waveError;
                  }
                  activeCRS.stop();

                  if (MODE === 'NATIVE' && !AirlockRetry) {
                      Hades.W(`${RidColored} 模式失败，正在切换至气闸模式`);
                      AirlockRetry = true;
                      MODE = 'AIRLOCK_PROXY';
                      useAirlock = true;
                      inheritEnv = false;

                      const airlockNodes = mirrorNodes
                          .filter(n => PoseidonSpear.isLive(n.name))
                          .sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
                      if (airlockNodes.length > 0) {
                          nodePool.length = 0;
                          nodePool.push(...airlockNodes);
                          await common.sleep(1000);
                          continue;
                      }
                  }

                  if (isShuttingDown) break;
                  if (nodePool.length === 0) {
                      if (useGitHubAsBackup) {
                          nodePool.push(githubNode);
                          useGitHubAsBackup = false;
                          continue;
                      }

                      if (Cer_SessionId) cerberus.finishSession(Cer_SessionId, false, { event: 'all-failed', code: waveError?.code, message: waveError?.message });
                      return { success: false, nodeName: "全部失败", error: waveError, mode: MODE, modeMsg: logModeMsg };
                  }
                  await common.sleep(2000);
              }
          }
          if (Cer_SessionId) cerberus.finishSession(Cer_SessionId, false, { event: 'exhausted', code: 'E_ALL_NODE_FAILED', message: '所有可用节点均尝试失败' });
          return { success: false, nodeName: "全部失败", error: new Error("所有可用节点均尝试失败"), mode: MODE, modeMsg: logModeMsg };

      } catch (SmartErr) {
          Hades.E(`${RidColored} ${logTag} 调度失败:${SmartErr.message}`);
          if (Cer_SessionId) cerberus.finishSession(Cer_SessionId, false, { event: 'smart-failed', code: SmartErr?.code, message: SmartErr?.message });
          return { success: false, nodeName: "全部失败", error: SmartErr, mode: MODE, modeMsg: logModeMsg };
      } finally {
          SignalTrap.off('shutdown', onShutdown);
          SignalTrap.off('reload', onShutdown);
          if (retryTimer) clearInterval(retryTimer);
          if (activeCRS) activeCRS.stop();
      }
  }

  static async UpstreamSyncRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, logger, senseChain) {
    return await MiaoPluginMBT.GitMutex.run(async () => {
      const Hades = getHades(logger);
      const state = {
        success: false, hasChanges: false, error: null, wasHardReset: false,
        autoSwitchedNode: null, newCommitsCount: 0, diffStat: null, MBTCoreChange: false, log: null
      };

      const collectGitErrText = (err) => (`${err?.rawStderr || ""}\n${err?.stderr || ""}\n${err?.message || ""}`).toLowerCase();

      const cfg = MiaoPluginMBT.MBTConfig || {};
      const basePullTimeout = Math.max(
        Number(cfg.PullTimeout ?? DFC.PullTimeout) || 0,
        RepoNum === 1 ? (Number(cfg.PullTimeoutCore ?? DFC.PullTimeoutCore) || 480000) : (Number(cfg.PullTimeoutAss ?? DFC.PullTimeoutAss) || 240000)
      );

      const parseGitHubRepoPath = (raw) => {
        const hit = String(raw || "").trim().match(/github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?(?:[/?#].*)?$/i);
        return hit?.[1]?.replace(/\.git$/i, "") || "";
      };

      const mergePipeOpts = (base_opts = {}, override_opts = {}) => {
        const merged = { ...base_opts, ...override_opts };

        if (override_opts.env === null) {
          merged.env = null;
        } else if (base_opts.env || override_opts.env) {
          merged.env = { ...(base_opts.env || {}), ...(override_opts.env || {}) };
        }

        if (base_opts.constraints || override_opts.constraints) merged.constraints = { ...(base_opts.constraints || {}), ...(override_opts.constraints || {}) };
        merged.gitConfigs = [...new Set([...(base_opts.gitConfigs || []), ...(override_opts.gitConfigs || [])])];
        return merged;
      };

      const mode = senseChain?.mode;
      const execCtx = senseChain?.executionContext || {};
      const vector = senseChain?.vector || {};
      const smartConfigs = [];

      if (execCtx.isAirlock || vector.udpReach === false) smartConfigs.push("http.version=HTTP/1.1");
      if (mode === Proteus.State.V6_TURBO) smartConfigs.push("core.ipv6=true");
      if (execCtx.isAirlock) smartConfigs.push("http.proxy=", "https.proxy=", "core.gitProxy=");

      const initial_pipe_opts = {
        inheritEnv: execCtx.inheritEnv, env: execCtx.gitEnv, gitConfigs: smartConfigs,
        airlock: !!execCtx.isAirlock, preferV6: mode === Proteus.State.V6_TURBO,
        constraints: { zombieThreshold: 60 * 1000, low_Speed_Limit: 10240, low_Speed_Strikes: 3 }
      };

      const getModePullTimeout = (m) => {
        if (m === Proteus.State.NATIVE || m === Proteus.State.V6_TURBO) return Math.max(90000, Math.min(basePullTimeout, RepoNum === 1 ? 240000 : 180000));
        if (m === Proteus.State.USER_AGENT || m === Proteus.State.IDLE_AGENT) return Math.max(120000, Math.min(basePullTimeout, RepoNum === 1 ? 300000 : 210000));
        return basePullTimeout;
      };

      const executeSyncLogic = async (pipe_opts = {}, pull_timeout = basePullTimeout) => {
        const result = { success: false, hasChanges: false, error: null, wasHardReset: false, newCommitsCount: 0, diffStat: null, MBTCoreChange: false };
        const run_opts = { cwd: localPath, ...pipe_opts };

        try {
          const oldCommit = (await MBTPipeControl("git", ["rev-parse", "HEAD"], run_opts, 5000).catch(() => ({ stdout: "" }))).stdout.trim();
          try {
            await MBTPipeControl("git", ["pull", "origin", branch, "--ff-only", "--progress"], run_opts, pull_timeout);
            result.success = true;
          } catch (err) {
            const stderr = (err.rawStderr || err.stderr || "").toLowerCase();
            const isConflict = [
              "not possible to fast-forward", "diverging branches", "unrelated histories", "needs merge",
              "commit your changes or stash them", "your local changes to the following files would be overwritten",
              "untracked working tree files would be removed", "please move or remove them before you merge"
            ].some(k => stderr.includes(k));

            if (err.code !== 0 && isConflict) {
              try {
              Hades.W(`${RepoName} 检测到冲突正在执行强制重置...`);
                await MBTPipeControl("git", ["fetch", "origin"], run_opts, pull_timeout);
                await MBTPipeControl("git", ["reset", "--hard", `origin/${branch}`], run_opts);
                result.success = true;
                result.wasHardReset = true;
              } catch (resetErr) { result.error = resetErr; }
            } else {
              result.error = err;
            }
          }

          if (result.success) {
            const newCommit = (await MBTPipeControl("git", ["rev-parse", "HEAD"], run_opts, 5000).catch(() => ({ stdout: "" }))).stdout.trim();
            if ((oldCommit && newCommit && oldCommit !== newCommit) || result.wasHardReset) {
              result.hasChanges = true;
              if (oldCommit && newCommit) {
                try {
                  const diffOut = (await MBTPipeControl("git", ["diff", "--shortstat", oldCommit, newCommit], run_opts, 5000)).stdout.trim();
                  result.diffStat = { insertions: parseInt((diffOut.match(/(\d+)\s+insertion/) || [0,0])[1]), deletions: parseInt((diffOut.match(/(\d+)\s+deletion/) || [0,0])[1]) };
                  result.newCommitsCount = parseInt((await MBTPipeControl("git", ["rev-list", "--count", `${oldCommit}..${newCommit}`], run_opts, 5000)).stdout.trim()) || 1;
                  if (RepoNum === 1) result.MBTCoreChange = (await MBTPipeControl("git", ["diff", "--name-only", oldCommit, newCommit], run_opts, 5000)).stdout.trim().includes("咕咕牛图库管理器.js");
                } catch {}
              } else result.newCommitsCount = 1;
            }
          }
        } catch (fatalErr) { result.error = fatalErr; }
        return result;
      };


      Hades.D(`[Phase 1] ${RepoName} 模式=${Proteus._describe(mode)}`);
      let syncResult = await executeSyncLogic(initial_pipe_opts, getModePullTimeout(mode));

      if (!syncResult.success) {
        const syncErrText = collectGitErrText(syncResult.error);
        const isNetErr = !!syncResult.error && (GIT_TIMEOUT_ERR_CODES.has(String(syncResult.error.code).toUpperCase()) || GIT_NETWORK_ERR_KEYWORDS.some(k => syncErrText.includes(k)));


        if (isNetErr) {
          const currentRemote = (await MBTPipeControl("git", ["remote", "get-url", "origin"], { cwd: localPath }).catch(() => ({ stdout: "未知" }))).stdout.trim() || "未知";
          Hades.W(`[Phase 2] ${RepoName} 网络波动[源:${currentRemote}]`);

          let repo_path = parseGitHubRepoPath(RepoUrl) || parseGitHubRepoPath(currentRemote);
          const github_url = repo_path ? `https://github.com/${repo_path}.git` : "";
          const rollback_remote = github_url || currentRemote;

          const rollback_origin = async (reason) => {
            if (rollback_remote && rollback_remote !== "未知") {
              await MBTPipeControl("git", ["remote", "set-url", "origin", rollback_remote], { cwd: localPath }).catch(()=>{});
              Hades.D(`Rollback ${RepoName} 已回滚 origin (${reason})`);
            }
          };

          let orderNodes = [];
          try {
            const probe_rows = await MiaoPluginMBT.TestCaVoice(Hades);
            const survivors = probe_rows.filter(r => r.speed !== Infinity && r.name !== 'GitHub');

            if (survivors.length > 0) {
              const git_jobs = survivors.map(row =>
                MiaoPluginMBT.TestGitVoice(row.ClonePrefix, row.name, Hades)
                  .then(res => ({ name: row.name, gitResult: res }))
                  .catch(err => ({ name: row.name, gitResult: { success: false, error: err } }))
              );
              const git_rows = await Promise.all(git_jobs);
              orderNodes = await MiaoPluginMBT.AdaptiveSpeed(probe_rows, git_rows, Hades);
              orderNodes = orderNodes.filter(n => n.name !== 'GitHub');
              Hades.D(`[Phase 2] 镜像序=[${orderNodes.map(n => n.name).join(', ')}]`);
            } else {
              orderNodes = (DFC.F2Pool || [])
                .filter(n => n.name !== 'GitHub' && n.ClonePrefix)
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            }
          } catch (e) {
            Hades.E(`[Phase 2] 路由异常:`, e);
            orderNodes = (DFC.F2Pool || [])
              .filter(n => n.name !== 'GitHub' && n.ClonePrefix)
              .sort((a, b) => (a.priority || 999) - (b.priority || 999));
          }

          for (const winner of orderNodes) {
            if (!repo_path || !winner.name || !winner.ClonePrefix) continue;
            if (!PoseidonSpear.isLive(winner.name)) {
              continue;
            }

            const newUrl = `${winner.ClonePrefix.replace(/\/$/, "")}/github.com/${repo_path}.git`;

            try {
              const cleanOpts = { ...initial_pipe_opts, env: null, inheritEnv: false };
              await MBTPipeControl("git", ["remote", "set-url", "origin", newUrl], { cwd: localPath, ...cleanOpts });

              const lsResult = await MBTPipeControl(
                "git", ["ls-remote", "--heads", "origin", branch],
                { cwd: localPath, ...cleanOpts }, 8000
              ).catch(() => ({ stdout: "" }));

              if (!lsResult.stdout.trim()) {
                Hades.D(`[Phase 2] ${winner.name} ls-remote空,跳过`);
                await rollback_origin(`${winner.name}-head-empty`);
                continue;
              }

              syncResult = await executeSyncLogic(cleanOpts, basePullTimeout);
              if (syncResult.success) {
                state.autoSwitchedNode = winner.name;
                Hades.D(`[Phase 2] 镜像成功[${winner.name}]`);
                break;
              }
              await rollback_origin(`${winner.name}-sync-fail`);
            } catch (e) {
              await rollback_origin(`${winner.name}-error`);
            }
          }

          if (!syncResult.success && github_url) {
            Hades.W(`[Phase 3] ${RepoName} GitHub 竞速组模式唤起`); 
            const stage_rows = [
              { name: "Stage-1(直连)", opts: { inheritEnv: false, env: null } },
              { name: "Stage-2(H1+剥离)", opts: { inheritEnv: false, env: null, gitConfigs: ["http.version=HTTP/1.1", "http.proxy=", "https.proxy=", "core.gitProxy="] } }
            ];

            for (const stage of stage_rows) {
              try {
                const stage_opts = mergePipeOpts(initial_pipe_opts, stage.opts);
                await MBTPipeControl("git", ["remote", "set-url", "origin", github_url], { cwd: localPath, ...stage_opts });
                syncResult = await executeSyncLogic(stage_opts, 25000);
                if (syncResult.success) {
                  state.autoSwitchedNode = "GitHub";
                  break;
                }
                await rollback_origin(`${stage.name}-fail`);
              } catch (e) { await rollback_origin(`${stage.name}-error`); }
            }
          }
        } else {
           Hades.E(`[Phase 1] ${RepoName} 发生非网络致命错误。`);
        }
      }

      Object.assign(state, syncResult);
      if (e && !isScheduled && !syncResult.success) Promise.resolve(Pheme.send(e, `咕咕牛图库的 ${RepoName} 同步失败，请查看失败详情。`)).catch(() => {});

      try {
        const rawLog = (await MBTPipeControl("git", ["log", `-n ${RepoNum === 1 ? 5 : 3}`, `--date=${DFC.logDateFormat}`, `--pretty=format:%cd [%h]%n%s%n%b`], { cwd: localPath }, 5000)).stdout;
        if (rawLog) {
          const entries = rawLog.split(/(?=\d{2}-\d{2}\s\d{2}:\d{2}\s+\[)/).filter(s => s.trim());
          const BtnFaceUrl = toFileUrl(path.join(MiaoPluginMBT.Paths.OpsPath, "img", "icon", "null-btn.png"));
          state.log = await Promise.all(entries.map(async (entry) => {
            const lines = entry.trim().split('\n');
            const header = lines.shift() || ""; const subject = lines.shift() || ""; const body = lines.join('\n').trim();
            const commit = { hash: (header.match(/\[([a-f0-9]+)\]/) || [])[1] || 'N/A', date: (header.match(/^(\d{2}-\d{2}\s\d{2}:\d{2})/) || [])[1] ? `[${RegExp.$1}]` : '', commitTitle: subject.trim(), descriptionBodyHtml: '', isDescription: true, displayParts: [], commitScopeClass: 'scope-default' };
            const ccMatch = subject.match(/^([a-zA-Z\u4e00-\u9fa5]+)(?:\(([^)]+)\))?[:：]\s*(?:\[([^\]]+)\]\s*)?(.+)/);
            if (ccMatch) {
              const rawPrefix = ccMatch[1].toLowerCase();
              commit.commitPrefix = COMMIT_PREFIX_MAP[rawPrefix] || rawPrefix;
              commit.commitScope = ccMatch[2] || ccMatch[3]; commit.commitTitle = ccMatch[4].trim();
              if (commit.commitScope) commit.commitScopeClass = commit.commitScope.toLowerCase().includes('web') ? 'scope-web' : (commit.commitScope.toLowerCase().includes('core') ? 'scope-core' : 'scope-default');
            }
            if (body) {
              let html = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
              let inList = false;
              html = html.split('\n').map(line => {
                line = line.trim();
                if (line.startsWith('###')) return `<h3>${line.replace(/###\s*/, '')}</h3>`;
                if (line.startsWith('- ')) { const item = `<li>${line.replace(/-\s*/, '')}</li>`; if (!inList) { inList = true; return `<ul>${item}`; } return item; }
                if (inList) { inList = false; return `</ul><p>${line}</p>`; }
                return line ? `<p>${line}</p>` : '';
              }).join('');
              if (inList) html += '</ul>';
              commit.descriptionBodyHtml = html;
            }
            for (const gp of COMMIT_GAME_PREFIXES) {
              if (gp.pattern.test(commit.commitTitle)) {
                commit.isDescription = false;
                const names = commit.commitTitle.replace(gp.pattern, '').split(/[/、，,]/).map(n => n.trim()).filter(Boolean);
                for (const rawName of names) {
                  let displayName = rawName;
                  const aliasRes = await Tianshu.NormalizeName(rawName, { gameKey: gp.key });
                  if (aliasRes.exists) displayName = aliasRes.mainName;
                  let faceUrl = BtnFaceUrl;
                  if (gp.key === 'gs' || gp.key === 'sr') faceUrl = await Tianshu.ResolveFace(gp.key, displayName) || BtnFaceUrl;
                  else if (gp.key === 'zzz') faceUrl = await this._resolveZZZTitleFaceUrl(displayName) || BtnFaceUrl;
                  else if (gp.key === 'waves') faceUrl = MiaoPluginMBT._wavesRoleDataMap?.get(displayName)?.icon || BtnFaceUrl;
                  commit.displayParts.push({ type: 'character', name: displayName, game: gp.key, imageUrl: faceUrl });
                }
                break;
              }
            }
            return commit;
          }));
        } else throw new Error("日志内容为空");
      } catch {
        state.log = [{ isDescription: true, commitTitle: "无有效提交记录或获取失败", hash: 'N/A', date: '', commitPrefix: null, descriptionBodyHtml: '' }];
      }

      return state;
    }, { id: `UpstreamSyncRepo-${RepoNum}` });
  }

  static async TestGitVoice(ClonePrefix, nodeName, logger = getCore()) {
    const MAX_RETRIES = 3;
    const TIMEOUT = 15000;
    const Hades = getHades(logger);
    const repoPool = (await Nomos.CleanDataPool('RepoPool', logger))
        .map(url => url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)?.[1])
        .filter(Boolean);

    if (repoPool.length === 0) {
        return {
            success: false,
            duration: Infinity,
            error: new Error("远端仓库池为空"),
            isDisguised: true,
            metrics: null
        };
    }

    const pickTarget = (excludeSet) => {
        const candidates = repoPool.filter(r => !excludeSet.has(r));
        if (candidates.length === 0) return repoPool[0];
        return candidates[Math.floor(Math.random() * candidates.length)];
    };

    const triedTargets = new Set();
    let attempt = 0;
    let lastError = null;
    let accumulated_Metrics = { rx_bytes: 0, io_chunks: 0, instability: 0 };

    while (attempt < MAX_RETRIES) {
        attempt++;
        const targetRepo = pickTarget(triedTargets);
        triedTargets.add(targetRepo);

        const isDirect = !ClonePrefix || nodeName === "GitHub";
        const cleanPrefix = ClonePrefix ? ClonePrefix.replace(/\/$/, "") : "";

        const actualUrl = isDirect
            ? `https://github.com/${targetRepo}.git`
            : `${cleanPrefix}/github.com/${targetRepo}.git`;

        if (attempt > 1) {
            //Hades.D(`[Git测速重试 ${attempt}/${MAX_RETRIES}] 节点: ${nodeName} | 切换靶标: ${targetRepo}`);
        }

        const startTime = Date.now();

        const result = await MBTPipeControl("git", ["ls-remote", "--heads", actualUrl], { airlock: true }, TIMEOUT)
            .then((res) => {
                if (res.metrics) {
                    accumulated_Metrics.rx_bytes += (res.metrics.rx_bytes || 0);
                    accumulated_Metrics.io_chunks += (res.metrics.io_chunks || 0);
                    accumulated_Metrics.instability += (res.metrics.instability || 0);
                }
                return {
                    success: true,
                    duration: Date.now() - startTime
                };
            })
            .catch((err) => {
                if (err.metrics) {
                    accumulated_Metrics.rx_bytes += (err.metrics.rx_bytes || 0);
                    accumulated_Metrics.io_chunks += (err.metrics.io_chunks || 0);
                    accumulated_Metrics.instability += (err.metrics.instability || 0);
                }
                lastError = err;
                return null;
            });

        if (result) {
            return {
                success: true,
                duration: result.duration,
                metrics: accumulated_Metrics,
                isDisguised: true
            };
        }
    }

    return {
        success: false,
        duration: Infinity,
        error: lastError,
        isDisguised: true,
        metrics: accumulated_Metrics
    };
  }

static async ProvisionPhase(e, logger = getCore(), stage = 'full') {
    const Hades = getHades(logger);
    try {
      await MiaoPluginMBT.SSF();
      MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
          MiaoPluginMBT.Paths.ConfigFilePath,
          DFC,
          Hades
      );

      if (stage === 'core') return;

      const imageData = await MiaoPluginMBT.ImgMetaAC(true, Hades);
      MiaoPluginMBT._MetaCache = Object.freeze(imageData);
      await MiaoPluginMBT.MetaHub.AC(true);

      await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, Hades);

      if (MiaoPluginMBT.MBTConfig.Repo_Ops) {
        await MiaoPluginMBT.SCD(Hades);
      }

      if (stage === 'full') {
        try {
          await Ananke.writeText(MiaoPluginMBT.Paths.ProvisionPath, new Date().toISOString());
        } catch (lockError) {
          Hades.E(`创建状态标记文件失败:`, lockError);
        }
      }
    } catch (error) {
      Hades.E(`ProvisionPhase[${stage}] 致命错误:`, error);
      if (e) {
        await DocHub.report(e, `安装设置 (${stage}阶段)`, error, "", Hades);
      }
      throw error;
    } finally {}
  }

 static async HydrateCore(e, isScheduled = false, logger = getCore()) {
    const Hades = getHades(logger);
    try {
      MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
          MiaoPluginMBT.Paths.ConfigFilePath,
          DFC,
          Hades
      );

      const imageData = await MiaoPluginMBT.ImgMetaAC(true, Hades);
      MiaoPluginMBT._MetaCache = Object.freeze(imageData);
      await MiaoPluginMBT.MetaHub.AC(true);
      await MiaoPluginMBT.SSF();
      await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, Hades);
      if (MiaoPluginMBT.MBTConfig.Repo_Ops) {
        await MiaoPluginMBT.SCD(Hades);
      } else {
        Hades.D(`图库已禁用，跳过角色图片同步。`);
      }

    } catch (error) {
      Hades.E(`执行过程中发生错误:`, error);
      if (!isScheduled && e) await DocHub.report(e, "更新后设置", error, "", Hades);
      else if (isScheduled) {
          const Report = DocHub._diagnose("更新后设置(定时)", error, "");
          Hades.E(`--- 定时更新后设置失败 ----\n${Report.summary}\n${Report.suggestions}\n---`);
      }
    }
  }

  static async TestCaVoice(logger = getCore()) {
    const Hades = getHades(logger);
    const timeoutDuration = DFC.ProxyRepoTimeout;
    const maxRetries = 3;
    let attempt = 0;
    let harvest = [];
    let isSuccess = false;

    while (attempt < maxRetries && !isSuccess) {
      attempt++;
      const targetRawUrl = await Hermes.getRandomRawTarget(Hades);
      if (!targetRawUrl) {
        break;
      }

      const promises = DFC.F2Pool.map(async (proxy) => {
        const result = {
          name: proxy.name || "未命名",
          priority: proxy.priority || 999,
          ClonePrefix: proxy.ClonePrefix,
          TestUrlPrefix: proxy.TestUrlPrefix,
          protocol: 'HTTP',
          speed: Infinity
        };

        let testUrl = "";
        if (proxy.name === "GitHub") {
           testUrl = targetRawUrl;
        } else if (proxy.TestUrlPrefix) {
           testUrl = Hermes.BuildMirrProbe(proxy.TestUrlPrefix, targetRawUrl);
        }

        if (testUrl) {
          try {
            const latResult = await Hermes.ProbeSpeed(testUrl, timeoutDuration);
            if (latResult.success) {
              result.speed = latResult.data;
            }
          } catch (err) {
            result.speed = Infinity;
          }
        }
        return result;
      });

      const settled_rows = await Promise.allSettled(promises);
      harvest = settled_rows.map((item, index) => {
        if (item.status === 'fulfilled') return item.value;
        const proxy = DFC.F2Pool[index] || {};
        return {
          name: proxy.name || `Node-${index}`,
          priority: proxy.priority || 999,
          ClonePrefix: proxy.ClonePrefix,
          TestUrlPrefix: proxy.TestUrlPrefix,
          protocol: 'HTTP',
          speed: Infinity
        };
      });

      const validNodes = harvest.filter(r => r.speed !== Infinity);
      if (validNodes.length > 0) {
        isSuccess = true;
      }
    }

    if (!isSuccess) {
      Hades.D(`测速所有尝试均失败，网络可能存在问题。`);
    }

    return harvest;
  }

  static async AdaptiveSpeed(HttpResultMap, GitRTTs, logger = getCore(), preferDirect = false) {
    const Hades = getHades(logger);
    if (preferDirect) {
      const githubNode = HttpResultMap.find(n => n.name === 'GitHub');
      if (githubNode?.speed !== Infinity) {
        return [{ ...githubNode, gitResult: { success: true }, protocol: 'GIT', latency: githubNode.speed }];
      }
    }

    if (!Array.isArray(GitRTTs)) {
      Hades.E(`矢量权重栈接收到不是一个数组！`);
      GitRTTs = [];
    }

    const UNVERIFIED_PENALTY = 5000;
    const PRIORITY_FACTOR = 50;
    const JITTER_PENALTY_FACTOR = 20;

    const gitEliteNodesMap = new Map(
      GitRTTs
        .filter(n => n.gitResult?.success)
        .map(n => [n.name, n.gitResult])
    );

    const nodeList = HttpResultMap.map(node => {
      const gitResult = gitEliteNodesMap.get(node.name);
      const isGitReliable = gitResult?.success && gitResult.duration > 100;

      const protocol = isGitReliable ? 'GIT' : 'HTTP';
      const rawLatency = isGitReliable ? gitResult.duration : node.speed;

      let trustPri = 999;
      let bonus = 0;

      const prefix = node.ClonePrefix ? node.ClonePrefix.trim() : null;

      if (node.name === "GitHub") {
          trustPri = 500;
      } else if (prefix && MiaoPluginMBT.#TopoMap.has(prefix)) {
          trustPri = MiaoPluginMBT.#TopoMap.get(prefix);
      } else {
          trustPri = 999;
          bonus = UNVERIFIED_PENALTY;
      }

      const instability = gitResult?.metrics?.instability || 0;
      const jitterPenalty = instability * JITTER_PENALTY_FACTOR;
      const score = rawLatency + (trustPri * PRIORITY_FACTOR) + bonus + jitterPenalty;

      return {
        ...node,
        priority: trustPri,
        gitResult: isGitReliable ? gitResult : { success: true, isRelief: true },
        protocol,
        latency: rawLatency,
        instability,
        score: score
      };
    });

    nodeList.sort((a, b) => a.score - b.score);
    return nodeList.filter(n => n.latency !== Infinity);
  }

  static async SendMasterMsg(msg, e = null, delay = 0) {
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
          const configPath = path.join(MiaoPluginMBT.Paths.YzPath, 'config', 'config', 'other.yaml');
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

  async ReconcileTask() {
    if (!this.logger) this.logger = Hades;
    const zzzIns = await Ananke.Audit(MiaoPluginMBT.Paths.ZZZPluginPath);
    const waveIns = await Ananke.Audit(MiaoPluginMBT.Paths.WavesPluginPath);
    const repoContext = { zIn: zzzIns, wIn: waveIns };
    const repo1State = await MiaoPluginMBT.GetRepoState(1, repoContext, { ExistsDis: true });
    if (!repo1State?.exists) {
      this.logger.debug(`图库未下载，跳过本次任务。`);
      return;
    }
    const Marking = await Ananke.Audit(MiaoPluginMBT.Paths.ProvisionPath, false);
    if (!Marking) await Ananke.writeText(MiaoPluginMBT.Paths.ProvisionPath, new Date().toISOString()).catch(() => {});
    this.logger.debug(`开始定时更新...`);
    const startTime = Date.now();
    let HasAnyChanges = false;
    try {
      Nomos.ensureCRPP({ force: true, logger: this.logger, busyWaitMs: 60000 })
            .catch(() => {});
      HasAnyChanges = await this.Reconcile(null, true);
      this.logger.debug(`定时更新完成,有更新:${HasAnyChanges}`);
    } catch (error) {
      this.logger.error(`定时更新异常:`, error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.debug(`定时更新结束,耗时 ${duration}s`);
    }
  }

  static async acquireChain(logger = getCore()) {
    const Hades = HadesEntry({}, logger);
    let globalSenseChain = null;
    try {
        const envData = await Hermes.getEnvInfo(Hades);
        globalSenseChain = await Proteus.sense(envData, Infinity, Hades);
        Hades.D(`全局态势模式=${Proteus._describe(globalSenseChain.mode)}`);
    } catch (err) {
        Hades.W(`全局态势失败,降级: ${err.message}`);
    }
    return globalSenseChain;
  }

  async CronSweep() {
    this.logger.debug(`开始系统维护...`);

    const LockStatus = getLockStatus();

    for (const { lock, name, maxAge } of LockStatus) {
        const stats = lock.getStats();
        if (stats.locked && stats.uptime > maxAge) {
            this.logger.warn(`检测到僵死锁[${name}] 持有:${stats.holder} 时长:${stats.uptime}ms,强制重置`);
            lock.emergencyReset('CronSweep清理僵死锁');
        }
    }

    const cleanTasks = [
        Ananke.obliterate(MiaoPluginMBT.Paths.TempDownloadPath, 3, 500),
        (async () => {
            try {
                const targets = await getTempHtmlTargets(TEMP_HTML_CRON_KEYWORDS);
                await Promise.all(targets.map(p => Ananke.obliterate(p)));
            } catch (e) { if (e.code !== 'ENOENT') this.logger.warn(`HTML清理异常:${e.message}`); }
        })(),
        Morpheus.housekeeping(this.logger),
        (async () => {
            try {
                const lockFile = MiaoPluginMBT.Paths.ProvisionPath;
                const Marking = await Ananke.Audit(lockFile, false);
                if (!Marking) return;
                const repoExists = await MiaoPluginMBT.ICI();
                if (!repoExists) {
                    await Ananke.obliterate(lockFile);
                }
            } catch {}
        })(),
        (async () => {
            try {
                const gitDir = path.join(MiaoPluginMBT.Paths.YzPath, 'temp', 'CowCoo', 'Network', 'CowCooResPool', '.git');
                if (fs.existsSync(gitDir)) {
                    await MBTPipeControl('git', ['gc', '--auto', '--quiet'],
                        { cwd: path.dirname(gitDir), Rid: 'CronGC', caDisabled: true }, 15000
                    ).catch(() => {});
                }
            } catch {}
        })()
    ];

    await Promise.allSettled(cleanTasks);

    const ensureDirs = [
        MiaoPluginMBT.Paths.TempNiuPath,
        MiaoPluginMBT.Paths.TempDownloadPath,
        path.join(YzPath, "resources", "Community"),
        path.dirname(MiaoPluginMBT.Paths.WorkerPath)
    ];
    await Promise.all(ensureDirs.map(p => Ananke.mkdirs(p).catch(() => {})));

    this.logger.debug(`咕咕牛系统维护完成。`);
  }

  async CheckInit(e) {
    const logger = this.logger || getCore();
    const Hades = HadesEntry({}, logger);
    const states = MiaoPluginMBT.LifecycleStates;
    const lifecycleState = MiaoPluginMBT._getLifecycleState();

    if (lifecycleState === states.TEARING_DOWN) {
        Hades.W(`拒绝新初始化请求。`);
        await Pheme.notReady(e);
        return false;
    }

    if (lifecycleState === states.UNINITIALIZED) {
        Hades.D(`检测到生命周期总线未启动，正在尝试惰性初始化...`);
        try {
            await MiaoPluginMBT.init(Hades);
        } catch (err) {
            Hades.E(`惰性初始化失败:`, err);
        }
    }

    if (MiaoPluginMBT._getLifecycleState() === states.READY && !MiaoPluginMBT.InitPromise) {
        MiaoPluginMBT.InitPromise = Promise.resolve(true);
    }

    const pendingInit = MiaoPluginMBT.InitPromise || MiaoPluginMBT.#pendingInit;
    if (!pendingInit) {
        Hades.E(`高危: CheckInit无法建立初始化`);
        await Pheme.initFail(e);
        return false;
    }

    try {
        await pendingInit;
        this.PFSCReady = MiaoPluginMBT._getLifecycleState() === states.READY && MiaoPluginMBT.BootStrap;
    } catch (err) {
        this.PFSCReady = false;
        Hades.D(`等待初始化完成时捕获到异常。`);
    }

    if (!this.PFSCReady) {
        await Pheme.notReady(e);
        return false;
    }

    const isCoreRepoValid = await MiaoPluginMBT.ICI();
    if (MiaoPluginMBT._MetaCache.length === 0 && isCoreRepoValid) {
        return true;
    }
    return true;
  }

  async Provision(e) {
    const Hades = this.logger;
    let HotSwap = false;

    if (!MiaoPluginMBT.BootStrap) {
        try {
            MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
                MiaoPluginMBT.Paths.ConfigFilePath,
                DFC,
                Hades
            );
        } catch {}
    } else {
        await MiaoPluginMBT.InitPromise;
    }

    const userId = e.user_id;
    const commandName = "Provision";
    const cooldownDuration = 2 * 60;
    let redisKey = null;

    const startTime = Date.now();
    const repoManifest = [];

    const MBTProcc = new MBTProcPool(Hades);
    let allSuccess = false;

    if (userId) {
      redisKey = `CowCoo:${commandName}:${userId}`;
      const ttl = await redis.ttl(redisKey);
        if (ttl > 0) {
          await Pheme.cooldown(e, ttl);
          return true;
        }
    }

    try {
        const RPD = await Nomos.ensureCRPP({ 
            force: true, 
            logger: Hades, 
            busyWaitMs: 60000
        });
        if (!RPD) {
            throw new Error('本地前置库同步失败');
        }
        const ctxReady = await MiaoPluginMBT._CtxPrep(Hades);
        if (!ctxReady) {
            throw new Error('节点配置加载失败');
        }

      try {
        await Ananke.mkdirs(MiaoPluginMBT.Paths.TempDownloadPath);
        const uniqueTestFile = path.join(MiaoPluginMBT.Paths.TempDownloadPath, `write_test_${Date.now()}.tmp`);
        await Ananke.writeText(uniqueTestFile, "test");
        await Ananke.obliterate(uniqueTestFile);
      } catch {
        throw new Error(`环境检查失败：无法写入临时目录，请检查权限。`);
      }

      const zzzIns = await Ananke.Audit(MiaoPluginMBT.Paths.ZZZPluginPath);
      const wavesIns = await Ananke.Audit(MiaoPluginMBT.Paths.WavesPluginPath);
      const repoContext = { zIn: zzzIns, wIn: wavesIns };

      const BMF = async (id) => {
        const state = await MiaoPluginMBT.GetRepoState(id, repoContext, { ExistsDis: true });
        if (!state) return { repo: id, status: 'skipped', nodeName: '未配置', success: true, reason: '仓库元信息缺失' };
        if (state.exists) {
          return { repo: id, status: 'skipped', nodeName: '本地', success: true, reason: '本地已存在' };
        }
        const isUrlValid = typeof state.url === 'string' && MiaoPluginMBT._CheckCtx(state.url);
        if (!isUrlValid) {
          return { repo: id, status: 'skipped', nodeName: '未配置', success: true, reason: '仓库地址缺失或无效' };
        }
        if (!state.isEnabled) {
          const reason = state.depsMet ? '未配置或禁用' : '依赖未满足';
          return { repo: id, status: 'skipped', nodeName: '未配置', success: true, reason };
        }
        return { repo: id, status: 'pending', nodeName: '等待中', success: false, reason: '可下载' };
      };

      for (let i = 1; i <= 6; i++) repoManifest.push(await BMF(i));

      const pendingRepos = repoManifest.filter(r => r.status === 'pending');
      if (repoManifest.every(r => r.status === 'skipped' && r.nodeName === '本地')) {
        if (redisKey) await redis.del(redisKey);
        return Pheme.quote(e, `咕咕牛图库的资产均已存在。`);
      }
      if (pendingRepos.length === 0) {
        const blocked = repoManifest
          .filter(r => r.status === 'skipped' && r.nodeName !== '本地')
          .map(r => `仓库${r.repo}:${r.reason || '未配置'}`)
          .join('；');
        if (redisKey) await redis.del(redisKey);
        return Pheme.quote(e, `『咕咕牛🐂』未发现可下载仓库已跳过下载流程。${blocked ? `\n${blocked}` : ''}`);
      }

      const coreManifest = repoManifest.find(r => r.repo === 1);
      if (coreManifest && coreManifest.status !== 'pending' && coreManifest.nodeName !== '本地') {
        if (redisKey) await redis.del(redisKey);
        return Pheme.quote(e, `『咕咕牛🐂』核心仓库前置校验未通过：${coreManifest.reason || '仓库地址无效'}。`);
      }

      const HttpResultMap = await MiaoPluginMBT.TestCaVoice(Hades);
      let validNodes = [];
      let capturedMode = "UNKNOWN";
      let capturedModeMsg = "未执行下载任务";

      try {
          const sortedNodes = await this._VoiceCore(e, Hades, HttpResultMap, [], startTime, 'Provision');
          validNodes = sortedNodes;
          await Pheme.quote(e, "测速结果仅供参考，实际下载将根据[CRS动态决策]选择最佳方式");
      } catch (err) {
          validNodes = HttpResultMap.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
      }

      if (redisKey) {
          try {
              await redis.set(redisKey, '1', { EX: cooldownDuration });
          } catch (err) {}
      }

      const globalSenseChain = await Promise.race([
          MiaoPluginMBT.acquireChain(Hades),
          new Promise((_, reject) => setTimeout(() => reject(new Error('态势感知获取超时')), 30000))
      ]).catch(err => {
          return null;
      });

      if (validNodes.length === 0) {
          validNodes = [{ name: "GitHub", ClonePrefix: "https://github.com/", protocol: 'HTTPS', speed: Infinity }];
      }

      const deployRepo = async (repoTask) => {
          const repoNum = repoTask.repo;
          const repoStart = Date.now();
          const meta = Nomos.MetaNum(repoNum);
          if (!meta) throw new Error(`未知的仓库编号: ${repoNum}`);
          const repoPath = MiaoPluginMBT.Paths[meta.pathKey];
          const repoUrl = Nomos.getRepoUrl(repoNum, MiaoPluginMBT.MBTConfig);
          let TheGrid = MiaoPluginMBT._PruneFatigue(validNodes)
          if (TheGrid.length === 0) TheGrid = validNodes;

          const branch = MiaoPluginMBT.MBTConfig.RepoBranch || "main";
          const runtimeContext = new RuntimeCtx();
          let senseChain = globalSenseChain;
          if (!senseChain) {
              const envData = await Hermes.getEnvInfo(Hades);
              const bestMirror = TheGrid.find(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
              const mirrorSpeed = bestMirror ? (bestMirror.time || Infinity) : Infinity;
              senseChain = await Proteus.sense(envData, mirrorSpeed, Hades);
          }
          runtimeContext.vectors = senseChain.vector;
          runtimeContext.decision = senseChain;
          const cerberus = Cerberus.getInstance();
          const sessionId = cerberus.beginSession({
              repo: repoNum,
              repoName: meta.name,
              source: 'Provision'
          });
          cerberus.pulse(sessionId, { event: 'session-start', state: 'running', progress: 0, bytes: 0 });

          const result = await MiaoPluginMBT.SmartTaskHeavy(
              runtimeContext, repoNum, repoUrl, branch,
              repoPath, e, Hades, TheGrid, MBTProcc, null, null, sessionId
          );

          const repoElapsed = Date.now() - repoStart;
          const bestNode = TheGrid[0];
          result.duration = `${(repoElapsed / 1000).toFixed(1)}s`;
          result.latency = bestNode?.speed && bestNode.speed !== Infinity ? `${bestNode.speed}ms` : '-';

          if (result.mode) {
              capturedMode = result.mode;
              capturedModeMsg = result.modeMsg;
          }

          const item = repoManifest.find(r => r.repo === repoNum);
          if (item) {
              item.status = result.success ? 'success' : 'fail';
              item.nodeName = result.nodeName;
              item.error = result.error;
              item.success = result.success;
          }

          if (!result.success) {
              if (repoNum === 1) throw new Error(`核心仓库下载失败: ${result.error?.message}`);
              else Hades.W(`附属仓库 ${repoNum} 下载失败，跳过: ${result.error?.message}`);
              return result;
          }

          if (validNodes.length >= 3) MiaoPluginMBT._BenchNode(result.nodeName.split('(')[0]);

          if (repoNum === 1) {
              HotSwap = true;
              await MiaoPluginMBT.ProvisionPhase(e, Hades, 'core');
              const sendReliefMsg = async () => {
                  await Pheme.send(e, "--『咕咕牛🐂』--\n核心仓已部署✅️\n开始聚合下载附属仓库...");
              };

              try {
                  const coreTplResult = await Nomos.getTemplate('core_repo_download.html', 'Provision');

                  if (coreTplResult.success && coreTplResult.data) {
                      const ViewProps = {
                        nodeName: result.nodeName,
                        duration: result.duration || '-',
                        latency: result.latency || '-',
                      };

                      const imgBuffer = await Morpheus.shot("Core_Repo_Download", {
                        htmlContent: coreTplResult.data,
                        data: ViewProps,
                        logger: Hades,
                        pageBoundingRect: { selector: ".container" },
                        transparentBackground: true
                      });

                      if (imgBuffer) {
                          await MiaoPluginMBT.ReplyImg(e, imgBuffer, '核心仓部署图片发送失败已文本通知。', Hades);
                      } else {
                          await sendReliefMsg();
                      }
                  } else {
                      await sendReliefMsg();
                  }
              } catch (err) {
                  Hades.E(`中场报告渲染异常:`, err);
                  await sendReliefMsg();
              }
          }
          return result;
      };

      const repo1Task = repoManifest.find(r => r.repo === 1 && r.status === 'pending');
      if (repo1Task) {
          await deployRepo(repo1Task);
      }

      const assJobs = repoManifest.filter(r => r.repo !== 1 && r.status === 'pending');
      if (assJobs.length > 0) {
          const MAX_CONCURRENCY = 2;
          const executing = [];
          let cumulativeDelay = 0;

          for (const task of assJobs) {
              const jitter = MBTMath.Range(3000, 6000);
              cumulativeDelay += jitter;

              const jobWrapper = (async () => {
                  Hades.D(`附属仓库 ${task.repo} 延迟 ${cumulativeDelay}ms 启动`);
                  await common.sleep(cumulativeDelay);
                  return deployRepo(task);
              })();

              const p = jobWrapper.then(() => {
                  executing.splice(executing.indexOf(p), 1);
              });

              executing.push(p);
              if (executing.length >= MAX_CONCURRENCY) {
                  await Promise.race(executing);
              }
          }
          await Promise.all(executing);
      }

      const FetchSuccess = repoManifest.every(r => r.status !== 'fail');
      let setupSuccess = false;

      try {
        await MiaoPluginMBT.ProvisionPhase(e, Hades, 'full');
        MiaoPluginMBT._applyLifecycleState(MiaoPluginMBT.LifecycleStates.READY);
        MiaoPluginMBT.InitPromise = Promise.resolve(true);
        MiaoPluginMBT.PFSCReady = true;
        setupSuccess = true;
      } catch (setupError) {
        Hades.E(`[Provision] ProvisionPhase失败:`, setupError);
        await DocHub.report(e, "安装部署 (full)", setupError, "所有仓库已下载，但最终配置失败。", Hades, 'Provision');
      }

      allSuccess = FetchSuccess && setupSuccess;
      await this._Debrief(e, repoManifest, startTime, allSuccess);

      if (HotSwap) {
          const BootWrapper = global[Boot_Ctrl];
          const BootCtrl = BootWrapper?.value;
          if (BootCtrl?.hotswapTimer) {
              clearTimeout(BootCtrl.hotswapTimer);
              BootCtrl.hotswapTimer = null;
          }

          const doSync = async () => {
              const trap = global[Trap_Symbol]?.value;
              if (trap?._isShuttingDown) return;
              try {
                  const hasChanges = await MiaoPluginMBT.SSF();
                  hasChanges && Hades.D(`核心已同步...`);
              } catch (err) {
                  Hades.E(`同步核心失败:`, err);
              }
          };

          if (BootCtrl) {
              BootCtrl.hotswapTimer = setTimeout(async () => {
                  BootCtrl.hotswapTimer = null;
                  if (BootCtrl.disposed || global[Boot_Ctrl] !== BootWrapper) return;
                  await doSync();
              }, 10000);
          } else {
              setTimeout(() => doSync(), 10000);
          }
      }
    } catch (error) {
      Hades.E(`下载流程顶层执行出错:`, error);
      if (e) {
        const ctxInfo = `耗时: ${((Date.now() - startTime)/1000).toFixed(1)}s`;
        await DocHub.report(e, "下载流程", error, ctxInfo, Hades, 'Provision');
      }
    } finally {
      MBTProcc.killAll('SIGTERM', 'Provision 下载流程结束');
      redisKey && !allSuccess && redis.del(redisKey).catch(() => {});
    }
    return true;
  }

  async _Debrief(e, repoManifest, startTime, allSuccess) {
      const HiddenRepos = [5, 6];
      const results = repoManifest.filter(r => !HiddenRepos.includes(r.repo)).map(r => {
          const name = RepoDisplayMap[r.repo] ?? `仓库 ${r.repo}`;

          if (r.status === 'skipped') {
              return r.nodeName === '本地'
                  ? { name, text: '已存在', statusClass: 'status-local', nodeName: '本地' }
                  : { name, text: '未配置', statusClass: 'status-na', nodeName: 'N/A' };
          }

          if (r.status === 'success') {
              const text = r.repo === 1 ? '下载/部署成功' : '下载成功';
              return { name, text, statusClass: 'status-ok', nodeName: r.nodeName };
          }

          return {
              name,
              text: '下载失败',
              statusClass: 'status-fail',
              nodeName: r.nodeName ?? '异常'
          };
      });

      const successCount = results.filter(r => ['status-ok', 'status-local'].includes(r.statusClass)).length;
      const configuredCount = results.length;
      const percent = configuredCount > 0 ? Math.round((successCount / configuredCount) * 100) : 0;
      const stars = '★'.repeat(successCount) + '☆'.repeat(Math.max(0, configuredCount - successCount));
      const failedRepos = repoManifest.filter(r => r.status === 'fail');
      const failDetailText = failedRepos.length > 0
        ? `\n失败详情：${failedRepos.map(r => {
            const name = RepoDisplayMap[r.repo] ?? `仓库 ${r.repo}`;
            const errCode = r.error?.code ? `(${r.error.code})` : '';
            const errMsg = r.error?.message ?? '未知错误';
            return `${name}${errCode}:${errMsg}`;
          }).join('；')}`
        : '';

      const ViewProps = {
          results,
          allOk: allSuccess,
          completedCount: successCount,
          configuredCount,
          percent,
          completionRate: percent,
          completionRateRounded: percent,
          stars,
          duration: ((Date.now() - startTime) / 1000).toFixed(1),
          bgImg: await Morpheus.pickBg(),
          isArray: Array.isArray,
      };

      try {
          const { success: tplOk, data: tplData } = await Nomos.getTemplate('download.html', 'Provision');
          let imgBuffer = null;

          if (tplOk && tplData) {
              imgBuffer = await Morpheus.shot("Download", {
                htmlContent: tplData,
                data: ViewProps,
                logger: this.logger,
                pageBoundingRect: { selector: ".wrapper" }
              });
          } else {
              this.logger.error(`获取下载报告模板失败`);
          }

          if (imgBuffer) {
              try {
                  await MiaoPluginMBT.ReplyImg(e, imgBuffer, '下载报告图片发送失败已文本回执。', this.logger);
              } catch (sendErr) {
                  this.logger.error(`下载报告图片发送失败:`, sendErr);
                  await Pheme.quote(e, `任务结束，但报告图片发送失败，已降级文本回执。(Code: ${sendErr?.code ?? 'SEND_FAIL'})${failDetailText}`);
              }
          } else {
              await Pheme.genFail(e, 'report');
          }

          if (allSuccess) {
              e.replyed || await Pheme.send(e, "『咕咕牛🐂』成功进入喵喵里面！").catch(() => {});
              await common.sleep(1500);
              await Pheme.quote(e, "建议配置[净化等级]否则风险自负。发送#咕咕牛设置净化等级1可过滤R18内容。");
          } else {
              await Pheme.send(e, `咕咕牛部分仓库下载失败，请检查上方日志或重试。${failDetailText}`);
          }

      } catch (err) {
          this.logger.error(`报告流程发生意外:`, err);
          await Pheme.genFail(e, 'report');
      }
  }

  async _ResolveRunMode(envInfo, mirrorSpeed = Infinity, senseChain = null, Hades = console) {
    const chain = senseChain || await Proteus.sense(envInfo, mirrorSpeed, Hades);
    const netMode = chain.mode;
    const proxyContext = chain.vector.proxyContext;
    const v6Lat = chain.vector.v6Lat;

    let runModeMsg = chain.desc;

    const isProxyInject = (netMode === Proteus.State.NATIVE || netMode === Proteus.State.IDLE_AGENT) && proxyContext;
    if (netMode === Proteus.State.V6_TURBO && Number.isFinite(v6Lat)) {
        runModeMsg = `${runModeMsg} -> 强制 GitHub [${v6Lat}ms]`;
    } else if (isProxyInject) {
        const proto = proxyContext.protocol || 'http';
        runModeMsg += ` [注入:${proto.toUpperCase()}:${proxyContext.port}]`;
    }

    return { runModeMsg };
  }

  async TestVoice(e) {
    const Hades = this.logger;
    await Pheme.quote(e, "📡 正在进行全量测速...");

    const startTime = Date.now();
    const taskCoreProbe = MiaoPluginMBT.TestCaVoice(Hades).then(async (httpResults) => {
        const validNodes = httpResults.filter(r => r.speed !== Infinity);
        const gitPromises = validNodes.map(n =>
            MiaoPluginMBT.TestGitVoice(n.ClonePrefix, n.name, Hades)
                .then(res => ({ name: n.name, gitResult: res }))
        );
        const gitResults = await Promise.all(gitPromises);
        return { httpResults, gitResults };
    });

    try {
        const { httpResults, gitResults } = await taskCoreProbe;
        await this._VoiceCore(e, Hades, httpResults, gitResults, startTime);
    } catch (err) {
        Hades.E(`测速异常:`, err);
        await Pheme.send(e, "测速过程中发生错误，请查看日志。");
    }
    return true;
  }

  async _VoiceCore(e, Hades, httpResults, gitResults = [], startTime, source = 'Stdin') {
    const taskEnvInfo = Hermes.getEnvInfo(Hades).catch(() => ({}));

    const sortedNodes = (gitResults?.length > 0)
        ? await MiaoPluginMBT.AdaptiveSpeed(httpResults, gitResults, Hades)
        : httpResults.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);

    try {
        const envInfo = await taskEnvInfo;
        const bestMirror = httpResults.find(r => r.name !== 'GitHub' && Number.isFinite(r.speed));
        const mirrorSpeed = bestMirror ? bestMirror.speed : Infinity;
        const senseChain = await Proteus.sense(envInfo, mirrorSpeed, Hades);
        const vector = senseChain.vector;

        let rxBytes = 0;
        let ioChunks = 0;

        if (gitResults && gitResults.length > 0) {
            gitResults.forEach(item => {
                if (item.gitResult && item.gitResult.metrics) {
                    rxBytes += (item.gitResult.metrics.rx_bytes || 0);
                    ioChunks += (item.gitResult.metrics.io_chunks || 0);
                }
            });
        }

        const trafficFormatted = await Ananke.measure(rxBytes, true);
        if (gitResults && gitResults.length > 0) {
             Hades.D(`测速总消耗流量: ${trafficFormatted} (IO: ${ioChunks})`);
        }

        const ping = async (host, port = 443) => {
            const start = Date.now();
            try {
                await Hermes.TcpProbe(host, port, 2000);
                return Date.now() - start;
            } catch { return Infinity; }
        };

        const [baiduMs, googleMs, githubMs, gitcodeMs] = await Promise.all([
            ping('www.baidu.com', 443),
            ping('www.google.com', 443),
            ping('github.com', 443),
            ping('gitcode.com', 443)
        ]);

        const maskIp = (ip) => {
            if (!ip || ip === 'N/A') return 'N/A';
            if (ip.includes('.')) return ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.*.*.$4');
            if (ip.includes(':')) {
                const parts = ip.split(':');
                if (parts.length >= 2) return `${parts[0]}:*:*:*:*:*:*:${parts[parts.length-1]}`;
                return ip.replace(/((?:[\da-fA-F]{1,4}:){2})(?:[\da-fA-F]{1,4}:)+((?:[\da-fA-F]{1,4}:){1})/, '$1****:$2');
            }
            return ip;
        };

        const extractCC = (src) => {
            return src?.countryCode || src?.country_code || src?.country || src?.geoData?.countryCode || src?.geoData?.country_code || src?.geoData?.country || src?.data?.country_code || src?.data?.country || '';
        };

        const network = envInfo.network || {};
        const inference = envInfo.inference || envInfo;

        let nativeV4Raw = network.native?.v4Ip || inference.v4Ip || "N/A";
        const nativeV4CC = extractCC(network.native || inference);
        const nativeV4 = maskIp(nativeV4Raw);

        const nativeV6Raw = network.native?.v6Ip || inference.v6Ip || "N/A";
        const nativeV6 = maskIp(nativeV6Raw);

        let browserV4Raw = network.browser?.v4?.ip || "N/A";
        let browserV4CC = extractCC(network.browser?.v4);
        if (!browserV4CC && browserV4Raw !== "N/A" && browserV4Raw === (network.native?.v4Ip || inference.v4Ip)) {
            browserV4CC = extractCC(network.native || inference);
        }
        const browserV4 = maskIp(browserV4Raw);

        const browserV6Raw = network.browser?.v6?.ip || "N/A";
        const browserV6 = maskIp(browserV6Raw);

        const geoSource = network.browser?.v4 || network.native || inference;
        const country = geoSource.country || geoSource.country_name || geoSource.country_code;
        const region = geoSource.regionName || geoSource.region || geoSource.region_name;
        const city = geoSource.city || geoSource.city_name;
        const isp = geoSource.isp || geoSource.org || geoSource.as;

        let geoParts = [];
        if (country) geoParts.push(country);
        if (region && region !== country) geoParts.push(region);
        if (city && city !== region && city !== country) geoParts.push(city);

        let clientGeo = geoParts.join(' / ') || "未知地区";
        if (isp) clientGeo += ` [${isp}]`;

        const { runModeMsg } = await this._ResolveRunMode(envInfo, mirrorSpeed, senseChain, Hades);

        const tplResult = await Nomos.getTemplate('speedtest.html', source);
        if (!tplResult.success) throw new Error("模板加载失败");

        const p1Stats = httpResults.filter(s => s.name !== 'GitHub').map((s, i) => {
            let gitData = null;
            let isGitOk = false;
            if (gitResults && gitResults.length > 0) {
                 gitData = gitResults.find(g => g.name === s.name)?.gitResult;
                 isGitOk = gitData?.success;
            }

            const isHttpOk = Number.isFinite(s.speed);
            const isGitDurOk = gitData && Number.isFinite(gitData.duration);

            let statusText = "超时";
            if (isHttpOk) statusText = `H:${s.speed}ms`;
            if (isGitDurOk) {
                 statusText += ` / G:${gitData.duration}ms`;
            }

            return {
                id: String(i + 1).padStart(2, '0'),
                name: s.name,
                priority: s.priority,
                statusText: statusText,
                latencyColorClass: !isHttpOk ? 'latency-timeout' : (s.speed > 2000 ? 'latency-yellow' : 'latency-green'),
                barColorClass: !isHttpOk ? 'bar-red' : (s.speed > 2000 ? 'bar-yellow' : 'bar-green'),
                statusClass: (isHttpOk || isGitOk) ? 'status-ok' : 'status-timeout',
                isBest: sortedNodes[0]?.name === s.name,
                isFailed: !isHttpOk && !isGitOk
            };
        });

        const aliveCount = p1Stats.length;
        const deadCount = p1Stats.filter(s => s.isFailed).length;

        const p2Stats = [
             { name: 'Baidu', val: vector.cnLink, rtt: baiduMs, icon: 'https://api.iconify.design/simple-icons:baidu.svg?color=%23ffffff' },
             { name: 'Google', val: vector.globalLink, rtt: googleMs, icon: 'https://api.iconify.design/logos:google-icon.svg' },
             { name: 'GitHub', val: vector.bizLink, rtt: githubMs, icon: 'https://api.iconify.design/simple-icons:github.svg?color=%23ffffff' },
             { name: 'Gitcode', val: true, rtt: gitcodeMs, icon: 'https://api.iconify.design/simple-icons:gitcode.svg?color=%23C71D23' }
        ].map((item, i) => {
             const isOk = item.rtt !== Infinity;
             return {
                 id: String(i + 1).padStart(2, '0'),
                 name: item.name,
                 priority: 2,
                 statusText: isOk ? `${item.rtt}ms` : '阻断',
                 statusClass: isOk ? 'status-ok' : 'status-timeout',
                 logoUrl: item.icon
             };
        });

        const failRate = aliveCount > 0 ? ((deadCount / aliveCount) * 100).toFixed(1) : '0.0';

        const proxyPorts = senseChain.nyxProxies || [];
        const bestPorts = proxyPorts.slice(0, 4).map(p => `${p.port}(${p.score})`);

        const ViewProps = {
             speeds: { priority1: p1Stats, priority2: p2Stats },
             best1Display: sortedNodes[0] ? `${sortedNodes[0].name} (综合评分最优)` : "无可用源",
             duration: ((Date.now() - startTime) / 1000).toFixed(1),
             runModeMsg,
             nativeV4, nativeV6,
             nativeV4CC,
             browserV4, browserV6,
             browserV4CC,
             v4Lat: envInfo?.v4Lat || 0,
             v6Lat: envInfo?.v6Lat || 0,
             clientGeo,
             trafficFormatted, ioChunks,
             aliveCount,
             deadCount,
             failRate,
             bestPorts
        };

        const shotName = source === 'Provision' ? "DL-SpeedTest" : "US-SpeedTest";
        const imgBuffer = await Morpheus.shot(shotName, {
             htmlContent: tplResult.data,
             data: ViewProps,
             logger: Hades,
             pageBoundingRect: { selector: ".container" }
        });

        if (imgBuffer) {
            await Pheme.img(e, imgBuffer, '测速报告图片发送失败已文本回执。', Hades);
        } else {
            await Pheme.genFail(e, 'speedtest');
        }

    } catch (err) {
        Hades.E(`测速报告生成异常:`, err);
        await Pheme.genFail(e, 'speedtest');
    }

    return sortedNodes;
  }

  async Reconcile(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false;
    if (!isScheduled && e && !(await MiaoPluginMBT.OpsGate(e, 'Reconcile'))) return true;
    const coreLogger = this.logger || getCore();
    const Hades = HadesEntry({}, coreLogger);

    let JavaScriptSyncStatus = false;

    const zzzIns = await Ananke.Audit(MiaoPluginMBT.Paths.ZZZPluginPath);
    const wavesIns = await Ananke.Audit(MiaoPluginMBT.Paths.WavesPluginPath);
    const repoContext = { zIn: zzzIns, wIn: wavesIns };

    const repo1State = await MiaoPluginMBT.GetRepoState(1, repoContext);
    const Repo1Exists = repo1State?.exists;
    if (!Repo1Exists) {
      if (!isScheduled && e) await Pheme.noRepo(e);
      return false;
    }

    const repo2State = await MiaoPluginMBT.GetRepoState(2, repoContext);
    const repo3State = await MiaoPluginMBT.GetRepoState(3, repoContext);
    const repo4State = await MiaoPluginMBT.GetRepoState(4, repoContext);

    const Repo2Exists = repo2State?.exists;
    const Repo3Exists = repo3State?.exists;
    const Repo4Exists = repo4State?.exists;

    const hasMissingRepo = [repo2State, repo3State, repo4State].some(state => state?.isEnabled && !state?.exists);

    if (hasMissingRepo && !isScheduled && e) {
      await Pheme.quote(e, "『咕咕牛🐂』部分附属仓库未下载，建议先`#下载咕咕牛`补全。");
    }

    const startTime = Date.now();
    if (!isScheduled && e) await Pheme.quote(e, "『咕咕牛🐂』开始检查更新...");

    const globalSenseChain = await MiaoPluginMBT.acquireChain(Hades);

    const reportResults = [];
    let allSuccess = true;
    let HasAnyChanges = false;
    const errorList = [];

    const deployRepoResult = async (repoNum, localPath, repoDisplayName, MBTKey, DefKey, targetBranch, isCore = false, senseChain) => {
      if (repoNum === 4) {
        await Nomos.ModuleOps(localPath, "zzz", "check");
        await Nomos.ModuleOps(localPath, "waves", "check");
      }

      const targetUrl = MiaoPluginMBT.MBTConfig?.[MBTKey] || DFC[DefKey || MBTKey];
      const result = await MiaoPluginMBT.UpstreamSyncRepo(isCore ? e : null, repoNum, localPath, repoDisplayName, targetUrl, targetBranch, isScheduled, Hades, senseChain);
      allSuccess &&= result.success;
      HasAnyChanges ||= result.hasChanges;

      if (!result.success && result.error) {
        const formattedError = DocHub._diagnose(`更新${repoDisplayName}`, result.error, "");
        let errorReportText = `--- ${repoDisplayName} 更新失败 ---\n`;
        errorReportText += `${formattedError.summary}\n\n`;
        errorReportText += `**可能原因与建议**\n${formattedError.suggestions}\n\n`;
        if (result.error.stderr || result.error.stdout) {
          errorReportText += `**相关Git输出**\n${formattedError.contextInfo}`;
        }
        errorList.push(errorReportText);
      }

      let statusText = "";
      if (result.success) {
        if (result.autoSwitchedNode) statusText = `更新成功(切换至${result.autoSwitchedNode})`;
        else if (result.wasHardReset) statusText = "本地冲突(强制同步)";
        else if (result.hasChanges) statusText = "更新成功";
        else statusText = "已是最新";
      } else statusText = "更新失败";

      let statusClass = "";
      if (result.success) {
        if (result.autoSwitchedNode) statusClass = "status-auto-switch";
        else if (result.wasHardReset) statusClass = "status-hard-synced";
        else if (result.hasChanges) statusClass = "status-ok";
        else statusClass = "status-no-change";
      } else {
        statusClass = "status-fail";
      }

      let currentSha = '获取失败';
      try {
        const shaResult = await MBTPipeControl("git", ["rev-parse", "HEAD"], { cwd: localPath }, 5000);
        currentSha = shaResult.stdout.trim();
      } catch {
      }

      const hasValidLogs = Array.isArray(result.log) && result.log.length > 0 && result.log[0] && (result.log[0].hash !== 'N/A');
      const shouldHighlight = (statusClass === 'status-ok' || statusClass === 'status-hard-synced' || statusClass === 'status-auto-switch') && result.newCommitsCount > 0;
      return {
          name: repoDisplayName,
          statusText, statusClass,
          error: result.error,
          log: result.log,
          wasHardReset: result.wasHardReset,
          autoSwitchedNode: result.autoSwitchedNode,
          newCommitsCount: result.newCommitsCount,
          commitSha: currentSha,
          diffStat: result.diffStat,
          hasChanges: result.hasChanges,
          hasValidLogs: hasValidLogs,
          shouldHighlight: shouldHighlight,
          MBTCoreChange: result.MBTCoreChange || false
      };
    };

    const branch = MiaoPluginMBT.MBTConfig.RepoBranch || DFC.RepoBranch;
    const nomosContext = { zIn: zzzIns, wIn: wavesIns };
    const activeRepos = Nomos.ActiveScope(MiaoPluginMBT.MBTConfig, nomosContext);
    const activeRepoIds = new Set(activeRepos.map(r => r.id));

    reportResults.push(await deployRepoResult(1, MiaoPluginMBT.Paths.MountRepoPath, Repo1, "Main_Github_URL", "Main_Github_URL", branch, true, globalSenseChain));

    const repo1Result = reportResults.find(r => r.name === Repo1);
    if (repo1Result && repo1Result.success) {
      JavaScriptSyncStatus = await MiaoPluginMBT.SSF();
    }

    if (activeRepoIds.has(2)) {
      const repo2Status = Repo2Exists
        ? await deployRepoResult(2, MiaoPluginMBT.Paths.MountRepoPath2, Repo2, "Ass_Github_URL", "Ass_Github_URL", branch, false, globalSenseChain)
        : { name: Repo2, statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo2Status);
    }

    if (activeRepoIds.has(3)) {
      const repo3Status = Repo3Exists
        ? await deployRepoResult(3, MiaoPluginMBT.Paths.MountRepoPath3, Repo3, "Ass2_Github_URL", "Ass2_Github_URL", branch, false, globalSenseChain)
        : { name: Repo3, statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo3Status);
    }

    if (activeRepoIds.has(4)) {
      const repo4Status = Repo4Exists
        ? await deployRepoResult(4, MiaoPluginMBT.Paths.MountRepoPath4, Repo4, "Ass3_Github_URL", "Ass3_Github_URL", branch, false, globalSenseChain)
        : { name: Repo4, statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo4Status);
    } else if (repo4State?.isConfigured) {
      reportResults.push({ name: Repo4, statusText: "未下载 (插件未安装)", statusClass: "status-skipped" });
    }

    if (allSuccess && HasAnyChanges) {
      await MiaoPluginMBT.HydrateCore(e, isScheduled, Hades);
      Tianshu.UpdateStats(Hades).catch(err => {
        Hades.E(`更新后刷新仓库统计缓存失败:`, err);
      });
    }

    let ConfigChanged = false;
    if (!MiaoPluginMBT.MBTConfig.nodeInfo) MiaoPluginMBT.MBTConfig.nodeInfo = {};
    for (const result of reportResults) {
      if (result.autoSwitchedNode) {
        const repoNum = RepoNameToId[result.name];
        if (repoNum) {
          MiaoPluginMBT.MBTConfig.nodeInfo[repoNum] = result.autoSwitchedNode;
          ConfigChanged = true;
        }
      }
    }

    if (ConfigChanged) {
      await Ananke.SaveConfig(
          MiaoPluginMBT.Paths.ConfigFilePath,
          MiaoPluginMBT.MBTConfig,
          Hades
      );
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const now = new Date();
    const reportTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}   ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let summaryText = "";
    if (allSuccess) {
      if (HasAnyChanges) {
        summaryText = "所有仓库更新检查完成，部分仓库有更新！";
        Hades.D(`检测到图库变更，正在刷新元数据缓存...`);
        const newData = await MiaoPluginMBT.ImgMetaAC(true, Hades);
        await MiaoPluginMBT.GenerateList(newData, Hades);
        Hades.D(`缓存刷新完成，当前索引图片数: ${newData.length}`);
      } else {
        summaryText = "所有仓库更新检查完成，均已是最新版本！";
      }
    } else {
      summaryText = "更新过程中遇到问题，请检查日志！";
    }

    const ViewProps = {
      duration,
      results: reportResults,
      allSuccess,
      HasAnyChanges,
      isArray: Array.isArray,
      reportTime: reportTime,
      summaryText: summaryText,
    };

    let imgBuffer = null;
    const notifyStatus = isScheduled && ViewProps.HasAnyChanges;
    const UpdateRenderFlag = (!isScheduled && e) || notifyStatus;

    if (UpdateRenderFlag) {
      imgBuffer = await Morpheus.shot("Update", {
        tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "sync", "update.html"),
        data: ViewProps,
        logger: Hades,
        pageBoundingRect: { selector: ".capture-frame" },
        MorpheusSignal: true
      });
    }

  if (imgBuffer) {
      const imgSegment = MiaoPluginMBT.ToImgSeg(imgBuffer);
      if (!isScheduled && e) {
        await Pheme.send(e, imgSegment);

        if (!allSuccess && errorList.length > 0) {
          await common.sleep(500);
          try {
            await Pheme.forward(e, errorList, "咕咕牛更新失败详情");
          } catch (fwdError) {
            Hades.E(`发送详细错误合并消息失败:`, fwdError);
            await Pheme.genFail(e, 'errorReport');
          }
        }
      } else if (notifyStatus) {
        await MiaoPluginMBT.SendMasterMsg(imgSegment, e, 0, Hades);
        if (!allSuccess && errorList.length > 0) {
          await MiaoPluginMBT.SendMasterMsg(await common.makeForwardMsg(e, errorList, "咕咕牛定时更新失败详情"), e, 1000, Hades);
        }
      }
    } else {
      if (UpdateRenderFlag) {
        let ReliefMsg = `更新检查完成 (图片生成失败)。\n`;
        reportResults.forEach((res) => {
            ReliefMsg += `${res.name}: ${res.statusText}\n`;
            if (res.error && res.error.message) ReliefMsg += `  错误: ${res.error.message.split("\n")[0]}\n`;
        });

        if (e && !isScheduled) await Pheme.send(e, ReliefMsg);
        else if (notifyStatus) await MiaoPluginMBT.SendMasterMsg(ReliefMsg, e, 0, Hades);

      } else if (!isScheduled && e && !ViewProps.HasAnyChanges && ViewProps.allSuccess) {
        await Pheme.quote(e, "更新检查完成，图库已是最新。");
      }
    }

    if (JavaScriptSyncStatus) {
      const ResMsg = `检测到插件核心逻辑已更新！为确保所有功能正常，强烈建议重启机器人。`;
      if (!isScheduled && e) {
        await Pheme.quote(e, ResMsg).catch(err => Hades.E("发送重启建议消息失败:", err));
      } else if (notifyStatus) {
        await MiaoPluginMBT.SendMasterMsg(ResMsg);
      }
    }

    Hades.D(`更新流程结束，耗时 ${duration} 秒。`);
    return HasAnyChanges;
  }

  async ManRepo(e) {
    if (!e.isMaster) return Pheme.noPerm(e);
    if (e.msg.trim() !== "#重置咕咕牛") return false;

    if (!this.logger) this.logger = Hades;
    const Hades = this.logger;

    await Pheme.quote(e, "开始重置图库，正在清理文件...");

    const obliteratePaths = [
        MiaoPluginMBT.CowCooRepoRoot,
        MiaoPluginMBT.Paths.oldOpsPath,
        ...["Miao-Plugin-MBT", "Miao-Plugin-MBT-2", "Miao-Plugin-MBT-3", "Miao-Plugin-MBT-4", "CowCoo"].map(dir => path.join(YzPath, "resources", dir)),
        ...["GuTools", "CooWeb"].map(dir => path.join(YzPath, "plugins", dir))
    ];

    const purgePaths = getCreTargets();

    const cleanTempHtml = async () => {
        const targets = await getTempHtmlTargets();

        await Promise.all(targets.map(p => Ananke.obliterate(p)));
        return { count: targets.length };
    };

    const cleanTempCowCoo = async () => {
        await Ananke.obliterate(MiaoPluginMBT.Paths.TempNiuPath);
        return { count: 1 };
    };

    const cleanKeysword = async () => {
        if (typeof redis === 'undefined') return { count: 0 };
        try {
            const keys = await redis.keys('CowCoo:*');
            if (keys && keys.length > 0) {
                let deletedCount = 0;
                for (const key of keys) {
                    try {
                        await redis.del(key);
                        deletedCount++;
                    } catch (delErr) {
                        Hades.W(`重置失败Redis: ${key}`, delErr.message);
                    }
                }
                return { count: deletedCount };
            }
            return { count: 0 };
        } catch (err) {
            throw err;
        }
    };

    const startTime = Date.now();

    const runTask = async ({ type, displayPath, action }) => {
        try {
            const result = await action();
            if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "success")) {
                if (!result.success) throw result.error || new Error("失败");
            } else if (result === false) {
                throw new Error("失败");
            }
            return { type, path: displayPath, success: true };
        } catch (error) {
            if (error?.code === "ENOENT") return { type, path: displayPath, success: true, skipped: true };
            return { type, path: displayPath, success: false, error };
        }
    };

    const tasks = [
        ...obliteratePaths.map(p => ({ type: "Delete", displayPath: path.basename(p), action: () => Ananke.obliterate(p, 3, 500) })),
        ...purgePaths.map(p => ({ type: "Purge", displayPath: path.basename(p), action: () => Ananke.purge(p, Hades) })),
        { type: "Temp", displayPath: "html_cache", action: cleanTempHtml },
        { type: "Temp", displayPath: "CowCoo", action: cleanTempCowCoo },
        { type: "Keyword", displayPath: "CowCoo_keys", action: cleanKeysword }
    ];

    const results = await Promise.all(tasks.map(runTask));

    await MiaoPluginMBT.MetaMutex.run(async () => {
        MiaoPluginMBT.MBTConfig = {};
        MiaoPluginMBT._MetaCache = Object.freeze([]);
        MBTCF.reset();
        MiaoPluginMBT._AliasData = null;
        MiaoPluginMBT._applyLifecycleState(MiaoPluginMBT.LifecycleStates.UNINITIALIZED);
        MiaoPluginMBT.InitPromise = null;
        this.PFSCReady = false;
        MiaoPluginMBT._remoteBanCount = 0;
    });

    const failures = results
        .filter(r => !r.success)
        .map(r => `${r.type} ${r.path} (${r.error?.message || "Failed"})`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (failures.length === 0) {
        await Pheme.quote(e, `重置完成！所有相关文件和缓存都清理干净啦 (耗时 ${duration}s)。`);
    } else {
        Hades.W(`重置过程存在部分失败:`, failures);
        const syntheticError = new Error(`部分清理任务失败:\n${failures.join('\n')}`);
        await DocHub.report(e, "重置咕咕牛 (部分失败)", syntheticError, `耗时: ${duration}s`);
    }

    return true;
  }

  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;
    const logger = getHades(this.logger);
    const repo1Exists = await MiaoPluginMBT.ICI();
    if (!repo1Exists) return Pheme.noRepo(e);

    try {
      const context = await Nomos.getContext();
      const activeRepos = Nomos.ScanQueue(MiaoPluginMBT.Paths, MiaoPluginMBT.MBTConfig, context);

      const auditPromises = activeRepos.map(repo => Ananke.Audit(repo.gitPath).then(exists => exists ? { ...repo, exists } : null));
      const ScanRepos = (await Promise.all(auditPromises)).filter(Boolean).map(r => ({ name: String(r.num), path: r.path, exists: true }));

      const worker = new MBTWorker(logger);

      const repoTasks = ScanRepos.map(r => Promise.all([
          Tianshu.ResolveGitNode(r.path),
          Ananke.measure(path.join(r.path, '.git')),
          Nomos.getRepoStatus(r.path).then(res => res.sha.slice(0, 15))
      ]));

      const [scanResults, diskStats, robotSizeRaw, installStats, ...repoResults] = await Promise.all([
        worker.run('SCAN_STATS', ScanRepos).finally(() => worker.terminate()),
        statfs(MiaoPluginMBT.Paths.YzPath).catch(() => ({ blocks: 0, bsize: 0, bfree: 0 })),
        Ananke.measure(MiaoPluginMBT.Paths.YzPath),
        Ananke.stat(MiaoPluginMBT.Paths.MountRepoPath).catch(() => null),
        ...repoTasks
      ]);

      const Universe = Nomos.Universe;
      const KeyDir = {};
      for(const [k, v] of Object.entries(Universe)) { KeyDir[v.dirName] = k; }

      const statsData = {
        meta: { roles: 0, images: 0, games: {}, gameRoles: {} },
        scan: {
          roles: 0, images: 0,
          gameImages: {}, gameRoles: {}, gameSizes: {}, gameSizesFormatted: {},
          size: 0, gitSize: 0, filesSize: 0,
          sizeFormatted: "0 B", gitSizeFormatted: "0 B", filesSizeFormatted: "0 B"
        },
        repos: {}
      };

      Object.values(Universe).forEach(meta => {
        const cnName = meta.name;
        statsData.scan.gameImages[cnName] = 0;
        statsData.scan.gameRoles[cnName] = 0;
        statsData.scan.gameSizes[cnName] = 0;
        statsData.scan.gameSizesFormatted[cnName] = "0 B";
      });

      let GitWorkingSize = 0;

      ScanRepos.forEach((repo, index) => {
        const data = scanResults[repo.name] || { summary: { filesSize: 0 }, games: {} };
        const [nodeName, gitSize, currentSha] = repoResults[index] || ['未知', 0, 'N/A'];

        GitWorkingSize += gitSize;

        statsData.repos[repo.name] = {
          name: [Repo1, Repo2, Repo3, Repo4][parseInt(repo.name) - 1],
          nodeName: nodeName,
          sha: currentSha,
          exists: true,
          filesSize: data.summary.filesSize,
          gitSize: gitSize,
          filesSizeFormatted: "Calculating...",
          gitSizeFormatted: "Calculating...",
          sizeFormatted: "Calculating..."
        };

        for (const [dirName, gameStats] of Object.entries(data.games)) {
          const gameKey = KeyDir[dirName];
          if (gameKey) {
            const cnName = Universe[gameKey].name;
            statsData.scan.gameRoles[cnName] += gameStats.roles;
            statsData.scan.gameImages[cnName] += gameStats.images;
            statsData.scan.gameSizes[cnName] += gameStats.size;
            statsData.scan.roles += gameStats.roles;
            statsData.scan.images += gameStats.images;
            statsData.scan.filesSize += gameStats.size;
          }
        }
      });

      const formatPromises = [];

      for (const cnName of Object.keys(statsData.scan.gameSizes)) {
          formatPromises.push(Ananke.measure(statsData.scan.gameSizes[cnName], true).then(s => statsData.scan.gameSizesFormatted[cnName] = s));
      }

      for (const repoName of Object.keys(statsData.repos)) {
          const r = statsData.repos[repoName];
          formatPromises.push(Ananke.measure(r.filesSize, true).then(s => r.filesSizeFormatted = s));
          formatPromises.push(Ananke.measure(r.gitSize, true).then(s => r.gitSizeFormatted = s));
          formatPromises.push(Ananke.measure(r.filesSize + r.gitSize, true).then(s => r.sizeFormatted = s));
      }

      statsData.scan.gitSize = GitWorkingSize;
      statsData.scan.size = statsData.scan.filesSize + GitWorkingSize;

      formatPromises.push(Ananke.measure(GitWorkingSize, true).then(s => statsData.scan.gitSizeFormatted = s));
      formatPromises.push(Ananke.measure(statsData.scan.size, true).then(s => statsData.scan.sizeFormatted = s));
      formatPromises.push(Ananke.measure(statsData.scan.filesSize, true).then(s => statsData.scan.filesSizeFormatted = s));

      let RobotSize = robotSizeRaw;
      let robotSizeFormatted = "0 B";
      formatPromises.push(Ananke.measure(RobotSize, true).then(s => robotSizeFormatted = s));

      await Promise.all(formatPromises);

      if (MiaoPluginMBT._MetaCache) {
        statsData.meta.images = MiaoPluginMBT._MetaCache.length;
        const roleSet = new Set();
        const gameRoleSets = {};
        Object.values(Universe).forEach(m => gameRoleSets[m.name] = new Set());

        MiaoPluginMBT._MetaCache.forEach(item => {
          if (item.CREName) {
            roleSet.add(item.CREName);
            const gameKey = KeyDir[item.storagebox_type];
            if (gameKey) {
                const cnName = Universe[gameKey].name;
                statsData.meta.games[cnName] = (statsData.meta.games[cnName] || 0) + 1;
                gameRoleSets[cnName].add(item.CREName);
            }
          }
        });
        statsData.meta.roles = roleSet.size;
        Object.entries(gameRoleSets).forEach(([k, v]) => statsData.meta.gameRoles[k] = v.size);
      }

      const diskSize = diskStats.blocks * diskStats.bsize;
      const diskFree = diskStats.bfree * diskStats.bsize;
      const diskUsed = diskSize - diskFree;

      let installationTime = 'N/A', insDaysText = '';
      if (installStats) {
          installationTime = new Date(installStats.birthtime).toLocaleString('zh-CN', { hour12: false });
          insDaysText = Math.floor((Date.now() - installStats.birthtimeMs) / 86400000).toString();
      }

      const corpusSize = statsData.scan.filesSize;
      const pluginSize = statsData.scan.size;

      const Footprint = {};

      for(const [key, meta] of Object.entries(Universe)) {
          const cnName = meta.name;
          Footprint[key] = {
              percentage: corpusSize > 0 ? ((statsData.scan.gameSizes[cnName] || 0) / corpusSize * 100).toFixed(2) : 0,
              size: {
                  raw: statsData.scan.gameSizes[cnName] || 0,
                  display: statsData.scan.gameSizesFormatted[cnName]
              }
          };
      }

      Footprint.HostPlugin = {
          percentage: RobotSize > 0 ? (pluginSize / RobotSize * 100).toFixed(2) : 0,
          sizeFormatted: await Ananke.measure(pluginSize, true)
      };
      Footprint.Contents = {
          raw: corpusSize,
          display: statsData.scan.filesSizeFormatted
      };
      Footprint.GitCache = {
          raw: GitWorkingSize,
          display: statsData.scan.gitSizeFormatted
      };
      Footprint.Occupancy = {
          raw: pluginSize,
          display: statsData.scan.sizeFormatted
      };

      const robotChartData = {
        size: {
          raw: RobotSize,
          display: robotSizeFormatted
        },
        sizeFormatted: robotSizeFormatted
      };

      const ViewProps = {
        stats: statsData,
        config: {
          pflLevel: MiaoPluginMBT.MBTConfig.PFL_Ops ?? DFC.PFL_Ops,
          pflDesc: PFL.getDescription(MiaoPluginMBT.MBTConfig.PFL_Ops ?? DFC.PFL_Ops),
          aiStatusText: (MiaoPluginMBT.MBTConfig.Ai ?? true) ? "开启" : "关闭",
          aiEnabled: MiaoPluginMBT.MBTConfig.Ai ?? true,
          easterEggStatusText: (MiaoPluginMBT.MBTConfig.EasterEgg ?? true) ? "开启" : "关闭",
          easterEggEnabled: MiaoPluginMBT.MBTConfig.EasterEgg ?? true,
          layoutStatusText: (MiaoPluginMBT.MBTConfig.layout ?? true) ? "开启" : "关闭",
          layoutEnabled: MiaoPluginMBT.MBTConfig.layout ?? true,
          installationTime,
          insDaysText,
          remoteBansCount: MiaoPluginMBT._remoteBanCount || 0,
          activeBans: MiaoPluginMBT._activeBanSet?.size ?? 0,
          userBans: MiaoPluginMBT._userBanSet?.size ?? 0,
          purifiedBans: Math.max(0, (MiaoPluginMBT._activeBanSet?.size ?? 0) - (MiaoPluginMBT._userBanSet?.size ?? 0)),
        },
        repoCount: ScanRepos.length,
        diskChartData: {
          size: diskSize,
          usedSize: diskUsed,
          freeSize: diskFree,
          sizeFormatted: await Ananke.measure(diskSize, true),
          usedSizeFormatted: await Ananke.measure(diskUsed, true),
          freeSizeFormatted: await Ananke.measure(diskFree, true),
          usedPercentage: diskSize > 0 ? ((diskUsed / diskSize) * 100).toFixed(2) : 0,
          chartValues: [diskUsed, diskFree]
        },
        Footprint: Footprint,
        robotChartData: robotChartData,
        isArray: Array.isArray,
        JSON: JSON,
        Date: Date
      };

      const Hades = getHades(this.logger);
      const imgBuffer = await Morpheus.shot("Status", {
          tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "status.html"),
          data: ViewProps,
          logger: Hades,
          pageBoundingRect: { selector: ".container" },
          MorpheusSignal: true
      });

        if (imgBuffer) {
            await Pheme.img(e, imgBuffer, '状态面板图片发送失败已文本回执。', this.logger);
        } else {
            await Pheme.genFail(e, 'status');
        }
        await this._TriggerMapGen(e, Hades);
      } catch (error) {
        await DocHub.report(e, "咕咕牛状态或地图", error);
      }
      return true;
  }

  async _TriggerMapGen(e, logger) {
      const Hades = getHades(logger);
      const tasks = [
          { key: "gs", width: 1400 },
          { key: "sr", width: 1400 },
          { key: "zzz", width: 1000, optional: true },
          { key: "waves", width: 1000, optional: true }
      ];

      const generatedImgs = [];

      for (const task of tasks) {
          if (task.optional) {
              const targetPluginPath = task.key === 'zzz' ? MiaoPluginMBT.Paths.ZZZPluginPath : MiaoPluginMBT.Paths.WavesPluginPath;
              if (!targetPluginPath || !(await Ananke.Audit(targetPluginPath))) {
                  continue;
              }
          }

          const imgBuffer = await this.MBTMapTileAss(e, task.key, task.width, Hades);

          if (imgBuffer) {
              generatedImgs.push(MiaoPluginMBT.ToImgSeg(imgBuffer));
              if (generatedImgs.length < tasks.length) await common.sleep(300);
          }
      }

      if (generatedImgs.length > 0) {
          if (generatedImgs.length === 1) await Pheme.send(e, generatedImgs[0]);
          else {
              try {
                  await Pheme.forward(e, generatedImgs, "咕咕牛图库地图总览");
                  await common.sleep(1500);
              } catch {
                  for (const img of generatedImgs) {
                      await Pheme.send(e, img);
                      await common.sleep(500);
                  }
             }
          }
      }
  }

  async MBTMapTileAss(gameKey, renderWidth, logger) {
    const Hades = getHades(logger);
    const strategy = Tianshu.GetStrategy(gameKey);
    if (!strategy) return null;
    const cerberus = Cerberus.getInstance();
    const signalTrap = MBTSignalTrap.getInstance();
    const BtnFaceUrl = Morpheus.getStaticImg("icon/null-btn.png");
    const elemGroups = {};
    const unknown_GroupKey = 'unknown';
    let imgCount = 0;
    let size = 0;
    const targetSource = Nomos.Universe[gameKey]?.dirName;
    const metaCache = MiaoPluginMBT._MetaCache || [];
    const validImg = targetSource ? metaCache.filter(img => img.storagebox_type === targetSource) : [];
    if (validImg.length === 0) return null;
    let loopIndex = 0;
    for (const img of validImg) {
        if (signalTrap._isShuttingDown) {
            Hades.W(`系统正在关闭，中止地图渲染任务 [${gameKey}]`);
            return null;
        }

        await cerberus.breath(loopIndex++);

        const charName = img.CREName;
        const { key: elemKey, label: elemName } = await strategy.resolveElem(charName);
        const key = (elemKey !== 'unknown' && elemKey !== 'multi') ? elemKey : unknown_GroupKey;
        const name = (key === unknown_GroupKey) ? '未知' : elemName;

        if (!elemGroups[key]) {
            elemGroups[key] = { key: key, name: name, count: 0, size: 0, chars: {}, banner: null };
        }

        const group = elemGroups[key];
        if (!group.chars[charName]) {
            group.chars[charName] = { name: charName, count: 0, size: 0, icon: null };
        }

        group.count++;
        group.chars[charName].count++;

        const absPath = await MiaoPluginMBT.FsQuery(img.path);
        if (absPath) {
            try {
                const stats = await Ananke.stat(absPath);
                if (stats) {
                    const s = stats.size;
                    group.size += s;
                    group.chars[charName].size += s;
                    size += s;
                }
            } catch (e) {
            }
        }
    }
    imgCount = validImg.length;

    const elemView = [];
    let sortedKeys = [];
    const currentKeys = Object.keys(elemGroups).filter(k => k !== unknown_GroupKey);
    const sortStrategyKeys = strategy.getSortKeys(currentKeys);

    if (Array.isArray(sortStrategyKeys)) {
        sortedKeys = sortStrategyKeys.filter(k => elemGroups[k]);
        currentKeys.forEach(k => { if(!sortedKeys.includes(k)) sortedKeys.push(k); });
    } else {
        sortedKeys = currentKeys;
    }
    if (elemGroups[unknown_GroupKey]) sortedKeys.push(unknown_GroupKey);

    loopIndex = 0;
    for (const key of sortedKeys) {
        await cerberus.breath(loopIndex++);

        const group = elemGroups[key];
        if (!group) continue;
        group.banner = await strategy.resolveBanner(key);
        const charList = Object.values(group.chars).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

        const outputCharList = [];
        for (const char of charList) {
            const strategyIcon = await strategy.resolveIcon(char.name);
            let faceUrl = BtnFaceUrl;
            if (strategyIcon) {
                if (strategyIcon.startsWith('http')) {
                    faceUrl = strategyIcon;
                } else {
                    const normalized = strategyIcon.replace(/\\/g, '/');
                    faceUrl = normalized.startsWith('file://') ? normalized : `file://${normalized}`;
                }
            }
            outputCharList.push({
                name: char.name,
                faceUrl: faceUrl,
                imageCount: char.count,
                sizeFormatted: await Ananke.measure(char.size, true)
            });
        }
        elemView.push({
            name: group.name,
            key: group.key,
            bannerUrl: group.banner,
            characters: outputCharList,
            elemImgCount: group.count,
            displaySize: await Ananke.measure(group.size, true)
        });
    }

    let gsHeaderBgUrl = null;
    if (gameKey === 'gs') {
        const p = path.join(MiaoPluginMBT.Paths.Target.Miao_GSAliasDir, "common", "imgs", "banner.webp");
        gsHeaderBgUrl = `file://${p.replace(/\\/g, '/')}`;
    }

    let srBodyBgUrl = null;
    if (gameKey === 'sr') {
        const p = path.join(MiaoPluginMBT.Paths.YzPath, "plugins", "miao-plugin", "resources", "common", "bg", "bg-sr.webp");
        srBodyBgUrl = `file://${p.replace(/\\/g, '/')}`;
    }

    const ViewProps = {
        games: [{
            name: strategy.name,
            key: gameKey,
            imgCountDisplay: imgCount,
            assetsSizeFormatted: await Ananke.measure(size, true),
            haselemGrouping: true,
            elements: elemView,
            headerBgUrl: gsHeaderBgUrl,
            bodyBgUrl: srBodyBgUrl
        }],
        isArray: Array.isArray,
        currentRenderWidth: renderWidth,
    };

    try {
        return await Morpheus.shot(`Map-${gameKey}`, {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "galleryrmap.html"),
            data: ViewProps,
            width: renderWidth,
            logger: Hades,
            MorpheusSignal: true
        });
    } catch (err) {
        Hades.E(`地图渲染失败 [${gameKey}]:`, err);
        return null;
    }
  }

  async MuB(e) {
    if (!(await this.CheckInit(e))) return true;

    const msg = e.msg.trim();
    const isMaster = e.isMaster;
    const logger = getHades(this.logger);

    const getThumbPath = async (imgPath) => {
      const absolutePath = await MiaoPluginMBT.FsQuery(imgPath);
      return toFileUrl(absolutePath);
    };

    const pageMatch = msg.match(/^#(?:ban|咕咕牛封禁)列表(?:\s*(\d+))?$/i);
    if (pageMatch) {
      if (!isMaster && (msg.startsWith("#咕咕牛封禁 ") || msg.startsWith("#咕咕牛解禁 "))) {
        return Pheme.noPerm(e);
      }

      const canContinue = await MiaoPluginMBT.OpsGate(e, 'MuB_List');
      if (!canContinue) return true;

      const activeBanCount = MBTCF.activeBanSet.size;
      if (activeBanCount === 0) return Pheme.emptyResult(e, 'ban');

      await Pheme.wait(e, `正在整理 ${activeBanCount} 项封禁记录，请稍候...`);

      const PFLItems = [];
      const disabledItems = [];
      const sortedActiveBans = Array.from(MBTCF.activeBanSet).sort();

      for (const imgPath of sortedActiveBans) {
        if (MBTCF.userBanSet.has(imgPath)) disabledItems.push({ path: imgPath });
        else PFLItems.push({ path: imgPath });
      }

      const PAGE_SIZE = MBTPagination.getPageSize('MuB');
      const userBanCount = disabledItems.length;
      const pageCount = Math.ceil(userBanCount / PAGE_SIZE);

      for (let i = 0; i < pageCount; i++) {
        const currentPage = i + 1;
        const startIndex = i * PAGE_SIZE;
        const pageItems = disabledItems.slice(startIndex, startIndex + PAGE_SIZE);

        const VewItems = await Promise.all(pageItems.map(async (item, index) => ({
            displayIndex: startIndex + index + 1,
            fileNameNoExt: path.basename(item.path).replace(/\.webp$/i, ""),
            thumbnailPath: await getThumbPath(item.path)
        })));

        const ViewProps = {
            emoji: "🚫",
            listTypeName: "手动封禁",
            listTypeClass: "manual",
            items: VewItems,
            count: userBanCount,
            countDigits: String(userBanCount).split(''),
            currentPage: currentPage,
            pageCount: pageCount,
        };

        const imgBuffer = await Morpheus.shot(`Ban-P${currentPage}`, {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "banlist.html"),
            data: ViewProps,
            logger: logger
        });

        if (imgBuffer) await Pheme.img(e, imgBuffer, '封禁列表图片发送失败已文本回执。', this.logger);
        else await Pheme.send(e, `[❌ 手动封禁列表第 ${currentPage}/${pageCount} 页生成失败，请看日志]`);
      }

      if (PFLItems.length > 0) {
        if (disabledItems.length > 0) await common.sleep(1000);

        const purgedCount = PFLItems.length;
        const pflPageCount = Math.ceil(purgedCount / BATCH_SIZE);
        const forwardMsgs = [];

        for (let i = 0; i < pflPageCount; i++) {
          await MiaoPluginMBT.OpsGate(e, 'MuB_Batch');

          const currentPage = i + 1;
          const startIndex = i * BATCH_SIZE;
          const batchItems = PFLItems.slice(startIndex, startIndex + BATCH_SIZE);

          const VewItems = await Promise.all(batchItems.map(async (item, index) => {
            const thumbnailPath = await getThumbPath(item.path);
            const imgDataEntry = Tianshu._indexByGid.get(item.path);
            const reasons = [];

            if (imgDataEntry) {
              const cfg = MiaoPluginMBT.MBTConfig;
              const other = imgDataEntry.attributes?.other || [];
              if (cfg.PFL_Ops > 0 && MBTCF._checkPFL(imgDataEntry, cfg.PFL_Ops)) reasons.push("净化");
              if (cfg.Ai === false && other.includes("LLMCanvas")) reasons.push("Ai");
              if (cfg.EasterEgg === false && other.includes("Egg")) reasons.push("彩蛋");
              if (cfg.layout === false && imgDataEntry.attributes.layout === "fullscreen") reasons.push("横屏");
            }
            if (reasons.length === 0) reasons.push("规则");

            return {
              displayIndex: startIndex + index + 1,
              fileNameNoExt: path.basename(item.path).replace(/\.webp$/i, ""),
              thumbnailPath,
              reasons: reasons,
            };
          }));

          const ViewProps = {
              Version,
              emoji: "🌱",
              listTypeName: "净化屏蔽",
              listTypeClass: "purified",
              items: VewItems,
              count: purgedCount,
              countDigits: String(purgedCount).split(''),
              currentPage: currentPage,
              pageCount: pflPageCount,
            };

          const imgBuffer = await Morpheus.shot(`PFL-P${currentPage}`, {
              tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "banlist.html"),
              data: ViewProps,
              logger: logger
          });

          if (imgBuffer) forwardMsgs.push(MiaoPluginMBT.ToImgSeg(imgBuffer));
          else forwardMsgs.push(`[❌ 净化屏蔽列表第 ${currentPage}/${pflPageCount} 页生成失败]`);
        }

        if (forwardMsgs.length > 0) {
          try {
            await Pheme.forward(e, forwardMsgs, `咕咕牛净化列表 (共${pflPageCount}页)`);
          } catch (fwdError) {
            Hades.E(`创建合并消息失败:`, fwdError);
            for (const m of forwardMsgs) {
              await Pheme.send(e, m); await common.sleep(500);
            }
          }
        }
      }
      return true;
    }

    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i);
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i);

    if (addMatch || delMatch) {
      if (!isMaster) return Pheme.noPerm(e);

      const isAdding = !!addMatch;
      const rawInput = (isAdding ? addMatch[1] : delMatch[1]).trim();
      const actionVerb = isAdding ? "封禁" : "解禁";

      try {
        if (!rawInput) throw new Error("输入为空");

        if (isAdding && MBTCF.secTagsCache.includes(rawInput)) {
          try {
            const { count, already } = await MBTCF.TagsBanMan(rawInput, MiaoPluginMBT._MetaCache, logger);
            if (count > 0) {
              setImmediate(() => MiaoPluginMBT.GenerateList(null, logger));
              let reply = `操作完成！\n成功封禁了 ${count} 张带有 [${rawInput}] 标签的图片。`;
              if (already > 0) reply += `\n另外有 ${already} 张之前已经被封禁了。`;
              await Pheme.quote(e, reply);
            } else {
              await Pheme.quote(e, `所有带 [${rawInput}] 标签的图片（共 ${already} 张）之前都已经被封禁啦，或者没找到该标签图片。`);
            }
          } catch (err) {
            Hades.E(`标签封禁失败:`, err);
            await Pheme.quote(e, "保存封禁列表失败，请查看日志。");
          }
          return true;
        }

        const parsedId = Tianshu.ParseID(rawInput);
        if (!parsedId) throw new Error("编号格式无效");

        const { mainName: rawMainName, imgNum: imgNum } = parsedId;
        const aliasResult = await Tianshu.NormalizeName(rawMainName);
        const primaryName = aliasResult.exists ? aliasResult.mainName : rawMainName;

        let imageData = null;
        const charImg = Tianshu._indexByCRE.get(primaryName);
        if (charImg && charImg.length > 0) {
          const Fingerprint = `${primaryName.toLowerCase()}gu${imgNum}.webp`;
          imageData = charImg.find((img) =>
            toPosix(img.path).toLowerCase().endsWith(`/${Fingerprint}`)
          );
        }

        if (!imageData || !imageData.path) throw new Error("图片未找到");

        const storagebox_type = imageData.storagebox_type;
        for (const [key, meta] of Object.entries(Nomos.Universe)) {
          if (storagebox_type === meta.dirName) {
            const pluginPath = meta.pluginPath;
            if (pluginPath && !(await Ananke.Audit(pluginPath))) {
               const PluginLabelD = key === "zzz" ? "ZZZ-Plugin" : key === "waves" ? "waves-plugin" : "miao-plugin";
               throw new Error(`插件未安装:${PluginLabelD}`);
            }
            break;
          }
        }

        const RelativePath = toPosix(imageData.path);
        const fileLabel = path.basename(RelativePath);

        try {
          if (isAdding) {
            await MBTCF.AddManualBan(RelativePath, logger);
            await Pheme.quote(e, `${fileLabel} 🚫 封禁了~`);
          } else {
            await MBTCF.RemoveManualBan(RelativePath, logger);
            await Pheme.quote(e, `${fileLabel} ✅️ 好嘞，解封!`);
            setImmediate(() => MiaoPluginMBT.RevertFile(RelativePath, logger));
          }
          setImmediate(() => MiaoPluginMBT.GenerateList(null, logger));
        } catch (err) {
          if (err.message === "TARGET_PURIFIED") {
            const level = MiaoPluginMBT.MBTConfig.PFL_Ops ?? DFC.PFL_Ops;
            await Pheme.quote(e, `⚠️ ${fileLabel} 受到当前的净化规则 (等级 ${level}) 屏蔽，无法进行手动操作。`);
          } else if (err.message === "ALREADY_BANNED") {
            await Pheme.quote(e, `${fileLabel} ❌️ 封禁已存在哦。`);
          } else if (err.message === "NOT_FOUND") {
            await Pheme.quote(e, `${fileLabel} ❓ 没找到哦 (可能未被封禁)。`);
          } else {
            Hades.E(`${actionVerb}操作异常:`, err);
            await DocHub.report(e, `${actionVerb}图片`, err);
            await Pheme.quote(e, `操作失败: ${err.message}`);
          }
        }

      } catch (err) {
        if (err.message === "输入为空") {
          return Pheme.quote(e, `要${actionVerb}哪个图片呀？格式：#咕咕牛${actionVerb} 角色名+编号 或 #咕咕牛封禁 <二级标签>`);
        }
        if (err.message === "编号格式无效") {
          return Pheme.quote(e, "格式好像不对哦，应该是 角色名+编号 (例如：花火1)");
        }
        if (err.message === "图片未找到") {
          return Pheme.emptyResult(e, 'img', rawInput);
        }
        if (err.message.startsWith("插件未安装")) {
          const pluginLabel = err.message.split(":")[1] || "miao-plugin";
          return Pheme.quote(e, `图库数据无记录: ${rawInput}。\n(插件 ${pluginLabel} 未安装)`);
        }
        throw err;
      }
      return true;
    }
    return false;
  }

  static async QueryBanState(relativePath, logger) {
    return MBTCF.isPurified(relativePath);
  }

  async QueryData(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.ICI())) {
      return Pheme.noRepo(e);
    }

    const msg = e.msg.replace(/^#咕咕牛查看\s*/i, "").trim();
    const data = await Tianshu.Search(msg);
    if (!data) return true;
    if (data.type === 'dashboard') {
        return Presenter.RenderDashboard(e, data.stats);
    }

    if (!(await MiaoPluginMBT.OpsGate(e, 'QueryData'))) return true;
    if (data.type === 'help') return Pheme.quote(e, "想看哪个角色呀？格式：#咕咕牛查看 角色名/游戏名/标签 或 #咕咕牛查看 原神 火");
    if (data.type === 'empty') return Pheme.quote(e, data.msg);
    if (data.type === 'game_group') {
      await Pheme.wait(e, `收到！将发送 ${data.title} 的 ${data.items.length} 个角色图库...`);
      const cerberus = Cerberus.getInstance();
      for (const charName of data.items) {
        await cerberus.breath(10);
        const charData = await Tianshu.Search(charName);
        if (charData && charData.type === 'character') {
          await Presenter._PaginateFM(e, charData);
        }
      }
      return true;
    }

    await Presenter._PaginateFM(e, data);
    return true;
  }

  async VisSplashes(e) {
    if (!(await this.CheckInit(e))) return true;
    const canContinue = await MiaoPluginMBT.OpsGate(e, 'VisSplashes');
    if (!canContinue) return true;

    const match = e.msg.match(/^#可视化\s*(.+)$/i);
    if (!match?.[1]) return Pheme.quote(e, "想可视化哪个角色呀？格式：#可视化角色名");
    const roleNameInput = match[1].trim();

    let primaryName = "";
    const logger = getHades(this.logger);

    try {
      const aliasResult = await Tianshu.NormalizeName(roleNameInput);
      primaryName = aliasResult.mainName || roleNameInput;

      let roleFolderPath = null;
      const SearchPaths = getCreTargets();
      for (const targetDir of SearchPaths) {
        if (!targetDir) continue;
        const potentialPath = path.join(targetDir, primaryName);
        if (await Ananke.Audit(potentialPath)) {
            roleFolderPath = potentialPath;
            break;
        }
      }

      if (!roleFolderPath) { Hades.W(`未在目标插件目录找到角色 '${primaryName}' 文件夹。`); return Pheme.emptyResult(e, 'role', primaryName); }

      const supportedExtensions = [".jpg", ".png", ".jpeg", ".webp", ".bmp"];
      let allimgFiles = [];
      try { const entries = await Ananke.readDir(roleFolderPath);
        allimgFiles = entries.filter((entry) => entry.isFile() && supportedExtensions.includes(path.extname(entry.name).toLowerCase())).map(entry => entry.name);
      }
      catch (readErr) {
        Hades.E(`读取角色文件夹失败: ${roleFolderPath}`, readErr);
        await DocHub.report(e, `可视化角色 ${primaryName}`, readErr, "读取角色文件夹失败");
        return true;
      }

      if (allimgFiles.length === 0) {
        Hades.W(`角色文件夹 ${roleFolderPath} 为空或不包含支持的图片格式。`);
        return Pheme.emptyResult(e, 'folder', primaryName);
       }

      allimgFiles.sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)\.\w+$/)?.[1] || "0");
        const numB = parseInt(b.match(/(\d+)\.\w+$/)?.[1] || "0");
        if (numA === numB) return a.localeCompare(b); return numA - numB;
      });

      const PAGE_SIZE = MBTPagination.getPageSize('Vis');
      const SplashCount = allimgFiles.length;
      const pageCount = Math.ceil(SplashCount / PAGE_SIZE);
      const pageCountNum = pageCount === 1 ? 2 : pageCount;

      let waitMsg = `[${primaryName}] 有 ${SplashCount} 张面板图，正在生成可视化预览...`;
      if (pageCount > 1) {
        waitMsg = `[${primaryName}] 的图片过多 (共 ${SplashCount} 张)，将分 ${pageCount} 批生成预览，请注意查收...`;
      }

      await Pheme.wait(e, waitMsg);
      await common.sleep(500);

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        await MiaoPluginMBT.OpsGate(e, 'VisRoleSplashes_Page');

        const startIndex = (pageNum - 1) * PAGE_SIZE;
        const currentFiles = allimgFiles.slice(startIndex, startIndex + PAGE_SIZE);

        const VisCharaterdata = currentFiles.map((fileName, index) => ({
          fileName: fileName.replace(/\.\w+$/, ""),
          filePath: toFileUrl(path.join(roleFolderPath, fileName)),
          originalIndex: startIndex + index,
          isGu: /gu/i.test(fileName)
        }));

        const PluginRolePath = toPosix(roleFolderPath).toLowerCase();
        const miaoRoot = toPosix(MiaoPluginMBT.Paths.MiaoPluginPath).toLowerCase();
        const zzzRoot = toPosix(MiaoPluginMBT.Paths.ZZZPluginPath).toLowerCase();
        const wavesRoot = toPosix(MiaoPluginMBT.Paths.WavesPluginPath).toLowerCase();
        let originPlugin = null;
        let originPluginKey = null;
        if (PluginRolePath.startsWith(miaoRoot)) {
          originPlugin = 'Miao-Plugin';
          originPluginKey = 'miao';
        } else if (PluginRolePath.startsWith(zzzRoot)) {
          originPlugin = 'ZZZ-Plugin';
          originPluginKey = 'zzz';
        } else if (PluginRolePath.startsWith(wavesRoot)) {
          originPlugin = 'Waves-Plugin';
          originPluginKey = 'waves';
        }

        const folderSizeBytes = await Ananke.measure(roleFolderPath);
        const folderSizeFormatted = await Ananke.measure(folderSizeBytes, true);
        const totalDigits = String(SplashCount).split('');
        const ViewProps = {
          CREName: primaryName,
          characterName: primaryName,
          imageCount: SplashCount,
          images: VisCharaterdata,
          batchNum: pageNum,
          pageCount: pageCountNum,
          totalPages: pageCount,
          countDigits: totalDigits,
          odometer: totalDigits,
          originPlugin: originPlugin,
          originPluginKey: originPluginKey,
          folderSize: folderSizeFormatted,
        };

        const imgBuffer = await Morpheus.shot(`Vis-${primaryName}-P${pageNum}`, {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "filter", "visualize.html"),
            data: ViewProps,
            logger: logger,
            navOpts: { waitUntil: "networkidle0", timeout: 45000 },
            screenshotOps: { fullPage: true },
        });

        if (imgBuffer) {
            await Pheme.img(e, imgBuffer, '角色可视化图片发送失败已文本回执。', this.logger);
        } else {
            await Pheme.quote(e, `[❌ 第 ${pageNum}/${pageCount} 部分生成失败，请看日志]`);
        }

        if (pageNum < pageCount) {
          await common.sleep(1000);
        }
      }

    } catch (error) {
        Hades.E(`处理角色 '${roleNameInput}' 时发生顶层错误:`, error);
        await DocHub.report(e, `可视化角色 ${roleNameInput}`, error);
    }
    return true;
  }

  async ExPhFile(e) {
    if (!(await this.CheckInit(e))) return true;

    if (!(await MiaoPluginMBT.ICI())) {
        return Pheme.noRepo(e);
    }

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i);
    if (!match?.[1]) return Pheme.quote(e, "要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)");

    const rawInput = match[1].trim();
    const logger = getHades(this.logger);

    try {
        const parsedId = Tianshu.ParseID(rawInput);
        if (!parsedId) return Pheme.quote(e, "格式好像不对哦，应该是 角色名+编号，比如：花火1");

        const { mainName: rawMainName, imgNum } = parsedId;
        const aliasResult = await Tianshu.NormalizeName(rawMainName);
        const primaryName = aliasResult.exists ? aliasResult.mainName : rawMainName;

        const charImages = Tianshu._indexByCRE.get(primaryName);

        if (!charImages || charImages.length === 0) {
             const hint = Tianshu._indexByGid.size === 0 ? "(图库数据为空)" : "(未找到该角色的图片数据)";
             return Pheme.emptyResult(e, 'role', `${primaryName}。\n${hint}`);
        }

        const targetSuffix = `gu${imgNum}.webp`;
        const imageData = charImages.find(img =>
            img.path?.toLowerCase().endsWith(targetSuffix)
        );

        if (!imageData) {
            return Pheme.quote(e, `找到了角色 '${primaryName}'，但没有找到编号 ${imgNum} 的图片。`);
        }

        const relativePath = toPosix(imageData.path);
        const targetFileName = path.basename(relativePath);
        const absolutePath = await Tianshu.FsQuery(relativePath);

        if (!absolutePath) {
            return Pheme.quote(e, `糟糕，数据库里有记录，但物理文件找不到了：${targetFileName}`);
        }

        const fileBuffer = await Ananke.readFile(absolutePath).catch(err => {
            throw new Error(`文件读取失败: ${err.message}`);
        });

        await Pheme.send(e, `📦 导出成功！给你 -> ${targetFileName}`);
        await common.sleep(200);

        try {
            await Pheme.send(e, segment.file(fileBuffer, targetFileName));
        } catch (sendErr) {
            const errMsg = (sendErr.message || "").toLowerCase();
            if (errMsg.includes("highway") || errMsg.includes("file size") || sendErr.code === -36 || sendErr.code === 210005) {
                await Pheme.quote(e, `发送失败：文件通道异常 (Code: ${sendErr.code})，可能是文件过大或被风控。`);
            } else {
                throw sendErr;
            }
        }

    } catch (error) {
        Hades.E(`导出图片失败 [${rawInput}]:`, error);
        await DocHub.report(e, `导出图片 ${rawInput}`, error);
    }

    return true;
  }

  async Help(e) {
    const isInstalled = await MiaoPluginMBT.ICI();
    const logger = getHades(this.logger);

    let HelpTpl = "";
    const tplResult = await Nomos.getTemplate('help.html', isInstalled ? 'Stdin' : 'Provision');
    if (tplResult.success && tplResult.data) {
        HelpTpl = tplResult.data;
    } else {
        logger.E(`本地帮助模板读取失败，请检查安装完整性`);
    }

    if (HelpTpl) {
      try {
        let insDays = '1';
        if (isInstalled) {
          try {
            const stats = await Ananke.stat(MiaoPluginMBT.Paths.MountRepoPath);
            if (stats && stats.mtimeMs) {
              const diffMs = Date.now() - stats.mtimeMs;
              const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              insDays = String(Math.max(1, days));
            }
          } catch (statError) {
            if (statError.code !== 'ENOENT') {
              Hades.E(`获取安装天数时出错:`, statError);
          }
        }}

        const ViewProps = {
            insDays,
            headerImg: await Morpheus.pickHeaderSet(20),
            Cow_Res_Path: isInstalled
              ? toFileUrl(`${MiaoPluginMBT.Paths.OpsPath}/`)
              : toFileUrl(path.join(MiaoPluginMBT.Paths.YzPath, 'temp', 'CowCoo', 'Network', 'CowCooResPool') + '/')
        };

        const imgBuffer = await Morpheus.shot("Help", {
            htmlContent: HelpTpl,
            data: ViewProps,
            logger: logger,
            screenshotOps: { fullPage: true }
        });

        if (imgBuffer) {
          await Pheme.img(e, imgBuffer, '帮助面板图片发送失败已文本回执。', logger);
        } else {
          throw new Error("生成帮助图片失败返回空 Buffer");
        }
      } catch (renderErr) {
        Hades.E(`生成帮助图片时出错:`, renderErr);
        HelpTpl = "";
      }
    }

    if (!HelpTpl) {
      const ReliefText = [...HELP_FALLBACK_LINES, `Miao-Plugin-MBT v${Version}`].join("\n");
      await Pheme.quote(e, ReliefText);
    }

    return true;
  }

  async MBTOpsDeck(e, StatusMsg = "") {
    if (!(await this.CheckInit(e))) return true;
    const logger = getHades(this.logger);
    const config = MiaoPluginMBT.MBTConfig || {};

    const mapToggle = (key, defaultVal, trueText = "已开启", falseText = "已关闭") => {
        const val = config[key] ?? defaultVal;
        return {
            text: val ? trueText : falseText,
            class: val ? "value-enabled" : "value-disabled"
        };
    };

    try {
        const ViewProps = {
            tuKuStatus: mapToggle('Repo_Ops', DFC.Repo_Ops, "已启用", "已禁用"),
            pflStatus: (() => {
                const level = config.PFL_Ops ?? DFC.PFL_Ops;
                return {
                    level,
                    description: PFL.getDescription(level),
                    class: `value-level-${level}`
                };
            })(),
            aiStatus: mapToggle('Ai', true),
            easterEggStatus: mapToggle('EasterEgg', true),
            layoutStatus: mapToggle('layout', true),
            MihoyoSplashStatus: mapToggle('MihoyoSplash', false),
            sr18Status: mapToggle('SR18', false),
            RenderScale: {
                value: config.RenderScale ?? DFC.RenderScale
            },
            statusMsg: StatusMsg
        };

        const imgBuffer = await Morpheus.shot("Settings", {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "setpanel.html"),
            data: ViewProps,
            logger: logger,
            pageBoundingRect: { selector: ".container" }
        });

        if (imgBuffer) {
            await Pheme.img(e, imgBuffer, '设置面板图片发送失败已文本回执。', this.logger);
        } else {
            const fallbackMsg = StatusMsg
                ? `${StatusMsg}\n(面板渲染失败，请检查日志)`
                : `设置面板生成失败，请查看后台日志。`;
            await Pheme.quote(e, fallbackMsg);
        }

    } catch (error) {
        Hades.E(`生成设置面板失败:`, error);
        const errContext = StatusMsg ? `操作反馈: ${StatusMsg}` : "打开设置面板";
        await DocHub.report(e, "显示设置面板", error, errContext);
    }

    return true;
  }

  async RouteOpsHub(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return Pheme.noPerm(e);

    if (!(await MiaoPluginMBT.ICI())) {
        return Pheme.noRepo(e);
    }

    const msg = e.msg.trim();

    const OpsMatch = msg.match(/^#(启用|禁用)咕咕牛$/i);
    if (OpsMatch) {
        const enable = OpsMatch[1] === "启用";
        return this.MutateSubState(e, '总开关', enable ? '开启' : '关闭');
    }

    const subMatch = msg.match(/^#咕咕牛设置(ai|彩蛋|横屏|净化等级|渲染精度|SR18)(开启|关闭|[0-9]+)$/i);
    if (subMatch) {
        const featureKey = subMatch[1].toLowerCase();
        const valueRaw = subMatch[2];
        return this.MutateSubState(e, featureKey, valueRaw);
    }

    return false;
  }

  async MutateSubState(e, key, valRaw) {
    const logger = getHades(this.logger);
    const parseBool = (v) => {
        if (v !== '开启' && v !== '关闭') throw new Error("只能是开启或关闭");
        return v === '开启';
    };
    const refreshList = async (logText, errText, syncRepo = false) => {
        if (logText) Hades.D(logText);
        try {
            await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, logger);
            if (syncRepo && MiaoPluginMBT.MBTConfig.Repo_Ops) await MiaoPluginMBT.SCD(logger);
        } catch (err) {
            Hades.E(`${errText}:`, err);
        }
    };
    const strategies = {
        '总开关': {
            cfgKey: 'Repo_Ops',
            name: '图库总开关',
            parse: parseBool,
            sideEffect: async (enable) => {
                const opName = enable ? "同步/挂载" : "清理/卸载";
                try {
                    if (enable) {
                        await MiaoPluginMBT.SCD(logger);
                        const MODULES = ["zzz", "waves"];
                        const context = await Nomos.getContext();
                        const repos = Nomos.ModuleRepoAC(MiaoPluginMBT.Paths, MiaoPluginMBT.MBTConfig, context);
                        for (const gameKey of MODULES) {
                            const gameFolder = MiaoPluginMBT.Paths.SourceDir[gameKey];
                            if (!gameFolder) continue;
                            for (const repo of repos) {
                                if (repo.path) await Nomos.ModuleOps(repo.path, gameKey, 'check');
                            }
                        }
                    } else {
                        const TARGETS = getCreTargets();
                        await Promise.all(TARGETS.map(dir => Ananke.purge(dir, logger).catch(() => {})));
                    }
                } catch (err) {
                    Hades.E(`[后台任务] ${opName}失败:`, err);
                }
            }
        },
        '净化等级': {
            cfgKey: 'PFL_Ops',
            name: '净化等级',
            parse: (v) => {
                const level = parseInt(v, 10);
                if (isNaN(level) || ![0, 1, 2].includes(level)) throw new Error("只能是 0, 1, 或 2");
                return level;
            },
            sideEffect: () => refreshList(`PFL 变更，正在重新计算封禁列表...`, "PFL 应用失败", true)
        },
        '渲染精度': {
            cfgKey: 'RenderScale',
            name: '渲染精度',
            parse: (v) => {
                const scale = parseInt(v, 10);
                if (isNaN(scale) || scale < 100 || scale > 500) throw new Error("只能是 100 到 500 之间的数字");
                return scale;
            },
            sideEffect: null
        },
        'sr18': {
            cfgKey: 'SR18_Ops',
            name: 'SR18仓库',
            parse: parseBool,
            sideEffect: () => refreshList(`SR18 状态变更，正在重新计算资源...`, "SR18 应用失败", true)
        }
    };

    const toggleMap = {
        'ai': ['Ai', 'Ai 图'],
        '彩蛋': ['EasterEgg', '彩蛋图'],
        '横屏': ['layout', '横屏图'],
        '官方立绘': ['MihoyoSplash', '官方立绘同步']
    };
    Object.entries(toggleMap).forEach(([k, [cfgKey, name]]) => {
        strategies[k] = {
            cfgKey,
            name,
            parse: parseBool,
            sideEffect: () => refreshList("", "[后台任务] 更新封禁表失败")
        };
    });

    const strategy = strategies[key];
    if (!strategy) return false;

    let parsedVal;
    try {
        parsedVal = strategy.parse(valRaw);
    } catch (err) {
        return Pheme.quote(e, `无效参数: ${err.message}`);
    }

    const mutation = await MiaoPluginMBT.MetaMutex.run(async () => {
        try {
            const config = await Ananke.loadingConfig(MiaoPluginMBT.Paths.ConfigFilePath, DFC, logger).catch(() => DFC);
            const currentVal = config[strategy.cfgKey] ?? DFC[strategy.cfgKey];

            if (currentVal === parsedVal) {
                return { success: true, changed: false, msg: `${strategy.name}已经是设定值啦。` };
            }

            config[strategy.cfgKey] = parsedVal;
            const saved = await Ananke.SaveConfig(MiaoPluginMBT.Paths.ConfigFilePath, config, logger);

            if (saved) {
                MiaoPluginMBT.MBTConfig = config;
                return { success: true, changed: true, msg: `${strategy.name}已更新。` };
            }
            return { success: false, msg: "配置保存失败" };
        } catch (err) {
            return { success: false, msg: `内部错误: ${err.message}` };
        }
    });

    if (!mutation.success) {
        await DocHub.report(e, `设置${strategy.name}`, new Error("操作失败"), mutation.msg);
        return true;
    }

    if (mutation.changed && strategy.sideEffect) {
        try {
            await strategy.sideEffect(parsedVal);
        } catch (err) {
            Hades.E("后台任务执行异常", err);
        }
    }

    try {
        await this.MBTOpsDeck(e, mutation.msg);
    } catch (err) {
        Hades.E("面板渲染失败", err);
    }
    return true;
  }

}

class SleeperAgent extends plugin {
    constructor() {
      super({
        name: '『咕咕牛』原图管理器',
        event: 'message',
        priority: -100,
        rule: [
          { reg: /^#?原图$/, fnc: 'PreemptPh' },
          { reg: /^(?:\[reply:[^\]]+\]\n?)?#?原图$/, fnc: 'PreemptPh' },
        ],
      });
      this.task = { fnc: () => { }, log: false };
    }

    async PreemptPh(e) {
      const replyReg = /^\[reply:(.+?)\]\n?/;
      let replyId = null;
      let msg = e.msg;

      const match = msg.match(replyReg);
      if (match) {
        replyId = match[1];
        msg = msg.replace(replyReg, '');
      }

      if (msg.length > 4 && msg.startsWith('#原图')) return false;
      if (replyId) { return SleeperAgent._interrogate(e, replyId); }
      if (e.msg.length > 4 && e.msg.startsWith('#原图')) return false;
      if (!e.getReply) return false;
      let reply = await e.getReply();
      if (!reply || !reply.message_id) return false;
      return SleeperAgent._interrogate(e, reply.message_id);
    }

    static async _interrogate(e, sourceMsgId) {
      const ProbeKeys = [
        { key: `miao:original-picture:${sourceMsgId}`, type: 'miao' },
        { key: `ZZZ:PANEL:IMAGE:${sourceMsgId}`, type: 'zzz' },
        { key: `Yunzai:waves:originpic:${sourceMsgId}`, type: 'waves' },
      ];
      for (const { key, type } of ProbeKeys) {
        try {
          const dataJson = await redis.get(key);
          if (dataJson) {
            let imgPathEncoded = '';
            if (type === 'miao') imgPathEncoded = JSON.parse(dataJson).img || '';
            else if (type === 'zzz') imgPathEncoded = dataJson;
            else if (type === 'waves') imgPathEncoded = (JSON.parse(dataJson).img || [])[0] || '';
            if (!imgPathEncoded) {
              continue;
            }
            const imgPath = decodeURIComponent(imgPathEncoded);
            const fileName = path.basename(imgPath);
            let absolutePath;
            if (imgPath.startsWith('http')) { absolutePath = imgPath; }
            else if (type === 'miao') { absolutePath = path.join(YzPath, 'plugins', 'miao-plugin', 'resources', imgPath); }
            else if (type === 'zzz') { absolutePath = path.join(MiaoPluginMBT.Paths.Target.ZZZCRE, imgPath); }
            else if (type === 'waves') { absolutePath = path.join(MiaoPluginMBT.Paths.Target.WavesCRE, imgPath); }
            else { continue; }
            if (fileName.toLowerCase().includes('gu')) {
              try {
                const CREName = fileName.replace(/Gu\d+\.webp$/i, '');
                const promptText = `输入#咕咕牛查看${CREName}可以看图库全部图片`;
                const imgSegment = MiaoPluginMBT.ToImgSeg(absolutePath);

                const forwardList = [promptText, imgSegment];
                await Pheme.forward(e, forwardList, `原图 - ${fileName}`);
                await common.sleep(300);
                await Pheme.send(e, segment.at(e.user_id), false, { recallMsg: 15 });
              } catch {
                await Pheme.quote(e, `无法获取原图，请稍后再试。`);
              }
              return true;
            } else {
              return false;
            }
          }
        } catch {
        }
      }
      return false;
    }
}

const CowCoo_Rules = [
  [/^#下载咕咕牛$/i, "Provision", "master"],
  [/^#更新咕咕牛$/i, "Reconcile", "master"],
  [/^#重置咕咕牛$/i, "ManRepo", "master"],
  [/^#咕咕牛状态$/i, "CheckStatus"],
  [/^#(?:(?:ban|咕咕牛封禁)列表|咕咕牛(?:封禁|解禁)\s*.+)$/i, "MuB", "master"],
  [/^#咕咕牛导出\s*.+$/i, "ExPhFile"],
  [/^#咕咕牛查看\s*.*$/i, "QueryData"],
  [/^#咕咕牛帮助$/i, "Help"],
  [/^#咕咕牛测速$/i, "TestVoice"],
  [/^#(咕咕牛设置|咕咕牛面板)$/i, "MBTOpsDeck"],
  [/^#(?:(启用|禁用)咕咕牛|咕咕牛设置(ai|彩蛋|横屏|净化等级|渲染精度|SR18)(开启|关闭|[0-9]+))$/i, "RouteOpsHub", "master"],
  [/^#可视化\s*.+$/i, "VisSplashes"],
].map(([reg, fnc, permission]) => ({ reg, fnc, ...(permission ? { permission } : {}) }));

const Boot_Ctrl = Symbol.for('Yz.CowCoo.MBT.Boot.Control.v2');

const oldWrapper = global[Boot_Ctrl];
if (oldWrapper?.value?.dispose) {
    try { oldWrapper.value.dispose(); } catch (e) {}
} else if (oldWrapper?.value?.timer) {
    clearTimeout(oldWrapper.value.timer);
    oldWrapper.value.timer = null;
}

const BootCtrl = {
    timer: null,
    hotswapTimer: null,
    gen: Moirai.currentGen,
    enteredGen: null,
    state: 'uninitialized',
    disposed: false,
    dispose() {
        this.disposed = true;
        this.state = 'uninitialized';
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.hotswapTimer) {
            clearTimeout(this.hotswapTimer);
            this.hotswapTimer = null;
        }
        this.enteredGen = null;
    }
};

let BootWrapper = null;
BootCtrl.timer = setTimeout(async () => {
    BootCtrl.timer = null;
    if (global[Boot_Ctrl] !== BootWrapper) return;
    try {
        await MiaoPluginMBT.init(Hades);
    } catch (err) {
        Hades.E(`咕咕牛图库管理器启动失败:`, err);
    }
}, 100);

BootWrapper = Moirai.stamp(Boot_Ctrl, BootCtrl);
const apps = { MiaoPluginMBT, SleeperAgent };
export { apps, MiaoPluginMBT, SleeperAgent, MBTPagination };