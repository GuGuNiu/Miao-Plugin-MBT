// ==========================================================================
// #Home (Home Pane) 的所有 UI 交互和数据加载
// 包括仓库统计卡片、图库开关、净化等级和内容过滤等。
// ==========================================================================

// 负载等级对应的颜色
const LOAD_LEVEL_COLORS = {
    1: { track: '#a5d6a7', thumb: '#4caf50' }, // 绿色
    2: { track: '#ffcc80', thumb: '#ff9800' }, // 橙色
    3: { track: '#ff8a80', thumb: '#f44336' }  // 红色
};

/**
 * 动态修改滑块颜色，优先级最高。
 * @param {HTMLElement} sliderElement - 滑块的DOM元素
 * @param {string|number} level - 当前的负载等级
 */
function setSliderColor(sliderElement, level) {
    if (!sliderElement) return;
    const colors = LOAD_LEVEL_COLORS[level] || LOAD_LEVEL_COLORS[1];

    const styleId = 'load-level-slider-style';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
        input[type=range]#loadLevelSlider::-webkit-slider-runnable-track {
            background-color: ${colors.track} !important;
        }
        input[type=range]#loadLevelSlider::-moz-range-track {
            background-color: ${colors.track} !important;
        }
        input[type=range]#loadLevelSlider::-webkit-slider-thumb {
            background-color: ${colors.thumb} !important;
        }
        input[type=range]#loadLevelSlider::-moz-range-thumb {
            background-color: ${colors.thumb} !important;
        }
    `;
}

/**
 * 从后端获取配置并更新首页所有设置卡片的状态。
 */
async function updateGalleryStatusDisplay() {
    console.log("UI控件: 更新 Home 面板状态...");
    const elements = {
        tuKuOPText: DOM.tuKuOPStatusText,
        pflText: DOM.pflStatusText,
        tuKuOPSwitch: DOM.tuKuOPToggleSwitch,
        pflRadio0: document.getElementById('pflRadio0'),
        pflRadio1: document.getElementById('pflRadio1'),
        pflRadio2: document.getElementById('pflRadio2'),
        pflContainer: document.querySelector('.tri-state-switch-container'),
        aiBtn: DOM.aiFilterBtn,
        eastereggBtn: DOM.eastereggFilterBtn,
        layoutBtn: DOM.layoutFilterBtn,
        execModeSwitch: DOM.executionModeToggleSwitch,
        execModeText: DOM.executionModeStatusText,
        loadLevelContainer: DOM.loadLevelSliderContainer,
        loadLevelSlider: DOM.loadLevelSlider,
        loadLevelDisplay: DOM.loadLevelValueDisplay
    };

    if (!elements.tuKuOPText || !elements.pflText || !elements.tuKuOPSwitch || !elements.execModeSwitch) {
        console.error("UI控件: Home 面板部分状态元素未找到");
        return;
    }

    // 设置所有控件为加载中状态
    Object.values(elements).forEach(el => { if (el && el.tagName) el.disabled = true; });
    elements.tuKuOPText.textContent = '加载中...';
    elements.pflText.textContent = '加载中...';
    elements.execModeText.textContent = '加载中...';
    elements.pflContainer.classList.add('disabled');
    elements.loadLevelContainer.classList.add('disabled');

    try {
        const result = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_CONFIG);
        if (!result?.success || typeof result.config !== 'object') {
            throw new Error(result?.error || "获取的配置数据格式无效");
        }
        const config = result.config;

        // 更新图库总开关
        const tuKuOPValue = Number(config.TuKuOP ?? 0);
        elements.tuKuOPText.textContent = tuKuOPValue ? '已启用' : '已关闭';
        elements.tuKuOPSwitch.checked = !!tuKuOPValue;

        // 更新净化等级
        const pflValue = Number(config.PFL ?? 0);
        const pflRadioToCheck = document.getElementById(`pflRadio${pflValue}`) || elements.pflRadio0;
        pflRadioToCheck.checked = true;
        elements.pflText.textContent = `当前: ${{ 0: '关闭净化', 1: '仅过滤R18', 2: '过滤全部敏感数据' }[pflValue] || '未知'}`;

        // 更新内容过滤按钮
        if (elements.aiBtn) elements.aiBtn.classList.toggle('active', config.Ai === 1);
        if (elements.eastereggBtn) elements.eastereggBtn.classList.toggle('active', config.EasterEgg === 1);
        if (elements.layoutBtn) elements.layoutBtn.classList.toggle('active', config.layout === 1);

        // 更新数据流模式和负载等级
        const execMode = config.Execution_Mode || 'Batch';
        const loadLevel = config.Load_Level || 1;
        const isSerialMode = execMode === 'Serial';
        elements.execModeSwitch.checked = isSerialMode;
        elements.execModeText.textContent = `当前模式: ${isSerialMode ? '低负载' : '高速并发'}`;
        elements.loadLevelSlider.value = loadLevel;
        elements.loadLevelDisplay.textContent = `当前: LV.${loadLevel}`;
        setSliderColor(elements.loadLevelSlider, loadLevel);
        elements.loadLevelContainer.classList.toggle('disabled', !isSerialMode);

        // 启用所有控件
        Object.values(elements).forEach(el => { if (el && el.tagName) el.disabled = false; });
        elements.pflContainer.classList.remove('disabled');

    } catch (error) {
        console.error("UI控件: 加载图库配置失败:", error);
        elements.tuKuOPText.textContent = '加载失败';
        elements.pflText.textContent = '加载失败';
        elements.execModeText.textContent = '加载失败';
        displayToast('加载配置出错', UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    }
}

/**
 * 统一处理除滑块外的所有设置项的变更事件。
 */
async function handleGalleryControlChange(event) {
    const controlElement = event.target;
    // 忽略滑块事件
    if (!controlElement || controlElement.id === 'loadLevelSlider') return;

    let configKey, newValue, statusElement, controlName, valueMap;

    if (controlElement.id === 'tuKuOPToggleSwitch') {
        configKey = 'TuKuOP';
        newValue = controlElement.checked ? 1 : 0;
        statusElement = DOM.tuKuOPStatusText;
        controlName = '图库开关';
        valueMap = { 1: '已启用', 0: '已关闭' };
    } else if (controlElement.name === 'pflLevel') {
        configKey = 'PFL';
        newValue = Number(controlElement.value);
        statusElement = DOM.pflStatusText;
        controlName = '净化等级';
        valueMap = { 0: '关闭净化', 1: '仅过滤R18', 2: '过滤全部敏感数据' };
    } else if (controlElement.classList.contains('filter-button')) {
        controlElement.classList.toggle('active');
        newValue = controlElement.classList.contains('active') ? 1 : 0;
        switch (controlElement.id) {
            case 'ai-filter-btn': configKey = 'Ai'; controlName = 'AI 图片过滤'; break;
            case 'easteregg-filter-btn': configKey = 'EasterEgg'; controlName = '彩蛋图片过滤'; break;
            case 'layout-filter-btn': configKey = 'layout'; controlName = '横屏图过滤'; break;
            default: return;
        }
    } else if (controlElement.id === 'executionModeToggleSwitch') {
        configKey = 'Execution_Mode';
        newValue = controlElement.checked ? 'Serial' : 'Batch';
        statusElement = DOM.executionModeStatusText;
        controlName = '数据流模式';
        valueMap = { 'Serial': '低负载', 'Batch': '高速并发' };
        DOM.loadLevelSliderContainer.classList.toggle('disabled', !controlElement.checked);
    } else {
        return;
    }

    controlElement.disabled = true;
    if (statusElement) statusElement.textContent = `${controlName} 更新中...`;

    try {
        const result = await fetchJsonData(API_ENDPOINTS.UPDATE_GALLERY_CONFIG, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ configKey, newValue }),
        });
        if (!result?.success) throw new Error(result?.error || `更新失败`);

        if (result.newConfig) AppState.galleryConfig = result.newConfig;
        if (configKey === 'PFL') AppEvents.emit('pflChanged');

        if (statusElement && valueMap) {
            const statusText = valueMap[newValue];
            statusElement.textContent = (configKey === 'PFL') ? `当前: ${statusText}` :
                (configKey === 'Execution_Mode') ? `当前模式: ${statusText}` : statusText;
        }
        displayToast(`${controlName} 更新成功`, UI_CLASSES.SUCCESS);
    } catch (error) {
        console.error(`UI控件: 更新 ${controlName} 配置失败:`, error);
        if (statusElement) statusElement.textContent = `${controlName} 更新失败`;
        displayToast(`${controlName} 更新失败: ${error.message}`, UI_CLASSES.ERROR);
        updateGalleryStatusDisplay(); // 出错时回滚UI状态
    } finally {
        controlElement.disabled = false;
    }
}

/**
 * 独立处理负载等级滑块的事件
 */
function handleLoadLevelSliderChange(event) {
    const slider = event.target;
    const level = slider.value;

    // 更新UI
    DOM.loadLevelValueDisplay.textContent = `当前: LV.${level}`;
    setSliderColor(slider, level);

    // 防抖发送API请求
    clearTimeout(AppState.home.sliderDebounceTimer);
    AppState.home.sliderDebounceTimer = setTimeout(() => {
        fetchJsonData(API_ENDPOINTS.UPDATE_GALLERY_CONFIG, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ configKey: 'Load_Level', newValue: Number(level) }),
        }).then(result => {
            if (!result?.success) throw new Error(result?.error || '更新失败');
            displayToast(`负载等级已设为 LV.${level}`, UI_CLASSES.SUCCESS);
        }).catch(error => {
            displayToast(`负载等级更新失败: ${error.message}`, UI_CLASSES.ERROR);
            updateGalleryStatusDisplay(); // 出错时回滚UI
        });
    }, 400);
}

/**
 * 设置 Home 面板上所有控件的事件监听器。
 */
function setupHomePaneEventListeners() {
    const controlsToListen = [
        DOM.tuKuOPToggleSwitch,
        document.getElementById('pflRadio0'),
        document.getElementById('pflRadio1'),
        document.getElementById('pflRadio2'),
        DOM.aiFilterBtn,
        DOM.eastereggFilterBtn,
        DOM.layoutFilterBtn,
        DOM.executionModeToggleSwitch,
    ];

    controlsToListen.forEach(el => {
        if (el) {
            const eventType = (el.type === 'radio' || el.type === 'checkbox') ? 'change' : 'click';
            el.removeEventListener(eventType, handleGalleryControlChange);
            el.addEventListener(eventType, handleGalleryControlChange);
        }
    });

    // 为滑块设置独立的监听器
    if (DOM.loadLevelSlider) {
        DOM.loadLevelSlider.removeEventListener('input', handleLoadLevelSliderChange);
        DOM.loadLevelSlider.addEventListener('input', handleLoadLevelSliderChange);
    }
}

/**
 * 获取并更新首页仓库卡片的统计数据。
 */
async function updateHomeStats() {
    console.log("UI控件: 正在更新 Home 面板仓库统计...");
    try {
        const result = await fetchJsonData(API_ENDPOINTS.FETCH_HOME_STATS);
        if (!result?.success || !Array.isArray(result.stats)) {
            throw new Error(result?.error || "获取的统计数据格式无效");
        }

        if (result.fromCache) {
            displayToast("仓库数据从缓存加载", "info", 1500);
        }

        result.stats.forEach(repo => {
            const card = document.getElementById(`repo-card-${repo.repo}`);
            const statusEl = document.getElementById(`repo-status-${repo.repo}`);
            const statusValueEl = statusEl ? statusEl.querySelector('.status-value') : null;
            const rolesEl = document.getElementById(`repo-roles-${repo.repo}`);
            const imagesEl = document.getElementById(`repo-images-${repo.repo}`);
            const filesSizeEl = document.getElementById(`repo-files-size-${repo.repo}`);
            const gitSizeEl = document.getElementById(`repo-git-size-${repo.repo}`);
            const totalSizeEl = document.getElementById(`repo-total-size-${repo.repo}`);
            const lastUpdatedEl = document.getElementById(`repo-last-updated-${repo.repo}`);
            const shaEl = document.getElementById(`repo-sha-${repo.repo}`);
            const messageEl = card?.querySelector('.repo-card-message');

            if (!card || !statusEl || !statusValueEl || !rolesEl || !imagesEl || !filesSizeEl || !gitSizeEl || !totalSizeEl || !lastUpdatedEl || !shaEl) {
                console.warn(`UI控件: 未找到仓库 ${repo.repo} 的部分卡片元素`);
                return;
            }

            card.classList.remove('placeholder');
            const contentEl = card.querySelector('.repo-card-content');

            if (repo.status === 'exists') {
                card.className = 'repository-card exists';
                if (contentEl) contentEl.style.display = 'flex';
                if (messageEl) messageEl.style.display = 'none';

                statusEl.className = 'repo-card-status exists';
                statusValueEl.textContent = repo.downloadNode || '未知';
                rolesEl.textContent = repo.roles;
                imagesEl.textContent = repo.images;
                filesSizeEl.textContent = FormatBytes(repo.filesSize || 0);
                gitSizeEl.textContent = FormatBytes(repo.gitSize || 0);
                totalSizeEl.textContent = FormatBytes(repo.size || 0);
                lastUpdatedEl.textContent = formatTimestamp(repo.lastUpdate) || '未知';
                shaEl.textContent = repo.sha || '获取失败';
            } else if (repo.status === 'not-exists') {
                card.className = 'repository-card not-exists';
                if (contentEl) contentEl.style.display = 'flex';
                if (messageEl) messageEl.style.display = 'none';

                statusEl.className = 'repo-card-status not-exists';
                statusValueEl.textContent = '未下载';
                rolesEl.textContent = '--';
                imagesEl.textContent = '--';
                filesSizeEl.textContent = '--.- MB';
                gitSizeEl.textContent = '--.- MB';
                totalSizeEl.textContent = '--.- MB';
                lastUpdatedEl.textContent = 'N/A';
                shaEl.textContent = 'N/A';
            } else if (repo.status === 'not-required') {
                card.className = 'repository-card not-required';
                if (contentEl) contentEl.style.display = 'none';
                if (messageEl) {
                    messageEl.style.display = 'block';
                    messageEl.textContent = '无需下载';
                }
            }
        });

    } catch (error) {
        console.error("UI控件: 更新仓库统计失败:", error);
        displayToast('加载仓库统计数据失败', 'error');
        for (let i = 1; i <= 4; i++) {
            const card = document.getElementById(`repo-card-${i}`);
            if (card) {
                card.className = 'repository-card not-exists';
                const statusEl = document.getElementById(`repo-status-${i}`);
                if (statusEl) statusEl.textContent = '加载失败';
            }
        }
    }
}