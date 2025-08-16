// ==========================================================================
// GuTools JSON 生成器: 处理图片搜索 预览 属性设置和 JSON 条目保存
// ==========================================================================

/**
 * 重置 JSON 生成器界面到初始状态
 */
function resetGeneratorInterface() {
  console.log("Generator: 重置界面...");
  AppState.isSettingInputProgrammatically = true;
  if (DOM.generatorSearchInput) DOM.generatorSearchInput.value = "";
  if (DOM.generatorSuggestionList)
    DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
  clearFileInfoDisplay();
  AppState.generator.showingRelatedImages = false;
  AppState.generator.isShowingFolderSuggestions = false;
  AppState.generator.currentSelection = null;
  AppState.generator.currentGeneratedId = null;
  AppState.generator.currentCalculatedMd5 = null;
  hideGeneratorMessage();
  setTimeout(() => {
    AppState.isSettingInputProgrammatically = false;
  }, 50);
}

/**
 * 清除图片预览区域及相关信息显示
 */
function clearFileInfoDisplay() {
  if (DOM.generatorPreviewImage) {
    DOM.generatorPreviewImage.classList.remove(UI_CLASSES.FADE_IN);
    DOM.generatorPreviewImage.classList.add(UI_CLASSES.FADE_OUT);
    setTimeout(() => {
      if (DOM.generatorPreviewImage) {
        DOM.generatorPreviewImage.src = "";
        DOM.generatorPreviewImage.alt = "选择图片";
        DOM.generatorPreviewImage.classList.add(UI_CLASSES.HIDDEN);
        DOM.generatorPreviewImage.style.display = "none";
        DOM.generatorPreviewImage.classList.remove(UI_CLASSES.FADE_OUT);
      }
    }, 300);
  }
  if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
  const defaultRatingRadio = document.querySelector(
    'input[name="rating"][value="none"]'
  );
  const defaultLayoutRadio = document.querySelector(
    'input[name="layout"][value="normal"]'
  );
  if (defaultRatingRadio) defaultRatingRadio.checked = true;
  if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
  if (DOM.generatorIsEasterEggCheckbox)
    DOM.generatorIsEasterEggCheckbox.checked = false;
  if (DOM.generatorIsAiImageCheckbox)
    DOM.generatorIsAiImageCheckbox.checked = false;
  if (DOM.generatorMd5DisplayInput) {
    DOM.generatorMd5DisplayInput.value = "";
    DOM.generatorMd5DisplayInput.placeholder = "...";
  }
  if (DOM.generatorIdDisplayInput) {
    DOM.generatorIdDisplayInput.value = "";
    DOM.generatorIdDisplayInput.placeholder = "...";
  }
  if (DOM.generatorStorageBoxDisplay) {
    DOM.generatorStorageBoxDisplay.textContent = "";
    DOM.generatorStorageBoxDisplay.classList.add(UI_CLASSES.HIDDEN);
  }
  highlightGameTag("");
}

/**
 * 根据图库代码高亮对应的游戏标签
 * @param {string} galleryCode 图库代码 e.g., 'gs-character'
 */
function highlightGameTag(galleryCode) {
  if (
    !DOM.generatorGameTags ||
    Object.values(DOM.generatorGameTags).some((tag) => !tag)
  )
    return;
  Object.values(DOM.generatorGameTags).forEach((tagElement) =>
    tagElement.classList.remove(UI_CLASSES.ACTIVE, "gs", "sr", "zzz", "waves")
  );
  let activeTagKey = null;
  switch (galleryCode) {
    case "gs-character":
      activeTagKey = "gs";
      break;
    case "sr-character":
      activeTagKey = "sr";
      break;
    case "zzz-character":
      activeTagKey = "zzz";
      break;
    case "waves-character":
      activeTagKey = "waves";
      break;
  }
  if (activeTagKey && DOM.generatorGameTags[activeTagKey]) {
    DOM.generatorGameTags[activeTagKey].classList.add(
      UI_CLASSES.ACTIVE,
      activeTagKey
    );
  }
}

/**
 * 构建标准化的完整 Web 路径 (使用原始大小写仓库名)
 * @param {string|null|undefined} storageBox 仓库名 
 * @param {string|null|undefined} relativePath 相对路径
 * @returns {string|null} 完整路径或 null
 */
function buildFullWebPath(storageBox, relativePath) {
  if (!storageBox || !relativePath) {
    console.warn("buildFullWebPath: 缺少 storageBox 或 relativePath");
    return null;
  }
  const cleanRelativePath = relativePath.startsWith("/")
    ? relativePath.substring(1)
    : relativePath;
  const fullPath = `/${storageBox}/${cleanRelativePath}`
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/");
  return fullPath;
}

/**
 * 更新保存按钮的可用状态
 */
function updateGeneratorSaveButtonState() {
  if (!DOM.generatorSaveButton) return;
  let enableSave = false;
  const currentSelection = AppState.generator.currentSelection; // 包含原始大小写 storageBox 和相对 urlPath
  const currentId = AppState.generator.currentGeneratedId;
  const currentMd5 = AppState.generator.currentCalculatedMd5;
  const previewImage = DOM.generatorPreviewImage;

  if (currentSelection?.urlPath && currentSelection.storageBox) {
    // 使用驼峰 storageBox
    const fullWebPath = buildFullWebPath(
      currentSelection.storageBox,
      currentSelection.urlPath
    ); // 使用驼峰
    if (fullWebPath) {
      const isAlreadySaved = AppState.userDataPaths.has(fullWebPath); // userDataPaths 存储完整路径(含原始大小写)
      const isIdValid = !!currentId && currentId !== "生成中...";
      const isMd5Valid =
        !!currentMd5 && currentMd5 !== "计算中..." && currentMd5 !== "计算失败";
      const isImageLoaded =
        previewImage &&
        !previewImage.classList.contains(UI_CLASSES.HIDDEN) &&
        previewImage.src !== "" &&
        !previewImage.alt.includes("失败") &&
        !previewImage.alt.includes("加载中");
      enableSave = !isAlreadySaved && isIdValid && isMd5Valid && isImageLoaded;
    }
  }
  DOM.generatorSaveButton.disabled = !enableSave;
}

