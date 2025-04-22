// ==========================================================================
// GuTools 主模块: 负责模式切换和模式按钮的事件绑定。
// ==========================================================================



/**
 * 切换 GuTools 面板的视图模式。
 * @param {'generator' | 'import' | 'md5' | 'sequence' | 'json_calibration'} targetMode - 要切换到的目标模式。
 */
async function switchGuToolMode(targetMode) {
    const validModes = ['generator', 'import', 'md5', 'sequence', 'json_calibration'];
    if (!validModes.includes(targetMode)) {
        console.error(`无效的 GuTools 模式: ${targetMode}`);
        return;
    }

    const views = {
        generator: DOM.generatorPaneView,
        import: DOM.importPaneView,
        md5: DOM.md5PaneView,
        sequence: DOM.sequencePaneView,
        json_calibration: DOM.jsonCalibrationPaneView
    };

    const targetView = views[targetMode];
    if (!targetView) {
        console.error(`GuTools: 找不到模式 '${targetMode}' 对应的视图元素。`);
        return;
    }

    // 如果已经是当前模式且视图可见，则无需切换
    if (AppState.currentGuToolMode === targetMode && !targetView.classList.contains(UI_CLASSES.HIDDEN)) {
        console.debug(`GuTools: 模式已经是 ${targetMode} 且可见，无需切换。`);
        return;
    }

    console.log(`GuTools: 切换模式 -> ${targetMode}`);

    // --- 中止可能正在进行的操作 ---
    // (注意：这里只是设置标志位，具体的停止逻辑在各自模块的循环中检查)
    if (AppState.md5Checker.isRunning && targetMode !== 'md5') {
        console.log(`GuTools: 模式切换，请求中止 MD5 校准...`);
        AppState.md5Checker.isAborted = true; // 设置中止标志
    }
    if (AppState.sequenceManager.isRunning && targetMode !== 'sequence') {
        console.log(`GuTools: 模式切换，请求中止序号分析... (注意：当前无中止实现)`);
        // AppState.sequenceManager.isAborted = true; // 如果需要中止序号分析逻辑
    }
    if (AppState.jsonCalibrator.isRunning && targetMode !== 'json_calibration') {
        console.log(`GuTools: 模式切换，请求中止 JSON 校准...`);
        AppState.jsonCalibrator.isRunning = false; // 简单标记停止，具体检查在校准循环中
    }
    // ------------------------------------------

    // 更新当前模式状态
    AppState.currentGuToolMode = targetMode;

    // 隐藏所有 GuTools 视图
    Object.values(views).forEach(view => {
        if (view) view.classList.add(UI_CLASSES.HIDDEN);
    });

    // 显示目标视图
    targetView.classList.remove(UI_CLASSES.HIDDEN);

    // 更新模式按钮的激活状态
    if (DOM.guToolsModeButtonGroups) {
        DOM.guToolsModeButtonGroups.forEach(buttonGroup => {
            const buttons = buttonGroup.querySelectorAll('.mode-button[data-mode]');
            buttons.forEach(button => {
                button.classList.toggle(UI_CLASSES.ACTIVE, button.dataset.mode === targetMode);
            });
        });
    } else {
        console.warn("GuTools: 未找到模式切换按钮组。");
    }

    // --- 执行特定模式的加载/重置逻辑 ---
    try {
        switch (targetMode) {
            case 'generator':
                // 从其他模块导入的消息隐藏函数
                if (typeof hideImportMessage === 'function') hideImportMessage();
                // 可能还需要隐藏 MD5/Sequence/JSON Cal 的消息区，如果它们有独立消息区的话
                break;

                case 'import':
                    if (typeof hideGeneratorMessage === 'function') hideGeneratorMessage();

                    if (typeof ensureImportDataLoaded === 'function') { 
                        await ensureImportDataLoaded();          
                        if (typeof updateImportInputPlaceholders === 'function') updateImportInputPlaceholders();
                        else console.warn("GuTools (Import): updateImportInputPlaceholders 未定义。");
                    } else {
                        console.error("错误: ensureImportDataLoaded 函数未定义！"); 
                        if (typeof displayImportMessage === 'function') displayImportMessage("错误：无法加载入库数据", UI_CLASSES.ERROR);
                    }
                    break;

            case 'md5':
                if (typeof hideGeneratorMessage === 'function') hideGeneratorMessage();
                if (typeof hideImportMessage === 'function') hideImportMessage();
                if (!AppState.md5Checker.isRunning) { // 只有在校准未运行时才重置 UI
                    console.log("GuTools: 进入 MD5 模式 (未运行)，重置 UI。");
                    if (typeof resetMd5CheckerUI === 'function') resetMd5CheckerUI(); // 重置函数应在 GuTools_MD5.js 定义
                    else console.warn("GuTools (MD5): resetMd5CheckerUI 未定义。");
                    // 填充列表是必要的
                    if (typeof populateMd5JsonList === 'function') populateMd5JsonList();
                    else console.warn("GuTools (MD5): populateMd5JsonList 未定义。");
                } else {
                    console.log("GuTools: 切回 MD5 模式 (运行中)，仅更新列表。");
                     if (typeof populateMd5JsonList === 'function') populateMd5JsonList(); // 运行中也需要更新列表
                     else console.warn("GuTools (MD5): populateMd5JsonList 未定义。");
                }
                break;

            case 'sequence':
                 if (typeof hideGeneratorMessage === 'function') hideGeneratorMessage();
                 if (typeof hideImportMessage === 'function') hideImportMessage();
                if (!AppState.sequenceManager.isRunning) { // 只有在分析未运行时才重置
                    console.log("GuTools: 进入 Sequence 模式 (未运行)，重置 UI。");
                     if (typeof resetSequenceManagerUI === 'function') resetSequenceManagerUI(); // 重置函数应在 GuTools_Sequence.js 定义
                     else console.warn("GuTools (Sequence): resetSequenceManagerUI 未定义。");
                } else {
                    console.log("GuTools: 切回 Sequence 模式 (运行中)。");
                }
                // 如果文件夹列表为空，尝试加载 (fetchCharacterFolders 现在在 Core.js)
                if (AppState.importer.characterFoldersList.length === 0 && typeof fetchCharacterFolders === 'function') {
                     console.log("GuTools (Sequence): 角色文件夹列表为空，尝试加载...");
                     await fetchCharacterFolders(); // fetchCharacterFolders 现在应该从 Core.js 调用
                } else if (AppState.importer.characterFoldersList.length === 0) {
                     console.warn("GuTools (Sequence): fetchCharacterFolders 未定义或加载失败。");
                }
                break;

            case 'json_calibration':
                 if (typeof hideGeneratorMessage === 'function') hideGeneratorMessage();
                 if (typeof hideImportMessage === 'function') hideImportMessage();
                if (!AppState.jsonCalibrator.isRunning) {
                     console.log("GuTools: 进入 JSON 校准模式 (未运行)，重置 UI。");
                     if (typeof resetJsonCalibratorUI === 'function') resetJsonCalibratorUI(); // 重置函数应在 GuTools_JsonCal.js 定义
                     else console.warn("GuTools (JSON Cal): resetJsonCalibratorUI 未定义。");
                } else {
                     console.log("GuTools: 切回 JSON 校准模式 (运行中)。");
                }
                break;
            default:
                console.warn(`GuTools: 未知模式的特定加载逻辑: ${targetMode}`);
        }
    } catch (error) {
        console.error(`GuTools: 切换到模式 ${targetMode} 时执行特定逻辑出错:`, error);
        // 可以考虑显示一个通用的错误提示
        displayToast(`切换到 ${targetMode} 模式时出错`, UI_CLASSES.ERROR);
    }
}

/**
 * 设置 GuTools 内部模式切换按钮的事件监听器。
 */
function setupGuToolsModeSwitcher() {
    // 获取所有 GuTools 面板内的模式按钮
    const modeButtons = document.querySelectorAll('#GuTools .mode-button[data-mode]');

    if (!modeButtons || modeButtons.length === 0) {
        console.error("GuTools: 未找到任何模式切换按钮。");
        return;
    }

    // 统一的点击处理函数
    const handleModeButtonClick = (event) => {
        const targetMode = event.currentTarget.dataset.mode;
        if (targetMode) {
            switchGuToolMode(targetMode);
        } else {
            console.warn("GuTools: 点击的模式按钮没有 'data-mode' 属性:", event.currentTarget);
        }
    };

    // 为每个按钮绑定事件监听器 (先移除旧的防止重复绑定)
    modeButtons.forEach(button => {
        button.removeEventListener('click', handleModeButtonClick);
        button.addEventListener('click', handleModeButtonClick);
    });

    console.log(`GuTools: 为 ${modeButtons.length} 个模式按钮设置了切换监听器。`);
}

