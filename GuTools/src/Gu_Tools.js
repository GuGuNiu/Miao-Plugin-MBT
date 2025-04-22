// ==========================================================================
//  实现 "咕咕牛工具" 页面的功能，包括 JSON 生成器、图片入库、MD5校准、序号管理、JSON校准。
//       同时包含与后台搜索 Web Worker 的交互逻辑。
// ==========================================================================

// --- 全局变量 (MD5 & Sequence & JSON Calibration 相关) ---
let mismatchDataForFixing = []; // 用于存储 MD5 不一致的详细信息 { path, expected, actual }
let filesNotInJsonData = []; // 用于存储文件存在但 JSON 无记录的文件路径
let sequenceAnalysisResults = []; // 用于存储序号分析的问题结果文本
let sequenceFixPlan = []; // 用于存储序号修复计划 { folderName: "...", filesToRename: [{ current: "...", new: "..." }] }
let jsonMissingEntries = []; // 用于存储 JSON 中存在但文件缺失的完整条目
let jsonCalibrationMissingPaths = []; // 仅存储缺失文件的路径，用于显示

// --------------------------------------------------------------------------
// GuTools 模式切换 & UI 更新
// --------------------------------------------------------------------------

/**
 * 填充左侧 JSON MD5 记录列表。
 */
function populateJsonMd5List() {
    if (!DOM.jsonMd5ListContainer || !DOM.jsonTotalEntriesDisplay) {
        console.warn("MD5 校准: 无法填充列表，缺少 DOM 元素 (jsonMd5ListContainer 或 jsonTotalEntriesDisplay)。");
        return;
    }

    DOM.jsonMd5ListContainer.innerHTML = ''; // 清空旧列表
    const entries = AppState.savedEntries || [];
    DOM.jsonTotalEntriesDisplay.textContent = entries.length.toString(); // 更新总数

    if (entries.length === 0) {
        DOM.jsonMd5ListContainer.innerHTML = '<p class="list-placeholder">JSON 数据为空。</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    entries.sort((a, b) => (a.path || '').localeCompare(b.path || ''));

    entries.forEach(entry => {
        if (entry && entry.path && entry.attributes) {
            const listItem = document.createElement('div');
            listItem.className = 'json-md5-item';
            listItem.dataset.path = entry.path;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            let displayName = entry.attributes.filename || entry.path.split('/').pop();

            const lastDotIndex = displayName.lastIndexOf('.');
            if (lastDotIndex > 0) { 
                displayName = displayName.substring(0, lastDotIndex); 
            }
            nameSpan.textContent = displayName; 
            nameSpan.title = entry.path; 

            const md5Span = document.createElement('span');
            md5Span.className = 'item-md5';
            md5Span.textContent = entry.attributes.md5 || 'N/A';
            md5Span.title = entry.attributes.md5 || '无记录';

            listItem.appendChild(nameSpan);
            listItem.appendChild(md5Span);
            fragment.appendChild(listItem);
        }
    });
    DOM.jsonMd5ListContainer.appendChild(fragment);
    console.log(`MD5 校准: 左侧 JSON 列表已填充 ${entries.length} 条记录。`);
}

/**
 * 切换 GuTools 面板的视图模式。
 * @param {'generator' | 'import' | 'md5' | 'sequence' | 'json_calibration'} targetMode - 目标模式。
 */
function switchGuToolMode(targetMode) {
    const views = {
        generator: DOM.generatorPaneView,
        import: DOM.importPaneView,
        md5: DOM.md5PaneView,
        sequence: DOM.sequencePaneView,
        json_calibration: DOM.jsonCalibrationPaneView // 添加新视图
    };

    if (!views[targetMode]) {
        console.error(`Gu工具: 尝试切换到无效模式或视图元素缺失: ${targetMode}`);
        return;
    }
    if (targetMode === AppState.currentGuToolMode && views[targetMode] && !views[targetMode].classList.contains(CLASS_NAMES.HIDDEN)) {
        console.debug(`Gu工具: 模式已经是 ${targetMode} 且可见。`);
        return;
    }

    console.log(`Gu工具: 正在切换模式到: ${targetMode}`);

    // --- 中止正在进行的操作 ---
    if (AppState.isCalibrationRunning && targetMode !== 'md5') {
        console.log(`Gu工具: 切换，中止 MD5 校准...`);
        AppState.isCalibrationAborted = true; // 设置中止标志会停止循环
    }
    if (AppState.isSequenceAnalysisRunning && targetMode !== 'sequence') {
        console.log(`Gu工具: 切换，中止序号分析... (如果需要，实现中止逻辑)`);
        // AppState.isSequenceAnalysisAborted = true; // 如果需要中止序号分析
    }
    if (AppState.isJsonCalibrationRunning && targetMode !== 'json_calibration') {
        console.log(`Gu工具: 切换，中止 JSON 校准... (如果需要，实现中止逻辑)`);
        AppState.isJsonCalibrationRunning = false; // 简单标记停止
    }
    // ------------------------------------------

    AppState.currentGuToolMode = targetMode;

    Object.values(views).forEach(view => {
        if (view) view.classList.add(CLASS_NAMES.HIDDEN);
    });

    views[targetMode].classList.remove(CLASS_NAMES.HIDDEN);

    if (DOM.guToolsModeButtonGroups) {
        DOM.guToolsModeButtonGroups.forEach(buttonGroup => {
            const buttons = buttonGroup.querySelectorAll('.mode-button[data-mode]');
            buttons.forEach(button => {
                button.classList.toggle(CLASS_NAMES.ACTIVE, button.dataset.mode === targetMode);
            });
        });
    } else {
        console.warn("Gu工具: 未找到模式按钮组。");
    }

    // --- 特定模式加载/重置逻辑 ---
    switch (targetMode) {
        case 'generator':
            hideImportMessage();
            // 清理 MD5/Sequence/JSON Calibration 可能留下的消息或状态？
            break;
        case 'import':
            hideMessage();
            // 确保 Import 功能所需的函数都存在
            if (typeof loadImportDataIfNeeded === 'function') {
                if (!AppState.guToolsImportDataLoaded) {
                    loadImportDataIfNeeded();
                } else {
                    if (typeof updateImportInputPlaceholders === 'function') updateImportInputPlaceholders();
                    else console.warn("switchGuToolMode (import): updateImportInputPlaceholders 未定义。");
                }
            } else { console.error("错误: loadImportDataIfNeeded 未定义！"); displayImportMessage("错误：无法加载入库数据", CLASS_NAMES.ERROR); }
            break;
        case 'md5':
            hideMessage(); hideImportMessage();
            if (!AppState.isCalibrationRunning) { // 只有在校准未运行时才重置
                console.log("Gu工具: 进入 MD5 模式 (校准未运行)，重置 UI。");
                populateJsonMd5List();
                if(DOM.mismatchedMD5List) DOM.mismatchedMD5List.value = '';
                if(DOM.filesNotInJsonList) DOM.filesNotInJsonList.value = '';
                if(DOM.mismatchedMD5Count) DOM.mismatchedMD5Count.textContent = '0';
                if(DOM.mismatchedCountDisplay) DOM.mismatchedCountDisplay.textContent = '0';
                if(DOM.filesNotInJsonCount) DOM.filesNotInJsonCount.textContent = '0';
                if(DOM.md5CalibrationProgress) DOM.md5CalibrationProgress.textContent = '';
                if(DOM.md5CalibrationProgressBar) { DOM.md5CalibrationProgressBar.style.display = 'none'; DOM.md5CalibrationProgressBar.value = 0; }
                if(DOM.filesCheckedCount) DOM.filesCheckedCount.textContent = '0';
                if(DOM.totalFilesChecked) DOM.totalFilesChecked.textContent = '--';
                if(DOM.totalMD5Count) DOM.totalMD5Count.textContent = AppState.savedEntries.length.toString();
                if(DOM.fixAllMismatchedMD5) { DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); }
                if(DOM.abortMD5Calibration) DOM.abortMD5Calibration.disabled = true;
            } else { console.log("Gu工具: 切回 MD5 (运行中)。"); populateJsonMd5List(); } // 只更新列表
            break;
        case 'sequence':
            hideMessage(); hideImportMessage();
            if (!AppState.isSequenceAnalysisRunning) { // 只有在分析未运行时才重置
                console.log("Gu工具: 进入 Sequence 模式 (分析未运行)，重置 UI。");
                if(DOM.sequenceAnalysisStatus) DOM.sequenceAnalysisStatus.innerHTML = '<p>点击按钮开始扫描...</p>';
                if(DOM.sequenceIssuesList) DOM.sequenceIssuesList.value = '';
                if(DOM.fixSequenceIssues) { DOM.fixSequenceIssues.disabled = true; DOM.fixSequenceIssues.classList.add('disabled'); DOM.fixSequenceIssues.textContent = `一键修复`;}
            } else { console.log("Gu工具: 切回 Sequence (运行中)。"); }
            if (AppState.characterFoldersList.length === 0 && typeof fetchCharacterFolders === 'function') {
                 console.log("Gu工具: Sequence, 加载文件夹..."); fetchCharacterFolders();
            } else if (AppState.characterFoldersList.length === 0) { console.warn("序号管理: fetchCharacterFolders 未定义。"); }
            break;
        case 'json_calibration':
            hideMessage(); hideImportMessage();
            if (!AppState.isJsonCalibrationRunning) {
                 console.log("Gu工具: 进入 JSON 校准模式，重置 UI。");
                 if(DOM.jsonEntriesCheckedCount) DOM.jsonEntriesCheckedCount.textContent = '0';
                 if(DOM.jsonFilesCheckedCount) DOM.jsonFilesCheckedCount.textContent = '--';
                 if(DOM.missingFilesCount) DOM.missingFilesCount.textContent = '0';
                 if(DOM.missingFilesCountDisplay) DOM.missingFilesCountDisplay.textContent = '0';
                 if(DOM.jsonCalibrationProgress) DOM.jsonCalibrationProgress.textContent = '';
                 if(DOM.jsonCalibrationProgressBar) { DOM.jsonCalibrationProgressBar.style.display = 'none'; DOM.jsonCalibrationProgressBar.value = 0; }
                 if(DOM.missingFilesList) DOM.missingFilesList.value = '';
                 if(DOM.removeMissingEntriesBtn) { DOM.removeMissingEntriesBtn.disabled = true; DOM.removeMissingEntriesBtn.classList.add('disabled'); }
                 if(DOM.startJsonCalibration) DOM.startJsonCalibration.disabled = false;
            } else { console.log("Gu工具: 切回 JSON 校准 (可能运行中)。"); }
            break;
        default: console.warn(`Gu工具: 未知模式: ${targetMode}`);
    }
}

/**
 * 设置 GuTools 内部模式切换按钮的事件监听器。
 */
function setupGuToolsModeSwitcher() {
    const modeButtons = document.querySelectorAll('#GuTools .mode-button[data-mode]');
    if (!modeButtons || modeButtons.length === 0) { console.error("Gu工具: 未找到模式切换按钮。"); return; }
    const handleModeButtonClick = (event) => { const targetMode = event.currentTarget.dataset.mode; if (targetMode) switchGuToolMode(targetMode); };
    modeButtons.forEach(button => { button.removeEventListener('click', handleModeButtonClick); button.addEventListener('click', handleModeButtonClick); });
    console.log(`Gu工具: 为 ${modeButtons.length} 个模式按钮设置了监听器。`);
}