/**
 * 显示选定的图片及其信息 并准备保存
 * @param {object} imageInfo 包含图片信息的对象 { ..., urlPath(相对), storageBox }
 */
async function displaySelectedImage(imageInfo) {
  console.log("Generator: displaySelectedImage 接收到:", imageInfo);
  // 检查驼峰 storageBox 和相对 urlPath
  if (!imageInfo?.urlPath || !imageInfo.storageBox) {
    console.error(
      "Generator: displaySelectedImage 无效的图片信息对象 或缺少 storageBox/urlPath(相对):",
      imageInfo
    );
    displayGeneratorMessage(
      "错误：选择的图片信息无效",
      UI_CLASSES.ERROR,
      DELAYS.MESSAGE_CLEAR_DEFAULT
    );
    resetGeneratorInterface();
    return;
  }
  console.log(
    `Generator: 准备显示图片: ${imageInfo.fileName} (来自 ${imageInfo.storageBox})`
  ); // 使用驼峰
  AppState.generator.currentSelection = { ...imageInfo }; // 存储包含驼峰 storageBox 的对象

  hideGeneratorMessage();
  if (DOM.generatorSuggestionList)
    DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
  AppState.generator.showingRelatedImages = false;
  AppState.isSettingInputProgrammatically = true;
  if (DOM.generatorSearchInput) {
    DOM.generatorSearchInput.value = `${imageInfo.name || "未知角色"} (${
      imageInfo.fileName
    })`;
  }
  setTimeout(() => {
    AppState.isSettingInputProgrammatically = false;
  }, 50);

  highlightGameTag(imageInfo.gallery);

  if (DOM.generatorStorageBoxDisplay) {
    DOM.generatorStorageBoxDisplay.textContent = `仓库: ${imageInfo.storageBox}`; // 使用驼峰
    DOM.generatorStorageBoxDisplay.classList.remove(UI_CLASSES.HIDDEN);
  }

  const defaultRatingRadio = document.querySelector(
    'input[name="rating"][value="none"]'
  );
  const defaultLayoutRadio = document.querySelector(
    'input[name="layout"][value="normal"]'
  );
  if (defaultRatingRadio) defaultRatingRadio.checked = true;
  if (defaultLayoutRadio) defaultLayoutRadio.checked = true;
  if (DOM.generatorIsEasterEggCheckbox)
    DOM.generatorIsEasterEggCheckbox.checked = false;
  if (DOM.generatorIsAiImageCheckbox)
    DOM.generatorIsAiImageCheckbox.checked = false;

  if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
  if (DOM.generatorIdDisplayInput) {
    DOM.generatorIdDisplayInput.value = "";
    DOM.generatorIdDisplayInput.placeholder = "...";
  }
  if (DOM.generatorMd5DisplayInput) {
    DOM.generatorMd5DisplayInput.value = "";
    DOM.generatorMd5DisplayInput.placeholder = "...";
  }
  AppState.generator.currentGeneratedId = null;
  AppState.generator.currentCalculatedMd5 = null;

  // 查找 existingEntry (比较原始大小写 storageBox 和相对路径 path)
  const existingEntry = AppState.userData.find((entry) => {
    const originalCaseStorageBox = AppState.availableStorageBoxes.find(
      (box) => box.toLowerCase() === entry.storagebox?.toLowerCase()
    );
    return (
      originalCaseStorageBox === imageInfo.storageBox && // 比较原始大小写
      entry.path === imageInfo.urlPath
    ); // 比较相对路径
  });

  const fullWebPath = buildFullWebPath(imageInfo.storageBox, imageInfo.urlPath); // 使用驼峰
  if (!fullWebPath) {
    displayGeneratorMessage("错误：无法构建图片路径", UI_CLASSES.ERROR);
    return;
  }
  console.log(
    "Generator: displaySelectedImage - 构建的 fullWebPath:",
    fullWebPath
  );

  if (existingEntry?.attributes) {
    console.log(
      `Generator: 图片已存在于 JSON 中 GID: ${existingEntry.gid} 仓库: ${imageInfo.storageBox}`
    ); // 显示驼峰
    displayGeneratorMessage(
      `提示： "${imageInfo.fileName}" 已经录入过了`,
      UI_CLASSES.INFO
    );
    const attrs = existingEntry.attributes;
    const gid = existingEntry.gid;
    if (DOM.generatorIdDisplayInput) {
      DOM.generatorIdDisplayInput.value = gid || "N/A";
      DOM.generatorIdDisplayInput.placeholder = "GID";
    }
    if (DOM.generatorMd5DisplayInput) {
      DOM.generatorMd5DisplayInput.value = attrs.md5 || "N/A";
      DOM.generatorMd5DisplayInput.placeholder = "MD5";
    }
    AppState.generator.currentGeneratedId = gid || null;
    AppState.generator.currentCalculatedMd5 = attrs.md5 || null;
    let ratingValue = "none";
    if (attrs.isPx18) ratingValue = "px18";
    else if (attrs.isRx18) ratingValue = "rx18";
    const ratingRadio = document.querySelector(
      `input[name="rating"][value="${ratingValue}"]`
    );
    if (ratingRadio) ratingRadio.checked = true;
    const layoutValue = attrs.layout || "normal";
    const layoutRadio = document.querySelector(
      `input[name="layout"][value="${layoutValue}"]`
    );
    if (layoutRadio) layoutRadio.checked = true;
    if (DOM.generatorIsEasterEggCheckbox)
      DOM.generatorIsEasterEggCheckbox.checked = !!attrs.isEasterEgg;
    if (DOM.generatorIsAiImageCheckbox)
      DOM.generatorIsAiImageCheckbox.checked = !!attrs.isAiImage;
    if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
  } else {
    console.log("Generator: 新图片 准备生成 GID 和计算 MD5...");
    if (DOM.generatorIdDisplayInput)
      DOM.generatorIdDisplayInput.placeholder = "生成中...";
    if (DOM.generatorMd5DisplayInput)
      DOM.generatorMd5DisplayInput.placeholder = "计算中...";
    AppState.generator.currentGeneratedId = generateNumericId();
    if (DOM.generatorIdDisplayInput) {
      DOM.generatorIdDisplayInput.value = AppState.generator.currentGeneratedId;
      DOM.generatorIdDisplayInput.placeholder = "GID";
    }
    if (DOM.generatorMd5DisplayInput)
      DOM.generatorMd5DisplayInput.classList.add("calculating");
    try {
      const md5 = await fetchImageMd5(fullWebPath);
      if (md5) {
        AppState.generator.currentCalculatedMd5 = md5;
        if (DOM.generatorMd5DisplayInput) {
          DOM.generatorMd5DisplayInput.value = md5;
          DOM.generatorMd5DisplayInput.placeholder = "MD5";
        }
      } else {
        throw new Error("MD5 计算失败或未返回有效值");
      }
    } catch (error) {
      console.error(`Generator: 获取图片 MD5 失败 ${fullWebPath}:`, error);
      AppState.generator.currentCalculatedMd5 = "计算失败";
      if (DOM.generatorMd5DisplayInput) {
        DOM.generatorMd5DisplayInput.value = "失败";
        DOM.generatorMd5DisplayInput.placeholder = "错误";
        DOM.generatorMd5DisplayInput.classList.add("error-state");
      }
    } finally {
      if (DOM.generatorMd5DisplayInput) {
        DOM.generatorMd5DisplayInput.classList.remove("calculating");
        if (AppState.generator.currentCalculatedMd5 === "计算失败") {
          setTimeout(
            () => DOM.generatorMd5DisplayInput?.classList.remove("error-state"),
            2000
          );
        }
      }
      updateGeneratorSaveButtonState();
    }
  }

  if (DOM.generatorPreviewImage) {
    const previewImage = DOM.generatorPreviewImage;
    previewImage.src = "";
    previewImage.alt = "加载中...";
    previewImage.classList.add(UI_CLASSES.HIDDEN, UI_CLASSES.FADE_OUT);
    previewImage.style.display = "none";
    previewImage.onerror = () => {
      console.error("Generator: 预览图片加载失败:", fullWebPath);
      displayGeneratorMessage(
        `错误：无法加载预览图 ${imageInfo.fileName}`,
        UI_CLASSES.ERROR
      );
      previewImage.classList.add(UI_CLASSES.HIDDEN);
      previewImage.style.display = "none";
      previewImage.alt = "图片加载失败";
      if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
    };
    previewImage.onload = () => {
      console.log("Generator: 预览图片加载成功:", fullWebPath);
      previewImage.alt = imageInfo.name || "选中的图片";
      previewImage.classList.remove(UI_CLASSES.HIDDEN, UI_CLASSES.FADE_OUT);
      previewImage.style.display = "block";
      previewImage.classList.add(UI_CLASSES.FADE_IN);
      updateGeneratorSaveButtonState();
      setTimeout(() => previewImage.classList.remove(UI_CLASSES.FADE_IN), 300);
    };
    previewImage.src = fullWebPath;
  }
}

