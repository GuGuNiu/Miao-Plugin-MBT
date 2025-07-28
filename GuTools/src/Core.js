// ==========================================================================
// 核心: 全局状态、常量、DOM 缓存、工具函数及初始化。
// ==========================================================================

// --- 常量定义 ---
const API_ENDPOINTS = {
  FETCH_GALLERY_IMAGES: "/api/images",
  FETCH_USER_DATA: "/api/userdata",
  UPDATE_USER_DATA: "/api/update-userdata",
  FETCH_TEMP_IMAGES: "/api/temp-images",
  FETCH_CHARACTER_FOLDERS: "/api/character-folders",
  FETCH_IMAGE_MD5: "/api/image-md5",
  FETCH_LAST_FILE_NUMBER: "/api/last-file-number",
  IMPORT_IMAGE_TO_GALLERY: "/api/import-image",
  FETCH_EXTERNAL_USER_DATA: "/api/external-userdata",
  UPDATE_EXTERNAL_USER_DATA: "/api/update-external-userdata",
  FETCH_GALLERY_CONFIG: "/api/gallery-config",
  UPDATE_GALLERY_CONFIG: "/api/update-gallery-config",
  FETCH_PLUGIN_IMAGES: "/api/external-images",
  RENAME_SEQUENCE_FILES: "/api/rename-sequence-files",
  FETCH_BACKGROUND_IMAGES: "/api/background-images",
  FETCH_FOLDER_CONTENTS: "/api/folder-contents",
  BATCH_UPDATE_STORAGEBOX: "/api/batch-update-storagebox",
  FETCH_FILE_SIZES: "/api/file-sizes",
};

const DELAYS = {
  INPUT_DEBOUNCE: 300,
  DATA_LIST_SEARCH_DEBOUNCE: 300,
  IMPORT_SEARCH_DEBOUNCE: 300,
  PLUGIN_GALLERY_SEARCH_DEBOUNCE: 300,
  MESSAGE_CLEAR_DEFAULT: 3000,
  GENERATOR_NEXT_IMAGE_DELAY: 1500,
  TOAST_DEFAULT_DURATION: 3000,
  TOAST_ERROR_DURATION: 5000,
};

const UI_CLASSES = {
  HIDDEN: "hidden",
  ACTIVE: "active",
  SELECTED: "selected",
  VISIBLE: "visible",
  ERROR: "error",
  SUCCESS: "success",
  WARNING: "warning",
  INFO: "info",
  FADE_IN: "fade-in",
  FADE_OUT: "fade-out",
  NO_METADATA: "no-metadata",
  EDITABLE: "editable",
  SLIDING_OUT: "sliding-out",
  INITIALLY_HIDDEN: "initially-hidden",
  DISABLED: "disabled",
  LOADING: "loading",
};

const SECONDARY_TAGS_LIST = [

  // 🧑‍💼 职业制服类
  "制服", "女仆装", "护士", "教师", "情趣内衣",

  // 🎓 校园类服装
  "JK", "体操服", "死库水", "和服", "运动服", "校服",
  
  // 👗 礼服/特殊场景服饰类
  "兔女郎", "旗袍", "泳装", "花嫁", "礼服", "婚纱",
 
  // 💧 裙子类
  "连身裙", "超短裙", "睡裙", "泳裙",

  // 🧦 装饰与配件类
  "过膝袜", "白丝", "黑丝", "网袜", "小腿袜", "吊带袜", "半身袜",  "高跟", "眼镜", "颈环", "猫耳", "兔耳",
 
  // 🔥 身体特征类
  "巨乳", "贫乳", "酥胸", "翘臀", "美腿", "绝对领域", "腋下", "肚脐", "腹肌", "裸足", "美背",
  "脚底", "洁白肌肤", "乳晕", "乳沟", "露出", "生殖器",
  
  // 🧒 人物类型类
  "萝莉", "猫娘", "少女", "御姐", "熟女", "魅魔", "大小姐", "男娘", "正太", "TS", "扶她", "沃尔玛购物袋",

  // ❤  情绪/表情/行为类
  "发情", "淫纹", "挑逗"

];

const PAGINATION = {
  PLUGIN_GALLERY_ITEMS_PER_PAGE: 8,
  FILE_SIZE_ITEMS_PER_PAGE: 8,
};

let lazyLoadObserver = null;

// --- 全局状态管理  ---
const AppState = {
  isSettingInputProgrammatically: false,
  isProcessingSelection: false,
  generator: {
    isShowingFolderSuggestions: false,
    showingRelatedImages: false,
    currentSelection: null, 
    currentGeneratedId: null,
    currentCalculatedMd5: null,
    searchDelayTimer: null,
    writingTimerId: null,
    writingStartTime: null,
    successTimerId: null,
    successStartTime: null,
    backgroundWorker: null,
    lastQuerySentToWorker: null,
  },
  importer: {
    dataLoaded: false,
    tempImagesList: [],
    characterFoldersList: [],
    selectedTempImageInfo: null, 
    selectedTargetFolder: null,
    selectedStorageBox: null, 
    suggestedFilenameBase: "",
    suggestedFilenameNum: 0,
    suggestedFilenameExt: "",
    searchDebounceTimer: null,
  },
  pluginGallery: {
    dataLoaded: false,
    allImages: [],
    savedEntries: [],
    savedPaths: new Set(),
    selectedFolder: null,
    selectedImagePath: null,
    currentPage: 1,
    totalPages: 1,
    searchDebounceTimer: null,
    currentSourceFilter: "all",
  },
  md5Checker: { isRunning: false, isAborted: false },
  sequenceManager: { isRunning: false },
  jsonCalibrator: { isRunning: false },
  storageboxCalibrator: { isRunning: false, isAborted: false },
  fileSizeChecker: {
    dataLoaded: false,
    allFiles: [],
    filteredFiles: [],
    currentPage: 1,
    totalPages: 1,
  },
  dataList: {
    currentEditPath: null,
    searchDebounceTimer: null,
    virtualScrollInfo: {
      container: null,
      innerSpacer: null,
      visibleItemsContainer: null,
      itemHeight: 180,
      itemsPerRow: 3, 
      bufferItems: 1,
      scrollTop: 0,
      filteredData: [],
      throttleDelay: 16,
    },
    isScrolling: null,
  },
  isSwitchingTabs: false,
  messageClearTimer: null,
  currentGuToolMode: "generator",
  galleryImages: [], // 存储所有仓库的主图库图片列表
  userData: [], // 存储 ImageData.json 内容
  userDataPaths: new Set(), // 存储 ImageData.json 中图片的完整 Web 路径
  availableStorageBoxes: [], // 存储检测到的可用仓库名称列表
};

// --- DOM 元素引用缓存 DOM ---
const DOM = {};

/**
 * 缓存常用 DOM 元素的引用
 */
