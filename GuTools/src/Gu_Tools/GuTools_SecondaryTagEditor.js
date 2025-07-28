// ==========================================================================
// GuTools 二级标签编辑器: 补缺或全体编辑图片的二级标签
// ==========================================================================

const STEState = {
    currentMode: 'fill',
    currentIndex: -1,
    currentImageList: [],
    currentImageEntry: null,
    currentTags: new Set(),
    searchDebounceTimer: null,
    lastBuiltMode: null,
    lastSearchKeyword: null,
    tagCategories: {},
    characterTags: [],
    isSavingTags: false,
};

// 用于管理模态框内部状态和 SortableJS 实例
let sortableInstance = null;
let modalTagState = null;

/**
 * 初始化二级标签编辑器视图，从API获取标签并动态创建UI。
 */
async function initializeSecondaryTagEditorView() {
    if (!DOM.secondaryTagEditorPaneView) return;

    try {
        const response = await fetch('/api/secondary-tags');
        if (!response.ok) throw new Error(`无法获取标签配置 (HTTP ${response.status})`);
        const allTagsData = await response.json();

        STEState.characterTags = allTagsData['🧜‍♂ 人物类型'] || [];
        delete allTagsData['🧜‍♂ 人物类型'];
        STEState.tagCategories = allTagsData;

        const categorizedTagsContainer = document.getElementById('steCategorizedTags');
        if (categorizedTagsContainer) {
            categorizedTagsContainer.innerHTML = '';
            for (const [category, tags] of Object.entries(STEState.tagCategories)) {
                const categoryEl = document.createElement('div');
                categoryEl.className = 'ste-tag-category';
                const titleEl = document.createElement('h6');
                titleEl.className = 'ste-category-title';
                titleEl.textContent = category;
                const wrapperEl = document.createElement('div');
                wrapperEl.className = 'ste-category-tags-wrapper';
                tags.forEach(tag => {
                    const tagEl = document.createElement('div');
                    tagEl.className = 'ste-predefined-tag';
                    tagEl.textContent = tag;
                    tagEl.dataset.tag = tag;
                    wrapperEl.appendChild(tagEl);
                });
                categoryEl.appendChild(titleEl);
                categoryEl.appendChild(wrapperEl);
                categorizedTagsContainer.appendChild(categoryEl);
            }
        }

        const characterTagsContainer = document.getElementById('steCharTagsInteractive');
        if (characterTagsContainer) {
            characterTagsContainer.innerHTML = '';
            STEState.characterTags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'char-tag-pill';
                tagEl.textContent = tag;
                tagEl.dataset.tag = tag;
                characterTagsContainer.appendChild(tagEl);
            });
        }

    } catch (error) {
        console.error("加载二级标签失败:", error);
        displayToast("加载二级标签配置失败！", "error");
    }

    const modal = document.getElementById('steTagManagementModal');
    if (modal) {
        modal.querySelector('#steModalCloseBtn').addEventListener('click', closeTagManagementModal);
        modal.querySelector('#steModalAddNewTagBtn').addEventListener('click', handleAddNewTag);
        modal.querySelector('#steModalAddNewCategoryBtn').addEventListener('click', handleAddNewCategory);
        modal.querySelector('#steModalDeleteCategorySelect').addEventListener('change', populateTagsForDeletion);
        modal.querySelector('#steModalSaveChangesBtn').addEventListener('click', handleSaveChanges);
    }

    resetSTEInterface();
    if (DOM.steSearchInput) DOM.steSearchInput.disabled = true;
    const fillModeRadio = document.querySelector('input[name="steMode"][value="fill"]');
    if (fillModeRadio) fillModeRadio.checked = true;
    STEState.currentMode = 'fill';
    loadNextImage();
}

/**
 * 重置编辑器界面状态。
 */
