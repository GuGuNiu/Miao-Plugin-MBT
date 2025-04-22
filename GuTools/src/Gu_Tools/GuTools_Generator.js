// ==========================================================================
// GuTools JSON 生成器模块: 处理图片搜索、预览、属性设置和 JSON 条目保存。
// ==========================================================================


/**
 * 重置 JSON 生成器界面到初始状态。
 */
function resetGeneratorInterface() {
    console.log("Generator: 重置界面...");
    AppState.isSettingInputProgrammatically = true; // 避免触发 input 事件

    // 清空搜索框和建议列表
    if (DOM.generatorSearchInput) DOM.generatorSearchInput.value = '';
    if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);

    // 清除图片预览和文件信息
    clearFileInfoDisplay();

    // 重置状态
    AppState.generator.showingRelatedImages = false;
    AppState.generator.isShowingFolderSuggestions = false;
    AppState.generator.currentSelection = null;
    AppState.generator.currentGeneratedId = null;
    AppState.generator.currentCalculatedMd5 = null;

    // 隐藏消息区域
    hideGeneratorMessage();

    // 短暂延迟后恢复输入事件标志
    setTimeout(() => {
        AppState.isSettingInputProgrammatically = false;
    }, 50);
}

/**
 * 清除图片预览区域及相关信息显示。
 */
function clearFileInfoDisplay() {
    // 淡出并隐藏预览图片
    if (DOM.generatorPreviewImage) {
        DOM.generatorPreviewImage.classList.remove(UI_CLASSES.FADE_IN);
        DOM.generatorPreviewImage.classList.add(UI_CLASSES.FADE_OUT);
        // 动画结束后重置
        setTimeout(() => {
            if (DOM.generatorPreviewImage) {
                DOM.generatorPreviewImage.src = "";
                DOM.generatorPreviewImage.alt = "选择图片"; // 重置 alt 文本
                DOM.generatorPreviewImage.classList.add(UI_CLASSES.HIDDEN);
                DOM.generatorPreviewImage.style.display = 'none';
                DOM.generatorPreviewImage.classList.remove(UI_CLASSES.FADE_OUT);
            }
        }, 300); // 匹配 CSS 动画时长
    }

    // 禁用保存按钮
    if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;

    // 重置属性选择
    const defaultRatingRadio = document.querySelector('input[name="rating"][value="none"]');
    const defaultLayoutRadio = document.querySelector('input[name="layout"][value="normal"]');
    if (defaultRatingRadio) defaultRatingRadio.checked = true;
    if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
    if (DOM.generatorIsEasterEggCheckbox) DOM.generatorIsEasterEggCheckbox.checked = false;
    if (DOM.generatorIsAiImageCheckbox) DOM.generatorIsAiImageCheckbox.checked = false;

    // 清空 MD5 和 GID 显示
    if (DOM.generatorMd5DisplayInput) {
        DOM.generatorMd5DisplayInput.value = '';
        DOM.generatorMd5DisplayInput.placeholder = '...';
    }
    if (DOM.generatorIdDisplayInput) {
        DOM.generatorIdDisplayInput.value = '';
        DOM.generatorIdDisplayInput.placeholder = '...';
    }

    // 清除游戏标签高亮
    highlightGameTag('');
}

/**
 * 根据图库代码高亮对应的游戏标签。
 * @param {string} galleryCode - 图库代码 (如 'gs-character')。
 */
function highlightGameTag(galleryCode) {
    if (!DOM.generatorGameTags || Object.values(DOM.generatorGameTags).some(tag => !tag)) {
        // console.warn("Generator: 游戏标签 DOM 未完全找到，无法更新高亮。");
        return; // 如果标签元素不全，则不执行
    }

    // 移除所有标签的激活状态和特定游戏类名
    Object.values(DOM.generatorGameTags).forEach(tagElement =>
        tagElement.classList.remove(UI_CLASSES.ACTIVE, 'gs', 'sr', 'zzz', 'waves')
    );

    // 根据 galleryCode 确定要激活的标签 Key
    let activeTagKey = null;
    switch (galleryCode) {
        case 'gs-character': activeTagKey = 'gs'; break;
        case 'sr-character': activeTagKey = 'sr'; break;
        case 'zzz-character': activeTagKey = 'zzz'; break;
        case 'waves-character': activeTagKey = 'waves'; break;
    }

    // 如果找到了对应的标签 Key 并且该标签元素存在，则添加激活状态和游戏类名
    if (activeTagKey && DOM.generatorGameTags[activeTagKey]) {
        DOM.generatorGameTags[activeTagKey].classList.add(UI_CLASSES.ACTIVE, activeTagKey);
    }
}


/**
 * 更新保存按钮的可用状态。
 * 只有当图片有效、MD5和GID有效且图片未被保存时才启用。
 */
function updateGeneratorSaveButtonState() {
    if (!DOM.generatorSaveButton) return;

    let enableSave = false;
    const currentSelection = AppState.generator.currentSelection;
    const currentId = AppState.generator.currentGeneratedId;
    const currentMd5 = AppState.generator.currentCalculatedMd5;
    const previewImage = DOM.generatorPreviewImage;

    if (currentSelection?.urlPath) {
        const isAlreadySaved = AppState.userDataPaths.has(currentSelection.urlPath);
        const isIdValid = !!currentId && currentId !== '生成中...'; // ID 已生成且有效
        const isMd5Valid = !!currentMd5 && currentMd5 !== '计算中...' && currentMd5 !== '计算失败'; // MD5 已计算且有效
        // 图片已加载且未出错
        const isImageLoaded = previewImage && !previewImage.classList.contains(UI_CLASSES.HIDDEN) && previewImage.src !== '' && !previewImage.alt.includes('失败') && !previewImage.alt.includes('加载中');

        enableSave = !isAlreadySaved && isIdValid && isMd5Valid && isImageLoaded;
    }

    DOM.generatorSaveButton.disabled = !enableSave;
}

