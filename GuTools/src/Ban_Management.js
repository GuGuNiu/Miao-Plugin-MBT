// ==========================================================================
// 封禁管理: 负责封禁管理页面的数据加载、筛选、渲染与交互逻辑
// ==========================================================================

const DOM_BM = {};
const BanManagementState = {
  isInitialized: false,
  needsRefresh: false,
  warningShown: false,
  isLoading: false,
  allImageData: [],
  banList: [],
  banListGids: new Set(),
  unbannedImages: [],
  bannedImages: [],
  filteredUnbanned: [],
  filteredBanned: [],
  selectedUnbannedGids: new Set(),
  selectedBannedGids: new Set(),
  selectedSecondaryTags: new Set(),
  availableTags: {},
  searchDebounceTimer: null,
  activeDragSelect: null,
  workerSearchResults: null,
  installedRepos: null,
};

/**
 * 缓存封禁管理面板的所有 DOM 元素引用
 */
function cacheBanManagementDOMElements() {
  DOM_BM.pane = document.getElementById("banManagementPane");
  if (!DOM_BM.pane) return false;

  DOM_BM.layoutWrapper = DOM_BM.pane.querySelector(".bm-layout-wrapper");
  DOM_BM.leftColumn = DOM_BM.pane.querySelector(".bm-left-column");
  DOM_BM.rightColumn = DOM_BM.pane.querySelector(".bm-right-column");
  DOM_BM.controlsPanel = document.getElementById("bm-controls-panel");
  DOM_BM.unbannedPanel = document.getElementById("bm-unbanned-panel");
  DOM_BM.bannedPanel = document.getElementById("bm-banned-panel");
  DOM_BM.unbannedHeader = document.getElementById("bm-unbanned-header");
  DOM_BM.bannedHeader = document.getElementById("bm-banned-header");
  DOM_BM.unbannedGrid = document.getElementById("bm-unbanned-grid");
  DOM_BM.bannedGrid = document.getElementById("bm-banned-grid");
  DOM_BM.unbannedCount = document.getElementById("bm-unbanned-count");
  DOM_BM.bannedCount = document.getElementById("bm-banned-count");
  DOM_BM.gameFilterBtn = document.getElementById("bm-filterGameBtn");
  DOM_BM.gameFilterDropdown = document.getElementById("bm-filterGameDropdown");
  DOM_BM.searchInput = document.getElementById("bm-dataListSearchInput");
  DOM_BM.secondaryTagsBtn = document.getElementById("bm-secondaryTagsFilterBtn");
  DOM_BM.secondaryTagsDropdown = document.getElementById("bm-secondaryTagsDropdown");
  DOM_BM.clearSecondaryTagsBtn = document.getElementById("bm-clearSecondaryTagsBtn");
  DOM_BM.filterCheckboxes = DOM_BM.pane.querySelectorAll(".filter-controls .filter-toggle-checkbox");
  DOM_BM.bulkActionBar = document.getElementById("bm-bulk-action-bar");
  DOM_BM.bulkActionText = document.getElementById("bm-bulk-action-text");
  DOM_BM.bulkSelectAllBtn = document.getElementById("bm-bulk-select-all-btn");
  DOM_BM.bulkInvertBtn = document.getElementById("bm-bulk-invert-btn");
  DOM_BM.bulkBanBtn = document.getElementById("bm-bulk-ban-btn");
  DOM_BM.bulkUnbanBtn = document.getElementById("bm-bulk-unban-btn");
  DOM_BM.bulkCancelBtn = document.getElementById("bm-bulk-cancel-btn");
  DOM_BM.selectionBox = document.getElementById("bm-selection-box");

  return true;
}

/**
 * 初始化封禁管理面板，加载所有必要数据
 */
