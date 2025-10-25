<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://s2.loli.net/2025/05/22/BXoFpIgChVyqWz2.png" width="100%" alt="咕咕牛图库 Banner"/>
  </a>
</p> 

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

<div style="padding: 16px; border: 1px solid #ddd; border-radius: 10px; background: #f9f9fb; font-family: sans-serif;" align="center">
    ❓遇到问题可以加群 
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
      💬 点击加入QQ群：原神/星铁/鸣潮/绝区零/三角洲/王者/小米汽车/特斯拉交流群
    </button>
  </a>
</div>

<br>

咕咕牛提供了角色面板图资源及围绕面板图的智能化管理。 **2023年12月** 创建以来，不断在打磨稳定、高效且安全的图库体验。管理器采用多类协作与静态状态集中管理相结合的混合架构设计，模块间高度耦合、环环相扣，使用过程中如有问题欢迎反馈。

- ✅ 完美兼容 **Miao-Plugin**、**ZZZ-Plugin**、**Waves-Plugin** 插件
- ✅ 覆盖[**原神**、**崩坏：星穹铁道**、**绝区零**、**鸣潮**]的面板图资源
- ✅ 采用高性能模糊角色名匹配及多层内存索引，实现大部分功能**秒级响应**
- ✅ 高度自动化的管理系统，支持**95%以上**场景无人值守，流程及异常处理全自动化
- ✅ GitHub智能访问加速，具备多节点 Git+HTTP 双通道测速、故障自动切换、多节点并行下载、失效代理重试及双层下载容灾机制
- ✅ 完全付费的自动抠图方案：
  - 通过 **[Liblib 工作流 + Adobe 云]** 实现全流程自动抠图  
  - 部分图片采用 **Midjourney** 扩图并进行后期调色，确保每张图在视觉上的适配度和美感

## ⚠️ 使用须知 · 请务必仔细阅读

- 项目除图片资源外基于 **MIT 协议** 开源，**严禁用于任何商业用途**。如有侵权请联系删除。
- **部分图片为付费商业素材**，咕咕牛已购买此素材仅用于展示用途，咕咕牛不拥有其版权后续使用或传播行为与本项目无关。

---

## 🛡️ 内容净化与过滤系统

> [!WARNING]
> 为应对潜在的平台风控，建议根据自身需求配置。

| 等级 | 效果         | 说明                                              |
|:----:|:-------------|:--------------------------------------------------|
| 0    | 无过滤       | 显示所有图片，含敏感内容                          |
| 1    | 常规净化     | 过滤 R18，保留低风险 Px18 内容                   |
| 2    | 最高净化     | 严格过滤所有敏感内容（含 R18 + Px18）            |

配合以下指令可独立管理图片类型开关：
- `#咕咕牛设置 AI图 / 彩蛋图 / 横屏图`
- `#咕咕牛封禁 / 解禁 角色名 / [二级标签]`

>在5.0.3版本引入了二级标签，作为辅助查找封禁，可以用 #咕咕牛查看 具体了解有哪些

<details>
<summary>📌 标签说明</summary>

- **Px18**：轻微暗示，未暴露关键部位
- **Rx18**：暴露明显，尺度较大
- **AI图**：由 AI 画图大模型生成
- **彩蛋图**：咕咕牛内置逻辑，与各个插件无关
- **横屏图**：横向全屏的面板图

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
> Github源将会调用内置的高级下载器,不过如果仓库过大比如超过800MB那么失败概率就很高了,那么从咕咕牛安装的图库管理逻辑肯定也是按照咕咕牛的，有需要的话可以让仓库作者联系咕咕牛单独适配下
  
| 指令                                 | 效果                                |
|:-------------------------------------|:------------------------------------|
| `#咕咕牛安装 <URL:简称>`                 | 安装第三方图库 |
| `#咕咕牛更新 <简称\|全部>`               | 更新指定的或全部第三方图库     |
| `#咕咕牛卸载 <简称>`                     | 卸载第三方图库及其所有文件     |
| `#咕咕牛列表`                          | 展示所有已安装的第三方图库     |

</details>

<details> <summary> 🌏 GuTools Web控制台 </summary>

<br>
  
-   **Q: 启动机器人或更新后，控制台出 依赖安装 失败的报错怎么办？**
    -   **A:** 因为 Web 控制台 GuTools 的依赖未能自动安装，通常PNPM异常导致，你可以在机器人根目录或者Plugins/GuTools下打开终端运行`pnpm install` 尝试解决

  
<br>
通过 #咕咕牛登录 获取控制台的入口地址，更精细化、可视化的操作，当你在群聊内发送登录公网IP会主动被隐藏。

>需要你的服务器打开端口：31540

<img src="https://s2.loli.net/2025/07/30/QTu1pjy3VsaroPb.png" width="100%" alt="web-1"/>
<img src="https://s2.loli.net/2025/07/30/D6lbzwFsqVgi3UR.png" width="100%" alt="web-1"/>
<img src="https://s2.loli.net/2025/08/16/drqgF1uBpVA3hXv.png" width="100%" alt="web-1"/>

</details>

---

## 🤔 常见问题 (Q&A)

-   **Q: 部分仓库下载失败怎么办？**
    -   **A:** 管理器支持断点续传。只需再次发送 `#下载咕咕牛`，即可继续未完成的下载任务。

-   **Q: 管理器Js报错或运行不正常？**
    -   **A:** 先尝试重启，也可从仓库拉一份最新的Js然后重新覆盖，或者请携带由 AI 生成的错误报告图前往 Issues 反馈。
     
-   **Q: 更新图库后，看不到新面板图？**
    -   **A:** 索引数据未更新导致的，所有操作都会依据imagedata.json，索引数据不会及时更新。

-   **Q: 启动机器人或更新后，控制台出 依赖安装 失败的报错怎么办？**
    -   **A:** 因为 Web 控制台 GuTools 的依赖未能自动安装，通常PNPM异常导致，你可以在GuTools下打开终端运行`pnpm install` 尝试解决

-   **Q: 第三方/社区图库管理混乱？**
    -   **A:** 仅保证能用。

---

## 图库界面展示

<p align="center">
  <i>咕咕牛图库管理器全新 UX/UI 2.0 界面预览</i>
  <br><br>
  <img src="https://s2.loli.net/2025/07/01/Lt7Aw6gSGv4ZeCD.webp" width="100%">
</p>

<p align="center">
  <img src="./gs-character/芙宁娜/芙宁娜Gu6.webp" width="100%">
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
> 部署插件后 输入 **#咕咕牛帮助** 查看命令，输入 **#下载咕咕牛** 安装图库 。

---

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

