// ==========================================================================
// UI 控制: 处理通用 UI 交互 标签页导航和 Home 面板控件
// ==========================================================================

// --- 标签页导航 Tab Navigation ---

/**
 * 切换到指定 ID 的标签页
 * @param {string} targetTabId 目标标签页的 ID e.g., 'homePane', 'dataListPane'
 */
async function switchTab(targetTabId) {
    if (AppState.isSwitchingTabs) {
        console.debug("UI控件: 正在切换标签页 忽略:", targetTabId);
        return;
    }

    const targetButton = document.querySelector(`.tab-button[data-tab="${targetTabId}"]`);
    const targetPane = document.getElementById(targetTabId);
    const currentActivePane = document.querySelector('.tab-pane.active');

    if (!targetPane || !targetButton) {
        console.warn(`UI控件: 找不到目标标签页或按钮: ${targetTabId}`);
        return;
    }
    if (currentActivePane === targetPane) {
        console.debug("UI控件: 尝试切换到当前页:", targetTabId);
        return;
    }

    console.log(`UI控件: 切换到标签页: ${targetTabId}`);
    AppState.isSwitchingTabs = true;

    DOM.tabButtons.forEach(btn => btn.classList.remove(UI_CLASSES.ACTIVE));
    targetButton.classList.add(UI_CLASSES.ACTIVE);

    if (currentActivePane) {
        currentActivePane.classList.add(UI_CLASSES.SLIDING_OUT);
        currentActivePane.classList.remove(UI_CLASSES.ACTIVE);
        if (currentActivePane.id === 'dataListPane' && AppState.dataList.virtualScrollInfo.container) {
            AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll);
            console.debug("UI控件: 移除 dataListPane 滚动监听");
        }
        const paneToRemove = currentActivePane;
        setTimeout(() => paneToRemove?.classList.remove(UI_CLASSES.SLIDING_OUT), 550);
    }

    targetPane.classList.remove(UI_CLASSES.SLIDING_OUT);
    targetPane.classList.add(UI_CLASSES.ACTIVE);

    try {
        switch (targetTabId) {
            case 'homePane':
                if (typeof updateGalleryStatusDisplay === "function") updateGalleryStatusDisplay();
                if (typeof updateHomeStats === "function") updateHomeStats(); 
                else console.warn("UI控件: updateGalleryStatusDisplay 未定义");
                break;

            case 'GuTools':
                if (AppState.currentGuToolMode === 'secondary_tag_editor') {
                    if (typeof initializeSecondaryTagEditorView === "function") {
                        console.log("UI控件: 切换到 GuTools SecondaryTagEditor，按需加载数据...");
                        await initializeSecondaryTagEditorView();
                    } else { console.warn("UI控件: initializeSecondaryTagEditorView 未定义 GuTools_SecondaryTagEditor.js"); }
                } else if (AppState.currentGuToolMode === 'import') {
                    if (typeof ensureImportDataLoaded === "function") {
                        console.log("UI控件: 切换到 GuTools Import 按需加载数据...");
                        await ensureImportDataLoaded();
                    } else { console.warn("UI控件: ensureImportDataLoaded 未定义 GuTools_Import.js"); }
                }
                break;

            case 'dataListPane':
                if (typeof applyFiltersAndRenderDataList === "function") {
                    applyFiltersAndRenderDataList();
                    if (AppState.dataList.virtualScrollInfo.container && AppState.dataList.virtualScrollInfo.filteredData.length > 0) {
                        AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll);
                        AppState.dataList.virtualScrollInfo.container.addEventListener('scroll', handleScroll);
                        console.debug("UI控件: 添加 dataListPane 滚动监听");
                    }
                } else { console.warn("UI控件: applyFiltersAndRenderDataList 未定义 Data_List.js"); }
                break;

            case 'pluginGalleryPane':
                if (!AppState.pluginGallery.dataLoaded) {
                    console.log("UI控件: 首次进入插件图片管理 加载数据...");
                    if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.remove(UI_CLASSES.HIDDEN);
                    if (DOM.pluginGalleryFolderNoResults) DOM.pluginGalleryFolderNoResults.classList.add(UI_CLASSES.HIDDEN);
                    if (DOM.pluginGalleryFolderListContainer) DOM.pluginGalleryFolderListContainer.innerHTML = '';
                    if (DOM.pluginGalleryImageGrid) DOM.pluginGalleryImageGrid.classList.add(UI_CLASSES.HIDDEN);
                    if (DOM.pluginGalleryPreviewPlaceholder) DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
                    if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);

                    if (typeof fetchPluginImages === "function" && typeof fetchPluginUserData === "function") {
                        const [imagesResult, userDataResult] = await Promise.allSettled([
                            fetchPluginImages(),
                            fetchPluginUserData()
                        ]);
                        const imagesOk = imagesResult.status === 'fulfilled' && imagesResult.value === true;
                        const userdataOk = userDataResult.status === 'fulfilled' && userDataResult.value === true;

                        if (imagesOk) {
                            AppState.pluginGallery.dataLoaded = true;
                            if (typeof renderPluginFolderList === "function") renderPluginFolderList();
                            else console.warn("UI控件: renderPluginFolderList 未定义 Plugin_Gallery.js");
                        } else {
                            if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.add(UI_CLASSES.HIDDEN);
                            if (DOM.pluginGalleryFolderNoResults) {
                                DOM.pluginGalleryFolderNoResults.textContent = "加载插件图片列表失败";
                                DOM.pluginGalleryFolderNoResults.classList.remove(UI_CLASSES.HIDDEN);
                            }
                        }
                        if (!userdataOk) displayToast("加载插件元数据失败", UI_CLASSES.WARNING);

                    } else {
                        console.warn("UI控件: fetchPluginImages 或 fetchPluginUserData 未定义 Plugin_Gallery.js");
                        if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.add(UI_CLASSES.HIDDEN);
                        if (DOM.pluginGalleryFolderNoResults) {
                            DOM.pluginGalleryFolderNoResults.textContent = "错误：无法加载插件图片数据";
                            DOM.pluginGalleryFolderNoResults.classList.remove(UI_CLASSES.HIDDEN);
                        }
                    }
                } else {
                    console.log("UI控件: 插件图片管理数据已加载 刷新文件夹列表...");
                    if (typeof renderPluginFolderList === "function") renderPluginFolderList();
                    else console.warn("UI控件: renderPluginFolderList 未定义 Plugin_Gallery.js");
                }
                if (typeof clearPluginEditor === "function") clearPluginEditor();
                else console.warn("UI控件: clearPluginEditor 未定义 Plugin_Gallery.js");
                break;

                case 'banManagementPane':
    
                    if (typeof BanManagementState !== 'undefined' && BanManagementState.needsRefresh) {
                        console.log("[UI控件] 检测到封禁管理需要刷新，正在执行...");
                        
                        if (typeof initializeBanManagement === "function") {
                            await initializeBanManagement(); 
                        }
                        
                        if (BanManagementState.isInitialized) {
                             processAndSeparateImageData();
                             applyBanFilters();
                             updatePanelTitles();
                             displayToast("列表已根据最新的净化等级刷新。", "info", 3000);
                        }
                        
                        BanManagementState.needsRefresh = false;
    
                    } else {
                        console.log("[UI控件] 正常进入封禁管理，执行标准初始化。");
                        if (typeof initializeBanManagement === "function") {
                            initializeBanManagement();
                        } else {
                            console.warn("UI控件: initializeBanManagement 未定义 Ban_Management.js");
                        }
                    }
                break;
            
            case 'advancedManagementPane':
                console.log("UI控件: 切换到高级管理面板");
                break;

            default:
                console.warn("UI控件: 未知的标签页 ID:", targetTabId);
        }
    } catch (error) {
        console.error(`UI控件: 切换到标签页 ${targetTabId} 时出错:`, error);
        displayToast(`加载 ${targetTabId} 出错`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    } finally {
        setTimeout(() => {
            AppState.isSwitchingTabs = false;
            console.debug("UI控件: 标签页切换完成");
        }, 550);
    }
}