function resetSTEInterface(clearAll = true) {
    if (clearAll) {
        STEState.currentIndex = -1;
        STEState.currentImageList = [];
        if (DOM.steSearchInput) DOM.steSearchInput.value = '';
    }
    STEState.currentImageEntry = null;
    STEState.currentTags.clear();
    if (DOM.stePreviewImage) { DOM.stePreviewImage.src = ''; DOM.stePreviewImage.classList.add('hidden'); }
    if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '加载中...';
    if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
    if (DOM.steTagList) DOM.steTagList.innerHTML = '';
    if (DOM.steTagInput) DOM.steTagInput.value = '';
    if (DOM.steSaveButton) DOM.steSaveButton.disabled = true;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = true;
    updatePredefinedTagsUI();
}

/**
 * 加载并显示下一张需要编辑的图片。
 */
function loadNextImage() {
    if (typeof window.resetImageViewer === 'function') {
        window.resetImageViewer();
    }
    resetSTEInterface(false);
    const mode = STEState.currentMode;
    const searchKeyword = DOM.steSearchInput.value.toLowerCase().trim();
    if (STEState.currentImageList.length === 0 || mode !== STEState.lastBuiltMode || (mode === 'all' && searchKeyword !== STEState.lastSearchKeyword)) {
        STEState.lastBuiltMode = mode;
        STEState.lastSearchKeyword = searchKeyword;
        STEState.currentIndex = -1;
        if (mode === 'fill') {
            STEState.currentImageList = AppState.galleryImages.filter(img => {
                const userDataEntry = AppState.userData.find(ud => ud.path === img.urlPath && ud.storagebox?.toLowerCase() === img.storageBox.toLowerCase());
                return !userDataEntry || !userDataEntry.attributes.secondaryTags || userDataEntry.attributes.secondaryTags.length === 0;
            });
        } else if (mode === 'all') {
            if (searchKeyword) {
                 STEState.currentImageList = AppState.galleryImages.filter(img => img.fileName.toLowerCase().includes(searchKeyword) || img.name.toLowerCase().includes(searchKeyword));
            } else {
                STEState.currentImageList = [...AppState.galleryImages];
            }
        }
    }
    let imagePool = STEState.currentImageList;
    const nextIndex = STEState.currentIndex + 1;
    if (nextIndex >= imagePool.length) {
        if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '所有图片处理完毕！🎉';
        if (DOM.steImageInfo) DOM.steImageInfo.classList.add('hidden');
        if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = '完成';
        if (DOM.stePreviewImage) DOM.stePreviewImage.classList.add('hidden');
        displayToast("当前模式下所有图片已处理完毕！", "success");
        return;
    }
    STEState.currentIndex = nextIndex;
    STEState.currentImageEntry = imagePool[nextIndex];
    if (DOM.steProgressDisplay) DOM.steProgressDisplay.textContent = `${STEState.currentIndex + 1}/${imagePool.length}`;
    renderImageAndTags(STEState.currentImageEntry);
}

/**
 * 渲染当前图片预览、信息及其已有的标签。
 */
function renderImageAndTags(imageEntry) {
    if (!imageEntry) return;

    if (DOM.stePreviewImage) {
        const fullPath = buildFullWebPath(imageEntry.storageBox, imageEntry.urlPath);
        DOM.stePreviewImage.src = fullPath;
        DOM.stePreviewImage.classList.remove('hidden');
        if (DOM.stePreviewPlaceholder) DOM.stePreviewPlaceholder.textContent = '';
    }
    
    if (DOM.steImageInfo) {
        DOM.steImageInfo.classList.remove('hidden');
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').textContent = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-filename').title = imageEntry.fileName;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-character').textContent = `角色: ${imageEntry.name}`;
        DOM.steImageInfo.querySelector('.info-left-content .ste-info-storagebox').textContent = `仓库: ${imageEntry.storageBox}`;
    }

    const userDataEntry = AppState.userData.find(ud => ud.path === imageEntry.urlPath && ud.storagebox?.toLowerCase() === imageEntry.storageBox.toLowerCase());
    if (userDataEntry && userDataEntry.attributes.secondaryTags) {
        userDataEntry.attributes.secondaryTags.forEach(tag => STEState.currentTags.add(tag));
    }

    renderCurrentTags();
    updatePredefinedTagsUI();

    if (DOM.steSaveButton) DOM.steSaveButton.disabled = false;
    if (DOM.steSkipButton) DOM.steSkipButton.disabled = false;
}

