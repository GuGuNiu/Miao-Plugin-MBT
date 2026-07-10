import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';

const Img_Re = /\.(webp|png|jpg|jpeg|bmp)$/i;
const Skip_Dirs = new Set(['.git', 'node_modules', '.github', 'dist', 'build', '.idea', '.vscode', '__macosx']);

const DirNames = Array.isArray(workerData?.dirNames) && workerData.dirNames.length > 0
    ? workerData.dirNames
    : ["gs-character", "sr-character", "zzz-character", "waves-character"];

const MaxConcurrency = Math.min(workerData?.concurrency || 32, 64);

async function dispatchPool(items, limit, fn) {
    if (items.length === 0) return [];
    const results = new Array(items.length);
    let cursor = 0;
    const pool = Math.min(limit, items.length);
    const agents = new Array(pool).fill(0).map(async () => {
        while (true) {
            const idx = cursor++;
            if (idx >= items.length) break;
            try {
                results[idx] = await fn(items[idx], idx);
            } catch (err) {
                results[idx] = { __error: err };
            }
        }
    });
    await Promise.all(agents);
    return results;
}

async function probeCREDir(dirPath) {
    const stats = { images: 0, size: 0 };
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        const imgFiles = files.filter(f => f.isFile() && Img_Re.test(f.name));
        if (imgFiles.length === 0) return stats;
        stats.images = imgFiles.length;
        const sizes = await dispatchPool(imgFiles, MaxConcurrency, async (f) => {
            try { return (await fs.stat(path.join(dirPath, f.name))).size; } catch { return 0; }
        });
        stats.size = sizes.reduce((sum, s) => sum + (s || 0), 0);
    } catch {}
    return stats;
}

async function probeGameDir(gamePath) {
    const gameStats = { roles: 0, images: 0, size: 0 };
    try {
        const entries = await fs.readdir(gamePath, { withFileTypes: true });
        const validDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && !Skip_Dirs.has(e.name.toLowerCase()));
        gameStats.roles = validDirs.length;
        if (validDirs.length === 0) return gameStats;
        const charStats = await dispatchPool(validDirs, MaxConcurrency, (d) => probeCREDir(path.join(gamePath, d.name)));
        for (const cs of charStats) {
            if (cs?.__error) continue;
            gameStats.images += cs.images;
            gameStats.size += cs.size;
        }
    } catch {}
    return gameStats;
}

async function probeRepo(repoPath) {
    const result = {
        summary: { size: 0, gitSize: 0, filesSize: 0 },
        games: {}
    };
    const gameResults = await dispatchPool(DirNames, DirNames.length, async (dirName) => {
        const stats = await probeGameDir(path.join(repoPath, dirName));
        return { dirName, stats };
    });
    for (const { dirName, stats } of gameResults) {
        result.games[dirName] = stats;
        result.summary.filesSize += stats.size;
    }
    result.summary.size = result.summary.filesSize;
    return result;
}

async function syncBatch(payload) {
    let success = 0, fail = 0;
    const results = await dispatchPool(payload, MaxConcurrency, async ({ src, dest }) => {
        try {
            await fs.mkdir(path.dirname(dest), { recursive: true });
            await fs.copyFile(src, dest);
            return true;
        } catch {
            return false;
        }
    });
    for (const ok of results) {
        if (ok) success++; else fail++;
    }
    return { success, fail };
}

async function scanStats(payload) {
    const repos = Array.isArray(payload) ? payload : (payload?.repos || []);
    const results = {};
    const repoResults = await dispatchPool(repos, Math.min(repos.length, 4), async (repo) => {
        const stats = await probeRepo(repo.path);
        return { name: repo.name, stats };
    });
    for (const { name, stats } of repoResults) {
        results[name] = stats;
    }
    return results;
}

const _dispatch = {
    SYNC_BATCH: syncBatch,
    SCAN_STATS: scanStats
};

parentPort.on('message', async (msg) => {
    const { type, id, payload } = msg;
    try {
        const fn = _dispatch[type];
        if (!fn) {
            parentPort.postMessage({ type: 'ERROR', id, error: `未知任务类型: ${type}` });
            return;
        }
        const result = await fn(payload);
        parentPort.postMessage({ type: 'DONE', id, result });
    } catch (err) {
        parentPort.postMessage({ type: 'ERROR', id, error: err.message });
    }
});