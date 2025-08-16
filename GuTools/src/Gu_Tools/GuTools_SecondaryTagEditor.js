// ==========================================================================
// GuTools 二级标签编辑器
// ==========================================================================

const STEState = {
    isInitialized: false,
    currentMode: 'fill',
    currentIndex: -1,
    currentImageList: [],
    currentImageEntry: null,
    currentTags: new Set(),
    searchDebounceTimer: null,
    lastBuiltMode: null,
    lastSearchKeyword: null,
    tagCategories: {},
    characterTags: [],
    isSavingTags: false,
    isScrolling: false, 
    allPredefinedTags: [], 
    activeSuggestionIndex: -1, 
    tagSearchIndex: [], 

    virtualStrip: {
        isInitialized: false,
        container: null,
        strip: null,
        thumbPool: [],
        poolSize: 40,      
        totalItems: 0,
        itemWidth: 110,    
        scrollEndTimer: null, 
    },

    inertia: {
        isDragging: false,
        startX: 0,
        scrollLeft: 0,
        velocity: 0,
        lastX: 0,
        frameId: null,
    }
};

let sortableInstance = null;
let modalTagState = null;


// ==========================================================================
// == 核心交互逻辑函数
// ==========================================================================

function handleScrollEnd() {
    const vstrip = STEState.virtualStrip;
    if (!vstrip.container) return;

    const containerCenter = vstrip.container.scrollLeft + vstrip.container.offsetWidth / 2;
    const centerIndex = Math.round(containerCenter / vstrip.itemWidth - 0.5);

    if (centerIndex >= 0 && centerIndex < vstrip.totalItems && centerIndex !== STEState.currentIndex) {
        switchToImageByIndex(centerIndex);
    } else {
        const targetScrollLeft = (STEState.currentIndex * vstrip.itemWidth) - (vstrip.container.offsetWidth / 2) + (vstrip.itemWidth / 2);
        vstrip.container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
}

function switchToImageByIndex(newIndex) {
    if (newIndex < 0 || newIndex >= STEState.currentImageList.length) return;

    STEState.currentIndex = newIndex;
    STEState.currentImageEntry = STEState.currentImageList[newIndex];

    if (DOM.steProgressDisplay) {
        DOM.steProgressDisplay.textContent = `${STEState.currentIndex + 1}/${STEState.currentImageList.length}`;
    }

    renderImageAndTags(STEState.currentImageEntry);
}


// ==========================================================================
// == 初始化与UI构建
// ==========================================================================

function waitForPinyin(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (typeof pinyinPro !== 'undefined') {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error("等待 pinyin 库加载超时！"));
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

async function initializeSecondaryTagEditorView() {
    if (STEState.isInitialized) {
        if (STEState.currentImageList.length === 0) {
            loadNextImage();
        }
        return;
    };
    if (!DOM.secondaryTagEditorPaneView) return;

    try {
        await waitForPinyin();
        const response = await fetch('/api/secondary-tags');
        if (!response.ok) throw new Error(`无法获取标签配置 (HTTP ${response.status})`);
        STEState.tagCategories = await response.json();
        STEState.characterTags = STEState.tagCategories['🧜‍♂ 人物类型'] || [];
        const categorizedTagsContainer = document.getElementById('steCategorizedTags');
        if (categorizedTagsContainer) {
            categorizedTagsContainer.innerHTML = '';
            for (const [category, tags] of Object.entries(STEState.tagCategories)) {
                if (category === '🧜‍♂ 人物类型') continue;
                const categoryEl = document.createElement('div');
                categoryEl.className = 'ste-tag-category';
                categoryEl.innerHTML = `<h6 class="ste-category-title">${category}</h6><div class="ste-category-tags-wrapper"></div>`;
                const wrapperEl = categoryEl.querySelector('.ste-category-tags-wrapper');
                tags.forEach(tag => {
                    const tagEl = document.createElement('div');
                    tagEl.className = 'ste-predefined-tag';
                    tagEl.textContent = tag;
                    tagEl.dataset.tag = tag;
                    wrapperEl.appendChild(tagEl);
                });
                categorizedTagsContainer.appendChild(categoryEl);
            }
        }
        
        const characterTagsContainer = document.getElementById('steCharTagsInteractive');
        if (characterTagsContainer) {
            characterTagsContainer.innerHTML = '';
            STEState.characterTags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'char-tag-pill';
                tagEl.textContent = tag;
                tagEl.dataset.tag = tag;
                characterTagsContainer.appendChild(tagEl);
            });
        }

        const allTagsSet = new Set();
        Object.values(STEState.tagCategories).forEach(tags => {
            tags.forEach(tag => allTagsSet.add(tag));
        });
        STEState.allPredefinedTags = Array.from(allTagsSet);
        const { pinyin } = pinyinPro;
        STEState.tagSearchIndex = STEState.allPredefinedTags.map(tag => ({
            tag: tag, lower: tag.toLowerCase(),
            initials: pinyin(tag, { pattern: 'first' }).replace(/\s/g, '').toLowerCase(),
            fullPinyin: pinyin(tag, { toneType: 'none', type: 'array' }).join('').toLowerCase()
        }));
        
        STEState.isInitialized = true;
    } catch (error) {
        console.error("加载二级标签失败:", error);
        displayToast("加载二级标签配置失败！", "error");
    }

    const modal = document.getElementById('steTagManagementModal');
    if (modal) {
        modal.querySelector('#steModalCloseBtn').addEventListener('click', closeTagManagementModal);
        modal.querySelector('#steModalAddNewTagBtn').addEventListener('click', handleAddNewTag);
        modal.querySelector('#steModalAddNewCategoryBtn').addEventListener('click', handleAddNewCategory);
        modal.querySelector('#steModalSaveChangesBtn').addEventListener('click', handleSaveChanges);
    }

    resetSTEInterface();
    if (DOM.steSearchInput) DOM.steSearchInput.disabled = true;
    const fillModeRadio = document.querySelector('input[name="steMode"][value="fill"]');
    if (fillModeRadio) fillModeRadio.checked = true;
    STEState.currentMode = 'fill';
    loadNextImage();
}

