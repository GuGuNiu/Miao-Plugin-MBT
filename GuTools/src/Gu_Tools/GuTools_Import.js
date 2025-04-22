// ==========================================================================
// GuTools 图片入库模块: 处理从临时目录选择图片、设置属性、命名并添加到主图库。
// ==========================================================================

/**
 * 确保图片入库所需的基础数据 (临时图片列表, 角色文件夹列表) 已加载。
 * 如果未加载，则从后端获取。
 */
async function ensureImportDataLoaded() {
    // 如果数据已加载，只需更新输入框占位符即可
    if (AppState.importer.dataLoaded) {
        console.log("Importer: 数据已加载，更新输入框状态。");
        updateImportInputPlaceholders(); // 更新函数现在在此模块中
        return;
    }

    console.log("Importer: 首次加载数据...");
    // 设置输入框为加载中状态
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载待入库图片...';
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载目标文件夹...';
    disableImportFormSections(); // 禁用表单的后续部分

    try {
        // 并行获取临时图片和角色文件夹列表

        if (typeof fetchCharacterFolders !== 'function') {
            console.warn("Importer: fetchCharacterFolders 函数未在 Core.js 定义。将无法获取文件夹列表。");
        }

        // 使用 Promise.allSettled 来处理其中一个请求可能失败的情况
        const results = await Promise.allSettled([
            fetchTempImages(), // 获取临时图片
            typeof fetchCharacterFolders === 'function' ? fetchCharacterFolders() : Promise.resolve() // 获取角色文件夹 (如果函数存在)
        ]);

        // 检查结果
        const tempImagesResult = results[0];
        const foldersResult = results[1];

        if (tempImagesResult.status === 'rejected') {
            console.error("Importer: 加载待入库图片列表失败:", tempImagesResult.reason);
            displayToast("加载待入库图片失败", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
            if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载失败';
        }

        if (foldersResult.status === 'rejected') {
             console.error("Importer: 加载角色文件夹列表失败:", foldersResult.reason);
             displayToast("加载目标文件夹列表失败", UI_CLASSES.WARNING, DELAYS.TOAST_ERROR_DURATION); // 使用警告，因为可以手动输入
             if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载失败，可手动输入';
        } else if (foldersResult.status === 'fulfilled' && typeof fetchCharacterFolders === 'function'){
             // 成功获取文件夹列表后，更新 AppState (fetchCharacterFolders 内部应该已经更新了)
             console.log(`Importer: 成功加载 ${AppState.importer.characterFoldersList.length} 个目标文件夹。`);
        }

        // 标记数据已加载（即使部分失败也标记，避免重复加载）
        AppState.importer.dataLoaded = true;
        console.log("Importer: 数据加载过程完成。");

        updateImportInputPlaceholders(); // 更新输入框状态

        // 如果之前已有选中的临时图片，尝试启用后续表单部分
        if (AppState.importer.selectedTempImageInfo) {
            enableImportFormSections();
        }

    } catch (error) { // 捕获 Promise.allSettled 本身的错误 (理论上不会)
        console.error("Importer: 加载数据时发生意外错误:", error);
        displayToast("加载入库数据时发生意外错误", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.placeholder = '加载异常';
        if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.placeholder = '加载异常';
    }
}

/**
 * 从后端获取待入库图片列表 (imgtemp 目录)。
 * @returns {Promise<void>}
 */
async function fetchTempImages() {
    if (!DOM.importerTempImageSearchInput) return;

    // 暂时禁用输入框，防止用户在加载时操作
    DOM.importerTempImageSearchInput.disabled = true;
    DOM.importerTempImageSearchInput.placeholder = '正在加载待入库...';

    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_TEMP_IMAGES); // 使用 Core.js 的 fetch
        AppState.importer.tempImagesList = Array.isArray(data) ? data : []; // 更新状态
        console.log(`Importer: 加载了 ${AppState.importer.tempImagesList.length} 张待入库图片。`);

        // 检查是否有图片，并显示提示信息
        if (AppState.importer.tempImagesList.length === 0) {
            displayImportMessage("提示：imgtemp 目录是空的，没有待入库的图片。", UI_CLASSES.INFO);
        } else {
            // 如果之前显示了空目录的消息，则隐藏它
            if (DOM.importerMessageArea?.textContent.includes("空的")) {
                hideImportMessage();
            }
        }
    } catch (error) {
        console.error("Importer: 加载待入库图片列表失败:", error);
        // displayToast 已在 ensureImportDataLoaded 中处理，这里只更新状态
        DOM.importerTempImageSearchInput.placeholder = '加载失败';
        AppState.importer.tempImagesList = []; // 清空列表
        // 抛出错误，让调用者知道失败了
        throw error;
    } finally {
        // 无论成功或失败，都根据列表是否有内容来更新输入框状态
        updateImportInputPlaceholders();
    }
}


