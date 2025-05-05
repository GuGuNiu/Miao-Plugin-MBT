// ==========================================================================
// GuTools 图片入库: 处理从临时目录选择图片 设置属性 命名并添加到主图库
// ==========================================================================

/**
 * 确保图片入库所需的基础数据 临时图片列表 角色文件夹列表 已加载
 */
async function ensureImportDataLoaded() {
    // 如果数据已加载 只需更新输入框占位符即可
    if (AppState.importer.dataLoaded) {
        console.log("Importer: 数据已加载 更新输入框状态");
        updateImportInputPlaceholders(); // 更新函数现在在此模块中
        // 移除仓库选择的填充
        return;
    }

    console.log("Importer: 首次加载数据...");
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载待入库图片...';
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载目标文件夹...';
    // 移除仓库选择的禁用
    disableImportFormSections(); // 禁用表单的后续部分

    try {
        if (typeof fetchCharacterFolders !== 'function') {
            console.warn("Importer: fetchCharacterFolders 函数未在 Core.js 定义 将无法获取文件夹列表");
        }

        const results = await Promise.allSettled([
            fetchTempImages(), // 获取临时图片
            typeof fetchCharacterFolders === 'function' ? fetchCharacterFolders() : Promise.resolve() // 获取角色文件夹
        ]);

        const tempImagesResult = results[0];
        const foldersResult = results[1];

        if (tempImagesResult.status === 'rejected') {
            console.error("Importer: 加载待入库图片列表失败:", tempImagesResult.reason);
            displayToast("加载待入库图片失败", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
            if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载失败';
        }

        if (foldersResult.status === 'rejected') {
             console.error("Importer: 加载角色文件夹列表失败:", foldersResult.reason);
             displayToast("加载目标文件夹列表失败", UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION);
             if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载失败 可手动输入';
        } else if (foldersResult.status === 'fulfilled' && typeof fetchCharacterFolders === 'function'){
             console.log(`Importer: 成功加载 ${AppState.importer.characterFoldersList.length} 个目标文件夹`);
        }

        AppState.importer.dataLoaded = true;
        console.log("Importer: 数据加载过程完成");

        updateImportInputPlaceholders(); // 更新输入框状态

        // 移除仓库选择的填充和启用

        if (AppState.importer.selectedTempImageInfo) {
            enableImportFormSections();
        }

    } catch (error) {
        console.error("Importer: 加载数据时发生意外错误:", error);
        displayToast("加载入库数据时发生意外错误", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载异常';
        if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载异常';
    }
}


/**
 * 从后端获取待入库图片列表 imgtemp 目录
 * @returns {Promise<void>}
 */
async function fetchTempImages() {
    if (!DOM.importerTempImageSearchInput) return;
    DOM.importerTempImageSearchInput.disabled = true;
    DOM.importerTempImageSearchInput.placeholder = '正在加载待入库...';
    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_TEMP_IMAGES);
        AppState.importer.tempImagesList = Array.isArray(data) ? data : [];
        console.log(`Importer: 加载了 ${AppState.importer.tempImagesList.length} 张待入库图片`);
        if (AppState.importer.tempImagesList.length === 0) {
            displayImportMessage("提示：imgtemp 目录是空的 没有待入库的图片", UI_CLASSES.INFO);
        } else {
            if (DOM.importerMessageArea?.textContent.includes("空的")) {
                hideImportMessage();
            }
        }
    } catch (error) {
        console.error("Importer: 加载待入库图片列表失败:", error);
        DOM.importerTempImageSearchInput.placeholder = '加载失败';
        AppState.importer.tempImagesList = [];
        throw error;
    } finally {
        updateImportInputPlaceholders();
    }
}


/**
 * 更新导入功能中输入框的占位符和状态
 */
