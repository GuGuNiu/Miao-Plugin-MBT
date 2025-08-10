// ==========================================================================
// GuTools 二级标签编辑器 (已修复滚动体验和交互逻辑的最终版本)
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
    isScrolling: false, // 标记是否为程序化滚动

    // 虚拟化滚动条状态
    virtualStrip: {
        isInitialized: false,
        container: null,
        strip: null,
        thumbPool: [],
        poolSize: 40,      // DOM节点池大小
        totalItems: 0,
        itemWidth: 110,    // 单个项目的宽度
        scrollEndTimer: null, // 用于检测滚动停止的计时器
    },

    // 惯性滚动状态
    inertia: {
        isDragging: false,
        startX: 0,
        scrollLeft: 0,
        velocity: 0,
        lastX: 0,
        frameId: null,
    }
};

// 用于管理模态框内部状态和 SortableJS 实例
let sortableInstance = null;
let modalTagState = null;


// ==========================================================================
// == 核心交互逻辑函数
// ==========================================================================

/**
 * 滚动结束处理函数，实现“齿轮感”吸附效果
 */
function handleScrollEnd() {
    const vstrip = STEState.virtualStrip;
    if (!vstrip.container) return;

    // 计算当前最靠近中心的缩略图索引
    const containerCenter = vstrip.container.scrollLeft + vstrip.container.offsetWidth / 2;
    const centerIndex = Math.round(containerCenter / vstrip.itemWidth - 0.5);

    if (centerIndex >= 0 && centerIndex < vstrip.totalItems && centerIndex !== STEState.currentIndex) {
        // 如果计算出的中心索引和当前索引不同，则切换到该图片
        switchToImageByIndex(centerIndex);
    } else {
        // 如果索引相同，也强制滚动到精确的中心位置，确保完美对齐
        const targetScrollLeft = (STEState.currentIndex * vstrip.itemWidth) - (vstrip.container.offsetWidth / 2) + (vstrip.itemWidth / 2);
        vstrip.container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    }
}

/**
 * 所有图片切换的统一入口，直接切换到指定索引的图片
 * @param {number} newIndex - 要切换到的图片在 currentImageList 中的索引
 */
function switchToImageByIndex(newIndex) {
    if (newIndex < 0 || newIndex >= STEState.currentImageList.length) return;

    STEState.currentIndex = newIndex;
    STEState.currentImageEntry = STEState.currentImageList[newIndex];

    if (DOM.steProgressDisplay) {
        DOM.steProgressDisplay.textContent = `${STEState.currentIndex + 1}/${STEState.currentImageList.length}`;
    }
    
    // 渲染主图和标签，这个函数内部会处理滚动条的“吸附”动画
    renderImageAndTags(STEState.currentImageEntry);
}


// ==========================================================================
// == 初始化与UI构建
// ==========================================================================

/**
 * 初始化二级标签编辑器视图，从API获取标签并动态创建UI。
 */
async function initializeSecondaryTagEditorView() {
    if (STEState.isInitialized) return;
    if (!DOM.secondaryTagEditorPaneView) return;

    try {
        const response = await fetch('/api/secondary-tags');
        if (!response.ok) throw new Error(`无法获取标签配置 (HTTP ${response.status})`);
        const allTagsData = await response.json();

        STEState.characterTags = allTagsData['🧜‍♂ 人物类型'] || [];
        delete allTagsData['🧜‍♂ 人物类型'];
        STEState.tagCategories = allTagsData;

        // 动态构建分类标签UI
        const categorizedTagsContainer = document.getElementById('steCategorizedTags');
        if (categorizedTagsContainer) {
            categorizedTagsContainer.innerHTML = '';
            for (const [category, tags] of Object.entries(STEState.tagCategories)) {
                const categoryEl = document.createElement('div');
                categoryEl.className = 'ste-tag-category';
                const titleEl = document.createElement('h6');
                titleEl.className = 'ste-category-title';
                titleEl.textContent = category;
                const wrapperEl = document.createElement('div');
                wrapperEl.className = 'ste-category-tags-wrapper';
                tags.forEach(tag => {
                    const tagEl = document.createElement('div');
                    tagEl.className = 'ste-predefined-tag';
                    tagEl.textContent = tag;
                    tagEl.dataset.tag = tag;
                    wrapperEl.appendChild(tagEl);
                });
                categoryEl.appendChild(titleEl);
                categoryEl.appendChild(wrapperEl);
                categorizedTagsContainer.appendChild(categoryEl);
            }
        }

        // 动态构建人物标签UI
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
        STEState.isInitialized = true;
    } catch (error) {
        console.error("加载二级标签失败:", error);
        displayToast("加载二级标签配置失败！", "error");
    }

    // 绑定模态框事件
    const modal = document.getElementById('steTagManagementModal');
    if (modal) {
        modal.querySelector('#steModalCloseBtn').addEventListener('click', closeTagManagementModal);
        modal.querySelector('#steModalAddNewTagBtn').addEventListener('click', handleAddNewTag);
        modal.querySelector('#steModalAddNewCategoryBtn').addEventListener('click', handleAddNewCategory);
        modal.querySelector('#steModalDeleteCategorySelect').addEventListener('change', populateTagsForDeletion);
        modal.querySelector('#steModalSaveChangesBtn').addEventListener('click', handleSaveChanges);
    }

    // 重置并加载首张图
    resetSTEInterface();
    if (DOM.steSearchInput) DOM.steSearchInput.disabled = true;
    const fillModeRadio = document.querySelector('input[name="steMode"][value="fill"]');
    if (fillModeRadio) fillModeRadio.checked = true;
    STEState.currentMode = 'fill';
    loadNextImage();
}

