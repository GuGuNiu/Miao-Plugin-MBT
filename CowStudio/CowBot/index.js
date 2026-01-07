import path from 'node:path';
import { EventEmitter } from 'node:events';
import lodash from 'lodash';
import fs from 'node:fs';
export class CowPlugin {
  constructor(data = {}) {
    this.name = data.name || 'CowPlugin';
    this.dsc = data.dsc || 'CowPlugin';
    this.event = data.event || 'message';
    this.priority = data.priority || 5000;
    this.rule = data.rule || [];
    this.task = data.task || {};
  }
  async reply(msg, quote = false, data = {}) {
    try {
      global.Bot.emit('reply', { msg, quote, data, plugin: this.name });
    } catch (e) {
    }
    return true;
  }
}
export const Ass = {
  at: (qq) => `[at:${qq}]`,
  image: (file) => `[image:${file}]`,
  record: (file) => `[record:${file}]`,
  video: (file) => `[video:${file}]`,
  reply: (id) => `[reply:${id}]`,
};
export class CowBot extends EventEmitter {
  constructor() {
    super();
    this.TheGrid = [];
    this.PolymorphicSink = {
      info: (...args) => this._Debrief('info', ...args),
      debu: (...args) => this._Debrief('debu', ...args),
      debug: (...args) => this._Debrief('debu', ...args),
      error: (...args) => this._Debrief('error', ...args),
      warn: (...args) => this._Debrief('warn', ...args),
      mark: (...args) => this._Debrief('mark', ...args),
    };
    global.logger = this.PolymorphicSink;
    global.lodash = lodash;
    global._ = lodash;
    global.Bot = this;
    global.plugin = CowPlugin; 
    global.segment = Ass;
    global.redis = {
      get: async (key) => null,
      set: async (key, val, options) => 'OK',
      del: async (key) => 1,
      exists: async (key) => 0,
    };
    const RP = path.resolve(process.cwd(), '../');
    const DP = path.join(process.cwd(), 'temp', 'MiaoPluginMBT');
    const opsPath = path.join(RP, 'CowCoo');
    try {
      fs.mkdirSync(DP, { recursive: true });
    } catch (err) {
      this.PolymorphicSink.error(`创建临时目录失败: ${err.message}`);
    }
    global.MiaoPluginMBT = {
      Paths: {
        TempNiuPath: DP,
        OpsPath: opsPath,
        BgImgPath: path.join(opsPath, 'html', 'img')
      },
      RenderMatrix: (baseScale = 1) => {
        return `transform:scale(${baseScale}); transform-origin: top left;`;
      }
    };
  }
  _Debrief(level, ...args) {
    const colors = {
      info: '\x1b[32m',  
      debu: '\x1b[90m',  
      warn: '\x1b[33m',  
      error: '\x1b[31m', 
      mark: '\x1b[35m',  
      reset: '\x1b[0m',
      cowbot: '\x1b[36m' 
    };
    const content = args.map(a => {
      if (a instanceof Error) {
        return a.stack || `${a.name}: ${a.message}`;
      }
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a, null, 2);
        } catch (e) {
          return '[Object]';
        }
      }
      return String(a);
    }).join(' ');
    const color = colors[level] || colors.reset;
    console.log(`${colors.cowbot}[CowBot]${colors.reset}${color}[${level}]${colors.reset}`, content);
    this.emit('log', { level, content });
  }
  async BootStrap() {
    this.PolymorphicSink.info("CowBot 正在启动...");
    await this.Reconcile();
    this.PolymorphicSink.info("CowBot 启动成功");
  }
  async Reconcile() {
    try {
      const originalPath = path.resolve(process.cwd(), '../咕咕牛图库管理器.js');
      const tempPath = path.join(process.cwd(), 'server', 'temp_plugin.js');
      let content = await fs.promises.readFile(originalPath, 'utf-8');
      content = content.replace(/['"]\.\.\/\.\.\/lib\/common\/common\.js['"]/g, "'../CowEnv/lib/common/common.js'");
      content = content.replace(/const YzPath = path\.resolve\(__dirname, "\.\.", "\.\."\);/, `const YzPath = path.resolve(process.cwd(), '../');`);
      const patchedPaths = `{
    YzPath: path.resolve(process.cwd(), '../'),
    MountRepoPath: path.resolve(process.cwd(), '../'),
    OpsPath: path.resolve(process.cwd(), '../CowCoo'),
    SecTagsPath: path.resolve(process.cwd(), '../CowCoo/SecondTags.json'),
    BgImgPath: path.resolve(process.cwd(), '../CowCoo/html/img'),
    ComResPath: path.resolve(process.cwd(), '../CowCoo'),
    ConfigFilePath: path.resolve(process.cwd(), '../CowCoo/GalleryConfig.yaml'),
    BanListPath: path.resolve(process.cwd(), '../CowCoo/banlist.json'),
    RTCPath: path.resolve(process.cwd(), '../CowCoo/RepoStatsCache.json'),
    WavesRoleData: path.resolve(process.cwd(), '../CowCoo/waves/RoleData.json'),
    TempHtmlPath: path.resolve(process.cwd(), 'temp/html'), 
    TempNiuPath: path.resolve(process.cwd(), 'temp/CowCoo'), 
    TempDownloadPath: path.resolve(process.cwd(), 'temp/CowCoo/Tasks'),
    Target: {
      MiaoCRE: path.join(path.resolve(process.cwd(), '../'), "plugins", "miao-plugin", "resources", "profile", "normal-character"),
      ZZZCRE: path.join(path.resolve(process.cwd(), '../'), "plugins", "ZZZ-Plugin", "resources", "images", "panel"),
      WavesCRE: path.join(path.resolve(process.cwd(), '../'), "plugins", "waves-plugin", "resources", "rolePic"),
      Example: path.join(path.resolve(process.cwd(), '../'), "plugins", "example"),
      Miao_GSAliasDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "miao-plugin", "resources", "meta-gs", "character"),
      Miao_SRAliasDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "miao-plugin", "resources", "meta-sr", "character"),
      ZZZ_AliasDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "ZZZ-Plugin", "defset"),
      ZZZ_DataDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "ZZZ-Plugin", "resources", "data", "hakush", "data", "character"),
      ZZZ_FaceDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "ZZZ-Plugin", "resources", "images", "role_circle"),
      Waves_AliasDir: path.join(path.resolve(process.cwd(), '../'), "plugins", "waves-plugin", "resources", "Alias"),
    },
    SourceDir: { gs: "gs-character", sr: "sr-character", zzz: "zzz-character", waves: "waves-character", gallery: "CowCoo" },
    LinkFiles: []
  }`;
      content = content.replace(/static Paths = \{[\s\S]+?\};/, `static Paths = ${patchedPaths};`);
      await fs.promises.writeFile(tempPath, content, 'utf-8');
      const module = await import(`file://${tempPath}`);
      this.TheGrid = [];
      for (const key in module) {
        try {
          const PluginClass = module[key];
          if (key === 'MiaoPluginMBT') {
            global.MiaoPluginMBT_Class = PluginClass;
          }
          if (PluginClass.prototype instanceof global.plugin) {
            const instance = new PluginClass();
            this.TheGrid.push(instance);
            this.PolymorphicSink.info(`成功加载插件: ${instance.name}`);
          }
        } catch (e) {
        }
      }
    } catch (err) {
      this.PolymorphicSink.error(`加载插件失败: ${err.message}`);
    }
  }
  async RouteOpsHub(e) {
    for (const plugin of this.TheGrid) {
      try {
        for (const rule of plugin.rule) {
          const reg = new RegExp(rule.reg);
          if (reg.test(e.msg)) {
            e.reply = e.reply || ((msg) => this.PolymorphicSink.info(`[${plugin.name}] ${msg}`));
            const result = await plugin[rule.fnc](e);
            if (result !== false) return true;
          }
        }
      } catch (err) {
        this.PolymorphicSink.error(`插件 [${plugin.name}] 执行错误: ${err.message}`);
      }
    }
    return false;
  }
}
export const CowCommon = {
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  render: async (name, tpl, data, cfg) => {
    global.Bot.emit('trigger-test', {
      name: `渲染: ${tpl}`,
      CowType: 'CUSTOM_RENDER',
      data: data
    });
    return true;
  }
};
export const CowPaths = {
  get RP() {
    return path.resolve(process.cwd());
  },
  get DP() {
    return path.join(this.RP, 'temp');
  }
};
