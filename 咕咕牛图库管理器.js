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
 * @version 4.9.1
 * @based v4.8.4 & v4.8.8 & v4.8.9
 * @description_details
 *    - 支持多仓库存储与管理。
 *    - 提供 Ai 图、彩蛋图、横屏图的全局开关。
 *    - 修复了多个命令执行流程与截图渲染问题。
 *    - 优化了配置加载与保存逻辑，增强了并发处理能力。
 *    - 统一了设置类命令的交互方式。
 *    - 优化了图片下载逻辑，提高了下载速度与稳定性。
 *    - 修复了部分命令执行逻辑问题。
 *    - 增加特殊图片的处理。
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const YunzaiPath = path.resolve(__dirname, "..", "..");
const Purify_Level = {
  NONE: 0,
  RX18_ONLY: 1,
  PX18_PLUS: 2,
  getDescription: (level) =>
    ({ 0: "不过滤", 1: "过滤R18", 2: "全部敏感项" }[level] ?? "未知"),
};

const RAW_URL_Repo1 ="https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main";
const Default_Config = {
  Main_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT/",
  Ass_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-2/",
  Sexy_Github_URL: "https://github.com/GuGuNiu/Miao-Plugin-MBT-3/",

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
    { name: "GitHub", priority: 300, testUrlPrefix: RAW_URL_Repo1, cloneUrlPrefix: "https://github.com/" }
  ],
  proxyTestFile: "/README.md",
  proxyTestTimeout: 5000,
  gitCloneTimeout: 600000,
  gitPullTimeout: 120000,
  gitCloneDepth: 1,
  cronUpdate: "0 5 */3 * *",
  defaultTuKuOp: true,
  defaultPfl: Purify_Level.NONE,
  logPrefix: "『咕咕牛🐂』",
  gitLogFormat: "%cd [%h] %s",
  gitLogDateFormat: "format:%m-%d %H:%M",
  renderScale: 300,
};