/**
 * 重置编辑器界面状态。
 */
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

/**
 * 初始化虚拟滚动条，创建DOM节点池并设置虚拟总宽度。
 */
function initializeVirtualStrip() {
    const vstrip = STEState.virtualStrip;
    if (vstrip.isInitialized) return;

    vstrip.container = document.getElementById('steThumbnailStripContainer');
    vstrip.strip = document.getElementById('steThumbnailStrip');
    if (!vstrip.container || !vstrip.strip) return;

    vstrip.totalItems = STEState.currentImageList.length;
    vstrip.strip.innerHTML = '';

    // 这是实现虚拟滚动的关键：让内部容器拥有所有图片的总宽度
    vstrip.strip.style.width = `${vstrip.totalItems * vstrip.itemWidth}px`;
    vstrip.strip.style.height = '100%';

    // 创建可复用的DOM节点池
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

/**
 * 根据滚动位置，渲染当前可见的缩略图。
 */
function renderVisibleThumbnails() {
    const vstrip = STEState.virtualStrip;
    if (!vstrip.isInitialized) return;

    const scrollLeft = vstrip.container.scrollLeft;
    const containerCenter = scrollLeft + vstrip.container.offsetWidth / 2;
    // 计算可见范围，并向两侧多渲染一些作为缓冲区
    const startIndex = Math.max(0, Math.floor(scrollLeft / vstrip.itemWidth) - 5);
    const endIndex = Math.min(vstrip.totalItems, startIndex + vstrip.poolSize);

    // 循环利用节点池中的DOM元素
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

            // --- 合并后的样式计算逻辑 ---
            const thumbCenter = (itemIndex * vstrip.itemWidth) + (vstrip.itemWidth / 2);
            const distance = Math.abs(containerCenter - thumbCenter);
            const isActive = itemIndex === STEState.currentIndex;

            let scale = Math.max(0.75, 1.1 - distance / vstrip.container.offsetWidth);
            let opacity = Math.max(0.6, 1 - distance / (vstrip.container.offsetWidth / 1.5));
            
            if (isActive) {
                scale = 1.25; // 当前选中的缩略图放大
                opacity = 1;
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }

            // 直接计算并设置最终的 transform 样式
            thumb.style.transform = `translateX(${itemIndex * vstrip.itemWidth}px) translateY(-50%) scale(${scale})`;
            thumb.style.opacity = opacity;

        } else {
            // 隐藏当前不需要的节点
            thumb.style.display = 'none';
        }
    });
}

// ==========================================================================
// == 状态与数据处理
// ==========================================================================

/**
 * 加载并显示“下一张”需要编辑的图片
 */
