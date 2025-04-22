// ==========================================================================
// 处理通用 UI 交互，标签页导航和 Home 面板控件。
// ==========================================================================
'use strict';


// --------------------------------------------------------------------------
// 标签页导航 (Tab Navigation)
// --------------------------------------------------------------------------

/**
 * 切换到指定 ID 的标签页。
 * @param {string} targetTabId - 目标标签页的 ID (例如 'homePane', 'dataListPane')。
 */
async function switchTab(targetTabId) {
    if (AppState.isSwitchingTabs) {
        console.debug("UI控件: 正在切换标签页，忽略:", targetTabId);
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
        return; // 已经是当前页
    }

    console.log(`UI控件: 切换到标签页: ${targetTabId}`);
    AppState.isSwitchingTabs = true;

    // --- 更新按钮状态 ---
    DOM.tabButtons.forEach(btn => btn.classList.remove(UI_CLASSES.ACTIVE));
    targetButton.classList.add(UI_CLASSES.ACTIVE);

    // --- 处理面板切换动画 ---
    if (currentActivePane) {
        currentActivePane.classList.add(UI_CLASSES.SLIDING_OUT);
        currentActivePane.classList.remove(UI_CLASSES.ACTIVE);
        // 移除特定面板的事件监听器
        if (currentActivePane.id === 'dataListPane' && AppState.dataList.virtualScrollInfo.container) {
             AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll); // handleScroll 在 Data_List.js
             console.debug("UI控件: 移除 dataListPane 滚动监听。");
        }
        // 动画结束后清理类
        const paneToRemove = currentActivePane;
        setTimeout(() => paneToRemove?.classList.remove(UI_CLASSES.SLIDING_OUT), 550); // 略长于动画时间
    }

    // 滑入目标面板
    targetPane.classList.remove(UI_CLASSES.SLIDING_OUT);
    targetPane.classList.add(UI_CLASSES.ACTIVE);

    // --- 特定标签页的加载/初始化逻辑 ---
    try {
        switch (targetTabId) {
            case 'homePane':
                if (typeof updateGalleryStatusDisplay === "function") updateGalleryStatusDisplay();
                else console.warn("UI控件: updateGalleryStatusDisplay 未定义。");
                break;

            case 'GuTools':
                // 切换到 GuTools 时，根据当前子模式决定是否加载数据
                if (AppState.currentGuToolMode === 'import') {
                    if (typeof ensureImportDataLoaded === "function") {
                         console.log("UI控件: 切换到 GuTools (Import)，按需加载数据...");
                         await ensureImportDataLoaded(); // 使用 Importer 模块的函数
                    } else { console.warn("UI控件: ensureImportDataLoaded 未定义 (GuTools_Import.js)。"); }
                }
                // 其他 GuTools 子模式的按需加载逻辑可以在 GuTools_Main.js 的 switchGuToolMode 中处理
                break;

            case 'dataListPane':
                 if (typeof applyFiltersAndRenderDataList === "function") {
                     applyFiltersAndRenderDataList(); // 应用过滤器并渲染
                     // 重新添加滚动监听
                     if (AppState.dataList.virtualScrollInfo.container && AppState.dataList.virtualScrollInfo.filteredData.length > 0) {
                         AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll); // 确保移除旧的
                         AppState.dataList.virtualScrollInfo.container.addEventListener('scroll', handleScroll);
                         console.debug("UI控件: 添加 dataListPane 滚动监听。");
                     }
                 } else { console.warn("UI控件: applyFiltersAndRenderDataList 未定义 (Data_List.js)。"); }
                break;

            case 'externalGalleryPane': // ID 保持 external
                 // 使用 Plugin Gallery 的状态和函数名
                if (!AppState.pluginGallery.dataLoaded) {
                     console.log("UI控件: 首次进入插件图片管理，加载数据...");
                     if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.remove(UI_CLASSES.HIDDEN);
                     if (DOM.pluginGalleryFolderNoResults) DOM.pluginGalleryFolderNoResults.classList.add(UI_CLASSES.HIDDEN);
                     if (DOM.pluginGalleryFolderListContainer) DOM.pluginGalleryFolderListContainer.innerHTML = '';
                     if (DOM.pluginGalleryImageGrid) DOM.pluginGalleryImageGrid.classList.add(UI_CLASSES.HIDDEN);
                     if (DOM.pluginGalleryPreviewPlaceholder) DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
                     if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);

                     if (typeof fetchPluginImages === "function" && typeof fetchPluginUserData === "function") {
                         const [imagesResult, userDataResult] = await Promise.allSettled([
                             fetchPluginImages(), // 使用新函数名
                             fetchPluginUserData()  // 使用新函数名
                         ]);
                         const imagesOk = imagesResult.status === 'fulfilled' && imagesResult.value === true;
                         const userdataOk = userDataResult.status === 'fulfilled' && userDataResult.value === true;

                         if (imagesOk) {
                             AppState.pluginGallery.dataLoaded = true;
                             if (typeof renderPluginFolderList === "function") renderPluginFolderList(); // 使用新函数名
                             else console.warn("UI控件: renderPluginFolderList 未定义 (Gallery.js)。");
                         } else {
                              if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.add(UI_CLASSES.HIDDEN);
                              if (DOM.pluginGalleryFolderNoResults) {
                                   DOM.pluginGalleryFolderNoResults.textContent = "加载插件图片列表失败。";
                                   DOM.pluginGalleryFolderNoResults.classList.remove(UI_CLASSES.HIDDEN);
                              }
                         }
                         if (!userdataOk) displayToast("加载插件元数据失败", UI_CLASSES.WARNING);

                     } else {
                         console.warn("UI控件: fetchPluginImages 或 fetchPluginUserData 未定义 (Gallery.js)。");
                          if (DOM.pluginGalleryFolderLoading) DOM.pluginGalleryFolderLoading.classList.add(UI_CLASSES.HIDDEN);
                          if (DOM.pluginGalleryFolderNoResults) {
                               DOM.pluginGalleryFolderNoResults.textContent = "错误：无法加载插件图片数据。";
                               DOM.pluginGalleryFolderNoResults.classList.remove(UI_CLASSES.HIDDEN);
                          }
                     }
                 } else {
                     console.log("UI控件: 插件图片管理数据已加载，刷新文件夹列表...");
                     if (typeof renderPluginFolderList === "function") renderPluginFolderList(); // 使用新函数名
                     else console.warn("UI控件: renderPluginFolderList 未定义 (Gallery.js)。");
                 }
                 // 清除右侧编辑器
                 if (typeof clearPluginEditor === "function") clearPluginEditor(); // 使用新函数名
                 else console.warn("UI控件: clearPluginEditor 未定义 (Gallery.js)。");
                break;

             case 'advancedManagementPane':
                console.log("UI控件: 切换到高级管理面板。");
                // 无特殊加载逻辑
                break;

            default:
                console.warn("UI控件: 未知的标签页 ID:", targetTabId);
        }
    } catch (error) {
         console.error(`UI控件: 切换到标签页 ${targetTabId} 时出错:`, error);
         displayToast(`加载 ${targetTabId} 出错`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    } finally {
        // 动画结束后解除锁定
        setTimeout(() => {
            AppState.isSwitchingTabs = false;
            console.debug("UI控件: 标签页切换完成。");
        }, 550);
    }
}

