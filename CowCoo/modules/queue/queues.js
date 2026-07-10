import path from "node:path";
import crypto from "node:crypto";
import { Archive } from "./archive.js";
import { DepsInstaller } from "./deps.js";

export const FetchRules = [
  { reg: /^#咕咕牛下载\s+(.+)$/i, fnc: "FetchIns", permission: "master" },
  { reg: /^#咕咕牛下载列表$/i, fnc: "FetchList", permission: "master" },
  { reg: /^#咕咕牛下载删除\s+(.+)$/i, fnc: "FetchDel", permission: "master" },
  { reg: /^#咕咕牛下载更新\s+(.+)$/i, fnc: "FetchSync", permission: "master" }
];

const Safe_Git_Args = /^(-{1,2}[\w-]+|[\w./:@-]+)$/;
const Allowed_Git_Flags = new Set([
  "--depth", "-b", "--branch", "--single-branch",
  "--shallow-submodules", "--recurse-submodules",
  "--no-tags", "--bare", "--mirror", "--filter"
]);

function Parse_Input(raw) {
  const tokens = raw.trim().split(/\s+/);
  const url = tokens[0];
  const gitArgs = [];
  let mirrorPrefix = null;

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith("--mirror=")) {
      mirrorPrefix = tok.slice(9).replace(/\/+$/, "");
    } else if (Safe_Git_Args.test(tok)) {
      if (tok.startsWith("-") && !Allowed_Git_Flags.has(tok) && !Allowed_Git_Flags.has(tok.split("=")[0])) {
        continue;
      }
      gitArgs.push(tok);
    }
  }

  const Is_GitHub = /github\.com/i.test(url) && !/proxy|mirror/i.test(url);
  const Repo_Path = url.match(/github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?(?:[/?#].*)?$/i)?.[1] || "";
  const folderName = url
    .replace(/\.git$/, "")
    .replace(/[?#].*$/, "")
    .split("/")
    .pop() || `repo-${crypto.randomBytes(2).toString("hex")}`;
  const platform = url.match(/(github|gitee|gitcode|gitea)/i)?.[0]?.toLowerCase() || "unknown";

  return { url, gitArgs, mirrorPrefix, Is_GitHub, Repo_Path, folderName, platform };
}

export function Fetcher(ctx) {
  const {
    MiaoPluginMBT, Ananke, Metis, Morpheus, DocHub,
    MBTPipeControl, DFC, YzPath, Pheme, HadesEntry, getCore,
    getHades, MBTProcPool, Cerberus, common, Hermes
  } = ctx;

  const ArcPath = path.join(YzPath, "resources", "CowCoos", "Fetcher", "Archive.json");
  const ArcBase = path.dirname(ArcPath);
  const { Arc } = Archive({ Ananke });
  const arc = new Arc(ArcPath);
  const { Install: DepsInstall } = DepsInstaller({ MBTPipeControl, Ananke, HadesEntry, getCore });

  const TestVoice3x3 = async (logger) => {
    const Hades = getHades ? getHades(logger) : logger;
    const timeoutDuration = DFC.ProxyRepoTimeout || 5000;
    const BatchSize = 3;

    const AllNodes = (DFC.F2Pool || []).slice().sort((a, b) => (a.priority || 999) - (b.priority || 999));
    if (AllNodes.length === 0) {
      return [{ name: "GitHub", ClonePrefix: "https://github.com/", protocol: "HTTPS", speed: Infinity }];
    }

    const targetRawUrl = await Hermes.getRandomRawTarget(Hades);
    if (!targetRawUrl) {
      return [{ name: "GitHub", ClonePrefix: "https://github.com/", protocol: "HTTPS", speed: Infinity }];
    }

    for (let i = 0; i < AllNodes.length; i += BatchSize) {
      const batch = AllNodes.slice(i, i + BatchSize);

      const results = await Promise.allSettled(
        batch.map(async (proxy) => {
          const result = {
            name: proxy.name || "未命名",
            priority: proxy.priority || 999,
            ClonePrefix: proxy.ClonePrefix,
            TestUrlPrefix: proxy.TestUrlPrefix,
            protocol: "HTTP",
            speed: Infinity
          };
          let testUrl = "";
          if (proxy.name === "GitHub") {
            testUrl = targetRawUrl;
          } else if (proxy.TestUrlPrefix) {
            testUrl = Hermes.BuildMirrProbe(proxy.TestUrlPrefix, targetRawUrl);
          }
          if (testUrl) {
            try {
              const latResult = await Hermes.ProbeSpeed(testUrl, timeoutDuration);
              if (latResult.success) result.speed = latResult.data;
            } catch {}
          }
          return result;
        })
      );

      const survivors = results
        .filter((r) => r.status === "fulfilled" && r.value.speed !== Infinity)
        .map((r) => r.value);

      if (survivors.length > 0) {
        return survivors.sort((a, b) => a.speed - b.speed);
      }
    }

    return [{ name: "GitHub", ClonePrefix: "https://github.com/", protocol: "HTTPS", speed: Infinity }];
  };

  class FetcherMBT extends plugin {
    static mutex = new Metis("FetcherMutex", getHades ? getHades(getCore()) : getCore());

    constructor() {
      super({
        name: "『咕咕牛』下载器",
        dsc: "通用 Git 仓库下载器",
        event: "message",
        priority: 101,
        rule: FetchRules
      });
      this.logger = getHades ? getHades(getCore()) : getCore();
      this.mutex = FetcherMBT.mutex;
      this.pluginsDir = path.join(YzPath, "plugins");
      arc.Load().catch(() => {});
    }

    async _detectBranch(url) {
      try {
        const Rst = await MBTPipeControl(
          "git",
          ["ls-remote", "--symref", url, "HEAD"],
          { cwd: YzPath, caDisabled: true },
          15000
        );
        const Out = Rst.stdout || Rst.stderr || "";
        const Mt = Out.match(/ref:\s+refs\/heads\/([^\s]+)/);
        if (Mt) return Mt[1];
      } catch {}
      return "main";
    }

    async _fetchWithAlgorithm(e, url, targetPath, signal) {
      const Hds = getHades ? getHades(this.logger) : this.logger;
      const nodes = await TestVoice3x3(Hds);
      if (nodes.length === 0) {
        nodes.push({ name: "GitHub", ClonePrefix: "https://github.com/", protocol: "HTTPS", speed: Infinity });
      }
      const branch = await this._detectBranch(url);
      const RTC = { vectors: null, decision: null, history: [], timestamp: Date.now() };
      const MBTP = new MBTProcPool(Hds);
      const Cbr = Cerberus.getInstance();
      const SID = Cbr.beginSession({ repo: 0, repoName: `Fetcher:${url}`, source: "Fetcher" });
      Cbr.pulse(SID, { event: "session-start", state: "running", progress: 0, bytes: 0 });
      try {
        const Rst = await MiaoPluginMBT.SmartTaskHeavy(
          RTC, 0, url, branch, targetPath,
          e, Hds, nodes, MBTP, signal, null, SID
        );
        if (!Rst.success) throw Rst.error || new Error("算法调度下载失败");
        return Rst;
      } finally {
        MBTP.killAll("SIGTERM", "下载器流程结束");
      }
    }

    async _fetchWithMirror(url, mirrorPrefix, gitArgs, targetPath, signal) {
      const cleanPrefix = mirrorPrefix.replace(/\/+$/, "");
      const Is_GitHub = /github\.com/i.test(url);
      let actualUrl = url;
      if (Is_GitHub) {
        const repoPath = url.match(/github\.com\/([^/\s]+\/[^/\s]+?)(?:\.git)?(?:[/?#].*)?$/i)?.[1] || "";
        if (repoPath) actualUrl = `${cleanPrefix}/github.com/${repoPath}.git`;
      } else {
        actualUrl = `${cleanPrefix}/${url.replace(/^https?:\/\//, "")}`;
      }
      const cloneArgs = ["clone", ...gitArgs, actualUrl, targetPath];
      await MBTPipeControl("git", cloneArgs, { cwd: YzPath, signal, caWhitelist: [actualUrl, url] }, DFC.GitTimeout || 900000);
    }

    async _fetchDirect(url, gitArgs, targetPath, signal) {
      const cloneArgs = ["clone", ...gitArgs, url, targetPath];
      await MBTPipeControl("git", cloneArgs, { cwd: YzPath, signal, caWhitelist: [url] }, DFC.GitTimeout || 900000);
    }

    async FetchIns(e) {
      if (!(await this.initMBT(e))) return true;
      const raw = e.msg.replace(/^#咕咕牛下载\s+/i, "").trim();
      if (!raw) return Pheme.quote(e, "请提供下载 URL\n格式: #咕咕牛下载 <URL> [Git参数] [--mirror=前缀]");

      const parsed = Parse_Input(raw);

      if (!parsed.url || !/^https?:\/\//.test(parsed.url)) {
        return Pheme.quote(e, "URL 无效，需以 http:// 或 https:// 开头");
      }

      const targetPath = path.join(this.pluginsDir, parsed.folderName);

      await this.mutex.run(
        async (signal) => {
          await arc.Load();
          if (arc.Find(parsed.folderName)) {
            throw new Error(`插件 [${parsed.folderName}] 已存在，请先删除`);
          }
          if (await Ananke.Audit(targetPath)) {
            throw new Error(`目标目录已存在: ${targetPath}`);
          }

          await Ananke.mkdirs(ArcBase).catch(() => {});
          await Ananke.mkdirs(this.pluginsDir).catch(() => {});

          await Pheme.quote(e, `开始下载: ${parsed.folderName}\n来源: ${parsed.url}`);

          let usedAlgorithm = false;
          if (parsed.Is_GitHub && !parsed.mirrorPrefix) {
            usedAlgorithm = true;
            await this._fetchWithAlgorithm(e, parsed.url, targetPath, signal);
          } else if (parsed.mirrorPrefix) {
            await this._fetchWithMirror(parsed.url, parsed.mirrorPrefix, parsed.gitArgs, targetPath, signal);
          } else {
            await this._fetchDirect(parsed.url, parsed.gitArgs, targetPath, signal);
          }

          if (!(await Ananke.Audit(targetPath))) {
            throw new Error("下载完成但目标目录不存在");
          }

          let depsResult = { success: true, manager: null, skipped: true };
          try {
            depsResult = await DepsInstall(targetPath, this.logger);
          } catch (err) {
            this.logger.warn(`依赖安装异常: ${err?.message}`);
            depsResult = { success: false, manager: null, skipped: false };
          }

          const ownerName = parsed.url.match(/:\/\/[^/]+\/([^/]+)/)?.[1] || "未知";
          await arc.Add({
            url: parsed.url,
            alias: parsed.folderName,
            installPath: targetPath,
            folderName: parsed.folderName,
            platform: parsed.platform,
            ownerName,
            installDate: new Date().toISOString(),
            depsManager: depsResult.manager,
            gitArgs: parsed.gitArgs,
            mirrorPrefix: parsed.mirrorPrefix,
            usedAlgorithm,
            description: ""
          });

          const lines = [
            `---『咕咕牛下载器』---`,
            `插件下载完成✅`,
            `名称: ${parsed.folderName}`,
            `路径: ${targetPath}`,
            `平台: ${parsed.platform}`,
            `算法增强: ${usedAlgorithm ? "是" : "否"}`
          ];
          if (parsed.mirrorPrefix) lines.push(`镜像: ${parsed.mirrorPrefix}`);
          if (depsResult.skipped) lines.push(`依赖: 无 package.json，跳过`);
          else if (depsResult.success) lines.push(`依赖: ${depsResult.manager} 安装成功✅`);
          else lines.push(`依赖: 安装失败⚠️ (可手动安装)`);

          await Pheme.send(e, lines.join("\n"));
        },
        { id: `FetchIns:${parsed.folderName}`, ttl: 600000, priority: 10 }
      );

      return true;
    }

    async FetchList(e) {
      if (!(await this.initMBT(e))) return true;
      await this.mutex.run(
        async () => {
          await arc.Load();
          const items = arc.List();
          if (items.length === 0) {
            return Pheme.quote(e, "当前没有通过下载器安装的插件。");
          }

          const lines = ["---『咕咕牛下载器』已安装列表---", ""];
          for (const item of items) {
            lines.push(`📦 ${item.alias}`);
            lines.push(`   URL: ${item.url}`);
            lines.push(`   平台: ${item.platform} | 作者: ${item.ownerName}`);
            lines.push(`   依赖: ${item.depsManager || "未安装"} | 算法: ${item.usedAlgorithm ? "是" : "否"}`);
            if (item.mirrorPrefix) lines.push(`   镜像: ${item.mirrorPrefix}`);
            lines.push(`   安装: ${item.installDateDisplay}`);
            lines.push(`   更新: ${item.lastUpdateDisplay}`);
            lines.push("");
          }
          lines.push(`共 ${items.length} 个插件`);
          await Pheme.send(e, lines.join("\n"));
        },
        { priority: 20 }
      );
      return true;
    }

    async FetchDel(e) {
      if (!(await this.initMBT(e))) return true;
      const alias = e.msg.match(/^#咕咕牛下载删除\s+(.+)$/i)?.[1]?.trim();
      if (!alias) return Pheme.quote(e, "请提供要删除的插件名称");

      await this.mutex.run(
        async () => {
          await arc.Load();
          const record = arc.Find(alias);
          if (!record) throw new Error(`未找到插件 [${alias}]`);

          await Pheme.quote(e, `开始删除: ${alias}，正在清理文件...`);
          await Ananke.obliterate(record.installPath).catch(() => {});
          await arc.Remove(alias);
          await Pheme.quote(e, `插件 [${alias}] 已完全删除。`);
        },
        { priority: 10 }
      );
      return true;
    }

    async FetchSync(e) {
      if (!(await this.initMBT(e))) return true;
      const alias = e.msg.match(/^#咕咕牛下载更新\s+(.+)$/i)?.[1]?.trim();
      if (!alias) return Pheme.quote(e, "请提供要更新的插件名称");

      await this.mutex.run(
        async () => {
          await arc.Load();
          const record = arc.Find(alias);
          if (!record) throw new Error(`未找到插件 [${alias}]`);

          await Pheme.quote(e, `开始更新: ${alias}`);
          try {
            await MBTPipeControl("git", ["pull"], { cwd: record.installPath }, DFC.PullTimeout || 300000);
            await arc.Update(alias, { lastUpdate: new Date().toISOString() });
            await Pheme.quote(e, `插件 [${alias}] 更新完成✅`);
          } catch (err) {
            throw new Error(`更新失败: ${err?.message || "未知错误"}`);
          }
        },
        { priority: 10 }
      );
      return true;
    }

    async initMBT(e) {
      const logger = this.logger || getCore();
      const Hades = getHades ? getHades(logger) : logger;
      const states = MiaoPluginMBT.LifecycleStates;
      const lifecycleState = MiaoPluginMBT._getLifecycleState();

      if (lifecycleState === states.TEARING_DOWN) {
        await Pheme.notReady(e);
        return false;
      }

      if (lifecycleState === states.UNINITIALIZED) {
        try {
          await MiaoPluginMBT.init(Hades);
        } catch {}
      }

      if (MiaoPluginMBT._getLifecycleState() === states.READY && !MiaoPluginMBT.InitPromise) {
        try {
          await MiaoPluginMBT.init(Hades);
        } catch {}
      }

      if (MiaoPluginMBT.InitPromise) {
        await MiaoPluginMBT.InitPromise;
      }

      if (MiaoPluginMBT._getLifecycleState() !== states.READY) {
        await Pheme.notReady(e);
        return false;
      }

      return true;
    }
  }

  return { PluginClass: FetcherMBT, rules: FetchRules };
}

export default { Fetcher, FetchRules };
