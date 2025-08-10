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
        return; // 已经是当前页
    }

    console.log(`UI控件: 切换到标签页: ${targetTabId}`);
    AppState.isSwitchingTabs = true;

    // 更新按钮状态
    DOM.tabButtons.forEach(btn => btn.classList.remove(UI_CLASSES.ACTIVE));
    targetButton.classList.add(UI_CLASSES.ACTIVE);

    // 处理面板切换动画
    if (currentActivePane) {
        currentActivePane.classList.add(UI_CLASSES.SLIDING_OUT);
        currentActivePane.classList.remove(UI_CLASSES.ACTIVE);
        // 移除特定面板的事件监听器
        if (currentActivePane.id === 'dataListPane' && AppState.dataList.virtualScrollInfo.container) {
            // handleScroll 在 Data_List.js
            AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll);
            console.debug("UI控件: 移除 dataListPane 滚动监听");
        }
        // 动画结束后清理类
        const paneToRemove = currentActivePane;
        setTimeout(() => paneToRemove?.classList.remove(UI_CLASSES.SLIDING_OUT), 550); // 略长于动画时间
    }

    // 滑入目标面板
    targetPane.classList.remove(UI_CLASSES.SLIDING_OUT);
    targetPane.classList.add(UI_CLASSES.ACTIVE);

    // 特定标签页的加载/初始化逻辑
    try {
        switch (targetTabId) {
            case 'homePane':
                // 切换到 Home 时 刷新状态显示
                if (typeof updateGalleryStatusDisplay === "function") updateGalleryStatusDisplay();
                else console.warn("UI控件: updateGalleryStatusDisplay 未定义");
                break;

            case 'GuTools':
                // 切换到 GuTools 时 根据当前子模式决定是否加载数据
                if (AppState.currentGuToolMode === 'import') {
                    if (typeof ensureImportDataLoaded === "function") {
                        console.log("UI控件: 切换到 GuTools Import 按需加载数据...");
                        await ensureImportDataLoaded(); // 使用 Importer 模块的函数
                    } else { console.warn("UI控件: ensureImportDataLoaded 未定义 GuTools_Import.js"); }
                }
                // 其他 GuTools 子模式的按需加载逻辑在 GuTools_Main.js 的 switchGuToolMode 中处理
                break;

            case 'dataListPane':
                if (typeof applyFiltersAndRenderDataList === "function") {
                    applyFiltersAndRenderDataList(); // 应用过滤器并渲染
                    // 重新添加滚动监听
                    if (AppState.dataList.virtualScrollInfo.container && AppState.dataList.virtualScrollInfo.filteredData.length > 0) {
                        // handleScroll 在 Data_List.js
                        AppState.dataList.virtualScrollInfo.container.removeEventListener('scroll', handleScroll);
                        AppState.dataList.virtualScrollInfo.container.addEventListener('scroll', handleScroll);
                        console.debug("UI控件: 添加 dataListPane 滚动监听");
                    }
                } else { console.warn("UI控件: applyFiltersAndRenderDataList 未定义 Data_List.js"); }
                break;


            case 'pluginGalleryPane':
                // 使用 Plugin Gallery 的状态和函数名
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
                // 清除右侧编辑器
                if (typeof clearPluginEditor === "function") clearPluginEditor();
                else console.warn("UI控件: clearPluginEditor 未定义 Plugin_Gallery.js");
                break;

            case 'banManagementPane':
                if (typeof initializeBanManagement === "function") {
                    initializeBanManagement();
                } else {
                    console.warn("UI控件: initializeBanManagement 未定义 Ban_Management.js");
                }
                break;

            case 'secondaryTagEditorPaneView':
                if (typeof initializeSecondaryTagEditorView === "function") {
                    await initializeSecondaryTagEditorView(); 
                } else {
                    console.warn("UI控件: initializeSecondaryTagEditorView 未定义 GuTools_SecondaryTagEditor.js");
                }
                break;

            case 'advancedManagementPane':
                console.log("UI控件: 切换到高级管理面板");
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
 * 处理 Home 面板上状态控件的 'change' 事件
 * @param {Event} event change 事件对象
 */
async function handleGalleryControlChange(event) {
    const controlElement = event.target;
    if (!controlElement) return;

    let configKey, newValue, statusElement, controlName, valueMap, isRadioGroup = false;
    let radioElements = []; // 用于处理 radio 组的禁用

    if (controlElement.id === 'tuKuOPToggleSwitch' && controlElement.type === 'checkbox') {
        configKey = 'TuKuOP';
        newValue = controlElement.checked ? 1 : 0;
        statusElement = DOM.tuKuOPStatusText;
        controlName = '图库开关';
        valueMap = { 1: '已启用', 0: '已关闭' };
    } else if (controlElement.name === 'pflLevel' && controlElement.type === 'radio') {
        configKey = 'PFL';
        newValue = Number(controlElement.value);
        statusElement = DOM.pflStatusText; // 第 303 行附近的警告触发点
        controlName = '净化等级';
        valueMap = { 0: '关闭净化', 1: '仅过滤R18', 2: '过滤全部敏感数据' };
        isRadioGroup = true;
        radioElements = [
            document.getElementById('pflRadio0'),
            document.getElementById('pflRadio1'),
            document.getElementById('pflRadio2')
        ];
    }
    if (!statusElement) {
        console.warn(`UI控件: 未找到控件 ${controlElement.id || controlElement.name} 对应的状态文本元素`); // 第 303 行
    }

    // 获取之前的状态 (对 Radio 组复杂 暂时省略精确回滚)
    let previousValueText = statusElement ? statusElement.textContent : ''; // 记录之前的文本

    // UI 反馈：禁用控件 显示处理中
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

        // 更新成功
        console.log(`UI控件: 配置更新成功: ${configKey}=${newValue}`);
        if (statusElement) {
            const statusText = valueMap[newValue] ?? `值 ${newValue}`;
            statusElement.textContent = configKey === 'PFL' ? `当前: ${statusText}` : statusText;
        }
        displayToast(`${controlName} 更新成功`, UI_CLASSES.SUCCESS);

    } catch (error) {
        // 更新失败
        console.error(`UI控件: 更新 ${controlName} 配置失败:`, error);
        if (statusElement) statusElement.textContent = `${controlName} 更新失败`; // 显示失败状态
        displayToast(`${controlName} 更新失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);

        // 尝试恢复 UI (对于 Radio 组 重新获取状态)
        if (isRadioGroup) {
            console.log(`UI控件: ${controlName} 更新失败 尝试重新获取状态...`);
            updateGalleryStatusDisplay(); // 重新加载状态来恢复
        } else if (controlElement.type === 'checkbox') {
            // 尝试恢复 Checkbox
            controlElement.checked = !controlElement.checked; // 反转回来
            if (statusElement) statusElement.textContent = previousValueText; // 恢复旧文本
            console.log(`UI控件: ${controlName} UI 已尝试恢复到之前的状态`);
        }

    } finally {
        // 无论成功失败 最终都重新启用控件
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
        document.getElementById('pflRadio2')
    ];
    let listenerCount = 0;
    controls.forEach(controlElement => {
        if (controlElement) {
            controlElement.removeEventListener('change', handleGalleryControlChange);
            controlElement.addEventListener('change', handleGalleryControlChange);
            listenerCount++;
        } else {
            const missingId = controls.indexOf(controlElement) === 0 ? 'tuKuOPToggleSwitch' : `pflRadio${controls.indexOf(controlElement) - 1}`;
            console.warn(`UI控件: Home 面板控件元素 #${missingId} 未找到`);
        }
    });
    if (listenerCount > 0) {
        console.log(`UI控件: 为 ${listenerCount} 个 Home 面板控件设置了监听器`);
    } else {
        console.error("UI控件: 未能为任何 Home 面板控件设置监听器！");
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