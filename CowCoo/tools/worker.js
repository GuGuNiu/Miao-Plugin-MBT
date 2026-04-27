import { parentPort } from 'node:worker_threads';
import fs from 'node:fs/promises';
import path from 'node:path';

async function runWorkTask(tasks, limit, iteratorFn) {
    const results = [];
    const executing = [];
    for (const item of tasks) {
        const p = Promise.resolve().then(() => iteratorFn(item));
        results.push(p);
        if (limit <= tasks.length) {
            const e = p.then(() => executing.splice(executing.indexOf(e), 1));
            executing.push(e);
            if (executing.length >= limit) await Promise.race(executing);
        }
    }
    return Promise.allSettled(results);
}

async function scanCharDir(dirPath) {
    let stats = { images: 0, size: 0 };
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        for (const file of files) {
            if (file.isFile() && /\.(webp|png|jpg|jpeg|bmp)$/i.test(file.name)) {
                stats.images++;
                try {
                    const s = await fs.stat(path.join(dirPath, file.name));
                    stats.size += s.size;
                } catch {}
            }
        }
    } catch {}
    return stats;
}

async function scanDir(gamePath) {
    let gameStats = { roles: 0, images: 0, size: 0 };
    try {
        const entries = await fs.readdir(gamePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                gameStats.roles++;
                const charStats = await scanCharDir(path.join(gamePath, entry.name));
                gameStats.images += charStats.images;
                gameStats.size += charStats.size;
            }
        }
    } catch {}
    return gameStats;
}

async function scanRepo(repoPath) {
    const TARGET_DIRS = ["gs-character","sr-character","zzz-character","waves-character"];
    const result = {
        summary: { size: 0, gitSize: 0, filesSize: 0 },
        games: {}
    };

    for (const dirName of TARGET_DIRS) {
        const gamePath = path.join(repoPath, dirName);
        const stats = await scanDir(gamePath);
        result.games[dirName] = stats;
        result.summary.filesSize += stats.size;
    }

    result.summary.size = result.summary.filesSize;
    return result;
}

parentPort.on('message', async (msg) => {
    const { type, id, payload } = msg;
    try {
        if (type === 'SYNC_BATCH') {
            let success = 0, fail = 0;
            await runWorkTask(payload, 20, async ({ src, dest }) => {
                try {
                    await fs.mkdir(path.dirname(dest), { recursive: true });
                    await fs.copyFile(src, dest);
                    success++;
                } catch {
                    fail++;
                }
            });
            parentPort.postMessage({ type: 'DONE', id, result: { success, fail } });
        } else if (type === 'SCAN_STATS') {
            const results = {};
            for (const repo of payload) {
                results[repo.name] = await scanRepo(repo.path);
            }
            parentPort.postMessage({ type: 'DONE', id, result: results });
        }
    } catch (err) {
        parentPort.postMessage({ type: 'ERROR', id, error: err.message });
    }
});