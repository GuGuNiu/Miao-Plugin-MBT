import path from "node:path";

const Pm_Chain = [
  { cmd: "pnpm", args: ["install", "--no-frozen-lockfile"] },
  { cmd: "cnpm", args: ["install"] },
  { cmd: "npx", args: ["--yes", "npm", "install"] },
  { cmd: "npm", args: ["install"] }
];

export function DepsInstaller({ MBTPipeControl, Ananke, HadesEntry, getCore }) {
  const getHades = (logger) => (HadesEntry ? HadesEntry({}, logger || getCore()) : logger || getCore());

  const Has_PkgJson = async (targetPath) => {
    try {
      return await Ananke.Audit(path.join(targetPath, "package.json"));
    } catch {
      return false;
    }
  };

  const Install = async (targetPath, logger) => {
    const Hades = getHades(logger);

    const hasPkg = await Has_PkgJson(targetPath);
    if (!hasPkg) {
      Hades.D("未发现 package.json，跳过依赖安装");
      return { success: true, manager: null, skipped: true };
    }

    for (const { cmd, args } of Pm_Chain) {
      try {
        Hades.D(`尝试依赖安装 [${cmd}]`);
        const result = await MBTPipeControl(
          cmd,
          args,
          { cwd: targetPath, timeout: 180000 },
          180000
        );
        if (result.exitCode === 0 || result.code === 0) {
          Hades.D(`依赖安装成功 [${cmd}]`);
          return { success: true, manager: cmd, skipped: false };
        }
        Hades.D(`依赖安装失败 [${cmd}] exitCode=${result.exitCode ?? result.code}`);
      } catch (err) {
        const msg = err?.message?.split("\n")[0] || "未知";
        Hades.D(`依赖安装异常 [${cmd}]: ${msg}`);
      }
    }

    return { success: false, manager: null, skipped: false };
  };

  return { Install, Has_PkgJson };
}

export default { DepsInstaller };
