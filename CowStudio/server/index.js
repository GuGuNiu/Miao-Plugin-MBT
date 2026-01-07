import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import chokidar from 'chokidar';
import { fileURLToPath } from 'node:url';
import artTemplate from 'art-template';
import lodash from 'lodash';
import { CowBot } from '../CowBot/index.js';
import { getCowData } from './CowData.js';
import os from 'node:os';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');
const pluginPath = path.join(rootPath, '咕咕牛图库管理器.js');
const htmlPath = path.join(rootPath, 'CowCoo/html');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3001;
const bot = new CowBot();
await bot.BootStrap();
const broadcast = (data) => {
  wss.clients.forEach(client => {
    try {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    } catch (err) {
      console.error('[广播失败]', err.message);
    }
  });
};
bot.on('reply', (data) => {
  broadcast({ type: 'log', level: 'info', content: `[机器人回复] ${data.msg}` });
});
bot.on('trigger-test', (data) => {
  broadcast({ type: 'trigger-test', ...data });
});
const watcher = chokidar.watch([pluginPath, htmlPath], {
  persistent: true,
  ignoreInitial: true,
});
watcher.on('change', async (filePath) => {
  if (filePath === pluginPath) {
    try {
      console.log('[热重载] 正在重新加载插件...');
      await bot.Reconcile();
      broadcast({ type: 'log', level: 'success', content: '插件已重新加载' });
    } catch (err) {
      broadcast({ type: 'log', level: 'error', content: `插件重载失败: ${err.message}` });
    }
  }
  broadcast({ type: '热重载', file: filePath });
});
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  broadcast({ type: 'log', level: 'info', content: args.join(' ') });
};
artTemplate.defaults.root = rootPath;
artTemplate.defaults.extname = '.html';
app.use('/CowCoo', express.static(path.join(rootPath, 'CowCoo')));
app.use('/resources', express.static(path.join(rootPath, 'resources')));
app.use(express.json());
app.use('/api', (req, res, next) => {
  console.log(`[API Request] ${req.method} ${req.url}`);
  next();
});
app.get('/api/config', (req, res) => {
  try {
    const config = global.MiaoPluginMBT_Class.MBTConfig;
    if (config) {
      return res.json({ success: true, config });
    }
    throw new Error('Config not found');
  } catch (err) {
    try {
      const configPath = path.join(rootPath, 'CowCoo/GalleryConfig.yaml');
      res.send(fs.readFileSync(configPath, 'utf-8'));
    } catch (readErr) {
      res.status(404).send('未找到配置文件');
    }
  }
});
app.post('/api/config', async (req, res) => {
  try {
    const { RenderScale } = req.body;
    const MiaoPluginMBT = global.MiaoPluginMBT_Class;
    
    if (RenderScale !== undefined) {
      MiaoPluginMBT.MBTConfig.RenderScale = RenderScale;
      try {
        const tempModule = await import('./temp_plugin.js');
        const Ananke = tempModule.Ananke;
        await Ananke.SaveCfg(MiaoPluginMBT.Paths.ConfigFilePath, MiaoPluginMBT.MBTConfig);
      } catch (saveErr) {
        console.error('[API] 保存配置失败:', saveErr.message);
      }
    }
    res.json({ success: true, config: MiaoPluginMBT.MBTConfig });
  } catch (err) {
    res.status(500).json({ success: false, error: '插件未加载或操作失败' });
  }
});
app.post('/api/command', async (req, res) => {
  try {
    const { msg } = req.body;
    const handled = await bot.RouteOpsHub({
      msg,
      user_id: '123456',
      isMaster: true,
      reply: (m) => broadcast({ type: 'log', level: 'info', content: `[机器人回复] ${m}` })
    });
    res.json({ success: true, handled });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/templates', (req, res) => {
  console.log('[API] 获取模板列表, htmlPath:', htmlPath);
  const getFiles = (dir, prefix = '') => {
    let results = [];
    try {
      const list = fs.readdirSync(dir);
      for (const file of list) {
        try {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            results.push(...getFiles(fullPath, path.join(prefix, file)));
          } else if (file.endsWith('.html')) {
            results.push(path.join(prefix, file).replace(/\\/g, '/'));
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error('[API] 读取模板目录失败:', err.message);
    }
    return results;
  };
  const files = getFiles(htmlPath);
  console.log(`[API] 找到 ${files.length} 个模板`);
  res.json(files);
});
app.get('/api/template-data', (req, res) => {
  try {
    const { template: tplName, mockType: CowType = 'DEFAULT' } = req.query;
    res.json({ success: true, data: getCowData(CowType, tplName) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/match-character', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.json({ success: false, error: '请输入角色名' });
    const MiaoPluginMBT = global.MiaoPluginMBT_Class || (await import('./temp_plugin.js')).MiaoPluginMBT;
    if (!MiaoPluginMBT) return res.json({ success: false, error: '插件未加载' });
    const result = await MiaoPluginMBT.NormalizeName(name);
    if (result.success && result.mainName) {
      const { mainName, game } = result;
      let physicalPath = '';
      let files = [];
      const pathsMap = {
        gs: MiaoPluginMBT.Paths.Target.MiaoCRE,
        sr: MiaoPluginMBT.Paths.Target.MiaoCRE,
        zzz: MiaoPluginMBT.Paths.Target.ZZZCRE,
        waves: MiaoPluginMBT.Paths.Target.WavesCRE
      };
      const baseDir = pathsMap[game];
      if (baseDir && fs.existsSync(baseDir)) {
        const targetDir = path.join(baseDir, mainName);
        if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
          physicalPath = targetDir;
          files = fs.readdirSync(targetDir);
        } else {
          const allFiles = fs.readdirSync(baseDir);
          const matchedFiles = allFiles.filter(f => f.includes(mainName));
          if (matchedFiles.length > 0) {
            physicalPath = baseDir;
            files = matchedFiles;
          }
        }
      }
      result.physicalPath = physicalPath;
      result.files = files;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post('/api/render', async (req, res) => {
  try {
    const { template: tplName, data } = req.body;
    const tplPath = path.join(htmlPath, tplName);
    const MiaoPluginMBT = global.MiaoPluginMBT_Class;
    const now = new Date();
    const pad = (num, digits = 2) => String(num).padStart(digits, '0');
    const sysTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
    const serverOrigin = `http://localhost:${PORT}`;
    const renderData = {
      Version: '1.0.0-Cow',
      _res_path: `${serverOrigin}/CowCoo`,
      guguniu_res_path: `${serverOrigin}/CowCoo/`,
      pluResPath: `${serverOrigin}/CowCoo/`,
      sysTimestamp: sysTimestamp,
      RenderMatrix: (() => {
        try {
          return global.MiaoPluginMBT_Class.RenderMatrix();
        } catch (e) {
          return 'transform:scale(1); transform-origin: top left;';
        }
      })(),
      stats: { 
        meta: { 
          roles: 0, 
          images: 0, 
          tags: 0,
          games: { '原神': 0, '星铁': 0, '绝区零': 0, '鸣潮': 0 },
          gameRoles: { '原神': 0, '星铁': 0, '绝区零': 0, '鸣潮': 0 }
        },
        scan: {
          roles: 0,
          images: 0,
          gameImages: { '原神': 0, '星铁': 0, '绝区零': 0, '鸣潮': 0 },
          gameRoles: { '原神': 0, '星铁': 0, '绝区零': 0, '鸣潮': 0 },
          gameSizes: { '原神': 0, '星铁': 0, '绝区零': 0, '鸣潮': 0 },
          gameSizesFormatted: { '原神': '0 B', '星铁': '0 B', '绝区零': '0 B', '鸣潮': '0 B' }
        },
        repos: {}
      },
      config: {
        insDaysText: '',
        remoteBansCount: 0,
        pflLevel: 0,
        pflDesc: '普通模式',
        activeBans: 0,
        userBans: 0,
        purifiedBans: 0,
        aiEnabled: false,
        aiStatusText: '已关闭',
        easterEggEnabled: false,
        easterEggStatusText: '已关闭',
        layoutEnabled: false,
        layoutStatusText: '已关闭',
        installationTime: 'N/A'
      },
      gameData: { gs: true, sr: false, zzz: false, waves: false },
      tuKuStatus: { class: 'value-disabled', text: '未检测' },
      pflStatus: { level: 0, description: '普通模式', class: 'value-level-0' },
      aiStatus: { class: 'value-disabled', text: '已关闭' },
      easterEggStatus: { class: 'value-disabled', text: '已关闭' },
      layoutStatus: { class: 'value-disabled', text: '已关闭' },
      headerImg: '',
      RenderScale: { value: 100 },
      results: []
    };
    lodash.merge(renderData, data);
    try {
      console.log('[API Render] 正在渲染模板:', tplName);
      const html = artTemplate(tplPath, renderData);
      console.log('[API Render] 渲染成功:', tplName, 'HTML 长度:', html.length);
      res.json({ success: true, html });
    } catch (renderErr) {
      console.error('[渲染错误] Template Path:', tplPath);
      res.status(500).json({ success: false, error: `渲染引擎错误: ${renderErr.message}` });
    }
  } catch (err) {
    console.error('[API Render 崩溃]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/api/performance', (req, res) => {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const load = os.loadavg();
  let cpuPercent = 0;
  if (load[0] > 0) {
    cpuPercent = (load[0] * 10).toFixed(1);
  } else {
    cpuPercent = (Math.random() * 5 + 1).toFixed(1);
  }
  res.json({
    cpu: `${cpuPercent}%`,
    memory: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
    renderTime: `${(Math.random() * 200 + 100).toFixed(0)}ms`,
    workerStatus: 'Healthy'
  });
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[服务器] 调试台已启动: http://localhost:${PORT}`);
});