function updateImportInputPlaceholders() {
    if (DOM.importerTempImageSearchInput) {
        const hasTempImages = AppState.importer.tempImagesList?.length > 0;
        DOM.importerTempImageSearchInput.disabled = !hasTempImages;
        DOM.importerTempImageSearchInput.readOnly = hasTempImages;
        DOM.importerTempImageSearchInput.style.cursor = hasTempImages ? 'pointer' : 'default';
        DOM.importerTempImageSearchInput.placeholder = hasTempImages
            ? `点击选择 ${AppState.importer.tempImagesList.length} 张待入库`
            : 'imgtemp 目录为空';
    }
    if (DOM.importerTargetFolderSearchInput) {
        const characterFolders = AppState.importer.characterFoldersList;
        DOM.importerTargetFolderSearchInput.placeholder = characterFolders.length > 0
            ? `搜索 ${characterFolders.length} 个文件夹或输入新名称...`
            : '输入新文件夹名称...';
        DOM.importerTargetFolderSearchInput.disabled = !AppState.importer.selectedTempImageInfo;
    }
    // 移除对 importerStorageBoxSelect 的处理
}

/**
 * 显示待入库图片的建议列表
 * @param {Array<object>} imageList 包含图片信息的数组 {filename, path}
 */
function displayTempImageSuggestions(imageList) {
    if (!DOM.importerTempImageSuggestions) { console.error("Importer: 待入库图片建议列表 DOM 元素未找到！"); return; }
    const suggestionList = DOM.importerTempImageSuggestions;
    suggestionList.innerHTML = '';
    if (!Array.isArray(imageList)) { console.error("Importer: displayTempImageSuggestions 接收到无效的 imageList:", imageList); suggestionList.classList.add(UI_CLASSES.HIDDEN); return; }
    console.log(`Importer: 显示 ${imageList.length} 条待入库图片建议`);
    if (imageList.length === 0) { suggestionList.classList.add(UI_CLASSES.HIDDEN); return; }
    const fragment = document.createDocumentFragment();
    imageList.slice(0, 20).forEach(imgInfo => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion';
        item.textContent = imgInfo.filename;
        item.title = imgInfo.path;
        item.onclick = () => selectTemporaryImage(imgInfo);
        fragment.appendChild(item);
    });
    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN);
    console.log("Importer: 待入库图片建议列表已显示");
}


/**
 * 显示目标文件夹的建议列表
 * @param {Array<string>} folderList 文件夹名称数组
 */
function displayTargetFolderSuggestions(folderList) {
    if (!DOM.importerTargetFolderSuggestions || !DOM.importerTargetFolderSearchInput) return;
    const suggestionList = DOM.importerTargetFolderSuggestions;
    suggestionList.innerHTML = '';
    if (!folderList || folderList.length === 0) { suggestionList.classList.add(UI_CLASSES.HIDDEN); return; }
    const fragment = document.createDocumentFragment();
    folderList.slice(0, 10).forEach(folderName => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion';
        item.textContent = folderName;
        item.onclick = () => selectTargetFolder(folderName);
        fragment.appendChild(item);
    });
    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN);
}

/**
 * 处理用户选择待入库图片的操作
 * @param {object} imageInfo 被选中的图片信息 {filename, path}
 */
function selectTemporaryImage(imageInfo) {
    if (!imageInfo?.path || !imageInfo.filename) { console.error("Importer: selectTemporaryImage 接收到无效的 imageInfo:", imageInfo); return; }
    console.log("Importer: 选择待入库图片:", imageInfo.filename);
    AppState.importer.selectedTempImageInfo = imageInfo;
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.value = imageInfo.filename;
    if (DOM.importerTempImagePreview) {
        const preview = DOM.importerTempImagePreview;
        const imageUrl = imageInfo.path.startsWith('/') ? imageInfo.path : `/${imageInfo.path}`;
        preview.src = ""; preview.alt = "加载中..."; preview.classList.remove(UI_CLASSES.HIDDEN);
        preview.onerror = () => { console.error("Importer: 预览图片加载失败:", imageUrl); displayToast(`预览 "${imageInfo.filename}" 失败`, UI_CLASSES.ERROR); preview.classList.add(UI_CLASSES.HIDDEN); preview.src = ""; preview.alt = "加载失败"; AppState.importer.selectedTempImageInfo = null; disableImportFormSections(); };
        preview.onload = () => { preview.alt = imageInfo.filename; };
        preview.src = imageUrl;
    }
    if (DOM.importerTempImageSuggestions) DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);
    enableImportFormSections();
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = '';
    if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '';
    AppState.importer.selectedTargetFolder = null;
    // 移除: AppState.importer.selectedStorageBox = null;
    // 移除: if (DOM.importerStorageBoxSelect) DOM.importerStorageBoxSelect.selectedIndex = 0;
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
}

