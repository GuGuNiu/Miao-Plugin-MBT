const RawPrx = [
  "ghproxy.com", "ghps.cc", "mirror.ghproxy.com",
  "hub.nuaa.cf", "gh.club.dev", "kkgithub.com",
  "git.1fd.eu.org", "gh.con.sh", "ghproxy.net",
  "ghproxy.homeboy.cn", "gitclone.com",
  "hub.fastgit.xyz", "github.com.cnpmjs.org",
  "ghproxy.cn", "ghps.haoren.ml"
];
const PlatPat = /(?:github\.com|gitee\.com|gitcode\.com|codeberg\.org|gitlab\.com|bitbucket\.org)/i;

function AssRInp(input) {
  const Pos = input.lastIndexOf(":");
  let Url = input, Alias;
  if (Pos > 5) {
    Url = input.substring(0, Pos).trim();
    Alias = input.substring(Pos + 1).trim();
  }
  Url = Url.trim();
  Alias = Alias || Url.split("/").pop().replace(/\.git$/i, "") || "Repo_" + Date.now();
  return { Url, Alias };
}

function IsRawPrxHost(Hst) {
  return RawPrx.some(P => Hst === P || Hst.endsWith("." + P));
}

function CvlUrlObj(Url) {
  try { return new URL(Url); } catch { return null; }
}

function IsRepoPath(Segs) {
  if (Segs.length < 2) return false;
  const Last = Segs[Segs.length - 1];
  if (/^[./]/.test(Last)) return false;
  if (/\.(?:css|js|json|html|htm|svg|png|jpg|jpeg|gif|ico|woff2?|ttf|eot|map|md|txt|log|xml|zip|tar|gz|rar|exe|dmg|apk|ipa)$/i.test(Last)) return false;
  const Pre = Segs[Segs.length - 2];
  if (!Pre || /^[./]/.test(Pre)) return false;
  return Pre.length >= 1 && Last.length >= 1 && Last.indexOf("?") === -1;
}

function LooksValidRepo(Str) {
  const P = Str.split("/").filter(Boolean);
  if (P.length < 3) return false;
  return /^[a-z0-9][\w.-]*\.[a-z]{2,}$/i.test(P[0]) && IsRepoPath(P.slice(1));
}

function UnwrapLayer(Url) {
  if (!Url.startsWith("http")) return Url;
  const Obj = CvlUrlObj(Url);
  if (!Obj) return Url;
  const Hst = Obj.hostname.toLowerCase();
  const Path = Obj.pathname;
  const Srch = Obj.search;
  if (!IsRawPrxHost(Hst)) return Url;
  const P1 = Path.match(/^\/(https?:\/\/.+)$/i);
  if (P1) return P1[1];
  const P2 = Path.match(/^\/([a-z0-9][\w.-]*\.[a-z]{2,}\/[^/]+\/[^/?]+)/i);
  if (P2) {
    const Candidate = "https://" + P2[1];
    if (CvlUrlObj(Candidate) && IsRepoPath(P2[1].split("/").filter(Boolean))) return Candidate;
  }
  const P3 = Path.match(/^\/[?&]?(?:url|target|u|link|goto|to|q)=?(https?:\/\/.+)$/i) ||
             Srch.match(/[?&](?:url|target|u|link|goto|to|q)=(https?:\/\/.+?)(?:&|$)/i);
  if (P3) return P3[1];
  const P4 = Path.match(/^\/(?:raw|cdn|mirror|proxy|gh)\/([a-z0-9][\w.-]*\.[a-z]{2,}\/[^/]+\/[^/?]+)/i);
  if (P4) {
    const Candidate = "https://" + P4[1];
    if (CvlUrlObj(Candidate)) return Candidate;
  }
  const RawSegs = Path.split("/").filter(Boolean);
  if (RawSegs.length >= 3 && /^[a-z0-9][\w.-]*\.[a-z]{2,}$/i.test(RawSegs[0]) && IsRepoPath(RawSegs)) {
    return "https://" + RawSegs.join("/").split("?")[0];
  }
  if (!PlatPat.test(Hst)) {
    const L2Seg = Path.split("/").filter(Boolean);
    if (L2Seg.length >= 2 && IsRepoPath(L2Seg)) {
      const Candidate = Hst + "/" + L2Seg.slice(-2).join("/");
      if (LooksValidRepo(Candidate)) return Candidate;
    }
  }
  return Url;
}