/**
 * 更新导入功能中输入框的占位符和状态。
 */
function updateImportInputPlaceholders() {
    // 更新待入库图片搜索框
    if (DOM.importerTempImageSearchInput) {
        const hasTempImages = AppState.importer.tempImagesList?.length > 0;
        DOM.importerTempImageSearchInput.disabled = !hasTempImages; // 如果没图片则禁用
        // 如果有图片，设为 readonly 并更改光标，提示用户点击选择
        DOM.importerTempImageSearchInput.readOnly = hasTempImages;
        DOM.importerTempImageSearchInput.style.cursor = hasTempImages ? 'pointer' : 'default';
        // 根据是否有图片设置不同的占位符
        DOM.importerTempImageSearchInput.placeholder = hasTempImages
            ? `点击选择 (${AppState.importer.tempImagesList.length} 张待入库)`
            : 'imgtemp 目录为空';
    }

    // 更新目标文件夹搜索框
    if (DOM.importerTargetFolderSearchInput) {
        const characterFolders = AppState.importer.characterFoldersList;
        // 根据是否有文件夹列表设置不同的占位符
        DOM.importerTargetFolderSearchInput.placeholder = characterFolders.length > 0
            ? `搜索 ${characterFolders.length} 个文件夹或输入新名称...`
            : '输入新文件夹名称...';
        // 只有当选中了临时图片后才启用目标文件夹输入框
        DOM.importerTargetFolderSearchInput.disabled = !AppState.importer.selectedTempImageInfo;
    }
}

/**
 * 显示待入库图片的建议列表。
 * @param {Array<object>} imageList - 包含图片信息的数组 ({filename, path})。
 */
function displayTempImageSuggestions(imageList) {
    if (!DOM.importerTempImageSuggestions) {
        console.error("Importer: 待入库图片建议列表 DOM 元素未找到！");
        return;
    }
    const suggestionList = DOM.importerTempImageSuggestions;
    suggestionList.innerHTML = ''; // 清空旧建议

    if (!Array.isArray(imageList)) {
        console.error("Importer: displayTempImageSuggestions 接收到无效的 imageList:", imageList);
        suggestionList.classList.add(UI_CLASSES.HIDDEN); // 无效数据则隐藏
        return;
    }

    console.log(`Importer: 显示 ${imageList.length} 条待入库图片建议。`);

    if (imageList.length === 0) {
        suggestionList.classList.add(UI_CLASSES.HIDDEN); // 无建议则隐藏
        return;
    }

    const fragment = document.createDocumentFragment();
    // 只显示前 20 条建议，防止列表过长
    imageList.slice(0, 20).forEach(imgInfo => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion'; // 应用样式
        item.textContent = imgInfo.filename; // 显示文件名
        item.title = imgInfo.path; // 鼠标悬停显示完整路径
        item.onclick = () => selectTemporaryImage(imgInfo); // 点击选择该图片
        fragment.appendChild(item);
    });

    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN); // 显示列表
    console.log("Importer: 待入库图片建议列表已显示。");
}