/**
 * 处理用户选择目标文件夹的操作 点击建议或手动输入后
 * @param {string} folderName 选定的目标文件夹名称
 */
async function selectTargetFolder(folderName) {
    folderName = folderName.trim();
    if (!folderName) { console.warn("Importer: 尝试选择空的文件夹名称"); return; }

    // 移除仓库选择检查

    console.log(`Importer: 选择目标文件夹: ${folderName}`);
    AppState.importer.selectedTargetFolder = folderName;
    // 移除: AppState.importer.selectedStorageBox = selectedStorageBox;

    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = folderName;
    if (DOM.importerTargetFolderSuggestions) DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);

    if (DOM.importerFinalFilenameInput) { DOM.importerFinalFilenameInput.value = '获取编号中...'; DOM.importerFinalFilenameInput.readOnly = true; DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); }
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;

    if (!AppState.importer.selectedTempImageInfo?.filename) { displayToast('错误：请先选择要入库的图片', UI_CLASSES.ERROR); if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '错误：未选图'; return; }

    try {
        // API 调用只传递 folder 参数
        const url = `${API_ENDPOINTS.FETCH_LAST_FILE_NUMBER}?folder=${encodeURIComponent(folderName)}`;
        const data = await fetchJsonData(url);

        if (data && typeof data.lastNumber === 'number') {
            const nextNumber = data.lastNumber + 1;
            AppState.importer.suggestedFilenameNum = nextNumber;
            AppState.importer.suggestedFilenameBase = folderName + 'Gu';
            const match = AppState.importer.selectedTempImageInfo.filename.match(/\.[^.]+$/);
            AppState.importer.suggestedFilenameExt = match ? match[0] : '.webp';
            const finalFilename = `${AppState.importer.suggestedFilenameBase}${nextNumber}${AppState.importer.suggestedFilenameExt}`;
            if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = finalFilename;
            if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = false;
            if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.remove(UI_CLASSES.HIDDEN);
            console.log(`Importer: 建议的文件名为: ${finalFilename}`);
        } else { throw new Error(data?.error || '获取到的文件编号数据无效'); }
    } catch (error) {
        console.error(`Importer: 获取文件夹 '${folderName}' 的最大编号失败:`, error);
        displayToast(`获取文件编号失败: ${error.message}`, UI_CLASSES.ERROR);
        if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '获取编号失败';
        if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
        if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    }
}

/**
 * 启用导入表单的后续部分 属性 目标文件夹 命名等
 */
function enableImportFormSections() {
    if (DOM.importerAttributesPanel) {
        DOM.importerAttributesPanel.classList.remove(UI_CLASSES.HIDDEN, UI_CLASSES.INITIALLY_HIDDEN);
    }
    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.disabled = false;
    }
    // 移除对 importerStorageBoxSelect 的处理
    const namingSection = DOM.importPaneView?.querySelector('.naming-section');
    if (namingSection) {
        namingSection.classList.add(UI_CLASSES.ACTIVE);
    }
    console.debug("Importer: 表单后续部分已启用");
}

/**
 * 禁用导入表单的后续部分
 */
function disableImportFormSections() {
    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.disabled = true;
    }
    // 移除对 importerStorageBoxSelect 的处理
    const namingSection = DOM.importPaneView?.querySelector('.naming-section');
    if (namingSection) {
        namingSection.classList.remove(UI_CLASSES.ACTIVE);
    }
    if (DOM.importerFinalFilenameInput) {
        DOM.importerFinalFilenameInput.value = '';
        DOM.importerFinalFilenameInput.readOnly = true;
        DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
    }
    if (DOM.importerEditFilenameButton) {
        DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    }
    if (DOM.importerAddToGalleryButton) {
        DOM.importerAddToGalleryButton.disabled = true;
    }
    console.debug("Importer: 表单后续部分已禁用");
}

/**
 * 处理点击 "添加到图库" 按钮的操作
 */
