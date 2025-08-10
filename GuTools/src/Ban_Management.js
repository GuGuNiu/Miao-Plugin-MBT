// ==========================================================================
// 封禁管理: 负责封禁管理页面的数据加载、筛选、渲染与交互逻辑
// ==========================================================================

const DOM_BM = {};

function cacheBanManagementDOMElements() {
    DOM_BM.pane = document.getElementById('banManagementPane');
    DOM_BM.layoutWrapper = DOM_BM.pane?.querySelector('.bm-layout-wrapper');
    DOM_BM.leftColumn = DOM_BM.pane?.querySelector('.bm-left-column');
    DOM_BM.rightColumn = DOM_BM.pane?.querySelector('.bm-right-column');
    DOM_BM.controlsPanel = DOM_BM.pane?.querySelector('.bm-controls-panel');
    DOM_BM.unbannedPanel = DOM_BM.pane?.querySelector('#bm-unbanned-panel');
    DOM_BM.bannedPanel = DOM_BM.pane?.querySelector('#bm-banned-panel');
    DOM_BM.unbannedGrid = DOM_BM.pane?.querySelector('#bm-unbanned-grid');
    DOM_BM.bannedGrid = DOM_BM.pane?.querySelector('#bm-banned-grid');
    DOM_BM.unbannedCount = DOM_BM.pane?.querySelector('#bm-unbanned-count');
    DOM_BM.bannedCount = DOM_BM.pane?.querySelector('#bm-banned-count');

    DOM_BM.gameFilterBtn = DOM_BM.pane?.querySelector('#bm-filterGameBtn');
    DOM_BM.gameFilterDropdown = DOM_BM.pane?.querySelector('#bm-filterGameDropdown');
    DOM_BM.searchInput = DOM_BM.pane?.querySelector('#bm-dataListSearchInput');
    DOM_BM.secondaryTagsBtn = DOM_BM.pane?.querySelector('#bm-secondaryTagsFilterBtn');
    DOM_BM.secondaryTagsDropdown = DOM_BM.pane?.querySelector('#bm-secondaryTagsDropdown');
    DOM_BM.clearSecondaryTagsBtn = DOM_BM.pane?.querySelector('#bm-clearSecondaryTagsBtn');
    DOM_BM.filterCheckboxes = DOM_BM.pane?.querySelectorAll('.filter-controls .filter-toggle-checkbox');

    DOM_BM.bulkActionBar = document.getElementById('bm-bulk-action-bar');
    DOM_BM.bulkActionText = document.getElementById('bm-bulk-action-text');
    DOM_BM.bulkSelectAllBtn = document.getElementById('bm-bulk-select-all-btn');
    DOM_BM.bulkInvertBtn = document.getElementById('bm-bulk-invert-btn');
    DOM_BM.bulkBanBtn = document.getElementById('bm-bulk-ban-btn');
    DOM_BM.bulkUnbanBtn = document.getElementById('bm-bulk-unban-btn');
    DOM_BM.bulkCancelBtn = document.getElementById('bm-bulk-cancel-btn');

    DOM_BM.selectionBox = document.getElementById('bm-selection-box');
}

const BanManagementState = {
    isInitialized: false, isLoading: false, allImageData: [], banList: [], banListGids: new Set(),
    unbannedImages: [], bannedImages: [], filteredUnbanned: [], filteredBanned: [],
    selectedUnbannedGids: new Set(), selectedBannedGids: new Set(),
    selectedSecondaryTags: new Set(), availableTags: {}, searchDebounceTimer: null,
    activeDragSelect: null,
};

