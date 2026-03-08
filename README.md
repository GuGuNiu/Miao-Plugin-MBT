# Miao-Plugin-MBT & 🐂

<img 
  decoding="async"
  align="right"
  src="https://files.seeusercontent.com/2026/03/08/W1eo/_Image_i6j1rji6j1rji6j1.png"
  width="35%"
  alt="image"
  title="image">
  
这个图库是 Yunzai 框架下的插件角色面板图资源补充，涵盖了**原神&星铁&绝区零&鸣潮**的面板图资源，创建于**2023年10月**，希望能提供更优质的面板图资源<a href="https://qm.qq.com/q/cyXMqRBzY6" target="_blank" style="text-decoration: none;">
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
    💬 QQ群：留学移民交流群
  </button>
</a>


#### 适配的游戏插件

| 游戏 | 插件名称 |
| :--- | :--- |
| 原神 / 星铁 | Miao-Plugin |
| 绝区零 | ZZZ-Plugin |
| 鸣潮 | Waves-Plugin（0卡苏打水版） |

面板图采用 `Nano-Banana-Pro`、`ComfyUI` 等工具进行二次调色与扩图处理，在质量优先的前提下持续优化视觉呈现。图库会定期替换不符合当前审美标准的旧图，避免无序扩张，避免出现超大体积图片，在保证图片画质与体积的前提下，提供最优的使用体验。 

管理器内置独立的生命周期总线，支持无需经过 Yunzai 框架的 HMR 热重载与自动热更新本体。
#### 管理器当期版本

> [!TIP]
> ©️ v5.2.0 正式版

### ⚠️ 使用须知 · 请务必仔细阅读

- **部分图片为付费商业素材**，**图片资源严禁用于任何商业用途**。如有侵权请联系删除。
- 咕咕牛已购买此素材仅用于展示用途，咕咕牛不拥有其版权**后续使用或传播行为与本项目无关**。

---

## 内容净化与过滤系统

> [!WARNING]
> 为应对潜在的封号威胁建议根据自身需求配置，此功能是贯穿全图库业务的核心优先级最高请着重考虑！

| 等级 | 效果         | 说明                                              |
|:----:|:-------------|:--------------------------------------------------|
| 0    | 无过滤       | 显示所有面板图，含敏感内容 ( 轻微露点占比0.02% )        |
| 1    | 常规净化     | 过滤全部 Rx18，保留低敏感的 Px18 内容                   |
| 2    | 最高净化     | 严格过滤所有敏感内容（含 Rx18 + Px18）            |

配合以下指令可独立管理图片类型开关：
- #咕咕牛设置 AI图 / 彩蛋图 / 横屏图 ```启|禁用```
- #咕咕牛封禁 / 解禁 ```角色名``` | ```[二级标签]```

> [!TIP]  
> [二级标签] 作为可选参数用于更精确的封禁管理，如 #咕咕牛封禁 黑丝 将会封禁所有黑丝相关的图片并且会优先遵循上层过滤等级，使用 #咕咕牛查看 指令查询二级标签信息

---

## 社区面板图库的支持

> [!NOTE]
> 咕咕牛提供了对 Yunzai 框架下的插件完整的垂直适配，管理器在每个星期都会自动更新社区图库。

- 支持从 **GitHub、Gitee、GitCode、Gitea** 平台克隆并自动探测仓库内的文件夹结构
- **示例**: `#咕咕牛安装https://github.com/user/repo:我的仓库`


### 🅰️ 社区图库指令表
  
| 指令                                 | 效果                                |
|:-------------------------------------|:------------------------------------|
| `#咕咕牛安装 <URL:简称>`                 | 安装社区图库 |
| `#咕咕牛更新 <简称\|全部>`               | 更新指定的或全部社区图库     |
| `#咕咕牛卸载 <简称>`                     | 卸载社区图库及其所有文件     |
| `#咕咕牛列表`                          | 展示所有已安装的社区图库     |

### 🅱️ 社区图库的内容过滤管理 ```©️ v5.2.1 实装```

| 指令                                 | 效果                                |
|:-------------------------------------|:------------------------------------|
| `#咕咕牛封/解禁芙芙<CID>`                 | 封/解禁指定图库的指定面板图 |
| `#咕咕牛过滤列表`                 | 展示已安装图库封禁情况 |

</details>

---

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

> [!TIP]
> 部署插件后输入 **#咕咕牛帮助** 查看命令，输入 **#下载咕咕牛** 安装图库自动启用。 <br>
> 你至少需要准备 Nodejs 22 版本以上，否则会报错。<br>
> 如有疑问可联系QQ: 310126340 咨询或加群

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
    <td style="white-space: nowrap;">树复制</td> 
    <td>以下对该模块/功能简称<strong>"资源同步":</strong> <br>
     <strong>资源同步模块/功能</strong>仅用于保障<strong>“原创者“</strong>的版权追溯清理遗留在用户本地的图片文件，<br>
  </tr>

</table>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://count.getloli.com/get/@GuGuNiu-MiaoPluginMBT?theme=moebooru" alt="Visitor Count" />
  </a>
</p>
