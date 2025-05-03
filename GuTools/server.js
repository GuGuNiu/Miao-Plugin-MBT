const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');

const app = express();
const port = 3000;

// --- 路径常量定义 ---
// 使用 path.resolve 确保路径的绝对性和跨平台兼容性
const GU_TOOLS_DIR = __dirname; // 当前文件所在目录 (.../resources/Miao-Plugin-MBT/GuTools)
const PROJECT_ROOT = path.resolve(GU_TOOLS_DIR, '..'); // 项目根目录 (.../resources/Miao-Plugin-MBT)
const RESOURCES_DIR = path.resolve(PROJECT_ROOT, '..'); // resources 目录
const YUNZAI_ROOT = path.resolve(RESOURCES_DIR, '..'); // 云崽根目录
const USER_DATA_DIRECTORY = path.join(RESOURCES_DIR, "GuGuNiu-Gallery"); // 用户数据存储目录
const IMG_DIRECTORY = path.join(GU_TOOLS_DIR, 'img'); // 背景图片目录
const IMGTEMP_DIRECTORY_NAME = 'imgtemp'; // 临时图片文件夹名
const IMGTEMP_DIRECTORY = path.join(GU_TOOLS_DIR, IMGTEMP_DIRECTORY_NAME); // 临时图片物理路径

// 数据文件路径
const INTERNAL_USER_DATA_FILE = path.join(USER_DATA_DIRECTORY, "ImageData.json"); // 内部用户数据
const EXTERNAL_USER_DATA_FILE = path.join(USER_DATA_DIRECTORY, "ExternalImageData.json"); // 外部用户数据
const GALLERY_CONFIG_FILE = path.join(USER_DATA_DIRECTORY, "GalleryConfig.yaml"); // 图库配置

// 允许的图片后缀 (小写)
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif']); // 使用 Set 提高查找效率

// 主图库文件夹名称列表
const MAIN_GALLERY_FOLDERS = ["gs-character", "sr-character", "zzz-character", "waves-character"];

// 外部插件图片资源路径
const PLUGIN_IMAGE_PATHS = {
    miao: path.join('plugins', 'miao-plugin', 'resources', 'profile', 'normal-character'),
    zzz: path.join('plugins', 'ZZZ-Plugin', 'resources', 'images', 'panel'),
    waves: path.join('plugins', 'waves-plugin', 'resources', 'rolePic')
};
// 将相对路径解析为绝对路径
const ABSOLUTE_PLUGIN_IMAGE_PATHS = Object.fromEntries(
    Object.entries(PLUGIN_IMAGE_PATHS).map(([key, relativePath]) => [key, path.resolve(YUNZAI_ROOT, relativePath)])
);

// --- 启动时路径确认 ---
console.log("--- 服务器路径配置 ---");
console.log(`工具目录: ${GU_TOOLS_DIR}`);
console.log(`项目根目录: ${PROJECT_ROOT}`);
console.log(`云崽根目录: ${YUNZAI_ROOT}`);
console.log(`用户数据目录: ${USER_DATA_DIRECTORY}`);
console.log(`主数据文件: ${INTERNAL_USER_DATA_FILE}`);
console.log(`外数据文件: ${EXTERNAL_USER_DATA_FILE}`);
console.log(`配置文件: ${GALLERY_CONFIG_FILE}`);
console.log(`临时图片目录: ${IMGTEMP_DIRECTORY}`);
console.log("外部插件扫描路径:");
Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS).forEach(([key, absPath]) => console.log(`  - ${key}: ${absPath}`));
console.log("----------------------");

// --- 中间件设置 ---
app.use(express.json({ limit: '10mb' })); // 解析 JSON 请求体，限制大小

// --- 核心工具函数 ---

/**
 * 检查文件或目录是否存在。
 * @param {string} p - 文件或目录路径。
 * @returns {Promise<boolean>} 如果存在返回 true，否则返回 false。
 */
const pathExists = async (p) => {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
};

/**
 * 检查路径是否是一个目录。
 * @param {string} p - 路径。
 * @returns {Promise<boolean>} 如果是目录返回 true，否则返回 false。
 */
const isDirectory = async (p) => {
    try {
        const stats = await fs.stat(p);
        return stats.isDirectory();
    } catch {
        return false;
    }
};

/**
 * 检查路径是否是一个文件。
 * @param {string} p - 路径。
 * @returns {Promise<boolean>} 如果是文件返回 true，否则返回 false。
 */
const isFile = async (p) => {
    try {
        const stats = await fs.stat(p);
        return stats.isFile();
    } catch {
        return false;
    }
};

/**
 * 递归扫描主图库文件夹，收集图片信息。
 * @param {string} galleryName - 图库名称 (如 'gs-character')。
 * @param {string} baseDir - 图库的物理基础目录。
 * @param {string} [currentRelativePath=''] - 当前相对于 baseDir 的路径 (内部递归用)。
 * @returns {Promise<Array<object>>} 图片信息对象数组。
 */
