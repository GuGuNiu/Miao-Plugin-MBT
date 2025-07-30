const fs = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const { getGitPath } = require('./find-git.js');

class ProcessManager {
    constructor(logger) { this.processes = new Set(); this.logger = logger; }
    register(proc) { this.processes.add(proc); }
    unregister(proc) { this.processes.delete(proc); }
    killAll(signal = 'SIGTERM') {
        this.processes.forEach(proc => {
            if (proc && proc.pid && !proc.killed) { try { process.kill(proc.pid, signal); } catch (e) {} }
        });
        this.processes.clear();
    }
}

async function ExecuteCommand(command, args, options, timeout, processManager, conlog, onProgress) {
    const gitExecutable = await getGitPath(conlog);
    
    const spawnOptions = { 
        stdio: "pipe", 
        ...options, 
        detached: process.platform !== 'win32', 
        windowsHide: true,
    };
    
    const cmdStr = `${gitExecutable} ${args.join(" ")}`;
    let proc;
    
    const promise = new Promise((resolve, reject) => {
        let stdout = ""; let stderr = ""; let timer = null;
        
        const killProc = (reason) => {
            if (proc && !proc.killed) proc.kill("SIGKILL");
            const err = new Error(reason);
            err.code = timeout ? 'ETIMEDOUT' : 'ECANCELED';
            reject(err);
        };
        
        if (timeout > 0) timer = setTimeout(() => killProc(`Command timed out: ${cmdStr}`), timeout);

        try {
            // 使用找到的 git 绝对路径执行命令，不再需要 shell
            proc = spawn(gitExecutable, args, spawnOptions);
        } catch (spawnError) {
             conlog.error(`[ExecuteCommand] Spawn failed for command "${command}".`, spawnError);
             return reject(spawnError);
        }

        processManager.register(proc);
        proc.stdout.on("data", (data) => (stdout += data.toString()));
        proc.stderr.on("data", (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (onProgress) {
                try {
                    const progressMatch = chunk.match(/(receiving|resolving|compressing) objects:\s*(\d+)%/i);
                    if (progressMatch && progressMatch[2]) onProgress(parseInt(progressMatch[2], 10));
                } catch (e) {}
            }
        });
        proc.on("error", (err) => {
            if(err.code === 'ENOENT') {
                err.friendlyMessage = `无法执行 "${command}" 命令。请确保服务器已安装 Git 并配置好环境变量(PATH)。`;
            }
            clearTimeout(timer); processManager.unregister(proc);
            reject(err);
        });
        proc.on("close", (code) => {
            clearTimeout(timer); processManager.unregister(proc);
            if (code === 0) resolve({ stdout, stderr });
            else {
                const err = new Error(`Command failed with code ${code}: ${cmdStr}\n${stderr}`);
                err.code = code; err.stderr = stderr;
                reject(err);
            }
        });
    });
    promise.cancel = () => killProc('Operation canceled');
    return promise;
}

// GitManager 类的其余部分保持不变
class GitManager {
    constructor(defaultConfig, conlog, broadcast) {
        this.config = defaultConfig;
        this.conlog = conlog;
        this.broadcast = broadcast;
        this.processManager = new ProcessManager(conlog);
    }
    