/**
 * 设置标签页导航按钮的点击事件监听器
 */
function setupTabNavigation() {
    if (!DOM.tabButtons || DOM.tabButtons.length === 0) {
        console.error("UI控件: 未找到标签页按钮");
        return;
    }
    DOM.tabButtons.forEach(button => {
        const targetTabId = button.dataset.tab;
        if (targetTabId) {
            // 使用匿名函数包装 避免存储 handler
            const handler = () => switchTab(targetTabId);
            // 清除旧监听器以防万一
            // TODO: 移除旧监听器需要存储 handler 或采用其他策略 暂时省略移除
            // button.removeEventListener('click', handler);
            button.addEventListener('click', handler);
        } else {
            console.warn("UI控件: 发现无 data-tab 属性的标签按钮:", button);
        }
    });
    console.log("UI控件: 标签页导航设置完成");
}

// --- Home 面板控件 Switches ---

/**
 * 更新 Home 面板上图库状态控件的显示文本和状态
 */
async function updateGalleryStatusDisplay() {
    console.log("UI控件: 更新 Home 面板状态...");


    const elements = {
        tuKuOPText: DOM.tuKuOPStatusText, // 确认使用 DOM 对象
        pflText: DOM.pflStatusText,       // 确认使用 DOM 对象
        tuKuOPSwitch: DOM.tuKuOPToggleSwitch, // 确认使用 DOM 对象
        pflRadio0: document.getElementById('pflRadio0'), // 直接获取
        pflRadio1: document.getElementById('pflRadio1'), // 直接获取
        pflRadio2: document.getElementById('pflRadio2'), // 直接获取
        pflContainer: document.querySelector('.tri-state-switch-container') // 直接获取
    };

    // 确认这里的检查逻辑是正确的
    if (!elements.tuKuOPText || !elements.pflText || !elements.tuKuOPSwitch || !elements.pflRadio0 || !elements.pflRadio1 || !elements.pflRadio2 || !elements.pflContainer) {
        console.error("UI控件: Home 面板部分状态元素未找到"); // 报错来源
    }

    // 设置加载中状态
    if (elements.tuKuOPText) elements.tuKuOPText.textContent = '加载中...';
    if (elements.pflText) elements.pflText.textContent = '加载中...';
    if (elements.tuKuOPSwitch) { elements.tuKuOPSwitch.checked = false; elements.tuKuOPSwitch.disabled = true; }
    // 禁用所有 radio 和容器
    if (elements.pflRadio0) elements.pflRadio0.disabled = true;
    if (elements.pflRadio1) elements.pflRadio1.disabled = true;
    if (elements.pflRadio2) elements.pflRadio2.disabled = true;
    if (elements.pflContainer) elements.pflContainer.classList.add('disabled'); // 添加禁用样式类

    try {
        const result = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_CONFIG);
        if (!result?.success || typeof result.config !== 'object') {
            throw new Error(result?.error || "获取的配置数据格式无效");
        }
        const config = result.config;
        if (elements.aiBtn) elements.aiBtn.classList.toggle('active', config.Ai === 1);
        if (elements.eastereggBtn) elements.eastereggBtn.classList.toggle('active', config.EasterEgg === 1);
        if (elements.layoutBtn) elements.layoutBtn.classList.toggle('active', config.layout === 1);
        console.log("UI控件: 获取到图库配置:", config);

        // 更新 TuKuOP 开关
        const tuKuOPValue = Number(config.TuKuOP ?? 0);
        if (elements.tuKuOPText) elements.tuKuOPText.textContent = tuKuOPValue ? '已启用' : '已关闭';
        if (elements.tuKuOPSwitch) elements.tuKuOPSwitch.checked = !!tuKuOPValue;

        // 更新 PFL 三态开关
        const pflValue = Number(config.PFL ?? 0);
        const pflRadioToCheck = document.getElementById(`pflRadio${pflValue}`);
        if (pflRadioToCheck) {
            pflRadioToCheck.checked = true; // 选中对应的 radio
        } else {
            console.warn(`UI控件: 未找到 PFL 等级 ${pflValue} 对应的 Radio Button`);
            if (elements.pflRadio0) elements.pflRadio0.checked = true; // 默认选中 0
        }
        // 更新状态文本
        if (elements.pflText) {
            let pflDesc = '未知';
            if (pflValue === 0) pflDesc = '关闭净化';
            else if (pflValue === 1) pflDesc = '仅过滤R18';
            else if (pflValue === 2) pflDesc = '过滤全部敏感数据';
            elements.pflText.textContent = `当前: ${pflDesc}`;
        }

        if (elements.aiBtn) elements.aiBtn.classList.toggle('active', config.Ai === 1);
        if (elements.eastereggBtn) elements.eastereggBtn.classList.toggle('active', config.EasterEgg === 1);
        if (elements.layoutBtn) elements.layoutBtn.classList.toggle('active', config.layout === 1);
        
        // 启用控件
        if (elements.tuKuOPSwitch) elements.tuKuOPSwitch.disabled = false;
        if (elements.pflRadio0) elements.pflRadio0.disabled = false;
        if (elements.pflRadio1) elements.pflRadio1.disabled = false;
        if (elements.pflRadio2) elements.pflRadio2.disabled = false;
        if (elements.pflContainer) elements.pflContainer.classList.remove('disabled');

        console.log("UI控件: Home 面板状态更新完成");

    } catch (error) {
        console.error("UI控件: 加载图库配置失败:", error);
        if (elements.tuKuOPText) elements.tuKuOPText.textContent = '加载失败';
        if (elements.pflText) elements.pflText.textContent = '加载失败';
        displayToast('加载配置出错', UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        // 确保控件在出错时仍然是禁用的
        if (elements.pflContainer) elements.pflContainer.classList.add('disabled');
    }
}


