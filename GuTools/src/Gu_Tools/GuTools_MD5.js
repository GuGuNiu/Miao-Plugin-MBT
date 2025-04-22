// ==========================================================================
// GuTools MD5 校准模块: 检查图片文件的 MD5 值是否与 JSON 数据匹配。
// ==========================================================================


// 模块内部状态
let md5Mismatches = []; // 存储不一致的详细信息 { path, expected, actual }
let filesNotInJson = []; // 存储文件存在但 JSON 无记录的文件路径

/**
 * 填充 MD5 校准视图左侧的 JSON 记录列表。
 */
function populateMd5JsonList() {
    // 确保必要的 DOM 元素存在
    if (!DOM.md5JsonListContainer || !DOM.md5JsonTotalDisplay) {
        console.warn("MD5 校准: 无法填充列表，缺少 DOM 元素 (md5JsonListContainer 或 md5JsonTotalDisplay)。");
        return;
    }

    const listContainer = DOM.md5JsonListContainer;
    const totalDisplay = DOM.md5JsonTotalDisplay;
    const entries = AppState.userData || []; // 使用 AppState 中的内部用户数据

    listContainer.innerHTML = ''; // 清空旧列表
    totalDisplay.textContent = entries.length.toString(); // 更新总数

    if (entries.length === 0) {
        listContainer.innerHTML = '<p class="list-placeholder">JSON 数据为空。</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    // 按路径排序
    entries.sort((a, b) => (a.path || '').localeCompare(b.path || ''));

    entries.forEach(entry => {
        // 确保条目有效且包含必要信息
        if (entry && entry.path && entry.attributes) {
            const listItem = document.createElement('div');
            listItem.className = 'json-md5-item'; // 应用样式
            listItem.dataset.path = entry.path; // 存储路径，方便后续查找

            // 显示处理后的文件名 (去掉后缀)
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            let displayName = entry.attributes.filename || path.basename(entry.path); // 使用文件名或从路径提取
            const lastDotIndex = displayName.lastIndexOf('.');
            if (lastDotIndex > 0) {
                displayName = displayName.substring(0, lastDotIndex);
            }
            nameSpan.textContent = displayName;
            nameSpan.title = entry.path; // 鼠标悬停显示完整路径

            // 显示 MD5 值
            const md5Span = document.createElement('span');
            md5Span.className = 'item-md5';
            md5Span.textContent = entry.attributes.md5 || 'N/A'; // 显示 'N/A' 如果没有 MD5
            md5Span.title = entry.attributes.md5 || '无 MD5 记录'; // 悬停提示

            listItem.appendChild(nameSpan);
            listItem.appendChild(md5Span);
            fragment.appendChild(listItem);
        }
    });

    listContainer.appendChild(fragment);
    console.log(`MD5 校准: 左侧 JSON 列表已填充 ${entries.length} 条记录。`);
}


/**
 * 重置 MD5 校准界面的显示状态。
 */
function resetMd5CheckerUI() {
    console.log("MD5 校准: 重置界面元素。");
    // 清空列表和计数
    if (DOM.md5MismatchedList) DOM.md5MismatchedList.value = '';
    if (DOM.md5FilesNotInJsonList) DOM.md5FilesNotInJsonList.value = '';
    if (DOM.md5MismatchedCount) DOM.md5MismatchedCount.textContent = '0';
    if (DOM.md5MismatchedDisplay) DOM.md5MismatchedDisplay.textContent = '0'; // 同步两个计数显示
    if (DOM.md5FilesNotInJsonCount) DOM.md5FilesNotInJsonCount.textContent = '0';
    // 重置进度和状态
    if (DOM.md5ProgressText) DOM.md5ProgressText.textContent = '等待开始...';
    if (DOM.md5ProgressBar) {
        DOM.md5ProgressBar.style.display = 'none';
        DOM.md5ProgressBar.value = 0;
    }
    if (DOM.md5FilesCheckedCount) DOM.md5FilesCheckedCount.textContent = '0';
    if (DOM.md5TotalFilesChecked) DOM.md5TotalFilesChecked.textContent = '--'; // 未知总数
    if (DOM.md5TotalJsonEntries) DOM.md5TotalJsonEntries.textContent = AppState.userData.length.toString(); // 显示当前 JSON 总数
    // 重置按钮状态
    if (DOM.md5StartButton) DOM.md5StartButton.disabled = false;
    if (DOM.md5AbortButton) { DOM.md5AbortButton.disabled = true; DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN); } // 初始隐藏中止按钮
    if (DOM.md5FixAllButton) { DOM.md5FixAllButton.disabled = true; DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED); }
    // 清除列表项的不匹配高亮
    if (DOM.md5JsonListContainer) {
        DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));
    }
    // 清空内部状态
    md5Mismatches = [];
    filesNotInJson = [];
    AppState.md5Checker.isRunning = false;
    AppState.md5Checker.isAborted = false;
}


