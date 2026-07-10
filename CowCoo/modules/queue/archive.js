import path from "node:path";

export function Archive({ Ananke }) {
  const FmtDt = (Iso) => {
    if (!Iso) return "N/A";
    return new Date(Iso).toLocaleString("zh-CN", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  class Arc {
    constructor(filePath) {
      this.filePath = filePath;
      this.data = {};
    }

    async Load() {
      try {
        this.data = await Ananke.HydrateJson(this.filePath, {});
      } catch {
        this.data = {};
      }
      return this.data;
    }

    async Save() {
      return Ananke.FlushJson(this.filePath, this.data).catch(() => false);
    }

    Add(record) {
      this.data[record.alias] = {
        url: record.url,
        alias: record.alias,
        installPath: record.installPath,
        folderName: record.folderName,
        platform: record.platform || "unknown",
        ownerName: record.ownerName || "未知",
        installDate: record.installDate || new Date().toISOString(),
        lastUpdate: record.lastUpdate || new Date().toISOString(),
        depsManager: record.depsManager || null,
        gitArgs: record.gitArgs || [],
        mirrorPrefix: record.mirrorPrefix || null,
        usedAlgorithm: !!record.usedAlgorithm,
        description: record.description || ""
      };
      return this.Save();
    }

    Remove(alias) {
      if (!this.data[alias]) return false;
      delete this.data[alias];
      return this.Save();
    }

    Find(alias) {
      return this.data[alias] || null;
    }

    List() {
      return Object.values(this.data).map((r) => ({
        ...r,
        installDateDisplay: FmtDt(r.installDate),
        lastUpdateDisplay: FmtDt(r.lastUpdate)
      }));
    }

    Update(alias, patch) {
      if (!this.data[alias]) return false;
      this.data[alias] = { ...this.data[alias], ...patch, lastUpdate: new Date().toISOString() };
      return this.Save();
    }
  }

  return { Arc, FmtDt };
}

export default { Archive };
