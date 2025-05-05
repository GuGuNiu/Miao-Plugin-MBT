// ==========================================================================
// 插件图片管理: 管理 "插件图片管理" 面板的功能
// ==========================================================================

/**
 * 从后端获取所有插件的图片列表
 * @returns {Promise<boolean>} 数据是否成功加载
 */
async function fetchPluginImages() {
    console.log("插件图库: 开始获取图片列表...");
    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_PLUGIN_IMAGES);
        AppState.pluginGallery.allImages = Array.isArray(data) ? data : [];
        console.log(`插件图库: 成功加载 ${AppState.pluginGallery.allImages.length} 张插件图片`);
        // 确保所有图片都有 source 属性
        AppState.pluginGallery.allImages.forEach(img => {
            if (!img.source) {
                console.warn(`插件图库: 图片 ${img.fileName || img.webPath} 缺少 'source' 属性 设为 'unknown'`);
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
 * 从后端获取插件图片的元数据 ExternalImageData.json
 * @returns {Promise<boolean>} 数据是否成功加载
 */
async function fetchPluginUserData() {
     console.log("插件图库: 开始获取元数据...");
    try {
        const data = await fetchJsonData(API_ENDPOINTS.FETCH_EXTERNAL_USER_DATA);
        AppState.pluginGallery.savedEntries = Array.isArray(data) ? data : [];
        AppState.pluginGallery.savedPaths = new Set(AppState.pluginGallery.savedEntries.map(e => e.path).filter(Boolean));
        console.log(`插件图库: 成功加载 ${AppState.pluginGallery.savedEntries.length} 条插件元数据`);
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
 * 渲染插件图库的文件夹列表 左侧面板
 */
function renderPluginFolderList() {

    const folderListContainer = DOM.pluginGalleryFolderListContainer;
    const loadingIndicator = DOM.pluginGalleryFolderLoading;
    const noResultsIndicator = DOM.pluginGalleryFolderNoResults;
    const searchInput = DOM.pluginGalleryFolderSearchInput;

    if (!folderListContainer || !loadingIndicator || !noResultsIndicator || !searchInput) {
        console.error("插件图库: 渲染文件夹列表所需的 DOM 元素缺失！");
        return;
    }
    console.log("插件图库: 渲染文件夹列表...");

    loadingIndicator.classList.add(UI_CLASSES.HIDDEN);
    folderListContainer.innerHTML = '';

    const searchTerm = searchInput.value.toLowerCase().trim();
    const currentSourceFilter = AppState.pluginGallery.currentSourceFilter || 'all';

    // 根据来源过滤器筛选图片
    let imagesToProcess = AppState.pluginGallery.allImages || [];
    if (currentSourceFilter !== 'all') {
        imagesToProcess = imagesToProcess.filter(img => img?.source === currentSourceFilter);
    }

    // 聚合文件夹信息
    const folders = imagesToProcess.reduce((acc, img) => {
        if (!img?.folderName) return acc;
        const folderKey = img.folderName;
        if (!acc[folderKey]) {
            acc[folderKey] = { count: 0, source: img.source || 'unknown' };
        }
        // 根据搜索词过滤文件夹
        if (!searchTerm || folderKey.toLowerCase().includes(searchTerm)) {
            acc[folderKey].count++;
        }
        return acc;
    }, {});

    // 获取符合条件的文件夹名称并排序
    const filteredFolderNames = Object.keys(folders)
        .filter(name => folders[name].count > 0) // 只显示包含图片的文件夹
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (filteredFolderNames.length > 0) {
        noResultsIndicator.classList.add(UI_CLASSES.HIDDEN);
        const fragment = document.createDocumentFragment();
        filteredFolderNames.forEach(folderName => {
            const folderData = folders[folderName];
            const itemCount = folderData.count;
            const source = folderData.source;
            const sourceText = source.toUpperCase();
            // 生成基于来源的 CSS 类名
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

            // 如果是当前选中的文件夹 添加选中样式
            if (folderName === AppState.pluginGallery.selectedFolder) {
                 item.classList.add(UI_CLASSES.SELECTED);
            }
            fragment.appendChild(item);
        });
        folderListContainer.appendChild(fragment);
    } else {
        // 显示无结果提示
        let filterText = '';
        if (currentSourceFilter !== 'all') filterText += `在 "${currentSourceFilter.toUpperCase()}" 来源下`;
        if (searchTerm) filterText += `${filterText ? ' 且' : ''}匹配 "${searchTerm}" 的`;
        noResultsIndicator.textContent = `${filterText ? filterText + ' ' : ''}未找到文件夹`;
        noResultsIndicator.classList.remove(UI_CLASSES.HIDDEN);
    }
    console.log("插件图库: 文件夹列表渲染完成");
}

/**
 * 处理插件图库文件夹点击事件
 * @param {string} folderName 被点击的文件夹名称
 */
function handlePluginFolderClick(folderName) {
    console.log('插件图库: 文件夹被点击:', folderName);
    if (folderName === AppState.pluginGallery.selectedFolder) return; // 点击的是当前已选中的文件夹

    AppState.pluginGallery.selectedFolder = folderName;
    AppState.pluginGallery.currentPage = 1; // 重置到第一页
    AppState.pluginGallery.selectedImagePath = null; // 清除图片选中状态

    // 更新文件夹列表的选中样式
    if (DOM.pluginGalleryFolderListContainer) {
         DOM.pluginGalleryFolderListContainer.querySelectorAll('.plugin-folder-item').forEach(item => {
             item.classList.toggle(UI_CLASSES.SELECTED, item.dataset.folderName === folderName);
         });
    }

    // 渲染该文件夹的图片
    renderPluginImagesForFolder(folderName);
}

/**
 * 渲染指定文件夹的图片网格
 * @param {string} folderName 文件夹名称
 */
function renderPluginImagesForFolder(folderName) {
    const gridPreview = DOM.pluginGalleryImageGrid; // 使用缓存的 DOM 引用
    const placeholder = DOM.pluginGalleryPreviewPlaceholder;
    const paginationControls = DOM.pluginGalleryPaginationControls;
    const pageInfo = DOM.pluginGalleryPageInfo;
    const prevBtn = DOM.pluginGalleryPrevPageBtn;
    const nextBtn = DOM.pluginGalleryNextPageBtn;
    const gridContainer = DOM.pluginGalleryImageGridContainer;

    if (!gridPreview || !placeholder || !paginationControls || !pageInfo || !prevBtn || !nextBtn || !gridContainer) {
        console.error("插件图库: 渲染图片网格或分页的 DOM 元素缺失！");
        return;
    }
    console.log(`插件图库: 渲染文件夹 "${folderName}", 第 ${AppState.pluginGallery.currentPage} 页`);

    placeholder.classList.add(UI_CLASSES.HIDDEN); // 隐藏占位符
    gridPreview.innerHTML = ''; // 清空旧图片
    gridPreview.classList.remove(UI_CLASSES.HIDDEN); // 显示网格
    paginationControls.classList.add(UI_CLASSES.HIDDEN); // 默认隐藏分页
    clearPluginEditor(); // 清空右侧编辑器

    // 筛选出属于该文件夹 且符合当前来源过滤器的图片
    const folderAndSourceFiltered = (AppState.pluginGallery.allImages || [])
        .filter(img => img?.folderName === folderName &&
                       (AppState.pluginGallery.currentSourceFilter === 'all' || img.source === AppState.pluginGallery.currentSourceFilter));

    // 再次过滤 排除文件名包含 'gu' 的图片
    const finalFilteredImages = folderAndSourceFiltered.filter(img =>
        !img.fileName || !img.fileName.toLowerCase().includes('gu')
    );

    // 按文件名排序
    const imagesInFolder = finalFilteredImages.sort((a, b) =>
        (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' })
    );
    console.log(`插件图库: 文件夹 "${folderName}" 过滤排序后找到 ${imagesInFolder.length} 张图片`);

    if (imagesInFolder.length === 0) {
        // 显示无图片提示
        let message = `文件夹 "${folderName}" `;
        if (AppState.pluginGallery.currentSourceFilter !== 'all') message += `在 "${AppState.pluginGallery.currentSourceFilter.toUpperCase()}" 来源下 `;
        message += "且已排除 'Gu' 文件后 ";
        message += "没有符合条件的图片";
        placeholder.textContent = message;
        placeholder.classList.remove(UI_CLASSES.HIDDEN);
        gridPreview.classList.add(UI_CLASSES.HIDDEN);
        paginationControls.classList.add(UI_CLASSES.HIDDEN);
        clearPluginEditor();
        return;
    }

    // --- 处理分页 ---
    const totalItems = imagesInFolder.length;
    const itemsPerPage = PAGINATION.PLUGIN_GALLERY_ITEMS_PER_PAGE;
    AppState.pluginGallery.totalPages = Math.ceil(totalItems / itemsPerPage);
    // 修正当前页码范围
    if (AppState.pluginGallery.currentPage < 1) AppState.pluginGallery.currentPage = 1;
    if (AppState.pluginGallery.currentPage > AppState.pluginGallery.totalPages) AppState.pluginGallery.currentPage = AppState.pluginGallery.totalPages;

    const startIndex = (AppState.pluginGallery.currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const imagesToRender = imagesInFolder.slice(startIndex, endIndex); // 获取当前页要渲染的图片

    // --- 渲染图片项 ---
    const fragment = document.createDocumentFragment();
    imagesToRender.forEach(imgInfo => {
         if (!imgInfo?.webPath || !imgInfo.fileName) {
              console.warn("插件图库: 跳过无效图片信息:", imgInfo);
              return;
         }
         const container = document.createElement('div');
         container.className = 'plugin-preview-img-container';
         container.dataset.webPath = imgInfo.webPath; // 存储 Web 路径

         // 检查是否有元数据 决定是否添加 'no-metadata' 样式
         if (!AppState.pluginGallery.savedPaths.has(imgInfo.webPath)) {
             container.classList.add(UI_CLASSES.NO_METADATA);
             container.title = `${imgInfo.fileName}\n(无元数据)`;
         } else {
             container.title = imgInfo.fileName;
         }

         const img = document.createElement('img');
         img.src = imgInfo.webPath; // 设置图片源
         img.alt = imgInfo.fileName;
         img.onerror = function() { // 处理加载失败
             this.style.display = 'none';
             container.classList.add('load-error');
             container.title += '\n(加载失败)';
         };

         // 文件名遮罩层
         const overlay = document.createElement('div');
         overlay.className = 'filename-overlay';
         overlay.textContent = imgInfo.fileName;
         overlay.title = imgInfo.fileName;

         container.appendChild(img);
         container.appendChild(overlay);
         // 点击图片容器的处理
         container.onclick = () => handlePluginImageClick(imgInfo.webPath, container);

         // 如果是当前选中的图片 添加选中样式
         if (imgInfo.webPath === AppState.pluginGallery.selectedImagePath) {
             container.classList.add(UI_CLASSES.SELECTED);
         }
         fragment.appendChild(container);
    });
    gridPreview.appendChild(fragment); // 添加到网格

    // --- 更新分页控件 ---
    if (AppState.pluginGallery.totalPages > 1) {
         pageInfo.textContent = `第 ${AppState.pluginGallery.currentPage} / ${AppState.pluginGallery.totalPages} 页`;
         prevBtn.disabled = (AppState.pluginGallery.currentPage <= 1);
         nextBtn.disabled = (AppState.pluginGallery.currentPage >= AppState.pluginGallery.totalPages);
         paginationControls.classList.remove(UI_CLASSES.HIDDEN); // 显示分页
    } else {
         paginationControls.classList.add(UI_CLASSES.HIDDEN); // 只有一页或没有则隐藏
    }

    // 滚动到网格顶部
    if (gridContainer) gridContainer.scrollTop = 0;
    console.log("插件图库: 图片网格渲染完成");
}


/**
 * 处理插件图库图片点击事件 仅高亮
 * @param {string} webPath 图片 Web 路径
 * @param {HTMLElement} clickedContainer 被点击的容器元素
 */
function handlePluginImageClick(webPath, clickedContainer) {
    console.log("插件图库: 点击图片预览:", webPath);
    AppState.pluginGallery.selectedImagePath = webPath; // 更新选中状态

    // 更新图片网格中的选中样式
    if (DOM.pluginGalleryImageGrid) {
        // 移除之前选中的样式
        const previouslySelected = DOM.pluginGalleryImageGrid.querySelector('.plugin-preview-img-container.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove(UI_CLASSES.SELECTED);
        }
        // 为当前点击的项添加选中样式
        if (clickedContainer) {
            clickedContainer.classList.add(UI_CLASSES.SELECTED);
        }
    }
    // TODO: 在这里可以触发加载右侧编辑器内容的逻辑
}

/**
 * 清空右侧编辑器面板
 */
function clearPluginEditor() {
    console.log("插件图库: 清理右侧编辑器...");
    AppState.pluginGallery.selectedImagePath = null; // 清除图片选中状态

    const attributeArea = DOM.pluginGalleryAttributeInfoArea;
    const placeholder = DOM.pluginGalleryEditorPlaceholder;

    if (attributeArea && placeholder) {
        // 查找并移除实际的编辑器内容元素
        const contentToRemove = attributeArea.querySelector('.plugin-editor-content');
        if (contentToRemove) attributeArea.removeChild(contentToRemove);
        // 显示占位符
        placeholder.classList.remove(UI_CLASSES.HIDDEN);
        attributeArea.classList.remove(UI_CLASSES.HIDDEN); // 确保属性区域本身可见
    }

    // 移除网格中图片的选中高亮
    if (DOM.pluginGalleryImageGrid) {
         const currentlySelectedImg = DOM.pluginGalleryImageGrid.querySelector('.plugin-preview-img-container.selected');
         if (currentlySelectedImg) {
             currentlySelectedImg.classList.remove(UI_CLASSES.SELECTED);
         }
     }
}

/**
 * 处理来源过滤器按钮点击
 * @param {string} selectedSource 选择的来源标识
 */
function handlePluginSourceFilterClick(selectedSource) {
    const filterButtons = DOM.pluginGallerySourceFilterButtons;
    if (!filterButtons || filterButtons.length === 0 || AppState.pluginGallery.currentSourceFilter === selectedSource) return;

    console.log("插件图库: 来源过滤器更改为:", selectedSource);
    AppState.pluginGallery.currentSourceFilter = selectedSource; // 更新状态

    // 更新按钮激活状态
    filterButtons.forEach(btn => {
        btn.classList.toggle(UI_CLASSES.ACTIVE, btn.dataset.source === selectedSource);
    });

    // 重置文件夹和图片显示状态
    AppState.pluginGallery.selectedFolder = null;
    AppState.pluginGallery.currentPage = 1;

    if (DOM.pluginGalleryImageGrid) DOM.pluginGalleryImageGrid.innerHTML = '';
    if (DOM.pluginGalleryImageGrid) DOM.pluginGalleryImageGrid.classList.add(UI_CLASSES.HIDDEN);
    if (DOM.pluginGalleryPreviewPlaceholder) {
        DOM.pluginGalleryPreviewPlaceholder.textContent = "请从左侧选择一个文件夹以查看图片";
        DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
    }
    if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);
    clearPluginEditor(); // 清空编辑器
    renderPluginFolderList(); // 重新渲染文件夹列表
}

/**
 * 处理文件夹搜索输入 防抖
 */
function handlePluginFolderSearch() {
    clearTimeout(AppState.pluginGallery.searchDebounceTimer); // 清除旧计时器
    AppState.pluginGallery.searchDebounceTimer = setTimeout(() => {
         console.log("插件图库: 执行文件夹搜索:", DOM.pluginGalleryFolderSearchInput.value);
         // 重置状态
         AppState.pluginGallery.selectedFolder = null;
         AppState.pluginGallery.currentPage = 1;
         // 重置 UI
         if (DOM.pluginGalleryImageGrid) { DOM.pluginGalleryImageGrid.innerHTML = ''; DOM.pluginGalleryImageGrid.classList.add(UI_CLASSES.HIDDEN); }
         if (DOM.pluginGalleryPreviewPlaceholder) DOM.pluginGalleryPreviewPlaceholder.classList.remove(UI_CLASSES.HIDDEN);
         if (DOM.pluginGalleryPaginationControls) DOM.pluginGalleryPaginationControls.classList.add(UI_CLASSES.HIDDEN);
         clearPluginEditor();
         renderPluginFolderList(); // 重新渲染文件夹列表
    }, DELAYS.PLUGIN_GALLERY_SEARCH_DEBOUNCE); // 使用防抖延迟
}

/** 处理上一页点击 */
function handlePluginPrevPage() {
    if (AppState.pluginGallery.currentPage > 1 && AppState.pluginGallery.selectedFolder) {
        AppState.pluginGallery.currentPage--;
        renderPluginImagesForFolder(AppState.pluginGallery.selectedFolder); // 重新渲染图片
    }
}

/** 处理下一页点击 */
function handlePluginNextPage() {
    if (AppState.pluginGallery.currentPage < AppState.pluginGallery.totalPages && AppState.pluginGallery.selectedFolder) {
        AppState.pluginGallery.currentPage++;
        renderPluginImagesForFolder(AppState.pluginGallery.selectedFolder); // 重新渲染图片
    }
}

// --- 事件监听器设置 ---
/**
 * 设置插件图片管理面板的事件监听器
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
    } else { console.error("插件图库: 文件夹搜索框未找到"); }

    if (sourceButtons && sourceButtons.length > 0) {
        sourceButtons.forEach(button => {
            const source = button.dataset.source;
            if (source) {
                // 使用匿名函数包装 避免移除监听器的问题
                button.addEventListener('click', () => handlePluginSourceFilterClick(source));
            } else { console.warn("插件图库: 来源过滤按钮缺少 data-source:", button); }
        });
    } else { console.error("插件图库: 来源过滤按钮未找到"); }

    if (prevBtn) {
        prevBtn.removeEventListener('click', handlePluginPrevPage);
        prevBtn.addEventListener('click', handlePluginPrevPage);
    } else { console.error("插件图库: 上一页按钮未找到"); }
    if (nextBtn) {
        nextBtn.removeEventListener('click', handlePluginNextPage);
        nextBtn.addEventListener('click', handlePluginNextPage);
    } else { console.error("插件图库: 下一页按钮未找到"); }

    // 文件夹列表点击事件 使用事件委托
    if (folderListContainer) {
         folderListContainer.removeEventListener('click', handleFolderListClick);
         folderListContainer.addEventListener('click', handleFolderListClick);
    } else { console.error("插件图库: 文件夹列表容器未找到 无法绑定委托事件") }

    console.log("插件图库: 事件监听器设置完成");
}

/**
 * 处理文件夹列表的点击事件 事件委托
 * @param {MouseEvent} event 点击事件对象
 */
function handleFolderListClick(event) {
    // 向上查找被点击的列表项元素
    const clickedItem = event.target.closest('.plugin-folder-item');
    if (clickedItem && clickedItem.dataset.folderName) {
        // 调用处理函数
        handlePluginFolderClick(clickedItem.dataset.folderName);
    }
}