function loadNextImage() {
    resetSTEInterface(false);

    const mode = STEState.currentMode;
    const searchKeyword = DOM.steSearchInput.value.toLowerCase().trim();

    // 检查是否需要重新构建图片列表
    const shouldRebuildList = STEState.currentImageList.length === 0 ||
        mode !== STEState.lastBuiltMode ||
        (mode === 'all' && searchKeyword !== STEState.lastSearchKeyword);

    if (shouldRebuildList) {
        STEState.lastBuiltMode = mode;
        STEState.lastSearchKeyword = searchKeyword;
        STEState.currentIndex = -1;
        STEState.virtualStrip.isInitialized = false; // 需要重新初始化虚拟滚动

        if (mode === 'fill') {
            STEState.currentImageList = AppState.galleryImages.filter(img => {
                const userDataEntry = AppState.userData.find(ud => ud.path === img.urlPath && ud.storagebox?.toLowerCase() === img.storageBox.toLowerCase());
                return !userDataEntry || !userDataEntry.attributes.secondaryTags || userDataEntry.attributes.secondaryTags.length === 0;
            });
        } else if (mode === 'all') {
            STEState.currentImageList = searchKeyword ?
                AppState.galleryImages.filter(img => img.fileName.toLowerCase().includes(searchKeyword) || img.name.toLowerCase().includes(searchKeyword)) :
                [...AppState.galleryImages];
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
        displayToast("当前模式下所有图片已处理完毕！", "success");
        return;
    } else {
        if (DOM.steThumbnailStripContainer) DOM.steThumbnailStripContainer.classList.remove('hidden');
    }
    
    // 调用新的核心切换函数
    switchToImageByIndex(nextIndex);
}

/**
 * 渲染主图、信息、标签，并触发滚动条吸附动画
 */
function renderImageAndTags(imageEntry) {
    if (!imageEntry) return;

    if (typeof window.resetImageViewer === 'function') {
        window.resetImageViewer();
    }

    // 渲染主图
    const mainPreview = document.getElementById('stePreviewImage');
    if (mainPreview) {
        mainPreview.src = buildFullWebPath(imageEntry.storageBox, imageEntry.urlPath);
        mainPreview.classList.remove('hidden');
        if (document.getElementById('stePreviewPlaceholder')) document.getElementById('stePreviewPlaceholder').textContent = '';
    }

    // 渲染信息
    if (DOM.steImageInfo) {
        DOM.steImageInfo.classList.remove('hidden');
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').textContent = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').title = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-character').textContent = `角色: ${imageEntry.name}`;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-storagebox').textContent = `仓库: ${imageEntry.storageBox}`;
    }

    // 渲染标签
    const userDataEntry = AppState.userData.find(ud => ud.path === imageEntry.urlPath && ud.storagebox?.toLowerCase() === imageEntry.storageBox.toLowerCase());
    STEState.currentTags.clear();
    if (userDataEntry && userDataEntry.attributes.secondaryTags) {
        userDataEntry.attributes.secondaryTags.forEach(tag => STEState.currentTags.add(tag));
    }
    renderCurrentTags();
    updatePredefinedTagsUI();

    // 滚动条吸附动画
    const vstrip = STEState.virtualStrip;
    if (vstrip.container && vstrip.isInitialized) {
        STEState.isScrolling = true;
        const targetScrollLeft = (STEState.currentIndex * vstrip.itemWidth) - (vstrip.container.offsetWidth / 2) + (vstrip.itemWidth / 2);

        vstrip.container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });

        // 在动画期间持续渲染，确保视觉平滑
        const animationStartTime = performance.now();
        const animationDuration = 350; // 动画时长
        const renderDuringAnimation = () => {
            renderVisibleThumbnails();
            if (performance.now() - animationStartTime < animationDuration) {
                requestAnimationFrame(renderDuringAnimation);
            } else {
                STEState.isScrolling = false; // 动画结束后解锁
            }
        };
        requestAnimationFrame(renderDuringAnimation);
    }

    // 启用按钮
    if (DOM.steSaveButton) DOM.steSaveButton.disabled = false;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = false;
}

/**
 * 渲染手动输入的标签列表
 */
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

/**
 * 更新所有可点击标签的选中高亮状态
 */
function updatePredefinedTagsUI() {
    document.querySelectorAll('.ste-predefined-tag').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
    document.querySelectorAll('#steCharTagsInteractive .char-tag-pill').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
}

/**
 * 保存当前图片的标签并加载下一张
 */