function DeepWash(Url) {
  let Cur = Url.trim(), Prev = "", Depth = 0;
  while (Cur !== Prev && Depth < 5) {
    Prev = Cur;
    Cur = UnwrapLayer(Cur);
    Depth++;
  }
  if (Cur.startsWith("http://")) Cur = "https://" + Cur.slice(7);
  const Obj = CvlUrlObj(Cur);
  if (Obj) {
    let Pth = Obj.pathname.replace(/\/\//g, "/").replace(/\/+$/, "");
    Cur = Obj.origin + Pth + Obj.search;
  }
  return Cur;
}

function ExtractCore(Cleaned) {
  const Obj = CvlUrlObj(Cleaned);
  if (!Obj) return null;
  const Segs = Obj.pathname.split("/").filter(Boolean);
  if (!IsRepoPath(Segs)) {
    const GitSegs = Segs.filter(s => !/^[./]/.test(s));
    if (GitSegs.length >= 2 && IsRepoPath(GitSegs)) {
      return { Owner: GitSegs[GitSegs.length - 2].toLowerCase(), Repo: GitSegs[GitSegs.length - 1].replace(/\.git$/i, "").toLowerCase(), Domain: Obj.hostname.toLowerCase() };
    }
    return null;
  }
  return { Owner: Segs[Segs.length - 2].toLowerCase(), Repo: Segs[Segs.length - 1].replace(/\.git$/i, "").toLowerCase(), Domain: Obj.hostname.toLowerCase() };
}

function IsGitHost(Hst) {
  return PlatPat.test(Hst.toLowerCase());
}

export function ExtRpId(Url) {
  if (!Url || typeof Url !== "string") return null;
  try {
    const C = DeepWash(Url);
    const Core = ExtractCore(C);
    if (Core) return Core.Owner + "/" + Core.Repo;
  } catch {}
  return null;
}

export function ExtRpNm(Url) {
  if (!Url || typeof Url !== "string") return null;
  try {
    const C = DeepWash(Url);
    const Core = ExtractCore(C);
    if (Core) return Core.Repo;
  } catch {}
  return null;
}

export function RpInfRes(Input) {
  try {
    const { Url, Alias } = AssRInp(Input);
    const C = DeepWash(Url);
    const Core = ExtractCore(C);
    const Plat = (C.match(PlatPat)?.[0] || "unknown").toLowerCase();
    const OwnNm = Core ? Core.Owner : (CvlUrlObj(C)?.pathname.split("/").filter(Boolean)[0] || "未知作者");
    const Urp = Core ? Core.Owner + "/" + Core.Repo : null;
    return { url: C, alias: Alias, urp: Urp, isHG: !!Urp, OwnNm, Plat };
  } catch {
    return { url: Input, alias: "Repo_" + Date.now(), isHG: false, OwnNm: "未知作者", Plat: "unknown" };
  }
}

export function MtDfcRp(Url, Dfc) {
  try {
    const TgtId = ExtRpId(Url);
    const TgtRpNm = ExtRpNm(Url);
    if (!TgtId && !TgtRpNm) return null;
    for (const [Alias, RpInfo] of Object.entries(Dfc || {})) {
      if (RpInfo.canonicalId && TgtId && RpInfo.canonicalId.toLowerCase() === TgtId) return { Alias, RpInfo };
      if (RpInfo.url && TgtId && ExtRpId(DeepWash(RpInfo.url)) === TgtId) return { Alias, RpInfo };
      if (Array.isArray(RpInfo.mirrors) && TgtId) {
        for (const Mir of RpInfo.mirrors) {
          if (ExtRpId(DeepWash(Mir)) === TgtId) return { Alias, RpInfo };
        }
      }
    }
    if (TgtRpNm) {
      for (const [Alias, RpInfo] of Object.entries(Dfc || {})) {
        const MainId = RpInfo.url ? ExtRpId(DeepWash(RpInfo.url)) : null;
        if (MainId) {
          const MnRpNm = MainId.split("/")[1];
          if (MnRpNm && MnRpNm.toLowerCase() === TgtRpNm) return { Alias, RpInfo };
        }
      }
    }
  } catch {}
  return null;
}

export function ExtRpCore(Url) {
  if (!Url || typeof Url !== "string") return null;
  try {
    return ExtractCore(DeepWash(Url));
  } catch {
    return null;
  }
}

export function MtExist(NewUrl, Installed) {
  if (!NewUrl || !Array.isArray(Installed) || Installed.length === 0) return null;
  const NwCln = DeepWash(NewUrl);
  const NwCore = ExtractCore(NwCln);
  for (const It of Installed) {
    if (!It?.url) continue;
    const OldCln = DeepWash(It.url);
    if (NwCln === OldCln)
      return { matched: true, level: "exact", alias: It.alias, url: It.url, detail: "URL完全一致" };
    const OldCore = ExtractCore(OldCln);
    if (NwCore && OldCore) {
      const NwId = NwCore.Owner + "/" + NwCore.Repo;
      const OldId = OldCore.Owner + "/" + OldCore.Repo;
      if (NwId === OldId)
        return { matched: true, level: "canonical", alias: It.alias, url: It.url, detail: `同源仓库 ${NwId}（${OldCore.Domain} → ${NwCore.Domain}）` };
      if (NwCore.Repo === OldCore.Repo)
        return { matched: true, level: "repo-name", alias: It.alias, url: It.url, detail: `同名仓库 ${NwCore.Repo}（${OldCore.Owner} → ${NwCore.Owner}）` };
    }
  }
  return null;
}

export { IsRawPrxHost, IsGitHost };