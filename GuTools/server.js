// ==========================================================================
// 咕咕牛图库 Web 管理器 - 后端服务
// 负责 API 请求处理、文件系统交互、数据读写、多仓库支持等。
// ==========================================================================

const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const yaml = require("js-yaml");
const crypto = require("crypto");
const sharp = require("sharp");
const favicon = require('serve-favicon');

const app = express();
const port = 3000;

// --- 核心常量与配置 ---
const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".webp",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
]);
const IMGTEMP_DIRECTORY_NAME = "imgtemp";
const USER_DATA_FOLDER_NAME = "GuGuNiu-Gallery";
const THUMBNAIL_DIRECTORY_NAME = "thumbnails";
const THUMBNAIL_WIDTH = 200;
const DEFAULT_GALLERY_CONFIG = { TuKuOP: 1, PFL: 0 };
const MAIN_GALLERY_FOLDERS = [
  "gs-character",
  "sr-character",
  "zzz-character",
  "waves-character",
];

// --- 全局缓存与索引 ---
const _physicalPathIndex = new Map();
const _preScannedData = {
  galleryImages: [],
  pluginImages: [],
  tempImages: [],
  characterFolders: new Set(),
};

// --- 环境检测与路径设置 ---
console.log("🐂 GuGuNiu Tools Backend: 环境检测启动...");
const GU_TOOLS_DIR = __dirname;
const MAIN_REPO_DIR = path.resolve(GU_TOOLS_DIR, "..");
const PARENT_OF_MAIN_REPO = path.resolve(MAIN_REPO_DIR, "..");
const PARENT_DIR_NAME = path.basename(PARENT_OF_MAIN_REPO);

let ENV_MODE = "robot";
let YUNZAI_ROOT_DIR = path.resolve(PARENT_OF_MAIN_REPO, "..");
let RESOURCES_DIR = PARENT_OF_MAIN_REPO;
let USER_DATA_BASE_DIR = RESOURCES_DIR;
let REPO_BASE_DIR = RESOURCES_DIR;

if (PARENT_DIR_NAME !== "resources") {
  ENV_MODE = "local";
  console.log("⚠️ 检测到本地开发环境 (父目录非 'resources')");
  USER_DATA_BASE_DIR = MAIN_REPO_DIR;
  REPO_BASE_DIR = PARENT_OF_MAIN_REPO;
  YUNZAI_ROOT_DIR = path.resolve(REPO_BASE_DIR, "..");
  RESOURCES_DIR = path.join(YUNZAI_ROOT_DIR, "resources");
} else {
  console.log("✅ 检测到机器人框架环境 ('resources' 父目录)");
}

// --- 多仓库定义 ---
const REPO_NAMES = [
  "Miao-Plugin-MBT",
  "Miao-Plugin-MBT-2",
  "Miao-Plugin-MBT-3",
  "Miao-Plugin-MBT-4",
];
const REPO_ROOTS = REPO_NAMES.map((name) => ({
  name: name,
  path: path.resolve(REPO_BASE_DIR, name),
}));

// --- 最终路径计算 ---
const USER_DATA_DIRECTORY = path.join(
  USER_DATA_BASE_DIR,
  USER_DATA_FOLDER_NAME
);
const IMGTEMP_DIRECTORY = path.join(GU_TOOLS_DIR, IMGTEMP_DIRECTORY_NAME);
const THUMBNAIL_DIRECTORY = ENV_MODE === 'local' 
    ? path.join(GU_TOOLS_DIR, THUMBNAIL_DIRECTORY_NAME) 
    : path.join(USER_DATA_DIRECTORY, THUMBNAIL_DIRECTORY_NAME);
const IMG_DIRECTORY = path.join(GU_TOOLS_DIR, "img");
const INTERNAL_USER_DATA_FILE = path.join(
  USER_DATA_DIRECTORY,
  "ImageData.json"
);
const EXTERNAL_USER_DATA_FILE = path.join(
  USER_DATA_DIRECTORY,
  "ExternalImageData.json"
);
const GALLERY_CONFIG_FILE = path.join(
  USER_DATA_DIRECTORY,
  "GalleryConfig.yaml"
);

// 外部插件图片资源路径
const PLUGIN_IMAGE_PATHS = {
  miao: path.join(
    "plugins",
    "miao-plugin",
    "resources",
    "profile",
    "normal-character"
  ),
  zzz: path.join("plugins", "ZZZ-Plugin", "resources", "images", "panel"),
  waves: path.join("plugins", "waves-plugin", "resources", "rolePic"),
};
const ABSOLUTE_PLUGIN_IMAGE_PATHS = Object.fromEntries(
  Object.entries(PLUGIN_IMAGE_PATHS).map(([key, relativePath]) => [
    key,
    path.resolve(YUNZAI_ROOT_DIR, relativePath),
  ])
);

// --- 启动时路径确认 ---
console.log("--- 服务器路径配置 ---");
console.log(`环境模式: ${ENV_MODE}`);
console.log(`工具目录: ${GU_TOOLS_DIR}`);
console.log(`仓库基础目录: ${REPO_BASE_DIR}`);
console.log(`模拟 Yunzai 根目录: ${YUNZAI_ROOT_DIR}`);
console.log(`用户数据目录: ${USER_DATA_DIRECTORY}`);
console.log(`主数据文件: ${INTERNAL_USER_DATA_FILE}`);
console.log(`外数据文件: ${EXTERNAL_USER_DATA_FILE}`);
console.log(`配置文件: ${GALLERY_CONFIG_FILE}`);
console.log(`临时图片目录: ${IMGTEMP_DIRECTORY}`);
console.log(`缩略图缓存目录: ${THUMBNAIL_DIRECTORY}`);
console.log("扫描仓库列表:");
REPO_ROOTS.forEach((repo) => console.log(`  - ${repo.name}: ${repo.path}`));
console.log("外部插件扫描路径:");
Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS).forEach(([key, absPath]) =>
  console.log(`  - ${key}: ${absPath}`)
);
console.log("----------------------");

// --- 中间件设置 ---
app.use(express.json({ limit: "10mb" }));

// --- 核心工具函数 ---
const pathExists = async (p) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};
const isDirectory = async (p) => {
  try {
    const stats = await fs.stat(p);
    return stats.isDirectory();
  } catch {
    return false;
  }
};
const isFile = async (p) => {
  try {
    const stats = await fs.stat(p);
    return stats.isFile();
  } catch {
    return false;
  }
};

/**
 * 递归扫描主图库文件夹收集图片信息 (支持多仓库)
 * @param {string} storageBox 仓库名称 (原始大小写)
 * @param {string} repoBasePath 仓库的物理根路径
 * @param {string} galleryName 图库名称 (e.g., 'gs-character')
 * @param {string} galleryBasePath 图库的物理基础目录 (相对于仓库根)
 * @param {string} [currentRelativePath=''] 当前相对于 galleryBasePath 的路径
 * @returns {Promise<Array<object>>} 图片信息对象数组 {..., storageBox(原始大小写), urlPath(相对路径)}
 */
