
try {
    self.importScripts('https://cdn.jsdelivr.net/npm/pinyin-pro@3.27.0/dist/index.min.js');
} catch (e) {
    console.error('拼音库在 Worker 中加载失败:', e);
    self.postMessage({ type: 'error', payload: { message: 'Worker 内部的拼音库加载失败。' } });
}

let _indexedEntries = [];
let _physicalImages = [];
let _aliasData = { mainToAliases: {}, aliasToMain: {} };
const _searchIndexMap = new Map();
let _existingImagePaths = new Set();

function buildWorkerSearchIndex() {
    if (typeof pinyinPro === 'undefined') return;

    _searchIndexMap.clear();
    const { pinyin } = pinyinPro;

    for (const entry of _indexedEntries) {
        if (!entry || !entry.attributes) continue;
        const textsToProcess = new Set();
        
        if (entry.characterName) textsToProcess.add(entry.characterName);
        if (entry.attributes.filename) textsToProcess.add(entry.attributes.filename.replace(/\.[^/.]+$/, ""));
        if (entry.attributes.parentFolder) textsToProcess.add(entry.attributes.parentFolder);
        if (Array.isArray(entry.attributes.secondaryTags)) {
            entry.attributes.secondaryTags.forEach(tag => textsToProcess.add(tag));
        }

        const mainName = _aliasData.aliasToMain[String(entry.characterName).toLowerCase()] || entry.characterName;
        if (mainName && _aliasData.mainToAliases[mainName]) {
            _aliasData.mainToAliases[mainName].forEach(alias => textsToProcess.add(alias));
        }

        const combinedText = Array.from(textsToProcess).join(' ');
        if (!combinedText) continue;
        
        const lowerCaseText = combinedText.toLowerCase();
        const fullPinyin = pinyin(combinedText, { toneType: 'none', type: 'array' }).join('').toLowerCase();
        const initials = pinyin(combinedText, { pattern: 'first' }).replace(/\s/g, '').toLowerCase();
        const gid = entry.gid || '';
        
        const searchIndexString = `${gid} ${lowerCaseText} ${fullPinyin} ${initials}`;
        
        if (entry.path) {
             _searchIndexMap.set(entry.path, searchIndexString);
        }
    }

    for (const img of _physicalImages) {
        if (!img || !img.urlPath) continue;
        if (_searchIndexMap.has(img.urlPath)) continue;

        const textsToProcess = new Set();
        
        if (img.name) textsToProcess.add(img.name);
        if (img.fileName) textsToProcess.add(img.fileName.replace(/\.[^/.]+$/, ""));
        if (img.folderName) textsToProcess.add(img.folderName);
        
        const mainName = _aliasData.aliasToMain[String(img.name).toLowerCase()] || img.name;
        if (mainName && _aliasData.mainToAliases[mainName]) {
            _aliasData.mainToAliases[mainName].forEach(alias => textsToProcess.add(alias));
        }

        const combinedText = Array.from(textsToProcess).join(' ');
        if (!combinedText) continue;

        const lowerCaseText = combinedText.toLowerCase();
        const fullPinyin = pinyin(combinedText, { toneType: 'none', type: 'array' }).join('').toLowerCase();
        const initials = pinyin(combinedText, { pattern: 'first' }).replace(/\s/g, '').toLowerCase();
        
        const searchIndexString = `${lowerCaseText} ${fullPinyin} ${initials}`;
        
        _searchIndexMap.set(img.urlPath, searchIndexString);
    }
}


function filterImages(query, dataSource = 'indexed') {
    const lowerQuery = query.trim().toLowerCase();

    let sourceArray;
    if (dataSource === 'physical') {
        sourceArray = _physicalImages;
    } else if (dataSource === 'unsaved_physical') {
        sourceArray = _physicalImages.filter(img => {
            if (!img || !img.urlPath || !img.storageBox) return false;
            const fullWebPath = `/${img.storageBox}/${img.urlPath}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
            return !_existingImagePaths.has(fullWebPath);
        });
    } else {
        sourceArray = _indexedEntries;
    }

    if (!lowerQuery) {
        return sourceArray;
    }

    return sourceArray.filter(item => {
        const key = item.path || item.urlPath;
        if (!key) return false;

        const searchIndexString = _searchIndexMap.get(key);
        return searchIndexString && searchIndexString.includes(lowerQuery);
    });
}

self.onmessage = function (event) {
    const { type, payload } = event.data;
    try {
        switch (type) {
            case 'loadData':
                _indexedEntries = payload.indexedData || [];
                _physicalImages = payload.physicalData || [];

                _existingImagePaths.clear();
                _indexedEntries.forEach(entry => {
                    if (entry && entry.path && entry.storagebox) {
                         const fullWebPath = `/${entry.storagebox}/${entry.path}`.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
                        _existingImagePaths.add(fullWebPath);
                    }
                });

                buildWorkerSearchIndex();
                self.postMessage({ type: 'dataLoaded' });
                break;

            case 'loadAliasData':
                _aliasData = payload.aliasData || { mainToAliases: {}, aliasToMain: {} };
                buildWorkerSearchIndex();
                break;

            case 'updateExistingPaths':
                break;

            case 'search': {
                const results = filterImages(payload.query, payload.dataSource);
                self.postMessage({ type: 'searchResults', payload: { results, query: payload.query, dataSource: payload.dataSource } });
                break;
            }
        }
    } catch (error) {
        self.postMessage({ type: 'error', payload: { message: `Worker在处理 ${type} 时失败`, error: error.message } });
    }
};
