// ==========================================================================
// GuTools 仓库转移: 将指定文件夹从一个仓库转移到另一个仓库
// ==========================================================================

// 模块内部状态
let sourceFolders = []; // 当前源仓库下的文件夹列表

/**
 * 初始化仓库转移视图
 */
function initializeStockroomGoView() {
    console.log("StockroomGo: 初始化视图...");
    // 填充源仓库和目标仓库下拉框
    // populateStorageBoxSelect 在 Core.js 中定义
    if (DOM.sourceStorageBoxSelect) {
        populateStorageBoxSelect(DOM.sourceStorageBoxSelect, false); // 源仓库不能是 "所有"
    }
    if (DOM.targetStorageBoxSelectGo) {
        populateStorageBoxSelect(DOM.targetStorageBoxSelectGo, false); // 目标仓库不能是 "所有"
    }

    // 重置界面状态
    resetStockroomGoUI();

    // 添加事件监听器 (确保在触发事件前已添加)
    setupStockroomGoEventListeners();

    // --- 修改：调用显示仓库信息函数 ---
    displayStockroomInfo(); // 加载并显示仓库概览

    // 手动触发 change 事件以加载默认源仓库的文件夹
    if (DOM.sourceStorageBoxSelect && DOM.sourceStorageBoxSelect.value) {
        console.log("StockroomGo: 初始化 - 手动触发源仓库 change 事件");
        DOM.sourceStorageBoxSelect.dispatchEvent(new Event('change'));
    } else if (DOM.sourceFolderSelect) {
        // 如果没有默认选中的源仓库，确保文件夹列表显示提示
        DOM.sourceFolderSelect.innerHTML = '<option value="">-- 请先选择源仓库 --</option>';
        DOM.sourceFolderSelect.disabled = true;
    }
    // --- 结束修改 ---
}

/**
 * 重置仓库转移界面
 */
function resetStockroomGoUI() {
    if (DOM.sourceStorageBoxSelect) DOM.sourceStorageBoxSelect.selectedIndex = 0;
    if (DOM.sourceFolderSelect) {
        DOM.sourceFolderSelect.innerHTML = '<option value="">-- 请先选择源仓库 --</option>';
        DOM.sourceFolderSelect.disabled = true;
    }
    if (DOM.targetStorageBoxSelectGo) {
        DOM.targetStorageBoxSelectGo.innerHTML = ''; // 清空目标仓库
        populateStorageBoxSelect(DOM.targetStorageBoxSelectGo, false); // 重新填充但不选
         // 添加默认提示选项
         const defaultOption = document.createElement('option');
         defaultOption.value = "";
         defaultOption.textContent = "-- 请选择目标仓库 --";
         defaultOption.disabled = true;
         defaultOption.selected = true;
         // 检查 targetBoxSelect 是否有子节点，避免插入错误
         if (DOM.targetStorageBoxSelectGo.firstChild) {
            DOM.targetStorageBoxSelectGo.insertBefore(defaultOption, DOM.targetStorageBoxSelectGo.firstChild);
         } else {
            DOM.targetStorageBoxSelectGo.appendChild(defaultOption);
         }
        DOM.targetStorageBoxSelectGo.disabled = true;
    }
    if (DOM.transferFolderButton) DOM.transferFolderButton.disabled = true;
    // --- 修改：重置仓库信息容器 ---
    if (DOM.stockroomInfoContainer) {
        DOM.stockroomInfoContainer.innerHTML = '<p class="list-placeholder">正在加载仓库信息...</p>';
    }
    // 移除对 stockroomGoLog 的处理
    sourceFolders = [];
}

/**
 * 获取并显示仓库概览信息 (文件夹数量)
 */
function displayStockroomInfo() {
    if (!DOM.stockroomInfoContainer) return;
    const container = DOM.stockroomInfoContainer;
    container.innerHTML = '<p class="list-placeholder">正在统计文件夹数量...</p>'; // 显示加载状态

    // 从 AppState.galleryImages 统计每个仓库的文件夹数量
    const folderCounts = AppState.galleryImages.reduce((acc, img) => {
        // 使用原始大小写 storageBox
        if (img.storageBox && img.folderName && !img.folderName.startsWith('.')) {
            const key = img.storageBox;
            if (!acc[key]) {
                acc[key] = new Set();
            }
            acc[key].add(img.folderName);
        }
        return acc;
    }, {});

    // 按仓库名称排序 (使用原始大小写)
    const sortedBoxes = Object.keys(folderCounts).sort((a, b) => a.localeCompare(b));

    container.innerHTML = ''; // 清空容器
    const fragment = document.createDocumentFragment();

    if (sortedBoxes.length === 0) {
        container.innerHTML = '<p class="list-placeholder">未找到任何仓库信息</p>';
        return;
    }

    sortedBoxes.forEach(storageBox => {
        const count = folderCounts[storageBox].size;
        const item = document.createElement('div');
        item.className = 'stockroom-item'; // 应用列表项样式

        // --- 修改 HTML 结构为左右布局 ---
        item.innerHTML = `
            <div class="stockroom-icon">📦</div>
            <div class="stockroom-text-content">
                <div class="stockroom-name">${storageBox}</div>
                <div class="stockroom-folder-count">${count} 个文件夹</div>
            </div>
        `;
        // --- 结构修改结束 ---

        fragment.appendChild(item);
    });

    container.appendChild(fragment);
    console.log("StockroomGo: 仓库概览信息显示完成");
}


