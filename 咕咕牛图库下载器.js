import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';
//import puppeteer from '../../lib/puppeteer/puppeteer.js'



//           『咕咕牛🐂』图库管理器 v2.0
//        Github仓库地址：https://github.com/GuGuNiu/Miao-Plugin-MBT/


function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
export class MiaoPluginMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』图库管理器 v2.0',
            dsc: '『咕咕牛🐂』图库管理器',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: /^#(代理)?下载咕咕牛$/,
                    fnc: 'GallaryGudownload',
                    permission: "master"
                },
                {
                    reg: /^#(强制)?更新咕咕牛$/,
                    fnc: 'GallaryGuupdate',
                    permission: "master"
                },
                {
                    reg: /^#删除咕咕牛$/,
                    fnc: 'deleteGallaryGu',
                    permission: "master"
                },
                {
                    reg: /^#(启用|禁用)咕咕牛$/,
                    fnc: 'GalleryoptionGu',
                    permission: "master"
                },
                {
                    reg: /^#咕咕牛帮助$/,
                    fnc: 'GuHelp'
                },
                {
                    reg: /^#重置咕咕牛$/,
                    fnc: 'restartGu',
                    permission: "master"
                },
                {
                    reg: /^#检查咕咕牛$/,
                    fnc: 'CheckFolderGu'
                },
                {     
                    reg: /^#清理咕咕牛缓存$/,
                    fnc: 'cleanGitPackCache',
                    permission: "master"
                },                
                {     
                    reg: /^#查看(.*)$/,
                    fnc: 'FindRoleFolder'
                },
                {     
                    reg: /^#ban(.*)$/,
                    fnc: 'BanRole',
                    permission: "master"
                },
                {     
                    reg: /^#咕咕牛$/,
                    fnc: 'GuGuNiu',
                }
            ]
            
        })
        this.task = {
                cron: '0 12 * * 1',
                fnc: () => this.executeTask(),
                log: true
        }
        const currentFileUrl = import.meta.url;
        const currentFilePath = fileURLToPath(currentFileUrl);
        this.mirror = 'https://mirror.ghproxy.com/';
        this.repositoryUrl = 'https://github.com/GuGuNiu/Miao-Plugin-MBT/';
        this.localPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/');
        this.GitPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/.git/');
        this.copylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/normal-character/');
        this.characterPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/profile/normal-character/');
        this.GSaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/meta-gs/character/');
        this.SRaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/meta-sr/character/');
    }
    async GuHelp(e) {
        e.reply(segment.image("/resources/GuGuNiu-Gallery/help.png"))
    }
    async BanRole(e){
        
    }
    async FindRoleFolder(e) {
        if (!fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
            return true;
         }
        const match = e.msg.match(/^#查看(.+)$/);
        if (!match) {
           // await e.reply('请输入正确的命令格式，例如：#查看花火', true);
            return true;
        }
        let roleName = match[1].trim(); 
        let aliasSR;
            const aliasSRFilePath = path.resolve(this.SRaliasPath, 'alias.js');
            const aliasSRContent = fs.readFileSync(aliasSRFilePath, 'utf-8');
            const aliasRegexSR = /{[^{}]*}/;
            const aliasJSONSR = aliasSRContent.match(aliasRegexSR)[0];
            aliasSR = eval('(' + aliasJSONSR + ')');  
        let aliasGS;
            const aliasGSFilePath = path.resolve(this.GSaliasPath, 'alias.js');
            const aliasGSContent = fs.readFileSync(aliasGSFilePath, 'utf-8');
            const aliasRegexGS = /{[^{}]*}/;
            const aliasJSONGS = aliasGSContent.match(aliasRegexGS)[0];
            aliasGS = eval('(' + aliasJSONGS + ')'); 
        let mainNameSR = Object.keys(aliasSR).find(main => {
            const aliases = aliasSR[main].split(',');
            return aliases.includes(roleName);
        });
        let mainNameGS = Object.keys(aliasGS).find(main => {
            const aliases = aliasGS[main].split(',');
            return aliases.includes(roleName);
        });
        if (mainNameSR) {
            roleName = mainNameSR.trim();
        } else if (mainNameGS) {
            roleName = mainNameGS.trim();
        }
        let roleFolderPath;
        const folders = fs.readdirSync(this.copylocalPath);
        const matchedFolder = folders.find(folder => folder.includes(roleName));
        if (!matchedFolder) {
            await e.reply(`未找到角色『${roleName}』`);
            return true;
        }
        roleFolderPath = path.join(this.copylocalPath, matchedFolder);
        const files = fs.readdirSync(roleFolderPath)
            .filter(file => /\.webp$/.test(file))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)[0]);
                const numB = parseInt(b.match(/\d+/)[0]);
                return numA - numB;
            });
        if (files.length === 0) {
            await e.reply(`『${matchedFolder}』文件夹下没有图片文件`, true);
            return true;
        }
        let checkrolename = `当前查看『${matchedFolder}』，有${files.length}张`;
        let RoleWebpPhotoList = []
        RoleWebpPhotoList.push([`当前查看『${matchedFolder}』，有${files.length}张`]);
        for (let i = 0; i < files.length; i++) {
            const filePath = path.join(roleFolderPath, files[i]);
            RoleWebpPhotoList.push([`${i + 1}、${files[i]}`, segment.image(`file://${filePath}`)])
        }
        try {
            let RoleFindsuccessmsg = await common.makeForwardMsg(this.e, RoleWebpPhotoList, checkrolename)
            await e.reply(RoleFindsuccessmsg)
            if (!RoleFindsuccessmsg) e.reply('风控了，可私聊查看', true);
        } catch (err) {
            console.error(err);
            await e.reply(`发送 ${matchedFolder} 的列表时出现错误,请查看控制台日志`);
        }
    } 
    async executeTask() {
        try {
            console.log("[定时任务]：开始更新『咕咕牛🐂』图库");
            await this.GallaryGuupdate({ reply: () => {} });
            console.log("[定时任务]：『咕咕牛🐂』图库更新完毕");
        } catch (error) {
            console.error("[定时任务]：『咕咕牛🐂』图库更新失败", error);
        }
    }
    async GallaryGudownload(e) {
        let downloadUrl;
        if (e.msg == '#下载咕咕牛') {
            downloadUrl = this.repositoryUrl;
        } else if (e.msg == '#代理下载咕咕牛') {
            downloadUrl = this.mirror + this.repositoryUrl;
        }
        await e.reply('『咕咕牛🐂』正在下载中，大约需要5-15分钟，请稍候...', true);
        if (fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』已存在，请勿重复下载！如有异常请手动执行 #重置咕咕牛');
            return;
        }
        try {
            await new Promise((resolve, reject) => {
                const process = exec(`git clone --depth=1 ${downloadUrl} ${this.localPath}`, { stdio: 'inherit' });
                process.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`git clone failed with code ${code}`));
                    }
                });
            });
            this.copyFolderRecursiveSync(this.copylocalPath, this.characterPath);
            await e.reply(`『咕咕牛』已下载完成，正在载入喵喵插件中...`);
            setTimeout(async () => {
                return e.reply(`『咕咕牛』已成功进入了喵喵里面！`);
            }, 10000);
        } catch (error) {
            console.error('下载『咕咕牛🐂』时出现错误:', error);
            let DowloadeErrorForward =[]
            DowloadeErrorForward.push(`下载『咕咕牛🐂』时出现错误:\n ${error}`);
            if (error.message.includes('code 128')) {
                DowloadeErrorForward.push("检查网络连接：确保您的网络连接正常,有时候网络问题可能导致Git无法正常执行操作。");
             }
            let DownloadErrorGumsg = await common.makeForwardMsg(this.e, DowloadeErrorForward, '『咕咕牛🐂』操作日志');
            await e.reply('下载『咕咕牛』时出现错误，请查看控制台日志！');
            setTimeout(async () => {
                this.reply(DownloadErrorGumsg);
            }, 2000);
        }
    }
    async GalleryoptionGu(e){
        try {
        if (e.msg == '#启用咕咕牛') {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
                return;
             }
                await e.reply('『咕咕牛🐂』手动启用中,请稍后.....',true);
                this.copyFolderRecursiveSync(this.copylocalPath, this.characterPath);
                await e.reply('『咕咕牛』重新进入了喵喵里面！');
        }else if (e.msg == '#禁用咕咕牛') {
                await e.reply('『咕咕牛🐂』手动禁用中,请稍后.....',true);
                await this.deleteFilesWithGuKeyword();
                await e.reply('『咕咕牛』已成功离开喵喵里面！');
        }}catch (error) {
            console.error('『咕咕牛🐂』操作出现错误:', error);
            let GalleryoptionGuforward = []
                GalleryoptionGuforward.push(`更新『咕咕牛🐂』时出现错误:\n ${error}`);
            let GalleryoptionGumsg = await common.makeForwardMsg(this.e, GalleryoptionGuforward, '『咕咕牛🐂』操作日志');
            await e.reply('『咕咕牛』操作出现错误，请查看日志！');
            setTimeout(async () => {
                this.reply(GalleryoptionGumsg);
            }, 2000);
        }
    }
    async deleteGallaryGu(e){
        await e.reply('『咕咕牛🐂』完全删除中,请稍后.....',true);
        await this.deleteFilesWithGuKeyword();
        if (!fs.existsSync(this.localPath)) {
            return e.reply('『咕咕牛』已离开你的崽崽了,感谢使用，再会！');
        }
        await fs.promises.rm(this.localPath, { recursive: true });
        console.log('『咕咕牛🐂』图库删除成功！');
        return e.reply('『咕咕牛』已离开你的崽崽了,感谢使用，再会！！');
    }
    async deleteFilesWithGuKeyword() {
        const normalCharacterPath = this.characterPath;
        try {
          const folders = await fs.promises.readdir(normalCharacterPath);
          await Promise.all(folders.map(async (folder) => {
            const folderPath = path.join(normalCharacterPath, folder);
            const files = await fs.promises.readdir(folderPath);
            const deletePromises = files
              .filter(file => file.includes('Gu'))
              .map(file => fs.promises.unlink(path.join(folderPath, file)));
            await Promise.all(deletePromises);
          }));
          console.log('『咕咕牛🐂』删除成功');
        } catch (err) {
          console.error('『咕咕牛🐂』删除失败:', err);
        }
      }
      async GallaryGuupdate(e) {
        try {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
                return;
            }
            await e.reply('『咕咕牛🐂』正在更新中，请稍候...', true);
            const gitPullOutput = await new Promise((resolve, reject) => {
                exec('git pull', { cwd: this.localPath }, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            });
            if (gitPullOutput.includes('Already up to date')) {
                await e.reply("『咕咕牛』已经是最新的啦");
            } else {
                const gitLog = await new Promise((resolve, reject) => {
                    exec('git log -n 20 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"', { cwd: this.localPath }, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(stdout);
                        }
                    });
                });
                const forwardMsg = `最近的更新记录：\n${gitLog}`;
                const forwardMsgFormatted = await common.makeForwardMsg(this.e, forwardMsg, '『咕咕牛🐂』更新成功');
                await this.reply(forwardMsgFormatted);
                await this.deleteFilesWithGuKeyword();
                await new Promise((resolve, reject) => {
                    exec('git clean -df', { cwd: this.localPath }, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
                this.copyFolderRecursiveSync(this.copylocalPath, this.characterPath);
            }
        } catch (error) {
            console.error('更新『咕咕牛🐂』时出现错误:', error);
            let forward = [`更新『咕咕牛🐂』时出现错误:\n${error.message}`];
            
            if (error.message.includes('code 128')) {
                forward.push("检查网络连接：确保您的网络连接正常，有时候网络问题可能导致 Git 无法正常执行操作。");
            }
            if (error.message.includes('code 1')) {
                forward.push("该报错是本地与仓库文件冲突，请手动重置咕咕牛后再尝试下载。");
            }
            if (error.message.includes('443')) {
                forward.push("该报错可能是网络问题、被墙或访问被拒绝。");
            }
            if (error.message.includes('SSL')) {
                forward.push("该报错可能是网络问题、被墙或访问被拒绝。");
            }
            let updaterrormsg = await common.makeForwardMsg(this.e, forward, '『咕咕牛🐂』更新失败');
            await this.reply('更新『咕咕牛』时出现错误，请查看日志！');
            setTimeout(async () => {
                await this.reply(updaterrormsg);
             }, 2000);
        }
    }    
    async restartGu(e) {
        try {
            const directoryExists = fs.existsSync(this.localPath);
            if (!directoryExists) {
                await e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
                return;
            }
            await fs.promises.rm(this.localPath, { recursive: true });
            console.log('『咕咕牛🐂』重置成功！');
            return e.reply('『咕咕牛🐂』重置成功！');
        } catch (error) {
            console.error('重置『咕咕牛🐂』时出现错误:', error);
            let forward = [];
            forward.push(`重置『咕咕牛🐂』时出现错误:\n ${error.message}`);
            let restarterror = await common.makeForwardMsg(this.e, forward, '『咕咕牛🐂』重置失败');
            this.reply('『咕咕牛🐂』重置失败，请查看控制台日志！');
            setTimeout(async () => {
                this.reply(restarterror);
            }, 2000);
        }
    }    
    async CheckFolderGu(e) {
            const AllFolderNoramlCharacterPath = this.characterPath
            const gitPath = this.GitPath
            const characterFolderPath = path.resolve(this.localPath, 'normal-character');
            if (!fs.existsSync(characterFolderPath)) {
                await e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
                return;
            }
            const characterFolders = fs.readdirSync(characterFolderPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .sort((a, b) => a.localeCompare(b));    
            let totalCharacterCount = characterFolders.length;
            let forward = [];
            let message = [];
            forward.push("---按A-Z字母排序---")
            let totalPanelImageCount = 0;
            for (const folder of characterFolders) {
                const folderPath = path.resolve(characterFolderPath, folder);
                const panelImages = fs.readdirSync(folderPath).filter(file => file.endsWith('.webp'));
                totalPanelImageCount += panelImages.length;
                const name = `${folder}：${panelImages.length}张`;
                forward.push(name);
            }
            const totalSize = await this.getFolderSize(characterFolderPath);
            const formattedTotalSize = formatBytes(totalSize);
            const gitSize = await this.getFolderSize(gitPath);
            const gitAllSize = formatBytes(gitSize);
            const AllFolderNoramlCharacter = await this.getFolderSize(AllFolderNoramlCharacterPath);
            const AllFolderNoramlCharacterSize = formatBytes(AllFolderNoramlCharacter);
            const MBTSize = formatBytes(gitSize + totalSize)
            const YouadnmeSize = formatBytes(totalSize + gitSize + AllFolderNoramlCharacter)
            let checkmessage = `----『咕咕牛🐂』----\n角色数量：${totalCharacterCount}名\n图片数量：${totalPanelImageCount}张\n图库容量：${formattedTotalSize}\nGit缓存容量：${gitAllSize}\n咕咕牛图库占用：${MBTSize}\n-----------------------\n你的面板图文件夹总占用：\n${AllFolderNoramlCharacterSize}\n『你的』 + 『我的』占用：\n${YouadnmeSize}\n-----------------------\n\n如缓存过大,可用#清理咕咕牛缓存`;
            forward.forEach(item => {
                message += `${item}\n`;
            });
            await Promise.all([
                e.reply(checkmessage),
                (async () => {
                    const msg = await common.makeForwardMsg(this.e, message, '『咕咕牛🐂』图库数量');
                    this.reply(msg);
                })()
            ]);
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
    async GuGuNiu(e){
        e.reply("🐂")
    }
    async cleanGitPackCache(e) {
        const gitPackFolderPath = path.join(this.localPath, '.git', 'objects', 'pack');
        try {
            const stats = await fs.promises.stat(gitPackFolderPath);
            if (!stats.isDirectory()) {
                return e.reply('『咕咕牛🐂』尚未下载，请先执行 #下载咕咕牛 进行下载！', true);
            }
            const files = await fs.promises.readdir(gitPackFolderPath);
            await Promise.all(files.map(async file => {
                const filePath = path.join(gitPackFolderPath, file);
                await fs.promises.unlink(filePath);
                console.log(`已删除：${filePath}`);
            }));
            return e.reply('清理缓存成功！');
        } catch (error) {
            console.error('清理缓存失败:', error);
            return e.reply('清理缓存失败，请查看控制台日志！');
        }
    }
    copyFolderRecursiveSync(source, target) {
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
        const files = fs.readdirSync(source);
        files.forEach((file) => {
            const curSource = path.join(source, file);
            const curDest = path.join(target, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                this.copyFolderRecursiveSync(curSource, curDest);
            } else {
                fs.copyFileSync(curSource, curDest);
            }
        });
    }
}