const findGalleryImagesRecursively = async (galleryName, baseDir, currentRelativePath = '') => {
    const images = [];
    const currentFullPath = path.join(baseDir, currentRelativePath);

    if (!(await pathExists(currentFullPath)) || !(await isDirectory(currentFullPath))) {
        return images; // 目录不存在或不是目录，直接返回
    }

    try {
        const entries = await fs.readdir(currentFullPath, { withFileTypes: true });
        for (const entry of entries) {
            const entryRelativePath = path.join(currentRelativePath, entry.name);
            const entryFullPath = path.join(currentFullPath, entry.name);

            if (entry.isDirectory()) {
                // 递归扫描子目录
                images.push(...await findGalleryImagesRecursively(galleryName, baseDir, entryRelativePath));
            } else if (entry.isFile()) {
                const fileExt = path.extname(entry.name).toLowerCase();
                if (ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
                    // 符合条件的图片文件
                    const pathSegments = entryRelativePath.split(path.sep);
                    if (pathSegments.length >= 2) {
                        const fileName = pathSegments.pop();
                        const folderName = pathSegments.pop(); // 使用倒数第二个作为文件夹名
                        const webPath = `${galleryName}/${entryRelativePath.replace(/\\/g, "/")}`; // 构建 Web 路径

                        images.push({
                            name: folderName, // 角色名/文件夹名
                            folderName: folderName,
                            fileName: fileName,
                            gallery: galleryName, // 记录来源图库
                            urlPath: webPath // Web 访问路径
                        });
                    } else {
                        console.warn(`[主图库扫描] 忽略结构不符的文件: ${entryRelativePath}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`[主图库扫描] 扫描目录 "${currentFullPath}" 出错:`, error);
    }
    return images;
};

/**
 * 扫描指定的外部插件图片目录。
 * @param {string} sourceKey - 来源标识 (如 'miao')。
 * @param {string} basePath - 要扫描的插件图片目录的物理路径。
 * @returns {Promise<Array<object>>} 外部图片信息对象数组。
 */
const findPluginImages = async (sourceKey, basePath) => {
    const images = [];
    console.log(`[插件扫描] 开始扫描 ${sourceKey}: ${basePath}`);

    if (!(await pathExists(basePath)) || !(await isDirectory(basePath))) {
        console.warn(`[插件扫描] 目录不存在或不是目录，跳过 ${sourceKey}: ${basePath}`);
        return images;
    }

    let fileFoundCount = 0;
    let imageRecordedCount = 0;

    const findImagesRecursive = async (currentPath, relativeToBasePath) => {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(currentPath, entry.name);
                const entryRelativePath = relativeToBasePath
                    ? path.join(relativeToBasePath, entry.name).replace(/\\/g, '/')
                    : entry.name.replace(/\\/g, '/');

                if (entry.isDirectory()) {
                    await findImagesRecursive(entryPath, entryRelativePath);
                } else if (entry.isFile()) {
                    fileFoundCount++;
                    const fileName = entry.name;
                    const fileExt = path.extname(fileName).toLowerCase();

                    if (ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
                        const pathSegments = entryRelativePath.split('/');
                        const folderName = pathSegments.length > 1 ? pathSegments[pathSegments.length - 2] : sourceKey;
                        const webPath = `/external/${sourceKey}/${entryRelativePath}`; // 注意 webPath 结构

                        images.push({
                            folderName: folderName,
                            fileName: fileName,
                            source: sourceKey, // 记录来源
                            relativePath: entryRelativePath,
                            webPath: webPath
                        });
                        imageRecordedCount++;
                    }
                }
            }
        } catch (readError) {
            console.error(`[插件递归扫描] 读取目录 ${currentPath} 失败: ${readError.message}`);
        }
    };

    await findImagesRecursive(basePath, '');
    console.log(`[插件扫描] ${sourceKey} 扫描完成。找到 ${fileFoundCount} 文件，记录 ${imageRecordedCount} 图片。`);
    return images;
};

/**
 * 安全地读取 JSON 文件。
 * @param {string} filePath - JSON 文件路径。
 * @param {string} fileDesc - 文件描述 (用于日志)。
 * @returns {Promise<Array<object>>} 解析后的数组，失败则返回空数组。
 */
const safelyReadJsonFile = async (filePath, fileDesc) => {
    try {
        if (!(await pathExists(filePath))) {
            console.log(`[读取JSON] ${fileDesc} 文件不存在 (${filePath})，返回空数组。`);
            return [];
        }
        const rawData = await fs.readFile(filePath, 'utf-8');
        const trimmedData = rawData.trim();
        if (trimmedData === '') {
            console.log(`[读取JSON] ${fileDesc} 文件为空 (${filePath})，返回空数组。`);
            return [];
        }
        const data = JSON.parse(trimmedData);
        if (Array.isArray(data)) {
            console.log(`[读取JSON] 成功读取 ${data.length} 条记录从 ${fileDesc} (${filePath})。`);
            return data;
        } else {
            console.warn(`[读取JSON] ${fileDesc} 文件内容不是数组 (${filePath})，返回空数组。`);
            return [];
        }
    } catch (error) {
        console.error(`[读取JSON] 读取或解析 ${fileDesc} 文件 (${filePath}) 出错:`, error);
        // 这里可以选择返回空数组或抛出错误
        // throw new Error(`读取或解析 ${fileDesc} 文件失败: ${error.message}`);
        return []; // 倾向于返回空数组，让服务能继续运行
    }
};

/**
 * 安全地写入 JSON 文件。
 * @param {string} filePath - 要写入的文件路径。
 * @param {any} data - 要写入的数据 (通常是数组或对象)。
 * @param {string} fileDesc - 文件描述 (用于日志)。
 * @returns {Promise<void>}
 * @throws {Error} 如果写入失败。
 */
const safelyWriteJsonFile = async (filePath, data, fileDesc) => {
    try {
        const jsonString = JSON.stringify(data, null, 4); // 格式化输出
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true }); // 确保目录存在
        await fs.writeFile(filePath, jsonString, 'utf-8');
        console.log(`[写入JSON] 成功将数据写入 ${fileDesc} (${filePath})。`);
    } catch (error) {
        console.error(`[写入JSON] 写入 ${fileDesc} 文件 (${filePath}) 失败:`, error);
        throw new Error(`写入 ${fileDesc} 文件失败: ${error.message}`);
    }
};


/**
 * 生成 GELD-ID (保持同步，因为不需要 I/O)。
 */
const generateGeldId = (length = 20) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charsLength = chars.length;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charsLength));
    }
    return result;
};

/**
 * 转义正则表达式特殊字符 (保持同步)。
 */
const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};


// --- 设置静态文件服务 ---
console.log("--- 配置静态文件服务 ---");
// 1. 主图库
MAIN_GALLERY_FOLDERS.forEach(async (gallery) => {
    const galleryPath = path.join(PROJECT_ROOT, gallery);
    const routePath = `/${gallery}`;
    if (await pathExists(galleryPath) && await isDirectory(galleryPath)) {
        app.use(routePath, express.static(galleryPath));
        console.log(`[静态服务] OK: ${routePath} -> ${galleryPath}`);
    } else {
        console.warn(`[静态服务] 警告: 目录 ${galleryPath} 无效，无法提供 ${routePath} 服务。`);
    }
});
// 2. 临时图片
(async () => {
    const routePath = `/${IMGTEMP_DIRECTORY_NAME}`;
    if (await pathExists(IMGTEMP_DIRECTORY) && await isDirectory(IMGTEMP_DIRECTORY)) {
        app.use(routePath, express.static(IMGTEMP_DIRECTORY));
        console.log(`[静态服务] OK: ${routePath} -> ${IMGTEMP_DIRECTORY}`);
    } else {
        console.warn(`[静态服务] 警告: 临时目录 ${IMGTEMP_DIRECTORY} 无效，无法提供 ${routePath} 服务。`);
    }
})();
// 3. 外部插件图片
Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS).forEach(async ([key, physicalPath]) => {
    const routePath = `/external/${key}`;
    if (await pathExists(physicalPath) && await isDirectory(physicalPath)) {
        app.use(routePath, express.static(physicalPath));
        console.log(`[静态服务] OK: ${routePath} -> ${physicalPath}`);
    } else {
        console.warn(`[静态服务] 警告: 外部目录 ${physicalPath} (${key}) 无效，无法提供 ${routePath} 服务。`);
    }
});
console.log("--- 静态服务配置完毕 ---");


// --- API 端点 ---

// [GET] 获取主图库图片列表
app.get('/api/images', async (req, res) => {
    console.log("请求: [GET] /api/images");
    try {
        let allImageData = [];
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const galleryBasePath = path.join(PROJECT_ROOT, gallery);
            if (await pathExists(galleryBasePath) && await isDirectory(galleryBasePath)) {
                allImageData.push(...await findGalleryImagesRecursively(gallery, galleryBasePath));
            } else {
                 console.warn(`[API 主图] 图库目录 ${galleryBasePath} 无效，跳过。`);
            }
        }
        allImageData.sort((a, b) => a.urlPath.localeCompare(b.urlPath));
        console.log(`[API 主图] 返回 ${allImageData.length} 张图片。`);
        res.json(allImageData);
    } catch (error) {
        console.error("[API 主图] 处理请求出错:", error);
        res.status(500).json({ error: "服务器在扫描主图库时遇到问题。" });
    }
});

// [GET] 获取插件图片列表
app.get('/api/external-images', async (req, res) => {
    console.log("请求: [GET] /api/external-images");
    try {
        let allPluginImages = [];
        for (const [key, basePath] of Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS)) {
            allPluginImages.push(...await findPluginImages(key, basePath));
        }
        allPluginImages.sort((a, b) => (a.webPath || '').localeCompare(b.webPath || ''));
        console.log(`[API 插件图] 返回 ${allPluginImages.length} 张图片。`);
        res.json(allPluginImages);
    } catch (error) {
        console.error("[API 插件图] 处理请求出错:", error);
        res.status(500).json({ error: "服务器在扫描插件图片时遇到问题。" });
    }
});

// [GET] 获取图库配置
app.get('/api/gallery-config', async (req, res) => {
    console.log("请求: [GET] /api/gallery-config");
    try {
        if (!(await pathExists(GALLERY_CONFIG_FILE))) {
            console.warn(`配置文件不存在: ${GALLERY_CONFIG_FILE}`);
            return res.status(404).json({ success: false, error: "配置文件不存在！", config: null });
        }
        const fileContents = await fs.readFile(GALLERY_CONFIG_FILE, 'utf8');
        const configData = yaml.load(fileContents);
        if (typeof configData !== 'object' || configData === null) {
            throw new Error("配置文件格式无效。");
        }
        console.log("成功读取图库配置。");
        res.json({ success: true, config: configData });
    } catch (error) {
        console.error("[API 配置] 读取配置出错:", error);
        res.status(500).json({ success: false, error: `读取配置出错: ${error.message}`, config: null });
    }
});

// [POST] 更新图库配置项
app.post('/api/update-gallery-config', async (req, res) => {
    console.log("请求: [POST] /api/update-gallery-config");
    const { configKey, newValue } = req.body;
    console.log(`  > 更新项: ${configKey}, 新值: ${newValue}`);

    const allowedKeys = ['GGOP', 'Px18img-type', 'Rx18img-type', 'MihoyoOption'];
    if (!configKey || !allowedKeys.includes(configKey)) {
        console.error(`  > 错误: 无效的配置键: ${configKey}`);
        return res.status(400).json({ success: false, error: `无效的配置项: ${configKey}` });
    }

    const numericNewValue = Number(newValue);
    if (numericNewValue !== 0 && numericNewValue !== 1) {
        console.error(`  > 错误: 无效的值 (非0或1): ${numericNewValue}`);
        return res.status(400).json({ success: false, error: "状态值必须是 0 或 1。" });
    }

    try {
        if (!(await pathExists(GALLERY_CONFIG_FILE))) {
             console.error(`  > 错误: 配置文件不存在: ${GALLERY_CONFIG_FILE}`);
            return res.status(404).json({ success: false, error: "配置文件不存在，无法更新。" });
        }
        const fileContents = await fs.readFile(GALLERY_CONFIG_FILE, 'utf8');
        let configData = yaml.load(fileContents);
        if (typeof configData !== 'object' || configData === null) {
             throw new Error("配置文件格式无效，无法更新。");
        }

        configData[configKey] = numericNewValue; // 更新值
        const newYamlContents = yaml.dump(configData, { indent: 2 }); // 转回 YAML
        await fs.writeFile(GALLERY_CONFIG_FILE, newYamlContents, 'utf8'); // 写入文件

        console.log(`  > 成功更新 ${configKey} 为 ${numericNewValue}`);
        const statusText = numericNewValue === 1 ? '启用' : '禁用';
        res.json({ success: true, message: `设置 '${configKey}' 为 ${statusText} 状态成功！`, newConfig: configData });
    } catch (error) {
        console.error(`[API 配置] 更新配置 ${configKey} 出错:`, error);
        res.status(500).json({ success: false, error: `更新配置项 '${configKey}' 出错: ${error.message}` });
    }
});

// [GET] 获取主图库列表 (复用 /api/images 的逻辑，因为它们现在相同)
app.get('/api/local-images', async (req, res) => {
    console.log("请求: [GET] /api/local-images (获取本地图库列表)");
    try {
        let allImageData = [];
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const galleryBasePath = path.join(PROJECT_ROOT, gallery);
             if (await pathExists(galleryBasePath) && await isDirectory(galleryBasePath)) {
                allImageData.push(...await findGalleryImagesRecursively(gallery, galleryBasePath));
            }
        }
        allImageData.sort((a, b) => a.urlPath.localeCompare(b.urlPath));
        res.json(allImageData);
    } catch (error) {
        console.error("[API 本地图] 处理请求出错:", error);
        res.status(500).json({ error: "服务器在扫描本地图库时遇到问题。" });
    }
});

// [GET] 获取指定文件夹内容
app.get('/api/folder-contents', async (req, res) => {
    const folderName = req.query.folder;
    console.log(`请求: [GET] /api/folder-contents?folder=${folderName}`);

    if (!folderName) {
        return res.status(400).json({ error: "缺少 'folder' 参数。" });
    }

    try {
        let filesList = [];
        let folderFound = false;
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const characterFolderPath = path.join(PROJECT_ROOT, gallery, folderName);
            if (await pathExists(characterFolderPath) && await isDirectory(characterFolderPath)) {
                console.log(`  > 在 ${gallery} 找到文件夹: ${characterFolderPath}`);
                folderFound = true;
                const files = await fs.readdir(characterFolderPath);
                filesList = files.filter(f => !f.startsWith('.')); // 过滤掉隐藏文件
                break; // 找到即停止
            }
        }

        if (!folderFound) {
            console.warn(`  > 未找到文件夹: ${folderName}`);
            return res.json([]); // 返回空数组
        }

        console.log(`  > 返回 ${filesList.length} 个文件。`);
        res.json(filesList);
    } catch (error) {
        console.error(`[API 文件夹内容] 读取 ${folderName} 出错:`, error);
        res.status(500).json({ error: `读取文件夹 '${folderName}' 出错: ${error.message}` });
    }
});

// [GET] 获取内部用户数据
app.get('/api/userdata', async (req, res) => {
    console.log("请求: [GET] /api/userdata");
    try {
        const data = await safelyReadJsonFile(INTERNAL_USER_DATA_FILE, "内部用户数据");
        res.json(data);
    } catch (error) {
        console.error("[API 内数据] 获取数据出错:", error);
        res.status(500).json({ success: false, error: `读取内部用户数据出错: ${error.message}` });
    }
});

// [POST] 更新内部用户数据
app.post('/api/update-userdata', async (req, res) => {
    console.log("请求: [POST] /api/update-userdata");
    const updatedUserData = req.body;
    if (!Array.isArray(updatedUserData)) {
        return res.status(400).json({ success: false, error: "请求体必须是 JSON 数组。" });
    }
    console.log(`  > 收到 ${updatedUserData.length} 条记录，准备保存...`);
    try {
        await safelyWriteJsonFile(INTERNAL_USER_DATA_FILE, updatedUserData, "内部用户数据");
        res.json({ success: true, message: "内部用户数据保存成功！" });
    } catch (error) {
        console.error("[API 内数据] 保存数据出错:", error);
        res.status(500).json({ success: false, error: `保存内部用户数据出错: ${error.message}` });
    }
});

// [GET] 获取外部用户数据
app.get('/api/external-userdata', async (req, res) => {
    console.log("请求: [GET] /api/external-userdata");
    try {
        const data = await safelyReadJsonFile(EXTERNAL_USER_DATA_FILE, "外部用户数据");
        res.json(data);
    } catch (error) {
        console.error("[API 外数据] 获取数据出错:", error);
        res.status(500).json({ success: false, error: `读取外部用户数据出错: ${error.message}` });
    }
});

// [POST] 更新外部用户数据 (增加 GELD-ID 处理)
app.post('/api/update-external-userdata', async (req, res) => {
    console.log("请求: [POST] /api/update-external-userdata");
    const updatedExternalData = req.body;
    if (!Array.isArray(updatedExternalData)) {
        return res.status(400).json({ success: false, error: "请求体必须是 JSON 数组。" });
    }
    console.log(`  > 收到 ${updatedExternalData.length} 条记录，准备处理并保存...`);

    try {
        const geldIdRegex = /^[a-zA-Z0-9]{20}$/; // GELD-ID 格式
        const processedData = updatedExternalData.map(entry => {
            // 确保 attributes 存在
            if (!entry.attributes) entry.attributes = {};

            // 处理 GELD-ID (兼容旧 gid)
            if (entry.attributes.hasOwnProperty('gid') && !entry.attributes.hasOwnProperty('geldId')) {
                entry.attributes.geldId = entry.attributes.gid;
                delete entry.attributes.gid;
            }
            if (!entry.attributes.geldId || typeof entry.attributes.geldId !== 'string' || !geldIdRegex.test(entry.attributes.geldId)) {
                 const oldId = entry.attributes.geldId;
                 entry.attributes.geldId = generateGeldId(20);
                 console.log(`  [外数据处理] 路径 ${entry.path || '?'} GELD-ID 无效/缺失，生成新的 (旧: ${oldId}, 新: ${entry.attributes.geldId})`);
            }

            // 更新时间戳
            entry.timestamp = new Date().toISOString();

            // 确保 filename 存在
            if (!entry.attributes.filename && entry.path) {
                entry.attributes.filename = path.basename(entry.path);
            }
            return entry;
        });

        await safelyWriteJsonFile(EXTERNAL_USER_DATA_FILE, processedData, "外部用户数据");
        res.json({ success: true, message: "外部用户数据保存成功！" });
    } catch (error) {
        console.error("[API 外数据] 保存数据出错:", error);
        res.status(500).json({ success: false, error: `保存外部用户数据出错: ${error.message}` });
    }
});

// [POST] 导入图片
app.post('/api/import-image', async (req, res) => {
    console.log("请求: [POST] /api/import-image");
    const { tempImagePath, targetFolder, targetFilename, attributes } = req.body;
    console.log(`  > 导入: ${tempImagePath} -> ${targetFolder}/${targetFilename}`);

    // --- 参数校验 (基本) ---
    if (!tempImagePath || !targetFolder || !targetFilename || !attributes ||
        typeof tempImagePath !== 'string' || typeof targetFolder !== 'string' ||
        typeof targetFilename !== 'string' || typeof attributes !== 'object' ||
        !tempImagePath.startsWith(IMGTEMP_DIRECTORY_NAME + '/') ||
        targetFolder.trim() === '' || targetFolder.includes('/') || targetFolder.includes('\\') ||
        targetFilename.trim() === '' || targetFilename.includes('/') || targetFilename.includes('\\'))
    {
        console.error("  > 错误: 导入参数无效。", req.body);
        return res.status(400).json({ success: false, error: "导入请求的参数无效。" });
    }
    // --- 校验结束 ---

    const tempImageFilename = path.basename(tempImagePath);
    const sourcePhysicalPath = path.join(IMGTEMP_DIRECTORY, tempImageFilename);
    console.log(`  > 源物理路径: ${sourcePhysicalPath}`);

    if (!(await pathExists(sourcePhysicalPath)) || !(await isFile(sourcePhysicalPath))) {
        console.error(`  > 错误: 源文件无效: ${sourcePhysicalPath}`);
        return res.status(400).json({ success: false, error: `要导入的图片 '${tempImageFilename}' 在临时目录中不存在或不是文件。` });
    }

    let determinedGallery = null;
    let destinationDirectoryPhysicalPath = null;

    // 查找或确定目标图库和路径
    for (const gallery of MAIN_GALLERY_FOLDERS) {
        const potentialDir = path.join(PROJECT_ROOT, gallery, targetFolder);
        if (await pathExists(potentialDir) && await isDirectory(potentialDir)) {
            determinedGallery = gallery;
            destinationDirectoryPhysicalPath = potentialDir;
            console.log(`  > 目标文件夹在 ${gallery} 中找到。`);
            break;
        }
    }
    if (!determinedGallery) {
        if (MAIN_GALLERY_FOLDERS.length === 0) {
            return res.status(500).json({ success: false, error: "服务器未配置主图库目录。" });
        }
        determinedGallery = MAIN_GALLERY_FOLDERS[0];
        destinationDirectoryPhysicalPath = path.join(PROJECT_ROOT, determinedGallery, targetFolder);
        console.log(`  > 目标文件夹未找到，将在默认图库 ${determinedGallery} 下创建。`);
    }

    const destinationFilePhysicalPath = path.join(destinationDirectoryPhysicalPath, targetFilename);
    const destinationWebPath = `${determinedGallery}/${targetFolder}/${targetFilename}`.replace(/\\/g, "/");
    console.log(`  > 目标物理路径: ${destinationFilePhysicalPath}`);
    console.log(`  > 目标 Web 路径: ${destinationWebPath}`);

    if (await pathExists(destinationFilePhysicalPath)) {
        console.error(`  > 错误: 目标文件已存在: ${destinationFilePhysicalPath}`);
        return res.status(409).json({ success: false, error: `目标位置已存在同名文件 '${targetFilename}'。` });
    }

    try {
        // 移动文件并更新数据
        await fs.mkdir(destinationDirectoryPhysicalPath, { recursive: true });
        await fs.rename(sourcePhysicalPath, destinationFilePhysicalPath);
        console.log(`  > 文件移动成功。`);

        let savedEntries = await safelyReadJsonFile(INTERNAL_USER_DATA_FILE, "内部用户数据");

        const newEntry = {
            characterName: targetFolder,
            path: destinationWebPath,
            attributes: {
                ...attributes,
                filename: targetFilename,
                parentFolder: targetFolder,
                isBan: typeof attributes.isBan === 'boolean' ? attributes.isBan : false,
                isAiImage: typeof attributes.isAiImage === 'boolean' ? attributes.isAiImage : false,
                layout: attributes.layout || 'normal',
                id: attributes.id || null,
                md5: attributes.md5 || null,
                Downloaded_From: attributes.Downloaded_From || 'none'
            },
            timestamp: new Date().toISOString(),
            sourceGallery: determinedGallery,
        };
        if (newEntry.attributes.hasOwnProperty('isFullscreen')) { // 移除旧属性
            delete newEntry.attributes.isFullscreen;
        }
        console.log(`  > 新记录准备完毕。`);

        savedEntries.push(newEntry);
        await safelyWriteJsonFile(INTERNAL_USER_DATA_FILE, savedEntries, "内部用户数据");

        console.log(`  > 导入成功: ${targetFilename}`);
        res.json({ success: true, message: "图片导入成功！", newEntry: newEntry });

    } catch (error) {
        console.error("[API 导入] 处理导入出错:", error);
        res.status(500).json({ success: false, error: `导入过程中出错: ${error.message}` });
    }
});


// [GET] 获取临时图片列表
app.get('/api/temp-images', async (req, res) => {
    console.log("请求: [GET] /api/temp-images");
    const tempImages = [];
    try {
        if (!(await pathExists(IMGTEMP_DIRECTORY)) || !(await isDirectory(IMGTEMP_DIRECTORY))) {
            console.warn(`临时目录 ${IMGTEMP_DIRECTORY} 无效。`);
            return res.json([]);
        }
        const entries = await fs.readdir(IMGTEMP_DIRECTORY, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
                    tempImages.push({
                        filename: entry.name,
                        path: `${IMGTEMP_DIRECTORY_NAME}/${entry.name}` // Web path
                    });
                }
            }
        }
        console.log(`  > 返回 ${tempImages.length} 张临时图片。`);
        res.json(tempImages);
    } catch (error) {
        console.error("[API 临时图] 读取目录出错:", error);
        res.status(500).json({ error: "读取临时图片目录出错。" });
    }
});

// [GET] 获取背景图片列表
app.get('/api/background-images', async (req, res) => {
    console.log("请求: [GET] /api/background-images");
    const backgroundImages = [];
    try {
        if (!(await pathExists(IMG_DIRECTORY)) || !(await isDirectory(IMG_DIRECTORY))) {
            console.warn(`背景图片目录 ${IMG_DIRECTORY} 无效。`);
            return res.json([]);
        }
        const entries = await fs.readdir(IMG_DIRECTORY, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
                    backgroundImages.push(entry.name); // 只返回文件名
                }
            }
        }
        console.log(`  > 返回 ${backgroundImages.length} 个背景图片文件名。`);
        res.json(backgroundImages);
    } catch (error) {
        console.error("[API 背景图] 读取目录出错:", error);
        res.status(500).json({ error: "查找背景图片出错。" });
    }
});

// [GET] 获取主图库角色文件夹列表
app.get('/api/character-folders', async (req, res) => {
    console.log("请求: [GET] /api/character-folders");
    const folderSet = new Set();
    try {
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const galleryPath = path.join(PROJECT_ROOT, gallery);
            if (await pathExists(galleryPath) && await isDirectory(galleryPath)) {
                const entries = await fs.readdir(galleryPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        folderSet.add(entry.name);
                    }
                }
            }
        }
        const folders = Array.from(folderSet).sort((a, b) => a.localeCompare(b));
        console.log(`  > 返回 ${folders.length} 个角色文件夹。`);
        res.json(folders);
    } catch (error) {
        console.error("[API 文件夹] 扫描文件夹出错:", error);
        res.status(500).json({ error: "扫描角色文件夹出错。" });
    }
});

// [GET] 获取文件夹内最大文件编号
app.get('/api/last-file-number', async (req, res) => {
    const folderName = req.query.folder;
    console.log(`请求: [GET] /api/last-file-number?folder=${folderName}`);
    if (!folderName) {
        return res.status(400).json({ error: "缺少 'folder' 参数。" });
    }

    let maxNumber = 0;
    const filenamePattern = new RegExp(`^${escapeRegExp(folderName)}GU(\\d+)\\.\\w+$`, 'i');
    console.log(`  > 使用正则: ${filenamePattern}`);

    try {
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const characterFolderPath = path.join(PROJECT_ROOT, gallery, folderName);
            if (await pathExists(characterFolderPath) && await isDirectory(characterFolderPath)) {
                const files = await fs.readdir(characterFolderPath);
                files.forEach(file => {
                    const match = file.match(filenamePattern);
                    if (match && match[1]) {
                        const num = parseInt(match[1], 10);
                        if (!isNaN(num)) {
                            maxNumber = Math.max(maxNumber, num);
                        }
                    }
                });
            }
        }
        console.log(`  > 文件夹 ${folderName} 最大编号: ${maxNumber}`);
        res.json({ lastNumber: maxNumber });
    } catch (error) {
        console.error(`[API 最大编号] 查找 ${folderName} 出错:`, error);
        res.status(500).json({ error: `查找最大文件编号出错: ${error.message}` });
    }
});

// [POST] 重命名序列文件
app.post('/api/rename-sequence-files', async (req, res) => {
    console.log("请求: [POST] /api/rename-sequence-files");
    const { fixPlan } = req.body;

    if (!Array.isArray(fixPlan) || fixPlan.length === 0) {
        return res.status(400).json({ success: false, error: "无效的修复计划。" });
    }

    let totalProcessedFolders = 0;
    let totalRenamedFiles = 0;
    const errors = [];
    console.log(`  > 处理 ${fixPlan.length} 个文件夹的计划...`);

    const stage1Ops = [];
    const stage2Ops = [];

    for (const folderPlan of fixPlan) {
        const { folderName, filesToRename } = folderPlan;
        if (!folderName || !Array.isArray(filesToRename) || filesToRename.length === 0) continue;

        let folderPath = null;
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const potentialPath = path.join(PROJECT_ROOT, gallery, folderName);
            if (await pathExists(potentialPath) && await isDirectory(potentialPath)) {
                folderPath = potentialPath;
                break;
            }
        }
        if (!folderPath) {
            errors.push(`未找到文件夹: ${folderName}`);
            console.error(`    > 错误: 未找到物理路径: ${folderName}`);
            continue;
        }

        console.log(`  > 处理文件夹: ${folderPath}`);
        totalProcessedFolders++;
        const tempSuffix = `_temp_${crypto.randomBytes(4).toString('hex')}`;

        filesToRename.forEach(op => {
            const oldPhysicalPath = path.join(folderPath, op.currentFilename);
            const finalPhysicalPath = path.join(folderPath, op.newFilename);
            const tempPhysicalPath = finalPhysicalPath + tempSuffix;
            stage1Ops.push({ oldPath: oldPhysicalPath, newPath: tempPhysicalPath });
            stage2Ops.push({ oldPath: tempPhysicalPath, newPath: finalPhysicalPath });
        });
    }

    console.log(`  > 执行阶段一 (${stage1Ops.length} 操作)...`);
    for (const op of stage1Ops) {
        try {
            if (await pathExists(op.oldPath)) {
                await fs.rename(op.oldPath, op.newPath);
            } else {
                console.warn(`    [阶段1 跳过] 源文件不存在: ${op.oldPath}`);
            }
        } catch (renameError) {
            console.error(`    [阶段1 失败] ${path.basename(op.oldPath)} -> ${path.basename(op.newPath)}:`, renameError);
            errors.push(`重命名 ${path.basename(op.oldPath)} (临时) 失败: ${renameError.message}`);
        }
    }

    console.log(`  > 执行阶段二 (${stage2Ops.length} 操作)...`);
    for (const op of stage2Ops) {
        try {
             // 检查临时文件是否存在再执行
             if (await pathExists(op.oldPath)) {
                 await fs.rename(op.oldPath, op.newPath);
                 totalRenamedFiles++;
             } else {
                 console.warn(`    [阶段2 跳过] 临时文件不存在: ${op.oldPath}`);
             }
        } catch (renameError) {
            console.error(`    [阶段2 失败] ${path.basename(op.oldPath)} -> ${path.basename(op.newPath)}:`, renameError);
            errors.push(`重命名到 ${path.basename(op.newPath)} 失败: ${renameError.message}`);
        }
    }

    if (errors.length === 0) {
        console.log("  > 序号修复成功！");
        res.json({ success: true, message: "序号修复成功！", processedFolders: totalProcessedFolders, renamedFiles: totalRenamedFiles });
    } else {
        console.error(`  > 序号修复出现 ${errors.length} 个错误。`);
        res.status(500).json({ success: false, error: `修复过程中出现 ${errors.length} 个错误。`, errors: errors, processedFolders: totalProcessedFolders, renamedFiles: totalRenamedFiles });
    }
});


// [GET] 计算图片 MD5
app.get('/api/image-md5', async (req, res) => {
    const imageWebPath = req.query.path;
    console.log(`请求: [GET] /api/image-md5?path=${imageWebPath}`);

    if (!imageWebPath || typeof imageWebPath !== 'string' || imageWebPath.includes('..')) {
        return res.status(400).json({ error: "无效或不安全的图片路径。" });
    }

    let physicalPath = null;
    const pathSegments = imageWebPath.startsWith('/') ? imageWebPath.substring(1).split('/') : imageWebPath.split('/');

    if (pathSegments.length < 2) {
        return res.status(400).json({ error: "图片路径结构不完整。" });
    }

    const firstSegment = pathSegments[0];

    if (MAIN_GALLERY_FOLDERS.includes(firstSegment)) {
        physicalPath = path.join(PROJECT_ROOT, ...pathSegments);
    } else if (firstSegment === 'external' && pathSegments.length >= 3) {
        const sourceKey = pathSegments[1];
        if (ABSOLUTE_PLUGIN_IMAGE_PATHS[sourceKey]) {
            physicalPath = path.join(ABSOLUTE_PLUGIN_IMAGE_PATHS[sourceKey], ...pathSegments.slice(2));
        }
    } else if (firstSegment === IMGTEMP_DIRECTORY_NAME) {
        physicalPath = path.join(IMGTEMP_DIRECTORY, ...pathSegments.slice(1));
    }

    if (!physicalPath) {
        console.error(`  > 错误: 无法解析物理路径: ${imageWebPath}`);
        return res.status(400).json({ error: `无法确定文件位置: ${imageWebPath}` });
    }
    console.log(`  > 物理路径: ${physicalPath}`);

    if (!(await pathExists(physicalPath)) || !(await isFile(physicalPath))) {
        console.error(`  > 错误: 文件无效或不存在: ${physicalPath}`);
        return res.status(404).json({ error: `文件未找到或无效: ${physicalPath}` });
    }

    // 使用 Promise 处理流事件
    const calculateMd5 = (filePath) => {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const stream = require('fs').createReadStream(filePath); // Node.js fs stream, not fs/promises
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => reject(err));
        });
    };

    try {
        const md5 = await calculateMd5(physicalPath);
        console.log(`  > MD5 计算成功: ${md5}`);
        res.json({ success: true, md5: md5 });
    } catch (error) {
        console.error(`[API MD5] 计算 ${physicalPath} 出错:`, error);
        res.status(500).json({ success: false, error: `计算 MD5 出错: ${error.message}` });
    }
});

// --- 服务前端页面和脚本 ---
console.log(`[静态服务] 根路径 '/' -> ${GU_TOOLS_DIR}`);
app.use('/', express.static(GU_TOOLS_DIR));

// 根路径请求返回主 HTML
app.get('/', async (req, res) => {
    const htmlPath = path.join(GU_TOOLS_DIR, 'JSON生成器.html');
    if (await pathExists(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        console.error(`！！！主界面文件缺失: ${htmlPath}`);
        res.status(404).send('主界面文件丢失，请检查服务器。');
    }
});

// 处理 Worker 脚本请求
app.get('/searchworker.js', async (req, res) => {
    const workerPath = path.join(GU_TOOLS_DIR, 'searchworker.js');
     if (await pathExists(workerPath)) {
        res.type('application/javascript').sendFile(workerPath);
    } else {
        console.error(`Worker 脚本缺失: ${workerPath}`);
        res.status(404).send('搜索 Worker 脚本丢失。');
    }
});

// --- 服务器启动前的最后检查和准备 ---
const initializeServer = async () => {
    console.log("--- 服务器启动前检查 ---");
    try {
        await fs.mkdir(USER_DATA_DIRECTORY, { recursive: true });
        console.log(`[启动检查] 用户数据目录 OK: ${USER_DATA_DIRECTORY}`);
        await fs.mkdir(IMGTEMP_DIRECTORY, { recursive: true });
        console.log(`[启动检查] 临时图片目录 OK: ${IMGTEMP_DIRECTORY}`);

        if (!(await pathExists(EXTERNAL_USER_DATA_FILE))) {
            await fs.writeFile(EXTERNAL_USER_DATA_FILE, '[]', 'utf-8');
            console.log(`[启动检查] 创建了空的外部用户数据文件: ${EXTERNAL_USER_DATA_FILE}`);
        } else {
            console.log(`[启动检查] 外部用户数据文件 OK.`);
        }
        if (!(await pathExists(INTERNAL_USER_DATA_FILE))) {
             await fs.writeFile(INTERNAL_USER_DATA_FILE, '[]', 'utf-8');
             console.log(`[启动检查] 创建了空的内部用户数据文件: ${INTERNAL_USER_DATA_FILE}`);
        } else {
            console.log(`[启动检查] 内部用户数据文件 OK.`);
        }
        if (!(await pathExists(GALLERY_CONFIG_FILE))) {
            const defaultConfig = { GGOP: 1, 'Px18img-type': 0, 'Rx18img-type': 0, MihoyoOption: 0 };
            const defaultYaml = yaml.dump(defaultConfig, { indent: 2 });
            await fs.writeFile(GALLERY_CONFIG_FILE, defaultYaml, 'utf8');
            console.log(`[启动检查] 创建了默认的图库配置文件: ${GALLERY_CONFIG_FILE}`);
        } else {
            console.log(`[启动检查] 图库配置文件 OK.`);
        }
        console.log("--- 启动前检查完毕 ---");
        return true; // 表示检查成功
    } catch (error) {
        console.error("！！！启动失败！！！ 无法创建必要目录或文件:", error);
        return false; // 表示检查失败
    }
};

// --- 最后的错误处理中间件 ---
app.use((err, req, res, next) => {
    console.error("！！！捕获到未处理的服务器错误！！！");
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(500).send('服务器内部错误，请联系管理员。');
    }
});

// --- 启动服务器 ---
(async () => {
    const initOk = await initializeServer();
    if (!initOk) {
        process.exit(1); // 初始化失败，退出
    }

    app.listen(port, 'localhost', () => {
        console.log(`\n====================================================`);
        console.log(`🎉 咕咕牛工具箱 后台服务启动成功！ 🎉`);
        console.log(`👂 正在监听 http://localhost:${port}`);
        console.log(`✨ 服务运行中... 按 Ctrl+C 停止。 ✨`);
        console.log(`====================================================\n`);
    });
})();