// --------------------------------------------------------------------------
// JSON 生成器 (Generator) 功能 (来自你的回滚版本)
// --------------------------------------------------------------------------
function clearGeneratorUI() { console.debug("Generator: 清空 UI..."); AppState.isSettingInputProgrammatically = true; if (DOM.searchInput) DOM.searchInput.value = ''; clearFileInfoDisplay(); if (DOM.suggestionList) DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.showingRelatedImages = false; AppState.isShowingFolderSuggestions = false; AppState.currentSelection = null; AppState.currentGeneratedId = null; AppState.currentCalculatedMd5 = null; hideMessage(); setTimeout(() => { AppState.isSettingInputProgrammatically = false; }, 50); }
function clearFileInfoDisplay() { if (DOM.previewImage) { DOM.previewImage.classList.remove(CLASS_NAMES.FADE_IN); DOM.previewImage.classList.add(CLASS_NAMES.FADE_OUT); setTimeout(() => { if (DOM.previewImage) { DOM.previewImage.src = ""; DOM.previewImage.alt = "选择图片"; DOM.previewImage.classList.add(CLASS_NAMES.HIDDEN); DOM.previewImage.style.display = 'none'; DOM.previewImage.classList.remove(CLASS_NAMES.FADE_OUT); } }, 300); } if (DOM.saveButton) DOM.saveButton.disabled = true; const dR = document.querySelector('input[name="rating"][value="none"]'); const dL = document.querySelector('input[name="layout"][value="normal"]'); if(dR) dR.checked = true; if(dL) dL.checked = true; if (DOM.isEasterEggCheckbox) DOM.isEasterEggCheckbox.checked = false; if (DOM.isAiImageCheckbox) DOM.isAiImageCheckbox.checked = false; if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = ''; DOM.md5DisplayInput.placeholder = '...'; } if (DOM.idDisplayInput) { DOM.idDisplayInput.value = ''; DOM.idDisplayInput.placeholder = '...'; } updateGameTagsHighlight(''); }
function updateGameTagsHighlight(galleryCode) { if (!DOM.gameTags || Object.values(DOM.gameTags).some(t => !t)) return; Object.values(DOM.gameTags).forEach(t => t.classList.remove(CLASS_NAMES.ACTIVE, 'gs', 'sr', 'zzz', 'waves')); let aK = null; switch (galleryCode) { case 'gs-character': aK = 'gs'; break; case 'sr-character': aK = 'sr'; break; case 'zzz-character': aK = 'zzz'; break; case 'waves-character': aK = 'waves'; break; } if (aK && DOM.gameTags[aK]) { DOM.gameTags[aK].classList.add(CLASS_NAMES.ACTIVE, aK); } }
async function fetchImageMd5(imagePath) { if (!imagePath) { console.warn("fetchImageMd5: path为空。"); return null; } const url = `${API_ENDPOINTS.IMAGE_MD5}?path=${encodeURIComponent(imagePath)}`; try { const result = await fetchJsonData(url); if (result?.success === true && typeof result.md5 === 'string') { return result.md5; } else { throw new Error(result?.error || 'MD5计算/返回失败'); } } catch (error) { console.error(`获取 ${imagePath} MD5 出错:`, error); return null; } }
function updateSaveButtonState() { if (!DOM.saveButton) return; let sE = false; if (AppState.currentSelection?.urlPath) { const iAS = AppState.savedImagePaths.has(AppState.currentSelection.urlPath); const iIR = !!AppState.currentGeneratedId && AppState.currentGeneratedId !== '生成中...'; const iMR = !!AppState.currentCalculatedMd5 && AppState.currentCalculatedMd5 !== '计算中...' && AppState.currentCalculatedMd5 !== '计算失败'; const iIL = DOM.previewImage && !DOM.previewImage.classList.contains(CLASS_NAMES.HIDDEN) && DOM.previewImage.src !== '' && !DOM.previewImage.alt.includes('失败') && !DOM.previewImage.alt.includes('加载中'); sE = !iAS && iIR && iMR && iIL; } DOM.saveButton.disabled = !sE; }
async function displaySelectedImage(imgInfo) { if (!imgInfo?.urlPath) { console.error("Generator: 无效 imgInfo:", imgInfo); displayMessage("错误：图片信息无效", CLASS_NAMES.ERROR, DELAYS.MESSAGE_CLEAR); clearGeneratorUI(); return; } console.log("Generator: 显示图片:", imgInfo.fileName); AppState.currentSelection = { ...imgInfo }; hideMessage(); if (DOM.suggestionList) DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.showingRelatedImages = false; AppState.isSettingInputProgrammatically = true; if (DOM.searchInput) DOM.searchInput.value = `${imgInfo.name || '?'} (${imgInfo.fileName})`; setTimeout(() => { AppState.isSettingInputProgrammatically = false; }, 50); updateGameTagsHighlight(imgInfo.gallery); const dR = document.querySelector('input[name="rating"][value="none"]'); const dL = document.querySelector('input[name="layout"][value="normal"]'); if(dR) dR.checked = true; if(dL) dL.checked = true; if (DOM.isEasterEggCheckbox) DOM.isEasterEggCheckbox.checked = false; if (DOM.isAiImageCheckbox) DOM.isAiImageCheckbox.checked = false; if (DOM.saveButton) DOM.saveButton.disabled = true; if (DOM.idDisplayInput) { DOM.idDisplayInput.value = ''; DOM.idDisplayInput.placeholder = '...'; } if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = ''; DOM.md5DisplayInput.placeholder = '...'; } AppState.currentGeneratedId = null; AppState.currentCalculatedMd5 = null; const existingEntry = AppState.savedEntries.find(e => e.path === imgInfo.urlPath); if (existingEntry?.attributes) { console.log("Generator: 已存在:", existingEntry.gid); displayMessage(`提示："${imgInfo.fileName}" 已在 JSON 中。`, CLASS_NAMES.INFO); const a = existingEntry.attributes; const g = existingEntry.gid; if (DOM.idDisplayInput) { DOM.idDisplayInput.value = g || 'N/A'; DOM.idDisplayInput.placeholder = 'GID'; } if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = a.md5 || 'N/A'; DOM.md5DisplayInput.placeholder = 'MD5'; } AppState.currentGeneratedId = g || null; AppState.currentCalculatedMd5 = a.md5 || null; let rV = 'none'; if (a.isPx18) rV = 'px18'; else if (a.isRx18) rV = 'rx18'; const rR = document.querySelector(`input[name="rating"][value="${rV}"]`); if (rR) rR.checked = true; const lV = a.layout || 'normal'; const lR = document.querySelector(`input[name="layout"][value="${lV}"]`); if (lR) lR.checked = true; if (DOM.isEasterEggCheckbox) DOM.isEasterEggCheckbox.checked = !!a.isEasterEgg; if (DOM.isAiImageCheckbox) DOM.isAiImageCheckbox.checked = !!a.isAiImage; if (DOM.saveButton) DOM.saveButton.disabled = true; } else { console.log("Generator: 新图片..."); if (DOM.idDisplayInput) DOM.idDisplayInput.placeholder = '生成中...'; if (DOM.md5DisplayInput) DOM.md5DisplayInput.placeholder = '计算中...'; AppState.currentGeneratedId = generateNumericId(); if (DOM.idDisplayInput) { DOM.idDisplayInput.value = AppState.currentGeneratedId; DOM.idDisplayInput.placeholder = 'GID'; } fetchImageMd5(imgInfo.urlPath).then(m => { if (m) { AppState.currentCalculatedMd5 = m; if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = m; DOM.md5DisplayInput.placeholder = 'MD5'; } } else { AppState.currentCalculatedMd5 = '计算失败'; if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = '失败'; DOM.md5DisplayInput.placeholder = '错误'; } } updateSaveButtonState(); }).catch(e => { console.error("Generator: fetchMd5 错误:", e); AppState.currentCalculatedMd5 = '计算失败'; if (DOM.md5DisplayInput) { DOM.md5DisplayInput.value = '失败'; DOM.md5DisplayInput.placeholder = '错误'; } updateSaveButtonState(); }); } const imgP = imgInfo.urlPath.startsWith('/') ? imgInfo.urlPath : `/${imgInfo.urlPath}`; if (DOM.previewImage) { DOM.previewImage.src = ""; DOM.previewImage.alt = "加载中..."; DOM.previewImage.classList.add(CLASS_NAMES.HIDDEN, CLASS_NAMES.FADE_OUT); DOM.previewImage.style.display = 'none'; DOM.previewImage.onerror = () => { console.error("Generator: 预览失败:", imgP); displayMessage(`错误：加载预览 (${imgInfo.fileName})`, CLASS_NAMES.ERROR); DOM.previewImage.classList.add(CLASS_NAMES.HIDDEN); DOM.previewImage.style.display = 'none'; DOM.previewImage.alt = "失败"; if (DOM.saveButton) DOM.saveButton.disabled = true; }; DOM.previewImage.onload = () => { console.log("Generator: 预览成功:", imgP); DOM.previewImage.alt = imgInfo.name || 'Selected'; DOM.previewImage.classList.remove(CLASS_NAMES.HIDDEN, CLASS_NAMES.FADE_OUT); DOM.previewImage.style.display = 'block'; DOM.previewImage.classList.add(CLASS_NAMES.FADE_IN); updateSaveButtonState(); setTimeout(() => DOM.previewImage?.classList.remove(CLASS_NAMES.FADE_IN), 300); }; DOM.previewImage.src = imgP; } }
async function saveEntry() { if (DOM.saveButton) DOM.saveButton.disabled = true; if (AppState.writingTimerId) clearInterval(AppState.writingTimerId); AppState.writingTimerId = null; AppState.writingStartTime = null; if (AppState.successTimerId) clearInterval(AppState.successTimerId); AppState.successTimerId = null; AppState.successStartTime = null; if (!AppState.currentSelection || !DOM.md5DisplayInput || !DOM.idDisplayInput) { displayMessage('错误：未选图或信息缺失', CLASS_NAMES.ERROR, DELAYS.MESSAGE_CLEAR); return; } const cFN = AppState.currentSelection.fileName || '未知'; const rI = document.querySelector('input[name="rating"]:checked'); const lI = document.querySelector('input[name="layout"]:checked'); const iEE = DOM.isEasterEggCheckbox?.checked ?? false; const iAI = DOM.isAiImageCheckbox?.checked ?? false; const md5V = DOM.md5DisplayInput.value; const gidV = DOM.idDisplayInput.value; const relP = AppState.currentSelection.urlPath; if (AppState.savedImagePaths.has(relP)) { displayMessage(`错误："${cFN}" 已存在`, CLASS_NAMES.ERROR); findAndDisplayNextUnsavedImage(AppState.currentSelection); return; } if (!gidV || gidV === 'N/A' || gidV === '生成中...') { displayMessage("错误：无效 GID", CLASS_NAMES.ERROR, DELAYS.MESSAGE_CLEAR); return; } if (!md5V || md5V === '计算失败' || md5V === '计算中...') { displayMessage("错误：无效 MD5", CLASS_NAMES.ERROR, DELAYS.MESSAGE_CLEAR); return; } const nE = { gid: gidV, characterName: AppState.currentSelection.name || 'Unknown', path: relP, attributes: { filename: cFN, parentFolder: AppState.currentSelection.folderName, isPx18: rI?.value === 'px18', isRx18: rI?.value === 'rx18', layout: lI?.value || 'normal', isEasterEgg: iEE, isAiImage: iAI, isBan: false, md5: md5V, Downloaded_From: 'none' }, timestamp: new Date().toISOString(), sourceGallery: AppState.currentSelection.gallery }; console.log("Generator: 准备保存:", nE); const uD = [...AppState.savedEntries, nE]; const bWM = `写入中：${cFN}`; displayMessage(bWM, CLASS_NAMES.INFO, null); AppState.writingStartTime = Date.now(); AppState.writingTimerId = setInterval(() => { if (!AppState.writingStartTime || !DOM.messageArea?.classList.contains(CLASS_NAMES.INFO)) { clearInterval(AppState.writingTimerId); AppState.writingTimerId = null; AppState.writingStartTime = null; return; } const eS = ((Date.now() - AppState.writingStartTime) / 1000).toFixed(1); if (DOM.messageArea) DOM.messageArea.textContent = `${bWM} (${eS}s)`; }, 100); let success = false; const sOST = Date.now(); try { if (typeof updateUserData !== 'function') throw new Error("updateUserData 未定义！"); success = await updateUserData(uD, `成功添加 "${cFN}"`, 'messageArea', false); } catch (error) { console.error("Generator: 保存出错:", error); displayMessage(`保存出错: ${error.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); success = false; } finally { if (AppState.writingTimerId) { clearInterval(AppState.writingTimerId); AppState.writingTimerId = null; AppState.writingStartTime = null; } if (success) { const sD = ((Date.now() - sOST) / 1000).toFixed(1); displayMessage(`成功添加 "${cFN}" (${sD}s)`, CLASS_NAMES.SUCCESS, DELAYS.MESSAGE_CLEAR); } else { console.log("Generator: 保存失败或错误已处理。"); } clearTimeout(AppState.messageClearTimer); AppState.messageClearTimer = null; setTimeout(() => { console.debug("Generator: 查找下一个..."); hideMessage(); findAndDisplayNextUnsavedImage(AppState.currentSelection); }, success ? DELAYS.NEXT_IMAGE_DISPLAY : 500); } }
function findAndDisplayNextUnsavedImage(lastSavedImageInfo) { if (!lastSavedImageInfo?.folderName || !lastSavedImageInfo?.urlPath) { console.warn("Generator: findNext无效参数。"); clearGeneratorUI(); return; } const cF = lastSavedImageInfo.folderName; console.log(`Generator: 在 "${cF}" 查找下一个...`); const iIF = (AppState.allGalleryImages || []).filter(i => i?.folderName === cF).sort((a, b) => (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' })); if (iIF.length === 0) { console.log(`Generator: "${cF}" 为空。`); clearGeneratorUI(); return; } const cI = iIF.findIndex(i => i?.urlPath === lastSavedImageInfo.urlPath); let nUI = null; if (cI !== -1) { for (let i = cI + 1; i < iIF.length; i++) { const pN = iIF[i]; if (pN?.urlPath && !AppState.savedImagePaths.has(pN.urlPath)) { nUI = pN; console.log(`Generator: 找到下一个: ${nUI.fileName}`); break; } } } else { console.warn(`Generator: 未找到刚保存的 ${lastSavedImageInfo.urlPath}。从头查找...`); for (let i = 0; i < iIF.length; i++) { const pN = iIF[i]; if (pN?.urlPath && !AppState.savedImagePaths.has(pN.urlPath)) { nUI = pN; console.log(`Generator: 从头找到: ${nUI.fileName}`); break; } } } if (nUI) { displaySelectedImage(nUI); } else { console.log(`Generator: "${cF}" 已无未保存。`); displayToast(`"${cF}" 处理完毕！`, CLASS_NAMES.SUCCESS, DELAYS.MESSAGE_CLEAR); clearGeneratorUI(); } }
function handleGeneratorSearchInput() { if (AppState.isSettingInputProgrammatically) return; const q = DOM.searchInput.value.trim(); const cST = AppState.currentSelection ? `${AppState.currentSelection.name || '?'} (${AppState.currentSelection.fileName})` : ''; if (AppState.isShowingFolderSuggestions) { if (DOM.suggestionList) DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.isShowingFolderSuggestions = false; } if (AppState.currentSelection && q !== cST) { console.log("Generator: 输入不同，清空。"); clearGeneratorUI(); AppState.currentSelection = null; } AppState.showingRelatedImages = false; clearTimeout(AppState.searchDelayTimer); if (q === '') { if (DOM.suggestionList) DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); return; } AppState.searchDelayTimer = setTimeout(() => { if (DOM.searchInput.value.trim() === q) { console.log(`Generator: 搜索: "${q}"`); processSearch(q); } else { console.debug("Generator: 输入改变，取消。"); } }, DELAYS.INPUT_DEBOUNCE); }
function handleGeneratorSearchFocus() { const cV = DOM.searchInput.value.trim(); const cST = AppState.currentSelection ? `${AppState.currentSelection.name || '?'} (${AppState.currentSelection.fileName})` : ''; if (cV === '') { const f = findTopUnsavedFolders(); showFolderSuggestions(f); AppState.showingRelatedImages = false; } else if (AppState.currentSelection && cV === cST && !AppState.showingRelatedImages && AppState.backgroundWorker) { console.log("Generator: 聚焦匹配，请求相关..."); AppState.backgroundWorker.postMessage({ type: 'findSiblings', payload: { currentImageInfo: AppState.currentSelection } }); AppState.showingRelatedImages = true; AppState.isShowingFolderSuggestions = false; } else if (!AppState.currentSelection || cV !== cST) { console.log("Generator: 聚焦不符或无选择，搜索..."); processSearch(cV); AppState.showingRelatedImages = false; AppState.isShowingFolderSuggestions = false; } }
function showSuggestions(results, isFolder = false) { if (!DOM.suggestionList) { console.error("Generator: suggestions 未找到！"); return; } DOM.suggestionList.innerHTML = ''; if (!Array.isArray(results) || results.length === 0) { DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.isShowingFolderSuggestions = false; console.debug("Generator: 无建议，隐藏。"); return; } console.debug(`Generator: 显示 ${results.length} 条 ${isFolder ? '文件夹' : '图片'} 建议。`); AppState.isShowingFolderSuggestions = isFolder; const f = document.createDocumentFragment(); if (isFolder) { results.forEach(fN => { const i = document.createElement('div'); i.className = 'suggestion-item folder-suggestion'; i.innerHTML = `📂 <span class="suggestion-text">${fN}</span>`; i.style.cursor = 'pointer'; i.onclick = () => { if (DOM.searchInput) DOM.searchInput.value = fN; DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.isShowingFolderSuggestions = false; if (DOM.searchInput) DOM.searchInput.focus(); }; f.appendChild(i); }); } else { const uI = results.filter(iI => iI?.urlPath && !AppState.savedImagePaths.has(iI.urlPath)); uI.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' })); if (uI.length === 0) { DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); console.debug("Generator: 所有建议已保存，隐藏。"); return; } console.debug(`Generator: 显示 ${uI.length} 未保存建议。`); uI.forEach(iI => { const i = document.createElement('div'); i.className = 'suggestion-item image-suggestion'; const img = document.createElement('img'); const iP = iI.urlPath.startsWith('/') ? iI.urlPath : `/${iI.urlPath}`; img.alt = iI.name || '建议'; img.style.cssText = 'width:40px;height:40px;object-fit:cover;margin-right:8px;'; img.onerror = function() { this.style.display='none'; }; if (lazyLoadObserver) { img.dataset.src = iP; img.src = ''; lazyLoadObserver.observe(img); } else { console.warn("LazyLoadObserver 不可用:", iP); img.src = iP; img.loading = 'lazy'; } const s = document.createElement('span'); s.className = 'suggestion-text'; s.textContent = `${iI.name || '?'} (${iI.fileName})`; s.title = `${iI.folderName}/${iI.fileName}`; i.appendChild(img); i.appendChild(s); i.onclick = () => displaySelectedImage(iI); f.appendChild(i); }); } DOM.suggestionList.appendChild(f); DOM.suggestionList.classList.remove(CLASS_NAMES.HIDDEN); console.debug("Generator: 建议列表已显示。"); }
function findTopUnsavedFolders(limit = 5) { const uFC = {}; const aF = new Set(); if (!AppState.allGalleryImages?.length) return []; for (const img of AppState.allGalleryImages) { if (!img?.folderName || !img.urlPath) continue; aF.add(img.folderName); if (!AppState.savedImagePaths.has(img.urlPath)) uFC[img.folderName] = (uFC[img.folderName] || 0) + 1; } const sF = Object.entries(uFC).sort(([, cA], [, cB]) => cB - cA).map(([fN]) => fN); return sF.slice(0, limit); }
function showFolderSuggestions(folderNames) { showSuggestions(folderNames, true); }

// --------------------------------------------------------------------------
// 图片入库 (Import) 功能 (来自你的回滚版本)
// --------------------------------------------------------------------------
async function loadImportDataIfNeeded() { if (AppState.guToolsImportDataLoaded) { console.log("Gu工具: Import 数据已加载。"); updateImportInputPlaceholders(); return; } console.log("Gu工具: 首次进入 Import，加载数据..."); if(DOM.tempImageSearchInput) DOM.tempImageSearchInput.placeholder = '加载中...'; if(DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.placeholder = '加载中...'; if (typeof disableImportFormSections === "function") disableImportFormSections(); else console.warn("loadImportDataIfNeeded: disableImportFormSections 未定义!"); try { if (typeof fetchTempImages !== "function" || typeof fetchCharacterFolders !== "function") throw new Error("fetchTempImages 或 fetchCharacterFolders 未定义!"); await Promise.all([ fetchTempImages(), fetchCharacterFolders() ]); AppState.guToolsImportDataLoaded = true; console.log("Gu工具: Import 数据加载完毕。"); if (typeof updateImportInputPlaceholders === "function") updateImportInputPlaceholders(); else console.warn("loadImportDataIfNeeded: updateImportInputPlaceholders 未定义!"); if (AppState.selectedTempImageInfo && typeof enableImportFormSections === "function") enableImportFormSections(); else if(AppState.selectedTempImageInfo) console.warn("loadImportDataIfNeeded: enableImportFormSections 未定义!"); } catch (error) { console.error("Gu工具: 加载 Import 数据失败:", error); displayToast("Import 数据加载失败", CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); if(DOM.tempImageSearchInput) DOM.tempImageSearchInput.placeholder = '加载失败'; if(DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.placeholder = '加载失败'; } }
async function fetchTempImages() { if (!DOM.tempImageSearchInput) return; DOM.tempImageSearchInput.disabled = true; DOM.tempImageSearchInput.readOnly = false; DOM.tempImageSearchInput.style.cursor = 'default'; DOM.tempImageSearchInput.placeholder = '加载待入库...'; try { const data = await fetchJsonData(API_ENDPOINTS.TEMP_IMAGES); AppState.tempImagesList = Array.isArray(data) ? data : []; console.log(`Import: 加载 ${AppState.tempImagesList.length} 待入库。`); updateImportInputPlaceholders(); if (AppState.tempImagesList.length === 0) displayImportMessage("提示：imgtemp 为空", CLASS_NAMES.INFO); else if (DOM.importMessageArea?.textContent.includes("为空")) hideImportMessage(); } catch (e) { console.error("Import: 加载待入库失败:", e); displayToast('加载待入库失败', CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.tempImageSearchInput.placeholder = '加载失败'; DOM.tempImageSearchInput.disabled = true; AppState.tempImagesList = []; } }
async function fetchCharacterFolders() { if (!DOM.targetFolderSearchInput) return; try { const data = await fetchJsonData(API_ENDPOINTS.CHARACTER_FOLDERS); AppState.characterFoldersList = Array.isArray(data) ? data : []; console.log(`Import: 加载 ${AppState.characterFoldersList.length} 目标文件夹。`); updateImportInputPlaceholders(); } catch (e) { console.error("Import: 加载文件夹失败:", e); displayToast('加载文件夹失败', CLASS_NAMES.WARNING, DELAYS.TOAST_ERROR_DURATION); DOM.targetFolderSearchInput.placeholder = '加载失败，可手动'; AppState.characterFoldersList = []; } }
function updateImportInputPlaceholders() { if (DOM.tempImageSearchInput) { const has = AppState.tempImagesList?.length > 0; DOM.tempImageSearchInput.disabled = !has; DOM.tempImageSearchInput.readOnly = has; DOM.tempImageSearchInput.style.cursor = has ? 'pointer' : 'default'; DOM.tempImageSearchInput.placeholder = has ? `点击选择 ${AppState.tempImagesList.length} 张待入库` : 'imgtemp 目录为空'; } if (DOM.targetFolderSearchInput) { DOM.targetFolderSearchInput.placeholder = AppState.characterFoldersList.length > 0 ? `搜索 ${AppState.characterFoldersList.length} 个或输入新名称...` : '输入新文件夹名称...'; DOM.targetFolderSearchInput.disabled = !AppState.selectedTempImageInfo; } }
function showTempImageSuggestions(results) { if (!DOM.tempImageSuggestions) { console.error("Import: tempImageSuggestions 未找到！"); return; } if (!Array.isArray(results)) { console.error("Import: showTempImageSuggestions 无效 results:", results); DOM.tempImageSuggestions.classList.add(CLASS_NAMES.HIDDEN); return; } console.log(`Import: 显示 ${results.length} 待入库建议。`); DOM.tempImageSuggestions.innerHTML = ''; if (results.length === 0) { DOM.tempImageSuggestions.classList.add(CLASS_NAMES.HIDDEN); return; } const fragment = document.createDocumentFragment(); results.slice(0, 20).forEach(imgInfo => { const item = document.createElement('div'); item.className = 'suggestion-item import-suggestion'; item.textContent = imgInfo.filename; item.title = imgInfo.path; item.onclick = () => selectTempImage(imgInfo); fragment.appendChild(item); }); DOM.tempImageSuggestions.appendChild(fragment); DOM.tempImageSuggestions.classList.remove(CLASS_NAMES.HIDDEN); console.log("Import: 待入库建议已显示。"); }
function showTargetFolderSuggestions(results) { if (!DOM.targetFolderSuggestions || !DOM.targetFolderSearchInput) return; DOM.targetFolderSuggestions.innerHTML = ''; if (!results || results.length === 0) { DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); return; } const fragment = document.createDocumentFragment(); results.slice(0, 10).forEach(folderName => { const item = document.createElement('div'); item.className = 'suggestion-item import-suggestion'; item.textContent = folderName; item.onclick = () => selectTargetFolder(folderName); fragment.appendChild(item); }); DOM.targetFolderSuggestions.appendChild(fragment); DOM.targetFolderSuggestions.classList.remove(CLASS_NAMES.HIDDEN); }
function selectTempImage(imgInfo) { if (!imgInfo?.path || !imgInfo.filename) { console.error("Import: selectTempImage 无效 imgInfo:", imgInfo); return; } console.log("Import: 选择待入库:", imgInfo.filename); AppState.selectedTempImageInfo = imgInfo; if (DOM.tempImageSearchInput) DOM.tempImageSearchInput.value = imgInfo.filename; if (DOM.tempImagePreview) { const imageUrl = imgInfo.path.startsWith('/') ? imgInfo.path : `/${imgInfo.path}`; DOM.tempImagePreview.src = ""; DOM.tempImagePreview.alt = "加载..."; DOM.tempImagePreview.classList.remove(CLASS_NAMES.HIDDEN); DOM.tempImagePreview.onerror = () => { console.error("Import: 预览失败:", imageUrl); displayToast(`预览 "${imgInfo.filename}" 失败`, CLASS_NAMES.ERROR); DOM.tempImagePreview.classList.add(CLASS_NAMES.HIDDEN); DOM.tempImagePreview.src = ""; DOM.tempImagePreview.alt = "失败"; AppState.selectedTempImageInfo = null; disableImportFormSections(); }; DOM.tempImagePreview.onload = () => { DOM.tempImagePreview.alt = imgInfo.filename; }; DOM.tempImagePreview.src = imageUrl; } if (DOM.tempImageSuggestions) DOM.tempImageSuggestions.classList.add(CLASS_NAMES.HIDDEN); enableImportFormSections(); if (DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.value = ''; if (DOM.finalFilenameInput) DOM.finalFilenameInput.value = ''; AppState.selectedTargetFolder = null; if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; }
async function selectTargetFolder(folderName) { folderName = folderName.trim(); if (!folderName) { console.warn("Import: 空文件夹。"); return; } console.log("Import: 选择目标:", folderName); AppState.selectedTargetFolder = folderName; if (DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.value = folderName; if (DOM.targetFolderSuggestions) DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); if (DOM.finalFilenameInput) { DOM.finalFilenameInput.value = '获取编号...'; DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); } if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; if (!AppState.selectedTempImageInfo?.filename) { displayToast('错误：先选图', CLASS_NAMES.ERROR); if(DOM.finalFilenameInput) DOM.finalFilenameInput.value = '错误'; return; } try { const url = `${API_ENDPOINTS.LAST_FILE_NUMBER}?folder=${encodeURIComponent(folderName)}`; const data = await fetchJsonData(url); if (data && typeof data.lastNumber === 'number') { const nextNumber = data.lastNumber + 1; AppState.suggestedFilenameNum = nextNumber; AppState.suggestedFilenameBase = folderName + 'Gu'; const match = AppState.selectedTempImageInfo.filename.match(/\.[^.]+$/); AppState.suggestedFilenameExt = match ? match[0] : '.webp'; const finalFilename = `${AppState.suggestedFilenameBase}${nextNumber}${AppState.suggestedFilenameExt}`; if (DOM.finalFilenameInput) DOM.finalFilenameInput.value = finalFilename; if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = false; if (DOM.editFilenameButton) DOM.editFilenameButton.classList.remove(CLASS_NAMES.HIDDEN); console.log(`Import: 建议文件名: ${finalFilename}`); } else { throw new Error(data?.error || '无效编号数据'); } } catch (error) { console.error(`Import: 获取编号失败 (${folderName}):`, error); displayToast(`获取编号失败: ${error.message}`, CLASS_NAMES.ERROR); if (DOM.finalFilenameInput) DOM.finalFilenameInput.value = '获取失败'; if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); } }
function enableImportFormSections() { if (DOM.importAttributesPanel) DOM.importAttributesPanel.classList.remove(CLASS_NAMES.HIDDEN, CLASS_NAMES.INITIALLY_HIDDEN); if (DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.disabled = false; const namingSection = DOM.importPaneView?.querySelector('.naming-section'); if (namingSection) namingSection.classList.add(CLASS_NAMES.ACTIVE); console.debug("Import: 表单后续启用。"); }
function disableImportFormSections() { if (DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.disabled = true; const namingSection = DOM.importPaneView?.querySelector('.naming-section'); if (namingSection) namingSection.classList.remove(CLASS_NAMES.ACTIVE); if (DOM.finalFilenameInput) { DOM.finalFilenameInput.value = ''; DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); } if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; console.debug("Import: 表单后续禁用。"); }
async function handleAddToGallery() { if (!AppState.selectedTempImageInfo || !AppState.selectedTargetFolder || !DOM.finalFilenameInput || !DOM.addToGalleryButton || !DOM.importMessageArea) { console.warn("Import: 添加条件未满足。"); return; } hideImportMessage(); const finalName = DOM.finalFilenameInput.value.trim(); const tempPath = AppState.selectedTempImageInfo.path; const targetFolder = AppState.selectedTargetFolder; if (!finalName) { displayImportMessage("错误：文件名不能为空", CLASS_NAMES.ERROR); return; } if (/[\\/:"*?<>|]/.test(finalName)) { displayImportMessage("错误：文件名含非法字符", CLASS_NAMES.ERROR); return; } const ratingInput = document.querySelector('input[name="importRating"]:checked'); const layoutInput = document.querySelector('input[name="importLayout"]:checked'); const isEasterEgg = DOM.importIsEasterEggCheckbox?.checked ?? false; const isAiImage = DOM.importIsAiImageCheckbox?.checked ?? false; if (!ratingInput || !layoutInput) { displayImportMessage("错误：无法读取属性", CLASS_NAMES.ERROR); return; } const rating = ratingInput.value || 'none'; const layout = layoutInput.value || 'normal'; DOM.addToGalleryButton.disabled = true; displayImportMessage("添加中...", CLASS_NAMES.INFO); const importData = { tempImagePath: tempPath, targetFolder: targetFolder, targetFilename: finalName, attributes: { isPx18: rating === 'px18', isRx18: rating === 'rx18', layout: layout, isEasterEgg: isEasterEgg, isAiImage: isAiImage, isBan: false, Downloaded_From: 'local_import' } }; console.log("Import: 发送入库请求:", importData); try { const result = await fetchJsonData(API_ENDPOINTS.IMPORT_IMAGE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(importData) }); if (result?.success === true && result.newEntry?.path) { console.log("Import: 添加成功:", result.newEntry); displayImportMessage(`成功添加 "${finalName}"！`, CLASS_NAMES.SUCCESS); AppState.savedEntries.push(result.newEntry); AppState.savedImagePaths.add(result.newEntry.path); if (typeof updateEntryCount === "function") updateEntryCount(); const dLPActive = DOM.dataListPane?.classList.contains(CLASS_NAMES.ACTIVE); if (dLPActive && typeof applyFiltersAndRenderDataList === "function") { console.log("Import: 刷新 DataList..."); applyFiltersAndRenderDataList(); } await fetchTempImages(); resetImportForm(); } else { throw new Error(result?.error || "添加失败，服务器未返回成功"); } } catch (error) { console.error("Import: 添加失败:", error); displayImportMessage(`添加失败: ${error.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.addToGalleryButton.disabled = false; } }
function resetImportForm() { console.log("Import: 重置表单..."); if (DOM.tempImageSearchInput) DOM.tempImageSearchInput.value = ''; if (DOM.targetFolderSearchInput) DOM.targetFolderSearchInput.value = ''; if (DOM.finalFilenameInput) { DOM.finalFilenameInput.value = ''; DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); } if (DOM.tempImagePreview) { DOM.tempImagePreview.onerror = null; DOM.tempImagePreview.src = ''; DOM.tempImagePreview.alt = '待入库图片预览'; DOM.tempImagePreview.classList.add(CLASS_NAMES.HIDDEN); } AppState.selectedTempImageInfo = null; AppState.selectedTargetFolder = null; AppState.suggestedFilenameBase = ''; AppState.suggestedFilenameNum = 0; AppState.suggestedFilenameExt = ''; const dR = document.querySelector('input[name="importRating"][value="none"]'); const dL = document.querySelector('input[name="importLayout"][value="normal"]'); if (dR) dR.checked = true; if (dL) dL.checked = true; if (DOM.importIsEasterEggCheckbox) DOM.importIsEasterEggCheckbox.checked = false; if (DOM.importIsAiImageCheckbox) DOM.importIsAiImageCheckbox.checked = false; if (typeof disableImportFormSections === "function") disableImportFormSections(); else console.warn("resetImportForm: disableImportFormSections 未定义!"); if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; if (typeof updateImportInputPlaceholders === "function") updateImportInputPlaceholders(); else console.warn("resetImportForm: updateImportInputPlaceholders 未定义!"); hideImportMessage(); }
function handleTargetFolderInput() { clearTimeout(AppState.targetFolderSearchDebounceTimer); const q = DOM.targetFolderSearchInput.value.toLowerCase().trim(); if (DOM.finalFilenameInput) DOM.finalFilenameInput.value = ''; if (DOM.addToGalleryButton) DOM.addToGalleryButton.disabled = true; if (DOM.editFilenameButton) DOM.editFilenameButton.classList.add(CLASS_NAMES.HIDDEN); AppState.selectedTargetFolder = null; AppState.targetFolderSearchDebounceTimer = setTimeout(() => { if (q && AppState.characterFoldersList.length > 0) { const r = AppState.characterFoldersList.filter(f => f.toLowerCase().includes(q)); showTargetFolderSuggestions(r); } else if (DOM.targetFolderSuggestions) { DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); } }, DELAYS.IMPORT_SEARCH_DEBOUNCE); }
function handleTargetFolderBlur() { setTimeout(() => { if (DOM.targetFolderSuggestions && !DOM.targetFolderSuggestions.classList.contains(CLASS_NAMES.HIDDEN)) return; const v = DOM.targetFolderSearchInput.value.trim(); if (v && v !== AppState.selectedTargetFolder) { console.log("Import: 目标失焦，自动选择:", v); selectTargetFolder(v); } else if (!v && DOM.targetFolderSuggestions) { DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); } }, 150); }
function handleTargetFolderKeyDown(event) { if (event.key === 'Enter') { event.preventDefault(); const v = DOM.targetFolderSearchInput.value.trim(); if (v && v !== AppState.selectedTargetFolder) { selectTargetFolder(v); DOM.targetFolderSearchInput.blur(); } } else if (event.key === 'Escape') { if (DOM.targetFolderSuggestions) DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); } }

