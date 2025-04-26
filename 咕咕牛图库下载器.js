import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import os from 'node:os'
import yaml from 'yaml'
import common from '../../lib/common/common.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'

/**
 * @description 咕咕牛图库管理器 - 双仓库增强版
 * @version 4.8.0-Fix-Marks
 * @based v4.1.10 & v4.6.6
 * @description_details 
 *    - 实现双仓库并行下载及自动镜像源切换重试 (Fallback)。
 *    - 扩展并优化代理列表与优先级配置。修复代理测试与选择逻辑。
 *    - 确保代理环境变量正确传递给 Git 子进程。解决下载超时/失败后仍报告进度的时序问题。
 *    - 增强下载错误报告（显示尝试列表）。
 *    - #检查咕咕牛, #咕咕牛测速, #ban列表 命令改为图片渲染输出。
 *    - 修复净化等级1错误屏蔽Px18图片的问题。
 *    - 优化 #ban列表 图片发送顺序和空列表处理逻辑。
 *    - 结构化调试信息，角色详情转发，结构化测试日志，回滚数据，智能寻找，数据防干扰。
 */

// --- 全局常量与配置 ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const YunzaiPath = path.resolve(__dirname, '..', '..')

/**
 * @description 净化等级常量定义
 */
const Purify_Level = {
  NONE: 0,
  RX18_ONLY: 1,
  PX18_PLUS: 2,
  getDescription: level => ({ 0: '不过滤', 1: '过滤 R18', 2: '过滤 R18 及 P18' }[level] ?? '未知'),
}

/** @description Raw URL 测速 */
const RAW_URL_Repo1 = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main'
const RAW_URL_Repo2 = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT-2/main' // 弃用状态

/**
 * @description 默认配置项
 */
