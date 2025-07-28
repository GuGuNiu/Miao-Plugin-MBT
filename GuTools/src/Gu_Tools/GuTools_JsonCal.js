// ==========================================================================
// GuTools JSON 校准: 检查 JSON 数据中记录的文件路径是否存在于文件系统
// ==========================================================================

// 模块内部状态
let jsonMissingEntriesInternal = []; // 存储 JSON 中存在但文件缺失的完整条目 {..., storagebox, path}
let jsonMissingPathsInternal = [];   // 仅存储缺失文件的完整 Web 路径 用于移除操作 /仓库/分类/...

/**
 * 重置 JSON 校准界面的显示状态
 */
function resetJsonCalibratorUI() {
    console.log("JSON Calibrator: 重置界面元素");
    if (DOM.jsonCalEntriesCheckedCount) DOM.jsonCalEntriesCheckedCount.textContent = '0';
    if (DOM.jsonCalFilesCheckedCount) DOM.jsonCalFilesCheckedCount.textContent = '--';
    if (DOM.jsonCalMissingCount) DOM.jsonCalMissingCount.textContent = '0';
    if (DOM.jsonCalMissingDisplay) DOM.jsonCalMissingDisplay.textContent = '0';
    if (DOM.jsonCalProgressText) DOM.jsonCalProgressText.textContent = '等待开始...';
    if (DOM.jsonCalProgressBar) { DOM.jsonCalProgressBar.style.display = 'none'; DOM.jsonCalProgressBar.value = 0; }
    if (DOM.jsonCalMissingList) DOM.jsonCalMissingList.value = '';
    if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = false;
    if (DOM.jsonCalRemoveButton) { DOM.jsonCalRemoveButton.disabled = true; DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED); }
    jsonMissingEntriesInternal = [];
    jsonMissingPathsInternal = [];
    AppState.jsonCalibrator.isRunning = false;
}

/**
 * 启动 JSON 校准过程
 */
