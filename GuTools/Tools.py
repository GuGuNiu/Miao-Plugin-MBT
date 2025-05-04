import configparser
import hashlib
import json
import locale
import logging
import os
import queue
import random
import re
import shutil
import string
import sys
import threading
import time
import webbrowser
from collections import OrderedDict
from datetime import datetime, timezone
from functools import cmp_to_key, lru_cache, partial
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from urllib.parse import quote, unquote
import customtkinter as ctk 
import yaml 
from PIL import Image, ImageTk
from tkinter import filedialog, messagebox, scrolledtext, ttk
import tkinter as tk
import tkinter.font as tkFont


# --- 全局配置与常量 ---
ALLOWED_IMAGE_EXTENSIONS: Set[str] = {'.webp', '.png', '.jpg', '.jpeg', '.gif'}
USER_DATA_SUBDIR: str = "GuGuNiu-Gallery"
IMGTEMP_SUBDIR: str = os.path.join("GuTools", "imgtemp") 
IMG_SUBDIR: str = os.path.join("GuTools", "img") 
INTERNAL_JSON_FILENAME: str = "ImageData.json"
EXTERNAL_JSON_FILENAME: str = "ExternalImageData.json" 
GALLERY_CONFIG_FILENAME: str = "GalleryConfig.yaml" 
GID_LENGTH: int = 10 # GID 长度
CONFIG_FILENAME: str = "guguniu_gui_config.ini"
CONFIG_SECTION: str = "Settings"
CONFIG_KEY_REPO_PATH: str = "MainRepositoryPath"
APP_TITLE: str = "咕咕牛图库工具箱 v3.4.0 (桌面版-多仓库-顶级Storagebox)"
PREVIEW_MAX_WIDTH: int = 450 # JsonGen 预览区域最大宽度
PREVIEW_MAX_HEIGHT: int = 500 # JsonGen 预览区域最大高度
HOVER_PREVIEW_SIZE: Tuple[int, int] = (200, 200) # DataList 悬浮预览图最大尺寸
HOVER_DELAY_MS: int = 500 # DataList 悬浮预览延迟
TREEVIEW_DISPLAY_LIMIT: int = 5000 # DataList Treeview 最大显示行数
FIND_PATH_CACHE_SIZE: int = 4096 # 物理路径查找缓存大小
JSONGEN_THUMB_SIZE: Tuple[int, int] = (160, 160) # JSON生成页面的缩略图尺寸 (方形)
JSONGEN_PLACEHOLDER_IMAGE: Optional[ImageTk.PhotoImage] = None # JSON生成页面的缩略图占位符
JSONGEN_THUMB_REQ_QUEUE: queue.Queue = queue.Queue() # JSON生成缩略图请求队列
JSONGEN_THUMB_RES_QUEUE: queue.Queue = queue.Queue() # JSON生成缩略图结果队列
JSONGEN_THUMB_WORKER_COUNT: int = 4 # JSON生成缩略图加载线程数

# --- 日志配置 ---
log_queue: queue.Queue = queue.Queue()

def setup_logging() -> None:
    """配置日志记录器，输出到标准输出"""
    log_format: str = '%(asctime)s [%(levelname)s] %(message)s'
    log_datefmt: str = '%Y-%m-%d %H:%M:%S'
    root_logger: logging.Logger = logging.getLogger()
    # 清除可能存在的旧处理器，避免重复日志
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    logging.basicConfig(level=logging.INFO, format=log_format, datefmt=log_datefmt,
                        handlers=[logging.StreamHandler(sys.stdout)])

def log_message(message: str, level: str = "INFO") -> None:
    """记录日志消息并放入队列以更新 GUI"""
    timestamp: str = time.strftime('%H:%M:%S')
    log_queue.put(f"[{timestamp}][{level.upper()}] {message}\n")
    level_upper: str = level.upper()
    if level_upper == "ERROR":
        logging.error(message)
    elif level_upper == "WARNING":
        logging.warning(message)
    else:
        logging.info(message)

# --- CustomTkinter 设置 ---
ctk.set_appearance_mode("Light")
ctk.set_default_color_theme("blue")

# --- 全局变量 ---
main_repo_path: Optional[str] = None # 主仓库绝对路径
repo_parent_dir: Optional[Path] = None # 主仓库的父目录
all_repo_paths: Dict[str, str] = {} # 检测到的所有仓库 {'repo_name': 'abs_path'}
ordered_repo_paths: List[Tuple[str, str]] = [] # 按查找优先级排序的仓库列表
user_data_dir: Optional[str] = None # 用户数据子目录路径
imgtemp_dir: Optional[str] = None # 临时图片目录路径
img_dir: Optional[str] = None # GuTools/img 目录路径
internal_json_path: Optional[str] = None # ImageData.json 完整路径
external_json_path: Optional[str] = None # ExternalImageData.json 完整路径
gallery_config_path: Optional[str] = None # GalleryConfig.yaml 完整路径
config_file_path: Optional[str] = None # GUI 配置文件路径
app_instance: Optional['GuGuNiuApp'] = None # 主应用实例
app_running: bool = True # 应用运行状态标志
image_data_cache: List[OrderedDict] = [] # 内存中的 ImageData.json 内容
image_data_map: Dict[str, OrderedDict] = {} # path -> entry 的映射
image_data_paths_set: Set[str] = set() # 所有已记录的相对路径集合
background_tasks: Dict[str, threading.Thread] = {} # 存储后台线程对象
task_status_vars: Dict[str, tk.StringVar] = {} # 存储任务状态的 tk.StringVar
task_progress_vars: Dict[str, tk.IntVar] = {} # 存储任务进度的 tk.IntVar
task_cancel_flags: Dict[str, tk.BooleanVar] = {} # 存储任务取消标志
hover_preview_window: Optional[ctk.CTkToplevel] = None # DataList 悬浮预览窗口实例
hover_after_id: Optional[str] = None # DataList 悬浮预览的 after 调用 ID

# --- 核心工具函数 ---
def path_exists(p: Union[str, Path, None]) -> bool:
    """安全检查路径是否存在"""
    try:
        return Path(p).exists() if p else False
    except OSError as e:
        log_message(f"检查路径存在性时出错: {p} - {e}", "WARNING")
        return False

def is_directory(p: Union[str, Path, None]) -> bool:
    """安全检查路径是否为目录"""
    try:
        return Path(p).is_dir() if p else False
    except OSError as e:
        log_message(f"检查路径是否为目录时出错: {p} - {e}", "WARNING")
        return False

def is_file(p: Union[str, Path, None]) -> bool:
    """安全检查路径是否为文件"""
    try:
        return Path(p).is_file() if p else False
    except OSError as e:
        log_message(f"检查路径是否为文件时出错: {p} - {e}", "WARNING")
        return False

def get_config_path() -> str:
    """获取 GUI 配置文件的路径，优先脚本目录，失败则用户目录"""
    try:
        # 检查是否为打包后的可执行文件
        if getattr(sys, 'frozen', False):
            app_dir: str = os.path.dirname(sys.executable)
        else:
            app_dir: str = os.path.dirname(os.path.abspath(__file__))
        config_path: str = os.path.join(app_dir, CONFIG_FILENAME)
        # 尝试在脚本目录创建测试文件以检查写入权限
        test_file: str = config_path + ".test_write"
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            log_message(f"配置文件将使用脚本目录: {app_dir}", "INFO")
            return config_path
        except Exception as e:
            log_message(f"无法在脚本目录写入配置文件 ({e})，尝试用户目录", "WARNING")
            user_home: Path = Path.home()
            config_dir: Path = user_home / ".guguniu_toolbox_gui"
            config_dir.mkdir(parents=True, exist_ok=True)
            log_message(f"配置文件将使用用户目录: {config_dir}", "INFO")
            return str(config_dir / CONFIG_FILENAME)
    except Exception as e:
        log_message(f"获取配置文件路径时发生严重错误: {e}", "ERROR")
        fallback_path: str = os.path.join(Path.cwd(), CONFIG_FILENAME)
        log_message(f"将尝试在当前工作目录使用配置文件: {fallback_path}", "ERROR")
        return fallback_path

def detect_repositories(main_repo_path_str: str) -> bool:
    """
    检测主仓库及其同级的子仓库。

    Args:
        main_repo_path_str: 用户选择的主仓库路径。

    Returns:
        仓库检测是否成功。
    """
    global repo_parent_dir, all_repo_paths, ordered_repo_paths
    all_repo_paths = {}
    ordered_repo_paths = []
    if not main_repo_path_str or not is_directory(main_repo_path_str):
        log_message(f"检测仓库失败：主仓库路径无效 '{main_repo_path_str}'", "ERROR")
        return False

    try:
        main_repo_path_obj: Path = Path(main_repo_path_str).resolve()
        main_repo_name: str = main_repo_path_obj.name
        repo_parent_dir = main_repo_path_obj.parent
    except Exception as e:
        log_message(f"解析主仓库路径时出错: {main_repo_path_str} - {e}", "ERROR")
        return False

    if not is_directory(repo_parent_dir):
        log_message(f"错误：无法访问主仓库的父目录 '{repo_parent_dir}'", "ERROR")
        return False

    found_repos: Dict[str, str] = {main_repo_name: str(main_repo_path_obj)}
    # 正则表达式匹配形如 "主仓库名-数字" 的子仓库
    repo_name_pattern: re.Pattern = re.compile(rf"^{re.escape(main_repo_name)}-(\d+)$")

    try:
        for item in repo_parent_dir.iterdir():
            if item.is_dir():
                match: Optional[re.Match] = repo_name_pattern.match(item.name)
                if match:
                    found_repos[item.name] = str(item.resolve())
    except OSError as e:
        log_message(f"扫描父目录 '{repo_parent_dir}' 时出错: {e}", "ERROR")

    all_repo_paths = found_repos
    sub_repos: List[Dict[str, Any]] = []
    main_repo_tuple: Optional[Tuple[str, str]] = None

    # 分离主仓库和子仓库，为排序做准备
    for name, path_val in all_repo_paths.items():
        match = repo_name_pattern.match(name)
        if match:
            sub_repos.append({'name': name, 'path': path_val, 'num': int(match.group(1))})
        elif name == main_repo_name:
            main_repo_tuple = (name, path_val)

    # 子仓库按数字降序排序
    sub_repos.sort(key=lambda x: x['num'], reverse=True)
    # 构建最终的有序列表，子仓库在前，主仓库在后
    ordered_repo_paths = [(r['name'], r['path']) for r in sub_repos]
    if main_repo_tuple:
        ordered_repo_paths.append(main_repo_tuple)

    repo_names_str: str = ', '.join([r[0] for r in ordered_repo_paths]) if ordered_repo_paths else "无"
    log_message(f"仓库检测完成，共 {len(all_repo_paths)} 个。查找顺序: {repo_names_str}", "INFO")
    return True

def safely_read_json(file_path: Optional[str], description: str = "数据") -> List[OrderedDict]:
    """
    安全地读取 JSON 文件，返回列表，处理各种错误。

    Args:
        file_path: JSON 文件路径。
        description: 文件描述，用于日志。

    Returns:
        包含 OrderedDict 的列表，或空列表。
    """
    if not file_path or not is_file(file_path):
        log_message(f"读取 JSON 失败：{description} 文件不存在或路径无效 '{file_path}'", "ERROR")
        return []
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f: # 使用 utf-8-sig 读取以处理 BOM
            content: str = f.read().strip()
        if not content:
            log_message(f"{description} 文件为空: {file_path}", "WARNING")
            return []
        data: Any = json.loads(content, object_pairs_hook=OrderedDict) # 保留原始顺序
        if isinstance(data, list):
            log_message(f"成功读取 {len(data)} 条 {description} 记录从 {os.path.basename(file_path)}", "INFO")
            # 可以在这里添加对列表内元素类型的检查
            return data
        else:
            log_message(f"{description} 文件内容不是列表格式: {file_path}", "ERROR")
            return []
    except json.JSONDecodeError as e:
        log_message(f"解析 {description} JSON 文件失败: {file_path} - {e}", "ERROR")
        return []
    except FileNotFoundError:
        log_message(f"读取 JSON 失败：{description} 文件未找到 '{file_path}'", "ERROR")
        return []
    except PermissionError:
         log_message(f"读取 JSON 失败：无权限访问 '{file_path}'", "ERROR")
         return []
    except Exception as e:
        log_message(f"读取 {description} 文件时发生未知错误: {file_path} - {e}", "ERROR")
        return []

def safely_write_json(file_path: Optional[str], data: List[OrderedDict], description: str = "数据") -> bool:
    """
    安全地写入 JSON 文件 (列表)，带备份。

    Args:
        file_path: 目标 JSON 文件路径。
        data: 要写入的 OrderedDict 列表。
        description: 文件描述，用于日志。

    Returns:
        写入是否成功。
    """
    if not file_path:
        log_message(f"写入 JSON 失败：无效的文件路径 ({description})。", "ERROR")
        return False
    # 类型检查已由类型提示处理，但运行时检查也可保留
    # if not isinstance(data, list):
    #      log_message(f"写入 JSON 失败：数据不是列表类型 ({description})。", "ERROR")
    #      return False

    backup_path: Optional[str] = None
    try:
        # 确保目录存在
        dir_name: str = os.path.dirname(file_path)
        if dir_name: # 避免对纯文件名调用 makedirs
            os.makedirs(dir_name, exist_ok=True)

        # 备份旧文件
        if is_file(file_path):
            timestamp: str = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{file_path}.bak_{timestamp}"
            try:
                shutil.copy2(file_path, backup_path)
                log_message(f"已备份旧 {description} 文件到: {os.path.basename(backup_path)}", "INFO")
            except Exception as backup_e:
                log_message(f"备份 {description} 文件失败: {backup_e}", "WARNING")
                backup_path = None # 备份失败，记录警告

        # 写入新文件
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

        log_message(f"{description} 数据已成功写入 {os.path.basename(file_path)} (共 {len(data)} 条记录)", "INFO")
        return True
    except PermissionError:
        log_message(f"写入 JSON 失败：无权限写入 '{file_path}'", "ERROR")
    except Exception as e:
        log_message(f"写入 {description} 文件失败: {file_path} - {e}", "ERROR")
        # 尝试恢复备份
        if backup_path and is_file(backup_path):
            try:
                shutil.move(backup_path, file_path)
                log_message(f"尝试从备份恢复 {description} 文件成功。", "INFO")
            except Exception as restore_e:
                log_message(f"从备份恢复 {description} 文件失败: {restore_e}", "ERROR")
        return False

def initialize_paths_and_data(repo_path_str: str) -> bool:
    """
    根据主仓库路径初始化所有相关路径和加载数据。

    Args:
        repo_path_str: 用户选择的主仓库路径。

    Returns:
        初始化是否成功。
    """
    global main_repo_path, user_data_dir, imgtemp_dir, img_dir, internal_json_path, external_json_path, gallery_config_path, image_data_cache, image_data_map, image_data_paths_set
    # 重置全局变量
    main_repo_path = None
    all_repo_paths.clear()
    ordered_repo_paths.clear()
    image_data_cache = []
    image_data_map = {}
    image_data_paths_set = set()
    clear_find_path_cache() # 清除路径查找缓存

    if not detect_repositories(repo_path_str):
        return False

    # 获取主仓库的规范化路径
    main_repo_name: str = Path(repo_path_str).name
    main_repo_path = all_repo_paths.get(main_repo_name)
    if not main_repo_path:
        log_message(f"错误：无法在检测到的仓库中找到主仓库路径 '{repo_path_str}'", "ERROR")
        return False

    main_repo_path_obj: Path = Path(main_repo_path)
    user_data_dir = str(main_repo_path_obj / USER_DATA_SUBDIR)
    imgtemp_dir = str(main_repo_path_obj / IMGTEMP_SUBDIR)
    img_dir = str(main_repo_path_obj / IMG_SUBDIR)
    internal_json_path = os.path.join(user_data_dir, INTERNAL_JSON_FILENAME)
    external_json_path = os.path.join(user_data_dir, EXTERNAL_JSON_FILENAME)
    gallery_config_path = os.path.join(user_data_dir, GALLERY_CONFIG_FILENAME)

    log_message(f"主仓库路径: {main_repo_path}")
    log_message(f"用户数据目录: {user_data_dir}")
    log_message(f"内部 JSON 文件: {internal_json_path}")

    try:
        # 创建必要的子目录
        os.makedirs(user_data_dir, exist_ok=True)
        os.makedirs(imgtemp_dir, exist_ok=True)
        os.makedirs(img_dir, exist_ok=True)

        # 确保 JSON 文件存在且不为空
        for json_p, desc in [(internal_json_path, "内部用户数据"), (external_json_path, "外部用户数据")]:
            # 检查文件是否存在或大小为0
            should_create = False
            try:
                if not is_file(json_p) or os.path.getsize(json_p) == 0:
                    should_create = True
            except OSError: # getsize 可能因文件不存在或权限问题失败
                 if not is_file(json_p): # 再次确认是否是不存在导致
                      should_create = True
                 else: # 存在但无法获取大小，可能是权限问题
                      log_message(f"无法获取文件大小: {json_p}，跳过创建检查", "WARNING")

            if should_create:
                if safely_write_json(json_p, [], desc):
                    log_message(f"已创建空的 {desc} 文件: {json_p}")
                else:
                    log_message(f"创建空的 {desc} 文件失败: {json_p}", "ERROR")

        # 确保图库配置文件存在
        if not is_file(gallery_config_path):
            default_config: Dict[str, int] = {'GGOP': 1, 'Px18img-type': 0, 'Rx18img-type': 0, 'MihoyoOption': 0}
            try:
                with open(gallery_config_path, 'w', encoding='utf-8') as f:
                    yaml.dump(default_config, f, indent=2, allow_unicode=True)
                log_message(f"已创建默认的图库配置文件: {gallery_config_path}")
            except Exception as e:
                log_message(f"创建图库配置文件 '{gallery_config_path}' 失败: {e}", "ERROR")

        # 加载内部 JSON 数据到内存
        image_data_cache = safely_read_json(internal_json_path, "内部用户数据")
        # 构建 path -> entry 映射和 path 集合
        image_data_map = {
            entry.get('path', '').replace('\\', '/'): entry
            for entry in image_data_cache if isinstance(entry, dict) and entry.get('path')
        }
        image_data_paths_set = set(image_data_map.keys())

        log_message(f"已加载 {len(image_data_cache)} 条内部用户数据到内存。")
        return True

    except Exception as e:
        log_message(f"初始化仓库子目录或文件时出错: {e}", "ERROR")
        return False

def load_configuration_and_initialize() -> bool:
    """加载 GUI 配置 (主仓库路径) 并初始化"""
    global config_file_path, main_repo_path
    config_file_path = get_config_path()
    log_message(f"尝试从 '{config_file_path}' 加载 GUI 配置...")
    config: configparser.ConfigParser = configparser.ConfigParser()

    if not path_exists(config_file_path):
        log_message(f"配置文件 '{config_file_path}' 不存在，需要用户选择主仓库。", "INFO")
        return False

    try:
        config.read(config_file_path, encoding='utf-8')
        if config.has_section(CONFIG_SECTION) and config.has_option(CONFIG_SECTION, CONFIG_KEY_REPO_PATH):
            stored_path: str = config.get(CONFIG_SECTION, CONFIG_KEY_REPO_PATH)
            if stored_path and is_directory(stored_path):
                # 尝试使用存储的路径初始化
                if initialize_paths_and_data(stored_path):
                    log_message(f"配置加载成功，主仓库: {main_repo_path}")
                    return True
                else:
                    # 初始化失败，路径可能已失效
                    log_message(f"配置中的路径 '{stored_path}' 初始化失败，需要重新选择。", "ERROR")
                    # 尝试从配置中移除无效路径
                    config.remove_option(CONFIG_SECTION, CONFIG_KEY_REPO_PATH)
                    try:
                        with open(config_file_path, 'w', encoding='utf-8') as cf:
                            config.write(cf)
                    except Exception as write_e:
                        log_message(f"写入配置文件以移除无效路径时失败: {write_e}", "WARNING")
                    return False
            else:
                log_message(f"配置文件中的路径 '{stored_path}' 无效或不是目录，需要重新选择。", "WARNING")
                return False
        else:
            log_message("配置文件格式不正确或缺少主仓库路径，需要用户选择。", "INFO")
            return False
    except configparser.Error as e:
         log_message(f"解析配置文件时出错: {e}", "ERROR")
         return False
    except Exception as e:
        log_message(f"加载配置文件时发生未知错误: {e}", "ERROR")
        return False

def save_configuration(repo_path_str: str) -> bool:
    """
    保存主仓库路径到配置文件。

    Args:
        repo_path_str: 要保存的主仓库路径。

    Returns:
        保存是否成功。
    """
    if not config_file_path:
        log_message("无法保存配置：配置文件路径未设置。", "ERROR")
        return False
    if not repo_path_str or not is_directory(repo_path_str):
        log_message(f"无法保存配置：提供的仓库路径无效 '{repo_path_str}'", "ERROR")
        return False

    config: configparser.ConfigParser = configparser.ConfigParser()
    # 如果文件存在，先读取现有内容
    if path_exists(config_file_path):
        try:
            config.read(config_file_path, encoding='utf-8')
        except Exception as read_e:
            log_message(f"读取现有配置以保存时出错: {read_e}", "WARNING")

    # 确保节存在
    if not config.has_section(CONFIG_SECTION):
        config.add_section(CONFIG_SECTION)

    # 设置主仓库路径
    config.set(CONFIG_SECTION, CONFIG_KEY_REPO_PATH, repo_path_str)

    # 写入文件
    try:
        with open(config_file_path, 'w', encoding='utf-8') as configfile:
            config.write(configfile)
        log_message(f"已将主仓库路径保存到配置文件: {config_file_path}")
        return True
    except PermissionError:
        log_message(f"保存配置失败：无权限写入 '{config_file_path}'", "ERROR")
        return False
    except Exception as e:
        log_message(f"保存配置失败: {e}", "ERROR")
        return False

@lru_cache(maxsize=FIND_PATH_CACHE_SIZE)
def find_physical_path_fallback(relative_path: str) -> Optional[str]:
    """
    (缓存) 按 ordered_repo_paths 顺序查找文件的物理路径 (后备机制)。

    Args:
        relative_path: 文件的相对路径。

    Returns:
        文件的绝对物理路径，或 None。
    """
    if not relative_path or not ordered_repo_paths:
        return None

    normalized_relative_path: str = relative_path.replace('\\', '/')

    # 按照预设的仓库顺序查找
    for repo_name, repo_base_path in ordered_repo_paths:
        potential_path: Path = Path(repo_base_path) / normalized_relative_path
        try:
            if potential_path.is_file():
                return str(potential_path)
        except OSError:
            continue # 忽略路径访问错误
        except Exception as e:
             log_message(f"回退查找时发生意外错误 ({repo_name}): {e}", "WARNING")
             continue

    return None

