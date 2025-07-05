import fs from "node:fs";
import lodash from "lodash";
import os from "node:os";
import fsPromises from "node:fs/promises";
import { statfs } from 'node:fs/promises';
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import yaml from "yaml";
import crypto from "node:crypto";
import template from "art-template";
import common from "../../lib/common/common.js";
import puppeteer from "../../lib/puppeteer/puppeteer.js";

class ProcessManager {
  constructor(logger) {
    this.processes = new Set();
    this.logger = logger || global.logger || console;
  }

  register(proc) {
    if (proc && proc.pid) {
      this.processes.add(proc);
    }
  }

  unregister(proc) {
    if (proc && this.processes.has(proc)) {
      this.processes.delete(proc);
    }
  }

  killAll(signal = 'SIGTERM', reason = 'Operation ended') {
    if (this.processes.size === 0) {
      return;
    }
    this.logger.warn(`『咕咕牛🐂进程管理器』 因为：${reason}，正在终止 ${this.processes.size} 个活动进程`);
    this.processes.forEach(proc => {
      if (proc && proc.pid && !proc.killed) {
        try {
          if (process.platform !== "win32") {
            process.kill(-proc.pid, signal);
          } else {
            process.kill(proc.pid, signal);
          }
        } catch (killError) {
          if (killError.code !== 'ESRCH') {
            this.logger.error(`『咕咕牛🐂进程管理器』 终止进程失败 ${proc.pid}:`, killError);
          }
        }
      }
    });
    this.processes.clear();
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YunzaiPath = path.resolve(__dirname, "..", "..");
const Version = "5.0.0";
const Purify_Level = { NONE: 0, RX18_ONLY: 1, PX18_PLUS: 2, getDescription: (level) => ({ 0: "不过滤", 1: "过滤R18", 2: "全部敏感项" }[level] ?? "未知"), };
const VALID_TAGS = { "彩蛋": { key: "isEasterEgg", value: true }, "ai": { key: "isAiImage", value: true }, "横屏": { key: "layout", value: "fullscreen" }, "r18": { key: "isRx18", value: true }, "p18": { key: "isPx18", value: true }, };
const RAW_URL_Repo1 = "https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main";
const Default_Config = {
  Main_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT/",    // 一号库 (热门五星)
  Ass_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-2/",   // 二号库 (原神)
  Ass2_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-3/",  // 三号库 (星铁)
  Ass3_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-4/",  // 四号库 (鸣潮+绝区零)
  SepositoryBranch: "main",
  proxies: [
    { name: "Moeyy", priority: 0, testUrlPrefix: `https://github.moeyy.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://github.moeyy.xyz/" },
    { name: "Ghfast", priority: 10, testUrlPrefix: `https://ghfast.top/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghfast.top/" },
    { name: "FastGit", priority: 12, testUrlPrefix: `https://hub.fastgit.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://hub.fastgit.xyz/" },
    { name: "GhLLKK", priority: 15, testUrlPrefix: `https://gh.llkk.cc/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.llkk.cc/" },
    { name: "GhproxyCom", priority: 18, testUrlPrefix: `https://ghproxy.com/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghproxy.com/" },
    { name: "MirrorGhproxy", priority: 22, testUrlPrefix: `https://mirror.ghproxy.com/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://mirror.ghproxy.com/" },
    { name: "GhproxyNet", priority: 25, testUrlPrefix: `https://gh-proxy.net/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh-proxy.net/" },
    { name: "UiGhproxy", priority: 28, testUrlPrefix: `https://ui.ghproxy.cc/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ui.ghproxy.cc/" },
    { name: "GhApi999", priority: 30, testUrlPrefix: `https://gh.api.99988866.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.api.99988866.xyz/" },
    { name: "GhproxyGo", priority: 35, testUrlPrefix: `https://ghproxy.1888866.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghproxy.1888866.xyz/" },
    { name: "CrazyForksProxy", priority: 38, testUrlPrefix: `https://ghproxy-go.example/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghproxy-go.example/" },
    { name: "KGitHub", priority: 42, testUrlPrefix: `https://kgithub.com/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://kgithub.com/" },
    { name: "HubNUAA", priority: 45, testUrlPrefix: `https://hub.nuaa.cf/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://hub.nuaa.cf/" },
    { name: "HubFGit", priority: 48, testUrlPrefix: `https://hub.fgit.ml/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://hub.fgit.ml/" },
    { name: "Ghp", priority: 60, testUrlPrefix: `https://ghp.ci/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghp.ci/" },
    { name: "Ghgo", priority: 60, testUrlPrefix: `https://ghgo.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghgo.xyz/" },
    { name: "Yumenaka", priority: 70, testUrlPrefix: `https://git.yumenaka.net/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://git.yumenaka.net/" },
    { name: "GhConSh", priority: 75, testUrlPrefix: `https://gh.con.sh/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.con.sh/" },
    { name: "GhddlcTop", priority: 80, testUrlPrefix: `https://gh.ddlc.top/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.ddlc.top/" },
    { name: "GhpsCc", priority: 300, testUrlPrefix: `https://ghps.cc/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghps.cc/" },
    { name: "Mirror", priority: 310, testUrlPrefix: `https://raw.gitmirror.com/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://hub.gitmirror.com/" },
    { name: "GitHub", priority: 500, testUrlPrefix: RAW_URL_Repo1, cloneUrlPrefix: "https://github.com/" },
    { name: "GitClone", priority: 520, testUrlPrefix: null, cloneUrlPrefix: "https://gitclone.com/" },
  ],
  proxyTestFile: "/README.md",
  proxyTestTimeout: 5000,
  gitCloneTimeout: 900000,
  gitPullTimeout: 120000,
  gitCloneDepth: 1,
  cronUpdate: "0 */12 * * *",
  defaultTuKuOp: true,
  defaultPfl: Purify_Level.NONE,
  logPrefix: "『咕咕牛🐂』",
  gitLogFormat: "%cd [%h] %s",
  gitLogDateFormat: "format:%m-%d %H:%M",
  renderScale: 300,
  Ai: true,
  EasterEgg: true,
  layout: true,
  Execution_Mode: 'Batch',
  Load_Level: 1,
  Use_Secondary_Forward: false,
  SleeperAgent_switch: false,
  rootFixedFiles: ['logo.png', 'logoIcon.png'],
};
let backgroundCache = { files: [], lastScan: 0, ttl: 60000, };

async function getBackgroundFiles(logger) {
  const now = Date.now();
  if (now - backgroundCache.lastScan < backgroundCache.ttl && backgroundCache.files.length > 0) {
    return backgroundCache.files;
  }

  const bgDir = path.join(MiaoPluginMBT.paths.backgroundImgPath, "bg");
  try {
    const entries = await fsPromises.readdir(bgDir);
    backgroundCache.files = entries.filter(file => /\.(webp|png|jpg|jpeg)$/i.test(file));
    backgroundCache.lastScan = now;
    return backgroundCache.files;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      //logger.error(`${Default_Config.logPrefix}扫描 bg 目录失败:`, err);
    }
    return [];
  }
}

let pictureCache = { files: [], lastScan: 0, ttl: 60000, };

async function getPictureFiles(logger) {
  const now = Date.now();
  if (now - pictureCache.lastScan < pictureCache.ttl && pictureCache.files.length > 0) {
    return pictureCache.files;
  }

  const pictureDir = path.join(MiaoPluginMBT.paths.backgroundImgPath, "picture");
  try {
    const entries = await fsPromises.readdir(pictureDir);
    pictureCache.files = entries.filter(file => /\.(webp|png|jpg|jpeg)$/i.test(file));
    pictureCache.lastScan = now;
    return pictureCache.files;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // logger.error(`${Default_Config.logPrefix}扫描 picture 目录失败:`, err);
    }
    return [];
  }
}

// 负载防御等级
const LOAD_LEVEL_CONFIG = {
  1: {
    name: "标准",
    description: "当前执行的是标准低负载策略(15秒CD, 阈值: CPU>90% 且 内存>85%)",
    cd: 15,
    thresholds: { cpu: 90, mem: 85, logic: 'AND' }
  },
  2: {
    name: "保守",
    description: "当前执行的是强化防御策略(30秒CD, 阈值: CPU>85% 且 内存>80%)",
    cd: 30,
    thresholds: { cpu: 85, mem: 80, logic: 'AND' }
  },
  3: {
    name: "极致",
    description: "当前执行的是最严格的防御策略(60秒CD, 阈值: CPU>75% 或 内存>75%)",
    cd: 60,
    thresholds: { cpu: 75, mem: 75, logic: 'OR' }
  }
};

const ERROR_CODES = {
  NotFound: "ENOENT", Access: "EACCES", Busy: "EBUSY", Perm: "EPERM",
  NotEmpty: "ENOTEMPTY", ConnReset: "ECONNRESET", Timeout: "ETIMEDOUT", Exist: "EEXIST",
};

async function safeDelete(targetPath, maxAttempts = 3, delay = 1000, throwOnError = false) {
  if (targetPath === null || typeof targetPath === "undefined" || targetPath === "") {
    return true;
  }
  let attempts = 0;
  const logger = global.logger || console;
  let lastErr = null;

  while (attempts < maxAttempts) {
    try {
      await fsPromises.rm(targetPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      lastErr = err;
      if (err.code === ERROR_CODES.NotFound) {
        return true;
      }
      if ([ERROR_CODES.Busy, ERROR_CODES.Perm, ERROR_CODES.NotEmpty].includes(err.code)) {
        attempts++;
        if (attempts >= maxAttempts) {
          //logger.error(`${Default_Config.logPrefix}${targetPath} 最终失败 (${attempts}次): ${lastErr.code || '未知错误码'}`);
          if (throwOnError) {
            const detailedError = new Error(`无法删除 ${targetPath} (尝试 ${attempts} 次后失败: ${lastErr.message})`);
            detailedError.code = lastErr.code || 'SAFE_DELETE_FAILED';
            detailedError.path = targetPath;
            throw detailedError;
          }
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        //logger.error(`${Default_Config.logPrefix}${targetPath} 遇到未处理异常:`, err);
        if (throwOnError) {
          const detailedError = new Error(`删除 ${targetPath} 时遇到未处理异常: ${err.message}`);
          detailedError.code = err.code || 'SAFE_DELETE_UNHANDLED';
          detailedError.path = targetPath;
          throw detailedError;
        }
        return false;
      }
    }
  }
  // 如果循环意外结束
  if (lastErr && throwOnError) {
    const detailedError = new Error(`无法删除 ${targetPath} (尝试 ${maxAttempts} 次后失败: ${lastErr.message})`);
    detailedError.code = lastErr.code || 'SAFE_DELETE_FAILED_UNEXPECTED';
    detailedError.path = targetPath;
    throw detailedError;
  }
  return false; // 默认返回false表示失败
}

async function copyFolderRecursive(source, target, options = {}, logger = global.logger || console) {
  const { ignoreSet = new Set(), filterExtension = null } = options;
  const normalizedFilterExt = filterExtension ? filterExtension.toLowerCase() : null;
  try { await fsPromises.access(source); }
  catch (err) { if (err.code === ERROR_CODES.NotFound) return; logger.error(`${Default_Config.logPrefix}源访问失败 ${source}:`, err); throw err; }
  try {
    await fsPromises.mkdir(target, { recursive: true });
    const entries = await fsPromises.readdir(source, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (ignoreSet.has(entry.name) || entry.name === ".git") return;
        const currentSource = path.join(source, entry.name);
        const currentTarget = path.join(target, entry.name);
        try {
          if (entry.isDirectory()) await copyFolderRecursive(currentSource, currentTarget, options, logger);
          else if (entry.isFile()) {
            const shouldCopy = !normalizedFilterExt || entry.name.toLowerCase().endsWith(normalizedFilterExt);
            if (shouldCopy) {
              try { await fsPromises.copyFile(currentSource, currentTarget, fs.constants.COPYFILE_FICLONE); }
              catch (cloneError) {
                if (cloneError.code === "ENOSYS" || cloneError.code === "EXDEV") await fsPromises.copyFile(currentSource, currentTarget);
                else throw cloneError;
              }
            }
          }
        } catch (itemError) {
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(itemError.code)) {
            logger.warn(`${Default_Config.logPrefix}处理 ${entry.name} 出错:`, itemError.code);
          }
        }
      })
    );
  } catch (error) {
    if (![ERROR_CODES.Exist, ERROR_CODES.Access, ERROR_CODES.Perm].includes(error.code)) {
      logger.error(`${Default_Config.logPrefix}操作失败 ${source} -> ${target}:`, error);
    } else if (error.code !== ERROR_CODES.Exist) {
      logger.warn(`${Default_Config.logPrefix}操作警告 ${source} -> ${target}:`, error.code);
    }
  }
}

/**
 * @description 执行外部命令，处理流，支持超时和信号终止。
 * @param {string} command 要执行的命令
 * @param {string[]} args 命令的参数数组
 * @param {object} [options={}] spawn的选项
 * @param {number} [timeout=0] 超时时间(ms)，0为不设置超时
 * @param {function} [onStdErr] stderr的回调
 * @param {function} [onStdOut] stdout的回调
 * @param {function} [onProgress] 进度回调，接收 (percent, resetTimeoutFn)
 * @returns {Promise<object> & {cancel: function}} 返回一个可取消的Promise
 */
function ExecuteCommand(command, args, options = {}, timeout = 0, onStdErr, onStdOut, onProgress) {
  const logger = global.logger || console;
  const isClone = command === "git" && args.includes("clone");
  if (isClone && !args.some(arg => arg === '--verbose' || arg === '-v')) {
    const cloneIndex = args.indexOf("clone");
    if (cloneIndex !== -1) args.splice(cloneIndex + 1, 0, "--verbose");
  }
  const cmdStr = `${command} ${args.join(" ")}`;
  const cleanEnv = { ...process.env, ...(options.env || {}) };
  delete cleanEnv.HTTP_PROXY; delete cleanEnv.HTTPS_PROXY; delete cleanEnv.http_proxy; delete cleanEnv.https_proxy;
  const gitDebugEnv = { GIT_CURL_VERBOSE: "1", GIT_TRACE: "1", GIT_PROGRESS_DELAY: "0" };
  options.env = { ...cleanEnv, ...gitDebugEnv };

  let proc;
  let promiseSettled = false;
  let timer = null;

  const settlePromise = (resolver, value) => {
    if (promiseSettled) return;
    promiseSettled = true;
    clearTimeout(timer);
    resolver(value);
  };

  const killProc = (signal = "SIGTERM") => {
    if (proc && proc.pid && !proc.killed) {
      // logger.warn(`${Default_Config.logPrefix} 发送 ${signal} 到 ${proc.pid} (${cmdStr})`);
      try {
        if (process.platform !== "win32") process.kill(-proc.pid, signal);
        else process.kill(proc.pid, signal);
      } catch (killError) {
        if (killError.code !== "ESRCH") logger.error(`${Default_Config.logPrefix} kill ${proc.pid} 失败:`, killError);
      }
    }
  };

  const promise = new Promise((resolve, reject) => {
    let stdout = ""; let stderr = "";

    const resetTimeout = (newTimeout = timeout) => {
      clearTimeout(timer);
      if (newTimeout > 0) {
        timer = setTimeout(() => {
          if (promiseSettled) return;
          //logger.warn(`${Default_Config.logPrefix}命令 [${cmdStr}] 超时 (${newTimeout}ms)，终止...`);
          killProc("SIGTERM");
          setTimeout(() => { if (!proc.killed) killProc("SIGKILL"); }, 3000);
          const err = new Error(`Command timed out after ${newTimeout}ms: ${cmdStr}`);
          err.code = ERROR_CODES.Timeout;
          err.stdout = stdout;
          err.stderr = stderr;
          settlePromise(reject, err);
        }, newTimeout);
      }
    };

    try {
      proc = spawn(command, args, { stdio: "pipe", ...options, shell: false });
    } catch (spawnError) {
      logger.error(`${Default_Config.logPrefix} 启动失败 [${cmdStr}]:`, spawnError);
      return reject(spawnError);
    }

    resetTimeout(); // 启动初始计时器

    const handleOutput = (streamName, data, externalCallback) => {
      if (promiseSettled) return;
      const outputChunk = data.toString();
      if (streamName === "stdout") stdout += outputChunk;
      else {
        stderr += outputChunk;
        const trimmedChunk = outputChunk.trim();
        if (trimmedChunk.match(/^(fatal|error):/i)) {
          //logger.error(`${Default_Config.logPrefix}[CMD ERR] ${trimmedChunk}`);
        }

        if (onProgress && isClone) {
          const progressMatch = outputChunk.match(/(?:Receiving|Resolving|Compressing) objects:\s*(\d+)%/i);
          if (progressMatch && progressMatch[1]) {
            const percent = parseInt(progressMatch[1], 10);
            onProgress(percent, resetTimeout); // 传递重置函数
          }
        }
      }
      if (externalCallback) {
        try { externalCallback(outputChunk); }
        catch (e) { logger.warn(`${Default_Config.logPrefix} ${streamName} 回调出错:`, e); }
      }
    };

    proc.stdout?.on("data", (data) => handleOutput("stdout", data, onStdOut));
    proc.stderr?.on("data", (data) => handleOutput("stderr", data, onStdErr));

    proc.on("error", (err) => {
      if (promiseSettled) return;
      logger.error(`${Default_Config.logPrefix}进程错误 [${cmdStr}]:`, err);
      err.stdout = stdout; err.stderr = stderr;
      settlePromise(reject, err);
    });

    proc.on("close", (code, signal) => {
      if (promiseSettled) return;
      if (code === 0) {
        settlePromise(resolve, { code: 0, signal, stdout, stderr });
      } else {
        const err = new Error(`Command failed with code ${code}: ${cmdStr}`);
        err.code = code ?? "UNKNOWN";
        err.signal = signal;
        err.stdout = stdout;
        err.stderr = stderr;
        settlePromise(reject, err);
      }
    });
  });

  promise.cancel = (reason = "Cancelled") => {
    if (!promiseSettled) {
      killProc("SIGTERM");
      const err = new Error(reason);
      err.isCancelled = true;
      // 使用一个无法被捕获的 resolver 来静默地 reject Promise
      const silentReject = () => { };
      settlePromise(silentReject, err);
    }
  };

  return promise;
}

async function checkSystemHealth(e, logger, isFromPolicyCheck = false) {

  const config = MiaoPluginMBT.MBTConfig;
  if ((config.Execution_Mode ?? 'Batch') !== 'Serial') return true;

  const level = config.Load_Level ?? 1;
  const policy = LOAD_LEVEL_CONFIG[level] || LOAD_LEVEL_CONFIG[1];
  const { cpu: cpuThreshold, mem: memThreshold, logic } = policy.thresholds;

  try {
    const getCpuUsage = () => new Promise(resolve => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalCpuTime = (endUsage.user + endUsage.system) / 1000; // ms
        resolve((totalCpuTime / 500) * 100); // 500ms 内的使用率
      }, 500);
    });

    const currentCpuUsage = await getCpuUsage();
    const totalMemory = os.totalmem();
    const currentRss = process.memoryUsage().rss;
    const memUsagePercent = (currentRss / totalMemory) * 100;

    let isOverloaded = false;
    if (logic === 'OR') {
      isOverloaded = currentCpuUsage > cpuThreshold || memUsagePercent > (memThreshold - 5); // 内存阈值放宽5%
    } else {
      isOverloaded = currentCpuUsage > cpuThreshold && memUsagePercent > (memThreshold - 5);
    }

    if (isOverloaded) {
      const waitSeconds = 5 + Math.floor(Math.random() * 5);
      const message = `${Default_Config.logPrefix}检测到系统高负载！\nCPU: ${currentCpuUsage.toFixed(1)}%, 内存: ${FormatBytes(currentRss)}\n为防止机器人崩溃，处理已暂停 ${waitSeconds} 秒...`;
      logger.warn(message.replace(/\n/g, ' '));

      if (e && e.reply && !isFromPolicyCheck) {
        await e.reply(message, true);
      }

      await common.sleep(waitSeconds * 1000);
      if (global.gc) global.gc();

      // 极端负载检查与自动切换
      const extremePolicy = LOAD_LEVEL_CONFIG[3];
      if (!MiaoPluginMBT._systemLoadState.autoSwitchLock && currentCpuUsage > extremePolicy.thresholds.cpu && memUsagePercent > (extremePolicy.thresholds.mem - 5)) {
        MiaoPluginMBT._systemLoadState.autoSwitchLock = true;
        MiaoPluginMBT.MBTConfig.Execution_Mode = 'Batch';
        await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
        const switchMsg = `${Default_Config.logPrefix}检测到持续极端高负载！为保护系统，已自动切换回高速并发模式。该模式将在重启后或手动设置后恢复。`;
        logger.fatal(switchMsg);
        await MiaoPluginMBT.SendMasterMsg(switchMsg);
      }
      return false; // 表示系统正忙
    }
    return true; // 系统健康
  } catch (err) {
    logger.error(`${Default_Config.logPrefix}发生错误:`, err);
    return true; // 出错时默认放行
  }
}

async function FolderSize(folderPath) {
  let totalSize = 0;
  const queue = [folderPath];
  const visitedDirs = new Set();
  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (visitedDirs.has(currentPath)) continue;
    visitedDirs.add(currentPath);
    try {
      const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        try {
          if (entry.isDirectory()) queue.push(entryPath);
          else if (entry.isFile()) {
            const stats = await fsPromises.stat(entryPath);
            totalSize += stats.size;
          }
        } catch (statError) {
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(statError.code)) {
          }
        }
      }
    } catch (readDirError) {
      if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readDirError.code)) {
      }
    }
  }
  return totalSize;
}

function FormatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return "? B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i >= sizes.length) i = sizes.length - 1;
  const formattedValue = i === 0 ? bytes : parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${formattedValue} ${sizes[i]}`;
}

class SimpleAsyncMutex {
  _locked = false;
  _waitQueue = [];

  acquire() {
    return new Promise((resolve) => {
      if (!this._locked) { this._locked = true; resolve(); }
      else this._waitQueue.push(resolve);
    });
  }

  release() {
    if (this._waitQueue.length > 0) {
      const nextResolve = this._waitQueue.shift();
      if (nextResolve) nextResolve();
      else this._locked = false;
    } else this._locked = false;
  }

  async runExclusive(callback) {
    await this.acquire();
    try { return await callback(); }
    finally { this.release(); }
  }
}

async function renderPageToImage(rendererName, options, pluginInstanceOrLogger) {
  let logger, logPrefix;
  if (pluginInstanceOrLogger && typeof pluginInstanceOrLogger.logger === 'function' && typeof pluginInstanceOrLogger.logPrefix === 'string') {
    logger = pluginInstanceOrLogger.logger;
    logPrefix = pluginInstanceOrLogger.logPrefix;
  } else if (pluginInstanceOrLogger && typeof pluginInstanceOrLogger.info === 'function') {
    logger = pluginInstanceOrLogger;
    logPrefix = Default_Config.logPrefix;
  } else {
    logger = global.logger || console;
    logPrefix = Default_Config.logPrefix;
  }

  const {
    tplFile, htmlContent, data = {}, imgType = "png",
    pageGotoParams = { waitUntil: "networkidle0" },
    screenshotOptions = { fullPage: true },
    pageBoundingRect, width,
  } = options;

  const backgroundFiles = await getBackgroundFiles(logger);
  if (backgroundFiles.length > 0) {
    const selectedBgName = lodash.sample(backgroundFiles);
    data.backgroundImage = `file://${path.join(MiaoPluginMBT.paths.backgroundImgPath, 'bg', selectedBgName).replace(/\\/g, '/')}`;
  } else {
    data.backgroundImage = '';
  }

  const headerImageRenderers = [
    'settings-panel',
    'status-report',
    'search-helper',
    'manual-speedtest',
    'update-report',
  ];

  data.headerImage = '';
  if (headerImageRenderers.some(baseName => rendererName.startsWith(baseName))) {
    const pictureFiles = await getPictureFiles(logger);
    if (pictureFiles.length > 0) {
      const selectedPicName = lodash.sample(pictureFiles);
      data.headerImage = `file://${path.join(MiaoPluginMBT.paths.backgroundImgPath, 'picture', selectedPicName).replace(/\\/g, '/')}`;
    }
  }
  data.guguniu_res_path = `file://${MiaoPluginMBT.paths.commonResPath}/`.replace(/\\/g, '/');
  const baseTempDir = MiaoPluginMBT.paths.tempPath;
  await fsPromises.mkdir(baseTempDir, { recursive: true });

  const uniqueId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const rendererInstanceDirName = `render-${rendererName}-${uniqueId}`;
  const instanceTempPath = path.join(baseTempDir, rendererInstanceDirName);

  let tempHtmlFilePath = "";

  try {
    await fsPromises.mkdir(instanceTempPath, { recursive: true });
    tempHtmlFilePath = path.join(instanceTempPath, `template-${uniqueId}.html`);

    let finalHtmlContentToRender;
    if (typeof htmlContent === 'string' && htmlContent.length > 0) {
      finalHtmlContentToRender = template.render(htmlContent, data || {});
    } else if (tplFile) {
      try {
        const tplString = await fsPromises.readFile(tplFile, "utf-8");
        finalHtmlContentToRender = template.render(tplString, data || {});
      } catch (fileOrRenderError) {
        logger.error(`${Default_Config.logPrefix}读取模板或渲染HTML出错:`, fileOrRenderError);
        throw fileOrRenderError;
      }
    } else {
      logger.error(`${Default_Config.logPrefix}必须提供 tplFile 或 htmlContent 之一。`);
      throw new Error("renderPageToImage：缺少HTML模板源。");
    }

    await fsPromises.writeFile(tempHtmlFilePath, finalHtmlContentToRender, "utf-8");

    const puppeteerOptionsForScreenshot = {
      tplFile: tempHtmlFilePath,
      savePath: path.join(instanceTempPath, `image-${uniqueId}.${imgType}`),
      imgType: imgType,
      pageGotoParams: pageGotoParams,
      screenshotOptions: pageBoundingRect ? { ...screenshotOptions, fullPage: false } : screenshotOptions,
      pageBoundingRect: pageBoundingRect,
      width: width,
      waitForFontsReady: true,
    };

    const puppeteerInternalRendererName = `guguniu-${rendererName}`;
    const imageBuffer = await puppeteer.screenshot(puppeteerInternalRendererName, puppeteerOptionsForScreenshot);

    if (!imageBuffer || imageBuffer.length === 0) {
      logger.error(`${Default_Config.logPrefix}Puppeteer 返回了空的图片 Buffer。`);
      return null;
    }
    return imageBuffer;
  } catch (error) {
    logger.error(`${Default_Config.logPrefix}渲染过程出错了：`, error);
    if (error.message && error.message.toLowerCase().includes("timeout")) {
      logger.warn(`${Default_Config.logPrefix}渲染超时了哦。`);
    }
    return null;
  } finally {
    if (fs.existsSync(instanceTempPath)) {
      try { await safeDelete(instanceTempPath); }
      catch (cleanupError) {
        logger.warn(`${Default_Config.logPrefix}清理临时文件 ${instanceTempPath} 的时候好像有点小麻烦：`, cleanupError.code || cleanupError.message);
      }
    }
  }
}

class MiaoPluginMBT extends plugin {
  static initializationPromise = null;
  static isGloballyInitialized = false;
  static MBTConfig = {};
  static _imgDataCache = Object.freeze([]);
  static _userBanSet = new Set();
  static _activeBanSet = new Set();
  static _aliasData = null;
  static _wavesRoleDataMap = null;
  static _zzzAvatarMap = null;
  static oldFileDeletionScheduled = false;
  static isInitializing = false;
  static _remoteBanCount = 0;

  static configMutex = new SimpleAsyncMutex();
  static gitMutex = new SimpleAsyncMutex();
  static _indexByGid = new Map();
  static _indexByCharacter = new Map();
  static _indexByTag = new Map();
  static _systemLoadState = { level: 'NORMAL', lastCheck: 0, autoSwitchLock: false };
  static _loadMonitorInterval = null;
  //static _configWatcher = null;
  static _configSaveLock = {
    isLocked: false,
    resolver: null,
  };

  static paths = {
    YunzaiPath: YunzaiPath,
    LocalTuKuPath: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT"),
    gitFolderPath: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT", ".git"),
    LocalTuKuPath2: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-2"),
    gitFolderPath2: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-2", ".git"),
    LocalTuKuPath3: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-3"),
    gitFolderPath3: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-3", ".git"),
    LocalTuKuPath4: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-4"),
    gitFolderPath4: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-4", ".git"),

    commonResPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery"),
    configFilePath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "GalleryConfig.yaml"),
    imageDataPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "imagedata.json"),
    banListPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "banlist.json"),

    tempPath: path.join(YunzaiPath, "temp", "html", "GuGuNiu"),

    backgroundImgPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "html", "img"),
    wavesRoleDataPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "html", "img", "Waves", "RoleData.json"),
    target: {
      miaoChar: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "profile", "normal-character"),
      zzzChar: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "resources", "images", "panel"),
      wavesChar: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "rolePic"),
      exampleJs: path.join(YunzaiPath, "plugins", "example"),

      miaoGsAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-gs", "character"),
      miaoSrAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-sr", "character"),

      zzzAliasDir: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "defset"),
      zzzDataDir: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "resources", "data", "hakush", "data", "character"),
      zzzFaceDir: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "resources", "images", "role_circle"),

      wavesAliasDir: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "Alias"),

    },
    sourceFolders: { gs: "gs-character", sr: "sr-character", zzz: "zzz-character", waves: "waves-character", gallery: "GuGuNiu-Gallery", },
    filesToSyncToCommonRes: [
      { sourceSubPath: "GuGuNiu-Gallery/imagedata.json", destFileName: "imagedata.json" },
      { sourceSubPath: "GuGuNiu-Gallery/GalleryConfig.yaml", destFileName: "GalleryConfig.yaml", copyIfExists: false },
      { sourceSubPath: "GuGuNiu-Gallery/html/status.html", destFileName: "html/status.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/banlist.html", destFileName: "html/banlist.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/speedtest.html", destFileName: "html/speedtest.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/settings_panel.html", destFileName: "html/settings_panel.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/visualize.html", destFileName: "html/visualize.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/update_report.html", destFileName: "html/update_report.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/check_gallerymap.html", destFileName: "html/check_gallerymap.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/search_helper.html", destFileName: "html/search_helper.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/img", destFileName: "html/img", copyIfExists: true, isDir: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/fonts", destFileName: "html/fonts", copyIfExists: true, isDir: true },
    ],
    filesToSyncSpecific: [{ sourceSubPath: "咕咕牛图库管理器.js", destDir: path.join(YunzaiPath, "plugins", "example"), destFileName: "咕咕牛图库管理器.js" }],
  };

  static _WhyNotStore() {
    const store = {
      AppleComeBack: "eHhnWEtxcHFVdm9ZWUF0RFNtU1Y6d0tYS1VSSUd5eHBDaXdGbGxiYXo="
    };
    const Apple_LTO = Buffer.from(store.AppleComeBack, 'base64').toString('utf8');
    return Apple_LTO;
  }

  config = Default_Config;
  logPrefix = Default_Config.logPrefix;
  logger = global.logger || console;
  isPluginInited = false;
  task = null;

  constructor() {
    super({
      name: `『咕咕牛🐂』图库管理器 v${Version}`,
      dsc: "『咕咕牛🐂』图库管理器",
      event: "message", priority: 500, rule: GUGUNIU_RULES,
    });

    this.task = [
      {
        name: `${Default_Config.logPrefix}定时更新`,
        cron: Default_Config.cronUpdate,
        fnc: () => this.RunUpdateTask(),
        log: true,
      },
      {
        name: `${Default_Config.logPrefix}临时文件清理`,
        cron: '0 0 3 * * *',
        fnc: () => this.cleanupTempFiles(),
        log: true,
      }
    ];

    this._initializeInstance();
  }

  async _initializeInstance() {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      MiaoPluginMBT.InitializePlugin(this.logger);
    }
    try {
      await MiaoPluginMBT.initializationPromise;
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;

      if (this.isPluginInited && Array.isArray(this.task)) {
        const mainUpdateTask = this.task.find(t => t.name.includes('定时更新'));
        if (mainUpdateTask && MiaoPluginMBT.MBTConfig.cronUpdate && mainUpdateTask.cron !== MiaoPluginMBT.MBTConfig.cronUpdate) {
          this.logger.info(`${this.logPrefix} 更新 Cron 表达式: ${mainUpdateTask.cron} -> ${MiaoPluginMBT.MBTConfig.cronUpdate}`);
          mainUpdateTask.cron = MiaoPluginMBT.MBTConfig.cronUpdate;
        }
      }

    } catch (initError) {
      this.logger.error(`${this.logPrefix} 实例等待全局初始化失败: ${initError.message}`);
      this.isPluginInited = false;
    }
  }

  async accept(old_this) {
    //this.logger.info("『咕咕牛🐂』检测到管理器热重载，开始处理...");
    if (old_this && typeof old_this.destroy === 'function') {
      this.logger.info("『咕咕牛🐂』检测到管理器正在热重载...");
      await old_this.destroy();
      this.logger.info("『咕咕牛🐂』管理器已热重载。");
    } else {
      //this.logger.warn("『咕咕牛🐂』未发现正在运行的旧实例。这可能是首次加载或插件处于休眠状态被更新。");
    }
  }

  async destroy() {
    //this.logger.info("『咕咕牛🐂』开始销毁插件资源...");

    //清理定时器
    if (MiaoPluginMBT._loadMonitorInterval) {
      clearInterval(MiaoPluginMBT._loadMonitorInterval);
      MiaoPluginMBT._loadMonitorInterval = null;
      //this.logger.info("『咕咕牛🐂 负载监控定时器已清理。");
    }

    //关闭文件监听器
    if (MiaoPluginMBT._configWatcher) {
      MiaoPluginMBT._configWatcher.close();
      MiaoPluginMBT._configWatcher = null;
      //this.logger.info("『咕咕牛🐂』配置文件监听器已关闭。");
    }

    //重置所有静态缓存和状态
    MiaoPluginMBT.isGloballyInitialized = false;
    MiaoPluginMBT.initializationPromise = null;
    MiaoPluginMBT.MBTConfig = {};
    MiaoPluginMBT._imgDataCache = Object.freeze([]);
    MiaoPluginMBT._userBanSet = new Set();
    MiaoPluginMBT._activeBanSet = new Set();
    MiaoPluginMBT._aliasData = null;
    MiaoPluginMBT._wavesRoleDataMap = null;
    MiaoPluginMBT._zzzAvatarMap = null;
    MiaoPluginMBT._remoteBanCount = 0;
    MiaoPluginMBT._indexByGid.clear();
    MiaoPluginMBT._indexByCharacter.clear();
    MiaoPluginMBT._indexByTag.clear();
    this.logger.info("『咕咕牛🐂』所有静态缓存和索引已重置。");
  }

  static startLoadMonitor(logger = global.logger || console) {

    if (MiaoPluginMBT._loadMonitorInterval) {
      // logger.info(`${Default_Config.logPrefix}监控器已在运行。`);
      return;
    }
    // logger.info(`${Default_Config.logPrefix}启动后台系统负载监控器...`);
    MiaoPluginMBT._loadMonitorInterval = setInterval(async () => {
      // 主要目的是为了动态调整，而不是只在指令触发时检查
      const config = MiaoPluginMBT.MBTConfig;
      if ((config?.Execution_Mode ?? 'Batch') !== 'Serial' || MiaoPluginMBT._systemLoadState.autoSwitchLock) {
        return;
      }

      const extremePolicy = LOAD_LEVEL_CONFIG[3];
      const { cpu: cpuThreshold, mem: memThreshold } = extremePolicy.thresholds;

      // 这里的逻辑主要是为了检查是否需要自动切换模式
      // 完整的检查逻辑在 checkSystemHealth 中

    }, 30 * 1000); // 每30秒检查一次
  }

  static stopLoadMonitor(logger = global.logger || console) {
    if (MiaoPluginMBT._loadMonitorInterval) {
      clearInterval(MiaoPluginMBT._loadMonitorInterval);
      MiaoPluginMBT._loadMonitorInterval = null;
      // logger.info(`${Default_Config.logPrefix}后台监控器已停止。`);
    }
  }

  // static _startConfigWatcher(logger = global.logger || console) {
  //   const configPath = MiaoPluginMBT.paths.configFilePath;
  //   const configDir = path.dirname(configPath);
  //   if (MiaoPluginMBT._configWatcher) {
  //     MiaoPluginMBT._configWatcher.close();
  //   }

  //   try {
  //     // logger.info(`${Default_Config.logPrefix}启动配置文件监控: ${configPath}`);
  //     MiaoPluginMBT._configWatcher = fs.watch(configDir, { persistent: false }, lodash.debounce(async (eventType, filename) => {
  //       if (filename === path.basename(configPath)) {
  //         // 如果锁是激活的，等待它被释放
  //         if (MiaoPluginMBT._configSaveLock.isLocked && MiaoPluginMBT._configSaveLock.resolver) {
  //           // 这是由插件内部写入的，不做任何事
  //           return;
  //         }

  //         // 如果执行到这里，说明锁是关闭的，这是外部修改
  //         //logger.info(`${Default_Config.logPrefix}检测到外部修改 GalleryConfig.yaml，正在热重载...`);
  //         await common.sleep(200);
  //         await MiaoPluginMBT.LoadTuKuConfig(true, logger);
  //         await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
  //         //await MiaoPluginMBT.SendMasterMsg(`${Default_Config.logPrefix}检测到配置文件被手动修改，已自动热重载并应用。`);
  //       }
  //     }, 500));

  //     MiaoPluginMBT._configWatcher.on('error', (err) => {
  //       logger.error(`${Default_Config.logPrefix}监控器发生错误:`, err);
  //     });
  //   } catch (err) {
  //     logger.error(`${Default_Config.logPrefix}启动监控失败:`, err);
  //   }
  // }

  static async _checkAndCleanPendingOperations(logger) {

    const tempDownloadsBaseDir = path.join(MiaoPluginMBT.paths.tempPath, "guguniu-downloads");
    const repoPaths = [
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.LocalTuKuPath2,
      MiaoPluginMBT.paths.LocalTuKuPath3,
    ].filter(Boolean);

    let cleanedCount = 0;
    const checkAndClean = async (dir) => {
      try {
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.endsWith('.pending')) {
            const originalName = entry.name.replace(/\.pending$/, '');
            const originalPath = path.join(dir, originalName);
            logger.warn(`${Default_Config.logPrefix}发现未完成的操作残留: ${entry.name}，正在清理...`);
            await safeDelete(originalPath);
            await safeDelete(path.join(dir, entry.name));
            cleanedCount++;
          }
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.error(`${Default_Config.logPrefix}清理 ${dir} 时出错:`, err);
        }
      }
    };

    await checkAndClean(tempDownloadsBaseDir);
    for (const repoPath of repoPaths) {
      await checkAndClean(path.dirname(repoPath)); // 检查仓库的上级目录
    }

    if (cleanedCount > 0) {
      logger.info(`${Default_Config.logPrefix}共清理了 ${cleanedCount} 个操作残留。`);
    }
  }

  static async InitializePlugin(logger = global.logger || console) {

    if (MiaoPluginMBT.isInitializing) {
      logger.warn(`${Default_Config.logPrefix}检测到初始化正在进行中，等待完成...`);
      try { await MiaoPluginMBT.initializationPromise; } catch (waitError) { }
      return MiaoPluginMBT.initializationPromise;
    }
    if (MiaoPluginMBT.initializationPromise) return MiaoPluginMBT.initializationPromise;
    if (MiaoPluginMBT.isGloballyInitialized) return Promise.resolve();

    MiaoPluginMBT.isInitializing = true;
    //logger.info(`${Default_Config.logPrefix}开始全局初始化(v${Version})...`); //调式日志
    MiaoPluginMBT.isGloballyInitialized = false;
    MiaoPluginMBT.initializationPromise = (async () => {
      await MiaoPluginMBT._checkAndCleanPendingOperations(logger);
      let fatalError = null;
      let localImgDataCache = [];
      try {
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, logger);
        if (!config || Object.keys(config).length === 0) throw new Error("无法加载图库配置");

        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, logger);
        if (!Array.isArray(localImgDataCache)) {
          logger.error(`${Default_Config.logPrefix}[警告] CRITICAL: 元数据加载失败或格式错误!`);
          localImgDataCache = [];
          throw new Error("加载图片元数据失败");
        } else if (localImgDataCache.length === 0 && (await MiaoPluginMBT.IsTuKuDownloaded(1))) {
          logger.warn(`${Default_Config.logPrefix}[警告] 元数据为空 (核心库已下载)`);
        }

        const bansLoaded = await MiaoPluginMBT.LoadUserBans(true, logger);
        if (!bansLoaded) {
          logger.warn(`${Default_Config.logPrefix}[警告] 加载用户封禁列表失败`);
        }

        const aliasLoaded = await MiaoPluginMBT.LoadAliasData(true, logger);
        await MiaoPluginMBT.LoadWavesRoleData(true, logger);
        if (!MiaoPluginMBT._aliasData?.combined) {
          logger.warn(`${Default_Config.logPrefix}[警告] 加载别名数据失败`);
          MiaoPluginMBT._aliasData = { combined: {} };
        } else if (!aliasLoaded) {
          logger.warn(`${Default_Config.logPrefix}[警告] 部分别名加载失败`);
        } else if (Object.keys(MiaoPluginMBT._aliasData.combined).length === 0) {
          logger.warn(`${Default_Config.logPrefix}[警告] 别名数据为空`);
        }

        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, logger);
        MiaoPluginMBT._imgDataCache = Object.freeze(localImgDataCache);

        MiaoPluginMBT.isGloballyInitialized = true;
        logger.info(`${Default_Config.logPrefix}全局初始化成功 版本号：v${Version}`);
        const configDir = path.dirname(MiaoPluginMBT.paths.configFilePath);
        // if (fs.existsSync(configDir)) {
        //     //MiaoPluginMBT._startConfigWatcher(logger);
        // } else {
        //     //logger.warn(`${Default_Config.logPrefix} 配置文件目录不存在，暂不启动监控。将在下载/更新后启动。`);
        // }
        MiaoPluginMBT.startLoadMonitor(logger);
        //MiaoPluginMBT._startConfigWatcher(logger);

        if (!MiaoPluginMBT.oldFileDeletionScheduled) {
          MiaoPluginMBT.oldFileDeletionScheduled = true;
          const delaySeconds = 15;
          //logger.info(`${Default_Config.logPrefix}已调度延迟 ${delaySeconds} 秒后清理旧文件任务。`); //调式日志
          setTimeout(async () => {
            const oldPluginFileName = "咕咕牛图库下载器.js";
            const oldPluginPath = path.join(MiaoPluginMBT.paths.target.exampleJs, oldPluginFileName);
            try {
              await fsPromises.access(oldPluginPath);
              //logger.warn(`${Default_Config.logPrefix}检测到旧插件文件 (${oldPluginFileName})，将尝试删除...`); //调式日志
              await fsPromises.unlink(oldPluginPath);
              //logger.info(`${Default_Config.logPrefix}旧插件文件 (${oldPluginFileName}) 已成功删除。`);   //调式日志
            } catch (err) {
              if (err.code !== ERROR_CODES.NotFound) logger.error(`${Default_Config.logPrefix}删除旧插件文件 (${oldPluginPath}) 时出错:`, err);
            }
          }, delaySeconds * 1000);
        }
      } catch (error) {
        fatalError = error;
        MiaoPluginMBT.isGloballyInitialized = false;
        logger.error(`${Default_Config.logPrefix}!!! 全局初始化失败: ${fatalError.message} !!!`);
        logger.error(fatalError.stack);
        MiaoPluginMBT._imgDataCache = Object.freeze([]); MiaoPluginMBT._userBanSet = new Set();
        MiaoPluginMBT._activeBanSet = new Set(); MiaoPluginMBT._aliasData = null;
        MiaoPluginMBT._remoteBanCount = 0;
        throw fatalError;
      } finally { MiaoPluginMBT.isInitializing = false; }
    })();
    MiaoPluginMBT.initializationPromise.catch((err) => { });
    return MiaoPluginMBT.initializationPromise;
  }

  static async LoadTuKuConfig(forceReload = false, logger = global.logger || console, configPath = MiaoPluginMBT.paths.configFilePath) {

    if (!forceReload && MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0) {
      return MiaoPluginMBT.MBTConfig;
    }
    let configData = {};
    try {
      await fsPromises.access(configPath);
      const content = await fsPromises.readFile(configPath, "utf8");
      const parsed = yaml.parse(content);
      if (parsed === null || typeof parsed !== 'object') {
        logger.warn(`${Default_Config.logPrefix}${configPath} 解析结果非对象或为null，视为空配置。`);
        configData = {};
      } else {
        configData = parsed;
      }
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        //logger.info(`${Default_Config.logPrefix}${configPath} 未找到，将使用默认配置。`);
      } else {
        logger.error(`${Default_Config.logPrefix}读取或解析配置文件 ${configPath} 失败:`, error);
      }
      configData = {};
    }
    const parseBoolLike = (value, defaultValue) => {
      if (value === 1 || String(value).toLowerCase() === "true") return true;
      if (value === 0 || String(value).toLowerCase() === "false") return false;
      return defaultValue;
    };
    const loadedConfig = {
      ...Default_Config,
      TuKuOP: parseBoolLike(configData.TuKuOP, Default_Config.defaultTuKuOp),
      PFL: configData.PFL ?? Default_Config.defaultPfl,
      Ai: parseBoolLike(configData.Ai, Default_Config.Ai),
      EasterEgg: parseBoolLike(configData.EasterEgg, Default_Config.EasterEgg),
      layout: parseBoolLike(configData.layout, Default_Config.layout),
      cronUpdate: configData.cronUpdate || Default_Config.cronUpdate,
      Execution_Mode: configData.Execution_Mode || Default_Config.Execution_Mode,
      Load_Level: configData.Load_Level ?? Default_Config.Load_Level,
      Use_Secondary_Forward: configData.Use_Secondary_Forward ?? Default_Config.Use_Secondary_Forward,
      SleeperAgent_switch: parseBoolLike(configData.SleeperAgent_switch, Default_Config.SleeperAgent_switch),
      renderScale: configData.renderScale ?? Default_Config.renderScale,
      repoNodeInfo: configData.repoNodeInfo || {},
    };
    if (![Purify_Level.NONE, Purify_Level.RX18_ONLY, Purify_Level.PX18_PLUS].includes(loadedConfig.PFL)) {
      logger.warn(`${Default_Config.logPrefix}检测到无效的净化等级配置 (${loadedConfig.PFL})，已重置为默认值 (${Default_Config.defaultPfl})。`);
      loadedConfig.PFL = Default_Config.defaultPfl;
    }
    MiaoPluginMBT.MBTConfig = loadedConfig;
    return MiaoPluginMBT.MBTConfig;
  }

  static async SaveTuKuConfig(configData, logger = global.logger || console) {
    const configFilePath = MiaoPluginMBT.paths.configFilePath;

    MiaoPluginMBT._configSaveLock.isLocked = true;
    const lockPromise = new Promise(resolve => {
      MiaoPluginMBT._configSaveLock.resolver = resolve;
    });

    try {
      const dataToSave = {
        TuKuOP: configData.TuKuOP ? 1 : 0,
        PFL: configData.PFL,
        Ai: configData.Ai ? 1 : 0,
        EasterEgg: configData.EasterEgg ? 1 : 0,
        layout: configData.layout ? 1 : 0,
        cronUpdate: configData.cronUpdate,
        Execution_Mode: configData.Execution_Mode,
        Load_Level: configData.Load_Level,
        Use_Secondary_Forward: configData.Use_Secondary_Forward,
        SleeperAgent_switch: configData.SleeperAgent_switch ? 1 : 0,
        renderScale: configData.renderScale,
        repoNodeInfo: configData.repoNodeInfo,
      };
      const dirPath = path.dirname(configFilePath);
      try { await fsPromises.mkdir(dirPath, { recursive: true }); }
      catch (mkdirError) { logger.error(`${Default_Config.logPrefix} 创建目录 ${dirPath} 失败:`, mkdirError); return false; }

      const yamlString = yaml.stringify(dataToSave);

      await fsPromises.writeFile(configFilePath, yamlString, "utf8");

      MiaoPluginMBT.MBTConfig = { ...MiaoPluginMBT.MBTConfig, ...configData };
      return true;
    } catch (error) {
      logger.error(`${Default_Config.logPrefix} 写入配置文件 ${configFilePath} 失败:`, error);
      return false;
    } finally {
      if (MiaoPluginMBT._configSaveLock.resolver) {
        MiaoPluginMBT._configSaveLock.resolver();
      }
      MiaoPluginMBT._configSaveLock.isLocked = false;
      MiaoPluginMBT._configSaveLock.resolver = null;
    }
  }

  static async _saveImageData(data, logger = global.logger || console) {

    const imageDataPath = MiaoPluginMBT.paths.imageDataPath;
    if (!Array.isArray(data)) {
      logger.error(`${Default_Config.logPrefix}拒绝保存非数组类型的数据。`);
      return false;
    }
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await fsPromises.mkdir(path.dirname(imageDataPath), { recursive: true });
      await fsPromises.writeFile(imageDataPath, jsonString, "utf8");
      logger.info(`${Default_Config.logPrefix}成功将 ${data.length} 条元数据写入到 ${imageDataPath}`);
      return true;
    } catch (error) {
      logger.error(`${Default_Config.logPrefix}写入元数据文件 ${imageDataPath} 失败:`, error);
      return false;
    }
  }

  static async _buildIndexes(imageData, logger) {

    // logger.info(`${Default_Config.logPrefix}开始构建 ${imageData.length} 条元数据的索引...`);

    // 清空旧索引
    this._indexByGid.clear();
    this._indexByCharacter.clear();
    this._indexByTag.clear();

    for (const item of imageData) {
      if (!item || !item.path) continue;
      const gid = item.path.replace(/\\/g, "/");

      // GID 索引
      this._indexByGid.set(gid, item);

      // 角色名索引
      if (item.characterName) {
        if (!this._indexByCharacter.has(item.characterName)) {
          this._indexByCharacter.set(item.characterName, []);
        }
        this._indexByCharacter.get(item.characterName).push(item);
      }

      // 标签索引
      if (item.attributes) {
        for (const tag of Object.values(VALID_TAGS)) {
          if (item.attributes[tag.key] === tag.value) {
            const tagName = tag.key;
            if (!this._indexByTag.has(tagName)) {
              this._indexByTag.set(tagName, []);
            }
            this._indexByTag.get(tagName).push(item);
          }
        }
      }
    }

    // 角色索引内部排序
    for (const [charName, images] of this._indexByCharacter.entries()) {
      images.sort((a, b) => {
        const numA = parseInt(a.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0");
        const numB = parseInt(b.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0");
        return numA - numB;
      });
    }
    // logger.info(`${Default_Config.logPrefix}完成。GIDs: ${this._indexByGid.size}, 角色: ${this._indexByCharacter.size}, 标签类别: ${this._indexByTag.size}`);
  }

  static async LoadImageData(forceReload = false, logger = global.logger || console) {
    if (MiaoPluginMBT._imgDataCache?.length > 0 && !forceReload) return MiaoPluginMBT._imgDataCache;

    const primaryPath = MiaoPluginMBT.paths.imageDataPath;
    const secondaryPath = path.join(MiaoPluginMBT.paths.LocalTuKuPath, MiaoPluginMBT.paths.sourceFolders.gallery, path.basename(MiaoPluginMBT.paths.imageDataPath));
    let finalData = null; // 使用 finalData 来存储最终要处理的数据
    let primaryFileExists = false;
    let remoteBanCounterTemp = 0;

    try {
      await fsPromises.access(primaryPath);
      primaryFileExists = true;
      const content = await fsPromises.readFile(primaryPath, "utf8");
      finalData = JSON.parse(content);
    } catch (error) {
      if (error.code !== ERROR_CODES.NotFound) {
        logger.error(`${Default_Config.logPrefix}读取主元数据文件失败 (${primaryPath}):`, error);
      }
    }

    if (!primaryFileExists || !Array.isArray(finalData) || finalData.length === 0) {
      let recoveredData = null;
      let recoverySource = "";

      try {
        await fsPromises.access(secondaryPath);
        const sourceContent = await fsPromises.readFile(secondaryPath, "utf8");
        recoveredData = JSON.parse(sourceContent);
        if (Array.isArray(recoveredData) && recoveredData.length > 0) {
          recoverySource = "备份文件";
          logger.info(`${Default_Config.logPrefix}从仓库源 (${recoverySource}) 成功加载元数据。`);
        } else {
          recoveredData = null; // 备份文件为空或格式错误
        }
      } catch (srcError) {
        // 备份文件不存在或加载失败，日志将在扫描回退前打印
      }

      // 如果从备份恢复失败，则启动扫描回退
      if (!recoveredData && (await MiaoPluginMBT.IsTuKuDownloaded(1))) {
        logger.warn(`${Default_Config.logPrefix}主路径和备份源均无效，启动扫描回退...`);
        try {
          recoveredData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(logger);
          recoverySource = "本地扫描";
        } catch (scanError) {
          logger.error(`${Default_Config.logPrefix}扫描回退过程中发生严重错误:`, scanError);
          recoveredData = [];
        }
      }

      if (Array.isArray(recoveredData) && recoveredData.length > 0) {
        logger.info(`${Default_Config.logPrefix}检测到主元数据文件丢失或无效，将从【${recoverySource}】恢复的数据回写到主路径...`);
        await MiaoPluginMBT._saveImageData(recoveredData, logger);
        finalData = recoveredData;
      } else {
        finalData = [];
      }
    }

    if (Array.isArray(finalData)) {
      const originalCount = finalData.length;
      const validData = finalData.filter(item => {
        if (item && item.attributes && item.attributes.isBan === true) {
          remoteBanCounterTemp++;
          return false;
        }
        const isBasicValid = item && typeof item.path === 'string' && item.path.trim() !== "" &&
          typeof item.characterName === 'string' && item.characterName.trim() !== "" &&
          typeof item.attributes === 'object' &&
          typeof item.storagebox === 'string' && item.storagebox.trim() !== "";
        if (!isBasicValid) return false;
        const pathRegex = /^[a-z]+-character\/[^/]+\/[^/]+Gu\d+\.webp$/i;
        const normalizedPath = item.path.replace(/\\/g, "/");
        const pathIsValid = pathRegex.test(normalizedPath);
        if (!pathIsValid) {
          logger.warn(`${Default_Config.logPrefix}过滤掉格式错误的图片路径: ${item.path}`);
        }
        return pathIsValid;
      }).map(item => ({ ...item, path: item.path.replace(/\\/g, "/") }));

      const validCount = validData.length;
      const filteredCount = originalCount - validCount;
      if (filteredCount > 0) {
        logger.info(`${Default_Config.logPrefix}共过滤掉 ${filteredCount} 条无效、格式错误或远程封禁的元数据。`);
      }

      await MiaoPluginMBT._buildIndexes(validData, logger);
      // 更新缓存
      MiaoPluginMBT._imgDataCache = Object.freeze(validData);
      MiaoPluginMBT._remoteBanCount = remoteBanCounterTemp;
      return validData;
    } else {
      logger.error(`${Default_Config.logPrefix}CRITICAL: 最终元数据结果不是一个数组！返回空数组。`);
      MiaoPluginMBT._imgDataCache = Object.freeze([]);
      MiaoPluginMBT._remoteBanCount = 0;
      return [];
    }
  }

  static async applyDefensePolicy(e, commandName) {
    const logger = global.logger || console;

    const config = MiaoPluginMBT.MBTConfig;

    if ((config.Execution_Mode ?? 'Batch') !== 'Serial') {
      return true;
    }

    if (!(await checkSystemHealth(e, logger, true))) {
      await e.reply(`${Default_Config.logPrefix}系统正忙，请稍后再试。`, true);
      return false;
    }

    const level = config.Load_Level ?? 1;
    let policy = LOAD_LEVEL_CONFIG[level] || LOAD_LEVEL_CONFIG[1];

    const cooldownDuration = policy.cd;
    if (cooldownDuration > 0) {
      const userId = e.user_id;
      const redisKey = `Yz:GuGuNiu:${commandName}:${userId}`;
      try {
        const ttl = await redis.ttl(redisKey);
        if (ttl && ttl > 0) {
          e.reply(`该指令冷却中，剩余 ${ttl} 秒。`, true);
          return false;
        }
        await redis.set(redisKey, '1', { EX: cooldownDuration });
      } catch (redisError) {
        logger.error(`${Default_Config.logPrefix}[CD:${commandName}] Redis 操作失败:`, redisError);
      }
    }

    return true;
  }

  static async IsGamePluginInstalled(gameKey) {
    let pluginPathToCheck = "";
    if (gameKey === "zzz") {
      pluginPathToCheck = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", "ZZZ-Plugin");
    } else if (gameKey === "waves") {
      pluginPathToCheck = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", "waves-plugin");
    } else {
      return false;
    }

    try {
      await fsPromises.access(pluginPathToCheck);
      const pluginStats = await fsPromises.stat(pluginPathToCheck);
      return pluginStats.isDirectory();
    } catch (accessError) {
      if (accessError.code === ERROR_CODES.NotFound) {
        return false;
      }
      return false;
    }
  }

  static async ManageGitExcludeRules(repositoryPath, rulesToAdd, rulesToRemove, logger) {
    const excludeFilePath = path.join(repositoryPath, ".git", "info", "exclude");

    try {
      try {
        await fsPromises.access(path.join(repositoryPath, ".git", "config"));
      } catch (gitConfigError) {
        return true;
      }

      let existingRules = [];
      try {
        const fileContent = await fsPromises.readFile(excludeFilePath, "utf-8");
        existingRules = fileContent.split('\n').map(rule => rule.trim()).filter(rule => rule && !rule.startsWith("#"));
      } catch (readError) {
        if (readError.code !== ERROR_CODES.NotFound) {
          if (logger && typeof logger.error === 'function') {
            //logger.error(`${currentLogPrefix} 读取文件 ${excludeFilePath} 出错: ${readError.message}`);
          }
          throw readError;
        }
      }

      let rulesSet = new Set(existingRules);
      let rulesModified = false;

      if (rulesToRemove && Array.isArray(rulesToRemove)) {
        rulesToRemove.forEach(ruleToRemoveItem => {
          if (ruleToRemoveItem && typeof ruleToRemoveItem === 'string') {
            const trimmedRule = ruleToRemoveItem.trim();
            if (rulesSet.has(trimmedRule)) {
              rulesSet.delete(trimmedRule);
              rulesModified = true;
            }
          }
        });
      }

      if (rulesToAdd && Array.isArray(rulesToAdd)) {
        rulesToAdd.forEach(ruleToAddItem => {
          if (ruleToAddItem && typeof ruleToAddItem === 'string') {
            const trimmedRule = ruleToAddItem.trim();
            if (!rulesSet.has(trimmedRule)) {
              rulesSet.add(trimmedRule);
              rulesModified = true;
            }
          }
        });
      }

      let excludeFileNowExists = false;
      try {
        await fsPromises.access(excludeFilePath);
        excludeFileNowExists = true;
      } catch (accessError) {
        if (accessError.code !== ERROR_CODES.NotFound) {
          throw accessError;
        }
      }

      if (rulesModified || (rulesSet.size > 0 && !excludeFileNowExists)) {
        const finalRulesContent = Array.from(rulesSet).join("\n") + (rulesSet.size > 0 ? "\n" : "");
        await fsPromises.mkdir(path.dirname(excludeFilePath), { recursive: true });
        await fsPromises.writeFile(excludeFilePath, finalRulesContent, "utf-8");
      }
      return true;
    } catch (error) {
      if (logger && typeof logger.error === 'function') {
        //logger.error(`${currentLogPrefix} 处理 ${repositoryPath} 失败: ${error.message}`);
      }
      return false;
    }
  }

  static async ManageOptionalGameContent(repositoryPath, gameKey, gameFolderName, logger) {
    try {
      const pluginInstalled = await MiaoPluginMBT.IsGamePluginInstalled(gameKey, logger);
      const fullGameFolderPath = path.join(repositoryPath, gameFolderName);

      if (!pluginInstalled) {
        try {
          await fsPromises.access(fullGameFolderPath);
          await safeDelete(fullGameFolderPath);
        } catch (deleteError) {
          if (deleteError.code !== ERROR_CODES.NotFound) {
            if (logger && typeof logger.warn === 'function') {
              //logger.warn(`${currentLogPrefix} 删除 ${fullGameFolderPath} (游戏: ${gameKey}) 出错: ${deleteError.code}`);
            }
          }
        }
        await MiaoPluginMBT.ManageGitExcludeRules(repositoryPath, [gameFolderName], null, logger);
      } else {
        await MiaoPluginMBT.ManageGitExcludeRules(repositoryPath, null, [gameFolderName], logger);
      }
      return true;
    } catch (error) {
      if (logger && typeof logger.error === 'function') {
        //logger.error(`${currentLogPrefix} 处理 ${gameKey} 于 ${repositoryPath} 出错: ${error.message}`);
      }
      return false;
    }
  }

  static async GetRelevantRepoPathsForGame(gameKey, logger) {
    const currentPaths = MiaoPluginMBT.paths;
    const potentialRepoConfigs = [];

    if (gameKey === "zzz") {
      if (currentPaths.LocalTuKuPath) potentialRepoConfigs.push({ path: currentPaths.LocalTuKuPath, num: 1, name: "一号库" });
      if (currentPaths.LocalTuKuPath4) potentialRepoConfigs.push({ path: currentPaths.LocalTuKuPath4, num: 4, name: "四号库" });
    } else if (gameKey === "waves") {
      if (currentPaths.LocalTuKuPath) potentialRepoConfigs.push({ path: currentPaths.LocalTuKuPath, num: 1, name: "一号库" });
      if (currentPaths.LocalTuKuPath4) potentialRepoConfigs.push({ path: currentPaths.LocalTuKuPath4, num: 4, name: "四号库" });
    }

    const downloadedRepoPaths = [];
    for (const repoConfig of potentialRepoConfigs) {
      if (await MiaoPluginMBT.IsTuKuDownloaded(repoConfig.num)) {
        downloadedRepoPaths.push(repoConfig.path);
      }
    }
    return downloadedRepoPaths;
  }

  static async ScanLocalImagesToBuildCache(logger = global.logger || console) {

    const fallbackCache = []; const ReposToScan = [];
    const repoPathsMap = {
      "Miao-Plugin-MBT": { path: MiaoPluginMBT.paths.LocalTuKuPath, num: 1 },
      "Miao-Plugin-MBT-2": { path: MiaoPluginMBT.paths.LocalTuKuPath2, num: 2 },
      "Miao-Plugin-MBT-3": { path: MiaoPluginMBT.paths.LocalTuKuPath3, num: 3 },
      "Miao-Plugin-MBT-4": { path: MiaoPluginMBT.paths.LocalTuKuPath4, num: 4 },
    };
    for (const storageBoxName in repoPathsMap) {
      const repoInfo = repoPathsMap[storageBoxName];
      if (repoInfo.path && (await MiaoPluginMBT.IsTuKuDownloaded(repoInfo.num))) {
        ReposToScan.push({ path: repoInfo.path, name: storageBoxName });
      }
    }
    //if (ReposToScan.length === 0) { logger.warn(`${Default_Config.logPrefix}没有找到本地图库仓库目录（1-4号），无法扫描。`); return []; }
    //logger.info(`${Default_Config.logPrefix}开始扫描本地仓库: ${ReposToScan.map(r => r.name).join(", ")}...`);
    const imagePathsFound = new Set();
    for (const Repo of ReposToScan) {
      for (const gameFolderKey in MiaoPluginMBT.paths.sourceFolders) {
        if (gameFolderKey === "gallery") continue;
        const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[gameFolderKey]; if (!sourceFolderName) continue;
        const gameFolderPath = path.join(Repo.path, sourceFolderName);
        try {
          await fsPromises.access(gameFolderPath);
          const characterDirs = await fsPromises.readdir(gameFolderPath, { withFileTypes: true });
          for (const charDir of characterDirs) {
            if (charDir.isDirectory()) {
              const characterName = charDir.name; const charFolderPath = path.join(gameFolderPath, characterName);
              try {
                const imageFiles = await fsPromises.readdir(charFolderPath);
                for (const imageFile of imageFiles) {
                  if (imageFile.toLowerCase().endsWith(".webp")) {
                    const relativePath = path.join(sourceFolderName, characterName, imageFile).replace(/\\/g, "/");
                    if (!imagePathsFound.has(relativePath)) {
                      fallbackCache.push({ storagebox: Repo.name, path: relativePath, characterName: characterName, attributes: {} });
                      imagePathsFound.add(relativePath);
                    }
                  }
                }
              } catch (readCharErr) { if (readCharErr.code !== ERROR_CODES.NotFound && readCharErr.code !== ERROR_CODES.Access) logger.warn(`${Default_Config.logPrefix}读取角色目录 ${charFolderPath} 失败:`, readCharErr.code); }
            }
          }
        } catch (readGameErr) { if (readGameErr.code !== ERROR_CODES.NotFound && readGameErr.code !== ERROR_CODES.Access) logger.warn(`${Default_Config.logPrefix}读取游戏目录 ${gameFolderPath} 失败:`, readGameErr.code); }
      }
    }
    //logger.info(`${Default_Config.logPrefix}扫描完成，共找到 ${fallbackCache.length} 个 .webp 图片文件。`);
    return fallbackCache;
  }

  static async LoadUserBans(forceReload = false, logger = global.logger || console) {

    if (MiaoPluginMBT._userBanSet instanceof Set && MiaoPluginMBT._userBanSet.size > 0 && !forceReload) return true;
    let data = []; let success = false;
    try {
      const content = await fsPromises.readFile(MiaoPluginMBT.paths.banListPath, "utf8");
      data = JSON.parse(content); success = true;
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        // logger.info(`${Default_Config.logPrefix}banlist.json 未找到。`);   //调式日志
        data = []; success = true;
      }
      else { logger.error(`${Default_Config.logPrefix}读取或解析失败:`, error); data = []; success = false; }
    }
    if (success && Array.isArray(data)) {
      const originalCount = data.length;
      const validBans = data.filter(item => typeof item === 'string' && item.trim() !== "").map(p => p.replace(/\\/g, "/"));
      MiaoPluginMBT._userBanSet = new Set(validBans);
      const validCount = MiaoPluginMBT._userBanSet.size;
      const invalidOrDuplicateCount = originalCount - validCount;
      if (invalidOrDuplicateCount > 0) logger.warn(`${Default_Config.logPrefix}忽略 ${invalidOrDuplicateCount} 条无效/重复。`);
      return true;
    } else {
      if (success && !Array.isArray(data)) {
        logger.error(`${Default_Config.logPrefix}banlist.json 文件内容格式错误，不是一个有效的数组！`);
      }
      MiaoPluginMBT._userBanSet = new Set();
      return false;
    }
  }

  static async SaveUserBans(logger = global.logger || console) {

    const banListPath = MiaoPluginMBT.paths.banListPath;
    try {
      const sortedBans = Array.from(MiaoPluginMBT._userBanSet).sort();
      const jsonString = JSON.stringify(sortedBans, null, 2);
      const dirPath = path.dirname(banListPath);
      try { await fsPromises.mkdir(dirPath, { recursive: true }); }
      catch (mkdirError) { logger.error(`${Default_Config.logPrefix}创建目录 ${dirPath} 失败:`, mkdirError); return false; }
      await fsPromises.writeFile(banListPath, jsonString, "utf8");
      return true;
    } catch (error) { logger.error(`${Default_Config.logPrefix}写入配置文件 ${banListPath} 或其他操作失败!`, error); return false; }
  }

  static async LoadAliasData(forceReload = false, logger = global.logger || console) {

    if (MiaoPluginMBT._aliasData && !forceReload) return true;
    const aliasSources = [
      { key: "gsAlias", path: path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "alias.js"), type: "js" },
      { key: "srAlias", path: path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "alias.js"), type: "js" },
      { key: "zzzAlias", path: path.join(MiaoPluginMBT.paths.target.zzzAliasDir, "alias.yaml"), type: "yaml" },
      { key: "wavesAlias", path: path.join(MiaoPluginMBT.paths.target.wavesAliasDir, "role.yaml"), type: "yaml" },
    ];
    const loadedAliases = {}; const combined = {}; let overallSuccess = true;
    const parseFile = async (filePath, fileType) => {
      let data = {};
      try {
        await fsPromises.access(filePath);
        if (fileType === "js") {
          const fileUrl = `file://${filePath.replace(/\\/g, "/")}?t=${Date.now()}`;
          try {
            const module = await import(fileUrl);
            if (module?.alias && typeof module.alias === 'object') data = module.alias;
            else { overallSuccess = false; }
          } catch (importErr) { if (importErr.code !== "ERR_MODULE_NOT_FOUND") { logger.error(`${Default_Config.logPrefix}导入 JS 失败 (${filePath}):`, importErr); overallSuccess = false; } }
        } else if (fileType === "yaml") {
          try {
            const content = await fsPromises.readFile(filePath, "utf8");
            const parsed = yaml.parse(content);
            if (parsed === null || typeof parsed !== 'object') data = {};
            else data = parsed;
          }
          catch (yamlErr) { logger.error(`${Default_Config.logPrefix}解析 YAML 失败 (${filePath}):`, yamlErr); overallSuccess = false; }
        }
      } catch (err) { if (err.code !== ERROR_CODES.NotFound) { logger.warn(`${Default_Config.logPrefix}读取 ${fileType} 文件失败: ${filePath}`, err.code); overallSuccess = false; } }
      return data;
    };
    await Promise.all(aliasSources.map(async ({ key, path: filePath, type }) => { const data = await parseFile(filePath, type); loadedAliases[key] = data; Object.assign(combined, data); }));
    MiaoPluginMBT._aliasData = { ...loadedAliases, combined };
    return overallSuccess;
  }

  static async LoadWavesRoleData(forceReload = false, logger = global.logger || console) {
    if (MiaoPluginMBT._wavesRoleDataMap && !forceReload) return true;

    const dataPath = MiaoPluginMBT.paths.wavesRoleDataPath;
    try {
      await fsPromises.access(dataPath);
      const content = await fsPromises.readFile(dataPath, 'utf-8');
      const jsonData = JSON.parse(content);

      if (typeof jsonData !== 'object' || jsonData === null) {
        //logger.error(`${Default_Config.logPrefix}鸣潮角色数据文件格式错误，不是一个有效的JSON对象。`);
        MiaoPluginMBT._wavesRoleDataMap = new Map();
        return false;
      }

      const roleMap = new Map();
      for (const id in jsonData) {
        const role = jsonData[id];
        if (role && role.name) {
          roleMap.set(role.name, role);
        }
      }
      MiaoPluginMBT._wavesRoleDataMap = roleMap;
      return true;

    } catch (error) {
      if (error.code !== ERROR_CODES.NotFound) {
        //logger.error(`${Default_Config.logPrefix}读取或解析鸣潮角色数据文件失败:`, error);
      }
      MiaoPluginMBT._wavesRoleDataMap = new Map();
      return false;
    }
  }

  static async GenerateAndApplyBanList(imageData, logger = global.logger || console) {
    const effectiveBanSet = MiaoPluginMBT.GenerateBanList(imageData, logger);
    await MiaoPluginMBT.ApplyBanList(effectiveBanSet, logger);
  }

  static GenerateBanList(imageData, logger = global.logger || console) {

    const effectiveBans = new Set(MiaoPluginMBT._userBanSet);
    const initialUserBansCount = effectiveBans.size;

    const pflLevel = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
    let pflPurifiedCount = 0;
    if (pflLevel > Purify_Level.NONE && Array.isArray(imageData) && imageData.length > 0) {
      imageData.forEach((d) => { if (MiaoPluginMBT.CheckIfPurifiedByLevel(d, pflLevel)) { const normalizedPath = d.path?.replace(/\\/g, "/"); if (normalizedPath && !effectiveBans.has(normalizedPath)) { effectiveBans.add(normalizedPath); pflPurifiedCount++; } } });
    } else if (pflLevel > Purify_Level.NONE) {
      logger.warn(`${Default_Config.logPrefix}PFL=${pflLevel} 但元数据无效或为空，无法执行 PFL 净化。`);
    }

    const config = MiaoPluginMBT.MBTConfig;
    const filterAi = config?.Ai === false; const filterEasterEgg = config?.EasterEgg === false; const filterLayout = config?.layout === false;
    let switchPurifiedCount = 0;
    if ((filterAi || filterEasterEgg || filterLayout) && Array.isArray(imageData) && imageData.length > 0) {
      imageData.forEach((item) => {
        const attrs = item?.attributes; if (!attrs) return; const normalizedPath = item.path?.replace(/\\/g, "/"); if (!normalizedPath) return;
        let shouldBanBySwitch = false;
        if (filterAi && attrs.isAiImage === true) shouldBanBySwitch = true;
        if (filterEasterEgg && attrs.isEasterEgg === true) shouldBanBySwitch = true;
        if (filterLayout && attrs.layout === "fullscreen") shouldBanBySwitch = true;
        if (shouldBanBySwitch && !effectiveBans.has(normalizedPath)) { effectiveBans.add(normalizedPath); switchPurifiedCount++; }
      });
    }
    MiaoPluginMBT._activeBanSet = effectiveBans;
    return MiaoPluginMBT._activeBanSet;
  }

  static CheckIfPurifiedByLevel(imgDataItem, purifyLevel) {
    if (!imgDataItem?.attributes) return false;
    const attrs = imgDataItem.attributes;
    const isRx18 = attrs.isRx18 === true || String(attrs.isRx18).toLowerCase() === "true";
    const isPx18 = attrs.isPx18 === true || String(attrs.isPx18).toLowerCase() === "true";
    if (purifyLevel === Purify_Level.RX18_ONLY) return isRx18;
    else if (purifyLevel === Purify_Level.PX18_PLUS) return isRx18 || isPx18;
    return false;
  }

  static async CheckIfPurified(relativePath, logger = global.logger || console) {
    const normalizedPath = relativePath?.replace(/\\/g, "/");
    if (!normalizedPath) return false;
    if (MiaoPluginMBT._activeBanSet.has(normalizedPath)) return true;

    // 使用 GID 索引
    const imgData = MiaoPluginMBT._indexByGid.get(normalizedPath);

    if (imgData) {
      const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
      return MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, level);
    }
    return false;
  }

  static async ApplyBanList(effectiveBanSet = MiaoPluginMBT._activeBanSet, logger = global.logger || console) {

    if (!(effectiveBanSet instanceof Set) || effectiveBanSet.size === 0) return;
    let deletedCount = 0; const deletePromises = [];
    for (const relativePath of effectiveBanSet) {
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
      if (targetPath) {
        deletePromises.push(fsPromises.unlink(targetPath).then(() => { deletedCount++; }).catch((unlinkErr) => { if (unlinkErr.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}删除 ${targetPath} 失败:`, unlinkErr.code); }));
      }
    }
    await Promise.all(deletePromises);
  }

  static async DetermineTargetPath(relativePath) {
    if (!relativePath) return null;
    const normalizedRelativePath = relativePath.replace(/\\/g, "/");
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncToCommonRes) { if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, "/")) return path.join(MiaoPluginMBT.paths.commonResPath, fileSync.destFileName); }
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncSpecific) { if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, "/")) return path.join(fileSync.destDir, fileSync.destFileName); }
    const parts = normalizedRelativePath.split("/");
    if (parts.length >= 3) {
      const sourceFolder = parts[0]; const characterNameInRepo = parts[1]; const fileName = parts.slice(2).join("/");
      let targetBaseDir = null, GameKey = null;
      if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.gs) { targetBaseDir = MiaoPluginMBT.paths.target.miaoChar; GameKey = "gs"; }
      else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.sr) { targetBaseDir = MiaoPluginMBT.paths.target.miaoChar; GameKey = "sr"; }
      else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.zzz) { targetBaseDir = MiaoPluginMBT.paths.target.zzzChar; GameKey = "zzz"; }
      else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.waves) { targetBaseDir = MiaoPluginMBT.paths.target.wavesChar; GameKey = "waves"; }

      if (targetBaseDir && GameKey) {
        const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(characterNameInRepo);
        const targetCharacterName = aliasResult.exists ? aliasResult.mainName : characterNameInRepo;
        return path.join(targetBaseDir, targetCharacterName, fileName);
      }
    }
    return null;
  }

  static async FindImageAbsolutePath(relativePath) {
    if (!relativePath) return null; const normalizedPath = relativePath.replace(/\\/g, "/");
    const logger = global.logger || console;
    const imgData = MiaoPluginMBT._indexByGid.get(normalizedPath);
    let preferredRepoPath = null; let preferredRepoNum = 0;
    if (imgData?.storagebox) {
      if (imgData.storagebox === "Miao-Plugin-MBT") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath; preferredRepoNum = 1; }
      else if (imgData.storagebox === "Miao-Plugin-MBT-2") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath2; preferredRepoNum = 2; }
      else if (imgData.storagebox === "Miao-Plugin-MBT-3") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath3; preferredRepoNum = 3; }
      else if (imgData.storagebox === "Miao-Plugin-MBT-4") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath4; preferredRepoNum = 4; }
    }
    if (preferredRepoPath && (await MiaoPluginMBT.IsTuKuDownloaded(preferredRepoNum))) {
      const absPath = path.join(preferredRepoPath, normalizedPath);
      try { await fsPromises.access(absPath, fs.constants.R_OK); return absPath; }
      catch (err) { }
    }
    const reposToSearchFallBack = [
      { path: MiaoPluginMBT.paths.LocalTuKuPath, num: 1, nameForLog: "一号仓库" },
      { path: MiaoPluginMBT.paths.LocalTuKuPath2, num: 2, nameForLog: "二号仓库" },
      { path: MiaoPluginMBT.paths.LocalTuKuPath3, num: 3, nameForLog: "三号仓库" },
      { path: MiaoPluginMBT.paths.LocalTuKuPath4, num: 4, nameForLog: "四号仓库" },
    ];
    for (const repo of reposToSearchFallBack) {
      if (!repo.path || repo.path === preferredRepoPath) continue;
      if (await MiaoPluginMBT.IsTuKuDownloaded(repo.num)) {
        const absPath = path.join(repo.path, normalizedPath);
        try { await fsPromises.access(absPath, fs.constants.R_OK); return absPath; }
        catch (err) { if (err.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}访问仓库 ${repo.nameForLog} (${absPath}) 出错:`, err.code); }
      }
    }
    //logger.warn(`${Default_Config.logPrefix}在所有已配置的常规仓库中均未找到: ${normalizedPath}`);
    return null;
  }

  static async FindRoleAliasAndMain(inputName, logger = global.logger || console) {
    const cleanInput = inputName?.trim();
    if (!cleanInput) return { mainName: null, exists: false };
    if (!MiaoPluginMBT._aliasData) {
      await MiaoPluginMBT.LoadAliasData(false, logger);
      if (!MiaoPluginMBT._aliasData?.combined) { logger.error(`${Default_Config.logPrefix}无法加载。`); const dirExistsFallback = await MiaoPluginMBT.CheckRoleDirExists(cleanInput); return { mainName: cleanInput, exists: dirExistsFallback }; }
    }
    const combinedAliases = MiaoPluginMBT._aliasData.combined || {}; const lowerInput = cleanInput.toLowerCase();
    if (combinedAliases.hasOwnProperty(cleanInput)) return { mainName: cleanInput, exists: true };
    for (const mainNameKeyInAliases in combinedAliases) { if (mainNameKeyInAliases.toLowerCase() === lowerInput) return { mainName: mainNameKeyInAliases, exists: true }; }
    for (const [mainName, aliasesValue] of Object.entries(combinedAliases)) {
      let aliasArray = [];
      if (typeof aliasesValue === 'string') aliasArray = aliasesValue.split(",").map(a => a.trim().toLowerCase());
      else if (Array.isArray(aliasesValue)) aliasArray = aliasesValue.map(a => String(a).trim().toLowerCase());
      if (aliasArray.includes(lowerInput)) return { mainName: mainName, exists: true };
    }
    const dirExists = await MiaoPluginMBT.CheckRoleDirExists(cleanInput);
    return { mainName: cleanInput, exists: dirExists };
  }

  static async CheckRoleDirExists(roleName) {
    if (!roleName) return false;
    const gameFolderKeys = Object.keys(MiaoPluginMBT.paths.sourceFolders).filter(key => key !== "gallery");
    const ReposToCheck = [];
    if (await MiaoPluginMBT.IsTuKuDownloaded(1)) ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath);
    if (await MiaoPluginMBT.IsTuKuDownloaded(2)) ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath2);
    if (await MiaoPluginMBT.IsTuKuDownloaded(3)) ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath3);
    if (await MiaoPluginMBT.IsTuKuDownloaded(4)) ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath4);
    if (ReposToCheck.length === 0) return false;
    for (const RepoPath of ReposToCheck) {
      for (const gameKey of gameFolderKeys) {
        const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[gameKey];
        const rolePath = path.join(RepoPath, sourceFolderName, roleName);
        try { await fsPromises.access(rolePath); const stats = await fsPromises.stat(rolePath); if (stats.isDirectory()) return true; } catch { }
      }
    }
    return false;
  }

  static ParseRoleIdentifier(identifier) {
    if (!identifier) return null;
    const match = identifier.trim().match(/^(.*?)(?:Gu)?(\d+)$/i);
    if (match && match[1] && match[2]) { const mainName = match[1].trim(); if (mainName) return { mainName: mainName, imageNumber: match[2] }; }
    return null;
  }

  static async SyncFilesToCommonRes(logger = global.logger || console) {
    await fsPromises.mkdir(MiaoPluginMBT.paths.commonResPath, { recursive: true });
    const failedSyncs = [];

    for (const { sourceSubPath, destFileName, copyIfExists = true, isDir = false } of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath);
      const dest = path.join(MiaoPluginMBT.paths.commonResPath, destFileName);

      let attempt = 0;
      let copied = false;
      while (attempt < 3 && !copied) {
        try {
          await fsPromises.access(source);
          if (!copyIfExists) {
            try {
              await fsPromises.access(dest);
              copied = true;
              continue;
            } catch (destAccessError) {
              if (destAccessError.code !== ERROR_CODES.NotFound) throw destAccessError;
            }
          }
          await fsPromises.mkdir(path.dirname(dest), { recursive: true });
          if (isDir) await copyFolderRecursive(source, dest, {}, logger);
          else await fsPromises.copyFile(source, dest);
          copied = true;
        } catch (error) {
          attempt++;
          if (attempt >= 3) {
            //logger.error(`${Default_Config.logPrefix}[同步公共] ${sourceSubPath} 最终失败:`, error);
            failedSyncs.push({ source: sourceSubPath, code: error.code || 'UNKNOWN' });
          } else {
            await common.sleep(500 * attempt);
          }
        }
      }
    }

    if (failedSyncs.length > 0) {
      const compositeError = new Error(`一个或多个关键资源同步失败，可能是仓库文件不完整。`);
      compositeError.code = 'SYNC_FAILED';
      compositeError.syncDetails = {
        count: failedSyncs.length,
        files: failedSyncs.map(f => f.source)
      };
      throw compositeError;
    }
  }

  static async SyncSpecificFiles(logger = global.logger || console) {
    let s = 0, f = 0;
    for (const { sourceSubPath, destDir, destFileName } of MiaoPluginMBT.paths.filesToSyncSpecific) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath);
      const dest = path.join(destDir, destFileName);
      try { await fsPromises.access(source); await fsPromises.mkdir(destDir, { recursive: true }); await fsPromises.copyFile(source, dest); s++; }
      catch (error) {
        if (error.code === ERROR_CODES.NotFound) { }
        else { logger.error(`${Default_Config.logPrefix}${sourceSubPath} -> ${dest} 失败:`, error); f++; }
      }
    }
  }

  static async SyncCharacterFolders(logger = global.logger || console) {

    const targetPluginDirs = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
    await Promise.all(targetPluginDirs.map((dir) => MiaoPluginMBT.CleanTargetCharacterDirs(dir, logger)));

    const imageDataToSync = MiaoPluginMBT._imgDataCache;
    if (!imageDataToSync || imageDataToSync.length === 0) { logger.warn(`${Default_Config.logPrefix}元数据为空，无法同步。`); return; }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) logger.warn(`${Default_Config.logPrefix}生效封禁列表未初始化或类型错误。`);
    let copied = 0, banned = 0, missingSource = 0, noTarget = 0, errorCount = 0; const promises = [];
    for (const imgData of imageDataToSync) {
      const relativePath = imgData.path?.replace(/\\/g, "/"); const storageBox = imgData.storagebox;
      if (!relativePath || !storageBox) { logger.warn(`${Default_Config.logPrefix}跳过无效元数据项: path=${relativePath}, storagebox=${storageBox}`); noTarget++; continue; }
      if (MiaoPluginMBT._activeBanSet.has(relativePath)) { banned++; continue; }

      let sourceBasePath; let repoNumForCheck;
      if (storageBox === "Miao-Plugin-MBT") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath; repoNumForCheck = 1; }
      else if (storageBox === "Miao-Plugin-MBT-2") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath2; repoNumForCheck = 2; }
      else if (storageBox === "Miao-Plugin-MBT-3") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath3; repoNumForCheck = 3; }
      else if (storageBox === "Miao-Plugin-MBT-4") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath4; repoNumForCheck = 4; }
      else { logger.warn(`${Default_Config.logPrefix}未知的 storagebox: ${storageBox} for path: ${relativePath}`); noTarget++; continue; }

      if (!sourceBasePath || !(await MiaoPluginMBT.IsTuKuDownloaded(repoNumForCheck))) {
        logger.warn(`${Default_Config.logPrefix}仓库 ${storageBox} (编号 ${repoNumForCheck}) 未定义路径或未下载，跳过图片 ${relativePath}`); missingSource++; continue;
      }
      const sourcePath = path.join(sourceBasePath, relativePath);
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
      if (targetPath) {
        let basePluginDirForThisTarget = null; const imgSourceFolderType = relativePath.split("/")[0];
        if (imgSourceFolderType === MiaoPluginMBT.paths.sourceFolders.gs || imgSourceFolderType === MiaoPluginMBT.paths.sourceFolders.sr) basePluginDirForThisTarget = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", "miao-plugin");
        else if (imgSourceFolderType === MiaoPluginMBT.paths.sourceFolders.zzz) basePluginDirForThisTarget = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", "ZZZ-Plugin");
        else if (imgSourceFolderType === MiaoPluginMBT.paths.sourceFolders.waves) basePluginDirForThisTarget = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", "waves-plugin");

        if (basePluginDirForThisTarget) {
          try { await fsPromises.access(basePluginDirForThisTarget); }
          catch (pluginAccessError) { if (pluginAccessError.code === ERROR_CODES.NotFound) { noTarget++; continue; } }
        }

        promises.push((async () => {
          try {
            await fsPromises.access(sourcePath, fs.constants.R_OK);
            try { await fsPromises.mkdir(path.dirname(targetPath), { recursive: true }); await fsPromises.copyFile(sourcePath, targetPath); copied++; }
            catch (copyErr) { errorCount++; if (copyErr.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}复制失败: ${path.basename(sourcePath)} -> ${targetPath}`, copyErr.code); }
          } catch (sourceAccessErr) {
            if (sourceAccessErr.code === ERROR_CODES.NotFound) missingSource++;
            else { errorCount++; logger.warn(`${Default_Config.logPrefix}访问源文件失败: ${sourcePath}`, sourceAccessErr.code); }
          }
        })());
      } else noTarget++;
    }
    await Promise.all(promises);
  }

  static async CleanTargetCharacterDirs(targetPluginDir, logger = global.logger || console) {
    if (!targetPluginDir) return;
    let cleanedCount = 0;
    try {
      await fsPromises.access(targetPluginDir);
      const entries = await fsPromises.readdir(targetPluginDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(targetPluginDir, entry.name);
        if (entry.isDirectory()) {
          const characterPath = entryPath;
          try {
            const files = await fsPromises.readdir(characterPath);
            const filesToDelete = files.filter((f) => f.toLowerCase().includes("gu") && f.toLowerCase().endsWith(".webp"));
            for (const fileToDelete of filesToDelete) {
              const filePath = path.join(characterPath, fileToDelete);
              try { await fsPromises.unlink(filePath); cleanedCount++; }
              catch (unlinkErr) { if (unlinkErr.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}删除文件 ${filePath} 失败:`, unlinkErr.code); }
            }
          } catch (readSubErr) { if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readSubErr.code)) logger.warn(`${Default_Config.logPrefix}读取角色子目录 ${characterPath} 失败:`, readSubErr.code); }
        } else if (entry.isFile() && entry.name.toLowerCase().includes("gu") && entry.name.toLowerCase().endsWith(".webp")) {
          const rootFilePath = entryPath;
          try { await fsPromises.unlink(rootFilePath); cleanedCount++; }
          catch (delErr) { if (delErr.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}删除根目录文件 ${rootFilePath} 失败:`, delErr.code); }
        }
      }
    } catch (readBaseErr) {
      if (readBaseErr.code !== ERROR_CODES.NotFound && readBaseErr.code !== ERROR_CODES.Access) logger.error(`${Default_Config.logPrefix}读取目标插件目录 ${targetPluginDir} 失败:`, readBaseErr);
    }
  }

  static async RestoreFileFromSource(relativePath, logger = global.logger || console) {

    const sourcePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
    if (!sourcePath) return false;
    const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
    if (!targetPath) return false;
    try {
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
      await fsPromises.copyFile(sourcePath, targetPath);
      return true;
    } catch (copyError) { logger.error(`${Default_Config.logPrefix}${relativePath} 失败:`, copyError); return false; }
  }

  static getScaleStyleValue(baseScale = 1) {
    const currentRenderScale = (MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0)
      ? MiaoPluginMBT.MBTConfig.renderScale
      : Default_Config.renderScale;
    const scalePercent = currentRenderScale ?? Default_Config.renderScale;
    const scaleFactor = Math.min(2, Math.max(0.5, (Number(scalePercent) || 100) / 100));
    const finalScale = baseScale * scaleFactor;
    return `transform:scale(${finalScale}); transform-origin: top left;`;
  }

  static async _selectRandomBackgroundImage(rendererName, logger) {
    const backgroundImagesDir = MiaoPluginMBT.paths.backgroundImgPath;
    const allowedImagesForThisReport = Default_Config.reportBackgrounds[rendererName] || [];

    const availableImagesInDir = [];
    if (allowedImagesForThisReport.length === 0) {
      // logger.debug(`${Default_Config.logPrefix}渲染器 [${rendererName}] 未配置背景图片列表。`);
      return '';
    }

    try {
      const filesInDir = await fsPromises.readdir(backgroundImagesDir);
      for (const file of filesInDir) {
        if (allowedImagesForThisReport.includes(file)) {
          availableImagesInDir.push(file);
        }
      }
    } catch (err) {
      logger.warn(`${Default_Config.logPrefix}读取背景图片目录失败或指定图片不存在: ${err.message}`);
      return '';
    }

    if (availableImagesInDir.length > 0) {
      const selectedImageName = lodash.sample(availableImagesInDir);
      return `file://${path.join(backgroundImagesDir, selectedImageName).replace(/\\/g, '/')}`;
    } else {
      logger.warn(`${Default_Config.logPrefix}未找到可用于渲染器 [${rendererName}] 的背景图片。`);
      return '';
    }
  }

  static async _getSpeedtestTemplate(logger = global.logger || console) {
    const remoteTemplateUrl = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/speedtest.html";
    const localTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "speedtest.html");
    const logPrefix = Default_Config.logPrefix;

    try {
      const response = await fetch(remoteTemplateUrl, { timeout: 5000 });
      if (!response.ok) {
        throw new Error(`获取模板失败，状态码: ${response.status}`);
      }
      const html = await response.text();
      if (!html) {
        throw new Error('获取到的在线模板内容为空');
      }
      //logger.info(`${logPrefix}成功从 Gitee 获取在线测速模板。`);
      return html;
    } catch (fetchError) {
      logger.warn(`${logPrefix}获取在线模板失败 (${fetchError.message})，将使用本地模板作为备用。`);
      try {
        return await fsPromises.readFile(localTemplatePath, 'utf-8');
      } catch (localFileError) {
        logger.error(`${logPrefix}CRITICAL: 在线和本地测速模板均无法获取！`, localFileError);
        return null;
      }
    }
  }

  static async getSpark(operationName, error, context, logger) {
    let Apple_LTO = '';
    try {
      Apple_LTO = MiaoPluginMBT._WhyNotStore();
    } catch (e) {
      logger.error("_WhyNotStore 失败:", e);
      return "云露分析失败：内部密钥处理异常。";
    }

    if (!Apple_LTO) {
      logger.error("无法获取有效的 API Password。");
      return "云露分析失败：API服务配置不完整。";
    }

    const url = "https://spark-api-open.xf-yun.com/v2/chat/completions";

    const prompt = `你是一位名为“云露”的AI诊断专家，深度集成于“Yunzai-Bot”的“咕咕牛图库管理器”插件中。你的职责是精准分析错误，并提供层次分明、高度相关的解决方案。

    **诊断思维框架：**

    **第一步：识别错误类型，并构建“核心原因”**
    *   **配置错误**: 如果细节包含 \`YAML.parse\`，核心原因：\`GuGuNiu-Gallery/GalleryConfig.yaml\` 配置文件存在语法错误。
    *   **数据错误**: 如果细节包含 \`JSON.parse\`，核心原因：\`GuGuNiu-Gallery/imagedata.json\` 或 \`banlist.json\` 数据文件格式损坏。
    *   **网络/Git问题**: 如果细节包含 \`ETIMEDOUT\`, \`Git\`, \`clone\`, \`pull\`，核心原因：在执行“<操作名称>”时，网络连接超时或Git仓库访问失败。
    *   **文件权限问题**: 如果细节包含 \`EACCES\`, \`EPERM\`，核心原因：插件在执行“<操作名称>”时，缺少对相关目录的文件读写权限。
    *   **文件/路径丢失**: 如果细节包含 \`ENOENT\`，核心原因：在执行“<操作名称>”时，找不到必要的文件或目录。
    *   **其他内部或未知错误**: 如 \`ReferenceError\`，核心原因：插件在执行“<操作名称>”时发生内部逻辑错误（例如调用了未定义的变量）。

    **第二步：基于错误类型，构建四层解决方案**
    *   **配置/数据错误**:
        1.  明确指出是哪个配置文件（如 \`GalleryConfig.yaml\`）存在语法问题。
        2.  引导用户检查文件的格式（如缩进、括号、引号）。
        3.  建议使用 \`#重置咕咕牛\` 命令来恢复默认配置。
        4.  提醒若问题持续，可联系开发者。
    *   **网络/Git错误**:
        1.  核心原因直接判定为网络访问超时或Git仓库连接失败。
        2.  首选方案是执行 \`#咕咕牛测速\` 来诊断网络节点。
        3.  其次是提醒检查系统代理或防火墙设置。
        4.  最终方案是使用 \`#重置咕咕牛\` 并重新下载。
    *   **其他所有错误**:
        1.  **日志分析**: 首选方案是使用 \`#日志\` 命令查看错误的详细上下文。
        2.  **尝试重置**: 引导用户尝试执行 \`#重置咕咕牛\` 以恢复插件初始状态。
        3.  **重启服务**: 建议重启Yunzai-Bot程序，以排除缓存或临时状态导致的问题。
        4.  **最终求助**: 引导用户联系开发者并提供完整的错误报告截图。

    **输出规则：**
    *   **格式**: 必须严格遵循“**核心原因**”和“**解决方案**”的格式。
    *   **Markdown**: 必须使用 \`**...**\` 来为标题加粗。
    *   **语言**: 专业、自信、直接，避免客套。总字数控制在120字左右。

    **待分析的错误信息：**
    - 操作: ${operationName}
    - 细节: ${error.message || 'N/A'} (代码: ${error.code || 'N/A'})
    - 上下文: ${context || '无'}`;

    const requestBody = {
      model: "x1",
      messages: [{
        role: "user",
        content: prompt
      }],
      stream: false,
      max_tokens: 150,
      temperature: 0.5,
      top_p: 0.8,
      stop: ["你好，我是云露。", "云露：", "好的，", "好的。", "您好，我是云露。", "解决方案："],
      tools: [{
        type: "web_search",
        web_search: {
          enable: false,
          search_mode: "normal"
        }
      }]
    };

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
            'Authorization': `Bearer ${Apple_LTO}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(id);

        if (!response.ok) {
          const errorBody = await response.text();
          if (response.status === 429 || response.status >= 500 || response.status === 408) {
            logger.warn(`API请求失败，状态码: ${response.status}, 响应: ${errorBody}。尝试重试 ${retryCount + 1}/${maxRetries}...`);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 500 + retryCount * 500));
            continue;
          } else {
            logger.error(`API请求失败，状态码: ${response.status}, 响应: ${errorBody}`);
            throw new Error(`API请求失败 (HTTP ${response.status})`);
          }
        }

        const responseData = await response.json();

        if (responseData.error || responseData.code !== 0) {
          const errMsg = responseData.error?.message || responseData.message || '未知API错误';
          const errCode = responseData.error?.code || responseData.code;
          logger.error(`API返回错误: ${errMsg} (code: ${errCode})`);
          if (errCode === 11200) {
            return "云露分析失败：API授权凭证无效或已过期。";
          }
          return `云露分析异常：API返回错误 (${errMsg})。`;
        }

        let aiContent = responseData.choices?.[0]?.message?.content;

        if (typeof aiContent === 'string' && aiContent.trim() !== '') {
          aiContent = aiContent.replace(/<pre[^>]*>/gi, '');
          aiContent = aiContent.replace(/<\/pre>/gi, '');
          aiContent = aiContent.replace(/<code[^>]*>/gi, '');
          aiContent = aiContent.replace(/<\/code>/gi, '');
          aiContent = aiContent.replace(/`/g, '');
          aiContent = aiContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          aiContent = aiContent.replace(/\n/g, '<br>');

          return aiContent;
        } else {
          logger.warn("API成功返回，但内容为空。响应体:", JSON.stringify(responseData));
          return "云露分析异常：API成功响应，但未返回有效解决方案。";
        }

      } catch (aiError) {
        if (aiError.name === 'AbortError' || aiError.message.includes('network error') || aiError.message.includes('Failed to fetch')) {
          logger.warn(`网络或AI服务连接异常：${aiError.message}。尝试重试 ${retryCount + 1}/${maxRetries}...`);
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 500 + retryCount * 500));
        } else {
          logger.error("云露分析过程中捕获到非网络重试异常:", aiError);
          return "云露分析失败：服务连接超时或网络异常。";
        }
      }
    }
    logger.error(`AI服务在 ${maxRetries} 次重试后仍无法响应。`);
    return "云露分析失败：多次重试后服务仍无响应。";
  }

  static async ReportError(e, operationName, error, context = "", pluginInstanceOrLogger) {
    let logger, logPrefix;
    if (pluginInstanceOrLogger && typeof pluginInstanceOrLogger.logger === 'function' && typeof pluginInstanceOrLogger.logPrefix === 'string') {
      logger = pluginInstanceOrLogger.logger;
      logPrefix = pluginInstanceOrLogger.logPrefix;
    } else if (pluginInstanceOrLogger && typeof pluginInstanceOrLogger.info === 'function') {
      logger = pluginInstanceOrLogger;
      logPrefix = Default_Config.logPrefix;
    } else {
      logger = global.logger || console;
      logPrefix = Default_Config.logPrefix;
    }

    const Report = MiaoPluginMBT.FormatError(operationName, error, context, logPrefix);
    logger.error(`${logPrefix} [${operationName}] 操作失败:`, error?.message || error, error?.stack ? `\nStack(部分): ${error.stack.substring(0, 500)}...` : "", context ? `\nContext: ${context}` : "");

    let mainReportSent = false;
    let fallbackMessages = [];

    try {
      const shortMessage = `${logPrefix} 执行 ${operationName} 操作时遇到点问题！(错误码: ${error?.code || "未知"})`;
      await e.reply(shortMessage, true);

      let aiSolutionRawText = "云露分析服务暂时无法提供解决方案。";
      try {
        aiSolutionRawText = await MiaoPluginMBT.getSpark(operationName, error, Report.contextInfo, logger);
      } catch (aiCallError) {
        logger.error(`${logPrefix} 调用云露分析失败:`, aiCallError);
      }

      const localTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "error_report.html");
      const remoteTemplateUrl = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/error_report.html";
      let templateHtml = "";
      try {
        templateHtml = await fsPromises.readFile(localTemplatePath, 'utf-8');
      } catch (localError) {
        if (localError.code === 'ENOENT') {
          const response = await fetch(remoteTemplateUrl, { timeout: 10000 });
          if (!response.ok) throw new Error(`请求失败，状态码: ${response.status}`);
          templateHtml = await response.text();
        } else {
          throw localError;
        }
      }

      const renderData = {
        pluginVersion: Version, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(), operationName: operationName,
        errorMessage: error.message || "未知错误信息", errorCode: error.code || "N/A", contextInfo: Report.contextInfo,
        suggestions: Report.suggestions.split('\n').filter(line => line.trim() !== ''),
        aiSolutionText: aiSolutionRawText,
        stackTrace: Report.stack ? (Report.stack.length > 1200 ? Report.stack.substring(0, 1200) + "..." : Report.stack) : null,
      };

      const imageBuffer = await renderPageToImage("error-report", { htmlContent: templateHtml, data: renderData, imgType: "png" }, this);

      if (imageBuffer) {
        await e.reply(imageBuffer);
        mainReportSent = true;
      } else {
        throw new Error("渲染错误报告图片返回空 Buffer。");
      }
    } catch (renderOrAiError) {
      logger.error(`${logPrefix} 渲染主错误报告失败，将使用纯文本回退:`, renderOrAiError);
      if (aiSolutionRawText && aiSolutionRawText.trim() !== '' && !aiSolutionRawText.includes('云露分析失败')) {
        fallbackMessages.push(`**云露分析**\n${aiSolutionRawText.replace(/<br>/g, '\n').replace(/<strong>/g, '**').replace(/<\/strong>/g, '**')}`);
      }
      if (Report.summary) fallbackMessages.push(Report.summary);
      if (Report.suggestions) fallbackMessages.push(`**可能原因与建议**\n${Report.suggestions}`);
    }

    if (!mainReportSent && fallbackMessages.length > 0) {
      if (common?.makeForwardMsg) {
        try {
          const forwardMsg = await common.makeForwardMsg(e, fallbackMessages, `${logPrefix} ${operationName} 失败日志`);
          if (forwardMsg) await e.reply(forwardMsg);
        } catch (forwardError) {
          await e.reply("创建合并消息失败，请查看控制台日志。");
        }
      } else {
        await e.reply("详细错误信息请查看控制台日志。");
      }
    }
  }

  static FormatError(operationName, error, context = "", logPrefixForMsg = Default_Config.logPrefix) {
    const Report = { summary: `${logPrefixForMsg} 操作 [${operationName}] 失败了！`, contextInfo: context || "（无额外上下文信息）", suggestions: "", stack: error?.stack || "（调用栈信息丢失，大概是飞升了）", };
    if (error?.message) Report.summary += `\n错误信息: ${error.message}`;
    if (error?.code) Report.summary += ` (Code: ${error.code})`;
    if (error?.signal) Report.summary += ` (Signal: ${error.signal})`;

    let matchedSuggestion = null;
    if (error?.code === ERROR_CODES.Timeout || String(error?.code).toUpperCase() === 'ETIMEDOUT') {
      matchedSuggestion = "操作超时了，等太久了...";
    }

    // 如果没有通过错误码匹配到，再走原来的关键字匹配逻辑
    if (!matchedSuggestion) {
      const errorStringForSuggestions = `${error?.message || ""} ${error?.stderr || ""} ${String(error?.code) || ""} ${context || ""}`.toLowerCase();
      const suggestionsMap = {
        "could not resolve host": "网络问题: 是不是 DNS 解析不了主机？检查下网络和 DNS 设置。",
        "connection timed out": "网络问题: 连接超时了，网不好或者对面服务器挂了？",
        "connection refused": "网络问题: 对面服务器拒绝连接，端口对吗？防火墙开了？",
        "ssl certificate problem": "网络问题: SSL 证书有问题，系统时间对不对？或者需要更新证书？",
        "403 forbidden": "访问被拒 (403): 没权限访问这个地址哦。",
        "404 not found": "资源未找到 (404): URL 写错了或者文件真的没了。",
        "unable to access": "Git 访问失败: 检查网络、URL、代理设置对不，或者的手动测速查看问题",
        "authentication failed": "Git 认证失败: 用户名密码或者 Token 不对吧？",
        "permission denied": "权限问题: Yunzai 没权限读写文件或目录，检查下文件夹权限。",
        "index file corrupt": "Git 仓库可能坏了: 试试清理 `.git/index` 文件？不行就得 #重置咕咕牛 了。",
        "lock file|index.lock": "Git 正忙着呢: 等一下下，或者手动清理 `.git/index.lock` 文件（小心点！）",
        "commit your changes or stash them": "Git 冲突: 本地文件改动了和远程对不上，试试 #更新咕咕牛 强制覆盖？",
        "not a git repository": "Git: 这地方不是个 Git 仓库啊。",
        "unrelated histories": "Git 历史冲突: 这个得 #重置咕咕牛 才能解决了。",
        "not possible to fast-forward": "Git: 无法快进合并，#更新咕咕牛 强制覆盖试试。",
        [ERROR_CODES.NotFound]: "文件系统: 找不到文件或目录，路径对吗？",
        [ERROR_CODES.Access]: "文件系统: 没权限访问这个文件或目录。",
        [ERROR_CODES.Busy]: "文件系统: 文件或目录正被占用，稍后再试试？",
        [ERROR_CODES.NotEmpty]: "文件系统: 文件夹里还有东西，删不掉。",
        [ERROR_CODES.ConnReset]: "网络: 连接突然断了。",
        "json.parse": "数据问题: JSON 文件格式不对，检查下 `imagedata.json` 或 `banlist.json`。",
        "yaml.parse": "配置问题: YAML 文件格式不对，检查下 `GalleryConfig.yaml`。",
      };

      if (error instanceof ReferenceError && error.message?.includes("is not defined")) {
        matchedSuggestion = "代码出错了: 引用了不存在的变量或函数。如果没改过代码，可能是插件Bug，快去反馈！";
      } else {
        for (const keyword in suggestionsMap) {
          const keywordToTest = ERROR_CODES[keyword] || keyword;
          const escapedKeyword = String(keywordToTest).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regex = new RegExp(escapedKeyword, "i");
          if (regex.test(errorStringForSuggestions)) {
            matchedSuggestion = suggestionsMap[keyword];
            break;
          }
        }
      }
    }

    let finalSuggestionsArray = [];
    if (matchedSuggestion) {
      finalSuggestionsArray.push(`- ${matchedSuggestion}`);
    } else {
      finalSuggestionsArray.push("- 暂时没有针对此错误的特定建议，请尝试以下通用排查方法。");
    }

    finalSuggestionsArray.push("- 请检查你的网络连接是否通畅。", "- 请检查 Yunzai-Bot 目录及插件相关目录的文件/文件夹权限。", "- 请仔细查看控制台输出的详细错误日志，特别是本条错误上下的内容。", "- 尝试重启 Yunzai-Bot 程序。");
    if (operationName.toLowerCase().includes("下载") || operationName.toLowerCase().includes("更新")) { finalSuggestionsArray.push("- 确保你的设备上已正确安装 Git，并且 Git 的路径已添加到系统环境变量中。", "- 尝试执行 `#咕咕牛测速` 命令检查网络节点状况。"); }
    if (!operationName.toLowerCase().includes("重置")) { finalSuggestionsArray.push("- 如果问题持续存在，作为最终手段，你可以尝试执行 `#重置咕咕牛` 命令，然后重新 `#下载咕咕牛` (请注意：这将清除所有咕咕牛图库相关数据和配置)。"); }
    Report.suggestions = finalSuggestionsArray.join("\n");

    const stderr = error?.stderr || ""; const stdout = error?.stdout || "";
    if (stdout || stderr) {
      Report.contextInfo += "\n\n--- Git/命令输出信息 ---";
      const maxLen = 700;
      if (stdout.trim()) { Report.contextInfo += `\n[stdout]:\n${stdout.substring(0, maxLen)}${stdout.length > maxLen ? "\n...(后面省略，完整信息请查看后台日志)" : ""}`; }
      if (stderr.trim()) {
        Report.contextInfo += `\n[stderr]:\n${stderr.substring(0, maxLen)}${stderr.length > maxLen ? "\n...(后面省略，完整信息请查看后台日志)" : ""}`;
        const criticalStderrLines = stderr.split("\n").filter(line => /fatal:|error:|warning:/i.test(line) && !/Cloning into/i.test(line) && !/^\s*$/.test(line) && !["trace:", "http.c:", "ssl.c:", "git.c:", "run-command.c:", "credential.c:", "config.c:", "advice.c:", "pktline.c:", "pack.c:", "sha1_file.c:", "remote.c:", "connect.c:", "version.c:", "sequencer.c:", "refs.c:", "commit.c:", "diff.c:", "unpack-trees.c:", "resolve-undo.c:", "notes-utils.c:"].some(p => line.trim().startsWith(p)) && !/^\s*(?:default|hint|Performance)\s/i.test(line) && !/== Info:|\s*Trying\s|\s*Connected to\s|Receiving objects:|Resolving deltas:|remote: Compressing objects:|remote: Total|remote: Enumerating objects:|remote: Counting objects:/i.test(line)).map(line => line.replace(/^remote:\s*/, "").trim()).filter(Boolean).slice(0, 5).join("\n");
        if (criticalStderrLines.trim()) Report.summary += `\nGit关键消息: ${(criticalStderrLines.length > 200 ? criticalStderrLines.substring(0, 200) + "..." : criticalStderrLines).trim()}`;
      }
    }
    return Report;
  }

  static async IsTuKuDownloaded(RepoNum = 1) {
    let gitPath = "";
    if (RepoNum === 1) gitPath = MiaoPluginMBT.paths.gitFolderPath;
    else if (RepoNum === 2) gitPath = MiaoPluginMBT.paths.gitFolderPath2;
    else if (RepoNum === 3) gitPath = MiaoPluginMBT.paths.gitFolderPath3;
    else if (RepoNum === 4) gitPath = MiaoPluginMBT.paths.gitFolderPath4;
    else return false;
    if (!gitPath) return false;
    try { await fsPromises.access(gitPath); const stats = await fsPromises.stat(gitPath); return stats.isDirectory(); }
    catch { return false; }
  }

  static async GetTuKuLog(count = 5, RepoPath, logger = global.logger || console) {

    if (!RepoPath) return null;
    const gitDir = path.join(RepoPath, ".git");
    try { await fsPromises.access(gitDir); const stats = await fsPromises.stat(gitDir); if (!stats.isDirectory()) throw new Error(".git is not a directory"); }
    catch (err) { return null; }
    const format = "%cd [%h] %s%n%b";
    const dateformat = Default_Config.gitLogDateFormat;
    const args = ["log", `-n ${Math.max(1, count)}`, `--date=${dateformat}`, `--pretty=format:${format}`];
    const gitOptions = { cwd: RepoPath };
    try { const result = await ExecuteCommand("git", args, gitOptions, 5000); return result.stdout.trim(); }
    catch (error) { logger.warn(`${Default_Config.logPrefix}Git log 失败 (${RepoPath})`); return null; }
  }

  static async _handleJsFileSync(sourceRepoPath, logger, context = 'update') {
    const logPrefix = Default_Config.logPrefix;
    const newJsFilePath = path.join(sourceRepoPath, "咕咕牛图库管理器.js");
    const oldJsFilePath = path.join(MiaoPluginMBT.paths.target.exampleJs, "咕咕牛图库管理器.js");
    try {
      const newFileContent = await fsPromises.readFile(newJsFilePath);
      const newHash = crypto.createHash('md5').update(newFileContent).digest('hex');
      let oldHash = null;

      try {
        const oldFileContent = await fsPromises.readFile(oldJsFilePath);
        oldHash = crypto.createHash('md5').update(oldFileContent).digest('hex');
      } catch (e) {
        // 旧文件不存在，很正常
        oldHash = null;
      }
      if (newHash === oldHash) {
        // logger.info(`${logPrefix}文件无变化，跳过覆盖。`);
        return false;
      }
      // 首次下载时，如果旧文件存在，说明是修复性下载，需要覆盖。如果不存在，则不覆盖。
      if (context === 'download') {
        if (oldHash) {
          //logger.info(`${logPrefix}修复性下载检测到文件不一致，执行覆盖。`);
          await fsPromises.copyFile(newJsFilePath, oldJsFilePath);
          return true; // 文件被更新
        } else {
          //logger.info(`${logPrefix}首次下载，不执行覆盖。`);
          return false;
        }
      }
      // 更新场景，只要不一致就覆盖
      if (context === 'update') {
        //logger.info(`${logPrefix}检测到文件更新，执行覆盖。`);
        await fsPromises.copyFile(newJsFilePath, oldJsFilePath);
        return true;
      }

    } catch (error) {
      //logger.error(`${logPrefix}JS覆盖处理失败:`, error);
    }
    return false;
  }

  static async DownloadRepoWithFallback(repoNum, repoUrl, branch, finalLocalPath, e, logger, sortedNodes = [], isRaceMode = false, processManager) {
    const logPrefix = Default_Config.logPrefix;
    let lastError = null;
    let repoTypeName;
    switch (repoNum) {
      case 1: repoTypeName = "核心仓库"; break;
      case 2: repoTypeName = "二号仓库"; break;
      case 3: repoTypeName = "三号仓库"; break;
      case 4: repoTypeName = "四号仓库"; break;
      default: repoTypeName = `附属仓库(${repoNum}号)`;
    }

    const tempDownloadsBaseDir = path.join(MiaoPluginMBT.paths.tempPath, "guguniu-downloads");

    if (!sortedNodes || sortedNodes.length === 0) {
      return { success: false, nodeName: "无可用源", error: new Error("没有可用的下载节点列表") };
    }

    // 竞速下载逻辑
    if (isRaceMode) {
      const raceCandidates = sortedNodes.filter(n => n.gitResult && n.gitResult.success).slice(0, 2);
      if (raceCandidates.length > 0) {
        //logger.info(`${logPrefix}[${repoTypeName}] 开始并行竞速下载，节点: ${raceCandidates.map(n => n.name).join(', ')}`);

        const raceProcessManager = new ProcessManager(logger);
        const downloadPromises = raceCandidates.map(node =>
          MiaoPluginMBT.DownloadRepoWithFallback(repoNum, repoUrl, branch, finalLocalPath, null, logger, [node], false, raceProcessManager)
        );

        try {
          const winnerResult = await Promise.any(downloadPromises.map(p => p.then(res => {
            if (res.success) return res;
            throw new Error(`节点失败: ${res.nodeName || '未知'}`);
          })));

          //logger.info(`${logPrefix}[${repoTypeName}] 竞速成功优胜节点: ${winnerResult.nodeName}。`);
          return winnerResult;
        } catch (aggregateError) {
          //logger.warn(`${logPrefix}[${repoTypeName}] 并行竞速全部失败，将降级为稳定模式逐一尝试...`);
          // 竞速失败，不立即返回，让后续的稳定模式接管
        }
      }
    }

    // 稳定模式 或 竞速降级后的稳定模式
    for (const node of sortedNodes) {
      if (!node.gitResult || !node.gitResult.success) continue;
      const maxAttempts = (node.name === "Ghfast" || node.name === "Moeyy") ? 2 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const nodeName = node.name === "GitHub" ? "GitHub(直连)" : `${node.name}(代理)`;
        const uniqueTempCloneDirName = `GuTempClone-${repoNum}-${node.name.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
        const tempRepoPath = path.join(tempDownloadsBaseDir, uniqueTempCloneDirName);

        try {
          await fsPromises.mkdir(tempRepoPath, { recursive: true });
          if (attempt > 1) {
            //logger.info(`${logPrefix}[${repoTypeName}] 节点 ${nodeName} 第 ${attempt} 次尝试...`);
            await common.sleep(1500);
          }

          let actualCloneUrl = "";
          const repoPathMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/i);
          let userAndRepoPath = repoPathMatch ? repoPathMatch[1].replace(/\.git$/, "") : null;
          if (!userAndRepoPath) { throw new Error(`无法提取仓库路径`); }
          if (node.name === "GitHub") actualCloneUrl = repoUrl;
          else if (node.cloneUrlPrefix) {
            const cleanPrefix = node.cloneUrlPrefix.replace(/\/$/, "");
            if (node.name === "GitClone") actualCloneUrl = `${cleanPrefix}/${repoUrl.replace(/^https?:\/\//, "")}`;
            else if (node.name === "Mirror" || cleanPrefix.includes("gitmirror.com")) actualCloneUrl = `${cleanPrefix}/${userAndRepoPath}`;
            else actualCloneUrl = `${cleanPrefix}/${repoUrl}`;
          } else { throw new Error(`源 ${node.name} 配置缺少 cloneUrlPrefix`); }

          const cloneArgs = ["clone", "--verbose", `--depth=${Default_Config.gitCloneDepth}`, "--progress", "-b", branch, actualCloneUrl, tempRepoPath];
          const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };
          let cloneTimeout = Default_Config.gitCloneTimeout;
          if (repoNum === 1 && node.name === "GitHub") {
            cloneTimeout = 60000;
            //logger.info(`${logPrefix}[${repoTypeName}][${nodeName}] 检测到核心库直连，超时特殊设置为: 60s`);
          } else {
            //logger.info(`${logPrefix}[${repoTypeName}][${nodeName}] 第 ${attempt} 次尝试，超时设置为: ${cloneTimeout / 1000}s`);
          }

          await ExecuteCommand("git", cloneArgs, gitOptions, cloneTimeout, null, null, null, processManager);

          if (repoNum === 1) {
            const requiredPath = "GuGuNiu-Gallery/html";
            try { await fsPromises.access(path.join(tempRepoPath, requiredPath)); }
            catch (accessError) { throw new Error(`仓库下载不完整，缺少关键目录: ${requiredPath}`); }
          }

          await safeDelete(finalLocalPath);
          await fsPromises.mkdir(path.dirname(finalLocalPath), { recursive: true });
          await fsPromises.rename(tempRepoPath, finalLocalPath);
          const gitLog = await MiaoPluginMBT.GetTuKuLog(1, finalLocalPath, logger);
          return { success: true, nodeName, error: null, gitLog };
        } catch (error) {
          lastError = error;
          //logger.warn(`${logPrefix}[${repoTypeName}] 节点 ${nodeName} 第 ${attempt} 次尝试失败:`, error.message);
          const stderr = (error.stderr || "").toLowerCase();
          if (stderr.includes("could not read from remote repository") || stderr.includes("authentication failed")) {
            //logger.error(`${logPrefix}[${repoTypeName}] 节点 ${nodeName} 遭遇认证/权限错误，将不再重试此节点。`);
            break;
          }
        } finally {
          await safeDelete(tempRepoPath);
        }
      }
    }
    return { success: false, nodeName: "所有节点失败", error: lastError || new Error("所有可用节点下载尝试均失败") };
  }

  static async UpdateSingleRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, logger) {

    let success = false;
    let hasChanges = false;
    let latestLog = null;
    let pullError = null;
    let wasForceReset = false;
    let autoSwitchedNode = null;

    const attemptUpdate = async (isRetry = false) => {
      let currentSuccess = false;
      let currentHasChanges = false;
      let currentPullError = null;
      let currentWasForceReset = false;

      try {
        let oldCommit = "";
        try {
          const revParseResult = await ExecuteCommand("git", ["rev-parse", "HEAD"], { cwd: localPath }, 5000);
          oldCommit = revParseResult.stdout.trim();
        } catch (revParseError) {
          logger.warn(`${Default_Config.logPrefix}${RepoName} 获取当前 commit 失败:`, revParseError.message);
        }

        let needsReset = false;
        let pullOutput = "";

        try {
          const pullResult = await ExecuteCommand("git", ["pull", "origin", branch, "--ff-only", "--progress"], { cwd: localPath }, Default_Config.gitPullTimeout);
          pullOutput = (pullResult.stdout || "") + (pullResult.stderr || "");
          currentSuccess = true;
        } catch (err) {
          currentPullError = err;
          pullOutput = err.stderr || "" || err.stdout || "" || err.message || String(err);
          logger.warn(`${Default_Config.logPrefix}${RepoName} 'git pull --ff-only' 失败，错误码: ${err.code}`);
          if (err.code !== 0 && ((err.stderr || "").includes("Not possible to fast-forward") || (err.stderr || "").includes("diverging") || (err.stderr || "").includes("unrelated histories") || (err.stderr || "").includes("commit your changes or stash them") || (err.stderr || "").includes("needs merge") || (err.stderr || "").includes("lock file") || (err.message || "").includes("failed"))) {
            needsReset = true;
          } else {
            currentSuccess = false;
          }
        }

        if (needsReset && !currentSuccess) {
          logger.warn(`${Default_Config.logPrefix}${RepoName} 正在执行强制重置 (git fetch & git reset --hard)...`);
          try {
            await ExecuteCommand("git", ["fetch", "origin"], { cwd: localPath }, Default_Config.gitPullTimeout);
            await ExecuteCommand("git", ["reset", "--hard", `origin/${branch}`], { cwd: localPath });
            currentSuccess = true; currentHasChanges = true; currentWasForceReset = true; currentPullError = null;
            logger.info(`${Default_Config.logPrefix}${RepoName} 强制重置成功。`);
          } catch (resetError) {
            logger.error(`${Default_Config.logPrefix}${RepoName} 强制重置失败！`);
            currentSuccess = false; currentPullError = resetError;
          }
        }

        if (currentSuccess) {
          let newCommit = "";
          try {
            const newRevParseResult = await ExecuteCommand("git", ["rev-parse", "HEAD"], { cwd: localPath }, 5000);
            newCommit = newRevParseResult.stdout.trim();
          } catch (newRevParseError) {
            logger.warn(`${Default_Config.logPrefix}${RepoName} 获取新 commit 失败:`, newRevParseError.message);
          }
          if (!currentWasForceReset) currentHasChanges = oldCommit && newCommit && oldCommit !== newCommit;
        }

        return { success: currentSuccess, hasChanges: currentHasChanges, error: currentPullError, wasForceReset: currentWasForceReset };

      } catch (innerError) {
        return { success: false, hasChanges: false, error: innerError, wasForceReset: false };
      }
    };

    const gameKeysForPreUpdateManage = ["zzz", "waves"];
    for (const gameKeyToManage of gameKeysForPreUpdateManage) {
      const gameFolderToManage = MiaoPluginMBT.paths.sourceFolders[gameKeyToManage];
      if (!gameFolderToManage) {
        continue;
      }
      let isRepoRelevant = false;
      if (gameKeyToManage === "zzz" || gameKeyToManage === "waves") {
        isRepoRelevant = (RepoNum === 1 || RepoNum === 4);
      }
      if (isRepoRelevant) {
        await MiaoPluginMBT.ManageOptionalGameContent(localPath, gameKeyToManage, gameFolderToManage, logger);
      }
    }

    await MiaoPluginMBT.gitMutex.acquire();
    try {
      let updateResult = await attemptUpdate();

      const isNetworkError = (err) => {
        if (!err) return false;
        const errorString = ((err.stderr || "") + (err.message || "")).toLowerCase();
        return errorString.includes("connection was reset") || errorString.includes("connection timed out") || errorString.includes("could not resolve host");
      };

      if (!updateResult.success && isNetworkError(updateResult.error)) {
        logger.warn(`${Default_Config.logPrefix}${RepoName} 更新失败，检测到网络问题，尝试自动切换节点...`);
    
        const allHttpTestResults = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, logger);
        const httpSurvivors = allHttpTestResults.filter(r => r.speed !== Infinity);
        if (httpSurvivors.length === 0) {
          logger.warn(`${Default_Config.logPrefix}${RepoName} 自动测速后未找到任何可用的HTTP节点。`);
        } else {
          const gitTestPromises = httpSurvivors.map(node =>
            MiaoPluginMBT.GitLsRemoteTest(Default_Config.Main_Github_URL, node.cloneUrlPrefix, node.name, logger).then(gitResult => ({ name: node.name, gitResult }))
          );
          const gitTestResults = await Promise.all(gitTestPromises);
          
          const availableSources = await MiaoPluginMBT.applySmartSelectionStrategy(allHttpTestResults, gitTestResults, logger);
          const bestSource = availableSources[0];
    
          if (bestSource) {
            const repoPathMatch = RepoUrl.match(/github\.com\/([^/]+\/[^/]+)/i);
            let userAndRepoPath = "";
            if (repoPathMatch && repoPathMatch[1]) {
              userAndRepoPath = repoPathMatch[1].replace(/\.git$/, "");
            } else {
              throw new Error(`无法从原始repoUrl (${RepoUrl}) 提取仓库路径。`);
            }
    
            let newUrl = "";
            if (bestSource.name === "GitHub") {
              newUrl = `https://github.com/${userAndRepoPath}.git`;
            } else if (bestSource.cloneUrlPrefix) {
              const cleanPrefix = bestSource.cloneUrlPrefix.replace(/\/$/, "");
              if (bestSource.name === "GitClone") {
                newUrl = `${cleanPrefix}/github.com/${userAndRepoPath}.git`;
              } else if (bestSource.name === "Mirror" || cleanPrefix.includes("gitmirror.com")) {
                newUrl = `${cleanPrefix}/${userAndRepoPath}`;
              } else {
                newUrl = `${cleanPrefix}/github.com/${userAndRepoPath}.git`;
              }
            }
    
            if (newUrl) {
              try {
                await ExecuteCommand("git", ["remote", "set-url", "origin", newUrl], { cwd: localPath });
                logger.info(`${Default_Config.logPrefix}${RepoName} 成功将远程URL切换至: ${bestSource.name} (${newUrl})`);
                autoSwitchedNode = bestSource.name;
                updateResult = await attemptUpdate(true);
              } catch (setUrlError) {
                logger.error(`${Default_Config.logPrefix}${RepoName} 切换远程URL失败:`, setUrlError);
                updateResult.error = setUrlError;
              }
            }
          } else {
            logger.warn(`${Default_Config.logPrefix}${RepoName} 自动测速后未找到可用节点。`);
          }
        }
      }

      success = updateResult.success;
      hasChanges = updateResult.hasChanges;
      pullError = updateResult.error;
      wasForceReset = updateResult.wasForceReset;
      
      const format = "%cd [%h]%n%s%n%b";
      const gitLogArgs = ["log", `-n 3`, `--date=${Default_Config.gitLogDateFormat}`, `--pretty=format:${format}`];
      let rawLogString = "";
      try {
        const logResult = await ExecuteCommand("git", gitLogArgs, { cwd: localPath }, 5000);
        rawLogString = logResult.stdout;
      } catch(logError) {
        rawLogString = "获取日志失败";
      }

      if (rawLogString) {
          const logEntries = rawLogString.split(/(?=\d{2}-\d{2}\s\d{2}:\d{2}\s+\[)/).filter(s => s.trim());
          if (logEntries.length > 0) {
              latestLog = await Promise.all(logEntries.map(async (fullCommit) => {
              const lines = fullCommit.trim().split('\n');
              const headerLine = lines.shift() || "";
              const subjectLine = lines.shift() || "";
              const bodyContent = lines.join('\n').trim();

              const commitData = { hash: 'N/A', date: '', displayParts: [], isDescription: false, descriptionTitle: '', descriptionBodyHtml: '' };
              
              const dateMatch = headerLine.match(/^(\d{2}-\d{2}\s\d{2}:\d{2})\s+/);
              if (dateMatch) { commitData.date = `[${dateMatch[1]}]`; }

              const hashMatch = headerLine.match(/\[([a-f0-9]{7,40})\]/);
              if (hashMatch) { commitData.hash = hashMatch[1]; }
              
              const gamePrefixes = [
                  { prefixPattern: /^(原神UP:|原神UP：|原神up:|原神up：)\s*/i, gameType: "gs" },
                  { prefixPattern: /^(星铁UP:|星铁UP：|星铁up:|星铁up：)\s*/i, gameType: "sr" },
                  { prefixPattern: /^(绝区零UP:|绝区零UP：|绝区零up:|绝区零up：)\s*/i, gameType: "zzz" },
                  { prefixPattern: /^(鸣潮UP:|鸣潮UP：|鸣潮up:|鸣潮up：)\s*/i, gameType: "waves" },
              ];
              
              const isCharacterUpdate = gamePrefixes.some(entry => entry.prefixPattern.test(subjectLine));
              commitData.isDescription = !isCharacterUpdate;

              if (isCharacterUpdate) {
                  for (const entry of gamePrefixes) {
                      const prefixMatchFull = subjectLine.match(entry.prefixPattern);
                      if (prefixMatchFull) {
                          const nameSegments = subjectLine.substring(prefixMatchFull[0].length).trim().split(/[/、，,]/).map(name => name.trim()).filter(Boolean);
                          for (const rawNameSegment of nameSegments) {
                              let displayName = rawNameSegment;
                              let aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(rawNameSegment, logger);
                              if (aliasResult.exists) { displayName = aliasResult.mainName; }
                              const standardNameForPath = aliasResult.exists ? aliasResult.mainName : displayName;
                              let faceImageUrl = null;
                              if (entry.gameType === "gs") {
                                  const imagePath = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "..", "character", standardNameForPath, "imgs", "face.webp");
                                  try { await fsPromises.access(imagePath); faceImageUrl = `file://${imagePath.replace(/\\/g, "/")}`; } catch (err) { }
                              } else if (entry.gameType === "sr") {
                                  const imagePath = path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "..", "character", standardNameForPath, "imgs", "face.webp");
                                  try { await fsPromises.access(imagePath); faceImageUrl = `file://${imagePath.replace(/\\/g, "/")}`; } catch (err) { }
                              } else if (entry.gameType === "zzz") {
                                  try {
                                    const files = await fsPromises.readdir(MiaoPluginMBT.paths.target.zzzDataDir);
                                    for (const file of files) {
                                      if (file.endsWith('.json')) {
                                        const data = JSON.parse(await fsPromises.readFile(path.join(MiaoPluginMBT.paths.target.zzzDataDir, file), 'utf-8'));
                                        if (data.Name === displayName || data.CodeName === displayName) {
                                          const iconMatch = data.Icon?.match(/\d+$/);
                                          if (iconMatch) {
                                            const zzzFacePath = path.join(MiaoPluginMBT.paths.target.zzzFaceDir, `IconRoleCircle${iconMatch[0]}.png`);
                                            await fsPromises.access(zzzFacePath);
                                            faceImageUrl = `file://${zzzFacePath.replace(/\\/g, "/")}`;
                                          }
                                          break;
                                        }
                                      }
                                    }
                                  } catch (err) { }
                              } else if (entry.gameType === 'waves') {
                                  const roleData = MiaoPluginMBT._wavesRoleDataMap.get(standardNameForPath);
                                  if (roleData && roleData.icon) { faceImageUrl = roleData.icon; }
                              }
                              commitData.displayParts.push({ type: 'character', name: displayName, game: entry.gameType, imageUrl: faceImageUrl });
                          }
                          break; 
                      }
                  }
              } else {
                   commitData.descriptionTitle = subjectLine;
                   if (bodyContent) {
                       let htmlBody = bodyContent
                          .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
                          .replace(/`([^`]+)`/g, '<code>$1</code>');
                      
                      const bodyLines = htmlBody.split('\n');
                      let listOpen = false;
                      htmlBody = bodyLines.map(line => {
                          line = line.trim();
                          if (line.startsWith('###')) {
                              return `<h3>${line.replace(/###\s*/, '')}</h3>`;
                          }
                          if (line.startsWith('- ')) {
                              let listItem = `<li>${line.replace(/-\s*/, '')}</li>`;
                              if (!listOpen) {
                                  listItem = '<ul>' + listItem;
                                  listOpen = true;
                              }
                              return listItem;
                          }
                          if (listOpen) {
                              listOpen = false;
                              return `</ul>` + (line ? `<p>${line}</p>` : '');
                          }
                          return line ? `<p>${line}</p>` : '';
                      }).join('');

                      if (listOpen) {
                          htmlBody += '</ul>';
                      }
                      
                      commitData.descriptionBodyHtml = htmlBody;
                   }
              }
              return commitData;
          }));
        } else {
          latestLog = [{ isDescription: true, descriptionTitle: rawLogString || "无有效提交记录", descriptionBodyHtml: ''}];
        }
      }

    } catch (outerError) {
      success = false; hasChanges = false;
      pullError = outerError;
      wasForceReset = false;
      latestLog = [{ isDescription: true, descriptionTitle: "发生意外错误，无法获取日志", descriptionBodyHtml: ''}];
    } finally {
      MiaoPluginMBT.gitMutex.release();
    }

    return { success: success, hasChanges: hasChanges, log: latestLog, error: success ? null : pullError, wasForceReset: wasForceReset, autoSwitchedNode: autoSwitchedNode };
  }

  static async GitLsRemoteTest(repoUrl, cloneUrlPrefix, nodeName, logger) {
    const logPrefix = Default_Config.logPrefix;
    let actualRepoUrl = "";

    try {
      const repoPathMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/i);
      let userAndRepoPath = repoPathMatch ? repoPathMatch[1].replace(/\.git$/, "") : null;
      if (!userAndRepoPath) {
        throw new Error(`无法从 repoUrl (${repoUrl}) 提取路径`);
      }

      if (!cloneUrlPrefix || nodeName === "GitHub") {
        actualRepoUrl = `https://github.com/${userAndRepoPath}.git`;
      } else {
        const cleanPrefix = cloneUrlPrefix.replace(/\/$/, "");
        actualRepoUrl = `${cleanPrefix}/github.com/${userAndRepoPath}.git`;
      }

      const startTime = Date.now();
      await ExecuteCommand("git", ["ls-remote", "--heads", actualRepoUrl], {}, 20000);
      const duration = Date.now() - startTime;

      return { success: true, duration: duration };

    } catch (error) {
      // logger.debug(`${logPrefix}[ls-remote][${nodeName}] 测试失败:`, error.message);
      return { success: false, duration: Infinity, error: error };
    }
  }

  static async RunPostDownloadSetup(e, logger = global.logger || console, stage = 'full') {
    const logPrefix = Default_Config.logPrefix;
    // logger.info(`${logPrefix} [诊断] === 进入 RunPostDownloadSetup (阶段: ${stage}) ===`);

    try {
      // 核心阶段 (core & full 都会执行)
      // logger.info(`${logPrefix} [诊断] 同步公共资源 (SyncFilesToCommonRes)...`);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      // logger.info(`${logPrefix} [诊断] 同步特定文件 (咕咕牛图库管理器.js)...`);
      //await MiaoPluginMBT.SyncSpecificFiles(logger);
      // logger.info(`${logPrefix} [诊断] 加载最新配置 (LoadTuKuConfig)...`);
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      if (stage === 'core') {
        // logger.info(`${logPrefix} [诊断] 核心阶段部署完成，提前退出。`);
        return; // 只执行核心部署，然后返回
      }
      //完整部署阶段 (仅 stage === 'full' 时执行) 
      // logger.info(`${logPrefix} [诊断] 加载图片元数据 (LoadImageData)...`);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      // logger.info(`${logPrefix} [诊断] 加载用户封禁列表 (LoadUserBans)...`);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      // logger.info(`${logPrefix} [诊断] 加载别名数据 (LoadAliasData)...`);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      // logger.info(`${logPrefix} [诊断] 生成并应用封禁列表 (GenerateAndApplyBanList)...`);
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        // logger.info(`${logPrefix} [诊断] 图库已启用，同步所有角色文件夹 (SyncCharacterFolders)...`);
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else {
        // logger.info(`${logPrefix} [诊断] 图库已禁用，跳过同步角色文件夹。`);
      }
      // logger.info(`${logPrefix} [诊断] 完整部署成功完成所有步骤。`);

    } catch (error) {
      logger.error(`${logPrefix} [诊断] RunPostDownloadSetup (阶段: ${stage}) 内部发生致命错误:`, error);
      if (e) await MiaoPluginMBT.ReportError(e, `安装设置 (${stage}阶段)`, error, "", logger);
      throw error;
    } finally {
      // logger.info(`${logPrefix} [诊断] === 退出 RunPostDownloadSetup (阶段: ${stage}) ===`);
    }
  }

  static async RunPostUpdateSetup(e, isScheduled = false, logger = global.logger || console) {

    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      //logger.info(`${Default_Config.logPrefix}同步特定文件...`);
      await MiaoPluginMBT.LoadWavesRoleData(true, logger);
      await MiaoPluginMBT.SyncSpecificFiles(logger);
      //logger.info(`${Default_Config.logPrefix}重新应用封禁规则...`);
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        //logger.info(`${Default_Config.logPrefix}图库已启用，正在同步更新后的角色图片...`);
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else logger.info(`${Default_Config.logPrefix}图库已禁用，跳过角色图片同步。`);

    } catch (error) {
      logger.error(`${Default_Config.logPrefix}执行过程中发生错误:`, error);
      if (!isScheduled && e) await MiaoPluginMBT.ReportError(e, "更新后设置", error, "", logger);
      else if (isScheduled) { const Report = MiaoPluginMBT.FormatError("更新后设置(定时)", error, "", logPrefix); logger.error(`${Default_Config.logPrefix}--- 定时更新后设置失败 ----\n${Report.summary}\n${Report.suggestions}\n---`); }
    }
    //MiaoPluginMBT._startConfigWatcher(logger);
  }

  static async TestProxies(baseRawUrl = RAW_URL_Repo1, logger = global.logger || console) {
    //logger.info(`${Default_Config.logPrefix}开始执行实时网络测速...`);

    const testFile = Default_Config.proxyTestFile;
    const timeoutDuration = Default_Config.proxyTestTimeout;

    const testPromises = Default_Config.proxies.map(async (proxy) => {
      let speed = Infinity;
      const proxyName = proxy.name || "未命名";

      if (proxy.testUrlPrefix === null) {
        return {
          name: proxyName,
          speed: Infinity,
          priority: proxy.priority ?? 999,
          cloneUrlPrefix: proxy.cloneUrlPrefix,
          testUrlPrefix: null
        };
      }

      try {
        const testUrl = proxy.testUrlPrefix.replace(/\/+$/, "") + "/" + testFile.replace(/^\/+/, "");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
        const startTime = Date.now();
        const response = await fetch(testUrl, {
          method: "GET",
          signal: controller.signal,
          redirect: 'follow',
          cache: 'no-store'
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          speed = Date.now() - startTime;
        }
      } catch (fetchError) {
        // 静默处理失败
      }

      return {
        name: proxyName,
        speed,
        priority: proxy.priority ?? 999,
        cloneUrlPrefix: proxy.cloneUrlPrefix,
        testUrlPrefix: proxy.testUrlPrefix
      };
    });

    const results = await Promise.all(testPromises);
    return results;
  }

  static async applySmartSelectionStrategy(allHttpTestResults, gitTestResults, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;

    if (!Array.isArray(gitTestResults)) {
      logger.error(`${logPrefix}CRITICAL: applySmartSelectionStrategy 接收到的 gitTestResults 不是一个数组！`);
      gitTestResults = [];
    }

    const gitEliteNodesMap = new Map(gitTestResults.filter(n => n.gitResult && n.gitResult.success).map(n => [n.name, n.gitResult]));
    if (gitEliteNodesMap.size === 0) {
      //logger.error(`${logPrefix}Git轻量级探测失败，所有节点的Git通道均不可用。将仅基于HTTP延迟进行排序作为备用策略。`);

      const fallbackNodes = allHttpTestResults
        .filter(r => r.speed !== Infinity)
        .sort((a, b) => a.speed - b.speed);

      if (fallbackNodes.length === 0) {
        logger.error(`${logPrefix}CRITICAL: Git探测和HTTP测速均全部失败，无法确定任何可用节点！`);
        return [];
      }

      //logger.warn(`${logPrefix}备用下载顺序 (仅HTTP): ${fallbackNodes.map(n => n.name).join(' -> ')}`);
      return fallbackNodes.map(node => ({ ...node, gitResult: { success: true, isFallback: true }, protocol: 'HTTP', latency: node.speed }));
    }

    const finalNodeList = allHttpTestResults.map(node => {
      const gitResult = gitEliteNodesMap.get(node.name) || { success: false, duration: Infinity };
      const isGitPreferred = gitResult.success;
      return {
        ...node,
        gitResult,
        protocol: isGitPreferred ? 'GIT' : 'HTTP',
        latency: isGitPreferred ? gitResult.duration : node.speed
      }
    });

    finalNodeList.sort((a, b) => {
      const aGitSuccess = a.gitResult.success;
      const bGitSuccess = b.gitResult.success;
      if (aGitSuccess && !bGitSuccess) return -1;
      if (!aGitSuccess && bGitSuccess) return 1;
      if (aGitSuccess && bGitSuccess) {
        if (a.gitResult.duration !== b.gitResult.duration) return a.gitResult.duration - b.gitResult.duration;
      }
      if (a.speed !== b.speed) return a.speed - b.speed;
      return (a.priority ?? 999) - (b.priority ?? 999);
    });

    const nodesToTry = finalNodeList.filter(n => n.gitResult.success);

    if (nodesToTry.length === 0) {
      //logger.warn(`${logPrefix}虽然有Git探测成功，但排序后无可用节点，强制启用HTTP备用策略。`);
      const fallbackNodes = allHttpTestResults
        .filter(r => r.speed !== Infinity)
        .sort((a, b) => a.speed - b.speed);
      if (fallbackNodes.length > 0) {
        return fallbackNodes.map(node => ({ ...node, gitResult: { success: true, isFallback: true }, protocol: 'HTTP', latency: node.speed }));
      }
    }

    //logger.info(`${logPrefix}最终下载顺序: ${nodesToTry.map(n => n.name).join(' -> ')}`);
    return nodesToTry;
  }

  //旧版网络测速排序逻辑
  // static GetSortedAvailableSources(speeds, includeUntestable = false, logger = global.logger || console) {
  //   if (!speeds || speeds.length === 0) return [];
  //   const available = speeds.filter((s) => { const testedOK = s.speed !== Infinity && (s.name === "GitHub" || s.cloneUrlPrefix); const untestableButValid = includeUntestable && s.testUrlPrefix === null && s.cloneUrlPrefix; return testedOK || untestableButValid; });
  //   if (available.length === 0) { logger.warn(`${Default_Config.logPrefix}没有找到任何可用的下载源！`); return []; }
  //   available.sort((a, b) => { const prioA = a.priority ?? 999; const prioB = b.priority ?? 999; if (prioA !== prioB) return prioA - prioB; const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed; const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed; return speedA - speedB; });
  //   return available;
  // }

  static async SendMasterMsg(msg, e = null, delay = 0, logger = global.logger || console) {

    let masterQQList = [];

    async function getValidMasterListInternal() {
      let mastersRaw = [];

      if (typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady && typeof Bot.ready !== 'function')) {
        let retries = 0; const maxRetries = 15;
        while ((typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady)) && retries < maxRetries) {
          if (typeof Bot !== "undefined" && ((typeof Bot.isReady === 'boolean' && Bot.isReady) || (Bot.master && Bot.master.length > 0))) break;
          await common.sleep(300 + retries * 20);
          retries++;
        }
      } else if (typeof Bot !== "undefined" && typeof Bot.ready === 'function') {
        try { await Bot.ready(); } catch (err) { /* 静默 */ }
      }

      if (typeof Bot === "undefined") {
        //logger.error(`${Default_Config.logPrefix}全局 Bot 对象在等待后仍未定义，无法获取主人。`);
        return [];
      }

      if (typeof Bot.getConfig === 'function') {
        try {
          const configMaster = Bot.getConfig('masterQQ') || Bot.getConfig('master');
          if (configMaster) {
            mastersRaw.push(...(Array.isArray(configMaster) ? configMaster : [configMaster]));
          }
        } catch (err) { /* 静默 */ }
      }

      if (mastersRaw.length === 0 && Bot.master && Bot.master.length > 0) {
        mastersRaw.push(...(Array.isArray(Bot.master) ? Bot.master : [Bot.master]));
      }

      if (mastersRaw.length === 0) {
        try {
          const configPath = path.join(MiaoPluginMBT.paths.YunzaiPath, 'config', 'config', 'other.yaml');
          if (fs.existsSync(configPath)) {
            const fileContent = fs.readFileSync(configPath, 'utf8');
            let configData = null;
            if (typeof yaml.parse === 'function') { configData = yaml.parse(fileContent); }
            else if (typeof yaml.load === 'function') { configData = yaml.load(fileContent); }

            if (configData) {
              const confMasterQQ = configData.masterQQ;
              const confMasterField = configData.master;

              if (confMasterQQ && (Array.isArray(confMasterQQ) ? confMasterQQ.length > 0 : confMasterQQ)) {
                mastersRaw.push(...(Array.isArray(confMasterQQ) ? confMasterQQ : [confMasterQQ]));
              }
              if (confMasterField) {
                if (Array.isArray(confMasterField)) {
                  const extractedFromMasterField = confMasterField.map(item => {
                    if (typeof item === 'string' && item.includes(':')) {
                      return item.split(':')[1];
                    }
                    return item;
                  });
                  mastersRaw.push(...extractedFromMasterField);
                } else if (typeof confMasterField === 'string' || typeof confMasterField === 'number') {
                  mastersRaw.push(confMasterField);
                }
              }
            }
          }
        } catch (err) {
          //logger.error(`${Default_Config.logPrefix}兜底读取 other.yaml 失败:`, err.message);
        }
      }

      const uniqueMasters = [...new Set(mastersRaw)];
      return uniqueMasters.map(id => {
        let strId = String(id).trim();
        if (strId.toLowerCase().startsWith('z') && /^[zZ][1-9][0-9]{4,14}$/.test(strId)) {
          strId = strId.substring(1);
        }
        return strId;
      }).filter(id => id && /^[1-9][0-9]{4,14}$/.test(id));
    }

    masterQQList = await getValidMasterListInternal();

    if (!masterQQList || masterQQList.length === 0) {
      //logger.warn(`${Default_Config.logPrefix}最终未能获取到有效的主人QQ列表，无法发送消息。`);
      return;
    }

    if (typeof Bot === "undefined" || typeof Bot.pickUser !== 'function') {
      //logger.error(`${Default_Config.logPrefix}Bot 对象或 Bot.pickUser 方法无效，无法发送消息。`);
      return;
    }

    if (delay > 0) {
      await common.sleep(delay);
    }

    const firstMasterId = masterQQList[0]; // 只取第一个有效的主人QQ

    try {
      const user = Bot.pickUser(firstMasterId);
      if (user && typeof user.sendMsg === 'function') {
        await user.sendMsg(msg);
        logger.info(`${Default_Config.logPrefix}消息已尝试发送给主人 ${firstMasterId}。`);
      } else {
        //logger.warn(`${Default_Config.logPrefix}未能为主人QQ ${firstMasterId} 获取到有效的用户对象或sendMsg方法。`);
      }
    } catch (sendError) {
      //logger.error(`${Default_Config.logPrefix}发送消息给主人 ${firstMasterId} 失败:`, sendError.message, sendError);
    }
  }

  async RunUpdateTask() {
    if (!MiaoPluginMBT.isGloballyInitialized) {
      this.logger.warn(`${Default_Config.logPrefix}插件未初始化，跳过本次任务。`);
      return;
    }
    this.logger.info(`${Default_Config.logPrefix}开始执行定时更新任务...`);
    const startTime = Date.now();
    let overallHasChanges = false;
    let taskError = null;
    try {
      overallHasChanges = await this.UpdateTuKu(null, true);
      this.logger.info(`${Default_Config.logPrefix}定时更新任务完成。检测到更新: ${overallHasChanges}`);
    } catch (error) {
      taskError = error;
      this.logger.error(`${Default_Config.logPrefix}定时更新任务执行期间发生意外错误:`, error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`${Default_Config.logPrefix}定时更新任务流程结束，总耗时 ${duration} 秒。`);
    }
  }

  async cleanupTempFiles() {
    const logger = global.logger || console;
    logger.info(`${Default_Config.logPrefix}开始执行临时文件清理任务...`);

    const tempHtmlBasePath = path.join(YunzaiPath, "temp", "html");
    let cleanedCount = 0;

    try {
      if (fs.existsSync(tempHtmlBasePath)) {
        const entries = await fsPromises.readdir(tempHtmlBasePath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && (entry.name.toLowerCase().startsWith("guguniu") || entry.name.toLowerCase().includes("render-"))) {
            const dirToClean = path.join(tempHtmlBasePath, entry.name);
            const success = await safeDelete(dirToClean, 3, 500);
            if (success) cleanedCount++;
          }
        }
      }
      const tempDownloadsDir = path.join(YunzaiPath, "temp", "html", "GuGuNiu", "guguniu-downloads");
      if (fs.existsSync(tempDownloadsDir)) {
        const success = await safeDelete(tempDownloadsDir, 3, 500);
        if (success) cleanedCount++;
      }
    } catch (err) {
      logger.error(`${Default_Config.logPrefix}执行清理时发生错误:`, err);
    }

    logger.info(`${Default_Config.logPrefix}任务完成，共清理了 ${cleanedCount} 个临时目录。`);
  }

  async ManualRunUpdateTask(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${Default_Config.logPrefix}抱歉，只有主人才能手动执行此任务。`, true);

    this.logger.info(`${Default_Config.logPrefix}用户 ${e.user_id} 手动触发更新任务 (#执行咕咕牛更新)...`);
    await e.reply(`${Default_Config.logPrefix}正在执行更新检查，请稍候...`, true);
    let overallHasChanges = false;
    let taskError = null;
    const startTime = Date.now();

    try {
      overallHasChanges = await this.UpdateTuKu(e, true);
      this.logger.info(`${Default_Config.logPrefix}手动触发的更新任务核心逻辑已完成。检测到更新: ${overallHasChanges}`);
    } catch (error) {
      taskError = error;
      this.logger.error(`${Default_Config.logPrefix}手动触发更新任务时发生错误:`, error);
      await MiaoPluginMBT.ReportError(e, "手动执行更新任务", error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`${Default_Config.logPrefix}手动触发更新任务流程结束，总耗时 ${duration} 秒。`);
    }
    if (!taskError) {
      if (!overallHasChanges) { // 只有在没有变化时才发送“已是最新”
        await e.reply(`${Default_Config.logPrefix}更新检查完成，图库已是最新。`, true);
      }
      // 如果有变化，UpdateTuKu 内部会发送图片报告，这里不再重复
    }
    return true;
  }

  async CheckInit(e) {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${Default_Config.logPrefix}首次触发，开始初始化...`);
      await this._initializeInstance();
    } else if (MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${Default_Config.logPrefix}初始化进行中，等待...`);
      try {
        await MiaoPluginMBT.initializationPromise;
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
      } catch (error) {
        this.logger.error(`${Default_Config.logPrefix}等待初始化时捕获到错误:`, error.message || error);
        this.isPluginInited = false;
      }
    } else {
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
    }

    if (!this.isPluginInited) {
      await e.reply(`${Default_Config.logPrefix}插件初始化失败或仍在进行中，请稍后再试。`, true);
      return false;
    }

    let coreDataValid = true;
    if (!MiaoPluginMBT.MBTConfig || Object.keys(MiaoPluginMBT.MBTConfig).length === 0) {
      this.logger.error(`${Default_Config.logPrefix}CRITICAL: 配置丢失！`);
      coreDataValid = false;
    }
    if (!Array.isArray(MiaoPluginMBT._imgDataCache)) {
      this.logger.error(`${Default_Config.logPrefix}CRITICAL: 元数据缓存无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._userBanSet instanceof Set)) {
      this.logger.error(`${Default_Config.logPrefix}CRITICAL: 用户封禁列表无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) {
      this.logger.error(`${Default_Config.logPrefix}CRITICAL: 生效封禁列表无效！`);
      coreDataValid = false;
    }
    if (!MiaoPluginMBT._aliasData) {
      this.logger.error(`${Default_Config.logPrefix}CRITICAL: 别名数据丢失！`);
      coreDataValid = false;
    }

    if (!coreDataValid) {
      await e.reply(`${Default_Config.logPrefix}内部状态错误，核心数据加载失败，请重启 Bot。`, true);
      return false;
    }

    if (MiaoPluginMBT._imgDataCache.length === 0 && (await MiaoPluginMBT.IsTuKuDownloaded(1))) {
      this.logger.warn(`${Default_Config.logPrefix}注意：图片元数据为空，部分功能可能受限。`);
    }
    return true;
  }

  async ReportError(e, operationName, error, context = "") {
    await MiaoPluginMBT.ReportError(e, operationName, error, context, this);
  }

  async DownloadTuKu(e) {
    const logPrefix = this.logPrefix;
    const logger = this.logger;
    const userId = e.user_id;
    const commandName = "DownloadTuKu";
    const cooldownDuration = 2 * 60;
    let redisKey = null;

    const startTime = Date.now();
    let overallSuccess = false;
    const allRepoStatus = [];

    const processManager = new ProcessManager(logger);

    if (userId) {
      redisKey = `Yz:GuGuNiu:${commandName}:${userId}`;
      try {
        const ttl = await redis.ttl(redisKey);
        if (ttl > 0) {
          await e.reply(`指令冷却中，剩余 ${ttl} 秒后可再次使用哦~`, true);
          return true;
        }
      } catch (redisError) {
        logger.error(`${Default_Config.logPrefix}[${commandName}] Redis (ttl) 操作失败:`, redisError);
      }
    }

    try {
      //await e.reply("${Default_Config.logPrefix} 收到！正在检查环境和仓库状态...", true);
      const tempDownloadsBaseDir = path.join(MiaoPluginMBT.paths.tempPath, "guguniu-downloads");
      try {
        await fsPromises.mkdir(tempDownloadsBaseDir, { recursive: true });
        const uniqueTestFile = path.join(tempDownloadsBaseDir, `write_test_${Date.now()}.tmp`);
        await fsPromises.writeFile(uniqueTestFile, "test");
        await fsPromises.unlink(uniqueTestFile);
      } catch (writeError) {
        throw new Error(`环境检查失败：无法写入临时目录，请检查权限。`);
      }

      const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
      const Repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
      const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
      const Repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
      const Repo3Exists = Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
      const Repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass3_Github_URL || Default_Config.Ass3_Github_URL);
      const zzzPluginInstalled = await MiaoPluginMBT.IsGamePluginInstalled("zzz");
      const wavesPluginInstalled = await MiaoPluginMBT.IsGamePluginInstalled("waves");
      const shouldCheckRepo4 = Repo4UrlConfigured && (zzzPluginInstalled || wavesPluginInstalled);
      const Repo4Exists = shouldCheckRepo4 && (await MiaoPluginMBT.IsTuKuDownloaded(4));

      const allNecessaryReposExist = Repo1Exists &&
        (!Repo2UrlConfigured || Repo2Exists) &&
        (!Repo3UrlConfigured || Repo3Exists) &&
        (!shouldCheckRepo4 || Repo4Exists);

      if (allNecessaryReposExist) {
        if (redisKey) await redis.del(redisKey);
        return e.reply(`${Default_Config.logPrefix}所有已配置的图库均已存在。`, true);
      }

      allRepoStatus.push(Repo1Exists ? { repo: 1, success: true, nodeName: '本地' } : { repo: 1, toDownload: true });
      allRepoStatus.push(Repo2UrlConfigured ? (Repo2Exists ? { repo: 2, success: true, nodeName: '本地' } : { repo: 2, toDownload: true }) : { repo: 2, nodeName: '未配置', success: true });
      allRepoStatus.push(Repo3UrlConfigured ? (Repo3Exists ? { repo: 3, success: true, nodeName: '本地' } : { repo: 3, toDownload: true }) : { repo: 3, nodeName: '未配置', success: true });
      allRepoStatus.push(shouldCheckRepo4 ? (Repo4Exists ? { repo: 4, success: true, nodeName: '本地' } : { repo: 4, toDownload: true }) : { repo: 4, nodeName: '未配置', success: true });
      //await e.reply("环境检查通过，开始进行网络节点测速...", true);

      const allHttpTestResults = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, logger);
      const httpSurvivors = allHttpTestResults.filter(r => r.speed !== Infinity);
      if (httpSurvivors.length === 0) throw new Error("无可用下载源 (所有节点HTTP测试均失败)");
      const gitTestPromises = httpSurvivors.map(node => MiaoPluginMBT.GitLsRemoteTest(Default_Config.Main_Github_URL, node.cloneUrlPrefix, node.name, logger).then(gitResult => ({ name: node.name, gitResult })));
      const gitTestResults = await Promise.all(gitTestPromises);
      const sortedNodes = await MiaoPluginMBT.applySmartSelectionStrategy(allHttpTestResults, gitTestResults, logger);
      if (!sortedNodes || sortedNodes.length === 0) throw new Error("无可用下载源 (所有测速和Git探测均失败)");

      try {
        const speedtestTemplateHtml = await MiaoPluginMBT._getSpeedtestTemplate(logger);
        if (speedtestTemplateHtml) {
          const bestSourceForReport = sortedNodes[0] || null;
          let bestNodeDisplay = "无可用源";
          if (bestSourceForReport) {
            let speedInfo = bestSourceForReport.gitResult.isFallback
              ? `${bestSourceForReport.speed}ms (HTTP)`
              : `${bestSourceForReport.gitResult.duration}ms (Git)`;
            bestNodeDisplay = `${bestSourceForReport.name} (${speedInfo})`;
          }

          const processedSpeeds = allHttpTestResults.map((s, i) => {
            const isFiniteSpeed = Number.isFinite(s.speed);
            return {
              id: String(i + 1).padStart(2, '0'),
              name: s.name,
              priority: s.priority,
              statusText: isFiniteSpeed ? `${s.speed}ms` : (s.testUrlPrefix === null ? "N/A" : "超时"),
              latencyColorClass: !isFiniteSpeed ? 'latency-timeout' : (s.speed > 3000 ? 'latency-orange' : (s.speed > 2000 ? 'latency-yellow' : 'latency-green')),
              barColorClass: !isFiniteSpeed ? 'bar-red' : (s.speed > 3000 ? 'bar-orange' : (s.speed > 2000 ? 'bar-yellow' : 'bar-green')),
              statusClass: s.testUrlPrefix === null ? 'status-na' : (isFiniteSpeed ? 'status-ok' : 'status-timeout')
            };
          });

          const tiers = { priority1: [], priority2: [], priority3: [] };
          processedSpeeds.forEach(s => {
            if (s.name === "GitHub" || s.name === "Mirror") tiers.priority2.push(s);
            else if (s.name === "GitClone") tiers.priority3.push(s);
            else tiers.priority1.push(s);
          });
          const sortTier = (arr) => arr.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
          sortTier(tiers.priority1); sortTier(tiers.priority2); sortTier(tiers.priority3);

          const renderData = {
            speeds: tiers,
            best1Display: bestNodeDisplay,
            duration: ((Date.now() - startTime) / 1000).toFixed(1),
            pluginVersion: Version,
            scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
          };

          const imageBuffer = await renderPageToImage("initial-dl-speedtest", {
            htmlContent: speedtestTemplateHtml,
            data: renderData,
            imgType: "png",
            pageBoundingRect: { selector: ".container" }
          }, logger);

          if (imageBuffer) {
            await e.reply(imageBuffer);
            await e.reply("测速结果仅供参考，实际下载将根据分层探测策略选择最佳节点", true);
          }
        }
      } catch (reportError) {
        logger.error(`${logPrefix}生成或发送初始测速报告失败:`, reportError);
        await e.reply("网络测速报告生成失败，但将继续尝试下载...");
      }

      if (redisKey) { await redis.set(redisKey, '1', { EX: cooldownDuration }); }

      const coreRepoStatus = allRepoStatus.find(s => s.repo === 1);
      if (coreRepoStatus.toDownload) {
        //logger.info(`${logPrefix}核心仓库未下载，开始下载...`);
        const coreRepoResult = await MiaoPluginMBT.DownloadRepoWithFallback(1, MiaoPluginMBT.MBTConfig.Main_Github_URL, MiaoPluginMBT.MBTConfig.SepositoryBranch, MiaoPluginMBT.paths.LocalTuKuPath, e, logger, sortedNodes, false, processManager);
        const coreIndex = allRepoStatus.findIndex(s => s.repo === 1);
        if (coreIndex !== -1) allRepoStatus[coreIndex] = { ...allRepoStatus[coreIndex], ...coreRepoResult, toDownload: false };

        if (!coreRepoResult.success) {
          throw new Error(`核心仓库下载失败 (${coreRepoResult.nodeName})`);
        }

        await MiaoPluginMBT.RunPostDownloadSetup(e, logger, 'core');
        //logger.info(`${logPrefix}核心仓库部署完成。`);

        try {
          const PROGRESS_TEMPLATE_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/download_progress.html";
          const response = await fetch(PROGRESS_TEMPLATE_URL, { timeout: 10000 });
          if (!response.ok) throw new Error(`获取进度模板失败: ${response.status}`);
          const htmlContent = await response.text();

          const renderData = {
            title: "核心仓库下载完成", subtitle: `已成功部署到本地`, nodeName: coreRepoResult.nodeName,
            progress: 100, statusMessage: "✅ 开始聚合下载附属仓库...", statusClass: "status-complete",
            pluginVersion: Version, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue()
          };

          const imageBuffer = await renderPageToImage("download-progress-core-done", { htmlContent, data: renderData, imgType: "png", pageBoundingRect: { selector: ".container" } }, logger);
          if (imageBuffer) await e.reply(imageBuffer); else throw new Error("渲染中场报告返回空Buffer");
        } catch (renderError) {
          logger.error(`${logPrefix}渲染“中场报告”失败:`, renderError);
          await e.reply("--『咕咕牛🐂』--\n核心仓已部署✅️\n开始聚合下载附属仓库...");
        }
      }

      const largeReposToDownload = [];
      const smallReposToDownload = [];

      const repoUrlMap = {
        2: MiaoPluginMBT.MBTConfig.Ass_Github_URL || Default_Config.Ass_Github_URL,
        3: MiaoPluginMBT.MBTConfig.Ass2_Github_URL || Default_Config.Ass2_Github_URL,
        4: MiaoPluginMBT.MBTConfig.Ass3_Github_URL || Default_Config.Ass3_Github_URL,
      };
      const repoPathMap = {
        2: MiaoPluginMBT.paths.LocalTuKuPath2,
        3: MiaoPluginMBT.paths.LocalTuKuPath3,
        4: MiaoPluginMBT.paths.LocalTuKuPath4,
      };

      const reposToDownload = allRepoStatus.filter(s => s.toDownload && s.repo > 1);
      reposToDownload.forEach(repo => {
        const repoInfo = {
          repoNum: repo.repo,
          url: repoUrlMap[repo.repo],
          path: repoPathMap[repo.repo],
        };
        if (repo.repo === 2 || repo.repo === 3) {
          largeReposToDownload.push(repoInfo);
        } else {
          smallReposToDownload.push(repoInfo);
        }
      });

      const downloadResults = [];
      const createDownloadTask = (repoInfo) => {
        return MiaoPluginMBT.DownloadRepoWithFallback(
          repoInfo.repoNum,
          repoInfo.url,
          MiaoPluginMBT.MBTConfig.SepositoryBranch,
          repoInfo.path,
          null,
          logger,
          sortedNodes,
          true,
          processManager
        ).then(result => ({ repo: repoInfo.repoNum, ...result }));
      };

      const firstBatchPromises = [];
      smallReposToDownload.forEach(repo => firstBatchPromises.push(createDownloadTask(repo)));
      if (largeReposToDownload.length > 0) {
        firstBatchPromises.push(createDownloadTask(largeReposToDownload[0]));
      }

      if (firstBatchPromises.length > 0) {
        const firstBatchResults = await Promise.all(firstBatchPromises);
        downloadResults.push(...firstBatchResults);
      }

      if (largeReposToDownload.length > 1) {
        const secondBatchResult = await createDownloadTask(largeReposToDownload[1]);
        downloadResults.push(secondBatchResult);
      }

      downloadResults.forEach(result => {
        const index = allRepoStatus.findIndex(s => s.repo === result.repo);
        if (index !== -1) {
          allRepoStatus[index] = { ...allRepoStatus[index], ...result, toDownload: false };
        }
      });

      let allDownloadsSucceeded = allRepoStatus.every(r => r && r.success);
      let setupSuccess = false;
      if (allDownloadsSucceeded) {
        try {
          await MiaoPluginMBT.RunPostDownloadSetup(e, logger, 'full');
          setupSuccess = true;
        } catch (setupError) {
          await this.ReportError(e, "安装部署 (full)", setupError, "所有仓库已下载，但最终配置失败。");
        }
      }
      overallSuccess = allDownloadsSucceeded && setupSuccess;

      const repoNames = { 1: "一号仓库 (核心)", 2: "二号仓库 (原神)", 3: "三号仓库 (星铁)", 4: "四号仓库 (鸣潮&绝区零)" };
      const getStatusInfo = (result) => {
        if (!result) return { name: '未知仓库', text: '状态异常', statusClass: 'status-fail', nodeName: 'N/A' };
        const repoName = repoNames[result.repo] || `仓库 ${result.repo}`;
        if (result.nodeName === '本地') return { name: repoName, text: '已存在', statusClass: 'status-local', nodeName: '本地' };
        if (result.nodeName === '未配置') return { name: repoName, text: '未配置', statusClass: 'status-na', nodeName: 'N/A' };
        if (result.success) return { name: repoName, text: result.repo === 1 ? '下载/部署成功' : '下载成功', statusClass: 'status-ok', nodeName: result.nodeName };
        return { name: repoName, text: '下载失败', statusClass: 'status-fail', nodeName: result.nodeName || '执行异常' };
      };

      const finalResultsForTemplate = allRepoStatus.map(status => getStatusInfo(status));
      const successCount = finalResultsForTemplate.filter(r => r.statusClass === 'status-ok' || r.statusClass === 'status-local').length;
      const totalCount = finalResultsForTemplate.length;
      const percent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;

      const finalReportData = {
        results: finalResultsForTemplate,
        overallSuccess: overallSuccess,
        successCount: successCount,
        totalConfigured: totalCount,
        successRate: percent,
        successRateRounded: percent,
        totalCount: totalCount,
        percent: percent,
        duration: ((Date.now() - startTime) / 1000).toFixed(1),
        pluginVersion: Version,
        isArray: Array.isArray,
      };

      try {
        const DOWNLOAD_TEMPLATE_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/download.html";
        const response = await fetch(DOWNLOAD_TEMPLATE_URL, { timeout: 10000 });
        if (!response.ok) throw new Error(`获取总结报告模板失败: ${response.status}`);
        const htmlContent = await response.text();
        const imageBuffer = await renderPageToImage("download-report-final", { htmlContent, data: finalReportData, imgType: "png", pageBoundingRect: { selector: ".wrapper" } }, logger);
        if (imageBuffer) await e.reply(imageBuffer);
        else throw new Error("渲染最终报告返回空Buffer");
      } catch (reportError) {
        logger.error(`${Default_Config.logPrefix}生成或发送最终报告时出错:`, reportError);
        await e.reply("已完成所有下载任务，但生成总结报告失败，请查看日志。");
      }

      if (overallSuccess) {
        if (e && !e.replyed) {
          await e.reply("『咕咕牛🐂』成功进入喵喵里面！").catch(() => { });
        }
        await common.sleep(1500);
        const guidanceMsg = "建议配置[净化等级]否则风险自负。发送#咕咕牛设置净化等级1可过滤R18内容。";
        await e.reply(guidanceMsg, true);
      } else {
        await e.reply("『咕咕牛🐂』部分仓库下载或部署失败，请检查的总结报告。");
      }

    } catch (error) {
      logger.error(`${logPrefix}下载流程顶层执行出错:`, error);
      if (e) {  
        const endTime = Date.now();
        await MiaoPluginMBT.ReportError(e, "下载流程", error, "", { startTime, endTime });
      }
    } finally {
      processManager.killAll('SIGTERM', 'DownloadTuKu function finished');
      if (redisKey && !overallSuccess) {
        try { await redis.del(redisKey); }
        catch (delErr) { logger.warn(`${logPrefix}[${commandName}] 下载失败后清理Redis冷却key失败:`, delErr); }
      }
    }
    return true;
  }

  async UpdateTuKu(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false;
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    let jsFileUpdated = false;

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    if (!Repo1Exists) {
      if (!isScheduled && e) await e.reply("『咕咕牛🐂』图库未下载", true);
      return false;
    }

    const Repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
    let Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const Repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
    let Repo3Exists = Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
    const Repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass3_Github_URL || Default_Config.Ass3_Github_URL);
    let Repo4Exists = Repo4UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(4));

    const zzzPluginInstalled = await MiaoPluginMBT.IsGamePluginInstalled("zzz");
    const wavesPluginInstalled = await MiaoPluginMBT.IsGamePluginInstalled("waves");

    let anyConfiguredRepoMissing = false;
    if (Repo2UrlConfigured && !Repo2Exists) anyConfiguredRepoMissing = true;
    if (Repo3UrlConfigured && !Repo3Exists) anyConfiguredRepoMissing = true;
    if (Repo4UrlConfigured && (zzzPluginInstalled || wavesPluginInstalled) && !Repo4Exists) anyConfiguredRepoMissing = true;

    if (anyConfiguredRepoMissing && !isScheduled && e) {
      await e.reply("『咕咕牛🐂』部分附属仓库未下载，建议先`#下载咕咕牛`补全。", true);
    }

    const startTime = Date.now();
    if (!isScheduled && e) await e.reply("『咕咕牛🐂』开始检查更新...", true);

    const reportResults = [];
    let overallSuccess = true;
    let overallHasChanges = false;
    const errorDetailsForForwardMsg = [];

    const processRepoResult = async (repoNum, localPath, repoDisplayName, urlConfigKeyInMBT, urlConfigKeyInDefault, branchForUpdate, isCore = false) => {
      if (repoNum === 4) {
        await MiaoPluginMBT.ManageOptionalGameContent(localPath, "zzz", MiaoPluginMBT.paths.sourceFolders.zzz, logger);
        await MiaoPluginMBT.ManageOptionalGameContent(localPath, "waves", MiaoPluginMBT.paths.sourceFolders.waves, logger);
      }

      const repoUrlForUpdate = MiaoPluginMBT.MBTConfig?.[urlConfigKeyInMBT] || Default_Config[urlConfigKeyInDefault || urlConfigKeyInMBT];
      const result = await MiaoPluginMBT.UpdateSingleRepo(isCore ? e : null, repoNum, localPath, repoDisplayName, repoUrlForUpdate, branchForUpdate, isScheduled, logger);
      overallSuccess &&= result.success;
      overallHasChanges ||= result.hasChanges;

      if (!result.success && result.error) {
        const formattedError = MiaoPluginMBT.FormatError(`更新${repoDisplayName}`, result.error, "", logPrefix);
        let errorReportText = `--- ${repoDisplayName} 更新失败 ---\n`;
        errorReportText += `${formattedError.summary}\n\n`;
        errorReportText += `**可能原因与建议**\n${formattedError.suggestions}\n\n`;
        if (result.error.stderr || result.error.stdout) {
          errorReportText += `**相关Git输出**\n${formattedError.contextInfo}`;
        }
        errorDetailsForForwardMsg.push(errorReportText);
      }

      let statusText = "";
      if (result.success) {
        if (result.autoSwitchedNode) statusText = `更新成功 (切换至${result.autoSwitchedNode})`;
        else if (result.wasForceReset) statusText = "本地冲突 (强制同步)";
        else if (result.hasChanges) statusText = "更新成功";
        else statusText = "已是最新";
      } else statusText = "更新失败";

      let statusClass = "";
      if (result.success) {
        if (result.autoSwitchedNode) {
          statusClass = "status-auto-switch"; 
        } else if (result.wasForceReset) {
          statusClass = "status-force-synced"; 
        } else if (result.hasChanges) {
          statusClass = "status-ok"; 
        } else {
          statusClass = "status-no-change"; 
        }
      } else {
        statusClass = "status-fail"; 
      }

      return { name: repoDisplayName, statusText, statusClass, error: result.error, log: result.log, wasForceReset: result.wasForceReset, autoSwitchedNode: result.autoSwitchedNode };
    };

    const branch = MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch;

    reportResults.push(await processRepoResult(1, MiaoPluginMBT.paths.LocalTuKuPath, "一号仓库", "Main_Github_URL", "Main_Github_URL", branch, true));

    const repo1Result = reportResults.find(r => r.name === "一号仓库");
    if (repo1Result && repo1Result.success) {
      jsFileUpdated = await MiaoPluginMBT._handleJsFileSync(MiaoPluginMBT.paths.LocalTuKuPath, logger, 'update');
    }
    if (Repo2UrlConfigured) { if (Repo2Exists) reportResults.push(await processRepoResult(2, MiaoPluginMBT.paths.LocalTuKuPath2, "二号仓库", "Ass_Github_URL", "Ass_Github_URL", branch)); else reportResults.push({ name: "二号仓库", statusText: "未下载", statusClass: "status-skipped" }); }
    if (Repo3UrlConfigured) { if (Repo3Exists) reportResults.push(await processRepoResult(3, MiaoPluginMBT.paths.LocalTuKuPath3, "三号仓库", "Ass2_Github_URL", "Ass2_Github_URL", branch)); else reportResults.push({ name: "三号仓库", statusText: "未下载", statusClass: "status-skipped" }); }
    if (Repo4UrlConfigured) {
      if (!zzzPluginInstalled && !wavesPluginInstalled) {
        reportResults.push({ name: "四号仓库", statusText: "未下载 (插件未安装)", statusClass: "status-skipped" });
      } else if (Repo4Exists) {
        reportResults.push(await processRepoResult(4, MiaoPluginMBT.paths.LocalTuKuPath4, "四号仓库", "Ass3_Github_URL", "Ass3_Github_URL", branch));
      } else {
        reportResults.push({ name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" });
      }
    }

    if (overallSuccess && overallHasChanges) {
      await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, logger);
    }

    const gameKeysForPostUpdateManage = ["zzz", "waves"];
    for (const gameKeyToManage of gameKeysForPostUpdateManage) {
      const gameFolderToManage = MiaoPluginMBT.paths.sourceFolders[gameKeyToManage];
      if (!gameFolderToManage) continue;
      const relevantRepoPaths = await MiaoPluginMBT.GetRelevantRepoPathsForGame(gameKeyToManage, logger);
      for (const repoPath of relevantRepoPaths) {
        await MiaoPluginMBT.ManageOptionalGameContent(repoPath, gameKeyToManage, gameFolderToManage, logger);
      }
    }

    let configChangedOnUpdate = false;
    if (!MiaoPluginMBT.MBTConfig.repoNodeInfo) MiaoPluginMBT.MBTConfig.repoNodeInfo = {};
    const repoNameMap = { "一号仓库": '1', "二号仓库": '2', "三号仓库": '3', "四号仓库": '4' };
    for (const result of reportResults) {
      if (result.autoSwitchedNode) {
        const repoNum = repoNameMap[result.name];
        if (repoNum) {
          MiaoPluginMBT.MBTConfig.repoNodeInfo[repoNum] = result.autoSwitchedNode;
          configChangedOnUpdate = true;
        }
      }
    }
    if (configChangedOnUpdate) {
      await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const now = new Date();
    const reportTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}   ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const reportData = { pluginVersion: Version, duration, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(), results: reportResults, overallSuccess, overallHasChanges, isArray: Array.isArray, reportTime: reportTime, };

    let imageBuffer = null;
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "update_report.html");
    try {
      await fsPromises.access(sourceHtmlPath);
      imageBuffer = await renderPageToImage("update-report", { tplFile: sourceHtmlPath, data: reportData, imgType: "png", pageGotoParams: { waitUntil: "networkidle0" }, pageBoundingRect: { selector: ".container" }, }, this);
    } catch (accessOrRenderError) { logger.error(`${Default_Config.logPrefix}模板访问或渲染时出错:`, accessOrRenderError); }

    const shouldNotifyMaster = isScheduled && (reportData.overallHasChanges || !reportData.overallSuccess);
    if (imageBuffer) {
      if (!isScheduled && e) {
        await e.reply(imageBuffer);
        if (!overallSuccess && errorDetailsForForwardMsg.length > 0) {
          await common.sleep(500);
          try {
            const forwardMsg = await common.makeForwardMsg(e, errorDetailsForForwardMsg, "咕咕牛更新失败详情");
            await e.reply(forwardMsg);
          } catch (fwdError) {
            logger.error(`${Default_Config.logPrefix}发送详细错误合并消息失败:`, fwdError);
            await e.reply("生成详细错误报告失败，请查看控制台日志。");
          }
        }
      } else if (shouldNotifyMaster) {
        logger.info(`${Default_Config.logPrefix}检测到变更或错误，准备向主人发送报告...`);
        await MiaoPluginMBT.SendMasterMsg(imageBuffer, e, 0, logger);
        if (!overallSuccess && errorDetailsForForwardMsg.length > 0) {
          await MiaoPluginMBT.SendMasterMsg(await common.makeForwardMsg(e, errorDetailsForForwardMsg, "咕咕牛定时更新失败详情"), e, 1000, logger);
        }
      }
    } else {
      logger.error(`${Default_Config.logPrefix}Puppeteer 生成更新报告图片失败 (返回空)。`);
      let fallbackMsg = `${Default_Config.logPrefix}更新检查完成。\n`;
      reportResults.forEach((res) => { fallbackMsg += `${res.name}: ${res.statusText}\n`; if (res.error && res.error.message) fallbackMsg += `  错误: ${res.error.message.split("\n")[0]}\n`; });
      if (e && !isScheduled) await e.reply(fallbackMsg);
      else if (shouldNotifyMaster) await MiaoPluginMBT.SendMasterMsg(fallbackMsg, e, 0, logger);
    }

    if (jsFileUpdated) {
      const restartMessage = `${Default_Config.logPrefix}检测到插件核心逻辑已更新！为确保所有功能正常，强烈建议重启机器人。`;
      if (!isScheduled && e) {
        await e.reply(restartMessage, true).catch(err => logger.error("发送重启建议消息失败:", err));
      } else if (shouldNotifyMaster) {
        await MiaoPluginMBT.SendMasterMsg(restartMessage);
      }
    }

    logger.info(`${Default_Config.logPrefix}更新流程结束，耗时 ${duration} 秒。`);
    return overallHasChanges;
  }

  async ManageTuKu(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${Default_Config.logPrefix}这个操作只有我的主人才能用哦~`, true);

    const msg = e.msg.trim();
    if (msg !== "#重置咕咕牛") return false;


    if (MiaoPluginMBT._configWatcher) {
      MiaoPluginMBT._configWatcher.close();
      MiaoPluginMBT._configWatcher = null;
      //logger.info(`${this.logPrefix} [重置] 已关闭配置文件监控器。`);
    }
    const startMessage = "开始重置图库，请稍等...";
    await e.reply(startMessage, true);

    let mainDirsDeleteSuccess = true;
    let pluginDirsCleanSuccess = true;
    let tempDirsCleanSuccess = true;
    let firstError = null;
    const errorOperations = [];

    const pathsToDeleteDirectly = [
      MiaoPluginMBT.paths.LocalTuKuPath, MiaoPluginMBT.paths.LocalTuKuPath2,
      MiaoPluginMBT.paths.LocalTuKuPath3, MiaoPluginMBT.paths.LocalTuKuPath4,
      MiaoPluginMBT.paths.commonResPath
    ].filter(Boolean);

    for (const dirPath of pathsToDeleteDirectly) {
      try {
        await safeDelete(dirPath, 3, 1000, true);
      } catch (err) {
        mainDirsDeleteSuccess = false;
        const opName = `删除核心目录 ${path.basename(dirPath)}`;
        errorOperations.push(opName);
        if (!firstError) firstError = { operation: opName, error: err };
      }
    }

    const tempHtmlBasePath = path.join(MiaoPluginMBT.paths.YunzaiPath, "temp", "html");
    try {
      if (fs.existsSync(tempHtmlBasePath)) {
        const entries = await fsPromises.readdir(tempHtmlBasePath, { withFileTypes: true });
        const cleanupPromises = [];
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.toLowerCase().includes("guguniu")) {
            const dirToClean = path.join(tempHtmlBasePath, entry.name);
            cleanupPromises.push(
              (async () => {
                try {
                  await safeDelete(dirToClean);
                } catch (err) { // 捕获safeDelete抛出的错误
                  tempDirsCleanSuccess = false;
                  const opName = `清理临时目录 ${entry.name}`;
                  errorOperations.push(opName);
                  if (!firstError) firstError = { operation: opName, error: err };
                }
              })()
            );
          }
        }
        await Promise.all(cleanupPromises);
      }
    } catch (err) { // 这个catch是捕获readdir等操作的错误
      tempDirsCleanSuccess = false;
      const opName = `扫描或清理temp/html`;
      errorOperations.push(opName);
      if (!firstError) firstError = { operation: opName, error: err };
    }

    const targetPluginDirs = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
    for (const dirPath of targetPluginDirs) {
      if (!dirPath) continue;
      try {
        await MiaoPluginMBT.CleanTargetCharacterDirs(dirPath, this.logger);
      }
      catch (err) {
        pluginDirsCleanSuccess = false;
        const opName = `清理插件资源 ${path.basename(dirPath)}`;
        errorOperations.push(opName);
        if (!firstError) firstError = { operation: opName, error: err };
      }
    }

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      MiaoPluginMBT.MBTConfig = {}; MiaoPluginMBT._imgDataCache = Object.freeze([]); MiaoPluginMBT._userBanSet = new Set();
      MiaoPluginMBT._activeBanSet = new Set(); MiaoPluginMBT._aliasData = null; MiaoPluginMBT.isGloballyInitialized = false;
      MiaoPluginMBT.initializationPromise = null; this.isPluginInited = false;
      MiaoPluginMBT._remoteBanCount = 0;
    });

    const overallSuccess = mainDirsDeleteSuccess && pluginDirsCleanSuccess && tempDirsCleanSuccess;

    if (overallSuccess) {
      const successMessageBase = "重置完成！所有相关文件和缓存都清理干净啦。";
      await e.reply(successMessageBase, true);
    } else {
      if (firstError && firstError.error) { // 确保 firstError.error 存在
        let contextMessage = "";
        if (errorOperations.length > 1) {
          contextMessage = `在执行以下多个操作时可能均存在问题: ${errorOperations.join(", ")}。以下是捕获到的第一个错误详情：`;
        } else if (errorOperations.length === 1 && errorOperations[0] !== firstError.operation) {
          contextMessage = `操作 ${errorOperations[0]} 可能也存在问题。以下是捕获到的第一个错误详情：`;
        }
        // 现在传递给 ReportError 的 error 对象是 safeDelete 抛出的包含具体 code 的错误
        await MiaoPluginMBT.ReportError(e, `重置咕咕牛 (${firstError.operation})`, firstError.error, contextMessage);
      } else {
        const failureMessage = "重置过程中出了点问题，但未捕获到具体错误原因，请检查日志吧！";
        await e.reply(failureMessage, true);
        logger.warn(`${Default_Config.logPrefix}重置操作标记为失败，但没有捕获到有效的firstError对象。`);
      }
    }
    return true;
  }

  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;

    const logger = this.logger;
    const currentLogPrefix = this.logPrefix;
    const totalRobotPath = MiaoPluginMBT.paths.YunzaiPath;

    const repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    if (!repo1Exists) {
      return e.reply("『咕咕牛🐂』图库还没下载呢，先 `#下载咕咕牛` 吧！", true);
    }

    const repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
    const repo2Exists = repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
    const repo3Exists = repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
    const repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass3_Github_URL || Default_Config.Ass3_Github_URL);
    const repo4Exists = repo4UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(4));

    let missingConfiguredSubsidiary = false;
    if (repo2UrlConfigured && !repo2Exists) missingConfiguredSubsidiary = true;
    if (repo3UrlConfigured && !repo3Exists) missingConfiguredSubsidiary = true;
    if (repo4UrlConfigured && !repo4Exists) missingConfiguredSubsidiary = true;

    if (repo1Exists && missingConfiguredSubsidiary) {
      await e.reply("『咕咕牛🐂』核心仓库已下载，但部分附属仓库未下载或丢失。建议先 `#下载咕咕牛` 补全或 `#重置咕咕牛` 后重新下载。", true);
    }

    try {
      const pluginVersionForStatus = Version;
      const gameFoldersMapForStatus = { gs: "原神", sr: "星铁", zzz: "绝区零", waves: "鸣潮" };
      const sourceGalleryToGameKey = {
        "gs-character": "gs",
        "sr-character": "sr",
        "zzz-character": "zzz",
        "waves-character": "waves"
      };

      let totalRobotSize = 0;
      try {
        totalRobotSize = await FolderSize(totalRobotPath);
      } catch (err) {
        logger.error(`${currentLogPrefix}获取机器人总大小失败 (FolderSize(${totalRobotPath})): ${err.code || err.message}`);
      }

      let diskTotalBytes = 0;
      let diskFreeBytes = 0;
      let diskUsedBytes = 0;
      let diskUsedPercentage = 0;

      try {
        const drivePath = process.platform === 'win32' ? path.parse(totalRobotPath).root : '/';
        const diskStats = await statfs(drivePath);
        diskTotalBytes = diskStats.blocks * diskStats.bsize;
        diskFreeBytes = diskStats.bfree * diskStats.bsize;
        diskUsedBytes = diskTotalBytes - diskFreeBytes;
        diskUsedPercentage = diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes * 100) : 0;
      } catch (err) {
        logger.error(`${currentLogPrefix}获取硬盘统计信息失败 (statfs(${drivePath})): ${err.code || err.message}`);
      }

      let installationTime = 'N/A';
      let installedDaysText = '';

      try {
        const stats = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath);
        installationTime = new Date(stats.birthtime).toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        const diffMs = Date.now() - stats.birthtimeMs;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        installedDaysText = `${diffDays}`;
      } catch (statError) {
        //logger.warn(`${currentLogPrefix} 无法获取 Miao-Plugin-MBT 目录创建时间: ${statError.message}`);
      }

      const repoNodeInfo = MiaoPluginMBT.MBTConfig.repoNodeInfo || {};
      const statsData = {
        meta: {
          roles: 0,
          images: 0,
          games: {},
          gameRoles: {}
        },
        scan: {
          roles: 0,
          images: 0,
          gameImages: {},
          gameRoles: {},
          gameSizes: {},
          gameSizesFormatted: {},
          totalSize: 0, totalGitSize: 0, totalFilesSize: 0,
          totalSizeFormatted: "0 B", totalGitSizeFormatted: "0 B", totalFilesSizeFormatted: "0 B"
        },
        repos: {
          1: { name: "一号仓库", nodeName: repoNodeInfo['1'] || '未知', exists: repo1Exists, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          2: { name: "二号仓库", nodeName: repoNodeInfo['2'] || '未知', exists: repo2Exists && repo2UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          3: { name: "三号仓库", nodeName: repoNodeInfo['3'] || '未知', exists: repo3Exists && repo3UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          4: { name: "四号仓库", nodeName: repoNodeInfo['4'] || '未知', exists: repo4Exists && repo4UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
        },
      };

      Object.values(gameFoldersMapForStatus).forEach(chineseGameName => {
        statsData.meta.games[chineseGameName] = 0;
        statsData.meta.gameRoles[chineseGameName] = 0;
        statsData.scan.gameImages[chineseGameName] = 0;
        statsData.scan.gameRoles[chineseGameName] = 0;
        statsData.scan.gameSizes[chineseGameName] = 0;
        statsData.scan.gameSizesFormatted[chineseGameName] = "0 B";
      });

      const currentConfig = MiaoPluginMBT.MBTConfig;
      const isSerialMode = (currentConfig?.Execution_Mode ?? 'Batch') === 'Serial';

      const configDataForRender = {
        remoteBansCount: MiaoPluginMBT._remoteBanCount || 0,
        pflLevel: currentConfig?.PFL ?? Default_Config.defaultPfl,
        pflDesc: Purify_Level.getDescription(currentConfig?.PFL ?? Default_Config.defaultPfl),
        activeBans: MiaoPluginMBT._activeBanSet?.size ?? 0,
        userBans: MiaoPluginMBT._userBanSet?.size ?? 0,
        purifiedBans: Math.max(0, (MiaoPluginMBT._activeBanSet?.size ?? 0) - (MiaoPluginMBT._userBanSet?.size ?? 0)),
        aiEnabled: currentConfig?.Ai ?? true,
        aiStatusText: (currentConfig?.Ai ?? true) ? "开启" : "关闭",
        easterEggEnabled: currentConfig?.EasterEgg ?? true,
        easterEggStatusText: (currentConfig?.EasterEgg ?? true) ? "开启" : "关闭",
        layoutEnabled: currentConfig?.layout ?? true,
        layoutStatusText: (currentConfig?.layout ?? true) ? "开启" : "关闭",
        executionMode: {
          text: isSerialMode ? "已开启" : "已关闭",
          class: isSerialMode ? 'config-value-enabled' : 'config-value-disabled'
        },
        installationTime: installationTime,
        installedDaysText: installedDaysText
      };

      const characterSetForStatus = new Set();
      const metaGameCharacterSets = {};

      if (Array.isArray(MiaoPluginMBT._imgDataCache) && MiaoPluginMBT._imgDataCache.length > 0) {
        statsData.meta.images = MiaoPluginMBT._imgDataCache.length;
        MiaoPluginMBT._imgDataCache.forEach((item) => {
          if (item && item.characterName && item.sourceGallery) {
            characterSetForStatus.add(item.characterName);

            const gameKey = sourceGalleryToGameKey[item.sourceGallery];
            const chineseGameName = gameFoldersMapForStatus[gameKey];

            if (chineseGameName) {
              statsData.meta.games[chineseGameName]++;
              if (!metaGameCharacterSets[chineseGameName]) {
                metaGameCharacterSets[chineseGameName] = new Set();
              }
              metaGameCharacterSets[chineseGameName].add(item.characterName);
            } else {
              logger.warn(`${currentLogPrefix} 元数据中发现未知 sourceGallery 值: ${item.sourceGallery} (图片: ${item.path})`);
            }
          }
        });
        Object.values(gameFoldersMapForStatus).forEach(chineseGameName => {
          statsData.meta.gameRoles[chineseGameName] = metaGameCharacterSets[chineseGameName]?.size || 0;
        });
      }
      statsData.meta.roles = characterSetForStatus.size;

      const repoStatsScanConfig = {
        1: { path: MiaoPluginMBT.paths.LocalTuKuPath, gitPath: MiaoPluginMBT.paths.gitFolderPath, exists: repo1Exists, isContentRepo: true },
        2: { path: MiaoPluginMBT.paths.LocalTuKuPath2, gitPath: MiaoPluginMBT.paths.gitFolderPath2, exists: repo2Exists && repo2UrlConfigured, isContentRepo: true },
        3: { path: MiaoPluginMBT.paths.LocalTuKuPath3, gitPath: MiaoPluginMBT.paths.gitFolderPath3, exists: repo3Exists && repo3UrlConfigured, isContentRepo: true },
        4: { path: MiaoPluginMBT.paths.LocalTuKuPath4, gitPath: MiaoPluginMBT.paths.gitFolderPath4, exists: repo4Exists && repo4UrlConfigured, isContentRepo: false },
      };
      const scannedRoleImageCountsByGame = {};
      const scannedGameSizes = {};

      Object.values(gameFoldersMapForStatus).forEach(chineseGameName => {
        scannedRoleImageCountsByGame[chineseGameName] = {};
        scannedGameSizes[chineseGameName] = 0;
      });

      let totalGitSizeScanned = 0;
      let totalFilesSizeScanned = 0;

      for (const repoNumStr of Object.keys(repoStatsScanConfig)) {
        const repoNum = parseInt(repoNumStr, 10);
        const repoInfo = repoStatsScanConfig[repoNumStr];
        if (!repoInfo.exists) continue;

        let repoGitSize = 0;
        let repoFilesSize = 0;
        try { repoGitSize = await FolderSize(repoInfo.gitPath); }
        catch (sizeError) { statsData.repos[repoNum].gitSizeFormatted = "错误"; }
        statsData.repos[repoNum].gitSize = repoGitSize;
        statsData.repos[repoNum].gitSizeFormatted = FormatBytes(repoGitSize);
        totalGitSizeScanned += repoGitSize;

        if (repoInfo.isContentRepo) {
          for (const gameKey in gameFoldersMapForStatus) {
            const chineseGameName = gameFoldersMapForStatus[gameKey];
            const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[gameKey];

            if (!sourceFolderName || gameKey === "gallery") continue;

            const gameFolderPath = path.join(repoInfo.path, sourceFolderName);
            try {
              await fsPromises.access(gameFolderPath);
              const characterDirs = await fsPromises.readdir(gameFolderPath, { withFileTypes: true });
              for (const charDir of characterDirs) {
                if (charDir.isDirectory()) {
                  const characterName = charDir.name;
                  const charFolderPath = path.join(gameFolderPath, characterName);
                  let imageCountInCharDir = 0;
                  try {
                    await fsPromises.access(charFolderPath);
                    const imageFiles = await fsPromises.readdir(charFolderPath, { withFileTypes: true });
                    for (const imageFile of imageFiles) {
                      const supportedScanExt = [".jpg", ".png", ".jpeg", ".webp", ".bmp"];
                      if (imageFile.isFile() && supportedScanExt.includes(path.extname(imageFile.name).toLowerCase())) {
                        imageCountInCharDir++;
                        const imagePath = path.join(charFolderPath, imageFile.name);
                        try { const fileStat = await fsPromises.stat(imagePath); scannedGameSizes[chineseGameName] = (scannedGameSizes[chineseGameName] || 0) + fileStat.size; repoFilesSize += fileStat.size; }
                        catch (statErr) { }
                      }
                    }
                  } catch (readCharErr) { }
                  if (imageCountInCharDir > 0) {
                    scannedRoleImageCountsByGame[chineseGameName][characterName] = (scannedRoleImageCountsByGame[chineseGameName][characterName] || 0) + imageCountInCharDir;
                  }
                }
              }
            } catch (accessGameErr) { }
          }
        } else {
          try { repoFilesSize = Math.max(0, (await FolderSize(repoInfo.path)) - repoGitSize); }
          catch (sizeError) { statsData.repos[repoNum].filesSizeFormatted = "错误"; }
        }
        statsData.repos[repoNum].filesSize = repoFilesSize;
        statsData.repos[repoNum].filesSizeFormatted = FormatBytes(repoFilesSize);
        statsData.repos[repoNum].size = repoGitSize + repoFilesSize;
        statsData.repos[repoNum].sizeFormatted = FormatBytes(statsData.repos[repoNum].size);
        totalFilesSizeScanned += repoFilesSize;
      }

      const scanResultData = statsData.scan;
      scanResultData.totalGitSize = totalGitSizeScanned;
      scanResultData.totalGitSizeFormatted = FormatBytes(totalGitSizeScanned);
      scanResultData.totalFilesSize = totalFilesSizeScanned;
      scanResultData.totalFilesSizeFormatted = FormatBytes(totalFilesSizeScanned);

      Object.values(gameFoldersMapForStatus).forEach((chineseGameName) => {
        const rolesInGame = scannedRoleImageCountsByGame[chineseGameName] || {};
        const roleNames = Object.keys(rolesInGame);
        const roleCount = roleNames.length;
        let gameImageCount = 0;
        roleNames.forEach((roleName) => { gameImageCount += rolesInGame[roleName] || 0; });
        scanResultData.gameRoles[chineseGameName] = roleCount;
        scanResultData.gameImages[chineseGameName] = gameImageCount;
        scanResultData.roles += roleCount;
        scanResultData.images += gameImageCount;
        const gameSizeBytes = scannedGameSizes[chineseGameName] || 0;
        scanResultData.gameSizes[chineseGameName] = gameSizeBytes;
        scanResultData.gameSizesFormatted[chineseGameName] = FormatBytes(gameSizeBytes);
      });
      scanResultData.totalSize = scanResultData.totalFilesSize + scanResultData.totalGitSize;
      scanResultData.totalSizeFormatted = FormatBytes(scanResultData.totalSize);

      const totalPluginSize = scanResultData.totalSize;

      const diskChartData = {
        totalSize: diskTotalBytes,
        totalSizeFormatted: FormatBytes(diskTotalBytes),
        usedSize: diskUsedBytes,
        usedSizeFormatted: FormatBytes(diskUsedBytes),
        freeSize: diskFreeBytes,
        freeSizeFormatted: FormatBytes(diskFreeBytes),
        usedPercentage: diskUsedPercentage.toFixed(2),
        chartLabels: ['已用', '可用'],
        chartValues: [diskUsedBytes, diskFreeBytes],
        chartColors: ['#42A5F5', '#E0E0E0'],
        chartBorderColors: ['#FFFFFF', '#FFFFFF']
      };

      const robotChartData = {
        totalSize: totalRobotSize,
        totalSizeFormatted: FormatBytes(totalRobotSize),
      };

      const gameGalleryTotalImageContentSize = Object.values(scannedGameSizes).reduce((sum, size) => sum + size, 0);

      const galleryOverviewData = {
        genshinOfGallery: {
          percentage: gameGalleryTotalImageContentSize > 0 ? (scannedGameSizes['原神'] / gameGalleryTotalImageContentSize * 100).toFixed(2) : 0,
          sizeFormatted: FormatBytes(scannedGameSizes['原神'])
        },
        starRailOfGallery: {
          percentage: gameGalleryTotalImageContentSize > 0 ? (scannedGameSizes['星铁'] / gameGalleryTotalImageContentSize * 100).toFixed(2) : 0,
          sizeFormatted: FormatBytes(scannedGameSizes['星铁'])
        },
        zzzOfGallery: {
          percentage: gameGalleryTotalImageContentSize > 0 ? (scannedGameSizes['绝区零'] / gameGalleryTotalImageContentSize * 100).toFixed(2) : 0,
          sizeFormatted: FormatBytes(scannedGameSizes['绝区零'])
        },
        wavesOfGallery: {
          percentage: gameGalleryTotalImageContentSize > 0 ? (scannedGameSizes['鸣潮'] / gameGalleryTotalImageContentSize * 100).toFixed(2) : 0,
          sizeFormatted: FormatBytes(scannedGameSizes['鸣潮'])
        },
        galleryToRobot: {
          percentage: totalRobotSize > 0 ? (totalPluginSize / totalRobotSize * 100).toFixed(2) : 0,
          sizeFormatted: FormatBytes(totalPluginSize)
        },
        totalGalleryContentSizeFormatted: FormatBytes(gameGalleryTotalImageContentSize),
        totalGitCacheSize: totalGitSizeScanned,
        totalGitCacheSizeFormatted: FormatBytes(totalGitSizeScanned),
        totalReposOccupancy: totalPluginSize,
        totalReposOccupancyFormatted: FormatBytes(totalPluginSize)
      };

      const renderDataForStatusPage = {
        pluginVersion: pluginVersionForStatus,
        stats: statsData,
        config: configDataForRender,
        repoCount: Object.values(statsData.repos || {}).filter(repo => repo?.exists).length,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        isArray: Array.isArray,
        diskChartData: diskChartData,
        galleryOverviewData: galleryOverviewData,
        robotChartData: robotChartData,
        JSON: JSON,
        Date: Date
      };
      const statusHtmlTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "status.html");
      try {
        const statusImageBuffer = await renderPageToImage(
          "status-report",
          {
            tplFile: statusHtmlTemplatePath,
            data: renderDataForStatusPage,
            imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0" },
            pageBoundingRect: { selector: ".container" }
          },
          this
        );
        if (statusImageBuffer) await e.reply(statusImageBuffer);
      } catch (statusRenderError) {
        logger.error(`${currentLogPrefix} 生成状态报告图片时出错:`, statusRenderError);
      }

      const generatedMapImages = [];
      const gameMapGenerationConfigs = [
        { gameKeys: ["gs"], titleSuffix: "原神", width: 1400, isOptionalPluginGame: false },
        { gameKeys: ["sr"], titleSuffix: "星穹铁道", width: 1400, isOptionalPluginGame: false },
        { gameKeys: ["zzz"], titleSuffix: "绝区零", width: 1000, isOptionalPluginGame: true, gameIdentifier: "zzz" },
        { gameKeys: ["waves"], titleSuffix: "鸣潮", width: 1000, isOptionalPluginGame: true, gameIdentifier: "waves" }
      ];

      let validMapsToGenerateCount = 0;
      for (const mapCfg of gameMapGenerationConfigs) {
        if (mapCfg.isOptionalPluginGame) {
          const pluginIsInstalledForCfg = await MiaoPluginMBT.IsGamePluginInstalled(mapCfg.gameIdentifier, logger);
          if (pluginIsInstalledForCfg) {
            validMapsToGenerateCount++;
          }
        } else {
          validMapsToGenerateCount++;
        }
      }

      let generatedCount = 0;
      for (const mapCfg of gameMapGenerationConfigs) {
        if (mapCfg.isOptionalPluginGame) {
          const pluginIsInstalledForRender = await MiaoPluginMBT.IsGamePluginInstalled(mapCfg.gameIdentifier, logger);
          if (!pluginIsInstalledForRender) {
            continue;
          }
        }

        const imageBuffer = await this.generateSingleGameMapImageInternal(
          e,
          mapCfg.gameKeys,
          mapCfg.titleSuffix,
          mapCfg.width,
          logger,
          mapCfg.isOptionalPluginGame ? mapCfg.gameIdentifier : null
        );
        if (imageBuffer) {
          generatedMapImages.push(imageBuffer);
          generatedCount++;
          if (generatedCount < validMapsToGenerateCount && generatedMapImages.length > 0) {
            await common.sleep(300);
          }
        }
      }

      if (generatedMapImages.length > 0) {
        if (generatedMapImages.length === 1) {
          await e.reply(generatedMapImages[0]);
        } else {
          try {
            const forwardMsg = await common.makeForwardMsg(e, generatedMapImages, "咕咕牛图库地图总览");
            if (forwardMsg) {
              await e.reply(forwardMsg);
            } else {
              logger.error(`${currentLogPrefix} 创建合并消息失败 (返回空)，尝试分条发送...`);
              for (const singleMapImage of generatedMapImages) {
                await e.reply(singleMapImage);
                await common.sleep(500);
              }
            }
          } catch (forwardingError) {
            logger.error(`${currentLogPrefix} 发送合并消息失败:`, forwardingError);
          }
        }
      }
    } catch (error) {
      await this.ReportError(e, "咕咕牛状态或地图", error);
    }
    return true;
  }

  async generateSingleGameMapImageInternal(eventParam, gameKeysToShow, mapTitleSuffix, renderWidth, logger, optionalGameKeyIdentifier = null) {
    const localLogPrefix = logger.logPrefix || Default_Config.logPrefix;

    //===== 静态资源与映射表定义 =====//
    const gameFoldersMapForStatus = { gs: "原神", sr: "星铁", zzz: "绝区零", waves: "鸣潮" };
    const sourceGalleryToGameKey = { "gs-character": "gs", "sr-character": "sr", "zzz-character": "zzz", "waves-character": "waves" };
    const DEFAULT_NULL_BTN_PATH = `file://${MiaoPluginMBT.paths.commonResPath}/html/img/icon/null-btn.png`;

    //===== 游戏专属配置 =====//
    const GS_ELEMENTS_MAP = { pyro: '火', hydro: '水', cryo: '冰', electro: '雷', anemo: '风', geo: '岩', dendro: '草' };
    const GS_ELEMENTS_ORDER = ['pyro', 'hydro', 'anemo', 'electro', 'dendro', 'cryo', 'geo'];

    const SR_ELEMENTS_MAP_CN_TO_EN = { '火': 'fire', '冰': 'ice', '风': 'wind', '雷': 'elec', '物理': 'phy', '量子': 'quantum', '虚数': 'imaginary' };
    const SR_ELEMENTS_MAP_EN_TO_CN = { fire: '火', ice: '冰', wind: '风', elec: '雷', phy: '物理', quantum: '量子', imaginary: '虚数' };
    const SR_ELEMENTS_ORDER = ['fire', 'ice', 'wind', 'elec', 'phy', 'quantum', 'imaginary'];

    //===== 初始化游戏数据结构 =====//
    const gameDataForThisMap = {};
    gameKeysToShow.forEach(gameKey => {
      const chineseName = gameFoldersMapForStatus[gameKey];
      if (chineseName) {
        gameDataForThisMap[gameKey] = {
          name: chineseName,
          key: gameKey,
          hasFace: ['gs', 'sr', 'zzz', 'waves'].includes(gameKey),
          hasElementGrouping: ['gs', 'sr', 'zzz', 'waves'].includes(gameKey),
          totalImageCountInGame: 0,
          totalByteSizeInGame: 0,
          elements: {}
        };
      }
    });

    if (!MiaoPluginMBT._imgDataCache || MiaoPluginMBT._imgDataCache.length === 0) return null;

    //===== 核心数据处理循环 =====//
    // 遍历所有咕咕牛图库的图片元数据，进行初步聚合
    for (const imageDataItem of MiaoPluginMBT._imgDataCache) {
      if (!imageDataItem.path || !imageDataItem.characterName || !imageDataItem.sourceGallery) continue;

      const gameKey = sourceGalleryToGameKey[imageDataItem.sourceGallery];
      if (!gameKey || !gameDataForThisMap[gameKey] || !gameKeysToShow.includes(gameKey)) continue;

      const characterName = imageDataItem.characterName;
      const gameEntry = gameDataForThisMap[gameKey];

      let elementKey = 'unknown';
      let chineseElementName = '未知';

      if (gameEntry.hasElementGrouping) {
        //===== 原神 & 星穹铁道 元素获取 =====//
        if (gameKey === 'gs' || gameKey === 'sr') {
          const metaPath = gameKey === 'gs' ? MiaoPluginMBT.paths.target.miaoGsAliasDir : MiaoPluginMBT.paths.target.miaoSrAliasDir;
          const dataFilePath = path.join(metaPath, characterName, 'data.json');
          try {
            const jsonData = JSON.parse(await fsPromises.readFile(dataFilePath, 'utf-8'));
            if (jsonData?.elem) {
              if (gameKey === 'gs') {
                elementKey = jsonData.elem;
                chineseElementName = GS_ELEMENTS_MAP[elementKey] || '未知';
              } else if (gameKey === 'sr') {
                elementKey = SR_ELEMENTS_MAP_CN_TO_EN[jsonData.elem] || 'unknown';
                chineseElementName = SR_ELEMENTS_MAP_EN_TO_CN[elementKey] || '未知';
              }
            }
          } catch (error) {
            if (error.code !== 'ENOENT') logger.warn(`${localLogPrefix} 读取角色 [${characterName}] 的 data.json 时出错: ${error.message}`);
          }
        }
        //===== 绝区零 元素/阵营 获取 =====//
        else if (gameKey === 'zzz') {
          const aliasInfo = await MiaoPluginMBT.FindRoleAliasAndMain(characterName, logger);
          const standardName = aliasInfo.exists ? aliasInfo.mainName : characterName;
          const zzzDataPath = path.join(MiaoPluginMBT.paths.target.zzzAliasDir, "..", "resources", "map", "PartnerId2Data.json");
          try {
            const zzzJsonData = JSON.parse(await fsPromises.readFile(zzzDataPath, 'utf-8'));
            let found = false;
            for (const charId in zzzJsonData) {
              if (zzzJsonData[charId].name === standardName) {
                elementKey = zzzJsonData[charId].Camp || 'unknown';
                chineseElementName = elementKey === 'unknown' ? '未知阵营' : elementKey;
                found = true;
                break;
              }
            }
            if (!found) {
              elementKey = 'unknown';
              chineseElementName = '未知阵营';
            }
          } catch (error) {
            if (error.code !== 'ENOENT') logger.warn(`${localLogPrefix} 读取 ZZZ PartnerId2Data.json 时出错: ${error.message}`);
          }
        }
        //===== 鸣潮 元素 获取 =====//
        else if (gameKey === 'waves') {
          const roleData = MiaoPluginMBT._wavesRoleDataMap.get(characterName);
          if (roleData && roleData.elem) {
            const pinyinMap = { '冷凝': 'lengning', '热熔': 'rerong', '导电': 'daodian', '气动': 'qidong', '衍射': 'yanshe', '湮灭': 'yanmie' };
            chineseElementName = roleData.elem;
            elementKey = pinyinMap[roleData.elem] || 'unknown';
          }
        }
      }

      // 初始化元素分组和角色条目
      if (!gameEntry.elements[elementKey]) {
        gameEntry.elements[elementKey] = { name: chineseElementName, key: elementKey, characters: {}, totalImageCountInElement: 0, totalByteSizeInElement: 0, bannerUrl: null };
      }
      if (!gameEntry.elements[elementKey].characters[characterName]) {
        gameEntry.elements[elementKey].characters[characterName] = { name: characterName, imageCount: 0, totalSize: 0, faceUrl: null };
      }

      // 累加数据
      gameEntry.elements[elementKey].characters[characterName].imageCount++;
      gameEntry.elements[elementKey].totalImageCountInElement++;
      gameEntry.totalImageCountInGame++;

      const absoluteImagePath = await MiaoPluginMBT.FindImageAbsolutePath(imageDataItem.path);
      if (absoluteImagePath) {
        try {
          const imageStats = await fsPromises.stat(absoluteImagePath);
          const size = imageStats.size;
          gameEntry.elements[elementKey].characters[characterName].totalSize += size;
          gameEntry.elements[elementKey].totalByteSizeInElement += size;
          gameEntry.totalByteSizeInGame += size;
        } catch (statError) { }
      }
    }

    //===== 构建最终渲染数据 =====//
    const gamesToRenderOnMap = [];
    for (const gameKey of gameKeysToShow) {
      const gameEntry = gameDataForThisMap[gameKey];
      if (!gameEntry || gameEntry.totalImageCountInGame === 0) continue;

      const currentMapGame = {
        name: gameEntry.name,
        key: gameKey,
        totalImageCountDisplay: gameEntry.totalImageCountInGame,
        totalSizeFormattedDisplay: FormatBytes(gameEntry.totalByteSizeInGame),
        hasElementGrouping: gameEntry.hasElementGrouping,
        elements: [],
        characters: []
      };

      if (gameEntry.hasElementGrouping) {
        let sortedElementKeys = [];
        if (gameKey === 'gs') {
          sortedElementKeys = GS_ELEMENTS_ORDER.filter(e => gameEntry.elements[e]?.totalImageCountInElement > 0);
        } else if (gameKey === 'sr') {
          sortedElementKeys = SR_ELEMENTS_ORDER.filter(e => gameEntry.elements[e]?.totalImageCountInElement > 0);
        } else if (gameKey === 'zzz') {
          sortedElementKeys = Object.keys(gameEntry.elements)
            .filter(key => key !== 'unknown' && gameEntry.elements[key]?.totalImageCountInElement > 0)
            .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
        } else if (gameKey === 'waves') {
          const pinyinOrder = ['rerong', 'lengning', 'daodian', 'qidong', 'yanshe', 'yanmie'];
          sortedElementKeys = Object.keys(gameEntry.elements)
            .filter(key => key !== 'unknown' && gameEntry.elements[key]?.totalImageCountInElement > 0)
            .sort((a, b) => {
              const indexA = pinyinOrder.indexOf(a);
              const indexB = pinyinOrder.indexOf(b);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return a.localeCompare(b, 'zh-Hans-CN');
            });
        }

        if (gameEntry.elements['unknown']?.totalImageCountInElement > 0) {
          sortedElementKeys.push('unknown');
        }

        for (const elementKey of sortedElementKeys) {
          const elementGroup = gameEntry.elements[elementKey];
          if (elementGroup.totalImageCountInElement === 0) continue;

          //===== Banner 图片处理专区 (目前仅原神有) =====//
          let bannerPathToAccess = null;
          if (gameKey === 'gs') { // 原神所有元素都应该有banner，包括cryo
            bannerPathToAccess = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "旅行者", elementKey, "imgs", "banner.webp");
          }

          if (bannerPathToAccess) {
            try {
              await fsPromises.access(bannerPathToAccess);
              elementGroup.bannerUrl = `file://${bannerPathToAccess.replace(/\\/g, '/')}`;
            } catch (err) {
              elementGroup.bannerUrl = null;
            }
          }

          const charactersInElement = [];
          const charObjects = Object.values(elementGroup.characters);
          const characterNamesSorted = charObjects.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

          for (const charData of characterNamesSorted) {
            if (charData.imageCount === 0) continue;

            let characterFaceUrl = DEFAULT_NULL_BTN_PATH;

            const aliasForFace = await MiaoPluginMBT.FindRoleAliasAndMain(charData.name, logger);
            const standardNameForFace = aliasForFace.exists ? aliasForFace.mainName : charData.name;
            let faceImagePath = null;

            if (gameKey === "gs") {
              faceImagePath = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "..", "character", standardNameForFace, "imgs", "face.webp");
            } else if (gameKey === "sr") {
              faceImagePath = path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "..", "character", standardNameForFace, "imgs", "face.webp");
            } else if (gameKey === "zzz") {
              try {
                const zzzDataPath = path.join(MiaoPluginMBT.paths.target.zzzAliasDir, "..", "resources", "map", "PartnerId2Data.json");
                const zzzJsonData = JSON.parse(await fsPromises.readFile(zzzDataPath, 'utf-8'));
                for (const charId in zzzJsonData) {
                  if (zzzJsonData[charId].name === standardNameForFace) {
                    const spriteId = zzzJsonData[charId].sprite_id;
                    if (spriteId) {
                      faceImagePath = path.join(MiaoPluginMBT.paths.target.zzzFaceDir, `IconRoleCircle${spriteId}.png`);
                    }
                    break;
                  }
                }
              } catch (err) { }
            } else if (gameKey === "waves") {
              const roleData = MiaoPluginMBT._wavesRoleDataMap.get(standardNameForFace);
              if (roleData && roleData.icon) {
                characterFaceUrl = roleData.icon;
              }
            }

            if (faceImagePath) {
              try {
                await fsPromises.access(faceImagePath);
                characterFaceUrl = `file://${faceImagePath.replace(/\\/g, "/")}`;
              } catch (err) { }
            }

            charactersInElement.push({
              name: charData.name,
              imageCount: charData.imageCount,
              totalSizeFormatted: FormatBytes(charData.totalSize),
              faceUrl: characterFaceUrl
            });
          }

          currentMapGame.elements.push({
            name: elementGroup.name,
            key: elementKey,
            bannerUrl: elementGroup.bannerUrl,
            characters: charactersInElement,
            totalImageCountInElement: elementGroup.totalImageCountInElement,
            totalByteSizeInElement: elementGroup.totalByteSizeInElement,
            totalByteSizeInElementDisplay: FormatBytes(elementGroup.totalByteSizeInElement),
          });
        }
      } else {
        //===== 非分组游戏的处理逻辑 =====//
        const allCharactersDirectly = [];
        for (const elemKey in gameEntry.elements) {
          Object.values(gameEntry.elements[elemKey].characters).forEach(char => allCharactersDirectly.push(char));
        }
        const sortedCharacters = allCharactersDirectly.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));

        currentMapGame.characters = sortedCharacters.map(charData => ({
          name: charData.name,
          imageCount: charData.imageCount,
          totalSizeFormatted: FormatBytes(charData.totalSize),
          faceUrl: DEFAULT_NULL_BTN_PATH
        }));
      }

      gamesToRenderOnMap.push(currentMapGame);
    }

    if (gamesToRenderOnMap.length === 0) return null;

    let gsHeaderBgUrl = null;
    if (gameKeysToShow.includes('gs')) {
      const commonBannerPath = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "common", "imgs", "banner.webp");
      try {
        await fsPromises.access(commonBannerPath);
        gsHeaderBgUrl = `file://${commonBannerPath.replace(/\\/g, '/')}`;
      } catch (err) {
        //logger.warn(`${localLogPrefix} 无法获取原神主页头背景图片: ${commonBannerPath}, 错误: ${err.message}`);
        gsHeaderBgUrl = null;
      }
    }

    let srBodyBgUrl = null;
    if (gameKeysToShow.includes('sr')) {
      const srBgPath = path.join(MiaoPluginMBT.paths.YunzaiPath, 'plugins', 'miao-plugin', 'resources', 'common', 'bg', 'bg-sr.webp');
      try {
        await fsPromises.access(srBgPath);
        srBodyBgUrl = `file://${srBgPath.replace(/\\/g, '/')}`;
      } catch (err) {
        //logger.warn(`${Default_Config.logPrefix} 无法获取星铁地图背景图片: ${srBgPath}, 错误: ${err.message}`);
        srBodyBgUrl = null;
      }
    }

    try {
      let galleryMapTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "check_gallerymap.html");
      try { await fsPromises.access(galleryMapTemplatePath); }
      catch (commonPathError) {
        if (commonPathError.code === ERROR_CODES.NotFound) {
          const assumedPluginFolderName = "GuGuNiu-Plugin-MBT";
          galleryMapTemplatePath = path.join(MiaoPluginMBT.paths.YunzaiPath, "plugins", assumedPluginFolderName, "resources", "GuGuNiu-Gallery", "html", "check_gallerymap.html");
          await fsPromises.access(galleryMapTemplatePath);
        } else { throw commonPathError; }
      }

      const imageBuffer = await renderPageToImage(
        `gallery-map-${mapTitleSuffix.toLowerCase().replace(/\s+/g, '-')}`, {
        tplFile: galleryMapTemplatePath,
        data: {
          games: gamesToRenderOnMap,
          pluginVersion: Version,
          scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
          isArray: Array.isArray,
          FormatBytes: FormatBytes,
          gsHeaderBgUrl: gsHeaderBgUrl,
          srBodyBgUrl: srBodyBgUrl,
          currentRenderWidth: renderWidth
        },
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0", timeout: 60000 },
        screenshotOptions: { fullPage: true },
        width: renderWidth
      },
        this
      );
      return imageBuffer;
    } catch (mapRenderingError) {
      if (eventParam) {
        await MiaoPluginMBT.ReportError(eventParam, `生成 ${mapTitleSuffix} 图库地图`, mapRenderingError, "", this);
      } else {
        logger.error(`${localLogPrefix} 生成 ${mapTitleSuffix} 图库地图时出错:`, mapRenderingError);
      }
      return null;
    }
  }

  async ManageTuKuOption(e) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${Default_Config.logPrefix}只有主人才能开关图库啦~`, true);

    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i);
    if (!match) return false;

    const action = match[1]; const enable = action === "启用";
    let configChanged = false; let saveWarning = "";
    let statusMessageForPanel = "";

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentStatus = MiaoPluginMBT.MBTConfig.TuKuOP ?? Default_Config.defaultTuKuOp;
      if (currentStatus === enable) {
        statusMessageForPanel = `图库已经是「${action}」状态了，无需更改。`;
        return;
      }
      MiaoPluginMBT.MBTConfig.TuKuOP = enable; configChanged = true;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
      if (!saveSuccess) {
        saveWarning = "⚠️ 配置保存失败！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.TuKuOP = !enable; configChanged = false;
        logger.error(`${Default_Config.logPrefix}保存失败，内存状态已回滚。`);
        await this.ReportError(e, `${action}咕咕牛`, new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `图库已成功设为「${action}」。`;
      setImmediate(async () => {
        try {
          if (enable) {
            await MiaoPluginMBT.SyncCharacterFolders(logger);
            await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);

            //logger.info(`${logPrefix}开始检查可选游戏内容...`);
            const gameKeysToCheck = ["zzz", "waves"];
            for (const gameKey of gameKeysToCheck) {
              const gameFolder = MiaoPluginMBT.paths.sourceFolders[gameKey];
              if (!gameFolder) continue;

              const relevantRepoPaths = await MiaoPluginMBT.GetRelevantRepoPathsForGame(gameKey, logger);
              for (const repoPath of relevantRepoPaths) {
                await MiaoPluginMBT.ManageOptionalGameContent(repoPath, gameKey, gameFolder, logger);
              }
            }
            logger.info(`${logPrefix} [启用图库] 可选游戏内容检查并处理完毕。`);

          } else {
            await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.miaoChar, logger);
            await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.zzzChar, logger);
            await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.wavesChar, logger);
          }
        } catch (error) {
          logger.error(`${logPrefix} [启用禁用] 后台操作失败:`, error);
          await this.ReportError(e, `${action}咕咕牛 (后台操作)`, error);
        }
      });
    }

    if (!statusMessageForPanel && saveWarning) {
      statusMessageForPanel = saveWarning;
    }

    try {
      await this.ShowSettingsPanel(e, statusMessageForPanel.trim());
    } catch (panelError) {
      logger.error(`${Default_Config.logPrefix}调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
    }
    return true;
  }

  async ManageUserBans(e) {
    if (!(await this.CheckInit(e))) return true;
    const msg = e.msg.trim();
    const isMaster = e.isMaster;
    const logPrefix = this.logPrefix;
    const logger = this.logger;

    const pageMatch = msg.match(/^#(?:ban|咕咕牛封禁)列表(?:\s*(\d+))?$/i);

    if (pageMatch) {
      if (!e.isMaster && (msg.startsWith("#咕咕牛封禁 ") || msg.startsWith("#咕咕牛解禁 "))) {
        return e.reply(`${this.logPrefix}只有主人才能进行封禁或解禁操作哦~`, true);
      }

      const canContinue = await MiaoPluginMBT.applyDefensePolicy(e, 'ManageUserBans_List');
      if (!canContinue) return true;

      const activeBanCount = MiaoPluginMBT._activeBanSet.size;
      if (activeBanCount === 0) {
        return e.reply("当前没有任何图片被封禁。", true);
      }

      await e.reply(`正在整理 ${activeBanCount} 项封禁记录，请稍候...`, true);
      const allPurifiedItems = [];
      const allUserBannedItems = [];
      const sortedActiveBans = Array.from(MiaoPluginMBT._activeBanSet).sort();

      for (const imagePath of sortedActiveBans) {
        if (MiaoPluginMBT._userBanSet.has(imagePath)) {
          allUserBannedItems.push({ path: imagePath });
        } else {
          allPurifiedItems.push({ path: imagePath });
        }
      }

      const BATCH_SIZE = 28; // 每页张数
      const banListHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "banlist.html");
      const currentScaleStyle = MiaoPluginMBT.getScaleStyleValue();
      if (allUserBannedItems.length > 0) {
        const totalUserBans = allUserBannedItems.length;
        const totalPages = Math.ceil(totalUserBans / BATCH_SIZE);

        for (let i = 0; i < totalPages; i++) {
          const currentPage = i + 1;
          const startIndex = i * BATCH_SIZE;
          const batchItems = allUserBannedItems.slice(startIndex, startIndex + BATCH_SIZE);

          const itemsForRender = await Promise.all(batchItems.map(async (item, index) => {
            const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(item.path);
            return {
              displayIndex: startIndex + index + 1,
              fileNameNoExt: path.basename(item.path).replace(/\.webp$/i, ""),
              thumbnailPath: absolutePath ? `file://${absolutePath.replace(/\\/g, "/")}` : "",
            };
          }));

          try {
            const renderData = {
              pluginVersion: Version,
              scaleStyleValue: currentScaleStyle,
              emoji: "🚫",
              listTypeName: "手动封禁",
              listTypeClass: "manual",
              items: itemsForRender,
              totalCount: totalUserBans,
              totalCountDigits: String(totalUserBans).split(''),
              currentPage: currentPage,
              totalPages: totalPages,
            };

            const imageBuffer = await renderPageToImage(
              `banlist-manual-p${currentPage}`, { tplFile: banListHtmlPath, data: renderData }, this
            );
            if (imageBuffer) await e.reply(imageBuffer);
          } catch (err) {
            logger.error(`${this.logPrefix}渲染手动封禁列表第${currentPage}页失败:`, err);
            await e.reply(`[❌ 手动封禁列表第 ${currentPage}/${totalPages} 页渲染失败]`);
          }
        }
      }

      // 分批渲染并合并发送“净化屏蔽”列表
      if (allPurifiedItems.length > 0) {
        if (allUserBannedItems.length > 0) await common.sleep(1000);

        const totalPurifiedBans = allPurifiedItems.length;
        const totalPages = Math.ceil(totalPurifiedBans / BATCH_SIZE);

        const forwardMessages = [];

        for (let i = 0; i < totalPages; i++) {
          await MiaoPluginMBT.applyDefensePolicy(e, 'ManageUserBans_Batch');

          const currentPage = i + 1;
          const startIndex = i * BATCH_SIZE;
          const batchItems = allPurifiedItems.slice(startIndex, startIndex + BATCH_SIZE);

          const itemsForRender = await Promise.all(batchItems.map(async (item, index) => {
            const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(item.path);
            const imageDataEntry = MiaoPluginMBT._indexByGid.get(item.path);

            const reasons = [];
            if (imageDataEntry) {
              const cfg = MiaoPluginMBT.MBTConfig;
              if (cfg.PFL > 0 && MiaoPluginMBT.CheckIfPurifiedByLevel(imageDataEntry, cfg.PFL)) reasons.push("净化");
              if (cfg.Ai === false && imageDataEntry.attributes.isAiImage) reasons.push("Ai");
              if (cfg.EasterEgg === false && imageDataEntry.attributes.isEasterEgg) reasons.push("彩蛋");
              if (cfg.layout === false && imageDataEntry.attributes.layout === "fullscreen") reasons.push("横屏");
            }
            if (reasons.length === 0) reasons.push("规则");

            return {
              displayIndex: startIndex + index + 1,
              fileNameNoExt: path.basename(item.path).replace(/\.webp$/i, ""),
              thumbnailPath: absolutePath ? `file://${absolutePath.replace(/\\/g, "/")}` : "",
              reasons: reasons,
            };
          }));

          try {
            const renderData = {
              pluginVersion: Version,
              scaleStyleValue: currentScaleStyle,
              emoji: "🌱",
              listTypeName: "净化屏蔽",
              listTypeClass: "purified",
              items: itemsForRender,
              totalCount: totalPurifiedBans,
              totalCountDigits: String(totalPurifiedBans).split(''),
              currentPage: currentPage,
              totalPages: totalPages,
            };
            const imageBuffer = await renderPageToImage(
              `banlist-purified-p${currentPage}`, { tplFile: banListHtmlPath, data: renderData }, this
            );
            if (imageBuffer) forwardMessages.push(imageBuffer);
            else forwardMessages.push(`[❌ 净化屏蔽列表第 ${currentPage}/${totalPages} 页渲染失败]`);
          } catch (err) {
            logger.error(`${logPrefix}渲染净化列表第${currentPage}页失败:`, err);
            forwardMessages.push(`[❌ 净化屏蔽列表第 ${currentPage}/${totalPages} 页渲染失败]`);
          }
        }

        if (forwardMessages.length > 0) {
          try {
            const forwardMsg = await common.makeForwardMsg(e, forwardMessages, `咕咕牛净化列表 (共${totalPages}页)`);
            await e.reply(forwardMsg);
          } catch (fwdError) {
            logger.error(`${logPrefix}创建合并消息失败:`, fwdError);
            for (const msg of forwardMessages) {
              await e.reply(msg); await common.sleep(500);
            }
          }
        }
      }
      return true;
    }

    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i);
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i);

    if (addMatch || delMatch) {
      if (!isMaster) {
        return e.reply(`${logPrefix}只有主人才能进行封禁或解禁操作哦~`, true);
      }
      const isAdding = !!addMatch;
      const targetIdentifierRaw = (isAdding ? addMatch[1] : delMatch[1]).trim();
      const actionVerb = isAdding ? "封禁" : "解禁";

      if (!targetIdentifierRaw) return e.reply(`要${actionVerb}哪个图片呀？格式：#咕咕牛${actionVerb}角色名+编号`, true);

      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw);
      if (!parsedId) return e.reply("格式好像不对哦，应该是 角色名+编号 (例如：花火1)", true);

      const { mainName: rawMainName, imageNumber: imageNumber } = parsedId;

      const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(rawMainName, logger);
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName;

      let imageData = null;
      const imagesForCharacter = MiaoPluginMBT._indexByCharacter.get(standardMainName);
      if (imagesForCharacter && imagesForCharacter.length > 0) {
        const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`;
        imageData = imagesForCharacter.find((img) =>
          img.path?.toLowerCase().replace(/\\/g, "/").endsWith(`/${expectedFilenameLower}`)
        );
      }

      if (!imageData || !imageData.path) {
        return e.reply(`在图库数据里没找到这个图片: ${targetIdentifierRaw}。\n(请检查角色名和编号是否准确，或角色是否存在于图库中)`, true);
      }

      const sourceGallery = imageData.sourceGallery;
      let gameKeyForPluginCheck = null;
      if (sourceGallery === MiaoPluginMBT.paths.sourceFolders.zzz) {
        gameKeyForPluginCheck = "zzz";
      } else if (sourceGallery === MiaoPluginMBT.paths.sourceFolders.waves) {
        gameKeyForPluginCheck = "waves";
      }

      if (gameKeyForPluginCheck) {
        const pluginIsInstalled = await MiaoPluginMBT.IsGamePluginInstalled(gameKeyForPluginCheck, logger);
        if (!pluginIsInstalled) {
          return e.reply(`图库数据无记录: ${targetIdentifierRaw}。\n(插件 ${gameKeyForPluginCheck === "zzz" ? "ZZZ-Plugin" : "waves-plugin"} 未安装)`, true);
        }
      }

      const targetRelativePath = imageData.path.replace(/\\/g, "/");
      const targetFileName = path.basename(targetRelativePath);
      await this.PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb);
      return true;
    }
    return false;
  }

  async PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    let configChanged = false; let replyMsg = ""; let saved = false; let needsRestore = false;
    try {
      const currentPFL = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
      const imgData = MiaoPluginMBT._indexByGid.get(targetRelativePath);
      if (currentPFL > Purify_Level.NONE && imgData && MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, currentPFL)) {
        replyMsg = `⚠️ ${targetFileName} 受到当前的净化规则 (等级 ${currentPFL}) 屏蔽，无法进行手动${actionVerb}操作。`;
        //logger.warn(`${Default_Config.logPrefix}[${actionVerb}] 操作被阻止，因为图片 ${targetFileName} 被 PFL ${currentPFL} 屏蔽。`);
        await e.reply(replyMsg, true); return;
      }
      const isCurrentlyUserBanned = MiaoPluginMBT._userBanSet.has(targetRelativePath);
      if (isAdding) {
        if (isCurrentlyUserBanned) replyMsg = `${targetFileName} ❌️ 封禁已存在哦。`;
        else {
          try {
            MiaoPluginMBT._userBanSet.add(targetRelativePath); configChanged = true;
            //logger.info(`${Default_Config.logPrefix}[${actionVerb}] 添加到内存封禁列表: ${targetRelativePath}`);  //调式日志
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 保存用户封禁列表失败！`); MiaoPluginMBT._userBanSet.delete(targetRelativePath); replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`; configChanged = false; await this.ReportError(e, `${actionVerb}图片`, new Error("保存封禁列表失败")); }
            else replyMsg = `${targetFileName} 🚫 封禁了~`;
          } catch (err) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 添加封禁时发生内部错误:`, err); replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; configChanged = false; await this.ReportError(e, `${actionVerb}图片`, err); }
        }
      } else {
        if (!isCurrentlyUserBanned) replyMsg = `${targetFileName} ❓ 没找到哦~`;
        else {
          try {
            MiaoPluginMBT._userBanSet.delete(targetRelativePath); configChanged = true; needsRestore = true;
            //logger.info(`${Default_Config.logPrefix}[${actionVerb}] 从内存封禁列表移除: ${targetRelativePath}`);   //调式日志
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 保存用户封禁列表失败！`); MiaoPluginMBT._userBanSet.add(targetRelativePath); replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`; configChanged = false; needsRestore = false; await this.ReportError(e, `${actionVerb}图片`, new Error("保存封禁列表失败")); }
            else replyMsg = `${targetFileName} ✅️ 好嘞，解封!`;
          } catch (err) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 解禁时发生内部错误:`, err); if (!MiaoPluginMBT._userBanSet.has(targetRelativePath)) MiaoPluginMBT._userBanSet.add(targetRelativePath); replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; configChanged = false; needsRestore = false; await this.ReportError(e, `${actionVerb}图片`, err); }
        }
      }
    } catch (error) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 处理时发生意外错误:`, error); await this.ReportError(e, `${actionVerb}图片`, error, `目标: ${targetFileName}`); configChanged = false; needsRestore = false; replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; }
    await e.reply(replyMsg, true);
    if (configChanged && saved) {
      setImmediate(async () => {
        try {
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
          if (needsRestore) {
            const restored = await MiaoPluginMBT.RestoreFileFromSource(targetRelativePath, logger);
            if (!restored) logger.warn(`${Default_Config.logPrefix}尝试恢复 ${targetFileName} 失败 (可能源文件丢失)。`);
            else logger.info(`${Default_Config.logPrefix}文件 ${targetFileName} 已尝试恢复。`);
          }
        } catch (err) { logger.error(`${Default_Config.logPrefix}[${actionVerb}] 后台应用生效列表或恢复文件时出错:`, err); await this.ReportError(e, `${actionVerb}图片 (后台任务)`, err); }
      });
    }
  }

  async FindRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) {
      return e.reply("『咕咕牛』核心库还没下载呢！", true);
    }

    const match = e.msg.match(/^#咕咕牛查看\s*(.*)$/i);
    const args = (match && match[1]) ? match[1].trim().split(/\s+/).filter(Boolean) : [];
    const primaryArg = args[0] || null;
    const secondaryArg = args[1] || null;

    if (args.length === 0 || ((primaryArg === '原神' || primaryArg === '星铁') && !secondaryArg)) {

      //await e.reply("正在生成...", true);

      const elementMap = {
        gs: { pyro: '火', hydro: '水', anemo: '风', electro: '雷', dendro: '草', cryo: '冰', geo: '岩' },
        sr: { Fire: '火', Ice: '冰', Wind: '风', Lightning: '雷', Physical: '物理', Quantum: '量子', Imaginary: '虚数' }
      };
      const gameData = {
        gs: { name: "原神", elements: new Set() },
        sr: { name: "星穹铁道", elements: new Set() },
        zzz: { name: "绝区零", exists: false },
        waves: { name: "鸣潮", exists: false }
      };
      const gameKeyMapping = { "gs-character": "gs", "sr-character": "sr", "zzz-character": "zzz", "waves-character": "waves" };

      for (const [charName, images] of MiaoPluginMBT._indexByCharacter.entries()) {
        const gameKey = images[0] ? gameKeyMapping[images[0].sourceGallery] : null;
        if (!gameKey) continue;

        gameData[gameKey].exists = true;

        if (gameKey === 'gs' || gameKey === 'sr') {
          const metaPath = gameKey === 'gs' ? MiaoPluginMBT.paths.target.miaoGsAliasDir : MiaoPluginMBT.paths.target.miaoSrAliasDir;
          try {
            const jsonData = JSON.parse(await fsPromises.readFile(path.join(metaPath, charName, 'data.json'), 'utf-8'));
            const element = jsonData.elem ? (elementMap[gameKey][jsonData.elem] || jsonData.elem) : null;
            if (element && element !== 'multi') {
              gameData[gameKey].elements.add(element);
            }
          } catch (error) { }
        }
      }

      const finalGameData = {};
      for (const key in gameData) {
        if (gameData[key].exists) {
          finalGameData[key] = {
            name: gameData[key].name,
            elements: gameData[key].elements ? Array.from(gameData[key].elements).sort() : null
          };
        }
      }

      const allTags = Object.keys(VALID_TAGS).sort();

      const renderData = {
        pluginVersion: Version,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        gameData: finalGameData,
        tags: allTags,
      };

      try {
        const tplFile = path.join(MiaoPluginMBT.paths.commonResPath, "html", "search_helper.html");
        const imageBuffer = await renderPageToImage(
          "search-helper", {
          tplFile,
          data: renderData,
        }, this);
        if (imageBuffer) await e.reply(imageBuffer);
        else throw new Error("生成帮助图片失败");
      } catch (err) {
        //logger.error(` 生成图片失败:`, err);
        //await e.reply("生成查看助手图片时遇到问题，请稍后再试。");
      }
      return true;
    }

    const canContinue = await MiaoPluginMBT.applyDefensePolicy(e, 'FindRoleSplashes');
    if (!canContinue) return true;

    const msgMatch = e.msg.match(/^#咕咕牛查看\s*(.*)$/i);
    if (!msgMatch?.[1]) {
      return e.reply("想看哪个角色呀？格式：#咕咕牛查看 角色名/游戏名/标签 或 #咕咕牛查看 原神 火", true);
    }

    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const parts = msgMatch[1].trim().split(/\s+/).filter(Boolean);
    const inputName = parts[0];
    const secondaryInput = parts[1] || null;

    const allForwardMessages = [];

    const gameFolderMap = {
      "原神": { folder: "gs-character", key: "gs" },
      "星铁": { folder: "sr-character", key: "sr" },
      "绝区零": { folder: "zzz-character", key: "zzz" },
      "鸣潮": { folder: "waves-character", key: "waves" },
    };
    const gameNameKeys = Object.keys(gameFolderMap);

    const lowerInput = inputName.toLowerCase();
    const tagInfo = VALID_TAGS[lowerInput];

    if (tagInfo) {
      // 逻辑分支1：处理标签查询
      const tagName = inputName.toUpperCase();
      const filteredImages = MiaoPluginMBT._indexByTag.get(tagInfo.key) || [];

      if (filteredImages.length === 0) {
        return e.reply(`没有找到任何带[${tagName}]标签的图片哦。`, true);
      }

      const ITEMS_PER_BATCH = 28;
      const totalItems = filteredImages.length;
      const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH);

      let waitMessage = `收到！正在查找[${tagName}]标签的图片，共 ${totalItems} 张...`;
      if (totalBatches > 1) {
        waitMessage = `带[${tagName}]标签(共 ${totalItems} 张)，将分 ${totalBatches} 批发送，请稍候...`;
      }
      await e.reply(waitMessage, true);

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        await checkSystemHealth(e, logger);

        const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
        const currentBatchData = filteredImages.slice(startIndex, startIndex + ITEMS_PER_BATCH);
        const makeForwardMsgTitle = `[${tagName}]标签图库 (${batchNum}/${totalBatches})`;
        const forwardListBatch = [];
        const firstNodeText = batchNum === 1
          ? `[查看]${tagName}]标签 (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`
          : `[查看]${tagName}]标签(续) (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`;
        forwardListBatch.push(firstNodeText);

        for (const item of currentBatchData) {
          const relativePath = item.path.replace(/\\/g, "/");
          const fileName = path.basename(relativePath);
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
          const messageNode = [];
          if (absolutePath) {
            try { await fsPromises.access(absolutePath, fs.constants.R_OK); messageNode.push(segment.image(`file://${absolutePath}`)); }
            catch (accessErr) { messageNode.push(`[图片无法加载: ${fileName}]`); }
          } else { messageNode.push(`[图片文件丢失: ${fileName}]`); }
          messageNode.push(`${item.characterName} - ${fileName}`);
          forwardListBatch.push(messageNode);
        }

        if (forwardListBatch.length > 1) {
          const forwardMsg = await common.makeForwardMsg(e, forwardListBatch, makeForwardMsgTitle);
          allForwardMessages.push(forwardMsg);
        }
      }

    } else if (gameNameKeys.includes(inputName)) {
      // 逻辑分支2：处理游戏名查询
      const gameNameCN = inputName;
      const gameInfo = gameFolderMap[gameNameCN];

      const reposToScan = [
        { path: MiaoPluginMBT.paths.LocalTuKuPath, num: 1 },
        { path: MiaoPluginMBT.paths.LocalTuKuPath2, num: 2 },
        { path: MiaoPluginMBT.paths.LocalTuKuPath3, num: 3 },
      ];

      const characterSet = new Set();
      for (const repo of reposToScan) {
        if (!(await MiaoPluginMBT.IsTuKuDownloaded(repo.num))) continue;
        const gamePathInRepo = path.join(repo.path, gameInfo.folder);
        try {
          await fsPromises.access(gamePathInRepo);
          const dirs = await fsPromises.readdir(gamePathInRepo, { withFileTypes: true });
          for (const dir of dirs) { if (dir.isDirectory()) characterSet.add(dir.name); }
        } catch (err) {
          if (err.code !== 'ENOENT') logger.warn(`${Default_Config.logPrefix}[查看-游戏] 读取目录 ${gamePathInRepo} 失败:`, err);
        }
      }

      const characterNames = Array.from(characterSet);
      if (characterNames.length === 0) return e.reply(`在本地仓库中没有找到任何『${gameNameCN}』的角色。`, true);

      if ((gameInfo.key === 'gs' || gameInfo.key === 'sr') && !secondaryInput) {
        await e.reply(`『${gameNameCN}』的角色已按元素分类，请选择查看：`, true);
        const elementMap = {
          gs: { pyro: '火', hydro: '水', anemo: '风', electro: '雷', dendro: '草', cryo: '冰', geo: '岩' },
          sr: { fire: '火', ice: '冰', wind: '风', elec: '雷', phy: '物理', quantum: '量子', imaginary: '虚数' }
        };
        const elementOrder = {
          gs: ['火', '水', '风', '雷', '草', '冰', '岩'],
          sr: ['物理', '火', '冰', '雷', '风', '量子', '虚数'],
        };
        const elementList = elementOrder[gameInfo.key].map(elem => `#咕咕牛查看${gameNameCN} ${elem}`).join('\n');
        await e.reply(`- 点击下方指令或手动输入 -\n${elementList}`);

      } else {
        let targetChars = [];
        let queryDescription = "";

        if (gameInfo.key === 'gs' || gameInfo.key === 'sr') {
          queryDescription = `『${gameNameCN}』【${secondaryInput}】属性`;
          const elementMap = {
            gs: { pyro: '火', hydro: '水', anemo: '风', electro: '雷', dendro: '草', cryo: '冰', geo: '岩' },
            sr: { fire: '火', ice: '冰', wind: '风', elec: '雷', phy: '物理', quantum: '量子', imaginary: '虚数' }
          };
          for (const charName of characterNames) {
            let element = '未知';
            const metaPath = gameInfo.key === 'gs' ? MiaoPluginMBT.paths.target.miaoGsAliasDir : MiaoPluginMBT.paths.target.miaoSrAliasDir;
            const dataFilePath = path.join(metaPath, charName, 'data.json');
            try {
              const fileContent = await fsPromises.readFile(dataFilePath, 'utf-8');
              const jsonData = JSON.parse(fileContent);
              if (jsonData && jsonData.elem) {
                if (gameInfo.key === 'gs') element = elementMap.gs[jsonData.elem] || '未知';
                else if (gameInfo.key === 'sr') element = Object.values(elementMap.sr).includes(jsonData.elem) ? jsonData.elem : '未知';
              }
            } catch (error) {
              if (error.code !== 'ENOENT') logger.warn(`${Default_Config.logPrefix}读取角色 [${charName}] 的 data.json 时出错:`, error.message);
            }
            if (element === secondaryInput) {
              targetChars.push(charName);
            }
          }
        } else {
          queryDescription = `『${gameNameCN}』`;
          targetChars = characterNames;
        }

        if (targetChars.length === 0) {
          return e.reply(`没有找到 ${queryDescription} 的任何角色。`, true);
        }

        const sortedCharNames = targetChars.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

        await e.reply(`收到！将发送 ${queryDescription} 的 ${sortedCharNames.length} 个角色图库...`, true);

        for (const charName of sortedCharNames) {
          await checkSystemHealth(e, logger);

          try {
            const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(charName, logger);
            const standardMainName = aliasResult.exists ? aliasResult.mainName : charName;
            const rawRoleImageData = MiaoPluginMBT._imgDataCache.filter((img) => img.characterName === standardMainName && img.path && typeof img.path === 'string');

            if (rawRoleImageData.length === 0) continue;

            rawRoleImageData.sort((a, b) => parseInt(a.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0") - parseInt(b.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0"));

            const totalItems = rawRoleImageData.length;
            const ITEMS_PER_BATCH = 28;
            const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH);

            for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
              await checkSystemHealth(e, logger);
              const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
              const currentBatchData = rawRoleImageData.slice(startIndex, startIndex + ITEMS_PER_BATCH);

              const firstItem = currentBatchData[0];
              let titleFaceUrl = null;
              if (firstItem) {
                const sourceGallery = firstItem.sourceGallery;
                let gameKey = sourceGallery ? sourceGallery.split('-')[0] : null;
                if (gameKey === 'zzz') {
                  try {
                    const files = await fsPromises.readdir(MiaoPluginMBT.paths.target.zzzDataDir);
                    for (const file of files) {
                      if (file.endsWith('.json')) {
                        const data = JSON.parse(await fsPromises.readFile(path.join(MiaoPluginMBT.paths.target.zzzDataDir, file), 'utf-8'));
                        if (data.Name === standardMainName || data.CodeName === standardMainName) {
                          const iconMatch = data.Icon?.match(/\d+$/);
                          if (iconMatch) {
                            const zzzFacePath = path.join(MiaoPluginMBT.paths.target.zzzFaceDir, `IconRoleCircle${iconMatch[0]}.png`);
                            await fsPromises.access(zzzFacePath);
                            titleFaceUrl = `file://${zzzFacePath.replace(/\\/g, "/")}`;
                          }
                          break;
                        }
                      }
                    }
                  } catch (err) { /* 获取失败就算了 */ }
                }
              }
              const makeForwardMsgTitle = titleFaceUrl
                ? [segment.image(titleFaceUrl), ` [${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`]
                : `[${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`;

              const forwardListBatch = [];
              const firstNodeText = batchNum === 1
                ? `查看『${standardMainName}』 (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`
                : `查看『${standardMainName}』(续) (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`;
              forwardListBatch.push(firstNodeText);

              for (let i = 0; i < currentBatchData.length; i++) {
                const item = currentBatchData[i];
                const itemGlobalIndex = startIndex + i + 1;
                const relativePath = item.path.replace(/\\/g, "/");
                const fileName = path.basename(relativePath);
                const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
                const messageNode = [];
                if (absolutePath) {
                  try { await fsPromises.access(absolutePath, fs.constants.R_OK); messageNode.push(segment.image(`file://${absolutePath}`)); }
                  catch (accessErr) { messageNode.push(`[图片无法加载: ${fileName}]`); }
                } else { messageNode.push(`[图片文件丢失: ${fileName}]`); }
                const textInfoLines = [];
                textInfoLines.push(`${itemGlobalIndex}. ${fileName}`);
                const tags = [];
                if (item.attributes?.isRx18 === true) tags.push("R18"); if (item.attributes?.isPx18 === true) tags.push("P18"); if (item.attributes?.isAiImage === true) tags.push("Ai"); if (item.attributes?.isEasterEgg === true) tags.push("彩蛋");
                if (tags.length > 0) textInfoLines.push(`Tag：${tags.join(" / ")}`);
                let fileSizeFormatted = "";
                if (absolutePath) { try { const stats = await fsPromises.stat(absolutePath); fileSizeFormatted = FormatBytes(stats.size); } catch (statErr) { } }
                if (fileSizeFormatted) textInfoLines.push(`占用：${fileSizeFormatted}`);
                const constraints = [];
                const isUserBanned = MiaoPluginMBT._userBanSet.has(relativePath); const isPurified = await MiaoPluginMBT.CheckIfPurified(relativePath, logger);
                if (isUserBanned) constraints.push("❌封禁"); if (isPurified && !isUserBanned) constraints.push(`🌱净化`);
                if (constraints.length > 0) textInfoLines.push(`约束:  ${constraints.join("     ")}`);
                messageNode.push(textInfoLines.join("\n"));
                forwardListBatch.push(messageNode);
              }

              if (forwardListBatch.length > 1) {
                const forwardMsg = await common.makeForwardMsg(e, forwardListBatch, makeForwardMsgTitle);
                allForwardMessages.push(forwardMsg);
              }
            }
          } catch (error) {
            logger.error(`${Default_Config.logPrefix}处理角色 '${charName}' 时发生错误:`, error);
          }
          await common.sleep(2000);
        }
      }

    } else {
      // 逻辑分支3：处理单个角色名
      const roleNameInput = inputName;
      try {
        const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(roleNameInput, logger);
        const standardMainName = aliasResult.exists ? aliasResult.mainName : roleNameInput;
        const rawRoleImageData = MiaoPluginMBT._indexByCharacter.get(standardMainName) || [];
        if (rawRoleImageData.length === 0) { return e.reply(`图库数据中没有找到『${roleNameInput}』的图片信息。`, true); }

        const sourceGallery = rawRoleImageData[0].sourceGallery;
        let gameKey = sourceGallery ? sourceGallery.split('-')[0] : null;

        if (gameKey === "zzz" || gameKey === "waves") {
          const pluginIsInstalled = await MiaoPluginMBT.IsGamePluginInstalled(gameKey);
          if (!pluginIsInstalled) return e.reply(`图库数据中没有找到『${roleNameInput}』的图片信息。`, true);
        }

        // 索引构建时已经排序，这里无需再次排序
        //rawRoleImageData.sort((a, b) => parseInt(a.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0") - parseInt(b.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0"));

        const totalItems = rawRoleImageData.length;
        const ITEMS_PER_BATCH = 28;
        const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH);

        let waitMessage = `正在为『${standardMainName}』整理 ${totalItems} 张图片...`;
        if (totalBatches > 1) {
          waitMessage = `正在为『${standardMainName}』整理 ${totalItems} 张图片，将分 ${totalBatches} 批发送，请稍候...`;
          if ((MiaoPluginMBT.MBTConfig.Execution_Mode ?? 'Batch') === 'Serial') {
            waitMessage += `\n(当前为低负载模式，批间会进行系统负载检查)`;
          }
        }

        await e.reply(waitMessage, true);

        for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
          await checkSystemHealth(e, logger);

          const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
          const currentBatchData = rawRoleImageData.slice(startIndex, startIndex + ITEMS_PER_BATCH);

          let titleFaceUrl = null;
          if (gameKey === 'zzz') {
            try {
              const files = await fsPromises.readdir(MiaoPluginMBT.paths.target.zzzDataDir);
              for (const file of files) {
                if (file.endsWith('.json')) {
                  const data = JSON.parse(await fsPromises.readFile(path.join(MiaoPluginMBT.paths.target.zzzDataDir, file), 'utf-8'));
                  if (data.Name === standardMainName || data.CodeName === standardMainName) {
                    const iconMatch = data.Icon?.match(/\d+$/);
                    if (iconMatch) {
                      const zzzFacePath = path.join(MiaoPluginMBT.paths.target.zzzFaceDir, `IconRoleCircle${iconMatch[0]}.png`);
                      await fsPromises.access(zzzFacePath);
                      titleFaceUrl = `file://${zzzFacePath.replace(/\\/g, "/")}`;
                    }
                    break;
                  }
                }
              }
            } catch (err) { /* 获取失败就算了 */ }
          }

          const makeForwardMsgTitle = titleFaceUrl
            ? [segment.image(titleFaceUrl), ` [${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`]
            : `[${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`;

          const forwardListBatch = [];
          const firstNodeText = batchNum === 1
            ? `查看『${standardMainName}』 (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)\n想导出图片？试试: #咕咕牛导出${standardMainName}1`
            : `查看『${standardMainName}』(续) (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`;
          forwardListBatch.push(firstNodeText);

          for (let i = 0; i < currentBatchData.length; i++) {
            const item = currentBatchData[i];
            const itemGlobalIndex = startIndex + i + 1;
            const relativePath = item.path.replace(/\\/g, "/");
            const fileName = path.basename(relativePath);
            const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
            const messageNode = [];
            if (absolutePath) {
              try { await fsPromises.access(absolutePath, fs.constants.R_OK); messageNode.push(segment.image(`file://${absolutePath}`)); }
              catch (accessErr) { messageNode.push(`[图片无法加载: ${fileName}]`); }
            } else { messageNode.push(`[图片文件丢失: ${fileName}]`); }
            const textInfoLines = [];
            textInfoLines.push(`${itemGlobalIndex}. ${fileName}`);
            const tags = [];
            if (item.attributes?.isRx18 === true) tags.push("R18"); if (item.attributes?.isPx18 === true) tags.push("P18"); if (item.attributes?.isAiImage === true) tags.push("Ai"); if (item.attributes?.isEasterEgg === true) tags.push("彩蛋");
            if (tags.length > 0) textInfoLines.push(`Tag：${tags.join(" / ")}`);
            let fileSizeFormatted = "";
            if (absolutePath) { try { const stats = await fsPromises.stat(absolutePath); fileSizeFormatted = FormatBytes(stats.size); } catch (statErr) { } }
            if (fileSizeFormatted) textInfoLines.push(`占用：${fileSizeFormatted}`);
            const constraints = [];
            const isUserBanned = MiaoPluginMBT._userBanSet.has(relativePath); const isPurified = await MiaoPluginMBT.CheckIfPurified(relativePath, logger);
            if (isUserBanned) constraints.push("❌封禁"); if (isPurified && !isUserBanned) constraints.push(`🌱净化`);
            if (constraints.length > 0) textInfoLines.push(`约束:  ${constraints.join("     ")}`);
            messageNode.push(textInfoLines.join("\n"));
            forwardListBatch.push(messageNode);
          }

          if (forwardListBatch.length > 1) {
            const forwardMsg = await common.makeForwardMsg(e, forwardListBatch, makeForwardMsgTitle);
            allForwardMessages.push(forwardMsg);
          }
        }
      } catch (error) {
        logger.error(`${Default_Config.logPrefix}处理角色 '${roleNameInput}' 时发生错误: 用户 ${e.user_id}`, error);
        await this.ReportError(e, `查看角色 ${roleNameInput}`, error);
      }
    }

    if (allForwardMessages.length > 0) {
      if (MiaoPluginMBT.MBTConfig.Use_Advanced_Forward) {
        try {
          if (allForwardMessages.length === 1) {
            await e.reply(allForwardMessages[0]);
          } else {
            const finalForwardMsg = await common.makeForwardMsg(e, allForwardMessages, `咕咕牛图库 - ${inputName} (高级合并)`);
            await e.reply(finalForwardMsg);
          }
        } catch (fwdError) {
          logger.error(`${Default_Config.logPrefix}创建或发送失败:`, fwdError);
          await e.reply("创建高级合并消息失败了，可能是内容太多了，已为你自动回退到分批发送模式...");
          for (const msg of allForwardMessages) {
            await e.reply(msg);
            await common.sleep(1000);
          }
        }
      } else {
        for (const msg of allForwardMessages) {
          await e.reply(msg);
          await common.sleep(1000);
        }
      }
    }

    return true;
  }

  async VisualizeRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;
    const canContinue = await MiaoPluginMBT.applyDefensePolicy(e, 'VisualizeRoleSplashes');
    if (!canContinue) return true;

    const match = e.msg.match(/^#可视化\s*(.+)$/i);
    if (!match?.[1]) return e.reply("想可视化哪个角色呀？格式：#可视化角色名", true);
    const roleNameInput = match[1].trim();

    let standardMainName = "";
    const logger = this.logger; const logPrefix = this.logPrefix;

    try {
      const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(roleNameInput, logger);
      standardMainName = aliasResult.mainName || roleNameInput;

      let roleFolderPath = null;
      const targetDirsToCheck = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
      for (const targetDir of targetDirsToCheck) {
        if (!targetDir) continue;
        const potentialPath = path.join(targetDir, standardMainName);
        try { await fsPromises.access(potentialPath); const stats = await fsPromises.stat(potentialPath); if (stats.isDirectory()) { roleFolderPath = potentialPath; break; } }
        catch (err) { if (err.code !== ERROR_CODES.NotFound) logger.warn(`${Default_Config.logPrefix}访问目标路径 ${potentialPath} 时出错 (非ENOENT):`, err.code); }
      }

      if (!roleFolderPath) { logger.warn(`${Default_Config.logPrefix}未在任何目标插件目录中找到角色 '${standardMainName}' 的文件夹。`); return e.reply(`『${standardMainName}』不存在，可能是未同步/无该角色？`); }

      const supportedExtensions = [".jpg", ".png", ".jpeg", ".webp", ".bmp"];
      let allImageFiles = [];
      try { const files = await fsPromises.readdir(roleFolderPath); allImageFiles = files.filter((file) => supportedExtensions.includes(path.extname(file).toLowerCase())); }
      catch (readErr) { logger.error(`${Default_Config.logPrefix}读取角色文件夹失败: ${roleFolderPath}`, readErr); await this.ReportError(e, `可视化角色 ${standardMainName}`, readErr, "读取角色文件夹失败"); return true; }

      if (allImageFiles.length === 0) { logger.warn(`${Default_Config.logPrefix}角色文件夹 ${roleFolderPath} 为空或不包含支持的图片格式。`); return e.reply(`『${standardMainName}』的文件夹里没有找到支持的图片文件哦。`); }

      allImageFiles.sort((a, b) => { const numA = parseInt(a.match(/(\d+)\.\w+$/)?.[1] || "0"); const numB = parseInt(b.match(/(\d+)\.\w+$/)?.[1] || "0"); if (numA === numB) return a.localeCompare(b); return numA - numB; });

      const BATCH_SIZE = 28;
      const totalImageCount = allImageFiles.length;
      const totalBatches = Math.ceil(totalImageCount / BATCH_SIZE);

      let waitMessage = `[${standardMainName}] 有 ${totalImageCount} 张面板图，正在生成可视化预览...`;
      if (totalBatches > 1) {
        waitMessage = `[${standardMainName}] 的图片过多 (共 ${totalImageCount} 张)，将分 ${totalBatches} 批生成预览，请注意查收...`;
        if ((MiaoPluginMBT.MBTConfig.Execution_Mode ?? 'Batch') === 'Serial') {
          waitMessage += `\n(当前为低负载模式，生成速度会较慢)`;
        }
      }

      await e.reply(waitMessage, true);
      await common.sleep(500);

      const sourceTplFilePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "visualize.html");
      try { await fsPromises.access(sourceTplFilePath); }
      catch (commonErr) {
        logger.error(`${Default_Config.logPrefix}可视化模板文件缺失: ${sourceTplFilePath}`, commonErr);
        await e.reply("生成可视化图片失败：缺少必要的 visualize.html 模板文件。");
        return true;
      }

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        await MiaoPluginMBT.applyDefensePolicy(e, 'VisualizeRoleSplashes_Batch');

        try {
          const startIndex = (batchNum - 1) * BATCH_SIZE;
          const currentBatchFiles = allImageFiles.slice(startIndex, startIndex + BATCH_SIZE);

          const imagesDataForRender = currentBatchFiles.map((fileName, index) => ({
            fileName: fileName.replace(/\.\w+$/, ""),
            filePath: `file://${path.join(roleFolderPath, fileName).replace(/\\/g, "/")}`,
            originalIndex: startIndex + index,
            isGu: /gu/i.test(fileName)
          }));

          const renderData = {
            pluginVersion: Version,
            characterName: standardMainName,
            imageCount: totalImageCount,
            images: imagesDataForRender,
            batchNum: batchNum,
            totalBatches: totalBatches,
            totalCountDigits: String(totalImageCount).split(''), // 为Header准备数字数组
            scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
          };

          const imageBuffer = await renderPageToImage(
            `visualize-${standardMainName}-batch${batchNum}`, {
            tplFile: sourceTplFilePath,
            data: renderData,
            imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0", timeout: 45000 },
            screenshotOptions: { fullPage: true },
          }, this);

          if (imageBuffer) {
            await e.reply(imageBuffer);
          } else {
            logger.error(`${Default_Config.logPrefix}第 ${batchNum}/${totalBatches} 批截图生成失败或返回空。`);
            await e.reply(`[❌ 第 ${batchNum}/${totalBatches} 部分渲染失败]`, true);
          }
        } catch (batchProcessingError) {
          logger.error(`${Default_Config.logPrefix}处理第 ${batchNum}/${totalBatches} 批时发生错误:`, batchProcessingError);
          await e.reply(`处理第 ${batchNum}/${totalBatches} 批数据时出错，跳过此批次。`, true);
        }

        if (batchNum < totalBatches) {
          await common.sleep(1000);
        }
      }

    } catch (error) { logger.error(`${Default_Config.logPrefix}处理角色 '${roleNameInput}' 时发生顶层错误:`, error); await this.ReportError(e, `可视化角色 ${roleNameInput}`, error); }
    return true;
  }

  async ExportSingleImage(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply("『咕咕牛』核心库还没下载呢！", true);

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i);
    if (!match?.[1]) return e.reply("要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)", true);

    const targetIdentifierRaw = match[1].trim();
    let targetFileName = ""; let absolutePath = null;

    try {
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw);
      if (!parsedId) return e.reply("格式好像不对哦，应该是 角色名+编号，比如：花火1", true);
      const { mainName: rawMainName, imageNumber } = parsedId;
      const aliasResult = await MiaoPluginMBT.FindRoleAliasAndMain(rawMainName, this.logger);
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName;
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`;

      let foundCount = 0;
      const imageData = MiaoPluginMBT._imgDataCache.find((img) => {
        const nameMatch = img.characterName === standardMainName;
        const pathLower = img.path?.toLowerCase().replace(/\\/g, "/");
        const filenameMatch = pathLower?.endsWith(`/${expectedFilenameLower}`);
        if (nameMatch) foundCount++;
        return nameMatch && filenameMatch;
      });

      if (!imageData || !imageData.path) {
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)`;
        if (MiaoPluginMBT._imgDataCache.length === 0) hint = `(图库数据是空的)`;
        else if (foundCount === 0 && MiaoPluginMBT._imgDataCache.length > 0) hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)`;
        else if (foundCount > 0) hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)`;
        return e.reply(`在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`, true);
      }

      const targetRelativePath = imageData.path.replace(/\\/g, "/");
      targetFileName = path.basename(targetRelativePath);
      // if (MiaoPluginMBT._activeBanSet.has(targetRelativePath)) return e.reply(`图片 ${targetFileName} 被封禁了，不能导出哦。`, true);
      // 封禁检查 封禁则无法导出
      absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(targetRelativePath);
      if (!absolutePath) return e.reply(`糟糕，文件丢失了：${targetFileName}，没法导出。`, true);

      let fileBuffer = null;
      try { fileBuffer = await fsPromises.readFile(absolutePath); if (!fileBuffer || fileBuffer.length === 0) throw new Error("读取到的文件 Buffer 为空"); this.logger.info(`${Default_Config.logPrefix}成功读取文件到 Buffer: ${targetFileName}, 大小: ${fileBuffer.length} bytes`); }
      catch (readError) { this.logger.error(`${Default_Config.logPrefix}读取文件失败: ${absolutePath}`, readError); await this.ReportError(e, `导出文件 ${targetFileName}`, readError, "读取文件失败"); return true; }

      await e.reply(`📦 导出成功！给你 -> ${targetFileName}`);
      await common.sleep(200);
      await e.reply(segment.file(fileBuffer, targetFileName));
    } catch (sendErr) {
      this.logger.error(`${Default_Config.logPrefix}导出 ${targetFileName || targetIdentifierRaw} 时发送失败:`, sendErr);
      try {
        if (sendErr?.message?.includes("highway") || sendErr?.message?.includes("file size") || sendErr?.code === -36 || sendErr?.code === 210005 || sendErr?.code === 210003) await e.reply(`发送文件失败了,文件通道好像出了点问题 (${sendErr.code || "未知代码"})，可能是文件太大、网络不好或者被QQ限制了。`, true);
        else await this.ReportError(e, `导出文件 ${targetFileName || targetIdentifierRaw}`, sendErr);
      } catch (replyError) { this.logger.error(`${Default_Config.logPrefix}发送导出失败提示时也出错:`, replyError); }
    }
    return true;
  }

  async Help(e) {
    const localHelpTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "help.html");
    const remoteHelpTemplateUrl = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/help.html";
    let templateHtml = "";

    try {
      templateHtml = await fsPromises.readFile(localHelpTemplatePath, 'utf-8');
      //this.logger.info(`${this.logPrefix}已成功从本地加载帮助模板。`);
    } catch (localError) {
      //this.logger.warn(`${this.logPrefix}本地帮助模板加载失败 (${localError.code})，尝试从Gitee获取在线版本...`);
      try {
        const response = await fetch(remoteHelpTemplateUrl, { timeout: 10000 });
        if (!response.ok) {
          throw new Error(`请求在线模板失败，状态码: ${response.status}`);
        }
        templateHtml = await response.text();
        if (!templateHtml) {
          throw new Error("获取到的在线帮助模板内容为空。");
        }
        //this.logger.info(`${this.logPrefix}已成功从Gitee获取在线帮助模板作为备用。`);
      } catch (remoteError) {
        this.logger.error(`${this.logPrefix}CRITICAL: 本地和在线帮助模板均无法加载！`, remoteError);
        templateHtml = "";
      }
    }

    if (templateHtml) {
      try {
        let installedDays = null;
        try {
          const stats = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath);
          const diffMs = Date.now() - stats.birthtimeMs;
          installedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        } catch (statError) {
        }

        const pictureDirPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'img', 'picture');
        let availablePictureFiles = [];
        try {
          const files = await fsPromises.readdir(pictureDirPath);
          availablePictureFiles = files.filter(file => /\.(png|webp)$/i.test(file));
        } catch (err) {
          this.logger.error(`${this.logPrefix}读取图片目录失败: ${pictureDirPath}`, err);
        }

        const numberOfIcons = 15;
        const randomIconPaths = [];
        if (availablePictureFiles.length > 0) {
          const shuffledIcons = lodash.shuffle(availablePictureFiles);
          for (let i = 0; i < numberOfIcons; i++) {
            const iconFilename = shuffledIcons[i % shuffledIcons.length];
            const fullPath = `file://${path.join(pictureDirPath, iconFilename).replace(/\\/g, '/')}`;
            randomIconPaths.push(fullPath);
          }
        } else { }

        const imageBuffer = await renderPageToImage(
          "help-panel", {
          htmlContent: templateHtml,
          data: {
            pluginVersion: Version,
            randomIconPaths: randomIconPaths,
            installedDays: installedDays !== null ? String(installedDays) : null,
            scaleStyleValue: MiaoPluginMBT.getScaleStyleValue()
          },
          imgType: "png",
          pageGotoParams: { waitUntil: "networkidle0" },
          screenshotOptions: { fullPage: true }
        }, this);

        if (imageBuffer) {
          await e.reply(imageBuffer);
        } else {
          throw new Error("生成帮助图片失败 (返回空 Buffer)");
        }
      } catch (renderError) {
        this.logger.error(`${this.logPrefix}生成帮助图片时出错:`, renderError);
        templateHtml = "";
      }
    }

    if (!templateHtml) {
      let fallbackText = "『咕咕牛帮助手册』(图片生成失败，转为纯文本)\n";
      fallbackText += "--------------------\n";
      fallbackText += "【图库安装】\n";
      fallbackText += "  #下载咕咕牛: 自动测速选择合适节点下载\n";
      fallbackText += "  #更新咕咕牛: 手动执行更新\n";
      fallbackText += "\n";
      fallbackText += "【图库操作】\n";
      fallbackText += "  #启/禁用咕咕牛: 管理图库同步\n";
      fallbackText += "  #咕咕牛状态: 查看本地参数\n";
      fallbackText += "  #咕咕牛查看[角色名]: 查看角色图片\n";
      fallbackText += "  #咕咕牛导出[角色名+编号]: 导出图片文件\n";
      fallbackText += "  #可视化[角色名]: 显示面板图\n";
      fallbackText += "  #重置咕咕牛: 清理图库文件\n";
      fallbackText += "\n";
      fallbackText += "【封禁与设置】\n";
      fallbackText += "  #咕咕牛封/解禁[角色名+编号]: 管理单张图片\n";
      fallbackText += "  #咕咕牛封禁列表: 显示封禁图片\n";
      fallbackText += "  #咕咕牛设置净化等级[0-2]: 过滤敏感内容\n";
      fallbackText += "  #咕咕牛面板: 查看设置状态\n";
      fallbackText += "  #咕咕牛设置[xx][开启/关闭]: Ai/彩蛋/横屏等\n";
      fallbackText += "\n";
      fallbackText += "【测试工具】\n";
      fallbackText += "  #咕咕牛测速: 测速全部节点\n";
      fallbackText += "  #咕咕牛触发: 只显示用于开发者测试\n";
      fallbackText += "--------------------\n";
      fallbackText += `Miao-Plugin-MBT v${Version}`;

      await e.reply(fallbackText, true);
    }

    return true;
  }

  async TriggerError(e) {
    if (!e.isMaster) return e.reply("仅限主人测试。", true);
    const match = e.msg.match(/#咕咕牛触发(?:\s*([a-zA-Z0-9_-]+))?/i);
    const triggerInput = match?.[1]?.trim() || "";
    this.logger.warn(`${Default_Config.logPrefix}用户 ${e.user_id} 触发模拟指令，输入: "${triggerInput}"`);

    let itemToTrigger = null;
    if (triggerInput) {
      const lowerInput = triggerInput.toLowerCase();
      itemToTrigger = TRIGGERABLE_ITEMS.find(item => String(item.id) === triggerInput);
      if (!itemToTrigger) itemToTrigger = TRIGGERABLE_ITEMS.find(item => item.name.toLowerCase().includes(lowerInput));
    }

    if (!itemToTrigger) {
      const TRIGGER_LIST_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/trigger_list.html";
      try {
        const response = await fetch(TRIGGER_LIST_URL, { timeout: 10000 });
        if (!response.ok) throw new Error(`请求触发列表模板失败: ${response.status}`);
        const templateHtml = await response.text();
        const grouped = lodash.groupBy(TRIGGERABLE_ITEMS, 'category');
        const categoryMap = {
          "底层错误": { en_name: "LOW-LEVEL ERRORS", className: "error" },
          "核心图片报告模拟": { en_name: "CORE REPORT SIMULATIONS", className: "report" },
          "业务逻辑状态": { en_name: "BUSINESS LOGIC STATES", className: "logic" },
        };
        const categoryOrder = Object.keys(categoryMap);
        const categoriesForRender = categoryOrder
          .filter(key => grouped[key])
          .map(key => ({
            name: key.replace("模板模拟: ", ""),
            en_name: categoryMap[key]?.en_name || "GENERAL",
            className: categoryMap[key]?.className || "logic",
            items: grouped[key]
          }));
        const imageBuffer = await renderPageToImage("trigger-list", {
          htmlContent: templateHtml,
          data: { pluginVersion: Version, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(), categories: categoriesForRender },
          imgType: "png", pageGotoParams: { waitUntil: "networkidle0" }, screenshotOptions: { fullPage: true }
        }, this);
        if (imageBuffer) await e.reply(imageBuffer);
        else throw new Error("生成触发列表图片失败 (返回空)");
      } catch (err) {
        this.logger.error(`${Default_Config.logPrefix}渲染触发列表失败，回退到文本模式。`, err);
        let fallbackText = "可用触发项(格式: #咕咕牛触发 ID):\n";
        TRIGGERABLE_ITEMS.forEach(item => { fallbackText += `${item.id}. ${item.name}\n`; });
        await e.reply(fallbackText);
      }
      return true;
    }

    await e.reply(`${Default_Config.logPrefix}正在模拟: [${itemToTrigger.id}] ${itemToTrigger.name}...`, true);

    const renderEngine = async (templateFileName, mockDataType, source) => {
      const TEMPLATE_BASE_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/";
      const localTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", `${templateFileName}.html`);
      const remoteTemplateUrl = `${TEMPLATE_BASE_URL}${templateFileName}.html`;
      let templateHtml = "";
      try {
        if (source === 'remote') {
          const response = await fetch(remoteTemplateUrl, { timeout: 10000 });
          if (!response.ok) throw new Error(`请求在线模板 '${remoteTemplateUrl}' 失败: ${response.status}`);
          templateHtml = await response.text();
        } else {
          templateHtml = await fsPromises.readFile(localTemplatePath, 'utf-8');
        }
        if (!templateHtml) throw new Error("模板内容为空");
      } catch (err) {
        throw new Error(`无法加载模板 '${templateFileName}.html' (来源: ${source}): ${err.message}`);
      }

      const getMockData = async (type) => {
        const baseData = {
          pluginVersion: Version,
          scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
          isArray: Array.isArray,
          duration: (Math.random() * 20 + 10).toFixed(1),
          reportTime: new Date().toLocaleString()
        };
        const mockLog = [{ date: "刚刚", displayParts: [{ type: 'text', content: `feat: 模拟更新 (${type})` }] }];
        const repoNames = { 1: "一号仓库 (核心)", 2: "二号仓库 (原神)", 3: "三号仓库 (星铁)", 4: "四号仓库 (鸣潮&绝区零)" };
        const getStatusInfo = (result) => {
          const repoName = repoNames[result.repo] || `仓库 ${result.repo}`;
          if (result.nodeName === '本地') return { name: repoName, text: '已存在', statusClass: 'status-local', nodeName: '本地' };
          if (result.success) return { name: repoName, text: result.repo === 1 ? '下载/部署成功' : '下载成功', statusClass: 'status-ok', nodeName: result.nodeName };
          return { name: repoName, text: '下载失败', statusClass: 'status-fail', nodeName: result.nodeName || '执行异常' };
        };

        // 统一的数据构建函数
        const buildReportData = (results, overallSuccess) => {
          const successCount = results.filter(r => r.statusClass === 'status-ok' || r.statusClass === 'status-local').length;
          const totalCount = results.length;
          const percent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
          return {
            ...baseData,
            results: results,
            overallSuccess: overallSuccess,
            successCount: successCount,
            totalConfigured: totalCount,
            successRate: percent,
            successRateRounded: percent,
          };
        };

        switch (type) {
          case 'DL_REPORT_SUCCESS': {
            const results = [
              getStatusInfo({ repo: 1, success: true, nodeName: 'Ghfast(代理)' }),
              getStatusInfo({ repo: 2, success: true, nodeName: '本地' }),
              getStatusInfo({ repo: 3, success: true, nodeName: 'Ghproxy(代理)' }),
              getStatusInfo({ repo: 4, success: true, nodeName: 'Ghproxy(代理)' }),
            ];
            return buildReportData(results, true);
          }
          case 'DL_REPORT_MIXED': {
            const results = [
              getStatusInfo({ repo: 1, success: true, nodeName: 'Ghfast(代理)' }),
              getStatusInfo({ repo: 2, success: true, nodeName: '本地' }),
              getStatusInfo({ repo: 3, success: false, nodeName: 'GitHub(直连)' }),
              getStatusInfo({ repo: 4, success: true, nodeName: 'Ghproxy(代理)' }),
            ];
            return buildReportData(results, false);
          }
          case 'DL_REPORT_FAIL': {
            const results = [
              getStatusInfo({ repo: 1, success: false, nodeName: 'GitHub(直连)' }),
              getStatusInfo({ repo: 2, success: false, nodeName: 'Ghproxy(代理)' }),
              getStatusInfo({ repo: 3, success: false, nodeName: 'Moeyy(代理)' }),
              getStatusInfo({ repo: 4, success: false, nodeName: '所有节点失败' }),
            ];
            return buildReportData(results, false);
          }
          case 'DL_PROGRESS': return { ...baseData, title: "正在下载依赖...", subtitle: "(附属仓库聚合下载)", nodeName: "多节点并发", progress: 68, statusMessage: "接收数据中..." };
          case 'UP_REPORT_NOCHANGE': return { ...baseData, overallSuccess: true, overallHasChanges: false, results: [{ name: "一号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "二号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "三号仓库", statusText: "未下载", statusClass: "status-skipped" }, { name: "四号仓库", statusText: "未下载 (插件未安装)", statusClass: "status-skipped" }] };
          case 'UP_REPORT_CORE_CHANGE': return { ...baseData, overallSuccess: true, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "二号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "三号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" }] };
          case 'UP_REPORT_FORCE_SYNC': return { ...baseData, overallSuccess: true, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "本地冲突 (强制同步)", statusClass: "status-force-synced", log: mockLog }, { name: "二号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "三号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" }] };
          case 'UP_REPORT_CORE_FAIL': return { ...baseData, overallSuccess: false, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "模拟核心更新失败" } }, { name: "二号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "三号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" }] };
          case 'UP_REPORT_ALL_FAIL': return { ...baseData, overallSuccess: false, overallHasChanges: false, results: [{ name: "一号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "模拟一号仓失败" } }, { name: "二号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "模拟二号仓失败" } }, { name: "三号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "模拟三号仓失败" } }, { name: "四号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "模拟四号仓失败" } }] };
          case 'UP_REPORT_ALL_CHANGES': return { ...baseData, overallSuccess: true, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "二号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "三号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "四号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }] };
          case 'UP_REPORT_AUTOSWITCH_SUCCESS': return { ...baseData, overallSuccess: true, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "更新成功 (切换至Ghfast)", statusClass: "status-auto-switch", log: mockLog }, { name: "二号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "三号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" }] };
          case 'UP_REPORT_AUTOSWITCH_FAIL': return { ...baseData, overallSuccess: false, overallHasChanges: true, results: [{ name: "一号仓库", statusText: "更新失败", statusClass: "status-fail", error: { message: "切换节点后依旧失败" } }, { name: "二号仓库", statusText: "更新成功", statusClass: "status-ok", log: mockLog }, { name: "三号仓库", statusText: "已是最新", statusClass: "status-no-change", log: mockLog }, { name: "四号仓库", statusText: "未下载", statusClass: "status-skipped" }] };
          case 'HELP': { const mockPictureBasePath = `file://${MiaoPluginMBT.paths.backgroundImgPath.replace(/\\/g, '/')}/picture/`; const mockRandomIconPaths = Array(15).fill('').map((_, i) => `${mockPictureBasePath}simulated_icon_${i + 1}.png`); return { ...baseData, installedDays: "999", randomIconPaths: mockRandomIconPaths }; }
          case 'SPEEDTEST_SUCCESS': return { ...baseData, best1Display: "Ghfast(1416ms)", duration: "5.0", speeds: { priority1: [{ id: '02', name: 'Ghfast', statusText: '1416ms', barColorClass: 'bar-green', priority: 10 }, { id: '09', name: 'GhproxyNet', statusText: '1511ms', barColorClass: 'bar-green', priority: 50 }], priority2: [{ id: '13', name: 'GitHub', statusText: '2121ms', barColorClass: 'bar-yellow', priority: 300 }], priority3: [{ id: '11', name: 'GitClone', statusText: 'N/A', barColorClass: 'bar-gray', priority: 320 }] } };
          default: return baseData;
        }
      };

      const mockData = await getMockData(mockDataType);
      const imageBuffer = await renderPageToImage(`sim-${templateFileName}-${mockDataType}-${source}`, {
        htmlContent: templateHtml, data: mockData, pageGotoParams: { waitUntil: "networkidle0" }, screenshotOptions: { fullPage: true }
      }, this);
      if (imageBuffer) {
        return imageBuffer;
      } else {
        throw new Error("生成模拟图片失败 (返回空)");
      }
    };

    try {

      const type = itemToTrigger.type;
      if (type === 'SIMULATE_ERROR_WITH_LOG_CONTEXT') {
        const operationName = "模拟下载失败";
        logger.info(`开始模拟一个带日志上下文的错误流程...`);
        MiaoPluginMBT.log('info', operationName, '任务开始，正在检查环境...');
        const startTime = Date.now();
        await common.sleep(500);
        MiaoPluginMBT.log('debug', operationName, '环境检查通过，开始测速...');
        await common.sleep(1000);
        MiaoPluginMBT.log('warn', operationName, '节点 Ghproxy 超时，但仍在继续...');
        await common.sleep(500);
        MiaoPluginMBT.log('info', operationName, '核心库下载开始...');
        const mockError = new Error("这是一个在流程中模拟的顶层执行错误！");
        mockError.code = 'MOCK_E_123';
        const endTime = Date.now();
        await MiaoPluginMBT.ReportError(e, operationName, mockError, "这是一个由触发器#13生成的模拟上下文", this, { startTime, endTime });
        logger.info(`模拟错误流程已执行完毕。`);
        return true;
      }
      if (type === 'THROW_SYNC_FILES_FAILED') {
        const mockError = new Error("一个或多个关键资源同步失败，可能是仓库文件不完整。");
        mockError.code = 'SYNC_FAILED';
        mockError.syncDetails = {
          count: 5,
          files: [
            "GuGuNiu-Gallery/html/img/...",
            "GuGuNiu-Gallery/html/fonts/...",
            "GuGuNiu-Gallery/html/search_helper.html",
            "GuGuNiu-Gallery/html/status.html",
            "GuGuNiu-Gallery/html/visualize.html"
          ]
        };
        throw mockError;
      }

      if (type === "SIM_UPDATE_FAIL_WITH_DETAILS") {
        const originalUpdateTuKu = this.UpdateTuKu;
        let capturedForwardMsg = null;

        const mockE = {
          ...e,
          reply: async (msg) => {
            if (msg && msg.type === 'forward') {
              capturedForwardMsg = msg;
            }
            // 阻止真实消息发送
            return true;
          }
        };

        this.UpdateTuKu = async function (e_ignored, isScheduled) {
          const mockError = new Error("Connection timed out after 120000ms");
          mockError.code = 'ETIMEDOUT';
          mockError.stderr = "fatal: unable to access 'https://github.com/...': Recv failure: Connection was reset";

          const reportResults = [
            { name: "一号仓库", statusText: "更新失败", statusClass: "status-fail", error: mockError },
            { name: "二号仓库", statusText: "已是最新", statusClass: "status-no-change", log: [{ date: "刚刚", displayParts: [{ type: 'text', content: 'feat: ...' }] }] }
          ];
          const errorDetailsForForwardMsg = [];

          const result = reportResults[0];
          const formattedError = MiaoPluginMBT.FormatError(`更新${result.name}`, result.error, "", this.logPrefix);
          let errorReportText = `--- ${result.name} 更新失败 ---\n`;
          errorReportText += `${formattedError.summary}\n\n`;
          errorReportText += `**可能原因与建议**\n${formattedError.suggestions}\n\n`;
          if (result.error.stderr || result.error.stdout) {
            errorReportText += `**相关Git输出**\n${formattedError.contextInfo}`;
          }
          errorDetailsForForwardMsg.push(errorReportText);

          const forwardMsg = await common.makeForwardMsg(mockE, errorDetailsForForwardMsg, "咕咕牛更新失败详情");
          await mockE.reply(forwardMsg);
          return false; // 模拟更新失败
        };

        try {
          await this.UpdateTuKu(mockE, false);
          if (capturedForwardMsg) {
            await e.reply("已成功捕获并模拟发送详细错误报告：");
            await e.reply(capturedForwardMsg);
          } else {
            await e.reply("模拟失败：未能捕获到预期的合并转发消息。");
          }
        } finally {
          this.UpdateTuKu = originalUpdateTuKu;
        }

      } else if (type === "SIM_ALL_REMOTE" || type === "SIM_ALL") {
        const localSimTriggers = TRIGGERABLE_ITEMS.filter(item => item.type.startsWith("SIM_TPL_") && item.type.endsWith("_LOCAL"));
        const remoteSimTriggers = TRIGGERABLE_ITEMS.filter(item => item.type.startsWith("SIM_TPL_") && item.type.endsWith("_REMOTE"));

        let tasks = [];
        if (type === "SIM_ALL_REMOTE") {
          tasks = remoteSimTriggers;
          await e.reply(`收到！开始逐个渲染 ${tasks.length} 个在线模板...`, true);
        } else {
          tasks = [...localSimTriggers, ...remoteSimTriggers];
          await e.reply(`收到！开始逐个渲染 ${tasks.length} 个本地及在线模板...`, true);
        }

        for (const task of tasks) {
          await e.reply(`--- 正在渲染: ${task.name} ---`).catch(() => { });
          await common.sleep(500);
          try {
            const match = task.type.match(/^SIM_TPL_([A-Z_]+)_(LOCAL|REMOTE)$/);
            const coreType = match[1];
            const source = match[2].toLowerCase();
            let templateFileName = '';
            if (coreType.startsWith("UP_REPORT")) templateFileName = 'update_report';
            else if (coreType.startsWith("DL_REPORT")) templateFileName = 'download';
            else if (coreType === 'DL_PROGRESS') templateFileName = 'download_progress';
            else if (coreType === 'HELP') templateFileName = 'help';
            else if (coreType === 'SPEEDTEST_SUCCESS') templateFileName = 'speedtest';

            const buffer = await renderEngine(templateFileName, coreType, source);
            if (buffer) { await e.reply(buffer); }
            else { await e.reply(`渲染失败: ${task.name}`); }
          } catch (err) { this.logger.error(`渲染 ${task.name} 失败:`, err); await e.reply(`渲染异常: ${task.name}\n${err.message}`); }
          await common.sleep(1000);
        }
        await e.reply("所有模板渲染任务执行完毕。");

      } else if (type.startsWith("SIM_TPL_")) {
        const match = type.match(/^SIM_TPL_([A-Z_]+)_(LOCAL|REMOTE)$/);
        if (!match) throw new Error(`无法解析的模板触发类型: ${type}`);
        const coreType = match[1];
        const source = match[2].toLowerCase();

        let templateFileName = '';
        if (coreType.startsWith("UP_REPORT")) {
          templateFileName = 'update_report';
        } else if (coreType.startsWith("DL_REPORT")) {
          templateFileName = 'download';
        } else if (coreType === 'DL_PROGRESS') {
          templateFileName = 'download_progress';
        } else if (coreType === 'HELP') {
          templateFileName = 'help';
        } else if (coreType === 'SPEEDTEST_SUCCESS') {
          templateFileName = 'speedtest';
        }

        if (!templateFileName) throw new Error(`未找到核心类型 '${coreType}' 的模板映射。`);

        const imageBuffer = await renderEngine(templateFileName, coreType, source);
        if (imageBuffer) await e.reply(imageBuffer);

      } else if (type.startsWith("THROW_")) {
        let mockError = new Error(`模拟错误 (${type}): ${itemToTrigger.description}`);
        switch (type) {
          case "THROW_GIT_AUTH_FAIL": mockError.code = 128; mockError.stderr = "fatal: Authentication failed"; throw mockError;
          case "THROW_NET_TIMEOUT": mockError.code = "ETIMEDOUT"; throw mockError;
          case "THROW_FS_EACCES": mockError.code = "EACCES"; await fsPromises.writeFile("/root/test.txt", "test"); break;
          case "THROW_FS_ENOENT": mockError.code = "ENOENT"; await fsPromises.access("/path/to/a/ghost/town"); break;
          case "THROW_REFERENCE_ERROR": someUndefinedVariable.doSomething(); break;
          case "THROW_RENDER_TEMPLATE_DATA_ERROR": await renderPageToImage("err", { htmlContent: "<div>{{ undefinedVariable }}</div>", data: {} }, this); break;
          case "THROW_RENDER_TIMEOUT": await renderPageToImage("err", { htmlContent: "<div>Hang</div>", pageGotoParams: { timeout: 10 } }, this); break;
          default: throw mockError;
        }
      } else {
        await e.reply(`该触发器 (${type}) 的模拟方式暂未实现或已废弃。`);
      }
    } catch (error) { await this.ReportError(e, `模拟错误 (${itemToTrigger.name})`, error, `用户触发: #${triggerInput}`); }
    return true;
  }

  async ManualTestProxies(e) {
    if (!(await this.CheckInit(e))) return true;
    await e.reply(`收到！开始火力全开测试网络节点🚀🚀🚀🚀🚀...`, true);
    const startTime = Date.now();
    let allTestResults = [];
    let best1Display = "无可用源";
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const GITEE_TEMPLATE_URL = "https://gitee.com/GuGuNiu/Miao-Plugin-MBT/raw/master/speedtest.html";
    const localTemplatePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "speedtest.html");
    let templateContent = "";

    try {
      templateContent = await fsPromises.readFile(localTemplatePath, "utf8");
      //logger.info(`${Default_Config.logPrefix}已成功从本地加载测速模板。`);
    } catch (localFileError) {
      //logger.warn(`${Default_Config.logPrefix}本地测速模板加载失败 (${localFileError.message})，将尝试从 Gitee 获取在线模板作为备用。`);
      try {
        const response = await fetch(GITEE_TEMPLATE_URL, { timeout: 10000 });
        if (!response.ok) {
          throw new Error(`Gitee请求失败，状态码: ${response.status}`);
        }
        templateContent = await response.text();
        //logger.info(`${Default_Config.logPrefix}已成功从Gitee获取备用在线测速模板。`);
      } catch (fetchError) {
        logger.error(`${Default_Config.logPrefix}CRITICAL: 本地和在线测速模板均无法获取！`, fetchError);
        await e.reply("生成测速报告失败：本地和在线模板均无法加载。");
        return true;
      }
    }

    if (!templateContent) {
      logger.error(`${Default_Config.logPrefix}CRITICAL: 模板内容为空，无法继续渲染。`);
      await e.reply("生成测速报告失败：获取到的模板内容为空。");
      return true;
    }

    try {
      allTestResults = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, logger);

      let nodeIdCounter = 0;
      const processedSpeedsResult = allTestResults.map((s) => {
        const isFiniteSpeed = Number.isFinite(s.speed) && s.speed >= 0;
        const statusText = s.testUrlPrefix === null ? "N/A" : (isFiniteSpeed ? `${s.speed}ms` : "超时");
        let statusClass = ''; // 主要状态类 (ok/timeout/na)
        let latencyColorClass = ''; // 用于数值颜色的附加类 (green/yellow/orange)

        if (s.testUrlPrefix === null) {
          statusClass = "status-na";
          latencyColorClass = 'latency-na';
        } else if (!isFiniteSpeed) {
          statusClass = "status-timeout";
          latencyColorClass = 'latency-timeout';
        } else {
          statusClass = "status-ok"; // 初始标记为成功
          // 根据速度值确定具体颜色
          if (s.speed > 3000) {
            latencyColorClass = 'latency-orange';
          } else if (s.speed > 2000) {
            latencyColorClass = 'latency-yellow';
          } else {
            latencyColorClass = 'latency-green';
          }
        }

        let barColorClass = '';
        if (s.testUrlPrefix === null) {
          barColorClass = 'bar-gray';
        } else if (!isFiniteSpeed) {
          barColorClass = 'bar-red';
        } else if (s.speed > 3000) {
          barColorClass = 'bar-orange';
        } else if (s.speed > 2000) {
          barColorClass = 'bar-yellow';
        } else {
          barColorClass = 'bar-green';
        }
        nodeIdCounter++;
        return {
          id: String(nodeIdCounter).padStart(2, '0'),
          ...s,
          statusText,
          statusClass,
          latencyColorClass,
          barColorClass,
        };
      });

      const available1 = MiaoPluginMBT.applySmartSelectionStrategy(allTestResults, logger);
      const best1Raw = available1[0] || null;
      if (best1Raw) {
        let speedInfo = "N/A";
        if (best1Raw.testUrlPrefix !== null) speedInfo = Number.isFinite(best1Raw.speed) && best1Raw.speed >= 0 ? `${best1Raw.speed}ms` : "超时";
        best1Display = `${best1Raw.name}(${speedInfo})`;
      }

      const tiers = {
        priority1: [], // 优先级最高且非特殊命名的节点
        priority2: [], // GitHub, Mirror
        priority3: []  // GitClone
      };

      for (const s of processedSpeedsResult) {
        if (s.name === "GitHub" || s.name === "Mirror") {
          tiers.priority2.push(s);
        } else if (s.name === "GitClone") {
          tiers.priority3.push(s);
        } else {
          tiers.priority1.push(s); // 所有其他代理节点归为第一梯队
        }
      }

      // 对每个梯队内部进行排序（按优先级，然后按速度，最后按名称）
      const sortTier = (arr) => arr.sort((a, b) =>
        (a.priority ?? 999) - (b.priority ?? 999) ||
        (a.speed === Infinity ? Infinity : a.speed) - (b.speed === Infinity ? Infinity : b.speed) ||
        a.name.localeCompare(b.name)
      );
      sortTier(tiers.priority1);
      sortTier(tiers.priority2);
      sortTier(tiers.priority3);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      const renderData = {
        speeds: tiers,
        best1Display: best1Display,
        duration: duration,
        scaleStyleValue: scaleStyleValue,
        pluginVersion: Version,
      };

      const dataForTemplate = lodash.cloneDeep(renderData);

      const imageBuffer = await renderPageToImage(
        "manual-speedtest", {
        htmlContent: templateContent,
        data: dataForTemplate,
        imgType: "png",
        pageGotoParams: {
          waitUntil: "networkidle0"
        },
        pageBoundingRect: {
          selector: ".container",
        },
      }, this);

      if (imageBuffer) await e.reply(imageBuffer);
      else { logger.error(`${Default_Config.logPrefix}生成截图失败 (Puppeteer 返回空)。`); await e.reply("生成测速报告图片失败了，请看看日志。"); }
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const renderDataOnError = {
        speeds: { priority1: [], priority2: [], priority3: [] }, // 确保至少是空对象，避免模板崩溃
        best1Display: "测速失败",
        duration: duration,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        pluginVersion: Version,
      };
      // 尝试渲染一个带有错误提示的报告，即使整个测速失败
      try {
        const errorImageBuffer = await renderPageToImage(
          "manual-speedtest-error", {
          htmlContent: templateContent, // 即使失败也尝试用获取到的模板
          data: renderDataOnError,
          imgType: "png",
          pageGotoParams: { waitUntil: "networkidle0" },
          pageBoundingRect: { selector: ".container", padding: 0 }, width: 540,
        }, this);
        if (errorImageBuffer) {
          await e.reply(["测速过程中遇到严重问题，这是报告：", errorImageBuffer]);
        } else {
          await e.reply("测速过程中遇到严重问题，无法生成报告图片，请查看控制台日志。", true);
        }
      } catch (renderOnErrorErr) {
        logger.error(`${Default_Config.logPrefix}渲染错误报告图片也失败:`, renderOnErrorErr);
        await e.reply("测速过程中遇到严重问题，无法生成报告图片，请查看控制台日志。", true);
      }
      await this.ReportError(e, "手动网络测速", error, `测速结果(原始): ${JSON.stringify(allTestResults)}`);
    }
    return true;
  }

  async ShowSettingsPanel(e, statusMessage = "") {
    if (!(await this.CheckInit(e))) return true;
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "settings_panel.html");

    try {
      try { await fsPromises.access(sourceHtmlPath); }
      catch (err) {
        logger.error(`${Default_Config.logPrefix}找不到模板文件: ${sourceHtmlPath}`, err);
        await e.reply("无法显示设置面板：缺少 settings_panel.html 模板文件。");
        return true;
      }

      const config = MiaoPluginMBT.MBTConfig;
      const isSerialMode = (config?.Execution_Mode ?? 'Batch') === 'Serial';
      const currentLoadLevel = config?.Load_Level ?? 1;
      const levelInfo = LOAD_LEVEL_CONFIG[currentLoadLevel] || LOAD_LEVEL_CONFIG[1];

      const renderData = {
        pluginVersion: Version,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        tuKuStatus: { text: (config?.TuKuOP ?? Default_Config.defaultTuKuOp) ? "已启用" : "已禁用", class: (config?.TuKuOP ?? Default_Config.defaultTuKuOp) ? "value-enabled" : "value-disabled", },
        pflStatus: { level: (config?.PFL ?? Default_Config.defaultPfl), description: Purify_Level.getDescription(config?.PFL ?? Default_Config.defaultPfl), class: `value-level-${config?.PFL ?? Default_Config.defaultPfl}`, },
        aiStatus: { text: (config?.Ai ?? true) ? "已开启" : "已关闭", class: (config?.Ai ?? true) ? "value-enabled" : "value-disabled", },
        easterEggStatus: { text: (config?.EasterEgg ?? true) ? "已开启" : "已关闭", class: (config?.EasterEgg ?? true) ? "value-enabled" : "value-disabled", },
        layoutStatus: { text: (config?.layout ?? true) ? "已开启" : "已关闭", class: (config?.layout ?? true) ? "value-enabled" : "value-disabled", },
        executionMode: { text: isSerialMode ? "已开启" : "已关闭", class: isSerialMode ? 'value-enabled' : 'value-disabled', },
        loadLevel: {
          containerClass: isSerialMode ? '' : 'item-disabled',
          description: isSerialMode ? levelInfo.description : '仅在低负载模式下生效',
          valueClass: `value-level-${currentLoadLevel}`,
          levelName: `LV.${currentLoadLevel} ${levelInfo.name}`
        },
        advancedForward: { text: (config?.Use_Advanced_Forward ?? false) ? "已开启" : "已关闭", class: (config?.Use_Advanced_Forward ?? false) ? "value-enabled" : "value-disabled", },
        sleeperAgentStatus: {
          text: (config?.SleeperAgent_switch ?? true) ? "已开启" : "已关闭",
          class: (config?.SleeperAgent_switch ?? true) ? "value-enabled" : "value-disabled",
        },
        renderScale: {
          value: config?.renderScale ?? Default_Config.renderScale,
        },
      };

      const imageBuffer = await renderPageToImage(
        "settings-panel", {
        tplFile: sourceHtmlPath,
        data: renderData,
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        pageBoundingRect: { selector: ".container" },
      }, this);

      if (imageBuffer) {
        await e.reply(imageBuffer);
      } else {
        // 截图失败时，将状态文字作为回退方案发送
        logger.error(`${Default_Config.logPrefix}Puppeteer 未能成功生成图片 (返回空)。`);
        let fallbackMsg = `${Default_Config.logPrefix}哎呀，设置面板图片生成失败了...`;
        if (statusMessage) {
          fallbackMsg = `${Default_Config.logPrefix}${statusMessage}\n(但设置面板图片生成失败了，请检查日志)`;
        }
        await e.reply(fallbackMsg, true);
      }
    } catch (error) {
      logger.error(`${Default_Config.logPrefix}生成或发送面板时发生严重错误:`, error);
      let errorReportMsg = "显示设置面板时发生内部错误。";
      if (statusMessage) {
        errorReportMsg = `${Default_Config.logPrefix}${statusMessage}\n但在生成设置面板时发生了内部错误。`;
      }
      await this.ReportError(e, "显示设置面板", error, errorReportMsg);
    }
    return true;
  }

  async HandleSettingsCommand(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${Default_Config.logPrefix}只有主人才能使用设置命令哦~`);

    const match = e.msg.match(/^#咕咕牛设置(ai|彩蛋|横屏|净化等级|低负载|负载等级|高级合并|原图拦截|渲染精度)(开启|关闭|[0-9]+)$/i);
    if (!match) return false;

    const featureKey = match[1].toLowerCase();
    const valueRaw = match[2];

    switch (featureKey) {
      case 'ai':
      case '彩蛋':
      case '横屏':
        if (valueRaw !== '开启' && valueRaw !== '关闭') {
          return e.reply(`无效操作: [${featureKey}] 只能用 '开启' 或 '关闭'。`, true);
        }
        const enable = valueRaw === '开启';
        let configKey = "", featureName = "";
        if (featureKey === 'ai') { configKey = "Ai"; featureName = "Ai 图"; }
        else if (featureKey === '彩蛋') { configKey = "EasterEgg"; featureName = "彩蛋图"; }
        else if (featureKey === '横屏') { configKey = "layout"; featureName = "横屏图"; }
        await this.handleSwitchCommand(e, configKey, featureName, enable);
        break;

      case '净化等级':
        const level = parseInt(valueRaw, 10);
        if (isNaN(level) || ![0, 1, 2].includes(level)) {
          return e.reply(`无效的净化等级: [${valueRaw}]，只能是 0, 1, 或 2。`, true);
        }
        await this.setPurificationLevelInternal(e, level);
        break;

      case '低负载':
        if (valueRaw !== '开启' && valueRaw !== '关闭') {
          return e.reply(`无效操作: 只能用 '开启' 或 '关闭'。`, true);
        }
        const modeEnable = valueRaw === '开启';
        const targetMode = modeEnable ? 'Serial' : 'Batch';
        await this.setExecutionModeInternal(e, targetMode, '低负载模式', valueRaw);
        break;

      case '负载等级':
        const loadLevel = parseInt(valueRaw, 10);
        if (isNaN(loadLevel) || ![1, 2, 3].includes(loadLevel)) {
          return e.reply(`无效的负载等级: [${valueRaw}]，只能是 1, 2, 或 3。`, true);
        }
        await this.setLoadLevelInternal(e, loadLevel);
        break;

      case '高级合并':
        if (valueRaw !== '开启' && valueRaw !== '关闭') {
          return e.reply(`无效操作: 只能用 '开启' 或 '关闭'。`, true);
        }
        await this.handleSwitchCommand(e, 'Use_Secondary_Forward', '高级合并模式', valueRaw === '开启');
        break;

      case '原图拦截':
        if (valueRaw !== '开启' && valueRaw !== '关闭') {
          return e.reply(`无效操作: [原图拦截] 只能用 '开启' 或 '关闭'。`, true);
        }
        await this.handleSwitchCommand(e, 'SleeperAgent_switch', '原图智能拦截', valueRaw === '开启');
        break;
      case '渲染精度':
        const scale = parseInt(valueRaw, 10);
        if (isNaN(scale) || scale < 100 || scale > 500) {
          return e.reply(`无效的渲染精度: [${valueRaw}]，只能是 100 到 500 之间的数字。`, true);
        }
        await this.setRenderScaleInternal(e, scale);
        break;
    }
    return true;
  }

  async setExecutionModeInternal(e, targetMode, featureName, action) {
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    let configChanged = false;
    let saveWarning = "";
    let statusMessageForPanel = "";

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentMode = MiaoPluginMBT.MBTConfig.Execution_Mode ?? Default_Config.Execution_Mode;

      if (currentMode === targetMode) {
        statusMessageForPanel = `${featureName}已经是「${action}」状态了。`;
        return;
      }

      MiaoPluginMBT.MBTConfig.Execution_Mode = targetMode;
      configChanged = true;

      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
      if (!saveSuccess) {
        saveWarning = "⚠️ 但是配置保存失败了！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.Execution_Mode = currentMode;
        configChanged = false;
        await this.ReportError(e, `设置${featureName}`, new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `${featureName}已成功设为「${action}」。`;
    }

    if (saveWarning && !statusMessageForPanel.includes(saveWarning)) {
      statusMessageForPanel = saveWarning + (statusMessageForPanel ? `\n${statusMessageForPanel}` : '');
    }

    await this.ShowSettingsPanel(e, statusMessageForPanel.trim());
  }

  async setLoadLevelInternal(e, level) {
    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, this.logger);
      MiaoPluginMBT.MBTConfig.Load_Level = level;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger);
      if (!saveSuccess) {
        await this.ReportError(e, "设置负载等级", new Error("保存配置失败"));
      }
    });
    await this.ShowSettingsPanel(e, `${Default_Config.logPrefix}负载等级已设为 ${level} 级。`);
  }

  async setPurificationLevelInternal(e, level) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    let configChanged = false; let saveWarning = "";
    let statusMessageForPanel = "";

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentLevel = MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl;
      if (level === currentLevel) {
        statusMessageForPanel = `净化等级已经是 ${level} (${Purify_Level.getDescription(level)}) 啦。`;
        return;
      }
      MiaoPluginMBT.MBTConfig.PFL = level; configChanged = true;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
      if (!saveSuccess) {
        saveWarning = "⚠️ 但是配置保存失败了！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.PFL = currentLevel; configChanged = false;
        logger.error(`${Default_Config.logPrefix}保存失败，内存状态已回滚。`);
        await this.ReportError(e, "设置净化等级", new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `净化等级已设为 ${level} (${Purify_Level.getDescription(level)})。`;
      if (level === Purify_Level.PX18_PLUS) statusMessageForPanel += "\n(Px18 指轻微性暗示或低度挑逗性图片)";
      setImmediate(async () => {
        try {
          //logger.info(`${Default_Config.logPrefix}后台开始应用新的净化等级 ${level}...`);
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
          //logger.info(`${Default_Config.logPrefix}新的生效封禁列表已应用。`);
          if (MiaoPluginMBT.MBTConfig.TuKuOP) {
            //logger.info(`${Default_Config.logPrefix}图库已启用，开始重新同步角色文件夹...`);
            await MiaoPluginMBT.SyncCharacterFolders(logger);
            //logger.info(`${Default_Config.logPrefix}角色文件夹重新同步完成。`);
          } else logger.info(`${Default_Config.logPrefix}图库已禁用，跳过角色文件夹同步。`);
        } catch (applyError) {
          logger.error(`${Default_Config.logPrefix}后台应用或同步时出错:`, applyError);
          await this.ReportError(e, "应用净化等级 (后台)", applyError);
        }
      });
    }

    // 统一调用 ShowSettingsPanel
    // 如果 statusMessageForPanel 为空（例如状态未变），则构建一个默认的
    if (!statusMessageForPanel && !saveWarning) {
      statusMessageForPanel = `净化等级已经是 ${level} (${Purify_Level.getDescription(level)}) 啦。`;
    }
    if (saveWarning && !statusMessageForPanel.includes(saveWarning)) {
      statusMessageForPanel = saveWarning + (statusMessageForPanel ? `\n${statusMessageForPanel}` : '');
    }

    try {
      await this.ShowSettingsPanel(e, statusMessageForPanel.trim());
    } catch (panelError) {
      logger.error(`${Default_Config.logPrefix}调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
    }
  }

  async handleSwitchCommand(e, configKey, featureName, enable) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    let configChanged = false; let saveWarning = "";
    let statusMessageForPanel = "";

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentStatus = MiaoPluginMBT.MBTConfig[configKey];
      if (currentStatus === enable) {
        statusMessageForPanel = `${featureName}已经是「${enable ? "开启" : "关闭"}」状态了。`;
        return;
      }
      MiaoPluginMBT.MBTConfig[configKey] = enable; configChanged = true;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
      if (!saveSuccess) {
        saveWarning = `⚠️ 但是配置保存失败了！设置可能不会持久生效。`;
        MiaoPluginMBT.MBTConfig[configKey] = !enable; configChanged = false;
        logger.error(`${Default_Config.logPrefix}[${featureName}设置] 保存失败，内存状态已回滚。`);
        await this.ReportError(e, `设置${featureName}`, new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `${featureName}已成功设为「${enable ? "开启" : "关闭"}」。`;
      setImmediate(async () => {
        try {
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
          if (MiaoPluginMBT.MBTConfig.TuKuOP) await MiaoPluginMBT.SyncCharacterFolders(logger);
        } catch (switchApplyError) {
          //logger.error(`${Default_Config.logPrefix}[${featureName}设置] 后台应用新开关状态时出错:`, switchApplyError);
        }
      });

    }

    if (!statusMessageForPanel && !saveWarning) {
      statusMessageForPanel = `${featureName}已经是「${enable ? "开启" : "关闭"}」状态了。`;
    }
    if (saveWarning && !statusMessageForPanel.includes(saveWarning)) {
      statusMessageForPanel = saveWarning + (statusMessageForPanel ? `\n${statusMessageForPanel}` : '');
    }

    try {
      await this.ShowSettingsPanel(e, statusMessageForPanel.trim());
    } catch (panelError) {
      logger.error(`${Default_Config.logPrefix}[${featureName}设置] 调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
    }
  }

  async setRenderScaleInternal(e, scale) {
    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, this.logger);
      MiaoPluginMBT.MBTConfig.renderScale = scale;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger);
      if (!saveSuccess) {
        await this.ReportError(e, "设置渲染精度", new Error("保存配置失败"));
      }
    });
    await this.ShowSettingsPanel(e, `${Default_Config.logPrefix}渲染精度已设为 ${scale}%。`);
  }

}

class SleeperAgent extends plugin {
  constructor() {
    super({
      name: '『咕咕牛🐂』原图管理 ',
      event: 'message',
      priority: 4900,
      rule: [
        { reg: /^#?原图$/, fnc: 'interceptOriginalImage' },
        { reg: /^#原图([\s\S]+)$/, fnc: 'debugOriginalImage', permission: 'master' },
        //============ 适配小叶面板 ============//
        { reg: /^(?:\[reply:[^\]]+\]\n?)?#?原图$/, fnc: 'interceptOriginalImage' },
      ],
    });
    this.task = { fnc: () => { }, log: false };
  }

  async debugOriginalImage(e) {
    const logger = global.logger || console;
    const sourceMsgId = e.msg.replace(/^#原图/, '').trim();

    //============ 适配小叶面板 ============//
    const replyReg = /^\[reply:(.+?)\]\n?/;
    let replyId = null;
    let msg = e.msg;

    const match = msg.match(replyReg);
    if (match) {
      replyId = match[1];
      msg = msg.replace(replyReg, '');
    }
    //========== 适配小叶面板 END===========//

    if (!sourceMsgId) {
      await e.reply("调试命令格式错误，请使用 #原图<消息ID>", true);
      return true;
    }

    logger.info(`[SleeperAgent-Debug] 收到调试指令，目标消息ID: ${sourceMsgId}`);
    const processed = await SleeperAgent._processOriginalImage(e, sourceMsgId);

    if (!processed) {
      await e.reply(`[SleeperAgent-Debug] 未能为ID [${sourceMsgId}] 找到任何原图信息。`, true);
    }

    return true;
  }

  async interceptOriginalImage(e) {
    //============ 适配小叶面板 ============//
    const replyReg = /^\[reply:(.+?)\]\n?/;
    let replyId = null;
    let msg = e.msg;

    const match = msg.match(replyReg);
    if (match) {
      replyId = match[1];
      msg = msg.replace(replyReg, '');
    }

    if (msg.length > 4 && msg.startsWith('#原图')) return false;

    // 优先用 YePanel 引用ID
    if (replyId) { return SleeperAgent._processOriginalImage(e, replyId); }
    //========== 适配小叶面板 END===========//

    if (e.msg.length > 4 && e.msg.startsWith('#原图')) return false;

    if (!e.getReply) return false;

    let reply = await e.getReply();
    if (!reply || !reply.message_id) return false;

    return SleeperAgent._processOriginalImage(e, reply.message_id);
  }

  static async _processOriginalImage(e, sourceMsgId) {
    const logger = global.logger || console;
    if (MiaoPluginMBT.MBTConfig.SleeperAgent_switch !== true) return false;
    //logger.info(`[SleeperAgent] 开始处理消息ID: ${sourceMsgId}`);
    const redisKeysToTry = [{ key: `miao:original-picture:${sourceMsgId}`, type: 'miao' }, { key: `ZZZ:PANEL:IMAGE:${sourceMsgId}`, type: 'zzz' }, { key: `Yunzai:waves:originpic:${sourceMsgId}`, type: 'waves' },];
    for (const { key, type } of redisKeysToTry) {
      try {
        const dataJson = await redis.get(key);
        if (dataJson) {
          //logger.info(`[SleeperAgent] 成功在Redis中找到 [${type}] 插件的数据！`);
          let imagePathEncoded = '';
          if (type === 'miao') imagePathEncoded = JSON.parse(dataJson).img || '';
          else if (type === 'zzz') imagePathEncoded = dataJson;
          else if (type === 'waves') imagePathEncoded = (JSON.parse(dataJson).img || [])[0] || '';
          if (!imagePathEncoded) {
            //logger.warn(`[SleeperAgent] 从Redis获取到 [${type}] 的数据，但路径为空。`);
            continue;
          }
          const imagePath = decodeURIComponent(imagePathEncoded);
          const fileName = path.basename(imagePath);
          let absolutePath;
          if (imagePath.startsWith('http')) { absolutePath = imagePath; }
          else if (type === 'miao') { absolutePath = path.join(YunzaiPath, 'plugins', 'miao-plugin', 'resources', imagePath); }
          else if (type === 'zzz') { absolutePath = path.join(MiaoPluginMBT.paths.target.zzzChar, imagePath); }
          else if (type === 'waves') { absolutePath = path.join(MiaoPluginMBT.paths.target.wavesChar, imagePath); }
          else { continue; }
          //logger.info(`[SleeperAgent] 解析出的最终绝对路径: ${absolutePath}`);
          if (fileName.toLowerCase().includes('gu')) {
            //logger.info(`[SleeperAgent] 文件名 "${fileName}" 包含 "Gu"，启动安全包装模式...`);
            try {
              const forwardNodes = [{ user_id: e.user_id, nickname: e.sender.card || e.sender.nickname, message: [segment.image(absolutePath)] }];
              const forwardMsg = await common.makeForwardMsg(e, [forwardNodes], `原图 - ${fileName}`);
              await e.reply(forwardMsg);
              await common.sleep(300);
              await e.reply(segment.at(e.user_id), false, { recallMsg: 15 });
            } catch (err) {
              //logger.error(`[SleeperAgent] 创建或发送安全包装消息失败: ${absolutePath}`, err);
              await e.reply(`无法获取原图，请稍后再试。`, true);
            }
            return true;
          }
          //logger.info(`[SleeperAgent] 文件名 "${fileName}" 不含 "Gu"，执行标准原图转发...`);
          await e.reply(segment.image(absolutePath));
          return true;
        }
      } catch (err) {
        //logger.error(`[SleeperAgent] 处理 [${type}] 插件Redis数据时出错:`, err);
      }
    }
    //logger.info(`[SleeperAgent] 未在任何已知插件的Redis中找到消息ID [${sourceMsgId}] 的原图信息。`);
    return false;
  }
}


const TRIGGERABLE_ITEMS = Object.freeze([
  { id: 1, name: "Git 操作失败 (认证/访问)", category: "底层错误", description: "模拟 Git 命令认证失败或无权限。预期：命令失败，ReportError报告。", type: "THROW_GIT_AUTH_FAIL" },
  { id: 2, name: "网络连接/超时失败", category: "底层错误", description: "模拟通用网络请求超时。预期：相关操作失败，ReportError报告。", type: "THROW_NET_TIMEOUT" },
  { id: 3, name: "FS: 权限错误 (EACCES)", category: "底层错误", description: "模拟文件系统无写入/读取权限。预期：相关FS操作失败，ReportError报告。", type: "THROW_FS_EACCES" },
  { id: 4, name: "FS: 路径未找到 (ENOENT)", category: "底层错误", description: "模拟访问不存在的文件或目录。预期：相关FS操作失败，ReportError报告。", type: "THROW_FS_ENOENT" },
  { id: 5, name: "截图: 模板数据错误", category: "底层错误", description: "模拟Puppeteer渲染时模板数据缺失或错误。预期：截图失败，ReportError报告。", type: "THROW_RENDER_TEMPLATE_DATA_ERROR" },
  { id: 6, name: "截图: 渲染超时", category: "底层错误", description: "模拟Puppeteer截图操作超时。预期：截图失败，ReportError报告。", type: "THROW_RENDER_TIMEOUT" },
  { id: 7, name: "配置: YAML解析失败", category: "底层错误", description: "模拟GalleryConfig.yaml格式错误。预期：配置加载失败，ReportError或日志。", type: "THROW_YAML_PARSE" },
  { id: 8, name: "数据: JSON解析失败", category: "底层错误", description: "模拟imagedata.json或banlist.json格式错误。预期：数据加载失败，ReportError或日志。", type: "THROW_JSON_PARSE" },
  { id: 9, name: "通用: 调用未知变量", category: "底层错误", description: "模拟代码中引用一个未定义的变量，触发ReferenceError。", type: "THROW_REFERENCE_ERROR" },
  { id: 10, name: "通用: 未知底层错误", category: "底层错误", description: "模拟一个未分类的底层异常。预期：ReportError报告。", type: "THROW_GENERIC_ERROR" },
  { id: 11, name: "资源同步失败 (文件丢失)", category: "底层错误", description: "模拟核心库下载后，同步公共资源时发现文件丢失。预期：显示专属的文件丢失报告图。", type: "THROW_SYNC_FILES_FAILED" },
  { id: 12, name: "下载流程: 核心库下载失败", category: "底层错误", description: "模拟核心库所有节点均下载失败，以测试顶层错误和日志捕获。", type: "TRIGGER_DOWNLOAD_FAILURE" },
  { id: 13, name: "错误报告: 附带精确日志", category: "核心图片报告模拟", description: "伪造一个带时间戳的错误，测试ReportError附加日志功能。", type: "SIMULATE_ERROR_WITH_LOG_CONTEXT" },
  { id: 21, name: "报告: 下载完成-混合结果", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：核心库成功，一个附属库失败，一个已存在。", type: "SIM_TPL_DL_REPORT_MIXED_REMOTE" },
  { id: 22, name: "报告: 下载完成-全部失败", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：所有尝试的仓库均下载失败。", type: "SIM_TPL_DL_REPORT_FAIL_REMOTE" },
  { id: 23, name: "报告: 下载完成-全部成功", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：所有配置的仓库均下载成功。", type: "SIM_TPL_DL_REPORT_SUCCESS_REMOTE" },
  { id: 30, name: "更新报告: 全部已是最新", category: "核心图片报告模拟", description: "模拟所有仓库均已是最新，无任何文件变更。", type: "SIM_TPL_UP_REPORT_NOCHANGE_LOCAL" },
  { id: 31, name: "更新报告: 核心有变，附属无变", category: "核心图片报告模拟", description: "模拟核心库有新的常规更新，附属库无变化。", type: "SIM_TPL_UP_REPORT_CORE_CHANGE_LOCAL" },
  { id: 32, name: "更新报告: 核心强制同步", category: "核心图片报告模拟", description: "模拟核心库因冲突被强制同步(reset --hard)。", type: "SIM_TPL_UP_REPORT_FORCE_SYNC_LOCAL" },
  { id: 33, name: "更新报告: 核心失败，附属成功", category: "核心图片报告模拟", description: "模拟核心库更新失败，附属库更新成功。", type: "SIM_TPL_UP_REPORT_CORE_FAIL_LOCAL" },
  { id: 34, name: "更新报告: 全部失败", category: "核心图片报告模拟", description: "模拟所有仓库均更新失败。", type: "SIM_TPL_UP_REPORT_ALL_FAIL_LOCAL" },
  { id: 35, name: "更新报告: 全部有变", category: "核心图片报告模拟", description: "模拟所有配置的仓库均有新的常规更新。", type: "SIM_TPL_UP_REPORT_ALL_CHANGES_LOCAL" },
  { id: 36, name: "更新报告: 自动切换节点成功", category: "核心图片报告模拟", description: "模拟核心库更新失败后，自动切换到Ghfast节点并成功更新。", type: "SIM_TPL_UP_REPORT_AUTOSWITCH_SUCCESS_LOCAL" },
  { id: 37, name: "更新报告: 自动切换节点后仍失败", category: "核心图片报告模拟", description: "模拟核心库更新失败，自动切换节点后再次失败。", type: "SIM_TPL_UP_REPORT_AUTOSWITCH_FAIL_LOCAL" },
  { id: 38, name: "更新报告: 失败并生成详细错误消息", category: "核心图片报告模拟", description: "模拟核心库更新失败，并触发生成详细的合并转发错误报告。", type: "SIM_UPDATE_FAIL_WITH_DETAILS" },
  { id: 50, name: "逻辑: 截图过程返回空值", category: "业务逻辑状态", description: "模拟任何截图操作后，Puppeteer未抛错但返回了null/undefined (可能是空白图)。预期：插件记录错误，可能回复用户生成失败。", type: "THROW_RENDER_NULL_BUFFER" },
  { id: 51, name: "逻辑: 配置文件恢复并通知", category: "业务逻辑状态", description: "模拟配置加载时触发恢复，成功恢复并(尝试)通知主人。预期：日志记录，主人收到私聊。", type: "THROW_CONFIG_RECOVERY_NOTICE" },
  { id: 52, name: "报告: 聚合下载进度(随机)", category: "核心图片报告模拟", description: "生成并发送一张模拟的聚合下载进度报告，核心库100%，附属库随机进度。", type: "SIM_TPL_DL_PROGRESS_REMOTE" },
  { id: 53, name: "报告: 网络帮助模板", category: "核心图片报告模拟", description: "强制从Gitee获取并渲染最新的在线帮助模板。", type: "SIM_TPL_HELP_REMOTE" },
  { id: 100, name: "一键渲染(网络模板)", category: "核心图片报告模拟", description: "一次性渲染所有在线模板并以合并消息发送。", type: "SIM_ALL_REMOTE" },
  { id: 101, name: "一键渲染(全部模板)", category: "核心图片报告模拟", description: "一次性渲染所有可渲染模板并以合并消息发送。", type: "SIM_ALL" },
]);

const GUGUNIU_RULES = [
  { reg: /^#下载咕咕牛$/i, fnc: "DownloadTuKu", permission: "master" },
  { reg: /^#更新咕咕牛$/i, fnc: "UpdateTuKu", permission: "master" },
  { reg: /^#重置咕咕牛$/i, fnc: "ManageTuKu", permission: "master" },
  { reg: /^#咕咕牛状态$/i, fnc: "CheckStatus" },
  { reg: /^#(启用|禁用)咕咕牛$/i, fnc: "ManageTuKuOption", permission: "master" },
  { reg: /^#咕咕牛封禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#咕咕牛解禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#(?:ban|咕咕牛封禁)列表$/i, fnc: "ManageUserBans" },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: "ExportSingleImage" },
  { reg: /^#咕咕牛查看\s*.*$/i, fnc: "FindRoleSplashes" },
  { reg: /^#可视化\s*.+$/i, fnc: "VisualizeRoleSplashes" },
  { reg: /^#咕咕牛帮助$/i, fnc: "Help" },
  { reg: /^#咕咕牛触发(?:\s*([a-zA-Z0-9_-]+))?$/i, fnc: "TriggerError", permission: "master" },
  { reg: /^#咕咕牛测速$/i, fnc: "ManualTestProxies" },
  { reg: /^#执行咕咕牛更新$/i, fnc: "ManualRunUpdateTask", permission: "master" },
  { reg: /^#(咕咕牛设置|咕咕牛面板)$/i, fnc: "ShowSettingsPanel" },
  { reg: /^#咕咕牛设置(ai|彩蛋|横屏|净化等级|低负载|负载等级|高级合并|原图拦截|渲染精度)(开启|关闭|[0-9]+)$/i, fnc: "HandleSettingsCommand", permission: "master" },
];


export { MiaoPluginMBT, SleeperAgent }