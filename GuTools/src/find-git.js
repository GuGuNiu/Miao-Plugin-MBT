const { exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

let gitPathCache = null;

async function findGitOnWindows() {
    try {
        return await new Promise((resolve, reject) => {
            exec('where git', (error, stdout) => {
                if (error) return reject(error);
                const gitPath = stdout.split('\n')[0].trim();
                resolve(gitPath || null);
            });
        });
    } catch (e) {
        const commonPaths = [
            path.join(process.env.ProgramFiles, 'Git', 'cmd', 'git.exe'),
            path.join(process.env['ProgramFiles(x86)'], 'Git', 'cmd', 'git.exe'),
            path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'cmd', 'git.exe'),
        ];
        for (const p of commonPaths) {
            try {
                await fs.access(p);
                return p;
            } catch {}
        }
        return null;
    }
}

async function findGitOnUnix() {
    try {
        return await new Promise((resolve, reject) => {
            exec('which git', (error, stdout) => {
                if (error) return reject(error);
                resolve(stdout.trim() || null);
            });
        });
    } catch (e) {
        return null;
    }
}

async function getGitPath(logger) {
    if (gitPathCache) return gitPathCache;
    
    logger.log('[Git Finder] 正在查找 Git 可执行文件路径...');
    let foundPath = null;
    if (process.platform === 'win32') {
        foundPath = await findGitOnWindows();
    } else {
        foundPath = await findGitOnUnix();
    }

    if (foundPath) {
        logger.log(`[Git Finder] 成功找到 Git: ${foundPath}`);
        gitPathCache = foundPath;
    } else {
        logger.error('[Git Finder] CRITICAL: 未能在系统中找到 Git 可执行文件！');
        gitPathCache = 'git'; // Fallback to 'git' and let spawn handle it
    }
    return gitPathCache;
}

module.exports = { getGitPath };