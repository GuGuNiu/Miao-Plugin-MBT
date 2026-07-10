import path from "node:path";

export function MapTile(ctx = {}) {
    const { getHades, Tianshu, Cerberus, MBTSignalTrap, Morpheus, Nomos, MiaoPluginMBT, Ananke } = ctx;

    async function render(gameKey, renderWidth, logger) {
        const Hades = getHades(logger);
        const strategy = Tianshu.GetStrategy(gameKey);
        if (!strategy) return null;
        const cerberus = Cerberus.getInstance();
        const signalTrap = MBTSignalTrap.getInstance();
        const BtnFaceUrl = Morpheus.getStaticImg("icon/null-btn.png");
        const elemGroups = {};
        const unknown_GroupKey = "unknown";
        let imgCount = 0;
        let size = 0;
        const targetSource = Nomos.Universe[gameKey]?.dirName;
        const metaCache = MiaoPluginMBT._MetaCache || [];
        const validImg = targetSource ? metaCache.filter((img) => img.storagebox_type === targetSource) : [];
        if (validImg.length === 0) return null;
        let loopIndex = 0;
        for (const img of validImg) {
            if (signalTrap._isShuttingDown) {
                Hades.W(`系统正在关闭，中止地图渲染任务 [${gameKey}]`);
                return null;
            }

            await cerberus.breath(loopIndex++);

            const charName = img.CREName;
            const { key: elemKey, label: elemName } = await strategy.resolveElem(charName);
            const key = elemKey !== "unknown" && elemKey !== "multi" ? elemKey : unknown_GroupKey;
            const name = key === unknown_GroupKey ? "未知" : elemName;

            if (!elemGroups[key]) {
                elemGroups[key] = { key: key, name: name, count: 0, size: 0, chars: {}, banner: null };
            }

            const group = elemGroups[key];
            if (!group.chars[charName]) {
                group.chars[charName] = { name: charName, count: 0, size: 0, icon: null };
            }

            group.count++;
            group.chars[charName].count++;

            const absPath = await MiaoPluginMBT.FsQuery(img.path);
            if (absPath) {
                try {
                    const stats = await Ananke.stat(absPath);
                    if (stats) {
                        const s = stats.size;
                        group.size += s;
                        group.chars[charName].size += s;
                        size += s;
                    }
                } catch (e) {}
            }
        }
        imgCount = validImg.length;

        const elemView = [];
        let sortedKeys = [];
        const currentKeys = Object.keys(elemGroups).filter((k) => k !== unknown_GroupKey);
        const sortStrategyKeys = strategy.getSortKeys(currentKeys);

        if (Array.isArray(sortStrategyKeys)) {
            sortedKeys = sortStrategyKeys.filter((k) => elemGroups[k]);
            currentKeys.forEach((k) => {
                if (!sortedKeys.includes(k)) sortedKeys.push(k);
            });
        } else {
            sortedKeys = currentKeys;
        }
        if (elemGroups[unknown_GroupKey]) sortedKeys.push(unknown_GroupKey);

        loopIndex = 0;
        for (const key of sortedKeys) {
            await cerberus.breath(loopIndex++);

            const group = elemGroups[key];
            if (!group) continue;
            group.banner = await strategy.resolveBanner(key);
            const charList = Object.values(group.chars).sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));

            const outputCharList = [];
            for (const char of charList) {
                const strategyIcon = await strategy.resolveIcon(char.name);
                let faceUrl = BtnFaceUrl;
                if (strategyIcon) {
                    if (strategyIcon.startsWith("http")) {
                        faceUrl = strategyIcon;
                    } else {
                        const normalized = strategyIcon.replace(/\\/g, "/");
                        faceUrl = normalized.startsWith("file://") ? normalized : `file://${normalized}`;
                    }
                }
                outputCharList.push({
                    name: char.name,
                    faceUrl: faceUrl,
                    imageCount: char.count,
                    sizeFormatted: await Ananke.measure(char.size, true)
                });
            }
            elemView.push({
                name: group.name,
                key: group.key,
                bannerUrl: group.banner,
                characters: outputCharList,
                elemImgCount: group.count,
                displaySize: await Ananke.measure(group.size, true)
            });
        }

        let gsHeaderBgUrl = null;
        if (gameKey === "gs") {
            const p = path.join(MiaoPluginMBT.Paths.Target.Miao_GSAliasDir, "common", "imgs", "banner.webp");
            gsHeaderBgUrl = `file://${p.replace(/\\/g, "/")}`;
        }

        let srBodyBgUrl = null;
        if (gameKey === "sr") {
            const p = path.join(MiaoPluginMBT.Paths.YzPath, "plugins", "miao-plugin", "resources", "common", "bg", "bg-sr.webp");
            srBodyBgUrl = `file://${p.replace(/\\/g, "/")}`;
        }

        const ViewProps = {
            games: [
                {
                    name: strategy.name,
                    key: gameKey,
                    imgCountDisplay: imgCount,
                    assetsSizeFormatted: await Ananke.measure(size, true),
                    haselemGrouping: true,
                    elements: elemView,
                    headerBgUrl: gsHeaderBgUrl,
                    bodyBgUrl: srBodyBgUrl
                }
            ],
            isArray: Array.isArray,
            currentRenderWidth: renderWidth
        };

        try {
            return await Morpheus.shot(`Map-${gameKey}`, {
                tplFile: path.join(MiaoPluginMBT.Paths.OpsPath, "resources", "html", "tools", "galleryrmap.html"),
                data: ViewProps,
                width: renderWidth,
                logger: Hades,
                MorpheusSignal: true
            });
        } catch (err) {
            Hades.E(`地图渲染失败 [${gameKey}]:`, err);
            return null;
        }
    }

    return { render };
}

export default { MapTile };