import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import yaml from "yaml";
import crypto from "node:crypto";
import template from "art-template";
import common from "../../lib/common/common.js";
import puppeteer from "../../lib/puppeteer/puppeteer.js";

/**
 * @description 咕咕牛图库管理器
 * @version 4.9.5
 * @description_details
 *    - 全面支持四仓库体系。
 *    - Puppeteer流程统一化。
 *    - 修复了多个命令执行流程与截图渲染问题。
 *    - 优化了配置加载与保存逻辑，增强了并发处理能力。
 *    - 降低了高耦合特征。
 *    - 统一了设置类命令的交互方式。
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YunzaiPath = path.resolve(__dirname, "..", "..");

const Purify_Level = {
  NONE: 0,
  RX18_ONLY: 1,
  PX18_PLUS: 2,
  getDescription: (level) => ({ 0: "不过滤", 1: "过滤R18", 2: "全部敏感项" }[level] ?? "未知"),
};

const RAW_URL_Repo1 = "https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main";

const Default_Config = {
  Main_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT/",    // 一号库 (热门五星)
  Ass_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-2/",   // 二号库 (原神+绝区零)
  Ass2_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-3/",  // 三号库 (星铁+鸣潮)
  Sexy_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-4/",  // 四号库 (PM18)

  SepositoryBranch: "main",
  proxies: [
    { name: "Moeyy", priority: 0, testUrlPrefix: `https://github.moeyy.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://github.moeyy.xyz/" },
    { name: "Ghfast", priority: 10, testUrlPrefix: `https://ghfast.top/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghfast.top/" },
    { name: "Ghp", priority: 20, testUrlPrefix: `https://ghp.ci/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghp.ci/" },
    { name: "Ghgo", priority: 20, testUrlPrefix: `https://ghgo.xyz/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghgo.xyz/" },
    { name: "Yumenaka", priority: 30, testUrlPrefix: `https://git.yumenaka.net/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://git.yumenaka.net/" },
    { name: "GhConSh", priority: 35, testUrlPrefix: `https://gh.con.sh/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.con.sh/" },
    { name: "GhpsCc", priority: 45, testUrlPrefix: `https://ghps.cc/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghps.cc/" },
    { name: "GhproxyCom", priority: 50, testUrlPrefix: `https://ghproxy.com/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghproxy.com/" },
    { name: "GhproxyNet", priority: 50, testUrlPrefix: `https://ghproxy.net/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://ghproxy.net/" },
    { name: "GhddlcTop", priority: 55, testUrlPrefix: `https://gh.ddlc.top/${RAW_URL_Repo1}`, cloneUrlPrefix: "https://gh.ddlc.top/" },
    { name: "GitClone", priority: 320, testUrlPrefix: null, cloneUrlPrefix: "https://gitclone.com/" },
    { name: "Mirror", priority: 80, testUrlPrefix: `https://raw.gitmirror.com/GuGuNiu/Miao-Plugin-MBT/main`, cloneUrlPrefix: "https://hub.gitmirror.com/" },
    { name: "GitHub", priority: 300, testUrlPrefix: RAW_URL_Repo1, cloneUrlPrefix: "https://github.com/" },
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
  PM18: false,
};

const ERROR_CODES = {
  NotFound: "ENOENT", Access: "EACCES", Busy: "EBUSY", Perm: "EPERM",
  NotEmpty: "ENOTEMPTY", ConnReset: "ECONNRESET", Timeout: "ETIMEDOUT", Exist: "EEXIST",
};

// ========================================================================= //
// ========================= 公共工具函数区域 =============================== //
// ========================================================================= //
/**
 * @description 安全地递归删除文件或目录，带重试逻辑。这玩意儿要是卡住了，我多踹几脚。
 */
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
          //logger.error(`${Default_Config.logPrefix} [安全删除] ${targetPath} 最终失败 (${attempts}次): ${lastErr.code || '未知错误码'}`);
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
        //logger.error(`${Default_Config.logPrefix} [安全删除] ${targetPath} 遇到未处理异常:`, err);
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

/**
 * @description 通用的递归复制文件夹函数，按扩展名过滤。复制粘贴一条龙。
 */
async function copyFolderRecursive(source, target, options = {}, logger = global.logger || console) {
  const { ignoreSet = new Set(), filterExtension = null } = options;
  const normalizedFilterExt = filterExtension ? filterExtension.toLowerCase() : null;
  try { await fsPromises.access(source); }
  catch (err) { if (err.code === ERROR_CODES.NotFound) return; logger.error(`${Default_Config.logPrefix} [递归复制] 源访问失败 ${source}:`, err); throw err; }
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
            logger.warn(`${Default_Config.logPrefix} [递归复制] 处理 ${entry.name} 出错:`, itemError.code);
          }
        }
      })
    );
  } catch (error) {
    if (![ERROR_CODES.Exist, ERROR_CODES.Access, ERROR_CODES.Perm].includes(error.code)) {
      logger.error(`${Default_Config.logPrefix} [递归复制] 操作失败 ${source} -> ${target}:`, error);
    } else if (error.code !== ERROR_CODES.Exist) {
      logger.warn(`${Default_Config.logPrefix} [递归复制] 操作警告 ${source} -> ${target}:`, error.code);
    }
  }
}

/**
 * @description 执行外部命令，处理流，支持超时和信号终止。命令行工具人Pro Max版。
 *              内部 stderr 处理会过滤控制台输出，但原始数据仍传递给 onStdErr 回调。
 */
function ExecuteCommand(command, args, options = {}, timeout = 0, onStdErr, onStdOut) {
  return new Promise((resolve, reject) => {
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
    try { proc = spawn(command, args, { stdio: "pipe", ...options, shell: false }); }
    catch (spawnError) { logger.error(`${Default_Config.logPrefix} [执行命令] 启动失败 [${cmdStr}]:`, spawnError); return reject(spawnError); }
    let stdout = ""; let stderr = ""; let timer = null; let killed = false; let exited = false; let promiseSettled = false; let lastStderrChunk = "";
    const settlePromise = (resolver, value) => { if (promiseSettled) return; promiseSettled = true; clearTimeout(timer); resolver(value); };
    const killProc = (signal = "SIGTERM") => {
      if (proc && proc.pid && !killed && !exited && !proc.killed) {
        logger.warn(`${Default_Config.logPrefix} [执行命令] 发送 ${signal} 到 ${proc.pid} (${cmdStr})`);
        try {
          if (process.platform !== "win32") process.kill(-proc.pid, signal);
          else process.kill(proc.pid, signal);
          if (signal === "SIGKILL") killed = true;
        } catch (killError) {
          if (killError.code !== "ESRCH") logger.error(`${Default_Config.logPrefix} [执行命令] kill ${proc.pid} (或进程组) 失败:`, killError);
          else logger.warn(`${Default_Config.logPrefix} [执行命令] kill ${proc.pid} 时进程已不存在 (ESRCH)`);
          killed = true;
        }
      }
    };
    if (timeout > 0) {
      timer = setTimeout(() => {
        if (exited || promiseSettled) return;
        killed = true; logger.warn(`${Default_Config.logPrefix} [执行命令] 命令 [${cmdStr}] 超时 (${timeout}ms)，终止...`);
        killProc("SIGTERM");
        setTimeout(() => { if (!exited && !promiseSettled) { logger.warn(`${Default_Config.logPrefix} [执行命令] SIGTERM 后进程未退出，发送 SIGKILL...`); killProc("SIGKILL"); } }, 3000);
        const err = new Error(`Command timed out after ${timeout}ms: ${cmdStr}`); err.code = ERROR_CODES.Timeout; err.stdout = stdout; err.stderr = stderr + `\n[Last Stderr Chunk Before Timeout]:\n${lastStderrChunk}`;
        settlePromise(reject, err);
      }, timeout);
    }
    const handleOutput = (streamName, data, externalCallback) => {
      if (exited || killed || promiseSettled) return;
      const outputChunk = data.toString();
      if (streamName === "stdout") stdout += outputChunk;
      else {
        stderr += outputChunk; lastStderrChunk = outputChunk;
        const शांतLogPrefixes = ["trace:", "http.c:", "== Info:", " Trying", " Connected to", " CONNECT tunnel:", " allocate connect buffer", " Establish HTTP proxy tunnel", " Send header:", " Recv header:", " CONNECT phase completed", " CONNECT tunnel established", " ALPN:", " TLSv1.", " SSL connection using", " Server certificate:", "  subject:", "  start date:", "  expire date:", "  subjectAltName:", "  issuer:", "  SSL certificate verify ok.", "   Certificate level", " using HTTP/", " [HTTP/", " Request completely sent off", " old SSL session ID is stale", " Connection #", " Found bundle for host", " Re-using existing connection", " upload completely sent off",];
        let isDetailedDebugLogForConsole = false; const trimmedChunk = outputChunk.trim();
        for (const prefix of शांतLogPrefixes) { if (trimmedChunk.startsWith(prefix)) { isDetailedDebugLogForConsole = true; break; } }
        const isCriticalErrorForConsole = trimmedChunk.match(/^(fatal|error|warning):/i) && !isDetailedDebugLogForConsole;
        if (isCriticalErrorForConsole) logger.error(`${Default_Config.logPrefix} [CMD ERR] ${trimmedChunk}`);
        else if (!isDetailedDebugLogForConsole && !trimmedChunk.match(/(Receiving objects|Resolving deltas|remote: Compressing objects|remote: Total|remote: Enumerating objects|remote: Counting objects):\s*(\d+)%/i) && trimmedChunk.length > 0) { /* 保持原始空else if */ }
      }
      if (externalCallback) { try { externalCallback(outputChunk); } catch (e) { logger.warn(`${Default_Config.logPrefix} ${streamName} 回调出错:`, e); } }
    };
    proc.stdout?.on("data", (data) => handleOutput("stdout", data, onStdOut));
    proc.stderr?.on("data", (data) => handleOutput("stderr", data, onStdErr));
    proc.on("error", (err) => {
      if (promiseSettled) return;
      exited = true; logger.error(`${Default_Config.logPrefix} [执行命令] 进程错误 [${cmdStr}]:`, err);
      clearTimeout(timer); err.stdout = stdout; err.stderr = stderr;
      settlePromise(reject, err);
    });
    proc.on("close", (code, signal) => {
      if (exited || promiseSettled) return;
      exited = true;
      clearTimeout(timer);
      if (code === 0) settlePromise(resolve, { code: 0, signal, stdout, stderr });
      else {
        const err = new Error(`Command failed with code ${code}: ${cmdStr}`);
        err.code = code ?? "UNKNOWN"; err.signal = signal; err.stdout = stdout; err.stderr = stderr;
        settlePromise(reject, err);
      }
    });
  });
}

/**
 * @description 计算文件夹大小，大概，有时候会漏算亿点点。
 */
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

/**
 * @description 格式化字节大小。
 */
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

/**
 * @description 原生异步互斥锁，确保资源访问的原子性。并发不是问题，只要排好队，一个一个来，谁也别想插队。
 */
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

// ================================================================= //
// ==================== Puppeteer统一调度站 ========================= //
// ================================================================= //
/**
 * @description Puppeteer统一调度接口
 * @param {string} rendererName 截图任务的名字
 * @param {object} options 截图参数
 * @param {string} [options.tplFile] HTML模板文件的绝对路径,如果提供了htmlContent，这个就当没看见。
 * @param {string} [options.htmlContent] 直接提供的HTML字符串内容 这个优先
 * @param {object} options.data 要喂给模板引擎的数据
 * @param {string} [options.imgType="png"] 图片格式，默认png
 * @param {object} [options.pageGotoParams={ waitUntil: "networkidle0" }] 页面跳转参数
 * @param {object} [options.screenshotOptions={ fullPage: true }] Puppeteer截图参数
 * @param {object} [options.pageBoundingRect] 如果只想截特定元素，用这个圈起来。
 * @param {number} [options.width] 视窗宽度
 * @param {object} [pluginInstanceOrLogger] 插件实例或logger对象
 * @returns {Promise<Buffer|null>} 图片Buffer，或者失败了就null
 */
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
        logger.error(`${logPrefix} [Puppeteer-${rendererName}] 读取模板或渲染HTML出错:`, fileOrRenderError);
        throw fileOrRenderError;
      }
    } else {
      logger.error(`${logPrefix} [Puppeteer-${rendererName}] 必须提供 tplFile 或 htmlContent 之一。`);
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
    };

    const puppeteerInternalRendererName = `guguniu-${rendererName}`;
    const imageBuffer = await puppeteer.screenshot(puppeteerInternalRendererName, puppeteerOptionsForScreenshot);

    if (!imageBuffer || imageBuffer.length === 0) {
      logger.error(`${logPrefix} [Puppeteer-${rendererName}] Puppeteer 返回了空的图片 Buffer。`);
      return null;
    }
    return imageBuffer;
  } catch (error) {
    logger.error(`${logPrefix} [Puppeteer-${rendererName}] 渲染过程出错了：`, error);
    if (error.message && error.message.toLowerCase().includes("timeout")) {
      logger.warn(`${logPrefix} [Puppeteer-${rendererName}] 渲染超时了哦。`);
    }
    return null;
  } finally {
    if (fs.existsSync(instanceTempPath)) {
      try { await safeDelete(instanceTempPath); }
      catch (cleanupError) {
        logger.warn(`${logPrefix} [Puppeteer-${rendererName}] 清理临时文件 ${instanceTempPath} 的时候好像有点小麻烦：`, cleanupError.code || cleanupError.message);
      }
    }
  }
}

// ================================================================= //
// ======================= 公共函数区域结束 ========================== //
// ================================================================= //

export class MiaoPluginMBT extends plugin {
  // --- 静态属性 ---
  static initializationPromise = null;
  static isGloballyInitialized = false;
  static MBTConfig = {};
  static _imgDataCache = Object.freeze([]);
  static _userBanSet = new Set();
  static _activeBanSet = new Set();
  static _aliasData = null;
  static oldFileDeletionScheduled = false;
  static isInitializing = false;

