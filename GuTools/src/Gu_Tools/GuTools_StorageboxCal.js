// ==========================================================================
// GuTools 仓库核对 核对字段
// ==========================================================================

let sbxCalIsRunning = false;
let sbxCalIsAborted = false;
let sbxCalMismatchedEntries = [];

function resetSbxCalibratorUI() {
    if (DOM.sbxCalStartButton) DOM.sbxCalStartButton.disabled = false;
    if (DOM.sbxCalAbortButton) { DOM.sbxCalAbortButton.disabled = true; DOM.sbxCalAbortButton.classList.add(UI_CLASSES.HIDDEN); }
    if (DOM.sbxCalFixButton) { DOM.sbxCalFixButton.disabled = true; DOM.sbxCalFixButton.classList.add(UI_CLASSES.DISABLED); }
    
    if (DOM.sbxCalStatusArea) DOM.sbxCalStatusArea.innerHTML = `
        <p>点击“开始校准”以启动。</p>
        <p class="status-line"><span class="label">JSON记录总数:</span> <span id="sbxCalTotalJsonDisplay" class="value">0</span></p>
        <p class="status-line"><span class="label">物理文件总数:</span> <span id="sbxCalTotalFilesDisplay" class="value">0</span></p>
        <p class="status-line"><span class="label">已检查JSON:</span> <span id="sbxCalCheckedJsonDisplay" class="value">0</span></p>
        <p class="status-line"><span class="label">不一致数量:</span> <span id="sbxCalMismatchCountDisplay" class="value error">0</span></p>
        <hr style="border-color: var(--sbx-border-color); margin: 8px 0;">
        <p id="sbxCalCurrentScanItemLabel" style="font-weight: bold; color: var(--sbx-text-dark); margin-bottom: 2px;">当前检查:</p>
        <div id="sbxCalCurrentScanDetails" style="font-size: 0.85em; line-height: 1.4; color: var(--sbx-text-medium); min-height: 60px; word-break: break-all;">
            <p><span class="label">文件名:</span> <span id="sbxCalScanFilename" class="value">-</span></p>
            <p><span class="label">声称仓库:</span> <span id="sbxCalScanJsonBox" class="value">-</span></p>
            <p><span class="label">实际仓库:</span> <span id="sbxCalScanActualBox" class="value">-</span></p>
            <p><span class="label">是否一致:</span> <span id="sbxCalScanMatchStatus" class="value">-</span></p>
        </div>
    `;
    
    if (DOM.sbxCalProgressBar) { DOM.sbxCalProgressBar.style.display = 'none'; DOM.sbxCalProgressBar.value = 0; }
    if (DOM.sbxCalMismatchList) DOM.sbxCalMismatchList.value = '';
    
    // 重新获取DOM引用，因为sbxCalStatusArea的innerHTML被重写了
    DOM.sbxCalTotalJsonDisplay = document.getElementById('sbxCalTotalJsonDisplay');
    DOM.sbxCalTotalFilesDisplay = document.getElementById('sbxCalTotalFilesDisplay');
    DOM.sbxCalCheckedJsonDisplay = document.getElementById('sbxCalCheckedJsonDisplay');
    DOM.sbxCalMismatchCountDisplay = document.getElementById('sbxCalMismatchCountDisplay');
    DOM.sbxCalScanFilename = document.getElementById('sbxCalScanFilename');
    DOM.sbxCalScanJsonBox = document.getElementById('sbxCalScanJsonBox');
    DOM.sbxCalScanActualBox = document.getElementById('sbxCalScanActualBox');
    DOM.sbxCalScanMatchStatus = document.getElementById('sbxCalScanMatchStatus');
    if (DOM.sbxCalMismatchCountDisplayInner) DOM.sbxCalMismatchCountDisplayInner.textContent = '0';


    sbxCalIsRunning = false;
    sbxCalIsAborted = false;
    sbxCalMismatchedEntries = [];
}