/**
 * 仅渲染手动输入的标签列表。
 */
function renderCurrentTags() {
    if (DOM.steTagList) {
        DOM.steTagList.innerHTML = '';
        const nonCharTags = Array.from(STEState.currentTags).filter(tag => !STEState.characterTags.includes(tag));
        nonCharTags.forEach(tag => {
            const li = document.createElement('li');
            li.className = 'ste-tag-item';
            li.textContent = tag;
            const removeBtn = document.createElement('span');
            removeBtn.className = 'ste-tag-remove';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => { 
                STEState.currentTags.delete(tag); 
                renderCurrentTags(); 
                updatePredefinedTagsUI(); 
            };
            li.appendChild(removeBtn);
            DOM.steTagList.appendChild(li);
        });
    }
}

/**
 * 更新所有可点击标签,左右面板的选中高亮状态。
 */
function updatePredefinedTagsUI() {
    document.querySelectorAll('.ste-predefined-tag').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
    document.querySelectorAll('#steCharTagsInteractive .char-tag-pill').forEach(el => {
        el.classList.toggle('selected', STEState.currentTags.has(el.dataset.tag));
    });
}

/**
 * 保存当前图片的标签并加载下一张。
 */
async function saveAndNext() {
    if (!STEState.currentImageEntry) return;
    const currentSelection = STEState.currentImageEntry;
    let entryIndex = AppState.userData.findIndex(ud => ud.path === currentSelection.urlPath && ud.storagebox?.toLowerCase() === currentSelection.storageBox.toLowerCase());
    let entryToProcess, isNewEntry = false;
    if (entryIndex > -1) {
        entryToProcess = { ...AppState.userData[entryIndex] };
        if (!entryToProcess.attributes) entryToProcess.attributes = {};
    } else {
        const md5Value = await fetchImageMd5(buildFullWebPath(currentSelection.storageBox, currentSelection.urlPath)) || null;
        entryToProcess = {
            storagebox: currentSelection.storageBox.toLowerCase(), gid: generateNumericId(), characterName: currentSelection.name || "Unknown",
            path: currentSelection.urlPath, attributes: {
                filename: currentSelection.fileName, parentFolder: currentSelection.folderName, isPx18: false, isRx18: false, layout: "normal",
                isEasterEgg: false, isAiImage: false, isBan: false, md5: md5Value, Downloaded_From: "TagEditor",
            }, timestamp: new Date().toISOString(), sourceGallery: currentSelection.gallery,
        };
        isNewEntry = true;
    }
    entryToProcess.attributes.secondaryTags = Array.from(STEState.currentTags);
    entryToProcess.timestamp = new Date().toISOString();
    const updatedDataList = [...AppState.userData];
    if (isNewEntry) { updatedDataList.push(entryToProcess); } else { updatedDataList[entryIndex] = entryToProcess; }
    const success = await updateUserData(updatedDataList, `标签已保存`, "toast", false, 2000);
    if (success) { 
        STEState.currentImageList = []; 
        loadNextImage(); 
    } else { 
        if (DOM.steSaveButton) DOM.steSaveButton.disabled = false; 
    }
}

/**
 * 显示搜索建议。
 */
