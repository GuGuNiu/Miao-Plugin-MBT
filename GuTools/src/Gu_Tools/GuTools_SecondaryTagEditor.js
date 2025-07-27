// ==========================================================================
// GuTools 二级标签编辑器: 补缺或全体编辑图片的二级标签
// ==========================================================================

// --- 模块内部状态 ---
const STEState = {
    currentMode: 'fill', 
    currentIndex: -1,
    currentImageList: [],
    currentImageEntry: null,
    currentTags: new Set(),
    searchDebounceTimer: null,
    lastBuiltMode: null,
    lastSearchKeyword: null,
};

/**
 * 初始化二级标签编辑器视图
 */
function initializeSecondaryTagEditorView() {
    if (!DOM.secondaryTagEditorPaneView) return;

    // 填充快捷标签
    if (DOM.stePredefinedTags) {
        DOM.stePredefinedTags.innerHTML = '';
        const fragment = document.createDocumentFragment();
        SECONDARY_TAGS_LIST.forEach(tag => {
            const el = document.createElement('div');
            el.className = 'ste-predefined-tag';
            el.textContent = tag;
            el.dataset.tag = tag;
            fragment.appendChild(el);
        });
        DOM.stePredefinedTags.appendChild(fragment);
    }

    resetSTEInterface();

    // 初始化UI状态
    if (DOM.steSearchWrapper) {
        DOM.steSearchWrapper.classList.remove('hidden');
        let suggestionsEl = document.getElementById('steSuggestions');
        if (!suggestionsEl) {
            suggestionsEl = document.createElement('div');
            suggestionsEl.id = 'steSuggestions';
            suggestionsEl.className = 'suggestions-import hidden';
            DOM.steSearchWrapper.appendChild(suggestionsEl);
            DOM.steSuggestions = suggestionsEl;
        }
    }
    if (DOM.steSearchInput) DOM.steSearchInput.disabled = true;
    const fillModeRadio = document.querySelector('input[name="steMode"][value="fill"]');
    if (fillModeRadio) fillModeRadio.checked = true;
    STEState.currentMode = 'fill';
    
    loadNextImage();
}

/**
 * 重置界面至初始或下一张图的状态
 */
function resetSTEInterface(clearAll = true) {
    if (clearAll) {
        STEState.currentIndex = -1;
        STEState.currentImageList = [];
        if (DOM.steSearchInput) DOM.steSearchInput.value = '';
    }
    STEState.currentImageEntry = null;
    STEState.currentTags.clear();

    if (DOM.stePreviewImage) { DOM.stePreviewImage.src = ''; DOM.stePreviewImage.classList.add('hidden'); }
    if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '加载中...';
    if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
    if (DOM.steTagList) DOM.steTagList.innerHTML = '';
    if (DOM.steTagInput) DOM.steTagInput.value = '';
    if (DOM.steSaveButton) DOM.steSaveButton.disabled = true;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = true;
    
    updatePredefinedTagsUI();
}

/**
 * 加载并显示下一张符合当前模式的图片
 */
function loadNextImage() {
    resetSTEInterface(false);
    
    const mode = STEState.currentMode;
    const searchKeyword = DOM.steSearchInput.value.toLowerCase().trim();

    // 仅在列表为空、模式切换或搜索时重新构建列表
    if (STEState.currentImageList.length === 0 || mode !== STEState.lastBuiltMode || (mode === 'all' && searchKeyword !== STEState.lastSearchKeyword)) {
        STEState.lastBuiltMode = mode;
        STEState.lastSearchKeyword = searchKeyword;
        STEState.currentIndex = -1;

        if (mode === 'fill') {
            // 筛选条件：物理文件存在，但在JSON数据中没有记录，或者记录中没有有效的secondaryTags
            STEState.currentImageList = AppState.galleryImages.filter(img => {
                const userDataEntry = AppState.userData.find(ud => 
                    ud.path === img.urlPath && 
                    ud.storagebox?.toLowerCase() === img.storageBox.toLowerCase()
                );
                return !userDataEntry || !userDataEntry.attributes.secondaryTags || userDataEntry.attributes.secondaryTags.length === 0;
            });
        } else if (mode === 'all') {
            if (searchKeyword) {
                 STEState.currentImageList = AppState.galleryImages.filter(img => 
                    img.fileName.toLowerCase().includes(searchKeyword) ||
                    img.name.toLowerCase().includes(searchKeyword)
                );
            } else {
                STEState.currentImageList = [...AppState.galleryImages];
            }
        }
    }
    
    let imagePool = STEState.currentImageList;
    
    const nextIndex = STEState.currentIndex + 1;
    if (nextIndex >= imagePool.length) {
        if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '所有图片处理完毕！🎉';
        if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
        if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = '完成';
        if (DOM.stePreviewImage) DOM.stePreviewImage.classList.add('hidden');
        displayToast("当前模式下所有图片已处理完毕！", "success");
        return;
    }

    STEState.currentIndex = nextIndex;
    STEState.currentImageEntry = imagePool[nextIndex];
    
    if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = `${STEState.currentIndex + 1}/${imagePool.length}`;

    renderImageAndTags(STEState.currentImageEntry);
}

