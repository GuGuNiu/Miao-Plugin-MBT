// ==========================================================================
// GuTools 序号管理模块: 分析和修复文件夹内文件的命名序号问题。
// ==========================================================================


// 模块内部状态 (替代之前的全局变量)
let sequenceAnalysisResultsText = []; // 存储分析结果的文本行
let sequenceFixPlanInternal = []; // 存储内部生成的修复计划

/**
 * 重置序号管理界面的显示状态。
 */
function resetSequenceManagerUI() {
    console.log("Sequence Manager: 重置界面元素。");
    if (DOM.sequenceStatusArea) {
        DOM.sequenceStatusArea.innerHTML = '<p>点击按钮开始扫描文件夹...</p>'; // 重置状态文本
    }
    if (DOM.sequenceIssuesList) {
        DOM.sequenceIssuesList.value = ''; // 清空问题列表
    }
    if (DOM.sequenceFixButton) {
        DOM.sequenceFixButton.disabled = true; // 禁用修复按钮
        DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED);
        DOM.sequenceFixButton.textContent = '一键修复'; // 重置按钮文本
    }
     if (DOM.sequenceAnalyzeButton) {
         DOM.sequenceAnalyzeButton.disabled = false; // 确保分析按钮可用
     }
    // 清空内部状态
    sequenceAnalysisResultsText = [];
    sequenceFixPlanInternal = [];
    AppState.sequenceManager.isRunning = false;
    // AppState.sequenceManager.isAborted = false; // 如果有中止功能
}

/**
 * 获取指定文件夹的文件列表 (用于序号分析)。
 * @param {string} folderName - 要获取内容的文件夹名称。
 * @returns {Promise<Array<string>>} 文件名数组。
 * @throws {Error} 如果无法获取文件列表。
 */
async function getFilesForSequenceAnalysis(folderName) {
    console.log(`Sequence Manager: 请求文件夹 "${folderName}" 的内容...`);
    try {
        const url = `${API_ENDPOINTS.FETCH_FOLDER_CONTENTS}?folder=${encodeURIComponent(folderName)}`;
        console.debug(`Sequence Manager: Fetching ${url}`);
        // 调用 Core.js 的 fetchJsonData
        const data = await fetchJsonData(url);
        if (Array.isArray(data)) {
            console.log(`Sequence Manager: 获取到 ${folderName} 内 ${data.length} 个文件。`);
            return data; // 返回文件名数组
        } else {
            // 如果 API 返回格式不正确
            console.warn(`Sequence Manager: API (${url}) 返回的数据格式不正确:`, data);
            throw new Error(`服务器未能正确返回 '${folderName}' 的文件列表。`);
        }
    } catch (error) {
        console.error(`Sequence Manager: 获取文件夹 "${folderName}" 内容失败:`, error);
        // 抛出错误，让调用者处理 UI 反馈
        throw new Error(`无法获取文件夹 '${folderName}' 的文件列表: ${error.message}`);
    }
}

/**
 * 处理开始分析文件夹序号的按钮点击事件。
 */