function cacheDomElements() {
  console.log("缓存 DOM 元素引用...");
  // --- 通用 / 模态框 ---
  DOM.toastContainer = document.getElementById("toast-container");
  DOM.imageModalOverlay = document.getElementById("imageModalOverlay");
  DOM.modalImageViewer = document.getElementById("modalImageViewer");
  DOM.modalCloseButton = document.getElementById("modalCloseButton");
  DOM.editAttributeModal = document.getElementById("editAttributeModal");
  DOM.modalFilenameSpan = document
    .getElementById("modalFilename")
    ?.querySelector("span");
  DOM.modalEntryPathInput = document.getElementById("modalEntryPath");
  DOM.modalRatingRadios = document.querySelectorAll(
    'input[name="modalRating"]'
  );
  DOM.modalLayoutRadios = document.querySelectorAll(
    'input[name="modalLayout"]'
  );
  DOM.modalIsEasterEggCheckbox = document.getElementById("modalIsEasterEgg");
  DOM.modalIsAiImageCheckbox = document.getElementById("modalIsAiImage");
  DOM.modalisBanCheckbox = document.getElementById("modalisBan");
  DOM.modalSaveButton = document.getElementById("modalSaveButton");
  DOM.modalCancelButton = document.getElementById("modalCancelButton");
  DOM.modalMessageArea = document.getElementById("modalMessageArea");

  // --- Tabs & 导航 ---
  DOM.tabButtons = document.querySelectorAll(".tab-button");
  DOM.tabPanes = document.querySelectorAll(".tab-pane");
  DOM.currentTimeElement = document.getElementById("currentTime");
  DOM.appVersionElement = document.getElementById("appVersion");

  // --- Home 面板 ---
  DOM.tuKuOPStatusText = document.getElementById('tuKuOPStatusText');
  DOM.pflStatusText = document.getElementById('pflStatusText');
  DOM.tuKuOPToggleSwitch = document.getElementById('tuKuOPToggleSwitch');

  // --- GuTools 面板 (容器 & 视图) ---
  DOM.guToolsPane = document.getElementById("GuTools");
  DOM.generatorPaneView = document.getElementById("generatorPaneView");
  DOM.importPaneView = document.getElementById("importPaneView");
  DOM.md5PaneView = document.getElementById("md5PaneView");
  DOM.sequencePaneView = document.getElementById("sequencePaneView");
  DOM.jsonCalibrationPaneView = document.getElementById(
    "jsonCalibrationPaneView"
  );
  DOM.guToolsModeButtonGroups = document.querySelectorAll(
    "#GuTools .gu-tools-mode-buttons"
  );

  // --- GuTools - Generator 视图 ---
  DOM.generatorSearchInput = document.getElementById("searchInput");
  DOM.generatorSuggestionList = document.getElementById("suggestions");
  DOM.generatorPreviewArea = document.getElementById("previewArea");
  DOM.generatorPreviewImage = document.getElementById("previewImage");
  DOM.generatorAttributesPanel = document.getElementById("attributesPanel");
  DOM.generatorRatingRadios = document.querySelectorAll('input[name="rating"]');
  DOM.generatorLayoutRadios = document.querySelectorAll('input[name="layout"]');
  DOM.generatorIsEasterEggCheckbox = document.getElementById(
    "isEasterEggCheckbox"
  );
  DOM.generatorIsAiImageCheckbox = document.getElementById("isAiImageCheckbox");
  DOM.generatorGameTags = {
    gs: document.getElementById("gameTagGs"),
    sr: document.getElementById("gameTagSr"),
    zzz: document.getElementById("gameTagZzz"),
    waves: document.getElementById("gameTagWaves"),
  };
  DOM.generatorStorageBoxDisplay = document.getElementById("storageBoxDisplay");
  DOM.generatorMd5DisplayInput = document.getElementById("md5DisplayInput");
  DOM.generatorIdDisplayInput = document.getElementById("idDisplayInput");
  DOM.generatorEntryCountDisplay = document.getElementById("entryCountDisplay");
  DOM.generatorSaveButton = document.getElementById("saveButton");
  DOM.generatorMessageArea = document.getElementById("messageArea");

  // --- GuTools - Import 视图 ---
  DOM.importerTempImageSearchInput = document.getElementById(
    "tempImageSearchInput"
  );
  DOM.importerTempImageSuggestions = document.getElementById(
    "tempImageSuggestions"
  );
  DOM.importerTempImagePreviewArea = document.getElementById(
    "tempImagePreviewArea"
  );
  DOM.importerTempImagePreview = document.getElementById("tempImagePreview");
  DOM.importerAttributesPanel = document.getElementById(
    "importAttributesPanel"
  );
  DOM.importerRatingRadios = document.querySelectorAll(
    'input[name="importRating"]'
  );
  DOM.importerLayoutRadios = document.querySelectorAll(
    'input[name="importLayout"]'
  );
  DOM.importerIsEasterEggCheckbox = document.getElementById(
    "importIsEasterEggCheckbox"
  );
  DOM.importerIsAiImageCheckbox = document.getElementById(
    "importIsAiImageCheckbox"
  );
  DOM.importerTargetFolderSearchInput = document.getElementById(
    "targetFolderSearchInput"
  );
  DOM.importerTargetFolderSuggestions = document.getElementById(
    "targetFolderSuggestions"
  );
  DOM.importerFinalFilenameInput =
    document.getElementById("finalFilenameInput");
  DOM.importerEditFilenameButton =
    document.getElementById("editFilenameButton");
  DOM.importerAddToGalleryButton =
    document.getElementById("addToGalleryButton");
  DOM.importerMessageArea = document.getElementById("importMessageArea");
  DOM.importerDownloadSourceInput = document.getElementById(
    "importDownloadSourceInput"
  );

  // --- GuTools - MD5 校准视图 ---
  DOM.md5StartButton = document.getElementById("startMD5Calibration");
  DOM.md5AbortButton = document.getElementById("abortMD5Calibration");
  DOM.md5StatusArea = document.getElementById("md5CalibrationStatus");
  DOM.md5TotalFilesChecked = document.getElementById("totalFilesChecked");
  DOM.md5FilesCheckedCount = document.getElementById("filesCheckedCount");
  DOM.md5TotalJsonEntries = document.getElementById("totalMD5Count");
  DOM.md5MismatchedCount = document.getElementById("mismatchedMD5Count");
  DOM.md5ProgressText = document.getElementById("md5CalibrationProgress");
  DOM.md5ProgressBar = document.getElementById("md5CalibrationProgressBar");
  DOM.md5JsonListContainer = document.getElementById("jsonMd5ListContainer");
  DOM.md5JsonTotalDisplay = document.getElementById("jsonTotalEntriesDisplay");
  DOM.md5MismatchedList = document.getElementById("mismatchedMD5List");
  DOM.md5MismatchedDisplay = document.getElementById("mismatchedCountDisplay");
  DOM.md5FixAllButton = document.getElementById("fixAllMismatchedMD5");
  DOM.md5FilesNotInJsonCount = document.getElementById("filesNotInJsonCount");
  DOM.md5FilesNotInJsonList = document.getElementById("filesNotInJsonList");

  // --- GuTools - 序号管理视图 ---
  DOM.sequenceAnalyzeButton = document.getElementById("analyzeSequences");
  DOM.sequenceStatusArea = document.getElementById("sequenceAnalysisStatus");
  DOM.sequenceIssuesList = document.getElementById("sequenceIssuesList");
  DOM.sequenceFixButton = document.getElementById("fixSequenceIssues");

  // --- GuTools - JSON 校准视图 ---
  DOM.jsonCalStartButton = document.getElementById("startJsonCalibration");
  DOM.jsonCalStatusArea = document.getElementById("jsonCalibrationStatus");
  DOM.jsonCalEntriesCheckedCount = document.getElementById(
    "jsonEntriesCheckedCount"
  );
  DOM.jsonCalFilesCheckedCount = document.getElementById(
    "jsonFilesCheckedCount"
  );
  DOM.jsonCalMissingCount = document.getElementById("missingFilesCount");
  DOM.jsonCalProgressText = document.getElementById("jsonCalibrationProgress");
  DOM.jsonCalProgressBar = document.getElementById(
    "jsonCalibrationProgressBar"
  );
  DOM.jsonCalMissingList = document.getElementById("missingFilesList");
  DOM.jsonCalMissingDisplay = document.getElementById(
    "missingFilesCountDisplay"
  );
  DOM.jsonCalRemoveButton = document.getElementById("removeMissingEntriesBtn");

  // --- GuTools - 仓库转移视图 ---
  DOM.stockroomGoPaneView = document.getElementById('stockroomGoPaneView');
  DOM.sourceStorageBoxSelect = document.getElementById('sourceStorageBoxSelect');
  DOM.sourceFolderSelect = document.getElementById('sourceFolderSelect');
  DOM.targetStorageBoxSelectGo = document.getElementById('targetStorageBoxSelectGo');
  DOM.transferFolderButton = document.getElementById('transferFolderButton');
  DOM.stockroomGoStatus = document.getElementById('stockroomGoStatus');
  DOM.stockroomInfoContainer = document.getElementById('stockroomInfoContainer');

  // --- GuTools - Storagebox 校准视图 ---
  DOM.storageboxCalibrationPaneView = document.getElementById('storageboxCalibrationPaneView'); 
  DOM.sbxCalStartButton = document.getElementById('sbxCalStartButton');
  DOM.sbxCalAbortButton = document.getElementById('sbxCalAbortButton');
  DOM.sbxCalFixButton = document.getElementById('sbxCalFixButton');
  DOM.sbxCalStatusArea = document.getElementById('sbxCalStatusArea');
  DOM.sbxCalProgressBar = document.getElementById('sbxCalProgressBar');
  DOM.sbxCalCurrentScanArea = document.getElementById('sbxCalCurrentScanArea');
  DOM.sbxCalMismatchList = document.getElementById('sbxCalMismatchList');
  DOM.sbxCalTotalJsonDisplay = document.getElementById('sbxCalTotalJsonDisplay');
  DOM.sbxCalTotalFilesDisplay = document.getElementById('sbxCalTotalFilesDisplay');
  DOM.sbxCalMismatchCountDisplay = document.getElementById('sbxCalMismatchCountDisplay');
  DOM.sbxCalMismatchCountDisplayInner = document.getElementById('sbxCalMismatchCountDisplayInner'); 

  // --- GuTools - 文件大小核查视图 ---
  DOM.fileSizePaneView = document.getElementById('fileSizePaneView');
  DOM.fsMinSizeInput = document.getElementById('fsMinSizeInput');
  DOM.fsMaxSizeInput = document.getElementById('fsMaxSizeInput');
  DOM.fsUnitSelector = document.getElementById('fsUnitSelector');
  DOM.fsApplyFilterBtn = document.getElementById('fsApplyFilterBtn');
  DOM.fsResetFilterBtn = document.getElementById('fsResetFilterBtn');
  DOM.fsResultsGrid = document.getElementById('fsResultsGrid');
  DOM.fsStatusText = document.getElementById('fsStatusText');
  DOM.fsGameFilter = document.getElementById('fsGameFilter');
  DOM.fsStorageBoxFilter = document.getElementById('fsStorageBoxFilter');
  DOM.fsPaginationControls = document.getElementById('fsPaginationControls');
  DOM.fsPrevPageBtn = document.getElementById('fsPrevPageBtn');
  DOM.fsNextPageBtn = document.getElementById('fsNextPageBtn');
  DOM.fsPageInfo = document.getElementById('fsPageInfo');

  // --- GuTools - 二级标签编辑器视图 ---
  DOM.secondaryTagEditorPaneView = document.getElementById('secondaryTagEditorPaneView');
  DOM.stePreviewImage = document.getElementById('stePreviewImage');
  DOM.stePreviewPlaceholder = document.getElementById('stePreviewPlaceholder');
  DOM.steImageInfo = document.getElementById('steImageInfo');
  DOM.steSearchInput = document.getElementById('steSearchInput');
  DOM.steSearchWrapper = document.getElementById('steSearchWrapper');
  DOM.steSuggestions = document.getElementById('steSuggestions');
  DOM.steProgressDisplay = document.getElementById('steProgressDisplay');
  DOM.stePredefinedTags = document.getElementById('stePredefinedTags');
  DOM.steManualTags = document.getElementById('steManualTags');
  DOM.steTagList = document.getElementById('steTagList');
  DOM.steTagInput = document.getElementById('steTagInput');
  DOM.steSkipButton = document.getElementById('steSkipButton');
  DOM.steSaveButton = document.getElementById('steSaveButton');

  // --- Data List 面板 ---
  DOM.dataListPane = document.getElementById("dataListPane");
  DOM.filterGameBtn = document.getElementById("filterGameBtn");
  DOM.filterGameDropdown = document.getElementById("filterGameDropdown");
  DOM.dataListSearchInput = document.getElementById("dataListSearchInput");
  DOM.dataListFilterPx18 = document.getElementById("filterPx18");
  DOM.dataListFilterRx18 = document.getElementById("filterRx18");
  DOM.dataListFilterNormal = document.getElementById("filterNormal");
  DOM.dataListFilterFullscreen = document.getElementById("filterFullscreen");
  DOM.dataListFilterEasterEgg = document.getElementById("filterEasterEgg");
  DOM.dataListFilterAiImage = document.getElementById("filterAiImage");
  DOM.dataListFilterIsBan = document.getElementById("filterisBan");
  DOM.dataListCountDisplay = document.getElementById("dataListCountDisplay");
  DOM.dataListContainer = document.getElementById("dataListContainer");
  DOM.secondaryTagsFilterBtn = document.getElementById("secondaryTagsFilterBtn");
  DOM.secondaryTagsDropdown = document.getElementById("secondaryTagsDropdown");

  // --- Plugin Gallery 面板 ---
  DOM.pluginGalleryPane = document.getElementById("pluginGalleryPane");
  DOM.pluginGalleryFolderSearchInput = document.getElementById(
    "pluginFolderSearchInput"
  );
  DOM.pluginGallerySourceFilterButtons = document.querySelectorAll(
    "#pluginSourceFilterButtons .source-filter-btn"
  );
  DOM.pluginGalleryFolderListContainer = document.getElementById(
    "pluginFolderListContainer"
  );
  DOM.pluginGalleryFolderLoading = document.getElementById(
    "pluginFolderLoading"
  );
  DOM.pluginGalleryFolderNoResults = document.getElementById(
    "pluginFolderNoResults"
  );
  DOM.pluginGalleryImageGridContainer = document.getElementById(
    "pluginImageGridPreviewContainer"
  );
  DOM.pluginGalleryPreviewPlaceholder = document.getElementById(
    "pluginPreviewPlaceholder"
  );
  DOM.pluginGalleryImageGrid = document.getElementById(
    "pluginImageGridPreview"
  );
  DOM.pluginGalleryPaginationControls = document.getElementById(
    "pluginPaginationControls"
  );
  DOM.pluginGalleryPrevPageBtn = document.getElementById("pluginPrevPageBtn");
  DOM.pluginGalleryNextPageBtn = document.getElementById("pluginNextPageBtn");
  DOM.pluginGalleryPageInfo = document.getElementById("pluginPageInfo");
  DOM.pluginGalleryAttributeInfoArea = document.getElementById(
    "pluginAttributeInfoArea"
  );
  DOM.pluginGalleryEditorPlaceholder = document.getElementById(
    "pluginEditorPlaceholder"
  );

  // --- Advanced Management 面板 ---
  DOM.advancedManagementPane = document.getElementById(
    "advancedManagementPane"
  );

  // --- 验证核心元素 ---
  const essentialElements = [
    DOM.stockroomGoPaneView,
    DOM.toastContainer,
    DOM.tabButtons,
    DOM.tabPanes,
    DOM.generatorPaneView,
    DOM.importPaneView,
    DOM.md5PaneView,
    DOM.sequencePaneView,
    DOM.jsonCalibrationPaneView,
    DOM.stockroomInfoContainer,
    DOM.storageboxCalibrationPaneView,
    DOM.dataListPane,
    DOM.pluginGalleryPane,
    DOM.md5JsonListContainer,
    DOM.jsonCalMissingList,
    DOM.appVersionElement,
    DOM.tuKuOPStatusText, 
    DOM.pflStatusText,
    DOM.tuKuOPToggleSwitch,
  ];
  const missingKeys = essentialElements
    .map((el, i) => {
      const key = Object.keys(DOM).find((k) => DOM[k] === el);
      return !el || (el instanceof NodeList && el.length === 0)
        ? key || `Unknown Element #${i}`
        : null;
    })
    .filter(Boolean);

  if (missingKeys.length > 0) {
    console.error(
      `核心 UI 元素缺失: ${missingKeys.join(
        ", "
      )} 请检查 HTML ID 和 cacheDomElements`
    );
    alert("页面加载错误：核心界面元素缺失，请检查控制台。");
  } else {
    console.log("DOM 元素引用缓存成功。");
  }
}