/**
 * 渲染当前图片及其已有的标签
 * @param {object} imageEntry - 当前图片的数据
 */
function renderImageAndTags(imageEntry) {
    if (!imageEntry) return;

    if (DOM.stePreviewImage) {
        const fullPath = buildFullWebPath(imageEntry.storageBox, imageEntry.urlPath);
        DOM.stePreviewImage.src = fullPath;
        DOM.stePreviewImage.classList.remove('hidden');
        if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '';
    }

    if (DOM.steImageInfo) {
        DOM.steImageInfo.classList.remove('hidden');
        DOM.steImageInfo.querySelector('.ste-info-filename').textContent = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.ste-info-filename').title = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.ste-info-character').textContent = `角色: ${imageEntry.name}`;
        DOM.steImageInfo.querySelector('.ste-info-storagebox').textContent = `仓库: ${imageEntry.storageBox}`;
    }

    // 查找时两边都转为小写，确保无论JSON中存储何种大小写都能匹配
    const userDataEntry = AppState.userData.find(ud => 
        ud.path === imageEntry.urlPath && 
        ud.storagebox?.toLowerCase() === imageEntry.storageBox.toLowerCase()
    );

    if (userDataEntry && userDataEntry.attributes.secondaryTags) {
        userDataEntry.attributes.secondaryTags.forEach(tag => STEState.currentTags.add(tag));
    }

    renderCurrentTags();
    updatePredefinedTagsUI();

    if (DOM.steSaveButton) DOM.steSaveButton.disabled = false;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = false;
}

/**
 * 根据 currentTags 渲染手动标签列表
 */
function renderCurrentTags() {
    if (!DOM.steTagList) return;
    DOM.steTagList.innerHTML = '';
    STEState.currentTags.forEach(tag => {
        const li = document.createElement('li');
        li.className = 'ste-tag-item';
        li.textContent = tag;
        
        const removeBtn = document.createElement('span');
        removeBtn.className = 'ste-tag-remove';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            STEState.currentTags.delete(tag);
            renderCurrentTags();
            updatePredefinedTagsUI();
        };
        li.appendChild(removeBtn);
        DOM.steTagList.appendChild(li);
    });
}

/**
 * 更新快捷标签的选中状态
 */
function updatePredefinedTagsUI() {
    if (!DOM.stePredefinedTags) return;
    DOM.stePredefinedTags.querySelectorAll('.ste-predefined-tag').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
}

/**
 * 保存当前标签并加载下一张
 */
async function saveAndNext() {
    if (!STEState.currentImageEntry) return;

    const currentSelection = STEState.currentImageEntry;
    
    let entryIndex = AppState.userData.findIndex(ud => 
        ud.path === currentSelection.urlPath && 
        ud.storagebox?.toLowerCase() === currentSelection.storageBox.toLowerCase()
    );
    
    let entryToProcess;
    let isNewEntry = false;

    if (entryIndex > -1) {
        // 更新现有条目
        entryToProcess = { ...AppState.userData[entryIndex] };
        if (!entryToProcess.attributes) entryToProcess.attributes = {};
    } else {
        // 创建新条目
        const md5Value = await fetchImageMd5(buildFullWebPath(currentSelection.storageBox, currentSelection.urlPath)) || null;
        entryToProcess = {
            storagebox: currentSelection.storageBox.toLowerCase(),
            gid: generateNumericId(),
            characterName: currentSelection.name || "Unknown",
            path: currentSelection.urlPath,
            attributes: {
                filename: currentSelection.fileName, parentFolder: currentSelection.folderName,
                isPx18: false, isRx18: false, layout: "normal",
                isEasterEgg: false, isAiImage: false, isBan: false,
                md5: md5Value, Downloaded_From: "TagEditor",
            },
            timestamp: new Date().toISOString(),
            sourceGallery: currentSelection.gallery,
        };
        isNewEntry = true;
    }

    entryToProcess.attributes.secondaryTags = Array.from(STEState.currentTags);
    entryToProcess.timestamp = new Date().toISOString();

    const updatedDataList = [...AppState.userData];
    if (isNewEntry) {
        updatedDataList.push(entryToProcess);
    } else {
        updatedDataList[entryIndex] = entryToProcess;
    }

    const success = await updateUserData(updatedDataList, `标签已保存`, "toast", false, 2000);
    
    if (success) {
        // 直接调用 loadNextImage，它会基于已更新的 AppState.userData 重新筛选
        loadNextImage();
    } else {
        if (DOM.steSaveButton) DOM.steSaveButton.disabled = false;
    }
}

