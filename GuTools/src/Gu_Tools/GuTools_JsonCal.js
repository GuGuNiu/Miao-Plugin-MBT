// ==========================================================================
// GuTools JSON 校准模块: 检查 JSON 数据中记录的文件路径是否存在于文件系统。
// ==========================================================================

// 从 Core.js 导入 (如果使用模块化)

// 模块内部状态 (替代之前的全局变量)
let jsonMissingEntriesInternal = []; // 存储 JSON 中存在但文件缺失的完整条目
let jsonMissingPathsInternal = [];   // 仅存储缺失文件的路径，用于移除操作

/**
 * 重置 JSON 校准界面的显示状态。
 */
function resetJsonCalibratorUI() {
    console.log("JSON Calibrator: 重置界面元素。");
    // 重置计数器
    if (DOM.jsonCalEntriesCheckedCount) DOM.jsonCalEntriesCheckedCount.textContent = '0';
    if (DOM.jsonCalFilesCheckedCount) DOM.jsonCalFilesCheckedCount.textContent = '--'; // 未知总数
    if (DOM.jsonCalMissingCount) DOM.jsonCalMissingCount.textContent = '0';
    if (DOM.jsonCalMissingDisplay) DOM.jsonCalMissingDisplay.textContent = '0'; // 同步两个计数显示
    // 重置进度和状态
    if (DOM.jsonCalProgressText) DOM.jsonCalProgressText.textContent = '等待开始...';
    if (DOM.jsonCalProgressBar) {
        DOM.jsonCalProgressBar.style.display = 'none';
        DOM.jsonCalProgressBar.value = 0;
    }
    // 清空列表
    if (DOM.jsonCalMissingList) DOM.jsonCalMissingList.value = '';
    // 重置按钮状态
    if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = false;
    if (DOM.jsonCalRemoveButton) { DOM.jsonCalRemoveButton.disabled = true; DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED); }
    // 清空内部状态
    jsonMissingEntriesInternal = [];
    jsonMissingPathsInternal = [];
    AppState.jsonCalibrator.isRunning = false;
    // AppState.jsonCalibrator.isAborted = false; // 如果有中止功能
}

/**
 * 启动 JSON 校准过程。
 */