// --- 核心工具函数 ---

/**
 * 发起 fetch 请求并处理 JSON 响应
 * @param {string} url 请求 URL
 * @param {object} options fetch 选项
 * @returns {Promise<any>} 解析后的 JSON 数据或文本
 */
async function fetchJsonData(url, options = {}) {
  const fetchOptions = { cache: "no-store", ...options };
  console.debug(`请求: ${fetchOptions.method || "GET"} ${url}`);
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status} ${response.statusText} @ ${url}`;
      try {
        const errData = await response.json();
        errorMsg = errData.error || JSON.stringify(errData);
      } catch {
        try {
          const txt = await response.text();
          if (txt) errorMsg = txt;
        } catch {
          /* 忽略 */
        }
      }
      console.error(`请求失败 ${url}: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const jsonData = await response.json();
      console.debug(`请求成功: ${url}`);
      return jsonData;
    } else {
      console.warn(`响应非 JSON ${url}: ${contentType || "未知"}`);
      return await response.text();
    }
  } catch (error) {
    console.error(`处理请求 ${url} 出错:`, error.message);
    throw error;
  }
}

/**
 * 获取指定图片路径的 MD5 值
 * @param {string} imagePath 图片的 Web 路径 e.g., '/Miao-Plugin-MBT/gs-character/角色/文件.webp'
 * @returns {Promise<string|null>} 成功则返回 MD5 字符串 失败则返回 null
 */
