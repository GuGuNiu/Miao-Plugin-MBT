// ==========================================================================
// GuTools 文件大小核查: 显示图库文件大小并提供筛选功能
// ==========================================================================

/**
 * 初始化文件大小核查视图
 */
async function initializeFileSizeView() {
    populateGameFilter();
    populateStorageBoxSelect(DOM.fsStorageBoxFilter, true);

    if (AppState.fileSizeChecker.dataLoaded) {
        return;
    }
    console.log("FileSizeChecker: 首次进入 正在加载文件数据...");
    if (DOM.fsStatusText) DOM.fsStatusText.textContent = '正在加载文件数据...';
    if (DOM.fsApplyFilterBtn) DOM.fsApplyFilterBtn.disabled = true;

    try {
        const fileData = await fetchJsonData(API_ENDPOINTS.FETCH_FILE_SIZES);
        if (!Array.isArray(fileData)) {
            throw new Error("获取的文件数据格式不正确");
        }
        AppState.fileSizeChecker.allFiles = fileData;
        AppState.fileSizeChecker.dataLoaded = true;
        console.log(`FileSizeChecker: 成功加载 ${fileData.length} 个文件的信息`);
        if (DOM.fsStatusText) DOM.fsStatusText.textContent = `加载完成 共 ${fileData.length} 个文件`;
        if (DOM.fsApplyFilterBtn) DOM.fsApplyFilterBtn.disabled = false;
        
        if (DOM.fsResultsGrid) {
            DOM.fsResultsGrid.innerHTML = '<p class="list-placeholder">点击“应用筛选”按钮开始</p>';
        }

    } catch (error) {
        console.error("FileSizeChecker: 加载文件数据失败:", error);
        if (DOM.fsStatusText) DOM.fsStatusText.textContent = `加载失败: ${error.message}`;
        displayToast("加载文件数据失败", UI_CLASSES.ERROR);
    }
}

/**
 * 填充游戏筛选下拉框
 */
function populateGameFilter() {
    if (!DOM.fsGameFilter) return;
    DOM.fsGameFilter.innerHTML = `
        <option value="">——所有游戏——</option>
        <option value="gs-character">原神</option>
        <option value="sr-character">星铁</option>
        <option value="zzz-character">绝区零</option>
        <option value="waves-character">鸣潮</option>
    `;
}

/**
 * 格式化字节为可读大小 (KB/MB)
 * @param {number} bytes 文件字节大小
 * @returns {string} 格式化后的字符串
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return `${size} ${sizes[i]}`;
}

/**
 * 应用筛选并渲染结果
 */
function applyFileSizeFilter() {
    if (!AppState.fileSizeChecker.dataLoaded) {
        if (DOM.fsStatusText) DOM.fsStatusText.textContent = '请先等待数据加载完成';
        return;
    }
    const requiredElements = [
        DOM.fsMinSizeInput, DOM.fsMaxSizeInput, DOM.fsUnitSelector,
        DOM.fsResultsGrid, DOM.fsStatusText, DOM.fsGameFilter, DOM.fsStorageBoxFilter
    ];
    if (requiredElements.some(el => !el)) {
        console.error("FileSizeChecker: 筛选所需的 DOM 元素缺失！");
        return;
    }

    const unit = DOM.fsUnitSelector.value;
    const multiplier = unit === 'KB' ? 1024 : 1024 * 1024;

    const minSize = parseFloat(DOM.fsMinSizeInput.value) || 0;
    const maxSize = parseFloat(DOM.fsMaxSizeInput.value) || Infinity;

    const minBytes = minSize * multiplier;
    const maxBytes = maxSize === Infinity ? Infinity : maxSize * multiplier;

    const selectedGame = DOM.fsGameFilter.value;
    const selectedBox = DOM.fsStorageBoxFilter.value;

    const filteredFiles = AppState.fileSizeChecker.allFiles.filter(file => {
        const sizeMatch = file.sizeInBytes >= minBytes && file.sizeInBytes <= maxBytes;
        if (!sizeMatch) return false;

        if (selectedGame) {
            const gameName = file.urlPath.split('/')[0];
            if (gameName !== selectedGame) return false;
        }

        if (selectedBox) {
            if (file.storageBox !== selectedBox) return false;
        }

        return true;
    });

    AppState.fileSizeChecker.filteredFiles = filteredFiles;
    AppState.fileSizeChecker.currentPage = 1;
    AppState.fileSizeChecker.totalPages = Math.ceil(filteredFiles.length / PAGINATION.FILE_SIZE_ITEMS_PER_PAGE);

    renderCurrentFileSizePage();
    DOM.fsStatusText.textContent = `共 ${AppState.fileSizeChecker.allFiles.length} 文件 显示 ${filteredFiles.length} 个`;
}

/**
 * 渲染文件大小核查的当前页结果
 */
