let _availableImages = [];
let _existingImagePaths = new Set(); 

function filterImages(query) {
    const lowerQuery = query.trim().toLowerCase();
    if (!lowerQuery || _availableImages.length === 0) return [];
    console.log('[Worker] 正在过滤:', lowerQuery, '于', _availableImages.length, '个项目中');

    const filtered = _availableImages.filter(img => {
        if (!img) return false;
        const nameMatch = img.name && img.name.toLowerCase().includes(lowerQuery);
        const fileNameMatch = img.fileName && img.fileName.toLowerCase().includes(lowerQuery);
        const folderNameMatch = img.folderName && img.folderName.toLowerCase().includes(lowerQuery);
        return nameMatch || fileNameMatch || folderNameMatch;
    });
    console.log('[Worker] 过滤数量 (检查存在前):', filtered.length);
    const finalFiltered = filtered.filter(img => {
        if (!img.urlPath) { 
             console.warn('[Worker] 过滤时发现图片缺少 urlPath:', img);
             return false;
        }
        const exists = _existingImagePaths.has(img.urlPath); 
        if (exists) {
             console.log(`[Worker] filterImages: Path found in existingPaths, filtering out: ${img.urlPath}`);
        } else {
             console.log(`[Worker] filterImages: Path NOT found in existingPaths, keeping: ${img.urlPath}`);
        }
        return !exists;
    });

    console.log('[Worker] 最终过滤数量:', finalFiltered.length);
    return finalFiltered;
}

function findSiblings(currentImageInfo) {
    if (!currentImageInfo || !currentImageInfo.gallery || !currentImageInfo.folderName || !_availableImages || _availableImages.length === 0) {
         console.warn('[Worker] findSiblings 参数不足:', currentImageInfo);
        return [];
    }
    console.log('[Worker] 正在查找同级图片:', currentImageInfo.folderName, '在图库:', currentImageInfo.gallery);

    const siblings = _availableImages.filter(img =>
        img &&
        img.gallery === currentImageInfo.gallery &&
        img.folderName === currentImageInfo.folderName &&
        img.fileName !== currentImageInfo.fileName
    );
    console.log('[Worker] 找到同级图片数量 (检查存在前):', siblings.length);
    const finalSiblings = siblings.filter(img => {
        if (!img.urlPath) return false;
        const exists = _existingImagePaths.has(img.urlPath);
        return !exists;
    });
    console.log('[Worker] 最终可显示同级图片数量:', finalSiblings.length);
    return finalSiblings;
}

self.onmessage = function(event) {
    const { type, payload } = event.data;
    console.log('[Worker] 收到消息:', type);

    try {
        if (type === 'loadData') {
            _availableImages = payload.availableImages || [];
            _existingImagePaths = new Set(payload.existingPaths || []); // 直接使用
            console.log(`[Worker] 已加载 ${_availableImages.length} 张图片和 ${_existingImagePaths.size} 个已存在路径 (相对路径)`);
            self.postMessage({ type: 'dataLoaded' });
        } else if (type === 'updateExistingPaths') {
            _existingImagePaths = new Set(payload.existingPaths || []); // 更新相对路径 Set
            console.log(`[Worker] 已存在路径已更新为 ${_existingImagePaths.size} 项 (相对路径)`);
        } else if (type === 'search') {
            const query = payload.query;
            const results = filterImages(query);
            self.postMessage({ type: 'searchResults', payload: { results: results, query: query } });
            console.log('[Worker] 已发送', results.length, '个结果 查询:', query);
        } else if (type === 'findSiblings') {
            const currentImageInfo = payload.currentImageInfo; // 包含相对 urlPath
            const results = findSiblings(currentImageInfo);
            self.postMessage({ type: 'siblingResults', payload: { results: results } });
            console.log('[Worker] 已发送', results.length, '个同级结果');
        }
    } catch (error) {
        console.error('[Worker] 处理消息时出错:', type, error);
        self.postMessage({ type: 'error', payload: { message: `Worker 处理 ${type} 时出错`, error: error.message } });
    }
};

console.log('[Worker] Worker 脚本已加载并准备就绪 (旧版逻辑)');