/**
 * 在二级标签编辑器的搜索框下方显示带缩略图的建议列表
 * @param {Array<object>} results - 筛选出的图片信息对象数组
 */
function displaySteSuggestions(results) {
    if (!DOM.steSuggestions) return;
    
    DOM.steSuggestions.innerHTML = '';
    if (results.length === 0) {
        DOM.steSuggestions.classList.add('hidden');
        return;
    }

    const fragment = document.createDocumentFragment();
    results.forEach(imgInfo => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion'; 
        
        const thumb = document.createElement('img');
        thumb.className = 'suggestion-thumbnail';
        thumb.src = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);
        thumb.alt = imgInfo.fileName;
        thumb.loading = 'lazy';

        const textContainer = document.createElement('div');
        textContainer.className = 'suggestion-text-content';

        const charNameSpan = document.createElement('span');
        charNameSpan.className = 'suggestion-character-name';
        charNameSpan.textContent = imgInfo.name;

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'suggestion-file-name';
        fileNameSpan.textContent = imgInfo.fileName;
        
        textContainer.appendChild(charNameSpan);
        textContainer.appendChild(fileNameSpan);
        
        item.appendChild(thumb);
        item.appendChild(textContainer);
        
        item.title = `${imgInfo.storageBox}/${imgInfo.folderName}/${imgInfo.fileName}`;
        
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (DOM.steSearchInput) DOM.steSearchInput.value = imgInfo.fileName;
            if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
            
            const foundIndex = AppState.galleryImages.findIndex(img => 
                img.urlPath === imgInfo.urlPath &&
                img.storageBox === imgInfo.storageBox
            );
            
            if (foundIndex > -1) {
                STEState.currentImageList = [...AppState.galleryImages];
                STEState.currentIndex = foundIndex - 1;
                loadNextImage();
            }
        });
        
        fragment.appendChild(item);
    });
    
    DOM.steSuggestions.appendChild(fragment);
    DOM.steSuggestions.classList.remove('hidden');
}

/**
 * 设置二级标签编辑器的事件监听器
 */
function setupSecondaryTagEditorEventListeners() {
    // 快捷标签点击事件
    if (DOM.stePredefinedTags) {
        DOM.stePredefinedTags.addEventListener('click', (e) => {
            if (!e.target.matches('.ste-predefined-tag')) return;
            const tag = e.target.dataset.tag;
            if (STEState.currentTags.has(tag)) {
                STEState.currentTags.delete(tag);
            } else {
                STEState.currentTags.add(tag);
            }
            renderCurrentTags();
            updatePredefinedTagsUI();
        });
    }

    // 手动输入标签
    if (DOM.steTagInput) {
        DOM.steTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tag = DOM.steTagInput.value.trim();
                if (tag) {
                    STEState.currentTags.add(tag);
                    renderCurrentTags();
                    updatePredefinedTagsUI();
                    DOM.steTagInput.value = '';
                }
            }
        });
    }

    // 模式切换
    document.querySelectorAll('input[name="steMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            STEState.currentMode = e.target.value;
            STEState.currentImageList = [];
            STEState.currentIndex = -1;
            
            const isAllMode = STEState.currentMode === 'all';
            if (DOM.steSearchInput) {
                DOM.steSearchInput.disabled = !isAllMode;
                if (!isAllMode) {
                    DOM.steSearchInput.value = '';
                    if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                }
            }
            loadNextImage();
        });
    });

    // 搜索框事件
    if (DOM.steSearchInput) {
        DOM.steSearchInput.addEventListener('input', () => {
            clearTimeout(STEState.searchDebounceTimer);
            STEState.searchDebounceTimer = setTimeout(() => {
                const query = DOM.steSearchInput.value.toLowerCase().trim();
                if (query) {
                    const results = AppState.galleryImages.filter(img => 
                        img.fileName.toLowerCase().includes(query) ||
                        img.name.toLowerCase().includes(query)
                    ).slice(0, 20);
                    displaySteSuggestions(results);
                } else {
                    if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                }
            }, DELAYS.INPUT_DEBOUNCE);
        });
        
        DOM.steSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                STEState.currentImageList = [];
                STEState.currentIndex = -1;
                loadNextImage();
            }
        });

        DOM.steSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
            }, 200);
        });
    }

    // 操作按钮
    if (DOM.steSaveButton) DOM.steSaveButton.addEventListener('click', saveAndNext);
    if (DOM.steSkipButton) DOM.steSkipButton.addEventListener('click', loadNextImage);

    // 图片点击放大
    if (DOM.stePreviewImage) {
        DOM.stePreviewImage.addEventListener('click', () => {
            if (DOM.stePreviewImage.src && !DOM.stePreviewImage.classList.contains('hidden')) {
                if (typeof window.openImageViewer === 'function') {
                    window.openImageViewer(DOM.stePreviewImage.src);
                }
            }
        });
    }
}