// --------------------------------------------------------------------------
// MD5 校准 (MD5 Calibration) 功能
// --------------------------------------------------------------------------
async function handleStartMD5Calibration() { console.log("[DEBUG] handleStartMD5Calibration 触发"); const reqMap = { startMD5Calibration: DOM.startMD5Calibration, abortMD5Calibration: DOM.abortMD5Calibration, md5CalibrationStatus: DOM.md5CalibrationStatus, totalFilesChecked: DOM.totalFilesChecked, filesCheckedCount: DOM.filesCheckedCount, totalMD5Count: DOM.totalMD5Count, mismatchedMD5Count: DOM.mismatchedMD5Count, md5CalibrationProgress: DOM.md5CalibrationProgress, md5CalibrationProgressBar: DOM.md5CalibrationProgressBar, jsonMd5ListContainer: DOM.jsonMd5ListContainer, mismatchedMD5List: DOM.mismatchedMD5List, fixAllMismatchedMD5: DOM.fixAllMismatchedMD5, filesNotInJsonCount: DOM.filesNotInJsonCount, filesNotInJsonList: DOM.filesNotInJsonList, mismatchedCountDisplay: DOM.mismatchedCountDisplay, jsonTotalEntriesDisplay: DOM.jsonTotalEntriesDisplay }; const missing = Object.entries(reqMap).filter(([k, v]) => !v).map(([k]) => k); if (missing.length > 0) { console.error(`[DEBUG] MD5: 缺少 DOM: ${missing.join(', ')}`); displayToast("无法校准：界面缺失", CLASS_NAMES.ERROR); return; } console.log("[DEBUG] MD5: DOM 检查通过。"); AppState.isCalibrationRunning = true; AppState.isCalibrationAborted = false; mismatchDataForFixing = []; filesNotInJsonData = []; DOM.startMD5Calibration.disabled = true; DOM.abortMD5Calibration.disabled = false; DOM.abortMD5Calibration.classList.remove('hidden'); DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); DOM.totalFilesChecked.textContent = '加载...'; DOM.filesCheckedCount.textContent = '0'; DOM.totalMD5Count.textContent = Array.isArray(AppState.savedEntries) ? AppState.savedEntries.length.toString() : '0'; DOM.mismatchedMD5Count.textContent = '0'; DOM.mismatchedCountDisplay.textContent = '0'; DOM.mismatchedMD5List.value = ''; DOM.filesNotInJsonCount.textContent = '0'; DOM.filesNotInJsonList.value = ''; DOM.md5CalibrationProgress.textContent = '获取列表...'; DOM.md5CalibrationProgressBar.style.display = 'block'; DOM.md5CalibrationProgressBar.value = 0; DOM.jsonMd5ListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(i => i.classList.remove('mismatched')); displayToast("开始校准...", CLASS_NAMES.INFO, 2000); try { let allPaths = []; console.log("[DEBUG] MD5: 获取列表..."); displayToast("获取列表...", CLASS_NAMES.INFO, 3000); try { const data = await fetchJsonData(API_ENDPOINTS.LOCAL_IMAGES); if (Array.isArray(data)) { allPaths = data.map(img => img.urlPath).filter(Boolean); console.log(`[DEBUG] MD5: API 获取 ${allPaths.length} 路径。`); } else { console.warn("[DEBUG] MD5: API 非数组，尝试 AppState..."); if (Array.isArray(AppState.allGalleryImages)) { allPaths = AppState.allGalleryImages.map(img => img.urlPath).filter(Boolean); console.log(`[DEBUG] MD5: AppState 获取 ${allPaths.length} 路径。`); } else { throw new Error("无法获取列表"); } } console.log("[DEBUG] MD5: 路径(前10):", allPaths.slice(0, 10)); if (allPaths.length === 0) throw new Error("列表为空"); } catch (err) { console.error("[DEBUG] MD5: 获取列表失败:", err); displayToast(`获取列表失败: ${err.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); AppState.isCalibrationRunning = false; DOM.startMD5Calibration.disabled = false; DOM.abortMD5Calibration.disabled = true; DOM.md5CalibrationProgress.textContent = '错误'; return; } const total = allPaths.length; DOM.totalFilesChecked.textContent = total.toString(); DOM.md5CalibrationProgressBar.max = total; const jsonEntries = AppState.savedEntries || []; const map = new Map(); const jsonSet = new Set(); jsonEntries.forEach(e => { if (e?.path) { jsonSet.add(e.path); if (e.attributes?.md5) map.set(e.path, e.attributes.md5); } }); let mismatch = 0, checked = 0, notInJson = 0; const details = []; DOM.md5CalibrationProgress.textContent = `检查 0 / ${total}...`; console.log("[DEBUG] MD5: 进入循环..."); for (const fp of allPaths) { if (AppState.isCalibrationAborted) { console.log("MD5: 中止。"); DOM.md5CalibrationProgress.textContent = `中止 (${checked}/${total})`; displayToast("校准中止", CLASS_NAMES.WARNING); if (mismatchDataForFixing.length > 0) { DOM.fixAllMismatchedMD5.disabled = false; DOM.fixAllMismatchedMD5.classList.remove('disabled'); } else { DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); } break; } checked++; DOM.filesCheckedCount.textContent = checked.toString(); DOM.md5CalibrationProgress.textContent = `检查 ${checked}/${total}: ${fp.split('/').pop()}`; DOM.md5CalibrationProgressBar.value = checked; const expected = map.get(fp); const li = DOM.jsonMd5ListContainer.querySelector(`.json-md5-item[data-path="${CSS.escape(fp)}"]`); if (!jsonSet.has(fp)) { notInJson++; filesNotInJsonData.push(fp); DOM.filesNotInJsonCount.textContent = notInJson.toString(); continue; } if (!expected) { continue; } try { const actual = await fetchImageMd5(fp); if (actual && actual !== expected) { mismatch++; details.push(`文件: ${fp}\n JSON: ${expected}\n 实际: ${actual}\n`); mismatchDataForFixing.push({ path: fp, expected: expected, actual: actual }); DOM.mismatchedMD5Count.textContent = mismatch.toString(); DOM.mismatchedCountDisplay.textContent = mismatch.toString(); if (li) li.classList.add('mismatched'); } else if (!actual) { mismatch++; details.push(`文件: ${fp}\n JSON: ${expected}\n 实际: 计算失败!\n`); DOM.mismatchedMD5Count.textContent = mismatch.toString(); DOM.mismatchedCountDisplay.textContent = mismatch.toString(); if (li) li.classList.add('mismatched'); } else { if (li) li.classList.remove('mismatched'); } } catch (e) { console.error(`[DEBUG] MD5: 处理 ${fp} 出错:`, e); mismatch++; details.push(`文件: ${fp}\n 处理出错: ${e.message}\n`); DOM.mismatchedMD5Count.textContent = mismatch.toString(); DOM.mismatchedCountDisplay.textContent = mismatch.toString(); if (li) li.classList.add('mismatched'); } await new Promise(r => setTimeout(r, 1)); } console.log("[DEBUG] MD5: 循环结束。"); DOM.mismatchedMD5List.value = details.join('\n'); DOM.filesNotInJsonList.value = filesNotInJsonData.join('\n'); DOM.filesNotInJsonCount.textContent = notInJson.toString(); if (!AppState.isCalibrationAborted) { DOM.md5CalibrationProgress.textContent = `完成 ${total} 文件检查。`; if (mismatch > 0) { displayToast(`校准完成，${mismatch} 不一致。`, CLASS_NAMES.WARNING, DELAYS.TOAST_ERROR_DURATION); DOM.fixAllMismatchedMD5.disabled = false; DOM.fixAllMismatchedMD5.classList.remove('disabled'); } else { displayToast("校准完成，一致！", CLASS_NAMES.SUCCESS); DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); } } } catch (e) { console.error("[DEBUG] MD5 失败 (外部):", e); displayToast(`MD5 失败: ${e.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.md5CalibrationProgress.textContent = '出错!'; if (mismatchDataForFixing.length > 0) { DOM.fixAllMismatchedMD5.disabled = false; DOM.fixAllMismatchedMD5.classList.remove('disabled'); } else { DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); } AppState.isCalibrationRunning = false; } finally { console.log("[DEBUG] MD5: finally。"); AppState.isCalibrationRunning = false; DOM.startMD5Calibration.disabled = false; DOM.abortMD5Calibration.disabled = true; if (mismatchDataForFixing.length > 0) { if (DOM.fixAllMismatchedMD5.disabled) { console.log("[DEBUG] MD5: finally 检查，启用修复。"); DOM.fixAllMismatchedMD5.disabled = false; DOM.fixAllMismatchedMD5.classList.remove('disabled'); } } else { if (!DOM.fixAllMismatchedMD5.disabled) { console.log("[DEBUG] MD5: finally 检查，禁用修复。"); DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); } } } }
function handleAbortMD5Calibration() { AppState.isCalibrationAborted = true; displayToast("请求中止...", CLASS_NAMES.WARNING); if (DOM.abortMD5Calibration) DOM.abortMD5Calibration.disabled = true; }
async function handleFixAllMismatches() { if (!DOM.fixAllMismatchedMD5 || DOM.fixAllMismatchedMD5.disabled) return; if (mismatchDataForFixing.length === 0) { displayToast("无修复项。", CLASS_NAMES.INFO); return; } const confirmed = confirm(`更新 ${mismatchDataForFixing.length} 条 MD5？\n此操作修改 ImageData.json！\n\n确定？`); if (!confirmed) { displayToast("修复取消。", CLASS_NAMES.INFO); return; } DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); DOM.startMD5Calibration.disabled = true; displayToast("修复中...", CLASS_NAMES.INFO); let uC = 0, fC = 0; const uE = JSON.parse(JSON.stringify(AppState.savedEntries)); mismatchDataForFixing.forEach(m => { const idx = uE.findIndex(e => e.path === m.path); if (idx > -1) { if (!uE[idx].attributes) uE[idx].attributes = {}; uE[idx].attributes.md5 = m.actual; uE[idx].timestamp = new Date().toISOString(); uC++; console.log(`MD5 修复: 准备 ${m.path}`); } else { fC++; console.warn(`MD5 修复: 未找到 ${m.path}。`); } }); if (uC === 0) { displayToast("未找到可更新条目。", CLASS_NAMES.WARNING); DOM.startMD5Calibration.disabled = false; return; } try { if (typeof updateUserData !== 'function') throw new Error("updateUserData 未定义！"); const success = await updateUserData(uE, `成功更新 ${uC} 条 MD5`, 'toast', false); if (success) { displayToast(`成功修复 ${uC} 个 MD5！`, CLASS_NAMES.SUCCESS, DELAYS.MESSAGE_CLEAR); DOM.mismatchedMD5List.value = ''; DOM.mismatchedMD5Count.textContent = '0'; DOM.mismatchedCountDisplay.textContent = '0'; mismatchDataForFixing = []; DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); DOM.jsonMd5ListContainer.querySelectorAll('.json-md5-item.mismatched').forEach(i => i.classList.remove('mismatched')); populateJsonMd5List(); displayToast("建议重校准确认。", CLASS_NAMES.INFO, 4000); } else { console.error("MD5 修复: updateUserData 失败。"); DOM.fixAllMismatchedMD5.disabled = true; DOM.fixAllMismatchedMD5.classList.add('disabled'); } } catch (error) { console.error("MD5 修复: 调用出错:", error); displayToast(`保存更新出错: ${error.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.fixAllMismatchedMD5.disabled = false; DOM.fixAllMismatchedMD5.classList.remove('disabled'); } finally { DOM.startMD5Calibration.disabled = false; } }

// --------------------------------------------------------------------------
// 序号管理 (Sequence Management) 功能
// --------------------------------------------------------------------------
async function getFilesForSequenceAnalysis(folderName) { console.log(`[DEBUG] Sequence: 请求 "${folderName}" 内容...`); /* ★★★ 实现获取文件列表的逻辑 ★★★ */ try { const url = `${API_ENDPOINTS.FOLDER_CONTENTS}?folder=${encodeURIComponent(folderName)}`; console.log(`[DEBUG] Sequence: Fetching ${url}`); const data = await fetchJsonData(url); if (Array.isArray(data)) { console.log(`[DEBUG] Sequence: 获取 ${folderName} ${data.length} 文件。`); return data; } else { console.warn(`[DEBUG] Sequence: ${folderName} API 格式错误:`, data); return []; } } catch (error) { console.error(`[DEBUG] Sequence: 获取 ${folderName} 失败:`, error); displayToast(`获取 ${folderName} 失败`, CLASS_NAMES.ERROR); throw new Error(`无法获取 ${folderName} 列表`); } }
async function handleAnalyzeSequences() { if (!DOM.analyzeSequences || !DOM.sequenceAnalysisStatus || !DOM.sequenceIssuesList || !DOM.fixSequenceIssues) { console.error("序号管理: 缺少 DOM。"); displayToast("无法分析：界面缺失", CLASS_NAMES.ERROR); return; } if (AppState.isSequenceAnalysisRunning) { displayToast("分析中...", CLASS_NAMES.INFO); return; } AppState.isSequenceAnalysisRunning = true; sequenceFixPlan = []; DOM.analyzeSequences.disabled = true; DOM.fixSequenceIssues.disabled = true; DOM.fixSequenceIssues.classList.add('disabled'); DOM.sequenceAnalysisStatus.innerHTML = '<p>获取列表...</p>'; DOM.sequenceIssuesList.value = ''; AppState.sequenceAnalysisResults = []; displayToast("开始分析...", CLASS_NAMES.INFO, 2000); try { let cF = AppState.characterFoldersList || []; if (cF.length === 0 && typeof fetchCharacterFolders === 'function') { console.log("[DEBUG] Sequence: 列表为空，重获取..."); await fetchCharacterFolders(); cF = AppState.characterFoldersList; if (cF.length === 0) throw new Error("未能获取列表。"); } else if (cF.length === 0) { throw new Error("列表为空且无法获取。"); } const tF = cF.length; DOM.sequenceAnalysisStatus.innerHTML = `<p>获取 ${tF} 文件夹，检查中...</p>`; let iFC = 0; const sID = []; const sR = /Gu(\d+)\.(webp|jpg|jpeg|png|gif)$/i; for (let i = 0; i < cF.length; i++) { const fN = cF[i]; DOM.sequenceAnalysisStatus.innerHTML = `<p>检查 (${i + 1}/${tF}): ${fN}</p>`; try { const fIF = await getFilesForSequenceAnalysis(fN); const fS = []; const fM = new Map(); for (const fn of fIF) { const m = fn.match(sR); if (m) { const sN = parseInt(m[1], 10); fS.push({ num: sN, filename: fn }); if (!fM.has(sN)) fM.set(sN, []); fM.get(sN).push(fn); } } if (fS.length > 0) { fS.sort((a, b) => a.num - b.num); let cFI = []; let aGFT = [`--- 文件列表 (${fS.length}) ---`]; fS.forEach(f => aGFT.push(`  ${f.filename}`)); const counts = {}; fS.forEach(s => { counts[s.num] = (counts[s.num] || 0) + 1; }); let needsFixing = false; for (const sNS in counts) { if (counts[sNS] > 1) { const sN = parseInt(sNS); cFI.push(`  - 问题: 重复序号 ${sN} (文件: ${fM.get(sN).join(', ')})`); needsFixing = true; } } if (fS[0].num !== 1) { cFI.push(`  - 问题: 不从 1 开始 (最小 ${fS[0].num} - ${fS[0].filename})`); needsFixing = true; } for (let j = 0; j < fS.length - 1; j++) { const cS = fS[j].num; const nS = fS[j + 1].num; if (counts[cS] === 1 && nS !== cS + 1) { cFI.push(`  - 问题: 不连续，${cS} (${fS[j].filename}) 后是 ${nS} (${fS[j+1].filename})`); needsFixing = true; } } if (cFI.length > 0) { iFC++; sID.push(`文件夹: ${fN}`); sID.push(...cFI); sID.push(...aGFT); sID.push(''); if (needsFixing) { const filesToRenamePlan = []; let newSeqNum = 1; const sortedByFilename = [...fS].sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })); sortedByFilename.forEach(fI => { const extMatch = fI.filename.match(/\.[^.]+$/); const ext = extMatch ? extMatch[0] : '.webp'; const newFn = `${fN}Gu${newSeqNum}${ext}`; if (newFn !== fI.filename) filesToRenamePlan.push({ currentFilename: fI.filename, newFilename: newFn }); newSeqNum++; }); if (filesToRenamePlan.length > 0) { sequenceFixPlan.push({ folderName: fN, filesToRename: filesToRenamePlan }); console.log(`[DEBUG] Sequence: 为 "${fN}" 生成修复计划 (${filesToRenamePlan.length}项)。`); } } } } else { console.debug(`[DEBUG] Sequence: "${fN}" 无 GuX 文件。`); } } catch (fE) { sID.push(`文件夹: ${fN}`); sID.push(`  - 检查出错: ${fE.message}`); sID.push(''); iFC++; console.error(`[DEBUG] Sequence: 检查 ${fN} 出错:`, fE); } await new Promise(r => setTimeout(r, 5)); } DOM.sequenceIssuesList.value = sID.join('\n'); DOM.sequenceAnalysisStatus.innerHTML = `<p>完成 ${tF} 文件夹分析。</p>`; if (iFC > 0 && sequenceFixPlan.length > 0) { displayToast(`分析完成，${iFC} 文件夹有问题。`, CLASS_NAMES.WARNING); DOM.fixSequenceIssues.disabled = false; DOM.fixSequenceIssues.classList.remove('disabled'); DOM.fixSequenceIssues.textContent = `一键修复 (${sequenceFixPlan.length}个文件夹)`; } else if (iFC > 0 && sequenceFixPlan.length === 0) { displayToast(`分析完成，${iFC} 文件夹有问题，但无法生成修复计划。`, CLASS_NAMES.WARNING); DOM.fixSequenceIssues.textContent = `一键修复`; } else { displayToast("分析完成，未发现序号问题！", CLASS_NAMES.SUCCESS); DOM.fixSequenceIssues.textContent = `一键修复`; } AppState.sequenceAnalysisResults = sID; } catch (e) { console.error("序号分析失败:", e); displayToast(`分析失败: ${e.message}`, CLASS_NAMES.ERROR); DOM.sequenceAnalysisStatus.innerHTML = '<p>分析出错!</p>'; } finally { DOM.analyzeSequences.disabled = false; AppState.isSequenceAnalysisRunning = false; } }
async function handleFixSequenceIssues() { if (!DOM.fixSequenceIssues || DOM.fixSequenceIssues.disabled) return; if (sequenceFixPlan.length === 0) { displayToast("无修复计划。", CLASS_NAMES.INFO); return; } const confirmed = confirm(`警告：即将对 ${sequenceFixPlan.length} 文件夹进行序号修复。\n高风险且不可逆！请先备份！\n\n确定？`); if (!confirmed) { displayToast("修复取消。", CLASS_NAMES.INFO); return; } DOM.fixSequenceIssues.disabled = true; DOM.fixSequenceIssues.classList.add('disabled'); DOM.analyzeSequences.disabled = true; displayToast("发送修复请求...", CLASS_NAMES.INFO); DOM.sequenceAnalysisStatus.innerHTML = `<p>修复 ${sequenceFixPlan.length} 文件夹中...</p>`; try { const response = await fetchJsonData(API_ENDPOINTS.RENAME_SEQUENCE_FILES, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fixPlan: sequenceFixPlan }) }); if (response?.success) { displayToast(`修复成功！处理 ${response.processedFolders || '?'} 文件夹，重命名 ${response.renamedFiles || '?'} 文件。`, CLASS_NAMES.SUCCESS, DELAYS.MESSAGE_CLEAR); DOM.sequenceIssuesList.value = ''; sequenceFixPlan = []; AppState.sequenceAnalysisResults = []; DOM.fixSequenceIssues.textContent = `一键修复`; displayToast("建议重扫描确认。", CLASS_NAMES.INFO, 4000); } else { throw new Error(response?.error || "后端修复失败。"); } } catch (error) { console.error("序号修复失败:", error); displayToast(`修复失败: ${error.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.fixSequenceIssues.disabled = false; DOM.fixSequenceIssues.classList.remove('disabled'); } finally { DOM.analyzeSequences.disabled = false; } }

// --------------------------------------------------------------------------
// JSON 校准 (JSON Calibration) 功能 (新增)
// --------------------------------------------------------------------------
async function handleJsonCalibration() {
    console.log("[DEBUG] handleJsonCalibration 触发");
    const reqMap = { startJsonCalibration: DOM.startJsonCalibration, jsonCalibrationStatus: DOM.jsonCalibrationStatus, jsonEntriesCheckedCount: DOM.jsonEntriesCheckedCount, jsonFilesCheckedCount: DOM.jsonFilesCheckedCount, missingFilesCount: DOM.missingFilesCount, jsonCalibrationProgress: DOM.jsonCalibrationProgress, jsonCalibrationProgressBar: DOM.jsonCalibrationProgressBar, missingFilesList: DOM.missingFilesList, missingFilesCountDisplay: DOM.missingFilesCountDisplay, removeMissingEntriesBtn: DOM.removeMissingEntriesBtn };
    const missing = Object.entries(reqMap).filter(([k, v]) => !v).map(([k]) => k);
    if (missing.length > 0) { console.error(`[DEBUG] JSON 校准: 缺少 DOM: ${missing.join(', ')}`); displayToast("无法校准：界面缺失", CLASS_NAMES.ERROR); return; }
    console.log("[DEBUG] JSON 校准: DOM 检查通过。");

    AppState.isJsonCalibrationRunning = true; jsonMissingEntries = []; jsonCalibrationMissingPaths = []; // 清空结果
    DOM.startJsonCalibration.disabled = true; DOM.removeMissingEntriesBtn.disabled = true; DOM.removeMissingEntriesBtn.classList.add('disabled');
    DOM.jsonEntriesCheckedCount.textContent = '0'; DOM.jsonFilesCheckedCount.textContent = '加载...'; DOM.missingFilesCount.textContent = '0'; DOM.missingFilesCountDisplay.textContent = '0';
    DOM.missingFilesList.value = ''; DOM.jsonCalibrationProgress.textContent = '获取列表...'; DOM.jsonCalibrationProgressBar.style.display = 'block'; DOM.jsonCalibrationProgressBar.value = 0;
    displayToast("开始 JSON 校准...", CLASS_NAMES.INFO, 2000);

    try {
        let actualFilePaths = new Set(); console.log("[DEBUG] JSON 校准: 获取列表..."); displayToast("获取列表...", CLASS_NAMES.INFO, 3000);
        try {
            const data = await fetchJsonData(API_ENDPOINTS.LOCAL_IMAGES);
            if (Array.isArray(data)) { data.forEach(img => { if(img?.urlPath) actualFilePaths.add(img.urlPath); }); console.log(`[DEBUG] JSON 校准: 获取 ${actualFilePaths.size} 实际路径。`); }
            else { throw new Error("API 未返回列表"); }
            if (actualFilePaths.size === 0) console.warn("[DEBUG] JSON 校准: 实际文件列表为空！");
        } catch (err) { console.error("[DEBUG] JSON 校准: 获取列表失败:", err); displayToast(`获取列表失败: ${err.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); AppState.isJsonCalibrationRunning = false; DOM.startJsonCalibration.disabled = false; DOM.jsonCalibrationProgress.textContent = '错误'; return; }
        DOM.jsonFilesCheckedCount.textContent = actualFilePaths.size.toString();

        const jsonEntries = AppState.savedEntries || []; const totalJson = jsonEntries.length; DOM.jsonCalibrationProgressBar.max = totalJson;
        let checkedJson = 0, missingCount = 0; const missingDetails = [];
        DOM.jsonCalibrationProgress.textContent = `检查 0 / ${totalJson} JSON 记录...`; console.log("[DEBUG] JSON 校准: 进入循环...");

        for (const entry of jsonEntries) {
            // 可选：添加中止检查
            checkedJson++; DOM.jsonEntriesCheckedCount.textContent = checkedJson.toString(); DOM.jsonCalibrationProgress.textContent = `检查 JSON ${checkedJson}/${totalJson}: ${entry.path || '无路径'}`; DOM.jsonCalibrationProgressBar.value = checkedJson;
            if (!entry?.path) { console.warn("[DEBUG] JSON 校准: 跳过无路径记录:", entry); continue; }
            if (!actualFilePaths.has(entry.path)) {
                missingCount++; const fn = entry.attributes?.filename || entry.path.split('/').pop(); const ch = entry.characterName || '未知';
                missingDetails.push(`路径: ${entry.path}\n 文件名: ${fn}\n 角色: ${ch}\n GID: ${entry.gid || 'N/A'}\n`);
                jsonMissingEntries.push(entry); jsonCalibrationMissingPaths.push(entry.path); // 存储路径用于移除
                DOM.missingFilesCount.textContent = missingCount.toString(); DOM.missingFilesCountDisplay.textContent = missingCount.toString();
            }
            if (checkedJson % 100 === 0) await new Promise(r => setTimeout(r, 1));
        }
        console.log("[DEBUG] JSON 校准: 循环结束。");

        DOM.missingFilesList.value = missingDetails.join('\n'); DOM.jsonCalibrationProgress.textContent = `完成 ${totalJson} JSON 记录检查。`;
        if (missingCount > 0) { displayToast(`JSON 校准完成，${missingCount} 条记录文件缺失。`, CLASS_NAMES.WARNING, DELAYS.TOAST_ERROR_DURATION); DOM.removeMissingEntriesBtn.disabled = false; DOM.removeMissingEntriesBtn.classList.remove('disabled'); }
        else { displayToast("JSON 校准完成，文件完整！", CLASS_NAMES.SUCCESS); }
    } catch (e) { console.error("[DEBUG] JSON 校准失败:", e); displayToast(`JSON 校准失败: ${e.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); DOM.jsonCalibrationProgress.textContent = '出错!'; if (jsonMissingEntries.length > 0) { DOM.removeMissingEntriesBtn.disabled = false; DOM.removeMissingEntriesBtn.classList.remove('disabled'); } }
    finally { console.log("[DEBUG] JSON 校准: finally。"); AppState.isJsonCalibrationRunning = false; DOM.startJsonCalibration.disabled = false; }
}

async function handleRemoveMissingEntries() {
    if (!DOM.removeMissingEntriesBtn || DOM.removeMissingEntriesBtn.disabled) return;
    if (jsonMissingEntries.length === 0) { displayToast("无缺失记录。", CLASS_NAMES.INFO); return; }
    const confirmed = confirm(`警告：将从 ImageData.json 永久删除 ${jsonMissingEntries.length} 条记录！\n此操作不可逆！\n\n确定删除？`);
    if (!confirmed) { displayToast("移除取消。", CLASS_NAMES.INFO); return; }
    DOM.removeMissingEntriesBtn.disabled = true; DOM.removeMissingEntriesBtn.classList.add('disabled'); DOM.startJsonCalibration.disabled = true;
    displayToast("移除记录中 (待实现)...", CLASS_NAMES.INFO);
    console.error("JSON 校准 - 移除缺失条目功能尚未实现！"); displayToast("错误：移除 JSON 记录未实现！", CLASS_NAMES.ERROR);

    try {
        console.log(`[DEBUG] 准备移除 ${jsonCalibrationMissingPaths.length} 条记录...`);
        const pathsToRemoveSet = new Set(jsonCalibrationMissingPaths);
        // 从 AppState.savedEntries 过滤掉需要移除的条目
        const updatedEntries = AppState.savedEntries.filter(entry => !pathsToRemoveSet.has(entry.path));
        console.log(`[DEBUG] 过滤后剩余 ${updatedEntries.length} 条记录。`);

        // 确保 updateUserData 函数存在
        if (typeof updateUserData !== 'function') throw new Error("updateUserData 函数未定义！");

        // 调用 updateUserData 保存更新后的数据
        const success = await updateUserData(updatedEntries, `成功移除 ${jsonCalibrationMissingPaths.length} 条缺失文件记录`, 'toast', false);

        if (success) {
            displayToast(`成功移除 ${jsonCalibrationMissingPaths.length} 条记录！`, CLASS_NAMES.SUCCESS, DELAYS.MESSAGE_CLEAR);
            // 更新 UI
            DOM.missingFilesList.value = '';
            DOM.missingFilesCount.textContent = '0';
            DOM.missingFilesCountDisplay.textContent = '0';
            jsonMissingEntries = []; // 清空缓存
            jsonCalibrationMissingPaths = [];
            DOM.removeMissingEntriesBtn.disabled = true; // 禁用按钮
            DOM.removeMissingEntriesBtn.classList.add('disabled');
            // 可能需要更新其他地方的计数，例如 Data List
            if (typeof updateEntryCount === "function") updateEntryCount();
             const dataListPaneActive = DOM.dataListPane?.classList.contains(CLASS_NAMES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") { applyFiltersAndRenderDataList(); }

        } else {
             console.error("JSON 校准: updateUserData 返回失败。");
             // Toast 应该由 updateUserData 显示
             DOM.removeMissingEntriesBtn.disabled = false; // 允许重试
             DOM.removeMissingEntriesBtn.classList.remove('disabled');
        }
    } catch (error) {
        console.error("JSON 校准: 移除记录时出错:", error);
        displayToast(`移除记录出错: ${error.message}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.removeMissingEntriesBtn.disabled = false; // 允许重试
        DOM.removeMissingEntriesBtn.classList.remove('disabled');
    } finally {
        DOM.startJsonCalibration.disabled = false; // 最终启用开始按钮
    }
    // DOM.startJsonCalibration.disabled = false; // 操作完成后启用开始按钮
}


// --------------------------------------------------------------------------
// Web Worker 交互 
// --------------------------------------------------------------------------
function initializeSearchWorker() { if (typeof Worker === 'undefined') { console.warn("Worker: 不支持。"); return; } if (!AppState.allGalleryImages?.length) { console.warn("Worker: 图库数据未加载。"); return; } if (AppState.backgroundWorker) { console.log("Worker: 终止旧实例..."); AppState.backgroundWorker.terminate(); AppState.backgroundWorker = null; } try { console.log("Worker: 创建..."); AppState.backgroundWorker = new Worker('searchworker.js'); AppState.backgroundWorker.onmessage = handleWorkerMessage; AppState.backgroundWorker.onerror = handleWorkerError; console.log("Worker: 发送数据..."); AppState.backgroundWorker.postMessage({ type: 'loadData', payload: { availableImages: AppState.allGalleryImages || [], existingPaths: Array.from(AppState.savedImagePaths) } }); if (DOM.searchInput) { DOM.searchInput.disabled = false; DOM.searchInput.placeholder = DOM.searchInput.placeholder.replace("加载中...", `搜索 ${AppState.allGalleryImages.length} 张...`); console.log("Worker: 初始化成功。"); } } catch (error) { console.error("Worker: 创建失败:", error); displayToast("后台搜索初始化失败", CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); AppState.backgroundWorker = null; if (DOM.searchInput) { DOM.searchInput.disabled = true; DOM.searchInput.placeholder = "搜索故障"; } } }
function handleWorkerMessage(event) { if (!event.data?.type) { console.warn("Worker: 无效消息:", event.data); return; } const { type, payload } = event.data; console.debug('[主] Worker 消息:', type, payload ? '(有 payload)' : ''); switch (type) { case 'searchResults': if (payload?.query === AppState.lastQuerySentToWorker) { console.log(`[主] 收到查询 "${payload.query}" 结果 (${payload.results?.length || 0} 条)`); showSuggestions(payload.results || [], false); } else { console.debug(`[主] 忽略过时结果 (查询: ${payload?.query}, 期望: ${AppState.lastQuerySentToWorker})`); } break; case 'siblingResults': if (payload && Array.isArray(payload.results)) { console.log(`[主] 收到相关图片 (${payload.results.length} 条)`); showSuggestions(payload.results || [], false); } else { console.warn("[主] 相关结果格式无效:", payload); } break; case 'dataLoaded': console.log("Worker: 确认数据加载。"); break; case 'error': console.error("Worker: 报告错误:", payload?.message, payload?.error); displayToast(`后台搜索出错: ${payload?.message || '未知'}`, CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); if (DOM.searchInput) { DOM.searchInput.disabled = true; DOM.searchInput.placeholder = "搜索故障"; } break; default: console.warn("[主] 未知 Worker 消息:", type, payload); } }
function handleWorkerError(error) { console.error('[主] Worker 严重错误:', error.message, error.filename, error.lineno, error); displayToast('后台搜索严重错误，已禁用', CLASS_NAMES.ERROR, DELAYS.TOAST_ERROR_DURATION); if (DOM.searchInput) { DOM.searchInput.disabled = true; DOM.searchInput.placeholder = "搜索已禁用"; } if (AppState.backgroundWorker) { AppState.backgroundWorker.terminate(); AppState.backgroundWorker = null; } }
function processSearch(query) { AppState.lastQuerySentToWorker = query; if (AppState.backgroundWorker) { console.debug(`Worker: 发送搜索: "${query}"`); AppState.backgroundWorker.postMessage({ type: 'search', payload: { query: query } }); } else { console.warn("Worker: 不可用。"); displayToast('后台搜索不可用', CLASS_NAMES.WARNING); showSuggestions([]); } }
function handleGlobalClick(event) { const target = event.target; if (DOM.suggestionList && !DOM.suggestionList.classList.contains(CLASS_NAMES.HIDDEN)) { const isClickInside = DOM.searchInput === target || DOM.suggestionList.contains(target); if (!isClickInside) { console.debug("全局点击: Generator 外部，隐藏。"); DOM.suggestionList.classList.add(CLASS_NAMES.HIDDEN); AppState.showingRelatedImages = false; AppState.isShowingFolderSuggestions = false; } } if (DOM.tempImageSuggestions && !DOM.tempImageSuggestions.classList.contains(CLASS_NAMES.HIDDEN)) { const isClickInside = DOM.tempImageSearchInput === target || DOM.tempImageSuggestions.contains(target); if (!isClickInside) { console.debug("全局点击: Import 图片外部，隐藏。"); DOM.tempImageSuggestions.classList.add(CLASS_NAMES.HIDDEN); } } if (DOM.targetFolderSuggestions && !DOM.targetFolderSuggestions.classList.contains(CLASS_NAMES.HIDDEN)) { const isClickInside = DOM.targetFolderSearchInput === target || DOM.targetFolderSuggestions.contains(target); if (!isClickInside) { console.debug("全局点击: Import 文件夹外部，隐藏。"); DOM.targetFolderSuggestions.classList.add(CLASS_NAMES.HIDDEN); } } }
function setupGlobalEventListeners() { document.addEventListener('click', handleGlobalClick); console.log("全局事件: 全局点击监听器设置。"); }

// --------------------------------------------------------------------------
// 事件监听器设置 (合并所有 GuTools 内部监听器)
// --------------------------------------------------------------------------
/**
 * 设置 GuTools 面板所有内部功能的事件监听器。
 */
function setupGuToolsEventListeners() {
    console.log("[DEBUG] setupGuToolsEventListeners 开始执行...");
    // --- Generator ---
    if (DOM.searchInput) { DOM.searchInput.removeEventListener('focus', handleGeneratorSearchFocus); DOM.searchInput.removeEventListener('input', handleGeneratorSearchInput); DOM.searchInput.removeEventListener('click', handleGeneratorSearchFocus); DOM.searchInput.addEventListener('focus', handleGeneratorSearchFocus); DOM.searchInput.addEventListener('input', handleGeneratorSearchInput); DOM.searchInput.addEventListener('click', handleGeneratorSearchFocus); } else { console.error("Generator: searchInput 未找到。"); }
    if (DOM.saveButton) { DOM.saveButton.removeEventListener('click', saveEntry); DOM.saveButton.addEventListener('click', saveEntry); } else { console.error("Generator: saveButton 未找到。"); }
    const attributeControls = [ ...(DOM.ratingRadios || []), ...(DOM.layoutRadios || []), DOM.isEasterEggCheckbox, DOM.isAiImageCheckbox ]; attributeControls.forEach(c => { if (c) { c.removeEventListener('change', updateSaveButtonState); c.addEventListener('change', updateSaveButtonState); } });
    console.log("Generator: 监听器 OK。");

    // --- Import ---
    if (DOM.tempImageSearchInput) { const showTempList = () => { if (AppState.currentGuToolMode !== 'import' || DOM.tempImageSearchInput.disabled || DOM.tempImageSearchInput.readOnly === false) return; if (AppState.tempImagesList?.length > 0) { showTempImageSuggestions(AppState.tempImagesList); } else if (DOM.tempImageSuggestions) { DOM.tempImageSuggestions.classList.add(CLASS_NAMES.HIDDEN); } }; DOM.tempImageSearchInput.removeEventListener('focus', showTempList); DOM.tempImageSearchInput.removeEventListener('click', showTempList); DOM.tempImageSearchInput.addEventListener('focus', showTempList); DOM.tempImageSearchInput.addEventListener('click', showTempList); } else { console.error("Import: tempImageSearchInput 未找到。"); }
    if (DOM.targetFolderSearchInput) { DOM.targetFolderSearchInput.removeEventListener('input', handleTargetFolderInput); DOM.targetFolderSearchInput.removeEventListener('blur', handleTargetFolderBlur); DOM.targetFolderSearchInput.removeEventListener('keydown', handleTargetFolderKeyDown); DOM.targetFolderSearchInput.addEventListener('input', handleTargetFolderInput); DOM.targetFolderSearchInput.addEventListener('blur', handleTargetFolderBlur); DOM.targetFolderSearchInput.addEventListener('keydown', handleTargetFolderKeyDown); } else { console.error("Import: targetFolderSearchInput 未找到。"); }
    if (DOM.editFilenameButton && DOM.finalFilenameInput) { const hEC = () => { DOM.finalFilenameInput.readOnly = false; DOM.finalFilenameInput.classList.add(CLASS_NAMES.EDITABLE); DOM.finalFilenameInput.focus(); DOM.finalFilenameInput.setSelectionRange(DOM.finalFilenameInput.value.length, DOM.finalFilenameInput.value.length); }; const hFB = () => { if (DOM.finalFilenameInput.classList.contains(CLASS_NAMES.EDITABLE)) { DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); } }; const hFK = (e) => { if (DOM.finalFilenameInput.classList.contains(CLASS_NAMES.EDITABLE)) { if (e.key === 'Enter') { e.preventDefault(); DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); DOM.finalFilenameInput.blur(); } else if (e.key === 'Escape') { const sF = `${AppState.suggestedFilenameBase}${AppState.suggestedFilenameNum}${AppState.suggestedFilenameExt}`; DOM.finalFilenameInput.value = sF; DOM.finalFilenameInput.readOnly = true; DOM.finalFilenameInput.classList.remove(CLASS_NAMES.EDITABLE); DOM.finalFilenameInput.blur(); } } }; DOM.editFilenameButton.removeEventListener('click', hEC); DOM.finalFilenameInput.removeEventListener('blur', hFB); DOM.finalFilenameInput.removeEventListener('keydown', hFK); DOM.editFilenameButton.addEventListener('click', hEC); DOM.finalFilenameInput.addEventListener('blur', hFB); DOM.finalFilenameInput.addEventListener('keydown', hFK); } else { console.error("Import: finalFilenameInput 或 editFilenameButton 未找到。"); }
    if (DOM.addToGalleryButton) { DOM.addToGalleryButton.removeEventListener('click', handleAddToGallery); DOM.addToGalleryButton.addEventListener('click', handleAddToGallery); } else { console.error("Import: addToGalleryButton 未找到。"); }
    console.log("Import: 监听器 OK。");

    // --- MD5 校准 ---
    if (DOM.startMD5Calibration) { DOM.startMD5Calibration.removeEventListener('click', handleStartMD5Calibration); DOM.startMD5Calibration.addEventListener('click', handleStartMD5Calibration); } else { console.error("MD5 校准: startMD5Calibration 未找到！"); }
    if (DOM.abortMD5Calibration) { DOM.abortMD5Calibration.removeEventListener('click', handleAbortMD5Calibration); DOM.abortMD5Calibration.addEventListener('click', handleAbortMD5Calibration); } else { console.error("MD5 校准: abortMD5Calibration 未找到。"); }
    if (DOM.fixAllMismatchedMD5) { DOM.fixAllMismatchedMD5.removeEventListener('click', handleFixAllMismatches); DOM.fixAllMismatchedMD5.addEventListener('click', handleFixAllMismatches); } else { console.error("MD5 校准: fixAllMismatchedMD5 未找到。"); }
    console.log("MD5 校准: 监听器 OK。");

    // --- 序号管理 ---
    if (DOM.analyzeSequences) { DOM.analyzeSequences.removeEventListener('click', handleAnalyzeSequences); DOM.analyzeSequences.addEventListener('click', handleAnalyzeSequences); } else { console.error("序号管理: analyzeSequences 未找到。"); }
    if (DOM.fixSequenceIssues) { DOM.fixSequenceIssues.removeEventListener('click', handleFixSequenceIssues); DOM.fixSequenceIssues.addEventListener('click', handleFixSequenceIssues); } else { console.error("序号管理: fixSequenceIssues 未找到。"); }
    console.log("序号管理: 监听器 OK。");

    // --- JSON 校准 (新增) ---
    if (DOM.startJsonCalibration) { DOM.startJsonCalibration.removeEventListener('click', handleJsonCalibration); DOM.startJsonCalibration.addEventListener('click', handleJsonCalibration); } else { console.error("JSON 校准: startJsonCalibration 未找到！"); }
    if (DOM.removeMissingEntriesBtn) { DOM.removeMissingEntriesBtn.removeEventListener('click', handleRemoveMissingEntries); DOM.removeMissingEntriesBtn.addEventListener('click', handleRemoveMissingEntries); } else { console.error("JSON 校准: removeMissingEntriesBtn 未找到！"); }
    console.log("JSON 校准: 监听器 OK。");

    console.log("GuTools 所有内部事件监听器设置完成。");
}

// 依赖函数需在其他文件定义或在此文件内实现。