  static configMutex = new SimpleAsyncMutex();
  static gitMutex = new SimpleAsyncMutex();

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
    helpImagePath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "help.webp"),

    tempPath: path.join(YunzaiPath, "temp", "html", "GuGuNiu"),

    backgroundImgPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "html", "img"),
    target: {
      miaoChar: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "profile", "normal-character"),
      zzzChar: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "resources", "images", "panel"),
      wavesChar: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "rolePic"),
      exampleJs: path.join(YunzaiPath, "plugins", "example"),
      miaoGsAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-gs", "character"),
      miaoSrAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-sr", "character"),
      zzzAliasDir: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "defset"),
      wavesAliasDir: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "Alias"),
    },
    sourceFolders: { gs: "gs-character", sr: "sr-character", zzz: "zzz-character", waves: "waves-character", gallery: "GuGuNiu-Gallery", },
    filesToSyncToCommonRes: [
      { sourceSubPath: "GuGuNiu-Gallery/help.webp", destFileName: "help.webp" },
      { sourceSubPath: "GuGuNiu-Gallery/imagedata.json", destFileName: "imagedata.json" },
      { sourceSubPath: "GuGuNiu-Gallery/GalleryConfig.yaml", destFileName: "GalleryConfig.yaml", copyIfExists: false },
      { sourceSubPath: "GuGuNiu-Gallery/html/status.html", destFileName: "html/status.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/banlist.html", destFileName: "html/banlist.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/speedtest.html", destFileName: "html/speedtest.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/settings_panel.html", destFileName: "html/settings_panel.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/visualize.html", destFileName: "html/visualize.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/update_report.html", destFileName: "html/update_report.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/check_gallerymap.html", destFileName: "html/check_gallerymap.html", copyIfExists: true },
      { sourceSubPath: "GuGuNiu-Gallery/html/img", destFileName: "html/img", copyIfExists: true, isDir: true },
    ],
    filesToSyncSpecific: [{ sourceSubPath: "咕咕牛图库管理器.js", destDir: path.join(YunzaiPath, "plugins", "example"), destFileName: "咕咕牛图库管理器.js" }],
  };

  config = Default_Config;
  logPrefix = Default_Config.logPrefix;
  logger = global.logger || console;
  isPluginInited = false;
  task = null;

  static GetVersionStatic() {
    try {
      const pkgPath = path.resolve(__dirname, "..", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version || "4.9.5";
    }
    catch {
      return "4.9.5";
    }
  }

  constructor() {
    super({
      name: `『咕咕牛🐂』图库管理器 v${MiaoPluginMBT.GetVersionStatic()}`,
      dsc: "『咕咕牛🐂』图库管理器",
      event: "message", priority: 500, rule: GUGUNIU_RULES,
    });
    this.task = {
      name: `${this.logPrefix} 定时更新`,
      cron: Default_Config.cronUpdate,
      fnc: () => this.RunUpdateTask(),
      log: false,
    };
    this._initializeInstance();
  }

  async _initializeInstance() {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      MiaoPluginMBT.InitializePlugin(this.logger);
    }
    try {
      await MiaoPluginMBT.initializationPromise;
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
      if (this.isPluginInited && this.task && MiaoPluginMBT.MBTConfig.cronUpdate && this.task.cron !== MiaoPluginMBT.MBTConfig.cronUpdate) {
        this.logger.info(`${this.logPrefix} 更新 Cron 表达式: ${this.task.cron} -> ${MiaoPluginMBT.MBTConfig.cronUpdate}`);
        this.task.cron = MiaoPluginMBT.MBTConfig.cronUpdate;
      }
    } catch (initError) {
      this.logger.error(`${this.logPrefix} 实例等待全局初始化失败: ${initError.message}`);
      this.isPluginInited = false;
    }
  }

  // --- 静态方法区域 ---
  static async InitializePlugin(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    if (MiaoPluginMBT.isInitializing) {
      logger.warn(`${logPrefix} [初始化] 检测到初始化正在进行中，等待完成...`);
      try { await MiaoPluginMBT.initializationPromise; } catch (waitError) { }
      return MiaoPluginMBT.initializationPromise;
    }
    if (MiaoPluginMBT.initializationPromise) return MiaoPluginMBT.initializationPromise;
    if (MiaoPluginMBT.isGloballyInitialized) return Promise.resolve();

    MiaoPluginMBT.isInitializing = true;
    //logger.info(`${logPrefix} 开始全局初始化(V${MiaoPluginMBT.GetVersionStatic()})...`); //调式日志
    MiaoPluginMBT.isGloballyInitialized = false;
    MiaoPluginMBT.initializationPromise = (async () => {
      let fatalError = null;
      let localImgDataCache = [];
      try {
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, logger);
        if (!config || Object.keys(config).length === 0) throw new Error("无法加载图库配置");

        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, logger);
        if (!Array.isArray(localImgDataCache)) {
          logger.error(`${logPrefix} [初始化] CRITICAL: 元数据加载失败或格式错误!`);
          localImgDataCache = [];
          throw new Error("加载图片元数据失败");
        } else if (localImgDataCache.length === 0 && (await MiaoPluginMBT.IsTuKuDownloaded(1))) {
          logger.warn(`${logPrefix} [警告] 元数据为空 (核心库已下载)`);
        }

        const bansLoaded = await MiaoPluginMBT.LoadUserBans(true, logger);
        if (!bansLoaded) {
          logger.warn(`${logPrefix} [警告] 加载用户封禁列表失败`);
        }

        const aliasLoaded = await MiaoPluginMBT.LoadAliasData(true, logger);
        if (!MiaoPluginMBT._aliasData?.combined) {
          logger.warn(`${logPrefix} [警告] 加载别名数据失败`);
          MiaoPluginMBT._aliasData = { combined: {} };
        } else if (!aliasLoaded) {
          logger.warn(`${logPrefix} [警告] 部分别名加载失败`);
        } else if (Object.keys(MiaoPluginMBT._aliasData.combined).length === 0) {
          logger.warn(`${logPrefix} [警告] 别名数据为空`);
        }

        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, logger);
        MiaoPluginMBT._imgDataCache = Object.freeze(localImgDataCache);

        MiaoPluginMBT.isGloballyInitialized = true;
        logger.info(`${logPrefix} 全局初始化成功 版本号：v${MiaoPluginMBT.GetVersionStatic()}`);

        if (!MiaoPluginMBT.oldFileDeletionScheduled) {
          MiaoPluginMBT.oldFileDeletionScheduled = true;
          const delaySeconds = 15;
          //logger.info(`${logPrefix} [初始化] 已调度延迟 ${delaySeconds} 秒后清理旧文件任务。`); //调式日志
          setTimeout(async () => {
            const oldPluginFileName = "咕咕牛图库下载器.js";
            const oldPluginPath = path.join(MiaoPluginMBT.paths.target.exampleJs, oldPluginFileName);
            try {
              await fsPromises.access(oldPluginPath);
              //logger.warn(`${logPrefix} [延迟清理] 检测到旧插件文件 (${oldPluginFileName})，将尝试删除...`); //调式日志
              await fsPromises.unlink(oldPluginPath);
              //logger.info(`${logPrefix} [延迟清理] 旧插件文件 (${oldPluginFileName}) 已成功删除。`);   //调式日志
            } catch (err) {
              if (err.code !== ERROR_CODES.NotFound) logger.error(`${logPrefix} [延迟清理] 删除旧插件文件 (${oldPluginPath}) 时出错:`, err);
            }
          }, delaySeconds * 1000);
        }
      } catch (error) {
        fatalError = error;
        MiaoPluginMBT.isGloballyInitialized = false;
        logger.error(`${logPrefix} !!! 全局初始化失败: ${fatalError.message} !!!`);
        logger.error(fatalError.stack);
        MiaoPluginMBT._imgDataCache = Object.freeze([]); MiaoPluginMBT._userBanSet = new Set();
        MiaoPluginMBT._activeBanSet = new Set(); MiaoPluginMBT._aliasData = null;
        throw fatalError;
      } finally { MiaoPluginMBT.isInitializing = false; }
    })();
    MiaoPluginMBT.initializationPromise.catch((err) => { });
    return MiaoPluginMBT.initializationPromise;
  }

  static async LoadTuKuConfig(forceReload = false, logger = global.logger || console, configPath = MiaoPluginMBT.paths.configFilePath) {
    const logPrefix = Default_Config.logPrefix;
    if (!forceReload && MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0) {
      return MiaoPluginMBT.MBTConfig;
    }
    let configData = {};
    try {
      await fsPromises.access(configPath);
      const content = await fsPromises.readFile(configPath, "utf8");
      const parsed = yaml.parse(content);
      if (parsed === null || typeof parsed !== 'object') {
        logger.warn(`${logPrefix} [加载配置] ${configPath} 解析结果非对象或为null，视为空配置。`);
        configData = {};
      } else {
        configData = parsed;
      }
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        //logger.info(`${logPrefix} [加载配置] ${configPath} 未找到，将使用默认配置。`);
      } else {
        logger.error(`${logPrefix} [加载配置] 读取或解析配置文件 ${configPath} 失败:`, error);
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
      PM18: parseBoolLike(configData.PM18, Default_Config.PM18),
      cronUpdate: configData.cronUpdate || Default_Config.cronUpdate,
    };
    if (![Purify_Level.NONE, Purify_Level.RX18_ONLY, Purify_Level.PX18_PLUS].includes(loadedConfig.PFL)) {
      logger.warn(`${logPrefix} [加载配置] 检测到无效的净化等级配置 (${loadedConfig.PFL})，已重置为默认值 (${Default_Config.defaultPfl})。`);
      loadedConfig.PFL = Default_Config.defaultPfl;
    }
    MiaoPluginMBT.MBTConfig = loadedConfig;
    return MiaoPluginMBT.MBTConfig;
  }

  static async SaveTuKuConfig(configData, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const configFilePath = MiaoPluginMBT.paths.configFilePath;
    try {
      const dataToSave = {
        TuKuOP: configData.TuKuOP ? 1 : 0,
        PFL: configData.PFL,
        Ai: configData.Ai ? 1 : 0,
        EasterEgg: configData.EasterEgg ? 1 : 0,
        layout: configData.layout ? 1 : 0,
        PM18: configData.PM18 ? 1 : 0,
        cronUpdate: configData.cronUpdate,
      };
      const dirPath = path.dirname(configFilePath);
      try { await fsPromises.mkdir(dirPath, { recursive: true }); }
      catch (mkdirError) { logger.error(`${logPrefix} [保存配置] 创建目录 ${dirPath} 失败:`, mkdirError); return false; }
      const yamlString = yaml.stringify(dataToSave);
      await fsPromises.writeFile(configFilePath, yamlString, "utf8");
      MiaoPluginMBT.MBTConfig = { ...MiaoPluginMBT.MBTConfig, ...configData };
      return true;
    } catch (error) { logger.error(`${logPrefix} [保存配置] 写入配置文件 ${configFilePath} 失败:`, error); return false; }
  }

  static async LoadImageData(forceReload = false, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    if (MiaoPluginMBT._imgDataCache?.length > 0 && !forceReload) return MiaoPluginMBT._imgDataCache;

    let data = null;
    let loadedFromFile = false;
    const primaryPath = MiaoPluginMBT.paths.imageDataPath;
    const secondaryPath = path.join(MiaoPluginMBT.paths.LocalTuKuPath, MiaoPluginMBT.paths.sourceFolders.gallery, path.basename(MiaoPluginMBT.paths.imageDataPath));

    try {
      const content = await fsPromises.readFile(primaryPath, "utf8");
      data = JSON.parse(content);
      loadedFromFile = true;
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        try {
          await fsPromises.access(secondaryPath);
          const sourceContent = await fsPromises.readFile(secondaryPath, "utf8");
          data = JSON.parse(sourceContent);
          logger.info(`${logPrefix} [加载元数据] 从仓库源加载成功: ${secondaryPath}`);
          loadedFromFile = true;
        } catch (srcError) {
          if (srcError.code === ERROR_CODES.NotFound) {
            logger.warn(`${logPrefix} [加载元数据] 主路径和仓库源均未找到 imagedata.json。`);
          } else {
            logger.error(`${logPrefix} [加载元数据] 加载或解析仓库源文件失败 (${secondaryPath}):`, srcError);
          }
          data = null;
          loadedFromFile = false;
        }
      } else {
        logger.error(`${logPrefix} [加载元数据] 读取或解析主路径文件失败 (${primaryPath}):`, error);
        data = null;
        loadedFromFile = false;
      }
    }

    let finalData = [];
    if (!loadedFromFile || !Array.isArray(data) || data.length === 0) {
      if (!loadedFromFile && (!data || (Array.isArray(data) && data.length === 0))) {
      } else {
        logger.warn(`${logPrefix} [加载元数据] 加载的元数据为空或格式错误，尝试执行扫描回退...`);
      }
      try {
        finalData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(logger);
      } catch (scanError) {
        logger.error(`${logPrefix} [加载元数据] 扫描回退过程中发生错误:`, scanError);
        finalData = [];
      }
    } else {
      finalData = data;
    }

    if (Array.isArray(finalData)) {
      const originalCount = finalData.length;

      const validData = finalData.filter(item => {
        if (item && item.attributes && item.attributes.isBan === true) {
          // logger.info(`${logPrefix} [加载元数据] 远程封禁图片: ${item.path}`); 
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
          logger.warn(`${logPrefix} [加载元数据] 过滤掉格式错误的图片路径: ${item.path}`);
        }
        return pathIsValid;
      }).map(item => ({ ...item, path: item.path.replace(/\\/g, "/") }));

      const validCount = validData.length;
      const filteredCount = originalCount - validCount;
      if (filteredCount > 0) {
        logger.info(`${logPrefix} [加载元数据] 共过滤掉 ${filteredCount} 条无效、格式错误或远程封禁的元数据。`);
      }
      return validData;
    } else {
      logger.error(`${logPrefix} [加载元数据] CRITICAL: 最终元数据结果不是一个数组！返回空数组。`);
      return [];
    }
  }

  static async ScanLocalImagesToBuildCache(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const fallbackCache = []; const ReposToScan = [];
    const repoPathsMap = {
      "Miao-Plugin-MBT": { path: MiaoPluginMBT.paths.LocalTuKuPath, num: 1 },
      "Miao-Plugin-MBT-2": { path: MiaoPluginMBT.paths.LocalTuKuPath2, num: 2 },
      "Miao-Plugin-MBT-3": { path: MiaoPluginMBT.paths.LocalTuKuPath3, num: 3 },
    };
    for (const storageBoxName in repoPathsMap) {
      const repoInfo = repoPathsMap[storageBoxName];
      if (repoInfo.path && (await MiaoPluginMBT.IsTuKuDownloaded(repoInfo.num))) ReposToScan.push({ path: repoInfo.path, name: storageBoxName });
    }
    //if (ReposToScan.length === 0) { logger.warn(`${logPrefix} [扫描回退] 没有找到本地图库仓库目录（1-3号），无法扫描。`); return []; }
    //logger.info(`${logPrefix} [扫描回退] 开始扫描本地仓库: ${ReposToScan.map(r => r.name).join(", ")}...`);
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
              } catch (readCharErr) { if (readCharErr.code !== ERROR_CODES.NotFound && readCharErr.code !== ERROR_CODES.Access) logger.warn(`${logPrefix} [扫描回退] 读取角色目录 ${charFolderPath} 失败:`, readCharErr.code); }
            }
          }
        } catch (readGameErr) { if (readGameErr.code !== ERROR_CODES.NotFound && readGameErr.code !== ERROR_CODES.Access) logger.warn(`${logPrefix} [扫描回退] 读取游戏目录 ${gameFolderPath} 失败:`, readGameErr.code); }
      }
    }
    //logger.info(`${logPrefix} [扫描回退] 扫描完成，共找到 ${fallbackCache.length} 个 .webp 图片文件。`);
    return fallbackCache;
  }

  static async LoadUserBans(forceReload = false, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    if (MiaoPluginMBT._userBanSet instanceof Set && MiaoPluginMBT._userBanSet.size > 0 && !forceReload) return true;
    let data = []; let success = false;
    try {
      const content = await fsPromises.readFile(MiaoPluginMBT.paths.banListPath, "utf8");
      data = JSON.parse(content); success = true;
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        // logger.info(`${logPrefix} [加载用户封禁] banlist.json 未找到。`);   //调式日志
        data = []; success = true;
      }
      else { logger.error(`${logPrefix} [加载用户封禁] 读取或解析失败:`, error); data = []; success = false; }
    }
    if (success && Array.isArray(data)) {
      const originalCount = data.length;
      const validBans = data.filter(item => typeof item === 'string' && item.trim() !== "").map(p => p.replace(/\\/g, "/"));
      MiaoPluginMBT._userBanSet = new Set(validBans);
      const validCount = MiaoPluginMBT._userBanSet.size;
      const invalidOrDuplicateCount = originalCount - validCount;
      if (invalidOrDuplicateCount > 0) logger.warn(`${logPrefix} [加载用户封禁] 忽略 ${invalidOrDuplicateCount} 条无效/重复。`);
      return true;
    } else {
      if (success && !Array.isArray(data)) {
        logger.error(`${logPrefix} [加载用户封禁] banlist.json 文件内容格式错误，不是一个有效的数组！`);
      }
      MiaoPluginMBT._userBanSet = new Set();
      return false;
    }
  }

  static async SaveUserBans(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const banListPath = MiaoPluginMBT.paths.banListPath;
    try {
      const sortedBans = Array.from(MiaoPluginMBT._userBanSet).sort();
      const jsonString = JSON.stringify(sortedBans, null, 2);
      const dirPath = path.dirname(banListPath);
      try { await fsPromises.mkdir(dirPath, { recursive: true }); }
      catch (mkdirError) { logger.error(`${logPrefix} [保存用户封禁] 创建目录 ${dirPath} 失败:`, mkdirError); return false; }
      await fsPromises.writeFile(banListPath, jsonString, "utf8");
      return true;
    } catch (error) { logger.error(`${logPrefix} [保存用户封禁] 写入配置文件 ${banListPath} 或其他操作失败!`, error); return false; }
  }

  static async LoadAliasData(forceReload = false, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
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
          } catch (importErr) { if (importErr.code !== "ERR_MODULE_NOT_FOUND") { logger.error(`${logPrefix} [加载别名] 导入 JS 失败 (${filePath}):`, importErr); overallSuccess = false; } }
        } else if (fileType === "yaml") {
          try {
            const content = await fsPromises.readFile(filePath, "utf8");
            const parsed = yaml.parse(content);
            if (parsed === null || typeof parsed !== 'object') data = {};
            else data = parsed;
          }
          catch (yamlErr) { logger.error(`${logPrefix} [加载别名] 解析 YAML 失败 (${filePath}):`, yamlErr); overallSuccess = false; }
        }
      } catch (err) { if (err.code !== ERROR_CODES.NotFound) { logger.warn(`${logPrefix} [加载别名] 读取 ${fileType} 文件失败: ${filePath}`, err.code); overallSuccess = false; } }
      return data;
    };
    await Promise.all(aliasSources.map(async ({ key, path: filePath, type }) => { const data = await parseFile(filePath, type); loadedAliases[key] = data; Object.assign(combined, data); }));
    MiaoPluginMBT._aliasData = { ...loadedAliases, combined };
    return overallSuccess;
  }

  static async GenerateAndApplyBanList(imageData, logger = global.logger || console) {
    const effectiveBanSet = MiaoPluginMBT.GenerateBanList(imageData, logger);
    await MiaoPluginMBT.ApplyBanList(effectiveBanSet, logger);
  }

  static GenerateBanList(imageData, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const effectiveBans = new Set(MiaoPluginMBT._userBanSet);
    const initialUserBansCount = effectiveBans.size;

    const pflLevel = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
    let pflPurifiedCount = 0;
    if (pflLevel > Purify_Level.NONE && Array.isArray(imageData) && imageData.length > 0) {
      imageData.forEach((d) => { if (MiaoPluginMBT.CheckIfPurifiedByLevel(d, pflLevel)) { const normalizedPath = d.path?.replace(/\\/g, "/"); if (normalizedPath && !effectiveBans.has(normalizedPath)) { effectiveBans.add(normalizedPath); pflPurifiedCount++; } } });
    } else if (pflLevel > Purify_Level.NONE) {
      logger.warn(`${logPrefix} [生成封禁] PFL=${pflLevel} 但元数据无效或为空，无法执行 PFL 净化。`);
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
    const imgData = MiaoPluginMBT._imgDataCache.find(img => img.path === normalizedPath);
    if (imgData) {
      const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
      return MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, level);
    }
    return false;
  }

  static async ApplyBanList(effectiveBanSet = MiaoPluginMBT._activeBanSet, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    if (!(effectiveBanSet instanceof Set) || effectiveBanSet.size === 0) return;
    let deletedCount = 0; const deletePromises = [];
    for (const relativePath of effectiveBanSet) {
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
      if (targetPath) {
        deletePromises.push(fsPromises.unlink(targetPath).then(() => { deletedCount++; }).catch((unlinkErr) => { if (unlinkErr.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [应用封禁] 删除 ${targetPath} 失败:`, unlinkErr.code); }));
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
        const aliasResult = await MiaoPluginMBT.FindRoleAlias(characterNameInRepo);
        const targetCharacterName = aliasResult.exists ? aliasResult.mainName : characterNameInRepo;
        return path.join(targetBaseDir, targetCharacterName, fileName);
      }
    }
    return null;
  }

  static async FindImageAbsolutePath(relativePath) {
    if (!relativePath) return null; const normalizedPath = relativePath.replace(/\\/g, "/");
    const logger = global.logger || console; const logPrefix = Default_Config.logPrefix;
    const imgData = MiaoPluginMBT._imgDataCache.find(img => img.path?.replace(/\\/g, "/") === normalizedPath);
    let preferredRepoPath = null; let preferredRepoNum = 0;
    if (imgData?.storagebox) {
      if (imgData.storagebox === "Miao-Plugin-MBT") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath; preferredRepoNum = 1; }
      else if (imgData.storagebox === "Miao-Plugin-MBT-2") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath2; preferredRepoNum = 2; }
      else if (imgData.storagebox === "Miao-Plugin-MBT-3") { preferredRepoPath = MiaoPluginMBT.paths.LocalTuKuPath3; preferredRepoNum = 3; }
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
    ];
    for (const repo of reposToSearchFallBack) {
      if (!repo.path || repo.path === preferredRepoPath) continue;
      if (await MiaoPluginMBT.IsTuKuDownloaded(repo.num)) {
        const absPath = path.join(repo.path, normalizedPath);
        try { await fsPromises.access(absPath, fs.constants.R_OK); return absPath; }
        catch (err) { if (err.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [查找路径] 访问仓库 ${repo.nameForLog} (${absPath}) 出错:`, err.code); }
      }
    }
    //logger.warn(`${logPrefix} [查找路径] 在所有已配置的常规仓库中均未找到: ${normalizedPath}`);
    return null;
  }

  static async FindRoleAlias(inputName, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix; const cleanInput = inputName?.trim();
    if (!cleanInput) return { mainName: null, exists: false };
    if (!MiaoPluginMBT._aliasData) {
      await MiaoPluginMBT.LoadAliasData(false, logger);
      if (!MiaoPluginMBT._aliasData?.combined) { logger.error(`${logPrefix} [查找别名] 无法加载。`); const dirExistsFallback = await MiaoPluginMBT.CheckRoleDirExists(cleanInput); return { mainName: cleanInput, exists: dirExistsFallback }; }
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
    const logPrefix = Default_Config.logPrefix;
    await fsPromises.mkdir(MiaoPluginMBT.paths.commonResPath, { recursive: true });
    let s = 0, f = 0;
    for (const { sourceSubPath, destFileName, copyIfExists = true, isDir = false } of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath);
      const dest = path.join(MiaoPluginMBT.paths.commonResPath, destFileName);
      try {
        await fsPromises.access(source);
        if (!copyIfExists) { try { await fsPromises.access(dest); continue; } catch (destAccessError) { if (destAccessError.code !== ERROR_CODES.NotFound) throw destAccessError; } }
        await fsPromises.mkdir(path.dirname(dest), { recursive: true });
        if (isDir) await copyFolderRecursive(source, dest, {}, logger); else await fsPromises.copyFile(source, dest); s++;
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound) { }
        else { logger.error(`${logPrefix} [同步公共] ${sourceSubPath} 失败:`, error); f++; }
      }
    }
  }

  static async SyncSpecificFiles(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix; let s = 0, f = 0;
    for (const { sourceSubPath, destDir, destFileName } of MiaoPluginMBT.paths.filesToSyncSpecific) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath);
      const dest = path.join(destDir, destFileName);
      try { await fsPromises.access(source); await fsPromises.mkdir(destDir, { recursive: true }); await fsPromises.copyFile(source, dest); s++; }
      catch (error) {
        if (error.code === ERROR_CODES.NotFound) { }
        else { logger.error(`${logPrefix} [同步特定] ${sourceSubPath} -> ${dest} 失败:`, error); f++; }
      }
    }
  }

  static async SyncCharacterFolders(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const targetPluginDirs = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
    await Promise.all(targetPluginDirs.map((dir) => MiaoPluginMBT.CleanTargetCharacterDirs(dir, logger)));

    const imageDataToSync = MiaoPluginMBT._imgDataCache;
    if (!imageDataToSync || imageDataToSync.length === 0) { logger.warn(`${logPrefix} [同步角色] 元数据为空，无法同步。`); return; }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) logger.warn(`${logPrefix} [同步角色] 生效封禁列表未初始化或类型错误。`);
    let copied = 0, banned = 0, missingSource = 0, noTarget = 0, errorCount = 0; const promises = [];
    for (const imgData of imageDataToSync) {
      const relativePath = imgData.path?.replace(/\\/g, "/"); const storageBox = imgData.storagebox;
      if (!relativePath || !storageBox) { logger.warn(`${logPrefix} [同步角色] 跳过无效元数据项: path=${relativePath}, storagebox=${storageBox}`); noTarget++; continue; }
      if (MiaoPluginMBT._activeBanSet.has(relativePath)) { banned++; continue; }

      let sourceBasePath; let repoNumForCheck;
      if (storageBox === "Miao-Plugin-MBT") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath; repoNumForCheck = 1; }
      else if (storageBox === "Miao-Plugin-MBT-2") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath2; repoNumForCheck = 2; }
      else if (storageBox === "Miao-Plugin-MBT-3") { sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath3; repoNumForCheck = 3; }
      else { logger.warn(`${logPrefix} [同步角色] 未知的 storagebox: ${storageBox} for path: ${relativePath}`); noTarget++; continue; }

      if (!sourceBasePath || !(await MiaoPluginMBT.IsTuKuDownloaded(repoNumForCheck))) {
        logger.warn(`${logPrefix} [同步角色] 仓库 ${storageBox} (编号 ${repoNumForCheck}) 未定义路径或未下载，跳过图片 ${relativePath}`); missingSource++; continue;
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
            catch (copyErr) { errorCount++; if (copyErr.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [同步角色] 复制失败: ${path.basename(sourcePath)} -> ${targetPath}`, copyErr.code); }
          } catch (sourceAccessErr) {
            if (sourceAccessErr.code === ERROR_CODES.NotFound) missingSource++;
            else { errorCount++; logger.warn(`${logPrefix} [同步角色] 访问源文件失败: ${sourcePath}`, sourceAccessErr.code); }
          }
        })());
      } else noTarget++;
    }
    await Promise.all(promises);
  }

  static async CleanTargetCharacterDirs(targetPluginDir, logger = global.logger || console) {
    if (!targetPluginDir) return; const logPrefix = Default_Config.logPrefix;
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
              catch (unlinkErr) { if (unlinkErr.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [清理目标] 删除文件 ${filePath} 失败:`, unlinkErr.code); }
            }
          } catch (readSubErr) { if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readSubErr.code)) logger.warn(`${logPrefix} [清理目标] 读取角色子目录 ${characterPath} 失败:`, readSubErr.code); }
        } else if (entry.isFile() && entry.name.toLowerCase().includes("gu") && entry.name.toLowerCase().endsWith(".webp")) {
          const rootFilePath = entryPath;
          try { await fsPromises.unlink(rootFilePath); cleanedCount++; }
          catch (delErr) { if (delErr.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [清理目标] 删除根目录文件 ${rootFilePath} 失败:`, delErr.code); }
        }
      }
    } catch (readBaseErr) {
      if (readBaseErr.code !== ERROR_CODES.NotFound && readBaseErr.code !== ERROR_CODES.Access) logger.error(`${logPrefix} [清理目标] 读取目标插件目录 ${targetPluginDir} 失败:`, readBaseErr);
    }
  }

  static async deployPM18Files(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const sourceRepoPath = MiaoPluginMBT.paths.LocalTuKuPath4;
    const tempCachePath = path.join(MiaoPluginMBT.paths.commonResPath, "TempPM18");
    let copiedCount = 0, decryptedCount = 0, placedCount = 0, errorCount = 0;
    try {
      if (!(await MiaoPluginMBT.IsTuKuDownloaded(4))) { logger.error(`${logPrefix} [PM18部署]失败：未找到四号仓库。`); return; }
      await safeDelete(tempCachePath); await fsPromises.mkdir(tempCachePath, { recursive: true });
      const findAndCopyMbt = async (currentSourceDir, currentTempDir) => {
        try {
          const entries = await fsPromises.readdir(currentSourceDir, { withFileTypes: true });
          for (const entry of entries) {
            const sourcePath = path.join(currentSourceDir, entry.name); const tempPath = path.join(currentTempDir, entry.name);
            if (entry.isDirectory()) { await fsPromises.mkdir(tempPath, { recursive: true }); await findAndCopyMbt(sourcePath, tempPath); }
            else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mbt")) {
              try { await fsPromises.copyFile(sourcePath, tempPath); copiedCount++; }
              catch (copyErr) { logger.warn(`${logPrefix} [PM18部署]复制文件失败: ${sourcePath} -> ${tempPath}`, copyErr.code); errorCount++; }
            }
          }
        } catch (readErr) { errorCount++; }
      };
      await findAndCopyMbt(sourceRepoPath, tempCachePath);
      if (copiedCount === 0) { await safeDelete(tempCachePath); return; }
      const password = Buffer.from("1004031540"); const salt = Buffer.from("guguniumbtpm18salt");
      const keyLength = 32; const iterations = 100000; const digest = "sha256";
      const key = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
      const unpad = (buffer) => { const padding = buffer[buffer.length - 1]; if (padding < 1 || padding > 16) return buffer; for (let i = buffer.length - padding; i < buffer.length; i++) { if (buffer[i] !== padding) return buffer; } return buffer.slice(0, buffer.length - padding); };

      logger.info(`${logPrefix} [PM18部署]开始解密并释放文件...`);
      const decryptAndPlace = async (currentTempDir) => {
        try {
          const entries = await fsPromises.readdir(currentTempDir, { withFileTypes: true });
          for (const entry of entries) {
            const tempPath = path.join(currentTempDir, entry.name);
            if (entry.isDirectory()) await decryptAndPlace(tempPath);
            else if (entry.isFile() && entry.name.toLowerCase().endsWith(".mbt")) {
              const relativePath = path.relative(tempCachePath, tempPath); const targetFileName = entry.name.replace(/\.mbt$/i, ".webp");
              const targetRelativePath = path.join(path.dirname(relativePath), targetFileName);
              try {
                const encryptedDataWithIv = await fsPromises.readFile(tempPath); if (encryptedDataWithIv.length <= 16) throw new Error("加密文件过短");
                const iv = encryptedDataWithIv.slice(0, 16); const ciphertext = encryptedDataWithIv.slice(16);
                const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
                let decryptedData = Buffer.concat([decipher.update(ciphertext), decipher.final()]); decryptedData = unpad(decryptedData);
                const finalTargetPath = await MiaoPluginMBT.DetermineTargetPath(targetRelativePath);
                if (!finalTargetPath) { logger.warn(`${logPrefix} [PM18部署]无法确定目标路径: ${targetRelativePath}`); errorCount++; continue; }
                await fsPromises.mkdir(path.dirname(finalTargetPath), { recursive: true });
                await fsPromises.writeFile(finalTargetPath, decryptedData); decryptedCount++; placedCount++;
              } catch (decryptError) { logger.error(`${logPrefix} [PM18部署]解密或写入文件失败: ${tempPath}`, decryptError); errorCount++; }
            }
          }
        } catch (readErr) { logger.warn(`${logPrefix} [PM18部署]读取临时目录失败: ${currentTempDir}`, readErr.code); errorCount++; }
      };
      await decryptAndPlace(tempCachePath);
      logger.info(`${logPrefix} [PM18部署]解密完成，解密 ${decryptedCount} 个，释放 ${placedCount} 个。`);
    } catch (error) { logger.error(`${logPrefix} [PM18部署] 顶层执行出错:`, error); errorCount++; }
    finally {
      await safeDelete(tempCachePath);
    }
  }

  static async cleanPM18Files(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const targetPluginDirs = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
    let cleanedCount = 0; let cleanErrorCount = 0;
    try {
      const cleanPromises = targetPluginDirs.map(async (targetDir) => {
        try {
          await fsPromises.access(targetDir);
          const findAndDeleteGuX = async (currentDir) => {
            try {
              const entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
              for (const entry of entries) {
                const entryPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) await findAndDeleteGuX(entryPath);
                else if (entry.isFile() && entry.name.toLowerCase().includes("gux") && entry.name.toLowerCase().endsWith(".webp")) {
                  try { await fsPromises.unlink(entryPath); cleanedCount++; }
                  catch (unlinkErr) { if (unlinkErr.code !== ERROR_CODES.NotFound) { cleanErrorCount++; } }
                }
              }
            } catch (readErr) { if (readErr.code !== ERROR_CODES.NotFound && readErr.code !== ERROR_CODES.Access) { cleanErrorCount++; } }
          };
          await findAndDeleteGuX(targetDir);
        } catch (accessErr) { if (accessErr.code !== ERROR_CODES.NotFound) { cleanErrorCount++; } }
      });
      await Promise.all(cleanPromises);
    } catch (error) { logger.error(`${logPrefix} [PM18清理] 顶层执行出错:`, error); cleanErrorCount++; }
    finally { logger.info(`${logPrefix} [PM18清理] 执行结束。错误数: ${cleanErrorCount}`); }
  }

  static async RestoreFileFromSource(relativePath, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const sourcePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
    if (!sourcePath) return false;
    const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
    if (!targetPath) return false;
    try {
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
      await fsPromises.copyFile(sourcePath, targetPath);
      return true;
    } catch (copyError) { logger.error(`${logPrefix} [恢复文件] ${relativePath} 失败:`, copyError); return false; }
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
    const messagesToSend = [];
    if (Report.summary) messagesToSend.push(Report.summary);
    if (Report.suggestions) messagesToSend.push(`【🤔 可能原因与建议】\n${Report.suggestions}`);
    if (Report.contextInfo) messagesToSend.push(`【ℹ️ 上下文信息】\n${Report.contextInfo}`);
    if (Report.stack) { const maxStackLength = 1000; const stackInfo = Report.stack.length > maxStackLength ? Report.stack.substring(0, maxStackLength) + "... (后面省略了)" : Report.stack; messagesToSend.push(`【🛠️ 技术细节 - 调用栈(部分)】\n${stackInfo}`); }

    try {
      const shortMessage = `${logPrefix} 执行 ${operationName} 操作时遇到点问题！(错误码: ${error?.code || "未知"})`;
      await e.reply(shortMessage, true);
      if (messagesToSend.length > 0 && common?.makeForwardMsg) {
        try {
          const forwardMsg = await common.makeForwardMsg(e, messagesToSend, `${logPrefix} ${operationName} 失败日志`);
          if (forwardMsg) await e.reply(forwardMsg); else throw new Error("makeForwardMsg returned nullish");
        } catch (forwardError) {
          logger.warn(`${logPrefix} [错误报告] 创建/发送合并消息失败 (${forwardError.message})，尝试发送文本...`);
          if (Report.summary) await e.reply(Report.summary.substring(0, 300) + (Report.summary.length > 300 ? "..." : ""));
          if (Report.suggestions) await e.reply(`【🤔 建议】\n${Report.suggestions.substring(0, 300) + (Report.suggestions.length > 300 ? "..." : "")}`);
          await e.reply("(详细信息请康康控制台日志哦)");
        }
      } else {
        logger.warn(`${logPrefix} [错误报告] 无法创建合并消息 (common.makeForwardMsg 不可用或消息为空)。`);
        await e.reply("(详细错误信息请康康控制台日志哈)");
      }
    } catch (reportError) {
      logger.error(`${logPrefix} [错误报告] CRITICAL: 报告错误时也发生错误:`, reportError);
      logger.error(`${logPrefix} === 原始错误 (${operationName}) ===`, error);
    }
  }

  static FormatError(operationName, error, context = "", logPrefixForMsg = Default_Config.logPrefix) {
    const Report = { summary: `${logPrefixForMsg} 操作 [${operationName}] 失败了！`, contextInfo: context || "（无额外上下文信息）", suggestions: "", stack: error?.stack || "（调用栈信息丢失，大概是飞升了）", };
    if (error?.message) Report.summary += `\n错误信息: ${error.message}`;
    if (error?.code) Report.summary += ` (Code: ${error.code})`;
    if (error?.signal) Report.summary += ` (Signal: ${error.signal})`;
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
      [ERROR_CODES.Timeout]: "操作超时了，等太久了...",
      "json.parse": "数据问题: JSON 文件格式不对，检查下 `imagedata.json` 或 `banlist.json`。",
      "yaml.parse": "配置问题: YAML 文件格式不对，检查下 `GalleryConfig.yaml`。",
    };
    let matchedSuggestion = null;
    if (error instanceof ReferenceError && error.message?.includes("is not defined")) matchedSuggestion = "代码出错了: 引用了不存在的变量或函数。如果没改过代码，可能是插件Bug，快去反馈！";
    else { for (const keyword in suggestionsMap) { const keywordToTest = ERROR_CODES[keyword] || keyword; const escapedKeyword = String(keywordToTest).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); const regex = new RegExp(escapedKeyword, "i"); if (regex.test(errorStringForSuggestions)) { matchedSuggestion = suggestionsMap[keyword]; break; } } }
    let finalSuggestionsArray = [];
    if (matchedSuggestion) finalSuggestionsArray.push(`- ${matchedSuggestion}`);
    else finalSuggestionsArray.push("- 暂时没有针对此错误的特定建议，请尝试以下通用排查方法。");
    finalSuggestionsArray.push("- 请检查您的网络连接是否通畅。", "- 请检查 Yunzai-Bot 目录及插件相关目录的文件/文件夹权限。", "- 请仔细查看控制台输出的详细错误日志，特别是本条错误上下的内容。", "- 尝试重启 Yunzai-Bot 程序。");
    if (operationName.toLowerCase().includes("下载") || operationName.toLowerCase().includes("更新")) { finalSuggestionsArray.push("- 确保您的设备上已正确安装 Git，并且 Git 的路径已添加到系统环境变量中。", "- 尝试执行 `#咕咕牛测速` 命令检查网络节点状况。"); }
    if (!operationName.toLowerCase().includes("重置")) { finalSuggestionsArray.push("- 如果问题持续存在，作为最终手段，您可以尝试执行 `#重置咕咕牛` 命令，然后重新 `#下载咕咕牛` (请注意：这将清除所有咕咕牛图库相关数据和配置)。"); }
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
    const logPrefix = Default_Config.logPrefix;
    if (!RepoPath) return null;
    const gitDir = path.join(RepoPath, ".git");
    try { await fsPromises.access(gitDir); const stats = await fsPromises.stat(gitDir); if (!stats.isDirectory()) throw new Error(".git is not a directory"); }
    catch (err) { return null; }
    const format = Default_Config.gitLogFormat; const dateformat = Default_Config.gitLogDateFormat;
    const args = ["log", `-n ${Math.max(1, count)}`, `--date=${dateformat}`, `--pretty=format:${format}`];
    const gitOptions = { cwd: RepoPath };
    try { const result = await ExecuteCommand("git", args, gitOptions, 5000); return result.stdout.trim(); }
    catch (error) { logger.warn(`${logPrefix} [获取日志] Git log 失败 (${RepoPath})`); return null; }
  }

  static async DownloadRepoWithFallback(repoNum, repoUrl, branch, finalLocalPath, e, loggerInstance = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const logger = loggerInstance;
    const baseRawUrl = RAW_URL_Repo1;

    let repoTypeName;
    switch (repoNum) {
      case 1: repoTypeName = "核心仓库"; break;
      case 2: repoTypeName = "二号仓库"; break;
      case 3: repoTypeName = "三号仓库"; break;
      case 4: repoTypeName = "四号仓库"; break;
      default: repoTypeName = `附属仓库(${repoNum}号)`;
    }

    const tempDownloadsBaseDir = path.join(MiaoPluginMBT.paths.tempPath, "guguniu-downloads");
    let lastError = null;
    let sourcesToTry = [];
    let allTestResults = [];
    const overallTestStartTime = Date.now();

    try {
      allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, logger);
    } catch (testError) {
      logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 网络测速阶段失败:`, testError);
      if (e) {
        await MiaoPluginMBT.ReportError(e, `网络测速失败`, testError, `无法为 ${repoTypeName} 开始下载`, logger);
      }
      return { success: false, nodeName: "网络测速失败", error: testError };
    }

    sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, logger);

    if (repoNum === 1 && e) {
      let tempHtmlFilePath_InitialSpeedtest = "";
      const uniqueId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      try {
        if (allTestResults.length > 0) {
          let renderData_Initial = {};
          let htmlContent_Initial = "";
          let canGenerateInitialReport = true;
          try {
            const bestSourceForReport_Initial = sourcesToTry[0] || null;
            const duration_Initial = ((Date.now() - overallTestStartTime) / 1000).toFixed(1);
            const processSpeeds = (speeds) => speeds.map((s) => ({ ...s, statusText: s.testUrlPrefix === null ? "na" : Number.isFinite(s.speed) && s.speed >= 0 ? "ok" : "timeout" })).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || (a.speed === Infinity || a.statusText === "na" ? 1 : b.speed === Infinity || b.statusText === "na" ? -1 : a.speed - b.speed));
            const processedSpeedsResult_Initial = processSpeeds(allTestResults);
            const scaleStyleValue_Initial = MiaoPluginMBT.getScaleStyleValue();
            let best1Display_Initial = "无可用源";
            if (bestSourceForReport_Initial) {
              let speedInfo = "N/A";
              if (bestSourceForReport_Initial.testUrlPrefix !== null) speedInfo = Number.isFinite(bestSourceForReport_Initial.speed) && bestSourceForReport_Initial.speed >= 0 ? `${bestSourceForReport_Initial.speed}ms` : "超时";
              best1Display_Initial = `${bestSourceForReport_Initial.name}(${speedInfo})`;
            }
            renderData_Initial = { speeds1: processedSpeedsResult_Initial, best1Display: best1Display_Initial, duration: duration_Initial, scaleStyleValue: scaleStyleValue_Initial };
            htmlContent_Initial = template.render(SPEEDTEST_HTML_TEMPLATE_LOCAL, renderData_Initial);
            if (typeof htmlContent_Initial !== "string" || htmlContent_Initial.length === 0) throw new Error("初始测速报告 template.render 返回了无效内容!");
            const initialSpeedtestHtmlDir = path.join(MiaoPluginMBT.paths.tempPath, `render-initialSpeedtest-${uniqueId}`);
            await fsPromises.mkdir(initialSpeedtestHtmlDir, { recursive: true });
            tempHtmlFilePath_InitialSpeedtest = path.join(initialSpeedtestHtmlDir, `template-${uniqueId}.html`);
            await fsPromises.writeFile(tempHtmlFilePath_InitialSpeedtest, htmlContent_Initial, "utf8");
          } catch (prepOrRenderError) {
            //logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 准备或渲染初始测速报告失败:`, prepOrRenderError);
            //if (e) await e.reply(`${logPrefix} 准备或渲染初始测速报告出错，将继续下载...`, true).catch(() => {});
            canGenerateInitialReport = false;
          }
          if (canGenerateInitialReport) {
            try {
              const imageBuffer = await renderPageToImage("initial-dl-speedtest", { tplFile: tempHtmlFilePath_InitialSpeedtest, data: {}, imgType: "png", pageGotoParams: { waitUntil: "networkidle0" }, pageBoundingRect: { selector: "body", padding: 0 }, width: 540, }, logger);
              if (imageBuffer) { if (e) { await e.reply(imageBuffer).catch(() => { }); await common.sleep(500); } }
              else { if (e) await e.reply(`${logPrefix} 生成初始测速报告图片为空，继续下载...`, true).catch(() => { }); }
            } catch (screenshotError) { if (e) await e.reply(`${logPrefix} 生成初始测速报告截图出错，继续下载...`, true).catch(() => { }); }
          }
        } else { if (e) await e.reply(`${logPrefix} 初始测速未找到可用节点，将直接尝试下载...`, true).catch(() => { }); }
      } catch (outerInitialSpeedTestError) {
        logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 执行初始测速或排序源时出错(顶层):`, outerInitialSpeedTestError);
        if (e) await e.reply(`${logPrefix} 执行初始测速时发生错误，仍将尝试下载...`, true).catch(() => { });
        if (!sourcesToTry || sourcesToTry.length === 0) {
          if (allTestResults && allTestResults.length > 0) sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, logger);
          else {
            try {
              const fallbackTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, logger);
              sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(fallbackTestResults, true, logger);
            } catch (finalTestError) {
              logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 后备测速也失败:`, finalTestError);
              sourcesToTry = Default_Config.proxies.filter((p) => p.name === "GitHub" || p.cloneUrlPrefix);
            }
          }
        }
      }
    }

    const tempWriteTestPath = path.join(tempDownloadsBaseDir, `write_test_${Date.now()}.tmp`); // 使用独立时间戳
    try {
      await fsPromises.mkdir(tempDownloadsBaseDir, { recursive: true });
      await fsPromises.writeFile(tempWriteTestPath, "test");
      await fsPromises.unlink(tempWriteTestPath);
    } catch (writeError) {
      logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 无法写入临时目录 ${tempDownloadsBaseDir}. 请检查权限。`, writeError);
      if (e) await MiaoPluginMBT.ReportError(e, `下载${repoTypeName}`, new Error("无法写入临时目录"), `路径: ${tempDownloadsBaseDir}`, logger);
      return { success: false, nodeName: "环境检查失败", error: new Error("无法写入临时目录") };
    }

    if (!sourcesToTry || sourcesToTry.length === 0) {
      logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 在下载决策阶段无可用下载源！`);
      const error = new Error("无可用下载源 (所有测速均失败或无结果)");
      if (e && repoNum === 1) await MiaoPluginMBT.ReportError(e, `下载${repoTypeName}`, error, "所有测速尝试均未找到可用节点", logger);
      else if (repoNum !== 1) logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 无可用下载源，下载失败。`);
      return { success: false, nodeName: "无可用源", error };
    }

    //logger.info(`${logPrefix} [下载流程 ${repoTypeName}] 下载决策可用源: ${sourcesToTry.map(s => s.name).join(', ')}`);

    const githubSourceFromConfig = Default_Config.proxies.find((p) => p.name === "GitHub");
    const githubTestResultForDecision = allTestResults.find((r) => r.name === "GitHub");
    if (repoNum === 1 && githubSourceFromConfig && githubTestResultForDecision && githubTestResultForDecision.speed !== Infinity && githubTestResultForDecision.speed <= 300) {
      const githubIndexInSources = sourcesToTry.findIndex((s) => s.name === "GitHub");
      if (githubIndexInSources > 0) {
        const [githubItem] = sourcesToTry.splice(githubIndexInSources, 1); sourcesToTry.unshift(githubItem);
      } else if (githubIndexInSources === -1 && sourcesToTry.every((s) => s.name !== "GitHub")) {
        sourcesToTry.unshift({ ...githubSourceFromConfig, speed: githubTestResultForDecision.speed });
      }
    }

    let isFirstActualDownloadAttempt = true;

    for (const source of sourcesToTry) {
      const nodeName = source.name === "GitHub" ? "GitHub(直连)" : `${source.name}(代理)`;
      if (source.name === "GitHub" && repoNum === 1) {
        const ghResult = allTestResults.find((r) => r.name === "GitHub");
        if (ghResult && (ghResult.speed === Infinity || ghResult.speed > 300)) {
          continue;
        }
      }

      let progressStatus = { reported10: false, reported90: false };
      if (!isFirstActualDownloadAttempt && repoNum === 1) {
        // if(e) e.reply(`『咕咕牛』${repoTypeName} 尝试节点: ${nodeName}...`, true).catch(() => {});
        // else logger.info(`${logPrefix} [下载流程 ${repoTypeName}] 尝试节点: ${nodeName}... (无e对象)`);
      }
      isFirstActualDownloadAttempt = false;

      let maxAttempts;
      switch (source.name) { case "Moeyy": maxAttempts = 3; break; case "Ghfast": maxAttempts = 2; break; default: maxAttempts = 1; }

      let currentIntermediateDir = null;  //每次 source 循环开始时初始化 
      let intermediatePathForAttempt = null;  //每次 source 循环开始时初始化
 
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const attemptTimestamp = Date.now();
        const attemptOuterRandomSuffix = crypto.randomBytes(4).toString("hex");
        const uniqueTempCloneDirName = `GuTempClone-${repoNum}-${attemptTimestamp}-${attemptOuterRandomSuffix}`;
        const tempRepoPath = path.join(tempDownloadsBaseDir, uniqueTempCloneDirName);

        progressStatus = { reported10: false, reported90: false };

        try {
          if (attempt > 1) {
            const delay = 1000 * attempt * 1.5;
            if (e && repoNum === 1) {
              //e.reply(`『咕咕牛』${repoTypeName}(${nodeName}) 第 ${attempt - 1} 次下载失败，${delay / 1000}s 后重试 (总尝试 ${maxAttempts})...`, true).catch(() => {});
            }
            await common.sleep(delay);
          }

          await fsPromises.mkdir(path.dirname(tempRepoPath), { recursive: true }); // 确保父目录存在

          let actualCloneUrl = "";
          const repoPathMatch = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/i); let userAndRepoPath = "";
          if (repoPathMatch && repoPathMatch[1]) userAndRepoPath = repoPathMatch[1].replace(/\.git$/, "");
          else throw new Error(`(${nodeName}) 无法从原始repoUrl (${repoUrl}) 提取仓库路径。`);
          if (source.name === "GitHub") actualCloneUrl = repoUrl;
          else if (source.cloneUrlPrefix) {
            const cleanCloneUrlPrefix = source.cloneUrlPrefix.replace(/\/$/, "");
            if (source.name === "GitClone") actualCloneUrl = `${cleanCloneUrlPrefix}/${repoUrl.replace(/^https?:\/\//, "")}`;
            else if (source.name === "Mirror" || source.cloneUrlPrefix.includes("gitmirror.com")) actualCloneUrl = `${cleanCloneUrlPrefix}/${userAndRepoPath}`;
            else actualCloneUrl = `${cleanCloneUrlPrefix}/${repoUrl}`;
          } else throw new Error(`(${nodeName}) 源配置缺少 cloneUrlPrefix。`);

          const cloneArgs = ["clone", "--verbose", `--depth=${Default_Config.gitCloneDepth}`, "--progress", "-b", branch, actualCloneUrl, tempRepoPath];
          const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };

          //logger.info(`${logPrefix} [下载流程 ${repoTypeName}] (${nodeName}) 第 ${attempt}/${maxAttempts} 次尝试: git clone 到 ${tempRepoPath}`);

          await MiaoPluginMBT.gitMutex.runExclusive(async () => {
            await ExecuteCommand("git", cloneArgs, gitOptions, Default_Config.gitCloneTimeout, (stderrChunk) => {
              if (e && repoNum === 1) {
                const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/);
                if (match?.[1]) {
                  const percent = parseInt(match[1], 10);
                  if (percent >= 10 && !progressStatus.reported10) { progressStatus.reported10 = true; e.reply(`${repoTypeName} ${nodeName} 下载:10%`, true).catch(() => { }); }
                  if (percent >= 90 && !progressStatus.reported90) { progressStatus.reported90 = true; e.reply(`${repoTypeName} ${nodeName} 下载:90%`, true).catch(() => { }); }
                }
              }
            });
          });

          // logger.info(`${logPrefix} [下载流程 ${repoTypeName}] (${nodeName}) 克隆到 ${tempRepoPath} 成功，开始部署...`);

          const intermediateDirName = `intermediate-${repoNum}-${attemptTimestamp}-${attemptOuterRandomSuffix}-${source.name.replace(/[^a-zA-Z0-9]/g, "")}-${attempt}`;
          currentIntermediateDir = path.join(tempDownloadsBaseDir, intermediateDirName);
          await safeDelete(currentIntermediateDir);
          await fsPromises.mkdir(currentIntermediateDir, { recursive: true });
          intermediatePathForAttempt = path.join(currentIntermediateDir, path.basename(finalLocalPath));

          try { await fsPromises.rename(tempRepoPath, intermediatePathForAttempt); }
          catch (moveError) {
            if (moveError.code === "EPERM" || moveError.code === "EXDEV" || moveError.code === "EBUSY") {
              await copyFolderRecursive(tempRepoPath, intermediatePathForAttempt, {}, logger);
              await safeDelete(tempRepoPath);
            } else throw moveError;
          }

          await safeDelete(finalLocalPath);
          await fsPromises.mkdir(path.dirname(finalLocalPath), { recursive: true });

          try { await fsPromises.rename(intermediatePathForAttempt, finalLocalPath); }
          catch (finalMoveError) {
            if (finalMoveError.code === "EPERM" || finalMoveError.code === "EXDEV" || finalMoveError.code === "EBUSY") {
              //logger.warn(`${logPrefix} [下载部署 ${repoTypeName}] 首次移动到最终路径失败 (${finalMoveError.code})，尝试延时后复制...`);
              await common.sleep(1500);
              try {
                await copyFolderRecursive(intermediatePathForAttempt, finalLocalPath, {}, logger);
                await safeDelete(intermediatePathForAttempt);
                //logger.info(`${logPrefix} [下载部署 ${repoTypeName}] 通过复制方式成功部署到最终路径。`);
              } catch (copyFallbackError) {
                //logger.error(`${logPrefix} [下载部署 ${repoTypeName}] 复制回退也失败！`, copyFallbackError);
                throw copyFallbackError;
              }
            } else throw finalMoveError;
          }

          await safeDelete(currentIntermediateDir);
          currentIntermediateDir = null;
          await safeDelete(tempRepoPath);

          // logger.info(`${logPrefix} [下载流程 ${repoTypeName}] (${nodeName}) 成功部署到 ${finalLocalPath}`);
          const gitLog = await MiaoPluginMBT.GetTuKuLog(1, finalLocalPath, logger);
          return { success: true, nodeName, error: null, gitLog };
        } catch (error) {
          lastError = error;
          //logger.warn(`${logPrefix} [下载流程 ${repoTypeName}] (${nodeName}) 第 ${attempt}/${maxAttempts} 次尝试失败: ${error.message}`);
          await safeDelete(tempRepoPath);
          if (currentIntermediateDir) { await safeDelete(currentIntermediateDir); currentIntermediateDir = null; }

          const stderrText = (error.stderr || "").toLowerCase();
          if (stderrText.includes("repository not found") || stderrText.includes("authentication failed") || (error.code === 128 && stderrText.includes("access rights"))) {
            logger.error(`${logPrefix} [下载流程 ${repoTypeName}] (${nodeName}) 遇到不可恢复错误，不再对此源重试。`);
            break;
          }
        }
      }
      if (currentIntermediateDir) { await safeDelete(currentIntermediateDir); currentIntermediateDir = null; }
    }

    logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 所有下载源及重试均失败。`);
    const finalErrorToReport = lastError || new Error("所有下载尝试均失败，无具体错误信息");
    if (e && repoNum === 1) {
      await MiaoPluginMBT.ReportError(e, `下载${repoTypeName}`, finalErrorToReport, "已尝试所有可用下载源及其重试次数。", logger);
    } else if (repoNum !== 1 && (!finalErrorToReport || typeof finalErrorToReport.success === "undefined" || !finalErrorToReport.success)) {
      const errorDetail = finalErrorToReport?.error || finalErrorToReport;
      logger.error(`${logPrefix} [下载流程 ${repoTypeName}] 最终失败: Node: ${finalErrorToReport?.nodeName || 'N/A'}`, errorDetail);
    }
    return { success: false, nodeName: "所有源失败", error: finalErrorToReport };
  }

  static calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1.0;

    const s1 = String(str1);
    const s2 = String(str2);
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 || len2 === 0) return 0;

    const levenshteinScore = (() => {
      const d = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
      for (let i = 0; i <= len1; i += 1) d[0][i] = i;
      for (let j = 0; j <= len2; j += 1) d[j][0] = j;
      for (let j = 1; j <= len2; j += 1) {
        for (let i = 1; i <= len1; i += 1) {
          const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
          d[j][i] = Math.min(d[j - 1][i] + 1, d[j][i - 1] + 1, d[j - 1][i - 1] + cost);
        }
      }
      const distance = d[len2][len1];
      return 1.0 - (distance / Math.max(len1, len2));
    })();

    const lcsRatio = (() => {
      const dp = Array(len1 + 1).fill(0).map(() => Array(len2 + 1).fill(0));
      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          if (s1[i - 1] === s2[j - 1]) {
            dp[i][j] = dp[i - 1][j - 1] + 1;
          } else {
            dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
          }
        }
      }
      return dp[len1][len2] / Math.max(len1, len2);
    })();

    const jaccardScore = (() => {
      const set1 = new Set(s1.split(''));
      const set2 = new Set(s2.split(''));
      const intersection = new Set([...set1].filter(char => set2.has(char)));
      const union = new Set([...set1, ...set2]);
      return union.size === 0 ? 0 : intersection.size / union.size;
    })();

    let score = (levenshteinScore * 0.5) + (lcsRatio * 0.35) + (jaccardScore * 0.15);

    if (s1.startsWith(s2) || s2.startsWith(s1)) {
      score += 0.1;
    } else if (len1 > 0 && len2 > 0 && s1[0] === s2[0]) {
      score += 0.05;
    }

    const lengthDiff = Math.abs(len1 - len2);
    if (lengthDiff === 1 && Math.max(len1, len2) > 2) {
      score *= 0.9;
    } else if (lengthDiff >= 2 && Math.max(len1, len2) > 3) {
      score *= (1 - (lengthDiff * 0.15));
      score = Math.max(0, score);
    }

    if (len1 < len2 && len1 <= 2 && (len2 - len1) >= 2 && lcsRatio < 0.5) {
      score *= 0.6;
    }

    return Math.max(0, Math.min(1, score));
  }

  static async UpdateSingleRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, logger) {
    const logPrefix = Default_Config.logPrefix;
    let success = false;
    let hasChanges = false;
    let latestLog = null;
    let pullError = null;
    let wasForceReset = false;

    await MiaoPluginMBT.gitMutex.acquire();
    try {
      let oldCommit = "";
      try {
        const revParseResult = await ExecuteCommand("git", ["rev-parse", "HEAD"], { cwd: localPath }, 5000);
        oldCommit = revParseResult.stdout.trim();
      } catch (revParseError) {
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} 获取当前 commit 失败:`, revParseError.message);
      }

      let needsReset = false;
      let pullOutput = "";

      try {
        const pullResult = await ExecuteCommand(
          "git",
          ["pull", "origin", branch, "--ff-only", "--progress"],
          { cwd: localPath },
          Default_Config.gitPullTimeout,
          (stderrChunk) => { },
          undefined
        );
        pullOutput = (pullResult.stdout || "") + (pullResult.stderr || "");
        success = true;
      } catch (err) {
        pullError = err;
        pullOutput = err.stderr || "" || err.stdout || "" || err.message || String(err);
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} 'git pull --ff-only' 失败，错误码: ${err.code}`);
        if (err.code !== 0 && ((err.stderr || "").includes("Not possible to fast-forward") || (err.stderr || "").includes("diverging") || (err.stderr || "").includes("unrelated histories") || (err.stderr || "").includes("commit your changes or stash them") || (err.stderr || "").includes("needs merge") || (err.stderr || "").includes("lock file") || (err.message || "").includes("failed"))) {
          needsReset = true;
        } else {
          success = false;
        }
      }

      if (needsReset && !success) {
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} 正在执行强制重置 (git fetch & git reset --hard)...`);
        try {
          await ExecuteCommand("git", ["fetch", "origin"], { cwd: localPath }, Default_Config.gitPullTimeout);
          await ExecuteCommand("git", ["reset", "--hard", `origin/${branch}`], { cwd: localPath });
          success = true; hasChanges = true; wasForceReset = true; pullError = null;
          logger.info(`${logPrefix} [更新仓库] ${RepoName} 强制重置成功。`);
        } catch (resetError) {
          logger.error(`${logPrefix} [更新仓库] ${RepoName} 强制重置失败！`);
          success = false; pullError = resetError;
        }
      }

      let rawLogString = null;
      if (success) {
        let newCommit = "";
        try {
          const newRevParseResult = await ExecuteCommand("git", ["rev-parse", "HEAD"], { cwd: localPath }, 5000);
          newCommit = newRevParseResult.stdout.trim();
        } catch (newRevParseError) {
          logger.warn(`${logPrefix} [更新仓库] ${RepoName} 获取新 commit 失败:`, newRevParseError.message);
        }
        if (!wasForceReset) hasChanges = oldCommit && newCommit && oldCommit !== newCommit;

        if (hasChanges) logger.info(`${logPrefix} [更新仓库] ${RepoName} 检测到新的提交${wasForceReset ? " (通过强制重置)" : ""}。`);
        else if (pullOutput.includes("Already up to date") && !wasForceReset) logger.info(`${logPrefix} [更新仓库] ${RepoName} 已是最新。`);
        else if (success && !wasForceReset) { logger.info(`${logPrefix} [更新仓库] ${RepoName} pull 操作完成，未检测到新提交或无 "Already up to date" 消息。`); hasChanges = false; }

        rawLogString = await MiaoPluginMBT.GetTuKuLog(3, localPath, logger);
      } else {
        rawLogString = await MiaoPluginMBT.GetTuKuLog(3, localPath, logger);
        if (!rawLogString && pullError) {
          rawLogString = `更新失败 (错误码: ${pullError.code || '未知'}), 无法获取日志。`;
        } else if (!rawLogString) {
          rawLogString = "更新失败且无法获取日志";
        }
      }

      if (rawLogString) {
        const logLines = rawLogString.split('\n').filter(line => line.trim() !== '');
        if (logLines.length > 0) {
          latestLog = await Promise.all(logLines.map(async (line) => {
            const commitData = {
              hash: 'N/A',
              date: 'N/A',
              originalMessageLine: line,
              originalMessage: line,
              displayParts: []
            };

            let currentLineContent = line;

            const dateMatch = currentLineContent.match(/^(\d{2}-\d{2}\s\d{2}:\d{2})\s+/);
            if (dateMatch) {
              commitData.date = dateMatch[1];
              currentLineContent = currentLineContent.substring(dateMatch[0].length);
            }

            const hashMatch = currentLineContent.match(/^\[([a-f0-9]{6,40})\]\s+/);
            if (hashMatch) {
              commitData.hash = hashMatch[1].substring(0, 7);
              currentLineContent = currentLineContent.substring(hashMatch[0].length);
            }

            commitData.originalMessage = currentLineContent;
            let RmessageToProcess = currentLineContent;

            const gamePrefixes = [
              { prefixPattern: /^(原神UP:|原神UP：|原神up:|原神up：)\s*/i, gameType: "gs", processChars: true },
              { prefixPattern: /^(星铁UP:|星铁UP：|星铁up:|星铁up：)\s*/i, gameType: "sr", processChars: true },
            ];

            let currentSearchStartIndex = 0;
            while (RmessageToProcess.length > 0 && currentSearchStartIndex < RmessageToProcess.length) {
              let foundAndProcessedThisIteration = false;
              let textBeforeThisMatch = "";

              for (const entry of gamePrefixes) {
                const remainingSearchText = RmessageToProcess.substring(currentSearchStartIndex);
                const prefixMatchFull = remainingSearchText.match(entry.prefixPattern);

                if (prefixMatchFull && remainingSearchText.startsWith(prefixMatchFull[0])) {
                  textBeforeThisMatch = RmessageToProcess.substring(0, currentSearchStartIndex + prefixMatchFull.index);
                  if (textBeforeThisMatch.trim()) {
                    commitData.displayParts.push({ type: 'text', content: textBeforeThisMatch.trim() });
                  }

                  const matchedPrefixStr = prefixMatchFull[0];
                  let contentAfterPrefix = remainingSearchText.substring(matchedPrefixStr.length).trim();
                  let nextPrefixSearchStartInContent = contentAfterPrefix.length;


                  if (entry.processChars && (entry.gameType === "gs" || entry.gameType === "sr") && contentAfterPrefix) {
                    let charactersProcessedLength = 0;
                    const nameSegments = contentAfterPrefix.split(/[/、，,]/).map(name => name.trim()).filter(Boolean);

                    let tempContentForNextIteration = contentAfterPrefix;

                    for (const rawNameSegment of nameSegments) {
                      if (!rawNameSegment) continue;

                      let segmentPartOfKnownGamePrefix = false;
                      for (const nextEntry of gamePrefixes) {
                        if (rawNameSegment.match(nextEntry.prefixPattern)) {
                          segmentPartOfKnownGamePrefix = true;
                          break;
                        }
                      }
                      if (segmentPartOfKnownGamePrefix && nameSegments.indexOf(rawNameSegment) > 0) {
                        tempContentForNextIteration = contentAfterPrefix.substring(0, contentAfterPrefix.indexOf(rawNameSegment));
                        nextPrefixSearchStartInContent = tempContentForNextIteration.length;
                        break;
                      }


                      let finalNameToDisplay = rawNameSegment;
                      let aliasResult = await MiaoPluginMBT.FindRoleAlias(rawNameSegment, logger);

                      if (!aliasResult.exists && rawNameSegment.length > 1 && MiaoPluginMBT._aliasData && MiaoPluginMBT._aliasData.combined) {
                        const allKnownNames = Object.keys(MiaoPluginMBT._aliasData.combined);
                        let bestMatch = null;
                        let highestScore = -Infinity;

                        for (const knownName of allKnownNames) {
                          const currentScore = MiaoPluginMBT.calculateStringSimilarity(rawNameSegment, knownName);

                          if (currentScore > highestScore) {
                            highestScore = currentScore;
                            bestMatch = knownName;
                          } else if (currentScore === highestScore && bestMatch) {
                            if (Math.abs(knownName.length - rawNameSegment.length) < Math.abs(bestMatch.length - rawNameSegment.length)) {
                              bestMatch = knownName;
                            }
                          }
                        }
                        if (bestMatch && highestScore >= 0.65) {
                          finalNameToDisplay = bestMatch;
                          aliasResult = await MiaoPluginMBT.FindRoleAlias(finalNameToDisplay, logger);
                        }
                      }

                      const standardNameForPath = aliasResult.exists ? aliasResult.mainName : finalNameToDisplay;
                      let imagePath = null;
                      if (entry.gameType === "gs") imagePath = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "..", "character", standardNameForPath, "imgs", "face.webp");
                      else if (entry.gameType === "sr") imagePath = path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "..", "character", standardNameForPath, "imgs", "face.webp");

                      let faceImageUrl = null;
                      if (imagePath) { try { await fsPromises.access(imagePath); faceImageUrl = `file://${imagePath.replace(/\\/g, "/")}`; } catch (err) { } }
                      commitData.displayParts.push({ type: 'character', name: finalNameToDisplay, game: entry.gameType, imageUrl: faceImageUrl });
                      charactersProcessedLength += rawNameSegment.length + (nameSegments.indexOf(rawNameSegment) < nameSegments.length - 1 ? 1 : 0);
                    }
                    RmessageToProcess = contentAfterPrefix.substring(Math.min(charactersProcessedLength, contentAfterPrefix.length));

                  } else {
                    commitData.displayParts.push({ type: 'text', content: matchedPrefixStr + contentAfterPrefix });
                    RmessageToProcess = "";
                  }

                  currentSearchStartIndex = 0;
                  foundAndProcessedThisIteration = true;
                  break;
                }
              }

              if (!foundAndProcessedThisIteration) {
                if (RmessageToProcess.substring(currentSearchStartIndex).trim()) {
                  commitData.displayParts.push({ type: 'text', content: RmessageToProcess.substring(currentSearchStartIndex).trim() });
                }
                break;
              }
            }

            if (commitData.displayParts.length === 0 && currentLineContent) {
              commitData.displayParts.push({ type: 'text', content: currentLineContent });
            }
            return commitData;
          }));
        } else {
          latestLog = [{ originalMessageLine: rawLogString || "无提交记录", originalMessage: rawLogString || "无提交记录", displayParts: [{ type: 'text', content: rawLogString || "无提交记录" }], hash: 'N/A', date: 'N/A' }];
        }
      } else {
        latestLog = [{ originalMessageLine: "无法获取日志", originalMessage: "无法获取日志", displayParts: [{ type: 'text', content: "无法获取日志" }], hash: 'N/A', date: 'N/A' }];
      }

    } catch (outerError) {
      success = false; hasChanges = false;
      pullError = outerError;
      wasForceReset = false;
      latestLog = [{ originalMessageLine: "发生意外错误，无法获取日志", originalMessage: "发生意外错误，无法获取日志", displayParts: [{ type: 'text', content: "发生意外错误，无法获取日志" }], hash: 'N/A', date: 'N/A' }];
    } finally {
      MiaoPluginMBT.gitMutex.release();
    }

    return { success: success, hasChanges: hasChanges, log: latestLog, error: success ? null : pullError, wasForceReset: wasForceReset, };
  }

  static async RunPostDownloadSetup(e, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      await MiaoPluginMBT.SyncSpecificFiles(logger);
      //logger.info(`${logPrefix} [下载后设置] 应用初始封禁规则...`);
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        //logger.info(`${logPrefix} [下载后设置] 配置为默认启用，开始同步角色图片...`);
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else logger.info(`${logPrefix} [下载后设置] 图库配置为默认禁用，跳过角色图片同步。`);
      //logger.info(`${logPrefix} [下载后设置] 所有步骤执行成功。`);
    } catch (error) {
      logger.error(`${logPrefix} [下载后设置] 执行过程中发生错误:`, error);
      if (e) await MiaoPluginMBT.ReportError(e, "安装后设置", error, "", logger);
    }
  }

  static async RunPostUpdateSetup(e, isScheduled = false, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      //logger.info(`${logPrefix} [更新后设置] 同步特定文件...`);
      await MiaoPluginMBT.SyncSpecificFiles(logger);
      //logger.info(`${logPrefix} [更新后设置] 重新应用封禁规则...`);
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        //logger.info(`${logPrefix} [更新后设置] 图库已启用，正在同步更新后的角色图片...`);
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else logger.info(`${logPrefix} [更新后设置] 图库已禁用，跳过角色图片同步。`);

      if (MiaoPluginMBT.MBTConfig.PM18 === true && (await MiaoPluginMBT.IsTuKuDownloaded(4))) {
        logger.info(`${logPrefix} [更新后设置] PM18 功能已开启，开始部署PM18。`);
        setImmediate(async () => { await MiaoPluginMBT.deployPM18Files(logger); });
      } else if (MiaoPluginMBT.MBTConfig.PM18 === true) {
        //logger.warn(`${logPrefix} [更新后设置] PM18 功能已开启，但四号仓库未下载，跳过PM18图片部署。`);
      } else {
        //logger.info(`${logPrefix} [更新后设置] PM18 功能已关闭，跳过部署。`);
      }
    } catch (error) {
      logger.error(`${logPrefix} [更新后设置] 执行过程中发生错误:`, error);
      if (!isScheduled && e) await MiaoPluginMBT.ReportError(e, "更新后设置", error, "", logger);
      else if (isScheduled) { const Report = MiaoPluginMBT.FormatError("更新后设置(定时)", error, "", logPrefix); logger.error(`${logPrefix}--- 定时更新后设置失败 ----\n${Report.summary}\n${Report.suggestions}\n---`); }
    }
  }

  static async TestProxies(baseRawUrl = RAW_URL_Repo1, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix; const testFile = Default_Config.proxyTestFile; const timeoutDuration = Default_Config.proxyTestTimeout;
    const testPromises = Default_Config.proxies.map(async (proxy) => {
      let testUrl = ""; let speed = Infinity;
      if (!proxy || typeof proxy !== 'object') { logger.error(`${logPrefix} [网络测速] 遇到无效的代理配置项: ${proxy}`); return { name: "无效配置", speed: Infinity, priority: 9999, cloneUrlPrefix: null, testUrlPrefix: null }; }
      const proxyName = proxy.name || "未命名";
      if (proxy.testUrlPrefix === null) return { name: proxyName, speed: Infinity, priority: proxy.priority ?? 999, cloneUrlPrefix: proxy.cloneUrlPrefix, testUrlPrefix: null };
      try {
        if (proxy.name === "GitHub") testUrl = baseRawUrl + testFile;
        else if (proxy.testUrlPrefix) { testUrl = proxy.testUrlPrefix.replace(/\/$/, "") + testFile; try { new URL(testUrl); } catch (urlError) { logger.warn(`${logPrefix} [网络测速] 构造的代理URL (${testUrl}) 格式可能不规范:`, urlError.message); } }
        else return { name: proxyName, speed: Infinity, priority: proxy.priority ?? 999, cloneUrlPrefix: proxy.cloneUrlPrefix, testUrlPrefix: proxy.testUrlPrefix };
        const controller = new AbortController(); const timeoutId = setTimeout(() => { controller.abort(); }, timeoutDuration);
        const startTime = Date.now();
        try {
          const response = await fetch(testUrl, { method: "GET", signal: controller.signal, redirect: 'follow' }); clearTimeout(timeoutId); speed = Date.now() - startTime;
          if (!response.ok) { speed = Infinity; }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === "AbortError") { speed = Infinity; }
          else { speed = Infinity; }
        }
      } catch (error) { logger.error(`${logPrefix} [网络测速] 处理节点 ${proxyName} 时发生意外错误:`, error); speed = Infinity; }
      return { name: proxyName, speed: speed, priority: proxy.priority ?? 999, cloneUrlPrefix: proxy.cloneUrlPrefix, testUrlPrefix: proxy.testUrlPrefix };
    });
    const results = await Promise.all(testPromises);
    return results;
  }

  static GetSortedAvailableSources(speeds, includeUntestable = false, logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix; if (!speeds || speeds.length === 0) return [];
    const available = speeds.filter((s) => { const testedOK = s.speed !== Infinity && (s.name === "GitHub" || s.cloneUrlPrefix); const untestableButValid = includeUntestable && s.testUrlPrefix === null && s.cloneUrlPrefix; return testedOK || untestableButValid; });
    if (available.length === 0) { logger.warn(`${logPrefix} [选择源] 没有找到任何可用的下载源！`); return []; }
    available.sort((a, b) => { const prioA = a.priority ?? 999; const prioB = b.priority ?? 999; if (prioA !== prioB) return prioA - prioB; const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed; const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed; return speedA - speedB; });
    return available;
  }

  static async SendMasterMsg(msg, e = null, delay = 0, logger = global.logger || console) {
      const logPrefix = Default_Config.logPrefix;
      let masterQQList = [];

      async function getValidMasterListInternal() {
          let mastersRaw = [];

          if (typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady && typeof Bot.ready !== 'function')) {
              let retries = 0; const maxRetries = 15; 
              while ((typeof Bot === "undefined" || (typeof Bot.isReady === 'boolean' && !Bot.isReady)) && retries < maxRetries) {
                  if (typeof Bot !== "undefined" && ((typeof Bot.isReady === 'boolean' && Bot.isReady) || (Bot.master && Bot.master.length > 0) )) break;
                  await common.sleep(300 + retries * 20); 
                  retries++;
              }
          } else if (typeof Bot !== "undefined" && typeof Bot.ready === 'function') {
              try { await Bot.ready(); } catch (err) { /* 静默 */ }
          }
          
          if (typeof Bot === "undefined") {
              logger.error(`${logPrefix} [通知主人] 全局 Bot 对象在等待后仍未定义，无法获取主人。`);
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
                          
                          if (confMasterQQ && (Array.isArray(confMasterQQ) ? confMasterQQ.length > 0 : confMasterQQ )) {
                              mastersRaw.push(...(Array.isArray(confMasterQQ) ? confMasterQQ : [confMasterQQ]));
                          }
                          if (confMasterField) { 
                              if(Array.isArray(confMasterField)) {
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
                  logger.error(`${logPrefix} [通知主人] 兜底读取 other.yaml 失败:`, err.message);
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
          logger.warn(`${logPrefix} [通知主人] 最终未能获取到有效的主人QQ列表，无法发送消息。`);
          return;
      }

      if (typeof Bot === "undefined" || typeof Bot.pickUser !== 'function') {
          logger.error(`${logPrefix} [通知主人] Bot 对象或 Bot.pickUser 方法无效，无法发送消息。`);
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
              logger.info(`${logPrefix} [通知主人] 消息已尝试发送给主人 ${firstMasterId}。`);
          } else {
              logger.warn(`${logPrefix} [通知主人] 未能为主人QQ ${firstMasterId} 获取到有效的用户对象或sendMsg方法。`);
          }
      } catch (sendError) {
          logger.error(`${logPrefix} [通知主人] 发送消息给主人 ${firstMasterId} 失败:`, sendError.message, sendError);
      }
  }

  // --- 实例方法 ---
  async RunUpdateTask() {
    if (!MiaoPluginMBT.isGloballyInitialized) {
      this.logger.warn(`${this.logPrefix} [定时更新] 插件未初始化，跳过本次任务。`);
      return;
    }
    this.logger.info(`${this.logPrefix} 开始执行定时更新任务...`);
    const startTime = Date.now();
    let overallHasChanges = false;
    let taskError = null;
    try {
      overallHasChanges = await this.UpdateTuKu(null, true);
      this.logger.info(`${this.logPrefix} 定时更新任务完成。检测到更新: ${overallHasChanges}`);
    } catch (error) {
      taskError = error;
      this.logger.error(`${this.logPrefix} 定时更新任务执行期间发生意外错误:`, error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`${this.logPrefix} 定时更新任务流程结束，总耗时 ${duration} 秒。`);
    }
  }

  async ManualRunUpdateTask(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${this.logPrefix} 抱歉，只有主人才能手动执行此任务。`, true);

    this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 手动触发更新任务 (#执行咕咕牛更新)...`);
    await e.reply(`${this.logPrefix} 正在执行更新检查，请稍候...`, true);
    let overallHasChanges = false;
    let taskError = null;
    const startTime = Date.now();

    try {
      overallHasChanges = await this.UpdateTuKu(e, true);
      this.logger.info(`${this.logPrefix} 手动触发的更新任务核心逻辑已完成。检测到更新: ${overallHasChanges}`);
    } catch (error) {
      taskError = error;
      this.logger.error(`${this.logPrefix} 手动触发更新任务时发生错误:`, error);
      await this.ReportError(e, "手动执行更新任务", error);
    } finally {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`${this.logPrefix} 手动触发更新任务流程结束，总耗时 ${duration} 秒。`);
    }
    if (!taskError) {
      if (!overallHasChanges) { // 只有在没有变化时才发送“已是最新”
        await e.reply(`${this.logPrefix} 更新检查完成，图库已是最新。`, true);
      }
      // 如果有变化，UpdateTuKu 内部会发送图片报告，这里不再重复
    }
    return true;
  }

  async CheckInit(e) {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 首次触发，开始初始化...`);
      await this._initializeInstance();
    } else if (MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 初始化进行中，等待...`);
      try {
        await MiaoPluginMBT.initializationPromise;
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
      } catch (error) {
        this.logger.error(`${this.logPrefix} [核心检查] 等待初始化时捕获到错误:`, error.message || error);
        this.isPluginInited = false;
      }
    } else {
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
    }

    if (!this.isPluginInited) {
      await e.reply(`${this.logPrefix} 插件初始化失败或仍在进行中，请稍后再试。`, true);
      return false;
    }

    let coreDataValid = true;
    if (!MiaoPluginMBT.MBTConfig || Object.keys(MiaoPluginMBT.MBTConfig).length === 0) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 配置丢失！`);
      coreDataValid = false;
    }
    if (!Array.isArray(MiaoPluginMBT._imgDataCache)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 元数据缓存无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._userBanSet instanceof Set)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 用户封禁列表无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 生效封禁列表无效！`);
      coreDataValid = false;
    }
    if (!MiaoPluginMBT._aliasData) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 别名数据丢失！`);
      coreDataValid = false;
    }

    if (!coreDataValid) {
      await e.reply(`${this.logPrefix} 内部状态错误，核心数据加载失败，请重启 Bot。`, true);
      return false;
    }

    if (MiaoPluginMBT._imgDataCache.length === 0 && (await MiaoPluginMBT.IsTuKuDownloaded(1))) {
      this.logger.warn(`${this.logPrefix} [核心检查] 注意：图片元数据为空，部分功能可能受限。`);
    }
    return true;
  }

  async ReportError(e, operationName, error, context = "") {
    await MiaoPluginMBT.ReportError(e, operationName, error, context, this);
  }

  async DownloadTuKu(e) {
    if (!(await this.CheckInit(e))) return true;

    const logPrefix = this.logPrefix;
    const logger = this.logger;
    const userId = e.user_id;
    const commandName = "DownloadTuKu";
    const cooldownDuration = 2 * 60;
    let redisKey = null;

    if (userId) {
      redisKey = `Yz:GuGuNiu:${commandName}:${userId}`;
      try {
        const ttl = await redis.ttl(redisKey);
        if (ttl && ttl > 0) {
          await e.reply(`指令冷却中，剩余 ${ttl} 秒后可再次使用哦~`, true);
          return true;
        }
      } catch (redisError) {
        logger.error(`${logPrefix} [${commandName}] Redis (ttl) 操作失败:`, redisError);
      }
    }

    //logger.info(`${logPrefix} [${commandName}] 用户 ${userId || '未知'} 开始执行下载流程。`);

    const baseRawUrl = RAW_URL_Repo1;
    let allTestResults = [];
    const overallTestStartTime = Date.now();

    try {
      allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, logger);
    } catch (testError) {
      logger.error(`${logPrefix} [下载流程-测速] 网络测速阶段失败:`, testError);
      if (e) {
        await MiaoPluginMBT.ReportError(e, `网络测速失败`, testError, `无法为核心仓库开始下载`, logger);
      }
      return true;
    }

    const sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, logger);
    if (!sourcesToTry || sourcesToTry.length === 0) {
      logger.error(`${logPrefix} [下载流程-测速] 在下载决策阶段无可用下载源！`);
      const error = new Error("无可用下载源 (所有测速均失败或无结果)");
      if (e) await MiaoPluginMBT.ReportError(e, `下载核心仓库`, error, "所有测速尝试均未找到可用节点", logger);
      return true;
    }

    if (redisKey) {
      try {
        await redis.set(redisKey, '1', { EX: cooldownDuration });
        //logger.info(`${logPrefix} [${commandName}] 用户 ${userId} 的冷却已在测速通过后设置，时长 ${cooldownDuration} 秒。`);
      } catch (redisError) {
        //logger.error(`${logPrefix} [${commandName}] Redis (set) 操作失败:`, redisError);
        //await e.reply(`${logPrefix} 内部错误，冷却功能可能暂时失效，请稍后再试或联系管理员。`, true);
      }
    }

    const startTime = Date.now();
    let overallSuccess = false;
    let coreRepoResult = { repo: 1, success: false, nodeName: "未执行", error: null, gitLog: null };
    const subsidiaryResults = [];

    try {
      const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
      const Repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
      let Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
      const Repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
      let Repo3Exists = Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
      const Repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Sexy_Github_URL || Default_Config.Sexy_Github_URL);
      let Repo4Exists = Repo4UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(4));

      let allConfiguredAndDownloaded = Repo1Exists;
      if (Repo2UrlConfigured) allConfiguredAndDownloaded &&= Repo2Exists;
      if (Repo3UrlConfigured) allConfiguredAndDownloaded &&= Repo3Exists;
      if (Repo4UrlConfigured) allConfiguredAndDownloaded &&= Repo4Exists;

      if (allConfiguredAndDownloaded) {
        if (redisKey) { try { await redis.del(redisKey); } catch (err) { logger.warn(`${logPrefix} [${commandName}] 清理已存在仓库时的Redis冷却key失败:`, err); } }
        return e.reply(`${logPrefix} 所有已配置的图库均已存在。`, true);
      }

      if (!Repo1Exists && (Repo2Exists || Repo3Exists || Repo4Exists)) {
        logger.warn(`${logPrefix} [下载] 状态异常！核心仓库未下载，但部分附属仓库已存在。将尝试下载核心仓库。`);
        await e.reply(`${logPrefix} 状态异常！核心仓库未下载，但部分附属仓库已存在。\n正在尝试下载核心仓库，请稍候...`, true);
      }

      if (!Repo1Exists) {
        try {
          coreRepoResult = await MiaoPluginMBT.DownloadRepoWithFallback(1, MiaoPluginMBT.MBTConfig.Main_Github_URL || Default_Config.Main_Github_URL, MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch, MiaoPluginMBT.paths.LocalTuKuPath, e, logger);
          if (!coreRepoResult.success) {
            logger.error(`${logPrefix} [核心下载] 核心仓库下载失败。`);
            if (e && !e.replyed) {
              const failMsg = `『咕咕牛』核心仓库下载失败 (${coreRepoResult.nodeName})。请检查日志或网络后重试。`;
              await e.reply(failMsg).catch(() => { });
            }
            if (redisKey) { try { await redis.del(redisKey); } catch (err) { logger.warn(`${logPrefix} [${commandName}] 核心下载失败后清理Redis冷却key失败:`, err); } }
            return true;
          }
        } catch (err) {
          logger.error(`${logPrefix} [核心下载] 核心仓库下载过程中发生意外错误:`, err);
          coreRepoResult = { repo: 1, success: false, nodeName: "执行异常", error: err, gitLog: null };
          await this.ReportError(e, "下载核心仓库", coreRepoResult.error);
          if (redisKey) { try { await redis.del(redisKey); } catch (delErr) { logger.warn(`${logPrefix} [${commandName}] 核心下载异常后清理Redis冷却key失败:`, delErr); } }
          return true;
        }
      } else {
        coreRepoResult = { repo: 1, success: true, nodeName: "本地", error: null, gitLog: await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, logger) };
      }
      overallSuccess = coreRepoResult.success;

      const subsidiaryPromises = [];
      const processSubsidiary = async (repoNum, nameForLog, urlConfigKey, pathKey, existsVar) => {
        const url = MiaoPluginMBT.MBTConfig[urlConfigKey] || Default_Config[urlConfigKey];
        const localPath = MiaoPluginMBT.paths[pathKey];
        if (url && !existsVar) {
          subsidiaryPromises.push(
            MiaoPluginMBT.DownloadRepoWithFallback(repoNum, url, MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch, localPath, null, logger)
              .then(result => ({ repo: repoNum, ...result }))
              .catch(err => {
                logger.error(`${logPrefix} [核心下载] 附属仓库 (${nameForLog}) 下载 Promise 捕获到错误:`, err);
                return { repo: repoNum, success: false, nodeName: "执行异常", error: err, gitLog: null };
              })
          );
        } else if (url && existsVar) {
          subsidiaryResults.push({ repo: repoNum, success: true, nodeName: "本地", error: null, gitLog: await MiaoPluginMBT.GetTuKuLog(1, localPath, logger) });
        } else {
          subsidiaryResults.push({ repo: repoNum, success: true, nodeName: "未配置", error: null, gitLog: null });
        }
      };

      await processSubsidiary(2, "二号", "Ass_Github_URL", "LocalTuKuPath2", Repo2Exists);
      await processSubsidiary(3, "三号", "Ass2_Github_URL", "LocalTuKuPath3", Repo3Exists);
      await processSubsidiary(4, "四号", "Sexy_Github_URL", "LocalTuKuPath4", Repo4Exists);

      if (subsidiaryPromises.length > 0) {
        if (e && coreRepoResult.success && !Repo1Exists) {
          await e.reply("--『咕咕牛🐂』--\n核心仓已部署✅️\n附属聚合下载中...").catch(() => { });
        } else if (e && ((Repo2UrlConfigured && !Repo2Exists) || (Repo3UrlConfigured && !Repo3Exists) || (Repo4UrlConfigured && !Repo4Exists))) {
          await e.reply("--『咕咕牛🐂』--\n开始下载缺失的附属仓库...").catch(() => { });
        }
        const settledResults = await Promise.allSettled(subsidiaryPromises);
        for (const result of settledResults) {
          if (result.status === "fulfilled") {
            const resValue = result.value;
            if (resValue && typeof resValue.success === 'boolean') {
              if (!resValue.success) {
                logger.error(`${logPrefix} [核心下载] 附属仓库 (${resValue.repo || '未知'}号) 下载失败 (${resValue.nodeName || '未知节点'})。`);
                if (resValue.error) logger.error(`${logPrefix} [核心下载] 失败详情:`, resValue.error);
              }
              subsidiaryResults.push(resValue);
            } else {
              logger.error(`${logPrefix} [核心下载] 一个附属仓库Promise fulfilled 但返回值结构错误:`, resValue);
              subsidiaryResults.push({ repo: 'UnknownFulfilled', success: false, nodeName: "结构错误", error: new Error('Fulfilled value structure error'), gitLog: null });
            }
          } else {
            logger.error(`${logPrefix} [核心下载] 一个附属仓库 Promise rejected:`, result.reason);
            let repoIdentifier = 'UnknownRejected';
            if (result.reason && result.reason.repo) repoIdentifier = result.reason.repo;
            subsidiaryResults.push({ repo: repoIdentifier, success: false, nodeName: "Promise Rejected", error: result.reason, gitLog: null });
          }
        }
      }

      subsidiaryResults.sort((a, b) => (a.repo === 'UnknownRejected' || a.repo === 'UnknownFulfilled' ? 1 : (b.repo === 'UnknownRejected' || b.repo === 'UnknownFulfilled' ? -1 : (a.repo - b.repo))));

      overallSuccess = coreRepoResult.success;
      for (const res of subsidiaryResults) {
        if (res.nodeName !== "未配置" && res.nodeName !== "本地") {
          overallSuccess &&= res.success;
        }
      }


      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      const reportData = {
        coreRepoResult: coreRepoResult,
        subsidiaryResults: subsidiaryResults,
        duration: duration,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        pluginVersion: MiaoPluginMBT.GetVersionStatic(),
        isArray: Array.isArray
      };

      let reportSent = false;
      try {
        const imageBuffer = await renderPageToImage("download-report", {
          htmlContent: DOWNLOAD_REPORT_HTML_TEMPLATE,
          data: reportData,
          imgType: "png",
          pageGotoParams: { waitUntil: "networkidle0" },
          pageBoundingRect: { selector: ".container", padding: 0 },
          width: 550,
        }, this);

        if (imageBuffer) {
          await e.reply(imageBuffer);
          reportSent = true;
        } else {
          throw new Error("Puppeteer 生成下载报告图片失败 (返回空)");
        }
      } catch (reportError) {
        logger.error(`${logPrefix} [下载报告] 生成或发送图片报告时出错:`, reportError);
        const logMessages = [];
        let coreStatusLineText = `核心仓库: ${coreRepoResult.success ? "成功" : "失败"} (${coreRepoResult.nodeName})`;
        if (coreRepoResult.error && coreRepoResult.error.message) coreStatusLineText += ` | 错误: ${coreRepoResult.error.message}`;
        logMessages.push(coreStatusLineText);
        if (coreRepoResult.gitLog) logMessages.push(`--- 核心仓库最新 ---\n${coreRepoResult.gitLog}`);

        subsidiaryResults.forEach((res) => {
          if (!res || typeof res.repo === 'undefined') return;
          let subRepoName = "";
          if (res.repo === 2) subRepoName = "二号仓库";
          else if (res.repo === 3) subRepoName = "三号仓库";
          else if (res.repo === 4) subRepoName = "四号仓库";
          else subRepoName = `${res.repo}号仓库`;

          let subStatusLineText = `${subRepoName}: `;
          if (res.nodeName === "本地") subStatusLineText += "已存在";
          else if (res.nodeName === "未配置") subStatusLineText += "未配置";
          else subStatusLineText += `${res.success ? "成功 (" + (res.nodeName || '未知节点') + ')' : "失败 (" + (res.nodeName || '未知节点') + ')'}`;
          if (res.error && res.error.message) subStatusLineText += ` | 错误: ${res.error.message}`;
          logMessages.push(subStatusLineText);
          if (res.gitLog) logMessages.push(`--- ${subRepoName}最新 ---\n${res.gitLog}`);
        });

        try {
          const forwardMsg = await common.makeForwardMsg(e, logMessages, "『咕咕牛』下载结果与日志");
          if (forwardMsg) {
            await e.reply(forwardMsg);
            reportSent = true;
          } else {
            logger.error(`${logPrefix} [下载报告] 创建文本结果合并消息失败。`);
          }
        } catch (fwdErr) {
          logger.error(`${logPrefix} [下载报告] 发送文本结果合并消息失败:`, fwdErr);
        }
        if (!reportSent && e) {
          await this.ReportError(e, "发送下载结果", reportError);
        }
      }

      if (overallSuccess) {
        await MiaoPluginMBT.RunPostDownloadSetup(null, logger);
        if (e && !e.replyed) await e.reply("『咕咕牛』成功进入喵喵里面！").catch(() => { });
      } else {
        if (e && !e.replyed) await e.reply("『咕咕牛』部分仓库下载/部署失败，请检查报告和日志，你可以再次执行下载补全。").catch(() => { });
      }

    } catch (error) {
      logger.error(`${logPrefix} [DownloadTuKu-核心] 顶层执行出错:`, error);
      if (e) await this.ReportError(e, "下载图库顶层", error);
      overallSuccess = false;
    } finally {
      if (redisKey && !overallSuccess) {
        try { await redis.del(redisKey); }
        catch (delErr) { logger.warn(`${logPrefix} [${commandName}] 下载失败后清理Redis冷却key失败:`, delErr); }
      }
      const durationFinal = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`${logPrefix} [核心下载] 流程结束，总耗时 ${durationFinal} 秒。`);
    }
    return true;
  }

  async UpdateTuKu(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false;
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    const Repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
    let Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const Repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
    let Repo3Exists = Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
    const Repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Sexy_Github_URL || Default_Config.Sexy_Github_URL);
    let Repo4Exists = Repo4UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(4));

    let anyConfiguredRepoMissing = false;
    if (!Repo1Exists) anyConfiguredRepoMissing = true;
    if (Repo2UrlConfigured && !Repo2Exists) anyConfiguredRepoMissing = true;
    if (Repo3UrlConfigured && !Repo3Exists) anyConfiguredRepoMissing = true;
    if (Repo4UrlConfigured && !Repo4Exists) anyConfiguredRepoMissing = true;

    if (!Repo1Exists) {
      if (!isScheduled && e) await e.reply("『咕咕牛🐂』图库未下载", true);
      return false;
    }
    if (anyConfiguredRepoMissing && Repo1Exists) {
      if (!isScheduled && e) await e.reply("『咕咕牛🐂』部分附属仓库未下载，建议先 `#下载咕咕牛` 补全。", true);
    }

    const startTime = Date.now();
    if (!isScheduled && e) await e.reply("『咕咕牛🐂』开始检查更新...", true);
    //logger.info(`${logPrefix} [更新流程] 开始 @ ${new Date(startTime).toISOString()}`);

    const reportResults = [];
    let overallSuccess = true;
    let overallHasChanges = false;

    const processRepoResult = async (repoNum, localPath, repoDisplayName, urlConfigKeyInMBT, urlConfigKeyInDefault, branchForUpdate, isCore = false) => {
      const repoUrlForUpdate = MiaoPluginMBT.MBTConfig?.[urlConfigKeyInMBT] || Default_Config[urlConfigKeyInDefault || urlConfigKeyInMBT];
      const result = await MiaoPluginMBT.UpdateSingleRepo(isCore ? e : null, repoNum, localPath, repoDisplayName, repoUrlForUpdate, branchForUpdate, isScheduled, logger);
      overallSuccess &&= result.success;
      overallHasChanges ||= result.hasChanges;
      let statusText = "";
      if (result.success) {
        if (result.wasForceReset) statusText = "本地冲突 (强制同步)";
        else if (result.hasChanges) statusText = "更新成功";
        else statusText = "已是最新";
      } else statusText = "更新失败";
      return { name: repoDisplayName, statusText, statusClass: result.success ? (result.hasChanges || result.wasForceReset ? "status-ok" : "status-no-change") : "status-fail", error: result.error, log: result.log, wasForceReset: result.wasForceReset };
    };

    const branch = MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch;

    if (Repo1Exists) reportResults.push(await processRepoResult(1, MiaoPluginMBT.paths.LocalTuKuPath, "一号仓库", "Main_Github_URL", "Main_Github_URL", branch, true));
    else { reportResults.push({ name: "一号仓库", statusText: "未下载", statusClass: "status-skipped", error: null, log: null, wasForceReset: false }); overallSuccess = false; }

    if (Repo2UrlConfigured) {
      if (Repo2Exists) reportResults.push(await processRepoResult(2, MiaoPluginMBT.paths.LocalTuKuPath2, "二号仓库", "Ass_Github_URL", "Ass_Github_URL", branch));
      else reportResults.push({ name: "二号仓库", statusText: "未下载", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });
    } else reportResults.push({ name: "二号仓库", statusText: "未配置", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });

    if (Repo3UrlConfigured) {
      if (Repo3Exists) reportResults.push(await processRepoResult(3, MiaoPluginMBT.paths.LocalTuKuPath3, "三号仓库", "Ass2_Github_URL", "Ass2_Github_URL", branch));
      else reportResults.push({ name: "三号仓库", statusText: "未下载", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });
    } else reportResults.push({ name: "三号仓库", statusText: "未配置", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });

    if (Repo4UrlConfigured) {
      if (Repo4Exists) reportResults.push(await processRepoResult(4, MiaoPluginMBT.paths.LocalTuKuPath4, "四号仓库", "Sexy_Github_URL", "Sexy_Github_URL", branch));
      else reportResults.push({ name: "四号仓库", statusText: "未下载", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });
    } else reportResults.push({ name: "四号仓库", statusText: "未配置", statusClass: "status-skipped", error: null, log: null, wasForceReset: false });

    if (overallSuccess && overallHasChanges) {
      await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, logger);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const coreRepoReport = reportResults.find(r => r.name === "一号仓库");
    const subsidiaryRepoReports = reportResults.filter(r => r.name !== "一号仓库");

    const reportData = {
      pluginVersion: MiaoPluginMBT.GetVersionStatic(),
      duration,
      scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
      coreResult: coreRepoReport,
      subsidiaryResults: subsidiaryRepoReports,
      results: reportResults,
      overallSuccess,
      overallHasChanges,
      isArray: Array.isArray
    };
    let imageBuffer = null;
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "update_report.html");
    let reportSent = false;
    try {
      await fsPromises.access(sourceHtmlPath);
      imageBuffer = await renderPageToImage("update-report", {
        tplFile: sourceHtmlPath, data: reportData, imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        pageBoundingRect: { selector: ".container", padding: 0 }, width: 560,
      }, this);
    } catch (accessOrRenderError) { logger.error(`${logPrefix} [更新报告] 模板访问或渲染时出错:`, accessOrRenderError); }

    const shouldNotifyMaster = isScheduled && (reportData.overallHasChanges || !reportData.overallSuccess);
    if (imageBuffer) {
      if (!isScheduled && e) { await e.reply(imageBuffer); reportSent = true; }
      else if (shouldNotifyMaster) {
        logger.info(`${logPrefix} [定时更新] 检测到变更或错误，准备向主人发送图片报告...`);
        await MiaoPluginMBT.SendMasterMsg(imageBuffer, e, 0, logger);
        reportSent = true;
      } else if (isScheduled && !shouldNotifyMaster) {
        logger.info(`${logPrefix} [定时更新] 未检测到变更且无错误，不发送通知。`);
        reportSent = true;
      }
    }

    if (!reportSent) {
      logger.error(`${logPrefix} [更新报告] Puppeteer 生成更新报告图片失败 (返回空) 或不满足发送条件。`);
      let fallbackMsg = `${logPrefix} 更新检查完成。\n`;
      reportResults.forEach((res) => { fallbackMsg += `${res.name}: ${res.statusText}\n`; if (res.error && res.error.message) fallbackMsg += `  错误: ${res.error.message.split("\n")[0]}\n`; });

      if (e && !isScheduled) await e.reply(fallbackMsg);
      else if (shouldNotifyMaster) {
        logger.warn(`${logPrefix} [定时更新] 图片生成失败，尝试向主人发送文本回退报告...`);
        await MiaoPluginMBT.SendMasterMsg(fallbackMsg, e, 0, logger);
      }
    }
    logger.info(`${logPrefix} 更新流程结束，耗时 ${duration} 秒。`);
    return overallHasChanges;
  }

  async ManageTuKu(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${this.logPrefix} 这个操作只有我的主人才能用哦~`, true);

    const msg = e.msg.trim();
    if (msg !== "#重置咕咕牛") return false;

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
        await safeDelete(dirPath, 3, 1000, true); //  throwOnError 设置为 true
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
        await this.ReportError(e, `重置咕咕牛 (${firstError.operation})`, firstError.error, contextMessage);
      } else {
        const failureMessage = "重置过程中出了点问题，但未捕获到具体错误原因，请检查日志吧！";
        await e.reply(failureMessage, true);
        logger.warn(`${this.logPrefix} 重置操作标记为失败，但没有捕获到有效的firstError对象。`);
      }
    }
    return true;
  }

  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;

    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    if (!Repo1Exists) {
      return e.reply("『咕咕牛🐂』图库还没下载呢，先 `#下载咕咕牛` 吧！", true);
    }

    const Repo2UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass_Github_URL || Default_Config.Ass_Github_URL);
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const Repo3UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Ass2_Github_URL || Default_Config.Ass2_Github_URL);
    const Repo3Exists = Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
    const Repo4UrlConfigured = !!(MiaoPluginMBT.MBTConfig?.Sexy_Github_URL || Default_Config.Sexy_Github_URL);
    const Repo4Exists = Repo4UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(4));

    let missingConfiguredSubsidiary = false;
    if (Repo2UrlConfigured && !Repo2Exists) missingConfiguredSubsidiary = true;
    if (Repo3UrlConfigured && !Repo3Exists) missingConfiguredSubsidiary = true;
    if (Repo4UrlConfigured && !Repo4Exists) missingConfiguredSubsidiary = true;

    if (Repo1Exists && missingConfiguredSubsidiary) {
      await e.reply("『咕咕牛🐂』核心仓库已下载，但部分附属仓库未下载或丢失。建议先 `#下载咕咕牛` 补全或 `#重置咕咕牛` 后重新下载。", true);
    }

    try {
      const pluginVersion = MiaoPluginMBT.GetVersionStatic();
      const GameFoldersMap = { gs: "原神", sr: "星铁", zzz: "绝区零", waves: "鸣潮" };
      const stats = {
        meta: { roles: 0, images: 0, games: {} },
        scan: {
          roles: 0, images: 0, gameImages: {}, gameRoles: {}, gameSizes: {}, gameSizesFormatted: {},
          totalSize: 0, totalGitSize: 0, totalFilesSize: 0,
          totalSizeFormatted: "0 B", totalGitSizeFormatted: "0 B", totalFilesSizeFormatted: "0 B"
        },
        repos: {
          1: { name: "一号仓库", exists: Repo1Exists, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          2: { name: "二号仓库", exists: Repo2Exists && Repo2UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          3: { name: "三号仓库", exists: Repo3Exists && Repo3UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
          4: { name: "四号仓库", exists: Repo4Exists && Repo4UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: "N/A", gitSizeFormatted: "N/A", filesSizeFormatted: "N/A" },
        },
      };
      Object.values(GameFoldersMap).forEach((gameName) => { stats.meta.games[gameName] = 0; stats.scan.gameImages[gameName] = 0; stats.scan.gameRoles[gameName] = 0; stats.scan.gameSizes[gameName] = 0; stats.scan.gameSizesFormatted[gameName] = "0 B"; });

      const currentConfig = MiaoPluginMBT.MBTConfig;
      const configForRender = {
        enabled: currentConfig?.TuKuOP ?? Default_Config.defaultTuKuOp,
        pflLevel: currentConfig?.PFL ?? Default_Config.defaultPfl,
        aiEnabled: currentConfig?.Ai ?? true,
        easterEggEnabled: currentConfig?.EasterEgg ?? true,
        layoutEnabled: currentConfig?.layout ?? true,
        pm18Enabled: currentConfig?.PM18 ?? false,
        activeBans: MiaoPluginMBT._activeBanSet?.size ?? 0,
        userBans: MiaoPluginMBT._userBanSet?.size ?? 0,
      };
      configForRender.enabledText = configForRender.enabled ? "已启用" : "已禁用";
      configForRender.purifiedBans = Math.max(0, configForRender.activeBans - configForRender.userBans);
      configForRender.pflDesc = Purify_Level.getDescription(configForRender.pflLevel);
      configForRender.aiStatusText = configForRender.aiEnabled ? "开启" : "关闭";
      configForRender.easterEggStatusText = configForRender.easterEggEnabled ? "开启" : "关闭";
      configForRender.layoutStatusText = configForRender.layoutEnabled ? "开启" : "关闭";
      configForRender.pm18StatusText = configForRender.pm18Enabled ? "开启" : "关闭";

      const characterSet = new Set();
      if (Array.isArray(MiaoPluginMBT._imgDataCache) && MiaoPluginMBT._imgDataCache.length > 0) {
        stats.meta.images = MiaoPluginMBT._imgDataCache.length;
        MiaoPluginMBT._imgDataCache.forEach((item) => {
          if (item && item.characterName) characterSet.add(item.characterName);
          const PathParts = item?.path?.split("/");
          if (PathParts?.length > 0) { const GameKey = PathParts[0].split("-")[0]; const GameName = GameFoldersMap[GameKey]; if (GameName) stats.meta.games[GameName] = (stats.meta.games[GameName] || 0) + 1; }
        });
      }
      stats.meta.roles = characterSet.size;

      const RepoStatsScan = {
        1: { path: MiaoPluginMBT.paths.LocalTuKuPath, gitPath: MiaoPluginMBT.paths.gitFolderPath, exists: Repo1Exists, isContentRepo: true },
        2: { path: MiaoPluginMBT.paths.LocalTuKuPath2, gitPath: MiaoPluginMBT.paths.gitFolderPath2, exists: Repo2Exists && Repo2UrlConfigured, isContentRepo: true },
        3: { path: MiaoPluginMBT.paths.LocalTuKuPath3, gitPath: MiaoPluginMBT.paths.gitFolderPath3, exists: Repo3Exists && Repo3UrlConfigured, isContentRepo: true },
        4: { path: MiaoPluginMBT.paths.LocalTuKuPath4, gitPath: MiaoPluginMBT.paths.gitFolderPath4, exists: Repo4Exists && Repo4UrlConfigured, isContentRepo: false },
      };
      const ScannedRoleImageCounts = {}; Object.values(GameFoldersMap).forEach(gn => ScannedRoleImageCounts[gn] = {});
      const ScannedGameSizes = {}; Object.values(GameFoldersMap).forEach(gn => ScannedGameSizes[gn] = 0);
      let totalGitSizeScan = 0; let totalFilesSizeScan = 0;

      for (const RepoNumStr of Object.keys(RepoStatsScan)) {
        const RepoNum = parseInt(RepoNumStr, 10);
        const Repo = RepoStatsScan[RepoNumStr];
        if (!Repo.exists) continue;

        let repoGitSize = 0; let repoFilesSize = 0;
        try { repoGitSize = await FolderSize(Repo.gitPath); }
        catch (sizeError) { stats.repos[RepoNum].gitSizeFormatted = "错误"; }
        stats.repos[RepoNum].gitSize = repoGitSize;
        stats.repos[RepoNum].gitSizeFormatted = FormatBytes(repoGitSize);
        totalGitSizeScan += repoGitSize;

        if (Repo.isContentRepo) {
          for (const GameKey in GameFoldersMap) {
            const GameName = GameFoldersMap[GameKey];
            const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[GameKey];
            if (!sourceFolderName || GameKey === "gallery") continue;
            const gameFolderPath = path.join(Repo.path, sourceFolderName);
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
                        try { const fileStat = await fsPromises.stat(imagePath); ScannedGameSizes[GameName] = (ScannedGameSizes[GameName] || 0) + fileStat.size; repoFilesSize += fileStat.size; }
                        catch (statErr) { }
                      }
                    }
                  } catch (readCharErr) { }
                  if (imageCountInCharDir > 0) ScannedRoleImageCounts[GameName][characterName] = (ScannedRoleImageCounts[GameName][characterName] || 0) + imageCountInCharDir;
                }
              }
            } catch (accessGameErr) { }
          }
        } else {
          try { repoFilesSize = Math.max(0, (await FolderSize(Repo.path)) - repoGitSize); }
          catch (sizeError) { stats.repos[RepoNum].filesSizeFormatted = "错误"; }
        }
        stats.repos[RepoNum].filesSize = repoFilesSize;
        stats.repos[RepoNum].filesSizeFormatted = FormatBytes(repoFilesSize);
        stats.repos[RepoNum].size = repoGitSize + repoFilesSize;
        stats.repos[RepoNum].sizeFormatted = FormatBytes(stats.repos[RepoNum].size);
        totalFilesSizeScan += repoFilesSize;
      }

      const scanResult = stats.scan;
      scanResult.totalGitSize = totalGitSizeScan;
      scanResult.totalGitSizeFormatted = FormatBytes(totalGitSizeScan);
      scanResult.totalFilesSize = totalFilesSizeScan;
      scanResult.totalFilesSizeFormatted = FormatBytes(totalFilesSizeScan);

      Object.values(GameFoldersMap).forEach((GameName) => {
        const rolesInGame = ScannedRoleImageCounts[GameName] || {};
        const roleNames = Object.keys(rolesInGame);
        const roleCount = roleNames.length;
        let gameImageCount = 0;
        roleNames.forEach((roleName) => { gameImageCount += rolesInGame[roleName] || 0; });
        scanResult.gameRoles[GameName] = roleCount;
        scanResult.gameImages[GameName] = gameImageCount;
        scanResult.roles += roleCount;
        scanResult.images += gameImageCount;
        const gameSizeBytes = ScannedGameSizes[GameName] || 0;
        scanResult.gameSizes[GameName] = gameSizeBytes;
        scanResult.gameSizesFormatted[GameName] = FormatBytes(gameSizeBytes);
      });
      scanResult.totalSize = scanResult.totalFilesSize + scanResult.totalGitSize;
      scanResult.totalSizeFormatted = FormatBytes(scanResult.totalSize);

      const repoCount = Object.values(stats.repos || {}).filter((repo) => repo?.exists).length;
      const renderDataStatus = { pluginVersion, stats, config: configForRender, repoCount, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(), isArray: Array.isArray };
      const sourceHtmlPathStatus = path.join(MiaoPluginMBT.paths.commonResPath, "html", "status.html");

      const imageBufferStatus = await renderPageToImage("status-report", {
        tplFile: sourceHtmlPathStatus, data: renderDataStatus, imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        pageBoundingRect: { selector: ".container", padding: 0 }, width: 540,
      }, this);

      if (imageBufferStatus) await e.reply(imageBufferStatus);
      else {
        await e.reply("生成状态报告图片失败 (截图环节出错)，请查看日志。", true);
      }
    } catch (error) {
      await this.ReportError(e, "生成状态报告图片", error);
      return true;
    }

    //await e.reply(`${logPrefix} 正在生成详细的图库地图，请稍候...`, true).catch(() => { });

    const gameDataForMap = {
      gs: { name: "原神", key: "gs", characters: {}, order: 1, hasFace: true, totalImageCountInGame: 0, totalByteSizeInGame: 0 },
      sr: { name: "星铁", key: "sr", characters: {}, order: 2, hasFace: true, totalImageCountInGame: 0, totalByteSizeInGame: 0 },
      zzz: { name: "绝区零", key: "zzz", characters: {}, order: 3, hasFace: false, totalImageCountInGame: 0, totalByteSizeInGame: 0 },
      waves: { name: "鸣潮", key: "waves", characters: {}, order: 4, hasFace: false, totalImageCountInGame: 0, totalByteSizeInGame: 0 }
    };
    const gameKeyMapping = {
      "gs-character": "gs", "sr-character": "sr",
      "zzz-character": "zzz", "waves-character": "waves"
    };

    if (!MiaoPluginMBT._imgDataCache || MiaoPluginMBT._imgDataCache.length === 0) {
      //await e.reply(`${logPrefix} 图库元数据为空，无法生成详细地图。`, true);
      return true;
    }

    for (const item of MiaoPluginMBT._imgDataCache) {
      if (!item.path || !item.characterName || !item.sourceGallery) continue;
      const gameKey = gameKeyMapping[item.sourceGallery];
      if (!gameKey || !gameDataForMap[gameKey]) continue;

      const charName = item.characterName;
      if (!gameDataForMap[gameKey].characters[charName]) {
        gameDataForMap[gameKey].characters[charName] = {
          name: charName, imageCount: 0, totalSize: 0, faceUrl: null
        };
      }
      gameDataForMap[gameKey].characters[charName].imageCount++;
      gameDataForMap[gameKey].totalImageCountInGame++;

      const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(item.path);
      if (absolutePath) {
        try {
          const stats = await fsPromises.stat(absolutePath);
          const fileSize = stats.size;
          gameDataForMap[gameKey].characters[charName].totalSize += fileSize;
          gameDataForMap[gameKey].totalByteSizeInGame += fileSize;
        } catch (statErr) { }
      }
    }

    const processAndSendMap = async (gameKeysToShow, mapTitleSuffix = "") => {
      const gamesForThisMap = [];
      for (const gk of gameKeysToShow) {
        if (gameDataForMap[gk] && Object.keys(gameDataForMap[gk].characters).length > 0) {
          const gameEntry = {
            name: gameDataForMap[gk].name,
            key: gameDataForMap[gk].key,
            hasFace: gameDataForMap[gk].hasFace,
            totalImageCountDisplay: gameDataForMap[gk].totalImageCountInGame,
            totalSizeFormattedDisplay: FormatBytes(gameDataForMap[gk].totalByteSizeInGame),
            characters: []
          };
          const characterNames = Object.keys(gameDataForMap[gk].characters).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
          for (const charName of characterNames) {
            const charData = gameDataForMap[gk].characters[charName];
            let faceImageUrl = null;
            if (gameDataForMap[gk].hasFace) {
              const aliasForFace = await MiaoPluginMBT.FindRoleAlias(charName, logger);
              const standardNameForFace = aliasForFace.exists ? aliasForFace.mainName : charName;
              let facePath = null;
              if (gk === "gs") facePath = path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "..", "character", standardNameForFace, "imgs", "face.webp");
              else if (gk === "sr") facePath = path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "..", "character", standardNameForFace, "imgs", "face.webp");
              if (facePath) { try { await fsPromises.access(facePath); faceImageUrl = `file://${facePath.replace(/\\/g, "/")}`; } catch (err) { } }
            }
            gameEntry.characters.push({
              name: charData.name,
              imageCount: charData.imageCount,
              totalSizeFormatted: FormatBytes(charData.totalSize),
              faceUrl: faceImageUrl
            });
          }
          gamesForThisMap.push(gameEntry);
        }
      }

      if (gamesForThisMap.length === 0) {
        //logger.info(`${logPrefix} [图库地图-${mapTitleSuffix}] 没有可供显示的角色数据。`);
        return;
      }

      try {
        let galleryMapHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "check_gallerymap.html");
        try { await fsPromises.access(galleryMapHtmlPath); }
        catch (commonPathError) {
          if (commonPathError.code === ERROR_CODES.NotFound) {
            galleryMapHtmlPath = path.join(__dirname, "..", "resources", "html", "check_gallerymap.html");
            await fsPromises.access(galleryMapHtmlPath);
          } else { throw commonPathError; }
        }

        const imageBuffer = await renderPageToImage(`gallery-map-${mapTitleSuffix.toLowerCase().replace(/\s+/g, '-')}`, {
          tplFile: galleryMapHtmlPath,
          data: {
            games: gamesForThisMap,
            pluginVersion: MiaoPluginMBT.GetVersionStatic(),
            scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
            isArray: Array.isArray,
            FormatBytes: FormatBytes
          },
          imgType: "png",
          pageGotoParams: { waitUntil: "networkidle0", timeout: 60000 },
          screenshotOptions: { fullPage: true },
          width: gameKeysToShow.length > 1 ? 1200 : 800 
        }, this);

        if (imageBuffer) {
          await e.reply(imageBuffer);
          await common.sleep(500);
        } else {
          //logger.error(`${logPrefix} [图库地图-${mapTitleSuffix}] Puppeteer 未能成功生成图片。`);
          //await e.reply(`生成 ${mapTitleSuffix} 图库地图图片失败。`, true);
        }
      } catch (mapRenderError) {
        //logger.error(`${logPrefix} [图库地图-${mapTitleSuffix}] 生成时发生错误:`, mapRenderError);
        if (mapRenderError.code === ERROR_CODES.NotFound && mapRenderError.message.includes("check_gallerymap.html")) {
          //await e.reply(`${logPrefix} 生成图库地图失败：找不到模板文件 check_gallerymap.html。`, true);
        } else {
          //await this.ReportError(e, `生成 ${mapTitleSuffix} 图库地图`, mapRenderError);
        }
      }
    };

    await processAndSendMap(["gs"], "原神");
    await processAndSendMap(["sr"], "星铁");
    await processAndSendMap(["zzz", "waves"], "其他游戏");

    return true;
  }

  async ManageTuKuOption(e) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${logPrefix} 只有主人才能开关图库啦~`, true);

    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i);
    if (!match) return false;

    const action = match[1]; const enable = action === "启用";
    let configChanged = false; let saveWarning = ""; let asyncError = null;
    let statusMessageForPanel = "";

    await MiaoPluginMBT.configMutex.runExclusive(async () => {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentStatus = MiaoPluginMBT.MBTConfig.TuKuOP ?? Default_Config.defaultTuKuOp;
      if (currentStatus === enable) {
        statusMessageForPanel = `${logPrefix} 图库已经是「${action}」状态了，无需更改。`;
        return;
      }
      MiaoPluginMBT.MBTConfig.TuKuOP = enable; configChanged = true;
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, logger);
      if (!saveSuccess) {
        saveWarning = "⚠️ 配置保存失败！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.TuKuOP = !enable; configChanged = false;
        logger.error(`${logPrefix} [启用禁用] 保存失败，内存状态已回滚。`);
        await this.ReportError(e, `${action}咕咕牛`, new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      try {
        if (enable) {
          await MiaoPluginMBT.SyncCharacterFolders(logger);
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
        } else {
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.miaoChar, logger);
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.zzzChar, logger);
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.wavesChar, logger);
        }
        statusMessageForPanel = `${logPrefix} 图库已成功设为「${action}」。`;
      } catch (error) {
        asyncError = error;
        logger.error(`${logPrefix} [启用禁用] 后台操作失败:`, error);
        await this.ReportError(e, `${action}咕咕牛 (后台操作)`, error);
        statusMessageForPanel = `${logPrefix} 图库「${action}」操作已执行，但后台操作失败。`;
      }
    }

    if (statusMessageForPanel || saveWarning || asyncError) {
      let finalPanelMessage = statusMessageForPanel;
      if (saveWarning && !finalPanelMessage.includes(saveWarning)) {
        finalPanelMessage = saveWarning + (finalPanelMessage ? `\n${finalPanelMessage}` : '');
      }
      if (asyncError && !finalPanelMessage.includes("后台")) {
        finalPanelMessage += `\n(后台${action === "启用" ? "同步" : "清理"}时遇到问题)`;
      }
      try {
        await this.ShowSettingsPanel(e, finalPanelMessage.trim());
      } catch (panelError) {
        logger.error(`${logPrefix} [启用禁用] 调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
      }
    } else if (!configChanged && !saveWarning && !asyncError && !statusMessageForPanel) {
      await this.ShowSettingsPanel(e, `${logPrefix} 图库已经是「${action}」状态了，无需更改。`);
    }
    return true;
  }

  async ManageUserBans(e) {
    if (!(await this.CheckInit(e))) return true;
    const msg = e.msg.trim();
    const isMaster = e.isMaster;
    const logPrefix = this.logPrefix;
    const logger = this.logger;

    if ((msg.startsWith("#咕咕牛封禁 ") || msg.startsWith("#咕咕牛解禁 ")) && !isMaster) return e.reply(`${logPrefix} 只有主人才能进行封禁或解禁操作哦~`, true);

    if (msg === "#ban列表" || msg === "#咕咕牛封禁列表") {
      const activeBanCount = MiaoPluginMBT._activeBanSet.size;
      if (activeBanCount === 0) return e.reply("当前没有任何图片被封禁。", true);
      await e.reply(`正在整理中，请稍后...`, true);

      const purifiedBansData = []; const userBansData = [];
      const pluginVersion = MiaoPluginMBT.GetVersionStatic();
      const currentPFL = MiaoPluginMBT.MBTConfig?.PFL ?? Purify_Level.NONE;
      const config = MiaoPluginMBT.MBTConfig;
      const sortedActiveBans = Array.from(MiaoPluginMBT._activeBanSet).sort();

      await Promise.all(
        sortedActiveBans.map(async (relativePath) => {
          const fileName = path.basename(relativePath);
          const fileNameNoExt = fileName.replace(/\.webp$/i, "");
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
          const thumbnailPath = absolutePath ? `file://${absolutePath.replace(/\\/g, "/")}` : "";
          if (MiaoPluginMBT._userBanSet.has(relativePath)) {
            userBansData.push({ fileNameNoExt, thumbnailPath });
          } else {
            const imgData = MiaoPluginMBT._imgDataCache.find((img) => img.path?.replace(/\\/g, "/") === relativePath);
            const reasons = [];
            if (imgData && currentPFL > Purify_Level.NONE && MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, currentPFL)) reasons.push("净化");
            if (imgData?.attributes) {
              const attrs = imgData.attributes;
              if (config?.Ai === false && attrs.isAiImage === true) reasons.push("Ai");
              if (config?.EasterEgg === false && attrs.isEasterEgg === true) reasons.push("彩蛋");
              if (config?.layout === false && attrs.layout === "fullscreen") reasons.push("横屏");
            }
            if (reasons.length === 0) { reasons.push("未知"); logger.warn(`${logPrefix} [封禁列表] 图片 ${relativePath} 在生效列表但未找到明确屏蔽原因?`); }
            purifiedBansData.push({ fileNameNoExt, thumbnailPath, reasons });
          }
        })
      );

      let manualSent = false;
      const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "banlist.html");
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      if (userBansData.length > 0) {
        try {
          const renderDataManual = { pluginVersion, purifiedBans: [], userBans: userBansData, listType: "手动封禁", scaleStyleValue, batchInfo: "" };
          const imageBuffer = await renderPageToImage("banlist-manual", {
            tplFile: sourceHtmlPath, data: renderDataManual, imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0" },
            screenshotOptions: { fullPage: true }, width: 640,
          }, this);
          if (imageBuffer) { await e.reply(imageBuffer); manualSent = true; if (purifiedBansData.length > 0) await common.sleep(1000); }
          else logger.error(`${logPrefix} [封禁列表] 生成手动列表截图失败。`);
        } catch (renderError) { logger.error(`${logPrefix} [封禁列表] 生成手动列表截图时出错:`, renderError); await this.ReportError(e, "生成手动封禁列表", renderError); }
      }

      if (purifiedBansData.length > 0) {
        const ITEMS_PER_BATCH = 28;
        const totalBatchesPurified = Math.ceil(purifiedBansData.length / ITEMS_PER_BATCH);
        const forwardListPurified = [[`[自动屏蔽列表 (共 ${purifiedBansData.length} 项)]`]];

        for (let batchNum = 1; batchNum <= totalBatchesPurified; batchNum++) {
          const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
          const currentBatchData = purifiedBansData.slice(startIndex, startIndex + ITEMS_PER_BATCH);
          try {
            const renderDataPurifiedBatch = { pluginVersion, purifiedBans: currentBatchData, userBans: [], listType: "自动屏蔽", scaleStyleValue, batchInfo: `(第 ${batchNum} / ${totalBatchesPurified} 批)` };
            const imgBatch = await renderPageToImage(`banlist-auto-batch${batchNum}`, {
              tplFile: sourceHtmlPath, data: renderDataPurifiedBatch, imgType: "png",
              pageGotoParams: { waitUntil: "networkidle0" },
              screenshotOptions: { fullPage: true }, width: 640,
            }, this);
            if (imgBatch) { forwardListPurified.push(imgBatch); }
            else { logger.error(`${logPrefix} [封禁列表] 生成自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批截图失败。`); forwardListPurified.push(`[❌ 第 ${batchNum}/${totalBatchesPurified} 批渲染失败]`); }
          } catch (renderBatchError) { logger.error(`${logPrefix} [封禁列表] 生成自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批截图时出错:`, renderBatchError); forwardListPurified.push(`[❌ 第 ${batchNum}/${totalBatchesPurified} 批处理出错]`); await this.ReportError(e, `生成自动屏蔽列表 (批次 ${batchNum})`, renderBatchError); }
        }
        if (forwardListPurified.length > 1) {
          try { const forwardMsgPurified = await common.makeForwardMsg(e, forwardListPurified, "自动屏蔽列表详情"); if (forwardMsgPurified) await e.reply(forwardMsgPurified); else { logger.error(`${logPrefix} [封禁列表] 创建自动屏蔽列表合并消息失败。`); await e.reply("生成合并的自动屏蔽列表消息失败 (内部错误)。", true); } }
          catch (sendForwardError) { logger.error(`${logPrefix} [封禁列表] 发送自动屏蔽列表合并消息失败:`, sendForwardError); await e.reply("发送合并的自动屏蔽列表消息失败，请查看日志。", true); }
        }
      }
      if (userBansData.length === 0 && purifiedBansData.length === 0 && !manualSent) await e.reply("当前没有手动封禁，也没有被自动规则屏蔽的图片。", true);
      else if (userBansData.length > 0 && !manualSent) await e.reply("生成手动封禁列表图片失败了，请检查日志。", true);
      return true;
    }

    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i);
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i);
    if (addMatch || delMatch) {
      const isAdding = !!addMatch;
      const targetIdentifierRaw = (isAdding ? addMatch[1] : delMatch[1]).trim();
      const actionVerb = isAdding ? "封禁" : "解禁";
      if (!targetIdentifierRaw) return e.reply(`要${actionVerb}哪个图片呀？格式：#咕咕牛${actionVerb}角色名+编号`, true);
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw);
      if (!parsedId) return e.reply("格式好像不对哦，应该是 角色名+编号", true);
      const { mainName: rawMainName, imageNumber } = parsedId;
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, logger);
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName;
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`;
      const imageData = MiaoPluginMBT._imgDataCache.find((img) => img.characterName === standardMainName && img.path?.toLowerCase().replace(/\\/g, "/").endsWith(`/${expectedFilenameLower}`));
      if (!imageData || !imageData.path) {
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)`;
        const roleExistsInData = MiaoPluginMBT._imgDataCache.some((img) => img.characterName === standardMainName);
        if (!roleExistsInData && MiaoPluginMBT._imgDataCache.length > 0) hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)`;
        else if (roleExistsInData) hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)`;
        else if (MiaoPluginMBT._imgDataCache.length === 0) hint = `(图库元数据当前为空)`;
        return e.reply(`在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`, true);
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
      const imgData = MiaoPluginMBT._imgDataCache.find((img) => img.path?.replace(/\\/g, "/") === targetRelativePath);
      if (currentPFL > Purify_Level.NONE && imgData && MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, currentPFL)) {
        replyMsg = `⚠️ ${targetFileName} 受到当前的净化规则 (等级 ${currentPFL}) 屏蔽，无法进行手动${actionVerb}操作。`;
        //logger.warn(`${logPrefix} [${actionVerb}] 操作被阻止，因为图片 ${targetFileName} 被 PFL ${currentPFL} 屏蔽。`);
        await e.reply(replyMsg, true); return;
      }
      const isCurrentlyUserBanned = MiaoPluginMBT._userBanSet.has(targetRelativePath);
      if (isAdding) {
        if (isCurrentlyUserBanned) replyMsg = `${targetFileName} ❌️ 封禁已存在哦。`;
        else {
          try {
            MiaoPluginMBT._userBanSet.add(targetRelativePath); configChanged = true;
            //logger.info(`${logPrefix} [${actionVerb}] 添加到内存封禁列表: ${targetRelativePath}`);  //调式日志
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) { logger.error(`${logPrefix} [${actionVerb}] 保存用户封禁列表失败！`); MiaoPluginMBT._userBanSet.delete(targetRelativePath); replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`; configChanged = false; await this.ReportError(e, `${actionVerb}图片`, new Error("保存封禁列表失败")); }
            else replyMsg = `${targetFileName} 🚫 封禁了~`;
          } catch (err) { logger.error(`${logPrefix} [${actionVerb}] 添加封禁时发生内部错误:`, err); replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; configChanged = false; await this.ReportError(e, `${actionVerb}图片`, err); }
        }
      } else {
        if (!isCurrentlyUserBanned) replyMsg = `${targetFileName} ❓ 没找到哦~`;
        else {
          try {
            MiaoPluginMBT._userBanSet.delete(targetRelativePath); configChanged = true; needsRestore = true;
            //logger.info(`${logPrefix} [${actionVerb}] 从内存封禁列表移除: ${targetRelativePath}`);   //调式日志
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) { logger.error(`${logPrefix} [${actionVerb}] 保存用户封禁列表失败！`); MiaoPluginMBT._userBanSet.add(targetRelativePath); replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`; configChanged = false; needsRestore = false; await this.ReportError(e, `${actionVerb}图片`, new Error("保存封禁列表失败")); }
            else replyMsg = `${targetFileName} ✅️ 好嘞，解封!`;
          } catch (err) { logger.error(`${logPrefix} [${actionVerb}] 解禁时发生内部错误:`, err); if (!MiaoPluginMBT._userBanSet.has(targetRelativePath)) MiaoPluginMBT._userBanSet.add(targetRelativePath); replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; configChanged = false; needsRestore = false; await this.ReportError(e, `${actionVerb}图片`, err); }
        }
      }
    } catch (error) { logger.error(`${logPrefix} [${actionVerb}] 处理时发生意外错误:`, error); await this.ReportError(e, `${actionVerb}图片`, error, `目标: ${targetFileName}`); configChanged = false; needsRestore = false; replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`; }
    await e.reply(replyMsg, true);
    if (configChanged && saved) {
      setImmediate(async () => {
        try {
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
          if (needsRestore) {
            const restored = await MiaoPluginMBT.RestoreFileFromSource(targetRelativePath, logger);
            if (!restored) logger.warn(`${logPrefix} [解禁] 尝试恢复 ${targetFileName} 失败 (可能源文件丢失)。`);
            else logger.info(`${logPrefix} [解禁] 文件 ${targetFileName} 已尝试恢复。`);
          }
        } catch (err) { logger.error(`${logPrefix} [${actionVerb}] 后台应用生效列表或恢复文件时出错:`, err); await this.ReportError(e, `${actionVerb}图片 (后台任务)`, err); }
      });
    }
  }

  async FindRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) {
      return e.reply("『咕咕牛』核心库还没下载呢！", true);
    }

    const msgMatch = e.msg.match(/^#(?:查看|view)\s*(.+)$/i);
    if (!msgMatch?.[1]) {
      return e.reply("想看哪个角色呀？格式：#查看 角色名", true);
    }

    const roleNameInput = msgMatch[1].trim();
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    try {
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(roleNameInput, logger);
      const standardMainName = aliasResult.exists ? aliasResult.mainName : roleNameInput;

      const rawRoleImageData = MiaoPluginMBT._imgDataCache.filter((img) =>
        img.characterName === standardMainName && img.path && typeof img.path === 'string'
      );

      if (rawRoleImageData.length === 0) {
        const dirExists = await MiaoPluginMBT.CheckRoleDirExists(standardMainName);
        if (dirExists) {
          return e.reply(`『${standardMainName}』的角色文件夹在，但是图库元数据里没有该角色的图片信息哦。`);
        }
        return e.reply(`图库里好像没有『${standardMainName}』这个角色呢。`);
      }

      rawRoleImageData.sort((a, b) =>
        parseInt(a.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0") -
        parseInt(b.path.match(/Gu(\d+)\.webp$/i)?.[1] || "0")
      );

      const ITEMS_PER_BATCH = 28; 
      const totalItems = rawRoleImageData.length;
      const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH);

      if (totalItems > 0 && totalBatches > 1) {
        await e.reply(`正在为『${standardMainName}』整理 ${totalItems} 张图片，共 ${totalBatches} 批，请稍候...`, true);
      }


      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
        const currentBatchData = rawRoleImageData.slice(startIndex, startIndex + ITEMS_PER_BATCH);
        const makeForwardMsgTitle = `[${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`;
        
        const forwardListBatch = []; 
        if (batchNum === 1) {
          forwardListBatch.push(`查看『${standardMainName}』 (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`);
          if (totalItems > 0) {
            forwardListBatch.push(`想导出图片？试试: #咕咕牛导出${standardMainName}1`);
          }
        } else {
          forwardListBatch.push(`查看『${standardMainName}』(续) (${startIndex + 1}-${Math.min(startIndex + currentBatchData.length, totalItems)} / ${totalItems} 张)`);
        }

        for (let i = 0; i < currentBatchData.length; i++) {
          const item = currentBatchData[i];
          const itemGlobalIndex = startIndex + i + 1; // 计算全局序号
          const relativePath = item.path.replace(/\\/g, "/");
          const fileName = path.basename(relativePath);
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
          
          const messageNode = []; // 每个节点的 message 数组
          let fileExistsAndAccessible = false;
          let fileSizeFormatted = "";

          if (absolutePath) {
            try {
              await fsPromises.access(absolutePath, fs.constants.R_OK);
              messageNode.push(segment.image(`file://${absolutePath}`));
              fileExistsAndAccessible = true;
              try {
                  const stats = await fsPromises.stat(absolutePath);
                  fileSizeFormatted = FormatBytes(stats.size);
              } catch (statErr) {
                  logger.warn(`${logPrefix} [查看] 获取文件大小失败: ${absolutePath}`, statErr.code);
              }
            } catch (accessErr) {
              logger.warn(`${logPrefix} [查看] 图片文件无法访问: ${absolutePath}`, accessErr.code);
              messageNode.push(`[图片无法加载: ${fileName}]`);
            }
          } else {
            logger.warn(`${logPrefix} [查看] 图片文件丢失: ${relativePath}`);
            messageNode.push(`[图片文件丢失: ${fileName}]`);
          }
          
          const textInfoLines = [];
          textInfoLines.push(`${itemGlobalIndex}. ${fileName}`); // 添加序号和文件名

          const tags = [];
          if (item.attributes?.isAiImage === true) tags.push("Ai");
          if (item.attributes?.isEasterEgg === true) tags.push("彩蛋");
          if (tags.length > 0) {
            textInfoLines.push(`Tag：${tags.join(", ")}`);
          }

          if (fileSizeFormatted) { // 只在获取到大小后显示
            textInfoLines.push(`占用：${fileSizeFormatted}`);
          }
          
          const constraints = [];
          const isUserBanned = MiaoPluginMBT._userBanSet.has(relativePath);
          
          // 重新进行净化判断逻辑 
          let isAutoPurifiedByRule = false; 
          const currentPFL = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
          const imgDataForPurifyCheck = MiaoPluginMBT._imgDataCache.find(img => img.path?.replace(/\\/g, "/") === relativePath);

          if (imgDataForPurifyCheck) {
            if (MiaoPluginMBT.CheckIfPurifiedByLevel(imgDataForPurifyCheck, currentPFL)) {
                isAutoPurifiedByRule = true;
            }
            if (!isAutoPurifiedByRule && MiaoPluginMBT.MBTConfig?.Ai === false && imgDataForPurifyCheck.attributes?.isAiImage === true) isAutoPurifiedByRule = true;
            if (!isAutoPurifiedByRule && MiaoPluginMBT.MBTConfig?.EasterEgg === false && imgDataForPurifyCheck.attributes?.isEasterEgg === true) isAutoPurifiedByRule = true;
            if (!isAutoPurifiedByRule && MiaoPluginMBT.MBTConfig?.layout === false && imgDataForPurifyCheck.attributes?.layout === "fullscreen") isAutoPurifiedByRule = true;
          }


          if (isUserBanned) constraints.push("❌封禁");
          // 只有当它是因为自动规则而被屏蔽，并且用户没有手动封禁它时，才单独显示净化
          // 只要符合净化规则就显示净化标记，即使用户也封禁了它，那么可以简化
          if (isAutoPurifiedByRule) {
             // 检查是否因为PFL等级被净化，如果是，可以附加等级
            let pflLevelAppliedText = "";
            if (imgDataForPurifyCheck && currentPFL > Purify_Level.NONE) {
                 if (MiaoPluginMBT.CheckIfPurifiedByLevel(imgDataForPurifyCheck, Purify_Level.PX18_PLUS) && currentPFL === Purify_Level.PX18_PLUS) {
                    pflLevelAppliedText = `(Lv2)`;
                 } else if (MiaoPluginMBT.CheckIfPurifiedByLevel(imgDataForPurifyCheck, Purify_Level.RX18_ONLY) && currentPFL >= Purify_Level.RX18_ONLY) {
                    pflLevelAppliedText = `(Lv1)`;
                 }
            }
            constraints.push(`🌱净化${pflLevelAppliedText}`);
          }
          
          if (constraints.length > 0) {
            textInfoLines.push(`约束:  ${constraints.join("     ")}`); 
          }
          
          messageNode.push(textInfoLines.join("\n")); 
          
          forwardListBatch.push(messageNode);
        }

        if (forwardListBatch.length > (batchNum === 1 ? 2 : 1)) { 
          try {
            const forwardMsg = await common.makeForwardMsg(e, forwardListBatch, makeForwardMsgTitle);
            if (forwardMsg) {
              await e.reply(forwardMsg);
            } else {
              logger.error(`${logPrefix} [查看] common.makeForwardMsg 返回空 (批次 ${batchNum}) 用户 ${e.user_id}`);
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批图片列表失败了 (内部错误)。`, true);
            }
          } catch (sendError) {
            logger.error(`${logPrefix} [查看] 发送第 ${batchNum}/${totalBatches} 批合并转发消息失败: 用户 ${e.user_id}`, sendError);
            await e.reply(`发送第 ${batchNum}/${totalBatches} 批图片列表失败了，请检查后台日志。`, true);
          }
          if (batchNum < totalBatches && totalBatches > 1) await common.sleep(1800);
        } else if (totalItems === 0 && batchNum === 1 && forwardListBatch.length <=2 ){ 
             // 确保只有在确实没有图片内容时才发送“图库中没有图片”
             // (forwardListBatch 长度可能为1或2，取决于是否有导出提示)
             let hasActualContent = false;
             for(let k = (batchNum === 1 ? 2:1) ; k < forwardListBatch.length; k++){
                 if(forwardListBatch[k] && forwardListBatch[k].length > 0){
                     hasActualContent = true;
                     break;
                 }
             }
             if(!hasActualContent){
                await e.reply(`『${standardMainName}』图库中没有图片。`, true);
             }
        }
      }
    } catch (error) {
      logger.error(`${logPrefix} [查看] 处理角色 '${roleNameInput}' 时发生错误: 用户 ${e.user_id}`, error);
      await this.ReportError(e, `查看角色 ${roleNameInput}`, error);
    }
    return true;
  }

  async VisualizeRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;

    const match = e.msg.match(/^#可视化\s*(.+)$/i);
    if (!match?.[1]) return e.reply("想可视化哪个角色呀？格式：#可视化角色名", true);
    const roleNameInput = match[1].trim();

    let standardMainName = "";
    const logger = this.logger; const logPrefix = this.logPrefix;
    const BATCH_SIZE = 28;

    try {
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(roleNameInput, logger);
      standardMainName = aliasResult.mainName || roleNameInput;

      let roleFolderPath = null;
      const targetDirsToCheck = [MiaoPluginMBT.paths.target.miaoChar, MiaoPluginMBT.paths.target.zzzChar, MiaoPluginMBT.paths.target.wavesChar].filter(Boolean);
      for (const targetDir of targetDirsToCheck) {
        if (!targetDir) continue;
        const potentialPath = path.join(targetDir, standardMainName);
        try { await fsPromises.access(potentialPath); const stats = await fsPromises.stat(potentialPath); if (stats.isDirectory()) { roleFolderPath = potentialPath; break; } }
        catch (err) { if (err.code !== ERROR_CODES.NotFound) logger.warn(`${logPrefix} [可视化] 访问目标路径 ${potentialPath} 时出错 (非ENOENT):`, err.code); }
      }

      if (!roleFolderPath) { logger.warn(`${logPrefix} [可视化] 未在任何目标插件目录中找到角色 '${standardMainName}' 的文件夹。`); return e.reply(`『${standardMainName}』不存在，可能是未同步/无该角色？`); }

      const supportedExtensions = [".jpg", ".png", ".jpeg", ".webp", ".bmp"];
      let allImageFiles = [];
      try { const files = await fsPromises.readdir(roleFolderPath); allImageFiles = files.filter((file) => supportedExtensions.includes(path.extname(file).toLowerCase())); }
      catch (readErr) { logger.error(`${logPrefix} [可视化] 读取角色文件夹失败: ${roleFolderPath}`, readErr); await this.ReportError(e, `可视化角色 ${standardMainName}`, readErr, "读取角色文件夹失败"); return true; }

      if (allImageFiles.length === 0) { logger.warn(`${logPrefix} [可视化] 角色文件夹 ${roleFolderPath} 为空或不包含支持的图片格式。`); return e.reply(`『${standardMainName}』的文件夹里没有找到支持的图片文件哦。`); }

      allImageFiles.sort((a, b) => { const numA = parseInt(a.match(/(\d+)\.\w+$/)?.[1] || "0"); const numB = parseInt(b.match(/(\d+)\.\w+$/)?.[1] || "0"); if (numA === numB) return a.localeCompare(b); return numA - numB; });

      const totalImageCount = allImageFiles.length;
      const totalBatches = Math.ceil(totalImageCount / BATCH_SIZE);
      await e.reply(`[${standardMainName} ] 有 ${totalImageCount} 张面板图\n分 ${totalBatches} 批发送, 请注意查收~`, true);
      await common.sleep(500);

      let sourceTplFilePath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "visualize.html");
      try { await fsPromises.access(sourceTplFilePath); }
      catch (commonErr) {
        if (commonErr.code === ERROR_CODES.NotFound) {
          logger.warn(`${logPrefix} [可视化] 公共资源模板 (${sourceTplFilePath}) 未找到，尝试插件资源目录...`);
          sourceTplFilePath = path.resolve(__dirname, "..", "resources", "GuGuNiu-Gallery", "html", "visualize.html");
          try { await fsPromises.access(sourceTplFilePath); }
          catch (pluginErr) { logger.error(`${logPrefix} [可视化] 主模板和备用模板均未找到: ${sourceTplFilePath}`, pluginErr); await e.reply("生成可视化图片失败：缺少必要的 visualize.html 模板文件。"); return true; }
        } else { logger.error(`${logPrefix} [可视化] 访问公共资源模板时出错: ${sourceTplFilePath}`, commonErr); await e.reply("生成可视化图片失败：访问模板文件时出错。"); return true; }
      }

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        try {
          const startIndex = (batchNum - 1) * BATCH_SIZE;
          const currentBatchFiles = allImageFiles.slice(startIndex, startIndex + BATCH_SIZE);
          //logger.info(`${logPrefix} [可视化] 正在生成第 ${batchNum}/${totalBatches} 批 (${currentBatchFiles.length} 张图片)...`);  //调式日志
          const imagesDataForRender = currentBatchFiles.map((fileName, index) => ({ fileName: fileName.replace(/\.\w+$/, ""), filePath: `file://${path.join(roleFolderPath, fileName).replace(/\\/g, "/")}`, originalIndex: startIndex + index, isGu: /gu/i.test(fileName) }));
          const renderData = { pluginVersion: MiaoPluginMBT.GetVersionStatic(), characterName: standardMainName, imageCount: totalImageCount, images: imagesDataForRender, batchNum, totalBatches, batchStartIndex: startIndex, scaleStyleValue: MiaoPluginMBT.getScaleStyleValue() };

          const imageBuffer = await renderPageToImage(`visualize-${standardMainName}-batch${batchNum}`, {
            tplFile: sourceTplFilePath, data: renderData, imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0", timeout: 45000 },
            screenshotOptions: { fullPage: true }, width: 800,
          }, this);

          if (imageBuffer) { await e.reply(imageBuffer); }
          else { logger.error(`${logPrefix} [可视化] 第 ${batchNum}/${totalBatches} 批截图生成失败或返回空。`); if (batchNum === 1 && totalBatches === 1) await e.reply(`生成预览图失败了，请查看控制台日志。`); }
        } catch (batchProcessingError) { logger.error(`${logPrefix} [可视化] 处理第 ${batchNum}/${totalBatches} 批时发生错误:`, batchProcessingError); await e.reply(`处理第 ${batchNum}/${totalBatches} 批数据时出错，跳过此批次。`); }
        finally { if (batchNum < totalBatches) await common.sleep(2500); }
      }
    } catch (error) { logger.error(`${logPrefix} [可视化] 处理角色 '${roleNameInput}' 时发生顶层错误:`, error); await this.ReportError(e, `可视化角色 ${roleNameInput}`, error); }
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
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger);
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
      try { fileBuffer = await fsPromises.readFile(absolutePath); if (!fileBuffer || fileBuffer.length === 0) throw new Error("读取到的文件 Buffer 为空"); this.logger.info(`${this.logPrefix} [导出] 成功读取文件到 Buffer: ${targetFileName}, 大小: ${fileBuffer.length} bytes`); }
      catch (readError) { this.logger.error(`${this.logPrefix} [导出] 读取文件失败: ${absolutePath}`, readError); await this.ReportError(e, `导出文件 ${targetFileName}`, readError, "读取文件失败"); return true; }

      await e.reply(`📦 导出成功！给你 -> ${targetFileName}`);
      await common.sleep(200);
      await e.reply(segment.file(fileBuffer, targetFileName));
    } catch (sendErr) {
      this.logger.error(`${this.logPrefix} 导出 ${targetFileName || targetIdentifierRaw} 时发送失败:`, sendErr);
      try {
        if (sendErr?.message?.includes("highway") || sendErr?.message?.includes("file size") || sendErr?.code === -36 || sendErr?.code === 210005 || sendErr?.code === 210003) await e.reply(`发送文件失败了,文件通道好像出了点问题 (${sendErr.code || "未知代码"})，可能是文件太大、网络不好或者被QQ限制了。`, true);
        else await this.ReportError(e, `导出文件 ${targetFileName || targetIdentifierRaw}`, sendErr);
      } catch (replyError) { this.logger.error(`${this.logPrefix} 发送导出失败提示时也出错:`, replyError); }
    }
    return true;
  }

  async Help(e) {
    const networkHelpUrl = "https://s2.loli.net/2025/05/05/zirbKvjTAByl3HS.webp";
    const localHelpPath = MiaoPluginMBT.paths.helpImagePath;
    try {
      await fsPromises.access(localHelpPath, fs.constants.R_OK);
      await e.reply(segment.image(`file://${localHelpPath}`));
    } catch (localError) {
      if (localError.code !== ERROR_CODES.NotFound) this.logger.warn(`${this.logPrefix} [帮助] 访问本地帮助图片失败:`, localError.code);
      this.logger.info(`${this.logPrefix} [帮助] 本地帮助图 (${localHelpPath}) 加载失败，尝试发送在线版本...`);
      try { await e.reply(segment.image(networkHelpUrl)); }
      catch (networkError) {
        this.logger.error(`${this.logPrefix} [帮助] 发送在线帮助图片也失败了:`, networkError.message);
        await e.reply(
          `${this.logPrefix} 哎呀，帮助图片加载不出来...\n` +
          `主要命令有这些：\n` +
          `#下载咕咕牛 (主人用)\n` +
          `#更新咕咕牛 (主人用)\n` +
          `#重置咕咕牛 (主人用, 清空所有!)\n` +
          `#检查咕咕牛 (看状态)\n` +
          `#查看 [角色名] (看某个角色的图)\n` +
          `#咕咕牛封禁 [角色名+编号] (主人用, 例: #咕咕牛封禁 花火1)\n` +
          `#咕咕牛解禁 [角色名+编号] (主人用)\n` +
          `#ban列表 (看哪些图被屏蔽了)\n` +
          `#咕咕牛设置 (查看设置面板)\n` +
          `#咕咕牛设置[ai|彩蛋|横屏|净化等级|pm18][开启|关闭|0|1|2] (主人用)\n` +
          `#咕咕牛导出 [角色名+编号] (导出图片文件)\n` +
          `#咕咕牛测速 (测下载速度)\n` +
          `#执行咕咕牛更新 (主人用, 手动执行定时更新任务)`
        );
      }
    }
    return true;
  }

  async TriggerError(e) {
    if (!e.isMaster) return e.reply("仅限主人测试。", true);
    const match = e.msg.match(/#咕咕牛触发错误(?:\s*([a-zA-Z0-9_-]+))?/i);
    const triggerInput = match?.[1]?.trim() || "";
    this.logger.warn(`${this.logPrefix} 用户 ${e.user_id} 触发模拟错误，输入: "${triggerInput}"...`);

    let itemToTrigger = null;
    if (triggerInput) {
      const lowerInput = triggerInput.toLowerCase();
      itemToTrigger = TRIGGERABLE_ITEMS.find(item => String(item.id) === triggerInput);
      if (!itemToTrigger) itemToTrigger = TRIGGERABLE_ITEMS.find(item => item.type.toLowerCase() === lowerInput);
      if (!itemToTrigger) itemToTrigger = TRIGGERABLE_ITEMS.find(item => item.name.toLowerCase().includes(lowerInput));
    }

    if (!itemToTrigger) {
      let availableTriggers = "可用错误触发类型 (输入ID或名称):\n";
      TRIGGERABLE_ITEMS.forEach(item => { availableTriggers += `${item.id}. ${item.name} (${item.category})\n  描述: ${item.description}\n`; });
      availableTriggers += "\n兼容旧关键字: git, fs, config, data, ref, type, Repo1, Repo2, notify, intermediate, other";
      try { const fwd = await common.makeForwardMsg(e, [availableTriggers.trim()], "咕咕牛可触发错误列表"); await e.reply(fwd); }
      catch { await e.reply(availableTriggers.substring(0, 500) + "...", true); }
      return true;
    }

    await e.reply(`${this.logPrefix} 正在尝试触发: [${itemToTrigger.id}] ${itemToTrigger.name}...`, true);
    let mockError = new Error(`模拟错误 (${itemToTrigger.type}): ${itemToTrigger.description}`);

    try {
      switch (itemToTrigger.type) {
        case "THROW_GIT_AUTH_FAIL": mockError.message = "模拟Git认证失败"; mockError.code = 128; mockError.stderr = "fatal: Authentication failed for 'https://example.com'"; throw mockError;
        case "THROW_NET_TIMEOUT": mockError.code = ERROR_CODES.Timeout; mockError.message = "模拟网络请求超时"; throw mockError;
        case "THROW_FS_EACCES": mockError = new Error("模拟FS权限错误"); mockError.code = ERROR_CODES.Access; await fsPromises.writeFile("/root/test.txt", "test"); break;
        case "THROW_FS_ENOENT": mockError = new Error("模拟FS路径未找到"); mockError.code = ERROR_CODES.NotFound; await fsPromises.access("/path/to/a/ghost/town"); break;
        case "THROW_RENDER_TEMPLATE_DATA_ERROR": mockError.message = "模拟截图模板数据错误"; await renderPageToImage("test-render-data-error", { htmlContent: "<div>{{ undefinedVariable }}</div>", data: {} }, this); throw mockError;
        case "THROW_RENDER_TIMEOUT": mockError.message = "模拟截图渲染超时"; await renderPageToImage("test-render-timeout", { htmlContent: "<div>Hang forever</div>", data: {}, pageGotoParams: { timeout: 10, waitUntil: "domcontentloaded" } }, this); throw mockError;
        case "THROW_CONFIG_YAML_PARSE_ERROR": yaml.parse("invalid: yaml: here"); break;
        case "THROW_DATA_JSON_PARSE_ERROR": JSON.parse("{not_json: true,"); break;
        case "THROW_PM18_PROCESS_ERROR": mockError.message = "模拟PM18处理失败"; throw mockError;
        case "THROW_GENERAL_ERROR": throw new Error("一个意想不到的通用错误发生了！救命啊！");

        case "SIMULATE_REPORT_DL_FINAL_MIXED_RESULT": {
          const reportData = {
            coreRepoResult: {
              success: true,
              nodeName: "Moeyy",
              gitLog: "最新提交: xxx"
            },
            subsidiaryResults: [{
              repo: 2,
              success: false,
              nodeName: "Ghfast",
              error: { message: "超时了" },
              gitLog: null
            }, {
              repo: 3, success: true, nodeName: "本地", gitLog: "已存在"
            }],
            duration: "12.3", pluginVersion: "4.9.5", scaleStyleValue: ""
          };
          const img = await renderPageToImage("dl-report-mixed", { htmlContent: DOWNLOAD_REPORT_HTML_TEMPLATE, data: reportData }, this);
          if (img) await e.reply(["模拟下载报告(混合结果):", img]); else await e.reply("模拟下载报告(混合结果)图片生成失败");
          return true;
        }
        // 更多报告模拟case...

        case "SIMULATE_LOGIC_RENDER_BLANK_IMAGE":
          this.logger.error("模拟截图返回空值...");
          await e.reply("模拟：截图返回了空图片，功能可能失败。", true);
          return true;
        case "SIMULATE_LOGIC_CONFIG_RECOVER_NOTIFY":
          this.logger.warn("模拟：配置文件损坏，已从备份恢复并通知主人。");
          await MiaoPluginMBT.SendMasterMsg("模拟：您的咕咕牛配置文件已从备份恢复。", e, 0, this.logger);
          return true;

        // 旧关键字兼容
        case "git": mockError.message = "兼容旧关键字：模拟Git失败"; mockError.code = 128; mockError.stderr = "fatal: Old keyword git error"; throw mockError;
        case "fs": mockError = new Error("兼容旧关键字：模拟FS路径未找到"); mockError.code = ERROR_CODES.NotFound; await fsPromises.access("/old/fs/trigger"); break;
        default: throw new Error(`未处理的触发类型: ${itemToTrigger.type}`);
      }
    } catch (error) {
      await this.ReportError(e, `模拟错误 (${itemToTrigger.name || triggerInput})`, error, `用户触发: ${e.msg}`);
    }
    return true;
  }

  async ManualTestProxies(e) {
    if (!(await this.CheckInit(e))) return true;
    await e.reply(`收到！开始火力全开测试网络节点🚀🚀🚀🚀🚀🚀🚀🚀🚀...`, true);
    const startTime = Date.now();
    let speeds1 = []; let best1Display = "无可用源";
    const logger = this.logger; const logPrefix = this.logPrefix;
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "speedtest.html");

    try {
      try { await fsPromises.access(sourceHtmlPath); }
      catch (err) { logger.error(`${logPrefix} [测速] 找不到外部模板文件: ${sourceHtmlPath}`, err); await e.reply("生成测速报告失败：缺少 speedtest.html 模板文件。").catch(() => { }); return true; }

      speeds1 = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, logger);
      const available1 = MiaoPluginMBT.GetSortedAvailableSources(speeds1, true, logger);
      const best1Raw = available1[0] || null;
      if (best1Raw) {
        let speedInfo = "N/A";
        if (best1Raw.testUrlPrefix !== null) speedInfo = Number.isFinite(best1Raw.speed) && best1Raw.speed >= 0 ? `${best1Raw.speed}ms` : "超时";
        best1Display = `${best1Raw.name}(${speedInfo})`;
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const processSpeeds = (speeds) => speeds.map((s) => ({ ...s, statusText: s.testUrlPrefix === null ? "na" : Number.isFinite(s.speed) && s.speed >= 0 ? "ok" : "timeout" })).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || (a.speed === Infinity || a.statusText === "na" ? 1 : b.speed === Infinity || b.statusText === "na" ? -1 : a.speed - b.speed));
      const processedSpeedsResult = processSpeeds(speeds1);
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();
      const renderData = { speeds1: processedSpeedsResult, best1Display: best1Display, duration, scaleStyleValue };

      const imageBuffer = await renderPageToImage("manual-speedtest", {
        tplFile: sourceHtmlPath, data: renderData, imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        pageBoundingRect: { selector: "body", padding: 0 }, width: 540,
      }, this);

      if (imageBuffer) await e.reply(imageBuffer);
      else { logger.error(`${logPrefix} [测速] 生成截图失败 (Puppeteer 返回空)。`); await e.reply("生成测速报告图片失败了，请看看日志。"); }
    } catch (error) { await this.ReportError(e, "手动网络测速", error, `测速结果(原始): ${JSON.stringify(speeds1)}`); }
    return true;
  }

  async ShowSettingsPanel(e, statusMessageForLogAndFallback = "") {
    if (!(await this.CheckInit(e))) return true;
    const logger = this.logger; const logPrefix = this.logPrefix;
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, "html", "settings_panel.html");

    try {
      try { await fsPromises.access(sourceHtmlPath); }
      catch (err) { logger.error(`${logPrefix} [设置面板] 找不到模板文件: ${sourceHtmlPath}`, err); await e.reply("无法显示设置面板：缺少 settings_panel.html 模板文件。"); return true; }

      const config = MiaoPluginMBT.MBTConfig;
      const renderData = {
        pluginVersion: MiaoPluginMBT.GetVersionStatic(),
        tuKuStatus: { text: (config?.TuKuOP ?? Default_Config.defaultTuKuOp) ? "已启用" : "已禁用", class: (config?.TuKuOP ?? Default_Config.defaultTuKuOp) ? "value-enabled" : "value-disabled", },
        pflStatus: { level: (config?.PFL ?? Default_Config.defaultPfl), description: Purify_Level.getDescription(config?.PFL ?? Default_Config.defaultPfl), class: `value-level-${config?.PFL ?? Default_Config.defaultPfl}`, },
        aiStatus: { text: (config?.Ai ?? true) ? "已开启" : "已关闭", class: (config?.Ai ?? true) ? "value-enabled" : "value-disabled", },
        easterEggStatus: { text: (config?.EasterEgg ?? true) ? "已开启" : "已关闭", class: (config?.EasterEgg ?? true) ? "value-enabled" : "value-disabled", },
        layoutStatus: { text: (config?.layout ?? true) ? "已开启" : "已关闭", class: (config?.layout ?? true) ? "value-enabled" : "value-disabled", },
        PM18Status: { text: (config?.PM18 ?? false) ? "已开启" : "已关闭", class: (config?.PM18 ?? false) ? "value-enabled" : "value-disabled", },
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
      };

      const imageBuffer = await renderPageToImage("settings-panel", {
        tplFile: sourceHtmlPath, data: renderData, imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        pageBoundingRect: { selector: ".panel", padding: 15 }, width: 480,
      }, this);

      if (imageBuffer) {
        await e.reply(imageBuffer);
        if (statusMessageForLogAndFallback) {
          //logger.info(`${logPrefix} [设置面板状态日志] ${statusMessageForLogAndFallback}`);  //调式日志
        }
      } else {
        //logger.error(`${logPrefix} [设置面板] Puppeteer 未能成功生成图片 (返回空)。`);  //调式日志
        // let fallbackMsg = "生成设置面板图片失败，请查看日志。";
        // if (statusMessageForLogAndFallback) { 
        //     fallbackMsg = `${statusMessageForLogAndFallback}\n但设置面板图片生成失败，请查看日志。`;
        // }
        // await e.reply(fallbackMsg, true);
        //调式日志
      }
    } catch (error) {
      logger.error(`${logPrefix} [设置面板] 生成或发送面板时发生错误:`, error);
      let errorReportMsg = "显示设置面板时发生内部错误。";
      if (statusMessageForLogAndFallback) {
        errorReportMsg = `${statusMessageForLogAndFallback}\n且显示设置面板时发生内部错误。`;
      }
      await this.ReportError(e, "显示设置面板", error, errorReportMsg);
    }
    return true;
  }

  async HandleSettingsCommand(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${this.logPrefix} 只有主人才能使用设置命令哦~`);

    const match = e.msg.match(/^#咕咕牛设置(ai|彩蛋|横屏|净化等级|pm18)([012]|开启|关闭)$/i);
    if (!match || !match[1] || !match[2]) { this.logger.warn(`${this.logPrefix} [统一设置] 正则匹配异常? msg: ${e.msg}`); return false; }

    const featureKeyRaw = match[1].toLowerCase();
    const valueRaw = match[2];

    if (featureKeyRaw === "净化等级") {
      const level = parseInt(valueRaw, 10);
      if (isNaN(level) || ![0, 1, 2].includes(level)) return e.reply(`无效的净化等级值: ${valueRaw}，只能是 0, 1, 或 2。`, true);
      await this.setPurificationLevelInternal(e, level);
    } else {
      if (!["开启", "关闭"].includes(valueRaw)) { if (!(featureKeyRaw === "pm18" && ["0", "1"].includes(valueRaw))) return e.reply(`无效的操作: ${valueRaw}，请使用 '开启' 或 '关闭'。`, true); }
      const enable = valueRaw === "开启" || valueRaw === "1";
      let configKey = "", featureName = "";
      switch (featureKeyRaw) {
        case "ai": configKey = "Ai"; featureName = "Ai 图"; break;
        case "彩蛋": configKey = "EasterEgg"; featureName = "彩蛋图"; break;
        case "横屏": configKey = "layout"; featureName = "横屏图"; break;
        case "pm18": configKey = "PM18"; featureName = "PM18 功能"; break;
        default: this.logger.error(`${this.logPrefix} [统一设置] 未知的 featureKeyRaw: ${featureKeyRaw}`); return false;
      }
      await this.handleSwitchCommand(e, configKey, featureName, enable);
    }
    return true;
  }

  async setPurificationLevelInternal(e, level) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    let configChanged = false; let saveWarning = ""; let asyncError = null;
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
        logger.error(`${logPrefix} [净化设置] 保存失败，内存状态已回滚。`);
        await this.ReportError(e, "设置净化等级", new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `${logPrefix} 净化等级已设为 ${level} (${Purify_Level.getDescription(level)})。`;
      if (level === Purify_Level.PX18_PLUS) statusMessageForPanel += "\n(Px18 指轻微性暗示或低度挑逗性图片)";
      setImmediate(async () => {
        try {
          logger.info(`${logPrefix} [净化设置] 后台开始应用新的净化等级 ${level}...`);
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
          logger.info(`${logPrefix} [净化设置] 新的生效封禁列表已应用。`);
          if (MiaoPluginMBT.MBTConfig.TuKuOP) {
            logger.info(`${logPrefix} [净化设置] 图库已启用，开始重新同步角色文件夹...`);
            await MiaoPluginMBT.SyncCharacterFolders(logger);
            logger.info(`${logPrefix} [净化设置] 角色文件夹重新同步完成。`);
          } else logger.info(`${logPrefix} [净化设置] 图库已禁用，跳过角色文件夹同步。`);
        } catch (applyError) {
          logger.error(`${logPrefix} [净化设置] 后台应用或同步时出错:`, applyError);
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
      logger.error(`${logPrefix} [净化设置] 调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
    }
  }

  async handleSwitchCommand(e, configKey, featureName, enable) {
    const logger = this.logger; const logPrefix = this.logPrefix;
    let configChanged = false; let saveWarning = ""; let asyncError = null;
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
        logger.error(`${logPrefix} [${featureName}设置] 保存失败，内存状态已回滚。`);
        await this.ReportError(e, `设置${featureName}`, new Error("保存配置失败"), saveWarning);
      }
    });

    if (configChanged && !saveWarning) {
      statusMessageForPanel = `${logPrefix} ${featureName}已成功设为「${enable ? "开启" : "关闭"}」。`;
      if (configKey === "PM18") {
        // logger.info(`${logPrefix} [${featureName}设置] 配置已更改，准备启动${enable ? "部署" : "清理"}任务...`);
        statusMessageForPanel += `\n⏳ ${enable ? "部署" : "清理"}任务已在后台启动...`;
        setImmediate(async () => {
          try {
            if (enable) await MiaoPluginMBT.deployPM18Files(logger);
            else await MiaoPluginMBT.cleanPM18Files(logger);
          }
          catch (pm18Error) {
            logger.error(`${logPrefix} [${featureName}设置] 后台${enable ? "部署" : "清理"}PM18文件时出错:`, pm18Error);
          }
        });
      } else {
        setImmediate(async () => {
          try {
            await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT._imgDataCache, logger);
            if (MiaoPluginMBT.MBTConfig.TuKuOP) await MiaoPluginMBT.SyncCharacterFolders(logger);
          } catch (switchApplyError) {
            //logger.error(`${logPrefix} [${featureName}设置] 后台应用新开关状态时出错:`, switchApplyError);
          }
        });
      }
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
      logger.error(`${logPrefix} [${featureName}设置] 调用ShowSettingsPanel时发生顶层意外错误:`, panelError);
    }
  }
}

