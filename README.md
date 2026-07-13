# Miao-Plugin-MBT 🐂🐂

<img 
  decoding="async"
  align="right"
  src="https://files.seeusercontent.com/2026/03/08/W1eo/_Image_i6j1rji6j1rji6j1.png"
  width="35%"
  alt="image"
  title="image">
  
图库是 Yunzai 的插件角色面板图资源补充，涵盖了**原神&星铁&绝区零&鸣潮**的面板图资源，创建于**2023年10月**，希望能提供更优质的面板图资源<a href="https://qm.qq.com/q/cyXMqRBzY6" target="_blank" style="text-decoration: none;">
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
</a>，不过还是以原神和星铁为主！


#### 适配的游戏插件

| 游戏 | 插件名称 |
| :--- | :--- |
| 原神 / 星铁 | Miao-Plugin |
| 绝区零 | ZZZ-Plugin |
| 鸣潮 | Waves-Plugin |

管理器已内置 [智谱，讯飞星火] 双智能体辅助提供智能决策；同时支持 99.7% 的热重载可在不重启下热更新插件和子模块；

### ⚠️ 使用须知 · 请务必仔细阅读

- **部分图片为付费商业素材**，**图片资源严禁用于任何商业用途**。如有侵权请联系删除。
- 咕咕牛已购买素材仅用于展示用途，咕咕牛不拥有其版权**后续使用或传播行为与本项目无关**。

---

## 内容净化与过滤

> [!WARNING]
> 为应对潜在的封号威胁建议根据自身需求配置，此功能是贯穿全图库业务的核心优先级最高请着重考虑！

| 等级 | 效果         | 说明                                              |
|:----:|:-------------|:--------------------------------------------------|
| 0    | 无过滤       | 显示所有面板图，含敏感内容 ( 轻微露点占比0.02% )        |
| 1    | 常规净化     | 过滤全部 Rx18，保留低敏感的 Px18 内容                   |
| 2    | 最高净化     | 严格过滤所有敏感内容（含 Rx18 + Px18）            |

咕咕牛支持元数据级别的面板图封禁，配合以下指令可独立管理图片类型开关：
- #咕咕牛封禁 / 解禁 ```木偶Gu1``` (角色名)
- #咕咕牛设置 AI图 / 彩蛋图 / 横屏图 ```启|禁用```

## 社区图库模块

咕咕牛在已有完整适配基础上，扩展社区图库支援能力，开放接口、预置推荐库、允许自定义URL，以更低门槛包容多元图库来源：安装即自动识别仓库并应用，每周自动更新一次，更多功能可见帮助图；
| 作者 | 仓库地址 | 说明 |
| :--- | :--- | :--- |
| 何日见 | <https://github.com/herijian1/characterpic1> | 喵喵插件原神星铁高质量面板图 
| 夜 | <https://github.com/ye3011/normal-character> | 喵喵插件面板图 
| 阿修 | <https://github.com/AxiuCN/miao-plugin-ProfileImg> | Yunzai的原神&星铁面板图图库 

一键部署命令： 
- #咕咕牛安装何日见
- #咕咕牛安装夜
- #咕咕牛安装阿修

#### 自动下载算法途径

| 场景 | 说明 |
| :--- | :--- |
| Github地址且无代理网络 | 进入自动调度机分支，利用算法分配合适镜像站，此过程均会消耗一定量的硬盘存储空间 |
| Github地址且有代理网络 | 算法进入自动穿透继承代理网络分支，使用本地代理下载 |
| 非Github地址 | 进入标准流式传输分支 | 

>[!NOTE]
> 社区图库体积均较大且未拆分库，部分仓库的下载失败率偏高，算法会评估你的设备是否支持安装图库，如无法满足则需要你开启Clash等代理软件，强行使用可能会挤占硬盘存储空间！支持携带镜像头自定义URL；


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
