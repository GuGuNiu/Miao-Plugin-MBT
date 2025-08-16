// ==========================================================================
// 数据列表: 管理云端Json数据页面的功能 包括过滤 虚拟滚动 列表渲染
//       和属性编辑模态框
// ==========================================================================

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${size} ${sizes[i]}`;
}

/**
 * 切换自定义游戏筛选下拉框的显示/隐藏状态
 * @param {MouseEvent} event
 */
function toggleGameFilterDropdown(event) {
    event.stopPropagation();
    const container = DOM.filterGameBtn.closest('.custom-select-wrapper');
    DOM.filterGameDropdown?.classList.toggle('hidden');
    container?.classList.toggle('is-open');
}

/**
 * 动态填充并处理自定义游戏筛选下拉框
 */
function setupCustomGameFilter() {
    const gameOptions = [
        { value: '', text: '——所有游戏——' },
        { value: 'gs-character', text: '原神' },
        { value: 'sr-character', text: '星铁' },
        { value: 'zzz-character', text: '绝区零' },
        { value: 'waves-character', text: '鸣潮' },
        { value: 'unknown', text: '未知' }
    ];

    if (!DOM.filterGameBtn || !DOM.filterGameDropdown) return;
    DOM.filterGameDropdown.innerHTML = '';

    gameOptions.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        item.dataset.value = opt.value;
        item.textContent = opt.text;
        item.addEventListener('click', () => {
            DOM.filterGameBtn.textContent = opt.text;
            DOM.filterGameBtn.dataset.value = opt.value;
            DOM.filterGameDropdown.classList.add('hidden');
            applyFiltersAndRenderDataList();
        });
        DOM.filterGameDropdown.appendChild(item);
    });

    DOM.filterGameBtn.addEventListener('click', toggleGameFilterDropdown);
}

/**
 * 更新单个过滤切换按钮的显示文本 e.g., "Px18 开" / "Px18 关"
 * @param {string} checkboxId 复选框元素的 ID
 */
function updateFilterToggleButtonText(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    // 查找与复选框关联的按钮元素
    const button = checkbox?.closest('.filter-toggle-label')?.querySelector('.filter-toggle-button');

    if (checkbox && button) {
        const textOn = button.dataset.on || '开'; // 获取 data-on 属性值 默认为 '开'
        const textOff = button.dataset.off || '关'; // 获取 data-off 属性值 默认为 '关'
        button.textContent = checkbox.checked ? textOn : textOff; // 根据选中状态设置文本
        button.classList.toggle(UI_CLASSES.ACTIVE, checkbox.checked); // 根据选中状态添加/移除激活类
    } else {
        // console.warn(`DataList: 未找到复选框 #${checkboxId} 或其对应的切换按钮`);
    }
}

/**
 * 获取并存储用于筛选的二级标签
 */
async function fetchSecondaryTagsForFilter() {
    const filterState = AppState.dataList.secondaryTagsFilter;
    if (Object.keys(filterState.availableTags).length > 0) {
        console.log("DataList: 二级标签已加载 跳过获取");
        return;
    }
    try {
        const response = await fetch('/api/secondary-tags');
        if (!response.ok) throw new Error(`无法获取标签配置 (HTTP ${response.status})`);
        const allTagsData = await response.json();
        filterState.availableTags = allTagsData;
        console.log("DataList: 成功获取并存储二级标签用于筛选");
        populateSecondaryTagsDropdown();
    } catch (error) {
        console.error("DataList: 加载二级标签用于筛选时失败:", error);
        displayToast("加载筛选标签失败！", "error");
    }
}

/**
 * 根据已获取的标签数据 动态填充二级标签筛选下拉框
 */
function populateSecondaryTagsDropdown() {
    const dropdown = DOM.secondaryTagsDropdown;
    if (!dropdown) return;
    const filterState = AppState.dataList.secondaryTagsFilter;
    const contentArea = dropdown.querySelector('.tags-dropdown-content');
    if (!contentArea) {
        console.error("DataList: 找不到 .tags-dropdown-content 元素");
        return;
    }

    contentArea.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const [category, tags] of Object.entries(filterState.availableTags)) {
        if (!Array.isArray(tags) || tags.length === 0) continue;

        const categoryEl = document.createElement('div');
        categoryEl.className = 'tags-dropdown-category';

        const titleEl = document.createElement('h6');
        titleEl.className = 'tags-dropdown-category-title';
        titleEl.textContent = category;
        categoryEl.appendChild(titleEl);

        const wrapperEl = document.createElement('div');
        wrapperEl.className = 'tags-dropdown-tags-wrapper';

        tags.forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tags-dropdown-tag-item';
            tagEl.textContent = tag;
            tagEl.dataset.tag = tag;
            wrapperEl.appendChild(tagEl);
        });

        categoryEl.appendChild(wrapperEl);
        fragment.appendChild(categoryEl);
    }
    contentArea.appendChild(fragment);
}

/**
 * 切换二级标签筛选下拉框的显示/隐藏状态
 */
function toggleSecondaryTagsDropdown(event) {
    if (event) {
        event.stopPropagation();
    }
    const container = DOM.secondaryTagsFilterBtn.closest('.select-wrapper');
    if (DOM.secondaryTagsDropdown) {
        const isOpen = DOM.secondaryTagsDropdown.classList.toggle('hidden');
        container?.classList.toggle('is-open', !isOpen);
    }
}

/**
 * 关闭二级标签筛选下拉框
 */