function resetSTEInterface(clearAll = true) {
    if (clearAll) {
        STEState.currentIndex = -1;
        STEState.currentImageList = [];
        if (DOM.steSearchInput) DOM.steSearchInput.value = '';
    }
    STEState.currentImageEntry = null;
    STEState.currentTags.clear();

    const mainPreview = document.getElementById('stePreviewImage');
    const mainPreviewPlaceholder = document.getElementById('stePreviewPlaceholder');

    if (mainPreview) { mainPreview.src = ''; mainPreview.classList.add('hidden'); }
    if (mainPreviewPlaceholder) mainPreviewPlaceholder.textContent = '加载中...';
    if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
    if (DOM.steTagList) DOM.steTagList.innerHTML = '';
    if (DOM.steTagInput) DOM.steTagInput.value = '';
    if (DOM.steSaveButton) DOM.steSaveButton.disabled = true;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = true;
    updatePredefinedTagsUI();
}


// ==========================================================================
// == 虚拟化滚动条渲染函数
// ==========================================================================

function initializeVirtualStrip() {
    const vstrip = STEState.virtualStrip;
    if (vstrip.isInitialized) return;

    vstrip.container = document.getElementById('steThumbnailStripContainer');
    vstrip.strip = document.getElementById('steThumbnailStrip');
    if (!vstrip.container || !vstrip.strip) return;

    vstrip.totalItems = STEState.currentImageList.length;
    vstrip.strip.innerHTML = '';

    vstrip.strip.style.width = `${vstrip.totalItems * vstrip.itemWidth}px`;
    vstrip.strip.style.height = '100%';

    const fragment = document.createDocumentFragment();
    vstrip.thumbPool = [];
    for (let i = 0; i < vstrip.poolSize; i++) {
        const thumb = document.createElement('img');
        thumb.className = 'ste-thumbnail';
        thumb.style.position = 'absolute';
        thumb.style.top = '50%';
        thumb.ondragstart = () => false;
        vstrip.thumbPool.push(thumb);
        fragment.appendChild(thumb);
    }
    vstrip.strip.appendChild(fragment);
    vstrip.isInitialized = true;
}

function renderVisibleThumbnails() {
    const vstrip = STEState.virtualStrip;
    if (!vstrip.isInitialized) return;

    const scrollLeft = vstrip.container.scrollLeft;
    const containerCenter = scrollLeft + vstrip.container.offsetWidth / 2;
    const startIndex = Math.max(0, Math.floor(scrollLeft / vstrip.itemWidth) - 5);
    const endIndex = Math.min(vstrip.totalItems, startIndex + vstrip.poolSize);

    vstrip.thumbPool.forEach((thumb, poolIndex) => {
        const itemIndex = startIndex + poolIndex;
        if (itemIndex < endIndex && itemIndex < vstrip.totalItems) {
            const imageEntry = STEState.currentImageList[itemIndex];
            if (!imageEntry) return;

            const fullPath = buildFullWebPath(imageEntry.storageBox, imageEntry.urlPath);
            const newSrc = `/api/thumbnail${fullPath}`;

            thumb.style.display = 'block';
            thumb.dataset.index = itemIndex;

            if (thumb.src !== newSrc) {
                thumb.src = newSrc;
            }

            const thumbCenter = (itemIndex * vstrip.itemWidth) + (vstrip.itemWidth / 2);
            const distance = Math.abs(containerCenter - thumbCenter);
            const isActive = itemIndex === STEState.currentIndex;

            let scale = Math.max(0.8, 1.05 - distance / (vstrip.container.offsetWidth * 0.8)); 
            let opacity = Math.max(0.7, 1 - distance / (vstrip.container.offsetWidth / 1.2)); 

            if (isActive) {
                scale = 1.25; 
                opacity = 1;
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }

            thumb.style.transform = `translateX(${itemIndex * vstrip.itemWidth}px) translateY(-50%) scale(${scale})`;
            thumb.style.opacity = opacity;

        } else {
            thumb.style.display = 'none';
        }
    });
}