/**
 * 显示目标文件夹的建议列表。
 * @param {Array<string>} folderList - 文件夹名称数组。
 */
function displayTargetFolderSuggestions(folderList) {
    if (!DOM.importerTargetFolderSuggestions || !DOM.importerTargetFolderSearchInput) return;

    const suggestionList = DOM.importerTargetFolderSuggestions;
    suggestionList.innerHTML = ''; // 清空旧建议

    if (!folderList || folderList.length === 0) {
        suggestionList.classList.add(UI_CLASSES.HIDDEN); // 无建议则隐藏
        return;
    }

    const fragment = document.createDocumentFragment();
    // 只显示前 10 条建议
    folderList.slice(0, 10).forEach(folderName => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion'; // 应用样式
        item.textContent = folderName;
        item.onclick = () => selectTargetFolder(folderName); // 点击选择该文件夹
        fragment.appendChild(item);
    });

    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN); // 显示列表
}

/**
 * 处理用户选择待入库图片的操作。
 * @param {object} imageInfo - 被选中的图片信息 ({filename, path})。
 */
function selectTemporaryImage(imageInfo) {
    if (!imageInfo?.path || !imageInfo.filename) {
        console.error("Importer: selectTemporaryImage 接收到无效的 imageInfo:", imageInfo);
        return;
    }

    console.log("Importer: 选择待入库图片:", imageInfo.filename);
    AppState.importer.selectedTempImageInfo = imageInfo; // 更新状态

    // 更新搜索框显示选中的文件名
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.value = imageInfo.filename;

    // 显示图片预览
    if (DOM.importerTempImagePreview) {
        const preview = DOM.importerTempImagePreview;
        // 构建 Web 访问路径
        const imageUrl = imageInfo.path.startsWith('/') ? imageInfo.path : `/${imageInfo.path}`;
        preview.src = ""; // 清空旧 src
        preview.alt = "加载中..."; // 设置加载提示
        preview.classList.remove(UI_CLASSES.HIDDEN); // 显示预览元素

        preview.onerror = () => {
            console.error("Importer: 预览图片加载失败:", imageUrl);
            displayToast(`预览 "${imageInfo.filename}" 失败`, UI_CLASSES.ERROR);
            preview.classList.add(UI_CLASSES.HIDDEN); // 隐藏失败的预览
            preview.src = "";
            preview.alt = "加载失败";
            AppState.importer.selectedTempImageInfo = null; // 清除选择状态
            disableImportFormSections(); // 禁用后续表单
        };
        preview.onload = () => {
            preview.alt = imageInfo.filename; // 加载成功后设置 alt
        };
        preview.src = imageUrl; // 开始加载
    }

    // 隐藏待入库建议列表
    if (DOM.importerTempImageSuggestions) DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);

    // 启用表单的后续部分 (属性、目标文件夹、命名等)
    enableImportFormSections();

    // 重置目标文件夹和最终文件名相关的输入和状态
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = '';
    if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '';
    AppState.importer.selectedTargetFolder = null;
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true; // 初始禁用添加按钮
}

/**
 * 处理用户选择目标文件夹的操作 (点击建议或手动输入后)。
 * @param {string} folderName - 选定的目标文件夹名称。
 */