async function initializeBanManagement() {
    if (BanManagementState.isInitialized) return;
    if (BanManagementState.isLoading) return;
    BanManagementState.isLoading = true;

    if (!DOM_BM.pane) {
        cacheBanManagementDOMElements();
        setupBanManagementEventListeners();
        setupCustomGameFilterForBM('bm-filterGameBtn', 'bm-filterGameDropdown', applyBanFilters);
    }
    
    DOM_BM.unbannedGrid.innerHTML = `<div class="bm-placeholder"><p>正在加载图库数据...</p></div>`;
    DOM_BM.bannedGrid.innerHTML = `<div class="bm-placeholder"><p>正在加载封禁列表...</p></div>`;
    
    try {
        const [userData, banListData] = await Promise.all([
            fetchJsonData(API_ENDPOINTS.FETCH_USER_DATA), 
            fetchJsonData('/api/ban-list')
        ]);
        
        BanManagementState.allImageData = Array.isArray(userData) ? userData : [];
        BanManagementState.banList = Array.isArray(banListData) ? banListData : [];
        BanManagementState.banListGids = new Set(BanManagementState.banList.map(item => String(item.gid)));
        
        await fetchAndPopulateSecondaryTagsForBM();
        processAndSeparateImageData();
        applyBanFilters();
        DOM_BM.filterCheckboxes.forEach(cb => updateFilterToggleButtonTextForBM(cb.id));

        BanManagementState.isInitialized = true;
    } catch (error) {
        console.error("封禁管理面板初始化失败:", error); displayToast("加载封禁数据失败", 'error');
        if(DOM_BM.unbannedGrid) DOM_BM.unbannedGrid.innerHTML = `<div class="bm-placeholder"><p>数据加载失败，请检查后端服务。</p></div>`;
        if(DOM_BM.bannedGrid) DOM_BM.bannedGrid.innerHTML = `<div class="bm-placeholder"><p>数据加载失败。</p></div>`;
    } finally {
        BanManagementState.isLoading = false;
    }
}

function processAndSeparateImageData() {
    BanManagementState.unbannedImages = [];
    BanManagementState.bannedImages = [];
    BanManagementState.allImageData.forEach(img => {
        if (!img || !img.gid) return;
        (BanManagementState.banListGids.has(String(img.gid)) ? BanManagementState.bannedImages : BanManagementState.unbannedImages).push(img);
    });
}

function applyBanFilters() {
    const searchTerm = DOM_BM.searchInput?.value.toLowerCase().trim() || '';
    const selectedGame = DOM_BM.gameFilterBtn?.dataset.value || '';
    const filters = {};
    DOM_BM.filterCheckboxes?.forEach(cb => { filters[cb.id] = cb.checked; });
    
    const filterFunction = entry => {
        if (!entry?.attributes) return false;
        if (searchTerm && !(entry.attributes.filename || '').toLowerCase().includes(searchTerm) && !(entry.gid || '').toString().toLowerCase().includes(searchTerm)) return false;
        if (filters['bm-filterPx18'] && !entry.attributes.isPx18) return false;
        if (filters['bm-filterRx18'] && !entry.attributes.isRx18) return false;
        if (filters['bm-filterNormal'] && entry.attributes.layout !== 'normal') return false;
        if (filters['bm-filterFullscreen'] && entry.attributes.layout !== 'fullscreen') return false;
        if (filters['bm-filterEasterEgg'] && !entry.attributes.isEasterEgg) return false;
        if (filters['bm-filterAiImage'] && !entry.attributes.isAiImage) return false;
        if (selectedGame) {
            if (selectedGame === 'unknown' && ['gs-character', 'sr-character', 'zzz-character', 'waves-character'].includes(entry.sourceGallery)) return false;
            else if (selectedGame !== 'unknown' && entry.sourceGallery !== selectedGame) return false;
        }
        if (BanManagementState.selectedSecondaryTags.size > 0) {
            const entryTags = entry.attributes.secondaryTags || [];
            for (const tag of BanManagementState.selectedSecondaryTags) if (!entryTags.includes(tag)) return false;
        }
        return true;
    };
    
    const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains('is-primary');

    if (isUnbannedPrimary) {
        BanManagementState.filteredUnbanned = BanManagementState.unbannedImages.filter(filterFunction);
        BanManagementState.filteredBanned = BanManagementState.bannedImages;
    } else {
        BanManagementState.filteredUnbanned = BanManagementState.unbannedImages;
        BanManagementState.filteredBanned = BanManagementState.bannedImages.filter(filterFunction);
    }

    const sortFunction = (a, b) =>
        (a.attributes?.filename || '').localeCompare(b.attributes?.filename || '', undefined, { numeric: true, sensitivity: 'base' });
    
    BanManagementState.filteredUnbanned.sort(sortFunction);
    BanManagementState.filteredBanned.sort(sortFunction);

    renderUnbannedGrid();
    renderBannedGrid();
}

function renderUnbannedGrid() {
    if (DOM_BM.unbannedCount) DOM_BM.unbannedCount.textContent = BanManagementState.filteredUnbanned.length;
    renderGrid(DOM_BM.unbannedGrid, BanManagementState.filteredUnbanned, 'unbanned', BanManagementState.selectedUnbannedGids);
}

function renderBannedGrid() {
    if (DOM_BM.bannedCount) DOM_BM.bannedCount.textContent = BanManagementState.filteredBanned.length;
    renderGrid(DOM_BM.bannedGrid, BanManagementState.filteredBanned, 'banned', BanManagementState.selectedBannedGids);
}