const ERROR_CODES = {
  NotFound: "ENOENT",
  Access: "EACCES",
  Busy: "EBUSY",
  Perm: "EPERM",
  NotEmpty: "ENOTEMPTY",
  ConnReset: "ECONNRESET",
  Timeout: "ETIMEDOUT",
  Exist: "EEXIST",
};
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
  // **下载完成报告相关 (ID 21-23)**
  { id: 21, name: "报告: 下载完成-核心成功,附属部分失败", category: "核心图片报告模拟",description: "生成并发送一张模拟的“下载完成报告”：核心库成功，一个附属库失败，一个已存在。",type: "SIMULATE_REPORT_DL_FINAL_MIXED_RESULT" },
  { id: 22, name: "报告: 下载完成-全部失败", category: "核心图片报告模拟",description: "生成并发送一张模拟的“下载完成报告”：所有尝试的仓库均下载失败。",type: "SIMULATE_REPORT_DL_FINAL_ALL_FAIL" },
  { id: 23, name: "报告: 下载完成-全部成功", category: "核心图片报告模拟", description: "生成并发送一张模拟的“下载完成报告”：所有配置的仓库均下载成功。",  type: "SIMULATE_REPORT_DL_FINAL_ALL_SUCCESS" },

  // **更新完成报告相关 (ID 30-35)**
  { id: 30, name: "报告: 更新完成-无变化", category: "核心图片报告模拟",description: "生成并发送一张模拟的“更新完成报告”：所有仓库均已是最新，无任何文件变更。",type: "SIMULATE_REPORT_UP_FINAL_NO_CHANGES"},
  { id: 31, name: "报告: 更新完成-核心有变(常规),附属无变", category: "核心图片报告模拟",description: "生成并发送一张模拟的“更新完成报告”：核心库有新的常规更新，附属库无变化。",type: "SIMULATE_REPORT_UP_FINAL_CORE_CHANGED_NORMAL"},
  { id: 32, name: "报告: 更新完成-核心强制同步,附属OK", category: "核心图片报告模拟",description: "生成并发送一张模拟的“更新完成报告”：核心库因冲突被强制同步 (reset --hard)，附属库正常更新或无变化。",type: "SIMULATE_REPORT_UP_FINAL_CORE_FORCED_SYNC"},
  { id: 33, name: "报告: 更新完成-核心失败,附属成功", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：核心库更新失败，附属库更新成功。", type: "SIMULATE_REPORT_UP_FINAL_CORE_FAIL_ASSIST_OK"},
  { id: 34, name: "报告: 更新完成-全部失败", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：所有仓库均更新失败。", type: "SIMULATE_REPORT_UP_FINAL_ALL_FAIL"},
  { id: 35, name: "报告: 更新完成-全部有变(常规)", category: "核心图片报告模拟", description: "生成并发送一张模拟的“更新完成报告”：所有配置的仓库均有新的常规更新。", type: "SIMULATE_REPORT_UP_FINAL_ALL_CHANGED_NORMAL"},
  
  // --- 其他业务逻辑状态 (ID 50+) ---
  { id: 50, name: "逻辑: 截图过程返回空值", category: "业务逻辑状态", description: "模拟任何截图操作后，Puppeteer 未抛错但返回了 null/undefined (可能是空白图)。预期：插件记录错误，可能回复用户生成失败。", type: "SIMULATE_LOGIC_RENDER_BLANK_IMAGE"},
  { id: 51, name: "逻辑: 配置文件恢复并通知", category: "业务逻辑状态", description: "模拟配置加载时触发恢复，成功恢复并(尝试)通知主人。预期：日志记录，主人收到私聊。", type: "SIMULATE_LOGIC_CONFIG_RECOVER_NOTIFY"}
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
        @font-face {
            font-family: 'CuteFont';
            src: local('Yuanti SC'), 
                 local('YouYuan'), 
                 local('Microsoft YaHei UI Rounded'), 
                 local('Arial Rounded MT Bold'),
                 local('Microsoft YaHei UI'),
                 local('PingFang SC'), 
                 sans-serif;
            font-weight: normal;
            font-style: normal;
        }

        body {
            font-family: 'CuteFont', sans-serif;
            width:520px;
            margin: 20px auto;
            padding: 30px;
            background: linear-gradient(145deg, #e6f0ff 0%, #f0f9ff 100%);
            color: #333;
            font-size: 14px;
            line-height: 1.6;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><polygon points="40,10 70,30 70,50 40,70 10,50 10,30" fill="none" stroke="rgba(0, 172, 230, 0.25)" stroke-width="1"/><circle cx="40" cy="40" r="3" fill="rgba(255, 105, 180, 0.3)"/></svg>') repeat;
            opacity: 0.2;
            z-index: -1;
        }

        body::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="20" cy="20" r="4" fill="rgba(0, 230, 118, 0.2)"/><circle cx="80" cy="80" r="3" fill="rgba(255, 193, 7, 0.2)"/></svg>') repeat;
            opacity: 0.15;
            z-index: -1;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 0 20px rgba(0, 172, 230, 0.2);
            border: 1px solid #b3e0ff;
            position: relative;
            overflow: hidden;
        }

        .container::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><line x1="0" y1="60" x2="120" y2="60" stroke="rgba(0, 172, 230, 0.15)" stroke-width="0.5"/><line x1="60" y1="0" x2="60" y2="120" stroke="rgba(255, 105, 180, 0.15)" stroke-width="0.5"/></svg>') repeat;
            opacity: 0.1;
            transform: rotate(45deg);
            z-index: -1;
        }

        h1 {
            text-align: center;
            color: #00acc1;
            margin: 0 0 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #4fc3f7;
            font-size: 26px;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(0, 172, 230, 0.3);
            position: relative;
        }

        h2 {
            color: #0288d1;
            margin: 15px 0 10px;
            border-left: 4px solid #ff4081;
            padding-left: 10px;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
        }

        h2 .icon {
            margin-right: 6px;
            font-size: 18px;
            color: #ff4081;
            text-shadow: 0 0 3px rgba(255, 105, 180, 0.3);
        }

        ul {
            list-style: none;
            padding: 0;
            margin: 8px 0 0;
        }

        li {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e0f0ff;
            min-height: 20px;
        }

        li:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .node-name {
            color: #555;
            margin-right: 10px;
            white-space: nowrap;
            font-size: 0.95em;
            flex-basis: 150px;
            flex-shrink: 0;
        }

        .node-status {
            font-weight: bold;
            color: #0277bd;
            text-align: right;
            font-size: 0.9em;
            flex-grow: 1;
        }

        .status-ok {
            color: #00c853;
            background: rgba(0, 200, 83, 0.1);
            padding: 2px 5px;
            border-radius: 3px;
        }


        .status-timeout {
            color: #d81b60;
            background: rgba(255, 105, 180, 0.1);
            padding: 2px 5px;
            border-radius: 3px;
        }

        .status-na {
            color: #78909c;
            background: rgba(120, 144, 156, 0.1);
            padding: 2px 5px;
            border-radius: 3px;
        }

        .priority {
            color: #78909c;
            font-size: 0.85em;
            margin-left: 8px;
            font-weight: normal;
        }

        .best-choice {
            margin-top: 20px;
            padding: 15px;
            border-radius: 6px;
            background: linear-gradient(to bottom, #f5faff, #e6f0ff);
            border: 1px solid #00acc1;
            box-shadow: 0 0 10px rgba(0, 172, 230, 0.2);
            position: relative;
            overflow: hidden;
            text-align: center;
            font-size: 1em;
            color: #00c853;
            font-weight: bold;
        }

        .best-choice::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><polygon points="20,5 35,20 20,35 5,20" fill="none" stroke="rgba(255, 105, 180, 0.2)" stroke-width="0.5"/></svg>') repeat;
            opacity: 0.2;
            z-index: -1;
        }

        .best-choice .icon {
            margin-right: 6px;
            font-size: 1em;
            color: #ff4081;
            text-shadow: 0 0 3px rgba(255, 105, 180, 0.3);
        }

        .footer {
            text-align: center;
            margin-top: 25px;
            font-size: 0.8em;
            color: #78909c;
            border-top: 1px solid #e0f0ff;
            padding-top: 10px;
            position: relative;
        }
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
        <div class="best-choice">
            <span class="icon">✅</span>优选: {{ best1Display }}
        </div>
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
        @font-face {
            font-family: 'CuteFont';
            src: local('Yuanti SC'),
                 local('YouYuan'),
                 local('Microsoft YaHei UI Rounded'),
                 local('Arial Rounded MT Bold'),
                 local('Microsoft YaHei UI'),
                 local('PingFang SC'),
                 sans-serif;
            font-weight: normal;
            font-style: normal;
        }

        body {
            font-family: 'CuteFont', sans-serif;
            width: 550px;
            margin: 20px auto;
            padding: 20px;
            background: linear-gradient(145deg, #e6f0ff 0%, #f0f9ff 100%);
            color: #333;
            font-size: 14px;
            line-height: 1.6;
            box-sizing: border-box;
            position: relative;
            overflow: hidden;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 16px;
            padding: 25px;
            box-shadow: 0 0 20px rgba(0, 172, 230, 0.2);
            border: 1px solid #b3e0ff;
            position: relative;
            z-index: 1;
        }

        .container::before {
            content: '🌿';
            position: absolute;
            top: 15px;
            left: 15px;
            font-size: 24px;
            opacity: 0.5;
        }

        .container::after {
            content: '🌱';
            position: absolute;
            bottom: 15px;
            right: 15px;
            font-size: 24px;
            opacity: 0.5;
            transform: rotate(15deg);
        }

        h1 {
            text-align: center;
            color: #00acc1;
            margin: 0 0 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #4fc3f7;
            font-size: 26px;
            font-weight: bold;
            text-shadow: 0 0 5px rgba(0, 172, 230, 0.3);
            position: relative;
        }

        .repo-section {
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 12px;
            background: linear-gradient(to bottom, #f5faff, #ffffff);
            border: 1px solid #b3e0ff;
            box-shadow: 0 0 10px rgba(0, 172, 230, 0.2);
        }

        .repo-section.subsidiary {
            border: 1px solid #ff4081;
            box-shadow: 0 0 10px rgba(255, 105, 180, 0.2);
        }

        .repo-title {
            color: #0288d1;
            margin: 0 0 10px;
            border-left: 4px solid #ff4081;
            padding-left: 10px;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            align-items: center;
        }

        .repo-title .icon {
            margin-right: 5px;
            vertical-align: -3px;
            font-size: 17px;
            color: #ff4081;
        }

        .repo-section.subsidiary .repo-title {
            color: #ff4081;
            border-left-color: #00acc1;
        }

        .repo-section.subsidiary .repo-title .icon {
            color: #00acc1;
        }

        .status-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f4f8;
            min-height: 18px;
        }

        .status-line:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .status-label {
            color: #555;
            margin-right: 8px;
            white-space: nowrap;
            font-size: 0.95em;
        }

        .status-value {
            font-weight: bold;
            color: #0277bd;
            font-size: 0.95em;
        }

        .status-ok {
            color: #00c853;
        }

        .status-fail {
            color: #d81b60;
        }

        .status-local {
            color: #0288d1;
        }

        .status-na {
            color: #78909c;
        }

        .error-details {
            font-size: 12px;
            white-space: pre-wrap;
            word-break: break-all;
            color: #d81b60;
            margin-top: 5px;
            padding: 8px;
            background-color: rgba(255, 105, 180, 0.1);
            border-radius: 6px;
            border-left: 3px solid #d81b60;
        }

        .log-details {
            margin-top: 8px;
        }

        .log-details h3 {
            color: #333;
            margin-bottom: 5px;
            font-size: 14px;
            font-weight: 500;
        }

        .log-content {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            font-
            white-space: pre-wrap;
            word-break: break-all;
            background-color: #f9f9f9;
            padding: 10px;
            border-radius: 6px;
            max-height: 90px;
            overflow-y: auto;
            border: 1px solid #eee;
            font-weight: bold;
        }

        .log-content:empty::before {
            content: "(无相关日志记录)";
            color: #aaa;
            font-style: italic;
        }

        .footer {
            text-align: center;
            margin-top: 25px;
            font-size: 0.8em;
            color: #78909c;
            border-top: 1px solid #e0f0ff;
            padding-top: 10px;
        }
    </style>
</head>
<body style="{{scaleStyleValue}}">
    <div class="container">
        <h1>咕咕牛图库下载完成报告</h1>
        {{ if coreRepoResult }}
        <div class="repo-section core">
            <div class="repo-title"><span class="icon">📦</span>核心仓库 (一号)</div>
            <div class="status-line"> <span class="status-label">状态:</span> <span class="status-value {{ coreRepoResult.success ? 'status-ok' : 'status-fail' }}">{{ coreRepoResult.success ? '下载成功' : '下载失败' }} {{ coreRepoResult.success ? '✅' : '❌' }}</span> </div>
            <div class="status-line"> <span class="status-label">节点:</span> <span class="status-value {{ coreRepoResult.nodeName === '本地' ? 'status-local' : (coreRepoResult.success ? 'status-ok' : 'status-fail') }}">{{ coreRepoResult.nodeName }}</span> </div>
            {{ if coreRepoResult.error }}
            <div class="error-details">{{ coreRepoResult.error.message || '未知错误' }}</div>
            {{ /if }}
            {{ if gitLog1 }}
            <div class="log-details">
                <h3>最新:</h3>
                <pre class="log-content">{{ gitLog1 }}</pre>
            </div>
            {{ /if }}
        </div>
        {{ /if }}
        {{ if subsidiaryResults && subsidiaryResults.length > 0 }}
        <div class="repo-section subsidiary">
            <div class="repo-title"><span class="icon">📦</span>附属仓库</div>
            {{ each subsidiaryResults subRes }}
            <div class="status-line"> <span class="status-label">{{ subRes.repo === 2 ? '二号仓库' : (subRes.repo === 3 ? '三号仓库' : subRes.repo + '号仓库') }}:</span> <span class="status-value {{ subRes.nodeName === '本地' ? 'status-local' : (subRes.nodeName === '未配置' ? 'status-na' : (subRes.success ? 'status-ok' : 'status-fail')) }}">{{ subRes.nodeName === '本地' ? '已存在' : (subRes.nodeName === '未配置' ? '未配置' : (subRes.success ? '下载成功 (' + subRes.nodeName + ')' : '下载失败 (' + subRes.nodeName + ')')) }} {{ subRes.success ? '✅' : (subRes.nodeName === '未配置' || subRes.nodeName === '本地' ? '' : '❌') }}</span> </div>
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

// ========================================================================= //
// ========================= 公共工具函数区域 =============================== //
// ========================================================================= //
/**
 * @description 安全地递归删除文件或目录，带重试逻辑。
 */
async function safeDelete(targetPath, maxAttempts = 3, delay = 1000) {
  let attempts = 0;
  const logger = global.logger || console;
  while (attempts < maxAttempts) {
    try {
      await fsPromises.rm(targetPath, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (err.code === ERROR_CODES.NotFound) return true;
      if (
        [ERROR_CODES.Busy, ERROR_CODES.Perm, ERROR_CODES.NotEmpty].includes(
          err.code
        )
      ) {
        attempts++;
        if (attempts >= maxAttempts) {
          logger.error(
            `${Default_Config.logPrefix} [安全删除] ${targetPath} 最终失败 (${attempts}次): ${err.code}`
          );
          throw err;
        }
        logger.warn(
          `${
            Default_Config.logPrefix
          } [安全删除] ${targetPath} 失败 (${attempts}/${maxAttempts}): ${
            err.code
          }, ${delay / 1000}s 后重试...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(
          `${Default_Config.logPrefix} [安全删除] ${targetPath} 遇到未处理异常:`,
          err
        );
        throw err;
      }
    }
  }
  return false;
}

/**
 * @description 通用的递归复制文件夹函数，按扩展名过滤。
 */
async function copyFolderRecursive(
  source,
  target,
  options = {},
  logger = global.logger || console
) {
  const { ignoreSet = new Set(), filterExtension = null } = options;
  const normalizedFilterExt = filterExtension
    ? filterExtension.toLowerCase()
    : null;

  try {
    await fsPromises.access(source);
  } catch (err) {
    if (err.code === ERROR_CODES.NotFound) return;
    logger.error(
      `${Default_Config.logPrefix} [递归复制] 源访问失败 ${source}:`,
      err
    );
    throw err;
  }

  try {
    await fsPromises.mkdir(target, { recursive: true });
    const entries = await fsPromises.readdir(source, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (ignoreSet.has(entry.name) || entry.name === ".git") return;

        const currentSource = path.join(source, entry.name);
        const currentTarget = path.join(target, entry.name);

        try {
          if (entry.isDirectory()) {
            await copyFolderRecursive(
              currentSource,
              currentTarget,
              options,
              logger
            );
          } else if (entry.isFile()) {
            const shouldCopy =
              !normalizedFilterExt ||
              entry.name.toLowerCase().endsWith(normalizedFilterExt);
            if (shouldCopy) {
              try {
                await fsPromises.copyFile(
                  currentSource,
                  currentTarget,
                  fs.constants.COPYFILE_FICLONE
                );
              } catch (cloneError) {
                if (
                  cloneError.code === "ENOSYS" ||
                  cloneError.code === "EXDEV"
                ) {
                  await fsPromises.copyFile(currentSource, currentTarget);
                } else {
                  throw cloneError;
                }
              }
            }
          }
        } catch (itemError) {
          if (
            ![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(itemError.code)
          ) {
            logger.warn(
              `${Default_Config.logPrefix} [递归复制] 处理 ${entry.name} 出错:`,
              itemError.code
            );
          }
        }
      })
    );
  } catch (error) {
    if (
      ![ERROR_CODES.Exist, ERROR_CODES.Access, ERROR_CODES.Perm].includes(
        error.code
      )
    ) {
      logger.error(
        `${Default_Config.logPrefix} [递归复制] 操作失败 ${source} -> ${target}:`,
        error
      );
    } else if (error.code !== ERROR_CODES.Exist) {
      logger.warn(
        `${Default_Config.logPrefix} [递归复制] 操作警告 ${source} -> ${target}:`,
        error.code
      );
    }
  }
}

/**
 * @description 执行外部命令，处理流，支持超时和信号终止。
 *              内部 stderr 处理会过滤控制台输出，但原始数据仍传递给 onStdErr 回调。
 */
function ExecuteCommand(
  command,
  args,
  options = {},
  timeout = 0,
  onStdErr, // 外部传入的 stderr 处理器
  onStdOut // 外部传入的 stdout 处理器
) {
  return new Promise((resolve, reject) => {
    const logger = global.logger || console;
    const isClone = command === "git" && args.includes("clone");
    if (isClone && !args.includes("--verbose")) {
      const cloneIndex = args.indexOf("clone");
      args.splice(cloneIndex + 1, 0, "--verbose");
    }
    const cmdStr = `${command} ${args.join(" ")}`;
    const cwd = options.cwd || process.cwd();


    // 保持 Git 调试环境变量的设置
    const gitDebugEnv = {
      GIT_CURL_VERBOSE: "1",
      GIT_TRACE: "1",
      GIT_PROGRESS_DELAY: "0", // 确保进度条及时
    };
    options.env = { ...process.env, ...(options.env || {}), ...gitDebugEnv };

    let proc;
    try {
      proc = spawn(command, args, { stdio: "pipe", ...options, shell: false });
    } catch (spawnError) {
      logger.error(
        `${Default_Config.logPrefix} [执行命令] 启动失败 [${cmdStr}]:`,
        spawnError
      );
      return reject(spawnError);
    }

    let stdout = "";
    let stderr = "";
    let timer = null;
    let killed = false;
    let exited = false;
    let promiseSettled = false;
    let lastStderrChunk = ""; // 仍然跟踪 lastStderrChunk

    const settlePromise = (resolver, value) => {
      if (promiseSettled) return;
      promiseSettled = true;
      clearTimeout(timer);
      resolver(value);
    };

    const killProc = (signal = "SIGTERM") => {
      if (proc && proc.pid && !killed && !exited && !proc.killed) {
        logger.warn(
          `${Default_Config.logPrefix} [执行命令] 发送 ${signal} 到 ${proc.pid} (${cmdStr})`
        );
        try {
          if (process.platform !== "win32") {
            process.kill(-proc.pid, signal);
          } else {
            process.kill(proc.pid, signal);
          }
          if (signal === "SIGKILL") killed = true;
        } catch (killError) {
          if (killError.code !== "ESRCH") {
            logger.error(
              `${Default_Config.logPrefix} [执行命令] kill ${proc.pid} (或进程组) 失败:`,
              killError
            );
          } else {
            logger.warn(
              `${Default_Config.logPrefix} [执行命令] kill ${proc.pid} 时进程已不存在 (ESRCH)`
            );
          }
          killed = true;
        }
      }
    };

    if (timeout > 0) {
      timer = setTimeout(() => {
        if (exited || promiseSettled) return;
        killed = true;
        logger.warn(
          `${Default_Config.logPrefix} [执行命令] 命令 [${cmdStr}] 超时 (${timeout}ms)，终止...`
        );
        killProc("SIGTERM");
        setTimeout(() => {
          if (!exited && !promiseSettled) {
            logger.warn(
              `${Default_Config.logPrefix} [执行命令] SIGTERM 后进程未退出，发送 SIGKILL...`
            );
            killProc("SIGKILL");
          }
        }, 3000);

        const err = new Error(
          `Command timed out after ${timeout}ms: ${cmdStr}`
        );
        err.code = ERROR_CODES.Timeout;
        err.stdout = stdout;
        err.stderr =
          stderr + `\n[Last Stderr Chunk Before Timeout]:\n${lastStderrChunk}`;
        settlePromise(reject, err);
      }, timeout);
    }

    const handleOutput = (streamName, data, externalCallback) => {
      if (exited || killed || promiseSettled) return;
      const outputChunk = data.toString();

      if (streamName === "stdout") {
        stdout += outputChunk;
      } else {
        // streamName === "stderr"
        stderr += outputChunk; // 始终累加所有 stderr 数据到 stderr 变量
        lastStderrChunk = outputChunk;

        const शांतLogPrefixes = [
          "trace:",
          "http.c:",
          "== Info:",
          "   Trying",
          " Connected to",
          " CONNECT tunnel:",
          " allocate connect buffer",
          " Establish HTTP proxy tunnel",
          " Send header:",
          " Recv header:",
          " CONNECT phase completed",
          " CONNECT tunnel established",
          " ALPN:",
          " TLSv1.",
          " SSL connection using",
          " Server certificate:",
          "  subject:",
          "  start date:",
          "  expire date:",
          "  subjectAltName:",
          "  issuer:",
          "  SSL certificate verify ok.",
          "   Certificate level",
          " using HTTP/",
          " [HTTP/",
          " Request completely sent off",
          " old SSL session ID is stale",
          " Connection #",
          " Found bundle for host",
          " Re-using existing connection",
          " upload completely sent off",
          // " remote: Enumerating objects:", // 这些是进度，外部回调会处理
          // " remote: Counting objects:",
          // " remote: Compressing objects:",
          // " remote: Total",
        ];
        let isDetailedDebugLogForConsole = false;
        const trimmedChunk = outputChunk.trim();
        for (const prefix of शांतLogPrefixes) {
          if (trimmedChunk.startsWith(prefix)) {
            isDetailedDebugLogForConsole = true;
            break;
          }
        }
        // 明确的Git错误/警告，但不是那些调试前缀
        const isCriticalErrorForConsole =
          trimmedChunk.match(/^(fatal|error|warning):/i) &&
          !isDetailedDebugLogForConsole;

        // 只在控制台打印非调试日志或关键错误
        if (isCriticalErrorForConsole) {
          logger.error(`${Default_Config.logPrefix} [CMD ERR] ${trimmedChunk}`);
        } else if (
          !isDetailedDebugLogForConsole &&
          !trimmedChunk.match(
            /(Receiving objects|Resolving deltas|remote: Compressing objects|remote: Total|remote: Enumerating objects|remote: Counting objects):\s*(\d+)%/i
          ) && // 也排除进度信息
          trimmedChunk.length > 0
        ) {
         
        }
      }

      // 始终将原始的、未经过滤的 outputChunk 传递给外部的回调
      if (externalCallback) {
        try {
          externalCallback(outputChunk);
        } catch (e) {
          logger.warn(`${Default_Config.logPrefix} ${streamName} 回调出错:`, e);
        }
      }
    };

    proc.stdout?.on("data", (data) => handleOutput("stdout", data, onStdOut));
    proc.stderr?.on("data", (data) => handleOutput("stderr", data, onStdErr));

    proc.on("error", (err) => {
      if (promiseSettled) return;
      exited = true;
      logger.error(
        `${Default_Config.logPrefix} [执行命令] 进程错误 [${cmdStr}]:`,
        err
      );
      clearTimeout(timer);
      // 附加 stdout/stderr 到错误对象
      err.stdout = stdout;
      err.stderr = stderr;
      settlePromise(reject, err);
    });

    proc.on("close", (code, signal) => {
      if (exited || promiseSettled) return;
      exited = true;
      //logger.info(`${Default_Config.logPrefix} [执行命令] 进程关闭 [${cmdStr}] Code: ${code}, Signal: ${signal}`); //调试日志-精简
      clearTimeout(timer);

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
}

/**
 * @description 计算文件夹大小
 */
async function FolderSize(folderPath) {
  let totalSize = 0;
  const logger = global.logger || console;
  const queue = [folderPath];
  const visitedDirs = new Set();

  while (queue.length > 0) {
    const currentPath = queue.shift();
    if (visitedDirs.has(currentPath)) continue;
    visitedDirs.add(currentPath);

    try {
      const entries = await fsPromises.readdir(currentPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name);
        try {
          if (entry.isDirectory()) {
            queue.push(entryPath);
          } else if (entry.isFile()) {
            const stats = await fsPromises.stat(entryPath);
            totalSize += stats.size;
          }
        } catch (statError) {
          if (
            ![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(statError.code)
          ) {
          }
        }
      }
    } catch (readDirError) {
      if (
        ![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(readDirError.code)
      ) {
      }
    }
  }
  return totalSize;
}

/**
 * @description 格式化字节大小
 */
function FormatBytes(bytes, decimals = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return "? B";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  let i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i >= sizes.length) i = sizes.length - 1;
  const formattedValue =
    i === 0 ? bytes : parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${formattedValue} ${sizes[i]}`;
}

/**
 * @description 原生异步互斥锁，确保资源访问的原子性。
 */
class SimpleAsyncMutex {
  _locked = false;
  _waitQueue = [];

  acquire() {
    return new Promise((resolve) => {
      if (!this._locked) {
        this._locked = true;
        resolve();
      } else {
        this._waitQueue.push(resolve);
      }
    });
  }

  release() {
    if (this._waitQueue.length > 0) {
      const nextResolve = this._waitQueue.shift();
      if (nextResolve) {
        // 确保 nextResolve 存在
        nextResolve();
      } else {
        // 理论上不应发生，但作为防御
        this._locked = false;
      }
    } else {
      this._locked = false;
    }
  }

  /**
   * @description 以独占方式运行提供的回调函数。
   *              它会自动获取锁，执行回调，然后在回调完成后（无论成功还是失败）释放锁。
   * @param {Function} callback - 一个异步函数 (返回 Promise) 或同步函数，将在获取锁后执行。
   * @returns {Promise<any>} - 返回回调函数的执行结果。
   */
  async runExclusive(callback) {
    await this.acquire();
    try {
      return await callback();
    } finally {
      this.release();
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

  // --- 实例化锁 ---
  static configMutex = new SimpleAsyncMutex();
  // static banMutex = new SimpleAsyncMutex(); // 移除 banMutex
  static gitMutex = new SimpleAsyncMutex();

  /**
   * @description 存储所有重要的路径常量
   **/
 static paths = {
  YunzaiPath: YunzaiPath,
  LocalTuKuPath: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT"),
  gitFolderPath: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT", ".git"),
  LocalTuKuPath2: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-2"),
  gitFolderPath2: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-2", ".git"),
  LocalTuKuPath3: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-3"),
  gitFolderPath3: path.join(YunzaiPath, "resources", "Miao-Plugin-MBT-3", ".git"),
  commonResPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery"),
  configFilePath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "GalleryConfig.yaml"),
  imageDataPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "imagedata.json"),
  banListPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "banlist.json"),
  helpImagePath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "help.webp"),
  tempPath: path.join(YunzaiPath, "temp", "html", "guguniu"),
  tempHtmlPath: path.join(YunzaiPath, "temp", "html", "guguniu"),
  tempImgPath: path.join(YunzaiPath, "temp", "html", "guguniu", "img"),
  backgroundImgPath: path.join(YunzaiPath, "resources", "GuGuNiu-Gallery", "html", "img"),
  target: {
    miaoChar: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "profile", "normal-character"),
    zzzChar: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "resources", "images", "panel"),
    wavesChar: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "rolePic"),
    exampleJs: path.join(YunzaiPath, "plugins", "example"),
    miaoGsAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-gs", "character"),
    miaoSrAliasDir: path.join(YunzaiPath, "plugins", "miao-plugin", "resources", "meta-sr", "character"),
    zzzAliasDir: path.join(YunzaiPath, "plugins", "ZZZ-Plugin", "defset"),
    wavesAliasDir: path.join(YunzaiPath, "plugins", "waves-plugin", "resources", "Alias")
  },
  sourceFolders: {
    gs: "gs-character",
    sr: "sr-character",
    zzz: "zzz-character",
    waves: "waves-character",
    gallery: "GuGuNiu-Gallery"
  },
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
    { sourceSubPath: "GuGuNiu-Gallery/html/img", destFileName: "html/img", copyIfExists: true, isDir: true }
  ],
  filesToSyncSpecific: [
    { sourceSubPath: "咕咕牛图库管理器.js", destDir: path.join(YunzaiPath, "plugins", "example"), destFileName: "咕咕牛图库管理器.js" }
  ]
};

  // --- 实例属性 ---
  config = Default_Config;
  logPrefix = Default_Config.logPrefix;
  logger = global.logger || console;
  isPluginInited = false;
  task = null;

  constructor() {
    super({
      name: "『咕咕牛🐂』图库管理器 v4.9.1", 
      dsc: "『咕咕牛🐂』图库管理器",
      event: "message",
      priority: 500,
      rule: GUGUNIU_RULES,
    });
    this.task = {
      name: `${this.logPrefix} 定时更新`,
      cron: Default_Config.cronUpdate,
      fnc: () => this.RunUpdateTask(),
      log: false,
    };
    this._initializeInstance();
  }

  // --- 实例方法 ---
  /**
   * @description 实例初始化逻辑，确保全局初始化完成后再标记实例初始化成功。
   */
  async _initializeInstance() {
    if (
      !MiaoPluginMBT.initializationPromise &&
      !MiaoPluginMBT.isGloballyInitialized
    ) {
      MiaoPluginMBT.InitializePlugin(this.logger);
    }
    try {
      await MiaoPluginMBT.initializationPromise;
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
      if (
        this.isPluginInited &&
        this.task &&
        MiaoPluginMBT.MBTConfig.cronUpdate &&
        this.task.cron !== MiaoPluginMBT.MBTConfig.cronUpdate
      ) {
        this.logger.info(
          `${this.logPrefix} 更新 Cron 表达式: ${this.task.cron} -> ${MiaoPluginMBT.MBTConfig.cronUpdate}`
        );
        this.task.cron = MiaoPluginMBT.MBTConfig.cronUpdate;
      }
    } catch (initError) {
      this.logger.error(
        `${this.logPrefix} 实例等待全局初始化失败: ${initError.message}`
      );
      this.isPluginInited = false;
    }
  }

  /**
   * @description 手动触发更新任务，并检查通知主人逻辑。
   */
  async ManualRunUpdateTask(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) return e.reply("抱歉，只有主人才能手动执行此任务。");

    this.logger.info(
      `${this.logPrefix} 用户 ${e.user_id} 手动触发更新任务 (#执行咕咕牛更新) 以测试通知逻辑...`
    );
    await e.reply(
      `${this.logPrefix} 正在模拟定时更新流程，请稍候... (将检查是否触发通知主人)`,
      true
    );
    let overallHasChanges = false;
    let taskError = null;

    try {
      overallHasChanges = await this.UpdateTuKu(null, true);
      this.logger.info(
        `${this.logPrefix} 模拟定时更新任务的核心逻辑已完成。检测到更新: ${overallHasChanges}`
      );
    } catch (error) {
      taskError = error;
      this.logger.error(`${this.logPrefix} 模拟定时更新任务时发生错误:`, error);
      await this.ReportError(e, "模拟定时更新任务", error);
    }
    if (taskError) {
      await e.reply(
        `${this.logPrefix} 模拟定时更新执行时遇到错误，无法判断通知状态。`,
        true
      );
    } else {
      if (overallHasChanges) {
        await e.reply(
          `${this.logPrefix} 模拟定时更新检测到变更，已尝试向主人发送通知。 (请主人检查私聊)`,
          true
        );
      } else {
        await e.reply(
          `${this.logPrefix} 模拟定时更新未检测到变更，因此未发送通知。`,
          true
        );
      }
    }
    return true;
  }

  /**
   * @description 检查插件是否已成功初始化，并在未初始化时阻止命令执行。
   */
  async CheckInit(e) {
    if (
      !MiaoPluginMBT.initializationPromise &&
      !MiaoPluginMBT.isGloballyInitialized
    ) {
      this.logger.info(`${this.logPrefix} [核心检查] 首次触发，开始初始化...`);
      await this._initializeInstance();
    } else if (
      MiaoPluginMBT.initializationPromise &&
      !MiaoPluginMBT.isGloballyInitialized
    ) {
      this.logger.info(`${this.logPrefix} [核心检查] 初始化进行中，等待...`);
      try {
        await MiaoPluginMBT.initializationPromise;
        this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
      } catch (error) {
        this.logger.error(
          `${this.logPrefix} [核心检查] 等待初始化时捕获到错误:`,
          error.message || error
        );
        this.isPluginInited = false;
      }
    } else {
      this.isPluginInited = MiaoPluginMBT.isGloballyInitialized;
    }

    if (!this.isPluginInited) {
      await e.reply(
        `${this.logPrefix} 插件初始化失败或仍在进行中，请稍后再试。`,
        true
      );
      return false;
    }

    let coreDataValid = true;
    if (
      !MiaoPluginMBT.MBTConfig ||
      Object.keys(MiaoPluginMBT.MBTConfig).length === 0
    ) {
      this.logger.error(`${this.logPrefix} [核心检查] CRITICAL: 配置丢失！`);
      coreDataValid = false;
    }
    if (!Array.isArray(MiaoPluginMBT._imgDataCache)) {
      this.logger.error(
        `${this.logPrefix} [核心检查] CRITICAL: 元数据缓存无效！`
      );
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._userBanSet instanceof Set)) {
      this.logger.error(
        `${this.logPrefix} [核心检查] CRITICAL: 用户封禁列表无效！`
      );
      coreDataValid = false;
    }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) {
      this.logger.error(
        `${this.logPrefix} [核心检查] CRITICAL: 生效封禁列表无效！`
      );
      coreDataValid = false;
    }
    if (!MiaoPluginMBT._aliasData) {
      this.logger.error(
        `${this.logPrefix} [核心检查] CRITICAL: 别名数据丢失！`
      );
      coreDataValid = false;
    }

    if (!coreDataValid) {
      await e.reply(
        `${this.logPrefix} 内部状态错误，核心数据加载失败，请重启 Bot。`,
        true
      );
      return false;
    }

    if (MiaoPluginMBT._imgDataCache.length === 0) {
      this.logger.warn(
        `${this.logPrefix} [核心检查] 注意：图片元数据为空，部分功能可能受限。`
      );
    }

    return true;
  }

  /**
   * @description 实例方法，调用静态的 ReportError。
   */
  async ReportError(e, operationName, error, context = "") {
    await MiaoPluginMBT.ReportError(
      e,
      operationName,
      error,
      context,
      this.logger
    );
  }

  /**
   * @description 处理 #下载咕咕牛 命令，核心串行，附属并行下载，报告含初始日志。
   */
  async DownloadTuKu(e) {
    if (!(await this.CheckInit(e))) return true;

    const logPrefix = this.logPrefix;
    const logger = this.logger;
    const startTime = Date.now();
    let overallSuccess = false;
    let coreRepoResult = {
      repo: 1,
      success: false,
      nodeName: "未执行",
      error: null,
    };
    const subsidiaryResults = [];
    let gitLog1 = "",
      gitLog2 = "",
      gitLog3 = ""; // 用于存储初始日志

    try {
      const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
      const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
      let Repo2Exists = Repo2UrlConfigured
        ? await MiaoPluginMBT.IsTuKuDownloaded(2)
        : false;
      const Repo3UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Sexy_Github_URL;
      let Repo3Exists = Repo3UrlConfigured
        ? await MiaoPluginMBT.IsTuKuDownloaded(3)
        : false;
      let allDownloaded = Repo1Exists;
      if (Repo2UrlConfigured && !Repo2Exists) allDownloaded = false;
      if (Repo3UrlConfigured && !Repo3Exists) allDownloaded = false;
      if (allDownloaded) {
        return e.reply(`${logPrefix} 图库已存在`);
      }
      if (!Repo1Exists && (Repo2Exists || Repo3Exists)) {
        await e.reply(
          `${logPrefix} 状态异常！核心仓库未下载，但附属仓库已存在。建议先 #重置咕咕牛`
        );
        return true;
      }
      if (!Repo1Exists) {
        // logger.info(`${logPrefix} [核心下载] 开始下载核心仓库 (一号)...`);
        try {
          coreRepoResult = await MiaoPluginMBT.DownloadRepoWithFallback(
            1,
            Default_Config.Main_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch ||
              Default_Config.SepositoryBranch,
            MiaoPluginMBT.paths.LocalTuKuPath,
            e,
            logger
          );
          if (!coreRepoResult.success) {
            logger.error(`${logPrefix} [核心下载] 核心仓库下载失败。`);
            const failMsg = `『咕咕牛』核心仓库下载失败 (${coreRepoResult.nodeName})。请检查日志或网络后重试。`;
            if (coreRepoResult.error) {
              await this.ReportError(e, "下载核心仓库", coreRepoResult.error);
            } else {
              await e.reply(failMsg).catch(() => {});
            }
            return true;
          }
          // 核心下载成功后，获取其初始日志
          gitLog1 = await MiaoPluginMBT.GetTuKuLog(
            1,
            MiaoPluginMBT.paths.LocalTuKuPath,
            logger
          );
        } catch (err) {
          logger.error(
            `${logPrefix} [核心下载] 核心仓库下载过程中发生意外错误:`,
            err
          );
          coreRepoResult = {
            repo: 1,
            success: false,
            nodeName: "执行异常",
            error: err,
          };
          await this.ReportError(e, "下载核心仓库", coreRepoResult.error);
          return true;
        }
      } else {
        logger.info(`${logPrefix} [核心下载] 核心仓库已存在，跳过下载。`);
        coreRepoResult = {
          repo: 1,
          success: true,
          nodeName: "本地",
          error: null,
        };
        // 核心已存在，也获取其当前日志
        gitLog1 = await MiaoPluginMBT.GetTuKuLog(
          1,
          MiaoPluginMBT.paths.LocalTuKuPath,
          logger
        );
      }
      overallSuccess = coreRepoResult.success;
      const subsidiaryPromises = [];
      if (Repo2UrlConfigured && !Repo2Exists) {
        //logger.info(`${logPrefix} [核心下载] 添加附属仓库 (二号) 下载任务。`);
        subsidiaryPromises.push(
          MiaoPluginMBT.DownloadRepoWithFallback(
            2,
            MiaoPluginMBT.MBTConfig.Ass_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch ||
              Default_Config.SepositoryBranch,
            MiaoPluginMBT.paths.LocalTuKuPath2,
            null,
            logger
          )
            .then((result) => ({ repo: 2, ...result }))
            .catch((err) => {
              logger.error(
                `${logPrefix} [核心下载] 附属仓库 (二号) 下载 Promise 捕获到错误:`,
                err
              );
              return {
                repo: 2,
                success: false,
                nodeName: "执行异常",
                error: err,
              };
            })
        );
      } else if (Repo2UrlConfigured && Repo2Exists) {
        logger.info(`${logPrefix} [核心下载] 附属仓库 (二号) 已存在。`);
        subsidiaryResults.push({
          repo: 2,
          success: true,
          nodeName: "本地",
          error: null,
          gitLog: await MiaoPluginMBT.GetTuKuLog(
            1,
            MiaoPluginMBT.paths.LocalTuKuPath2,
            logger
          ),
        });
      } // 已存在也获取日志
      else {
        logger.info(`${logPrefix} [核心下载] 附属仓库 (二号) 未配置。`);
      }
      if (Repo3UrlConfigured && !Repo3Exists) {
        //logger.info(`${logPrefix} [核心下载] 添加附属仓库 (三号) 下载任务。`);
        subsidiaryPromises.push(
          MiaoPluginMBT.DownloadRepoWithFallback(
            3,
            MiaoPluginMBT.MBTConfig.Sexy_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch ||
              Default_Config.SepositoryBranch,
            MiaoPluginMBT.paths.LocalTuKuPath3,
            null,
            logger
          )
            .then((result) => ({ repo: 3, ...result }))
            .catch((err) => {
              logger.error(
                `${logPrefix} [核心下载] 附属仓库 (三号) 下载 Promise 捕获到错误:`,
                err
              );
              return {
                repo: 3,
                success: false,
                nodeName: "执行异常",
                error: err,
              };
            })
        );
      } else if (Repo3UrlConfigured && Repo3Exists) {
        logger.info(`${logPrefix} [核心下载] 附属仓库 (三号) 已存在。`);
        subsidiaryResults.push({
          repo: 3,
          success: true,
          nodeName: "本地",
          error: null,
          gitLog: await MiaoPluginMBT.GetTuKuLog(
            1,
            MiaoPluginMBT.paths.LocalTuKuPath3,
            logger
          ),
        });
      } // 已存在也获取日志
      else {
        logger.info(`${logPrefix} [核心下载] 附属仓库 (三号) 未配置。`);
      }
      if (subsidiaryPromises.length > 0) {
        await e.reply("『咕咕牛』附属仓库聚合下载中,请等待...").catch(() => {});
        // logger.info(`${logPrefix} [核心下载] 等待 ${subsidiaryPromises.length} 个附属仓库下载完成...`);
        const settledResults = await Promise.allSettled(subsidiaryPromises);
        //logger.info(`${logPrefix} [核心下载] 所有附属仓库 Promise 已完成 (settled)。`);
        for (const result of settledResults) {
          if (result.status === "fulfilled") {
            const resValue = result.value;
            if (
              resValue.success &&
              resValue.nodeName !== "本地" &&
              resValue.nodeName !== "未配置"
            ) {
              logger.info(
                `${logPrefix} [核心下载] 附属仓库 (${resValue.repo}号) 下载成功 (${resValue.nodeName})。`
              );
              let repoPath = null;
              if (resValue.repo === 2)
                repoPath = MiaoPluginMBT.paths.LocalTuKuPath2;
              if (resValue.repo === 3)
                repoPath = MiaoPluginMBT.paths.LocalTuKuPath3;
              if (repoPath)
                resValue.gitLog = await MiaoPluginMBT.GetTuKuLog(
                  1,
                  repoPath,
                  logger
                ); // 获取日志并添加到结果
            } else if (!resValue.success) {
              logger.error(
                `${logPrefix} [核心下载] 附属仓库 (${resValue.repo}号) 下载失败 (${resValue.nodeName})。`
              );
              logger.error(`${logPrefix} [核心下载] 失败详情:`, resValue.error);
            }
            subsidiaryResults.push(resValue); // 将处理后的结果加入
          } else {
            logger.error(
              `${logPrefix} [核心下载] 一个附属仓库 Promise rejected:`,
              result.reason
            );
          }
        }
      }

      //  生成并发送图形化报告
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      subsidiaryResults.sort((a, b) => a.repo - b.repo);
      const reportData = {
        coreRepoResult: coreRepoResult,
        subsidiaryResults: subsidiaryResults,
        duration: duration,
        scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
        pluginVersion: MiaoPluginMBT.GetVersionStatic(),
        gitLog1: gitLog1,
      };

      let tempReportHtmlPath = "";
      let tempReportImgPath = "";
      let reportSent = false; // 标记报告是否已发送

      try {
        if (
          typeof DOWNLOAD_REPORT_HTML_TEMPLATE !== "string" ||
          DOWNLOAD_REPORT_HTML_TEMPLATE.length === 0
        ) {
          throw new Error("DOWNLOAD_REPORT_HTML_TEMPLATE 常量无效!");
        }

        await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
          recursive: true,
        });
        tempReportHtmlPath = path.join(
          MiaoPluginMBT.paths.tempHtmlPath,
          `download-report-tpl-${Date.now()}.html`
        );
        await fsPromises.writeFile(
          tempReportHtmlPath,
          DOWNLOAD_REPORT_HTML_TEMPLATE,
          "utf8"
        );

        await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
          recursive: true,
        });
        tempReportImgPath = path.join(
          MiaoPluginMBT.paths.tempImgPath,
          `download-report-${Date.now()}.png`
        );

        const reportImg = await puppeteer.screenshot(
          "guguniu-download-report",
          {
            tplFile: tempReportHtmlPath,
            savePath: tempReportImgPath,
            imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0" },
            ...reportData, // 直接展开数据
            screenshotOptions: { fullPage: false },
            pageBoundingRect: { selector: ".container", padding: 0 },
            width: 520,
          }
        );

        if (reportImg) {
          await e.reply(reportImg);
          //logger.info(`${logPrefix} [下载报告] 图片报告已发送。`);
          reportSent = true; // 标记图片报告发送成功
        } else {
          throw new Error("Puppeteer 生成下载报告图片失败 (返回空)");
        }
      } catch (reportError) {
        logger.error(
          `${logPrefix} [下载报告] 生成或发送图片报告时出错:`,
          reportError
        );
        // 图片报告失败，准备发送文本和日志合并消息
        const logMessages = [];
        let coreStatusLineText = `核心仓库: ${
          coreRepoResult.success ? "成功" : "失败"
        } (${coreRepoResult.nodeName})`;
        if (coreRepoResult.error)
          coreStatusLineText += ` | 错误: ${coreRepoResult.error.message}`;
        logMessages.push(coreStatusLineText);
        if (gitLog1) logMessages.push(`--- 核心仓库最新 ---\n${gitLog1}`);

        subsidiaryResults.forEach((res) => {
          let subStatusLineText = `${
            res.repo === 2
              ? "二号仓库"
              : res.repo === 3
              ? "三号仓库"
              : res.repo + "号仓库"
          }: `;
          if (res.nodeName === "本地") subStatusLineText += "已存在";
          else if (res.nodeName === "未配置") subStatusLineText += "未配置";
          else
            subStatusLineText += `${res.success ? "成功" : "失败"} (${
              res.nodeName
            })`;
          if (res.error) subStatusLineText += ` | 错误: ${res.error.message}`;
          logMessages.push(subStatusLineText);
          if (res.gitLog)
            logMessages.push(
              `--- ${
                res.repo === 2
                  ? "二号"
                  : res.repo === 3
                  ? "三号"
                  : res.repo + "号"
              }仓库最新 ---\n${res.gitLog}`
            );
        });

        try {
          const forwardMsg = await common.makeForwardMsg(
            e,
            logMessages,
            "『咕咕牛』下载结果与日志"
          );
          if (forwardMsg) {
            await e.reply(forwardMsg);
            logger.info(
              `${logPrefix} [下载报告] 图片报告失败，已发送文本结果与日志合并消息。`
            );
            reportSent = true; // 标记文本报告发送成功
          } else {
            logger.error(`${logPrefix} [下载报告] 创建文本结果合并消息失败。`);
          }
        } catch (fwdErr) {
          logger.error(
            `${logPrefix} [下载报告] 发送文本结果合并消息失败:`,
            fwdErr
          );
        }
        // 如果文本也发送失败，再调用 ReportError
        if (!reportSent) {
          await this.ReportError(e, "发送下载结果", reportError);
        }
      } finally {
        // 清理临时文件
        if (tempReportHtmlPath && fs.existsSync(tempReportHtmlPath)) {
          try {
            await fsPromises.unlink(tempReportHtmlPath);
          } catch (unlinkErr) {}
        }
        if (tempReportImgPath && fs.existsSync(tempReportImgPath)) {
          try {
            await fsPromises.unlink(tempReportImgPath);
          } catch (unlinkErr) {}
        }
        const possiblePuppeteerTempDir = path.join(
          MiaoPluginMBT.paths.tempPath,
          "..",
          "guguniu-download-report"
        );
        if (fs.existsSync(possiblePuppeteerTempDir)) {
          try {
            await safeDelete(possiblePuppeteerTempDir);
          } catch (deleteErr) {}
        }
      }

      //  执行下载后设置
      await MiaoPluginMBT.RunPostDownloadSetup(e, logger);
      await e.reply("『咕咕牛』成功进入喵喵里面！").catch(() => {});
    } catch (error) {
      logger.error(`${logPrefix} [DownloadTuKu-核心] 顶层执行出错:`, error);
      await this.ReportError(e, "下载图库顶层", error);
      overallSuccess = false;
    } finally {
      const durationFinal = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(
        `${logPrefix} [核心下载] 流程结束，总耗时 ${durationFinal} 秒。`
      );
    }
    return true;
  }

  /**
   * @description 处理 #更新咕咕牛 命令，执行多仓库更新流程，并生成图片报告。
   */
  async UpdateTuKu(e, isScheduled = false) {
    if (!isScheduled && !(await this.CheckInit(e))) return false;

    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
    let Repo2Exists =
      Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const Repo3UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Sexy_Github_URL;
    let Repo3Exists =
      Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));

    let anyRepoMissing = false;
    if (!Repo1Exists) anyRepoMissing = true;
    if (Repo2UrlConfigured && !Repo2Exists) anyRepoMissing = true;
    if (Repo3UrlConfigured && !Repo3Exists) anyRepoMissing = true;

    if (anyRepoMissing && Repo1Exists) {
      if (!isScheduled && e)
        await e.reply("『咕咕牛🐂』部分附属仓库未下载，建议先 `#下载咕咕牛` 补全。",true);
    } else if (!Repo1Exists) {
      if (!isScheduled && e)
        await e.reply("『咕咕牛🐂』图库未下载",true);
      return false;
    }

    const startTime = Date.now();
    if (!isScheduled && e)
      await e.reply("『咕咕牛🐂』开始检查更新...", true);
    logger.info(
      `${logPrefix} [更新流程] 开始 @ ${new Date(startTime).toISOString()}`
    );

    const reportResults = [];
    let overallSuccess = true;
    let overallHasChanges = false;

    const processRepoResult = async (
      repoNum,
      localPath,
      repoDisplayName,
      repoUrlForUpdate,
      branchForUpdate,
      isCore = false
    ) => {
      const result = await MiaoPluginMBT.UpdateSingleRepo(
        isCore ? e : null,
        repoNum,
        localPath,
        repoDisplayName,
        repoUrlForUpdate,
        branchForUpdate,
        isScheduled,
        logger
      );
      overallSuccess &&= result.success;
      overallHasChanges ||= result.hasChanges;

      let statusText = "";
      if (result.success) {
        if (result.wasForceReset) {
          statusText = "本地冲突 (强制同步)";
        } else if (result.hasChanges) {
          statusText = "更新成功";
        } else {
          statusText = "已是最新";
        }
      } else {
        statusText = "更新失败";
      }
      return {
        name: repoDisplayName,
        statusText: statusText,
        statusClass: result.success
          ? result.hasChanges || result.wasForceReset
            ? "status-ok"
            : "status-no-change"
          : "status-fail",
        error: result.error, // 包含完整 stderr
        log: result.log,
        wasForceReset: result.wasForceReset,
      };
    };

    if (Repo1Exists) {
      reportResults.push(
        await processRepoResult(
          1,
          MiaoPluginMBT.paths.LocalTuKuPath,
          "一号仓库 (核心)",
          Default_Config.Main_Github_URL,
          MiaoPluginMBT.MBTConfig.SepositoryBranch ||
            Default_Config.SepositoryBranch,
          true
        )
      );
    } else {
      reportResults.push({
        name: "一号仓库 (核心)",
        statusText: "未下载",
        statusClass: "status-skipped",
        error: null,
        log: null,
        wasForceReset: false,
      });
      overallSuccess = false;
    }

    if (Repo2UrlConfigured) {
      if (Repo2Exists) {
        reportResults.push(
          await processRepoResult(
            2,
            MiaoPluginMBT.paths.LocalTuKuPath2,
            "二号仓库 (附属)",
            MiaoPluginMBT.MBTConfig.Ass_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch ||
              Default_Config.SepositoryBranch
          )
        );
      } else {
        reportResults.push({
          name: "二号仓库 (附属)",
          statusText: "未下载",
          statusClass: "status-skipped",
          error: null,
          log: null,
          wasForceReset: false,
        });
      }
    } else {
      reportResults.push({
        name: "二号仓库 (附属)",
        statusText: "未配置",
        statusClass: "status-skipped",
        error: null,
        log: null,
        wasForceReset: false,
      });
    }

    if (Repo3UrlConfigured) {
      if (Repo3Exists) {
        reportResults.push(
          await processRepoResult(
            3,
            MiaoPluginMBT.paths.LocalTuKuPath3,
            "三号仓库 (涩涩)",
            MiaoPluginMBT.MBTConfig.Sexy_Github_URL,
            MiaoPluginMBT.MBTConfig.SepositoryBranch ||
              Default_Config.SepositoryBranch
          )
        );
      } else {
        reportResults.push({
          name: "三号仓库 (涩涩)",
          statusText: "未下载",
          statusClass: "status-skipped",
          error: null,
          log: null,
          wasForceReset: false,
        });
      }
    } else {
      reportResults.push({
        name: "三号仓库 (涩涩)",
        statusText: "未配置",
        statusClass: "status-skipped",
        error: null,
        log: null,
        wasForceReset: false,
      });
    }

    if (overallSuccess && overallHasChanges) {
      logger.info(`${logPrefix} 检测到更新，开始执行更新后设置...`);
      await MiaoPluginMBT.RunPostUpdateSetup(e, isScheduled, logger);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const reportData = {
      pluginVersion: MiaoPluginMBT.GetVersionStatic(),
      duration: duration,
      scaleStyleValue: MiaoPluginMBT.getScaleStyleValue(),
      results: reportResults,
      overallSuccess: overallSuccess,
      overallHasChanges: overallHasChanges,
    };

    let tempImgFilePath = ""; 
    let reportSent = false;

    try {
      const sourceHtmlPath = path.join(
        MiaoPluginMBT.paths.commonResPath,
        "html",
        "update_report.html"
      );
      try {
        await fsPromises.access(sourceHtmlPath);
      } catch (err) {
        logger.error(
          `${logPrefix} [更新报告] 找不到更新报告模板: ${sourceHtmlPath}`,
          err
        );
        let fallbackMsg = `${logPrefix} 更新检查完成。\n`;
        reportResults.forEach((res) => {
          fallbackMsg += `${res.name}: ${res.statusText}\n`;
          if (res.error && res.error.message)
            fallbackMsg += `  错误: ${res.error.message.split("\n")[0]}\n`; // 只取第一行
        });
        if (e && !isScheduled) await e.reply(fallbackMsg);
        else if (
          isScheduled &&
          typeof Bot !== "undefined" &&
          Bot.master &&
          Bot.master.length > 0
        ) {
          // 增加 Bot 定义检查
          Bot.master.forEach((masterId) =>
            Bot.pickUser(masterId)
              .sendMsg(fallbackMsg)
              .catch((sendErr) =>
                logger.error("发送定时更新文本报告给主人失败", sendErr)
              )
          );
        }
        return overallHasChanges;
      }

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
        recursive: true,
      }); // 确保 tempImgPath 存在
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `update-report-${Date.now()}.png`
      );

      const img = await puppeteer.screenshot("guguniu-update-report", {
        tplFile: sourceHtmlPath,
        savePath: tempImgFilePath,
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        ...reportData,
        screenshotOptions: { fullPage: true },
        pageBoundingRect: { selector: ".container", padding: 0 },
        width: 560,
      });

      if (img) {
        if (!isScheduled && e) {
          await e.reply(img);
        } else if (
          isScheduled &&
          typeof Bot !== "undefined" &&
          Bot.master &&
          Bot.master.length > 0
        ) {
          // 增加 Bot 定义检查
          logger.info(
            `${logPrefix} [定时更新] 检测到变更或错误，准备向主人发送图片报告...`
          );
          for (const masterId of Bot.master) {
            try {
              await Bot.pickUser(masterId).sendMsg(img);
              logger.info(
                `${logPrefix} [定时更新] 图片报告已发送给主人 ${masterId}`
              );
            } catch (sendErr) {
              logger.error(
                `${logPrefix} [定时更新] 发送图片报告给主人 ${masterId} 失败:`,
                sendErr
              );
              let fallbackMsgMaster = `${logPrefix} 定时更新报告图片发送失败。\n`;
              reportResults.forEach((res) => {
                fallbackMsgMaster += `${res.name}: ${res.statusText}\n`;
                if (res.error && res.error.message)
                  fallbackMsgMaster += `  错误: ${
                    res.error.message.split("\n")[0]
                  }\n`;
              });
              await Bot.pickUser(masterId)
                .sendMsg(fallbackMsgMaster)
                .catch(() => {});
            }
          }
        }
        reportSent = true;
      } else {
        logger.error(
          `${logPrefix} [更新报告] Puppeteer 生成更新报告图片失败 (返回空)。`
        );
      }
    } catch (reportError) {
      logger.error(
        `${logPrefix} [更新报告] 生成或发送图片报告时出错:`,
        reportError
      );
      if (!reportSent) {
        let fallbackMsg = `${logPrefix} 更新检查完成，但报告图片生成失败。\n`;
        reportResults.forEach((res) => {
          fallbackMsg += `${res.name}: ${res.statusText}\n`;
          if (res.error && res.error.message)
            fallbackMsg += `  错误: ${res.error.message.split("\n")[0]}\n`;
        });
        if (e && !isScheduled) await e.reply(fallbackMsg);
        else if (
          isScheduled &&
          typeof Bot !== "undefined" &&
          Bot.master &&
          Bot.master.length > 0
        ) {
          // 增加 Bot 定义检查
          Bot.master.forEach((masterId) =>
            Bot.pickUser(masterId)
              .sendMsg(fallbackMsg)
              .catch((sendErr) =>
                logger.error(
                  "发送定时更新文本报告给主人失败(图片生成错误)",
                  sendErr
                )
              )
          );
        }
      }
    } finally {
      if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
        try {
          await fsPromises.unlink(tempImgFilePath);
        } catch (unlinkErr) {}
      }
      const possiblePuppeteerTempDir = path.join(
        MiaoPluginMBT.paths.tempPath,
        "..",
        "guguniu-update-report"
      );
      if (fs.existsSync(possiblePuppeteerTempDir)) {
        try {
          await safeDelete(possiblePuppeteerTempDir);
        } catch (deleteErr) {}
      }
    }

    logger.info(`${logPrefix} 更新流程结束，耗时 ${duration} 秒。`);
    return overallHasChanges;
  }

  /**
   * @description 处理 #重置咕咕牛 命令，彻底清理图库相关文件和状态。
   */
  async ManageTuKu(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster) {
      return e.reply(`${this.logPrefix} 这个操作只有我的主人才能用哦~`);
    }

    const msg = e.msg.trim();
    if (msg !== "#重置咕咕牛") {
      return false;
    }

    const startMessage = "『咕咕牛🐂』开始重置图库，请稍等...";
    const successMessageBase = "『咕咕牛🐂』重置完成！所有相关文件和缓存都清理干净啦。";
    const failureMessage = "『咕咕牛🐂』重置过程中好像出了点问题，可能没清理干净，快去看看日志吧！";

    await e.reply(startMessage, true);
    //this.logger.info(`${this.logPrefix} 用户 ${e.user_id} 执行重置操作.`);  //调试日志-精简

    let mainDirsDeleteSuccess = true;
    let pluginDirsCleanSuccess = true;
    let firstError = null;

    // 删除主要仓库和公共资源目录
    const pathsToDeleteDirectly = [
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.LocalTuKuPath2,
      MiaoPluginMBT.paths.LocalTuKuPath3,
      MiaoPluginMBT.paths.commonResPath,
    ].filter(Boolean);

    for (const dirPath of pathsToDeleteDirectly) {
      if (!dirPath) continue;
      //this.logger.info(`${this.logPrefix} [重置] 正在删除: ${dirPath}`);
      try {
        const deleted = await safeDelete(dirPath);
        if (!deleted) {
          this.logger.warn(`${this.logPrefix} [重置] 删除 ${dirPath} 可能未完全成功 (safeDelete 返回 false)`);
        }
      } catch (err) {
        this.logger.error(`${this.logPrefix} [重置] 删除 ${dirPath} 时发生错误:`, err);
        mainDirsDeleteSuccess = false;
        if (!firstError) firstError = { operation: `删除目录 ${path.basename(dirPath)}`, error: err };
      }
    }

    //  清理残留的 GuTemp-* 临时下载目录 (静默处理失败，仅记录日志)
    const tempDownloadBasePath = path.join(MiaoPluginMBT.paths.tempPath, "guguniu-downloads");
    //this.logger.info(`${this.logPrefix} [重置] 检查并清理残留的临时下载目录于: ${tempDownloadBasePath}`);
    let tempDirsCleanedCount = 0;
    let tempDirsSilentFailCount = 0;

    try {
      await fsPromises.access(tempDownloadBasePath);
      const entries = await fsPromises.readdir(tempDownloadBasePath, { withFileTypes: true });
      const tempDirCleanupPromises = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("GuTemp-")) {
          const tempDirPath = path.join(tempDownloadBasePath, entry.name);
          //this.logger.info(`${this.logPrefix} [重置] 发现残留临时目录，尝试删除: ${tempDirPath}`);
          tempDirCleanupPromises.push(
            (async () => {
              try {
                const cleanedSuccessfully = await safeDelete(tempDirPath);
                if (cleanedSuccessfully) {
                  tempDirsCleanedCount++;
                } else {
                  this.logger.warn(`${this.logPrefix} [重置-静默] 临时目录可能未完全清除 (safeDelete 返回 false): ${tempDirPath}`);
                  tempDirsSilentFailCount++;
                }
              } catch (cleanupError) {
                this.logger.warn(`${this.logPrefix} [重置-静默] 删除临时目录 ${tempDirPath} 时发生异常 (已忽略): ${cleanupError.message || cleanupError}`);
                tempDirsSilentFailCount++;
              }
            })()
          );
        }
      }
      await Promise.all(tempDirCleanupPromises);

      if (tempDirsCleanedCount > 0) {
        //this.logger.info(`${this.logPrefix} [重置] 成功清理了 ${tempDirsCleanedCount} 个残留的临时下载目录。`);
      }
      if (tempDirsSilentFailCount > 0) {
        this.logger.warn(`${this.logPrefix} [重置] 有 ${tempDirsSilentFailCount} 个临时下载目录在清理时遇到问题 (已静默处理，详见日志)。`);
      }
      const hasGuTempDirs = entries.some(entry => entry.isDirectory() && entry.name.startsWith("GuTemp-"));
      if (tempDirsCleanedCount === 0 && tempDirsSilentFailCount === 0 && !hasGuTempDirs) {
          //this.logger.info(`${this.logPrefix} [重置] 未发现需要清理的 GuTemp-* 临时下载目录。`);
      }
    } catch (readBaseTempErr) {
      if (readBaseTempErr.code === ERROR_CODES.NotFound) {
        //this.logger.info(`${this.logPrefix} [重置] 临时下载目录基路径 ${tempDownloadBasePath} 不存在，无需清理 GuTemp-* 目录。`);
      } else {
        this.logger.warn(`${this.logPrefix} [重置-静默] 访问或读取临时下载目录基路径 ${tempDownloadBasePath} 失败 (已忽略):`, readBaseTempErr.message || readBaseTempErr);
      }
    }

    // 清理目标插件目录中的图片文件
    //this.logger.info(`${this.logPrefix} [重置] 开始清理目标插件目录中的图片文件...`);
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean);

    for (const dirPath of targetPluginDirs) {
      if (!dirPath) continue;
      try {
        await MiaoPluginMBT.CleanTargetCharacterDirs(dirPath, this.logger);
      } catch (err) {
        this.logger.error(`${this.logPrefix} [重置] 清理目标插件目录 ${dirPath} 时出错:`, err);
        pluginDirsCleanSuccess = false;
        if (!firstError) firstError = { operation: `清理插件目录 ${path.basename(dirPath)}`, error: err };
      }
    }

    //  重置内存状态
    //this.logger.info(`${this.logPrefix} [重置] 重置内存状态...`);
    await MiaoPluginMBT.configMutex.acquire();
    try {
      MiaoPluginMBT.MBTConfig = {};
      MiaoPluginMBT._imgDataCache = Object.freeze([]);
      MiaoPluginMBT._userBanSet = new Set();
      MiaoPluginMBT._activeBanSet = new Set();
      MiaoPluginMBT._aliasData = null;
      MiaoPluginMBT.isGloballyInitialized = false;
      MiaoPluginMBT.initializationPromise = null;
      this.isPluginInited = false;
      this.logger.info(`${this.logPrefix} [重置] 内存状态已重置。`);
    } finally {
      MiaoPluginMBT.configMutex.release();
    }

    // 最终结果判断和用户回复
    const overallSuccess = mainDirsDeleteSuccess && pluginDirsCleanSuccess;

    if (overallSuccess) {
      await e.reply(successMessageBase);
      if (tempDirsSilentFailCount > 0) { // 仅在日志中额外提示开发者
          this.logger.info(`${this.logPrefix} [重置-提示] 重置操作主体成功，但有 ${tempDirsSilentFailCount} 个临时目录清理时被静默处理。`);
      }
    } else {
      await e.reply(failureMessage);
      if (firstError) {
        await MiaoPluginMBT.ReportError(e, `重置咕咕牛 (${firstError.operation})`, firstError.error, "", this.logger);
      }
    }
    return true;
  }

  /**
   * @description 处理 #检查咕咕牛 命令，生成并发送状态报告图片。
   *              增加三号仓库统计和功能开关状态显示。
   */
  async CheckStatus(e) {
    if (!(await this.CheckInit(e))) return true;

    const Repo1Exists = await MiaoPluginMBT.IsTuKuDownloaded(1);
    const Repo2UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Ass_Github_URL;
    const Repo2Exists =
      Repo2UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(2));
    const Repo3UrlConfigured = !!MiaoPluginMBT.MBTConfig?.Sexy_Github_URL;
    const Repo3Exists =
      Repo3UrlConfigured && (await MiaoPluginMBT.IsTuKuDownloaded(3));
    // this.logger.info(
    //   `${this.logPrefix} [检查状态] 仓库状态 - 一号: ${
    //     Repo1Exists ? "存在" : "不存在"
    //   }, 二号: ${
    //     Repo2UrlConfigured ? (Repo2Exists ? "存在" : "未下载") : "未配置"
    //   }, 三号: ${
    //     Repo3UrlConfigured ? (Repo3Exists ? "存在" : "未下载") : "未配置"
    //   }`
    // );
    //调试日志-精简
    if (!Repo1Exists) {
      return e.reply("『咕咕牛🐂』图库还没下载呢，先 `#下载咕咕牛` 吧！", true);
    }
    let missingSubsidiary = false;
    if (Repo2UrlConfigured && !Repo2Exists) missingSubsidiary = true;
    if (Repo3UrlConfigured && !Repo3Exists) missingSubsidiary = true;
    if (Repo1Exists && missingSubsidiary) {
      return e.reply(
        "『咕咕牛🐂』核心仓库已下载，但部分附属仓库未下载或丢失。建议先 `#下载咕咕牛` 补全或 `#重置咕咕牛` 后重新下载。",
        true
      );
    }
    if (!Repo1Exists && (Repo2Exists || Repo3Exists)) {
      return e.reply(
        "『咕咕牛🐂』状态异常！核心仓库未下载，但附属仓库已存在？建议先 `#重置咕咕牛`。",
        true
      );
    }

    let tempHtmlFilePath = "";
    let tempImgFilePath = "";

    try {
      const pluginVersion = MiaoPluginMBT.GetVersionStatic();
      const GameFoldersMap = {
        gs: "原神",
        sr: "星铁",
        zzz: "绝区零",
        waves: "鸣潮",
      };
      const stats = {
        meta: { roles: 0, images: 0, games: {} },
        scan: {
          roles: 0,
          images: 0,
          gameImages: {},
          gameRoles: {},
          gameSizes: {},
          gameSizesFormatted: {},
          totalSize: 0,
          totalGitSize: 0,
          totalFilesSize: 0,
          totalSizeFormatted: "0 B",
          totalGitSizeFormatted: "0 B",
          totalFilesSizeFormatted: "0 B",
        },
        repos: {
          1: {
            name: "一号仓库",
            exists: Repo1Exists,
            size: 0,
            gitSize: 0,
            filesSize: 0,
            sizeFormatted: "N/A",
            gitSizeFormatted: "N/A",
            filesSizeFormatted: "N/A",
          },
          2: {
            name: "二号仓库",
            exists: Repo2Exists && Repo2UrlConfigured,
            size: 0,
            gitSize: 0,
            filesSize: 0,
            sizeFormatted: "N/A",
            gitSizeFormatted: "N/A",
            filesSizeFormatted: "N/A",
          },
          3: {
            name: "三号仓库",
            exists: Repo3Exists && Repo3UrlConfigured,
            size: 0,
            gitSize: 0,
            filesSize: 0,
            sizeFormatted: "N/A",
            gitSizeFormatted: "N/A",
            filesSizeFormatted: "N/A",
          }, // 添加三号仓库结构
        },
      };
      Object.values(GameFoldersMap).forEach((gameName) => {
        stats.meta.games[gameName] = 0;
        stats.scan.gameImages[gameName] = 0;
        stats.scan.gameRoles[gameName] = 0;
        stats.scan.gameSizes[gameName] = 0;
        stats.scan.gameSizesFormatted[gameName] = "0 B";
      });

      // 读取配置信息
      const currentConfig = MiaoPluginMBT.MBTConfig; // 直接使用内存中的最新配置
      const configForRender = {
        enabled: currentConfig?.TuKuOP ?? Default_Config.defaultTuKuOp,
        pflLevel: currentConfig?.PFL ?? Default_Config.defaultPfl,
        aiEnabled: currentConfig?.Ai ?? true,
        easterEggEnabled: currentConfig?.EasterEgg ?? true,
        layoutEnabled: currentConfig?.layout ?? true,
        pm18Enabled: currentConfig?.PM18 ?? false,
        activeBans: MiaoPluginMBT._activeBanSet?.size ?? 0,
        userBans: MiaoPluginMBT._userBanSet?.size ?? 0,
        purifiedBans: 0, // 这个计算保持不变
        enabledText: "",
        pflDesc: "",
        aiStatusText: "",
        easterEggStatusText: "",
        layoutStatusText: "",
        pm18StatusText: "",
      };
      configForRender.enabledText = configForRender.enabled
        ? "已启用"
        : "已禁用";
      configForRender.purifiedBans = Math.max(
        0,
        configForRender.activeBans - configForRender.userBans
      );
      configForRender.pflDesc = Purify_Level.getDescription(
        configForRender.pflLevel
      );
      configForRender.aiStatusText = configForRender.aiEnabled
        ? "开启"
        : "关闭";
      configForRender.easterEggStatusText = configForRender.easterEggEnabled
        ? "开启"
        : "关闭";
      configForRender.layoutStatusText = configForRender.layoutEnabled
        ? "开启"
        : "关闭";
      configForRender.pm18StatusText = configForRender.pm18Enabled
        ? "开启"
        : "关闭";

      // 元数据统计
      const characterSet = new Set();
      if (
        Array.isArray(MiaoPluginMBT._imgDataCache) &&
        MiaoPluginMBT._imgDataCache.length > 0
      ) {
        stats.meta.images = MiaoPluginMBT._imgDataCache.length;
        MiaoPluginMBT._imgDataCache.forEach((item) => {
          if (item && item.characterName) {
            characterSet.add(item.characterName);
          }
          const PathParts = item?.path?.split("/");
          if (PathParts?.length > 0) {
            const GameKey = PathParts[0].split("-")[0];
            const GameName = GameFoldersMap[GameKey];
            if (GameName)
              stats.meta.games[GameName] =
                (stats.meta.games[GameName] || 0) + 1;
          }
        });
      }
      stats.meta.roles = characterSet.size;
      // this.logger.info(
      //   `${this.logPrefix} [检查状态] 元数据: ${stats.meta.roles}角色, ${stats.meta.images}图片`
      // );
      //调试日志-精简

      // 本地文件扫描统计
      const RepoStatsScan = {
        1: {
          path: MiaoPluginMBT.paths.LocalTuKuPath,
          gitPath: MiaoPluginMBT.paths.gitFolderPath,
          exists: Repo1Exists,
        },
        2: {
          path: MiaoPluginMBT.paths.LocalTuKuPath2,
          gitPath: MiaoPluginMBT.paths.gitFolderPath2,
          exists: Repo2Exists && Repo2UrlConfigured,
        },
        3: {
          path: MiaoPluginMBT.paths.LocalTuKuPath3,
          gitPath: MiaoPluginMBT.paths.gitFolderPath3,
          exists: Repo3Exists && Repo3UrlConfigured,
        }, // 添加三号仓库
      };
      const ScannedRoleImageCounts = {};
      const ScannedGameSizes = {};
      Object.values(GameFoldersMap).forEach((gameName) => {
        ScannedRoleImageCounts[gameName] = {};
        ScannedGameSizes[gameName] = 0;
      });
      let totalGitSizeScan = 0;

      for (const RepoNum of Object.keys(RepoStatsScan)) {
        const Repo = RepoStatsScan[RepoNum];
        if (!Repo.exists) continue;
        try {
          const repoGitSize = await FolderSize(Repo.gitPath);
          totalGitSizeScan += repoGitSize;
          stats.repos[RepoNum].gitSize = repoGitSize;
          stats.repos[RepoNum].gitSizeFormatted = FormatBytes(repoGitSize);
        } catch (sizeError) {
          this.logger.error(
            `${this.logPrefix} [检查状态] 计算仓库 ${RepoNum} Git 大小失败:`,
            sizeError
          );
          stats.repos[RepoNum].gitSizeFormatted = "错误";
        }
        for (const GameKey in GameFoldersMap) {
          const GameName = GameFoldersMap[GameKey];
          const sourceFolderName = MiaoPluginMBT.paths.sourceFolders[GameKey];
          if (!sourceFolderName || GameKey === "gallery") continue;
          const gameFolderPath = path.join(Repo.path, sourceFolderName);
          try {
            await fsPromises.access(gameFolderPath);
            const characterDirs = await fsPromises.readdir(gameFolderPath, {
              withFileTypes: true,
            });
            for (const charDir of characterDirs) {
              if (charDir.isDirectory()) {
                const characterName = charDir.name;
                const charFolderPath = path.join(gameFolderPath, characterName);
                let imageCountInCharDir = 0;
                try {
                  await fsPromises.access(charFolderPath);
                  const imageFiles = await fsPromises.readdir(charFolderPath, {
                    withFileTypes: true,
                  });
                  for (const imageFile of imageFiles) {
                    const supportedScanExt = [
                      ".jpg",
                      ".png",
                      ".jpeg",
                      ".webp",
                      ".bmp",
                    ];
                    if (
                      imageFile.isFile() &&
                      supportedScanExt.includes(
                        path.extname(imageFile.name).toLowerCase()
                      )
                    ) {
                      imageCountInCharDir++;
                      const imagePath = path.join(
                        charFolderPath,
                        imageFile.name
                      );
                      try {
                        const fileStat = await fsPromises.stat(imagePath);
                        ScannedGameSizes[GameName] =
                          (ScannedGameSizes[GameName] || 0) + fileStat.size;
                      } catch (statErr) {}
                    }
                  }
                } catch (readCharErr) {}
                if (imageCountInCharDir > 0) {
                  ScannedRoleImageCounts[GameName][characterName] =
                    (ScannedRoleImageCounts[GameName][characterName] || 0) +
                    imageCountInCharDir;
                }
              }
            }
          } catch (accessGameErr) {}
        }
      }

      const scanResult = stats.scan;
      scanResult.totalGitSize = totalGitSizeScan;
      scanResult.totalGitSizeFormatted = FormatBytes(totalGitSizeScan);

      Object.values(GameFoldersMap).forEach((GameName) => {
        const rolesInGame = ScannedRoleImageCounts[GameName] || {};
        const roleNames = Object.keys(rolesInGame);
        const roleCount = roleNames.length;
        let gameImageCount = 0;
        roleNames.forEach((roleName) => {
          gameImageCount += rolesInGame[roleName] || 0;
        });
        scanResult.gameRoles[GameName] = roleCount;
        scanResult.gameImages[GameName] = gameImageCount;
        scanResult.roles += roleCount;
        scanResult.images += gameImageCount;
        const gameSizeBytes = ScannedGameSizes[GameName] || 0;
        scanResult.gameSizes[GameName] = gameSizeBytes;
        scanResult.gameSizesFormatted[GameName] = FormatBytes(gameSizeBytes);
        scanResult.totalFilesSize += gameSizeBytes;
      });

      scanResult.totalSize =
        scanResult.totalFilesSize + scanResult.totalGitSize;
      scanResult.totalFilesSizeFormatted = FormatBytes(
        scanResult.totalFilesSize
      );
      scanResult.totalSizeFormatted = FormatBytes(scanResult.totalSize);
      // this.logger.info(
      //   `${this.logPrefix} [检查状态] 本地扫描: ${scanResult.roles}角色, ${scanResult.images}图片, 文件 ${scanResult.totalFilesSizeFormatted}, 总 ${scanResult.totalSizeFormatted}`
      // );
      //调试日志-精简

      // 计算各仓库总占用和文件占用
      for (const repoNum in stats.repos) {
        if (stats.repos[repoNum].exists) {
          try {
            const repoTotalSize = await FolderSize(RepoStatsScan[repoNum].path);
            const repoGitSize = stats.repos[repoNum].gitSize;
            stats.repos[repoNum].size = repoTotalSize;
            stats.repos[repoNum].filesSize = Math.max(
              0,
              repoTotalSize - repoGitSize
            );
            stats.repos[repoNum].sizeFormatted = FormatBytes(repoTotalSize);
            stats.repos[repoNum].filesSizeFormatted = FormatBytes(
              stats.repos[repoNum].filesSize
            );
          } catch (finalSizeError) {
            this.logger.error(
              `${this.logPrefix} [检查状态] 计算仓库 ${repoNum} 总占用大小失败:`,
              finalSizeError
            );
            stats.repos[repoNum].sizeFormatted = "错误";
            stats.repos[repoNum].filesSizeFormatted = "错误";
          }
        }
      }

      const repoCount = Object.values(stats.repos || {}).filter(
        (repo) => repo?.exists
      ).length;
      const renderData = {
        pluginVersion,
        stats,
        config: configForRender, // 使用处理过的配置对象
        repoCount,
      };
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
        recursive: true,
      });
      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
        recursive: true,
      });
      const sourceHtmlPath = path.join(
        MiaoPluginMBT.paths.commonResPath,
        "html",
        "status.html"
      );

      tempHtmlFilePath = path.join(
        MiaoPluginMBT.paths.tempHtmlPath,
        `status-${Date.now()}-${Math.random().toString(16).slice(2)}.html`
      );
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `status-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
      );

      await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath);
      const img = await puppeteer.screenshot("guguniu-status", {
        tplFile: tempHtmlFilePath,
        savePath: tempImgFilePath,
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        ...renderData,
        scaleStyleValue: scaleStyleValue,
        screenshotOptions: { fullPage: false },
        pageBoundingRect: { selector: ".container", padding: 0 },
        width: 540,
      });

      if (img) {
        await e.reply(img);
      } else {
        this.logger.error(
          `${this.logPrefix} [检查状态] Puppeteer 未能成功生成图片。`
        );
        await e.reply("生成状态报告图片失败 (截图环节出错)，请查看日志。");
      }
    } catch (error) {
      this.logger.error(
        `${this.logPrefix} [检查状态] 生成状态报告时发生严重错误:`,
        error
      );
      await this.ReportError(e, "生成状态报告图片", error);
    } finally {
      if (tempHtmlFilePath) {
        try {
          await fsPromises.unlink(tempHtmlFilePath);
        } catch (unlinkErr) {}
      }
      if (tempImgFilePath) {
        try {
          await fsPromises.unlink(tempImgFilePath);
        } catch (unlinkErr) {}
      }
    }
    return true;
  }

  /**
   * @description 处理 #启用/禁用咕咕牛 命令。
   *              统一交互逻辑，优先发面板，失败再发文字。
   */
  async ManageTuKuOption(e) {
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    if (!(await this.CheckInit(e))) {
      return true;
    }
    if (!e.isMaster) {
      return e.reply(`${logPrefix} 只有主人才能开关图库啦~`);
    }

    const match = e.msg.match(/^#(启用|禁用)咕咕牛$/i);
    if (!match) {
      
      return false;
    }

    const action = match[1];
    const enable = action === "启用";
    let configChanged = false;
    let asyncError = null;
    let saveWarning = "";

    
    
    await MiaoPluginMBT.configMutex.acquire();
    
    try {
      
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentStatus =
        MiaoPluginMBT.MBTConfig.TuKuOP ?? Default_Config.defaultTuKuOp;
      

      if (currentStatus === enable) {
        //logger.info(`${logPrefix} [启用禁用] 状态未变，尝试显示面板。`);
        try {
          await this.ShowSettingsPanel(e, `图库已经是「${action}」状态了。`);
        } catch (panelError) {
          logger.error(
            `${logPrefix} [启用禁用] 显示当前状态面板失败，发送文本回退:`,
            panelError
          );
          await e.reply(
            `${logPrefix} 图库已经是「${action}」状态了，无需更改。`,
            true
          );
        }
        MiaoPluginMBT.configMutex.release();
        
        return true;
      }

      MiaoPluginMBT.MBTConfig.TuKuOP = enable;
      configChanged = true;
      //logger.info(`${logPrefix} [启用禁用] 内存状态变更为 -> ${enable}`); //调试日志-精简

      
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(
        MiaoPluginMBT.MBTConfig,
        logger
      );
      if (!saveSuccess) {
        saveWarning = "⚠️ 配置保存失败！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.TuKuOP = !enable;
        configChanged = false;
        logger.error(`${logPrefix} [启用禁用] 保存失败，内存状态已回滚。`);
        await this.ReportError(
          e,
          `${action}咕咕牛`,
          new Error("保存配置失败"),
          saveWarning
        );
        MiaoPluginMBT.configMutex.release();
        
        return true;
      }
      
    } catch (configError) {
      logger.error(`${logPrefix} [启用禁用] 处理配置时出错:`, configError);
      await this.ReportError(
        e,
        `${action}咕咕牛`,
        configError,
        "处理配置时出错"
      );
      MiaoPluginMBT.configMutex.release();
      
      return true;
    } finally {
      MiaoPluginMBT.configMutex.release();
      
    }

    if (configChanged) {
      try {
        if (enable) {
          await MiaoPluginMBT.SyncCharacterFolders(logger);
          await MiaoPluginMBT.GenerateAndApplyBanList(
            MiaoPluginMBT._imgDataCache,
            logger
          );
        } else {
          await MiaoPluginMBT.CleanTargetCharacterDirs(
            MiaoPluginMBT.paths.target.miaoChar,
            logger
          );
          await MiaoPluginMBT.CleanTargetCharacterDirs(
            MiaoPluginMBT.paths.target.zzzChar,
            logger
          );
          await MiaoPluginMBT.CleanTargetCharacterDirs(
            MiaoPluginMBT.paths.target.wavesChar,
            logger
          );
        }
      } catch (error) {
        asyncError = error;
        logger.error(`${logPrefix} [启用禁用] 后台操作失败:`, error);
        await this.ReportError(e, `${action}咕咕牛 (后台操作)`, error);
      }
    }

    let panelSent = false;
    try {
      let extraPanelMsg = "";
      if (asyncError)
        extraPanelMsg += `\n(后台${
          action === "启用" ? "同步" : "清理"
        }时遇到问题)`;
      if (saveWarning) extraPanelMsg += `\n${saveWarning}`;
      await this.ShowSettingsPanel(e, extraPanelMsg.trim());
      panelSent = true;
    } catch (panelError) {
      logger.error(
        `${logPrefix} [启用禁用] 显示设置面板失败，将发送文本回退:`,
        panelError
      );
      panelSent = false;
      let finalUserMessage = `${logPrefix} 图库已成功设为「${action}」，但面板图片发送失败。`;
      if (asyncError)
        finalUserMessage += `\n(后台${
          enable ? "同步" : "清理"
        }时遇到问题，详见日志)`;
      if (saveWarning) finalUserMessage += `\n${saveWarning}`;
      await e.reply(finalUserMessage, true);
    }

    return true;
  }


  /**
   * @description 处理封禁相关命令 (#咕咕牛封禁, #咕咕牛解禁, #ban列表)。
   *              简化 PFL 标记为 [净化]。
   */
  async ManageUserBans(e) {
    if (!(await this.CheckInit(e))) return true;
    const msg = e.msg.trim();
    const isMaster = e.isMaster;
    const logPrefix = this.logPrefix;
    const logger = this.logger;

    if (
      (msg.startsWith("#咕咕牛封禁 ") || msg.startsWith("#咕咕牛解禁 ")) &&
      !isMaster
    )
      return e.reply(`${logPrefix} 只有主人才能进行封禁或解禁操作哦~`);

    //  处理 #ban列表 或 #咕咕牛封禁列表
    if (msg === "#ban列表" || msg === "#咕咕牛封禁列表") {
      const activeBanCount = MiaoPluginMBT._activeBanSet.size;
      const userBanCount = MiaoPluginMBT._userBanSet.size;
      const currentPFL = MiaoPluginMBT.MBTConfig?.PFL ?? Purify_Level.NONE;
      const config = MiaoPluginMBT.MBTConfig;

      if (activeBanCount === 0) {
        return e.reply("当前没有任何图片被封禁。", true);
      }

      await e.reply(`正在整理列表，可能需要一点时间...`, true);

      const purifiedBansData = [];
      const userBansData = [];
      const pluginVersion = MiaoPluginMBT.GetVersionStatic();

      const sortedActiveBans = Array.from(MiaoPluginMBT._activeBanSet).sort();
      await Promise.all(
        sortedActiveBans.map(async (relativePath) => {
          const fileName = path.basename(relativePath);
          const fileNameNoExt = fileName.replace(/\.webp$/i, "");
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(
            relativePath
          );
          const thumbnailPath = absolutePath
            ? `file://${absolutePath.replace(/\\/g, "/")}`
            : "";

          if (MiaoPluginMBT._userBanSet.has(relativePath)) {
            userBansData.push({ fileNameNoExt, thumbnailPath });
          } else {
            const imgData = MiaoPluginMBT._imgDataCache.find(
              (img) => img.path?.replace(/\\/g, "/") === relativePath
            );
            const reasons = [];

            if (
              imgData &&
              currentPFL > Purify_Level.NONE &&
              MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, currentPFL)
            ) {
              reasons.push("净化");
            }

            if (imgData?.attributes) {
              const attrs = imgData.attributes;
              if (config?.Ai === false && attrs.isAiImage === true)
                reasons.push("Ai");
              if (config?.EasterEgg === false && attrs.isEasterEgg === true)
                reasons.push("彩蛋");
              if (config?.layout === false && attrs.layout === "fullscreen")
                reasons.push("横屏");
            }

            if (reasons.length === 0) {
              reasons.push("未知");
              logger.warn(
                `${logPrefix} [封禁列表] 图片 ${relativePath} 在生效列表但未找到明确屏蔽原因?`
              );
            }

            purifiedBansData.push({ fileNameNoExt, thumbnailPath, reasons });
          }
        })
      );

      let manualSent = false;
      const sourceHtmlPath = path.join(
        MiaoPluginMBT.paths.commonResPath,
        "html",
        "banlist.html"
      );
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      if (userBansData.length > 0) {
        logger.info(
          `${logPrefix} [封禁列表] 准备生成手动列表图片 (${userBansData.length}项)...`
        );
        let tempHtmlFilePathManual = "";
        let tempImgFilePathManual = "";
        try {
          const renderDataManual = {
            pluginVersion: pluginVersion,
            purifiedBans: [],
            userBans: userBansData,
            listType: "手动封禁",
            scaleStyleValue: scaleStyleValue,
            batchInfo: "",
          };
          await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
            recursive: true,
          });
          await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
            recursive: true,
          });
          const timestampManual = Date.now();
          tempHtmlFilePathManual = path.join(
            MiaoPluginMBT.paths.tempHtmlPath,
            `banlist-manual-${timestampManual}.html`
          );
          tempImgFilePathManual = path.join(
            MiaoPluginMBT.paths.tempImgPath,
            `banlist-manual-${timestampManual}.png`
          );
          await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePathManual);
          const img = await puppeteer.screenshot("guguniu-banlist-manual", {
            tplFile: tempHtmlFilePathManual,
            savePath: tempImgFilePathManual,
            imgType: "png",
            pageGotoParams: { waitUntil: "networkidle0" },
            ...renderDataManual,
            screenshotOptions: { fullPage: true },
            width: 640,
          });
          if (img) {
            await e.reply(img);
            manualSent = true;
            //logger.info(`${logPrefix} [封禁列表] 手动封禁列表图片已发送。`);
            if (purifiedBansData.length > 0) {
              await common.sleep(1000);
            }
          } else {
            logger.error(`${logPrefix} [封禁列表] 生成手动列表截图失败。`);
          }
        } catch (renderError) {
          logger.error(
            `${logPrefix} [封禁列表] 生成手动列表截图时出错:`,
            renderError
          );
          await this.ReportError(e, "生成手动封禁列表", renderError);
        } finally {
          if (tempHtmlFilePathManual && fs.existsSync(tempHtmlFilePathManual)) {
            try {
              await fsPromises.unlink(tempHtmlFilePathManual);
            } catch (unlinkErr) {}
          }
          if (tempImgFilePathManual && fs.existsSync(tempImgFilePathManual)) {
            try {
              await fsPromises.unlink(tempImgFilePathManual);
            } catch (unlinkErr) {}
          }
        }
      } else {
        logger.info(`${logPrefix} [封禁列表] 无手动封禁项。`);
      }

      if (purifiedBansData.length > 0) {
        logger.info(
          `${logPrefix} [封禁列表] 检测到 ${purifiedBansData.length} 项自动屏蔽项，开始分批处理...`
        );
        const ITEMS_PER_BATCH = 28;
        const totalItemsPurified = purifiedBansData.length;
        const totalBatchesPurified = Math.ceil(
          totalItemsPurified / ITEMS_PER_BATCH
        );
        const forwardListPurified = [];
        const forwardTitle = `[自动屏蔽列表 (共 ${totalItemsPurified} 项)]`;
        forwardListPurified.push([forwardTitle]);

        for (let batchNum = 1; batchNum <= totalBatchesPurified; batchNum++) {
          const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
          const endIndex = Math.min(
            startIndex + ITEMS_PER_BATCH,
            totalItemsPurified
          );
          const currentBatchData = purifiedBansData.slice(startIndex, endIndex);
          logger.info(
            `${logPrefix} [封禁列表] 准备生成自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批 (${currentBatchData.length} 项)...`
          );
          let tempHtmlFilePathPurified = "";
          let tempImgFilePathPurified = "";
          const timestampPurified = `${Date.now()}-batch${batchNum}`;
          try {
            const renderDataPurifiedBatch = {
              pluginVersion: pluginVersion,
              purifiedBans: currentBatchData,
              userBans: [],
              listType: "自动屏蔽",
              scaleStyleValue: scaleStyleValue,
              batchInfo: `(第 ${batchNum} / ${totalBatchesPurified} 批)`,
            };
            await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
              recursive: true,
            });
            await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
              recursive: true,
            });
            tempHtmlFilePathPurified = path.join(
              MiaoPluginMBT.paths.tempHtmlPath,
              `banlist-auto-${timestampPurified}.html`
            );
            tempImgFilePathPurified = path.join(
              MiaoPluginMBT.paths.tempImgPath,
              `banlist-auto-${timestampPurified}.png`
            );
            await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePathPurified);
            const imgBatch = await puppeteer.screenshot(
              `guguniu-banlist-auto-batch${batchNum}`,
              {
                tplFile: tempHtmlFilePathPurified,
                savePath: tempImgFilePathPurified,
                imgType: "png",
                pageGotoParams: { waitUntil: "networkidle0" },
                ...renderDataPurifiedBatch,
                screenshotOptions: { fullPage: true },
                width: 640,
              }
            );
            if (imgBatch) {
              forwardListPurified.push(imgBatch);
              logger.info(
                `${logPrefix} [封禁列表] 自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批图片生成成功。`
              );
            } else {
              logger.error(
                `${logPrefix} [封禁列表] 生成自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批截图失败。`
              );
              forwardListPurified.push(
                `[❌ 第 ${batchNum}/${totalBatchesPurified} 批渲染失败]`
              );
            }
          } catch (renderBatchError) {
            logger.error(
              `${logPrefix} [封禁列表] 生成自动屏蔽列表第 ${batchNum}/${totalBatchesPurified} 批截图时出错:`,
              renderBatchError
            );
            forwardListPurified.push(
              `[❌ 第 ${batchNum}/${totalBatchesPurified} 批处理出错]`
            );
            await this.ReportError(
              e,
              `生成自动屏蔽列表 (批次 ${batchNum})`,
              renderBatchError
            );
          } finally {
            if (
              tempHtmlFilePathPurified &&
              fs.existsSync(tempHtmlFilePathPurified)
            ) {
              try {
                await fsPromises.unlink(tempHtmlFilePathPurified);
              } catch (unlinkErr) {}
            }
            if (
              tempImgFilePathPurified &&
              fs.existsSync(tempImgFilePathPurified)
            ) {
              try {
                await fsPromises.unlink(tempImgFilePathPurified);
              } catch (unlinkErr) {}
            }
          }
        }

        if (forwardListPurified.length > 1) {
          try {
            const forwardMsgPurified = await common.makeForwardMsg(
              e,
              forwardListPurified,
              "自动屏蔽列表详情"
            );
            if (forwardMsgPurified) {
              await e.reply(forwardMsgPurified);
              // logger.info(`${logPrefix} [封禁列表] 合并的自动屏蔽列表消息已发送。`);
            } else {
              logger.error(
                `${logPrefix} [封禁列表] 创建自动屏蔽列表合并消息失败 (makeForwardMsg 返回空)。`
              );
              await e.reply(
                "生成合并的自动屏蔽列表消息失败 (内部错误)。",
                true
              );
            }
          } catch (sendForwardError) {
            logger.error(
              `${logPrefix} [封禁列表] 发送自动屏蔽列表合并消息失败:`,
              sendForwardError
            );
            await e.reply("发送合并的自动屏蔽列表消息失败，请查看日志。", true);
          }
        } else {
          logger.warn(
            `${logPrefix} [封禁列表] 自动屏蔽列表处理后为空，未发送合并消息。`
          );
          if (!manualSent) {
            await e.reply(
              "当前没有手动封禁，也没有被自动规则屏蔽的图片。",
              true
            );
          }
        }
      } else {
        logger.info(
          `${logPrefix} [封禁列表] 没有被 PFL 或全局开关屏蔽的图片。`
        );
        if (!manualSent) {
          await e.reply("当前没有手动封禁，也没有被自动规则屏蔽的图片。", true);
        }
      }

      if (
        userBansData.length > 0 &&
        !manualSent &&
        purifiedBansData.length === 0
      ) {
        await e.reply("生成手动封禁列表图片失败了，请检查日志。", true);
      }

      return true;
    }

    //  处理 #咕咕牛封禁 / #咕咕牛解禁
    const addMatch = msg.match(/^#咕咕牛封禁\s*(.+)/i);
    const delMatch = msg.match(/^#咕咕牛解禁\s*(.+)/i);
    if (addMatch || delMatch) {
      const isAdding = !!addMatch;
      const targetIdentifierRaw = (isAdding ? addMatch[1] : delMatch[1]).trim();
      const actionVerb = isAdding ? "封禁" : "解禁";
      if (!targetIdentifierRaw) {
        return e.reply(
          `要${actionVerb}哪个图片呀？格式：#咕咕牛${actionVerb}角色名+编号`,
          true
        );
      }
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw);
      if (!parsedId) {
        return e.reply("格式好像不对哦，应该是 角色名+编号", true);
      }
      const { mainName: rawMainName, imageNumber } = parsedId;
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(
        rawMainName,
        logger
      );
      const standardMainName = aliasResult.exists
        ? aliasResult.mainName
        : rawMainName;
      const expectedFilenameLower = `${standardMainName.toLowerCase()}gu${imageNumber}.webp`;
      const imageData = MiaoPluginMBT._imgDataCache.find(
        (img) =>
          img.characterName === standardMainName &&
          img.path
            ?.toLowerCase()
            .replace(/\\/g, "/")
            .endsWith(`/${expectedFilenameLower}`)
      );
      if (!imageData || !imageData.path) {
        let hint = `(可能原因：编号不存在、角色名/别名打错了？)`;
        const roleExistsInData = MiaoPluginMBT._imgDataCache.some(
          (img) => img.characterName === standardMainName
        );
        if (!roleExistsInData) {
          hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)`;
        } else {
          hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)`;
        }
        return e.reply(
          `在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`,
          true
        );
      }
      const targetRelativePath = imageData.path.replace(/\\/g, "/");
      const targetFileName = path.basename(targetRelativePath);
      await this.PerformBanOperation(
        e,
        isAdding,
        targetRelativePath,
        targetFileName,
        actionVerb
      );
      return true;
    }

    return false;
  }

  /**
   * @description 执行具体的封禁或解禁操作，更新内存状态、保存文件并应用。
   *              移除 banMutex 锁。
   */
  async PerformBanOperation(
    e,
    isAdding,
    targetRelativePath,
    targetFileName,
    actionVerb
  ) {
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    let configChanged = false;
    let replyMsg = "";
    let saved = false;
    let needsRestore = false;

    try {
      const currentPFL =
        MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
      const imgData = MiaoPluginMBT._imgDataCache.find(
        (img) => img.path?.replace(/\\/g, "/") === targetRelativePath
      );

      if (
        currentPFL > Purify_Level.NONE &&
        imgData &&
        MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, currentPFL)
      ) {
        replyMsg = `⚠️ ${targetFileName} 受到当前的净化规则 (等级 ${currentPFL}) 屏蔽，无法进行手动${actionVerb}操作。`;
        logger.warn(
          `${logPrefix} [${actionVerb}] 操作被阻止，因为图片 ${targetFileName} 被 PFL ${currentPFL} 屏蔽。`
        );
        await e.reply(replyMsg, true);
        return;
      }

      const isCurrentlyUserBanned =
        MiaoPluginMBT._userBanSet.has(targetRelativePath);

      if (isAdding) {
        if (isCurrentlyUserBanned) {
          replyMsg = `${targetFileName} ❌️ 已经被你手动封禁啦。`;
        } else {
          try {
            MiaoPluginMBT._userBanSet.add(targetRelativePath);
            configChanged = true;
            logger.info(
              `${logPrefix} [${actionVerb}] 添加到内存封禁列表: ${targetRelativePath}`
            );
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) {
              logger.error(
                `${logPrefix} [${actionVerb}] 保存用户封禁列表失败！`
              );
              MiaoPluginMBT._userBanSet.delete(targetRelativePath);
              replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`;
              configChanged = false;
              await this.ReportError(
                e,
                `${actionVerb}图片`,
                new Error("保存封禁列表失败")
              );
            } else {
              replyMsg = `${targetFileName} 🚫 已经封禁了。`;
            }
          } catch (err) {
            logger.error(
              `${logPrefix} [${actionVerb}] 添加封禁时发生内部错误:`,
              err
            );
            replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`;
            configChanged = false;
            await this.ReportError(e, `${actionVerb}图片`, err);
          }
        }
      } else {
        // 解禁
        if (!isCurrentlyUserBanned) {
          replyMsg = `${targetFileName} ❓ 咦？这个就没在你的封禁列表里呀。`;
        } else {
          try {
            MiaoPluginMBT._userBanSet.delete(targetRelativePath);
            configChanged = true;
            needsRestore = true;
            logger.info(
              `${logPrefix} [${actionVerb}] 从内存封禁列表移除: ${targetRelativePath}`
            );
            saved = await MiaoPluginMBT.SaveUserBans(logger);
            if (!saved) {
              logger.error(
                `${logPrefix} [${actionVerb}] 保存用户封禁列表失败！`
              );
              MiaoPluginMBT._userBanSet.add(targetRelativePath);
              replyMsg = `『咕咕牛』${actionVerb}失败了！没法保存封禁列表，刚才的操作可能没生效！`;
              configChanged = false;
              needsRestore = false;
              await this.ReportError(
                e,
                `${actionVerb}图片`,
                new Error("保存封禁列表失败")
              );
            } else {
              replyMsg = `${targetFileName} ✅️ 好嘞，已经从你的手动封禁列表里移除了。`;
            }
          } catch (err) {
            logger.error(
              `${logPrefix} [${actionVerb}] 解禁时发生内部错误:`,
              err
            );
            if (!MiaoPluginMBT._userBanSet.has(targetRelativePath)) {
              MiaoPluginMBT._userBanSet.add(targetRelativePath);
            }
            replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`;
            configChanged = false;
            needsRestore = false;
            await this.ReportError(e, `${actionVerb}图片`, err);
          }
        }
      }
    } catch (error) {
      logger.error(`${logPrefix} [${actionVerb}] 处理时发生意外错误:`, error);
      await this.ReportError(
        e,
        `${actionVerb}图片`,
        error,
        `目标: ${targetFileName}`
      );
      configChanged = false;
      needsRestore = false;
      replyMsg = `『咕咕牛』处理${actionVerb}操作时内部出错，操作未生效。`;
    }

    await e.reply(replyMsg, true);

    if (configChanged && saved) {
      setImmediate(async () => {
        try {
          await MiaoPluginMBT.GenerateAndApplyBanList(
            MiaoPluginMBT._imgDataCache,
            logger
          );
          // logger.info(`${logPrefix} [${actionVerb}] 操作后，后台已重新应用生效封禁列表。`); //调试日志-精简
          if (needsRestore) {
            const restored = await MiaoPluginMBT.RestoreFileFromSource(
              targetRelativePath,
              logger
            );
            if (!restored) {
              logger.warn(
                `${logPrefix} [解禁] 尝试恢复 ${targetFileName} 失败 (可能源文件丢失)。`
              );
            } else {
              logger.info(
                `${logPrefix} [解禁] 文件 ${targetFileName} 已尝试恢复。`
              );
            }
          }
        } catch (err) {
          logger.error(
            `${logPrefix} [${actionVerb}] 后台应用生效列表或恢复文件时出错:`,
            err
          );
          await this.ReportError(e, `${actionVerb}图片 (后台任务)`, err);
        }
      });
    }
  }

  /**
   * @description 处理 #查看 命令，显示指定角色的所有图片及状态。
   */
  async FindRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1)))
      return e.reply("『咕咕牛』核心库还没下载呢！", true);

    const match = e.msg.match(/^#查看\s*(.+)$/i);
    if (!match?.[1]) return e.reply("想看哪个角色呀？格式：#查看 角色名", true);

    const roleNameInput = match[1].trim();
    try {
      const { mainName, exists } = await MiaoPluginMBT.FindRoleAlias(
        roleNameInput,
        this.logger
      );
      const standardMainName = mainName || roleNameInput;

      const rawRoleImageData = MiaoPluginMBT._imgDataCache.filter(
        (img) => img.characterName === standardMainName
      );

      if (rawRoleImageData.length === 0) {
        const dirExists = await MiaoPluginMBT.CheckRoleDirExists(
          standardMainName
        );
        if (dirExists)
          return e.reply(
            `『${standardMainName}』的角色文件夹在，但是图库数据里没有图片信息哦。`
          );
        else
          return e.reply(`图库里好像没有『${standardMainName}』这个角色呢。`);
      }

      const config = MiaoPluginMBT.MBTConfig;
      const roleImageData = MiaoPluginMBT.FilterImagesBySwitches(
        rawRoleImageData,
        config
      );

      if (roleImageData.length === 0) {
        return e.reply(
          `根据当前的设置，没有找到『${standardMainName}』的可用图片。`,
          true
        );
      }

      roleImageData.sort(
        (a, b) =>
          parseInt(a.path?.match(/Gu(\d+)\.webp$/i)?.[1] || "0") -
          parseInt(b.path?.match(/Gu(\d+)\.webp$/i)?.[1] || "0")
      );

      const ITEMS_PER_BATCH = 28;
      const BATCH_SIZE = 28;
      const totalItems = roleImageData.length;
      const totalBatches = Math.ceil(totalItems / ITEMS_PER_BATCH);

      // this.logger.info(
      //   `${this.logPrefix} [查看] 角色 ${standardMainName} 共 ${totalItems} 张可用图片 (过滤后)，将分 ${totalBatches} 批发送。`
      // );
      //调试日志-精简

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        const startIndex = (batchNum - 1) * ITEMS_PER_BATCH;
        const endIndex = Math.min(startIndex + BATCH_SIZE, totalItems);
        const currentBatchData = roleImageData.slice(startIndex, endIndex);

        const batchTitle = `查看『${standardMainName}』 (${
          startIndex + 1
        }-${endIndex} / ${totalItems} 张)`;
        const currentForwardList = [[batchTitle]];
        if (batchNum === 1) {
          currentForwardList.push([
            `想导出图片？试试: #咕咕牛导出${standardMainName}1`,
          ]);
        }

        // this.logger.info(
        //   `${this.logPrefix} [查看] 正在准备第 ${batchNum}/${totalBatches} 批...`
        // );
        //调试日志-精简

        for (let i = 0; i < currentBatchData.length; i++) {
          const item = currentBatchData[i];
          const globalIndex = startIndex + i;

          const { path: relativePath } = item;
          if (!relativePath) continue;

          const normalizedPath = relativePath.replace(/\\/g, "/");
          const fileName = path.basename(normalizedPath);
          const baseName = fileName.replace(/\.webp$/i, "");

          const isEffectivelyBanned =
            MiaoPluginMBT._activeBanSet.has(normalizedPath);
          const isUserBanned = MiaoPluginMBT._userBanSet.has(normalizedPath);
          const isPurified = MiaoPluginMBT.CheckIfPurifiedByLevel(
            item,
            MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl
          );

          let labelStr = "";
          if (isEffectivelyBanned) {
            labelStr += " ❌封禁";
            if (isPurified && !isUserBanned) labelStr += " 🌱净化";
          }

          const entryText = `${globalIndex + 1}、${baseName}${labelStr}`;
          const absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(
            normalizedPath
          );

          if (absolutePath) {
            try {
              await fsPromises.access(absolutePath, fs.constants.R_OK);
              currentForwardList.push([
                entryText,
                segment.image(`file://${absolutePath}`),
              ]);
            } catch (accessErr) {
              this.logger.warn(
                `${this.logPrefix} [查看] 文件无法访问: ${absolutePath}`,
                accessErr.code
              );
              currentForwardList.push(`${entryText} (文件状态异常)`);
            }
          } else {
            this.logger.warn(
              `${this.logPrefix} [查看] 文件丢失: ${normalizedPath}`
            );
            currentForwardList.push(`${entryText} (文件丢失了...)`);
          }
        }

        if (currentForwardList.length > 1) {
          try {
            const forwardMsg = await common.makeForwardMsg(
              e,
              currentForwardList,
              `[${standardMainName}] 图库详情 (${batchNum}/${totalBatches})`
            );
            if (forwardMsg) {
              await e.reply(forwardMsg);
              // this.logger.info(`${this.logPrefix} [查看] 第 ${batchNum}/${totalBatches} 批已发送。`);
            } else {
              this.logger.error(
                `${this.logPrefix} [查看] common.makeForwardMsg 返回空 (批次 ${batchNum})`
              );
              await e.reply(
                `生成第 ${batchNum}/${totalBatches} 批图片列表失败了 (makeForwardMsg failed)。`,
                true
              );
            }
          } catch (sendError) {
            this.logger.error(
              `${this.logPrefix} [查看] 发送第 ${batchNum}/${totalBatches} 批合并转发消息失败:`,
              sendError
            );
            await e.reply(
              `发送第 ${batchNum}/${totalBatches} 批图片列表失败了，请检查后台日志。`,
              true
            );
          }

          if (batchNum < totalBatches) {
            await common.sleep(1500);
          }
        } else {
          this.logger.warn(
            `${this.logPrefix} [查看] 第 ${batchNum}/${totalBatches} 批为空，跳过发送。`
          );
        }
      }
    } catch (error) {
      await this.ReportError(e, `查看角色 ${roleNameInput}`, error);
    }
    return true;
  }

  /**
   * @description 处理 #可视化 命令，严格回归 V4.8.4 逻辑。
   */
  async VisualizeRoleSplashes(e) {
    if (!(await this.CheckInit(e))) return true;

    const match = e.msg.match(/^#可视化\s*(.+)$/i);
    if (!match?.[1])
      return e.reply("想可视化哪个角色呀？格式：#可视化角色名", true);
    const roleNameInput = match[1].trim();

    let standardMainName = "";
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    const BATCH_SIZE = 28;

    try {
      const aliasResult = await MiaoPluginMBT.FindRoleAlias(
        roleNameInput,
        logger
      );
      standardMainName = aliasResult.mainName || roleNameInput;

      let roleFolderPath = null;
      const targetDirsToCheck = [
        MiaoPluginMBT.paths.target.miaoChar,
        MiaoPluginMBT.paths.target.zzzChar,
        MiaoPluginMBT.paths.target.wavesChar,
      ].filter(Boolean);

      for (const targetDir of targetDirsToCheck) {
        if (!targetDir) continue;
        const potentialPath = path.join(targetDir, standardMainName);
        try {
          await fsPromises.access(potentialPath);
          const stats = await fsPromises.stat(potentialPath);
          if (stats.isDirectory()) {
            roleFolderPath = potentialPath;
            break;
          }
        } catch (err) {
          if (err.code !== ERROR_CODES.NotFound) {
            logger.warn(
              `${logPrefix} [可视化] 访问目标路径 ${potentialPath} 时出错 (非ENOENT):`,
              err.code
            );
          }
        }
      }

      if (!roleFolderPath) {
        logger.warn(
          `${logPrefix} [可视化] 未在任何目标插件目录中找到角色 '${standardMainName}' 的文件夹。`
        );
        return e.reply(
          `『${standardMainName}』不存在，可能是未同步/无该角色？`
        );
      }

      const supportedExtensions = [".jpg", ".png", ".jpeg", ".webp", ".bmp"];
      let allImageFiles = [];
      try {
        const files = await fsPromises.readdir(roleFolderPath);
        allImageFiles = files.filter((file) =>
          supportedExtensions.includes(path.extname(file).toLowerCase())
        );
        // logger.info(
        //   `${logPrefix} [可视化] 在 ${roleFolderPath} 中找到 ${allImageFiles.length} 个支持的图片文件。`
        // );
        //调试日志-精简
      } catch (readErr) {
        logger.error(
          `${logPrefix} [可视化] 读取角色文件夹失败: ${roleFolderPath}`,
          readErr
        );
        await this.ReportError(
          e,
          `可视化角色 ${standardMainName}`,
          readErr,
          "读取角色文件夹失败"
        );
        return true;
      }

      if (allImageFiles.length === 0) {
        logger.warn(
          `${logPrefix} [可视化] 角色文件夹 ${roleFolderPath} 为空或不包含支持的图片格式。`
        );
        return e.reply(
          `『${standardMainName}』的文件夹里没有找到支持的图片文件哦。`
        );
      }

      allImageFiles.sort((a, b) => {
        const numA = parseInt(a.match(/(\d+)\.\w+$/)?.[1] || "0");
        const numB = parseInt(b.match(/(\d+)\.\w+$/)?.[1] || "0");
        if (numA === numB) return a.localeCompare(b);
        return numA - numB;
      });

      const totalImageCount = allImageFiles.length;
      const totalBatches = Math.ceil(totalImageCount / BATCH_SIZE);

      // logger.info(
      //   `${logPrefix} [可视化] 找到 ${totalImageCount} 张图片，将分 ${totalBatches} 批发送...`
      // );
      //调试日志-精简
      await e.reply(
        `${logPrefix} 发现${totalImageCount}张 [${standardMainName}] 的图片, 分${totalBatches}批发送, 请注意查收~`
      );
      await common.sleep(500);

      let sourceTplFilePath = path.join(
        MiaoPluginMBT.paths.commonResPath,
        "html",
        "visualize.html"
      );
      try {
        await fsPromises.access(sourceTplFilePath);
        
      } catch (commonErr) {
        if (commonErr.code === ERROR_CODES.NotFound) {
          logger.warn(
            `${logPrefix} [可视化] 公共资源模板 (${sourceTplFilePath}) 未找到，尝试插件资源目录...`
          );
          sourceTplFilePath = path.resolve(
            __dirname,
            "..",
            "resources",
            "GuGuNiu-Gallery",
            "html",
            "visualize.html"
          );
          try {
            await fsPromises.access(sourceTplFilePath);
            
          } catch (pluginErr) {
            logger.error(
              `${logPrefix} [可视化] 主模板和备用模板均未找到: ${sourceTplFilePath}`,
              pluginErr
            );
            await e.reply(
              "生成可视化图片失败：缺少必要的 visualize.html 模板文件。"
            );
            return true;
          }
        } else {
          logger.error(
            `${logPrefix} [可视化] 访问公共资源模板时出错: ${sourceTplFilePath}`,
            commonErr
          );
          await e.reply("生成可视化图片失败：访问模板文件时出错。");
          return true;
        }
      }

      for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
        let tempHtmlFilePath = "";
        let tempImgFilePath = "";
        const tempFileNameBase = `visualize-${standardMainName.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}-batch${batchNum}-${Date.now()}`;

        try {
          const startIndex = (batchNum - 1) * BATCH_SIZE;
          const endIndex = Math.min(startIndex + BATCH_SIZE, totalImageCount);
          const currentBatchFiles = allImageFiles.slice(startIndex, endIndex);

          logger.info(
            `${logPrefix} [可视化] 正在生成第 ${batchNum}/${totalBatches} 批 (${currentBatchFiles.length} 张图片)...`
          );

          const imagesDataForRender = currentBatchFiles.map(
            (fileName, index) => {
              const isGu = /gu/i.test(fileName);
              return {
                fileName: fileName.replace(/\.\w+$/, ""),
                filePath: `file://${path
                  .join(roleFolderPath, fileName)
                  .replace(/\\/g, "/")}`,
                originalIndex: startIndex + index,
                isGu: isGu,
              };
            }
          );

          const pluginVersion = MiaoPluginMBT.GetVersionStatic();
          const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

          const renderData = {
            pluginVersion: pluginVersion,
            characterName: standardMainName,
            imageCount: totalImageCount,
            images: imagesDataForRender,
            batchNum: batchNum,
            totalBatches: totalBatches,
            batchStartIndex: startIndex,
            scaleStyleValue: scaleStyleValue,
          };

          await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
            recursive: true,
          });
          await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
            recursive: true,
          });
          tempHtmlFilePath = path.join(
            MiaoPluginMBT.paths.tempHtmlPath,
            `${tempFileNameBase}.html`
          );
          tempImgFilePath = path.join(
            MiaoPluginMBT.paths.tempImgPath,
            `${tempFileNameBase}.png`
          );

          try {
            await fsPromises.copyFile(sourceTplFilePath, tempHtmlFilePath);
          } catch (copyError) {
            logger.error(
              `${logPrefix} [可视化] 批次 ${batchNum}: 复制模板到临时文件失败:`,
              copyError
            );
            await e.reply(
              `生成第 ${batchNum}/${totalBatches} 批预览图失败：无法创建临时模板文件。`
            );
            continue;
          }

          let img = null;
          try {
            img = await puppeteer.screenshot(
              `guguniu-visualize-${standardMainName}-batch${batchNum}`,
              {
                tplFile: tempHtmlFilePath,
                savePath: tempImgFilePath,
                imgType: "png",
                pageGotoParams: { waitUntil: "networkidle0", timeout: 45000 },
                ...renderData,
                screenshotOptions: { fullPage: true },
                width: 800,
              }
            );
          } catch (screenshotError) {
            logger.error(
              `${logPrefix} [可视化] Puppeteer 生成第 ${batchNum}/${totalBatches} 批截图失败:`,
              screenshotError
            );
            if (screenshotError.message?.includes("timeout")) {
              await e.reply(
                `生成第 ${batchNum}/${totalBatches} 批预览图超时了...`
              );
            } else {
              await e.reply(
                `生成第 ${batchNum}/${totalBatches} 批预览图失败了，请查看控制台日志。`
              );
            }
            img = null;
          }

          if (img) {
            await e.reply(img);
            // logger.info(`${logPrefix} [可视化] 『${standardMainName}』第 ${batchNum}/${totalBatches} 批图片已发送。`);
          } else {
            logger.error(
              `${logPrefix} [可视化] 第 ${batchNum}/${totalBatches} 批截图生成失败或返回空。`
            );
          }
        } catch (batchProcessingError) {
          logger.error(
            `${logPrefix} [可视化] 处理第 ${batchNum}/${totalBatches} 批时发生错误:`,
            batchProcessingError
          );
          await e.reply(
            `处理第 ${batchNum}/${totalBatches} 批数据时出错，跳过此批次。`
          );
        } finally {
          if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
            try {
              await fsPromises.unlink(tempHtmlFilePath);
            } catch (unlinkErr) {}
          }
          if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
            try {
              await fsPromises.unlink(tempImgFilePath);
            } catch (unlinkErr) {}
          }
          const possiblePuppeteerTempDir = path.join(
            MiaoPluginMBT.paths.tempPath,
            "..",
            `guguniu-visualize-${standardMainName}-batch${batchNum}`
          );
          if (fs.existsSync(possiblePuppeteerTempDir)) {
            try {
              await safeDelete(possiblePuppeteerTempDir);
            } catch (deleteErr) {}
          }

          if (batchNum < totalBatches) {
            await common.sleep(2500);
          }
        }
      }

      // logger.info(
      //   `${logPrefix} [可视化] 『${standardMainName}』所有批次处理完成。`
      // );
      //调试日志-精简
    } catch (error) {
      logger.error(
        `${logPrefix} [可视化] 处理角色 '${roleNameInput}' 时发生顶层错误:`,
        error
      );
      await this.ReportError(e, `可视化角色 ${roleNameInput}`, error);
    } finally {
      if (standardMainName) {
        const possibleGenericDir = path.join(
          MiaoPluginMBT.paths.tempPath,
          "..",
          `guguniu-visualize-${standardMainName}`
        );
        if (fs.existsSync(possibleGenericDir)) {
          try {
            await safeDelete(possibleGenericDir);
          } catch (deleteErr) {}
        }
      }
      
    }
    return true;
  }

  /**
   * @description 处理 #咕咕牛导出 命令，发送指定图片文件。
   */
  async ExportSingleImage(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!(await MiaoPluginMBT.IsTuKuDownloaded(1)))
      return e.reply("『咕咕牛』核心库还没下载呢！", true);

    const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i);
    if (!match?.[1])
      return e.reply(
        "要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)",
        true
      );

    const targetIdentifierRaw = match[1].trim();
    let targetRelativePath = null;
    let targetFileName = "";
    let absolutePath = null;

    try {
      const parsedId = MiaoPluginMBT.ParseRoleIdentifier(targetIdentifierRaw);
      if (!parsedId)
        return e.reply("格式好像不对哦，应该是 角色名+编号，比如：花火1", true);
      const { mainName: rawMainName, imageNumber } = parsedId;

      const aliasResult = await MiaoPluginMBT.FindRoleAlias(
        rawMainName,
        this.logger
      );
      const standardMainName = aliasResult.exists
        ? aliasResult.mainName
        : rawMainName;

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
        else if (foundCount === 0 && MiaoPluginMBT._imgDataCache.length > 0)
          hint = `(图库里好像没有 '${standardMainName}' 这个角色哦)`;
        else if (foundCount > 0)
          hint = `(找到了角色 '${standardMainName}'，但是没有找到编号 ${imageNumber} 的图片)`;
        return e.reply(
          `在图库数据里没找到这个图片: ${standardMainName}Gu${imageNumber}。\n${hint}`,
          true
        );
      }

      targetRelativePath = imageData.path.replace(/\\/g, "/");
      targetFileName = path.basename(targetRelativePath);

      if (MiaoPluginMBT._activeBanSet.has(targetRelativePath)) {
        return e.reply(`图片 ${targetFileName} 被封禁了，不能导出哦。`, true);
      }

      absolutePath = await MiaoPluginMBT.FindImageAbsolutePath(
        targetRelativePath
      );
      if (!absolutePath) {
        return e.reply(`糟糕，文件丢失了：${targetFileName}，没法导出。`, true);
      }

      let fileBuffer = null;
      try {
        fileBuffer = await fsPromises.readFile(absolutePath);
        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error("读取到的文件 Buffer 为空");
        }
        this.logger.info(
          `${this.logPrefix} [导出] 成功读取文件到 Buffer: ${targetFileName}, 大小: ${fileBuffer.length} bytes`
        );
      } catch (readError) {
        this.logger.error(
          `${this.logPrefix} [导出] 读取文件失败: ${absolutePath}`,
          readError
        );
        await this.ReportError(
          e,
          `导出文件 ${targetFileName}`,
          readError,
          "读取文件失败"
        );
        return true;
      }

      // this.logger.info(
      //   `${this.logPrefix} 用户 ${e.user_id} 正在导出: ${targetFileName}`
      // );
      //调试日志-精简

      await e.reply(`📦 导出成功！给你 -> ${targetFileName}`);
      await common.sleep(200);

      const fileSegment = segment.file(fileBuffer, targetFileName);

      await e.reply(fileSegment);
    } catch (sendErr) {
      this.logger.error(
        `${this.logPrefix} 导出 ${
          targetFileName || targetIdentifierRaw
        } 时发送失败:`,
        sendErr
      );
      try {
        if (
          sendErr?.message?.includes("highway") ||
          sendErr?.message?.includes("file size") ||
          sendErr?.code === -36 ||
          sendErr?.code === 210005 ||
          sendErr?.code === 210003
        ) {
          await e.reply(
            `发送文件失败了,文件通道好像出了点问题 (${
              sendErr.code || "未知代码"
            })，可能是文件太大、网络不好或者被QQ限制了。`,
            true
          );
        } else {
          await this.ReportError(
            e,
            `导出文件 ${targetFileName || targetIdentifierRaw}`,
            sendErr
          );
        }
      } catch (replyError) {
        this.logger.error(
          `${this.logPrefix} 发送导出失败提示时也出错:`,
          replyError
        );
      }
    }
    return true;
  }

  /**
   * @description 处理 #咕咕牛帮助 命令。
   */
  async Help(e) {
    const networkHelpUrl =
      "https://s2.loli.net/2025/05/05/zirbKvjTAByl3HS.webp";
    const localHelpPath = MiaoPluginMBT.paths.helpImagePath;

    try {
      await fsPromises.access(localHelpPath, fs.constants.R_OK);
      await e.reply(segment.image(`file://${localHelpPath}`));
    } catch (localError) {
      if (localError.code !== ERROR_CODES.NotFound) {
        this.logger.warn(
          `${this.logPrefix} [帮助] 访问本地帮助图片失败:`,
          localError.code
        );
      }
      this.logger.info(
        `${this.logPrefix} [帮助] 本地帮助图 (${localHelpPath}) 加载失败，尝试发送在线版本...`
      );
      try {
        await e.reply(segment.image(networkHelpUrl));
      } catch (networkError) {
        this.logger.error(
          `${this.logPrefix} [帮助] 发送在线帮助图片也失败了:`,
          networkError.message
        );
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
            `#设置咕咕牛净化等级 [0|1|2] (主人用)\n` +
            `#启用咕咕牛 / #禁用咕咕牛 (主人用)\n` +
            `#咕咕牛导出 [角色名+编号] (导出图片文件)\n` +
            `#咕咕牛测速 (测下载速度)\n` +
            `#咕咕牛 (看版本和系统信息)\n` +
            `#咕咕牛设置[ai|彩蛋|横屏][开启|关闭] (主人用)`
        );
      }
    }
    return true;
  }

  /**
   * @description 处理 #咕咕牛触发错误 命令
   */
  async TriggerError(e) {
    if (!e.isMaster) return e.reply("仅限主人测试。");
    const match = e.msg.match(
      /#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?/i
    );
    const errorType = match?.[1]?.toLowerCase() || "other";
    let mockError = new Error(`模拟错误 (${errorType})`);
    this.logger.warn(
      `${this.logPrefix} 用户 ${e.user_id} 触发模拟错误: "${errorType}"...`
    );
    await e.reply(`${this.logPrefix} 触发类型 "${errorType}" ...`);
    try {
      switch (errorType) {
        case "git":
          mockError.message = "模拟Git失败";
          mockError.code = 128;
          mockError.stderr = "fatal: Repo not found";
          throw mockError;
        case "fs":
          mockError = new Error("模拟FS错误");
          mockError.code = ERROR_CODES.NotFound;
          await fsPromises.access("/non/existent/path");
          break;
        case "config":
          mockError = new Error("模拟配置失败");
          mockError.code = "YAMLParseError";
          throw mockError;
        case "data":
          mockError = new Error("模拟元数据失败");
          mockError.code = "JSONParseError";
          throw mockError;
        case "ref":
          mockError = new ReferenceError(
            "模拟引用错误: someUndefinedVariable is not defined"
          );
          console.log(someUndefinedVariable);
          break;
        case "type":
          mockError = new TypeError(
            "模拟类型错误: (intermediate value).iDontExist is not a function"
          );
          (123).iDontExist();
          break;
        case "Repo1":
          mockError = new Error("模拟一号仓库访问失败");
          mockError.code = ERROR_CODES.NotFound;
          await fsPromises.access(
            path.join(MiaoPluginMBT.paths.LocalTuKuPath, "non-existent")
          );
          break;
        case "Repo2":
          mockError = new Error("模拟二号仓库访问失败");
          mockError.code = ERROR_CODES.NotFound;
          if (await MiaoPluginMBT.IsTuKuDownloaded(2))
            await fsPromises.access(
              path.join(MiaoPluginMBT.paths.LocalTuKuPath2, "non-existent")
            );
          else throw new Error("二号仓库未下载，无法模拟访问失败");
          break;
        case "notify":
          this.logger.info(`${this.logPrefix} [触发错误] 模拟通知主人...`);
          const fakeCommitHash = Math.random().toString(16).substring(2, 9);
          const fakeDate = new Date()
            .toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .replace(",", "");
          const fakeLog = `${fakeDate.replace(
            "/",
            "-"
          )} [${fakeCommitHash}] fix: 这是一个模拟的更新成功通知`;
          const notifyMsg = `『咕咕牛🐂』定时更新成功！\n最新提交：${fakeLog}`;
          await MiaoPluginMBT.SendMasterMsg(
            notifyMsg,
            undefined,
            1000,
            this.logger
          );
          await e.reply(`${this.logPrefix} 已尝试发送模拟通知。`);
          return true;
        default:
          throw mockError;
      }
      throw mockError;
    } catch (error) {
      await this.ReportError(
        e,
        `模拟错误 (${errorType})`,
        error,
        `用户触发: ${e.msg}`
      );
    }
    return true;
  }


  /**
   * @description 处理 #咕咕牛测速 命令，测试代理节点速度并发送图片报告。
   *              模仿检查命令，使用 tplFile + ...data 截图方式。
   */
  async ManualTestProxies(e) {
    if (!(await this.CheckInit(e))) return true;
    await e.reply(`${this.logPrefix} 收到！开始火力全开测试网络节点...`, true);
    const startTime = Date.now();
    let speeds1 = [],
      best1 = null;
    let tempHtmlFilePath = "";
    let tempImgFilePath = "";
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    const sourceHtmlPath = path.join(
      MiaoPluginMBT.paths.commonResPath,
      "html",
      "speedtest.html"
    );

    try {
      try {
        await fsPromises.access(sourceHtmlPath);
        
      } catch (err) {
        logger.error(
          `${logPrefix} [手动测速] 找不到外部模板文件: ${sourceHtmlPath}`,
          err
        );
        await e
          .reply("生成测速报告失败：缺少 speedtest.html 模板文件。")
          .catch(() => {});
        return true;
      }

      speeds1 = await MiaoPluginMBT.TestProxies(RAW_URL_Repo1, logger);
      const available1 = MiaoPluginMBT.GetSortedAvailableSources(
        speeds1,
        true,
        logger
      );
      best1 = available1[0] || null;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      const processSpeeds = (speeds) => {
        return speeds
          .map((s) => {
            let statusText = "timeout";
            if (s.testUrlPrefix === null) statusText = "na";
            else if (Number.isFinite(s.speed) && s.speed >= 0)
              statusText = "ok";
            return { ...s, statusText };
          })
          .sort(
            (a, b) =>
              (a.priority ?? 999) - (b.priority ?? 999) ||
              (a.speed === Infinity || a.statusText === "na"
                ? 1
                : b.speed === Infinity || b.statusText === "na"
                ? -1
                : a.speed - b.speed)
          );
      };
      const processedSpeedsResult = processSpeeds(speeds1);
      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      const renderData = {
        speeds1: processedSpeedsResult,
        best1: best1,
        duration: duration,
        scaleStyleValue: scaleStyleValue,
      };
      

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
        recursive: true,
      });
      tempHtmlFilePath = path.join(
        MiaoPluginMBT.paths.tempHtmlPath,
        `manual-speedtest-temp-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}.html`
      );
      try {
        await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath);
        
      } catch (copyErr) {
        logger.error(`${logPrefix} [手动测速] 复制模板文件失败:`, copyErr);
        await this.ReportError(
          e,
          "手动网络测速",
          copyErr,
          "无法创建临时模板文件"
        );
        return true;
      }

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
        recursive: true,
      });
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `speedtest-${Date.now()}-${Math.random().toString(16).slice(2)}.png`
      );
      
      const img = await puppeteer.screenshot("guguniu-speedtest", {
        tplFile: tempHtmlFilePath,
        savePath: tempImgFilePath,
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        ...renderData,
        screenshotOptions: { fullPage: false },
        pageBoundingRect: { selector: "body", padding: 0 },
        width: 540,
      });

      if (img) {
        await e.reply(img);
      } else {
        logger.error(
          `${this.logPrefix} [手动测速] 生成截图失败 (Puppeteer 返回空)。`
        );
        await e.reply("生成测速报告图片失败了，请看看日志。");
      }
    } catch (error) {
      await this.ReportError(
        e,
        "手动网络测速",
        error,
        `测速结果(原始): ${JSON.stringify(speeds1)}`
      );
    } finally {
      if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
        try {
          await fsPromises.unlink(tempHtmlFilePath);
        } catch (unlinkErr) {}
      }
      if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
        try {
          await fsPromises.unlink(tempImgFilePath);
        } catch (unlinkErr) {}
      }
      const possiblePuppeteerTempDir = path.join(
        MiaoPluginMBT.paths.tempPath,
        "..",
        "guguniu-speedtest"
      );
      if (fs.existsSync(possiblePuppeteerTempDir)) {
        try {
          await safeDelete(possiblePuppeteerTempDir);
        } catch (deleteErr) {}
      }
    }
    return true;
  }
  /**
   * @description 显示设置面板图片。
   *              模仿检查命令，使用 tplFile + ...data 截图方式。
   */
  async ShowSettingsPanel(e, extraMsg = "") {
    if (!(await this.CheckInit(e))) return true;

    const logger = this.logger;
    const logPrefix = this.logPrefix;

    let tempHtmlFilePath = "";
    let tempImgFilePath = "";
    const sourceHtmlPath = path.join(
      MiaoPluginMBT.paths.commonResPath,
      "html",
      "settings_panel.html"
    );

    try {
      try {
        await fsPromises.access(sourceHtmlPath);
        
      } catch (err) {
        logger.error(
          `${logPrefix} [设置面板] 找不到模板文件: ${sourceHtmlPath}`,
          err
        );
        await e.reply("无法显示设置面板：缺少 settings_panel.html 模板文件。");
        return true;
      }

      const config = MiaoPluginMBT.MBTConfig;
      const tuKuEnabled = config?.TuKuOP ?? Default_Config.defaultTuKuOp;
      const pflLevel = config?.PFL ?? Default_Config.defaultPfl;
      const aiEnabled = config?.Ai ?? true;
      const easterEggEnabled = config?.EasterEgg ?? true;
      const layoutEnabled = config?.layout ?? true;
      const pm18Enabled = config?.PM18 ?? false;

      const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();

      const renderData = {
        pluginVersion: MiaoPluginMBT.GetVersionStatic(),
        tuKuStatus: {
          text: tuKuEnabled ? "已启用" : "已禁用",
          class: tuKuEnabled ? "value-enabled" : "value-disabled",
        },
        pflStatus: {
          level: pflLevel,
          description: Purify_Level.getDescription(pflLevel),
          class: `value-level-${pflLevel}`,
        },
        aiStatus: {
          text: aiEnabled ? "已开启" : "已关闭",
          class: aiEnabled ? "value-enabled" : "value-disabled",
        },
        easterEggStatus: {
          text: easterEggEnabled ? "已开启" : "已关闭",
          class: easterEggEnabled ? "value-enabled" : "value-disabled",
        },
        layoutStatus: {
          text: layoutEnabled ? "已开启" : "已关闭",
          class: layoutEnabled ? "value-enabled" : "value-disabled",
        },
        PM18Status: {
          text: pm18Enabled ? "已开启" : "已关闭",
          class: pm18Enabled ? "value-enabled" : "value-disabled",
        },
        scaleStyleValue: scaleStyleValue,
      };
      

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
        recursive: true,
      });
      tempHtmlFilePath = path.join(
        MiaoPluginMBT.paths.tempHtmlPath,
        `settings-panel-tpl-${Date.now()}.html`
      );
      await fsPromises.copyFile(sourceHtmlPath, tempHtmlFilePath);
      

      await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
        recursive: true,
      });
      tempImgFilePath = path.join(
        MiaoPluginMBT.paths.tempImgPath,
        `settings-${Date.now()}.png`
      );

      const screenshotData = { ...renderData };
      const img = await puppeteer.screenshot("guguniu-settings-panel", {
        tplFile: tempHtmlFilePath,
        savePath: tempImgFilePath,
        imgType: "png",
        pageGotoParams: { waitUntil: "networkidle0" },
        ...screenshotData,
        screenshotOptions: { fullPage: true },
        pageBoundingRect: { selector: ".panel", padding: 15 },
        width: 480,
      });

      if (img) {
        if (extraMsg) {
          await e.reply(extraMsg, true);
          await common.sleep(300);
        }
        await e.reply(img);
      } else {
        logger.error(
          `${logPrefix} [设置面板] Puppeteer 未能成功生成图片 (返回空)。`
        );
        await e.reply("生成设置面板图片失败，请查看日志。");
      }
    } catch (error) {
      logger.error(`${logPrefix} [设置面板] 生成或发送面板时发生错误:`, error);
      if (error.message?.includes("Cannot read properties of undefined")) {
        logger.error(
          `${logPrefix} [设置面板] [诊断] 截图报错 'Cannot read properties of undefined'，请再次确认模板文件 (${sourceHtmlPath}) 中的变量名 (如 tuKuStatus.class) 是否与代码中 renderData 的结构完全一致！`
        );
      }
      await this.ReportError(e, "显示设置面板", error);
    } finally {
      if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
        try {
          await fsPromises.unlink(tempHtmlFilePath);
        } catch (unlinkErr) {}
      }
      if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
        try {
          await fsPromises.unlink(tempImgFilePath);
        } catch (unlinkErr) {}
      }
      const possiblePuppeteerTempDir = path.join(
        MiaoPluginMBT.paths.tempPath,
        "..",
        "guguniu-settings-panel"
      );
      if (fs.existsSync(possiblePuppeteerTempDir)) {
        try {
          await safeDelete(possiblePuppeteerTempDir);
        } catch (deleteErr) {}
      }
    }
    return true;
  }

  /**
   * @description 处理统一的 #咕咕牛设置 命令。
   */
  async HandleSettingsCommand(e) {
    if (!(await this.CheckInit(e))) return true;
    if (!e.isMaster)
      return e.reply(`${this.logPrefix} 只有主人才能使用设置命令哦~`);

    const match = e.msg.match(
      /^#咕咕牛设置(ai|彩蛋|横屏|净化等级|pm18)([012]|开启|关闭)$/i
    );
    if (!match || !match[1] || !match[2]) {
      this.logger.warn(
        `${this.logPrefix} [统一设置] 正则匹配异常? msg: ${e.msg}`
      );
      return false;
    }

    const featureKeyRaw = match[1].toLowerCase();
    const valueRaw = match[2];
    const logger = this.logger;
    const logPrefix = this.logPrefix;

    

    if (featureKeyRaw === "净化等级") {
      const level = parseInt(valueRaw, 10);
      if (isNaN(level) || ![0, 1, 2].includes(level)) {
        return e.reply(
          `无效的净化等级值: ${valueRaw}，只能是 0, 1, 或 2。`,
          true
        );
      }
      
      await this.setPurificationLevelInternal(e, level);
    } else {
      if (!["开启", "关闭"].includes(valueRaw)) {
        if (!(featureKeyRaw === "pm18" && ["0", "1"].includes(valueRaw))) {
          return e.reply(
            `无效的操作: ${valueRaw}，请使用 '开启' 或 '关闭'。`,
            true
          );
        }
      }

      const enable = valueRaw === "开启" || valueRaw === "1";
      let configKey = "";
      let featureName = "";
      switch (featureKeyRaw) {
        case "ai":
          configKey = "Ai";
          featureName = "Ai 图";
          break;
        case "彩蛋":
          configKey = "EasterEgg";
          featureName = "彩蛋图";
          break;
        case "横屏":
          configKey = "layout";
          featureName = "横屏图";
          break;
        case "pm18":
          configKey = "PM18";
          featureName = "PM18 功能";
          break;
        default:
          logger.error(
            `${logPrefix} [统一设置] 未知的 featureKeyRaw: ${featureKeyRaw}`
          );
          return false;
      }
      
      await this.handleSwitchCommand(e, configKey, featureName, enable);
    }
    return true;
  }

  /**
   * @description 处理净化等级设置的核心逻辑 (从旧 SetPurificationLevel 迁移并修改)。
   *              由 HandleSettingsCommand 调用。
   */
  async setPurificationLevelInternal(e, level) {
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    let configChanged = false;
    let saveWarning = "";
    let asyncError = null;

    
    await MiaoPluginMBT.configMutex.acquire();
    
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentLevel =
        MiaoPluginMBT.MBTConfig.PFL ?? Default_Config.defaultPfl;
      

      if (level === currentLevel) {
        logger.info(`${logPrefix} [净化设置] 等级未变，尝试显示面板。`);
        try {
          await this.ShowSettingsPanel(
            e,
            `净化等级已经是 ${level} (${Purify_Level.getDescription(
              level
            )}) 啦。`
          );
        } catch (panelError) {
          logger.error(
            `${logPrefix} [净化设置] 显示当前状态面板失败，发送文本回退:`,
            panelError
          );
          await e.reply(
            `${logPrefix} 净化等级已经是 ${level} (${Purify_Level.getDescription(
              level
            )}) 啦。`,
            true
          );
        }
        MiaoPluginMBT.configMutex.release();
        
        return;
      }

      MiaoPluginMBT.MBTConfig.PFL = level;
      configChanged = true;
      logger.info(`${logPrefix} [净化设置] 内存状态变更为 -> ${level}`);

      
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(
        MiaoPluginMBT.MBTConfig,
        logger
      );
      if (!saveSuccess) {
        saveWarning = "⚠️ 但是配置保存失败了！设置可能不会持久生效。";
        MiaoPluginMBT.MBTConfig.PFL = currentLevel;
        configChanged = false;
        logger.error(`${logPrefix} [净化设置] 保存失败，内存状态已回滚。`);
        await this.ReportError(
          e,
          "设置净化等级",
          new Error("保存配置失败"),
          saveWarning
        );
        MiaoPluginMBT.configMutex.release();
        
        return;
      }
      
    } catch (configError) {
      logger.error(`${logPrefix} [净化设置] 处理配置时出错:`, configError);
      await this.ReportError(e, "设置净化等级", configError, "处理配置时出错");
      MiaoPluginMBT.configMutex.release();
      
      return;
    } finally {
      MiaoPluginMBT.configMutex.release();
      
    }

    if (configChanged) {
      
      setImmediate(async () => {
        
        try {
          logger.info(
            `${logPrefix} [净化设置] 后台开始应用新的净化等级 ${level}...`
          );
          
          await MiaoPluginMBT.GenerateAndApplyBanList(
            MiaoPluginMBT._imgDataCache,
            logger
          );
          logger.info(`${logPrefix} [净化设置] 新的生效封禁列表已应用。`);
          if (MiaoPluginMBT.MBTConfig.TuKuOP) {
            logger.info(
              `${logPrefix} [净化设置] 图库已启用，开始重新同步角色文件夹...`
            );
            
            await MiaoPluginMBT.SyncCharacterFolders(logger);
            logger.info(`${logPrefix} [净化设置] 角色文件夹重新同步完成。`);
          } else {
            logger.info(
              `${logPrefix} [净化设置] 图库已禁用，跳过角色文件夹同步。`
            );
          }
        } catch (applyError) {
          logger.error(
            `${logPrefix} [净化设置] 后台应用或同步时出错:`,
            applyError
          );
          asyncError = applyError;
          await this.ReportError(e, "应用净化等级 (后台)", applyError);
        } finally {
          
          let panelSent = false;
          try {
            let extraPanelMsg = "";
            if (asyncError) extraPanelMsg += `\n(后台应用时遇到问题)`;
            if (saveWarning) extraPanelMsg += `\n${saveWarning}`;
            await this.ShowSettingsPanel(e, extraPanelMsg.trim());
            panelSent = true;
            
          } catch (panelError) {
            logger.error(
              `${logPrefix} [净化设置] 显示设置面板失败，将发送文本回退:`,
              panelError
            );
            panelSent = false;
            let finalUserMessage = `${logPrefix} 净化等级已设为 ${level} (${Purify_Level.getDescription(
              level
            )})。`;
            if (level === Purify_Level.PX18_PLUS)
              finalUserMessage += "\n(Px18 指轻微性暗示或低度挑逗性图片)";
            if (saveWarning) finalUserMessage += `\n${saveWarning}`;
            if (asyncError) finalUserMessage += "\n(后台应用时出错，详见日志)";
            await e.reply(finalUserMessage, true);
          }
        }
      });
    }
    
  }

  /**
   * @description 通用的开关命令处理逻辑 (从旧 SetFeatureSwitch 迁移并修改)。
   *              由 HandleSettingsCommand 调用。
   *              增加 enable 参数，移除命令解析。
   */
  async handleSwitchCommand(e, configKey, featureName, enable) {
    const logger = this.logger;
    const logPrefix = this.logPrefix;
    

    let configChanged = false;
    let saveWarning = "";
    let asyncError = null;
    let backgroundTaskMsg = "";

    
    await MiaoPluginMBT.configMutex.acquire();
    
    try {
      
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      const currentStatus = MiaoPluginMBT.MBTConfig[configKey];
      

      if (currentStatus === enable) {
        logger.info(
          `${logPrefix} [${featureName}设置] 当前状态已是 ${
            enable ? "开启" : "关闭"
          }，无需更改。`
        );
        try {
          await this.ShowSettingsPanel(
            e,
            `${featureName}已经是「${enable ? "开启" : "关闭"}」状态了。`
          );
        } catch (panelError) {
          logger.error(
            `${logPrefix} [${featureName}设置] 显示当前状态面板失败，发送文本回退:`,
            panelError
          );
          await e.reply(
            `${logPrefix} ${featureName}已经是「${
              enable ? "开启" : "关闭"
            }」状态了，无需更改。`,
            true
          );
        }
        MiaoPluginMBT.configMutex.release();
        
        return;
      }
      MiaoPluginMBT.MBTConfig[configKey] = enable;
      configChanged = true;
      logger.info(
        `${logPrefix} [${featureName}设置] 内存状态变更为 -> ${enable}`
      );

      
      const saveSuccess = await MiaoPluginMBT.SaveTuKuConfig(
        MiaoPluginMBT.MBTConfig,
        logger
      );
      if (!saveSuccess) {
        saveWarning = `⚠️ 但是配置保存失败了！设置可能不会持久生效。`;
        MiaoPluginMBT.MBTConfig[configKey] = !enable;
        configChanged = false;
        logger.error(
          `${logPrefix} [${featureName}设置] 保存失败，内存状态已回滚。`
        );
        await this.ReportError(
          e,
          `设置${featureName}`,
          new Error("保存配置失败"),
          saveWarning
        );
        MiaoPluginMBT.configMutex.release();
        
        return;
      }
      
    } catch (configError) {
      logger.error(
        `${logPrefix} [${featureName}设置] 处理配置时出错:`,
        configError
      );
      await this.ReportError(
        e,
        `设置${featureName}`,
        configError,
        "处理配置时出错"
      );
      MiaoPluginMBT.configMutex.release();
      
      return;
    } finally {
      MiaoPluginMBT.configMutex.release();
      
    }

    if (configChanged) {
      if (configChanged && configKey === "PM18") {
        logger.info(
          `${logPrefix} [${featureName}设置] 配置已更改，准备启动任务`
        );
        backgroundTaskMsg = `\n⏳ ${enable ? "部署" : "清理"}任务已启动`;
        setImmediate(async () => {
          if (enable) {
            await MiaoPluginMBT.deployPM18Files(logger);
          } else {
            await MiaoPluginMBT.cleanPM18Files(logger);
          }
        });
      }
      let panelSent = false;
      try {
        let extraPanelMsg = "";
        if (saveWarning) extraPanelMsg += `\n${saveWarning}`;
        
        await this.ShowSettingsPanel(e, extraPanelMsg.trim());
        panelSent = true;
        
      } catch (panelError) {
        logger.error(
          `${logPrefix} [${featureName}设置] 显示设置面板失败，将发送文本回退:`,
          panelError
        );
        panelSent = false;
        let finalUserMessage = `${logPrefix} ${featureName}已成功设为「${
          enable ? "开启" : "关闭"
        }」，但面板图片发送失败。`;
        if (saveWarning) finalUserMessage += `\n${saveWarning}`;
        await e.reply(finalUserMessage, true);
      }
    }
    
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
      } catch (waitError) {}
      return MiaoPluginMBT.initializationPromise;
    }

    if (MiaoPluginMBT.initializationPromise) {
      return MiaoPluginMBT.initializationPromise;
    }
    if (MiaoPluginMBT.isGloballyInitialized) {
      return Promise.resolve();
    }

    MiaoPluginMBT.isInitializing = true;
    logger.info(
      `${logPrefix} 开始全局初始化(V${MiaoPluginMBT.GetVersionStatic()})...`
    );
    MiaoPluginMBT.isGloballyInitialized = false;

    MiaoPluginMBT.initializationPromise = (async () => {
      let fatalError = null;
      let localImgDataCache = [];

      try {
        const config = await MiaoPluginMBT.LoadTuKuConfig(true, logger);
        if (!config) throw new Error("无法加载图库配置");

        localImgDataCache = await MiaoPluginMBT.LoadImageData(true, logger);
        if (!Array.isArray(localImgDataCache)) {
          logger.error(
            `${logPrefix} [初始化] CRITICAL: 元数据加载失败或格式错误!`
          );
          localImgDataCache = [];
          throw new Error("加载图片元数据失败");
        } else if (localImgDataCache.length === 0) {
          logger.warn(`${logPrefix} [警告] 元数据为空`);
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
        } else if (
          Object.keys(MiaoPluginMBT._aliasData.combined).length === 0
        ) {
          logger.warn(`${logPrefix} [警告] 别名数据为空`);
        }

        await MiaoPluginMBT.GenerateAndApplyBanList(localImgDataCache, logger);
        MiaoPluginMBT._imgDataCache = Object.freeze(localImgDataCache);

        MiaoPluginMBT.isGloballyInitialized = true;
        logger.info(`${logPrefix} 全局初始化成功。`);

        if (!MiaoPluginMBT.oldFileDeletionScheduled) {
          MiaoPluginMBT.oldFileDeletionScheduled = true;
          const delaySeconds = 15;
          logger.info(
            `${logPrefix} [初始化] 已调度延迟 ${delaySeconds} 秒后清理旧文件任务。`
          );
          setTimeout(async () => {
            const oldPluginFileName = "咕咕牛图库下载器.js";
            const oldPluginPath = path.join(
              MiaoPluginMBT.paths.target.exampleJs,
              oldPluginFileName
            );
            try {
              await fsPromises.access(oldPluginPath);
              logger.warn(
                `${logPrefix} [延迟清理] 检测到旧插件文件 (${oldPluginFileName})，将尝试删除...`
              );
              await fsPromises.unlink(oldPluginPath);
              logger.info(
                `${logPrefix} [延迟清理] 旧插件文件 (${oldPluginFileName}) 已成功删除。`
              );
            } catch (err) {
              if (err.code !== ERROR_CODES.NotFound) {
                logger.error(
                  `${logPrefix} [延迟清理] 删除旧插件文件 (${oldPluginPath}) 时出错:`,
                  err
                );
              } else {
              }
            }
          }, delaySeconds * 1000);
        }
      } catch (error) {
        fatalError = error;
        MiaoPluginMBT.isGloballyInitialized = false;
        logger.error(
          `${logPrefix} !!! 全局初始化失败: ${fatalError.message} !!!`
        );
        logger.error(fatalError.stack);
        MiaoPluginMBT._imgDataCache = Object.freeze([]);
        MiaoPluginMBT._userBanSet = new Set();
        MiaoPluginMBT._activeBanSet = new Set();
        MiaoPluginMBT._aliasData = null;
        throw fatalError;
      } finally {
        MiaoPluginMBT.isInitializing = false;
      }
    })();

    MiaoPluginMBT.initializationPromise.catch((err) => {});

    return MiaoPluginMBT.initializationPromise;
  }

  /**
   * @description 加载图库配置文件。
   *              优化类型处理，兼容 YAML 中的 0/1，移除内部锁。
   */
  static async LoadTuKuConfig(
    forceReload = false,
    logger = global.logger || console,
    configPath = MiaoPluginMBT.paths.configFilePath
  ) {
    const logPrefix = Default_Config.logPrefix;
    try {
      if (
        !forceReload &&
        MiaoPluginMBT.MBTConfig &&
        Object.keys(MiaoPluginMBT.MBTConfig).length > 0
      ) {
        return MiaoPluginMBT.MBTConfig;
      }

      let configData = {};
      try {
        await fsPromises.access(configPath);
        const content = await fsPromises.readFile(configPath, "utf8");
        configData = yaml.parse(content) || {};
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound) {
          logger.info(
            `${logPrefix} [加载配置] ${configPath} 未找到，将使用默认配置。`
          );
          configData = {};
        } else {
          logger.error(
            `${logPrefix} [加载配置] 读取或解析配置文件 ${configPath} 失败:`,
            error
          );
          configData = {};
        }
      }

      const parseBoolOrNum = (value, defaultValue) => {
        if (value === 1 || String(value).toLowerCase() === "true") return true;
        if (value === 0 || String(value).toLowerCase() === "false")
          return false;
        return defaultValue;
      };

      const loadedConfig = {
        TuKuOP: parseBoolOrNum(configData.TuKuOP, Default_Config.defaultTuKuOp),
        PFL: configData.PFL ?? Default_Config.defaultPfl,
        Ai: parseBoolOrNum(configData.Ai, true),
        EasterEgg: parseBoolOrNum(configData.EasterEgg, true),
        layout: parseBoolOrNum(configData.layout, true),
        PM18: parseBoolOrNum(configData.PM18, false),
        Main_Github_URL: Default_Config.Main_Github_URL,
        Ass_Github_URL: Default_Config.Ass_Github_URL,
        Sexy_Github_URL: Default_Config.Sexy_Github_URL,
        SepositoryBranch: Default_Config.SepositoryBranch,
        cronUpdate: configData.cronUpdate ?? Default_Config.cronUpdate,
      };

      if (
        ![
          Purify_Level.NONE,
          Purify_Level.RX18_ONLY,
          Purify_Level.PX18_PLUS,
        ].includes(loadedConfig.PFL)
      ) {
        logger.warn(
          `${logPrefix} [加载配置] 检测到无效的净化等级配置 (${loadedConfig.PFL})，已重置为默认值 (${Default_Config.defaultPfl})。`
        );
        loadedConfig.PFL = Default_Config.defaultPfl;
      }

      MiaoPluginMBT.MBTConfig = loadedConfig;
      // logger.info(
      //   `${logPrefix} [加载配置] 完成: 图库=${
      //     loadedConfig.TuKuOP ? "开" : "关"
      //   }, PFL=${loadedConfig.PFL},  Ai=${loadedConfig.Ai}, 彩蛋=${
      //     loadedConfig.EasterEgg
      //   }, 横屏=${loadedConfig.layout}, PM18=${loadedConfig.PM18}`
      // );
      //调试日志-精简
      return MiaoPluginMBT.MBTConfig;
    } finally {
      // 无锁操作
    }
  }

  /**
   * @description 保存图库配置到文件。
   *              增加文件写入诊断日志，确认写入操作。
   */
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
      try {
        await fsPromises.mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        logger.error(
          `${logPrefix} [保存配置] 创建目录 ${dirPath} 失败:`,
          mkdirError
        );
        return false;
      }

 
      const yamlString = yaml.stringify(dataToSave);
      await fsPromises.writeFile(configFilePath, yamlString, "utf8");
      // logger.info(`${logPrefix} [保存配置] 成功保存配置到 ${configFilePath}`); //调试日志-精简

      MiaoPluginMBT.MBTConfig = { ...MiaoPluginMBT.MBTConfig, ...configData };
      return true;
    } catch (error) {
      logger.error(
        `${logPrefix} [保存配置] 写入配置文件 ${configFilePath} 失败:`,
        error
      );
      return false;
    }
  }

  /**
   * @description 加载图片元数据 (imagedata.json)，支持回退。
   */
  static async LoadImageData(
    forceReload = false,
    logger = global.logger || console
  ) {
    if (MiaoPluginMBT._imgDataCache?.length > 0 && !forceReload) {
      return MiaoPluginMBT._imgDataCache;
    }
    let data = null;
    let success = false;
    const primaryPath = MiaoPluginMBT.paths.imageDataPath;
    const secondaryPath = path.join(
      MiaoPluginMBT.paths.LocalTuKuPath,
      MiaoPluginMBT.paths.sourceFolders.gallery,
      path.basename(MiaoPluginMBT.paths.imageDataPath)
    );
    try {
      const content = await fsPromises.readFile(primaryPath, "utf8");
      data = JSON.parse(content);
      success = true;
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        try {
          await fsPromises.access(secondaryPath);
          const sourceContent = await fsPromises.readFile(
            secondaryPath,
            "utf8"
          );
          data = JSON.parse(sourceContent);
          logger.info(
            `${Default_Config.logPrefix} [加载元数据] 从仓库源加载成功: ${secondaryPath}`
          );
          success = true;
        } catch (srcError) {
          if (srcError.code === ERROR_CODES.NotFound) {
            data = null;
            success = false;
          } else {
            logger.error(
              `${Default_Config.logPrefix} [加载元数据] 加载或解析仓库源文件失败 (${secondaryPath}):`,
              srcError
            );
            data = null;
            success = false;
          }
        }
      } else {
        logger.error(
          `${Default_Config.logPrefix} [加载元数据] 读取或解析主路径文件失败 (${primaryPath}):`,
          error
        );
        data = null;
        success = false;
      }
    }
    let finalData = [];
    if (!success || !Array.isArray(data) || data.length === 0) {
      if (!success)
        logger.warn(
          `${Default_Config.logPrefix} [加载元数据] 无法从文件加载元数据，执行扫描回退...`
        );
      else
        logger.warn(
          `${Default_Config.logPrefix} [加载元数据] 加载的元数据为空或格式错误，执行扫描回退...`
        );
      try {
        finalData = await MiaoPluginMBT.ScanLocalImagesToBuildCache(logger);
        logger.info(
          `${Default_Config.logPrefix} [加载元数据] 扫描回退完成，找到 ${finalData.length} 个图片文件。`
        );
      } catch (scanError) {
        logger.error(
          `${Default_Config.logPrefix} [加载元数据] 扫描回退过程中发生错误:`,
          scanError
        );
        finalData = [];
      }
    } else {
      finalData = data;
    }
    if (Array.isArray(finalData)) {
      const originalCount = finalData.length;
      const validData = finalData
        .filter((item) => {
          const isBasicValid =
            item &&
            typeof item.path === "string" &&
            item.path.trim() !== "" &&
            typeof item.characterName === "string" &&
            item.characterName.trim() !== "" &&
            typeof item.attributes === "object" &&
            typeof item.storagebox === "string" &&
            item.storagebox.trim() !== "";
          if (!isBasicValid) {
            return false;
          }
          const pathRegex = /^[a-z]+-character\/[^/]+\/[^/]+Gu\d+\.webp$/i;
          const normalizedPath = item.path.replace(/\\/g, "/");
          const pathIsValid = pathRegex.test(normalizedPath);
          if (!pathIsValid)
            logger.warn(
              `${Default_Config.logPrefix} [加载元数据] 过滤掉格式错误的图片路径: ${item.path}`
            );
          return pathIsValid;
        })
        .map((item) => ({ ...item, path: item.path.replace(/\\/g, "/") }));
      const validCount = validData.length;
      const invalidCount = originalCount - validCount;
      if (invalidCount > 0)
        logger.warn(
          `${Default_Config.logPrefix} [加载元数据] 在处理过程中忽略了 ${invalidCount} 条无效或格式错误的元数据。`
        );
      logger.info(
        `${Default_Config.logPrefix} [加载元数据] 处理完成，最终获得 ${validCount} 条有效图片元数据。`
      );
      return validData;
    } else {
      logger.error(
        `${Default_Config.logPrefix} [加载元数据] CRITICAL: 最终元数据结果不是一个数组！返回空数组。`
      );
      return [];
    }
  }

  /**
   * @description 扫描本地仓库目录，构建基础的图片元数据缓存 (用于回退)。
   */
  static async ScanLocalImagesToBuildCache(logger = global.logger || console) {
    const fallbackCache = [];
    const ReposToScan = [];

    const repoPaths = {
      "Miao-Plugin-MBT": MiaoPluginMBT.paths.LocalTuKuPath,
      "Miao-Plugin-MBT-2": MiaoPluginMBT.paths.LocalTuKuPath2,
      "Miao-Plugin-MBT-3": MiaoPluginMBT.paths.LocalTuKuPath3,
    };

    for (const storageBoxName in repoPaths) {
      const repoPath = repoPaths[storageBoxName];
      if (!repoPath) continue;

      let repoNum = 0; // 确定仓库编号
      if (storageBoxName === "Miao-Plugin-MBT") repoNum = 1;
      else if (storageBoxName === "Miao-Plugin-MBT-2") repoNum = 2;
      else if (storageBoxName === "Miao-Plugin-MBT-3") repoNum = 3;

      if (repoNum > 0 && (await MiaoPluginMBT.IsTuKuDownloaded(repoNum))) {
        ReposToScan.push({ path: repoPath, name: storageBoxName });
      }
    }

    if (ReposToScan.length === 0) {
      logger.warn(
        `${Default_Config.logPrefix} [扫描回退] 没有找到本地图库仓库目录，无法扫描。`
      );
      return [];
    }

    logger.info(
      `${
        Default_Config.logPrefix
      } [扫描回退] 开始扫描本地仓库: ${ReposToScan.map((r) => r.name).join(
        ", "
      )}...`
    );
    const imagePathsFound = new Set();

    for (const Repo of ReposToScan) {
      for (const gameFolderKey of Object.keys(
        MiaoPluginMBT.paths.sourceFolders
      )) {
        if (gameFolderKey === "gallery") continue;
        const sourceFolderName =
          MiaoPluginMBT.paths.sourceFolders[gameFolderKey];
        if (!sourceFolderName) continue;

        const gameFolderPath = path.join(Repo.path, sourceFolderName);
        try {
          await fsPromises.access(gameFolderPath);
          const characterDirs = await fsPromises.readdir(gameFolderPath, {
            withFileTypes: true,
          });

          for (const charDir of characterDirs) {
            if (charDir.isDirectory()) {
              const characterName = charDir.name;
              const charFolderPath = path.join(gameFolderPath, characterName);

              try {
                const imageFiles = await fsPromises.readdir(charFolderPath);
                for (const imageFile of imageFiles) {
                  if (imageFile.toLowerCase().endsWith(".webp")) {
                    const relativePath = path
                      .join(sourceFolderName, characterName, imageFile)
                      .replace(/\\/g, "/");
                    if (!imagePathsFound.has(relativePath)) {
                      fallbackCache.push({
                        storagebox: Repo.name,
                        path: relativePath,
                        characterName: characterName,
                        attributes: {},
                      });
                      imagePathsFound.add(relativePath);
                    }
                  }
                }
              } catch (readCharErr) {
                if (
                  readCharErr.code !== ERROR_CODES.NotFound &&
                  readCharErr.code !== ERROR_CODES.Access
                )
                  logger.warn(
                    `${Default_Config.logPrefix} [扫描回退] 读取角色目录 ${charFolderPath} 失败:`,
                    readCharErr.code
                  );
              }
            }
          }
        } catch (readGameErr) {
          if (
            readGameErr.code !== ERROR_CODES.NotFound &&
            readGameErr.code !== ERROR_CODES.Access
          )
            logger.warn(
              `${Default_Config.logPrefix} [扫描回退] 读取游戏目录 ${gameFolderPath} 失败:`,
              readGameErr.code
            );
        }
      }
    }
    logger.info(
      `${Default_Config.logPrefix} [扫描回退] 扫描完成，共找到 ${fallbackCache.length} 个独立的 .webp 图片文件。`
    );
    return fallbackCache;
  }

  /**
   * @description 生成并应用当前的生效封禁列表（合并用户封禁和净化规则）。
   */
  static async GenerateAndApplyBanList(
    imageData,
    logger = global.logger || console
  ) {
    const effectiveBanSet = MiaoPluginMBT.GenerateBanList(imageData, logger);
    await MiaoPluginMBT.ApplyBanList(effectiveBanSet, logger);
  }

  /**
   * @description 根据净化等级、全局开关和用户封禁生成最终生效的封禁 Set。
   */
  static GenerateBanList(imageData, logger = global.logger || console) {
    const effectiveBans = new Set(MiaoPluginMBT._userBanSet);
    const initialUserBansCount = effectiveBans.size;

    const pflLevel = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
    let pflPurifiedCount = 0;
    if (
      pflLevel > Purify_Level.NONE &&
      Array.isArray(imageData) &&
      imageData.length > 0
    ) {
      imageData.forEach((d) => {
        if (MiaoPluginMBT.CheckIfPurifiedByLevel(d, pflLevel)) {
          const normalizedPath = d.path?.replace(/\\/g, "/");
          if (normalizedPath && !effectiveBans.has(normalizedPath)) {
            effectiveBans.add(normalizedPath);
            pflPurifiedCount++;
          }
        }
      });
    } else if (pflLevel > Purify_Level.NONE) {
      logger.warn(
        `${Default_Config.logPrefix} [生成封禁] PFL=${pflLevel} 但元数据无效或为空，无法执行 PFL 净化。`
      );
    }

    const config = MiaoPluginMBT.MBTConfig;
    const filterAi = config?.Ai === false;
    const filterEasterEgg = config?.EasterEgg === false;
    const filterLayout = config?.layout === false;
    let switchPurifiedCount = 0;

    if (
      (filterAi || filterEasterEgg || filterLayout) &&
      Array.isArray(imageData) &&
      imageData.length > 0
    ) {
      imageData.forEach((item) => {
        const attrs = item?.attributes;
        if (!attrs) return;
        const normalizedPath = item.path?.replace(/\\/g, "/");
        if (!normalizedPath) return;

        let shouldBanBySwitch = false;
        if (filterAi && attrs.isAiImage === true) shouldBanBySwitch = true;
        if (filterEasterEgg && attrs.isEasterEgg === true)
          shouldBanBySwitch = true;
        if (filterLayout && attrs.layout === "fullscreen")
          shouldBanBySwitch = true;

        if (shouldBanBySwitch && !effectiveBans.has(normalizedPath)) {
          effectiveBans.add(normalizedPath);
          switchPurifiedCount++;
        }
      });
    }

    logger.info(
      `${
        Default_Config.logPrefix
      } [生成封禁] 等级PFL=${pflLevel} (${Purify_Level.getDescription(
        pflLevel
      )}), 开关(Ai:${!filterAi},彩蛋:${!filterEasterEgg},横屏:${!filterLayout})`
    );
    // logger.info(
    //   `${Default_Config.logPrefix} [生成封禁] 结果: 手动=${initialUserBansCount}, PFL屏蔽=${pflPurifiedCount}, 开关屏蔽=${switchPurifiedCount}, 总生效=${effectiveBans.size}`
    // );
    //调试日志-精简

    MiaoPluginMBT._activeBanSet = effectiveBans;
    return MiaoPluginMBT._activeBanSet;
  }
  /**
   * @description 根据配置开关过滤图片列表 (不修改原数组)
   */
  static FilterImagesBySwitches(images, config) {
    if (!Array.isArray(images)) return [];
    if (!config) return [...images];

    const filterAi = config.Ai === false;
    const filterEasterEgg = config.EasterEgg === false;
    const filterLayout = config.layout === false;

    if (!filterAi && !filterEasterEgg && !filterLayout) {
      return [...images];
    }

    return images.filter((item) => {
      const attrs = item?.attributes;
      if (!attrs) return true;

      if (filterAi && attrs.isAiImage === true) return false;
      if (filterEasterEgg && attrs.isEasterEgg === true) return false;
      if (filterLayout && attrs.layout === "fullscreen") return false;

      return true;
    });
  }

  /**
   * @description 检查单个图片数据项是否应根据指定净化等级被屏蔽。
   */
  static CheckIfPurifiedByLevel(imgDataItem, purifyLevel) {
    if (!imgDataItem?.attributes) return false;
    const attrs = imgDataItem.attributes;
    const isRx18 =
      attrs.isRx18 === true || String(attrs.isRx18).toLowerCase() === "true";
    const isPx18 =
      attrs.isPx18 === true || String(attrs.isPx18).toLowerCase() === "true";
    if (purifyLevel === Purify_Level.RX18_ONLY) {
      return isRx18;
    } else if (purifyLevel === Purify_Level.PX18_PLUS) {
      return isRx18 || isPx18;
    }
    return false;
  }

  /**
   * @description 检查给定相对路径的图片是否被当前生效的封禁列表（手动或净化）屏蔽。
   */
  static async CheckIfPurified(
    relativePath,
    logger = global.logger || console
  ) {
    const normalizedPath = relativePath?.replace(/\\/g, "/");
    if (!normalizedPath) return false;
    if (MiaoPluginMBT._activeBanSet.has(normalizedPath)) return true;
    const imgData = MiaoPluginMBT._imgDataCache.find(
      (img) => img.path === normalizedPath
    );
    if (imgData) {
      const level = MiaoPluginMBT.MBTConfig?.PFL ?? Default_Config.defaultPfl;
      return MiaoPluginMBT.CheckIfPurifiedByLevel(imgData, level);
    }
    return false;
  }

  /**
   * @description 向用户报告错误，优先使用合并转发消息，失败则回退文本。
   */
  static async ReportError(
    e,
    operationName,
    error,
    context = "",
    logger = global.logger || console
  ) {
    const Report = MiaoPluginMBT.FormatError(operationName, error, context);
    logger.error(
      `${Default_Config.logPrefix} [${operationName}] 操作失败:`,
      error?.message || error,
      error?.stack ? `\nStack(部分): ${error.stack.substring(0, 500)}...` : "",
      context ? `\nContext: ${context}` : ""
    );
    const messagesToSend = [];
    if (Report.summary) messagesToSend.push(Report.summary);
    if (Report.suggestions)
      messagesToSend.push(`【🤔 可能原因与建议】\n${Report.suggestions}`);
    if (Report.contextInfo)
      messagesToSend.push(`【ℹ️ 上下文信息】\n${Report.contextInfo}`);
    if (Report.stack) {
      const maxStackLength = 1000;
      const stackInfo =
        Report.stack.length > maxStackLength
          ? Report.stack.substring(0, maxStackLength) + "... (后面省略了)"
          : Report.stack;
      messagesToSend.push(`【🛠️ 技术细节 - 调用栈(部分)】\n${stackInfo}`);
    }
    try {
      const shortMessage = `${
        Default_Config.logPrefix
      } 执行 ${operationName} 操作时遇到点问题！(错误码: ${
        error?.code || "未知"
      })`;
      await e.reply(shortMessage, true);
      if (messagesToSend.length > 0 && common?.makeForwardMsg) {
        try {
          const forwardMsg = await common.makeForwardMsg(
            e,
            messagesToSend,
            `${Default_Config.logPrefix} ${operationName} 失败日志`
          );
          if (forwardMsg) {
            await e.reply(forwardMsg);
          } else {
            throw new Error("makeForwardMsg returned nullish");
          }
        } catch (forwardError) {
          logger.warn(
            `${Default_Config.logPrefix} [错误报告] 创建/发送合并消息失败 (${forwardError.message})，尝试发送文本...`
          );
          if (Report.summary)
            await e.reply(
              Report.summary.substring(0, 300) +
                (Report.summary.length > 300 ? "..." : "")
            );
          if (Report.suggestions)
            await e.reply(
              `【🤔 建议】\n${
                Report.suggestions.substring(0, 300) +
                (Report.suggestions.length > 300 ? "..." : "")
              }`
            );
          await e.reply("(详细信息请康康控制台日志哦)");
        }
      } else {
        logger.warn(
          `${Default_Config.logPrefix} [错误报告] 无法创建合并消息 (common.makeForwardMsg 不可用或消息为空)。`
        );
        await e.reply("(详细错误信息请康康控制台日志哈)");
      }
    } catch (reportError) {
      logger.error(
        `${Default_Config.logPrefix} [错误报告] CRITICAL: 报告错误时也发生错误:`,
        reportError
      );
      logger.error(
        `${Default_Config.logPrefix} === 原始错误 (${operationName}) ===`,
        error
      );
    }
  }

  /**
   * @description 格式化错误信息，生成包含摘要、建议、上下文和堆栈的报告对象。
   */
  static FormatError(operationName, error, context = "") {
    const Report = {
      summary: `${Default_Config.logPrefix} 操作 [${operationName}] 失败了！`,
      contextInfo: context || "（没啥额外信息）",
      suggestions: "",
      stack: error?.stack || "（调用栈信息丢失了）",
    };
    if (error?.message) Report.summary += `\n错误信息: ${error.message}`;
    if (error?.code) Report.summary += ` (Code: ${error.code})`;
    if (error?.signal) Report.summary += ` (Signal: ${error.signal})`;
    const stderr = error?.stderr || "";
    const stdout = error?.stdout || "";
    const errorString = `${error?.message || ""} ${stderr} ${
      String(error?.code) || ""
    } ${context || ""}`.toLowerCase();
    const suggestionsMap = {
      "could not resolve host":
        "网络问题: 是不是 DNS 解析不了主机？检查下网络和 DNS 设置。",
      "connection timed out":
        "网络问题: 连接超时了，网不好或者对面服务器挂了？",
      "connection refused":
        "网络问题: 对面服务器拒绝连接，端口对吗？防火墙开了？",
      "ssl certificate problem":
        "网络问题: SSL 证书有问题，系统时间对不对？或者需要更新证书？",
      "403 forbidden": "访问被拒 (403): 没权限访问这个地址哦。",
      "404 not found": "资源未找到 (404): URL 写错了或者文件真的没了。",
      "unable to access":
        "Git 访问失败: 检查网络、URL、代理设置对不对，或者仓库是不是私有的？",
      "authentication failed": "Git 认证失败: 用户名密码或者 Token 不对吧？",
      "permission denied":
        "权限问题: Yunzai 没权限读写文件或目录，检查下文件夹权限。",
      "index file corrupt":
        "Git 仓库可能坏了: 试试清理 `.git/index` 文件？不行就得 #重置咕咕牛 了。",
      "lock file|index.lock":
        "Git 正忙着呢: 等一下下，或者手动清理 `.git/index.lock` 文件（小心点！）",
      "commit your changes or stash them":
        "Git 冲突: 本地文件改动了和远程对不上，试试 #更新咕咕牛 强制覆盖？",
      "not a git repository": "Git: 这地方不是个 Git 仓库啊。",
      "unrelated histories": "Git 历史冲突: 这个得 #重置咕咕牛 才能解决了。",
      "not possible to fast-forward":
        "Git: 无法快进合并，#更新咕咕牛 强制覆盖试试。",
      [ERROR_CODES.NotFound]: "文件系统: 找不到文件或目录，路径对吗？",
      [ERROR_CODES.Access]: "文件系统: 没权限访问这个文件或目录。",
      [ERROR_CODES.Busy]: "文件系统: 文件或目录正被占用，稍后再试试？",
      [ERROR_CODES.NotEmpty]: "文件系统: 文件夹里还有东西，删不掉。",
      [ERROR_CODES.ConnReset]: "网络: 连接突然断了。",
      [ERROR_CODES.Timeout]: "操作超时了，等太久了...",
      "json.parse":
        "数据问题: JSON 文件格式不对，检查下 `imagedata.json` 或 `banlist.json`。",
      "yaml.parse":
        "配置问题: YAML 文件格式不对，检查下 `GalleryConfig.yaml`。",
    };
    let matchedSuggestion = null;
    if (
      error instanceof ReferenceError &&
      error.message.includes("is not defined")
    ) {
      matchedSuggestion =
        "代码出错了: 引用了不存在的变量或函数。如果没改过代码，可能是插件Bug，快去反馈！";
    } else {
      for (const keyword in suggestionsMap) {
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedKeyword, "i");
        if (regex.test(errorString)) {
          matchedSuggestion = suggestionsMap[keyword];
          break;
        }
      }
    }
    let finalSuggestions = [];
    if (matchedSuggestion) {
      finalSuggestions.push(`- ${matchedSuggestion}`);
    } else {
      finalSuggestions.push("- 暂时没头绪，看看下面的通用建议？");
    }
    finalSuggestions.push(
      "- 检查网络连接是不是通畅。",
      "- 检查 Yunzai 目录和插件目录的权限设置。",
      "- 仔细看看控制台输出的详细错误日志。"
    );
    if (operationName.includes("下载") || operationName.includes("更新")) {
      finalSuggestions.push(
        "- 确保电脑上正确安装了 Git。",
        "- 试试 `#咕咕牛测速` 看看网络节点情况。"
      );
    }
    finalSuggestions.push(
      "- 万能大法：重启 Yunzai-Bot 试试？",
      "- 如果一直不行，终极大法：`#重置咕咕牛` 然后重新 `#下载咕咕牛`。"
    );
    Report.suggestions = finalSuggestions.join("\n");
    if (stdout || stderr) {
      Report.contextInfo += "\n--- Git 输出信息 ---";
      const maxLen = 500;
      if (stdout)
        Report.contextInfo += `\n[stdout]:\n${stdout.substring(0, maxLen)}${
          stdout.length > maxLen ? "...(后面省略)" : ""
        }`;
      if (stderr)
        Report.contextInfo += `\n[stderr]:\n${stderr.substring(0, maxLen)}${
          stderr.length > maxLen ? "...(后面省略)" : ""
        }`;
    }
    return Report;
  }

  /**
   * @description 检查指定仓库是否已下载。
   */
  static async IsTuKuDownloaded(RepoNum = 1) {
    let gitPath = "";
    if (RepoNum === 1) gitPath = MiaoPluginMBT.paths.gitFolderPath;
    else if (RepoNum === 2) gitPath = MiaoPluginMBT.paths.gitFolderPath2;
    else if (RepoNum === 3) gitPath = MiaoPluginMBT.paths.gitFolderPath3;
    else return false; // 无效仓库号

    if (!gitPath) return false; // 路径未定义

    try {
      await fsPromises.access(gitPath);
      const stats = await fsPromises.stat(gitPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * @description 加载用户手动封禁列表 (banlist.json)。
   */
  static async LoadUserBans(
    forceReload = false,
    logger = global.logger || console
  ) {
    if (
      MiaoPluginMBT._userBanSet instanceof Set &&
      MiaoPluginMBT._userBanSet.size > 0 &&
      !forceReload
    ) {
      return true;
    }
    let data = [];
    let success = false;
    try {
      const content = await fsPromises.readFile(
        MiaoPluginMBT.paths.banListPath,
        "utf8"
      );
      data = JSON.parse(content);
      success = true;
    } catch (error) {
      if (error.code === ERROR_CODES.NotFound) {
        logger.info(
          `${Default_Config.logPrefix} [加载用户封禁] banlist.json 未找到。`
        );
        data = [];
        success = true;
      } else {
        logger.error(
          `${Default_Config.logPrefix} [加载用户封禁] 读取或解析失败:`,
          error
        );
        data = [];
        success = false;
      }
    }
    if (success && Array.isArray(data)) {
      const originalCount = data.length;
      const validBans = data
        .filter((item) => typeof item === "string" && item.trim() !== "")
        .map((p) => p.replace(/\\/g, "/"));
      MiaoPluginMBT._userBanSet = new Set(validBans);
      const validCount = MiaoPluginMBT._userBanSet.size;
      const invalidOrDuplicateCount = originalCount - validCount;
      if (invalidOrDuplicateCount > 0)
        logger.warn(
          `${Default_Config.logPrefix} [加载用户封禁] 忽略 ${invalidOrDuplicateCount} 条无效/重复。`
        );
      logger.info(
        `${Default_Config.logPrefix} [加载用户封禁] 完成: ${validCount} 条。`
      );
      return true;
    } else {
      if (success && !Array.isArray(data)) {
        logger.error(
          `${Default_Config.logPrefix} [加载用户封禁] banlist.json 文件内容格式错误，不是一个有效的数组！`
        );
      }
      MiaoPluginMBT._userBanSet = new Set();
      return false;
    }
  }

  /**
   * @description 保存当前用户手动封禁列表到文件。
   *             移除 banMutex 锁。
   */
  static async SaveUserBans(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const banListPath = MiaoPluginMBT.paths.banListPath;

    try {
      const sortedBans = Array.from(MiaoPluginMBT._userBanSet).sort();
      const jsonString = JSON.stringify(sortedBans, null, 2);

      const dirPath = path.dirname(banListPath);
      try {
        await fsPromises.mkdir(dirPath, { recursive: true });
      } catch (mkdirError) {
        logger.error(
          `${logPrefix} [保存用户封禁] 创建目录 ${dirPath} 失败:`,
          mkdirError
        );
        return false;
      }

      await fsPromises.writeFile(banListPath, jsonString, "utf8");
      logger.info(
        `${logPrefix} [保存用户封禁] 成功保存 ${sortedBans.length} 条记录到 ${banListPath}`
      );
      return true;
    } catch (error) {
      logger.error(
        `${logPrefix} [保存用户封禁] 写入配置文件 ${banListPath} 或其他操作失败!`,
        error
      );
      return false;
    }
  }
  /**
   * @description 加载所有来源的角色别名数据。
   */
  static async LoadAliasData(
    forceReload = false,
    logger = global.logger || console
  ) {
    if (MiaoPluginMBT._aliasData && !forceReload) return true;
    const aliasSources = [
      {
        key: "gsAlias",
        path: path.join(MiaoPluginMBT.paths.target.miaoGsAliasDir, "alias.js"),
        type: "js",
      },
      {
        key: "srAlias",
        path: path.join(MiaoPluginMBT.paths.target.miaoSrAliasDir, "alias.js"),
        type: "js",
      },
      {
        key: "zzzAlias",
        path: path.join(MiaoPluginMBT.paths.target.zzzAliasDir, "alias.yaml"),
        type: "yaml",
      },
      {
        key: "wavesAlias",
        path: path.join(MiaoPluginMBT.paths.target.wavesAliasDir, "role.yaml"),
        type: "yaml",
      },
    ];
    const loadedAliases = {};
    const combined = {};
    let overallSuccess = true;
    const parseFile = async (filePath, fileType) => {
      let data = {};
      try {
        await fsPromises.access(filePath);
        if (fileType === "js") {
          const fileUrl = `file://${filePath.replace(
            /\\/g,
            "/"
          )}?t=${Date.now()}`;
          try {
            const module = await import(fileUrl);
            if (module?.alias && typeof module.alias === "object")
              data = module.alias;
            else {
              overallSuccess = false;
            }
          } catch (importErr) {
            if (importErr.code !== "ERR_MODULE_NOT_FOUND") {
              logger.error(
                `${Default_Config.logPrefix} [加载别名] 导入 JS 失败 (${filePath}):`,
                importErr
              );
              overallSuccess = false;
            }
          }
        } else if (fileType === "yaml") {
          try {
            const content = await fsPromises.readFile(filePath, "utf8");
            data = yaml.parse(content) || {};
          } catch (yamlErr) {
            logger.error(
              `${Default_Config.logPrefix} [加载别名] 解析 YAML 失败 (${filePath}):`,
              yamlErr
            );
            overallSuccess = false;
          }
        }
      } catch (err) {
        if (err.code !== ERROR_CODES.NotFound) {
          logger.warn(
            `${Default_Config.logPrefix} [加载别名] 读取 ${fileType} 文件失败: ${filePath}`,
            err.code
          );
          overallSuccess = false;
        }
      }
      return data;
    };
    await Promise.all(
      aliasSources.map(async ({ key, path: filePath, type }) => {
        const data = await parseFile(filePath, type);
        loadedAliases[key] = data;
        Object.assign(combined, data);
      })
    );
    MiaoPluginMBT._aliasData = { ...loadedAliases, combined };
    const combinedCount = Object.keys(combined).length;
    logger.info(
      `${Default_Config.logPrefix} [加载别名] 完成: ${combinedCount}主名。成功: ${overallSuccess}`
    );
    return overallSuccess;
  }

  /**
   * @description 将生效的封禁列表应用到目标插件目录，删除对应图片文件。
   */
  static async ApplyBanList(
    effectiveBanSet = MiaoPluginMBT._activeBanSet,
    logger = global.logger || console
  ) {
    if (!(effectiveBanSet instanceof Set) || effectiveBanSet.size === 0) {
      return;
    }
    let deletedCount = 0;
    const deletePromises = [];
    for (const relativePath of effectiveBanSet) {
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
      if (targetPath) {
        deletePromises.push(
          fsPromises
            .unlink(targetPath)
            .then(() => {
              deletedCount++;
            })
            .catch((unlinkErr) => {
              if (unlinkErr.code !== ERROR_CODES.NotFound)
                logger.warn(
                  `${Default_Config.logPrefix} [应用封禁] 删除 ${targetPath} 失败:`,
                  unlinkErr.code
                );
            })
        );
      }
    }
    await Promise.all(deletePromises);
    logger.info(
      `${Default_Config.logPrefix} [应用封禁] 完成: 处理 ${deletePromises.length} 项, 删除 ${deletedCount} 文件。`
    );
  }

  /**
   * @description 根据图片相对路径，推断其在目标插件中的绝对路径。
   */
  static async DetermineTargetPath(relativePath) {
    if (!relativePath) return null;
    const logger = global.logger || console;
    const normalizedRelativePath = relativePath.replace(/\\/g, "/");
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, "/"))
        return path.join(
          MiaoPluginMBT.paths.commonResPath,
          fileSync.destFileName
        );
    }
    for (const fileSync of MiaoPluginMBT.paths.filesToSyncSpecific) {
      if (normalizedRelativePath === fileSync.sourceSubPath.replace(/\\/g, "/"))
        return path.join(fileSync.destDir, fileSync.destFileName);
    }
    const parts = normalizedRelativePath.split("/");
    if (parts.length >= 3) {
      const sourceFolder = parts[0];
      const characterNameInRepo = parts[1];
      const fileName = parts.slice(2).join("/");
      let targetBaseDir = null,
        GameKey = null;
      if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.gs) {
        targetBaseDir = MiaoPluginMBT.paths.target.miaoChar;
        GameKey = "gs";
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.sr) {
        targetBaseDir = MiaoPluginMBT.paths.target.miaoChar;
        GameKey = "sr";
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.zzz) {
        targetBaseDir = MiaoPluginMBT.paths.target.zzzChar;
        GameKey = "zzz";
      } else if (sourceFolder === MiaoPluginMBT.paths.sourceFolders.waves) {
        targetBaseDir = MiaoPluginMBT.paths.target.wavesChar;
        GameKey = "waves";
      }
      if (targetBaseDir && GameKey) {
        const aliasResult = await MiaoPluginMBT.FindRoleAlias(
          characterNameInRepo
        );
        const targetCharacterName = aliasResult.exists
          ? aliasResult.mainName
          : characterNameInRepo;
        return path.join(targetBaseDir, targetCharacterName, fileName);
      }
    }
    return null;
  }

  /**
   * @description 智能查找图片的绝对路径，优先查找最新仓库。
   */
  static async FindImageAbsolutePath(relativePath) {
    if (!relativePath) return null;
    const normalizedPath = relativePath.replace(/\\/g, "/");
    const logger = global.logger || console;
    //  修改查找顺序：3 -> 2 -> 1
    const reposToSearch = [
      {
        name: "Miao-Plugin-MBT-3",
        path: MiaoPluginMBT.paths.LocalTuKuPath3,
        num: 3,
      },
      {
        name: "Miao-Plugin-MBT-2",
        path: MiaoPluginMBT.paths.LocalTuKuPath2,
        num: 2,
      },
      {
        name: "Miao-Plugin-MBT",
        path: MiaoPluginMBT.paths.LocalTuKuPath,
        num: 1,
      },
    ];

    for (const repo of reposToSearch) {
      if (!repo.path) continue;

      const repoExists = await MiaoPluginMBT.IsTuKuDownloaded(repo.num);
      if (repoExists) {
        const absPath = path.join(repo.path, normalizedPath);
        try {
          await fsPromises.access(absPath, fs.constants.R_OK);
          return absPath; // 找到即返回
        } catch (err) {
          if (err.code !== ERROR_CODES.NotFound) {
            logger.warn(
              `${Default_Config.logPrefix} [查找路径] 访问仓库 ${repo.name} (${absPath}) 出错:`,
              err.code
            );
          }
        }
      }
    }
    // 如果所有仓库都没找到
    logger.warn(
      `${Default_Config.logPrefix} [查找路径] 在所有已下载仓库中均未找到: ${normalizedPath}`
    );
    return null;
  }

  /**
   * @description 根据输入名称查找标准角色名和是否存在。
   */
  static async FindRoleAlias(inputName, logger = global.logger || console) {
    const cleanInput = inputName?.trim();
    if (!cleanInput) return { mainName: null, exists: false };
    if (!MiaoPluginMBT._aliasData) {
      await MiaoPluginMBT.LoadAliasData(false, logger);
      if (!MiaoPluginMBT._aliasData?.combined) {
        logger.error(`${Default_Config.logPrefix} [查找别名] 无法加载。`);
        const dirExistsFallback = await MiaoPluginMBT.CheckRoleDirExists(
          cleanInput
        );
        return { mainName: cleanInput, exists: dirExistsFallback };
      }
    }
    const combinedAliases = MiaoPluginMBT._aliasData.combined || {};
    const lowerInput = cleanInput.toLowerCase();
    if (combinedAliases.hasOwnProperty(cleanInput))
      return { mainName: cleanInput, exists: true };
    for (const mainNameKey in combinedAliases) {
      if (mainNameKey.toLowerCase() === lowerInput)
        return { mainName: mainNameKey, exists: true };
    }
    for (const [mainName, aliases] of Object.entries(combinedAliases)) {
      let aliasArray = [];
      if (typeof aliases === "string")
        aliasArray = aliases.split(",").map((a) => a.trim().toLowerCase());
      else if (Array.isArray(aliases))
        aliasArray = aliases.map((a) => String(a).trim().toLowerCase());
      if (aliasArray.includes(lowerInput))
        return { mainName: mainName, exists: true };
    }
    const dirExists = await MiaoPluginMBT.CheckRoleDirExists(cleanInput);
    return { mainName: cleanInput, exists: dirExists };
  }

  /**
   * @description 检查指定角色名是否存在对应的本地图库目录。
   */
  static async CheckRoleDirExists(roleName) {
    if (!roleName) return false;
    const gameFolders = Object.values(MiaoPluginMBT.paths.sourceFolders).filter(
      (f) => f !== MiaoPluginMBT.paths.sourceFolders.gallery
    );
    const ReposToCheck = [];
    if (await MiaoPluginMBT.IsTuKuDownloaded(1))
      ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath);
    if (await MiaoPluginMBT.IsTuKuDownloaded(2))
      ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath2);
    if (await MiaoPluginMBT.IsTuKuDownloaded(3))
      ReposToCheck.push(MiaoPluginMBT.paths.LocalTuKuPath3);
    if (ReposToCheck.length === 0) return false;
    for (const RepoPath of ReposToCheck) {
      for (const gameFolder of gameFolders) {
        const rolePath = path.join(RepoPath, gameFolder, roleName);
        try {
          await fsPromises.access(rolePath);
          const stats = await fsPromises.stat(rolePath);
          if (stats.isDirectory()) return true;
        } catch {}
      }
    }
    return false;
  }

  /**
   * @description 解析角色标识符 (如 "花火1", "花火Gu1") 为角色名和编号。
   */
  static ParseRoleIdentifier(identifier) {
    if (!identifier) return null;
    const match = identifier.trim().match(/^(.*?)(?:Gu)?(\d+)$/i);
    if (match && match[1] && match[2]) {
      const mainName = match[1].trim();
      if (mainName) return { mainName: mainName, imageNumber: match[2] };
    }
    return null;
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
      return null;
    }
    const gitDir = path.join(RepoPath, ".git");
    try {
      await fsPromises.access(gitDir);
      const stats = await fsPromises.stat(gitDir);
      if (!stats.isDirectory()) throw new Error(".git is not a directory");
    } catch (err) {
      return null;
    }
    const format = Default_Config.gitLogFormat;
    const dateformat = Default_Config.gitLogDateFormat;
    const args = [
      "log",
      `-n ${Math.max(1, count)}`,
      `--date=${dateformat}`,
      `--pretty=format:${format}`,
    ];
    const gitOptions = { cwd: RepoPath };
    try {
      const result = await ExecuteCommand("git", args, gitOptions, 5000);
      return result.stdout.trim();
    } catch (error) {
      logger.warn(
        `${Default_Config.logPrefix} [获取日志] Git log 失败 (${RepoPath})`
      );
      return null;
    }
  }

  /**
   * @description 下载单个仓库，包含代理选择、GitHub 直连优先判断和 Fallback 重试逻辑。
   *              预渲染 HTML 到文件再截图，用户进度提示。
   *              保持核心的锁范围优化。移除多余用户提示。
   */
  static async DownloadRepoWithFallback(
    repoNum,
    repoUrl,
    branch,
    finalLocalPath,
    eForProgress,
    loggerInstance
  ) {
    const logPrefix = Default_Config.logPrefix;
    const repoTypeName = repoNum === 1 ? "核心仓库" : "附属仓库";
    const baseRawUrl = RAW_URL_Repo1;

    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    const uniqueTempDirName = `GuTemp-${repoNum}-${timestamp}-${randomSuffix}`;
    const tempRepoPath = path.join(
      MiaoPluginMBT.paths.tempPath,
      "guguniu-downloads",
      uniqueTempDirName
    );

    // loggerInstance.info(`${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 目标路径: ${finalLocalPath}, 临时路径: ${tempRepoPath}`); //调试日志-精简

    let allTestResults = [];
    let tempHtmlFilePath = "";
    let tempImgFilePath = "";
    let canGenerateReport = true;
    let lastError = null;
    const testStartTime = Date.now();

    try {
      allTestResults = await MiaoPluginMBT.TestProxies(
        baseRawUrl,
        loggerInstance
      );

      if (eForProgress && repoNum === 1 && allTestResults.length > 0) {
        let renderData = {};
        let htmlContent = "";
        try {
          const reportSources = MiaoPluginMBT.GetSortedAvailableSources(
            allTestResults,
            true,
            loggerInstance
          );
          const bestSourceForReport = reportSources[0] || null;
          const duration = ((Date.now() - testStartTime) / 1000).toFixed(1);
          const processSpeeds = (speeds) =>
            speeds
              .map((s) => ({
                ...s,
                statusText:
                  s.testUrlPrefix === null
                    ? "na"
                    : Number.isFinite(s.speed) && s.speed >= 0
                    ? "ok"
                    : "timeout",
              }))
              .sort(
                (a, b) =>
                  (a.priority ?? 999) - (b.priority ?? 999) ||
                  (a.speed === Infinity || a.statusText === "na"
                    ? 1
                    : b.speed === Infinity || b.statusText === "na"
                    ? -1
                    : a.speed - b.speed)
              );
          const processedSpeedsResult = processSpeeds(allTestResults);
          const scaleStyleValue = MiaoPluginMBT.getScaleStyleValue();
          let best1Display = "无可用源";
          if (bestSourceForReport) {
            let speedInfo = "N/A";
            if (bestSourceForReport.testUrlPrefix !== null)
              speedInfo =
                Number.isFinite(bestSourceForReport.speed) &&
                bestSourceForReport.speed >= 0
                  ? `${bestSourceForReport.speed}ms`
                  : "超时";
            best1Display = `${bestSourceForReport.name}(${speedInfo})`;
          }
          renderData = {
            speeds1: processedSpeedsResult,
            best1: bestSourceForReport,
            duration: duration,
            scaleStyleValue: scaleStyleValue,
            best1Display: best1Display,
          };
          htmlContent = template.render(
            SPEEDTEST_HTML_TEMPLATE_LOCAL,
            renderData
          );
          if (typeof htmlContent !== "string" || htmlContent.length === 0)
            throw new Error("template.render 返回了无效内容!");

          await fsPromises.mkdir(MiaoPluginMBT.paths.tempHtmlPath, {
            recursive: true,
          });
          tempHtmlFilePath = path.join(
            MiaoPluginMBT.paths.tempHtmlPath,
            `dl-speedtest-rendered-${Date.now()}-${crypto
              .randomBytes(3)
              .toString("hex")}.html`
          );
          await fsPromises.writeFile(tempHtmlFilePath, htmlContent, "utf8");
          canGenerateReport = true;
        } catch (prepOrRenderError) {
          loggerInstance.error(
            `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 准备或渲染测速报告失败:`,
            prepOrRenderError
          );
          if (eForProgress)
            await eForProgress
              .reply(`${logPrefix} 准备或渲染测速报告出错，继续下载...`)
              .catch(() => {});
          canGenerateReport = false;
        }

        if (canGenerateReport) {
          try {
            await fsPromises.mkdir(MiaoPluginMBT.paths.tempImgPath, {
              recursive: true,
            });
            tempImgFilePath = path.join(
              MiaoPluginMBT.paths.tempImgPath,
              `dl-speedtest-${Date.now()}.png`
            );
            const img = await puppeteer.screenshot("guguniu-dl-speedtest", {
              tplFile: tempHtmlFilePath,
              savePath: tempImgFilePath,
              imgType: "png",
              pageGotoParams: { waitUntil: "networkidle0" },
              screenshotOptions: { fullPage: false },
              pageBoundingRect: { selector: "body", padding: 0 },
              width: 540,
            });
            if (img) {
              if (eForProgress) await eForProgress.reply(img);
              await common.sleep(500);
            } else {
              if (eForProgress)
                await eForProgress
                  .reply(
                    `${logPrefix} 生成测速报告图片时内容可能为空，继续下载...`
                  )
                  .catch(() => {});
            }
          } catch (screenshotError) {
            loggerInstance.error(
              `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] Puppeteer 生成测速截图失败:`,
              screenshotError
            );
            if (eForProgress)
              await eForProgress
                .reply(`${logPrefix} 生成测速报告截图出错，继续下载...`)
                .catch(() => {});
          } finally {
            if (tempHtmlFilePath && fs.existsSync(tempHtmlFilePath)) {
              try {
                await fsPromises.unlink(tempHtmlFilePath);
              } catch (unlinkErr) {}
            }
            if (tempImgFilePath && fs.existsSync(tempImgFilePath)) {
              try {
                await fsPromises.unlink(tempImgFilePath);
              } catch (unlinkErr) {}
            }
            const possiblePuppeteerTempDir = path.join(
              MiaoPluginMBT.paths.tempPath,
              "..",
              "guguniu-dl-speedtest"
            );
            if (fs.existsSync(possiblePuppeteerTempDir)) {
              try {
                await safeDelete(possiblePuppeteerTempDir);
              } catch (deleteErr) {}
            }
          }
        }
      }

      const githubResult = allTestResults.find((r) => r.name === "GitHub");
      let githubDirectAttempted = false;

      if (
        githubResult &&
        githubResult.speed !== Infinity &&
        githubResult.speed <= 300
      ) {
        githubDirectAttempted = true;
        const nodeName = "GitHub(直连-优先)";
        const preCleanSuccess = await safeDelete(tempRepoPath);
        if (!preCleanSuccess) {
          loggerInstance.error(
            `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) 预清理临时目录 ${tempRepoPath} 失败！`
          );
          lastError = new Error(`预清理临时目录 ${tempRepoPath} 失败`);
        } else {
          await fsPromises.mkdir(path.dirname(tempRepoPath), {
            recursive: true,
          });
          const cloneArgsDirect = [
            "clone",
            `--depth=${Default_Config.gitCloneDepth}`,
            "--progress",
            repoUrl,
            tempRepoPath,
          ];
          const gitOptionsDirect = {
            cwd: MiaoPluginMBT.paths.YunzaiPath,
            shell: false,
          };

          // 用于跟踪核心仓库进度报告的状态
          let progressStatusDirect = { reported10: false, reported90: false };

          try {
            await MiaoPluginMBT.gitMutex.runExclusive(async () => {
              await ExecuteCommand(
                "git",
                cloneArgsDirect,
                gitOptionsDirect,
                Default_Config.gitCloneTimeout,
                (stderrChunk) => {
                  // stderrChunk 回调
                  if (eForProgress && repoNum === 1) {
                    // 仅为核心仓库且有 e 对象时
                    const match = stderrChunk.match(
                      /Receiving objects:\s*(\d+)%/
                    );
                    if (match?.[1]) {
                      const progress = parseInt(match[1], 10);
                      if (progress >= 10 && !progressStatusDirect.reported10) {
                        progressStatusDirect.reported10 = true;
                        if (eForProgress)
                          eForProgress
                            .reply(
                              `『咕咕牛』${repoTypeName} (${nodeName}) 下载: 10%...`
                            )
                            .catch(() => {});
                      }
                      if (progress >= 90 && !progressStatusDirect.reported90) {
                        progressStatusDirect.reported90 = true;
                        if (eForProgress)
                          eForProgress
                            .reply(
                              `『咕咕牛』${repoTypeName} (${nodeName}) 下载: 90%...`
                            )
                            .catch(() => {});
                      }
                    }
                  }
                  // 附属仓库无日志输出
                },
                undefined // onStdOut 回调
              );
            });

            loggerInstance.info(
              `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) Clone 完成，尝试移动文件...`
            );
            try {
              await fsPromises.rename(tempRepoPath, finalLocalPath);
            } catch (renameError) {
              if (renameError.code === "EXDEV") {
                loggerInstance.warn(
                  `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) 重命名失败 (EXDEV)，回退到复制...`
                );
                await copyFolderRecursive(
                  tempRepoPath,
                  finalLocalPath,
                  {},
                  loggerInstance
                );
                await safeDelete(tempRepoPath);
              } else {
                throw renameError;
              }
            }
            loggerInstance.info(
              `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 使用 ${nodeName} 下载成功！`
            );
            return { success: true, nodeName: nodeName };
          } catch (error) {
            loggerInstance.error(
              `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] ${nodeName} 下载失败。`
            );
            lastError = error;
            await safeDelete(tempRepoPath);
            await common.sleep(1000);
          }
        }
      }

      let sourcesToTry = MiaoPluginMBT.GetSortedAvailableSources(
        allTestResults,
        true,
        loggerInstance
      );
      if (sourcesToTry.length === 0 && !githubDirectAttempted) {
        const githubSourceFromConfig = Default_Config.proxies.find(
          (p) => p.name === "GitHub"
        );
        if (githubSourceFromConfig) {
          sourcesToTry.push({ ...githubSourceFromConfig, speed: Infinity });
        }
      }

      if (sourcesToTry.length === 0) {
        loggerInstance.error(
          `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 没有任何可用的下载源！`
        );
        if (repoNum === 1 && eForProgress) {
          await MiaoPluginMBT.ReportError(
            eForProgress,
            `下载${repoTypeName}`,
            lastError || new Error("无可用下载源"),
            `测速结果: ${JSON.stringify(allTestResults)}`,
            loggerInstance
          );
        }
        return {
          success: false,
          nodeName: "无可用源",
          error: lastError || new Error("无可用下载源"),
        };
      }

      for (const source of sourcesToTry) {
        if (source.name === "GitHub" && githubDirectAttempted) {
          continue;
        }

        const nodeName =
          source.name === "GitHub" ? "GitHub(直连)" : `${source.name}(代理)`;
        loggerInstance.info(
          `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 尝试使用源: ${nodeName}`
        );

        const preCleanSuccessLoop = await safeDelete(tempRepoPath);
        if (!preCleanSuccessLoop) {
          loggerInstance.error(
            `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) 预清理临时目录 ${tempRepoPath} 失败！跳过此节点。`
          );
          lastError = new Error(
            `预清理临时目录 ${tempRepoPath} 失败 (节点: ${nodeName})`
          );
          continue;
        }
        await fsPromises.mkdir(path.dirname(tempRepoPath), { recursive: true });

        let cloneUrl = "";
        let proxyForEnv = null;
        if (source.name === "GitHub") {
          cloneUrl = repoUrl;
        } else if (source.cloneUrlPrefix) {
          if (source.name === "GitClone") {
            const repoPathWithoutProtocol = repoUrl.replace(/^https?:\/\//, "");
            const cleanCloneUrlPrefix = source.cloneUrlPrefix.replace(/\/$/, "");
            const cleanRepoPath = repoPathWithoutProtocol.replace(/\/$/, "");
            cloneUrl = `${cleanCloneUrlPrefix}/${cleanRepoPath}`;
          } else {
            const cleanCloneUrlPrefix = source.cloneUrlPrefix.replace(/\/$/, "");
            cloneUrl = `${cleanCloneUrlPrefix}/${repoUrl}`;
          }
          try {
            const proxyUrl = new URL(source.cloneUrlPrefix);
            if (["http:", "https:"].includes(proxyUrl.protocol))
              proxyForEnv = proxyUrl.origin;
          } catch (urlError) {
          }
        } else {
          continue;
        }

        const cloneArgs = [
          "clone",
          `--depth=${Default_Config.gitCloneDepth}`,
          "--progress",
          cloneUrl,
          tempRepoPath,
        ];
        const gitOptions = {
          cwd: MiaoPluginMBT.paths.YunzaiPath,
          shell: false,
        };
        if (proxyForEnv) {
          gitOptions.env = {
            ...process.env,
            HTTP_PROXY: proxyForEnv,
            HTTPS_PROXY: proxyForEnv,
          };
        }

        // 用于跟踪核心仓库进度报告的状态
        let progressStatusLoop = { reported10: false, reported90: false };

        try {
          await MiaoPluginMBT.gitMutex.runExclusive(async () => {
            await ExecuteCommand(
              "git",
              cloneArgs,
              gitOptions,
              Default_Config.gitCloneTimeout,
              (stderrChunk) => {
                // stderrChunk 回调
                if (eForProgress && repoNum === 1) {
                  // 仅为核心仓库且有 e 对象时
                  const match = stderrChunk.match(
                    /Receiving objects:\s*(\d+)%/
                  );
                  if (match?.[1]) {
                    const progress = parseInt(match[1], 10);
                    if (progress >= 10 && !progressStatusLoop.reported10) {
                      progressStatusLoop.reported10 = true;
                      if (eForProgress)
                        eForProgress
                          .reply(
                            `『咕咕牛』${repoTypeName} (${nodeName}) 下载: 10%...`
                          )
                          .catch(() => {});
                    }
                    if (progress >= 90 && !progressStatusLoop.reported90) {
                      progressStatusLoop.reported90 = true;
                      if (eForProgress)
                        eForProgress
                          .reply(
                            `『咕咕牛』${repoTypeName} (${nodeName}) 下载: 90%...`
                          )
                          .catch(() => {});
                    }
                  }
                }
                // 附属仓库无日志输出
              },
              undefined // onStdOut 回调
            );
          });

          loggerInstance.info(
            `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) Clone 完成，尝试移动文件...`
          );
          try {
            await fsPromises.rename(tempRepoPath, finalLocalPath);
          } catch (renameError) {
            if (renameError.code === "EXDEV") {
              loggerInstance.warn(
                `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] (${nodeName}) 重命名失败 (EXDEV)，回退到复制...`
              );
              await copyFolderRecursive(
                tempRepoPath,
                finalLocalPath,
                {},
                loggerInstance
              );
              await safeDelete(tempRepoPath);
            } else {
              throw renameError;
            }
          }
          // loggerInstance.info(`${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 使用源 ${nodeName} 下载成功！`);
          return { success: true, nodeName: nodeName };
        } catch (error) {
          loggerInstance.error(
            `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 使用源 ${nodeName} 下载失败。`
          );
          lastError = error;
          await safeDelete(tempRepoPath);
          await common.sleep(1000);
        }
      }

      loggerInstance.error(
        `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 所有可用源均下载失败！`
      );
      if (repoNum === 1 && eForProgress) {
        await MiaoPluginMBT.ReportError(
          eForProgress,
          `下载${repoTypeName}`,
          lastError || new Error("所有源下载失败"),
          `尝试源: ${sourcesToTry.map((s) => s.name).join(", ")}`,
          loggerInstance
        );
      } else if (repoNum !== 1) {
        loggerInstance.error(
          `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 最终错误:`,
          lastError || "未知错误"
        );
      }
      return { success: false, nodeName: "所有源失败", error: lastError };
    } catch (criticalError) {
      loggerInstance.error(
        `${logPrefix} [下载流程 ${repoTypeName} (${repoNum}号)] 发生严重错误:`,
        criticalError
      );
      if (eForProgress) {
        await MiaoPluginMBT.ReportError(
          eForProgress,
          `下载${repoTypeName} (严重错误)`,
          criticalError,
          "",
          loggerInstance
        );
      }
      return { success: false, nodeName: "严重错误", error: criticalError };
    } finally {
      await safeDelete(tempRepoPath);
    }
  }

  /**
   * @description 更新单个仓库，包含冲突检测和强制重置逻辑。
   *              控制台只输出关键错误，但返回的错误对象包含完整 stderr。
   *              返回 wasForceReset 标志。
   * @returns {Promise<{success: boolean, hasChanges: boolean, log: string|null, error: Error|null, wasForceReset: boolean}>}
   */
  static async UpdateSingleRepo(
    e,
    RepoNum,
    localPath,
    RepoName,
    RepoUrl, // RepoUrl 未在此函数中使用，但保留以备将来可能需要
    branch,
    isScheduled,
    logger
  ) {
    const logPrefix = Default_Config.logPrefix;
    //logger.info(`${logPrefix} [更新仓库] 开始更新 ${RepoName} @ ${localPath}`); //调试日志-精简
    let success = false;
    let hasChanges = false;
    let latestLog = null;
    let pullError = null; // 存储 pull 或 reset 阶段的最终错误
    let wasForceReset = false; // 标记是否执行了强制重置

    await MiaoPluginMBT.gitMutex.acquire();
    try {
      let oldCommit = "";
      try {
        // 尝试获取当前 commit hash
        const revParseResult = await ExecuteCommand(
          "git",
          ["rev-parse", "HEAD"],
          { cwd: localPath },
          5000 // 短超时
        );
        oldCommit = revParseResult.stdout.trim();
      } catch (revParseError) {
        logger.warn(
          `${logPrefix} [更新仓库] ${RepoName} 获取当前 commit 失败:`,
          revParseError.message
        );
        // 即使获取旧 commit 失败，也继续尝试更新
      }

      let needsReset = false;
      let pullOutput = ""; // 存储 pull 命令的输出

      try {
        // 尝试快速前进拉取
        const pullResult = await ExecuteCommand(
          "git",
          ["pull", "origin", branch, "--ff-only", "--progress"],
          { cwd: localPath },
          Default_Config.gitPullTimeout,
          (stderrChunk) => {
            // onStdErr: 处理进度等信息，但不直接打印调试日志到控制台
            const output = stderrChunk.toString();
            const progressMatch = output.match(
              /(Receiving objects|Resolving deltas|remote: Compressing objects|remote: Total|remote: Enumerating objects|remote: Counting objects):\s*(\d+)%/i
            );
            if (progressMatch) {
            }
          },
          undefined
        );
        pullOutput = (pullResult.stdout || "") + (pullResult.stderr || "");
        success = true; // 初步认为成功
        // logger.info(
        //   `${logPrefix} [更新仓库] ${RepoName} 'git pull --ff-only' 成功。`
        // );
        //调试日志-精简
      } catch (err) {
        // git pull --ff-only 失败
        pullError = err; // 保存 pull 阶段的错误，包含完整的 stderr
        pullOutput =
          err.stderr || "" || err.stdout || "" || err.message || String(err);

        // 在控制台只打印关键错误信息
        logger.warn(
          `${logPrefix} [更新仓库] ${RepoName} 'git pull --ff-only' 失败，错误码: ${err.code}`
        );
        const criticalLines = (pullOutput.split("\n") || [])
          .filter(
            (line) =>
              line.match(/^(fatal|error|warning):/i) &&
              !["trace:", "http.c:", "== Info:"].some((p) =>
                line.trim().startsWith(p)
              )
          )
          .join("\n");
        if (criticalLines) {
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} Git 关键错误:\n${criticalLines}`
          );
        } else if (err.message) {
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} 错误信息: ${err.message}`
          );
        }

        // 判断是否是因为冲突或特定状态需要强制重置
        if (
          err.code !== 0 &&
          ((err.stderr || "").includes("Not possible to fast-forward") ||
            (err.stderr || "").includes("diverging") ||
            (err.stderr || "").includes("unrelated histories") ||
            (err.stderr || "").includes("commit your changes or stash them") ||
            (err.stderr || "").includes("needs merge") || // 增加需要合并的情况
            (err.stderr || "").includes("lock file") ||
            (err.message || "").includes("failed"))
        ) {
          needsReset = true;
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} 检测到冲突或状态异常，准备尝试强制重置...`
          );
        } else {
          // 对于其他 pull 错误，标记为失败，但不尝试重置
          success = false;
          // pullError 已经保存了错误信息
        }
      }

      // 如果需要且 pull 未成功，则尝试强制重置
      if (needsReset && !success) {
        logger.warn(
          `${logPrefix} [更新仓库] ${RepoName} 正在执行强制重置 (git fetch & git reset --hard)...`
        );
        try {
          await ExecuteCommand(
            "git",
            ["fetch", "origin"], // 获取最新的远程信息
            { cwd: localPath },
            Default_Config.gitPullTimeout // 使用 pull 的超时，fetch 可能也需要较长时间
          );
          await ExecuteCommand("git", ["reset", "--hard", `origin/${branch}`], {
            // 重置到最新的远程分支
            cwd: localPath,
          });

          success = true; // 强制重置成功，则更新最终成功
          hasChanges = true; // 强制重置意味着本地状态被改变，视为有变化
          wasForceReset = true; // 标记发生了强制重置
          pullError = null; // 清除 pull 阶段的错误，因为我们已经通过重置解决了
          logger.info(`${logPrefix} [更新仓库] ${RepoName} 强制重置成功。`);
        } catch (resetError) {
          logger.error(`${logPrefix} [更新仓库] ${RepoName} 强制重置失败！`);
          success = false; // 强制重置失败，则更新最终失败
          pullError = resetError; // 更新错误为重置错误（包含其 stderr）
          // 控制台打印关键重置错误
          const resetOutput =
            resetError.stderr ||
            "" ||
            resetError.stdout ||
            "" ||
            resetError.message ||
            String(resetError);
          const resetCriticalLines = (resetOutput.split("\n") || [])
            .filter(
              (line) =>
                line.match(/^(fatal|error|warning):/i) &&
                !["trace:", "http.c:", "== Info:"].some((p) =>
                  line.trim().startsWith(p)
                )
            )
            .join("\n");
          if (resetCriticalLines) {
            logger.error(
              `${logPrefix} [更新仓库] ${RepoName} 重置关键错误:\n${resetCriticalLines}`
            );
          } else if (resetError.message) {
            logger.error(
              `${logPrefix} [更新仓库] ${RepoName} 重置错误信息: ${resetError.message}`
            );
          }
        }
      }

      // 获取日志和判断变更状态 (仅在最终成功时进行)
      if (success) {
        let newCommit = "";
        try {
          const newRevParseResult = await ExecuteCommand(
            "git",
            ["rev-parse", "HEAD"],
            { cwd: localPath },
            5000
          );
          newCommit = newRevParseResult.stdout.trim();
        } catch (newRevParseError) {
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} 获取新 commit 失败:`,
            newRevParseError.message
          );
        }

        if (!wasForceReset) {
          // 如果不是通过重置成功的，才需要比较 commit
          hasChanges = oldCommit && newCommit && oldCommit !== newCommit;
        }
        // 对于重置成功的情况，hasChanges 已经设为 true

        // 记录日志信息
        if (hasChanges) {
          logger.info(
            `${Default_Config.logPrefix} [更新仓库] ${RepoName} 检测到新的提交${
              wasForceReset ? " (通过强制重置)" : ""
            }。`
          );
        } else if (
          pullOutput.includes("Already up to date") &&
          !wasForceReset
        ) {
          logger.info(
            `${Default_Config.logPrefix} [更新仓库] ${RepoName} 已是最新。`
          );
        } else if (success && !wasForceReset) {
          // pull 成功但没检测到明确更新且非重置
          logger.info(
            `${Default_Config.logPrefix} [更新仓库] ${RepoName} pull 操作完成，未检测到新提交或无 "Already up to date" 消息。`
          );
          hasChanges = false; // 明确标记为无变化
        }

        // 获取最近3条日志
        try {
          latestLog = await MiaoPluginMBT.GetTuKuLog(3, localPath, logger);
        } catch (logError) {
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} 获取提交日志失败:`,
            logError.message
          );
          latestLog = "获取日志失败";
        }
      } else {
        // 更新最终失败
        // 仍然尝试获取日志，可能有助于诊断
        try {
          latestLog = await MiaoPluginMBT.GetTuKuLog(3, localPath, logger);
        } catch (logError) {
          logger.warn(
            `${logPrefix} [更新仓库] ${RepoName} (失败状态下) 获取提交日志失败:`,
            logError.message
          );
          latestLog = "获取日志失败";
        }
        // pullError 此时应该是最终的错误
        // 如果 pullError 为空（理论上不应该，因为 success 是 false），创建一个通用错误
        if (!pullError) {
          pullError = new Error(`${RepoName} 更新失败，但未捕获到具体错误对象`);
        }
      }
    } catch (outerError) {
      // 这个 catch 捕获上面逻辑中未被捕获的意外错误
      success = false;
      hasChanges = false;
      logger.error(
        `${logPrefix} [更新仓库] ${RepoName} 更新操作中发生顶层意外错误:`,
        outerError
      );
      if (!pullError) {
        // 如果之前的 pullError 是空的，用这个顶层错误
        pullError = outerError;
      } else {
        // 如果已有 pullError，将此错误信息附加
        pullError.message += ` | OuterError: ${outerError.message}`;
      }
      wasForceReset = false; // 发生意外错误，重置状态无效
      latestLog = "发生意外错误，无法获取日志";
    } finally {
      MiaoPluginMBT.gitMutex.release();
    }

    // 向用户报告核心仓库的最终失败状态
    if (!success && RepoNum === 1 && e && !isScheduled) {
      const errorToReport =
        pullError || new Error(`${RepoName} 更新最终失败，原因未知`);
      // 尝试从 errorToReport 中提取关键 stderr 信息
      const stderrForReport = errorToReport.stderr || "";
      const criticalLinesForReport = (stderrForReport.split("\n") || [])
        .filter(
          (line) =>
            line.match(/^(fatal|error|warning):/i) &&
            !["trace:", "http.c:", "== Info:"].some((p) =>
              line.trim().startsWith(p)
            )
        )
        .slice(0, 5) // 最多显示5行关键错误
        .join("\n");
      const contextMessage = criticalLinesForReport
        ? `Git关键错误(部分):\n${criticalLinesForReport}`
        : "无关键Git错误输出，请查阅控制台。";

      await MiaoPluginMBT.ReportError(
        e,
        `更新${RepoName}`,
        errorToReport, // 传递最终的错误对象
        contextMessage,
        logger
      );
    } else if (!success && !isScheduled) {
      // 非核心仓库失败，只在控制台记录最终错误
      logger.error(
        `${logPrefix} [更新仓库] ${RepoName} 更新最终失败:`,
        pullError || "未知错误"
      );
    }

    // 返回结果对象
    return {
      success: success,
      hasChanges: hasChanges,
      log: latestLog,
      error: success ? null : pullError, // 只有失败时才返回 error 对象
      wasForceReset: wasForceReset,
    };
  }

  /**
   * @description 执行首次下载后的设置步骤。
   */
  static async RunPostDownloadSetup(e, logger = global.logger || console) {
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      await MiaoPluginMBT.SyncSpecificFiles(logger);
      logger.info(
        `${Default_Config.logPrefix} [下载后设置] 应用初始封禁规则...`
      );
      await MiaoPluginMBT.GenerateAndApplyBanList(
        MiaoPluginMBT._imgDataCache,
        logger
      );
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        logger.info(
          `${Default_Config.logPrefix} [下载后设置] 配置为默认启用，开始同步角色图片...`
        );
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else {
        logger.info(
          `${Default_Config.logPrefix} [下载后设置] 图库配置为默认禁用，跳过角色图片同步。`
        );
      }
      logger.info(
        `${Default_Config.logPrefix} [下载后设置] 所有步骤执行成功。`
      );
    } catch (error) {
      logger.error(
        `${Default_Config.logPrefix} [下载后设置] 执行过程中发生错误:`,
        error
      );
      if (e)
        await MiaoPluginMBT.ReportError(e, "安装后设置", error, "", logger);
    }
  }

  /**
   * @description 执行更新后的设置步骤。
   */
  static async RunPostUpdateSetup(
    e,
    isScheduled = false,
    logger = global.logger || console
  ) {
    try {
      await MiaoPluginMBT.LoadTuKuConfig(true, logger);
      await MiaoPluginMBT.SyncFilesToCommonRes(logger);
      const imageData = await MiaoPluginMBT.LoadImageData(true, logger);
      MiaoPluginMBT._imgDataCache = Object.freeze(imageData);
      await MiaoPluginMBT.LoadUserBans(true, logger);
      await MiaoPluginMBT.LoadAliasData(true, logger);
      logger.info(`${Default_Config.logPrefix} [更新后设置] 同步特定文件...`);
      await MiaoPluginMBT.SyncSpecificFiles(logger);
      logger.info(
        `${Default_Config.logPrefix} [更新后设置] 重新应用封禁规则...`
      );
      await MiaoPluginMBT.GenerateAndApplyBanList(
        MiaoPluginMBT._imgDataCache,
        logger
      );
      if (MiaoPluginMBT.MBTConfig.TuKuOP) {
        logger.info(
          `${Default_Config.logPrefix} [更新后设置] 图库已启用，正在同步更新后的角色图片...`
        );
        await MiaoPluginMBT.SyncCharacterFolders(logger);
      } else {
        logger.info(
          `${Default_Config.logPrefix} [更新后设置] 图库已禁用，跳过角色图片同步。`
        );
      }

      if (MiaoPluginMBT.MBTConfig.PM18 === true) {
        logger.info(
          `${Default_Config.logPrefix} [更新后设置] PM18 功能已开启，将在后台尝试部署 PM18 图片...`
        );
        setImmediate(async () => {
          await MiaoPluginMBT.deployPM18Files(logger);
        });
      } else {
        logger.info(
          `${Default_Config.logPrefix} [更新后设置] PM18 功能已关闭，跳过部署。`
        );
      }
    } catch (error) {
      logger.error(
        `${Default_Config.logPrefix} [更新后设置] 执行过程中发生错误:`,
        error
      );
      if (!isScheduled && e)
        await MiaoPluginMBT.ReportError(e, "更新后设置", error, "", logger);
      else if (isScheduled) {
        const Report = MiaoPluginMBT.FormatError("更新后设置(定时)", error);
        logger.error(
          `${Default_Config.logPrefix}--- 定时更新后设置失败 ----\n${Report.summary}\n${Report.suggestions}\n---`
        );
      }
    }
  }

  /**
   * @description 同步仓库中的文件到公共资源目录。
   */
  static async SyncFilesToCommonRes(logger = global.logger || console) {
    await fsPromises.mkdir(MiaoPluginMBT.paths.commonResPath, {
      recursive: true,
    });
    let s = 0,
      f = 0;
    for (const {
      sourceSubPath,
      destFileName,
      copyIfExists = true,
      isDir = false,
    } of MiaoPluginMBT.paths.filesToSyncToCommonRes) {
      const source = path.join(
        MiaoPluginMBT.paths.LocalTuKuPath,
        sourceSubPath
      );
      const dest = path.join(MiaoPluginMBT.paths.commonResPath, destFileName);
      try {
        await fsPromises.access(source);
        if (!copyIfExists) {
          try {
            await fsPromises.access(dest);
            continue;
          } catch (destAccessError) {
            if (destAccessError.code !== ERROR_CODES.NotFound)
              throw destAccessError;
          }
        }
        await fsPromises.mkdir(path.dirname(dest), { recursive: true });
        if (isDir) {
          await copyFolderRecursive(source, dest, {}, logger);
        } else {
          await fsPromises.copyFile(source, dest);
        }
        s++;
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          logger.error(
            `${Default_Config.logPrefix} [同步公共] ${sourceSubPath} 失败:`,
            error
          );
          f++;
        }
      }
    }
    //logger.info(`${Default_Config.logPrefix} [同步公共] 完成: ${s}成功, ${f}失败/跳过。`);  //调试日志-精简
  }

  /**
   * @description 同步仓库中的特定文件到指定目标目录。
   */
  static async SyncSpecificFiles(logger = global.logger || console) {
    let s = 0,
      f = 0;
    for (const { sourceSubPath, destDir, destFileName } of MiaoPluginMBT.paths
      .filesToSyncSpecific) {
      const source = path.join(
        MiaoPluginMBT.paths.LocalTuKuPath,
        sourceSubPath
      );
      const dest = path.join(destDir, destFileName);
      try {
        await fsPromises.access(source);
        await fsPromises.mkdir(destDir, { recursive: true });
        await fsPromises.copyFile(source, dest);
        s++;
      } catch (error) {
        if (error.code === ERROR_CODES.NotFound);
        else {
          logger.error(
            `${Default_Config.logPrefix} [同步特定] ${sourceSubPath} -> ${dest} 失败:`,
            error
          );
          f++;
        }
      }
    }
    //logger.info(`${Default_Config.logPrefix} [同步特定] 完成: ${s}成功, ${f}失败/跳过。`); //调试日志-精简
  }

  /**
   * @description 同步角色图片文件夹到目标插件目录。
   */
  static async SyncCharacterFolders(logger = global.logger || console) {
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean);

    await Promise.all(
      targetPluginDirs.map((dir) =>
        MiaoPluginMBT.CleanTargetCharacterDirs(dir, logger)
      )
    );
    const imageDataToSync = MiaoPluginMBT._imgDataCache;
    if (!imageDataToSync || imageDataToSync.length === 0) {
      logger.warn(
        `${Default_Config.logPrefix} [同步角色] 元数据为空，无法同步。`
      );
      return;
    }
    if (!(MiaoPluginMBT._activeBanSet instanceof Set)) {
      logger.warn(
        `${Default_Config.logPrefix} [同步角色] 生效封禁列表未初始化或类型错误。`
      );
    }

    //logger.info(`${Default_Config.logPrefix} [同步角色] 开始复制 (${imageDataToSync.length} 条元数据)...`); //调试日志-精简
    let copied = 0,
      banned = 0,
      missingSource = 0,
      noTarget = 0,
      errorCount = 0;
    const promises = [];

    for (const imgData of imageDataToSync) {
      const relativePath = imgData.path?.replace(/\\/g, "/");
      const storageBox = imgData.storagebox;

      if (!relativePath || !storageBox) {
        logger.warn(
          `${Default_Config.logPrefix} [同步角色] 跳过无效元数据项: path=${relativePath}, storagebox=${storageBox}`
        );
        noTarget++;
        continue;
      }

      if (MiaoPluginMBT._activeBanSet.has(relativePath)) {
        banned++;
        continue;
      }
      let sourceBasePath;
      if (storageBox === "Miao-Plugin-MBT") {
        sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath;
      } else if (storageBox === "Miao-Plugin-MBT-2") {
        sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath2;
      } else if (storageBox === "Miao-Plugin-MBT-3") {
        sourceBasePath = MiaoPluginMBT.paths.LocalTuKuPath3;
      } else {
        logger.warn(
          `${Default_Config.logPrefix} [同步角色] 未知的 storagebox: ${storageBox} for path: ${relativePath}`
        );
        noTarget++;
        continue;
      }
      if (!sourceBasePath) {
        logger.warn(
          `${Default_Config.logPrefix} [同步角色] 仓库路径未定义: ${storageBox}`
        );
        missingSource++;
        continue;
      }
      const sourcePath = path.join(sourceBasePath, relativePath);
      const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
      if (targetPath) {
        promises.push(
          (async () => {
            try {
              await fsPromises.access(sourcePath, fs.constants.R_OK);
              try {
                await fsPromises.mkdir(path.dirname(targetPath), {
                  recursive: true,
                });
                await fsPromises.copyFile(sourcePath, targetPath);
                copied++;
              } catch (copyErr) {
                errorCount++;
                if (copyErr.code !== ERROR_CODES.NotFound)
                  logger.warn(
                    `${
                      Default_Config.logPrefix
                    } [同步角色] 复制失败: ${path.basename(
                      sourcePath
                    )} -> ${targetPath}`,
                    copyErr.code
                  );
              }
            } catch (sourceAccessErr) {
              if (sourceAccessErr.code === ERROR_CODES.NotFound) {
                missingSource++;
              } else {
                errorCount++;
                logger.warn(
                  `${Default_Config.logPrefix} [同步角色] 访问源文件失败: ${sourcePath}`,
                  sourceAccessErr.code
                );
              }
            }
          })()
        );
      } else {
        noTarget++;
      }
    }
    await Promise.all(promises);
    //logger.info(`${Default_Config.logPrefix} [同步角色] 完成: 复制${copied}, 跳过(封禁${banned}+源丢失${missingSource}+无目标${noTarget}+错误${errorCount})。`);  //调试日志-精简
  }

  /**
   * @description 清理目标插件目录中由本插件创建的图片文件。
   */
  static async CleanTargetCharacterDirs(
    targetPluginDir,
    logger = global.logger || console
  ) {
    if (!targetPluginDir) return;
    //logger.info(`${Default_Config.logPrefix} [清理目标] ${targetPluginDir}`); //调试日志-精简
    let cleanedCount = 0;
    try {
      await fsPromises.access(targetPluginDir);
      const entries = await fsPromises.readdir(targetPluginDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const entryPath = path.join(targetPluginDir, entry.name);
        if (entry.isDirectory()) {
          const characterPath = entryPath;
          try {
            const files = await fsPromises.readdir(characterPath);
            const filesToDelete = files.filter(
              (f) =>
                f.toLowerCase().includes("gu") &&
                f.toLowerCase().endsWith(".webp")
            );
            for (const fileToDelete of filesToDelete) {
              const filePath = path.join(characterPath, fileToDelete);
              try {
                await fsPromises.unlink(filePath);
                cleanedCount++;
              } catch (unlinkErr) {
                if (unlinkErr.code !== ERROR_CODES.NotFound)
                  logger.warn(
                    `${Default_Config.logPrefix} [清理目标] 删除文件 ${filePath} 失败:`,
                    unlinkErr.code
                  );
              }
            }
          } catch (readSubErr) {
            if (
              ![ERROR_CODES.NotFound, ERROR_CODES.Access].includes(
                readSubErr.code
              )
            )
              logger.warn(
                `${Default_Config.logPrefix} [清理目标] 读取角色子目录 ${characterPath} 失败:`,
                readSubErr.code
              );
          }
        } else if (
          entry.isFile() &&
          entry.name.toLowerCase().includes("gu") &&
          entry.name.toLowerCase().endsWith(".webp")
        ) {
          const rootFilePath = entryPath;
          try {
            await fsPromises.unlink(rootFilePath);
            cleanedCount++;
          } catch (delErr) {
            if (delErr.code !== ERROR_CODES.NotFound)
              logger.warn(
                `${Default_Config.logPrefix} [清理目标] 删除根目录文件 ${rootFilePath} 失败:`,
                delErr.code
              );
          }
        }
      }
      //logger.info( `${Default_Config.logPrefix} [清理目标] 清理完成: ${targetPluginDir}, 共清理 ${cleanedCount} 个包含 'Gu' 的 .webp 文件。`);
    } catch (readBaseErr) {
      if (
        readBaseErr.code !== ERROR_CODES.NotFound &&
        readBaseErr.code !== ERROR_CODES.Access
      )
        logger.error(
          `${Default_Config.logPrefix} [清理目标] 读取目标插件目录 ${targetPluginDir} 失败:`,
          readBaseErr
        );
    }
  }

  /**
   * @description 后台执行 PM18 图片的解密和部署。
   */
  static async deployPM18Files(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const sourceRepoPath = MiaoPluginMBT.paths.LocalTuKuPath3;
    const tempCachePath = path.join(MiaoPluginMBT.paths.commonResPath, "Temp");
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean);

    //logger.info(`${logPrefix} [PM18部署]开始执行...`);   //调试日志-精简
    let copiedCount = 0,
      decryptedCount = 0,
      placedCount = 0,
      errorCount = 0;
    let deployError = null;

    try {
      if (!(await MiaoPluginMBT.IsTuKuDownloaded(3))) {
        logger.error(`${logPrefix} [PM18部署]失败：未找到三号仓库。`);
        return;
      }

      await safeDelete(tempCachePath);
      await fsPromises.mkdir(tempCachePath, { recursive: true });
      const findAndCopyMbt = async (currentSourceDir, currentTempDir) => {
        try {
          const entries = await fsPromises.readdir(currentSourceDir, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            const sourcePath = path.join(currentSourceDir, entry.name);
            const tempPath = path.join(currentTempDir, entry.name);
            if (entry.isDirectory()) {
              await fsPromises.mkdir(tempPath, { recursive: true });
              await findAndCopyMbt(sourcePath, tempPath);
            } else if (
              entry.isFile() &&
              entry.name.toLowerCase().endsWith(".mbt")
            ) {
              try {
                await fsPromises.copyFile(sourcePath, tempPath);
                copiedCount++;
              } catch (copyErr) {
                logger.warn(
                  `${logPrefix} [PM18部署]复制文件失败: ${sourcePath} -> ${tempPath}`,
                  copyErr.code
                );
                errorCount++;
              }
            }
          }
        } catch (readErr) {
          errorCount++;
        }
      };
      await findAndCopyMbt(sourceRepoPath, tempCachePath);
      //logger.info(`${logPrefix} [PM18部署]共复制 ${copiedCount} 个 .MBT 文件。`);   //调试日志-精简

      if (copiedCount === 0) {
        await safeDelete(tempCachePath);
        return;
      }

      const password = Buffer.from("1004031540");
      const salt = Buffer.from("guguniumbtpm18salt");
      const keyLength = 32;
      const iterations = 100000;
      const digest = "sha256";
      const key = crypto.pbkdf2Sync(
        password,
        salt,
        iterations,
        keyLength,
        digest
      );

      const unpad = (buffer) => {
        const padding = buffer[buffer.length - 1];
        if (padding < 1 || padding > 16) return buffer;
        for (let i = buffer.length - padding; i < buffer.length; i++) {
          if (buffer[i] !== padding) return buffer;
        }
        return buffer.slice(0, buffer.length - padding);
      };

      logger.info(`${logPrefix} [PM18部署]开始解密并释放文件...`);
      const decryptAndPlace = async (currentTempDir) => {
        try {
          const entries = await fsPromises.readdir(currentTempDir, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            const tempPath = path.join(currentTempDir, entry.name);
            if (entry.isDirectory()) {
              await decryptAndPlace(tempPath);
            } else if (
              entry.isFile() &&
              entry.name.toLowerCase().endsWith(".mbt")
            ) {
              const relativePath = path.relative(tempCachePath, tempPath);
              const targetFileName = entry.name.replace(/\.mbt$/i, ".webp");
              const targetRelativePath = path.join(
                path.dirname(relativePath),
                targetFileName
              );

              try {
                const encryptedDataWithIv = await fsPromises.readFile(tempPath);
                if (encryptedDataWithIv.length <= 16)
                  throw new Error("加密文件过短");
                const iv = encryptedDataWithIv.slice(0, 16);
                const ciphertext = encryptedDataWithIv.slice(16);
                const decipher = crypto.createDecipheriv(
                  "aes-256-cbc",
                  key,
                  iv
                );
                let decryptedData = Buffer.concat([
                  decipher.update(ciphertext),
                  decipher.final(),
                ]);
                decryptedData = unpad(decryptedData);

                const finalTargetPath = await MiaoPluginMBT.DetermineTargetPath(
                  targetRelativePath
                );
                if (!finalTargetPath) {
                  logger.warn(
                    `${logPrefix} [PM18部署]无法确定目标路径: ${targetRelativePath}`
                  );
                  errorCount++;
                  continue;
                }

                await fsPromises.mkdir(path.dirname(finalTargetPath), {
                  recursive: true,
                });
                await fsPromises.writeFile(finalTargetPath, decryptedData);
                decryptedCount++;
                placedCount++;
              } catch (decryptError) {
                logger.error(
                  `${logPrefix} [PM18部署]解密或写入文件失败: ${tempPath}`,
                  decryptError
                );
                errorCount++;
              }
            }
          }
        } catch (readErr) {
          logger.warn(
            `${logPrefix} [PM18部署]读取临时目录失败: ${currentTempDir}`,
            readErr.code
          );
          errorCount++;
        }
      };
      await decryptAndPlace(tempCachePath);
      logger.info(`${logPrefix} [PM18部署]解密完成，成功解密 ${decryptedCount} 个，成功释放 ${placedCount} 个。`);
    } catch (error) {
      deployError = error;
    } finally {
      await safeDelete(tempCachePath);
      //logger.info(`${logPrefix} [PM18部署]执行结束。错误数: ${errorCount}`);  //调试日志-精简
    }
  }

  /**
   * @description 执行 PM18 图片的清理。
   */
  static async cleanPM18Files(logger = global.logger || console) {
    const logPrefix = Default_Config.logPrefix;
    const targetPluginDirs = [
      MiaoPluginMBT.paths.target.miaoChar,
      MiaoPluginMBT.paths.target.zzzChar,
      MiaoPluginMBT.paths.target.wavesChar,
    ].filter(Boolean);

    //logger.info(`${logPrefix} [PM18清理] 开始执行...`);  //调试日志-精简
    let cleanedCount = 0;
    let cleanErrorCount = 0;

    try {
      const cleanPromises = targetPluginDirs.map(async (targetDir) => {
        //logger.info(`${logPrefix} [PM18清理] 正在扫描目录: ${targetDir}`);  //调试日志-精简
        try {
          await fsPromises.access(targetDir);
          const findAndDeleteGuX = async (currentDir) => {
            try {
              const entries = await fsPromises.readdir(currentDir, {
                withFileTypes: true,
              });
              for (const entry of entries) {
                const entryPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                  await findAndDeleteGuX(entryPath);
                } else if (
                  entry.isFile() &&
                  entry.name.toLowerCase().includes("gux") &&
                  entry.name.toLowerCase().endsWith(".webp")
                ) {
                  try {
                    await fsPromises.unlink(entryPath);
                    cleanedCount++;
                  } catch (unlinkErr) {
                    if (unlinkErr.code !== ERROR_CODES.NotFound) {
                      cleanErrorCount++;
                    }
                  }
                }
              }
            } catch (readErr) {
              if (
                readErr.code !== ERROR_CODES.NotFound &&
                readErr.code !== ERROR_CODES.Access
              ) {
                cleanErrorCount++;
              }
            }
          };
          await findAndDeleteGuX(targetDir);
        } catch (accessErr) {
          if (accessErr.code !== ERROR_CODES.NotFound) {
            cleanErrorCount++;
          } else {
          }
        }
      });

      await Promise.all(cleanPromises);
      // logger.info(`${logPrefix} [PM18清理] 清理完成，共删除 ${cleanedCount} 个 GuX 图片文件。`);  //调试日志-精简
    } catch (error) {
    } finally {
      logger.info(`${logPrefix} [PM18清理] 执行结束。错误数: ${cleanErrorCount}`);
    }
  }

  /**
   * @description 从本地仓库源恢复单个被解禁的文件到目标插件目录。
   */
  static async RestoreFileFromSource(
    relativePath,
    logger = global.logger || console
  ) {
    const sourcePath = await MiaoPluginMBT.FindImageAbsolutePath(relativePath);
    if (!sourcePath) {
      return false;
    }
    const targetPath = await MiaoPluginMBT.DetermineTargetPath(relativePath);
    if (!targetPath) {
      return false;
    }
    try {
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });
      await fsPromises.copyFile(sourcePath, targetPath);
      //logger.info(`${Default_Config.logPrefix} [恢复文件] ${targetPath}`);  //调试日志-精简
      return true;
    } catch (copyError) {
      logger.error(
        `${Default_Config.logPrefix} [恢复文件] ${relativePath} 失败:`,
        copyError
      );
      return false;
    }
  }

  /**
   * @description 获取渲染缩放样式值
   */
  static getScaleStyleValue(baseScale = 1) {
    const scalePercent =
      MiaoPluginMBT.MBTConfig?.renderScale ?? Default_Config.renderScale;
    const scaleFactor = Math.min(
      2,
      Math.max(0.5, (Number(scalePercent) || 100) / 100)
    );
    const finalScale = baseScale * scaleFactor;
    return `transform:scale(${finalScale}); transform-origin: top left;`;
  }

  /**
   * @description 获取当前插件的版本号
   */
  static GetVersionStatic() {
    try {
      const pkgPath = path.resolve(__dirname, "..", "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      return pkg.version || "4.9.1";
    } catch {
      return "4.9.1";
    }
  }

  /**
   * @description 测试所有配置的代理节点的连通性和速度。
   */
  static async TestProxies(
    baseRawUrl = RAW_URL_Repo1,
    logger = global.logger || console
  ) {
    const testFile = Default_Config.proxyTestFile;
    const timeoutDuration = Default_Config.proxyTestTimeout;
    const testPromises = Default_Config.proxies.map(async (proxy) => {
      let testUrl = "";
      let speed = Infinity;
      if (!proxy || typeof proxy !== "object") {
        logger.error(
          `${Default_Config.logPrefix} [网络测速] 遇到无效的代理配置项: ${proxy}`
        );
        return {
          name: "无效配置",
          speed: Infinity,
          priority: 9999,
          cloneUrlPrefix: null,
          testUrlPrefix: null,
        };
      }
      const proxyName = proxy.name || "未命名";
      if (proxy.testUrlPrefix === null) {
        return {
          name: proxyName,
          speed: Infinity,
          priority: proxy.priority ?? 999,
          cloneUrlPrefix: proxy.cloneUrlPrefix,
          testUrlPrefix: null,
        };
      }
      try {
        if (proxy.name === "GitHub") {
          testUrl = baseRawUrl + testFile;
        } else if (proxy.testUrlPrefix) {
          testUrl = proxy.testUrlPrefix.replace(/\/$/, "") + testFile;
          try {
            new URL(testUrl);
          } catch (urlError) {
            logger.warn(
              `${Default_Config.logPrefix} [网络测速] 构造的代理URL (${testUrl}) 格式可能不规范:`,
              urlError.message
            );
          }
        } else {
          return {
            name: proxyName,
            speed: Infinity,
            priority: proxy.priority ?? 999,
            cloneUrlPrefix: proxy.cloneUrlPrefix,
            testUrlPrefix: proxy.testUrlPrefix,
          };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeoutDuration);
        const startTime = Date.now();
        try {
          const response = await fetch(testUrl, {
            method: "GET",
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          speed = Date.now() - startTime;
          if (!response.ok) {
            // logger.warn(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 状态码非 OK: ${response.status}`); //调试日志-精简
            speed = Infinity;
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === "AbortError") {
            speed = Infinity;
            // logger.warn(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) 超时 (>${timeoutDuration}ms)`); //调试日志-精简
          } else {
            // logger.error(`${Default_Config.logPrefix} [网络测速] ${proxyName} (${testUrl}) fetch 出错: ${fetchError.message}`); //调试日志-精简
            speed = Infinity;
          }
        }
      } catch (error) {
        logger.error(
          `${Default_Config.logPrefix} [网络测速] 处理节点 ${proxyName} 时发生意外错误:`,
          error
        );
        speed = Infinity;
      }
      return {
        name: proxyName,
        speed: speed,
        priority: proxy.priority ?? 999,
        cloneUrlPrefix: proxy.cloneUrlPrefix,
        testUrlPrefix: proxy.testUrlPrefix,
      };
    });
    const results = await Promise.all(testPromises);
    return results;
  }

  /**
   * @description 根据测速结果和优先级，选择最佳的可用下载源。
   */
  static GetSortedAvailableSources(
    speeds,
    includeUntestable = false,
    logger = global.logger || console
  ) {
    if (!speeds || speeds.length === 0) return [];
    const available = speeds.filter((s) => {
      const testedOK =
        s.speed !== Infinity && (s.name === "GitHub" || s.cloneUrlPrefix);
      const untestableButValid =
        includeUntestable && s.testUrlPrefix === null && s.cloneUrlPrefix;
      return testedOK || untestableButValid;
    });
    if (available.length === 0) {
      logger.warn(
        `${Default_Config.logPrefix} [选择源] 没有找到任何可用的下载源！`
      );
      return [];
    }
    available.sort((a, b) => {
      const prioA = a.priority ?? 999;
      const prioB = b.priority ?? 999;
      if (prioA !== prioB) return prioA - prioB;
      const speedA =
        a.speed === Infinity || a.testUrlPrefix === null ? Infinity : a.speed;
      const speedB =
        b.speed === Infinity || b.testUrlPrefix === null ? Infinity : b.speed;
      return speedA - speedB;
    });
    const sourceNames = available.map(
      (s) =>
        `${s.name}(P:${s.priority ?? "N"}${
          s.speed !== Infinity
            ? `, ${s.speed}ms`
            : s.testUrlPrefix === null
            ? ", N/A"
            : ", Timeout"
        })`
    );
    // logger.info(`${Default_Config.logPrefix} [选择源] 可用下载源排序: ${sourceNames.join( " > " )}`);  //调试日志-精简
    return available;
  }
}