    async testProxies(rawUrl) {
        const fetch = (await import('node-fetch')).default;
        this.broadcast({ type: 'log', message: '开始并行测试所有网络节点...' });
        const testPromises = this.config.proxies.map(async (proxy) => {
            let speed = Infinity;
            if (proxy.testUrlPrefix === null) return { ...proxy, speed };
            try {
                const testUrl = `${proxy.testUrlPrefix.replace(/\/+$/, "")}${this.config.proxyTestFile}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.config.proxyTestTimeout);
                const startTime = Date.now();
                const response = await fetch(testUrl, { signal: controller.signal, cache: 'no-store' });
                clearTimeout(timeoutId);
                if (response.ok) speed = Date.now() - startTime;
            } catch (e) {}
            this.broadcast({ type: 'speedtest_result', payload: { name: proxy.name, speed } });
            return { ...proxy, speed };
        });
        return Promise.all(testPromises);
    }

    async gitLsRemoteTest(repoUrl, cloneUrlPrefix, nodeName) {
        let actualRepoUrl = "";
        try {
            const repoPathMatch = repoUrl.match(/(github\.com|gitee\.com|gitcode\.net)\/([^/]+)\/([^/]+)/i);
            const userAndRepoPath = repoPathMatch ? `${repoPathMatch[2]}/${repoPathMatch[3].replace(/\.git$/, "")}` : null;
            if (!userAndRepoPath) throw new Error("无法提取仓库路径");
            if (!cloneUrlPrefix || nodeName === "GitHub") actualRepoUrl = `https://${repoPathMatch[1]}/${userAndRepoPath}.git`;
            else actualRepoUrl = `${cloneUrlPrefix.replace(/\/$/, "")}/${repoPathMatch[1]}/${userAndRepoPath}.git`;
            const startTime = Date.now();
            await ExecuteCommand("git", ["ls-remote", "--heads", actualRepoUrl], {}, 20000, this.processManager, this.conlog);
            return { success: true, duration: Date.now() - startTime };
        } catch (error) {
            return { success: false, duration: Infinity, error };
        }
    }

    applySmartSelectionStrategy(allHttpTestResults, gitTestResults) {
        const gitEliteNodesMap = new Map(gitTestResults.filter(n => n.gitResult && n.gitResult.success).map(n => [n.name, n.gitResult]));
        if (gitEliteNodesMap.size === 0) {
            this.broadcast({ type: 'log', message: '警告: Git轻量级探测全部失败, 降级为HTTP延迟排序。' });
            return allHttpTestResults.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
        }
        const finalNodeList = allHttpTestResults.map(node => ({
            ...node,
            gitResult: gitEliteNodesMap.get(node.name) || { success: false, duration: Infinity }
        }));
        finalNodeList.sort((a, b) => {
            const aGitSuccess = a.gitResult.success; const bGitSuccess = b.gitResult.success;
            if (aGitSuccess && !bGitSuccess) return -1; if (!aGitSuccess && bGitSuccess) return 1;
            if (aGitSuccess && bGitSuccess) { if (a.gitResult.duration !== b.gitResult.duration) return a.gitResult.duration - b.gitResult.duration; }
            if (a.speed !== b.speed) return a.speed - b.speed;
            return (a.priority ?? 999) - (b.priority ?? 999);
        });
        const nodesToTry = finalNodeList.filter(n => n.gitResult.success);
        if (nodesToTry.length > 0) return nodesToTry;
        const fallbackNodes = allHttpTestResults.filter(r => r.speed !== Infinity).sort((a, b) => a.speed - b.speed);
        return fallbackNodes;
    }
    
    async downloadRepo(repoUrl, targetPath, alias) {
        const RAW_URL_Repo1 = "https://raw.githubusercontent.com/GuGuNiu/Miao-Plugin-MBT/main";
        const allHttpTestResults = await this.testProxies(RAW_URL_Repo1);
        const httpSurvivors = allHttpTestResults.filter(r => r.speed !== Infinity);
        if (httpSurvivors.length === 0) throw new Error("所有节点HTTP测试均失败, 无法下载。");
        this.broadcast({ type: 'log', message: 'HTTP测试完成, 开始Git轻量级探测...' });
        const gitTestPromises = httpSurvivors.map(node => this.gitLsRemoteTest(repoUrl, node.cloneUrlPrefix, node.name).then(gitResult => ({ name: node.name, gitResult })));
        const gitTestResults = await Promise.all(gitTestPromises);
        const sortedNodes = this.applySmartSelectionStrategy(allHttpTestResults, gitTestResults);
        if (sortedNodes.length === 0) throw new Error("所有可用节点Git探测均失败, 无法下载。");
        this.broadcast({ type: 'log', message: `探测完成, 优选下载顺序: ${sortedNodes.map(n => n.name).join(' -> ')}` });
        const YunzaiPath = path.resolve(__dirname, "..", "..", "..", "..");
        let lastError = null;
        for (const node of sortedNodes) {
            this.broadcast({ type: 'progress', payload: { status: `尝试节点: ${node.name}...`, progress: 0 } });
            try {
                let actualCloneUrl = "";
                const repoPathMatch = repoUrl.match(/(github\.com|gitee\.com|gitcode\.net)\/([^/]+)\/([^/]+)/i);
                let userAndRepoPath = repoPathMatch ? `${repoPathMatch[2]}/${repoPathMatch[3].replace(/\.git$/, "")}` : null;
                if (!userAndRepoPath) throw new Error(`无法从URL提取仓库路径`);
                if (!node.cloneUrlPrefix || node.name === "GitHub") actualCloneUrl = `https://${repoPathMatch[1]}/${userAndRepoPath}.git`;
                else {
                    const cleanPrefix = node.cloneUrlPrefix.replace(/\/$/, "");
                    if (node.name === "GitClone") actualCloneUrl = `${cleanPrefix}/${repoUrl.replace(/^https?:\/\//, "")}`;
                    else actualCloneUrl = `${cleanPrefix}/${repoPathMatch[1]}/${userAndRepoPath}.git`;
                }
                const cloneArgs = ["clone", "--verbose", "--depth=1", "--progress", "-b", "main", actualCloneUrl, targetPath];
                const onProgress = (progress) => { this.broadcast({ type: 'progress', payload: { status: `节点 [${node.name}] 下载中...`, progress: progress } }); };
                await ExecuteCommand("git", cloneArgs, { cwd: YunzaiPath }, this.config.gitCloneTimeout, this.processManager, this.conlog, onProgress);
                this.broadcast({ type: 'progress', payload: { status: `节点 [${node.name}] 下载成功`, progress: 100 } });
                return { success: true, nodeName: node.name };
            } catch (error) {
                lastError = error;
                const errorMessage = error.friendlyMessage || error.message.split('\n')[0];
                this.broadcast({ type: 'log', message: `节点 [${node.name}] 失败: ${errorMessage}` });
            }
        }
        throw lastError || new Error("所有可用节点均下载失败。");
    }

    async updateRepo(repoPath) {
        this.broadcast({ type: 'progress', payload: { status: `正在更新...`, progress: 0 } });
        try {
            await ExecuteCommand("git", ["pull"], { cwd: repoPath }, this.config.gitPullTimeout, this.processManager, this.conlog);
            this.broadcast({ type: 'progress', payload: { status: '更新成功', progress: 100 } });
            return { success: true };
        } catch (error) {
            const errorMessage = error.friendlyMessage || error.message;
            this.broadcast({ type: 'log', message: `更新失败: ${errorMessage}` });
            if (error.stderr && error.stderr.includes("Not possible to fast-forward")) {
                this.broadcast({ type: 'log', message: `检测到冲突, 尝试强制重置...` });
                try {
                    await ExecuteCommand("git", ["fetch", "origin"], { cwd: repoPath }, this.config.gitPullTimeout, this.processManager, this.conlog);
                    await ExecuteCommand("git", ["reset", "--hard", "origin/main"], { cwd: repoPath }, 30000, this.processManager, this.conlog);
                    this.broadcast({ type: 'progress', payload: { status: '强制更新成功', progress: 100 } });
                    return { success: true, reset: true };
                } catch (resetError) {
                    throw resetError;
                }
            }
            throw error;
        }
    }
}

module.exports = { GitManager };