async function saveAndNext() {
    if (!STEState.currentImageEntry) return;
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
        //  从当前待办列表中移除刚刚处理完的图片
        STEState.currentImageList.splice(STEState.currentIndex, 1);
    
        //  更新虚拟滚动条的总宽度以反映列表长度的变化
        STEState.virtualStrip.totalItems = STEState.currentImageList.length;
        if (STEState.virtualStrip.strip) {
            STEState.virtualStrip.strip.style.width = `${STEState.virtualStrip.totalItems * STEState.virtualStrip.itemWidth}px`;
        }
    
        //  检查是否已处理完所有图片
        if (STEState.currentIndex >= STEState.currentImageList.length) {
            // 如果是，说明刚才处理的是最后一张，直接显示完成界面
            const placeholder = document.getElementById('stePreviewPlaceholder');
            if (placeholder) placeholder.textContent = '所有图片处理完毕！🎉';
            if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
            if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = '完成';
            const previewImage = document.getElementById('stePreviewImage');
            if (previewImage) previewImage.classList.add('hidden');
            const thumbContainer = document.getElementById('steThumbnailStripContainer');
            if (thumbContainer) thumbContainer.classList.add('hidden');
            displayToast("当前模式下所有图片已处理完毕！", "success");
        } else {
            //  如果列表未空，则直接切换到当前索引处的图片
            switchToImageByIndex(STEState.currentIndex);
        }
    }
}

/**
 * 显示搜索建议
 */
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
            DOM.steSearchInput.value = imgInfo.fileName;
            DOM.steSuggestions.classList.add('hidden');
            STEState.currentImageList = []; // 强制重建列表以定位到搜索结果
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

/**
 * 设置二级标签编辑器视图的所有事件监听器。
 */
function setupSecondaryTagEditorEventListeners() {
    const rightPanel = document.querySelector('.ste-right-panel');
    const leftPanelInfo = document.getElementById('steImageInfo');

    // 右侧预定义标签点击
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

    // 左侧人物标签点击
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

    // 手动标签输入
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
            DOM.steSearchInput.disabled = (STEState.currentMode !== 'all');
            if (STEState.currentMode !== 'all') {
                DOM.steSearchInput.value = '';
                DOM.steSuggestions.classList.add('hidden');
            }
            loadNextImage();
        });
    });

    // 搜索框逻辑
    if (DOM.steSearchInput) {
        DOM.steSearchInput.addEventListener('input', () => {
            clearTimeout(STEState.searchDebounceTimer);
            STEState.searchDebounceTimer = setTimeout(() => {
                const query = DOM.steSearchInput.value.toLowerCase().trim();
                if (query) {
                    const results = AppState.galleryImages.filter(img => img.fileName.toLowerCase().includes(query) || img.name.toLowerCase().includes(query));
                    displaySteSuggestions(results);
                } else {
                    DOM.steSuggestions.classList.add('hidden');
                }
            }, DELAYS.INPUT_DEBOUNCE);
        });
        DOM.steSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                DOM.steSuggestions.classList.add('hidden');
                STEState.currentImageList = [];
                loadNextImage();
            }
        });
        DOM.steSearchInput.addEventListener('blur', () => { setTimeout(() => DOM.steSuggestions.classList.add('hidden'), 200); });
    }

    // 底部按钮
    if (DOM.steSaveButton) DOM.steSaveButton.addEventListener('click', saveAndNext);
    if (DOM.steSkipButton) DOM.steSkipButton.addEventListener('click', loadNextImage);

    // 主图放大
    const mainPreview = document.getElementById('stePreviewImage');
    if (mainPreview) {
        mainPreview.addEventListener('click', () => {
            if (mainPreview.src && !mainPreview.classList.contains('hidden') && typeof window.openImageViewer === 'function') {
                window.openImageViewer(mainPreview.src);
            }
        });
    }

    // 横向缩略图条的交互逻辑
    const thumbContainer = document.getElementById('steThumbnailStripContainer');
    if (thumbContainer) {
        const inertiaState = STEState.inertia;
        let hasDragged = false;

        // 点击缩略图切换
        thumbContainer.addEventListener('click', e => {
            if (hasDragged) {
                e.preventDefault();
                hasDragged = false;
                return;
            }
            const thumb = e.target.closest('.ste-thumbnail');
            if (thumb) {
                const newIndex = parseInt(thumb.dataset.index, 10);
                if (!isNaN(newIndex) && newIndex !== STEState.currentIndex) {
                    switchToImageByIndex(newIndex);
                }
            }
        });

        // 拖拽开始
        const startDrag = (e) => {
            hasDragged = false;
            inertiaState.isDragging = true;
            thumbContainer.classList.add('active-drag');
            inertiaState.startX = e.pageX || e.touches[0].pageX;
            inertiaState.scrollLeft = thumbContainer.scrollLeft;
            inertiaState.lastX = inertiaState.startX;
            inertiaState.velocity = 0;
            cancelAnimationFrame(inertiaState.frameId);
        };

        // 拖拽中
        const onDrag = (e) => {
            if (!inertiaState.isDragging) return;
            e.preventDefault();
            hasDragged = true;
            const currentX = e.pageX || e.touches[0].pageX;
            const walk = currentX - inertiaState.startX;
            thumbContainer.scrollLeft = inertiaState.scrollLeft - walk;
            inertiaState.velocity = currentX - inertiaState.lastX;
            inertiaState.lastX = currentX;
        };

        // 拖拽结束，启动惯性
        const stopDrag = () => {
            if (!inertiaState.isDragging) return;
            inertiaState.isDragging = false;
            thumbContainer.classList.remove('active-drag');
            if (!hasDragged) return;

            const inertiaFrame = () => {
                if (Math.abs(inertiaState.velocity) < 0.5) {
                    cancelAnimationFrame(inertiaState.frameId);
                    handleScrollEnd(); // 惯性结束后触发对齐
                    return;
                }
                thumbContainer.scrollLeft -= inertiaState.velocity;
                inertiaState.velocity *= 0.92;
                inertiaState.frameId = requestAnimationFrame(inertiaFrame);
            };
            inertiaState.frameId = requestAnimationFrame(inertiaFrame);
        };
        
        // 绑定鼠标与触摸事件
        thumbContainer.addEventListener('mousedown', startDrag);
        thumbContainer.addEventListener('mousemove', onDrag);
        thumbContainer.addEventListener('mouseup', stopDrag);
        thumbContainer.addEventListener('mouseleave', stopDrag);
        thumbContainer.addEventListener('touchstart', startDrag, { passive: true });
        thumbContainer.addEventListener('touchmove', onDrag, { passive: false });
        thumbContainer.addEventListener('touchend', stopDrag);

        // 滚动事件监听
        thumbContainer.addEventListener('scroll', () => {
            renderVisibleThumbnails(); // 滚动时，只更新视觉元素
            // 如果不是程序化滚动或拖拽，则启动滚动结束检测
            if (!STEState.isScrolling && !inertiaState.isDragging) {
                clearTimeout(STEState.virtualStrip.scrollEndTimer);
                STEState.virtualStrip.scrollEndTimer = setTimeout(handleScrollEnd, 150);
            }
        });
    }

    // 标签管理按钮
    const manageTagsBtn = document.getElementById('steManageTagsBtn');
    if (manageTagsBtn) {
        manageTagsBtn.addEventListener('click', openTagManagementModal);
    }
}