function renderGrid(gridElement, data, type, selectionSet) {
    if (!gridElement) return;

    // --- 虚拟滚动核心状态 ---
    const cardHeight = 180; // 卡片高度
    const cardMinWidth = 140; // 卡片最小宽度
    const cardGap = 16;     // 卡片间隙
    const scrollTop = gridElement.scrollTop;
    const containerHeight = gridElement.clientHeight;
    const containerWidth = gridElement.clientWidth - 32; 

    gridElement.innerHTML = ''; // 清理旧的DOM

    // 如果没有数据，显示占位符并返回
    if (data.length === 0) {
        gridElement.innerHTML = `<div class="bm-placeholder"><p>${type === 'unbanned' ? '没有匹配的图片' : '暂无封禁图片'}</p></div>`;
        return;
    }

    // 计算布局参数
    const columns = Math.max(1, Math.floor((containerWidth + cardGap) / (cardMinWidth + cardGap)));
    const cardWidth = (containerWidth - (columns - 1) * cardGap) / columns;
    const totalRows = Math.ceil(data.length / columns);
    const totalHeight = totalRows * (cardHeight + cardGap);

    // 创建一个“撑高”的内部容器
    const spacer = document.createElement('div');
    spacer.style.position = 'relative';
    spacer.style.width = '100%';
    spacer.style.height = `${totalHeight}px`;

    // 计算当前应该渲染的行范围
    const startRow = Math.max(0, Math.floor(scrollTop / (cardHeight + cardGap)) - 1); // 向上多渲染1行作为缓冲区
    const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / (cardHeight + cardGap)) + 1); // 向下多渲染1行

    // 只创建并渲染可见区域的卡片
    const fragment = document.createDocumentFragment();
    const startIndex = startRow * columns;
    const endIndex = Math.min(data.length, (endRow + 1) * columns);

    for (let i = startIndex; i < endIndex; i++) {
        const img = data[i];
        const row = Math.floor(i / columns);
        const col = i % columns;

        const card = document.createElement('div');
        card.className = 'bm-image-card';
        card.dataset.gid = img.gid;

        // --- 使用精确的像素值进行绝对定位 ---
        card.style.position = 'absolute';
        card.style.top = `${row * (cardHeight + cardGap)}px`;
        card.style.left = `${col * (cardWidth + cardGap)}px`;
        card.style.width = `${cardWidth}px`;
        card.style.height = `${cardHeight}px`;
        
        const thumbnailPath = getThumbnailPath(img);
        const filename = (img.attributes.filename || '未知文件').replace(/\.webp$/i, '');
        card.innerHTML = `<img src="${thumbnailPath}" alt="${filename}" loading="lazy" draggable="false" onerror="this.src='/placeholder.png'"><span class="bm-card-filename" title="${filename}">${filename}</span>`;
        if (selectionSet.has(String(img.gid))) card.classList.add('is-selected');
        
        fragment.appendChild(card);
    }
    
    spacer.appendChild(fragment);
    gridElement.appendChild(spacer);
}

