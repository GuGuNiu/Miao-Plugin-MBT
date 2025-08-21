// ==========================================================================
// GuTools JSON 生成器: 依赖全局事件总线
// ==========================================================================

/**
 * 重置 JSON 生成器界面到初始状态，清空所有输入和预览。
 */
function resetGeneratorInterface() {
  clearInterval(AppState.generator.writingTimerId);
  clearTimeout(AppState.generator.successTimerId);
  AppState.generator.writingTimerId = null;
  AppState.generator.successTimerId = null;

  AppState.isSettingInputProgrammatically = true; // 设置一个标志位，防止触发不必要的 input 事件
  if (DOM.generatorSearchInput) DOM.generatorSearchInput.value = "";
  if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
  clearFileInfoDisplay();
  AppState.generator.currentSelection = null;
  AppState.generator.currentGeneratedId = null;
  AppState.generator.currentCalculatedMd5 = null;
  hideGeneratorMessage();
  setTimeout(() => { AppState.isSettingInputProgrammatically = false; }, 50); // 短暂延迟后清除标志位
}

/**
 * 清除图片预览区域、属性表单和信息显示，恢复到默认状态。
 */
function clearFileInfoDisplay() {
  if (DOM.generatorPreviewImage) {
    DOM.generatorPreviewImage.src = "";
    DOM.generatorPreviewImage.alt = "图片预览";
    DOM.generatorPreviewImage.classList.add(UI_CLASSES.HIDDEN);
  }
  if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;

  // 重置表单元素到默认值
  const defaultRatingRadio = document.querySelector('input[name="rating"][value="none"]');
  if (defaultRatingRadio) defaultRatingRadio.checked = true;
  const defaultLayoutRadio = document.querySelector('input[name="layout"][value="normal"]');
  if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
  if (DOM.generatorIsEasterEggCheckbox) DOM.generatorIsEasterEggCheckbox.checked = false;
  if (DOM.generatorIsAiImageCheckbox) DOM.generatorIsAiImageCheckbox.checked = false;

  // 清空信息显示区域
  if (DOM.generatorMd5DisplayInput) DOM.generatorMd5DisplayInput.value = "";
  if (DOM.generatorIdDisplayInput) DOM.generatorIdDisplayInput.value = "";
  if (DOM.generatorStorageBoxDisplay) DOM.generatorStorageBoxDisplay.classList.add(UI_CLASSES.HIDDEN);
  highlightGameTag("");
}

/**
 * 根据图片的来源图库代码，高亮显示对应的游戏标签。
 * @param {string} galleryCode - 图库的文件夹名，例如 'gs-character'。
 */
function highlightGameTag(galleryCode) {
  if (!DOM.generatorGameTags || Object.values(DOM.generatorGameTags).some((tag) => !tag)) return;
  Object.values(DOM.generatorGameTags).forEach((tagElement) =>
    tagElement.classList.remove(UI_CLASSES.ACTIVE, "gs", "sr", "zzz", "waves")
  );
  let activeTagKey = null;
  switch (galleryCode) {
    case "gs-character": activeTagKey = "gs"; break;
    case "sr-character": activeTagKey = "sr"; break;
    case "zzz-character": activeTagKey = "zzz"; break;
    case "waves-character": activeTagKey = "waves"; break;
  }
  if (activeTagKey && DOM.generatorGameTags[activeTagKey]) {
    DOM.generatorGameTags[activeTagKey].classList.add(UI_CLASSES.ACTIVE, activeTagKey);
  }
}

/**
 * 根据当前状态（图片是否加载、数据是否有效、是否已保存）更新保存按钮的可用性。
 */
function updateGeneratorSaveButtonState() {
  if (!DOM.generatorSaveButton) return;
  const { currentSelection, currentGeneratedId, currentCalculatedMd5 } = AppState.generator;
  const isImageLoaded = DOM.generatorPreviewImage && !DOM.generatorPreviewImage.classList.contains(UI_CLASSES.HIDDEN) && DOM.generatorPreviewImage.src;
  const isDataValid = currentSelection && currentGeneratedId && currentCalculatedMd5 && currentCalculatedMd5 !== "计算失败";
  
  const fullWebPath = currentSelection ? buildFullWebPath(currentSelection.storageBox, currentSelection.urlPath) : null;
  const isAlreadySaved = fullWebPath ? AppState.userDataPaths.has(fullWebPath) : false;

  DOM.generatorSaveButton.disabled = !(isImageLoaded && isDataValid && !isAlreadySaved);
}

