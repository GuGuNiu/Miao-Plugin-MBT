import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import os from 'node:os'
import yaml from 'yaml'
import common from '../../lib/common/common.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js';


/**
 * Miao-Plugin-MBT 图库管理器 - 双仓库版
 * Version: 4.7.5
 *          基于v4.1.10单仓魔改v4.6.6版本
 * Description: 结构化调试信息，角色详情转发，结构化测试日志，回滚数据，智能寻找，数据防干扰。
 */


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const YunzaiPath = path.resolve(__dirname, '..', '..')
const Purify_Level = {
  NONE: 0,
  RX18_ONLY: 1,
  PX18_PLUS: 2,
  getDescription: level => ({ 0: '不过滤', 1: '过滤 R18', 2: '过滤 R18 及 P18' }[level] ?? '未知'),
}
const RAW_URL_Repo1 = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main'
const RAW_URL_Repo2 = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT-2/main'
const Default_Config = {
  Main_Github_URL: 'https://github.com/GuGuNiu/Miao-Plugin-MBT/',
  Ass_Github_URL: 'https://github.com/GuGuNiu/Miao-Plugin-MBT-2/',
  SepositoryBranch: 'main',
  proxies: [ 
    {
        name: 'Moeyy',
        priority: 0,
        testUrlPrefix: `https://github.moeyy.xyz/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://github.moeyy.xyz/'
    },
    {
        name: 'Ghfast',
        priority: 10,
        testUrlPrefix: `https://ghfast.top/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghfast.top/'
    },
    {
        name: 'Ghp',
        priority: 20,
        testUrlPrefix: `https://ghp.ci/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghp.ci/'
    },
    {
        name: 'Ghgo',
        priority: 20,
        testUrlPrefix: `https://ghgo.xyz/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghgo.xyz/'
    },
    {
        name: 'Yumenaka',
        priority: 30,
        testUrlPrefix: `https://git.yumenaka.net/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://git.yumenaka.net/'
    },
    {
        name: 'GhConSh',
        priority: 35,
        testUrlPrefix: `https://gh.con.sh/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://gh.con.sh/'
    },
    {
        name: 'GhpsCc',
        priority: 45,
        testUrlPrefix: `https://ghps.cc/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghps.cc/'
    },
    {
        name: 'GhproxyCom',
        priority: 50,
        testUrlPrefix: `https://ghproxy.com/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghproxy.com/'
    },
    {
        name: 'GhproxyNet',
        priority: 50,
        testUrlPrefix: `https://ghproxy.net/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://ghproxy.net/'
    },
    {
        name: 'GhDdlcTop',
        priority: 55,
        testUrlPrefix: `https://gh.ddlc.top/${RAW_URL_Repo1}`,
        cloneUrlPrefix: 'https://gh.ddlc.top/'
    },
    {
        name: 'GitClone',
        priority: 70,
        testUrlPrefix: null,
        cloneUrlPrefix: 'https://gitclone.com/'
    },
    {
        name: 'Gitmirror',
        priority: 80,
        testUrlPrefix: `https://raw.gitmirror.com/GuGuNiu/Miao-Plugin-MBT/main`,
        cloneUrlPrefix: 'https://hub.gitmirror.com/'
    },
    {
        name: 'GitHub',
        priority: 300,
        testUrlPrefix: RAW_URL_Repo1,
        cloneUrlPrefix: 'https://github.com/'
    }
  ], 
  proxyTestFile: '/README.md',
  proxyTestTimeout: 5000,
  gitCloneTimeout: 600000,
  gitPullTimeout: 120000,
  gitCloneDepth: 1,
  cronUpdate: '0 5 */3 * *',
  defaultTuKuOp: true,
  defaultPfl: Purify_Level.NONE,
  logPrefix: '『咕咕牛🐂』',
  gitLogFormat: '%cd [%h] %s',
  gitLogDateFormat: 'format:%m-%d %H:%M',
}
const ERROR_CODES = {
  NotFound: 'ENOENT',
  Access: 'EACCES',
  Busy: 'EBUSY',
  Perm: 'EPERM',
  NotEmpty: 'ENOTEMPTY',
  ConnReset: 'ECONNRESET',
  Timeout: 'ETIMEDOUT',
  Exist: 'EEXIST',
}