def get_physical_path(entry: OrderedDict) -> Optional[str]:
    """
    获取 JSON 条目对应的物理文件路径。
    优先使用 'storagebox' 字段，失败则回退查找。

    Args:
        entry: 单条 JSON 数据 (OrderedDict)。

    Returns:
        文件的绝对物理路径，或 None。
    """
    # 类型检查由调用者或类型提示保证
    # if not isinstance(entry, dict) or 'path' not in entry:
    #     return None

    relative_path: str = entry.get('path', '').replace('\\', '/')
    storagebox: Optional[str] = entry.get('storagebox')

    # 尝试使用 storagebox 字段定位
    if storagebox and isinstance(storagebox, str) and storagebox in all_repo_paths:
        base_path: str = all_repo_paths[storagebox]
        potential_path: Path = Path(base_path) / relative_path
        try:
            if potential_path.is_file():
                return str(potential_path)
            else:
                log_message(f"警告：storagebox '{storagebox}' 指向的文件不存在: {potential_path}，尝试回退查找。", "WARNING")
        except OSError as e:
            log_message(f"警告：访问 storagebox 指向路径时出错 ({e})，尝试回退查找。", "WARNING")
        except Exception as e:
             log_message(f"检查 storagebox 路径时发生意外错误 ({storagebox}): {e}", "WARNING")

    elif storagebox:
        log_message(f"警告：记录 '{relative_path}' 的 storagebox '{storagebox}' 无效或未在仓库列表中，尝试回退查找。", "WARNING")

    # 执行回退查找
    return find_physical_path_fallback(relative_path)

def clear_find_path_cache() -> None:
    """清空物理路径查找缓存"""
    find_physical_path_fallback.cache_clear()
    log_message("文件路径查找缓存已清空。")

def calculate_file_md5(file_path: Optional[str]) -> Optional[str]:
    """
    计算文件的 MD5 哈希值。

    Args:
        file_path: 文件的绝对路径。

    Returns:
        MD5 字符串，或 None。
    """
    if not file_path or not is_file(file_path):
        return None

    hasher: hashlib._Hash = hashlib.md5()
    buffer_size: int = 65536 # 64 KB

    try:
        with open(file_path, 'rb') as afile:
            while True:
                buf: bytes = afile.read(buffer_size)
                if not buf:
                    break
                hasher.update(buf)
        return hasher.hexdigest()
    except FileNotFoundError:
        log_message(f"计算文件 MD5 失败: 文件未找到 {os.path.basename(file_path)}", "ERROR")
        return None
    except PermissionError:
        log_message(f"计算文件 MD5 失败: 无权限访问 {os.path.basename(file_path)}", "ERROR")
        return None
    except OSError as e:
        log_message(f"计算文件 MD5 时发生 OS 错误: {os.path.basename(file_path)} - {e}", "ERROR")
        return None
    except Exception as e:
        log_message(f"计算文件 MD5 时发生未知错误: {os.path.basename(file_path)} - {e}", "ERROR")
        return None

def generate_gid(length: int = GID_LENGTH) -> str:
    """
    生成指定长度的纯数字 GID，确保首位非零。

    Args:
        length: GID 的长度。

    Returns:
        生成的 GID 字符串。
    """
    if length <= 0:
        return ''
    # 确保第一位是 1-9
    first_digit: str = str(random.randint(1, 9))
    # 生成剩余的 length-1 位数字 (0-9)
    remaining_digits: str = ''.join(random.choice(string.digits) for _ in range(length - 1))
    return first_digit + remaining_digits

def escape_regex(string_to_escape: str) -> str:
    """转义字符串中的正则表达式特殊字符"""
    return re.escape(string_to_escape)

def run_in_thread(
    target_func: Callable,
    *args: Any,
    task_key: Optional[str] = None,
    on_start: Optional[Callable] = None,
    on_complete: Optional[Callable] = None,
    on_error: Optional[Callable] = None
) -> None:
    """
    在后台线程中运行函数，并处理 GUI 更新和状态。

    Args:
        target_func: 要在后台执行的函数。
        args: 传递给 target_func 的参数。
        task_key: 任务的唯一标识符，用于跟踪状态和取消。
        on_start: 任务开始时在主线程执行的回调。
        on_complete: 任务成功完成时在主线程执行的回调 (接收 target_func 的返回值)。
        on_error: 任务执行出错时在主线程执行的回调 (接收异常对象)。
    """
    if not main_repo_path:
        messagebox.showwarning("操作失败", "请先选择有效的主仓库根目录！")
        return

    # 检查任务是否已在运行
    if task_key and task_key in background_tasks and background_tasks[task_key].is_alive():
        log_message(f"任务 '{task_key}' 已在运行中。", "INFO")
        messagebox.showinfo("提示", f"'{task_key}' 任务已在运行中，请稍候。")
        return

    # 重置取消标志 (如果存在)
    if task_key and task_key in task_cancel_flags:
        task_cancel_flags[task_key].set(False)

    # --- 线程包装函数 ---
    def thread_wrapper(
        func_key: Optional[str],
        target: Callable,
        func_args: Tuple[Any, ...],
        start_cb: Optional[Callable],
        complete_cb: Optional[Callable],
        error_cb: Optional[Callable]
    ) -> None:
        """包装目标函数，处理状态更新和回调"""
        start_time: float = time.time()
        task_name: str = func_key or target.__name__

        # 更新状态为 "运行中" (主线程)
        if func_key and func_key in task_status_vars and app_instance:
            app_instance.after(0, lambda key=func_key: task_status_vars[key].set("运行中..."))
        # 执行 on_start 回调 (主线程)
        if start_cb and app_instance:
            app_instance.after(0, start_cb)

        try:
            log_message(f"后台任务 '{task_name}' 开始执行...")
            # 执行目标函数
            result: Any = target(*func_args)

            # 检查任务是否在中途被取消
            if func_key and func_key in task_cancel_flags and task_cancel_flags[func_key].get():
                raise InterruptedError("任务被用户取消")

            log_message(f"后台任务 '{task_name}' 执行完成。")
            # 执行 on_complete 回调 (主线程)
            if complete_cb and app_instance:
                app_instance.after(0, lambda res=result: complete_cb(res))
            # 更新状态为 "完成" (主线程)
            if func_key and func_key in task_status_vars and app_instance:
                elapsed: float = time.time() - start_time
                app_instance.after(0, lambda key=func_key, t=elapsed: task_status_vars[key].set(f"完成 (耗时: {t:.2f}s)"))

        except InterruptedError:
            log_message(f"后台任务 '{task_name}' 被取消。", "WARNING")
            # 更新状态为 "已取消" (主线程)
            if func_key and func_key in task_status_vars and app_instance:
                app_instance.after(0, lambda key=func_key: task_status_vars[key].set("已取消"))

        except Exception as e:
            log_message(f"后台任务 '{task_name}' 执行出错: {e}", "ERROR")
            logging.exception(f"后台任务 '{task_name}' 异常详情:") # 记录详细堆栈
            # 执行 on_error 回调 (主线程)
            if error_cb and app_instance:
                app_instance.after(0, lambda err=e: error_cb(err))
            # 更新状态为 "错误" (主线程)
            if func_key and func_key in task_status_vars and app_instance:
                app_instance.after(0, lambda key=func_key: task_status_vars[key].set("错误!"))

        finally:
            # 清理任务记录
            if func_key and func_key in background_tasks:
                # 加锁确保线程安全地访问共享字典
                with threading.Lock():
                    if func_key in background_tasks:
                         del background_tasks[func_key]
            # 重置进度条 (主线程)
            if func_key and func_key in task_progress_vars and app_instance:
                app_instance.after(0, lambda key=func_key: task_progress_vars[key].set(0))
    # --- 线程包装函数结束 ---

    # 创建并启动线程
    thread: threading.Thread = threading.Thread(
        target=thread_wrapper,
        args=(task_key, target_func, args, on_start, on_complete, on_error),
        daemon=True # 主程序退出时线程也退出
    )
    if task_key:
        # 加锁确保线程安全地访问共享字典
        with threading.Lock():
            background_tasks[task_key] = thread
    thread.start()

def update_gui_from_queue(log_textbox: Optional[ctk.CTkTextbox]) -> None:
    """定期从日志队列中获取消息并更新日志文本框"""
    global app_instance, app_running
    try:
        while not log_queue.empty():
            message: str = log_queue.get_nowait()
            if log_textbox and log_textbox.winfo_exists():
                log_textbox.configure(state=tk.NORMAL) # 启用编辑
                log_textbox.insert(tk.END, message)
                log_textbox.see(tk.END) # 滚动到底部
                log_textbox.configure(state=tk.DISABLED) # 禁用编辑
    except queue.Empty:
        pass # 队列为空
    except tk.TclError as e:
        # 窗口销毁时可能出现 TclError
        if "invalid command name" not in str(e).lower():
             print(f"更新日志文本框时出错: {e}") # 打印到控制台
    except Exception as e:
        print(f"更新日志时发生未知错误: {e}") # 打印到控制台
    finally:
        # 只要应用还在运行，就继续调度
        if app_running and app_instance and app_instance.winfo_exists():
            app_instance.after(100, lambda: update_gui_from_queue(log_textbox))

# --- locale 感知排序辅助 ---
# 尝试设置 locale 以支持更自然的中文排序
try:
    # 优先尝试系统默认 locale
    locale.setlocale(locale.LC_COLLATE, '')
    current_locale: Tuple[Optional[str], Optional[str]] = locale.getlocale(locale.LC_COLLATE)
    log_message(f"使用系统默认 locale 进行排序: {current_locale}", "INFO")
    # 检查是否是中文环境，如果不是，再尝试特定中文 locale
    if current_locale[0] is None or not current_locale[0].lower().startswith('zh'):
         raise locale.Error("系统默认非中文环境")
except locale.Error:
    try:
        locale.setlocale(locale.LC_COLLATE, 'zh_CN.UTF-8')
        log_message("使用 locale 'zh_CN.UTF-8' 进行排序。", "INFO")
    except locale.Error:
        try:
            # Windows 下可能需要不同的名称
            locale.setlocale(locale.LC_COLLATE, 'chinese-simplified')
            log_message("使用 locale 'chinese-simplified' 进行排序。", "INFO")
        except locale.Error:
            try:
                locale.setlocale(locale.LC_COLLATE, 'en_US.UTF-8')
                log_message("使用 locale 'en_US.UTF-8' 进行排序。", "INFO")
            except locale.Error:
                log_message("无法设置 locale 用于排序，将使用默认字符串排序。", "WARNING")

# --- 功能页面 Frame 类 ---