const findGalleryImagesRecursively = async (
  storageBox,
  repoBasePath,
  galleryName,
  galleryBasePath,
  currentRelativePath = ""
) => {
  const images = [];
  const currentFullPath = path.join(galleryBasePath, currentRelativePath);
  if (
    !(await pathExists(currentFullPath)) ||
    !(await isDirectory(currentFullPath))
  )
    return images;
  try {
    const entries = await fs.readdir(currentFullPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryRelativePath = path.join(currentRelativePath, entry.name);
      const entryFullPath = path.join(currentFullPath, entry.name);
      if (entry.isDirectory()) {
        images.push(
          ...(await findGalleryImagesRecursively(
            storageBox,
            repoBasePath,
            galleryName,
            galleryBasePath,
            entryRelativePath
          ))
        );
      } else if (entry.isFile()) {
        const fileExt = path.extname(entry.name).toLowerCase();
        if (ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
          const pathSegments = entryRelativePath.split(path.sep);
          if (pathSegments.length >= 2) {
            const fileName = pathSegments.pop();
            const folderName = pathSegments.pop();
            const relativeUrlPath = `${galleryName}/${entryRelativePath.replace(
              /\\/g,
              "/"
            )}`;
            images.push({
              name: folderName,
              folderName: folderName,
              fileName: fileName,
              gallery: galleryName,
              storageBox: storageBox,
              urlPath: relativeUrlPath,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(
      `[主图库扫描 ${storageBox}] 扫描目录 "${currentFullPath}" 出错:`,
      error
    );
  }
  return images;
};

/**
 * 扫描指定的外部插件图片目录
 * @param {string} sourceKey 来源标识 (e.g., 'miao')
 * @param {string} basePath 要扫描的插件图片目录的物理路径
 * @returns {Promise<Array<object>>} 外部图片信息对象数组
 */
const findPluginImages = async (sourceKey, basePath) => {
  const images = [];
  console.log(`[插件扫描] 开始扫描 ${sourceKey}: ${basePath}`);
  if (!(await pathExists(basePath)) || !(await isDirectory(basePath))) {
    console.warn(
      `[插件扫描] 目录不存在或不是目录，跳过 ${sourceKey}: ${basePath}`
    );
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
          ? path.join(relativeToBasePath, entry.name).replace(/\\/g, "/")
          : entry.name.replace(/\\/g, "/");
        if (entry.isDirectory()) {
          await findImagesRecursive(entryPath, entryRelativePath);
        } else if (entry.isFile()) {
          fileFoundCount++;
          const fileName = entry.name;
          const fileExt = path.extname(fileName).toLowerCase();
          if (ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
            const pathSegments = entryRelativePath.split("/");
            const folderName =
              pathSegments.length > 1
                ? pathSegments[pathSegments.length - 2]
                : sourceKey;
            const webPath = `/external/${sourceKey}/${entryRelativePath}`;
            images.push({
              folderName: folderName,
              fileName: fileName,
              source: sourceKey,
              relativePath: entryRelativePath,
              webPath: webPath,
            });
            imageRecordedCount++;
          }
        }
      }
    } catch (readError) {
      console.error(
        `[插件递归扫描] 读取目录 ${currentPath} 失败: ${readError.message}`
      );
    }
  };
  await findImagesRecursive(basePath, "");
  console.log(
    `[插件扫描] ${sourceKey} 扫描完成。找到 ${fileFoundCount} 文件，记录 ${imageRecordedCount} 图片。`
  );
  return images;
};

/**
 * 安全地读取 JSON 文件
 * @param {string} filePath JSON 文件路径
 * @param {string} fileDesc 文件描述 用于日志
 * @returns {Promise<Array<object>>} 解析后的数组 失败则返回空数组
 */
const safelyReadJsonFile = async (filePath, fileDesc) => {
  try {
    if (!(await pathExists(filePath))) {
      console.log(`[读取JSON] ${fileDesc} 文件不存在 ${filePath} 返回空数组`);
      return [];
    }
    const rawData = await fs.readFile(filePath, "utf-8");
    const trimmedData = rawData.trim();
    if (trimmedData === "") {
      console.log(`[读取JSON] ${fileDesc} 文件为空 ${filePath} 返回空数组`);
      return [];
    }
    const data = JSON.parse(trimmedData);
    if (Array.isArray(data)) {
      console.log(
        `[读取JSON] 成功读取 ${data.length} 条记录从 ${fileDesc} ${filePath}`
      );
      return data;
    } else {
      console.warn(
        `[读取JSON] ${fileDesc} 文件内容不是数组 ${filePath} 返回空数组`
      );
      return [];
    }
  } catch (error) {
    console.error(
      `[读取JSON] 读取或解析 ${fileDesc} 文件 ${filePath} 出错:`,
      error
    );
    return [];
  }
};

/**
 * 写入SON 文件并自定义数组序列化格式
 * @param {string} filePath 要写入的文件路径
 * @param {any} data 要写入的数据
 * @param {string} fileDesc 文件描述
 */
const safelyWriteJsonFile = async (filePath, data, fileDesc) => {
  try {
    const replacer = (key, value) => {
      if (key === 'secondaryTags' && Array.isArray(value)) {
        if (value.length === 0) return [];
        return `__ONE_LINE_ARRAY_START__${JSON.stringify(value)}__ONE_LINE_ARRAY_END__`;
      }
      return value;
    };

    let jsonString = JSON.stringify(data, replacer, 4);
    jsonString = jsonString.replace(/"__ONE_LINE_ARRAY_START__(.*?)__ONE_LINE_ARRAY_END__"/g, (match, arrayContent) => {
        return arrayContent.replace(/\\"/g, '"');
    });

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, jsonString, "utf-8");
    console.log(`[写入JSON] 成功将数据写入 ${fileDesc} ${filePath}`);
  } catch (error) {
    console.error(`[写入JSON] 写入 ${fileDesc} 文件 ${filePath} 失败:`, error);
    throw new Error(`写入 ${fileDesc} 文件失败: ${error.message}`);
  }
};

/**
 * 生成 GELD-ID
 */
const generateGeldId = (length = 20) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
};

/**
 * 转义正则表达式特殊字符
 */
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * 根据 Web 路径解析物理路径 (支持多仓库和兼容旧格式)
 * @param {string} webPath 浏览器访问的路径
 * @returns {Promise<string|null>} 物理路径或 null
 */
const resolvePhysicalPath = async (webPath) => {
  if (!webPath || typeof webPath !== "string" || webPath.includes(".."))
    return null;
  const normalizedWebPath = webPath.startsWith("/")
    ? webPath.substring(1)
    : webPath;
  const pathSegments = normalizedWebPath.split("/");
  if (pathSegments.length < 2) return null;
  const firstSegment = pathSegments[0];

  // 检查新格式主图库路径 (/仓库名/分类/...)
  const repo = REPO_ROOTS.find(r => r.name === firstSegment); // 比较原始大小写
  if (repo && pathSegments.length >= 3) {
    const galleryName = pathSegments[1];
    if (MAIN_GALLERY_FOLDERS.includes(galleryName)) {
      const potentialPath = path.join(repo.path, galleryName, ...pathSegments.slice(2)); // 拼接物理路径
      if (await pathExists(potentialPath) && await isFile(potentialPath)) {
        console.log(`[resolvePhysicalPath] 匹配到新格式主图库 (在 ${repo.name}): ${potentialPath}`);
        return potentialPath; // 返回正确的物理路径
      }
    }
  }

  // 检查外部插件
  if (firstSegment === "external" && pathSegments.length >= 3) {
    const sourceKey = pathSegments[1];
    if (ABSOLUTE_PLUGIN_IMAGE_PATHS[sourceKey]) {
      const potentialPath = path.join(
        ABSOLUTE_PLUGIN_IMAGE_PATHS[sourceKey],
        ...pathSegments.slice(2)
      );
      if ((await pathExists(potentialPath)) && (await isFile(potentialPath))) {
        console.log(`[resolvePhysicalPath] 匹配到外部插件: ${potentialPath}`);
        return potentialPath;
      }
    }
  }

  // 检查临时图片
  if (firstSegment === IMGTEMP_DIRECTORY_NAME && pathSegments.length >= 2) {
    const potentialPath = path.join(
      IMGTEMP_DIRECTORY,
      ...pathSegments.slice(1)
    );
    if ((await pathExists(potentialPath)) && (await isFile(potentialPath))) {
      console.log(`[resolvePhysicalPath] 匹配到临时图片: ${potentialPath}`);
      return potentialPath;
    }
  }

  // 检查旧格式主图库 (兼容 /分类/...)
  if (MAIN_GALLERY_FOLDERS.includes(firstSegment) && pathSegments.length >= 2) {
    console.log(`[resolvePhysicalPath] 尝试匹配旧格式主图库: ${normalizedWebPath}`);
    for (const repoLoop of REPO_ROOTS) { // 使用不同的变量名避免作用域混淆
      const potentialPath = path.join(repoLoop.path, ...pathSegments);
      if (await pathExists(potentialPath) && await isFile(potentialPath)) {
        // --- 修改日志：明确指出找到的仓库 ---
        console.log(`[resolvePhysicalPath] 匹配到旧格式路径 (在仓库 ${repoLoop.name}): ${potentialPath}`);
        // --- 日志修改结束 ---
        return potentialPath;
      }
    }
  }

  console.warn(`[resolvePhysicalPath] 未能解析物理路径: ${webPath}`);
  return null;
};

// --- 设置静态文件服务 ---
console.log("--- 配置静态文件服务 ---");
REPO_ROOTS.forEach(async (repo) => {
  if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path))) {
    console.warn(`[静态服务] 警告: 仓库目录 ${repo.path} 无效，跳过。`);
    return;
  }
  MAIN_GALLERY_FOLDERS.forEach(async (gallery) => {
    const galleryPhysicalPath = path.join(repo.path, gallery);
    const routePath = `/${repo.name}/${gallery}`; // 使用原始大小写仓库名
    if (
      (await pathExists(galleryPhysicalPath)) &&
      (await isDirectory(galleryPhysicalPath))
    ) {
      app.use(routePath, express.static(galleryPhysicalPath));
      console.log(`[静态服务] OK: ${routePath} -> ${galleryPhysicalPath}`);
    }
  });
});
(async () => {
  const routePath = `/${IMGTEMP_DIRECTORY_NAME}`;
  if (
    (await pathExists(IMGTEMP_DIRECTORY)) &&
    (await isDirectory(IMGTEMP_DIRECTORY))
  ) {
    app.use(routePath, express.static(IMGTEMP_DIRECTORY));
    console.log(`[静态服务] OK: ${routePath} -> ${IMGTEMP_DIRECTORY}`);
  } else {
    console.warn(
      `[静态服务] 警告: 临时目录 ${IMGTEMP_DIRECTORY} 无效，无法提供 ${routePath} 服务。`
    );
  }
})();
Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS).forEach(
  async ([key, physicalPath]) => {
    const routePath = `/external/${key}`;
    if ((await pathExists(physicalPath)) && (await isDirectory(physicalPath))) {
      app.use(routePath, express.static(physicalPath));
      console.log(`[静态服务] OK: ${routePath} -> ${physicalPath}`);
    } else {
      console.warn(
        `[静态服务] 警告: 外部目录 ${physicalPath} (${key}) 无效，无法提供 ${routePath} 服务。`
      );
    }
  }
);
console.log("--- 静态服务配置完毕 ---");

