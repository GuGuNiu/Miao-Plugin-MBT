const Version = '1.0.0-Cow';
export const getCowData = (type, templateName) => {
  const baseData = {
    Version: Version,
    pluginVersion: Version,
    RenderMatrix: 'transform:scale(1); transform-origin: top left;',
    sysTimestamp: new Date().toLocaleString(),
    scaleStyleValue: 'scale(1)',
    isArray: Array.isArray,
    duration: (Math.random() * 20 + 10).toFixed(1),
    reportTime: new Date().toLocaleString(),
    _res_path: 'http://localhost:3001/resources/CowCoo/',
    guguniu_res_path: 'http://localhost:3001/resources/CowCoo/',
    pluResPath: 'http://localhost:3001/resources/CowCoo/',
    stats: {
      meta: {
        roles: 0,
        images: 0,
        tags: 0
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
      insDaysText: '已安装 1 天',
      remoteBansCount: 0,
      pflLevel: 1,
      pflDesc: '净化模式',
      activeBans: 0,
      userBans: 0,
      purifiedBans: 0,
      aiEnabled: false,
      aiStatusText: '已关闭',
      easterEggEnabled: false,
      easterEggStatusText: '已关闭',
      layoutEnabled: false,
      layoutStatusText: '已关闭',
      installationTime: '2026-01-01'
    },
    gameData: {
      gs: true,
      sr: false,
      zzz: false,
      waves: false
    }
  };
  const CowFaceUrl = "/resources/CowCoo/icon/null-btn.png";
  const repoNames = { 1: "一号仓库 (核心)", 2: "二号仓库 (原神)", 3: "三号仓库 (星铁)", 4: "四号仓库 (鸣潮&绝区零)" };
  const getStatusInfo = (result) => {
    try {
      const repoName = repoNames[result.repo] || `仓库 ${result.repo}`;
      const statusMap = {
        '本地': { name: repoName, text: '已存在', statusClass: 'status-local', nodeName: '本地' }
      };
      
      const predefined = statusMap[result.nodeName];
      if (predefined) return predefined;

      if (result.success) {
        return { name: repoName, text: result.repo === 1 ? '下载/部署成功' : '下载成功', statusClass: 'status-ok', nodeName: result.nodeName };
      }
    } catch (e) {
    }
    return { name: repoNames[result.repo] || `仓库 ${result.repo}`, text: '下载失败', statusClass: 'status-fail', nodeName: result.nodeName || '执行异常' };
  };
  const buildReportData = (results, overallSuccess) => {
    const successCount = results.filter(r => r.statusClass === 'status-ok' || r.statusClass === 'status-local').length;
    const totalCount = results.length;
    const percent = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
    return {
      ...baseData,
      results: results,
      overallSuccess: overallSuccess,
      successCount: successCount,
      totalConfigured: totalCount,
      successRate: percent,
      successRateRounded: percent,
    };
  };
  const CowLog = [{ date: "刚刚", displayParts: [{ type: 'text', content: `feat: 模拟更新 (${type})` }] }];
  const defaultData = {
    ...baseData,
    tuKuStatus: { class: 'value-enabled', text: '已启用' },
    pflStatus: { level: 1, description: '净化模式' },
    results: [],
    overallSuccess: true,
    overallHasChanges: false
  };
  switch (type) {
    case 'UP_REPORT_FULL_COW': {
      const repo1Log = [
        { hash: "fakehash1", isDescription: false, date: '[07-07 14:47]', displayParts: [{ name: '橘福福', imageUrl: CowFaceUrl }, { name: '伊芙琳', imageUrl: CowFaceUrl }] },
        { hash: "fakehash2", isDescription: true, date: '[07-07 11:00]', descriptionTitle: 'Feat: 增加配置文件自动修复能力', descriptionBodyHtml: '<p>实现本地配置自愈。</p>' }
      ];
      return {
        ...baseData,
        overallSuccess: true,
        overallHasChanges: true,
        duration: '84.7',
        results: [
          {
            name: "一号仓库",
            statusText: "更新成功",
            statusClass: "status-ok",
            newCommitsCount: 2,
            log: repo1Log,
            hasChanges: true,
            commitSha: 'a1b2c3d',
            hasValidLogs: true,
            shouldHighlight: true
          },
          {
            name: "二号仓库",
            statusText: "已是最新",
            statusClass: "status-no-change",
            newCommitsCount: 0,
            log: [],
            hasChanges: false,
            commitSha: 'e4f5g6h'
          }
        ]
      };
    }
    case 'DL_REPORT_SUCCESS': {
      const results = [
        getStatusInfo({ repo: 1, success: true, nodeName: 'Ghfast(代理)' }),
        getStatusInfo({ repo: 2, success: true, nodeName: '本地' })
      ];
      return buildReportData(results, true);
    }
    case 'DL_REPORT_MIXED': {
      const results = [
        getStatusInfo({ repo: 1, success: true, nodeName: 'Ghfast(代理)' }),
        getStatusInfo({ repo: 3, success: false, nodeName: 'GitHub(直连)' })
      ];
      return buildReportData(results, false);
    }
    case 'DL_PROGRESS': return { ...baseData, title: "正在下载依赖...", subtitle: "(附属仓库聚合下载)", nodeName: "多节点并发", progress: 68, statusMessage: "接收数据中..." };
    case 'DIFFSTAT_COW': {
      const CowLogEntry = { date: "刚刚", isDescription: true, descriptionTitle: "feat: 功能变更", descriptionBodyHtml: "<p>本次更新包含文件变更。</p>" };
      const noChangeLog = [{ date: "昨天", isDescription: true, descriptionTitle: "fix: 常规修复", descriptionBodyHtml: "" }];
      return {
        ...baseData,
        overallSuccess: true,
        overallHasChanges: true,
        duration: '42.0',
        results: [
          {
            name: "一号仓库", statusText: "更新成功", statusClass: "status-ok",
            hasChanges: true, newCommitsCount: 1, log: [CowLogEntry], commitSha: 'a1b2c3d',
            diffStat: { insertions: 27, deletions: 24 }
          },
          {
            name: "二号仓库", statusText: "更新成功", statusClass: "status-ok",
            hasChanges: true, newCommitsCount: 1, log: [CowLogEntry], commitSha: 'b4c5d6e',
            diffStat: { insertions: 158, deletions: 0 }
          },
          {
            name: "三号仓库", statusText: "本地冲突 (强制同步)", statusClass: "status-force-synced",
            hasChanges: true, newCommitsCount: 1, log: [mockLogEntry], commitSha: 'c7d8e9f',
            diffStat: { insertions: 0, deletions: 99 }
          },
          {
            name: "四号仓库", statusText: "已是最新", statusClass: "status-no-change",
            hasChanges: false, newCommitsCount: 0, log: noChangeLog, commitSha: 'd1e2f3g',
            diffStat: null
          }
        ]
      };
    }
    case 'CONVENTIONAL_COMMITS_COW': {
      const CowCommitsData = [
        { prefix: 'feat', scope: 'Web Core', title: '兼容来自Miao/ZZZ/Waves的差距逻辑', body: '引入了新的差距算法，以更好地处理来自不同插件的数据源。' },
        { prefix: 'fix', scope: 'Web Core', title: '核心逻辑问题', body: '修复了一个可能导致在极端情况下配置丢失的严重问题。' },
        { prefix: 'docs', scope: 'Web', title: 'Web控制台的说明修改', body: '更新了Web控制台的相关文档，使其更易于理解和使用。' },
        { prefix: 'style', scope: 'Web Home', title: '调整了主页UI布局', body: '对Web主页的UI进行了微调，使其在不同分辨率下表现更佳。' },
        { prefix: 'refactor', scope: 'core', title: 'v5.0.7 架构重构', body: '对主插件的核心架构进行了大规模重构，提升可维护性。' },
        { prefix: 'perf', title: '提升图片合成速度', body: '通过优化渲染引擎，将面板生成时间减少了20%。' }
      ];
      const CowLog = CowCommitsData.map((item, index) => {
        let simplifiedScope = null;
        let scopeClass = 'scope-default';
        try {
          const lowerScope = item.scope.toLowerCase();
          const scopeMapping = {
            'web': { scope: 'WEB', class: 'scope-web' },
            'core': { scope: 'CORE', class: 'scope-core' }
          };
          
          for (const key in scopeMapping) {
            if (lowerScope.includes(key)) {
              simplifiedScope = scopeMapping[key].scope;
              scopeClass = scopeMapping[key].class;
              break;
            }
          }
        } catch (e) {
        }
        return {
          isDescription: true,
          date: `[${index + 1} hours ago]`,
          commitPrefix: item.prefix,
          commitScope: simplifiedScope ? simplifiedScope.replace(/\s+/g, '&nbsp;') : null,
          commitScopeClass: scopeClass,
          commitTitle: item.title,
          descriptionBodyHtml: `<p>${item.body}</p>`
        };
      });
      return {
        ...baseData,
        overallSuccess: true,
        overallHasChanges: true,
        duration: '1.0',
        results: [
          {
            name: "一号仓库",
            statusText: "更新成功",
            statusClass: "status-ok",
            hasChanges: true,
            newCommitsCount: CowLog.length,
            log: CowLog,
            commitSha: 'c0nv3nt10n4l',
            hasValidLogs: true,
            shouldHighlight: true
          }
        ]
      };
    }
    case 'SIMULATE_ERROR_WITH_LOG_CONTEXT': {
      return {
        ...baseData,
        overallSuccess: false,
        error: "执行过程中发生未知错误",
        errorStack: "Error: Unexpected token at Object.parse (native)\n    at Core.handle (/src/core.js:124:32)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)",
        logContext: [
          "14:20:01 [DEBUG] 开始解析远程配置...",
          "14:20:02 [INFO] 成功连接到 Ghfast 代理",
          "14:20:03 [ERROR] 解析配置失败: 格式错误"
        ]
      };
    }
    case 'TRIGGER_DOWNLOAD_TYPEERROR_WITH_CONTEXT': {
      return {
        ...baseData,
        overallSuccess: false,
        errorType: "TypeError",
        errorMessage: "Cannot read properties of undefined (reading 'split')",
        snapshot: {
          url: "https://github.com/GuGuNiu/Miao-Plugin-MBT",
          branch: "master",
          lastTag: undefined
        }
      };
    }
    case 'THROW_RENDER_NULL_BUFFER': {
      return {
        ...baseData,
        renderStatus: "failed",
        reason: "Puppeteer returned null buffer",
        retryCount: 3
      };
    }
    default:
      return defaultData;
  }
};