/**
 * 设置标签页导航按钮的点击事件监听器。
 */
function setupTabNavigation() {
    if (!DOM.tabButtons || DOM.tabButtons.length === 0) {
        console.error("UI控件: 未找到标签页按钮。");
        return;
    }
    DOM.tabButtons.forEach(button => {
        const targetTabId = button.dataset.tab;
        if (targetTabId) {
            // 清除旧监听器以防万一
            const handler = () => switchTab(targetTabId);
            button.removeEventListener('click', handler); // 需要存储 handler 或使用匿名函数移除
            button.addEventListener('click', handler);
        } else {
            console.warn("UI控件: 发现无 data-tab 属性的标签按钮:", button);
        }
    });
    console.log("UI控件: 标签页导航设置完成。");
}

// --------------------------------------------------------------------------
// Home 面板控件 (Switches)
// --------------------------------------------------------------------------

/**
 * 更新 Home 面板上所有状态开关的显示文本和选中状态。
 */
async function updateGalleryStatusDisplay() {
    console.log("UI控件: 更新 Home 面板状态...");

    const elements = {
        galleryText: DOM.galleryStatusText, mihoyoText: DOM.mihoyoStatusText,
        px18Text: DOM.px18StatusText, rx18Text: DOM.rx18StatusText,
        gallerySwitch: DOM.galleryToggleSwitch, mihoyoSwitch: DOM.mihoyoToggleSwitch,
        px18Switch: DOM.px18ToggleSwitch, rx18Switch: DOM.rx18ToggleSwitch
    };
    const textElements = [elements.galleryText, elements.mihoyoText, elements.px18Text, elements.rx18Text];
    const switchElements = [elements.gallerySwitch, elements.mihoyoSwitch, elements.px18Switch, elements.rx18Switch];

    if (Object.values(elements).some(el => !el)) {
        console.error("UI控件: Home 面板部分状态元素未找到。");
        // 可以选择只更新存在的
    }

    // 设置加载中状态
    textElements.forEach(el => { if (el) el.textContent = '加载中...'; });
    switchElements.forEach(sw => { if (sw) { sw.checked = false; sw.disabled = true; } });

    try {
        const result = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_CONFIG);
        if (!result?.success || typeof result.config !== 'object') {
            throw new Error(result?.error || "获取的配置数据格式无效");
        }
        const config = result.config;
        console.log("UI控件: 获取到图库配置:", config);

        // 更新各开关状态 (使用 ?? 提供默认值 0)
        const updateSwitch = (textEl, switchEl, value, onText, offText) => {
            if (textEl) textEl.textContent = value ? onText : offText;
            if (switchEl) switchEl.checked = !!value;
        };

        updateSwitch(elements.galleryText, elements.gallerySwitch, Number(config.GGOP ?? 0), '已启用', '已关闭');
        updateSwitch(elements.px18Text, elements.px18Switch, Number(config['Px18img-type'] ?? 0), '已启用', '已关闭');
        updateSwitch(elements.rx18Text, elements.rx18Switch, Number(config['Rx18img-type'] ?? 0), '已启用', '已关闭');
        updateSwitch(elements.mihoyoText, elements.mihoyoSwitch, Number(config.MihoyoOption ?? 0), '官方立绘已启用', '官方立绘已关闭');

        // 启用开关
        switchElements.forEach(sw => { if (sw) sw.disabled = false; });
        console.log("UI控件: Home 面板状态更新完成。");

    } catch (error) {
        console.error("UI控件: 加载图库配置失败:", error);
        textElements.forEach(el => { if (el) el.textContent = '加载失败'; });
        displayToast('加载配置出错', UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    }
}

