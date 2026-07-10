import path from "node:path";

export function CreFace(ctx = {}) {
    const { MiaoPluginMBT, Nomos, Ananke, toFileUrl } = ctx;

    async function ResolveFace(gameKey, CREName) {
        if (gameKey !== 'gs' && gameKey !== 'sr') return null;
        const baseDir = MiaoPluginMBT.Paths.Target[gameKey === 'gs' ? 'Miao_GSAliasDir' : 'Miao_SRAliasDir'];
        const imgDir = path.join(baseDir, "..", "character", CREName, "imgs");
        const probe = async p => await Ananke.Audit(p, false) ? p : null;
        const validPath = await probe(path.join(imgDir, "face2.webp"))
                       || await probe(path.join(imgDir, "face.webp"));
        return validPath ? toFileUrl(validPath) : null;
    }

    async function FindZZZIcon(charName) {
        const cleanName = String(charName || '').trim();
        if (!cleanName) return null;

        const dataDir = MiaoPluginMBT.Paths?.Target?.ZZZ_DataDir;
        const faceDir = MiaoPluginMBT.Paths?.Target?.ZZZ_FaceDir;
        if (!dataDir || !faceDir) return null;

        try {
            const context = await Nomos.getContext();
            if (!context.zIn) return null;

            const entries = await Ananke.readDir(dataDir);
            for (const entry of entries) {
                if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
                let data = null;
                try {
                    const raw = await Ananke.readFile(path.join(dataDir, entry.name), 'utf-8');
                    data = raw ? JSON.parse(raw) : null;
                } catch {}
                if (!data) continue;

                if (data.Name !== cleanName && data.CodeName !== cleanName) continue;

                const iconMatch = String(data.Icon || '').match(/\d+$/);
                if (!iconMatch) return null;

                const iconPath = path.join(faceDir, `IconRoleCircle${iconMatch[0]}.png`);
                if (await Ananke.Audit(iconPath, false)) {
                    return toFileUrl(iconPath);
                }
                return null;
            }
        } catch {}
        return null;
    }

    function ResolveWavesFace(charName) {
        return MiaoPluginMBT._wavesRoleDataMap?.get(charName)?.icon || null;
    }

    async function ResolveCREFace(gameKey, charName) {
        if (gameKey === 'gs' || gameKey === 'sr') return ResolveFace(gameKey, charName);
        if (gameKey === 'zzz') return FindZZZIcon(charName);
        if (gameKey === 'waves') return ResolveWavesFace(charName);
        return null;
    }

    return { ResolveFace, FindZZZIcon, ResolveWavesFace, ResolveCREFace };
}

export default { CreFace };