// ==========================================================================
// == 标签管理模态框相关函数 (无重大逻辑变更)
// ==========================================================================

function openTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    const select = document.getElementById('steModalCategorySelect');
    const deleteCategorySelect = document.getElementById('steModalDeleteCategorySelect');
    
    if (!modal || !select || !deleteCategorySelect) return;

    document.getElementById('secondaryTagEditorPaneView').classList.add('modal-active');

    modalTagState = {
        characterTags: [...STEState.characterTags],
        tagCategories: JSON.parse(JSON.stringify(STEState.tagCategories))
    };

    ['steModalNewTagInput', 'steModalNewCategoryInput', 'steModalFirstTagInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    displayModalMessage("", "info");

    select.innerHTML = '';
    deleteCategorySelect.innerHTML = '';
    const allCategories = ["🧜‍♂ 人物类型", ...Object.keys(modalTagState.tagCategories)];
    allCategories.forEach(category => {
        select.add(new Option(category, category));
        deleteCategorySelect.add(new Option(category, category));
    });
    
    populateTagsForDeletion();
    modal.classList.remove('hidden');
}

function closeTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    if (modal) modal.classList.add('hidden');
    
    document.getElementById('secondaryTagEditorPaneView').classList.remove('modal-active');
    
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    modalTagState = null;
}

