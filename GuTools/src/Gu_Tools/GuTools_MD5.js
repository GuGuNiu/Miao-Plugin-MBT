// ==========================================================================
// GuTools MD5 校准: 检查图片文件的 MD5 值是否与 JSON 数据匹配
// ==========================================================================

// 模块内部状态
let md5Mismatches = []; // 存储不一致的详细信息 { path(完整Web路径), expected, actual }
let filesNotInJson = []; // 存储文件存在但 JSON 无记录的文件路径 (完整Web路径)

/**
 * 填充 MD5 校准视图左侧的 JSON 记录列表
 */
function populateMd5JsonList() {
    if (!DOM.md5JsonListContainer || !DOM.md5JsonTotalDisplay) {
        console.warn("MD5 校准: 无法填充列表 缺少 DOM 元素");
        return;
    }
    const listContainer = DOM.md5JsonListContainer;
    const totalDisplay = DOM.md5JsonTotalDisplay;
    const entries = AppState.userData || []; // 使用内部用户数据

    listContainer.innerHTML = '';
    totalDisplay.textContent = entries.length.toString();

    if (entries.length === 0) {
        listContainer.innerHTML = '<p class="list-placeholder">JSON 数据为空</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    // 按仓库 再按相对路径排序
    entries.sort((a, b) => {
        const boxCompare = (a.storagebox || '').localeCompare(b.storagebox || '');
        if (boxCompare !== 0) return boxCompare;
        return (a.path || '').localeCompare(b.path || '');
    });

    entries.forEach(entry => {
        if (entry && entry.path && entry.attributes && entry.storagebox) { // 确保有 storagebox
            const listItem = document.createElement('div');
            listItem.className = 'json-md5-item';
            // 构建完整 Web 路径用于 data-path 方便后续查找和高亮
            // 需要找到原始大小写的 storageBox
            const originalCaseStorageBox = AppState.availableStorageBoxes.find(box => box.toLowerCase() === entry.storagebox.toLowerCase());
            const fullWebPath = buildFullWebPath(originalCaseStorageBox || entry.storagebox, entry.path); // 使用 Core.js 的辅助函数
            if (!fullWebPath) return; // 如果无法构建路径 则跳过
            listItem.dataset.path = fullWebPath;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            let displayName = entry.attributes.filename || entry.path.split('/').pop() || '未知文件名';
            const lastDotIndex = displayName.lastIndexOf('.');
            if (lastDotIndex > 0) { displayName = displayName.substring(0, lastDotIndex); }
            nameSpan.textContent = `${displayName}`; // 显示仓库和文件名 (优先显示原始大小写)
            nameSpan.title = fullWebPath; // 悬停显示完整路径

            const md5Span = document.createElement('span');
            md5Span.className = 'item-md5';
            md5Span.textContent = entry.attributes.md5 || 'N/A';
            md5Span.title = entry.attributes.md5 || '无 MD5 记录';

            listItem.appendChild(nameSpan);
            listItem.appendChild(md5Span);
            fragment.appendChild(listItem);
        }
    });

    listContainer.appendChild(fragment);
    console.log(`MD5 校准: 左侧 JSON 列表已填充 ${entries.length} 条记录`);
}


/**
 * 重置 MD5 校准界面的显示状态
 */
function resetMd5CheckerUI() {
    console.log("MD5 校准: 重置界面元素");
    if (DOM.md5MismatchedList) DOM.md5MismatchedList.value = '';
    if (DOM.md5FilesNotInJsonList) DOM.md5FilesNotInJsonList.value = '';
    if (DOM.md5MismatchedCount) DOM.md5MismatchedCount.textContent = '0';
    if (DOM.md5MismatchedDisplay) DOM.md5MismatchedDisplay.textContent = '0';
    if (DOM.md5FilesNotInJsonCount) DOM.md5FilesNotInJsonCount.textContent = '0';
    if (DOM.md5ProgressText) DOM.md5ProgressText.textContent = '等待开始...';
    if (DOM.md5ProgressBar) { DOM.md5ProgressBar.style.display = 'none'; DOM.md5ProgressBar.value = 0; }
    if (DOM.md5FilesCheckedCount) DOM.md5FilesCheckedCount.textContent = '0';
    if (DOM.md5TotalFilesChecked) DOM.md5TotalFilesChecked.textContent = '--';
    if (DOM.md5TotalJsonEntries) DOM.md5TotalJsonEntries.textContent = AppState.userData.length.toString();
    if (DOM.md5StartButton) DOM.md5StartButton.disabled = false;
    if (DOM.md5AbortButton) { DOM.md5AbortButton.disabled = true; DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN); }
    if (DOM.md5FixAllButton) { DOM.md5FixAllButton.disabled = true; DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED); }
    if (DOM.md5JsonListContainer) {
        DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));
    }
    md5Mismatches = [];
    filesNotInJson = [];
    AppState.md5Checker.isRunning = false;
    AppState.md5Checker.isAborted = false;
}