function closeSecondaryTagsDropdown() {
    if (DOM.secondaryTagsDropdown && !DOM.secondaryTagsDropdown.classList.contains(UI_CLASSES.HIDDEN)) {
        DOM.secondaryTagsDropdown.classList.add(UI_CLASSES.HIDDEN);
    }
}

/**
 * 更新二级标签筛选按钮的 UI (文本和状态)
 */
function updateSecondaryTagsFilterUI() {
    const button = DOM.secondaryTagsFilterBtn;
    const selectedCount = AppState.dataList.secondaryTagsFilter.selectedTags.size;
    if (!button) return;

    if (selectedCount > 0) {
        button.textContent = `二级标签 (${selectedCount})`;
        button.classList.add('active-filter');
    } else {
        button.textContent = '二级标签筛选';
        button.classList.remove('active-filter');
    }
}

/**
 * 为 dataListSearchInput 显示搜索建议
 * @param {string[]} suggestions - 要显示的建议字符串数组
 */
function showDataListSuggestions(suggestions) {
    const wrapper = DOM.dataListSearchInput?.closest('.search-input-wrapper');
    if (!wrapper) return;

    let suggestionsContainer = wrapper.querySelector('#dataListSuggestions');
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'dataListSuggestions';
        suggestionsContainer.className = 'suggestions hidden';
        wrapper.appendChild(suggestionsContainer);
    }

    suggestionsContainer.innerHTML = '';

    if (suggestions.length === 0) {
        suggestionsContainer.classList.add(UI_CLASSES.HIDDEN);
        return;
    }

    const inputWidth = DOM.dataListSearchInput.offsetWidth;
    suggestionsContainer.style.width = `${inputWidth}px`;

    suggestions.forEach(itemText => {
        const item = document.createElement('div');
        item.textContent = itemText;
        item.addEventListener('mousedown', () => { // mousedown 在 blur 之前触发
            DOM.dataListSearchInput.value = itemText;
            hideDataListSuggestions();
            applyFiltersAndRenderDataList();
        });
        suggestionsContainer.appendChild(item);
    });

    suggestionsContainer.classList.remove(UI_CLASSES.HIDDEN);
}

/**
 * 隐藏 dataListSearchInput 的搜索建议
 */
function hideDataListSuggestions() {
    const wrapper = DOM.dataListSearchInput?.closest('.search-input-wrapper');
    const suggestionsContainer = wrapper?.querySelector('#dataListSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add(UI_CLASSES.HIDDEN);
    }
}


//  数据过滤与渲染 

/**
 * 根据当前过滤器和搜索词过滤 AppState.userData 数据
 * @returns {Array<object>} 过滤并排序后的数据条目数组
 */
function filterUserDataEntries() {
    const showPx18 = DOM.dataListFilterPx18?.checked ?? false;
    const showRx18 = DOM.dataListFilterRx18?.checked ?? false;
    const showAiImage = DOM.dataListFilterAiImage?.checked ?? false;
    const showBan = DOM.dataListFilterIsBan?.checked ?? false;
    const showNormal = DOM.dataListFilterNormal?.checked ?? false;
    const showFullscreen = DOM.dataListFilterFullscreen?.checked ?? false;
    const showEasterEgg = DOM.dataListFilterEasterEgg?.checked ?? false;
    const selectedGame = DOM.filterGameBtn?.dataset.value || '';
    const selectedTags = AppState.dataList.secondaryTagsFilter?.selectedTags ?? new Set();
    const currentSortOrder = AppState.dataList.currentSortOrder || 'default';

    const dataToFilter = AppState.dataList.workerSearchResults || AppState.userData;

    const filteredEntries = dataToFilter.filter(entry => {
        if (!entry?.attributes) return false;

        if (showBan && entry.attributes.isBan !== true) return false;
        if (showAiImage && entry.attributes.isAiImage !== true) return false;
        if (showEasterEgg && entry.attributes.isEasterEgg !== true) return false;
        if (showPx18 && entry.attributes.isPx18 !== true) return false;
        if (showRx18 && entry.attributes.isRx18 !== true) return false;
        if (showNormal && entry.attributes.layout !== 'normal') return false;
        if (showFullscreen && entry.attributes.layout !== 'fullscreen') return false;

        if (selectedGame) {
            if (selectedGame === 'unknown') {
                const knownGames = ['gs-character', 'sr-character', 'zzz-character', 'waves-character'];
                if (knownGames.includes(entry.sourceGallery)) return false;
            } else {
                if (entry.sourceGallery !== selectedGame) return false;
            }
        }

        if (selectedTags.size > 0) {
            const entryTags = entry.attributes.secondaryTags;
            if (!Array.isArray(entryTags) || entryTags.length === 0) {
                return false;
            }
            for (const selectedTag of selectedTags) {
                if (!entryTags.includes(selectedTag)) {
                    return false;
                }
            }
        }

        return true;
    });

    filteredEntries.sort((a, b) => {
        switch (currentSortOrder) {
            case 'size_desc':
            case 'size_asc':
                const pathA = buildFullWebPath(a.storagebox, a.path);
                const pathB = buildFullWebPath(b.storagebox, b.path);
                const sizeA = AppState.fileSizesMap.get(pathA) || 0;
                const sizeB = AppState.fileSizesMap.get(pathB) || 0;
                return currentSortOrder === 'size_desc' ? sizeB - sizeA : sizeA - sizeB;

            case 'date_desc':
                return new Date(b.timestamp) - new Date(a.timestamp);

            case 'date_asc':
                return new Date(a.timestamp) - new Date(b.timestamp);

            case 'default':
            default:
                return (a.attributes?.filename || '').localeCompare(b.attributes?.filename || '', undefined, { numeric: true, sensitivity: 'base' });
        }
    });

    return filteredEntries;
}