// ==========================================================================
// == 状态与数据处理
// ==========================================================================

function showTagSuggestions(query) {
    const suggestionsContainer = document.getElementById('steTagInputSuggestions');
    if (!suggestionsContainer) return;

    if (!query) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    const lowerCaseQuery = query.toLowerCase();
    const results = STEState.tagSearchIndex.filter(tagObj => {
        const notAdded = !STEState.currentTags.has(tagObj.tag);
        const queryMatch = tagObj.lower.includes(lowerCaseQuery) ||
            tagObj.initials.includes(lowerCaseQuery) ||
            tagObj.fullPinyin.includes(lowerCaseQuery);
        return notAdded && queryMatch;
    }).slice(0, 10); 

    suggestionsContainer.innerHTML = '';
    if (results.length === 0) {
        suggestionsContainer.classList.add('hidden');
        return;
    }

    results.forEach(tagObj => {
        const item = document.createElement('div');
        item.className = 'suggestion-tag-item';
        item.textContent = tagObj.tag; 
        item.dataset.tag = tagObj.tag; 
        item.addEventListener('mousedown', () => {
            addTag(tagObj.tag);
        });
        suggestionsContainer.appendChild(item);
    });

    STEState.activeSuggestionIndex = -1;
    suggestionsContainer.classList.remove('hidden');
}

function hideTagSuggestions() {
    const suggestionsContainer = document.getElementById('steTagInputSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }
    STEState.activeSuggestionIndex = -1;
}

function updateSuggestionHighlight() {
    const suggestionsContainer = document.getElementById('steTagInputSuggestions');
    if (!suggestionsContainer) return;

    const items = suggestionsContainer.querySelectorAll('.suggestion-tag-item');

    items.forEach((item, index) => {
        const isSelected = index === STEState.activeSuggestionIndex;
        item.classList.toggle('selected', isSelected);

        if (isSelected) {
            item.scrollIntoView({
                behavior: 'smooth', 
                block: 'nearest'    
            });
        }
    });
}

function addTag(tag) {
    if (tag) {
        STEState.currentTags.add(tag);
        renderCurrentTags();
        updatePredefinedTagsUI();
        if (DOM.steTagInput) DOM.steTagInput.value = '';
        hideTagSuggestions();
    }
}

function loadNextImage() {
    resetSTEInterface(false);

    const mode = STEState.currentMode;
    const searchKeyword = DOM.steSearchInput.value.toLowerCase().trim();

    if (mode === 'all' && searchKeyword && searchWorker) {
        STEState.lastSearchKeyword = searchKeyword;
        STEState.lastBuiltMode = mode;
        searchWorker.postMessage({ type: 'search', payload: { query: searchKeyword } });
        return;
    }

    const shouldRebuildList = STEState.currentImageList.length === 0 ||
        mode !== STEState.lastBuiltMode ||
        (mode === 'all' && searchKeyword !== STEState.lastSearchKeyword);

    if (shouldRebuildList) {
        STEState.lastBuiltMode = mode;
        STEState.lastSearchKeyword = searchKeyword;
        STEState.currentIndex = -1;
        STEState.virtualStrip.isInitialized = false; 

        if (mode === 'fill') {
            STEState.currentImageList = AppState.galleryImages.filter(img => {
                const userDataEntry = AppState.userData.find(ud => ud.path === img.urlPath && ud.storagebox?.toLowerCase() === img.storageBox.toLowerCase());
                return !userDataEntry || !userDataEntry.attributes.secondaryTags || userDataEntry.attributes.secondaryTags.length === 0;
            });
        } else if (mode === 'all') {
            STEState.currentImageList = [...AppState.galleryImages];
        }

        initializeVirtualStrip();
    }

    const nextIndex = STEState.currentIndex + 1;

    if (nextIndex >= STEState.currentImageList.length) {
        if (document.getElementById('stePreviewPlaceholder')) document.getElementById('stePreviewPlaceholder').textContent = '所有图片处理完毕！🎉';
        if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
        if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = '完成';
        if (document.getElementById('stePreviewImage')) document.getElementById('stePreviewImage').classList.add('hidden');
        if (DOM.steThumbnailStripContainer) DOM.steThumbnailStripContainer.classList.add('hidden');

        if (mode === 'fill') {
            displayToast("当前模式下所有图片已处理完毕！", "success");
        }
    } else {
        if (DOM.steThumbnailStripContainer) DOM.steThumbnailStripContainer.classList.remove('hidden');
        switchToImageByIndex(nextIndex);
    }
}

function renderImageAndTags(imageEntry) {
    if (!imageEntry) return;

    if (typeof window.resetImageViewer === 'function') {
        window.resetImageViewer();
    }

    const mainPreview = document.getElementById('stePreviewImage');
    if (mainPreview) {
        mainPreview.src = buildFullWebPath(imageEntry.storageBox, imageEntry.urlPath);
        mainPreview.classList.remove('hidden');
        if (document.getElementById('stePreviewPlaceholder')) document.getElementById('stePreviewPlaceholder').textContent = '';
    }

    if (DOM.steImageInfo) {
        DOM.steImageInfo.classList.remove('hidden');
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').textContent = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').title = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-character').textContent = `角色: ${imageEntry.name}`;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-storagebox').textContent = `仓库: ${imageEntry.storageBox}`;
    }

    const userDataEntry = AppState.userData.find(ud => ud.path === imageEntry.urlPath && ud.storagebox?.toLowerCase() === imageEntry.storageBox.toLowerCase());
    STEState.currentTags.clear();
    if (userDataEntry && userDataEntry.attributes.secondaryTags) {
        userDataEntry.attributes.secondaryTags.forEach(tag => STEState.currentTags.add(tag));
    }
    renderCurrentTags();
    updatePredefinedTagsUI();

    const vstrip = STEState.virtualStrip;
    if (vstrip.container && vstrip.isInitialized) {
        STEState.isScrolling = true;
        const targetScrollLeft = (STEState.currentIndex * vstrip.itemWidth) - (vstrip.container.offsetWidth / 2) + (vstrip.itemWidth / 2);

        vstrip.container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });

        const animationStartTime = performance.now();
        const animationDuration = 350; 
        const renderDuringAnimation = () => {
            renderVisibleThumbnails();
            if (performance.now() - animationStartTime < animationDuration) {
                requestAnimationFrame(renderDuringAnimation);
            } else {
                STEState.isScrolling = false; 
            }
        };
        requestAnimationFrame(renderDuringAnimation);
    }

    if (DOM.steSaveButton) DOM.steSaveButton.disabled = false;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = false;
}