async function initializeBanManagement() {
  if (BanManagementState.isLoading) return;

  if (!BanManagementState.isInitialized) {
    console.log("[封禁管理] 首次初始化...");
    if (!cacheBanManagementDOMElements()) {
      console.error("[封禁管理] 致命错误：核心DOM元素缓存失败，初始化中止。");
      return;
    }
    setupBanManagementEventListeners();
    setupCustomGameFilterForBM("bm-filterGameBtn", "bm-filterGameDropdown", applyBanFilters);
  }

  if (BanManagementState.isInitialized && !BanManagementState.needsRefresh) {
    return;
  }

  BanManagementState.isLoading = true;
  DOM_BM.unbannedGrid.innerHTML = `<div class="bm-placeholder"><p>正在加载图库数据...</p></div>`;
  DOM_BM.bannedGrid.innerHTML = `<div class="bm-placeholder"><p>正在加载封禁列表...</p></div>`;

  try {
    const [userData, banListData, repoData] = await Promise.all([
        fetchJsonData(API_ENDPOINTS.FETCH_USER_DATA),
        fetchJsonData("/api/ban-list"),
        fetchJsonData("/api/installed-repos")
    ]);
    
    BanManagementState.installedRepos = new Set(repoData.repos || []);
    const allRawImageData = Array.isArray(userData) ? userData : [];
    // 过滤出只属于已安装仓库的数据
    BanManagementState.allImageData = allRawImageData.filter(entry => BanManagementState.installedRepos.has(entry.storagebox));
    
    BanManagementState.banList = Array.isArray(banListData) ? banListData : [];
    BanManagementState.banListGids = new Set(BanManagementState.banList.map((item) => String(item.gid)));

    await fetchAndPopulateSecondaryTagsForBM();

    processAndSeparateImageData();
    applyBanFilters();
    updatePanelTitles();

    if (!BanManagementState.isInitialized) {
      DOM_BM.filterCheckboxes.forEach((cb) => updateFilterToggleButtonTextForBM(cb.id));
    }

    BanManagementState.isInitialized = true;
    AppState.banManagement.needsRefresh = false;
  } catch (error) {
    console.error("封禁管理面板初始化失败:", error);
    displayToast("加载封禁数据失败", "error");
    if (DOM_BM.unbannedGrid) DOM_BM.unbannedGrid.innerHTML = `<div class="bm-placeholder"><p>数据加载失败。</p></div>`;
    if (DOM_BM.bannedGrid) DOM_BM.bannedGrid.innerHTML = `<div class="bm-placeholder"><p>数据加载失败。</p></div>`;
  } finally {
    BanManagementState.isLoading = false;
  }
}

/**
 * 根据PFL等级和封禁状态，将所有图片数据分离到两个列表中
 */
function processAndSeparateImageData() {
  const pflLevel = AppState.galleryConfig?.PFL ?? 0;
  const shouldFilter = (img) => {
    if (pflLevel === 0 || !img?.attributes) return false;
    if (pflLevel === 1 && img.attributes.isRx18) return true;
    if (pflLevel === 2 && (img.attributes.isRx18 || img.attributes.isPx18)) return true;
    return false;
  };

  const dataToProcess = BanManagementState.workerSearchResults 
    ? BanManagementState.workerSearchResults.filter(entry => BanManagementState.installedRepos.has(entry.storagebox))
    : BanManagementState.allImageData;
  
  BanManagementState.unbannedImages = [];
  BanManagementState.bannedImages = [];

  dataToProcess.forEach((img) => {
    if (!img || !img.gid) return;
    if (BanManagementState.banListGids.has(String(img.gid))) {
      BanManagementState.bannedImages.push(img);
    } else if (!shouldFilter(img)) {
      BanManagementState.unbannedImages.push(img);
    }
  });
}

/**
 * 应用所有当前过滤器并重新渲染列表
 */
function applyBanFilters() {
  const searchTerm = DOM_BM.searchInput?.value.trim() || "";
  if (!searchTerm) {
    BanManagementState.workerSearchResults = null;
  }
  
  processAndSeparateImageData();
  filterAndRenderBanGrids();
}