/**
 * 应用当前的过滤器 并使用过滤后的数据重新渲染数据列表
 */
function applyFiltersAndRenderDataList() {
    const searchTerm = DOM.dataListSearchInput?.value.trim() || '';
    if (!searchTerm) {
      AppState.dataList.workerSearchResults = null;
    }
    
    const filteredData = filterUserDataEntries();
    if(DOM.dataListCountDisplay) DOM.dataListCountDisplay.textContent = `当前显示: ${filteredData.length} 条`;
    setupVirtualScroll(DOM.dataListContainer, filteredData);
}

//  虚拟滚动实现
/**
 * 设置虚拟滚动列表
 * @param {HTMLElement} containerElement 列表容器元素
 * @param {Array<object>} data 要显示的数据数组
 */
function setupVirtualScroll(containerElement, data) {
    if (!containerElement) {
        console.error("虚拟滚动: 容器元素无效！");
        return;
    }

    const vsInfo = AppState.dataList.virtualScrollInfo;
    vsInfo.container = containerElement;
    vsInfo.filteredData = data || [];
    vsInfo.scrollTop = 0; // 重置滚动位置

    containerElement.removeEventListener('scroll', handleScroll); // 移除旧监听器

    // 查找或创建内部结构
    if (!vsInfo.innerSpacer || !vsInfo.visibleItemsContainer) {
        vsInfo.innerSpacer = containerElement.querySelector('#virtualScrollInner');
        vsInfo.visibleItemsContainer = vsInfo.innerSpacer?.querySelector('#visibleItemsContainer');
        if (!vsInfo.innerSpacer || !vsInfo.visibleItemsContainer) {
            console.error("虚拟滚动: 内部结构元素 #virtualScrollInner 或 #visibleItemsContainer 缺失！");
            containerElement.innerHTML = '<p class="no-results" style="display:block;">虚拟列表结构错误</p>';
            return;
        }
    }

    // 重置样式
    vsInfo.innerSpacer.style.height = '0px';
    vsInfo.visibleItemsContainer.innerHTML = '';
    vsInfo.visibleItemsContainer.style.transform = ''; // 移除 transform

    // 处理 "无结果" 提示
    let noResultsElement = containerElement.querySelector('.no-results');
    if (!noResultsElement) {
        noResultsElement = document.createElement('p');
        noResultsElement.className = 'no-results';
        noResultsElement.textContent = '没有找到匹配的数据。';
        noResultsElement.style.display = 'none';
        containerElement.insertBefore(noResultsElement, vsInfo.innerSpacer);
    }

    if (vsInfo.filteredData.length === 0) {
        noResultsElement.style.display = 'block'; // 显示无结果提示
        console.log("虚拟滚动: 没有数据可显示");
        // 隐藏 spacer 和 visible container
        if (vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'none';
        if (vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'none';
        return;
    }

    // 有数据 则隐藏无结果提示 并显示列表结构
    noResultsElement.style.display = 'none';
    if (vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'block';
    if (vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'block';


    if (vsInfo.itemHeight <= 0) {
        console.error("虚拟滚动: itemHeight 无效！");
        return;
    }
    // 计算并设置总高度
    const totalRows = Math.ceil(vsInfo.filteredData.length / vsInfo.itemsPerRow);
    const totalHeight = totalRows * vsInfo.itemHeight;
    vsInfo.innerSpacer.style.height = `${totalHeight}px`;
    console.log(`虚拟滚动: 设置总高度 ${totalHeight}px for ${totalRows} 行`);

    // 异步添加滚动监听并渲染初始项
    requestAnimationFrame(() => {
        containerElement.addEventListener('scroll', handleScroll);
        containerElement.scrollTop = 0; // 确保滚动到顶部
        vsInfo.scrollTop = 0;
        renderVisibleItems();
        console.log("虚拟滚动: 设置完成并渲染初始项");
    });
}

/**
 * 渲染当前可见区域的列表项
 */
function renderVisibleItems() {
    const vsInfo = AppState.dataList.virtualScrollInfo;
    if (!vsInfo.container || !vsInfo.visibleItemsContainer || vsInfo.itemHeight <= 0) {
        return;
    }

    const containerHeight = vsInfo.container.clientHeight;
    const scrollTop = vsInfo.scrollTop;
    const totalItems = vsInfo.filteredData.length;
    const itemHeight = vsInfo.itemHeight;
    const itemsPerRow = vsInfo.itemsPerRow;
    const bufferRows = vsInfo.bufferItems;

    if (containerHeight <= 0 || totalItems === 0) {
        vsInfo.visibleItemsContainer.innerHTML = '';
        return;
    }

    const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferRows);
    const endRow = Math.min(
        Math.ceil(totalItems / itemsPerRow) - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) - 1 + bufferRows
    );

    const startIndex = startRow * itemsPerRow;
    const endIndex = Math.min(totalItems - 1, (endRow + 1) * itemsPerRow - 1);

    vsInfo.visibleItemsContainer.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i <= endIndex; i++) {
        const entryData = vsInfo.filteredData[i];
        if (!entryData?.path || !entryData.attributes) {
            continue;
        }

        const card = document.createElement('div');
        card.className = 'data-item-card';
        card.dataset.path = entryData.path;

        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;

        card.style.position = 'absolute';
        card.style.top = `${row * itemHeight}px`;
        card.style.left = `calc(${(100 / itemsPerRow) * col}% + ${col > 0 ? (15 / itemsPerRow) : 0}px)`;
        card.style.width = `calc(${(100 / itemsPerRow)}% - ${15 * (itemsPerRow - 1) / itemsPerRow}px)`;
        card.style.height = `${itemHeight - 15}px`;


        const thumbnailCont = document.createElement('div');
        thumbnailCont.className = 'data-item-thumbnail-container';
        const thumbnailImg = document.createElement('img');
        thumbnailImg.className = 'data-item-thumbnail';
        thumbnailImg.loading = 'lazy';
        thumbnailImg.alt = entryData.attributes.filename || '图片';
        thumbnailCont.appendChild(thumbnailImg);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'data-item-content';

        card.appendChild(thumbnailCont);
        card.appendChild(contentDiv);

        populateCardContent(card, entryData);

        fragment.appendChild(card);
    }
    vsInfo.visibleItemsContainer.appendChild(fragment);
}

/**
 * 填充数据卡片的内容
 * @param {HTMLElement} cardElement 卡片根元素
 * @param {object} entryData 该卡片对应的数据条目
 */
function populateCardContent(cardElement, entryData) {
    if (!cardElement || !entryData?.attributes) return;

    const contentContainer = cardElement.querySelector('.data-item-content');
    const thumbnail = cardElement.querySelector('.data-item-thumbnail');
    const thumbnailContainer = cardElement.querySelector('.data-item-thumbnail-container');

    if (!contentContainer || !thumbnail || !thumbnailContainer) return;

    contentContainer.innerHTML = '';

    const storagebox = entryData.storagebox;
    const relativePath = entryData.path || '';
    let fullResImagePath = '/placeholder.png';
    let thumbnailPath = '/placeholder.png';

    if (storagebox && relativePath) {
        const originalCaseStorageBox = AppState.availableStorageBoxes.find(
            (box) => box.toLowerCase() === storagebox.toLowerCase()
        );
        if (originalCaseStorageBox) {
            fullResImagePath = buildFullWebPath(originalCaseStorageBox, relativePath);
        } else {
            fullResImagePath = buildFullWebPath(storagebox, relativePath);
            console.warn("DataList: populateCardContent - 未找到原始大小写仓库名，使用JSON中的:", storagebox);
        }
        fullResImagePath = fullResImagePath.replace(/\\/g, '/');
        thumbnailPath = `/api/thumbnail${fullResImagePath}`;
    } else {
        console.warn("DataList: 缺少 storagebox 或 path 无法生成缩略图路径:", entryData);
    }

    cardElement.dataset.fullSrc = fullResImagePath;

    thumbnail.alt = entryData.attributes.filename || '图片';
    thumbnail.src = thumbnailPath;

    thumbnail.onload = function () {
        this.classList.remove('load-error');
    };
    thumbnail.onerror = function () {
        thumbnailContainer.style.backgroundColor = '#fdd';
        console.error("缩略图加载失败:", this.src);
        this.alt = '缩略图加载失败';
        this.classList.add('load-error');
    };

    const attrs = entryData.attributes;
    const filename = attrs.filename || '未知文件名';
    const gid = entryData.gid || '无 GID';
    const timestamp = formatTimestamp(entryData.timestamp);

    // --- 文件名、GID、文件大小行 ---
    const filenameDiv = document.createElement('div');
    filenameDiv.className = 'filename';
    filenameDiv.title = filename;

    const filenameSpan = document.createElement('span'); // 用span包裹文件名和GID
    filenameSpan.innerHTML = `${filename} <span class="gid-display">(GID: ${gid})</span>`;
    filenameDiv.appendChild(filenameSpan);

    const fileSize = AppState.fileSizesMap.get(fullResImagePath);
    if (fileSize !== undefined) {
        const fileSizeSpan = document.createElement('div');
        fileSizeSpan.className = 'data-item-filesize';
        fileSizeSpan.textContent = formatBytes(fileSize);
        filenameDiv.appendChild(fileSizeSpan);
    }
    contentContainer.appendChild(filenameDiv);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'details';
    const timestampSpan = document.createElement('span');
    timestampSpan.className = 'timestamp';
    timestampSpan.title = '保存时间';
    timestampSpan.textContent = timestamp;
    const sourceGallerySpan = document.createElement('span');
    sourceGallerySpan.className = 'source-gallery';
    sourceGallerySpan.title = '游戏来源';
    sourceGallerySpan.textContent = getGameName(entryData.sourceGallery);
    detailsDiv.appendChild(timestampSpan);
    detailsDiv.appendChild(sourceGallerySpan);
    contentContainer.appendChild(detailsDiv);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'data-item-bottom-row';

    const allTagsWrapper = document.createElement('div');
    allTagsWrapper.className = 'all-tags-wrapper';

    const attributeTagsDiv = document.createElement('div');
    attributeTagsDiv.className = 'attribute-tags';
    let tagsHtml = '';
    if (attrs.isPx18) tagsHtml += '<span class="attr-tag tag-px18">Px18</span>';
    if (attrs.isRx18) tagsHtml += '<span class="attr-tag tag-rx18">Rx18</span>';
    switch (attrs.layout) {
        case 'normal': tagsHtml += '<span class="attr-tag tag-normal">人像</span>'; break;
        case 'fullscreen': tagsHtml += '<span class="attr-tag tag-fullscreen">全屏</span>'; break;
        case 'catcake': tagsHtml += '<span class="attr-tag tag-catcake">猫糕</span>'; break;
    }
    if (attrs.isEasterEgg) tagsHtml += '<span class="attr-tag tag-easteregg">彩蛋</span>';
    if (attrs.isAiImage) tagsHtml += '<span class="attr-tag tag-ai">AI</span>';
    if (attrs.isBan) tagsHtml += '<span class="attr-tag tag-ban">⛔封禁</span>';
    attributeTagsDiv.innerHTML = tagsHtml || '<span class="no-tags">无特殊标签</span>';
    allTagsWrapper.appendChild(attributeTagsDiv); // 添加到总包裹容器

    if (Array.isArray(attrs.secondaryTags) && attrs.secondaryTags.length > 0) {
        const secondaryTagsContainer = document.createElement('div');
        secondaryTagsContainer.className = 'secondary-tags-container';
        attrs.secondaryTags.forEach(tag => {
            const tagPill = document.createElement('span');
            tagPill.className = 'secondary-tag-pill';
            tagPill.textContent = tag;
            secondaryTagsContainer.appendChild(tagPill);
        });
        allTagsWrapper.appendChild(secondaryTagsContainer); // 也添加到总包裹容器
    }

    bottomRow.appendChild(allTagsWrapper);

    const editButtonHtml = `<button class="data-item-edit-btn" data-path="${entryData.path}" data-storagebox="${entryData.storagebox}" title="修改属性"></button>`;
    const tempButtonContainer = document.createElement('div');
    tempButtonContainer.innerHTML = editButtonHtml;
    if (tempButtonContainer.firstChild) {
        bottomRow.appendChild(tempButtonContainer.firstChild);
    }

    contentContainer.appendChild(bottomRow);
}

/**
 * 处理列表容器的滚动事件
 */
function handleScroll() {
    const vsInfo = AppState.dataList.virtualScrollInfo;
    if (!vsInfo.container) return;

    vsInfo.scrollTop = vsInfo.container.scrollTop; // 更新滚动位置状态

    // 使用 requestAnimationFrame 优化滚动事件处理
    if (AppState.dataList.isScrolling === null) {
        AppState.dataList.isScrolling = requestAnimationFrame(() => {
            renderVisibleItems(); // 重新渲染可见项
            AppState.dataList.isScrolling = null; // 重置标志位
        });
    }
}

//  属性编辑模态框 Edit Attribute Modal 
/**
 * 打开属性编辑模态框
 * @param {string} path 被编辑条目的路径
 */
function openEditModal(path, storagebox) {
    const modalElements = [
        DOM.editAttributeModal, DOM.modalFilenameSpan, DOM.modalEntryPathInput,
        DOM.modalIsEasterEggCheckbox, DOM.modalIsAiImageCheckbox, DOM.modalisBanCheckbox,
        ...(DOM.modalRatingRadios || []), ...(DOM.modalLayoutRadios || [])
    ];
    if (modalElements.some(el => !el)) {
        console.error("DataList: 编辑模态框元素缺失！");
        displayToast("无法打开编辑窗口", UI_CLASSES.ERROR);
        return;
    }

    const entry = AppState.userData.find(e => e.path === path && e.storagebox === storagebox);
    if (!entry?.attributes) {
        console.error(`DataList: 找不到路径 "${path}" (仓库: ${storagebox}) 的条目数据`);
        displayToast(`错误：找不到要编辑的数据`, UI_CLASSES.ERROR);
        return;
    }

    AppState.dataList.currentEditPath = path;
    AppState.dataList.currentEditStoragebox = storagebox;

    DOM.modalFilenameSpan.textContent = entry.attributes.filename;
    DOM.modalEntryPathInput.value = path;

    let ratingValue = 'none';
    if (entry.attributes.isPx18) ratingValue = 'px18';
    else if (entry.attributes.isRx18) ratingValue = 'rx18';
    const ratingRadio = document.querySelector(`input[name="modalRating"][value="${ratingValue}"]`);
    if (ratingRadio) ratingRadio.checked = true;

    const layoutValue = entry.attributes.layout || 'normal';
    const layoutRadio = document.querySelector(`input[name="modalLayout"][value="${layoutValue}"]`);
    if (layoutRadio) layoutRadio.checked = true;

    DOM.modalIsEasterEggCheckbox.checked = !!entry.attributes.isEasterEgg;
    DOM.modalIsAiImageCheckbox.checked = !!entry.attributes.isAiImage;
    DOM.modalisBanCheckbox.checked = !!entry.attributes.isBan;

    hideModalMessage();
    if (DOM.modalSaveButton) DOM.modalSaveButton.disabled = false;

    DOM.editAttributeModal.classList.remove(UI_CLASSES.HIDDEN);
}

/**
 * 关闭属性编辑模态框
 */
function closeEditModal() {
    if (DOM.editAttributeModal) {
        DOM.editAttributeModal.classList.add(UI_CLASSES.HIDDEN);
    }
    AppState.dataList.currentEditPath = null; // 清除当前编辑状态
    console.log("DataList: 编辑模态框已关闭");
}

/**
 * 保存属性编辑模态框中的更改
 */
async function saveAttributeChanges() {
    if (!AppState.dataList.currentEditPath || !AppState.dataList.currentEditStoragebox || !DOM.modalEntryPathInput || !DOM.modalSaveButton) {
        console.error("DataList: 保存属性更改失败 状态或元素缺失");
        displayToast("保存失败：内部状态错误", UI_CLASSES.ERROR);
        return;
    }

    const entryIndex = AppState.userData.findIndex(e =>
        e.path === AppState.dataList.currentEditPath &&
        e.storagebox === AppState.dataList.currentEditStoragebox
    );
    if (entryIndex === -1) {
        console.error("DataList: 保存错误 在 userData 中找不到路径", AppState.dataList.currentEditPath, "仓库", AppState.dataList.currentEditStoragebox);
        displayToast("保存失败：数据不一致 请刷新", UI_CLASSES.ERROR);
        return;
    }

    DOM.modalSaveButton.disabled = true;

    const updatedEntryFromModal = JSON.parse(JSON.stringify(AppState.userData[entryIndex]));
    const rating = document.querySelector('input[name="modalRating"]:checked')?.value || 'none';
    const layout = document.querySelector('input[name="modalLayout"]:checked')?.value || 'normal';
    updatedEntryFromModal.attributes.isPx18 = rating === 'px18';
    updatedEntryFromModal.attributes.isRx18 = rating === 'rx18';
    updatedEntryFromModal.attributes.layout = layout;
    updatedEntryFromModal.attributes.isEasterEgg = DOM.modalIsEasterEggCheckbox.checked;
    updatedEntryFromModal.attributes.isAiImage = DOM.modalIsAiImageCheckbox.checked;
    updatedEntryFromModal.attributes.isBan = DOM.modalisBanCheckbox.checked;
    updatedEntryFromModal.timestamp = new Date().toISOString();

    const newDataListForBackend = AppState.userData.map((entry, index) =>
        index === entryIndex ? updatedEntryFromModal : entry
    );

    let success = false;
    try {
        if (typeof updateUserData === "function") {
            success = await updateUserData(
                newDataListForBackend,
                `成功修改 "${updatedEntryFromModal.attributes.filename}" 的属性`,
                'toast',
                false,
                DELAYS.MESSAGE_CLEAR_DEFAULT,
                true
            );
        } else {
            throw new Error("核心函数 updateUserData 未定义");
        }
    } catch (error) {
        console.error("DataList: 保存属性调用 updateUserData 失败:", error);
        success = false;
    } finally {
        DOM.modalSaveButton.disabled = false;
    }

    if (success) {
        const vsInfo = AppState.dataList.virtualScrollInfo;
        if (vsInfo.filteredData && vsInfo.filteredData.length > 0) {
            let originalStorageBoxForSearch = "";
            const originalEntry = AppState.userData.find(e => e.path === AppState.dataList.currentEditPath && e.storagebox === updatedEntryFromModal.storagebox);
            if (originalEntry && originalEntry.storagebox) {
                const foundOriginalCase = AppState.availableStorageBoxes.find(box => box.toLowerCase() === originalEntry.storagebox.toLowerCase());
                if (foundOriginalCase) originalStorageBoxForSearch = foundOriginalCase;
                else originalStorageBoxForSearch = originalEntry.storagebox;
            }

            const entryIndexInFilteredData = vsInfo.filteredData.findIndex(e =>
                e.path === AppState.dataList.currentEditPath &&
                e.storageBox === originalStorageBoxForSearch
            );

            if (entryIndexInFilteredData > -1) {
                let entryForFilteredData = { ...updatedEntryFromModal };
                if (originalStorageBoxForSearch) {
                    entryForFilteredData.storageBox = originalStorageBoxForSearch;
                    delete entryForFilteredData.storagebox;
                }
                vsInfo.filteredData[entryIndexInFilteredData] = entryForFilteredData;
                renderVisibleItems();
            } else {
                // 如果条目因修改而不符合当前过滤条件，不刷新是正常的
                // 但如果确实希望刷新（会丢滚动条），可以调用 applyFiltersAndRenderDataList();
            }
        }
        setTimeout(closeEditModal, 800);
    }
}
//  图片放大模态框 Image Magnifier Modal 
/**
 * 打开图片放大模态框
 * @param {string} imageUrl 要放大的图片 URL
 */
function openImageModal(imageUrl) {
    if (!DOM.imageModalOverlay || !DOM.modalImageViewer) {
        console.error("DataList: 图片放大模态框元素缺失！");
        displayToast("无法打开图片预览", UI_CLASSES.WARNING);
        return;
    }
    if (!imageUrl) return;
    console.log("DataList: 打开图片放大:", imageUrl);
    DOM.modalImageViewer.src = imageUrl;
    DOM.imageModalOverlay.classList.remove(UI_CLASSES.HIDDEN); // 显示模态框
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
}

/**
 * 关闭图片放大模态框
 */
function closeImageModal() {
    if (DOM.imageModalOverlay) {
        DOM.imageModalOverlay.classList.add(UI_CLASSES.HIDDEN); // 隐藏模态框
        if (DOM.modalImageViewer) DOM.modalImageViewer.src = ''; // 清空图片 src
        if (typeof window.resetImageViewer === 'function') {
            window.resetImageViewer();
        }
        document.body.style.overflow = ''; // 恢复背景滚动
        console.log("DataList: 图片放大模态框已关闭");
    }
}

//  事件监听器设置 Data List Pane 

/**
 * 处理二级标签下拉框内的点击事件
 * @param {MouseEvent} event 
 */
function handleTagDropdownClick(event) {
    const target = event.target;
    const filterState = AppState.dataList.secondaryTagsFilter;

    // 点击标签项
    if (target.classList.contains('tags-dropdown-tag-item')) {
        const tag = target.dataset.tag;
        if (filterState.selectedTags.has(tag)) {
            filterState.selectedTags.delete(tag);
            target.classList.remove('selected');
        } else {
            filterState.selectedTags.add(tag);
            target.classList.add('selected');
        }
        updateSecondaryTagsFilterUI();
        // 实时应用筛选
        applyFiltersAndRenderDataList();
    }

    // 点击清除按钮
    const clearButton = target.closest('#clearSecondaryTagsBtn');
    if (clearButton) {
        filterState.selectedTags.clear();
        DOM.secondaryTagsDropdown.querySelectorAll('.tags-dropdown-tag-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        updateSecondaryTagsFilterUI();
        applyFiltersAndRenderDataList();
        closeSecondaryTagsDropdown(); // 清空后关闭
    }
}

/**
 * 处理点击页面其他区域时关闭二级标签下拉框
 * @param {MouseEvent} event 
 */
function handleOutsideTagDropdownClick(event) {
    if (!DOM.secondaryTagsFilterBtn || !DOM.secondaryTagsDropdown) return;
    if (DOM.secondaryTagsDropdown.classList.contains(UI_CLASSES.HIDDEN)) return;

    // 如果点击的目标是按钮本身，或在下拉框内部，则不作处理
    const isClickOnButton = DOM.secondaryTagsFilterBtn.contains(event.target);
    const isClickInDropdown = DOM.secondaryTagsDropdown.contains(event.target);

    if (!isClickOnButton && !isClickInDropdown) {
        closeSecondaryTagsDropdown();
    }
}

/**
 * 全局点击事件处理器，用于关闭所有打开的自定义下拉框
 * @param {MouseEvent} event 
 */
function handleGlobalDropdownClose(event) {
    const dropdowns = [
        { btn: DOM.filterGameBtn, dropdown: DOM.filterGameDropdown },
        { btn: DOM.secondaryTagsFilterBtn, dropdown: DOM.secondaryTagsDropdown },
        { btn: document.getElementById('sortOrderFilterBtn'), dropdown: document.getElementById('sortOrderDropdown') }
    ];

    dropdowns.forEach(item => {
        if (item.btn && item.dropdown && !item.dropdown.classList.contains('hidden')) {
            // 如果点击的目标不在当前按钮或其下拉框内部，则关闭它
            if (!item.btn.contains(event.target) && !item.dropdown.contains(event.target)) {
                item.dropdown.classList.add('hidden');
                item.btn.closest('.select-wrapper, .custom-select-wrapper')?.classList.remove('is-open');
            }
        }
    });
}

/**
 * 设置云端Json数据页面的事件监听器
 */
async function setupDataListEventListeners() {
    const debouncedSearch = () => {
        clearTimeout(AppState.dataList.searchDebounceTimer);
        AppState.dataList.searchDebounceTimer = setTimeout(() => {
            const query = DOM.dataListSearchInput.value.trim();
            if (query && searchWorker) {
                searchWorker.postMessage({ type: 'search', payload: { query, dataSource: 'indexed' } });
            } else {
                AppState.dataList.workerSearchResults = null;
                applyFiltersAndRenderDataList();
            }
        }, DELAYS.DATA_LIST_SEARCH_DEBOUNCE);
    };

    if (DOM.dataListSearchInput) {
        DOM.dataListSearchInput.removeEventListener('input', debouncedSearch); 
        DOM.dataListSearchInput.addEventListener('input', debouncedSearch); 
    }

    if (DOM.dataListSearchInput) {
        DOM.dataListSearchInput.addEventListener('focus', () => {
            const history = ["玛薇卡", "胡桃", "丝柯"];
            showDataListSuggestions(history);
        });
        DOM.dataListSearchInput.addEventListener('blur', () => {
            setTimeout(hideDataListSuggestions, 150);
        });
    }

    const attributeFilters = document.querySelectorAll('#dataListPane .filter-toggle-checkbox');
    attributeFilters.forEach(el => {
        const handler = () => {
            updateFilterToggleButtonText(el.id);
            applyFiltersAndRenderDataList();
        };
        el.removeEventListener('change', handler);
        el.addEventListener('change', handler);
    });

    if (!AppState.dataList.secondaryTagsFilter) {
        AppState.dataList.secondaryTagsFilter = {
            availableTags: {},
            selectedTags: new Set()
        };
    }

    if (DOM.secondaryTagsFilterBtn && DOM.secondaryTagsDropdown) {
        fetchSecondaryTagsForFilter();
        DOM.secondaryTagsFilterBtn.removeEventListener('click', toggleSecondaryTagsDropdown);
        DOM.secondaryTagsFilterBtn.addEventListener('click', toggleSecondaryTagsDropdown);
        DOM.secondaryTagsDropdown.removeEventListener('click', handleTagDropdownClick);
        DOM.secondaryTagsDropdown.addEventListener('click', handleTagDropdownClick);
    }

    setupCustomGameFilter();

    const sortOrderBtn = document.getElementById('sortOrderFilterBtn');
    const sortOrderDropdown = document.getElementById('sortOrderDropdown');
    if (sortOrderBtn && sortOrderDropdown) {
        sortOrderBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const container = sortOrderBtn.closest('.select-wrapper');
            sortOrderDropdown.classList.toggle('hidden');
            container?.classList.toggle('is-open');
        });

        sortOrderDropdown.addEventListener('click', (event) => {
            const target = event.target.closest('.custom-select-option');
            if (!target) return;

            AppState.dataList.currentSortOrder = target.dataset.sortBy;
            sortOrderBtn.textContent = target.dataset.text;
            sortOrderDropdown.classList.add('hidden');
            sortOrderBtn.closest('.select-wrapper')?.classList.remove('is-open');
            applyFiltersAndRenderDataList();
        });
    }

    document.removeEventListener('click', handleGlobalDropdownClose);
    document.addEventListener('click', handleGlobalDropdownClose);

    if (DOM.dataListContainer) {
        const visibleItemsCont = DOM.dataListContainer.querySelector('#visibleItemsContainer');
        if (visibleItemsCont) {
            visibleItemsCont.removeEventListener('click', handleDataListItemClick);
            visibleItemsCont.addEventListener('click', handleDataListItemClick);
        }
    }

    console.log("DataList: 事件监听器设置完成");
}