async function addImportedImageToGallery() {
    // 移除对 selectedStorageBox 的检查
    if (!AppState.importer.selectedTempImageInfo || !AppState.importer.selectedTargetFolder ||
        !DOM.importerFinalFilenameInput || !DOM.importerAddToGalleryButton || !DOM.importerMessageArea)
    {
        console.warn("Importer: 添加到图库的条件未满足 图片 文件夹 文件名等信息不全");
        displayImportMessage("错误：请确保已选择图片 目标文件夹并生成了文件名", UI_CLASSES.ERROR);
        return;
    }

    hideImportMessage();
    const finalName = DOM.importerFinalFilenameInput.value.trim();
    const tempPath = AppState.importer.selectedTempImageInfo.path;
    const targetFolder = AppState.importer.selectedTargetFolder;
    // 移除: const targetStorageBox = AppState.importer.selectedStorageBox;

    if (!finalName) { displayImportMessage("错误：最终文件名不能为空", UI_CLASSES.ERROR); return; }
    if (/[\\/:"*?<>|]/.test(finalName)) { displayImportMessage("错误：文件名包含非法字符 \\ / : * ? \" < > |", UI_CLASSES.ERROR); return; }

    const ratingInput = document.querySelector('input[name="importRating"]:checked');
    const layoutInput = document.querySelector('input[name="importLayout"]:checked');
    const isEasterEgg = DOM.importerIsEasterEggCheckbox?.checked ?? false;
    const isAiImage = DOM.importerIsAiImageCheckbox?.checked ?? false;
    const downloadSource = DOM.importerDownloadSourceInput?.value.trim() || 'none';

    if (!ratingInput || !layoutInput) { displayImportMessage("错误：无法读取限制级或构图属性", UI_CLASSES.ERROR); return; }
    const rating = ratingInput.value || 'none';
    const layout = layoutInput.value || 'normal';

    DOM.importerAddToGalleryButton.disabled = true;
    displayImportMessage("正在添加入库...", UI_CLASSES.INFO);

    // 准备发送到后端的数据 (移除 storageBox)
    const importDataPayload = {
        tempImagePath: tempPath,
        targetFolder: targetFolder,
        targetFilename: finalName,
        attributes: { isPx18: rating === 'px18', isRx18: rating === 'rx18', layout: layout, isEasterEgg: isEasterEgg, isAiImage: isAiImage, isBan: false, Downloaded_From: downloadSource }
    };

    console.log("Importer: 发送入库请求到后端:", importDataPayload);

    try {
        const result = await fetchJsonData(API_ENDPOINTS.IMPORT_IMAGE_TO_GALLERY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importDataPayload)
        });

        if (result?.success === true && result.newEntry?.path) {
            console.log("Importer: 图片入库成功 后端返回新条目:", result.newEntry);
            // newEntry 中应包含后端确定的 storagebox
            displayImportMessage(`成功添加 "${finalName}" 到图库 ${result.newEntry.storagebox || ''}！`, UI_CLASSES.SUCCESS);

            AppState.userData.push(result.newEntry);
            // 构建完整路径添加到 Set (使用返回的 storagebox)
            const fullWebPath = buildFullWebPath(result.newEntry.storagebox, result.newEntry.path);
            if(fullWebPath) AppState.userDataPaths.add(fullWebPath);

            if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
            if (typeof updateDataListCount === "function") updateDataListCount();

            const dataListPaneActive = DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") {
                console.log("Importer: 数据列表可见 正在刷新...");
                applyFiltersAndRenderDataList();
            }
            await fetchTempImages();
            resetImportForm();
        } else {
            throw new Error(result?.error || "图片入库失败 服务器未返回成功信息或有效数据");
        }
    } catch (error) {
        console.error("Importer: 添加到图库失败:", error);
        displayImportMessage(`添加入库失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.importerAddToGalleryButton.disabled = false;
    }
}

/**
 * 处理点击 "添加到图库" 按钮的操作
 */
async function addImportedImageToGallery() {
    // 检查必要的状态和 DOM 元素 包括仓库选择
    if (!AppState.importer.selectedTempImageInfo || !AppState.importer.selectedTargetFolder ||
        !AppState.importer.selectedStorageBox || // 检查仓库是否已选
        !DOM.importerFinalFilenameInput || !DOM.importerAddToGalleryButton || !DOM.importerMessageArea)
    {
        console.warn("Importer: 添加到图库的条件未满足 图片 文件夹 仓库 文件名等信息不全");
        displayImportMessage("错误：请确保已选择图片 目标仓库 目标文件夹并生成了文件名", UI_CLASSES.ERROR);
        return;
    }

    hideImportMessage();

    const finalName = DOM.importerFinalFilenameInput.value.trim();
    const tempPath = AppState.importer.selectedTempImageInfo.path;
    const targetFolder = AppState.importer.selectedTargetFolder;
    const targetStorageBox = AppState.importer.selectedStorageBox; // 获取选中的仓库

    if (!finalName) {
        displayImportMessage("错误：最终文件名不能为空", UI_CLASSES.ERROR);
        return;
    }
    if (/[\\/:"*?<>|]/.test(finalName)) {
        displayImportMessage("错误：文件名包含非法字符 \\ / : * ? \" < > |", UI_CLASSES.ERROR);
        return;
    }

    const ratingInput = document.querySelector('input[name="importRating"]:checked');
    const layoutInput = document.querySelector('input[name="importLayout"]:checked');
    const isEasterEgg = DOM.importerIsEasterEggCheckbox?.checked ?? false;
    const isAiImage = DOM.importerIsAiImageCheckbox?.checked ?? false;
    const downloadSource = DOM.importerDownloadSourceInput?.value.trim() || 'none';

    if (!ratingInput || !layoutInput) {
        displayImportMessage("错误：无法读取限制级或构图属性", UI_CLASSES.ERROR);
        return;
    }

    const rating = ratingInput.value || 'none';
    const layout = layoutInput.value || 'normal';

    DOM.importerAddToGalleryButton.disabled = true;
    displayImportMessage("正在添加入库...", UI_CLASSES.INFO);

    // 准备发送到后端的数据 包含 storagebox
    const importDataPayload = {
        tempImagePath: tempPath,
        targetFolder: targetFolder,
        targetFilename: finalName,
        storagebox: targetStorageBox, // 添加仓库信息
        attributes: {
            isPx18: rating === 'px18',
            isRx18: rating === 'rx18',
            layout: layout,
            isEasterEgg: isEasterEgg,
            isAiImage: isAiImage,
            isBan: false,
            Downloaded_From: downloadSource
        }
    };

    console.log("Importer: 发送入库请求到后端:", importDataPayload);

    try {
        const result = await fetchJsonData(API_ENDPOINTS.IMPORT_IMAGE_TO_GALLERY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importDataPayload)
        });

        if (result?.success === true && result.newEntry?.path) {
            console.log("Importer: 图片入库成功 后端返回新条目:", result.newEntry);
            displayImportMessage(`成功添加 "${finalName}" 到图库 ${targetStorageBox}！`, UI_CLASSES.SUCCESS);

            //  更新前端状态 
            AppState.userData.push(result.newEntry);
            AppState.userDataPaths.add(result.newEntry.path); // path 包含 storagebox

            if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
            if (typeof updateDataListCount === "function") updateDataListCount();

            const dataListPaneActive = DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") {
                console.log("Importer: 数据列表可见 正在刷新...");
                applyFiltersAndRenderDataList();
            }

            await fetchTempImages(); // 重新加载临时图片列表

            resetImportForm(); // 重置导入表单

        } else {
            throw new Error(result?.error || "图片入库失败 服务器未返回成功信息或有效数据");
        }
    } catch (error) {
        console.error("Importer: 添加到图库失败:", error);
        displayImportMessage(`添加入库失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        DOM.importerAddToGalleryButton.disabled = false; // 允许重试
    }
}