/**
 * 显示选定的图片及其信息，并准备保存。
 * @param {object} imageInfo - 包含图片信息的对象 (name, fileName, folderName, urlPath, gallery)。
 */
async function displaySelectedImage(imageInfo) {
    if (!imageInfo?.urlPath) {
        console.error("Generator: 无效的图片信息对象:", imageInfo);
        displayGeneratorMessage("错误：选择的图片信息无效", UI_CLASSES.ERROR, DELAYS.MESSAGE_CLEAR_DEFAULT);
        resetGeneratorInterface(); // 重置界面
        return;
    }

    console.log(`Generator: 准备显示图片: ${imageInfo.fileName}`);
    AppState.generator.currentSelection = { ...imageInfo }; // 存储当前选择

    // --- 重置 UI 和状态 ---
    hideGeneratorMessage();
    if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
    AppState.generator.showingRelatedImages = false;
    AppState.isSettingInputProgrammatically = true; // 标记程序化设置
    if (DOM.generatorSearchInput) {
        // 显示更友好的名称和文件名
        DOM.generatorSearchInput.value = `${imageInfo.name || '未知角色'} (${imageInfo.fileName})`;
    }
    setTimeout(() => { AppState.isSettingInputProgrammatically = false; }, 50); // 延迟恢复

    highlightGameTag(imageInfo.gallery); // 高亮游戏标签

    // 重置属性控件到默认值
    const defaultRatingRadio = document.querySelector('input[name="rating"][value="none"]');
    const defaultLayoutRadio = document.querySelector('input[name="layout"][value="normal"]');
    if (defaultRatingRadio) defaultRatingRadio.checked = true;
    if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
    if (DOM.generatorIsEasterEggCheckbox) DOM.generatorIsEasterEggCheckbox.checked = false;
    if (DOM.generatorIsAiImageCheckbox) DOM.generatorIsAiImageCheckbox.checked = false;

    // 重置保存按钮和 ID/MD5 显示
    if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
    if (DOM.generatorIdDisplayInput) { DOM.generatorIdDisplayInput.value = ''; DOM.generatorIdDisplayInput.placeholder = '...'; }
    if (DOM.generatorMd5DisplayInput) { DOM.generatorMd5DisplayInput.value = ''; DOM.generatorMd5DisplayInput.placeholder = '...'; }
    AppState.generator.currentGeneratedId = null;
    AppState.generator.currentCalculatedMd5 = null;

    // --- 检查图片是否已在 JSON 数据中 ---
    const existingEntry = AppState.userData.find(entry => entry.path === imageInfo.urlPath);

    if (existingEntry?.attributes) {
        // --- 图片已存在 ---
        console.log(`Generator: 图片已存在于 JSON 中 (GID: ${existingEntry.gid})。`);
        displayGeneratorMessage(`提示： "${imageInfo.fileName}" 已经录入过了。`, UI_CLASSES.INFO);

        const attrs = existingEntry.attributes;
        const gid = existingEntry.gid;

        // 显示已有的 GID 和 MD5
        if (DOM.generatorIdDisplayInput) { DOM.generatorIdDisplayInput.value = gid || 'N/A'; DOM.generatorIdDisplayInput.placeholder = 'GID'; }
        if (DOM.generatorMd5DisplayInput) { DOM.generatorMd5DisplayInput.value = attrs.md5 || 'N/A'; DOM.generatorMd5DisplayInput.placeholder = 'MD5'; }
        AppState.generator.currentGeneratedId = gid || null; // 存储 GID
        AppState.generator.currentCalculatedMd5 = attrs.md5 || null; // 存储 MD5

        // 根据已有属性设置控件状态
        let ratingValue = 'none';
        if (attrs.isPx18) ratingValue = 'px18';
        else if (attrs.isRx18) ratingValue = 'rx18';
        const ratingRadio = document.querySelector(`input[name="rating"][value="${ratingValue}"]`);
        if (ratingRadio) ratingRadio.checked = true;

        const layoutValue = attrs.layout || 'normal';
        const layoutRadio = document.querySelector(`input[name="layout"][value="${layoutValue}"]`);
        if (layoutRadio) layoutRadio.checked = true;

        if (DOM.generatorIsEasterEggCheckbox) DOM.generatorIsEasterEggCheckbox.checked = !!attrs.isEasterEgg;
        if (DOM.generatorIsAiImageCheckbox) DOM.generatorIsAiImageCheckbox.checked = !!attrs.isAiImage;

        // 已存在条目，禁用保存按钮
        if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;

    } else {
        // --- 新图片 ---
        console.log("Generator: 新图片，准备生成 GID 和计算 MD5...");
        if (DOM.generatorIdDisplayInput) DOM.generatorIdDisplayInput.placeholder = '生成中...';
        if (DOM.generatorMd5DisplayInput) DOM.generatorMd5DisplayInput.placeholder = '计算中...';

        // 1. 生成 GID
        AppState.generator.currentGeneratedId = generateNumericId(); // 使用 Core.js 的函数
        if (DOM.generatorIdDisplayInput) {
            DOM.generatorIdDisplayInput.value = AppState.generator.currentGeneratedId;
            DOM.generatorIdDisplayInput.placeholder = 'GID';
        }

        // 2. 异步获取 MD5
        // 添加视觉提示，表示正在计算
        if (DOM.generatorMd5DisplayInput) DOM.generatorMd5DisplayInput.classList.add('calculating');
        try {
            // 使用 Core.js 的函数，并传入 Web 路径
            const md5 = await fetchImageMd5(imageInfo.urlPath);
            if (md5) {
                AppState.generator.currentCalculatedMd5 = md5;
                if (DOM.generatorMd5DisplayInput) {
                    DOM.generatorMd5DisplayInput.value = md5;
                    DOM.generatorMd5DisplayInput.placeholder = 'MD5';
                }
            } else {
                // fetchImageMd5 内部应该已经处理了错误并返回 null
                throw new Error("MD5 计算失败或未返回有效值");
            }
        } catch (error) {
            console.error(`Generator: 获取图片 MD5 失败 (${imageInfo.urlPath}):`, error);
            AppState.generator.currentCalculatedMd5 = '计算失败';
            if (DOM.generatorMd5DisplayInput) {
                DOM.generatorMd5DisplayInput.value = '失败';
                DOM.generatorMd5DisplayInput.placeholder = '错误';
                 // 添加错误样式
                 DOM.generatorMd5DisplayInput.classList.add('error-state');
            }
        } finally {
            // 移除计算中的样式
            if (DOM.generatorMd5DisplayInput) {
                 DOM.generatorMd5DisplayInput.classList.remove('calculating');
                 // 如果计算失败，延迟移除错误样式
                 if (AppState.generator.currentCalculatedMd5 === '计算失败') {
                     setTimeout(() => DOM.generatorMd5DisplayInput?.classList.remove('error-state'), 2000);
                 }
            }
            updateGeneratorSaveButtonState(); // 获取完 MD5 后更新保存按钮状态
        }
    }

    // --- 加载并显示预览图 ---
    const imageWebPath = imageInfo.urlPath.startsWith('/') ? imageInfo.urlPath : `/${imageInfo.urlPath}`;
    if (DOM.generatorPreviewImage) {
        const previewImage = DOM.generatorPreviewImage;
        // 重置状态并准备加载
        previewImage.src = ""; // 清空旧 src
        previewImage.alt = "加载中..."; // 设置加载提示
        previewImage.classList.add(UI_CLASSES.HIDDEN, UI_CLASSES.FADE_OUT); // 初始隐藏并准备淡入
        previewImage.style.display = 'none'; // 确保隐藏

        // 设置错误处理
        previewImage.onerror = () => {
            console.error("Generator: 预览图片加载失败:", imageWebPath);
            displayGeneratorMessage(`错误：无法加载预览图 (${imageInfo.fileName})`, UI_CLASSES.ERROR);
            previewImage.classList.add(UI_CLASSES.HIDDEN);
            previewImage.style.display = 'none';
            previewImage.alt = "图片加载失败";
            if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true; // 禁用保存
        };

        // 设置加载成功处理
        previewImage.onload = () => {
            console.log("Generator: 预览图片加载成功:", imageWebPath);
            previewImage.alt = imageInfo.name || '选中的图片'; // 设置 alt
            previewImage.classList.remove(UI_CLASSES.HIDDEN, UI_CLASSES.FADE_OUT); // 移除隐藏和淡出
            previewImage.style.display = 'block'; // 显示图片
            previewImage.classList.add(UI_CLASSES.FADE_IN); // 添加淡入效果
            updateGeneratorSaveButtonState(); // 图片加载成功后，再次检查保存按钮状态
            // 短暂延迟后移除淡入类，避免影响后续动画
            setTimeout(() => previewImage.classList.remove(UI_CLASSES.FADE_IN), 300);
        };

        // 设置 src 开始加载
        previewImage.src = imageWebPath;
    }
}

