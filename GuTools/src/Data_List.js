// ==========================================================================
// 管理 "云端Json数据" 页面的功能，包括过滤、虚拟滚动、列表渲染
//       和属性编辑模态框。提供核心的 updateUserData 函数 (如果未移到 Core.js)。
// ==========================================================================


/**
 * 更新单个过滤切换按钮的显示文本 (例如 "Px18 开" / "Px18 关")。
 * @param {string} checkboxId - 复选框元素的 ID。
 */
function updateFilterToggleButtonText(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    // 查找与复选框关联的按钮元素
    const button = checkbox?.closest('.filter-toggle-label')?.querySelector('.filter-toggle-button');

    if (checkbox && button) {
        const textOn = button.dataset.on || '开'; // 获取 data-on 属性值，默认为 '开'
        const textOff = button.dataset.off || '关'; // 获取 data-off 属性值，默认为 '关'
        button.textContent = checkbox.checked ? textOn : textOff; // 根据选中状态设置文本
        // 可选：根据选中状态添加/移除激活类，以便 CSS 控制更复杂的样式
        button.classList.toggle(UI_CLASSES.ACTIVE, checkbox.checked);
    } else {
         // console.warn(`DataList: 未找到复选框 #${checkboxId} 或其对应的切换按钮。`);
    }
}

// --------------------------------------------------------------------------
// 数据过滤与渲染
// --------------------------------------------------------------------------

/**
 * 根据当前过滤器和搜索词过滤 AppState.userData 数据。
 * @returns {Array<object>} 过滤并排序后的数据条目数组。
 */