function renderCurrentTags() {
    if (!DOM.steTagList) return;
    DOM.steTagList.innerHTML = '';
    const nonCharTags = Array.from(STEState.currentTags).filter(tag => !STEState.characterTags.includes(tag));
    nonCharTags.forEach(tag => {
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

function updatePredefinedTagsUI() {
    document.querySelectorAll('.ste-predefined-tag').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
    document.querySelectorAll('#steCharTagsInteractive .char-tag-pill').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
}

async function saveAndNext() {
    if (!STEState.currentImageEntry) return;

    const selectedTagsArray = Array.from(STEState.currentTags);

    const hasCharacterTag = selectedTagsArray.some(tag => STEState.characterTags.includes(tag));

    if (!hasCharacterTag) {
        displayToast("请至少选择一个人物标签！", "warning");
        return;
    }

    const currentSelection = STEState.currentImageEntry;
    let entryIndex = AppState.userData.findIndex(ud => ud.path === currentSelection.urlPath && ud.storagebox?.toLowerCase() === currentSelection.storageBox.toLowerCase());
    let entryToProcess, isNewEntry = false;

    if (entryIndex > -1) {
        entryToProcess = { ...AppState.userData[entryIndex] };
        if (!entryToProcess.attributes) entryToProcess.attributes = {};
    } else {
        const md5Value = await fetchImageMd5(buildFullWebPath(currentSelection.storageBox, currentSelection.urlPath)) || null;
        entryToProcess = {
            storagebox: currentSelection.storageBox.toLowerCase(), gid: generateNumericId(), characterName: currentSelection.name || "Unknown",
            path: currentSelection.urlPath, attributes: {
                filename: currentSelection.fileName, parentFolder: currentSelection.folderName, isPx18: false, isRx18: false, layout: "normal",
                isEasterEgg: false, isAiImage: false, isBan: false, md5: md5Value, Downloaded_From: "TagEditor",
            }, timestamp: new Date().toISOString(), sourceGallery: currentSelection.gallery,
        };
        isNewEntry = true;
    }

    entryToProcess.attributes.secondaryTags = Array.from(STEState.currentTags);
    entryToProcess.timestamp = new Date().toISOString();

    const updatedDataList = [...AppState.userData];
    if (isNewEntry) { updatedDataList.push(entryToProcess); } else { updatedDataList[entryIndex] = entryToProcess; }

    const success = await updateUserData(updatedDataList, `标签已保存`, "toast", false, 2000);
    if (success) {
        if (STEState.currentMode === 'fill') {
            STEState.currentImageList.splice(STEState.currentIndex, 1);
            STEState.virtualStrip.totalItems = STEState.currentImageList.length;
            if (STEState.virtualStrip.strip) {
                STEState.virtualStrip.strip.style.width = `${STEState.virtualStrip.totalItems * STEState.virtualStrip.itemWidth}px`;
            }

            if (STEState.currentIndex >= STEState.currentImageList.length) {
                loadNextImage(); 
            } else {
                switchToImageByIndex(STEState.currentIndex);
            }
        } else {
            loadNextImage();
        }
    }
}

function displaySteSuggestions(results) {
    if (!DOM.steSuggestions) return;
    DOM.steSuggestions.innerHTML = '';
    if (results.length === 0) { DOM.steSuggestions.classList.add('hidden'); return; }
    const fragment = document.createDocumentFragment();
    results.slice(0, 20).forEach(imgInfo => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion';
        const thumb = document.createElement('img');
        thumb.className = 'suggestion-thumbnail';
        const fullImagePath = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);
        thumb.src = `/api/thumbnail${fullImagePath}`;
        const textContainer = document.createElement('div');
        textContainer.className = 'suggestion-text-content';
        const charNameSpan = document.createElement('span');
        charNameSpan.className = 'suggestion-character-name';
        charNameSpan.textContent = imgInfo.name;
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'suggestion-file-name';
        fileNameSpan.textContent = imgInfo.fileName;
        textContainer.append(charNameSpan, fileNameSpan);
        item.append(thumb, textContainer);
        item.title = `${imgInfo.storageBox}/${imgInfo.folderName}/${imgInfo.fileName}`;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (DOM.steSearchInput) DOM.steSearchInput.value = imgInfo.fileName;
            if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
            STEState.currentImageList = [imgInfo];
            STEState.lastBuiltMode = 'all';
            STEState.lastSearchKeyword = imgInfo.fileName.toLowerCase();
            STEState.currentIndex = -1;
            STEState.virtualStrip.isInitialized = false;
            initializeVirtualStrip();
            loadNextImage();
        });
        fragment.appendChild(item);
    });
    DOM.steSuggestions.appendChild(fragment);
    DOM.steSuggestions.classList.remove('hidden');
}


