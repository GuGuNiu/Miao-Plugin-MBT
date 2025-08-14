// ==========================================================================
// UI 控制: 处理通用 UI 交互, 标签页导航。
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