async function selectTargetFolder(folderName) {
    folderName = folderName.trim(); // 去除前后空格
    if (!folderName) {
        console.warn("Importer: 尝试选择空的文件夹名称。");
        return;
    }

    console.log("Importer: 选择目标文件夹:", folderName);
    AppState.importer.selectedTargetFolder = folderName; // 更新状态

    // 更新目标文件夹输入框显示
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = folderName;
    // 隐藏目标文件夹建议列表
    if (DOM.importerTargetFolderSuggestions) DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);

    // --- 获取并设置建议的文件名 ---
    if (DOM.importerFinalFilenameInput) {
        DOM.importerFinalFilenameInput.value = '获取编号中...'; // 提示正在获取
        DOM.importerFinalFilenameInput.readOnly = true; // 设为只读
        DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE); // 移除可编辑样式
    }
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN); // 隐藏编辑按钮
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true; // 禁用添加按钮

    // 检查是否已选择待入库图片
    if (!AppState.importer.selectedTempImageInfo?.filename) {
        displayToast('错误：请先选择要入库的图片', UI_CLASSES.ERROR);
        if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '错误：未选图';
        return;
    }

    try {
        // 请求后端获取该文件夹下当前最大编号
        const url = `${API_ENDPOINTS.FETCH_LAST_FILE_NUMBER}?folder=${encodeURIComponent(folderName)}`;
        const data = await fetchJsonData(url); // 使用 Core.js 的 fetch

        if (data && typeof data.lastNumber === 'number') {
            const nextNumber = data.lastNumber + 1; // 计算下一个可用编号
            AppState.importer.suggestedFilenameNum = nextNumber; // 存储建议编号
            // 构建文件名基础部分 (例如 "心海Gu")
            AppState.importer.suggestedFilenameBase = folderName + 'Gu';
            // 从原始文件名中提取后缀名 (例如 ".webp")
            const match = AppState.importer.selectedTempImageInfo.filename.match(/\.[^.]+$/);
            AppState.importer.suggestedFilenameExt = match ? match[0] : '.webp'; // 默认为 .webp
            // 拼接最终建议文件名
            const finalFilename = `${AppState.importer.suggestedFilenameBase}${nextNumber}${AppState.importer.suggestedFilenameExt}`;

            // 更新最终文件名输入框
            if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = finalFilename;
            // 启用添加按钮
            if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = false;
            // 显示编辑按钮
            if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.remove(UI_CLASSES.HIDDEN);

            console.log(`Importer: 建议的文件名为: ${finalFilename}`);
        } else {
            // 如果后端返回的数据格式不对
            throw new Error(data?.error || '获取到的文件编号数据无效');
        }
    } catch (error) {
        console.error(`Importer: 获取文件夹 '${folderName}' 的最大编号失败:`, error);
        displayToast(`获取文件编号失败: ${error.message}`, UI_CLASSES.ERROR);
        if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '获取编号失败';
        // 禁用添加按钮，隐藏编辑按钮
        if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
        if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    }
}

/**
 * 启用导入表单的后续部分 (属性、目标文件夹、命名等)。
 */
function enableImportFormSections() {
    // 显示属性面板
    if (DOM.importerAttributesPanel) {
        DOM.importerAttributesPanel.classList.remove(UI_CLASSES.HIDDEN, UI_CLASSES.INITIALLY_HIDDEN);
    }
    // 启用目标文件夹搜索框
    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.disabled = false;
    }
    // 激活命名区域 (如果需要视觉上的区分)
    const namingSection = DOM.importPaneView?.querySelector('.naming-section');
    if (namingSection) {
        namingSection.classList.add(UI_CLASSES.ACTIVE); // 应用激活样式
    }
    console.debug("Importer: 表单后续部分已启用。");
}

/**
 * 禁用导入表单的后续部分。
 */
function disableImportFormSections() {
    // 禁用目标文件夹搜索框
    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.disabled = true;
    }
    // 移除命名区域的激活状态
    const namingSection = DOM.importPaneView?.querySelector('.naming-section');
    if (namingSection) {
        namingSection.classList.remove(UI_CLASSES.ACTIVE);
    }
    // 清空并禁用最终文件名输入框
    if (DOM.importerFinalFilenameInput) {
        DOM.importerFinalFilenameInput.value = '';
        DOM.importerFinalFilenameInput.readOnly = true;
        DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
    }
    // 隐藏编辑按钮
    if (DOM.importerEditFilenameButton) {
        DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    }
    // 禁用添加按钮
    if (DOM.importerAddToGalleryButton) {
        DOM.importerAddToGalleryButton.disabled = true;
    }
    console.debug("Importer: 表单后续部分已禁用。");
}