async function fetchImageMd5(imagePath) {
  if (!imagePath) {
    console.warn("fetchImageMd5: 图片路径为空");
    return null;
  }
  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  const url = `${API_ENDPOINTS.FETCH_IMAGE_MD5}?path=${encodeURIComponent(
    normalizedPath
  )}`;
  try {
    const result = await fetchJsonData(url);
    if (result?.success === true && typeof result.md5 === "string") {
      return result.md5;
    } else {
      console.warn(`获取 ${normalizedPath} MD5 失败: 服务器返回`, result);
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * 从后端获取角色文件夹列表 (所有仓库汇总)
 * @returns {Promise<void>}
 */
async function fetchCharacterFolders() {
  console.log("Core: 正在获取角色文件夹列表...");
  try {
    const data = await fetchJsonData(API_ENDPOINTS.FETCH_CHARACTER_FOLDERS);
    AppState.importer.characterFoldersList = Array.isArray(data) ? data : [];
    console.log(
      `Core: 成功加载 ${AppState.importer.characterFoldersList.length} 个角色文件夹`
    );
  } catch (error) {
    console.error("Core: 加载角色文件夹列表失败:", error);
    displayToast(
      "加载角色文件夹列表失败",
      UI_CLASSES.WARNING,
      DELAYS.TOAST_ERROR_DURATION
    );
    AppState.importer.characterFoldersList = [];
  }
}

/**
 * 向后端发送请求更新用户数据 JSON 文件 区分内部/外部
 * @param {Array<object>} newData 最新的完整数据列表
 * @param {string} successMsg 操作成功时在目标区域显示的短消息
 * @param {string} targetElementId 消息显示的目标区域元素的 ID
 * @param {boolean} [isExternalData=false] true 表示更新外部数据 false 表示更新内部数据
 * @param {number|null} [successDuration=DELAYS.MESSAGE_CLEAR_DEFAULT] 成功消息显示时长 null 则不自动消失
 * @returns {Promise<boolean>} 操作是否成功
 */
async function updateUserData(
  newData,
  successMsg = "更新成功",
  targetElementId = "generatorMessageArea",
  isExternalData = false,
  successDuration = DELAYS.MESSAGE_CLEAR_DEFAULT,
  preventListRefresh = false 
) {
  let targetElement = document.getElementById(targetElementId);
  if (!targetElement && targetElementId !== "toast") {
    targetElementId = "toast";
  }

  const apiUrl = isExternalData
    ? API_ENDPOINTS.UPDATE_EXTERNAL_USER_DATA
    : API_ENDPOINTS.UPDATE_USER_DATA;
  const dataTypeDesc = isExternalData ? "外部插件" : "内部主图库";
  
  const displayFunc =
    targetElementId === "toast" ? displayToast : displayScopedMessage;
  const messageArgs = targetElementId === "toast" ? [] : [targetElement];

  try {
    const result = await fetchJsonData(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newData),
    });

    if (!result?.success) {
      throw new Error(result?.error || "服务器未能成功保存数据");
    }

    if (isExternalData) {
      AppState.pluginGallery.savedEntries = newData;
      AppState.pluginGallery.savedPaths = new Set(
        newData.map((entry) => entry.path).filter(Boolean)
      );
      if (
        DOM.pluginGalleryPane?.classList.contains(UI_CLASSES.ACTIVE) &&
        typeof renderPluginFolderList === "function"
      ) {
        renderPluginFolderList();
      }
    }  else { 
      AppState.userData = newData; 
      AppState.userDataPaths = new Set();
      AppState.userData.forEach(e => {
          const originalCaseStorageBox = AppState.availableStorageBoxes.find(
            (box) => box.toLowerCase() === e.storagebox?.toLowerCase()
          );
          if (e.path && originalCaseStorageBox) {
              const fullPath = `/${originalCaseStorageBox}/${e.path}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
              AppState.userDataPaths.add(fullPath);
          } else if (e.path && e.storagebox) {
            const fullPath = `/${e.storagebox}/${e.path}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
            AppState.userDataPaths.add(fullPath);
          }
      });

      if (typeof updateGeneratorEntryCount === "function") updateGeneratorEntryCount();
      if (typeof updateDataListCount === "function") updateDataListCount(); 

      if (!preventListRefresh && DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE) && typeof applyFiltersAndRenderDataList === "function") {
        applyFiltersAndRenderDataList(); 
      } else if (preventListRefresh && DOM.dataListPane?.classList.contains(UI_CLASSES.ACTIVE)) {
      }
      
      if (AppState.currentGuToolMode === "md5" && typeof populateMd5JsonList === "function") populateMd5JsonList();
    }

    displayFunc(
      ...messageArgs,
      successMsg,
      UI_CLASSES.SUCCESS,
      successDuration
    );
    return true;
  } catch (error) {
    const errMsg = `保存 ${dataTypeDesc} 数据失败: ${error.message}`;
    console.error(`核心更新: ${errMsg}`);
    displayFunc(
      ...messageArgs,
      errMsg,
      UI_CLASSES.ERROR,
      DELAYS.TOAST_ERROR_DURATION
    );
    return false;
  }
}