async function analyzeSequences() {
    // 检查必要的 DOM 元素
    const requiredDOMElements = [
        DOM.sequenceAnalyzeButton, DOM.sequenceStatusArea,
        DOM.sequenceIssuesList, DOM.sequenceFixButton
    ];
    if (requiredDOMElements.some(el => !el)) {
        console.error("Sequence Manager: 缺少必要的界面元素，无法开始分析。");
        displayToast("无法开始分析：界面元素缺失", UI_CLASSES.ERROR);
        return;
    }

    // 防止重复执行
    if (AppState.sequenceManager.isRunning) {
        displayToast("正在分析中，请稍候...", UI_CLASSES.INFO);
        return;
    }

    // --- 初始化状态和 UI ---
    AppState.sequenceManager.isRunning = true;
    sequenceFixPlanInternal = []; // 清空旧的修复计划
    sequenceAnalysisResultsText = []; // 清空旧的结果文本

    DOM.sequenceAnalyzeButton.disabled = true; // 禁用分析按钮
    DOM.sequenceFixButton.disabled = true; // 禁用修复按钮
    DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED);
    DOM.sequenceFixButton.textContent = `一键修复`; // 重置修复按钮文本
    DOM.sequenceStatusArea.innerHTML = '<p>正在获取文件夹列表...</p>'; // 更新状态显示
    DOM.sequenceIssuesList.value = ''; // 清空问题列表

    displayToast("开始分析文件序号...", UI_CLASSES.INFO, 2000);

    try {
        // 1. 获取角色文件夹列表
        let characterFolders = AppState.importer.characterFoldersList || [];
        // 如果列表为空，尝试从后端获取 (fetchCharacterFolders 应在 Core.js)
        if (characterFolders.length === 0 && typeof fetchCharacterFolders === 'function') {
            console.log("Sequence Manager: 角色文件夹列表为空，尝试重新获取...");
            await fetchCharacterFolders();
            characterFolders = AppState.importer.characterFoldersList; // 重新获取状态
            if (characterFolders.length === 0) {
                throw new Error("未能成功获取角色文件夹列表。");
            }
        } else if (characterFolders.length === 0) {
            throw new Error("角色文件夹列表为空，且无法获取。");
        }

        const totalFolders = characterFolders.length;
        DOM.sequenceStatusArea.innerHTML = `<p>获取到 ${totalFolders} 个文件夹，开始检查...</p>`;

        let problematicFoldersCount = 0; // 有问题的文件夹计数
        const issuesLog = []; // 存储发现的问题日志文本
        // 正则表达式，用于匹配 "文件夹名Gu数字.后缀" (更精确)
        // 注意：这个正则现在只匹配数字部分，不强制要求前缀等于文件夹名
        const sequenceRegex = /Gu(\d+)\.(webp|jpg|jpeg|png|gif)$/i;

        // 2. 遍历每个文件夹进行分析
        for (let i = 0; i < totalFolders; i++) {
            const folderName = characterFolders[i];
            DOM.sequenceStatusArea.innerHTML = `<p>检查 (${i + 1}/${totalFolders}): ${folderName}</p>`;

            let filesInFolder = [];
            try {
                // 获取当前文件夹的文件列表
                filesInFolder = await getFilesForSequenceAnalysis(folderName);
            } catch (fetchError) {
                // 获取文件列表失败
                issuesLog.push(`文件夹: ${folderName}`);
                issuesLog.push(`  - 错误: 无法获取文件列表 (${fetchError.message})`);
                issuesLog.push('');
                problematicFoldersCount++;
                console.error(`Sequence Manager: 获取 ${folderName} 文件列表时出错，跳过分析。`);
                continue; // 继续下一个文件夹
            }

            // 提取符合命名规则的文件和序号
            const sequencedFiles = []; // 存储 { num: number, filename: string }
            const sequenceNumberMap = new Map(); // 存储 { number: [filename1, filename2...] } 用于检测重复

            for (const filename of filesInFolder) {
                const match = filename.match(sequenceRegex);
                if (match && match[1]) { // 确保捕获到数字部分
                    const sequenceNumber = parseInt(match[1], 10);
                    if (!isNaN(sequenceNumber)) {
                        sequencedFiles.push({ num: sequenceNumber, filename: filename });
                        // 记录序号对应的文件名
                        if (!sequenceNumberMap.has(sequenceNumber)) {
                            sequenceNumberMap.set(sequenceNumber, []);
                        }
                        sequenceNumberMap.get(sequenceNumber).push(filename);
                    }
                }
            }

            // 如果文件夹内没有符合规则的文件，跳过分析
            if (sequencedFiles.length === 0) {
                console.debug(`Sequence Manager: 文件夹 "${folderName}" 中没有找到符合 Gu[数字] 命名规则的文件。`);
                continue;
            }

            // --- 开始分析序号问题 ---
            const folderIssues = []; // 存储当前文件夹的问题描述
            // 按序号排序
            sequencedFiles.sort((a, b) => a.num - b.num);

            let needsFixing = false; // 标记当前文件夹是否需要修复

            // 检查重复序号
            sequenceNumberMap.forEach((filenames, num) => {
                if (filenames.length > 1) {
                    folderIssues.push(`  - 问题: 序号 ${num} 重复 (文件: ${filenames.join(', ')})`);
                    needsFixing = true;
                }
            });

            // 检查是否从 1 开始
            if (sequencedFiles[0].num !== 1) {
                folderIssues.push(`  - 问题: 序号不从 1 开始 (最小序号: ${sequencedFiles[0].num} - 文件: ${sequencedFiles[0].filename})`);
                needsFixing = true;
            }

            // 检查是否连续
            for (let j = 0; j < sequencedFiles.length - 1; j++) {
                const currentNum = sequencedFiles[j].num;
                const nextNum = sequencedFiles[j + 1].num;
                // 只有在当前序号不重复的情况下才检查不连续问题
                if (sequenceNumberMap.get(currentNum)?.length === 1 && nextNum !== currentNum + 1) {
                    folderIssues.push(`  - 问题: 序号不连续，${currentNum} (${sequencedFiles[j].filename}) 后面是 ${nextNum} (${sequencedFiles[j+1].filename})`);
                    needsFixing = true;
                }
            }

            // 如果当前文件夹有问题
            if (folderIssues.length > 0) {
                problematicFoldersCount++;
                issuesLog.push(`文件夹: ${folderName}`);
                issuesLog.push(...folderIssues);
                // 添加文件列表供参考
                issuesLog.push(`--- 文件列表 (${sequencedFiles.length}) ---`);
                sequencedFiles.forEach(f => issuesLog.push(`  ${f.filename}`));
                issuesLog.push(''); // 添加空行分隔

                // 如果需要修复，生成修复计划
                if (needsFixing) {
                    const filesToRenamePlan = [];
                    let newSequenceNum = 1;
                    // 按原始文件名排序以确定重命名顺序（更稳定）
                    const sortedByFilename = [...sequencedFiles].sort((a, b) =>
                        a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
                    );

                    sortedByFilename.forEach(fileInfo => {
                        // 提取原始后缀名
                        const extMatch = fileInfo.filename.match(/\.[^.]+$/);
                        const extension = extMatch ? extMatch[0] : '.webp'; // 默认 .webp
                        // 构建新的文件名
                        const newFilename = `${folderName}Gu${newSequenceNum}${extension}`;
                        // 只有当新旧文件名不同时才添加到计划中
                        if (newFilename !== fileInfo.filename) {
                            filesToRenamePlan.push({
                                currentFilename: fileInfo.filename,
                                newFilename: newFilename
                            });
                        }
                        newSequenceNum++; // 序号递增
                    });

                    // 如果有需要重命名的文件，添加到总修复计划
                    if (filesToRenamePlan.length > 0) {
                        sequenceFixPlanInternal.push({
                            folderName: folderName, // 只需文件夹名，后端会查找路径
                            filesToRename: filesToRenamePlan
                        });
                        console.log(`Sequence Manager: 为文件夹 "${folderName}" 生成了 ${filesToRenamePlan.length} 项修复计划。`);
                    }
                }
            }

            // 短暂延迟，避免 UI 卡顿
            await new Promise(resolve => setTimeout(resolve, 5));

        } // 文件夹遍历结束

        // 3. 显示分析结果
        sequenceAnalysisResultsText = issuesLog; // 保存结果文本
        DOM.sequenceIssuesList.value = issuesLog.join('\n'); // 显示在 Textarea
        DOM.sequenceStatusArea.innerHTML = `<p>完成 ${totalFolders} 个文件夹的分析。</p>`;

        // 根据结果更新 Toast 和修复按钮状态
        if (problematicFoldersCount > 0 && sequenceFixPlanInternal.length > 0) {
            displayToast(`分析完成，${problematicFoldersCount} 个文件夹存在序号问题，已生成修复计划。`, UI_CLASSES.WARNING);
            DOM.sequenceFixButton.disabled = false;
            DOM.sequenceFixButton.classList.remove(UI_CLASSES.DISABLED);
            DOM.sequenceFixButton.textContent = `一键修复 (${sequenceFixPlanInternal.length} 个文件夹)`;
        } else if (problematicFoldersCount > 0 && sequenceFixPlanInternal.length === 0) {
            displayToast(`分析完成，${problematicFoldersCount} 个文件夹存在序号问题，但无法自动生成修复计划 (可能主要是重复序号问题?)。`, UI_CLASSES.WARNING);
            // 无法自动修复，保持按钮禁用
            DOM.sequenceFixButton.textContent = `一键修复`;
        } else {
            displayToast("分析完成，未发现文件序号问题！", UI_CLASSES.SUCCESS);
            DOM.sequenceFixButton.textContent = `一键修复`;
        }

    } catch (error) { // 捕获分析过程中的其他错误
        console.error("Sequence Manager: 分析过程中发生错误:", error);
        displayToast(`分析失败: ${error.message}`, UI_CLASSES.ERROR);
        DOM.sequenceStatusArea.innerHTML = '<p>分析过程中出错!</p>';
    } finally {
        // --- 无论成功或失败，最终都要执行 ---
        AppState.sequenceManager.isRunning = false; // 标记运行结束
        DOM.sequenceAnalyzeButton.disabled = false; // 恢复分析按钮
    }
}