/**
 * 处理点击 "添加到图库" 按钮的操作。
 */
async function addImportedImageToGallery() {
    // 检查必要的状态和 DOM 元素
    if (!AppState.importer.selectedTempImageInfo || !AppState.importer.selectedTargetFolder ||
        !DOM.importerFinalFilenameInput || !DOM.importerAddToGalleryButton || !DOM.importerMessageArea)
    {
        console.warn("Importer: 添加到图库的条件未满足 (图片、文件夹、文件名等信息不全)。");
        displayImportMessage("错误：请确保已选择图片、目标文件夹并生成了文件名", UI_CLASSES.ERROR);
        return;
    }

    hideImportMessage(); // 清除之前的消息

    const finalName = DOM.importerFinalFilenameInput.value.trim();
    const tempPath = AppState.importer.selectedTempImageInfo.path; // 临时图片的 Web 路径
    const targetFolder = AppState.importer.selectedTargetFolder;

    // 校验最终文件名
    if (!finalName) {
        displayImportMessage("错误：最终文件名不能为空", UI_CLASSES.ERROR);
        return;
    }
    // 检查非法字符 (Windows 和 Linux 通用)
    if (/[\\/:"*?<>|]/.test(finalName)) {
        displayImportMessage("错误：文件名包含非法字符 (\\ / : * ? \" < > |)", UI_CLASSES.ERROR);
        return;
    }

    // 读取属性控件的值
    const ratingInput = document.querySelector('input[name="importRating"]:checked');
    const layoutInput = document.querySelector('input[name="importLayout"]:checked');
    const isEasterEgg = DOM.importerIsEasterEggCheckbox?.checked ?? false;
    const isAiImage = DOM.importerIsAiImageCheckbox?.checked ?? false;
    const downloadSource = DOM.importerDownloadSourceInput?.value.trim() || 'none'; // 获取下载来源

    if (!ratingInput || !layoutInput) {
        displayImportMessage("错误：无法读取限制级或构图属性", UI_CLASSES.ERROR);
        return;
    }

    const rating = ratingInput.value || 'none';
    const layout = layoutInput.value || 'normal';

    // 禁用添加按钮，显示处理中消息
    DOM.importerAddToGalleryButton.disabled = true;
    displayImportMessage("正在添加入库...", UI_CLASSES.INFO);

    // 准备发送到后端的数据
    const importDataPayload = {
        tempImagePath: tempPath,
        targetFolder: targetFolder,
        targetFilename: finalName,
        attributes: {
            isPx18: rating === 'px18',
            isRx18: rating === 'rx18',
            layout: layout,
            isEasterEgg: isEasterEgg,
            isAiImage: isAiImage,
            isBan: false, // 默认不封禁
            Downloaded_From: downloadSource // 添加下载来源
            // MD5 和 GID 由后端在实际入库时生成或处理
        }
    };

    console.log("Importer: 发送入库请求到后端:", importDataPayload);

    try {
        // 调用后端 API 执行入库操作
        const result = await fetchJsonData(API_ENDPOINTS.IMPORT_IMAGE_TO_GALLERY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importDataPayload)
        });

        // 检查后端返回结果
        if (result?.success === true && result.newEntry?.path) {
            console.log("Importer: 图片入库成功，后端返回新条目:", result.newEntry);
            displayImportMessage(`成功添加 "${finalName}" 到图库！`, UI_CLASSES.SUCCESS);

            // --- 更新前端状态 ---
            // 1. 将新条目添加到内部用户数据缓存
            AppState.userData.push(result.newEntry);
            AppState.userDataPaths.add(result.newEntry.path);

            // 2. 更新相关计数显示 (如果函数可用)
            if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
            if (typeof updateDataListCount === "function") updateDataListCount(); // DataList 的计数

            // 3. 如果数据列表当前可见，刷新它 (如果函数可用)
            const dataListPaneActive = DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE);
            if (dataListPaneActive && typeof applyFiltersAndRenderDataList === "function") {
                console.log("Importer: 数据列表可见，正在刷新...");
                applyFiltersAndRenderDataList();
            }

            // 4. 重新加载临时图片列表，移除已入库的图片
            await fetchTempImages(); // 重新获取

            // 5. 重置导入表单
            resetImportForm();

        } else {
            // 后端返回失败或数据格式不对
            throw new Error(result?.error || "图片入库失败，服务器未返回成功信息或有效数据");
        }
    } catch (error) {
        console.error("Importer: 添加到图库失败:", error);
        displayImportMessage(`添加入库失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        // 允许用户重试
        DOM.importerAddToGalleryButton.disabled = false;
    }
}

/**
 * 重置导入表单到初始状态。
 */
function resetImportForm() {
    console.log("Importer: 重置导入表单...");

    // 清空输入框
    if (DOM.importerTempImageSearchInput) DOM.importerTempImageSearchInput.value = '';
    if (DOM.importerTargetFolderSearchInput) DOM.importerTargetFolderSearchInput.value = '';
    if (DOM.importerFinalFilenameInput) {
        DOM.importerFinalFilenameInput.value = '';
        DOM.importerFinalFilenameInput.readOnly = true;
        DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
    }
     if (DOM.importerDownloadSourceInput) DOM.importerDownloadSourceInput.value = ''; // 清空下载来源

    // 重置图片预览
    if (DOM.importerTempImagePreview) {
        DOM.importerTempImagePreview.onerror = null; // 移除旧的错误处理器
        DOM.importerTempImagePreview.src = '';
        DOM.importerTempImagePreview.alt = '待入库图片预览';
        DOM.importerTempImagePreview.classList.add(UI_CLASSES.HIDDEN);
    }

    // 清除状态
    AppState.importer.selectedTempImageInfo = null;
    AppState.importer.selectedTargetFolder = null;
    AppState.importer.suggestedFilenameBase = '';
    AppState.importer.suggestedFilenameNum = 0;
    AppState.importer.suggestedFilenameExt = '';

    // 重置属性控件到默认值
    const defaultRatingRadio = document.querySelector('input[name="importRating"][value="none"]');
    const defaultLayoutRadio = document.querySelector('input[name="importLayout"][value="normal"]');
    if (defaultRatingRadio) defaultRatingRadio.checked = true;
    if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
    if (DOM.importerIsEasterEggCheckbox) DOM.importerIsEasterEggCheckbox.checked = false;
    if (DOM.importerIsAiImageCheckbox) DOM.importerIsAiImageCheckbox.checked = false;

    // 禁用表单后续部分
    disableImportFormSections();

    // 隐藏编辑按钮，禁用添加按钮
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;

    // 更新输入框占位符
    updateImportInputPlaceholders();

    // 隐藏消息区域
    hideImportMessage();
}

/**
 * 处理目标文件夹输入框的输入事件 (防抖)。
 */
function handleTargetFolderInput() {
    // 清除之前的计时器
    clearTimeout(AppState.importer.searchDebounceTimer);

    // 清空最终文件名，禁用添加按钮，隐藏编辑按钮，清除选中状态
    if (DOM.importerFinalFilenameInput) DOM.importerFinalFilenameInput.value = '';
    if (DOM.importerAddToGalleryButton) DOM.importerAddToGalleryButton.disabled = true;
    if (DOM.importerEditFilenameButton) DOM.importerEditFilenameButton.classList.add(UI_CLASSES.HIDDEN);
    AppState.importer.selectedTargetFolder = null;

    // 获取输入值
    const query = DOM.importerTargetFolderSearchInput.value.toLowerCase().trim();

    // 设置新的防抖计时器
    AppState.importer.searchDebounceTimer = setTimeout(() => {
        // 如果输入不为空且有文件夹列表，进行过滤并显示建议
        if (query && AppState.importer.characterFoldersList.length > 0) {
            const results = AppState.importer.characterFoldersList.filter(folder =>
                folder.toLowerCase().includes(query)
            );
            displayTargetFolderSuggestions(results);
        } else if (DOM.importerTargetFolderSuggestions) {
            // 如果输入为空或无文件夹列表，隐藏建议
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }, DELAYS.IMPORT_SEARCH_DEBOUNCE); // 使用防抖延迟
}

/**
 * 处理目标文件夹输入框失去焦点事件。
 */
function handleTargetFolderBlur() {
    // 延迟处理，允许用户点击建议项
    setTimeout(() => {
        // 如果建议列表仍然可见 (用户可能正在点击)，则不处理
        if (DOM.importerTargetFolderSuggestions && !DOM.importerTargetFolderSuggestions.classList.contains(UI_CLASSES.HIDDEN)) {
            return;
        }

        const currentValue = DOM.importerTargetFolderSearchInput.value.trim();
        // 如果输入框有值，并且这个值不等于当前已选中的文件夹 (避免重复选择)
        if (currentValue && currentValue !== AppState.importer.selectedTargetFolder) {
            console.log("Importer: 目标文件夹输入框失焦，自动选择:", currentValue);
            selectTargetFolder(currentValue); // 自动选择当前输入的值
        } else if (!currentValue && DOM.importerTargetFolderSuggestions) {
            // 如果输入框为空，隐藏建议列表
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }, 150); // 延迟 150ms
}

/**
 * 处理目标文件夹输入框的键盘事件 (Enter, Escape)。
 * @param {KeyboardEvent} event - 键盘事件对象。
 */
function handleTargetFolderKeyDown(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // 阻止表单默认提交行为
        const currentValue = DOM.importerTargetFolderSearchInput.value.trim();
        // 如果输入框有值且与当前选择不同
        if (currentValue && currentValue !== AppState.importer.selectedTargetFolder) {
            selectTargetFolder(currentValue); // 选择当前值
            DOM.importerTargetFolderSearchInput.blur(); // 使输入框失去焦点
        }
    } else if (event.key === 'Escape') {
        // 按 Esc 键隐藏建议列表
        if (DOM.importerTargetFolderSuggestions) {
            DOM.importerTargetFolderSuggestions.classList.add(UI_CLASSES.HIDDEN);
        }
    }
}

// --------------------------------------------------------------------------
// 事件监听器设置 (Importer Specific)
// --------------------------------------------------------------------------
/**
 * 设置图片入库视图内的事件监听器。
 */
function setupImporterEventListeners() {
    // 待入库图片搜索框 (点击或聚焦时显示建议列表)
    if (DOM.importerTempImageSearchInput) {
        const showTempImageList = () => {
            // 仅在 Import 模式、输入框启用且只读时触发
            if (AppState.currentGuToolMode !== 'import' || DOM.importerTempImageSearchInput.disabled || DOM.importerTempImageSearchInput.readOnly === false) return;
            // 显示建议列表
            if (AppState.importer.tempImagesList?.length > 0) {
                displayTempImageSuggestions(AppState.importer.tempImagesList);
            } else if (DOM.importerTempImageSuggestions) {
                // 如果列表为空，确保建议列表隐藏
                DOM.importerTempImageSuggestions.classList.add(UI_CLASSES.HIDDEN);
            }
        };
        DOM.importerTempImageSearchInput.removeEventListener('focus', showTempImageList);
        DOM.importerTempImageSearchInput.removeEventListener('click', showTempImageList);
        DOM.importerTempImageSearchInput.addEventListener('focus', showTempImageList);
        DOM.importerTempImageSearchInput.addEventListener('click', showTempImageList);
    } else { console.error("Importer: 待入库图片搜索框 (tempImageSearchInput) 未找到。"); }

    // 目标文件夹搜索框 (输入、失焦、键盘事件)
    if (DOM.importerTargetFolderSearchInput) {
        DOM.importerTargetFolderSearchInput.removeEventListener('input', handleTargetFolderInput);
        DOM.importerTargetFolderSearchInput.removeEventListener('blur', handleTargetFolderBlur);
        DOM.importerTargetFolderSearchInput.removeEventListener('keydown', handleTargetFolderKeyDown);
        DOM.importerTargetFolderSearchInput.addEventListener('input', handleTargetFolderInput);
        DOM.importerTargetFolderSearchInput.addEventListener('blur', handleTargetFolderBlur);
        DOM.importerTargetFolderSearchInput.addEventListener('keydown', handleTargetFolderKeyDown);
    } else { console.error("Importer: 目标文件夹搜索框 (targetFolderSearchInput) 未找到。"); }

    // 编辑最终文件名按钮 和 最终文件名输入框
    if (DOM.importerEditFilenameButton && DOM.importerFinalFilenameInput) {
        // 点击编辑按钮的处理
        const handleEditClick = () => {
            DOM.importerFinalFilenameInput.readOnly = false; // 允许编辑
            DOM.importerFinalFilenameInput.classList.add(UI_CLASSES.EDITABLE); // 应用可编辑样式
            DOM.importerFinalFilenameInput.focus(); // 聚焦输入框
            // 将光标移动到末尾
            DOM.importerFinalFilenameInput.setSelectionRange(DOM.importerFinalFilenameInput.value.length, DOM.importerFinalFilenameInput.value.length);
        };
        // 输入框失焦时的处理
        const handleFilenameBlur = () => {
            // 如果当前是可编辑状态，则恢复为只读
            if (DOM.importerFinalFilenameInput.classList.contains(UI_CLASSES.EDITABLE)) {
                DOM.importerFinalFilenameInput.readOnly = true;
                DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
            }
        };
        // 输入框键盘事件处理 (Enter, Escape)
        const handleFilenameKeyDown = (e) => {
            if (DOM.importerFinalFilenameInput.classList.contains(UI_CLASSES.EDITABLE)) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // 阻止默认行为
                    DOM.importerFinalFilenameInput.readOnly = true;
                    DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
                    DOM.importerFinalFilenameInput.blur(); // 失焦
                } else if (e.key === 'Escape') {
                    // 按 Esc 恢复为建议的文件名
                    const suggestedFilename = `${AppState.importer.suggestedFilenameBase}${AppState.importer.suggestedFilenameNum}${AppState.importer.suggestedFilenameExt}`;
                    DOM.importerFinalFilenameInput.value = suggestedFilename;
                    DOM.importerFinalFilenameInput.readOnly = true;
                    DOM.importerFinalFilenameInput.classList.remove(UI_CLASSES.EDITABLE);
                    DOM.importerFinalFilenameInput.blur(); // 失焦
                }
            }
        };
        // 绑定事件
        DOM.importerEditFilenameButton.removeEventListener('click', handleEditClick);
        DOM.importerFinalFilenameInput.removeEventListener('blur', handleFilenameBlur);
        DOM.importerFinalFilenameInput.removeEventListener('keydown', handleFilenameKeyDown);
        DOM.importerEditFilenameButton.addEventListener('click', handleEditClick);
        DOM.importerFinalFilenameInput.addEventListener('blur', handleFilenameBlur);
        DOM.importerFinalFilenameInput.addEventListener('keydown', handleFilenameKeyDown);
    } else { console.error("Importer: 最终文件名输入框 (finalFilenameInput) 或编辑按钮 (editFilenameButton) 未找到。"); }

    // 添加到图库按钮
    if (DOM.importerAddToGalleryButton) {
        DOM.importerAddToGalleryButton.removeEventListener('click', addImportedImageToGallery);
        DOM.importerAddToGalleryButton.addEventListener('click', addImportedImageToGallery);
    } else { console.error("Importer: 添加到图库按钮 (addToGalleryButton) 未找到。"); }

    console.log("Importer: 事件监听器设置完成。");
}

