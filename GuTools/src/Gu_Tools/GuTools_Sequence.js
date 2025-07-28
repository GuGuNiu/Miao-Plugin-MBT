// ==========================================================================
// GuTools 序号管理: 分析和修复文件夹内文件的命名序号问题
// ==========================================================================

// 模块内部状态
let sequenceAnalysisResultsText = [];
let sequenceFixPlanInternal = []; 

/**
 * 重置序号管理界面的显示状态
 */
function resetSequenceManagerUI() {
    console.log("Sequence Manager: 重置界面元素");
    if (DOM.sequenceStatusArea) { DOM.sequenceStatusArea.innerHTML = '<p>点击按钮开始扫描所有仓库...</p>'; } 
    if (DOM.sequenceIssuesList) { DOM.sequenceIssuesList.value = ''; }
    if (DOM.sequenceFixButton) { DOM.sequenceFixButton.disabled = true; DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED); DOM.sequenceFixButton.textContent = '一键修复'; }
    if (DOM.sequenceAnalyzeButton) { DOM.sequenceAnalyzeButton.disabled = false; }
    // 移除对 sequenceStorageBoxSelect 的处理
    sequenceAnalysisResultsText = [];
    sequenceFixPlanInternal = [];
    AppState.sequenceManager.isRunning = false;
}

/**
 * 获取指定仓库 指定文件夹的文件列表 用于序号分析
 * @param {string} storageBox 仓库名称 
 * @param {string} folderName 要获取内容的文件夹名称
 * @returns {Promise<Array<string>>} 文件名数组
 * @throws {Error} 如果无法获取文件列表
 */
async function getFilesForSequenceAnalysis(storageBox, folderName) {
    console.log(`Sequence Manager: 请求仓库 "${storageBox}" 文件夹 "${folderName}" 的内容...`);
    try {
        const url = `${API_ENDPOINTS.FETCH_FOLDER_CONTENTS}?folder=${encodeURIComponent(folderName)}&storageBox=${encodeURIComponent(storageBox)}`;
        console.debug(`Sequence Manager: Fetching ${url}`);
        const data = await fetchJsonData(url);
        if (Array.isArray(data)) {
            console.log(`Sequence Manager: 获取到 ${storageBox}/${folderName} 内 ${data.length} 个文件`);
            return data;
        } else {
            console.warn(`Sequence Manager: API (${url}) 返回的数据格式不正确:`, data);
            throw new Error(`服务器未能正确返回 '${folderName}' (仓库: ${storageBox}) 的文件列表`);
        }
    } catch (error) {
        console.error(`Sequence Manager: 获取仓库 "${storageBox}" 文件夹 "${folderName}" 内容失败:`, error);
        throw new Error(`无法获取文件夹 '${folderName}' (仓库: ${storageBox}) 的文件列表: ${error.message}`);
    }
}

/**
 * 处理开始分析文件夹序号的按钮点击事件 (扫描所有仓库)
 */