/**
 * 处理 Home 面板上状态开关的 'change' 事件。
 * @param {Event} event - change 事件对象。
 */
async function handleGalleryToggleChange(event) {
    const switchElement = event.target;
    if (!switchElement?.matches('input[type="checkbox"]')) return;

    const switchId = switchElement.id;
    let configKey, statusElement, switchName, onText, offText;

    // 映射开关 ID 到配置项和文本
    const switchMap = {
        'galleryToggleSwitch': { key: 'GGOP', el: DOM.galleryStatusText, name: '图库', on: '已启用', off: '已关闭' },
        'px18ToggleSwitch': { key: 'Px18img-type', el: DOM.px18StatusText, name: 'Px18 模式', on: '已启用', off: '已关闭' },
        'rx18ToggleSwitch': { key: 'Rx18img-type', el: DOM.rx18StatusText, name: 'Rx18 模式', on: '已启用', off: '已关闭' },
        'mihoyoToggleSwitch': { key: 'MihoyoOption', el: DOM.mihoyoStatusText, name: '官方立绘', on: '官方立绘已启用', off: '官方立绘已关闭' }
    };

    const configInfo = switchMap[switchId];
    if (!configInfo) {
        console.error(`UI控件: 未知的开关 ID: ${switchId}`);
        return;
    }

    configKey = configInfo.key;
    statusElement = configInfo.el;
    switchName = configInfo.name;
    onText = configInfo.on;
    offText = configInfo.off;

    if (!statusElement) {
        console.warn(`UI控件: 未找到开关 ${switchId} 对应的状态文本元素。`);
    }

    const newValue = switchElement.checked ? 1 : 0;
    const previousState = !switchElement.checked; // 用于出错时恢复

    // UI 反馈：禁用开关，显示处理中
    switchElement.disabled = true;
    if (statusElement) statusElement.textContent = switchElement.checked ? `${switchName} 启用中...` : `${switchName} 关闭中...`;
    console.log(`UI控件: 发送配置更新: key=${configKey}, value=${newValue}`);

    try {
        const payload = { configKey, newValue };
        const result = await fetchJsonData(API_ENDPOINTS.UPDATE_GALLERY_CONFIG, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!result?.success) {
            throw new Error(result?.error || `更新失败，服务器未明确原因`);
        }

        // 更新成功
        console.log(`UI控件: 配置更新成功: ${configKey}=${newValue}`);
        if (statusElement) statusElement.textContent = newValue ? onText : offText;
        displayToast(`${switchName} 更新成功`, UI_CLASSES.SUCCESS);

    } catch (error) {
        // 更新失败
        console.error(`UI控件: 更新 ${switchName} 配置失败:`, error);
        if (statusElement) statusElement.textContent = `${switchName} 更新失败`;
        displayToast(`${switchName} 更新失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);

        // 恢复 UI 到之前的状态
        switchElement.checked = previousState;
        if (statusElement) statusElement.textContent = previousState ? onText : offText;
        console.log(`UI控件: ${switchName} UI 已恢复到之前的状态 (${previousState ? '启用' : '关闭'})。`);

    } finally {
        // 无论成功失败，最终都重新启用开关
        switchElement.disabled = false;
    }
}

/**
 * 设置 Home 面板上所有开关的事件监听器。
 */
function setupHomePaneEventListeners() {
    const switches = [
        DOM.galleryToggleSwitch, DOM.mihoyoToggleSwitch,
        DOM.px18ToggleSwitch, DOM.rx18ToggleSwitch
    ];
    let listenerCount = 0;
    switches.forEach(switchElement => {
        if (switchElement) {
            switchElement.removeEventListener('change', handleGalleryToggleChange); // 清理旧监听器
            switchElement.addEventListener('change', handleGalleryToggleChange);
            listenerCount++;
        } else {
            // 尝试找出哪个 DOM 引用是 null
            const missingKey = Object.keys(DOM).find(key => switches.includes(DOM[key]) && !DOM[key]);
            console.warn(`UI控件: Home 面板开关元素 ${missingKey || '(未知)'} 未找到。`);
        }
    });
    if (listenerCount > 0) {
        console.log(`UI控件: 为 ${listenerCount} 个 Home 面板开关设置了监听器。`);
    } else {
        console.error("UI控件: 未能为任何 Home 面板开关设置监听器！");
    }
}

// --------------------------------------------------------------------------
// 全局事件处理 (例如：点击外部区域关闭建议列表)
// --------------------------------------------------------------------------

/**
 * 处理全局点击事件，用于关闭打开的建议列表等。
 * @param {MouseEvent} event - 点击事件对象。
 */
function handleGlobalClick(event) {
    const target = event.target;

    // 关闭 Generator 建议列表
    if (DOM.generatorSuggestionList && !DOM.generatorSuggestionList.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideGenerator = DOM.generatorSearchInput?.contains(target) || DOM.generatorSuggestionList.contains(target);
        if (!isClickInsideGenerator) {
            console.debug("全局点击: Generator 建议列表外部，隐藏。");
            DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
            AppState.generator.showingRelatedImages = false;
            AppState.generator.isShowingFolderSuggestions = false;
        }
    }

    // 关闭 Importer 待入库图片建议列表
    if (DOM.importerTempImageSuggestions && !DOM.importerTempImageSuggestions.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideImporterTemp = DOM.importerTempImageSearchInput?.contains(target) || DOM.importerTempImageSuggestions.contains(target);
        if (!isClickInsideImporterTemp) {
            console.debug("全局点击: Importer 待入库建议列表外部，隐藏。");
            DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }

    // 关闭 Importer 目标文件夹建议列表
    if (DOM.importerTargetFolderSuggestions && !DOM.importerTargetFolderSuggestions.classList.contains(UI_CLASSES.HIDDEN)) {
        const isClickInsideImporterTarget = DOM.importerTargetFolderSearchInput?.contains(target) || DOM.importerTargetFolderSuggestions.contains(target);
        if (!isClickInsideImporterTarget) {
            console.debug("全局点击: Importer 目标文件夹建议列表外部，隐藏。");
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
            // 可选：如果失焦时输入框有内容，自动选择
            // handleTargetFolderBlur(); // 但这里调用可能时机不对
        }
    }
}

/**
 * 设置全局事件监听器。
 */
function setupGlobalEventListeners() {
    // 只添加一次全局点击监听器
    document.removeEventListener('click', handleGlobalClick); // 先移除，确保唯一性
    document.addEventListener('click', handleGlobalClick);
    console.log("UI控件: 全局点击监听器设置完成。");
}


