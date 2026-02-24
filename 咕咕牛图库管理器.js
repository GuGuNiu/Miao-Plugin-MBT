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
const Charon = "『咕咕牛🐂』";
const Hades_Symbol = Symbol.for('Yz.CowCoo.MBT.Hades.Entry');
const getCore = () => global.logger || console;

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
        if (!HadesEntry._colorMan) HadesEntry._colorMan = ColorMan();
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
    const prefix = module ? `${Charon}[${module}]` : Charon;
    const emit = (method, args) => {
        const fn = core?.[method];
        if (!fn) return;
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

const Hades = HadesEntry();

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
    static #sizes = { MuB: 28, Vis: 28 };

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
        Object.keys(config).forEach(key => {
            if (this.#sizes[key] !== undefined) {
                this.setPageSize(key, config[key]);
            }
        });
        return this.getAll();
    }
}

class Nyx {
    static Proxy_Pro = [
        {
            name: 'clash',
            aliases: ['clash-verge', 'clash verge', 'clashverge', 'clash_for_windows', 'clashforwindows'],
            secondary: ['cfw', 'clash-win64', 'clash-linux', 'clash-meta', 'mihomo', 'clash.meta'],
            threshold: 0.75
        },
        {
            name: 'v2ray',
            aliases: ['v2rayn', 'v2ray-core', 'v2raycore'],
            secondary: ['v2rayn-core', 'v2rayncore', 'v2rayng'],
            threshold: 0.75
        },
        {
            name: 'sing-box',
            aliases: ['singbox', 'sing_box'],
            secondary: [],
            threshold: 0.8
        },
        {
            name: 'naive',
            aliases: ['naiveproxy'],
            secondary: [],
            threshold: 0.8
        },
        {
            name: 'hysteria',
            aliases: ['hysteria2'],
            secondary: [],
            threshold: 0.8
        },
        {
            name: 'shadowsocks',
            aliases: ['shadowsocksr', 'ss-local', 'sslocal'],
            secondary: [],
            threshold: 0.75
        },
        {
            name: 'trojan',
            aliases: ['trojan-go', 'trojango'],
            secondary: [],
            threshold: 0.8
        },
        {
            name: 'nekoray',
            aliases: ['nekobox'],
            secondary: [],
            threshold: 0.8
        },
        {
            name: 'tuic',
            aliases: [],
            secondary: [],
            threshold: 0.85
        },
        {
            name: 'proxy',
            aliases: ['vpn'],
            secondary: [],
            threshold: 0.7
        }
    ];

    static _nor(str) {
        return str.toLowerCase().replace(/[\s\-_.]/g, '');
    }

    static _calcs(a, b) {
        const s1 = this._nor(a);
        const s2 = this._nor(b);
        if (s1 === s2) return 1.0;
        if (s1.includes(s2) || s2.includes(s1)) return 0.9;
        let matches = 0;
        const minLen = Math.min(s1.length, s2.length);
        for (let i = 0; i < minLen; i++) {
            if (s1[i] === s2[i]) matches++;
        }
        return matches / Math.max(s1.length, s2.length);
    }

    static _againstMatrix(procName, entry) {
        const normalized = this._nor(procName);
        const normName = this._nor(entry.name);

        if (normalized === normName || normalized.includes(normName)) {
            return { matched: true, pattern: entry.name, score: 1.0, level: 'primary' };
        }

        for (const alias of entry.aliases) {
            const normAlias = this._nor(alias);
            if (normalized === normAlias || normalized.includes(normAlias)) {
                return { matched: true, pattern: entry.name, score: 0.95, level: 'alias' };
            }
        }

        for (const sec of entry.secondary) {
            const normSec = this._nor(sec);
            if (normalized === normSec || normalized.includes(normSec)) {
                return { matched: true, pattern: entry.name, score: 0.9, level: 'secondary' };
            }
        }

        const score = this._calcs(procName, entry.name);
        if (score >= entry.threshold) {
            return { matched: true, pattern: entry.name, score, level: 'fuzzy' };
        }

        return null;
    }

    static fuzzyMatch(procName) {
        for (const entry of this.Proxy_Pro) {
            const result = this._againstMatrix(procName, entry);
            if (result) return result;
        }
        return { matched: false, pattern: null, score: 0, level: null };
    }

    static async scan(agentGates = [], Hades = console) {
        const candidates = await this._buildDiscoveryPool(agentGates, Hades);
        if (candidates.size === 0) return [];

        if (Hades?.D) {
            const portsStr = Array.from(candidates.values())
                .map(c => `${c.port}(分:${c.score})`)
                .join(', ');
            Hades.D(`[Nyx] 候选端口池: ${portsStr}`);
        }

        const sniffPromises = Array.from(candidates.values()).map(candidate => this._evaluateCandidate(candidate));
        const results = (await Promise.all(sniffPromises)).filter(Boolean);

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
            if (Hades?.D) Hades.D(`[Nyx] OS进程扫描异常(已降级): ${e.message}`);
        }

        if (Array.isArray(agentGates)) {
            agentGates.forEach(p => addPort(p, 40, 'common_port'));
        }

