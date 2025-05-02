import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, URL } from 'node:url'
import os from 'node:os'
import yaml from 'yaml'
import template from 'art-template'
import common from '../../lib/common/common.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'

/**
 * @description 咕咕牛图库管理器 - 双仓库增强版
 * @version 4.8.4
 * @based v4.1.10 & v4.6.6
 * @description_details
 *    - 实现双仓库并行下载及自动镜像源切换重试 (Fallback)。
 *    - 扩展并优化代理列表与优先级配置，修复代理测试与选择逻辑。
 *    - 确保代理环境变量正确传递给 Git 子进程，解决下载超时/失败后仍报告进度的时序问题。
 *    - 增强下载错误报告（显示尝试列表）。
 *    - #检查咕咕牛, #咕咕牛测速, #ban列表 命令改为图片渲染输出。
 *    - 新增 #咕咕牛设置 命令，提供可视化配置面板。
 *    - 优化设置类命令 (#启用/禁用咕咕牛, #设置咕咕牛净化等级) 交互，优先发送面板图片，失败则回退文本。
 *    - 优化 #查看 命令，结果过长时自动分批发送合并转发消息。
 *    - 优化 #导出 命令，改用 Buffer 发送并指定文件名，提高 OneBot v11/v12 兼容性。
 *    - 修复 #可视化 命令分批截图失败问题，优化截图样式并高亮含 "Gu" 文件名，页脚添加版本号。
 *    - 修复净化等级1错误屏蔽 Px18 图片的问题。
 *    - 优化 #ban列表 图片发送顺序和空列表处理逻辑。
 *    - 优化插件初始化逻辑，解决启动时日志重复打印问题，并自动延迟清理旧版插件文件。
 *    - 结构化调试信息，角色详情转发，结构化测试日志，回滚数据，智能寻找，数据防干扰。
 *    - 内置 SpeedTest 测速模板，并确保所有 HTML 模板在更新时同步。
 *    - Git 更新时自动检测本地冲突并强制覆盖。
 *    - #可视化 支持插件内所有常见图片格式。
 *    - 全局渲染精度配置 (renderScale)，通过 CSS transform:scale 提高所有截图清晰度。

 */

/**
 * @description  测速报告内置模板
 */