async function analyzeSequences() {
    const requiredDOMElements = [
        DOM.sequenceAnalyzeButton,
        DOM.sequenceStatusArea,
        DOM.sequenceIssuesList,
        DOM.sequenceFixButton
    ];
    if (requiredDOMElements.some(el => !el)) {
        const missing = requiredDOMElements.filter(el => !el).map(el => {
             return Object.keys(DOM).find(key => DOM[key] === el) || '未知元素';
        });
        console.error(`Sequence Manager: 缺少必要的界面元素: ${missing.join(', ')} 无法开始分析`);
        displayToast("无法开始分析：界面元素缺失", UI_CLASSES.ERROR);
        return;
    }

    if (AppState.sequenceManager.isRunning) { displayToast("正在分析中 请稍候...", UI_CLASSES.INFO); return; }


    AppState.sequenceManager.isRunning = true;
    sequenceFixPlanInternal = [];
    sequenceAnalysisResultsText = [];
    DOM.sequenceAnalyzeButton.disabled = true;
    DOM.sequenceFixButton.disabled = true;
    DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED);
    DOM.sequenceFixButton.textContent = `一键修复`;
    DOM.sequenceStatusArea.innerHTML = '<p>正在获取所有仓库的文件夹列表...</p>';
    DOM.sequenceIssuesList.value = '';
    displayToast(`开始分析所有仓库的文件序号...`, UI_CLASSES.INFO, 2000);

    try {
        // 获取所有仓库的所有角色文件夹
        const allFoldersByRepo = AppState.galleryImages.reduce((acc, img) => {
            if (img.storageBox && img.folderName && !img.folderName.startsWith('.')) { 
                if (!acc[img.storageBox]) {
                    acc[img.storageBox] = new Set();
                }
                acc[img.storageBox].add(img.folderName);
            }
            return acc;
        }, {});

        const foldersToScan = Object.entries(allFoldersByRepo).flatMap(([storageBox, folderSet]) =>
            Array.from(folderSet).map(folderName => ({ storageBox, folderName })) 
        );

        if (foldersToScan.length === 0) {
             // 尝试从 characterFoldersList 获取
             if (AppState.importer.characterFoldersList.length > 0) {
                 console.warn("Sequence Manager: galleryImages 中未找到文件夹信息，尝试使用 characterFoldersList");
                 // 需要确定这些文件夹属于哪个仓库，这里无法确定，暂时跳过或报错
                 throw new Error("无法确定文件夹所属仓库，请确保图库列表已正确加载");
             } else {
                 throw new Error(`在所有仓库中都没有找到角色文件夹`);
             }
        }

        const totalFolders = foldersToScan.length;
        DOM.sequenceStatusArea.innerHTML = `<p>获取到 ${totalFolders} 个文件夹 (来自 ${Object.keys(allFoldersByRepo).length} 个仓库) 开始检查...</p>`;

        let problematicFoldersCount = 0;
        const issuesLog = [];
        const sequenceRegex = /Gu(\d+)\.(webp|jpg|jpeg|png|gif)$/i;

        // 遍历所有仓库的所有文件夹进行分析
        for (let i = 0; i < totalFolders; i++) {
            const { storageBox, folderName } = foldersToScan[i]; // 获取仓库和文件夹名 
            DOM.sequenceStatusArea.innerHTML = `<p>检查 (${i + 1}/${totalFolders}): ${folderName} <br> [${storageBox}]</p>`;

            let filesInFolder = [];
            try {
                filesInFolder = await getFilesForSequenceAnalysis(storageBox, folderName); // 调用时传递仓库名
            } catch (fetchError) {
                issuesLog.push(`文件夹: ${folderName} [${storageBox}]`);
                issuesLog.push(`  - 错误: 无法获取文件列表 (${fetchError.message})`);
                issuesLog.push('');
                problematicFoldersCount++;
                console.error(`Sequence Manager: 获取 ${folderName} [${storageBox}] 文件列表时出错 跳过分析`);
                continue;
            }

            const sequencedFiles = [];
            const sequenceNumberMap = new Map();
            for (const filename of filesInFolder) {
                const match = filename.match(sequenceRegex);
                if (match && match[1]) {
                    const sequenceNumber = parseInt(match[1], 10);
                    if (!isNaN(sequenceNumber)) {
                        sequencedFiles.push({ num: sequenceNumber, filename: filename });
                        if (!sequenceNumberMap.has(sequenceNumber)) sequenceNumberMap.set(sequenceNumber, []);
                        sequenceNumberMap.get(sequenceNumber).push(filename);
                    }
                }
            }

            if (sequencedFiles.length === 0) { continue; }

            const folderIssues = [];
            sequencedFiles.sort((a, b) => a.num - b.num);
            let needsFixing = false;

            sequenceNumberMap.forEach((filenames, num) => { if (filenames.length > 1) { folderIssues.push(`  - 问题: 序号 ${num} 重复 (文件: ${filenames.join(', ')})`); needsFixing = true; } });
            if (sequencedFiles.length === 0 || sequencedFiles[0].num !== 1) { const startNum = sequencedFiles.length > 0 ? sequencedFiles[0].num : 'N/A'; const startFile = sequencedFiles.length > 0 ? sequencedFiles[0].filename : 'N/A'; folderIssues.push(`  - 问题: 序号不从 1 开始 (最小: ${startNum} - ${startFile})`); needsFixing = true; }
            for (let j = 0; j < sequencedFiles.length - 1; j++) { const currentNum = sequencedFiles[j].num; const nextNum = sequencedFiles[j + 1].num; if (sequenceNumberMap.get(currentNum)?.length === 1 && nextNum !== currentNum + 1) { folderIssues.push(`  - 问题: 序号不连续 ${currentNum} (${sequencedFiles[j].filename}) -> ${nextNum} (${sequencedFiles[j+1].filename})`); needsFixing = true; } }

            if (folderIssues.length > 0) {
                problematicFoldersCount++;
                issuesLog.push(`文件夹: ${folderName} [${storageBox}]`);
                issuesLog.push(...folderIssues);
                issuesLog.push(`--- 文件列表 (${sequencedFiles.length}) ---`);
                sequencedFiles.forEach(f => issuesLog.push(`  ${f.filename}`));
                issuesLog.push('');

                if (needsFixing) {
                    const filesToRenamePlan = [];
                    let newSequenceNum = 1;
                    const sortedByFilename = [...sequencedFiles].sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));
                    sortedByFilename.forEach(fileInfo => {
                        const extMatch = fileInfo.filename.match(/\.[^.]+$/);
                        const extension = extMatch ? extMatch[0] : '.webp';
                        const newFilename = `${folderName}Gu${newSequenceNum}${extension}`;
                        if (newFilename !== fileInfo.filename) { filesToRenamePlan.push({ currentFilename: fileInfo.filename, newFilename: newFilename }); }
                        newSequenceNum++;
                    });
                    if (filesToRenamePlan.length > 0) {
                        sequenceFixPlanInternal.push({ folderName: folderName, storageBox: storageBox, filesToRename: filesToRenamePlan }); 
                        console.log(`Sequence Manager: 为 "${folderName}" [${storageBox}] 生成了 ${filesToRenamePlan.length} 项修复计划`);
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 5));
        }

        sequenceAnalysisResultsText = issuesLog;
        DOM.sequenceIssuesList.value = issuesLog.join('\n');
        DOM.sequenceStatusArea.innerHTML = `<p>完成分析 ${totalFolders} 个文件夹 <br> (来自 ${Object.keys(allFoldersByRepo).length} 个仓库)</p>`;

        if (problematicFoldersCount > 0 && sequenceFixPlanInternal.length > 0) {
            displayToast(`分析完成 ${problematicFoldersCount} 个文件夹有问题 已生成修复计划`, UI_CLASSES.WARNING);
            DOM.sequenceFixButton.disabled = false;
            DOM.sequenceFixButton.classList.remove(UI_CLASSES.DISABLED);
            DOM.sequenceFixButton.textContent = `一键修复 (${sequenceFixPlanInternal.length} 个文件夹)`;
        } else if (problematicFoldersCount > 0 && sequenceFixPlanInternal.length === 0) {
            displayToast(`分析完成 ${problematicFoldersCount} 个文件夹有问题 但无法自动生成修复计划`, UI_CLASSES.WARNING);
            DOM.sequenceFixButton.textContent = `一键修复`;
        } else {
            displayToast("分析完成 未发现文件序号问题！", UI_CLASSES.SUCCESS);
            DOM.sequenceFixButton.textContent = `一键修复`;
        }

    } catch (error) {
        console.error("Sequence Manager: 分析过程中发生错误:", error);
        displayToast(`分析失败: ${error.message}`, UI_CLASSES.ERROR);
        DOM.sequenceStatusArea.innerHTML = '<p>分析过程中出错!</p>';
    } finally {
        AppState.sequenceManager.isRunning = false;
        DOM.sequenceAnalyzeButton.disabled = false;
    }
}

