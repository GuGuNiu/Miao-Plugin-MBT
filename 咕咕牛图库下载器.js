import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';
import yaml from 'yaml'






//        『咕咕牛🐂』图库管理器 v3.0
//        Github仓库地址：https://github.com/GuGuNiu/Miao-Plugin-MBT/






function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
export class MiaoPluginMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』图库管理器 v3.0',
            dsc: '『咕咕牛🐂』图库管理器',
            event: 'message',
            priority: 1000,
            rule: [
                {
                    reg: /^#(代理)?下载咕咕牛$/,
                    fnc: 'GallaryDownload'
                },
                {
                    reg: /^#(强制)?更新咕咕牛$/,
                    fnc: 'GallaryUpdate'
                },
                {
                    reg: /^#删除咕咕牛$/,
                    fnc: 'DeleteGallary',
                    permission: "master"
                },
                {
                    reg: /^#(启用|禁用)咕咕牛$/,
                    fnc: 'GalleryOption',
                    permission: "master"
                },
                {
                    reg: /^#(启用|禁用)官方立绘$/,
                    fnc: 'MihoyoSplashOption',
                    permission: "master"
                },
                {
                    reg: /^#咕咕牛帮助$/,
                    fnc: 'GuHelp'
                },
                {
                    reg: /^#重置咕咕牛$/,
                    fnc: 'RestartGuGuNiu',
                    permission: "master"
                },
                {
                    reg: /^#检查咕咕牛$/,
                    fnc: 'CheckFolder'
                },           
                {     
                    reg: /^#查看(.*)$/,
                    fnc: 'FindRoleSplash'
                },
                {     
                    reg: /^#ban(加|删)(.*)$/,
                    fnc: 'BanRole',
                    permission: "master"
                },
                {     
                    reg: /^#ban列表$/,
                    fnc: 'BanRolelist',
                },
                {     
                    reg: /^#(确认)?净化咕咕牛$/,
                    fnc: 'RemoveBadimages',
                },
                {     
                    reg: /^#咕咕牛$/,
                    fnc: 'GuGuNiu',
                },
                {     
                    reg: /^#清理咕咕牛缓存$/,
                    fnc: 'CC',
                },
                {     
                    reg: /^#清空咕咕牛封禁$/,
                    fnc: 'GOODBYEGUGUNIU',
                }
            ]
        })
        this.task = {
            name: '『咕咕牛🐂』定时更新任务',
            cron: '0 5 */15 * *',
            fnc: () => this.executeTask(),
            log: false
        }
        const currentFileUrl = import.meta.url;
        const currentFilePath = fileURLToPath(currentFileUrl);
        this.proxy = 'https://ghfast.top/';  
        this.proxy2 = 'https://ghp.ci/';  
        this.proxy3 = 'https://ghgo.xyz/';  
        this.proxy4 = 'https://ghproxy.com/';  
        this.repositoryUrl = 'https://github.com/GuGuNiu/Miao-Plugin-MBT/';
        
        this.localPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/');
        this.GitPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/.git/');

        //载入路径
        this.characterPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/profile/normal-character/');
        this.ZZZcharacterPath = path.resolve(path.dirname(currentFilePath), '../../plugins/ZZZ-Plugin/resources/images/panel/'); 
        this.WAVEScharacterPath = path.resolve(path.dirname(currentFilePath), '../../plugins/waves-plugin/resources/rolePic/'); 

        //图库路径
        this.SRcopylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/sr-character/');
        this.GScopylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/gs-character/');
        this.ZZZcopylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/zzz-character/'); 
        this.WAVEScopylocalPath = path.resolve(path.dirname(currentFilePath), '../../resources/Miao-Plugin-MBT/waves-character/');

        //别名路径
        this.GSaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/meta-gs/character/');
        this.SRaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/miao-plugin/resources/meta-sr/character/');
        this.ZZZaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/ZZZ-Plugin/defset/');  
        this.WAVESaliasPath = path.resolve(path.dirname(currentFilePath), '../../plugins/waves-plugin/resources/Alias/');  

        this.GuPath = path.resolve(path.dirname(currentFilePath), '../../resources/GuGuNiu-Gallery/');
        this.JsPath = path.resolve(path.dirname(currentFilePath), '../../plugins/example/');

     }

     async GallaryDownload(e) {
        e.reply('『咕咕牛』开始下载了');
        const A = "Github";  
        const B = "Ghproxy1";    
        const C = "Ghproxy2";    
        const D = "Ghproxy3";  
        const E = "Ghproxy4";       
        
        const urls = {
            [A]: this.repositoryUrl,
            [B]: this.proxy + this.repositoryUrl,
            [C]: this.proxy2 + this.repositoryUrl,
            [D]: this.proxy3 + this.repositoryUrl,
            [E]: this.proxy4 + this.repositoryUrl
        };
        let DownloadSource = A;
    
        const tryDownload = async (sourceName) => {
            const url = urls[sourceName];
            return new Promise((resolve, reject) => {
                const process = exec(`git clone --depth=1 ${url} ${this.localPath}`, { stdio: 'inherit' });
                process.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(`git clone failed with code ${code}`));
                    }
                });
            });
        };
    
        try {
            await tryDownload(A);
            await e.reply(`『咕咕牛』下载成功, 来源：${A}\n正在准备进行下一步操作...`);
            await this.PostDownload(e);
    
        } catch (error) {
            await e.reply('『咕咕牛』的Github仓库下载失败，已自动切换至代理下载中,请稍后....', true);
    
            let proxyError;
            for (let sourceName of [B, C, D, E]) {
                try {
                    await tryDownload(sourceName);  
                    DownloadSource = sourceName;
                    await e.reply(`『咕咕牛』代理下载成功, 来源：${sourceName}\n正在准备进行下一步操作...`);
                    await this.PostDownload(e);
                    break;
                } catch (error) {
                    proxyError = error;
                    if (sourceName === C) {     
                        let DowloadeErrorForward = this.generateDownloadErrorFeedback(proxyError);
                        await e.reply('『咕咕牛』 代理下载失败，请查看控制台日志！');
                        let DownloadErrorGumsg = await common.makeForwardMsg(this.e, DowloadeErrorForward, '『咕咕牛🐂』操作日志');
                        setTimeout(async () => {
                            this.reply(DownloadErrorGumsg);
                        }, 2000);
                        return;
                    }
                }
            }
        }
    }
    
    

    async PostDownload(e) {

        await this.CopyFolderRecursive(this.SRcopylocalPath, this.characterPath);
        await this.CopyFolderRecursive(this.GScopylocalPath, this.characterPath)
        await this.CopyFolderRecursive(this.ZZZcopylocalPath, this.ZZZcharacterPath);
        await this.CopyFolderRecursive(this.WAVEScopylocalPath, this.WAVEScharacterPath);

        await e.reply(`『咕咕牛』正在咕咕噜的载入喵喵中...`);

        fs.mkdirSync(this.GuPath, { recursive: true });
        this.CopyFolderRecursive(path.join(this.localPath, 'GuGuNiu-Gallery'), this.GuPath);

        setTimeout(async () => {
            await e.reply(`『咕咕牛』成功进入喵喵里面！每隔15天自动更新，包括Js。`);
        }, 20000);

        this.DeleteBanList();
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
            const gitPullOutput = await new Promise((resolve, reject) => {
                exec('git pull', { cwd: this.localPath }, (error, stdout, stderr) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(stdout);
                    }
                });
            });
            if (/Already up[ -]to[ -]date/.test(gitPullOutput)) {
                await e.reply("『咕咕牛』已经是最新的啦");
                const gitLog = await new Promise((resolve, reject) => {
                    exec('git log -n 1 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"', { cwd: this.localPath }, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(stdout);
                        }
                    });
                });
                await e.reply(`最近一次更新：${gitLog}`);
            }else {
                const gitLog = await new Promise((resolve, reject) => {
                    exec('git log -n 20 --date=format:"[%m-%d %H:%M:%S]" --pretty=format:"%cd %s"', { cwd: this.localPath }, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(stdout);
                        }
                    });
                });
                const forwardMsg = [ `最近的更新记录：\n${gitLog}` ];
                const forwardMsgFormatted = await common.makeForwardMsg(this.e, forwardMsg, '『咕咕牛🐂』更新成功');
                await this.reply(forwardMsgFormatted);
                await this.DeleteFilesWithGuKeyword();
                await new Promise((resolve, reject) => {
                    exec('git clean -df', { cwd: this.localPath }, (error, stdout, stderr) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve();
                        }
                    });
                });
                const banListPath = path.join(this.GuPath, 'banlist.txt');
                let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');

                const galleryConfigPath = path.join(this.GuPath, 'GalleryConfig.yaml');
                const galleryConfigContent = fs.readFileSync(galleryConfigPath, 'utf8');
                const galleryConfig = yaml.parse(galleryConfigContent);

                if (galleryConfig && galleryConfig['GGOP'] === 1) {
                     this.CopyFolderRecursive(this.GSpylocalPath, this.characterPath);
                     this.CopyFolderRecursive(this.SRopylocalPath, this.characterPath);
                     this.CopyFolderRecursive(this.ZZZcopylocalPath, this.ZZZcharacterPath);
                     this.CopyFolderRecursive(this.WAVEScopylocalPath, this.WAVEScharacterPath);
                }

                fs.mkdirSync(this.GuPath, { recursive: true });
                const sourceFile = path.join(this.localPath, 'GuGuNiu-Gallery', 'help.png');
                const destFile = path.join(this.GuPath, 'help.png');
                await fs.promises.copyFile(sourceFile, destFile);

                const sourceJSFile = path.join(this.localPath, '咕咕牛图库下载器.js');
                const destJSFile = path.join(this.JsPath, '咕咕牛图库下载器.js');
                await fs.promises.copyFile(sourceJSFile, destJSFile);

                if (galleryConfig && galleryConfig['Px18img-type'] === 0) {
                    R18_images.forEach(image => {
                        const fileName = `${image}.webp`;
                        if (!banList.includes(fileName)) {
                            banList.push(fileName);
                        }
                    });
                    fs.writeFileSync(banListPath, `${banList.join(';')};`, 'utf8')
                }

                this.DeleteBanList()
            }
        } catch (error) {
            console.error('更新『咕咕牛🐂』时出现错误:', error);
            let updateerrorforward = [`更新『咕咕牛🐂』时出现错误:\n${error.message}`];  
            if (error.message.includes('code 128')) {
                updateerrorforward.push("检查网络连接：确保您的网络连接正常，有时候网络问题可能导致 Git 无法正常执行操作。");
                updateerrorforward.push("也可能出现合并失败，可以尝试重置咕咕牛");
            }
            if (error.message.includes('code 1')) {
                updateerrorforward.push("该报错是本地与仓库文件冲突，请手动重置咕咕牛后再尝试下载。");
            }
            if (error.message.includes('code 28')) {
                updateerrorforward.push("试着增加 Git 的 HTTP 缓冲区大小，这样可以帮助处理较大的数据传输在控制台输入以下命令");
                updateerrorforward.push("git config --global http.postBuffer 524288000");
            }
            if (error.message.includes('443')) {
                updateerrorforward.push("该报错可能是网络问题、被墙或访问被拒绝。");
            }
            let updaterrormsg = await common.makeForwardMsg(this.e, updateerrorforward, '『咕咕牛🐂』更新失败');
            await this.reply('更新『咕咕牛』时出现错误，请查看日志！');
            setTimeout(async () => {
                await this.reply(updaterrormsg);
             }, 2000);
        }
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
    
        if (message.startsWith('#ban加')) {
            const match = message.match(/^#ban加(.+)/);
            if (!match) {
                await e.reply('请输入要添加到禁止列表的名称\n例如：#ban加花火Gu1', true);
                return true;
            }
    
            let inputRoleName = match[1].trim();
            let roleName = inputRoleName.replace(/Gu\d+$/, '').trim();
            let mainName = this.getMainRoleName(roleName); 
    
            if (mainName) {
                mainName = `${mainName}${inputRoleName.match(/Gu\d+$/)[0]}`;
                const fileName = `${mainName}.webp`;
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
                await e.reply(`未找到角色：${roleName}`, true);
            }
        } else if (message.startsWith('#ban删')) {
            const match = message.match(/^#ban删(.+)/);
            if (!match) {
                await e.reply('请输入要从禁止列表中删除的名称\n例如：#ban删花火Gu1', true);
                return true;
            }
    
            let inputRoleName = match[1].trim();
            let roleName = inputRoleName.replace(/Gu\d+$/, '').trim();
            let mainName = this.getMainRoleName(roleName);
    
            if (mainName) {
                mainName = `${mainName}${inputRoleName.match(/Gu\d+$/)[0]}`;
                const fileName = `${mainName}.webp`;
                let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');

                if (R18_images.includes(inputRoleName)) {
                    await e.reply(`${inputRoleName} ❌️已拒绝删除`, true);
                    return true;
                }
    
                if (banList.includes(fileName)) {
                    banList = banList.filter(item => item !== fileName);
                    fs.writeFileSync(banListPath, `${banList.join(';')}`, 'utf8');
                    await e.reply(`${fileName} ✅️已解禁`, true);
                    await e.reply("批量解除封禁可输入#清空咕咕牛封禁,仅重置封禁文件不影响净化模式")

                        await this.CopyFolderRecursive(this.GScopylocalPath, this.characterPath);
                        await this.CopyFolderRecursive(this.SRcopylocalPath, this.characterPath);
                        await this.CopyFolderRecursive(this.ZZZcopylocalPath, this.ZZZcharacterPath);
                        await this.CopyFolderRecursive(this.WAVEScopylocalPath, this.WAVEScharacterPath);

                } else {
                    await e.reply(`${fileName} ❌️不存在`, true);
                }
            } else {
                await e.reply(`未找到角色：${roleName}`, true);
            }
        }
    
        return true;
    }
    
    async CC(e) {e.reply("请使用#重置咕咕牛",true)}

    async BanRolelist(e) {
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        if (!fs.existsSync(banListPath)) {
            await e.reply('禁用文件不存在,已重新生成', true);
            fs.writeFileSync(banListPath, '', 'utf8');
            return true;
        }
        try {
            const fileContent = fs.readFileSync(banListPath, 'utf8').trim();
            if (fileContent === '') {
                await e.reply('封禁列表是空的', true);
                return true;
            }
            const banList = fileContent.split(';').map(item => item.trim()); 
            const uniqueBanList = [...new Set(banList)];
            const totalItems = uniqueBanList.length -1;
            const formattedBanList = uniqueBanList.map(item => item.replace(/\.webp$/, ''));
            const BanListforwardMsg = [];
            BanListforwardMsg.push(`当前已Ban的数量：${totalItems}张\n『#ban删花火Gu1』可以移除封禁`);
            BanListforwardMsg.push(formattedBanList.join('\n')); 
            const banListMsg = await common.makeForwardMsg(this.e, BanListforwardMsg, '封禁中的面板图列表');
            await e.reply(banListMsg);
            return true;
        } catch (error) {
            await e.reply('读取封禁文件时出现错误，请查看控制台日志', true);
            return true;
        }
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
    
        let roleName = match[1].trim();
        roleName = this.getMainRoleName(roleName);
    
        const foldersONE = fs.readdirSync(this.GScopylocalPath);
        const foldersTWO = fs.readdirSync(this.SRcopylocalPath);
        const foldersTHREE = fs.readdirSync(this.ZZZcopylocalPath);
        const allFolders = [
            ...foldersONE.map(folder => path.join(this.GScopylocalPath, folder)), 
            ...foldersTWO.map(folder => path.join(this.SRcopylocalPath, folder)), 
            ...foldersTHREE.map(folder => path.join(this.ZZZcopylocalPath, folder))
        ];
    
        const matchedFolder = allFolders.find(folder => path.basename(folder).includes(roleName));
        if (!matchedFolder) {
            await e.reply(`未找到角色『${roleName}』`);
            return true;
        } 
    
        const files = fs.readdirSync(matchedFolder)
        .filter(file => /\.webp$/.test(file))
        .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });
    
        if (files.length === 0) {
            await e.reply(`『${path.basename(matchedFolder)}』文件夹下没有图片`, true);
            return true;
        }
    
        let checkrolename = `当前查看『${path.basename(matchedFolder)}』，有${files.length}张`;
        let RoleWebpPhotoList = [];
        RoleWebpPhotoList.push([`当前查看『${path.basename(matchedFolder)}』，有${files.length}张`]);
    
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        const banListContent = fs.readFileSync(banListPath, 'utf-8');
        const filesToBan = banListContent.split(';').map(item => item.trim()).filter(item => item !== '');
    
        for (let i = 0; i < files.length; i++) {
            let fileName = files[i];
            const filePath = path.join(matchedFolder, fileName);
            const isBanned = filesToBan.includes(fileName);
            const isR18Image = R18_images.includes(fileName.replace('.webp', ''));
        
            if (isBanned && isR18Image) {
                fileName = `${fileName.replace('.webp', '')} ❌封禁🟢净化`;
            } else if (isBanned) {
                fileName = `${fileName.replace('.webp', '')} ❌封禁`;
            } else {
                fileName = `${fileName.replace('.webp', '')}`; 
            }
    
            RoleWebpPhotoList.push([`${i + 1}、${fileName}`, segment.image(`file://${filePath}`)]);
        }
    
        try {
            let RoleFindsuccessmsg = await common.makeForwardMsg(this.e, RoleWebpPhotoList, checkrolename);
            await e.reply(RoleFindsuccessmsg);
            if (!RoleFindsuccessmsg) {
                e.reply('发送失败,请私聊查看！', true);
            }
        } catch (err) {
            console.error(err);
            await e.reply(`发送 ${path.basename(matchedFolder)} 的列表时出现错误,请查看控制台日志`);
        }
    }
    

    async RemoveBadimages(e) {
        const galleryConfigPath = path.join(this.GuPath, 'GalleryConfig.yaml');
        const galleryConfigContent = fs.readFileSync(galleryConfigPath, 'utf8');
        const galleryConfig = yaml.parse(galleryConfigContent);

        if (e.msg == '#净化咕咕牛') {

             e.reply("『咕咕牛』封禁高危面板图,净化无法解除需要你手动修改配置文件,下次更新依旧会延续净化,十分建议呢用#ban封禁",true)
             setTimeout(async () => {
                    e.reply("输入#确认净化咕咕牛,进行下一步")               
             }, 3000);

            }else if (e.msg == '#确认净化咕咕牛') {
                
                if (galleryConfig && galleryConfig['Px18img-type'] === 1 ) {

                await e.reply("好的,开始净化咕咕牛",true)
                const banListPath = path.join(this.GuPath, 'banlist.txt');
                if (!fs.existsSync(banListPath)) {
                    fs.writeFileSync(banListPath, '', 'utf8');
                }
                let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(item => item.trim() !== '');

                R18_images.forEach(image => {
                    const fileName = `${image}.webp`;
                    if (!banList.includes(fileName)) {
                        banList.push(fileName);
                    }
                });
                fs.writeFileSync(banListPath, `${banList.join(';')};`, 'utf8')
                this.DeleteBanList();

                galleryConfig['Px18img-type'] = 0;
                const newGalleryConfigContent = yaml.stringify(galleryConfig);
                fs.writeFileSync(galleryConfigPath, newGalleryConfigContent, 'utf8');
               
                setTimeout(async () => {
                    await e.reply(`净化完毕，绿色网络从你做起！`);
                  }, 10000);
                  } else if (galleryConfig && galleryConfig['Px18img-type'] === 0) {
                await e.reply("你已经净化过了,亲",true);
            }

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
    
    async GalleryOption(e){
        const galleryConfigPath = path.join(this.GuPath, 'GalleryConfig.yaml');
        const galleryConfigContent = fs.readFileSync(galleryConfigPath, 'utf8');
        const galleryConfig = yaml.parse(galleryConfigContent);
        if (e.msg == '#启用咕咕牛') {
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』未下载！', true);
                return;
             }
                await e.reply('『咕咕牛🐂』启用中,请稍后...',true);

                    await this.CopyFolderRecursive(this.GScopylocalPath, this.characterPath);
                    await this.CopyFolderRecursive(this.SRcopylocalPath, this.characterPath);
                    await this.CopyFolderRecursive(this.ZZZcopylocalPath, this.ZZZcharacterPath);
                    await this.CopyFolderRecursive(this.WAVEScopylocalPath, this.WAVEScharacterPath);
                    
                await e.reply('『咕咕牛』重新进入喵喵里面！');
                setTimeout(async () => {
                    this.DeleteBanList()
                }, 2000);

                galleryConfig['GGOP'] = 1;
                const newGalleryConfigContent = yaml.stringify(galleryConfig);
                fs.writeFileSync(galleryConfigPath, newGalleryConfigContent, 'utf8');

        }else if (e.msg == '#禁用咕咕牛') {
                await e.reply('『咕咕牛🐂』禁用中,请稍后...',true);
                await this.DeleteFilesWithGuKeyword();
                await e.reply('『咕咕牛』已离开喵喵');

                galleryConfig['GGOP'] = 0;
                const newGalleryConfigContent = yaml.stringify(galleryConfig);
                fs.writeFileSync(galleryConfigPath, newGalleryConfigContent, 'utf8');
        }
    }

    async DeleteGallary(e){
        await e.reply('『咕咕牛🐂』完全删除中,请稍后.....',true);
        await this.DeleteFilesWithGuKeyword();
        if (!fs.existsSync(this.localPath)) {
            return e.reply('『咕咕牛』已离开你的崽崽了！');
        }
        await fs.promises.rm(this.localPath, { recursive: true });
        console.log('『咕咕牛🐂』图库删除成功！');
        return e.reply('『咕咕牛』已离开你的崽崽了！！');
    }

    async executeTask(){
        logger.info("[『咕咕牛🐂』定时更新任务]：开始执行")
        const gitPullOutput = await new Promise((resolve, reject) => {
            exec('git pull', { cwd: this.localPath }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stdout);
                }
            });
        });
        if (/Already up[ -]to[ -]date/.test(gitPullOutput)) {
            logger.info("[『咕咕牛🐂』定时更新任务]：暂无更新内容")
        }else{

                await this.CopyFolderRecursive(this.GScopylocalPath, this.characterPath);
                await this.CopyFolderRecursive(this.SRcopylocalPath, this.characterPath);
                await this.CopyFolderRecursive(this.ZZZcopylocalPath, this.ZZZcharacterPath);
                await this.CopyFolderRecursive(this.WAVEScopylocalPath, this.WAVEScharacterPath);

                fs.mkdirSync(this.GuPath, { recursive: true });
                const sourceFile = path.join(this.localPath, 'GuGuNiu-Gallery', 'help.png');
                const destFile = path.join(this.GuPath, 'help.png');
                await fs.promises.copyFile(sourceFile, destFile);

                const sourceJSFile = path.join(this.localPath, '咕咕牛图库下载器.js');
                const destJSFile = path.join(this.JsPath, '咕咕牛图库下载器.js');
                await fs.promises.copyFile(sourceJSFile, destJSFile);
                
                this.DeleteBanList();
                return logger.info("[『咕咕牛🐂』定时更新任务]：执行完毕")
            }
        }
    
    async GOODBYEGUGUNIU(e){
        const banListPath = path.join(this.GuPath, 'banlist.txt');
        if (!fs.existsSync(banListPath)) {
            fs.writeFileSync(banListPath, '', 'utf8');
            e.reply("牛的封禁列表文件不存在，已重新创建",true)
        }else {
            fs.unlinkSync(banListPath);
            fs.writeFileSync(banListPath, '', 'utf8');
            e.reply("牛的封禁文件清空成功",true)

        }
    }

    async RestartGuGuNiu(e) {
        try { 
            if (!fs.existsSync(this.localPath)) {
                await e.reply('『咕咕牛🐂』未下载！', true);
                return true;
            }
            await fs.promises.rm(this.localPath, { recursive: true });
            console.log('『咕咕牛🐂』重置成功！');
            return e.reply('『咕咕牛🐂』重置成功！');
        } catch (error) {
            console.error('重置『咕咕牛🐂』时出现错误:', error);
            let rerrforward = [];
            rerrforward.push(`重置『咕咕牛🐂』时出现错误:\n ${error.message}`);
            let restarterror = await common.makeForwardMsg(this.e, rerrforward, '『咕咕牛🐂』重置失败');
            this.reply('『咕咕牛🐂』重置失败，请查看控制台日志！');
            setTimeout(async () => {
                this.reply(restarterror);
            }, 2000);
        }
    }    
    async CheckFolder(e) {
        const gitPath = this.GitPath;
        const characterFolderPaths = [
            { name: '原神', path: this.localPath + '/gs-character' },
            { name: '星铁', path: this.localPath + '/sr-character' },
            { name: '绝区零', path: this.localPath + '/zzz-character' },
            { name: '鸣潮', path: this.localPath + '/waves-character' }
        ];
    
        if (!fs.existsSync(this.localPath)) {
            await e.reply('『咕咕牛🐂』未下载！', true);
            return true;
        }
    
        const CheckRoleforward = [];
        let totalRolesCount = 0;
        for (const { name, path: folderPath } of characterFolderPaths) {
            if (fs.existsSync(folderPath)) {
                const subFolders = fs.readdirSync(folderPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name)
                    .sort((a, b) => a.localeCompare(b, 'zh', { sensitivity: 'base' }));
    
                totalRolesCount += subFolders.length;
                let folderMessage = `------${name}------\n`;
                subFolders.forEach(subFolder => {
                    const panelImages = fs.readdirSync(`${folderPath}/${subFolder}`)
                        .filter(file => file.endsWith('.webp'));
                    folderMessage += `${subFolder}：${panelImages.length}张\n`;
                });
    
                CheckRoleforward.push(folderMessage);
            }
        }
    
        let totalSize = 0;
        for (const { path: folderPath } of characterFolderPaths) {
            totalSize += await this.getFolderSize(folderPath);
        }
        const formattedTotalSize = formatBytes(totalSize);
        const gitSize = await this.getFolderSize(gitPath);
        const gitAllSize = formatBytes(gitSize);
        const MBTSize = formatBytes(gitSize + totalSize);

        const checkmessage =
            `----『咕咕牛🐂』----\n` +
            `角色数量：${totalRolesCount}名\n` +
            `图库容量：${formattedTotalSize}\n` +
            `Git 缓存：${gitAllSize}\n` +
            `总占用：${MBTSize}`;
    
        const RoleNumMessage = CheckRoleforward;
    
        await Promise.all([
            e.reply(checkmessage),
            (async () => {
                const msg = await common.makeForwardMsg(this.e,RoleNumMessage, '『咕咕牛🐂』图库详情');
                await e.reply(msg);
            })()
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
            const banListContent = await fs.promises.readFile(banListPath, 'utf8');
            const filesToDelete = banListContent.split(';').map(item => item.trim()).filter(item => item !== '');
    
            const deleteFilesRecursively = async (directory) => {
                const files = await fs.promises.readdir(directory);
                for (const file of files) {
                    const filePath = path.join(directory, file);
                    const stat = await fs.promises.stat(filePath);
                    if (stat.isDirectory()) {
                        await deleteFilesRecursively(filePath);
                    } else {
                        const fileName = path.basename(filePath);
                        if (filesToDelete.includes(fileName)) {
                            await fs.promises.unlink(filePath);
                     //------刷屏点----/ console.log(`${fileName} 已删除`);
                        }
                    }
                }
            }
            await deleteFilesRecursively(this.characterPath);
            await deleteFilesRecursively(this.ZZZcharacterPath);

            console.log('『咕咕牛🐂』封禁列表中的文件已删除');
        } catch (error) {
            console.error('删除文件时出现错误:', error);
        }
    }
    async DeleteFilesWithGuKeyword() {
        const ToCheck = [this.characterPath, this.ZZZcharacterPath];
        for (const normalCharacterPath of ToCheck) {
            try {
                const folders = await fs.promises.readdir(normalCharacterPath);
                await Promise.all(folders.map(async (folder) => {
                    const folderPath = path.join(normalCharacterPath, folder);
                    const stats = await fs.promises.lstat(folderPath);
                    if (stats.isDirectory()) {
                        const files = await fs.promises.readdir(folderPath);
    
                        const deletePromises = files.map(async (file) => {
                            const filePath = path.join(folderPath, file);
                            const fileStats = await fs.promises.lstat(filePath);
                            if (fileStats.isFile() && file.includes('Gu') && !file.endsWith('.db')) {
                                await fs.promises.unlink(filePath);
                            }
                        });
                        await Promise.all(deletePromises);
                    }
                }));
                console.log('『咕咕牛🐂』图库删除成功');
            } catch (err) {
                console.error('『咕咕牛🐂』图库删除失败:', err);
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
            'code 28': "增加 Git 的 HTTP 缓冲区大小，在控制台输入命令：git config --global http.postBuffer 524288000",
            '443': "可能是网络问题、被墙或访问被拒绝。"
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

        let aliasZZZ;
        const ZZZFilePath = path.resolve(this.ZZZaliasPath, 'alias.yaml');
        if (fs.existsSync(ZZZFilePath)) {
            const ZZZContent = fs.readFileSync(ZZZFilePath, 'utf-8');
            aliasZZZ = yaml.parse(ZZZContent);
        }

        let aliasWAVES;
        const WAVESFilePath = path.resolve(this.WAVESaliasPath, 'role.yaml');
        if (fs.existsSync(WAVESFilePath)) {
            const WAVESContent = fs.readFileSync(WAVESFilePath, 'utf-8');
            aliasWAVES = yaml.parse(WAVESContent);
        }

        let mainNameSR = Object.keys(aliasSR).find(main => {
            const aliases = aliasSR[main].split(',');
            return aliases.includes(roleName);
        });

        let mainNameGS = Object.keys(aliasGS).find(main => {
            const aliases = aliasGS[main].split(',');
            return aliases.includes(roleName);
        });

        let mainNameZZZ;
        if (aliasZZZ) {
            mainNameZZZ = Object.keys(aliasZZZ).find(main => {
                const aliases = aliasZZZ[main];
                return aliases.includes(roleName);
            });
        }

        let mainNameWAVES;
        if (aliasWAVES) {
            mainNameWAVES = Object.keys(aliasWAVES).find(main => {
                const aliases = aliasWAVES[main];
                return aliases.includes(roleName);
            });
        }

        if (mainNameSR) {
            return mainNameSR.trim();
        } else if (mainNameGS) {
            return mainNameGS.trim();
        } else if (mainNameZZZ) {
            return mainNameZZZ.trim();
        } else if (mainNameWAVES) {
            return mainNameWAVES.trim();
        } 
        return roleName;
    }

      
}


const R18_images = [

]