// ==========================================================================
// == 事件监听器设置
// ==========================================================================

function setupSecondaryTagEditorEventListeners() {
    const rightPanel = document.querySelector('.ste-right-panel');
    const leftPanelInfo = document.getElementById('steImageInfo');

    if (rightPanel) {
        rightPanel.addEventListener('click', (e) => {
            if (e.target.matches('.ste-predefined-tag')) {
                const tag = e.target.dataset.tag;
                STEState.currentTags.has(tag) ? STEState.currentTags.delete(tag) : STEState.currentTags.add(tag);
                renderCurrentTags();
                updatePredefinedTagsUI();
            }
        });
    }

    if (leftPanelInfo) {
        leftPanelInfo.addEventListener('click', (e) => {
            if (e.target.matches('.char-tag-pill')) {
                const tag = e.target.dataset.tag;
                STEState.currentTags.has(tag) ? STEState.currentTags.delete(tag) : STEState.currentTags.add(tag);
                renderCurrentTags();
                updatePredefinedTagsUI();
            }
        });
    }

    if (DOM.steTagInput) {
        DOM.steTagInput.addEventListener('input', () => {
            const query = DOM.steTagInput.value.trim();
            showTagSuggestions(query);
        });
        DOM.steTagInput.addEventListener('keydown', (e) => {
            const suggestionsContainer = document.getElementById('steTagInputSuggestions');
            const items = suggestionsContainer?.querySelectorAll('.suggestion-tag-item');
            const suggestionsVisible = items && items.length > 0;
            switch (e.key) {
                case 'ArrowDown': if (suggestionsVisible) { e.preventDefault(); STEState.activeSuggestionIndex = (STEState.activeSuggestionIndex + 1) % items.length; updateSuggestionHighlight(); } break;
                case 'ArrowUp': if (suggestionsVisible) { e.preventDefault(); STEState.activeSuggestionIndex = (STEState.activeSuggestionIndex - 1 + items.length) % items.length; updateSuggestionHighlight(); } break;
                case 'Enter':
                    e.preventDefault();
                    let tagToAdd = '';
                    if (suggestionsVisible && STEState.activeSuggestionIndex > -1) {
                        tagToAdd = items[STEState.activeSuggestionIndex].dataset.tag;
                    } else {
                        tagToAdd = DOM.steTagInput.value.trim();
                    }
                    addTag(tagToAdd);
                    break;
                case ',': e.preventDefault(); addTag(DOM.steTagInput.value.trim()); break;
                case 'Escape': hideTagSuggestions(); break;
            }
        });
        DOM.steTagInput.addEventListener('blur', () => { setTimeout(hideTagSuggestions, 150); });
    }

    document.querySelectorAll('input[name="steMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            STEState.currentMode = e.target.value;
            STEState.currentImageList = [];
            STEState.currentIndex = -1;
            if (DOM.steSearchInput) DOM.steSearchInput.disabled = (STEState.currentMode !== 'all');
            if (STEState.currentMode !== 'all') {
                if (DOM.steSearchInput) DOM.steSearchInput.value = '';
                if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
            }
            loadNextImage();
        });
    });

    if (DOM.steSearchInput) {
        DOM.steSearchInput.addEventListener('input', () => {
            clearTimeout(STEState.searchDebounceTimer);
            STEState.searchDebounceTimer = setTimeout(() => {
                const query = DOM.steSearchInput.value.trim();
                if (query && searchWorker) {
                    searchWorker.postMessage({ type: 'search', payload: { query, dataSource: 'physical' } });
                } else {
                    if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                }
            }, DELAYS.INPUT_DEBOUNCE);
        });
        DOM.steSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                loadNextImage();
            }
        });
        DOM.steSearchInput.addEventListener('blur', () => { if (DOM.steSuggestions) setTimeout(() => DOM.steSuggestions.classList.add('hidden'), 200); });
    }

    if (DOM.steSaveButton) DOM.steSaveButton.addEventListener('click', saveAndNext);
    if (DOM.steSkipButton) DOM.steSkipButton.addEventListener('click', loadNextImage);

    const mainPreview = document.getElementById('stePreviewImage');
    if (mainPreview) {
        mainPreview.addEventListener('click', () => {
            if (mainPreview.src && !mainPreview.classList.contains('hidden') && typeof window.openImageViewer === 'function') {
                window.openImageViewer(mainPreview.src);
            }
        });
    }

    if (DOM.steManageTagsBtn) {
        DOM.steManageTagsBtn.addEventListener('click', openTagManagementModal);
    }

    const thumbContainer = document.getElementById('steThumbnailStripContainer');
    if (thumbContainer) {
        const inertiaState = STEState.inertia; let hasDragged = false;
        const startDrag = (e) => { hasDragged = false; inertiaState.isDragging = true; thumbContainer.classList.add('active-drag'); inertiaState.startX = e.pageX || e.touches[0].pageX; inertiaState.scrollLeft = thumbContainer.scrollLeft; inertiaState.lastX = inertiaState.startX; inertiaState.velocity = 0; cancelAnimationFrame(inertiaState.frameId); };
        const onDrag = (e) => { if (!inertiaState.isDragging) return; e.preventDefault(); hasDragged = true; const currentX = e.pageX || e.touches[0].pageX; const walk = currentX - inertiaState.startX; thumbContainer.scrollLeft = inertiaState.scrollLeft - walk; inertiaState.velocity = currentX - inertiaState.lastX; inertiaState.lastX = currentX; };
        const stopDrag = () => {
            if (!inertiaState.isDragging) return; inertiaState.isDragging = false; thumbContainer.classList.remove('active-drag');
            if (!hasDragged || Math.abs(inertiaState.velocity) < 0.5) { handleScrollEnd(); return; }
            const inertiaFrame = () => { if (Math.abs(inertiaState.velocity) < 0.5) { cancelAnimationFrame(inertiaState.frameId); handleScrollEnd(); return; } thumbContainer.scrollLeft -= inertiaState.velocity; inertiaState.velocity *= 0.94; inertiaState.frameId = requestAnimationFrame(inertiaFrame); };
            inertiaState.frameId = requestAnimationFrame(inertiaFrame);
        };
        thumbContainer.addEventListener('click', e => { if (hasDragged) { e.preventDefault(); hasDragged = false; return; } const thumb = e.target.closest('.ste-thumbnail'); if (thumb) { const newIndex = parseInt(thumb.dataset.index, 10); if (!isNaN(newIndex) && newIndex !== STEState.currentIndex) { switchToImageByIndex(newIndex); } } });
        thumbContainer.addEventListener('mousedown', startDrag);
        thumbContainer.addEventListener('mousemove', onDrag);
        thumbContainer.addEventListener('mouseup', stopDrag);
        thumbContainer.addEventListener('mouseleave', stopDrag);
        thumbContainer.addEventListener('touchstart', startDrag, { passive: true });
        thumbContainer.addEventListener('touchmove', onDrag, { passive: false });
        thumbContainer.addEventListener('touchend', stopDrag);
        thumbContainer.addEventListener('scroll', () => { renderVisibleThumbnails(); if (!STEState.isScrolling && !inertiaState.isDragging) { clearTimeout(STEState.virtualStrip.scrollEndTimer); STEState.virtualStrip.scrollEndTimer = setTimeout(handleScrollEnd, 150); } });
    }

    if (DOM.steManageTagsBtn) {
        DOM.steManageTagsBtn.addEventListener('click', openTagManagementModal);
    }

    const categorizedTagsContainer = document.getElementById('steCategorizedTags');
    if (categorizedTagsContainer) {
        categorizedTagsContainer.addEventListener('wheel', (event) => {
            const targetWrapper = event.target.closest('.ste-category-tags-wrapper');
            if (!targetWrapper) return;
            if (targetWrapper.scrollWidth > targetWrapper.clientWidth) { event.preventDefault(); targetWrapper.scrollLeft += event.deltaY; }
        }, { passive: false });
    }
    
    setupSteNavScroll();
}

