import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';


//        『咕咕牛🐂』图库 下载器  v1.8
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
            name: '『咕咕牛🐂』图库下载器 v1.8',
            dsc: '『咕咕牛🐂』',
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
                    fnc: 'GuHelp',
                },
                {
                    reg: /^#重置咕咕牛$/,
                    fnc: 'restartGu',
                    permission: "master"
                },
                {
                    reg: /^#检查咕咕牛$/,
                    fnc: 'CheckFolderGu',
                },
                {     
                    reg: /^#清理咕咕牛缓存$/,
                    fnc: 'cleanGitPackCache',
                    permission: "master"
                }
            ]
        });
        const currentFileUrl = import.meta.url;
        const currentFilePath = fileURLToPath(currentFileUrl);
        this.mirror = 'https://mirror.ghproxy.com/';
        this.repositoryUrl = 'https://github.com/GuGuNiu/Miao-Plugin-MBT/';
        this.localPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/');
        this.GitPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/.git/');
        this.copylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/normal-character/');
        this.characterPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/profile/normal-character/');
    }
    async GuHelp(e) {
        e.reply("🔶安装图库：#(代理)下载咕咕牛\n💠更新图库：#更新咕咕牛\n🔶操作图库：#启/禁用咕咕牛\n💠图库查看：#检查咕咕牛\n🔶异常修复：#重置咕咕牛\n💠删除图库：#删除咕咕牛\n\n无法更新请先重置后下载")
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
