// ==========================================================================
// 管理 "插件图片管理" 面板的功能
// ==========================================================================
'use strict';

/**
 * 从后端获取所有插件的图片列表。
 * @returns {Promise<boolean>} 数据是否成功加载。
 */
async function fetchPluginImages() {
    console.log("插件图库: 开始获取图片列表...");
    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_PLUGIN_IMAGES);
        AppState.pluginGallery.allImages = Array.isArray(data) ? data : [];
        console.log(`插件图库: 成功加载 ${AppState.pluginGallery.allImages.length} 张插件图片。`);
        AppState.pluginGallery.allImages.forEach(img => {
            if (!img.source) {
                console.warn(`插件图库: 图片 ${img.fileName || img.webPath} 缺少 'source' 属性，设为 'unknown'。`);
                img.source = 'unknown';
            }
        });
        return true;
    } catch (error) {
        console.error("插件图库: 加载图片列表失败:", error);
        displayToast("加载插件图库列表失败", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        AppState.pluginGallery.allImages = [];
        return false;
    }
}

/**
 * 从后端获取插件图片的元数据 (ExternalImageData.json)。
 * @returns {Promise<boolean>} 数据是否成功加载。
 */
async function fetchPluginUserData() {
     console.log("插件图库: 开始获取元数据...");
    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_EXTERNAL_USER_DATA); // API 端点保持 external
        AppState.pluginGallery.savedEntries = Array.isArray(data) ? data : [];
        AppState.pluginGallery.savedPaths = new Set(AppState.pluginGallery.savedEntries.map(e => e.path).filter(Boolean));
        console.log(`插件图库: 成功加载 ${AppState.pluginGallery.savedEntries.length} 条插件元数据。`);
        return true;
    } catch (error) {
        console.error("插件图库: 加载元数据失败:", error);
        displayToast("加载插件元数据失败", UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        AppState.pluginGallery.savedEntries = [];
        AppState.pluginGallery.savedPaths = new Set();
        return false;
    }
}

/**
 * 渲染插件图库的文件夹列表 (左侧面板)。
 */
