<p align="center">
  <img src="https://s2.loli.net/2025/05/22/BXoFpIgChVyqWz2.png" width="100%" alt="咕咕牛图库 Banner"/>
</p>

<p align="center">
    <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/graphs/contributors"><img src="https://img.shields.io/github/contributors/GuGuNiu/Miao-Plugin-MBT?color=orange" alt="Contributors"></a>
    <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/stargazers"><img src="https://img.shields.io/github/stars/GuGuNiu/Miao-Plugin-MBT?color=yellow" alt="Stars"></a>
    <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/issues"><img src="https://img.shields.io/github/issues/GuGuNiu/Miao-Plugin-MBT?color=red" alt="Issues"></a>
</p>

## ✨ 简介

- **多插件兼容**：完美支持 `Miao-Plugin` / `ZZZ-Plugin` / `Waves-Plugin`
- **多游戏覆盖**：✅️ 原神 & ✅️ 崩坏：星穹铁道 & ✅️ 鸣潮 & ✅️ 绝区零
- **四仓分流**：内容分布在四个仓库，通过管理器智能下载，确保稳定与高速。
- **高度可控**：提供净化等级、PM18特殊图库开关等多种设置项，满足不同需求。
- **智能管理**：内置强大的图库管理器，更新、配置、查看状态！

## 🖼️ 净化等级设置

> [!WARNING]
> 为了避免机器人账号被封禁，咕咕牛提供了面板图净化功能。

使用指令 `#咕咕牛设置净化等级 <等级>` 来调整，等级定义如下：

| 等级 | 效果 | 详细说明 |
|:---:|:---|:---|
| **0** | **无过滤** | 显示所有图片，风险自负。 |
| **1** | **常规净化** | 过滤 R18 内容，但保留部分低风险的暗示性图片。 |
| **2** | **最高净化** | 过滤所有被标记的敏感内容，最安全的选择。 |

-   **P18 定义**: 角色非主观展示身体，无露点，存在低度挑逗或暗示性动作。
-   **R18 定义**: 明显主观展示身体，存在关键部位的刻意裸露或露点，具有高度挑逗或暗示性。

## 🛡️ 负载防御系统

> [!NOTE]
> 为了保障在低配置设备上高强度使用资源的稳定性，咕咕牛内置了一套智能的负载管理防御系统。

管理器提供两种运行模式：**高速模式** (默认) 和 **低负载模式**。

-   **高速模式**: 并发处理任务，响应速度最快，适合性能较好的设备。
-   **低负载模式**: 串行处理任务，牺牲部分速度以换取极致的稳定性。

在**低负载模式**下，你可以进一步设置**负载等级**来调整防御策略的严格程度。

| 等级 | 名称 | 效果 | 配置 |
|:---:|:---|:---|:---|
| **1** | **标准** | 默认等级，提供适度的指令冷却和资源监控。 |(15秒CD, 阈值: CPU>90% 且 内存>85%)|
| **2** | **保守** | 更长的冷却时间和更敏感的资源监控，适合资源紧张的环境。 |(30秒CD, 阈值: CPU>85% 且 内存>80%)|
| **3** | **极致** | 最严格的防御策略，最大限度防止机器人卡顿或崩溃。 |(60秒CD, 阈值: CPU>75% 或 内存>75%)|

-   **切换模式**: `#咕咕牛设置低负载[开启/关闭]`
-   **调整等级**: `#咕咕牛设置负载等级[1/2/3]` (仅在低负载模式开启时生效)

## 🔞 PM18 特殊仓库

> [!IMPORTANT]
> 四号仓库包含不受常规净化约束的 **高危级别** 面板图。它默认关闭，启用后会加载本地加密的面板图。

-   **开关指令**: `#咕咕牛设置PM18开启/关闭`
-   **封禁单图**: 如果遇到不喜欢的特定图片，可使用 `#咕咕牛封禁<图片ID>` 进行屏蔽。

## 📦 四仓分流说明

为了提升下载速度和稳定性，咕咕牛将图库资源分散在四个不同的 GitHub 仓库中。

[![一号仓库](https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT&show_owner=true)](../../../Miao-Plugin-MBT)
[![二号仓库](https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-2&show_owner=true)](../../../Miao-Plugin-MBT-2)  
[![三号仓库](https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-3&show_owner=true)](../../../Miao-Plugin-MBT-3)
[![四号仓库](https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-4&show_owner=true)](../../../Miao-Plugin-MBT-4)

## 🤔 常见问题 (Q&A)

-   **Q: 部分仓库下载失败怎么办？**
    -   **A:** 不用担心，管理器支持断点续传。你可以再次发送 `#下载咕咕牛` 即可继续未完成的下载。

-   **Q: 插件报错或运行不正常怎么办？**
    -   **A:** 可能是文件损坏或版本过旧。请先尝试重新执行安装指令覆盖旧文件，然后重启机器人。

-   **Q: 管理器出现奇怪的问题，指令没反应？**
    -   **A:** 这通常是临时的时序错乱导致，**重启机器人** 即可解决绝大部分问题。


## 🎨 界面一览

<p align="center">
  <i>咕咕牛图库管理器的核心界面截图</i>
  <br><br>
  <img src="https://s2.loli.net/2025/06/09/ZbNwqARpt9uM1kG.webp" width="100%">
</p>

---

## 🚀 管理器的安装

在你的机器人项目 **根目录** 下，打开终端并执行以下任一指令即可安装管理器：

**✅ 推荐源 (使用 Jsdelivr CDN)**
<br>
  
```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://cdn.jsdelivr.net/gh/GuGuNiu/Miao-Plugin-MBT@main/咕咕牛图库管理器.js"
```

<br>

**☑️ 备用源 (使用 Moeyy-GitHub Raw)**
<br>
  
```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main/咕咕牛图库管理器.js"
```


> [!TIP]
>  生效后，发送 `#下载咕咕牛` 指令，即可开始下载并自动应用！

## 📖 使用指南

发送 `#咕咕牛帮助` 查看所有可用指令和功能说明。

<details> <summary><strong>👉 点击展开/折叠帮助图</strong></summary>
<div align="center">
  <br>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://s2.loli.net/2025/05/05/zirbKvjTAByl3HS.webp" 
         alt="帮助图" 
         width="100%" 
         style="display: block; border-radius: 8px;">
  </a>
</div>
</details>

## ⚠️ 使用须知

❗ **本项目仅供学习交流使用，严禁用于任何商业用途。**

❗ **如图库内容涉及侵权，请立即联系作者进行删除。**

## 💐 特别鸣谢

感谢以下平台为本图库提供丰富的图片资源：

-   [Pixiv](https://www.pixiv.net/)
-   [Arca.live (韩国阿卡社区)](https://arca.live)
-   [小红书](https://www.xiaohongshu.com/explore)
-   [NGA (艾泽拉斯国家地理论坛)](https://nga.178.com/)
-   [X (原推特)](https://x.com)

---

<div align="left"> 
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://profile-counter.glitch.me/Miao-Plugin-MBT/count.svg" alt="Visitor Count">
  </a>
</div>