/**
 * 显示 Toast 提示
 * @param {string} message 消息文本
 * @param {string} [type=UI_CLASSES.INFO] 消息类型
 * @param {number} [duration=DELAYS.TOAST_DEFAULT_DURATION] 显示时长
 */
function displayToast(
  message,
  type = UI_CLASSES.INFO,
  duration = DELAYS.TOAST_DEFAULT_DURATION
) {
  if (!DOM.toastContainer) {
    console.warn("Toast container 缺失:", message);
    return;
  }
  const toastEl = document.createElement("div");
  toastEl.className = `toast-message ${type}`;
  toastEl.textContent = message;
  DOM.toastContainer.insertBefore(toastEl, DOM.toastContainer.firstChild);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toastEl.classList.add(UI_CLASSES.ACTIVE);
    });
  });
  setTimeout(() => {
    toastEl.classList.remove(UI_CLASSES.ACTIVE);
    toastEl.addEventListener("transitionend", () => toastEl.remove(), {
      once: true,
    });
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.remove();
    }, 500);
  }, duration);
}

/**
 * 在指定区域显示消息
 * @param {HTMLElement | null} areaElement 消息区域元素
 * @param {string} message 消息文本
 * @param {string} [type=UI_CLASSES.INFO] 消息类型
 * @param {number | null} [duration=null] 自动隐藏延迟 null 不自动隐藏
 * @param {boolean} [clearTimers=true] 是否清除相关业务计时器
 */
function displayScopedMessage(
  areaElement,
  message,
  type = UI_CLASSES.INFO,
  duration = null,
  clearTimers = true
) {
  if (!areaElement) {
    console.warn("displayScopedMessage: 目标元素无效:", message);
    return;
  }
  clearTimeout(AppState.messageClearTimer);
  AppState.messageClearTimer = null;
  if (clearTimers) {
    /* 清除特定计时器的逻辑 */
  }
  areaElement.textContent = message;
  areaElement.className = "";
  areaElement.classList.add(UI_CLASSES.VISIBLE, type);
  if (typeof duration === "number" && duration > 0) {
    AppState.messageClearTimer = setTimeout(
      () => hideScopedMessage(areaElement),
      duration
    );
  }
}

/**
 * 隐藏指定区域的消息
 * @param {HTMLElement | null} areaElement 消息区域元素
 */
function hideScopedMessage(areaElement) {
  if (areaElement) {
    areaElement.classList.remove(UI_CLASSES.VISIBLE);
  }
  clearTimeout(AppState.messageClearTimer);
  AppState.messageClearTimer = null;
  /* 清除特定计时器的逻辑 */
}
// 便利函数
function displayGeneratorMessage(
  message,
  type = UI_CLASSES.INFO,
  duration = null
) {
  displayScopedMessage(DOM.generatorMessageArea, message, type, duration);
}
function hideGeneratorMessage() {
  hideScopedMessage(DOM.generatorMessageArea);
}
function displayImportMessage(
  message,
  type = UI_CLASSES.INFO,
  duration = null
) {
  displayScopedMessage(DOM.importerMessageArea, message, type, duration);
}
function hideImportMessage() {
  hideScopedMessage(DOM.importerMessageArea);
}
function displayModalMessage(message, type = UI_CLASSES.INFO, duration = null) {
  displayScopedMessage(DOM.modalMessageArea, message, type, duration);
}
function hideModalMessage() {
  hideScopedMessage(DOM.modalMessageArea);
}

/**
 * 生成纯数字 ID
 * @param {number} [length=10] ID 长度
 * @returns {string} 数字 ID
 */
function generateNumericId(length = 10) {
  if (length <= 0) return "";
  let r = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < length; i++) r += String(Math.floor(Math.random() * 10));
  return r;
}

/**
 * 生成 GELD ID 字母数字组合
 * @param {number} [length=20] ID 长度
 * @returns {string} GELD ID
 */
function generateGeldId(length = 20) {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let r = "";
  const l = c.length;
  for (let i = 0; i < length; i++) r += c.charAt(Math.floor(Math.random() * l));
  return r;
}

/**
 * 更新导航栏时间显示
 */
