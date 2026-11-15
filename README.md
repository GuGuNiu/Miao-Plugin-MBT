![](https://files.seeusercontent.com/2026/10/26/1paE/Generated-Image-October-26-2026-.jpg)

  
 Yunzai 的插件角色面板图资源补充，创建于2023年10月，目前涵盖了**原神&星铁&绝区零&鸣潮**的面板图资源，项目使用自研工作流二次创作面板图能在减少占用体积的前提下提升相对清晰度，咕咕牛希望能够提供更优质的面板图资源，留学移民可进群交流：<a href="https://qm.qq.com/q/cyXMqRBzY6" target="_blank" style="text-decoration: none;">
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
    💬 留学移民交流群
  </button>
</a>；

## 内容净化与过滤

> [!WARNING]
> 为应对潜在的封号威胁建议根据自身需求配置，此功能是贯穿图库的核心优先级最高请着重考虑！

| 等级 | 效果         | 说明                                              |
|:----:|:-------------|:--------------------------------------------------|
| 0    | 无过滤       | 显示所有面板图，含敏感内容 ( 轻微露点占比0.02% )        |
| 1    | 常规净化     | 过滤全部 Rx18，保留低敏感的 Px18 内容 ( 包含了暗示、非正常行为 )    |
| 2    | 最高净化     | 严格过滤所有敏感内容（含 Rx18 + Px18）            |

此外，咕咕牛还支持元数据级的面板图封禁，配合以下指令可独立管理图片类型开关：
> Tips: 面板图内容的展示优先级： 远程封禁 > 净化等级 > 封禁一二级标签 > 封禁单张
```markdown
- #咕咕牛封禁 / 解禁 ```木偶Gu1``` (角色名可不打Gu)
- #咕咕牛设置 Ai图 / 彩蛋图 / 横屏图 ```启|禁用``` (一级标签)
```
> Tips: 二级标签需要通过 '#咕咕牛查看' 了解有哪些标签,封禁会导致拥有该标签的图片被自动连坐封禁
```markdown
- #咕咕牛封禁 / 解禁 ```黑丝/白丝/比基尼``` (二级标签) 
```

## 社区面板图库

可以使用一键部署命令 `#咕咕牛安装 作者名` 完成自动安装，社区图库会每隔两天自动更新一次。由于除咕咕牛外的社区库均没有做仓库历史压缩，因此无法减少部署后的实际占用体积，后续版本可能考虑跟进封禁功能。

| 作者 | 仓库地址 | 说明 | 预估体积 |
| :--- | :--- | :--- | :--- |
| 何日见 | [查看仓库](https://github.com/herijian1/characterpic1) | 喵喵插件原神星铁高质量面板图 | 650MB + |
| 夜 | [查看仓库](https://github.com/ye3011/normal-character) | 喵喵插件面板图 | 5.5GB + |
| 阿修 | [查看仓库](https://github.com/AxiuCN/miao-plugin-ProfileImg) | Yunzai 的原神与星铁面板图图库 | 700MB + |

> Tips：仅使用咕咕牛安装可避免出现以上图库文件互相覆盖、文件名注水、重复图片无去重、下载难、仓库维护麻烦等问题。

## 调用与Api服务

> [!TIP]
> 未检测到 Miao-Plugin 时默认进入模式零；模式二仅支持标准 Miao-Plugin 插件使用；Api 支持任意 Fork 版本的 Miao-Plugin 调用；鸣潮与绝区零均默认模式一。

使用指令切换：`#咕咕牛设置图源0`（模式零）/ `#咕咕牛设置图源1`（模式一）/ `#咕咕牛设置图源2`（模式二），`#咕咕牛状态` 查看当前模式。

| Mode | 原理 | 特点 |
| :---: | :--- | :--- |
| M0 | 不复制文件也不拦截读取，只开放 HTTP API 供外部请求 | 不强制安装喵喵插件，可供早柚核心框架、Fork喵喵插件使用，支持无损压缩传输 |
| M1 | 把图库里的图片复制一份，放进喵喵找图用的文件夹 | 兼容性最好，代价是同一张图存两份占磁盘 |
| M2 | 不复制文件，只在喵喵找图那一刻，把咕咕牛拼成一份列表递过去，相当于给它一个虚拟图库 | 不占额外磁盘，图库更新后立刻生效，需要咕咕牛在运行中接管这次读取 |

> [!NOTE]
> - **层级机制**：本工作链是在文件系统层（直接 Hook `fs.readdirSync` / `fs.readdir` / `fs.promises.readdir`），与通过 Miao 图源配置接入图库的插件**不在同一层级**，二者互不感知，因此本链路的过滤 / 去重 / 比例规则不会作用于后者。[PR #1291](https://github.com/yoimiya-kokomi/miao-plugin/pull/1291)
> - **角色共用**：模式二和 Api 支持星铁角色Pro、强化体角色的面板图共用一个图集文件夹，且不会受到来自 Miao-Plugin 的角色共用选项控制。 [PR #1296](https://github.com/yoimiya-kokomi/miao-plugin/pull/1296)
> - **传输优化**：HTTP API 内置了基于 `Accept-Encoding` 的无损压缩传输（支持 Brotli / Gzip / Deflate 自动协商），并支持通过文件名或逻辑路径精准取图。

<details>
<summary>展开：调用链路示意</summary>

```
   喵喵要生成立绘 → 调用 CharImg.getProfileImgPool(name, isSuper)
       │   （模式二下该函数已被 patchReadChain 用 AsyncLocalStorage「ReadCtx」包了一层，
       │     用于标记"当前确实处在喵喵的合法读链路里"）
       └─ 喵喵逐个源去列目录，会调用 fs.readdirSync(dir, options) / fs.promises.readdir
            │
            │  ★ Hook 点：PanelPatch.install() 把 fs.readdirSync、fs.readdir、
            │     fs.promises.readdir 换成包装函数（原函数备份在 __MBTOrig），
            │     每次调用先问 arbitrate(dir, options)，命中就不走真实磁盘
            │
            ├─ 模式零：纯空载运行（无 Hook、无文件写入）→ 仅通过 HTTP API 提供接口与图片直供
            │
            ├─ 模式一：arbitrate 直接返回 hit:false（mode!=="M2"）→ 回落真实 fs 读取
            │    └─ 在plugins/miao-plugin/resources/profile/normal-character/<角色>/
            │         里是事先复制好的真实图片 → 读出 N 张
            │
            └─ 模式二：arbitrate 命中（三个条件同时成立）
                 ├─ dir 落在根 MiaoCRE 之下（path.resolve 前缀匹配）
                 ├─ inReadChain() 为真（ReadCtx 里 gen/mode 一致，挡住非喵喵读链路）
                 ├─ options.withFileTypes 非真
                 └─ 命中后：
                      ├─ state.pool.get(charName) 取该角色 Repo + Community 条目
                      ├─ 过滤：净化等级 / 远程封禁 / 同图 MD5 去重 dedupeByContent
                      ├─ 按 Ratio_Of {Repo:7, Community:3} 经 planWindow 拼 10 张窗口（窗口内不重复）
                      ├─ encodeEntry() 把每张图编码成相对目录的路径（充当文件名）
                      └─ 作为 readdir 的 entries 返回给 miao（全程不落地文件）
                          │
                          ▼
          喵喵在拿到的 entries 上 lodash.sample 随机抽 1 张
            ├─ 抽到 → 渲染出角色面板
            └─ 空池 → 回落喵喵自带 Splash 立绘
```

</details>

### 供图比例与去重

- 模式二采用10张分层窗口（7张咕咕牛 + 3张社区，窗口内不重复）。
- 同图按文件内容 Phash&MD5 去重；净化等级 / 封禁优先。

### HTTP API 直供（可选）

启用后监听 `127.0.0.1:3323`，路径前缀 `/api/panel/v1`，提供以下端点：

| 端点 | 说明 |
| :--- | :--- |
| `GET /health` | 存活与统计 |
| `GET /games` | 各游戏、各来源的图片数与比例 |
| `GET /chars` | 全部角色及每个角色的图片数 |
| `GET /random` | 随机返回 JSON（含 `urlPath`、`rated`、`gen` 等） |
| `GET /image` | 随机返回单张图片字节流 |

<details>
<summary>展开：配置项、查询参数与调用示例</summary>

| 配置项 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `PanelApiEnabled` | `true` | 是否启用 |
| `PanelApiHost` / `PanelApiPort` | `127.0.0.1` / `3323` | 监听地址 |
| `PanelApiToken` | 空 | 为空不鉴权；非空时需 `Authorization: Bearer <token>` 或 `?token=` |
| `PanelApiGames` | `gs, sr` | 放行的游戏 |
| `PanelApiMax` | `10` | 单次最多返回张数 |

| 参数 | 取值 | 说明 |
| :--- | :--- | :--- |
| `game` | `gs` / `sr` | 游戏（可多个） |
| `char` / `name` | 角色名（子串匹配） | 配合 `exact=1` 精确匹配 |
| `file` / `fileName` | 文件名或逻辑路径 | 精确指定图片（如 `雷电将军Gu1.webp` 或 `repo/雷电将军/雷电将军Gu1.webp`） |
| `panel` | `1`~`999` 或 `Gu1` | 面板编号 |
| `source` | `repo` / `community` | 只取某一来源 |
| `repo` | 存储仓名 | 指定主库下的子仓 |
| `num` / `count` | 正整数 ≤ `PanelApiMax` | 返回张数 |
| `distinct` | 默认 `1` | 同角色只保留 1 张 |
| `seed` | 整数 | 固定随机种子，可复现 |
| `antirepeat` / `noRepeat` | 默认 `1` | 反重复冷却（指定 `seed` 时自动关闭） |
| `pfl` | `0` / `1` / `2` | 净化等级（服务端过滤恒开，只能更严） |
| `ai` / `egg` / `layout` | `1` | 过滤 Ai / 彩蛋 / 横屏图 |
| `gen` | 如 `1-3`、`>=2` | 生成批次筛选 |
| `balance` / `fair` | `source` / `fair` | 按来源比例 / 完全均匀 |

```bash
curl -s -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3323/api/panel/v1/image?game=gs&char=桑多涅" -o itto.webp
curl -s "http://127.0.0.1:3323/api/panel/v1/random?game=sr&count=3&source=community"
```

</details>

## 🧰 衍生模块
以下能力是基于咕咕牛现有模块基础上共享出来用以改善 Yunzai 的使用体验
| 模块 | 说明 |
| --- | --- |
| **Yunzai 插件接力更新** | 插件更新因网络异常失败时由咕咕牛接管静默更新，不改代码、不改Git配置 |

## CowStudio Web 工作站

| 功能 | 说明 |
|---|---|
| 图库管理 Web 版 | 提供基于 Web 操作的图库管理功能 |
| Yunzai 管理 | 支持 Yunzai 插件、消息及面板图管理 |
| 数字资产可视化 | 支持咕咕牛图库数字资产的可视化展示 |
| 群用户交互优化 | 优化群用户交互体验 |

输入 `#咕咕牛登录` 获取访问链接，在群聊中发送则会隐藏公网IP

<details>
<summary><strong>CowStudio 内容管理工作站界面截图</strong></summary>
<img src="https://files.seeusercontent.com/2026/09/04/cxP9/download.png" alt="download.png" />
<img src="https://files.seeusercontent.com/2026/09/04/pZ8a/download.png" alt="download.png" />
</details>

## 侧栏水印说明

在保障 **作者** 数字图像版权、咕咕牛图库权益的前提下图片均都带有标识信息且渲染后不会看到，介意请勿安装！

<p align="center">
  <img src="./gs-character/桑多涅/桑多涅Gu8.webp" width="100%">
</p>

## 图库的安装方式

在 Yunzai 根目录打开终端执行以下命令安装管理器并通过管理器安装图库：

> [!TIP]
> 部署后输入 **#咕咕牛帮助** 查看命令，输入 **#下载咕咕牛** 安装图库自动启用。你至少需要准备 Nodejs 22 版本以上，否则会报错。<br>

```bash
curl -o "./plugins/example/咕咕牛图库管理器.js" -L "https://cdn.jsdelivr.net/gh/GuGuNiu/Miao-Plugin-MBT@main/咕咕牛图库管理器.js"
````

### ⚠️ 使用须知 · 请务必仔细阅读

- **图库使用付费的商业资源严禁用于任何商业用途**，**商业资源**仅用于展示用途且仓库持有者不拥有其版权**后续使用或传播行为与本项目无关**。如认为图库存在侵权行为请在 issues 建帖联系删除。
- **Paid commercial assets included in the gallery must not be used for any commercial purposes.** These assets are provided for display purposes only, and the repository owner does not hold the copyright to them. **Any subsequent use or redistribution of these assets is unrelated to this project.** If you believe the gallery contains copyright-infringing content, please open an issue to request its removal.

---

## 项目透明墙

> 以下对"数字资产持有者"、"面板图二次创作使用来源“、"数字影像所有者"统称为**原创者**

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
     <strong>资源同步模块/功能</strong>仅用于保障<strong>“原创者“</strong>的版权追溯清理遗留在用户本地的图片文件<br>
  </tr>

</table>


## 其它仓库

<div align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-2">
    <img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-2&theme=default" width="32%" alt="Miao-Plugin-MBT-2" />
  </a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-3">
    <img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-3&theme=default" width="32%" alt="Miao-Plugin-MBT-3" />
  </a>
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT-4">
    <img src="https://github-readme-stats.vercel.app/api/pin/?username=GuGuNiu&repo=Miao-Plugin-MBT-4&theme=default" width="32%" alt="Miao-Plugin-MBT-4" />
  </a>
  <a href="https://github.com/Siluluna/Genshin-CR-Repos">
    <img src="https://github-readme-stats.vercel.app/api/pin/?username=Siluluna&repo=Genshin-CR-Repos&theme=default" width="32%" alt="Genshin-CR-Repos" />
  </a>
  <a href="https://github.com/Siluluna/StarRail-CR-Repos">
    <img src="https://github-readme-stats.vercel.app/api/pin/?username=Siluluna&repo=StarRail-CR-Repos&theme=default" width="32%" alt="StarRail-CR-Repos" />
  </a>
</div>

<p align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://count.getloli.com/get/@GuGuNiu-MiaoPluginMBT?theme=moebooru" alt="Visitor Count" />
  </a>
</p>