async function startJsonCalibration() {
    console.log("JSON Calibrator: 开始执行...");
    // 检查必要的 DOM 元素
    const requiredDOMElements = [
        DOM.jsonCalStartButton, DOM.jsonCalStatusArea, DOM.jsonCalEntriesCheckedCount,
        DOM.jsonCalFilesCheckedCount, DOM.jsonCalMissingCount, DOM.jsonCalProgressText,
        DOM.jsonCalProgressBar, DOM.jsonCalMissingList, DOM.jsonCalMissingDisplay,
        DOM.jsonCalRemoveButton
    ];
    if (requiredDOMElements.some(el => !el)) {
        console.error("JSON Calibrator: 缺少必要的界面元素，无法开始。");
        displayToast("无法开始校准：界面元素缺失", UI_CLASSES.ERROR);
        return;
    }

    // --- 初始化状态和 UI ---
    AppState.jsonCalibrator.isRunning = true;
    jsonMissingEntriesInternal = []; // 清空上次结果
    jsonMissingPathsInternal = [];   // 清空上次结果

    // 更新按钮状态
    DOM.jsonCalStartButton.disabled = true;
    DOM.jsonCalRemoveButton.disabled = true;
    DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);

    // 重置计数器和列表
    DOM.jsonCalEntriesCheckedCount.textContent = '0';
    DOM.jsonCalFilesCheckedCount.textContent = '加载中...';
    DOM.jsonCalMissingCount.textContent = '0';
    DOM.jsonCalMissingDisplay.textContent = '0';
    DOM.jsonCalMissingList.value = '';
    DOM.jsonCalProgressText.textContent = '正在获取文件列表...';
    DOM.jsonCalProgressBar.style.display = 'block'; // 显示进度条
    DOM.jsonCalProgressBar.value = 0;

    displayToast("开始 JSON 校准...", UI_CLASSES.INFO, 2000);

    try {
        // 1. 获取实际存在的文件路径集合
        let actualFilePathsSet = new Set();
        console.log("JSON Calibrator: 正在通过 API 获取文件列表...");
        displayToast("正在获取文件列表...", UI_CLASSES.INFO, 3000);
        try {
            // 复用获取主图库列表的 API
            const imageData = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES);
            if (Array.isArray(imageData)) {
                imageData.forEach(img => { if (img?.urlPath) actualFilePathsSet.add(img.urlPath); });
                console.log(`JSON Calibrator: API 获取到 ${actualFilePathsSet.size} 个唯一文件路径。`);
            } else {
                throw new Error("API 未能返回有效的文件列表数组。");
            }
            if (actualFilePathsSet.size === 0) {
                console.warn("JSON Calibrator: 获取到的实际文件列表为空！校准可能无法找到缺失项。");
            }
        } catch (fetchError) {
            console.error("JSON Calibrator: 获取文件列表失败:", fetchError);
            displayToast(`获取文件列表失败: ${fetchError.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
            AppState.jsonCalibrator.isRunning = false; // 出错，停止运行
            DOM.jsonCalStartButton.disabled = false; // 恢复开始按钮
            DOM.jsonCalProgressText.textContent = '错误：无法获取文件列表';
            return; // 中断执行
        }

        // 更新 UI 显示文件总数
        DOM.jsonCalFilesCheckedCount.textContent = actualFilePathsSet.size.toString();

        // 2. 遍历 JSON 数据进行检查
        const jsonEntries = AppState.userData || []; // 使用内部用户数据
        const totalJsonEntries = jsonEntries.length;
        DOM.jsonCalProgressBar.max = totalJsonEntries;
        let checkedJsonCount = 0;
        let missingFileCount = 0;
        const missingDetails = []; // 存储缺失详情文本

        DOM.jsonCalProgressText.textContent = `开始检查 0 / ${totalJsonEntries} 条 JSON 记录...`;
        console.log("JSON Calibrator: 开始遍历 JSON 数据进行检查...");

        for (const entry of jsonEntries) {
            // 可选：添加中止检查逻辑
            // if (AppState.jsonCalibrator.isAborted) { ... break; }

            checkedJsonCount++;
            DOM.jsonCalEntriesCheckedCount.textContent = checkedJsonCount.toString();
            const entryPathForDisplay = entry?.path || '无路径记录';
            DOM.jsonCalProgressText.textContent = `检查 JSON ${checkedJsonCount}/${totalJsonEntries}: ${entryPathForDisplay}`;
            DOM.jsonCalProgressBar.value = checkedJsonCount;

            // 跳过没有路径的记录
            if (!entry?.path) {
                console.warn("JSON Calibrator: 跳过一条没有路径的 JSON 记录:", entry);
                continue;
            }

            // 检查文件路径是否存在于实际文件 Set 中
            if (!actualFilePathsSet.has(entry.path)) {
                missingFileCount++;
                // 提取信息用于显示
                const filename = entry.attributes?.filename || path.basename(entry.path);
                const character = entry.characterName || '未知角色';
                const gid = entry.gid || 'N/A';
                // 记录详情
                missingDetails.push(`路径: ${entry.path}\n 文件名: ${filename}\n 角色: ${character}\n GID: ${gid}\n`);
                // 存储完整条目和路径以供后续移除
                jsonMissingEntriesInternal.push(entry);
                jsonMissingPathsInternal.push(entry.path);
                // 更新 UI 计数
                DOM.jsonCalMissingCount.textContent = missingFileCount.toString();
                DOM.jsonCalMissingDisplay.textContent = missingFileCount.toString();
            }

            // 每处理 100 条暂停一下，避免 UI 冻结
            if (checkedJsonCount % 100 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        } // JSON 遍历结束

        console.log("JSON Calibrator: JSON 数据检查循环结束。");

        // 3. 显示最终结果
        DOM.jsonCalMissingList.value = missingDetails.join('\n'); // 显示缺失详情
        DOM.jsonCalProgressText.textContent = `完成 ${totalJsonEntries} 条 JSON 记录的检查。`;

        if (missingFileCount > 0) {
            displayToast(`JSON 校准完成，发现 ${missingFileCount} 条记录对应的文件已丢失。`, UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION);
            // 启用移除按钮
            DOM.jsonCalRemoveButton.disabled = false;
            DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED);
        } else {
            displayToast("JSON 校准完成，所有 JSON 记录对应的文件都存在！", UI_CLASSES.SUCCESS);
            // 确保移除按钮是禁用的
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
        }

    } catch (error) { // 捕获整个校准过程中的其他未预料错误
        console.error("JSON 校准过程中发生严重错误:", error);
        displayToast(`JSON 校准失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.jsonCalProgressText.textContent = '校准出错!';
        // 如果在出错前已经发现缺失项，允许移除
        if (jsonMissingPathsInternal.length > 0) {
            DOM.jsonCalRemoveButton.disabled = false;
            DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED);
        }
    } finally {
        // --- 无论成功或失败，最终都要执行 ---
        console.log("JSON Calibrator: 进入 finally 块，清理状态。");
        AppState.jsonCalibrator.isRunning = false; // 标记运行结束
        DOM.jsonCalStartButton.disabled = false; // 恢复开始按钮
        // 可选：隐藏进度条
        // if (DOM.jsonCalProgressBar) DOM.jsonCalProgressBar.style.display = 'none';
    }
}

/**
 * 处理移除缺失文件记录按钮的点击事件。
 */