function filterAndRenderBanGrids() {
    const selectedGame = DOM_BM.gameFilterBtn?.dataset.value || "";
    const filters = {};
    DOM_BM.filterCheckboxes?.forEach((cb) => {
        filters[cb.id] = cb.checked;
    });

    const filterFunction = (entry) => {
        if (!entry?.attributes) return false;

        if (filters["bm-filterPx18"] && !entry.attributes.isPx18) return false;
        if (filters["bm-filterRx18"] && !entry.attributes.isRx18) return false;
        if (filters["bm-filterNormal"] && entry.attributes.layout !== "normal") return false;
        if (filters["bm-filterFullscreen"] && entry.attributes.layout !== "fullscreen") return false;
        if (filters["bm-filterEasterEgg"] && !entry.attributes.isEasterEgg) return false;
        if (filters["bm-filterAiImage"] && !entry.attributes.isAiImage) return false;

        if (selectedGame) {
            if (selectedGame === "unknown" && ["gs-character", "sr-character", "zzz-character", "waves-character"].includes(entry.sourceGallery)) return false;
            else if (selectedGame !== "unknown" && entry.sourceGallery !== selectedGame) return false;
        }

        if (BanManagementState.selectedSecondaryTags.size > 0) {
            const entryTags = entry.attributes.secondaryTags || [];
            for (const tag of BanManagementState.selectedSecondaryTags) if (!entryTags.includes(tag)) return false;
        }
        return true;
    };

    const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains("is-primary");
    if (isUnbannedPrimary) {
        BanManagementState.filteredUnbanned = BanManagementState.unbannedImages.filter(filterFunction);
        BanManagementState.filteredBanned = [...BanManagementState.bannedImages];
    } else {
        BanManagementState.filteredBanned = BanManagementState.bannedImages.filter(filterFunction);
        BanManagementState.filteredUnbanned = [...BanManagementState.unbannedImages];
    }

    const sortFunction = (a, b) => (a.attributes?.filename || "").localeCompare(b.attributes?.filename || "", undefined, { numeric: true, sensitivity: "base" });
    BanManagementState.filteredUnbanned.sort(sortFunction);
    BanManagementState.filteredBanned.sort(sortFunction);

    renderUnbannedGrid();
    renderBannedGrid();
    updatePanelTitles();
}

/**
 * 使用虚拟滚动渲染指定的网格
 */
function renderGrid(gridElement, data, type, selectionSet) {
  if (!gridElement) return;
  const cardHeight = 180,
    cardMinWidth = 140,
    cardGap = 16;
  const scrollTop = gridElement.scrollTop;
  const containerHeight = gridElement.clientHeight;
  const containerWidth = gridElement.clientWidth > 32 ? gridElement.clientWidth - 32 : gridElement.clientWidth;

  gridElement.innerHTML = "";
  if (data.length === 0) {
    gridElement.innerHTML = `<div class="bm-placeholder"><p>${type === "unbanned" ? "没有匹配的图片" : "暂无封禁图片"}</p></div>`;
    return;
  }

  const columns = Math.max(1, Math.floor((containerWidth + cardGap) / (cardMinWidth + cardGap)));
  const cardWidth = (containerWidth - (columns - 1) * cardGap) / columns;
  const totalRows = Math.ceil(data.length / columns);
  const totalHeight = totalRows * (cardHeight + cardGap);
  const spacer = document.createElement("div");
  spacer.style.cssText = `position: relative; width: 100%; height: ${totalHeight}px;`;

  const startRow = Math.max(0, Math.floor(scrollTop / (cardHeight + cardGap)) - 1);
  const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + containerHeight) / (cardHeight + cardGap)) + 1);
  const startIndex = startRow * columns;
  const endIndex = Math.min(data.length, (endRow + 1) * columns);

  const fragment = document.createDocumentFragment();
  for (let i = startIndex; i < endIndex; i++) {
    const img = data[i];
    const row = Math.floor(i / columns);
    const col = i % columns;
    const card = document.createElement("div");
    card.className = "bm-image-card";
    card.dataset.gid = img.gid;
    card.style.cssText = `position: absolute; top: ${row * (cardHeight + cardGap)}px; left: ${col * (cardWidth + cardGap)}px; width: ${cardWidth}px; height: ${cardHeight}px;`;
    const thumbnailPath = getThumbnailPath(img);
    const filename = (img.attributes.filename || "未知文件").replace(/\.webp$/i, "");
    card.innerHTML = `<img src="${thumbnailPath}" alt="${filename}" loading="lazy" draggable="false" onerror="this.src='/placeholder.png'"><span class="bm-card-filename" title="${filename}">${filename}</span>`;
    if (selectionSet.has(String(img.gid))) card.classList.add("is-selected");
    fragment.appendChild(card);
  }
  spacer.appendChild(fragment);
  gridElement.appendChild(spacer);
}

