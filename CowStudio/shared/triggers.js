export const TRIGGER_CATEGORIES = [
  {
    name: "核心功能模拟",
    items: [
      { id: 1, name: "更新报告: 完整模拟", description: "模拟包含多条高亮、多种提交类型的完整更新报告。", type: "UP_REPORT_FULL_COW" },
      { id: 2, name: "更新报告: 差异统计", description: "展示文件变更行数统计的报告。", type: "DIFFSTAT_COW" },
      { id: 3, name: "更新报告: 规范化提交", description: "展示 Conventional Commits 风格的提交日志。", type: "CONVENTIONAL_COMMITS_COW" },
      { id: 4, name: "下载报告: 全部成功", description: "模拟所有仓库下载成功的情景。", type: "DL_REPORT_SUCCESS" },
      { id: 5, name: "下载报告: 混合结果", description: "模拟部分成功、部分失败的情景。", type: "DL_REPORT_MIXED" },
      { id: 6, name: "下载进度: 聚合显示", description: "模拟多个仓库同时下载的进度条。", type: "DL_PROGRESS" }
    ]
  },
  {
    name: "异常流程测试",
    items: [
      { id: 10, name: "模拟顶层错误", description: "触发一个包含日志上下文的执行错误。", type: "SIMULATE_ERROR_WITH_LOG_CONTEXT" },
      { id: 11, name: "模拟类型错误", description: "触发 TypeError 并捕获状态快照。", type: "TRIGGER_DOWNLOAD_TYPEERROR_WITH_CONTEXT" },
      { id: 12, name: "模拟渲染空值", description: "模拟 Puppeteer 返回空 Buffer 的情况。", type: "THROW_RENDER_NULL_BUFFER" }
    ]
  }
];