function updateCurrentTimeDisplay() {
  if (!DOM.currentTimeElement) return;
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  const h = String(n.getHours()).padStart(2, "0");
  const i = String(n.getMinutes()).padStart(2, "0");
  const s = String(n.getSeconds()).padStart(2, "0");
  DOM.currentTimeElement.textContent = `${y}-${m}-${d} ${h}:${i}:${s}`;
}

/**
 * IntersectionObserver 回调 处理图片懒加载
 * @param {IntersectionObserverEntry[]} entries 观察条目
 * @param {IntersectionObserver} observer 观察器实例
 */
function handleImageLazyLoad(entries, observer) {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const imgElement = entry.target;
      const src = imgElement.dataset.src;
      if (src) {
        imgElement.src = src;
        imgElement.removeAttribute("data-src");
        imgElement.onload = () => imgElement.classList.add("loaded");
        imgElement.onerror = () => imgElement.classList.add("load-error");
      }
      observer.unobserve(imgElement);
    }
  });
}

/**
 * 根据游戏代码获取中文名称
 * @param {string | null | undefined} code 游戏代码
 * @returns {string} 中文名或原始代码或'未知'
 */
function getGameName(code) {
  const map = {
    "gs-character": "原神",
    "sr-character": "星铁",
    "zzz-character": "绝区零",
    "waves-character": "鸣潮",
  };
  return map[code] || code || "未知";
}

/**
 * 格式化 ISO 时间戳为 'YYYY-MM-DD HH:mm'
 * @param {string | null | undefined} isoTimestamp ISO 时间戳
 * @returns {string} 格式化后的时间或 'N/A'
 */
