// ==========================================================================
// GuTools 仓库转移: 将指定文件夹从一个仓库转移到另一个仓库
// ==========================================================================

let sourceFolders = [];

function initializeStockroomGoView() {
    console.log("StockroomGo: 初始化视图...");
    if (DOM.sourceStorageBoxSelect) {
        populateStorageBoxSelect(DOM.sourceStorageBoxSelect, false);
    }
    if (DOM.targetStorageBoxSelectGo) {
        populateStorageBoxSelect(DOM.targetStorageBoxSelectGo, false);
    }
    resetStockroomGoUI();
    setupStockroomGoEventListeners();
    displayStockroomInfo();
    if (DOM.sourceStorageBoxSelect && DOM.sourceStorageBoxSelect.value) {
        console.log("StockroomGo: 初始化 - 手动触发源仓库 change 事件");
        DOM.sourceStorageBoxSelect.dispatchEvent(new Event('change'));
    } else if (DOM.sourceFolderSelect) {
        DOM.sourceFolderSelect.innerHTML = '<option value="">-- 请先选择源仓库 --</option>';
        DOM.sourceFolderSelect.disabled = true;
    }
}

function resetStockroomGoUI() {
    if (DOM.sourceStorageBoxSelect) DOM.sourceStorageBoxSelect.selectedIndex = 0;
    if (DOM.sourceFolderSelect) {
        DOM.sourceFolderSelect.innerHTML = '<option value="">-- 请先选择源仓库 --</option>';
        DOM.sourceFolderSelect.disabled = true;
    }
    if (DOM.targetStorageBoxSelectGo) {
        DOM.targetStorageBoxSelectGo.innerHTML = '';
        populateStorageBoxSelect(DOM.targetStorageBoxSelectGo, false);
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "-- 请选择目标仓库 --";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        if (DOM.targetStorageBoxSelectGo.firstChild) {
            DOM.targetStorageBoxSelectGo.insertBefore(defaultOption, DOM.targetStorageBoxSelectGo.firstChild);
        } else {
            DOM.targetStorageBoxSelectGo.appendChild(defaultOption);
        }
        DOM.targetStorageBoxSelectGo.disabled = true;
    }
    if (DOM.transferFolderButton) DOM.transferFolderButton.disabled = true;
    if (DOM.stockroomInfoContainer) {
        DOM.stockroomInfoContainer.innerHTML = '<p class="list-placeholder">正在加载仓库信息...</p>';
    }
    sourceFolders = [];
}

function displayStockroomInfo() {
    if (!DOM.stockroomInfoContainer) return;
    const container = DOM.stockroomInfoContainer;
    container.innerHTML = '<p class="list-placeholder">正在统计文件夹数量...</p>';
    const folderCounts = AppState.galleryImages.reduce((acc, img) => {
        if (img.storageBox && img.folderName && !img.folderName.startsWith('.')) {
            const key = img.storageBox;
            if (!acc[key]) {
                acc[key] = new Set();
            }
            acc[key].add(img.folderName);
        }
        return acc;
    }, {});
    const sortedBoxes = Object.keys(folderCounts).sort((a, b) => a.localeCompare(b));
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    if (sortedBoxes.length === 0) {
        container.innerHTML = '<p class="list-placeholder">未找到任何仓库信息</p>';
        return;
    }
    sortedBoxes.forEach(storageBox => {
        const count = folderCounts[storageBox].size;
        const item = document.createElement('div');
        item.className = 'stockroom-item';
        item.innerHTML = `
            <div class="stockroom-icon">📦</div>
            <div class="stockroom-text-content">
                <div class="stockroom-name">${storageBox}</div>
                <div class="stockroom-folder-count">${count} 个文件夹</div>
            </div>
        `;
        fragment.appendChild(item);
    });
    container.appendChild(fragment);
    console.log("StockroomGo: 仓库概览信息显示完成");
}