const GUGUNIU_RULES = [
  { reg: /^#下载咕咕牛$/i, fnc: "DownloadTuKu", permission: "master" },
  { reg: /^#更新咕咕牛$/i, fnc: "UpdateTuKu", permission: "master" },
  { reg: /^#重置咕咕牛$/i, fnc: "ManageTuKu", permission: "master" },
  { reg: /^#检查咕咕牛$/i, fnc: "CheckStatus" },
  { reg: /^#(启用|禁用)咕咕牛$/i, fnc: "ManageTuKuOption",permission: "master",},
  { reg: /^#咕咕牛封禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#咕咕牛解禁\s*.+$/i, fnc: "ManageUserBans", permission: "master" },
  { reg: /^#(?:ban|咕咕牛封禁)列表$/i, fnc: "ManageUserBans" },
  { reg: /^#咕咕牛导出\s*.+$/i, fnc: "ExportSingleImage" },
  { reg: /^#查看\s*.+$/i, fnc: "FindRoleSplashes" },
  { reg: /^#可视化\s*.+$/i, fnc: "VisualizeRoleSplashes" },
  { reg: /^#咕咕牛帮助$/i, fnc: "Help" },
  {
    reg: /^#咕咕牛触发错误(?:\s*(git|fs|config|data|ref|type|Repo1|Repo2|notify|other))?$/i,
    fnc: "TriggerError",
    permission: "master",
  },
  { reg: /^#咕咕牛测速$/i, fnc: "ManualTestProxies" },
  { reg: /^#执行咕咕牛更新$/i, fnc: "ManualRunUpdateTask",permission: "master", },
  { reg: /^#(咕咕牛设置|咕咕牛面板)$/i, fnc: "ShowSettingsPanel" },
  { reg: /^#咕咕牛设置(ai|彩蛋|横屏|净化等级|PM18)([012]|开启|关闭)$/i,fnc: "HandleSettingsCommand",permission: "master",},
];