/**
 * 处理修复文件序号问题的按钮点击事件。
 */
async function fixSequenceIssues() {
    // 检查按钮是否可用以及是否有修复计划
    if (!DOM.sequenceFixButton || DOM.sequenceFixButton.disabled) return;
    if (sequenceFixPlanInternal.length === 0) {
        displayToast("当前没有可执行的修复计划。", UI_CLASSES.INFO);
        return;
    }

    // 确认操作 (高风险警告)
    const confirmed = confirm(
        `警告：即将对 ${sequenceFixPlanInternal.length} 个文件夹中的文件进行批量重命名以修复序号！\n` +
        `此操作具有较高风险且【不可逆】！强烈建议在执行前备份相关文件夹！\n\n` +
        `确定要执行修复吗？`
    );

    if (!confirmed) {
        displayToast("序号修复操作已取消。", UI_CLASSES.INFO);
        return;
    }

    // --- 开始修复 ---
    console.log(`Sequence Manager: 开始执行 ${sequenceFixPlanInternal.length} 个文件夹的修复计划...`);
    // 禁用修复和分析按钮
    DOM.sequenceFixButton.disabled = true;
    DOM.sequenceFixButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.sequenceAnalyzeButton) DOM.sequenceAnalyzeButton.disabled = true; // 防止在修复时开始新的分析
    displayToast("正在发送修复请求...", UI_CLASSES.INFO);
    if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = `<p>正在修复 ${sequenceFixPlanInternal.length} 个文件夹中...</p>`;

    try {
        // 调用后端 API 执行重命名操作
        // 使用 Core.js 的 fetchJsonData
        const response = await fetchJsonData(API_ENDPOINTS.RENAME_SEQUENCE_FILES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixPlan: sequenceFixPlanInternal }) // 发送修复计划
        });

        // 检查后端返回结果
        if (response?.success) {
            const processedFolders = response.processedFolders || '?';
            const renamedFiles = response.renamedFiles || '?';
            displayToast(`序号修复成功！处理了 ${processedFolders} 个文件夹，重命名了 ${renamedFiles} 个文件。`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);

            // 清理 UI 和状态
            if (DOM.sequenceIssuesList) DOM.sequenceIssuesList.value = ''; // 清空问题列表
            sequenceFixPlanInternal = []; // 清空修复计划
            sequenceAnalysisResultsText = []; // 清空结果文本
            if (DOM.sequenceFixButton) DOM.sequenceFixButton.textContent = `一键修复`; // 重置按钮文本
            if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = '<p>修复完成。</p>'; // 更新状态

            displayToast("建议重新进行序号分析以确认结果。", UI_CLASSES.INFO, 4000);
        } else {
            // 后端返回失败
            throw new Error(response?.error || "后端未能成功执行修复操作。");
        }
    } catch (error) {
        console.error("Sequence Manager: 序号修复失败:", error);
        displayToast(`序号修复失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        // 修复失败，允许用户重试
        DOM.sequenceFixButton.disabled = false;
        DOM.sequenceFixButton.classList.remove(UI_CLASSES.DISABLED);
        if (DOM.sequenceStatusArea) DOM.sequenceStatusArea.innerHTML = '<p>修复失败!</p>';
    } finally {
        // 无论成功或失败，最终都恢复分析按钮
        if (DOM.sequenceAnalyzeButton) DOM.sequenceAnalyzeButton.disabled = false;
    }
}


// --------------------------------------------------------------------------
// 事件监听器设置 (Sequence Manager Specific)
// --------------------------------------------------------------------------
/**
 * 设置序号管理视图内的事件监听器。
 */
function setupSequenceManagerEventListeners() {
    // 开始分析按钮
    if (DOM.sequenceAnalyzeButton) {
        DOM.sequenceAnalyzeButton.removeEventListener('click', analyzeSequences);
        DOM.sequenceAnalyzeButton.addEventListener('click', analyzeSequences);
    } else { console.error("Sequence Manager: 分析按钮 (analyzeSequences) 未找到。"); }

    // 一键修复按钮
    if (DOM.sequenceFixButton) {
        DOM.sequenceFixButton.removeEventListener('click', fixSequenceIssues);
        DOM.sequenceFixButton.addEventListener('click', fixSequenceIssues);
    } else { console.error("Sequence Manager: 修复按钮 (fixSequenceIssues) 未找到。"); }

    console.log("Sequence Manager: 事件监听器设置完成。");
}

