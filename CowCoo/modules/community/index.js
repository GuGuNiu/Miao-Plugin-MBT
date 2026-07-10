import path from "node:path";
import crypto from "node:crypto";
import { statfs } from "node:fs/promises";
import { DefaultRepos } from "./default_repos.js";
import { RpInfRes, ExtRpId, ExtRpNm, MtDfcRp, ExtRpCore, MtExist } from "./parser.js";
import { Scanner } from "./scanner.js";
import { CommunityTaskQueue, CommunityTaskError } from "./task_queue.js";

export const CommunityRules = [
  { reg: /^#咕咕牛安装\s*(.+)$/i, fnc: "CommIns", permission: "master" },
  { reg: /^#咕咕牛更新\s*.+$/i, fnc: "CommSync", permission: "master" },
  { reg: /^#咕咕牛卸载\s*.+$/i, fnc: "CommUn", permission: "master" },
  { reg: /^#咕咕牛列表$/i, fnc: "CommList", permission: "master" },
  { reg: /^#咕咕牛(安装|更新|安|更)($|\s)/i, fnc: "CommSyncTip", permission: "master", priority: 102 }
];

export function Community(ctx) {
  const {
    MiaoPluginMBT,
    Ananke,
    Metis,
    Tianshu,
    Morpheus,
    DocHub,
    MBTPipeControl,
    DFC,
    YzPath,
    Pheme,
    HadesEntry,
    getCore,
    getHades,
    MBTProcPool,
    Cerberus,
    common,
    Proteus,
    Hermes,
    PoseidonSpear,
    RuntimeCtx,
    rules = CommunityRules,
    defaultRepos = DefaultRepos
  } = ctx;
  const Scan = Scanner({ Ananke, Tianshu, MiaoPluginMBT });

  class CommunityMBT extends plugin {
    static mutex = new Metis("CommunityRepo", getHades ? getHades(getCore()) : getCore());
    static taskQueue = new CommunityTaskQueue(
      "CommunityRepo",
      CommunityMBT.mutex,
      getHades ? getHades(getCore()) : getCore(),
      { cooldownMs: 5 * 60 * 1000, maxQueueSize: 5 },
      getHades,
      Pheme
    );

    constructor() {
      super({
        name: "『咕咕牛』社区图库管理器",
        dsc: "管理社区图库资源",
        event: "message",
        priority: 101,
        rule: rules
      });
      this.logger = getHades ? getHades(getCore()) : getCore();
      const RpRt = path.join(YzPath, "resources", "CowCoos", "Communitys");
      this.paths = { base: RpRt, Config: path.join(RpRt, "Config.json") };
      this.config = {};
      this.mutex = CommunityMBT.mutex;
      this.taskQueue = CommunityMBT.taskQueue;
      this._loadConfig().catch(() => {});
      this.task = { name: "『咕咕牛』社区图库定时同步", cron: "0 0 4 * * 0", fnc: () => this.CommCronUp(), log: true };
    }

    async _loadConfig() {
      try {
        this.config = await Ananke.HydrateJson(this.paths.Config, {});
      } catch {
        this.config = {};
      }
      return this.config;
    }

    async _saveConfig() {
      return Ananke.FlushJson(this.paths.Config, this.config).catch((e) => {
        this.logger.error("配置保存失败", e);
        return false;
      });
    }

    async CommCronUp() {
      this.logger.info("开始执行社区图库每周定时更新...");
      try {
        await this.mutex.run(
          async (Signal) => {
            await this._loadConfig();
            for (const Alias in this.config) {
              try {
                const Info = this.config[Alias];
                if (Info.deployMode === "direct") {
                  const { syncedCount } = await this._updateDirect(Alias, Signal);
                  this.logger.info(`定时更新 ${Alias} 完成，同步 ${syncedCount} 个文件`);
                } else {
                  const { folderName } = Info;
                  const RpP = path.join(this.paths.base, folderName);
                  await MBTPipeControl("git", ["pull"], { cwd: RpP, Signal }, DFC.PullTimeout);
                  const { sourcePath } = await this._ScanStruct(RpP);
                  const { contentMap, CREMap } = await this._analyzeContent(sourcePath);
                  this.config[Alias].contentMap = contentMap;
                  await this._syncRepo(Alias, { sourcePath, CREMap });
                }
              } catch (Err) {
                this.logger.error(`定时更新 ${Alias} 失败:`, Err);
                const Report = DocHub._diagnose(`社区定时更新 ${Alias}`, Err, "");
                this.logger.error(`--- 社区定时更新诊断 ---\n${Report.summary}\n${Report.suggestions}\n---`);
              }
            }
          },
          { id: "CronUp", ttl: DFC.CommTTL, instant: true, priority: 30 }
        );
      } catch (e) {
        if (e?.code !== "Metis_Busy") this.logger.error("定时更新任务异常:", e);
      }
    }

    async CommSyncTip(e) {
      const DfcList = Object.keys(defaultRepos || {}).join(" / ");
      const HMsg = [
        "『社区图库指令』",
        "安装：#咕咕牛安装 [URL]:[简称] 或 默认简称",
        "更新：#咕咕牛更新 [简称/全部]",
        "卸载：#咕咕牛卸载 [简称]",
        "列表：#咕咕牛列表",
        `一键安装：${DfcList || "暂无默认图库"}`,
        "示例：#咕咕牛安装 https://github.com/user/repo:我的图库"
      ];
      await Pheme.quote(e, HMsg.join("\n"));
      return true;
    }

    _resolveRepoInfo(Input) {
      return RpInfRes(Input);
    }
    _extractRepoId(Url) {
      return ExtRpId(Url);
    }
    _extractRepoName(Url) {
      return ExtRpNm(Url);
    }
    _matchDefaultRepoByUrl(Url) {
      return MtDfcRp(Url, defaultRepos);
    }

    _checkDup(url) {
      const Installed = Object.entries(this.config).map(([A, I]) => ({ alias: A, url: I.url }));
      const Mt = MtExist(url, Installed);
      if (!Mt) return;
      const LvlTxt = Mt.level === "exact" ? "URL完全一致" : Mt.level === "canonical" ? "同源仓库" : "同名仓库";
      throw new Error(`检测到与已安装图库 [${Mt.alias}] 冲突：${LvlTxt}\n已安装地址：${Mt.url}\n如需重新安装，请先卸载 [${Mt.alias}]。`);
    }

    async _warnLargeRepo(e, repoInfo, ctx) {
      if (!repoInfo || repoInfo.repoType !== "超大型") return true;
      const Msg = [
        "⚠️ 部署预警",
        `预估体积：${repoInfo.estSize || "未知"}`,
        `预计流量消耗：${repoInfo.estTraffic || "未知"}`,
        "",
        "自动调度期间将启动多节点下载。",
        "流量消耗可能远超仓库本身体积。",
        "请确保网络环境充足，耐心等待。",
        "",
        "请在60秒内发送「确认下载」以继续操作。"
      ];
      await Pheme.quote(e, Msg.join("\n"));
      if (ctx) await ctx.suspend("等待用户确认下载");
      try {
        this.e = e;
        const isGroup = !!e.isGroup;
        const result = await this.awaitContext(isGroup, 60);
        if (result === false) {
          await Pheme.quote(e, "确认超时，操作已自动取消。");
          return false;
        }
        if (result?.msg?.trim() === "确认下载") {
          await Pheme.quote(e, "确认成功，开始下载...");
          return true;
        }
        await Pheme.quote(e, "未收到确认指令，操作已取消。");
        return false;
      } finally {
        if (ctx) await ctx.resume();
      }
    }

    async _CommMetaAC(Url, Plat) {
      const Emp = { description: "", ownerAvatarUrl: "" };
      const GhAvFallback = (owner) => ({ description: "", ownerAvatarUrl: `https://github.com/${owner}.png` });
      try {
        const Urp = Url.match(/(?:github|gitee|gitcode)\.com\/([^/]+\/[^/.]+)/i)?.[1]?.replace(/\.git$/i, "");
        if (!Urp) return Emp;
        const [Owner, Repo] = Urp.split("/");
        let ApiU,
          Hdr = {};
        switch (Plat) {
          case "github":
            ApiU = `https://api.github.com/repos/${Owner}/${Repo}`;
            Hdr = { "User-Agent": "Miao-Plugin-MBT" };
            break;
          case "gitee":
            ApiU = `https://gitee.com/api/v5/repos/${Owner}/${Repo}`;
            break;
          case "gitcode":
            ApiU = `https://gitcode.com/api/v5/repos/${Owner}/${Repo}`;
            break;
          default:
            return Emp;
        }
        const Res = await fetch(ApiU, { headers: Hdr });
        if (!Res.ok) {
          if (Plat === "gitcode") {
            const URes = await fetch(`https://gitcode.com/api/v4/users?username=${Owner}`);
            if (URes.ok) {
              const UData = await URes.json();
              const AvUrl = Array.isArray(UData) && UData[0]?.avatar_url ? UData[0].avatar_url : "";
              return { description: "", ownerAvatarUrl: AvUrl };
            }
          }
          if (Plat === "github") return GhAvFallback(Owner);
          return Emp;
        }
        const Data = await Res.json();
        return { description: Data.description || "", ownerAvatarUrl: Data.owner?.avatar_url || "" };
      } catch {
        if (Plat === "github") {
          const Owner = Url.match(/github\.com\/([^/]+)/i)?.[1]?.replace(/\.git$/i, "");
          if (Owner) return GhAvFallback(Owner);
        }
        return Emp;
      }
    }

    async initMBT(e) {
      try {
        if (!MiaoPluginMBT.BootStrap) {
          await MiaoPluginMBT.init(this.logger);
          await MiaoPluginMBT.InitPromise;
          if (!MiaoPluginMBT.BootStrap) throw new Error("主插件初始化未完成");
        }
        if (!MiaoPluginMBT._AliasData?.combined || Object.keys(MiaoPluginMBT._AliasData.combined).length === 0) {
          await MiaoPluginMBT.MetaHub.AC(true);
          if (!MiaoPluginMBT._AliasData?.combined || Object.keys(MiaoPluginMBT._AliasData.combined).length === 0)
            throw new Error("别名库为空，无法进行角色识别，请先执行 #更新咕咕牛。");
        }
        return true;
      } catch (Err) {
        this.logger.error("初始化检查失败:", Err);
        if (e) await Pheme.quote(e, Err.message || "插件尚未就绪，操作已取消。");
        return false;
      }
    }

    _resolveGameKey(MNM) {
      return Scan.RsvGmK(MNM);
    }
    async _ScanStruct(RpP) {
      return Scan.ScanStruct(RpP);
    }
    async _analyzeContent(SrcP) {
      return Scan.AnlCont(SrcP);
    }

    async _getManifestPath(Alias) {
      try {
        const Info = this.config[Alias];
        if (Info.deployMode === "direct") return path.join(this.paths.base, `${Info.folderName}_manifest.json`);
        return path.join(this.paths.base, Info.folderName, "sync_manifest.json");
      } catch {
        return null;
      }
    }

    async _loadSyncManifest(Alias) {
      try {
        const MP = await this._getManifestPath(Alias);
        return await Ananke.HydrateJson(MP, []);
      } catch {
        return [];
      }
    }

    async _saveSyncManifest(Alias, FL) {
      try {
        const MP = await this._getManifestPath(Alias);
        return await Ananke.FlushJson(MP, FL);
      } catch {
        return false;
      }
    }

    async _syncRepo(Alias, cached = {}) {
      try {
        const { folderName } = this.config[Alias];
        const LRP = path.join(this.paths.base, folderName);
        await this._RevertSync(Alias).catch(() => {});
        let { sourcePath, CREMap } = cached;
        if (!sourcePath) {
          const SR = await this._ScanStruct(LRP);
          sourcePath = SR.sourcePath;
        }
        if (!CREMap) {
          const Anl = await this._analyzeContent(sourcePath);
          CREMap = Anl.CREMap;
          this.config[Alias].contentMap = Anl.contentMap;
        }
        const TgtP = {
          gs: MiaoPluginMBT.Paths.Target.MiaoCRE,
          sr: MiaoPluginMBT.Paths.Target.MiaoCRE,
          zzz: MiaoPluginMBT.Paths.Target.ZZZCRE,
          waves: MiaoPluginMBT.Paths.Target.WavesCRE
        };
        const { STask, SMfst } = await Scan.CrawlImg(sourcePath, Alias, TgtP, CREMap);
        if (STask.length > 0) await Ananke.dispatchSync(STask, this.logger);
        await this._saveSyncManifest(Alias, SMfst);
        if (this.config[Alias]) this.config[Alias].lastSync = new Date().toISOString();
        return { success: true, syncedCount: STask.length };
      } catch (e) {
        this.logger.error(`同步异常: ${Alias}`, e);
        return { success: false, syncedCount: 0 };
      }
    }

    async _RevertSync(Alias) {
      try {
        const Mfst = await this._loadSyncManifest(Alias);
        if (!Mfst?.length) return;
        const TgtP = {
          gs: MiaoPluginMBT.Paths.Target.MiaoCRE,
          sr: MiaoPluginMBT.Paths.Target.MiaoCRE,
          zzz: MiaoPluginMBT.Paths.Target.ZZZCRE,
          waves: MiaoPluginMBT.Paths.Target.WavesCRE
        };
        await Promise.all(
          Mfst.map(async (FI) => {
            try {
              const TD = TgtP[FI.gameKey];
              if (TD) await Ananke.obliterate(path.join(TD, FI.relativePath));
            } catch {}
          })
        );
        await this._saveSyncManifest(Alias, []);
      } catch (e) {
        this.logger.warn(`RevertSync failed for ${Alias}`, e);
      }
    }

    async _DBH(Url) {
      try {
        const Rst = await MBTPipeControl("git", ["ls-remote", "--symref", Url, "HEAD"], { cwd: YzPath, caDisabled: true }, 15000);
        const Out = Rst.stdout || Rst.stderr || "";
        const Mt = Out.match(/ref:\s+refs\/heads\/([^\s]+)/);
        if (Mt) return Mt[1];
      } catch {}
      return "main";
    }

    async _DLGitHubRepo(e, Url, TgtP, Signal, repoInfo = null) {
      const Hds = getHades ? getHades(this.logger) : this.logger;
      let downloadConstraints = null;
      if (repoInfo?.ultraLarge) {
        try {
          const diskStat = await statfs(YzPath);
          const availGB = (diskStat.bsize * diskStat.bfree) / (1024 ** 3);
          if (availGB >= repoInfo.ultraLarge.diskSpaceExemptGB) {
            Hds.D(`磁盘可用空间 ${availGB.toFixed(1)}GB ≥ ${repoInfo.ultraLarge.diskSpaceExemptGB}GB`);
          } else {
            downloadConstraints = {
              maxConcurrent: repoInfo.ultraLarge.maxConcurrent,
              forceCleanupMs: repoInfo.ultraLarge.forceCleanupMs,
              active: true
            };
            Hds.D(`磁盘可用空间 ${availGB.toFixed(1)}GB < ${repoInfo.ultraLarge.diskSpaceExemptGB}GB: 最大并发=${downloadConstraints.maxConcurrent}, 强制清理间隔=${downloadConstraints.forceCleanupMs}ms`);
          }
        } catch {
          downloadConstraints = {
            maxConcurrent: repoInfo.ultraLarge.maxConcurrent,
            forceCleanupMs: repoInfo.ultraLarge.forceCleanupMs,
            active: true
          };
        }
      }
      const HttpResultMap = await MiaoPluginMBT.TestCaVoice(Hds);
      let validNodes = HttpResultMap.filter((r) => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
      if (validNodes.length === 0) {
        validNodes = [{ name: "GitHub", ClonePrefix: "https://github.com/", protocol: "HTTPS", speed: Infinity }];
      }
      const globalSenseChain = await Promise.race([
        MiaoPluginMBT.acquireChain(Hds),
        new Promise((_, reject) => setTimeout(() => reject(new Error("态势感知获取超时")), 30000))
      ]).catch(() => null);
      let TheGrid = MiaoPluginMBT._PruneFatigue(validNodes);
      if (TheGrid.length === 0) TheGrid = validNodes;
      const Br = await this._DBH(Url);
      const runtimeContext = new RuntimeCtx();
      let senseChain = globalSenseChain;
      if (!senseChain) {
        const envData = await Hermes.getEnvInfo(Hds);
        const bestMirror = TheGrid.find((n) => n.name !== "GitHub" && PoseidonSpear.isLive(n.name));
        const mirrorSpeed = bestMirror ? bestMirror.time || Infinity : Infinity;
        senseChain = await Proteus.sense(envData, mirrorSpeed, Hds);
      }
      runtimeContext.vectors = senseChain.vector;
      runtimeContext.decision = senseChain;
      const MBTP = new MBTProcPool(Hds);
      const Cbr = Cerberus.getInstance();
      const SID = Cbr.beginSession({ repo: 0, repoName: `Community:${Url}`, source: "Community" });
      Cbr.pulse(SID, { event: "session-start", state: "running", progress: 0, bytes: 0 });
      try {
        const Rst = await MiaoPluginMBT.SmartTaskHeavy(runtimeContext, 0, Url, Br, TgtP, e, Hds, TheGrid, MBTP, Signal, null, SID, downloadConstraints);
        if (!Rst.success) throw Rst.error || new Error("CRS调度下载失败");
        return Rst;
      } finally {
        MBTP.killAll("SIGTERM", "社区图库下载流程结束");
      }
    }

    async _cloneToTemp(Url, TgtP, Signal) {
      const USx = crypto.randomBytes(4).toString("hex");
      const TP = path.join(MiaoPluginMBT.Paths.TempDownloadPath, `Comm-${USx}`);
      await Ananke.mkdirs(MiaoPluginMBT.Paths.TempDownloadPath).catch(() => {});
      try {
        await MBTPipeControl("git", ["clone", "--depth=1", Url, TP], { cwd: YzPath, Signal, caWhitelist: [Url] }, DFC.GitTimeout);
        await Ananke.obliterate(TgtP).catch(() => {});
        await Ananke.rename(TP, TgtP);
      } catch (Err) {
        await Ananke.obliterate(TP).catch(() => {});
        throw Err;
      }
    }

    async _setupDirect(TgtP) {
      const GitDir = `${TgtP}.git`;
      const MiaoCRE = MiaoPluginMBT.Paths.Target.MiaoCRE;
      const { sourcePath, structureType } = await this._ScanStruct(TgtP);
      const { contentMap, CREMap } = await this._analyzeContent(sourcePath);
      await Ananke.rename(path.join(TgtP, ".git"), GitDir).catch(() => {});
      await Ananke.obliterate(TgtP);
      await MBTPipeControl("git", ["--git-dir", GitDir, "config", "core.bare", "false"], { cwd: YzPath }, 10000);
      await MBTPipeControl("git", ["--git-dir", GitDir, "config", "core.worktree", MiaoCRE], { cwd: YzPath }, 10000);
      await MBTPipeControl("git", ["--git-dir", GitDir, "--work-tree", MiaoCRE, "reset", "--hard", "HEAD"], { cwd: YzPath }, DFC.GitTimeout);
      const BrR = await MBTPipeControl("git", ["--git-dir", GitDir, "symbolic-ref", "--short", "HEAD"], { cwd: YzPath }, 5000);
      const Br = (BrR.stdout || "").trim() || "main";
      return { gitDir: GitDir, workTree: MiaoCRE, branch: Br, structureType, contentMap, CREMap };
    }

    async _syncDirect(Alias, WorkTree, CREMap) {
      try {
        await this._RevertSync(Alias).catch(() => {});
        const DirectCREMap = {};
        for (const [CN, Info] of Object.entries(CREMap)) {
          if (Info.gameKey === "zzz" || Info.gameKey === "waves") DirectCREMap[CN] = Info;
        }
        const TgtP = { zzz: MiaoPluginMBT.Paths.Target.ZZZCRE, waves: MiaoPluginMBT.Paths.Target.WavesCRE };
        const { STask, SMfst } = await Scan.CrawlImg(WorkTree, Alias, TgtP, DirectCREMap);
        if (STask.length > 0) await Ananke.dispatchSync(STask, this.logger);
        await this._saveSyncManifest(Alias, SMfst);
        if (this.config[Alias]) this.config[Alias].lastSync = new Date().toISOString();
        return { success: true, syncedCount: STask.length };
      } catch (e) {
        this.logger.error(`Direct同步异常: ${Alias}`, e);
        return { success: false, syncedCount: 0 };
      }
    }

    async _updateDirect(Alias, Signal) {
      const { gitDir, workTree, branch, CREMap } = this.config[Alias];
      const Opts = Signal ? { cwd: YzPath, Signal } : { cwd: YzPath };
      await MBTPipeControl("git", ["--git-dir", gitDir, "fetch", "--depth=1", "origin", branch], Opts, DFC.PullTimeout);
      await MBTPipeControl("git", ["--git-dir", gitDir, "--work-tree", workTree, "reset", "--hard", "FETCH_HEAD"], Opts, DFC.GitTimeout);
      return await this._syncDirect(Alias, workTree, CREMap);
    }

    async _revertDirect(Alias) {
      const { gitDir, workTree } = this.config[Alias];
      try {
        const R = await MBTPipeControl("git", ["--git-dir", gitDir, "ls-files"], { cwd: YzPath }, 30000);
        const Files = (R.stdout || "").trim().split("\n").filter(Boolean);
        await Promise.all(Files.map((f) => Ananke.obliterate(path.join(workTree, f)).catch(() => {})));
        const Dirs = await Ananke.readDir(workTree).catch(() => []);
        await Promise.all(
          Dirs.filter((d) => d.isDirectory()).map(async (d) => {
            try {
              const entries = await Ananke.readDir(path.join(workTree, d.name));
              if (entries.length === 0) await Ananke.obliterate(path.join(workTree, d.name));
            } catch {}
          })
        );
      } catch (e) {
        this.logger.warn(`Direct revert ls-files failed for ${Alias}`, e);
      }
      await this._RevertSync(Alias).catch(() => {});
      await Ananke.obliterate(gitDir).catch(() => {});
    }

    _buildAnalysisCapsules(CMap) {
      return Scan.BldCaps(CMap);
    }

    _buildRepoView(Alias, Info) {
      const NotIns = !!Info.notInstalled;
      const Plat = Info.platform || Info.url?.match(/(github|gitee|gitcode)/i)?.[0]?.toLowerCase() || "unknown";
      const HvRcog = !NotIns && Scan.HvRcog(Info.contentMap);
      const FmtDt = (Iso) => {
        if (!Iso) return "N/A";
        return new Date(Iso).toLocaleString("zh-CN", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      };
      return {
        alias: Alias,
        url: Info.url || "",
        platform: Plat,
        default: !!Info.default,
        notInstalled: NotIns,
        ownerName: Info.ownerName || "未知作者",
        ownerAvatarUrl: Info.ownerAvatarUrl || "",
        aboutDisplay: Info.aboutDisplay || "",
        description: Info.description || "",
        contentMap: Info.contentMap || {},
        hasRecognized: HvRcog,
        CommRepoSize: NotIns ? "N/A" : Info.CommRepoSize || "N/A",
        CommInsDate: NotIns ? "未安装" : FmtDt(Info.installDate),
        CommLastSync: NotIns ? "N/A" : FmtDt(Info.lastSync)
      };
    }

    async _CommOps(e, Title, Alias, SyncCnt) {
      try {
        const RpIf = this.config[Alias];
        if (!RpIf) return;
        const VP = {
          title: Title,
          alias: Alias,
          syncedCount: SyncCnt,
          url: RpIf.url,
          ownerName: RpIf.ownerName || "未知作者",
          ownerAvatarUrl: RpIf.ownerAvatarUrl || "",
          analysisCapsules: this._buildAnalysisCapsules(RpIf.contentMap || {})
        };
        const ImgB = await Morpheus.shot("Comm-Ops", {
          tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "resources", "html", "community", "comm_ops.html"),
          data: VP,
          logger: this.logger,
          pageBoundingRect: { selector: ".container" },
          MorpheusSignal: true
        });
        const FB = `${Title} [${Alias}]，同步文件数：${SyncCnt}。`;
        if (ImgB) await Pheme.img(e, ImgB, FB, this.logger);
        else await Pheme.quote(e, FB);
      } catch (Err) {
        this.logger.error("图片生成失败:", Err);
        await Pheme.quote(e, `${Title} [${Alias}]，同步文件数：${SyncCnt}。`);
      }
    }

    async CommIns(e) {
      if (!(await this.initMBT(e))) return true;
      try {
        const Inp = e.msg.replace(/^#咕咕牛安装\s*/i, "").trim();
        if (!Inp) return this.CommSyncTip(e);
        const DfcRp = defaultRepos?.[Inp];
        if (DfcRp) {
          const { url, alias, isHG, OwnNm, Plat } = this._resolveRepoInfo(`${DfcRp.url}:${Inp}`);
          const FldNm = crypto.createHash("md5").update(url).digest("hex").substring(0, 8);
          const TgtP = path.join(this.paths.base, FldNm);
          await this.taskQueue.run(
            async (Signal, ctx) => {
              await this._loadConfig();
              if (this.config[alias]) {
                await Pheme.quote(e, `图库 [${alias}] 已安装`);
                return;
              }
              this._checkDup(url);
              if (!(await this._warnLargeRepo(e, DfcRp, ctx))) return;
              await Ananke.mkdirs(this.paths.base);
              if (isHG) await this._DLGitHubRepo(e, url, TgtP, Signal, DfcRp);
              else await this._cloneToTemp(url, TgtP, Signal);
              await MiaoPluginMBT.MetaHub.AC(true);
              let syncedCount;
              if (DfcRp.deployMode === "direct") {
                const Dr = await this._setupDirect(TgtP);
                this.config[alias] = {
                  url,
                  folderName: FldNm,
                  deployMode: "direct",
                  gitDir: Dr.gitDir,
                  workTree: Dr.workTree,
                  branch: Dr.branch,
                  structureType: Dr.structureType,
                  platform: Plat,
                  ownerName: OwnNm,
                  contentMap: Dr.contentMap,
                  installDate: new Date().toISOString(),
                  lastSync: new Date().toISOString(),
                  default: true,
                  aboutDisplay: DfcRp.aboutDisplay
                };
                ({ syncedCount } = await this._syncDirect(alias, Dr.workTree, Dr.CREMap));
              } else {
                const { sourcePath, structureType } = await this._ScanStruct(TgtP);
                const { contentMap, CREMap } = await this._analyzeContent(sourcePath);
                this.config[alias] = {
                  url,
                  folderName: FldNm,
                  structureType,
                  platform: Plat,
                  ownerName: OwnNm,
                  contentMap,
                  installDate: new Date().toISOString(),
                  lastSync: new Date().toISOString(),
                  default: true,
                  aboutDisplay: DfcRp.aboutDisplay
                };
                ({ syncedCount } = await this._syncRepo(alias, { sourcePath, CREMap }));
              }
              const Meta = await this._CommMetaAC(url, Plat);
              this.config[alias].description = Meta.description;
              this.config[alias].ownerAvatarUrl = Meta.ownerAvatarUrl;
              await this._saveConfig();
              await this._CommOps(e, "安装完成", alias, syncedCount);
            },
            { id: `CommIns:${alias}`, ttl: DFC.CommTTL, priority: 10, taskLabel: `安装 ${alias}`, e }
          );
          return true;
        }
        const { url, alias, isHG, OwnNm, Plat } = this._resolveRepoInfo(Inp);
        const FldNm = crypto.createHash("md5").update(url).digest("hex").substring(0, 8);
        const TgtP = path.join(this.paths.base, FldNm);
        const MtDfc = this._matchDefaultRepoByUrl(url);
        const DfcInfo = MtDfc?.repoInfo || defaultRepos?.[alias] || null;
        await this.taskQueue.run(
          async (Signal, ctx) => {
            await this._loadConfig();
            if (this.config[alias]) {
              await Pheme.quote(e, `图库 [${alias}] 已安装`);
              return;
            }
            if (MtDfc && MtDfc.alias !== alias && this.config[MtDfc.alias]) {
              await Pheme.quote(e, `内置图库 [${MtDfc.alias}] 已安装`);
              return;
            }
            if (MtDfc && MtDfc.alias !== alias) await Pheme.quote(e, `检测到内置图库 [${MtDfc.alias}] ${MtDfc.repoInfo.aboutDisplay || ""}，将识别为内置镜像安装。`);
            this._checkDup(url);
            if (DfcInfo && !(await this._warnLargeRepo(e, DfcInfo, ctx))) return;
            await Ananke.mkdirs(this.paths.base);
            if (isHG) await this._DLGitHubRepo(e, url, TgtP, Signal, DfcInfo);
            else await this._cloneToTemp(url, TgtP, Signal);
            await MiaoPluginMBT.MetaHub.AC(true);
            let syncedCount;
            if (DfcInfo?.deployMode === "direct") {
              const Dr = await this._setupDirect(TgtP);
              this.config[alias] = {
                url, folderName: FldNm, deployMode: "direct",
                gitDir: Dr.gitDir, workTree: Dr.workTree, branch: Dr.branch,
                structureType: Dr.structureType,
                platform: Plat, ownerName: OwnNm,
                contentMap: Dr.contentMap,
                installDate: new Date().toISOString(),
                lastSync: new Date().toISOString(),
                ...(DfcInfo ? { default: true, aboutDisplay: DfcInfo.aboutDisplay } : {})
              };
              ({ syncedCount } = await this._syncDirect(alias, Dr.workTree, Dr.CREMap));
            } else {
              const { sourcePath, structureType } = await this._ScanStruct(TgtP);
              const { contentMap, CREMap } = await this._analyzeContent(sourcePath);
              this.config[alias] = {
                url, folderName: FldNm, structureType,
                platform: Plat, ownerName: OwnNm, contentMap,
                installDate: new Date().toISOString(),
                lastSync: new Date().toISOString(),
                ...(DfcInfo ? { default: true, aboutDisplay: DfcInfo.aboutDisplay } : {})
              };
              ({ syncedCount } = await this._syncRepo(alias, { sourcePath, CREMap }));
            }
            const Meta = await this._CommMetaAC(url, Plat);
            this.config[alias].description = Meta.description;
            this.config[alias].ownerAvatarUrl = Meta.ownerAvatarUrl;
            await this._saveConfig();
            await this._CommOps(e, "安装完成", alias, syncedCount);
          },
          { id: `CommIns:${alias}`, ttl: DFC.CommTTL, priority: 10, taskLabel: `安装 ${alias}`, e }
        );
      } catch (Err) {
        if (Err?.code === "Queue_Full") {
          await Pheme.quote(e, Err.message);
          return true;
        }
        this.logger.error("安装失败:", Err);
        try {
          const Inf = this._resolveRepoInfo(e.msg);
          const FldNm = crypto.createHash("md5").update(Inf.url).digest("hex").substring(0, 8);
          await Ananke.obliterate(path.join(this.paths.base, FldNm));
          await Ananke.obliterate(`${path.join(this.paths.base, FldNm)}.git`).catch(() => {});
        } catch {}
        await Pheme.quote(e, `社区图库安装中止。\n原因：${Err.message || "未知系统异常"}`);
        await DocHub.report(e, "安装社区图库", Err, "", this.logger);
      }
      return true;
    }

    async CommSync(e) {
      if (!(await this.initMBT(e))) return true;
      const Mt = e.msg.match(/^#咕咕牛更新\s*(.+)$/i);
      if (!Mt) return true;
      const Alias = Mt[1].trim();
      try {
        await this.taskQueue.run(
          async () => {
            try {
              await this._loadConfig();
              const IsA = Alias.toLowerCase() === "全部";
              const Tgts = IsA ? Object.keys(this.config) : [Alias];
              if (!IsA && !this.config[Alias]) throw new Error(`未找到简称为 [${Alias}] 的仓库。`);
              if (Tgts.length === 0) throw new Error("当前没有安装任何仓库");
              await Pheme.quote(e, `开始更新：${Alias}`);
              for (const A of Tgts) {
                try {
                  const Info = this.config[A];
                  const { url, platform } = Info;
                  if (Info.deployMode === "direct") {
                    const { syncedCount } = await this._updateDirect(A);
                    const Meta = await this._CommMetaAC(url, platform || url?.match(/(github|gitee|gitcode)/i)?.[0]?.toLowerCase() || "unknown");
                    if (Meta.description) Info.description = Meta.description;
                    if (Meta.ownerAvatarUrl) Info.ownerAvatarUrl = Meta.ownerAvatarUrl;
                    await this._saveConfig();
                    await this._CommOps(e, "更新完成", A, syncedCount);
                  } else {
                    const RpP = path.join(this.paths.base, Info.folderName);
                    await MBTPipeControl("git", ["pull"], { cwd: RpP }, DFC.PullTimeout);
                    const { sourcePath } = await this._ScanStruct(RpP);
                    const { contentMap, CREMap } = await this._analyzeContent(sourcePath);
                    this.config[A].contentMap = contentMap;
                    const Meta = await this._CommMetaAC(url, platform || url?.match(/(github|gitee|gitcode)/i)?.[0]?.toLowerCase() || "unknown");
                    if (Meta.description) this.config[A].description = Meta.description;
                    if (Meta.ownerAvatarUrl) this.config[A].ownerAvatarUrl = Meta.ownerAvatarUrl;
                    const { syncedCount } = await this._syncRepo(A, { sourcePath, CREMap });
                    await this._saveConfig();
                    await this._CommOps(e, "更新完成", A, syncedCount);
                  }
                } catch (Err) {
                  await DocHub.report(e, `更新社区图库 ${A}`, Err, "", this.logger);
                }
              }
            } catch (Err) {
              await DocHub.report(e, "更新社区图库", Err, "", this.logger);
              await Pheme.quote(e, Err.message);
            }
          },
          { id: `CommSync:${Alias}`, ttl: DFC.CommTTL, priority: 10, taskLabel: `更新 ${Alias}`, e }
        );
      } catch (Err) {
        if (Err?.code === "Queue_Full") {
          await Pheme.quote(e, Err.message);
        } else if (Err?.code !== "TTL_Expired") {
          await Pheme.quote(e, Err.message || "更新操作异常");
        }
      }
      return true;
    }

    async CommUn(e) {
      if (!(await this.initMBT(e))) return true;
      const Alias = e.msg.match(/^#咕咕牛卸载\s*(.+)$/i)?.[1]?.trim();
      if (!Alias) return true;
      try {
        await this.taskQueue.run(
          async () => {
            try {
              await this._loadConfig();
              const RpIf = this.config[Alias];
              if (!RpIf) throw new Error(`未找到简称为 [${Alias}] 的仓库。`);
              await Pheme.quote(e, `开始卸载：${Alias}，正在清理文件...`);
              if (RpIf.deployMode === "direct") {
                await this._revertDirect(Alias);
              } else {
                await this._RevertSync(Alias);
                await Ananke.obliterate(path.join(this.paths.base, RpIf.folderName));
              }
              delete this.config[Alias];
              await this._saveConfig();
              await Pheme.quote(e, `社区图库 [${Alias}] 已完全卸载。`);
            } catch (Err) {
              await DocHub.report(e, "卸载社区图库", Err, "", this.logger);
            }
          },
          { id: `CommUn:${Alias}`, ttl: 120000, priority: 10, taskLabel: `卸载 ${Alias}`, e }
        );
      } catch (Err) {
        if (Err?.code === "Queue_Full") {
          await Pheme.quote(e, Err.message);
        } else if (Err?.code !== "TTL_Expired") {
          await Pheme.quote(e, Err.message || "卸载操作异常");
        }
      }
      return true;
    }

    async CommList(e) {
      if (!(await this.initMBT(e))) return true;
      await this.mutex.run(
        async () => {
          try {
            await this._loadConfig();
            const DspC = { ...this.config };
            Object.entries(defaultRepos || {}).forEach(([Alias, Info]) => {
              if (!DspC[Alias]) DspC[Alias] = { ...Info, notInstalled: true };
            });
            if (Object.keys(DspC).length === 0) throw new Error("当前未安装任何社区图库。");
            const RpLst = await Promise.all(
              Object.entries(DspC).map(async ([Alias, Info]) => {
                let RpSz = "N/A";
                try {
                  if (!Info.notInstalled && Info.folderName) {
                    const BasePath = Info.deployMode === "direct"
                      ? `${path.join(this.paths.base, Info.folderName)}.git`
                      : path.join(this.paths.base, Info.folderName);
                    const Sz = await Ananke.measure(BasePath);
                    RpSz = await Ananke.measure(Sz, true);
                  }
                } catch {}
                return this._buildRepoView(Alias, { ...Info, CommRepoSize: RpSz });
              })
            );
            RpLst.sort((A, B) => {
              const AD = A.default ? 1 : 0,
                BD = B.default ? 1 : 0;
              if (AD !== BD) return BD - AD;
              if (AD && BD) {
                const AO = defaultRepos?.[A.alias]?.order || 0;
                const BO = defaultRepos?.[B.alias]?.order || 0;
                if (AO !== BO) return AO - BO;
              }
              return A.alias.localeCompare(B.alias, "zh-CN");
            });
            const VP = { repos: RpLst };
            const ImgB = await Morpheus.shot("Comm-List", {
              tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "resources", "html", "community", "comm_list.html"),
              data: VP,
              logger: this.logger,
              pageBoundingRect: { selector: ".container" },
              MorpheusSignal: true
            });
            if (ImgB) await Pheme.img(e, ImgB, "列表生成失败", this.logger);
            else throw new Error("列表生成失败");

            await common.sleep(2000);
            const CtRp = RpLst.filter((R) => !R.default && !R.notInstalled);
            if (CtRp.length > 0) {
              const forwardList = [];
              forwardList.push(`『咕咕牛』自定义图库列表 (${CtRp.length}个)`);
              for (const Repo of CtRp) {
                const lines = [];
                lines.push(`[${Repo.alias}] ${Repo.ownerName || "未知作者"}`);
                lines.push(`来源：${Repo.url}`);
                const tags = [];
                if (Repo.contentMap.gs > 0) tags.push(`原神 ${Repo.contentMap.gs}`);
                if (Repo.contentMap.sr > 0) tags.push(`星铁 ${Repo.contentMap.sr}`);
                if (Repo.contentMap.zzz > 0) tags.push(`绝区零 ${Repo.contentMap.zzz}`);
                if (Repo.contentMap.waves > 0) tags.push(`鸣潮 ${Repo.contentMap.waves}`);
                if (Repo.contentMap.unknown > 0) tags.push(`未识别 ${Repo.contentMap.unknown}`);
                if (tags.length > 0) lines.push(`内容：${tags.join(" | ")}`);
                lines.push(`体积：${Repo.CommRepoSize}`);
                lines.push(`安装：${Repo.CommInsDate}`);
                lines.push(`同步：${Repo.CommLastSync}`);
                forwardList.push(lines.join("\n"));
              }
              const ok = await Pheme.forward(e, forwardList, "自定义图库列表");
              if (!ok) {
                for (const txt of forwardList) {
                  await Pheme.quote(e, txt);
                  await common.sleep(300);
                }
              }
            }
          } catch (Err) {
            await DocHub.report(e, "社区图库列表", Err, "", this.logger);
            await Pheme.quote(e, Err.message || "获取列表失败");
          }
        },
        { priority: 20 }
      );
      return true;
    }
  }

  return { PluginClass: CommunityMBT, rules };
}

export default { Community, CommunityRules, DefaultRepos };