function setupDragToSelect(gridElement, selectionSet, type) {
    let startX, startY, isDragging = false;
    
    gridElement.addEventListener('mousedown', e => {
        // 判断点击是否发生在滚动条上 或 不是鼠标左键，如果是则不启动拖选
        if (e.button !== 0 || e.offsetX >= gridElement.clientWidth) {
            return;
        }
        
        // 阻止默认行为，如文本选择
        e.preventDefault();
        isDragging = true;
        BanManagementState.activeDragSelect = type;

        const rect = gridElement.getBoundingClientRect();
        // --- 将滚动条位置加入初始坐标计算 ---
        startX = e.clientX - rect.left + gridElement.scrollLeft;
        startY = e.clientY - rect.top + gridElement.scrollTop;
        
        DOM_BM.selectionBox.style.left = `${startX}px`; // 直接使用相对于 spacer 的坐标
        DOM_BM.selectionBox.style.top = `${startY}px`;
        DOM_BM.selectionBox.style.width = '0px';
        DOM_BM.selectionBox.style.height = '0px';
        
        // 将选框添加到 spacer 内部
        const spacer = gridElement.querySelector('div');
        if (spacer) {
            spacer.appendChild(DOM_BM.selectionBox);
        }
        DOM_BM.selectionBox.classList.remove('hidden');

        // 如果没有按住 Ctrl/Meta 键，则清除之前的选择
        if (!e.ctrlKey && !e.metaKey) {
            clearSelection(type);
        }
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging || BanManagementState.activeDragSelect !== type) return;
        e.preventDefault();
        const rect = gridElement.getBoundingClientRect();
        // --- 同样在移动时考虑滚动条位置 ---
        let currentX = e.clientX - rect.left + gridElement.scrollLeft;
        let currentY = e.clientY - rect.top + gridElement.scrollTop;
        
        const boxX = Math.min(startX, currentX);
        const boxY = Math.min(startY, currentY);
        const boxWidth = Math.abs(currentX - startX);
        const boxHeight = Math.abs(currentY - startY);

        DOM_BM.selectionBox.style.left = `${boxX}px`;
        DOM_BM.selectionBox.style.top = `${boxY}px`;
        DOM_BM.selectionBox.style.width = `${boxWidth}px`;
        DOM_BM.selectionBox.style.height = `${boxHeight}px`;

        checkSelection(gridElement, selectionSet);
    });

    document.addEventListener('mouseup', e => {
        if (!isDragging || BanManagementState.activeDragSelect !== type) return;
        isDragging = false;
        BanManagementState.activeDragSelect = null;
        DOM_BM.selectionBox.classList.add('hidden');
        if (DOM_BM.selectionBox.parentElement) {
            DOM_BM.selectionBox.parentElement.removeChild(DOM_BM.selectionBox);
        }
        updateBulkActionBar();
    });
}

function clearSelection(type) {
    const selectionSet = type === 'unbanned' ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
    const grid = type === 'unbanned' ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;
    selectionSet.clear();
    grid?.querySelectorAll('.is-selected').forEach(el => el.classList.remove('is-selected'));
}

function clearAllSelections() {
    clearSelection('unbanned');
    clearSelection('banned');
    updateBulkActionBar();
}

function updateBulkActionBar() {
    const unbannedCount = BanManagementState.selectedUnbannedGids.size;
    const bannedCount = BanManagementState.selectedBannedGids.size;
    if (unbannedCount === 0 && bannedCount === 0) {
        DOM_BM.bulkActionBar.classList.add('hidden');
        return;
    }
    DOM_BM.bulkBanBtn.style.display = unbannedCount > 0 ? 'flex' : 'none';
    DOM_BM.bulkUnbanBtn.style.display = bannedCount > 0 ? 'flex' : 'none';
    let text = '';
    if (unbannedCount > 0) text += `已选 ${unbannedCount} 项待封禁。`;
    if (bannedCount > 0) text += `已选 ${bannedCount} 项待解禁。`;
    DOM_BM.bulkActionText.textContent = text;
    DOM_BM.bulkActionBar.classList.remove('hidden');
}

async function banSelected() { await performBanAction(Array.from(BanManagementState.selectedUnbannedGids), 'ban'); }
async function unbanSelected() { await performBanAction(Array.from(BanManagementState.selectedBannedGids), 'unban'); }

async function performBanAction(gids, action) {
    if (gids.length === 0) return;
    const isBan = action === 'ban';
    
    let newBanList = [...BanManagementState.banList];
    let changesMade = 0;

    if (isBan) {
        gids.forEach(gid => {
            if (!BanManagementState.banListGids.has(gid)) {
                const imgData = BanManagementState.allImageData.find(img => String(img.gid) === gid);
                if (imgData) {
                    newBanList.push({
                        gid: imgData.gid,
                        path: imgData.path,
                        timestamp: new Date().toISOString()
                    });
                    changesMade++;
                }
            }
        });
    } else {
        const gidsToUnbanSet = new Set(gids);
        newBanList = newBanList.filter(item => !gidsToUnbanSet.has(String(item.gid)));
        changesMade = BanManagementState.banList.length - newBanList.length;
    }

    if (changesMade === 0) {
        displayToast(`没有需要${isBan ? '封禁' : '解禁'}的项目。`, 'info');
        clearAllSelections();
        return;
    }

    if (await updateBanListOnServer(newBanList)) {
        displayToast(`成功${isBan ? '封禁' : '解禁'} ${changesMade} 张图片`, 'success');
        BanManagementState.banList = newBanList;
        BanManagementState.banListGids = new Set(newBanList.map(item => String(item.gid)));
        processAndSeparateImageData();
        applyBanFilters();
        clearAllSelections();
    } else {
        displayToast(`${isBan ? '封禁' : '解禁'}操作失败`, 'error');
    }
}