/**
 * 处理数据列表项内部元素的点击事件 事件委托
 * @param {MouseEvent} event 点击事件对象
 */
function handleDataListItemClick(event) {
    const target = event.target;

    const editButton = target.closest('.data-item-edit-btn');
    if (editButton?.dataset.path && editButton.dataset.storagebox) {
        // 打开编辑模态框并立即停止后续操作
        openEditModal(editButton.dataset.path, editButton.dataset.storagebox);
        return;
    }

    const thumbnailContainer = target.closest('.data-item-thumbnail-container');
    if (thumbnailContainer) {
        // 如果确实点击了图片区域，再向上找到整个卡片以获取图片地址数据
        const card = thumbnailContainer.closest('.data-item-card');
        if (card && card.dataset.fullSrc) {
            const fullSrc = card.dataset.fullSrc;
            if (!fullSrc.endsWith('/placeholder.png')) {
                openImageModal(fullSrc);
            } else {
                console.warn("缩略图点击，但完整图片源无效:", fullSrc);
            }
        }
    }
}

/**
 * 设置与模态框相关的事件监听器
 */
function setupModalEventListeners() {
    // 编辑属性模态框按钮
    if (DOM.modalSaveButton) {
        DOM.modalSaveButton.removeEventListener('click', saveAttributeChanges);
        DOM.modalSaveButton.addEventListener('click', saveAttributeChanges);
    } else { console.error("Modal: 保存按钮 modalSaveButton 未找到"); }
    if (DOM.modalCancelButton) {
        DOM.modalCancelButton.removeEventListener('click', closeEditModal);
        DOM.modalCancelButton.addEventListener('click', closeEditModal);
    } else { console.error("Modal: 取消按钮 modalCancelButton 未找到"); }
    // 点击模态框背景关闭 编辑属性
    if (DOM.editAttributeModal) {
        DOM.editAttributeModal.removeEventListener('click', handleModalOverlayClick);
        DOM.editAttributeModal.addEventListener('click', handleModalOverlayClick);
    } else { console.error("Modal: 编辑模态框 editAttributeModal 未找到"); }

    // 图片放大模态框关闭按钮
    if (DOM.modalCloseButton) {
        DOM.modalCloseButton.removeEventListener('click', closeImageModal);
        DOM.modalCloseButton.addEventListener('click', closeImageModal);
    } else { console.error("Modal: 图片关闭按钮 modalCloseButton 未找到"); }
    // 点击模态框背景关闭 图片放大
    if (DOM.imageModalOverlay) {
        DOM.imageModalOverlay.removeEventListener('click', handleImageModalOverlayClick);
        DOM.imageModalOverlay.addEventListener('click', handleImageModalOverlayClick);
    } else { console.error("Modal: 图片放大遮罩 imageModalOverlay 未找到"); }

    // Escape 键关闭模态框
    document.removeEventListener('keydown', handleEscapeKey);
    document.addEventListener('keydown', handleEscapeKey);

    console.log("Modal: 事件监听器设置完成");
}