/**
 * 启动 MD5 校准过程
 */
async function startMd5Calibration() {
    console.log("MD5 校准: 开始执行...");
    const requiredDOMElements = [
        DOM.md5StartButton, DOM.md5AbortButton, DOM.md5StatusArea, DOM.md5TotalFilesChecked,
        DOM.md5FilesCheckedCount, DOM.md5TotalJsonEntries, DOM.md5MismatchedCount, DOM.md5ProgressText,
        DOM.md5ProgressBar, DOM.md5JsonListContainer, DOM.md5MismatchedList, DOM.md5FixAllButton,
        DOM.md5FilesNotInJsonCount, DOM.md5FilesNotInJsonList, DOM.md5MismatchedDisplay, DOM.md5JsonTotalDisplay
    ];
    if (requiredDOMElements.some(el => !el)) {
        console.error("MD5 校准: 缺少必要的界面元素 无法开始");
        displayToast("无法开始校准：界面元素缺失", UI_CLASSES.ERROR);
        return;
    }

    // --- 初始化状态和 UI ---
    AppState.md5Checker.isRunning = true;
    AppState.md5Checker.isAborted = false;
    md5Mismatches = [];
    filesNotInJson = [];
    DOM.md5StartButton.disabled = true;
    DOM.md5AbortButton.disabled = false;
    DOM.md5AbortButton.classList.remove(UI_CLASSES.HIDDEN);
    DOM.md5FixAllButton.disabled = true;
    DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
    DOM.md5TotalFilesChecked.textContent = '加载中...';
    DOM.md5FilesCheckedCount.textContent = '0';
    DOM.md5TotalJsonEntries.textContent = AppState.userData.length.toString();
    DOM.md5MismatchedCount.textContent = '0';
    DOM.md5MismatchedDisplay.textContent = '0';
    DOM.md5MismatchedList.value = '';
    DOM.md5FilesNotInJsonCount.textContent = '0';
    DOM.md5FilesNotInJsonList.value = '';
    DOM.md5ProgressText.textContent = '正在获取文件列表...';
    DOM.md5ProgressBar.style.display = 'block';
    DOM.md5ProgressBar.value = 0;
    DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));
    displayToast("MD5 校准开始...", UI_CLASSES.INFO, 2000);

    try {
        // 获取实际存在的文件列表
        let allPhysicalFilesData = AppState.galleryImages || [];
        if (allPhysicalFilesData.length === 0) {
            console.log("MD5 校准: 图库数据为空 尝试重新获取...");
            displayToast("正在获取文件列表...", UI_CLASSES.INFO, 3000);
            try {
                const imageData = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES);
                if (Array.isArray(imageData)) {
                    // 需要重新应用 Core.js 中的处理逻辑来标准化数据
                    AppState.galleryImages = imageData.map((img, index) => {
                        let currentStorageBox = img.storageBox || img.storagebox;
                        let originalUrlPath = img.urlPath || '';
                        let relativePath = '';
                        if (!currentStorageBox) { currentStorageBox = 'unknown'; }
                        let pathWithoutRepo = originalUrlPath;
                        if (typeof pathWithoutRepo !== 'string') pathWithoutRepo = '';
                        const escapedStorageBox = currentStorageBox.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const repoPrefixRegex = new RegExp(`^/?(${escapedStorageBox})/`, 'i');
                        while (pathWithoutRepo.match(repoPrefixRegex)) { pathWithoutRepo = pathWithoutRepo.replace(repoPrefixRegex, ''); }
                        relativePath = pathWithoutRepo.startsWith('/') ? pathWithoutRepo.substring(1) : pathWithoutRepo;
                        const finalRelativePath = relativePath.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
                        return { ...img, storageBox: currentStorageBox, urlPath: finalRelativePath, storagebox: undefined };
                    });
                    allPhysicalFilesData = AppState.galleryImages; // 更新引用
                    AppState.availableStorageBoxes = [...new Set(AppState.galleryImages.map(img => img.storageBox).filter(Boolean))].sort(); // 更新可用仓库
                    console.log(`MD5 校准: API 获取到 ${allPhysicalFilesData.length} 个文件数据`);
                } else { throw new Error("无法获取有效的文件列表数据"); }
            } catch (fetchError) {
                console.error("MD5 校准: 获取文件列表失败:", fetchError);
                displayToast(`获取文件列表失败: ${fetchError.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
                AppState.md5Checker.isRunning = false; DOM.md5StartButton.disabled = false; DOM.md5AbortButton.disabled = true; DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN); DOM.md5ProgressText.textContent = '错误：无法获取文件列表';
                return;
            }
        }
        if (allPhysicalFilesData.length === 0) { throw new Error("获取到的文件列表为空"); }

        const totalFiles = allPhysicalFilesData.length;
        DOM.md5TotalFilesChecked.textContent = totalFiles.toString();
        DOM.md5ProgressBar.max = totalFiles;

        // 准备 JSON 数据
        const jsonEntries = AppState.userData || [];
        const jsonPathToMd5Map = new Map(); // key: 完整 Web 路径 value: md5
        const jsonPathSet = AppState.userDataPaths; // 直接使用已构建好的 Set

        jsonEntries.forEach(entry => {
            if (entry.path && entry.storagebox && entry.attributes?.md5) { // 假设 JSON 中是小写 storagebox
                const originalCaseStorageBox = AppState.availableStorageBoxes.find(box => box.toLowerCase() === entry.storagebox.toLowerCase());
                if (originalCaseStorageBox) {
                    const fullWebPath = buildFullWebPath(originalCaseStorageBox, entry.path); // 使用原始大小写构建
                    if (fullWebPath) jsonPathToMd5Map.set(fullWebPath, entry.attributes.md5);
                }
            }
        });

        // 遍历文件列表 进行比较
        let mismatchedCount = 0;
        let checkedFileCount = 0;
        let filesNotInJsonCountLocal = 0;
        const mismatchDetails = [];
        const filesNotInJsonDetails = [];

        DOM.md5ProgressText.textContent = `开始检查 0 / ${totalFiles}...`;
        console.log("MD5 校准: 开始遍历文件进行检查...");

        for (const fileData of allPhysicalFilesData) { // fileData 包含原始大小写 storageBox 和相对 urlPath
            if (AppState.md5Checker.isAborted) {
                console.log("MD5 校准: 操作被用户中止");
                DOM.md5ProgressText.textContent = `已中止 (${checkedFileCount}/${totalFiles})`;
                displayToast("MD5 校准已中止", UI_CLASSES.WARNING);
                if (md5Mismatches.length > 0) { DOM.md5FixAllButton.disabled = false; DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED); }
                break;
            }

            checkedFileCount++;
            DOM.md5FilesCheckedCount.textContent = checkedFileCount.toString();
            const filenameForDisplay = fileData.fileName || '未知文件';
            DOM.md5ProgressText.textContent = `检查 ${checkedFileCount}/${totalFiles}: ${filenameForDisplay} `; // 显示原始大小写
            DOM.md5ProgressBar.value = checkedFileCount;

            const currentFullWebPath = buildFullWebPath(fileData.storageBox, fileData.urlPath); // 使用原始大小写构建
            if (!currentFullWebPath) { console.warn("MD5 校准: 无法为文件构建完整路径 跳过:", fileData); continue; }

            const listItem = DOM.md5JsonListContainer.querySelector(`.json-md5-item[data-path="${CSS.escape(currentFullWebPath)}"]`);

            if (!jsonPathSet.has(currentFullWebPath)) { // 使用完整路径检查 Set
                filesNotInJsonCountLocal++;
                filesNotInJson.push(currentFullWebPath);
                filesNotInJsonDetails.push(currentFullWebPath);
                DOM.md5FilesNotInJsonCount.textContent = filesNotInJsonCountLocal.toString();
                continue;
            }

            const expectedMd5 = jsonPathToMd5Map.get(currentFullWebPath);
            if (!expectedMd5) { if (listItem) listItem.classList.remove('mismatched'); continue; }

            try {
                const actualMd5 = await fetchImageMd5(currentFullWebPath); // 使用完整路径请求 MD5
                if (actualMd5 && actualMd5 !== expectedMd5) {
                    mismatchedCount++;
                    const detail = `文件: ${currentFullWebPath}\n JSON: ${expectedMd5}\n 实际: ${actualMd5}\n`;
                    mismatchDetails.push(detail);
                    md5Mismatches.push({ path: currentFullWebPath, expected: expectedMd5, actual: actualMd5 });
                    DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                    DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                    if (listItem) listItem.classList.add('mismatched');
                } else if (!actualMd5) {
                    mismatchedCount++;
                    const detail = `文件: ${currentFullWebPath}\n JSON: ${expectedMd5}\n 实际: 计算失败!\n`;
                    mismatchDetails.push(detail);
                    DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                    DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                    if (listItem) listItem.classList.add('mismatched');
                    console.warn(`MD5 校准: 文件 ${currentFullWebPath} MD5 计算失败`);
                } else {
                    if (listItem) listItem.classList.remove('mismatched');
                }
            } catch (md5Error) {
                mismatchedCount++;
                const detail = `文件: ${currentFullWebPath}\n 处理出错: ${md5Error.message}\n`;
                mismatchDetails.push(detail);
                DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                if (listItem) listItem.classList.add('mismatched');
                console.error(`MD5 校准: 处理文件 ${currentFullWebPath} 时出错:`, md5Error);
            }
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        console.log("MD5 校准: 文件检查循环结束");
        DOM.md5MismatchedList.value = mismatchDetails.join('\n');
        DOM.md5FilesNotInJsonList.value = filesNotInJsonDetails.join('\n');
        DOM.md5FilesNotInJsonCount.textContent = filesNotInJsonCountLocal.toString();

        if (!AppState.md5Checker.isAborted) {
            DOM.md5ProgressText.textContent = `完成 ${totalFiles} 个文件的检查`;
            if (mismatchedCount > 0) {
                displayToast(`校准完成 发现 ${mismatchedCount} 个 MD5 不一致或错误`, UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION);
                if (md5Mismatches.length > 0) { DOM.md5FixAllButton.disabled = false; DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED); }
                else { DOM.md5FixAllButton.disabled = true; DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED); }
            } else {
                displayToast("校准完成 所有文件的 MD5 均匹配！", UI_CLASSES.SUCCESS);
                DOM.md5FixAllButton.disabled = true; DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
            }
        }

    } catch (error) {
        console.error("MD5 校准过程中发生严重错误:", error);
        displayToast(`MD5 校准失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.md5ProgressText.textContent = '校准出错!';
        if (md5Mismatches.length > 0) { DOM.md5FixAllButton.disabled = false; DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED); }
    } finally {
        console.log("MD5 校准: 进入 finally 块 清理状态");
        AppState.md5Checker.isRunning = false;
        DOM.md5StartButton.disabled = false;
        DOM.md5AbortButton.disabled = true;
        DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN);
        if (md5Mismatches.length > 0) {
            if (DOM.md5FixAllButton.disabled) { console.log("MD5 校准 (finally): 检测到可修复项 启用修复按钮"); DOM.md5FixAllButton.disabled = false; DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED); }
        } else {
            if (!DOM.md5FixAllButton.disabled) { console.log("MD5 校准 (finally): 无可修复项 禁用修复按钮"); DOM.md5FixAllButton.disabled = true; DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED); }
        }
    }
}