const SPEEDTEST_HTML_TEMPLATE = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>咕咕牛测速报告</title>
      <style>
          body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; margin: 0; padding: 20px; background: linear-gradient(to bottom, #e0f2f7, #ffffff); color: #333; font-size: 14px; line-height: 1.6; width: 500px; box-sizing: border-box; }
          .container {padding: 15px;background-color: rgba(255, 255, 255, 0.8);border-radius: 10px;border: 1px rgba(0, 255, 85, 0.8) solid;box-shadow: 5px 5px 0 0 rgba(0, 255, 85, 0.3);}
          h1 { text-align: center; color: rgba(7, 131, 48, 0.8); margin: 0 0 15px 0; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          h2 { font-size: 16px; color: #333; margin: 15px 0 10px 0; border-left: 4px solid #0077cc; padding-left: 8px; }
          ul { list-style: none; padding: 0; margin: 0; }
          li { display: flex; justify-content: space-between; align-items: center; padding: 8px 5px; border-bottom: 1px dashed #eee; }
          li:last-child { border-bottom: none; }
          .node-name { font-weight: bold; color: #555; flex-basis: 120px; flex-shrink: 0; }
          .node-status { text-align: right; flex-grow: 1; }
          .status-ok { color: #28a745; font-weight: bold; }
          .status-timeout { color: #dc3545; font-weight: bold; }
          .status-na { color: #aaa; }
          .priority { color: #777; font-size: 0.9em; margin-left: 5px; }
          .best-choice { margin-top: 20px;text-align: center;font-weight: 600;color: #00cc55;font-size: 1.05em;padding: 8px;background-color: rgba(0, 255, 64, 0.05);border-radius: 6px;}
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #999; }
      </style>
  </head>
  <body style="{{scaleStyleValue}}">
      <div class="container">
          <h1>咕咕牛网络测速报告</h1>
          {{ if speeds1 && speeds1.length > 0 }}
          <h2>聚合仓库基准 ({{ speeds1.length }} 节点)</h2>
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
                      <span class="priority">(优先级:{{ s.priority ?? 'N' }})</span>
                  </span>
              </li>
              {{ /each }}
          </ul>
          <div class="best-choice">✅ 优选: {{ best1 ? \`\${best1.name}(\${best1.testUrlPrefix === null ? 'N/A' : (Number.isFinite(best1.speed) && best1.speed >= 0 ? best1.speed + 'ms' : '超时')})\` : '无可用源' }}</div>
          {{ /if }}
          <div class="footer">测速耗时: {{ duration }}s | GuGuNiu</div>
      </div>
  </body>
  </html>
`

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
  getDescription: level => ({ 0: '不过滤', 1: '过滤R18', 2: '过滤R18及P18' }[level] ?? '未知'),
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
      cloneUrlPrefix: 'https://github.com/',
    },
  ],
  proxyTestFile: '/README.md', //测速文件
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
  renderScale: 300,  // Puppeteer 渲染精度

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
// ========================= 公共工具函数区域 =============================== //
// ========================================================================= //
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
          `${Default_Config.logPrefix} [安全删除] ${targetPath} 失败 (${attempts}/${maxAttempts}): ${err.code}, ${delay / 1000}s 后重试...`
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

// ================================================================= //
// ======================= 公共函数区域结束 ========================== //
// ================================================================= //

export class MiaoPluginMBT extends plugin {
  // --- 静态属性 ---
  static initializationPromise = null
  static isGloballyInitialized = false
  static MBTConfig = {}
  static #imgDataCache = []
  static #userBanSet = new Set()
  static #activeBanSet = new Set()
  static #aliasData = null
  static #backgroundImages = []; 

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
    tempPath: path.join(YunzaiPath, 'temp', 'html', 'guguniu'),
    tempHtmlPath: path.join(YunzaiPath, 'temp', 'html', 'guguniu'),
    tempImgPath: path.join(YunzaiPath, 'temp', 'html', 'guguniu', 'img'),
    backgroundImgPath: path.join(YunzaiPath, 'resources', 'GuGuNiu-Gallery', 'html', 'img'),
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
      // 配置和 HTML 模板也从仓库同步，但如果本地已存在则不覆盖
      { sourceSubPath: 'GuGuNiu-Gallery/GalleryConfig.yaml', destFileName: 'GalleryConfig.yaml', copyIfExists: false },
      { sourceSubPath: 'GuGuNiu-Gallery/html/status.html', destFileName: 'html/status.html', copyIfExists: true },
      { sourceSubPath: 'GuGuNiu-Gallery/html/banlist.html', destFileName: 'html/banlist.html', copyIfExists: true },
      {
        sourceSubPath: 'GuGuNiu-Gallery/html/speedtest.html',
        destFileName: 'html/speedtest.html',
        copyIfExists: true,
      },
    ],
    // 需要同步到特定插件目录的文件列表
    filesToSyncSpecific: [
      {
        sourceSubPath: '咕咕牛图库管理器.js',
        destDir: path.join(YunzaiPath, 'plugins', 'example'),
        destFileName: '咕咕牛图库管理器.js',
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
      name: '『咕咕牛🐂』图库管理器 v4.8.4',
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
   * 
   *              已知无法解决的问题：函数执行顺序和异步操作完成时机共同作用下的时序问题，多实例的存在
   * 
   *              ============================================================================
   *              ============================================================================
   *   
   *              异步初始化: InitializePlugin 包含文件读写、网络请求等异步操作，它的完成时间是不确定的。
   *              多实例创建: Yunzai 可能在全局初始化完成之前就创建了第二个甚至更多的实例。
   *              状态不同步:
   *                        全局状态 (isGloballyInitialized) 由第一次初始化异步更新。
   *                        实例状态 (this.isPluginInited) 在每个实例的 _initializeInstance 中尝试与全局状态同步，但这个同步本身也受 await initializationPromise 的时序影响。
   *                        当一个命令恰好由一个“醒来稍晚”（即它的 await 刚结束，但还没执行完 _initializeInstance 剩余部分）的实例处理时，
   *                        它的 this.isPluginInited 可能还是 false，但全局的 MiaoPluginMBT.isGloballyInitialized 可能已经是 true 了。
  */
  async CheckInit(e) {
    // 检查是否是首次加载且未开始初始化
    if (!MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 首次触发，开始初始化...`)
      await this._initializeInstance() // 等待实例自身的初始化尝试完成
    }
    // 检查是否全局初始化正在进行中
    else if (MiaoPluginMBT.initializationPromise && !MiaoPluginMBT.isGloballyInitialized) {
      this.logger.info(`${this.logPrefix} [核心检查] 初始化进行中，等待...`)
      try {
        await MiaoPluginMBT.initializationPromise // 等待全局初始化完成
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized // 根据全局结果更新实例状态
      } catch (error) {
        // 等待过程中全局初始化失败
        this.logger.error(`${this.logPrefix} [核心检查] 等待初始化时捕获到错误:`, error.message || error)
        this.isPluginInited = false // 明确标记实例初始化失败
      }
    }
    // 如果不是首次加载，也不是正在进行中，说明全局初始化已完成或已失败
    else {
      // 直接用全局状态更新实例状态
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized
    }

    // 统一检查最终的实例初始化状态
    if (!this.isPluginInited) {
      await e.reply(`${this.logPrefix} 插件初始化失败或仍在进行中，请稍后再试。`, true)
      return false // 初始化未成功，阻止命令执行
    }

    // 确认初始化成功后，再检查核心数据是否有效加载
    let coreDataValid = true
    if (!MiaoPluginMBT.MBTConfig || Object.keys(MiaoPluginMBT.MBTConfig).length === 0) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 配置丢失！`)
      coreDataValid = false
    }
    if (!Array.isArray(MiaoPluginMBT.#imgDataCache)) {
      // 检查数组类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 元数据缓存无效！`)
      coreDataValid = false
    }
    if (!(MiaoPluginMBT.#userBanSet instanceof Set)) {
      // 检查 Set 类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 用户封禁列表无效！`)
      coreDataValid = false
    }
    if (!(MiaoPluginMBT.#activeBanSet instanceof Set)) {
      // 检查 Set 类型
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 生效封禁列表无效！`)
      coreDataValid = false
    }
    if (!MiaoPluginMBT.#aliasData) {
      // 检查是否为 null/undefined
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 别名数据丢失！`)
      coreDataValid = false
    }

    // 如果核心数据无效，阻止命令执行
    if (!coreDataValid) {
      await e.reply(`${this.logPrefix} 内部状态错误，核心数据加载失败，请重启 Bot。`, true)
      return false
    }

    // 警告：元数据为空（非阻塞）
    if (MiaoPluginMBT.#imgDataCache.length === 0) {
      this.logger.warn(`${this.logPrefix} [核心检查] 注意：图片元数据为空，部分功能可能受限。`)
    }

    return true
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
    if (!(await this.CheckInit(e))) return true
    if (this.isGitRunning) return logger.info(`${this.logPrefix} Git 操作进行中，请稍后再试...`)

    let finalUserMessage = '';
    this.isGitRunning = true
    const startTime = Date.now()
    let overallSuccess = false
    // 初始化结果对象，确保有默认值
    let repo1Result = { repo: 1, success: false, nodeName: '未执行', error: null }
    let repo2Result = { repo: 2, success: true, nodeName: '未处理', error: null } // Repo2 默认成功，除非需要下载且失败

    try {
      const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1)
      const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
      let Repo2Exists = Repo2UrlConfigured ? await MiaoPluginMBT.IsTuKuDownloaded(2) : false // 检查初始状态

      // 如果仓库都已存在，直接返回
      if (Repo1Exists && (!Repo2UrlConfigured || Repo2Exists)) {
        this.isGitRunning = false
        return e.reply(`${this.logPrefix} 图库已经下载好了，不用重复下载啦。`)
      }
      // 处理异常状态
      if (!Repo1Exists && Repo2Exists) {
        this.isGitRunning = false
        await e.reply(`${this.logPrefix} 状态有点怪！二号仓库在，一号仓库却没了？建议先 #重置咕咕牛`)
        return true
      }

      // 准备并行下载
      const downloadPromises = []
      let repo2NeedsDownload = false // 标记副仓库是否需要下载

      // 添加仓库1的下载任务
      if (!Repo1Exists) {
        this.logger.info(`${this.logPrefix} [并行下载] 添加一号仓库下载任务。`)
        downloadPromises.push(
          MiaoPluginMBT.DownloadRepoWithFallback(
            1,
            Default_Config.Main_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
            MiaoPluginMBT.paths.LocalTuKuPath,
            e, // 传递 e 用于报告进度
            this.logger
          )
            .then(result => ({ repo: 1, ...result })) // 包装结果
            .catch(err => {
              // 捕获 downloadRepoWithFallback 可能抛出的未处理错误
              this.logger.error(`${this.logPrefix} [并行下载] 一号仓库下载 Promise 捕获到错误:`, err)
              return { repo: 1, success: false, nodeName: '执行异常', error: err }
            })
        )
      } else {
        this.logger.info(`${this.logPrefix} [并行下载] 一号仓库已存在，跳过。`)
        downloadPromises.push(Promise.resolve({ repo: 1, success: true, nodeName: '本地' }))
      }

      // 添加仓库2的下载任务
      if (Repo2UrlConfigured && !Repo2Exists) {
        repo2NeedsDownload = true // 标记需要下载
        this.logger.info(`${this.logPrefix} [并行下载] 添加二号仓库下载任务。`)
        downloadPromises.push(
          MiaoPluginMBT.DownloadRepoWithFallback(
            2,
            MiaoPluginMBT.MBTConfig.Ass_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch || Default_Config.SepositoryBranch,
            MiaoPluginMBT.paths.LocalTuKuPath2,
            null, // 仓库2不报告进度给用户
            this.logger
          )
            .then(result => ({ repo: 2, ...result }))
            .catch(err => {
              this.logger.error(`${this.logPrefix} [并行下载] 二号仓库下载 Promise 捕获到错误:`, err)
              return { repo: 2, success: false, nodeName: '执行异常', error: err }
            })
        )
      } else if (Repo2UrlConfigured && Repo2Exists) {
        this.logger.info(`${this.logPrefix} [并行下载] 二号仓库已存在，跳过。`)
        downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '本地' }))
      } else {
        this.logger.info(`${this.logPrefix} [并行下载] 二号仓库未配置，跳过。`)
        downloadPromises.push(Promise.resolve({ repo: 2, success: true, nodeName: '未配置' }))
      }

      // 等待所有下载任务完成 (无论成功或失败)
      const results = await Promise.allSettled(downloadPromises)
      this.logger.info(`${this.logPrefix} [并行下载] 所有下载任务已完成 (settled)。`)

      // 处理结果
      const repo1RawResult = results[0]
      const repo2RawResult = results[1]

      if (repo1RawResult.status === 'fulfilled') {
        repo1Result = repo1RawResult.value
      } else {
        repo1Result = { repo: 1, success: false, nodeName: '执行异常', error: repo1RawResult.reason }
        this.logger.error(`${this.logPrefix} [并行下载] 一号仓库 Promise rejected:`, repo1RawResult.reason)
      }

      // 需要在后续逻辑中再次检查 Repo2 是否真的下载成功
      if (repo2RawResult.status === 'fulfilled') {
        repo2Result = repo2RawResult.value
        // 如果是新下载的，更新 Repo2Exists 状态
        if (repo2NeedsDownload && repo2Result.success) {
          Repo2Exists = true
        }
      } else {
        repo2Result = { repo: 2, success: false, nodeName: '执行异常', error: repo2RawResult.reason }
        this.logger.error(`${this.logPrefix} [并行下载] 二号仓库 Promise rejected:`, repo2RawResult.reason)
        Repo2Exists = false // 下载失败，状态仍为不存在
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      this.logger.info(`${this.logPrefix} [并行下载] 流程结束，耗时 ${duration} 秒。`)
      this.logger.info(
        `${this.logPrefix} [并行下载] 结果 - Repo 1: ${repo1Result.success ? '成功' : '失败'} (${
          repo1Result.nodeName
        }), Repo 2: ${repo2Result.success ? '成功' : '失败'} (${repo2Result.nodeName})`
      )

      overallSuccess = repo1Result.success //整体成功与否仅取决于主仓库

      if (overallSuccess) {
        // 主仓库下载成功
        let repoStatusMessage = `『咕咕牛』\n✅ 一号仓库下载成功 (${repo1Result.nodeName})。`
        if (Repo2UrlConfigured) {
          // 如果配置了副仓库
          if (repo2Result.success) {
            // 副仓库也成功或无需下载
            repoStatusMessage += `\n✅ 二号仓库状态: ${
              repo2Result.nodeName === '本地'
                ? '已存在'
                : repo2Result.nodeName === '未配置'
                ? '未配置'
                : '下载成功 (' + repo2Result.nodeName + ')'
            }。`
          } else {
            // 副仓库下载失败
            repoStatusMessage += `\n⚠️ 二号仓库下载失败 (${repo2Result.nodeName})。`
            this.logger.error(`${this.logPrefix} [并行下载] 二号仓库下载失败详情:`, repo2Result.error)
            // 是否需要报告副仓库的错误给用户
            // await this.ReportError(e, '下载副仓库', repo2Result.error);
          }
        }
        await e.reply(repoStatusMessage).catch(() => {}) // 报告仓库状态

        this.logger.info(`${this.logPrefix} [并行下载] 执行下载后设置...`)
        await MiaoPluginMBT.RunPostDownloadSetup(e, this.logger)
        this.logger.info(`${this.logPrefix} [并行下载] 下载后处理完成。`)

        // 尝试获取并展示初始日志 (如果副仓库是新下载的)
        let logMessages = []
        const gitLog1 = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)
        if (gitLog1) logMessages.push(`--- 一号仓库初始提交 ---\n${gitLog1}`)

        // 只有当副仓库是这次新下载且成功时才获取其日志
        if (repo2NeedsDownload && repo2Result.success) {
          const gitLog2 = await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath2, this.logger)
          if (gitLog2) logMessages.push(`--- 二号仓库初始提交 ---\n${gitLog2}`)
        }

        // 如果有日志，发送合并转发
        if (logMessages.length > 0) {
          try {
            const forwardMsg = await common.makeForwardMsg(e, logMessages, '仓库初始日志')
            if (forwardMsg) await e.reply(forwardMsg)
          } catch (fwdErr) {
            this.logger.warn(`${this.logPrefix} 发送初始日志失败:`, fwdErr)
          }
        }

        await e.reply('『咕咕牛』成功进入喵喵里面！').catch(() => {})
      } else {
        // 主仓库下载失败
        finalUserMessage = `『咕咕牛』核心仓库下载失败 (${repo1Result.nodeName})。请检查日志或网络后重试。`
        // 如果 repo1Result.error 存在，考虑报告更详细的错误
        if (repo1Result.error) {
          await this.ReportError(e, '下载核心仓库', repo1Result.error)
        } else {
          await e.reply(finalUserMessage).catch(() => {})
        }
      }
    } catch (error) {
      // 顶层 try-catch，捕获并行逻辑本身或其他意外错误
      this.logger.error(`${this.logPrefix} [DownloadTuKu] 顶层执行出错:`, error)
      await this.ReportError(e, '下载图库顶层', error)
      overallSuccess = false
    } finally {
      this.isGitRunning = false // 确保标志被重置
      // this.logger.info(`${this.logPrefix} [并行下载] isGitRunning 标志已重置为 false。`); // 调试用
    }
    return true
  }

  /**
   * @description 处理 #更新咕咕牛 命令，执行双仓库更新流程。
   *              更新成功后，如果副仓库有更新，也获取并展示其日志。
   */
  async UpdateTuKu(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false
    if (this.isGitRunning) {
      if (!isScheduled && e) await e.reply(`${this.logPrefix} Git 操作进行中...`)
      return false
    }

    // 检查仓库是否存在
    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1)
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL
    const Repo2Exists = Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2))

    if (!Repo1Exists && (!Repo2UrlConfigured || !Repo2Exists)) {
      if (!isScheduled && e) await e.reply('『咕咕牛🐂』图库还没下载呢，先 `#下载咕咕牛` 吧。', true)
      return false
    }
    // 处理仓库状态不一致的情况
    if (Repo1Exists && Repo2UrlConfigured && !Repo2Exists) {
      if (!isScheduled && e)
        await e.reply('『咕咕牛🐂』一号仓库在，但二号仓库不见了。建议先 `#重置咕咕牛` 再重新下载。', true)
      return false
    }
    if (!Repo1Exists && Repo2Exists) {
      if (!isScheduled && e)
        await e.reply('『咕咕牛🐂』状态有点怪！二号仓库在，一号仓库没了？建议先 `#重置咕咕牛`。', true)
      return false
    }

    this.isGitRunning = true
    const startTime = Date.now()
    if (!isScheduled && e) await e.reply('『咕咕牛🐂』开始检查更新，稍等片刻...', true)
    this.logger.info(`${this.logPrefix} [更新流程] 开始 @ ${new Date(startTime).toISOString()}`)

    let Repo1Updated = false,
      Repo2Updated = false
    let Repo1Success = true,
      Repo2Success = true
    let overallHasChanges = false
    let finalUserMessage = ''
    let gitLogRepo1 = '',
      gitLogRepo2 = '' // 分别记录日志

    try {
      // 更新主仓库 (如果存在)
      if (Repo1Exists) {
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
        if (!Repo1Success && !isScheduled) finalUserMessage = '一号仓库更新失败了...'
        else if (Repo1Success) {
          // 无论是否有更新，都记录日志
          gitLogRepo1 = result1.log || ''
          if (Repo1Updated) this.logger.info(`${this.logPrefix} 一号仓库更新了内容。`)
          else this.logger.info(`${this.logPrefix} 一号仓库已经是最新版本。`)
        }
      } else {
        Repo1Success = false // 主仓库不存在，更新自然失败
      }

      // 更新副仓库 (如果配置且存在，并且主仓库更新成功)
      if (Repo1Success && Repo2UrlConfigured && Repo2Exists) {
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
        if (!Repo2Success && !isScheduled && !finalUserMessage) finalUserMessage = '二号仓库更新失败了...'
        else if (Repo2Success) {
          // 无论是否有更新，都记录日志
          gitLogRepo2 = result2.log || ''
          if (Repo2Updated) this.logger.info(`${this.logPrefix} 二号仓库更新了内容。`)
          else this.logger.info(`${this.logPrefix} 二号仓库已经是最新版本。`)
        }
      } else if (Repo2UrlConfigured && !Repo2Exists) {
        // 副仓库配置了但不存在，不需要更新，也不算失败
        this.logger.info(`${this.logPrefix} 二号仓库未下载，跳过更新。`)
      } else if (!Repo2UrlConfigured) {
        // 副仓库未配置，自然成功
        Repo2Success = true
      }

      overallHasChanges = Repo1Updated || Repo2Updated // 任意一个仓库有更新就算有变化
      const overallSuccess = Repo1Success && Repo2Success // 必须所有需要更新的仓库都成功才算成功

      if (overallSuccess) {
        if (overallHasChanges) {
          // 有更新，执行后处理
          if (!isScheduled && e) await e.reply(`${this.logPrefix} 检测到更新，正在应用变更...`)
          await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, this.logger)

          if (!isScheduled && e) {
            // 手动更新成功，回复用户
            if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新成功啦！'

            //准备合并转发的日志消息
            let logMessages = []
            if (gitLogRepo1) logMessages.push(`--- 一号仓库最新记录 ---\n${gitLogRepo1}`)
            //只有在副仓库实际更新了内容时，才显示其日志
            if (gitLogRepo2 && Repo2Updated) logMessages.push(`--- 二号仓库更新记录 ---\n${gitLogRepo2}`)

            if (logMessages.length > 0) {
              try {
                const forwardMsg = await common.makeForwardMsg(e, logMessages, '『咕咕牛』更新详情')
                if (forwardMsg) await e.reply(forwardMsg)
                else await e.reply(finalUserMessage + ' (日志发送失败)')
              } catch (fwdErr) {
                this.logger.error(`${this.logPrefix} 创建更新日志转发消息失败:`, fwdErr)
                await e.reply(finalUserMessage + ' (日志发送失败)')
              }
            } else {
              // 如果都没日志（理论上因为 hasChanges 为 true 不会到这里）
              await e.reply(finalUserMessage)
            }
          } else if (isScheduled && overallHasChanges) {
            // 定时任务有更新，通知主人
            this.logger.info(`${this.logPrefix} [定时] 检测到更新，准备通知主人...`)
            // 定时通知通常只需要主仓库的最新状态即可
            const latestLogCombined =
              gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger))
            await this.NotifyMasterUpdateSuccess(latestLogCombined)
          }
        } else {
          // 没有更新
          this.logger.info(`${this.logPrefix} 所有仓库均已是最新版本。`)
          if (!isScheduled && e) {
            finalUserMessage = '『咕咕牛』已经是最新版本啦，不用更新了~'
            await e.reply(finalUserMessage)
            // 显示一下最新的提交信息 (主仓库的)
            const latestLog =
              gitLogRepo1 || (await MiaoPluginMBT.GetTuKuLog(1, MiaoPluginMBT.paths.LocalTuKuPath, this.logger))
            if (latestLog) await e.reply(`最新提交：${latestLog}`)
          } else if (isScheduled) {
            this.logger.info(`${this.logPrefix} [定时] 无更新内容。`)
          }
        }
      } else {
        // 更新过程失败
        this.logger.error(`${this.logPrefix} 更新过程出错。`)
        if (!isScheduled && e) {
          if (!finalUserMessage) finalUserMessage = '『咕咕牛』更新过程中出错了，快去看看日志！'
          if (Repo1Success && !Repo2Success) {
            // 调用 ReportError 报告 repo2 的错误 ，暂时不用
            // const repo2Error = ... // 需要从 UpdateSingleRepo 获取错误对象
            // await this.ReportError(e, '更新副仓库', repo2Error);
          }
          await e.reply(finalUserMessage)
        }
        overallHasChanges = false // 失败了就不算有变化
      }
    } catch (error) {
      // 捕获顶层异常
      this.logger.error(`${this.logPrefix} 更新流程发生严重异常:`, error)
      if (!isScheduled && e) await this.ReportError(e, '更新图库', error)
      else if (isScheduled) this.logger.error(`${this.logPrefix} [定时] 执行更新时发生严重错误:`, error)
      overallHasChanges = false
    } finally {
      this.isGitRunning = false // 保证标志被重置
      const duration = ((Date.now() - startTime) / 1000).toFixed(1)
      this.logger.info(`${this.logPrefix} 更新流程结束，耗时 ${duration} 秒。`)
    }
    return overallHasChanges
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

    let tempHtmlFilePath = ''
    let tempImgFilePath = ''

    try {
      // 准备渲染数据结构
      const pluginVersion = MiaoPluginMBT.GetVersionStatic() // 获取插件版本
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
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();


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

      this.logger.info(`${this.logPrefix} [检查状态] 开始调用 Puppeteer 生成状态报告截图...`)
      const img = await puppeteer.screenshot('guguniu-status', {
        tplFile: tempHtmlFilePath, 
        savePath: tempImgFilePath,
        imgType: 'png',
        pageGotoParams: { waitUntil: 'networkidle0' }, 
        ...renderData, 
        scaleStyleValue: scaleStyleValue,
        screenshotOptions: { fullPage: false }, 
        pageBoundingRect: { selector: '.container', padding: 0 }, 
        width: 540, 
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
   *              【V4.8.3 v4】修复状态未变时仍发送文字的问题。
   */
  async ManageTuKuOption(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${this.logPrefix} 只有主人才能开关图库啦~`);

    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i);
    if (!match) return false;

    const action = match[1];
    const enable = action === '启用';
    let configChanged = false;
    let asyncError = null;
    let saveWarning = '';

    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger);
    const currentStatus = MiaoPluginMBT.MBTConfig.TuKuOP ?? Default_Config.defaultTuKuOp;

    if (currentStatus === enable) {
      // 优先尝试显示面板 
      try {
        await this.ShowSettingsPanel(e);
        // 如果面板显示成功，就不需要再发文字了
      } catch (panelError) {
        this.logger.error(`${this.logPrefix} [${action}咕咕牛] 显示当前状态面板失败，发送文本回退:`, panelError);
        await e.reply(`${this.logPrefix} 图库已经是「${action}」状态了，无需更改。`, true);
      }
      return true; 
    }

    //await e.reply(`${this.logPrefix} 正在处理「${action}咕咕牛」请求，请稍候...`, true); 

    configChanged = true;
    MiaoPluginMBT.MBTConfig.TuKuOP = enable;
    this.logger.info(`${this.logPrefix} 图库开关状态变更为 -> ${enable}`);

    try {
      this.logger.info(`${this.logPrefix} [${action}咕咕牛] 开始执行后台操作...`);
      if (enable) {
        await MiaoPluginMBT.SyncCharacterFolders(this.logger);
        await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, this.logger);
      } else {
        await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.miaoChar, this.logger);
        await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.zzzChar, this.logger);
        await MiaoPluginMBT.CleanTargetCharacterDirs(MiaoPluginMBT.paths.target.wavesChar, this.logger);
      }
      this.logger.info(`${this.logPrefix} [${action}咕咕牛] 后台操作完成。`);
    } catch (error) {
      asyncError = error;
      this.logger.error(`${this.logPrefix} [${action}咕咕牛] 后台操作失败:`, error);
    }

    if (configChanged) {
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger);
      if (!saveSuccess) {
        saveWarning = '⚠️ 配置保存失败！设置可能不会持久生效。';
      }
    }

    let panelSent = false;
    try {
      let extraPanelMsg = '';
      if (asyncError) extraPanelMsg += `\n(后台${action === '启用' ? '同步' : '清理'}时遇到问题)`;
      if (saveWarning) extraPanelMsg += `\n${saveWarning}`;
      await this.ShowSettingsPanel(e, extraPanelMsg.trim());
      panelSent = true;
    } catch (panelError) {
      this.logger.error(`${this.logPrefix} [${action}咕咕牛] 显示设置面板失败，将发送文本回退:`, panelError);
      panelSent = false;
    }

    if (!panelSent) {
      let finalUserMessage = `${this.logPrefix} 图库已设为「${action}」。`;
      if (asyncError) finalUserMessage += `\n(但后台${enable ? '同步' : '清理'}时遇到问题，详见日志)`;
      if (saveWarning) finalUserMessage += `\n${saveWarning}`;
      await e.reply(finalUserMessage, true);
    }

    return true;
  }

  
  /**
   * @description 处理 #咕咕牛 命令，显示插件版本、安装时间和系统信息。
   *
   */
  async PluginInfo(e) {
    if (!(await this.CheckInit(e))) return true

    const version = this.GetVersion() // 获取版本号
    await e.reply(`🐂 ${this.logPrefix} ${version} 正在运行中...`)

    // 获取仓库安装时间
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
          installTimeRepo2 = '已下载 (无法获取时间)'
        }
      } catch {}
    }
    await e.reply(`> 一号仓库安装时间: ${installTimeRepo1}\n> 二号仓库状态: ${installTimeRepo2}`)

    // 获取并发送日志
    let logMessages = [] // 用于存储日志消息

    // 获取一号仓库日志
    if (Repo1Exists) {
      const gitLog1 = await MiaoPluginMBT.GetTuKuLog(50, MiaoPluginMBT.paths.LocalTuKuPath, this.logger)
      if (gitLog1) {
        logMessages.push(`--- 一号仓库最近 50 条更新记录 ---\n${gitLog1}`)
      } else {
        logMessages.push('--- 无法获取一号仓库日志 ---')
      }
    } else {
      logMessages.push('--- 一号仓库未下载 ---')
    }

    // 检查并获取二号仓库日志
    if (Repo2Exists) {
      // 只有在二号仓库确实存在时才获取
      const gitLog2 = await MiaoPluginMBT.GetTuKuLog(50, MiaoPluginMBT.paths.LocalTuKuPath2, this.logger) 
      if (gitLog2) {
        logMessages.push(`--- 二号仓库最近 50 条更新记录 ---\n${gitLog2}`)
      } else {
        logMessages.push('--- 无法获取二号仓库日志 ---')
      }
    } else if (Repo2UrlConfigured) {
      logMessages.push('--- 二号仓库已配置但未下载 ---') // 如果配置了但未下载，也说明一下
    }
    // 如果二号仓库未配置，则不显示相关信息

    // 发送合并转发消息
    if (logMessages.length > 0) {
      try {
        const forwardMsg = await common.makeForwardMsg(e, logMessages, '『咕咕牛🐂』仓库日志') // 统一标题
        if (forwardMsg) await e.reply(forwardMsg)
        else await e.reply('生成仓库日志消息失败。')
      } catch (fwdErr) {
        this.logger.error(`${this.logPrefix} 创建日志转发消息失败:`, fwdErr)
        await e.reply('发送仓库日志时出错。')
      }
    }

    // 获取并发送系统信息
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
      } catch {
        /* 读取失败就算了 */
      }

      systemInfo = [
        `--- 运行环境 ---`,
        `系统: ${platform}`,
        `Node.js: ${nodeVersion}`,
        `Yunzai-Bot: ${yunzaiVersion}`,
        `咕咕牛插件: ${version}`,
        `内存占用: ${usedMB} MB`,
      ].join('\n')
    } catch (sysErr) {
      this.logger.warn(`${this.logPrefix} 获取系统信息失败:`, sysErr)
      systemInfo = '获取系统信息失败了...'
    }
    await e.reply(systemInfo)

    return true
  }

  /**
   * @description 处理 #设置咕咕牛净化等级 命令。
   *              【V4.8.3 v4】修复状态未变时仍发送文字的问题。
   */
  async SetPurificationLevel(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply(`${this.logPrefix} 只有主人才能设置净化等级哦~`);

    const match = e.msg.match(/^(?:#设置咕咕牛净化等级|#设定净化)\s*([012])$/i);
    if (!match?.[1]) return e.reply('格式不对哦，请用: #设置咕咕牛净化等级 [0/1/2]', true);

    const level = parseInt(match[1], 10);
    if (isNaN(level) || !Purify_Level.getDescription(level))
      return e.reply(`无效的净化等级: ${level}，只能是 0, 1, 或 2。`, true);

    await MiaoPluginMBT.LoadTuKuConfig(true, this.logger);
    const currentLevel = MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl;

    if (level === currentLevel) {
       // 优先尝试显示面板
       try {
           await this.ShowSettingsPanel(e);
       } catch (panelError) {
           this.logger.error(`${this.logPrefix} [净化设置] 显示当前状态面板失败，发送文本回退:`, panelError);
           // 面板失败时发送文本 
           await e.reply(`${this.logPrefix} 净化等级已经是 ${level} (${Purify_Level.getDescription(level)}) 啦。`, true);
       }
       return true;
    }

    //await e.reply(`${this.logPrefix} 正在设置净化等级为 ${level} 并应用更改，请稍候...`, true); // 保留这个简单的处理中提示

    MiaoPluginMBT.MBTConfig.PFL = level;
    this.logger.info(`${this.logPrefix} 净化等级设置为 -> ${level} (${Purify_Level.getDescription(level)})`);

    const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(MiaoPluginMBT.MBTConfig, this.logger);
    let saveWarning = '';
    if (!saveSuccess) {
        saveWarning = '⚠️ 但是配置保存失败了！设置可能不会持久生效。';
    }

    setImmediate(async () => {
      const logger = this.logger;
      const logPrefix = this.logPrefix;
      let asyncError = null;
      try {
        logger.info(`${logPrefix} [净化设置] 后台开始应用新的净化等级 ${level}...`);
        await MiaoPluginMBT.GenerateAndApplyBanList(MiaoPluginMBT.#imgDataCache, logger);
        logger.info(`${logPrefix} [净化设置] 新的生效封禁列表已应用。`);
        if (MiaoPluginMBT.MBTConfig.TuKuOP) {
            logger.info(`${logPrefix} [净化设置] 图库已启用，开始重新同步角色文件夹...`);
            await MiaoPluginMBT.SyncCharacterFolders(logger);
            logger.info(`${logPrefix} [净化设置] 角色文件夹重新同步完成。`);
        } else {
             logger.info(`${logPrefix} [净化设置] 图库已禁用，跳过角色文件夹同步。`);
        }
      } catch (applyError) {
        logger.error(`${logPrefix} [净化设置] 后台应用或同步时出错:`, applyError);
        asyncError = applyError;
      } finally {
          let panelSent = false;
          try {
              let extraPanelMsg = '';
              if (asyncError) extraPanelMsg += `\n(后台应用时遇到问题)`;
              if (saveWarning) extraPanelMsg += `\n${saveWarning}`;
              await this.ShowSettingsPanel(e, extraPanelMsg.trim());
              panelSent = true;
          } catch (panelError) {
              logger.error(`${logPrefix} [净化设置] 显示设置面板失败，将发送文本回退:`, panelError);
              panelSent = false;
          }

          if (!panelSent) {
              let finalUserMessage = `${this.logPrefix} 净化等级已设为 ${level} (${Purify_Level.getDescription(level)})。`;
              if (level === Purify_Level.PX18_PLUS) finalUserMessage += '\n(Px18 指轻微性暗示或低度挑逗性图片)';
              if (saveWarning) finalUserMessage += `\n${saveWarning}`;
              if (asyncError) finalUserMessage += '\n(后台应用时出错，详见日志)';
              await e.reply(finalUserMessage, true);
          }
      }
    });


    return true; 
  }

  /**
   * @description 处理封禁相关命令 (#咕咕牛封禁, #咕咕牛解禁, #ban列表)。
   */
  async ManageUserBans(e) {
    if (!(await this.CheckInit(e))) return true
    const msg = e.msg.trim()
    const isMaster = e.isMaster
    const logPrefix = this.logPrefix;
    const logger = this.logger;

    // 权限检查：封禁/解禁操作仅限主人
    if ((msg.startsWith('#咕咕牛封禁 ') || msg.startsWith('#咕咕牛解禁 ')) && !isMaster)
      return e.reply(`${logPrefix} 只有主人才能进行封禁或解禁操作哦~`)

    // --- 处理 #ban列表 或 #咕咕牛封禁列表 ---
    if (msg === '#ban列表' || msg === '#咕咕牛封禁列表') {
      const activeBanCount = MiaoPluginMBT.#activeBanSet.size
      const userBanCount = MiaoPluginMBT.#userBanSet.size
      const currentPFL = MiaoPluginMBT.MBTConfig?.PFL ?? Purify_Level.NONE; // 获取当前净化等级

      if (activeBanCount === 0) {
        return e.reply('当前没有任何图片被封禁。', true)
      }

      await e.reply(`正在整理列表，可能需要一点时间...`, true)

      const purifiedBansData = [] // 存放净化屏蔽的图片信息
      const userBansData = [] // 存放手动封禁的图片信息
      const pluginVersion = MiaoPluginMBT.GetVersionStatic()

      // 遍历当前生效的封禁列表，区分手动和净化
      const sortedActiveBans = Array.from(MiaoPluginMBT.#activeBanSet).sort()
      await Promise.all(
        sortedActiveBans.map(async relativePath => {
          const fileName = path.basename(relativePath)
          const fileNameNoExt = fileName.replace(/\.webp$/i, '') // 去掉后缀
          // 尝试获取本地路径用于缩略图
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath)
          const thumbnailPath = absolutePath ? `file://${absolutePath.replace(/\\/g, '/')}` : '' // 确保是 file:// URI 且用 /
          const itemData = { fileNameNoExt, thumbnailPath } // 存储文件名和缩略图路径

          // 判断是手动封禁还是净化屏蔽
          if (MiaoPluginMBT.#userBanSet.has(relativePath)) {
            userBansData.push(itemData)
          } else {
            purifiedBansData.push(itemData)
          }
        })
      )

      let manualSent = false; // 标记手动列表是否已发送
      const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'banlist.html');
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      // 1. 处理并发送手动封禁列表 (如果存在)
      if (userBansData.length > 0) {
        logger.info(`${logPrefix} [封禁列表] 准备生成手动列表图片 (${userBansData.length}项)...`)
        let tempHtmlFilePathManual = '';
        let tempImgFilePathManual = '';
        try {
          const renderDataManual = {
            pluginVersion: pluginVersion,
            purifiedBans: [], // 手动列表不显示净化内容
            userBans: userBansData,
            listType: '手动封禁',
            scaleStyleValue: scaleStyleValue, // 传递缩放值
            // 批次信息对单张图无意义，可以不传或传默认值
            batchInfo: ''
          };

          await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
          await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
          const timestampManual = Date.now();
          tempHtmlFilePathManual = path.join(MiaoPluginMBT.paths.tempHtmlPath, `banlist-manual-${timestampManual}.html`);
          tempImgFilePathManual = path.join(MiaoPluginMBT.paths.tempImgPath, `banlist-manual-${timestampManual}.png`);

          await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePathManual); // 复制模板
          const img = await puppeteer.screenshot('guguniu-banlist-manual', {
            tplFile: tempHtmlFilePathManual,
            savePath: tempImgFilePathManual,
            imgType: 'png',
            pageGotoParams: { waitUntil: 'networkidle0' },
            ...renderDataManual, // 传递渲染数据
            screenshotOptions: { fullPage: true },
            width: 640,
          });
          if (img) {
            await e.reply(img);
            manualSent = true;
            logger.info(`${logPrefix} [封禁列表] 手动封禁列表图片已发送。`);
            // 如果后面可能有净化列表，稍微等一下
            if (currentPFL > Purify_Level.NONE && purifiedBansData.length > 0) {
                await common.sleep(1000); // 增加延迟到1秒
            }
          } else {
            logger.error(`${logPrefix} [封禁列表] 生成手动列表截图失败。`);
          }
        } catch (renderError) {
          logger.error(`${logPrefix} [封禁列表] 生成手动列表截图时出错:`, renderError);
        } finally {
          // 清理手动列表的临时文件
          if (tempHtmlFilePathManual && fs.existsSync(tempHtmlFilePathManual)) {
            try { await fsPromises.unlink(tempHtmlFilePathManual); } catch (unlinkErr) {}
          }
          if (tempImgFilePathManual && fs.existsSync(tempImgFilePathManual)) {
            try { await fsPromises.unlink(tempImgFilePathManual); } catch (unlinkErr) {}
          }
        }
      } else {
         logger.info(`${logPrefix} [封禁列表] 无手动封禁项。`);
      }

      // 2. 处理并发送净化屏蔽列表 (如果 PFL > 0 且存在净化项)
      if (currentPFL > Purify_Level.NONE && purifiedBansData.length > 0) {
        logger.info(`${logPrefix} [封禁列表] 检测到净化等级 ${currentPFL} 且有 ${purifiedBansData.length} 项净化屏蔽，开始分批处理...`);

        const ITEMS_PER_BATCH = 28; // 每批数量
        const totalItemsPurified = purifiedBansData.length;
        const totalBatchesPurified = Math.ceil(totalItemsPurified / ITEMS_PER_BATCH);
        const forwardListPurified = []; // 存储用于合并转发的消息段

        // 添加合并转发的标题
        const forwardTitle = `[净化屏蔽 (等级${currentPFL}, 共 ${totalItemsPurified} 项)]`;
        forwardListPurified.push([forwardTitle]);

        for (let batchNum = 1; batchNum <= totalBatchesPurified; batchNum++) {
          const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
          const endIndex = Math.min(startIndex + ITEMS_PER_BATCH, totalItemsPurified);
          const currentBatchData = purifiedBansData.slice(startIndex, endIndex);

          logger.info(`${logPrefix} [封禁列表] 准备生成净化列表第 ${batchNum}/${totalBatchesPurified} 批 (${currentBatchData.length} 项)...`);

          let tempHtmlFilePathPurified = '';
          let tempImgFilePathPurified = '';
          const timestampPurified = `${Date.now()}-batch${batchNum}`;

          try {
            const renderDataPurifiedBatch = {
              pluginVersion: pluginVersion,
              purifiedBans: currentBatchData, // 当前批次的净化数据
              userBans: [], // 净化列表不显示手动内容
              listType: '净化屏蔽',
              scaleStyleValue: scaleStyleValue, // 传递缩放值
              batchInfo: `(第 ${batchNum} / ${totalBatchesPurified} 批)` // 传递批次信息给模板页脚
            };

            await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
            await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
            tempHtmlFilePathPurified = path.join(MiaoPluginMBT.paths.tempHtmlPath, `banlist-purified-${timestampPurified}.html`);
            tempImgFilePathPurified = path.join(MiaoPluginMBT.paths.tempImgPath, `banlist-purified-${timestampPurified}.png`);

            await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePathPurified); // 复制模板

            const imgBatch = await puppeteer.screenshot(`guguniu-banlist-purified-batch${batchNum}`, {
              tplFile: tempHtmlFilePathPurified,
              savePath: tempImgFilePathPurified,
              imgType: 'png',
              pageGotoParams: { waitUntil: 'networkidle0' },
              ...renderDataPurifiedBatch, // 传递当前批次数据
              screenshotOptions: { fullPage: true },
              width: 640,
            });

            if (imgBatch) {
              forwardListPurified.push(imgBatch); // 将图片 segment 添加到待合并列表
              logger.info(`${logPrefix} [封禁列表] 净化列表第 ${batchNum}/${totalBatchesPurified} 批图片生成成功。`);
            } else {
              logger.error(`${logPrefix} [封禁列表] 生成净化列表第 ${batchNum}/${totalBatchesPurified} 批截图失败。`);
              forwardListPurified.push(`[❌ 第 ${batchNum}/${totalBatchesPurified} 批渲染失败]`); // 添加错误占位符
            }
          } catch (renderBatchError) {
            logger.error(`${logPrefix} [封禁列表] 生成净化列表第 ${batchNum}/${totalBatchesPurified} 批截图时出错:`, renderBatchError);
            forwardListPurified.push(`[❌ 第 ${batchNum}/${totalBatchesPurified} 批处理出错]`); // 添加错误占位符
          } finally {
            // 清理当前批次的临时文件
            if (tempHtmlFilePathPurified && fs.existsSync(tempHtmlFilePathPurified)) {
              try { await fsPromises.unlink(tempHtmlFilePathPurified); } catch (unlinkErr) {}
            }
            if (tempImgFilePathPurified && fs.existsSync(tempImgFilePathPurified)) {
              try { await fsPromises.unlink(tempImgFilePathPurified); } catch (unlinkErr) {}
            }
          }
        } // 结束净化列表批次循环

        // 发送合并后的净化列表消息
        if (forwardListPurified.length > 1) { // 确保除了标题还有内容
          try {
            const forwardMsgPurified = await common.makeForwardMsg(e, forwardListPurified, '净化屏蔽列表详情');
            if (forwardMsgPurified) {
              await e.reply(forwardMsgPurified);
              logger.info(`${logPrefix} [封禁列表] 合并的净化屏蔽列表消息已发送。`);
            } else {
              logger.error(`${logPrefix} [封禁列表] 创建净化列表合并消息失败 (makeForwardMsg 返回空)。`);
              await e.reply('生成合并的净化列表消息失败 (内部错误)。', true);
            }
          } catch (sendForwardError) {
            logger.error(`${logPrefix} [封禁列表] 发送净化列表合并消息失败:`, sendForwardError);
            await e.reply('发送合并的净化列表消息失败，请查看日志。', true);
          }
        } else {
           logger.warn(`${logPrefix} [封禁列表] 净化列表处理后为空（仅含标题），未发送合并消息。`);
        }

      } else if (currentPFL == Purify_Level.NONE) {
          logger.info(`${logPrefix} [封禁列表] 当前净化等级为 0，跳过显示净化屏蔽列表。`);
          if (!manualSent && userBansData.length === 0 && purifiedBansData.length > 0) {
              // 只有净化项，但 PFL=0 不显示，需要告知用户
              await e.reply(`当前净化等级为 0，虽然有 ${purifiedBansData.length} 项符合净化规则，但不会被屏蔽。`, true);
          }
      } else {
          // PFL > 0 但 purifiedBansData 为空
          logger.info(`${logPrefix} [封禁列表] 净化等级为 ${currentPFL}，但没有被净化规则屏蔽的图片。`);
          if (!manualSent) { // 如果手动列表也没发送，且净化列表为空
              await e.reply('当前没有手动封禁，也没有被净化规则屏蔽的图片。', true);
          }
      }

      // 最终检查，如果尝试发送图片但都失败了，给个提示
      if (userBansData.length > 0 && !manualSent && !(currentPFL > Purify_Level.NONE && purifiedBansData.length > 0)) {
          await e.reply('生成手动封禁列表图片失败了，请检查日志。', true);
      } // 净化列表的失败已在合并消息中处理

      return true; // #ban列表 命令处理完成
    }

    // --- 处理 #咕咕牛封禁 / #咕咕牛解禁 ---
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
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, logger)
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
   *              【V4.8.3 修正】实现分批发送合并转发消息，解决群聊发送限制问题。
   *              按每批 28 项分割渲染并合并为一条转发消息发送
   */
  async FindRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库还没下载呢！', true)

    const match = e.msg.match(/^#查看\s*(.+)$/i)
    if (!match?.[1]) return e.reply('想看哪个角色呀？格式：#查看 角色名', true)

    const roleNameInput = match[1].trim()
    try {
      const { mainName, exists } = await MiaoPluginMBT.FindRoleAlias(roleNameInput, this.logger)
      const standardMainName = mainName || roleNameInput

      const roleImageData = MiaoPluginMBT.#imgDataCache.filter(img => img.characterName === standardMainName)

      if (roleImageData.length === 0) {
        const dirExists = await MiaoPluginMBT.CheckRoleDirExists(standardMainName)
        if (dirExists) return e.reply(`『${standardMainName}』的角色文件夹在，但是图库数据里没有图片信息哦。`)
        else return e.reply(`图库里好像没有『${standardMainName}』这个角色呢。`)
      }

      // await e.reply(
      //   `${this.logPrefix} 正在整理 [${standardMainName}] 的图片 (${roleImageData.length} 张)`
      // )

      roleImageData.sort(
        (a, b) =>
          parseInt(a.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0') -
          parseInt(b.path?.match(/Gu(\d+)\.webp$/i)?.[1] || '0')
      )

      const ITEMS_PER_BATCH = 28 // 设置合并内容
      const totalItems = roleImageData.length
      const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH)

      this.logger.info(
        `${this.logPrefix} [查看] 角色 ${standardMainName} 共 ${totalItems} 张图片，将分 ${totalBatches} 批发送 (每批最多 ${ITEMS_PER_BATCH} 张)。`
      )

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        const startIndex = (batchNum - 1) * ITEMS_PER_BATCH
        const endIndex = Math.min(startIndex + ITEMS_PER_BATCH, totalItems)
        const currentBatchData = roleImageData.slice(startIndex, endIndex)

        // 构建当前批次的合并转发列表
        const batchTitle = `查看『${standardMainName}』 (${startIndex + 1}-${endIndex} / ${totalItems} 张)`
        const currentForwardList = [[batchTitle]]
        if (batchNum === 1) {
          // 只在第一批发提示导出命令
          currentForwardList.push([`想导出图片？试试: #咕咕牛导出${standardMainName}1`])
        }

        this.logger.info(`${this.logPrefix} [查看] 正在准备第 ${batchNum}/${totalBatches} 批...`)

        // 填充当前批次的图片信息
        for (let i = 0; i < currentBatchData.length; i++) {
          const item = currentBatchData[i]
          const globalIndex = startIndex + i // 图片在完整列表中的索引

          const { path: relativePath } = item
          if (!relativePath) continue

          const normalizedPath = relativePath.replace(/\\/g, '/')
          const fileName = path.basename(normalizedPath)
          const baseName = fileName.replace(/\.webp$/i, '')

          const isEffectivelyBanned = MiaoPluginMBT.#activeBanSet.has(normalizedPath)
          const isUserBanned = MiaoPluginMBT.#userBanSet.has(normalizedPath)
          const isPurified = MiaoPluginMBT.CheckIfPurifiedByLevel(
            item,
            MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl
          )

          let labelStr = ''
          if (isEffectivelyBanned) {
            labelStr += ' ❌封禁'
            if (isPurified && !isUserBanned) labelStr += ' 🌱净化'
          }

          // 使用全局索引 + 1 作为编号
          const entryText = `${globalIndex + 1}、${baseName}${labelStr}`
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(normalizedPath)

          if (absolutePath) {
            try {
              await fsPromises.access(absolutePath, fs.constants.R_OK)
              currentForwardList.push([entryText, segment.image(`file://${absolutePath}`)])
            } catch (accessErr) {
              this.logger.warn(`${this.logPrefix} [查看] 文件无法访问: ${absolutePath}`, accessErr.code)
              currentForwardList.push(`${entryText} (文件状态异常)`)
            }
          } else {
            this.logger.warn(`${this.logPrefix} [查看] 文件丢失: ${normalizedPath}`)
            currentForwardList.push(`${entryText} (文件丢失了...)`)
          }
        }

        // 发送当前批次的合并转发消息
        if (currentForwardList.length > 1) {
          // 确保列表不为空（至少有标题）
          try {
            const forwardMsg = await common.makeForwardMsg(
              e,
              currentForwardList,
              `[${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`
            )
            if (forwardMsg) {
              await e.reply(forwardMsg)
              this.logger.info(`${this.logPrefix} [查看] 第 ${batchNum}/${totalBatches} 批已发送。`)
            } else {
              this.logger.error(`${this.logPrefix} [查看] common.makeForwardMsg 返回空 (批次 ${batchNum})`)
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批图片列表失败了 (makeForwardMsg failed)。`, true)
            }
          } catch (sendError) {
            this.logger.error(
              `${this.logPrefix} [查看] 发送第 ${batchNum}/${totalBatches} 批合并转发消息失败:`,
              sendError
            )
            await e.reply(`发送第 ${batchNum}/${totalBatches} 批图片列表失败了，请检查后台日志。`, true)
            // 如果某一批发送失败，可以选择停止后续发送
            // break;
          }

          // 如果不是最后一批，则添加延迟
          if (batchNum < totalBatches) {
            await common.sleep(1500) // 批次间延迟 1.5 秒
          }
        } else {
          this.logger.warn(`${this.logPrefix} [查看] 第 ${batchNum}/${totalBatches} 批为空，跳过发送。`)
        }
      }
    } catch (error) {
      await this.ReportError(e, `查看角色 ${roleNameInput}`, error)
    }
    return true
  }

  /**
   * @description 处理 #可视化 命令，查找角色图片并生成分批长截图。
   *              查找目标插件目录，使用外部 visualize.html 模板。
   */
  async VisualizeRoleSplashes(e) {
    // 检查初始化状态
    if (!(await this.CheckInit(e))) return true

    // 解析命令参数
    const match = e.msg.match(/^#可视化\s*(.+)$/i)
    if (!match?.[1]) return e.reply('想可视化哪个角色呀？格式：#可视化 角色名', true)
    const roleNameInput = match[1].trim()

    // 定义函数作用域变量
    let standardMainName = ''
    const logger = this.logger
    const logPrefix = this.logPrefix
    const BATCH_SIZE = 20

    try {
      // 获取标准角色名
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(roleNameInput, logger)
      standardMainName = aliasResult.mainName || roleNameInput
      logger.info(`${logPrefix} [可视化] 请求可视化角色: '${roleNameInput}', 标准名: '${standardMainName}'`)

      //  查找角色图片文件夹路径
      let roleFolderPath = null
      const targetDirsToCheck = [
        MiaoPluginMBT.paths.target.miaoChar,
        MiaoPluginMBT.paths.target.zzzChar,
        MiaoPluginMBT.paths.target.wavesChar,
      ].filter(Boolean)

      logger.info(`${logPrefix} [可视化] 开始在目标插件目录查找角色 '${standardMainName}' 的文件夹...`)
      for (const targetDir of targetDirsToCheck) {
        if (!targetDir) continue
        const potentialPath = path.join(targetDir, standardMainName)
        try {
          await fsPromises.access(potentialPath)
          const stats = await fsPromises.stat(potentialPath)
          if (stats.isDirectory()) {
            roleFolderPath = potentialPath
            logger.info(`${logPrefix} [可视化] 在目标插件目录找到角色文件夹: ${roleFolderPath}`)
            break
          }
        } catch (err) {
          if (err.code !== ERROR_CODES.NotFound) {
            // 保留 ENOENT 代码以供技术参考
            logger.warn(`${logPrefix} [可视化] 访问目标路径 ${potentialPath} 时出错 (非ENOENT):`, err.code)
          }
        }
      }

      if (!roleFolderPath) {
        logger.warn(`${logPrefix} [可视化] 未在任何目标插件目录中找到角色 '${standardMainName}' 的文件夹。`)
        return e.reply(
          `在目标插件目录中没有找到角色『${standardMainName}』的图片文件夹哦，是不是还没同步或者角色名错了？`
        )
      }
      logger.info(`${logPrefix} [可视化] 最终确定角色文件夹: ${roleFolderPath}`)

      // 读取文件夹内所有支持的图片文件
      const supportedExtensions = ['.jpg', '.png', '.jpeg', '.webp', '.bmp']
      let allImageFiles = []
      try {
        const files = await fsPromises.readdir(roleFolderPath)
        allImageFiles = files.filter(file => supportedExtensions.includes(path.extname(file).toLowerCase()))
        logger.info(`${logPrefix} [可视化] 在 ${roleFolderPath} 中找到 ${allImageFiles.length} 个支持的图片文件。`)
      } catch (readErr) {
        logger.error(`${logPrefix} [可视化] 读取角色文件夹失败: ${roleFolderPath}`, readErr)
        return e.reply(`读取角色『${standardMainName}』的图片文件夹时出错...`)
      }

      if (allImageFiles.length === 0) {
        logger.warn(`${logPrefix} [可视化] 角色文件夹 ${roleFolderPath} 为空或不包含支持的图片格式。`)
        return e.reply(`『${standardMainName}』的文件夹里没有找到支持的图片文件哦。`)
      }

      // 排序图片
      allImageFiles.sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)\.\w+$/)?.[1] || '0')
        const numB = parseInt(b.match(/(\d+)\.\w+$/)?.[1] || '0')
        if (numA === numB) return a.localeCompare(b)
        return numA - numB
      })

      const totalImageCount = allImageFiles.length
      const totalBatches = Math.ceil(totalImageCount / BATCH_SIZE)

      logger.info(
        `${logPrefix} [可视化] 找到 ${totalImageCount} 张图片，将分 ${totalBatches} 批发送 (每批最多 ${BATCH_SIZE} 张)...`
      )
      await e.reply(
        `${logPrefix} 正在整理${totalImageCount} 张[${standardMainName}]的图片,分${totalBatches}批发送,请注意查收~`
      )
      await common.sleep(500)

      // 确定模板文件路径
      let sourceTplFilePath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'visualize.html')
      try {
        await fsPromises.access(sourceTplFilePath) // 检查主路径模板是否存在
        logger.debug(`${logPrefix} [可视化] 使用公共资源目录的模板: ${sourceTplFilePath}`)
      } catch (commonErr) {
        if (commonErr.code === ERROR_CODES.NotFound) {
          logger.warn(`${logPrefix} [可视化] 公共资源模板 (${sourceTplFilePath}) 未找到，尝试插件资源目录...`)
          sourceTplFilePath = path.resolve(__dirname, '..', 'resources', 'GuGuNiu-Gallery', 'html', 'visualize.html')
          try {
            await fsPromises.access(sourceTplFilePath) // 检查备用路径模板是否存在
            logger.debug(`${logPrefix} [可视化] 使用插件资源目录的模板: ${sourceTplFilePath}`)
          } catch (pluginErr) {
            logger.error(`${logPrefix} [可视化] 主模板和备用模板均未找到: ${sourceTplFilePath}`, pluginErr)
            await e.reply('生成可视化图片失败：缺少必要的 visualize.html 模板文件。')
            return true
          }
        } else {
          logger.error(`${logPrefix} [可视化] 访问公共资源模板时出错: ${sourceTplFilePath}`, commonErr)
          await e.reply('生成可视化图片失败：访问模板文件时出错。')
          return true
        }
      }

      // 循环处理每个批次
      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        let tempHtmlFilePath = ''
        let tempImgFilePath = ''
        const tempFileNameBase = `visualize-${standardMainName.replace(
          /[^a-zA-Z0-9]/g,
          '_'
        )}-batch${batchNum}-${Date.now()}`

        try {
          const startIndex = (batchNum - 1) * BATCH_SIZE
          const endIndex = Math.min(startIndex + BATCH_SIZE, totalImageCount)
          const currentBatchFiles = allImageFiles.slice(startIndex, endIndex)

          logger.info(
            `${logPrefix} [可视化] 正在生成第 ${batchNum}/${totalBatches} 批 (${currentBatchFiles.length} 张图片)...`
          )

          // 准备当前批次的渲染数据
          const imagesData = currentBatchFiles.map((fileName, index) => {
            const isGu = /gu/i.test(fileName)
            return {
              fileName: fileName.replace(/\.\w+$/, ''), // 去掉后缀用于显示
              filePath: `file://${path.join(roleFolderPath, fileName).replace(/\\/g, '/')}`,
              originalIndex: startIndex + index,
              isGu: isGu,
            }
          })
          const pluginVersion = MiaoPluginMBT.GetVersionStatic() // 获取插件版本
          const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

          const renderData = {
            pluginVersion: pluginVersion,
            characterName: standardMainName,
            imageCount: totalImageCount,
            images: imagesData,
            batchNum: batchNum,
            totalBatches: totalBatches,
            batchStartIndex: startIndex,
            scaleStyleValue: scaleStyleValue,
          }
          // logger.debug(`${logPrefix} [可视化] 批次 ${batchNum} 数据已准备.`); // 减少冗余日志

          await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true })
          await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true })
          tempHtmlFilePath = path.join(MiaoPluginMBT.paths.tempHtmlPath, `${tempFileNameBase}.html`)
          tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `${tempFileNameBase}.png`)
          logger.debug(`${logPrefix} [可视化] 批次 ${batchNum} 临时 HTML: ${tempHtmlFilePath}`)
          logger.debug(`${logPrefix} [可视化] 批次 ${batchNum} 临时图片: ${tempImgFilePath}`)

          try {
            await fsPromises.copyFile(sourceTplFilePath, tempHtmlFilePath)
            logger.debug(`${logPrefix} [可视化] 批次 ${batchNum}: 已复制源模板到 ${tempHtmlFilePath}`)
          } catch (copyError) {
            logger.error(`${logPrefix} [可视化] 批次 ${batchNum}: 复制模板到临时文件失败:`, copyError)
            await e.reply(`生成第 ${batchNum}/${totalBatches} 批预览图失败：无法创建临时模板文件。`)
            continue // 跳过此批次
          }

          // 调用 Puppeteer 截图
          let img = null
          try {
            logger.debug(
              `${logPrefix} [可视化] 批次 ${batchNum}: 调用 puppeteer.screenshot，使用 tplFile: ${tempHtmlFilePath} 并展开数据.`
            )
            img = await puppeteer.screenshot(`guguniu-visualize-${standardMainName}-batch${batchNum}`, {
              tplFile: tempHtmlFilePath,
              savePath: tempImgFilePath,
              imgType: 'png',
              pageGotoParams: { waitUntil: 'networkidle0', timeout: 45000 },
              ...renderData,
              screenshotOptions: { fullPage: true },
              width: 800,
            })
          } catch (screenshotError) {
            logger.error(
              `${logPrefix} [可视化] Puppeteer 生成第 ${batchNum}/${totalBatches} 批截图失败:`,
              screenshotError
            )
            // 错误处理逻辑
            if (screenshotError.message?.includes('加载html错误：undefined')) {
              logger.error(
                `${logPrefix} [可视化] 批次 ${batchNum}: 截图失败，错误为 '加载html错误：undefined'。使用 tplFile 方式本不应发生此错误。`
              )
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批预览图失败：内部HTML加载错误 (undefined)。`)
            } else if (screenshotError.message?.includes('timeout')) {
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批预览图超时了...`)
            } else if (screenshotError.code === 'ENOENT') {
              logger.error(
                `${logPrefix} [可视化] 批次 ${batchNum}: 截图过程中发生 ENOENT 错误: ${screenshotError.path}`
              )
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批预览图失败：内部文件或目录未找到 (ENOENT)。`)
            } else {
              await e.reply(`生成第 ${batchNum}/${totalBatches} 批预览图失败了，请查看控制台日志。`)
            }
            img = null
          }

          // 发送截图
          if (img) {
            await e.reply(img)
            logger.info(`${logPrefix} [可视化] 『${standardMainName}』第 ${batchNum}/${totalBatches} 批图片已发送。`)
          } else {
            logger.error(`${logPrefix} [可视化] 第 ${batchNum}/${totalBatches} 批截图生成失败或返回空。`)
          }
        } catch (batchProcessingError) {
          logger.error(`${logPrefix} [可视化] 处理第 ${batchNum}/${totalBatches} 批时发生错误:`, batchProcessingError)
          await e.reply(`处理第 ${batchNum}/${totalBatches} 批数据时出错，跳过此批次。`)
        } finally {
          if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
            try {
              await fsPromises.unlink(tempHtmlFilePath)
              logger.debug(`${logPrefix} [可视化] 批次 ${batchNum}: 已清理临时 HTML: ${tempHtmlFilePath}`)
            } catch (unlinkErr) {
              logger.warn(
                `${logPrefix} [可视化] 批次 ${batchNum}: 清理临时 HTML 失败: ${tempHtmlFilePath}`,
                unlinkErr.code
              )
            }
          }
          if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
            try {
              await fsPromises.unlink(tempImgFilePath)
              logger.debug(`${logPrefix} [可视化] 批次 ${batchNum}: 已清理临时图片: ${tempImgFilePath}`)
            } catch (unlinkErr) {
              logger.warn(
                `${logPrefix} [可视化] 批次 ${batchNum}: 清理临时图片失败: ${tempImgFilePath}`,
                unlinkErr.code
              )
            }
          }
          // 清理 Puppeteer 可能残留的别名目录
          const possiblePuppeteerTempDir = path.join(
            MiaoPluginMBT.paths.tempPath,
            '..',
            `guguniu-visualize-${standardMainName}-batch${batchNum}`
          )
          if (fs.existsSync(possiblePuppeteerTempDir)) {
            logger.warn(
              `${logPrefix} [可视化] 批次 ${batchNum}: 检测到 Puppeteer 残留目录 ${possiblePuppeteerTempDir}，尝试删除...`
            )
            try {
              await safeDelete(possiblePuppeteerTempDir)
            } catch (deleteErr) {
              logger.error(
                `${logPrefix} [可视化] 批次 ${batchNum}: 删除 Puppeteer 残留目录 ${possiblePuppeteerTempDir} 失败:`,
                deleteErr
              )
            }
          }

          // 批次间的延迟
          if (batchNum < totalBatches) {
            await common.sleep(2500)
          }
        }
      }

      logger.info(`${logPrefix} [可视化] 『${standardMainName}』所有批次处理完成。`)
    } catch (error) {
      logger.error(`${logPrefix} [可视化] 处理角色 '${roleNameInput}' 时发生顶层错误:`, error)
      await this.ReportError(e, `可视化角色 ${roleNameInput}`, error)
    } finally {
      // 最终清理
      if (standardMainName) {
        const possibleGenericDir = path.join(
          MiaoPluginMBT.paths.tempPath,
          '..',
          `guguniu-visualize-${standardMainName}`
        )
        if (fs.existsSync(possibleGenericDir)) {
          logger.warn(
            `${logPrefix} [可视化] [最终清理] 检测到可能的 Puppeteer 残留目录 ${possibleGenericDir}，尝试删除...`
          )
          try {
            await safeDelete(possibleGenericDir)
          } catch (deleteErr) {
            logger.error(
              `${logPrefix} [可视化] [最终清理] 删除 Puppeteer 残留目录 ${possibleGenericDir} 失败:`,
              deleteErr
            )
          }
        }
      }
      logger.debug(`${logPrefix} [可视化] VisualizeRoleSplashes 函数执行完毕.`)
    }
    return true
  }

  /**
   * @description 处理 #咕咕牛导出 命令，发送指定图片文件。
   *              读取文件为 Buffer 并指定文件名，以兼容 OneBot v11/v12。
   */
  async ExportSingleImage(e) {
    if (!(await this.CheckInit(e))) return true
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1))) return e.reply('『咕咕牛』核心库还没下载呢！', true)

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i)
    if (!match?.[1]) return e.reply('要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)', true)

    const targetIdentifierRaw = match[1].trim()
    let targetRelativePath = null
    let targetFileName = ''
    let absolutePath = null // 将 absolutePath 移到 try 外部，方便 finally 中使用

    try {
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw)
      if (!parsedId) return e.reply('格式好像不对哦，应该是 角色名+编号，比如：花火1', true)
      const { mainName: rawMainName, imageNumber } = parsedId

      const aliasResult = await MiaoPluginMBT.FindRoleAlias(rawMainName, this.logger)
      const standardMainName = aliasResult.exists ? aliasResult.mainName : rawMainName

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
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)`
        if (MiaoPluginMBT.#imgDataCache.length === 0) hint = `(图库数据是空的)`
        else if (foundCount === 0 && MiaoPluginMBT.#imgDataCache.length > 0)
          hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)`
        else if (foundCount > 0) hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)`
        return e.reply(`在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`, true)
      }

      targetRelativePath = imageData.path.replace(/\\/g, '/')
      targetFileName = path.basename(targetRelativePath) // 获取原始文件名

      if (MiaoPluginMBT.#activeBanSet.has(targetRelativePath)) {
        return e.reply(`图片 ${targetFileName} 被封禁了，不能导出哦。`, true)
      }

      absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(targetRelativePath) // 赋值给外部变量
      if (!absolutePath) {
        return e.reply(`糟糕，文件丢失了：${targetFileName}，没法导出。`, true)
      }

      let fileBuffer = null
      try {
        fileBuffer = await fsPromises.readFile(absolutePath)
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('读取到的文件 Buffer 为空')
        }
        this.logger.info(
          `${this.logPrefix} [导出] 成功读取文件到 Buffer: ${targetFileName}, 大小: ${fileBuffer.length} bytes`
        )
      } catch (readError) {
        this.logger.error(`${this.logPrefix} [导出] 读取文件失败: ${absolutePath}`, readError)
        return e.reply(`读取文件 ${targetFileName} 时出错，无法导出。`, true)
      }

      this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 正在导出: ${targetFileName}`)

      await e.reply(`📦 导出成功！给你 -> ${targetFileName}`)
      await common.sleep(200) // 保留短暂延迟

      const fileSegment = segment.file(fileBuffer, targetFileName)
      // 有些旧版本的 segment 可能需要不同的构造方式，例如：
      // const fileSegment = segment.file(`base64://${fileBuffer.toString('base64')}`, targetFileName);
      // segment.file({ file: fileBuffer, name: targetFileName });
      // 这里用最可能兼容的方式

      await e.reply(fileSegment)
    } catch (sendErr) {
      // 处理发送错误
      this.logger.error(`${this.logPrefix} 导出 ${targetFileName || targetIdentifierRaw} 时发送失败:`, sendErr)
      try {
        if (
          sendErr?.message?.includes('highway') ||
          sendErr?.message?.includes('file size') ||
          sendErr?.code === -36 ||
          sendErr?.code === 210005 ||
          sendErr?.code === 210003
        ) {
          await e.reply(
            `发送文件失败了,文件通道好像出了点问题 (${
              sendErr.code || '未知代码'
            })，可能是文件太大、网络不好或者被QQ限制了。`,
            true
          )
        } else {
          await this.ReportError(e, `导出文件 ${targetFileName || targetIdentifierRaw}`, sendErr)
        }
      } catch (replyError) {
        this.logger.error(`${this.logPrefix} 发送导出失败提示时也出错:`, replyError)
      }
    }
    return true
  }

  /**
   * @description 处理 #咕咕牛帮助 命令。
   */
  async Help(e) {
    const networkHelpUrl = 'https://s2.loli.net/2025/04/28/7b8ZwBKVhY6Xdny.webp'
    const localHelpPath = MiaoPluginMBT.paths.helpImagePath

    try {
      await fsPromises.access(localHelpPath, fs.constants.R_OK)
      await e.reply(segment.image(`file://${localHelpPath}`))
    } catch (localError) {
      if (localError.code !== ERROR_CODES.NotFound) {
        this.logger.warn(`${this.logPrefix} [帮助] 访问本地帮助图片失败:`, localError.code)
      }
      this.logger.info(`${this.logPrefix} [帮助] 本地帮助图 (${localHelpPath}) 加载失败，尝试发送在线版本...`)
      try {
        await e.reply(segment.image(networkHelpUrl))
      } catch (networkError) {
        this.logger.error(`${this.logPrefix} [帮助] 发送在线帮助图片也失败了:`, networkError.message)
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
        )
      }
    }
    return true
  }

  /**
   * @description 处理 #咕咕牛测速 命令，测试代理节点速度并发送图片报告。
   *              使用外部 HTML 模板，手动渲染后写入临时文件再截图。
   */
  async ManualTestProxies(e) {
    if (!(await this.CheckInit(e))) return true;
    await e.reply(`${this.logPrefix} 收到！开始火力全开测试网络节点...`, true);
    const startTime = Date.now();
    let speeds1 = [], best1 = null;
    let tempHtmlFilePath = ''; 
    let tempImgFilePath = '';

    try {
      speeds1 = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, this.logger);
      const available1 = MiaoPluginMBT.GetSortedAvailableSources(speeds1, true, this.logger);
      best1 = available1[0] || null;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const processSpeeds = speeds => { 
        return speeds
          .map(s => {
            let statusText = 'timeout';
            if (s.testUrlPrefix === null) statusText = 'na';
            else if (Number.isFinite(s.speed) && s.speed >= 0) statusText = 'ok';
            return { ...s, statusText };
          })
          .sort((a, b) =>
              (a.priority ?? 999) - (b.priority ?? 999) ||
              (a.speed === Infinity || a.statusText === 'na' ? 1 : (b.speed === Infinity || b.statusText === 'na' ? -1 : a.speed - b.speed))
          );
      };
      const processedSpeedsResult = processSpeeds(speeds1);
      const renderData = { speeds1: processedSpeedsResult, best1: best1, duration: duration };
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      // 获取外部模板文件路径
      const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'speedtest.html');
      try {
          await fsPromises.access(sourceHtmlPath); // 检查模板是否存在
          this.logger.debug(`${this.logPrefix} [手动测速] 使用外部模板: ${sourceHtmlPath}`);
      } catch (err) {
          logger.error(`${this.logPrefix} [手动测速] 找不到外部模板文件: ${sourceHtmlPath}`, err);
          await e.reply('生成测速报告失败：缺少 speedtest.html 模板文件。').catch(() => {});
          return true;
      }


      await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
      tempHtmlFilePath = path.join(
        MiaoPluginMBT.paths.tempHtmlPath,
        `speedtest-manual-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
      );
      try {
        await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath); 
        this.logger.debug(`${this.logPrefix} [手动测速] 已将外部模板复制到临时文件: ${tempHtmlFilePath}`);
      } catch (copyErr) {
        this.logger.error(`${this.logPrefix} [手动测速] 复制模板文件失败:`, copyErr);
        await e.reply('生成测速报告失败：无法创建临时模板文件。').catch(() => {});
        return true;
      }


      // 准备截图路径
      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
      );

      const img = await puppeteer.screenshot('guguniu-speedtest', {
        tplFile: tempHtmlFilePath, 
        savePath: tempImgFilePath,
        imgType: 'png',
        pageGotoParams: { waitUntil: 'networkidle0' },
        ...renderData,           
        scaleStyleValue: scaleStyleValue,
        screenshotOptions: { fullPage: false },
        pageBoundingRect: { selector: 'body', padding: 0 },
        width: 540,
      });

      if (img) {
        await e.reply(img);
      } else {
        this.logger.error(`${this.logPrefix} [手动测速] 生成截图失败。`);
        await e.reply('生成测速报告图片失败了，请看看日志。');
      }
    } catch (error) {
      await this.ReportError(e, '手动网络测速', error, `测速结果(原始): ${JSON.stringify(speeds1)}`);
    } finally {
      if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
        try { await fsPromises.unlink(tempHtmlFilePath); } catch (unlinkErr) {}
      }
      if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
        try { await fsPromises.unlink(tempImgFilePath); } catch (unlinkErr) {}
      }
      const possiblePuppeteerTempDir = path.join(MiaoPluginMBT.paths.tempPath, '..', 'guguniu-speedtest');
      if (fs.existsSync(possiblePuppeteerTempDir)) {
        try { await safeDelete(possiblePuppeteerTempDir); } catch (deleteErr) { }
      }
    }
    return true;
  }

  /**
   * @description 显示设置面板图片。
   * @param {import('yunzai').GroupMessage | import('yunzai').PrivateMessage} e 消息事件对象
   * @param {string} [extraMsg=''] 附加的提示信息 (例如 "设置已更新！")
   */
  async ShowSettingsPanel(e, extraMsg = '') {
    if (!(await this.CheckInit(e))) return true; // 确保初始化

    const logger = this.logger;
    const logPrefix = this.logPrefix;

    let tempHtmlFilePath = '';
    let tempImgFilePath = '';
    const sourceHtmlPath = path.join(MiaoPluginMBT.paths.commonResPath, 'html', 'settings_panel.html');

    try {
        // 检查模板文件
        try {
            await fsPromises.access(sourceHtmlPath);
        } catch (err) {
             logger.error(`${logPrefix} [设置面板] 找不到模板文件: ${sourceHtmlPath}`, err);
             await e.reply('无法显示设置面板：缺少 settings_panel.html 模板文件。');
             return true;
        }

        // 准备渲染数据
        const config = MiaoPluginMBT.MBTConfig; // 获取当前配置
        const tuKuEnabled = config?.TuKuOP ?? Default_Config.defaultTuKuOp;
        const pflLevel = config?.PFL ?? Default_Config.defaultPfl;
        const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();
        const randomBgImageUrl = MiaoPluginMBT.getRandomBgImageUrl();
        //logger.info(`${logPrefix} [设置面板] 获取到的随机背景图 URL: [${randomBgImageUrl}]`);

        const renderData = {
            pluginVersion: MiaoPluginMBT.GetVersionStatic(),
            tuKuStatus: {
                text: tuKuEnabled ? '已启用' : '已禁用',
                class: tuKuEnabled ? 'value-enabled' : 'value-disabled'
            },
            pflStatus: {
                level: pflLevel,
                description: Purify_Level.getDescription(pflLevel),
                class: `value-level-${pflLevel}`
            },
            scaleStyleValue: scaleStyleValue,
            backgroundImageUrl: randomBgImageUrl,
            // 未来开关的占位数据
            // horizontalMode: { text: '未启用', class: 'value-disabled' },
            // aiFeature: { text: '未启用', class: 'value-disabled' }
        };

        // 创建临时文件并复制模板
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
        tempHtmlFilePath = path.join(MiaoPluginMBT.paths.tempHtmlPath, `settings-${Date.now()}.html`);
        tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `settings-${Date.now()}.png`);
        await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath);

        logger.info(`${logPrefix} [设置面板] 开始生成设置面板截图...`);
        const img = await puppeteer.screenshot('guguniu-settings-panel', {
            tplFile: tempHtmlFilePath,
            savePath: tempImgFilePath,
            imgType: 'png',
            pageGotoParams: { waitUntil: 'networkidle0' },
            ...renderData,
            screenshotOptions: { fullPage: true  },
            pageBoundingRect: { selector: '.panel', padding: 15}, 
            width: 480
        });

        // 发送截图
        if (img) {
            if (extraMsg) { // 如果有附加消息，先发送
                await e.reply(extraMsg, true);
                await common.sleep(300); // 短暂延迟
            }
            await e.reply(img);
            logger.info(`${logPrefix} [设置面板] 设置面板图片已发送。`);
        } else {
            logger.error(`${logPrefix} [设置面板] Puppeteer 未能成功生成图片。`);
            await e.reply('生成设置面板图片失败，请查看日志。');
        }

    } catch (error) {
        logger.error(`${logPrefix} [设置面板] 生成或发送面板时发生错误:`, error);
        await this.ReportError(e, '显示设置面板', error);
    } finally {
        // 清理临时文件
        if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
            try { await fsPromises.unlink(tempHtmlFilePath); } catch (unlinkErr) {}
        }
        if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
            try { await fsPromises.unlink(tempImgFilePath); } catch (unlinkErr) {}
        }
        // 清理 Puppeteer 临时目录
        const possiblePuppeteerTempDir = path.join(MiaoPluginMBT.paths.tempPath, '..', 'guguniu-settings-panel');
         if (fs.existsSync(possiblePuppeteerTempDir)) {
            try { await safeDelete(possiblePuppeteerTempDir); } catch (deleteErr) {}
         }
    }
    return true;
  }

// --- 静态辅助方法 ---

 /**
   * @description 插件全局静态初始化入口。
 */
 static async InitializePlugin(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix; 

    if (MiaoPluginMBT.isInitializing) {
        logger.warn(`${logPrefix} [初始化] 检测到初始化正在进行中，等待完成...`);
        try {
            await MiaoPluginMBT.initializationPromise;
        } catch (waitError) {
            // logger.error(`${logPrefix} [初始化] 等待现有初始化完成时出错:`, waitError.message);   //MAX级别 调试用
        }
        return MiaoPluginMBT.initializationPromise; 
    }

    if (MiaoPluginMBT.initializationPromise) {
        // logger.debug(`${logPrefix} [初始化] 初始化 Promise 已存在，直接返回。`);   //MAX级别 调试用
        return MiaoPluginMBT.initializationPromise;
    }
    if (MiaoPluginMBT.isGloballyInitialized) {
        // logger.debug(`${logPrefix} [初始化] 已全局初始化，跳过。`);  //MAX级别 调试用
        return Promise.resolve(); 
    }

    // 设置同步锁 
    MiaoPluginMBT.isInitializing = true;
    logger.info(`${logPrefix} 开始全局初始化 (V${MiaoPluginMBT.GetVersionStatic()})...`); 
    MiaoPluginMBT.isGloballyInitialized = false; // 重置完成标志

    // 创建并存储初始化 Promise
    MiaoPluginMBT.initializationPromise = (async () => {
      const errors = []; // 存储非致命错误信息
      let fatalError = null; // 存储致命错误
      let localImgDataCache = []; // 临时存储加载的数据

      try {
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, logger); 
        if (!config) throw new Error('无法加载图库配置');

        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, logger); 
        if (!Array.isArray(localImgDataCache)) {
            logger.error(`${logPrefix} [初始化] CRITICAL: 元数据加载失败或格式错误!`);
            localImgDataCache = [];
            throw new Error('加载图片元数据失败');
        } else if (localImgDataCache.length === 0) {
            errors.push('警告：元数据为空');
        }

        const bansLoaded = await MiaoPluginMBT.LoadUserBans(true, logger);
        if (!bansLoaded) errors.push('警告：加载用户封禁列表失败');

        const aliasLoaded = await MiaoPluginMBT.LoadAliasData(true, logger); 
        if (!MiaoPluginMBT.#aliasData?.combined) {
            errors.push('警告：加载别名数据失败');
            MiaoPluginMBT.#aliasData = { combined: {} };
        } else if (!aliasLoaded) {
            errors.push('警告：部分别名加载失败');
        } else if (Object.keys(MiaoPluginMBT.#aliasData.combined).length === 0) {
            errors.push('警告：别名数据为空');
        }

        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, logger); 
        MiaoPluginMBT.#imgDataCache = Object.freeze(localImgDataCache);

        try {
          //logger.debug(`${logPrefix} [初始化] 尝试访问背景图目录: ${MiaoPluginMBT.paths.backgroundImgPath}`);
          await fsPromises.access(MiaoPluginMBT.paths.backgroundImgPath);
          const files = await fsPromises.readdir(MiaoPluginMBT.paths.backgroundImgPath);
          //logger.debug(`${logPrefix} [初始化] 读取到文件列表: ${files.join(', ')}`);
          MiaoPluginMBT.#backgroundImages = files.filter(file => /\.webp$/i.test(file));
          //logger.debug(`${logPrefix} [初始化] 筛选后的背景图列表 (#backgroundImages): ${MiaoPluginMBT.#backgroundImages.join(', ')}`);

          if (MiaoPluginMBT.#backgroundImages.length > 0) {
              logger.info(`${logPrefix} [初始化] 加载了 ${MiaoPluginMBT.#backgroundImages.length} 张背景图`);
          } else {
              //logger.warn(`${logPrefix} [初始化] 背景图片目录 (${MiaoPluginMBT.paths.backgroundImgPath}) 为空或不包含 .webp 图片。`);
              //errors.push('警告：未找到背景图片');
          }
        } catch (err) {
            if (err.code === ERROR_CODES.NotFound) {
                //logger.warn(`${logPrefix} [初始化] 背景图片目录未找到: ${MiaoPluginMBT.paths.backgroundImgPath}`);
            } else {
                //logger.error(`${logPrefix} [初始化] 读取背景图片目录时出错:`, err);
            }
            MiaoPluginMBT.#backgroundImages = [];
            //errors.push('警告：加载背景图片失败'); 
        }

        // 标记初始化完成
        MiaoPluginMBT.isGloballyInitialized = true;
        logger.info(`${logPrefix} 全局初始化成功。${errors.length > 0 ? ' 警告: ' + errors.join('; ') : ''}`);

        // 检查是否已经调度过删除任务，防止因可能的重入导致多次调度
        if (!MiaoPluginMBT.oldFileDeletionScheduled) {
            MiaoPluginMBT.oldFileDeletionScheduled = true; // 标记已调度
            const delaySeconds = 15; // 设置延迟时间（秒）
            logger.info(`${logPrefix} [初始化] 已调度延迟 ${delaySeconds} 秒后清理旧文件任务。`);

            setTimeout(async () => {
                const oldPluginFileName = '咕咕牛图库下载器.js';
                const oldPluginPath = path.join(MiaoPluginMBT.paths.target.exampleJs, oldPluginFileName);
                try {
                    await fsPromises.access(oldPluginPath); // 检查旧文件是否存在
                    logger.warn(`${logPrefix} [延迟清理] 检测到旧插件文件 (${oldPluginFileName})，将尝试删除...`);
                    await fsPromises.unlink(oldPluginPath);
                    logger.info(`${logPrefix} [延迟清理] 旧插件文件 (${oldPluginFileName}) 已成功删除。`);
                } catch (err) {
                    if (err.code === ERROR_CODES.NotFound) { 
                        // 旧文件不存在，是正常情况
                        logger.debug(`${logPrefix} [延迟清理] 未检测到旧插件文件，无需清理。`);
                    } else {
                        // 其他错误（如权限问题）
                        logger.error(`${logPrefix} [延迟清理] 删除旧插件文件 (${oldPluginPath}) 时出错:`, err);
                        // 静默处理，只记录错误日志
                    }
                }
                // 不需要重置 scheduled 标志，初始化理论上只成功一次
            }, delaySeconds * 1000); 
        }
      } catch (error) {
        fatalError = error;
        MiaoPluginMBT.isGloballyInitialized = false;
        logger.error(`${logPrefix} !!! 全局初始化失败: ${fatalError.message} !!!`);
        logger.error(fatalError.stack);
        // 重置静态变量以允许可能的重试
        MiaoPluginMBT.#imgDataCache = Object.freeze([]);
        MiaoPluginMBT.#userBanSet = new Set();
        MiaoPluginMBT.#activeBanSet = new Set();
        MiaoPluginMBT.#aliasData = null;
        // 不重置 initializationPromise，让等待者捕获错误
        throw fatalError;
      } finally {
        // 无论成功或失败，最后都要释放同步锁
        MiaoPluginMBT.isInitializing = false;
        logger.debug(`${logPrefix} [初始化] 同步锁已释放。`);
      }
    })();

    // 捕获未处理的 Promise 拒绝（用于调试，实际生产中可能不需要）
    MiaoPluginMBT.initializationPromise.catch(err => {
      // logger.error(`${logPrefix} 初始化 Promise 未处理拒绝(调试用): ${err.message}`);  //MAX级别 调试用
    });

    return MiaoPluginMBT.initializationPromise; 
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
   * @description 获取随机背景图片的 file:// URI
   * @returns {string} 随机背景图片的 URI，如果无可用图片则返回空字符串
   */
  static getRandomBgImageUrl() {
    if (!MiaoPluginMBT.#backgroundImages || MiaoPluginMBT.#backgroundImages.length === 0) {
        return ''; 
    }
    const randomIndex = Math.floor(Math.random() * MiaoPluginMBT.#backgroundImages.length);
    const randomFileName = MiaoPluginMBT.#backgroundImages[randomIndex];
    const absolutePath = path.join(MiaoPluginMBT.paths.backgroundImgPath, randomFileName);
    return `file://${absolutePath.replace(/\\/g, '/')}`;
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
      matchedSuggestion = '代码出错了: 引用了不存在的变量或函数。如果没改过代码，可能是插件Bug，快去反馈！'
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
        logger.error(`${Default_Config.logPrefix} [加载元数据] 读取或解析主路径文件失败 (${primaryPath}):`, error)
        data = null
        success = false
      }
    }
    let finalData = []
    if (!success || !Array.isArray(data) || data.length === 0) {
      if (!success) logger.warn(`${Default_Config.logPrefix} [加载元数据] 无法从文件加载元数据，执行扫描回退...`)
      else logger.warn(`${Default_Config.logPrefix} [加载元数据] 加载的元数据为空或格式错误，执行扫描回退...`)
      try {
        finalData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(logger)
        logger.info(`${Default_Config.logPrefix} [加载元数据] 扫描回退完成，找到 ${finalData.length} 个图片文件。`)
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
      logger.info(`${Default_Config.logPrefix} [加载元数据] 处理完成，最终获得 ${validCount} 条有效图片元数据。`)
      return validData
    } else {
      logger.error(`${Default_Config.logPrefix} [加载元数据] CRITICAL: 最终元数据结果不是一个数组！返回空数组。`)
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
            logger.warn(`${Default_Config.logPrefix} [扫描回退] 读取游戏目录 ${gameFolderPath} 失败:`, readGameErr.code)
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
        logger.error(`${Default_Config.logPrefix} [加载用户封禁] banlist.json 文件内容格式错误，不是一个有效的数组！`)
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
  static async GetTuKuLog(count = 5, RepoPath = MiaoPluginMBT.paths.LocalTuKuPath, logger = global.logger || console) {
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
   * @description 下载单个仓库，包含代理选择、GitHub 直连优先判断和 Fallback 重试逻辑。
   *              【V4.8.3 修正】移除失败切换时的用户提示，改为仅记录日志。
   */
   static async DownloadRepoWithFallback(repoNum, repoUrl, branch, localPath, eForProgress, loggerInstance) {
    const logPrefix = Default_Config.logPrefix;
    const repoName = repoNum === 1 ? '一号仓库' : '二号仓库';
    const baseRawUrl = RAW_URL_Repo1;
    loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 开始下载: ${repoUrl}`);

    let sourcesToTry = [];
    let allTestResults = [];
    const startTime = Date.now();
    let tempHtmlFilePath = '';
    let tempImgFilePath = '';
    let canGenerateReport = true;
    let lastError = null;

    try {
      allTestResults = await MiaoPluginMBT.TestProxies(baseRawUrl, loggerInstance);
    } catch (testError) {
      loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 代理测速失败:`, testError);
      const githubSource = Default_Config.proxies.find(p => p.name === 'GitHub');
      if (githubSource) {
        allTestResults = [{ ...githubSource, speed: Infinity }];
      }
    }

    if (eForProgress && repoNum === 1 && allTestResults.length > 0) {
        await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, { recursive: true });
        tempHtmlFilePath = path.join(
            MiaoPluginMBT.paths.tempHtmlPath,
            `dl-speedtest-temp-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
        );
        try {
            if (typeof SPEEDTEST_HTML_TEMPLATE !== 'string' || SPEEDTEST_HTML_TEMPLATE.length === 0) {
                throw new Error('SPEEDTEST_HTML_TEMPLATE 常量未定义或为空！');
            }
            await fsPromises.writeFile(tempHtmlFilePath, SPEEDTEST_HTML_TEMPLATE, 'utf8');
            loggerInstance.debug(`${logPrefix} [下载流程 ${repoName}] 已将内置模板写入临时文件: ${tempHtmlFilePath}`);
            canGenerateReport = true;
        } catch (writeErr) {
            loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 写入临时 HTML 文件失败:`, writeErr);
            await eForProgress.reply('生成测速报告失败：无法创建临时模板文件。').catch(() => {});
            canGenerateReport = false;
        }

        if (canGenerateReport) {
            try {
                const reportSources = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, loggerInstance);
                const bestSourceForReport = reportSources[0] || null;
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                const processSpeeds = speeds => {  return speeds.map(s => ({...s, statusText: s.testUrlPrefix === null ? 'na' : (Number.isFinite(s.speed) && s.speed >= 0 ? 'ok' : 'timeout')})).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999) || (a.speed === Infinity || a.statusText === 'na' ? 1 : (b.speed === Infinity || b.statusText === 'na' ? -1 : a.speed - b.speed))); };
                const processedSpeedsResult = processSpeeds(allTestResults);
                const renderData = { speeds1: processedSpeedsResult, best1: bestSourceForReport, duration: duration };

                await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, { recursive: true });
                tempImgFilePath = path.join(MiaoPluginMBT.paths.tempImgPath, `dl-speedtest-${Date.now()}.png`);

                const img = await puppeteer.screenshot('guguniu-dl-speedtest', {
                    tplFile: tempHtmlFilePath, 
                    savePath: tempImgFilePath, 
                    imgType: 'png',
                    pageGotoParams: { waitUntil: 'networkidle0' }, 
                    data: { ...renderData, scaleStyle: scaleStyle },
                    screenshotOptions: { fullPage: false }, 
                    pageBoundingRect: { selector: 'body', padding: 0 },
                     width: 540,
                });

                if (img) {
                    await eForProgress.reply(img); await common.sleep(500);
                } else {
                    loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 生成测速截图失败。`);
                    await eForProgress.reply(`${logPrefix} 生成测速报告失败，继续下载...`).catch(() => {});
                }
            } catch (renderOrReplyError) {
                loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 回复测速结果失败:`, renderOrReplyError);
                await eForProgress.reply(`${logPrefix} 处理测速报告时出错，继续下载...`).catch(() => {});
            } finally {
                 if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) { try { await fsPromises.unlink(tempHtmlFilePath); } catch (unlinkErr) {} }
                 if (tempImgFilePath && fs.existsSync(tempImgFilePath)) { try { await fsPromises.unlink(tempImgFilePath); } catch (unlinkErr) {} }
                 const possiblePuppeteerTempDir = path.join(MiaoPluginMBT.paths.tempPath, '..', 'guguniu-dl-speedtest');
                 if (fs.existsSync(possiblePuppeteerTempDir)) { try { await safeDelete(possiblePuppeteerTempDir); } catch (deleteErr) {} }
            }
        }
    }

    //  GitHub 直连优先判断 
    const githubResult = allTestResults.find(r => r.name === 'GitHub');
    let githubDirectAttempted = false; // 标记是否尝试了 GitHub 直连

    if (githubResult && githubResult.speed !== Infinity && githubResult.speed <= 300) {
        githubDirectAttempted = true; // 标记尝试
        const nodeName = 'GitHub(直连-优先)';
        loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 检测到 GitHub 直连延迟 (${githubResult.speed}ms) <= 300ms，优先尝试直连...`);
        if (eForProgress && repoNum === 1) await eForProgress.reply(`⚡ 检测到 GitHub 低延迟，优先尝试直连下载 ${repoName}...`).catch(() => {});

        const cloneArgsDirect = ['clone', `--depth=${Default_Config.gitCloneDepth}`, '--progress', repoUrl, localPath];
        const gitOptionsDirect = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };

        try {
            let progressReportedDirect = { 10: false, 50: false, 90: false };
            await ExecuteCommand(
                'git', cloneArgsDirect, gitOptionsDirect, Default_Config.gitCloneTimeout,
                stderrChunk => { // 进度报告回调
                    if (repoNum === 1 && eForProgress) {
                        const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/);
                        if (match?.[1]) {
                            const progress = parseInt(match[1], 10);
                            [10, 50, 90].forEach(t => {
                                if (progress >= t && !progressReportedDirect[t]) {
                                    progressReportedDirect[t] = true;
                                    eForProgress.reply(`『咕咕牛』${repoName} GitHub 直连下载: ${t}%...`).catch(() => {});
                                }
                            });
                        }
                    }
                }
            );
            loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 使用 ${nodeName} 下载成功！`);
            return { success: true, nodeName: nodeName }; // 直连成功，直接返回
        } catch (error) {
            loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 优先尝试 ${nodeName} 下载失败。将继续尝试其他源...`);
            loggerInstance.error(error);
            lastError = error;
            loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 尝试清理直连失败产生的目录: ${localPath}`);
            await safeDelete(localPath);
            await common.sleep(1000);
      }
    } else if (githubResult) {
         loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] GitHub 直连延迟 (${githubResult.speed === Infinity ? '超时/失败' : githubResult.speed + 'ms'}) > 300ms，按优先级选择节点。`);
         if (eForProgress && repoNum === 1) await eForProgress.reply(`⏳ GitHub 延迟较高，开始尝试其他下载节点...`).catch(()=>{});
    } else {
         loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 未找到 GitHub 测速结果，按优先级选择节点。`);
         if (eForProgress && repoNum === 1) await eForProgress.reply(`⏳ 开始尝试下载节点...`).catch(()=>{});
    }


    sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(allTestResults, true, loggerInstance);

    if (sourcesToTry.length === 0) {
      loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 没有任何可用的下载源！(包括 GitHub 直连尝试后)`);
      return { success: false, nodeName: '无可用源', error: lastError };
    }

    loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 开始尝试列表: ${sourcesToTry.map(s => s.name).join(', ')}`);

    for (const source of sourcesToTry) {
      // 如果是 GitHub 源，之前已经成功尝试过直连（无论成功失败），则跳过这次循环
      // 为了避免在 GitHub 直连失败后，又通过代理列表轮到 GitHub 时再次尝试直连。
      if (source.name === 'GitHub' && githubDirectAttempted) {
          loggerInstance.debug(`${logPrefix} [下载流程 ${repoName}] 已优先尝试过 GitHub 直连，跳过本次列表中的 GitHub 源。`);
          continue;
      }

      const nodeName = source.name === 'GitHub' ? 'GitHub(直连)' : `${source.name}(代理)`;
      loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 尝试使用源: ${nodeName}`);

      let cloneUrl = '';
      let proxyForEnv = null;
      if (source.name === 'GitHub') {
        cloneUrl = repoUrl;
      } else if (source.cloneUrlPrefix) {
        if (source.name === 'GitClone') {
          cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl.replace(/^https?:\/\//, '')}`;
        } else {
          cloneUrl = `${source.cloneUrlPrefix.replace(/\/$/, '')}/${repoUrl}`;
        }
        try {
          const proxyUrl = new URL(source.cloneUrlPrefix);
          if (['http:', 'https:'].includes(proxyUrl.protocol)) proxyForEnv = proxyUrl.origin;
        } catch (urlError) {
          loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 无法解析代理 ${source.name} 的 cloneUrlPrefix: ${urlError.message}`);
        }
      } else {
        loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 源 ${source.name} 没有 cloneUrlPrefix，跳过。`);
        continue;
      }

      const cloneArgs = ['clone', `--depth=${Default_Config.gitCloneDepth}`, '--progress', cloneUrl, localPath];
      const gitOptions = { cwd: MiaoPluginMBT.paths.YunzaiPath, shell: false };
      if (proxyForEnv) {
        gitOptions.env = { ...process.env, HTTP_PROXY: proxyForEnv, HTTPS_PROXY: proxyForEnv };
        loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 为 Git 命令设置代理: ${proxyForEnv}`);
      }

      try {
        let progressReported = { 10: false, 50: false, 90: false };
        await ExecuteCommand(
          'git', cloneArgs, gitOptions, Default_Config.gitCloneTimeout,
          stderrChunk => { // 进度报告
            if (repoNum === 1 && eForProgress) {
              const match = stderrChunk.match(/Receiving objects:\s*(\d+)%/);
              if (match?.[1]) {
                const progress = parseInt(match[1], 10);
                [10, 50, 90].forEach(t => {
                  if (progress >= t && !progressReported[t]) {
                    progressReported[t] = true;
                    eForProgress.reply(`『咕咕牛』${repoName} (${nodeName}) 下载: ${t}%...`).catch(() => {});
                  }
                });
              }
            } else if (repoNum !== 1) {
              const match = stderrChunk.match(/(Receiving objects|Resolving deltas):\s*(\d+)%/);
              if (match) loggerInstance.debug(`${logPrefix} [下载进度 ${repoName}] (${nodeName}) ${match[1]}: ${match[2]}%`);
            }
          }
        );
        loggerInstance.info(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载成功！`);
        return { success: true, nodeName: nodeName };
      } catch (error) {
        loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 使用源 ${nodeName} 下载失败。`);
        loggerInstance.error(error);
        lastError = error;
        loggerInstance.warn(`${logPrefix} [下载流程 ${repoName}] 尝试清理失败下载产生的目录: ${localPath}`);
        await safeDelete(localPath);
        await common.sleep(1000);
        loggerInstance.warn(`${logPrefix} 使用源 ${nodeName} 下载 ${repoName} 失败，尝试下一个源...`);
      }
    }

    loggerInstance.error(
      `${logPrefix} [下载流程 ${repoName}] 尝试了所有可用源 (${sourcesToTry.map(s => s.name).join(', ')})，均下载失败！`
    );
    if (repoNum === 1 && eForProgress) {
      await MiaoPluginMBT.ReportError(
        eForProgress,
        `下载${repoName}`,
        lastError || new Error('所有源下载失败'),
        `尝试源: ${sourcesToTry.map(s => s.name).join(', ')}`,
        loggerInstance
      );
    } else {
      loggerInstance.error(`${logPrefix} [下载流程 ${repoName}] 最终错误:`, lastError || '未知错误');
    }
    return { success: false, nodeName: '所有源失败', error: lastError };
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
        } else if (pullOutput.includes('Already up to date')) {
          logger.info(`${Default_Config.logPrefix} [更新仓库] ${RepoName} 已是最新。`)
          latestLog = await MiaoPluginMBT.GetTuKuLog(1, localPath, logger)
        } else {
          logger.warn(`${Default_Config.logPrefix} [更新仓库] ${RepoName} pull 成功但未检测到明确更新，获取最新日志...`)
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
      } else {
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
      } else {
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
      } else {
        logger.info(`${Default_Config.logPrefix} [更新后设置] 图库已禁用，跳过角色图片同步。`)
      }
    } catch (error) {
      logger.error(`${Default_Config.logPrefix} [更新后设置] 执行过程中发生错误:`, error)
      if (!isScheduled && e) await MiaoPluginMBT.ReportError(e, '更新后设置', error, '', logger)
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
    logger.info(`${Default_Config.logPrefix} [同步角色] 开始复制 (${MiaoPluginMBT.#imgDataCache.length}元数据)...`)
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
    if (!targetPluginDir) return;
    logger.info(`${Default_Config.logPrefix} [清理目标] ${targetPluginDir}`);
    let cleanedCount = 0;
    try {
      await fsPromises.access(targetPluginDir);
      const entries = await fsPromises.readdir(targetPluginDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = path.join(targetPluginDir, entry.name);
        if (entry.isDirectory()) {
          // 如果是子目录（角色目录）
          const characterPath = entryPath;
          try {
            const files = await fsPromises.readdir(characterPath);
            const filesToDelete = files.filter(
              f => f.toLowerCase().includes('gu') && f.toLowerCase().endsWith('.webp')
            );
            for (const fileToDelete of filesToDelete) {
              const filePath = path.join(characterPath, fileToDelete);
              try {
                await fsPromises.unlink(filePath);
                cleanedCount++;
                // logger.debug(`${Default_Config.logPrefix} [清理目标] 已删除: ${filePath}`); // 调试用
              } catch (unlinkErr) {
                if (unlinkErr.code !== ERROR_CODES.NotFound)
                  logger.warn(`${Default_Config.logPrefix} [清理目标] 删除文件 ${filePath} 失败:`, unlinkErr.code);
              }
            }
          } catch (readSubErr) {
            if (![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readSubErr.code))
              logger.warn(`${Default_Config.logPrefix} [清理目标] 读取角色子目录 ${characterPath} 失败:`, readSubErr.code);
          }
        } else if (
  
          entry.isFile() &&
          entry.name.toLowerCase().includes('gu') && 
          entry.name.toLowerCase().endsWith('.webp')
        ) {
          const rootFilePath = entryPath;
          try {
            await fsPromises.unlink(rootFilePath);
            cleanedCount++;
            // logger.debug(`${Default_Config.logPrefix} [清理目标] 已删除根目录文件: ${rootFilePath}`); // 调试用
          } catch (delErr) {
            if (delErr.code !== ERROR_CODES.NotFound)
              logger.warn(`${Default_Config.logPrefix} [清理目标] 删除根目录文件 ${rootFilePath} 失败:`, delErr.code);
          }
        }
      }
      logger.info(`${Default_Config.logPrefix} [清理目标] 清理完成: ${targetPluginDir}, 共清理 ${cleanedCount} 个包含 'Gu' 的 .webp 文件。`);
    } catch (readBaseErr) {
      if (readBaseErr.code !== ERROR_CODES.NotFound && readBaseErr.code !== ERROR_CODES.Access)
        logger.error(`${Default_Config.logPrefix} [清理目标] 读取目标插件目录 ${targetPluginDir} 失败:`, readBaseErr);
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

  static getScaleStyleValue(baseScale = 1) { 
    const scalePercent = MiaoPluginMBT.MBTConfig?.renderScale ?? Default_Config.renderScale;
    const scaleFactor = Math.min(2, Math.max(0.5, (Number(scalePercent) || 100) / 100));
    const finalScale = baseScale * scaleFactor;
    return `transform:scale(${finalScale}); transform-origin: top left;`;
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
            logger.warn(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 超时 (>${timeoutDuration}ms)`)
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
      return pkg.version || '4.8.4'
    } catch {
      return '4.8.4'
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
  { reg: /^#咕咕牛(开启|关闭)PM18\s*.+$/i, fnc: 'PM18IMGOP', permission: 'master' },
  { reg: /^#咕咕牛封禁\s*.+$/i, fnc: 'ManageUserBans', permission: 'master' },
  { reg: /^#咕咕牛解禁\s*.+$/i, fnc: 'ManageUserBans', permission: 'master' },
  { reg: /^#(?:ban|咕咕牛封禁)列表$/i, fnc: 'ManageUserBans' },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: 'ExportSingleImage' },
  { reg: /^#查看\s*.+$/i, fnc: 'FindRoleSplashes' },
  { reg: /^#可视化\s*.+$/i, fnc: 'VisualizeRoleSplashes' },
  { reg: /^#咕咕牛帮助$/i, fnc: 'Help' },
  { reg: /^#咕咕牛$/i, fnc: 'PluginInfo' },
  {
    reg: /^#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?$/i,
    fnc: 'TriggerError',
    permission: 'master',
  },
  { reg: /^#咕咕牛测速$/i, fnc: 'ManualTestProxies' },
  { reg: /^#执行咕咕牛更新$/i, fnc: 'ManualRunUpdateTask', permission: 'master' },
  { reg: /^#(咕咕牛设置|咕咕牛面板)$/i, fnc: 'ShowSettingsPanel' },
]