function displaySteSuggestions(results) {
    if (!DOM.steSuggestions) return;
    DOM.steSuggestions.innerHTML = '';
    if (results.length === 0) { DOM.steSuggestions.classList.add('hidden'); return; }
    const fragment = document.createDocumentFragment();
    results.forEach(imgInfo => {
        const item = document.createElement('div');
        item.className = 'suggestion-item import-suggestion';
        const thumb = document.createElement('img');
        thumb.className = 'suggestion-thumbnail';
        const fullImagePath = buildFullWebPath(imgInfo.storageBox, imgInfo.urlPath);
        thumb.src = `/api/thumbnail${fullImagePath}`;
        thumb.alt = imgInfo.fileName;
        thumb.loading = 'lazy';
        const textContainer = document.createElement('div');
        textContainer.className = 'suggestion-text-content';
        const charNameSpan = document.createElement('span');
        charNameSpan.className = 'suggestion-character-name';
        charNameSpan.textContent = imgInfo.name;
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'suggestion-file-name';
        fileNameSpan.textContent = imgInfo.fileName;
        textContainer.appendChild(charNameSpan);
        textContainer.appendChild(fileNameSpan);
        item.appendChild(thumb);
        item.appendChild(textContainer);
        item.title = `${imgInfo.storageBox}/${imgInfo.folderName}/${imgInfo.fileName}`;
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (DOM.steSearchInput) DOM.steSearchInput.value = imgInfo.fileName;
            if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
            const foundIndex = AppState.galleryImages.findIndex(img => img.urlPath === imgInfo.urlPath && img.storageBox === imgInfo.storageBox);
            if (foundIndex > -1) {
                STEState.currentImageList = [...AppState.galleryImages];
                STEState.currentIndex = foundIndex - 1;
                loadNextImage();
            }
        });
        fragment.appendChild(item);
    });
    DOM.steSuggestions.appendChild(fragment);
    DOM.steSuggestions.classList.remove('hidden');
}

/**
 * 设置二级标签编辑器视图的所有事件监听器。
 */
function setupSecondaryTagEditorEventListeners() {
    const rightPanel = document.querySelector('.ste-right-panel');
    const leftPanelInfo = document.getElementById('steImageInfo');

    if (rightPanel) {
        rightPanel.addEventListener('click', (e) => {
            if (e.target.matches('.ste-predefined-tag')) {
                const tag = e.target.dataset.tag;
                if (STEState.currentTags.has(tag)) {
                    STEState.currentTags.delete(tag);
                } else {
                    STEState.currentTags.add(tag);
                }
                renderCurrentTags();
                updatePredefinedTagsUI();
            }
        });
    }

    if (leftPanelInfo) {
        leftPanelInfo.addEventListener('click', (e) => {
            if(e.target.matches('.char-tag-pill')) {
                const tag = e.target.dataset.tag;
                if (STEState.currentTags.has(tag)) {
                    STEState.currentTags.delete(tag);
                } else {
                    STEState.currentTags.add(tag);
                }
                renderCurrentTags(); 
                updatePredefinedTagsUI();
            }
        });
    }

    if (DOM.steTagInput) {
        DOM.steTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const tag = DOM.steTagInput.value.trim();
                if (tag) {
                    STEState.currentTags.add(tag);
                    renderCurrentTags();
                    updatePredefinedTagsUI();
                    DOM.steTagInput.value = '';
                }
            }
        });
    }

    document.querySelectorAll('input[name="steMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            STEState.currentMode = e.target.value;
            STEState.currentImageList = [];
            STEState.currentIndex = -1;
            const isAllMode = STEState.currentMode === 'all';
            if (DOM.steSearchInput) {
                DOM.steSearchInput.disabled = !isAllMode;
                if (!isAllMode) {
                    DOM.steSearchInput.value = '';
                    if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                }
            }
            loadNextImage();
        });
    });

    if (DOM.steSearchInput) {
        DOM.steSearchInput.addEventListener('input', () => {
            clearTimeout(STEState.searchDebounceTimer);
            STEState.searchDebounceTimer = setTimeout(() => {
                const query = DOM.steSearchInput.value.toLowerCase().trim();
                if (query) {
                    const results = AppState.galleryImages.filter(img => img.fileName.toLowerCase().includes(query) || img.name.toLowerCase().includes(query)).slice(0, 20);
                    displaySteSuggestions(results);
                } else {
                    if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                }
            }, DELAYS.INPUT_DEBOUNCE);
        });
        DOM.steSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden');
                STEState.currentImageList = [];
                STEState.currentIndex = -1;
                loadNextImage();
            }
        });
        DOM.steSearchInput.addEventListener('blur', () => { setTimeout(() => { if (DOM.steSuggestions) DOM.steSuggestions.classList.add('hidden'); }, 200); });
    }

    if (DOM.steSaveButton) DOM.steSaveButton.addEventListener('click', saveAndNext);
    if (DOM.steSkipButton) DOM.steSkipButton.addEventListener('click', loadNextImage);
    if (DOM.stePreviewImage) {
        DOM.stePreviewImage.addEventListener('click', () => {
            if (DOM.stePreviewImage.src && !DOM.stePreviewImage.classList.contains('hidden')) {
                if (typeof window.openImageViewer === 'function') {
                    window.openImageViewer(DOM.stePreviewImage.src);
                }
            }
        });
    }

    const manageTagsBtn = document.getElementById('steManageTagsBtn');
    if (manageTagsBtn) {
        manageTagsBtn.addEventListener('click', openTagManagementModal);
    }
}

