<p align="center">
  <img src="https://s2.loli.net/2025/04/13/vmLCJ54kUWxB83f.png" width="70%">
</p>

<div align="center"> 
  
  [![访问量](https://profile-counter.glitch.me/Miao-Plugin-MBT/count.svg)](https://github.com/GuGuNiu/Miao-Plugin-MBT)
  
</div>


<div align="center"> 

不管是哪个角色都会更新最最新的面板图，让面板图不在是迂腐不变的，符合咕咕牛审美的都会加
</div>

## 📄 简介

&emsp;&emsp;V4新版管理器使用多个镜像站自动测速最优下载以及JSON作为索引数据源`(PM18面板图则不受JSON索引相关功能的约束)`，请不要手动删除和修改图库下载的任何文件当前是全静态加载并且存在高耦合，否则将无法通过Js初始化自检，有疑问可以喵群AT咨询，issues处理不及时。

🔶2025年起将提供超高清以上面板图，不再使用巨型水印，新模板已使用QR Code代替 <br><br>
⤵️V4新版的管理器的下载逻辑 >>><br>
 &emsp;&emsp;1.国际服务器：优先使用Github失败则尝试国际通用镜像<br>
 &emsp;&emsp;2.国内服务器：测速后Github延迟<300ms优先使用反之按照镜像站测速节点<br>
<details>
<summary>点击展开-具体下载逻辑流程>>></summary>

| 阶段               | 子步骤                | 操作详情                                                                 | 函数调用                                  | 逻辑处理                                                                 |
|--------------------|-----------------------|--------------------------------------------------------------------------|------------------------------------------|--------------------------------------------------------------------------|
| **初始化检查**  | 1.1 插件自检          | 检查配置文件加载、路径有效性                                              | `CheckInit(e)`                          | ▶ 失败时终止并报错<br>▶ 成功则继续后续流程                                |
|                    | 1.2 仓库状态检查      | 扫描核心仓库（1号）和附属仓库（2/3号）                                     | `IsTuKuDownloaded(repoNum)`             | ▶ 已存在则跳过下载<br>▶ 缺失则加入下载队列                               |
| **网络测速**    | 2.1 节点准备          | 加载预设加速节点（如 `ghfast.top`）                                       | `TestProxies(baseRawUrl, logger)`       | -                                                                       |
|                    | 2.2 执行测速          | 通过请求 `/README.md` 测试节点延迟                                         | `fetch(testUrl)`                        | ▶ 记录响应时间（ms）<br>▶ 标记成功/失败状态                              |
|                    | 2.3 结果排序          | 按响应时间和成功率排序节点                                                 | `GetSortedAvailableSources(...)`        | ▶ 优先选择延迟＜200ms的节点                                              |
| **节点选择**    | 3.1 最优节点选择      | 选择排名最高的可用节点                                                    | -                                       | ▶ 全部失败时回退直连<br>▶ 同延迟则按优先级选择                           |
| **仓库克隆**    | 4.1 执行克隆          | 通过Git命令克隆到临时目录                                                 | `ExecuteCommand("git", cloneArgs...)`   | ▶ 实时显示进度百分比<br>▶ 超时或失败自动重试                             |
| **文件同步**    | 5.1 清理目标目录      | 清空 `miao-plugin` 目录                                                   | `safeDelete(targetPath)`                | ▶ 确保无残留文件                                                         |
|                    | 5.2 同步文件          | 从临时目录复制到目标目录                                                  | `copyFolderRecursive(...)`              | ▶ 校验SHA256哈希<br>▶ 损坏文件自动重新下载                               |
| **后续处理**    | 6.1 生成报告          | 记录下载耗时、使用节点等信息                                              | -                                       | 保存到 `download.log`                                                   |
|                    | 6.2 用户通知          | 弹出系统通知或界面提示                                                    | -                                       | 显示摘要：<br>✓ 成功下载3仓库<br>⏱ 总耗时2分15秒                        |

</details>

🔞净化等级的定义：<br>
&emsp;&emsp;Px18：角色非主观展示上半身和下半身无露点，低挑逗性/暗示动作<br>
&emsp;&emsp;Rx18：明显主观展示上半身和下半身且存在人类身体构造痕迹刻意露出且存在部分露点，高挑逗性/暗示动作

#### [Miao-Yunzai/TRSS-Yunzai]框架下支持的插件：
> [!TIP]
> - Miao-Plugin / ZZZ-Plugin / Waves-Plugin
> - `鹤望兰星铁插件`正在适配中 
> - ✅️原神 & ✅️星铁 & ✅️鸣潮 & ✅️绝区零 

#### [Karin]框架下支持的插件：
> [!TIP]
> - `karin-plugin-MysTool`正在适配中 
> - ✅️原神 & ✅️星铁 & ✅️绝区零

####  关于封禁 & 净化面板图

> [!WARNING]
> 如不希望出现容易引起封号的面板图可以使用 #设置咕咕牛净化等级<br>
> - 0：无过滤
> - 1：仅过滤R18，不过滤暗示和低挑逗性面板图
> - 2：最高等级净化，过滤JSON数据内的全部被标记的敏感内容<br> <br>
> - #咕咕牛封禁xxx 针对某一个面板图进行封禁，后续操作会围绕封禁列表，直至解封

####  关于R18++的面板图
> [!IMPORTANT]
>  已提供R18_PRO_MAX的面板图,默认不启用,请自己确认风险~<br> &emsp;启用后会加载本地加密面板图仅在导入插件内的状态下解密 <br>&emsp;&emsp;不受 `[封禁][净化等级][查看]`功能约束
> - #咕咕牛设置PM18开启/关闭

## ⚠️ 使用须知

❗ **仅供学习交流使用,严禁用于任何商业用途,如涉及侵权内容请立即联系删除**

❗ **输入 #咕咕牛帮助 查看使用方式**

## 🛠️ 多个框架下的管理器安装

### ✳️ `Miao-Yunzai/TRSS-Yunzai` 框架根目录下执行以下指令：

##### &emsp;&emsp;|_使用Moeyy源安装【推荐】>>

```bash
curl -sL "https://github.moeyy.xyz/https://github.com/GuGuNiu/Miao-Plugin-MBT/blob/main/咕咕牛图库管理器.js" -o "./plugins/example/咕咕牛图库管理器.js"
```

##### &emsp;&emsp;|_使用GitHub源安装->>
```bash
curl -sL "https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main/咕咕牛图库管理器.js" -o "./plugins/example/咕咕牛图库管理器.js"
```

##### &emsp;&emsp;|_使用jsdelivr源安装->>

```bash
curl -sL "https://cdn.jsdelivr.net/gh/GuGuNiu/Miao-Plugin-MBT@main/咕咕牛图库管理器.js" -o "./plugins/example/咕咕牛图库管理器.js"
```
---

### ✴️ `Karin` 框架根目录下执行以下指令：

##### 适配中


<br>
<br>

<div align="center">
  <a href="https://github.com/GuGuNiu/Miao-Plugin-MBT">
    <img src="https://s2.loli.net/2025/05/05/zirbKvjTAByl3HS.webp" 
         alt="帮助" 
         width="1200" 
         style="display: block; border-radius: 8px;">
  </a>
</div>