async function safeDelete(targetPath, maxAttempts = 3, delay = 1000) {
  let attempts = 0
  const logger = global.logger || console
  while (attempts < maxAttempts) {
    try {
      await fsPromises.rm(targetPath, { recursive: true, force: true })
      return true
    } catch (err) {
      if (err.code === ERROR_CODES.NotFound) return true
      if ([ERROR_CODES.Busy, ERROR_CODES.Perm, ERROR_CODES.NotEmpty].includes(err.code)) {
        attempts++
        if (attempts >= maxAttempts) {
          logger.error(`${Default_Config.logPrefix} [安全删除] ${targetPath} 最终失败 (${attempts}次): ${err.code}`)
          throw err
        }
        logger.warn(
          `${Default_Config.logPrefix} [安全删除] ${targetPath} 失败 (${attempts}/${maxAttempts}): ${err.code}, 重试...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        logger.error(`${Default_Config.logPrefix} [安全删除] ${targetPath} 异常:`, err)
        throw err
      }
    }
  }
  return false
}
async function copyFolderRecursiveWebpOnly(source, target, ignoreSet = new Set()) {
  const logger = global.logger || console
  try {
    await fsPromises.access(source)
  } catch (err) {
    if (err.code === ERROR_CODES.NotFound) return
    logger.error(`${Default_Config.logPrefix} [递归复制] 源访问失败 ${source}:`, err)
    throw err
  }
  try {
    await fsPromises.mkdir(target, { recursive: true })
    const entries = await fsPromises.readdir(source, { withFileTypes: true })
    await Promise.all(
      entries.map(async entry => {
        if (ignoreSet.has(entry.name)) return
        const currentSource = path.join(source, entry.name)
        const currentTarget = path.join(target, entry.name)
        try {
          if (entry.isDirectory()) {
            await copyFolderRecursiveWebpOnly(currentSource, currentTarget, ignoreSet)
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) {
            try {
              await fsPromises.copyFile(currentSource, currentTarget, fs.constants.COPYFILE_FICLONE)
            } catch (cloneError) {
              if (cloneError.code === 'ENOSYS' || cloneError.code === 'EXDEV') {
                await fsPromises.copyFile(currentSource, currentTarget)
              } else {
                throw cloneError
              }
            }
          }
        } catch (itemError) {
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(itemError.code)) {
            logger.warn(`${Default_Config.logPrefix} [递归复制] 处理 ${entry.name} 出错:`, itemError.code)
          }
        }
      })
    )
  } catch (error) {
    if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(error.code)) {
      logger.error(`${Default_Config.logPrefix} [递归复制] ${source} -> ${target} 失败:`, error)
    }
    throw error
  }
}

function ExecuteCommand(command, args, options = {}, timeout = 0, onStdErr, onStdOut) {
  return new Promise((resolve, reject) => {
    const logger = global.logger || console;
    const cmdStr = `${command} ${args.join(' ')}`;
    const cwd = options.cwd || process.cwd();
    logger.debug(`${Default_Config.logPrefix} [执行命令] > ${cmdStr} (CWD: ${cwd})`);

    const gitDebugEnv = { GIT_CURL_VERBOSE: "1", GIT_TRACE: "1" };
    options.env = { ...process.env, ...(options.env || {}), ...gitDebugEnv };
    // logger.debug(`${Default_Config.logPrefix} [执行命令] with env: ${JSON.stringify(options.env)}`); // 可选的调试日志

    let proc;
    try {
      proc = spawn(command, args, { stdio: 'pipe', ...options });
    } catch (spawnError) {
      logger.error(`${Default_Config.logPrefix} [执行命令] 启动失败 [${cmdStr}]:`, spawnError);
      return reject(spawnError);
    }

    let stdout = ''; let stderr = ''; let timer = null;
    let killed = false; let exited = false; let promiseSettled = false;

    const settlePromise = (resolver, value) => {
        if (promiseSettled) return;
        promiseSettled = true; clearTimeout(timer); resolver(value);
    };
    const killProc = (signal = 'SIGTERM') => {
      if (proc && proc.pid && !killed && !exited && !proc.killed) {
        logger.warn(`${Default_Config.logPrefix} [执行命令] 发送 ${signal} 到 ${proc.pid} (${cmdStr})`);
        try { process.kill(proc.pid, signal); if (signal === 'SIGKILL') killed = true; }
        catch (killError) { if (killError.code !== 'ESRCH') logger.error(`${Default_Config.logPrefix} [执行命令] kill ${proc.pid} 失败:`, killError); }
      }
    };

    if (timeout > 0) {
      timer = setTimeout(() => {
        if (exited || promiseSettled) return;
        killed = true; logger.warn(`${Default_Config.logPrefix} [执行命令] 命令 [${cmdStr}] 超时 (${timeout}ms)，终止...`);
        killProc('SIGTERM'); setTimeout(() => { if (!exited) killProc('SIGKILL'); }, 2000);
        const err = new Error(`Command timed out after ${timeout}ms: ${cmdStr}`);
        err.code = ERROR_CODES.Timeout; err.stdout = stdout; err.stderr = stderr;
        settlePromise(reject, err);
      }, timeout);
    }

    proc.stdout?.on('data', data => {
      if (exited || killed || promiseSettled) return;
      const output = data.toString(); stdout += output;
      if (onStdOut) try { onStdOut(output); } catch (e) { logger.warn(`${Default_Config.logPrefix} onStdOut 回调出错:`, e); }
    });
    proc.stderr?.on('data', data => {
      if (exited || killed || promiseSettled) return;
      const output = data.toString(); stderr += output;
      if (onStdErr) try { onStdErr(output); } catch (e) { logger.warn(`${Default_Config.logPrefix} onStdErr 回调出错:`, e); }
    });
    proc.on('error', err => {
      if (promiseSettled) return;
      exited = true; logger.error(`${Default_Config.logPrefix} [执行命令] 进程错误 [${cmdStr}]:`, err);
      settlePromise(reject, err);
    });
    proc.on('close', (code, signal) => {
      if (exited || promiseSettled) return;
      exited = true;
      if (code === 0) { settlePromise(resolve, { code: 0, signal, stdout, stderr }); }
      else {
        const err = new Error(`Command failed with code ${code}: ${cmdStr}`);
        err.code = code ?? 'UNKNOWN'; err.signal = signal; err.stdout = stdout; err.stderr = stderr;
        settlePromise(reject, err);
      }
    });
  });
}

async function FolderSize(folderPath) {
  let totalSize = 0
  const logger = global.logger || console
  const queue = [folderPath]
  const visitedDirs = new Set()
  while (queue.length > 0) {
    const currentPath = queue.shift()
    if (visitedDirs.has(currentPath)) continue
    visitedDirs.add(currentPath)
    try {
      const entries = await fsPromises.readdir(currentPath, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name)
        try {
          if (entry.isDirectory()) {
            queue.push(entryPath)
          } else if (entry.isFile()) {
            const stats = await fsPromises.stat(entryPath)
            totalSize += stats.size
          }
        } catch (statError) {
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(statError.code))
            logger.warn(`${Default_Config.logPrefix} [计算大小] 获取状态失败: ${entryPath}`, statError.code)
        }
      }
    } catch (readDirError) {
      if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readDirError.code))
        logger.warn(`${Default_Config.logPrefix} [计算大小] 读取目录失败: ${currentPath}`, readDirError.code)
    }
  }
  return totalSize
}
function FormatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return '? B'
  if (bytes === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = Math.floor(Math.log(bytes) / Math.log(k))
  if (i >= sizes.length) i = sizes.length - 1
  const formattedValue = i === 0 ? bytes : parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return `${formattedValue} ${sizes[i]}`
}

export class MiaoPluginMBT extends plugin {
  static initializationPromise = null
  static isGloballyInitialized = false
  static MBTConfig = {}
  static #imgDataCache = []
  static #userBanSet = new Set()
  static #activeBanSet = new Set()
  static #aliasData = null
  static paths = {
    YunzaiPath: YunzaiPath,
    LocalTuKuPath: path.join(YunzaiPath, 'resources', 'Miao-Plugin-MBT'),
    gitFolderPath: path.join(YunzaiPath, 'resources', 'Miao-Plugin-MBT', '.git'),
    LocalTuKuPath2: path.join(YunzaiPath, 'resources', 'Miao-Plugin-MBT-2'),
    gitFolderPath2: path.join(YunzaiPath, 'resources', 'Miao-Plugin-MBT-2', '.git'),
    commonResPath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery'),
    configFilePath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery', 'GalleryConfig.yaml'),
    imageDataPath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery', 'imagedata.json'),
    banListPath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery', 'banlist.json'),
    helpImagePath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery', 'help.webp'),
    target: {
      miaoChar: path.join(YunzaiPath, 'plugins', 'miao-plugin', 'resources', 'profile', 'normal-character'),
      zzzChar: path.join(YunzaiPath, 'plugins', 'ZZZ-Plugin', 'resources', 'images', 'panel'),
      wavesChar: path.join(YunzaiPath, 'plugins', 'waves-plugin', 'resources', 'rolePic'),
      exampleJs: path.join(YunzaiPath, 'plugins', 'example'),
      miaoGsAliasDir: path.join(YunzaiPath, 'plugins', 'miao-plugin', 'resources', 'meta-gs', 'character'),
      miaoSrAliasDir: path.join(YunzaiPath, 'plugins', 'miao-plugin', 'resources', 'meta-sr', 'character'),
      zzzAliasDir: path.join(YunzaiPath, 'plugins', 'ZZZ-Plugin', 'defset'),
      wavesAliasDir: path.join(YunzaiPath, 'plugins', 'waves-plugin', 'resources', 'Alias'),
    },
    sourceFolders: {
      gs: 'gs-character',
      sr: 'sr-character',
      zzz: 'zzz-character',
      waves: 'waves-character',
      gallery: 'GuGuNiu-Gallery',
    },
    filesToSyncToCommonRes: [
      { sourceSubPath: 'GuGuNiu-Gallery/help.webp', destFileName: 'help.webp' },
      { sourceSubPath: 'GuGuNiu-Gallery/imagedata.json', destFileName: 'imagedata.json' },
      { sourceSubPath: 'GuGuNiu-Gallery/GalleryConfig.yaml', destFileName: 'GalleryConfig.yaml', copyIfExists: false }
    ],
    filesToSyncSpecific: [
      {
        sourceSubPath: '咕咕牛图库下载器.js',
        destDir: path.join(YunzaiPath, 'plugins', 'example'),
        destFileName: '咕咕牛图库下载器.js',
      },
    ],
  }

  config = Default_Config
  logPrefix = Default_Config.logPrefix
  logger = global.logger || console
  isGitRunning = false
  isPluginInited = false
  task = null

  constructor() {
    super({
      name: '『咕咕牛🐂』图库管理器 v4.7.4',
      dsc: '『咕咕牛🐂』图库管理器',
      event: 'message',
      priority: 500,
      rule: GUGUNIU_RULES,
    })
    this.task = {
      name: `${this.logPrefix} 定时更新`,
      cron: Default_Config.cronUpdate,
      fnc: () => this.RunUpdateTask(),
      log: false,
    }
    this._initializeInstance()
  }

  async _initializeInstance() {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      //this.logger.info(`${this.logPrefix} 触发全局初始化...`)
      MiaoPluginMBT.InitializePlugin(this.logger)
    }
    try {
      await MiaoPluginMBT.initializationPromise
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized
      if (
        this.isPluginInited &&
        this.task &&
        MiaoPluginMBT.MBTConfig.cronUpdate &&
        this.task.cron !== MiaoPluginMBT.MBTConfig.cronUpdate
      ) {
        this.logger.info(`${this.logPrefix} 更新 Cron: ${this.task.cron} -> ${MiaoPluginMBT.MBTConfig.cronUpdate}`)
        this.task.cron = MiaoPluginMBT.MBTConfig.cronUpdate
      }
    } catch (initError) {
      this.logger.error(`${this.logPrefix} 实例等待初始化失败: ${initError.message}`)
      this.isPluginInited = false
    }
  }

  async ManualRunUpdateTask(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply("抱歉，只有主人才能手动执行此任务。");

    this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 手动触发定时更新任务...`);
    await e.reply(`${this.logPrefix} 正在手动执行定时更新任务，请稍候...`);
    let taskError = null;
    try {
      await this.RunUpdateTask(); 
      this.logger.info(`${this.logPrefix} 手动执行的定时更新任务逻辑已完成。`);
    } catch (error) {
      taskError = error; 
      this.logger.error(`${this.logPrefix} 手动执行定时更新任务时发生错误:`, error);
    }

    this.logger.info(`${this.logPrefix} 准备向主人发送手动任务完成通知...`);
    let notifyMsg = "";
    if (taskError) {
      const shortErrMsg = String(taskError.message || taskError).substring(0, 100); 
      notifyMsg = `『咕咕牛🐂』手动更新任务执行时遇到错误！\n错误(部分): ${shortErrMsg}\n请检查控制台日志获取详细信息。`;
    } else {
      const latestLog = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.localTuKuPath, this.logger);
      let formattedLog = latestLog || "无法获取日志";
      if (formattedLog && formattedLog !== "无法获取日志") {
          const match = formattedLog.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2})\s+\[([a-f0-9]{7,})\]\s+(.*)$/);
          if (match) {
            const dateTime = match[1]; const hash = match[2].substring(0, 7); const messageSummary = match[3].substring(0, 30) + (match[3].length > 30 ? '...' : '');
            formattedLog = `[${dateTime}-${hash}] ${messageSummary}`;
          } else {
            formattedLog = formattedLog.substring(0, 50) + (formattedLog.length > 50 ? '...' : '');
          }
      }
       notifyMsg = `『咕咕牛🐂』手动更新任务已执行完成。\n最新提交：${formattedLog}`;
    }

    const sent = await MiaoPluginMBT.SendMasterMsg(notifyMsg, undefined, 1000, this.logger);

    if (taskError) {
        await e.reply(`${this.logPrefix} 手动更新任务执行过程中遇到错误，已尝试通知主人。请检查控制台日志。`, true);
    } else {
        if (sent) {
           await e.reply(`${this.logPrefix} 手动更新任务执行完成，并已尝试通知主人。`, true);
        } else {
           await e.reply(`${this.logPrefix} 手动更新任务执行完成，但通知主人失败 (未配置或发送错误)。`, true);
        }
    }  return true; 
  }

  static async InitializePlugin(loggerInstance = global.logger || console) {
    if (MiaoPluginMBT.initializationPromise) return MiaoPluginMBT.initializationPromise
    if (MiaoPluginMBT.isGloballyInitialized) return Promise.resolve()
    const logPrefix = Default_Config.logPrefix
    loggerInstance.info(`${logPrefix} 开始全局初始化 (V${MiaoPluginMBT.GetVersionStatic()})...`)
    MiaoPluginMBT.isGloballyInitialized = false
    MiaoPluginMBT.initializationPromise = (async () => {
      const errors = []
      let fatalError = null
      let localImgDataCache = []
      try {
        //loggerInstance.info(`${logPrefix} [初始化] 1. 加载配置...`)
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, loggerInstance)
        if (!config) throw new Error('无法加载图库配置')
        //loggerInstance.info(`${logPrefix} [初始化] 2. 加载元数据...`)
        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, loggerInstance)
        if (!Array.isArray(localImgDataCache)) {
          loggerInstance.error(`${logPrefix} [初始化] CRITICAL: 元数据加载失败!`)
          localImgDataCache = []
          throw new Error('加载图片元数据失败')
        } else if (localImgDataCache.length === 0) {
          errors.push('警告：元数据为空')
        }
        //loggerInstance.info(`${logPrefix} [初始化] 3. 加载用户封禁...`)
        const bansLoaded = await MiaoPluginMBT.LoadUserBans(true, loggerInstance)
        if (!bansLoaded) errors.push('警告：加载用户封禁失败')
        //loggerInstance.info(`${logPrefix} [初始化] 4. 加载别名...`)
        const aliasLoaded = await MiaoPluginMBT.LoadAliasData(true, loggerInstance)
        if (!MiaoPluginMBT.#aliasData?.combined) {
          errors.push('警告：加载别名失败')
          MiaoPluginMBT.#aliasData = { combined: {} }
        } else if (!aliasLoaded) {
          errors.push('警告：部分别名加载失败')
        } else if (Object.keys(MiaoPluginMBT.#aliasData.combined).length === 0) {
          errors.push('警告：别名数据为空')
        }
        //loggerInstance.info(`${logPrefix} [初始化] 5. 应用封禁列表...`)
        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, loggerInstance)
        //loggerInstance.info(`${logPrefix} [初始化] 6. 提交缓存...`)
        MiaoPluginMBT.#imgDataCache = Object.freeze(localImgDataCache)
        MiaoPluginMBT.isGloballyInitialized = true
        loggerInstance.info(`${logPrefix} 全局初始化成功。${errors.length > 0 ? ' 警告: ' + errors.join('; ') : ''}`)
      } catch (error) {
        fatalError = error
        MiaoPluginMBT.isGloballyInitialized = false
        loggerInstance.error(`${logPrefix} !!! 全局初始化失败: ${fatalError.message} !!!`)
        loggerInstance.error(fatalError.stack)
        MiaoPluginMBT.#imgDataCache = Object.freeze([])
        MiaoPluginMBT.initializationPromise = null
        throw fatalError
      }
    })()
    MiaoPluginMBT.initializationPromise.catch(err => {
      loggerInstance.error(`${logPrefix} 初始化 Promise 未处理拒绝(!!!): ${err.message}`)
    })
    return MiaoPluginMBT.initializationPromise
  }
  static async GenerateAndApplyBanList(imageData, loggerInstance = global.logger || console) {
    //loggerInstance.info(`${Default_Config.logPrefix} [封禁处理] 生成并应用生效列表...`)
    const effectiveBanSet = MiaoPluginMBT.GenerateBanList(imageData, loggerInstance)
    await MiaoPluginMBT.ApplyBanList(effectiveBanSet, loggerInstance)
    //loggerInstance.info(`${Default_Config.logPrefix} [封禁处理] 应用完成。`)
  }

  static GenerateBanList(imageData, loggerInstance = global.logger || console) {
    const effectiveBans = new Set(MiaoPluginMBT.#userBanSet)
    const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl
    loggerInstance.info(
      `${Default_Config.logPrefix} [生成封禁] 等级PFL=${level}, 手动=${MiaoPluginMBT.#userBanSet.size}`
    )
    if (level > Purify_Level.NONE && Array.isArray(imageData) && imageData.length > 0) {
      let p = 0
      imageData.forEach(d => {
        if (MiaoPluginMBT.CheckIfPurifiedByLevel(d, level)) {
          const norm = d.path?.replace(/\\/g, '/')
          if (norm && !effectiveBans.has(norm)) {
            p++
            effectiveBans.add(norm)
          }
        }
      })
      loggerInstance.info(`${Default_Config.logPrefix} [生成封禁] PFL ${level} 新增屏蔽 ${p} 条。`)
    } else if (level > Purify_Level.NONE) {
      loggerInstance.warn(`${Default_Config.logPrefix} [生成封禁] PFL=${level} 但元数据无效。`)
    }
    loggerInstance.info(
      `${Default_Config.logPrefix} [生成封禁] 生效: ${effectiveBans.size} (手动 ${MiaoPluginMBT.#userBanSet.size})`
    )
    MiaoPluginMBT.#activeBanSet = effectiveBans
    return MiaoPluginMBT.#activeBanSet
  }

  static async DownloadRepoWithFallback(repoNum, repoUrl, branch, localPath, eForProgress, loggerInstance) {
    const logPrefix = Default_Config.logPrefix;
    const repoName = repoNum === 1 ? '一号仓库' : '二号仓库';
    const baseRawUrl = repoNum === 1 ? RAW_URL_Repo1 : RAW_URL_Repo2;

    //loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 开始下载: ${repoUrl}`);

    let sourcesToTry = [];
    let allTestResults = []; 
    try {
        allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, loggerInstance); 
        sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, loggerInstance); 
    } catch (testError) {
        loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 代理测速失败:`, testError);
        const githubSource = Default_Config.proxies.find(p => p.name === 'GitHub');
        if (githubSource) {
            sourcesToTry.push({...githubSource, speed: Infinity});
            allTestResults = Default_Config.proxies.map(p => ({...p, speed: Infinity}));
        }
    }

    if (eForProgress && repoNum === 1 && allTestResults.length > 0) {
        try {
            let speedMsg = `${logPrefix} 节点测速:\n\n`;
            allTestResults.sort((a, b) => {
                const prioA = a.priority ?? 999; const prioB = b.priority ?? 999;
                if (prioA !== prioB) return prioA - prioB;
                const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed;
                const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed;
                return speedA - speedB;
            });
            allTestResults.forEach(s => {
                let status = '';
                if (s.testUrlPrefix === null) {
                    status = 'N/A ⚠️'; 
                } else if (s.speed === Infinity) {
                    status = '超时❌';
                } else {
                    status = `${s.speed}ms✅`;
                }
                speedMsg += `${s.name}: ${status} (P:${s.priority ?? 'N'})\n`;
            });

            const bestSource = sourcesToTry[0];
            if (bestSource) {
                 let bestSpeed = '';
                 if (bestSource.testUrlPrefix === null) bestSpeed = 'N/A';
                 else if (bestSource.speed === Infinity) bestSpeed = 'Timeout'; 
                 else bestSpeed = `${bestSource.speed}ms`;
                 speedMsg += `\n✅ 优选: ${bestSource.name}(${bestSpeed})`;
            } else {
                 speedMsg += `\n❌ 无可用下载源`;
            }
            speedMsg += `\n⏳ 开始下载了.......`;
            await eForProgress.reply(speedMsg).catch(()=>{});
        } catch (replyError) {
            loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 回复测速结果失败:`, replyError);
        }
    }


    if (sourcesToTry.length === 0) {
        loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 没有任何可用的下载源！`);
        return { success: false, nodeName: '无可用源' };
    }

    let lastError = null;
    for (const source of sourcesToTry) {
        const nodeName = source.name === 'GitHub' ? 'GitHub(直连)' : `${source.name}(代理)`;
        loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 尝试使用源: ${nodeName}`);
    
        let cloneUrl = ''; let proxyForEnv = null;
        if (source.name === 'GitHub') { cloneUrl = repoUrl; }
        else if (source.cloneUrlPrefix) {
            if (source.name === 'GitClone') { cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl.replace(/^https?:\/\//, '')}`; }
            else { cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl}`; }
        } else { loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 源 ${source.name} 没有有效的 cloneUrlPrefix，跳过。`); continue; }
        if (source.name !== 'GitHub' && source.cloneUrlPrefix) {
             try {
                const proxyUrl = new URL(source.cloneUrlPrefix);
                if (['http:', 'https:'].includes(proxyUrl.protocol)) proxyForEnv = proxyUrl.origin;
             } catch (urlError) { loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 无法解析代理 ${source.name} 的 cloneUrlPrefix: ${urlError.message}`); }
        }
        const cloneArgs = ['clone', `--depth=${Default_Config.gitCloneDepth}`, '--progress', cloneUrl, localPath];
        const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };
        if (proxyForEnv) {
            gitOptions.env = { ...process.env, HTTP_PROXY: proxyForEnv, HTTPS_PROXY: proxyForEnv };
           // loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 为 Git 命令设置了代理环境变量: ${proxyForEnv}`);
        } else { 
          //loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 未设置代理环境变量。`);
         }


        try {
             let progressReported = { 10: false, 50: false, 90: false };
             const cloneResult = await ExecuteCommand(
                 'git', cloneArgs, gitOptions, Default_Config.gitCloneTimeout,
                 stderrChunk => {
                     if (repoNum === 1 && eForProgress) {
                         const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/);
                         if (match?.[1]) {
                             const progress = parseInt(match[1], 10);
                             [10, 50, 90].forEach(t => {
                                 if (progress >= t && !progressReported[t]) {
                                     progressReported[t] = true;
                                     const msg = t === 90 ? `『咕咕牛』${repoName}下载: 90%... (${nodeName})` : `『咕咕牛』${repoName}下载: ${t}% (${nodeName})`;
                                     eForProgress.reply(msg).catch(() => {});
                                 }
                             });
                         }
                     } else if (repoNum !== 1) { const match = stderrChunk.match(/(Receiving objects|Resolving deltas):\s*(\d+)%/); if (match) loggerInstance.debug(`${logPrefix} [下载进度 ${repoName}] (${nodeName}) ${match[1]}: ${match[2]}%`); }
                 }
             );
            loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载成功！`);
            return { success: true, nodeName: nodeName }; 

        } catch (error) {
            loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载失败。`); loggerInstance.error(error);
            lastError = error;
            loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 尝试清理失败的目录: ${localPath}`);
            await safeDelete(localPath);
            await common.sleep(1000);
            if (eForProgress && repoNum === 1) await eForProgress.reply(`${logPrefix} 使用 ${nodeName} 下载 ${repoName} 失败，尝试下一个源...`).catch(()=>{});
        }
    } 
    loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 尝试了所有可用源，均下载失败！`);
    if (repoNum === 1 && eForProgress) { await MiaoPluginMBT.ReportError(eForProgress, `下载${repoName}`, lastError || new Error("所有源下载失败"), `尝试源: ${sourcesToTry.map(s=>s.name).join(', ')}`, loggerInstance); }
    else { loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 最终错误:`, lastError || "未知错误"); }
    return { success: false, nodeName: '所有源失败', error: lastError };
  }

  static CheckIfPurifiedByLevel(imgDataItem, purifyLevel) {
    if (!imgDataItem?.attributes) return false
    const attrs = imgDataItem.attributes
    const isRx18 = attrs.isRx18 === true || String(attrs.isRx18).toLowerCase() === 'true'
    const isPx18 = attrs.isP18 === true || String(attrs.isP18).toLowerCase() === 'true'
    if (purifyLevel >= Purify_Level.RX18_ONLY && isRx18) return true
    if (purifyLevel >= Purify_Level.PX18_PLUS && isPx18) return true
    return false
  }

  static async CheckIfPurified(relativePath, loggerInstance = global.logger || console) {
    const normalizedPath = relativePath?.replace(/\\/g, '/')
    if (!normalizedPath) return false
    if (MiaoPluginMBT.#userBanSet.has(normalizedPath)) return true
    if (MiaoPluginMBT.#activeBanSet.has(normalizedPath)) return true
    const imgData = MiaoPluginMBT.#imgDataCache.find(img => img.path === normalizedPath)
    if (imgData) {
      const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl
      return MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, level)
    }
    return false
  }

  static async ReportError(e, operationName, error, context = '', loggerInstance = global.logger || console) {
    const Report = MiaoPluginMBT.FormatError(operationName, error, context)
    loggerInstance.error(
      `${Default_Config.logPrefix} [${operationName}] 操作失败:`,
      error?.message || error,
      error?.stack ? `\nStack(部分): ${error.stack.substring(0, 500)}...` : '',
      context ? `\nContext: ${context}` : ''
    )
    const messagesToSend = []
    if (Report.summary) messagesToSend.push(Report.summary)
    if (Report.suggestions) messagesToSend.push(`【可能原因与建议】\n${Report.suggestions}`)
    if (Report.contextInfo) messagesToSend.push(`【上下文信息】\n${Report.contextInfo}`)
    if (Report.stack) {
      const maxStackLength = 1000
      const stackInfo =
        Report.stack.length > maxStackLength ? Report.stack.substring(0, maxStackLength) + '... (已截断)' : Report.stack
      messagesToSend.push(`【技术细节 - 堆栈(部分)】\n${stackInfo}`)
    }
    try {
      const shortMessage = `${Default_Config.logPrefix} 执行 ${operationName} 操作时遇到问题！(错误码: ${
        error?.code || 'N/A'
      })`
      await e.reply(shortMessage, true)
      if (messagesToSend.length > 0 && common?.makeForwardMsg) {
        try {
          const forwardMsg = await common.makeForwardMsg(
            e,
            messagesToSend,
            `${Default_Config.logPrefix} ${operationName} 失败日志`
          )
          if (forwardMsg) {
            await e.reply(forwardMsg)
          } else {
            throw new Error('makeForwardMsg returned nullish')
          }
        } catch (forwardError) {
          loggerInstance.warn(
            `${Default_Config.logPrefix} [错误报告] 创建/发送合并消息失败 (${forwardError.message})，回退...`
          )
          if (Report.summary)
            await e.reply(Report.summary.substring(0, 300) + (Report.summary.length > 300 ? '...' : ''))
          if (Report.suggestions)
            await e.reply(
              `【建议】\n${Report.suggestions.substring(0, 300) + (Report.suggestions.length > 300 ? '...' : '')}`
            )
          await e.reply('(更多信息请查看控制台日志)')
        }
      } else {
        loggerInstance.warn(`${Default_Config.logPrefix} [错误报告] 无法创建合并消息。`)
        await e.reply('(详细错误信息请查看控制台日志)')
      }
    } catch (ReportError) {
      loggerInstance.error(`${Default_Config.logPrefix} [错误报告] CRITICAL: 报告错误时也发生错误:`, ReportError)
      loggerInstance.error(`${Default_Config.logPrefix} === 原始错误 (${operationName}) ===`, error)
    }
  }

  static FormatError(operationName, error, context = '') {
    const Report = {
      summary: `${Default_Config.logPrefix} 操作 [${operationName}] 失败！`,
      contextInfo: context || '无附加信息',
      suggestions: '',
      stack: error?.stack || '无可用堆栈信息',
    }
    if (error?.message) Report.summary += `\n错误信息: ${error.message}`
    if (error?.code) Report.summary += ` (Code: ${error.code})`
    if (error?.signal) Report.summary += ` (Sig: ${error.signal})`
    const stderr = error?.stderr || ''
    const stdout = error?.stdout || ''
    const errorString = `${error?.message || ''} ${stderr} ${String(error?.code) || ''} ${context || ''}`.toLowerCase()
    const suggestionsMap = {
      'could not resolve host': '网络: 检查 DNS 或网络连接。',
      'connection timed out': '网络: 连接超时。',
      'connection refused': '网络: 连接被拒绝。',
      'ssl certificate problem': '网络: SSL 证书校验失败。',
      '403 forbidden': '访问被拒绝 (403)。',
      '404 not found': '资源未找到 (404)。',
      'unable to access': 'Git: 访问失败 (网络/URL/代理/权限)。',
      'authentication failed': 'Git: 认证失败。',
      'permission denied': '权限: 系统权限不足。',
      'index file corrupt': 'Git: 仓库损坏，尝试删除 `.git/index` 或 #重置。',
      'lock file|index.lock': 'Git: 锁定，等待或删除 `.git/index.lock` (谨慎)。',
      'commit your changes or stash them': 'Git: 冲突，请 #更新 (强制覆盖)。',
      'not a git Repository': 'Git: 非有效仓库。',
      'unrelated histories': 'Git: 历史冲突，请 #重置。',
      'not possible to fast-forward': 'Git: 无法快进，请 #更新 (强制覆盖)。',
      [ERROR_CODES.NotFound]: '文件: 找不到文件或目录。',
      [ERROR_CODES.Access]: '文件: 权限不足。',
      [ERROR_CODES.Busy]: '文件: 资源正忙。',
      [ERROR_CODES.NotEmpty]: '文件: 无法删除非空目录。',
      [ERROR_CODES.ConnReset]: '网络: 连接被重置。',
      [ERROR_CODES.Timeout]: '操作超时。',
      'json.parse': '数据: JSON 解析失败。',
      'yaml.parse': '配置: YAML 解析失败。',
    }
    let matchedSuggestion = null
    if (error instanceof ReferenceError && error.message.includes('is not defined')) {
      matchedSuggestion = '代码: 引用未定义变量。'
    } else {
      for (const keyword in suggestionsMap) {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escapedKeyword, 'i')
        if (regex.test(errorString)) {
          matchedSuggestion = suggestionsMap[keyword]
          break
        }
      }
    }
    let finalSuggestions = []
    if (matchedSuggestion) finalSuggestions.push(`- ${matchedSuggestion}`)
    else finalSuggestions.push('- 暂无具体建议，请检查日志。')
    finalSuggestions.push('- 检查网络连接。', '- 检查目录权限。', '- 查看控制台详细日志。')
    if (operationName.includes('下载') || operationName.includes('更新')) {
      finalSuggestions.push('- 确保 Git 已安装。', '- 尝试 #咕咕牛测速。')
    }
    finalSuggestions.push('- 尝试重启 Bot。', '- 若持续，尝试 #重置咕咕牛。')
    Report.suggestions = finalSuggestions.join('\n')
    if (stdout || stderr) {
      Report.contextInfo += '\n--- Git 输出 ---'
      const maxLen = 500
      if (stdout)
        Report.contextInfo += `\n[stdout]:\n${stdout.substring(0, maxLen)}${stdout.length > maxLen ? '...' : ''}`
      if (stderr)
        Report.contextInfo += `\n[stderr]:\n${stderr.substring(0, maxLen)}${stderr.length > maxLen ? '...' : ''}`
    }
    return Report
  }

  static async IsTuKuDownloaded(RepoNum = 1) {
    const gitPath = RepoNum === 1 ? MiaoPluginMBT.paths.gitFolderPath : MiaoPluginMBT.paths.gitFolderPath2;
    try {
      await fsPromises.access(gitPath);
      const stats = await fsPromises.stat(gitPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async CheckInit(e) {
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 首次触发，初始化...`)
      await this._initializeInstance()
    } else if (MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 初始化进行中，等待...`)
      try {
        await MiaoPluginMBT.initializationPromise
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized
      } catch (error) {
        this.logger.error(`${this.logPrefix} [核心检查] 等待初始化捕获错误:`, error.message || error)
        this.isPluginInited = false
      }
    } else {
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized
    }
    if (!this.isPluginInited) {
      await e.reply(`${this.logPrefix} 插件初始化失败或进行中。`, true)
      return false
    }
    let coreDataValid = true
    if (!MiaoPluginMBT.MBTConfig || Object.keys(MiaoPluginMBT.MBTConfig).length === 0) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 配置丢失！`)
      coreDataValid = false
    }
    if (!Array.isArray(MiaoPluginMBT.#imgDataCache)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 元数据缓存无效！`)
      coreDataValid = false
    }
    if (!(MiaoPluginMBT.#userBanSet instanceof Set)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 用户封禁列表无效！`)
      coreDataValid = false
    }
    if (!(MiaoPluginMBT.#activeBanSet instanceof Set)) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 生效封禁列表无效！`)
      coreDataValid = false
    }
    if (!MiaoPluginMBT.#aliasData) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 别名数据丢失！`)
      coreDataValid = false
    }
    if (!coreDataValid) {
      await e.reply(`${this.logPrefix} 内部状态错误，请重启。`, true)
      return false
    }
    if (MiaoPluginMBT.#imgDataCache.length === 0) {
      this.logger.warn(`${this.logPrefix} [核心检查] 注意：元数据为空。`)
    }
    return true
  }

  async ReportError(e, operationName, error, context = '') {
    await MiaoPluginMBT.ReportError(e, operationName, error, context, this.logger)
  }

  async DownloadTuKu(e) {
    if (!(await this.CheckInit(e))) return true;
    if (this.isGitRunning) return e.reply(`${this.logPrefix} Git 操作进行中，请稍后再试...`);

    this.isGitRunning = true;
    const startTime = Date.now();
    let overallSuccess = false;
    let repo1Result = { repo: 1, success: false, nodeName: '未执行', error: null };
    let repo2Result = { repo: 2, success: true, nodeName: '未处理', error: null };

    try {
        const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
        const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
        const Repo2Exists = Repo2UrlConfigured ? await MiaoPluginMBT.IsTuKuDownloaded(2) : false;

        if (Repo1Exists && (!Repo2UrlConfigured || Repo2Exists)) {
            this.isGitRunning = false;
            return e.reply(`${this.logPrefix} 图库已完整存在。`);
        }
        if (!Repo1Exists && Repo2Exists) {
            this.isGitRunning = false;
            await e.reply(`${this.logPrefix} 状态异常！二号仓库存在一号仓库缺失！建议 #重置。`);
            return true;
        }

        //await e.reply(`${this.logPrefix} 开始并行下载图库仓库...`).catch(()=>{});
        //this.logger.info(`${this.logPrefix} [并行下载] 开始...`);

        const downloadPromises = [];

        if (!Repo1Exists) {
            //this.logger.info(`${this.logPrefix} [并行下载] 添加一号仓库下载任务。`);
            downloadPromises.push( MiaoPluginMBT.DownloadRepoWithFallback( 1, Default_Config.Main_Github_URL, MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch, MiaoPluginMBT.paths.LocalTuKuPath, e, this.logger ).then(result => ({ repo: 1, ...result })) );
        } else {
            this.logger.info(`${this.logPrefix} [并行下载] 一号仓库已存在，跳过下载。`);
            downloadPromises.push(Promise.resolve({ repo: 1, success: true, nodeName: '本地' }));
        }

        if (Repo2UrlConfigured && !Repo2Exists) {
           // this.logger.info(`${this.logPrefix} [并行下载] 添加二号仓库下载任务。`);
            downloadPromises.push( MiaoPluginMBT.DownloadRepoWithFallback( 2, MiaoPluginMBT.MBTConfig.Ass_Github_URL, MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch, MiaoPluginMBT.paths.LocalTuKuPath2, null, this.logger ).then(result => ({ repo: 2, ...result })) );
        } else if (Repo2UrlConfigured && Repo2Exists) {
             this.logger.info(`${this.logPrefix} [并行下载] 二号仓库已存在，跳过下载。`);
             downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '本地' }));
        } else {
             this.logger.info(`${this.logPrefix} [并行下载] 二号仓库未配置，跳过下载。`);
             downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '未配置' }));
        }

        const results = await Promise.allSettled(downloadPromises);
        this.logger.info(`${this.logPrefix} [并行下载] 所有下载任务已完成 (settled)。`);

        repo1Result = results.find(r => r.status === 'fulfilled' && r.value.repo === 1)?.value || results.find(r => r.status === 'rejected' && r.reason.repo === 1)?.reason || { repo: 1, success: false, nodeName: '未知错误', error: new Error('Repo 1 promise missing') };
        repo2Result = results.find(r => r.status === 'fulfilled' && r.value.repo === 2)?.value || results.find(r => r.status === 'rejected' && r.reason.repo === 2)?.reason || { repo: 2, success: true, nodeName: '未处理', error: new Error('Repo 2 promise missing') };

        if (results[0]?.status === 'rejected') { repo1Result = { 
          repo: 1, success: false, nodeName: '执行异常', error: results[0].reason }; 
          //this.logger.error(`${this.logPrefix} [并行下载] 一号仓库 Promise rejected:`, results[0].reason); 
        }
        if (results[1]?.status === 'rejected') { repo2Result = { 
          repo: 2, success: false, nodeName: '执行异常', error: results[1].reason }; 
         // this.logger.error(`${this.logPrefix} [并行下载] 二号仓库 Promise rejected:`, results[1].reason); 
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.info(`${this.logPrefix} [并行下载] 流程结束，耗时 ${duration} 秒。`);
        this.logger.info(`${this.logPrefix} [并行下载] 结果 - Repo 1: ${repo1Result.success ? '成功' : '失败'} (${repo1Result.nodeName}), Repo 2: ${repo2Result.success ? '成功' : '失败'} (${repo2Result.nodeName})`);

        let finalUserMessage = '';
        overallSuccess = repo1Result.success;

        if (overallSuccess) {
          let repoStatusMessage = `『咕咕牛』\n一号仓库状态: 下载成功 (${repo1Result.nodeName})。`;
          if (Repo2UrlConfigured) {
              if (repo2Result.success) {
                  repoStatusMessage += `\n二号仓库状态: ${repo2Result.nodeName === '本地' ? '已存在' : (repo2Result.nodeName === '未配置' ? '未配置' : '下载成功 ('+repo2Result.nodeName+')')}。`;
              } else {
                  repoStatusMessage += `\n⚠️ 二号仓库下载失败 (${repo2Result.nodeName})。`;
                  this.logger.error(`${this.logPrefix} [并行下载] 二号仓库下载失败详情:`, repo2Result.error);
              }
          }
          await e.reply(repoStatusMessage).catch(()=>{});
          this.logger.info(`${this.logPrefix} [并行下载] 执行下载后设置...`);
          await MiaoPluginMBT.RunPostDownloadSetup(e, this.logger);
          this.logger.info(`${this.logPrefix} [并行下载] 下载后处理完成。`);
          finalUserMessage = "『咕咕牛』成功进入喵喵里面！";
          await e.reply(finalUserMessage).catch(()=>{});

      } else {
          finalUserMessage = `『咕咕牛』核心仓库下载失败 (${repo1Result.nodeName})。请检查日志或网络后重试。`;
          await e.reply(finalUserMessage).catch(()=>{}); 
      }
    } catch (error) {
        this.logger.error(`${this.logPrefix} [DownloadTuKu] 顶层执行出错:`, error);
        await this.ReportError(e, '下载图库顶层', error);
        overallSuccess = false;
    } finally {
        this.isGitRunning = false;
        //this.logger.info(`${this.logPrefix} [并行下载] isGitRunning 标志已重置为 false。`);
    }
    return true;
  }

  async UpdateTuKu(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false
    if (this.isGitRunning) {
      if (!isScheduled && e) await e.reply(`${this.logPrefix} Git 操作进行中...`)
      return false
    }
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1)
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2))
    if (!Repo1Exists && (!Repo2UrlConfigured || !Repo2Exists)) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』图库未下载。', true)
      return false
    }
    if (Repo1Exists && Repo2UrlConfigured && !Repo2Exists) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』一号仓库存在，二号仓库缺失。', true)
      return false
    }
    if (!Repo1Exists && Repo2Exists) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』状态异常！二号仓库存在，一号仓库缺失！', true)
      return false
    }
    this.isGitRunning = true
    const startTime = Date.now()
    if (!isScheduled && e) await e.reply('『咕咕牛🐂』开始检查更新...', true)
    this.logger.info(`${this.logPrefix} [更新流程] 开始 @ ${new Date(startTime).toISOString()}`)
    let Repo1Updated = false,
      Repo2Updated = false
    let Repo1Success = true,
      Repo2Success = true
    let overallHasChanges = false
    let finalUserMessage = ''
    let gitLogRepo1 = ''
    try {
      if (Repo1Exists) {
        //this.logger.info(`${this.logPrefix} 更新一号仓库...`)
        const result1 = await MiaoPluginMBT.UpdateSingleRepo(
          e,
          1,
          MiaoPluginMBT.paths.LocalTuKuPath,
          '一号仓库',
          Default_Config.Main_Github_URL,
          MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
          isScheduled,
          this.logger
        )
        Repo1Success = result1.success
        Repo1Updated = result1.hasChanges
        if (!Repo1Success && !isScheduled) finalUserMessage = '一号仓库更新失败。'
        else if (Repo1Updated) {
          this.logger.info(`${this.logPrefix} 一号仓库有更新。`)
          gitLogRepo1 = result1.log || ''
        } else if (Repo1Success) {
          this.logger.info(`${this.logPrefix} 一号仓库已最新。`)
          if (!gitLogRepo1)
            gitLogRepo1 = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)
        }
      } else {
        Repo1Success = false
      }
      if (Repo1Success && Repo2UrlConfigured && Repo2Exists) {
        //this.logger.info(`${this.logPrefix} 更新二号仓库...`)
        const result2 = await MiaoPluginMBT.UpdateSingleRepo(
          null,
          2,
          MiaoPluginMBT.paths.LocalTuKuPath2,
          '二号仓库',
          MiaoPluginMBT.MBTConfig.Ass_Github_URL,
          MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
          isScheduled,
          this.logger
        )
        Repo2Success = result2.success
        Repo2Updated = result2.hasChanges
        if (!Repo2Success && !isScheduled && !finalUserMessage) finalUserMessage = '二号仓库更新失败。'
        else if (Repo2Updated) this.logger.info(`${this.logPrefix} 二号仓库有更新。`)
        else if (Repo2Success) this.logger.info(`${this.logPrefix} 二号仓库已最新。`)
      } else if (Repo2UrlConfigured && !Repo2Exists) {
        /* 二号仓库未下载 */
      } else if (!Repo2UrlConfigured) {
        Repo2Success = true
      }
      overallHasChanges = Repo1Updated || Repo2Updated
      const overallSuccess = Repo1Success && (!Repo2UrlConfigured || Repo2Success)
      if (overallSuccess) {
        if (overallHasChanges) {
          //this.logger.info(`${this.logPrefix} 检测到更新，执行后处理...`)
          if (!isScheduled && e) await e.reply(`${this.logPrefix} 应用变更...`)
          await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, this.logger)
          //this.logger.info(`${this.logPrefix} 更新后处理完成。`)
          if (!isScheduled && e) {
            if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新成功！'
            if (gitLogRepo1) {
              try {
                const forwardMsg = await common.makeForwardMsg(e, [`一号仓库最新记录：\n${gitLogRepo1}`], '『咕咕牛』更新详情')
                if (forwardMsg) await e.reply(forwardMsg)
                else await e.reply(finalUserMessage + ' (一号仓库日志发送失败)')
              } catch (fwdErr) {
                await e.reply(finalUserMessage + ' (一号仓库日志发送失败)')
              }
            } else await e.reply(finalUserMessage)
          } else if (isScheduled && overallHasChanges) {
            this.logger.info(`${this.logPrefix} [定时] 有更新，通知主人...`)
            const latestLog =
              gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger))
            await this.NotifyMasterUpdateSuccess(latestLog)
          }
        } else {
          //this.logger.info(`${this.logPrefix} 所有仓库均已最新。`)
          if (!isScheduled && e) {
            finalUserMessage = '『咕咕牛』已经是最新的啦'
            await e.reply(finalUserMessage)
            const latestLog =
              gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger))
            if (latestLog) await e.reply(`最新提交：${latestLog}`)
          } else if (isScheduled) {
            this.logger.info(`${this.logPrefix} [定时] 无更新。`)
          }
        }
      } else {
        this.logger.error(`${this.logPrefix} 更新出错。`)
        if (!isScheduled && e) {
          if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新出错！'
          await e.reply(finalUserMessage)
        }
        overallHasChanges = false
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} 更新流程异常:`, error)
      if (!isScheduled && e) await this.ReportError(e, '更新图库', error)
      else if (isScheduled) this.logger.error(`${this.logPrefix} [定时] 执行更新出错:`, error)
      overallHasChanges = false
    } finally {
      this.isGitRunning = false
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      this.logger.info(`${this.logPrefix} 更新流程结束，耗时 ${duration} 秒。`)
    }
    return overallHasChanges
  }

  async ManageTuKu(e) {
    if (!(await this.CheckInit(e))) return true
    if (!e.isMaster) return e.reply(`${this.logPrefix} 仅主人可操作。`)
    const msg = e.msg.trim()
    if (!msg.includes('重置咕咕牛')) return e.reply('请用 #重置咕咕牛', true)
    const actionVerb = '重置'
    const startMessage = '『咕咕牛🐂』正在彻底重置...'
    const successMessage = '『咕咕牛🐂』已重置完毕。请 #下载咕咕牛'
    const failureMessage = '『咕咕牛🐂』重置失败，请检查日志！'
    await e.reply(startMessage, true)
    this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 执行 ${actionVerb}`)
    const pathsToDeleteDirectly = [
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.LocalTuKuPath2,
      MiaoPluginMBT.paths.commonResPath,
    ].filter(Boolean)
    let deleteSuccess = true
    for (const dirPath of pathsToDeleteDirectly) {
      this.logger.info(`${this.logPrefix} 删除: ${dirPath}`)
      try {
        const deleted = await safeDelete(dirPath)
        if (!deleted) deleteSuccess = false
      } catch (err) {
        deleteSuccess = false
      }
    }
    this.logger.info(`${this.logPrefix} 清理目标插件目录...`)
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean)
    let cleanSuccess = true
    for (const dirPath of targetPluginDirs) {
      try {
        await MiaoPluginMBT.CleanTargetCharacterDirs(dirPath, this.logger)
      } catch (err) {
        cleanSuccess = false
      }
    }
    this.logger.info(`${this.logPrefix} 重置内存状态...`)
    MiaoPluginMBT.MBTConfig = {}
    MiaoPluginMBT.#imgDataCache = []
    MiaoPluginMBT.#userBanSet = new Set()
    MiaoPluginMBT.#activeBanSet = new Set()
    MiaoPluginMBT.#aliasData = null
    MiaoPluginMBT.isGloballyInitialized = false
    MiaoPluginMBT.initializationPromise = null
    this.isPluginInited = false
    this.logger.info(`${this.logPrefix} 内存已重置。`)
    if (deleteSuccess && cleanSuccess) {
      await e.reply(successMessage)
    } else {
      await e.reply(failureMessage)
    }
    return true
  }

  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;
    this.logger.info(`${this.logPrefix} [检查状态] 开始生成状态报告...`);

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    this.logger.info(`${this.logPrefix} [检查状态] 仓库状态 - 一号: ${Repo1Exists ? '存在' : '不存在'}, 二号: ${Repo2UrlConfigured ? (Repo2Exists ? '存在' : '未下载') : '未配置'}`);
    let savePath = '';
    try {
      const pluginVersion = this.GetVersion();
      const GameFoldersMap = { 'gs': '原神', 'sr': '星铁', 'zzz': '绝区零', 'waves': '鸣潮' }; 
      const stats = {
        meta: { 
          roles: 0,
          images: 0,
          games: {},
        },
        scan: { 
          roles: 0, images: 0, gameImages: {}, gameRoles: {}, gameSizes: {}, gameSizesFormatted: {},
          totalSize: 0, totalGitSize: 0, totalFilesSize: 0,
          totalSizeFormatted: '0 B', totalGitSizeFormatted: '0 B', totalFilesSizeFormatted: '0 B'
        },
        repos: {
          '1': { name: "一号仓库", exists: Repo1Exists, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: 'N/A', gitSizeFormatted: 'N/A', filesSizeFormatted: 'N/A' },
          '2': { name: "二号仓库", exists: Repo2Exists && Repo2UrlConfigured, size: 0, gitSize: 0, filesSize: 0, sizeFormatted: 'N/A', gitSizeFormatted: 'N/A', filesSizeFormatted: 'N/A' }
        },
      };
      Object.values(GameFoldersMap).forEach(gameName => { 
          stats.meta.games[gameName] = 0; stats.scan.gameImages[gameName] = 0; stats.scan.gameRoles[gameName] = 0; stats.scan.gameSizes[gameName] = 0; stats.scan.gameSizesFormatted[gameName] = '0 B';
      });
      const config = {
        enabled: MiaoPluginMBT.MBTConfig?.TuKuOP ?? Default_Config.defaultTuKuOp,
        pflLevel: MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl,
        activeBans: MiaoPluginMBT.#activeBanSet?.size ?? 0,
        userBans: MiaoPluginMBT.#userBanSet?.size ?? 0,
        purifiedBans: 0,
        enabledText: '',
        pflDesc: '',
      };
      config.enabledText = config.enabled ? '已启用' : '已禁用';
      config.purifiedBans = Math.max(0, config.activeBans - config.userBans);
      config.pflDesc = Purify_Level.getDescription(config.pflLevel);
      const characterSet = new Set();
      if (Array.isArray(MiaoPluginMBT.#imgDataCache) && MiaoPluginMBT.#imgDataCache.length > 0) {
        stats.meta.images = MiaoPluginMBT.#imgDataCache.length;
        MiaoPluginMBT.#imgDataCache.forEach(item => {
          if (item && item.characterName) { characterSet.add(item.characterName); }
          const PathParts = item?.path?.split('/');
          if (PathParts?.length > 0) {
            const GameKey = PathParts[0].split('-')[0];
            const GameName = GameFoldersMap[GameKey];
            if (GameName) stats.meta.games[GameName] = (stats.meta.games[GameName] || 0) + 1; 
          }
        });
      }
      stats.meta.roles = characterSet.size;
      this.logger.info(`${this.logPrefix} [检查状态] 元数据统计完成: ${stats.meta.roles}个角色, ${stats.meta.images}张图片`);
      const RepoStatsScan = {
        1: { path: MiaoPluginMBT.paths.LocalTuKuPath, gitPath: MiaoPluginMBT.paths.gitFolderPath, exists: Repo1Exists },
        2: { path: MiaoPluginMBT.paths.LocalTuKuPath2, gitPath: MiaoPluginMBT.paths.gitFolderPath2, exists: Repo2Exists && Repo2UrlConfigured },
      };
      const ScannedRoleImageCounts = {}; 
      const ScannedGameSizes = {};       
      Object.values(GameFoldersMap).forEach(gameName => { ScannedRoleImageCounts[gameName] = {}; ScannedGameSizes[gameName] = 0; }); 
      let totalGitSizeScan = 0; 

      //this.logger.info(`${this.logPrefix} [检查状态] 开始扫描本地仓库文件...`);
      for (const RepoNum of Object.keys(RepoStatsScan)) {
          const Repo = RepoStatsScan[RepoNum];
          if (!Repo.exists) {
              this.logger.info(`${this.logPrefix} [检查状态] 跳过不存在的仓库 ${RepoNum}`);
              continue; 
          }
          //this.logger.info(`${this.logPrefix} [检查状态] 正在扫描仓库 ${RepoNum} (${Repo.path})`);
          try {
              const repoGitSize = await FolderSize(Repo.gitPath);
              totalGitSizeScan += repoGitSize; 
              stats.repos[RepoNum].gitSize = repoGitSize;
              stats.repos[RepoNum].gitSizeFormatted = FormatBytes(repoGitSize);
              //this.logger.info(`${this.logPrefix} [检查状态] 仓库 ${RepoNum} Git 目录大小: ${stats.repos[RepoNum].gitSizeFormatted}`);
          } catch (sizeError) {
              this.logger.error(`${this.logPrefix} [检查状态] 计算仓库 ${RepoNum} Git 大小失败:`, sizeError);
              stats.repos[RepoNum].gitSizeFormatted = '错误';
          }
          for (const GameKey in GameFoldersMap) { 
              const GameName = GameFoldersMap[GameKey];
              const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[GameKey];
              if (!sourceFolderName || GameKey === 'gallery') continue; 
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
                                  if (imageFile.isFile() && imageFile.name.toLowerCase().endsWith('.webp')) {
                                      imageCountInCharDir++;
                                      const imagePath = path.join(charFolderPath, imageFile.name);
                                      try {
                                          const fileStat = await fsPromises.stat(imagePath);
                                          ScannedGameSizes[GameName] = (ScannedGameSizes[GameName] || 0) + fileStat.size;
                                      } catch (statErr) {
                                          if (statErr.code !== 'ENOENT') this.logger.warn(`${this.logPrefix} [检查状态] 获取文件大小失败 ${imagePath}:`, statErr.code);
                                      }
                                  }
                              }
                          } catch (readCharErr) {
                              if (readCharErr.code !== 'ENOENT') this.logger.warn(`${this.logPrefix} [检查状态] 读取角色目录失败 ${charFolderPath}:`, readCharErr.code);
                          }
                          if (imageCountInCharDir > 0) {
                              ScannedRoleImageCounts[GameName][characterName] = (ScannedRoleImageCounts[GameName][characterName] || 0) + imageCountInCharDir;
                          }
                      }
                  }
              } catch (accessGameErr) {
                  if (accessGameErr.code !== 'ENOENT') {
                      this.logger.warn(`${this.logPrefix} [检查状态] 访问游戏目录失败 ${gameFolderPath}:`, accessGameErr.code);
                  }
              }
          } 
          //this.logger.info(`${this.logPrefix} [检查状态] 仓库 ${RepoNum} 扫描完成。`);
      } 
      //this.logger.info(`${this.logPrefix} [检查状态] 所有本地仓库文件扫描结束。`);
      //this.logger.info(`${this.logPrefix} [检查状态] 开始汇总扫描结果...`);
      const scanResult = {
          roles: 0, images: 0, gameImages: {}, gameRoles: {}, gameSizes: {}, gameSizesFormatted: {},
          totalSize: 0, totalGitSize: totalGitSizeScan, totalFilesSize: 0, 
          totalSizeFormatted: '0 B', totalGitSizeFormatted: FormatBytes(totalGitSizeScan), totalFilesSizeFormatted: '0 B'
      };
       Object.values(GameFoldersMap).forEach(gameName => {
           scanResult.gameImages[gameName] = 0; scanResult.gameRoles[gameName] = 0; scanResult.gameSizes[gameName] = 0; scanResult.gameSizesFormatted[gameName] = '0 B';
       });

      for (const GameName of Object.values(GameFoldersMap)) {
          const rolesInGame = ScannedRoleImageCounts[GameName] || {}; 
          const roleNames = Object.keys(rolesInGame);
          const roleCount = roleNames.length;
          let gameImageCount = 0;
          for (const roleName of roleNames) { gameImageCount += rolesInGame[roleName] || 0; }
          scanResult.gameRoles[GameName] = roleCount;
          scanResult.gameImages[GameName] = gameImageCount;
          scanResult.roles += roleCount;
          scanResult.images += gameImageCount;

          const gameSizeBytes = ScannedGameSizes[GameName] || 0;
          scanResult.gameSizes[GameName] = gameSizeBytes;
          scanResult.gameSizesFormatted[GameName] = FormatBytes(gameSizeBytes);
          scanResult.totalFilesSize += gameSizeBytes;

          //this.logger.info(`${this.logPrefix} [检查状态] 汇总 ${GameName}: ${roleCount}个角色, ${gameImageCount}张图片, 大小 ${scanResult.gameSizesFormatted[GameName]}`);
      }
      scanResult.totalSize = scanResult.totalFilesSize + scanResult.totalGitSize;
      scanResult.totalFilesSizeFormatted = FormatBytes(scanResult.totalFilesSize);
      scanResult.totalSizeFormatted = FormatBytes(scanResult.totalSize);
      //this.logger.info(`${this.logPrefix} [检查状态] 扫描结果汇总完成。总计: ${scanResult.roles}个角色, ${scanResult.images}张图片, 文件总大小: ${scanResult.totalFilesSizeFormatted}`);
      //this.logger.info(`${this.logPrefix} [检查状态] 将汇总结果更新到最终数据结构...`);
      stats.scan = scanResult;
      //this.logger.info(`${this.logPrefix} [检查状态] 开始计算各仓库总占用大小...`);
      for(const repoNum in stats.repos) {
          if (stats.repos[repoNum].exists) {
              try {
                  const repoTotalSize = await FolderSize(RepoStatsScan[repoNum].path);
                  const repoGitSize = stats.repos[repoNum].gitSize; 
                  stats.repos[repoNum].size = repoTotalSize;
                  stats.repos[repoNum].filesSize = Math.max(0, repoTotalSize - repoGitSize);
                  stats.repos[repoNum].sizeFormatted = FormatBytes(repoTotalSize);
                  stats.repos[repoNum].filesSizeFormatted = FormatBytes(stats.repos[repoNum].filesSize);
                  //this.logger.info(`${this.logPrefix} [检查状态] 仓库 ${repoNum} 总占用: ${stats.repos[repoNum].sizeFormatted}, 文件占用: ${stats.repos[repoNum].filesSizeFormatted}`);
              } catch (finalSizeError) {
                  this.logger.error(`${this.logPrefix} [检查状态] 计算仓库 ${repoNum} 总占用大小失败:`, finalSizeError);
                  stats.repos[repoNum].sizeFormatted = '错误';
                  stats.repos[repoNum].filesSizeFormatted = '错误';
              }
          }
      }
      //this.logger.info(`${this.logPrefix} [检查状态] 各仓库总占用大小计算完成。`);
      const repoCount = Object.values(stats.repos || {}).filter(repo => repo?.exists).length;
      const renderData = { pluginVersion, stats, config, repoCount };
      //this.logger.info(`${this.logPrefix} [检查状态] 最终准备渲染的数据:`);
      //this.logger.info(JSON.stringify(renderData, null, 2)); 
      const templatePath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'status.html');
      savePath = path.join(os.tmpdir(), `guguniu_status_${Date.now()}.png`);
      this.logger.info(`${this.logPrefix} [检查状态] 开始调用 Puppeteer 生成截图...`);
      const img = await puppeteer.screenshot('guguniu-status', {
        tplFile: templatePath,
        savePath: savePath,
        imgType: 'png',
        pageGotoParams: { waitUntil: 'networkidle0' },
        ...renderData, 
        screenshotOptions: { fullPage: false },
        pageBoundingRect: { selector: 'body', padding: 0 },
        width: 740
      });
      if (img) {
        await e.reply(img);
        this.logger.info(`${this.logPrefix} [检查状态] 状态报告图片已发送。`);
      } else {
        this.logger.error(`${this.logPrefix} [检查状态] Puppeteer 未能成功生成图片。`);
        await e.reply("生成状态报告图片失败 (截图环节出错)，请查看日志。");
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} [检查状态] 生成状态报告时发生严重错误:`, error);
      await this.ReportError(e, "生成状态报告图片", error);
    } finally {
      if (savePath && fs.existsSync(savePath)) {
          try {
              await fsPromises.unlink(savePath);
              this.logger.info(`${this.logPrefix} [检查状态] 已删除临时截图文件: ${savePath}`);
          } catch (unlinkErr) {
              if (unlinkErr.code !== 'ENOENT') this.logger.warn(`${this.logPrefix} [检查状态] 删除临时截图失败: ${savePath}`, unlinkErr);
          }
      }
    }
    return true; 
  }

  async ManageTuKuOption(e) {
    if (!(await this.CheckInit(e))) return true
    if (!e.isMaster) return e.reply(`${this.logPrefix} 仅主人可操作。`)
    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i)
    if (!match) return false
    const action = match[1]
    const enable = action === '启用'
    let configChanged = false
    let message = ''
    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger)
    if (MiaoPluginMBT.MBTConfig.TuKuOP === enable) {
      message = `${this.logPrefix} 图库已「${action}」。`
    } else {
      MiaoPluginMBT.MBTConfig.TuKuOP = enable
      configChanged = true
      message = `${this.logPrefix} 图库已设为「${action}」。`
      this.logger.info(`${this.logPrefix} 图库开关 -> ${enable}`)
      if (enable) {
        await e.reply(`${this.logPrefix} 启用同步...`)
        try {
          await MiaoPluginMBT.SyncCharacterFolders(this.logger)
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger)
          message += '\n图片开始同步。'
        } catch (syncError) {
          message += '\n⚠️ 同步出错！'
          await this.ReportError(e, '启用同步', syncError)
        }
      } else {
        await e.reply(`${this.logPrefix} 禁用清理...`)
        try {
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.miaoChar, this.logger)
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.zzzChar, this.logger)
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.wavesChar, this.logger)
          message += '\n已清理图片。'
        } catch (cleanError) {
          message += '\n⚠️ 清理出错！'
          await this.ReportError(e, '禁用清理', cleanError)
        }
      }
    }
    if (configChanged) {
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger)
      if (!saveSuccess) message += '\n⚠️ 配置保存失败！'
    }
    await e.reply(message, true)
    return true
  }
  
  async SetPurificationLevel(e) {
    if (!(await this.CheckInit(e))) return true
    if (!e.isMaster) return e.reply(`${this.logPrefix} 仅主人可操作。`)
    const match = e.msg.match(/^(?:#设置咕咕牛净化等级|#设定净化)\s*([012])$/i)
    if (!match?.[1]) return e.reply('格式: #设置咕咕牛净化等级 [0-2]', true)
    const level = parseInt(match[1], 10)
    if (isNaN(level) || !Purify_Level.getDescription(level)) return e.reply(`无效等级 ${level}。`, true)
    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger)
    const currentLevel = MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl
    if (level === currentLevel) return e.reply(`${this.logPrefix} 等级已是 ${level}。`, true)
    MiaoPluginMBT.MBTConfig.PFL = level
    this.logger.info(`${this.logPrefix} 净化等级 -> ${level}`)
    const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger)
    let replyMessage = `${this.logPrefix} 净化等级已设为 ${level} (${Purify_Level.getDescription(level)})。`
    if (!saveSuccess) replyMessage += '\n⚠️ 配置保存失败！'
    await e.reply(replyMessage, true)
    setImmediate(async () => {
      try {
        await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger)
      } catch (applyError) {
        this.logger.error(`${this.logPrefix} [净化设置] 应用出错:`, applyError)
      }
    })
    return true
  }

  async ManageUserBans(e) {
    if (!(await this.CheckInit(e))) return true
    const msg = e.msg.trim()
    const isMaster = e.isMaster
    if ((msg.startsWith('#咕咕牛封禁 ') || msg.startsWith('#咕咕牛解禁 ') || msg === '#清空咕咕牛封禁') && !isMaster)
      return e.reply(`${this.logPrefix} 仅主人可操作。`)
    if (msg === '#ban列表' || msg === '#咕咕牛封禁列表') {
      const activeBanCount = MiaoPluginMBT.#activeBanSet.size;
      const userBanCount = MiaoPluginMBT.#userBanSet.size;
      const purifiedCount = Math.max(0, activeBanCount - userBanCount);
      const level = MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl;

      if (activeBanCount === 0) {
        return e.reply('当前无生效封禁。', true);
      }
      await e.reply(`正在分别生成列表,请稍后...`, true);

      const purifiedBans = [];
      const userBans = []; 

      const sortedActiveBans = Array.from(MiaoPluginMBT.#activeBanSet).sort();
      for (const relativePath of sortedActiveBans) {
          const fileName = path.basename(relativePath);
          if (MiaoPluginMBT.#userBanSet.has(relativePath)) {
              userBans.push(fileName);
          } else {
              purifiedBans.push(fileName);
          }
      }

      let sentCount = 0; 
      if (purifiedBans.length > 0) {
          const purifiedContent = [
              `--- 🌱净化屏蔽 (${purifiedBans.length}张) ---`,
              purifiedBans.join('\n')
          ];
          try {
              const forwardMsg = await common.makeForwardMsg(e, purifiedContent, '净化屏蔽列表');
              if (forwardMsg) {
                  await e.reply(forwardMsg);
                  sentCount++;
              } else {
                   logger.warn(`${this.logPrefix} 创建净化屏蔽列表合并消息失败。`);
                   await e.reply("无法生成净化屏蔽列表。");
              }
          } catch (fwdErr) {
              logger.error(`${this.logPrefix} 发送净化屏蔽列表失败:`, fwdErr);
              await e.reply("发送净化屏蔽列表时出错。");
          }
      } else {
          await e.reply("--- 🌱净化屏蔽 (0张) ---", true);
          sentCount++; 
      }

      if (purifiedBans.length > 0 && userBans.length > 0) {
          await common.sleep(500); 
      }
      if (userBans.length > 0) {
          const userContent = [
              `--- 🚫手动封禁 (${userBans.length}张) ---`,
              userBans.join('\n')
          ];
          try {
              const forwardMsg = await common.makeForwardMsg(e, userContent, '手动封禁列表');
              if (forwardMsg) {
                  await e.reply(forwardMsg);
                  sentCount++;
              } else {
                  logger.warn(`${this.logPrefix} 创建手动封禁列表合并消息失败。`);
                  await e.reply("无法生成手动封禁列表。");
              }
          } catch (fwdErr) {
              logger.error(`${this.logPrefix} 发送手动封禁列表失败:`, fwdErr);
              await e.reply("发送手动封禁列表时出错。");
          }
      } else {
          await e.reply("--- 🚫手动封禁 (0张) ---", true);
          sentCount++; 
      }
      return true; 
    }
    if (msg === '#清空咕咕牛封禁') {
      if (MiaoPluginMBT.#userBanSet.size === 0) return e.reply('手动封禁已空。', true)
      const oldSize = MiaoPluginMBT.#userBanSet.size
      const oldBans = new Set(MiaoPluginMBT.#userBanSet)
      MiaoPluginMBT.#userBanSet.clear()
      const saved = await MiaoPluginMBT.SaveUserBans(this.logger)
      if (!saved) {
        MiaoPluginMBT.#userBanSet = oldBans
        await e.reply('清空失败：写入错误。')
        return true
      }
      await e.reply(`手动封禁已清空 (${oldSize}条)。应用更改...`, true)
      setImmediate(async () => {
        try {
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger)
        } catch (err) {
          this.logger.error(`${this.logPrefix} [清空封禁] 后台应用出错:`, err)
        }
      })
      return true
    }
    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i)
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i)
    if (!addMatch && !delMatch) return false
    const isAdding = !!addMatch
    const targetIdentifierRaw = (isAdding ? addMatch[1] : delMatch[1]).trim()
    const actionVerb = isAdding ? '封禁' : '解禁'
    if (!targetIdentifierRaw) {
      const example = isAdding ? '#咕咕牛封禁花火1' : '#咕咕牛解禁花火1'
      return e.reply(`请输入角色和编号，例：${example}`, true)
    }
    const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw)
    if (!parsedId) return e.reply('格式不对哦，例：花火1', true)
    const { mainName: rawMainName, imageNumber } = parsedId
    const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger)
    const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName
    const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`
    const imageData = MiaoPluginMBT.#imgDataCache.find(
      img =>
        img.characterName === standardMainName &&
        img.path?.toLowerCase().replace(/\\/g, '/').endsWith(`/${expectedFilenameLower}`)
    )
    if (!imageData || !imageData.path) {
      return e.reply(`元数据中未找到: ${standardMainName}Gu${imageNumber}。`, true)
    }
    const targetRelativePath = imageData.path.replace(/\\/g, '/')
    const targetFileName = path.basename(targetRelativePath)
    await this.PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb)
    return true
  }

  async PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb) {
    try {
      let configChanged = false
      let replyMsg = ''
      const isCurrentlyUserBanned = MiaoPluginMBT.#userBanSet.has(targetRelativePath)
      const isCurrentlyPurified = await MiaoPluginMBT.CheckIfPurified(targetRelativePath, this.logger)
      if (isAdding) {
        if (isCurrentlyUserBanned) replyMsg = `${targetFileName} ❌️ 已手动封禁。`
        else {
          MiaoPluginMBT.#userBanSet.add(targetRelativePath)
          configChanged = true
          replyMsg = `${targetFileName} 🚫 已手动封禁。`
          if (isCurrentlyPurified) replyMsg += ` (符合净化)`
        }
      } else {
        if (!isCurrentlyUserBanned) {
          if (isCurrentlyPurified) replyMsg = `${targetFileName} ❌️ 解禁失败：被净化规则屏蔽。`
          else replyMsg = `${targetFileName} ❓ 不在手动列表。`
        } else {
          MiaoPluginMBT.#userBanSet.delete(targetRelativePath)
          configChanged = true
          replyMsg = `${targetFileName} ✅️ 已手动解禁。`
          if (isCurrentlyPurified) replyMsg += `\n⚠️ 仍会被净化规则(${MiaoPluginMBT.MBTConfig.PFL})屏蔽。`
          else replyMsg += '\n恢复文件...'
        }
      }
      await e.reply(replyMsg, true)
      if (configChanged) {
        const saved = await MiaoPluginMBT.SaveUserBans(this.logger)
        if (!saved) {
          if (isAdding) MiaoPluginMBT.#userBanSet.delete(targetRelativePath)
          else MiaoPluginMBT.#userBanSet.add(targetRelativePath)
          await e.reply(`『咕咕牛』${actionVerb}失败：无法保存！`, true)
          return
        }
        setImmediate(async () => {
          try {
            await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger)
            if (!isAdding && !MiaoPluginMBT.#activeBanSet.has(targetRelativePath)) {
              await MiaoPluginMBT.RestoreFileFromSource(targetRelativePath, this.logger)
            }
          } catch (err) {
            this.logger.error(`${this.logPrefix} [${actionVerb}] 后台处理出错:`, err)
          }
        })
      }
    } catch (error) {
      await this.ReportError(e, `${actionVerb}图片`, error, `目标: ${targetFileName}`)
    }
  }

  async FindRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库未下载！', true)
    const match = e.msg.match(/^#查看\s*(.+)$/i)
    if (!match?.[1]) return e.reply('例：#查看花火', true)
    const roleNameInput = match[1].trim()
    try {
      const { mainName, exists } = await MiaoPluginMBT.FindRoleAlias(roleNameInput, this.logger)
      const standardMainName = mainName || roleNameInput
      const roleImageData = MiaoPluginMBT.#imgDataCache.filter(
        img => img.characterName === standardMainName
      )
      if (roleImageData.length === 0) {
        const dirExists = await MiaoPluginMBT.CheckRoleDirExists(standardMainName)
        if (dirExists) return e.reply(`『${standardMainName}』存在目录，但无元数据。`)
        else return e.reply(`『${standardMainName}』图库中无此角色。`)
      }
      await e.reply(`${this.logPrefix} 开始整合 [${standardMainName}] (${roleImageData.length} 张)...`)
      roleImageData.sort(
        (a, b) =>
          parseInt(a.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0') -
          parseInt(b.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0')
      )
      const title = `查看『${standardMainName}』 (${roleImageData.length} 张)`
      const forwardMsgList = [[title], [`导出: #咕咕牛导出${standardMainName}1`]]
      for (let i = 0; i < roleImageData.length; i++) {
        const { path: relativePath } = roleImageData[i]
        if (!relativePath) continue
        const normalizedPath = relativePath.replace(/\\/g, '/')
        const fileName = path.basename(normalizedPath)
        const baseName = fileName.replace(/\.webp$/i, '')
        const isEffectivelyBanned = MiaoPluginMBT.#activeBanSet.has(normalizedPath)
        const isUserBanned = MiaoPluginMBT.#userBanSet.has(normalizedPath)
        const isPurified = MiaoPluginMBT.CheckIfPurifiedByLevel(
          roleImageData[i],
          MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl
        )
        let labelStr = ''
        if (isEffectivelyBanned) {
          labelStr += ' ❌封禁'
          if (isPurified && !isUserBanned) labelStr += ' 🌱净化'
        }
        const entryText = `${i + 1}、${baseName}${labelStr}`
        const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(normalizedPath)
        if (absolutePath) {
          try {
            await fsPromises.access(absolutePath, fs.constants.R_OK)
            forwardMsgList.push([entryText, segment.image(`file://${absolutePath}`)])
          } catch (accessErr) {
            forwardMsgList.push(`${entryText} (文件异常)`)
          }
        } else {
          forwardMsgList.push(`${entryText} (文件丢失)`)
        }
      }
      const forwardMsg = await common.makeForwardMsg(e, forwardMsgList, `当前查看的是[${standardMainName}]图库`)
      if (forwardMsg) await e.reply(forwardMsg)
      else {
        await e.reply('生成列表失败。', true)
      }
    } catch (error) {
      await this.ReportError(e, `查看角色 ${roleNameInput}`, error)
    }
    return true
  }

  async ExportSingleImage(e) {
    if (!(await this.CheckInit(e))) return true
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库未下载！', true)
    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i)
    if (!match?.[1]) return e.reply('例：#咕导出心海1', true)
    const targetIdentifierRaw = match[1].trim()
    let targetRelativePath = null
    let targetFileName = ''
    try {
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw)
      if (!parsedId) return e.reply('格式: 花火1', true)
      const { mainName: rawMainName, imageNumber } = parsedId
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger)
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName
      const targetIdentifierInternal = `${standardMainName}Gu${imageNumber}`
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`
      let foundCount = 0
      const imageData = MiaoPluginMBT.#imgDataCache.find(img => {
        const nameMatch = img.characterName === standardMainName
        const pathLower = img.path?.toLowerCase().replace(/\\/g, '/')
        const filenameMatch = pathLower?.endsWith(`/${expectedFilenameLower}`)
        if (nameMatch) foundCount++
        return nameMatch && filenameMatch
      })
      if (!imageData || !imageData.path) {
        let hint = `(原因：编号不存在、角色名/别名错误等)`
        if (MiaoPluginMBT.#imgDataCache.length === 0) hint = `(元数据缓存为空)`
        else if (foundCount === 0 && MiaoPluginMBT.#imgDataCache.length > 0)
          hint = `(无角色 '${standardMainName}' 记录)`
        else if (foundCount > 0) hint = `(找到 ${foundCount} 条 '${standardMainName}' 记录，但无编号 ${imageNumber})`
        return e.reply(`元数据中未找到: ${standardMainName}Gu${imageNumber}。\n${hint}`, true)
      }
      targetRelativePath = imageData.path.replace(/\\/g, '/')
      targetFileName = path.basename(targetRelativePath)
      if (MiaoPluginMBT.#activeBanSet.has(targetRelativePath)) return e.reply(`图片 ${targetFileName} 已被屏蔽。`, true)
      const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(targetRelativePath)
      if (!absolutePath) return e.reply(`文件丢失：${targetFileName}。`, true)
      try {
        await fsPromises.access(absolutePath, fs.constants.R_OK)
      } catch (accessErr) {
        return e.reply(`文件 ${targetFileName} 状态异常。`, true)
      }
      this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 导出: ${targetFileName}`)
      await e.reply([`📦 导出成功：${targetFileName}`, segment.file(absolutePath)])
    } catch (sendErr) {
      this.logger.error(`${this.logPrefix} 导出 ${targetFileName || targetIdentifierRaw} 失败:`, sendErr)
      try { 
        if (
            sendErr?.message?.includes('highway') ||
            sendErr?.message?.includes('file size') ||
            sendErr?.code === -36 ||
            sendErr?.code === 210005 || 
            sendErr?.code === 210003
        ){
            await e.reply(`发送文件失败：QQ文件上传通道出错(${sendErr.code || '未知'}),可能是签名API拒绝了本次传输`, true);
        }else{
            
            await this.ReportError(e, `导出文件 ${targetFileName || targetIdentifierRaw}`, sendErr);
        }
        } catch (replyError) { 
        this.logger.error(`${this.logPrefix} 发送导出失败提示时也出错:`, replyError);
      }
    }
    return true;
  }

  async Help(e) {
    const networkHelpUrl = 'https://s2.loli.net/2024/06/28/LQnN3oPCl1vgXIS.png'
    const localHelpPath = MiaoPluginMBT.paths.helpImagePath
    try {
      await fsPromises.access(localHelpPath, fs.constants.R_OK)
      await e.reply(segment.image(`file://${localHelpPath}`))
    } catch (localError) {
      if (localError.code !== ERROR_CODES.NotFound)
        this.logger.warn(`${this.logPrefix} [帮助] 本地图片访问失败:`, localError.code)
      try {
        await e.reply(segment.image(networkHelpUrl))
      } catch (networkError) {
        this.logger.error(`${this.logPrefix} [帮助] 在线图片发送失败:`, networkError.message)
        await e.reply(
          `${this.logPrefix} 无法获取帮助图。\n命令: #下载 #更新 #重置 #检查 #查看 #封禁 #解禁 #ban列表 #清空封禁 #设定净化 #启用/禁用 #导出 #测速 #帮助`
        )
      }
    }
    return true
  }

  async PluginInfo(e) {
    if (!(await this.CheckInit(e))) return true
    const version = this.GetVersion()
    await e.reply(`🐂 ${this.logPrefix} ${version} 运行中...`)
    let installTimeRepo1 = '未安装',
      installTimeRepo2 = '未配置'
    let Repo1Exists = false,
      Repo2Exists = false
    try {
      const stats1 = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath).catch(() => null)
      if (stats1) {
        installTimeRepo1 = stats1.ctime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        Repo1Exists = true
      }
    } catch {}
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    if (Repo2UrlConfigured) {
      installTimeRepo2 = '已配置但未下载'
      try {
        const stats2 = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath2).catch(() => null)
        if (stats2) {
          installTimeRepo2 = stats2.ctime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
          Repo2Exists = true
        } else if (await MiaoPluginMBT.IsTuKuDownloaded(2)) {
          Repo2Exists = true
          installTimeRepo2 = '已下载(无时间)'
        }
      } catch {}
    }
    await e.reply(`一号仓库安装: ${installTimeRepo1}\n二号仓库状态: ${installTimeRepo2}`)
    if (Repo1Exists) {
      const gitLog = await MiaoPluginMBT.GetTuKuLog(50, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)
      if (gitLog) {
        const logMessage = `一号仓库最近50条记录：\n${gitLog}`
        try {
          const forwardMsg = await common.makeForwardMsg(e, [logMessage], '一号仓库日志')
          if (forwardMsg) await e.reply(forwardMsg)
          else await e.reply(logMessage.substring(0, 300) + '...')
        } catch (fwdErr) {
          await e.reply(logMessage.substring(0, 300) + '...')
        }
      } else await e.reply('无法获取一号仓库日志。')
    } else await e.reply('一号仓库未下载。')
    let systemInfo = ''
    try {
      const platform = `${os.platform()} ${os.arch()}`
      const nodeVersion = process.version
      const memUsage = process.memoryUsage()
      const usedMB = (memUsage.rss / 1024 / 1024).toFixed(1)
      let yunzaiVersion = '未知'
      try {
        const pkgPath = path.join(MiaoPluginMBT.paths.YunzaiPath, 'package.json')
        const pkg = JSON.parse(await fsPromises.readFile(pkgPath, 'utf-8'))
        yunzaiVersion = pkg.version || '未知'
      } catch {}
      systemInfo = [
        `--- 系统信息 ---`,
        `系统: ${platform}`,
        `Node.js: ${nodeVersion}`,
        `Yunzai: ${yunzaiVersion}`,
        `咕咕牛: ${version}`,
        `内存: ${usedMB} MB`,
      ].join('\n')
    } catch (sysErr) {
      systemInfo = '无法获取系统信息。'
    }
    await e.reply(systemInfo)
    return true
  }
  
  async TriggerError(e) {
    if (!e.isMaster) return e.reply('仅限主人测试。')
    const match = e.msg.match(/#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?/i)
    const errorType = match?.[1]?.toLowerCase() || 'other'
    let mockError = new Error(`模拟错误 (${errorType})`)
    this.logger.warn(`${this.logPrefix} 用户 ${e.user_id} 触发模拟错误: "${errorType}"...`)
    await e.reply(`${this.logPrefix} 触发类型 "${errorType}" ...`)
    try {
      switch (errorType) {
        case 'git':
          mockError.message = '模拟Git失败'
          mockError.code = 128
          mockError.stderr = 'fatal: Repo not found'
          throw mockError
        case 'fs':
          mockError = new Error('模拟FS错误')
          mockError.code = ERROR_CODES.NotFound
          await fsPromises.access('/non/existent/path')
          break
        case 'config':
          mockError = new Error('模拟配置失败')
          mockError.code = 'YAMLParseError'
          throw mockError
        case 'data':
          mockError = new Error('模拟元数据失败')
          mockError.code = 'JSONParseError'
          throw mockError
        case 'ref':
          mockError = new ReferenceError('模拟引用错误')
          console.log(someUndefinedVariable)
          break
        case 'type':
          mockError = new TypeError('模拟类型错误')
          ;(123).iDontExist()
          break
        case 'Repo1':
          mockError = new Error('模拟一号仓库访问失败')
          mockError.code = ERROR_CODES.NotFound
          await fsPromises.access(path.join(MiaoPluginMBT.paths.LocalTuKuPath, 'non-existent'))
          break
        case 'Repo2':
          mockError = new Error('模拟二号仓库访问失败')
          mockError.code = ERROR_CODES.NotFound
          if (await MiaoPluginMBT.IsTuKuDownloaded(2))
            await fsPromises.access(path.join(MiaoPluginMBT.paths.LocalTuKuPath2, 'non-existent'))
          else throw new Error('二号仓库未下载')
          break
        case 'notify':
          this.logger.info(`${this.logPrefix} [触发错误] 模拟通知主人...`)
          const fakeCommitHash = Math.random().toString(16).substring(2, 9)
          const fakeDate = new Date()
            .toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })
            .replace(',', '')
          const fakeLog = `${fakeDate.replace('/', '-')} [${fakeCommitHash}] fix: 这是一个模拟的更新成功通知`
          const notifyMsg = `『咕咕牛🐂』定时更新成功！\n最新提交：${fakeLog}`
          await MiaoPluginMBT.SendMasterMsg(notifyMsg, undefined, 1000, this.logger)
          await e.reply(`${this.logPrefix} 已尝试发送模拟通知。`)
          return true
        default:
          throw mockError
      }
      throw mockError
    } catch (error) {
      await this.ReportError(e, `模拟错误 (${errorType})`, error, `用户触发: ${e.msg}`)
    }
    return true
  }

  async ManualTestProxies(e) {
    if (!(await this.CheckInit(e))) return true
    await e.reply(`${this.logPrefix} 开始代理测速...`)
    const startTime = Date.now()
    const formatSpeedResults = (speeds, title) => {
      let msg = `--- ${title} (${speeds.length}节点) ---\n`
      speeds.sort((a, b) => {
        if (a.speed === Infinity && b.speed !== Infinity) return 1
        if (a.speed !== Infinity && b.speed === Infinity) return -1
        if (a.speed === Infinity && b.speed === Infinity) return (a.priority ?? 999) - (b.priority ?? 999)
        if (a.priority !== b.priority) return (a.priority ?? 999) - (b.priority ?? 999)
        return a.speed - b.speed
      })
      speeds.forEach(s => {
        msg += `${s.name}: ${s.speed === Infinity ? '超时❌' : `${s.speed}ms✅`} (P:${s.priority ?? 'N'}) \n`
      })
      const best = MiaoPluginMBT.SelectBestProxy(speeds)
      msg += `\n✅优选: ${best ? `${best.name} (${best.speed}ms)` : '无'}`
      return msg.trim()
    }
    try {
      const speeds1 = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, this.logger)
      const msg1 = formatSpeedResults(speeds1, '一号仓库基准')
      let msg2 = ''
      const Repo2RawUrl = MiaoPluginMBT.MBTConfig?.Ass_Github_URL ? RAW_URL_Repo2 : null
      if (Repo2RawUrl) {
        const speeds2 = await MiaoPluginMBT.TestProxies(Repo2RawUrl, this.logger)
        msg2 = formatSpeedResults(speeds2, '二号仓库基准')
      } else {
        msg2 = '--- 二号仓库未配置 ---'
      }
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      await e.reply(`${msg1}\n\n${msg2}\n\n测速耗时 ${duration}s`)
    } catch (error) {
      await this.ReportError(e, '手动网络测速', error)
    }
    return true
  }

  GetVersion() {
    return MiaoPluginMBT.GetVersionStatic()
  }

  async RunUpdateTask() {
    this.logger.info(`${this.logPrefix} 定时更新启动...`)
    if (!MiaoPluginMBT.isGloballyInitialized) {
      this.logger.warn(`${this.logPrefix} [定时] 插件未初始化，跳过。`)
      return
    }
    if (this.isGitRunning) {
      this.logger.warn(`${this.logPrefix} [定时] Git 操作进行中，跳过。`)
      return
    }
    const pseudoEvent = {
      isMaster: true,
      user_id: 'cron_task',
      reply: msg =>
        this.logger.info(`${this.logPrefix} [Cron]: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`),
      msg: '#定时更新',
    }
    try {
      const hasChanges = await this.UpdateTuKu(pseudoEvent, true)
      this.logger.info(`${this.logPrefix} [定时] 执行完毕。`)
      if (hasChanges) {
        this.logger.info(`${this.logPrefix} [定时] 有更新，通知主人...`)
        const latestLog = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)
        await this.NotifyMasterUpdateSuccess(latestLog)
      } else {
        this.logger.info(`${this.logPrefix} [定时] 无更新。`)
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} [定时] 执行出错:`, error)
    } finally {
      if (this.isGitRunning) {
        this.logger.warn(`${this.logPrefix} [定时] Git 标志未重置！`)
        this.isGitRunning = false
      }
    }
  }
  
  async NotifyMasterUpdateSuccess(gitLog = '无日志') {
    const masters = Array.isArray(global.Bot?.master) ? global.Bot.master : [global.Bot?.master].filter(Boolean)
    if (!masters || masters.length === 0) {
      /* this.logger.warn(`${this.logPrefix} [定时] 未配置主人QQ。`); */
      return
    }
    let formattedLog = gitLog || '无法获取信息'
    if (formattedLog && formattedLog !== '无法获取信息') {
      const match = formattedLog.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2})\s+\[([a-f0-9]{7,})\]\s+(.*)$/)
      if (match) {
        const dateTime = match[1]
        const hash = match[2].substring(0, 7)
        const messageSummary = match[3].substring(0, 30) + (match[3].length > 30 ? '...' : '')
        formattedLog = `[${dateTime}-${hash}] ${messageSummary}`
      } else {
        formattedLog = formattedLog.substring(0, 50) + (formattedLog.length > 50 ? '...' : '')
      }
    }
    const notifyMsg = `『咕咕牛🐂』定时更新成功！\n最新提交：${formattedLog}`
    await MiaoPluginMBT.SendMasterMsg(notifyMsg, undefined, 1000, this.logger)
  }

  static async LoadTuKuConfig(
    forceReload = false,
    loggerInstance = global.logger || console,
    configPath = MiaoPluginMBT.paths.configFilePath
  ) {
    if (!forceReload && MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0)
      return MiaoPluginMBT.MBTConfig
    let configData = {}
    try {
      await fsPromises.access(configPath)
      const content = await fsPromises.readFile(configPath, 'utf8')
      configData = yaml.parse(content) || {}
      //loggerInstance.info(`${Default_Config.logPrefix} [加载配置] ${configPath}`)
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        loggerInstance.info(`${Default_Config.logPrefix} [加载配置] ${configPath} 未找到，使用默认。`)
        configData = {}
      } else {
        loggerInstance.error(`${Default_Config.logPrefix} [加载配置] 读取/解析 ${configPath} 失败:`, error)
        return null
      }
    }
    const loadedConfig = {
      TuKuOP: configData.TuKuOP ?? Default_Config.defaultTuKuOp,
      PFL: configData.PFL ?? Default_Config.defaultPfl,
      Main_Github_URL: Default_Config.Main_Github_URL,
      Ass_Github_URL: Default_Config.Ass_Github_URL,
      SepositoryBranch: Default_Config.SepositoryBranch,
      cronUpdate: configData.cronUpdate ?? Default_Config.cronUpdate,
    }
    if (![Purify_Level.NONE, Purify_Level.RX18_ONLY, Purify_Level.PX18_PLUS].includes(loadedConfig.PFL)) {
      loggerInstance.warn(
        `${Default_Config.logPrefix} [加载配置] 无效PFL(${loadedConfig.PFL})，重置为 ${Default_Config.defaultPfl}。`
      )
      loadedConfig.PFL = Default_Config.defaultPfl
    }
    MiaoPluginMBT.MBTConfig = loadedConfig
    /*
    if (MiaoPluginMBT.task && MiaoPluginMBT.task.cron !== loadedConfig.cronUpdate) { 
    loggerInstance.info(`${Default_Config.logPrefix} 
    Cron变更: -> ${loadedConfig.cronUpdate}`); } 
    */ 
    loggerInstance.info(
      `${Default_Config.logPrefix} [加载配置] 完成: 图库=${loadedConfig.TuKuOP}, PFL=${loadedConfig.PFL}`
    )
    return MiaoPluginMBT.MBTConfig
  }

  static async SaveTuKuConfig(configData, loggerInstance = global.logger || console) {
    const dataToSave = { TuKuOP: configData.TuKuOP, PFL: configData.PFL, cronUpdate: configData.cronUpdate }
    try {
      await fsPromises.mkdir(path.dirname(MiaoPluginMBT.paths.configFilePath), { recursive: true })
      const yamlString = yaml.stringify(dataToSave)
      await fsPromises.writeFile(MiaoPluginMBT.paths.configFilePath, yamlString, 'utf8')
      loggerInstance.info(`${Default_Config.logPrefix} [保存配置] ${MiaoPluginMBT.paths.configFilePath}`)
      MiaoPluginMBT.MBTConfig = { ...MiaoPluginMBT.MBTConfig, ...dataToSave }
      return true
    } catch (error) {
      loggerInstance.error(`${Default_Config.logPrefix} [保存配置] 写入失败:`, error)
      return false
    }
  }

  static async LoadImageData(forceReload = false, loggerInstance = global.logger || console) {
    if (MiaoPluginMBT.#imgDataCache?.length > 0 && !forceReload) return MiaoPluginMBT.#imgDataCache
    let data = null
    let success = false
    const primaryPath = MiaoPluginMBT.paths.imageDataPath
    const secondaryPath = path.join(
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.sourceFolders.gallery,
      path.basename(MiaoPluginMBT.paths.imageDataPath)
    )
    try {
      const content = await fsPromises.readFile(primaryPath, 'utf8')
      data = JSON.parse(content)
      //loggerInstance.info(`${Default_Config.logPrefix} [加载元数据] 主路径 ${primaryPath}`)
      success = true
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
       try {
          await fsPromises.access(secondaryPath)
          const sourceContent = await fsPromises.readFile(secondaryPath, 'utf8')
          data = JSON.parse(sourceContent)
          loggerInstance.info(`${Default_Config.logPrefix} [加载元数据] 仓库源路径 ${secondaryPath}`)
          success = true
        } catch (srcError) {
          if (srcError.code === ERROR_CODES.NotFound) {
            data = null
            success = false
          } else {
            loggerInstance.error(
              `${Default_Config.logPrefix} [加载元数据] 加载仓库源失败 (${secondaryPath}):`,
              srcError
            )
            data = null
            success = false
          }
        }
      } else {
        loggerInstance.error(`${Default_Config.logPrefix} [加载元数据] 读取/解析主路径失败 (${primaryPath}):`, error)
        data = null
        success = false
      }
    }
    let finalData = []
    if (!success || !Array.isArray(data) || data.length === 0) {
      loggerInstance.warn(`${Default_Config.logPrefix} [加载元数据] 无法从文件加载，执行扫描回退...`)
      try {
        finalData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(loggerInstance)
        loggerInstance.info(`${Default_Config.logPrefix} [加载元数据] 扫描回退完成: ${finalData.length} 条。`)
      } catch (scanError) {
        loggerInstance.error(`${Default_Config.logPrefix} [加载元数据] 扫描回退出错:`, scanError)
        finalData = []
      }
    } else {
      finalData = data
    }
    if (Array.isArray(finalData)) {
      const originalCount = finalData.length
      const validData = finalData
        .filter(item => {
          const isBasicValid =
            item &&
            typeof item.path === 'string' &&
            item.path.trim() !== '' &&
            typeof item.characterName === 'string' &&
            item.characterName.trim() !== '' &&
            typeof item.attributes === 'object'
          if (!isBasicValid) return false
          const pathRegex = /^[a-zA-Z0-9_-]+\/[^/]+\/[^/]+?[Gg][Uu]\d+\.webp$/i
          const normalizedPath = item.path.replace(/\\/g, '/')
          const pathIsValid = pathRegex.test(normalizedPath)
          if (!pathIsValid)
            loggerInstance.warn(`${Default_Config.logPrefix} [加载元数据] 过滤格式错误路径: ${item.path}`)
          return pathIsValid
        })
        .map(item => ({ ...item, path: item.path.replace(/\\/g, '/') }))
      const validCount = validData.length
      const invalidCount = originalCount - validCount
      if (invalidCount > 0)
        loggerInstance.warn(`${Default_Config.logPrefix} [加载元数据] 忽略 ${invalidCount} 条无效数据。`)
      loggerInstance.info(`${Default_Config.logPrefix} [加载元数据] 完成: ${validCount} 条有效记录。`)
      return validData
    } else {
      loggerInstance.error(`${Default_Config.logPrefix} [加载元数据] CRITICAL: 最终结果非数组！`)
      return []
    }
  }

  static async ScanLocalImagesToBuildCache(loggerInstance = global.logger || console) {
    const fallbackCache = []
    const ReposToScan = []
    if (await MiaoPluginMBT.IsTuKuDownloaded(1))
      ReposToScan.push({ num: 1, path: MiaoPluginMBT.paths.LocalTuKuPath, name: '一号仓库' })
    const Repo2Configured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    if (Repo2Configured && (await MiaoPluginMBT.IsTuKuDownloaded(2)))
      ReposToScan.push({ num: 2, path: MiaoPluginMBT.paths.LocalTuKuPath2, name: '二号仓库' })
    if (ReposToScan.length === 0) {
      loggerInstance.warn(`${Default_Config.logPrefix} [扫描回退] 无本地仓库。`)
      return []
    }
    loggerInstance.info(
      `${Default_Config.logPrefix} [扫描回退] 开始扫描: ${ReposToScan.map(r => r.name).join(', ')}...`
    )
    const imagePathsFound = new Set()
    for (const Repo of ReposToScan) {
      for (const gameFolderKey of Object.keys(MiaoPluginMBT.paths.sourceFolders)) {
        if (gameFolderKey === 'gallery') continue
        const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[gameFolderKey]
        if (!sourceFolderName) continue
        const gameFolderPath = path.join(Repo.path, sourceFolderName)
        try {
          await fsPromises.access(gameFolderPath)
          const characterDirs = await fsPromises.readdir(gameFolderPath, { withFileTypes: true })
          for (const charDir of characterDirs) {
            if (charDir.isDirectory()) {
              const characterName = charDir.name
              const charFolderPath = path.join(gameFolderPath, characterName)
              try {
                const imageFiles = await fsPromises.readdir(charFolderPath)
                for (const imageFile of imageFiles) {
                  if (imageFile.toLowerCase().endsWith('.webp')) {
                    const relativePath = path.join(sourceFolderName, characterName, imageFile).replace(/\\/g, '/')
                    if (!imagePathsFound.has(relativePath)) {
                      fallbackCache.push({ path: relativePath, characterName: characterName, attributes: {} })
                      imagePathsFound.add(relativePath)
                    }
                  }
                }
              } catch (readCharErr) {
                if (readCharErr.code !== ERROR_CODES.NotFound && readCharErr.code !== ERROR_CODES.Access)
                  loggerInstance.warn(
                    `${Default_Config.logPrefix} [扫描回退] 读取 ${charFolderPath} 失败:`,
                    readCharErr.code
                  )
              }
            }
          }
        } catch (readGameErr) {
          if (readGameErr.code !== ERROR_CODES.NotFound && readGameErr.code !== ERROR_CODES.Access)
            loggerInstance.warn(`${Default_Config.logPrefix} [扫描回退] 读取 ${gameFolderPath} 失败:`, readGameErr.code)
        }
      }
    }
    loggerInstance.info(`${Default_Config.logPrefix} [扫描回退] 完成: ${fallbackCache.length} 个 .webp 文件。`)
    return fallbackCache
  }

  static async SendMasterMsg(msg, botUin = global.Bot?.uin, sleep = 2000, loggerInstance = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;

    const botConfig = global.Config?.getConfig?.('bot') || {}; 
    const sendMasterConfig = global.Config?.sendMaster || {}; 
    const masterAppConfig = global.Config?.master || {}; 

    let masterQQ = [];
    let targetBotUin = botUin;

    if (Array.isArray(botConfig.masterQQ) && botConfig.masterQQ.length > 0) {
      masterQQ = [...botConfig.masterQQ];
    } else if (botConfig.masterQQ && !Array.isArray(botConfig.masterQQ)) {
      masterQQ = [String(botConfig.masterQQ)]; 
    }

    if (targetBotUin && masterAppConfig[targetBotUin] && masterAppConfig[targetBotUin].length > 0) {
      masterQQ = [...masterAppConfig[targetBotUin]]; 
      loggerInstance.debug(`${logPrefix} [通知主人] 使用 Bot ${targetBotUin} 的特定主人配置。`);
    } else {
      if (masterQQ.length === 0) { 
        loggerInstance.warn(`${logPrefix} [通知主人] 未在 bot.yaml 或 Config.master 中找到主人QQ配置。`);
        return false;
      }
      loggerInstance.debug(`${logPrefix} [通知主人] 使用 bot.yaml 中的全局主人列表。`);
    }

    masterQQ = masterQQ.map(qq => String(qq).trim()).filter(qq => /^\d{5,}$/.test(qq)); 
    if (masterQQ.length === 0) {
      loggerInstance.warn(`${logPrefix} [通知主人] 最终可用主人QQ列表为空。`);
      return false;
    }

    const masterSendMode = sendMasterConfig.Master; 
    let targets = []; 

    if (masterSendMode === 1) { 
      targets = masterQQ;
      loggerInstance.info(`${logPrefix} [通知主人] 配置为群发模式，目标数量: ${targets.length}`);
    } else if (masterSendMode === 0) { 
      targets = [masterQQ[0]];
      loggerInstance.info(`${logPrefix} [通知主人] 配置为仅首位模式，目标: ${targets[0]}`);
    } else if (masterSendMode && /^\d{5,}$/.test(String(masterSendMode))) { 
      targets = [String(masterSendMode)];
      loggerInstance.info(`${logPrefix} [通知主人] 配置为指定模式，目标: ${targets[0]}`);
    } else { 
      loggerInstance.warn(`${logPrefix} [通知主人] 未配置有效的发送模式 (Config.sendMaster.Master)，默认发送给首位主人: ${masterQQ[0]}`);
      targets = [masterQQ[0]];
    }

    if (targets.length === 0 || !targets[0]) { 
         loggerInstance.warn(`${logPrefix} [通知主人] 未确定有效的发送目标QQ。`);
         return false;
    }

    let successCount = 0;
    const isGroupSend = masterSendMode === 1 && targets.length > 1; 

    for (let i = 0; i < targets.length; i++) {
      const targetQQ = targets[i];
      if (!targetQQ) continue;

      try {
        let sent = false;
        if (global.Bot?.sendMasterMsg && typeof global.Bot.sendMasterMsg === 'function') {
          loggerInstance.debug(`${logPrefix} [通知主人] 尝试 Bot.sendMasterMsg -> ${targetQQ}`);
          sent = await global.Bot.sendMasterMsg(targetQQ, msg, targetBotUin);
          if(!sent){ 
             loggerInstance.warn(`${logPrefix} [通知主人] Bot.sendMasterMsg 调用返回失败，尝试回退...`);
          }
        }

        if (!sent && common?.relpyPrivate) {
          loggerInstance.debug(`${logPrefix} [通知主人] 尝试 common.relpyPrivate -> ${targetQQ}`);
          await common.relpyPrivate(targetQQ, msg, targetBotUin);
          sent = true; 
        } else if (!sent) {
          loggerInstance.error(`${logPrefix} [通知主人] 无法找到有效的发送方法！`);
          continue;
        }

        successCount++;
        loggerInstance.info(`${logPrefix} [通知主人] 已发送给 ${targetQQ} (${i+1}/${targets.length})`);

        if (isGroupSend && i < targets.length - 1 && sleep > 0) {
          await common.sleep(sleep);
        }
      } catch (error) {
        loggerInstance.error(`${logPrefix} [通知主人] 发送给 ${targetQQ} 出错:`, error);
      }
    } 

    loggerInstance.info(`${logPrefix} [通知主人] 发送流程结束，成功发送 ${successCount} 条。`);
    return successCount > 0; 
  }

  static async LoadUserBans(forceReload = false, loggerInstance = global.logger || console) {
    if (MiaoPluginMBT.#userBanSet instanceof Set && MiaoPluginMBT.#userBanSet.size > 0 && !forceReload) return true
    let data = []
    let success = false
    try {
      const content = await fsPromises.readFile(MiaoPluginMBT.paths.banListPath, 'utf8')
      data = JSON.parse(content)
      success = true
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        loggerInstance.info(`${Default_Config.logPrefix} [加载用户封禁] banlist.json 未找到。`)
        data = []
        success = true
      } else {
        loggerInstance.error(`${Default_Config.logPrefix} [加载用户封禁] 读取/解析失败:`, error)
        data = []
        success = false
      }
    }
    if (success && Array.isArray(data)) {
      const originalCount = data.length
      const validBans = data
        .filter(item => typeof item === 'string' && item.trim() !== '')
        .map(p => p.replace(/\\/g, '/'))
      MiaoPluginMBT.#userBanSet = new Set(validBans)
      const validCount = MiaoPluginMBT.#userBanSet.size
      const invalidOrDuplicateCount = originalCount - validCount
      if (invalidOrDuplicateCount > 0)
        loggerInstance.warn(`${Default_Config.logPrefix} [加载用户封禁] 忽略 ${invalidOrDuplicateCount} 条无效/重复。`)
      loggerInstance.info(`${Default_Config.logPrefix} [加载用户封禁] 完成: ${validCount} 条。`)
      return true
    } else {
      MiaoPluginMBT.#userBanSet = new Set()
      return false
    }
  }

  static async SaveUserBans(loggerInstance = global.logger || console) {
    const sortedBans = Array.from(MiaoPluginMBT.#userBanSet).sort()
    try {
      const jsonString = JSON.stringify(sortedBans, null, 2)
      await fsPromises.mkdir(path.dirname(MiaoPluginMBT.paths.banListPath), { recursive: true })
      await fsPromises.writeFile(MiaoPluginMBT.paths.banListPath, jsonString, 'utf8')
      loggerInstance.info(`${Default_Config.logPrefix} [保存用户封禁] ${MiaoPluginMBT.#userBanSet.size} 条记录。`)
      return true
    } catch (error) {
      loggerInstance.error(`${Default_Config.logPrefix} [保存用户封禁] 写入失败:`, error)
      return false
    }
  }
  static async LoadAliasData(forceReload = false, loggerInstance = global.logger || console) {
    if (MiaoPluginMBT.#aliasData && !forceReload) return true
    //loggerInstance.info(`${Default_Config.logPrefix} [加载别名] 开始...`)
    const aliasSources = [
      { key: 'gsAlias', path: path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, 'alias.js'), type: 'js' },
      { key: 'srAlias', path: path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, 'alias.js'), type: 'js' },
      { key: 'zzzAlias', path: path.join(MiaoPluginMBT.paths.target.zzzAliasDir, 'alias.yaml'), type: 'yaml' },
      { key: 'wavesAlias', path: path.join(MiaoPluginMBT.paths.target.wavesAliasDir, 'role.yaml'), type: 'yaml' },
    ]
    const loadedAliases = {}
    const combined = {}
    let overallSuccess = true
    const parseFile = async (filePath, fileType) => {
      let data = {}
      try {
        await fsPromises.access(filePath)
        if (fileType === 'js') {
          const fileUrl = `file://${filePath.replace(/\\/g, '/')}?t=${Date.now()}`
          try {
            const module = await import(fileUrl)
            if (module?.alias && typeof module.alias === 'object') data = module.alias
            else {
              overallSuccess = false
            }
          } catch (importErr) {
            if (importErr.code !== 'ERR_MODULE_NOT_FOUND') {
              loggerInstance.error(`${Default_Config.logPrefix} [加载别名] 导入 JS 失败 (${filePath}):`, importErr)
              overallSuccess = false
            }
          }
        } else if (fileType === 'yaml') {
          try {
            const content = await fsPromises.readFile(filePath, 'utf8')
            data = yaml.parse(content) || {}
          } catch (yamlErr) {
            loggerInstance.error(`${Default_Config.logPrefix} [加载别名] 解析 YAML 失败 (${filePath}):`, yamlErr)
            overallSuccess = false
          }
        }
      } catch (err) {
        if (err.code !== ERROR_CODES.NotFound) {
          loggerInstance.warn(`${Default_Config.logPrefix} [加载别名] 读取 ${fileType} 文件失败: ${filePath}`, err.code)
          overallSuccess = false
        }
      }
      return data
    }
    await Promise.all(
      aliasSources.map(async ({ key, path: filePath, type }) => {
        const data = await parseFile(filePath, type)
        loadedAliases[key] = data
        Object.assign(combined, data)
      })
    )
    MiaoPluginMBT.#aliasData = { ...loadedAliases, combined }
    const combinedCount = Object.keys(combined).length
    loggerInstance.info(`${Default_Config.logPrefix} [加载别名] 完成: ${combinedCount}主名。成功: ${overallSuccess}`)
    return overallSuccess
  }
  static async ApplyBanList(effectiveBanSet = MiaoPluginMBT.#activeBanSet, loggerInstance = global.logger || console) {
    if (!(effectiveBanSet instanceof Set) || effectiveBanSet.size === 0) {
      /* loggerInstance.info(`${Default_Config.logPrefix} [应用封禁] 列表为空。`); */ return
    }
    //loggerInstance.info(`${Default_Config.logPrefix} [应用封禁] 开始 (${effectiveBanSet.size} 条)...`)
    let deletedCount = 0
    const deletePromises = []
    for (const relativePath of effectiveBanSet) {
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath)
      if (targetPath) {
        deletePromises.push(
          fsPromises
            .unlink(targetPath)
            .then(() => {
              deletedCount++
            })
            .catch(unlinkErr => {
              if (unlinkErr.code !== ERROR_CODES.NotFound)
                loggerInstance.warn(`${Default_Config.logPrefix} [应用封禁] 删除 ${targetPath} 失败:`, unlinkErr.code)
            })
        )
      } else {
       
      }
    }
    await Promise.all(deletePromises)
    loggerInstance.info(
      `${Default_Config.logPrefix} [应用封禁] 完成: 处理 ${deletePromises.length} 项, 删除 ${deletedCount} 文件。`
    )
  }

  static async DetermineTargetPath(relativePath) {
    if (!relativePath) return null
    const logger = global.logger || console
    const normalizedRelativePath = relativePath.replace(/\\/g, '/')
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, '/'))
        return path.join(MiaoPluginMBT.paths.commonResPath, fileSync.destFileName)
    }
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncSpecific) {
      if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, '/'))
        return path.join(fileSync.destDir, fileSync.destFileName)
    }
    const parts = normalizedRelativePath.split('/')
    if (parts.length >= 3) {
      const sourceFolder = parts[0]
      const characterNameInRepo = parts[1]
      const fileName = parts.slice(2).join('/')
      let targetBaseDir = null,
        GameKey = null
      if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.gs) {
        targetBaseDir = MiaoPluginMBT.paths.target.miaoChar
        GameKey = 'gs'
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.sr) {
        targetBaseDir = MiaoPluginMBT.paths.target.miaoChar
        GameKey = 'sr'
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.zzz) {
        targetBaseDir = MiaoPluginMBT.paths.target.zzzChar
        GameKey = 'zzz'
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.waves) {
        targetBaseDir = MiaoPluginMBT.paths.target.wavesChar
        GameKey = 'waves'
      }
      if (targetBaseDir && GameKey) {
        const aliasResult = await MiaoPluginMBT.FindRoleAlias(characterNameInRepo)
        const targetCharacterName = aliasResult.exists ? aliasResult.mainName : characterNameInRepo
        return path.join(targetBaseDir, targetCharacterName, fileName)
      }
    }
    return null
  }

  static async FindImageAbsolutePath(relativePath) {
    if (!relativePath) return null
    const normalizedPath = relativePath.replace(/\\/g, '/')
    const logger = global.logger || console
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1)
    if (Repo1Exists) {
      const absPath1 = path.join(MiaoPluginMBT.paths.LocalTuKuPath, normalizedPath)
      try {
        await fsPromises.access(absPath1, fs.constants.R_OK)
        return absPath1
      } catch (err) {
        if (err.code !== ERROR_CODES.NotFound)
          logger.warn(`${Default_Config.logPrefix} [查找路径] 访问一号仓库 ${absPath1} 出错:`, err.code)
      }
    }
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2))
    if (Repo2Exists) {
      const absPath2 = path.join(MiaoPluginMBT.paths.LocalTuKuPath2, normalizedPath)
      try {
        await fsPromises.access(absPath2, fs.constants.R_OK)
        return absPath2
      } catch (err) {
        if (err.code !== ERROR_CODES.NotFound)
          logger.warn(`${Default_Config.logPrefix} [查找路径] 访问二号仓库 ${absPath2} 出错:`, err.code)
      }
    }
    return null
  }

  static async FindRoleAlias(inputName, loggerInstance = global.logger || console) {
    const cleanInput = inputName?.trim()
    if (!cleanInput) return { mainName: null, exists: false }
    if (!MiaoPluginMBT.#aliasData) {
      await MiaoPluginMBT.LoadAliasData(false, loggerInstance)
      if (!MiaoPluginMBT.#aliasData?.combined) {
        loggerInstance.error(`${Default_Config.logPrefix} [查找别名] 无法加载。`)
        return { mainName: cleanInput, exists: false }
      }
    }
    const combinedAliases = MiaoPluginMBT.#aliasData.combined || {}
    const lowerInput = cleanInput.toLowerCase()
    for (const mainNameKey in combinedAliases) {
      if (mainNameKey.toLowerCase() === lowerInput) return { mainName: mainNameKey, exists: true }
    }
    for (const [mainName, aliases] of Object.entries(combinedAliases)) {
      let aliasArray = []
      if (typeof aliases === 'string') aliasArray = aliases.split(',').map(a => a.trim().toLowerCase())
      else if (Array.isArray(aliases)) aliasArray = aliases.map(a => String(a).trim().toLowerCase())
      if (aliasArray.includes(lowerInput)) return { mainName: mainName, exists: true }
    }
    const dirExists = await MiaoPluginMBT.CheckRoleDirExists(cleanInput)
    return { mainName: cleanInput, exists: dirExists }
  }

  static async CheckRoleDirExists(roleName) {
    if (!roleName) return false
    const gameFolders = Object.values(MiaoPluginMBT.paths.sourceFolders).filter(
      f => f !== MiaoPluginMBT.paths.sourceFolders.gallery
    )
    const ReposToCheck = []
    if (await MiaoPluginMBT.IsTuKuDownloaded(1)) ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath)
    const Repo2Configured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    if (Repo2Configured && (await MiaoPluginMBT.IsTuKuDownloaded(2)))
      ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath2)
    if (ReposToCheck.length === 0) return false
    for (const RepoPath of ReposToCheck) {
      for (const gameFolder of gameFolders) {
        const rolePath = path.join(RepoPath, gameFolder, roleName)
        try {
          await fsPromises.access(rolePath)
          const stats = await fsPromises.stat(rolePath)
          if (stats.isDirectory()) return true
        } catch {}
      }
    }
    return false
  }
  static ParseRoleIdentifier(identifier) {
    if (!identifier) return null
    const match = identifier.trim().match(/^(.*?)?(?:Gu)?(\d+)$/i)
    if (match && match[1] && match[2]) {
      const mainName = match[1].trim()
      if (mainName) return { mainName: mainName, imageNumber: match[2] }
    }
    return null
  }
  static async GetTuKuLog(
    count = 5,
    RepoPath = MiaoPluginMBT.paths.LocalTuKuPath,
    loggerInstance = global.logger || console
  ) {
    if (!RepoPath) {
      return null
    }
    const gitDir = path.join(RepoPath, '.git')
    try {
      await fsPromises.access(gitDir)
      const stats = await fsPromises.stat(gitDir)
      if (!stats.isDirectory()) throw new Error('.git is not a directory')
    } catch (err) {
      return null
    }
    const format = Default_Config.gitLogFormat
    const dateformat = Default_Config.gitLogDateFormat
    const args = ['log', `-n ${Math.max(1, count)}`, `--date=${dateformat}`, `--pretty=format:${format}`]
    const gitOptions = { cwd: RepoPath }
    try {
      const result = await ExecuteCommand('git', args, gitOptions, 5000)
      return result.stdout.trim()
    } catch (error) {
      loggerInstance.warn(`${Default_Config.logPrefix} [获取日志] Git log 失败 (${RepoPath})`)
      return null
    }
  }
  
  static async DownloadRepoWithFallback(repoNum, repoUrl, branch, localPath, eForProgress, loggerInstance) {
    const logPrefix = Default_Config.logPrefix;
    const repoName = repoNum === 1 ? '一号仓库' : '二号仓库';
    const baseRawUrl = repoNum === 1 ? RAW_URL_Repo1 : RAW_URL_Repo2;
    loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 开始下载: ${repoUrl}`);
    let sourcesToTry = [];
    let allTestResults = [];
    try {
        allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, loggerInstance);
        sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, loggerInstance);
    } catch (testError) {
        loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 代理测速失败:`, testError);
        const githubSource = Default_Config.proxies.find(p => p.name === 'GitHub');
        if (githubSource) {
            sourcesToTry.push({...githubSource, speed: Infinity});
            allTestResults = Default_Config.proxies.map(p => ({...p, speed: Infinity}));
        }
    }

    if (eForProgress && repoNum === 1 && allTestResults.length > 0) {
        try {
            let speedMsg = `${logPrefix} 节点测速:\n\n`;
            allTestResults.sort((a, b) => {
                const prioA = a.priority ?? 999; const prioB = b.priority ?? 999;
                if (prioA !== prioB) return prioA - prioB;
                const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed;
                const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed;
                return speedA - speedB;
            });
            allTestResults.forEach(s => {
                let status = '';
                if (s.testUrlPrefix === null) { status = 'N/A ⚠️'; }
                else if (s.speed === Infinity) { status = '超时❌'; }
                else { status = `${s.speed}ms✅`; }
                speedMsg += `${s.name}: ${status} (P:${s.priority ?? 'N'})\n`;
            });
            const bestSource = sourcesToTry[0];
            if (bestSource) {
                 let bestSpeed = '';
                 if (bestSource.testUrlPrefix === null) bestSpeed = 'N/A';
                 else if (bestSource.speed === Infinity) bestSpeed = 'Timeout';
                 else bestSpeed = `${bestSource.speed}ms`;
                 speedMsg += `\n✅ 优选: ${bestSource.name}(${bestSpeed})`;
            } else { speedMsg += `\n❌ 无可用下载源`; }
            speedMsg += `\n⏳ 开始下载了.......`;
            await eForProgress.reply(speedMsg).catch(()=>{});
        } catch (replyError) { 
          loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 回复测速结果失败:`, replyError); 
        }
    }

    if (sourcesToTry.length === 0) {
        loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 没有任何可用的下载源！`);
        return { success: false, nodeName: '无可用源' };
    }

    let lastError = null;
    for (const source of sourcesToTry) {
        const nodeName = source.name === 'GitHub' ? 'GitHub(直连)' : `${source.name}(代理)`;
        loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 尝试使用源: ${nodeName}`);
        let cloneUrl = ''; let proxyForEnv = null;
        if (source.name === 'GitHub') { cloneUrl = repoUrl; }
        else if (source.cloneUrlPrefix) {
            if (source.name === 'GitClone') { cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl.replace(/^https?:\/\//, '')}`; }
            else { cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl}`; }
        } else {
           loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 源 ${source.name} 没有有效的 cloneUrlPrefix，跳过。`); 
           continue; 
          }
        if (source.name !== 'GitHub' && source.cloneUrlPrefix) {
             try {
                const proxyUrl = new URL(source.cloneUrlPrefix);
                if (['http:', 'https:'].includes(proxyUrl.protocol)) proxyForEnv = proxyUrl.origin;
             } catch (urlError) { 
              loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 无法解析代理 ${source.name} 的 cloneUrlPrefix: ${urlError.message}`); 
            }
        }
        const cloneArgs = ['clone', `--depth=${Default_Config.gitCloneDepth}`, '--progress', cloneUrl, localPath];
        const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };
        if (proxyForEnv) {
            gitOptions.env = { ...process.env, HTTP_PROXY: proxyForEnv, HTTPS_PROXY: proxyForEnv };
            //loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 为 Git 命令设置了代理环境变量: ${proxyForEnv}`);
        } else {
           loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 未设置代理环境变量。`); 
          }
        try {
            let progressReported = { 10: false, 50: false, 90: false };
            const cloneResult = await ExecuteCommand(
                'git', cloneArgs, gitOptions, Default_Config.gitCloneTimeout,
                stderrChunk => {
                    if (repoNum === 1 && eForProgress) {
                        const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/);
                        if (match?.[1]) {
                            const progress = parseInt(match[1], 10);
                            [10, 50, 90].forEach(t => {
                                if (progress >= t && !progressReported[t]) {
                                    progressReported[t] = true;
                                    const msg = `『咕咕牛』聚合下载: ${t}%... (${nodeName})`;
                                    eForProgress.reply(msg).catch(() => {});
                                }
                            });
                        }
                    } else if (repoNum !== 1) { const match = stderrChunk.match(/(Receiving objects|Resolving deltas):\s*(\d+)%/); if (match) loggerInstance.debug(`${logPrefix} [下载进度 ${repoName}] (${nodeName}) ${match[1]}: ${match[2]}%`); }
                }
            );
            loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载成功！`);
            return { success: true, nodeName: nodeName };
        } catch (error) {
            loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载失败。`); loggerInstance.error(error);
            lastError = error;
            loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 尝试清理失败的目录: ${localPath}`);
            await safeDelete(localPath);
            await common.sleep(1000);
            if (eForProgress && repoNum === 1) await eForProgress.reply(`${logPrefix} 使用 ${nodeName} 下载 ${repoName} 失败，尝试下一个源...`).catch(()=>{});
        }
    }
    loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 尝试了所有可用源，均下载失败！`);
    if (repoNum === 1 && eForProgress) {
       await MiaoPluginMBT.ReportError(eForProgress, `下载${repoName}`, lastError || new Error("所有源下载失败"), `尝试源: ${sourcesToTry.map(s=>s.name).join(', ')}`, loggerInstance); 
      
    }else{
       loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 最终错误:`, lastError || "未知错误"); }
    return { success: false, nodeName: '所有源失败', error: lastError };
  }

  static async UpdateSingleRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, loggerInstance) {
    const logPrefix = Default_Config.logPrefix
    loggerInstance.info(`${logPrefix} [更新仓库] ${RepoName}: ${localPath}`)
    let success = false,
      hasChanges = false,
      latestLog = null,
      pullOutput = ''
    try {
      let oldCommit = ''
      try {
        oldCommit = (await ExecuteCommand('git', ['rev-parse', 'HEAD'], { cwd: localPath }, 5000)).stdout.trim()
      } catch {}
      let needsReset = false
      try {
        const pullResult = await ExecuteCommand(
          'git',
          ['pull', '--ff-only', '--progress'],
          { cwd: localPath },
          Default_Config.gitPullTimeout
        )
        pullOutput = pullResult.stdout + pullResult.stderr
        success = true
      } catch (pullError) {
        pullOutput = pullError.stderr || pullError.stdout || pullError.message
        if (
          pullError.code !== 0 &&
          (pullError.stderr?.includes('commit') ||
            pullError.stderr?.includes('unrelated') ||
            pullError.stderr?.includes('lock') ||
            pullError.stderr?.includes('fast-forward') ||
            pullError.message?.includes('failed'))
        ) {
          needsReset = true
          loggerInstance.warn(`${logPrefix} [更新仓库] ${RepoName} 检测到冲突/异常，尝试强制重置...`)
        } else throw pullError
      }
      if (needsReset) {
        loggerInstance.warn(`${logPrefix} [更新仓库] ${RepoName} 执行强制重置...`)
        try {
          await ExecuteCommand('git', ['fetch', 'origin'], { cwd: localPath }, Default_Config.gitPullTimeout)
          const resetResult = await ExecuteCommand('git', ['reset', '--hard', `origin/${branch}`], { cwd: localPath })
          success = true
          loggerInstance.info(`${logPrefix} [更新仓库] ${RepoName} 强制重置成功。`)
        } catch (resetError) {
          loggerInstance.error(`${logPrefix} [更新仓库] ${RepoName} 强制重置失败。`)
          success = false
          throw resetError
        }
      }
      if (success) {
        let newCommit = ''
        try {
          newCommit = (await ExecuteCommand('git', ['rev-parse', 'HEAD'], { cwd: localPath }, 5000)).stdout.trim()
        } catch {}
        hasChanges = (oldCommit && newCommit && oldCommit !== newCommit) || (!oldCommit && !!newCommit)
        if (hasChanges) latestLog = await MiaoPluginMBT.GetTuKuLog(20, localPath, loggerInstance)
        else if (pullOutput.includes('Already up to date'))
          latestLog = await MiaoPluginMBT.GetTuKuLog(1, localPath, loggerInstance)
        else latestLog = await MiaoPluginMBT.GetTuKuLog(1, localPath, loggerInstance)
      }
    } catch (error) {
      success = false
      hasChanges = false
      loggerInstance.error(`${logPrefix} [更新仓库] ${RepoName} 操作失败。`)
      if (RepoNum === 1 && e && !isScheduled)
        await MiaoPluginMBT.ReportError(
          e,
          `更新${RepoName}`,
          error,
          `Git输出(部分):\n${pullOutput.substring(0, 500)}`,
          loggerInstance
        )
      else loggerInstance.error(error)
    }
    return { success, hasChanges, log: latestLog }
  }

  static async RunPostDownloadSetup(e, loggerInstance = global.logger || console) {
    loggerInstance.info(`${Default_Config.logPrefix} [下载后设置] 开始...`)
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, loggerInstance)
      await MiaoPluginMBT.SyncFilesToCommonRes(loggerInstance)
      const imageData = await MiaoPluginMBT.LoadImageData(true, loggerInstance)
      MiaoPluginMBT.#imgDataCache = Object.freeze(imageData)
      await MiaoPluginMBT.LoadUserBans(true, loggerInstance)
      await MiaoPluginMBT.LoadAliasData(true, loggerInstance)
      await MiaoPluginMBT.SyncSpecificFiles(loggerInstance)
      loggerInstance.info(`${Default_Config.logPrefix} [下载后设置] 应用初始封禁...`)
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, loggerInstance)
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        loggerInstance.info(`${Default_Config.logPrefix} [下载后设置] 同步角色图片...`)
        await MiaoPluginMBT.SyncCharacterFolders(loggerInstance)
      } else {
        loggerInstance.info(`${Default_Config.logPrefix} [下载后设置] 图库默认禁用。`)
      }
      loggerInstance.info(`${Default_Config.logPrefix} [下载后设置] 成功。`)
    } catch (error) {
      loggerInstance.error(`${Default_Config.logPrefix} [下载后设置] 失败:`, error)
      if (e) await MiaoPluginMBT.ReportError(e, '安装后设置', error, '', loggerInstance)
    }
  }

  static async RunPostUpdateSetup(e, isScheduled = false, loggerInstance = global.logger || console) {
    //loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 开始...`)
    try {
      //loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 加载配置数据...`)
      await MiaoPluginMBT.LoadTuKuConfig(true, loggerInstance)
      await MiaoPluginMBT.SyncFilesToCommonRes(loggerInstance)
      const imageData = await MiaoPluginMBT.LoadImageData(true, loggerInstance)
      MiaoPluginMBT.#imgDataCache = Object.freeze(imageData)
      await MiaoPluginMBT.LoadUserBans(true, loggerInstance)
      await MiaoPluginMBT.LoadAliasData(true, loggerInstance)
      loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 同步特定文件...`)
      await MiaoPluginMBT.SyncSpecificFiles(loggerInstance)
      loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 重新应用封禁...`)
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, loggerInstance)
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 同步更新图片...`)
        await MiaoPluginMBT.SyncCharacterFolders(loggerInstance)
      } else {
        loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 图库禁用。`)
      }
      //loggerInstance.info(`${Default_Config.logPrefix} [更新后设置] 完成。`)
    } catch (error) {
      loggerInstance.error(`${Default_Config.logPrefix} [更新后设置] 失败:`, error)
      if (!isScheduled && e) await MiaoPluginMBT.ReportError(e, '更新后设置', error, '', loggerInstance)
      else if (isScheduled) {
        const Report = MiaoPluginMBT.FormatError('更新后设置(定时)', error)
        loggerInstance.error(`${Default_Config.logPrefix}---定时更新后设置失败----\n${Report.summary}\n...`)
      }
    }
  }

  static async SyncFilesToCommonRes(loggerInstance = global.logger || console) {
    await fsPromises.mkdir(MiaoPluginMBT.paths.commonResPath, { recursive: true })
    let s = 0,
      f = 0
    for (const { sourceSubPath, destFileName } of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath),
        dest = path.join(MiaoPluginMBT.paths.commonResPath, destFileName)
      try {
        await fsPromises.access(source)
        await fsPromises.mkdir(path.dirname(dest), { recursive: true })
        await fsPromises.copyFile(source, dest)
        s++
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          loggerInstance.error(`${Default_Config.logPrefix} [同步公共] ${sourceSubPath} 失败:`, error)
          f++
        }
      }
    }
    loggerInstance.info(`${Default_Config.logPrefix} [同步公共] 完成: ${s}成功, ${f}失败/跳过。`)
  }

  static async SyncSpecificFiles(loggerInstance = global.logger || console) {
    let s = 0,
      f = 0
    for (const { sourceSubPath, destDir, destFileName } of MiaoPluginMBT.paths.filesToSyncSpecific) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath),
        dest = path.join(destDir, destFileName)
      try {
        await fsPromises.access(source)
        await fsPromises.mkdir(destDir, { recursive: true })
        await fsPromises.copyFile(source, dest)
        s++
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          loggerInstance.error(
            `${Default_Config.logPrefix} [同步特定] ${sourceSubPath} -> ${dest} 失败:`,
            error
          )
          f++
        }
      }
    }
    loggerInstance.info(`${Default_Config.logPrefix} [同步特定] 完成: ${s}成功, ${f}失败/跳过。`)
  }

  static async SyncCharacterFolders(loggerInstance = global.logger || console) {
    //loggerInstance.info(`${Default_Config.logPrefix} [同步角色] 开始...`)
    //loggerInstance.info(`${Default_Config.logPrefix} [同步角色] 清理目标...`)
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean)
    await Promise.all(targetPluginDirs.map(dir => MiaoPluginMBT.CleanTargetCharacterDirs(dir, loggerInstance)))
    if (!MiaoPluginMBT.#imgDataCache || MiaoPluginMBT.#imgDataCache.length === 0) {
      loggerInstance.warn(`${Default_Config.logPrefix} [同步角色] 元数据为空。`)
      return
    }
    if (!MiaoPluginMBT.#activeBanSet) loggerInstance.warn(`${Default_Config.logPrefix} [同步角色] 封禁列表未初始化。`)
    loggerInstance.info(
      `${Default_Config.logPrefix} [同步角色] 开始复制 (${MiaoPluginMBT.#imgDataCache.length}元数据)...`
    )
    let copied = 0,
      banned = 0,
      missingSource = 0,
      noTarget = 0
    const promises = []
    for (const imgData of MiaoPluginMBT.#imgDataCache) {
      const relativePath = imgData.path?.replace(/\\/g, '/')
      if (!relativePath || MiaoPluginMBT.#activeBanSet.has(relativePath)) {
        if (relativePath && MiaoPluginMBT.#activeBanSet.has(relativePath)) banned++
        continue
      }
      const sourcePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath)
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath)
      if (sourcePath && targetPath) {
        promises.push(
          (async () => {
            try {
              await fsPromises.mkdir(path.dirname(targetPath), { recursive: true })
              await fsPromises.copyFile(sourcePath, targetPath)
              copied++
            } catch (err) {
              if (err.code !== ERROR_CODES.NotFound)
                loggerInstance.warn(
                  `${Default_Config.logPrefix} [同步角色] 复制失败: ${path.basename(sourcePath)} -> ${targetPath}`,
                  err.code
                )
            }
          })()
        )
      } else if (!sourcePath) missingSource++
      else noTarget++
    }
    await Promise.all(promises)
    loggerInstance.info(
      `${Default_Config.logPrefix} [同步角色] 完成: 复制${copied}, 跳过(封禁${banned}+源丢失${missingSource}+无目标${noTarget})。`
    )
  }

  static async CleanTargetCharacterDirs(targetPluginDir, loggerInstance = global.logger || console) {
    if (!targetPluginDir) return
    loggerInstance.info(`${Default_Config.logPrefix} [清理目标] ${targetPluginDir}`)
    let cleanedCount = 0
    try {
      await fsPromises.access(targetPluginDir)
      const entries = await fsPromises.readdir(targetPluginDir, { withFileTypes: true })
      for (const entry of entries) {
        const entryPath = path.join(targetPluginDir, entry.name)
        if (entry.isDirectory()) {
          const characterPath = entryPath
          try {
            const files = await fsPromises.readdir(characterPath)
            const filesToDelete = files.filter(
              f => f.toLowerCase().startsWith('gu') && f.toLowerCase().endsWith('.webp')
            )
            for (const fileToDelete of filesToDelete) {
              const filePath = path.join(characterPath, fileToDelete)
              try {
                await fsPromises.unlink(filePath)
                cleanedCount++
              } catch (unlinkErr) {
                if (unlinkErr.code !== ERROR_CODES.NotFound)
                  loggerInstance.warn(`${Default_Config.logPrefix} [清理目标] 删除 ${filePath} 失败:`, unlinkErr.code)
              }
            }
          } catch (readSubErr) {
            if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readSubErr.code))
              loggerInstance.warn(`${Default_Config.logPrefix} [清理目标] 读取 ${characterPath} 失败:`, readSubErr.code)
          }
        } else if (
          entry.isFile() &&
          entry.name.toLowerCase().startsWith('gu') &&
          entry.name.toLowerCase().endsWith('.webp')
        ) {
          const rootFilePath = entryPath
          try {
            await fsPromises.unlink(rootFilePath)
            cleanedCount++
          } catch (delErr) {
            if (delErr.code !== ERROR_CODES.NotFound)
              loggerInstance.warn(
                `${Default_Config.logPrefix} [清理目标] 删除根文件 ${rootFilePath} 失败:`,
                delErr.code
              )
          }
        }
      }
      loggerInstance.info(
        `${Default_Config.logPrefix} [清理目标] 完成: ${targetPluginDir}, 清理 ${cleanedCount} 文件。`
      )
    } catch (readBaseErr) {
      if (readBaseErr.code !== ERROR_CODES.NotFound && readBaseErr.code !== ERROR_CODES.Access)
        loggerInstance.error(`${Default_Config.logPrefix} [清理目标] 读取 ${targetPluginDir} 失败:`, readBaseErr)
    }
  }

  static async RestoreFileFromSource(relativePath, loggerInstance = global.logger || console) {
    const sourcePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath)
    if (!sourcePath) {
      return false
    }
    const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath)
    if (!targetPath) {
      return false
    }
    try {
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true })
      await fsPromises.copyFile(sourcePath, targetPath)
      loggerInstance.info(`${Default_Config.logPrefix} [恢复文件] ${targetPath}`)
      return true
    } catch (copyError) {
      loggerInstance.error(`${Default_Config.logPrefix} [恢复文件] ${relativePath} 失败:`, copyError)
      return false
    }
  }

  static async TestProxies(baseRawUrl, loggerInstance = global.logger || console) {
    const testFile = Default_Config.proxyTestFile;
    const timeoutDuration = Default_Config.proxyTestTimeout;
    //loggerInstance.info(`${Default_Config.logPrefix} [网络测速] 基准: ${baseRawUrl} (${timeoutDuration}ms 超时)`);
    const testPromises = Default_Config.proxies.map(async (proxy) => { 
      let testUrl = '';
      let speed = Infinity;
      if (!proxy || typeof proxy !== 'object') {
          loggerInstance.error(`${Default_Config.logPrefix} [网络测速] 遇到无效的代理配置项: ${proxy}`);
          return { name: '无效配置', speed: Infinity, priority: 9999, cloneUrlPrefix: null, testUrlPrefix: null };
      }

      const proxyName = proxy.name || '未命名'; 
      if (proxy.testUrlPrefix === null) {
          loggerInstance.info(`${Default_Config.logPrefix} [网络测速] 代理 ${proxyName} 配置为不可测速，跳过。`);
          return { name: proxyName, speed: Infinity, priority: proxy.priority ?? 999, cloneUrlPrefix: proxy.cloneUrlPrefix, testUrlPrefix: null };
      }

      try {
        if (proxy.name === 'GitHub') {
          testUrl = baseRawUrl + testFile;
        } else if (proxy.testUrlPrefix) {
          testUrl = proxy.testUrlPrefix.replace(/\/$/, '') + testFile;
          try { new URL(testUrl); } catch(urlError) { loggerInstance.warn(`${Default_Config.logPrefix} [网络测速] 构造的代理URL (${testUrl}) 格式可能不规范:`, urlError.message); }
        } else {
           loggerInstance.warn(`${Default_Config.logPrefix} [网络测速] 代理 ${proxyName} 缺少 testUrlPrefix，跳过测试。`);
           return { name: proxyName, speed: Infinity, priority: proxy.priority ?? 999, cloneUrlPrefix: proxy.cloneUrlPrefix, testUrlPrefix: proxy.testUrlPrefix };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, timeoutDuration);
        const startTime = Date.now();

        try {
            const response = await fetch(testUrl, { method: 'GET', signal: controller.signal });
            clearTimeout(timeoutId);
            speed = Date.now() - startTime;
            if (!response.ok) {
                loggerInstance.warn(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 状态码非 OK: ${response.status}`);
                speed = Infinity;
            }
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                 speed = Infinity;
                 loggerInstance.warn(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 超时 (>${timeoutDuration}ms)`);
            } else {
                 loggerInstance.error(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) fetch 出错: ${fetchError.message}`);
                 speed = Infinity;
            }
        }
      } catch (error) {
          loggerInstance.error(`${Default_Config.logPrefix} [网络测速] 处理节点 ${proxyName} 时出错:`, error);
          speed = Infinity;
      }

      return {
        name: proxyName,
        speed: speed,
        priority: proxy.priority ?? 999,
        cloneUrlPrefix: proxy.cloneUrlPrefix,
        testUrlPrefix: proxy.testUrlPrefix
      };
    });
    const results = await Promise.all(testPromises);

    //loggerInstance.info(`${Default_Config.logPrefix} [网络测速] 完成。`);
    return results; 
  }

  static GetSortedAvailableSources(speeds, includeUntestable = false, loggerInstance = global.logger || console) {
    if (!speeds || speeds.length === 0) return [];
    const available = speeds.filter(s => {
      const testedOK = s.speed !== Infinity && (s.name === 'GitHub' || s.cloneUrlPrefix);
      const untestableButValid = includeUntestable && s.testUrlPrefix === null && s.cloneUrlPrefix;
      return testedOK || untestableButValid;
    });
    if (available.length === 0) { loggerInstance.warn(`${Default_Config.logPrefix} [选择源] 没有找到可用的下载源！`); return []; }
    available.sort((a, b) => {
      const prioA = a.priority ?? 999; const prioB = b.priority ?? 999;
      if (prioA !== prioB) return prioA - prioB;
      const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed;
      const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed;
      return speedA - speedB;
    });
    const sourceNames = available.map(s => `${s.name}(P:${s.priority ?? 'N'}${s.speed !== Infinity ? `, ${s.speed}ms` : (s.testUrlPrefix === null ? ', N/A' : ', Timeout')})`);
    loggerInstance.info(`${Default_Config.logPrefix} [选择源] 可用源排序: ${sourceNames.join(' > ')}`);
    return available;
  }

  static GetVersionStatic() {
    try {
      const pkgPath = path.resolve(__dirname, '..', 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return pkg.version || '4.7.4'
    } catch {
      return '4.7.4'
    }
  }
} 

const GUGUNIU_RULES = [
  { reg: /^#下载咕咕牛$/i, fnc: 'DownloadTuKu', permission: 'master' },
  { reg: /^#更新咕咕牛$/i, fnc: 'UpdateTuKu', permission: 'master' },
  { reg: /^#重置咕咕牛$/i, fnc: 'ManageTuKu', permission: 'master' },
  { reg: /^#检查咕咕牛$/i, fnc: 'CheckStatus' },
  { reg: /^#(启用|禁用)咕咕牛$/i, fnc: 'ManageTuKuOption', permission: 'master' },
  { reg: /^#(?:设置咕咕牛净化等级|设定净化)\s*([012])$/i, fnc: 'SetPurificationLevel', permission: 'master' },
  { reg: /^#咕咕牛封禁\s*.+$/i, fnc: 'ManageUserBans', permission: 'master' },
  { reg: /^#咕咕牛解禁\s*.+$/i, fnc: 'ManageUserBans', permission: 'master' },
  { reg: /^#(?:ban|咕咕牛封禁)列表$/i, fnc: 'ManageUserBans' },
  { reg: /^#清空咕咕牛封禁$/i, fnc: 'ManageUserBans', permission: 'master' },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: 'ExportSingleImage' },
  { reg: /^#查看\s*.+$/i, fnc: 'FindRoleSplashes' },
  { reg: /^#咕咕牛帮助$/i, fnc: 'Help' },
  { reg: /^#咕咕牛$/i, fnc: 'PluginInfo' },
  { reg: /^#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?$/i,
    fnc: 'TriggerError',
    permission: 'master',},
  { reg: /^#咕咕牛测速$/i, fnc: 'ManualTestProxies' },
  { reg: /^#执行咕咕牛更新$/i, fnc: 'ManualRunUpdateTask', permission: 'master' }
]