function renderUnbannedGrid() {
  DOM_BM.unbannedCount.textContent = BanManagementState.filteredUnbanned.length;
  renderGrid(DOM_BM.unbannedGrid, BanManagementState.filteredUnbanned, "unbanned", BanManagementState.selectedUnbannedGids);
}
function renderBannedGrid() {
  DOM_BM.bannedCount.textContent = BanManagementState.filteredBanned.length;
  renderGrid(DOM_BM.bannedGrid, BanManagementState.filteredBanned, "banned", BanManagementState.selectedBannedGids);
}

/**
 * 执行封禁或解禁操作
 */
async function performBanAction(gids, action) {
  if (gids.length === 0) return;
  const isBan = action === "ban";
  let newBanList = [...BanManagementState.banList];
  let changesMade = 0;

  if (isBan) {
    gids.forEach((gid) => {
      if (!BanManagementState.banListGids.has(gid)) {
        const imgData = BanManagementState.allImageData.find((img) => String(img.gid) === gid);
        if (imgData) {
          newBanList.push({ gid: imgData.gid, path: imgData.path, timestamp: new Date().toISOString() });
          changesMade++;
        }
      }
    });
  } else {
    const gidsToUnbanSet = new Set(gids);
    newBanList = newBanList.filter((item) => !gidsToUnbanSet.has(String(item.gid)));
    changesMade = BanManagementState.banList.length - newBanList.length;
  }

  if (changesMade === 0) {
    displayToast(`没有需要${isBan ? "封禁" : "解禁"}的项目。`, "info");
    clearAllSelections();
    return;
  }

  if (await updateBanListOnServer(newBanList)) {
    displayToast(`成功${isBan ? "封禁" : "解禁"} ${changesMade} 张图片`, "success");
    BanManagementState.banList = newBanList;
    BanManagementState.banListGids = new Set(newBanList.map((item) => String(item.gid)));
    processAndSeparateImageData();
    filterAndRenderBanGrids();
    clearAllSelections();
  } else {
    displayToast(`${isBan ? "封禁" : "解禁"}操作失败`, "error");
  }
}

async function banSelected() {
  await performBanAction(Array.from(BanManagementState.selectedUnbannedGids), "ban");
}
async function unbanSelected() {
  await performBanAction(Array.from(BanManagementState.selectedBannedGids), "unban");
}

/**
 * 将更新后的封禁列表发送到服务器
 */