// --- API 端点 ---

// [GET] /api/thumbnail/* - 动态生成并缓存缩略图
app.get('/api/thumbnail/*', async (req, res) => {
  const imageWebPath = req.params[0];
  if (!imageWebPath || imageWebPath.includes('..')) {
    return res.status(400).send('无效的图片路径');
  }

  const sourcePhysicalPath = await resolvePhysicalPath(imageWebPath);

  if (!sourcePhysicalPath) {
    return res.status(404).send('原始图片未找到');
  }
  
  const cacheKey = crypto.createHash('md5').update(sourcePhysicalPath).digest('hex') + '.webp';
  const thumbnailPath = path.join(THUMBNAIL_DIRECTORY, cacheKey);

  try {
    // 尝试直接从缓存提供文件
    await fs.access(thumbnailPath);
    return res.sendFile(thumbnailPath);
  } catch {
    // 缓存未命中
    try {
      await sharp(sourcePhysicalPath)
        .resize({ width: THUMBNAIL_WIDTH })
        .webp({ quality: 100 })
        .toFile(thumbnailPath);
      
      res.sendFile(thumbnailPath);
    } catch (generationError) {
      console.error(`[缩略图] 生成 ${imageWebPath} 的缩略图失败:`, generationError);
      res.status(500).send('缩略图生成失败');
    }
  }
});

// [GET] 获取主图库图片列表
app.get("/api/images", async (req, res) => {
  console.log("请求: [GET] /api/images (多仓库)");
  try {
    let allImageData = [];
    for (const repo of REPO_ROOTS) {
      if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
        continue;
      console.log(`[API 主图] 扫描仓库: ${repo.name}`);
      for (const gallery of MAIN_GALLERY_FOLDERS) {
        const galleryBasePath = path.join(repo.path, gallery);
        if (
          (await pathExists(galleryBasePath)) &&
          (await isDirectory(galleryBasePath))
        ) {
          allImageData.push(
            ...(await findGalleryImagesRecursively(
              repo.name,
              repo.path,
              gallery,
              galleryBasePath
            ))
          );
        }
      }
    }
    allImageData.sort((a, b) => {
      const repoCompare = (a.storageBox || "").localeCompare(
        b.storageBox || ""
      );
      if (repoCompare !== 0) return repoCompare;
      return (a.urlPath || "").localeCompare(b.urlPath || "");
    });
    console.log(`[API 主图] 返回 ${allImageData.length} 张图片`);
    res.json(allImageData);
  } catch (error) {
    console.error("[API 主图] 处理请求出错:", error);
    res.status(500).json({ error: "服务器在扫描主图库时遇到问题。" });
  }
});

// [GET] 获取插件图片列表
app.get("/api/external-images", async (req, res) => {
  console.log("请求: [GET] /api/external-images");
  try {
    let allPluginImages = [];
    for (const [key, basePath] of Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS)) {
      allPluginImages.push(...(await findPluginImages(key, basePath)));
    }
    allPluginImages.sort((a, b) =>
      (a.webPath || "").localeCompare(b.webPath || "")
    );
    console.log(`[API 插件图] 返回 ${allPluginImages.length} 张图片`);
    res.json(allPluginImages);
  } catch (error) {
    console.error("[API 插件图] 处理请求出错:", error);
    res.status(500).json({ error: "服务器在扫描插件图片时遇到问题。" });
  }
});

// [GET] 获取图库配置
app.get("/api/gallery-config", async (req, res) => {
  console.log("请求: [GET] /api/gallery-config");
  try {
    let configData = { ...DEFAULT_GALLERY_CONFIG };
    if (await pathExists(GALLERY_CONFIG_FILE)) {
      try {
        const fileContents = await fs.readFile(GALLERY_CONFIG_FILE, "utf8");
        const loadedConfig = yaml.load(fileContents);
        if (typeof loadedConfig === "object" && loadedConfig !== null) {
          configData = { ...configData, ...loadedConfig };
        } else {
          console.warn(`配置文件 ${GALLERY_CONFIG_FILE} 格式无效 将使用默认值`);
        }
      } catch (readError) {
        console.error(
          `读取现有配置文件 ${GALLERY_CONFIG_FILE} 出错 将使用默认值:`,
          readError
        );
      }
    } else {
      console.warn(`配置文件不存在: ${GALLERY_CONFIG_FILE} 将使用默认值`);
    }
    console.log("成功读取图库配置 (或使用默认值)");
    res.json({ success: true, config: configData });
  } catch (error) {
    console.error("[API 配置] 读取配置出错:", error);
    res
      .status(500)
      .json({
        success: false,
        error: `读取配置出错: ${error.message}`,
        config: null,
      });
  }
});

// [POST] 更新图库配置项 (只允许 TuKuOP 和 PFL)
app.post('/api/update-gallery-config', async (req, res) => {
  console.log("请求: [POST] /api/update-gallery-config");
  const { configKey, newValue } = req.body;
  console.log(`  > 更新项: ${configKey}, 新值: ${newValue}`);

  const allowedKeys = ['TuKuOP', 'PFL'];
  if (!configKey || !allowedKeys.includes(configKey)) {
    console.error(`  > 错误: 无效的配置键: ${configKey}`);
    return res.status(400).json({ success: false, error: `无效的配置项: ${configKey}` });
  }

  let processedNewValue;
  if (configKey === 'TuKuOP') {
    processedNewValue = Number(newValue);
    if (processedNewValue !== 0 && processedNewValue !== 1) {
      console.error(`  > 错误: TuKuOP 值无效 (非0或1): ${processedNewValue}`);
      return res.status(400).json({ success: false, error: "TuKuOP 状态值必须是 0 或 1。" });
    }
  } else if (configKey === 'PFL') {
    processedNewValue = Number(newValue);
    if (![0, 1, 2].includes(processedNewValue)) {
      console.error(`  > 错误: PFL 值无效 (非0,1,2): ${processedNewValue}`);
      return res.status(400).json({ success: false, error: "PFL 净化等级值必须是 0, 1 或 2。" });
    }
  } else {
    return res.status(400).json({ success: false, error: `未知的配置项: ${configKey}` });
  }

  try {
    let configData = { ...DEFAULT_GALLERY_CONFIG }; // 从默认值开始
    if (await pathExists(GALLERY_CONFIG_FILE)) {
      try {
        const fileContents = await fs.readFile(GALLERY_CONFIG_FILE, 'utf8');
        const loadedConfig = yaml.load(fileContents);
        if (typeof loadedConfig === 'object' && loadedConfig !== null) {
          configData = { ...configData, ...loadedConfig }; // 合并加载的配置
        } else {
          console.warn(`配置文件 ${GALLERY_CONFIG_FILE} 格式无效，将覆盖为新配置`);
        }
      } catch (readError) {
        console.error(`读取现有配置文件 ${GALLERY_CONFIG_FILE} 出错，将覆盖:`, readError);
      }
    } else {
      console.log(`配置文件 ${GALLERY_CONFIG_FILE} 不存在，将创建新文件`);
    }

    configData[configKey] = processedNewValue; // 更新值
    const newYamlContents = yaml.dump(configData, { indent: 2 }); // 转回 YAML
    await fs.writeFile(GALLERY_CONFIG_FILE, newYamlContents, 'utf8'); // 写入文件

    console.log(`  > 成功更新 ${configKey} 为 ${processedNewValue}`);
    res.json({ success: true, message: `设置 '${configKey}' 成功！`, newConfig: configData });
  } catch (error) {
    console.error(`[API 配置] 更新配置 ${configKey} 出错:`, error);
    res.status(500).json({ success: false, error: `更新配置项 '${configKey}' 出错: ${error.message}` });
  }
});