/**
 * 当用户从建议列表中选择一张图片后，更新整个界面以显示该图片的信息。
 * @param {object} imageInfo - 包含所选图片详细信息的对象。
 */
async function displaySelectedImage(imageInfo) {
  if (!imageInfo?.urlPath || !imageInfo.storageBox) {
    displayGeneratorMessage("错误：选择的图片信息无效", UI_CLASSES.ERROR);
    resetGeneratorInterface();
    return;
  }

  AppState.generator.currentSelection = { ...imageInfo };
  hideGeneratorMessage();
  if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
  
  AppState.isSettingInputProgrammatically = true;
  if (DOM.generatorSearchInput) DOM.generatorSearchInput.value = `${imageInfo.name || "未知"} (${imageInfo.fileName})`;
  setTimeout(() => { AppState.isSettingInputProgrammatically = false; }, 50);

  highlightGameTag(imageInfo.gallery);
  if (DOM.generatorStorageBoxDisplay) {
    DOM.generatorStorageBoxDisplay.textContent = `仓库: ${imageInfo.storageBox}`;
    DOM.generatorStorageBoxDisplay.classList.remove(UI_CLASSES.HIDDEN);
  }

  clearFileInfoDisplay();
  if (DOM.generatorAttributesPanel) DOM.generatorAttributesPanel.classList.remove(UI_CLASSES.INITIALLY_HIDDEN);

  const fullWebPath = buildFullWebPath(imageInfo.storageBox, imageInfo.urlPath);
  if (DOM.generatorPreviewImage) {
    DOM.generatorPreviewImage.src = fullWebPath;
    DOM.generatorPreviewImage.alt = imageInfo.name || "图片预览";
    DOM.generatorPreviewImage.classList.remove(UI_CLASSES.HIDDEN);
    DOM.generatorPreviewImage.style.display = 'block';
  }
  
  AppState.generator.currentGeneratedId = generateNumericId();
  if (DOM.generatorIdDisplayInput) DOM.generatorIdDisplayInput.value = AppState.generator.currentGeneratedId;
  
  if (DOM.generatorMd5DisplayInput) DOM.generatorMd5DisplayInput.placeholder = "计算中...";
  const md5 = await fetchImageMd5(fullWebPath);
  AppState.generator.currentCalculatedMd5 = md5 || "计算失败";
  if (DOM.generatorMd5DisplayInput) DOM.generatorMd5DisplayInput.value = AppState.generator.currentCalculatedMd5;

  updateGeneratorSaveButtonState();
}

/**
 * 查找下一个待处理的任务（图片）。
 * 优先在当前文件夹内查找，如果完成，则查找下一个未完成的文件夹。
 * @param {object} lastSavedInfo - 刚刚被成功保存的图片信息对象。
 * @returns {Promise<{nextImage: object, isNewFolder: boolean} | null>} - 返回任务对象或 null。
 */
async function findNextTask(lastSavedInfo) {
    const getFirstUnsavedInFolder = (storageBox, folderName) => {
        const imagesInFolder = AppState.galleryImages
            .filter(img => img.storageBox === storageBox && img.folderName === folderName)
            .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' }));

        for (const image of imagesInFolder) {
            const fullWebPath = buildFullWebPath(image.storageBox, image.urlPath);
            if (!AppState.userDataPaths.has(fullWebPath)) {
                return image;
            }
        }
        return null;
    };

    let nextImage = getFirstUnsavedInFolder(lastSavedInfo.storageBox, lastSavedInfo.folderName);
    if (nextImage) {
        return { nextImage: nextImage, isNewFolder: false };
    }

    const allUnsavedFolders = findTopUnsavedFolders(Infinity);
    if (allUnsavedFolders.length > 0) {
        const nextFolderId = allUnsavedFolders[0];
        const [nextStorageBox, nextFolderName] = nextFolderId.split('/');
        nextImage = getFirstUnsavedInFolder(nextStorageBox, nextFolderName);
        if (nextImage) {
            displayToast(`开始处理新文件夹: ${nextFolderName}`, UI_CLASSES.INFO, 2500);
            return { nextImage: nextImage, isNewFolder: true };
        }
    }

    return null;
}


/**
 * 收集当前界面的所有属性，构建一个新的 JSON 条目，并发送到后端保存。
 */