/**
 * 保存当前选中的图片信息到 ImageData.json。
 */
async function saveGeneratedEntry() {
    if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true; // 先禁用按钮防止重复点击

    // 清除可能存在的旧计时器
    if (AppState.generator.writingTimerId) clearInterval(AppState.generator.writingTimerId);
    AppState.generator.writingTimerId = null;
    AppState.generator.writingStartTime = null;
    if (AppState.generator.successTimerId) clearInterval(AppState.generator.successTimerId);
    AppState.generator.successTimerId = null;
    AppState.generator.successStartTime = null;

    // 检查必要信息是否齐全
    const currentSelection = AppState.generator.currentSelection;
    const md5Value = DOM.generatorMd5DisplayInput?.value;
    const gidValue = DOM.generatorIdDisplayInput?.value;

    if (!currentSelection || !md5Value || !gidValue) {
        displayGeneratorMessage('错误：图片未选择或 GID/MD5 信息缺失', UI_CLASSES.ERROR, DELAYS.MESSAGE_CLEAR_DEFAULT);
        // 重新启用按钮可能不安全，取决于错误原因
        // if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = false;
        return;
    }

    const currentFilename = currentSelection.fileName || '未知文件名';
    const relativePath = currentSelection.urlPath;

    // 再次检查是否已存在 (双重保险)
    if (AppState.userDataPaths.has(relativePath)) {
        displayGeneratorMessage(`错误：图片 "${currentFilename}" 已经存在于 JSON 中了`, UI_CLASSES.ERROR);
        // 如果已存在，则查找并显示下一张未保存的图片
        findAndDisplayNextUnsavedImage(currentSelection);
        return;
    }

    // 检查 GID 和 MD5 的有效性
    if (!gidValue || gidValue === 'N/A' || gidValue === '生成中...') {
        displayGeneratorMessage("错误：GID 无效，无法保存", UI_CLASSES.ERROR, DELAYS.MESSAGE_CLEAR_DEFAULT);
        return;
    }
    if (!md5Value || md5Value === '计算失败' || md5Value === '计算中...') {
        displayGeneratorMessage("错误：MD5 无效，无法保存", UI_CLASSES.ERROR, DELAYS.MESSAGE_CLEAR_DEFAULT);
        return;
    }

    // 读取属性控件的值
    const ratingRadio = document.querySelector('input[name="rating"]:checked');
    const layoutRadio = document.querySelector('input[name="layout"]:checked');
    const isEasterEgg = DOM.generatorIsEasterEggCheckbox?.checked ?? false;
    const isAiImage = DOM.generatorIsAiImageCheckbox?.checked ?? false;

    // 构建新的 JSON 条目对象
    const newEntry = {
        gid: gidValue,
        characterName: currentSelection.name || 'Unknown', // 角色名
        path: relativePath, // Web 路径
        attributes: {
            filename: currentFilename,
            parentFolder: currentSelection.folderName, // 父文件夹名
            isPx18: ratingRadio?.value === 'px18',
            isRx18: ratingRadio?.value === 'rx18',
            layout: layoutRadio?.value || 'normal',
            isEasterEgg: isEasterEgg,
            isAiImage: isAiImage,
            isBan: false, // 默认不封禁
            md5: md5Value, // 之前计算好的 MD5
            Downloaded_From: 'none' // 默认来源
        },
        timestamp: new Date().toISOString(), // 当前时间戳
        sourceGallery: currentSelection.gallery // 图片来源图库
    };

    console.log("Generator: 准备保存新条目:", newEntry);

    // 创建包含新条目的完整数据列表
    const updatedDataList = [...AppState.userData, newEntry];

    // 显示写入中提示，并启动计时器
    const baseWritingMessage = `写入中：${currentFilename}`;
    displayGeneratorMessage(baseWritingMessage, UI_CLASSES.INFO, null); // null 表示不自动消失
    AppState.generator.writingStartTime = Date.now();
    AppState.generator.writingTimerId = setInterval(() => {
        // 检查状态，如果写入完成或中止，则停止计时器
        if (!AppState.generator.writingStartTime || !DOM.generatorMessageArea?.classList.contains(UI_CLASSES.INFO)) {
            clearInterval(AppState.generator.writingTimerId);
            AppState.generator.writingTimerId = null;
            AppState.generator.writingStartTime = null;
            return;
        }
        // 更新写入时间显示
        const elapsedSeconds = ((Date.now() - AppState.generator.writingStartTime) / 1000).toFixed(1);
        if (DOM.generatorMessageArea) DOM.generatorMessageArea.textContent = `${baseWritingMessage} (${elapsedSeconds}s)`;
    }, 100); // 每 100ms 更新一次

    let success = false;
    const saveOperationStartTime = Date.now();

    try {
        // 调用核心更新函数 (现在应该在 Core.js 或 Data_List.js)
        if (typeof updateUserData !== 'function') {
            throw new Error("核心函数 updateUserData 未定义！");
        }
        // 注意：成功消息将由 updateUserData 显示在 generatorMessageArea
        success = await updateUserData(
            updatedDataList,
            `成功添加 "${currentFilename}"`, // 成功消息文本
            'generatorMessageArea',         // 指定消息区域 ID
            false                           // false 表示是内部数据
        );
    } catch (error) {
        console.error("Generator: 保存条目时出错:", error);
        // updateUserData 应该已经显示了错误消息
        success = false;
    } finally {
        // 清理写入计时器
        if (AppState.generator.writingTimerId) {
            clearInterval(AppState.generator.writingTimerId);
            AppState.generator.writingTimerId = null;
            AppState.generator.writingStartTime = null;
        }

        // 如果成功，计算并显示保存耗时
        if (success) {
            const saveDuration = ((Date.now() - saveOperationStartTime) / 1000).toFixed(1);
            // updateUserData 已经显示了成功消息，这里可以附加耗时
            if (DOM.generatorMessageArea?.classList.contains(UI_CLASSES.SUCCESS)) {
                 DOM.generatorMessageArea.textContent += ` (耗时 ${saveDuration}s)`;
            }
            // 设置短暂延时后清除成功消息，并查找下一张
            setTimeout(() => {
                console.debug("Generator: 保存成功，查找下一张未保存图片...");
                hideGeneratorMessage();
                findAndDisplayNextUnsavedImage(currentSelection);
            }, DELAYS.GENERATOR_NEXT_IMAGE_DELAY); // 使用常量
        } else {
            // 保存失败，错误消息已由 updateUserData 显示
            console.log("Generator: 保存失败或错误已处理。");
            // 可以在短暂延迟后尝试查找下一张，或者停留在当前界面让用户处理
             setTimeout(() => {
                 console.debug("Generator: 保存失败，尝试查找下一张...");
                 hideGeneratorMessage();
                 findAndDisplayNextUnsavedImage(currentSelection); // 即使失败也尝试找下一个？根据需求定
             }, 500); // 失败时延迟短一点
            // 如果需要用户手动处理，则不调用 findAndDisplayNextUnsavedImage
            // 并且可能需要重新启用保存按钮（如果错误是可重试的）
            // if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = false;
        }
        // 确保消息清除定时器被清除 (如果 updateUserData 没设置 duration)
        clearTimeout(AppState.messageClearTimer);
        AppState.messageClearTimer = null;
    }
}