/**
 * 打开标签管理模态框，并创建临时状态
 */
function openTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    const select = document.getElementById('steModalCategorySelect');
    const deleteCategorySelect = document.getElementById('steModalDeleteCategorySelect');
    
    if (!modal || !select || !deleteCategorySelect) return;

    document.getElementById('secondaryTagEditorPaneView').classList.add('modal-active');

    modalTagState = {
        characterTags: [...STEState.characterTags],
        tagCategories: JSON.parse(JSON.stringify(STEState.tagCategories))
    };

    ['steModalNewTagInput', 'steModalNewCategoryInput', 'steModalFirstTagInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    displayModalMessage("", "info");

    select.innerHTML = '';
    deleteCategorySelect.innerHTML = '';
    const allCategories = ["🧜‍♂ 人物类型", ...Object.keys(modalTagState.tagCategories)];
    allCategories.forEach(category => {
        select.add(new Option(category, category));
        deleteCategorySelect.add(new Option(category, category));
    });
    
    populateTagsForDeletion();
    modal.classList.remove('hidden');
}

/**
 * 关闭标签管理模态框，并销毁临时状态
 */
function closeTagManagementModal() {
    const modal = document.getElementById('steTagManagementModal');
    if (modal) modal.classList.add('hidden');
    
    document.getElementById('secondaryTagEditorPaneView').classList.remove('modal-active');
    
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    modalTagState = null;
}

/**
 * 在删除区选择分类时，动态填充标签并启用拖拽排序
 */
function populateTagsForDeletion() {
    const select = document.getElementById('steModalDeleteCategorySelect');
    const container = document.getElementById('tagsToDeleteContainer');
    const category = select.value;

    if (sortableInstance) sortableInstance.destroy();
    
    container.innerHTML = '';
    const tags = category === "🧜‍♂ 人物类型" ? modalTagState.characterTags : (modalTagState.tagCategories[category] || []);

    if (!tags || tags.length === 0) {
        container.innerHTML = '<p>该分类下没有标签可供删除。</p>';
        return;
    }

    tags.forEach(tag => {
        const tagPill = document.createElement('div');
        tagPill.className = 'ste-deletable-tag-item';
        tagPill.innerHTML = `<span>${tag}</span><span class="ste-tag-remove" data-tag="${tag}" data-category="${category}">×</span>`;
        container.appendChild(tagPill);
    });

    container.onclick = (event) => {
        if (event.target.classList.contains('ste-tag-remove')) {
            handleDeleteTag(event.target.dataset.tag, event.target.dataset.category);
        }
    };

    sortableInstance = new Sortable(container, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: (evt) => {
            const updatedTags = Array.from(container.children).map(item => 
                item.querySelector('.ste-tag-remove').dataset.tag
            );
            if (category === "🧜‍♂ 人物类型") {
                modalTagState.characterTags = updatedTags;
            } else {
                modalTagState.tagCategories[category] = updatedTags;
            }
            displayModalMessage("排序已在本地更新，点击“保存更改”生效。", "info");
        }
    });
}

/**
 * 处理删除单个标签的逻辑,仅在临时状态中
 */
