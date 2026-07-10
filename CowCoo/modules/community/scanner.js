import path from "node:path";

const ImExt = new Set([".webp", ".png", ".jpg", ".jpeg", ".bmp"]);
const GmLbl = { gs: "原神", sr: "星穹铁道", zzz: "绝区零", waves: "鸣潮" };
const GmKey = ["gs", "sr", "zzz", "waves"];
const SkpDir = new Set([".git", "node_modules", ".github", "dist", "build", ".idea", ".vscode", "__macosx"]);
const MxScanD = 30;
const ErlyTrm = 5;

function isNsDir(Nm) {
  return Nm.startsWith(".") || SkpDir.has(Nm.toLowerCase());
}

export function Scanner(ctx) {
  const { Ananke, Tianshu, MiaoPluginMBT } = ctx;

  function RsvGmK(MNM) {
    return GmKey.find((K) => MiaoPluginMBT._AliasData[`${K.toUpperCase()}Alias`]?.[MNM]) || null;
  }

  async function ScanStruct(RpP) {
    let BstP = RpP,
      BstS = 0;
    const Vst = new Set(),
      Que = [RpP];
    let DC = 0;
    while (Que.length > 0 && DC < MxScanD) {
      const Cur = Que.shift();
      if (Vst.has(Cur)) continue;
      Vst.add(Cur);
      DC++;
      let Ent;
      try {
        Ent = await Ananke.readDir(Cur);
      } catch {
        continue;
      }
      const CDir = [],
        CNam = [];
      for (const E of Ent) {
        if (!E.isDirectory() || isNsDir(E.name)) continue;
        CDir.push(path.join(Cur, E.name));
        CNam.push(E.name);
      }
      let Sc = 0;
      if (CNam.length > 0) {
        const Rst = await Promise.all(CNam.map((N) => Tianshu.NormalizeName(N)));
        Sc = Rst.filter((R) => R.exists).length;
      }
      if (Sc > BstS) {
        BstS = Sc;
        BstP = Cur;
        if (Sc >= ErlyTrm) break;
      }
      Que.push(...CDir);
    }
    return { structureType: BstP === RpP ? "root" : "subdir", sourcePath: BstP };
  }

  async function AnlCont(SrcP) {
    const CMap = { gs: 0, sr: 0, zzz: 0, waves: 0, unknown: 0, unknownFolders: [] };
    const CREMap = {};
    try {
      const Ent = await Ananke.readDir(SrcP);
      const Flds = Ent.filter((E) => E.isDirectory() && !isNsDir(E.name));
      if (Flds.length === 0) return { contentMap: CMap, CREMap };
      const Rst = await Promise.all(Flds.map((F) => Tianshu.NormalizeName(F.name)));
      for (let i = 0; i < Flds.length; i++) {
        const FldNm = Flds[i].name;
        const { exists, mainName } = Rst[i];
        if (!exists) {
          CMap.unknown++;
          CMap.unknownFolders.push(FldNm);
          continue;
        }
        const GmK = RsvGmK(mainName);
        if (GmK) {
          CMap[GmK]++;
          CREMap[FldNm] = { gameKey: GmK, mainName };
        } else {
          CMap.unknown++;
          CMap.unknownFolders.push(FldNm);
        }
      }
    } catch {}
    return { contentMap: CMap, CREMap };
  }

  function BldCaps(CMap) {
    const Caps = Object.entries(GmLbl).map(([K, L]) => ({ label: L, count: CMap[K] || 0 }));
    if (CMap.unknown > 0) Caps.push({ label: "未知", count: CMap.unknown });
    return Caps;
  }

  function HvRcog(CMap) {
    return GmKey.some((K) => (CMap?.[K] || 0) > 0);
  }

  async function CrawlImg(SrcP, Alias, TgtP, CREMap) {
    const STask = [],
      SMfst = [];
    const CharFlds = await Ananke.readDir(SrcP);
    for (const CE of CharFlds) {
      if (!CE.isDirectory() || isNsDir(CE.name)) continue;
      const CN = CE.name;
      let GmK;
      if (CREMap[CN]) GmK = CREMap[CN].gameKey;
      else {
        const AR = await Tianshu.NormalizeName(CN);
        if (!AR.exists) continue;
        GmK = RsvGmK(AR.mainName);
      }
      if (!GmK || !TgtP[GmK]) continue;
      const SCD = path.join(SrcP, CN),
        DCD = path.join(TgtP[GmK], CN);
      await Ananke.mkdirs(DCD).catch(() => {});
      const IFs = await Ananke.readDir(SCD);
      for (const IE of IFs) {
        if (ImExt.has(path.extname(IE.name).toLowerCase())) {
          const PFN = `C-${Alias}-${IE.name}`;
          STask.push({ src: path.join(SCD, IE.name), dest: path.join(DCD, PFN) });
          SMfst.push({ gameKey: GmK, relativePath: path.join(CN, PFN) });
        }
      }
    }
    return { STask, SMfst };
  }

  return { ScanStruct, AnlCont, BldCaps, HvRcog, CrawlImg, RsvGmK, isNsDir, ImExt, GmLbl, GmKey };
}

export default { Scanner, isNsDir, ImExt, GmLbl, GmKey };