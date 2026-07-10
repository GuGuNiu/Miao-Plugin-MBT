import path from "node:path";

export function Export(ctx = {}) {
    const { Ananke, Pheme, MiaoPluginMBT, Tianshu, getHades, DocHub, toPosix, common, segment } = ctx;

    const isChannelError = err => {
        const msg = (err.message || "").toLowerCase();
        return msg.includes("highway") || msg.includes("file size") || err.code === -36 || err.code === 210005;
    };

    async function exportFile(e, checkInit, logger) {
        if (!(await checkInit(e))) return true;
        if (!(await MiaoPluginMBT.ICI())) return Pheme.noRepo(e);

        const match = e.msg.match(/^#咕咕牛导出\s*(.+)/i);
        if (!match?.[1]) return Pheme.quote(e, "要导出哪个图片呀？格式：#咕咕牛导出 角色名+编号 (例如：心海1)");

        const rawInput = match[1].trim();
        const Hades = getHades(logger);

        try {
            const parsedId = Tianshu.ParseID(rawInput);
            if (!parsedId) return Pheme.quote(e, "格式好像不对哦，应该是 角色名+编号，比如：花火1");

            const { mainName, imgNum } = parsedId;
            const primaryName = (await Tianshu.NormalizeName(mainName)).mainName ?? mainName;
            const charImages = Tianshu._indexByCRE.get(primaryName);

            if (!charImages?.length) {
                const hint = Tianshu._indexByGid.size ? "(未找到该角色的图片数据)" : "(图库数据为空)";
                return Pheme.emptyResult(e, 'role', `${primaryName}。\n${hint}`);
            }

            const imageData = charImages.find(img => img.path?.toLowerCase().endsWith(`gu${imgNum}.webp`));
            if (!imageData) return Pheme.quote(e, `找到了角色 '${primaryName}'，但没有找到编号 ${imgNum} 的图片。`);

            const relativePath = toPosix(imageData.path);
            const targetFileName = path.basename(relativePath);
            const absolutePath = await Tianshu.FsQuery(relativePath);
            if (!absolutePath) return Pheme.quote(e, `糟糕，数据库里有记录，但物理文件找不到了：${targetFileName}`);

            const fileBuffer = await Ananke.readFile(absolutePath).catch(err => { throw new Error(`文件读取失败: ${err.message}`); });

            await Pheme.send(e, `📦 导出成功！给你 -> ${targetFileName}`);
            await common.sleep(200);

            try {
                await Pheme.send(e, segment.file(fileBuffer, targetFileName));
            } catch (sendErr) {
                if (!isChannelError(sendErr)) throw sendErr;
                await Pheme.quote(e, `发送失败：文件通道异常 (Code: ${sendErr.code})，可能是文件过大或被风控。`);
            }
        } catch (error) {
            Hades.E(`导出图片失败 [${rawInput}]:`, error);
            await DocHub.report(e, `导出图片 ${rawInput}`, error);
        }

        return true;
    }

    return { exportFile };
}

export default { Export };