async function startJsonCalibration() {
    console.log("JSON Calibrator: 开始执行...");
    const requiredDOMElements = [
        DOM.jsonCalStartButton, DOM.jsonCalStatusArea, DOM.jsonCalEntriesCheckedCount,
        DOM.jsonCalFilesCheckedCount, DOM.jsonCalMissingCount, DOM.jsonCalProgressText,
        DOM.jsonCalProgressBar, DOM.jsonCalMissingList, DOM.jsonCalMissingDisplay,
        DOM.jsonCalRemoveButton
    ];
    if (requiredDOMElements.some(el => !el)) { console.error("JSON Calibrator: 缺少必要的界面元素 无法开始"); displayToast("无法开始校准：界面元素缺失", UI_CLASSES.ERROR); return; }

    AppState.jsonCalibrator.isRunning = true;
    jsonMissingEntriesInternal = [];
    jsonMissingPathsInternal = [];
    DOM.jsonCalStartButton.disabled = true;
    DOM.jsonCalRemoveButton.disabled = true;
    DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
    DOM.jsonCalEntriesCheckedCount.textContent = '0';
    DOM.jsonCalFilesCheckedCount.textContent = '加载中...';
    DOM.jsonCalMissingCount.textContent = '0';
    DOM.jsonCalMissingDisplay.textContent = '0';
    DOM.jsonCalMissingList.value = '';
    DOM.jsonCalProgressText.textContent = '正在构建文件索引...';
    DOM.jsonCalProgressBar.style.display = 'block';
    DOM.jsonCalProgressBar.value = 0;
    displayToast("开始 JSON 校准...", UI_CLASSES.INFO, 2000);

    try {
        // 1. 获取实际存在的文件路径集合 (使用 galleryImages 中的完整 Web 路径 含原始大小写 storageBox)
        let actualFilePathsSet = new Set();
        console.log("JSON Calibrator: 正在构建实际文件路径 Set...");
        if (AppState.galleryImages.length === 0) {
             console.warn("JSON Calibrator: 图库数据为空 尝试重新获取...");
             await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES); // 重新获取并处理
             if (AppState.galleryImages.length === 0) throw new Error("无法获取图库文件列表");
        }
        // 从处理好的 galleryImages 构建完整路径 Set (使用原始大小写 storageBox)
        AppState.galleryImages.forEach(img => {
            if (img.storageBox && img.urlPath) { // 使用驼峰 storageBox 和相对 urlPath
                const fullPath = buildFullWebPath(img.storageBox, img.urlPath); // 使用辅助函数
                if (fullPath) actualFilePathsSet.add(fullPath);
            }
        });
        console.log(`JSON Calibrator: 构建实际文件路径 Set 完成 共 ${actualFilePathsSet.size} 个`);
        if (actualFilePathsSet.size === 0) { console.warn("JSON Calibrator: 实际文件列表为空！"); }

        DOM.jsonCalFilesCheckedCount.textContent = actualFilePathsSet.size.toString();

        // 2. 遍历 JSON 数据进行检查
        const jsonEntries = AppState.userData || [];
        const totalJsonEntries = jsonEntries.length;
        DOM.jsonCalProgressBar.max = totalJsonEntries;
        let checkedJsonCount = 0;
        let missingFileCount = 0;
        const missingDetails = [];

        DOM.jsonCalProgressText.textContent = `开始检查 0 / ${totalJsonEntries} 条 JSON 记录...`;
        console.log("JSON Calibrator: 开始遍历 JSON 数据进行检查...");

        for (const entry of jsonEntries) {
            checkedJsonCount++;
            DOM.jsonCalEntriesCheckedCount.textContent = checkedJsonCount.toString();
            const entryPathForDisplay = entry?.path || '无路径记录';
            const entryBoxForDisplay = entry?.storagebox || '未知仓库'; // JSON 中是小写
            DOM.jsonCalProgressText.textContent = `检查 JSON ${checkedJsonCount}/${totalJsonEntries}: [${entryBoxForDisplay}] ${entryPathForDisplay}`;
            DOM.jsonCalProgressBar.value = checkedJsonCount;

            if (!entry?.path || !entry.storagebox) { // 检查小写
                console.warn("JSON Calibrator: 跳过一条没有路径或仓库的 JSON 记录:", entry);
                continue;
            }

            // 构建该 JSON 条目对应的完整 Web 路径 (需要找到原始大小写仓库名)
            const originalCaseStorageBox = AppState.availableStorageBoxes.find(box => box.toLowerCase() === entry.storagebox.toLowerCase());
            let fullWebPathToCheck = null;
            if (originalCaseStorageBox) {
                 fullWebPathToCheck = buildFullWebPath(originalCaseStorageBox, entry.path); // 使用原始大小写构建
            } else {
                 console.warn(`JSON Calibrator: 未找到仓库 ${entry.storagebox} 的原始大小写 跳过检查`);
                 continue;
            }

            if (!fullWebPathToCheck) {
                 console.warn(`JSON Calibrator: 无法为条目构建完整路径 跳过检查:`, entry);
                 continue;
            }

            // 检查文件路径是否存在于实际文件 Set 中
            if (!actualFilePathsSet.has(fullWebPathToCheck)) {
                missingFileCount++;
                const filename = entry.attributes?.filename || entry.path.split('/').pop() || '未知文件';
                const character = entry.characterName || '未知角色';
                const gid = entry.gid || 'N/A';
                missingDetails.push(`路径: ${fullWebPathToCheck}\n 文件名: ${filename}\n 角色: ${character}\n GID: ${gid}\n`);
                jsonMissingEntriesInternal.push(entry); // 存储原始条目
                jsonMissingPathsInternal.push(fullWebPathToCheck); // 存储完整路径用于移除
                DOM.jsonCalMissingCount.textContent = missingFileCount.toString();
                DOM.jsonCalMissingDisplay.textContent = missingFileCount.toString();
            }

            if (checkedJsonCount % 100 === 0) { await new Promise(resolve => setTimeout(resolve, 1)); }
        }

        console.log("JSON Calibrator: JSON 数据检查循环结束");
        DOM.jsonCalMissingList.value = missingDetails.join('\n');
        DOM.jsonCalProgressText.textContent = `完成 ${totalJsonEntries} 条 JSON 记录的检查`;

        if (missingFileCount > 0) {
            displayToast(`JSON 校准完成 发现 ${missingFileCount} 条记录对应的文件已丢失`, UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION);
            DOM.jsonCalRemoveButton.disabled = false;
            DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED);
        } else {
            displayToast("JSON 校准完成 所有 JSON 记录对应的文件都存在！", UI_CLASSES.SUCCESS);
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
        }

    } catch (error) {
        console.error("JSON 校准过程中发生严重错误:", error);
        displayToast(`JSON 校准失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.jsonCalProgressText.textContent = '校准出错!';
        if (jsonMissingPathsInternal.length > 0) { DOM.jsonCalRemoveButton.disabled = false; DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED); }
    } finally {
        console.log("JSON Calibrator: 进入 finally 块 清理状态");
        AppState.jsonCalibrator.isRunning = false;
        DOM.jsonCalStartButton.disabled = false;
    }
}

/**
 * 处理移除缺失文件记录按钮的点击事件
 */
async function removeMissingJsonEntries() {
    if (!DOM.jsonCalRemoveButton || DOM.jsonCalRemoveButton.disabled) return;
    if (jsonMissingPathsInternal.length === 0) { displayToast("没有检测到文件缺失的记录可供移除", UI_CLASSES.INFO); return; }

    const confirmed = confirm( `警告：将从 ImageData.json 中永久删除 ${jsonMissingPathsInternal.length} 条记录！\n这些记录对应的图片文件已在文件系统中找不到。\n此操作【不可逆】！\n\n确定要删除这些无效记录吗？` );
    if (!confirmed) { displayToast("移除记录操作已取消", UI_CLASSES.INFO); return; }

    DOM.jsonCalRemoveButton.disabled = true;
    DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = true;
    displayToast("正在移除 JSON 记录...", UI_CLASSES.INFO);

    try {
        const pathsToRemoveSet = new Set(jsonMissingPathsInternal); // 包含完整 Web 路径 (原始大小写 storageBox)
        // 从 AppState.userData 过滤掉需要移除的条目
        const updatedEntries = AppState.userData.filter(entry => {
            if (!entry.path || !entry.storagebox) return true; // 保留无效条目?
            const originalCaseStorageBox = AppState.availableStorageBoxes.find(box => box.toLowerCase() === entry.storagebox.toLowerCase());
            if (!originalCaseStorageBox) return true; // 无法确定原始大小写 保留
            const fullWebPath = buildFullWebPath(originalCaseStorageBox, entry.path); // 构建完整路径
            return !pathsToRemoveSet.has(fullWebPath); // 如果路径在移除集合中 则过滤掉
        });
        const removedCount = AppState.userData.length - updatedEntries.length;

        console.log(`JSON Calibrator: 准备写入 ${updatedEntries.length} 条有效记录 (移除了 ${removedCount} 条)`);

        if (typeof updateUserData !== 'function') throw new Error("核心函数 updateUserData 未定义！");
        const success = await updateUserData( updatedEntries, `成功移除了 ${removedCount} 条文件缺失的记录`, 'toast', false );

        if (success) {
            displayToast(`成功移除了 ${removedCount} 条记录！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            if (DOM.jsonCalMissingList) DOM.jsonCalMissingList.value = '';
            if (DOM.jsonCalMissingCount) DOM.jsonCalMissingCount.textContent = '0';
            if (DOM.jsonCalMissingDisplay) DOM.jsonCalMissingDisplay.textContent = '0';
            jsonMissingEntriesInternal = [];
            jsonMissingPathsInternal = [];
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
            if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
            if (typeof updateDataListCount === "function") updateDataListCount();
            const dataListPaneActive = DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") { applyFiltersAndRenderDataList(); }
        } else {
            console.error("JSON Calibrator: 调用 updateUserData 返回失败");
            DOM.jsonCalRemoveButton.disabled = true;
            DOM.jsonCalRemoveButton.classList.add(UI_CLASSES.DISABLED);
        }
    } catch (error) {
        console.error("JSON Calibrator: 移除记录时出错:", error);
        displayToast(`移除记录失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.jsonCalRemoveButton.disabled = false;
        DOM.jsonCalRemoveButton.classList.remove(UI_CLASSES.DISABLED);
    } finally {
        if (DOM.jsonCalStartButton) DOM.jsonCalStartButton.disabled = false;
    }
}


// --- 事件监听器设置 JSON Calibrator Specific ---
/**
 * 设置 JSON 校准视图内的事件监听器
 */
function setupJsonCalibratorEventListeners() {
    if (DOM.jsonCalStartButton) { DOM.jsonCalStartButton.removeEventListener('click', startJsonCalibration); DOM.jsonCalStartButton.addEventListener('click', startJsonCalibration); }
    else { console.error("JSON Calibrator: 开始按钮 startJsonCalibration 未找到！"); }
    if (DOM.jsonCalRemoveButton) { DOM.jsonCalRemoveButton.removeEventListener('click', removeMissingJsonEntries); DOM.jsonCalRemoveButton.addEventListener('click', removeMissingJsonEntries); }
    else { console.error("JSON Calibrator: 移除按钮 removeMissingEntriesBtn 未找到！"); }
    console.log("JSON Calibrator: 事件监听器设置完成");
}