/**
 * 处理模态框遮罩层点击事件 仅当点击遮罩本身时关闭
 * @param {MouseEvent} event 点击事件对象
 */
function handleModalOverlayClick(event) {
    if (event.target === DOM.editAttributeModal) { // 检查点击目标是否为遮罩层本身
        closeEditModal();
    }
}
/**
 * 处理图片放大模态框遮罩层点击事件
 * @param {MouseEvent} event 点击事件对象
 */
function handleImageModalOverlayClick(event) {
    if (event.target === DOM.imageModalOverlay) {
        closeImageModal();
    }
}

/**
 * 处理键盘 Escape 键事件 用于关闭当前活动的模态框
 * @param {KeyboardEvent} event 键盘事件对象
 */
function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        // 检查编辑模态框是否可见
        if (DOM.editAttributeModal && !DOM.editAttributeModal.classList.contains(UI_CLASSES.HIDDEN)) {
            closeEditModal();
        }
        // 检查图片放大模态框是否可见
        else if (DOM.imageModalOverlay && !DOM.imageModalOverlay.classList.contains(UI_CLASSES.HIDDEN)) {
            closeImageModal();
        }
    }
}

/**
 * 更新数据列表面板的条目计数显示
 */
function updateDataListCount() {
    if (DOM.dataListCountDisplay) {
        // 这个函数现在只更新总数 过滤后的数量由 applyFiltersAndRenderDataList 更新
        // DOM.dataListCountDisplay.textContent = `总计: ${AppState.userData.length} 条`;
        // 显示过滤后的数量
        const count = AppState.dataList.virtualScrollInfo.filteredData?.length ?? 0;
        DOM.dataListCountDisplay.textContent = `当前显示: ${count} 条`;
    }
}