async function saveGeneratedEntry() {
    const { currentSelection, currentGeneratedId, currentCalculatedMd5 } = AppState.generator;
    if (!currentSelection || !currentGeneratedId || !currentCalculatedMd5 || currentCalculatedMd5 === "计算失败") {
        displayGeneratorMessage("错误：数据不完整，无法保存。", UI_CLASSES.ERROR);
        return;
    }

    clearInterval(AppState.generator.writingTimerId);
    AppState.generator.writingStartTime = Date.now();
    DOM.generatorSaveButton.disabled = true;

    AppState.generator.writingTimerId = setInterval(() => {
        const elapsed = ((Date.now() - AppState.generator.writingStartTime) / 1000).toFixed(1);
        displayGeneratorMessage(`${currentSelection.fileName} 正在保存... (${elapsed}s)`, UI_CLASSES.INFO, null);
    }, 100);

    const ratingRadio = document.querySelector('input[name="rating"]:checked');
    const layoutRadio = document.querySelector('input[name="layout"]:checked');
    const isEasterEgg = DOM.generatorIsEasterEggCheckbox?.checked ?? false;
    const isAiImage = DOM.generatorIsAiImageCheckbox?.checked ?? false;

    const newEntry = {
        storagebox: currentSelection.storageBox,
        gid: currentGeneratedId,
        characterName: currentSelection.name || "Unknown",
        path: currentSelection.urlPath,
        attributes: {
            filename: currentSelection.fileName,
            parentFolder: currentSelection.folderName,
            isPx18: ratingRadio?.value === "px18",
            isRx18: ratingRadio?.value === "rx18",
            layout: layoutRadio?.value || "normal",
            isEasterEgg,
            isAiImage,
            isBan: false,
            md5: currentCalculatedMd5,
            Downloaded_From: "GuTools-Generator",
            secondaryTags: [],
        },
        timestamp: new Date().toISOString(),
        sourceGallery: currentSelection.gallery,
    };

    const success = await updateUserData([...AppState.userData, newEntry], `成功添加 "${newEntry.attributes.filename}"`, "messageArea", false, null, false);
    
    clearInterval(AppState.generator.writingTimerId);

    if (success) {
        const lastSavedInfo = { ...currentSelection };

        AppState.generator.successStartTime = Date.now();
        AppState.generator.successTimerId = setInterval(() => {
            const remaining = (DELAYS.GENERATOR_NEXT_IMAGE_DELAY - (Date.now() - AppState.generator.successStartTime)) / 1000;
            if (remaining > 0) {
                displayGeneratorMessage(`${lastSavedInfo.fileName} 保存成功！(${remaining.toFixed(1)}s后加载下一张)`, UI_CLASSES.SUCCESS, null);
            } else {
                 clearInterval(AppState.generator.successTimerId);
            }
        }, 100);
        
        const nextTask = await findNextTask(lastSavedInfo);

        setTimeout(() => {
            clearInterval(AppState.generator.successTimerId);
            if (nextTask) {
                displaySelectedImage(nextTask.nextImage);
            } else {
                displayGeneratorMessage(`所有图片已全部录入！`, UI_CLASSES.SUCCESS, 4000);
                setTimeout(resetGeneratorInterface, 4000);
            }
        }, DELAYS.GENERATOR_NEXT_IMAGE_DELAY);

    } else {
        DOM.generatorSaveButton.disabled = false;
    }
}


/**
 * 处理搜索框的输入事件，使用防抖机制向 Worker 发送搜索请求。
 */
function handleGeneratorSearchInput() {
    if (AppState.isSettingInputProgrammatically) return;
    const query = DOM.generatorSearchInput.value.trim();

    if (AppState.generator.currentSelection && query !== `${AppState.generator.currentSelection.name} (${AppState.generator.currentSelection.fileName})`) {
        resetGeneratorInterface();
    }
    
    clearTimeout(AppState.generator.searchDelayTimer);
    if (!query) {
        if (DOM.generatorSuggestionList) DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
        return;
    }

    AppState.generator.searchDelayTimer = setTimeout(() => {
        if (DOM.generatorSearchInput.value.trim() === query) {
            requestSearchFromWorker(query, 'unsaved_physical');
        }
    }, DELAYS.INPUT_DEBOUNCE);
}

/**
 * 处理搜索框获得焦点或被点击的事件。
 */
function handleGeneratorSearchFocus() {
    const query = DOM.generatorSearchInput.value.trim();
    if (query) {
        requestSearchFromWorker(query, 'unsaved_physical');
    } else {
        const topFolders = findTopUnsavedFolders();
        displaySuggestions(topFolders, true);
    }
}