/**
 * 保存当前选中的图片信息到 ImageData.json
 */
async function saveGeneratedEntry() {
  if (DOM.generatorSaveButton) DOM.generatorSaveButton.disabled = true;
  if (AppState.generator.writingTimerId)
    clearInterval(AppState.generator.writingTimerId);
  AppState.generator.writingTimerId = null;
  AppState.generator.writingStartTime = null;
  if (AppState.generator.successTimerId)
    clearInterval(AppState.generator.successTimerId);
  AppState.generator.successTimerId = null;
  AppState.generator.successStartTime = null;

  const currentSelection = AppState.generator.currentSelection; // 包含驼峰 storageBox 和相对 urlPath
  const md5Value = DOM.generatorMd5DisplayInput?.value;
  const gidValue = DOM.generatorIdDisplayInput?.value;

  if (
    !currentSelection ||
    !md5Value ||
    !gidValue ||
    !currentSelection.storageBox
  ) {
    // 检查驼峰
    displayGeneratorMessage(
      "错误：图片未选择或 GID/MD5/仓库 信息缺失",
      UI_CLASSES.ERROR,
      DELAYS.MESSAGE_CLEAR_DEFAULT
    );
    return;
  }

  const currentFilename = currentSelection.fileName || "未知文件名";
  const relativePath = currentSelection.urlPath; // 相对路径
  const fullWebPath = buildFullWebPath(
    currentSelection.storageBox,
    relativePath
  ); // 使用驼峰构建
  if (!fullWebPath) {
    displayGeneratorMessage(
      "错误：无法构建完整路径 无法保存",
      UI_CLASSES.ERROR
    );
    return;
  }

  if (AppState.userDataPaths.has(fullWebPath)) {
    // 使用完整路径检查 Set
    displayGeneratorMessage(
      `错误：图片 "${currentFilename}" 已经存在于 JSON 中了`,
      UI_CLASSES.ERROR
    );
    findAndDisplayNextUnsavedImage(currentSelection);
    return;
  }

  if (!gidValue || gidValue === "N/A" || gidValue === "生成中...") {
    displayGeneratorMessage(
      "错误：GID 无效 无法保存",
      UI_CLASSES.ERROR,
      DELAYS.MESSAGE_CLEAR_DEFAULT
    );
    return;
  }
  if (!md5Value || md5Value === "计算失败" || md5Value === "计算中...") {
    displayGeneratorMessage(
      "错误：MD5 无效 无法保存",
      UI_CLASSES.ERROR,
      DELAYS.MESSAGE_CLEAR_DEFAULT
    );
    return;
  }

  const ratingRadio = document.querySelector('input[name="rating"]:checked');
  const layoutRadio = document.querySelector('input[name="layout"]:checked');
  const isEasterEgg = DOM.generatorIsEasterEggCheckbox?.checked ?? false;
  const isAiImage = DOM.generatorIsAiImageCheckbox?.checked ?? false;

  // 构建 newEntry (写入 JSON 时使用小写 storagebox)
  const newEntry = {
    storagebox: currentSelection.storageBox, // 转为小写写入
    gid: gidValue,
    characterName: currentSelection.name || "Unknown",
    path: relativePath, // 存储相对路径
    attributes: {
      filename: currentFilename,
      parentFolder: currentSelection.folderName,
      isPx18: ratingRadio?.value === "px18",
      isRx18: ratingRadio?.value === "rx18",
      layout: layoutRadio?.value || "normal",
      isEasterEgg: isEasterEgg,
      isAiImage: isAiImage,
      isBan: false,
      md5: md5Value,
      Downloaded_From: "none",
    },
    timestamp: new Date().toISOString(),
    sourceGallery: currentSelection.gallery,
  };

  console.log("Generator: 准备保存新条目:", newEntry);
  const updatedDataList = [...AppState.userData, newEntry];
  const baseWritingMessage = `写入中：${currentFilename}`;
  displayGeneratorMessage(baseWritingMessage, UI_CLASSES.INFO, null);
  AppState.generator.writingStartTime = Date.now();
  AppState.generator.writingTimerId = setInterval(() => {
    if (
      !AppState.generator.writingStartTime ||
      !DOM.generatorMessageArea?.classList.contains(UI_CLASSES.INFO)
    ) {
      clearInterval(AppState.generator.writingTimerId);
      AppState.generator.writingTimerId = null;
      AppState.generator.writingStartTime = null;
      return;
    }
    const elapsedSeconds = (
      (Date.now() - AppState.generator.writingStartTime) /
      1000
    ).toFixed(1);
    if (DOM.generatorMessageArea)
      DOM.generatorMessageArea.textContent = `${baseWritingMessage} (${elapsedSeconds}s)`;
  }, 100);

  let success = false;
  const saveOperationStartTime = Date.now();
  try {
    if (typeof updateUserData !== "function")
      throw new Error("核心函数 updateUserData 未定义！");
    success = await updateUserData(
      updatedDataList,
      `成功添加 "${currentFilename}"`,
      "generatorMessageArea",
      false
    );
  } catch (error) {
    console.error("Generator: 保存条目时出错:", error);
    success = false;
  } finally {
    if (AppState.generator.writingTimerId) {
      clearInterval(AppState.generator.writingTimerId);
      AppState.generator.writingTimerId = null;
      AppState.generator.writingStartTime = null;
    }
    if (success) {
      const saveDuration = (
        (Date.now() - saveOperationStartTime) /
        1000
      ).toFixed(1);
      if (DOM.generatorMessageArea?.classList.contains(UI_CLASSES.SUCCESS)) {
        DOM.generatorMessageArea.textContent += ` (耗时 ${saveDuration}s)`;
      }
      AppState.userDataPaths.add(fullWebPath); // 添加完整路径到 Set
      setTimeout(() => {
        console.debug("Generator: 保存成功 查找下一张...");
        hideGeneratorMessage();
        findAndDisplayNextUnsavedImage(currentSelection);
      }, DELAYS.GENERATOR_NEXT_IMAGE_DELAY);
    } else {
      console.log("Generator: 保存失败或错误已处理");
      setTimeout(() => {
        console.debug("Generator: 保存失败 尝试查找下一张...");
        hideGeneratorMessage();
        findAndDisplayNextUnsavedImage(currentSelection);
      }, 500);
    }
    clearTimeout(AppState.messageClearTimer);
    AppState.messageClearTimer = null;
  }
}

