import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';
import yaml from 'yaml'



//        『咕咕牛🐂』图库管理器 v3.1
//        Github仓库地址：https://github.com/GuGuNiu/Miao-Plugin-MBT/



export class MiaoPluginMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』图库管理器 v3.1',
            dsc: '『咕咕牛🐂』图库管理器',
            event: 'message',
            priority: 1000,
            rule: [
                // 🧩 基础操作
                { reg: /^#(代理)?下载咕咕牛$/,         fnc: 'GallaryDownload' },
                { reg: /^#(强制)?更新咕咕牛$/,         fnc: 'GallaryUpdate' },
                { reg: /^#删除咕咕牛$/,                fnc: 'DeleteGallary',        permission: "master" },
                { reg: /^#重置咕咕牛$/,                fnc: 'RestartGuGuNiu',       permission: "master" },
                { reg: /^#检查咕咕牛$/,                fnc: 'CheckFolder' },
              
                // ⚙️ 配置项
                { reg: /^#(启用|禁用)咕咕牛$/,          fnc: 'GalleryOption',        permission: "master" },
                { reg: /^#(启用|禁用)官方立绘$/,        fnc: 'MihoyoSplashOption',   permission: "master" },
              
                // 🛡️ 黑名单管理
                { reg: /^#ban(加|删)(.*)$/,            fnc: 'BanRole',              permission: "master" },
                { reg: /^#ban列表$/,                   fnc: 'BanRolelist' },
                { reg: /^#清空咕咕牛封禁$/,             fnc: 'GOODBYEGUGUNIU',       permission: "master" },
              
                // 🧹 净化处理
                { reg: /^#(确认)?净化咕咕牛$/,          fnc: 'RemoveBadimages' ,     permission: "master" },
                { reg: /^#检查净化图片$/,               fnc: 'CheckR18Photo' },
              
                // 🔍 查询角色
                { reg: /^#查看(.*)$/,                  fnc: 'FindRoleSplash' },
              
                // 🆘 帮助
                { reg: /^#咕咕牛帮助$/,                 fnc: 'GuHelp' },
                { reg: /^#咕咕牛$/,                     fnc: 'GuGuNiu' }
              ]
              
        })
        this.task = {
            name: '『咕咕牛🐂』定时更新任务',
            cron: '0 5 */5 * *',
            fnc: () => this.executeTask(),
            log: false
        }
        const currentFileUrl = import.meta.url;
        const currentFilePath = fileURLToPath(currentFileUrl);
        const baseDir = path.resolve(path.dirname(currentFilePath), '../../');
    
        // 代理地址
        this.proxy = 'https://ghfast.top/';  
        this.proxy2 = 'https://ghp.ci/';  
        this.proxy3 = 'https://ghgo.xyz/';  
        this.proxy4 = 'https://ghproxy.com/';  
        this.proxy5 = 'https://github.moeyy.xyz/';
        this.proxy6 = 'https://git.yumenaka.net/';
        this.proxy7 = 'https://raw.gitmirror.com/';
        this.proxy8 = 'https://ghproxy.net/';

    
        // 仓库信息
        this.repositoryUrl = 'https://github.com/GuGuNiu/Miao-Plugin-MBT/';
        this.localPath = path.join(baseDir, 'resources/Miao-Plugin-MBT/');
        this.GitPath = path.join(this.localPath, '.git/');
    
        // 插件角色路径
        this.characterPath = path.join(baseDir, 'plugins/miao-plugin/resources/profile/normal-character/');
        this.ZZZcharacterPath = path.join(baseDir, 'plugins/ZZZ-Plugin/resources/images/panel/'); 
        this.WAVEScharacterPath = path.join(baseDir, 'plugins/waves-plugin/resources/rolePic/'); 
    
        // 图库载入路径
        this.SRcopylocalPath = path.join(this.localPath, 'sr-character/');
        this.GScopylocalPath = path.join(this.localPath, 'gs-character/');
        this.ZZZcopylocalPath = path.join(this.localPath, 'zzz-character/'); 
        this.WAVEScopylocalPath = path.join(this.localPath, 'waves-character/');
    
        // 别名路径
        this.GSaliasPath = path.join(baseDir, 'plugins/miao-plugin/resources/meta-gs/character/');
        this.SRaliasPath = path.join(baseDir, 'plugins/miao-plugin/resources/meta-sr/character/');
        this.ZZZaliasPath = path.join(baseDir, 'plugins/ZZZ-Plugin/defset/');  
        this.WAVESaliasPath = path.join(baseDir, 'plugins/waves-plugin/resources/Alias/');  
    
        // 公共路径
        this.GuPath = path.join(baseDir, 'resources/GuGuNiu-Gallery/');
        this.JsPath = path.join(baseDir, 'plugins/example/');
        this.galleryConfigPath = path.join(this.GuPath, 'GalleryConfig.yaml');


    }

    async updateGalleryConfig(field, value) {
        const galleryConfigContent = fs.readFileSync(this.galleryConfigPath, 'utf8');
        const galleryConfig = yaml.parse(galleryConfigContent);
        galleryConfig[field] = value;
        const newGalleryConfigContent = yaml.stringify(galleryConfig);
        fs.writeFileSync(this.galleryConfigPath, newGalleryConfigContent, 'utf8');
    }

    async GallaryDownload(e) {
        const sources = {
            "ghfast.top": "https://ghfast.top/" + this.repositoryUrl,
            "ghp.ci": "https://ghp.ci/" + this.repositoryUrl,
            "ghgo.xyz": "https://ghgo.xyz/" + this.repositoryUrl,
            "ghproxy.com": "https://ghproxy.com/" + this.repositoryUrl,
            "fastgit.org": "https://fastgit.org/" + this.repositoryUrl,
            "github.moeyy.xyz": "https://github.moeyy.xyz/" + this.repositoryUrl,
            "gh.api.99988866.xyz": "https://gh.api.99988866.xyz/" + this.repositoryUrl,
            "raw.gitmirror.com": "https://raw.gitmirror.com/" + this.repositoryUrl,
            "github.com": this.repositoryUrl 
        };
    
        await e.reply('『咕咕牛🐂』测速中，请稍候...');
    
        const testSourceSpeed = async (url) => {
            const start = Date.now();
            try {
                const response = await fetch(url + "/README.md", { timeout: 3000 });
                if (response.ok) return Date.now() - start;
                return Infinity;
            } catch {
                return Infinity;
            }
        };
    
        const speeds = await Promise.all(Object.entries(sources).map(async ([name, url]) => {
            const speed = await testSourceSpeed(url);
            return { name, url, speed };
        }));
    
        speeds.sort((a, b) => a.speed - b.speed);
        const best = speeds[0];
    
        await e.reply(`测速完成，最佳源为 ${best.name}，延迟 ${best.speed}ms，开始下载`);
    
        try {
          
            const rawURL = best.url.replace(/github\.com.*$/, "main");
            await this.downloadFromRaw(rawURL, e);
            await this.PostDownload(e);
            return;
        } catch (err1) {
            console.warn("raw.git 下载分段内容：", err1.message);
        }
    
        try {
  
            await this.downloadViaSparse(best.url, e);
            await this.PostDownload(e);
            return;
        } catch (err2) {
            console.warn("Sparse-checkout（Git分段下载）：", err2.message);
        }
    
        try {
            await this.cloneFullRepo(best.url, e);
            await this.PostDownload(e);
        } catch (err3) {
            await e.reply('所有方式均失败，请检查网络或手动下载');
            console.error("git clone也失败：", err3.message);
        }
    }



     //下载一
                    async downloadFromRaw(baseRawUrl, e) {
                        const folders = ['gs-character', 'sr-character', 'zzz-character', 'waves-character'];
                        for (let folder of folders) {
                            const chars = await this.getCharacterListFromRaw(baseRawUrl + '/' + folder);
                            for (let char of chars) {
                                const url = `${baseRawUrl}/${folder}/${char}/panel.webp`;
                                const targetPath = path.join(this.localPath, folder, char, 'panel.webp');
                                await this.downloadSingleFile(url, targetPath);
                            }
                        }
                    }
                    
                    async getCharacterListFromAlias() {
                        const characterLists = [];
                    
                        const aliasGSFile = path.resolve(this.GSaliasPath, 'alias.js');
                        if (fs.existsSync(aliasGSFile)) {
                            const content = fs.readFileSync(aliasGSFile, 'utf-8');
                            const match = content.match(/{[^{}]*}/);
                            if (match) {
                                const aliasGS = eval('(' + match[0] + ')');
                                characterLists.push(...Object.keys(aliasGS).map(name => name.trim()));
                            }
                        }
                    
                        const aliasSRFile = path.resolve(this.SRaliasPath, 'alias.js');
                        if (fs.existsSync(aliasSRFile)) {
                            const content = fs.readFileSync(aliasSRFile, 'utf-8');
                            const match = content.match(/{[^{}]*}/);
                            if (match) {
                                const aliasSR = eval('(' + match[0] + ')');
                                characterLists.push(...Object.keys(aliasSR).map(name => name.trim()));
                            }
                        }
                    
                        const aliasZZZFile = path.resolve(this.ZZZaliasPath, 'alias.yaml');
                        if (fs.existsSync(aliasZZZFile)) {
                            const content = fs.readFileSync(aliasZZZFile, 'utf-8');
                            const aliasZZZ = yaml.parse(content);
                            characterLists.push(...Object.keys(aliasZZZ).map(name => name.trim()));
                        }
                    
                        const aliasWAVESFile = path.resolve(this.WAVESaliasPath, 'role.yaml');
                        if (fs.existsSync(aliasWAVESFile)) {
                            const content = fs.readFileSync(aliasWAVESFile, 'utf-8');
                            const aliasWAVES = yaml.parse(content);
                            characterLists.push(...Object.keys(aliasWAVES).map(name => name.trim()));
                        }
                    
                        return [...new Set(characterLists)];
                    }
                    
                    
                    async getCharacterListFromRaw(folderUrl) {
                        const characterList = await this.getCharacterListFromAlias();
                        if (characterList && characterList.length > 0) {
                            return characterList;
                        }
                    
                    }
                    
                    async downloadSingleFile(url, destPath) {
                        const dir = path.dirname(destPath);
                        await fs.promises.mkdir(dir, { recursive: true });
                    
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`下载失败: ${url}`);
                        const buffer = await res.arrayBuffer();
                        fs.writeFileSync(destPath, Buffer.from(buffer));
                    }


    //下载二
                    async downloadViaSparse(url, e) {
                        await fs.promises.rm(this.localPath, { recursive: true, force: true });
                        await fs.promises.mkdir(this.localPath, { recursive: true });
                    
                        const cmd = [
                            `git init`,
                            `git remote add -f origin ${url}`,
                            `git config core.sparseCheckout true`,
                            `echo "gs-character/" >> .git/info/sparse-checkout`,
                            `echo "sr-character/" >> .git/info/sparse-checkout`,
                            `echo "zzz-character/" >> .git/info/sparse-checkout`,
                            `echo "waves-character/" >> .git/info/sparse-checkout`,
                            `git pull origin main`
                        ].join(" && ");
                    
                        return new Promise((resolve, reject) => {
                            exec(cmd, { cwd: this.localPath }, (err, stdout, stderr) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });
                    }
    

    //下载三
                    async cloneFullRepo(url, e) {
                        await fs.promises.rm(this.localPath, { recursive: true, force: true });
                        return new Promise((resolve, reject) => {
                            const process = exec(`git clone --depth=1 ${url} ${this.localPath}`);
                            process.on('close', code => {
                                code === 0 ? resolve() : reject(new Error(`git clone failed: ${code}`));
                            });
                        });
                    }
    

    async PostDownload(e) {
        await this.copyCharacterFolders();
        await e.reply('『咕咕牛』正在咕咕噜的载入喵喵中...');
    
        fs.mkdirSync(this.GuPath, { recursive: true });
        this.CopyFolderRecursive(path.join(this.localPath, 'GuGuNiu-Gallery'), this.GuPath);
    
        setTimeout(async () => {
            await e.reply('『咕咕牛』成功进入喵喵里面！\n自动更新Js和图库。');
        }, 20000);
    
        const sourceFile = path.join(this.localPath, '咕咕牛图库下载器.js');
        const destFile = path.join(this.JsPath, '咕咕牛图库下载器.js');
        await fs.promises.copyFile(sourceFile, destFile);
    }
    
    async GallaryUpdate(e) {
        try {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』未下载！', true);
                return;
            }
            await e.reply('『咕咕牛🐂』开始更新了', true);
    
            const gitPullOutput = await this.execGitCommand('git pull');
            if (/Already up[ -]to[ -]date/.test(gitPullOutput)) {
                await e.reply("『咕咕牛』已经是最新的啦");
                const gitLog = await this.execGitCommand('git log -n 1 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"');
                await e.reply(`最近一次更新：${gitLog}`);
            } else {
                const gitLog = await this.execGitCommand('git log -n 20 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"');
                const forwardMsg = [`最近的更新记录：\n${gitLog}`];
                const forwardMsgFormatted = await common.makeForwardMsg(this.e, forwardMsg, '『咕咕牛🐂』更新成功');
                await this.reply(forwardMsgFormatted);
    
                await this.DeleteFilesWithGuKeyword();
                await this.execGitCommand('git clean -df');
    
                const galleryConfig = await this.getGalleryConfig();
                if (galleryConfig && galleryConfig['GGOP'] === 1) {
                    await this.copyCharacterFolders();
                }
    
                fs.mkdirSync(this.GuPath, { recursive: true });
                const sourceFile = path.join(this.localPath, 'GuGuNiu-Gallery', 'help.png');
                const destFile = path.join(this.GuPath, 'help.png');
                await fs.promises.copyFile(sourceFile, destFile);
    
                const sourceJSFile = path.join(this.localPath, '咕咕牛图库下载器.js');
                const destJSFile = path.join(this.JsPath, '咕咕牛图库下载器.js');
                await fs.promises.copyFile(sourceJSFile, destJSFile);
    
                if (galleryConfig && galleryConfig['Px18img-type'] === 0) {
                    const banList = await this.updateBanList();
                    fs.writeFileSync(path.join(this.GuPath, 'banlist.txt'), `${banList.join(';')};`, 'utf8');
                }
            }
        }catch (error) {
            console.error('更新『咕咕牛🐂』时出现错误:', error);
            const updateerrorforward = await this.generateDownloadErrorFeedback(error);
            await this.reply('更新『咕咕牛』时出现错误，请查看日志！');
            setTimeout(async () => {
                await this.reply(updateerrorforward);
            }, 2000);
        }
    }
    
    async execGitCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { cwd: this.localPath }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
    
    async getGalleryConfig() {
        const galleryConfigContent = fs.readFileSync(this.galleryConfigPath, 'utf8');
        return yaml.parse(galleryConfigContent);
    }
    
    async updateBanList() {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');
        R18_images.forEach(image => {
            const fileName = `${image}.webp`;
            if (!banList.includes(fileName)) {
                banList.push(fileName);
            }
        });
        return banList;
    }
    

    async GuHelp(e) {
        if (!fs.existsSync(this.GuPath)) {
            e.reply(segment.image("https://s2.loli.net/2024/06/28/LQnN3oPCl1vgXIS.png"))
            return true;
         }e.reply(segment.image(this.GuPath+'/help.png'))
      }

    async BanRole(e) {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        if (!fs.existsSync(banListPath)) {
            fs.writeFileSync(banListPath, '', 'utf8');
        }
        let message = e.raw_message || e.message || e.content;
    
        function standardizeRoleName(inputRoleName) {
            let match = inputRoleName.match(/(.*?)(gu\d+)$/i);
            if (match) {
                const namePart = match[1];
                const guPart = match[2].replace(/gu/i, 'Gu');
                return namePart + guPart;
            }
        
            match = inputRoleName.match(/(.*?)(\d+)$/);
            if (match) {
                const namePart = match[1];
                const numPart = match[2];
                return namePart + 'Gu' + numPart;
            }
        
            return inputRoleName + 'Gu1';
        }
        
    
        if (message.startsWith('#ban加')) {
            const match = message.match(/^#ban加(.+)/);
            if (!match) {
                await e.reply('请输入要添加到禁止列表的名称\n例如：#ban加花火Gu1', true);
                return true;
            }
    
            let inputRoleName = match[1].trim();
            let standardizedRoleName = standardizeRoleName(inputRoleName);  
            let roleName = standardizedRoleName.replace(/Gu\d+$/, '').trim();
            let mainName = this.getMainRoleName(roleName); 
            
            if (mainName) {
                let matched = standardizedRoleName.match(/Gu\d+$/);  
                if (matched) {
                    mainName = `${mainName}${matched[0]}`;
                    let fileName = `${mainName}.webp`;
    
                    let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');
    
                    if (!banList.includes(fileName)) {
                        banList.push(fileName); 
                        fs.writeFileSync(banListPath, `${banList.join(';')};`, 'utf8'); 
                        await e.reply(`${fileName} 🚫已封禁`, true);
                        this.DeleteBanList();   
                    } else {
                        await e.reply(`${fileName} ❌️已存在`, true);
                    }
                } else {
                    await e.reply('请输入编号，例如：#ban加心海Gu1', true);  
                }
            } else {
                await e.reply(`未找到角色：${roleName}`, true);
            }
        } else if (message.startsWith('#ban删')) {
            const match = message.match(/^#ban删(.+)/);
            if (!match) {
                await e.reply('请输入要从禁止列表中删除的名称\n例如：#ban删花火Gu1', true);
                return true;
            }
    
            let inputRoleName = match[1].trim();
            let standardizedRoleName = standardizeRoleName(inputRoleName);  
            let mainName = this.getMainRoleName(roleName);
    
            if (mainName) {
                let matched = standardizedRoleName.match(/Gu\d+$/); 
                if (matched) {
                    mainName = `${mainName}${matched[0]}`;
                    let fileName = `${mainName}.webp`;
    
                    let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');
    
                    if (R18_images.includes(inputRoleName)) {
                        await e.reply(`${inputRoleName} ❌️已拒绝删除`, true);
                        return true;
                    }
    
                    if (banList.includes(fileName)) {
                        banList = banList.filter(item => item !== fileName);
                        fs.writeFileSync(banListPath, `${banList.join(';')}`, 'utf8');
                        await e.reply(`${fileName} ✅️已解禁`, true);
                        await e.reply("批量解除封禁可输入#清空咕咕牛封禁,仅重置封禁文件不影响净化模式");
                        await this.copyCharacterFolders();
    
                    } else {
                        await e.reply(`${fileName} ❌️不存在`, true);
                    }
                } else {
                    await e.reply('请输入编号，例如：#ban删心海Gu1', true);  
                }
            } else {
                await e.reply(`未找到角色：${roleName}`, true);
            }
        }
    
        return true;
    }
    
    
    async BanRolelist(e) {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
    
        if (!fs.existsSync(banListPath)) {
            fs.writeFileSync(banListPath, '', 'utf8');
            await e.reply('禁用文件不存在，已重新生成', true);
            return true;
        }
    
        try {
            const content = fs.readFileSync(banListPath, 'utf8').trim();
    
            if (!content) {
                await e.reply('封禁列表是空的', true);
                return true;
            }
            const banList = [...new Set(content.split(';').map(item => item.trim()).filter(Boolean))];
            const formattedList = banList.map(item => item.replace(/\.webp$/, ''));
            const displayCount = banList.length - 1;  
    
            const msg = [
                `当前已Ban的数量：${displayCount} 张\n『#ban删花火Gu1』可以移除封禁`,
                formattedList.join('\n')
            ];
    
            const forwardMsg = await common.makeForwardMsg(this.e, msg, '封禁中的面板图列表');
            await e.reply(forwardMsg);
        } catch (error) {
            console.error('读取封禁列表失败:', error);
            await e.reply('读取封禁文件时出现错误，请查看控制台日志', true);
        }
    
        return true;
    }
    

    async FindRoleSplash(e) {
        if (!fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }
    
        const match = e.msg.match(/^#查看(.+)$/);
        if (!match) {
            await e.reply('请输入正确的命令格式\n例如：#查看花火', true);
            return true;
        }
    
        let roleName = this.getMainRoleName(match[1].trim());
    
        const allCharacterDirs = [
            this.GScopylocalPath,
            this.SRcopylocalPath,
            this.ZZZcopylocalPath,
            this.WAVEScopylocalPath
        ];
    
        let matchedFolder = null;
    
        for (const dir of allCharacterDirs) {
            const subfolders = fs.readdirSync(dir);
            for (const sub of subfolders) {
                if (sub.includes(roleName)) {
                    matchedFolder = path.join(dir, sub);
                    break;
                }
            }
            if (matchedFolder) break;
        }
    
        if (!matchedFolder) {
            await e.reply(`未找到角色『${roleName}』`);
            return true;
        }
    
        const files = fs.readdirSync(matchedFolder)
            .filter(file => file.endsWith('.webp'))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || 0);
                const numB = parseInt(b.match(/\d+/)?.[0] || 0);
                return numA - numB;
            });
    
        if (files.length === 0) {
            await e.reply(`『${path.basename(matchedFolder)}』文件夹下没有图片`, true);
            return true;
        }
    
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        const banListContent = fs.existsSync(banListPath) ? fs.readFileSync(banListPath, 'utf8') : '';
        const bannedFiles = banListContent.split(';').map(f => f.trim()).filter(Boolean);
    
        const title = `当前查看『${path.basename(matchedFolder)}』，有${files.length}张`;
        const forwardMsgList = [[title]];
    
        for (let i = 0; i < files.length; i++) {
            const fileName = files[i];
            const filePath = path.join(matchedFolder, fileName);
            const baseName = fileName.replace(/\.webp$/, '');
            const isBanned = bannedFiles.includes(fileName);
            const isR18 = R18_images.includes(baseName);
    
            let label = `${baseName}`;
            if (isBanned && isR18) label += ' ❌封禁🟢净化';
            else if (isBanned) label += ' ❌封禁';
    
            forwardMsgList.push([
                `${i + 1}、${label}`,
                segment.image(`file://${filePath}`)
            ]);
        }
    
        try {
            const forwardMsg = await common.makeForwardMsg(this.e, forwardMsgList, title);
            await e.reply(forwardMsg || '发送失败,请私聊查看！', true);
        } catch (err) {
            console.error(err);
            await e.reply(`发送 ${path.basename(matchedFolder)} 的列表时出现错误,请查看控制台日志`);
        }
    
        return true;
    }
    
    

    async RemoveBadimages(e) {
        const galleryConfig = await this.getGalleryConfig();
        const banListPath = path.join(this.GuPath, 'banlist.txt');
    
        if (e.msg === '#净化咕咕牛') {
            await e.reply("『咕咕牛』\n封禁高危面板图，净化操作无法撤销，需要手动修改配置文件。下次更新会保留净化记录，建议使用 #ban 命令做更灵活的封禁。", true);
            await e.reply("你可以先输入 #检查净化图片 来预览被净化内容。");
            setTimeout(async () => {
                await e.reply("如要继续净化，请输入 #确认净化咕咕牛");
            }, 5000);
            return true;
        }
    
        if (e.msg === '#确认净化咕咕牛') {
            if (galleryConfig?.['Px18img-type'] === 0) {
                await e.reply("你已经完成过净化操作了，牟~", true);
                return true;
            }
    
            await e.reply("『咕咕牛』开始执行净化中...", true);
    
            if (!fs.existsSync(banListPath)) {
                fs.writeFileSync(banListPath, '', 'utf8');
            }
    
            const existingBanList = fs.readFileSync(banListPath, 'utf8')
                .split(';')
                .map(item => item.trim())
                .filter(Boolean);
    
            const updatedBanList = new Set(existingBanList);
    
            for (const img of R18_images) {
                updatedBanList.add(`${img}.webp`);
            }
    
            fs.writeFileSync(banListPath, Array.from(updatedBanList).join(';') + ';', 'utf8');
    
            await this.DeleteBanList();

            await this.updateGalleryConfig('Px18img-type', 0);

            setTimeout(async () => {
                await e.reply("净化完毕，绿色网络，从你我做起！🌱");
            }, 10000);
    
            return true;
        }
    }
    
    async CheckR18Photo(e) {
        if (!fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }
    
        await e.reply("开始检查中，图片数量较多请稍候...", true);
    
        const folderPaths = [
            this.GScopylocalPath,
            this.SRcopylocalPath,
            this.ZZZcopylocalPath,
            this.WAVEScopylocalPath
        ];
    
        const folderCache = {};
        const R18PhotoList = [];
        const checkR18Msg = `当前查看净化图片，共 ${R18_images.length} 张：`;
    
        const getSubFolders = async (folderPath) => {
            if (folderCache[folderPath]) return folderCache[folderPath];
            const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
            const subFolders = entries.filter(d => d.isDirectory()).map(d => d.name);
            folderCache[folderPath] = subFolders;
            return subFolders;
        };
    
        const findImageInFolders = async (imageName) => {
            const imageFile = `${imageName}.webp`;
            for (const basePath of folderPaths) {
                const subFolders = await getSubFolders(basePath);
                for (const folder of subFolders) {
                    const fullPath = path.join(basePath, folder, imageFile);
                    try {
                        await fs.promises.access(fullPath, fs.constants.F_OK);
                        return fullPath;
                    } catch { continue; }
                }
            }
            return null;
        };
    
        for (let i = 0; i < R18_images.length; i++) {
            const name = R18_images[i];
            const foundPath = await findImageInFolders(name);
            if (foundPath) {
                R18PhotoList.push([
                    `${i + 1}、${name}`,
                    segment.image(`file://${foundPath}`)
                ]);
            }
        }
    
        if (R18PhotoList.length === 0) {
            await e.reply('没有找到符合条件的净化图片！');
            return;
        }
    
        try {
            const R18Msg = await common.makeForwardMsg(this.e, R18PhotoList, checkR18Msg);
            await e.reply(R18Msg || '发送失败，请私聊查看！', true);
        } catch (err) {
            console.error(err);
            await e.reply('发送净化列表时出现错误，请查看控制台日志');
        }
    }
    
    
    
    async GuGuNiu(e) {
            await e.reply("🐂");
            const stats = await fs.promises.stat(this.localPath);
            const creationTime = stats.birthtime.toISOString();
            await e.reply(`图库安装时间: ${creationTime}`);
            const gitLog = await new Promise((resolve, reject) => {
                exec('git log -n 50 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"', { cwd: this.localPath }, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            });
    
            const uplogforwardMsg = [`最近的更新记录：\n${gitLog}`];
            const forwardMsgFormatted = await common.makeForwardMsg(this.e, uplogforwardMsg, '『咕咕牛🐂』日志');
            await e.reply(forwardMsgFormatted);
    }
    
    async GalleryOption(e) {
        const { msg } = e;
    
        if (msg === '#启用咕咕牛') {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』未下载！', true);
                return;
            }
    
            await e.reply('『咕咕牛🐂』启用中，请稍后...', true);
            await this.copyCharacterFolders();
            await this.updateGalleryConfig('GGOP', 1);
    
            setTimeout(async () => {
                await e.reply('『咕咕牛』重新进入喵喵里面！');
            }, 2000);
    
        } else if (msg === '#禁用咕咕牛') {
            await e.reply('『咕咕牛🐂』禁用中，请稍后...', true);
            await this.DeleteFilesWithGuKeyword();
            await this.updateGalleryConfig('GGOP', 0);
            await e.reply('『咕咕牛』已离开喵喵');
        }
    }
    

    async DeleteGallary(e) {
        await e.reply('『咕咕牛🐂』完全删除中，请稍后...', true);
        await this.DeleteFilesWithGuKeyword();
    
        if (!fs.existsSync(this.localPath)) {
            return e.reply('『咕咕牛』已经离开你的崽崽了！');
        }
    
        await fs.promises.rm(this.localPath, { recursive: true, force: true });
        console.log('『咕咕牛🐂』图库删除成功！');
        return e.reply('『咕咕牛』已经离开你的崽崽了！！');
    }
    


    async executeTask() {
        logger.info("『咕咕牛🐂』定时更新任务：开始执行");
    
        try {
            const gitPullOutput = await new Promise((resolve, reject) => {
                exec('git pull', { cwd: this.localPath }, (error, stdout) => {
                    if (error) return reject(error);
                    resolve(stdout);
                });
            });
    
            if (/Already up[ -]?to[ -]?date/.test(gitPullOutput)) {
                logger.info("『咕咕牛🐂』定时更新任务：暂无更新内容");
                return;
            }
    
            await this.copyCharacterFolders();

            fs.mkdirSync(this.GuPath, { recursive: true });
            const helpSource = path.join(this.localPath, 'GuGuNiu-Gallery', 'help.png');
            const helpDest = path.join(this.GuPath, 'help.png');
            await fs.promises.copyFile(helpSource, helpDest);
    
            const jsSource = path.join(this.localPath, '咕咕牛图库下载器.js');
            const jsDest = path.join(this.JsPath, '咕咕牛图库下载器.js');
            await fs.promises.copyFile(jsSource, jsDest);
    
            logger.info("『咕咕牛🐂』定时更新任务：执行完毕");
    
        } catch (err) {
            logger.error("『咕咕牛🐂』定时更新任务：执行出错", err);
        }
    }
    

    async GOODBYEGUGUNIU(e) {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
            if (!fs.existsSync(banListPath)) {
                fs.writeFileSync(banListPath, '', 'utf8');
                await e.reply("牛的封禁列表文件不存在，已重新创建", true);
            } else {
                fs.unlinkSync(banListPath);
                fs.writeFileSync(banListPath, '', 'utf8');
                await e.reply("牛的封禁文件清空成功", true);
            }
    }
    
    async RestartGuGuNiu(e) {
        try {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』未下载！', true);
                return true;
            }
    
            await fs.promises.rm(this.localPath, { recursive: true, force: true });
            console.log('『咕咕牛🐂』重置成功！');
            await e.reply('『咕咕牛🐂』重置成功！');
        } catch (error) {
            console.error('重置『咕咕牛🐂』时出现错误:', error);
    
            const errMsg = [`重置『咕咕牛🐂』时出现错误:\n${error.message}`];
            const forwardMsg = await common.makeForwardMsg(this.e, errMsg, '『咕咕牛🐂』重置失败');
    
            await e.reply('『咕咕牛🐂』重置失败，请查看控制台日志！', true);
    
            setTimeout(async () => {
                await e.reply(forwardMsg);
            }, 2000);
        }
    }
    


    async CheckFolder(e) {
        const gitPath = this.GitPath;
        const characterFolderPaths = [
            { name: '原神', path: `${this.localPath}/gs-character` },
            { name: '星铁', path: `${this.localPath}/sr-character` },
            { name: '绝区零', path: `${this.localPath}/zzz-character` },
            { name: '鸣潮', path: `${this.localPath}/waves-character` }
        ];
    
        if (!fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }
    
        const CheckRoleforward = [];
        let totalRoles = 0, totalImages = 0;
        let sizeMap = {};
        let imageCountMap = { 原神: 0, 星铁: 0, 绝区零: 0, 鸣潮: 0 };
    
        const formatBytes = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024, dm = 2;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };
    
        for (const { name, path: folderPath } of characterFolderPaths) {
            if (!fs.existsSync(folderPath)) continue;
    
            const subFolders = fs.readdirSync(folderPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name)
                .sort((a, b) => a.localeCompare(b, 'zh', { sensitivity: 'base' }));
    
            totalRoles += subFolders.length;
    
            let folderMsg = `------${name}------\n`;
            for (const sub of subFolders) {
                const panelImages = fs.readdirSync(`${folderPath}/${sub}`).filter(f => f.endsWith('.webp'));
                const imgCount = panelImages.length;
    
                totalImages += imgCount;
                imageCountMap[name] += imgCount;
                folderMsg += `${sub}：${imgCount}张\n`;
            }
    
            CheckRoleforward.push(folderMsg);
            sizeMap[name] = await this.getFolderSize(folderPath);
        }
    
        const totalSize = Object.values(sizeMap).reduce((a, b) => a + b, 0);
        const gitSize = await this.getFolderSize(gitPath);
    
        const checkmessage =
            `----『咕咕牛🐂』----\n` +
            `角色数量：${totalRoles}名\n` +
            `图片数量：${totalImages}张\n` +
            `  |_原   神：${imageCountMap.原神}张\n` +  
            `  |_星   铁：${imageCountMap.星铁}张\n` +  
            `  |_绝区零：${imageCountMap.绝区零}张\n` +  
            `  |_鸣   潮：${imageCountMap.鸣潮}张\n\n` +
            `图库容量：${formatBytes(totalSize)}\n` +
            `  |_原   神：${formatBytes(sizeMap.原神 || 0)}\n` +
            `  |_星   铁：${formatBytes(sizeMap.星铁 || 0)}\n` +
            `  |_绝区零：${formatBytes(sizeMap.绝区零 || 0)}\n` +
            `  |_鸣   潮：${formatBytes(sizeMap.鸣潮 || 0)}\n` +
            `Git 缓存：${formatBytes(gitSize)}\n` +
            `总占用：${formatBytes(totalSize * 2 + gitSize)}`;
    
        const forwardMsg = await common.makeForwardMsg(this.e, CheckRoleforward, '『咕咕牛🐂』图库详情');
    
        await Promise.all([
            e.reply(checkmessage),
            e.reply([forwardMsg])
        ]);
    }
    

    async MihoyoSplashOption(e) {
        if (e.msg == '#启用官方立绘') {
            await this.CopySplashWebp(this.SRaliasPath, this.characterPath);
            await this.CopySplashWebp(this.GSaliasPath, this.characterPath);
            return e.reply('官方立绘已经启用了',true);
        }else  if (e.msg == '#禁用官方立绘') {
            await this.DeleteGuSplashWebp(this.characterPath);
            return e.reply('官方立绘已经禁用了',true);
        }
    } 

    async DeleteBanList() {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        try {
            const content = await fs.promises.readFile(banListPath, 'utf8');
            const bannedFiles = content.split(';').map(name => name.trim()).filter(Boolean);
    
            const deleteMatchingFiles = async (dir) => {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await deleteMatchingFiles(fullPath);
                    } else if (bannedFiles.includes(entry.name)) {
                        await fs.promises.unlink(fullPath);
                    }
                }
            };
    
            await deleteMatchingFiles(this.characterPath);
            await deleteMatchingFiles(this.ZZZcharacterPath);
            await deleteMatchingFiles(this.WAVEScharacterPath);
    
            console.log('『咕咕牛🐂』封禁列表中的文件已删除');
        } catch (error) {
            console.error('删除文件时出现错误:', error);
        }
    }
    
    async DeleteFilesWithGuKeyword() {

        const foldersToCheck = [this.characterPath, this.ZZZcharacterPath, this.WAVEScharacterPath];
    
        for (const basePath of foldersToCheck) {
            if (!fs.existsSync(basePath)) continue;  
    
            const folders = await fs.promises.readdir(basePath);
    
                for (const folder of folders) {
                    const folderPath = path.join(basePath, folder);
                    const stat = await fs.promises.lstat(folderPath);
                    if (!stat.isDirectory()) continue;
    
                    const files = await fs.promises.readdir(folderPath);
                    const toDelete = files.filter(file => file.includes('Gu') && !file.endsWith('.db'));
    
                    await Promise.all(toDelete.map(async file => {
                        const filePath = path.join(folderPath, file);
                        try {
                            await fs.promises.unlink(filePath);
                            console.log(`已删除：${filePath}`);
                        } catch (err) {
                            console.warn(`删除失败：${filePath} - ${err.message}`);
                        }
                    }));
                }
    
           
        }
    }
    
    
    
    async CopySplashWebp(sourceDir, targetDir) {
        const folders = await fs.promises.readdir(sourceDir, { withFileTypes: true });
        for (const folder of folders) {
            if (!folder.isDirectory() || folder.name === 'common') continue;
            const folderPath = path.join(sourceDir, folder.name);
            const splashPath = path.join(folderPath, 'imgs', 'splash.webp');
            const targetFolderPath = path.join(targetDir, folder.name);
            const targetSplashPath = path.join(targetFolderPath, 'Gusplash.webp');
            await fs.promises.mkdir(targetFolderPath, { recursive: true });
            await fs.promises.copyFile(splashPath, targetSplashPath);
           //------刷屏点----/console.log(`已复制 ${splashPath} 到 ${targetSplashPath}`);
        }
    }
    
    async DeleteGuSplashWebp(directory) {
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await this.DeleteGuSplashWebp(entryPath);
            } else if (entry.isFile() && entry.name === 'Gusplash.webp') {
                await fs.promises.unlink(entryPath);
               //------刷屏点----/console.log(`已删除 ${entryPath}`);
            }
        }
    }

    async getFolderSize(folderPath) {
        let totalSize = 0;
        const files = await fs.promises.readdir(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) {
                totalSize += await this.getFolderSize(filePath); 
            } else {
                totalSize += stats.size;
            }
        }
        return totalSize;
    }


    async copyCharacterFolders() {
        const paths = [
            { source: this.GScopylocalPath, destination: this.characterPath },
            { source: this.SRcopylocalPath, destination: this.characterPath },
            { source: this.ZZZcopylocalPath, destination: this.ZZZcharacterPath },
            { source: this.WAVEScopylocalPath, destination: this.WAVEScharacterPath }
        ];
    
        for (const { source, destination } of paths) {
            await this.CopyFolderRecursive(source, destination);
        }
    
        this.DeleteBanList();
    }
    

    async CopyFolderRecursive(source, target) {
        const targetExists = await fs.promises.access(target)
            .then(() => true)
            .catch(() => false);
    
        if (!targetExists) {
            await fs.promises.mkdir(target, { recursive: true });
        }
            const files = await fs.promises.readdir(source);
            await Promise.all(files.map(async (file) => {
            const curSource = path.join(source, file);
            const curDest = path.join(target, file);
            const stat = await fs.promises.lstat(curSource);
    
            if (stat.isDirectory()) {
                await this.CopyFolderRecursive(curSource, curDest);
            } else {
                await fs.promises.copyFile(curSource, curDest);
               //------刷屏点----/ console.log(`已复制文件: ${curSource} -> ${curDest}`);
            }
        }));
       //------刷屏点----/ console.log(`文件夹 ${source} 复制到 ${target} 完成`);
    }

    
    generateDownloadErrorFeedback(error) {
        const errorMessages = {
            'code 128': "检查网络连接：确保您的网络连接正常，有时候网络问题可能导致 Git 无法正常执行操作。",
            'code 128': "也是可能本地已存在图库,JS无法识别到，可以尝试重置咕咕牛。",
            'code 28': "增加 Git 的 HTTP 缓冲区大小，在控制台输入命令：git config --global http.postBuffer 524288000",
            '443': "可能是网络问题、被墙或访问被拒绝。",
            'code 1': "Git 操作失败，可能是本地与远程仓库冲突、权限问题或锁文件问题。请检查并解决冲突或确保文件没有被锁定。",
            'Please commit your changes or stash them before you merge.': "本地文件冲突了~",
            'fatal: not a git repository (or any of the parent directories): .git': "当前目录不是 Git 仓库，确保路径正确，或者重新克隆仓库。",
            'fatal: You have not concluded your merge (MERGE_HEAD exists).': "合并操作未完成，请使用 'git merge --abort' 来取消当前合并。",
            'fatal: unable to access': "无法访问远程仓库，可能是网络问题或者远程地址不可达。",
            'fatal: remote origin already exists.': "远程仓库地址已经存在，可以尝试更新远程仓库地址。",
            'error: Your local changes to the following files would be overwritten by merge:': "本地文件有未提交的更改，执行 'git stash' 或 'git commit' 提交本地更改。",
            'fatal: Failed to resolve': "Git 无法找到当前仓库的 HEAD，可能仓库不完整，尝试 'git fsck' 来修复。",
            'fatal: could not open index.lock': "Git 正在进行操作时，另一个操作锁住了文件，可以删除 '.git/index.lock' 文件再试。",
        };
    
        let feedback = [`下载『咕咕牛🐂』时出现错误: ${error}`];
        Object.keys(errorMessages).forEach(code => {
            if (error.message.includes(code)) {
                feedback.push(errorMessages[code]);
            }
        });
        return feedback;
    }

   getMainRoleName(roleName) {
    
    const parseAliasFromJS = (filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const match = content.match(/{[^{}]*}/);
            if (!match) return {};
            return eval('(' + match[0] + ')');
        } catch (err) {
            console.warn(`⚠️ 解析别名JS失败: ${filePath} - ${err.message}`);
            return {};
        }
    };

    const parseAliasFromYAML = (filePath) => {
        try {
            if (!fs.existsSync(filePath)) return {};
            const content = fs.readFileSync(filePath, 'utf-8');
            return yaml.parse(content);
        } catch (err) {
            console.warn(`⚠️ 解析别名YAML失败: ${filePath} - ${err.message}`);
            return {};
        }
    };

    const aliasGS = parseAliasFromJS(path.resolve(this.GSaliasPath, 'alias.js'));
    const aliasSR = parseAliasFromJS(path.resolve(this.SRaliasPath, 'alias.js'));
    const aliasZZZ = parseAliasFromYAML(path.resolve(this.ZZZaliasPath, 'alias.yaml'));
    const aliasWAVES = parseAliasFromYAML(path.resolve(this.WAVESaliasPath, 'role.yaml'));

    const findMainName = (aliasMap, isStringList = true) => {
        return Object.keys(aliasMap).find(main => {
            const aliases = aliasMap[main];
            const aliasArray = isStringList ? aliases.split(',') : aliases;
            return aliasArray.includes(roleName);
        });
    };

    const mainName = 
        findMainName(aliasGS) ||
        findMainName(aliasSR) ||
        findMainName(aliasZZZ, false) ||
        findMainName(aliasWAVES, false);

    return mainName ? mainName.trim() : roleName;
    }


      
}


const R18_images = [
"艾梅莉埃Gu2","芭芭拉Gu1","芭芭拉Gu4","芭芭拉Gu5","芭芭拉Gu8","北斗Gu2","北斗Gu3","北斗Gu4",
"北斗Gu6","迪奥娜Gu5","迪希雅Gu2","迪希雅Gu6","迪希雅Gu7","珐露珊Gu1","菲谢尔Gu6","甘雨Gu1","甘雨Gu4",
"甘雨Gu5","甘雨Gu6","甘雨Gu13","甘雨Gu22","胡桃Gu9","胡桃Gu32","胡桃Gu36","胡桃Gu43","胡桃Gu31",
"久岐忍Gu6","久岐忍Gu7","坎蒂丝Gu1","坎蒂丝Gu4","克洛琳德Gu5","克洛琳德Gu6","刻晴Gu1","刻晴Gu3",
"刻晴Gu5","刻晴Gu15","刻晴Gu17","刻晴Gu19","刻晴Gu20","刻晴Gu23","刻晴Gu24","刻晴Gu21","莱依拉Gu5",
"雷电将军Gu18","雷电将军Gu34","丽莎Gu2","丽莎Gu1","纳西妲Gu33","娜维娅Gu13","娜维娅Gu16","娜维娅Gu4",
"妮露Gu1","妮露Gu4","妮露Gu6","妮露Gu16","妮露Gu19","妮露Gu20","妮露Gu22","妮露Gu23","妮露Gu26",
"妮露Gu27","妮露Gu28","妮露Gu29","妮露Gu31","妮露Gu32","妮露Gu33","诺艾尔Gu10","诺艾尔Gu12","诺艾尔Gu6",
"诺艾尔Gu2","诺艾尔Gu3","七七Gu9","茜特菈莉Gu1","琴Gu4","琴Gu5","琴Gu3","珊瑚宫心海Gu5","珊瑚宫心海Gu12",
"珊瑚宫心海Gu34","珊瑚宫心海Gu35","珊瑚宫心海Gu36","珊瑚宫心海Gu9","申鹤Gu1","申鹤Gu9","申鹤Gu10",
"申鹤Gu3","申鹤Gu8","神里绫华Gu23","神里绫华Gu17","神里绫华Gu20","神里绫华Gu14","停云Gu5","停云Gu7",
"温迪Gu11","五郎Gu2","希格雯Gu7","夏沃蕾Gu3","闲云Gu7","香菱Gu1","宵宫Gu20","宵宫Gu17","魈Gu12",
"夜兰Gu23","夜兰Gu25","夜兰Gu7","夜兰Gu11","夜兰Gu13","夜兰Gu16","夜兰Gu12","夜兰Gu2","优菈Gu7",
"优菈Gu12","优菈Gu13","雷电将军Gu7","雷电将军Gu11","八重神子Gu3",

]