        return pool;
    }

    static async _evaluateCandidate(candidate) {
        let protocol = null;
        let verified = false;

        if (await this._sniffSocks5(candidate.port)) {
            protocol = 'socks5';
            verified = true;
        }
        else if (await this._sniffHttp(candidate.port)) {
            protocol = 'http';
            verified = true;
        }

        if (verified) {
            return {
                host: '127.0.0.1',
                port: candidate.port,
                protocol: protocol,
                source: Array.from(candidate.sources).join('+'),
                verified: true,
                score: candidate.score
            };
        } else if (candidate.score >= 60) {
            return {
                host: '127.0.0.1',
                port: candidate.port,
                protocol: 'unknown',
                source: 'os_process_unverified',
                verified: false,
                score: candidate.score
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
                    finish(true);
                } else {
                    finish(false);
                }
            });
            socket.on('error', () => finish(false));
            socket.on('timeout', () => finish(false));
            socket.connect(port, '127.0.0.1');
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
    static #Hermes_Key = 'CowCoo:Hermes:';
    static #TTL_TPL = 259200;
    static #TTL_POOL = 1209600;
    static #UA_POOL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/UAPool.json";
    static #BAIT_POOL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/Voice_Reps.json";
    static #senseDepth = 0;
    static #senseCache = null;
    static #senseCacheTime = 0;
    static #SENSE_TTL = 15000;
    static #CACHE_PATH = path.join(process.cwd(), 'temp', 'CowCoo', 'NetWork', 'ipconfig.json');
    static #IP_CACHE_TTL = 600 * 1000;
    static #Default_Max_Body_Bytes = 1024 * 1024;
    static #Default_Max_Handshake_Bytes = 64 * 1024;

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
                if (Hades) Hades.D(`[网络管理] 从磁盘加载网络态势感知信息: ${this.#CACHE_PATH}`);
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
            if (Hades) Hades.D(`[网络管理] 网络态势感知信息已保存到磁盘: ${this.#CACHE_PATH}`);
        } catch (e) {
            if (Hades) Hades.W(`[网络管理] 无法保存网络态势感知信息到磁盘: ${e.message}`);
        }
    }

    static cleanup() {
        this.#cache.clear();
        this.#envCache = null;
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
        
        if (v6 !== Infinity) Hades.D(`[网络管理] IPv6 穿透成功: ${v6}ms`);
        
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

        const [cn, global, biz, gitee, udp] = await Promise.all([
            dial(beacons.BeaconCN || beacons.cn, 80),
            dial(beacons.BeaconGlobal || beacons.global, 443),
            dial(beacons.BeaconBiz || beacons.biz, 443),
            dial(beacons.BeaconGitee || beacons.gitee, 443),
            this.UdpPulse('8.8.8.8', 53)
        ]);

        return { cn, global, biz, gitee, udp };
    }

    static async #try(fn, fallback, Hades = null, tag = '') {
        try {
            return await fn();
        } catch (e) {
            if (Hades) Hades.D(`${tag}${e?.message ? `: ${e.message}` : ''}`);
            return fallback;
        }
    }
    static async getRandomRawTarget() {
        await this.#getUAPool();
        const repoPool = await this.getRepoPool();
        if (!Array.isArray(repoPool) || repoPool.length === 0) return null;
        const repo = repoPool[MBTMath.Range(0, repoPool.length - 1)];
        const cleanRepo = repo.replace(/\.git$/, '');
        let rawBase = cleanRepo.replace(/^(?:https?:\/\/)?github\.com\//, 'https://raw.githubusercontent.com/');
        return `${rawBase}/main/README.md`;
    }

    static async #loadJsonArray(url, cacheKey, Hades = null) {
        const cached = await this.#getCache(cacheKey);
        if (Array.isArray(cached) && cached.length > 0) return cached;

        const redisKey = `${this.#Hermes_Key}${cacheKey}`;
        let raw = await this.#try(() => redis.get(redisKey), null, Hades, 'Redis读取失败');

        if (!raw) {
            const res = await this.#try(
                () => this.request(url, { timeout: 8000, skipUAPool: url === this.#UA_POOL }),
                null,
                Hades,
                '远端拉取失败'
            );
            if (res?.success && res.status === 200 && res.body) {
                raw = res.body;
                await this.#try(() => redis.set(redisKey, raw, { EX: this.#TTL_POOL }), null, Hades, 'Redis写入失败');
            }
        }

        const parsed = await this.#try(
            () => JSON.parse(typeof raw === 'string' ? raw.trim() : raw),
            null,
            Hades,
            'JSON解析失败'
        );
        if (Array.isArray(parsed) && parsed.length > 0) {
            const cleaned = parsed
                .map((v) => typeof v === 'string' ? v.trim().replace(/^`+|`+$/g, '') : v)
                .filter((v) => !!v);
            const deduped = Array.isArray(cleaned) ? Array.from(new Set(cleaned)) : cleaned;
            await this.#setCache(cacheKey, deduped, this.#TTL_POOL);
            return deduped;
        }

        return [];
    }

    static async #getUAPool(Hades = null) {
        return this.#loadJsonArray(this.#UA_POOL, 'Pool:UAPool', Hades);
    }

    static async getRandomUA(Hades = null) {
        const uaPool = await this.#getUAPool(Hades);
        if (!Array.isArray(uaPool) || uaPool.length === 0) return null;
        return uaPool[MBTMath.Range(0, uaPool.length - 1)].replace(/(\d+)\.0/, `$1.${MBTMath.Range(1, 100)}`);
    }

    static async getRepoPool(Hades = null) {
        return this.#loadJsonArray(this.#BAIT_POOL, 'Pool:RepoPool', Hades);
    }

    static async preloadPools(Hades = console) {
        try {
            const uaPool = await this.#getUAPool(Hades);
            if (Array.isArray(uaPool)) await this.#setCache('Pool:UAPool', uaPool, this.#TTL_POOL);
            const repoPool = await this.getRepoPool(Hades);
            if (Array.isArray(repoPool)) await this.#setCache('Pool:RepoPool', repoPool, this.#TTL_POOL);
        } catch (e) {
            Hades.D(`UA/RepoPool 预热失败: ${e.message}`);
        }
    }

    static #ROUTING = {
        'speedtest.html': { strategy: 'LOCAL_FIRST', url: 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/html/sync/speedtest.html', localSubPath: 'sync' },
        'help.html': { strategy: 'LOCAL_FIRST', url: 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/html/help.html' },
        'error_report.html': { strategy: 'LOCAL_FIRST', url: 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/error_report.html' },
        'download.html': { strategy: 'NET_FIRST', url: 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/html/sync/download.html' },
        'core_repo_download.html': { strategy: 'NET_FIRST', url: 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/html/sync/core_repo_download.html' }
    };

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
        
        const isWhiteListed = url.includes('gitee.com');
        const effSkipSense = skipSense || (isWhiteListed && !forceProxy);
        
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
            if (isHttp) {
                agent = new http.Agent({ keepAlive: true });
            } else {
                agent = new https.Agent({ ciphers: shuffledCiphers, minVersion: 'TLSv1.2', keepAlive: true });
            }
        }

        const ua = skipUAPool ? null : await this.getRandomUA();
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
                if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                    let nextUrl = res.headers.location;
                    if (!nextUrl.startsWith('http')) nextUrl = new URL(nextUrl, url).href;
                    return resolve(this.request(nextUrl, options, redirects + 1));
                }
                this.#Collect_Body_Limit(res, max_body_bytes)
                    .then(body => resolve({ success: true, status: res.statusCode, body }))
                    .catch(err => resolve({ success: false, status: res.statusCode || 0, body: null, error: err }));
            });
            const fail = (err) => { if (!req.destroyed) req.destroy(); resolve({ success: false, status: 0, body: null, error: err }); };
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

    static async #getCache(key) {
        if (this.#cache.has(key)) {
            const { val, exp } = this.#cache.get(key);
            if (Date.now() < exp) return val;
            this.#cache.delete(key);
        }
        const redisKey = this.#Hermes_Key + key;
        const raw = await this.#try(() => redis.get(redisKey), null);
        if (raw) {
            const val = await this.#try(() => JSON.parse(raw), null);
            if (val !== null) {
                this.#cache.set(key, { val, exp: Date.now() + 60000 });
                return val;
            }
        }
        return null;
    }

    static async #setCache(key, val, ttlSeconds) {
        this.#cache.set(key, { val, exp: Date.now() + (ttlSeconds * 1000) });
        const redisKey = this.#Hermes_Key + key;
        await this.#try(() => redis.set(redisKey, JSON.stringify(val), { EX: ttlSeconds }), null);
    }

    static async getBrowserEnvSnapshot(Hades = console) {
        let browser = null;
        try {
            if (Hades && typeof Hades.D === 'function') Hades.D(`[网络管理] 网络态势感知启动中...`);
            
            const randomUA = await this.getRandomUA(Hades);
            const userAgent = randomUA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
            const launchArgs = [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--no-first-run', '--no-zygote', '--disable-extensions',
                '--disable-default-apps', '--disable-component-update',
                `--user-agent=${userAgent}`
            ];

            browser = await PuppCow.launch({
                headless: "new",
                args: launchArgs,
                timeout: 15000 
            });

            const page = await browser.newPage();
            page.setDefaultNavigationTimeout(10000);

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
                                if (Hades) Hades.D(`[网络管理] JSON 解析失败 [${src.url}]: ${e.message}`);
                            }
                        } else if (Hades) {
                            const status = result?.status ?? 0;
                            const errMsg = result?.error ? ` ${result.error}` : '';
                            Hades.D(`[网络管理] 探测接口返回异常 [${src.url}]: ${status}${errMsg}`);
                        }
                    } catch (e) {
                        if (Hades) Hades.D(`[网络管理] 探测接口超时或失败 [${src.url}]: ${e.message}`);
                    }
                }
                return null;
            };

            const [v4, v6] = await Promise.all([
                detect(Hermes.Sources.IPv4, 4),
                detect(Hermes.Sources.IPv6, 6)
            ]);

            const formatPuppResult = (result, family) => {
                if (!result) return 'N/A';
                const via = result.src ? new URL(result.src).hostname : 'unknown';
                const country = result.country || result.data?.country_code || result.data?.countryCode || result.data?.country || result.data?.country_name || 'N/A';
                return `${result.ip}(${country})[${via}]`;
            };
            const v4Log = formatPuppResult(v4, 4);
            const v6Log = formatPuppResult(v6, 6);
            if (Hades && typeof Hades.D === 'function') Hades.D(`[网络管理] Pupp感知结果: v4=${v4Log}, v6=${v6Log}`);
            return { v4, v6 };

        } catch (e) {
            if (Hades && typeof Hades.W === 'function') Hades.W(`[网络管理] Pupp感知失败: ${e.message}`);
            return { v4: null, v6: null }; 
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (ce) {
                    if (Hades) Hades.D(`[网络管理] 关闭浏览器失败: ${ce.message}`);
                }
            }
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
                            return reject(new Error(`Status ${res.statusCode}`));
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
                    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
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
            const results = await Nyx.scan(ports, Hades);
            if (results && results.length > 0) {
                const best = results[0];
                if (Hades?.D) {
                    Hades.D(`[网络管理] Nyx: ${best.protocol}://${best.host}:${best.port}`);
                }
                return best;
            }
        } catch (e) {
            if (Hades?.D) Hades.D(`[网络管理] 扫描异常: ${e.message}`);
        }
        return null;
    }

    static async getEnvInfo(Hades = console) {
        if (this.#envCache && (Date.now() - this.#envCacheTime < this.#ENV_TTL)) {
            return this.#envCache;
        }

        const diskCache = await this.#loadEnvFromDisk(Hades);
        if (diskCache && diskCache.inference && typeof diskCache.inference.nativeCN === 'boolean') {
            this.#envCache = diskCache;
            this.#envCacheTime = Date.now();
            return diskCache;
        }

        const [browserSnapshot, nativeSnapshot, hostProfile, sysProxy] = await Promise.all([
            this.getBrowserEnvSnapshot(Hades),
            this.getNativeIPStack(Hades),
            this.getHostProfile(Hades),
            this.getSystemProxy(Hades)
        ]);

        const v6Ip = browserSnapshot?.v6?.ip || nativeSnapshot?.v6Ip;
        const v4Ip = browserSnapshot?.v4?.ip || nativeSnapshot?.v4Ip;

        const browserCountry = browserSnapshot?.v4?.country;
        const nativeCountry = nativeSnapshot?.geoData?.country_code || nativeSnapshot?.geoData?.countryCode || nativeSnapshot?.geoData?.country;

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
                regionCN: nativeSnapshot?.geoData?.country_code === 'CN' || nativeSnapshot?.geoData?.countryCode === 'CN' || nativeSnapshot?.geoData?.country === 'CN' || regionCN, 
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

    static async getTemplate(filename, Hades = console) {
        const route = this.#ROUTING[filename];
        if (!route) return { success: false, data: null, error: new Error('未知模板') };

        const cacheKey = `Tpl:${filename}`;
        const subDir = route.localSubPath ? route.localSubPath : "";
        const localPath = path.join(MiaoPluginMBT.Paths.OpsPath, "html", subDir, filename);

        const fetchNet = async () => {
            const cached = await this.#getCache(cacheKey);
            if (cached) return cached;
            const res = await this.request(route.url, { timeout: 5000 });
            if (res.success && res.status === 200 && res.body) {
                await this.#setCache(cacheKey, res.body, this.#TTL_TPL);
                return res.body;
            }
            throw new Error(`网络错误 ${res.status}`);
        };

        const readLocal = async () => Ananke.readFile(localPath, 'utf-8');

        try {
            let content;
            if (route.strategy === 'LOCAL_FIRST') {
                try { content = await readLocal(); }
                catch { 
                    Hades.D(`[网络管理] 本地缺失在线获取: ${filename}`);
                    content = await fetchNet(); 
                }
                if (content === null) {
                    Hades.D(`[网络管理] 本地为空在线获取: ${filename}`);
                    content = await fetchNet();
                }
            } else {
                try { content = await fetchNet(); }
                catch {
                    Hades.D(`[网络管理] 网络失败降级本地: ${filename}`);
                    content = await readLocal();
                }
            }
            return { success: true, data: content };
        } catch (err) {
            Hades.D(`[网络管理] 模板获取失败 [${filename}]: ${err.message}`);
            return { success: false, data: null, error: err };
        }
    }

    static async ProbeSpeed(url, timeout = 5000) {
        const start = Date.now();
        const res = await this.request(url, { timeout, method: 'HEAD' });
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
        const ips = [];
        const ifaces = os.networkInterfaces();
        for (const name in ifaces) {
            for (const iface of ifaces[name]) {
                if (!iface.internal) {
                    ips.push(iface.address);
                }
            }
        }
        return ips;
    }

    static async getOraclePrompt(Hades = null) {
        const cacheKey = 'Prompt:Oracle';
        const cached = await this.#getCache(cacheKey);
        if (cached) return cached;

        const url = 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/prompt.json';
        const res = await this.request(url, { timeout: 10000 });
        
        if (res.success && res.status === 200 && res.body) {
            const ttl = 7 * 24 * 60 * 60; 
            await this.#setCache(cacheKey, res.body, ttl);
            return res.body;
        }
        
        if (Hades) Hades.D(`[网络管理] 云端Prompt获取失败: ${res.error?.message || res.status}`);
        return null;
    }

    static async getWorkerScript(Hades = null) {
        const cacheKey = 'Script:Worker';
        const cached = await this.#getCache(cacheKey);
        if (cached) return cached;

        const url = 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/worker.js';
        const res = await this.request(url, { timeout: 10000 });
        
        if (res.success && res.status === 200 && res.body) {
            const ttl = 3 * 24 * 60 * 60; 
            await this.#setCache(cacheKey, res.body, ttl);
            return res.body;
        }
        
        if (Hades) Hades.D(`[网络管理] 云端Worker获取失败: ${res.error?.message || res.status}`);
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
                        if (Hades) Hades.D(`[网络管理] API响应 [v${family}]: ${src.url}`);
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
                if (Hades) Hades.D(`[${tag}] IPv4 探测成功: ${v4Ip} (CN=${regionCN}) 来源: ${src.url}`);
            } else {
                if (Hades) Hades.D(`[${tag}] IPv4 探测结果格式错误: ${v4Result.ip}`);
            }
        }

        if (v6Result) {
            if (net.isIPv6(v6Result.ip)) {
                v6Ip = v6Result.ip;
                if (Hades) Hades.D(`[${tag}] IPv6 探测成功: ${v6Ip} 来源: ${v6Result.src.url}`);
            } else {
                if (Hades) Hades.D(`[${tag}] IPv6 探测结果格式错误: ${v6Result.ip}`);
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
        BeaconGitee: "gitee.com",
        agentGates: [7890, 7891, 7892, 7893, 7894, 7895, 7896, 7897, 7898, 7899, 1080, 10808],
        thresholdV6: 800,
        thresholdV4: 400,
        bonusOfficial: 0.7
    };

    static getSenseBeacons() {
        return [
            { name: "GitHub", url: `https://${this._setup.BeaconBiz}`, priority: 2 },
            { name: "Google", url: `https://${this._setup.BeaconGlobal}`, priority: 2 },
            { name: "Gitee", url: `https://${this._setup.BeaconGitee}`, priority: 2 },
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

        const [fingerprint, linkStateRaw, v6State, raceData] = await Promise.all([
            this._scanLocal(envSet, envData?.network?.proxy, Hades),
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
                giteeLink: linkState.gitee,
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
            executionContext: executionContext
        };
    }

    static async _scanLocal(envSet = false, sysProxy = null, Hades = console) {
        let active = false;
        envSet = !!envSet;

        const scanProc = async () => {
            try {
                const procList = await this._getProcNames();
                return procList.some(n => Nyx.fuzzyMatch(n, 0.75).matched);
            } catch { return false; }
        };

        const [procActive, nyxProxies] = await Promise.all([
            scanProc(), 
            Nyx.scan(this._setup.agentGates, Hades)
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
            proxyContext = nyxProxies[0];

            if (proxyContext.protocol === 'unknown') {
                proxyContext.protocol = 'socks5';
            }

            if (Hades?.D) {
                const status = proxyContext.verified ? '已验证' : '未验证(盲猜SOCKS5)';
                Hades.D(`[网络管理] 锁定代理: ${proxyContext.protocol}://${proxyContext.host}:${proxyContext.port} [${status}]`);
            }
        }

        const portActive = !!proxyContext;
        if (procActive || portActive) active = true;

        return { active, envSet, procActive, portActive, proxyContext };
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

    static on(event, handler) {
        this._ensureInit();
        this._bus.on(event, handler);
        return () => this._bus.off(event, handler);
    }

    static once(event, handler) {
        this._ensureInit();
        this._bus.once(event, handler);
        return () => this._bus.off(event, handler);
    }

    static off(event, handler) {
        this._ensureInit();
        this._bus.off(event, handler);
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
            if (!decision.mode && ctx.env?.inference?.nativeCN && !ctx.env.inference.browserCN) {
                decision.mode = Proteus.State.USER_AGENT;
                decision.reason = 'nativeCN';
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
            if ((ctx.portActive || ctx.proxyContext) && (!v4Ready || v4Lat > 200)) {
                decision.mode = Proteus.State.IDLE_AGENT;
                decision.reason = 'idleAgent';
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
    
    const TRAP = MBTSignalTrap.getInstance();
    this._shutdownHandler = async () => {
        await this.killAll('SIGTERM', 'App Shutdown');
    };
    TRAP.on('shutdown', this._shutdownHandler);
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

    this.logger.warn(`[进程池]正在终止 ${this.pool.size} 个进程 (${reason})`);

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
      const safetyTimer = setTimeout(() => {
          if (meta) meta.state = MBTProcPool.STATE.DEAD;
          resolve(true);
      }, 5000);

      const cleanup = () => {
        clearTimeout(safetyTimer);
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

      const targetPid = proc.spawnargs?.includes('detached') || proc.detached ? -pid : pid;
      try {
        process.kill(targetPid, signal);
      } catch (e) {
        if (e.code === 'ESRCH') {
            cleanup();
            return;
        }
        if (targetPid < 0) {
            try { process.kill(pid, signal); } catch {}
        }
      }

      if (signal !== 'SIGKILL') {
        setTimeout(() => {
          if (proc.exitCode === null && proc.signalCode === null) {
            try {
              process.kill(targetPid, 'SIGKILL');
            } catch (e) {
                if (targetPid < 0) try { process.kill(pid, 'SIGKILL'); } catch {}
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
        const { promise, resolve, reject } = Promise.withResolvers();
        this.promise = promise;
        this.resolve = resolve;
        this.reject = reject;
        this._shutdownHandler = () => this.stop();
        MBTSignalTrap.getInstance().on('shutdown', this._shutdownHandler);

        if (!parentSignal) return;

        if (parentSignal.aborted) {
            this.stop();
            return;
        } 
        
        parentSignal.addEventListener('abort', () => {
            this.logger.warn(`${this.uiRid} | [Quo] 收到上游中断信号 (Metis TTL/Abort)，正在终止所有任务...`);
            this.stop();
        }, { once: true });
    }

    start() {
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
            if (t) t.curr = p;
        };

        const { promise, meta } = factory(context, onProgress);
        const name = meta?.nodeName || id; 

        const task = {
            id, name, BPP, context,
            start: now,
            curr: 0, prev: 0, speed: 0, active: now,
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

    _monitor() {
        if (this.tasks.size === 0) return;
        const now = Date.now();
        let leader = null;
        const snapshot = Array.from(this.tasks.values()); 
        
        for (const task of snapshot) {
            if (now - task.start > 30 * 60 * 1000) {
                 this.logger.warn(`${this.uiRid} | [Quo] 任务 [${task.name}] 超过最大运行时限正在强制处决`);
                 this._kill(task, '全局运行时限已超');
                 continue;
            }

            this._ForceModel(task, now);
            if (!leader || task.curr > leader.curr) {
                leader = task;
            }
        }

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

    _ForceModel(task, now) {
        task.speed = task.curr - task.prev;
        task.prev = task.curr;
        if (task.speed > 0) task.active = now;
    }

    _judge(task, leader, now) {
        if (task.state !== MBTQuoCRS.Task_State.Running) return; 
        
        const telemetry = task.context?.telemetry || { instant_speed: 0, last_tick: 0, connection_state: 'CONNECTING' };
        const FreshnessWindow = (now - telemetry.last_tick) < 6000; 
        const PhysicalPulse = FreshnessWindow && telemetry.instant_speed > 1024;
        const runtime = now - task.start;

        if (runtime < 45000) {
            if (task.curr > 0 || runtime <= 15000) return;
            
            if (!FreshnessWindow && runtime < 60000) return; 

            if (telemetry.last_tick === 0 && runtime < 60000) return;
            
            if (PhysicalPulse) {
                this._ForceModel(task, now); 
                if (now % 5000 < 1500) { 
                        this.logger.debug(`${this.uiRid} | [Quo] [${task.name}] 进度0%但速度 ${(telemetry.instant_speed/1024).toFixed(0)}KB/s | 状态:${telemetry.connection_state || 'UNKNOWN'}`);
                }
                return; 
            }
            
            let killReason = `起步失败(15s无进度且无流量/状态:${telemetry.connection_state || 'UNKNOWN'})`;

            if (runtime > 25000 && telemetry.total_bytes < 102400) {
                 if (task.name.includes("GitHub") || task.name.includes("Direct")) {
                     this.logger.debug(`${this.uiRid} | [Quo] 流量欺诈检测: [${task.name}] (TCP握手成功但无有效载荷)`);
                     killReason = "流量欺诈 (虚假连接)";
                 }
            }
            
            this._kill(task, killReason);
            return; 
        }

        if (leader && leader.BPP && !task.BPP && (now - task.active < 30000)) return;

        if (leader && task.id !== leader.id && leader.curr > task.curr + 30) {
            const leaderTelemetry = leader.context?.telemetry;
            const LeaderFreshness = leaderTelemetry && (now - (leaderTelemetry.last_tick || 0)) < 6000;
            const leaderSpeed = LeaderFreshness ? (leaderTelemetry.instant_speed || 0) : 0;
            
            const fastFloor = 512 * 1024;
            const fastCeil = 1536 * 1024;
            
            if (leaderSpeed >= fastFloor && PhysicalPulse) {
                const ratio = Math.max(0, Math.min(1, (leaderSpeed - fastFloor) / (fastCeil - fastFloor)));
                const graceGap = 30 + (20 * ratio);
                if ((leader.curr - task.curr) <= graceGap) return;
            }

            this.logger.debug(`${this.uiRid} | [Quo] 裁决: [${task.name}](${task.curr}%) 落后于 [${leader.name}](${leader.curr}%)`);
            this._kill(task, "严重落后");
            return;
        }

        if (leader && leader.speed > 2 && task.speed < 0.2) {
            if (PhysicalPulse) {
                this._ForceModel(task, now);
                return;
            }
            this.logger.debug(`${this.uiRid} | [Quo] 节点: [${task.name}] 疑似假死，回收任务中... | 状态:${telemetry.connection_state || 'UNKNOWN'}`);
            this._kill(task, "速度过慢且无物理流量");
        }
    }

    _kill(task, reason) {
        if (task.state >= MBTQuoCRS.Task_State.Melting) return; 
        task.state = MBTQuoCRS.Task_State.Aborting; 

        if (!task.context?.signal?.aborted) {
            task.context.controller.abort(reason);
        }
    }

    _done(id, result) {
        const task = this.tasks.get(id);
        if (!task) return;
        this.logger.info(`${this.uiRid} | [Quo] 📥 [${task.name}] 完成下载`);
        this._finalize(result, null);
    }

    _fail(id, err) {
        const task = this.tasks.get(id);
        if (!task) return;

        const AbortedSignalStatus = err.code === 'SCHEDULER_ABORT' || err.name === 'AbortError' || task.context?.signal?.aborted;

        if (!AbortedSignalStatus) {
            if (err.isMelting) {
                task.state = MBTQuoCRS.Task_State.Melting;
                this.logger.debug(`${this.uiRid} | [Quo] 熔断: [${task.name}] - ${err.message}`);
            } else {
                const msg = err.message?.split('\n')[0] || '未知错误';
                this.logger.debug(`${this.uiRid} | [Quo] 异常: [${task.name}] - ${msg}`);
            }
        } else {
            if (task.state < MBTQuoCRS.Task_State.Aborting) {
                task.state = MBTQuoCRS.Task_State.Aborting;
            }
            this.logger.debug(`${this.uiRid} | [Quo] 🛑 任务中止: [${task.name}]`);
        }

        this.tasks.delete(id);
        this._accPend();

        if (this.tasks.size === 0 && this.pendingTimers.size === 0) {
            if (this.closed) return; 
            this._finalize(null, err || new Error("所有任务失败"));
        }
    }

    _finalize(result, error) {
        if (this._state === MBTQuoCRS.CRS_State.Finalizing || this._state === MBTQuoCRS.CRS_State.Closed) return;
        this._state = MBTQuoCRS.CRS_State.Finalizing;

        MBTSignalTrap.getInstance().off('shutdown', this._shutdownHandler);
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
        if (error) this.reject(error);
        else this.resolve(result);
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
        
        this.logger.debug(`${this.uiRid} | [Quo] 前序任务失败触发调度: ${data.id}`);
        
        const newTimerId = setTimeout(() => {
            if (this.pendingTimers.has(newTimerId) || !this.pendingTimers) return; 
             this._activate(data.id, data.factory, data.BPP);
        }, MBTMath.Range(100, 300));

        const delay = MBTMath.Range(100, 300);
        const rescheduleId = setTimeout(() => {
            this.pendingTimers.delete(rescheduleId); 
            this._activate(data.id, data.factory, data.BPP);
        }, delay);
        this.pendingTimers.set(rescheduleId, data);
    }

    getStatus() {
        let maxProgress = 0;
        let activeCount = 0;
        const now = Date.now();
        for (const task of this.tasks.values()) {
            if (task.curr > maxProgress) maxProgress = task.curr;
            if (now - task.active < 60000) activeCount++;
        }
        return { count: this.tasks.size + this.pendingTimers.size, maxProgress, activeCount };
    }

    stop() {
        if (!this.closed) {
            this.logger.warn(`${this.uiRid} | [Quo] 🛑 外部停止`);
            this._finalize(null, new Error("已被信号捕获器停止"));
        }
    }
}

class MBTSignalTrap extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
        this.logger = HadesEntry({}, getCore());
        this._isShuttingDown = false;
        this._sysHandler = this._sysHandler.bind(this);
        this._bound = false;
        this._bindSysEvents();
    }

    static getInstance(logger) {
        if (!global[Trap_Symbol]) {
            global[Trap_Symbol] = new MBTSignalTrap();
        }
        const instance = global[Trap_Symbol];
        if (logger) instance.logger = logger;
        return instance;
    }

    static async HMR_Entry(logger) {
        const Hades = HadesEntry({}, logger || getCore());
        const oldInstance = global[Trap_Symbol];
        if (oldInstance) {
            Hades.D(`[HMR] 检测到旧实例正在执行卸载...`);
            try {
                oldInstance.dispose();
                oldInstance.emit('reload');
                oldInstance.removeAllListeners('shutdown');
                oldInstance.removeAllListeners('reload');
            } catch (e) {
                Hades.E(`[HMR] 旧实例清理异常:`, e);
            }
            global[Trap_Symbol] = null;
        }
        return this.getInstance(Hades);
    }

    _sysHandler(signal) {
        if (this._isShuttingDown) return;
        this._isShuttingDown = true;
        this.emit('shutdown', signal);
    }

    _bindSysEvents() {
        if (this._bound) return;
        process.removeListener('SIGINT', this._sysHandler);
        process.removeListener('SIGTERM', this._sysHandler);  
        process.on('SIGINT', this._sysHandler);
        process.on('SIGTERM', this._sysHandler); 
        this._bound = true;
    }

    dispose() {
        if (!this._bound) return;   
        process.removeListener('SIGINT', this._sysHandler);
        process.removeListener('SIGTERM', this._sysHandler);
        this._bound = false;
        this._isShuttingDown = true; 
    }
}

class PoseidonSpear {
    static STRATEGIES = new Map([
        [/Suspended due to abuse|abuse report/i, { time: 24 * 60 * 60 * 1000, type: "服务封禁" }],
        [/Invalid input|502 Bad Gateway|index-pack/i, { time: 60 * 60 * 1000, type: "协议/服务端故障" }],
        [/403|429|redirection|too many requests/i, { time: 15 * 60 * 1000, type: "限流/拒绝" }],
        [/ESLOWNET|龟速|假死|LowSpeed|stall threshold/i, { time: 10 * 60 * 1000, type: "性能降级" }],
        [/timed out|Connection refused|resolve host|Could not resolve/i, { time: 5 * 60 * 1000, type: "网络波动" }]
    ]);

    static H2_ERRORS = [
        /HTTP\/2 stream \d+ was not closed cleanly/i,
        /curl 92 HTTP\/2/i,
        /unexpected disconnect while reading sideband packet/i,
        /RPC failed; curl 56 Failure when receiving data from the peer/i,
        /Protocol "HTTP\/2" not supported or disabled/i
    ];

    static LOG_WHITELIST = [
        "fatal:", "error:", "remote:", "warning:",
        "Could not resolve", "timed out", "Connection refused",
        "SSL", "certificate", "HTTP/2", "stream",
        "ESLOWNET", "龟速", "假死"
    ];

    static get _state() {
        const Pose_Symbol = Symbol.for('Yz.CowCoo.MBT.PoseidonSpear.State.v2');
        if (!global[Pose_Symbol]) global[Pose_Symbol] = new Map();
        return global[Pose_Symbol];
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
        const Hades = logger ? HadesEntry({}, logger) : null;
        let count = 0;
        for (const [name, record] of this._state) {
            if (["网络波动", "限流/拒绝", "性能降级"].includes(record.reason)) {
                this._state.delete(name);
                count++;
            }
        }
        if (count > 0 && Hades) {
            Hades.D(`[PoseidonSpear] 复活 ${count} 个节点应对枯竭。`);
        }
    }

    static probeProtocol(errorMsg) {
        if (!errorMsg) return null;
        for (const regex of this.H2_ERRORS) {
            if (regex.test(errorMsg)) return 'DOWNGRADE_H1';
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
    static #instance = null;
    #timer = null;

    constructor() {
        this.tier = 3; 
        this.freeMemMB = 0;
        this.#timer = setInterval(() => this._monitor(), 2000);
        this.#timer.unref();
        this._monitor(); 
    }

    static getInstance() {
        if (!this.#instance) {
            this.#instance = new Cerberus();
        }
        return this.#instance;
    }

    stop() {
        if (this.#timer) {
            clearInterval(this.#timer);
            this.#timer = null;
        }
    }

    static reset() {
        if (this.#instance) {
            this.#instance.stop();
            this.#instance = null;
        }
    }

    _monitor() {
        this.freeMemMB = os.freemem() / 1024 / 1024;
        if (this.freeMemMB < 400) {
            this.tier = 1; 
        } else if (this.freeMemMB < 800) {
            this.tier = 2; 
        } else {
            this.tier = 3; 
        }
    }

    async breath(index) {
        if (this.tier === 3) return;
        if (this.tier === 1 && index % 10 === 0) {
            await common.sleep(200);
        }
        else if (this.tier === 2 && index % 50 === 0) {
            await common.sleep(50);
        }
    }

    getGitConcurrency() {
        if (this.tier === 1) return 1; 
        if (this.tier === 2) return 2;
        return 5; 
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
const Version = `5.2.0-${crypto.createHash('md5').update(fs.readFileSync(__filename)).digest('hex').substring(0, 6).toUpperCase()}`;
const PFL = { 
  NONE: 0, RX18_ONLY: 1, PX18_PLUS: 2,
   getDescription: (level) => ({ 
    0: "不过滤", 
    1: "过滤R18", 
    2: "全部敏感项" 
  }[level] ?? "未知"), 
};

const Valid_Tags = { 
  "彩蛋": { key: "other", value: "Egg" }, 
  "ai": { key: "other", value: "LLMCanvas" }, 
  "横屏": { key: "layout", value: "fullscreen" }, 
  "r18": { key: "rated", value: "r18" }, 
  "p18": { key: "rated", value: "p18" }, 
};

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
};

const Repos_List = {
  "何日见": { url: "https://github.com/herijian1/characterpic1", default: true, order: 1, aboutDisplay: "喵喵插件原神星铁高质量面板图" },
  "夜": { url: "https://github.com/ye3011/normal-character", default: true, order: 2, aboutDisplay: "喵喵插件面板图" },
  "花花": { url: "https://gitcode.com/HanaHimeUnica/super-character", default: true, order: 3, aboutDisplay: "喵喵插件面板图" }
};

function MBTPipeControl(command, args, options = {}, timeout = 0, onStdErr, onStdOut, onProgress, onSlowSpeed, MBTProcc) {
  const Hades = HadesEntry();
  const Rid = options.Rid || 'SYSTEM'; 
  const RidTag = options.RidTag || `[${Rid}]`;

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
      connection_state: 'CONNECTING'
  };

  const constraints = {
      stallThreshold: 60 * 1000,       
      zombieThreshold: 5 * 60 * 1000,  
      lowSpeedLimit: 1024,             
      lowSpeedStrikes: 4,              
      lowSpeedCheckInterval: 30 * 1000,
      hardTimeout: 20 * 60 * 1000,     
      ...options.constraints           
  };

  if (command === 'git' && Array.isArray(options.gitConfigs)) {
      const configArgs = [];
      options.gitConfigs.forEach(cfg => configArgs.push('-c', cfg));
      args = [...configArgs, ...args];
  }

  const isSilentOp = args.some(a => ['rev-parse', 'log', 'ls-remote', 'status', 'diff'].includes(a));
  const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'];
  const explicitProxyKeys = new Set();
  if (options.env) {
      proxyVars.forEach(v => {
          if (options.env[v]) explicitProxyKeys.add(v);
      });
  }
  let runEnv = { ...process.env, ...(options.env || {}) };
  proxyVars.forEach(v => {
      if (!explicitProxyKeys.has(v)) delete runEnv[v];
  });

  if (options.preferV6) {
      if (process.platform === 'linux') {
          runEnv.RES_OPTIONS = 'inet6 attempts:2';
          if (!isSilentOp) Hades.D(`${RidTag} 注入IPv6策略`);
      } else {
          if (!isSilentOp) Hades.D(`${RidTag} 系统支持IPv6，依赖OS默认路由选择`);
      }
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
          Hades.D(`${RidTag} ⚠️ 警告：进程流将使用任务环境配置！(参数: ${inherited.join(', ')})`);
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
      const checkLocal = () => {
          return MiaoPluginMBT._CheckCtx(targetUrl);
      };

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
    
    let stdout = "";
    let stderr = "";
    let timer = null;
    let Fuse = null;
    let Pulse = null;
    let EmergencyPulse = null;
    const Constraints = { MAX_BUFFER: 1024 * 1024, TAIL_SIZE: 512 * 1024 };
    let lastActiveTime = Date.now(); 
    let lastPercent = 0;     
    let lastUpdate = Date.now();
    let ThrottleSlow = false; 
    let demerits = 0; 
    let lastCheckTime = Date.now(); 
    let lastTelemetryEmit = 0;
    
    const { signal } = options;
    if (signal?.aborted) return reject(new Error('已中止'));
    if (MBTSignalTrap.getInstance()._isShuttingDown) return reject(new Error("系统正在关闭"));

    let proc;
    try {
      const spawnOptions = { stdio: "pipe", ...options, env: runEnv, shell: false, detached: true, windowsHide: true };
      currentState = STATE.RUNNING;
      proc = spawn(command, args, spawnOptions);
      if (MBTProcc?.register) MBTProcc.register(proc);
    } catch (spawnError) {
      Hades.E(`${RidTag} 启动失败: ${command}`, spawnError);
      return reject(spawnError);
    }

    const killProcess = async (code, reason, force = false) => {
        if (currentState >= STATE.KILLING && !force) return;
        currentState = STATE.KILLING;

        clearInterval(Pulse);
        clearInterval(EmergencyPulse);
        clearTimeout(timer);
        clearTimeout(Fuse);
        
        if (signal) signal.removeEventListener('abort', abortHandler);
        if (MBTProcc?.unregister) MBTProcc.unregister(proc);
        
        const err = new MetisError(reason || "Process Terminated", code || "SIGTERM");
        err.stdout = stdout; err.stderr = PoseidonSpear.sanitize(stderr); err.rawStderr = stderr;
        err.metrics = _finalizeMetrics();
        if (proc) proc._killError = err;

        Fuse = setTimeout(async () => {
            if (currentState !== STATE.CLOSED) {
                try {
                    if (MBTProcc?.kill) await MBTProcc.kill(proc, 'SIGKILL');
                    else await MBTProcPool.kill(proc, 'SIGKILL');
                } catch {}
                currentState = STATE.DEAD;
                reject(err);
            }
        }, 5000);

        try {
            if (MBTProcc?.kill) {
                await MBTProcc.kill(proc, 'SIGTERM');
            } else {
                await MBTProcPool.kill(proc, 'SIGTERM');
            }
        } catch (killErr) {
        }
    };

    const abortHandler = () => {
        const abortReason = signal?.reason;
        const abortText = abortReason instanceof Error ? abortReason.message : (abortReason ? String(abortReason) : '外部中止');
        killProcess('SCHEDULER_ABORT', `任务已中止(${abortText})`);
    };
    
    if (signal) signal.addEventListener('abort', abortHandler, { once: true });

    if (isClone) {
        Fuse = setTimeout(() => {
            killProcess('ETIMEDOUT', `硬性超时: 任务运行超过 ${constraints.hardTimeout / 60000} 分钟`);
        }, constraints.hardTimeout);
    }

    const emitTelemetry = (immediate = false) => {
        if (!options.onTelemetry || typeof options.onTelemetry !== 'function') return;
        const now = Date.now();
        if (!immediate && now - lastTelemetryEmit < 600) return;
        lastTelemetryEmit = now;
        telemetry.last_tick = now;
        try { options.onTelemetry({ ...telemetry, pid: proc?.pid }); } catch {}
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
        
        const avgSpeed = (now - telemetry.startTime) > 0 ? (telemetry.rx_bytes / ((now - telemetry.startTime)/1000)) : 0;
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
            killProcess('ESLOWNET', `检测到进程假死 (超过 ${constraints.stallThreshold/1000} 秒无 IO 交互)`);
            return;
        }

        if (isGitTransfer && (now - lastUpdate > constraints.zombieThreshold)) {
            if (telemetry.instant_speed > constraints.lowSpeedLimit) {
                lastUpdate = now; 
            } else {
                killProcess('ESLOWNET', `检测到僵尸连接 (超过 ${constraints.zombieThreshold/60000} 分钟无有效进度)`);
                return;
            }
        }

        if (isGitTransfer && (lastPercent > 0 || telemetry.git_objects > 0) && !options.disableTurtleCheck) {
            if (now - lastCheckTime >= constraints.lowSpeedCheckInterval) {
                lastCheckTime = now;

                if (telemetry.instant_speed < constraints.lowSpeedLimit) {
                    demerits++;
                    if (typeof onSlowSpeed === 'function' && !ThrottleSlow) {
                        ThrottleSlow = true; onSlowSpeed(); 
                    }
                    if (demerits >= constraints.lowSpeedStrikes) {
                        killProcess('ESLOWNET', `检测到下载龟速 (连续 ${demerits} 次检测周期速度 < ${(constraints.lowSpeedLimit/1024).toFixed(1)}KB/s)`);
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
      lastActiveTime = Date.now();

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
        if (line.includes('127.0.0.1') || line.includes('Connection established') || line.includes('SOCKS5') || line.includes('Proxy replied') || line.includes('gnutls_handshake')) continue; 

        if (streamName === "stdout") {
            if (stdout.length < Constraints.MAX_BUFFER) {
                stdout += line + '\n';
            } else if (stdout.length < Constraints.MAX_BUFFER + Constraints.TAIL_SIZE) {
                stdout += line + '\n'; 
            } else {
                 if (!proc._truncated) {
                    stdout += `\n...[Truncated, buffering tail code only]...\n`;
                    proc._truncated = true;
                 }
            }
        } else {
            if (stderr.length < Constraints.MAX_BUFFER) stderr += line + '\n';
            
            if (line.includes('Cloning into')) telemetry.connection_state = 'HANDSHAKING';
            const objectsMatch = line.match(/\((\d+)\/(\d+)\)/);
            if (objectsMatch && objectsMatch[1] && objectsMatch[2]) {
              const done = parseInt(objectsMatch[1], 10);
              const total = parseInt(objectsMatch[2], 10);
              if (Number.isFinite(total) && total > 0) {
                telemetry.git_objects = total;
                if (Number.isFinite(done) && done >= 0) {
                  const progress = Math.floor((done / total) * 100);
                  if (progress > lastPercent) lastPercent = progress;
                }
              }
            }
            if (line.includes('objects:') || line.includes('Unpacking')) {
              lastUpdate = Date.now();
              telemetry.connection_state = 'TRANSFERRING';
              if (timer) {
                clearTimeout(timer);
                timer = setTimeout(() => { killProcess('ETIMEDOUT', `命令执行超时 (${timeout}ms)`); }, timeout);
              }
            }
        }
        if (externalCallback) try { externalCallback(line); } catch (e) {}
      }
    };

    proc.stdout?.on("data", (data) => OutStream("stdout", data, onStdOut));
    proc.stderr?.on("data", (data) => OutStream("stderr", data, onStdErr));

    proc.on("error", (err) => {
      if (currentState === STATE.CLOSED || currentState === STATE.DEAD) return;
      currentState = STATE.DEAD; 
      clearInterval(Pulse); clearInterval(EmergencyPulse); clearTimeout(timer); clearTimeout(Fuse);
      if (signal) signal.removeEventListener('abort', abortHandler);
      if (MBTProcc?.unregister) MBTProcc.unregister(proc);
      err.stdout = stdout; err.stderr = stderr; err.rawStderr = stderr;
      err.metrics = _finalizeMetrics();
      reject(err);
    });

    proc.on("close", (code, signal) => {
      if (currentState === STATE.CLOSED || currentState === STATE.DEAD) return;
      currentState = STATE.CLOSED;

      clearInterval(Pulse); clearInterval(EmergencyPulse); clearTimeout(timer); clearTimeout(Fuse);
      if (signal) signal.removeEventListener('abort', abortHandler);
      if (MBTProcc?.unregister) MBTProcc.unregister(proc);
      const finalMetrics = _finalizeMetrics();
      
      if (proc._killError) {
          reject(proc._killError);
          return;
      }

      if (code === 0) {
        resolve({ code: 0, signal, stdout, stderr, metrics: finalMetrics });
      } else {
        const simpleCmd = cmdStr.replace(/git -c .*? clone/, "git clone").split(" ").slice(0, 4).join(" ") + "...";
        const sanitizedStderr = PoseidonSpear.sanitize(stderr);
        const tailLine = sanitizedStderr.trim().split('\n').filter(Boolean).slice(-1)[0];
        const err = new Error(`命令执行失败 (退出码 ${code}): ${simpleCmd}${tailLine ? ` | ${tailLine}` : ""}`);
        err.code = code ?? "UNKNOWN"; err.signal = signal;
        err.stdout = stdout; err.stderr = sanitizedStderr; err.rawStderr = stderr; 
        err.metrics = finalMetrics;
        reject(err);
      }
    });
  });
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
        this.logger = HadesEntry({}, logger || getCore());
        this._queue = [];
        this._holder = null; 
        this._isLocked = false;
        this._perfStart = 0; 
    }

    async run(taskFn, options = {}) {
        const { ttl = 0, wait = 0, id = 'Unknown', instant = false, priority = 0 } = options;
        const rid = `[Metis:${this.name}:${id}]`;

        try {
            await this._acquire(id, wait, instant, priority);
        } catch (err) {
            if (err.code === 'METIS_BUSY') {
                this.logger.debug(`${rid} 🔒 锁被占用`);
            } else if (err.code === 'METIS_WAIT_TIMEOUT') {
                this.logger.debug(`${rid} ⏳ 等待锁超时 (${wait}ms)`);
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
                this.logger.debug(`${rid} ⏰ 任务超时 (设:${ttl}ms|实:${elapsed.toFixed(1)}ms)，强制释放`);
                controller.abort('METIS_TTL_EXPIRED');
                if (this._holder) this._holder.expired = true;
            }, ttl);
        }

        try {
            return await taskFn(controller.signal);
        } catch (err) {
            if (controller.signal.aborted && controller.signal.reason === 'METIS_TTL_EXPIRED') {
                throw new MetisError(`任务超过 TTL 时间限制 (${ttl}ms)`, 'METIS_TTL_EXPIRED');
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
        this.logger.warn(`[Metis:${this.name}] 🧨 强制重置: ${reason}`);
        while (this._queue.length > 0) {
            const item = this._queue.shift();
            if (item.timer) clearTimeout(item.timer);
            item.reject(new MetisError(`锁强制重置: ${reason}`, 'METIS_RESET'));
        }
        this._holder = null;
        this._isLocked = false;
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

class ErrDoc {
    static #history = new Map();
    static #DEBOUNCE_MS = 5000;

    static shouldReport(opName, errCode) {
        const key = `${opName}:${errCode}`;
        const now = Date.now();
        if (this.#history.has(key)) {
            const last = this.#history.get(key);
            if (now - last < this.#DEBOUNCE_MS) return false;
        }
        this.#history.set(key, now);
        if (this.#history.size > 50) this.#history.clear();
        return true;
    }

    static diagnose(err) {
        const msg = ((err?.message || "") + (err?.stderr || "")).toLowerCase();
        
        if (this.#isNet(msg)) return 'NETWORK';
        if (this.#isGit(msg)) return 'GIT';
        
        if (msg.includes('eacces') || msg.includes('eperm') || msg.includes('ebusy')) return 'FILESYSTEM';
        if (msg.includes('enoent')) return 'FILESYSTEM';
        
        if (msg.includes('json.parse') || msg.includes('yaml.parse')) return 'CONFIG';
        if (msg.includes('referenceerror') || msg.includes('typeerror')) return 'CODE';
        
        return 'UNKNOWN';
    }

    static #isNet(msg) {
        if (msg.includes('timed out') || msg.includes('timeout')) return true;
        if (msg.includes('connection refused') || msg.includes('reset')) return true;
        if (msg.includes('resolve host') || msg.includes('403 forbidden')) return true;
        if (msg.includes('502 bad gateway') || msg.includes('504 gateway time-out')) return true;
        return false;
    }

    static #isGit(msg) {
        if (msg.includes('not a git repository')) return true;
        if (msg.includes('lock file') || msg.includes('index.lock')) return true;
        if (msg.includes('authentication failed') || msg.includes('permission denied')) return true;
        if (msg.includes('unrelated histories') || msg.includes('diverging branches')) return true;
        return false;
    }
    
    static isSystemStressed() {
        try {
            const mem = process.memoryUsage().rss;
            if (mem > 1.2 * 1024 * 1024 * 1024) return true;
        } catch {}
        return false;
    }
}

class MBTWorker {
    constructor(logger) {
        this.logger = HadesEntry({}, logger || getCore());
        this.worker = null;
        this.workerPath = path.join(MiaoPluginMBT.Paths.TempNiuPath, "worker.js");
    }

    async _initWorker() {
        const Hades = this.logger;
        try {
            let script = await Hermes.getWorkerScript(Hades);
            
            if (!script) {
                try {
                    script = await Ananke.readFile(this.workerPath, 'utf-8');
                    Hades.D(`[MBTWorker] 使用本地缓存脚本`);
                } catch {
                    Hades.W(`[MBTWorker] 脚本缺失且网络不可达，将降级至线程运行`);
                }
            }

            if (script) {
                const dirNamesJson = JSON.stringify(Nomos.DirNames || []);
                script = script.replace(/\$\{JSON\.stringify\(Nomos\.DirNames\)\}/g, dirNamesJson);
                await Ananke.writeText(this.workerPath, script);
                this.worker = new Worker(this.workerPath);
                this.worker.on('error', (err) => {
                    Hades.E(`[MBTWorker] 线程错误:`, err);
                });
                this.worker.on('exit', () => {
                   this.worker = null;
                });
            }
        } catch (err) {
            Hades.E(`[MBTWorker] 初始化失败:`, err);
        }
    }

    async _cleanup() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
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
                
                const handler = (msg) => {
                    if (msg.id !== id) return;
                    cleanup();
                    if (msg.type === 'ERROR') reject(new Error(msg.error));
                    else resolve(msg.result);
                };
                const handleError = (err) => {
                    cleanup();
                    reject(err);
                };
                const handleExit = (code) => {
                    cleanup();
                    reject(new Error(`Worker 线程异常退出，退出码: ${code}`));
                };
                const cleanup = () => {
                    this.worker.off('message', handler);
                    this.worker.off('error', handleError);
                    this.worker.off('exit', handleExit);
                };

                this.worker.on('message', handler);
                this.worker.once('error', handleError);
                this.worker.once('exit', handleExit);
                this.worker.postMessage({ type, id, payload });
            });
        } catch (err) {
            Hades.D(`[MBTWorker] 线程任务失败正在降级执行:`, err);
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
            for (const repo of payload) {
                results[repo.name] = await Ananke.scanRepoStats(repo.path);
            }
            return results;
        }

        throw new Error(`未知的任务类型: ${type}`);
    }

    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

class Morpheus {
    static #initDone = false;
    static #browserInstance = null; 
    static #cleanupHandlers = new Set();
    
    static get RenderDir() {
        return path.join(MiaoPluginMBT.Paths.TempNiuPath, "Render");
    }

    static async #ensureDir(logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
        if (this.#initDone) return;
        if (await Ananke.mkdirs(this.RenderDir)) {
            this.#initDone = true;
        } else {
            Hades.E(`[渲染器] 无法创建渲染目录`);
        }
    }

    static #generateFilename(businessName) {
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

    static async #getBrowser(logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
        if (this.#browserInstance && this.#browserInstance.isConnected()) {
            return this.#browserInstance;
        }

        const launchOptions = {
            headless: "new",
            args: [
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-sandbox',
                '--no-zygote',
                '--single-process'
            ]
        };

        try {
            this.#browserInstance = await PuppCow.launch(launchOptions);
            
            if (!this.#hasBoundExit) {
                const cleanup = async () => {
                    if (this.#browserInstance) await this.#browserInstance.close();
                };
                
                const register = (evt) => {
                    process.on(evt, cleanup);
                    this.#cleanupHandlers.add({ event: evt, fn: cleanup });
                };

                register('exit');
                register('SIGINT');
                register('SIGTERM');
                
                this.#hasBoundExit = true;
            }
            
            return this.#browserInstance;
        } catch (err) {
            Hades.E("[渲染器] 致命错误：无法启动内置 Puppeteer", err);
            throw err;
        }
    }
    static #hasBoundExit = false;

    static async reset() {
        if (this.#cleanupHandlers.size > 0) {
            for (const handler of this.#cleanupHandlers) {
                process.removeListener(handler.event, handler.fn);
            }
            this.#cleanupHandlers.clear();
        }
        this.#hasBoundExit = false;
        await this.closeBrowser();
    }

    static async shot(businessName, options = {}) {
        const Hades = HadesEntry({}, options.logger || getCore());
        await this.#ensureDir(Hades); 

        const {
            tplFile,
            htmlContent,
            data = {},
            imgType = "png",
            navOpts = { waitUntil: "networkidle0", timeout: 30000 },
            pageBoundingRect,
            width,
            padding = 0, /*20*/
            transparentBackground = false
        } = options;

        const defaultData = {
            Version: Version,
            RenderMatrix: MiaoPluginMBT.RenderMatrix(),
            Cow_Res_Path: `file://${MiaoPluginMBT.Paths.OpsPath}/`.replace(/\\/g, '/'),
            sysTimestamp: Morpheus.#nowStr()
        };

        const DataMaps = { ...defaultData, ...data };
        let categoryFolder = "";
        if (businessName.startsWith("Vis-") || businessName.startsWith("visualize-")) {
            categoryFolder = "Vis";
        } else if (businessName.startsWith("Map-")) {
            categoryFolder = "Map";
        } else if (businessName.startsWith("BanList-")) {
            categoryFolder = "BanList";
        }
        const subDir = categoryFolder ? path.join(categoryFolder, businessName) : businessName;
        const targetDir = path.join(this.RenderDir, subDir);
        
        try {
            await Ananke.mkdirs(targetDir);
        } catch (err) {
            Hades.E(`[渲染器] 创建业务子目录失败: ${targetDir}`, err);
            return null;
        }

        const RenderFileName = this.#generateFilename(businessName);
        const htmlPath = path.join(targetDir, `${RenderFileName}.html`);
        
        if (process.env.NODE_ENV === 'development' || options.debug) {
            Hades.D(`[Morpheus Debug] HTML: ${htmlPath}`);
        }

        let renderHtml = "";

        try {
            if (htmlContent) {
                renderHtml = template.render(htmlContent, DataMaps);
            } else if (tplFile) {
                const tplSource = await Ananke.readFile(tplFile, "utf-8");
                renderHtml = template.render(tplSource, DataMaps);
            } else {
                throw new Error("Morpheus: 缺少模板文件或HTML内容");
            }
             await Ananke.writeText(htmlPath, renderHtml);
        } catch (err) {
            Hades.E(`[渲染器] HTML 生成失败: ${err.message}`);
            return null;
        }

        let page = null;
        try {
            const browser = await this.#getBrowser(Hades);
            page = await browser.newPage();

           if (width) {
                await page.setViewport({ width: width, height: 1000, deviceScaleFactor: 1 });
            }

            await page.goto(`file://${htmlPath}`, { ...navOpts, waitUntil: 'load' });

            await page.waitForFunction(() => {
                const images = Array.from(document.images);
                return images.every(img => img.complete);
            }, { timeout: 15000 }).catch(() => {});

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
                omitBackground: false 
            };
            
           if (imgType === 'jpeg') {
                screenshotConfig.quality = 90;
                screenshotConfig.omitBackground = false; 
            }
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

            return imgBuffer;

        } catch (err) {
            Hades.E(`[渲染器] 截图失败 [${businessName}]:`, err);
            return null;
        } finally {
            if (page) {
                try { await page.close(); } catch (e) {}
            }
        }
    }

    static async housekeeping(logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
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
            if (cleaned > 0) Hades.D(`[渲染器] 清理了 ${cleaned} 个过期渲染文件。`);
        } catch (err) { 
            Hades.E(`[渲染器] Housekeeping 失败:`, err); 
        }
    }

    static #bgCache = { files: [], lastScan: 0, ttl: 60000 };
    static #headerCache = { files: [], lastScan: 0, ttl: 60000 };

    static async pickBg() {
        const files = await this.#scanDir(this.#bgCache, "bg");
        const selected = MBTMath.Sample(files);
        return selected ? `file://${path.join(MiaoPluginMBT.Paths.BgImgPath, 'bg', selected).replace(/\\/g, '/')}` : '';
    }

    static async pickHeader() {
        const files = await this.#scanDir(this.#headerCache, "picture");
        const selected = MBTMath.Sample(files);
        return selected ? `file://${path.join(MiaoPluginMBT.Paths.BgImgPath, 'picture', selected).replace(/\\/g, '/')}` : '';
    }

    static async pickHeaderSet(count = 20) {
        const files = await this.#scanDir(this.#headerCache, "picture");
        if (files.length === 0) return [];

        const result = [];
        for (let i = 0; i < count; i++) {
            const file = files[i % files.length]; 
            if (file) {
                result.push(`file://${path.join(MiaoPluginMBT.Paths.BgImgPath, 'picture', file).replace(/\\/g, '/')}`);
            }
        }
        return MBTMath.Shuffle(result);
    }

    static getStaticImg(filename, subDir = "") {
        const targetPath = subDir 
            ? path.join(MiaoPluginMBT.Paths.BgImgPath, subDir, filename)
            : path.join(MiaoPluginMBT.Paths.BgImgPath, filename);
        return `file://${targetPath.replace(/\\/g, '/')}`;
    }

    static async #scanDir(cacheObj, subDirName) {
        const now = Date.now();
        if (now - cacheObj.lastScan < cacheObj.ttl && cacheObj.files.length > 0) return cacheObj.files;
        const targetDir = path.join(MiaoPluginMBT.Paths.BgImgPath, subDirName);
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
                //console.log("[渲染器] 已关闭内置浏览器实例");
            } catch (e) {
                //console.error("[渲染器] 关闭浏览器失败", e);
            }
            this.#browserInstance = null;
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
        config: new Metis('AnankeConfig', getCore()),
        banList: new Metis('AnankeBanList', getCore())
    };

    static reset() {
        if (this.#locks.config) this.#locks.config.emergencyReset('Hot Reload');
        if (this.#locks.banList) this.#locks.banList.emergencyReset('Hot Reload');
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
                const Hades = HadesEntry();
                Hades.D(`[文件管理] 删除失败: ${targetPath} (${err.code})`);
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
            const Hades = HadesEntry();
            if (!['EEXIST', 'EACCES', 'EPERM'].includes(error.code)) {
                Hades.D(`[文件管理] 树复制失败 ${source} -> ${dest}:`, error.message);
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
                    const subDirs = [];
                    const files = [];
                    for(const entry of entries) {
                        if(entry.isDirectory()) subDirs.push(path.join(dir, entry.name));
                        else if(entry.isFile()) files.push(path.join(dir, entry.name));
                    }
                    
                    const sizes = await this.parallel(files, async (f) => {
                        try { return (await fsPromises.stat(f)).size; } catch { return 0; }
                    }, 20);
                    
                    for(const s of sizes) totalSize += s;
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

            let shouldCopy = false;
            if (!destStats) {
                shouldCopy = true;
            } else if (srcStats.size !== destStats.size) {
                shouldCopy = true;
            } else if (checkMd5) {
                const srcMd5 = await Ananke.fileMD5(src);
                const destMd5 = await Ananke.fileMD5(dest);
                if (srcMd5 !== destMd5) shouldCopy = true;
            }

            if (shouldCopy) {
                if (defer && typeof defer === 'object') {
                    const min = defer.min || 0;
                    const max = defer.max || 0;
                    if (max > min) {
                         const task = QuantumFlux(async () => {
                             try {
                                  await fsPromises.mkdir(path.dirname(dest), { recursive: true });
                                  await fsPromises.copyFile(src, dest);
                             } catch (e) {}
                         }, min, max);
                         task();
                         return false; 
                    }
                }

                await fsPromises.mkdir(path.dirname(dest), { recursive: true });
                await fsPromises.copyFile(src, dest);
                return true;
            }
            return false;
        } catch (err) {
            const Hades = HadesEntry();
            Hades.D(`[文件管理] 同步文件失败 ${src} -> ${dest}: ${err.message}`);
            return false;
        }
    }

    static async writeText(filePath, content) {
        try {
            await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
            await fsPromises.writeFile(filePath, content, 'utf-8');
            return true;
        } catch (err) {
            const Hades = HadesEntry();
            Hades.E(`[文件管理] 写入文件失败 ${filePath}:`, err);
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
        try {
            await fsPromises.mkdir(path.dirname(newPath), { recursive: true });
            await fsPromises.rename(oldPath, newPath);
            return true;
        } catch (err) {
            const Hades = HadesEntry();
            Hades.E(`[文件管理] 重命名失败 ${oldPath} -> ${newPath}:`, err);
            throw err;
        }
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
        const allowedKeys = ['Repo_Ops', 'PFL_Ops', 'RenderScale', 'Ai', 'EasterEgg', 'layout'];
        const filtered = {};
        for (const key of allowedKeys) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                filtered[key] = data[key];
            } else if (DFC && Object.prototype.hasOwnProperty.call(DFC, key)) {
                filtered[key] = DFC[key];
            }
        }
        return filtered;
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
        const Hades = HadesEntry({}, logger || getCore());
        if (typeof configPath !== 'string') {
            Hades.D(`[文件管理] loadingConfig 接收到非法路径 (${typeof configPath})，已回退到默认配置。`);
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
                    Hades.D(`[文件管理] 配置文件 ${path.basename(configPath)} 不存在，正在初始化默认配置...`);
                    try {
                        await Ananke.#PersistCfg(configPath, defaultConfig);
                        Hades.D(`[文件管理] 默认配置已写入: ${configPath}`);
                    } catch (writeErr) {
                        Hades.E(`[文件管理] 初始化配置文件失败: ${writeErr.message}`);
                    }
                } else {
                    Hades.D(`[文件管理] 配置文件读取失败，使用内存默认值: ${error.message}`);
                }
                return { ...defaultConfig };
            }
        });
    }

    static async SaveConfig(configPath, data, logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
        return this.#locks.config.run(async () => {
            try {
                await Ananke.#PersistCfg(configPath, data);
                return true;
            } catch (error) {
                Hades.D(`[文件管理] 配置文件写入失败:`, error);
                return false;
            }
        });
    }

    static async UpBanList(listPath, banListPayload, logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
        return this.#locks.banList.run(async () => {
            try {
                const dirPath = path.dirname(listPath);
                await fsPromises.mkdir(dirPath, { recursive: true });
                const jsonStr = JSON.stringify(banListPayload, null, 2);
                await fsPromises.writeFile(listPath, jsonStr, "utf8");
                return true;
            } catch (error) {
                Hades.E(`[文件管理] 封禁列表写入失败:`, error);
                return false;
            }
        });
    }

    static async purge(targetDir, logger = console) {
        if (!targetDir) return;
        const Hades = HadesEntry({}, logger || getCore());
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
            if (err.code !== 'ENOENT') Hades.D(`[文件管理] 清理目录异常 ${targetDir}: ${err.message}`);
        }
    }

    static async dispatchSync(tasks, logger = console) {
        if (!tasks || tasks.length === 0) return { success: 0, fail: 0 };
        const Hades = HadesEntry({}, logger || getCore());
        const worker = new MBTWorker(Hades);
        try {
            const result = await worker.run('SYNC_BATCH', tasks);
            return result;
        } catch (err) {
            Hades.D(`[文件管理] Worker 同步任务失败:`, err);
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
            const Hades = HadesEntry();
            Hades.W(`[文件管理] 读取目录失败 ${targetPath}: ${err.message}`);
            return [];
        }
    }

    static async copyFile(src, dest) {
        try {
            await fsPromises.copyFile(src, dest);
            return true;
        } catch (err) {
            const Hades = HadesEntry();
            Hades.E(`[文件管理] 复制文件失败 ${src} -> ${dest}:`, err);
            return false;
        }
    }

    static ReadSync(targetPath) {
        return fs.readFileSync(targetPath);
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

    static async scanRepoStats(repoPath) {
        const TARGET_DIRS = Nomos.DirNames; 
        const result = { 
            summary: { size: 0, gitSize: 0, filesSize: 0 }, 
            games: {} 
        };

        const gameResults = await this.parallel(TARGET_DIRS, async (dirName) => {
            const gamePath = path.join(repoPath, dirName);
            const stats = await this.scanGameDir(gamePath);
            return { dirName, stats };
        }, 4);

        for (const { dirName, stats } of gameResults) {
            result.games[dirName] = stats;
            result.summary.filesSize += stats.size;
        }
        
        result.summary.size = result.summary.filesSize;
        return result;
    }

    static async scanGameDir(gamePath) {
        const entries = await this.readDir(gamePath);
        const validEntries = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
        
        const charStatsList = await this.parallel(validEntries, async (entry) => {
            return this.scanCharDir(path.join(gamePath, entry.name));
        }, 10);

        const gameStats = { roles: validEntries.length, images: 0, size: 0 };
        for (const stats of charStatsList) {
            gameStats.images += stats.images;
            gameStats.size += stats.size;
        }
        return gameStats;
    }

    static async scanCharDir(dirPath) {
        const files = await this.readDir(dirPath);
        const validFiles = files.filter(file => file.isFile() && /\.(webp|png|jpg|jpeg|bmp)$/i.test(file.name));
        
        const sizes = await this.parallel(validFiles, async (file) => {
            try {
                const s = await fsPromises.stat(path.join(dirPath, file.name));
                return s.size;
            } catch { return 0; }
        }, 20);

        return {
            images: validFiles.length,
            size: sizes.reduce((a, b) => a + b, 0)
        };
    }
}

class Nomos {
    static #REGISTRY = [
        { 
            id: 1, 
            key: "Miao-Plugin-MBT", 
            name: "一号仓库", 
            configKey: "Main_Github_URL", 
            pathKey: "MountRepoPath", 
            gitKey: "GitFilePath",
            required: true 
        },
        { 
            id: 2, 
            key: "Miao-Plugin-MBT-2", 
            name: "二号仓库", 
            configKey: "Ass_Github_URL", 
            pathKey: "MountRepoPath2", 
            gitKey: "GitFilePath2" 
        },
        { 
            id: 3, 
            key: "Miao-Plugin-MBT-3", 
            name: "三号仓库", 
            configKey: "Ass2_Github_URL", 
            pathKey: "MountRepoPath3", 
            gitKey: "GitFilePath3" 
        },
        { 
            id: 4, 
            key: "Miao-Plugin-MBT-4", 
            name: "四号仓库", 
            configKey: "Ass3_Github_URL", 
            pathKey: "MountRepoPath4", 
            gitKey: "GitFilePath4",
            dependencies: ["zzz", "waves"] 
        },
        {
            id: 5,
            key: "Genshin-CR-Repos",
            name: "五号仓库",
            configKey: "Ass4_Github_URL",
            pathKey: "MountRepoPath5",
            gitKey: "GitFilePath5",
            tags: ["SR18"]
        },
        {
            id: 6,
            key: "StarRail-CR-Repos",
            name: "六号仓库",
            configKey: "Ass5_Github_URL",
            pathKey: "MountRepoPath6",
            gitKey: "GitFilePath6",
            tags: ["SR18"]
        }
    ];

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
                const hasDep = repo.dependencies.some(dep => context[`${dep}Installed`]);
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
            zzzInstalled: await check('ZZZ-Plugin'),
            wavesInstalled: await check('waves-plugin'),
        };
    }

    static getHostEnv() {
        return {
            nodeVersion: process.version,
            platform: os.platform(),
            yunzaiVersion: 'Unknown'
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
        const Hades = HadesEntry();
        if (!repoPath || !gameKey) return false;

        const meta = this.Universe?.[gameKey];
        if (!meta?.dirName) return false;

        const gitDir = path.join(repoPath, '.git');
        if (!(await Ananke.Audit(gitDir))) return false;

        const normalized = `${meta.dirName.replace(/\/+$/, '')}/`;

        let shouldEnable = false;
        if (action === 'enable') {
            shouldEnable = true;
        } else if (action === 'disable') {
            shouldEnable = false;
        } else {
            const context = await this.getContext();
            shouldEnable = !!context?.[`${gameKey}Installed`];
        }

        const ok = shouldEnable
            ? await this.PackOps(repoPath, [normalized], null)
            : await this.PackOps(repoPath, null, [normalized]);

        if (!ok) Hades.D(`[资产管理] ModuleOps 失败: ${action || 'check'} ${gameKey} @ ${repoPath}`);
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
        const normPath = relativePath.replace(/\\/g, "/");

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
        return {
            gs: {
                name: "原神",
                key: "gs",
                dirName: "gs-character",
                pluginPath: path.join(YzPath, "plugins", "miao-plugin"),
                sortOrders: ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'],
                elemMap: { pyro: '火', hydro: '水', cryo: '冰', electro: '雷', anemo: '风', geo: '岩', dendro: '草' }
            },
            sr: {
                name: "星铁",
                key: "sr",
                dirName: "sr-character",
                pluginPath: path.join(YzPath, "plugins", "miao-plugin"),
                sortOrders: ['fire', 'ice', 'wind', 'elec', 'phy', 'quantum', 'imaginary'],
                elemMap: { fire: '火', ice: '冰', wind: '风', elec: '雷', phy: '物理', quantum: '量子', imaginary: '虚数' }
            },
            zzz: {
                name: "绝区零",
                key: "zzz",
                dirName: "zzz-character",
                pluginPath: path.join(YzPath, "plugins", "ZZZ-Plugin"),
                sortOrders: [],
                elemMap: {}
            },
            waves: {
                name: "鸣潮",
                key: "waves",
                dirName: "waves-character",
                pluginPath: path.join(YzPath, "plugins", "waves-plugin"),
                sortOrders: ['rerong', 'lengning', 'daodian', 'qidong', 'yanshe', 'yanmie'],
                elemMap: { '冷凝': 'lengning', '热熔': 'rerong', '导电': 'daodian', '气动': 'qidong', '衍射': 'yanshe', '湮灭': 'yanmie' }
            }
        };
    }

    static MatchGame(inputName) {
        const universe = this.Universe;
        for (const key in universe) {
            const meta = universe[key];
            if (meta.name === inputName || meta.key === inputName) {
                return meta;
            }
        }
        return null;
    }

    static get DirNames() {
        return Object.values(this.Universe).map(u => u.dirName);
    }
}

class Tianshu {
    static async NormalizeName(inputName, options = {}) {
        const cleanInput = inputName?.trim();
        if (!cleanInput) return { mainName: null, exists: false };

        if (!MiaoPluginMBT._AliasData) await MiaoPluginMBT.MetaHub.AC(false);
        if (this._aliasReverseIndex.size === 0) this.BuildAliasIndex(MiaoPluginMBT._AliasData);

        const lowerInput = cleanInput.toLowerCase();

        if (this._aliasReverseIndex.has(lowerInput)) {
            return { mainName: this._aliasReverseIndex.get(lowerInput), exists: true };
        }

        const { gameKey = null } = options;
        const searchScope = gameKey
            ? (MiaoPluginMBT._AliasData?.[`${gameKey}Alias`] || {})
            : (MiaoPluginMBT._AliasData?.combined || {});

        const ComplexScore = (source, target) => {
            const sLen = source.length;
            const tLen = target.length;
            if (sLen === 0 || tLen === 0) return 0;
            if (source === target) return 100;

            const lenRatio = Math.min(sLen, tLen) / Math.max(sLen, tLen);
            if (lenRatio < 0.3) return 0;

            const dp = Array(sLen + 1).fill(null).map(() => Array(tLen + 1).fill(0));
            const W_BASE = 1.0, W_SUBSTITUTION = 1.5, W_HEAD_BIAS = 2.0;
            const HEAD_THRESHOLD = Math.ceil(Math.min(sLen, tLen) * 0.33);

            for (let i = 0; i <= sLen; i++) dp[i][0] = i * W_BASE;
            for (let j = 0; j <= tLen; j++) dp[0][j] = j * W_BASE;
            for (let i = 1; i <= sLen; i++) {
                for (let j = 1; j <= tLen; j++) {
                    const isHead = (i <= HEAD_THRESHOLD) || (j <= HEAD_THRESHOLD);
                    const multiplier = isHead ? W_HEAD_BIAS : 1.0;
                    if (source[i - 1] === target[j - 1]) {
                        dp[i][j] = dp[i - 1][j - 1];
                    } else {
                        dp[i][j] = Math.min(
                            dp[i - 1][j] + (W_BASE * multiplier),
                            dp[i][j - 1] + (W_BASE * multiplier),
                            dp[i - 1][j - 1] + (W_SUBSTITUTION * multiplier)
                        );
                    }
                }
            }

            const maxCost = Math.max(sLen, tLen) * 1.2;
            let score = Math.max(0, (1 - dp[sLen][tLen] / maxCost) * 100)           
            let strongMatch = false;           
            if (target.includes(source)) { score += 20; strongMatch = true; }
            if (source.includes(target)) { score += 20; strongMatch = true; }
            if (target.startsWith(source) || source.startsWith(target)) { score += 15; strongMatch = true; }
            if (target.endsWith(source) || source.endsWith(target)) { score += 15; strongMatch = true; }
            if (!target.includes(source) && !source.includes(target)) {
                let sIdx = 0, tIdx = 0;
                while (sIdx < sLen && tIdx < tLen) {
                    if (source[sIdx] === target[tIdx]) sIdx++;
                    tIdx++;
                }
                if (sIdx === sLen) { score += 35; strongMatch = true; }
            }

            let commonPrefix = 0;
            while (commonPrefix < sLen && commonPrefix < tLen && source[commonPrefix] === target[commonPrefix]) commonPrefix++;
            if (commonPrefix / Math.min(sLen, tLen) >= 0.66) score += 10;
            if (!strongMatch) score -= Math.abs(sLen - tLen) * 3;
            return Math.min(100, score);
        };

        let bestMatch = { mainName: null, score: -Infinity };
        const DYNAMIC_THRESHOLD = Math.min(90, 60 + (50 / Math.max(1, lowerInput.length)));

        for (const [mainName, aliases] of Object.entries(searchScope)) {
            const candidates = [
                mainName.toLowerCase(),
                ...(Array.isArray(aliases) ? aliases : String(aliases).split(","))
                    .map(a => String(a).trim().toLowerCase())
                    .filter(Boolean)
            ];

            for (const term of candidates) {
                if (term === lowerInput) return { mainName, exists: true };
                const score = ComplexScore(lowerInput, term);
                if (score > bestMatch.score) bestMatch = { mainName, score };
            }
        }

        if (bestMatch.score >= DYNAMIC_THRESHOLD) return { mainName: bestMatch.mainName, exists: true };
        return { mainName: cleanInput, exists: false };
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
        const baseDir = gameKey === 'gs'
          ? MiaoPluginMBT.Paths.Target.Miao_GSAliasDir
          : MiaoPluginMBT.Paths.Target.Miao_SRAliasDir;
        const imgDir = path.join(baseDir, "..", "character", CREName, "imgs");
        const probe = (p) => Ananke.Audit(p, false).then(exists => exists ? p : null);
        const validPath = await probe(path.join(imgDir, "face2.webp")) 
                       || await probe(path.join(imgDir, "face.webp"));
        return validPath ? `file://${validPath.replace(/\\/g, "/")}` : null;
    }

    static async ScanSplashes(sourceDir) {
        if (!sourceDir) return [];
        
        try {
            const charDirs = await Ananke.readDir(sourceDir);
            const validCharDirs = charDirs.filter(d => d.isDirectory());
            
            const results = await this.parallel(validCharDirs, async (charDir) => {
                const CREName = charDir.name;
                const imgsPath = path.join(sourceDir, CREName, 'imgs');
                const splashesFound = [];
                try {
                    const imgEntries = await Ananke.readDir(imgsPath);
                    for (const imgEntry of imgEntries) {
                        if (imgEntry.name.toLowerCase().startsWith('splash') && imgEntry.name.toLowerCase().endsWith('.webp')) {
                            splashesFound.push({
                                src: path.join(imgsPath, imgEntry.name),
                                CREName: CREName,
                                fileName: imgEntry.name
                            });
                        }
                    }
                } catch {}
                return splashesFound;
            }, 10);

            return results.flat();
        } catch { return []; }
    }

    static async FindZZZIcon(charName) {
        const context = await Nomos.getContext();
        if (!context.zzzInstalled) return null;
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
                    return `file://${iconPath.replace(/\\/g, "/")}`;
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

    static BuildIndexes(imageData) {
        this._indexByGid.clear();
        this._indexByCRE.clear();
        this._indexByTag.clear();

        for (const item of imageData) {
          if (!item || !item.path) continue;
          const gid = item.path.replace(/\\/g, "/");

          this._indexByGid.set(gid, item);

          if (item.CREName) {
            if (!this._indexByCRE.has(item.CREName)) {
              this._indexByCRE.set(item.CREName, []);
            }
            this._indexByCRE.get(item.CREName).push(item);
          }

          if (item.attributes) {
            for (const tag of Object.values(Valid_Tags)) {
              const attrVal = item.attributes[tag.key];
              const isMatch = Array.isArray(attrVal) ? attrVal.includes(tag.value) : attrVal === tag.value;
              if (isMatch) {
                const tagName = tag.key === 'other' ? tag.value : tag.key;
                if (!this._indexByTag.has(tagName)) {
                  this._indexByTag.set(tagName, []);
                }
                this._indexByTag.get(tagName).push(item);
              }
            }
          }
        }
    }

    static BuildAliasIndex(aliasData) {
        if (this._aliasReverseIndex.size > 0) return;
        const reverseMap = new Map();
        const combined = aliasData?.combined || {};
        for (const [mainName, aliases] of Object.entries(combined)) {
          const mainLower = mainName.toLowerCase();
          reverseMap.set(mainLower, mainName);
          const aliasArray = (Array.isArray(aliases) ? aliases : String(aliases).split(","));
          for (const alias of aliasArray) {
            const aliasLower = String(alias).trim().toLowerCase();
            if (aliasLower) {
              reverseMap.set(aliasLower, mainName);
            }
          }
        }
        this._aliasReverseIndex = reverseMap;
    }

    static ParseID(identifier) {
        if (!identifier) return null;
        const match = identifier.trim().match(/^(.*?)(?:Gu)?(\d+)$/i);
        if (match && match[1] && match[2]) { const mainName = match[1].trim(); if (mainName) return { mainName: mainName, imgNum: match[2] }; }
        return null;
    }

    static async FsQuery(relativePath) {
        if (!relativePath) return null;
        const normalizedPath = relativePath.replace(/\\/g, "/");

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
         const Hades = HadesEntry({}, logger || getCore());
         const context = await Nomos.getContext();
         const config = await Ananke.loadingConfig(MiaoPluginMBT.Paths.ConfigFilePath, MiaoPluginMBT.MBTConfig);
         const repos = Nomos.ModuleRepoAC(MiaoPluginMBT.Paths, config, context);
         const timestamp = new Date().toISOString();
         
         const results = await Promise.all(repos.map(async (repo) => {
             if (!repo.path) return [repo.num, {}];
             
             const gitStatus = await Nomos.getRepoStatus(repo.path);
             
             let fsCounts = { roles: 0, images: 0 };
             try {
                 const repoStats = await Ananke.scanRepoStats(repo.path);
                 for (const gameStats of Object.values(repoStats.games)) {
                     fsCounts.roles += gameStats.roles;
                     fsCounts.images += gameStats.images;
                 }
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
             .catch(err => Hades.E(`[索引] 写入仓库统计缓存失败:`, err));
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

                    const aliasDirMap = {
                        gs: MiaoPluginMBT.Paths.Target.Miao_GSAliasDir,
                        sr: MiaoPluginMBT.Paths.Target.Miao_SRAliasDir,
                    };

                    const dataPath = path.join(aliasDirMap[gameKey], charName, 'data.json');
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
                            return `file://${zzzFacePath.replace(/\\/g, "/")}`;
                        }
                        break;
                    }
                }
            }
        } catch { }
        return null;
    }

    static async RenderDashboard(e, stats) {
        const Hades = HadesEntry({}, e?.logger || getCore());
        const ViewProps = {
            GameData: stats,
            Tags: Object.keys(Valid_Tags).sort(),
            SecTags: MiaoPluginMBT._SecTagsCache,
        };

        const imgBuffer = await Morpheus.shot("Search", {
            tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "search_helper.html"),
            data: ViewProps,
            logger: Hades
        });

        if (imgBuffer) await e.reply(segment.image(imgBuffer));
        else await e.reply("生成查看助手图片失败，请查看后台日志。", true);
        return true;
    }

    static async _PaginateFM(e, data) {
        const Hades = HadesEntry({}, e?.logger || getCore());
        const cerberus = Cerberus.getInstance();

        if (data.type === 'tag') {
            const filteredImg = Array.isArray(data.items) ? data.items : [];
            if (filteredImg.length === 0) return e.reply(`没有找到任何带${data.title}的图片哦。`, true);

            const Items_Per_Batch = 28;
            const itemCount = filteredImg.length;
            const pageCount = Math.ceil(itemCount / Items_Per_Batch);
            let waitMsg = `收到！正在查找 ${data.title} 的图片，共 ${itemCount} 张...`;
            if (pageCount > 1) waitMsg = `${data.title} (共 ${itemCount} 张)，将分 ${pageCount} 批发送，请稍候...`;
            await e.reply(waitMsg, true);

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
                    const relativePath = item.path.replace(/\\/g, "/");
                    const fileName = path.basename(relativePath);
                    const absolutePath = await MiaoPluginMBT.FsQuery(relativePath);
                    const MsgNode = [];
                    if (absolutePath) {
                        if (await Ananke.Audit(absolutePath, false)) MsgNode.push(segment.image(`file://${absolutePath}`));
                        else MsgNode.push(`[图片无法加载: ${fileName}]`);
                    } else {
                        MsgNode.push(`[图片文件丢失: ${fileName}]`);
                    }
                    MsgNode.push(`${item.CREName} - ${fileName}`);
                    forwardList.push(MsgNode);
                }

                if (forwardList.length > 1) {
                    const forwardMsg = await common.makeForwardMsg(e, forwardList, makeForwardMsgTitle);
                    await e.reply(forwardMsg);
                    await common.sleep(1000);
                }
            }
            return true;
        }

        if (data.type === 'character') {
            const primaryName = data.primaryName;
            const RawRoleMeta = Array.isArray(data.items) ? data.items : [];
            if (RawRoleMeta.length === 0) return e.reply(`图库数据中没有找到『${primaryName}』的图片信息。`, true);

            const itemCount = RawRoleMeta.length;
            const Items_Per_Batch = 28;
            const pageCount = Math.ceil(itemCount / Items_Per_Batch);
            let waitMsg = `正在为『${primaryName}』整理 ${itemCount} 张图片...`;
            if (pageCount > 1) waitMsg = `正在为『${primaryName}』整理 ${itemCount} 张图片，将分 ${pageCount} 批发送，请稍候...`;
            await e.reply(waitMsg, true);

            for (let batchNum = 1; batchNum <= pageCount; batchNum++) {
                await cerberus.breath(batchNum);
                const startIndex = (batchNum - 1) * Items_Per_Batch;
                const activeBatch = RawRoleMeta.slice(startIndex, startIndex + Items_Per_Batch);

                const titleFaceUrl = data.gameKey === 'zzz'
                    ? await this._resolveZZZTitleFaceUrl(primaryName)
                    : null;

                const makeForwardMsgTitle = titleFaceUrl
                    ? [segment.image(titleFaceUrl), ` [${primaryName}] 图库详情 (${batchNum}/${pageCount})`]
                    : `[${primaryName}] 图库详情 (${batchNum}/${pageCount})`;

                const forwardList = [];
                const firstNodeText = batchNum === 1
                    ? `查看『${primaryName}』 (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)\n想导出图片？试试: #咕咕牛导出${primaryName}1`
                    : `查看『${primaryName}』(续) (${startIndex + 1}-${Math.min(startIndex + activeBatch.length, itemCount)} / ${itemCount} 张)`;
                forwardList.push(firstNodeText);

                for (let i = 0; i < activeBatch.length; i++) {
                    const item = activeBatch[i];
                    const itemGlobalIndex = startIndex + i + 1;
                    const relativePath = item.path.replace(/\\/g, "/");
                    const fileName = path.basename(relativePath);
                    const absolutePath = await MiaoPluginMBT.FsQuery(relativePath);
                    const MsgNode = [];
                    if (absolutePath) {
                        if (await Ananke.Audit(absolutePath, false)) MsgNode.push(segment.image(`file://${absolutePath}`));
                        else MsgNode.push(`[图片无法加载: ${fileName}]`);
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
                    const forwardMsg = await common.makeForwardMsg(e, forwardList, makeForwardMsgTitle);
                    await e.reply(forwardMsg);
                    await common.sleep(1000);
                }
            }

            return true;
        }

        return true;
    }
}

class DocHub {
    static async report(e, opName, err, ctx = "", logger = getCore()) {
        const core = (logger && typeof logger.error === 'function') ? logger : getCore();
        const Hades = HadesEntry({}, core);

        const errCode = err?.code || 'UNKNOWN';
        if (!ErrDoc.shouldReport(opName, errCode)) {
            Hades.D(`[DocHub] 拦截重复报告: [${opName}] ${err?.message}`);
            return;
        }

        Hades.E(`[${opName}] 操作失败:`, err?.message, err?.stack ? `\nStack trace available in report.` : "");

        const diagnosis = this._diagnose(opName, err, ctx);
        let aiSolution = "云露正在摸鱼（AI分析未响应）";
        try {
            aiSolution = await this._consultOracle(opName, err, diagnosis.contextInfo, Hades);
        } catch (aiErr) {
            Hades.D(`[DocHub] AI服务不可用: ${aiErr.message}`);
            aiSolution = "云露分析服务暂时不可用。";
        }

        const isStressed = ErrDoc.isSystemStressed();
        let imgBuffer = null;

        if (!isStressed) {
            try {
                const snap = {
                    git: await Nomos.getRepoStatus(MiaoPluginMBT.Paths.MountRepoPath),
                    system: Nomos.getHostEnv(),
                    file: { size: 'N/A', mtime: 'N/A' }
                };
                const tplResult = await Hermes.getTemplate('error_report.html', Hades);

                if (tplResult.success) {
                    const ViewProps = {
                        operationName: opName,
                        errMsg: err.message || "Unknown Error",
                        errCode: errCode,
                        contextInfo: diagnosis.contextInfo,
                        suggestions: diagnosis.suggestions.split('\n'),
                        aiSolutionText: aiSolution,
                        stackTrace: diagnosis.stack ? diagnosis.stack.substring(0, 1200) : null,
                        snapshot: snap,
                        error: err, 
                        timestamp: new Date().toLocaleString()
                    };

                    imgBuffer = await Morpheus.shot("error-report", {
                        htmlContent: tplResult.data,
                        data: ViewProps,
                        logger: Hades
                    });
                }
            } catch (renderErr) {
                Hades.E(`[DocHub] 报告渲染失败:`, renderErr);
                imgBuffer = null;
            }
        } else {
            Hades.D(`[DocHub] 系统高负载`);
        }

        try {
            if (imgBuffer) {
                await e.reply(segment.image(imgBuffer));
            } else {
                let msg = `[${opName}] 失败!\n`;
                msg += `错误: ${err?.message}\n`;
                msg += `建议: \n${diagnosis.suggestions}\n`;
                msg += `\n云露分析: ${aiSolution.replace(/<br>/g, '\n').substring(0, 1000)}`;
                await e.reply(msg);
            }
        } catch (sendErr) {
            Hades.E(`[DocHub] 报告发送失败:`, sendErr);
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

        const SUGG_MAP = {
            NETWORK: [
                "- **网络故障**：请执行 `#咕咕牛测速` 诊断节点连通性。",
                "- 检查服务器 DNS 设置或防火墙规则。",
                "- 若使用代理，请确认代理服务是否存活。"
            ],
            GIT: [
                "- **仓库冲突**：尝试 `#更新咕咕牛`，新版会自动尝试强制同步。",
                "- 若仓库严重损坏，请执行 `#重置咕咕牛`。"
            ],
            FILESYSTEM: [
                "- **权限/占用**：检查 Yunzai 目录读写权限。",
                "- 尝试重启机器人以释放文件锁 (EBUSY)。"
            ],
            CONFIG: [
                "- **配置损坏**：检查 `CowCoo` 目录下的 YAML/JSON 配置文件。",
                "- 可删除损坏的配置文件后重启插件。"
            ],
            CODE: [
                "- **程序异常**：此错误可能源于插件逻辑缺陷，请截图反馈。",
                "- 尝试重启 Yunzai-Bot 看是否恢复。"
            ]
        };

        let suggs = SUGG_MAP[type] || [];
        suggs.push("- 请查看控制台详细日志。", "- 若问题持续无法解决，建议 `#重置咕咕牛`。");

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

    static async _consultOracle(operationName, error, context, logger) {
        const Hades = HadesEntry({}, logger || getCore());
        let magicWord = '';
        try {
            magicWord = MiaoPluginMBT._IQ();
        } catch (e) {
            return "云露分析失败：内部密钥获取异常。";
        }

        if (!magicWord) return "云露分析失败：API服务配置缺失。";

        let promptTpl = await Hermes.getOraclePrompt(Hades);
        if (!promptTpl) return "云露分析中断：无法同步云端诊断方案。";

        const prompt = promptTpl
            .replace('${operationName}', operationName)
            .replace("${error.message || 'N/A'}", error.message || 'N/A')
            .replace("${error.code || 'N/A'}", error.code || 'N/A')
            .replace("${context || '无'}", context || '无');

        const requestBody = {
            model: "x1",
            messages: [{ role: "user", content: prompt }],
            stream: false,
            max_tokens: 150,
            temperature: 0.4,
            top_p: 0.5,
            stop: ["你好，我是云露。", "云露：", "好的，", "好的。", "您好，我是云露。", "解决方案："],
            tools: [{ type: "web_search", web_search: { enable: false, search_mode: "normal" } }]
        };

        const url = "https://spark-api-open.xf-yun.com/v2/chat/completions";
        const maxRetries = 2;
        let retryCount = 0;

        while (retryCount <= maxRetries) {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 30000); 

                const response = await fetch(url, {
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
                        Hades.D(`[DocHub] API重试 (${response.status})... ${retryCount + 1}/${maxRetries}`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, 500 + retryCount * 500));
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
                    return aiContent
                        .replace(/<pre[^>]*>/gi, '')
                        .replace(/<\/pre>/gi, '')
                        .replace(/<code[^>]*>/gi, '')
                        .replace(/<\/code>/gi, '')
                        .replace(/`/g, '')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br>');
                } else {
                    return "云露分析异常：API成功响应，但未返回有效内容。";
                }

            } catch (aiError) {
                if (aiError.name === 'AbortError' || aiError.message.includes('network') || aiError.message.includes('fetch')) {
                    Hades.D(`[DocHub] 网络异常重试... ${retryCount + 1}/${maxRetries}`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 500 + retryCount * 500));
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
        const Hades = HadesEntry({}, logger || getCore());
        try {
            const [banList, tagData] = await Promise.all([
                Ananke.HydrateJson(MiaoPluginMBT.Paths.BanListPath, []),
                Ananke.HydrateJson(MiaoPluginMBT.Paths.SecTagsPath, {})
            ]);

            this.#BanMap.clear();
            this.#MD5BanSet.clear();

            if (Array.isArray(banList)) {
                for (const item of banList) {
                    if (item?.path) {
                        const p = this.#normalize(item.path);
                        const md5 = item.md5 || null;
                        this.#BanMap.set(p, { md5, timestamp: item.timestamp });
                        if (md5) this.#MD5BanSet.add(md5);
                    }
                }
            }

            this.#secTags = [];
            for (const key in tagData) {
                if (Array.isArray(tagData[key])) {
                    this.#secTags.push(...tagData[key]);
                }
            }

            Hades.D(`封禁: ${this.#BanMap.size} (MD5: ${this.#MD5BanSet.size}) | 标签: ${this.#secTags.length}`);
            
            this.#bus.emit('ready', { 
                banCount: this.#BanMap.size, 
                tagCount: this.#secTags.length 
            });

        } catch (err) {
            Hades.E(`[MBTCF] 初始化崩溃: ${err.message}`);
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
        const Hades = HadesEntry({}, logger || getCore());
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
            Hades.E(`[MBTCF] 持久化失败，已回滚: ${err.message}`);
            throw new Error("保存封禁配置失败，操作已撤销");
        }
    }

    static async RemoveManualBan(relativePath, logger = console) {
        const Hades = HadesEntry({}, logger || getCore());
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
            Hades.E(`[MBTCF] 持久化失败，已回滚: ${err.message}`);
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
        return p ? p.replace(/\\/g, "/") : "";
    }

    static #checkPFL(item, level) {
        if (!item?.attributes || level <= 0) return false;
        const r = item.attributes.rated;
        return (level === 1 && r === 'r18') || (level === 2 && (r === 'r18' || r === 'p18'));
    }

    static async #persist(logger) {
        const payload = Array.from(this.#BanMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([path, data]) => ({
                path: path,
                md5: data.md5,
                timestamp: data.timestamp
            }));
        
        const ok = await Ananke.UpBanList(MiaoPluginMBT.Paths.BanListPath, payload, logger);
        if (!ok) throw new Error("IO写入失败");
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
  static MBTProcc = new MBTProcPool(HadesEntry());
  static BootStrap = false;
  static MBTConfig = {};
  static _MetaCache = Object.freeze([]);
  static _AliasData = null;
  static _wavesRoleDataMap = null;
  static HousekeepingDone = false;
  static BootLock = false;
  static MetaMutex = new Metis('Meta', console);
  static GitMutex = new Metis('GitOps', console);
  static InstallMutex = new Metis('NPMInstall', console);
  static RenderMutex = new Metis('Puppeteer', console);
  static _indexByGid = new Map();
  static _indexByCRE = new Map();
  static _indexByTag = new Map();
  static get _SecTagsCache() { return MBTCF.secTagsCache; }
  static get _userBanSet() { return MBTCF.userBanSet; }
  static get _activeBanSet() { return MBTCF.activeBanSet; }

  static async GenerateList(data, logger = console) {
      const config = MiaoPluginMBT.MBTConfig || DFC;
      MBTCF.Compute(data, config, logger);
      await MBTCF.ApplyBans();
  }

  static RANROM_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/CA-MBT.json";
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

  static async _CtxPrep(logger = console) {
    const Prep_KEY = 'CowCoo:Runtime:Ctx';
    const Hades = HadesEntry({}, logger || getCore());
    
    try {
      let raw = (typeof redis !== 'undefined') ? await redis.get(Prep_KEY) : null;
      
      if (!raw) {
        const res = await Hermes.request(MiaoPluginMBT.RANROM_URL, { timeout: 8000 });
        if (res.success && res.status === 200 && res.body) {
          raw = res.body;
          if (typeof redis !== 'undefined') redis.set(Prep_KEY, raw, { EX: 86400 }).catch(()=>{});
        } else {
          Hades.D(`鱼池拉取失败: HTTP ${res.status}`);
        }
      }

      if (raw) {
        let nodes = [];
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            nodes = parsed;
          } else if (parsed && Array.isArray(parsed.F2Pool)) {
            nodes = parsed.F2Pool;
          }
        } catch (jsonErr) {
          Hades.W(`云端节点数据解析失败，请检查 JSON 格式。`);
          return false;
        }

        if (nodes.length > 0) {
          MiaoPluginMBT.#TopoMap.clear();
          
          const uiList = [];
          nodes.forEach(node => {
            if (node.ClonePrefix) {
              const prefix = node.ClonePrefix.trim().toLowerCase().replace(/\/$/, "");
              MiaoPluginMBT.#TopoMap.set(prefix, node.priority);
            }
            uiList.push(node);
          });
          
          DFC.F2Pool = uiList;
          if (MiaoPluginMBT.MBTConfig) {
              MiaoPluginMBT.MBTConfig.F2Pool = uiList;
          }
          return true;
        }
      }
    } catch (e) { 
      Hades.E(`_CtxPrep 异常: ${e.message}`);
    }
    return false;
  }

  static _CheckCtx(targetUrl) {
    if (!targetUrl) return false;
    const lowerUrl = targetUrl.toLowerCase();
    
    if ((lowerUrl.includes("github.com") || lowerUrl.includes("githubusercontent.com")) 
        && !lowerUrl.includes("proxy") 
        && !lowerUrl.includes("mirror")) {
      return true;
    }

    const normalizeUrl = (input) => input.toLowerCase().replace(/\/$/, "").replace(/^http:/, "https:");
    const normalizedTarget = normalizeUrl(lowerUrl);
    let targetHost = null;
    try { targetHost = new URL(normalizedTarget).host; } catch {}

    const matchPrefix = (prefix) => {
      const normalizedPrefix = normalizeUrl(prefix);
      if (normalizedTarget.startsWith(normalizedPrefix)) return true;
      if (targetHost) {
        try {
          const prefixHost = new URL(normalizedPrefix).host;
          if (prefixHost && prefixHost === targetHost) return true;
        } catch {}
      }
      return false;
    };

    for (const validPrefix of this.#TopoMap.keys()) {
      if (matchPrefix(validPrefix)) return true;
    }

    if (Array.isArray(DFC?.F2Pool)) {
      for (const node of DFC.F2Pool) {
        if (node?.ClonePrefix && matchPrefix(node.ClonePrefix)) return true;
      }
    }

    return false;
  }

  static async GetRepoState(id, context = {}, options = {}) {
    const meta = Nomos.MetaNum(id);
    if (!meta) return null;
    const config = MiaoPluginMBT.MBTConfig || {};
    const url = config?.[meta.configKey] || DFC[meta.configKey];
    const isConfigured = !!url;
    const depsMet = !meta.dependencies || meta.dependencies.some(dep => context[`${dep}Installed`]);
    const isEnabled = meta.required || (isConfigured && depsMet);
    const gitPath = MiaoPluginMBT.Paths[meta.gitKey];
    let exists = false;
    if ((isEnabled || options.checkExistsWhenDisabled) && gitPath) {
      exists = await Ananke.Audit(gitPath);
    }
    return { id, meta, url, isConfigured, depsMet, isEnabled, exists, gitPath };
  }

  static _pathsCache = null;

  static get CowCooRepoRoot() {
      const base = typeof YzPath !== 'undefined' ? YzPath : process.cwd();
      return path.join(base, "resources", "CowCoos");
  }

  static get Paths() {
    if (this._pathsCache) return this._pathsCache;

    const root = this.CowCooRepoRoot;
    
    this._pathsCache = {
      YzPath: typeof YzPath !== 'undefined' ? YzPath : process.cwd(),
      CowCooRepoRoot: root,
      MountRepoPath: path.join(root, "Miao-Plugin-MBT"),    GitFilePath: path.join(root, "Miao-Plugin-MBT", ".git"),
      MountRepoPath2: path.join(root, "Miao-Plugin-MBT-2"), GitFilePath2: path.join(root, "Miao-Plugin-MBT-2", ".git"),
      MountRepoPath3: path.join(root, "Miao-Plugin-MBT-3"), GitFilePath3: path.join(root, "Miao-Plugin-MBT-3", ".git"),
      MountRepoPath4: path.join(root, "Miao-Plugin-MBT-4"), GitFilePath4: path.join(root, "Miao-Plugin-MBT-4", ".git"),
      MountRepoPath5: path.join(root, "Genshin-CR-Repos"), GitFilePath5: path.join(root, "Genshin-CR-Repos", ".git"),
      MountRepoPath6: path.join(root, "StarRail-CR-Repos"), GitFilePath6: path.join(root, "StarRail-CR-Repos", ".git"),
      OpsPath: path.join(root, "Miao-Plugin-MBT", "CowCoo"),
      oldOpsPath: path.join(YzPath, "resources", "Miao-Plugin-MBT", "GuGuNiu-Gallery"),
      SecTagsPath: path.join(root, "Miao-Plugin-MBT", "CowCoo", "SecTags.json"),
      BgImgPath: path.join(root, "Miao-Plugin-MBT", "CowCoo", "html", "img"),
      ComResPath: path.join(root, "CowCoo"),
      ConfigFilePath: path.join(root, "CowCoo", "CowSet.yaml"),
      BanListPath: path.join(root, "CowCoo", "banlist.json"),
      ProvisionPath: path.join(root, ".install_lock"),
      WavesRoleData: path.join(root, "CowCoo", "waves", "RoleData.json"),
      MiaoPluginPath: path.join(YzPath, "plugins", "miao-plugin"),
      ZZZPluginPath: path.join(YzPath, "plugins", "ZZZ-Plugin"),
      WavesPluginPath: path.join(YzPath, "plugins", "waves-plugin"),
      RTCPath: path.join(root, "CowCoo", "RepoCache.json"),
      TempHtmlPath: path.join(YzPath, "temp", "html"), TempNiuPath: path.join(YzPath, "temp", "CowCoo"), TempDownloadPath: path.join(YzPath, "temp", "CowCoo", "Tasks"),
      Target: {
        MiaoCRE: path.join(YzPath, "plugins", "miao-plugin", "resources", "profile", "normal-character"),
        ZZZCRE: path.join(YzPath, "plugins", "ZZZ-Plugin", "resources", "images", "panel"),
        WavesCRE: path.join(YzPath, "plugins", "waves-plugin", "resources", "rolePic"),
        Example: path.join(YzPath, "plugins", "example"),
        Miao_GSAliasDir: path.join(YzPath, "plugins", "miao-plugin", "resources", "meta-gs", "character"),
        Miao_SRAliasDir: path.join(YzPath, "plugins", "miao-plugin", "resources", "meta-sr", "character"),
        ZZZ_AliasDir: path.join(YzPath, "plugins", "ZZZ-Plugin", "defset"),
        ZZZ_DataDir: path.join(YzPath, "plugins", "ZZZ-Plugin", "resources", "data", "hakush", "data", "character"),
        ZZZ_FaceDir: path.join(YzPath, "plugins", "ZZZ-Plugin", "resources", "images", "role_circle"),
        Waves_AliasDir: path.join(YzPath, "plugins", "waves-plugin", "resources", "Alias"),
      },
      SourceDir: (() => {
        const sd = { gallery: "CowCoo" };
        const universe = Nomos.Universe;
        for (const k in universe) {
          if (universe[k]?.dirName) sd[k] = universe[k].dirName;
        }
        return sd;
      })(),
      LinkFiles: [{ sourceSubPath: "咕咕牛图库管理器.js", destDir: path.join(YzPath, "plugins", "example"), destFileName: "咕咕牛图库管理器.js" }],
    };
    return this._pathsCache;
  }

  static MetaHub = {
    async AC() {
      const Hades = HadesEntry();

      if (!MiaoPluginMBT._AliasData) MiaoPluginMBT._AliasData = { combined: {} };

      try {
        let GSAlias = {};
        let SRAlias = {};

        try {
          const GSAliasPath = path.join(MiaoPluginMBT.Paths.Target.Miao_GSAliasDir, 'alias.js');
          const GSModule = await import(`file://${GSAliasPath}?t=${Date.now()}`);
          GSAlias = GSModule.alias || {};
        } catch (e) {  }

        try {
          const SRAliasPath = path.join(MiaoPluginMBT.Paths.Target.Miao_SRAliasDir, 'alias.js');
          const SRModule = await import(`file://${SRAliasPath}?t=${Date.now()}`);
          SRAlias = SRModule.alias || {};
        } catch (e) {  }

        MiaoPluginMBT._AliasData.GSAlias = GSAlias;
        MiaoPluginMBT._AliasData.SRAlias = SRAlias;
        Object.assign(MiaoPluginMBT._AliasData.combined, GSAlias, SRAlias);

      } catch (error) {
        Hades.W(`MetaHub: 米家别名加载部分异常`);
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
        if (e.code !== 'ENOENT') Hades.W(`MetaHub: 鸣潮 RoleData.json 加载失败: ${e.message}`);
      }
      MiaoPluginMBT._wavesRoleDataMap = wavesRoleMap;
      Tianshu._aliasReverseIndex = new Map();
      Tianshu.BuildAliasIndex(MiaoPluginMBT._AliasData);
    }
  };

  static _IQ() {
    const store = {
      NewtonEatsAppleComeBack: "eHhnWEtxcHFVdm9ZWUF0RFNtU1Y6d0tYS1VSSUd5eHBDaXdGbGxiYXo="
    };
    const MagicWord = Buffer.from(store.NewtonEatsAppleComeBack, 'base64').toString('utf8');
    return MagicWord;
  }

  config = DFC;
  logPrefix = DFC.logPrefix;
  logger = Hades;
  PFSCReady = false;
  task = null;

  constructor() { 
    super({
      name: `『咕咕牛🐂』图库管理器`,
      dsc: "『咕咕牛🐂』",
      event: "message", priority: 40, rule: CowCoo_Rules,
    });
    this.logger = HadesEntry();

    this.task = [
      {
        name: `${DFC.logPrefix}定时更新`,
        cron: DFC.CronUpdate,
        fnc: QuantumFlux(() => this.RunUpdateTask()),
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

  }

  static async _RecoverState(logger) {
      const Hades = HadesEntry({}, logger || getCore());
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

  static _bindLifecycleHandlers(bus, logger) {
      const shutdownHandler = async () => await MiaoPluginMBT._teardown(false, logger);
      const reloadHandler = async () => await MiaoPluginMBT._teardown(true, logger);
      if (bus.listenerCount('shutdown') === 0 && bus.listenerCount('reload') === 0) {
          bus.on('shutdown', shutdownHandler);
          bus.on('reload', reloadHandler);
      }
  }

  static async init(logger = getCore()) {
      if (MiaoPluginMBT.InitPromise) return MiaoPluginMBT.InitPromise;
      if (MiaoPluginMBT.#pendingInit) return MiaoPluginMBT.#pendingInit;

      MiaoPluginMBT.#pendingInit = (async () => {
          const Hades = HadesEntry({}, logger || getCore());
          MiaoPluginMBT._isInitializing = true;

          const initTask = async () => {
              const bus = await MBTSignalTrap.HMR_Entry(Hades);
              MiaoPluginMBT._bindLifecycleHandlers(bus, Hades);

              MiaoPluginMBT.BootLock = true;
              MiaoPluginMBT.BootStrap = false;

              try {
                  await MiaoPluginMBT._RecoverState(Hades);
                  const defaultConfig = { ...DFC };
                  MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
                      MiaoPluginMBT.Paths.ConfigFilePath, 
                      defaultConfig, 
                      Hades
                  );

                  if (![PFL.NONE, PFL.RX18_ONLY, PFL.PX18_PLUS].includes(MiaoPluginMBT.MBTConfig.PFL_Ops)) {
                      Hades.W(`配置 PFL=${MiaoPluginMBT.MBTConfig.PFL_Ops} 无效，已降级为 ${DFC.PFL_Ops} (${PFL.getDescription(DFC.PFL_Ops)})`);
                      MiaoPluginMBT.MBTConfig.PFL_Ops = DFC.PFL_Ops;
                  }

                  await MiaoPluginMBT._CtxPrep(Hades);
                  await Hermes.preloadPools(Hades);

                  Hades.D(`正在初始化元数据缓存...`);
                  const [localCacheData] = await Promise.all([
                      MiaoPluginMBT.ImgMetaAC(true, Hades),
                      MiaoPluginMBT.MetaHub.AC(true)
                  ]);

                  await MiaoPluginMBT.GenerateList(localCacheData, Hades);
                  MiaoPluginMBT._MetaCache = localCacheData; 
                  MiaoPluginMBT.BootStrap = true;

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
                  MiaoPluginMBT.BootStrap = false;
                  MiaoPluginMBT.InitPromise = null;
                  Hades.E(`初始化失败:`, error);
                  throw error; 
              } finally {
                  MiaoPluginMBT.BootLock = false;
              }
          };

          try {
              const res = await initTask();
              MiaoPluginMBT.InitPromise = Promise.resolve(res);
              return MiaoPluginMBT.InitPromise;
          } catch (e) {
              MiaoPluginMBT.InitPromise = null;
              throw e;
          } finally {
              MiaoPluginMBT._isInitializing = false;
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
      Tianshu._aliasReverseIndex = new Map();
      MBTCF.reset();
      PoseidonSpear.reset();
      Ananke.reset();
      Cerberus.reset();
      Morpheus.reset().catch(() => {});
  }

  static async _teardown(isReload = false, logger = console) {
      if (MiaoPluginMBT.MBTProcc) {
          await MiaoPluginMBT.MBTProcc.killAll('SIGTERM', isReload ? 'Hot Reload' : 'Shutdown');
      }

      if (Morpheus.closeBrowser) {
          await Morpheus.closeBrowser();
      }

      Hermes.cleanup();
      MiaoPluginMBT.#pendingInit = null;
      MiaoPluginMBT.InitPromise = null;

      if (isReload) {
          MiaoPluginMBT._resetRuntimeState();
      }
  }

  static async ImgMetaAC(reloadCache = false, logger = getCore()) {
    if (MiaoPluginMBT._MetaCache?.length > 0 && !reloadCache) return MiaoPluginMBT._MetaCache;
    const Hades = HadesEntry({}, logger || getCore());
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
        path: item.path.replace(/\\/g, "/") 
    }));

    MiaoPluginMBT._remoteBanCount = upstreamBanCount;
    Tianshu.BuildIndexes(validData);
    MiaoPluginMBT._MetaCache = Object.freeze(validData);
    const duration = Date.now() - startTime;
    Hades.D(`元数据重构完成耗时[ ${duration}ms ]，索引数据[ ${validData.length} 条 | ${upstreamBanCount} 条 ]`);

    return MiaoPluginMBT._MetaCache;
  }

  static async OpsGate(e, commandName) {
    const Hades = HadesEntry();
    const cerberus = Cerberus.getInstance();
    if (cerberus.tier === 1) {
      const freeMB = Math.floor(cerberus.freeMemMB);
      await e.reply(`咕咕牛发现当前系统内存极低 (${freeMB}MB)，已暂时挂起操作。`, true);
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
              await e.reply(`指令冷却中 (Tier ${cerberus.tier})，请等待 ${ttl} 秒。`, true);
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
         const repoPool = await Hermes.getRepoPool();
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
    const Hades = HadesEntry({}, logger || getCore());
    const context = await Nomos.getContext();
    const activeRepos = Nomos.ActiveScope(MiaoPluginMBT.MBTConfig, context);
    const activeKeys = new Set(activeRepos.map(r => r.key));

    const PURGE_PATHS = [
      MiaoPluginMBT.Paths.Target.MiaoCRE, 
      MiaoPluginMBT.Paths.Target.ZZZCRE, 
      MiaoPluginMBT.Paths.Target.WavesCRE
    ].filter(Boolean);
    
    await Promise.all(PURGE_PATHS.map((dir) => Ananke.purge(dir, Hades)));

    const SyncManifest = MiaoPluginMBT._MetaCache;
    const syncTasks = [];
    let skippedCount = 0;

    if (SyncManifest && SyncManifest.length > 0) {
        for (const imgData of SyncManifest) {
            const relativePath = imgData.path?.replace(/\\/g, "/");
            const storageBox = imgData.storagebox;
            
            if (!relativePath || !storageBox) continue;
            
            if (!activeKeys.has(storageBox)) continue;
            
            if (MiaoPluginMBT._activeBanSet.has(relativePath)) { 
                skippedCount++; 
                continue; 
            }

            const sourceBasePath = Nomos.PathKey(storageBox, MiaoPluginMBT.Paths);
            if (!sourceBasePath) continue;

            const targetPath = Nomos.ResolveCharTarget(relativePath, MiaoPluginMBT.Paths);
            if (targetPath) {
                syncTasks.push({
                    src: path.join(sourceBasePath, relativePath),
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

    Hades.D(`准备同步 ${syncTasks.length} 个文件 (已过滤 ${skippedCount} 个)...`);

    const startTime = Date.now();
    const result = await Ananke.dispatchSync(syncTasks, Hades);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    Hades.D(`同步完成: 成功 ${result.success}, 失败 ${result.fail}, 耗时 ${duration}s`);
  }

  static async RevertFile(relativePath, logger = getCore()) {
    const Hades = HadesEntry({}, logger || getCore());

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

  static async SmartTaskHeavy(runtimeContext, repoNum, repoUrl, branch, finalLocalPath, e, logger, sortedNodes = [], MBTProcc, signal = null, lockId = null) {
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
      let isShuttingDown = false;
      let activeCRS = null;
      let retryTimer = null;
      let githubTimer = null;

      const onShutdown = () => {
          if (isShuttingDown) return;
          isShuttingDown = true;
          Hades.W(`${RidColored} | [System] 收到停机信号，正在中止下载任务...`);
          if (activeCRS) activeCRS.stop();
      };
      SignalTrap.on('shutdown', onShutdown);

      if (signal?.aborted) throw new Error('开始前已中止');

      let MODE = 'AIRLOCK_PROXY';
      let logModeMsg = "";
      let useAirlock = true;
      let inheritEnv = false;
      let extraEnv = null;
      let retryWithAirlock = false;

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

          if (enableV6) {
              Hades.D(`${RidColored} | [Smart] 检测到 IPv6 双栈环境注入策略中...`);
          }

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
              logModeMsg = `${senseChain.desc} -> 强制 GitHub [${senseChain.vector.v6Lat}ms]`;
          } else {
              MODE = netMode === Proteus.State.NATIVE ? 'NATIVE' :
                     (netMode === Proteus.State.USER_AGENT || netMode === Proteus.State.IDLE_AGENT) ? 'USER_PROXY' : 'AIRLOCK_PROXY';

              logModeMsg = senseChain.desc;
              if (extraEnv && extraEnv.ALL_PROXY) {
                  logModeMsg += ` [注入:${extraEnv.ALL_PROXY}]`;
              }
          }

          Hades.D(`${RidColored} | [Smart] 运行模式: ${MODE} | 理由: ${logModeMsg}`);

          if (repoNum === 1) Hades.D(`${RidColored} | [Smart] ${logModeMsg}`);

          const githubNode = sortedNodes.find(n => n.name === "GitHub") || { 
              name: "GitHub", priority: 0, ClonePrefix: "https://github.com/", protocol: 'HTTPS' 
          };
          
          let RacingQueue = [];
          let useGitHubAsBackup = false;
          const mirrorNodes = sortedNodes.filter(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
          const validatedMirrors = mirrorNodes
              .filter(n => (n.protocol === 'HTTP') && Number.isFinite(getNodeLatency(n)))
              .sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
          const primaryMirrors = validatedMirrors.slice(0, 2);
          const reserveMirrors = validatedMirrors.slice(2);

          const getNodeLatency = (node) => {
              if (!node) return Infinity;
              if (node.name === "GitHub") {
                  const lat = preferV6 ? v6Lat : v4Lat;
                  if (Number.isFinite(lat)) return lat;
              }
              const candidate = node.latency ?? node.time ?? node.speed;
              return Number.isFinite(candidate) ? candidate : Infinity;
          };

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
                  Hades.D(`${RidColored} | [Smart] 注入 GitHub 竞速重试组`);
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
                      
                      if (actualCloneUrl.includes('gitee.com')) {
                          if (finalEnv && (finalEnv.HTTP_PROXY || finalEnv.HTTPS_PROXY)) {
                              finalEnv = { ...finalEnv };
                              delete finalEnv.HTTP_PROXY;
                              delete finalEnv.HTTPS_PROXY;
                              delete finalEnv.ALL_PROXY;
                              finalEnv.NO_PROXY = 'gitee.com,localhost,127.0.0.1';
                          }
                      }

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
                                  Hades.D(`${RidColored} | [Smart] 检测到 IPv6 数据异常，正在回退至 IPv4 通道...`);
                    
                                  preferV6 = false; 
                                  
                                  if (activeCRS && !activeCRS.closed) {
                                      const newTaskId = `GitHub_V4_Fallback_${uniqueSuffix}`;
                                      activeCRS.addTask(newTaskId, createTaskFactory(node, false), true, 1000);
                                  }
                                  
                                  if (activeCRS && !activeCRS.closed && mirrorNodes.length > 0) {
                                      Hades.D(`${RidColored} | [Smart] 启动镜像备援...`);
                                      mirrorNodes.forEach((mirror, idx) => {
                                          activeCRS.addTask(mirror.name, createTaskFactory(mirror), false, 2000 + (idx * 1000));
                                      });
                                  }
                                  
                                  throw new Error('IPv6数据异常，已降级');
                              }
                          }

                          if (diagnosis === 'DOWNGRADE_H1' && !isDowngrade) {
                              Hades.D(`${RidColored} | [Quo] 🧬 节点 [${taskName}] 触发(H2 -> H1)...`);
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
                                  Hades.D(`${RidColored} | [Smart] 节点熔断: [${node.name}] ${strikeRes.type} (冷却 ${(strikeRes.coolingTime / 60000).toFixed(0)}m)`);
                              }
                          }
                          
                          setTimeout(() => {
                              MiaoPluginMBT.GitMutex.run(async () => {
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

         let lastTime = Date.now();
          const nodePool = [...RacingQueue, ...reserveMirrors]; 
          let waveCount = 0;

          const poolNames = nodePool.map(n => n.name).join(', ') || '无';
          const backupName = useGitHubAsBackup ? 'GitHub (75s BPP)' : '无';
          if (MODE !== 'USER_PROXY') {
              Hades.D(`${RidColored} | [Smart] 🎲 初始节点池: [${poolNames}] | [${backupName}]`);
          }

          while (true) {
              if (isShuttingDown) break;
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

              if (useGitHubAsBackup && !activeCRS.tasks.has('GitHub')) {
                  if (githubTimer) clearTimeout(githubTimer);
                  githubTimer = setTimeout(() => {
                      if (activeCRS && !activeCRS.closed && !activeCRS.tasks.has('GitHub')) {
                          Hades.D(`${RidColored} | [Smart] 🚑 GitHub BPP `);
                          activeCRS.addTask('GitHub', createTaskFactory(githubNode), true, 0);
                      }
                  }, 75000); 
              }

              if (retryTimer) clearInterval(retryTimer);
              retryTimer = setInterval(() => {
                  if (activeCRS.closed) return;
                  const now = Date.now();
                  if (now - lastTime < 5000) return; 

                  const status = activeCRS.getStatus();
                  
                  if (status.activeCount < 2 && status.maxProgress < 80 && nodePool.length > 0) {
                      const nextNode = nodePool.shift();
                      if (nextNode) {
                          const boostDelay = getStartDelay(nextNode, 1, riskMode);
                          Hades.D(`${RidColored} | [Smart] 🚑 动态补员: ${nextNode.name}`);
                          activeCRS.addTask(nextNode.name, createTaskFactory(nextNode), false, boostDelay);
                          lastTime = now;
                      }
                  }
                  
                  if (status.activeCount === 0 && !activeCRS.tasks.has('GitHub')) {
                       Hades.D(`${RidColored} | [Smart] 提前启动BPP`);
                       if (githubTimer) clearTimeout(githubTimer);
                       activeCRS.addTask('GitHub', createTaskFactory(githubNode), true, 1000);
                       lastTime = now;
                  }
              }, 2000);

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
                  return { success: true, nodeName: winnerResult.nodeName, error: null, gitLog, mode: MODE, modeMsg: logModeMsg };

              } catch (waveError) {
                  if (waveError.isFatal) {
                      Hades.E(`${RidColored} | [Smart] 触发致命错误熔断: ${waveError.message}`);
                      if (activeCRS) activeCRS.stop(); throw waveError; 
                  }
                  Hades.D(`${RidColored} | [Smart] 本轮调度结束: ${waveError.message}`);
                  activeCRS.stop();

                  if (MODE === 'NATIVE' && !retryWithAirlock) {
                      Hades.W(`${RidColored} | [Smart] 模式失败，正在切换至气闸模式...`);
                      retryWithAirlock = true;
                      MODE = 'AIRLOCK_PROXY';
                      useAirlock = true;
                      inheritEnv = false;

                      const airlockNodes = mirrorNodes
                          .filter(n => PoseidonSpear.isLive(n.name))
                          .sort((a, b) => getNodeLatency(a) - getNodeLatency(b));
                      if (airlockNodes.length > 0) {
                          nodePool.length = 0;
                          nodePool.push(...airlockNodes);
                          Hades.D(`${RidColored} | [Smart] 已切换至气闸节点: [${airlockNodes.map(n => n.name).join(', ')}]`);
                          await common.sleep(1000);
                          continue;
                      }
                  }

                  if (isShuttingDown) break;
                  if (nodePool.length === 0) return { success: false, nodeName: "全部失败", error: waveError, mode: MODE, modeMsg: logModeMsg };
                  await common.sleep(2000);
              }
          }
          return { success: false, nodeName: "全部失败", error: new Error("所有可用节点均尝试失败"), mode: MODE, modeMsg: logModeMsg };

      } catch (SmartErr) {
          Hades.E(`${RidColored} ${logTag} | [Smart] 调度失败: ${SmartErr.message}`);
          return { success: false, nodeName: "全部失败", error: SmartErr, mode: MODE, modeMsg: logModeMsg };
      } finally {
          SignalTrap.off('shutdown', onShutdown);
          if (retryTimer) clearInterval(retryTimer);
          if (githubTimer) clearTimeout(githubTimer);
          if (activeCRS) activeCRS.stop();
      }
  }

  static async UpstreamSyncRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, logger, senseChain) {
    return await MiaoPluginMBT.GitMutex.run(async () => {
      const Hades = HadesEntry({}, logger || getCore());
      const state = {
        success: false, hasChanges: false, error: null, wasHardReset: false,
        autoSwitchedNode: null, newCommitsCount: 0, diffStat: null, MBTCoreChange: false, log: null
      };

      const Network_Err_KeyWords = [
        "connection timed out", "connection was reset", "could not resolve host",
        "unable to access", "handshake failed", "error: 502", "error: 522",
        "error: 504", "etimedout", "gnutls_handshake", "rpc failed",
        "unable to update url base from redirection", "recv failure", "error: 429",
        "credential url cannot be parsed", "url cannot be parsed",
        "command timed out", "command timeout", "命令执行超时"
      ];
      const timeoutErrCodes = new Set(["ETIMEDOUT", "ESLOWNET"]);
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
        if (base_opts.env || override_opts.env) merged.env = { ...(base_opts.env || {}), ...(override_opts.env || {}) };
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
        constraints: { zombieThreshold: 60 * 1000, lowSpeedLimit: 10240, lowSpeedStrikes: 3 }
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


      Hades.D(`[Phase 1] ${RepoName} | 模式=${Proteus._describe(mode)}`);
      let syncResult = await executeSyncLogic(initial_pipe_opts, getModePullTimeout(mode));

      if (!syncResult.success) {
        const syncErrText = collectGitErrText(syncResult.error);
        const isNetErr = !!syncResult.error && (timeoutErrCodes.has(String(syncResult.error.code).toUpperCase()) || Network_Err_KeyWords.some(k => syncErrText.includes(k)));


        if (isNetErr) {
          const currentRemote = (await MBTPipeControl("git", ["remote", "get-url", "origin"], { cwd: localPath }).catch(() => ({ stdout: "未知" }))).stdout.trim() || "未知";
          Hades.W(`[Phase 2] ${RepoName} 网络波动 [当前源: ${currentRemote}] 正在启动镜像路由...`);

          let repo_path = parseGitHubRepoPath(RepoUrl) || parseGitHubRepoPath(currentRemote);
          const github_url = repo_path ? `https://github.com/${repo_path}.git` : "";
          const rollback_remote = github_url || currentRemote;

          const rollback_origin = async (reason) => {
            if (rollback_remote && rollback_remote !== "未知") {
              await MBTPipeControl("git", ["remote", "set-url", "origin", rollback_remote], { cwd: localPath }).catch(()=>{});
              Hades.D(`[Rollback] ${RepoName} 已回滚 origin (${reason})`);
            }
          };

          try {
            const probe_rows = await MiaoPluginMBT.TestCaVoice(Hades);
            const survivors = probe_rows.filter(r => r.speed !== Infinity);

            if (survivors.length > 0) {
              const git_jobs = survivors.map(row => MiaoPluginMBT.TestGitVoice(row.ClonePrefix, row.name, Hades).then(res => ({ name: row.name, gitResult: res })).catch(err => ({ name: row.name, gitResult: { success: false, error: err } })));
              const git_rows = await Promise.all(git_jobs);
              const best_nodes = await MiaoPluginMBT.AdaptiveSpeed(probe_rows, git_rows, Hades);
              if (!best_nodes.some(n => n.name === 'GitHub')) best_nodes.push(probe_rows.find(n => n.name === 'GitHub') || {name: 'GitHub'});

              for (const winner of best_nodes) {
                if (!repo_path || !winner.name) continue;
                const newUrl = winner.name === "GitHub" ? github_url : `${winner.ClonePrefix.replace(/\/$/, "")}/github.com/${repo_path}.git`;

                try {
                  await MBTPipeControl("git", ["remote", "set-url", "origin", newUrl], { cwd: localPath, ...initial_pipe_opts });
                  const lsResult = await MBTPipeControl("git", ["ls-remote", "--heads", "origin", branch], { cwd: localPath, ...initial_pipe_opts }, 6000).catch(() => ({ stdout: "" }));
                  if (!lsResult.stdout.trim()) { await rollback_origin(`${winner.name}-head-empty`); continue; }
                  syncResult = await executeSyncLogic(initial_pipe_opts, basePullTimeout);
                  if (syncResult.success) {
                    state.autoSwitchedNode = winner.name;
                    break; 
                  }
                  await rollback_origin(`${winner.name}-sync-fail`);
                } catch (e) { await rollback_origin(`${winner.name}-error`); }
              }
            }
          } catch (e) { Hades.E(`[Phase 2] 路由探测异常:`, e); }

          if (!syncResult.success && github_url) {
            Hades.W(`[Phase 3] ${RepoName} GitHub 竞速组模式唤起...`);
            const stage_rows = [
              { name: "Stage-1(直连)", opts: { inheritEnv: false } },
              { name: "Stage-2(H1+剥离)", opts: { inheritEnv: false, gitConfigs: ["http.version=HTTP/1.1", "http.proxy=", "https.proxy=", "core.gitProxy="] } }
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
      if (e && !isScheduled && !syncResult.success) Promise.resolve(e.reply(`咕咕牛图库的 ${RepoName} 同步失败，请查看失败详情。`)).catch(() => {});

      try {
        const rawLog = (await MBTPipeControl("git", ["log", `-n ${RepoNum === 1 ? 5 : 3}`, `--date=${DFC.logDateFormat}`, `--pretty=format:%cd [%h]%n%s%n%b`], { cwd: localPath }, 5000)).stdout;
        if (rawLog) {
          const entries = rawLog.split(/(?=\d{2}-\d{2}\s\d{2}:\d{2}\s+\[)/).filter(s => s.trim());
          const BtnFaceUrl = `file://${MiaoPluginMBT.Paths.OpsPath}/img/icon/null-btn.png`.replace(/\\/g, "/");
          state.log = await Promise.all(entries.map(async (entry) => {
            const lines = entry.trim().split('\n');
            const header = lines.shift() || ""; const subject = lines.shift() || ""; const body = lines.join('\n').trim();
            const commit = { hash: (header.match(/\[([a-f0-9]+)\]/) || [])[1] || 'N/A', date: (header.match(/^(\d{2}-\d{2}\s\d{2}:\d{2})/) || [])[1] ? `[${RegExp.$1}]` : '', commitTitle: subject.trim(), descriptionBodyHtml: '', isDescription: true, displayParts: [], commitScopeClass: 'scope-default' };
            const ccMatch = subject.match(/^([a-zA-Z\u4e00-\u9fa5]+)(?:\(([^)]+)\))?[:：]\s*(?:\[([^\]]+)\]\s*)?(.+)/);
            if (ccMatch) {
              const rawPrefix = ccMatch[1].toLowerCase();
              commit.commitPrefix = { '修复': 'fix', '新增': 'feat', '文档': 'docs', '样式': 'style', '重构': 'refactor', '性能': 'perf', '测试': 'test', '构建': 'build', '部署': 'deploy', '回滚': 'revert', '杂项': 'chore', '持续集成': 'ci' }[rawPrefix] || rawPrefix;
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
            const gamePrefixes = [{ pattern: /^(原神UP:|原神UP：|原神up:|原神up：)\s*/i, key: "gs" }, { pattern: /^(星铁UP:|星铁UP：|星铁up:|星铁up：)\s*/i, key: "sr" }, { pattern: /^(绝区零UP:|绝区零UP：|绝区零up:|绝区零up：)\s*/i, key: "zzz" }, { pattern: /^(鸣潮UP:|鸣潮UP：|鸣潮up:|鸣潮up：)\s*/i, key: "waves" }];
            for (const gp of gamePrefixes) {
              if (gp.pattern.test(commit.commitTitle)) {
                commit.isDescription = false;
                const names = commit.commitTitle.replace(gp.pattern, '').split(/[/、，,]/).map(n => n.trim()).filter(Boolean);
                for (const rawName of names) {
                  let displayName = rawName;
                  const aliasRes = await Tianshu.NormalizeName(rawName, { gameKey: gp.key });
                  if (aliasRes.exists) displayName = aliasRes.mainName;
                  let faceUrl = BtnFaceUrl;
                  if (gp.key === 'gs' || gp.key === 'sr') faceUrl = await Tianshu.ResolveFace(gp.key, displayName) || BtnFaceUrl;
                  else if (gp.key === 'zzz') { try { const zzzFiles = await Ananke.readDir(MiaoPluginMBT.Paths.Target.ZZZ_DataDir); for (const f of zzzFiles) { if (!f.name.endsWith('.json')) continue; const d = JSON.parse(await Ananke.readFile(path.join(MiaoPluginMBT.Paths.Target.ZZZ_DataDir, f.name), 'utf-8') || '{}'); if (d.Name === displayName || d.CodeName === displayName) { const iconId = d.Icon?.match(/\d+$/)?.[0]; if (iconId) faceUrl = `file://${path.join(MiaoPluginMBT.Paths.Target.ZZZ_FaceDir, `IconRoleCircle${iconId}.png`).replace(/\\/g, "/")}`; break; } } } catch {} }
                  else if (gp.key === 'waves') faceUrl = MiaoPluginMBT._wavesRoleDataMap?.get(displayName)?.icon || BtnFaceUrl;
                  commit.displayParts.push({ type: 'character', name: displayName, game: gp.key, imageUrl: faceUrl });
                }
                break;
              }
            }
            return commit;
          }));
        } else throw new Error("Empty log");
      } catch {
        state.log = [{ isDescription: true, commitTitle: "无有效提交记录或获取失败", hash: 'N/A', date: '', commitPrefix: null, descriptionBodyHtml: '' }];
      }

      return state;
    }, { id: `UpstreamSyncRepo-${RepoNum}` });
  }

  static async TestGitVoice(ClonePrefix, nodeName, logger = getCore()) {
    const MAX_RETRIES = 3;
    const TIMEOUT = 15000;
    const Hades = HadesEntry({}, logger || getCore());

    const repoPool = (await Hermes.getRepoPool())
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
            Hades.D(`[Git测速重试 ${attempt}/${MAX_RETRIES}] 节点: ${nodeName} | 切换靶标: ${targetRepo}`);
        }

        const startTime = Date.now();

        const result = await MBTPipeControl("git", ["ls-remote", "--heads", actualUrl], {}, TIMEOUT)
            .then((res) => ({ 
                success: true, 
                duration: Date.now() - startTime,
                metrics: res.metrics
            }))
            .catch((err) => {
                lastError = err;
                return null;
            });

        if (result) {
            return { 
                success: true, 
                duration: result.duration, 
                metrics: result.metrics,
                isDisguised: true
            };
        }
    }

    return { 
        success: false, 
        duration: Infinity, 
        error: lastError, 
        isDisguised: true,
        metrics: null
    };
  }

static async ProvisionPhase(e, logger = getCore(), stage = 'full') {
    const Hades = HadesEntry({}, logger || getCore());
    try {
      Hades.D(`[调试日志] === 进入 ProvisionPhase (阶段: ${stage}) ===`);
      await MiaoPluginMBT.SSF();
      Hades.D(`[调试日志] 加载最新配置...`);
      MiaoPluginMBT.MBTConfig = await Ananke.loadingConfig(
          MiaoPluginMBT.Paths.ConfigFilePath,
          DFC,
          Hades
      );

      if (stage === 'core') {
        Hades.D(`[调试日志] 核心阶段部署完成，提前退出。`);
        return; 
      }

      Hades.D(`[调试日志] 加载图片元数据...`);
      const imageData = await MiaoPluginMBT.ImgMetaAC(true, Hades);
      MiaoPluginMBT._MetaCache = Object.freeze(imageData);
      await MiaoPluginMBT.MetaHub.AC(true);
      
      Hades.D(`[调试日志] 生成并应用封禁列表...`);
      await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, Hades);
      
      if (MiaoPluginMBT.MBTConfig.Repo_Ops) {
        Hades.D(`[调试日志] 图库已启用，同步所有角色文件夹...`);
        await MiaoPluginMBT.SCD(Hades);
      } else {
        Hades.D(`[调试日志] 图库已禁用，跳过同步角色文件夹。`);
      }
      
      Hades.D(`[调试日志] 完整部署成功完成所有步骤。`);
      
      if (stage === 'full') {
        try {
          await Ananke.writeText(MiaoPluginMBT.Paths.ProvisionPath, new Date().toISOString());
          Hades.D(`[调试日志] 已成功创建安装状态标记文件。`);
        } catch (lockError) {
          Hades.E(`创建状态标记文件失败:`, lockError);
        }
      }
    } catch (error) {
      Hades.E(`ProvisionPhase (阶段: ${stage}) 内部发生致命错误:`, error);
      if (e) {
        await DocHub.report(e, `安装设置 (${stage}阶段)`, error, "", Hades);
      }
      throw error;
    } finally {
      Hades.D(`[调试日志] === 退出 ProvisionPhase (阶段: ${stage}) ===`);
    }
  }

 static async HydrateCore(e, isScheduled = false, logger = getCore()) {
    const Hades = HadesEntry({}, logger || getCore());
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
    const Hades = HadesEntry({}, logger || getCore());
    const timeoutDuration = DFC.ProxyRepoTimeout;
    const maxRetries = 3;
    let attempt = 0;
    let harvest = [];
    let isSuccess = false;

    while (attempt < maxRetries && !isSuccess) {
      attempt++;
      const targetRawUrl = await Hermes.getRandomRawTarget();
      if (!targetRawUrl) {
        Hades.D(`测速靶标为空，云端仓库池不可用。`);
        break;
      }
      
      if (attempt > 1) {
        Hades.D(`[测速重试 ${attempt}/${maxRetries}] 切换测试靶: ${targetRawUrl}`);
      }

      const promises = DFC.F2Pool.map(async (proxy) => {
        const result = {
          name: proxy.name || "未命名",
          priority: proxy.priority || 999,
          ClonePrefix: proxy.ClonePrefix,
          TestUrlPrefix: proxy.TestUrlPrefix,
          speed: Infinity
        };

        let testUrl = "";
        if (proxy.name === "GitHub") {
           testUrl = targetRawUrl; 
        } else if (proxy.TestUrlPrefix) {
           testUrl = proxy.TestUrlPrefix + targetRawUrl;
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
    const Hades = HadesEntry({}, logger || getCore());
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
          const configData = fs.existsSync(configPath) ? (yaml.load?.(fs.ReadSync(configPath, 'utf8')) ?? null) : null;

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

    const MasterQQList = await MasterAc();

    if (!MasterQQList?.length || typeof Bot === "undefined" || typeof Bot.pickUser !== 'function') {
      return;
    }

    if (delay > 0) {
      await common.sleep(delay);
    }

    try {
      await Bot.pickUser(MasterQQList[0])?.sendMsg?.(msg);
    } catch {}
  }

  async RunUpdateTask() {
    if (!this.logger) this.logger = HadesEntry({}, getCore());
    if (!MiaoPluginMBT.BootStrap) {
      this.logger.debug(`图库未下载，跳过本次任务。`);
      return;
    }
    this.logger.debug(`开始执行定时更新任务...`);
    const startTime = Date.now();
    let HasAnyChanges = false;
    try {
      HasAnyChanges = await this.Reconcile(null, true);
      this.logger.debug(`定时更新任务完成。检测到更新: ${HasAnyChanges}`);
    } catch (error) {
      this.logger.error(`定时更新任务执行期间发生意外错误:`, error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.debug(`定时更新任务流程结束，总耗时 ${duration} 秒。`);
    }
  }

  async CronSweep() {
    this.logger.debug(`[CronSweep] 开始执行系统维护任务...`);

    const LockStatus = [
        { lock: MiaoPluginMBT.MetaMutex, name: 'MetaMutex', maxAge: 60000 },
        { lock: MiaoPluginMBT.GitMutex, name: 'GitMutex', maxAge: 1800000 },
        { lock: MiaoPluginMBT.InstallMutex, name: 'InstallMutex', maxAge: 600000 },
        { lock: MiaoPluginMBT.RenderMutex, name: 'RenderMutex', maxAge: 300000 }
    ];

    for (const { lock, name, maxAge } of LockStatus) {
        const stats = lock.getStats();
        if (stats.locked && stats.uptime > maxAge) {
            this.logger.warn(`[CronSweep] 检测到僵死锁 [${name}] (持有者: ${stats.holder}, 时长: ${stats.uptime}ms)，强制重置。`);
            lock.emergencyReset('CronSweep 清理僵死锁');
        }
    }

    const cleanTasks = [
        Ananke.obliterate(MiaoPluginMBT.Paths.TempDownloadPath, 3, 500),
        (async () => {
            try {
                const entries = await Ananke.readDir(MiaoPluginMBT.Paths.TempHtmlPath);
                const targets = entries
                    .filter(e => e.isDirectory() && (e.name.toLowerCase().includes("guguniu") || e.name.includes("render-")))
                    .map(e => path.join(MiaoPluginMBT.Paths.TempHtmlPath, e.name));
                await Promise.all(targets.map(p => Ananke.obliterate(p)));
            } catch (e) { if (e.code !== 'ENOENT') this.logger.warn(`[CronSweep] HTML清理异常: ${e.message}`); }
        })(),
        Morpheus.housekeeping(this.logger),
        (async () => {
            try {
                const lockFile = MiaoPluginMBT.Paths.ProvisionPath;
                const stats = await Ananke.stat(lockFile);
                if (stats && Date.now() - stats.mtimeMs > 3600000) {
                    await Ananke.obliterate(lockFile);
                    this.logger.debug(`[CronSweep] 清理过期的安装锁文件。`);
                }
            } catch {}
        })()
    ];

    await Promise.allSettled(cleanTasks);

    const ensureDirs = [
        MiaoPluginMBT.Paths.TempNiuPath,
        MiaoPluginMBT.Paths.TempDownloadPath,
        path.join(YzPath, "resources", "Community")
    ];
    await Promise.all(ensureDirs.map(p => Ananke.mkdirs(p).catch(() => {})));

    this.logger.debug(`[CronSweep] 系统维护完成。`);
  }

  async CheckInit(e) {
    const logger = this.logger || getCore();
    const Hades = HadesEntry({}, logger);

    if (!MiaoPluginMBT.InitPromise && !MiaoPluginMBT.BootLock) {
        Hades.D(`检测到生命周期总线未启动，正在尝试惰性初始化...`);
        try {
            await MiaoPluginMBT.init(Hades);
        } catch (err) {
            Hades.E(`惰性初始化失败:`, err);
        }
    }

    if (!MiaoPluginMBT.InitPromise) {
        Hades.E(`高危: CheckInit 无法建立初始化`);
        await e.reply('『咕咕牛🐂』插件初始化失败，请检查后台日志。', true);
        return false;
    }

    try {
        await MiaoPluginMBT.InitPromise;
        this.PFSCReady = MiaoPluginMBT.BootStrap;
    } catch (err) {
        this.PFSCReady = false;
        Hades.D(`等待初始化完成时捕获到异常。`);
    }

    if (!this.PFSCReady) {
        await e.reply(`咕咕牛插件核心服务未就绪，大部分功能无法使用。`, true);
        return false;
    }

    const isCoreRepoValid = await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath);
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
          await e.reply(`指令冷却中，剩余 ${ttl} 秒后可再次使用哦~`, true);
          return true;
        }
    }

    try {
      try {
        await Ananke.mkdirs(MiaoPluginMBT.Paths.TempDownloadPath);
        const uniqueTestFile = path.join(MiaoPluginMBT.Paths.TempDownloadPath, `write_test_${Date.now()}.tmp`);
        await Ananke.writeText(uniqueTestFile, "test");
        await Ananke.obliterate(uniqueTestFile);
      } catch {
        throw new Error(`环境检查失败：无法写入临时目录，请检查权限。`);
      }

      const zzzpluginIns = await Ananke.Audit(MiaoPluginMBT.Paths.ZZZPluginPath);
      const wavespluginIns = await Ananke.Audit(MiaoPluginMBT.Paths.WavesPluginPath);
      const repoContext = { zzzInstalled: zzzpluginIns, wavesInstalled: wavespluginIns };

      const BMF = async (id) => {
        const state = await MiaoPluginMBT.GetRepoState(id, repoContext, { checkExistsWhenDisabled: true });
        if (!state) return { repo: id, status: 'skipped', nodeName: '未配置', success: true };
        if (state.exists) {
          return { repo: id, status: 'skipped', nodeName: '本地', success: true };
        }
        if (!state.isEnabled) {
          return { repo: id, status: 'skipped', nodeName: '未配置', success: true };
        }
        return { repo: id, status: 'pending', nodeName: '等待中', success: false };
      };

      repoManifest.push(await BMF(1));
      repoManifest.push(await BMF(2));
      repoManifest.push(await BMF(3));
      repoManifest.push(await BMF(4));
      repoManifest.push(await BMF(5));
      repoManifest.push(await BMF(6));

      if (repoManifest.every(r => r.status === 'skipped' && r.nodeName === '本地')) {
        if (redisKey) await redis.del(redisKey);
        return e.reply(`咕咕牛图库的资产均已存在。`, true);
      }

      const HttpResultMap = await MiaoPluginMBT.TestCaVoice(Hades);
      let validNodes = [];
      let capturedMode = "UNKNOWN";
      let capturedModeMsg = "未执行下载任务";

      try {
          const sortedNodes = await this._VoiceCore(e, Hades, HttpResultMap, [], startTime);
          validNodes = sortedNodes;
          await e.reply("测速结果仅供参考，实际下载将根据[CRS动态决策]选择最佳方式", true);
      } catch (err) {
          Hades.E(`测速报告生成跳过:`, err);
          validNodes = HttpResultMap.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
      }

      if (redisKey) { await redis.set(redisKey, '1', { EX: cooldownDuration }); }

      const deployRepo = async (repoTask) => {
          const repoNum = repoTask.repo;
          const meta = Nomos.MetaNum(repoNum);
          if (!meta) throw new Error(`未知的仓库编号: ${repoNum}`);
          const repoPath = MiaoPluginMBT.Paths[meta.pathKey];
          const repoUrl = Nomos.getRepoUrl(repoNum, MiaoPluginMBT.MBTConfig);
          let TheGrid = MiaoPluginMBT._PruneFatigue(validNodes)
          if (TheGrid.length === 0) TheGrid = validNodes;

          const branch = MiaoPluginMBT.MBTConfig.RepoBranch || "main";
          const runtimeContext = new RuntimeCtx();
          const envData = await Hermes.getEnvInfo(Hades);
          const bestMirror = TheGrid.find(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
          const mirrorSpeed = bestMirror ? (bestMirror.time || Infinity) : Infinity;
          const senseChain = await Proteus.sense(envData, mirrorSpeed, Hades);
          runtimeContext.vectors = senseChain.vector;
          runtimeContext.decision = senseChain;

          const result = await MiaoPluginMBT.SmartTaskHeavy(
              runtimeContext, repoNum, repoUrl, branch,
              repoPath, e, Hades, TheGrid, MBTProcc
          );

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
              else Hades.W(`附属仓库 ${repoNum} 下载失败，跳过。原因: ${result.error?.message}`);
              return result;
          }

          if (validNodes.length >= 3) MiaoPluginMBT._BenchNode(result.nodeName.split('(')[0]);
          
          if (repoNum === 1) {
              HotSwap = true; 
              await MiaoPluginMBT.ProvisionPhase(e, Hades, 'core');
              const sendReliefMsg = async () => {
                  await e.reply("--『咕咕牛🐂』--\n核心仓已部署✅️\n开始聚合下载附属仓库...");
              };

              try {
                  const coreTplResult = await Hermes.getTemplate('core_repo_download.html', Hades);
                  
                  if (coreTplResult.success && coreTplResult.data) {
                      const ViewProps = {
                        title: "咕咕牛的主资产仓库下载完成", 
                        subtitle: `已成功部署到本地`, 
                        nodeName: result.nodeName,
                        progress: 100, 
                        StatusMsg: "✅ 开始聚合下载附属仓库...", 
                        statusClass: "status-complete",
                      };

                      const imgBuffer = await Morpheus.shot("Core_Repo_Download", { 
                        htmlContent: coreTplResult.data, 
                        data: ViewProps, 
                        logger: Hades, 
                        pageBoundingRect: { selector: ".container" } 
                      });

                      if (imgBuffer) {
                          await e.reply(segment.image(imgBuffer)); 
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
      if (repo1Task) await deployRepo(repo1Task);

      const assJobs = repoManifest.filter(r => r.repo !== 1 && r.status === 'pending');
      if (assJobs.length > 0) {
          const MAX_CONCURRENCY = 2;
          const executing = [];
          let cumulativeDelay = 0;
          
          for (const task of assJobs) {
              const jitter = MBTMath.Range(3000, 6000); 
              cumulativeDelay += jitter; 
              
              const jobWrapper = (async () => {
                  Hades.D(`附属仓库 ${task.repo} 将延迟 ${cumulativeDelay}ms 后启动`);
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
        MiaoPluginMBT.BootStrap = true;
        MiaoPluginMBT.PFSCReady = true;
        setupSuccess = true;
      } catch (setupError) {
        await DocHub.report(e, "安装部署 (full)", setupError, "所有仓库已下载，但最终配置失败。");
      }
      
      allSuccess = FetchSuccess && setupSuccess;
      await this._Debrief(e, repoManifest, startTime, allSuccess);

      if (HotSwap) {
          setTimeout(async () => {
              try {
                  const hasChanges = await MiaoPluginMBT.SSF(); 
                  if (hasChanges) {
                      Hades.D(`核心逻辑已同步，触发热重载...`);
                  }
              } catch (err) {
                  Hades.E(`同步核心文件失败:`, err);
              }
          }, 10000); 
      }
    } catch (error) {
      Hades.E(`下载流程顶层执行出错:`, error);
      if (e) {
        const ctxInfo = `耗时: ${((Date.now() - startTime)/1000).toFixed(1)}s`;
        await DocHub.report(e, "下载流程", error, ctxInfo, Hades);
      }
    } finally {
      MBTProcc.killAll('SIGTERM', 'Provision 下载流程结束');
      if (redisKey && !allSuccess) try { await redis.del(redisKey); } catch {}
    }
    return true;
  }

  async _Debrief(e, repoManifest, startTime, allSuccess) {
      const REPO_NAMES = {
          1: "一号仓库 (核心)",
          2: "二号仓库 (原神)",
          3: "三号仓库 (星铁)",
          4: "四号仓库 (综合库)",
          5: "五号仓库 (SR18-GS)",
          6: "六号仓库 (SR18-SR)"
      };

      const results = repoManifest.map(r => {
          const name = REPO_NAMES[r.repo] || `仓库 ${r.repo}`;
          
          if (r.status === 'skipped') {
              if (r.nodeName === '本地') {
                  return { name, text: '已存在', statusClass: 'status-local', nodeName: '本地' };
              }
              return { name, text: '未配置', statusClass: 'status-na', nodeName: 'N/A' };
          }
          
          if (r.status === 'success') {
              const text = r.repo === 1 ? '下载/部署成功' : '下载成功';
              return { name, text, statusClass: 'status-ok', nodeName: r.nodeName };
          }

          return { 
              name, 
              text: '下载失败', 
              statusClass: 'status-fail', 
              nodeName: r.nodeName || '异常' 
          };
      });

      const successCount = results.filter(r => ['status-ok', 'status-local'].includes(r.statusClass)).length;
      const configuredCount = results.length;
      const percent = configuredCount > 0 ? Math.round((successCount / configuredCount) * 100) : 0;
      const stars = '★'.repeat(successCount) + '☆'.repeat(configuredCount - successCount);

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
          const tplResult = await Hermes.getTemplate('download.html', this.logger);
          let imgBuffer = null;

          if (tplResult.success && tplResult.data) {
              imgBuffer = await Morpheus.shot("Download", { 
                htmlContent: tplResult.data, 
                data: ViewProps,
                logger: this.logger,
                pageBoundingRect: { selector: ".wrapper" }
              });
          } else {
              this.logger.error(`获取下载报告模板失败`);
          }
          
          if (imgBuffer) {
              await e.reply(segment.image(imgBuffer));
          } else {
              await e.reply("任务结束，但报告图片生成失败，请查看后台日志。");
          }

          if (allSuccess) {
              if (!e.replyed) await e.reply("『咕咕牛🐂』成功进入喵喵里面！").catch(() => {});
              await common.sleep(1500);
              await e.reply("建议配置[净化等级]否则风险自负。发送#咕咕牛设置净化等级1可过滤R18内容。", true);
          } else {
              await e.reply("『咕咕牛🐂』部分仓库下载失败，请检查上方日志或重试。");
          }

      } catch (err) {
          this.logger.error(`报告流程发生意外:`, err);
          await e.reply("任务结束，但报告生成失败，请查看日志");
      }
  }

  async _ResolveRunMode(envInfo, mirrorSpeed = Infinity, senseChain = null, Hades = console) {
    const chain = senseChain || await Proteus.sense(envInfo, mirrorSpeed, Hades);
    const netMode = chain.mode;
    const proxyContext = chain.vector.proxyContext;
    const v6Lat = chain.vector.v6Lat;

    let runMode = "AIRLOCK_PROXY";
    let runModeMsg = chain.desc;

    switch (netMode) {
        case Proteus.State.V6_TURBO:
            runMode = 'NATIVE_V6';
            if (Number.isFinite(v6Lat)) runModeMsg = `${runModeMsg} -> 强制 GitHub [${v6Lat}ms]`;
            break;
        case Proteus.State.NATIVE:
            runMode = 'NATIVE';
            if (proxyContext) {
                const proto = proxyContext.protocol || 'http';
                runModeMsg += ` [注入:${proto.toUpperCase()}:${proxyContext.port}]`;
            }
            break;
        case Proteus.State.USER_AGENT:
            runMode = 'USER_PROXY';
            break;
        case Proteus.State.IDLE_AGENT:
            runMode = 'USER_PROXY';
            if (proxyContext) {
                const proto = proxyContext.protocol || 'http';
                runModeMsg += ` [注入:${proto.toUpperCase()}:${proxyContext.port}]`;
            }
            break;
        case Proteus.State.RULE_SPLIT:
            runMode = 'AIRLOCK_PROXY';
            break;
        case Proteus.State.AIRLOCK:
        default:
            runMode = 'AIRLOCK_PROXY';
            break;
    }

    return { runMode, runModeMsg };
  }

  async TestVoice(e) {
    const Hades = this.logger;
    await e.reply("📡 正在进行全量测速...", true);

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
        await e.reply("测速过程中发生错误，请查看日志。");
    }
    return true;
  }

  async _VoiceCore(e, Hades, httpResults, gitResults = [], startTime) {
    const taskEnvInfo = Hermes.getEnvInfo(Hades).catch(() => ({}));
    
    let sortedNodes = [];
    if (gitResults && gitResults.length > 0) {
        sortedNodes = await MiaoPluginMBT.AdaptiveSpeed(httpResults, gitResults, Hades);
    } else {
        sortedNodes = httpResults.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
    }

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

        const [baiduMs, googleMs, githubMs, giteeMs] = await Promise.all([
            ping('www.baidu.com', 443),
            ping('www.google.com', 443),
            ping('github.com', 443),
            ping('gitee.com', 443)
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

        const network = envInfo.network || {};
        const inference = envInfo.inference || envInfo;

        const nativeV4Raw = network.native?.v4Ip || inference.v4Ip || "192.168.1.10";
        const nativeV6Raw = network.native?.v6Ip || inference.v6Ip || "2001:0000:0000:0000:0000:0000:0000:7334";
        const nativeV4 = maskIp(nativeV4Raw);
        const nativeV6 = maskIp(nativeV6Raw);

        const browserV4Raw = network.browser?.v4?.ip || "N/A";
        const browserV6Raw = network.browser?.v6?.ip || "N/A";
        const browserV4 = maskIp(browserV4Raw);
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
        
        const { runMode, runModeMsg } = await this._ResolveRunMode(envInfo, mirrorSpeed, senseChain, Hades);

        const tplResult = await Hermes.getTemplate('speedtest.html', Hades);
        if (!tplResult.success) throw new Error("模板加载失败");

        const p1Stats = httpResults.filter(s => s.name !== 'GitHub').map((s, i) => {
            let gitData = null;
            let isGitOk = false;
            if (gitResults && gitResults.length > 0) {
                 gitData = gitResults.find(g => g.name === s.name)?.gitResult;
                 isGitOk = gitData?.success;
            }
            
            const isHttpOk = Number.isFinite(s.speed);
            
            let statusText = "超时";
            if (isHttpOk) statusText = `H:${s.speed}ms`;
            if (gitData) {
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
                isBest: sortedNodes[0]?.name === s.name
            };
        });
        
        const p2Stats = [
             { name: 'Baidu', val: vector.cnLink, rtt: baiduMs, icon: 'https://api.iconify.design/simple-icons:baidu.svg?color=%23ffffff' },
             { name: 'Google', val: vector.globalLink, rtt: googleMs, icon: 'https://api.iconify.design/logos:google-icon.svg' },
             { name: 'GitHub', val: vector.bizLink, rtt: githubMs, icon: 'https://api.iconify.design/simple-icons:github.svg?color=%23ffffff' },
             { name: 'Gitee', val: true, rtt: giteeMs, icon: 'https://api.iconify.design/simple-icons:gitee.svg?color=%23C71D23' } 
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

        const ViewProps = {
             speeds: { priority1: p1Stats, priority2: p2Stats },
             best1Display: sortedNodes[0] ? `${sortedNodes[0].name} (综合评分最优)` : "无可用源",
             duration: ((Date.now() - startTime) / 1000).toFixed(1),
             runMode, runModeMsg, 
             nativeV4, nativeV6,
             browserV4, browserV6,
             v4Lat: envInfo?.v4Lat || 0, 
             v6Lat: envInfo?.v6Lat || 0, 
             clientGeo,
             trafficFormatted, ioChunks
        };

        const imgBuffer = await Morpheus.shot("US-SpeedTest", {  
             htmlContent: tplResult.data, 
             data: ViewProps, 
             logger: Hades, 
             pageBoundingRect: { selector: ".container" }
        });

        if (imgBuffer) await e.reply(segment.image(imgBuffer));
        else await e.reply("测速报告生成失败。");

    } catch (err) {
        Hades.E(`测速报告生成异常:`, err);
        await e.reply("测速报告生成过程中发生错误，请查看日志。");
    }
    
    return sortedNodes;
  }

  async Reconcile(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false;
    if (!isScheduled && e && !(await MiaoPluginMBT.OpsGate(e, 'Reconcile'))) return true;
    const coreLogger = this.logger || getCore();
    const Hades = HadesEntry({}, coreLogger);

    let JavaScriptSyncStatus = false;

    const zzzpluginIns = await Ananke.Audit(MiaoPluginMBT.Paths.ZZZPluginPath);
    const wavespluginIns = await Ananke.Audit(MiaoPluginMBT.Paths.WavesPluginPath);
    const repoContext = { zzzInstalled: zzzpluginIns, wavesInstalled: wavespluginIns };

    const repo1State = await MiaoPluginMBT.GetRepoState(1, repoContext);
    const Repo1Exists = repo1State?.exists;
    if (!Repo1Exists) {
      if (!isScheduled && e) await e.reply("『咕咕牛🐂』图库未下载", true);
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
      await e.reply("『咕咕牛🐂』部分附属仓库未下载，建议先`#下载咕咕牛`补全。", true);
    }

    const startTime = Date.now();
    if (!isScheduled && e) await e.reply("『咕咕牛🐂』开始检查更新...", true);

    let globalSenseChain = null;
    try {
        const envData = await Hermes.getEnvInfo(Hades);
        globalSenseChain = await Proteus.sense(envData, Infinity, Hades);
        Hades.D(`全局网络态势已锁定: 模式=${Proteus._describe(globalSenseChain.mode)}`);
    } catch (err) {
        Hades.W(`全局网络态势感知失败，将使用降级配置: ${err.message}`);
    }

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
    const nomosContext = { zzzInstalled: zzzpluginIns, wavesInstalled: wavespluginIns };
    const activeRepos = Nomos.ActiveScope(MiaoPluginMBT.MBTConfig, nomosContext);
    const activeRepoIds = new Set(activeRepos.map(r => r.id));

    reportResults.push(await deployRepoResult(1, MiaoPluginMBT.Paths.MountRepoPath, "一号仓库", "Main_Github_URL", "Main_Github_URL", branch, true, globalSenseChain));

    const repo1Result = reportResults.find(r => r.name === "一号仓库");
    if (repo1Result && repo1Result.success) {
      JavaScriptSyncStatus = await MiaoPluginMBT.SSF();
    }

    if (activeRepoIds.has(2)) {
      const repo2Status = Repo2Exists
        ? await deployRepoResult(2, MiaoPluginMBT.Paths.MountRepoPath2, "二号仓库", "Ass_Github_URL", "Ass_Github_URL", branch, false, globalSenseChain)
        : { name: "二号仓库", statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo2Status);
    }

    if (activeRepoIds.has(3)) {
      const repo3Status = Repo3Exists
        ? await deployRepoResult(3, MiaoPluginMBT.Paths.MountRepoPath3, "三号仓库", "Ass2_Github_URL", "Ass2_Github_URL", branch, false, globalSenseChain)
        : { name: "三号仓库", statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo3Status);
    }

    if (activeRepoIds.has(4)) {
      const repo4Status = Repo4Exists
        ? await deployRepoResult(4, MiaoPluginMBT.Paths.MountRepoPath4, "四号仓库", "Ass3_Github_URL", "Ass3_Github_URL", branch, false, globalSenseChain)
        : { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" };
      reportResults.push(repo4Status);
    } else if (repo4State?.isConfigured) {
      reportResults.push({ name: "四号仓库", statusText: "未下载 (插件未安装)", statusClass: "status-skipped" });
    }

    if (allSuccess && HasAnyChanges) {
      await MiaoPluginMBT.HydrateCore(e, isScheduled, Hades);
      Tianshu.UpdateStats(Hades).catch(err => {
        Hades.E(`更新后刷新仓库统计缓存失败:`, err);
      });
    }

    let ConfigChanged = false;
    if (!MiaoPluginMBT.MBTConfig.nodeInfo) MiaoPluginMBT.MBTConfig.nodeInfo = {};
    const repoNameMap = { "一号仓库": '1', "二号仓库": '2', "三号仓库": '3', "四号仓库": '4' };
    for (const result of reportResults) {
      if (result.autoSwitchedNode) {
        const repoNum = repoNameMap[result.name];
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
    const notifyStatus = isScheduled && (ViewProps.HasAnyChanges || !ViewProps.allSuccess);
    const UpdateRenderFlag = (!isScheduled && e) || notifyStatus;

    if (UpdateRenderFlag) {
      imgBuffer = await Morpheus.shot("Update", { 
        tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "sync", "update.html"), 
        data: ViewProps, 
        logger: Hades,
        pageBoundingRect: { selector: ".wrapper" }
      });
    }

  if (imgBuffer) {
      const imgSegment = segment.image(imgBuffer);
      if (!isScheduled && e) {
        await e.reply(imgSegment);
        
        if (!allSuccess && errorList.length > 0) {
          await common.sleep(500);
          try {
            const forwardMsg = await common.makeForwardMsg(e, errorList, "咕咕牛更新失败详情");
            await e.reply(forwardMsg);
          } catch (fwdError) {
            Hades.E(`发送详细错误合并消息失败:`, fwdError);
            await e.reply("生成详细错误报告失败，请查看控制台日志。");
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
        
        if (e && !isScheduled) await e.reply(ReliefMsg);
        else if (notifyStatus) await MiaoPluginMBT.SendMasterMsg(ReliefMsg, e, 0, Hades);
        
      } else if (!isScheduled && e && !ViewProps.HasAnyChanges && ViewProps.allSuccess) {
        await e.reply("更新检查完成，图库已是最新。", true);
      }
    }

    if (JavaScriptSyncStatus) {
      const ResMsg = `检测到插件核心逻辑已更新！为确保所有功能正常，强烈建议重启机器人。`;
      if (!isScheduled && e) {
        await e.reply(ResMsg, true).catch(err => Hades.E("发送重启建议消息失败:", err));
      } else if (notifyStatus) {
        await MiaoPluginMBT.SendMasterMsg(ResMsg);
      }
    }

    Hades.D(`更新流程结束，耗时 ${duration} 秒。`);
    return HasAnyChanges;
  }

  async ManRepo(e) {
    if (!e.isMaster) return e.reply(`这个操作只有我的主人才能用哦~`, true);
    if (e.msg.trim() !== "#重置咕咕牛") return false;

    if (!this.logger) this.logger = HadesEntry({}, getCore());
    const Hades = this.logger;

    await e.reply("开始重置图库，正在清理文件...", true);

    const LegacyPaths = [
        path.join(YzPath, "resources", "Miao-Plugin-MBT"),
        path.join(YzPath, "resources", "Miao-Plugin-MBT-2"),
        path.join(YzPath, "resources", "Miao-Plugin-MBT-3"),
        path.join(YzPath, "resources", "Miao-Plugin-MBT-4"),
        path.join(YzPath, "resources", "CowCoo"),
        MiaoPluginMBT.Paths.oldOpsPath 
    ];

    const NewPaths = [
        MiaoPluginMBT.CowCooRepoRoot
    ];

    const obliteratePaths = [
        ...NewPaths,
        ...LegacyPaths,
        path.join(YzPath, "plugins", "GuTools"),
        path.join(YzPath, "plugins", "CooWeb")
    ];

    const purgePaths = [
        MiaoPluginMBT.Paths.Target.MiaoCRE,
        MiaoPluginMBT.Paths.Target.ZZZCRE,
        MiaoPluginMBT.Paths.Target.WavesCRE
    ].filter(Boolean);

    const cleanTempHtml = async () => {
        const entries = await Ananke.readDir(MiaoPluginMBT.Paths.TempHtmlPath);
        const targets = entries
            .filter(e => {
                if (!e.isDirectory()) return false;
                const name = e.name.toLowerCase();
                return name.includes("guguniu") || name.includes("render-") || name.includes("cowcoo") || name.includes("guguniu-gallery") || name.includes("gutools") || name.includes("cooweb");
            })
            .map(e => path.join(MiaoPluginMBT.Paths.TempHtmlPath, e.name));
        
        await Promise.all(targets.map(p => Ananke.obliterate(p)));
        return { count: targets.length };
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
        { type: "Temp", displayPath: "html_cache", action: cleanTempHtml }
    ];

    const results = await Promise.all(tasks.map(runTask));

    await MiaoPluginMBT.MetaMutex.run(async () => {
        MiaoPluginMBT.MBTConfig = {}; 
        MiaoPluginMBT._MetaCache = Object.freeze([]); 
        MBTCF.reset();
        MiaoPluginMBT._AliasData = null;
        MiaoPluginMBT.BootStrap = false;
        MiaoPluginMBT.InitPromise = null; 
        this.PFSCReady = false;
        MiaoPluginMBT._remoteBanCount = 0;
    });

    const failures = results
        .filter(r => !r.success)
        .map(r => `${r.type} ${r.path} (${r.error?.message || "Failed"})`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (failures.length === 0) {
        await e.reply(`重置完成！所有相关文件和缓存都清理干净啦 (耗时 ${duration}s)。`, true);
    } else {
        Hades.W(`重置过程存在部分失败:`, failures);
        const syntheticError = new Error(`部分清理任务失败:\n${failures.join('\n')}`);
        await DocHub.report(e, "重置咕咕牛 (部分失败)", syntheticError, `耗时: ${duration}s`);
    }

    return true;
  }

  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;
    const logger = HadesEntry({}, this.logger || getCore());
    const repo1Exists = await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath);
    if (!repo1Exists) return e.reply("咕咕牛的图库你还没下载呢！", true);

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
          name: ["一号仓库", "二号仓库", "三号仓库", "四号仓库"][parseInt(repo.name) - 1],
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
        headerImg: await Morpheus.pickHeader(),
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

      const Hades = HadesEntry({}, this.logger || getCore());
      const imgBuffer = await Morpheus.shot("Status", { 
          tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "tools", "status.html"),
          data: ViewProps,
          logger: Hades,
          pageBoundingRect: { selector: ".container" }
      });

        if (imgBuffer) {
            await e.reply(segment.image(imgBuffer));
        } else {
            await e.reply("状态图生成失败，请查看后台日志。", true);
        }
        await this._TriggerMapGeneration(e, Hades);
      } catch (error) {
        await DocHub.report(e, "咕咕牛状态或地图", error);
      }
      return true;
  }

  async _TriggerMapGeneration(e, logger) {
      const Hades = HadesEntry({}, logger || getCore());
      const tasks = [
          { key: "gs", width: 1400 },
          { key: "sr", width: 1400 },
          { key: "zzz", width: 1000, optional: true },
          { key: "waves", width: 1000, optional: true }
      ];

      const generatedImgs = [];
      
      const pluginRoots = {
          zzz: path.join(MiaoPluginMBT.Paths.YzPath, "plugins", "ZZZ-Plugin"),
          waves: path.join(MiaoPluginMBT.Paths.YzPath, "plugins", "waves-plugin")
      };
      
      for (const task of tasks) {
          if (task.optional) {
              const targetPluginPath = pluginRoots[task.key];
              if (!targetPluginPath || !(await Ananke.Audit(targetPluginPath))) {
                  continue;
              }
          }

          const imgBuffer = await this.MBTMapTileAss(e, task.key, task.width, Hades);
          
          if (imgBuffer) {
              generatedImgs.push(segment.image(imgBuffer));
              if (generatedImgs.length < tasks.length) await common.sleep(300);
          }
      }

      if (generatedImgs.length > 0) {
          if (generatedImgs.length === 1) await e.reply(generatedImgs[0]);
          else {
              try {
                  const msg = await common.makeForwardMsg(e, generatedImgs, "咕咕牛图库地图总览");
                  await e.reply(msg);
                  await common.sleep(1500); 
              } catch {
                  for (const img of generatedImgs) {
                      await e.reply(img);
                      await common.sleep(500); 
                  }
             }
          }
      }
  }

  async MBTMapTileAss(gameKey, renderWidth, logger) {
    const Hades = HadesEntry({}, logger || getCore());
    const strategy = Tianshu.GetStrategy(gameKey);
    if (!strategy) return null;
    const cerberus = Cerberus.getInstance(); 
    const signalTrap = MBTSignalTrap.getInstance();
    const BtnFaceUrl = Morpheus.getStaticImg("icon/null-btn.png");
    const elemGroups = {}; 
    const unknownGroupKey = 'unknown';
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
        const key = (elemKey !== 'unknown' && elemKey !== 'multi') ? elemKey : unknownGroupKey;
        const name = (key === unknownGroupKey) ? '未知' : elemName;

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
    const currentKeys = Object.keys(elemGroups).filter(k => k !== unknownGroupKey);
    const sortStrategyKeys = strategy.getSortKeys(currentKeys);
    
    if (Array.isArray(sortStrategyKeys)) {
        sortedKeys = sortStrategyKeys.filter(k => elemGroups[k]);
        currentKeys.forEach(k => { if(!sortedKeys.includes(k)) sortedKeys.push(k); });
    } else {
        sortedKeys = currentKeys;
    }
    if (elemGroups[unknownGroupKey]) sortedKeys.push(unknownGroupKey);

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
            logger: Hades    
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
    const logger = HadesEntry({}, this.logger || getCore());
    
    const getThumbPath = async (imgPath) => {
      const absolutePath = await MiaoPluginMBT.FsQuery(imgPath);
      return absolutePath ? `file://${absolutePath.replace(/\\/g, "/")}` : "";
    };

    const pageMatch = msg.match(/^#(?:ban|咕咕牛封禁)列表(?:\s*(\d+))?$/i);
    if (pageMatch) {
      if (!isMaster && (msg.startsWith("#咕咕牛封禁 ") || msg.startsWith("#咕咕牛解禁 "))) {
        return e.reply(`只有主人才能进行封禁或解禁操作哦~`, true);
      }

      const canContinue = await MiaoPluginMBT.OpsGate(e, 'MuB_List');
      if (!canContinue) return true;

      const activeBanCount = MBTCF.activeBanSet.size;
      if (activeBanCount === 0) return e.reply("当前没有任何图片被封禁。", true);

      await e.reply(`正在整理 ${activeBanCount} 项封禁记录，请稍候...`, true);
      
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
        
        if (imgBuffer) await e.reply(segment.image(imgBuffer));
        else await e.reply(`[❌ 手动封禁列表第 ${currentPage}/${pageCount} 页生成失败，请看日志]`);
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

          if (imgBuffer) forwardMsgs.push(segment.image(imgBuffer));
          else forwardMsgs.push(`[❌ 净化屏蔽列表第 ${currentPage}/${pflPageCount} 页生成失败]`);
        }

        if (forwardMsgs.length > 0) {
          try {
            const forwardMsg = await common.makeForwardMsg(e, forwardMsgs, `咕咕牛净化列表 (共${pflPageCount}页)`);
            await e.reply(forwardMsg);
          } catch (fwdError) {
            Hades.E(`创建合并消息失败:`, fwdError);
            for (const m of forwardMsgs) {
              await e.reply(m); await common.sleep(500);
            }
          }
        }
      }
      return true;
    }

    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i);
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i);

    if (addMatch || delMatch) {
      if (!isMaster) return e.reply(`只有主人才能进行封禁或解禁操作哦~`, true);

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
              await e.reply(reply, true);
            } else {
              await e.reply(`所有带 [${rawInput}] 标签的图片（共 ${already} 张）之前都已经被封禁啦，或者没找到该标签图片。`, true);
            }
          } catch (err) {
            Hades.E(`标签封禁失败:`, err);
            await e.reply("保存封禁列表失败，请查看日志。", true);
          }
          return true;
        }

        const parsedId = Tianshu.ParseID(rawInput);
        if (!parsedId) throw new Error("编号格式无效");

        const { mainName: rawMainName, imgNum: imgNum } = parsedId;
        const aliasResult = await Tianshu.NormalizeName(rawMainName);
        const primaryName = aliasResult.exists ? aliasResult.mainName : rawMainName;

        let imageData = null;
        const imagesForCharacter = Tianshu._indexByCRE.get(primaryName);
        if (imagesForCharacter && imagesForCharacter.length > 0) {
          const Fingerprint = `${primaryName.toLowerCase()}gu${imgNum}.webp`;
          imageData = imagesForCharacter.find((img) =>
            img.path?.toLowerCase().replace(/\\/g, "/").endsWith(`/${Fingerprint}`)
          );
        }

        if (!imageData || !imageData.path) throw new Error("图片未找到");

        const storagebox_type = imageData.storagebox_type;
        for (const [key, meta] of Object.entries(Nomos.Universe)) {
          if (storagebox_type === meta.dirName) {
            const pluginPath = meta.pluginPath;
            if (pluginPath && !(await Ananke.Audit(pluginPath))) {
               const missingPluginLabel = key === "zzz" ? "ZZZ-Plugin" : key === "waves" ? "waves-plugin" : "miao-plugin";
               throw new Error(`插件未安装:${missingPluginLabel}`);
            }
            break; 
          }
        }

        const RelativePath = imageData.path.replace(/\\/g, "/");
        const fileLabel = path.basename(RelativePath);

        try {
          if (isAdding) {
            await MBTCF.AddManualBan(RelativePath, logger);
            await e.reply(`${fileLabel} 🚫 封禁了~`, true);
          } else {
            await MBTCF.RemoveManualBan(RelativePath, logger);
            await e.reply(`${fileLabel} ✅️ 好嘞，解封!`, true);
            setImmediate(() => MiaoPluginMBT.RevertFile(RelativePath, logger));
          }
          setImmediate(() => MiaoPluginMBT.GenerateList(null, logger));
        } catch (err) {
          if (err.message === "TARGET_PURIFIED") {
            const level = MiaoPluginMBT.MBTConfig.PFL_Ops ?? DFC.PFL_Ops;
            await e.reply(`⚠️ ${fileLabel} 受到当前的净化规则 (等级 ${level}) 屏蔽，无法进行手动操作。`, true);
          } else if (err.message === "ALREADY_BANNED") {
            await e.reply(`${fileLabel} ❌️ 封禁已存在哦。`, true);
          } else if (err.message === "NOT_FOUND") {
            await e.reply(`${fileLabel} ❓ 没找到哦 (可能未被封禁)。`, true);
          } else {
            Hades.E(`${actionVerb}操作异常:`, err);
            await DocHub.report(e, `${actionVerb}图片`, err);
            await e.reply(`操作失败: ${err.message}`, true);
          }
        }

      } catch (err) {
        if (err.message === "输入为空") {
          return e.reply(`要${actionVerb}哪个图片呀？格式：#咕咕牛${actionVerb} 角色名+编号 或 #咕咕牛封禁 <二级标签>`, true);
        }
        if (err.message === "编号格式无效") {
          return e.reply("格式好像不对哦，应该是 角色名+编号 (例如：花火1)", true);
        }
        if (err.message === "图片未找到") {
          return e.reply(`在图库数据里没找到这个图片: ${rawInput}。\n(请检查角色名和编号是否准确，或角色是否存在于图库中)`, true);
        }
        if (err.message.startsWith("插件未安装")) {
          const pluginLabel = err.message.split(":")[1] || "miao-plugin";
          return e.reply(`图库数据无记录: ${rawInput}。\n(插件 ${pluginLabel} 未安装)`, true);
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
    if (!(await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath))) {
      return e.reply("咕咕牛的图库你还没下载呢！", true);
    }

    const msg = e.msg.replace(/^#咕咕牛查看\s*/i, "").trim();
    const data = await Tianshu.Search(msg);
    if (!data) return true;

    if (data.type === 'dashboard') {
        return Presenter.RenderDashboard(e, data.stats);
    }

    if (!(await MiaoPluginMBT.OpsGate(e, 'QueryData'))) return true;

    if (data.type === 'help') return e.reply("想看哪个角色呀？格式：#咕咕牛查看 角色名/游戏名/标签 或 #咕咕牛查看 原神 火", true);
    if (data.type === 'empty') return e.reply(data.msg, true);

    if (data.type === 'game_group') {
      await e.reply(`收到！将发送 ${data.title} 的 ${data.items.length} 个角色图库...`, true);
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
    if (!match?.[1]) return e.reply("想可视化哪个角色呀？格式：#可视化角色名", true);
    const roleNameInput = match[1].trim();

    let primaryName = "";
    const logger = HadesEntry({}, this.logger || getCore());

    try {
      const aliasResult = await Tianshu.NormalizeName(roleNameInput);
      primaryName = aliasResult.mainName || roleNameInput;

      let roleFolderPath = null;
      const SearchPaths = [MiaoPluginMBT.Paths.Target.MiaoCRE, MiaoPluginMBT.Paths.Target.ZZZCRE, MiaoPluginMBT.Paths.Target.WavesCRE].filter(Boolean);
      for (const targetDir of SearchPaths) {
        if (!targetDir) continue;
        const potentialPath = path.join(targetDir, primaryName);
        if (await Ananke.Audit(potentialPath)) {
            roleFolderPath = potentialPath; 
            break; 
        }
      }

      if (!roleFolderPath) { Hades.W(`未在任何目标插件目录中找到角色 '${primaryName}' 的文件夹。`); return e.reply(`『${primaryName}』不存在，可能是未同步/无该角色？`); }

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
        return e.reply(`『${primaryName}』的文件夹里没有找到支持的图片文件哦。`);
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

      await e.reply(waitMsg, true);
      await common.sleep(500);
      
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        await MiaoPluginMBT.OpsGate(e, 'VisRoleSplashes_Page');

        const startIndex = (pageNum - 1) * PAGE_SIZE;
        const currentFiles = allimgFiles.slice(startIndex, startIndex + PAGE_SIZE);

        const VisCharaterdata = currentFiles.map((fileName, index) => ({
          fileName: fileName.replace(/\.\w+$/, ""),
          filePath: `file://${path.join(roleFolderPath, fileName).replace(/\\/g, "/")}`,
          originalIndex: startIndex + index,
          isGu: /gu/i.test(fileName)
        }));

        const PluginRolePath = roleFolderPath.replace(/\\/g, '/').toLowerCase();
        const miaoRoot = MiaoPluginMBT.Paths.MiaoPluginPath.replace(/\\/g, '/').toLowerCase();
        const zzzRoot = MiaoPluginMBT.Paths.ZZZPluginPath.replace(/\\/g, '/').toLowerCase();
        const wavesRoot = MiaoPluginMBT.Paths.WavesPluginPath.replace(/\\/g, '/').toLowerCase();
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
            await e.reply(segment.image(imgBuffer));
        } else {
            await e.reply(`[❌ 第 ${pageNum}/${pageCount} 部分生成失败，请看日志]`, true);
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

    if (!(await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath))) {
        return e.reply("『咕咕牛』核心库还没下载呢！", true);
    }

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i);
    if (!match?.[1]) return e.reply("要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)", true);

    const rawInput = match[1].trim();
    const logger = HadesEntry({}, this.logger || getCore());

    try {
        const parsedId = Tianshu.ParseID(rawInput);
        if (!parsedId) return e.reply("格式好像不对哦，应该是 角色名+编号，比如：花火1", true);

        const { mainName: rawMainName, imgNum } = parsedId;
        const aliasResult = await Tianshu.NormalizeName(rawMainName);
        const primaryName = aliasResult.exists ? aliasResult.mainName : rawMainName;

        const charImages = Tianshu._indexByCRE.get(primaryName);

        if (!charImages || charImages.length === 0) {
             const hint = Tianshu._indexByGid.size === 0 ? "(图库数据为空)" : "(未找到该角色的图片数据)";
             return e.reply(`在图库数据里没找到角色: ${primaryName}。\n${hint}`, true);
        }

        const targetSuffix = `gu${imgNum}.webp`;
        const imageData = charImages.find(img =>
            img.path?.toLowerCase().endsWith(targetSuffix)
        );

        if (!imageData) {
            return e.reply(`找到了角色 '${primaryName}'，但没有找到编号 ${imgNum} 的图片。`, true);
        }

        const relativePath = imageData.path.replace(/\\/g, "/");
        const targetFileName = path.basename(relativePath);
        const absolutePath = await Tianshu.FsQuery(relativePath);

        if (!absolutePath) {
            return e.reply(`糟糕，数据库里有记录，但物理文件找不到了：${targetFileName}`, true);
        }

        const fileBuffer = await Ananke.readFile(absolutePath).catch(err => {
            throw new Error(`文件读取失败: ${err.message}`);
        });

        await e.reply(`📦 导出成功！给你 -> ${targetFileName}`);
        await common.sleep(200);

        try {
            await e.reply(segment.file(fileBuffer, targetFileName));
        } catch (sendErr) {
            const errMsg = (sendErr.message || "").toLowerCase();
            if (errMsg.includes("highway") || errMsg.includes("file size") || sendErr.code === -36 || sendErr.code === 210005) {
                await e.reply(`发送失败：文件通道异常 (Code: ${sendErr.code})，可能是文件过大或被风控。`, true);
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
    const isInstalled = await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath);
    const logger = HadesEntry({}, this.logger || getCore());
    
    let HelpTpl = "";
    const tplResult = await Hermes.getTemplate('help.html', logger);
    if (tplResult.success && tplResult.data) {
        HelpTpl = tplResult.data;
    } else {
        Hades.E(`高危: 帮助模板无法获取！`);
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
              ? `file://${MiaoPluginMBT.Paths.OpsPath}/`.replace(/\\/g, '/')
              : 'https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/'
        };

        const imgBuffer = await Morpheus.shot("Help", { 
            htmlContent: HelpTpl,
            data: ViewProps, 
            logger: logger, 
            screenshotOps: { fullPage: true } 
        });

        if (imgBuffer) { 
          await e.reply(segment.image(imgBuffer)); 
        } else { 
          throw new Error("生成帮助图片失败 (返回空 Buffer)"); 
        }
      } catch (renderErr) {
        Hades.E(`生成帮助图片时出错:`, renderErr);
        HelpTpl = ""; 
      }
    }

    if (!HelpTpl) {
      let ReliefText = "『咕咕牛帮助手册』\n";
      ReliefText += "--------------------\n";
      ReliefText += "【图库安装】\n";
      ReliefText += "  #下载咕咕牛: 自动测速选择合适节点下载\n";
      ReliefText += "  #更新咕咕牛: 手动执行更新\n";
      ReliefText += "\n";
      ReliefText += "【图库操作】\n";
      ReliefText += "  #启/禁用咕咕牛: 管理图库同步\n";
      ReliefText += "  #咕咕牛状态: 查看本地参数\n";
      ReliefText += "  #咕咕牛查看[角色名]: 查看角色图片\n";
      ReliefText += "  #咕咕牛导出[角色名+编号]: 导出图片文件\n";
      ReliefText += "  #可视化[角色名]: 显示面板图\n";
      ReliefText += "  #重置咕咕牛: 清理图库文件\n";
      ReliefText += "\n";
      ReliefText += "【封禁与设置】\n";
      ReliefText += "  #咕咕牛封/解禁[角色名+编号]: 管理单张图片\n";
      ReliefText += "  #咕咕牛封禁列表: 显示封禁图片\n";
      ReliefText += "  #咕咕牛设置净化等级[0-2]: 过滤敏感内容\n";
      ReliefText += "  #咕咕牛面板: 查看设置状态\n";
      ReliefText += "  #咕咕牛设置[xx][开启/关闭]: Ai/彩蛋/横屏等\n";
      ReliefText += "--------------------\n";
      ReliefText += `Miao-Plugin-MBT v${Version}`;
      await e.reply(ReliefText, true);
    }

    return true;
  }

  async MBTOpsDeck(e, StatusMsg = "") {
    if (!(await this.CheckInit(e))) return true;
    const logger = HadesEntry({}, this.logger || getCore());
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
            headerImg: await Morpheus.pickHeader(),
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
            await e.reply(segment.image(imgBuffer));
        } else {
            const fallbackMsg = StatusMsg
                ? `${StatusMsg}\n(面板渲染失败，请检查日志)`
                : `设置面板生成失败，请查看后台日志。`;
            await e.reply(fallbackMsg, true);
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
    if (!e.isMaster) return e.reply(`只有主人才能使用设置命令哦~`, true);

    if (!(await Ananke.Audit(MiaoPluginMBT.Paths.GitFilePath))) {
        return e.reply("『咕咕牛🐂』图库未下载，请先发送 #下载咕咕牛", true);
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
    const logger = HadesEntry({}, this.logger || getCore());
    const strategies = {
        '总开关': {
            cfgKey: 'Repo_Ops',
            name: '图库总开关',
            parse: (v) => {
                if (v !== '开启' && v !== '关闭') throw new Error("只能是开启或关闭");
                return v === '开启';
            },
            sideEffect: async (enable) => {
                const opName = enable ? "同步/挂载" : "清理/卸载";
                Hades.D(`[后台任务] 开始执行图库${opName}...`);
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
                        const TARGETS = [
                            MiaoPluginMBT.Paths.Target.MiaoCRE,
                            MiaoPluginMBT.Paths.Target.ZZZCRE,
                            MiaoPluginMBT.Paths.Target.WavesCRE
                        ];
                        await Promise.all(TARGETS.map(dir => Ananke.purge(dir, logger).catch(() => {})));
                    }
                    Hades.D(`[后台任务] 图库${opName}完成。`);
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
            sideEffect: async () => {
                Hades.D(`PFL 变更，正在重新计算封禁列表...`);
                try {
                    await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, logger);
                    if (MiaoPluginMBT.MBTConfig.Repo_Ops) await MiaoPluginMBT.SCD(logger);
                } catch (err) {
                    Hades.E(`PFL 应用失败:`, err);
                }
            }
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
            parse: (v) => {
                if (v !== '开启' && v !== '关闭') throw new Error("只能是开启或关闭");
                return v === '开启';
            },
            sideEffect: async () => {
                Hades.D(`SR18 状态变更，正在重新计算资源...`);
                try {
                    await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, logger);
                    if (MiaoPluginMBT.MBTConfig.Repo_Ops) await MiaoPluginMBT.SCD(logger);
                } catch (err) {
                    Hades.E(`SR18 应用失败:`, err);
                }
            }
        }
    };

    ['ai', '彩蛋', '横屏', '官方立绘'].forEach(k => {
        const map = {
            'ai': { k: 'Ai', n: 'Ai 图' },
            '彩蛋': { k: 'EasterEgg', n: '彩蛋图' },
            '横屏': { k: 'layout', n: '横屏图' },
            '官方立绘': { k: 'MihoyoSplash', n: '官方立绘同步' }
        };
        strategies[k] = {
            cfgKey: map[k].k,
            name: map[k].n,
            parse: (v) => {
                if (v !== '开启' && v !== '关闭') throw new Error("只能是开启或关闭");
                return v === '开启';
            },
            sideEffect: async () => {
                try {
                    await MiaoPluginMBT.GenerateList(MiaoPluginMBT._MetaCache, logger);
                } catch (err) {
                    Hades.E(`[后台任务] 更新封禁表失败:`, err);
                }
            }
        };
    });

    const strategy = strategies[key];
    if (!strategy) return false;

    let parsedVal;
    try {
        parsedVal = strategy.parse(valRaw);
    } catch (err) {
        return e.reply(`无效参数: ${err.message}`, true);
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
        name: '『咕咕牛🐂』原图管理 ',
        event: 'message',
        priority: -100,
        rule: [
          { reg: /^#?原图$/, fnc: 'PreemptPh' },
          { reg: /^#原图([\s\S]+)$/, fnc: 'debugImg', permission: 'master' },
          { reg: /^(?:\[reply:[^\]]+\]\n?)?#?原图$/, fnc: 'PreemptPh' },
        ],
      });
      this.task = { fnc: () => { }, log: false };
    }

    async debugImg(e) {
      const Hades = HadesEntry();
      const sourceMsgId = e.msg.replace(/^#原图/, '').trim();

      const replyReg = /^\[reply:(.+?)\]\n?/;
      let replyId = null;
      let msg = e.msg;

      const match = msg.match(replyReg);
      if (match) {
        replyId = match[1];
        msg = msg.replace(replyReg, '');
      }

      if (!sourceMsgId) {
        await e.reply("调试命令格式错误，请使用 #原图<消息ID>", true);
        return true;
      }

      Hades.O(`[SleeperAgent-Debug] 收到调试指令，目标消息ID: ${sourceMsgId}`);
      const processed = await SleeperAgent._interrogate(e, sourceMsgId);

      if (!processed) {
        await e.reply(`[SleeperAgent-Debug] 未能为ID [${sourceMsgId}] 找到任何原图信息。`, true);
      }

      return true;
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
                const imgSegment = segment.image(imgPath.startsWith('http') ? absolutePath : `file://${absolutePath.replace(/\\/g, "/")}`);

                const forwardList = [promptText, imgSegment];
                const forwardMsg = await common.makeForwardMsg(e, forwardList, `原图 - ${fileName}`);
                await e.reply(forwardMsg);
                await common.sleep(300);
                await e.reply(segment.at(e.user_id), false, { recallMsg: 15 });
              } catch {
                await e.reply(`无法获取原图，请稍后再试。`, true);
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

class CommunityMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』社区图库管理器',
            dsc: '管理社区图库资源',
            event: 'message',
            priority: 101,
            rule: [
                { reg: /^#咕咕牛安装\s*(.+)$/i, fnc: "CommIns", permission: "master" },
                { reg: /^#咕咕牛更新\s*.+$/i, fnc: "CommSync", permission: "master" },
                { reg: /^#咕咕牛卸载\s*.+$/i, fnc: "CommUn", permission: "master" },
                { reg: /^#咕咕牛列表$/i, fnc: "CommList", permission: "master" },
                { reg: /^#咕咕牛(安装|更新|安|更)/i, fnc: "CommSyncTip", permission: "master", priority: 102 }
            ]
        });
        this.logger = HadesEntry();
        const repoRoot = path.join(YzPath, "resources", "CowCooRepos");
        this.paths = { 
            base: path.join(repoRoot, "Community"), 
            ConfigFile: path.join(repoRoot, "Community", "config.json") 
        };
        this.config = {};
        this.mutex = new Metis('CommunityRepo', this.logger);
        this._loadConfig();

        this.task = {
            name: `『咕咕牛🐂』社区图库定时同步`,
            cron: '0 0 4 * * 0',
            fnc: QuantumFlux(() => this.CommCronUp()),
            log: true
        };
    }

    async _loadConfig() {
        try {
            this.config = await Ananke.HydrateJson(this.paths.ConfigFile, {});
        } catch {
            this.logger.debug(`配置文件初始化重置`);
            this.config = {};
        }
        return this.config;
    }

    async _saveConfig() {
        return Ananke.FlushJson(this.paths.ConfigFile, this.config).catch(e => {
            this.logger.error("配置保存失败", e);
            return false;
        });
    }
    
    async CommCronUp() {
        this.logger.info(`开始执行每周定时更新...`);
        try {
            await this.mutex.run(async () => {
                await this._loadConfig();
                for (const alias in this.config) {
                    try {
                        const { folderName } = this.config[alias];
                        const repoPath = path.join(this.paths.base, folderName);
                        
                        this.logger.debug(`正在更新: ${alias}`);
                        await MBTPipeControl("git", ["pull"], { cwd: repoPath }, DFC.PullTimeout);
                        
                        const { syncedCount } = await this._syncRepo(alias);
                        this.logger.debug(`${alias} 更新完成，同步了 ${syncedCount} 个文件。`);
                    } catch (error) {
                        this.logger.error(`定时更新 ${alias} 失败:`, error);
                    }
                }
            }, { id: 'CronUp', ttl: 600000, instant: true, priority: 30 });
        } catch (e) {
            if (e.code !== 'METIS_BUSY') this.logger.error(`定时更新任务异常:`, e);
        }
    }

    async CommSyncTip(e) {
        const helpMsg = [
            "『社区图库指令』",
            "安装：#咕咕牛安装 [URL]:[别名]",
            "更新：#咕咕牛更新 [别名/全部]",
            "卸载：#咕咕牛卸载 [别名]",
            "列表：#咕咕牛列表",
            "示例：#咕咕牛安装 https://github.com/user/repo:我的图库"
        ];
        await e.reply(helpMsg.join('\n'), true);
        return true;
    }

    _resolveRepoInfo(input) {
        try {
            const lastColonIndex = input.lastIndexOf(':');
            let url = input, alias;
            
            if (lastColonIndex > 5) {
                url = input.substring(0, lastColonIndex).trim();
                alias = input.substring(lastColonIndex + 1).trim();
            }
            
            url = url.trim();
            alias = alias || url.split('/').pop().replace(/\.git$/i, '') || `Repo_${Date.now()}`;
            
            const urp = url.match(/github\.com\/([^/]+\/[^/.]+)/i)?.[1]?.replace(/\.git$/i, '');
            return { url, alias, urp, isGitHub: !!urp };
        } catch {
            return { url: input, alias: `Repo_${Date.now()}`, isGitHub: false };
        }
    }

    async _CommMetaAC(repoUrl) {
        try {
            const [, platform, owner, repo] = repoUrl.match(/^(?:https?:\/\/)?(?:www\.)?(github\.com|gitee\.com|gitcode\.(?:com|net))\/([^/]+)\/([^/]+)/) || [];
            if (!platform) return null;

            const repoName = repo.replace(/\.git$/, '');
            const apiMap = {
                'github.com': `https://api.github.com/repos/${owner}/${repoName}`,
                'gitee.com': `https://gitee.com/api/v5/repos/${owner}/${repoName}`,
                'gitcode': `https://gitcode.net/api/v4/projects/${encodeURIComponent(`${owner}/${repoName}`)}`
            };
            
            const apiUrl = apiMap[platform.startsWith('gitcode') ? 'gitcode' : platform];
            if (!apiUrl) return null;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);
            
            try {
                const response = await fetch(apiUrl, { 
                    signal: controller.signal, 
                    headers: { 'User-Agent': 'CowCoo-Repos-Manager' } 
                });
                if (!response.ok) throw new Error(response.statusText);
                
                const data = await response.json();
                const ownerInfo = data.namespace || data.owner;

                return {
                    ownerName: ownerInfo?.name || ownerInfo?.login,
                    ownerAvatarUrl: ownerInfo?.avatar_url
                };
            } finally {
                clearTimeout(timeoutId);
            }
        } catch { 
            return null;
        }
    }

    async initMBT(e) {
        try {
            if (!MiaoPluginMBT.BootStrap) {
                await MiaoPluginMBT.init(this.logger);
                await MiaoPluginMBT.InitPromise;
                if (!MiaoPluginMBT.BootStrap) throw new Error("主插件初始化未完成");
            }

            if (!MiaoPluginMBT._AliasData?.combined || Object.keys(MiaoPluginMBT._AliasData.combined).length === 0) {
                await MiaoPluginMBT.MetaHub.AC(true);
                if (!MiaoPluginMBT._AliasData?.combined || Object.keys(MiaoPluginMBT._AliasData.combined).length === 0) {
                    throw new Error("别名库为空，无法进行角色识别，请先执行 #更新咕咕牛。");
                }
            }
            return true;
        } catch (err) {
            this.logger.error(`初始化检查失败:`, err);
            if (e) await e.reply(err.message || "插件尚未就绪，操作已取消。", true);
            return false;
        }
    }

    async _ScanStruct(repoPath) {
        const allDirs = [];
        const queue = [repoPath];
        while (queue.length > 0) {
            const curr = queue.shift();
            allDirs.push(curr);
            try {
                const entries = await Ananke.readDir(curr);
                for (const e of entries) {
                    if (e.isDirectory() && !e.name.startsWith('.')) {
                        queue.push(path.join(curr, e.name));
                    }
                }
            } catch {}
            if (allDirs.length > 20) break;
        }

        const scored = await Promise.all(allDirs.map(async (dir) => {
            try {
                const subdirs = (await Ananke.readDir(dir)).filter(e => e.isDirectory());
                if (subdirs.length === 0) return { path: dir, score: 0 };
                const checks = await Promise.all(subdirs.map(s => Tianshu.NormalizeName(s.name)));
                return { path: dir, score: checks.filter(r => r.exists).length };
            } catch {
                return { path: dir, score: 0 };
            }
        }));

        scored.sort((a, b) => b.score - a.score);
        if (scored[0] && scored[0].score >= 2) {
            return { structureType: scored[0].path === repoPath ? "root" : "subdir", sourcePath: scored[0].path };
        }
        return { structureType: "root", sourcePath: repoPath };
    }

    async _analyzeContent(sourcePath) {
        const map = { gs: 0, sr: 0, zzz: 0, waves: 0, unknown: 0, unknownFolders: [] };
        
        const checkList = [
            { key: 'gs', source: 'GSAlias' },
            { key: 'sr', source: 'SRAlias' },
            { key: 'zzz', source: 'ZZZAlias' },
            { key: 'waves', source: 'WavesAlias' }
        ];

        try {
            const entries = await Ananke.readDir(sourcePath);
            for (const e of entries) {
                if (!e.isDirectory()) continue;

                const { exists, mainName } = await Tianshu.NormalizeName(e.name);
                if (!exists) {
                    map.unknown++;
                    map.unknownFolders.push(e.name);
                    continue;
                }

                const matched = checkList.find(item => MiaoPluginMBT._AliasData[item.source]?.[mainName]);
                if (matched) {
                    map[matched.key]++;
                } else {
                    map.unknown++;
                }
            }
        } catch {}
        return map;
    }

    async _getManifestPath(alias) {
        try {
            return path.join(this.paths.base, this.config[alias].folderName, 'sync_manifest.json');
        } catch {
            return null;
        }
    }

    async _loadSyncManifest(alias) {
        try {
            const manifestPath = await this._getManifestPath(alias);
            return await Ananke.HydrateJson(manifestPath, []);
        } catch {
            return [];
        }
    }

    async _saveSyncManifest(alias, fileList) {
        try {
            const manifestPath = await this._getManifestPath(alias);
            return await Ananke.FlushJson(manifestPath, fileList);
        } catch {
            return false;
        }
    }

    async _syncRepo(alias) {
        try {
            const { folderName } = this.config[alias];
            const localRepoPath = path.join(this.paths.base, folderName);

            await this._RevertSync(alias).catch(() => {});
            
            const { sourcePath } = await this._ScanStruct(localRepoPath);
            const targetPaths = {
                gs: MiaoPluginMBT.Paths.Target.MiaoCRE,
                sr: MiaoPluginMBT.Paths.Target.MiaoCRE,
                zzz: MiaoPluginMBT.Paths.Target.ZZZCRE,
                waves: MiaoPluginMBT.Paths.Target.WavesCRE,
            };

            const syncTasks = []; 
            const syncManifest = []; 
            const imgExtens = new Set(['.webp', '.png', '.jpg', '.jpeg']);

            const characterFolders = await Ananke.readDir(sourcePath);

            for (const charEntry of characterFolders) {
                if (!charEntry.isDirectory()) continue;

                const charName = charEntry.name;
                const aliasResult = await Tianshu.NormalizeName(charName);
                if (!aliasResult.exists) continue;

                const gameKey = ['gs', 'sr', 'zzz', 'waves'].find(
                    key => MiaoPluginMBT._AliasData[`${key.toUpperCase()}Alias`]?.[aliasResult.mainName]
                ) || 'unknown';

                const targetDir = targetPaths[gameKey];
                if (!targetDir) continue;

                const sourceCharDir = path.join(sourcePath, charName);
                const destCharDir = path.join(targetDir, charName);
                
                await Ananke.mkdirs(destCharDir).catch(()=>{});

                const imgFiles = await Ananke.readDir(sourceCharDir);
                
                for (const imgEntry of imgFiles) {
                    if (imgExtens.has(path.extname(imgEntry.name).toLowerCase())) {
                        const prefixedFileName = `C-${alias}-${imgEntry.name}`;
                        syncTasks.push({ 
                            src: path.join(sourceCharDir, imgEntry.name), 
                            dest: path.join(destCharDir, prefixedFileName) 
                        });
                        syncManifest.push({
                            gameKey,
                            relativePath: path.join(charName, prefixedFileName)
                        });
                    }
                }
            }

            if (syncTasks.length > 0) {
                this.logger.debug(`正在同步 ${syncTasks.length} 个文件...`);
                await Ananke.dispatchSync(syncTasks, this.logger);
            }

            await this._saveSyncManifest(alias, syncManifest);
            
            if (this.config[alias]) this.config[alias].lastSync = new Date().toISOString();
            
            return { success: true, syncedCount: syncTasks.length };

        } catch (e) {
            this.logger.error(`同步异常: ${alias}`, e);
            return { success: false, syncedCount: 0 };
        }
    }

    async _RevertSync(alias) {
        try {
            const manifest = await this._loadSyncManifest(alias);
            if (!manifest?.length) return;

            const targetPaths = {
                gs: MiaoPluginMBT.Paths.Target.MiaoCRE,
                sr: MiaoPluginMBT.Paths.Target.MiaoCRE,
                zzz: MiaoPluginMBT.Paths.Target.ZZZCRE,
                waves: MiaoPluginMBT.Paths.Target.WavesCRE,
            };

            let cleanedCount = 0;
            const obliteratePromises = manifest.map(async fileInfo => {
                try {
                    const targetDir = targetPaths[fileInfo.gameKey];
                    if (targetDir) {
                        await Ananke.obliterate(path.join(targetDir, fileInfo.relativePath));
                        cleanedCount++;
                    }
                } catch {}
            });
            
            await Promise.all(obliteratePromises);
            
            this.logger.debug(`为 ${alias} 清理了 ${cleanedCount} 个已同步文件。`);
            await this._saveSyncManifest(alias, []);
        } catch (e) {
            this.logger.warn(`RevertSync failed for ${alias}`, e);
        }
    }

    _CommResolve(url) {
        try {
            const match = url.match(/^(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitee\.com|gitcode\.com|gitcode\.net)\/([^/]+)\/([^/.]+)(?:\.git)?$/i);
            return match ? `${match[1]}-${match[2]}` : null;
        } catch { return null; }
    }

    async CommIns(e) {
        if (!(await this.initMBT(e))) return true;
        
        try {
            const input = e.msg.replace(/^#咕咕牛安装\s*/i, '').trim();
            if (!input) return this.CommSyncTip(e);

            const { url, alias, urp, isGitHub } = this._resolveRepoInfo(input);
            const folderName = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
            const targetPath = path.join(this.paths.base, folderName);

            await this.mutex.run(async (signal) => {
                await this._loadConfig();
                if (this.config[alias]) throw new Error(`别名 [${alias}] 已存在，请更换别名或先卸载旧库。`);

                await e.reply(`正在初始化社区仓库安装程序...\n别名：${alias}\n源地址：${url}`, true);
                await Ananke.mkdirs(this.paths.base);

                if (isGitHub) {
                    const HttpResultMap = await MiaoPluginMBT.TestCaVoice(this.logger);
                    const gitTestPromises = HttpResultMap.map(node =>
                        MiaoPluginMBT.TestGitVoice(node.ClonePrefix, node.name, this.logger)
                            .then(gitResult => ({ name: node.name, gitResult }))
                    );
                    const sortedNodes = await MiaoPluginMBT.AdaptiveSpeed(HttpResultMap, await Promise.all(gitTestPromises), this.logger);

                    const runtimeContext = new RuntimeCtx();
                    const envData = await Hermes.getEnvInfo(this.logger);
                    const bestMirror = sortedNodes.find(n => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
                    const mirrorSpeed = bestMirror ? (bestMirror.time || Infinity) : Infinity;
                    const senseChain = await Proteus.sense(envData, mirrorSpeed, this.logger);
                    runtimeContext.vectors = senseChain.vector;
                    runtimeContext.decision = senseChain;

                    const downloadResult = await MiaoPluginMBT.SmartTaskHeavy(
                        runtimeContext, `Comm-${alias}`, `https://github.com/${urp}.git`, 'main', targetPath, e, this.logger, sortedNodes, MiaoPluginMBT.MBTProcc
                    );
                    
                    if (!downloadResult.success) throw downloadResult.error || new Error("GitHub 链路调度失败");
                } else {
                    await MBTPipeControl("git", ["clone", "--depth=1", url, targetPath], {
                        cwd: YzPath, signal
                    }, DFC.GitTimeout);
                }

                await MiaoPluginMBT.MetaHub.AC(true);
                const { sourcePath, structureType } = await this._ScanStruct(targetPath);
                
                this.config[alias] = {
                    url, folderName, structureType,
                    contentMap: await this._analyzeContent(sourcePath),
                    installDate: new Date().toISOString(),
                    lastSync: new Date().toISOString()
                };

                const { syncedCount } = await this._syncRepo(alias);
                await this._saveConfig();
                
                await e.reply(`社区图库 [${alias}] 安装完成。\n同步文件数：${syncedCount}\n结构类型：${structureType}`, true);

            }, { id: `CommIns:${alias}`, ttl: 600000, priority: 10 });

        } catch (err) {
            this.logger.error(`安装失败:`, err);
            try { 
                const folderName = crypto.createHash('md5').update(this._resolveRepoInfo(e.msg).url).digest('hex').substring(0, 8);
                await Ananke.obliterate(path.join(this.paths.base, folderName));
            } catch {}
            
            await e.reply(`社区图库安装中止。\n原因：${err.message || "未知系统异常"}`, true);
        }
        return true;
    }

    async _CommOps(e, title, alias, syncedCount) {
        try {
            const repoInfo = this.config[alias];
            if (!repoInfo) return; 

            const imgBuffer = await Morpheus.shot("comm-ops", {
                tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "community", "comm_ops.html"),
                data: {
                    title, alias, syncedCount,
                    url: repoInfo.url,
                    ownerName: repoInfo.ownerName || '未知作者',
                    ownerAvatarUrl: repoInfo.ownerAvatarUrl,
                },
                logger: this.logger,
                pageBoundingRect: { selector: ".container-wrapper" }
            });

            if (imgBuffer) await e.reply(segment.image(imgBuffer));
            else throw new Error("图片生成失败");

        } catch {
            await e.reply(`${title} [${alias}]，同步文件数：${syncedCount}。`);
        }
    }

    async CommSync(e) {
        if (!(await this.initMBT(e))) return true;

        await this.mutex.run(async () => {
            try {
                const match = e.msg.match(/^#咕咕牛更新\s*(.+)$/i);
                if (!match) return;
                const alias = match[1].trim();

                await this._loadConfig();
                const isAll = alias.toLowerCase() === '全部';
                const targets = isAll ? Object.keys(this.config) : [alias];

                if (!isAll && !this.config[alias]) throw new Error(`未找到别名为 [${alias}] 的仓库。`);
                if (targets.length === 0) throw new Error("当前没有安装任何仓库");

                await e.reply(`开始更新：${alias}`, true);

                for (const a of targets) {
                    try {
                        const { folderName } = this.config[a];
                        const repoPath = path.join(this.paths.base, folderName);
                        
                        await MBTPipeControl("git", ["pull"], { cwd: repoPath }, DFC.PullTimeout);
                        
                        const { sourcePath } = await this._ScanStruct(repoPath);
                        this.config[a].contentMap = await this._analyzeContent(sourcePath);
                        
                        const { syncedCount } = await this._syncRepo(a);
                        await this._saveConfig();
                        await this._CommOps(e, "更新完成", a, syncedCount);
                    } catch (err) {
                        await DocHub.report(e, `更新社区图库 ${a}`, err, '', this);
                    }
                }
            } catch (err) {
                await e.reply(err.message, true);
            }
        }, { priority: 10 });
        return true;
    }

    async CommUn(e) {
        if (!(await this.initMBT(e))) return true;
        
        await this.mutex.run(async () => {
            try {
                const alias = e.msg.match(/^#咕咕牛卸载\s*(.+)$/i)?.[1]?.trim();
                if (!alias) return;

                await this._loadConfig();
                const repoInfo = this.config[alias];
                if (!repoInfo) throw new Error(`未找到别名为 [${alias}] 的仓库。`);

                await e.reply(`开始卸载：${alias}，正在清理文件...`, true);

                await this._RevertSync(alias);
                await Ananke.obliterate(path.join(this.paths.base, repoInfo.folderName));
                
                delete this.config[alias];
                await this._saveConfig();
                
                await e.reply(`社区图库 [${alias}] 已完全卸载。`, true);
            } catch (err) {
                await DocHub.report(e, `卸载社区图库`, err, '', this);
            }
        }, { priority: 10 });
        return true;
    }

    async CommList(e) {
        if (!(await this.initMBT(e))) return true;

        await this.mutex.run(async () => {
            try {
                await this._loadConfig();
                const displayConfig = { ...this.config };
                
                Object.entries(Repos_List || {}).forEach(([alias, info]) => {
                    if (!displayConfig[alias]) displayConfig[alias] = { ...info, notIns: true };
                });

                if (Object.keys(displayConfig).length === 0) throw new Error("当前未安装任何社区图库。");

                const repoList = await Promise.all(Object.entries(displayConfig).map(async ([alias, info]) => {
                    let size = 0;
                    try {
                        if (!info.notIns && info.folderName) {
                            size = await Ananke.measure(path.join(this.paths.base, info.folderName));
                        }
                    } catch {}

                    const platform = info.url?.match(/(github|gitee|gitcode)/)?.[0] || 'unknown';
                    
                    const hasRecognized = !info.notIns && ['gs', 'sr', 'zzz', 'waves'].some(k => (info.contentMap?.[k] || 0) > 0);

                    return {
                        alias, ...info, platform, hasRecognized,
                        CommRepoSize: info.notIns ? 'N/A' : await Ananke.measure(size, true),
                        CommlastSync: info.notIns ? 'N/A' : new Date(info.lastSync).toLocaleString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                        ComminsDate: info.notIns ? '未安装' : new Date(info.installDate).toLocaleString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    };
                }));

                repoList.sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0) || a.alias.localeCompare(b.alias, 'zh-CN'));

                const imgBuffer = await Morpheus.shot("comm-list", {
                    tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "html", "community", "comm_list.html"),
                    data: { repos: repoList },
                    logger: this.logger,
                    pageBoundingRect: { selector: ".container-wrapper" }
                });

                if (imgBuffer) await e.reply(segment.image(imgBuffer));
                else throw new Error("列表生成失败");

            } catch (err) {
                await e.reply(err.message || "获取列表失败", true);
            }
        }, { priority: 20 });
        return true;
    }
}

const CowCoo_Rules = [
  { reg: /^#下载咕咕牛$/i, fnc: "Provision", permission: "master" },
  { reg: /^#更新咕咕牛$/i, fnc: "Reconcile", permission: "master" },
  { reg: /^#重置咕咕牛$/i, fnc: "ManRepo", permission: "master" },
  { reg: /^#咕咕牛状态$/i, fnc: "CheckStatus" },
  { reg: /^#(?:(?:ban|咕咕牛封禁)列表|咕咕牛(?:封禁|解禁)\s*.+)$/i, fnc: "MuB", permission: "master" },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: "ExPhFile" },
  { reg: /^#咕咕牛查看\s*.*$/i, fnc: "QueryData" },
  { reg: /^#咕咕牛帮助$/i, fnc: "Help" },
  { reg: /^#咕咕牛测速$/i, fnc: "TestVoice" },
  { reg: /^#(咕咕牛设置|咕咕牛面板)$/i, fnc: "MBTOpsDeck" },
  { reg: /^#(?:(启用|禁用)咕咕牛|咕咕牛设置(ai|彩蛋|横屏|净化等级|渲染精度|SR18)(开启|关闭|[0-9]+))$/i, fnc: "RouteOpsHub", permission: "master" },
  { reg: /^#可视化\s*.+$/i, fnc: "VisSplashes" },
];

setTimeout(async () => {
    try {
        await MiaoPluginMBT.init(Hades);
    } catch (err) {
        Hades.E(`咕咕牛图库管理器启动失败:`, err);
    }
}, 100);

const apps = { MiaoPluginMBT, SleeperAgent, CommunityMBT };
export { apps, MiaoPluginMBT, SleeperAgent, CommunityMBT, MBTPagination };