function setupSteNavScroll() {
    const navBar = document.querySelector('#secondaryTagEditorPaneView .gu-tools-title-bar');
    if (!navBar) {
        console.warn("SecondaryTagEditor: 未找到专用的导航栏，无法设置悬停滚动。");
        return;
    }

    let scrollInterval = null;

    const startScrolling = (direction) => {
        if (scrollInterval) return;
        scrollInterval = setInterval(() => {
            navBar.scrollLeft += direction * 5; 
        }, 16); 
    };

    const stopScrolling = () => {
        clearInterval(scrollInterval);
        scrollInterval = null;
    };

    navBar.addEventListener('mousemove', (e) => {
        const rect = navBar.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const scrollZone = 60; // 鼠标靠近边缘60像素时触发

        // 只有当内容确实比容器宽时才滚动
        if (navBar.scrollWidth > navBar.clientWidth) {
            if (mouseX > rect.width - scrollZone) {
                startScrolling(1); // 向右
            } else if (mouseX < scrollZone) {
                startScrolling(-1); // 向左
            } else {
                stopScrolling();
            }
        }
    });

    navBar.addEventListener('mouseleave', stopScrolling);
    console.log("SecondaryTagEditor: 悬停滚动效果已设置。");
}


// ==========================================================================
// == 标签管理模态框相关函数
// ==========================================================================

function openTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    const select = document.getElementById('steModalCategorySelect');
    if (!modal || !select) return;
    
    document.getElementById('secondaryTagEditorPaneView').classList.add('modal-active');

    modalTagState = JSON.parse(JSON.stringify(STEState.tagCategories));

    ['steModalNewTagInput', 'steModalNewCategoryInput', 'steModalFirstTagInput'].forEach(id => {
        document.getElementById(id).value = '';
    });
    
    const messageArea = document.getElementById('steModalMessageArea');
    if(messageArea) {
        messageArea.textContent = '';
        messageArea.className = 'modal-message';
    }

    select.innerHTML = '';
    Object.keys(modalTagState).forEach(category => {
        select.add(new Option(category, category));
    });

    populateTagsForDeletion_new(); 
    modal.classList.remove('hidden');
}

function closeTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    if (modal) modal.classList.add('hidden');
    document.getElementById('secondaryTagEditorPaneView').classList.remove('modal-active');
    if (sortableInstance) {
        if (Array.isArray(sortableInstance)) sortableInstance.forEach(i => i.destroy());
        else sortableInstance.destroy();
        sortableInstance = null;
    }
    modalTagState = null;
}

function populateTagsForDeletion_new() {
    const container = document.getElementById('tagsToDeleteContainer');
    if (!container) return;
    if (Array.isArray(sortableInstance)) sortableInstance.forEach(i => i.destroy());
    sortableInstance = [];

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    for (const [category, tags] of Object.entries(modalTagState)) {
        if (!tags || tags.length === 0) continue;
        const categoryEl = document.createElement('div');
        categoryEl.className = 'ste-modal-category';
        categoryEl.innerHTML = `<h6 class="ste-modal-category-title">${category}</h6>`;
        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'ste-modal-tags-wrapper';
        tags.forEach(tag => {
            const tagPill = document.createElement('div');
            tagPill.className = 'ste-deletable-tag-item';
            tagPill.innerHTML = `<span>${tag}</span><span class="ste-tag-remove" data-tag="${tag}" data-category="${category}">×</span>`;
            wrapperEl.appendChild(tagPill);
        });
        categoryEl.appendChild(wrapperEl);
        fragment.appendChild(categoryEl);
    }
    container.appendChild(fragment);

    container.onclick = (e) => { if (e.target.classList.contains('ste-tag-remove')) handleDeleteTag(e.target.dataset.tag, e.target.dataset.category); };
    
    container.querySelectorAll('.ste-modal-tags-wrapper').forEach(wrapper => {
         sortableInstance.push(new Sortable(wrapper, {
            group: 'shared-tags', animation: 150, ghostClass: 'sortable-ghost',
            onEnd: () => { updateModalTagStateFromDOM(); displayModalMessage("排序已在本地更新，点击“保存更改”生效。", "info"); }
        }));
    });
}

