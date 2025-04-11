import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';
import yaml from 'yaml';
import { spawn } from 'child_process';
import os from 'os';

async function BatchCopyFiles(FileList) {
    for (const FileItem of FileList) {
        const DestDir = path.dirname(FileItem.dest);
            await fsPromises.mkdir(DestDir, { recursive: true });
            await fsPromises.copyFile(FileItem.source, FileItem.dest);
    }
}



export class MiaoPluginMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』图库管理器 v3.7',
            dsc: '『咕咕牛🐂』图库管理器',
            event: 'message',
            priority: 1000,
            rule: GUGUNIU_RULES
        });

        this.task = {
            name: '『咕咕牛🐂』定时更新任务',
            cron: '0 5 */5 * *', 
            fnc: () => this.ExecuteTask(),
            log: false
        };

        const CurrentFileUrl = import.meta.url;
        const CurrentFilePath = fileURLToPath(CurrentFileUrl);
        const BaseDir = path.resolve(path.dirname(CurrentFilePath), '../../'); 

        // --- 代理地址 ---
        this.Proxy = 'https://ghfast.top/';
        this.Proxy2 = 'https://ghp.ci/';
        this.Proxy3 = 'https://ghgo.xyz/';
        this.Proxy4 = 'https://ghproxy.com/';
        this.Proxy5 = 'https://github.moeyy.xyz/';
        this.Proxy6 = 'https://git.yumenaka.net/';
        this.Proxy7 = 'https://raw.gitmirror.com/';
        this.Proxy8 = 'https://ghproxy.net/';

        // --- 仓库路径 ---
        this.RepositoryUrl = 'https://github.com/GuGuNiu/Miao-Plugin-MBT/';
        this.LocalPath = path.join(BaseDir, 'resources/Miao-Plugin-MBT/'); 
        this.GitPath = path.join(this.LocalPath, '.git/'); 

        // --- 目标插件路径 ---
        this.CharacterPath = path.join(BaseDir, 'plugins/miao-plugin/resources/profile/normal-character/'); 
        this.ZZZCharacterPath = path.join(BaseDir, 'plugins/ZZZ-Plugin/resources/images/panel/'); 
        this.WAVESCharacterPath = path.join(BaseDir, 'plugins/waves-plugin/resources/rolePic/'); 

        // --- 图库内部的源路径 ---
        this.SRCopyLocalPath = path.join(this.LocalPath, 'sr-character/'); 
        this.GSCopyLocalPath = path.join(this.LocalPath, 'gs-character/'); 
        this.ZZZCopyLocalPath = path.join(this.LocalPath, 'zzz-character/'); 
        this.WAVESCopyLocalPath = path.join(this.LocalPath, 'waves-character/'); 

        // --- 别名路径 ---
        this.GSAliasPath = path.join(BaseDir, 'plugins/miao-plugin/resources/meta-gs/character/'); 
        this.SRAliasPath = path.join(BaseDir, 'plugins/miao-plugin/resources/meta-sr/character/'); 
        this.ZZZAliasPath = path.join(BaseDir, 'plugins/ZZZ-Plugin/defset/'); 
        this.WAVESAliasPath = path.join(BaseDir, 'plugins/waves-plugin/resources/Alias/'); 

        // --- 公共资源路径 ---
        this.GuPath = path.join(BaseDir, 'resources/GuGuNiu-Gallery/'); 
        this.JsPath = path.join(BaseDir, 'plugins/example/'); 
        this.GalleryConfigPath = path.join(this.GuPath, 'GalleryConfig.yaml'); 

        this.Px18imgSourcePath = path.join(this.LocalPath, 'GuGuNiu-Gallery', 'Px18img.json');
        this.Px18imgDestPath = path.join(this.GuPath, 'Px18img.json');
        this.Px18List = [];

        this.FilesToCopy = [
            { source: path.join(this.LocalPath, 'GuGuNiu-Gallery', 'help.png'), dest: path.join(this.GuPath, 'help.png') },
            { source: path.join(this.LocalPath, '咕咕牛图库下载器.js'), dest: path.join(this.JsPath, '咕咕牛图库下载器.js') },
            { source: this.Px18imgSourcePath, dest: this.Px18imgDestPath }
        ];
    } 

    async InitFuncCounter() {
        // 定义 num 文件的完整路径
        const NumPath = path.join(this.GuPath, 'num');
        // 定义父目录的路径
        const ParentDir = path.dirname(NumPath); // 这就是 this.GuPath

        try {
            // recursive: true 会自动创建所有不存在的父目录
            await fsPromises.mkdir(ParentDir, { recursive: true });
            logger.info(`咕咕牛』初始化计数器: 确保目录 ${ParentDir} 存在。`);

            // 2. 尝试访问 num 文件
            await fsPromises.access(NumPath);
            logger.info(`咕咕牛』初始化计数器: 文件 ${NumPath} 已存在。`);

        } catch (err) {
            if (err.code === 'ENOENT') {
                logger.warn(`[咕咕牛 警告] 初始化计数器: 文件 ${NumPath} 不存在，正在创建...`);
                try {
                    await fsPromises.writeFile(NumPath, '{}', 'utf8');
                } catch (writeErr) {
                    logger.error(`『咕咕牛🐂』 初始化计数器: 创建文件 ${NumPath} 失败:`, writeErr);
                }
            } else {
                logger.error(`『咕咕牛🐂』 初始化计数器: 检查或创建 ${NumPath} 时发生错误:`, err);
            }
        }
    }
    
          
    async LoadPx18List() {
        if (this.Px18List && this.Px18List.length > 0) {
            return;
        }
        try {
            const Content = await fsPromises.readFile(this.Px18imgDestPath, 'utf8');
            const ParsedList = JSON.parse(Content);
            this.Px18List = Array.isArray(ParsedList) ? ParsedList : [];
        } catch (Error) {
            if (Error.code !== 'ENOENT') {
                 logger.error(`『咕咕牛🐂』加载或解析Px18img失败: ${this.Px18imgDestPath}`, Error);
            }
            this.Px18List = [];
        }
    }

    async UpdateGalleryConfig(Field, Value) {
        let GalleryConfig = {};
        try {
            const GalleryConfigContent = await fsPromises.readFile(this.GalleryConfigPath, 'utf8');
            GalleryConfig = yaml.parse(GalleryConfigContent) || {};
        } catch (ReadError) {
            if (ReadError.code !== 'ENOENT') {
                 logger.error(`『咕咕牛🐂』读取 ${this.GalleryConfigPath} 时出错: ${ReadError}`);
            }
        }
        GalleryConfig[Field] = Value;
        const NewGalleryConfigContent = yaml.stringify(GalleryConfig);
        try {
            await fsPromises.writeFile(this.GalleryConfigPath, NewGalleryConfigContent, 'utf8');
        } catch (WriteError) {
             logger.error(`『咕咕牛🐂』写入 ${this.GalleryConfigPath} 时出错: ${WriteError}`);
        }
    }


    async GallaryDownload(e) {
        const startTime = Date.now();
        logger.info(`『咕咕牛』 ${new Date(startTime).toISOString()}] 图库下载: 收到命令 #下载咕咕牛`);
        logger.debug(`『咕咕牛』 图库下载: 检查目标路径是否存在: ${this.LocalPath}`);
        try {
            await fsPromises.access(this.LocalPath);
            logger.warn(`[咕咕牛 警告] 图库下载: 目标目录 ${this.LocalPath} 已存在。正在中止下载。`);
            await e.reply("『咕咕牛🐂』图库目录已存在，请勿重复下载。若需重新下载，请先使用 #重置咕咕牛");
            return;
        } catch (err) {
            if (err.code === 'ENOENT') {
                logger.info(`『咕咕牛』图库下载: 目标目录 ${this.LocalPath} 未找到。继续下载。`);
            } else {
                logger.error(`『咕咕牛🐂』 图库下载: 检查目标目录 ${this.LocalPath} 时出错:`, err);
                await e.reply(`检查目标目录时发生错误: ${err.message}。请检查路径和权限。`);
                return;
            }
        }
    
        const RawPath = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main';
        let Speeds = [];
        logger.info('『『咕咕牛』图库下载: 开始代理测速...');
        logMemoryUsage("代理测速前");
    
        try {
            Speeds = await this.TestProxies(RawPath);
            logger.info(`『咕咕牛』图库下载: 代理测速完成。测试了 ${Speeds.length} 个代理。`);
        } catch (testErr) {
            logger.error(`『咕咕牛』图库下载: 代理测速过程中失败:`, testErr);
            await e.reply("『咕咕牛🐂』代理测速过程中出错，请检查网络或稍后再试。");
            return;
        }
        logMemoryUsage("代理测速后");
    
        let Msg = '『咕咕牛🐂』节点测速延迟：\n\n';
        Speeds.forEach(S => {
            let SpeedMsg = S.speed === Infinity ? "超时 ❌" : `${S.speed}ms ✅`;
            Msg += `${S.name}：${SpeedMsg}\n`;
        });
        logger.info(`『咕咕牛』图库下载: 代理测速结果:\n${Speeds.map(s => `  - ${s.name}: ${s.speed === Infinity ? '超时' : s.speed + 'ms'}`).join('\n')}`);
    
        const Available = Speeds.filter(S => S.speed !== Infinity);
        if (Available.length === 0) {
            logger.error('『咕咕牛』图库下载: 所有代理测速失败。无法下载。');
            await e.reply(Msg + "\n⚠️ 所有下载节点测速失败，无法下载。请检查网络连接、代理可用性或稍后再试。");
            return;
        }
    
        Available.sort((a, b) => a.speed - b.speed);
        const Best = Available[0];
        const BestCloneUrl = Best.url.replace(RawPath, "") + this.RepositoryUrl;
        logger.info(`『咕咕牛』图库下载: 已选择最佳代理: ${Best.name} (${Best.speed}ms)。`);
        logger.info(`『咕咕牛』图库下载: 最终 Git Clone URL 为: ${BestCloneUrl}`);
    
        Msg += `\n✅ 最佳节点：${Best.name}，开始使用此节点下载...\n(下载需要时间，详细进度和可能出现的错误请关注控制台日志)`;
        await e.reply(Msg);
    
        let stdoutAggregated = '';
        let stderrAggregated = '';
        let ProgressReported10 = false;
        let ProgressReported50 = false;
        let ProgressReported90 = false;
    
        const cloneArgs = ['clone', '--depth=1', '--progress', BestCloneUrl, this.LocalPath];
        logger.info(`『咕咕牛』图库下载: 准备执行 git 命令: git ${cloneArgs.join(' ')}`);
        logMemoryUsage("Git Clone Spawn 前");
    
        try {
            const parentDir = path.dirname(this.LocalPath);
            await fsPromises.mkdir(parentDir, { recursive: true });
            logger.debug(`『咕咕牛』 图库下载: 确保父目录存在: ${parentDir}`);
    
            const Git = spawn('git', cloneArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false
            });
    
            logger.info(`『咕咕牛』图库下载: Git 进程已生成，PID: ${Git.pid}。正在等待完成...`);
    
            Git.stdout.on('data', (data) => {
                const output = data.toString();
                stdoutAggregated += output;
                logger.debug(`『咕咕牛』 ${output.trim()}`);
            });
    
            Git.stderr.on('data', async (data) => {
                const str = data.toString();
                stderrAggregated += str;
                logger.warn(`『咕咕牛』 ${str.trim()}`);
    
                const M = str.match(/Receiving objects:\s*(\d+)%/);
                if (M && M[1]) {
                    const Progress = parseInt(M[1], 10);
                    if (Progress >= 10 && !ProgressReported10) {
                        ProgressReported10 = true;
                        await e.reply('『咕咕牛』下载进度：10%');
                    }
                    if (Progress >= 50 && !ProgressReported50) {
                        ProgressReported50 = true;
                        await e.reply('『咕咕牛』下载进度：50%');
                    }
                    if (Progress >= 90 && !ProgressReported90) {
                        ProgressReported90 = true;
                        await e.reply('『咕咕牛』下载进度：90%，即将完成...');
                    }
                }
            });
    
            Git.on('error', async (spawnError) => {
                logMemoryUsage("Git Clone Spawn 错误");
                logger.error(`『咕咕牛🐂』 图库下载: 生成 git 克隆进程本身失败！错误详细信息:`, spawnError);
                logger.error(`『咕咕牛🐂』 图库下载: 在生成错误之前捕获的 Stderr:\n${stderrAggregated}`);
                const feedbackMsg = this.GenerateDownloadErrorFeedback(spawnError, stderrAggregated);
                const ErrorForward = await common.makeForwardMsg(e, feedbackMsg, '『咕咕牛🐂』下载启动失败日志');
                await e.reply('启动下载进程时发生严重错误（例如找不到git），请查看控制台日志！');
                setTimeout(async () => { await e.reply(ErrorForward); }, 1000);
            });
    
            Git.on('close', async (code) => {
                const endTime = Date.now();
                const duration = ((endTime - startTime) / 1000).toFixed(1);
                logMemoryUsage("Git 克隆进程关闭后");
                logger.info(`『咕咕牛』 ${new Date(endTime).toISOString()}] 图库下载: Git 克隆进程完成。退出码: ${code}。耗时: ${duration} 秒。`);
                logger.info(`『咕咕牛』图库下载: Git 克隆完整标准输出:\n------ 标准输出开始 ------\n${stdoutAggregated}\n------ 标准输出结束 ------`);
                logger.warn(`『咕咕牛』图库下载: Git 克隆完整标准错误:\n------ 标准错误开始 ------\n${stderrAggregated}\n------ 标准错误结束 ------`);
    
                if (code === 0) {
                    logger.info('『咕咕牛』图库下载: Git 克隆成功完成。');
                    await e.reply(`『咕咕牛』下载成功！ (耗时 ${duration} 秒)`);
                    await e.reply('开始进行安装和文件处理，请稍候...');
                    try {
                        await this.PostDownload(e);
                        logger.info('『咕咕牛』图库下载: 下载后处理已成功完成。');
                    } catch (postErr) {
                        logger.error('『咕咕牛』图库下载: 下载后处理过程中出错:', postErr);
                        await e.reply("下载成功，但在后续文件处理步骤中出错，请查看控制台日志进行手动检查或配置。");
                    }
                } else {
                    logger.error(`『咕咕牛』图库下载: Git 克隆失败，非零退出码: ${code}。`);
                    const downloadError = new Error(`Git clone exited with code ${code}`);
                    const feedbackMsg = this.GenerateDownloadErrorFeedback(downloadError, stderrAggregated);
                    const ErrorForward = await common.makeForwardMsg(e, feedbackMsg, `『咕咕牛🐂』下载失败日志 (Code: ${code})`);
                    await e.reply(`下载『咕咕牛』失败，错误码: ${code}。(耗时 ${duration} 秒) 请查看控制台输出的详细日志以定位问题！`);
                    setTimeout(async () => { await e.reply(ErrorForward); }, 1000);
                }
            });
    
        } catch (error) {
            const errorTime = Date.now();
            logger.error(`『咕咕牛🐂』 ${new Date(errorTime).toISOString()}] 图库下载: 在生成 Git 进程之前发生意外错误:`, error);
            await e.reply("准备下载环境时发生意外错误（例如无法创建目录），请查看控制台日志。");
            logMemoryUsage("Git Clone Spawn 前出错");
        }
    }
    



    async TestProxies(RawPath) {
        const Sources = {
            "Github": RawPath,
            "Ghfast": this.Proxy + RawPath,
            "Ghp": this.Proxy2 + RawPath,
            "Ghgo": this.Proxy3 + RawPath,
            "Ghproxy": this.Proxy4 + RawPath,
            "Ghproxy2": this.Proxy8 + RawPath,
            "Gitmirror": this.Proxy7 + RawPath,
            "Moeyy": this.Proxy5 + RawPath,
            "Yumenaka": this.Proxy6 + RawPath
        };

        const TestSourceSpeed = async (Url) => {
            const TestFile = "/README.md";
            const Start = Date.now();

            try {
                const Controller = new AbortController();
                const Timeout = setTimeout(() => Controller.abort(), 3000);
                const Res = await fetch(Url + TestFile, { signal: Controller.signal });
                clearTimeout(Timeout);
                return Res.ok ? Date.now() - Start : Infinity;
            } catch (e) {
                return Infinity;
            }
        };

        const Speeds = await Promise.all(
            Object.entries(Sources).map(async ([Name, Url]) => ({
                name: Name,
                url: Url,
                speed: await TestSourceSpeed(Url)
            }))
        );

        return Speeds;
    }

    async CloneFullRepo(Url, e) {
        try {
            await fsPromises.rm(this.LocalPath, { recursive: true, force: true });
        } catch (RmError){
            if (RmError.code !== 'ENOENT') {
                 logger.error(`『咕咕牛🐂』清理旧目录失败 ${this.LocalPath}:`, RmError);
            }
        }

        return new Promise((resolve, reject) => {
            const Process = exec(`git clone --depth=1 ${Url} ${this.LocalPath}`);
            Process.on('close', Code => Code === 0 ? resolve() : reject(new Error(`git clone failed: ${Code}`)));
            Process.on('error', Err => reject(Err));
        });
    }

    async PostDownload(e) {
        await this.CopyCharacterFolders();
        await e.reply('『咕咕牛』正在咕咕噜的载入喵喵中...');
        await fsPromises.mkdir(this.GuPath, { recursive: true });
        await this.CopyFolderRecursive(path.join(this.LocalPath, 'GuGuNiu-Gallery'), this.GuPath);
        await this.DeleteBanList();
        setTimeout(async () => {
            await e.reply('『咕咕牛』成功进入喵喵里面！\n会自动更新Js和图库~~~。');
        }, 20000);

        await BatchCopyFiles(this.FilesToCopy);
    }

    async GallaryUpdate(e) {
        let LocalPathExists = false;
        try { await fsPromises.access(this.LocalPath); LocalPathExists = true; } catch {}
        if (!LocalPathExists) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return;
        }

        try {
            await e.reply('『咕咕牛🐂』开始更新了', true);

            const GitPullOutput = await this.ExecGitCommand('git pull');

            if (/Already up[ -]to[ -]date/.test(GitPullOutput)) {
                await e.reply("『咕咕牛』已经是最新的啦");
                const GitLog = await this.ExecGitCommand('git log -n 1 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"');
                await e.reply(`最近一次更新：${GitLog}`);
            } else {
                const GitLog = await this.ExecGitCommand('git log -n 20 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"');
                const ForwardMsg = [`最近的更新记录：\n${GitLog}`];
                const ForwardMsgFormatted = await common.makeForwardMsg(this.e, ForwardMsg, '『咕咕牛🐂』更新成功');
                await this.reply(ForwardMsgFormatted);

                await this.DeleteFilesWithGuKeyword();
                await this.ExecGitCommand('git clean -df');

                const GalleryConfig = await this.GetGalleryConfig();

                if (GalleryConfig && GalleryConfig['GGOP'] === 1) {
                    await this.CopyCharacterFolders();
                }

                await BatchCopyFiles(this.FilesToCopy);

                if (GalleryConfig && GalleryConfig['Px18img-type'] === 0) {
                    const BanList = await this.UpdateBanList();
                    await fsPromises.writeFile(path.join(this.GuPath, 'banlist.txt'), `${BanList.join(';')};`, 'utf8');
                }
            }
        } catch (Error) {
            console.error('更新『咕咕牛🐂』时出现错误:', Error);
            const UpdateErrorForward = await common.makeForwardMsg(e, this.GenerateDownloadErrorFeedback(Error), '『咕咕牛🐂』更新失败日志');
            await this.reply('更新『咕咕牛』时出现错误，请查看日志！');
            setTimeout(async () => { await this.reply(UpdateErrorForward); }, 2000);
        }
    }

    async ExecGitCommand(Command) {
        return new Promise((resolve, reject) => {
            exec(Command, { cwd: this.LocalPath }, (Error, Stdout) => Error ? reject(Error) : resolve(Stdout));
        });
    }

    async GetGalleryConfig() {
        try {
            const GalleryConfigContent = await fsPromises.readFile(this.GalleryConfigPath, 'utf8');
            return yaml.parse(GalleryConfigContent);
        } catch (ReadError) {
            if (ReadError.code !== 'ENOENT') {
                logger.error(`『咕咕牛🐂』读取 GalleryConfig ${this.GalleryConfigPath} 失败:`, ReadError);
            }
            return null;
        }
    }

    async UpdateBanList() {
        await this.LoadPx18List();

        const BanListPath = path.join(this.GuPath, 'banlist.txt');
        let BanList = [];

        try {
            const Content = await fsPromises.readFile(BanListPath, 'utf8');
            BanList = Content.split(';').filter(item => item.trim() !== '');
        } catch (Error) {
            if (Error.code !== 'ENOENT') {
                logger.error(`『咕咕牛🐂』读取 banlist ${BanListPath} 失败:`, Error);
            }
        }

        const BanSet = new Set(BanList);
        this.Px18List.forEach(Image => BanSet.add(`${Image}.webp`));

        return Array.from(BanSet);
    }

    async GuHelp(e) {
        let GuPathExists = false;
        try { await fsPromises.access(this.GuPath); GuPathExists = true; } catch {}

        if (!GuPathExists) {
            e.reply(segment.image("https://s2.loli.net/2024/06/28/LQnN3oPCl1vgXIS.png"));
        } else {
            e.reply(segment.image(path.join(this.GuPath, 'help.png')));
        }

        return true;
    }

    async BanRole(e) {
        const BanListPath = path.join(this.GuPath, 'banlist.txt');
        const Message = e.raw_message || e.message || e.content;

        if (/^#清空咕咕牛封禁$/.test(Message)) {
            try {
                await fsPromises.writeFile(BanListPath, '', 'utf8');
                await e.reply("牛的封禁文件清空成功", true);
            } catch (err) {
                logger.error(`『咕咕牛🐂』清空封禁文件失败: ${BanListPath}`, err);
                await e.reply("清空封禁文件时出错，请查看日志", true);
            }
            return true;
        }

        if (/^#ban[加删]/.test(Message)) {
            await e.reply("📝建议使用新指令：#咕咕牛封禁花火1 或 #咕咕牛解禁花火1，无需含有Gu", true);
            return true;
        }

        if (/^#(ban|咕咕牛封禁)列表$/.test(Message)) {
            let Content = '';
            try {
                Content = await fsPromises.readFile(BanListPath, 'utf8');
            } catch (Error) {
                if (Error.code === 'ENOENT') {
                    try { await fsPromises.writeFile(BanListPath, '', 'utf8'); } catch {}
                    await e.reply('封禁文件不存在，已重新生成', true);
                    return true;
                } else {
                    logger.error(`『咕咕牛🐂』读取 banlist 失败: ${BanListPath}`, Error);
                    await e.reply('读取封禁文件时出现错误，请查看控制台日志', true);
                    return true;
                }
            }

            Content = Content.trim();
            if (!Content) {
                await e.reply('封禁列表是空的', true);
                return true;
            }

            const BanList = [...new Set(Content.split(';').map(item => item.trim()).filter(Boolean))];
            const FormattedList = BanList.map(item => item.replace(/\.webp$/, ''));
            const DisplayCount = BanList.length - 1;

            const Msg = [
                `当前已Ban的数量：${DisplayCount} 张\n『#咕咕牛解禁花火1』可以移除封禁`,
                FormattedList.join('\n')
            ];

            try {
                const ForwardMsg = await common.makeForwardMsg(e, Msg, '封禁中的面板图列表');
                await e.reply(ForwardMsg);
            } catch (FwdErr) {
                 logger.error(`『咕咕牛🐂』创建或发送封禁列表转发消息失败:`, FwdErr);
                 await e.reply("发送封禁列表失败，请查看日志");
            }
            return true;
        }

        const IsBanAdd = /^#(ban加|咕咕牛封禁)/.test(Message);
        const IsBanDel = /^#(ban删|咕咕牛解禁)/.test(Message);

        if (!IsBanAdd && !IsBanDel) {
            return false;
        }

        const Match = Message.match(/^#(?:ban加|ban删|咕咕牛(?:封(?!禁列表)|解)禁)(.+)/);
        if (!Match || !Match[1]) {
            await e.reply(IsBanAdd ? '请输入要封禁的角色，可以是角色别名\n例如：#咕咕牛封禁花火1' : '请输入要解禁的角色，可以是角色别名\n例如：#咕咕牛解禁花火1', true);
            return true;
        }

        const RawInput = Match[1].trim();
        if (/Gu\d+$/i.test(RawInput)) {
            await e.reply("📝建议使用新指令：#咕咕牛封禁花火1 或 #咕咕牛解禁花火1，无需含有Gu", true);
            return true;
        }

        let Name = RawInput.replace(/\s+/g, '').replace(/gu/i, 'Gu');


        if (!/Gu\d+$/i.test(Name)) {
            const AutoMatch = Name.match(/(.*?)(\d+)$/);
            if (AutoMatch) {
                Name = AutoMatch[1] + 'Gu' + AutoMatch[2];
            } else {
                await e.reply('请输入编号，如：#咕咕牛封禁花火1', true);
                return true;
            }
        }

        const RoleName = Name.replace(/Gu\d+$/, '');
        const Suffix = Name.match(/Gu\d+$/)?.[0] || '';
        const { mainName: MainName, exists: Exists } = await this.ResolveAlias(RoleName); 

        if (!Exists) {
            await e.reply(`角色「${RoleName}」不存在，请检查名称是否正确,支持角色别名`, true);
            return true;
        }

        const FileName = `${MainName}${Suffix}.webp`;
        let BanList = [];

        try {
            const CurrentContent = await fsPromises.readFile(BanListPath, 'utf8');
            BanList = CurrentContent.split(';').filter(Boolean);
        } catch (Error) {
            if (Error.code !== 'ENOENT') {
                logger.error(`『咕咕牛🐂』读取 banlist 时出错: ${BanListPath}`, Error);
            }
        }
        const BanSet = new Set(BanList);

        if (IsBanAdd) {
            if (!BanSet.has(FileName)) {
                BanSet.add(FileName);
                try {
                    await fsPromises.writeFile(BanListPath, `${Array.from(BanSet).join(';')};`, 'utf8');
                    await e.reply(`${FileName} 🚫已封禁`, true);
                    await this.DeleteBanList();
                } catch (Err) {
                    logger.error('『咕咕牛🐂』写入 banlist 失败:', Err);
                    await e.reply('『咕咕牛🐂』封禁失败，写入错误');
                }
            } else {
                await e.reply(`${FileName} ❌️已存在`, true);
            }
        }

        if (IsBanDel) {
            await this.LoadPx18List();
            if (this.Px18List.includes(Name)) {
                await e.reply(`${Name} ❌️已拒绝删除`, true);
                return true;
            }

            if (BanSet.has(FileName)) {
                BanSet.delete(FileName);
                try {
                    await fsPromises.writeFile(BanListPath, `${Array.from(BanSet).join(';')};`, 'utf8');
                    await e.reply(`${FileName} ✅️已解禁`, true);
                    await e.reply("批量解除封禁可输入#清空咕咕牛封禁，仅重置封禁文件不影响净化模式");
                    await this.CopyCharacterFolders();
                } catch (Err) {
                    logger.error('『咕咕牛🐂』写入 banlist 失败:', Err);
                    await e.reply('『咕咕牛🐂』解禁失败，写入错误');
                }
            } else {
                await e.reply(`${FileName} ❌️不存在`, true);
            }
        }

        return true;
    }

    async FindRoleSplash(e) {
        let LocalPathExists = false;
        try { await fsPromises.access(this.LocalPath); LocalPathExists = true; } catch {}
        if (!LocalPathExists) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }

        const Match = e.msg.match(/^#查看(.+)$/);
        if (!Match) {
            await e.reply('请输入正确的命令格式\n例如：#查看花火', true);
            return true;
        }

        let RoleNameInput = Match[1].trim();
        let RoleName = await this.GetMainRoleName(RoleNameInput); 

        const AllCharacterDirs = [
             this.GSCopyLocalPath, 
             this.SRCopyLocalPath, 
             this.ZZZCopyLocalPath, 
             this.WAVESCopyLocalPath 
        ];

        let MatchedFolder = null;

        for (const Dir of AllCharacterDirs) {
            try {
                const Subfolders = await fsPromises.readdir(Dir, {withFileTypes: true});
                for (const Sub of Subfolders) {
                    if (Sub.isDirectory() && Sub.name.includes(RoleName)) {
                         MatchedFolder = path.join(Dir, Sub.name);
                         break;
                    }
                }
            } catch (ReadError) {
                if (ReadError.code !== 'ENOENT') {
                    logger.warn(`『咕咕牛🐂』FindRoleSplash 查找目录失败: ${Dir}`, ReadError);
                }
            }
            if (MatchedFolder) break;
        }

        if (!MatchedFolder) {
            await e.reply(`未找到角色『${RoleNameInput}』`);
            return true;
        }

        let Files = [];
        try {
            Files = await fsPromises.readdir(MatchedFolder);
            Files = Files.filter(File => File.endsWith('.webp'))
                       .sort((a, b) => (parseInt(a.match(/\d+/)?.[0] || 0)) - (parseInt(b.match(/\d+/)?.[0] || 0)));
        } catch (ReadError) {
            logger.error(`『咕咕牛🐂』读取角色图片列表失败: ${MatchedFolder}`, ReadError);
            await e.reply(`读取角色『${path.basename(MatchedFolder)}』图片列表时出错`);
            return true;
        }
        if (Files.length === 0) {
            await e.reply(`『${path.basename(MatchedFolder)}』文件夹下没有图片`, true);
            return true;
        }

        const BanListPath = path.join(this.GuPath, 'banlist.txt');
        let BanListContent = '';
        try { BanListContent = await fsPromises.readFile(BanListPath, 'utf8'); }
        catch (Error) { if (Error.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』读取 banlist 失败 (FindRoleSplash): ${BanListPath}`, Error); }
        const BannedFiles = BanListContent.split(';').map(f => f.trim()).filter(Boolean);

        const Title = `当前查看『${path.basename(MatchedFolder)}』，有${Files.length}张`;
        const ForwardMsgList = [[Title]];
        ForwardMsgList.push(`支持以图片文件导出-以下是命令:\n#咕咕牛导出${path.basename(MatchedFolder)}1`);

        await this.LoadPx18List();

        for (let i = 0; i < Files.length; i++) {
            const FileName = Files[i];
            const FilePath = path.join(MatchedFolder, FileName);
            const BaseName = FileName.replace(/\.webp$/, '');
            const IsBanned = BannedFiles.includes(FileName);
            const IsPx18 = this.Px18List.includes(BaseName);
            let Label = `${BaseName}`;

            if (IsBanned && IsPx18) {
                Label += ' ❌封禁🟢净化';
            } else if (IsBanned) {
                Label += ' ❌封禁';
            }

            ForwardMsgList.push([
                `${i + 1}、${Label}`,
                segment.image(`file://${FilePath}`)
            ]);
        }

        try {
            const ForwardMsg = await common.makeForwardMsg(this.e, ForwardMsgList);
            await e.reply(ForwardMsg || '发送失败,请私聊查看！', true);
        } catch (Err) {
            console.error(Err);
            await e.reply(`发送 ${path.basename(MatchedFolder)} 的列表时出现错误,请查看控制台日志`);
        }
        return true;
    }

    async RemoveBadimages(e) {
        const GalleryConfig = await this.GetGalleryConfig();
        const BanListPath = path.join(this.GuPath, 'banlist.txt');

        if (e.msg === '#净化咕咕牛') {
            await e.reply("『咕咕牛』\n封禁高危面板图，净化操作无法撤销，需要手动修改配置文件。下次更新会保留净化记录，建议使用 #ban 命令做更灵活的封禁。", true);
            await e.reply("你可以先输入 #检查净化图片 来预览被净化内容。");
            setTimeout(async () => { await e.reply("如要继续净化，请输入 #确认净化咕咕牛"); }, 5000);
            return true;
        }

        if (e.msg === '#确认净化咕咕牛') {
            if (GalleryConfig?.['Px18img-type'] === 0) {
                await e.reply("你已经完成过净化操作了，牟~", true);
                return true;
            }

            await e.reply("『咕咕牛』开始执行净化中...", true);

            await this.LoadPx18List();
            if (this.Px18List.length === 0) {
                await e.reply("无法加载净化列表 Px18img，操作中止。");
                return true;
            }

            let ExistingBanList = [];
            try {
                const Content = await fsPromises.readFile(BanListPath, 'utf8');
                ExistingBanList = Content.split(';').map(item => item.trim()).filter(Boolean);
            } catch (Error) {
                if (Error.code !== 'ENOENT') {
                    logger.error(`『咕咕牛🐂』读取 banlist 时出错: ${BanListPath}`, Error);
                    await e.reply("处理封禁文件时出错，请查看日志", true);
                    return true;
                }
            }

            const UpdatedBanList = new Set(ExistingBanList);
            this.Px18List.forEach(Img => UpdatedBanList.add(`${Img}.webp`));

            try {
                await fsPromises.writeFile(BanListPath, Array.from(UpdatedBanList).join(';') + ';', 'utf8');
            } catch (Err) {
                logger.error('『咕咕牛🐂』写入 banlist (净化) 失败:', Err);
                await e.reply('更新封禁失败');
                return true;
            }

            await this.DeleteBanList();
            await this.UpdateGalleryConfig('Px18img-type', 0);

            setTimeout(async () => { await e.reply("净化完毕，绿色网络，从你我做起！🌱"); }, 10000);
            return true;
        }
        return false;
    }

    async CheckR18Photo(e) {
        let LocalPathExists = false;
        try { await fsPromises.access(this.LocalPath); LocalPathExists = true; } catch {}
        if (!LocalPathExists) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }

        await e.reply("开始检查中，图片数量较多请稍候...", true);

        await this.LoadPx18List();
        if (this.Px18List.length === 0) {
            await e.reply("无法加载净化列表 (Px18img.json)，无法检查。");
            return true;
        }

        const FolderPaths = [ this.GSCopyLocalPath, this.SRCopyLocalPath, this.ZZZCopyLocalPath, this.WAVESCopyLocalPath ];
        const FolderCache = {};
        const Px18PhotoList = [];
        const CheckPx18Msg = `当前查看净化图片，共 ${this.Px18List.length} 张：`;

        const GetSubFolders = async (FolderPath) => {
            if (FolderCache[FolderPath]) return FolderCache[FolderPath];
            let SubFolders = [];
            try {
                const Entries = await fsPromises.readdir(FolderPath, { withFileTypes: true });
                SubFolders = Entries.filter(d => d.isDirectory()).map(d => d.name);
            } catch (Error) {
                if (Error.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』读取子目录失败: ${FolderPath}`, Error);
            }
            FolderCache[FolderPath] = SubFolders;
            return SubFolders;
        };

        const FindImageInFolders = async (ImageName) => {
            const ImageFile = `${ImageName}.webp`;
            for (const BasePath of FolderPaths) {
                const SubFolders = await GetSubFolders(BasePath);
                for (const Folder of SubFolders) {
                    const FullPath = path.join(BasePath, Folder, ImageFile);
                    try { await fsPromises.access(FullPath); return FullPath; } catch { continue; }
                }
            }
            return null;
        };

        for (let i = 0; i < this.Px18List.length; i++) {
            const Name = this.Px18List[i];
            const FoundPath = await FindImageInFolders(Name);
            if (FoundPath) {
                Px18PhotoList.push([ `${i + 1}、${Name}`, segment.image(`file://${FoundPath}`) ]);
            }
        }

        if (Px18PhotoList.length === 0) {
            await e.reply('没有在图库中找到净化列表中的图片！');
            return true;
        }

        try {
            const Px18Msg = await common.makeForwardMsg(this.e, Px18PhotoList, CheckPx18Msg);
            await e.reply(Px18Msg || '发送失败，请私聊查看！', true);
        } catch (Err) {
            console.error(Err);
            await e.reply('发送净化列表时出现错误，请查看控制台日志');
        }
        return true;
    }

    async GuGuNiu(e) {
        await e.reply("🐂");
    
        let Stats;
            Stats = await fsPromises.stat(this.LocalPath);

        const CreationTime = Stats.birthtime.toISOString();
        await e.reply(`图库安装时间: ${CreationTime}`);
    
            const GitLog = await this.ExecGitCommand('git log -n 50 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"');
            const UplogForwardMsg = [`最近的更新记录：\n${GitLog}`];
            const ForwardMsgFormatted = await common.makeForwardMsg(this.e, UplogForwardMsg, '『咕咕牛🐂』日志');
            await e.reply(ForwardMsgFormatted);
 
            const NumPath = path.join(this.GuPath, 'num');
            const NumContent = await fsPromises.readFile(NumPath, 'utf8');
            const NumStats = JSON.parse(NumContent);
    
            if (Object.keys(NumStats).length === 0) {
                await e.reply("暂无功能调用记录。");
                return;
            }
    
            const SortedEntries = Object.entries(NumStats).sort((a, b) => b[1] - a[1]);
            const TotalCount = SortedEntries.reduce((sum, [, count]) => sum + count, 0);
    
            const StatsList = SortedEntries
                .map(([func, count]) => `${func}：${count} 次`)
                .join('\n');
    
            await e.reply(`功能使用统计『总计 ${TotalCount} 次』：\n${StatsList}`);
    
            const Platform = `${os.platform()} ${os.arch()}`;
            const NodeVersion = process.version;
          
            const MemoryUsage = process.memoryUsage();
            const UsedMB = (MemoryUsage.rss / 1024 / 1024).toFixed(1);
          
            const SystemInfo = [
                '🖥 系统信息：',
                `系统平台：${Platform}`,
                `Node.js版本：${NodeVersion}`,
                `内存占用：${UsedMB} MB`
            ].join('\n');
          
            await e.reply(SystemInfo);
          }
    

    async GalleryOption(e) {
        const { msg } = e;
        const Delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        switch (msg) {
            case '#启用咕咕牛': {
                let exists = false;
                try { await fsPromises.access(this.LocalPath); exists = true; } catch {}
                if (!exists) { await e.reply('『咕咕牛🐂』未下载！', true); return true; }
                await e.reply('『咕咕牛🐂』启用中，请稍后...', true);
                await this.CopyCharacterFolders();
                await this.UpdateGalleryConfig('GGOP', 1);
                await Delay(2000);
                await e.reply('『咕咕牛』重新进入喵喵里面！');
                break;
            }
            case '#禁用咕咕牛': {
                await e.reply('『咕咕牛🐂』禁用中，请稍后...', true);
                await this.DeleteFilesWithGuKeyword();
                await this.UpdateGalleryConfig('GGOP', 0);
                await e.reply('『咕咕牛』已离开喵喵');
                break;
            }
            case '#启用官方立绘': {
                await this.CopySplashWebp(this.SRAliasPath, this.CharacterPath);
                await this.CopySplashWebp(this.GSAliasPath, this.CharacterPath);
                await e.reply('官方立绘已经启用了', true);
                break;
            }
            case '#禁用官方立绘': {
                await this.DeleteGuSplashWebp(this.CharacterPath);
                await e.reply('官方立绘已经禁用了', true);
                break;
            }
            default:
                await e.reply('未知的命令，请检查输入', true);
                break;
        }
        return true;
    }

    async ExecuteTask() {
        logger.info("『咕咕牛🐂』定时更新任务：开始执行");

        try {
            const GitPullOutput = await this.ExecGitCommand('git pull');
            if (/Already up[ -]?to[ -]?date/.test(GitPullOutput)) {
                logger.info("『咕咕牛🐂』定时更新任务：暂无更新内容");
                return;
            }

            await this.CopyCharacterFolders();
            await BatchCopyFiles(this.FilesToCopy);

            logger.info("『咕咕牛🐂』定时更新任务：执行完毕");
        } catch (Err) {
            logger.error("『咕咕牛🐂』定时更新任务：执行出错", Err);
        }
    }

    async CheckFolder(e) {
        let LocalPathExists = false;
        try { await fsPromises.access(this.LocalPath); LocalPathExists = true; } catch {}
        if (!LocalPathExists) { await e.reply('『咕咕牛🐂』未下载！', true); return true; }

        const GitPath = this.GitPath;
        const CharacterFolderPaths = [
            { name: '原神', path: this.GSCopyLocalPath },
            { name: '星铁', path: this.SRCopyLocalPath },
            { name: '绝区零', path: this.ZZZCopyLocalPath },
            { name: '鸣潮', path: this.WAVESCopyLocalPath }
        ];

        const CheckRoleForward = [];
        let TotalRoles = 0;
        let TotalImages = 0;
        let SizeMap = { 原神: 0, 星铁: 0, 绝区零: 0, 鸣潮: 0 };
        let ImageCountMap = { 原神: 0, 星铁: 0, 绝区零: 0, 鸣潮: 0 };

        const FormatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024, dm = 2;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };

        for (const { name, path: FolderPath } of CharacterFolderPaths) {
            let SubFolders = [];
            try {
                const Dirents = await fsPromises.readdir(FolderPath, { withFileTypes: true });
                SubFolders = Dirents.filter(d => d.isDirectory())
                                    .map(d => d.name)
                                    .sort((a, b) => a.localeCompare(b, 'zh', { sensitivity: 'base' }));
            } catch (Error) {
                if (Error.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』检查文件夹无法读取: ${FolderPath}`, Error);
                continue;
            }

            TotalRoles += SubFolders.length;
            let FolderMsg = `------${name}------\n`;
            let CurrentFolderImageCount = 0;

            for (const Sub of SubFolders) {
                let ImgCount = 0;
                try {
                    const Files = await fsPromises.readdir(path.join(FolderPath, Sub));
                    ImgCount = Files.filter(f => f.endsWith('.webp')).length;
                } catch (SubError) {
                    if (SubError.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』检查文件夹无法读取子目录: ${path.join(FolderPath, Sub)}`, SubError);
                }
                CurrentFolderImageCount += ImgCount;
                FolderMsg += `${Sub}：${ImgCount}张\n`;
            }

            ImageCountMap[name] = CurrentFolderImageCount;
            TotalImages += CurrentFolderImageCount;
            CheckRoleForward.push(FolderMsg);

            try {
                 SizeMap[name] = await this.GetFolderSize(FolderPath);
            } catch (GetSizeError) {
                 logger.error(`获取 ${FolderPath} 大小失败`, GetSizeError);
                 SizeMap[name] = 0;
            }
        }

        let GitSize = 0;
        try { GitSize = await this.GetFolderSize(GitPath); }
        catch (GitError) { if (GitError.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』获取 .git 目录大小时出错`, GitError); }

        const TotalSize = Object.values(SizeMap).reduce((a, b) => a + b, 0);

        const CheckMessage = `----『咕咕牛🐂』----\n`
                           + `角色数量：${TotalRoles}名\n`
                           + `图片数量：${TotalImages}张\n`
                           + `  |_原   神：${ImageCountMap.原神}张\n`
                           + `  |_星   铁：${ImageCountMap.星铁}张\n`
                           + `  |_绝区零：${ImageCountMap.绝区零}张\n`
                           + `  |_鸣   潮：${ImageCountMap.鸣潮}张\n\n`
                           + `图库容量：${FormatBytes(TotalSize)}\n`
                           + `  |_原   神：${FormatBytes(SizeMap.原神 || 0)}\n`
                           + `  |_星   铁：${FormatBytes(SizeMap.星铁 || 0)}\n`
                           + `  |_绝区零：${FormatBytes(SizeMap.绝区零 || 0)}\n`
                           + `  |_鸣   潮：${FormatBytes(SizeMap.鸣潮 || 0)}\n`
                           + `Git 缓存：${FormatBytes(GitSize)}\n`
                           + `总占用：${FormatBytes(TotalSize * 2 + GitSize)}`; // 原始计算

        try {
            const ForwardMsg = await common.makeForwardMsg(this.e, CheckRoleForward, '『咕咕牛🐂』图库详情');
            await e.reply(CheckMessage);
            await e.reply(ForwardMsg);
        } catch (FwdErr) {
            logger.error('『咕咕牛🐂』CheckFolder 发送转发消息失败:', FwdErr);
            await e.reply(CheckMessage);
        }
        return true;
    }

    async ExportSingleImage(e) {
        const RawInput = e.msg.replace(/^#咕咕牛导出/, '').trim();
        let Name = RawInput.replace(/\s+/g, '').replace(/gu/i, 'Gu');

        if (!/Gu\d+$/i.test(Name)) {
            const AutoMatch = Name.match(/(.*?)(\d+)$/);
            if (AutoMatch) { Name = AutoMatch[1] + 'Gu' + AutoMatch[2]; }
            else { await e.reply('请输入编号，如：#咕咕牛导出心海1', true); return true; }
        }

        const RoleName = Name.replace(/Gu\d+$/, '');
        const Suffix = Name.match(/Gu\d+$/)?.[0] || '';
        const MainName = await this.GetMainRoleName(RoleName, true); 

        if (!MainName) { await e.reply(`角色「${RoleName}」不存在，请检查名称是否正确`, true); return true; }

        const FileName = `${MainName}${Suffix}.webp`;
        const SearchDirs = [ this.GSCopyLocalPath, this.SRCopyLocalPath, this.ZZZCopyLocalPath, this.WAVESCopyLocalPath ];
        let FoundPath = '';

        for (const Dir of SearchDirs) {
            try {
                const Subfolders = await fsPromises.readdir(Dir, { withFileTypes: true });
                for (const Folder of Subfolders) {
                    if (!Folder.isDirectory()) continue;
                    const PossiblePath = path.join(Dir, Folder.name, FileName);
                    try { await fsPromises.access(PossiblePath); FoundPath = PossiblePath; break; } catch { }
                }
            } catch (Error) {
                if (Error.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』导出图片时搜索目录失败: ${Dir}`, Error);
            }
            if (FoundPath) break;
        }

        if (!FoundPath) { await e.reply(`未找到文件：${FileName}`, true); return true; }

        try {
            await e.reply([ `📦文件导出成功：${FileName}`, segment.file(FoundPath) ]);
        } catch (Err) {
            logger.error('[文件导出失败]', Err);
            if (Err?.message?.includes('highway') || Err?.message?.includes('stat') || Err?.code === 210005) { 
                await e.reply('图片过大，导出失败,可能是被限制发送', true);
             }else{ 
                await e.reply('发送文件失败，请查看控制台日志或确认机器人权限', true); 
            }
        }
        return true;
    }

    async ManageGallary(e) {
        const Msg = e.msg.trim();
        let Action = "";

        if (Msg.indexOf("删除") !== -1) Action = "delete";
        else if (Msg.indexOf("重置") !== -1) Action = "restart";
        else { await e.reply("无效的操作类型，请使用 #删除咕咕牛 或 #重置咕咕牛"); return true; }

        const PathsToDeleteOnDelete = [ this.CharacterPath, this.ZZZCharacterPath, this.WAVESCharacterPath ];
        const PathsToDeleteOnRestart = [ ...PathsToDeleteOnDelete, this.LocalPath, this.GuPath ];

        async function SafeDeleteDirectory(TargetDir) {
            let attempts = 0; const maxAttempts = 3;
            while (attempts < maxAttempts) {
                try {
                    logger.info(`[咕咕牛 ManageGallary] 尝试删除 (第 ${attempts + 1} 次): ${TargetDir}`);
                    await fsPromises.rm(TargetDir, { recursive: true, force: true });
                    logger.info(`[咕咕牛 ManageGallary] 成功删除: ${TargetDir}`);
                    break;
                } catch (err) {
                    if (err.code === "EBUSY" || err.code === "EPERM" || err.code === "ENOTEMPTY") {
                        attempts++;
                        logger.warn(`[咕咕牛 ManageGallary] 删除 ${TargetDir} 失败 (尝试 ${attempts}/${maxAttempts}): ${err.code}, 1秒后重试...`);
                        if (attempts >= maxAttempts) { logger.error(`[咕咕牛 ManageGallary] 删除 ${TargetDir} 失败，已达最大重试次数。`); throw err; }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        logger.error(`[咕咕牛 ManageGallary] 删除 ${TargetDir} 时发生不可恢复错误:`, err);
                        throw err;
                    }
                }
            }
        }

        const PathsToProcess = Action === "delete" ? PathsToDeleteOnDelete : PathsToDeleteOnRestart;
        const ActionVerb = Action === "delete" ? "删除" : "重置";
        const ReplyMsgStart = Action === "delete" ? "『咕咕牛🐂』正在被彻底删除中，请稍候..." : "『咕咕牛🐂』正在重置为初始状态，请稍候...";
        const ReplyMsgSuccess = Action === "delete" ? "『咕咕牛🐂』已被成功送走，仅保留本地图库" : "『咕咕牛🐂』已重置完毕，所有内容已清空";

        await e.reply(ReplyMsgStart, true);

        try {
            for (const Dir of PathsToProcess) {
                try { await fsPromises.access(Dir); await SafeDeleteDirectory(Dir); }
                catch (AccessError) { if (AccessError.code !== 'ENOENT') throw AccessError; else logger.info(`[咕咕牛 ManageGallary] 目录不存在，无需${ActionVerb}: ${Dir}`);}
            }
            await e.reply(ReplyMsgSuccess);
        } catch (Err) {
            await e.reply(`${ActionVerb}失败：${Err.message}`);
        }
        return true;
    }

    async DeleteBanList() {
        const BanListPath = path.join(this.GuPath, 'banlist.txt');
        let BannedFiles = [];

        try {
            const Content = await fsPromises.readFile(BanListPath, 'utf8');
            BannedFiles = Content.split(';').map(name => name.trim()).filter(Boolean);
        } catch (Error) {
            if (Error.code === 'ENOENT') return;
            else { logger.error(`『咕咕牛🐂』DeleteBanList 读取 banlist 失败: ${BanListPath}`, Error); return; }
        }

        if (BannedFiles.length === 0) return;

        const DeleteMatchingFiles = async (Dir) => {
            let entries = [];
            try { entries = await fsPromises.readdir(Dir, { withFileTypes: true }); }
            catch (ReadDirError) { if (ReadDirError.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』DeleteBanList 无法读取目录: ${Dir}`, ReadDirError); return; }

            for (const Entry of entries) {
                const FullPath = path.join(Dir, Entry.name);
                if (Entry.isDirectory()) await DeleteMatchingFiles(FullPath);
                else if (Entry.isFile() && BannedFiles.includes(Entry.name)) try { await fsPromises.unlink(FullPath); } catch (UnlinkError) { logger.warn(`『咕咕牛🐂』删除封禁文件失败: ${FullPath}`, UnlinkError); }
            }
        };

        const DirsToClean = [this.CharacterPath, this.ZZZCharacterPath, this.WAVESCharacterPath];
        for (const Dir of DirsToClean) {
            try { await fsPromises.access(Dir); await DeleteMatchingFiles(Dir); } catch {}
        }

        console.log('『咕咕牛🐂』封禁列表中的文件已删除');
    }

    async DeleteFilesWithGuKeyword() {
        const FoldersToCheck = [this.CharacterPath, this.ZZZCharacterPath, this.WAVESCharacterPath];

        for (const BasePath of FoldersToCheck) {
            try {
                await fsPromises.access(BasePath);
                let Folders = [];
                try { Folders = await fsPromises.readdir(BasePath); }
                catch (ReadBaseError) { logger.warn(`『咕咕牛🐂』DeleteFilesWithGuKeyword 无法读取基础目录: ${BasePath}`, ReadBaseError); continue; }

                for (const Folder of Folders) {
                    const FolderPath = path.join(BasePath, Folder);
                    let IsDirectory = false;
                    try { IsDirectory = (await fsPromises.lstat(FolderPath)).isDirectory(); } catch { continue; }
                    if (!IsDirectory) continue;

                    let Files = [];
                    try { Files = await fsPromises.readdir(FolderPath); }
                    catch (ReadSubError) { logger.warn(`『咕咕牛🐂』DeleteFilesWithGuKeyword 无法读取子目录: ${FolderPath}`, ReadSubError); continue; }

                    const ToDelete = Files.filter(File => File.includes('Gu') && !File.endsWith('.db'));

                    await Promise.all(ToDelete.map(async File => {
                        const FilePath = path.join(FolderPath, File);
                        try { await fsPromises.unlink(FilePath); } catch (Err) { /* 忽略删除错误 */ }
                    }));
                }
            } catch (AccessError){
                if(AccessError.code !== 'ENOENT') logger.error(`『咕咕牛🐂』DeleteFilesWithGuKeyword 访问基础目录失败: ${BasePath}`, AccessError);
            }
        }
    }

    async CopySplashWebp(SourceDir, TargetDir) {
        let Folders = [];
        try { Folders = await fsPromises.readdir(SourceDir, { withFileTypes: true }); }
        catch (ReadDirError) { if (ReadDirError.code !== 'ENOENT') logger.error(`『咕咕牛🐂』读取官方立绘源目录失败: ${SourceDir}`, ReadDirError); return; }

        for (const Folder of Folders) {
            if (!Folder.isDirectory() || Folder.name === 'common') continue;
            const FolderPath = path.join(SourceDir, Folder.name);
            const SplashPath = path.join(FolderPath, 'imgs', 'splash.webp');
            const TargetFolderPath = path.join(TargetDir, Folder.name);
            const TargetSplashPath = path.join(TargetFolderPath, 'Gusplash.webp');

            try {
                await fsPromises.access(SplashPath);
                await fsPromises.mkdir(TargetFolderPath, { recursive: true });
                await fsPromises.copyFile(SplashPath, TargetSplashPath);
            } catch (Error) {
                if (Error.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』复制 Gusplash 失败 (${Folder.name}):`, Error);
            }
        }
    }

    async DeleteGuSplashWebp(Directory) {
        let Entries = [];
        try { Entries = await fsPromises.readdir(Directory, { withFileTypes: true }); }
        catch (ReadDirError) { if (ReadDirError.code !== 'ENOENT') logger.warn(`『咕咕牛🐂』DeleteGuSplashWebp 读取目录失败: ${Directory}`, ReadDirError); return; }

        for (const Entry of Entries) {
            const EntryPath = path.join(Directory, Entry.name);
            if (Entry.isDirectory()) await this.DeleteGuSplashWebp(EntryPath);
            else if (Entry.isFile() && Entry.name === 'Gusplash.webp') try { await fsPromises.unlink(EntryPath); } catch (UnlinkError) { logger.warn(`『咕咕牛🐂』删除 Gusplash 文件失败: ${EntryPath}`, UnlinkError); }
        }
    }

    async GetFolderSize(FolderPath) {
        let TotalSize = 0;
        let Files = [];

        try { Files = await fsPromises.readdir(FolderPath); }
        catch (ReadDirError) { if (ReadDirError.code !== 'ENOENT' && ReadDirError.code !== 'EACCES') logger.warn(`『咕咕牛🐂』计算目录大小时读取失败: ${FolderPath}`, ReadDirError); return 0; }

        for (const File of Files) {
            const FilePath = path.join(FolderPath, File);
            try {
                const Stats = await fsPromises.stat(FilePath);
                if (Stats.isDirectory()) TotalSize += await this.GetFolderSize(FilePath);
                else if (Stats.isFile()) TotalSize += Stats.size;
            } catch (StatError) {
                if (StatError.code !== 'ENOENT' && StatError.code !== 'EACCES') logger.warn(`『咕咕牛🐂』获取文件/目录状态失败: ${FilePath}`, StatError);
            }
        }
        return TotalSize;
    }

    async CopyCharacterFolders() {
        const Paths = [
            { source: this.GSCopyLocalPath, destination: this.CharacterPath },
            { source: this.SRCopyLocalPath, destination: this.CharacterPath },
            { source: this.ZZZCopyLocalPath, destination: this.ZZZCharacterPath },
            { source: this.WAVESCopyLocalPath, destination: this.WAVESCharacterPath }
        ];

        for (const { source, destination } of Paths) {
            try { await fsPromises.access(source); await this.CopyFolderRecursive(source, destination); }
            catch { logger.warn(`『咕咕牛🐂』复制角色文件夹时源目录不存在: ${source}`); }
        }

        await this.DeleteBanList();
    }

    async CopyFolderRecursive(Source, Target) {
        try {
            await fsPromises.mkdir(Target, { recursive: true });
            const Files = await fsPromises.readdir(Source);

            await Promise.all(Files.map(async (File) => {
                const CurSource = path.join(Source, File);
                const CurDest = path.join(Target, File);
                try {
                    const Stat = await fsPromises.lstat(CurSource);
                    if (Stat.isDirectory()) await this.CopyFolderRecursive(CurSource, CurDest);
                    else if (Stat.isFile()) await fsPromises.copyFile(CurSource, CurDest);
                } catch (ItemError) {
                    if (ItemError.code !== 'ENOENT' && ItemError.code !== 'EACCES') logger.warn(`『咕咕牛🐂』复制过程中处理 ${CurSource} 时出错:`, ItemError);
                }
            }));
        } catch (Error) {
            if (Error.code !== 'ENOENT' && Error.code !== 'EACCES') logger.error(`『咕咕牛🐂』递归复制文件夹 ${Source} -> ${Target} 失败:`, Error);
        }
    }

    GenerateDownloadErrorFeedback(Error) {
      const ErrorMessages = {
         'code 128': "检查网络连接：确保您的网络连接正常，有时候网络问题可能导致 Git 无法正常执行操作。", 
         'code 128': "也是可能本地已存在图库,JS无法识别到，可以尝试重置咕咕牛。",

         'code 28': "增加 Git 的 HTTP 缓冲区大小，在控制台输入命令：git config --global http.postBuffer 524288000", 
         '443': "可能是网络问题、被墙或访问被拒绝。", 
         'code 1': "Git 操作失败，可能是本地与远程仓库冲突、权限问题或锁文件问题。请检查并解决冲突或确保文件没有被锁定。", 
         'Please commit': "本地文件冲突了~", 
         'fatal: not a git': "当前目录不是 Git 仓库，确保路径正确，或者重新克隆仓库。", 
         'fatal: You have not concluded': "合并操作未完成，请使用 'git merge --abort' 来取消当前合并。", 
         'fatal: unable to access': "无法访问远程仓库，可能是网络问题或者远程地址不可达。", 
         'fatal: remote origin': "远程仓库地址已经存在，可以尝试更新远程仓库地址。", 
         'error: Your local': "本地文件有未提交的更改，执行 'git stash' 或 'git commit' 提交本地更改。", 
         'fatal: Failed to resolve': "Git 无法找到当前仓库的 HEAD，可能仓库不完整，尝试 'git fsck' 来修复。", 
         'fatal: could not open index.lock': "Git 正在进行操作时，另一个操作锁住了文件，可以删除 '.git/index.lock' 文件再试。", };
      
      let Feedback = [`『咕咕牛🐂』操作时出现错误: ${Error}`];
      const ErrorString = Error.message || Error.toString();

      Object.entries(ErrorMessages).forEach(([Key, Msg]) => {
         const Code = Key.replace(/#\d+$/, '');
        if (ErrorString.includes(Code)) {
             if (!Feedback.includes(Msg)) 
                Feedback.push(Msg); 
            } });
      if (ErrorString.includes('code 128') && !Feedback.includes(ErrorMessages['code 128#2'])) 
                Feedback.push(ErrorMessages['code 128#2']);


            return Feedback;
    }

    async GetMainRoleName(RoleName) {
        const { mainName } = await this.ResolveAlias(RoleName);
        return mainName;
    }

    async IsRoleExist(RoleName) {
        const { exists } = await this.ResolveAlias(RoleName);
        return exists;
    }

    async ResolveAlias(RoleName) {
        const ParseAliasFromJS = async (FilePath) => {
            try {
                const Content = await fsPromises.readFile(FilePath, 'utf8');
                const Match = Content.match(/{[^{}]*}/);
                if (!Match) return {};
                return new Function(`return ${Match[0]}`)() || {};
            } catch (Err) {
                if (Err.code !== 'ENOENT') console.warn(`⚠️ 解析别名JS失败: ${FilePath} - ${Err.message}`);
                return {};
            }
        };

        const ParseAliasFromYAML = async (FilePath) => {
            try {
                const Content = await fsPromises.readFile(FilePath, 'utf8');
                return yaml.parse(Content);
            } catch (Err) {
                if (Err.code !== 'ENOENT') console.warn(`⚠️ 解析别名YAML失败: ${FilePath} - ${Err.message}`);
                return {};
            }
        };

        const [AliasGS, AliasSR, AliasZZZ, AliasWAVES] = await Promise.all([
            ParseAliasFromJS(path.resolve(this.GSAliasPath, 'alias.js')),
            ParseAliasFromJS(path.resolve(this.SRAliasPath, 'alias.js')),
            ParseAliasFromYAML(path.resolve(this.ZZZAliasPath, 'alias.yaml')),
            ParseAliasFromYAML(path.resolve(this.WAVESAliasPath, 'role.yaml'))
        ]);

        const AliasMapCombined = Object.assign({}, AliasGS, AliasSR, AliasZZZ, AliasWAVES);

        const FindMainName = (AliasMap, IsStringList = true) => Object.keys(AliasMap).find(Main => {

            const Aliases = AliasMap[Main]; 
            if (!Aliases) 
                return false; 
            
            let AliasArray; 
            if (IsStringList) { 
                if (typeof Aliases !== 'string') 
                    return false; AliasArray = Aliases.split(','); 
                } else { if (!Array.isArray(Aliases)) 
                    return false; 
                    AliasArray = Aliases; 
                } 
                return typeof RoleName === 'string' && AliasArray.includes(RoleName.trim()); 
            });
        let MainName = FindMainName(AliasGS) || FindMainName(AliasSR) || FindMainName(AliasZZZ, false) || FindMainName(AliasWAVES, false);
        MainName = MainName || (typeof RoleName === 'string' ? RoleName.trim() : RoleName);

        const Exists = Object.keys(AliasMapCombined).includes(MainName) || Object.values(AliasMapCombined).some(List => {
            if (!List) return false; 
            let AliasArray; 
            if (Array.isArray(List)) AliasArray = List; 
            else if (typeof List === 'string') AliasArray = List.split(','); 
            else return false; return typeof RoleName === 'string' && AliasArray.includes(RoleName.trim()); });

        return { mainName: MainName, exists: Exists };
    }
}
    function logMemoryUsage(label = '') {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const usedMemMB = (usedMem / 1024 / 1024).toFixed(1);
            const totalMemMB = (totalMem / 1024 / 1024).toFixed(1);
            const freeMemMB = (freeMem / 1024 / 1024).toFixed(1);
            const percentageUsed = ((usedMem / totalMem) * 100).toFixed(1);
            logger.info(`『咕咕牛 ${label}』 使用情况: ${usedMemMB}MB / ${totalMemMB}MB (${percentageUsed}% 已使用, ${freeMemMB}MB 空闲)`);
            if (typeof os.loadavg === 'function') {
                logger.info(`[咕咕牛 负载 ${label}] 系统平均负载 (1分钟, 5分钟, 15分钟): ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`);
            }
        } catch (e) {
            logger.warn(`『咕咕牛』 获取内存/负载使用情况失败: ${e.message}`);
        }
    }