function renderCurrentFileSizePage() {
    if (!DOM.fsResultsGrid) return;
    const grid = DOM.fsResultsGrid;
    grid.innerHTML = '';

    const { filteredFiles, currentPage, totalPages } = AppState.fileSizeChecker;
    const itemsPerPage = PAGINATION.FILE_SIZE_ITEMS_PER_PAGE;
    
    if (filteredFiles.length === 0) {
        grid.innerHTML = '<p class="list-placeholder">没有符合条件的文件</p>';
        if(DOM.fsPaginationControls) DOM.fsPaginationControls.classList.add(UI_CLASSES.HIDDEN);
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const filesToRender = filteredFiles.slice(startIndex, endIndex);

    const fragment = document.createDocumentFragment();
    filesToRender.forEach(file => {
        const card = document.createElement('div');
        card.className = 'fs-item-card';

        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'fs-item-thumbnail-container';

        const thumb = document.createElement('img');
        thumb.className = 'fs-item-thumbnail';
        thumb.loading = 'lazy';
        const imagePath = buildFullWebPath(file.storageBox, file.urlPath);
        thumb.src = imagePath;
        thumb.alt = file.fileName;
        thumb.title = `${file.storageBox}/${file.folderName}/${file.fileName}`;

        thumbContainer.appendChild(thumb);

        const info = document.createElement('div');
        info.className = 'fs-item-info';
        
        const infoLeft = document.createElement('div');
        infoLeft.className = 'fs-info-left';

        const filenameSpan = document.createElement('div');
        filenameSpan.className = 'fs-item-filename';
        filenameSpan.textContent = file.fileName;
        filenameSpan.title = file.fileName;

        const sizeSpan = document.createElement('div');
        sizeSpan.className = 'fs-item-size';
        sizeSpan.textContent = formatBytes(file.sizeInBytes);

        infoLeft.appendChild(filenameSpan);
        infoLeft.appendChild(sizeSpan);
        
        const repoNumberSpan = document.createElement('div');
        repoNumberSpan.className = 'fs-item-repo-number';
        repoNumberSpan.textContent = file.repoNumber || '?';
        repoNumberSpan.title = `仓库: ${file.storageBox}`;

        info.appendChild(infoLeft);
        info.appendChild(repoNumberSpan);
        card.appendChild(thumbContainer);
        card.appendChild(info);
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);

    updatePaginationUI();
}

/**
 * 更新分页控件的UI
 */
function updatePaginationUI() {
    const { currentPage, totalPages } = AppState.fileSizeChecker;
    const { fsPaginationControls, fsPageInfo, fsPrevPageBtn, fsNextPageBtn } = DOM;

    if (!fsPaginationControls || !fsPageInfo || !fsPrevPageBtn || !fsNextPageBtn) return;

    if (totalPages > 1) {
        fsPageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
        fsPrevPageBtn.disabled = currentPage <= 1;
        fsNextPageBtn.disabled = currentPage >= totalPages;
        fsPaginationControls.classList.remove(UI_CLASSES.HIDDEN);
    } else {
        fsPaginationControls.classList.add(UI_CLASSES.HIDDEN);
    }
}

/**
 * 处理上一页点击
 */
function handleFsPrevPage() {
    if (AppState.fileSizeChecker.currentPage > 1) {
        AppState.fileSizeChecker.currentPage--;
        renderCurrentFileSizePage();
    }
}

/**
 * 处理下一页点击
 */
function handleFsNextPage() {
    if (AppState.fileSizeChecker.currentPage < AppState.fileSizeChecker.totalPages) {
        AppState.fileSizeChecker.currentPage++;
        renderCurrentFileSizePage();
    }
}

/**
 * 重置筛选条件并显示所有文件
 */
function resetFileSizeFilter() {
    const inputs = [
        DOM.fsMinSizeInput, DOM.fsMaxSizeInput, DOM.fsGameFilter, DOM.fsStorageBoxFilter
    ];
    if (inputs.some(el => !el)) return;
    
    DOM.fsMinSizeInput.value = '';
    DOM.fsMaxSizeInput.value = '';
    DOM.fsUnitSelector.value = 'MB';
    DOM.fsGameFilter.value = '';
    DOM.fsStorageBoxFilter.value = '';
    
    AppState.fileSizeChecker.filteredFiles = [];
    AppState.fileSizeChecker.currentPage = 1;
    AppState.fileSizeChecker.totalPages = 1;
    
    if (DOM.fsResultsGrid) {
        DOM.fsResultsGrid.innerHTML = '<p class="list-placeholder">点击“应用筛选”按钮开始</p>';
    }
    if (DOM.fsPaginationControls) {
        DOM.fsPaginationControls.classList.add(UI_CLASSES.HIDDEN);
    }
    if(DOM.fsStatusText && AppState.fileSizeChecker.dataLoaded) {
        DOM.fsStatusText.textContent = `加载完成 共 ${AppState.fileSizeChecker.allFiles.length} 个文件`;
    }
}

/**
 * 设置文件大小核查视图的事件监听器
 */
function setupFileSizeCheckerEventListeners() {
    if (DOM.fsApplyFilterBtn) {
        DOM.fsApplyFilterBtn.removeEventListener('click', applyFileSizeFilter);
        DOM.fsApplyFilterBtn.addEventListener('click', applyFileSizeFilter);
    }
    if (DOM.fsResetFilterBtn) {
        DOM.fsResetFilterBtn.removeEventListener('click', resetFileSizeFilter);
        DOM.fsResetFilterBtn.addEventListener('click', resetFileSizeFilter);
    }
    const inputs = [DOM.fsMinSizeInput, DOM.fsMaxSizeInput];
    inputs.forEach(input => {
        if (input) {
            const handler = (e) => { if (e.key === 'Enter') applyFileSizeFilter(); };
            input.removeEventListener('keydown', handler);
            input.addEventListener('keydown', handler);
        }
    });
    
    if (DOM.fsPrevPageBtn) {
        DOM.fsPrevPageBtn.removeEventListener('click', handleFsPrevPage);
        DOM.fsPrevPageBtn.addEventListener('click', handleFsPrevPage);
    }
    if (DOM.fsNextPageBtn) {
        DOM.fsNextPageBtn.removeEventListener('click', handleFsNextPage);
        DOM.fsNextPageBtn.addEventListener('click', handleFsNextPage);
    }

    console.log("FileSizeChecker: 事件监听器设置完成");
}