/**
 * 启动 MD5 校准过程。
 */
async function startMd5Calibration() {
    console.log("MD5 校准: 开始执行...");
    // 检查必要的 DOM 元素是否都已找到
    const requiredDOMElements = [
        DOM.md5StartButton, DOM.md5AbortButton, DOM.md5StatusArea, DOM.md5TotalFilesChecked,
        DOM.md5FilesCheckedCount, DOM.md5TotalJsonEntries, DOM.md5MismatchedCount, DOM.md5ProgressText,
        DOM.md5ProgressBar, DOM.md5JsonListContainer, DOM.md5MismatchedList, DOM.md5FixAllButton,
        DOM.md5FilesNotInJsonCount, DOM.md5FilesNotInJsonList, DOM.md5MismatchedDisplay, DOM.md5JsonTotalDisplay
    ];
    if (requiredDOMElements.some(el => !el)) {
        console.error("MD5 校准: 缺少必要的界面元素，无法开始。");
        displayToast("无法开始校准：界面元素缺失", UI_CLASSES.ERROR);
        return;
    }

    // --- 初始化状态和 UI ---
    AppState.md5Checker.isRunning = true;
    AppState.md5Checker.isAborted = false;
    md5Mismatches = []; // 清空上次结果
    filesNotInJson = []; // 清空上次结果

    // 更新按钮状态
    DOM.md5StartButton.disabled = true;
    DOM.md5AbortButton.disabled = false;
    DOM.md5AbortButton.classList.remove(UI_CLASSES.HIDDEN); // 显示中止按钮
    DOM.md5FixAllButton.disabled = true;
    DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);

    // 重置计数器和列表
    DOM.md5TotalFilesChecked.textContent = '加载中...';
    DOM.md5FilesCheckedCount.textContent = '0';
    DOM.md5TotalJsonEntries.textContent = AppState.userData.length.toString();
    DOM.md5MismatchedCount.textContent = '0';
    DOM.md5MismatchedDisplay.textContent = '0';
    DOM.md5MismatchedList.value = '';
    DOM.md5FilesNotInJsonCount.textContent = '0';
    DOM.md5FilesNotInJsonList.value = '';
    DOM.md5ProgressText.textContent = '正在获取文件列表...';
    DOM.md5ProgressBar.style.display = 'block'; // 显示进度条
    DOM.md5ProgressBar.value = 0;

    // 清除旧的列表高亮
    DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));

    displayToast("MD5 校准开始...", UI_CLASSES.INFO, 2000);

    try {
        // 1. 获取实际存在的文件列表 (使用与获取主图库列表相同的 API)
        let allPhysicalFilePaths = [];
        console.log("MD5 校准: 正在通过 API 获取文件列表...");
        displayToast("正在获取文件列表...", UI_CLASSES.INFO, 3000);
        try {
            // 调用 Core.js 的 fetchJsonData 函数
            const imageData = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES); // 复用获取主图库列表的 API
            if (Array.isArray(imageData)) {
                // 只需要 urlPath
                allPhysicalFilePaths = imageData.map(img => img.urlPath).filter(Boolean);
                console.log(`MD5 校准: API 获取到 ${allPhysicalFilePaths.length} 个文件路径。`);
            } else {
                // 如果 API 返回格式不对，尝试从 AppState 获取 (作为后备)
                console.warn("MD5 校准: API 返回的文件列表格式不正确，尝试从 AppState 获取...");
                if (Array.isArray(AppState.galleryImages)) {
                    allPhysicalFilePaths = AppState.galleryImages.map(img => img.urlPath).filter(Boolean);
                    console.log(`MD5 校准: 从 AppState 获取到 ${allPhysicalFilePaths.length} 个文件路径。`);
                } else {
                    throw new Error("无法获取有效的文件列表数据。");
                }
            }
            if (allPhysicalFilePaths.length === 0) {
                throw new Error("获取到的文件列表为空。");
            }
        } catch (fetchError) {
            console.error("MD5 校准: 获取文件列表失败:", fetchError);
            displayToast(`获取文件列表失败: ${fetchError.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
            AppState.md5Checker.isRunning = false; // 出错，停止运行
            DOM.md5StartButton.disabled = false; // 恢复开始按钮
            DOM.md5AbortButton.disabled = true;
            DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN);
            DOM.md5ProgressText.textContent = '错误：无法获取文件列表';
            return; // 中断执行
        }

        // 更新 UI 显示文件总数
        const totalFiles = allPhysicalFilePaths.length;
        DOM.md5TotalFilesChecked.textContent = totalFiles.toString();
        DOM.md5ProgressBar.max = totalFiles;

        // 2. 准备 JSON 数据以便快速查找
        const jsonEntries = AppState.userData || [];
        const jsonPathToMd5Map = new Map(); // 存储 { path: md5 }
        const jsonPathSet = new Set();      // 存储所有 JSON 中的 path
        jsonEntries.forEach(entry => {
            if (entry?.path) {
                jsonPathSet.add(entry.path);
                if (entry.attributes?.md5) {
                    jsonPathToMd5Map.set(entry.path, entry.attributes.md5);
                }
            }
        });

        // 3. 遍历文件列表，进行比较
        let mismatchedCount = 0;
        let checkedFileCount = 0;
        let filesNotInJsonCountLocal = 0; // 使用局部变量计数
        const mismatchDetails = []; // 存储不一致详情文本

        DOM.md5ProgressText.textContent = `开始检查 0 / ${totalFiles}...`;
        console.log("MD5 校准: 开始遍历文件进行检查...");

        for (const filePath of allPhysicalFilePaths) {
            // 检查是否已中止
            if (AppState.md5Checker.isAborted) {
                console.log("MD5 校准: 操作被用户中止。");
                DOM.md5ProgressText.textContent = `已中止 (${checkedFileCount}/${totalFiles})`;
                displayToast("MD5 校准已中止", UI_CLASSES.WARNING);
                // 如果有不一致项，启用修复按钮
                if (md5Mismatches.length > 0) {
                    DOM.md5FixAllButton.disabled = false;
                    DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
                }
                break; // 跳出循环
            }

            checkedFileCount++;
            DOM.md5FilesCheckedCount.textContent = checkedFileCount.toString();
            //const filenameForDisplay = path.basename(filePath); // 只显示文件名在进度中
            //DOM.md5ProgressText.textContent = `检查 ${checkedFileCount}/${totalFiles}: ${filenameForDisplay}`;
             //使用浏览器方法获取文件名 ---
            let filenameForDisplay = filePath; // 默认显示完整路径
            const lastSlashIndex = filePath.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                filenameForDisplay = filePath.substring(lastSlashIndex + 1); // 获取最后一个斜杠后的部分
            }
            DOM.md5ProgressText.textContent = `检查 ${checkedFileCount}/${totalFiles}: ${filenameForDisplay}`; // <--- 使用新的变量 
            DOM.md5ProgressBar.value = checkedFileCount;

            // 查找对应的 JSON 列表项元素
            const listItem = DOM.md5JsonListContainer.querySelector(`.json-md5-item[data-path="${CSS.escape(filePath)}"]`);

            // 检查文件是否存在于 JSON 数据中
            if (!jsonPathSet.has(filePath)) {
                filesNotInJsonCountLocal++;
                filesNotInJson.push(filePath); // 记录到模块状态
                DOM.md5FilesNotInJsonCount.textContent = filesNotInJsonCountLocal.toString();
                // 如果列表项存在（理论上不应该），可以给个特殊标记？目前跳过
                continue; // 继续检查下一个文件
            }

            // 获取期望的 MD5 值
            const expectedMd5 = jsonPathToMd5Map.get(filePath);
            if (!expectedMd5) {
                // JSON 中存在该路径，但没有 MD5 值，跳过比较
                // console.debug(`MD5 校准: 文件 ${filePath} 在 JSON 中但无 MD5 记录，跳过比较。`);
                if (listItem) listItem.classList.remove('mismatched'); // 确保移除高亮
                continue;
            }

            // 获取实际的 MD5 值
            try {
                // 调用 Core.js 的 fetchImageMd5 函数
                const actualMd5 = await fetchImageMd5(filePath);

                if (actualMd5 && actualMd5 !== expectedMd5) {
                    // MD5 不一致
                    mismatchedCount++;
                    const detail = `文件: ${filePath}\n JSON: ${expectedMd5}\n 实际: ${actualMd5}\n`;
                    mismatchDetails.push(detail);
                    md5Mismatches.push({ path: filePath, expected: expectedMd5, actual: actualMd5 }); // 记录不一致信息
                    DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                    DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                    if (listItem) listItem.classList.add('mismatched'); // 高亮列表项
                } else if (!actualMd5) {
                    // MD5 计算失败
                    mismatchedCount++;
                    const detail = `文件: ${filePath}\n JSON: ${expectedMd5}\n 实际: 计算失败!\n`;
                    mismatchDetails.push(detail);
                    // 注意：计算失败时，我们无法修复，所以不加入 md5Mismatches 供修复
                    DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                    DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                    if (listItem) listItem.classList.add('mismatched'); // 仍然高亮显示问题
                    console.warn(`MD5 校准: 文件 ${filePath} MD5 计算失败。`);
                } else {
                    // MD5 一致
                    if (listItem) listItem.classList.remove('mismatched'); // 移除可能存在的旧高亮
                }
            } catch (md5Error) {
                // 获取 MD5 过程中发生异常
                mismatchedCount++;
                const detail = `文件: ${filePath}\n 处理出错: ${md5Error.message}\n`;
                mismatchDetails.push(detail);
                DOM.md5MismatchedCount.textContent = mismatchedCount.toString();
                DOM.md5MismatchedDisplay.textContent = mismatchedCount.toString();
                if (listItem) listItem.classList.add('mismatched'); // 高亮显示问题
                console.error(`MD5 校准: 处理文件 ${filePath} 时出错:`, md5Error);
            }

            // 短暂延迟，避免请求过于密集 (根据需要调整)
            await new Promise(resolve => setTimeout(resolve, 1)); // 延迟 1ms

        } // 文件遍历循环结束

        console.log("MD5 校准: 文件检查循环结束。");

        // 更新最终的 UI 显示
        DOM.md5MismatchedList.value = mismatchDetails.join('\n'); // 显示不一致详情
        DOM.md5FilesNotInJsonList.value = filesNotInJson.join('\n'); // 显示未在 JSON 中的文件
        DOM.md5FilesNotInJsonCount.textContent = filesNotInJsonCountLocal.toString();

        // 如果校准未被中止，显示最终结果
        if (!AppState.md5Checker.isAborted) {
            DOM.md5ProgressText.textContent = `完成 ${totalFiles} 个文件的检查。`;
            if (mismatchedCount > 0) {
                displayToast(`校准完成，发现 ${mismatchedCount} 个 MD5 不一致或错误。`, UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION);
                // 只有当存在可修复的不一致项时才启用修复按钮
                if (md5Mismatches.length > 0) {
                    DOM.md5FixAllButton.disabled = false;
                    DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
                } else {
                     DOM.md5FixAllButton.disabled = true;
                     DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
                }
            } else {
                displayToast("校准完成，所有文件的 MD5 均匹配！", UI_CLASSES.SUCCESS);
                DOM.md5FixAllButton.disabled = true;
                DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
            }
        }

    } catch (error) { // 捕获整个校准过程中的其他未预料错误
        console.error("MD5 校准过程中发生严重错误:", error);
        displayToast(`MD5 校准失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.md5ProgressText.textContent = '校准出错!';
        // 如果在出错前已经发现不一致项，允许修复
        if (md5Mismatches.length > 0) {
            DOM.md5FixAllButton.disabled = false;
            DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
        }
    } finally {
        // --- 无论成功、失败还是中止，最终都要执行 ---
        console.log("MD5 校准: 进入 finally 块，清理状态。");
        AppState.md5Checker.isRunning = false; // 标记运行结束
        DOM.md5StartButton.disabled = false; // 恢复开始按钮
        DOM.md5AbortButton.disabled = true; // 禁用中止按钮
        DOM.md5AbortButton.classList.add(UI_CLASSES.HIDDEN); // 隐藏中止按钮

        // 再次确认修复按钮状态是否正确
        if (md5Mismatches.length > 0) {
            if (DOM.md5FixAllButton.disabled) { // 如果因为某些原因被禁用了，重新启用
                console.log("MD5 校准 (finally): 检测到可修复项，启用修复按钮。");
                DOM.md5FixAllButton.disabled = false;
                DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
            }
        } else {
            if (!DOM.md5FixAllButton.disabled) { // 如果没有可修复项但按钮是启用的，禁用它
                console.log("MD5 校准 (finally): 无可修复项，禁用修复按钮。");
                DOM.md5FixAllButton.disabled = true;
                DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
            }
        }
         // 可选：隐藏进度条
         // if (DOM.md5ProgressBar) DOM.md5ProgressBar.style.display = 'none';
    }
}