async function removeMissingJsonEntries() {
    // 检查按钮是否可用以及是否有需要移除的数据
    if (!DOM.jsonCalRemoveButton || DOM.jsonCalRemoveButton.disabled) return;
    if (jsonMissingPathsInternal.length === 0) {
        displayToast("没有检测到文件缺失的记录可供移除。", UI_CLASSES.INFO);
        return;
    }

    // 确认操作 (高风险警告)
    const confirmed = confirm(
        `警告：即将从 ImageData.json 中永久删除 ${jsonMissingPathsInternal.length} 条记录！\n` +
        `这些记录对应的图片文件已在文件系统中找不到。\n` +
        `此操作【不可逆】！请确保你了解此操作的后果。\n\n` +
        `确定要删除这些无效记录吗？`
    );

    if (!confirmed) {
        displayToast("移除记录操作已取消。", UI_CLASSES.INFO);
        return;
    }

    // --- 开始移除 ---
    console.log(`JSON Calibrator: 开始移除 ${jsonMissingPathsInternal.length} 条文件缺失的记录...`);
    // 禁用移除和开始按钮
    DOM.jsonCalRemoveButton.disabled = true;
    DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = true; // 防止在移除时开始新的校准
    displayToast("正在移除 JSON 记录...", UI_CLASSES.INFO);

    try {
        // 1. 创建需要移除的路径 Set 以便快速查找
        const pathsToRemoveSet = new Set(jsonMissingPathsInternal);

        // 2. 从当前的 AppState.userData 中过滤掉需要移除的条目
        const updatedEntries = AppState.userData.filter(entry => !pathsToRemoveSet.has(entry.path));
        const removedCount = AppState.userData.length - updatedEntries.length; // 计算实际移除的数量

        console.log(`JSON Calibrator: 准备写入 ${updatedEntries.length} 条有效记录 (移除了 ${removedCount} 条)。`);

        // 3. 调用核心更新函数保存更新后的数据
        // 确保 updateUserData 函数可用 (应在 Core.js 或 Data_List.js)
        if (typeof updateUserData !== 'function') {
            throw new Error("核心函数 updateUserData 未定义！");
        }
        // 调用更新函数，消息显示在 Toast
        const success = await updateUserData(
            updatedEntries,
            `成功移除了 ${removedCount} 条文件缺失的记录`,
            'toast', // 显示在 Toast
            false // 是内部数据
        );

        if (success) {
            // 更新成功后的 UI 清理
            displayToast(`成功移除了 ${removedCount} 条记录！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            // 清空界面显示
            if (DOM.jsonCalMissingList) DOM.jsonCalMissingList.value = '';
            if (DOM.jsonCalMissingCount) DOM.jsonCalMissingCount.textContent = '0';
            if (DOM.jsonCalMissingDisplay) DOM.jsonCalMissingDisplay.textContent = '0';
            // 清空内存中的状态
            jsonMissingEntriesInternal = [];
            jsonMissingPathsInternal = [];
            // 禁用移除按钮 (因为已经移完了)
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
            // 更新其他地方可能依赖的计数 (如果函数可用)
            if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
            if (typeof updateDataListCount === "function") updateDataListCount();
            // 如果数据列表可见，刷新它
            const dataListPaneActive = DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") {
                applyFiltersAndRenderDataList();
            }
        } else {
            // updateUserData 内部应已显示错误 Toast
            console.error("JSON Calibrator: 调用 updateUserData 返回失败。");
            // 保留移除按钮为禁用状态，因为更新失败
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
        }
    } catch (error) {
        console.error("JSON Calibrator: 移除记录时出错:", error);
        displayToast(`移除记录失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        // 移除失败，允许用户重试
        DOM.jsonCalRemoveButton.disabled = false;
        DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED);
    } finally {
        // 无论成功或失败，最终都恢复开始按钮
        if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = false;
    }
}


// --------------------------------------------------------------------------
// 事件监听器设置 (JSON Calibrator Specific)
// --------------------------------------------------------------------------
/**
 * 设置 JSON 校准视图内的事件监听器。
 */
function setupJsonCalibratorEventListeners() {
    // 开始校准按钮
    if (DOM.jsonCalStartButton) {
        DOM.jsonCalStartButton.removeEventListener('click', startJsonCalibration);
        DOM.jsonCalStartButton.addEventListener('click', startJsonCalibration);
    } else { console.error("JSON Calibrator: 开始按钮 (startJsonCalibration) 未找到！"); }

    // 移除缺失记录按钮
    if (DOM.jsonCalRemoveButton) {
        DOM.jsonCalRemoveButton.removeEventListener('click', removeMissingJsonEntries);
        DOM.jsonCalRemoveButton.addEventListener('click', removeMissingJsonEntries);
    } else { console.error("JSON Calibrator: 移除按钮 (removeMissingEntriesBtn) 未找到！"); }

    console.log("JSON Calibrator: 事件监听器设置完成。");
}