// ========================================================================//
// =============================  内置触发 =================================//
// ========================================================================//
const TRIGGERABLE_ITEMS = Object.freeze([
  // --- 底层错误模拟 (ID 1-10) ---
  { id: 1, name: "Git 操作失败 (认证/访问)", category: "底层错误", description: "模拟 Git 命令认证失败或无权限。预期：命令失败，ReportError报告。", type: "THROW_GIT_AUTH_FAIL" },
  { id: 2, name: "网络连接/超时失败", category: "底层错误", description: "模拟通用网络请求超时。预期：相关操作失败，ReportError报告。", type: "THROW_NET_TIMEOUT" },
  { id: 3, name: "FS: 权限错误 (EACCES)", category: "底层错误", description: "模拟文件系统无写入/读取权限。预期：相关FS操作失败，ReportError报告。", type: "THROW_FS_EACCES" },
  { id: 4, name: "FS: 路径未找到 (ENOENT)", category: "底层错误", description: "模拟访问不存在的文件或目录。预期：相关FS操作失败，ReportError报告。", type: "THROW_FS_ENOENT" },
  { id: 5, name: "截图: 模板数据错误", category: "底层错误", description: "模拟Puppeteer渲染时模板数据缺失或错误。预期：截图失败，ReportError报告。", type: "THROW_RENDER_TEMPLATE_DATA_ERROR" },
  { id: 6, name: "截图: 渲染超时", category: "底层错误", description: "模拟Puppeteer截图操作超时。预期：截图失败，ReportError报告。", type: "THROW_RENDER_TIMEOUT" },
  { id: 7, name: "配置: YAML解析失败", category: "底层错误", description: "模拟GalleryConfig.yaml格式错误。预期：配置加载失败，ReportError或日志。", type: "THROW_CONFIG_YAML_PARSE_ERROR" },
  { id: 8, name: "数据: JSON解析失败", category: "底层错误", description: "模拟imagedata.json或banlist.json格式错误。预期：数据加载失败，ReportError或日志。", type: "THROW_DATA_JSON_PARSE_ERROR" },
  { id: 9, name: "PM18: 处理失败 (解密/写)", category: "底层错误", description: "模拟PM18文件解密或写入时出错。预期：PM18部署/清理失败，日志。", type: "THROW_PM18_PROCESS_ERROR" },
  { id: 10, name: "通用: 未知底层错误", category: "底层错误", description: "模拟一个未分类的底层异常。预期：ReportError报告。", type: "THROW_GENERAL_ERROR" },

  // --- 核心图片报告模拟 ---
  { id: 21, name: "报告: 下载完成-核心成功,附属部分失败", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：核心库成功，一个附属库失败，一个已存在。", type: "SIMULATE_REPORT_DL_FINAL_MIXED_RESULT", },
  { id: 22, name: "报告: 下载完成-全部失败", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：所有尝试的仓库均下载失败。", type: "SIMULATE_REPORT_DL_FINAL_ALL_FAIL" },
  { id: 23, name: "报告: 下载完成-全部成功", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：所有配置的仓库均下载成功。", type: "SIMULATE_REPORT_DL_FINAL_ALL_SUCCESS", },
  { id: 30, name: "报告: 更新完成-无变化", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：所有仓库均已是最新，无任何文件变更。", type: "SIMULATE_REPORT_UP_FINAL_NO_CHANGES", },
  { id: 31, name: "报告: 更新完成-核心有变(常规),附属无变", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：核心库有新的常规更新，附属库无变化。", type: "SIMULATE_REPORT_UP_FINAL_CORE_CHANGED_NORMAL", },
  { id: 32, name: "报告: 更新完成-核心强制同步,附属OK", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：核心库因冲突被强制同步 (reset --hard)，附属库正常更新或无变化。", type: "SIMULATE_REPORT_UP_FINAL_CORE_FORCED_SYNC", },
  { id: 33, name: "报告: 更新完成-核心失败,附属成功", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：核心库更新失败，附属库更新成功。", type: "SIMULATE_REPORT_UP_FINAL_CORE_FAIL_ASSIST_OK", },
  { id: 34, name: "报告: 更新完成-全部失败", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：所有仓库均更新失败。", type: "SIMULATE_REPORT_UP_FINAL_ALL_FAIL" },
  { id: 35, name: "报告: 更新完成-全部有变(常规)", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：所有配置的仓库均有新的常规更新。", type: "SIMULATE_REPORT_UP_FINAL_ALL_CHANGED_NORMAL", },

  // --- 其他业务逻辑状态 (ID 50+) ---
  { id: 50, name: "逻辑: 截图过程返回空值", category: "业务逻辑状态", description: "模拟任何截图操作后，Puppeteer 未抛错但返回了 null/undefined (可能是空白图)。预期：插件记录错误，可能回复用户生成失败。", type: "SIMULATE_LOGIC_RENDER_BLANK_IMAGE", },
  { id: 51, name: "逻辑: 配置文件恢复并通知", category: "业务逻辑状态", description: "模拟配置加载时触发恢复，成功恢复并(尝试)通知主人。预期：日志记录，主人收到私聊。", type: "SIMULATE_LOGIC_CONFIG_RECOVER_NOTIFY", },
]);

// ========================================================================//
// =============================  内置模板 =================================//
// ========================================================================//
const SPEEDTEST_HTML_TEMPLATE_LOCAL = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>咕咕牛测速报告 (下载内置)</title>
    <style>
      @font-face { font-family: 'CuteFont'; src: local('Yuanti SC'), local('YouYuan'), local('Microsoft YaHei UI Rounded'), local('Arial Rounded MT Bold'), local('Microsoft YaHei UI'), local('PingFang SC'), sans-serif; font-weight: normal; font-style: normal; }
      body { font-family: 'CuteFont', sans-serif; width:520px; margin: 20px auto; padding: 30px; background: linear-gradient(145deg, #e6f0ff 0%, #f0f9ff 100%); color: #333; font-size: 14px; line-height: 1.6; box-sizing: border-box; position: relative; overflow: hidden; }
      body::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><polygon points="40,10 70,30 70,50 40,70 10,50 10,30" fill="none" stroke="rgba(0, 172, 230, 0.25)" stroke-width="1"/><circle cx="40" cy="40" r="3" fill="rgba(255, 105, 180, 0.3)"/></svg>') repeat; opacity: 0.2; z-index: -1; }
      body::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="20" cy="20" r="4" fill="rgba(0, 230, 118, 0.2)"/><circle cx="80" cy="80" r="3" fill="rgba(255, 193, 7, 0.2)"/></svg>') repeat; opacity: 0.15; z-index: -1; }
      .container { background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 25px; box-shadow: 0 0 20px rgba(0, 172, 230, 0.2); border: 1px solid #b3e0ff; position: relative; overflow: hidden; }
      .container::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><line x1="0" y1="60" x2="120" y2="60" stroke="rgba(0, 172, 230, 0.15)" stroke-width="0.5"/><line x1="60" y1="0" x2="60" y2="120" stroke="rgba(255, 105, 180, 0.15)" stroke-width="0.5"/></svg>') repeat; opacity: 0.1; transform: rotate(45deg); z-index: -1; }
      h1 { text-align: center; color: #00acc1; margin: 0 0 20px; padding-bottom: 10px; border-bottom: 2px solid #4fc3f7; font-size: 26px; font-weight: bold; text-shadow: 0 0 5px rgba(0, 172, 230, 0.3); position: relative; }
      h2 { color: #0288d1; margin: 15px 0 10px; border-left: 4px solid #ff4081; padding-left: 10px; font-size: 18px; font-weight: bold; display: flex; align-items: center; }
      h2 .icon { margin-right: 6px; font-size: 18px; color: #ff4081; text-shadow: 0 0 3px rgba(255, 105, 180, 0.3); }
      ul { list-style: none; padding: 0; margin: 8px 0 0; }
      li { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid #e0f0ff; min-height: 20px; }
      li:last-child { border-bottom: none; margin-bottom: 0; }
      .node-name { color: #555; margin-right: 10px; white-space: nowrap; font-size: 0.95em; flex-basis: 150px; flex-shrink: 0; }
      .node-status { font-weight: bold; color: #0277bd; text-align: right; font-size: 0.9em; flex-grow: 1; }
      .status-ok { color: #00c853; background: rgba(0, 200, 83, 0.1); padding: 2px 5px; border-radius: 3px; }
      .status-timeout { color: #d81b60; background: rgba(255, 105, 180, 0.1); padding: 2px 5px; border-radius: 3px; }
      .status-na { color: #78909c; background: rgba(120, 144, 156, 0.1); padding: 2px 5px; border-radius: 3px; }
      .priority { color: #78909c; font-size: 0.85em; margin-left: 8px; font-weight: normal; }
      .best-choice { margin-top: 20px; padding: 15px; border-radius: 6px; background: linear-gradient(to bottom, #f5faff, #e6f0ff); border: 1px solid #00acc1; box-shadow: 0 0 10px rgba(0, 172, 230, 0.2); position: relative; overflow: hidden; text-align: center; font-size: 1em; color: #00c853; font-weight: bold; }
      .best-choice::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><polygon points="20,5 35,20 20,35 5,20" fill="none" stroke="rgba(255, 105, 180, 0.2)" stroke-width="0.5"/></svg>') repeat; opacity: 0.2; z-index: -1; }
      .best-choice .icon { margin-right: 6px; font-size: 1em; color: #ff4081; text-shadow: 0 0 3px rgba(255, 105, 180, 0.3); }
      .footer { text-align: center; margin-top: 25px; font-size: 0.8em; color: #78909c; border-top: 1px solid #e0f0ff; padding-top: 10px; position: relative; }
    </style>
  </head>
  <body style="{{scaleStyleValue}}">
    <div class="container">
      <h1>咕咕牛网络测速(下载内置)</h1>
      {{ if speeds1 && speeds1.length > 0 }}
      <h2><span class="icon">🌐</span>聚合仓库基准 ({{ speeds1.length }} 节点)</h2>
      <ul>
        {{ each speeds1 s }}
        <li>
          <span class="node-name">{{ s.name }}</span>
          <span class="node-status">
            {{ if s.statusText === 'ok' }}
            <span class="status-ok">{{ s.speed }}ms ✅</span>
            {{ else if s.statusText === 'na' }}
            <span class="status-na">N/A ⚠️</span>
            {{ else }}
            <span class="status-timeout">超时 ❌</span>
            {{ /if }}
            <span class="priority">(优先级: {{ s.priority ?? 'N' }})</span>
          </span>
        </li>
        {{ /each }}
      </ul>
      <div class="best-choice"><span class="icon">✅</span>优选: {{ best1Display }}</div>
      {{ /if }}
      <div class="footer">测速耗时: {{ duration }}s | By 咕咕牛</div>
    </div>
  </body>
  </html>
  `;

const DOWNLOAD_REPORT_HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>咕咕牛下载报告</title>
    <style>
        @font-face {font-family: 'CuteFont'; src: local('Yuanti SC'), local('YouYuan'), local('Microsoft YaHei UI Rounded'), local('Arial Rounded MT Bold'), local('Microsoft YaHei UI'), local('PingFang SC'), sans-serif; font-weight: normal; font-style: normal;}
        body {font-family: 'CuteFont', sans-serif; width: 550px; margin: 20px auto; padding: 20px; background: linear-gradient(145deg, #e6f0ff 0%, #f0f9ff 100%); color: #333; font-size: 14px; line-height: 1.6; box-sizing: border-box; position: relative; overflow: hidden;}
        .container {background: rgba(255, 255, 255, 0.95); border-radius: 16px; padding: 25px; box-shadow: 0 0 20px rgba(0, 172, 230, 0.2); border: 1px solid #b3e0ff; position: relative; z-index: 1;}
        .container::before {content: '🌿'; position: absolute; top: 15px; left: 15px; font-size: 24px; opacity: 0.5;}
        .container::after {content: '🌱'; position: absolute; bottom: 15px; right: 15px; font-size: 24px; opacity: 0.5; transform: rotate(15deg);}
        h1 {text-align: center; color: #00acc1; margin: 0 0 20px; padding-bottom: 10px; border-bottom: 2px solid #4fc3f7; font-size: 26px; font-weight: bold; text-shadow: 0 0 5px rgba(0, 172, 230, 0.3); position: relative;}
        .repo-section {margin-bottom: 15px; padding: 15px; border-radius: 12px; background: linear-gradient(to bottom, #f5faff, #ffffff); border: 1px solid #b3e0ff; box-shadow: 0 0 10px rgba(0, 172, 230, 0.2);}
        .repo-section.subsidiary {border: 1px solid #ff4081; box-shadow: 0 0 10px rgba(255, 105, 180, 0.2);}
        .repo-title {color: #0288d1; margin: 0 0 10px; border-left: 4px solid #ff4081; padding-left: 10px; font-size: 18px; font-weight: bold; display: flex; align-items: center;}
        .repo-title .icon {margin-right: 5px; vertical-align: -3px; font-size: 17px; color: #ff4081;}
        .repo-section.subsidiary .repo-title {color: #ff4081; border-left-color: #00acc1;}
        .repo-section.subsidiary .repo-title .icon {color: #00acc1;}
        .status-line {display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #f0f4f8; min-height: 18px;}
        .status-line:last-child {border-bottom: none; margin-bottom: 0; padding-bottom: 0;}
        .status-label {color: #555; margin-right: 8px; white-space: nowrap; font-size: 0.95em;}
        .status-value {font-weight: bold; color: #0277bd; font-size: 0.95em;}
        .status-ok {color: #00c853;}
        .status-fail {color: #d81b60;}
        .status-local {color: #0288d1;}
        .status-na {color: #78909c;}
        .error-details {font-size: 12px; white-space: pre-wrap; word-break: break-all; color: #d81b60; margin-top: 5px; padding: 8px; background-color: rgba(255, 105, 180, 0.1); border-radius: 6px; border-left: 3px solid #d81b60;}
        .log-details {margin-top: 8px;}
        .log-details h3 {color: #333; margin-bottom: 5px; font-size: 14px; font-weight: 500;}
        .log-content {font-family: 'Courier New', Courier, monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; background-color: #f9f9f9; padding: 10px; border-radius: 6px; max-height: 90px; overflow-y: auto; border: 1px solid #eee; font-weight: bold;}
        .log-content:empty::before {content: "(无相关日志记录)"; color: #aaa; font-style: italic;}
        .footer {text-align: center; margin-top: 25px; font-size: 0.8em; color: #78909c; border-top: 1px solid #e0f0ff; padding-top: 10px;}
    </style>
</head>
<body style="{{scaleStyleValue}}">
    <div class="container">
        <h1>咕咕牛图库下载完成报告</h1>
        {{ if coreRepoResult }}
        <div class="repo-section core">
            <div class="repo-title"><span class="icon">📦</span>核心仓库 (一号)</div>
            <div class="status-line"><span class="status-label">状态:</span><span class="status-value {{ coreRepoResult.success ? 'status-ok' : 'status-fail' }}">{{ coreRepoResult.success ? '下载成功' : '下载失败' }} {{ coreRepoResult.success ? '✅' : '❌' }}</span></div>
            <div class="status-line"><span class="status-label">节点:</span><span class="status-value {{ coreRepoResult.nodeName === '本地' ? 'status-local' : (coreRepoResult.success ? 'status-ok' : 'status-fail') }}">{{ coreRepoResult.nodeName }}</span></div>
            {{ if coreRepoResult.error }}
            <div class="error-details">{{ coreRepoResult.error.message || '未知错误' }}</div>
            {{ /if }}
            {{ if coreRepoResult.gitLog }}
            <div class="log-details">
                <h3>最新:</h3>
                <pre class="log-content">{{ coreRepoResult.gitLog }}</pre>
            </div>
            {{ /if }}
        </div>
        {{ /if }}
        {{ if subsidiaryResults && subsidiaryResults.length > 0 }}
        <div class="repo-section subsidiary">
            <div class="repo-title"><span class="icon">📦</span>附属仓库</div>
            {{ each subsidiaryResults subRes }}
            <div class="status-line">
                <span class="status-label">
                    {{ if subRes.repo === 2 }}二号仓库 
                    {{ else if subRes.repo === 3 }}三号仓库 
                    {{ else if subRes.repo === 4 }}四号仓库 
                    {{ else }}{{ subRes.repo }}号仓库
                    {{ /if }}:
                </span>
                <span class="status-value {{ subRes.nodeName === '本地' ? 'status-local' : (subRes.nodeName === '未配置' ? 'status-na' : (subRes.success ? 'status-ok' : 'status-fail')) }}">
                    {{ if subRes.nodeName === '本地' }}已存在
                    {{ else if subRes.nodeName === '未配置' }}未配置
                    {{ else }}{{ subRes.success ? '下载成功 (' + subRes.nodeName + ')' : '下载失败 (' + subRes.nodeName + ')' }}
                    {{ /if }}
                    {{ if subRes.success }}✅{{ else if subRes.nodeName !== '未配置' && subRes.nodeName !== '本地' }}❌{{ /if }}
                </span>
            </div>
            {{ if subRes.error }}
            <div class="error-details">{{ subRes.error.message || '未知错误' }}</div>
            {{ /if }}
            {{ if subRes.gitLog }}
            <div class="log-details">
                <h3>最新:</h3>
                <pre class="log-content">{{ subRes.gitLog }}</pre>
            </div>
            {{ /if }}
            {{ /each }}
        </div>
        {{ /if }}
        <div class="footer">总耗时: {{ duration }}s | Miao-Plugin-MBT v{{ pluginVersion }} | By 咕咕牛</div>
    </div>
</body>
</html>
`;

const GUGUNIU_RULES = [
  { reg: /^#下载咕咕牛$/i, fnc: "DownloadTuKu", permission: "master" },
  { reg: /^#更新咕咕牛$/i, fnc: "UpdateTuKu", permission: "master" },
  { reg: /^#重置咕咕牛$/i, fnc: "ManageTuKu", permission: "master" },
  { reg: /^#检查咕咕牛$/i, fnc: "CheckStatus" },
  { reg: /^#(启用|禁用)咕咕牛$/i, fnc: "ManageTuKuOption", permission: "master" },
  { reg: /^#咕咕牛封禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#咕咕牛解禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#(?:ban|咕咕牛封禁)列表$/i, fnc: "ManageUserBans" },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: "ExportSingleImage" },
  { reg: /^#查看\s*.+$/i, fnc: "FindRoleSplashes" },
  { reg: /^#可视化\s*.+$/i, fnc: "VisualizeRoleSplashes" },
  { reg: /^#咕咕牛帮助$/i, fnc: "Help" },
  { reg: /^#咕咕牛触发错误(?:\s*([a-zA-Z0-9_-]+))?$/i, fnc: "TriggerError", permission: "master" },
  { reg: /^#咕咕牛测速$/i, fnc: "ManualTestProxies" },
  { reg: /^#执行咕咕牛更新$/i, fnc: "ManualRunUpdateTask", permission: "master" },
  { reg: /^#(咕咕牛设置|咕咕牛面板)$/i, fnc: "ShowSettingsPanel" },
  { reg: /^#咕咕牛设置(ai|彩蛋|横屏|净化等级|pm18)([012]|开启|关闭)$/i, fnc: "HandleSettingsCommand", permission: "master" },
];