function renderPluginFolderList() {

    const folderListContainer = DOM.pluginGalleryFolderListContainer;
    const loadingIndicator = DOM.pluginGalleryFolderLoading;
    const noResultsIndicator = DOM.pluginGalleryFolderNoResults;
    const searchInput = DOM.pluginGalleryFolderSearchInput;

    if (!folderListContainer || !loadingIndicator || !noResultsIndicator || !searchInput) {
        console.error("插件图库: 渲染文件夹列表所需的 DOM 元素缺失！(需要 plugin 前缀)");
        return;
    }
    console.log("插件图库: 渲染文件夹列表...");

    loadingIndicator.classList.add(UI_CLASSES.HIDDEN);
    folderListContainer.innerHTML = '';

    const searchTerm = searchInput.value.toLowerCase().trim();
    const currentSourceFilter = AppState.pluginGallery.currentSourceFilter || 'all';

    let imagesToProcess = AppState.pluginGallery.allImages || [];
    if (currentSourceFilter !== 'all') {
        imagesToProcess = imagesToProcess.filter(img => img?.source === currentSourceFilter);
    }

    const folders = imagesToProcess.reduce((acc, img) => {
        if (!img?.folderName) return acc;
        const folderKey = img.folderName;
        if (!acc[folderKey]) {
            acc[folderKey] = { count: 0, source: img.source || 'unknown' };
        }
        if (!searchTerm || folderKey.toLowerCase().includes(searchTerm)) {
            acc[folderKey].count++;
        }
        return acc;
    }, {});

    const filteredFolderNames = Object.keys(folders)
        .filter(name => folders[name].count > 0)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (filteredFolderNames.length > 0) {
        noResultsIndicator.classList.add(UI_CLASSES.HIDDEN);
        const fragment = document.createDocumentFragment();
        filteredFolderNames.forEach(folderName => {
            const folderData = folders[folderName];
            const itemCount = folderData.count;
            const source = folderData.source;
            const sourceText = source.toUpperCase();
            const sourceClass = `source-${source.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

            const item = document.createElement('div');
            item.className = 'plugin-folder-item'; 
            item.dataset.folderName = folderName;

            item.innerHTML = `
                <span class="folder-name-wrapper">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name-text" title="${folderName}">${folderName}</span>
                    <span class="folder-source-tag ${sourceClass}">${sourceText}</span>
                </span>
                <span class="folder-item-count">${itemCount} 图</span>
            `;
            item.onclick = () => handlePluginFolderClick(folderName);

            if (folderName === AppState.pluginGallery.selectedFolder) {
                 item.classList.add(UI_CLASSES.SELECTED);
            }
            fragment.appendChild(item);
        });
        folderListContainer.appendChild(fragment);
    } else {
        let filterText = '';
        if (currentSourceFilter !== 'all') filterText += `在 "${currentSourceFilter.toUpperCase()}" 来源下`;
        if (searchTerm) filterText += `${filterText ? ' 且' : ''}匹配 "${searchTerm}" 的`;
        noResultsIndicator.textContent = `${filterText ? filterText + ' ' : ''}未找到文件夹。`;
        noResultsIndicator.classList.remove(UI_CLASSES.HIDDEN);
    }
    console.log("插件图库: 文件夹列表渲染完成。");
}

/**
 * 处理插件图库文件夹点击事件。
 * @param {string} folderName - 被点击的文件夹名称。
 */
function handlePluginFolderClick(folderName) {
    console.log('文件夹被点击了:', folderName);
    if (folderName === AppState.pluginGallery.selectedFolder) return;

    AppState.pluginGallery.selectedFolder = folderName;
    AppState.pluginGallery.currentPage = 1;
    AppState.pluginGallery.selectedImagePath = null;

    if (DOM.pluginGalleryFolderListContainer) {
         DOM.pluginGalleryFolderListContainer.querySelectorAll('.plugin-folder-item').forEach(item => { 
             item.classList.toggle(UI_CLASSES.SELECTED, item.dataset.folderName === folderName);
         });
    }

    renderPluginImagesForFolder(folderName);
}

/**
 * 渲染指定文件夹的图片网格。
 * @param {string} folderName - 文件夹名称。
 */
function renderPluginImagesForFolder(folderName) {
    const gridPreview = DOM.pluginGalleryImageGridPreview;
    const placeholder = DOM.pluginGalleryPreviewPlaceholder;
    const paginationControls = DOM.pluginGalleryPaginationControls;
    const pageInfo = DOM.pluginGalleryPageInfo;
    const prevBtn = DOM.pluginGalleryPrevPageBtn;
    const nextBtn = DOM.pluginGalleryNextPageBtn;
    const gridContainer = DOM.pluginGalleryImageGridPreviewContainer; // 获取容器

    if (!gridPreview || !placeholder || !paginationControls || !pageInfo || !prevBtn || !nextBtn || !gridContainer) {
        console.error("插件图库: 渲染图片网格或分页的 DOM 元素缺失！(需要 plugin 前缀)");
        return;
    }
    console.log(`插件图库: 渲染文件夹 "${folderName}", 第 ${AppState.pluginGallery.currentPage} 页`);

    placeholder.classList.add(UI_CLASSES.HIDDEN);
    gridPreview.innerHTML = '';
    gridPreview.classList.remove(UI_CLASSES.HIDDEN);
    paginationControls.classList.add(UI_CLASSES.HIDDEN);
    clearPluginEditor();

    const folderAndSourceFiltered = (AppState.pluginGallery.allImages || [])
        .filter(img => img?.folderName === folderName &&
                       (AppState.pluginGallery.currentSourceFilter === 'all' || img.source === AppState.pluginGallery.currentSourceFilter));

    const finalFilteredImages = folderAndSourceFiltered.filter(img =>
        !img.fileName || !img.fileName.toLowerCase().includes('gu')
    );

    const imagesInFolder = finalFilteredImages.sort((a, b) =>
        (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' })
    );
    console.log(`插件图库: 文件夹 "${folderName}" 过滤排序后找到 ${imagesInFolder.length} 张图片`);

    if (imagesInFolder.length === 0) {
        let message = `文件夹 "${folderName}" `;
        if (AppState.pluginGallery.currentSourceFilter !== 'all') message += `在 "${AppState.pluginGallery.currentSourceFilter.toUpperCase()}" 来源下 `;
        message += "且已排除 'Gu' 文件后 ";
        message += "没有符合条件的图片。";
        placeholder.textContent = message;
        placeholder.classList.remove(UI_CLASSES.HIDDEN);
        gridPreview.classList.add(UI_CLASSES.HIDDEN);
        paginationControls.classList.add(UI_CLASSES.HIDDEN);
        clearPluginEditor();
        return;
    }

    const totalItems = imagesInFolder.length;
    const itemsPerPage = PAGINATION.PLUGIN_GALLERY_ITEMS_PER_PAGE;
    AppState.pluginGallery.totalPages = Math.ceil(totalItems / itemsPerPage);
    if (AppState.pluginGallery.currentPage < 1) AppState.pluginGallery.currentPage = 1;
    if (AppState.pluginGallery.currentPage > AppState.pluginGallery.totalPages) AppState.pluginGallery.currentPage = AppState.pluginGallery.totalPages;

    const startIndex = (AppState.pluginGallery.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const imagesToRender = imagesInFolder.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();
    imagesToRender.forEach(imgInfo => {
         if (!imgInfo?.webPath || !imgInfo.fileName) {
              console.warn("插件图库: 跳过无效图片信息:", imgInfo);
              return;
         }
         const container = document.createElement('div');
         container.className = 'plugin-preview-img-container';
         container.dataset.webPath = imgInfo.webPath;

         if (!AppState.pluginGallery.savedPaths.has(imgInfo.webPath)) {
             container.classList.add(UI_CLASSES.NO_METADATA);
             container.title = `${imgInfo.fileName}\n(无元数据)`;
         } else {
             container.title = imgInfo.fileName;
         }

         const img = document.createElement('img');
         img.src = imgInfo.webPath;
         img.alt = imgInfo.fileName;
         img.onerror = function() {
             this.style.display = 'none';
             container.classList.add('load-error');
             container.title += '\n(加载失败)';
         };

         const overlay = document.createElement('div');
         overlay.className = 'filename-overlay';
         overlay.textContent = imgInfo.fileName;
         overlay.title = imgInfo.fileName;

         container.appendChild(img);
         container.appendChild(overlay);
         container.onclick = () => handlePluginImageClick(imgInfo.webPath, container);

         if (imgInfo.webPath === AppState.pluginGallery.selectedImagePath) {
             container.classList.add(UI_CLASSES.SELECTED);
         }
         fragment.appendChild(container);
    });
    gridPreview.appendChild(fragment);

    if (AppState.pluginGallery.totalPages > 1) {
         pageInfo.textContent = `第 ${AppState.pluginGallery.currentPage} / ${AppState.pluginGallery.totalPages} 页`;
         prevBtn.disabled = (AppState.pluginGallery.currentPage <= 1);
         nextBtn.disabled = (AppState.pluginGallery.currentPage >= AppState.pluginGallery.totalPages);
         paginationControls.classList.remove(UI_CLASSES.HIDDEN);
    } else {
         paginationControls.classList.add(UI_CLASSES.HIDDEN);
    }

    if (gridContainer) gridContainer.scrollTop = 0; // 使用缓存的容器引用
    console.log("插件图库: 图片网格渲染完成。");
}


/**
 * 处理插件图库图片点击事件 (仅高亮)。
 * @param {string} webPath - 图片 Web 路径。
 * @param {HTMLElement} clickedContainer - 被点击的容器元素。
 */
function handlePluginImageClick(webPath, clickedContainer) {
    console.log("插件图库: 点击图片预览:", webPath);
    AppState.pluginGallery.selectedImagePath = webPath;

    if (DOM.pluginGalleryImageGridPreview) { 
        const previouslySelected = DOM.pluginGalleryImageGridPreview.querySelector('.plugin-preview-img-container.selected'); // 使用新类名
        if (previouslySelected) {
            previouslySelected.classList.remove(UI_CLASSES.SELECTED);
        }
        if (clickedContainer) {
            clickedContainer.classList.add(UI_CLASSES.SELECTED);
        }
    }
}

/**
 * 清空右侧编辑器面板。
 */
function clearPluginEditor() {
    console.log("插件图库: 清理右侧编辑器...");
    AppState.pluginGallery.selectedImagePath = null;

    const attributeArea = DOM.pluginGalleryAttributeInfoArea;
    const placeholder = DOM.pluginGalleryEditorPlaceholder;

    if (attributeArea && placeholder) {
        const contentToRemove = attributeArea.querySelector('.plugin-editor-content'); // 假设有这个类
        if (contentToRemove) attributeArea.removeChild(contentToRemove);
        placeholder.classList.remove(UI_CLASSES.HIDDEN);
        attributeArea.classList.remove(UI_CLASSES.HIDDEN);
    }

    if (DOM.pluginGalleryImageGridPreview) {
         const currentlySelectedImg = DOM.pluginGalleryImageGridPreview.querySelector('.plugin-preview-img-container.selected'); // 使用新类名
         if (currentlySelectedImg) {
             currentlySelectedImg.classList.remove(UI_CLASSES.SELECTED);
         }
     }
}

/**
 * 处理来源过滤器按钮点击。
 * @param {string} selectedSource - 选择的来源标识。
 */
function handlePluginSourceFilterClick(selectedSource) {
    const filterButtons = DOM.pluginGallerySourceFilterButtons; 
    if (!filterButtons || filterButtons.length === 0 || AppState.pluginGallery.currentSourceFilter === selectedSource) return;

    console.log("插件图库: 来源过滤器更改为:", selectedSource);
    AppState.pluginGallery.currentSourceFilter = selectedSource;

    filterButtons.forEach(btn => {
        btn.classList.toggle(UI_CLASSES.ACTIVE, btn.dataset.source === selectedSource);
    });

    AppState.pluginGallery.selectedFolder = null;
    AppState.pluginGallery.currentPage = 1;

    if (DOM.pluginGalleryImageGridPreview) DOM.pluginGalleryImageGridPreview.innerHTML = '';
    if (DOM.pluginGalleryImageGridPreview) DOM.pluginGalleryImageGridPreview.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.pluginGalleryPreviewPlaceholder) {
        DOM.pluginGalleryPreviewPlaceholder.textContent = "请从左侧选择一个文件夹以查看图片";
        DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
    }
    if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);
    clearPluginEditor();
    renderPluginFolderList();
}

/**
 * 处理文件夹搜索输入 (防抖)。
 */
function handlePluginFolderSearch() {
    clearTimeout(AppState.pluginGallery.searchDebounceTimer);
    AppState.pluginGallery.searchDebounceTimer = setTimeout(() => {
         console.log("插件图库: 执行文件夹搜索:", DOM.pluginGalleryFolderSearchInput.value); 
         AppState.pluginGallery.selectedFolder = null;
         AppState.pluginGallery.currentPage = 1;
         if (DOM.pluginGalleryImageGridPreview) { DOM.pluginGalleryImageGridPreview.innerHTML = ''; DOM.pluginGalleryImageGridPreview.classList.add(UI_CLASSES.HIDDEN); }
         if (DOM.pluginGalleryPreviewPlaceholder) DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
         if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);
         clearPluginEditor();
         renderPluginFolderList();
    }, DELAYS.PLUGIN_GALLERY_SEARCH_DEBOUNCE);
}

/** 处理上一页点击。 */
function handlePluginPrevPage() {
    if (AppState.pluginGallery.currentPage > 1 && AppState.pluginGallery.selectedFolder) {
        AppState.pluginGallery.currentPage--;
        renderPluginImagesForFolder(AppState.pluginGallery.selectedFolder);
    }
}

/** 处理下一页点击。 */
function handlePluginNextPage() {
    if (AppState.pluginGallery.currentPage < AppState.pluginGallery.totalPages && AppState.pluginGallery.selectedFolder) {
        AppState.pluginGallery.currentPage++;
        renderPluginImagesForFolder(AppState.pluginGallery.selectedFolder);
    }
}

// --------------------------------------------------------------------------
// 事件监听器设置
// --------------------------------------------------------------------------
/**
 * 设置插件图片管理面板的事件监听器。
 */
function setupPluginGalleryEventListeners() {
    const searchInput = DOM.pluginGalleryFolderSearchInput;
    const sourceButtons = DOM.pluginGallerySourceFilterButtons;
    const prevBtn = DOM.pluginGalleryPrevPageBtn;
    const nextBtn = DOM.pluginGalleryNextPageBtn;
    const folderListContainer = DOM.pluginGalleryFolderListContainer;

    if (searchInput) {
        searchInput.removeEventListener('input', handlePluginFolderSearch);
        searchInput.addEventListener('input', handlePluginFolderSearch);
    } else { console.error("插件图库: 文件夹搜索框未找到。"); }

    if (sourceButtons && sourceButtons.length > 0) {
        sourceButtons.forEach(button => {
            const source = button.dataset.source;
            if (source) {
                // 使用匿名函数包装，避免每次移除监听器的问题
                button.addEventListener('click', () => handlePluginSourceFilterClick(source));
            } else { console.warn("插件图库: 来源过滤按钮缺少 data-source:", button); }
        });
    } else { console.error("插件图库: 来源过滤按钮未找到。"); }

    if (prevBtn) {
        prevBtn.removeEventListener('click', handlePluginPrevPage);
        prevBtn.addEventListener('click', handlePluginPrevPage);
    } else { console.error("插件图库: 上一页按钮未找到。"); }
    if (nextBtn) {
        nextBtn.removeEventListener('click', handlePluginNextPage);
        nextBtn.addEventListener('click', handlePluginNextPage);
    } else { console.error("插件图库: 下一页按钮未找到。"); }

    // 文件夹列表点击事件 - 改为事件委托
    if (folderListContainer) {
         folderListContainer.removeEventListener('click', handleFolderListClick); // 移除旧监听器
         folderListContainer.addEventListener('click', handleFolderListClick); // 添加新监听器
    } else { console.error("插件图库: 文件夹列表容器未找到，无法绑定委托事件。") }

    console.log("插件图库: 事件监听器设置完成。");
}

/**
 * 处理文件夹列表的点击事件 (事件委托)。
 * @param {MouseEvent} event - 点击事件对象。
 */
function handleFolderListClick(event) {
    // 向上查找被点击的列表项元素
    const clickedItem = event.target.closest('.plugin-folder-item'); 
    if (clickedItem && clickedItem.dataset.folderName) {
        // 调用处理函数
        handlePluginFolderClick(clickedItem.dataset.folderName);
    }
}