/**
 * 处理中止 MD5 校准按钮的点击事件。
 */
function abortMd5Calibration() {
    if (!AppState.md5Checker.isRunning) return; // 如果没在运行，则不执行操作

    console.log("MD5 校准: 用户请求中止...");
    AppState.md5Checker.isAborted = true; // 设置中止标志
    displayToast("正在尝试中止 MD5 校准...", UI_CLASSES.WARNING);

    // 禁用中止按钮，防止重复点击
    if (DOM.md5AbortButton) DOM.md5AbortButton.disabled = true;
    // 开始按钮仍然禁用，直到校准完全停止 (在 finally 中恢复)
}

/**
 * 处理修复所有 MD5 不一致项按钮的点击事件。
 */
async function fixAllMd5Mismatches() {
    // 检查按钮是否可用以及是否有需要修复的数据
    if (!DOM.md5FixAllButton || DOM.md5FixAllButton.disabled) return;
    if (md5Mismatches.length === 0) {
        displayToast("没有需要修复的 MD5 不一致项。", UI_CLASSES.INFO);
        return;
    }

    // 确认操作
    const confirmed = confirm(
        `准备使用计算出的实际 MD5 更新 ${md5Mismatches.length} 条 JSON 记录。\n` +
        `这将直接修改 ImageData.json 文件！请确保你了解此操作的后果。\n\n` +
        `确定要修复吗？`
    );

    if (!confirmed) {
        displayToast("MD5 修复操作已取消。", UI_CLASSES.INFO);
        return;
    }

    // --- 开始修复 ---
    console.log(`MD5 校准: 开始修复 ${md5Mismatches.length} 个不一致项...`);
    // 禁用修复和开始按钮
    DOM.md5FixAllButton.disabled = true;
    DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.md5StartButton) DOM.md5StartButton.disabled = true; // 防止在修复时开始新的校准
    displayToast("正在修复 MD5...", UI_CLASSES.INFO);

    let updatedCount = 0;
    let failedCount = 0;
    // 创建用户数据的深拷贝以进行修改，避免直接修改 AppState
    const updatedUserDataList = JSON.parse(JSON.stringify(AppState.userData));

    // 遍历所有记录的不一致项
    md5Mismatches.forEach(mismatch => {
        // 在拷贝的数据中查找对应的条目
        const entryIndex = updatedUserDataList.findIndex(entry => entry.path === mismatch.path);
        if (entryIndex > -1) {
            // 找到了条目，更新其 MD5 值
            // 确保 attributes 对象存在
            if (!updatedUserDataList[entryIndex].attributes) {
                updatedUserDataList[entryIndex].attributes = {};
            }
            updatedUserDataList[entryIndex].attributes.md5 = mismatch.actual; // 使用实际计算出的 MD5
            updatedUserDataList[entryIndex].timestamp = new Date().toISOString(); // 更新时间戳
            updatedCount++;
            console.log(`  MD5 修复准备: ${mismatch.path} 的 MD5 将更新为 ${mismatch.actual}`);
        } else {
            // 未找到对应的条目 (理论上不应发生，因为是从 JSON 读出的)
            failedCount++;
            console.warn(`MD5 修复: 在 JSON 数据副本中未找到路径为 ${mismatch.path} 的条目，无法修复。`);
        }
    });

    if (updatedCount === 0) {
        displayToast("未能找到可更新的 JSON 条目。", UI_CLASSES.WARNING);
        if (DOM.md5StartButton) DOM.md5StartButton.disabled = false; // 恢复开始按钮
        return; // 没有更新，提前结束
    }

    // 调用核心更新函数将修改后的数据保存回后端
    try {
        // 确保 updateUserData 函数可用 (应在 Core.js 或 Data_List.js)
        if (typeof updateUserData !== 'function') {
            throw new Error("核心函数 updateUserData 未定义！");
        }
        // 调用更新函数，消息显示在 Toast
        const success = await updateUserData(
            updatedUserDataList,
            `成功修复 ${updatedCount} 条 MD5 记录！`,
            'toast', // 显示在 Toast
            false // 是内部数据
        );

        if (success) {
            // 更新成功后的 UI 清理
            displayToast(`成功修复 ${updatedCount} 个 MD5！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            if (DOM.md5MismatchedList) DOM.md5MismatchedList.value = ''; // 清空不一致列表显示
            if (DOM.md5MismatchedCount) DOM.md5MismatchedCount.textContent = '0'; // 重置计数
            if (DOM.md5MismatchedDisplay) DOM.md5MismatchedDisplay.textContent = '0';
            md5Mismatches = []; // 清空内存中的不一致数据
            DOM.md5FixAllButton.disabled = true; // 禁用修复按钮
            DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
            // 移除 JSON 列表中的高亮
            if (DOM.md5JsonListContainer) {
                DOM.md5JsonListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(item => item.classList.remove('mismatched'));
            }
            // 重新填充左侧列表以反映更新后的 MD5 (可选，因为 updateUserData 内部会更新 AppState.userData)
            // populateMd5JsonList();
            displayToast("建议重新进行 MD5 校准以确认结果。", UI_CLASSES.INFO, 4000);
        } else {
            // updateUserData 内部应已显示错误 Toast
            console.error("MD5 修复: 调用 updateUserData 返回失败。");
            // 保留修复按钮为禁用状态，因为更新失败
            DOM.md5FixAllButton.disabled = true;
            DOM.md5FixAllButton.classList.add(UI_CLASSES.DISABLED);
        }
    } catch (error) {
        console.error("MD5 修复: 保存更新时出错:", error);
        displayToast(`保存 MD5 更新失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        // 保存失败，允许用户重试
        DOM.md5FixAllButton.disabled = false;
        DOM.md5FixAllButton.classList.remove(UI_CLASSES.DISABLED);
    } finally {
        // 无论成功或失败，最终都恢复开始按钮
        if (DOM.md5StartButton) DOM.md5StartButton.disabled = false;
    }
}


// --------------------------------------------------------------------------
// 事件监听器设置 (MD5 Checker Specific)
// --------------------------------------------------------------------------
/**
 * 设置 MD5 校准视图内的事件监听器。
 */
function setupMd5CheckerEventListeners() {
    // 开始校准按钮
    if (DOM.md5StartButton) {
        DOM.md5StartButton.removeEventListener('click', startMd5Calibration);
        DOM.md5StartButton.addEventListener('click', startMd5Calibration);
    } else { console.error("MD5 校准: 开始按钮 (startMD5Calibration) 未找到！"); }

    // 中止校准按钮
    if (DOM.md5AbortButton) {
        DOM.md5AbortButton.removeEventListener('click', abortMd5Calibration);
        DOM.md5AbortButton.addEventListener('click', abortMd5Calibration);
    } else { console.error("MD5 校准: 中止按钮 (abortMD5Calibration) 未找到。"); }

    // 修复所有不一致按钮
    if (DOM.md5FixAllButton) {
        DOM.md5FixAllButton.removeEventListener('click', fixAllMd5Mismatches);
        DOM.md5FixAllButton.addEventListener('click', fixAllMd5Mismatches);
    } else { console.error("MD5 校准: 修复按钮 (fixAllMismatchedMD5) 未找到。"); }

    console.log("MD5 校准: 事件监听器设置完成。");
}
