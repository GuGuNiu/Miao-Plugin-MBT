// ==========================================================================
// 社区图库: 负责社区图库页面的数据加载、渲染与交互逻辑
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const DOM_CGP = {
        pane: document.getElementById('communityGalleryPane'),
        repoUrlInput: document.getElementById('cgp-repo-url-input'),
        repoAliasInput: document.getElementById('cgp-repo-alias-input'),
        addButton: document.getElementById('cgp-add-button'),
        statusText: document.getElementById('cgp-status-text'),
        progressBar: document.getElementById('cgp-progress-bar'),
        logOutput: document.getElementById('cgp-log-output'),
        galleryGrid: document.querySelector('.cgp-gallery-grid'),
        emptyPlaceholder: document.getElementById('cgp-empty-placeholder'),
        customConfirmModal: document.getElementById('cgpCustomConfirmModal'),
        modalTitle: document.getElementById('cgpModalTitle'),
        modalMessage: document.getElementById('cgpModalMessage'),
        modalConfirmBtn: document.getElementById('cgpModalConfirmBtn'),
        modalCancelBtn: document.getElementById('cgpModalCancelBtn'),
        speedTestFloater: document.getElementById('cgpSpeedTestFloater'),
        speedTestResults: document.getElementById('cgpSpeedTestResults'),
        floaterCloseBtn: document.getElementById('cgpFloaterCloseBtn'),
    };

    const state = {
        isLoading: false,
        ws: null,
        floaterTimeout: null,
    };

    function connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        state.ws = new WebSocket(wsUrl);
        state.ws.onopen = () => console.log('[CGP] WebSocket 连接成功');
        state.ws.onclose = () => setTimeout(connectWebSocket, 3000);
        state.ws.onerror = (err) => console.error('[CGP] WebSocket 错误:', err);
        state.ws.onmessage = handleWebSocketMessage;
    }

    function handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'progress':
                    updateStatus(data.payload.status, data.payload.progress);
                    if (data.payload.progress === 100) { // 下载完成时
                        hideSpeedTestFloater();
                    }
                    break;
                case 'log':
                    if (data.message.includes('开始并行测试所有网络节点')) {
                        showSpeedTestFloater();
                    }
                    appendLog(data.message);
                    break;
                case 'speedtest_result':
                    showSpeedTestFloater(); 
                    updateSpeedTestResult(data.payload);
                    break;
                case 'complete':
                    updateStatus(data.payload.message, 100);
                    hideSpeedTestFloater(); // 任务完成时关闭
                    setTimeout(() => {
                        resetStatus();
                        loadGalleries();
                    }, 2000);
                    break;
                case 'error':
                    updateStatus(`错误: ${data.payload.message}`, 100);
                    DOM_CGP.progressBar.style.backgroundColor = '#e74c3c';
                    state.isLoading = false;
                    DOM_CGP.addButton.disabled = false;
                    hideSpeedTestFloater(); // 出错时也关闭
                    break;
            }
        } catch (e) {
            console.error('[CGP] 解析 WebSocket 消息失败:', e);
        }
    }

    function updateStatus(text, progress = -1) {
        DOM_CGP.statusText.textContent = text;
        if (progress >= 0) {
            DOM_CGP.progressBar.style.width = `${progress}%`;
            DOM_CGP.progressBar.style.backgroundColor = '';
        }
    }

    function appendLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        DOM_CGP.logOutput.value += `[${timestamp}] ${message}\n`;
        DOM_CGP.logOutput.scrollTop = DOM_CGP.logOutput.scrollHeight;
    }

    function resetStatus() {
        state.isLoading = false;
        DOM_CGP.addButton.disabled = false;
        DOM_CGP.statusText.textContent = '等待操作...';
        DOM_CGP.progressBar.style.width = '0%';
        DOM_CGP.logOutput.value = '';
    }

    async function loadGalleries() {
        try {
            const response = await fetch('/api/community-galleries');
            const galleries = await response.json();
            renderGalleryGrid(galleries);
        } catch (error) {
            console.error('[CGP] 加载图库列表失败:', error);
            DOM_CGP.galleryGrid.innerHTML = '<p>加载列表失败，请检查后端服务。</p>';
        }
    }

    function renderGalleryGrid(galleries) {
        DOM_CGP.galleryGrid.innerHTML = '';
        if (galleries.length === 0) {
            DOM_CGP.emptyPlaceholder.style.display = 'block';
            return;
        }
        DOM_CGP.emptyPlaceholder.style.display = 'none';

        galleries.forEach(repo => {
            const card = document.createElement('div');
            card.className = 'cgp-gallery-card';
            card.dataset.status = 'installed';
            const totalFolders = Object.values(repo.contentMap || {}).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
            card.innerHTML = `
            <div class="card-header">
                <span class="card-title">${repo.alias}</span>
            </div>
            <div class="card-content">
                <p class="card-description">由 <strong>${repo.ownerName || '未知作者'}</strong> 提供。${repo.url}</p>
                <div class="card-stats">
                    <span>👤 ${totalFolders} 角色</span>
                </div>
            </div>
                <div class="card-actions">
                    <button class="card-action-btn primary update-btn" data-alias="${repo.alias}">检查更新</button>
                    <button class="card-action-btn danger remove-btn" data-alias="${repo.alias}">移除</button>
                </div>
            `;
            DOM_CGP.galleryGrid.appendChild(card);
        });
    }

    async function handleAddClick() {
        const url = DOM_CGP.repoUrlInput.value.trim();
        const alias = DOM_CGP.repoAliasInput.value.trim();

        if (!url || !alias) {
            displayToast('仓库地址和别名都不能为空', 'warning');
            return;
        }

        if (!url.startsWith('http')) {
            displayToast('请输入一个有效的 URL 地址', 'error');
            return;
        }

        if (state.isLoading) return;
        state.isLoading = true;
        DOM_CGP.addButton.disabled = true;
        resetStatus();
        updateStatus('正在准备任务...', 0);
        appendLog(`收到安装请求: ${alias} (${url})`);

        try {
            await fetch('/api/community-galleries/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, alias }),
            });
            DOM_CGP.repoUrlInput.value = '';
            DOM_CGP.repoAliasInput.value = '';
        } catch (error) {
            updateStatus(`错误: ${error.message}`, 100);
            state.isLoading = false;
            DOM_CGP.addButton.disabled = false;
        }
    }

    function handleGridClick(e) {
        const target = e.target;
        const alias = target.dataset.alias;
        if (!alias) return;

        if (target.classList.contains('remove-btn')) {
            showCustomConfirm(
                `移除图库: ${alias}`,
                `确定要移除这个图库吗？所有本地文件和配置都将被删除，此操作不可恢复。`,
                () => removeGallery(alias)
            );
        } else if (target.classList.contains('update-btn')) {
            updateGallery(alias);
        }
    }

    async function removeGallery(alias) {
        try {
            const response = await fetch(`/api/community-galleries/remove/${alias}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                displayToast(`图库 "${alias}" 已移除`, 'success');
                loadGalleries();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            displayToast(`移除失败: ${error.message}`, 'error');
        }
    }

    async function updateGallery(alias) {
        if (state.isLoading) return;
        state.isLoading = true;
        resetStatus();
        updateStatus(`正在更新 ${alias}...`, 0);
        try {
            await fetch('/api/community-galleries/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alias }),
            });
        } catch (error) {
            updateStatus(`错误: ${error.message}`, 100);
            state.isLoading = false;
        }
    }

    function showCustomConfirm(title, message, onConfirm) {
        DOM_CGP.modalTitle.textContent = title;
        DOM_CGP.modalMessage.textContent = message;
        DOM_CGP.customConfirmModal.classList.remove('hidden');

        const confirmHandler = () => {
            onConfirm();
            hideCustomConfirm();
        };

        const cancelHandler = () => {
            hideCustomConfirm();
        };

        const hideCustomConfirm = () => {
            DOM_CGP.customConfirmModal.classList.add('hidden');
            DOM_CGP.modalConfirmBtn.removeEventListener('click', confirmHandler);
            DOM_CGP.modalCancelBtn.removeEventListener('click', cancelHandler);
            DOM_CGP.customConfirmModal.removeEventListener('click', overlayClickHandler);
        };

        const overlayClickHandler = (e) => {
            if (e.target === DOM_CGP.customConfirmModal) {
                hideCustomConfirm();
            }
        };

        DOM_CGP.modalConfirmBtn.addEventListener('click', confirmHandler);
        DOM_CGP.modalCancelBtn.addEventListener('click', cancelHandler);
        DOM_CGP.customConfirmModal.addEventListener('click', overlayClickHandler);
    }

    function showSpeedTestFloater() {
        if (!DOM_CGP.speedTestFloater.classList.contains('hidden')) {
            // 如果窗口已显示，重置计时器
            if (state.floaterTimeout) clearTimeout(state.floaterTimeout);
            state.floaterTimeout = setTimeout(hideSpeedTestFloater, 15000);
            return;
        }

        DOM_CGP.speedTestResults.innerHTML = '';
        DOM_CGP.speedTestFloater.classList.remove('hidden');
        
        if (state.floaterTimeout) clearTimeout(state.floaterTimeout);
        state.floaterTimeout = setTimeout(hideSpeedTestFloater, 15000); 
    }

    function updateSpeedTestResult({ name, speed }) {
        let resultDiv = DOM_CGP.speedTestResults.querySelector(`[data-name="${name}"]`);
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.className = 'cgp-speed-item';
            resultDiv.dataset.name = name;
            resultDiv.innerHTML = `<span class="name">${name}</span><span class="speed">测试中...</span>`;
            DOM_CGP.speedTestResults.appendChild(resultDiv);
        }
        
        const speedSpan = resultDiv.querySelector('.speed');
        if (speed === Infinity || speed === null) {
            speedSpan.textContent = '超时';
            speedSpan.className = 'speed timeout';
        } else {
            speedSpan.textContent = `${speed}ms`;
            speedSpan.className = speed < 2000 ? 'speed ok' : 'speed slow';
        }
    }

    function hideSpeedTestFloater() {
        DOM_CGP.speedTestFloater.classList.add('hidden');
        if (state.floaterTimeout) {
            clearTimeout(state.floaterTimeout);
            state.floaterTimeout = null;
        }
    }

    function updateSpeedTestResult({ name, speed }) {
        let resultDiv = DOM_CGP.speedTestResults.querySelector(`[data-name="${name}"]`);
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.className = 'cgp-speed-item';
            resultDiv.dataset.name = name;
            resultDiv.innerHTML = `<span class="name">${name}</span><span class="speed">测试中...</span>`;
            DOM_CGP.speedTestResults.appendChild(resultDiv);
        }

        const speedSpan = resultDiv.querySelector('.speed');
        if (speed === Infinity) {
            speedSpan.textContent = '超时';
            speedSpan.className = 'speed timeout';
        } else {
            speedSpan.textContent = `${speed}ms`;
            speedSpan.className = speed < 2000 ? 'speed ok' : 'speed slow';
        }
    }

    function init() {
        if (!DOM_CGP.pane) return;
        connectWebSocket();
        loadGalleries();
        DOM_CGP.addButton.addEventListener('click', handleAddClick);
        DOM_CGP.galleryGrid.addEventListener('click', handleGridClick);
        DOM_CGP.floaterCloseBtn.addEventListener('click', hideSpeedTestFloater);
    }
    init();
});