class DataListFrame(ctk.CTkFrame):
    """数据显示与编辑页面"""
    def __init__(self, master: ctk.CTk, app: 'GuGuNiuApp'):
        super().__init__(master, fg_color="transparent")
        self.app: 'GuGuNiuApp' = app
        self.treeview: Optional[ttk.Treeview] = None
        self.vsb: Optional[ctk.CTkScrollbar] = None # 垂直滚动条
        self.hsb: Optional[ctk.CTkScrollbar] = None # 水平滚动条
        self.filter_vars: Dict[str, tk.BooleanVar] = {} # 存储复选框变量
        self.search_var: tk.StringVar = tk.StringVar()
        self.game_filter_var: tk.StringVar = tk.StringVar(value="") # 存储游戏过滤选项的显示值
        self.status_bar_label_var: tk.StringVar = tk.StringVar(value="当前显示: 0 条 / 总计: 0 条")
        self._debounce_timer: Optional[str] = None # 用于搜索框输入的防抖计时器
        self.hover_iid: Optional[str] = None # 当前鼠标悬停的 Treeview item ID
        self.hover_after_id: Optional[str] = None # 悬停预览的 after 调用 ID
        self.treeview_font: ctk.CTkFont = ctk.CTkFont(size=11) # Treeview 行字体
        self.treeview_heading_font: ctk.CTkFont = ctk.CTkFont(size=12, weight="bold") # Treeview 表头字体
        self._last_sort_column: Optional[str] = None # 上次排序的列
        self._last_sort_reverse: bool = False # 上次排序的方向

        # 内部游戏值与显示名称的映射
        self.game_options_map: Dict[str, str] = OrderedDict([
            ("--所有游戏--", ""),
            ("原神", "gs-character"),
            ("星铁", "sr-character"),
            ("绝区零", "zzz-character"),
            ("鸣潮", "waves-character"),
            ("未知来源", "unknown") # 特殊值
        ])

        self.create_widgets()
        self.setup_treeview_style()
        # 初始加载数据
        if main_repo_path:
            self.apply_filters()

    def create_widgets(self) -> None:
        """创建页面上的所有控件"""
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # --- 过滤区域 ---
        filter_frame: ctk.CTkFrame = ctk.CTkFrame(self)
        filter_frame.grid(row=0, column=0, padx=10, pady=(10, 5), sticky="ew")
        filter_frame.grid_columnconfigure(1, weight=1) # 让搜索框可以伸展

        # 顶行过滤 (游戏 + 搜索 + 状态)
        top_filter_row: ctk.CTkFrame = ctk.CTkFrame(filter_frame, fg_color="transparent")
        top_filter_row.pack(fill="x", pady=(0, 5))
        top_filter_row.grid_columnconfigure(1, weight=1) # 搜索框伸展

        # 游戏过滤下拉菜单
        game_display_names: List[str] = list(self.game_options_map.keys())
        game_menu: ctk.CTkOptionMenu = ctk.CTkOptionMenu(
            top_filter_row,
            variable=self.game_filter_var,
            values=game_display_names,
            command=lambda choice: self.apply_filters() # 值变化时直接应用过滤器
        )
        game_menu.grid(row=0, column=0, padx=(0, 10))
        self.game_filter_var.set(game_display_names[0]) # 默认选第一个

        # 搜索框
        search_entry: ctk.CTkEntry = ctk.CTkEntry(top_filter_row, textvariable=self.search_var, placeholder_text="搜索角色名/文件名/GID...")
        search_entry.grid(row=0, column=1, padx=5, sticky="ew")
        search_entry.bind("<KeyRelease>", lambda event: self.debounce_filter())

        # 状态标签
        status_label: ctk.CTkLabel = ctk.CTkLabel(top_filter_row, textvariable=self.status_bar_label_var, anchor="e")
        status_label.grid(row=0, column=2, padx=(10, 0))

        # 属性过滤复选框行
        attr_filter_row: ctk.CTkFrame = ctk.CTkFrame(filter_frame, fg_color="transparent")
        attr_filter_row.pack(fill="x")
        filter_options: List[Tuple[str, str]] = [
            ("Px18", "isPx18"), ("Rx18", "isRx18"), ("人像", "layout_normal"),
            ("全屏", "layout_fullscreen"), ("彩蛋", "isEasterEgg"),
            ("AI图", "isAiImage"), ("封禁中", "isBan")
        ]
        for i, (text, key) in enumerate(filter_options):
            var: tk.BooleanVar = tk.BooleanVar(value=False)
            cb: ctk.CTkCheckBox = ctk.CTkCheckBox(attr_filter_row, text=text, variable=var, command=self.apply_filters)
            cb.grid(row=0, column=i, padx=8, pady=5, sticky="w")
            self.filter_vars[key] = var

        # --- Treeview 区域 ---
        tree_container: ctk.CTkFrame = ctk.CTkFrame(self, fg_color="transparent")
        tree_container.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="nsew")
        tree_container.grid_rowconfigure(0, weight=1)
        tree_container.grid_columnconfigure(0, weight=1)

        # Treeview
        self.treeview = ttk.Treeview(tree_container, show="headings", selectmode="browse")
        self.treeview.grid(row=0, column=0, sticky="nsew")

        # 滚动条
        self.vsb = ctk.CTkScrollbar(tree_container, command=self.treeview.yview)
        self.vsb.grid(row=0, column=1, sticky="ns")
        self.treeview.configure(yscrollcommand=self.vsb.set)

        self.hsb = ctk.CTkScrollbar(tree_container, command=self.treeview.xview, orientation="horizontal")
        self.hsb.grid(row=1, column=0, columnspan=2, sticky="ew")
        self.treeview.configure(xscrollcommand=self.hsb.set)

        # 定义列
        columns: Tuple[str, ...] = ("Storagebox", "GID", "Folder", "Filename", "MD5", "Path", "Timestamp")
        self.treeview["columns"] = columns
        self.treeview.column("#0", width=0, stretch=tk.NO) # 隐藏第一列

        # 设置列属性
        col_configs: Dict[str, Dict[str, Any]] = {
            "Storagebox": {"width": 140, "minwidth": 100},
            "GID": {"width": 120, "minwidth": 100},
            "Folder": {"width": 150, "minwidth": 120},
            "Filename": {"width": 250, "minwidth": 180},
            "MD5": {"width": 240, "minwidth": 200, "sortable": False}, # MD5 通常不排序
            "Path": {"width": 350, "minwidth": 250},
            "Timestamp": {"width": 140, "minwidth": 120, "reverse_default": True} # 时间戳默认降序
        }
        col_display_names: Dict[str, str] = {
            "Storagebox": "所在仓库", "GID": "GID", "Folder": "文件夹",
            "Filename": "文件名", "MD5": "MD5", "Path": "相对路径", "Timestamp": "时间戳"
        }

        for col_id in columns:
            cfg = col_configs.get(col_id, {})
            self.treeview.column(col_id, anchor=tk.W, width=cfg.get("width", 100), minwidth=cfg.get("minwidth", 80), stretch=tk.NO)
            sortable = cfg.get("sortable", True)
            command = partial(self.sort_column, col_id, cfg.get("reverse_default", False)) if sortable else None
            self.treeview.heading(col_id, text=col_display_names.get(col_id, col_id), anchor=tk.W, command=command)


        # 绑定事件
        self.treeview.bind("<Double-1>", self.on_item_double_click)
        self.treeview.bind("<Motion>", self.on_mouse_motion)
        self.treeview.bind("<Leave>", self.on_mouse_leave)

    def setup_treeview_style(self) -> None:
        """配置 Treeview 的外观样式"""
        style: ttk.Style = ttk.Style()
        style.theme_use("default") # 基础主题

        # 配置表头样式
        style.configure("Treeview.Heading",
                        font=self.treeview_heading_font,
                        background="#EAEAEA", foreground="black",
                        relief="flat", padding=(5, 5))
        style.map("Treeview.Heading", background=[('active', '#D5D5D5')])

        # 配置行样式
        style.configure("Treeview",
                        font=self.treeview_font,
                        background="white", fieldbackground="white", foreground="black",
                        rowheight=25)
        # 配置选中行样式
        style.map('Treeview',
                  background=[('selected', '#3470B6')], foreground=[('selected', 'white')])

        # 定义行标签样式
        self.treeview.tag_configure('oddrow', background='#F7F7F7')
        self.treeview.tag_configure('evenrow', background='white')
        self.treeview.tag_configure('missing', foreground='red') # 文件缺失标记
        self.treeview.tag_configure('banned', foreground='orange') # 封禁标记

    def sort_column(self, col: str, reverse_default: bool) -> None:
        """
        点击列标题时对 Treeview 进行排序。

        Args:
            col: 要排序的列 ID。
            reverse_default: 该列默认是否降序。
        """
        if not self.treeview: return

        # 获取当前所有显示的行 (iid)
        items_iid: List[str] = list(self.treeview.get_children(''))
        if not items_iid: return # 没有数据可排序

        # 获取排序所需的值
        items_data: List[Tuple[Any, str]] = []
        for k in items_iid:
            try:
                # 尝试从 Treeview 获取值，如果失败（例如列不存在），则从缓存获取
                val = self.treeview.set(k, col)
            except tk.TclError:
                 entry = image_data_map.get(k)
                 if entry:
                      if col == "Folder": val = entry.get('attributes', {}).get('parentFolder', '')
                      elif col == "Filename": val = entry.get('attributes', {}).get('filename', '')
                      elif col == "Timestamp": val = entry.get('timestamp', '') # 使用原始 ISO 字符串排序
                      elif col == "Storagebox": val = entry.get('storagebox', '')
                      elif col == "Path": val = entry.get('path', '')
                      elif col == "GID": val = entry.get('gid', '')
                      else: val = '' # 其他列或获取失败
                 else: val = ''
            items_data.append((val, k))


        # 确定排序方向
        reverse: bool
        if col == self._last_sort_column:
            reverse = not self._last_sort_reverse
        else:
            reverse = reverse_default

        # 定义排序键函数
        key_func: Callable
        try:
            if col == "GID": # GID 按数字排序
                key_func = lambda item: int(str(item[0])) if str(item[0]).isdigit() else float('inf')
            elif col == "Timestamp": # 时间戳按字符串排序即可
                 key_func = lambda item: str(item[0])
            else: # 默认按字符串排序 (使用 locale 感知)
                key_func = lambda item: locale.strxfrm(str(item[0]))

            items_data.sort(key=key_func, reverse=reverse)

        except ValueError:
             log_message(f"排序警告：列 '{col}' 包含无法转换的值，使用字符串排序。", "WARNING")
             items_data.sort(key=lambda item: locale.strxfrm(str(item[0])), reverse=reverse)
        except Exception as e:
             log_message(f"排序时发生错误: {e}", "ERROR")
             items_data.sort(key=lambda item: locale.strxfrm(str(item[0])), reverse=reverse) # 出错时回退

        # 重新插入排序后的行
        for index, (val, k) in enumerate(items_data):
            self.treeview.move(k, '', index)

        # 更新最后排序状态
        self._last_sort_column = col
        self._last_sort_reverse = reverse

        # 更新列标题指示器
        for c in self.treeview["columns"]:
            current_text = self.treeview.heading(c)['text']
            # 移除旧箭头
            cleaned_text = current_text.replace(' ▲', '').replace(' ▼', '')
            self.treeview.heading(c, text=cleaned_text)
        # 添加新箭头
        arrow: str = ' ▲' if not reverse else ' ▼'
        current_heading_text = self.treeview.heading(col)['text']
        self.treeview.heading(col, text=current_heading_text + arrow)

        # 重新应用隔行变色
        self.apply_row_tags()

    def apply_row_tags(self) -> None:
        """为 Treeview 中的行应用隔行变色和特殊状态标签"""
        if not self.treeview: return
        children: Tuple[str, ...] = self.treeview.get_children('')
        for i, iid in enumerate(children):
            # 获取当前标签，准备更新
            try:
                current_tags: List[str] = list(self.treeview.item(iid, 'tags'))
            except tk.TclError:
                 continue # 项目可能在处理期间消失

            # 移除旧的行样式标签
            new_tags = [tag for tag in current_tags if tag not in ('oddrow', 'evenrow')]

            # 添加新的隔行变色标签
            row_tag: str = 'oddrow' if i % 2 != 0 else 'evenrow'
            new_tags.append(row_tag)

            # 检查是否需要添加 'banned' 标签
            entry: Optional[OrderedDict] = image_data_map.get(iid)
            is_banned: bool = entry.get('attributes', {}).get('isBan', False) if entry else False
            if is_banned:
                if 'banned' not in new_tags:
                    new_tags.append('banned')
            elif 'banned' in new_tags:
                 new_tags.remove('banned')

            # 应用最终的标签列表
            try:
                self.treeview.item(iid, tags=tuple(new_tags))
            except tk.TclError:
                 continue # 项目可能在处理期间消失

    def debounce_filter(self) -> None:
        """搜索框输入的防抖处理"""
        if self._debounce_timer:
            self.after_cancel(self._debounce_timer)
        self._debounce_timer = self.after(300, self.apply_filters) # 300ms 延迟

    def apply_filters(self) -> None:
        """应用所有过滤器并刷新 Treeview"""
        if not main_repo_path:
            log_message("无法应用过滤器：主仓库未设置。", "WARNING")
            self.populate_treeview([])
            return

        search_term: str = self.search_var.get().lower().strip()
        selected_game_display: str = self.game_filter_var.get()
        game_value: str = self.game_options_map.get(selected_game_display, "") # 获取对应的内部值

        active_filters: Dict[str, bool] = {key: var.get() for key, var in self.filter_vars.items()}

        log_message(f"应用过滤器: 搜索='{search_term}', 游戏='{game_value}', 属性={active_filters}", "DEBUG")

        filtered_data: List[OrderedDict] = []
        known_games: Set[str] = {"gs-character", "sr-character", "zzz-character", "waves-character"}

        # 优化: 预先计算需要检查的属性过滤器
        active_attr_keys = {key for key, active in active_filters.items() if active}

        for entry in image_data_cache:
            # 基本检查
            if not isinstance(entry, dict): continue

            attrs: Dict[str, Any] = entry.get('attributes', {})
            source_gallery: str = entry.get('sourceGallery', '')

            # 1. 游戏过滤
            if game_value:
                if game_value == "unknown":
                    if source_gallery in known_games: continue
                elif source_gallery != game_value: continue

            # 2. 搜索过滤
            if search_term:
                # 优化搜索逻辑
                search_fields = [
                    attrs.get('filename', ''),
                    str(entry.get('gid', '')),
                    entry.get('characterName', ''),
                    entry.get('path', '') # 也搜索相对路径
                ]
                if not any(search_term in field.lower() for field in search_fields):
                    continue

            # 3. 属性过滤
            if active_attr_keys: # 仅在有激活的属性过滤器时检查
                filter_passed = True
                for key in active_attr_keys:
                    attr_value = attrs.get(key)
                    # 处理特殊 key
                    if key == "isPx18" and not attr_value: filter_passed = False; break
                    if key == "isRx18" and not attr_value: filter_passed = False; break
                    if key == "layout_normal" and attrs.get("layout") != "normal": filter_passed = False; break
                    if key == "layout_fullscreen" and attrs.get("layout") != "fullscreen": filter_passed = False; break
                    if key == "isEasterEgg" and not attr_value: filter_passed = False; break
                    if key == "isAiImage" and not attr_value: filter_passed = False; break
                    if key == "isBan" and not attr_value: filter_passed = False; break
                    # 可以扩展其他 bool 类型的属性检查

                if not filter_passed: continue

            # 通过所有过滤器
            filtered_data.append(entry)

        # 使用过滤后的数据填充 Treeview
        self.populate_treeview(filtered_data)

    def populate_treeview(self, data: List[OrderedDict]) -> None:
        """
        用给定的数据填充 Treeview。

        Args:
            data: 过滤和排序后的数据列表。
        """
        if not self.treeview: return

        # 清空现有内容
        try:
            self.treeview.delete(*self.treeview.get_children())
        except tk.TclError:
            log_message("清空 Treeview 时出错 (可能已为空)", "WARNING")

        display_count: int = 0
        total_count: int = len(data)

        # 插入数据行 (排序已在 apply_filters 中完成)
        for i, entry in enumerate(data):
            if display_count >= TREEVIEW_DISPLAY_LIMIT:
                log_message(f"数据列表达到显示上限 ({TREEVIEW_DISPLAY_LIMIT})，部分数据未显示。", "WARNING")
                break

            if not isinstance(entry, dict): continue

            attrs: Dict[str, Any] = entry.get('attributes', {})
            storagebox: str = entry.get('storagebox', '未知')
            gid: str = str(entry.get('gid', 'N/A')) # 确保是字符串
            folder: str = attrs.get('parentFolder', '未知')
            filename: str = attrs.get('filename', '未知')
            md5: str = attrs.get('md5', 'N/A')
            path_val: str = entry.get('path', '未知').replace('\\', '/')
            timestamp_iso: str = entry.get('timestamp', '')
            timestamp_str: str = self.format_iso_timestamp(timestamp_iso)

            # 使用相对路径作为 item ID
            iid: str = path_val
            if not iid: continue

            # 准备行数据
            values: Tuple[str, ...] = (storagebox, gid, folder, filename, md5, path_val, timestamp_str)

            # 插入行 (标签在之后统一应用)
            try:
                self.treeview.insert(parent="", index="end", iid=iid, text="", values=values)
                display_count += 1
            except tk.TclError as e:
                 if "item" in str(e) and "already exists" in str(e):
                     log_message(f"警告：尝试插入重复 iid 到 Treeview: {iid}", "WARNING")
                 else:
                     log_message(f"插入 Treeview 项时出错: {e} (iid: {iid})", "ERROR")
                 continue

        # 更新状态栏
        self.status_bar_label_var.set(f"当前显示: {display_count} 条 / 总计: {total_count} 条")
        log_message(f"数据列表已刷新，显示 {display_count} 条。")

        # 统一应用行标签
        self.apply_row_tags()

        # 可以在这里调用 self.adjust_column_widths() 如果需要的话

    def adjust_column_widths(self) -> None:
        """根据内容自动调整 Treeview 列宽 (可选调用)"""
        if not self.treeview: return

        padding: int = 20 # 额外边距
        min_col_width: int = 80 # 最小列宽

        try:
            font_measure: tkFont.Font = tkFont.Font(font=self.treeview_font.cget("family"), size=self.treeview_font.cget("size"))
            heading_font_measure: tkFont.Font = tkFont.Font(font=self.treeview_heading_font.cget("family"), size=self.treeview_heading_font.cget("size"), weight=self.treeview_heading_font.cget("weight"))
        except tk.TclError:
             log_message("调整列宽失败：无法获取字体信息。", "ERROR")
             return

        for col_id in self.treeview["columns"]:
            try:
                # 计算标题宽度 (移除排序箭头)
                heading_text: str = self.treeview.heading(col_id)["text"].replace(' ▲', '').replace(' ▼', '')
                max_width: int = heading_font_measure.measure(heading_text)

                # 遍历可见行计算内容最大宽度 (优化：可限制检查行数)
                items_to_check: Tuple[str, ...] = self.treeview.get_children('')
                # items_to_check = items_to_check[:500] # 限制检查行数

                for item_iid in items_to_check:
                    try:
                        cell_value: str = self.treeview.set(item_iid, col_id)
                        if cell_value:
                            col_width: int = font_measure.measure(str(cell_value))
                            max_width = max(max_width, col_width)
                    except tk.TclError: continue # 项目不存在
                    except Exception as e: log_message(f"测量单元格宽度时出错 ({col_id}, {item_iid}): {e}", "WARNING")

                # 设置最终列宽
                final_width: int = max(min_col_width, max_width + padding)
                self.treeview.column(col_id, width=final_width, stretch=tk.NO)
            except tk.TclError as e:
                 log_message(f"设置或获取列 '{col_id}' 信息时出错: {e}", "ERROR")
            except Exception as e:
                 log_message(f"调整列宽时发生未知错误 ({col_id}): {e}", "ERROR")


        log_message("Treeview 列宽已根据内容调整。", "DEBUG")

    def on_mouse_motion(self, event: tk.Event) -> None:
        """处理鼠标在 Treeview 上移动事件，用于悬停预览"""
        global hover_after_id
        if hover_after_id:
            self.after_cancel(hover_after_id)
            hover_after_id = None
        self.hide_hover_preview()

        if not self.treeview: return
        iid: str = self.treeview.identify_row(event.y)
        if iid:
            self.hover_iid = iid
            hover_after_id = self.after(HOVER_DELAY_MS, lambda i=iid, x=event.x_root, y=event.y_root: self.trigger_hover_preview(i, x, y))
        else:
            self.hover_iid = None

    def on_mouse_leave(self, event: tk.Event) -> None:
        """处理鼠标离开 Treeview 事件"""
        global hover_after_id
        if hover_after_id:
            self.after_cancel(hover_after_id)
            hover_after_id = None
        self.hide_hover_preview()
        self.hover_iid = None

    def trigger_hover_preview(self, iid: str, x: int, y: int) -> None:
        """延迟时间到后，触发显示悬停预览"""
        # 再次检查鼠标是否还在同一行上
        if iid == self.hover_iid:
            entry_data: Optional[OrderedDict] = image_data_map.get(iid)
            if entry_data:
                physical_path: Optional[str] = get_physical_path(entry_data)
                if physical_path:
                    self.show_hover_preview(physical_path, x, y)
                # else: # 文件找不到的日志由 get_physical_path 处理
                #     log_message(f"悬停预览：找不到文件 '{entry_data.get('path')}'", "DEBUG")
            # else: # 数据找不到的日志由调用者处理或忽略
            #      log_message(f"悬停预览：找不到 iid '{iid}' 对应的数据", "WARNING")

    def show_hover_preview(self, image_path: str, x: int, y: int) -> None:
        """创建并显示悬停预览窗口"""
        global hover_preview_window
        self.hide_hover_preview() # 关闭旧窗口

        hover_preview_window = ctk.CTkToplevel(self.app)
        hover_preview_window.overrideredirect(True)
        hover_preview_window.attributes("-topmost", True)

        loading_label: ctk.CTkLabel = ctk.CTkLabel(hover_preview_window, text="加载中...",
                                     width=HOVER_PREVIEW_SIZE[0], height=HOVER_PREVIEW_SIZE[1],
                                     fg_color="gray80", text_color="black")
        loading_label.pack()

        hover_preview_window.geometry(f"+{x+15}+{y+10}")

        # 后台加载图片
        threading.Thread(target=self._load_hover_image, args=(image_path, hover_preview_window, loading_label), daemon=True).start()

    def _load_hover_image(self, image_path: str, window: ctk.CTkToplevel, label: ctk.CTkLabel) -> None:
        """后台线程加载悬停预览图片"""
        try:
            with Image.open(image_path) as img:
                img.thumbnail(HOVER_PREVIEW_SIZE, Image.Resampling.LANCZOS)
                img_size: Tuple[int, int] = img.size
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                # 传递 PIL Image 对象回主线程
                if self.app: # 确保 app 实例存在
                    self.app.after(0, self._create_and_update_hover_label, img.copy(), window, label, img_size)
        except FileNotFoundError:
             log_message(f"加载悬停预览失败: 文件未找到 {os.path.basename(image_path)}", "ERROR")
             if self.app: self.app.after(0, self._close_hover_window, window)
        except Exception as e:
            log_message(f"加载悬停预览失败: {os.path.basename(image_path)} - {e}", "ERROR")
            if self.app: self.app.after(0, self._close_hover_window, window)

    def _create_and_update_hover_label(self, img: Image.Image, window: ctk.CTkToplevel, label: ctk.CTkLabel, img_size: Tuple[int, int]) -> None:
         """在主线程创建 CTkImage 并更新悬停预览标签"""
         if window and window.winfo_exists() and label and label.winfo_exists():
             try:
                 ctk_image: ctk.CTkImage = ctk.CTkImage(light_image=img, dark_image=img, size=img_size)
                 label.configure(text="", image=ctk_image, width=img_size[0], height=img_size[1])
                 label.image = ctk_image # 存储引用
                 window.geometry(f"{img_size[0]}x{img_size[1]}")
             except Exception as e:
                  log_message(f"创建或更新悬停预览 CTkImage 失败: {e}", "ERROR")
                  self._close_hover_window(window)

    def hide_hover_preview(self) -> None:
        """隐藏并销毁悬停预览窗口"""
        global hover_preview_window
        if hover_preview_window and hover_preview_window.winfo_exists():
            try:
                hover_preview_window.destroy()
            except tk.TclError: pass # 忽略窗口已销毁的错误
        hover_preview_window = None

    def _close_hover_window(self, window: Optional[ctk.CTkToplevel]) -> None:
         """安全地关闭指定的悬停窗口"""
         global hover_preview_window
         if window and window.winfo_exists():
             try:
                 window.destroy()
             except tk.TclError: pass
         if window == hover_preview_window:
             hover_preview_window = None

    def format_iso_timestamp(self, iso_str: str) -> str:
        """将 ISO 8601 时间戳字符串格式化为 'YYYY-MM-DD HH:MM'"""
        if not iso_str: return "N/A"
        try:
            # 尝试解析带 Z 或时区偏移的 ISO 格式
            dt: datetime = datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
            # 直接显示 UTC 时间或本地时间
            return dt.strftime('%Y-%m-%d %H:%M') # 显示 UTC
            # dt_local = dt.astimezone(None) # 转为本地时区
            # return dt_local.strftime('%Y-%m-%d %H:%M') # 显示本地
        except ValueError:
            # 尝试解析其他常见格式
            for fmt in ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%d %H:%M:%S'):
                 try:
                     dt = datetime.strptime(iso_str, fmt)
                     return dt.strftime('%Y-%m-%d %H:%M')
                 except ValueError:
                     continue
            log_message(f"无法解析的时间戳格式: {iso_str}", "DEBUG")
            return iso_str # 返回原始字符串
        except Exception as e:
             log_message(f"格式化时间戳时出错: {iso_str} - {e}", "WARNING")
             return iso_str

    def on_item_double_click(self, event: tk.Event) -> None:
        """处理 Treeview 项双击事件，打开编辑模态框"""
        if not self.treeview: return
        item_id: str = self.treeview.focus()
        if not item_id: return

        entry_data: Optional[OrderedDict] = image_data_map.get(item_id)
        if entry_data:
            log_message(f"双击编辑: {item_id}", "INFO")
            self.open_edit_modal(entry_data)
        else:
            log_message(f"双击编辑错误：无法在 image_data_map 中找到 iid '{item_id}'", "ERROR")
            messagebox.showerror("错误", "无法找到选定项的数据。缓存可能已过期。")

    def open_edit_modal(self, entry_data: OrderedDict) -> None:
        """打开或激活编辑属性的模态窗口"""
        if self.app.edit_modal and self.app.edit_modal.winfo_exists():
            self.app.edit_modal.update_data(entry_data)
            self.app.edit_modal.lift()
            self.app.edit_modal.focus()
        else:
            self.app.edit_modal = EditAttributeModal(self.app, entry_data, self.refresh_data_list)

    def refresh_data_list(self) -> None:
        """在编辑保存后刷新数据列表"""
        log_message("检测到数据更改，刷新列表...")
        self.apply_filters() # 重新应用过滤器即可

    def on_activate(self) -> None:
        """当此 Frame 被激活时调用"""
        log_message("数据列表页面已激活。")
        if not main_repo_path:
            log_message("数据列表：主仓库未设置，列表为空。", "WARNING")
            self.populate_treeview([])
            return

        # 检查缓存是否为空
        if not image_data_cache:
            log_message("数据列表：内存缓存为空，尝试从文件重载...", "WARNING")
            if initialize_paths_and_data(main_repo_path):
                self.apply_filters()
            else:
                log_message("数据列表：重载数据失败。", "ERROR")
                self.populate_treeview([])
        else:
            # 缓存非空，直接应用过滤器刷新显示
            self.apply_filters()

    def reset_ui(self) -> None:
        """重置 UI 元素到初始状态"""
        self.search_var.set("")
        self.game_filter_var.set(list(self.game_options_map.keys())[0]) # 重置游戏过滤器
        for var in self.filter_vars.values():
            var.set(False) # 重置属性过滤器
        if self.treeview:
            try:
                self.treeview.delete(*self.treeview.get_children())
            except tk.TclError: pass
        self.status_bar_label_var.set("当前显示: 0 条 / 总计: 0 条")
        self.hide_hover_preview()
        self._last_sort_column = None # 重置排序状态
        self._last_sort_reverse = False
        # 清除 Treeview 表头的排序箭头
        if self.treeview:
            for c in self.treeview["columns"]:
                 try:
                     current_text = self.treeview.heading(c)['text']
                     cleaned_text = current_text.replace(' ▲', '').replace(' ▼', '')
                     self.treeview.heading(c, text=cleaned_text)
                 except tk.TclError: pass # 忽略错误
        log_message("数据列表页面 UI 已重置。")