/**
 * 当源仓库选择变化时触发
 */
async function handleSourceStorageBoxChange() {
    const selectedSourceBox = DOM.sourceStorageBoxSelect?.value; // 原始大小写
    const targetBoxSelect = DOM.targetStorageBoxSelectGo;
    const folderSelect = DOM.sourceFolderSelect;
    const transferButton = DOM.transferFolderButton;

    // 重置后续选项
    if (folderSelect) {
        folderSelect.innerHTML = '<option value="">-- 加载中... --</option>';
        folderSelect.disabled = true;
    }
    if (targetBoxSelect) {
        targetBoxSelect.innerHTML = ''; // 清空目标仓库
        populateStorageBoxSelect(targetBoxSelect, false); // 重新填充
        // 移除与源仓库相同的选项
        for (let i = targetBoxSelect.options.length - 1; i >= 0; i--) {
            if (targetBoxSelect.options[i].value === selectedSourceBox) {
                targetBoxSelect.remove(i);
            }
        }
        targetBoxSelect.disabled = targetBoxSelect.options.length === 0;
        if (targetBoxSelect.options.length > 0) {
             const defaultOption = document.createElement('option');
             defaultOption.value = ""; defaultOption.textContent = "-- 请选择目标仓库 --";
             defaultOption.disabled = true; defaultOption.selected = true;
             if (targetBoxSelect.firstChild) { targetBoxSelect.insertBefore(defaultOption, targetBoxSelect.firstChild); }
             else { targetBoxSelect.appendChild(defaultOption); }
        } else {
             const noTargetOption = document.createElement('option');
             noTargetOption.value = ""; noTargetOption.textContent = "-- 无可用目标仓库 --";
             targetBoxSelect.appendChild(noTargetOption);
        }
    }
    if (transferButton) transferButton.disabled = true;
    sourceFolders = [];

    if (!selectedSourceBox) {
        if (folderSelect) folderSelect.innerHTML = '<option value="">-- 请先选择源仓库 --</option>';
        return;
    }

    // 获取源仓库下的文件夹列表
    if (folderSelect) {
        try {
            console.log(`StockroomGo: 获取仓库 [${selectedSourceBox}] 的文件夹列表...`);
            // 从 AppState.galleryImages 推断文件夹列表 (使用原始大小写)
            sourceFolders = [...new Set(
                AppState.galleryImages
                    .filter(img => img.storageBox === selectedSourceBox && img.folderName && !img.folderName.startsWith('.'))
                    .map(img => img.folderName)
            )].sort((a, b) => a.localeCompare(b));

            folderSelect.innerHTML = '';
            if (sourceFolders.length > 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = ""; defaultOption.textContent = `-- 选择要转移的文件夹 (${sourceFolders.length}) --`;
                folderSelect.appendChild(defaultOption);
                sourceFolders.forEach(folder => {
                    const option = document.createElement('option');
                    option.value = folder;
                    option.textContent = folder;
                    folderSelect.appendChild(option);
                });
                folderSelect.disabled = false;
            } else {
                folderSelect.innerHTML = '<option value="">-- 该仓库无文件夹 --</option>';
                folderSelect.disabled = true;
            }
        } catch (error) {
            console.error("StockroomGo: 获取源文件夹列表失败:", error);
            displayToast("获取源文件夹列表失败", UI_CLASSES.ERROR);
            folderSelect.innerHTML = '<option value="">-- 加载失败 --</option>';
            folderSelect.disabled = true;
        }
    }
}

/**
 * 当源文件夹或目标仓库选择变化时 更新转移按钮状态
 */
function updateTransferButtonState() {
    const sourceFolder = DOM.sourceFolderSelect?.value;
    const targetBox = DOM.targetStorageBoxSelectGo?.value;
    if (DOM.transferFolderButton) {
        DOM.transferFolderButton.disabled = !sourceFolder || !targetBox;
    }
}

/**
 * 执行仓库转移操作
 */