function updateModalTagStateFromDOM() {
    const container = document.getElementById('tagsToDeleteContainer');
    if (!container) return;
    const newModalTagState = {};
    container.querySelectorAll('.ste-modal-category').forEach(categoryEl => {
        const title = categoryEl.querySelector('.ste-modal-category-title').textContent;
        const tags = Array.from(categoryEl.querySelectorAll('.ste-deletable-tag-item span:first-child')).map(span => span.textContent);
        newModalTagState[title] = tags;
    });
    modalTagState = newModalTagState;
}

function handleDeleteTag(tagToDelete, categoryFrom) {
    if (modalTagState[categoryFrom]) {
        modalTagState[categoryFrom] = modalTagState[categoryFrom].filter(t => t !== tagToDelete);
        if (modalTagState[categoryFrom].length === 0) {
            delete modalTagState[categoryFrom];
            const select = document.getElementById('steModalCategorySelect');
            if(select) Array.from(select.options).find(opt => opt.value === categoryFrom)?.remove();
        }
        displayModalMessage(`标签 [${tagToDelete}] 已在本地移除，点击“保存更改”生效。`, "info");
        populateTagsForDeletion_new();
    }
}

function handleAddNewTag() {
    const category = document.getElementById('steModalCategorySelect').value;
    const newTagsInput = document.getElementById('steModalNewTagInput');
    const newTags = newTagsInput.value.trim().split(/[,，\s]+/).filter(Boolean);
    if (!category || newTags.length === 0) { displayModalMessage("请选择分类并输入至少一个新标签！", "warning"); return; }
    
    modalTagState[category] = modalTagState[category] || [];
    let addedCount = 0;
    newTags.forEach(tag => { if (!modalTagState[category].includes(tag)) { modalTagState[category].push(tag); addedCount++; } });

    if (addedCount > 0) {
        displayModalMessage(`已在本地添加 ${addedCount} 个新标签，点击“保存更改”生效。`, "info");
        newTagsInput.value = '';
        populateTagsForDeletion_new();
    } else {
        displayModalMessage("输入的标签都已存在于该分类中。", "info");
    }
}

function handleAddNewCategory() {
    const newCategoryInput = document.getElementById('steModalNewCategoryInput');
    const firstTagInput = document.getElementById('steModalFirstTagInput');
    const newCategory = newCategoryInput.value.trim();
    const firstTag = firstTagInput.value.trim();
    if (!newCategory || !firstTag) { displayModalMessage("新分类名和第一个标签都不能为空！", "warning"); return; }
    if (modalTagState.hasOwnProperty(newCategory)) { displayModalMessage("这个分类名称已经存在了！", "warning"); return; }
    
    modalTagState[newCategory] = [firstTag];
    displayModalMessage(`已在本地新增分类 [${newCategory}]，点击“保存更改”生效。`, "info");
    
    document.getElementById('steModalCategorySelect')?.add(new Option(newCategory, newCategory));
    newCategoryInput.value = '';
    firstTagInput.value = '';
    populateTagsForDeletion_new();
}

async function handleSaveChanges() {
    if (!modalTagState) return;
    await saveTagsToServer(modalTagState);
}

async function saveTagsToServer(fullData) {
    if (STEState.isSavingTags) return; STEState.isSavingTags = true; displayModalMessage("正在保存...", "info");
    try {
        const response = await fetch('/api/update-secondary-tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fullData) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "保存失败");
        
        displayModalMessage("保存成功！界面将刷新...", "success");
        setTimeout(() => {
            closeTagManagementModal();
            STEState.tagCategories = JSON.parse(JSON.stringify(fullData));
            STEState.isInitialized = false; 
            initializeSecondaryTagEditorView();
        }, 1500);
    } catch (error) {
        console.error("保存标签失败:", error);
        displayModalMessage(`保存失败: ${error.message}`, "error");
    } finally {
        STEState.isSavingTags = false;
    }
}

function displayModalMessage(text, type) {
    const area = document.getElementById('steModalMessageArea');
    if (area) {
        area.textContent = text;
        area.className = `modal-message ${type} visible`;
    }
}