# --- 编辑属性模态框 (EditAttributeModal) ---
class EditAttributeModal(ctk.CTkToplevel):
    """编辑图片属性的模态窗口"""
    def __init__(self, master: ctk.CTk, entry_data: OrderedDict, refresh_callback: Callable):
        super().__init__(master)
        self.app: 'GuGuNiuApp' = master # 主应用实例
        self.entry_data_original: Optional[OrderedDict] = None # 原始数据副本
        self.refresh_callback: Callable = refresh_callback # 刷新主列表的回调
        self.data_changed: bool = False # 标记数据是否更改

        self.title("编辑图片属性")
        self.geometry("550x520") # 调整尺寸
        self.resizable(False, False)
        self.transient(master)
        self.grab_set() # 独占焦点

        # --- 变量 ---
        self.storagebox_var: tk.StringVar = tk.StringVar()
        self.rating_var: tk.StringVar = tk.StringVar() # 'none', 'px18', 'rx18'
        self.layout_var: tk.StringVar = tk.StringVar() # 'normal', 'fullscreen', 'catcake'
        self.easteregg_var: tk.BooleanVar = tk.BooleanVar()
        self.ai_var: tk.BooleanVar = tk.BooleanVar()
        self.ban_var: tk.BooleanVar = tk.BooleanVar()
        self.message_var: tk.StringVar = tk.StringVar() # 状态/错误消息

        # --- 布局 ---
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1) # 让表单区域可扩展

        # --- 顶部信息区 ---
        info_frame: ctk.CTkFrame = ctk.CTkFrame(self, fg_color="transparent")
        info_frame.grid(row=0, column=0, padx=20, pady=(20, 10), sticky="ew")
        self.filename_label: ctk.CTkLabel = ctk.CTkLabel(info_frame, text="文件名: N/A", anchor="w")
        self.filename_label.pack(fill="x")
        self.path_label: ctk.CTkLabel = ctk.CTkLabel(info_frame, text="路径: N/A", anchor="w", wraplength=500)
        self.path_label.pack(fill="x", pady=(5, 0))
        self.charname_label: ctk.CTkLabel = ctk.CTkLabel(info_frame, text="角色名: N/A", anchor="w")
        self.charname_label.pack(fill="x", pady=(5, 0))
        self.source_label: ctk.CTkLabel = ctk.CTkLabel(info_frame, text="来源: N/A", anchor="w")
        self.source_label.pack(fill="x", pady=(5, 0))

        # --- 中间表单区 ---
        form_frame: ctk.CTkFrame = ctk.CTkFrame(self)
        form_frame.grid(row=1, column=0, padx=20, pady=10, sticky="nsew")
        form_frame.grid_columnconfigure(1, weight=1)

        row_idx: int = 0
        # 所在仓库
        ctk.CTkLabel(form_frame, text="所在仓库:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        repo_names: List[str] = sorted(list(all_repo_paths.keys()))
        self.storagebox_combo: ctk.CTkComboBox = ctk.CTkComboBox(form_frame, variable=self.storagebox_var, values=repo_names, state="readonly")
        self.storagebox_combo.grid(row=row_idx, column=1, padx=10, pady=10, sticky="ew")
        row_idx += 1

        # 限制级
        ctk.CTkLabel(form_frame, text="限制级:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        rating_frame: ctk.CTkFrame = ctk.CTkFrame(form_frame, fg_color="transparent")
        rating_frame.grid(row=row_idx, column=1, padx=10, pady=5, sticky="w")
        ctk.CTkRadioButton(rating_frame, text="无", variable=self.rating_var, value="none").pack(side="left", padx=5)
        ctk.CTkRadioButton(rating_frame, text="Px18", variable=self.rating_var, value="px18").pack(side="left", padx=5)
        ctk.CTkRadioButton(rating_frame, text="Rx18", variable=self.rating_var, value="rx18").pack(side="left", padx=5)
        row_idx += 1

        # 构图
        ctk.CTkLabel(form_frame, text="构图:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        layout_frame: ctk.CTkFrame = ctk.CTkFrame(form_frame, fg_color="transparent")
        layout_frame.grid(row=row_idx, column=1, padx=10, pady=5, sticky="w")
        ctk.CTkRadioButton(layout_frame, text="人像图", variable=self.layout_var, value="normal").pack(side="left", padx=5)
        ctk.CTkRadioButton(layout_frame, text="全屏图", variable=self.layout_var, value="fullscreen").pack(side="left", padx=5)
        ctk.CTkRadioButton(layout_frame, text="猫猫糕", variable=self.layout_var, value="catcake").pack(side="left", padx=5) # 添加猫猫糕选项
        row_idx += 1

        # 特殊属性
        ctk.CTkLabel(form_frame, text="特殊:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        special_frame: ctk.CTkFrame = ctk.CTkFrame(form_frame, fg_color="transparent")
        special_frame.grid(row=row_idx, column=1, padx=10, pady=5, sticky="w")
        ctk.CTkCheckBox(special_frame, text="彩蛋", variable=self.easteregg_var).pack(side="left", padx=5)
        ctk.CTkCheckBox(special_frame, text="AI图", variable=self.ai_var).pack(side="left", padx=5)
        ctk.CTkCheckBox(special_frame, text="封禁", variable=self.ban_var).pack(side="left", padx=5)
        row_idx += 1

        # GID (只读)
        ctk.CTkLabel(form_frame, text="GID:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        self.gid_entry: ctk.CTkEntry = ctk.CTkEntry(form_frame, state="readonly")
        self.gid_entry.grid(row=row_idx, column=1, padx=10, pady=10, sticky="ew")
        row_idx += 1

        # MD5 (只读)
        ctk.CTkLabel(form_frame, text="MD5:").grid(row=row_idx, column=0, padx=(0, 10), pady=10, sticky="w")
        self.md5_entry: ctk.CTkEntry = ctk.CTkEntry(form_frame, state="readonly")
        self.md5_entry.grid(row=row_idx, column=1, padx=10, pady=10, sticky="ew")
        row_idx += 1

        # --- 底部消息和按钮区 ---
        self.message_label: ctk.CTkLabel = ctk.CTkLabel(self, textvariable=self.message_var, text_color="red")
        self.message_label.grid(row=2, column=0, padx=20, pady=5, sticky="ew")

        button_frame: ctk.CTkFrame = ctk.CTkFrame(self, fg_color="transparent")
        button_frame.grid(row=3, column=0, padx=20, pady=(10, 20), sticky="e")
        ctk.CTkButton(button_frame, text="保存更改", command=self.save_changes).pack(side="left", padx=10)
        ctk.CTkButton(button_frame, text="取消", command=self.close_modal, fg_color="gray").pack(side="left")

        # --- 初始化数据并绑定关闭事件 ---
        self.update_data(entry_data)
        self.protocol("WM_DELETE_WINDOW", self.close_modal) # 处理点 X 关闭窗口

    def update_data(self, entry_data: OrderedDict) -> None:
        """
        用新的条目数据更新模态框的显示内容。

        Args:
            entry_data: 新的图片条目数据。
        """
        # 深拷贝原始数据，用于后续比较
        self.entry_data_original = json.loads(json.dumps(entry_data))
        self.data_changed = False
        self.message_var.set("") # 清空消息

        attrs: Dict[str, Any] = entry_data.get('attributes', {})
        storagebox_val: str = entry_data.get('storagebox', '')
        path_val: str = entry_data.get('path', 'N/A')
        filename_val: str = attrs.get('filename', 'N/A')
        charname_val: str = entry_data.get('characterName', 'N/A')
        source_val: str = entry_data.get('sourceGallery', 'N/A')
        gid_val: str = str(entry_data.get('gid', 'N/A'))
        md5_val: str = attrs.get('md5', 'N/A')

        # 更新顶部信息标签
        self.filename_label.configure(text=f"文件名: {filename_val}")
        self.path_label.configure(text=f"路径: {path_val}")
        self.charname_label.configure(text=f"角色名: {charname_val}")
        self.source_label.configure(text=f"来源: {source_val}")


        # 更新仓库下拉框
        repo_names: List[str] = sorted(list(all_repo_paths.keys()))
        self.storagebox_combo.configure(values=repo_names)
        if storagebox_val in repo_names:
            self.storagebox_var.set(storagebox_val)
        elif repo_names: # 如果原始值无效，默认选第一个
            self.storagebox_var.set(repo_names[0])
            log_message(f"编辑警告：原始 storagebox '{storagebox_val}' 无效，已自动选择 '{repo_names[0]}'", "WARNING")
        else: # 没有仓库可选
            self.storagebox_var.set('')

        # 更新限制级单选按钮
        rating_val: str = "none"
        if attrs.get("isPx18", False): rating_val = "px18"
        elif attrs.get("isRx18", False): rating_val = "rx18"
        self.rating_var.set(rating_val)

        # 更新构图单选按钮
        self.layout_var.set(attrs.get("layout", "normal")) # 默认 normal

        # 更新特殊属性复选框
        self.easteregg_var.set(attrs.get("isEasterEgg", False))
        self.ai_var.set(attrs.get("isAiImage", False))
        self.ban_var.set(attrs.get("isBan", False))

        # 更新只读字段 (GID, MD5)
        self.gid_entry.configure(state=tk.NORMAL)
        self.gid_entry.delete(0, tk.END)
        self.gid_entry.insert(0, gid_val)
        self.gid_entry.configure(state="readonly")

        self.md5_entry.configure(state=tk.NORMAL)
        self.md5_entry.delete(0, tk.END)
        self.md5_entry.insert(0, md5_val)
        self.md5_entry.configure(state="readonly")

    def save_changes(self) -> None:
        """保存用户所做的更改到内存缓存和 JSON 文件"""
        if not self.entry_data_original:
            log_message("保存错误：原始数据丢失", "ERROR")
            self.message_var.set("错误：无法找到原始数据！")
            return

        self.message_var.set("保存中...")
        self.update_idletasks() # 强制更新 UI

        original_path: Optional[str] = self.entry_data_original.get('path')
        if not original_path:
             log_message("保存错误：原始数据缺少路径", "ERROR")
             self.message_var.set("错误：原始数据路径丢失！")
             return

        # 在全局缓存中查找要更新的条目索引
        entry_index: int = -1
        for i, entry in enumerate(image_data_cache):
            if isinstance(entry, dict) and entry.get('path') == original_path:
                entry_index = i
                break

        if entry_index == -1:
            log_message(f"错误：无法在缓存中找到要更新的条目 (路径: {original_path})", "ERROR")
            self.message_var.set("错误：找不到原始数据！")
            return

        # 构建更新后的条目 (使用 OrderedDict 保持字段顺序)
        updated_entry: OrderedDict = OrderedDict()
        # 保留原始顺序，只更新需要更改的字段
        updated_entry['storagebox'] = self.storagebox_var.get()
        updated_entry['gid'] = self.entry_data_original.get('gid') # GID 不可编辑
        updated_entry['characterName'] = self.entry_data_original.get('characterName') # 角色名暂不可编辑
        updated_entry['path'] = self.entry_data_original.get('path') # 路径不可编辑

        # 构建更新后的 attributes (尽量保持原始顺序)
        updated_attrs: OrderedDict = OrderedDict()
        original_attrs: Dict[str, Any] = self.entry_data_original.get('attributes', {})
        # 定义期望的属性顺序
        attr_order: List[str] = ['filename', 'parentFolder', 'isPx18', 'isRx18', 'layout', 'isEasterEgg', 'isAiImage', 'isBan', 'md5', 'Downloaded_From']

        # 按期望顺序填充新属性字典
        for key in attr_order:
             if key == 'isPx18': updated_attrs[key] = (self.rating_var.get() == "px18")
             elif key == 'isRx18': updated_attrs[key] = (self.rating_var.get() == "rx18")
             elif key == 'layout': updated_attrs[key] = self.layout_var.get()
             elif key == 'isEasterEgg': updated_attrs[key] = self.easteregg_var.get()
             elif key == 'isAiImage': updated_attrs[key] = self.ai_var.get()
             elif key == 'isBan': updated_attrs[key] = self.ban_var.get()
             elif key in original_attrs: # 保留原始值 (filename, parentFolder, md5, Downloaded_From 等)
                 updated_attrs[key] = original_attrs[key]
             # else: # 对于不在原始数据且非编辑字段的 key，可以忽略或设默认值

        # 添加原始属性中存在但不在期望顺序里的其他属性
        for key, value in original_attrs.items():
            if key not in updated_attrs:
                updated_attrs[key] = value

        updated_entry['attributes'] = updated_attrs
        # 更新时间戳
        updated_entry['timestamp'] = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
        # 保留 sourceGallery (如果存在)
        if 'sourceGallery' in self.entry_data_original:
            updated_entry['sourceGallery'] = self.entry_data_original['sourceGallery']

        # 比较更新后的条目和原始条目是否有差异
        # 使用 json.dumps 序列化后比较，可以忽略字典内部顺序差异
        try:
            original_json = json.dumps(self.entry_data_original, sort_keys=True)
            updated_json = json.dumps(updated_entry, sort_keys=True)
            changed = (original_json != updated_json)
        except Exception as cmp_e:
             log_message(f"比较数据更改时出错: {cmp_e}", "WARNING")
             changed = True # 出错时假设有更改

        if not changed:
            self.message_var.set("提示：数据未更改。")
            self.after(1500, self.close_modal) # 1.5秒后自动关闭
            return

        # 更新内存缓存
        image_data_cache[entry_index] = updated_entry
        image_data_map[original_path] = updated_entry # 更新映射
        self.data_changed = True # 标记已更改

        # 写入 JSON 文件
        if safely_write_json(internal_json_path, image_data_cache, "内部用户数据"):
            log_message(f"成功更新条目: {original_path}")
            self.message_var.set("保存成功！")
            self.after(1000, self.close_modal) # 1秒后自动关闭
        else:
            log_message(f"错误：保存更新后的 JSON 文件失败！", "ERROR")
            self.message_var.set("错误：保存文件失败！")
            # 回滚内存中的更改
            image_data_cache[entry_index] = self.entry_data_original
            image_data_map[original_path] = self.entry_data_original
            self.data_changed = False # 重置更改标记

    def close_modal(self) -> None:
        """关闭模态窗口，如果数据已更改则调用刷新回调"""
        if self.data_changed and self.refresh_callback:
            self.refresh_callback()
        self.grab_release() # 释放焦点
        self.destroy()
        if self.app: # 清理 app 对 modal 的引用
             self.app.edit_modal = None


# --- JsonGenFrame (重构) ---
class JsonGenFrame(ctk.CTkFrame):
    """JSON 生成页面 (浏览物理文件并添加新条目)"""
    def __init__(self, master: ctk.CTk, app: 'GuGuNiuApp'):
        super().__init__(master, fg_color="transparent")
        self.app: 'GuGuNiuApp' = app
        self.image_preview_label: Optional[ctk.CTkLabel] = None
        self.md5_label_var: tk.StringVar = tk.StringVar(value="MD5: N/A")
        self.gid_label_var: tk.StringVar = tk.StringVar(value="GID: N/A")
        self.selected_image_info: Optional[Dict[str, str]] = None # 当前选中物理图片的信息
        self.image_scroll_frame: Optional[ctk.CTkScrollableFrame] = None # 图片网格滚动区域
        self.all_physical_images: List[Dict[str, str]] = [] # 扫描到的所有物理图片信息
        self.scan_status_var: tk.StringVar = tk.StringVar(value="") # 扫描状态
        self.scan_button: Optional[ctk.CTkButton] = None # 扫描按钮
        self.save_button: Optional[ctk.CTkButton] = None # 保存按钮
        self.rating_var: tk.StringVar = tk.StringVar(value="none") # 限制级
        self.layout_var: tk.StringVar = tk.StringVar(value="normal") # 构图
        self.easteregg_var: tk.BooleanVar = tk.BooleanVar(value=False) # 彩蛋
        self.ai_var: tk.BooleanVar = tk.BooleanVar(value=False) # AI 图
        self.message_var: tk.StringVar = tk.StringVar(value="") # 消息提示
        self.thumbnail_widgets: Dict[str, ctk.CTkButton] = {} # 物理路径 -> 缩略图按钮控件
        self.active_jsongen_thumb_requests: Dict[str, bool] = {} # 跟踪当前页面的缩略图请求
        self.jsongen_thumb_cache: Dict[str, ctk.CTkImage] = {} # 缓存加载好的 CTkImage 对象

        self.create_widgets()
        self.start_jsongen_thumbnail_workers() # 启动缩略图后台加载

    def create_widgets(self) -> None:
        """创建页面控件"""
        self.grid_columnconfigure(0, weight=1, minsize=300) # 左侧图片列表
        self.grid_columnconfigure(1, weight=2) # 右侧预览和信息
        self.grid_rowconfigure(1, weight=1) # 让列表和预览区域可扩展

        # --- 顶部控制栏 ---
        top_bar: ctk.CTkFrame = ctk.CTkFrame(self)
        top_bar.grid(row=0, column=0, columnspan=2, padx=10, pady=(10, 5), sticky="ew")
        self.scan_button = ctk.CTkButton(top_bar, text="扫描未入库图片", command=self.start_scan_task)
        self.scan_button.pack(side="left", padx=(0, 10))
        scan_status_label: ctk.CTkLabel = ctk.CTkLabel(top_bar, textvariable=self.scan_status_var, anchor="w")
        scan_status_label.pack(side="left", fill="x", expand=True)

        # --- 左侧图片网格 ---
        self.image_scroll_frame = ctk.CTkScrollableFrame(self, label_text="未保存图片列表")
        self.image_scroll_frame.grid(row=1, column=0, padx=(10, 5), pady=(0, 10), sticky="nsew")
        self.image_scroll_frame.grid_columnconfigure(0, weight=1) # 让内部卡片可以横向填充

        # --- 右侧预览和信息 ---
        right_panel: ctk.CTkFrame = ctk.CTkFrame(self)
        right_panel.grid(row=1, column=1, padx=(5, 10), pady=(0, 10), sticky="nsew")
        right_panel.grid_rowconfigure(0, weight=1) # 预览区域优先扩展
        right_panel.grid_columnconfigure(0, weight=1)

        # 预览容器
        preview_container: ctk.CTkFrame = ctk.CTkFrame(right_panel) # 移除固定宽高，让其自适应
        preview_container.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        preview_container.grid_propagate(True) # 允许容器根据内容调整大小
        preview_container.grid_rowconfigure(0, weight=1)
        preview_container.grid_columnconfigure(0, weight=1)

        self.image_preview_label = ctk.CTkLabel(preview_container, text="请从左侧列表选择图片", text_color="gray", anchor="center")
        self.image_preview_label.grid(row=0, column=0, sticky="nsew")

        # 属性设置区域
        attr_frame: ctk.CTkFrame = ctk.CTkFrame(right_panel)
        attr_frame.grid(row=1, column=0, padx=10, pady=5, sticky="nsew")
        attr_frame.grid_columnconfigure(1, weight=1)

        row_idx = 0
        # 限制级
        ctk.CTkLabel(attr_frame, text="限制级:").grid(row=row_idx, column=0, padx=(0, 10), pady=5, sticky="w")
        rating_frame: ctk.CTkFrame = ctk.CTkFrame(attr_frame, fg_color="transparent")
        rating_frame.grid(row=row_idx, column=1, padx=0, pady=0, sticky="w")
        ctk.CTkRadioButton(rating_frame, text="无", variable=self.rating_var, value="none", command=self.update_save_button_state).pack(side="left", padx=5)
        ctk.CTkRadioButton(rating_frame, text="Px18", variable=self.rating_var, value="px18", command=self.update_save_button_state).pack(side="left", padx=5)
        ctk.CTkRadioButton(rating_frame, text="Rx18", variable=self.rating_var, value="rx18", command=self.update_save_button_state).pack(side="left", padx=5)
        row_idx += 1

        # 构图
        ctk.CTkLabel(attr_frame, text="构图:").grid(row=row_idx, column=0, padx=(0, 10), pady=5, sticky="w")
        layout_frame: ctk.CTkFrame = ctk.CTkFrame(attr_frame, fg_color="transparent")
        layout_frame.grid(row=row_idx, column=1, padx=0, pady=0, sticky="w")
        ctk.CTkRadioButton(layout_frame, text="人像图", variable=self.layout_var, value="normal", command=self.update_save_button_state).pack(side="left", padx=5)
        ctk.CTkRadioButton(layout_frame, text="全屏图", variable=self.layout_var, value="fullscreen", command=self.update_save_button_state).pack(side="left", padx=5)
        ctk.CTkRadioButton(layout_frame, text="猫猫糕", variable=self.layout_var, value="catcake", command=self.update_save_button_state).pack(side="left", padx=5)
        row_idx += 1

        # 特殊属性
        ctk.CTkLabel(attr_frame, text="特殊:").grid(row=row_idx, column=0, padx=(0, 10), pady=5, sticky="w")
        special_frame: ctk.CTkFrame = ctk.CTkFrame(attr_frame, fg_color="transparent")
        special_frame.grid(row=row_idx, column=1, padx=0, pady=0, sticky="w")
        ctk.CTkCheckBox(special_frame, text="彩蛋", variable=self.easteregg_var, command=self.update_save_button_state).pack(side="left", padx=5)
        ctk.CTkCheckBox(special_frame, text="AI图", variable=self.ai_var, command=self.update_save_button_state).pack(side="left", padx=5)
        row_idx += 1

        # 信息显示区域 (MD5, GID)
        info_frame: ctk.CTkFrame = ctk.CTkFrame(right_panel, fg_color="transparent")
        info_frame.grid(row=2, column=0, padx=10, pady=5, sticky="ew")
        ctk.CTkLabel(info_frame, textvariable=self.md5_label_var, anchor="w").pack(fill="x", pady=(0, 2))
        ctk.CTkLabel(info_frame, textvariable=self.gid_label_var, anchor="w").pack(fill="x")

        # 操作区域 (消息, 保存按钮)
        action_frame: ctk.CTkFrame = ctk.CTkFrame(right_panel, fg_color="transparent")
        action_frame.grid(row=3, column=0, padx=10, pady=10, sticky="sew") # 靠下
        ctk.CTkLabel(action_frame, textvariable=self.message_var, text_color="gray", wraplength=300, anchor="w").pack(fill="x", pady=(0, 5))
        self.save_button = ctk.CTkButton(action_frame, text="保存到 ImageData.json", command=self.save_new_entry, state=tk.DISABLED, height=40) # 调整按钮高度
        self.save_button.pack(fill="x")

    def _load_preview_thread(self, image_path: str) -> None:
        """后台线程加载预览图并按比例缩放到目标区域"""
        try:
            with Image.open(image_path) as img:
                img_w, img_h = img.size
                if img_w <= 0 or img_h <= 0: raise ValueError("图片尺寸无效")

                # 计算缩放比例，适应预览区域
                ratio: float = min(PREVIEW_MAX_WIDTH / img_w, PREVIEW_MAX_HEIGHT / img_h)

                # 计算缩放后的新尺寸
                new_width: int = max(1, int(img_w * ratio))
                new_height: int = max(1, int(img_h * ratio))

                # 使用 resize 进行缩放
                resized_img: Image.Image = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                if resized_img.mode != 'RGBA':
                    resized_img = resized_img.convert('RGBA')

                # 将缩放后的图片对象和新尺寸传递给主线程
                if self.app:
                    self.app.after(0, self._create_and_update_preview_label, resized_img.copy(), image_path, (new_width, new_height))
        except FileNotFoundError:
             log_message(f"后台加载预览图失败: 文件未找到 {os.path.basename(image_path)}", "ERROR")
             if self.app: self.app.after(0, self._update_preview_label, None, image_path)
        except Exception as e:
            log_message(f"后台加载预览图失败: {os.path.basename(image_path)} - {e}", "ERROR")
            if self.app: self.app.after(0, self._update_preview_label, None, image_path)

    def _create_and_update_preview_label(self, img: Optional[Image.Image], original_path: str, img_size: Tuple[int, int]) -> None:
         """在主线程创建 CTkImage 并更新预览 Label"""
         # 检查当前选中的物理路径是否仍然是这个
         if self.selected_image_info and self.selected_image_info.get('physical_path') == original_path:
             if img and self.image_preview_label and self.image_preview_label.winfo_exists():
                 try:
                     # 使用计算出的新尺寸创建 CTkImage
                     ctk_image: ctk.CTkImage = ctk.CTkImage(light_image=img, dark_image=img, size=img_size)
                     self.image_preview_label.configure(text="", image=ctk_image)
                     self.image_preview_label.image = ctk_image # 存储引用
                 except Exception as e:
                      log_message(f"创建或更新预览 CTkImage 失败: {e}", "ERROR")
                      self.image_preview_label.configure(text=f"预览加载失败:\n{os.path.basename(original_path)}", image=None)
             elif self.image_preview_label and self.image_preview_label.winfo_exists():
                  # 如果 img 为 None (加载失败)
                  self.image_preview_label.configure(text=f"预览加载失败:\n{os.path.basename(original_path)}", image=None)

    def apply_browse_filters(self, *args: Any) -> None:
        """根据仓库过滤图片网格，只显示未保存的"""
        if not self.image_scroll_frame: return

        # 清空现有网格内容和缓存
        for widget in self.image_scroll_frame.winfo_children():
            widget.destroy()
        self.thumbnail_widgets.clear()
        self.active_jsongen_thumb_requests.clear()
        # self.jsongen_thumb_cache.clear() # 缓存不清空，可能重用
        self.clear_preview() # 清空右侧预览

        display_count: int = 0
        filtered_for_display: List[Dict[str, str]] = []
        processed_paths: Set[str] = set() # 防止因大小写或路径分隔符问题重复添加

        # 筛选未保存的图片
        for img_info in self.all_physical_images:
            physical_path_norm = Path(img_info['physical_path']).as_posix() # 统一路径格式
            if physical_path_norm in processed_paths: continue # 跳过已处理

            # 计算相对路径用于检查是否已保存
            relative_path_check: Optional[str] = None
            try:
                repo_path_obj = Path(all_repo_paths[img_info['repo_name']])
                relative_path_check = Path(img_info['physical_path']).relative_to(repo_path_obj).as_posix()
            except (KeyError, ValueError) as e:
                log_message(f"计算相对路径失败: {img_info['physical_path']} (仓库: {img_info.get('repo_name', '未知')}) - {e}", "WARNING")
                # 尝试使用后几部分路径作为近似相对路径
                path_parts = Path(img_info['physical_path']).parts
                if len(path_parts) >= 3: relative_path_check = "/".join(path_parts[-3:])
                elif len(path_parts) == 2: relative_path_check = "/".join(path_parts[-2:])
                elif len(path_parts) == 1: relative_path_check = path_parts[-1]

            if relative_path_check and relative_path_check not in image_data_paths_set:
                filtered_for_display.append(img_info)

            processed_paths.add(physical_path_norm)


        # 按仓库、文件夹、文件名排序
        filtered_for_display.sort(key=lambda x: (
            x.get('repo_name', ''),
            x.get('folder_name', ''),
            locale.strxfrm(x.get('filename', '')) # 使用 locale 排序文件名
        ))

        # 获取占位符图片
        placeholder: Optional[ImageTk.PhotoImage] = JSONGEN_PLACEHOLDER_IMAGE

        # 计算合适的按钮宽度 (基于滚动区域宽度)
        button_width: int = 200 # 默认宽度
        if self.image_scroll_frame and self.image_scroll_frame.winfo_exists():
             # 减去滚动条宽度和一些边距
             scroll_frame_width = self.image_scroll_frame.winfo_width()
             # 假设滚动条宽度约 15-20px，左右边距各 5px
             available_width = max(100, scroll_frame_width - 30)
             # 可以设置每行显示 N 个按钮，或者让按钮宽度等于可用宽度
             button_width = available_width # 每行一个按钮，宽度撑满
             # button_width = max(150, available_width // 2 - 10) # 每行两个按钮

        # 创建缩略图按钮
        for img_info in filtered_for_display:
            # 卡片式容器
            card: ctk.CTkFrame = ctk.CTkFrame(self.image_scroll_frame, fg_color="gray90", corner_radius=5)
            card.pack(pady=4, padx=4, fill="x") # 横向填充

            # 缩略图按钮
            # 文本包含文件名和路径信息，换行显示
            button_text = f"{img_info.get('filename', '未知')}\n({img_info.get('repo_name', '?')}/{img_info.get('folder_name', '?')})"
            thumb_button: ctk.CTkButton = ctk.CTkButton(
                card,
                text=button_text,
                image=placeholder, # 初始显示占位符
                compound="top", # 图片在文字上方
                anchor="center", # 文字居中
                font=ctk.CTkFont(size=10),
                text_color=("gray10", "gray90"),
                fg_color="transparent", # 透明背景
                hover=True, # 允许悬停效果
                hover_color="gray80",
                # width=button_width, # 设置计算出的宽度
                command=partial(self.on_thumbnail_click, img_info)
            )
            thumb_button.pack(expand=True, fill="both", padx=5, pady=5) # 填充卡片
            # 存储引用，防止图片被回收
            if placeholder:
                thumb_button.image = placeholder

            # 记录按钮控件并请求加载真实缩略图
            physical_path = img_info['physical_path']
            self.thumbnail_widgets[physical_path] = thumb_button
            self.request_jsongen_thumbnail(physical_path)
            display_count += 1

        log_message(f"JSON生成：筛选显示 {display_count} 张未保存的物理图片。")
        # 滚动到顶部
        if self.image_scroll_frame and self.image_scroll_frame._parent_canvas:
            self.after(10, lambda: self.image_scroll_frame._parent_canvas.yview_moveto(0))

    def on_thumbnail_click(self, img_info: Dict[str, str]) -> None:
        """
        处理缩略图点击事件。

        Args:
            img_info: 被点击图片的信息字典。
        """
        if not img_info or 'physical_path' not in img_info:
            log_message("缩略图点击事件：无效的图片信息。", "ERROR")
            self.clear_preview()
            return

        self.selected_image_info = img_info.copy() # 复制一份，避免后续修改影响原始列表

        # 计算相对路径
        relative_path: Optional[str] = None
        repo_name = self.selected_image_info.get('repo_name')
        physical_path = self.selected_image_info['physical_path']
        if repo_name and repo_name in all_repo_paths:
            try:
                repo_path_obj = Path(all_repo_paths[repo_name])
                relative_path = Path(physical_path).relative_to(repo_path_obj).as_posix()
            except ValueError:
                 log_message(f"计算相对路径失败（点击）: {physical_path} 相对于 {repo_path_obj}", "WARNING")
        if not relative_path: # 如果失败，尝试用后几部分路径
            path_parts = Path(physical_path).parts
            if len(path_parts) >= 3: relative_path = "/".join(path_parts[-3:])
            elif len(path_parts) >= 2: relative_path = "/".join(path_parts[-2:])
            elif len(path_parts) == 1: relative_path = path_parts[-1]
            else: relative_path = Path(physical_path).name # 最后回退到文件名
            log_message(f"使用后备相对路径: {relative_path}", "DEBUG")

        self.selected_image_info['relative_path'] = relative_path

        # 显示预览并更新 UI 状态
        self.show_image_preview(physical_path)
        self.check_existence_and_update_ui()

    def check_existence_and_update_ui(self) -> None:
        """检查选中图片是否已存在于 JSON 中，并更新右侧 UI"""
        if not self.selected_image_info or 'relative_path' not in self.selected_image_info:
            self.clear_preview()
            return

        relative_path: str = self.selected_image_info['relative_path']
        is_saved: bool = relative_path in image_data_paths_set
        self.message_var.set("")

        if is_saved:
            # 理论上 apply_browse_filters 已经过滤掉了已保存的，这里是双重保险
            log_message(f"错误：选中的图片 '{relative_path}' 已存在于 JSON 中。", "ERROR")
            self.message_var.set("错误：此图片已记录在 JSON 中。")
            self.gid_label_var.set("GID: N/A")
            self.md5_label_var.set("MD5: N/A")
            self.reset_attribute_controls()
            self.set_attribute_controls_state(tk.DISABLED)
            if self.save_button: self.save_button.configure(state=tk.DISABLED)
        else:
            # 新图片，准备生成信息
            self.message_var.set("新图片，设置属性后可保存。")
            # 实时生成 GID
            new_gid: str = generate_gid()
            self.gid_label_var.set(f"GID: {new_gid}")
            self.md5_label_var.set("MD5: 计算中...")
            self.reset_attribute_controls()
            self.set_attribute_controls_state(tk.NORMAL)
            if self.save_button: self.save_button.configure(state=tk.DISABLED) # MD5 计算完成前禁用保存
            # 后台计算 MD5
            threading.Thread(target=self._calculate_md5_thread, args=(self.selected_image_info['physical_path'],), daemon=True).start()

    def reset_attribute_controls(self) -> None:
        """重置右侧属性控件的值"""
        self.rating_var.set("none")
        self.layout_var.set("normal")
        self.easteregg_var.set(False)
        self.ai_var.set(False)

    def set_attribute_controls_state(self, state: str) -> None:
        """
        设置右侧属性控件 (单选/复选框) 的状态 (tk.NORMAL 或 tk.DISABLED)。

        Args:
            state: tk.NORMAL 或 tk.DISABLED。
        """
        widgets_to_set = []
        # 查找包含 Radiobutton 和 Checkbox 的父 Frame
        # 这个查找逻辑比较脆弱，依赖于当前的布局结构
        try:
            # 假设属性控件都在 right_panel 的子 Frame 'attr_frame' 中
            attr_frame = self.children.get('!jsongenframe.!ctkframe2.!ctkframe') # 根据实际布局调整
            if attr_frame and attr_frame.winfo_exists():
                for child in attr_frame.winfo_children():
                    if isinstance(child, ctk.CTkFrame): # Radiobutton 在子 Frame 里
                        widgets_to_set.extend(w for w in child.winfo_children() if isinstance(w, (ctk.CTkRadioButton, ctk.CTkCheckBox)))
                    elif isinstance(child, ctk.CTkCheckBox): # Checkbox 可能直接在 attr_frame 里
                         widgets_to_set.append(child)
        except Exception as e:
            log_message(f"查找属性控件时出错: {e}", "WARNING")

        # 设置状态
        for widget in widgets_to_set:
            if hasattr(widget, 'configure') and widget.winfo_exists():
                try:
                    widget.configure(state=state)
                except tk.TclError: pass # 忽略已销毁控件的错误

    def show_image_preview(self, image_path: str) -> None:
        """
        请求加载并显示指定图片的预览。

        Args:
            image_path: 图片的物理路径。
        """
        if not self.image_preview_label: return

        if not image_path or not is_file(image_path):
            log_message(f"显示预览失败：文件无效或不存在 '{image_path}'", "ERROR")
            self.image_preview_label.configure(text="图片文件无效或不存在", image=None)
            self.image_preview_label.image = None # 清除旧引用
            return

        # 显示加载提示，并在后台加载
        self.image_preview_label.configure(text="加载预览中...", image=None)
        self.image_preview_label.image = None
        threading.Thread(target=self._load_preview_thread, args=(image_path,), daemon=True).start()

    def _update_preview_label(self, ctk_image: Optional[ctk.CTkImage], original_path: str) -> None:
        """在主线程更新预览标签 (主要用于处理加载失败的情况)"""
        # 检查是否仍选中该图片
        if self.selected_image_info and self.selected_image_info.get('physical_path') == original_path:
            if not ctk_image and self.image_preview_label and self.image_preview_label.winfo_exists():
                self.image_preview_label.configure(text=f"预览加载失败:\n{os.path.basename(original_path)}", image=None)
                self.image_preview_label.image = None

    def _calculate_md5_thread(self, image_path: str) -> None:
        """后台线程计算 MD5"""
        md5_value: Optional[str] = calculate_file_md5(image_path)
        if self.app: # 确保 app 实例存在
            self.app.after(0, self._update_md5_label, md5_value, image_path)

    def _update_md5_label(self, md5_value: Optional[str], original_path: str) -> None:
        """在主线程更新 MD5 标签"""
        # 检查是否仍选中该图片
        if self.selected_image_info and self.selected_image_info.get('physical_path') == original_path:
            if md5_value:
                self.md5_label_var.set(f"MD5: {md5_value}")
            else:
                self.md5_label_var.set("MD5: 计算失败")
            self.update_save_button_state() # MD5 计算完成后更新保存按钮状态

    def update_save_button_state(self, *args: Any) -> None:
        """根据当前状态更新保存按钮的可用性"""
        if not self.save_button: return

        is_new_image: bool = False
        if self.selected_image_info and 'relative_path' in self.selected_image_info:
             is_new_image = self.selected_image_info['relative_path'] not in image_data_paths_set

        md5_str: str = self.md5_label_var.get()
        md5_valid: bool = "MD5: " in md5_str and "计算中" not in md5_str and "失败" not in md5_str and "N/A" not in md5_str

        gid_str: str = self.gid_label_var.get()
        gid_valid: bool = "GID: " in gid_str and "N/A" not in gid_str

        # 只有当是新图片、MD5有效、GID有效时才启用保存按钮
        new_state = tk.NORMAL if is_new_image and md5_valid and gid_valid else tk.DISABLED
        self.save_button.configure(state=new_state)

    def save_new_entry(self) -> None:
        """保存新条目到 JSON 文件"""
        if not self.selected_image_info or 'relative_path' not in self.selected_image_info:
            messagebox.showerror("错误", "未选择图片或图片信息无效。")
            return
        relative_path = self.selected_image_info['relative_path']
        if relative_path in image_data_paths_set:
            messagebox.showerror("错误", "当前图片已存在于 JSON 中。")
            return

        md5_value_str: str = self.md5_label_var.get()
        if not md5_value_str.startswith("MD5: ") or "计算" in md5_value_str or "失败" in md5_value_str or "N/A" in md5_value_str:
            messagebox.showerror("错误", "无法获取有效的 MD5 值。")
            return
        md5_value: str = md5_value_str.split("MD5: ")[1].strip()

        gid_value_str: str = self.gid_label_var.get()
        if not gid_value_str.startswith("GID: ") or "N/A" in gid_value_str:
             messagebox.showerror("错误", "无法获取有效的 GID。")
             return
        new_gid: str = gid_value_str.split("GID: ")[1].strip()


        # 构建新条目
        new_entry: OrderedDict = OrderedDict()
        new_entry['storagebox'] = self.selected_image_info.get('repo_name', '未知')
        new_entry['gid'] = new_gid
        new_entry['characterName'] = self.selected_image_info.get('folder_name', '未知') # 使用物理文件夹名作为角色名
        new_entry['path'] = relative_path
        new_entry['attributes'] = OrderedDict([
            ('filename', self.selected_image_info.get('filename', '未知')),
            ('parentFolder', self.selected_image_info.get('folder_name', '未知')),
            ('isPx18', self.rating_var.get() == "px18"),
            ('isRx18', self.rating_var.get() == "rx18"),
            ('layout', self.layout_var.get()),
            ('isEasterEgg', self.easteregg_var.get()),
            ('isAiImage', self.ai_var.get()),
            ('isBan', False), # 新条目默认不封禁
            ('md5', md5_value),
            ('Downloaded_From', 'local_generation') # 标记为本地生成
        ])
        new_entry['timestamp'] = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

        # --- 推断 sourceGallery ---
        relative_path_parts: List[str] = relative_path.split('/')
        if len(relative_path_parts) > 0:
            guessed_source_gallery: str = relative_path_parts[0]
            known_galleries: Set[str] = {"gs-character", "sr-character", "zzz-character", "waves-character"}
            if guessed_source_gallery in known_galleries:
                new_entry['sourceGallery'] = guessed_source_gallery
                log_message(f"推断 sourceGallery 为: {guessed_source_gallery}", "DEBUG")
            # else: # 不在已知列表，不添加该字段
            #     log_message(f"警告：无法从路径 '{relative_path}' 推断出已知的 sourceGallery。", "WARNING")
        # else: # 路径无法分割
        #     log_message(f"警告：无法从路径 '{relative_path}' 推断 sourceGallery。", "WARNING")
        # --- 推断结束 ---

        log_message(f"准备保存新条目: {new_entry['path']}")
        self.message_var.set("保存中...")
        if self.save_button: self.save_button.configure(state=tk.DISABLED)

        # 使用后台线程保存，避免 UI 卡顿
        run_in_thread(
            self._save_entry_task, new_entry,
            task_key="save_json_entry",
            on_complete=self.on_save_complete,
            on_error=self.on_save_error
        )

    def _save_entry_task(self, new_entry: OrderedDict) -> Dict[str, Any]:
        """后台任务：实际执行保存操作"""
        global image_data_cache, image_data_map, image_data_paths_set
        relative_path: str = new_entry['path']

        # 双重检查，防止并发问题
        if relative_path in image_data_paths_set:
            return {"success": False, "error": "图片在保存期间已被添加"}

        # 更新内存数据结构 (需要考虑线程安全，但假定 GUI 操作是串行的)
        image_data_cache.append(new_entry)
        image_data_map[relative_path] = new_entry
        image_data_paths_set.add(relative_path)

        # 写入文件
        if safely_write_json(internal_json_path, image_data_cache, "内部用户数据"):
            return {"success": True, "entry": new_entry}
        else:
            # 写入失败，回滚内存更改
            try:
                image_data_cache.pop() # 移除最后一个添加的
                if relative_path in image_data_map: del image_data_map[relative_path]
                if relative_path in image_data_paths_set: image_data_paths_set.remove(relative_path)
            except Exception as rollback_e:
                 log_message(f"回滚内存更改失败: {rollback_e}", "ERROR")
            return {"success": False, "error": "写入 JSON 文件失败"}

    def on_save_complete(self, result: Dict[str, Any]) -> None:
        """保存成功的回调"""
        if result and result.get("success"):
            new_entry: Optional[OrderedDict] = result.get("entry")
            if new_entry:
                log_message(f"新条目保存成功: {new_entry.get('path')}")
                self.message_var.set("保存成功！")
                # 刷新数据列表页签 (如果存在)
                data_list_frame = self.app.frames.get('data_list')
                if data_list_frame and isinstance(data_list_frame, DataListFrame):
                    data_list_frame.refresh_data_list()

                # 从当前 JsonGen 列表中移除已保存项并尝试选中下一个
                self.apply_browse_filters() # 重新过滤列表
                # 可以在这里添加逻辑选中下一个未保存项
                # self.find_and_display_next_unsaved_image(self.selected_image_info)
                self.clear_preview() # 保存成功后清空预览区

            else: # 成功但没有返回 entry?
                 log_message("保存成功，但未返回条目信息。", "WARNING")
                 self.message_var.set("保存成功！")
                 self.apply_browse_filters()
                 self.clear_preview()

        else: # 保存失败
            error_msg: str = result.get("error", "未知错误")
            log_message(f"保存新条目失败: {error_msg}", "ERROR")
            self.message_var.set(f"保存失败: {error_msg}")
            # 重新启用保存按钮 (如果当前图片仍然有效)
            self.update_save_button_state()

    def on_save_error(self, error: Exception) -> None:
        """保存出错的回调"""
        log_message(f"保存新条目时发生异常: {error}", "ERROR")
        self.message_var.set(f"保存出错!") # 简化错误信息
        # 重新启用保存按钮 (如果当前图片仍然有效)
        self.update_save_button_state()

    def clear_preview(self) -> None:
        """清空右侧预览区域和相关状态"""
        self.selected_image_info = None
        if self.image_preview_label:
            # 清除图片和文本
            self.image_preview_label.configure(text="请从左侧列表选择图片", image=None)
            self.image_preview_label.image = None # 清除引用

        self.md5_label_var.set("MD5: N/A")
        self.gid_label_var.set("GID: N/A")
        self.reset_attribute_controls()
        self.set_attribute_controls_state(tk.DISABLED)
        if self.save_button: self.save_button.configure(state=tk.DISABLED)
        self.message_var.set("")

    def start_scan_task(self) -> None:
        """开始扫描未入库图片的任务"""
        if not main_repo_path:
            messagebox.showwarning("提示", "请先选择主仓库。")
            return
        if self.scan_button: self.scan_button.configure(state=tk.DISABLED)
        self.scan_status_var.set("扫描中...")
        run_in_thread(
            self.scan_all_repo_images,
            task_key="scan_gallery",
            on_start=self.on_scan_start,
            on_complete=self.on_scan_complete,
            on_error=self.on_scan_error,
        )

    def scan_all_repo_images(self) -> List[Dict[str, str]]:
        """后台任务：扫描所有仓库中允许类型且未在 JSON 中的图片"""
        log_message("开始扫描所有仓库图片...")
        images_found: List[Dict[str, str]] = []
        total_files_scanned: int = 0
        repo_count: int = len(all_repo_paths)
        current_repo_index: int = 0
        # 只扫描特定游戏角色目录，提高效率
        target_folders: Set[str] = {"gs-character", "zzz-character", "sr-character", "waves-character"}

        # 更新状态变量和进度变量 (如果需要)
        if "scan_gallery" in task_status_vars: task_status_vars["scan_gallery"] = self.scan_status_var
        # if "scan_gallery" in task_progress_vars: task_progress_vars["scan_gallery"] = self.scan_progress_var # 需要创建进度变量

        for repo_name, repo_path in all_repo_paths.items():
            current_repo_index += 1
            log_message(f"正在扫描仓库: {repo_name} ({current_repo_index}/{repo_count})")
            repo_path_obj: Path = Path(repo_path)

            try:
                # 遍历目标文件夹
                for folder_name in target_folders:
                    target_folder_path: Path = repo_path_obj / folder_name
                    if target_folder_path.is_dir():
                        # 递归查找所有文件
                        for item in target_folder_path.rglob('*'):
                            if item.is_file() and item.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
                                total_files_scanned += 1
                                try:
                                    # 计算相对路径
                                    relative_path_str: str = item.relative_to(repo_path_obj).as_posix()
                                    # 检查是否已在 JSON 中
                                    if relative_path_str not in image_data_paths_set:
                                        # 获取实际的父文件夹名 (角色名)
                                        folder_name_actual: str = item.parent.name
                                        filename: str = item.name
                                        images_found.append({
                                            'repo_name': repo_name,
                                            'folder_name': folder_name_actual,
                                            'filename': filename,
                                            'physical_path': str(item.resolve()) # 存储绝对路径
                                        })
                                except ValueError as e: # relative_to 可能失败
                                     log_message(f"计算相对路径失败 (扫描): {item} - {e}", "WARNING")
                                except Exception as e:
                                    log_message(f"处理文件时出错: {item} - {e}", "WARNING")
            except PermissionError:
                 log_message(f"扫描仓库 '{repo_name}' 时权限不足，跳过。", "ERROR")
            except Exception as e:
                log_message(f"扫描仓库 '{repo_name}' 时出错: {e}", "ERROR")

            # 更新进度 (主线程)
            progress: int = int((current_repo_index / repo_count) * 100)
            if self.app: self.app.after(0, lambda p=progress: self.scan_status_var.set(f"扫描中 {p}%..."))

        log_message(f"扫描完成，共找到 {len(images_found)} 张未入库图片 (检查了 {total_files_scanned} 个文件)。")
        return images_found

    def on_scan_start(self) -> None:
        """扫描开始时的回调"""
        # 清空滚动框架
        if self.image_scroll_frame:
             for widget in self.image_scroll_frame.winfo_children():
                 widget.destroy()
        self.thumbnail_widgets.clear()
        self.active_jsongen_thumb_requests.clear()
        self.clear_preview()
        if self.scan_button: self.scan_button.configure(state=tk.DISABLED)

    def on_scan_complete(self, result: List[Dict[str, str]]) -> None:
        """扫描完成的回调"""
        self.all_physical_images = result # 更新扫描结果
        self.apply_browse_filters() # 应用过滤器显示结果
        if self.scan_button: self.scan_button.configure(state=tk.NORMAL)
        self.scan_status_var.set(f"扫描完成 ({len(result)} 张未入库)")

    def on_scan_error(self, error: Exception) -> None:
        """扫描出错的回调"""
        log_message(f"扫描图库时发生错误: {error}", "ERROR")
        messagebox.showerror("扫描失败", f"扫描图库时发生错误:\n{error}")
        if self.scan_button: self.scan_button.configure(state=tk.NORMAL)
        self.scan_status_var.set("扫描失败")

    def on_activate(self) -> None:
        """页面激活时的操作"""
        log_message("JSON生成页面已激活。")
        if not main_repo_path:
            log_message("JSON生成：主仓库未设置，无法扫描。", "WARNING")
            # 清空列表和状态
            if self.image_scroll_frame:
                 for widget in self.image_scroll_frame.winfo_children(): widget.destroy()
            self.all_physical_images = []
            self.thumbnail_widgets.clear()
            self.active_jsongen_thumb_requests.clear()
            self.clear_preview()
            self.scan_status_var.set("请先选择主仓库")
            if self.scan_button: self.scan_button.configure(state=tk.DISABLED)
            return

        if self.scan_button: self.scan_button.configure(state=tk.NORMAL)

        # 如果没有扫描结果，或者上次扫描结果为空，可以提示或自动扫描
        if not self.all_physical_images:
            log_message("图库列表为空，建议点击扫描按钮。")
            self.scan_status_var.set("点击按钮扫描未入库图片")
            # 或者自动开始扫描
            # self.start_scan_task()
        else:
            # 如果已有扫描结果，重新应用过滤器刷新显示
            self.apply_browse_filters()
            self.scan_status_var.set(f"上次扫描结果 ({len(self.all_physical_images)} 张未入库)")


    def reset_ui(self) -> None:
        """重置页面 UI"""
        if self.image_scroll_frame:
             for widget in self.image_scroll_frame.winfo_children(): widget.destroy()
        self.clear_preview()
        self.all_physical_images = []
        self.thumbnail_widgets.clear()
        self.active_jsongen_thumb_requests.clear()
        # self.jsongen_thumb_cache.clear() # 缓存不清空
        self.scan_status_var.set("")
        if self.scan_button: self.scan_button.configure(state=tk.NORMAL)
        log_message("JSON生成页面 UI 已重置。")

    # --- JSON 生成页面的缩略图加载 ---
    def start_jsongen_thumbnail_workers(self) -> None:
        """启动用于 JSON 生成页面的缩略图加载线程"""
        # 确保只启动一次
        if hasattr(self.app, 'jsongen_thumb_workers_started') and self.app.jsongen_thumb_workers_started:
            return

        self.app.jsongen_thumb_workers = []
        for i in range(JSONGEN_THUMB_WORKER_COUNT):
            thread: threading.Thread = threading.Thread(
                target=self.jsongen_thumbnail_worker_task,
                daemon=True,
                name=f"JsonGenThumbWorker-{i+1}"
            )
            self.app.jsongen_thumb_workers.append(thread)
            thread.start()
        # 启动结果处理循环
        if self.app:
            self.app.after(100, self.process_jsongen_thumbnail_results)
        self.app.jsongen_thumb_workers_started = True # 标记已启动
        log_message(f"已启动 {JSONGEN_THUMB_WORKER_COUNT} 个 JSON生成 缩略图加载线程。")

    def jsongen_thumbnail_worker_task(self) -> None:
        """JSON 生成页面缩略图加载线程的工作函数"""
        while app_running:
            physical_path: Optional[str] = None
            try:
                # 从请求队列获取任务，设置超时避免永久阻塞
                physical_path = JSONGEN_THUMB_REQ_QUEUE.get(timeout=1)
                if physical_path is None: break # 收到 None 信号退出

                # 检查文件是否存在
                if not is_file(physical_path):
                    JSONGEN_THUMB_RES_QUEUE.put((physical_path, None)) # 文件不存在，返回 None
                    continue

                # 加载并调整图片大小
                thumbnail_img: Optional[Image.Image] = self.app.load_and_resize_image(physical_path, JSONGEN_THUMB_SIZE)
                JSONGEN_THUMB_RES_QUEUE.put((physical_path, thumbnail_img)) # 发送 PIL Image 对象

            except queue.Empty:
                continue # 超时，继续循环等待
            except Exception as e:
                log_message(f"JsonGen缩略图线程出错 ({physical_path}): {e}", "ERROR")
                if physical_path is not None:
                    JSONGEN_THUMB_RES_QUEUE.put((physical_path, None)) # 出错也返回 None
            finally:
                if physical_path is not None:
                    JSONGEN_THUMB_REQ_QUEUE.task_done() # 标记任务完成

    def process_jsongen_thumbnail_results(self) -> None:
        """处理 JSON 生成页面的缩略图加载结果队列"""
        processed_count: int = 0
        max_process_per_cycle: int = 50 # 每次处理 N 个，避免阻塞 UI
        placeholder: Optional[ImageTk.PhotoImage] = JSONGEN_PLACEHOLDER_IMAGE

        try:
            while not JSONGEN_THUMB_RES_QUEUE.empty() and processed_count < max_process_per_cycle:
                physical_path, thumbnail_img = JSONGEN_THUMB_RES_QUEUE.get_nowait()
                processed_count += 1

                # 查找对应的按钮控件
                button_widget: Optional[ctk.CTkButton] = self.thumbnail_widgets.get(physical_path)

                if button_widget and button_widget.winfo_exists():
                    if thumbnail_img:
                        try:
                            # 在主线程创建 CTkImage
                            ctk_image: ctk.CTkImage = ctk.CTkImage(light_image=thumbnail_img, dark_image=thumbnail_img, size=thumbnail_img.size)
                            self.jsongen_thumb_cache[physical_path] = ctk_image # 缓存 CTkImage
                            button_widget.configure(image=ctk_image)
                            button_widget.image = ctk_image # 存储引用
                        except Exception as e:
                             log_message(f"创建 JsonGen CTkImage 失败 ({physical_path}): {e}", "ERROR")
                             # 显示加载失败文本和占位符
                             fail_text = f"{Path(physical_path).name}\n(预览失败)"
                             button_widget.configure(text=fail_text, image=placeholder)
                             if placeholder: button_widget.image = placeholder
                    else: # thumbnail_img is None (加载失败)
                        fail_text = f"{Path(physical_path).name}\n(加载失败)"
                        button_widget.configure(text=fail_text, image=placeholder)
                        if placeholder: button_widget.image = placeholder

                # 从活动请求中移除
                if physical_path in self.active_jsongen_thumb_requests:
                    del self.active_jsongen_thumb_requests[physical_path]

        except queue.Empty:
            pass # 队列空
        except Exception as e:
            log_message(f"处理 JsonGen 缩略图结果时出错: {e}", "ERROR")
        finally:
            # 只要应用在运行且窗口存在，就继续调度下一次处理
            if app_running and self.winfo_exists():
                self.after(100, self.process_jsongen_thumbnail_results)

    def request_jsongen_thumbnail(self, physical_path: str) -> None:
        """
        请求加载 JSON 生成页面的缩略图。

        Args:
            physical_path: 图片的物理路径。
        """
        # 如果已有缓存，直接使用
        if physical_path in self.jsongen_thumb_cache:
             button_widget = self.thumbnail_widgets.get(physical_path)
             if button_widget and button_widget.winfo_exists():
                 cached_image = self.jsongen_thumb_cache[physical_path]
                 button_widget.configure(image=cached_image)
                 button_widget.image = cached_image
             return # 使用缓存，无需请求

        # 如果不在请求中，则添加到队列
        if physical_path not in self.active_jsongen_thumb_requests:
            self.active_jsongen_thumb_requests[physical_path] = True
            JSONGEN_THUMB_REQ_QUEUE.put(physical_path)


# --- RepoCheckFrame ---
class RepoCheckFrame(ctk.CTkFrame):
    """仓库核对与 Storagebox 填充页面"""
    def __init__(self, master: ctk.CTk, app: 'GuGuNiuApp'):
        super().__init__(master, fg_color="transparent")
        self.app: 'GuGuNiuApp' = app
        self.status_var: tk.StringVar = tk.StringVar(value="状态: 未开始")
        self.progress_var: tk.IntVar = tk.IntVar(value=0)
        self.cancel_var: tk.BooleanVar = tk.BooleanVar(value=False) # 取消标志
        self.results_textbox: Optional[ctk.CTkTextbox] = None
        self.start_button: Optional[ctk.CTkButton] = None
        self.cancel_button: Optional[ctk.CTkButton] = None

        self.create_widgets()

    def create_widgets(self) -> None:
        """创建页面控件"""
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1) # 让结果文本框可扩展

        # 控制按钮区域
        control_frame: ctk.CTkFrame = ctk.CTkFrame(self)
        control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.start_button = ctk.CTkButton(control_frame, text="开始核对并填充 Storagebox", command=self.start_check_task)
        self.start_button.pack(side="left", padx=(0, 10), pady=10)
        self.cancel_button = ctk.CTkButton(control_frame, text="取消", command=self.cancel_check_task, state=tk.DISABLED, fg_color="gray")
        self.cancel_button.pack(side="left", padx=10, pady=10)

        # 状态和进度条区域
        status_frame: ctk.CTkFrame = ctk.CTkFrame(self, fg_color="transparent")
        status_frame.grid(row=1, column=0, padx=10, pady=5, sticky="ew")
        status_frame.grid_columnconfigure(0, weight=1)
        status_label: ctk.CTkLabel = ctk.CTkLabel(status_frame, textvariable=self.status_var, anchor="w")
        status_label.grid(row=0, column=0, sticky="ew")
        self.progress_bar: ctk.CTkProgressBar = ctk.CTkProgressBar(status_frame, variable=self.progress_var, mode='determinate')
        self.progress_bar.grid(row=1, column=0, pady=(5, 0), sticky="ew")
        self.progress_bar.set(0) # 初始为0

        # 结果显示文本框
        self.results_textbox = ctk.CTkTextbox(self, wrap=tk.WORD, state=tk.DISABLED, font=ctk.CTkFont(family="Consolas", size=11))
        self.results_textbox.grid(row=2, column=0, padx=10, pady=10, sticky="nsew")

    def start_check_task(self) -> None:
        """启动仓库核对任务"""
        if not main_repo_path or not internal_json_path:
            messagebox.showerror("错误", "请先选择主仓库。")
            return
        if not is_file(internal_json_path):
            messagebox.showerror("错误", f"找不到 JSON 文件:\n{internal_json_path}")
            return

        # 确认操作
        if messagebox.askyesno("确认操作", "此操作将扫描所有仓库以确定图片位置，并尝试填充 ImageData.json 文件中缺失的 'storagebox' 字段。\n\n强烈建议在执行前备份 ImageData.json！\n\n确定要继续吗？", icon='warning'):
            self.status_var.set("状态: 准备中...")
            self.progress_var.set(0)
            if self.results_textbox:
                self.results_textbox.configure(state=tk.NORMAL)
                self.results_textbox.delete("1.0", tk.END)
                self.results_textbox.configure(state=tk.DISABLED)
            if self.start_button: self.start_button.configure(state=tk.DISABLED)
            if self.cancel_button: self.cancel_button.configure(state=tk.NORMAL)
            self.cancel_var.set(False) # 重置取消标志

            # 传递必要的参数给后台任务
            run_in_thread(
                self.check_and_fill_storagebox_task,
                internal_json_path, ordered_repo_paths, self.cancel_var, # 传递路径、仓库顺序和取消标志
                task_key="repo_check",
                on_complete=self.on_check_complete,
                on_error=self.on_check_error
            )

    def cancel_check_task(self) -> None:
        """请求取消仓库核对任务"""
        task_key = "repo_check"
        if task_key in background_tasks and background_tasks[task_key].is_alive():
            log_message("用户请求取消仓库核对任务...", "WARNING")
            self.cancel_var.set(True) # 设置取消标志
            self.status_var.set("状态: 正在取消...")
            if self.cancel_button: self.cancel_button.configure(state=tk.DISABLED)
        else:
            log_message("取消仓库核对：任务未在运行。", "INFO")

    def check_and_fill_storagebox_task(
        self,
        json_path: str,
        ordered_repos: List[Tuple[str, str]],
        cancel_flag: tk.BooleanVar
    ) -> Dict[str, int]:
        """
        后台任务：核对 JSON 条目，查找物理文件，填充 storagebox 字段。

        Args:
            json_path: ImageData.json 的路径。
            ordered_repos: 按优先级排序的仓库列表。
            cancel_flag: 用于外部取消任务的布尔变量。

        Returns:
            包含处理结果统计信息的字典。
        Raises:
            InterruptedError: 如果任务被取消。
            Exception: 其他处理错误。
        """
        log_message("后台任务：开始仓库核对与 storagebox 填充...", "INFO")
        # 关联状态和进度变量
        if "repo_check" in task_status_vars: task_status_vars["repo_check"] = self.status_var
        if "repo_check" in task_progress_vars: task_progress_vars["repo_check"] = self.progress_var
        if "repo_check" in task_cancel_flags: task_cancel_flags["repo_check"] = cancel_flag

        # --- 备份 ---
        backup_path: str = json_path + f".bak_{int(time.time())}"
        try:
            shutil.copy2(json_path, backup_path)
            log_message(f"已备份: {os.path.basename(backup_path)}", "INFO")
            self.append_result_text(f"已备份: {os.path.basename(backup_path)}\n")
        except Exception as e:
            raise Exception(f"备份失败: {e}") from e

        # --- 读取 JSON ---
        try:
            original_data: List[OrderedDict] = safely_read_json(json_path, "核对任务")
            if not original_data and is_file(json_path): # 文件存在但读取为空列表
                 log_message("JSON 文件为空，无需处理。", "INFO")
                 self.append_result_text("JSON 文件为空，无需处理。\n")
                 return {"total_processed": 0, "storagebox_added": 0, "file_missing": 0, "skipped": 0, "updated": 0}
            elif not original_data: # 文件不存在或读取失败
                 raise ValueError("无法读取有效的 JSON 数据")

            log_message(f"成功读取 {len(original_data)} 条记录。", "INFO")
            self.append_result_text(f"成功读取 {len(original_data)} 条记录。\n")
        except Exception as e:
            raise Exception(f"读取或解析 JSON 失败: {e}") from e

        # --- 处理记录 ---
        updated_data: List[OrderedDict] = []
        processed_count: int = 0
        added_count: int = 0 # 新增 storagebox
        updated_count: int = 0 # 更新了已存在但无效的 storagebox
        missing_count: int = 0 # 文件找不到
        skipped_count: int = 0 # 无需处理 (已有有效 storagebox 或缺少 path)
        total_count: int = len(original_data)

        # 设置进度条最大值 (主线程)
        if self.app and self.progress_bar:
            self.app.after(0, self.progress_bar.configure, {"maximum": total_count})

        log_message("开始遍历记录并查找文件位置...")
        self.append_result_text("开始遍历记录并查找文件位置...\n")

        for i, entry in enumerate(original_data):
            # 检查取消标志
            if cancel_flag.get():
                raise InterruptedError("任务被用户取消")

            processed_count += 1
            # 更新进度和状态 (主线程，节流更新)
            if i % 50 == 0 or i == total_count - 1:
                progress_val: int = i + 1
                if self.app:
                    self.app.after(0, lambda p=progress_val: self.progress_var.set(p))
                    self.app.after(0, lambda p=progress_val: self.status_var.set(f"状态: 正在处理 {p}/{total_count}"))

            # 基本检查
            if not isinstance(entry, dict):
                log_message(f"跳过无效记录格式 (非字典): {entry}", "WARNING")
                self.append_result_text(f"警告: 跳过第 {i+1} 条无效记录 (非字典)\n")
                skipped_count += 1
                updated_data.append(entry) # 保留原始无效条目
                continue

            relative_path_str: Optional[str] = entry.get('path')
            if not relative_path_str or not isinstance(relative_path_str, str):
                log_message(f"记录缺少有效 'path' 字段: {entry.get('gid', '未知GID')}", "WARNING")
                self.append_result_text(f"警告: 第 {i+1} 条记录缺少 'path'\n")
                skipped_count += 1
                updated_data.append(entry) # 保留原始条目
                continue

            # 检查现有 storagebox
            current_storagebox: Optional[str] = entry.get("storagebox")
            needs_check: bool = True
            if current_storagebox and isinstance(current_storagebox, str) and current_storagebox in all_repo_paths:
                # 检查文件在声明的 storagebox 中是否存在
                potential_path = Path(all_repo_paths[current_storagebox]) / relative_path_str.replace('\\', '/')
                if is_file(potential_path):
                    needs_check = False # 文件存在于声明的仓库，跳过
                    skipped_count += 1
                    updated_data.append(entry)
                else:
                    log_message(f"记录声明在 '{current_storagebox}' 但文件不存在，重新查找: {relative_path_str}", "WARNING")
                    self.append_result_text(f"信息: 第 {i+1} 条记录声明仓库失效，重新查找...\n")
                    # needs_check 保持 True，会进行后续查找

            if needs_check:
                # 查找物理文件
                normalized_relative_path: str = relative_path_str.replace('\\', '/')
                found_repo_name: Optional[str] = None
                for repo_name, repo_path in ordered_repos:
                    physical_path: Path = Path(repo_path) / normalized_relative_path
                    try:
                        if physical_path.is_file():
                            found_repo_name = repo_name
                            break # 找到即停止
                    except OSError: continue # 忽略权限等错误

                # 创建新条目或更新现有条目
                new_entry: OrderedDict = OrderedDict()
                if found_repo_name:
                    new_entry['storagebox'] = found_repo_name
                    if current_storagebox: # 更新了无效的 storagebox
                         updated_count += 1
                         log_message(f"更新 storagebox: {relative_path_str} -> {found_repo_name} (原: {current_storagebox})", "INFO")
                    else: # 新增了 storagebox
                         added_count += 1
                         log_message(f"填充 storagebox: {relative_path_str} -> {found_repo_name}", "INFO")
                else:
                    # 文件未找到，保留原始 storagebox (可能是 None 或无效值)
                    if current_storagebox:
                         new_entry['storagebox'] = current_storagebox
                    log_message(f"文件未找到: {normalized_relative_path}", "WARNING")
                    self.append_result_text(f"警告: 文件未找到 - {normalized_relative_path}\n")
                    missing_count += 1

                # 复制其他字段，确保 storagebox 在前面
                for key, value in entry.items():
                    if key not in new_entry:
                        new_entry[key] = value
                updated_data.append(new_entry)

        log_message("所有记录处理完毕。")
        self.append_result_text("所有记录处理完毕。\n")

        # --- 写回 JSON ---
        try:
            # 仅当数据有实际更改时才写回
            # 比较原始数据和更新后数据 (简单比较长度和内容可能不够精确，但作为基本判断)
            # 更可靠的方式是逐条比较，但可能消耗性能
            # 这里选择只要有 added 或 updated 就写回
            if added_count > 0 or updated_count > 0:
                if safely_write_json(json_path, updated_data, "核对结果"):
                    log_message(f"成功写回: {os.path.basename(json_path)}", "INFO")
                    self.append_result_text(f"成功将 {len(updated_data)} 条更新后的记录写回文件。\n")
                    # 更新内存缓存
                    global image_data_cache, image_data_map, image_data_paths_set
                    image_data_cache = updated_data
                    image_data_map = {
                        entry.get('path', '').replace('\\', '/'): entry
                        for entry in image_data_cache if isinstance(entry, dict) and entry.get('path')
                    }
                    image_data_paths_set = set(image_data_map.keys())
                    log_message("内存缓存已同步更新。", "INFO")
                else:
                     raise Exception("写入 JSON 文件失败") # 触发错误处理
            else:
                 log_message("数据无更改，未执行写回操作。", "INFO")
                 self.append_result_text("数据无更改，未执行写回操作。\n")

        except Exception as e:
            raise Exception(f"写入 JSON 失败: {e}") from e

        return {
            "total_processed": processed_count,
            "storagebox_added": added_count,
            "storagebox_updated": updated_count,
            "file_missing": missing_count,
            "skipped": skipped_count
        }

    def on_check_complete(self, result: Union[Dict[str, int], InterruptedError]) -> None:
        """任务完成的回调"""
        def update_ui() -> None:
            if not self.winfo_exists(): return # 检查窗口是否存在

            if isinstance(result, dict):
                # 设置进度条满
                if self.progress_bar:
                     max_val = self.progress_bar.cget("maximum")
                     self.progress_var.set(max_val if max_val > 0 else 100) # 避免除零

                summary_text = (f"--- 处理完成 ---\n"
                                f"总处理: {result.get('total_processed', 0)}, "
                                f"新增Storagebox: {result.get('storagebox_added', 0)}, "
                                f"更新Storagebox: {result.get('storagebox_updated', 0)}, "
                                f"跳过: {result.get('skipped', 0)}, "
                                f"文件缺失: {result.get('file_missing', 0)}\n"
                                f"请检查上方日志获取详情。\n")
                self.append_result_text(summary_text)
                self.status_var.set("状态: 完成")
                messagebox.showinfo("完成", "仓库核对与 Storagebox 填充完成！详情请查看上方日志。")
                # 刷新数据列表页签以显示更新后的 storagebox
                data_list_frame = self.app.frames.get('data_list')
                if data_list_frame and isinstance(data_list_frame, DataListFrame):
                    data_list_frame.refresh_data_list()

            elif isinstance(result, InterruptedError):
                self.status_var.set("状态: 已取消")
                self.append_result_text("\n--- 任务已取消 ---\n")
                messagebox.showwarning("已取消", "仓库核对任务已被取消。")
            else: # 不期望的结果类型
                self.status_var.set("状态: 未知错误")
                log_message(f"仓库核对任务返回了意外的结果类型: {type(result)}", "ERROR")
                self.append_result_text(f"\n--- 任务返回异常结果 ---\n类型: {type(result)}\n")
                messagebox.showerror("错误", "仓库核对任务完成，但返回结果异常。")

            # 恢复按钮状态
            if self.start_button: self.start_button.configure(state=tk.NORMAL)
            if self.cancel_button: self.cancel_button.configure(state=tk.DISABLED)

        if self.app: self.app.after(0, update_ui) # 确保在主线程更新 UI

    def on_check_error(self, error: Exception) -> None:
        """任务出错的回调"""
        def update_ui() -> None:
            if not self.winfo_exists(): return
            self.status_var.set("状态: 错误!")
            error_msg = f"仓库核对过程中发生错误:\n{error}\n详情请查看控制台日志。"
            self.append_result_text(f"\n--- 任务失败 ---\n{error_msg}\n")
            messagebox.showerror("错误", error_msg)
            # 恢复按钮状态
            if self.start_button: self.start_button.configure(state=tk.NORMAL)
            if self.cancel_button: self.cancel_button.configure(state=tk.DISABLED)

        if self.app: self.app.after(0, update_ui)

    def append_result_text(self, text: str) -> None:
        """安全地向结果文本框追加文本 (主线程)"""
        def update_textbox() -> None:
            if self.results_textbox and self.results_textbox.winfo_exists():
                try:
                    self.results_textbox.configure(state=tk.NORMAL)
                    self.results_textbox.insert(tk.END, text)
                    self.results_textbox.see(tk.END)
                    self.results_textbox.configure(state=tk.DISABLED)
                except tk.TclError as e:
                     if "invalid command name" not in str(e).lower():
                          log_message(f"更新结果文本框时出错: {e}", "WARNING")
                except Exception as e:
                     log_message(f"更新结果文本框时发生未知错误: {e}", "ERROR")

        if self.app: self.app.after(0, update_textbox)

    def on_activate(self) -> None:
        """页面激活时的操作"""
        log_message("仓库核对页面已激活。")
        # 可以在这里添加一些激活时的检查或提示

    def reset_ui(self) -> None:
        """重置页面 UI"""
        self.status_var.set("状态: 未开始")
        self.progress_var.set(0)
        if self.progress_bar: self.progress_bar.set(0)
        if self.results_textbox:
            try:
                self.results_textbox.configure(state=tk.NORMAL)
                self.results_textbox.delete("1.0", tk.END)
                self.results_textbox.configure(state=tk.DISABLED)
            except tk.TclError: pass
        if self.start_button: self.start_button.configure(state=tk.NORMAL)
        if self.cancel_button: self.cancel_button.configure(state=tk.DISABLED)
        self.cancel_var.set(False)
        log_message("仓库核对页面 UI 已重置。")


# --- ToolsFrame (维护工具页面 - 只读模式) ---
class ToolsFrame(ctk.CTkFrame):
    """维护工具页面 (MD5, 序号, JSON 检查 - 只读)"""
    def __init__(self, master: ctk.CTk, app: 'GuGuNiuApp'):
        super().__init__(master, fg_color="transparent")
        self.app: 'GuGuNiuApp' = app
        self.notebook: Optional[ctk.CTkTabview] = None
        # MD5 检查相关
        self.md5_status_var: tk.StringVar = tk.StringVar(value="状态: 未开始")
        self.md5_results_text: Optional[ctk.CTkTextbox] = None
        self.md5_start_button: Optional[ctk.CTkButton] = None
        # 序号检查相关
        self.seq_status_var: tk.StringVar = tk.StringVar(value="状态: 未开始")
        self.seq_results_text: Optional[ctk.CTkTextbox] = None
        self.seq_start_button: Optional[ctk.CTkButton] = None
        self.seq_rename_button: Optional[ctk.CTkButton] = None # 重命名按钮
        self.seq_fix_plan: List[Dict[str, Any]] = [] # 存储修复计划
        # JSON 检查相关
        self.json_check_status_var: tk.StringVar = tk.StringVar(value="状态: 未开始")
        self.json_check_results_text: Optional[ctk.CTkTextbox] = None
        self.json_check_start_button: Optional[ctk.CTkButton] = None

        self.create_widgets()

    def create_widgets(self) -> None:
        """创建页面控件"""
        self.notebook = ctk.CTkTabview(self)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=10)

        # 添加标签页
        self.notebook.add("MD5检查")
        self.notebook.add("序号检查")
        self.notebook.add("JSON检查")

        # 创建各标签页内容
        self.create_md5_tab(self.notebook.tab("MD5检查"))
        self.create_sequence_tab(self.notebook.tab("序号检查"))
        self.create_json_check_tab(self.notebook.tab("JSON检查"))

    def create_md5_tab(self, tab: ctk.CTkFrame) -> None:
        """创建 MD5 检查标签页的内容"""
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(1, weight=1) # 让文本框扩展

        control_frame: ctk.CTkFrame = ctk.CTkFrame(tab)
        control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.md5_start_button = ctk.CTkButton(control_frame, text="开始 MD5 检查 (只读)", command=self.start_md5_check_task)
        self.md5_start_button.pack(side="left", padx=(0, 10))
        ctk.CTkLabel(control_frame, textvariable=self.md5_status_var).pack(side="left", padx=10)

        self.md5_results_text = ctk.CTkTextbox(tab, wrap=tk.WORD, state=tk.DISABLED, font=ctk.CTkFont(family="Consolas", size=11))
        self.md5_results_text.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")

    def create_sequence_tab(self, tab: ctk.CTkFrame) -> None:
        """创建序号检查标签页的内容"""
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(1, weight=1)

        control_frame: ctk.CTkFrame = ctk.CTkFrame(tab)
        control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.seq_start_button = ctk.CTkButton(control_frame, text="开始序号检查", command=self.start_sequence_check_task)
        self.seq_start_button.pack(side="left", padx=(0, 10))
        # 重命名按钮，初始禁用
        self.seq_rename_button = ctk.CTkButton(control_frame, text="执行物理重命名 (高风险!)", command=self.start_sequence_rename_task, state=tk.DISABLED, fg_color="orange")
        self.seq_rename_button.pack(side="left", padx=10)
        ctk.CTkLabel(control_frame, textvariable=self.seq_status_var).pack(side="left", padx=10)

        self.seq_results_text = ctk.CTkTextbox(tab, wrap=tk.WORD, state=tk.DISABLED, font=ctk.CTkFont(family="Consolas", size=11))
        self.seq_results_text.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")

    def create_json_check_tab(self, tab: ctk.CTkFrame) -> None:
        """创建 JSON 检查标签页的内容"""
        tab.grid_columnconfigure(0, weight=1)
        tab.grid_rowconfigure(1, weight=1)

        control_frame: ctk.CTkFrame = ctk.CTkFrame(tab)
        control_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")
        self.json_check_start_button = ctk.CTkButton(control_frame, text="开始 JSON 检查 (只读)", command=self.start_json_check_task)
        self.json_check_start_button.pack(side="left", padx=(0, 10))
        ctk.CTkLabel(control_frame, textvariable=self.json_check_status_var).pack(side="left", padx=10)

        self.json_check_results_text = ctk.CTkTextbox(tab, wrap=tk.WORD, state=tk.DISABLED, font=ctk.CTkFont(family="Consolas", size=11))
        self.json_check_results_text.grid(row=1, column=0, padx=10, pady=10, sticky="nsew")

    def append_text_safe(self, textbox: Optional[ctk.CTkTextbox], text: str) -> None:
        """安全地向指定的 CTkTextbox 追加文本 (主线程)"""
        def update_textbox() -> None:
            if textbox and textbox.winfo_exists():
                try:
                    textbox.configure(state=tk.NORMAL)
                    textbox.insert(tk.END, text)
                    textbox.see(tk.END)
                    textbox.configure(state=tk.DISABLED)
                except tk.TclError: pass # 忽略错误
                except Exception as e: log_message(f"更新文本框时出错: {e}", "ERROR")
        if self.app: self.app.after(0, update_textbox)

    # --- MD5 检查 ---
    def start_md5_check_task(self) -> None:
        """启动 MD5 检查任务"""
        if not main_repo_path: messagebox.showwarning("提示", "请先选择主仓库。"); return
        if self.md5_start_button: self.md5_start_button.configure(state=tk.DISABLED)
        self.md5_status_var.set("状态: 准备中...")
        if self.md5_results_text:
            self.md5_results_text.configure(state=tk.NORMAL)
            self.md5_results_text.delete("1.0", tk.END)
            self.append_text_safe(self.md5_results_text, "开始 MD5 检查 (只读模式)...\n")
            self.md5_results_text.configure(state=tk.DISABLED)

        run_in_thread(
            self.md5_check_task,
            task_key="md5_check",
            on_complete=self.on_md5_check_complete,
            on_error=self.on_md5_check_error
        )

    def md5_check_task(self) -> List[Dict[str, str]]:
        """后台任务：检查 JSON 中记录的 MD5 与实际文件是否一致"""
        if "md5_check" in task_status_vars: task_status_vars["md5_check"] = self.md5_status_var
        mismatches: List[Dict[str, str]] = []
        checked_count: int = 0
        total_entries: int = len(image_data_cache)
        if self.app: self.app.after(0, lambda: self.md5_status_var.set(f"状态: 检查中 0/{total_entries}"))

        for i, entry in enumerate(image_data_cache):
            if not isinstance(entry, dict): continue

            attrs: Dict[str, Any] = entry.get('attributes', {})
            relative_path: Optional[str] = entry.get('path')
            expected_md5: Optional[str] = attrs.get('md5')

            if not relative_path or not expected_md5 or expected_md5 == 'N/A':
                continue # 跳过无路径或无 MD5 记录的条目

            physical_path: Optional[str] = get_physical_path(entry)
            if not physical_path:
                # 文件本身缺失，在 JSON 检查中处理，这里跳过
                continue

            actual_md5: Optional[str] = calculate_file_md5(physical_path)
            checked_count += 1

            if actual_md5 and actual_md5.lower() != expected_md5.lower():
                mismatches.append({
                    'path': relative_path,
                    'filename': attrs.get('filename', '未知'),
                    'expected': expected_md5,
                    'actual': actual_md5
                })
                log_message(f"MD5 不匹配: {relative_path} (预期: {expected_md5}, 实际: {actual_md5})", "WARNING")

            # 更新状态 (节流)
            if i % 100 == 0 or i == total_entries - 1:
                if self.app: self.app.after(0, lambda i=i: self.md5_status_var.set(f"状态: 检查中 {i+1}/{total_entries}"))

        log_message(f"MD5 检查完成，共检查 {checked_count} 个文件，发现 {len(mismatches)} 处不一致。", "INFO")
        return mismatches

    def on_md5_check_complete(self, mismatches: List[Dict[str, str]]) -> None:
        """MD5 检查完成的回调"""
        self.md5_status_var.set(f"状态: 完成 ({len(mismatches)} 不一致)")
        if mismatches:
            self.append_text_safe(self.md5_results_text, f"\n--- 发现 {len(mismatches)} 个 MD5 不一致项 ---\n")
            for item in mismatches:
                self.append_text_safe(self.md5_results_text, f"文件: {item['filename']} ({item['path']})\n")
                self.append_text_safe(self.md5_results_text, f"  JSON MD5: {item['expected']}\n")
                self.append_text_safe(self.md5_results_text, f"  实际 MD5: {item['actual']}\n\n")
        else:
            self.append_text_safe(self.md5_results_text, "\n--- 未发现 MD5 不一致项 ---")
        if self.md5_start_button: self.md5_start_button.configure(state=tk.NORMAL)

    def on_md5_check_error(self, error: Exception) -> None:
        """MD5 检查出错的回调"""
        self.md5_status_var.set("状态: 错误!")
        self.append_text_safe(self.md5_results_text, f"\n--- MD5 检查出错 ---\n{error}\n")
        log_message(f"MD5 检查出错: {error}", "ERROR")
        if self.md5_start_button: self.md5_start_button.configure(state=tk.NORMAL)

    # --- 序号检查 ---
    def start_sequence_check_task(self) -> None:
        """启动序号检查任务"""
        if not main_repo_path: messagebox.showwarning("提示", "请先选择主仓库。"); return
        if self.seq_start_button: self.seq_start_button.configure(state=tk.DISABLED)
        if self.seq_rename_button: self.seq_rename_button.configure(state=tk.DISABLED, text="执行物理重命名 (高风险!)")
        self.seq_status_var.set("状态: 准备中...")
        self.seq_fix_plan = [] # 清空旧计划
        if self.seq_results_text:
            self.seq_results_text.configure(state=tk.NORMAL)
            self.seq_results_text.delete("1.0", tk.END)
            self.append_text_safe(self.seq_results_text, "开始序号检查...\n")
            self.seq_results_text.configure(state=tk.DISABLED)

        run_in_thread(
            self.sequence_check_task,
            task_key="seq_check",
            on_complete=self.on_sequence_check_complete,
            on_error=self.on_sequence_check_error
        )

    def sequence_check_task(self) -> Dict[str, Any]:
        """后台任务：检查物理文件命名是否符合 GuXXX 序号规范"""
        if "seq_check" in task_status_vars: task_status_vars["seq_check"] = self.seq_status_var
        issues_log: List[str] = []
        fix_plan_details: List[Dict[str, Any]] = []
        folders_with_issues: int = 0
        total_folders_scanned: int = 0
        all_folders: Dict[str, List[Dict[str, str]]] = {} # folder_path -> [file_info]

        log_message("序号检查：开始扫描所有仓库文件...")
        if self.app: self.app.after(0, lambda: self.seq_status_var.set("状态: 扫描文件..."))

        # 扫描所有仓库中的图片文件，按文件夹分组
        for repo_name, repo_path in all_repo_paths.items():
            repo_path_obj: Path = Path(repo_path)
            try:
                for item in repo_path_obj.rglob('*'):
                    if item.is_file() and item.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
                        try:
                            folder_key: str = str(item.parent.resolve()) # 使用绝对路径作为 key
                            if folder_key not in all_folders:
                                all_folders[folder_key] = []
                            all_folders[folder_key].append({'filename': item.name, 'path': str(item)})
                        except Exception as path_e:
                             log_message(f"处理文件路径时出错: {item} - {path_e}", "WARNING")
            except PermissionError:
                 log_message(f"扫描仓库 '{repo_name}' 时权限不足，跳过。", "ERROR")
            except Exception as scan_e:
                log_message(f"扫描仓库 '{repo_name}' 时出错: {scan_e}", "ERROR")

        total_folders_to_check: int = len(all_folders)
        log_message(f"序号检查：扫描完成，找到 {total_folders_to_check} 个含图片文件夹。开始分析...")
        if self.app: self.app.after(0, lambda: self.seq_status_var.set(f"状态: 分析中 0/{total_folders_to_check}"))

        # 正则匹配 GuXXX.ext 格式
        sequence_regex: re.Pattern = re.compile(r"Gu(\d+)\.\w+$", re.IGNORECASE)

        # 遍历每个文件夹进行检查
        for i, (folder_path, files) in enumerate(all_folders.items()):
            folder_name: str = Path(folder_path).name
            if self.app: self.app.after(0, lambda i=i, f=folder_name: self.seq_status_var.set(f"状态: 分析中 {i+1}/{total_folders_to_check}: {f}"))

            sequenced_files: List[Dict[str, Any]] = [] # 存储符合 GuXXX 格式的文件信息
            sequence_map: Dict[int, List[str]] = {} # 记录每个序号对应的文件名列表，用于查重

            for file_info in files:
                match: Optional[re.Match] = sequence_regex.search(file_info['filename'])
                if match:
                    try:
                        num: int = int(match.group(1))
                        sequenced_files.append({'num': num, 'filename': file_info['filename'], 'full_path': file_info['path']})
                        if num not in sequence_map: sequence_map[num] = []
                        sequence_map[num].append(file_info['filename'])
                    except ValueError:
                         log_message(f"无法解析序号: {file_info['filename']} in {folder_path}", "WARNING")

            if not sequenced_files: continue # 跳过没有 GuXXX 文件的文件夹

            total_folders_scanned += 1
            sequenced_files.sort(key=lambda x: x['num']) # 按序号排序
            folder_issues_text: List[str] = [] # 记录当前文件夹的问题
            needs_fixing: bool = False # 标记是否需要生成修复计划

            # 检查重复序号
            for num, filenames in sequence_map.items():
                if len(filenames) > 1:
                    folder_issues_text.append(f"  - 问题: 序号 {num} 重复 ({', '.join(filenames)})")
                    needs_fixing = True # 重复序号需要修复

            # 检查是否从 1 开始
            if sequenced_files[0]['num'] != 1:
                folder_issues_text.append(f"  - 问题: 不从 1 开始 (最小: {sequenced_files[0]['num']} - {sequenced_files[0]['filename']})")
                needs_fixing = True

            # 检查是否连续 (只在无重复序号时检查断裂)
            has_duplicates = any(len(v) > 1 for v in sequence_map.values())
            if not has_duplicates:
                for j in range(len(sequenced_files) - 1):
                    curr_num: int = sequenced_files[j]['num']
                    next_num: int = sequenced_files[j+1]['num']
                    if next_num != curr_num + 1:
                        folder_issues_text.append(f"  - 问题: 不连续，{curr_num} ({sequenced_files[j]['filename']}) 后是 {next_num} ({sequenced_files[j+1]['filename']})")
                        needs_fixing = True
                        # break # 找到一个断裂点即可

            # 如果有问题，记录日志
            if folder_issues_text:
                folders_with_issues += 1
                issues_log.append(f"文件夹: {folder_path}")
                issues_log.extend(folder_issues_text)
                issues_log.append("") # 加空行分隔

                # 如果需要修复，生成修复计划
                if needs_fixing:
                    current_fix_plan: Dict[str, Any] = {'folder_path': folder_path, 'files_to_rename': []}
                    new_seq_num: int = 1
                    # 按原始文件名排序，以确定重命名顺序
                    try:
                        # 使用 locale 感知排序
                        sorted_by_name = sorted(sequenced_files, key=cmp_to_key(lambda item1, item2: locale.strcoll(item1['filename'], item2['filename'])))
                    except locale.Error:
                        # locale 失败则回退到普通字符串排序
                        sorted_by_name = sorted(sequenced_files, key=lambda x: x['filename'])

                    for file_info in sorted_by_name:
                        # 保留原始扩展名
                        ext: str = Path(file_info['filename']).suffix or ".webp" # 默认 .webp
                        # 新文件名格式：文件夹名 + Gu + 新序号 + 扩展名
                        new_filename: str = f"{folder_name}Gu{new_seq_num}{ext}"
                        new_full_path: str = str(Path(folder_path) / new_filename)

                        # 只有当新旧文件名不同时才加入计划
                        if new_filename != file_info['filename']:
                            current_fix_plan['files_to_rename'].append({
                                'current_path': file_info['full_path'],
                                'new_path': new_full_path
                            })
                        new_seq_num += 1

                    if current_fix_plan['files_to_rename']:
                        fix_plan_details.append(current_fix_plan)

        log_message(f"序号检查分析完成，共检查 {total_folders_scanned} 个文件夹，发现 {folders_with_issues} 个有问题。", "INFO")
        return {"issues_log": issues_log, "fix_plan": fix_plan_details, "folders_with_issues": folders_with_issues}

    def on_sequence_check_complete(self, result: Dict[str, Any]) -> None:
        """序号检查完成的回调"""
        issues_log: List[str] = result.get("issues_log", [])
        fix_plan: List[Dict[str, Any]] = result.get("fix_plan", [])
        folders_with_issues: int = result.get("folders_with_issues", 0)

        self.seq_status_var.set(f"状态: 完成 ({folders_with_issues} 文件夹有问题)")

        if issues_log:
            self.append_text_safe(self.seq_results_text, "\n".join(issues_log))
            if fix_plan:
                self.seq_fix_plan = fix_plan
                if self.seq_rename_button:
                    self.seq_rename_button.configure(state=tk.NORMAL, text=f"执行物理重命名 ({len(fix_plan)} 个文件夹)")
                self.append_text_safe(self.seq_results_text, f"\n--- 检测到 {folders_with_issues} 个文件夹有问题，生成了 {len(fix_plan)} 个修复计划 ---\n")
                self.append_text_safe(self.seq_results_text, "警告：执行重命名是高风险操作，且不会更新 JSON！\n")
            else:
                self.append_text_safe(self.seq_results_text, f"\n--- 检测到 {folders_with_issues} 个文件夹有问题，但无法自动修复 (可能主要是重复序号) ---\n")
                if self.seq_rename_button:
                    self.seq_rename_button.configure(state=tk.DISABLED, text="执行物理重命名 (高风险!)")
                self.seq_fix_plan = []
        else:
            self.append_text_safe(self.seq_results_text, "\n--- 未发现序号问题 ---")
            if self.seq_rename_button:
                self.seq_rename_button.configure(state=tk.DISABLED, text="执行物理重命名 (高风险!)")
            self.seq_fix_plan = []

        if self.seq_start_button: self.seq_start_button.configure(state=tk.NORMAL)

    def on_sequence_check_error(self, error: Exception) -> None:
        """序号检查出错的回调"""
        self.seq_status_var.set("状态: 错误!")
        self.append_text_safe(self.seq_results_text, f"\n--- 序号检查出错 ---\n{error}\n")
        log_message(f"序号检查出错: {error}", "ERROR")
        if self.seq_start_button: self.seq_start_button.configure(state=tk.NORMAL)
        if self.seq_rename_button: self.seq_rename_button.configure(state=tk.DISABLED)

    # --- 序号重命名 ---
    def start_sequence_rename_task(self) -> None:
        """启动物理文件重命名任务"""
        if not self.seq_fix_plan:
            messagebox.showinfo("提示", "没有可执行的修复计划。")
            return

        if messagebox.askyesno("高风险操作确认", f"即将对 {len(self.seq_fix_plan)} 个文件夹中的文件进行物理重命名！\n\n此操作【不可逆】，且【不会】更新 JSON 数据！\n执行后需手动在“数据列表”中编辑路径或重新运行仓库核对。\n\n强烈建议备份！确定要继续吗？", icon='warning'):
            if self.seq_rename_button: self.seq_rename_button.configure(state=tk.DISABLED, text="重命名中...")
            if self.seq_start_button: self.seq_start_button.configure(state=tk.DISABLED) # 禁用检查按钮
            self.seq_status_var.set("状态: 重命名中...")

            run_in_thread(
                self.sequence_rename_task, self.seq_fix_plan, # 传递修复计划
                task_key="seq_rename",
                on_complete=self.on_sequence_rename_complete,
                on_error=self.on_sequence_rename_error
            )

    def sequence_rename_task(self, fix_plan: List[Dict[str, Any]]) -> Dict[str, int]:
        """后台任务：执行物理文件重命名 (两阶段)"""
        if "seq_rename" in task_status_vars: task_status_vars["seq_rename"] = self.seq_status_var
        total_renamed: int = 0
        total_errors: int = 0
        log_message("开始执行物理文件重命名...")
        if self.app: self.app.after(0, lambda: self.seq_status_var.set("状态: 重命名中..."))

        # --- 两阶段重命名策略 ---
        # 阶段一：将所有要重命名的文件添加临时后缀，避免冲突
        # 阶段二：移除临时后缀，完成重命名
        temp_suffix: str = f"_temp_{random.randint(1000, 9999)}"
        rename_ops_stage1: List[Dict[str, str]] = [] # old -> temp
        rename_ops_stage2: List[Dict[str, str]] = [] # temp -> new

        # 构建两阶段操作列表
        for folder_plan in fix_plan:
            folder_path = folder_plan['folder_path']
            for rename_op in folder_plan['files_to_rename']:
                old_p: str = rename_op['current_path']
                new_p: str = rename_op['new_path']
                # 检查目标路径是否已存在 (理论上不应发生，除非计划生成有误)
                if is_file(new_p):
                     log_message(f"重命名冲突：目标文件已存在 {new_p}，跳过 {old_p}", "ERROR")
                     total_errors += 1
                     continue
                # 临时路径
                temp_p: str = old_p + temp_suffix # 在原路径加后缀，避免跨目录问题
                rename_ops_stage1.append({'old': old_p, 'new': temp_p})
                rename_ops_stage2.append({'old': temp_p, 'new': new_p})

        # --- 执行阶段一 ---
        log_message(f"重命名阶段一 ({len(rename_ops_stage1)} 个)...")
        errors_stage1 = 0
        for op in rename_ops_stage1:
            try:
                if is_file(op['old']):
                    os.rename(op['old'], op['new'])
                else:
                    log_message(f"跳过阶段一：源文件不存在 {op['old']}", "WARNING")
                    # 如果源文件不存在，也需要从阶段二移除对应操作
                    rename_ops_stage2 = [op2 for op2 in rename_ops_stage2 if op2['old'] != op['new']]
            except Exception as e:
                log_message(f"重命名阶段一失败: {op['old']} -> {op['new']} - {e}", "ERROR")
                errors_stage1 += 1
                # 如果阶段一失败，也移除阶段二对应操作
                rename_ops_stage2 = [op2 for op2 in rename_ops_stage2 if op2['old'] != op['new']]

        total_errors += errors_stage1
        log_message(f"重命名阶段一完成，发生 {errors_stage1} 个错误。")

        # --- 执行阶段二 ---
        log_message(f"重命名阶段二 ({len(rename_ops_stage2)} 个)...")
        errors_stage2 = 0
        for op in rename_ops_stage2:
            try:
                if is_file(op['old']):
                    os.rename(op['old'], op['new'])
                    total_renamed += 1
                else:
                    # 临时文件不存在，可能是阶段一就失败了
                    log_message(f"跳过阶段二：临时文件不存在 {op['old']}", "WARNING")
            except Exception as e:
                log_message(f"重命名阶段二失败: {op['old']} -> {op['new']} - {e}", "ERROR")
                errors_stage2 += 1

        total_errors += errors_stage2
        log_message(f"重命名阶段二完成，发生 {errors_stage2} 个错误。")

        return {"renamed": total_renamed, "errors": total_errors}

    def on_sequence_rename_complete(self, result: Dict[str, int]) -> None:
        """物理重命名完成的回调"""
        renamed_count: int = result.get("renamed", 0)
        error_count: int = result.get("errors", 0)
        self.seq_status_var.set(f"状态: 重命名完成 (成功: {renamed_count}, 失败: {error_count})")

        message: str = (f"物理文件重命名完成！\n成功: {renamed_count} 文件。\n失败/跳过: {error_count} 次操作。\n\n"
                       "重要提示：请务必前往“数据列表”手动更新路径，或重新运行“仓库核对”填充 storagebox！")
        log_message(f"物理文件重命名完成。成功: {renamed_count}, 失败: {error_count}")
        messagebox.showinfo("重命名完成", message)

        # 恢复按钮状态
        if self.seq_rename_button: self.seq_rename_button.configure(text="执行物理重命名 (高风险!)", state=tk.DISABLED) # 重命名后禁用，需重新检查
        if self.seq_start_button: self.seq_start_button.configure(state=tk.NORMAL)
        self.seq_fix_plan = [] # 清空计划

    def on_sequence_rename_error(self, error: Exception) -> None:
        """物理重命名出错的回调"""
        self.seq_status_var.set("状态: 重命名错误!")
        messagebox.showerror("重命名失败", f"执行物理文件重命名时发生错误:\n{error}")
        log_message(f"物理重命名出错: {error}", "ERROR")
        # 恢复按钮状态 (允许重试检查，但不允许重试重命名)
        if self.seq_rename_button: self.seq_rename_button.configure(state=tk.DISABLED) # 出错后禁用
        if self.seq_start_button: self.seq_start_button.configure(state=tk.NORMAL)

    # --- JSON 检查 ---
    def start_json_check_task(self) -> None:
        """启动 JSON 检查任务 (检查文件是否存在)"""
        if not main_repo_path: messagebox.showwarning("提示", "请先选择主仓库。"); return
        if self.json_check_start_button: self.json_check_start_button.configure(state=tk.DISABLED)
        self.json_check_status_var.set("状态: 准备中...")
        if self.json_check_results_text:
            self.json_check_results_text.configure(state=tk.NORMAL)
            self.json_check_results_text.delete("1.0", tk.END)
            self.append_text_safe(self.json_check_results_text, "开始 JSON 检查 (只读模式)...\n")
            self.json_check_results_text.configure(state=tk.DISABLED)

        run_in_thread(
            self.json_check_task,
            task_key="json_check",
            on_complete=self.on_json_check_complete,
            on_error=self.on_json_check_error
        )

    def json_check_task(self) -> List[Dict[str, str]]:
        """后台任务：检查 JSON 中记录的文件是否在物理上存在"""
        if "json_check" in task_status_vars: task_status_vars["json_check"] = self.json_check_status_var
        missing_files: List[Dict[str, str]] = []
        checked_count: int = 0
        total_entries: int = len(image_data_cache)
        if self.app: self.app.after(0, lambda: self.json_check_status_var.set(f"状态: 检查中 0/{total_entries}"))

        for i, entry in enumerate(image_data_cache):
            if not isinstance(entry, dict): continue

            relative_path: Optional[str] = entry.get('path')
            if not relative_path: continue # 跳过无路径记录

            # 使用 get_physical_path 查找文件
            physical_path: Optional[str] = get_physical_path(entry)

            if not physical_path:
                # 文件未找到
                missing_files.append({
                    'path': relative_path,
                    'filename': entry.get('attributes', {}).get('filename', '未知'),
                    'character': entry.get('characterName', '未知'),
                    'gid': str(entry.get('gid', 'N/A')),
                    'storagebox': entry.get('storagebox', '未指定')
                })
                log_message(f"JSON 检查：文件缺失 {relative_path} (Storagebox: {entry.get('storagebox', '无')})", "WARNING")

            checked_count += 1
            # 更新状态 (节流)
            if i % 100 == 0 or i == total_entries - 1:
                if self.app: self.app.after(0, lambda i=i: self.json_check_status_var.set(f"状态: 检查中 {i+1}/{total_entries}"))

        log_message(f"JSON 检查完成，共检查 {checked_count} 条记录，发现 {len(missing_files)} 个文件缺失。", "INFO")
        return missing_files

    def on_json_check_complete(self, missing_files: List[Dict[str, str]]) -> None:
        """JSON 检查完成的回调"""
        self.json_check_status_var.set(f"状态: 完成 ({len(missing_files)} 缺失)")
        if missing_files:
            self.append_text_safe(self.json_check_results_text, f"\n--- 发现 {len(missing_files)} 个文件缺失记录 ---\n")
            for item in missing_files:
                self.append_text_safe(self.json_check_results_text, f"路径: {item['path']}\n")
                self.append_text_safe(self.json_check_results_text, f"  文件名: {item['filename']} (角色: {item['character']}, GID: {item['gid']})\n")
                self.append_text_safe(self.json_check_results_text, f"  记录仓库: {item['storagebox']}\n\n")
        else:
            self.append_text_safe(self.json_check_results_text, "\n--- 未发现文件缺失记录 ---")
        if self.json_check_start_button: self.json_check_start_button.configure(state=tk.NORMAL)

    def on_json_check_error(self, error: Exception) -> None:
        """JSON 检查出错的回调"""
        self.json_check_status_var.set("状态: 错误!")
        self.append_text_safe(self.json_check_results_text, f"\n--- JSON 检查出错 ---\n{error}\n")
        log_message(f"JSON 检查出错: {error}", "ERROR")
        if self.json_check_start_button: self.json_check_start_button.configure(state=tk.NORMAL)

    def on_activate(self) -> None:
        """页面激活时的操作"""
        log_message("维护工具页面已激活。")
        # 可以在此重置状态或提示用户
        # self.reset_ui() # 每次激活都重置

    def reset_ui(self) -> None:
        """重置页面 UI"""
        # MD5 Tab
        self.md5_status_var.set("状态: 未开始")
        if self.md5_results_text:
            try:
                self.md5_results_text.configure(state=tk.NORMAL)
                self.md5_results_text.delete("1.0", tk.END)
                self.md5_results_text.configure(state=tk.DISABLED)
            except tk.TclError: pass
        if self.md5_start_button: self.md5_start_button.configure(state=tk.NORMAL)

        # Sequence Tab
        self.seq_status_var.set("状态: 未开始")
        if self.seq_results_text:
            try:
                self.seq_results_text.configure(state=tk.NORMAL)
                self.seq_results_text.delete("1.0", tk.END)
                self.seq_results_text.configure(state=tk.DISABLED)
            except tk.TclError: pass
        if self.seq_start_button: self.seq_start_button.configure(state=tk.NORMAL)
        if self.seq_rename_button: self.seq_rename_button.configure(state=tk.DISABLED, text="执行物理重命名 (高风险!)")
        self.seq_fix_plan = []

        # JSON Check Tab
        self.json_check_status_var.set("状态: 未开始")
        if self.json_check_results_text:
            try:
                self.json_check_results_text.configure(state=tk.NORMAL)
                self.json_check_results_text.delete("1.0", tk.END)
                self.json_check_results_text.configure(state=tk.DISABLED)
            except tk.TclError: pass
        if self.json_check_start_button: self.json_check_start_button.configure(state=tk.NORMAL)

        log_message("维护工具页面 UI 已重置。")


# --- GUI 应用主类 ---
class GuGuNiuApp(ctk.CTk):
    """应用主窗口类"""
    def __init__(self):
        super().__init__()
        global app_instance, config_file_path, JSONGEN_PLACEHOLDER_IMAGE
        app_instance = self
        config_file_path = get_config_path() # 获取配置文件路径

        self.title(APP_TITLE)
        self.geometry("1400x850")
        self.minsize(1100, 700)

        # --- 状态变量 ---
        self.selected_repo_path_var: tk.StringVar = tk.StringVar(value="请选择主仓库...")
        self.repo_status_label_var: tk.StringVar = tk.StringVar(value="仓库状态: 未加载")

        # --- 内部状态 ---
        self.current_content_frame: Optional[ctk.CTkFrame] = None # 当前显示的内容 Frame
        self.sidebar_buttons: Dict[str, ctk.CTkButton] = {} # 侧边栏按钮映射
        self.frames: Dict[str, ctk.CTkFrame] = {} # 存储所有内容 Frame
        self.edit_modal: Optional[EditAttributeModal] = None # 编辑模态框实例
        self.jsongen_thumb_workers: List[threading.Thread] = [] # JsonGen 缩略图线程列表
        self.jsongen_thumb_workers_started: bool = False # 标记 JsonGen 线程是否已启动

        # --- 初始化 ---
        # 尝试加载配置并初始化路径/数据
        if not load_configuration_and_initialize():
            # 配置加载失败或首次运行，提示用户选择仓库
            self.after(100, self.prompt_select_repo) # 延迟执行，确保窗口已显示
        else:
            # 加载成功，更新显示
            if main_repo_path:
                self.selected_repo_path_var.set(main_repo_path)
                self.repo_status_label_var.set(f"当前: {os.path.basename(main_repo_path)} (共 {len(all_repo_paths)} 个)")
            else: # 初始化成功但 main_repo_path 仍为空？理论上不应发生
                 log_message("初始化后主仓库路径仍为空，状态异常。", "ERROR")
                 self.repo_status_label_var.set("仓库状态: 异常")


        # --- 创建 UI ---
        self.grid_columnconfigure(1, weight=1) # 内容区列占满剩余空间
        self.grid_rowconfigure(1, weight=1) # 内容区行占满剩余空间
        self.grid_rowconfigure(2, weight=0) # 日志区固定高度

        self.create_sidebar()
        self.create_content_area()
        self.create_log_area()
        self.create_content_frames()

        # --- 初始页面 ---
        self.select_frame_by_name('data_list') # 默认显示数据列表

        # --- 启动日志更新 ---
        if self.log_textbox: # 确保 log_textbox 已创建
            self.after(100, lambda: update_gui_from_queue(self.log_textbox))

        # --- 创建 JsonGen 占位符 ---
        try:
            placeholder: Image.Image = Image.new('RGB', JSONGEN_THUMB_SIZE, color = '#E0E0E0')
            # 直接创建 CTkImage，无需 ImageTk
            self.jsongen_placeholder_image = ctk.CTkImage(light_image=placeholder, dark_image=placeholder, size=JSONGEN_THUMB_SIZE)
            # 全局变量也用这个 CTkImage 对象
            JSONGEN_PLACEHOLDER_IMAGE = self.jsongen_placeholder_image
            log_message("JSON生成占位符图片创建成功。", "DEBUG")
        except Exception as e:
            log_message(f"创建JSON生成占位符图片失败: {e}", "ERROR")
            self.jsongen_placeholder_image = None
            JSONGEN_PLACEHOLDER_IMAGE = None


        # --- 绑定关闭事件 ---
        self.protocol("WM_DELETE_WINDOW", self.on_closing)

    def prompt_select_repo(self) -> None:
        """提示用户选择主仓库目录"""
        # 确保窗口可见时才弹窗
        if not self.winfo_viewable():
            self.after(200, self.prompt_select_repo) # 稍后重试
            return
        messagebox.showinfo("首次使用或未找到仓库", "请选择您的主图片仓库根目录 (例如 Miao-Plugin-MBT)。")
        self.browse_repo_root() # 调用选择目录函数

    def create_sidebar(self) -> None:
        """创建左侧边栏"""
        self.sidebar_frame: ctk.CTkFrame = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, rowspan=3, sticky="nsw") # 跨越所有行
        self.sidebar_frame.grid_rowconfigure(6, weight=1) # 让底部版本号靠下

        # 标题
        ctk.CTkLabel(self.sidebar_frame, text="咕咕牛工具箱", font=ctk.CTkFont(size=20, weight="bold")).grid(row=0, column=0, padx=20, pady=(20, 10))

        # 导航按钮
        button_pady: int = 8
        button_text_color: Tuple[str, str] = ("#000000", "#DCE4EE") # 黑/浅灰
        button_hover_color: Tuple[str, str] = ("#DFE1E5", "#2B2D30") # 浅灰/深灰

        btn_config: List[Tuple[str, str]] = [
            ('data_list', "数据列表"),
            ('json_gen', "JSON生成"),
            ('repo_check', "仓库核对"),
            ('tools', "维护工具")
        ]
        for i, (name, text) in enumerate(btn_config):
            button: ctk.CTkButton = ctk.CTkButton(
                self.sidebar_frame,
                text=text,
                command=partial(self.select_frame_by_name, name),
                text_color=button_text_color,
                fg_color="transparent", # 默认透明
                hover_color=button_hover_color
            )
            button.grid(row=i + 1, column=0, padx=20, pady=button_pady, sticky="ew")
            self.sidebar_buttons[name] = button

        # 仓库信息和选择按钮
        repo_frame: ctk.CTkFrame = ctk.CTkFrame(self.sidebar_frame, fg_color="transparent")
        repo_frame.grid(row=len(btn_config) + 1, column=0, padx=10, pady=(20, 5), sticky="ew")
        repo_frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(repo_frame, textvariable=self.repo_status_label_var, font=ctk.CTkFont(size=10), anchor="w", wraplength=180).grid(row=0, column=0, padx=5, pady=(0, 5), sticky="ew") # 增加换行宽度
        ctk.CTkButton(repo_frame, text="选择主仓库", command=self.browse_repo_root, height=25, font=ctk.CTkFont(size=11)).grid(row=1, column=0, padx=5, pady=0, sticky="ew")

        # 版本号标签 (靠底部)
        version_str = APP_TITLE.split('v')[-1].split(' ')[0] if 'v' in APP_TITLE else '未知'
        ctk.CTkLabel(self.sidebar_frame, text=f"版本: {version_str}", font=ctk.CTkFont(size=10), text_color="gray").grid(row=6, column=0, padx=20, pady=(10, 10), sticky="sw")

    def create_content_area(self) -> None:
        """创建右侧主内容区域的容器"""
        self.content_frame: ctk.CTkFrame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.content_frame.grid(row=1, column=1, sticky="nsew", padx=0, pady=0)
        self.content_frame.grid_columnconfigure(0, weight=1)
        self.content_frame.grid_rowconfigure(0, weight=1)

    def create_log_area(self) -> None:
        """创建底部日志显示区域"""
        log_frame_container: ctk.CTkFrame = ctk.CTkFrame(self, height=150) # 固定高度容器
        log_frame_container.grid(row=2, column=1, padx=10, pady=(0, 10), sticky="ew")
        log_frame_container.grid_columnconfigure(0, weight=1)
        log_frame_container.grid_rowconfigure(0, weight=1)
        # 设置 grid_propagate 为 False 防止内部 Textbox 撑开容器
        log_frame_container.grid_propagate(False)

        self.log_textbox: ctk.CTkTextbox = ctk.CTkTextbox(log_frame_container, wrap=tk.WORD, state=tk.DISABLED, font=ctk.CTkFont(family="Consolas", size=11))
        self.log_textbox.grid(row=0, column=0, sticky="nsew") # 填满容器

    def create_content_frames(self) -> None:
        """创建所有功能页面的 Frame 实例"""
        self.frames['data_list'] = DataListFrame(self.content_frame, self)
        self.frames['json_gen'] = JsonGenFrame(self.content_frame, self)
        self.frames['repo_check'] = RepoCheckFrame(self.content_frame, self)
        self.frames['tools'] = ToolsFrame(self.content_frame, self)

        # 将所有 Frame 放置在 content_frame 中，但初始隐藏
        for frame in self.frames.values():
            frame.grid(row=0, column=0, sticky="nsew", padx=0, pady=0) # 无内边距
            frame.grid_remove() # 初始隐藏

    def select_frame_by_name(self, frame_name: str) -> None:
        """
        根据名称显示对应的功能页面 Frame。

        Args:
            frame_name: 要显示的 Frame 的键名。
        """
        # 检查仓库是否已选择 (某些页面需要)
        if not main_repo_path and frame_name not in ['repo_check']: # 仓库核对页允许未选仓库时进入
            messagebox.showwarning("提示", "请先选择主仓库。")
            # 可以选择跳转到仓库核对页或停留在当前页
            # self.select_frame_by_name('repo_check')
            return

        # --- 更新侧边栏按钮样式 ---
        active_color: Tuple[str, str] = ("#3a7ebf", "#1f538d") # 深蓝/更深蓝
        inactive_color: str = "transparent"
        active_text_color: Tuple[str, str] = ("#ffffff", "#ffffff") # 白色
        inactive_text_color: Tuple[str, str] = ("#000000", "#DCE4EE") # 黑/浅灰
        button_hover_color: Tuple[str, str] = ("#DFE1E5", "#2B2D30") # 浅灰/深灰

        for name, button in self.sidebar_buttons.items():
            is_active = (name == frame_name)
            button.configure(
                fg_color=active_color if is_active else inactive_color,
                text_color=active_text_color if is_active else inactive_text_color,
                hover_color=active_color if is_active else button_hover_color # 激活时悬停不变色
            )

        # --- 切换内容 Frame ---
        # 隐藏当前 Frame
        if self.current_content_frame:
            self.current_content_frame.grid_remove()

        # 显示目标 Frame
        frame_to_show: Optional[ctk.CTkFrame] = self.frames.get(frame_name)
        if frame_to_show:
            self.current_content_frame = frame_to_show
            self.current_content_frame.grid() # 显示 Frame
            # 调用 Frame 的激活方法 (如果存在)
            if hasattr(frame_to_show, 'on_activate'):
                try:
                    frame_to_show.on_activate()
                except Exception as e:
                     log_message(f"激活页面 '{frame_name}' 时出错: {e}", "ERROR")
        else:
            log_message(f"错误：找不到名为 '{frame_name}' 的界面框架。", "ERROR")

    def browse_repo_root(self) -> None:
        """打开目录选择对话框让用户选择主仓库"""
        current_path: str = self.selected_repo_path_var.get()
        initial_dir: str = "/"
        # 尝试使用当前路径的父目录作为初始目录
        if path_exists(current_path) and is_directory(current_path):
             initial_dir = current_path
        elif path_exists(os.path.dirname(current_path)):
             initial_dir = os.path.dirname(current_path)


        folder_selected: Optional[str] = filedialog.askdirectory(
            title="请选择主图片仓库根目录 (例如 Miao-Plugin-MBT)",
            initialdir=initial_dir
        )

        if folder_selected:
            # 规范化路径
            folder_selected = str(Path(folder_selected).resolve())
            log_message(f"用户选择了新的主仓库路径: {folder_selected}")

            # 尝试初始化
            if initialize_paths_and_data(folder_selected):
                if main_repo_path: # 确保初始化后 main_repo_path 有效
                    self.selected_repo_path_var.set(main_repo_path)
                    self.repo_status_label_var.set(f"当前: {os.path.basename(main_repo_path)} (共 {len(all_repo_paths)} 个)")
                    log_message("仓库路径和数据初始化成功。")
                    save_configuration(main_repo_path) # 保存新路径到配置
                    self.reset_and_reload_all_frames() # 重置所有页面
                else:
                     messagebox.showerror("初始化异常", f"仓库初始化后未能获取有效主仓库路径。\n路径: {folder_selected}")
                     self.selected_repo_path_var.set("初始化异常，请重选")
                     self.repo_status_label_var.set("仓库状态: 错误")
            else:
                messagebox.showerror("初始化失败", f"无法初始化仓库路径或加载数据，请检查日志。\n路径: {folder_selected}")
                self.selected_repo_path_var.set("初始化失败，请重选")
                self.repo_status_label_var.set("仓库状态: 错误")

    def reset_and_reload_all_frames(self) -> None:
        """重置所有功能页面的状态并重新加载当前页面"""
        log_message("正在重置所有页面状态...")
        current_frame_name = None
        # 找到当前显示的 frame name
        for name, frame in self.frames.items():
            if frame == self.current_content_frame:
                current_frame_name = name
                break

        # 重置所有 frame 的 UI
        for frame in self.frames.values():
            if hasattr(frame, 'reset_ui'):
                try:
                    frame.reset_ui()
                except Exception as e:
                     log_message(f"重置页面 UI 时出错 ({type(frame).__name__}): {e}", "ERROR")

        # 重新激活当前页面 (如果找到了)
        if current_frame_name:
             log_message(f"重新加载当前页面: {current_frame_name}")
             self.select_frame_by_name(current_frame_name)
        else: # 如果没有当前页面，默认加载第一个
             log_message("重新加载默认页面: data_list")
             self.select_frame_by_name('data_list')

        log_message("页面状态重置和重新加载完成。")

    def load_and_resize_image(self, image_path: str, size: Tuple[int, int]) -> Optional[Image.Image]:
        """
        加载图片并调整大小，返回 PIL Image 对象。

        Args:
            image_path: 图片文件路径。
            size: 目标缩略图尺寸 (宽, 高)。

        Returns:
            调整大小后的 PIL Image 对象，或 None。
        """
        try:
            with Image.open(image_path) as img:
                # 使用 thumbnail 保留纵横比进行缩放
                img.thumbnail(size, Image.Resampling.LANCZOS)
                # 确保转换为 RGBA 以支持透明度等
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')
                return img.copy() # 返回 PIL Image 对象副本
        except FileNotFoundError:
             # log_message(f"加载图片失败: 文件未找到 {os.path.basename(image_path)}", "DEBUG") # 减少日志噪音
             return None
        except Exception as e:
            # log_message(f"加载或调整图片大小失败: {os.path.basename(image_path)} - {e}", "WARNING")
            return None

    def on_closing(self) -> None:
        """处理窗口关闭事件"""
        global app_running, hover_preview_window
        if messagebox.askokcancel("退出", "确定要退出咕咕牛工具箱吗？"):
            log_message("应用正在关闭...")
            app_running = False # 设置全局标志，通知后台线程退出

            # 关闭悬浮预览窗口
            if hover_preview_window and hover_preview_window.winfo_exists():
                try: hover_preview_window.destroy()
                except: pass

            # 停止 JsonGen 缩略图线程
            try:
                for _ in range(JSONGEN_THUMB_WORKER_COUNT):
                    JSONGEN_THUMB_REQ_QUEUE.put(None) # 发送停止信号
                # 等待线程结束 (可选，设置超时)
                # for worker in self.jsongen_thumb_workers:
                #     worker.join(timeout=0.5)
            except Exception as e:
                 log_message(f"停止 JsonGen 线程时出错: {e}", "WARNING")

            # 销毁主窗口
            self.destroy()

# --- 初始化函数 ---
def initialize_application() -> None:
    """执行应用启动前的初始化"""
    # 加载配置，如果失败，后续会提示用户选择
    load_configuration_and_initialize()

# --- 主程序入口 ---
if __name__ == '__main__':
    setup_logging() # 配置日志
    try:
        Image.init() # 初始化 Pillow 支持的格式
    except Exception as e:
         log_message(f"Pillow 初始化失败: {e}", "ERROR")

    initialize_application() # 加载配置等

    app: GuGuNiuApp = GuGuNiuApp() # 创建主应用实例
    app.mainloop() # 进入 Tkinter 事件循环