async function handleSourceStorageBoxChange() {
    const selectedSourceBox = DOM.sourceStorageBoxSelect?.value;
    const targetBoxSelect = DOM.targetStorageBoxSelectGo;
    const folderSelect = DOM.sourceFolderSelect;
    const transferButton = DOM.transferFolderButton;
    if (folderSelect) {
        folderSelect.innerHTML = '<option value="">-- 加载中... --</option>';
        folderSelect.disabled = true;
    }
    if (targetBoxSelect) {
        targetBoxSelect.innerHTML = '';
        populateStorageBoxSelect(targetBoxSelect, false);
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
    if (folderSelect) {
        try {
            console.log(`StockroomGo: 获取仓库 [${selectedSourceBox}] 的文件夹列表...`);
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

function updateTransferButtonState() {
    const sourceFolder = DOM.sourceFolderSelect?.value;
    const targetBox = DOM.targetStorageBoxSelectGo?.value;
    if (DOM.transferFolderButton) {
        DOM.transferFolderButton.disabled = !sourceFolder || !targetBox;
    }
}

async function executeStockroomTransfer() {
    const sourceBox = DOM.sourceStorageBoxSelect?.value;
    const sourceFolder = DOM.sourceFolderSelect?.value;
    const targetBox = DOM.targetStorageBoxSelectGo?.value;
    const transferButton = DOM.transferFolderButton;
    const statusArea = DOM.stockroomGoStatus;
    if (!sourceBox || !sourceFolder || !targetBox) { displayToast("请确保已选择源仓库、源文件夹和目标仓库", UI_CLASSES.WARNING); return; }
    if (sourceBox === targetBox) { displayToast("源仓库和目标仓库不能相同", UI_CLASSES.WARNING); return; }
    const confirmed = confirm(`确定要将文件夹 "${sourceFolder}" 从仓库 [${sourceBox}] 转移到仓库 [${targetBox}] 吗？\n\n此操作将移动物理文件并修改 ImageData.json，请谨慎操作！`);
    if (!confirmed) { displayToast("仓库转移已取消", UI_CLASSES.INFO); return; }
    if (transferButton) transferButton.disabled = true;
    if (DOM.sourceStorageBoxSelect) DOM.sourceStorageBoxSelect.disabled = true;
    if (DOM.sourceFolderSelect) DOM.sourceFolderSelect.disabled = true;
    if (DOM.targetStorageBoxSelectGo) DOM.targetStorageBoxSelectGo.disabled = true;
    if (statusArea) statusArea.textContent = "正在转移...";
    try {
        console.log("StockroomGo: 准备调用后端 API 进行转移...");
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
            if (statusArea) statusArea.textContent = "转移成功！";
            displayToast("仓库转移成功！", UI_CLASSES.SUCCESS);
            displayToast("正在刷新核心数据...", UI_CLASSES.INFO, 2000);
            await initializeApplication();
            if (document.getElementById('stockroomGoPaneView')) {
                switchTab('GuTools');
                switchGuToolMode('stockroom_go');
            } else {
                console.warn("StockroomGo: 转移成功 但无法自动切换回视图 (视图可能未正确初始化)");
                resetStockroomGoUI();
            }
        } else { throw new Error(result?.error || "服务器未能成功完成转移"); }
    } catch (error) {
        console.error("StockroomGo: 仓库转移失败:", error);
        const errorMsg = `仓库转移失败: ${error.message}`;
        if (statusArea) statusArea.textContent = "转移失败";
        displayToast(errorMsg, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
    } finally {
        if (transferButton && transferButton.disabled) transferButton.disabled = false;
        if (DOM.sourceStorageBoxSelect && DOM.sourceStorageBoxSelect.disabled) DOM.sourceStorageBoxSelect.disabled = false;
        if (DOM.sourceFolderSelect && DOM.sourceFolderSelect.disabled) DOM.sourceFolderSelect.disabled = !DOM.sourceStorageBoxSelect?.value;
        if (DOM.targetStorageBoxSelectGo && DOM.targetStorageBoxSelectGo.disabled) DOM.targetStorageBoxSelectGo.disabled = DOM.targetStorageBoxSelectGo.options.length <= 1;
    }
}

function setupStockroomGoEventListeners() {
    if (DOM.sourceStorageBoxSelect) {
        DOM.sourceStorageBoxSelect.removeEventListener('change', handleSourceStorageBoxChange);
        DOM.sourceStorageBoxSelect.addEventListener('change', handleSourceStorageBoxChange);
    } else { console.error("StockroomGo: 源仓库选择框 sourceStorageBoxSelect 未找到"); }
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
    console.log("StockroomGo: 事件监听器设置完成");
}