// [GET] 获取主图库列表
app.get("/api/local-images", async (req, res) => {
  console.log("请求: [GET] /api/local-images (获取本地图库列表, 多仓库)");
  try {
    let allImageData = [];
    for (const repo of REPO_ROOTS) {
      if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
        continue;
      for (const gallery of MAIN_GALLERY_FOLDERS) {
        const galleryBasePath = path.join(repo.path, gallery);
        if (
          (await pathExists(galleryBasePath)) &&
          (await isDirectory(galleryBasePath))
        ) {
          allImageData.push(
            ...(await findGalleryImagesRecursively(
              repo.name,
              repo.path,
              gallery,
              galleryBasePath
            ))
          );
        }
      }
    }
    allImageData.sort((a, b) => {
      const repoCompare = (a.storageBox || "").localeCompare(
        b.storageBox || ""
      );
      if (repoCompare !== 0) return repoCompare;
      return (a.urlPath || "").localeCompare(b.urlPath || "");
    });
    res.json(allImageData);
  } catch (error) {
    console.error("[API 本地图] 处理请求出错:", error);
    res.status(500).json({ error: "服务器在扫描本地图库时遇到问题。" });
  }
});

// [GET] 获取指定文件夹内容
app.get("/api/folder-contents", async (req, res) => {
  const folderName = req.query.folder;
  const storageBox = req.query.storageBox;
  console.log(
    `请求: [GET] /api/folder-contents?folder=${folderName}&storageBox=${storageBox}`
  );
  if (!folderName || !storageBox) {
    return res
      .status(400)
      .json({ error: "缺少 'folder' 或 'storageBox' 参数。" });
  }
  const repo = REPO_ROOTS.find((r) => r.name === storageBox);
  if (!repo) {
    return res.status(404).json({ error: `未知的仓库: ${storageBox}` });
  }
  try {
    let filesList = [];
    let folderFound = false;
    for (const gallery of MAIN_GALLERY_FOLDERS) {
      const characterFolderPath = path.join(repo.path, gallery, folderName);
      if (
        (await pathExists(characterFolderPath)) &&
        (await isDirectory(characterFolderPath))
      ) {
        console.log(
          `  > 在 ${storageBox}/${gallery} 找到文件夹: ${characterFolderPath}`
        );
        folderFound = true;
        const files = await fs.readdir(characterFolderPath);
        filesList = files.filter((f) => !f.startsWith("."));
        break;
      }
    }
    if (!folderFound) {
      console.warn(`  > 在仓库 ${storageBox} 中未找到文件夹: ${folderName}`);
      return res.json([]);
    }
    console.log(`  > 返回 ${filesList.length} 个文件`);
    res.json(filesList);
  } catch (error) {
    console.error(
      `[API 文件夹内容] 读取 ${storageBox}/${folderName} 出错:`,
      error
    );
    res
      .status(500)
      .json({
        error: `读取文件夹 '${folderName}' (仓库: ${storageBox}) 出错: ${error.message}`,
      });
  }
});

// [GET] 获取内部用户数据
app.get("/api/userdata", async (req, res) => {
  console.log("请求: [GET] /api/userdata");
  try {
    const data = await safelyReadJsonFile(
      INTERNAL_USER_DATA_FILE,
      "内部用户数据"
    );
    res.json(data);
  } catch (error) {
    console.error("[API 内数据] 获取数据出错:", error);
    res
      .status(500)
      .json({
        success: false,
        error: `读取内部用户数据出错: ${error.message}`,
      });
  }
});

// [POST] 更新内部用户数据
app.post("/api/update-userdata", async (req, res) => {
  console.log("请求: [POST] /api/update-userdata");
  const updatedUserData = req.body;
  if (!Array.isArray(updatedUserData)) {
    return res
      .status(400)
      .json({ success: false, error: "请求体必须是 JSON 数组。" });
  }
  console.log(`  > 收到 ${updatedUserData.length} 条记录 准备保存...`);
  try {
    await safelyWriteJsonFile(
      INTERNAL_USER_DATA_FILE,
      updatedUserData,
      "内部用户数据"
    );
    res.json({ success: true, message: "内部用户数据保存成功！" });
  } catch (error) {
    console.error("[API 内数据] 保存数据出错:", error);
    res
      .status(500)
      .json({
        success: false,
        error: `保存内部用户数据出错: ${error.message}`,
      });
  }
});

// [GET] 获取外部用户数据
app.get("/api/external-userdata", async (req, res) => {
  console.log("请求: [GET] /api/external-userdata");
  try {
    const data = await safelyReadJsonFile(
      EXTERNAL_USER_DATA_FILE,
      "外部用户数据"
    );
    res.json(data);
  } catch (error) {
    console.error("[API 外数据] 获取数据出错:", error);
    res
      .status(500)
      .json({
        success: false,
        error: `读取外部用户数据出错: ${error.message}`,
      });
  }
});

// [POST] 更新外部用户数据
app.post("/api/update-external-userdata", async (req, res) => {
  console.log("请求: [POST] /api/update-external-userdata");
  const updatedExternalData = req.body;
  if (!Array.isArray(updatedExternalData)) {
    return res
      .status(400)
      .json({ success: false, error: "请求体必须是 JSON 数组。" });
  }
  console.log(
    `  > 收到 ${updatedExternalData.length} 条记录 准备处理并保存...`
  );
  try {
    const geldIdRegex = /^[a-zA-Z0-9]{20}$/;
    const processedData = updatedExternalData.map((entry) => {
      if (!entry.attributes) entry.attributes = {};
      if (
        entry.attributes.hasOwnProperty("gid") &&
        !entry.attributes.hasOwnProperty("geldId")
      ) {
        entry.attributes.geldId = entry.attributes.gid;
        delete entry.attributes.gid;
      }
      if (
        !entry.attributes.geldId ||
        typeof entry.attributes.geldId !== "string" ||
        !geldIdRegex.test(entry.attributes.geldId)
      ) {
        entry.attributes.geldId = generateGeldId(20);
      }
      entry.timestamp = new Date().toISOString();
      if (!entry.attributes.filename && entry.path) {
        entry.attributes.filename = path.basename(entry.path);
      }
      return entry;
    });
    await safelyWriteJsonFile(
      EXTERNAL_USER_DATA_FILE,
      processedData,
      "外部用户数据"
    );
    res.json({ success: true, message: "外部用户数据保存成功！" });
  } catch (error) {
    console.error("[API 外数据] 保存数据出错:", error);
    res
      .status(500)
      .json({
        success: false,
        error: `保存外部用户数据出错: ${error.message}`,
      });
  }
});

// [POST] 仓库核对修正 (使用修正后的自动确定仓库逻辑)
app.post('/api/batch-update-storagebox', async (req, res) => {
  console.log("请求: [POST] /api/batch-update-storagebox");
  const { entriesToUpdate } = req.body;

  if (!Array.isArray(entriesToUpdate)) {
    console.error("  > 错误: 请求体必须是包含 'entriesToUpdate' 数组的对象。");
    return res.status(400).json({ success: false, error: "请求体格式错误，缺少 'entriesToUpdate' 数组。" });
  }
  if (entriesToUpdate.length === 0) {
    console.log("  > 信息: 收到空的更新列表，无需操作。");
    return res.json({ success: true, message: "没有需要更新的条目。", updatedCount: 0 });
  }

  console.log(`  > 收到 ${entriesToUpdate.length} 条 storagebox 更新请求...`);

  try {
    let imageData = await safelyReadJsonFile(INTERNAL_USER_DATA_FILE, "内部用户数据");
    let updatedCount = 0;

    entriesToUpdate.forEach(itemToUpdate => {
      if (!itemToUpdate || typeof itemToUpdate.gid !== 'string' || typeof itemToUpdate.correctStorageBox !== 'string') {
        console.warn("  > 跳过无效的更新条目:", itemToUpdate);
        return;
      }

      const entryIndex = imageData.findIndex(entry => entry.gid === itemToUpdate.gid);

      if (entryIndex > -1) {
        const newStorageBoxValue = itemToUpdate.correctStorageBox;

        if (imageData[entryIndex].storagebox !== newStorageBoxValue) { // 与JSON中当前值比较
          console.log(`    > 校准 GID: ${itemToUpdate.gid}, 从 "${imageData[entryIndex].storagebox}" -> "${newStorageBoxValue}"`);
          imageData[entryIndex].storagebox = newStorageBoxValue; // 更新为原始大小写
          imageData[entryIndex].timestamp = new Date().toISOString();
          updatedCount++;
        } else {
          console.log(`    > GID: ${itemToUpdate.gid}, storagebox 无需更改 ("${imageData[entryIndex].storagebox}")`);
        }
      } else {
        console.warn(`    > 未能在 ImageData.json 中找到 GID 为 ${itemToUpdate.gid} 的记录进行更新。`);
      }
    });

    if (updatedCount > 0) {
      await safelyWriteJsonFile(INTERNAL_USER_DATA_FILE, imageData, "内部用户数据 (storagebox校准)");
      console.log(`  > 成功更新了 ${updatedCount} 条记录的 storagebox。`);
      res.json({ success: true, message: `成功更新了 ${updatedCount} 条记录的 storagebox。`, updatedCount: updatedCount });
    } else {
      console.log("  > 没有记录的 storagebox 被实际更改。");
      res.json({ success: true, message: "没有记录的 storagebox 需要更新。", updatedCount: 0 });
    }

  } catch (error) {
    console.error("[API Storagebox校准] 处理更新时出错:", error);
    res.status(500).json({ success: false, error: `校准 storagebox 失败: ${error.message}` });
  }
});