/**
 * 处理 Home 面板上状态控件事件
 * @param {Event} event change 事件对象
 */
async function handleGalleryControlChange(event) {
    const controlElement = event.target;
    if (!controlElement) return;

    let configKey, newValue, statusElement, controlName, valueMap, isRadioGroup = false;
    let radioElements = [];

    if (controlElement.id === 'tuKuOPToggleSwitch' && controlElement.type === 'checkbox') {
        configKey = 'TuKuOP';
        newValue = controlElement.checked ? 1 : 0;
        statusElement = DOM.tuKuOPStatusText;
        controlName = '图库开关';
        valueMap = { 1: '已启用', 0: '已关闭' };
    } else if (controlElement.name === 'pflLevel' && controlElement.type === 'radio') {
        configKey = 'PFL';
        newValue = Number(controlElement.value);
        statusElement = DOM.pflStatusText;
        controlName = '净化等级';
        valueMap = { 0: '关闭净化', 1: '仅过滤R18', 2: '过滤全部敏感数据' };
        isRadioGroup = true;
        radioElements = [
            document.getElementById('pflRadio0'),
            document.getElementById('pflRadio1'),
            document.getElementById('pflRadio2')
        ];
    } else if (controlElement.classList.contains('filter-button')) {
        isButtonToggle = true;
        controlElement.classList.toggle('active'); // 立即切换视觉状态
        newValue = controlElement.classList.contains('active') ? 1 : 0;
        switch (controlElement.id) {
            case 'ai-filter-btn':
                configKey = 'Ai';
                controlName = 'AI 图片过滤';
                break;
            case 'easteregg-filter-btn':
                configKey = 'EasterEgg';
                controlName = '彩蛋图片过滤';
                break;
            case 'layout-filter-btn':
                configKey = 'layout';
                controlName = '横屏图过滤';
                break;
            default: return;
        }
    } else {
        return;
    }

    if (!statusElement) {
        console.warn(`UI控件: 未找到控件 ${controlElement.id || controlElement.name} 对应的状态文本元素`);
    }

    let previousValueText = statusElement ? statusElement.textContent : '';

    if (isRadioGroup) {
        radioElements.forEach(radio => { if (radio) radio.disabled = true; });
        document.querySelector('.tri-state-switch-container')?.classList.add('disabled');
    } else {
        controlElement.disabled = true;
    }
    if (statusElement) statusElement.textContent = `${controlName} 更新中...`;
    console.log(`UI控件: 发送配置更新: key=${configKey}, value=${newValue}`);

    try {
        const payload = { configKey, newValue };
        const result = await fetchJsonData(API_ENDPOINTS.UPDATE_GALLERY_CONFIG, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!result?.success) { throw new Error(result?.error || `更新失败 服务器未明确原因`); }

        console.log(`UI控件: 配置更新成功: ${configKey}=${newValue}`);

        if (result.newConfig) {
            AppState.galleryConfig = result.newConfig;
            console.log("UI控件: 全局 AppState.galleryConfig 已更新为:", AppState.galleryConfig);
        }
        
        if (configKey === 'PFL') {
            console.log('[应用事件] 正在广播 "pflChanged" 事件...');
            AppEvents.emit('pflChanged'); 
        }

        if (statusElement) {
            const statusText = valueMap[newValue] ?? `值 ${newValue}`;
            statusElement.textContent = configKey === 'PFL' ? `当前: ${statusText}` : statusText;
        }
        displayToast(`${controlName} 更新成功`, UI_CLASSES.SUCCESS);

    } catch (error) {
        console.error(`UI控件: 更新 ${controlName} 配置失败:`, error);
        if (statusElement) statusElement.textContent = `${controlName} 更新失败`;
        displayToast(`${controlName} 更新失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);

        if (isRadioGroup) {
            updateGalleryStatusDisplay();
        } else if (controlElement.type === 'checkbox') {
            controlElement.checked = !controlElement.checked;
            if (statusElement) statusElement.textContent = previousValueText;
        }

    } finally {
        if (isRadioGroup) {
            radioElements.forEach(radio => { if (radio) radio.disabled = false; });
            document.querySelector('.tri-state-switch-container')?.classList.remove('disabled');
        } else {
            controlElement.disabled = false;
        }
    }
}

/**
 * 设置 Home 面板上所有控件的事件监听器
 */
function setupHomePaneEventListeners() {
    const controls = [
        DOM.tuKuOPToggleSwitch,
        // 监听 Radio Button 组需要监听每个 Radio
        document.getElementById('pflRadio0'),
        document.getElementById('pflRadio1'),
        document.getElementById('pflRadio2'),
        DOM.aiFilterBtn, 
        DOM.eastereggFilterBtn, 
        DOM.layoutFilterBtn 
    ];
    let listenerCount = 0;
    controls.forEach(controlElement => {
        if (controlElement) {
            const eventType = controlElement.type === 'radio' || controlElement.type === 'checkbox' ? 'change' : 'click';
            controlElement.removeEventListener(eventType, handleGalleryControlChange);
            controlElement.addEventListener(eventType, handleGalleryControlChange);
            listenerCount++;
        }
    });
    if (listenerCount > 0) {
        console.log(`UI控件: 为 ${listenerCount} 个 Home 面板控件设置了监听器`);
    }
}

/**
 * 获取并更新首页仓库卡片的统计数据
 */
async function updateHomeStats() {
    console.log("UI控件: 正在更新 Home 面板仓库统计...");
    try {
        const result = await fetchJsonData(API_ENDPOINTS.FETCH_HOME_STATS);
        if (!result?.success || !Array.isArray(result.stats)) {
            throw new Error(result?.error || "获取的统计数据格式无效");
        }

        result.stats.forEach(repo => {
            const card = DOM[`repoCard${repo.repo}`];
            const statusEl = DOM[`repoStatus${repo.repo}`];
            const messageEl = card.querySelector('.repo-card-message');

            if (!card) return;

            card.classList.remove('placeholder', 'exists', 'not-exists', 'not-required');

            if (repo.status === 'exists') {
                card.classList.add('exists');
                statusEl.className = 'repo-card-status exists';
                statusEl.textContent = `节点: ${repo.downloadNode || '未知'}`;
                DOM[`repoRoles${repo.repo}`].textContent = repo.roles;
                DOM[`repoImages${repo.repo}`].textContent = repo.images;
                DOM[`repoSize${repo.repo}`].textContent = FormatBytes(repo.size);
            } else if (repo.status === 'not-exists') {
                card.classList.add('not-exists');
                statusEl.className = 'repo-card-status not-exists';
                statusEl.textContent = '未下载';
                if (messageEl) messageEl.textContent = '未下载'; // 保持一致
            } else if (repo.status === 'not-required') {
                card.classList.add('not-required');
                statusEl.className = 'repo-card-status not-required';
                statusEl.textContent = '无需下载';
                if (messageEl) messageEl.textContent = '无需下载';
            }
        });

    } catch (error) {
        console.error("UI控件: 更新仓库统计失败:", error);
        displayToast('加载仓库统计数据失败', 'error');
        for (let i = 1; i <= 4; i++) {
            if(DOM[`repoCard${i}`]) DOM[`repoCard${i}`].classList.remove('placeholder');
            if(DOM[`repoStatus${i}`]) {
                DOM[`repoStatus${i}`].textContent = '加载失败';
                DOM[`repoStatus${i}`].className = 'repo-card-status not-exists';
            }
        }
    }
}

// --- 全局事件处理 例如：点击外部区域关闭建议列表 ---

/**
 * 处理全局点击事件 用于关闭打开的建议列表等
 * @param {MouseEvent} event 点击事件对象
 */
function handleGlobalClick(event) {
    const target = event.target;

    // 关闭 Generator 建议列表
    if (DOM.generatorSuggestionList && !DOM.generatorSuggestionList.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideGenerator = DOM.generatorSearchInput?.contains(target) || DOM.generatorSuggestionList.contains(target);
        if (!isClickInsideGenerator) {
            console.debug("全局点击: Generator 建议列表外部 隐藏");
            DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
            AppState.generator.showingRelatedImages = false;
            AppState.generator.isShowingFolderSuggestions = false;
        }
    }

    // 关闭 Importer 待入库图片建议列表
    if (DOM.importerTempImageSuggestions && !DOM.importerTempImageSuggestions.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideImporterTemp = DOM.importerTempImageSearchInput?.contains(target) || DOM.importerTempImageSuggestions.contains(target);
        if (!isClickInsideImporterTemp) {
            console.debug("全局点击: Importer 待入库建议列表外部 隐藏");
            DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }

    // 关闭 Importer 目标文件夹建议列表
    if (DOM.importerTargetFolderSuggestions && !DOM.importerTargetFolderSuggestions.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideImporterTarget = DOM.importerTargetFolderSearchInput?.contains(target) || DOM.importerTargetFolderSuggestions.contains(target);
        if (!isClickInsideImporterTarget) {
            console.debug("全局点击: Importer 目标文件夹建议列表外部 隐藏");
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
            // 失焦时自动选择的逻辑在 handleTargetFolderBlur 中处理
        }
    }
}

/**
 * 设置全局事件监听器
 */
function setupGlobalEventListeners() {
    // 只添加一次全局点击监听器
    document.removeEventListener('click', handleGlobalClick); // 先移除 确保唯一性
    document.addEventListener('click', handleGlobalClick);
    console.log("UI控件: 全局点击监听器设置完成");
}