/**
 * 在当前文件夹中查找并显示下一张未保存的图片。
 * @param {object} lastSavedImageInfo - 刚刚保存的图片信息对象。
 */
function findAndDisplayNextUnsavedImage(lastSavedImageInfo) {
    if (!lastSavedImageInfo?.folderName || !lastSavedImageInfo?.urlPath) {
        console.warn("Generator: 查找下一张图片的参数无效。", lastSavedImageInfo);
        resetGeneratorInterface(); // 参数无效，直接重置界面
        return;
    }

    const currentFolder = lastSavedImageInfo.folderName;
    console.log(`Generator: 在文件夹 "${currentFolder}" 中查找下一张未保存的图片...`);

    // 1. 从主图库数据中筛选出当前文件夹的图片
    const imagesInCurrentFolder = (AppState.galleryImages || [])
        .filter(img => img?.folderName === currentFolder)
        // 2. 按文件名排序 (含数字)
        .sort((a, b) => (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' }));

    if (imagesInCurrentFolder.length === 0) {
        console.log(`Generator: 文件夹 "${currentFolder}" 为空或未找到图片。`);
        resetGeneratorInterface(); // 文件夹为空，重置
        return;
    }

    // 3. 找到刚刚保存的图片在排序后列表中的索引
    const currentIndex = imagesInCurrentFolder.findIndex(img => img?.urlPath === lastSavedImageInfo.urlPath);

    let nextUnsavedImage = null;

    // 4. 从当前索引之后开始查找第一个未保存的图片
    if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < imagesInCurrentFolder.length; i++) {
            const potentialNext = imagesInCurrentFolder[i];
            // 检查图片路径是否存在且未在已保存路径 Set 中
            if (potentialNext?.urlPath && !AppState.userDataPaths.has(potentialNext.urlPath)) {
                nextUnsavedImage = potentialNext;
                console.log(`Generator: 找到下一张未保存图片: ${nextUnsavedImage.fileName}`);
                break; // 找到即停止
            }
        }
    } else {
        // 如果没找到刚保存的图片（理论上不应发生），则从头开始查找
        console.warn(`Generator: 未在排序列表中找到刚保存的图片 ${lastSavedImageInfo.urlPath}。将从头查找文件夹 "${currentFolder}" 中的未保存图片。`);
        for (let i = 0; i < imagesInCurrentFolder.length; i++) {
            const potentialNext = imagesInCurrentFolder[i];
            if (potentialNext?.urlPath && !AppState.userDataPaths.has(potentialNext.urlPath)) {
                nextUnsavedImage = potentialNext;
                console.log(`Generator: 从头找到未保存图片: ${nextUnsavedImage.fileName}`);
                break;
            }
        }
    }

    // 5. 处理查找结果
    if (nextUnsavedImage) {
        // 如果找到了，显示下一张图片
        displaySelectedImage(nextUnsavedImage);
    } else {
        // 如果没找到（当前文件夹所有图片都已保存）
        console.log(`Generator: 文件夹 "${currentFolder}" 中的所有图片都已处理完毕。`);
        displayToast(`文件夹 "${currentFolder}" 处理完毕！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
        resetGeneratorInterface(); // 重置界面
    }
}

/**
 * 处理生成器搜索框的输入事件。
 */
function handleGeneratorSearchInput() {
    if (AppState.isSettingInputProgrammatically) return; // 忽略程序化设置的输入

    const query = DOM.generatorSearchInput.value.trim();
    const currentSelectionText = AppState.generator.currentSelection
        ? `${AppState.generator.currentSelection.name || '?'} (${AppState.generator.currentSelection.fileName})`
        : '';

    // 如果用户正在输入且输入内容与当前选中的图片不符，则清空当前选择
    if (AppState.generator.currentSelection && query !== currentSelectionText) {
        console.log("Generator: 输入内容与当前选择不符，清空选择。");
        resetGeneratorInterface(); // 清空界面和状态
        // 注意：这里重置后 query 可能变为空，后续逻辑会处理
    }

    // 清除之前的搜索延迟计时器
    clearTimeout(AppState.generator.searchDelayTimer);
    AppState.generator.showingRelatedImages = false; // 输入时取消相关图片显示

    // 如果输入框为空，隐藏建议列表
    if (query === '') {
        if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
        AppState.generator.isShowingFolderSuggestions = false;
        return;
    }

    // 设置新的延迟计时器，执行搜索
    AppState.generator.searchDelayTimer = setTimeout(() => {
        // 确保在执行搜索时输入框内容没有再次改变
        if (DOM.generatorSearchInput.value.trim() === query) {
            console.log(`Generator: 触发搜索，关键词: "${query}"`);
            requestSearchFromWorker(query); // 请求后台 Worker 进行搜索
            AppState.generator.isShowingFolderSuggestions = false; // 搜索时显示图片建议，非文件夹
        } else {
            console.debug("Generator: 输入已改变，取消本次搜索。");
        }
    }, DELAYS.INPUT_DEBOUNCE); // 使用防抖延迟
}

/**
 * 处理生成器搜索框获得焦点事件。
 */
function handleGeneratorSearchFocus() {
    const currentValue = DOM.generatorSearchInput.value.trim();
    const currentSelectionText = AppState.generator.currentSelection
        ? `${AppState.generator.currentSelection.name || '?'} (${AppState.generator.currentSelection.fileName})`
        : '';

    if (currentValue === '') {
        // 输入框为空时，显示推荐的未完成文件夹
        const topFolders = findTopUnsavedFolders(); // 查找未完成文件夹
        displayFolderSuggestions(topFolders); // 显示文件夹建议
        AppState.generator.showingRelatedImages = false;
    } else if (AppState.generator.currentSelection && currentValue === currentSelectionText && !AppState.generator.showingRelatedImages) {
        // 输入框内容与当前选中一致，且未显示相关图片时，请求相关图片
        console.log("Generator: 焦点匹配当前选择，请求相关图片...");
        requestSiblingImagesFromWorker(AppState.generator.currentSelection);
        AppState.generator.showingRelatedImages = true;
        AppState.generator.isShowingFolderSuggestions = false;
    } else if (!AppState.generator.currentSelection || currentValue !== currentSelectionText) {
        // 没有选中项，或者输入内容与选中项不符，执行搜索
        console.log("Generator: 焦点不匹配或无选择，执行搜索...");
        requestSearchFromWorker(currentValue);
        AppState.generator.showingRelatedImages = false;
        AppState.generator.isShowingFolderSuggestions = false;
    }
    // 如果是其他情况（例如已显示相关图片），则不执行操作
}

/**
 * 显示搜索建议列表 (图片或文件夹)。
 * @param {Array<object|string>} results - 搜索结果数组 (图片信息对象或文件夹名称字符串)。
 * @param {boolean} [isFolderList=false] - true 表示结果是文件夹列表，false 表示是图片列表。
 */
function displaySuggestions(results, isFolderList = false) {
    if (!DOM.generatorSuggestionList) {
        console.error("Generator: 建议列表 DOM 元素 'suggestions' 未找到！");
        return;
    }
    const suggestionList = DOM.generatorSuggestionList;
    suggestionList.innerHTML = ''; // 清空旧建议

    if (!Array.isArray(results) || results.length === 0) {
        suggestionList.classList.add(UI_CLASSES.HIDDEN); // 无结果则隐藏
        AppState.generator.isShowingFolderSuggestions = false;
        console.debug("Generator: 无建议结果，隐藏列表。");
        return;
    }

    console.debug(`Generator: 准备显示 ${results.length} 条 ${isFolderList ? '文件夹' : '图片'} 建议。`);
    AppState.generator.isShowingFolderSuggestions = isFolderList; // 更新状态

    const fragment = document.createDocumentFragment(); // 使用文档片段提高性能

    if (isFolderList) {
        // --- 显示文件夹建议 ---
        results.forEach(folderName => {
            if (typeof folderName !== 'string') return; // 跳过非字符串项
            const item = document.createElement('div');
            item.className = 'suggestion-item folder-suggestion'; // 应用样式
            item.innerHTML = `📂 <span class="suggestion-text">${folderName}</span>`; // 显示文件夹图标和名称
            item.style.cursor = 'pointer'; // 设置鼠标样式
            // 点击文件夹建议的操作：填充搜索框，隐藏列表，聚焦输入框
            item.onclick = () => {
                if (DOM.generatorSearchInput) DOM.generatorSearchInput.value = folderName;
                suggestionList.classList.add(UI_CLASSES.HIDDEN);
                AppState.generator.isShowingFolderSuggestions = false;
                if (DOM.generatorSearchInput) DOM.generatorSearchInput.focus(); // 触发 focus 事件重新搜索该文件夹
            };
            fragment.appendChild(item);
        });
    } else {
        // --- 显示图片建议 ---
        // 1. 过滤掉无效条目和已保存的图片
        const validUnsavedImages = results.filter(imgInfo =>
            imgInfo?.urlPath && !AppState.userDataPaths.has(imgInfo.urlPath)
        );

        // 2. 对过滤后的结果按文件名排序
        validUnsavedImages.sort((a, b) =>
            (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' })
        );

        if (validUnsavedImages.length === 0) {
            // 如果过滤后没有未保存的图片，也隐藏列表
            suggestionList.classList.add(UI_CLASSES.HIDDEN);
            console.debug("Generator: 所有图片建议均已保存，隐藏列表。");
            return;
        }

        console.debug(`Generator: 显示 ${validUnsavedImages.length} 条未保存的图片建议。`);

        // 3. 创建并添加图片建议项
        validUnsavedImages.forEach(imgInfo => {
            const item = document.createElement('div');
            item.className = 'suggestion-item image-suggestion'; // 应用样式

            // 创建图片缩略图元素
            const imgElement = document.createElement('img');
            const imageWebPath = imgInfo.urlPath.startsWith('/') ? imgInfo.urlPath : `/${imgInfo.urlPath}`;
            imgElement.alt = imgInfo.name || '建议图片';
            imgElement.style.cssText = 'width:40px; height:40px; object-fit:cover; margin-right:10px; border-radius:4px; flex-shrink:0;'; // 内联样式
            imgElement.onerror = function() { this.style.display='none'; }; // 加载失败隐藏

            // 使用懒加载
            if (lazyLoadObserver) {
                imgElement.dataset.src = imageWebPath; // 将真实 src 存入 data-src
                imgElement.src = ''; // 初始 src 为空
                lazyLoadObserver.observe(imgElement); // 开始观察
            } else {
                // 如果懒加载不可用，直接加载
                console.warn("Generator: LazyLoadObserver 不可用，直接加载图片:", imageWebPath);
                imgElement.src = imageWebPath;
                imgElement.loading = 'lazy'; // 使用浏览器原生懒加载作为后备
            }

            // 创建文本信息元素
            const textSpan = document.createElement('span');
            textSpan.className = 'suggestion-text';
            textSpan.textContent = `${imgInfo.name || '?'} (${imgInfo.fileName})`; // 显示名称和文件名
            textSpan.title = `${imgInfo.folderName}/${imgInfo.fileName}`; // 鼠标悬停显示完整路径

            // 组装建议项
            item.appendChild(imgElement);
            item.appendChild(textSpan);
            item.onclick = () => displaySelectedImage(imgInfo); // 点击显示图片详情
            fragment.appendChild(item);
        });
    }

    // 将所有建议项一次性添加到列表中，并显示列表
    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN);
    console.debug("Generator: 建议列表已更新并显示。");
}

/**
 * 查找未保存图片数量最多的前 N 个文件夹。
 * @param {number} [limit=5] - 返回的文件夹数量上限。
 * @returns {Array<string>} 按未保存数量降序排列的文件夹名称数组。
 */
function findTopUnsavedFolders(limit = 5) {
    const unsavedCounts = {}; // 存储每个文件夹的未保存图片数量
    const allFolders = new Set(); // 存储所有出现过的文件夹名称

    if (!AppState.galleryImages?.length) return []; // 如果没有图库数据，返回空

    // 遍历所有图库图片
    for (const img of AppState.galleryImages) {
        if (!img?.folderName || !img.urlPath) continue; // 跳过无效数据

        allFolders.add(img.folderName); // 记录文件夹名称

        // 如果图片未保存，增加对应文件夹的计数
        if (!AppState.userDataPaths.has(img.urlPath)) {
            unsavedCounts[img.folderName] = (unsavedCounts[img.folderName] || 0) + 1;
        }
    }

    // 将计数对象转换为 [文件夹名, 数量] 的数组，并按数量降序排序
    const sortedFolders = Object.entries(unsavedCounts)
        .sort(([, countA], [, countB]) => countB - countA) // 按数量降序
        .map(([folderName]) => folderName); // 只取文件夹名称

    // 返回排序后的前 limit 个文件夹
    return sortedFolders.slice(0, limit);
}

/**
 * 显示文件夹建议列表。
 * @param {Array<string>} folderNames - 要显示的文件夹名称数组。
 */
function displayFolderSuggestions(folderNames) {
    displaySuggestions(folderNames, true); // 调用通用显示函数，并标记为文件夹列表
}

// --------------------------------------------------------------------------
// Web Worker 交互 (Generator Specific)
// --------------------------------------------------------------------------

/**
 * 初始化后台搜索 Web Worker。
 */
function initializeGeneratorSearchWorker() {
    // 检查浏览器是否支持 Worker
    if (typeof Worker === 'undefined') {
        console.warn("Generator: 浏览器不支持 Web Worker，后台搜索功能无法启用。");
        if (DOM.generatorSearchInput) {
            DOM.generatorSearchInput.placeholder = "后台搜索不可用";
            DOM.generatorSearchInput.disabled = true;
        }
        return;
    }

    // 检查是否有图库数据
    if (!AppState.galleryImages?.length) {
        console.warn("Generator: 图库数据尚未加载，无法初始化 Worker。");
        // 搜索框应在数据加载失败时已被禁用
        return;
    }

    // 如果已有 Worker 实例，先终止旧的
    if (AppState.generator.backgroundWorker) {
        console.log("Generator: 终止旧的后台搜索 Worker 实例...");
        AppState.generator.backgroundWorker.terminate();
        AppState.generator.backgroundWorker = null;
    }

    try {
        console.log("Generator: 创建新的后台搜索 Worker...");
        AppState.generator.backgroundWorker = new Worker('searchworker.js'); // Worker 脚本文件名

        // 设置消息和错误处理函数
        AppState.generator.backgroundWorker.onmessage = handleWorkerMessage;
        AppState.generator.backgroundWorker.onerror = handleWorkerError;

        console.log("Generator: 向 Worker 发送初始图库数据...");
        // 发送初始数据给 Worker
        AppState.generator.backgroundWorker.postMessage({
            type: 'loadData',
            payload: {
                availableImages: AppState.galleryImages || [], // 发送所有图库图片信息
                existingPaths: Array.from(AppState.userDataPaths) // 发送已保存路径 Set 转成的数组
            }
        });

        // Worker 初始化成功，启用搜索框
        if (DOM.generatorSearchInput) {
            DOM.generatorSearchInput.disabled = false;
            DOM.generatorSearchInput.placeholder = `搜索 ${AppState.galleryImages.length} 张图片...`; // 更新占位符
            console.log("Generator: 后台搜索 Worker 初始化成功，搜索框已启用。");
        }
    } catch (error) {
        console.error("Generator: 创建后台搜索 Worker 失败:", error);
        displayToast("后台搜索初始化失败", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        AppState.generator.backgroundWorker = null; // 创建失败，重置 Worker 状态
        if (DOM.generatorSearchInput) {
            DOM.generatorSearchInput.disabled = true;
            DOM.generatorSearchInput.placeholder = "后台搜索故障";
        }
    }
}

/**
 * 处理来自 Web Worker 的消息。
 * @param {MessageEvent} event - Worker 发送的消息事件。
 */
function handleWorkerMessage(event) {
    // 检查消息结构是否有效
    if (!event.data?.type) {
        console.warn("Generator: 收到来自 Worker 的无效消息:", event.data);
        return;
    }

    const { type, payload } = event.data;
    console.debug(`[主线程] 收到 Worker 消息: ${type}`, payload ? '(含数据)' : '');

    switch (type) {
        case 'searchResults':
            // 检查是否是当前最新查询的结果
            if (payload?.query === AppState.generator.lastQuerySentToWorker) {
                console.log(`[主线程] 收到查询 "${payload.query}" 的搜索结果 (${payload.results?.length || 0} 条)。`);
                displaySuggestions(payload.results || [], false); // 显示图片建议
            } else {
                // 忽略过时的搜索结果
                console.debug(`[主线程] 忽略过时的搜索结果 (查询: ${payload?.query}, 最新查询: ${AppState.generator.lastQuerySentToWorker})`);
            }
            break;

        case 'siblingResults':
            // 处理相关图片（同级图片）的搜索结果
            if (payload && Array.isArray(payload.results)) {
                console.log(`[主线程] 收到相关图片结果 (${payload.results.length} 条)。`);
                displaySuggestions(payload.results || [], false); // 显示图片建议
            } else {
                console.warn("[主线程] 收到的相关图片结果格式无效:", payload);
            }
            break;

        case 'dataLoaded':
            // Worker 确认数据已加载
            console.log("Generator Worker: 确认数据加载完成。");
            break;

        case 'error':
            // Worker 内部发生错误
            console.error("Generator Worker 报告错误:", payload?.message, payload?.error);
            displayToast(`后台搜索出错: ${payload?.message || '未知错误'}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
            // 禁用搜索框，防止进一步使用
            if (DOM.generatorSearchInput) {
                DOM.generatorSearchInput.disabled = true;
                DOM.generatorSearchInput.placeholder = "后台搜索故障";
            }
            // 可以考虑终止 Worker
            // if (AppState.generator.backgroundWorker) {
            //     AppState.generator.backgroundWorker.terminate();
            //     AppState.generator.backgroundWorker = null;
            // }
            break;

        default:
            // 未知类型的消息
            console.warn("[主线程] 收到未知的 Worker 消息类型:", type, payload);
    }
}

/**
 * 处理 Web Worker 发生的严重错误。
 * @param {ErrorEvent} error - Worker 错误事件对象。
 */
function handleWorkerError(error) {
    console.error('[主线程] 后台搜索 Worker 发生严重错误:', error.message, error.filename, error.lineno, error);
    displayToast('后台搜索发生严重错误，已禁用', UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);

    // 禁用搜索框
    if (DOM.generatorSearchInput) {
        DOM.generatorSearchInput.disabled = true;
        DOM.generatorSearchInput.placeholder = "后台搜索已禁用";
    }

    // 终止 Worker 实例
    if (AppState.generator.backgroundWorker) {
        AppState.generator.backgroundWorker.terminate();
        AppState.generator.backgroundWorker = null;
    }
}

/**
 * 向 Web Worker 发送搜索请求。
 * @param {string} query - 搜索关键词。
 */
function requestSearchFromWorker(query) {
    AppState.generator.lastQuerySentToWorker = query; // 记录最后发送的查询
    if (AppState.generator.backgroundWorker) {
        console.debug(`Generator: 向 Worker 发送搜索请求: "${query}"`);
        AppState.generator.backgroundWorker.postMessage({ type: 'search', payload: { query: query } });
    } else {
        console.warn("Generator: 后台搜索 Worker 不可用，无法发送搜索请求。");
        displayToast('后台搜索功能当前不可用', UI_CLASSES.WARNING);
        displaySuggestions([]); // 清空建议列表
    }
}

/**
 * 向 Web Worker 请求当前图片的同级（相同文件夹）图片。
 * @param {object} currentImageInfo - 当前选中的图片信息对象。
 */
function requestSiblingImagesFromWorker(currentImageInfo) {
    if (AppState.generator.backgroundWorker) {
        console.debug(`Generator: 向 Worker 请求相关图片 (文件夹: ${currentImageInfo.folderName})...`);
        AppState.generator.backgroundWorker.postMessage({ type: 'findSiblings', payload: { currentImageInfo: currentImageInfo } });
    } else {
        console.warn("Generator: 后台搜索 Worker 不可用，无法请求相关图片。");
        displayToast('后台搜索功能当前不可用', UI_CLASSES.WARNING);
        displaySuggestions([]); // 清空建议列表
    }
}


// --------------------------------------------------------------------------
// 事件监听器设置 (Generator Specific)
// --------------------------------------------------------------------------
/**
 * 设置 JSON 生成器视图内的事件监听器。
 */
function setupGeneratorEventListeners() {
    // 搜索框事件: focus, input, click (click 用于在已有内容时触发 focus 逻辑)
    if (DOM.generatorSearchInput) {
        DOM.generatorSearchInput.removeEventListener('focus', handleGeneratorSearchFocus);
        DOM.generatorSearchInput.removeEventListener('input', handleGeneratorSearchInput);
        DOM.generatorSearchInput.removeEventListener('click', handleGeneratorSearchFocus); // 使用 focus 处理函数
        DOM.generatorSearchInput.addEventListener('focus', handleGeneratorSearchFocus);
        DOM.generatorSearchInput.addEventListener('input', handleGeneratorSearchInput);
        DOM.generatorSearchInput.addEventListener('click', handleGeneratorSearchFocus);
    } else { console.error("Generator: 搜索框 (searchInput) 未找到。"); }

    // 保存按钮事件
    if (DOM.generatorSaveButton) {
        DOM.generatorSaveButton.removeEventListener('click', saveGeneratedEntry);
        DOM.generatorSaveButton.addEventListener('click', saveGeneratedEntry);
    } else { console.error("Generator: 保存按钮 (saveButton) 未找到。"); }

    // 属性控件事件 (Radio 和 Checkbox 的 change 事件)
    // 将所有需要监听 change 事件以更新保存按钮状态的控件放入一个数组
    const attributeControls = [
        ...(DOM.generatorRatingRadios || []),
        ...(DOM.generatorLayoutRadios || []),
        DOM.generatorIsEasterEggCheckbox,
        DOM.generatorIsAiImageCheckbox
    ];
    attributeControls.forEach(control => {
        if (control) {
            // 监听 change 事件，触发保存按钮状态更新
            control.removeEventListener('change', updateGeneratorSaveButtonState);
            control.addEventListener('change', updateGeneratorSaveButtonState);
        }
    });

    console.log("Generator: 事件监听器设置完成。");
}

/**
 * 更新 Generator 面板的总条目计数显示。
 */
function updateGeneratorEntryCount() {
     if (DOM.generatorEntryCountDisplay) {
         DOM.generatorEntryCountDisplay.textContent = `Json数据量: ${AppState.userData.length} 条`;
     }
}