function formatTimestamp(isoTimestamp) {
  if (!isoTimestamp) return "N/A";
  try {
    const date = new Date(isoTimestamp);
    if (isNaN(date.getTime())) throw new Error("Invalid Date");
    const y = date.getFullYear(),
      m = String(date.getMonth() + 1).padStart(2, "0"),
      d = String(date.getDate()).padStart(2, "0"),
      h = String(date.getHours()).padStart(2, "0"),
      i = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${h}:${i}`;
  } catch (e) {
    console.warn("格式化时间戳失败:", isoTimestamp, e);
    return isoTimestamp;
  }
}

/**
 * 填充仓库选择下拉框
 * @param {HTMLSelectElement} selectElement 目标 select 元素
 * @param {boolean} [includeAllOption=false] 是否包含 "所有仓库" 选项
 * @param {string} [defaultSelection=''] 默认选中的仓库名
 */
function populateStorageBoxSelect(
  selectElement,
  includeAllOption = false,
  defaultSelection = ""
) {
  if (!selectElement) return;
  selectElement.innerHTML = "";
  if (includeAllOption) {
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "——所有仓库——";
    selectElement.appendChild(allOption);
  }
  AppState.availableStorageBoxes.forEach((boxName) => {
    const option = document.createElement("option");
    option.value = boxName; // 值和显示都用原始大小写
    option.textContent = boxName;
    selectElement.appendChild(option);
  });
  if (
    defaultSelection &&
    AppState.availableStorageBoxes.includes(defaultSelection)
  ) {
    selectElement.value = defaultSelection;
  } else if (!includeAllOption && AppState.availableStorageBoxes.length > 0) {
    selectElement.value = AppState.availableStorageBoxes[0];
  }
}

// --- 初始化框架 ---
/**
 * 页面加载时执行的主要初始化函数
 */
async function initializeApplication() {
  console.log("应用初始化开始...");
  cacheDomElements();

  if (DOM.appVersionElement) {
    DOM.appVersionElement.textContent = "咕咕牛Web管理器 v2.8";
  }

  try {
    if ("IntersectionObserver" in window) {
      lazyLoadObserver = new IntersectionObserver(handleImageLazyLoad, {
        root: null,
        rootMargin: "200px",
        threshold: 0.01,
      });
      console.log("图片懒加载观察器初始化成功");
    } else {
      console.warn("浏览器不支持 IntersectionObserver");
      lazyLoadObserver = null;
    }
  } catch (error) {
    console.error("初始化 Observer 出错:", error);
    lazyLoadObserver = null;
  }

  hideGeneratorMessage();
  hideImportMessage();
  hideModalMessage();
  if (DOM.generatorSearchInput) {
    DOM.generatorSearchInput.disabled = true;
    DOM.generatorSearchInput.placeholder = "加载核心数据...";
  }
  if (DOM.generatorAttributesPanel)
    DOM.generatorAttributesPanel.classList.add(UI_CLASSES.INITIALLY_HIDDEN);
  if (DOM.importerAttributesPanel)
    DOM.importerAttributesPanel.classList.add(UI_CLASSES.INITIALLY_HIDDEN);
  if (DOM.generatorPreviewImage) {
    DOM.generatorPreviewImage.src = "";
    DOM.generatorPreviewImage.alt = "选择图片";
    DOM.generatorPreviewImage.classList.add(UI_CLASSES.HIDDEN);
    DOM.generatorPreviewImage.style.display = "none";
  }
  if (DOM.importerTempImagePreview) {
    DOM.importerTempImagePreview.src = "";
    DOM.importerTempImagePreview.alt = "待入库图片预览";
    DOM.importerTempImagePreview.classList.add(UI_CLASSES.HIDDEN);
  }
  if (typeof disableImportFormSections === "function") {
    disableImportFormSections();
  } else {
    console.warn("Core: disableImportFormSections 未定义 GuTools_Import.js");
  }

  const defaultTabId = "homePane";
  DOM.tabPanes.forEach((p) =>
    p.classList.remove(UI_CLASSES.ACTIVE, UI_CLASSES.SLIDING_OUT)
  );
  DOM.tabButtons.forEach((b) => b.classList.remove(UI_CLASSES.ACTIVE));
  const defaultPane = document.getElementById(defaultTabId);
  const defaultButton = document.querySelector(
    `.tab-button[data-tab="${defaultTabId}"]`
  );
  if (defaultPane) defaultPane.classList.add(UI_CLASSES.ACTIVE);
  else console.warn(`默认 Tab 面板 '${defaultTabId}' 未找到`);
  if (defaultButton) defaultButton.classList.add(UI_CLASSES.ACTIVE);
  else console.warn(`默认 Tab 按钮 '${defaultTabId}' 未找到`);

  updateCurrentTimeDisplay();
  setInterval(updateCurrentTimeDisplay, 1000);

  displayGeneratorMessage("加载核心数据...", UI_CLASSES.INFO);
  let galleryImagesLoaded = false;
  let userDataLoaded = false;
  try {
    const [imagesResult, userdataResult] = await Promise.allSettled([
      fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES),
      fetchJsonData(API_ENDPOINTS.FETCH_USER_DATA),
    ]);

    if (
      imagesResult.status === "fulfilled" &&
      Array.isArray(imagesResult.value)
    ) {
      AppState.galleryImages = imagesResult.value.map((img, index) => {
        let currentStorageBox = img.storageBox || img.storagebox; 
        let originalUrlPath = img.urlPath || "";
        let relativePath = "";

        if (!currentStorageBox) {
          console.warn(
            `Core: galleryImage[${index}] 缺少 storageBox/storagebox:`,
            img
          );
          currentStorageBox = "unknown";
        }

        let pathWithoutRepo = originalUrlPath;
        if (typeof pathWithoutRepo !== "string") pathWithoutRepo = "";

        // 使用原始大小写构建正则 用于提取相对路径
        const escapedStorageBox = currentStorageBox.replace(
          /[-\/\\^$*+?.()|[\]{}]/g,
          "\\$&"
        );
        const repoPrefixRegex = new RegExp(`^/?(${escapedStorageBox})/`, "i"); // 忽略匹配时的大小写

        if (pathWithoutRepo.match(repoPrefixRegex)) {
          pathWithoutRepo = pathWithoutRepo.replace(repoPrefixRegex, "");
        } else if (pathWithoutRepo.startsWith("/")) {
          console.warn(
            `Core: galleryImage[${index}] urlPath 开头与仓库名 ${currentStorageBox} 不匹配: ${originalUrlPath}`
          );
          pathWithoutRepo = pathWithoutRepo.substring(1);
        }
        relativePath = pathWithoutRepo;

        const finalRelativePath = relativePath
          .replace(/\\/g, "/")
          .replace(/\/{2,}/g, "/");

        // if (originalUrlPath !== finalRelativePath && index < 10) { // 日志过多 暂时注释
        //     console.log(`Core: Path transformation[${index}]: ${originalUrlPath} -> ${finalRelativePath} (storageBox: ${currentStorageBox})`);
        // }

        return {
          ...img,
          storageBox: currentStorageBox, // 存储原始大小写
          urlPath: finalRelativePath, // 存储相对路径
          storagebox: undefined, // 移除小写字段
        };
      });

      galleryImagesLoaded = true;
      AppState.availableStorageBoxes = [
        ...new Set(
          AppState.galleryImages.map((img) => img.storageBox).filter(Boolean)
        ),
      ].sort(); // 存储原始大小写
      console.log(
        `核心数据: 加载 ${AppState.galleryImages.length} 图库信息 来自 ${
          AppState.availableStorageBoxes.length
        } 个仓库: ${AppState.availableStorageBoxes.join(", ")}`
      );
      if (DOM.generatorSearchInput) {
        DOM.generatorSearchInput.placeholder = `搜索 ${AppState.galleryImages.length} 图片...`;
      }
      if (DOM.generatorAttributesPanel)
        DOM.generatorAttributesPanel.classList.remove(
          UI_CLASSES.INITIALLY_HIDDEN
        );
      if (DOM.importerStorageBoxSelect)
        populateStorageBoxSelect(DOM.importerStorageBoxSelect, false);
      if (DOM.sequenceStorageBoxSelect)
        populateStorageBoxSelect(DOM.sequenceStorageBoxSelect, false);
    } else {
      console.error(
        "核心数据: 加载图库列表失败:",
        imagesResult.reason || "未知"
      );
      displayToast(
        "加载图库列表失败",
        UI_CLASSES.ERROR,
        DELAYS.TOAST_ERROR_DURATION
      );
      if (DOM.generatorSearchInput) {
        DOM.generatorSearchInput.placeholder = "列表加载失败";
        DOM.generatorSearchInput.disabled = true;
      }
    }

    if (
      userdataResult.status === "fulfilled" &&
      Array.isArray(userdataResult.value)
    ) {
      AppState.userData = userdataResult.value;
      console.log(
        "Core: 开始构建 userDataPaths (包含原始大小写 storageBox 的完整 Web 路径)..."
      );
      AppState.userDataPaths = new Set();
      AppState.userData.forEach((e, index) => {
        const originalCaseStorageBox = AppState.availableStorageBoxes.find(
          (box) => box.toLowerCase() === e.storagebox?.toLowerCase()
        );
        if (e.path && originalCaseStorageBox) {
          const fullPath = `/${originalCaseStorageBox}/${e.path}`
            .replace(/\\/g, "/")
            .replace(/\/{2,}/g, "/");
          AppState.userDataPaths.add(fullPath);
        } else if (e.path && e.storagebox) {
          const fullPath = `/${e.storagebox}/${e.path}`
            .replace(/\\/g, "/")
            .replace(/\/{2,}/g, "/");
          AppState.userDataPaths.add(fullPath);
          console.warn(
            `Core: userData[${index}] 未找到 ${e.storagebox} 的原始大小写 使用小写构建路径`
          );
        } else {
          console.warn(
            `Core: userData 条目 ${index} 缺少 path 或 storagebox 无法添加到 Set:`,
            e
          );
        }
      });
      userDataLoaded = true;
      console.log(
        `核心数据: 加载 ${AppState.userData.length} 用户数据 已缓存 ${AppState.userDataPaths.size} 个有效路径`
      );

      if (typeof updateGeneratorEntryCount === "function")
        updateGeneratorEntryCount();
      else
        console.warn(
          "Core: updateGeneratorEntryCount 未定义 GuTools_Generator.js"
        );
      if (
        AppState.currentGuToolMode === "md5" &&
        typeof populateMd5JsonList === "function"
      )
        populateMd5JsonList();
      else if (AppState.currentGuToolMode === "md5")
        console.warn("Core: populateMd5JsonList 未定义 GuTools_MD5.js");
    } else {
      console.error(
        "核心数据: 加载用户数据失败:",
        userdataResult.reason || "未知"
      );
      displayToast(
        "加载 JSON 数据失败",
        UI_CLASSES.ERROR,
        DELAYS.TOAST_ERROR_DURATION
      );
      AppState.userData = [];
      AppState.userDataPaths = new Set();
      if (typeof updateGeneratorEntryCount === "function")
        updateGeneratorEntryCount();
      if (
        AppState.currentGuToolMode === "md5" &&
        typeof populateMd5JsonList === "function"
      )
        populateMd5JsonList();
    }

    if (galleryImagesLoaded && userDataLoaded) {
      displayGeneratorMessage(
        "核心数据加载完毕！",
        UI_CLASSES.SUCCESS,
        DELAYS.MESSAGE_CLEAR_DEFAULT
      );
    } else if (galleryImagesLoaded) {
      displayGeneratorMessage(
        "图库加载成功 JSON 数据加载失败",
        UI_CLASSES.WARNING,
        DELAYS.MESSAGE_CLEAR_DEFAULT + 1000
      );
    } else if (userDataLoaded) {
      displayGeneratorMessage(
        "JSON 数据加载成功 图库加载失败",
        UI_CLASSES.WARNING,
        DELAYS.MESSAGE_CLEAR_DEFAULT + 1000
      );
    } else {
      displayGeneratorMessage("核心数据加载失败！", UI_CLASSES.ERROR);
    }

    if (galleryImagesLoaded && typeof Worker !== "undefined") {
      if (typeof initializeGeneratorSearchWorker === "function")
        initializeGeneratorSearchWorker();
      else
        console.warn(
          "Core: initializeGeneratorSearchWorker 未定义 GuTools_Generator.js"
        );
    } else if (typeof Worker === "undefined") {
      console.warn("核心: 不支持 Worker");
      displayToast("不支持后台搜索", UI_CLASSES.WARNING);
      if (DOM.generatorSearchInput && !DOM.generatorSearchInput.disabled) {
        DOM.generatorSearchInput.placeholder = "搜索不可用";
        DOM.generatorSearchInput.disabled = true;
      }
    } else {
      console.warn("核心: 图库加载失败 Worker 未初始化");
      if (DOM.generatorSearchInput && !DOM.generatorSearchInput.disabled) {
        DOM.generatorSearchInput.placeholder = "搜索不可用 数据错误";
        DOM.generatorSearchInput.disabled = true;
      }
    }

    console.log("核心: 设置事件监听器...");
    const setupFunctions = [
      { name: "setupTabNavigation", file: "Ui_Controls.js" },
      { name: "setupHomePaneEventListeners", file: "Ui_Controls.js" },
      { name: "setupModalEventListeners", file: "Data_List.js" },
      { name: "setupGuToolsModeSwitcher", file: "GuTools_Main.js" },
      { name: "setupGeneratorEventListeners", file: "GuTools_Generator.js" },
      { name: "setupImporterEventListeners", file: "GuTools_Import.js" },
      { name: "setupMd5CheckerEventListeners", file: "GuTools_MD5.js" },
      {
        name: "setupSequenceManagerEventListeners",
        file: "GuTools_Sequence.js",
      },
      { name: "setupJsonCalibratorEventListeners", file: "GuTools_JsonCal.js" },
      { name: 'setupStockroomGoEventListeners', file: 'GuTools_StockroomGo.js' },
      { name: 'setupStorageboxCalibratorEventListeners', file: 'GuTools_StorageboxCal.js' }, 
      { name: 'setupFileSizeCheckerEventListeners', file: 'GuTools_FileSize.js' },
      { name: 'setupSecondaryTagEditorEventListeners', file: 'GuTools_SecondaryTagEditor.js' },
      { name: "setupDataListEventListeners", file: "Data_List.js" },
      { name: "setupPluginGalleryEventListeners", file: "Plugin_Gallery.js" },
      { name: "setupGlobalEventListeners", file: "Ui_Controls.js" },
    ];
    for (const funcInfo of setupFunctions) {
      if (typeof window[funcInfo.name] === "function") {
        window[funcInfo.name]();
        console.log(`  > ${funcInfo.name} 来自 ${funcInfo.file} 已调用`);
      } else {
        console.warn(
          `核心: ${funcInfo.name} 函数在 ${funcInfo.file} 中尚未定义`
        );
      }
    }
    console.log("核心: 事件监听器设置调用完成");
    if (typeof initializeImageViewer === 'function') {
      initializeImageViewer();
  }

    if (typeof updateGalleryStatusDisplay === "function")
      updateGalleryStatusDisplay();
    else console.warn("核心: updateGalleryStatusDisplay 未定义 Ui_Controls.js");
    const filterToggleIds = [
      "dataListFilterPx18",
      "dataListFilterRx18",
      "dataListFilterIsBan",
      "dataListFilterNormal",
      "dataListFilterFullscreen",
      "dataListFilterEasterEgg",
      "dataListFilterAiImage",
    ];
    filterToggleIds.forEach((id) => {
      if (document.getElementById(id)) {
        if (typeof updateFilterToggleButtonText === "function")
          updateFilterToggleButtonText(id);
        else
          console.warn(
            `核心: updateFilterToggleButtonText 未定义 ${id} Data_List.js`
          );
      }
    });

    console.log("应用初始化流程完成");
  } catch (error) {
    console.error("!!! 核心初始化失败 !!!:", error);
    displayGeneratorMessage(
      `初始化严重错误: ${error.message}.`,
      UI_CLASSES.ERROR
    );
    document.body.classList.add("initialization-error");
  }
}

// 图片放大镜 
function initializeImageViewer() {
  let currentZoom = 1;
  const ZOOM_SPEED = 0.1;
  let isPanning = false;
  let startPos = { x: 0, y: 0 };
  let currentTranslate = { x: 0, y: 0 };

  const viewer = DOM.modalImageViewer;
  const overlay = DOM.imageModalOverlay;
  const closeButton = DOM.modalCloseButton;

  if (!viewer || !overlay || !closeButton) {
      console.warn("图片放大镜核心DOM元素缺失，功能将不可用。");
      return;
  }

  // 重置缩放和平移状态
  const resetZoomState = () => {
      currentZoom = 1;
      currentTranslate = { x: 0, y: 0 };
      viewer.style.transform = 'translate(0px, 0px) scale(1)';
      viewer.style.cursor = 'grab';
  };
  
  window.resetImageViewer = resetZoomState;

  // 打开放大镜
  window.openImageViewer = (imageSrc) => {
      resetZoomState();
      viewer.src = imageSrc;
      overlay.classList.remove('hidden');
  };
  
  // 关闭放大镜
  const closeImageViewer = () => {
      overlay.classList.add('hidden');
  };

  // 滚轮缩放事件
  overlay.addEventListener('wheel', (e) => {
      if (overlay.classList.contains('hidden')) return;
      e.preventDefault();
      
      const rect = viewer.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
      const oldZoom = currentZoom;
      currentZoom = Math.max(0.5, Math.min(currentZoom + delta, 5));
      
      const zoomRatio = currentZoom / oldZoom;
      
      currentTranslate.x = offsetX - (offsetX - currentTranslate.x) * zoomRatio;
      currentTranslate.y = offsetY - (offsetY - currentTranslate.y) * zoomRatio;

      viewer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${currentZoom})`;
  }, { passive: false });

  // 鼠标拖动平移事件
  viewer.addEventListener('mousedown', (e) => {
      if (overlay.classList.contains('hidden')) return;
      e.preventDefault();
      isPanning = true;
      startPos = { x: e.clientX - currentTranslate.x, y: e.clientY - currentTranslate.y };
      viewer.style.cursor = 'grabbing';
  });

  const stopPanning = () => {
      isPanning = false;
      if (viewer) viewer.style.cursor = 'grab';
  };

  overlay.addEventListener('mousemove', (e) => {
      if (!isPanning || overlay.classList.contains('hidden')) return;
      e.preventDefault();
      currentTranslate.x = e.clientX - startPos.x;
      currentTranslate.y = e.clientY - startPos.y;
      viewer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${currentZoom})`;
  });
  
  overlay.addEventListener('mouseup', stopPanning);
  overlay.addEventListener('mouseleave', stopPanning);

  // 关闭事件
  closeButton.addEventListener('click', closeImageViewer);
  overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
          closeImageViewer();
      }
  });

  console.log("图片放大镜功能已初始化。");
}

// --- DOMContentLoaded 监听器 ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication);
} else {
  console.log("核心: DOM 已加载 直接运行初始化");
  initializeApplication();
}