/**
 * 在当前文件夹中查找并显示下一张未保存的图片
 * @param {object} lastSavedImageInfo 刚刚保存的图片信息对象 {..., storageBox, urlPath(相对)}
 */
function findAndDisplayNextUnsavedImage(lastSavedImageInfo) {
  if (
    !lastSavedImageInfo?.folderName ||
    !lastSavedImageInfo?.storageBox ||
    !lastSavedImageInfo?.urlPath
  ) {
    // 检查驼峰
    console.warn("Generator: 查找下一张图片的参数无效", lastSavedImageInfo);
    resetGeneratorInterface();
    return;
  }
  const currentFolder = lastSavedImageInfo.folderName;
  const currentStorageBox = lastSavedImageInfo.storageBox; // 使用驼峰
  console.log(
    `Generator: 在仓库 "${currentStorageBox}" 文件夹 "${currentFolder}" 中查找下一张...`
  ); // 使用驼峰

  const imagesInCurrentFolder = (AppState.galleryImages || []) // galleryImages 包含驼峰 storageBox 和相对 urlPath
    .filter(
      (img) =>
        img?.storageBox === currentStorageBox &&
        img?.folderName === currentFolder
    ) // 比较驼峰
    .sort((a, b) =>
      (a.fileName || "").localeCompare(b.fileName || "", undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );

  if (imagesInCurrentFolder.length === 0) {
    console.log(
      `Generator: 仓库 "${currentStorageBox}" 文件夹 "${currentFolder}" 为空`
    );
    resetGeneratorInterface();
    return;
  }

  const currentIndex = imagesInCurrentFolder.findIndex(
    (img) => img?.urlPath === lastSavedImageInfo.urlPath
  ); // 比较相对路径

  let nextUnsavedImage = null;
  if (currentIndex !== -1) {
    for (let i = currentIndex + 1; i < imagesInCurrentFolder.length; i++) {
      const potentialNext = imagesInCurrentFolder[i];
      const fullWebPath = buildFullWebPath(
        potentialNext.storageBox,
        potentialNext.urlPath
      ); // 使用驼峰构建
      if (
        potentialNext?.urlPath &&
        fullWebPath &&
        !AppState.userDataPaths.has(fullWebPath)
      ) {
        // 使用完整路径检查 Set
        nextUnsavedImage = potentialNext;
        console.log(`Generator: 找到下一张: ${nextUnsavedImage.fileName}`);
        break;
      }
    }
  } else {
    console.warn(
      `Generator: 未找到刚保存的 ${lastSavedImageInfo.urlPath} 从头查找...`
    );
    for (let i = 0; i < imagesInCurrentFolder.length; i++) {
      const potentialNext = imagesInCurrentFolder[i];
      const fullWebPath = buildFullWebPath(
        potentialNext.storageBox,
        potentialNext.urlPath
      ); // 使用驼峰构建
      if (
        potentialNext?.urlPath &&
        fullWebPath &&
        !AppState.userDataPaths.has(fullWebPath)
      ) {
        // 使用完整路径检查 Set
        nextUnsavedImage = potentialNext;
        console.log(`Generator: 从头找到: ${nextUnsavedImage.fileName}`);
        break;
      }
    }
  }

  if (nextUnsavedImage) {
    displaySelectedImage(nextUnsavedImage);
  } else {
    console.log(
      `Generator: 仓库 "${currentStorageBox}" 文件夹 "${currentFolder}" 处理完毕`
    ); // 使用驼峰
    displayToast(
      `文件夹 "${currentFolder}" (${currentStorageBox}) 处理完毕！`,
      UI_CLASSES.SUCCESS,
      DELAYS.MESSAGE_CLEAR_DEFAULT
    ); // 使用驼峰
    resetGeneratorInterface();
  }
}

/**
 * 处理生成器搜索框的输入事件
 */
function handleGeneratorSearchInput() {
  if (AppState.isSettingInputProgrammatically) return;
  const query = DOM.generatorSearchInput.value.trim();
  const currentSelectionText = AppState.generator.currentSelection
    ? `${AppState.generator.currentSelection.name || "?"} (${
        AppState.generator.currentSelection.fileName
      })`
    : "";
  if (AppState.generator.currentSelection && query !== currentSelectionText) {
    console.log("Generator: 输入内容与当前选择不符 清空选择");
    resetGeneratorInterface();
  }
  clearTimeout(AppState.generator.searchDelayTimer);
  AppState.generator.showingRelatedImages = false;
  if (query === "") {
    if (DOM.generatorSuggestionList)
      DOM.generatorSuggestionList.classList.add(UI_CLASSES.HIDDEN);
    AppState.generator.isShowingFolderSuggestions = false;
    return;
  }
  AppState.generator.searchDelayTimer = setTimeout(() => {
    if (DOM.generatorSearchInput.value.trim() === query) {
      console.log(`Generator: 触发搜索 关键词: "${query}"`);
      requestSearchFromWorker(query);
      AppState.generator.isShowingFolderSuggestions = false;
    } else {
      console.debug("Generator: 输入已改变 取消本次搜索");
    }
  }, DELAYS.INPUT_DEBOUNCE);
}

/**
 * 处理生成器搜索框获得焦点事件
 */
function handleGeneratorSearchFocus() {
  const currentValue = DOM.generatorSearchInput.value.trim();
  const currentSelectionText = AppState.generator.currentSelection
    ? `${AppState.generator.currentSelection.name || "?"} (${
        AppState.generator.currentSelection.fileName
      })`
    : "";
  if (currentValue === "") {
    const topFolders = findTopUnsavedFolders();
    displayFolderSuggestions(topFolders);
    AppState.generator.showingRelatedImages = false;
  } else if (
    AppState.generator.currentSelection &&
    currentValue === currentSelectionText &&
    !AppState.generator.showingRelatedImages
  ) {
    console.log("Generator: 焦点匹配当前选择 请求相关图片...");
    requestSiblingImagesFromWorker(AppState.generator.currentSelection);
    AppState.generator.showingRelatedImages = true;
    AppState.generator.isShowingFolderSuggestions = false;
  } else if (
    !AppState.generator.currentSelection ||
    currentValue !== currentSelectionText
  ) {
    console.log("Generator: 焦点不匹配或无选择 执行搜索...");
    requestSearchFromWorker(currentValue);
    AppState.generator.showingRelatedImages = false;
    AppState.generator.isShowingFolderSuggestions = false;
  }
}

/**
 * 显示搜索建议列表 图片或文件夹
 * @param {Array<object|string>} results 搜索结果数组 图片信息对象或文件夹名称字符串
 * @param {boolean} [isFolderList=false] true 表示结果是文件夹列表 false 表示是图片列表
 */
function displaySuggestions(results, isFolderList = false) {
    if (!DOM.generatorSuggestionList) { console.error("Generator: 建议列表 DOM 元素 'suggestions' 未找到！"); return; }
    const suggestionList = DOM.generatorSuggestionList;
    suggestionList.innerHTML = ''; // 清空旧建议

    if (!Array.isArray(results) || results.length === 0) {
        suggestionList.classList.add(UI_CLASSES.HIDDEN);
        AppState.generator.isShowingFolderSuggestions = false;
        console.debug("Generator: 无建议结果 隐藏列表");
        return;
    }

    console.debug(`Generator: 准备显示 ${results.length} 条 ${isFolderList ? '文件夹' : '图片'} 建议`);
    AppState.generator.isShowingFolderSuggestions = isFolderList;
    const fragment = document.createDocumentFragment();

    if (isFolderList) {
        // --- 显示文件夹建议 (逻辑不变) ---
        results.forEach(folderIdentifier => {
            if (typeof folderIdentifier !== 'string') return;
            const item = document.createElement('div');
            item.className = 'suggestion-item folder-suggestion';
            item.innerHTML = `📂 <span class="suggestion-text">${folderIdentifier}</span>`;
            item.style.cursor = 'pointer';
            item.onclick = () => {
                const parts = folderIdentifier.split('/');
                const folderNameOnly = parts.length > 1 ? parts[1] : folderIdentifier;
                if (DOM.generatorSearchInput) {
                    DOM.generatorSearchInput.value = folderNameOnly;
                    DOM.generatorSearchInput.dispatchEvent(new Event('input', { bubbles:true }));
                }
                suggestionList.classList.add(UI_CLASSES.HIDDEN);
                AppState.generator.isShowingFolderSuggestions = false;
            };
            fragment.appendChild(item);
        });
    } else {
        // --- 显示图片建议 (放弃懒加载，直接设置 src) ---
        const validUnsavedImages = results.filter(imgInfo => {
            if (!imgInfo?.urlPath || !imgInfo.storageBox) return false;
            const fullWebPath = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);
            return fullWebPath && !AppState.userDataPaths.has(fullWebPath);
        });
        validUnsavedImages.sort((a, b) => (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' }));

        if (validUnsavedImages.length === 0) {
            suggestionList.classList.add(UI_CLASSES.HIDDEN);
            console.debug("Generator: 所有图片建议均已保存 隐藏列表");
            return;
        }
        console.debug(`Generator: 显示 ${validUnsavedImages.length} 条未保存的图片建议 (直接加载)`);

        validUnsavedImages.forEach(imgInfo => {
            const item = document.createElement('div');
            item.className = 'suggestion-item image-suggestion';
            const imgElement = document.createElement('img');
            const imageWebPath = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);

            if (!imageWebPath || !imageWebPath.startsWith('/')) {
                console.error("Generator: displaySuggestions - 图片信息 urlPath 无效或格式错误!", imgInfo, "构建结果:", imageWebPath);
                imgElement.alt = "路径错误";
                imgElement.style.cssText = 'width:40px; height:40px; object-fit:contain; margin-right:10px; border-radius:4px; flex-shrink:0; background-color:#eee; color:red; text-align:center; line-height:40px; font-size:10px;';
                imgElement.textContent = 'ERR';
            } else {
                imgElement.alt = imgInfo.name || '建议图片';
                imgElement.style.cssText = 'width:40px; height:40px; object-fit:cover; margin-right:10px; border-radius:4px; flex-shrink:0;';
                imgElement.onerror = function() { this.style.display='none'; item.classList.add('load-error'); };

                // --- 修改：直接设置 src，不再使用懒加载 ---
                imgElement.src = `/api/thumbnail${imageWebPath}`;
                imgElement.loading = 'lazy'; // 仍然可以使用浏览器原生懒加载
                // --- 结束修改 ---
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'suggestion-text';
            textSpan.textContent = `${imgInfo.name || '?'} (${imgInfo.fileName}) [${imgInfo.storageBox || '未知仓库'}]`;
            textSpan.title = `${imgInfo.storageBox}/${imgInfo.folderName}/${imgInfo.fileName}`;

            item.appendChild(imgElement);
            item.appendChild(textSpan);
            item.onclick = () => displaySelectedImage(imgInfo);
            fragment.appendChild(item);
        });
    }
    suggestionList.appendChild(fragment);
    suggestionList.classList.remove(UI_CLASSES.HIDDEN);
    console.debug("Generator: 建议列表已更新并显示");
}

/**
 * 查找包含未保存图片的文件夹
 * 返回按未保存图片数量降序排列的前 N 个文件夹标识 ("仓库/文件夹" 使用原始大小写)
 * @param {number} [limit=5] 返回的文件夹数量上限
 * @returns {Array<string>} "仓库/文件夹" 格式的数组
 */
function findTopUnsavedFolders(limit = 5) {
  const folderUnsavedStats = {};
  if (!AppState.galleryImages?.length) {
    console.log("Generator: findTopUnsavedFolders - 图库为空");
    return [];
  }
  console.log("Generator: findTopUnsavedFolders - 开始统计...");
  console.log(
    "Generator: findTopUnsavedFolders - userDataPaths size:",
    AppState.userDataPaths.size
  );

  for (const img of AppState.galleryImages) {
    // galleryImages 包含驼峰 storageBox 和相对 urlPath
    if (!img?.folderName || !img.urlPath || !img.storageBox) continue; // 使用驼峰
    const folderIdentifier = `${img.storageBox}/${img.folderName}`; // 使用驼峰
    if (!folderUnsavedStats[folderIdentifier]) {
      folderUnsavedStats[folderIdentifier] = { unsavedCount: 0, totalCount: 0 };
    }
    folderUnsavedStats[folderIdentifier].totalCount++;
    const fullWebPath = buildFullWebPath(img.storageBox, img.urlPath); // 使用驼峰构建
    if (fullWebPath && !AppState.userDataPaths.has(fullWebPath)) {
      // 使用完整路径检查 Set
      folderUnsavedStats[folderIdentifier].unsavedCount++;
    }
  }
  console.log(
    "Generator: findTopUnsavedFolders - 统计完成:",
    folderUnsavedStats
  );
  const foldersToSuggest = Object.entries(folderUnsavedStats)
    .filter(([identifier, stats]) => stats.unsavedCount > 0)
    .map(([identifier, stats]) => ({
      identifier: identifier,
      unsaved: stats.unsavedCount,
      total: stats.totalCount,
    }));
  console.log("Generator: findTopUnsavedFolders - 筛选后:", foldersToSuggest);
  foldersToSuggest.sort((a, b) => {
    if (b.unsaved !== a.unsaved) return b.unsaved - a.unsaved;
    return b.total - a.total;
  });
  const sortedFolderIdentifiers = foldersToSuggest.map(
    (item) => item.identifier
  ); // 返回包含原始大小写的标识符
  console.log(
    "Generator: findTopUnsavedFolders - 最终推荐:",
    sortedFolderIdentifiers.slice(0, limit)
  );
  return sortedFolderIdentifiers.slice(0, limit);
}

/**
 * 显示文件夹建议列表
 * @param {Array<string>} folderIdentifiers "仓库/文件夹" 格式的数组 
 */
function displayFolderSuggestions(folderIdentifiers) {
  displaySuggestions(folderIdentifiers, true);
}

// --- Web Worker 交互 ---
/**
 * 初始化后台搜索 Web Worker
 */
function initializeGeneratorSearchWorker() {
  if (typeof Worker === "undefined") {
    console.warn("Generator: 浏览器不支持 Web Worker");
    if (DOM.generatorSearchInput) {
      DOM.generatorSearchInput.placeholder = "后台搜索不可用";
      DOM.generatorSearchInput.disabled = true;
    }
    return;
  }
  if (!AppState.galleryImages?.length) {
    console.warn("Generator: 图库数据尚未加载");
    return;
  }
  if (AppState.generator.backgroundWorker) {
    console.log("Generator: 终止旧 Worker...");
    AppState.generator.backgroundWorker.terminate();
    AppState.generator.backgroundWorker = null;
  }
  try {
    console.log("Generator: 创建新 Worker...");
    AppState.generator.backgroundWorker = new Worker("searchworker.js");
    AppState.generator.backgroundWorker.onmessage = handleWorkerMessage;
    AppState.generator.backgroundWorker.onerror = handleWorkerError;
    console.log("Generator: 向 Worker 发送初始数据...");
    // 发送给 Worker 的是包含相对路径的 galleryImages 和包含相对路径的 userDataPaths
    const relativeUserDataPaths = Array.from(AppState.userDataPaths)
      .map((fullPath) => {
        const segments = fullPath.startsWith("/")
          ? fullPath.substring(1).split("/")
          : fullPath.split("/");
        return segments.length >= 2 ? segments.slice(1).join("/") : null;
      })
      .filter(Boolean);

      AppState.generator.backgroundWorker.postMessage({
        type: "search",
        payload: { query: query, dataSource: 'physical' }, 
      });
    if (DOM.generatorSearchInput) {
      DOM.generatorSearchInput.disabled = false;
      DOM.generatorSearchInput.placeholder = `搜索 ${AppState.galleryImages.length} 张图片...`;
      console.log("Generator: Worker 初始化成功");
    }
  } catch (error) {
    console.error("Generator: 创建 Worker 失败:", error);
    displayToast(
      "后台搜索初始化失败",
      UI_CLASSES.ERROR,
      DELAYS.TOAST_ERROR_DURATION
    );
    AppState.generator.backgroundWorker = null;
    if (DOM.generatorSearchInput) {
      DOM.generatorSearchInput.disabled = true;
      DOM.generatorSearchInput.placeholder = "后台搜索故障";
    }
  }
}
/**
 * 处理来自 Web Worker 的消息
 * @param {MessageEvent} event Worker 发送的消息事件
 */
function handleWorkerMessage(event) {
  if (!event.data?.type) {
    console.warn("Generator: 收到 Worker 无效消息:", event.data);
    return;
  }
  const { type, payload } = event.data;
  console.debug(
    `[主线程] 收到 Worker 消息: ${type}`,
    payload ? "(含数据)" : ""
  );
  switch (type) {
    case "searchResults":
      if (payload?.query === AppState.generator.lastQuerySentToWorker) {
        console.log(
          `[主线程] 收到查询 "${payload.query}" 结果 ${
            payload.results?.length || 0
          } 条`
        );
        // Worker 返回的 results 包含相对 urlPath 需要在 displaySuggestions 中处理
        displaySuggestions(payload.results || [], false);
      } else {
        console.debug(
          `[主线程] 忽略过时结果 查询: ${payload?.query} 最新: ${AppState.generator.lastQuerySentToWorker}`
        );
      }
      break;
    case "siblingResults":
      if (payload && Array.isArray(payload.results)) {
        console.log(`[主线程] 收到相关图片结果 ${payload.results.length} 条`);
        displaySuggestions(payload.results || [], false);
      } else {
        console.warn("[主线程] 相关图片结果格式无效:", payload);
      }
      break;
    case "dataLoaded":
      console.log("Generator Worker: 确认数据加载");
      break;
    case "error":
      console.error(
        "Generator Worker 报告错误:",
        payload?.message,
        payload?.error
      );
      displayToast(
        `后台搜索出错: ${payload?.message || "未知错误"}`,
        UI_CLASSES.ERROR,
        DELAYS.TOAST_ERROR_DURATION
      );
      if (DOM.generatorSearchInput) {
        DOM.generatorSearchInput.disabled = true;
        DOM.generatorSearchInput.placeholder = "后台搜索故障";
      }
      break;
    default:
      console.warn("[主线程] 未知 Worker 消息:", type, payload);
  }
}
/**
 * 处理 Web Worker 发生的严重错误
 * @param {ErrorEvent} error Worker 错误事件对象
 */
function handleWorkerError(error) {
  console.error(
    "[主线程] 后台搜索 Worker 发生严重错误:",
    error.message,
    error.filename,
    error.lineno,
    error
  );
  displayToast(
    "后台搜索发生严重错误 已禁用",
    UI_CLASSES.ERROR,
    DELAYS.TOAST_ERROR_DURATION
  );
  if (DOM.generatorSearchInput) {
    DOM.generatorSearchInput.disabled = true;
    DOM.generatorSearchInput.placeholder = "后台搜索已禁用";
  }
  if (AppState.generator.backgroundWorker) {
    AppState.generator.backgroundWorker.terminate();
    AppState.generator.backgroundWorker = null;
  }
}
/**
 * 向 Web Worker 发送搜索请求
 * @param {string} query 搜索关键词
 */
function requestSearchFromWorker(query) {
  AppState.generator.lastQuerySentToWorker = query;
  if (AppState.generator.backgroundWorker) {
    console.debug(`Generator: 向 Worker 发送搜索: "${query}"`);
    AppState.generator.backgroundWorker.postMessage({
      type: "search",
      payload: { query: query },
    });
  } else {
    console.warn("Generator: Worker 不可用");
    displayToast("后台搜索功能当前不可用", UI_CLASSES.WARNING);
    displaySuggestions([]);
  }
}
/**
 * 向 Web Worker 请求当前图片的同级 相同文件夹 图片
 * @param {object} currentImageInfo 当前选中的图片信息对象 包含相对 urlPath 和原始大小写 storageBox
 */
function requestSiblingImagesFromWorker(currentImageInfo) {
  if (AppState.generator.backgroundWorker) {
    console.debug(
      `Generator: 向 Worker 请求相关图片 仓库: ${currentImageInfo.storageBox} 文件夹: ${currentImageInfo.folderName}...`
    );
    AppState.generator.backgroundWorker.postMessage({
      type: "findSiblings",
      payload: { currentImageInfo: currentImageInfo },
    });
  } // 发送包含驼峰的对象
  else {
    console.warn("Generator: Worker 不可用");
    displayToast("后台搜索功能当前不可用", UI_CLASSES.WARNING);
    displaySuggestions([]);
  }
}

// --- 事件监听器设置 ---
/**
 * 设置 JSON 生成器视图内的事件监听器
 */
function setupGeneratorEventListeners() {
  if (DOM.generatorSearchInput) {
    DOM.generatorSearchInput.removeEventListener(
      "focus",
      handleGeneratorSearchFocus
    );
    DOM.generatorSearchInput.removeEventListener(
      "input",
      handleGeneratorSearchInput
    );
    DOM.generatorSearchInput.removeEventListener(
      "click",
      handleGeneratorSearchFocus
    );
    DOM.generatorSearchInput.addEventListener(
      "focus",
      handleGeneratorSearchFocus
    );
    DOM.generatorSearchInput.addEventListener(
      "input",
      handleGeneratorSearchInput
    );
    DOM.generatorSearchInput.addEventListener(
      "click",
      handleGeneratorSearchFocus
    );
  } else {
    console.error("Generator: 搜索框 searchInput 未找到");
  }

  if (DOM.generatorSaveButton) {
    DOM.generatorSaveButton.removeEventListener("click", saveGeneratedEntry);
    DOM.generatorSaveButton.addEventListener("click", saveGeneratedEntry);
  } else {
    console.error("Generator: 保存按钮 saveButton 未找到");
  }

  const attributeControls = [
    ...(DOM.generatorRatingRadios || []),
    ...(DOM.generatorLayoutRadios || []),
    DOM.generatorIsEasterEggCheckbox,
    DOM.generatorIsAiImageCheckbox,
  ];
  attributeControls.forEach((control) => {
    if (control) {
      control.removeEventListener("change", updateGeneratorSaveButtonState);
      control.addEventListener("change", updateGeneratorSaveButtonState);
    }
  });
  console.log("Generator: 事件监听器设置完成");
}
/**
 * 更新 Generator 面板的总条目计数显示
 */
function updateGeneratorEntryCount() {
  if (DOM.generatorEntryCountDisplay) {
    DOM.generatorEntryCountDisplay.textContent = `Json数据量: ${AppState.userData.length} 条`;
  }
}