async function startStorageboxCalibration() {
    if (sbxCalIsRunning) { displayToast("校准正在进行中...", UI_CLASSES.INFO); return; }

    resetSbxCalibratorUI(); 

    sbxCalIsRunning = true;
    sbxCalIsAborted = false;
    sbxCalMismatchedEntries = [];

    DOM.sbxCalStartButton.disabled = true;
    DOM.sbxCalStartButton.classList.add(UI_CLASSES.HIDDEN); 
    DOM.sbxCalAbortButton.disabled = false;
    DOM.sbxCalAbortButton.classList.remove(UI_CLASSES.HIDDEN); 
    DOM.sbxCalFixButton.disabled = true;
    DOM.sbxCalFixButton.classList.add(UI_CLASSES.DISABLED);
    
    const statusArea = DOM.sbxCalStatusArea; 
    if (statusArea) statusArea.querySelector('p:first-child').textContent = '正在初始化校准...';

    DOM.sbxCalProgressBar.style.display = 'block';
    DOM.sbxCalProgressBar.value = 0;
    DOM.sbxCalMismatchList.value = '';
    DOM.sbxCalMismatchCountDisplay.textContent = '0';
    if (DOM.sbxCalMismatchCountDisplayInner) DOM.sbxCalMismatchCountDisplayInner.textContent = '0';

    displayToast("开始 storagebox 校准...", UI_CLASSES.INFO, 2000);

    try {
        if (statusArea) statusArea.querySelector('p:first-child').textContent = '步骤 1/3: 获取图库物理文件列表...';
        const physicalFilesRaw = await fetchJsonData(API_ENDPOINTS.FETCH_GALLERY_IMAGES);
        if (!Array.isArray(physicalFilesRaw)) throw new Error("获取的物理文件列表格式不正确。");
        
        DOM.sbxCalTotalFilesDisplay.textContent = physicalFilesRaw.length.toString();
        if (physicalFilesRaw.length === 0) {
            displayToast("警告：未扫描到任何物理图库文件！", UI_CLASSES.WARNING);
        }

        if (statusArea) statusArea.querySelector('p:first-child').textContent = '步骤 2/3: 获取 ImageData.json 数据...';
        const imageDataJson = await fetchJsonData(API_ENDPOINTS.FETCH_USER_DATA);
        if (!Array.isArray(imageDataJson)) throw new Error("获取的 ImageData.json 格式不正确。");
        DOM.sbxCalTotalJsonDisplay.textContent = imageDataJson.length.toString();
        DOM.sbxCalProgressBar.max = imageDataJson.length;

        if (statusArea) statusArea.querySelector('p:first-child').textContent = `步骤 3/3: 开始比对 ${imageDataJson.length} 条记录...`;
        let checkedCount = 0;
        let mismatchCount = 0;
        const mismatchBuffer = [];

        for (const entry of imageDataJson) {
            if (sbxCalIsAborted) { displayToast("校准已中止。", UI_CLASSES.WARNING); break; }
            checkedCount++;
            DOM.sbxCalProgressBar.value = checkedCount;
            if (DOM.sbxCalCheckedJsonDisplay) DOM.sbxCalCheckedJsonDisplay.textContent = checkedCount.toString();
            
            const jsonFilename = entry.attributes?.filename || entry.path?.split('/').pop() || '未知文件';
            const jsonCharacterName = entry.characterName || '未知角色'; 
            const jsonDeclaredStoragebox = entry.storagebox || '未知'; // JSON中记录的，通常是小写
            const jsonRelativePath = entry.path || '未知路径';
            
            if (DOM.sbxCalScanFilename) DOM.sbxCalScanFilename.textContent = jsonFilename;
            if (DOM.sbxCalScanJsonBox) DOM.sbxCalScanJsonBox.textContent = jsonDeclaredStoragebox;
            if (DOM.sbxCalScanActualBox) DOM.sbxCalScanActualBox.textContent = '查找中...'; 
            if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.textContent = '...'; DOM.sbxCalScanMatchStatus.className = 'value';}

            if (!entry || !entry.path || !entry.storagebox) {
                if (DOM.sbxCalScanFilename) DOM.sbxCalScanFilename.textContent = `无效JSON条目 (GID: ${entry?.gid || '未知'})`;
                if (DOM.sbxCalScanActualBox) DOM.sbxCalScanActualBox.textContent = '无效条目';
                if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.innerHTML = '<strong style="color:var(--sbx-warn-color);">⚠️ 无效</strong>';}
                await new Promise(r => setTimeout(r, 1)); 
                continue;
            }
            
            let foundPhysicalFile = null;
            const jsonRelativePathNormalized = jsonRelativePath.replace(/\\/g, "/");

            for (const physicalImg of physicalFilesRaw) {
                if (physicalImg.urlPath && physicalImg.storageBox) {
                    if (physicalImg.urlPath.toLowerCase() === jsonRelativePathNormalized.toLowerCase() &&
                        physicalImg.storageBox.toLowerCase() === jsonDeclaredStoragebox.toLowerCase()) {
                        foundPhysicalFile = physicalImg;
                        break; 
                    }
                    if (physicalImg.urlPath.toLowerCase() === jsonRelativePathNormalized.toLowerCase()) {
                        foundPhysicalFile = physicalImg; 
                    }
                }
            }
            if (!foundPhysicalFile) {
                for (const physicalImg of physicalFilesRaw) {
                     if (physicalImg.fileName?.toLowerCase() === jsonFilename.toLowerCase() &&
                        (physicalImg.folderName === jsonCharacterName || physicalImg.name === jsonCharacterName)) {
                        foundPhysicalFile = physicalImg;
                        break;
                    }
                }
            }


            const displayFullPathForJson = buildFullWebPath(jsonDeclaredStoragebox, jsonRelativePath);

            if (foundPhysicalFile) { 
                const actualStorageBox = foundPhysicalFile.storageBox; 
                if (DOM.sbxCalScanActualBox) DOM.sbxCalScanActualBox.textContent = actualStorageBox;

                if (actualStorageBox.toLowerCase() !== jsonDeclaredStoragebox.toLowerCase()) { 
                    if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.innerHTML = '<strong style="color:var(--sbx-error-color);">❌ 不一致</strong>';}
                    mismatchCount++;
                    const mismatchEntry = {
                        gid: entry.gid,
                        filename: jsonFilename,
                        characterName: jsonCharacterName,
                        jsonStoragebox: jsonDeclaredStoragebox, 
                        actualStorageBox: actualStorageBox, 
                        fullPath: displayFullPathForJson 
                    };
                    sbxCalMismatchedEntries.push(mismatchEntry);
                    mismatchBuffer.push(`文件: ${jsonFilename} (角色: ${jsonCharacterName}, GID: ${mismatchEntry.gid})\n  JSON记录仓库: ${jsonDeclaredStoragebox}\n  实际物理仓库: ${actualStorageBox} <--- 应修正为此\n  JSON记录路径: ${displayFullPathForJson}\n`);
                } else { 
                    if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.innerHTML = '<span style="color:var(--sbx-success-color);">✅ 一致</span>';}
                }
            } else { 
                 if (DOM.sbxCalScanActualBox) DOM.sbxCalScanActualBox.textContent = '未找到实体';
                 if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.innerHTML = '<strong style="color:var(--sbx-error-color);">❌ 文件缺失</strong>';}
                 mismatchCount++;
                 const mismatchEntry = {
                     gid: entry.gid,
                     filename: jsonFilename,
                     characterName: jsonCharacterName,
                     jsonStoragebox: jsonDeclaredStoragebox,
                     actualStorageBox: "文件未找到", 
                     fullPath: displayFullPathForJson
                 };
                 sbxCalMismatchedEntries.push(mismatchEntry);
                 mismatchBuffer.push(`文件: ${jsonFilename} (角色: ${jsonCharacterName}, GID: ${mismatchEntry.gid})\n  JSON记录仓库: ${jsonDeclaredStoragebox}\n  物理文件未在内容仓库中找到!\n  JSON记录路径: ${displayFullPathForJson}\n`);
            }
            if (DOM.sbxCalMismatchList) DOM.sbxCalMismatchList.value = mismatchBuffer.join('\n');
            if (DOM.sbxCalMismatchCountDisplay) DOM.sbxCalMismatchCountDisplay.textContent = mismatchCount.toString();
            if (DOM.sbxCalMismatchCountDisplayInner) DOM.sbxCalMismatchCountDisplayInner.textContent = mismatchCount.toString();
            
            if (checkedCount % 20 === 0) await new Promise(r => setTimeout(r, 1));
        }

        if (!sbxCalIsAborted) {
            if (statusArea) statusArea.querySelector('p:first-child').textContent = `校准完成！检查了 ${checkedCount} 条JSON记录。`;
            if (DOM.sbxCalScanFilename) DOM.sbxCalScanFilename.textContent = '-'; 
            if (DOM.sbxCalScanJsonBox) DOM.sbxCalScanJsonBox.textContent = '-';
            if (DOM.sbxCalScanActualBox) DOM.sbxCalScanActualBox.textContent = '-';
            if (DOM.sbxCalScanMatchStatus) { DOM.sbxCalScanMatchStatus.textContent = '-'; DOM.sbxCalScanMatchStatus.className = 'value';}

            if (mismatchCount > 0) {
                displayToast(`发现 ${mismatchCount} 个 storagebox 不一致或文件缺失的记录。`, UI_CLASSES.WARNING, 5000);
                if (DOM.sbxCalFixButton && sbxCalMismatchedEntries.some(e => e.actualStorageBox !== "文件未找到")) { 
                    DOM.sbxCalFixButton.disabled = false; 
                    DOM.sbxCalFixButton.classList.remove(UI_CLASSES.DISABLED); 
                }
            } else {
                displayToast("所有记录的 storagebox 均正确！", UI_CLASSES.SUCCESS);
            }
        }

    } catch (error) {
        console.error("StorageboxCal: 校准过程中发生错误:", error);
        displayToast(`校准失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        if (DOM.sbxCalStatusArea) DOM.sbxCalStatusArea.querySelector('p:first-child').textContent = `校准出错! ${error.message}`;
    } finally {
        sbxCalIsRunning = false;
        if (DOM.sbxCalStartButton) {
            DOM.sbxCalStartButton.disabled = false;
            DOM.sbxCalStartButton.classList.remove(UI_CLASSES.HIDDEN); 
        }
        if (DOM.sbxCalAbortButton) { 
            DOM.sbxCalAbortButton.disabled = true; 
            DOM.sbxCalAbortButton.classList.add(UI_CLASSES.HIDDEN); 
        }
        if (DOM.sbxCalProgressBar) DOM.sbxCalProgressBar.style.display = 'none';
    }
}

function abortSbxCalibration() {
    if (!sbxCalIsRunning) return;
    sbxCalIsAborted = true;
    displayToast("正在中止 storagebox 校准...", UI_CLASSES.WARNING);
    if (DOM.sbxCalAbortButton) {
        DOM.sbxCalAbortButton.disabled = true;
    }
    if (DOM.sbxCalFixButton && sbxCalMismatchedEntries.some(e => e.actualStorageBox !== "文件未找到")) {
        DOM.sbxCalFixButton.disabled = false;
        DOM.sbxCalFixButton.classList.remove(UI_CLASSES.DISABLED);
    }
}

async function fixAllSbxMismatches() {
    if (!DOM.sbxCalFixButton || DOM.sbxCalFixButton.disabled) return;
    
    const itemsToFix = sbxCalMismatchedEntries.filter(entry => entry.actualStorageBox !== "文件未找到");
    if (itemsToFix.length === 0) {
        displayToast("没有可自动修正的 storagebox (均为文件缺失或已修正)。", UI_CLASSES.INFO);
        DOM.sbxCalFixButton.disabled = true;
        DOM.sbxCalFixButton.classList.add(UI_CLASSES.DISABLED);
        return;
    }

    const confirmed = confirm(`即将为 ${itemsToFix.length} 条记录修正 storagebox 字段。\n此操作将直接修改 ImageData.json 文件！\n\n确定要修正吗？`);
    if (!confirmed) { displayToast("修正操作已取消。", UI_CLASSES.INFO); return; }

    DOM.sbxCalFixButton.disabled = true;
    DOM.sbxCalFixButton.classList.add(UI_CLASSES.DISABLED);
    if (DOM.sbxCalStartButton) DOM.sbxCalStartButton.disabled = true;
    if (DOM.sbxCalStatusArea) DOM.sbxCalStatusArea.querySelector('p:first-child').textContent = `正在修正 ${itemsToFix.length} 条记录...`;
    displayToast("正在修正 storagebox...", UI_CLASSES.INFO);

    const payload = itemsToFix.map(entry => ({
        gid: entry.gid, 
        correctStorageBox: entry.actualStorageBox 
    }));
    
    try {
        const result = await fetchJsonData(API_ENDPOINTS.BATCH_UPDATE_STORAGEBOX, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entriesToUpdate: payload }) 
        });

        if (result?.success) {
            displayToast(`成功修正 ${result.updatedCount || 0} 条记录的 storagebox！`, UI_CLASSES.SUCCESS, DELAYS.MESSAGE_CLEAR_DEFAULT);
            await initializeApplication(); 
            resetSbxCalibratorUI(); 
            if (DOM.sbxCalStatusArea) DOM.sbxCalStatusArea.querySelector('p:first-child').textContent = `修正完成！`;
            displayToast("建议重新进行校准以确认结果。", UI_CLASSES.INFO, 4000);
        } else {
            throw new Error(result?.error || "后端未能成功修正 storagebox。");
        }
    } catch (error) {
        console.error("StorageboxCal: 修正时出错:", error);
        displayToast(`修正 storagebox 失败: ${error.message}`, UI_CLASSES.ERROR, DELAYS.TOAST_ERROR_DURATION);
        if (DOM.sbxCalStatusArea) DOM.sbxCalStatusArea.querySelector('p:first-child').textContent = `修正失败!`;
        if (DOM.sbxCalFixButton) { DOM.sbxCalFixButton.disabled = false; DOM.sbxCalFixButton.classList.remove(UI_CLASSES.DISABLED); }
    } finally {
        if (DOM.sbxCalStartButton) DOM.sbxCalStartButton.disabled = false;
    }
}

function setupStorageboxCalibratorEventListeners() {
    if (DOM.sbxCalStartButton) { DOM.sbxCalStartButton.removeEventListener('click', startStorageboxCalibration); DOM.sbxCalStartButton.addEventListener('click', startStorageboxCalibration); }
    if (DOM.sbxCalAbortButton) { DOM.sbxCalAbortButton.removeEventListener('click', abortSbxCalibration); DOM.sbxCalAbortButton.addEventListener('click', abortSbxCalibration); }
    if (DOM.sbxCalFixButton) { DOM.sbxCalFixButton.removeEventListener('click', fixAllSbxMismatches); DOM.sbxCalFixButton.addEventListener('click', fixAllSbxMismatches); }
    console.log("StorageboxCal: 事件监听器设置完成。");
}