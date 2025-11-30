<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://s2.loli.net/2025/12/01/uOIEZhmibT2Bxav.webp" width="100%" alt="https://github.com/GuGuNiu/Miao-Plugin-MBT"/>
  </a>
</p> 

<div align="center">
  
🏵️**2023年10月**创建至今不断在打磨方便、高效且安全的 **“一体化面板图库生态”** 体验，
  <a href="https://qm.qq.com/q/cyXMqRBzY6" target="_blank" style="text-decoration: none;">
    <button style="
      padding: 10px 20px;
      font-size: 16px;
      font-weight: bold;
      color: white;
      background: linear-gradient(to right, #00aaff, #0077ff);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: background 0.3s ease;
    " onmouseover="this.style.background='linear-gradient(to right, #0099dd, #0055dd)'" 
       onmouseout="this.style.background='linear-gradient(to right, #00aaff, #0077ff)'">
      💬 QQ群：移民交流群
    </button>
  </a>🏵️

</div> 


---

## 🛒已实装功能

- ✅ 覆盖了 85%适配度的 **Miao-Plugin**、**ZZZ-Plugin**、**[0卡苏打水版]Waves-Plugin** 插件
- ✅ 覆盖了 [**原神**、**崩坏：星穹铁道**、**绝区零**、**鸣潮**]的面板图资源调度
- ✅ 支持了 高性能内存索引加速、角色名复杂变体识别提高查询准确率
- ✅ 支持了 **85%以上**场景无人值守，流程及异常处理自动化
- ✅ 支持了 围绕 **面板图** 的分级内容过滤管理
- ✅ 支持了 自适应的 Git 执行工具链 / 大量边缘使用场景容错
- ✅ 支持了 免费公共 **代理节点服务器** 访问保护避免对其造成过大压力
- ✅ 商业化的制图方案：
  - **[ 适配生态定制的 ComfyUI 工作流 + Adobe 云]** 实现全流程自动制图
  - 采用[ **Midjourney** / **Nano-banana Pro 3** ] 超分辨率扩图
  - 自定义了生态专用的压缩算法，确保在不损失大质量的前提下最大程度压缩面板图
  - 每张图都会进行后期调色，确保在视觉上的适配度和美感，以及匹配每个插件的背景色

## ⚠️ 使用须知 · 请务必仔细阅读

- 项目除图片资源外基于 **MIT协议** 开源，**图片资源严禁用于任何商业用途**。如有侵权请联系删除。
- **部分图片为付费商业素材**，咕咕牛已购买此素材仅用于展示用途，咕咕牛不拥有其版权**后续使用或传播行为与本项目无关**。

---

## 🛡️ 内容净化与过滤系统

> [!WARNING]
> 为应对潜在的平台风控，建议根据自身需求配置，此功能是贯穿全图库业务的核心，优先级最高请着重考虑！

| 等级 | 效果         | 说明                                              |
|:----:|:-------------|:--------------------------------------------------|
| 0    | 无过滤       | 显示所有面板图，含敏感内容 ( 轻微露点占比0.02% )        |
| 1    | 常规净化     | 过滤全部 Rx18，保留低敏感的 Px18 内容                   |
| 2    | 最高净化     | 严格过滤所有敏感内容（含 Rx18 + Px18）            |

配合以下指令可独立管理图片类型开关：
- #咕咕牛设置 AI图 / 彩蛋图 / 横屏图 ```启|禁用```
- #咕咕牛封禁 / 解禁 ```角色名``` | ```[二级标签]``` 

> [!TIP]  
> [二级标签] 可选参数，用于更精确的封禁管理，如 #咕咕牛封禁 黑丝 将会封禁所有黑丝相关的图片并且会优先遵循上层过滤等级

>在5.0.3版本引入了二级标签，作为辅助查找封禁，可以用 #咕咕牛查看 具体了解有哪些

<details>
<summary>📌 标签说明</summary>

- **Px18**：轻微暗示，未暴露关键部位
- **Rx18**：暴露明显，尺度较大
- **AI图**：由 AI 画图大模型生成
- **彩蛋图**：咕咕牛内置逻辑，与各个插件无关
- **横屏图**：横向全屏的面板图 [如果你使用了自己改的背景图那么建议还是关闭横屏图不然会非常的突兀]

</details>

---

## 🪄 咕咕牛的小口袋工具箱

<details> <summary> ⚙️ 负载均衡 </summary>

管理器提供两种运行模式，可通过 `#咕咕牛设置低负载 [开启|关闭]` 切换：

> 特别提醒：开启后若长时间处在高压状态则会马上释放任务并自动关闭低负载
  
-  **举例**:花火 80张在以下不同模式的处理速度:
-   **高速模式 (默认)**: 并发处理任务响应最快(1s-3s)
-   **低负载模式**: 串行处理任务牺牲部分速度(5s-10s)

在**低负载模式**下，你还可以通过 `#咕咕牛设置负载等级 [1-3]` 调整防御策略的严格程度：

| 等级 | 名称 | 效果                                           |
|:----:|:-----|:-----------------------------------------------|
| **1**  | **标准** | 提供适度的指令冷却和资源监控。                 |
| **2**  | **保守** | 更长的冷却时间和更敏感的资源监控。             |
| **3**  | **极致** | 最严格的策略，最大限度防止机器人卡顿或崩溃。   |
</details>

<details> <summary> 🧩 第三方/社区图库支持 </summary>

- 支持从 **GitHub、Gitee、GitCode、Gitea** 平台克隆并自动探测仓库内的文件夹结构
- **示例**: `#咕咕牛安装https://github.com/user/repo:我哈`
> Github源将会调用内置的高级下载器,图库管理逻辑按照咕咕牛的,单独说明下无法适配外部的鸣朝面板图因为鸣朝的角色识别非常复杂涉及到用户TOKEN，比如【早柚】核心的鸣朝插件资源就无法兼容，缺少ID和角色名映射表。
  
| 指令                                 | 效果                                |
|:-------------------------------------|:------------------------------------|
| `#咕咕牛安装 <URL:简称>`                 | 安装第三方图库 |
| `#咕咕牛更新 <简称\|全部>`               | 更新指定的或全部第三方图库     |
| `#咕咕牛卸载 <简称>`                     | 卸载第三方图库及其所有文件     |
| `#咕咕牛列表`                          | 展示所有已安装的第三方图库     |

💡TIPS：插件在每个星期都会自动更新一次社区图库

</details>

<details> <summary> 🌏 GuTools Web控制台 </summary>

<br>
  
-   **Q: 启动机器人或更新后，依赖安装失败的报错怎么办？**
    -   **A:** 因为 Web 控制台 GuTools 的依赖未能自动安装，通常PNPM异常导致，你可以在GuTools下打开终端运行`pnpm install` 尝试解决

  
<br>
通过 #咕咕牛登录 获取控制台的入口地址，更精细化、可视化的操作，当你在群聊内发送登录公网IP会主动被隐藏。但是WEB端本质上是方便我自己编辑索引数据没什么好用的。

>需要你的服务器打开端口：31540

<img src="https://s2.loli.net/2025/07/30/QTu1pjy3VsaroPb.png" width="100%" alt="web-1"/>
<img src="https://s2.loli.net/2025/07/30/D6lbzwFsqVgi3UR.png" width="100%" alt="web-1"/>
<img src="https://s2.loli.net/2025/08/16/drqgF1uBpVA3hXv.png" width="100%" alt="web-1"/>

</details>

---

## 🤔 常见问题 (Q&A)

-   **Q: 部分仓库下载失败怎么办？**
-   **A:** 插件支持断点续传。只需再次发送 `#下载咕咕牛`，即可继续未完成的下载任务。

-   **Q: 第三方/社区图库管理混乱？**
-   **A:** 仅保证能用

---

## 图库界面展示

<p align="center">
  <i>咕咕牛图库管理器全新 UX/UI 2.0 界面预览</i>
  <br><br>
  <img src="https://s2.loli.net/2025/07/01/Lt7Aw6gSGv4ZeCD.webp" width="100%">
</p>

<p align="center">
  <img src="./gs-character/哥伦比娅/哥伦比娅Gu11.webp" width="100%">
</p>

<i>水印说明：在保障原图作者利益和咕咕牛图库权益的前提下,每张图都会带标识信息水印,介意请勿安装</i>

---

## 安装方式

在 Yunzai 根目录执行以下任一命令安装管理器：

**✅推荐：JsDelivr CDN**
```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://cdn.jsdelivr.net/gh/GuGuNiu/Miao-Plugin-MBT@main/咕咕牛图库管理器.js"
````

**☑️备用：暂无**


> [!TIP]
> 部署插件后输入 **#咕咕牛帮助** 查看命令，输入 **#下载咕咕牛** 安装图库自动启用。 <br>
> 你至少需要准备 Nodejs 22 版本以上，否则会报错。

---

## 项目透明墙

> 以下对"数字资产所有者"，"面板图二次创作使用来源“，"图片原创者"，"数字影像所有者"统称为**原创者**

<table border="1" style="width: 100%; table-layout: fixed;">
  <tr>
    <th>模块/功能</th> 
    <th>具体说明</th>
  </tr>
  <tr>
    <td>远程封禁</td> 
    <td><strong>远程封禁模块/功能</strong>仅用于保障<strong>“原创者“</strong>的版权追溯，<br>
    <strong>远程封禁模块/功能</strong>不涉及任何 <strong>后门</strong>，咕咕牛仅作为协助<strong>暂停图像分发</strong>，<br>
    任何行为应遵循<strong>“原创者“</strong>当地法律，咕咕牛不承担因此产生的任何<strong>法律责任</strong>。</td> 
  </tr>
  
  <tr>
    <td style="white-space: nowrap;">FsTreeSync</td> 
    <td>以下对该模块/功能简称<strong>"资源同步":</strong> <br>
     <strong>资源同步模块/功能</strong>仅用于保障<strong>“原创者“</strong>的版权追溯清理遗留在用户本地的图片文件，<br>
  </tr>
  
</table>

## 公益的节点列表

> [!NOTE]
> 虽然部分节点拉黑了仓库，但是非常感谢曾经的帮助！以下排名不分先后按照增加日期排序

<table border="1" style="width: 100%; table-layout: fixed;">
  <tr>
    <th>简称</th> 
    <th>URL</th>
    <th>备注</th>
  </tr>
  <tr>
    <td style="white-space: nowrap;">Moeyy</td> 
    <td>https://moeyy.cn/blog</td> 
    <td>已经停止运营了</td>
  </tr>
  
  <tr>
    <td style="white-space: nowrap;">KGithub</td> 
    <td>https://help.kkgithub.com/</td> 
    <td>捐助链接：https://help.kkgithub.com/donate/</td>
  </tr>

  <tr>
    <td style="white-space: nowrap;">老牌镜像站</td> 
    <td>https://ghproxy.link/</td> 
    <td>捐助链接：https://ghproxy.link/donate</td>
  </tr>
  
</table>

## 分流仓库列表

<details> <summary>展开查看</summary>
<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT&show_owner=true&theme=transparent"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-2"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-2&show_owner=true&theme=transparent"></a>
  <br>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-3"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-3&show_owner=true&theme=transparent"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-4"><img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-4&show_owner=true&theme=transparent"></a>
</p>
</details>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://img.shields.io/badge/Miao--Yunzai-v3-blue.svg" alt="Miao-Yunzai"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT"><img src="https://img.shields.io/badge/Trss--Yunzai-v3-green.svg" alt="Trss-Yunzai"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/stargazers"><img src="https://img.shields.io/github/stars/GuGuNiu/Miao-Plugin-MBT?style=social" alt="Stars"></a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT/issues"><img src="https://img.shields.io/github/issues/GuGuNiu/Miao-Plugin-MBT?color=red" alt="Issues"></a>
</p>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://count.getloli.com/get/@GuGuNiu-MiaoPluginMBT?theme=moebooru" alt="Visitor Count" />
  </a>
</p>