async function updateBanListOnServer(newList) {
  try {
    const result = await fetchJsonData("/api/update-ban-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newList) });
    return result.success;
  } catch (error) {
    console.error("更新封禁列表失败:", error);
    return false;
  }
}

/**
 * 切换主次面板视图
 */
function handlePanelSwap(event) {
  const clickedElement = event.currentTarget;
  const isSecondaryView = clickedElement.classList.contains("is-secondary-view") || clickedElement.classList.contains("is-secondary");
  if (!isSecondaryView || DOM_BM.layoutWrapper.classList.contains("is-animating")) {
    return;
  }
  clearAllSelections();
  resetAllBanFilters();
  DOM_BM.layoutWrapper.classList.add("is-animating");
  const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains("is-primary");
  const primaryPanel = isUnbannedPrimary ? DOM_BM.unbannedPanel : DOM_BM.bannedPanel;
  const secondaryPanel = isUnbannedPrimary ? DOM_BM.bannedPanel : DOM_BM.unbannedPanel;
  const primaryHeader = isUnbannedPrimary ? DOM_BM.unbannedHeader : DOM_BM.bannedHeader;
  const secondaryHeader = isUnbannedPrimary ? DOM_BM.bannedHeader : DOM_BM.unbannedHeader;

  setTimeout(() => {
    DOM_BM.rightColumn.append(secondaryHeader, secondaryPanel);
    DOM_BM.leftColumn.append(primaryHeader, primaryPanel);
    primaryPanel.classList.replace("is-primary", "is-secondary");
    primaryHeader.classList.add("is-secondary-view");
    secondaryPanel.classList.replace("is-secondary", "is-primary");
    secondaryHeader.classList.remove("is-secondary-view");
  }, 250);

  setTimeout(() => {
    DOM_BM.layoutWrapper.classList.remove("is-animating");
    applyBanFilters();
  }, 500);
}

/**
 * 设置所有事件监听器
 */
function setupBanManagementEventListeners() {
  DOM_BM.searchInput?.addEventListener("input", () => {
    clearTimeout(BanManagementState.searchDebounceTimer);
    BanManagementState.searchDebounceTimer = setTimeout(() => {
      const query = DOM_BM.searchInput.value.trim();
      if (query && searchWorker) {
        searchWorker.postMessage({ type: 'search', payload: { query, dataSource: 'indexed' } });
      } else {
        BanManagementState.workerSearchResults = null;
        applyBanFilters();
      }
    }, 300);
  });
  DOM_BM.filterCheckboxes?.forEach((cb) =>
    cb.addEventListener("change", () => {
      updateFilterToggleButtonTextForBM(cb.id);
      applyBanFilters();
    })
  );
  if (DOM_BM.unbannedGrid) setupDragAndClick_BM(DOM_BM.unbannedGrid, BanManagementState.selectedUnbannedGids, "unbanned");
  if (DOM_BM.bannedGrid) setupDragAndClick_BM(DOM_BM.bannedGrid, BanManagementState.selectedBannedGids, "banned");
  DOM_BM.unbannedGrid?.addEventListener("scroll", renderUnbannedGrid);
  DOM_BM.bannedGrid?.addEventListener("scroll", renderBannedGrid);
  DOM_BM.bannedPanel?.addEventListener("click", handlePanelSwap);
  DOM_BM.unbannedPanel?.addEventListener("click", handlePanelSwap);
  DOM_BM.bannedHeader?.addEventListener("click", handlePanelSwap);
  DOM_BM.unbannedHeader?.addEventListener("click", handlePanelSwap);
  DOM_BM.bulkSelectAllBtn?.addEventListener("click", selectAllInCurrentView);
  DOM_BM.bulkInvertBtn?.addEventListener("click", invertSelectionInCurrentView);
  DOM_BM.bulkBanBtn?.addEventListener("click", banSelected);
  DOM_BM.bulkUnbanBtn?.addEventListener("click", unbanSelected);
  DOM_BM.bulkCancelBtn?.addEventListener("click", clearAllSelections);
  DOM_BM.secondaryTagsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    DOM_BM.secondaryTagsDropdown.classList.toggle("hidden");
  });
  DOM_BM.secondaryTagsDropdown?.addEventListener("click", (e) => {
    const tagEl = e.target.closest(".tags-dropdown-tag-item");
    if (tagEl) {
      const tag = tagEl.dataset.tag;
      BanManagementState.selectedSecondaryTags.has(tag) ? BanManagementState.selectedSecondaryTags.delete(tag) : BanManagementState.selectedSecondaryTags.add(tag);
      tagEl.classList.toggle("selected");
      updateSecondaryTagsUIForBM();
      applyBanFilters();
    }
  });
  DOM_BM.clearSecondaryTagsBtn?.addEventListener("click", () => {
    BanManagementState.selectedSecondaryTags.clear();
    DOM_BM.secondaryTagsDropdown.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    updateSecondaryTagsUIForBM();
    applyBanFilters();
  });
  document.addEventListener("click", (e) => {
    if (DOM_BM.gameFilterDropdown && !DOM_BM.gameFilterDropdown.classList.contains("hidden") && !DOM_BM.gameFilterBtn.contains(e.target)) DOM_BM.gameFilterDropdown.classList.add("hidden");
    if (DOM_BM.secondaryTagsDropdown && !DOM_BM.secondaryTagsDropdown.classList.contains("hidden") && !DOM_BM.secondaryTagsBtn.contains(e.target) && !DOM_BM.secondaryTagsDropdown.contains(e.target))
      DOM_BM.secondaryTagsDropdown.classList.add("hidden");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Control" || e.key === "Meta") document.body.classList.add("ctrl-pressed");
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "Control" || e.key === "Meta") document.body.classList.remove("ctrl-pressed");
  });
  const preventDrag = (e) => e.preventDefault();
  DOM_BM.unbannedGrid?.addEventListener("dragstart", preventDrag);
  DOM_BM.bannedGrid?.addEventListener("dragstart", preventDrag);
  AppEvents.on("pflChanged", () => {
    if (DOM_BM.pane?.classList.contains("active") && BanManagementState.isInitialized) {
      processAndSeparateImageData();
      applyBanFilters();
      updatePanelTitles();
      displayToast("净化等级已更新，列表已刷新。", "info", 3000);
      BanManagementState.needsRefresh = false;
    } else {
      BanManagementState.needsRefresh = true;
    }
  });
}