async function executeStockroomTransfer() {
    const sourceBox = DOM.sourceStorageBoxSelect?.value; // 原始大小写
    const sourceFolder = DOM.sourceFolderSelect?.value;
    const targetBox = DOM.targetStorageBoxSelectGo?.value; // 原始大小写
    const transferButton = DOM.transferFolderButton;
    // 移除 logArea 引用
    const statusArea = DOM.stockroomGoStatus;

    if (!sourceBox || !sourceFolder || !targetBox) { displayToast("请确保已选择源仓库、源文件夹和目标仓库", UI_CLASSES.WARNING); return; }
    if (sourceBox === targetBox) { displayToast("源仓库和目标仓库不能相同", UI_CLASSES.WARNING); return; }

    const confirmed = confirm(`确定要将文件夹 "${sourceFolder}" 从仓库 [${sourceBox}] 转移到仓库 [${targetBox}] 吗？\n\n此操作将移动物理文件并修改 ImageData.json，请谨慎操作！`);
    if (!confirmed) { displayToast("仓库转移已取消", UI_CLASSES.INFO); return; }

    if (transferButton) transferButton.disabled = true;
    if (DOM.sourceStorageBoxSelect) DOM.sourceStorageBoxSelect.disabled = true;
    if (DOM.sourceFolderSelect) DOM.sourceFolderSelect.disabled = true;
    if (DOM.targetStorageBoxSelectGo) DOM.targetStorageBoxSelectGo.disabled = true;
    // 移除对 logArea 的操作
    if (statusArea) statusArea.textContent = "正在转移...";

    try {
        console.log("StockroomGo: 准备调用后端 API 进行转移...");
        // 移除对 logArea 的操作

        // 发送原始大小写的仓库名
        const payload = {
            sourceStorageBox: sourceBox,
            sourceFolderName: sourceFolder,
            targetStorageBox: targetBox
        };
        const result = await fetchJsonData('/api/transfer-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (result?.success) {
            // 移除对 logArea 的操作
            if (statusArea) statusArea.textContent = "转移成功！";
            displayToast("仓库转移成功！", UI_CLASSES.SUCCESS);
            displayToast("正在刷新核心数据...", UI_CLASSES.INFO, 2000);
            await initializeApplication(); // 重新初始化
            // 切换回仓库转移视图并重置 (确保视图存在)
            if (document.getElementById('stockroomGoPaneView')) {
                switchTab('GuTools');
                switchGuToolMode('stockroom_go');
                // resetStockroomGoUI(); // initializeStockroomGoView 会调用 reset
            } else {
                console.warn("StockroomGo: 转移成功 但无法自动切换回视图 (视图可能未正确初始化)");
                resetStockroomGoUI(); // 尝试直接重置
            }

        } else { throw new Error(result?.error || "服务器未能成功完成转移"); }

    } catch (error) {
        console.error("StockroomGo: 仓库转移失败:", error);
        const errorMsg = `仓库转移失败: ${error.message}`;
        // 移除对 logArea 的操作
        if (statusArea) statusArea.textContent = "转移失败";
        displayToast(errorMsg, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    } finally {
        // 移除对 logArea 的操作
        // 重新启用控件 (如果转移失败)
        if (transferButton && transferButton.disabled) transferButton.disabled = false; // 只有在还是禁用时才启用
        if (DOM.sourceStorageBoxSelect && DOM.sourceStorageBoxSelect.disabled) DOM.sourceStorageBoxSelect.disabled = false;
        if (DOM.sourceFolderSelect && DOM.sourceFolderSelect.disabled) DOM.sourceFolderSelect.disabled = !DOM.sourceStorageBoxSelect?.value;
        if (DOM.targetStorageBoxSelectGo && DOM.targetStorageBoxSelectGo.disabled) DOM.targetStorageBoxSelectGo.disabled = DOM.targetStorageBoxSelectGo.options.length <= 1;
    }
}

/**
 * 设置仓库转移视图的事件监听器
 */
function setupStockroomGoEventListeners() {
    if (DOM.sourceStorageBoxSelect) {
        DOM.sourceStorageBoxSelect.removeEventListener('change', handleSourceStorageBoxChange);
        DOM.sourceStorageBoxSelect.addEventListener('change', handleSourceStorageBoxChange);
    } else { console.error("StockroomGo: 源仓库选择框 sourceStorageBoxSelect 未找到"); } // 改为 Error
    if (DOM.sourceFolderSelect) {
        DOM.sourceFolderSelect.removeEventListener('change', updateTransferButtonState);
        DOM.sourceFolderSelect.addEventListener('change', updateTransferButtonState);
    } else { console.error("StockroomGo: 源文件夹选择框 sourceFolderSelect 未找到"); }
    if (DOM.targetStorageBoxSelectGo) {
        DOM.targetStorageBoxSelectGo.removeEventListener('change', updateTransferButtonState);
        DOM.targetStorageBoxSelectGo.addEventListener('change', updateTransferButtonState);
    } else { console.error("StockroomGo: 目标仓库选择框 targetStorageBoxSelectGo 未找到"); }
    if (DOM.transferFolderButton) {
        DOM.transferFolderButton.removeEventListener('click', executeStockroomTransfer);
        DOM.transferFolderButton.addEventListener('click', executeStockroomTransfer);
    } else { console.error("StockroomGo: 转移按钮 transferFolderButton 未找到"); }
    // 移除对 stockroomGoLog 的处理
    console.log("StockroomGo: 事件监听器设置完成");
}