const Default_Config = {
  Main_Github_URL: 'https://github.com/GuGuNiu/Miao-Plugin-MBT/',
  Ass_Github_URL: 'https://github.com/GuGuNiu/Miao-Plugin-MBT-2/',
  SepositoryBranch: 'main',
  /**
   * @description 代理服务器列表配置
   * @todo  这个列表可能需要根据网络情况更新或调整优先级。
   */
  proxies: [
    {
      name: 'Moeyy',
      priority: 0,
      testUrlPrefix: `https://github.moeyy.xyz/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://github.moeyy.xyz/',
    },
    {
      name: 'Ghfast',
      priority: 10,
      testUrlPrefix: `https://ghfast.top/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://ghfast.top/',
    },
    { name: 'Ghp', 
      priority: 20, 
      testUrlPrefix: `https://ghp.ci/${RAW_URL_Repo1}`, 
      cloneUrlPrefix: 'https://ghp.ci/' 
    },
    {
      name: 'Ghgo',
      priority: 20,
      testUrlPrefix: `https://ghgo.xyz/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://ghgo.xyz/',
    },
    {
      name: 'Yumenaka',
      priority: 30,
      testUrlPrefix: `https://git.yumenaka.net/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://git.yumenaka.net/',
    },
    {
      name: 'GhConSh',
      priority: 35,
      testUrlPrefix: `https://gh.con.sh/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://gh.con.sh/',
    },
    {
      name: 'GhpsCc',
      priority: 45,
      testUrlPrefix: `https://ghps.cc/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://ghps.cc/',
    },
    {
      name: 'GhproxyCom',
      priority: 50,
      testUrlPrefix: `https://ghproxy.com/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://ghproxy.com/',
    },
    {
      name: 'GhproxyNet',
      priority: 50,
      testUrlPrefix: `https://ghproxy.net/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://ghproxy.net/',
    },
    {
      name: 'GhddlcTop',
      priority: 55,
      testUrlPrefix: `https://gh.ddlc.top/${RAW_URL_Repo1}`,
      cloneUrlPrefix: 'https://gh.ddlc.top/',
    },
        //----------- 不参与测速---不支持测速  Gitclone---------//
    { name: 'GitClone',   
      priority: 70, 
      testUrlPrefix: null, 
      cloneUrlPrefix: 'https://gitclone.com/' 
    }, 
        //----------- 不参与测速---不支持测速  Gitclone---------//
    {
      name: 'Mirror',
      priority: 80,
      testUrlPrefix: `https://raw.gitmirror.com/GuGuNiu/Miao-Plugin-MBT/main`,
      cloneUrlPrefix: 'https://hub.gitmirror.com/',
    },
    { 
      name: 'GitHub',
      priority: 300, 
      testUrlPrefix: RAW_URL_Repo1, 
      cloneUrlPrefix: 'https://github.com/' 
    }
  ],
  proxyTestFile: '/README.md',    //测速文件
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

/**
 * @description Node.js 文件系统错误代码常量
 */
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

// ========================================================================= //
// ========================= 公共工具函数区域 ============================ //
// ========================================================================= //
/**
 * @description 通用工具
 */


/**
 * @description 安全地递归删除文件或目录，带重试逻辑。
 */
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
          `${Default_Config.logPrefix} [安全删除] ${targetPath} 失败 (${attempts}/${maxAttempts}): ${err.code}, ${
            delay / 1000
          }s 后重试...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        logger.error(`${Default_Config.logPrefix} [安全删除] ${targetPath} 遇到未处理异常:`, err)
        throw err
      }
    }
  }
  return false
}

/**
 * @description 通用的递归复制文件夹函数，按扩展名过滤。
 */
async function copyFolderRecursive(source, target, options = {}, logger = global.logger || console) {
  const { ignoreSet = new Set(), filterExtension = null } = options
  const normalizedFilterExt = filterExtension ? filterExtension.toLowerCase() : null

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
        if (ignoreSet.has(entry.name) || entry.name === '.git') return

        const currentSource = path.join(source, entry.name)
        const currentTarget = path.join(target, entry.name)

        try {
          if (entry.isDirectory()) {
            await copyFolderRecursive(currentSource, currentTarget, options, logger)
          } else if (entry.isFile()) {
            const shouldCopy = !normalizedFilterExt || entry.name.toLowerCase().endsWith(normalizedFilterExt)
            if (shouldCopy) {
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
          }
        } catch (itemError) {
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(itemError.code)) {
            logger.warn(`${Default_Config.logPrefix} [递归复制] 处理 ${entry.name} 出错:`, itemError.code)
          }
        }
      })
    )
  } catch (error) {
    if (![ERROR_CODES.Exist, ERROR_CODES.Access, ERROR_CODES.Perm].includes(error.code)) {
      logger.error(`${Default_Config.logPrefix} [递归复制] 操作失败 ${source} -> ${target}:`, error)
    } else if (error.code !== ERROR_CODES.Exist) {
      logger.warn(`${Default_Config.logPrefix} [递归复制] 操作警告 ${source} -> ${target}:`, error.code)
    }
  }
}

/**
 * @description 执行外部命令，处理流，支持超时和信号终止。
 */
function ExecuteCommand(command, args, options = {}, timeout = 0, onStdErr, onStdOut) {
  return new Promise((resolve, reject) => {
    const logger = global.logger || console
    const cmdStr = `${command} ${args.join(' ')}`
    const cwd = options.cwd || process.cwd()
    logger.debug(`${Default_Config.logPrefix} [执行命令] > ${cmdStr} (CWD: ${cwd})`)

    const gitDebugEnv = { GIT_CURL_VERBOSE: '1', GIT_TRACE: '1' }
    options.env = { ...process.env, ...(options.env || {}), ...gitDebugEnv }

    let proc
    try {
      proc = spawn(command, args, { stdio: 'pipe', ...options })
    } catch (spawnError) {
      logger.error(`${Default_Config.logPrefix} [执行命令] 启动失败 [${cmdStr}]:`, spawnError)
      return reject(spawnError)
    }

    let stdout = ''
    let stderr = ''
    let timer = null
    let killed = false
    let exited = false
    let promiseSettled = false

    const settlePromise = (resolver, value) => {
      if (promiseSettled) return
      promiseSettled = true
      clearTimeout(timer)
      resolver(value)
    }
    const killProc = (signal = 'SIGTERM') => {
      if (proc && proc.pid && !killed && !exited && !proc.killed) {
        logger.warn(`${Default_Config.logPrefix} [执行命令] 发送 ${signal} 到 ${proc.pid} (${cmdStr})`)
        try {
          process.kill(proc.pid, signal)
          if (signal === 'SIGKILL') killed = true
        } catch (killError) {
          if (killError.code !== 'ESRCH')
            logger.error(`${Default_Config.logPrefix} [执行命令] kill ${proc.pid} 失败:`, killError)
        }
      }
    }

    if (timeout > 0) {
      timer = setTimeout(() => {
        if (exited || promiseSettled) return
        killed = true
        logger.warn(`${Default_Config.logPrefix} [执行命令] 命令 [${cmdStr}] 超时 (${timeout}ms)，终止...`)
        killProc('SIGTERM')
        setTimeout(() => {
          if (!exited) killProc('SIGKILL')
        }, 2000)
        const err = new Error(`Command timed out after ${timeout}ms: ${cmdStr}`)
        err.code = ERROR_CODES.Timeout
        err.stdout = stdout
        err.stderr = stderr
        settlePromise(reject, err)
      }, timeout)
    }

    proc.stdout?.on('data', data => {
      if (exited || killed || promiseSettled) return
      const output = data.toString()
      stdout += output
      if (onStdOut)
        try {
          onStdOut(output)
        } catch (e) {
          logger.warn(`${Default_Config.logPrefix} onStdOut 回调出错:`, e)
        }
    })
    proc.stderr?.on('data', data => {
      if (exited || killed || promiseSettled) return
      const output = data.toString()
      stderr += output
      if (onStdErr)
        try {
          onStdErr(output)
        } catch (e) {
          logger.warn(`${Default_Config.logPrefix} onStdErr 回调出错:`, e)
        }
    })
    proc.on('error', err => {
      if (promiseSettled) return
      exited = true
      logger.error(`${Default_Config.logPrefix} [执行命令] 进程错误 [${cmdStr}]:`, err)
      settlePromise(reject, err)
    })
    proc.on('close', (code, signal) => {
      if (exited || promiseSettled) return
      exited = true
      if (code === 0) {
        settlePromise(resolve, { code: 0, signal, stdout, stderr })
      } else {
        const err = new Error(`Command failed with code ${code}: ${cmdStr}`)
        err.code = code ?? 'UNKNOWN'
        err.signal = signal
        err.stdout = stdout
        err.stderr = stderr
        settlePromise(reject, err)
      }
    })
  })
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
          if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(statError.code)) {
            // logger.warn(`${Default_Config.logPrefix} [计算大小] 获取状态失败: ${entryPath}`, statError.code);  //调试用
          }
        }
      }
    } catch (readDirError) {
      if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readDirError.code)) {
        // logger.warn(`${Default_Config.logPrefix} [计算大小] 读取目录失败: ${currentPath}`, readDirError.code);  //调试用
      }
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
  if (i >= sizes.length) i = sizes.length - 1 // 防止超出范围
  const formattedValue = i === 0 ? bytes : parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  return `${formattedValue} ${sizes[i]}`
}

// ======================= 公共函数区域结束 ========================== //


export class MiaoPluginMBT extends plugin {
  // --- 静态属性 ---
  static initializationPromise = null
  static isGloballyInitialized = false
  static MBTConfig = {}
  static #imgDataCache = []
  static #userBanSet = new Set()
  static #activeBanSet = new Set()
  static #aliasData = null

  /** 
   * @description 存储所有重要的路径常量
   **/
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
    // 临时文件路径，确保存在
    tempPath: path.join(YunzaiPath, 'temp', 'guguniu'), // 统一放到 temp/guguniu 下
    tempHtmlPath: path.join(YunzaiPath, 'temp', 'guguniu', 'html'),
    tempImgPath: path.join(YunzaiPath, 'temp', 'guguniu', 'img'),
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
    // 需要同步到公共资源目录的文件列表
    filesToSyncToCommonRes: [
      { sourceSubPath: 'GuGuNiu-Gallery/help.webp', destFileName: 'help.webp' },
      { sourceSubPath: 'GuGuNiu-Gallery/imagedata.json', destFileName: 'imagedata.json' },
      // 配置和 HTML 模板也从仓库同步，但如果本地已存在则不覆盖（允许用户修改）
      { sourceSubPath: 'GuGuNiu-Gallery/GalleryConfig.yaml', destFileName: 'GalleryConfig.yaml', copyIfExists: false },
      { sourceSubPath: 'GuGuNiu-Gallery/html/status.html', destFileName: 'html/status.html', copyIfExists: false },
      { sourceSubPath: 'GuGuNiu-Gallery/html/banlist.html', destFileName: 'html/banlist.html', copyIfExists: false },
      {
        sourceSubPath: 'GuGuNiu-Gallery/html/speedtest.html',
        destFileName: 'html/speedtest.html',
        copyIfExists: false,
      },
    ],
    // 需要同步到特定插件目录的文件列表
    filesToSyncSpecific: [
      {
        sourceSubPath: '咕咕牛图库下载器.js',
        destDir: path.join(YunzaiPath, 'plugins', 'example'),
        destFileName: '咕咕牛图库下载器.js',
      },
    ],
  }

  // --- 实例属性 ---
  config = Default_Config
  logPrefix = Default_Config.logPrefix
  logger = global.logger || console
  isGitRunning = false
  isPluginInited = false
  task = null

  /**
   * @description 构造函数，初始化插件基本信息和定时任务。
   */
  constructor() {
    super({
      name: '『咕咕牛🐂』图库管理器 v4.8.0-Fix-Marks',
      dsc: '『咕咕牛🐂』图库管理器',
      event: 'message',
      priority: 500,
      rule: GUGUNIU_RULES,
    })
    this.task = {
      name: `${this.logPrefix} 定时更新`,
      cron: Default_Config.cronUpdate, // 初始使用默认值，会被配置覆盖
      fnc: () => this.RunUpdateTask(), 
      log: false, // 不记录定时任务的常规执行日志
    }
    this._initializeInstance() // 触发异步初始化流程
  }
  /**
   * @description 实例初始化逻辑，确保全局初始化完成后再标记实例初始化成功。
   */
  async _initializeInstance() {
    //this.logger.info(`【重要调试】_initializeInstance 方法开始执行！`);      //MAX级别 调试日志
    // 确保全局初始化只启动一次
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      MiaoPluginMBT.InitializePlugin(this.logger) 
    }
    try {
      // 等待全局初始化完成
      await MiaoPluginMBT.initializationPromise
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized
      // 如果初始化成功，检查并更新定时任务的 cron 表达式
      if (
        this.isPluginInited &&
        this.task &&
        MiaoPluginMBT.MBTConfig.cronUpdate &&
        this.task.cron !== MiaoPluginMBT.MBTConfig.cronUpdate
      ) {
        this.logger.info(
          `${this.logPrefix} 更新 Cron 表达式: ${this.task.cron} -> ${MiaoPluginMBT.MBTConfig.cronUpdate}`
        )
        this.task.cron = MiaoPluginMBT.MBTConfig.cronUpdate
      }
    } catch (initError) {
      this.logger.error(`${this.logPrefix} 实例等待全局初始化失败: ${initError.message}`)
      this.isPluginInited = false
    }
  }

  /**
   * @description 手动触发定时更新任务
   */
  async ManualRunUpdateTask(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!e.isMaster) return e.reply('抱歉，只有主人才能手动执行此任务。') 

    this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 手动触发定时更新任务...`)
    await e.reply(`${this.logPrefix} 正在手动执行定时更新任务，请稍候...`) 
    let taskError = null
    try {
      await this.RunUpdateTask() 
      this.logger.info(`${this.logPrefix} 手动执行的定时更新任务逻辑已完成。`)
    } catch (error) {
      taskError = error
      this.logger.error(`${this.logPrefix} 手动执行定时更新任务时发生错误:`, error)
    }

    this.logger.info(`${this.logPrefix} 准备向主人发送手动任务完成通知...`)
    let notifyMsg = ''
    if (taskError) {
      const shortErrMsg = String(taskError.message || taskError).substring(0, 100)
      notifyMsg = `『咕咕牛🐂』手动更新任务执行时遇到错误！\n错误(部分): ${shortErrMsg}\n请检查控制台日志获取详细信息。` 
    } else {
      const latestLog = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger) 
      let formattedLog = latestLog || '无法获取日志'
      if (formattedLog && formattedLog !== '无法获取日志') {
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
      notifyMsg = `『咕咕牛🐂』手动更新任务已执行完成。\n最新提交：${formattedLog}` 
    }

    const sent = await MiaoPluginMBT.SendMasterMsg(notifyMsg, undefined, 1000, this.logger) 

    if (taskError) {
      await e.reply(`${this.logPrefix} 手动更新任务执行过程中遇到错误，已尝试通知主人。请检查控制台日志。`, true) 
    } else {
      if (sent) {
        await e.reply(`${this.logPrefix} 手动更新任务执行完成，并已尝试通知主人。`, true) 
      } else {
        await e.reply(`${this.logPrefix} 手动更新任务执行完成，但通知主人失败 (未配置或发送错误)。`, true) 
      }
    }
    return true
  }

  /**
   * @description 检查插件是否已成功初始化，并在未初始化时阻止命令执行。
   *              v4.8.0 逻辑确保功能稳定并移除状态同步警告。
   *              ============================================================================

   *              ============================================================================

   *              已知无法解决的问题：函数执行顺序和异步操作完成时机共同作用下的时序问题，多实例的存在

   *              ============================================================================

   *              ============================================================================

   *  
  
      异步初始化: InitializePlugin 包含文件读写、网络请求等异步操作，它的完成时间是不确定的。
      多实例创建: Yunzai 可能在全局初始化完成之前就创建了第二个甚至更多的实例。
      状态不同步:
          全局状态 (isGloballyInitialized) 由第一次初始化异步更新。
          实例状态 (this.isPluginInited) 在每个实例的 _initializeInstance 中尝试与全局状态同步，但这个同步本身也受 await initializationPromise 的时序影响。
          当一个命令恰好由一个“醒来稍晚”（即它的 await 刚结束，但还没执行完 _initializeInstance 剩余部分）的实例处理时，
                    它的 this.isPluginInited 可能还是 false，但全局的 MiaoPluginMBT.isGloballyInitialized 可能已经是 true 了。
  */
  async CheckInit(e) { 
    // 检查是否是首次加载且未开始初始化
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 首次触发，开始初始化...`);
      await this._initializeInstance(); // 等待实例自身的初始化尝试完成
    }
    // 检查是否全局初始化正在进行中
    else if (MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 初始化进行中，等待...`);
      try {
        await MiaoPluginMBT.initializationPromise; // 等待全局初始化完成
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized; // 根据全局结果更新实例状态
      } catch (error) {
        // 等待过程中全局初始化失败
        this.logger.error(`${this.logPrefix} [核心检查] 等待初始化时捕获到错误:`, error.message || error);
        this.isPluginInited = false; // 明确标记实例初始化失败
      }
    }
    // 如果不是首次加载，也不是正在进行中，说明全局初始化已完成或已失败
    else {
      // 直接用全局状态更新实例状态
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
    }

    // 统一检查最终的实例初始化状态
    if (!this.isPluginInited) {
      await e.reply(`${this.logPrefix} 插件初始化失败或仍在进行中，请稍后再试。`, true); 
      return false; // 初始化未成功，阻止命令执行
    }

    // 确认初始化成功后，再检查核心数据是否有效加载
    let coreDataValid = true;
    if (!MiaoPluginMBT.MBTConfig || Object.keys(MiaoPluginMBT.MBTConfig).length === 0) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 配置丢失！`);
      coreDataValid = false;
    }
    if (!Array.isArray(MiaoPluginMBT.#imgDataCache)) { // 检查数组类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 元数据缓存无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT.#userBanSet instanceof Set)) { // 检查 Set 类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 用户封禁列表无效！`);
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT.#activeBanSet instanceof Set)) { // 检查 Set 类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 生效封禁列表无效！`);
      coreDataValid = false;
    }
    if (!MiaoPluginMBT.#aliasData) { // 检查是否为 null/undefined
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 别名数据丢失！`);
      coreDataValid = false;
    }

    // 如果核心数据无效，阻止命令执行
    if (!coreDataValid) {
      await e.reply(`${this.logPrefix} 内部状态错误，核心数据加载失败，请重启 Bot。`, true); 
      return false;
    }

    // 警告：元数据为空（非阻塞）
    if (MiaoPluginMBT.#imgDataCache.length === 0) {
      this.logger.warn(`${this.logPrefix} [核心检查] 注意：图片元数据为空，部分功能可能受限。`);
    }

    return true;
  }

  /**
   * @description 实例方法，调用静态的 ReportError。
   */
  async ReportError(e, operationName, error, context = '') {
    
    await MiaoPluginMBT.ReportError(e, operationName, error, context, this.logger) 
  }

  /**
   * @description 处理 #下载咕咕牛 命令，执行双仓库并行下载流程。         
   */
  async DownloadTuKu(e) { 
    if (!(await this.CheckInit(e))) return true; 
    if (this.isGitRunning) return e.reply(`${this.logPrefix} Git 操作进行中，请稍后再试...`);

    this.isGitRunning = true;
    const startTime = Date.now();
    let overallSuccess = false;
    // 初始化结果对象，确保有默认值
    let repo1Result = { repo: 1, success: false, nodeName: '未执行', error: null };
    let repo2Result = { repo: 2, success: true, nodeName: '未处理', error: null }; // Repo2 默认成功，除非需要下载且失败

    try {
        const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1); 
        const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
        let Repo2Exists = Repo2UrlConfigured ? await MiaoPluginMBT.IsTuKuDownloaded(2) : false;  // 检查初始状态

        // 如果仓库都已存在，直接返回
        if (Repo1Exists && (!Repo2UrlConfigured || Repo2Exists)) {
            this.isGitRunning = false;
            return e.reply(`${this.logPrefix} 图库已经下载好了，不用重复下载啦。`);
        }
        // 处理异常状态
        if (!Repo1Exists && Repo2Exists) {
            this.isGitRunning = false;
            await e.reply(`${this.logPrefix} 状态有点怪！二号仓库在，一号仓库却没了？建议先 #重置咕咕牛`);
            return true;
        }

        // 准备并行下载
        const downloadPromises = [];
        let repo2NeedsDownload = false; // 标记副仓库是否需要下载

        // 添加仓库1的下载任务
        if (!Repo1Exists) {
            this.logger.info(`${this.logPrefix} [并行下载] 添加一号仓库下载任务。`);
            downloadPromises.push(
                MiaoPluginMBT.DownloadRepoWithFallback( 
                    1,
                    Default_Config.Main_Github_URL,
                    MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
                    MiaoPluginMBT.paths.LocalTuKuPath,
                    e, // 传递 e 用于报告进度
                    this.logger
                ).then(result => ({ repo: 1, ...result })) // 包装结果
                 .catch(err => { // 捕获 downloadRepoWithFallback 可能抛出的未处理错误
                    this.logger.error(`${this.logPrefix} [并行下载] 一号仓库下载 Promise 捕获到错误:`, err);
                    return { repo: 1, success: false, nodeName: '执行异常', error: err };
                 })
            );
        } else {
            this.logger.info(`${this.logPrefix} [并行下载] 一号仓库已存在，跳过。`);
            downloadPromises.push(Promise.resolve({ repo: 1, success: true, nodeName: '本地' }));
        }

        // 添加仓库2的下载任务
        if (Repo2UrlConfigured && !Repo2Exists) {
            repo2NeedsDownload = true; // 标记需要下载
            this.logger.info(`${this.logPrefix} [并行下载] 添加二号仓库下载任务。`);
            downloadPromises.push(
                MiaoPluginMBT.DownloadRepoWithFallback( 
                    2,
                    MiaoPluginMBT.MBTConfig.Ass_Github_URL,
                    MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
                    MiaoPluginMBT.paths.LocalTuKuPath2,
                    null, // 仓库2不报告进度给用户
                    this.logger
                ).then(result => ({ repo: 2, ...result }))
                 .catch(err => {
                    this.logger.error(`${this.logPrefix} [并行下载] 二号仓库下载 Promise 捕获到错误:`, err);
                    return { repo: 2, success: false, nodeName: '执行异常', error: err };
                 })
            );
        } else if (Repo2UrlConfigured && Repo2Exists) {
             this.logger.info(`${this.logPrefix} [并行下载] 二号仓库已存在，跳过。`);
             downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '本地' }));
        } else {
             this.logger.info(`${this.logPrefix} [并行下载] 二号仓库未配置，跳过。`);
             downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '未配置' }));
        }

        // 等待所有下载任务完成 (无论成功或失败)
        const results = await Promise.allSettled(downloadPromises);
        this.logger.info(`${this.logPrefix} [并行下载] 所有下载任务已完成 (settled)。`);

        // 处理结果
        const repo1RawResult = results[0];
        const repo2RawResult = results[1];

        if (repo1RawResult.status === 'fulfilled') {
            repo1Result = repo1RawResult.value;
        } else {
            repo1Result = { repo: 1, success: false, nodeName: '执行异常', error: repo1RawResult.reason };
            this.logger.error(`${this.logPrefix} [并行下载] 一号仓库 Promise rejected:`, repo1RawResult.reason);
        }

        // 需要在后续逻辑中再次检查 Repo2 是否真的下载成功
        if (repo2RawResult.status === 'fulfilled') {
            repo2Result = repo2RawResult.value;
            // 如果是新下载的，更新 Repo2Exists 状态
            if (repo2NeedsDownload && repo2Result.success) {
                Repo2Exists = true;
            }
        } else {
            repo2Result = { repo: 2, success: false, nodeName: '执行异常', error: repo2RawResult.reason };
            this.logger.error(`${this.logPrefix} [并行下载] 二号仓库 Promise rejected:`, repo2RawResult.reason);
            Repo2Exists = false; // 下载失败，状态仍为不存在
        }


        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.info(`${this.logPrefix} [并行下载] 流程结束，耗时 ${duration} 秒。`);
        this.logger.info(`${this.logPrefix} [并行下载] 结果 - Repo 1: ${repo1Result.success ? '成功' : '失败'} (${repo1Result.nodeName}), Repo 2: ${repo2Result.success ? '成功' : '失败'} (${repo2Result.nodeName})`);

        overallSuccess = repo1Result.success; //整体成功与否仅取决于主仓库

        if (overallSuccess) {
            // 主仓库下载成功
            let repoStatusMessage = `『咕咕牛』\n✅ 一号仓库下载成功 (${repo1Result.nodeName})。`;
            if (Repo2UrlConfigured) {
                // 如果配置了副仓库
                if (repo2Result.success) {
                    // 副仓库也成功或无需下载
                    repoStatusMessage += `\n✅ 二号仓库状态: ${repo2Result.nodeName === '本地' ? '已存在' : (repo2Result.nodeName === '未配置' ? '未配置' : '下载成功 ('+repo2Result.nodeName+')')}。`;
                } else {
                    // 副仓库下载失败
                    repoStatusMessage += `\n⚠️ 二号仓库下载失败 (${repo2Result.nodeName})。`;
                    this.logger.error(`${this.logPrefix} [并行下载] 二号仓库下载失败详情:`, repo2Result.error);
                    // 是否需要报告副仓库的错误给用户
                    // await this.ReportError(e, '下载副仓库', repo2Result.error); 
                }
            }
            await e.reply(repoStatusMessage).catch(()=>{}); // 报告仓库状态

            this.logger.info(`${this.logPrefix} [并行下载] 执行下载后设置...`);
            await MiaoPluginMBT.RunPostDownloadSetup(e, this.logger); 
            this.logger.info(`${this.logPrefix} [并行下载] 下载后处理完成。`);

            // 尝试获取并展示初始日志 (如果副仓库是新下载的)
            let logMessages = [];
            const gitLog1 = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger); 
            if (gitLog1) logMessages.push(`--- 一号仓库初始提交 ---\n${gitLog1}`);

            // 只有当副仓库是这次新下载且成功时才获取其日志
            if (repo2NeedsDownload && repo2Result.success) {
                const gitLog2 = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath2, this.logger); 
                if (gitLog2) logMessages.push(`--- 二号仓库初始提交 ---\n${gitLog2}`);
            }

            // 如果有日志，发送合并转发
            if (logMessages.length > 0) {
                try {
                    const forwardMsg = await common.makeForwardMsg(e, logMessages, '仓库初始日志');
                    if (forwardMsg) await e.reply(forwardMsg);
                } catch (fwdErr) { this.logger.warn(`${this.logPrefix} 发送初始日志失败:`, fwdErr); }
            }

            await e.reply("『咕咕牛』成功进入喵喵里面！").catch(()=>{});

        } else {
            // 主仓库下载失败
            finalUserMessage = `『咕咕牛』核心仓库下载失败 (${repo1Result.nodeName})。请检查日志或网络后重试。`;
            // 如果 repo1Result.error 存在，考虑报告更详细的错误
            if (repo1Result.error) {
                await this.ReportError(e, '下载核心仓库', repo1Result.error); 
            } else {
                await e.reply(finalUserMessage).catch(()=>{});
            }
        }
    } catch (error) {
        // 顶层 try-catch，捕获并行逻辑本身或其他意外错误
        this.logger.error(`${this.logPrefix} [DownloadTuKu] 顶层执行出错:`, error);
        await this.ReportError(e, '下载图库顶层', error); 
        overallSuccess = false;
    } finally {
        this.isGitRunning = false; // 确保标志被重置
        // this.logger.info(`${this.logPrefix} [并行下载] isGitRunning 标志已重置为 false。`); // 调试用
    }
    return true; 
  }

  /**
   * @description 处理 #更新咕咕牛 命令，执行双仓库更新流程。
   *              更新成功后，如果副仓库有更新，也获取并展示其日志。
   */
  async UpdateTuKu(e, isScheduled = false) { 
    if (!isScheduled && !(await this.CheckInit(e))) return false; 
    if (this.isGitRunning) {
      if (!isScheduled && e) await e.reply(`${this.logPrefix} Git 操作进行中...`); 
      return false;
    }

    // 检查仓库是否存在
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1); 
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2)); 

    if (!Repo1Exists && (!Repo2UrlConfigured || !Repo2Exists)) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』图库还没下载呢，先 `#下载咕咕牛` 吧。', true); 
      return false;
    }
    // 处理仓库状态不一致的情况
    if (Repo1Exists && Repo2UrlConfigured && !Repo2Exists) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』一号仓库在，但二号仓库不见了。建议先 `#重置咕咕牛` 再重新下载。', true); 
      return false;
    }
    if (!Repo1Exists && Repo2Exists) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』状态有点怪！二号仓库在，一号仓库没了？建议先 `#重置咕咕牛`。', true); 
      return false;
    }

    this.isGitRunning = true;
    const startTime = Date.now();
    if (!isScheduled && e) await e.reply('『咕咕牛🐂』开始检查更新，稍等片刻...', true); 
    this.logger.info(`${this.logPrefix} [更新流程] 开始 @ ${new Date(startTime).toISOString()}`);

    let Repo1Updated = false, Repo2Updated = false;
    let Repo1Success = true, Repo2Success = true;
    let overallHasChanges = false;
    let finalUserMessage = '';
    let gitLogRepo1 = '', gitLogRepo2 = ''; // 分别记录日志

    try {
      // 更新主仓库 (如果存在)
      if (Repo1Exists) {
        const result1 = await MiaoPluginMBT.UpdateSingleRepo( 
          e, 1, MiaoPluginMBT.paths.LocalTuKuPath, '一号仓库',
          Default_Config.Main_Github_URL,
          MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
          isScheduled, this.logger
        );
        Repo1Success = result1.success;
        Repo1Updated = result1.hasChanges;
        if (!Repo1Success && !isScheduled) finalUserMessage = '一号仓库更新失败了...'; 
        else if (Repo1Success) { // 无论是否有更新，都记录日志
             gitLogRepo1 = result1.log || '';
             if(Repo1Updated) this.logger.info(`${this.logPrefix} 一号仓库更新了内容。`);
             else this.logger.info(`${this.logPrefix} 一号仓库已经是最新版本。`);
        }
      } else {
        Repo1Success = false; // 主仓库不存在，更新自然失败
      }

      // 更新副仓库 (如果配置且存在，并且主仓库更新成功)
      if (Repo1Success && Repo2UrlConfigured && Repo2Exists) {
        const result2 = await MiaoPluginMBT.UpdateSingleRepo( 
          null, 2, MiaoPluginMBT.paths.LocalTuKuPath2, '二号仓库',
          MiaoPluginMBT.MBTConfig.Ass_Github_URL,
          MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
          isScheduled, this.logger
        );
        Repo2Success = result2.success;
        Repo2Updated = result2.hasChanges;
        if (!Repo2Success && !isScheduled && !finalUserMessage) finalUserMessage = '二号仓库更新失败了...'; 
        else if (Repo2Success) { // 无论是否有更新，都记录日志
            gitLogRepo2 = result2.log || '';
            if(Repo2Updated) this.logger.info(`${this.logPrefix} 二号仓库更新了内容。`);
            else this.logger.info(`${this.logPrefix} 二号仓库已经是最新版本。`);
        }
      } else if (Repo2UrlConfigured && !Repo2Exists) {
        // 副仓库配置了但不存在，不需要更新，也不算失败
        this.logger.info(`${this.logPrefix} 二号仓库未下载，跳过更新。`);
      } else if (!Repo2UrlConfigured) {
        // 副仓库未配置，自然成功
        Repo2Success = true;
      }

      overallHasChanges = Repo1Updated || Repo2Updated; // 任意一个仓库有更新就算有变化
      const overallSuccess = Repo1Success && Repo2Success; // 必须所有需要更新的仓库都成功才算成功

      if (overallSuccess) {
        if (overallHasChanges) {
          // 有更新，执行后处理
          if (!isScheduled && e) await e.reply(`${this.logPrefix} 检测到更新，正在应用变更...`); 
          await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, this.logger); 

          if (!isScheduled && e) {
            // 手动更新成功，回复用户
            if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新成功啦！'; 

            //准备合并转发的日志消息
            let logMessages = [];
            if (gitLogRepo1) logMessages.push(`--- 一号仓库最新记录 ---\n${gitLogRepo1}`); 
            //只有在副仓库实际更新了内容时，才显示其日志
            if (gitLogRepo2 && Repo2Updated) logMessages.push(`--- 二号仓库更新记录 ---\n${gitLogRepo2}`); 

            if (logMessages.length > 0) {
              try {
                const forwardMsg = await common.makeForwardMsg(e, logMessages, '『咕咕牛』更新详情'); 
                if (forwardMsg) await e.reply(forwardMsg);
                else await e.reply(finalUserMessage + ' (日志发送失败)'); 
              } catch (fwdErr) {
                 this.logger.error(`${this.logPrefix} 创建更新日志转发消息失败:`, fwdErr);
                 await e.reply(finalUserMessage + ' (日志发送失败)'); 
              }
            } else {
              // 如果都没日志（理论上因为 hasChanges 为 true 不会到这里）
              await e.reply(finalUserMessage);
            }
          } else if (isScheduled && overallHasChanges) {
            // 定时任务有更新，通知主人
            this.logger.info(`${this.logPrefix} [定时] 检测到更新，准备通知主人...`);
            // 定时通知通常只需要主仓库的最新状态即可
            const latestLogCombined = gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)); 
            await this.NotifyMasterUpdateSuccess(latestLogCombined); 
          }
        } else {
          // 没有更新
          this.logger.info(`${this.logPrefix} 所有仓库均已是最新版本。`);
          if (!isScheduled && e) {
            finalUserMessage = '『咕咕牛』已经是最新版本啦，不用更新了~'; 
            await e.reply(finalUserMessage);
            // 显示一下最新的提交信息 (主仓库的)
            const latestLog = gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)); 
            if (latestLog) await e.reply(`最新提交：${latestLog}`); 
          } else if (isScheduled) {
            this.logger.info(`${this.logPrefix} [定时] 无更新内容。`);
          }
        }
      } else {
        // 更新过程失败
        this.logger.error(`${this.logPrefix} 更新过程出错。`);
        if (!isScheduled && e) {
          if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新过程中出错了，快去看看日志！'; 
          // 如果主仓库更新失败，错误报告可能已在 UpdateSingleRepo 中发送
          // 如果是副仓库失败，这里可以补充报告
          if (Repo1Success && !Repo2Success) {
              // 这里可以调用 ReportError 报告 repo2 的错误
              // const repo2Error = ... // 需要从 UpdateSingleRepo 获取错误对象
              // await this.ReportError(e, '更新副仓库', repo2Error);
          }
          await e.reply(finalUserMessage);
        }
        overallHasChanges = false; // 失败了就不算有变化
      }
    } catch (error) {
      // 捕获顶层异常
      this.logger.error(`${this.logPrefix} 更新流程发生严重异常:`, error);
      if (!isScheduled && e) await this.ReportError(e, '更新图库', error); 
      else if (isScheduled) this.logger.error(`${this.logPrefix} [定时] 执行更新时发生严重错误:`, error);
      overallHasChanges = false;
    } finally {
      this.isGitRunning = false; // 保证标志被重置
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.info(`${this.logPrefix} 更新流程结束，耗时 ${duration} 秒。`);
    }
    return overallHasChanges; 
  }

  /**
   * @description 处理 #重置咕咕牛 命令，彻底清理图库相关文件和状态。
   */
  async ManageTuKu(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!e.isMaster) return e.reply(`${this.logPrefix} 这个操作只有我的主人才能用哦~`) 

    const msg = e.msg.trim()
    if (msg !== '#重置咕咕牛') {
      return false
    }

    const actionVerb = '重置'
    const startMessage = '『咕咕牛🐂』收到！开始彻底重置图库，请稍等...' 
    const successMessage = '『咕咕牛🐂』重置完成！所有相关文件和缓存都清理干净啦。现在可以重新 `#下载咕咕牛` 了。' 
    const failureMessage = '『咕咕牛🐂』重置过程中好像出了点问题，可能没清理干净，快去看看日志吧！' 

    await e.reply(startMessage, true)
    this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 执行 ${actionVerb} 操作.`)

    const pathsToDeleteDirectly = [
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.LocalTuKuPath2,
      MiaoPluginMBT.paths.commonResPath,
    ].filter(Boolean)

    let deleteSuccess = true
    for (const dirPath of pathsToDeleteDirectly) {
      this.logger.info(`${this.logPrefix} 正在删除: ${dirPath}`)
      try {
        const deleted = await safeDelete(dirPath)
        if (!deleted) {
          this.logger.warn(`${this.logPrefix} 删除 ${dirPath} 未完全成功`)
        }
      } catch (err) {
        this.logger.error(`${this.logPrefix} 删除 ${dirPath} 时发生错误:`, err)
        deleteSuccess = false
      }
    }

    this.logger.info(`${this.logPrefix} 开始清理目标插件目录中的残留文件...`)
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
        
        this.logger.error(`${this.logPrefix} 清理目标插件目录 ${dirPath} 时出错:`, err)
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
    this.logger.info(`${this.logPrefix} 内存状态已重置。`)

    if (deleteSuccess && cleanSuccess) {
      await e.reply(successMessage)
    } else {
      await e.reply(failureMessage)
    }

    return true
  }
  /**
   * @description 处理 #检查咕咕牛 命令，生成并发送状态报告图片。
   */
  async CheckStatus(e) {
    
    if (!(await this.CheckInit(e))) return true 
    this.logger.info(`${this.logPrefix} [检查状态] 开始生成状态报告...`)

    // 检查仓库存在状态
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1) 
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2)) 
    this.logger.info(
      `${this.logPrefix} [检查状态] 仓库状态 - 一号: ${Repo1Exists ? '存在' : '不存在'}, 二号: ${
        Repo2UrlConfigured ? (Repo2Exists ? '存在' : '未下载') : '未配置'
      }`
    )

    // 如果主仓库不存在，提示先下载
    if (!Repo1Exists) {
      return e.reply('『咕咕牛🐂』核心图库还没下载呢，先 `#下载咕咕牛` 吧！', true) 
    }
    // 如果状态异常，提示重置
    if (Repo1Exists && Repo2UrlConfigured && !Repo2Exists) {
      return e.reply('『咕咕牛🐂』一号仓库在，但二号仓库不见了。建议先 `#重置咕咕牛` 再重新下载。', true) 
    }
    if (!Repo1Exists && Repo2Exists) {
      // 这个理论上在 checkInit 后不会发生，但作为保险
      return e.reply('『咕咕牛🐂』状态异常！二号仓库在，一号仓库没了？建议先 `#重置咕咕牛`。', true) 
    }

    let tempHtmlFilePath = '' // 临时 HTML 文件路径
    let tempImgFilePath = '' // 临时图片文件路径

    try {
      // 准备渲染数据结构
      const pluginVersion = MiaoPluginMBT.GetVersionStatic(); // 获取插件版本
      const GameFoldersMap = { gs: '原神', sr: '星铁', zzz: '绝区零', waves: '鸣潮' }
      const stats = {
        meta: { roles: 0, images: 0, games: {} }, // 元数据统计
        scan: {
          // 本地文件扫描统计
          roles: 0,
          images: 0,
          gameImages: {},
          gameRoles: {},
          gameSizes: {},
          gameSizesFormatted: {},
          totalSize: 0,
          totalGitSize: 0,
          totalFilesSize: 0,
          totalSizeFormatted: '0 B',
          totalGitSizeFormatted: '0 B',
          totalFilesSizeFormatted: '0 B',
        },
        repos: {
          // 各仓库统计
          1: {
            name: '一号仓库',
            exists: Repo1Exists,
            size: 0,
            gitSize: 0,
            filesSize: 0,
            sizeFormatted: 'N/A',
            gitSizeFormatted: 'N/A',
            filesSizeFormatted: 'N/A',
          },
          2: {
            name: '二号仓库',
            exists: Repo2Exists && Repo2UrlConfigured,
            size: 0,
            gitSize: 0,
            filesSize: 0,
            sizeFormatted: 'N/A',
            gitSizeFormatted: 'N/A',
            filesSizeFormatted: 'N/A',
          },
        },
      }
      // 初始化游戏统计数据
      Object.values(GameFoldersMap).forEach(gameName => {
        stats.meta.games[gameName] = 0
        stats.scan.gameImages[gameName] = 0
        stats.scan.gameRoles[gameName] = 0
        stats.scan.gameSizes[gameName] = 0
        stats.scan.gameSizesFormatted[gameName] = '0 B'
      })

      // 读取配置信息
      const config = {
        enabled: MiaoPluginMBT.MBTConfig?.TuKuOP ?? Default_Config.defaultTuKuOp,
        pflLevel: MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl,
        activeBans: MiaoPluginMBT.#activeBanSet?.size ?? 0,
        userBans: MiaoPluginMBT.#userBanSet?.size ?? 0,
        purifiedBans: 0,
        enabledText: '',
        pflDesc: '',
      }
      config.enabledText = config.enabled ? '已启用' : '已禁用'
      config.purifiedBans = Math.max(0, config.activeBans - config.userBans)
      config.pflDesc = Purify_Level.getDescription(config.pflLevel)

      // 元数据统计
      const characterSet = new Set()
      if (Array.isArray(MiaoPluginMBT.#imgDataCache) && MiaoPluginMBT.#imgDataCache.length > 0) {
        stats.meta.images = MiaoPluginMBT.#imgDataCache.length
        MiaoPluginMBT.#imgDataCache.forEach(item => {
          if (item && item.characterName) {
            characterSet.add(item.characterName)
          }
          const PathParts = item?.path?.split('/')
          if (PathParts?.length > 0) {
            const GameKey = PathParts[0].split('-')[0]
            const GameName = GameFoldersMap[GameKey]
            if (GameName) stats.meta.games[GameName] = (stats.meta.games[GameName] || 0) + 1
          }
        })
      }
      stats.meta.roles = characterSet.size
      this.logger.info(`${this.logPrefix} [检查状态] 元数据: ${stats.meta.roles}角色, ${stats.meta.images}图片`)

      // 本地文件扫描统计
      const RepoStatsScan = {
        // 用于扫描的路径信息
        1: { path: MiaoPluginMBT.paths.LocalTuKuPath, gitPath: MiaoPluginMBT.paths.gitFolderPath, exists: Repo1Exists },
        2: {
          path: MiaoPluginMBT.paths.LocalTuKuPath2,
          gitPath: MiaoPluginMBT.paths.gitFolderPath2,
          exists: Repo2Exists && Repo2UrlConfigured,
        },
      }
      const ScannedRoleImageCounts = {} // { '原神': {'角色A': 10, '角色B': 5}, '星铁': {...} }
      const ScannedGameSizes = {} // { '原神': 102400, '星铁': 51200 }
      Object.values(GameFoldersMap).forEach(gameName => {
        ScannedRoleImageCounts[gameName] = {}
        ScannedGameSizes[gameName] = 0
      })
      let totalGitSizeScan = 0

      // 遍历存在的仓库进行扫描
      for (const RepoNum of Object.keys(RepoStatsScan)) {
        const Repo = RepoStatsScan[RepoNum]
        if (!Repo.exists) continue

        // 计算 Git 目录大小
        try {
          const repoGitSize = await FolderSize(Repo.gitPath) 
          totalGitSizeScan += repoGitSize
          stats.repos[RepoNum].gitSize = repoGitSize
          stats.repos[RepoNum].gitSizeFormatted = FormatBytes(repoGitSize) 
        } catch (sizeError) {
          this.logger.error(`${this.logPrefix} [检查状态] 计算仓库 ${RepoNum} Git 大小失败:`, sizeError)
          stats.repos[RepoNum].gitSizeFormatted = '错误'
        }

        // 扫描各游戏目录
        for (const GameKey in GameFoldersMap) {
          const GameName = GameFoldersMap[GameKey]
          const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[GameKey]
          if (!sourceFolderName || GameKey === 'gallery') continue

          const gameFolderPath = path.join(Repo.path, sourceFolderName)
          try {
            await fsPromises.access(gameFolderPath) // 检查目录是否存在
            const characterDirs = await fsPromises.readdir(gameFolderPath, { withFileTypes: true })

            // 遍历角色目录
            for (const charDir of characterDirs) {
              if (charDir.isDirectory()) {
                const characterName = charDir.name
                const charFolderPath = path.join(gameFolderPath, characterName)
                let imageCountInCharDir = 0
                try {
                  await fsPromises.access(charFolderPath) // 检查角色目录是否存在
                  const imageFiles = await fsPromises.readdir(charFolderPath, { withFileTypes: true })
                  // 统计 webp 文件数量和大小
                  for (const imageFile of imageFiles) {
                    if (imageFile.isFile() && imageFile.name.toLowerCase().endsWith('.webp')) {
                      imageCountInCharDir++
                      const imagePath = path.join(charFolderPath, imageFile.name)
                      try {
                        const fileStat = await fsPromises.stat(imagePath)
                        ScannedGameSizes[GameName] = (ScannedGameSizes[GameName] || 0) + fileStat.size
                      } catch (statErr) {
                        /* 忽略单个文件stat错误 */
                      }
                    }
                  }
                } catch (readCharErr) {
                  /* 忽略读取角色目录错误 */
                }
                // 累加角色图片数量
                if (imageCountInCharDir > 0) {
                  ScannedRoleImageCounts[GameName][characterName] =
                    (ScannedRoleImageCounts[GameName][characterName] || 0) + imageCountInCharDir
                }
              }
            }
          } catch (accessGameErr) {
            /* 忽略访问游戏目录错误 */
          }
        } 
      } 

      // 汇总扫描结果
      const scanResult = stats.scan // 直接修改 stats 里的 scan 对象
      scanResult.totalGitSize = totalGitSizeScan
      scanResult.totalGitSizeFormatted = FormatBytes(totalGitSizeScan)

      Object.values(GameFoldersMap).forEach(GameName => {
        const rolesInGame = ScannedRoleImageCounts[GameName] || {}
        const roleNames = Object.keys(rolesInGame)
        const roleCount = roleNames.length
        let gameImageCount = 0
        roleNames.forEach(roleName => {
          gameImageCount += rolesInGame[roleName] || 0
        })

        scanResult.gameRoles[GameName] = roleCount
        scanResult.gameImages[GameName] = gameImageCount
        scanResult.roles += roleCount
        scanResult.images += gameImageCount

        const gameSizeBytes = ScannedGameSizes[GameName] || 0
        scanResult.gameSizes[GameName] = gameSizeBytes
        scanResult.gameSizesFormatted[GameName] = FormatBytes(gameSizeBytes)
        scanResult.totalFilesSize += gameSizeBytes
      })

      scanResult.totalSize = scanResult.totalFilesSize + scanResult.totalGitSize
      scanResult.totalFilesSizeFormatted = FormatBytes(scanResult.totalFilesSize)
      scanResult.totalSizeFormatted = FormatBytes(scanResult.totalSize)
      this.logger.info(
        `${this.logPrefix} [检查状态] 本地扫描: ${scanResult.roles}角色, ${scanResult.images}图片, 文件 ${scanResult.totalFilesSizeFormatted}, 总 ${scanResult.totalSizeFormatted}`
      )

      // 计算各仓库总占用和文件占用
      for (const repoNum in stats.repos) {
        if (stats.repos[repoNum].exists) {
          try {
            const repoTotalSize = await FolderSize(RepoStatsScan[repoNum].path) 
            const repoGitSize = stats.repos[repoNum].gitSize
            stats.repos[repoNum].size = repoTotalSize
            stats.repos[repoNum].filesSize = Math.max(0, repoTotalSize - repoGitSize) // 文件大小 = 总大小 - Git大小
            stats.repos[repoNum].sizeFormatted = FormatBytes(repoTotalSize) 
            stats.repos[repoNum].filesSizeFormatted = FormatBytes(stats.repos[repoNum].filesSize) 
          } catch (finalSizeError) {
            this.logger.error(`${this.logPrefix} [检查状态] 计算仓库 ${repoNum} 总占用大小失败:`, finalSizeError)
            stats.repos[repoNum].sizeFormatted = '错误'
            stats.repos[repoNum].filesSizeFormatted = '错误'
          }
        }
      }

      //  准备渲染数据
      const repoCount = Object.values(stats.repos || {}).filter(repo => repo?.exists).length
      const renderData = { pluginVersion, stats, config, repoCount } // 传递给模板的数据

      // 创建临时目录和文件路径
      await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true })
      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true })
      const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'status.html')

      //确保临时文件路径唯一且在可写目录
      tempHtmlFilePath = path.join(
        MiaoPluginMBT.paths.tempHtmlPath,
        `status-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
      )
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `status-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
      )

      // 复制模板文件到临时路径
      await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath)

      // 调用 Puppeteer 生成截图
      this.logger.info(`${this.logPrefix} [检查状态] 开始调用 Puppeteer 生成状态报告截图...`)
      const img = await puppeteer.screenshot('guguniu-status', {
        tplFile: tempHtmlFilePath, // 使用临时 HTML 文件
        savePath: tempImgFilePath, // 保存到临时图片文件
        imgType: 'png',
        pageGotoParams: { waitUntil: 'networkidle0' }, // 等待网络空闲
        ...renderData, // 注入数据
        screenshotOptions: { fullPage: false }, // 不需要完整页面截图
        pageBoundingRect: { selector: '.container', padding: 0 }, // 根据容器元素截图
        width: 540, // 设置截图宽度
      })

      //  发送截图
      if (img) {
        await e.reply(img)
        this.logger.info(`${this.logPrefix} [检查状态] 状态报告图片已发送。`)
      } else {
        this.logger.error(`${this.logPrefix} [检查状态] Puppeteer 未能成功生成图片。`)
        await e.reply('生成状态报告图片失败 (截图环节出错)，请查看日志。') 
      }
    } catch (error) {
      this.logger.error(`${this.logPrefix} [检查状态] 生成状态报告时发生严重错误:`, error)
      await this.ReportError(e, '生成状态报告图片', error) 
    } finally {
      // 清理临时文件
      if (tempHtmlFilePath) {
        try {
          await fsPromises.unlink(tempHtmlFilePath)
        } catch (unlinkErr) {
          /* 忽略删除错误 */
        }
      }
      if (tempImgFilePath) {
        try {
          await fsPromises.unlink(tempImgFilePath)
        } catch (unlinkErr) {
          /* 忽略删除错误 */
        }
      }
    }
    return true

    //已包含数据校验环节。虽然理论上存在极低概率的误判风险，但这远比允许命令在数据不完整时执行要好。而且，它消除了那条容易引起误解的警告日志
  }

  /**
   * @description 处理 #启用/禁用咕咕牛 命令。
   */
  async ManageTuKuOption(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!e.isMaster) return e.reply(`${this.logPrefix} 只有主人才能开关图库啦~`) 

    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i)
    if (!match) return false // 不是目标命令

    const action = match[1]
    const enable = action === '启用'
    let configChanged = false
    let message = ''

    // 加载最新配置
    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger) 

    // 检查是否已经是目标状态
    if (MiaoPluginMBT.MBTConfig.TuKuOP === enable) {
      message = `${this.logPrefix} 图库已经是「${action}」状态了，不用再设置啦。` 
    } else {
      // 更新配置
      MiaoPluginMBT.MBTConfig.TuKuOP = enable
      configChanged = true
      message = `${this.logPrefix} 图库已设为「${action}」。` 
      this.logger.info(`${this.logPrefix} 图库开关状态变更为 -> ${enable}`)

      // 根据启用/禁用执行相应操作
      if (enable) {
        await e.reply(`${this.logPrefix} 正在启用图库并同步图片，请稍候...`) 
        try {
          //启用时需要同步图片并应用封禁
          await MiaoPluginMBT.SyncCharacterFolders(this.logger) 
          await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger) 
          message += '\n图片已开始同步到插件目录。' 
        } catch (syncError) {
          message += '\n⚠️ 但是同步图片时出错了！' 
          await this.ReportError(e, '启用同步', syncError) 
        }
      } else {
        await e.reply(`${this.logPrefix} 正在禁用图库并清理相关图片，请稍候...`) 
        try {
          //禁用时需要清理目标插件目录
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.miaoChar, this.logger) 
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.zzzChar, this.logger) 
          await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.wavesChar, this.logger) 
          message += '\n已清理插件目录中的图库图片。' 
        } catch (cleanError) {
          message += '\n⚠️ 但是清理图片时出错了！' 
          await this.ReportError(e, '禁用清理', cleanError) 
        }
      }
    }

    // 如果配置有变动，保存配置
    if (configChanged) {
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger) 
      if (!saveSuccess) message += '\n⚠️ 注意：配置保存失败了！' 
    }

    await e.reply(message, true)
    return true
  }

  /**
   * @description 处理 #咕咕牛 命令，显示插件版本、安装时间和系统信息。
   *            
   */
  async PluginInfo(e) { 
    if (!(await this.CheckInit(e))) return true; 

    const version = this.GetVersion(); // 获取版本号
    await e.reply(`🐂 ${this.logPrefix} ${version} 正在运行中...`); 

    // 获取仓库安装时间
    let installTimeRepo1 = '未安装', installTimeRepo2 = '未配置'; 
    let Repo1Exists = false, Repo2Exists = false;
    try {
      const stats1 = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath).catch(() => null);
      if (stats1) {
        installTimeRepo1 = stats1.ctime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        Repo1Exists = true;
      }
    } catch {}

    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
    if (Repo2UrlConfigured) {
      installTimeRepo2 = '已配置但未下载'; 
      try {
        const stats2 = await fsPromises.stat(MiaoPluginMBT.paths.LocalTuKuPath2).catch(() => null);
        if (stats2) {
          installTimeRepo2 = stats2.ctime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          Repo2Exists = true;
        } else if (await MiaoPluginMBT.IsTuKuDownloaded(2)) { 
          Repo2Exists = true;
          installTimeRepo2 = '已下载 (无法获取时间)'; 
        }
      } catch {}
    }
    await e.reply(`> 一号仓库安装时间: ${installTimeRepo1}\n> 二号仓库状态: ${installTimeRepo2}`); 

    // 获取并发送日志
    let logMessages = []; // 用于存储日志消息

    // 获取一号仓库日志
    if (Repo1Exists) {
      const gitLog1 = await MiaoPluginMBT.GetTuKuLog(50, MiaoPluginMBT.paths.LocalTuKuPath, this.logger); 
      if (gitLog1) {
        logMessages.push(`--- 一号仓库最近 50 条更新记录 ---\n${gitLog1}`); 
      } else {
        logMessages.push("--- 无法获取一号仓库日志 ---"); 
      }
    } else {
      logMessages.push("--- 一号仓库未下载 ---"); 
    }

    // 【新增】检查并获取二号仓库日志
    if (Repo2Exists) { // 只有在二号仓库确实存在时才获取
      const gitLog2 = await MiaoPluginMBT.GetTuKuLog(50, MiaoPluginMBT.paths.LocalTuKuPath2, this.logger); // 注意路径是 LocalTuKuPath2
      if (gitLog2) {
        logMessages.push(`--- 二号仓库最近 50 条更新记录 ---\n${gitLog2}`); 
      } else {
        logMessages.push("--- 无法获取二号仓库日志 ---"); 
      }
    } else if (Repo2UrlConfigured) {
       logMessages.push("--- 二号仓库已配置但未下载 ---"); // 如果配置了但未下载，也说明一下 
    }
    // 如果二号仓库未配置，则不显示相关信息

    // 发送合并转发消息
    if (logMessages.length > 0) {
        try {
            const forwardMsg = await common.makeForwardMsg(e, logMessages, '『咕咕牛🐂』仓库日志'); // 统一标题 
            if (forwardMsg) await e.reply(forwardMsg);
            else await e.reply("生成仓库日志消息失败。"); 
        } catch (fwdErr) {
            this.logger.error(`${this.logPrefix} 创建日志转发消息失败:`, fwdErr);
            await e.reply("发送仓库日志时出错。"); 
        }
    }

    // 获取并发送系统信息 (逻辑不变)
    let systemInfo = '';
    try {
      const platform = `${os.platform()} ${os.arch()}`;
      const nodeVersion = process.version;
      const memUsage = process.memoryUsage();
      const usedMB = (memUsage.rss / 1024 / 1024).toFixed(1);
      let yunzaiVersion = '未知';
      try {
        const pkgPath = path.join(MiaoPluginMBT.paths.YunzaiPath, 'package.json');
        const pkg = JSON.parse(await fsPromises.readFile(pkgPath, 'utf-8'));
        yunzaiVersion = pkg.version || '未知';
      } catch { /* 读取失败就算了 */ }

      systemInfo = [
        `--- 运行环境 ---`, 
        `系统: ${platform}`,
        `Node.js: ${nodeVersion}`,
        `Yunzai-Bot: ${yunzaiVersion}`,
        `咕咕牛插件: ${version}`,
        `内存占用: ${usedMB} MB`,
      ].join('\n');
    } catch (sysErr) {
      this.logger.warn(`${this.logPrefix} 获取系统信息失败:`, sysErr);
      systemInfo = '获取系统信息失败了...'; 
    }
    await e.reply(systemInfo);

    return true; 
  }

  /**
   * @description 处理 #设置咕咕牛净化等级 命令。
   */
  async SetPurificationLevel(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!e.isMaster) return e.reply(`${this.logPrefix} 只有主人才能设置净化等级哦~`) 

    const match = e.msg.match(/^(?:#设置咕咕牛净化等级|#设定净化)\s*([012])$/i)
    if (!match?.[1]) return e.reply('格式不对哦，请用: #设置咕咕牛净化等级 [0/1/2]', true) 

    const level = parseInt(match[1], 10)
    // 校验等级是否有效
    if (isNaN(level) || !Purify_Level.getDescription(level))
      return e.reply(`无效的净化等级: ${level}，只能是 0, 1, 或 2。`, true) 

    // 加载最新配置
    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger) 
    const currentLevel = MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl

    // 检查是否已经是目标等级
    if (level === currentLevel)
      return e.reply(`${this.logPrefix} 净化等级已经是 ${level} (${Purify_Level.getDescription(level)}) 啦。`, true) 

    // 更新配置
    MiaoPluginMBT.MBTConfig.PFL = level
    this.logger.info(`${this.logPrefix} 净化等级设置为 -> ${level} (${Purify_Level.getDescription(level)})`)

    // 保存配置
    const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger) 
    let replyMessage = `${this.logPrefix} 净化等级已设为 ${level} (${Purify_Level.getDescription(level)})。` 
    // 添加 Px18 的解释
    if (level === Purify_Level.PX18_PLUS) {
      replyMessage += '\n(Px18 指轻微性暗示或低度挑逗性图片)' 
    }
    if (!saveSuccess) replyMessage += '\n⚠️ 但是配置保存失败了！设置可能不会持久生效。' 
    await e.reply(replyMessage, true)

    // 异步在后台重新生成并应用封禁列表
    setImmediate(async () => {
      try {
        await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger) 
        this.logger.info(`${this.logPrefix} [净化设置] 新的净化等级 ${level} 已在后台应用。`)
      } catch (applyError) {
        this.logger.error(`${this.logPrefix} [净化设置] 后台应用新净化等级时出错:`, applyError)
        // 在这里考虑是否需要通知主人后台任务失败
      }
    })

    return true
  }

  /**
   * @description 处理封禁相关命令 (#咕咕牛封禁, #咕咕牛解禁, #ban列表)。
   */
  async ManageUserBans(e) {
    
    if (!(await this.CheckInit(e))) return true 
    const msg = e.msg.trim()
    const isMaster = e.isMaster

    // 权限检查：封禁/解禁操作仅限主人
    if ((msg.startsWith('#咕咕牛封禁 ') || msg.startsWith('#咕咕牛解禁 ')) && !isMaster)
      return e.reply(`${this.logPrefix} 只有主人才能进行封禁或解禁操作哦~`) 

    // 处理 #ban列表 或 #咕咕牛封禁列表
    if (msg === '#ban列表' || msg === '#咕咕牛封禁列表') {
      const activeBanCount = MiaoPluginMBT.#activeBanSet.size
      const userBanCount = MiaoPluginMBT.#userBanSet.size

      if (activeBanCount === 0) {
        return e.reply('太棒了！当前没有任何图片被封禁。', true) 
      }
      // 移除 #清空咕咕牛封禁 的检查和处理逻辑

      await e.reply(`收到！正在生成封禁列表图片，可能需要一点时间...`, true) 

      const purifiedBansData = [] // 存放净化屏蔽的图片信息
      const userBansData = [] // 存放手动封禁的图片信息

      // 遍历当前生效的封禁列表
      const sortedActiveBans = Array.from(MiaoPluginMBT.#activeBanSet).sort()
      await Promise.all(
        sortedActiveBans.map(async relativePath => {
          const fileName = path.basename(relativePath)
          const fileNameNoExt = fileName.replace(/\.webp$/i, '') // 去掉后缀
          // 尝试获取本地路径用于缩略图
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath) 
          const thumbnailPath = absolutePath ? `file://${absolutePath}` : '' // 如果本地文件存在，生成 file:// URI
          const itemData = { fileNameNoExt, thumbnailPath } // 存储文件名和缩略图路径

          // 判断是手动封禁还是净化屏蔽
          if (MiaoPluginMBT.#userBanSet.has(relativePath)) {
            userBansData.push(itemData)
          } else {
            purifiedBansData.push(itemData)
          }
        })
      )

      let manualSent = false // 标记手动列表是否发送成功
      let purifiedSent = false // 标记净化列表是否发送成功
      const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'banlist.html')
      let tempHtmlFilePath = ''
      let tempImgFilePath = ''

      // 优先发送手动封禁列表（如果有）
      if (userBansData.length > 0) {
        this.logger.info(`${this.logPrefix} [封禁列表] 准备生成手动列表图片 (${userBansData.length}项)...`)
        const renderDataManual = { purifiedBans: [], userBans: userBansData, listType: '手动封禁' } // 传递类型
        tempHtmlFilePath = path.join(MiaoPluginMBT.paths.tempHtmlPath, `banlist-manual-${Date.now()}.html`)
        tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `banlist-manual-${Date.now()}.png`)
        try {
          await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath) // 复制模板
          const img = await puppeteer.screenshot('guguniu-banlist-manual', {
            tplFile: tempHtmlFilePath,
            savePath: tempImgFilePath,
            imgType: 'png',
            pageGotoParams: { waitUntil: 'networkidle0' },
            ...renderDataManual,
            screenshotOptions: { fullPage: true },
            width: 640, // 截图宽度
          })
          if (img) {
            await e.reply(img)
            manualSent = true
            // 如果后面还有净化列表，稍微等一下再发
            if (purifiedBansData.length > 0) await common.sleep(500)
          } else {
            this.logger.error(`${this.logPrefix} [封禁列表] 生成手动列表截图失败。`)
          }
        } catch (renderError) {
          this.logger.error(`${this.logPrefix} [封禁列表] 生成手动列表截图时出错:`, renderError)
        } finally {
          // 清理临时文件
          if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
            try {
              await fsPromises.unlink(tempHtmlFilePath)
            } catch (unlinkErr) {}
          }
          if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
            try {
              await fsPromises.unlink(tempImgFilePath)
            } catch (unlinkErr) {}
          }
        }
      } else {
        // 如果没有手动封禁，也回复一下
        this.logger.info(`${this.logPrefix} [封禁列表] 无手动封禁项。`)
        if (purifiedBansData.length === 0) {
          // 如果净化列表也为空（理论上 activeBanCount > 0 不会到这里）
          await e.reply('当前无手动封禁。', true) 
        }
      }

      // 再发送净化屏蔽列表（如果有）
      if (purifiedBansData.length > 0) {
        this.logger.info(`${this.logPrefix} [封禁列表] 准备生成净化列表图片 (${purifiedBansData.length}项)...`)
        const renderDataPurified = { purifiedBans: purifiedBansData, userBans: [], listType: '净化屏蔽' } // 传递类型
        tempHtmlFilePath = path.join(MiaoPluginMBT.paths.tempHtmlPath, `banlist-purified-${Date.now()}.html`)
        tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `banlist-purified-${Date.now()}.png`)
        try {
          await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath)
          const img = await puppeteer.screenshot('guguniu-banlist-purified', {
            tplFile: tempHtmlFilePath,
            savePath: tempImgFilePath,
            imgType: 'png',
            pageGotoParams: { waitUntil: 'networkidle0' },
            ...renderDataPurified,
            screenshotOptions: { fullPage: true },
            width: 640,
          })
          if (img) {
            await e.reply(img)
            purifiedSent = true
          } else {
            this.logger.error(`${this.logPrefix} [封禁列表] 生成净化列表截图失败。`)
          }
        } catch (renderError) {
          this.logger.error(`${this.logPrefix} [封禁列表] 生成净化列表截图时出错:`, renderError)
        } finally {
          // 清理临时文件
          if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
            try {
              await fsPromises.unlink(tempHtmlFilePath)
            } catch (unlinkErr) {}
          }
          if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
            try {
              await fsPromises.unlink(tempImgFilePath)
            } catch (unlinkErr) {}
          }
        }
      } else {
        this.logger.info(`${this.logPrefix} [封禁列表] 无净化屏蔽项。`)
      }

      // 如果两个列表都尝试发送但都失败了，给个提示
      if (userBansData.length > 0 && !manualSent && purifiedBansData.length > 0 && !purifiedSent) {
        await e.reply('生成封禁列表图片失败了，请检查日志。', true) 
      } else if (userBansData.length > 0 && !manualSent && purifiedBansData.length === 0 && purifiedSent) {
        // 只有手动失败
        await e.reply('生成手动封禁列表图片失败，请检查日志。', true) 
      } else if (purifiedBansData.length > 0 && !purifiedSent && userBansData.length === 0 && manualSent) {
        // 只有净化失败
        await e.reply('生成净化屏蔽列表图片失败，请查看日志。', true) 
      }

      return true 
    }

    // 处理 #咕咕牛封禁 / #咕咕牛解禁
    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i)
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i)
    if (addMatch || delMatch) {
      const isAdding = !!addMatch
      const targetIdentifierRaw = (isAdding ? addMatch[1] : delMatch[1]).trim()
      const actionVerb = isAdding ? '封禁' : '解禁'

      if (!targetIdentifierRaw) {
        const example = isAdding ? '#咕咕牛封禁花火1' : '#咕咕牛解禁花火1'
        return e.reply(`要${actionVerb}哪个图片呀？格式：${example}`, true) 
      }

      // 解析角色名和编号
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw) 
      if (!parsedId) {
        return e.reply('格式好像不对哦，应该是 角色名+编号，比如：花火1', true) 
      }
      const { mainName: rawMainName, imageNumber } = parsedId

      // 查找标准角色名
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger) 
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName

      // 在元数据缓存中查找对应的图片信息
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`
      const imageData = MiaoPluginMBT.#imgDataCache.find(
        img =>
          img.characterName === standardMainName &&
          img.path?.toLowerCase().replace(/\\/g, '/').endsWith(`/${expectedFilenameLower}`)
      )

      // 如果找不到图片数据
      if (!imageData || !imageData.path) {
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)` 
        const roleExistsInData = MiaoPluginMBT.#imgDataCache.some(img => img.characterName === standardMainName)
        if (!roleExistsInData) {
          hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)` 
        } else {
          hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)` 
        }
        return e.reply(`在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`, true)
      }

      // 获取图片的相对路径和文件名
      const targetRelativePath = imageData.path.replace(/\\/g, '/')
      const targetFileName = path.basename(targetRelativePath)

      // 执行封禁/解禁操作
      await this.PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb) 
      return true 
    }

    // 如果以上都不是，说明不是本插件处理的命令
    return false
  }

  /**
   * @description 执行具体的封禁或解禁操作，更新内存状态、保存文件并应用。
   */
  async PerformBanOperation(e, isAdding, targetRelativePath, targetFileName, actionVerb) {
    
    try {
      let configChanged = false // 标记用户封禁列表是否有变动
      let replyMsg = ''

      // 检查当前状态
      const isCurrentlyUserBanned = MiaoPluginMBT.#userBanSet.has(targetRelativePath)
      const isCurrentlyPurified = await MiaoPluginMBT.CheckIfPurified(targetRelativePath, this.logger) 

      if (isAdding) {
        // --- 添加封禁 ---
        if (isCurrentlyUserBanned) {
          // 已经是手动封禁状态
          replyMsg = `${targetFileName} ❌️ 已经被你手动封禁啦。` 
        } else {
          // 添加到手动封禁列表
          MiaoPluginMBT.#userBanSet.add(targetRelativePath)
          configChanged = true
          replyMsg = `${targetFileName} 🚫 好了，已经手动封禁了。` 
          // 如果这个图片也符合净化规则，提醒一下
          if (isCurrentlyPurified) {
            replyMsg += ` (这个图片也符合当前的净化规则)` 
          }
        }
      } else {
        // --- 移除封禁 ---
        if (!isCurrentlyUserBanned) {
          // 本来就没在手动封禁列表里
          if (isCurrentlyPurified) {
            // 但是被净化规则挡住了，不能解禁
            replyMsg = `${targetFileName} ❌️ 解禁失败：这个图片被净化规则 (等级 ${MiaoPluginMBT.MBTConfig.PFL}) 自动屏蔽了，没法通过解禁手动封禁来恢复哦。` 
          } else {
            // 既没手动封禁，也没被净化，说明本来就是好的
            replyMsg = `${targetFileName} ❓ 咦？这个图片本来就没在你的手动封禁列表里呀。` 
          }
        } else {
          // 在手动封禁列表里，执行移除
          MiaoPluginMBT.#userBanSet.delete(targetRelativePath)
          configChanged = true
          replyMsg = `${targetFileName} ✅️ 好嘞，已经从你的手动封禁列表里移除了。` 
          // 检查移除后是否会被净化规则屏蔽
          if (isCurrentlyPurified) {
            replyMsg += `\n⚠️ 不过注意：这个图片仍然会被当前的净化规则 (等级 ${MiaoPluginMBT.MBTConfig.PFL}) 屏蔽掉哦。` 
          } else {
            // 如果解禁后不再被任何规则屏蔽，尝试恢复文件
            replyMsg += '\n正在尝试恢复图片文件...' 
            // 异步恢复文件，不阻塞回复
            setImmediate(async () => {
              try {
                const restored = await MiaoPluginMBT.RestoreFileFromSource(targetRelativePath, this.logger) 
                if (!restored) {
                  this.logger.warn(`${this.logPrefix} [解禁] 尝试恢复 ${targetFileName} 失败 (可能源文件丢失)。`)
                  // 是否通知用户恢复失败
                  // await e.reply(`尝试恢复 ${targetFileName} 失败了...`);
                }
              } catch (restoreErr) {
                this.logger.error(`${this.logPrefix} [解禁] 恢复文件时出错:`, restoreErr)
              }
            })
          }
        }
      }

      // 回复用户操作结果
      await e.reply(replyMsg, true)

      // 如果用户封禁列表有变动，保存并重新应用
      if (configChanged) {
        const saved = await MiaoPluginMBT.SaveUserBans(this.logger) 
        if (!saved) {
          // 保存失败，回滚内存中的修改
          if (isAdding) MiaoPluginMBT.#userBanSet.delete(targetRelativePath)
          else MiaoPluginMBT.#userBanSet.add(targetRelativePath)
          await e.reply(`『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`, true) 
          return // 阻止后续应用
        }

        // 异步在后台重新生成并应用生效列表
        setImmediate(async () => {
          try {
            await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger) 
            this.logger.info(`${this.logPrefix} [${actionVerb}] 操作后，后台已重新应用生效封禁列表。`)
            // 如果是解禁，并且解禁后图片不再被屏蔽，确保文件已恢复 (上面已异步处理)
          } catch (err) {
            this.logger.error(`${this.logPrefix} [${actionVerb}] 后台应用生效列表时出错:`, err)
          }
        })
      }
    } catch (error) {
      // 捕获顶层错误
      await this.ReportError(e, `${actionVerb}图片`, error, `目标: ${targetFileName}`) 
    }
  }

  /**
   * @description 处理 #查看 命令，显示指定角色的所有图片及状态。
   */
  async FindRoleSplashes(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库还没下载呢！', true) 

    const match = e.msg.match(/^#查看\s*(.+)$/i)
    if (!match?.[1]) return e.reply('想看哪个角色呀？格式：#查看 角色名', true) 

    const roleNameInput = match[1].trim()
    try {
      // 查找标准角色名
      const { mainName, exists } = await MiaoPluginMBT.FindRoleAlias(roleNameInput, this.logger) 
      const standardMainName = mainName || roleNameInput // 如果没找到别名，就用输入的名字

      // 从缓存中筛选该角色的图片数据
      const roleImageData = MiaoPluginMBT.#imgDataCache.filter(img => img.characterName === standardMainName)

      // 处理找不到图片的情况
      if (roleImageData.length === 0) {
        // 检查本地是否有该角色的目录，以区分是没图还是没角色
        const dirExists = await MiaoPluginMBT.CheckRoleDirExists(standardMainName) 
        if (dirExists)
          return e.reply(`『${standardMainName}』的角色文件夹在，但是图库数据里没有图片信息哦。`) 
        else return e.reply(`图库里好像没有『${standardMainName}』这个角色呢。`) 
      }

      await e.reply(`${this.logPrefix} 找到了！正在整理 [${standardMainName}] 的图片 (${roleImageData.length} 张)...`) 

      // 按图片编号排序
      roleImageData.sort(
        (a, b) =>
          parseInt(a.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0') -
          parseInt(b.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0')
      )

      // 准备合并转发消息内容
      const title = `查看『${standardMainName}』 (${roleImageData.length} 张)` 
      const forwardMsgList = [[title], [`想导出图片？试试: #咕咕牛导出${standardMainName}1`]] 

      // 遍历图片数据，生成每条消息
      for (let i = 0; i < roleImageData.length; i++) {
        const { path: relativePath } = roleImageData[i]
        if (!relativePath) continue // 跳过无效数据

        const normalizedPath = relativePath.replace(/\\/g, '/')
        const fileName = path.basename(normalizedPath)
        const baseName = fileName.replace(/\.webp$/i, '') // 文件名去后缀

        // 检查封禁状态
        const isEffectivelyBanned = MiaoPluginMBT.#activeBanSet.has(normalizedPath)
        const isUserBanned = MiaoPluginMBT.#userBanSet.has(normalizedPath)
        const isPurified = MiaoPluginMBT.CheckIfPurifiedByLevel(
          
          roleImageData[i],
          MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl
        )

        // 生成状态标签
        let labelStr = ''
        if (isEffectivelyBanned) {
          labelStr += ' ❌封禁' 
          if (isPurified && !isUserBanned) labelStr += ' 🌱净化' 
        }

        const entryText = `${i + 1}、${baseName}${labelStr}` // 组合文本信息

        // 查找图片的本地绝对路径
        const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(normalizedPath) 

        if (absolutePath) {
          // 如果本地文件存在，尝试发送图片
          try {
            await fsPromises.access(absolutePath, fs.constants.R_OK) // 检查可读权限
            forwardMsgList.push([entryText, segment.image(`file://${absolutePath}`)])
          } catch (accessErr) {
            // 文件存在但无法访问
            this.logger.warn(`${this.logPrefix} [查看] 文件无法访问: ${absolutePath}`, accessErr.code)
            forwardMsgList.push(`${entryText} (文件状态异常)`) 
          }
        } else {
          // 本地文件丢失
          this.logger.warn(`${this.logPrefix} [查看] 文件丢失: ${normalizedPath}`)
          forwardMsgList.push(`${entryText} (文件丢失了...)`) 
        }
      }

      // 发送合并转发消息
      const forwardMsg = await common.makeForwardMsg(e, forwardMsgList, `[${standardMainName}]的图库详情`) 
      if (forwardMsg) await e.reply(forwardMsg)
      else {
        await e.reply('生成图片列表失败了，可能是图片太多了？', true) 
      }
    } catch (error) {
      // 捕获处理过程中的错误
      await this.ReportError(e, `查看角色 ${roleNameInput}`, error) 
    }
    return true 
  }

  /**
   * @description 处理 #咕咕牛导出 命令，发送指定图片文件。
   */
  async ExportSingleImage(e) {
    
    if (!(await this.CheckInit(e))) return true 
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库还没下载呢！', true) 

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i)
    if (!match?.[1]) return e.reply('要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)', true) 

    const targetIdentifierRaw = match[1].trim()
    let targetRelativePath = null
    let targetFileName = ''

    try {
      // 解析角色名和编号
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw) 
      if (!parsedId) return e.reply('格式好像不对哦，应该是 角色名+编号，比如：花火1', true) 
      const { mainName: rawMainName, imageNumber } = parsedId

      // 查找标准角色名
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger) 
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName

      // 在元数据中查找图片
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`
      let foundCount = 0 // 用于判断是没角色还是没编号
      const imageData = MiaoPluginMBT.#imgDataCache.find(img => {
        const nameMatch = img.characterName === standardMainName
        const pathLower = img.path?.toLowerCase().replace(/\\/g, '/')
        const filenameMatch = pathLower?.endsWith(`/${expectedFilenameLower}`)
        if (nameMatch) foundCount++
        return nameMatch && filenameMatch
      })

      // 处理找不到图片的情况
      if (!imageData || !imageData.path) {
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)` 
        if (MiaoPluginMBT.#imgDataCache.length === 0) hint = `(图库数据是空的)` 
        else if (foundCount === 0 && MiaoPluginMBT.#imgDataCache.length > 0)
          hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)` 
        else if (foundCount > 0) hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)` 
        return e.reply(`在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`, true)
      }

      targetRelativePath = imageData.path.replace(/\\/g, '/')
      targetFileName = path.basename(targetRelativePath)

      // 检查是否被封禁
      if (MiaoPluginMBT.#activeBanSet.has(targetRelativePath)) {
        return e.reply(`图片 ${targetFileName} 被封禁了，不能导出哦。`, true) 
      }

      // 查找本地绝对路径
      const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(targetRelativePath) 
      if (!absolutePath) {
        return e.reply(`糟糕，文件丢失了：${targetFileName}，没法导出。`, true) 
      }

      // 检查文件是否可读
      try {
        await fsPromises.access(absolutePath, fs.constants.R_OK)
      } catch (accessErr) {
        this.logger.error(`${this.logPrefix} [导出] 文件无法访问: ${absolutePath}`, accessErr)
        return e.reply(`文件 ${targetFileName} 状态异常，无法读取。`, true) 
      }

      // 发送文件
      this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 正在导出: ${targetFileName}`)
      await e.reply([
        `📦 导出成功！给你 -> ${targetFileName}`, 
        segment.file(absolutePath), // 使用 oicq 的 segment.file 发送文件
      ])
    } catch (sendErr) {
      // 处理发送错误
      this.logger.error(`${this.logPrefix} 导出 ${targetFileName || targetIdentifierRaw} 时发送失败:`, sendErr)
      try {
        // 尝试识别常见的 QQ 文件发送错误
        if (
          sendErr?.message?.includes('highway') || // highway 超时或错误
          sendErr?.message?.includes('file size') || // 文件过大
          sendErr?.code === -36 || // 未知的文件错误码
          sendErr?.code === 210005 || // 文件过期或不存在？
          sendErr?.code === 210003 // 文件发送频率过高？
        ) {
          await e.reply(
            `发送文件失败了 T_T QQ 文件通道好像出了点问题 (${
              sendErr.code || '未知代码'
            })，可能是文件太大、网络不好或者被 QQ 限制了。`,
            true
          ) 
        } else {
          // 其他未知错误，报告给管理员
          await this.ReportError(e, `导出文件 ${targetFileName || targetIdentifierRaw}`, sendErr) 
        }
      } catch (replyError) {
        // 如果连错误提示都发送失败...
        this.logger.error(`${this.logPrefix} 发送导出失败提示时也出错:`, replyError)
      }
    }
    return true 
  }

    /**
   * @description 处理 #咕咕牛帮助 命令。
   */
    async Help(e) { 
      const networkHelpUrl = 'https://s2.loli.net/2024/06/28/LQnN3oPCl1vgXIS.png'; // 备用在线帮助图 URL
      const localHelpPath = MiaoPluginMBT.paths.helpImagePath; // 本地帮助图路径
  
      try {
        // 优先尝试发送本地帮助图
        await fsPromises.access(localHelpPath, fs.constants.R_OK); // 检查文件是否存在且可读
        await e.reply(segment.image(`file://${localHelpPath}`)); // 发送本地图片
      } catch (localError) {
        // 如果本地图片加载失败
        if (localError.code !== ERROR_CODES.NotFound) {
          // 如果不是文件未找到错误，记录警告
          this.logger.warn(`${this.logPrefix} [帮助] 访问本地帮助图片失败:`, localError.code);
        }
        this.logger.info(`${this.logPrefix} [帮助] 本地帮助图 (${localHelpPath}) 加载失败，尝试发送在线版本...`);
        // 尝试发送在线帮助图
        try {
          await e.reply(segment.image(networkHelpUrl));
        } catch (networkError) {
          // 如果在线图片也发送失败
          this.logger.error(`${this.logPrefix} [帮助] 发送在线帮助图片也失败了:`, networkError.message);
          // 发送纯文本帮助信息作为最终回退
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
            `#设置咕咕牛净化等级 [0/1/2] (主人用)\n` +
            `#启用咕咕牛 / #禁用咕咕牛 (主人用)\n` +
            `#咕咕牛导出 [角色名+编号] (导出图片文件)\n` +
            `#咕咕牛测速 (测下载速度)\n` +
            `#咕咕牛 (看版本和系统信息)`
          );
        }
      }
      return true; 
    }
  
    /**
     * @description 处理 #咕咕牛测速 命令，测试代理节点速度并发送图片报告。
     */
    async ManualTestProxies(e) { 
      if (!(await this.CheckInit(e))) return true; 
      await e.reply(`${this.logPrefix} 收到！开始火力全开测试网络节点...`, true); 
      const startTime = Date.now();
      let speeds1 = [], best1 = null; // 只测试仓库1的 Raw URL
      let tempHtmlFilePath = '';
      let tempImgFilePath = '';
  
      try {
        // 执行测速
        speeds1 = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, this.logger); 
        // 选择最优源（包括不可测速的）
        const available1 = MiaoPluginMBT.GetSortedAvailableSources(speeds1, true, this.logger); 
        best1 = available1[0] || null; // 可能没有可用源
  
        const duration = ((Date.now() - startTime) / 1000).toFixed(1); // 计算耗时
  
        // 处理测速结果，添加 statusText 用于模板判断样式
        const processSpeeds = (speeds) => {
            return speeds.map(s => {
                let statusText = 'timeout'; // 默认超时
                if (s.testUrlPrefix === null) { statusText = 'na'; } // 不可测速
                else if (Number.isFinite(s.speed) && s.speed >= 0) { statusText = 'ok'; } // 测速成功
                return { ...s, statusText };
            // 按优先级和速度排序，确保截图里的顺序和选择逻辑一致
            }).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || (a.speed === Infinity ? 1 : (b.speed === Infinity ? -1 : a.speed - b.speed)));
        };
        const processedSpeeds1 = processSpeeds(speeds1);
  
        // 准备渲染数据
        const renderData = {
          speeds1: processedSpeeds1, // 处理后的测速结果
          best1: best1,             // 选出的最优源
          duration: duration        // 总耗时
        };
  
        // 准备临时文件路径
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
        const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'speedtest.html');
        tempHtmlFilePath = path.join(MiaoPluginMBT.paths.tempHtmlPath, `speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.html`);
        tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.png`);
  
        // 复制 HTML 模板
        await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath);
  
        // 调用 Puppeteer 生成截图
        const img = await puppeteer.screenshot('guguniu-speedtest', {
          tplFile: tempHtmlFilePath,
          savePath: tempImgFilePath,
          imgType: 'png',
          pageGotoParams: { waitUntil: 'networkidle0' }, // 等待网络空闲
          ...renderData, // 注入数据
          screenshotOptions: { fullPage: false }, // 不需要完整页面
          pageBoundingRect: { selector: 'body', padding: 0 }, // 根据 body 截图
          width: 540 // 设置宽度
        });
  
        // 发送截图
        if (img) {
          await e.reply(img);
        } else {
          this.logger.error(`${this.logPrefix} [手动测速] 生成截图失败。`);
          await e.reply("生成测速报告图片失败了，请看看日志。"); 
        }
  
      } catch (error) {
        // 捕获测速或截图过程中的错误
        await this.ReportError(e, '手动网络测速', error); 
      } finally {
        // 清理临时文件
        if (tempHtmlFilePath) { try { await fsPromises.unlink(tempHtmlFilePath); } catch (unlinkErr) {} }
        if (tempImgFilePath) { try { await fsPromises.unlink(tempImgFilePath); } catch (unlinkErr) {} }
      }
      return true; 
    }

  // --- 静态辅助方法 ---

  /**
   * @description 插件全局静态初始化入口。
   *              这个方法只应被调用一次。
   */
  static async InitializePlugin(logger = global.logger || console) {
    //logger.info(`【重要调试】InitializePlugin 函数开始执行！`); //MAX级别 调试日志
    
    // 防止重复初始化
    if (MiaoPluginMBT.initializationPromise) return MiaoPluginMBT.initializationPromise
    if (MiaoPluginMBT.isGloballyInitialized) return Promise.resolve()

    const logPrefix = Default_Config.logPrefix
    logger.info(`${logPrefix} 开始全局初始化 (V${MiaoPluginMBT.GetVersionStatic()})...`) 
    MiaoPluginMBT.isGloballyInitialized = false // 重置标志

    //使用 Promise 保证初始化过程的原子性，防止并发执行
    MiaoPluginMBT.initializationPromise = (async () => {
      const errors = [] // 存储非致命错误信息
      let fatalError = null // 存储致命错误
      let localImgDataCache = [] // 临时存储加载的数据，成功后再赋给静态变量

      try {
        //  加载配置
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, logger) 
        if (!config) throw new Error('无法加载图库配置') // 配置加载失败是致命错误

        // 加载图片元数据
        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, logger) 
        if (!Array.isArray(localImgDataCache)) {
          logger.error(`${logPrefix} [初始化] CRITICAL: 元数据加载失败或格式错误!`)
          localImgDataCache = [] // 保证是个空数组
          throw new Error('加载图片元数据失败') // 元数据加载失败是致命错误
        } else if (localImgDataCache.length === 0) {
          errors.push('警告：元数据为空') // 非致命错误，记录警告
        }

        // 加载用户封禁列表
        const bansLoaded = await MiaoPluginMBT.LoadUserBans(true, logger) 
        if (!bansLoaded) errors.push('警告：加载用户封禁列表失败') // 非致命

        //  加载别名数据
        const aliasLoaded = await MiaoPluginMBT.LoadAliasData(true, logger) 
        if (!MiaoPluginMBT.#aliasData?.combined) {
          errors.push('警告：加载别名数据失败')
          MiaoPluginMBT.#aliasData = { combined: {} } // 保证非 null
        } else if (!aliasLoaded) {
          errors.push('警告：部分别名加载失败')
        } else if (Object.keys(MiaoPluginMBT.#aliasData.combined).length === 0) {
          errors.push('警告：别名数据为空')
        }

        //  生成并应用初始封禁列表
        //这一步依赖前面加载的数据，确保它们都已处理
        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, logger) 

        // 提交缓存数据到静态变量
        MiaoPluginMBT.#imgDataCache = Object.freeze(localImgDataCache) // 冻结，防止意外修改

        // 标记初始化完成
        MiaoPluginMBT.isGloballyInitialized = true
        logger.info(`${logPrefix} 全局初始化成功。${errors.length > 0 ? ' 警告: ' + errors.join('; ') : ''}`)
      } catch (error) {
        fatalError = error
        MiaoPluginMBT.isGloballyInitialized = false
        logger.error(`${logPrefix} !!! 全局初始化失败: ${fatalError.message} !!!`)
        logger.error(fatalError.stack)
        // 即使失败，也确保静态变量是有效类型
        MiaoPluginMBT.#imgDataCache = Object.freeze([])
        MiaoPluginMBT.#userBanSet = new Set()
        MiaoPluginMBT.#activeBanSet = new Set()
        MiaoPluginMBT.#aliasData = null
        MiaoPluginMBT.initializationPromise = null // 清除 Promise，允许下次重试
        throw fatalError // 重新抛出错误，让调用者知道失败了
      }
    })()

    // 捕获未处理的 Promise 拒绝，以防万一
    MiaoPluginMBT.initializationPromise.catch(err => {
      logger.error(`${logPrefix} 初始化 Promise 未处理拒绝(!!!): ${err.message}`)
    })

    return MiaoPluginMBT.initializationPromise
  }

  /**
   * @description 生成并应用当前的生效封禁列表（合并用户封禁和净化规则）。
   */
  static async GenerateAndApplyBanList(imageData, logger = global.logger || console) {
    
    const effectiveBanSet = MiaoPluginMBT.GenerateBanList(imageData, logger) 
    await MiaoPluginMBT.ApplyBanList(effectiveBanSet, logger) 
  }

  /**
   * @description 根据净化等级和用户封禁生成最终生效的封禁 Set。
   */
  static GenerateBanList(imageData, logger = global.logger || console) {
    
    const effectiveBans = new Set(MiaoPluginMBT.#userBanSet)
    const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl
    logger.info(
      `${Default_Config.logPrefix} [生成封禁] 等级PFL=${level} (${Purify_Level.getDescription(level)}), 手动封禁数=${
        MiaoPluginMBT.#userBanSet.size
      }`
    )
    if (level > Purify_Level.NONE && Array.isArray(imageData) && imageData.length > 0) {
      let purifiedCount = 0
      imageData.forEach(d => {
        if (MiaoPluginMBT.CheckIfPurifiedByLevel(d, level)) {
          
          const normalizedPath = d.path?.replace(/\\/g, '/')
          if (normalizedPath && !effectiveBans.has(normalizedPath)) {
            purifiedCount++
            effectiveBans.add(normalizedPath)
          }
        }
      })
      logger.info(`${Default_Config.logPrefix} [生成封禁] PFL ${level} 新增屏蔽 ${purifiedCount} 条。`)
    } else if (level > Purify_Level.NONE) {
      logger.warn(`${Default_Config.logPrefix} [生成封禁] PFL=${level} 但元数据无效或为空，无法执行净化。`)
    }
    logger.info(
      `${Default_Config.logPrefix} [生成封禁] 最终生效列表大小: ${effectiveBans.size} (手动 ${
        MiaoPluginMBT.#userBanSet.size
      })`
    )
    MiaoPluginMBT.#activeBanSet = effectiveBans
    return MiaoPluginMBT.#activeBanSet
  }

  /**
   * @description 检查单个图片数据项是否应根据指定净化等级被屏蔽。
   */
  static CheckIfPurifiedByLevel(imgDataItem, purifyLevel) {
    
    if (!imgDataItem?.attributes) return false
    const attrs = imgDataItem.attributes
    const isRx18 = attrs.isRx18 === true || String(attrs.isRx18).toLowerCase() === 'true'
    const isPx18 = attrs.isPx18 === true || String(attrs.isPx18).toLowerCase() === 'true'
    if (purifyLevel === Purify_Level.RX18_ONLY) {
      return isRx18
    } else if (purifyLevel === Purify_Level.PX18_PLUS) {
      return isRx18 || isPx18
    }
    return false
  }

  /**
   * @description 检查给定相对路径的图片是否被当前生效的封禁列表（手动或净化）屏蔽。
   */
  static async CheckIfPurified(relativePath, logger = global.logger || console) {
    
    const normalizedPath = relativePath?.replace(/\\/g, '/')
    if (!normalizedPath) return false
    if (MiaoPluginMBT.#activeBanSet.has(normalizedPath)) return true
    const imgData = MiaoPluginMBT.#imgDataCache.find(img => img.path === normalizedPath)
    if (imgData) {
      const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl
      return MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, level)
    } 
    return false
  }

  /**
   * @description 向用户报告错误，优先使用合并转发消息，失败则回退文本。
   */
  static async ReportError(e, operationName, error, context = '', logger = global.logger || console) {
    
    const Report = MiaoPluginMBT.FormatError(operationName, error, context) 
    logger.error(
      `${Default_Config.logPrefix} [${operationName}] 操作失败:`,
      error?.message || error,
      error?.stack ? `\nStack(部分): ${error.stack.substring(0, 500)}...` : '',
      context ? `\nContext: ${context}` : ''
    )
    const messagesToSend = []
    if (Report.summary) messagesToSend.push(Report.summary)
    if (Report.suggestions) messagesToSend.push(`【🤔 可能原因与建议】\n${Report.suggestions}`)
    if (Report.contextInfo) messagesToSend.push(`【ℹ️ 上下文信息】\n${Report.contextInfo}`)
    if (Report.stack) {
      const maxStackLength = 1000
      const stackInfo =
        Report.stack.length > maxStackLength
          ? Report.stack.substring(0, maxStackLength) + '... (后面省略了)'
          : Report.stack
      messagesToSend.push(`【🛠️ 技术细节 - 调用栈(部分)】\n${stackInfo}`)
    }
    try {
      const shortMessage = `${Default_Config.logPrefix} 执行 ${operationName} 操作时遇到点问题！(错误码: ${
        error?.code || '未知'
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
          logger.warn(
            `${Default_Config.logPrefix} [错误报告] 创建/发送合并消息失败 (${forwardError.message})，尝试发送文本...`
          )
          if (Report.summary)
            await e.reply(Report.summary.substring(0, 300) + (Report.summary.length > 300 ? '...' : ''))
          if (Report.suggestions)
            await e.reply(
              `【🤔 建议】\n${Report.suggestions.substring(0, 300) + (Report.suggestions.length > 300 ? '...' : '')}`
            )
          await e.reply('(详细信息请康康控制台日志哦)')
        }
      } else {
        logger.warn(
          `${Default_Config.logPrefix} [错误报告] 无法创建合并消息 (common.makeForwardMsg 不可用或消息为空)。`
        )
        await e.reply('(详细错误信息请康康控制台日志哈)')
      }
    } catch (reportError) {
      logger.error(`${Default_Config.logPrefix} [错误报告] CRITICAL: 报告错误时也发生错误:`, reportError)
      logger.error(`${Default_Config.logPrefix} === 原始错误 (${operationName}) ===`, error)
    }
  }

  /**
   * @description 格式化错误信息，生成包含摘要、建议、上下文和堆栈的报告对象。
   */
  static FormatError(operationName, error, context = '') {
    
    const Report = {
      summary: `${Default_Config.logPrefix} 操作 [${operationName}] 失败了！`,
      contextInfo: context || '（没啥额外信息）',
      suggestions: '',
      stack: error?.stack || '（调用栈信息丢失了）',
    }
    if (error?.message) Report.summary += `\n错误信息: ${error.message}`
    if (error?.code) Report.summary += ` (Code: ${error.code})`
    if (error?.signal) Report.summary += ` (Signal: ${error.signal})`
    const stderr = error?.stderr || ''
    const stdout = error?.stdout || ''
    const errorString = `${error?.message || ''} ${stderr} ${String(error?.code) || ''} ${context || ''}`.toLowerCase()
    const suggestionsMap = {
      'could not resolve host': '网络问题: 是不是 DNS 解析不了主机？检查下网络和 DNS 设置。',
      'connection timed out': '网络问题: 连接超时了，网不好或者对面服务器挂了？',
      'connection refused': '网络问题: 对面服务器拒绝连接，端口对吗？防火墙开了？',
      'ssl certificate problem': '网络问题: SSL 证书有问题，系统时间对不对？或者需要更新证书？',
      '403 forbidden': '访问被拒 (403): 没权限访问这个地址哦。',
      '404 not found': '资源未找到 (404): URL 写错了或者文件真的没了。',
      'unable to access': 'Git 访问失败: 检查网络、URL、代理设置对不对，或者仓库是不是私有的？',
      'authentication failed': 'Git 认证失败: 用户名密码或者 Token 不对吧？',
      'permission denied': '权限问题: Yunzai 没权限读写文件或目录，检查下文件夹权限。',
      'index file corrupt': 'Git 仓库可能坏了: 试试删掉 `.git/index` 文件？不行就得 #重置咕咕牛 了。',
      'lock file|index.lock': 'Git 正忙着呢: 等一下下，或者手动删掉 `.git/index.lock` 文件（小心点！）',
      'commit your changes or stash them': 'Git 冲突: 本地文件改动了和远程对不上，试试 #更新咕咕牛 强制覆盖？',
      'not a git repository': 'Git: 这地方不是个 Git 仓库啊。',
      'unrelated histories': 'Git 历史冲突: 这个得 #重置咕咕牛 才能解决了。',
      'not possible to fast-forward': 'Git: 无法快进合并，#更新咕咕牛 强制覆盖试试。',
      [ERROR_CODES.NotFound]: '文件系统: 找不到文件或目录，路径对吗？',
      [ERROR_CODES.Access]: '文件系统: 没权限访问这个文件或目录。',
      [ERROR_CODES.Busy]: '文件系统: 文件或目录正被占用，稍后再试试？',
      [ERROR_CODES.NotEmpty]: '文件系统: 文件夹里还有东西，删不掉。',
      [ERROR_CODES.ConnReset]: '网络: 连接突然断了。',
      [ERROR_CODES.Timeout]: '操作超时了，等太久了...',
      'json.parse': '数据问题: JSON 文件格式不对，检查下 `imagedata.json` 或 `banlist.json`。',
      'yaml.parse': '配置问题: YAML 文件格式不对，检查下 `GalleryConfig.yaml`。',
    }
    let matchedSuggestion = null
    if (error instanceof ReferenceError && error.message.includes('is not defined')) {
      matchedSuggestion = '代码出错了: 引用了不存在的变量或函数。如果没改过代码，可能是插件 Bug，快去反馈！'
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
    if (matchedSuggestion) {
      finalSuggestions.push(`- ${matchedSuggestion}`)
    } else {
      finalSuggestions.push('- 暂时没头绪，看看下面的通用建议？')
    }
    finalSuggestions.push(
      '- 检查网络连接是不是通畅。',
      '- 检查 Yunzai 目录和插件目录的权限设置。',
      '- 仔细看看控制台输出的详细错误日志。'
    )
    if (operationName.includes('下载') || operationName.includes('更新')) {
      finalSuggestions.push('- 确保电脑上正确安装了 Git。', '- 试试 `#咕咕牛测速` 看看网络节点情况。')
    }
    finalSuggestions.push(
      '- 万能大法：重启 Yunzai-Bot 试试？',
      '- 如果一直不行，终极大法：`#重置咕咕牛` 然后重新 `#下载咕咕牛`。'
    )
    Report.suggestions = finalSuggestions.join('\n')
    if (stdout || stderr) {
      Report.contextInfo += '\n--- Git 输出信息 ---'
      const maxLen = 500
      if (stdout)
        Report.contextInfo += `\n[stdout]:\n${stdout.substring(0, maxLen)}${
          stdout.length > maxLen ? '...(后面省略)' : ''
        }`
      if (stderr)
        Report.contextInfo += `\n[stderr]:\n${stderr.substring(0, maxLen)}${
          stderr.length > maxLen ? '...(后面省略)' : ''
        }`
    }
    return Report
  }

  /**
   * @description 检查指定仓库是否已下载。
   */
  static async IsTuKuDownloaded(RepoNum = 1) {
    
    const gitPath = RepoNum === 1 ? MiaoPluginMBT.paths.gitFolderPath : MiaoPluginMBT.paths.gitFolderPath2
    try {
      await fsPromises.access(gitPath)
      const stats = await fsPromises.stat(gitPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  /**
   * @description 加载图库配置文件。
   */
  static async LoadTuKuConfig(
    forceReload = false,
    logger = global.logger || console,
    configPath = MiaoPluginMBT.paths.configFilePath
  ) {
    
    if (!forceReload && MiaoPluginMBT.MBTConfig && Object.keys(MiaoPluginMBT.MBTConfig).length > 0) {
      return MiaoPluginMBT.MBTConfig
    }
    let configData = {}
    try {
      await fsPromises.access(configPath)
      const content = await fsPromises.readFile(configPath, 'utf8')
      configData = yaml.parse(content) || {}
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        logger.info(`${Default_Config.logPrefix} [加载配置] ${configPath} 未找到，将使用默认配置。`)
        configData = {}
      } else {
        logger.error(`${Default_Config.logPrefix} [加载配置] 读取或解析配置文件 ${configPath} 失败:`, error)
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
      logger.warn(
        `${Default_Config.logPrefix} [加载配置] 检测到无效的净化等级配置 (${loadedConfig.PFL})，已重置为默认值 (${Default_Config.defaultPfl})。`
      )
      loadedConfig.PFL = Default_Config.defaultPfl
    }
    MiaoPluginMBT.MBTConfig = loadedConfig
    logger.info(
      `${Default_Config.logPrefix} [加载配置] 配置加载完成: 图库=${loadedConfig.TuKuOP ? '开' : '关'}, PFL=${
        loadedConfig.PFL
      } (${Purify_Level.getDescription(loadedConfig.PFL)})`
    )
    return MiaoPluginMBT.MBTConfig
  }

  /**
   * @description 保存图库配置到文件。
   */
  static async SaveTuKuConfig(configData, logger = global.logger || console) {
    
    const dataToSave = { TuKuOP: configData.TuKuOP, PFL: configData.PFL, cronUpdate: configData.cronUpdate }
    try {
      await fsPromises.mkdir(path.dirname(MiaoPluginMBT.paths.configFilePath), { recursive: true })
      const yamlString = yaml.stringify(dataToSave)
      await fsPromises.writeFile(MiaoPluginMBT.paths.configFilePath, yamlString, 'utf8')
      logger.info(`${Default_Config.logPrefix} [保存配置] 成功保存配置到 ${MiaoPluginMBT.paths.configFilePath}`)
      MiaoPluginMBT.MBTConfig = { ...MiaoPluginMBT.MBTConfig, ...dataToSave }
      return true
    } catch (error) {
      logger.error(
        `${Default_Config.logPrefix} [保存配置] 写入配置文件 ${MiaoPluginMBT.paths.configFilePath} 失败:`,
        error
      )
      return false
    }
  }

  /**
   * @description 加载图片元数据 (imagedata.json)，支持回退。
   */
  static async LoadImageData(forceReload = false, logger = global.logger || console) {
    
    if (MiaoPluginMBT.#imgDataCache?.length > 0 && !forceReload) {
      return MiaoPluginMBT.#imgDataCache
    }
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
      success = true
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        try {
          await fsPromises.access(secondaryPath)
          const sourceContent = await fsPromises.readFile(secondaryPath, 'utf8')
          data = JSON.parse(sourceContent)
          logger.info(`${Default_Config.logPrefix} [加载元数据] 从仓库源加载成功: ${secondaryPath}`)
          success = true
        } catch (srcError) {
          if (srcError.code === ERROR_CODES.NotFound) {
            data = null
            success = false
          } else {
            logger.error(
              `${Default_Config.logPrefix} [加载元数据] 加载或解析仓库源文件失败 (${secondaryPath}):`,
              srcError
            )
            data = null
            success = false
          }
        }
      } else {
        logger.error(
          `${Default_Config.logPrefix} [加载元数据] 读取或解析主路径文件失败 (${primaryPath}):`,
          error
        )
        data = null
        success = false
      }
    }
    let finalData = []
    if (!success || !Array.isArray(data) || data.length === 0) {
      if (!success)
        logger.warn(`${Default_Config.logPrefix} [加载元数据] 无法从文件加载元数据，执行扫描回退...`)
      else logger.warn(`${Default_Config.logPrefix} [加载元数据] 加载的元数据为空或格式错误，执行扫描回退...`)
      try {
        finalData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(logger)
        logger.info(
          `${Default_Config.logPrefix} [加载元数据] 扫描回退完成，找到 ${finalData.length} 个图片文件。`
        )
      } catch (scanError) {
        
        logger.error(`${Default_Config.logPrefix} [加载元数据] 扫描回退过程中发生错误:`, scanError)
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
          const pathRegex = /^[a-z]+-character\/[^/]+\/[^/]+Gu\d+\.webp$/i
          const normalizedPath = item.path.replace(/\\/g, '/')
          const pathIsValid = pathRegex.test(normalizedPath)
          if (!pathIsValid)
            logger.warn(`${Default_Config.logPrefix} [加载元数据] 过滤掉格式错误的图片路径: ${item.path}`)
          return pathIsValid
        })
        .map(item => ({ ...item, path: item.path.replace(/\\/g, '/') }))
      const validCount = validData.length
      const invalidCount = originalCount - validCount
      if (invalidCount > 0)
        logger.warn(
          `${Default_Config.logPrefix} [加载元数据] 在处理过程中忽略了 ${invalidCount} 条无效或格式错误的元数据。`
        )
      logger.info(
        `${Default_Config.logPrefix} [加载元数据] 处理完成，最终获得 ${validCount} 条有效图片元数据。`
      )
      return validData
    } else {
      logger.error(
        `${Default_Config.logPrefix} [加载元数据] CRITICAL: 最终元数据结果不是一个数组！返回空数组。`
      )
      return []
    }
  }

  /**
   * @description 扫描本地仓库目录，构建基础的图片元数据缓存 (用于回退)。
   */
  static async ScanLocalImagesToBuildCache(logger = global.logger || console) {
    
    const fallbackCache = []
    const ReposToScan = []
    if (await MiaoPluginMBT.IsTuKuDownloaded(1))
      ReposToScan.push({ num: 1, path: MiaoPluginMBT.paths.LocalTuKuPath, name: '一号仓库' }) 
    const Repo2Configured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    if (Repo2Configured && (await MiaoPluginMBT.IsTuKuDownloaded(2)))
      ReposToScan.push({ num: 2, path: MiaoPluginMBT.paths.LocalTuKuPath2, name: '二号仓库' }) 
    if (ReposToScan.length === 0) {
      logger.warn(`${Default_Config.logPrefix} [扫描回退] 没有找到本地图库仓库目录，无法扫描。`)
      return []
    }
    logger.info(
      `${Default_Config.logPrefix} [扫描回退] 开始扫描本地仓库: ${ReposToScan.map(r => r.name).join(', ')}...`
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
                  logger.warn(
                    `${Default_Config.logPrefix} [扫描回退] 读取角色目录 ${charFolderPath} 失败:`,
                    readCharErr.code
                  )
              }
            }
          }
        } catch (readGameErr) {
          if (readGameErr.code !== ERROR_CODES.NotFound && readGameErr.code !== ERROR_CODES.Access)
            logger.warn(
              `${Default_Config.logPrefix} [扫描回退] 读取游戏目录 ${gameFolderPath} 失败:`,
              readGameErr.code
            )
        }
      }
    }
    logger.info(
      `${Default_Config.logPrefix} [扫描回退] 扫描完成，共找到 ${fallbackCache.length} 个独立的 .webp 图片文件。`
    )
    return fallbackCache
  }

  /**
   * @description 发送消息给配置文件中指定的主人。
   */
  static async SendMasterMsg(msg, botUin = global.Bot?.uin, sleep = 1000, logger = global.logger || console) {
    
    const logPrefix = Default_Config.logPrefix
    const botConfig = global.Config?.getConfig?.('bot') || {}
    const sendMasterConfig = global.Config?.sendMaster || {}
    const masterAppConfig = global.Config?.master || {}
    let masterQQ = []
    let targetBotUin = botUin
    if (Array.isArray(botConfig.masterQQ) && botConfig.masterQQ.length > 0) {
      masterQQ = [...botConfig.masterQQ]
    } else if (botConfig.masterQQ && !Array.isArray(botConfig.masterQQ)) {
      masterQQ = [String(botConfig.masterQQ)]
    }
    if (targetBotUin && masterAppConfig[targetBotUin] && masterAppConfig[targetBotUin].length > 0) {
      masterQQ = [...masterAppConfig[targetBotUin]]
      logger.debug(`${logPrefix} [通知主人] 使用 Bot ${targetBotUin} 的特定主人配置。`)
    } else {
      if (masterQQ.length === 0) {
        logger.warn(`${logPrefix} [通知主人] 未在 bot.yaml 或 Config.master 中找到有效的主人QQ配置。`)
        return false
      }
      logger.debug(`${logPrefix} [通知主人] 使用 bot.yaml 中的全局主人列表。`)
    }
    masterQQ = masterQQ.map(qq => String(qq).trim()).filter(qq => /^\d{5,}$/.test(qq))
    if (masterQQ.length === 0) {
      logger.warn(`${logPrefix} [通知主人] 清理后，最终可用主人QQ列表为空。`)
      return false
    }
    const masterSendMode = sendMasterConfig.Master
    let targets = []
    if (masterSendMode === 1) {
      targets = masterQQ
      logger.info(`${logPrefix} [通知主人] 配置为群发模式，目标数量: ${targets.length}`)
    } else if (masterSendMode === 0) {
      targets = [masterQQ[0]]
      logger.info(`${logPrefix} [通知主人] 配置为仅首位模式，目标: ${targets[0]}`)
    } else if (masterSendMode && /^\d{5,}$/.test(String(masterSendMode))) {
      targets = [String(masterSendMode)]
      logger.info(`${logPrefix} [通知主人] 配置为指定模式，目标: ${targets[0]}`)
    } else {
      logger.warn(
        `${logPrefix} [通知主人] 未配置有效的发送模式 (Config.sendMaster.Master)，默认发送给首位主人: ${masterQQ[0]}`
      )
      targets = [masterQQ[0]]
    }
    if (targets.length === 0 || !targets[0]) {
      logger.warn(`${logPrefix} [通知主人] 未确定有效的发送目标QQ。`)
      return false
    }
    let successCount = 0
    const isGroupSend = masterSendMode === 1 && targets.length > 1
    for (let i = 0; i < targets.length; i++) {
      const targetQQ = targets[i]
      if (!targetQQ) continue
      try {
        let sent = false
        if (global.Bot?.sendMasterMsg && typeof global.Bot.sendMasterMsg === 'function') {
          logger.debug(`${logPrefix} [通知主人] 尝试 Bot.sendMasterMsg -> ${targetQQ}`)
          sent = await global.Bot.sendMasterMsg(targetQQ, msg, targetBotUin)
          if (!sent) {
            logger.warn(`${logPrefix} [通知主人] Bot.sendMasterMsg 调用返回失败，尝试回退...`)
          }
        }
        if (!sent && common?.relpyPrivate) {
          logger.debug(`${logPrefix} [通知主人] 尝试 common.relpyPrivate -> ${targetQQ}`)
          await common.relpyPrivate(targetQQ, msg, targetBotUin)
          sent = true
        } else if (!sent) {
          logger.error(`${logPrefix} [通知主人] 无法找到有效的发送方法！`)
          continue
        }
        successCount++
        logger.info(`${logPrefix} [通知主人] 已发送给 ${targetQQ} (${i + 1}/${targets.length})`)
        if (isGroupSend && i < targets.length - 1 && sleep > 0) {
          await common.sleep(sleep)
        }
      } catch (error) {
        logger.error(`${logPrefix} [通知主人] 发送给 ${targetQQ} 出错:`, error)
      }
    }
    logger.info(`${logPrefix} [通知主人] 发送流程结束，成功发送 ${successCount} 条。`)
    return successCount > 0
  }

  /**
   * @description 加载用户手动封禁列表 (banlist.json)。
   */
  static async LoadUserBans(forceReload = false, logger = global.logger || console) {
    
    if (MiaoPluginMBT.#userBanSet instanceof Set && MiaoPluginMBT.#userBanSet.size > 0 && !forceReload) {
      return true
    }
    let data = []
    let success = false
    try {
      const content = await fsPromises.readFile(MiaoPluginMBT.paths.banListPath, 'utf8')
      data = JSON.parse(content)
      success = true
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        logger.info(`${Default_Config.logPrefix} [加载用户封禁] banlist.json 未找到。`)
        data = []
        success = true
      } else {
        logger.error(`${Default_Config.logPrefix} [加载用户封禁] 读取或解析失败:`, error)
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
        logger.warn(`${Default_Config.logPrefix} [加载用户封禁] 忽略 ${invalidOrDuplicateCount} 条无效/重复。`)
      logger.info(`${Default_Config.logPrefix} [加载用户封禁] 完成: ${validCount} 条。`)
      return true
    } else {
      if (success && !Array.isArray(data)) {
        logger.error(
          `${Default_Config.logPrefix} [加载用户封禁] banlist.json 文件内容格式错误，不是一个有效的数组！`
        )
      }
      MiaoPluginMBT.#userBanSet = new Set()
      return false
    }
  }

  /**
   * @description 保存当前用户手动封禁列表到文件。
   */
  static async SaveUserBans(logger = global.logger || console) {
    
    const sortedBans = Array.from(MiaoPluginMBT.#userBanSet).sort()
    try {
      const jsonString = JSON.stringify(sortedBans, null, 2)
      await fsPromises.mkdir(path.dirname(MiaoPluginMBT.paths.banListPath), { recursive: true })
      await fsPromises.writeFile(MiaoPluginMBT.paths.banListPath, jsonString, 'utf8')
      logger.info(`${Default_Config.logPrefix} [保存用户封禁] ${MiaoPluginMBT.#userBanSet.size} 条记录。`)
      return true
    } catch (error) {
      logger.error(`${Default_Config.logPrefix} [保存用户封禁] 写入失败:`, error)
      return false
    }
  }

  /**
   * @description 加载所有来源的角色别名数据。
   */
  static async LoadAliasData(forceReload = false, logger = global.logger || console) {
    
    if (MiaoPluginMBT.#aliasData && !forceReload) return true
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
              logger.error(`${Default_Config.logPrefix} [加载别名] 导入 JS 失败 (${filePath}):`, importErr)
              overallSuccess = false
            }
          }
        } else if (fileType === 'yaml') {
          try {
            const content = await fsPromises.readFile(filePath, 'utf8')
            data = yaml.parse(content) || {}
          } catch (yamlErr) {
            logger.error(`${Default_Config.logPrefix} [加载别名] 解析 YAML 失败 (${filePath}):`, yamlErr)
            overallSuccess = false
          }
        }
      } catch (err) {
        if (err.code !== ERROR_CODES.NotFound) {
          logger.warn(`${Default_Config.logPrefix} [加载别名] 读取 ${fileType} 文件失败: ${filePath}`, err.code)
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
    logger.info(`${Default_Config.logPrefix} [加载别名] 完成: ${combinedCount}主名。成功: ${overallSuccess}`)
    return overallSuccess
  }

  /**
   * @description 将生效的封禁列表应用到目标插件目录，删除对应图片文件。
   */
  static async ApplyBanList(effectiveBanSet = MiaoPluginMBT.#activeBanSet, logger = global.logger || console) {
    
    if (!(effectiveBanSet instanceof Set) || effectiveBanSet.size === 0) {
      return
    }
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
                logger.warn(`${Default_Config.logPrefix} [应用封禁] 删除 ${targetPath} 失败:`, unlinkErr.code)
            })
        )
      }
    }
    await Promise.all(deletePromises)
    logger.info(
      `${Default_Config.logPrefix} [应用封禁] 完成: 处理 ${deletePromises.length} 项, 删除 ${deletedCount} 文件。`
    )
  }

  /**
   * @description 根据图片相对路径，推断其在目标插件中的绝对路径。
   */
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

  /**
   * @description 智能查找图片的绝对路径 (优先仓库2，再仓库1)。
   */
  static async FindImageAbsolutePath(relativePath) {
    
    if (!relativePath) return null
    const normalizedPath = relativePath.replace(/\\/g, '/')
    const logger = global.logger || console
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1) 
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
    return null
  }

  /**
   * @description 根据输入名称查找标准角色名和是否存在。
   */
  static async FindRoleAlias(inputName, logger = global.logger || console) {
    
    const cleanInput = inputName?.trim()
    if (!cleanInput) return { mainName: null, exists: false }
    if (!MiaoPluginMBT.#aliasData) {
      await MiaoPluginMBT.LoadAliasData(false, logger)
      if (!MiaoPluginMBT.#aliasData?.combined) {
        logger.error(`${Default_Config.logPrefix} [查找别名] 无法加载。`)
        const dirExistsFallback = await MiaoPluginMBT.CheckRoleDirExists(cleanInput)
        return { mainName: cleanInput, exists: dirExistsFallback }
      }
    } 
    const combinedAliases = MiaoPluginMBT.#aliasData.combined || {}
    const lowerInput = cleanInput.toLowerCase()
    if (combinedAliases.hasOwnProperty(cleanInput)) return { mainName: cleanInput, exists: true }
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

  /**
   * @description 检查指定角色名是否存在对应的本地图库目录。
   */
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

  /**
   * @description 解析角色标识符 (如 "花火1", "花火Gu1") 为角色名和编号。
   */
  static ParseRoleIdentifier(identifier) {
    
    if (!identifier) return null
    const match = identifier.trim().match(/^(.*?)(?:Gu)?(\d+)$/i)
    if (match && match[1] && match[2]) {
      const mainName = match[1].trim()
      if (mainName) return { mainName: mainName, imageNumber: match[2] }
    }
    return null
  }

  /**
   * @description 获取指定仓库的 Git 提交日志。
   */
  static async GetTuKuLog(
    count = 5,
    RepoPath = MiaoPluginMBT.paths.LocalTuKuPath,
    logger = global.logger || console
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
      
      logger.warn(`${Default_Config.logPrefix} [获取日志] Git log 失败 (${RepoPath})`)
      return null
    }
  }

  /**
   * @description 下载单个仓库，包含代理选择和 Fallback 重试逻辑。
   */
  static async DownloadRepoWithFallback(repoNum, repoUrl, branch, localPath, eForProgress, logger) {
    
    const logPrefix = Default_Config.logPrefix
    const repoName = repoNum === 1 ? '一号仓库' : '二号仓库'
    const baseRawUrl = RAW_URL_Repo1
    logger.info(`${logPrefix} [下载流程 ${repoName}] 开始下载: ${repoUrl}`)
    let sourcesToTry = []
    let allTestResults = []
    const startTime = Date.now()
    try {
      allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, logger)
      sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, logger)
    } catch (testError) {
      
      logger.error(`${logPrefix} [下载流程 ${repoName}] 代理测速失败:`, testError)
      const githubSource = Default_Config.proxies.find(p => p.name === 'GitHub')
      if (githubSource) {
        sourcesToTry.push({ ...githubSource, speed: Infinity })
        allTestResults = Default_Config.proxies.map(p => ({ ...p, speed: Infinity }))
      }
    }
    let tempHtmlFilePath = ''
    let tempImgFilePath = ''
    if (eForProgress && repoNum === 1 && allTestResults.length > 0) {
      try {
        const bestSource = sourcesToTry[0] || null
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        const processSpeeds = speeds => {
          return speeds
            .map(s => {
              let statusText = 'timeout'
              if (s.testUrlPrefix === null) {
                statusText = 'na'
              } else if (Number.isFinite(s.speed) && s.speed >= 0) {
                statusText = 'ok'
              }
              return { ...s, statusText }
            })
            .sort(
              (a, b) =>
                (a.priority ?? 999) - (b.priority ?? 999) ||
                (a.speed === Infinity ? 1 : b.speed === Infinity ? -1 : a.speed - b.speed)
            )
        }
        const processedSpeeds1 = processSpeeds(allTestResults)
        const renderData = { speeds1: processedSpeeds1, best1: bestSource, duration: duration }
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true })
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true })
        const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'speedtest.html')
        tempHtmlFilePath = path.join(
          MiaoPluginMBT.paths.tempHtmlPath,
          `dl-speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
        )
        tempImgFilePath = path.join(
          MiaoPluginMBT.paths.tempImgPath,
          `dl-speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
        )
        await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath)
        const img = await puppeteer.screenshot('guguniu-dl-speedtest', {
          tplFile: tempHtmlFilePath,
          savePath: tempImgFilePath,
          imgType: 'png',
          pageGotoParams: { waitUntil: 'networkidle0' },
          ...renderData,
          screenshotOptions: { fullPage: false },
          pageBoundingRect: { selector: 'body', padding: 0 },
          width: 540,
        })
        if (img) {
          await eForProgress.reply(img)
          await common.sleep(500)
          await eForProgress
            .reply(`✅ 优选: ${bestSource ? bestSource.name : '无'}\n⏳ 开始下载 ${repoName}...`)
            .catch(() => {})
        } 
        else {
          logger.error(`${logPrefix} [下载流程 ${repoName}] 生成测速截图失败。`)
          await eForProgress.reply(`${logPrefix} 生成测速报告失败，将直接开始下载...`).catch(() => {})
        } 
      } catch (renderOrReplyError) {
        logger.error(`${logPrefix} [下载流程 ${repoName}] 回复测速结果失败:`, renderOrReplyError)
        await eForProgress.reply(`${logPrefix} 处理测速报告时出错，将直接开始下载...`).catch(() => {})
      } finally {
        
        if (tempHtmlFilePath) {
          try {
            await fsPromises.unlink(tempHtmlFilePath)
          } catch (unlinkErr) {}
        }
        if (tempImgFilePath) {
          try {
            await fsPromises.unlink(tempImgFilePath)
          } catch (unlinkErr) {}
        }
      }
    }
    if (sourcesToTry.length === 0) {
      logger.error(`${logPrefix} [下载流程 ${repoName}] 没有任何可用的下载源！`)
      return { success: false, nodeName: '无可用源' }
    }
    let lastError = null
    for (const source of sourcesToTry) {
      const nodeName = source.name === 'GitHub' ? 'GitHub(直连)' : `${source.name}(代理)`
      logger.info(`${logPrefix} [下载流程 ${repoName}] 尝试使用源: ${nodeName}`)
      let cloneUrl = ''
      let proxyForEnv = null
      if (source.name === 'GitHub') {
        cloneUrl = repoUrl
      } else if (source.cloneUrlPrefix) {
        if (source.name === 'GitClone') {
          cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl.replace(/^https?:\/\//, '')}`
        } else {
          cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl}`
        }
      } else {
        logger.warn(`${logPrefix} [下载流程 ${repoName}] 源 ${source.name} 没有有效的 cloneUrlPrefix，跳过。`)
        continue
      }
      if (source.name !== 'GitHub' && source.cloneUrlPrefix) {
        try {
          const proxyUrl = new URL(source.cloneUrlPrefix)
          if (['http:', 'https:'].includes(proxyUrl.protocol)) proxyForEnv = proxyUrl.origin
        } catch (urlError) {
          logger.warn(
            `${logPrefix} [下载流程 ${repoName}] 无法解析代理 ${source.name} 的 cloneUrlPrefix 用于环境变量: ${urlError.message}`
          )
        }
      }
      const cloneArgs = ['clone', `--depth=${Default_Config.gitCloneDepth}`, '--progress', cloneUrl, localPath]
      const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false }
      if (proxyForEnv) {
        gitOptions.env = { ...process.env, HTTP_PROXY: proxyForEnv, HTTPS_PROXY: proxyForEnv }
        logger.info(`${logPrefix} [下载流程 ${repoName}] 为 Git 命令设置了代理环境变量: ${proxyForEnv}`)
      } else {
        /* logger.info(`${logPrefix} [下载流程 ${repoName}] 未设置代理环境变量。`); */
      } // 调试用
      try {
        let progressReported = { 10: false, 50: false, 90: false }
        const cloneResult = await ExecuteCommand(
          'git',
          cloneArgs,
          gitOptions,
          Default_Config.gitCloneTimeout,
          stderrChunk => {
            if (repoNum === 1 && eForProgress) {
              const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/)
              if (match?.[1]) {
                const progress = parseInt(match[1], 10)
                ;[10, 50, 90].forEach(t => {
                  if (progress >= t && !progressReported[t]) {
                    progressReported[t] = true
                    const msg = `『咕咕牛』聚合下载: ${t}%... (${nodeName})`
                    eForProgress.reply(msg).catch(() => {})
                  }
                })
              }
            } else if (repoNum !== 1) {
              const match = stderrChunk.match(/(Receiving objects|Resolving deltas):\s*(\d+)%/)
              if (match)
                logger.debug(`${logPrefix} [下载进度 ${repoName}] (${nodeName}) ${match[1]}: ${match[2]}%`)
            }
          }
        ) 
        logger.info(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载成功！`)
        return { success: true, nodeName: nodeName }
      } catch (error) {
        logger.error(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载失败。`)
        logger.error(error)
        lastError = error
        logger.warn(`${logPrefix} [下载流程 ${repoName}] 尝试清理失败的目录: ${localPath}`)
        await safeDelete(localPath)
        await common.sleep(1000) 
        if (eForProgress && repoNum === 1) {
          logger.warn(`${logPrefix} 使用源 ${nodeName} 下载 ${repoName} 失败，尝试下一个源...`);
      } else {
          logger.warn(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载失败，尝试下一个源...`);
      }
      }
    }
    logger.error(
      `${logPrefix} [下载流程 ${repoName}] 尝试了所有可用源 (${sourcesToTry.map(s => s.name).join(', ')})，均下载失败！`
    )
    if (repoNum === 1 && eForProgress) {
      await MiaoPluginMBT.ReportError(
        eForProgress,
        `下载${repoName}`,
        lastError || new Error('所有源下载失败'),
        `尝试源: ${sourcesToTry.map(s => s.name).join(', ')}`,
        logger
      )
    } 
    else {
      logger.error(`${logPrefix} [下载流程 ${repoName}] 最终错误:`, lastError || '未知错误')
    }
    return { success: false, nodeName: '所有源失败', error: lastError }
  }

  /**
   * @description 更新单个仓库，包含冲突检测和强制重置逻辑。
   */
  static async UpdateSingleRepo(e, RepoNum, localPath, RepoName, RepoUrl, branch, isScheduled, logger) {
    
    const logPrefix = Default_Config.logPrefix
    logger.info(`${logPrefix} [更新仓库] 开始更新 ${RepoName} @ ${localPath}`)
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
        logger.info(`${logPrefix} [更新仓库] ${RepoName} 'git pull --ff-only' 成功。`)
      } catch (pullError) {
        
        pullOutput = pullError.stderr || pullError.stdout || pullError.message || String(pullError)
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} 'git pull --ff-only' 失败，错误码: ${pullError.code}`)
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} Git 输出:\n${pullOutput}`)
        if (
          pullError.code !== 0 &&
          (pullError.stderr?.includes('commit') ||
            pullError.stderr?.includes('unrelated') ||
            pullError.stderr?.includes('lock') ||
            pullError.stderr?.includes('fast-forward') ||
            pullError.message?.includes('failed'))
        ) {
          needsReset = true
          logger.warn(`${logPrefix} [更新仓库] ${RepoName} 检测到冲突或状态异常，准备尝试强制重置...`)
        } else throw pullError
      }
      if (needsReset) {
        logger.warn(`${logPrefix} [更新仓库] ${RepoName} 正在执行强制重置 (git fetch & git reset --hard)...`)
        try {
          await ExecuteCommand('git', ['fetch', 'origin'], { cwd: localPath }, Default_Config.gitPullTimeout)
          await ExecuteCommand('git', ['reset', '--hard', `origin/${branch}`], { cwd: localPath })
          success = true
          hasChanges = true
          logger.info(`${logPrefix} [更新仓库] ${RepoName} 强制重置成功。`)
          latestLog = await MiaoPluginMBT.GetTuKuLog(20, localPath, logger)
        } catch (resetError) {
          
          logger.error(`${logPrefix} [更新仓库] ${RepoName} 强制重置失败！`)
          success = false
          throw resetError
        }
      }
      if (success && !needsReset) {
        let newCommit = ''
        try {
          newCommit = (await ExecuteCommand('git', ['rev-parse', 'HEAD'], { cwd: localPath }, 5000)).stdout.trim()
        } catch {} 
        hasChanges = oldCommit && newCommit && oldCommit !== newCommit
        if (hasChanges) {
          logger.info(`${Default_Config.logPrefix} [更新仓库] ${RepoName} 检测到新的提交。`)
          latestLog = await MiaoPluginMBT.GetTuKuLog(20, localPath, logger)
        } 
        else if (pullOutput.includes('Already up to date')) {
          logger.info(`${Default_Config.logPrefix} [更新仓库] ${RepoName} 已是最新。`)
          latestLog = await MiaoPluginMBT.GetTuKuLog(1, localPath, logger)
        } 
        else {
          logger.warn(
            `${Default_Config.logPrefix} [更新仓库] ${RepoName} pull 成功但未检测到明确更新，获取最新日志...`
          )
          latestLog = await MiaoPluginMBT.GetTuKuLog(1, localPath, logger)
        } 
      }
    } catch (error) {
      success = false
      hasChanges = false
      logger.error(`${logPrefix} [更新仓库] ${RepoName} 更新操作失败。`)
      if (RepoNum === 1 && e && !isScheduled) {
        await MiaoPluginMBT.ReportError(
          e,
          `更新${RepoName}`,
          error,
          `Git输出(部分):\n${pullOutput.substring(0, 500)}`,
          logger
        )
      } 
      else {
        logger.error(error)
      }
    }
    return { success, hasChanges, log: latestLog }
  }

  /**
   * @description 执行首次下载后的设置步骤。
   */
  static async RunPostDownloadSetup(e, logger = global.logger || console) {
    
    logger.info(`${Default_Config.logPrefix} [下载后设置] 开始执行下载后初始化步骤...`)
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger) 
      await MiaoPluginMBT.SyncFilesToCommonRes(logger) 
      const sourceHtmlDir = path.join(MiaoPluginMBT.paths.LocalTuKuPath, 'GuGuNiu-Gallery', 'html')
      const targetHtmlDir = path.join(MiaoPluginMBT.paths.commonResPath, 'html')
      logger.info(`${Default_Config.logPrefix} [下载后设置] 同步 HTML 资源文件夹...`)
      try {
        await copyFolderRecursive(sourceHtmlDir, targetHtmlDir, {}, logger)
        logger.info(`${Default_Config.logPrefix} [下载后设置] HTML 资源文件夹同步成功。`)
      } catch (htmlSyncError) {
        
        logger.error(`${Default_Config.logPrefix} [下载后设置] 同步 HTML 资源文件夹失败:`, htmlSyncError)
        if (e) await MiaoPluginMBT.ReportError(e, '同步HTML资源', htmlSyncError, '', logger)
      } 
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger) 
      MiaoPluginMBT.#imgDataCache = Object.freeze(imageData)
      await MiaoPluginMBT.LoadUserBans(true, logger) 
      await MiaoPluginMBT.LoadAliasData(true, logger) 
      await MiaoPluginMBT.SyncSpecificFiles(logger) 
      logger.info(`${Default_Config.logPrefix} [下载后设置] 应用初始封禁规则...`)
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, logger) 
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        logger.info(`${Default_Config.logPrefix} [下载后设置] 配置为默认启用，开始同步角色图片...`)
        await MiaoPluginMBT.SyncCharacterFolders(logger)
      } 
      else {
        logger.info(`${Default_Config.logPrefix} [下载后设置] 图库配置为默认禁用，跳过角色图片同步。`)
      }
      logger.info(`${Default_Config.logPrefix} [下载后设置] 所有步骤执行成功。`)
    } catch (error) {
      logger.error(`${Default_Config.logPrefix} [下载后设置] 执行过程中发生错误:`, error)
      if (e) await MiaoPluginMBT.ReportError(e, '安装后设置', error, '', logger)
    } 
  }

  /**
   * @description 执行更新后的设置步骤。
   */
  static async RunPostUpdateSetup(e, isScheduled = false, logger = global.logger || console) {
    
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger) 
      await MiaoPluginMBT.SyncFilesToCommonRes(logger) 
      const sourceHtmlDir = path.join(MiaoPluginMBT.paths.LocalTuKuPath, 'GuGuNiu-Gallery', 'html')
      const targetHtmlDir = path.join(MiaoPluginMBT.paths.commonResPath, 'html')
      logger.info(`${Default_Config.logPrefix} [更新后设置] 同步 HTML 资源文件夹...`)
      try {
        await copyFolderRecursive(sourceHtmlDir, targetHtmlDir, {}, logger)
        logger.info(`${Default_Config.logPrefix} [更新后设置] HTML 资源文件夹同步成功。`)
      } catch (htmlSyncError) {
        
        logger.error(`${Default_Config.logPrefix} [更新后设置] 同步 HTML 资源文件夹失败:`, htmlSyncError)
        if (!isScheduled && e) await MiaoPluginMBT.ReportError(e, '同步HTML资源', htmlSyncError, '', logger)
        else if (isScheduled)
          logger.error(`${Default_Config.logPrefix} [定时更新] 同步 HTML 失败: ${htmlSyncError.message}`)
      } 
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger) 
      MiaoPluginMBT.#imgDataCache = Object.freeze(imageData)
      await MiaoPluginMBT.LoadUserBans(true, logger) 
      await MiaoPluginMBT.LoadAliasData(true, logger) 
      logger.info(`${Default_Config.logPrefix} [更新后设置] 同步特定文件...`)
      await MiaoPluginMBT.SyncSpecificFiles(logger) 
      logger.info(`${Default_Config.logPrefix} [更新后设置] 重新应用封禁规则...`)
      await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, logger) 
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        logger.info(`${Default_Config.logPrefix} [更新后设置] 图库已启用，正在同步更新后的角色图片...`)
        await MiaoPluginMBT.SyncCharacterFolders(logger)
      } 
      else {
        logger.info(`${Default_Config.logPrefix} [更新后设置] 图库已禁用，跳过角色图片同步。`)
      }
    } catch (error) {
      logger.error(`${Default_Config.logPrefix} [更新后设置] 执行过程中发生错误:`, error)
      if (!isScheduled && e)
        await MiaoPluginMBT.ReportError(e, '更新后设置', error, '', logger) 
      else if (isScheduled) {
        const Report = MiaoPluginMBT.FormatError('更新后设置(定时)', error)
        logger.error(
          `${Default_Config.logPrefix}--- 定时更新后设置失败 ----\n${Report.summary}\n${Report.suggestions}\n---`
        )
      } 
    }
  }

  /**
   * @description 同步仓库中的文件到公共资源目录。
   */
  static async SyncFilesToCommonRes(logger = global.logger || console) {
    
    await fsPromises.mkdir(MiaoPluginMBT.paths.commonResPath, { recursive: true })
    let s = 0,
      f = 0
    for (const { sourceSubPath, destFileName, copyIfExists = true } of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath)
      const dest = path.join(MiaoPluginMBT.paths.commonResPath, destFileName)
      try {
        await fsPromises.access(source)
        if (!copyIfExists) {
          try {
            await fsPromises.access(dest)
            continue
          } catch (destAccessError) {
            if (destAccessError.code !== ERROR_CODES.NotFound) throw destAccessError
          }
        }
        await fsPromises.mkdir(path.dirname(dest), { recursive: true })
        await fsPromises.copyFile(source, dest)
        s++
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          logger.error(`${Default_Config.logPrefix} [同步公共] ${sourceSubPath} 失败:`, error)
          f++
        }
      }
    }
    logger.info(`${Default_Config.logPrefix} [同步公共] 完成: ${s}成功, ${f}失败/跳过。`)
  }

  /**
   * @description 同步仓库中的特定文件到指定目标目录。
   */
  static async SyncSpecificFiles(logger = global.logger || console) {
    
    let s = 0,
      f = 0
    for (const { sourceSubPath, destDir, destFileName } of MiaoPluginMBT.paths.filesToSyncSpecific) {
      const source = path.join(MiaoPluginMBT.paths.LocalTuKuPath, sourceSubPath)
      const dest = path.join(destDir, destFileName)
      try {
        await fsPromises.access(source)
        await fsPromises.mkdir(destDir, { recursive: true })
        await fsPromises.copyFile(source, dest)
        s++
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          logger.error(`${Default_Config.logPrefix} [同步特定] ${sourceSubPath} -> ${dest} 失败:`, error)
          f++
        }
      }
    }
    logger.info(`${Default_Config.logPrefix} [同步特定] 完成: ${s}成功, ${f}失败/跳过。`)
  }

  /**
   * @description 同步角色图片文件夹到目标插件目录。
   */
  static async SyncCharacterFolders(logger = global.logger || console) {
    
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean)
    await Promise.all(targetPluginDirs.map(dir => MiaoPluginMBT.CleanTargetCharacterDirs(dir, logger))) 
    if (!MiaoPluginMBT.#imgDataCache || MiaoPluginMBT.#imgDataCache.length === 0) {
      logger.warn(`${Default_Config.logPrefix} [同步角色] 元数据为空。`)
      return
    }
    if (!MiaoPluginMBT.#activeBanSet) logger.warn(`${Default_Config.logPrefix} [同步角色] 封禁列表未初始化。`)
    logger.info(
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
                logger.warn(
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
    logger.info(
      `${Default_Config.logPrefix} [同步角色] 完成: 复制${copied}, 跳过(封禁${banned}+源丢失${missingSource}+无目标${noTarget})。`
    )
  }

  /**
   * @description 清理目标插件目录中由本插件创建的图片文件。
   */
  static async CleanTargetCharacterDirs(targetPluginDir, logger = global.logger || console) {
    
    if (!targetPluginDir) return
    logger.info(`${Default_Config.logPrefix} [清理目标] ${targetPluginDir}`)
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
                  logger.warn(`${Default_Config.logPrefix} [清理目标] 删除 ${filePath} 失败:`, unlinkErr.code)
              }
            }
          } catch (readSubErr) {
            if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readSubErr.code))
              logger.warn(`${Default_Config.logPrefix} [清理目标] 读取 ${characterPath} 失败:`, readSubErr.code)
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
              logger.warn(
                `${Default_Config.logPrefix} [清理目标] 删除根文件 ${rootFilePath} 失败:`,
                delErr.code
              )
          }
        }
      }
      logger.info(
        `${Default_Config.logPrefix} [清理目标] 完成: ${targetPluginDir}, 清理 ${cleanedCount} 文件。`
      )
    } catch (readBaseErr) {
      if (readBaseErr.code !== ERROR_CODES.NotFound && readBaseErr.code !== ERROR_CODES.Access)
        logger.error(`${Default_Config.logPrefix} [清理目标] 读取 ${targetPluginDir} 失败:`, readBaseErr)
    }
  }

  /**
   * @description 从本地仓库源恢复单个被解禁的文件到目标插件目录。
   */
  static async RestoreFileFromSource(relativePath, logger = global.logger || console) {
    
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
      logger.info(`${Default_Config.logPrefix} [恢复文件] ${targetPath}`)
      return true
    } catch (copyError) {
      logger.error(`${Default_Config.logPrefix} [恢复文件] ${relativePath} 失败:`, copyError)
      return false
    }
  }

  /**
   * @description 测试所有配置的代理节点的连通性和速度。
   */
  static async TestProxies(baseRawUrl = RAW_URL_Repo1, logger = global.logger || console) {
    
    const testFile = Default_Config.proxyTestFile
    const timeoutDuration = Default_Config.proxyTestTimeout
    const testPromises = Default_Config.proxies.map(async proxy => {
      let testUrl = ''
      let speed = Infinity
      if (!proxy || typeof proxy !== 'object') {
        logger.error(`${Default_Config.logPrefix} [网络测速] 遇到无效的代理配置项: ${proxy}`)
        return { name: '无效配置', speed: Infinity, priority: 9999, cloneUrlPrefix: null, testUrlPrefix: null }
      }
      const proxyName = proxy.name || '未命名'
      if (proxy.testUrlPrefix === null) {
        return {
          name: proxyName,
          speed: Infinity,
          priority: proxy.priority ?? 999,
          cloneUrlPrefix: proxy.cloneUrlPrefix,
          testUrlPrefix: null,
        }
      }
      try {
        if (proxy.name === 'GitHub') {
          testUrl = baseRawUrl + testFile
        } else if (proxy.testUrlPrefix) {
          testUrl = proxy.testUrlPrefix.replace(/\/$/, '') + testFile
          try {
            new URL(testUrl)
          } catch (urlError) {
            logger.warn(
              `${Default_Config.logPrefix} [网络测速] 构造的代理URL (${testUrl}) 格式可能不规范:`,
              urlError.message
            )
          }
        } else {
          return {
            name: proxyName,
            speed: Infinity,
            priority: proxy.priority ?? 999,
            cloneUrlPrefix: proxy.cloneUrlPrefix,
            testUrlPrefix: proxy.testUrlPrefix,
          }
        }
        const controller = new AbortController()
        const timeoutId = setTimeout(() => {
          controller.abort()
        }, timeoutDuration)
        const startTime = Date.now()
        try {
          const response = await fetch(testUrl, { method: 'GET', signal: controller.signal })
          clearTimeout(timeoutId)
          speed = Date.now() - startTime
          if (!response.ok) {
            logger.warn(
              `${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 状态码非 OK: ${response.status}`
            )
            speed = Infinity
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            speed = Infinity
            logger.warn(
              `${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 超时 (>${timeoutDuration}ms)`
            )
          } else {
            logger.error(
              `${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) fetch 出错: ${fetchError.message}`
            )
            speed = Infinity
          }
        }
      } catch (error) {
        logger.error(`${Default_Config.logPrefix} [网络测速] 处理节点 ${proxyName} 时发生意外错误:`, error)
        speed = Infinity
      }
      return {
        name: proxyName,
        speed: speed,
        priority: proxy.priority ?? 999,
        cloneUrlPrefix: proxy.cloneUrlPrefix,
        testUrlPrefix: proxy.testUrlPrefix,
      }
    })
    const results = await Promise.all(testPromises)
    return results
  }

  /**
   * @description 根据测速结果和优先级，选择最佳的可用下载源。
   */
  static GetSortedAvailableSources(speeds, includeUntestable = false, logger = global.logger || console) {
    
    if (!speeds || speeds.length === 0) return []
    const available = speeds.filter(s => {
      const testedOK = s.speed !== Infinity && (s.name === 'GitHub' || s.cloneUrlPrefix)
      const untestableButValid = includeUntestable && s.testUrlPrefix === null && s.cloneUrlPrefix
      return testedOK || untestableButValid
    })
    if (available.length === 0) {
      logger.warn(`${Default_Config.logPrefix} [选择源] 没有找到任何可用的下载源！`)
      return []
    }
    available.sort((a, b) => {
      const prioA = a.priority ?? 999
      const prioB = b.priority ?? 999
      if (prioA !== prioB) return prioA - prioB
      const speedA = a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed
      const speedB = b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed
      return speedA - speedB
    })
    const sourceNames = available.map(
      s =>
        `${s.name}(P:${s.priority ?? 'N'}${
          s.speed !== Infinity ? `, ${s.speed}ms` : s.testUrlPrefix === null ? ', N/A' : ', Timeout'
        })`
    )
    logger.info(`${Default_Config.logPrefix} [选择源] 可用下载源排序: ${sourceNames.join(' > ')}`)
    return available
  }

  /**
   * @description 获取当前插件的版本号
   */
  static GetVersionStatic() {
    
    try {
      const pkgPath = path.resolve(__dirname, '..', 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      return pkg.version || '4.8.0-Fix-Marks' 
    } catch {
      return '4.8.0-Fix-Marks' 
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
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: 'ExportSingleImage' },
  { reg: /^#查看\s*.+$/i, fnc: 'FindRoleSplashes' },
  { reg: /^#咕咕牛帮助$/i, fnc: 'Help' },
  { reg: /^#咕咕牛$/i, fnc: 'PluginInfo' },
  {
    reg: /^#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?$/i,
    fnc: 'TriggerError',
    permission: 'master',
  },
  { reg: /^#咕咕牛测速$/i, fnc: 'ManualTestProxies' }, 
  { reg: /^#执行咕咕牛更新$/i, fnc: 'ManualRunUpdateTask', permission: 'master' }
]