function filterUserDataEntries() { // 重命名函数
    // 获取所有过滤控件的值 (使用重命名后的 DOM key)
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

        // 1. 搜索词过滤 (文件名 或 GID)
        if (searchTerm) {
            const filenameMatch = (entry.attributes.filename || '').toLowerCase().includes(searchTerm);
            const gidMatch = (entry.gid || '').toString().toLowerCase().includes(searchTerm);
            if (!filenameMatch && !gidMatch) return false;
        }

        // 2. 属性过滤 (勾选表示只显示符合该属性的)
        // 注意：这里的逻辑是 "与" 关系，即必须同时满足所有勾选的条件
        if (showBan && entry.attributes.isBan !== true) return false;
        if (showAiImage && entry.attributes.isAiImage !== true) return false;
        if (showEasterEgg && entry.attributes.isEasterEgg !== true) return false;
        // ★★★ 限制级和构图过滤：因为 HTML 处理了互斥，这里只需检查勾选状态 ★★★
        if (showPx18 && entry.attributes.isPx18 !== true) return false;
        if (showRx18 && entry.attributes.isRx18 !== true) return false;
        if (showNormal && entry.attributes.layout !== 'normal') return false;
        if (showFullscreen && entry.attributes.layout !== 'fullscreen') return false;

        // 3. 游戏来源过滤
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

    // 对过滤结果排序
    filteredEntries.sort((a, b) =>
        (a.attributes?.filename || '').localeCompare(b.attributes?.filename || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    return filteredEntries;
}

/**
 * 应用当前的过滤器，并使用过滤后的数据重新渲染数据列表。
 */
function applyFiltersAndRenderDataList() {
    // 检查必要的 DOM (使用新 Key)
    const requiredElements = [
        DOM.dataListSearchInput, DOM.dataListFilterPx18, DOM.dataListFilterRx18, DOM.dataListFilterIsBan,
        DOM.dataListFilterNormal, DOM.dataListFilterFullscreen, DOM.dataListFilterEasterEgg, DOM.dataListFilterAiImage, DOM.dataListFilterGame,
        DOM.dataListContainer, DOM.dataListCountDisplay
    ];
    if (requiredElements.some(el => !el)) {
        console.error("DataList: 缺少必要的过滤或列表容器元素。");
        return;
    }

    // 更新所有切换按钮的文本显示
    // (移到事件监听器内部处理，确保在互斥逻辑后更新)
    // filterToggleIds.forEach(updateFilterToggleButtonText);

    console.log("DataList: 应用过滤器并渲染列表...");
    const filteredData = filterUserDataEntries(); // 获取过滤后的数据

    // 更新计数显示
    DOM.dataListCountDisplay.textContent = `当前显示: ${filteredData.length} 条`;

    // 设置并渲染虚拟滚动列表
    setupVirtualScroll(DOM.dataListContainer, filteredData);
}

// --------------------------------------------------------------------------
// 虚拟滚动实现 (Virtual Scroll) - 保持不变，但使用 AppState.dataList
// --------------------------------------------------------------------------
function setupVirtualScroll(containerElement, data) {
    // ... (内部逻辑不变，确保使用 AppState.dataList.virtualScrollInfo) ...
    if (!containerElement) {
        console.error("虚拟滚动: 容器元素无效！");
        return;
    }

    const vsInfo = AppState.dataList.virtualScrollInfo; // 使用 dataList 下的 virtualScrollInfo
    vsInfo.container = containerElement;
    vsInfo.filteredData = data || [];
    vsInfo.scrollTop = 0;

    containerElement.removeEventListener('scroll', handleScroll);

    if (!vsInfo.innerSpacer || !vsInfo.visibleItemsContainer) {
         vsInfo.innerSpacer = containerElement.querySelector('#virtualScrollInner');
         vsInfo.visibleItemsContainer = vsInfo.innerSpacer?.querySelector('#visibleItemsContainer');
         if (!vsInfo.innerSpacer || !vsInfo.visibleItemsContainer) {
             console.error("虚拟滚动: 内部结构元素 (#virtualScrollInner 或 #visibleItemsContainer) 缺失！");
             containerElement.innerHTML = '<p class="no-results" style="display:block;">虚拟列表结构错误</p>';
             return;
         }
    }

    vsInfo.innerSpacer.style.height = '0px';
    vsInfo.visibleItemsContainer.innerHTML = '';
    vsInfo.visibleItemsContainer.style.transform = 'translateY(0px)';

    let noResultsElement = containerElement.querySelector('.no-results');
    if (!noResultsElement) {
         noResultsElement = document.createElement('p');
         noResultsElement.className = 'no-results';
         noResultsElement.textContent = '没有找到匹配的数据。';
         noResultsElement.style.display = 'none';
         containerElement.insertBefore(noResultsElement, vsInfo.innerSpacer);
    }

    if (vsInfo.filteredData.length === 0) {
        noResultsElement.style.display = 'block';
        console.log("虚拟滚动: 没有数据可显示。");
         // 确保隐藏 spacer 和 visible container
         if(vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'none';
         if(vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'none';
        return;
    }

    noResultsElement.style.display = 'none';
     // 确保显示 spacer 和 visible container
     if(vsInfo.innerSpacer) vsInfo.innerSpacer.style.display = 'block';
     if(vsInfo.visibleItemsContainer) vsInfo.visibleItemsContainer.style.display = 'block';


    if (vsInfo.itemHeight <= 0) {
        console.error("虚拟滚动: itemHeight 无效！");
        return;
    }
    const totalHeight = vsInfo.filteredData.length * vsInfo.itemHeight;
    vsInfo.innerSpacer.style.height = `${totalHeight}px`;
    console.log(`虚拟滚动: 设置总高度 ${totalHeight}px`);

    requestAnimationFrame(() => {
        containerElement.addEventListener('scroll', handleScroll);
        containerElement.scrollTop = 0;
        vsInfo.scrollTop = 0;
        renderVisibleItems();
        console.log("虚拟滚动: 设置完成并渲染初始项。");
    });
}

function renderVisibleItems() {
    const vsInfo = AppState.dataList.virtualScrollInfo;
    if (!vsInfo.container || !vsInfo.visibleItemsContainer || vsInfo.itemHeight <= 0) {
        return;
    }

    const containerHeight = vsInfo.container.clientHeight;
    const scrollTop = vsInfo.scrollTop;
    const totalItems = vsInfo.filteredData.length;
    const itemHeight = vsInfo.itemHeight;
    const buffer = vsInfo.bufferItems;

    if (containerHeight <= 0 || totalItems === 0) {
        vsInfo.visibleItemsContainer.innerHTML = '';
        return;
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(totalItems - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);
    const offsetY = startIndex * itemHeight;
    vsInfo.visibleItemsContainer.style.transform = `translateY(${offsetY}px)`;

    const visibleData = vsInfo.filteredData.slice(startIndex, endIndex + 1);
    const fragment = document.createDocumentFragment();

    visibleData.forEach(entryData => {
        if (!entryData?.path || !entryData.attributes) {
            console.warn("虚拟滚动: 跳过无效条目:", entryData);
            return;
        }
        const card = document.createElement('div');
        card.className = 'data-item-card';
        card.dataset.path = entryData.path;

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

        populateCardContent(card, entryData); // 填充卡片内容

        fragment.appendChild(card);
    });

    vsInfo.visibleItemsContainer.innerHTML = '';
    vsInfo.visibleItemsContainer.appendChild(fragment);
}

function populateCardContent(cardElement, entryData) {
    // ... (内部逻辑不变，确保使用 getGameName, formatTimestamp) ...
     if (!cardElement || !entryData?.attributes) return;

    const contentContainer = cardElement.querySelector('.data-item-content');
    const thumbnail = cardElement.querySelector('.data-item-thumbnail');
    const thumbnailContainer = cardElement.querySelector('.data-item-thumbnail-container');

    if (!contentContainer || !thumbnail || !thumbnailContainer) return;

    const imagePath = entryData.path.startsWith('/') ? entryData.path : `/${entryData.path}`;
    thumbnail.src = imagePath;
    thumbnail.style.display = 'block';
    thumbnailContainer.style.backgroundColor = 'transparent';
    thumbnail.onerror = function() {
        this.style.display = 'none';
        thumbnailContainer.style.backgroundColor = '#eee';
        console.warn("DataList: 缩略图加载失败:", imagePath);
    };

    const attrs = entryData.attributes;
    const filename = attrs.filename || '未知文件名';
    const gid = entryData.gid || '无 GID';
    const timestamp = formatTimestamp(entryData.timestamp); // 使用 Core.js 的函数

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

    const editButtonHtml = `<button class="data-item-edit-btn" data-path="${entryData.path}" title="修改属性">修改</button>`;

    // 使用 getGameName (Core.js)
    contentContainer.innerHTML = `
        <div class="filename" title="${filename}">${filename} <span class="gid-display">(GID: ${gid})</span></div>
        <div class="details">
            <span class="timestamp" title="保存时间">${timestamp}</span>
            <span class="source-gallery" title="来源">${getGameName(entryData.sourceGallery)}</span>
        </div>
        <div class="attribute-tags">${tagsHtml || '<span class="no-tags">无特殊标签</span>'}</div>
        ${editButtonHtml}
    `;
}


function handleScroll() {
    const vsInfo = AppState.dataList.virtualScrollInfo;
    if (!vsInfo.container) return;

    vsInfo.scrollTop = vsInfo.container.scrollTop;

    if (AppState.dataList.isScrolling === null) { // 使用 dataList 下的 isScrolling
        AppState.dataList.isScrolling = requestAnimationFrame(() => {
            renderVisibleItems();
            AppState.dataList.isScrolling = null;
        });
    }
}

// --------------------------------------------------------------------------
// 属性编辑模态框 (Edit Attribute Modal) - 逻辑基本不变，确保使用 AppState.userData
// --------------------------------------------------------------------------
function openEditModal(path) {
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

    const entry = AppState.userData.find(e => e.path === path); // 使用 AppState.userData
    if (!entry?.attributes) {
        console.error(`DataList: 找不到路径 "${path}" 的条目数据。`);
        displayToast(`错误：找不到要编辑的数据`, UI_CLASSES.ERROR);
        return;
    }

    console.log(`DataList: 打开编辑模态框，编辑: ${entry.attributes.filename}`);
    AppState.dataList.currentEditPath = path; // 使用 dataList 下的 currentEditPath

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

function closeEditModal() {
    if (DOM.editAttributeModal) {
        DOM.editAttributeModal.classList.add(UI_CLASSES.HIDDEN);
    }
    AppState.dataList.currentEditPath = null; // 清除状态
    // hideModalMessage(); // 可选：关闭时清除消息
    console.log("DataList: 编辑模态框已关闭。");
}

async function saveAttributeChanges() {
    if (!AppState.dataList.currentEditPath || !DOM.modalEntryPathInput || !DOM.modalSaveButton) {
        console.error("DataList: 保存属性更改失败，状态或元素缺失。");
        displayToast("保存失败：内部状态错误", UI_CLASSES.ERROR);
        return;
    }

    const entryIndex = AppState.userData.findIndex(e => e.path === AppState.dataList.currentEditPath);
    if (entryIndex === -1) {
        console.error("DataList: 保存错误：在 userData 中找不到路径", AppState.dataList.currentEditPath);
        displayToast("保存失败：数据不一致，请刷新", UI_CLASSES.ERROR);
        return;
    }

    DOM.modalSaveButton.disabled = true;
    // displayModalMessage("保存中...", UI_CLASSES.INFO); // 暂时移除，让 updateUserData 处理

    const updatedEntry = JSON.parse(JSON.stringify(AppState.userData[entryIndex]));

    const rating = document.querySelector('input[name="modalRating"]:checked')?.value || 'none';
    const layout = document.querySelector('input[name="modalLayout"]:checked')?.value || 'normal';
    updatedEntry.attributes.isPx18 = rating === 'px18';
    updatedEntry.attributes.isRx18 = rating === 'rx18';
    updatedEntry.attributes.layout = layout;
    updatedEntry.attributes.isEasterEgg = DOM.modalIsEasterEggCheckbox.checked;
    updatedEntry.attributes.isAiImage = DOM.modalIsAiImageCheckbox.checked;
    updatedEntry.attributes.isBan = DOM.modalisBanCheckbox.checked;
    updatedEntry.timestamp = new Date().toISOString();

    console.log("DataList: 准备保存修改:", updatedEntry);

    const updatedList = AppState.userData.map((entry, index) =>
        index === entryIndex ? updatedEntry : entry
    );

    let success = false;
    try {
        if (typeof updateUserData === "function") {
             success = await updateUserData(
                updatedList,
                `成功修改 "${updatedEntry.attributes.filename}" 的属性`,
                'toast',
                false, // false = 内部数据
                DELAYS.MESSAGE_CLEAR_DEFAULT // 指定成功消息时长
            );
        } else {
            throw new Error("核心函数 updateUserData 未定义");
        }
    } catch (error) {
         console.error("DataList: 保存属性调用 updateUserData 失败:", error);
         success = false;
         // 错误消息由 updateUserData 显示在 toast
    } finally {
        DOM.modalSaveButton.disabled = false; // 重新启用按钮
    }

    if (success) {
        // displayToast(`成功修改 "${updatedEntry.attributes.filename}" 属性`, UI_CLASSES.SUCCESS); // 移到 updateUserData
        // 延迟关闭模态框，让用户看到成功消息
        setTimeout(closeEditModal, 800);
    } else {
         // 失败信息已在模态框显示
    }
}

// --------------------------------------------------------------------------
// 图片放大模态框 (Image Magnifier Modal) - 逻辑不变
// --------------------------------------------------------------------------
function openImageModal(imageUrl) {
    if (!DOM.imageModalOverlay || !DOM.modalImageViewer) {
        console.error("DataList: 图片放大模态框元素缺失！");
        displayToast("无法打开图片预览", UI_CLASSES.WARNING);
        return;
    }
    if (!imageUrl) return;
    console.log("DataList: 打开图片放大:", imageUrl);
    DOM.modalImageViewer.src = imageUrl;
    DOM.imageModalOverlay.classList.remove(UI_CLASSES.HIDDEN);
    document.body.style.overflow = 'hidden';
}

function closeImageModal() {
    if (DOM.imageModalOverlay) {
        DOM.imageModalOverlay.classList.add(UI_CLASSES.HIDDEN);
        if (DOM.modalImageViewer) DOM.modalImageViewer.src = '';
        document.body.style.overflow = '';
        console.log("DataList: 图片放大模态框已关闭。");
    }
}

// --------------------------------------------------------------------------
// 事件监听器设置 (Data List Pane)
// --------------------------------------------------------------------------

/**
 * 设置 "云端Json数据" 页面的事件监听器。
 */
function setupDataListEventListeners() {
    // 定义过滤器控件和对应的互斥组
    const filterControlsConfig = [
        { element: DOM.dataListSearchInput, event: 'input', group: null, debounce: true },
        { element: DOM.dataListFilterGame, event: 'change', group: null },
        { element: DOM.dataListFilterPx18, event: 'change', group: 'rating' }, // Px18 属于 rating 组
        { element: DOM.dataListFilterRx18, event: 'change', group: 'rating' }, // Rx18 属于 rating 组
        { element: DOM.dataListFilterNormal, event: 'change', group: 'layout' }, // Normal 属于 layout 组
        { element: DOM.dataListFilterFullscreen, event: 'change', group: 'layout' }, // Fullscreen 属于 layout 组
        { element: DOM.dataListFilterEasterEgg, event: 'change', group: null },
        { element: DOM.dataListFilterAiImage, event: 'change', group: null },
        { element: DOM.dataListFilterIsBan, event: 'change', group: null }
    ];

    filterControlsConfig.forEach(config => {
        if (config.element) {
            const handler = (event) => {
                const targetElement = event.target;

                // ★★★ 处理互斥逻辑 ★★★
                if (config.group && targetElement.checked) {
                    // 找到同一组的其他控件并取消选中
                    filterControlsConfig.forEach(otherConfig => {
                        if (otherConfig.group === config.group && otherConfig.element !== targetElement && otherConfig.element?.checked) {
                            otherConfig.element.checked = false;
                            // 更新被取消选中按钮的文本
                            updateFilterToggleButtonText(otherConfig.element.id);
                        }
                    });
                }

                // 更新当前点击/输入控件的按钮文本 (如果是 checkbox)
                if (targetElement.type === 'checkbox') {
                    updateFilterToggleButtonText(targetElement.id);
                }

                // 根据是否需要防抖来调用过滤函数
                if (config.debounce) {
                    clearTimeout(AppState.dataList.searchDebounceTimer);
                    AppState.dataList.searchDebounceTimer = setTimeout(applyFiltersAndRenderDataList, DELAYS.DATA_LIST_SEARCH_DEBOUNCE);
                } else {
                    applyFiltersAndRenderDataList(); // 其他控件立即应用
                }
            };
            // 绑定事件监听器
            config.element.removeEventListener(config.event, handler); // 先移除旧的
            config.element.addEventListener(config.event, handler);
        } else {
            // console.warn(`DataList: 过滤控件 ${config.element} (假设的) 未找到。`);
        }
    });

    // 列表项点击事件 (使用事件代理)
    if (DOM.dataListContainer) {
        const visibleItemsCont = DOM.dataListContainer.querySelector('#visibleItemsContainer');
        if (visibleItemsCont) {
            visibleItemsCont.removeEventListener('click', handleDataListItemClick); // 移除旧监听器
            visibleItemsCont.addEventListener('click', handleDataListItemClick); // 添加新监听器
        } else {
             console.error("DataList: 未找到 #visibleItemsContainer，无法设置列表项点击事件。");
        }
    } else { console.error("DataList: 列表容器 (dataListContainer) 未找到。"); }

    console.log("DataList: 事件监听器设置完成。");
}

/**
 * 处理数据列表项内部元素的点击事件 (事件委托)。
 * @param {MouseEvent} event - 点击事件对象。
 */
function handleDataListItemClick(event) {
    const target = event.target;

    // 检查是否点击了编辑按钮
    const editButton = target.closest('.data-item-edit-btn');
    if (editButton?.dataset.path) {
        openEditModal(editButton.dataset.path);
        return; // 处理完毕
    }

    // 检查是否点击了缩略图 (确保图片已加载且未出错)
    const thumbnail = target.closest('.data-item-thumbnail');
    if (thumbnail && thumbnail.src && !thumbnail.classList.contains('load-error')) {
        openImageModal(thumbnail.src);
        return; // 处理完毕
    }
    // 可以添加对卡片其他区域点击的逻辑
}


/**
 * 设置与模态框相关的事件监听器。
 */
function setupModalEventListeners() {
    // 编辑属性模态框按钮
    if (DOM.modalSaveButton) {
        DOM.modalSaveButton.removeEventListener('click', saveAttributeChanges);
        DOM.modalSaveButton.addEventListener('click', saveAttributeChanges);
    } else { console.error("Modal: 保存按钮 (modalSaveButton) 未找到。"); }
    if (DOM.modalCancelButton) {
        DOM.modalCancelButton.removeEventListener('click', closeEditModal);
        DOM.modalCancelButton.addEventListener('click', closeEditModal);
    } else { console.error("Modal: 取消按钮 (modalCancelButton) 未找到。"); }
    // 点击模态框背景关闭 (编辑属性)
    if (DOM.editAttributeModal) {
        DOM.editAttributeModal.removeEventListener('click', handleModalOverlayClick);
        DOM.editAttributeModal.addEventListener('click', handleModalOverlayClick);
    } else { console.error("Modal: 编辑模态框 (editAttributeModal) 未找到。"); }

    // 图片放大模态框关闭按钮
    if (DOM.modalCloseButton) {
        DOM.modalCloseButton.removeEventListener('click', closeImageModal);
        DOM.modalCloseButton.addEventListener('click', closeImageModal);
    } else { console.error("Modal: 图片关闭按钮 (modalCloseButton) 未找到。"); }
    // 点击模态框背景关闭 (图片放大)
    if (DOM.imageModalOverlay) {
        DOM.imageModalOverlay.removeEventListener('click', handleImageModalOverlayClick);
        DOM.imageModalOverlay.addEventListener('click', handleImageModalOverlayClick);
    } else { console.error("Modal: 图片放大遮罩 (imageModalOverlay) 未找到。"); }

    // Escape 键关闭模态框
    document.removeEventListener('keydown', handleEscapeKey); // 移除旧监听器
    document.addEventListener('keydown', handleEscapeKey); // 添加新监听器

    console.log("Modal: 事件监听器设置完成。");
}

/**
 * 处理模态框遮罩层点击事件 (仅当点击遮罩本身时关闭)。
 * @param {MouseEvent} event - 点击事件对象。
 */
function handleModalOverlayClick(event) {
    if (event.target === DOM.editAttributeModal) { // 检查点击目标是否为遮罩层本身
        closeEditModal();
    }
}
/**
 * 处理图片放大模态框遮罩层点击事件。
 * @param {MouseEvent} event - 点击事件对象。
 */
function handleImageModalOverlayClick(event) {
    if (event.target === DOM.imageModalOverlay) {
        closeImageModal();
    }
}

/**
 * 处理键盘 Escape 键事件，用于关闭当前活动的模态框。
 * @param {KeyboardEvent} event - 键盘事件对象。
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
 * 更新数据列表面板的条目计数显示。
 */
function updateDataListCount() {
     if (DOM.dataListCountDisplay) {
         // 这个函数现在只更新总数，过滤后的数量由 applyFiltersAndRenderDataList 更新
         // DOM.dataListCountDisplay.textContent = `总计: ${AppState.userData.length} 条`;
         // 或者保持原来的逻辑，显示过滤后的数量
         const count = AppState.dataList.virtualScrollInfo.filteredData?.length ?? 0;
         DOM.dataListCountDisplay.textContent = `当前显示: ${count} 条`;
     }
}

