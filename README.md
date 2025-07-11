<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://s2.loli.net/2025/05/22/BXoFpIgChVyqWz2.png" width="800" alt="咕咕牛图库 Banner"/>
  </a>
</p>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://img.shields.io/badge/Miao--Yunzai-✓-blue.svg" alt="Miao-Yunzai"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://img.shields.io/badge/Trss--Yunzai-✓-green.svg" alt="Trss-Yunzai"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/stargazers"><img src="https://img.shields.io/github/stars/GuGuNiu/Miao-Plugin-MBT?style=social" alt="Stars"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/issues"><img src="https://img.shields.io/github/issues/GuGuNiu/Miao-Plugin-MBT?color=red" alt="Issues"></a>
</p>

# 前言

**咕咕牛图库 (GuGuNiu Gallery)** 是为 `Yunzai` 设计的高性能、高可控的面板图库扩展插件。提供了海量的游戏角色图片资源，更内置了一套强大的智能管理系统，旨在为提供稳定、流畅且安全的图库体验。所有功能逻辑代码都素互相交叉，代码内配置了10把不同的互斥锁和大量异步逻辑和分散到处都素的错误处理器以及大量的静态属性，如果有问题最好是提交Issues而不是尝试修改，插件已经做到了95%的场景无人值守的自主运维，”操作自动化”、“流程自动化”和“智能自动化”三个层面基本是无需人工介入干预。

## ✨ 核心功能

- **跨插件无缝支持**: 完美兼容 `Miao-Plugin`、`ZZZ-Plugin` 及 `waves-plugin`，自动同步并替换面板图。
- **丰富的游戏覆盖**: 提供 **原神、崩坏：星穹铁道、绝区零、鸣潮** 的面板图库资源。
- **高度可定制化**: 内置净化等级、AI/彩蛋/横屏图过滤、渲染精度调节等多种配置项，满足不同需求。
- **智能管理系统**:
  - **AI 错误诊断**: 插件出错时，自动生成包含**原因分析**和**解决方案**的图文报告。
  - **智能节点切换**: 下载/更新时自动探测网络，选择最优线路，并在失败时自动切换。
  - **系统负载保护**: 独有的三级负载防御系统，保障低配设备稳定运行。
- **模糊匹配与索引**: 支持角色名与别名的模糊匹配，并采用高性能内存索引，实现秒级响应。

## 🛠️ 功能详解

### 🛡️ 净化等级与内容过滤

> [!WARNING]
> 为了应对潜在的平台风控，咕咕牛提供了一套强大的内容净化系统。强烈建议根据自身需求配置。

使用指令 `#咕咕牛设置净化等级 <等级>` 来调整，等级定义如下：

| 等级 | 效果       | 详细说明                                         |
|:----:|:-----------|:-------------------------------------------------|
| **0**  | **无过滤**   | 显示所有图片，风险自负。                         |
| **1**  | **常规净化** | 过滤 R18 内容，但保留部分低风险的暗示性图片 (Px18)。 |
| **2**  | **最高净化** | 过滤所有被标记为 R18 和 Px18 的敏感内容。           |

-   **Px18**: 指轻微性暗示或低度挑逗性图片，无关键部位裸露。
-   **Rx18**: 指存在关键部位刻意裸露或具有高度挑逗性的图片。
-   AI生成图指：由ai制作的图片
-   彩蛋图指：由咕咕牛图库内置的自控彩蛋非各个插件的彩蛋逻辑
-   横屏图指：全屏铺满的面板图

支持你的个性化需求多维度的图片管理如 **#咕咕牛封禁/解禁xx**<br>
此外还可以通过 `#咕咕牛设置` 指令对 **AI生成图、彩蛋图、横屏图** 进行独立开关。

### ⚙️ 负载防御系统

> [!NOTE]
> 为保障在低性能设备或高强度使用场景下的稳定性，插件内置了智能负载管理系统。

管理器提供两种运行模式，可通过 `#咕咕牛设置低负载 [开启|关闭]` 切换：

-   **高速模式 (默认)**: 并发处理任务，响应最快，适合性能较好的设备。
-   **低负载模式**: 串行处理任务，牺牲部分速度以换取极致的稳定性。

在**低负载模式**下，你还可以通过 `#咕咕牛设置负载等级 [1-3]` 调整防御策略的严格程度：

| 等级 | 名称 | 效果                                           |
|:----:|:-----|:-----------------------------------------------|
| **1**  | **标准** | 提供适度的指令冷却和资源监控。                 |
| **2**  | **保守** | 更长的冷却时间和更敏感的资源监控。             |
| **3**  | **极致** | 最严格的策略，最大限度防止机器人卡顿或崩溃。   |