// [POST] 导入图片
app.post("/api/import-image", async (req, res) => {
  console.log("请求: [POST] /api/import-image (自动确定仓库)");
  const { tempImagePath, targetFolder, targetFilename, attributes } = req.body;
  console.log(
    `  > 导入: ${tempImagePath} -> ${targetFolder}/${targetFilename}`
  );
  if (
    !tempImagePath ||
    !targetFolder ||
    !targetFilename ||
    !attributes ||
    typeof tempImagePath !== "string" ||
    typeof targetFolder !== "string" ||
    typeof targetFilename !== "string" ||
    typeof attributes !== "object" ||
    !tempImagePath.startsWith(IMGTEMP_DIRECTORY_NAME + "/") ||
    targetFolder.trim() === "" ||
    targetFolder.includes("/") ||
    targetFolder.includes("\\") ||
    targetFilename.trim() === "" ||
    targetFilename.includes("/") ||
    targetFilename.includes("\\")
  ) {
    console.error("  > 错误: 导入参数无效。", req.body);
    return res
      .status(400)
      .json({ success: false, error: "导入请求的参数无效。" });
  }
  const tempImageFilename = path.basename(tempImagePath);
  const sourcePhysicalPath = path.join(IMGTEMP_DIRECTORY, tempImageFilename);
  console.log(`  > 源物理路径: ${sourcePhysicalPath}`);
  if (
    !(await pathExists(sourcePhysicalPath)) ||
    !(await isFile(sourcePhysicalPath))
  ) {
    console.error(`  > 错误: 源文件无效: ${sourcePhysicalPath}`);
    return res
      .status(400)
      .json({
        success: false,
        error: `要导入的图片 '${tempImageFilename}' 在临时目录中不存在或不是文件。`,
      });
  }

  let determinedStorageBox = null; // 原始大小写
  let determinedGallery = null;
  let destinationDirectoryPhysicalPath = null;
  let targetRepoPath = null;
  let folderExists = false;

  for (const repo of REPO_ROOTS) {
    if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
      continue;
    for (const gallery of MAIN_GALLERY_FOLDERS) {
      const potentialDir = path.join(repo.path, gallery, targetFolder);
      if (
        (await pathExists(potentialDir)) &&
        (await isDirectory(potentialDir))
      ) {
        determinedStorageBox = repo.name;
        determinedGallery = gallery;
        destinationDirectoryPhysicalPath = potentialDir;
        targetRepoPath = repo.path;
        folderExists = true;
        console.log(
          `  > 目标文件夹在 ${determinedStorageBox}/${determinedGallery} 中找到`
        );
        break;
      }
    }
    if (folderExists) break;
  }

  if (!folderExists) {
    if (REPO_ROOTS.length === 0)
      return res
        .status(500)
        .json({ success: false, error: "服务器未配置任何仓库目录。" });
    if (MAIN_GALLERY_FOLDERS.length === 0)
      return res
        .status(500)
        .json({ success: false, error: "服务器未配置主图库目录分类。" });
    determinedStorageBox = REPO_ROOTS[0].name;
    determinedGallery = MAIN_GALLERY_FOLDERS[0];
    targetRepoPath = REPO_ROOTS[0].path;
    destinationDirectoryPhysicalPath = path.join(
      targetRepoPath,
      determinedGallery,
      targetFolder
    );
    console.log(
      `  > 目标文件夹未找到 将在默认仓库 ${determinedStorageBox}/${determinedGallery} 下创建`
    );
  }

  const destinationFilePhysicalPath = path.join(
    destinationDirectoryPhysicalPath,
    targetFilename
  );
  const relativePath =
    `${determinedGallery}/${targetFolder}/${targetFilename}`.replace(
      /\\/g,
      "/"
    ); // 相对路径
  console.log(`  > 目标物理路径: ${destinationFilePhysicalPath}`);
  console.log(`  > 存储相对路径: ${relativePath}`);

  if (await pathExists(destinationFilePhysicalPath)) {
    console.error(`  > 错误: 目标文件已存在: ${destinationFilePhysicalPath}`);
    return res
      .status(409)
      .json({
        success: false,
        error: `目标位置已存在同名文件 '${targetFilename}'。`,
      });
  }

  try {
    await fs.mkdir(destinationDirectoryPhysicalPath, { recursive: true });
    await fs.rename(sourcePhysicalPath, destinationFilePhysicalPath);
    console.log(`  > 文件移动成功`);
    let savedEntries = await safelyReadJsonFile(
      INTERNAL_USER_DATA_FILE,
      "内部用户数据"
    );
    const newEntry = {
      storagebox: determinedStorageBox, // 写入小写
      characterName: targetFolder,
      path: relativePath, // 存储相对路径
      attributes: {
        filename: targetFilename,
        parentFolder: targetFolder,
        isPx18: attributes.isPx18 || false,
        isRx18: attributes.isRx18 || false,
        layout: attributes.layout || "normal",
        isEasterEgg: attributes.isEasterEgg || false,
        isAiImage: attributes.isAiImage || false,
        isBan: false,
        md5: null,
        Downloaded_From: attributes.Downloaded_From || "none",
        secondaryTags: Array.isArray(attributes.secondaryTags) ? attributes.secondaryTags : [],
      },
      timestamp: new Date().toISOString(),
      sourceGallery: determinedGallery,
      gid: generateNumericId(), // 在后端生成 GID
    };
    console.log(`  > 新记录准备完毕 GID: ${newEntry.gid}`);
    savedEntries.push(newEntry);
    await safelyWriteJsonFile(
      INTERNAL_USER_DATA_FILE,
      savedEntries,
      "内部用户数据"
    );
    console.log(`  > 导入成功: ${targetFilename} 到 ${determinedStorageBox}`);
    // 返回给前端的 newEntry 中包含原始大小写的 storageBox 和相对路径 path
    res.json({
      success: true,
      message: "图片导入成功！",
      newEntry: {
        ...newEntry,
        storageBox: determinedStorageBox,
        path: newEntry.path,
        storagebox: undefined,
      }, // 返回原始大小写 storageBox 和相对路径 path
    });
  } catch (error) {
    console.error("[API 导入] 处理导入出错:", error);
    try {
      if (
        (await pathExists(destinationFilePhysicalPath)) &&
        !(await pathExists(sourcePhysicalPath))
      ) {
        await fs.rename(destinationFilePhysicalPath, sourcePhysicalPath);
        console.log("  > 尝试回滚文件移动成功");
      }
    } catch (rollbackError) {
      console.error("  > 尝试回滚文件移动失败:", rollbackError);
    }
    res
      .status(500)
      .json({ success: false, error: `导入过程中出错: ${error.message}` });
  }
});

// [GET] 获取临时图片列表
app.get("/api/temp-images", async (req, res) => {
  console.log("请求: [GET] /api/temp-images");
  const tempImages = [];
  try {
    if (
      !(await pathExists(IMGTEMP_DIRECTORY)) ||
      !(await isDirectory(IMGTEMP_DIRECTORY))
    ) {
      console.warn(`临时目录 ${IMGTEMP_DIRECTORY} 无效`);
      return res.json([]);
    }
    const entries = await fs.readdir(IMGTEMP_DIRECTORY, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
          tempImages.push({
            filename: entry.name,
            path: `${IMGTEMP_DIRECTORY_NAME}/${entry.name}`,
          });
        }
      }
    }
    console.log(`  > 返回 ${tempImages.length} 张临时图片`);
    res.json(tempImages);
  } catch (error) {
    console.error("[API 临时图] 读取目录出错:", error);
    res.status(500).json({ error: "读取临时图片目录出错。" });
  }
});

// [GET] 获取背景图片列表
app.get("/api/background-images", async (req, res) => {
  console.log("请求: [GET] /api/background-images");
  const backgroundImages = [];
  try {
    if (
      !(await pathExists(IMG_DIRECTORY)) ||
      !(await isDirectory(IMG_DIRECTORY))
    ) {
      console.warn(`背景图片目录 ${IMG_DIRECTORY} 无效`);
      return res.json([]);
    }
    const entries = await fs.readdir(IMG_DIRECTORY, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext)) {
          backgroundImages.push(entry.name);
        }
      }
    }
    console.log(`  > 返回 ${backgroundImages.length} 个背景图片文件名`);
    res.json(backgroundImages);
  } catch (error) {
    console.error("[API 背景图] 读取目录出错:", error);
    res.status(500).json({ error: "查找背景图片出错。" });
  }
});

