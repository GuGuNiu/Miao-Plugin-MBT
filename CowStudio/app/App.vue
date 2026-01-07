<template>
  <n-config-provider :theme="isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <n-global-style />
    <div :class="{ 'dark': isDark }" class="h-screen w-screen relative overflow-hidden bg-slate-50 dark:bg-[#0d0d0d]">
      <n-layout has-sider class="h-full bg-transparent">
        <n-layout-sider
          bordered
          :width="310"
          class="z-20 shadow-[4px_0_15px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_15px_rgba(0,0,0,0.4)]"
        >
          <div class="h-full flex flex-col bg-white dark:bg-[#1e1e1e] overflow-hidden">
            <div class="pt-8 pb-8 pl-4 pr-8 bg-white dark:bg-[#1e1e1e] border-b border-r border-slate-100 dark:border-[#333] relative z-10">
              <div class="flex items-center gap-4 transform scale-125 origin-left">
                <div class="w-16 h-16 flex items-center justify-center overflow-hidden">
                  <img :src="logoUrl" alt="Logo" class="w-full h-full object-contain" />
                </div>
                <div class="flex flex-col">
                  <div class="flex items-baseline gap-1.5">
                    <span class="text-2xl font-black text-slate-900 dark:text-white whitespace-nowrap leading-tight tracking-tighter">CowCoo</span>
                    <span class="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 whitespace-nowrap leading-tight tracking-tighter">Studio</span>
                  </div>
                  <div class="flex items-center gap-0.5">
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-[0.15em] uppercase opacity-80">
                      {{ activeTab === 'renderer' ? 'Debug Console' : 'Matcher Engine' }}
                    </span>
                    <div class="px-[7.6px] py-[1.9px] rounded-md bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 backdrop-blur-md border border-white/20 shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)] flex items-center justify-center">
                      <span class="text-[8.8px] font-black text-white/90 tracking-tighter drop-shadow-sm leading-none">v1.1</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="px-4 py-6 border-b border-slate-100 dark:border-[#333] flex justify-center bg-slate-50/20 dark:bg-[#1e1e1e]">
              <div class="flex items-center p-1 bg-slate-100 dark:bg-[#2a2a2a] rounded-2xl border border-slate-200 dark:border-[#333] relative shadow-inner">
                <div 
                  class="absolute h-[calc(100%-8px)] rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                  :style="{
                    top: '4px',
                    left: '4px',
                    width: activeTab === 'renderer' ? '100px' : '130px',
                    transform: activeTab === 'renderer' ? 'translateX(0)' : 'translateX(100px)'
                  }"
                ></div>
                <button 
                  class="flex items-center justify-center gap-2 w-[100px] py-2 rounded-xl transition-all duration-300 relative z-10"
                  :class="activeTab === 'renderer' ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
                  @click="activeTab = 'renderer'"
                >
                  <LayoutIcon :size="16" />
                  <span class="text-[13px] font-bold">渲染器</span>
                </button>
                <button 
                  class="flex items-center justify-center gap-2 w-[130px] py-2 rounded-xl transition-all duration-300 relative z-10"
                  :class="activeTab === 'matcher' ? 'text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
                  @click="activeTab = 'matcher'"
                >
                  <UserSearchIcon :size="16" />
                  <span class="text-[13px] font-bold whitespace-nowrap">角色匹配</span>
                </button>
              </div>
            </div>
            <div class="flex-1 flex flex-col min-h-0 relative overflow-hidden">
              <Transition name="fade" mode="out-in">
                <div v-if="activeTab === 'renderer'" key="renderer-side" class="absolute inset-0 flex flex-col min-h-0">
                  <div class="px-6 py-4 border-b border-slate-100 dark:border-[#333] bg-slate-50/30 dark:bg-[#252525]/30">
                    <div class="flex flex-col gap-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">渲染精度</span>
                        <span class="text-[12px] font-mono font-bold text-blue-600 dark:text-blue-400">{{ renderScale }}%</span>
                      </div>
                      <n-slider v-model:value="renderScale" :min="100" :max="1000" :step="10" @update:value="onConfigInput" />
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">范围: 100% - 1000% (默认 300%)</p>
                    </div>
                  </div>
                  <div class="flex-1 flex flex-col min-h-0 px-4 space-y-8 py-8 overflow-y-auto custom-scrollbar">
                    <div class="pt-2">
                      <label class="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 block px-1">
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Cowbot</span> 运行状态
                      </label>
                      <div class="grid grid-cols-2 gap-3">
                        <div class="p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2 mb-1.5">
                            <CpuIcon :size="14" class="text-blue-500" />
                            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Cpu 占用</span>
                          </div>
                          <div class="text-lg font-black text-slate-700 dark:text-slate-200 tracking-tight">{{ performanceData.cpu }}</div>
                        </div>
                        <div class="p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2 mb-1.5">
                            <HardDriveIcon :size="14" class="text-indigo-500" />
                            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">内存分配</span>
                          </div>
                          <div class="text-lg font-black text-slate-700 dark:text-slate-200 tracking-tight">{{ performanceData.memory }}</div>
                        </div>
                        <div class="p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2 mb-1.5">
                            <ClockIcon :size="14" class="text-amber-500" />
                            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">渲染耗时</span>
                          </div>
                          <div class="text-lg font-black text-slate-700 dark:text-slate-200 tracking-tight">{{ performanceData.renderTime }}</div>
                        </div>
                        <div class="p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2 mb-1.5">
                            <ActivityIcon :size="14" class="text-emerald-500" />
                            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">服务状态</span>
                          </div>
                          <div class="text-[13px] font-black text-emerald-500 tracking-tight flex items-center gap-1.5">
                            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            {{ performanceData.workerStatus }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else key="matcher-side" class="absolute inset-0 flex flex-col min-h-0">
                  <div class="flex-1 flex flex-col min-h-0 px-4 space-y-6 py-8 overflow-y-auto custom-scrollbar">
                    <div class="space-y-3">
                      <div class="flex items-center justify-between px-1">
                        <label class="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">匹配历史</label>
                        <n-button quaternary circle size="tiny" @click="matcherHistory = []">
                          <template #icon><Trash2Icon :size="14" /></template>
                        </n-button>
                      </div>
                      <div v-if="matcherHistory.length === 0" class="p-8 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                        <HistoryIcon :size="32" class="text-slate-200 dark:text-slate-700 mb-2" />
                        <p class="text-[11px] text-slate-400 dark:text-slate-500">暂无匹配记录</p>
                      </div>
                      <TransitionGroup name="list" tag="div" class="space-y-2">
                        <div v-for="item in matcherHistory" :key="item.id" @click="useHistory(item)" class="p-3 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-100 dark:border-[#333] hover:border-blue-200 dark:hover:border-blue-800 cursor-pointer transition-all group">
                          <div class="flex items-center justify-between mb-1">
                            <span class="text-[13px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-blue-500 transition-colors">{{ item.mainName }}</span>
                            <span class="text-[9px] text-slate-400 dark:text-slate-500">{{ item.time }}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <n-tag size="tiny" :type="item.game === 'gs' ? 'success' : item.game === 'sr' ? 'warning' : 'info'" quaternary class="text-[9px] px-1.5 h-4 uppercase">{{ item.game }}</n-tag>
                            <span class="text-[11px] text-slate-400 dark:text-slate-500 truncate italic">"{{ item.input }}"</span>
                          </div>
                        </div>
                      </TransitionGroup>
                    </div>
                    <div class="pt-6 border-t border-slate-100 dark:border-[#333]">
                      <label class="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block px-1">引擎状态</label>
                      <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2">
                            <ZapIcon :size="14" class="text-amber-500" />
                            <span class="text-[11px] text-slate-500">匹配延迟</span>
                          </div>
                          <span class="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300">~12ms</span>
                        </div>
                        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50">
                          <div class="flex items-center gap-2">
                            <DatabaseIcon :size="14" class="text-blue-500" />
                            <span class="text-[11px] text-slate-500">索引条目</span>
                          </div>
                          <span class="text-[12px] font-mono font-bold text-slate-700 dark:text-slate-300">1810+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
            <div class="p-4 border-t border-slate-100 dark:border-[#333] bg-slate-50/50 dark:bg-[#252525]/50">
              <n-button block secondary round @click="isDark = !isDark" class="shadow-sm">
                <template #icon>
                  <SunIcon v-if="isDark" :size="18" />
                  <MoonIcon v-else :size="18" />
                </template>
                {{ isDark ? '切换到浅色模式' : '切换到深色模式' }}
              </n-button>
            </div>
          </div>
        </n-layout-sider>
        <n-layout-content 
          class="relative h-full bg-slate-50 dark:bg-[#0d0d0d] overflow-hidden"
          :native-scrollbar="false"
          content-style="height: 100%; overflow: hidden;"
        >
          <Transition name="page-fade" mode="out-in">
            <div v-if="activeTab === 'renderer'" key="renderer-main" class="absolute inset-0 flex flex-col overflow-hidden">
              <div class="px-8 py-4 bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-md border-b border-slate-200/60 dark:border-[#333]/60 grid grid-cols-3 items-center z-30 shrink-0">
                <div class="flex items-center gap-6">
                  <div v-if="renderInfoData" class="flex items-center gap-4">
                    <div class="flex flex-col">
                      <span class="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">分辨率</span>
                      <span class="text-[13px] font-mono font-bold text-slate-700 dark:text-slate-300">{{ renderInfoData.resolution }}</span>
                    </div>
                    <div class="w-px h-6 bg-slate-200 dark:bg-[#333]"></div>
                    <div class="flex flex-col">
                      <span class="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">预估大小</span>
                      <span class="text-[13px] font-mono font-bold text-slate-700 dark:text-slate-300">{{ renderInfoData.size }}</span>
                    </div>
                  </div>
                  <div v-else class="text-slate-400 dark:text-slate-500 text-[13px] italic">等待渲染中...</div>
                </div>
                <div class="flex justify-center px-4">
                  <n-select v-model:value="selectedTemplate" :options="templateOptions" placeholder="选择渲染模板..." size="medium" class="w-full max-w-[320px] rounded-xl shadow-sm" @update:value="onTemplateChange" />
                </div>
                <div class="flex items-center justify-end gap-4">
                  <div class="flex items-center gap-2 bg-slate-100/80 dark:bg-[#252525]/80 p-1 rounded-xl border border-slate-200/50 dark:border-[#333]/60">
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <n-button 
                          :type="isSelectMode ? 'primary' : 'tertiary'" 
                          quaternary 
                          circle 
                          size="small" 
                          @click="isSelectMode = true"
                        >
                          <template #icon><MousePointer2Icon :size="16" /></template>
                        </n-button>
                      </template>
                      选择模式 (可拖选文字)
                    </n-tooltip>
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <n-button 
                          :type="!isSelectMode ? 'primary' : 'tertiary'" 
                          quaternary 
                          circle 
                          size="small" 
                          @click="isSelectMode = false"
                        >
                          <template #icon><HandIcon :size="16" /></template>
                        </n-button>
                      </template>
                      平移模式 (可拖动画面)
                    </n-tooltip>
                    <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <n-button quaternary circle size="small" @click="handleManualZoom(-0.1)"><template #icon><ZoomOutIcon :size="18" /></template></n-button>
                    <div class="px-2 min-w-[60px] text-center font-mono font-bold text-[13px] text-slate-600 dark:text-slate-400">{{ isNaN(canvasZoom) ? 100 : Math.round(canvasZoom * 100) }}%</div>
                    <n-button quaternary circle size="small" @click="handleManualZoom(0.1)"><template #icon><ZoomInIcon :size="18" /></template></n-button>
                    <div class="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <n-button quaternary circle size="small" @click="fitToWidth"><template #icon><MaximizeIcon :size="16" /></template></n-button>
                    <n-button quaternary circle size="small" @click="resetCanvas"><template #icon><RefreshCwIcon :size="16" /></template></n-button>
                  </div>
                </div>
              </div>
                <div class="flex-1 relative bg-slate-100 dark:bg-[#0d0d0d] overflow-hidden overscroll-none touch-none transition-all duration-300 ease-out" ref="containerRef" @wheel.prevent>
                <VueInfiniteViewer
                    v-if="previewHtml"
                    ref="viewerRef"
                    class="w-full h-full !overflow-hidden block"
                    :class="isSelectMode ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'"
                     :useWheelScroll="false"
                     :useAutoZoom="true"
                    :displayVerticalScroll="false"
                    :displayHorizontalScroll="false"
                    :zoom="canvasZoom"
                    @scroll="onViewerScroll"
                  >
                  <div 
                    class="bg-white dark:bg-[#1e1e1e] shadow-2xl inline-block p-5 box-border" 
                    :style="{ 
                      width: canvasDimensions.width + 'px', 
                      height: canvasDimensions.height + 'px'
                    }"
                  >
                    <iframe 
                      ref="iframeRef" 
                      :srcdoc="previewHtml" 
                      :key="previewHtml.length + (isRendering ? '_loading' : '_ready')" 
                      class="w-full h-full border-none block bg-white" 
                      :class="{ 'pointer-events-none': !isSelectMode }"
                      @load="onIframeLoad" 
                    />
                    <div v-if="isRendering" class="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-[1px] z-10"><n-spin size="large" /></div>
                  </div>
                </VueInfiniteViewer>
                <div v-else-if="!isRendering" class="absolute inset-0 flex flex-col items-center justify-center text-slate-300 dark:text-slate-700 pointer-events-none">
                  <div class="w-24 h-24 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center mb-8 shadow-sm border border-slate-100 dark:border-slate-800"><ImageIcon :size="48" class="text-slate-200 dark:text-slate-600" /></div>
                  <p class="font-black text-slate-400 dark:text-slate-500 text-xl tracking-tight">准备就绪</p>
                  <p class="text-[14px] text-slate-400/60 dark:text-slate-600/60 mt-2">选择模板开始实时预览</p>
                </div>
              </div>
            </div>
            <div v-else key="matcher-main" class="absolute inset-0 flex flex-col p-8 overflow-y-auto custom-scrollbar">
              <div class="w-full max-w-5xl mx-auto mb-8">
                <div class="bg-white dark:bg-[#1e1e1e] p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-slate-100 dark:border-slate-800">
                  <div class="flex items-center gap-6">
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0"><UserSearchIcon :size="32" class="text-blue-500" /></div>
                    <div class="flex-1">
                      <h1 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">角色名智能匹配器</h1>
                      <p class="text-slate-400 dark:text-slate-500 text-[13px] mt-1">支持原神、星铁、绝区零、鸣潮的别名、拼音、简称模糊搜索</p>
                    </div>
                  </div>
                  <div class="mt-8 flex gap-3">
                    <div class="flex-1 relative">
                      <input v-model="matcherInput" type="text" placeholder="输入角色名或别名 (如: 影, 芙芙, zzz安比...)" class="w-full h-14 pl-6 pr-14 rounded-2xl bg-slate-50 dark:bg-[#252525] border-2 border-slate-100 dark:border-[#333] text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500/50 transition-all font-medium text-lg shadow-inner" @keyup.enter="handleMatchCharacter" />
                      <div class="absolute right-4 top-1/2 -translate-y-1/2"><n-button v-if="matcherInput" quaternary circle size="small" @click="clearMatcher"><template #icon><XIcon :size="16" /></template></n-button></div>
                    </div>
                    <n-button type="primary" size="large" :loading="isMatching" class="h-14 px-8 rounded-2xl font-black shadow-lg shadow-blue-500/20" @click="handleMatchCharacter"><template #icon><SearchIcon :size="20" /></template>开始匹配</n-button>
                  </div>
                </div>
              </div>
              <div class="flex-1 w-full max-w-5xl mx-auto flex flex-col">
                <Transition name="fade" mode="out-in">
                  <div v-if="matcherResult" :key="matcherResult.mainName || 'error'" class="flex-1 flex flex-col gap-6 min-h-0">
                    <div v-if="matcherResult.error" class="bg-red-500/10 border-2 border-red-500/20 p-8 rounded-[2rem] text-center">
                      <AlertCircleIcon :size="48" class="text-red-500 mx-auto mb-4" />
                      <h3 class="text-xl font-black text-red-600 dark:text-red-400">未找到匹配角色</h3>
                      <p class="text-red-500/70 mt-2">{{ matcherResult.error }}</p>
                    </div>
                    <div v-else class="flex-1 flex gap-6 min-h-0">
                      <div class="w-1/3 flex flex-col gap-6">
                        <div class="bg-white dark:bg-[#1e1e1e] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                          <div class="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl shadow-blue-500/30"><span class="text-4xl font-black text-white">{{ matcherResult.mainName?.[0] }}</span></div>
                          <h2 class="text-3xl font-black text-slate-900 dark:text-white">{{ matcherResult.mainName }}</h2>
                          <div class="flex gap-2 mt-4"><n-tag :type="matcherResult.game === 'gs' ? 'success' : matcherResult.game === 'sr' ? 'warning' : 'info'" size="large" round class="font-black px-4 uppercase">{{ matcherResult.game === 'gs' ? '原神' : matcherResult.game === 'sr' ? '星穹铁道' : matcherResult.game === 'zzz' ? '绝区零' : '鸣潮' }}</n-tag></div>
                          <div class="w-full h-px bg-slate-100 dark:bg-[#333] my-8"></div>
                          <div class="w-full space-y-4">
                            <div class="flex items-center justify-between"><span class="text-[12px] font-bold text-slate-400 uppercase tracking-widest">匹配类型</span><span class="text-[13px] font-bold text-slate-700 dark:text-slate-300">完全匹配</span></div>
                            <div class="flex items-center justify-between"><span class="text-[12px] font-bold text-slate-400 uppercase tracking-widest">置信度</span><span class="text-[13px] font-bold text-emerald-500">100%</span></div>
                          </div>
                        </div>
                        <div class="bg-blue-600 p-8 rounded-[2.5rem] shadow-xl text-white flex flex-col gap-2">
                          <h4 class="text-blue-200 text-[12px] font-bold uppercase tracking-widest">提示</h4>
                          <p class="text-[13px] font-medium leading-relaxed opacity-90">该结果由 MiaoPluginMBT 引擎基于 MetaHub 数据集生成，匹配路径符合 YzPath 规范。</p>
                        </div>
                      </div>
                      <div class="flex-1 flex flex-col gap-6 min-h-0">
                        <div class="bg-white dark:bg-[#1e1e1e] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800">
                          <div class="flex items-center gap-3 mb-4"><FolderIcon :size="20" class="text-amber-500" /><h3 class="text-[13px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">物理路径</h3></div>
                          <div class="p-4 rounded-2xl bg-slate-50 dark:bg-[#252525] border border-slate-100 dark:border-[#333] font-mono text-[13px] text-slate-600 dark:text-slate-400 break-all select-all hover:bg-slate-100 dark:hover:bg-[#2a2a2a] transition-colors">{{ matcherResult.physicalPath }}</div>
                        </div>
                        <div class="flex-1 bg-white dark:bg-[#1e1e1e] p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col min-h-0">
                          <div class="flex items-center justify-between mb-6">
                            <div class="flex items-center gap-3"><FileIcon :size="20" class="text-blue-500" /><h3 class="text-[13px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">关联资源 ({{ matcherResult.files?.length || 0 }})</h3></div>
                          </div>
                          <div class="flex-1 overflow-hidden border border-slate-100 dark:border-[#333] rounded-3xl">
                            <n-scrollbar class="bg-slate-50/30 dark:bg-[#121212]/30 p-6">
                              <div class="grid grid-cols-2 gap-3">
                                <div v-for="file in matcherResult.files" :key="file" class="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#252525] border border-slate-100 dark:border-[#333] hover:shadow-md transition-all group cursor-default">
                                  <div class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-[#333] flex items-center justify-center shrink-0 group-hover:bg-blue-500/10 transition-colors"><ImageIcon :size="18" class="text-slate-400 group-hover:text-blue-500 transition-colors" /></div>
                                  <span class="text-[12px] text-slate-600 dark:text-slate-400 truncate font-mono">{{ file }}</span>
                                </div>
                              </div>
                            </n-scrollbar>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
          </Transition>
        </n-layout-content>
        <n-layout-sider
          v-if="activeTab === 'renderer'"
          bordered
          :width="420"
          class="z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.02)] dark:shadow-[-4px_0_15px_rgba(0,0,0,0.4)]"
        >
          <div class="h-full flex flex-col bg-white dark:bg-[#1e1e1e] border-l border-slate-100 dark:border-[#333] overflow-hidden">
            <div class="h-[65%] flex flex-col border-b border-slate-50 dark:border-[#333] min-h-0 shrink-0">
              <div class="p-6 pb-2">
                <div class="flex items-center justify-between mb-4">
                  <div class="flex bg-slate-100 dark:bg-[#252525] p-1 rounded-xl relative">
                    <div class="absolute top-1 bottom-1 bg-white dark:bg-[#333] rounded-lg shadow-sm transition-all duration-300 ease-out" :style="{ left: toolkitTab === 'trigger' ? '4px' : 'calc(50% + 2px)', width: 'calc(50% - 6px)' }"></div>
                    <button @click="toolkitTab = 'trigger'" class="relative z-10 px-4 py-1.5 text-[11px] font-bold transition-colors duration-300 flex items-center gap-2" :class="toolkitTab === 'trigger' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'"><ZapIcon :size="14" />触发测试</button>
                    <button @click="toolkitTab = 'config'" class="relative z-10 px-4 py-1.5 text-[11px] font-bold transition-colors duration-300 flex items-center gap-2" :class="toolkitTab === 'config' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'"><DatabaseIcon :size="14" />配置数据</button>
                  </div>
                </div>
              </div>
              <div class="flex-1 flex min-h-0 overflow-hidden relative">
                <Transition name="fade" mode="out-in">
                  <div v-if="toolkitTab === 'trigger'" key="trigger" class="flex-1 flex min-h-0 overflow-hidden">
                    <div class="w-[100px] border-r border-slate-50 dark:border-[#333] overflow-y-auto">
                      <div v-for="(cat, idx) in triggerCategories" :key="idx" @click="activeTriggerCat = idx" class="px-3 py-3 cursor-pointer transition-all border-l-2" :class="activeTriggerCat === idx ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold' : 'border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-[#252525]'">
                        <div class="text-[10px] uppercase tracking-tighter text-center leading-tight">{{ cat.name }}</div>
                      </div>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      <div class="grid grid-cols-1 gap-2">
                        <button v-for="item in triggerCategories[activeTriggerCat]?.items" :key="item.id" @click="triggerById(item.id)" class="w-full p-3 rounded-xl bg-slate-50/50 dark:bg-[#252525]/50 border border-slate-100/50 dark:border-[#333]/50 hover:border-blue-500/30 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all text-left group">
                          <div class="text-[12px] font-black text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{{ item.name }}</div>
                          <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{{ item.description }}</div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div v-else key="config" class="flex-1 flex flex-col min-h-0 p-4">
                    <div class="flex-1 rounded-2xl bg-slate-900 dark:bg-black border border-slate-800 p-4 font-mono text-[12px] overflow-hidden flex flex-col">
                      <div class="flex items-center justify-between mb-3 shrink-0"><div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div><div class="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div><div class="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div></div><span class="text-slate-600 text-[10px] uppercase font-bold tracking-widest">JSON Inspector</span></div>
                      <textarea v-model="configJson" class="flex-1 w-full bg-transparent text-emerald-500/90 outline-none resize-none custom-scrollbar" spellcheck="false" @input="onConfigInput"></textarea>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>
            <div class="flex-1 border-t border-slate-100 dark:border-[#333] bg-white dark:bg-[#1e1e1e] flex flex-col min-h-0">
              <div class="px-6 py-3 flex items-center justify-between border-b border-slate-50 dark:border-[#333] shrink-0">
                <span class="text-[12px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">控制台日志</span>
                <n-button quaternary circle size="tiny" @click="logs = []"><template #icon><Trash2Icon :size="14" /></template></n-button>
              </div>
              <div ref="logContainerRef" class="flex-1 overflow-y-auto p-4 scrollbar-hide bg-slate-50/30 dark:bg-[#252525]/30">
                <TransitionGroup name="list" tag="div" class="space-y-2">
                  <div v-for="(log, i) in logs" :key="log.time + i" class="text-[12px] flex gap-3 leading-relaxed group">
                    <span :class="log.type === 'error' ? 'text-red-500 font-bold' : 'text-slate-300 dark:text-slate-600'" class="shrink-0">{{ log.time }}</span>
                    <span :class="log.type === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'" class="group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{{ log.msg }}</span>
                  </div>
                </TransitionGroup>
                <div v-if="logs.length === 0" class="h-full flex items-center justify-center text-[12px] text-slate-300 dark:text-slate-600 italic">暂无日志...</div>
              </div>
            </div>
          </div>
        </n-layout-sider>
      </n-layout>
    </div>
  </n-config-provider>
</template>
<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted, Transition, TransitionGroup } from 'vue';
import { VueInfiniteViewer } from "vue3-infinite-viewer";
import { 
  darkTheme, 
  NConfigProvider, 
  NGlobalStyle, 
  NLayout, 
  NLayoutSider, 
  NLayoutContent, 
  NButton, 
  NSelect, 
  NTag, 
  NInput, 
  NEmpty, 
  NSpin, 
  NTooltip,
  NSlider
} from 'naive-ui';
import {
  TerminalIcon, RefreshCwIcon,
  ImageIcon, LayersIcon, Trash2Icon, ZapIcon,
  ZoomInIcon, ZoomOutIcon, SunIcon, MoonIcon, MaximizeIcon,
  MousePointer2Icon, HandIcon,
  ActivityIcon, CpuIcon, HardDriveIcon, ClockIcon,
  LayoutIcon, UserSearchIcon, SearchIcon, CheckCircleIcon, XCircleIcon, FolderIcon, FileIcon,
  HistoryIcon, DatabaseIcon, AlertCircleIcon, XIcon, FileXIcon, FingerprintIcon
} from 'lucide-vue-next';
import { TRIGGER_CATEGORIES } from '../shared/triggers';
import logoUrl from './assets/logo.png';
const themeOverrides = {
  common: {
    primaryColor: '#2563eb',
    primaryColorHover: '#3b82f6',
    primaryColorPressed: '#1d4ed8',
    borderRadius: '12px',
    fontSize: '13px',
    fontSizeMedium: '13px',
    fontSizeSmall: '12px',
    fontSizeLarge: '15px',
  },
  Layout: {
    siderColor: 'var(--n-color)',
    headerColor: 'var(--n-color)',
  }
};
const isDark = ref(false);
const iframeRef = ref(null);
const viewerRef = ref(null);
const isSelectMode = ref(true);
const canvasZoom = ref(1);
const canvasDimensions = ref({ width: 1000, height: 1200 });
const containerRef = ref(null);
const activeTab = ref('renderer'); 
const toolkitTab = ref('trigger'); 
const activeTriggerCat = ref(0);
const isRendering = ref(false);
const renderError = ref('');
const renderScale = ref(300);
const selectedTemplate = ref(null);
const templateOptions = ref([]);
const previewHtml = ref('');
const configJson = ref('{}');
const logContainerRef = ref(null);
const matcherInput = ref('');
const isMatching = ref(false);
const matcherResult = ref(null);
const matcherHistory = ref([]);
const performanceData = ref({
  cpu: '0%',
  memory: '0MB',
  renderTime: '0ms',
  workerStatus: 'Healthy'
});
const handleMatchCharacter = async () => {
  if (!matcherInput.value.trim()) return;
  isMatching.value = true;
  addLog(`[Matcher] 开始匹配: ${matcherInput.value}`, 'info');
  try {
    const res = await fetch(`/api/match?name=${encodeURIComponent(matcherInput.value)}`);
    const data = await res.json();
    matcherResult.value = data;
    if (!data.error) {
      addLog(`[Matcher] 匹配成功: ${data.mainName}`, 'success');
      const historyItem = {
        id: Date.now(),
        mainName: data.mainName,
        game: data.game,
        input: matcherInput.value,
        time: new Date().toLocaleTimeString()
      };
      matcherHistory.value.unshift(historyItem);
      if (matcherHistory.value.length > 10) matcherHistory.value.pop();
    } else {
      addLog(`[Matcher] 未找到角色: ${matcherInput.value}`, 'warning');
    }
  } catch (err) {
    addLog(`[Matcher] 匹配异常: ${err.message}`, 'error');
    matcherResult.value = { error: err.message };
  } finally {
    isMatching.value = false;
  }
};
const useHistory = (item) => {
  matcherInput.value = item.input;
  handleMatchCharacter();
};
const clearMatcher = () => {
  matcherInput.value = '';
  matcherResult.value = null;
};
const onIframeLoad = () => {
  if (!iframeRef.value) return;
  const doc = iframeRef.value.contentDocument || iframeRef.value.contentWindow.document;
  if (!doc) return;
  const style = doc.createElement('style');
  style.textContent = `
    html {
      width: auto !important;
      height: auto !important;
      overflow: visible !important;
    }
    body {
      display: inline-block !important;
      min-width: 100px !important;
      min-height: 100px !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    ::-webkit-scrollbar { display: none; }
  `;
  doc.head.appendChild(style);
  let detectionTimer = null;
  const detect = (attempt = 0) => {
    if (!iframeRef.value) return;
    const body = doc.body;
    const html = doc.documentElement;
    const rect = body.getBoundingClientRect();
    const rawWidth = rect.width;
    const rawHeight = rect.height;
    const finalWidth = rawWidth + 40;
    const finalHeight = rawHeight + 40;
    if (Math.abs(finalWidth - canvasDimensions.value.width) > 2 || 
        Math.abs(finalHeight - canvasDimensions.value.height) > 2) {
      if (rawWidth > 100 && rawHeight > 100) {
        if (detectionTimer) clearTimeout(detectionTimer);
        const delay = attempt === 0 ? 150 : 0;
        detectionTimer = setTimeout(() => {
          canvasDimensions.value = { width: finalWidth, height: finalHeight };
          console.log(`[Renderer] 尺寸稳定校正: 内容=${rawWidth}x${rawHeight} -> 容器=${finalWidth}x${finalHeight}`);
        }, delay);
      }
    }
    if (attempt < 8) setTimeout(() => detect(attempt + 1), 250);
  };
  detect();
};
const onViewerScroll = (e) => {
  if (e && typeof e.zoom === 'number' && !isNaN(e.zoom)) {
    canvasZoom.value = e.zoom;
  }
};
watch(canvasDimensions, () => {
  nextTick(() => {
    fitToWidth();
  });
}, { deep: true });
const fitToWidth = () => {
  const container = containerRef.value;
  if (!container || !viewerRef.value) return;
  let containerWidth = container.clientWidth;
  let containerHeight = container.clientHeight;
  if (containerHeight < 100 || containerWidth < 100) {
    setTimeout(fitToWidth, 50);
    return;
  }
  const padding = 80; 
  const availableWidth = Math.max(containerWidth - padding, 100);
  const availableHeight = Math.max(containerHeight - padding, 100);
  const contentWidth = canvasDimensions.value.width || 1000;
  const contentHeight = canvasDimensions.value.height || 1200;
  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  let newZoom = Math.min(scaleX, scaleY);
  if (!isNaN(newZoom) && isFinite(newZoom)) {
    canvasZoom.value = Math.max(newZoom, 0.01);
  }
  nextTick(() => {
    if (viewerRef.value) {
      viewerRef.value.scrollCenter();
    }
  });
};
const handleManualZoom = (delta) => {
  const currentZoom = isNaN(canvasZoom.value) ? 1 : canvasZoom.value;
  canvasZoom.value = Math.min(Math.max(currentZoom + delta, 0.02), 5);
};
const resetCanvas = () => {
  if (viewerRef.value) {
    viewerRef.value.scrollCenter();
    fitToWidth();
  }
};
const logs = ref([]);
const triggerCategories = computed(() => {
  return TRIGGER_CATEGORIES.map(cat => ({
    name: cat.name,
    items: cat.items.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description || t.name,
      type: t.id
    }))
  }));
});
const renderInfoData = computed(() => {
  if (!previewHtml.value) return null;
  const width = canvasDimensions.value.width;
  const height = canvasDimensions.value.height;
  const estimatedSize = (width * height * 0.15) / 1024;
  return {
    resolution: `${width} px x ${height} px`,
    size: estimatedSize > 1024 
      ? `${(estimatedSize / 1024).toFixed(2)} MB` 
      : `${Math.round(estimatedSize)} KB`
  };
});
let renderTimer = null;
const onConfigInput = async () => {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    renderPreview();
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RenderScale: renderScale.value })
      });
      addLog(`[Config] 渲染精度已同步到后端: ${renderScale.value}%`, 'success');
    } catch (err) {
      addLog('同步配置失败: ' + err.message, 'error');
    }
  }, 500);
};
const fetchConfig = async () => {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.success && data.config) {
      if (data.config.RenderScale) {
        renderScale.value = data.config.RenderScale;
        addLog(`[Config] 已从后端同步精度: ${renderScale.value}%`, 'success');
      }
    }
  } catch (err) {
    addLog('获取配置失败: ' + err.message, 'error');
  }
};
const onTemplateChange = async (value) => {
  canvasZoom.value = 1;
  await fetchTemplateData();
  renderPreview();
};
const triggerById = async (id) => {
  addLog(`触发模拟测试: #${id}`);
  try {
    await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: `#咕咕牛触发 ${id}` })
    });
  } catch (err) {
    addLog('触发失败: ' + err.message, 'error');
  }
};
const fetchTemplates = async () => {
  try {
    const res = await fetch('/api/templates');
    const data = await res.json();
    if (data && data.length > 0) {
      templateOptions.value = data.map(t => ({ label: t, value: t }));
    }
  } catch (err) {
    addLog('获取模板列表失败: ' + err.message, 'error');
  }
};
const fetchTemplateData = async (mockType = 'DEFAULT') => {
  if (!selectedTemplate.value) return;
  try {
    const res = await fetch(`/api/template-data?template=${selectedTemplate.value}&mockType=${mockType}`);
    const data = await res.json();
    if (data.success) {
      configJson.value = JSON.stringify(data.data, null, 2);
    }
  } catch (err) {
    addLog('获取模板数据失败: ' + err.message, 'error');
  }
};
const renderPreview = async () => {
  if (!selectedTemplate.value) {
    addLog('渲染跳过: 未选择模板', 'warning');
    return;
  }
  isRendering.value = true;
  renderError.value = '';
  addLog(`开始渲染: ${selectedTemplate.value}...`, 'info');
  try {
    const scaleFactor = renderScale.value / 100;
    const renderMatrix = `transform:scale(${scaleFactor}); transform-origin: top left;`;
    const payload = {
      template: selectedTemplate.value,
      data: {
        ...JSON.parse(configJson.value),
        RenderScale: { value: renderScale.value },
        RenderMatrix: renderMatrix
      }
    };
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      if (data.html) {
        previewHtml.value = data.html;
        addLog(`渲染成功: ${selectedTemplate.value} (长度: ${data.html.length})`);
      } else {
        addLog(`渲染异常: 后端返回成功但 HTML 为空`, 'warning');
        previewHtml.value = '<html><body><div style="padding:20px; color:red;">后端返回 HTML 为空</div></body></html>';
      }
    } else {
      renderError.value = data.error || '渲染失败';
      addLog(`渲染失败: ${renderError.value}`, 'error');
    }
  } catch (err) {
    renderError.value = err.message;
    addLog(`渲染请求异常: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      isRendering.value = false;
    }, 100);
  }
};
const addLog = (msg, type = 'info') => {
  const time = new Date().toLocaleTimeString();
  logs.value.push({ time, msg, type });
  if (logs.value.length > 50) {
    logs.value.shift();
  }
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTo({
        top: logContainerRef.value.scrollHeight,
        behavior: 'smooth'
      });
    }
  });
};
const fetchPerformance = async () => {
  try {
    const res = await fetch('/api/performance');
    const data = await res.json();
    if (data) {
      performanceData.value = {
        cpu: data.cpu || '0%',
        memory: data.memory || '0MB',
        renderTime: data.renderTime || '0ms',
        workerStatus: data.workerStatus || 'Healthy'
      };
    }
  } catch (err) {
  }
};
onMounted(() => {
  fetchConfig();
  fetchTemplates();
  fetchPerformance();
  const pollTimer = setInterval(fetchPerformance, 3000);
  let wasSelectModeBeforeSpace = false;
  const handleKeyDown = (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.repeat) {
      wasSelectModeBeforeSpace = isSelectMode.value;
      if (isSelectMode.value) {
        isSelectMode.value = false;
        e.preventDefault();
      }
    }
  };
  const handleKeyUp = (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (wasSelectModeBeforeSpace) {
        isSelectMode.value = true;
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  onUnmounted(() => {
    clearInterval(pollTimer);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  });
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'render' || data.type === 'hot-reload') {
      addLog(`收到推送更新: ${data.template || '当前页面'}`);
      if (data.template && data.template === selectedTemplate.value) {
        renderPreview();
      } else if (!data.template) {
        renderPreview();
      }
    }
  };
});
watch(activeTab, (tab) => {
  addLog(`[Tab] 切换到: ${tab}`, 'info');
  if (tab === 'renderer') {
    setTimeout(() => {
      fitToWidth();
    }, 450); 
  }
});
</script>
<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
iframe::-webkit-scrollbar {
  display: none;
}
.infinite-viewer-wrapper,
.infinite-viewer-scroll-area {
  overflow: hidden !important;
}
[class*="infinite-viewer-"] {
  overflow: hidden !important;
  overscroll-behavior: none !important;
}
.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-15px);
}
</style>
