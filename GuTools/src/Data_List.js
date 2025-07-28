// ==========================================================================
// 数据列表: 管理云端Json数据页面的功能 包括过滤 虚拟滚动 列表渲染
//       和属性编辑模态框
// ==========================================================================

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

//  数据过滤与渲染 

/**
 * 根据当前过滤器和搜索词过滤 AppState.userData 数据
 * @returns {Array<object>} 过滤并排序后的数据条目数组
 */
function filterUserDataEntries() {
    // 获取所有过滤控件的值
    const searchTerm = DOM.dataListSearchInput?.value.toLowerCase().trim() || '';
    const showPx18 = DOM.dataListFilterPx18?.checked ?? false;
    const showRx18 = DOM.dataListFilterRx18?.checked ?? false;
    const showAiImage = DOM.dataListFilterAiImage?.checked ?? false;
    const showBan = DOM.dataListFilterIsBan?.checked ?? false;
    const showNormal = DOM.dataListFilterNormal?.checked ?? false;
    const showFullscreen = DOM.dataListFilterFullscreen?.checked ?? false;
    const showEasterEgg = DOM.dataListFilterEasterEgg?.checked ?? false;
    const selectedGame = DOM.dataListFilterGame?.value || ''; // '' 表示所有游戏

    // 使用 AppState.userData
    const filteredEntries = AppState.userData.filter(entry => {
        if (!entry?.attributes) return false; // 条目或属性无效则排除

        // 搜索词过滤 文件名 或 GID
        if (searchTerm) {
            const filenameMatch = (entry.attributes.filename || '').toLowerCase().includes(searchTerm);
            const gidMatch = (entry.gid || '').toString().toLowerCase().includes(searchTerm);
            if (!filenameMatch && !gidMatch) return false;
        }

        // 属性过滤 勾选表示只显示符合该属性的
        if (showBan && entry.attributes.isBan !== true) return false;
        if (showAiImage && entry.attributes.isAiImage !== true) return false;
        if (showEasterEgg && entry.attributes.isEasterEgg !== true) return false;
        // 限制级和构图过滤 HTML 处理了互斥 只需检查勾选状态
        if (showPx18 && entry.attributes.isPx18 !== true) return false;
        if (showRx18 && entry.attributes.isRx18 !== true) return false;
        if (showNormal && entry.attributes.layout !== 'normal') return false;
        if (showFullscreen && entry.attributes.layout !== 'fullscreen') return false;

        // 游戏来源过滤
        if (selectedGame) {
            if (selectedGame === 'unknown') {
                const knownGames = ['gs-character', 'sr-character', 'zzz-character', 'waves-character'];
                if (knownGames.includes(entry.sourceGallery)) return false; // 排除已知游戏
            } else {
                if (entry.sourceGallery !== selectedGame) return false; // 必须匹配特定游戏
            }
        }

        return true; // 通过所有检查
    });

    // 恢复原来的排序逻辑 只按文件名
    filteredEntries.sort((a, b) =>
        (a.attributes?.filename || '').localeCompare(b.attributes?.filename || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    return filteredEntries;
}

/**
 * 应用当前的过滤器 并使用过滤后的数据重新渲染数据列表
 */
function applyFiltersAndRenderDataList() {
    // 检查必要的 DOM
    const requiredElementsMap = {
        dataListSearchInput: DOM.dataListSearchInput,
        dataListFilterPx18: DOM.dataListFilterPx18,
        dataListFilterRx18: DOM.dataListFilterRx18,
        dataListFilterIsBan: DOM.dataListFilterIsBan,
        dataListFilterNormal: DOM.dataListFilterNormal,
        dataListFilterFullscreen: DOM.dataListFilterFullscreen,
        dataListFilterEasterEgg: DOM.dataListFilterEasterEgg,
        dataListFilterAiImage: DOM.dataListFilterAiImage,
        dataListFilterGame: DOM.dataListFilterGame,
        dataListContainer: DOM.dataListContainer,
        dataListCountDisplay: DOM.dataListCountDisplay
    };

    const missingElements = Object.entries(requiredElementsMap)
                                .filter(([key, element]) => !element)
                                .map(([key]) => key);

    if (missingElements.length > 0) {
        console.error(`DataList: 缺少必要的过滤或列表容器元素: ${missingElements.join(', ')}`);
        if(DOM.dataListContainer) {
            DOM.dataListContainer.innerHTML = `<p class="no-results" style="display:block;">错误：界面控件加载不完整，无法显示列表。</p>`;
        }
        return;
    }

    console.log("DataList: 应用过滤器并渲染列表...");
    const filteredData = filterUserDataEntries(); // 获取过滤后的数据

    // 更新计数显示
    DOM.dataListCountDisplay.textContent = `当前显示: ${filteredData.length} 条`;

    // 设置并渲染虚拟滚动列表
    setupVirtualScroll(DOM.dataListContainer, filteredData);
}

//  虚拟滚动实现 Virtual Scroll 
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
         if(vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'none';
         if(vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'none';
        return;
    }

    // 有数据 则隐藏无结果提示 并显示列表结构
    noResultsElement.style.display = 'none';
     if(vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'block';
     if(vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'block';


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
        Math.ceil((scrollTop + containerHeight) / itemHeight) -1 + bufferRows
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

   thumbnail.onload = function() {
       this.classList.remove('load-error'); 
   };
   thumbnail.onerror = function() {
       thumbnailContainer.style.backgroundColor = '#fdd'; 
       console.error("缩略图加载失败:", this.src);
       this.alt = '缩略图加载失败';
       this.classList.add('load-error');
   };
   
   const attrs = entryData.attributes;
   const filename = attrs.filename || '未知文件名';
   const gid = entryData.gid || '无 GID';
   const timestamp = formatTimestamp(entryData.timestamp);
   
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

   const editButtonHtml = `<button class="data-item-edit-btn" data-path="${entryData.path}" data-storagebox="${entryData.storagebox}" title="修改属性"></button>`;

   const filenameDiv = document.createElement('div');
   filenameDiv.className = 'filename';
   filenameDiv.title = filename;
   filenameDiv.innerHTML = `${filename} <span class="gid-display">(GID: ${gid})</span>`;
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

   const attributeTagsDiv = document.createElement('div');
   attributeTagsDiv.className = 'attribute-tags';
   attributeTagsDiv.innerHTML = tagsHtml || '<span class="no-tags">无特殊标签</span>';
   contentContainer.appendChild(attributeTagsDiv);
   
   const tempButtonContainer = document.createElement('div'); 
   tempButtonContainer.innerHTML = editButtonHtml;
   if (tempButtonContainer.firstChild) {
       contentContainer.appendChild(tempButtonContainer.firstChild);
   }
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
            if(originalEntry && originalEntry.storagebox){
                 const foundOriginalCase = AppState.availableStorageBoxes.find(box => box.toLowerCase() === originalEntry.storagebox.toLowerCase());
                 if(foundOriginalCase) originalStorageBoxForSearch = foundOriginalCase;
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
 * 设置云端Json数据页面的事件监听器
 */
function setupDataListEventListeners() {
    // 定义过滤器控件和对应的互斥组 
    const filterControlsConfig = [
        { element: DOM.dataListSearchInput, event: 'input', group: null, debounce: true },
        { element: DOM.dataListFilterGame, event: 'change', group: null },
        { element: DOM.dataListFilterPx18, event: 'change', group: 'rating' },
        { element: DOM.dataListFilterRx18, event: 'change', group: 'rating' },
        { element: DOM.dataListFilterNormal, event: 'change', group: 'layout' },
        { element: DOM.dataListFilterFullscreen, event: 'change', group: 'layout' },
        { element: DOM.dataListFilterEasterEgg, event: 'change', group: null },
        { element: DOM.dataListFilterAiImage, event: 'change', group: null },
        { element: DOM.dataListFilterIsBan, event: 'change', group: null }
    ];

    filterControlsConfig.forEach(config => {
        if (config.element) {
            const handler = (event) => {
                const targetElement = event.target;

                // 处理互斥逻辑
                if (config.group && targetElement.checked) {
                    filterControlsConfig.forEach(otherConfig => {
                        if (otherConfig.group === config.group && otherConfig.element !== targetElement && otherConfig.element?.checked) {
                            otherConfig.element.checked = false;
                            updateFilterToggleButtonText(otherConfig.element.id);
                        }
                    });
                }

                // 更新当前点击/输入控件的按钮文本 如果是 checkbox
                if (targetElement.type === 'checkbox') {
                    updateFilterToggleButtonText(targetElement.id);
                }


                // 根据是否需要防抖来调用过滤函数
                if (config.debounce) {
                    clearTimeout(AppState.dataList.searchDebounceTimer);
                    AppState.dataList.searchDebounceTimer = setTimeout(applyFiltersAndRenderDataList, DELAYS.DATA_LIST_SEARCH_DEBOUNCE);
                } else {
                    applyFiltersAndRenderDataList();
                }
            };
            // 绑定事件监听器
            config.element.removeEventListener(config.event, handler);
            config.element.addEventListener(config.event, handler);
        } else {
            // console.warn(`DataList: 过滤控件 ${config.element} 假设的 未找到`);
        }
    });

    // 列表项点击事件 使用事件代理
    if (DOM.dataListContainer) {
        const visibleItemsCont = DOM.dataListContainer.querySelector('#visibleItemsContainer');
        if (visibleItemsCont) {
            visibleItemsCont.removeEventListener('click', handleDataListItemClick);
            visibleItemsCont.addEventListener('click', handleDataListItemClick);
        } else {
             console.error("DataList: 未找到 #visibleItemsContainer 无法设置列表项点击事件");
        }
    } else { console.error("DataList: 列表容器 dataListContainer 未找到"); }

    console.log("DataList: 事件监听器设置完成");
}

/**
 * 处理数据列表项内部元素的点击事件 事件委托
 * @param {MouseEvent} event 点击事件对象
 */
function handleDataListItemClick(event) {
    const target = event.target;

    // 检查是否点击了编辑按钮
    const editButton = target.closest('.data-item-edit-btn');
    if (editButton?.dataset.path && editButton.dataset.storagebox) { 
        openEditModal(editButton.dataset.path, editButton.dataset.storagebox);
        return; 
    }

    // 检查是否点击了缩略图
    const card = target.closest('.data-item-card');
    if (card && card.dataset.fullSrc && !target.closest('.data-item-edit-btn')) {
        const fullSrc = card.dataset.fullSrc;
        if (fullSrc && !fullSrc.endsWith('/placeholder.png')) {
            openImageModal(fullSrc);
        } else {
            console.warn("卡片点击 但完整图片源无效:", fullSrc);
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