/**
 * 处理修复文件序号问题的按钮点击事件
 */
async function fixSequenceIssues() {
    if (!DOM.sequenceFixButton || DOM.sequenceFixButton.disabled) return;
    if (sequenceFixPlanInternal.length === 0) { displayToast("当前没有可执行的修复计划", UI_CLASSES.INFO); return; }

    const confirmed = confirm( `警告：即将对 ${sequenceFixPlanInternal.length} 个文件夹中的文件进行批量重命名以修复序号！\n此操作具有较高风险且【不可逆】！强烈建议在执行前备份相关文件夹！\n\n确定要执行修复吗？` );
    if (!confirmed) { displayToast("序号修复操作已取消", UI_CLASSES.INFO); return; }

    DOM.sequenceFixButton.disabled = true;
    DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.sequenceAnalyzeButton) DOM.sequenceAnalyzeButton.disabled = true;
    displayToast("正在发送修复请求...", UI_CLASSES.INFO);
    if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = `<p>正在修复 ${sequenceFixPlanInternal.length} 个文件夹中...</p>`;

    try {
        // 发送包含原始大小写 storageBox 的修复计划
        const response = await fetchJsonData(API_ENDPOINTS.RENAME_SEQUENCE_FILES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixPlan: sequenceFixPlanInternal })
        });

        if (response?.success) {
            const processedFolders = response.processedFolders || '?';
            const renamedFiles = response.renamedFiles || '?';
            displayToast(`序号修复成功！处理了 ${processedFolders} 个文件夹 重命名了 ${renamedFiles} 个文件`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            if (DOM.sequenceIssuesList) DOM.sequenceIssuesList.value = '';
            sequenceFixPlanInternal = [];
            sequenceAnalysisResultsText = [];
            if (DOM.sequenceFixButton) DOM.sequenceFixButton.textContent = `一键修复`;
            if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = '<p>修复完成</p>';
            displayToast("建议重新进行序号分析以确认结果", UI_CLASSES.INFO, 4000);
        } else {
            throw new Error(response?.error || "后端未能成功执行修复操作");
        }
    } catch (error) {
        console.error("Sequence Manager: 序号修复失败:", error);
        displayToast(`序号修复失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.sequenceFixButton.disabled = false;
        DOM.sequenceFixButton.classList.remove(UI_CLASSES.DISABLED);
        if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = '<p>修复失败!</p>';
    } finally {
        if (DOM.sequenceAnalyzeButton) DOM.sequenceAnalyzeButton.disabled = false;
    }
}


// --- 事件监听器设置 ---
/**
 * 设置序号管理视图内的事件监听器
 */
function setupSequenceManagerEventListeners() {
    if (DOM.sequenceAnalyzeButton) { DOM.sequenceAnalyzeButton.removeEventListener('click', analyzeSequences); DOM.sequenceAnalyzeButton.addEventListener('click', analyzeSequences); }
    else { console.error("Sequence Manager: 分析按钮 analyzeSequences 未找到"); }
    if (DOM.sequenceFixButton) { DOM.sequenceFixButton.removeEventListener('click', fixSequenceIssues); DOM.sequenceFixButton.addEventListener('click', fixSequenceIssues); }
    else { console.error("Sequence Manager: 修复按钮 fixSequenceIssues 未找到"); }
    console.log("Sequence Manager: 事件监听器设置完成");
}