import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import common from '../../lib/common/common.js';
import yaml from 'yaml'
import { spawn } from 'child_process'



//        『咕咕牛🐂』图库管理器 v3.2
//        Github仓库地址：https://github.com/GuGuNiu/Miao-Plugin-MBT/


/**
 * @param {Array} fileList 
 */
async function batchCopyFiles(fileList) {
    for (const fileItem of fileList) {
        const destDir = path.dirname(fileItem.dest);
        fs.mkdirSync(destDir, { recursive: true });
        await fs.promises.copyFile(fileItem.source, fileItem.dest);
    }
}


export class MiaoPluginMBT extends plugin {
    constructor() {
        super({
            name: '『咕咕牛🐂』图库管理器 v3.2',
            dsc: '『咕咕牛🐂』图库管理器',
            event: 'message',
            priority: 1000,
            rule: GUGUNIU_RULES    
        })
        this.task = {
            name: '『咕咕牛🐂』定时更新任务',
            cron: '0 5 */3 * *',
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
        var rawPath = 'https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main';
        var speeds = await this.testProxies(rawPath);
        var msg = '『咕咕牛🐂』节点测速延迟：\n\n';
        var i, s;
        for (i = 0; i < speeds.length; i++) {
          s = speeds[i];
          var speedMsg = "";
          if (s.speed === Infinity) {
            speedMsg = "超时 ❌";
          } else {
            speedMsg = s.speed + "ms ✅";
          }
          msg = msg + s.name + "：" + speedMsg + "\n";
        }
        
        var available = [];
        for (i = 0; i < speeds.length; i++) {
          if (speeds[i].speed !== Infinity) {
            available.push(speeds[i]);
          }
        }
        
        if (available.length === 0) {
          await e.reply(msg + "\n⚠️ 所有源测速失败，请检查网络或手动下载。");
          return;
        }
        
        available.sort(function(a, b) {
          return a.speed - b.speed;
        });
        
        var best = available[0];
        var bestCloneUrl = best.url.replace(rawPath, "") + this.repositoryUrl;
        msg = msg + "\n✅最佳：" + best.name + "开始下载了...\n";
        await e.reply(msg);
        
        var progressReported10 = false;
        var progressReported50 = false;
        var progressReported90 = false;
        
        var git = spawn('git', ['clone', '--depth=1', '--progress', bestCloneUrl, this.localPath], { shell: true });
        
        git.stdout.on('data', function(data) {
        });
        
        git.stderr.on('data', async function(data) {
          var str = data.toString();
          var m = str.match(/Receiving objects:\s*(\d+)%/);
          if (m && m[1]) {
            var progress = parseInt(m[1], 10);
            if (progress >= 10 && progressReported10 === false) {
              progressReported10 = true;
              await e.reply('『咕咕牛』下载进度：10%');
            }
            if (progress >= 50 && progressReported50 === false) {
              progressReported50 = true;
              await e.reply('『咕咕牛』下载进度：50%');
            }
            if (progress >= 90 && progressReported90 === false) {
              progressReported90 = true;
              await e.reply('『咕咕牛』下载进度：90%,即将下载完成');
            }
          }
        });
        
        git.on('close', async function(code) {
            if (code === 0) {
              await e.reply("『咕咕牛』下载完成，准备下一步操作...");
              try {
                await this.PostDownload(e);
              } catch (err) {
                await e.reply("处理失败，请查看控制台日志或手动处理。");
                console.error("处理失败：", err.message);
              }
            } else {
              const error = new Error(`code ${code}`);
              const feedback = this.generateDownloadErrorFeedback(error).join('\n');
              await e.reply("下载失败！\n" + feedback);
              console.error("下载失败，异常码：", code);
            }
          }.bind(this));
          
          git.on('error', async function(err) {
            const feedback = this.generateDownloadErrorFeedback(err).join('\n');
            await e.reply("下载失败！\n" + feedback);
            console.error("下载出错：", err.message);
          }.bind(this));
          
      }
      
      async testProxies(rawPath) {
        const sources = {
          "Github": rawPath,
          "Ghfast": this.proxy + rawPath,
          "Ghp": this.proxy2 + rawPath,
          "Ghgo": this.proxy3 + rawPath,
          "Ghproxy": this.proxy4 + rawPath,
          "Ghproxy2": this.proxy8 + rawPath,
          "Gitmirror": this.proxy7 + rawPath,
          "Moeyy": this.proxy5 + rawPath,
          "Yumenaka": this.proxy6 + rawPath,
        };
      
        const testSourceSpeed = async (url) => {
          const testFile = "/README.md";
          const start = Date.now();
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(url + testFile, { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) return Date.now() - start;
          } catch (e) {}
          return Infinity;
        };
      
        const speeds = await Promise.all(Object.entries(sources).map(async ([name, url]) => {
          const speed = await testSourceSpeed(url);
          return { name, url, speed };
        }));
      
        return speeds;
      }

      async cloneFullRepo(url, e) {
        await fs.promises.rm(this.localPath, { recursive: true, force: true });
        return new Promise((resolve, reject) => {
          const process = exec(`git clone --depth=1 ${url} ${this.localPath}`);
          process.on('close', code => {
            if (code === 0) {
                resolve();
              } else {
                reject(new Error(`git clone failed: ${code}`));
              }
          });
        });
      }
            
    

    async PostDownload(e) {
        await this.copyCharacterFolders();
        await e.reply('『咕咕牛』正在咕咕噜的载入喵喵中...');
    
        fs.mkdirSync(this.GuPath, { recursive: true });
        this.CopyFolderRecursive(path.join(this.localPath, 'GuGuNiu-Gallery'), this.GuPath);
    
        setTimeout(async () => {
            await e.reply('『咕咕牛』成功进入喵喵里面！\n会自动更新Js和图库~~~。');
        }, 20000);
        
        const filesToCopy = [
            {
                source: path.join(this.localPath, 'GuGuNiu-Gallery', 'help.png'),
                dest: path.join(this.GuPath, 'help.png')
            },
            {
                source: path.join(this.localPath, '咕咕牛图库下载器.js'),
                dest: path.join(this.JsPath, '咕咕牛图库下载器.js')
            }
        ];
        
        await batchCopyFiles(filesToCopy);

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
    
                await batchCopyFiles(filesToCopy);
    
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
        const message = e.raw_message || e.message || e.content;
    
        if (/^#清空咕咕牛封禁$/.test(message)) {
            if (!fs.existsSync(banListPath)) {
                fs.writeFileSync(banListPath, '', 'utf8');
                await e.reply("牛的封禁列表文件不存在，已重新创建", true);
            } else {
                fs.unlinkSync(banListPath);
                fs.writeFileSync(banListPath, '', 'utf8');
                await e.reply("牛的封禁文件清空成功", true);
            }
            return true;
        }
        
        if (/^#ban[加删]/.test(message)) {
            await e.reply("📝建议使用新指令：#咕咕牛封禁 或 #咕咕牛解禁", true);
            return true;
}

        if (/^#(ban|咕咕牛封禁)列表$/.test(message)) {
            try {
                if (!fs.existsSync(banListPath)) {
                    fs.writeFileSync(banListPath, '', 'utf8');
                    await e.reply('封禁文件不存在，已重新生成', true);
                    return true;
                }
                const content = fs.readFileSync(banListPath, 'utf8').trim();
                if (!content) {
                    await e.reply('封禁列表是空的', true);
                    return true;
                }
                const banList = [...new Set(content.split(';').map(item => item.trim()).filter(Boolean))];
                const formattedList = banList.map(item => item.replace(/\.webp$/, ''));
                const displayCount = banList.length - 1;
    
                const msg = [
                    `当前已Ban的数量：${displayCount} 张\n『#咕咕牛解禁 花火1』可以移除封禁`,
                    formattedList.join('\n')
                ];
                const forwardMsg = await common.makeForwardMsg(e, msg, '封禁中的面板图列表');
                await e.reply(forwardMsg);
            } catch (err) {
                console.error('读取封禁列表失败:', err);
                await e.reply('读取封禁文件时出现错误，请查看控制台日志', true);
            }
            return true;
        }
    
        const isBanAdd = /^#(ban加|咕咕牛封禁)/.test(message);
        const isBanDel = /^#(ban删|咕咕牛解禁)/.test(message);
        if (!isBanAdd && !isBanDel) return false;
    
        const match = message.match(/^#(?:ban加|ban删|咕咕牛(?:封(?!禁列表)|解)禁)(.+)/);
        if (!match || !match[1]) {
            await e.reply(isBanAdd
                ? '请输入要封禁的角色，可以是角色别名\n例如：#咕咕牛封禁 花火1'
                : '请输入要解禁的角色，可以是角色别名\n例如：#咕咕牛解禁 花火1', true);
            return true;
        }
    
        const rawInput = match[1].trim();
        let name = rawInput.replace(/\s+/g, '').replace(/gu/i, 'Gu');
        if (!/Gu\d+$/i.test(name)) {
            const autoMatch = name.match(/(.*?)(\d+)$/);
            if (autoMatch) {
                name = autoMatch[1] + 'Gu' + autoMatch[2];
            } else {
                await e.reply('格式错误，请输入完整编号，例如：#咕咕牛封禁 花火1', true);
                return true;
            }
        }
    
        const roleName = name.replace(/Gu\d+$/, '');
        const suffix = name.match(/Gu\d+$/)?.[0] || '';
        const { mainName, exists } = this.resolveAlias(roleName);
    
        if (!exists) {
            await e.reply(`角色「${roleName}」不存在，请检查名称是否正确,支持角色别名`, true);
            return true;
        }
    
        const fileName = `${mainName}${suffix}.webp`;
        let banList = fs.readFileSync(banListPath, 'utf8').split(';').filter(Boolean);
    
        if (isBanAdd) {
            if (!banList.includes(fileName)) {
                banList.push(fileName);
                fs.writeFileSync(banListPath, `${banList.join(';')};`, 'utf8');
                await e.reply(`${fileName} 🚫已封禁`, true);
                this.DeleteBanList();
            } else {
                await e.reply(`${fileName} ❌️已存在`, true);
            }
        }
    
        if (isBanDel) {
            if (R18_images.includes(name)) {
                await e.reply(`${name} ❌️已拒绝删除`, true);
                return true;
            }
    
            if (banList.includes(fileName)) {
                banList = banList.filter(item => item !== fileName);
                fs.writeFileSync(banListPath, `${banList.join(';')}`, 'utf8');
                await e.reply(`${fileName} ✅️已解禁`, true);
                await e.reply("批量解除封禁可输入#清空咕咕牛封禁，仅重置封禁文件不影响净化模式");
                await this.copyCharacterFolders();
            } else {
                await e.reply(`${fileName} ❌️不存在`, true);
            }
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
        let banListContent = '';
        if (fs.existsSync(banListPath)) {
          banListContent = fs.readFileSync(banListPath, 'utf8');
        }
        const bannedFiles = banListContent.split(';').map(f => f.trim()).filter(Boolean);
        const title = `当前查看『${path.basename(matchedFolder)}』，有${files.length}张`;
        const forwardMsgList = [[title]];

        forwardMsgList.push(`支持以图片文件导出-以下是命令:\n#咕咕牛导出${path.basename(matchedFolder)}1`)

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
            const forwardMsg = await common.makeForwardMsg(this.e, forwardMsgList/*, title*/);
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
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
    
        switch (msg) {
            case '#启用咕咕牛': {
                try {
                    await fs.promises.access(this.localPath, fs.constants.F_OK);
                } catch (error) {
                    await e.reply('『咕咕牛🐂』未下载！', true);
                    return;
                }
                await e.reply('『咕咕牛🐂』启用中，请稍后...', true);
                await this.copyCharacterFolders();
                await this.updateGalleryConfig('GGOP', 1);
                await delay(2000);
                await e.reply('『咕咕牛』重新进入喵喵里面！');
                break;
            }
            case '#禁用咕咕牛': {
                await e.reply('『咕咕牛🐂』禁用中，请稍后...', true);
                await this.DeleteFilesWithGuKeyword();
                await this.updateGalleryConfig('GGOP', 0);
                await e.reply('『咕咕牛』已离开喵喵');
                break;
            }
            case '#启用官方立绘': {
                await this.CopySplashWebp(this.SRaliasPath, this.characterPath);
                await this.CopySplashWebp(this.GSaliasPath, this.characterPath);
                await e.reply('官方立绘已经启用了', true);
                break;
            }
            case '#禁用官方立绘': {
                await this.DeleteGuSplashWebp(this.characterPath);
                await e.reply('官方立绘已经禁用了', true);
                break;
            }
            default:
                await e.reply('未知的命令，请检查输入', true);
                break;
        }
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
            await batchCopyFiles(filesToCopy);
    
            logger.info("『咕咕牛🐂』定时更新任务：执行完毕");
    
        } catch (err) {
            logger.error("『咕咕牛🐂』定时更新任务：执行出错", err);
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
    
    async ExportSingleImage(e) {
        const rawInput = e.msg.replace(/^#咕咕牛导出/, '').trim();
        let name = rawInput.replace(/\s+/g, '').replace(/gu/i, 'Gu');
      
        if (!/Gu\d+$/i.test(name)) {
          const autoMatch = name.match(/(.*?)(\d+)$/);
          if (autoMatch) {
            name = autoMatch[1] + 'Gu' + autoMatch[2];
          } else {
            await e.reply('格式错误，请输入完整编号，例如：#咕咕牛导出 心海1', true);
            return true;
          }
        }
      
        const roleName = name.replace(/Gu\d+$/, '');
        const suffix = name.match(/Gu\d+$/)?.[0] || '';
        const mainName = this.getMainRoleName(roleName, true);
      
        if (!mainName) {
          await e.reply(`角色「${roleName}」不存在，请检查名称是否正确`, true);
          return true;
        }
      
        const fullName = `${mainName}${suffix}`;
        const fileName = `${fullName}.webp`;
      
        const searchDirs = [
          this.GScopylocalPath,
          this.SRcopylocalPath,
          this.ZZZcopylocalPath,
          this.WAVEScopylocalPath
        ];
      
        let foundPath = '';
        for (const dir of searchDirs) {
          const subfolders = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isDirectory());
          for (const folder of subfolders) {
            const possiblePath = path.join(dir, folder.name, fileName);
            if (fs.existsSync(possiblePath)) {
              foundPath = possiblePath;
              break;
            }
          }
          if (foundPath) break;
        }
      
        if (!foundPath) {
          await e.reply(`未找到文件：${fileName}`, true);
          return true;
        }
      
        try {
          await e.reply([
            `📦文件导出成功：${fileName}`,
            segment.file(foundPath) 
          ]);
        } catch (err) {
          console.error('[文件导出失败]', err);
          await e.reply('发送文件失败，请查看控制台日志或确认机器人权限', true);
        }
      
        return true;
      }
      
      async ManageGallary(e) {
        const msg = e.msg.trim();
        let action = "";
        if (msg.indexOf("删除") !== -1) {
          action = "delete";
        } else if (msg.indexOf("重置") !== -1) {
          action = "restart";
        } else {
          await e.reply("无效的操作类型，请使用 #删除咕咕牛 或 #重置咕咕牛");
          return;
        }
      
        const pathsToDelete = [
          this.characterPath,
          this.ZZZcharacterPath,
          this.WAVEScharacterPath
        ];
      
        async function safeDeleteDirectory(targetDir) {
          var attempts = 0;
          var maxAttempts = 3;
          while (attempts < maxAttempts) {
            try {
              fs.rmSync(targetDir, { recursive: true, force: true });
              break;
            } catch (err) {
              if (err.code === "EBUSY" || err.code === "EPERM") {
                attempts = attempts + 1;
                await new Promise(function(resolve) {
                  setTimeout(resolve, 1000);
                });
              } else {
                throw err;
              }
            }
          }
        }
      
        if (action === "delete") {
          await e.reply("『咕咕牛🐂』正在被彻底删除中，请稍候...", true);
          try {
            var i, len;
            for (i = 0, len = pathsToDelete.length; i < len; i++) {
              var dir = pathsToDelete[i];
              if (fs.existsSync(dir)) {
                await safeDeleteDirectory(dir);
              }
            }
            await e.reply("『咕咕牛🐂』已被成功送走，仅保留本地图库");
          } catch (err) {
            await e.reply("删除失败：" + err.message);
          }
        } else if (action === "restart") {
          await e.reply("『咕咕牛🐂』正在重置为初始状态，请稍候...", true);
          try {
            var allPaths = [];
            for (var j = 0, len2 = pathsToDelete.length; j < len2; j++) {
              allPaths.push(pathsToDelete[j]);
            }
            allPaths.push(this.localPath);
            for (var k = 0, len3 = allPaths.length; k < len3; k++) {
              var dir2 = allPaths[k];
              if (fs.existsSync(dir2)) {
                await safeDeleteDirectory(dir2);
              }
            }
            await e.reply("『咕咕牛🐂』已重置完毕，所有内容已清空");
          } catch (err) {
            await e.reply("重置失败：" + err.message);
          }
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
                         //  console.log(`已删除：${filePath}`);
                        } catch (err) {
                        //   console.warn(`删除失败：${filePath} - ${err.message}`);
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
        const { mainName } = this.resolveAlias(roleName);
        return mainName;
    }
    
    isRoleExist(roleName) {
        const { exists } = this.resolveAlias(roleName);
        return exists;
    }
    
    resolveAlias(roleName) {
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
      
        const aliasMapCombined = Object.assign({}, aliasGS, aliasSR, aliasZZZ, aliasWAVES);
      
        const findMainName = (aliasMap, isStringList = true) => {
          return Object.keys(aliasMap).find(main => {
            const aliases = aliasMap[main];
            let aliasArray;
            if (isStringList) {
            aliasArray = aliases.split(',');
            } else {
            aliasArray = aliases;
            }
            return aliasArray.includes(roleName);
          });
        };
      
        const mainName =
          findMainName(aliasGS) ||
          findMainName(aliasSR) ||
          findMainName(aliasZZZ, false) ||
          findMainName(aliasWAVES, false) ||
          roleName;
      
        const exists =
          Object.values(aliasMapCombined).some(list => {
            let aliasArray;
            if (Array.isArray(list)) {
              aliasArray = list;
            } else {
              aliasArray = list.split(',');
            }
            return aliasArray.includes(roleName);
          }) || Object.keys(aliasMapCombined).includes(roleName);
      
        return { mainName: mainName.trim(), exists };
      }
      
    

      
}

const GUGUNIU_RULES = [
    { reg: /^#(代理)?下载咕咕牛$/, fnc: 'GallaryDownload' },
    { reg: /^#(强制)?更新咕咕牛$/, fnc: 'GallaryUpdate' },
    { reg: /^#(删除|重置)咕咕牛$/, fnc: 'ManageGallary',permission: 'master'},
    { reg: /^#检查咕咕牛$/, fnc: 'CheckFolder' },
    { reg: /^#(启用|禁用)(咕咕牛|官方立绘)$/, fnc: 'GalleryOption', permission: 'master' },
    {
      reg: /^#(ban(加|删)|咕咕牛(封(?!禁列表)|解)禁|(?:ban|咕咕牛封禁)列表|清空咕咕牛封禁)(.*)?$/,
      fnc: 'BanRole',
      permission: 'master'
    },
    { reg: /^#(确认)?净化咕咕牛$/, fnc: 'RemoveBadimages', permission: 'master' },
    { reg: /^#检查净化图片$/, fnc: 'CheckR18Photo' },
    { reg: /^#咕咕牛导出(.+)$/, fnc: 'ExportSingleImage'},
    { reg: /^#查看(.+)$/, fnc: 'FindRoleSplash' },
    { reg: /^#咕咕牛帮助$/, fnc: 'GuHelp' },
    { reg: /^#咕咕牛$/, fnc: 'GuGuNiu' }
  ];
  


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