function handleDeleteTag(tagToDelete, categoryFrom) {
    if (categoryFrom === "🧜‍♂ 人物类型") {
        modalTagState.characterTags = modalTagState.characterTags.filter(t => t !== tagToDelete);
    } else {
        modalTagState.tagCategories[categoryFrom] = modalTagState.tagCategories[categoryFrom].filter(t => t !== tagToDelete);
        if (modalTagState.tagCategories[categoryFrom].length === 0) {
            delete modalTagState.tagCategories[categoryFrom];
            // 如果分类被删除，需要更新下拉框并重新填充
            const select = document.getElementById('steModalDeleteCategorySelect');
            for(let i = 0; i < select.options.length; i++) {
                if (select.options[i].value === categoryFrom) {
                    select.remove(i);
                    break;
                }
            }
        }
    }
    displayModalMessage(`标签 [${tagToDelete}] 已在本地移除，点击“保存更改”生效。`, "info");
    populateTagsForDeletion(); // 重新渲染删除列表
}

/**
 * 处理添加标签按钮点击,仅在临时状态中
 */
function handleAddNewTag() {
    const category = document.getElementById('steModalCategorySelect').value;
    const newTags = document.getElementById('steModalNewTagInput').value.trim().split(/[,，\s]+/).filter(Boolean);

    if (!category || newTags.length === 0) {
        displayModalMessage("请选择分类并输入至少一个新标签！", "warning");
        return;
    }
    
    let targetArray;
    if (category === "🧜‍♂ 人物类型") {
        targetArray = modalTagState.characterTags;
    } else {
        modalTagState.tagCategories[category] = modalTagState.tagCategories[category] || [];
        targetArray = modalTagState.tagCategories[category];
    }

    let addedCount = 0;
    newTags.forEach(tag => {
        if (!targetArray.includes(tag)) {
            targetArray.push(tag);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        displayModalMessage(`已在本地添加 ${addedCount} 个新标签，点击“保存更改”生效。`, "info");
        document.getElementById('steModalNewTagInput').value = '';
    } else {
        displayModalMessage("输入的标签都已存在于该分类中。", "info");
    }
}

/**
 * 处理新增分类按钮点击,仅在临时状态中
 */
function handleAddNewCategory() {
    const newCategory = document.getElementById('steModalNewCategoryInput').value.trim();
    const firstTag = document.getElementById('steModalFirstTagInput').value.trim();

    if (!newCategory || !firstTag) {
        displayModalMessage("新分类名和第一个标签都不能为空！", "warning");
        return;
    }

    if (modalTagState.tagCategories[newCategory] || newCategory === "🧜‍♂ 人物类型") {
        displayModalMessage("这个分类名称已经存在了！", "warning");
        return;
    }

    modalTagState.tagCategories[newCategory] = [firstTag];
    displayModalMessage(`已在本地新增分类 [${newCategory}]，点击“保存更改”生效。`, "info");
    
    // 更新下拉框
    const select = document.getElementById('steModalCategorySelect');
    const deleteSelect = document.getElementById('steModalDeleteCategorySelect');
    select.add(new Option(newCategory, newCategory));
    deleteSelect.add(new Option(newCategory, newCategory));

    document.getElementById('steModalNewCategoryInput').value = '';
    document.getElementById('steModalFirstTagInput').value = '';
}

/**
 * 统一的保存入口，将模态框中的临时状态提交到服务器
 */
async function handleSaveChanges() {
    if (!modalTagState) return;
    const fullData = {
        "🧜‍♂ 人物类型": modalTagState.characterTags,
        ...modalTagState.tagCategories
    };
    await saveTagsToServer(fullData);
}

/**
 * 向服务器发送更新后的标签数据
 */
async function saveTagsToServer(fullData) {
    if (STEState.isSavingTags) return;
    STEState.isSavingTags = true;
    displayModalMessage("正在保存...", "info");

    try {
        const response = await fetch('/api/update-secondary-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullData)
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || "保存失败");

        displayModalMessage("保存成功！界面将刷新...", "success");
        setTimeout(() => {
            closeTagManagementModal();
            initializeSecondaryTagEditorView(); // 重新初始化以加载新标签
        }, 1500);

    } catch (error) {
        console.error("保存标签失败:", error);
        displayModalMessage(`保存失败: ${error.message}`, "error");
    } finally {
        STEState.isSavingTags = false;
    }
}

function displayModalMessage(text, type) {
    const area = document.getElementById('steModalMessageArea');
    if (area) {
        area.textContent = text;
        area.className = `modal-message ${type} visible`;
    }
}