// [GET] 获取主图库角色文件夹列表
app.get("/api/character-folders", async (req, res) => {
  console.log("请求: [GET] /api/character-folders (多仓库)");
  const folderSet = new Set();
  try {
    for (const repo of REPO_ROOTS) {
      if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
        continue;
      for (const gallery of MAIN_GALLERY_FOLDERS) {
        const galleryPath = path.join(repo.path, gallery);
        if (
          (await pathExists(galleryPath)) &&
          (await isDirectory(galleryPath))
        ) {
          const entries = await fs.readdir(galleryPath, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            if (entry.isDirectory()) {
              folderSet.add(entry.name);
            }
          }
        }
      }
    }
    const folders = Array.from(folderSet).sort((a, b) => a.localeCompare(b));
    console.log(`  > 返回 ${folders.length} 个角色文件夹`);
    res.json(folders);
  } catch (error) {
    console.error("[API 文件夹] 扫描文件夹出错:", error);
    res.status(500).json({ error: "扫描角色文件夹出错。" });
  }
});

// [GET] 获取文件夹内最大文件编号
app.get("/api/last-file-number", async (req, res) => {
  const folderName = req.query.folder;
  console.log(
    `请求: [GET] /api/last-file-number?folder=${folderName} (自动查找仓库)`
  );
  if (!folderName) {
    return res.status(400).json({ error: "缺少 'folder' 参数。" });
  }
  let maxNumber = 0;
  const filenamePattern = /Gu(\d+)\.\w+$/i;
  console.log(`  > 使用正则: ${filenamePattern}`);
  try {
    for (const repo of REPO_ROOTS) {
      if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
        continue;
      for (const gallery of MAIN_GALLERY_FOLDERS) {
        const characterFolderPath = path.join(repo.path, gallery, folderName);
        if (
          (await pathExists(characterFolderPath)) &&
          (await isDirectory(characterFolderPath))
        ) {
          console.log(
            `  > 在仓库 ${repo.name}/${gallery} 找到文件夹: ${characterFolderPath}`
          );
          const files = await fs.readdir(characterFolderPath);
          files.forEach((file) => {
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
    }
    console.log(
      `  > 文件夹 ${folderName} 在所有仓库中找到的最大编号: ${maxNumber}`
    );
    res.json({ lastNumber: maxNumber });
  } catch (error) {
    console.error(`[API 最大编号] 查找 ${folderName} 出错:`, error);
    res.status(500).json({ error: `查找最大文件编号出错: ${error.message}` });
  }
});

// [POST] 重命名序列文件 (支持多仓库)
app.post("/api/rename-sequence-files", async (req, res) => {
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
    const { folderName, storageBox, filesToRename } = folderPlan;
    if (
      !folderName ||
      !storageBox ||
      !Array.isArray(filesToRename) ||
      filesToRename.length === 0
    ) {
      errors.push(`计划项无效`);
      console.error(`    > 错误: 计划项无效`, folderPlan);
      continue;
    }
    const repo = REPO_ROOTS.find((r) => r.name === storageBox);
    if (!repo) {
      errors.push(`未找到仓库: ${storageBox}`);
      console.error(`    > 错误: 未找到仓库 ${storageBox}`);
      continue;
    }
    let folderPath = null;
    for (const gallery of MAIN_GALLERY_FOLDERS) {
      const potentialPath = path.join(repo.path, gallery, folderName);
      if (
        (await pathExists(potentialPath)) &&
        (await isDirectory(potentialPath))
      ) {
        folderPath = potentialPath;
        break;
      }
    }
    if (!folderPath) {
      errors.push(`未找到文件夹: ${storageBox}/${folderName}`);
      console.error(`    > 错误: 未找到物理路径: ${storageBox}/${folderName}`);
      continue;
    }
    console.log(`  > 处理文件夹: ${folderPath}`);
    totalProcessedFolders++;
    const tempSuffix = `_temp_${crypto.randomBytes(4).toString("hex")}`;
    filesToRename.forEach((op) => {
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
      console.error(
        `    [阶段1 失败] ${path.basename(op.oldPath)} -> ${path.basename(
          op.newPath
        )}:`,
        renameError
      );
      errors.push(
        `重命名 ${path.basename(op.oldPath)} (临时) 失败: ${renameError.message
        }`
      );
    }
  }
  console.log(`  > 执行阶段二 (${stage2Ops.length} 操作)...`);
  for (const op of stage2Ops) {
    try {
      if (await pathExists(op.oldPath)) {
        await fs.rename(op.oldPath, op.newPath);
        totalRenamedFiles++;
      } else {
        console.warn(`    [阶段2 跳过] 临时文件不存在: ${op.oldPath}`);
      }
    } catch (renameError) {
      console.error(
        `    [阶段2 失败] ${path.basename(op.oldPath)} -> ${path.basename(
          op.newPath
        )}:`,
        renameError
      );
      errors.push(
        `重命名到 ${path.basename(op.newPath)} 失败: ${renameError.message}`
      );
    }
  }
  if (errors.length === 0) {
    console.log("  > 序号修复成功！");
    res.json({
      success: true,
      message: "序号修复成功！",
      processedFolders: totalProcessedFolders,
      renamedFiles: totalRenamedFiles,
    });
  } else {
    console.error(`  > 序号修复出现 ${errors.length} 个错误`);
    res
      .status(500)
      .json({
        success: false,
        error: `修复过程中出现 ${errors.length} 个错误`,
        errors: errors,
        processedFolders: totalProcessedFolders,
        renamedFiles: totalRenamedFiles,
      });
  }
});

// [POST] 处理仓库转移请求
app.post('/api/transfer-folder', async (req, res) => {
  console.log("请求: [POST] /api/transfer-folder");
  const { sourceStorageBox, sourceFolderName, targetStorageBox } = req.body;
  console.log(`  > 转移请求: 从 [${sourceStorageBox}] 的 "${sourceFolderName}" 到 [${targetStorageBox}]`);

  if (!sourceStorageBox || !sourceFolderName || !targetStorageBox) {
    return res.status(400).json({ success: false, error: "缺少必要的参数 (源仓库/源文件夹/目标仓库)" });
  }
  if (sourceStorageBox === targetStorageBox) {
    return res.status(400).json({ success: false, error: "源仓库和目标仓库不能相同" });
  }
  const sourceRepo = REPO_ROOTS.find(r => r.name === sourceStorageBox);
  const targetRepo = REPO_ROOTS.find(r => r.name === targetStorageBox);
  if (!sourceRepo || !targetRepo) {
    return res.status(404).json({ success: false, error: "指定的源仓库或目标仓库未找到" });
  }

  let sourceFolderPath = null;
  let sourceGallery = null; // 源文件夹所在的图库分类 (gs-character 等)
  let targetGallery = null; // 目标文件夹所在的图库分类 (通常与源相同)
  let targetFolderPath = null;
  let filesToMove = []; // 要移动的文件列表

  try {
    //查找源文件夹的完整物理路径和所属分类
    let foundSource = false;
    for (const gallery of MAIN_GALLERY_FOLDERS) {
      const potentialPath = path.join(sourceRepo.path, gallery, sourceFolderName);
      if (await pathExists(potentialPath) && await isDirectory(potentialPath)) {
        sourceFolderPath = potentialPath;
        sourceGallery = gallery;
        foundSource = true;
        console.log(`  > 找到源文件夹: ${sourceFolderPath}`);
        // 读取源文件夹内容
        filesToMove = await fs.readdir(sourceFolderPath);
        filesToMove = filesToMove.filter(f => !f.startsWith('.')); // 过滤隐藏文件
        break;
      }
    }
    if (!foundSource) {
      throw new Error(`在源仓库 [${sourceStorageBox}] 中未找到文件夹 "${sourceFolderName}"`);
    }

    // 确定目标文件夹路径 (通常使用与源相同的分类)
    targetGallery = sourceGallery;
    targetFolderPath = path.join(targetRepo.path, targetGallery, sourceFolderName);
    console.log(`  > 目标文件夹路径: ${targetFolderPath}`);

    //  检查目标路径是否已存在同名文件夹
    if (await pathExists(targetFolderPath)) {
      // 可以选择报错，或者合并 (合并逻辑复杂，暂不实现)
      throw new Error(`目标仓库 [${targetStorageBox}] 中已存在同名文件夹 "${sourceFolderName}"`);
    }

    // 移动文件夹 (使用 rename 实现移动)
    console.log(`  > 准备移动文件夹从 ${sourceFolderPath} 到 ${targetFolderPath}`);
    await fs.rename(sourceFolderPath, targetFolderPath);
    console.log(`  > 文件夹移动成功`);

    // 更新 ImageData.json
    console.log(`  > 开始更新 ImageData.json...`);
    let imageData = await safelyReadJsonFile(INTERNAL_USER_DATA_FILE, "内部用户数据");
    let updatedCount = 0;
    const targetStorageboxLower = targetStorageBox.toLowerCase(); // 目标仓库小写
    const sourceStorageboxLower = sourceStorageBox.toLowerCase(); // 源仓库小写
    const sourceRelativePrefix = `${sourceGallery}/${sourceFolderName}/`; // 源相对路径前缀

    // 使用 map 创建新数组 确保修改生效
    const updatedImageData = imageData.map(entry => {
      // 找到属于源仓库 (比较小写) 且 路径以源文件夹开头的条目
      if (entry.storagebox?.toLowerCase() === sourceStorageboxLower && entry.path?.startsWith(sourceRelativePrefix)) {
        // 创建一个新的 entry 对象进行修改 避免直接修改原数组中的对象引用
        const updatedEntry = { ...entry };
        updatedEntry.storagebox = targetStorageBox; // 更新为目标仓库小写
        // path (相对路径) 通常不需要改变 因为分类和文件夹名不变
        updatedEntry.timestamp = new Date().toISOString(); // 更新时间戳
        updatedCount++;
        console.log(`    > 更新条目: GID ${entry.gid || 'N/A'}, 原路径 ${entry.path}, 新仓库 ${targetStorageboxLower}`);
        return updatedEntry; // 返回修改后的对象
      }
      return entry; // 返回原始对象
    });

    // 确保写回的是更新后的数组
    await safelyWriteJsonFile(INTERNAL_USER_DATA_FILE, updatedImageData, "内部用户数据");
    console.log(`  > ImageData.json 更新完成 更新了 ${updatedCount} 条记录`);


    // 查找被更新的第一个条目作为示例返回 
    const sampleUpdatedEntry = updatedImageData.find(entry =>
      entry.storagebox === targetStorageboxLower &&
      entry.path?.startsWith(`${sourceGallery}/${sourceFolderName}/`)
    );

    res.json({
      success: true,
      message: `成功将文件夹 "${sourceFolderName}" 从 [${sourceStorageBox}] 转移到 [${targetStorageBox}]`,
      filesMoved: filesToMove.length,
      jsonUpdated: updatedCount,
      // sampleEntry: sampleUpdatedEntry ? { ...sampleUpdatedEntry, storageBox: targetStorageBox, storagebox: undefined } : null
    });

  } catch (error) {
    console.error(`[API 仓库转移] 处理转移时出错:`, error);
    // TODO: 尝试回滚文件移动 (如果移动已发生)
    res.status(500).json({ success: false, error: `仓库转移失败: ${error.message}` });
  }
});

// [GET] 获取所有仓库文件的详细信息（包括大小）
app.get("/api/file-sizes", async (req, res) => {
  console.log("请求: [GET] /api/file-sizes");
  try {
    const filePromises = [];
    for (const repo of REPO_ROOTS) {
      if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path)))
        continue;
      for (const gallery of MAIN_GALLERY_FOLDERS) {
        const galleryBasePath = path.join(repo.path, gallery);
        if (
          (await pathExists(galleryBasePath)) &&
          (await isDirectory(galleryBasePath))
        ) {
          const findAndStatFiles = async (currentRelativePath = "") => {
            const currentFullPath = path.join(
              galleryBasePath,
              currentRelativePath
            );
            if (
              !(await pathExists(currentFullPath)) ||
              !(await isDirectory(currentFullPath))
            )
              return;

            const entries = await fs.readdir(currentFullPath, {
              withFileTypes: true,
            });
            for (const entry of entries) {
              const entryRelativePath = path.join(
                currentRelativePath,
                entry.name
              );
              const entryFullPath = path.join(currentFullPath, entry.name);
              if (entry.isDirectory()) {
                await findAndStatFiles(entryRelativePath);
              } else if (entry.isFile()) {
                const fileExt = path.extname(entry.name).toLowerCase();
                if (ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
                  filePromises.push(
                    (async () => {
                      try {
                        const stats = await fs.stat(entryFullPath);
                        const pathSegments = entryRelativePath.split(path.sep);
                        const fileName = pathSegments.pop() || entry.name;
                        const folderName = pathSegments.pop() || "unknown";
                        const relativeUrlPath =
                          `${gallery}/${entryRelativePath}`.replace(
                            /\\/g,
                            "/"
                          );
                        const repoMatch = repo.name.match(/-(\d+)$/);
                        return {
                          storageBox: repo.name,
                          urlPath: relativeUrlPath,
                          fileName: fileName,
                          folderName: folderName,
                          sizeInBytes: stats.size,
                          repoNumber: repoMatch ? parseInt(repoMatch[1], 10) : 1,
                        };
                      } catch (statError) {
                        console.error(
                          `[文件大小] 无法获取文件状态: ${entryFullPath}`,
                          statError
                        );
                        return null;
                      }
                    })()
                  );
                }
              }
            }
          };
          await findAndStatFiles();
        }
      }
    }

    const allFileData = (await Promise.all(filePromises)).filter(Boolean);
    allFileData.sort((a, b) => b.sizeInBytes - a.sizeInBytes);
    console.log(`[API 文件大小] 返回 ${allFileData.length} 个文件的信息`);
    res.json(allFileData);
  } catch (error) {
    console.error("[API 文件大小] 处理请求出错:", error);
    res.status(500).json({ error: "服务器在扫描文件大小时遇到问题。" });
  }
});

// [GET] 计算图片 MD5
app.get("/api/image-md5", async (req, res) => {
  const imageWebPath = req.query.path;
  console.log(`请求: [GET] /api/image-md5?path=${imageWebPath}`);
  if (!imageWebPath || typeof imageWebPath !== "string") {
    return res.status(400).json({ error: "无效的图片路径。" });
  }
  const physicalPath = await resolvePhysicalPath(imageWebPath);
  if (!physicalPath) {
    console.error(`  > 错误: 无法解析物理路径或文件不存在: ${imageWebPath}`);
    return res
      .status(404)
      .json({ error: `文件未找到或路径无法解析: ${imageWebPath}` });
  }
  console.log(`  > 物理路径: ${physicalPath}`);
  
  const calculateMd5 = async (filePath) => {
      // 直接读取文件到缓冲区，然后计算哈希，避免流处理问题
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('md5').update(fileBuffer).digest('hex');
  };
  
  try {
    const md5 = await calculateMd5(physicalPath);
    console.log(`  > MD5 计算成功: ${md5}`);
    res.json({ success: true, md5: md5 });
  } catch (error) {
    console.error(`[API MD5] 计算 ${physicalPath} 出错:`, error);
    res
      .status(500)
      .json({ success: false, error: `计算 MD5 出错: ${error.message}` });
  }
});
// [GET] 获取二级标签列表
app.get("/api/secondary-tags", async (req, res) => {
  console.log("请求: [GET] /api/secondary-tags");
  const tagsFilePath = path.join(USER_DATA_DIRECTORY, "SecondTags.json"); 
  try {
    const content = await fs.readFile(tagsFilePath, "utf-8");
    res.json(JSON.parse(content));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn("[API 二级标签] SecondTags.json 文件未找到。", `路径: ${tagsFilePath}`);
      res.status(404).json({ error: `二级标签配置文件未找到。` });
    } else {
      console.error("[API 二级标签] 读取或解析文件出错:", error);
      res.status(500).json({ error: "服务器读取二级标签配置时出错。" });
    }
  }
});