function populateTagsForDeletion() {
    const select = document.getElementById('steModalDeleteCategorySelect');
    const container = document.getElementById('tagsToDeleteContainer');
    const category = select.value;

    if (sortableInstance) sortableInstance.destroy();
    
    container.innerHTML = '';
    const tags = category === "🧜‍♂ 人物类型" ? modalTagState.characterTags : (modalTagState.tagCategories[category] || []);

    if (!tags || tags.length === 0) {
        container.innerHTML = '<p>该分类下没有标签可供删除。</p>';
        return;
    }

    tags.forEach(tag => {
        const tagPill = document.createElement('div');
        tagPill.className = 'ste-deletable-tag-item';
        tagPill.innerHTML = `<span>${tag}</span><span class="ste-tag-remove" data-tag="${tag}" data-category="${category}">×</span>`;
        container.appendChild(tagPill);
    });

    container.onclick = (event) => {
        if (event.target.classList.contains('ste-tag-remove')) {
            handleDeleteTag(event.target.dataset.tag, event.target.dataset.category);
        }
    };

    sortableInstance = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            const updatedTags = Array.from(container.children).map(item => 
                item.querySelector('.ste-tag-remove').dataset.tag
            );
            if (category === "🧜‍♂ 人物类型") {
                modalTagState.characterTags = updatedTags;
            } else {
                modalTagState.tagCategories[category] = updatedTags;
            }
            displayModalMessage("排序已在本地更新，点击“保存更改”生效。", "info");
        }
    });
}

function handleDeleteTag(tagToDelete, categoryFrom) {
    if (categoryFrom === "🧜‍♂ 人物类型") {
        modalTagState.characterTags = modalTagState.characterTags.filter(t => t !== tagToDelete);
    } else {
        modalTagState.tagCategories[categoryFrom] = modalTagState.tagCategories[categoryFrom].filter(t => t !== tagToDelete);
        if (modalTagState.tagCategories[categoryFrom].length === 0) {
            delete modalTagState.tagCategories[categoryFrom];
            const select = document.getElementById('steModalDeleteCategorySelect');
            for(let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === categoryFrom) {
                    select.remove(i);
                    break;
                }
            }
        }
    }
    displayModalMessage(`标签 [${tagToDelete}] 已在本地移除，点击“保存更改”生效。`, "info");
    populateTagsForDeletion();
}

function handleAddNewTag() {
    const category = document.getElementById('steModalCategorySelect').value;
    const newTags = document.getElementById('steModalNewTagInput').value.trim().split(/[,，\s]+/).filter(Boolean);

    if (!category || newTags.length === 0) {
        displayModalMessage("请选择分类并输入至少一个新标签！", "warning");
        return;
    }
    
    let targetArray;
    if (category === "🧜‍♂ 人物类型") {
        targetArray = modalTagState.characterTags;
    } else {
        modalTagState.tagCategories[category] = modalTagState.tagCategories[category] || [];
        targetArray = modalTagState.tagCategories[category];
    }

    let addedCount = 0;
    newTags.forEach(tag => {
        if (!targetArray.includes(tag)) {
            targetArray.push(tag);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        displayModalMessage(`已在本地添加 ${addedCount} 个新标签，点击“保存更改”生效。`, "info");
        document.getElementById('steModalNewTagInput').value = '';
    } else {
        displayModalMessage("输入的标签都已存在于该分类中。", "info");
    }
}

function handleAddNewCategory() {
    const newCategory = document.getElementById('steModalNewCategoryInput').value.trim();
    const firstTag = document.getElementById('steModalFirstTagInput').value.trim();

    if (!newCategory || !firstTag) {
        displayModalMessage("新分类名和第一个标签都不能为空！", "warning");
        return;
    }

    if (modalTagState.tagCategories[newCategory] || newCategory === "🧜‍♂ 人物类型") {
        displayModalMessage("这个分类名称已经存在了！", "warning");
        return;
    }

    modalTagState.tagCategories[newCategory] = [firstTag];
    displayModalMessage(`已在本地新增分类 [${newCategory}]，点击“保存更改”生效。`, "info");
    
    const select = document.getElementById('steModalCategorySelect');
    const deleteSelect = document.getElementById('steModalDeleteCategorySelect');
    select.add(new Option(newCategory, newCategory));
    deleteSelect.add(new Option(newCategory, newCategory));

    document.getElementById('steModalNewCategoryInput').value = '';
    document.getElementById('steModalFirstTagInput').value = '';
}

async function handleSaveChanges() {
    if (!modalTagState) return;
    const fullData = {
        "🧜‍♂ 人物类型": modalTagState.characterTags,
        ...modalTagState.tagCategories
    };
    await saveTagsToServer(fullData);
}

async function saveTagsToServer(fullData) {
    if (STEState.isSavingTags) return;
    STEState.isSavingTags = true;
    displayModalMessage("正在保存...", "info");

    try {
        const response = await fetch('/api/update-secondary-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullData)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "保存失败");

        displayModalMessage("保存成功！界面将刷新...", "success");
        setTimeout(() => {
            closeTagManagementModal();
            STEState.isInitialized = false; // 强制重新初始化
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