async function updateBanListOnServer(newList) {
    try {
        const result = await fetchJsonData('/api/update-ban-list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newList) });
        return result.success;
    } catch (error) { console.error("更新封禁列表失败:", error); return false; }
}

function getThumbnailPath(img) {
    const { storagebox, path } = img;
    if (!storagebox || !path) return '/placeholder.png';
    const originalCaseBox = AppState.availableStorageBoxes.find(b => b.toLowerCase() === storagebox.toLowerCase()) || storagebox;
    return `/api/thumbnail/${originalCaseBox}/${path}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

function updateFilterToggleButtonTextForBM(checkboxId) {
    const checkbox = document.getElementById(checkboxId);
    const button = checkbox?.closest('.filter-toggle-label')?.querySelector('.filter-toggle-button');
    if (checkbox && button) {
        button.textContent = checkbox.checked ? button.dataset.on : button.dataset.off;
        button.classList.toggle('active', checkbox.checked);
    }
}

function resetAllBanFilters() {
    if (DOM_BM.searchInput) DOM_BM.searchInput.value = '';
    if (DOM_BM.gameFilterBtn) {
        DOM_BM.gameFilterBtn.textContent = '—所有游戏—';
        DOM_BM.gameFilterBtn.dataset.value = '';
    }
    if (DOM_BM.filterCheckboxes) {
        DOM_BM.filterCheckboxes.forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
                updateFilterToggleButtonTextForBM(cb.id);
            }
        });
    }
    if (BanManagementState.selectedSecondaryTags) {
        BanManagementState.selectedSecondaryTags.clear();
        DOM_BM.secondaryTagsDropdown?.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        updateSecondaryTagsUIForBM();
    }
}

function handlePanelSwap(event) {
    const clickedPanel = event.currentTarget;
    if (clickedPanel.classList.contains('is-primary') || DOM_BM.layoutWrapper.classList.contains('is-animating')) {
        return;
    }

    clearAllSelections();
    resetAllBanFilters(); 

    DOM_BM.layoutWrapper.classList.add('is-animating');

    const isUnbannedClicked = clickedPanel.id === 'bm-unbanned-panel';
    const primaryPanel = isUnbannedClicked ? DOM_BM.unbannedPanel : DOM_BM.bannedPanel;
    const secondaryPanel = isUnbannedClicked ? DOM_BM.bannedPanel : DOM_BM.unbannedPanel;

    secondaryPanel.classList.add('animating-out');

    setTimeout(() => {
        primaryPanel.classList.add('animating-in');
    }, 200); // 增加延迟，让效果更明显

    // 立即切换主/次状态类和移动DOM元素
    primaryPanel.classList.add('is-primary');
    primaryPanel.classList.remove('is-secondary');
    secondaryPanel.classList.add('is-secondary');
    secondaryPanel.classList.remove('is-primary');
    
    if (isUnbannedClicked) {
        DOM_BM.rightColumn.appendChild(primaryPanel);
        DOM_BM.leftColumn.appendChild(secondaryPanel);
    } else {
        DOM_BM.rightColumn.appendChild(primaryPanel);
        DOM_BM.leftColumn.appendChild(secondaryPanel);
    }
    
    DOM_BM.leftColumn.insertBefore(DOM_BM.controlsPanel, DOM_BM.leftColumn.firstChild);
    const totalAnimationTime = 200 + 500; // 延迟时长 + CSS动画时长
    setTimeout(() => {
        primaryPanel.classList.remove('animating-in');
        secondaryPanel.classList.remove('animating-out');
        DOM_BM.layoutWrapper.classList.remove('is-animating');
    }, totalAnimationTime);

    applyBanFilters();
}

function selectAllInCurrentView() {
    const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains('is-primary');
    const targetSet = isUnbannedPrimary ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
    const sourceData = isUnbannedPrimary ? BanManagementState.filteredUnbanned : BanManagementState.filteredBanned;
    const grid = isUnbannedPrimary ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;

    sourceData.forEach(img => targetSet.add(String(img.gid)));
    grid.querySelectorAll('.bm-image-card').forEach(card => card.classList.add('is-selected'));
    updateBulkActionBar();
}

function invertSelectionInCurrentView() {
    const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains('is-primary');
    const targetSet = isUnbannedPrimary ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
    const sourceData = isUnbannedPrimary ? BanManagementState.filteredUnbanned : BanManagementState.filteredBanned;
    const grid = isUnbannedPrimary ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;

    sourceData.forEach(img => {
        const gid = String(img.gid);
        if (targetSet.has(gid)) {
            targetSet.delete(gid);
        } else {
            targetSet.add(gid);
        }
    });

    grid.querySelectorAll('.bm-image-card').forEach(card => card.classList.toggle('is-selected'));
    updateBulkActionBar();
}

function setupDragToSelect(gridElement, selectionSet, type) {
    let startX, startY, isDragging = false;
    
    gridElement.addEventListener('mousedown', e => {
        if (e.target !== gridElement) return;
        e.preventDefault();
        isDragging = true;
        BanManagementState.activeDragSelect = type;

        const rect = gridElement.getBoundingClientRect();
        const scrollLeft = gridElement.scrollLeft;
        const scrollTop = gridElement.scrollTop;
        startX = e.clientX - rect.left + scrollLeft;
        startY = e.clientY - rect.top + scrollTop;
        
        DOM_BM.selectionBox.style.left = `${e.clientX - rect.left}px`;
        DOM_BM.selectionBox.style.top = `${e.clientY - rect.top}px`;
        DOM_BM.selectionBox.style.width = '0px';
        DOM_BM.selectionBox.style.height = '0px';
        DOM_BM.selectionBox.style.transform = `translate(0, 0)`;
        gridElement.appendChild(DOM_BM.selectionBox);
        DOM_BM.selectionBox.classList.remove('hidden');

        if (!e.ctrlKey && !e.metaKey) {
            clearSelection(type);
        }
    });

    document.addEventListener('mousemove', e => {
        if (!isDragging || BanManagementState.activeDragSelect !== type) return;
        e.preventDefault();
        const rect = gridElement.getBoundingClientRect();
        const scrollLeft = gridElement.scrollLeft;
        const scrollTop = gridElement.scrollTop;
        let currentX = e.clientX - rect.left + scrollLeft;
        let currentY = e.clientY - rect.top + scrollTop;
        
        const boxX = Math.min(startX, currentX);
        const boxY = Math.min(startY, currentY);
        const boxWidth = Math.abs(currentX - startX);
        const boxHeight = Math.abs(currentY - startY);

        DOM_BM.selectionBox.style.transform = `translate(${boxX - scrollLeft}px, ${boxY - scrollTop}px)`;
        DOM_BM.selectionBox.style.width = `${boxWidth}px`;
        DOM_BM.selectionBox.style.height = `${boxHeight}px`;

        checkSelection(gridElement, selectionSet);
    });

    document.addEventListener('mouseup', e => {
        if (!isDragging || BanManagementState.activeDragSelect !== type) return;
        isDragging = false;
        BanManagementState.activeDragSelect = null;
        DOM_BM.selectionBox.classList.add('hidden');
        DOM_BM.selectionBox.style.width = '0px';
        DOM_BM.selectionBox.style.height = '0px';
        if (DOM_BM.selectionBox.parentElement) {
            DOM_BM.selectionBox.parentElement.removeChild(DOM_BM.selectionBox);
        }
        updateBulkActionBar();
    });
}

function checkSelection(gridElement, selectionSet) {
    if (!DOM_BM.selectionBox.parentElement) return;

    // 获取选框相对于 spacer 的位置
    const boxLeft = parseFloat(DOM_BM.selectionBox.style.left);
    const boxTop = parseFloat(DOM_BM.selectionBox.style.top);
    const boxRight = boxLeft + parseFloat(DOM_BM.selectionBox.style.width);
    const boxBottom = boxTop + parseFloat(DOM_BM.selectionBox.style.height);

    const cards = gridElement.querySelectorAll('.bm-image-card');
    
    cards.forEach(card => {
        // 获取卡片相对于 spacer 的位置
        const cardLeft = parseFloat(card.style.left);
        const cardTop = parseFloat(card.style.top);
        const cardRight = cardLeft + card.offsetWidth;
        const cardBottom = cardTop + card.offsetHeight;
        const gid = card.dataset.gid;
        
        // 矩形相交检测
        const isIntersecting = !(boxRight < cardLeft || boxLeft > cardRight || boxBottom < cardTop || boxTop > cardBottom);

        if (isIntersecting) {
            if (!selectionSet.has(gid)) { selectionSet.add(gid); card.classList.add('is-selected'); }
        } else if (!document.body.classList.contains('ctrl-pressed')) { //  Ctrl 键多选逻辑
             if (selectionSet.has(gid)) { selectionSet.delete(gid); card.classList.remove('is-selected'); }
        }
    });
    updateBulkActionBar();
}

function setupCustomGameFilterForBM(btnId, dropdownId, callback) {
    const gameOptions = [ { value: '', text: '—所有游戏—' }, { value: 'gs-character', text: '原神' }, { value: 'sr-character', text: '星铁' }, { value: 'zzz-character', text: '绝区零' }, { value: 'waves-character', text: '鸣潮' }, { value: 'unknown', text: '未知' } ];
    const btn = document.getElementById(btnId), dropdown = document.getElementById(dropdownId);
    if (!btn || !dropdown) return;
    dropdown.innerHTML = '';
    gameOptions.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'custom-select-option';
        item.dataset.value = opt.value;
        item.textContent = opt.text;
        item.addEventListener('click', () => { btn.textContent = opt.text; btn.dataset.value = opt.value; dropdown.classList.add('hidden'); if (callback) callback(); });
        dropdown.appendChild(item);
    });
    btn.addEventListener('click', e => { e.stopPropagation(); dropdown.classList.toggle('hidden'); });
}

async function fetchAndPopulateSecondaryTagsForBM() {
    try {
        BanManagementState.availableTags = await fetchJsonData('/api/secondary-tags');
        const contentArea = DOM_BM.secondaryTagsDropdown.querySelector('.tags-dropdown-content');
        contentArea.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const [category, tags] of Object.entries(BanManagementState.availableTags)) {
            const categoryEl = document.createElement('div');
            categoryEl.className = 'tags-dropdown-category';
            categoryEl.innerHTML = `<h6 class="tags-dropdown-category-title">${category}</h6>`;
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
    } catch (error) {
        console.error("加载二级标签失败:", error);
    }
}
function updateSecondaryTagsUIForBM() {
    const count = BanManagementState.selectedSecondaryTags.size;
    DOM_BM.secondaryTagsBtn.textContent = count > 0 ? `二级标签 (${count})` : '二级标签';
    DOM_BM.secondaryTagsBtn.classList.toggle('active-filter', count > 0);
}

function setupDragAndClick_BM(gridElement, selectionSet, type) {
    let isMouseDown = false;
    let isDragging = false;
    let startX, startY;

    const handleMouseMove = (e) => {
        if (!isMouseDown) return;

        // 首次移动时，判定为拖拽操作开始
        if (!isDragging) {
            isDragging = true;
            BanManagementState.activeDragSelect = type;

            if (!e.ctrlKey && !e.metaKey) {
                clearSelection(type);
            }
            
            // 初始化并显示选框
            const spacer = gridElement.querySelector('div');
            if(spacer) spacer.appendChild(DOM_BM.selectionBox);
            DOM_BM.selectionBox.style.left = `${startX}px`;
            DOM_BM.selectionBox.style.top = `${startY}px`;
            DOM_BM.selectionBox.style.width = '0px';
            DOM_BM.selectionBox.style.height = '0px';
            DOM_BM.selectionBox.classList.remove('hidden');
        }

        // 仅在拖拽状态下更新选框
        if (isDragging) {
            const rect = gridElement.getBoundingClientRect();
            const currentX = e.clientX - rect.left + gridElement.scrollLeft;
            const currentY = e.clientY - rect.top + gridElement.scrollTop;

            const boxX = Math.min(startX, currentX);
            const boxY = Math.min(startY, currentY);
            const boxWidth = Math.abs(currentX - startX);
            const boxHeight = Math.abs(currentY - startY);

            DOM_BM.selectionBox.style.left = `${boxX}px`;
            DOM_BM.selectionBox.style.top = `${boxY}px`;
            DOM_BM.selectionBox.style.width = `${boxWidth}px`;
            DOM_BM.selectionBox.style.height = `${boxHeight}px`;

            checkSelection(gridElement, selectionSet);
        }
    };

    const handleMouseUp = (e) => {
        if (!isMouseDown) return;

        if (isDragging) {
            // 如果是拖拽操作，则在鼠标抬起时清理
            if (BanManagementState.activeDragSelect === type) {
                DOM_BM.selectionBox.classList.add('hidden');
                if (DOM_BM.selectionBox.parentElement) {
                    DOM_BM.selectionBox.parentElement.removeChild(DOM_BM.selectionBox);
                }
                updateBulkActionBar();
                BanManagementState.activeDragSelect = null;
            }
        } else {
            // 如果未拖拽，则是单击操作
            const card = e.target.closest('.bm-image-card');
            if (card) {
                const gid = card.dataset.gid;
                if (selectionSet.has(gid)) {
                    selectionSet.delete(gid);
                    card.classList.remove('is-selected');
                } else {
                    selectionSet.add(gid);
                    card.classList.add('is-selected');
                }
                updateBulkActionBar();
            } else if (!e.ctrlKey && !e.metaKey) {
                // 点击在空白区域
                clearSelection(type);
                updateBulkActionBar();
            }
        }

        isMouseDown = false;
        isDragging = false;
        
        // 移除 document 上的监听器
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    gridElement.addEventListener('mousedown', e => {
        // 仅响应鼠标左键，并忽略滚动条区域
        if (e.button !== 0 || e.offsetX >= gridElement.clientWidth || e.offsetY >= gridElement.clientHeight) {
            return;
        }

        isMouseDown = true;
        isDragging = false;

        const rect = gridElement.getBoundingClientRect();
        startX = e.clientX - rect.left + gridElement.scrollLeft;
        startY = e.clientY - rect.top + gridElement.scrollTop;
        
        e.preventDefault();

        // 绑定 document 级别的事件
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });
}

function setupBanManagementEventListeners() {
    DOM_BM.searchInput?.addEventListener('input', () => { clearTimeout(BanManagementState.searchDebounceTimer); BanManagementState.searchDebounceTimer = setTimeout(applyBanFilters, 300); });
    DOM_BM.filterCheckboxes?.forEach(cb => cb.addEventListener('change', () => { updateFilterToggleButtonTextForBM(cb.id); applyBanFilters(); }));
    
    if(DOM_BM.unbannedGrid) {
        setupDragAndClick_BM(DOM_BM.unbannedGrid, BanManagementState.selectedUnbannedGids, 'unbanned');
    }
    if(DOM_BM.bannedGrid) {
        setupDragAndClick_BM(DOM_BM.bannedGrid, BanManagementState.selectedBannedGids, 'banned');
    }
    DOM_BM.unbannedGrid?.addEventListener('scroll', renderUnbannedGrid);
    DOM_BM.bannedGrid?.addEventListener('scroll', renderBannedGrid);
    DOM_BM.bannedPanel?.addEventListener('click', handlePanelSwap);
    DOM_BM.unbannedPanel?.addEventListener('click', handlePanelSwap);
    DOM_BM.bulkSelectAllBtn?.addEventListener('click', selectAllInCurrentView);
    DOM_BM.bulkInvertBtn?.addEventListener('click', invertSelectionInCurrentView);
    DOM_BM.bulkBanBtn?.addEventListener('click', banSelected);
    DOM_BM.bulkUnbanBtn?.addEventListener('click', unbanSelected);
    DOM_BM.bulkCancelBtn?.addEventListener('click', clearAllSelections);
    DOM_BM.secondaryTagsBtn?.addEventListener('click', e => { e.stopPropagation(); DOM_BM.secondaryTagsDropdown.classList.toggle('hidden'); });
    DOM_BM.secondaryTagsDropdown?.addEventListener('click', e => {
        const tagEl = e.target.closest('.tags-dropdown-tag-item');
        if (tagEl) {
            const tag = tagEl.dataset.tag;
            BanManagementState.selectedSecondaryTags.has(tag) ? BanManagementState.selectedSecondaryTags.delete(tag) : BanManagementState.selectedSecondaryTags.add(tag);
            tagEl.classList.toggle('selected');
            updateSecondaryTagsUIForBM();
            applyBanFilters();
        }
    });
    DOM_BM.clearSecondaryTagsBtn?.addEventListener('click', () => {
        BanManagementState.selectedSecondaryTags.clear();
        DOM_BM.secondaryTagsDropdown.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        updateSecondaryTagsUIForBM();
        applyBanFilters();
    });
    document.addEventListener('click', e => {
        if (DOM_BM.gameFilterDropdown && !DOM_BM.gameFilterDropdown.classList.contains('hidden') && !DOM_BM.gameFilterBtn.contains(e.target)) DOM_BM.gameFilterDropdown.classList.add('hidden');
        if (DOM_BM.secondaryTagsDropdown && !DOM_BM.secondaryTagsDropdown.classList.contains('hidden') && !DOM_BM.secondaryTagsBtn.contains(e.target) && !DOM_BM.secondaryTagsDropdown.contains(e.target)) DOM_BM.secondaryTagsDropdown.classList.add('hidden');
    });

    document.addEventListener('keydown', e => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.add('ctrl-pressed'); });
    document.addEventListener('keyup', e => { if (e.key === 'Control' || e.key === 'Meta') document.body.classList.remove('ctrl-pressed'); });
}