// ==========================================================================
// == UI 辅助函数
// ==========================================================================
function getThumbnailPath(img) {
  const { storagebox, path } = img;
  if (!storagebox || !path) return "/placeholder.png";
  const originalCaseBox = AppState.availableStorageBoxes.find((b) => b.toLowerCase() === storagebox.toLowerCase()) || storagebox;
  return `/api/thumbnail/${originalCaseBox}/${path}`.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}
function updateFilterToggleButtonTextForBM(checkboxId) {
  const checkbox = document.getElementById(checkboxId);
  const button = checkbox?.closest(".filter-toggle-label")?.querySelector(".filter-toggle-button");
  if (checkbox && button) {
    button.textContent = checkbox.checked ? button.dataset.on : button.dataset.off;
    button.classList.toggle("active", checkbox.checked);
  }
}
function clearSelection(type) {
  const selectionSet = type === "unbanned" ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
  const grid = type === "unbanned" ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;
  selectionSet.clear();
  grid?.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
}
function clearAllSelections() {
  clearSelection("unbanned");
  clearSelection("banned");
  updateBulkActionBar();
}
function updateBulkActionBar() {
  const unbannedCount = BanManagementState.selectedUnbannedGids.size;
  const bannedCount = BanManagementState.selectedBannedGids.size;
  if (unbannedCount === 0 && bannedCount === 0) {
    DOM_BM.bulkActionBar.classList.add("hidden");
    return;
  }
  DOM_BM.bulkBanBtn.style.display = unbannedCount > 0 ? "flex" : "none";
  DOM_BM.bulkUnbanBtn.style.display = bannedCount > 0 ? "flex" : "none";
  let text = "";
  if (unbannedCount > 0) text += `已选 ${unbannedCount} 项待封禁。`;
  if (bannedCount > 0) text += `已选 ${bannedCount} 项待解禁。`;
  DOM_BM.bulkActionText.textContent = text;
  DOM_BM.bulkActionBar.classList.remove("hidden");
}
function resetAllBanFilters() {
  if (DOM_BM.searchInput) DOM_BM.searchInput.value = "";
  if (DOM_BM.gameFilterBtn) {
    DOM_BM.gameFilterBtn.textContent = "—所有游戏—";
    DOM_BM.gameFilterBtn.dataset.value = "";
  }
  if (DOM_BM.filterCheckboxes) {
    DOM_BM.filterCheckboxes.forEach((cb) => {
      if (cb.checked) {
        cb.checked = false;
        updateFilterToggleButtonTextForBM(cb.id);
      }
    });
  }
  if (BanManagementState.selectedSecondaryTags) {
    BanManagementState.selectedSecondaryTags.clear();
    DOM_BM.secondaryTagsDropdown?.querySelectorAll(".selected").forEach((el) => el.classList.remove("selected"));
    updateSecondaryTagsUIForBM();
  }
}
function selectAllInCurrentView() {
  const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains("is-primary");
  const targetSet = isUnbannedPrimary ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
  const sourceData = isUnbannedPrimary ? BanManagementState.filteredUnbanned : BanManagementState.filteredBanned;
  const grid = isUnbannedPrimary ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;
  sourceData.forEach((img) => targetSet.add(String(img.gid)));
  grid.querySelectorAll(".bm-image-card").forEach((card) => card.classList.add("is-selected"));
  updateBulkActionBar();
}
function invertSelectionInCurrentView() {
  const isUnbannedPrimary = DOM_BM.unbannedPanel.classList.contains("is-primary");
  const targetSet = isUnbannedPrimary ? BanManagementState.selectedUnbannedGids : BanManagementState.selectedBannedGids;
  const sourceData = isUnbannedPrimary ? BanManagementState.filteredUnbanned : BanManagementState.filteredBanned;
  const grid = isUnbannedPrimary ? DOM_BM.unbannedGrid : DOM_BM.bannedGrid;
  sourceData.forEach((img) => {
    const gid = String(img.gid);
    targetSet.has(gid) ? targetSet.delete(gid) : targetSet.add(gid);
  });
  grid.querySelectorAll(".bm-image-card").forEach((card) => card.classList.toggle("is-selected"));
  updateBulkActionBar();
}
function checkSelection(gridElement, selectionSet) {
  if (!DOM_BM.selectionBox.parentElement) return;
  const boxRect = DOM_BM.selectionBox.getBoundingClientRect();
  gridElement.querySelectorAll(".bm-image-card").forEach((card) => {
    const cardRect = card.getBoundingClientRect();
    const gid = card.dataset.gid;
    const isIntersecting = !(boxRect.right < cardRect.left || boxRect.left > cardRect.right || boxRect.bottom < cardRect.top || boxRect.top > cardRect.bottom);
    if (isIntersecting) {
      if (!selectionSet.has(gid)) {
        selectionSet.add(gid);
        card.classList.add("is-selected");
      }
    } else if (!document.body.classList.contains("ctrl-pressed")) {
      if (selectionSet.has(gid)) {
        selectionSet.delete(gid);
        card.classList.remove("is-selected");
      }
    }
  });
  updateBulkActionBar();
}
function setupCustomGameFilterForBM(btnId, dropdownId, callback) {
  const gameOptions = [
    { value: "", text: "—所有游戏—" },
    { value: "gs-character", text: "原神" },
    { value: "sr-character", text: "星铁" },
    { value: "zzz-character", text: "绝区零" },
    { value: "waves-character", text: "鸣潮" },
    { value: "unknown", text: "未知" },
  ];
  const btn = document.getElementById(btnId),
    dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;
  dropdown.innerHTML = "";
  gameOptions.forEach((opt) => {
    const item = document.createElement("div");
    item.className = "custom-select-option";
    item.dataset.value = opt.value;
    item.textContent = opt.text;
    item.addEventListener("click", () => {
      btn.textContent = opt.text;
      btn.dataset.value = opt.value;
      dropdown.classList.add("hidden");
      if (callback) callback();
    });
    dropdown.appendChild(item);
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("hidden");
  });
}
async function fetchAndPopulateSecondaryTagsForBM() {
  try {
    BanManagementState.availableTags = await fetchJsonData("/api/secondary-tags");
    const contentArea = DOM_BM.secondaryTagsDropdown.querySelector(".tags-dropdown-content");
    contentArea.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const [category, tags] of Object.entries(BanManagementState.availableTags)) {
      const categoryEl = document.createElement("div");
      categoryEl.className = "tags-dropdown-category";
      categoryEl.innerHTML = `<h6 class="tags-dropdown-category-title">${category}</h6>`;
      const wrapperEl = document.createElement("div");
      wrapperEl.className = "tags-dropdown-tags-wrapper";
      tags.forEach((tag) => {
        const tagEl = document.createElement("span");
        tagEl.className = "tags-dropdown-tag-item";
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
  DOM_BM.secondaryTagsBtn.textContent = count > 0 ? `二级标签 (${count})` : "二级标签";
  DOM_BM.secondaryTagsBtn.classList.toggle("active-filter", count > 0);
}
function setupDragAndClick_BM(gridElement, selectionSet, type) {
  let isMouseDown = false,
    isDragging = false,
    startX,
    startY;
  const handleMouseMove = (e) => {
    if (!isMouseDown) return;
    if (!isDragging && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
      isDragging = true;
      BanManagementState.activeDragSelect = type;
      if (!e.ctrlKey && !e.metaKey) clearSelection(type);
      const spacer = gridElement.querySelector('div[style*="position: relative"]');
      if (spacer) {
        const gridRect = gridElement.getBoundingClientRect();
        const initialLeft = startX - gridRect.left + gridElement.scrollLeft;
        const initialTop = startY - gridRect.top + gridElement.scrollTop;
        DOM_BM.selectionBox.style.left = `${initialLeft}px`;
        DOM_BM.selectionBox.style.top = `${initialTop}px`;
        DOM_BM.selectionBox.style.width = "0px";
        DOM_BM.selectionBox.style.height = "0px";
        spacer.appendChild(DOM_BM.selectionBox);
        DOM_BM.selectionBox.classList.remove("hidden");
      }
    }
    if (isDragging) {
      const rect = gridElement.getBoundingClientRect();
      let currentMouseX = e.clientX;
      if (currentMouseX < rect.left) {
        currentMouseX = rect.left;
      } else if (currentMouseX > rect.right) {
        currentMouseX = rect.right;
      }
      const currentX = currentMouseX - rect.left + gridElement.scrollLeft;
      const currentY = e.clientY - rect.top + gridElement.scrollTop;
      const initialX = startX - rect.left + gridElement.scrollLeft;
      const initialY = startY - rect.top + gridElement.scrollTop;
      let boxX = Math.min(initialX, currentX);
      let boxY = Math.min(initialY, currentY);
      let boxWidth = Math.abs(currentX - initialX);
      if (boxX + boxWidth > gridElement.scrollWidth) {
        boxWidth = gridElement.scrollWidth - boxX;
      }
      if (boxX < 0) {
        boxWidth += boxX;
        boxX = 0;
      }
      const boxHeight = Math.abs(currentY - initialY);
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
      if (BanManagementState.activeDragSelect === type) {
        DOM_BM.selectionBox.classList.add("hidden");
        if (DOM_BM.selectionBox.parentElement) DOM_BM.selectionBox.parentElement.removeChild(DOM_BM.selectionBox);
        updateBulkActionBar();
        BanManagementState.activeDragSelect = null;
      }
    } else {
      const card = e.target.closest(".bm-image-card");
      if (card) {
        const gid = card.dataset.gid;
        selectionSet.has(gid) ? selectionSet.delete(gid) : selectionSet.add(gid);
        card.classList.toggle("is-selected");
        updateBulkActionBar();
      } else if (!e.ctrlKey && !e.metaKey) {
        clearAllSelections();
      }
    }
    isMouseDown = false;
    isDragging = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };
  gridElement.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.offsetX >= gridElement.clientWidth) return;
    isMouseDown = true;
    isDragging = false;
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
}
function updatePanelTitles() {
  const updateHeader = (headerElement, imageDataSet) => {
    if (!headerElement || !imageDataSet) return;
    const counts = { "gs-character": 0, "sr-character": 0, "zzz-character": 0, "waves-character": 0, unknown: 0 };
    imageDataSet.forEach((img) => {
      const game = img.sourceGallery;
      if (counts.hasOwnProperty(game)) counts[game]++;
      else counts["unknown"]++;
    });
    for (const [gameKey, count] of Object.entries(counts)) {
      const countSpan = headerElement.querySelector(`.game-stat-item[data-game="${gameKey}"] .game-count`);
      if (countSpan) countSpan.textContent = count;
    }
  };
  updateHeader(DOM_BM.unbannedHeader, BanManagementState.unbannedImages);
  updateHeader(DOM_BM.bannedHeader, BanManagementState.bannedImages);
}