// [GET] 更新二级标签
app.post("/api/update-secondary-tags", async (req, res) => {
  console.log("请求: [POST] /api/update-secondary-tags");
  const newTagsData = req.body;

  if (typeof newTagsData !== 'object' || newTagsData === null) {
    return res.status(400).json({ success: false, error: "请求数据格式无效。" });
  }

  const tagsFilePath = path.join(USER_DATA_DIRECTORY, "SecondTags.json");
  const backupFilePath = path.join(USER_DATA_DIRECTORY, "SecondTags.json.bak");

  try {
    // 安全起见，先备份
    try {
      await fs.copyFile(tagsFilePath, backupFilePath);
      console.log(`  > 已成功备份 SecondTags.json 到 ${backupFilePath}`);
    } catch (backupError) {
      if (backupError.code !== 'ENOENT') { // 如果源文件不存在，则无需备份
        console.warn(`  > 备份 SecondTags.json 失败:`, backupError);
      }
    }

    // 写入新数据
    const jsonString = JSON.stringify(newTagsData, null, 2);
    await fs.writeFile(tagsFilePath, jsonString, "utf-8");
    console.log(`  > 成功更新 SecondTags.json`);

    res.json({ success: true, message: "二级标签更新成功！" });
  } catch (error) {
    console.error("[API 二级标签] 更新文件时出错:", error);
    res.status(500).json({ success: false, error: "服务器写入二级标签配置时出错。" });
  }
});