### 🕵️ 原图拦截

> [!TIP]
> 开启后，插件会静默拦截 `#原图` 指令。若识别到图片来自咕咕牛图库，将以更安全的“合并转发”形式发送，有效规避风控。
- **开关指令**: `#咕咕牛设置原图拦截 [开启|关闭]`

## 🧩 第三方图库支持

> [!IMPORTANT]
咕咕牛现在允许你通过管理器安装和管理来自社区和其它仓库的第三方图库。

管理器内置了一套完整的第三方图库管理方案：

- **多平台兼容**: 支持从 **GitHub、Gitee、GitCode** 等平台克隆仓库。
- **智能结构分析**: 自动探测仓库内的文件夹结构，精准定位角色图片目录。
- **文件隔离与追踪**:
  - **清单追踪**: 为每个第三方图库建立独立的 `sync_manifest.json` 清单，精确记录每一个同步到游戏插件的文件。
  - **文件防冲突**: 同步时自动为文件名添加**仓库别名**作为前缀，避免不同图库间的文件覆盖。
- **精准卸载**: 基于同步清单，确保在卸载时**彻底清除**所有相关文件。

### 第三方图库指令

| 指令                                 | 效果                                |
|:-------------------------------------|:------------------------------------|
| `#咕咕牛安装 <URL:别名>`                 | 安装一个第三方图库并指定一个本地别名。 |
| `#咕咕牛更新 <别名\|全部>`               | 更新指定的或全部已安装的第三方图库。     |
| `#咕咕牛卸载 <别名>`                     | 彻底卸载一个第三方图库及其所有文件。     |
| `#咕咕牛列表`                          | 以图文形式展示所有已安装的第三方图库。     |

**例如**: `#咕咕牛安装 https://github.com/user/repo:我的图库`

---

---

## 🤔 常见问题 (Q&A)

-   **Q: 部分仓库下载失败怎么办？**
    -   **A:** 管理器支持断点续传。只需再次发送 `#下载咕咕牛`，即可继续未完成的下载任务。

-   **Q: 插件报错或运行不正常？**
    -   **A:** 首先尝试执行 `#更新咕咕牛` 指令覆盖文件，然后**重启机器人**。90% 的问题都可以通过此方法解决。若问题依旧，请携带由 AI 生成的错误报告图前往 Issues 反馈。

---

## 🎨 界面一览

<p align="center">
  <i>咕咕牛图库管理器 v5.0 核心界面预览</i>
  <br><br>
  <img src="https://s2.loli.net/2025/07/01/Lt7Aw6gSGv4ZeCD.webp" width="100%">
</p>

---

## ⚠️ 使用须知

-   本项目基于 `MIT` 协议开源，仅供学习交流使用，**严禁用于任何商业用途,图片版权归属原作者**。
-   图库资源均收集自公开网络，版权归原作者所有。如内容涉及侵权，请立即联系删除。

## 🚀 快速上手

### 1. 安装管理器

在机器人项目**根目录**下，打开终端并执行以下任一指令：

**✅ 主源 (Jsdelivr CDN)**
```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://cdn.jsdelivr.net/gh/GuGuNiu/Miao-Plugin-MBT@main/咕咕牛图库管理器.js"
```

**☑️ 备用源 (GitHub Raw 代理)**
```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://github.moeyy.xyz/https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main/咕咕牛图库管理器.js"
```

> [!TIP]
> 部署插件后 输入 **#咕咕牛帮助** 查看命令，输入 **#下载咕咕牛** 安装图库 。

---

## 💐 特别鸣谢

感谢以下平台为本图库提供丰富的图片资源：
[Pixiv](https://www.pixiv.net/) · [Arca.live](https://arca.live) · [小红书](https://www.xiaohongshu.com/explore) · [NGA](https://nga.178.com/) · [X (Twitter)](https://x.com)

## 📦 仓库分流

为提升下载速度和稳定性，咕咕牛将图库资源分散在四个不同的 GitHub 仓库中。

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT&show_owner=true&theme=transparent" alt="Repo 1"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-2"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-2&show_owner=true&theme=transparent" alt="Repo 2"></a>
  <br>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-3"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-3&show_owner=true&theme=transparent" alt="Repo 3"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-4"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-4&show_owner=true&theme=transparent" alt="Repo 4"></a>
</p>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://count.getloli.com/get/@GuGuNiu-MiaoPluginMBT?theme=moebooru" alt="Visitor Count" />
  </a>
</p>