/**
 * 重置导入表单到初始状态
 */
function resetImportForm() {
    console.log("Importer: 重置导入表单...");
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.value = '';
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = '';
    // 移除对 importerStorageBoxSelect 的重置
    if (DOM.importerFinalFilenameInput) { DOM.importerFinalFilenameInput.value = ''; DOM.importerFinalFilenameInput.readOnly = true; DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); }
     if (DOM.importerDownloadSourceInput) DOM.importerDownloadSourceInput.value = '';
    if (DOM.importerTempImagePreview) { DOM.importerTempImagePreview.onerror = null; DOM.importerTempImagePreview.src = ''; DOM.importerTempImagePreview.alt = '待入库图片预览'; DOM.importerTempImagePreview.classList.add(UI_CLASSES.HIDDEN); }
    AppState.importer.selectedTempImageInfo = null;
    AppState.importer.selectedTargetFolder = null;
    // 移除: AppState.importer.selectedStorageBox = null;
    AppState.importer.suggestedFilenameBase = ''; AppState.importer.suggestedFilenameNum = 0; AppState.importer.suggestedFilenameExt = '';
    const defaultRatingRadio = document.querySelector('input[name="importRating"][value="none"]');
    const defaultLayoutRadio = document.querySelector('input[name="importLayout"][value="normal"]');
    if (defaultRatingRadio) defaultRatingRadio.checked = true;
    if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
    if (DOM.importerIsEasterEggCheckbox) DOM.importerIsEasterEggCheckbox.checked = false;
    if (DOM.importerIsAiImageCheckbox) DOM.importerIsAiImageCheckbox.checked = false;
    disableImportFormSections();
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
    updateImportInputPlaceholders();
    hideImportMessage();
}