// --- 服务前端页面和脚本 ---
app.use(favicon(path.join(GU_TOOLS_DIR, 'favicon.ico')));
app.use("/", express.static(GU_TOOLS_DIR));

app.get("/", async (req, res) => {
  const htmlPath = path.join(GU_TOOLS_DIR, "咕咕牛Web管理.html");
  if (await pathExists(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    console.error(`！！！主界面文件缺失: ${htmlPath}`);
    res.status(404).send("主界面文件丢失，请检查服务器。");
  }
});

app.get("/searchworker.js", async (req, res) => {
  const workerPath = path.join(GU_TOOLS_DIR, "searchworker.js");
  if (await pathExists(workerPath)) {
    res.type("application/javascript").sendFile(workerPath);
  } else {
    console.error(`Worker 脚本缺失: ${workerPath}`);
    res.status(404).send("搜索 Worker 脚本丢失。");
  }
});

// --- 启动前检查和索引构建 ---
const buildFileSystemIndex = async () => {
    console.log("--- [索引服务] 开始构建文件系统索引... ---");
    const startTime = Date.now();
    
    // 索引主图库
    for (const repo of REPO_ROOTS) {
        if (!(await pathExists(repo.path)) || !(await isDirectory(repo.path))) continue;
        for (const gallery of MAIN_GALLERY_FOLDERS) {
            const galleryBasePath = path.join(repo.path, gallery);
            const images = await findGalleryImagesRecursively(repo.name, repo.path, gallery, galleryBasePath);
            for (const img of images) {
                _preScannedData.galleryImages.push(img);
                _preScannedData.characterFolders.add(img.folderName);
                const physicalPath = path.join(repo.path, img.urlPath);
                // 新格式: /Miao-Plugin-MBT/gs-character/...
                _physicalPathIndex.set(`${img.storageBox}/${img.urlPath}`, physicalPath);
                // 旧格式: /gs-character/...
                _physicalPathIndex.set(img.urlPath, physicalPath);
            }
        }
    }
    _preScannedData.galleryImages.sort((a, b) => (a.storageBox + a.urlPath).localeCompare(b.storageBox + a.urlPath));

    // 索引插件图片
    for (const [key, basePath] of Object.entries(ABSOLUTE_PLUGIN_IMAGE_PATHS)) {
      const pluginImages = await findPluginImages(key, basePath);
      for(const img of pluginImages) {
        _preScannedData.pluginImages.push(img);
        const physicalPath = path.join(basePath, img.relativePath);
        const webPathKey = img.webPath.substring(1); // 移除开头的 /
        _physicalPathIndex.set(webPathKey, physicalPath);
      }
    }
    _preScannedData.pluginImages.sort((a, b) => (a.webPath || "").localeCompare(b.webPath || ""));

    // 索引临时图片
    if ((await pathExists(IMGTEMP_DIRECTORY)) && (await isDirectory(IMGTEMP_DIRECTORY))) {
        const entries = await fs.readdir(IMGTEMP_DIRECTORY, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && ALLOWED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                const webPath = `${IMGTEMP_DIRECTORY_NAME}/${entry.name}`;
                _preScannedData.tempImages.push({ filename: entry.name, path: webPath });
                _physicalPathIndex.set(webPath, path.join(IMGTEMP_DIRECTORY, entry.name));
            }
        }
    }
    
    const duration = Date.now() - startTime;
    console.log(`--- [索引服务] 索引构建完成！耗时 ${duration}ms ---`);
    console.log(`  - 主图库: ${_preScannedData.galleryImages.length} 张图片`);
    console.log(`  - 插件图库: ${_preScannedData.pluginImages.length} 张图片`);
    console.log(`  - 临时目录: ${_preScannedData.tempImages.length} 张图片`);
    console.log(`  - 路径索引: ${_physicalPathIndex.size} 条记录`);
};

const pregenerateThumbnails = async () => {
  console.log("--- [缩略图服务] 开始后台预生成缩略图... ---");
  const startTime = Date.now();
  let generatedCount = 0;
  let skippedCount = 0;
  
  // 使用 Set 确保我们只为每个唯一的物理路径处理一次
  const uniquePhysicalPaths = new Set(_physicalPathIndex.values());
  const totalUniqueFiles = uniquePhysicalPaths.size;
  let processedCount = 0;

  for (const physicalPath of uniquePhysicalPaths) {
      processedCount++;
      const cacheKey = crypto.createHash('md5').update(physicalPath).digest('hex') + '.webp';
      const thumbnailPath = path.join(THUMBNAIL_DIRECTORY, cacheKey);

      try {
          await fs.access(thumbnailPath);
          skippedCount++;
      } catch {
          try {
              // 文件不存在，生成它
              await sharp(physicalPath)
                  .resize({ width: THUMBNAIL_WIDTH })
                  .webp({ quality: 90 })
                  .toFile(thumbnailPath);
              generatedCount++;
          } catch (genError) {
              // 忽略单个文件的生成错误，避免中断整个过程
              console.error(`[缩略图预生成] 无法为 ${physicalPath} 生成缩略图: ${genError.message}`);
          }
      }
      
      if (processedCount % 200 === 0) {
          console.log(`[缩略图预生成] 进度: ${processedCount} / ${totalUniqueFiles}`);
      }
  }

  const duration = Date.now() - startTime;
  console.log(`--- [缩略图服务] 预生成完成！耗时 ${duration}ms ---`);
  console.log(`  - 新生成: ${generatedCount} 张`);
  console.log(`  - 已跳过: ${skippedCount} 张 (已缓存)`);
};

const initializeServer = async () => {
  console.log("--- 服务器启动前检查 ---");
  try {
    await fs.mkdir(USER_DATA_DIRECTORY, { recursive: true });
    console.log(`[启动检查] 用户数据目录 OK: ${USER_DATA_DIRECTORY}`);
    await fs.mkdir(IMGTEMP_DIRECTORY, { recursive: true });
    console.log(`[启动检查] 临时图片目录 OK: ${IMGTEMP_DIRECTORY}`);
    await fs.mkdir(THUMBNAIL_DIRECTORY, { recursive: true });
    console.log(`[启动检查] 缩略图缓存目录 OK: ${THUMBNAIL_DIRECTORY}`);
    if (!(await pathExists(EXTERNAL_USER_DATA_FILE))) {
      await fs.writeFile(EXTERNAL_USER_DATA_FILE, "[]", "utf-8");
      console.log(
        `[启动检查] 创建了空的外部用户数据文件: ${EXTERNAL_USER_DATA_FILE}`
      );
    } else {
      console.log(`[启动检查] 外部用户数据文件 OK.`);
    }
    if (!(await pathExists(INTERNAL_USER_DATA_FILE))) {
      await fs.writeFile(INTERNAL_USER_DATA_FILE, "[]", "utf-8");
      console.log(
        `[启动检查] 创建了空的内部用户数据文件: ${INTERNAL_USER_DATA_FILE}`
      );
    } else {
      console.log(`[启动检查] 内部用户数据文件 OK.`);
    }
    if (!(await pathExists(GALLERY_CONFIG_FILE))) {
      const defaultYaml = yaml.dump(DEFAULT_GALLERY_CONFIG, { indent: 2 });
      await fs.writeFile(GALLERY_CONFIG_FILE, defaultYaml, "utf8");
      console.log(
        `[启动检查] 创建了默认的图库配置文件: ${GALLERY_CONFIG_FILE}`
      );
    } else {
      console.log(`[启动检查] 图库配置文件 OK.`);
    }
    
    await buildFileSystemIndex(); // 在此执行索引构建

    console.log("--- 启动前检查完毕 ---");
    return true;
  } catch (error) {
    console.error("！！！启动失败！！！ 无法创建必要目录或文件:", error);
    return false;
  }
};

// --- 最后的错误处理中间件 ---
app.use((err, req, res, next) => {
  console.error("！！！捕获到未处理的服务器错误！！！");
  console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).send("服务器内部错误，请联系管理员。");
  }
});

// --- 启动服务器 ---
(async () => {
  const initOk = await initializeServer();
  if (!initOk) {
    process.exit(1);
  }
  app.listen(port, "localhost", () => {
    console.log(`\n====================================================`);
    console.log(`🎉 咕咕牛图库工具 后台服务启动成功！ 🎉`);
    console.log(`👂 正在监听 http://localhost:${port}`);
    console.log(`✨ 服务运行中... 按 Ctrl+C 停止。 ✨`);
    console.log(`====================================================\n`);

    pregenerateThumbnails().catch(err => {
        console.error("!!! 缩略图预生成过程中发生未捕获的错误:", err);
    });
  });
})();