/**
 * 处理中止 MD5 校准按钮的点击事件
 */
function abortMd5Calibration() {
    if (!AppState.md5Checker.isRunning) return;
    console.log("MD5 校准: 用户请求中止...");
    AppState.md5Checker.isAborted = true;
    displayToast("正在尝试中止 MD5 校准...", UI_CLASSES.WARNING);
    if (DOM.md5AbortButton) DOM.md5AbortButton.disabled = true;
}

/**
 * 处理修复所有 MD5 不一致项按钮的点击事件
 */
async function fixAllMd5Mismatches() {
    if (!DOM.md5FixAllButton || DOM.md5FixAllButton.disabled) return;
    if (md5Mismatches.length === 0) { displayToast("没有需要修复的 MD5 不一致项", UI_CLASSES.INFO); return; }

    const confirmed = confirm( `准备使用计算出的实际 MD5 更新 ${md5Mismatches.length} 条 JSON 记录。\n此操作将直接修改 ImageData.json 文件！\n\n确定要修复吗？` );
    if (!confirmed) { displayToast("MD5 修复操作已取消", UI_CLASSES.INFO); return; }

    DOM.md5FixAllButton.disabled = true;
    DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.md5StartButton) DOM.md5StartButton.disabled = true;
    displayToast("正在修复 MD5...", UI_CLASSES.INFO);

    let updatedCount = 0;
    let failedCount = 0;
    const updatedUserDataList = JSON.parse(JSON.stringify(AppState.userData));

    md5Mismatches.forEach(mismatch => { 
        const fullWebPath = mismatch.path;
        const segments = fullWebPath.startsWith('/') ? fullWebPath.substring(1).split('/') : fullWebPath.split('/');
        if (segments.length < 2) { console.warn(`MD5 修复: 无法从路径解析仓库和相对路径 ${fullWebPath}`); failedCount++; return; }
        const storageboxLower = segments[0].toLowerCase();
        const relativePath = segments.slice(1).join('/');

        const entryIndex = updatedUserDataList.findIndex(entry =>
            entry.storagebox?.toLowerCase() === storageboxLower &&
            entry.path === relativePath
        );

        if (entryIndex > -1) {
            if (!updatedUserDataList[entryIndex].attributes) updatedUserDataList[entryIndex].attributes = {};
            updatedUserDataList[entryIndex].attributes.md5 = mismatch.actual;
            updatedUserDataList[entryIndex].timestamp = new Date().toISOString();
            updatedCount++;
            console.log(`  MD5 修复准备: ${fullWebPath} 的 MD5 将更新为 ${mismatch.actual}`);
        } else {
            failedCount++;
            console.warn(`MD5 修复: 在 JSON 数据副本中未找到仓库 ${storageboxLower} 路径 ${relativePath} 的条目`);
        }
    });

    if (updatedCount === 0) {
        displayToast("未能找到可更新的 JSON 条目", UI_CLASSES.WARNING);
        if (DOM.md5StartButton) DOM.md5StartButton.disabled = false;
        return;
    }

    try {
        if (typeof updateUserData !== 'function') throw new Error("核心函数 updateUserData 未定义！");
        const success = await updateUserData( updatedUserDataList, `成功修复 ${updatedCount} 条 MD5 记录！`, 'toast', false );
        if (success) {
            displayToast(`成功修复 ${updatedCount} 个 MD5！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            if (DOM.md5MismatchedList) DOM.md5MismatchedList.value = '';
            if (DOM.md5MismatchedCount) DOM.md5MismatchedCount.textContent = '0';
            if (DOM.md5MismatchedDisplay) DOM.md5MismatchedDisplay.textContent = '0';
            md5Mismatches = [];
            DOM.md5FixAllButton.disabled = true;
            DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
            if (DOM.md5JsonListContainer) {
                DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));
            }
            displayToast("建议重新进行 MD5 校准以确认结果", UI_CLASSES.INFO, 4000);
        } else {
            console.error("MD5 修复: 调用 updateUserData 返回失败");
            DOM.md5FixAllButton.disabled = true;
            DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
        }
    } catch (error) {
        console.error("MD5 修复: 保存更新时出错:", error);
        displayToast(`保存 MD5 更新失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.md5FixAllButton.disabled = false;
        DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
    } finally {
        if (DOM.md5StartButton) DOM.md5StartButton.disabled = false;
    }
}


// --- 事件监听器设置 ---
/**
 * 设置 MD5 校准视图内的事件监听器
 */
function setupMd5CheckerEventListeners() {
    if (DOM.md5StartButton) { DOM.md5StartButton.removeEventListener('click', startMd5Calibration); DOM.md5StartButton.addEventListener('click', startMd5Calibration); }
    else { console.error("MD5 校准: 开始按钮 startMD5Calibration 未找到！"); }
    if (DOM.md5AbortButton) { DOM.md5AbortButton.removeEventListener('click', abortMd5Calibration); DOM.md5AbortButton.addEventListener('click', abortMd5Calibration); }
    else { console.error("MD5 校准: 中止按钮 abortMD5Calibration 未找到"); }
    if (DOM.md5FixAllButton) { DOM.md5FixAllButton.removeEventListener('click', fixAllMd5Mismatches); DOM.md5FixAllButton.addEventListener('click', fixAllMd5Mismatches); }
    else { console.error("MD5 校准: 修复按钮 fixAllMismatchedMD5 未找到"); }
    console.log("MD5 校准: 事件监听器设置完成");
}