/**
 * 根据 Worker 返回的结果，渲染建议列表（图片或文件夹）。
 * @param {Array<object|string>} results - 搜索结果数组。
 * @param {boolean} [isFolderList=false] - 标记结果是否为文件夹列表。
 */
function displaySuggestions(results, isFolderList = false) {
    if (!DOM.generatorSuggestionList) return;
    const suggestionList = DOM.generatorSuggestionList;
    suggestionList.innerHTML = '';
    
    if (!Array.isArray(results) || results.length === 0) {
        suggestionList.classList.add(UI_CLASSES.HIDDEN);
        return;
    }

    const fragment = document.createDocumentFragment();
    if (isFolderList) {
        results.forEach(folderIdentifier => {
            const item = document.createElement('div');
            item.className = 'suggestion-item folder-suggestion';
            item.innerHTML = `📂 <span class="suggestion-text">${folderIdentifier}</span>`;
            item.onclick = () => {
                const folderNameOnly = folderIdentifier.split('/')[1] || folderIdentifier;
                if (DOM.generatorSearchInput) {
                    DOM.generatorSearchInput.value = folderNameOnly;
                    handleGeneratorSearchInput();
                }
                suggestionList.classList.add(UI_CLASSES.HIDDEN);
            };
            fragment.appendChild(item);
        });
    } else {
        results.slice(0, 50).forEach(imgInfo => {
            const item = document.createElement('div');
            item.className = 'suggestion-item image-suggestion';
            const imageWebPath = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);
            
            item.innerHTML = `<img src="/api/thumbnail${imageWebPath}" class="suggestion-thumbnail" loading="lazy" alt="${imgInfo.fileName}">
                              <div class="suggestion-text-wrapper">
                                  <span class="suggestion-main-text">${imgInfo.name || '?'} (${imgInfo.fileName})</span>
                                  <span class="suggestion-sub-text">${imgInfo.storageBox || '未知'}</span>
                              </div>`;
            
            item.onclick = () => displaySelectedImage(imgInfo);
            fragment.appendChild(item);
        });
    }
    
    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN);
}

/**
 * 在主线程中计算并返回未录入图片最多的文件夹列表，作为默认建议。
 * @param {number} [limit=5] - 返回的文件夹数量上限。
 * @returns {Array<string>} - "仓库/文件夹" 格式的字符串数组。
 */
function findTopUnsavedFolders(limit = 5) {
    const folderStats = {};
    AppState.galleryImages.forEach(img => {
        if (!img?.folderName || !img.urlPath || !img.storageBox) return;
        const fullWebPath = buildFullWebPath(img.storageBox, img.urlPath);
        if (!AppState.userDataPaths.has(fullWebPath)) {
            const folderId = `${img.storageBox}/${img.folderName}`;
            folderStats[folderId] = (folderStats[folderId] || 0) + 1;
        }
    });

    return Object.entries(folderStats)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, limit)
        .map(([folderId]) => folderId);
}

/**
 * 向 Web Worker 发送一个特定数据源的搜索请求。
 * @param {string} query - 搜索关键词。
 * @param {string} dataSource - 'unsaved_physical' 或 'indexed'。
 */
function requestSearchFromWorker(query, dataSource) {
    if (searchWorker) {
        searchWorker.postMessage({ type: "search", payload: { query, dataSource } });
    } else {
        console.warn("Generator: Worker 不可用");
        displayToast("后台搜索功能当前不可用", UI_CLASSES.WARNING);
    }
}

/**
 * 绑定所有属于 JSON 生成器面板的 DOM 事件监听器。
 */
function setupGeneratorEventListeners() {
  if (DOM.generatorSearchInput) {
    DOM.generatorSearchInput.addEventListener("input", handleGeneratorSearchInput);
    DOM.generatorSearchInput.addEventListener("focus", handleGeneratorSearchFocus);
    DOM.generatorSearchInput.addEventListener("click", handleGeneratorSearchFocus);
  }
  if (DOM.generatorSaveButton) {
    DOM.generatorSaveButton.addEventListener("click", saveGeneratedEntry);
  }

  AppEvents.on('workerSearchResults', (payload) => {
      if (DOM.generatorPaneView?.classList.contains("active")) {
          displaySuggestions(payload.results);
      }
  });
}

/**
 * 更新 Generator 面板右下角显示的 JSON 数据总量。
 */
function updateGeneratorEntryCount() {
  if (DOM.generatorEntryCountDisplay) {
    DOM.generatorEntryCountDisplay.textContent = `Json数据量: ${AppState.userData.length} 条`;
  }
}