const GUGUNIU_RULES = [
    { reg: /^#(代理)?下载咕咕牛$/, fnc: 'GallaryDownload' },
    { reg: /^#(强制)?更新咕咕牛$/, fnc: 'GallaryUpdate' },
    { reg: /^#(删除|重置)咕咕牛$/, fnc: 'ManageGallary', permission: 'master' },
    { reg: /^#检查咕咕牛$/, fnc: 'CheckFolder' },
    { reg: /^#(启用|禁用)(咕咕牛|官方立绘)$/, fnc: 'GalleryOption', permission: 'master' },
    { reg: /^#(ban(加|删)|咕咕牛(封(?!禁列表)|解)禁|(?:ban|咕咕牛封禁)列表|清空咕咕牛封禁)(.*)?$/, fnc: 'BanRole', permission: 'master' },
    { reg: /^#(确认)?净化咕咕牛$/, fnc: 'RemoveBadimages', permission: 'master' },
    { reg: /^#检查净化图片$/, fnc: 'CheckR18Photo' },
    { reg: /^#咕咕牛导出(.+)$/, fnc: 'ExportSingleImage' },
    { reg: /^#查看(.+)$/, fnc: 'FindRoleSplash' },
    { reg: /^#咕咕牛帮助$/, fnc: 'GuHelp' },
    { reg: /^#咕咕牛$/, fnc: 'GuGuNiu' }
];