/**
 * 处理目标文件夹输入框的输入事件 防抖
 */
function handleTargetFolderInput() {
    clearTimeout(AppState.importer.searchDebounceTimer);
    if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '';
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    AppState.importer.selectedTargetFolder = null;

    const query = DOM.importerTargetFolderSearchInput.value.toLowerCase().trim();
    AppState.importer.searchDebounceTimer = setTimeout(() => {
        if (query && AppState.importer.characterFoldersList.length > 0) {
            const results = AppState.importer.characterFoldersList.filter(folder =>
                folder.toLowerCase().includes(query)
            );
            displayTargetFolderSuggestions(results);
        } else if (DOM.importerTargetFolderSuggestions) {
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }, DELAYS.IMPORT_SEARCH_DEBOUNCE);
}

/**
 * 处理目标文件夹输入框失去焦点事件
 */
function handleTargetFolderBlur() {
    setTimeout(() => {
        if (DOM.importerTargetFolderSuggestions && !DOM.importerTargetFolderSuggestions.classList.contains(UI_CLASSES.HIDDEN)) { return; }
        const currentValue = DOM.importerTargetFolderSearchInput.value.trim();
        // 失焦时自动选择
        if (currentValue && currentValue !== AppState.importer.selectedTargetFolder) {
            console.log("Importer: 目标文件夹输入框失焦 自动选择:", currentValue);
            selectTargetFolder(currentValue);
        } else if (!currentValue && DOM.importerTargetFolderSuggestions) {
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }, 150);
}

/**
 * 处理目标文件夹输入框的键盘事件 Enter Escape
 * @param {KeyboardEvent} event 键盘事件对象
 */
function handleTargetFolderKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const currentValue = DOM.importerTargetFolderSearchInput.value.trim();
        // Enter 时自动选择
        if (currentValue && currentValue !== AppState.importer.selectedTargetFolder) {
            selectTargetFolder(currentValue);
            DOM.importerTargetFolderSearchInput.blur();
        }
    } else if (event.key === 'Escape') {
        if (DOM.importerTargetFolderSuggestions) {
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }
}

/**
 * 处理目标文件夹输入框失去焦点事件
 */
function handleTargetFolderBlur() {
    setTimeout(() => {
        if (DOM.importerTargetFolderSuggestions && !DOM.importerTargetFolderSuggestions.classList.contains(UI_CLASSES.HIDDEN)) { return; }
        const currentValue = DOM.importerTargetFolderSearchInput.value.trim();
        // 失焦时自动选择 不再需要检查仓库
        if (currentValue && currentValue !== AppState.importer.selectedTargetFolder) {
            console.log("Importer: 目标文件夹输入框失焦 自动选择:", currentValue);
            selectTargetFolder(currentValue);
        } else if (!currentValue && DOM.importerTargetFolderSuggestions) {
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }, 150);
}


/**
 * 处理仓库选择下拉框的 change 事件
 */
function handleStorageBoxChange() {
    const selectedStorageBox = DOM.importerStorageBoxSelect?.value;
    console.log("Importer: 仓库选择改变为:", selectedStorageBox);
    AppState.importer.selectedStorageBox = selectedStorageBox;

    // 清空目标文件夹和后续状态 让用户重新选择或输入文件夹
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = '';
    if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '';
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    AppState.importer.selectedTargetFolder = null;
    if (DOM.importerTargetFolderSuggestions) DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);

    // 如果选择了有效的仓库 聚焦到文件夹输入框
    if (selectedStorageBox && DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.focus();
    }
}


//  事件监听器设置 Importer Specific 
/**
 * 设置图片入库视图内的事件监听器
 */
function setupImporterEventListeners() {
    if (DOM.importerTempImageSearchInput) {
        const showTempImageList = () => {
            if (AppState.currentGuToolMode !== 'import' || DOM.importerTempImageSearchInput.disabled || DOM.importerTempImageSearchInput.readOnly === false) return;
            if (AppState.importer.tempImagesList?.length > 0) {
                displayTempImageSuggestions(AppState.importer.tempImagesList);
            } else if (DOM.importerTempImageSuggestions) {
                DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);
            }
        };
        DOM.importerTempImageSearchInput.removeEventListener('focus', showTempImageList);
        DOM.importerTempImageSearchInput.removeEventListener('click', showTempImageList);
        DOM.importerTempImageSearchInput.addEventListener('focus', showTempImageList);
        DOM.importerTempImageSearchInput.addEventListener('click', showTempImageList);
    } else { console.error("Importer: 待入库图片搜索框 tempImageSearchInput 未找到"); }

    // 移除对 importerStorageBoxSelect 的监听

    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.removeEventListener('input', handleTargetFolderInput);
        DOM.importerTargetFolderSearchInput.removeEventListener('blur', handleTargetFolderBlur);
        DOM.importerTargetFolderSearchInput.removeEventListener('keydown', handleTargetFolderKeyDown); // 确保这里是正确的函数名
        DOM.importerTargetFolderSearchInput.addEventListener('input', handleTargetFolderInput);
        DOM.importerTargetFolderSearchInput.addEventListener('blur', handleTargetFolderBlur);
        DOM.importerTargetFolderSearchInput.addEventListener('keydown', handleTargetFolderKeyDown); // 确保这里是正确的函数名
    } else { console.error("Importer: 目标文件夹搜索框 targetFolderSearchInput 未找到"); }

    if (DOM.importerEditFilenameButton && DOM.importerFinalFilenameInput) {
        const handleEditClick = () => { DOM.importerFinalFilenameInput.readOnly = false; DOM.importerFinalFilenameInput.classList.add(UI_CLASSES.EDITABLE); DOM.importerFinalFilenameInput.focus(); DOM.importerFinalFilenameInput.setSelectionRange(DOM.importerFinalFilenameInput.value.length, DOM.importerFinalFilenameInput.value.length); };
        const handleFilenameBlur = () => { if (DOM.importerFinalFilenameInput.classList.contains(UI_CLASSES.EDITABLE)) { DOM.importerFinalFilenameInput.readOnly = true; DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); } };
        const handleFilenameKeyDown = (e) => { if (DOM.importerFinalFilenameInput.classList.contains(UI_CLASSES.EDITABLE)) { if (e.key === 'Enter') { e.preventDefault(); DOM.importerFinalFilenameInput.readOnly = true; DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); DOM.importerFinalFilenameInput.blur(); } else if (e.key === 'Escape') { const suggestedFilename = `${AppState.importer.suggestedFilenameBase}${AppState.importer.suggestedFilenameNum}${AppState.importer.suggestedFilenameExt}`; DOM.importerFinalFilenameInput.value = suggestedFilename; DOM.importerFinalFilenameInput.readOnly = true; DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); DOM.importerFinalFilenameInput.blur(); } } };
        DOM.importerEditFilenameButton.removeEventListener('click', handleEditClick);
        DOM.importerFinalFilenameInput.removeEventListener('blur', handleFilenameBlur);
        DOM.importerFinalFilenameInput.removeEventListener('keydown', handleFilenameKeyDown);
        DOM.importerEditFilenameButton.addEventListener('click', handleEditClick);
        DOM.importerFinalFilenameInput.addEventListener('blur', handleFilenameBlur);
        DOM.importerFinalFilenameInput.addEventListener('keydown', handleFilenameKeyDown);
    } else { console.error("Importer: 最终文件名输入框 finalFilenameInput 或编辑按钮 editFilenameButton 未找到"); }

    if (DOM.importerAddToGalleryButton) {
        DOM.importerAddToGalleryButton.removeEventListener('click', addImportedImageToGallery);
        DOM.importerAddToGalleryButton.addEventListener('click', addImportedImageToGallery);
    } else { console.error("Importer: 添加到图库按钮 addToGalleryButton 未找到"); }

    console.log("Importer: 事件监听器设置完成");
}
