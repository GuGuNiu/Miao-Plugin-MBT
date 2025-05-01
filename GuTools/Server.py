import tkinter as tk
from tkinter import ttk, scrolledtext, filedialog, messagebox
import os
import sys
import json
import yaml
import hashlib
import threading
import logging
import re
import shutil
import random
import string
import time
import traceback
import datetime
from pathlib import Path
from typing import Union, List, Dict, Tuple, Optional, Any, Set, Callable
from werkzeug.utils import secure_filename
from werkzeug.serving import make_server, BaseWSGIServer
from urllib.parse import unquote
from flask import Flask, request, jsonify, send_from_directory, Response, current_app, abort
from flask_cors import CORS

# --- 常量 ---
DEFAULT_PORT = 3000
ALLOWED_IMAGE_EXTENSIONS = {'.webp', '.png', '.jpg', '.jpeg', '.gif'}
IMGTEMP_DIRECTORY_NAME = 'imgtemp'
GALLERY_DATA_DIRECTORY_NAME = 'GuGuNiu-Gallery'
GUTOOLS_DIRECTORY_NAME = 'GuTools'
INTERNAL_DATA_FILENAME = "ImageData.json"
EXTERNAL_DATA_FILENAME = "ExternalImageData.json"
GALLERY_CONFIG_FILENAME = "GalleryConfig.yaml"
BACKGROUND_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'}
MAIN_GALLERY_TYPES = ["gs-character", "sr-character", "zzz-character", "waves-character"]
DEFAULT_MAIN_REPO_PATH = "E:\\data\\Github\\Miao-Plugin-MBT"

# --- 日志设置 ---
log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("GuToolsPyServer")
logger.setLevel(logging.DEBUG)
logger.propagate = False

for handler in logger.handlers[:]:
    logger.removeHandler(handler)
    handler.close()

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(log_formatter)
logger.addHandler(console_handler)

# --- 全局状态 ---
server_thread: Optional[threading.Thread] = None
flask_server: Optional[BaseWSGIServer] = None
stop_event = threading.Event()
main_app_instance: Optional['Application'] = None

# --- 应用上下文类 ---
class AppContext:
    def __init__(self):
        self.main_repo_path: Optional[Path] = None
        self.detected_repositories: Dict[str, Path] = {}
        self.port: int = DEFAULT_PORT

    def set_main_repo_path(self, path_str: str) -> bool:
        logger.info(f"尝试设置主仓库路径: {path_str}")
        self.main_repo_path = None
        self.detected_repositories = {}
        if not path_str:
            logger.warning("主仓库路径为空。")
            return False
        try:
            main_path = Path(path_str).resolve()
            if not main_path.is_dir():
                logger.error(f"无效的主仓库路径 (不是目录): {path_str}")
                return False

            self.main_repo_path = main_path
            self.detect_repositories()
            logger.info(f"主仓库已设置为: {self.main_repo_path}")
            return True
        except Exception as e:
            logger.error(f"解析主仓库路径 '{path_str}' 时出错: {e}")
            self.main_repo_path = None
            self.detected_repositories = {}
            return False

    def detect_repositories(self):
        if not self.main_repo_path:
            logger.warning("无法在没有主路径的情况下检测仓库。")
            return

        repos = {}
        main_repo_name = self.main_repo_path.name
        repos[main_repo_name] = self.main_repo_path
        logger.info(f"主仓库确认: {main_repo_name} -> {self.main_repo_path}")

        if not (self.main_repo_path / GUTOOLS_DIRECTORY_NAME).is_dir():
             logger.warning(f"在主仓库中未找到 '{GUTOOLS_DIRECTORY_NAME}' 目录。")
        if not (self.main_repo_path / GALLERY_DATA_DIRECTORY_NAME).is_dir():
             logger.warning(f"在主仓库中未找到 '{GALLERY_DATA_DIRECTORY_NAME}' 目录。")

        parent_dir = self.main_repo_path.parent
        base_name = main_repo_name
        match = re.match(r'^(.*)-(\d+)$', main_repo_name)
        if match:
            base_name = match.group(1)
        repo_pattern = re.compile(f"^{re.escape(base_name)}-\\d+$")

        try:
            for item in parent_dir.iterdir():
                if item.is_dir() and item != self.main_repo_path and repo_pattern.match(item.name):
                    repos[item.name] = item.resolve()
                    logger.info(f"检测到同级仓库: {item.name} -> {repos[item.name]}")
        except OSError as e:
            logger.error(f"在 {parent_dir} 中扫描同级仓库时出错: {e}")
        except Exception as e:
            logger.error(f"扫描同级仓库时发生意外错误: {e}", exc_info=True)


        self.detected_repositories = repos
        logger.info(f"仓库检测完成。总共找到 {len(repos)} 个仓库。")

    def get_gu_tools_dir(self) -> Optional[Path]:
        return self.main_repo_path / GUTOOLS_DIRECTORY_NAME if self.main_repo_path else None

    def get_gallery_data_dir(self) -> Optional[Path]:
        return self.main_repo_path / GALLERY_DATA_DIRECTORY_NAME if self.main_repo_path else None

    def get_internal_data_path(self) -> Optional[Path]:
        data_dir = self.get_gallery_data_dir()
        return data_dir / INTERNAL_DATA_FILENAME if data_dir else None

    def get_external_data_path(self) -> Optional[Path]:
        data_dir = self.get_gallery_data_dir()
        return data_dir / EXTERNAL_DATA_FILENAME if data_dir else None

    def get_gallery_config_yaml_path(self) -> Optional[Path]:
        data_dir = self.get_gallery_data_dir()
        return data_dir / GALLERY_CONFIG_FILENAME if data_dir else None

    def get_imgtemp_directory(self) -> Optional[Path]:
        tools_dir = self.get_gu_tools_dir()
        return tools_dir / IMGTEMP_DIRECTORY_NAME if tools_dir else None

    def get_img_directory(self) -> Optional[Path]:
        tools_dir = self.get_gu_tools_dir()
        return tools_dir / 'img' if tools_dir else None

    def safe_path_join(self, base_path: Path, *parts: str) -> Optional[Path]:
        if not base_path:
            return None
        try:
            cleaned_parts = [secure_filename(part.lstrip('/\\')) for part in parts if part]
            if any('/' in p or '\\' in p or '..' in p for p in cleaned_parts):
                 logger.warning(f"路径连接中可能存在不安全的组件: {parts}")
                 return None

            target_path = base_path.joinpath(*cleaned_parts).resolve()

            if base_path.resolve() in target_path.parents or base_path.resolve() == target_path:
                 return target_path
            else:
                 logger.error(f"检测到路径遍历尝试或无效的路径构造: {base_path} + {parts} -> {target_path}")
                 return None
        except Exception as e:
            logger.error(f"连接路径 {base_path} 和 {parts} 时出错: {e}", exc_info=True)
            return None

    def resolve_relative_path(self, relative_path_str: str) -> Tuple[Optional[Path], Optional[str]]:
        if not relative_path_str or not self.detected_repositories:
            logger.debug(f"解析路径失败: 路径为空或未检测到仓库 ('{relative_path_str}')")
            return None, None

        try:
            decoded_relative_path_str = unquote(relative_path_str, encoding='utf-8')
            relative_path = Path(decoded_relative_path_str.replace('\\', '/').lstrip('/'))
            if '..' in relative_path.parts:
                 logger.warning(f"在 '{relative_path_str}' 中检测到路径遍历组件 '..', 已拒绝。")
                 return None, None
        except Exception as e:
            logger.warning(f"对 '{relative_path_str}' 进行 URL 解码/路径创建失败: {e}")
            return None, None

        logger.debug(f"正在解析相对路径: '{relative_path}'")

        if self.main_repo_path:
            main_repo_name = self.main_repo_path.name
            try:
                potential_path = (self.main_repo_path / relative_path).resolve()
                if potential_path.is_file() and self.main_repo_path.resolve() in potential_path.parents:
                    logger.debug(f"  在主仓库 '{main_repo_name}' 中找到: {potential_path}")
                    return potential_path, main_repo_name
            except OSError as e:
                 logger.debug(f"  检查主仓库路径 '{potential_path}' 时发生 OS 错误: {e}")
            except Exception as e:
                 logger.error(f"  检查主仓库路径 '{potential_path}' 时发生意外错误: {e}", exc_info=True)

        logger.debug("  在主仓库中未找到，正在检查其他仓库...")
        for repo_name, repo_path in self.detected_repositories.items():
            if repo_path == self.main_repo_path:
                continue
            try:
                potential_path = (repo_path / relative_path).resolve()
                if potential_path.is_file() and repo_path.resolve() in potential_path.parents:
                    logger.debug(f"  在同级仓库 '{repo_name}' 中找到: {potential_path}")
                    return potential_path, repo_name
            except OSError as e:
                 logger.debug(f"  检查仓库 '{repo_name}' 路径 '{potential_path}' 时发生 OS 错误: {e}")
            except Exception as e:
                 logger.error(f"  检查仓库 '{repo_name}' 路径 '{potential_path}' 时发生意外错误: {e}", exc_info=True)

        logger.warning(f"无法在任何仓库中将相对路径 '{relative_path_str}' 解析为文件。")
        return None, None

    def find_character_folder(self, character_name: str) -> Tuple[Optional[Path], Optional[str], Optional[str]]:
        if not character_name or not self.detected_repositories:
            return None, None, None

        try:
            decoded_char_name = secure_filename(unquote(character_name, encoding='utf-8'))
            if not decoded_char_name or '..' in decoded_char_name:
                 logger.warning(f"净化后的角色名称无效: '{character_name}' -> '{decoded_char_name}'")
                 return None, None, None
        except Exception as e:
            logger.warning(f"对角色名称 '{character_name}' 进行 URL 解码失败: {e}")
            decoded_char_name = character_name

        logger.debug(f"正在搜索角色文件夹: '{decoded_char_name}'")

        def check_repo(repo_path: Path, repo_name: str) -> Tuple[Optional[Path], Optional[str], Optional[str]]:
            for gallery_type in MAIN_GALLERY_TYPES:
                try:
                    potential_path = (repo_path / gallery_type / decoded_char_name).resolve()
                    if potential_path.is_dir() and repo_path.resolve() in potential_path.parents:
                         logger.debug(f"  在 '{repo_name}/{gallery_type}' 中找到: {potential_path}")
                         return potential_path, repo_name, gallery_type
                except OSError: pass
                except Exception as e: logger.error(f" 检查 {potential_path} 时出错: {e}", exc_info=True)
            return None, None, None

        if self.main_repo_path:
            result = check_repo(self.main_repo_path, self.main_repo_path.name)
            if result[0]:
                return result

        logger.debug(f"  在主仓库中未找到 '{decoded_char_name}'，正在检查其他仓库...")
        for repo_name, repo_path in self.detected_repositories.items():
            if repo_path == self.main_repo_path: continue
            result = check_repo(repo_path, repo_name)
            if result[0]:
                return result

        logger.warning(f"在任何仓库中都未找到角色文件夹 '{character_name}' (解码后: '{decoded_char_name}')。")
        return None, None, None

app_context = AppContext()

def generate_geld_id(length=20):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def escape_regexp(string_to_escape: str) -> str:
    return re.escape(string_to_escape)

def calculate_md5(file_path: Path) -> Optional[str]:
    if not file_path.is_file():
        logger.warning(f"无法计算 MD5: 在 {file_path} 未找到文件")
        return None
    hash_md5 = hashlib.md5()
    try:
        with file_path.open("rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except OSError as e:
        logger.error(f"读取文件以计算 MD5 时出错 ({file_path}): {e}")
        return None
    except Exception as e:
        logger.error(f"计算 MD5 时发生意外错误 ({file_path}): {e}", exc_info=True)
        return None

def read_json_file(file_path: Optional[Path], description: str) -> Union[List, Dict, None]:
    if not file_path or not file_path.is_file():
        logger.debug(f"未找到 '{description}' 的 JSON 文件或路径无效: {file_path}")
        return None
    try:
        with file_path.open('r', encoding='utf-8') as f:
            content = f.read().strip()
        if not content:
            logger.warning(f"JSON 文件 '{description}' ({file_path.name}) 为空。")
            return None
        data = json.loads(content)
        logger.debug(f"成功从 '{description}' ({file_path.name}) 读取 JSON。")
        return data
    except json.JSONDecodeError as e:
        logger.error(f"从 '{description}' ({file_path.name}) 解码 JSON 失败: {e}")
        return None
    except OSError as e:
         logger.error(f"读取 JSON 文件 '{description}' ({file_path.name}) 时发生 OS 错误: {e}")
         return None
    except Exception as e:
        logger.error(f"读取 JSON 文件 '{description}' ({file_path.name}) 时发生意外错误: {e}", exc_info=True)
        return None

def write_json_file(file_path: Optional[Path], data: Union[List, Dict], description: str):
    if not file_path:
        logger.error(f"为写入 '{description}' 提供了无效的文件路径。")
        raise ValueError("写入 JSON 的文件路径无效。")
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)

        if file_path.exists():
            backup_path = file_path.with_suffix(f"{file_path.suffix}.bak")
            try:
                shutil.copy2(file_path, backup_path)
                logger.debug(f"已将 '{description}' 备份到 {backup_path.name}")
            except Exception as backup_e:
                logger.warning(f"备份 '{description}' 文件 ({file_path.name}) 失败: {backup_e}")

        with file_path.open('w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.debug(f"成功将 JSON 写入 '{description}' ({file_path.name})。")
    except OSError as e:
         logger.error(f"写入 JSON 文件 '{description}' ({file_path.name}) 时发生 OS 错误: {e}")
         raise IOError(f"写入 {description} 文件失败: {e}") from e
    except Exception as e:
        logger.error(f"写入 JSON 文件 '{description}' ({file_path.name}) 时发生意外错误: {e}", exc_info=True)
        raise IOError(f"写入 {description} 文件时发生意外错误: {e}") from e

def read_yaml_file(file_path: Optional[Path], description: str) -> Optional[Dict]:
    if not file_path or not file_path.is_file():
        logger.debug(f"未找到 '{description}' 的 YAML 文件或路径无效: {file_path}")
        return None
    try:
        with file_path.open('r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict):
            logger.debug(f"成功从 '{description}' ({file_path.name}) 读取 YAML。")
            return data
        elif data is None:
            logger.warning(f"YAML 文件 '{description}' ({file_path.name}) 为空或无效。")
            return {}
        else:
            logger.error(f"YAML 文件内容不是字典格式: '{description}' ({file_path.name})")
            return None
    except yaml.YAMLError as e:
        logger.error(f"从 '{description}' ({file_path.name}) 解析 YAML 失败: {e}")
        return None
    except OSError as e:
         logger.error(f"读取 YAML 文件 '{description}' ({file_path.name}) 时发生 OS 错误: {e}")
         return None
    except Exception as e:
        logger.error(f"读取 YAML 文件 '{description}' ({file_path.name}) 时发生意外错误: {e}", exc_info=True)
        return None

def write_yaml_file(file_path: Optional[Path], data: Dict, description: str):
    if not file_path:
        logger.error(f"为写入 YAML '{description}' 提供了无效的文件路径。")
        raise ValueError("写入 YAML 的文件路径无效。")
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with file_path.open('w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True, indent=2, default_flow_style=False)
        logger.debug(f"成功将 YAML 写入 '{description}' ({file_path.name})。")
    except OSError as e:
         logger.error(f"写入 YAML 文件 '{description}' ({file_path.name}) 时发生 OS 错误: {e}")
         raise IOError(f"写入 {description} 文件失败: {e}") from e
    except Exception as e:
        logger.error(f"写入 YAML 文件 '{description}' ({file_path.name}) 时发生意外错误: {e}", exc_info=True)
        raise IOError(f"写入 {description} 文件时发生意外错误: {e}") from e

def find_images_in_repo(repo_name: str, repo_path: Path) -> List[Dict]:
    images: List[Dict] = []
    logger.debug(f"正在扫描仓库 '{repo_name}' 位于 {repo_path}")
    for gallery_type_name in MAIN_GALLERY_TYPES:
        gallery_type_path = repo_path / gallery_type_name
        if not gallery_type_path.is_dir():
            continue
        logger.debug(f"  正在扫描图库类型: {gallery_type_name}")
        try:
            for character_folder_path in gallery_type_path.iterdir():
                if character_folder_path.is_dir():
                    character_name = character_folder_path.name
                    find_images_recursive(repo_name, gallery_type_name, character_name, character_folder_path, images)
        except OSError as e:
            logger.warning(f"  扫描仓库 '{repo_name}' 中的图库类型 '{gallery_type_name}' 时出错: {e}")
        except Exception as e:
            logger.error(f"  处理仓库 '{repo_name}' 中的图库 '{gallery_type_name}' 时发生意外错误: {e}", exc_info=True)

    logger.debug(f"完成扫描 '{repo_name}'，找到 {len(images)} 张图片。")
    return images

def find_images_recursive(repo_name: str, gallery_type: str, folder_name: str, current_path: Path, images_list: List[Dict]):
    try:
        for entry in current_path.iterdir():
            if entry.is_file() and entry.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
                try:
                    gallery_type_base = entry.parents[entry.parts.index(gallery_type)]
                    relative_to_gallery = entry.relative_to(gallery_type_base)
                    api_url_path = "/" + relative_to_gallery.as_posix()

                    images_list.append({
                        "name": folder_name,
                        "folderName": folder_name,
                        "fileName": entry.name,
                        "gallery": gallery_type,
                        "urlPath": api_url_path
                    })
                except ValueError:
                     logger.warning(f"计算 {entry} 在 {gallery_type_base} 内的相对路径失败")
                except IndexError:
                     logger.warning(f"无法在路径 {entry} 中找到图库类型 '{gallery_type}'")
                except Exception as path_e:
                     logger.error(f"处理文件路径时出错 ({entry}): {path_e}", exc_info=True)
            elif entry.is_dir():
                pass
    except OSError as e:
        logger.warning(f"读取目录 {current_path} (仓库: {repo_name}) 时出错: {e}")
    except Exception as e:
        logger.error(f"扫描 {current_path} (仓库: {repo_name}) 时发生意外错误: {e}", exc_info=True)

def create_flask_app(context: AppContext) -> Optional[Flask]:
    logger.info("正在创建 Flask 应用...")
    gu_tools_dir = context.get_gu_tools_dir()
    if not gu_tools_dir or not gu_tools_dir.is_dir():
        logger.error("无法创建 Flask 应用: GuTools 目录无效或未找到。")
        return None

    app = Flask(__name__,
                template_folder=str(gu_tools_dir),
                static_folder=None)

    app.config['APP_CONTEXT'] = context
    CORS(app)

    @app.errorhandler(400)
    def bad_request(error):
        return jsonify(success=False, error=str(error.description) if error.description else "错误的请求"), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify(success=False, error=str(error.description) if error.description else "未找到"), 404

    @app.errorhandler(409)
    def conflict(error):
         return jsonify(success=False, error=str(error.description) if error.description else "冲突"), 409

    @app.errorhandler(500)
    def internal_server_error(error):
        logger.error(f"内部服务器错误: {error}", exc_info=True)
        return jsonify(success=False, error="内部服务器错误"), 500

    register_static_routes(app, context)
    register_api_routes(app, context)

    logger.info("Flask 应用已创建并注册路由。")
    return app

def register_static_routes(app: Flask, context: AppContext):
    logger.debug("正在注册静态路由...")

    gu_tools_path = context.get_gu_tools_dir()
    if not gu_tools_path: return

    @app.route('/')
    def index():
        main_html_name = 'JSON生成器.html'
        logger.debug(f"请求索引页: {main_html_name}")
        return send_from_directory(str(gu_tools_path), main_html_name)

    @app.route('/<filename>')
    def serve_gu_tools_files(filename):
        safe_filename = secure_filename(filename)
        allowed_files = ['searchworker.js', 'favicon.ico', 'logo.png']
        if safe_filename == filename and safe_filename in allowed_files:
             logger.debug(f"正在提供 GuTools 文件: {safe_filename}")
             mimetype = None
             if safe_filename.endswith('.js'):
                 mimetype = 'application/javascript'
             elif safe_filename.endswith('.ico'):
                 mimetype = 'image/vnd.microsoft.icon'
             elif safe_filename.endswith('.png'):
                 mimetype = 'image/png'
             return send_from_directory(str(gu_tools_path), safe_filename, mimetype=mimetype)
        else:
             logger.warning(f"尝试访问 GuTools 根目录下不允许/不安全的文件: {filename}")
             return jsonify(success=False, error="未找到"), 404

    @app.route('/css/<path:filename>')
    def serve_css(filename):
        gu_tools_path = context.get_gu_tools_dir()
        if not gu_tools_path:
             logger.error("CSS 服务失败: 无法确定 GuTools 目录")
             return jsonify(success=False, error="内部服务器错误"), 500

        css_dir = gu_tools_path / 'css'
        if not css_dir.is_dir():
             logger.error(f"CSS 服务失败: css 目录未找到或不是目录: {css_dir}")
             return jsonify(success=False, error="未找到"), 404

        if '..' in filename:
            logger.warning(f"检测到潜在的路径遍历尝试: css/{filename}")
            return jsonify(success=False, error="禁止访问"), 403

        try:
            target_file = (css_dir / filename).resolve()
        except Exception as e:
            logger.error(f"解析 CSS 文件路径时出错: css_dir={css_dir}, filename={filename}, error={e}")
            return jsonify(success=False, error="无效的文件路径"), 400

        try:
            css_dir_resolved = css_dir.resolve()
            if not (css_dir_resolved == target_file.parent or css_dir_resolved in target_file.parents):
                 logger.error(f"路径安全检查失败: 目标文件 {target_file} 不在基础目录 {css_dir_resolved} 下")
                 return jsonify(success=False, error="禁止访问"), 403
        except OSError as e:
             logger.error(f"解析或比较路径时发生 OS 错误: target={target_file}, base={css_dir}, error={e}")
             return jsonify(success=False, error="内部服务器错误"), 500

        if target_file.is_file():
             logger.debug(f"正在提供 CSS: {target_file.relative_to(css_dir)}")
             try:
                 return send_from_directory(str(target_file.parent), target_file.name)
             except Exception as e:
                 logger.error(f"发送 CSS 文件 {target_file} 时出错: {e}", exc_info=True)
                 return jsonify(success=False, error="内部服务器错误"), 500
        else:
             logger.warning(f"CSS 文件未找到或不是文件: {target_file} (请求路径: css/{filename})")
             return jsonify(success=False, error="未找到"), 404


    @app.route('/src/<path:filename>')
    def serve_js(filename):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        gu_tools_path = local_context.get_gu_tools_dir()
        if not gu_tools_path:
             logger.error("JS 服务失败: 无法确定 GuTools 目录")
             return jsonify(success=False, error="内部服务器错误"), 500

        src_dir = gu_tools_path / 'src'
        if not src_dir.is_dir():
             logger.error(f"JS 服务失败: src 目录未找到或不是目录: {src_dir}")
             return jsonify(success=False, error="未找到"), 404

        if '..' in filename:
            logger.warning(f"检测到潜在的路径遍历尝试: src/{filename}")
            return jsonify(success=False, error="禁止访问"), 403

        try:
            target_file = (src_dir / filename).resolve()
        except Exception as e:
            logger.error(f"解析 JS 文件路径时出错: src_dir={src_dir}, filename={filename}, error={e}")
            return jsonify(success=False, error="无效的文件路径"), 400

        try:
            src_dir_resolved = src_dir.resolve()
            if not (src_dir_resolved == target_file.parent or src_dir_resolved in target_file.parents):
                 logger.error(f"路径安全检查失败: 目标文件 {target_file} 不在基础目录 {src_dir_resolved} 下")
                 return jsonify(success=False, error="禁止访问"), 403
        except OSError as e:
             logger.error(f"解析或比较路径时发生 OS 错误: target={target_file}, base={src_dir}, error={e}")
             return jsonify(success=False, error="内部服务器错误"), 500

        if target_file.is_file():
             logger.debug(f"正在提供 JS: {target_file.relative_to(src_dir)}")
             try:
                 return send_from_directory(str(target_file.parent), target_file.name, mimetype='application/javascript')
             except Exception as e:
                 logger.error(f"发送 JS 文件 {target_file} 时出错: {e}", exc_info=True)
                 return jsonify(success=False, error="内部服务器错误"), 500
        else:
             logger.warning(f"JS 文件未找到或不是文件: {target_file} (请求路径: src/{filename})")
             return jsonify(success=False, error="未找到"), 404

    @app.route('/img/<path:filename>')
    def serve_background_image(filename):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        img_dir = local_context.get_img_directory()
        if not img_dir:
            logger.error("背景图片服务失败: 无法确定 img 目录")
            return jsonify(success=False, error="内部服务器错误"), 500
        if not img_dir.is_dir():
            logger.error(f"背景图片服务失败: img 目录未找到或不是目录: {img_dir}")
            return jsonify(success=False, error="未找到"), 404

        if '..' in filename:
            logger.warning(f"检测到潜在的路径遍历尝试: img/{filename}")
            return jsonify(success=False, error="禁止访问"), 403

        try:
            target_file = (img_dir / filename).resolve()
        except Exception as e:
            logger.error(f"解析背景图片路径时出错: img_dir={img_dir}, filename={filename}, error={e}")
            return jsonify(success=False, error="无效的文件路径"), 400

        try:
             img_dir_resolved = img_dir.resolve()
             if not (img_dir_resolved == target_file.parent or img_dir_resolved in target_file.parents):
                 logger.error(f"路径安全检查失败: 目标文件 {target_file} 不在基础目录 {img_dir_resolved} 下")
                 return jsonify(success=False, error="禁止访问"), 403
        except OSError as e:
             logger.error(f"解析或比较路径时发生 OS 错误: target={target_file}, base={img_dir}, error={e}")
             return jsonify(success=False, error="内部服务器错误"), 500

        if target_file.is_file() and target_file.suffix.lower() in BACKGROUND_IMAGE_EXTENSIONS:
             logger.debug(f"正在提供背景图片: {target_file.relative_to(img_dir)}")
             try:
                 return send_from_directory(str(target_file.parent), target_file.name)
             except Exception as e:
                 logger.error(f"发送背景图片 {target_file} 时出错: {e}", exc_info=True)
                 return jsonify(success=False, error="内部服务器错误"), 500
        elif not target_file.is_file():
             logger.warning(f"背景图片未找到或不是文件: {target_file} (请求路径: img/{filename})")
             return jsonify(success=False, error="未找到"), 404
        else: # Is a file, but wrong extension
             logger.warning(f"请求了不允许的背景图片扩展名: {target_file}")
             return jsonify(success=False, error="禁止访问"), 403

    @app.route(f'/{IMGTEMP_DIRECTORY_NAME}/<path:filename>')
    def serve_temp_image(filename):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        imgtemp_dir = local_context.get_imgtemp_directory()
        if not imgtemp_dir:
            logger.error("临时图片服务失败: 无法确定 imgtemp 目录")
            return jsonify(success=False, error="内部服务器错误"), 500
        if not imgtemp_dir.is_dir():
            logger.error(f"临时图片服务失败: imgtemp 目录未找到或不是目录: {imgtemp_dir}")
            return jsonify(success=False, error="未找到"), 404

        if '..' in filename:
            logger.warning(f"检测到潜在的路径遍历尝试: {IMGTEMP_DIRECTORY_NAME}/{filename}")
            return jsonify(success=False, error="禁止访问"), 403

        try:
            target_file = (imgtemp_dir / filename).resolve()
        except Exception as e:
            logger.error(f"解析临时图片路径时出错: imgtemp_dir={imgtemp_dir}, filename={filename}, error={e}")
            return jsonify(success=False, error="无效的文件路径"), 400

        try:
             imgtemp_dir_resolved = imgtemp_dir.resolve()
             if not (imgtemp_dir_resolved == target_file.parent or imgtemp_dir_resolved in target_file.parents):
                 logger.error(f"路径安全检查失败: 目标文件 {target_file} 不在基础目录 {imgtemp_dir_resolved} 下")
                 return jsonify(success=False, error="禁止访问"), 403
        except OSError as e:
             logger.error(f"解析或比较路径时发生 OS 错误: target={target_file}, base={imgtemp_dir}, error={e}")
             return jsonify(success=False, error="内部服务器错误"), 500

        if target_file.is_file() and target_file.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
             logger.debug(f"正在提供临时图片: {target_file.relative_to(imgtemp_dir)}")
             try:
                return send_from_directory(str(target_file.parent), target_file.name)
             except Exception as e:
                 logger.error(f"发送临时图片 {target_file} 时出错: {e}", exc_info=True)
                 return jsonify(success=False, error="内部服务器错误"), 500
        elif not target_file.is_file():
             logger.warning(f"临时图片未找到或不是文件: {target_file} (请求路径: {IMGTEMP_DIRECTORY_NAME}/{filename})")
             return jsonify(success=False, error="未找到"), 404
        else:
             logger.warning(f"请求了不允许的临时图片扩展名: {target_file}")
             return jsonify(success=False, error="禁止访问"), 403

    @app.route('/<gallery_type>/<path:filepath>')
    def serve_gallery_image(gallery_type, filepath):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.debug(f"请求图库图片: /{gallery_type}/{filepath}")

        if gallery_type not in MAIN_GALLERY_TYPES:
            logger.warning(f"路径中的图库类型无效: {gallery_type}")
            return jsonify(success=False, error="无效的图库类型"), 400

        relative_path_str = f"{gallery_type}/{filepath}"
        physical_path, repo_name = local_context.resolve_relative_path(relative_path_str)

        if physical_path and physical_path.is_file():
            logger.debug(f"正在提供图库文件: {physical_path} (来自仓库 '{repo_name}')")
            try:
                return send_from_directory(str(physical_path.parent), physical_path.name, as_attachment=False)
            except Exception as e:
                logger.error(f"发送文件 '{physical_path}' 时出错: {e}", exc_info=True)
                abort(500, description=f"发送文件失败: {physical_path.name}")
        else:
            logger.warning(f"未找到相对路径的图库文件: {relative_path_str}")
            return jsonify(success=False, error="图片文件未找到"), 404

def register_api_routes(app: Flask, context: AppContext):
    logger.debug("正在注册 API 路由...")

    def api_success(data: Any = None, message: Optional[str] = None) -> Response:
        payload: Dict[str, Any] = {"success": True}
        if data is not None:
             if isinstance(data, (list, dict)):
                 payload.update(data)
                 if isinstance(data, list): payload['data'] = data
             else:
                 payload['data'] = data
        if message:
            payload["message"] = message
        return jsonify(payload)

    def api_error(message: str, status_code: int = 400, data: Optional[Dict] = None) -> Response:
         response_payload = {"success": False, "error": message}
         if data:
              response_payload.update(data)

         if status_code >= 500:
             logger.error(f"API 错误 {status_code}: {message}", exc_info=True)
         else:
             logger.warning(f"API 错误 {status_code}: {message}")
         return jsonify(response_payload), status_code

    @app.route('/api/images', methods=['GET'])
    @app.route('/api/local-images', methods=['GET'])
    def get_all_images():
         local_context: AppContext = current_app.config['APP_CONTEXT']
         logger.info("API 请求: 获取所有本地图片")
         all_images: List[Dict] = []
         if not local_context.detected_repositories:
             logger.warning("无法获取图片，未检测到仓库。")
             return api_success([])

         start_time = time.time()
         for repo_name, repo_path in local_context.detected_repositories.items():
             try:
                 all_images.extend(find_images_in_repo(repo_name, repo_path))
             except Exception as e:
                 logger.error(f"扫描仓库 '{repo_name}' 时出错: {e}", exc_info=True)

         elapsed = time.time() - start_time
         logger.info(f"在 {len(local_context.detected_repositories)} 个仓库中找到 {len(all_images)} 张图片，耗时 {elapsed:.2f} 秒。")
         all_images.sort(key=lambda img: img.get('urlPath', ''))
         return api_success({"images": all_images})

    @app.route('/api/gallery-config', methods=['GET'])
    def get_gallery_config():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 获取图库配置")
        config_path = local_context.get_gallery_config_yaml_path()
        config_data = read_yaml_file(config_path, "图库配置")

        if config_data is None:
             default_config = {'GGOP': 1, 'Px18img-type': 0, 'Rx18img-type': 0, 'MihoyoOption': 0}
             logger.warning("未找到或无效的图库配置文件，返回默认值。")
             return api_success({"config": default_config, "message": "未找到配置，使用默认值。"})
        else:
             return api_success({"config": config_data})

    @app.route('/api/update-gallery-config', methods=['POST'])
    def update_gallery_config():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 更新图库配置")
        config_path = local_context.get_gallery_config_yaml_path()
        if not config_path:
            return api_error("未设置主仓库，无法找到配置文件路径。", 500)

        try:
            data = request.get_json()
            if not isinstance(data, dict):
                return api_error("无效的请求体，应为 JSON 对象。", 400)

            config_key = data.get('configKey')
            new_value_raw = data.get('newValue')

            if not config_key or new_value_raw is None:
                 return api_error("请求中缺少 'configKey' 或 'newValue'。", 400)

            allowed_keys = ['GGOP', 'Px18img-type', 'Rx18img-type', 'MihoyoOption']
            if config_key not in allowed_keys:
                return api_error(f"无效的配置键: {config_key}。允许的键: {', '.join(allowed_keys)}", 400)

            try:
                new_value = int(new_value_raw)
                if new_value not in [0, 1]:
                    raise ValueError("值必须为 0 或 1")
            except (ValueError, TypeError):
                 return api_error("'newValue' 必须是整数 0 或 1。", 400)

        except Exception as e:
             logger.error(f"处理配置更新的请求数据时出错: {e}", exc_info=True)
             return api_error("无效的请求数据。", 400)

        try:
            current_config = read_yaml_file(config_path, "图库配置")
            if current_config is None:
                current_config = {}

            current_config[config_key] = new_value
            write_yaml_file(config_path, current_config, "图库配置")

            status_text = '启用' if new_value == 1 else '禁用'
            return api_success(
                {"newConfig": current_config},
                message=f"配置 '{config_key}' 已成功设置为 {new_value} ({status_text})。"
            )
        except (IOError, ValueError, yaml.YAMLError) as e:
             return api_error(f"更新配置文件失败: {e}", 500)
        except Exception as e:
             return api_error(f"配置更新期间发生意外错误: {e}", 500)

    @app.route('/api/folder-contents', methods=['GET'])
    def get_folder_contents():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        folder_name = request.args.get('folder')
        logger.info(f"API 请求: 获取文件夹 '{folder_name}' 的内容")

        if not folder_name:
            return api_error("缺少 'folder' 查询参数。", 400)

        physical_path, repo_name, gallery_type = local_context.find_character_folder(folder_name)

        if not physical_path or not physical_path.is_dir():
            logger.warning(f"未找到文件夹 '{folder_name}'。")
            return api_success({"files": []})

        try:
            files_list = sorted([
                f.name for f in physical_path.iterdir()
                if f.is_file() and not f.name.startswith('.')
            ])
            location_info = f"{repo_name}/{gallery_type or '[根目录]'}"
            logger.debug(f"文件夹 '{folder_name}' (位于 {location_info}) 包含 {len(files_list)} 个文件。")
            return api_success({"files": files_list})
        except OSError as e:
            return api_error(f"读取文件夹 '{folder_name}' 内容时出错: {e}", 500)
        except Exception as e:
            return api_error(f"读取文件夹 '{folder_name}' 时发生意外错误: {e}", 500)

    def get_user_data(data_path_func: Callable[[], Optional[Path]], description: str):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info(f"API 请求: 获取 {description}")
        data_path = data_path_func()
        if not data_path:
             return api_error("未设置主仓库，无法定位数据文件。", 500)

        data = read_json_file(data_path, description)

        if data is None:
            logger.warning(f"未找到或无效的 {description} 文件，返回空列表。")
            return api_success({"data": []})
        elif not isinstance(data, list):
             logger.error(f"{description} 文件内容不是列表: {data_path}。返回空列表。")
             return api_success({"data": []})
        else:
             return api_success({"data": data})

    def update_user_data(data_path_func: Callable[[], Optional[Path]], description: str, process_func: Optional[Callable[[List], List]] = None):
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info(f"API 请求: 更新 {description}")
        data_path = data_path_func()
        if not data_path:
             return api_error("未设置主仓库，无法定位数据文件。", 500)

        try:
            updated_data = request.get_json()
            if not isinstance(updated_data, list):
                return api_error("无效的请求体，应为 JSON 数组。", 400)

        except Exception as e:
             logger.error(f"处理 {description} 更新的请求数据时出错: {e}", exc_info=True)
             return api_error("无效的请求数据。", 400)

        try:
            if process_func:
                processed_data = process_func(updated_data)
            else:
                processed_data = updated_data

            write_json_file(data_path, processed_data, description)
            return api_success(message=f"{description} 保存成功。")
        except (IOError, ValueError) as e:
             return api_error(f"保存 {description} 失败: {e}", 500)
        except Exception as e:
             return api_error(f"{description} 更新期间发生意外错误: {e}", 500)

    @app.route('/api/userdata', methods=['GET'])
    def get_internal_userdata():
        return get_user_data(app_context.get_internal_data_path, "内部用户数据")

    @app.route('/api/update-userdata', methods=['POST'])
    def update_internal_userdata():
        return update_user_data(app_context.get_internal_data_path, "内部用户数据")

    @app.route('/api/external-userdata', methods=['GET'])
    def get_external_userdata():
        return get_user_data(app_context.get_external_data_path, "外部用户数据")

    def process_external_data(data: List) -> List:
        processed = []
        geld_id_regex = re.compile(r'^[a-zA-Z0-9]{20}$')
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

        for entry in data:
            if not isinstance(entry, dict): continue

            attributes = entry.get('attributes', {})
            if not isinstance(attributes, dict): attributes = {}

            geld_id = attributes.get('geldId')
            gid = attributes.get('gid')

            final_id = None
            if isinstance(geld_id, str) and geld_id_regex.match(geld_id):
                 final_id = geld_id
            elif isinstance(gid, str) and geld_id_regex.match(gid):
                 final_id = gid
            else:
                 final_id = generate_geld_id(20)

            attributes['geldId'] = final_id
            if 'gid' in attributes: del attributes['gid']

            if 'path' in entry and isinstance(entry['path'], str) and 'filename' not in attributes:
                try:
                    attributes['filename'] = Path(entry['path']).name
                except Exception:
                    attributes['filename'] = None

            attributes.pop('isFullscreen', None)

            entry['attributes'] = attributes
            entry['timestamp'] = now_iso
            processed.append(entry)
        return processed

    @app.route('/api/update-external-userdata', methods=['POST'])
    def update_external_userdata():
        return update_user_data(app_context.get_external_data_path, "外部用户数据", process_external_data)

    @app.route('/api/import-image', methods=['POST'])
    def import_image():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 导入图片")

        if not local_context.main_repo_path:
             return api_error("未设置主仓库，无法导入图片。", 500)

        try:
            data = request.get_json()
            if not isinstance(data, dict):
                return api_error("无效的请求体，应为 JSON 对象。", 400)

            temp_image_web_path = data.get('tempImagePath')
            target_folder_raw = data.get('targetFolder')
            target_filename_raw = data.get('targetFilename')
            attributes = data.get('attributes', {})

            if not isinstance(temp_image_web_path, str) or \
               not isinstance(target_folder_raw, str) or \
               not isinstance(target_filename_raw, str) or \
               not isinstance(attributes, dict):
                return api_error("必填字段的数据类型无效。", 400)

            if not temp_image_web_path.startswith(f"{IMGTEMP_DIRECTORY_NAME}/") or \
               '..' in temp_image_web_path or '/' in temp_image_web_path.split('/', 1)[1]:
                 return api_error("无效的 'tempImagePath' 格式或内容。", 400)

            target_folder = secure_filename(target_folder_raw.strip())
            target_filename = secure_filename(target_filename_raw.strip())

            if not target_folder or not target_filename:
                 return api_error("净化后目标文件夹或文件名为空或无效。", 400)

        except Exception as e:
             logger.error(f"处理图片导入的请求数据时出错: {e}", exc_info=True)
             return api_error("无效的请求数据。", 400)

        temp_dir = local_context.get_imgtemp_directory()
        if not temp_dir or not temp_dir.is_dir():
             return api_error("未找到临时图片目录。", 500)

        temp_filename = Path(temp_image_web_path).name
        source_physical_path = local_context.safe_path_join(temp_dir, temp_filename)

        if not source_physical_path or not source_physical_path.is_file():
            logger.error(f"未找到或无效的源临时文件: {source_physical_path} (来自 {temp_image_web_path})")
            return api_error(f"临时图片 '{temp_filename}' 未找到或路径无效。", 400)

        destination_dir: Optional[Path] = None
        dest_repo_name: Optional[str] = None
        dest_gallery_type: Optional[str] = None

        existing_folder_path, repo_name, gallery_type = local_context.find_character_folder(target_folder)

        if existing_folder_path and repo_name and gallery_type:
            destination_dir = existing_folder_path
            dest_repo_name = repo_name
            dest_gallery_type = gallery_type
            logger.info(f"目标文件夹 '{target_folder}' 已存在于 '{repo_name}/{gallery_type}'。")
        else:
            if not MAIN_GALLERY_TYPES:
                 return api_error("未定义图库类型，无法创建新文件夹。", 500)
            dest_gallery_type = MAIN_GALLERY_TYPES[0]
            dest_repo_name = local_context.main_repo_path.name

            main_gallery_path = local_context.main_repo_path / dest_gallery_type
            try:
                 main_gallery_path.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                  return api_error(f"确保图库目录 '{dest_gallery_type}' 存在失败: {e}", 500)

            destination_dir = main_gallery_path / target_folder
            logger.info(f"未找到目标文件夹 '{target_folder}'，将在 '{dest_repo_name}/{dest_gallery_type}' 中创建。")
            try:
                destination_dir.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                return api_error(f"创建目标目录 '{target_folder}' 失败: {e}", 500)

        destination_file_path = destination_dir / target_filename
        if destination_file_path.exists():
             logger.warning(f"目标文件已存在: {destination_file_path}")
             return api_error(f"文件 '{target_filename}' 已存在于文件夹 '{target_folder}' 中。", 409)

        try:
            logger.info(f"正在移动 {source_physical_path.name} 到 {destination_file_path}")
            shutil.move(str(source_physical_path), str(destination_file_path))
        except OSError as e:
            return api_error(f"移动图片文件失败: {e}", 500)
        except Exception as e:
             return api_error(f"移动图片文件时发生意外错误: {e}", 500)

        internal_data_path = local_context.get_internal_data_path()
        if not internal_data_path:
            logger.error(f"图片已移动到 {destination_file_path}，但内部用户数据路径无效！无法更新记录。")
            return api_error("图片已导入但无法更新内部记录。请检查服务器配置。", 500)

        saved_entries = read_json_file(internal_data_path, "内部用户数据")
        if saved_entries is None:
            saved_entries = []
        if not isinstance(saved_entries, list):
             logger.error("内部用户数据不是列表！无法附加新条目。")
             return api_error("图片已导入但内部数据文件格式不正确。记录未更新。", 500)

        new_file_md5 = calculate_md5(destination_file_path)
        new_entry_relative_path = f"{dest_gallery_type}/{target_folder}/{target_filename}".replace('\\', '/')

        uses_gid_legacy = False
        if saved_entries and saved_entries[0].get("gid") is not None and saved_entries[0].get("geldId") is None:
             uses_gid_legacy = True

        geld_id_regex = re.compile(r'^[a-zA-Z0-9]{20}$')
        provided_geldid = attributes.get("geldId")
        provided_gid = attributes.get("gid")
        final_id = None

        if isinstance(provided_geldid, str) and geld_id_regex.match(provided_geldid):
             final_id = provided_geldid
        elif isinstance(provided_gid, str) and geld_id_regex.match(provided_gid):
             final_id = provided_gid
        else:
             final_id = generate_geld_id(20)

        new_attributes = {
            "filename": target_filename,
            "parentFolder": target_folder,
            "isPx18": bool(attributes.get("isPx18", False)),
            "isRx18": bool(attributes.get("isRx18", False)),
            "layout": str(attributes.get("layout", "normal")),
            "isEasterEgg": bool(attributes.get("isEasterEgg", False)),
            "isAiImage": bool(attributes.get("isAiImage", False)),
            "isBan": bool(attributes.get("isBan", False)),
            "md5": new_file_md5 or attributes.get("md5"),
            "Downloaded_From": str(attributes.get("Downloaded_From", "none")),
            ("gid" if uses_gid_legacy else "geldId") : final_id
        }
        if uses_gid_legacy: new_attributes.pop("geldId", None)
        else: new_attributes.pop("gid", None)

        new_entry = {
            "characterName": target_folder,
            "path": new_entry_relative_path,
            "attributes": new_attributes,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "sourceGallery": dest_gallery_type,
             ** ({"gid": final_id} if uses_gid_legacy else {})
        }

        saved_entries.append(new_entry)

        try:
            write_json_file(internal_data_path, saved_entries, "内部用户数据")
            logger.info(f"图片 '{target_filename}' 导入成功并已记录。")
            return api_success({"newEntry": new_entry}, message="图片导入成功。")
        except (IOError, ValueError) as e:
             logger.error(f"严重: 图片已移动到 {destination_file_path}，但写入更新后的内部数据失败: {e}", exc_info=True)
             return api_error(f"图片已导入但保存更新记录失败: {e}", 500)

    @app.route('/api/temp-images', methods=['GET'])
    def get_temp_images():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 获取临时图片")
        temp_images = []
        temp_dir = local_context.get_imgtemp_directory()
        if temp_dir and temp_dir.is_dir():
            try:
                for entry in temp_dir.iterdir():
                    if entry.is_file() and entry.suffix.lower() in ALLOWED_IMAGE_EXTENSIONS:
                        temp_images.append({
                            "filename": entry.name,
                            "path": f"{IMGTEMP_DIRECTORY_NAME}/{entry.name}"
                        })
                temp_images.sort(key=lambda x: x['filename'])
            except OSError as e:
                 logger.error(f"读取临时图片目录 {temp_dir} 时出错: {e}")
            except Exception as e:
                 return api_error(f"读取临时图片时发生意外错误: {e}", 500)

        return api_success({"tempImages": temp_images})

    @app.route('/api/background-images', methods=['GET'])
    def get_background_images():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 获取背景图片")
        background_images = []
        img_dir = local_context.get_img_directory()
        if img_dir and img_dir.is_dir():
             try:
                 for entry in img_dir.iterdir():
                     if entry.is_file() and entry.suffix.lower() in BACKGROUND_IMAGE_EXTENSIONS:
                         background_images.append(entry.name)
                 background_images.sort()
             except OSError as e:
                 logger.error(f"读取背景图片目录 {img_dir} 时出错: {e}")
             except Exception as e:
                 return api_error(f"读取背景图片时发生意外错误: {e}", 500)
        return api_success({"backgroundImages": background_images})

    @app.route('/api/character-folders', methods=['GET'])
    def get_character_folders():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 获取所有角色文件夹")
        folder_set: Set[str] = set()
        if not local_context.detected_repositories:
            return api_success({"folders": []})

        for repo_name, repo_path in local_context.detected_repositories.items():
            for gallery_type in MAIN_GALLERY_TYPES:
                gallery_path = repo_path / gallery_type
                if gallery_path.is_dir():
                    try:
                        for entry in gallery_path.iterdir():
                            if entry.is_dir() and not entry.name.startswith('.'):
                                folder_set.add(entry.name)
                    except OSError as e:
                        logger.warning(f"扫描仓库 '{repo_name}' 中的文件夹 {gallery_path} 时出错: {e}")
                    except Exception as e:
                         logger.error(f"扫描 {gallery_path} 时发生意外错误: {e}", exc_info=True)

        folders = sorted(list(folder_set))
        logger.debug(f"找到 {len(folders)} 个唯一的角色文件夹。")
        return api_success({"folders": folders})

    @app.route('/api/last-file-number', methods=['GET'])
    def get_last_file_number():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        folder_name = request.args.get('folder')
        logger.info(f"API 请求: 获取文件夹 '{folder_name}' 的最后一个文件编号")

        if not folder_name:
            return api_error("缺少 'folder' 查询参数。", 400)

        physical_folder_path, _, _ = local_context.find_character_folder(folder_name)

        max_number = 0
        if physical_folder_path and physical_folder_path.is_dir():
            try:
                pattern = re.compile(f"^{escape_regexp(physical_folder_path.name)}GU(\\d+)\\.\\w+$", re.IGNORECASE)

                for entry in physical_folder_path.iterdir():
                    if entry.is_file():
                        match = pattern.match(entry.name)
                        if match:
                            try:
                                num = int(match.group(1))
                                max_number = max(max_number, num)
                            except ValueError:
                                logger.warning(f"无法从文件名解析编号: {entry.name}")
                                continue
            except OSError as e:
                 return api_error(f"读取文件夹 '{folder_name}' 以查找最后一个编号时出错: {e}", 500)
            except Exception as e:
                 return api_error(f"为 '{folder_name}' 查找最后一个编号时发生意外错误: {e}", 500)
        else:
             logger.warning(f"未找到用于查找最后一个编号的文件夹 '{folder_name}'。")

        logger.debug(f"'{folder_name}' 的最后一个文件编号: {max_number}")
        return api_success({"lastNumber": max_number})

    @app.route('/api/rename-sequence-files', methods=['POST'])
    def rename_sequence_files():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 重命名序列文件")

        try:
            data = request.get_json()
            if not isinstance(data, dict):
                 return api_error("无效的请求体，应为 JSON 对象。", 400)

            fix_plan = data.get('fixPlan')
            if not isinstance(fix_plan, list):
                 return api_error("无效的请求体，'fixPlan' 必须是列表。", 400)
            if not fix_plan:
                 return api_success(message="收到空的修复计划，无需操作。")

        except Exception as e:
             logger.error(f"处理重命名请求数据时出错: {e}", exc_info=True)
             return api_error("无效的请求数据。", 400)

        total_processed_folders = 0
        total_renamed_files = 0
        errors: List[str] = []
        json_updates: List[Tuple[str, str, str]] = []
        rename_ops_stage1: List[Tuple[Path, Path]] = []
        rename_ops_stage2: List[Tuple[Path, Path, str, str, str]] = []

        logger.info(f"正在处理包含 {len(fix_plan)} 个文件夹条目的重命名计划...")

        for folder_plan in fix_plan:
            if not isinstance(folder_plan, dict):
                 errors.append("fixPlan 中的条目无效 (不是对象)。")
                 continue

            folder_name = folder_plan.get('folderName')
            files_to_rename = folder_plan.get('filesToRename')

            if not isinstance(folder_name, str) or not folder_name:
                 errors.append("修复计划条目中缺少或无效的 'folderName'。")
                 continue
            if not isinstance(files_to_rename, list) or not files_to_rename:
                 logger.debug(f"未提供文件夹 '{folder_name}' 的重命名文件，跳过。")
                 continue

            physical_folder_path, repo_name, gallery_type = local_context.find_character_folder(folder_name)

            if not physical_folder_path or not repo_name or not gallery_type:
                msg = f"未在标准图库位置找到文件夹 '{folder_name}'。无法处理重命名。"
                errors.append(msg)
                logger.error(msg)
                continue

            logger.debug(f"正在处理文件夹: {folder_name} 位于 {physical_folder_path}")
            total_processed_folders += 1
            temp_suffix = f"_rename_{random.randint(1000, 9999)}"

            folder_has_valid_ops = False
            for op in files_to_rename:
                if not isinstance(op, dict):
                     errors.append(f"文件夹 '{folder_name}' 中的重命名操作项无效。")
                     continue

                current_filename = op.get('currentFilename')
                new_filename = op.get('newFilename')

                if not isinstance(current_filename, str) or not current_filename or \
                   not isinstance(new_filename, str) or not new_filename:
                     errors.append(f"文件夹 '{folder_name}' 的重命名操作中缺少或无效的文件名。")
                     continue

                current_filename_safe = secure_filename(current_filename)
                new_filename_safe = secure_filename(new_filename)
                if current_filename_safe != current_filename or new_filename_safe != new_filename:
                     msg = f"在文件夹 '{folder_name}' 的文件名中检测到无效字符: '{current_filename}' -> '{new_filename}'"
                     errors.append(msg)
                     logger.warning(msg)
                     continue

                old_physical_path = physical_folder_path / current_filename_safe
                final_physical_path = physical_folder_path / new_filename_safe
                temp_physical_path = physical_folder_path / (new_filename_safe + temp_suffix)

                if not old_physical_path.is_file():
                     logger.warning(f"未找到要重命名的源文件，跳过: {old_physical_path}")
                     errors.append(f"在文件夹 '{folder_name}' 中未找到文件 '{current_filename_safe}'。")
                     continue

                if final_physical_path.exists() and final_physical_path != old_physical_path:
                     msg = f"目标文件名 '{new_filename_safe}' 已存在于文件夹 '{folder_name}' 中。无法重命名 '{current_filename_safe}'。"
                     errors.append(msg)
                     logger.error(msg)
                     continue

                old_relative = f"{gallery_type}/{folder_name}/{current_filename_safe}".replace('\\','/')
                new_relative = f"{gallery_type}/{folder_name}/{new_filename_safe}".replace('\\','/')

                rename_ops_stage1.append((old_physical_path, temp_physical_path))
                rename_ops_stage2.append((temp_physical_path, final_physical_path, old_relative, new_relative, new_filename_safe))
                folder_has_valid_ops = True

            if not folder_has_valid_ops:
                 logger.warning(f"验证后未找到文件夹 '{folder_name}' 的有效重命名操作。")

        if not rename_ops_stage1 and not errors:
             return api_success(message="在计划中未找到有效的重命名操作。")
        if not rename_ops_stage1 and errors:
            return api_error("重命名计划包含错误且没有有效的操作。", 400, data={"errors": errors})

        logger.info(f"正在执行阶段 1 重命名 (到临时名称): {len(rename_ops_stage1)} 操作...")
        failed_stage1_temps: Set[Path] = set()
        for old_path, temp_path in rename_ops_stage1:
            try:
                logger.debug(f"  移动 (阶段 1): {old_path} -> {temp_path}")
                shutil.move(str(old_path), str(temp_path))
            except OSError as e:
                err_msg = f"将 '{old_path.name}' 重命名为临时名称 '{temp_path.name}' 失败: {e}"
                logger.error(f"    [阶段 1 失败] {err_msg}")
                errors.append(err_msg)
                failed_stage1_temps.add(temp_path)
            except Exception as e:
                 err_msg = f"将 '{old_path.name}' 重命名为临时 '{temp_path.name}' 时发生意外错误: {e}"
                 logger.error(f"    [阶段 1 失败] {err_msg}", exc_info=True)
                 errors.append(err_msg)
                 failed_stage1_temps.add(temp_path)

        logger.info(f"正在执行阶段 2 重命名 (临时到最终名称): {len(rename_ops_stage2)} 个潜在操作...")
        successfully_renamed_count = 0
        for temp_path, final_path, old_rel, new_rel, new_fname in rename_ops_stage2:
            if temp_path in failed_stage1_temps:
                logger.warning(f"  因阶段 1 失败，跳过阶段 2 对 '{final_path.name}' 的操作。")
                continue

            if not temp_path.is_file():
                 logger.error(f"  [阶段 2 失败] 未找到临时文件 '{temp_path}'！跳过重命名到 '{final_path.name}'。")
                 errors.append(f"内部错误: '{final_path.name}' 的临时文件消失了。")
                 continue

            try:
                logger.debug(f"  移动 (阶段 2): {temp_path} -> {final_path}")
                shutil.move(str(temp_path), str(final_path))
                successfully_renamed_count += 1
                json_updates.append((old_rel, new_rel, new_fname))
            except OSError as e:
                err_msg = f"将临时文件 '{temp_path.name}' 重命名为最终名称 '{final_path.name}' 失败: {e}"
                logger.error(f"    [阶段 2 失败] {err_msg}")
                errors.append(err_msg)
            except Exception as e:
                 err_msg = f"将临时 '{temp_path.name}' 重命名为最终 '{final_path.name}' 时发生意外错误: {e}"
                 logger.error(f"    [阶段 2 失败] {err_msg}", exc_info=True)
                 errors.append(err_msg)

        total_renamed_files = successfully_renamed_count

        if json_updates:
            internal_data_path = local_context.get_internal_data_path()
            if not internal_data_path:
                errors.append("严重: 文件已重命名，但找不到内部数据文件路径来更新记录！")
                logger.error("严重: 由于路径无效，重命名后 JSON 更新失败。")
            else:
                logger.info(f"正在为 {len(json_updates)} 个重命名文件更新内部 JSON 数据...")
                try:
                    saved_entries = read_json_file(internal_data_path, "内部用户数据")
                    if not isinstance(saved_entries, list):
                         raise ValueError("内部数据文件不是列表，无法更新。")

                    updated_count = 0
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    updates_map = {old: (new, fname) for old, new, fname in json_updates}

                    for entry in saved_entries:
                        if not isinstance(entry, dict): continue
                        old_path = entry.get('path')
                        if isinstance(old_path, str) and old_path in updates_map:
                            new_path, new_fname = updates_map[old_path]
                            logger.debug(f"    更新 JSON: '{old_path}' -> '{new_path}'")
                            entry['path'] = new_path
                            entry['timestamp'] = now_iso
                            if isinstance(entry.get('attributes'), dict):
                                entry['attributes']['filename'] = new_fname
                            else:
                                 if 'attributes' not in entry: entry['attributes'] = {}
                                 if isinstance(entry['attributes'], dict):
                                      entry['attributes']['filename'] = new_fname
                                 else: logger.warning(f"无法更新路径 {new_path} 的属性中的文件名，属性不是字典: {entry.get('attributes')}")
                            updated_count += 1

                    if updated_count > 0:
                        logger.info(f"找到 {updated_count} 个 JSON 条目需要更新。")
                        write_json_file(internal_data_path, saved_entries, "内部用户数据 (重命名后)")
                        logger.info("内部 JSON 数据更新成功。")
                    else:
                        logger.warning("在内部 JSON 数据中未找到与重命名文件匹配的条目。")

                except (IOError, ValueError) as e:
                    err_msg = f"在重命名更新期间读取或写入内部数据文件失败: {e}"
                    logger.error(f"严重: {err_msg}", exc_info=True)
                    errors.append(f"严重: {err_msg}")
                except Exception as e:
                     err_msg = f"更新内部数据文件时发生意外错误: {e}"
                     logger.error(f"严重: {err_msg}", exc_info=True)
                     errors.append(f"严重: {err_msg}")

        response_data = {
            "processedFolders": total_processed_folders,
            "renamedFiles": total_renamed_files
        }
        if errors:
            logger.error(f"序列文件重命名完成，但出现 {len(errors)} 个错误。")
            response_data["errors"] = errors
            return api_error(f"重命名完成，但出现 {len(errors)} 个错误。", 500, data=response_data)
        else:
            logger.info("序列文件重命名成功完成。")
            return api_success(response_data, message="序列文件重命名成功。")

    @app.route('/api/image-md5', methods=['GET'])
    def get_image_md5():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        relative_path_str = request.args.get('path')
        logger.info(f"API 请求: 获取路径 '{relative_path_str}' 的 MD5")

        if not relative_path_str:
            return api_error("缺少 'path' 查询参数。", 400)

        physical_path, repo_name = local_context.resolve_relative_path(relative_path_str)

        if not physical_path or not physical_path.is_file():
            logger.warning(f"未找到用于计算 MD5 的文件: {relative_path_str}")
            return api_error("文件未找到。", 404)

        logger.debug(f"正在计算 MD5: {physical_path} (在仓库中找到: {repo_name})")
        try:
            md5_hash = calculate_md5(physical_path)
            if md5_hash:
                logger.debug(f"'{relative_path_str}' 的 MD5: {md5_hash}")
                return api_success({"md5": md5_hash})
            else:
                return api_error("计算 MD5 哈希失败。", 500)
        except Exception as e:
             return api_error(f"MD5 计算期间发生意外错误: {e}", 500)

    @app.route('/api/json-calibration-check', methods=['GET'])
    def json_calibration_check():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: JSON 校准检查 (查找缺失文件)")
        internal_data_path = local_context.get_internal_data_path()
        if not internal_data_path:
            return api_error("未设置主仓库，无法定位内部数据文件。", 500)

        json_data = read_json_file(internal_data_path, "内部用户数据")
        if json_data is None or not isinstance(json_data, list):
             logger.warning("未找到、无效或不是列表的内部数据文件。无法执行检查。")
             return api_error("未找到内部数据文件或格式无效。", 500)

        missing_entries = []
        checked_count = 0
        start_time = time.time()
        total_entries = len(json_data)
        logger.info(f"开始对 {total_entries} 个条目进行 JSON 校准检查...")

        for i, entry in enumerate(json_data):
            if not isinstance(entry, dict):
                 logger.warning(f"跳过内部数据中索引 {i} 处的无效条目 (非字典)。")
                 continue

            relative_path_from_json = entry.get('path')
            entry_id = entry.get("gid") or entry.get("attributes", {}).get("geldId", f"index_{i}")

            if not relative_path_from_json or not isinstance(relative_path_from_json, str):
                logger.warning(f"因缺少或无效的 'path' 字段，跳过条目 ID '{entry_id}'。")
                continue

            physical_path, _ = local_context.resolve_relative_path(relative_path_from_json)

            if not physical_path or not physical_path.is_file():
                logger.debug(f"  文件缺失: 路径 '{relative_path_from_json}' (ID: {entry_id}) 未找到。")
                missing_entries.append({
                    "path": relative_path_from_json,
                    "characterName": entry.get("characterName"),
                    "filename": entry.get("attributes", {}).get("filename"),
                    "id": entry_id
                })

            checked_count += 1
            if checked_count % 500 == 0:
                logger.info(f"  校准检查进度: {checked_count}/{total_entries}")

        elapsed = time.time() - start_time
        logger.info(f"JSON 校准检查在 {elapsed:.2f} 秒内完成。已检查: {checked_count}, 缺失: {len(missing_entries)}。")
        return api_success({
            "totalChecked": checked_count,
            "missingEntries": missing_entries,
            "totalMissing": len(missing_entries)
        })

    @app.route('/api/json-calibration-remove', methods=['POST'])
    def json_calibration_remove():
        local_context: AppContext = current_app.config['APP_CONTEXT']
        logger.info("API 请求: 从 JSON 中移除缺失条目")
        internal_data_path = local_context.get_internal_data_path()
        if not internal_data_path:
            return api_error("未设置主仓库，无法定位内部数据文件。", 500)

        try:
            data = request.get_json()
            if not isinstance(data, dict):
                 return api_error("无效的请求体，应为 JSON 对象。", 400)

            paths_to_remove = data.get('paths_to_remove')
            if not isinstance(paths_to_remove, list):
                return api_error("无效的请求体，'paths_to_remove' 必须是列表。", 400)

        except Exception as e:
             logger.error(f"处理 JSON 移除请求数据时出错: {e}", exc_info=True)
             return api_error("无效的请求数据。", 400)

        if not paths_to_remove:
             return api_success(message="未提供要移除的路径。")

        logger.info(f"尝试从内部 JSON 数据中移除 {len(paths_to_remove)} 个条目...")
        set_paths_to_remove = set(paths_to_remove)

        try:
            saved_entries = read_json_file(internal_data_path, "内部用户数据")
            if saved_entries is None or not isinstance(saved_entries, list):
                logger.error("无法移除条目: 未找到、无效或不是列表的内部数据文件。")
                return api_error("未找到内部数据文件或格式无效。", 500)

            original_count = len(saved_entries)
            filtered_entries = [
                entry for entry in saved_entries
                if not (isinstance(entry, dict) and entry.get('path') in set_paths_to_remove)
            ]
            new_count = len(filtered_entries)
            removed_count = original_count - new_count

            if removed_count > 0:
                logger.info(f"移除了 {removed_count} 个条目。将 {new_count} 个剩余条目写回文件。")
                write_json_file(internal_data_path, filtered_entries, "内部用户数据 (移除后)")
                return api_success({"newCount": new_count, "removedCount": removed_count},
                                   message=f"成功移除了 {removed_count} 个缺失文件条目。")
            else:
                logger.info("在内部数据文件中未找到要移除的匹配条目。")
                return api_success({"newCount": new_count, "removedCount": 0},
                                   message="未找到要移除的匹配条目。")

        except (IOError, ValueError) as e:
            return api_error(f"移除期间读取或写入内部数据文件失败: {e}", 500)
        except Exception as e:
            return api_error(f"移除过程中发生意外错误: {e}", 500)

def run_server(context: AppContext, host='localhost'):
    global flask_server, stop_event
    port = context.port
    logger.info(f"服务器线程已启动。尝试在 http://{host}:{port} 上运行")
    stop_event.clear()
    flask_app_instance: Optional[Flask] = None
    flask_server_instance: Optional[BaseWSGIServer] = None
    initialization_ok = False

    try:
        logger.debug("步骤 1: 检查主仓库路径...")
        if not context.main_repo_path:
            raise RuntimeError("未设置主仓库路径。")
        logger.debug(f"主仓库路径正常: {context.main_repo_path}")

        logger.debug("步骤 2: 初始化服务器目录和文件...")
        if not initialize_server_environment(context):
             raise RuntimeError("服务器环境初始化失败。")
        logger.debug("服务器环境正常。")

        logger.debug("步骤 3: 创建 Flask 应用...")
        flask_app_instance = create_flask_app(context)
        if not flask_app_instance:
            raise RuntimeError("创建 Flask 应用失败。")
        logger.debug("Flask 应用已创建。")
        initialization_ok = True

        werkzeug_logger = logging.getLogger('werkzeug')
        werkzeug_logger.setLevel(logging.WARNING)

        flask_server_instance = make_server(host, port, flask_app_instance, threaded=True)
        flask_server = flask_server_instance

        logger.info(f"Flask 服务器正在 http://{host}:{port} 启动...")
        if main_app_instance:
            main_app_instance.update_status_async(f"运行中 @ http://{host}:{port}")

        flask_server_instance.serve_forever()

        logger.info("Flask 服务器已正常停止。")

    except OSError as e:
        if "address already in use" in str(e).lower() or "地址已被使用" in str(e):
             logger.error(f"启动服务器失败: 端口 {port} 已被占用。", exc_info=True)
             if main_app_instance:
                  main_app_instance.show_messagebox_async("error", "启动失败", f"端口 {port} 已被占用。请选择其他端口或关闭使用该端口的应用程序。")
        else:
             logger.error(f"因 OS 错误导致启动服务器失败: {e}", exc_info=True)
             if main_app_instance:
                  main_app_instance.show_messagebox_async("error", "启动失败", f"发生操作系统错误:\n{e}")
    except RuntimeError as e:
        logger.error(f"启动服务器失败: {e}", exc_info=False)
        if main_app_instance:
             main_app_instance.show_messagebox_async("error", "启动失败", f"服务器初始化失败:\n{e}")
    except Exception as e:
        logger.error(f"服务器线程中发生意外错误: {e}", exc_info=True)
        if main_app_instance:
            main_app_instance.show_messagebox_async("error", "服务器错误", f"发生意外的服务器错误:\n{e}")
    finally:
        logger.info("服务器线程正在进入 finally 块。")
        server_to_shutdown = flask_server_instance or flask_server
        if server_to_shutdown and hasattr(server_to_shutdown, '_BaseServer__is_shut_down') and not server_to_shutdown._BaseServer__is_shut_down.is_set():
            logger.info("尝试最终关闭 Flask 服务器...")
            try:
                 server_to_shutdown.shutdown()
                 logger.info("在 finally 块中完成 Flask 服务器关闭。")
            except Exception as shutdown_e:
                 logger.warning(f"最终服务器关闭期间出错: {shutdown_e}")

        flask_server = None
        final_status = "已停止" if initialization_ok and stop_event.is_set() else "失败或意外停止"

        if main_app_instance:
            logger.debug("正在安排来自服务器线程的最终 UI 更新。")
            main_app_instance.update_status_async(final_status)
            main_app_instance.server_stopped_ui_update()

        logger.info(f"服务器线程执行完毕 (状态: {final_status})。")

def start_server_thread():
    global server_thread, stop_event, app_context, main_app_instance

    logger.info("尝试启动服务器线程...")
    if server_thread and server_thread.is_alive():
        logger.warning("服务器已在运行中。")
        messagebox.showwarning("服务器运行中", "服务器已经在运行。")
        return

    if not main_app_instance:
         logger.error("无法启动服务器: GUI 应用实例不可用。")
         return

    port_str = main_app_instance.get_port_var()
    try:
        port = int(port_str)
        if not 1024 <= port <= 65535:
            raise ValueError("端口号必须在 1024 和 65535 之间")
        app_context.port = port
        logger.info(f"使用端口: {port}")
    except (ValueError, TypeError) as e:
        logger.error(f"无效的端口号 '{port_str}': {e}。使用默认端口 {DEFAULT_PORT}。")
        messagebox.showerror("端口无效", f"无效的端口号: '{port_str}'。\n请输入 1024 到 65535 之间的数字。\n将使用默认端口 {DEFAULT_PORT}。")
        main_app_instance.set_port_var(str(DEFAULT_PORT))
        app_context.port = DEFAULT_PORT

    if not app_context.main_repo_path or not app_context.main_repo_path.is_dir():
         logger.error("无法启动服务器: 未设置或无效的主仓库路径。")
         messagebox.showerror("仓库错误", "请在启动服务器前选择一个有效的主仓库目录。")
         return

    stop_event.clear()
    server_thread = threading.Thread(target=run_server, args=(app_context, 'localhost'), name="FlaskServerThread")
    server_thread.daemon = True
    server_thread.start()
    logger.info("服务器线程已启动。")

    main_app_instance.server_started_ui_update()
    main_app_instance.update_status_async("启动中...")

def stop_server_thread():
    global stop_event, flask_server, server_thread

    logger.info("尝试停止服务器线程...")
    if not server_thread or not server_thread.is_alive():
        logger.info("服务器未在运行。")
        if main_app_instance:
             main_app_instance.server_stopped_ui_update()
        return

    logger.info("正在设置停止事件...")
    stop_event.set()

    if flask_server:
        logger.info("正在对 Werkzeug 服务器实例调用 shutdown()...")
        try:
            flask_server.shutdown()
        except Exception as e:
            logger.warning(f"调用 flask_server.shutdown() 时出错: {e}")
    else:
        logger.warning("未找到 Flask 服务器实例，无法直接触发 shutdown。依赖于 stop_event。")

    logger.info("停止信号已发送。服务器线程应很快终止。")

def initialize_server_environment(context: AppContext) -> bool:
    logger.info("正在初始化服务器环境...")
    if not context.main_repo_path:
        logger.error("初始化失败: 未设置主仓库路径。")
        return False

    try:
        gu_tools_dir = context.get_gu_tools_dir()
        gallery_data_dir = context.get_gallery_data_dir()

        if not gu_tools_dir: raise ValueError(f"无法确定 {GUTOOLS_DIRECTORY_NAME} 路径。")
        if not gallery_data_dir: raise ValueError(f"无法确定 {GALLERY_DATA_DIRECTORY_NAME} 路径。")

        gu_tools_dir.mkdir(exist_ok=True)
        gallery_data_dir.mkdir(exist_ok=True)
        logger.debug(f"确保目录存在: {gu_tools_dir}")
        logger.debug(f"确保目录存在: {gallery_data_dir}")

        imgtemp_dir = context.get_imgtemp_directory()
        img_dir = context.get_img_directory()

        if imgtemp_dir: imgtemp_dir.mkdir(exist_ok=True); logger.debug(f"确保目录存在: {imgtemp_dir}")
        else: logger.warning("无法确定 imgtemp 目录路径。")

        if img_dir: img_dir.mkdir(exist_ok=True); logger.debug(f"确保目录存在: {img_dir}")
        else: logger.warning("无法确定 img 目录路径。")

        files_to_check = [
            (context.get_internal_data_path, "内部用户数据", []),
            (context.get_external_data_path, "外部用户数据", []),
            (context.get_gallery_config_yaml_path, "图库配置",
             {'GGOP': 1, 'Px18img-type': 0, 'Rx18img-type': 0, 'MihoyoOption': 0})
        ]

        for get_path_func, description, default_content in files_to_check:
            file_path = get_path_func()
            if not file_path:
                logger.warning(f"无法确定 '{description}' 的路径。跳过检查/创建。")
                continue

            if not file_path.exists():
                logger.info(f"在 {file_path} 未找到 '{description}' 文件。正在创建默认文件。")
                try:
                    if isinstance(default_content, (list, dict)):
                         if file_path.suffix.lower() == '.json':
                              write_json_file(file_path, default_content, f"{description} (默认)")
                         elif file_path.suffix.lower() in ['.yaml', '.yml']:
                              write_yaml_file(file_path, default_content, f"{description} (默认)")
                         else:
                              logger.warning(f"未知的默认内容文件类型: {file_path.suffix}")
                except (IOError, ValueError) as e:
                    logger.error(f"在 {file_path} 创建默认 '{description}' 文件失败: {e}")
                    raise RuntimeError(f"创建必要文件失败: {description}") from e
            else:
                logger.debug(f"'{description}' 文件存在于 {file_path}")

        logger.info("服务器环境初始化检查成功完成。")
        return True

    except (ValueError, OSError, RuntimeError) as e:
        logger.error(f"服务器环境初始化失败: {e}", exc_info=True)
        return False
    except Exception as e:
         logger.error(f"服务器环境初始化期间发生意外错误: {e}", exc_info=True)
         return False

class Application(tk.Frame):
    def __init__(self, master=None):
        super().__init__(master)
        self.master = master
        self.master.title("咕咕牛工具箱")
        self._apply_icon()
        self.master.geometry("700x600")
        self.pack(fill=tk.BOTH, expand=tk.YES, padx=5, pady=5)

        self.main_repo_path_var = tk.StringVar()
        self.port_var = tk.StringVar(value=str(DEFAULT_PORT))
        self.status_var = tk.StringVar(value="状态：空闲")
        self.log_text_widget: Optional[scrolledtext.ScrolledText] = None

        self._create_widgets()
        self._configure_logging_to_widget()

        self.main_repo_path_var.set(DEFAULT_MAIN_REPO_PATH)
        self.path_changed()

        self.master.protocol("WM_DELETE_WINDOW", self._on_closing)

    def _apply_icon(self):
        try:
            icon_path = None
            if sys.platform == "win32" and Path("icon.ico").is_file():
                icon_path = Path("icon.ico")
                self.master.iconbitmap(str(icon_path))
                logger.debug("已应用图标: icon.ico")
            elif Path("icon.png").is_file():
                icon_path = Path("icon.png")
                img = tk.PhotoImage(file=str(icon_path))
                self.master.icon_image = img
                self.master.iconphoto(True, img)
                logger.debug("已应用图标: icon.png")
            else:
                 logger.warning("未找到窗口图标文件 (icon.ico 或 icon.png)。")

        except Exception as e:
            logger.warning(f"设置窗口图标失败: {e}")

    def _create_widgets(self):
        path_frame = ttk.LabelFrame(self, text="仓库设置")
        path_frame.pack(padx=10, pady=(10, 5), fill=tk.X)
        path_frame.columnconfigure(1, weight=1)

        ttk.Label(path_frame, text="主仓库路径:").grid(row=0, column=0, padx=(5, 2), pady=5, sticky=tk.W)
        self.path_entry = ttk.Entry(path_frame, textvariable=self.main_repo_path_var, width=70)
        self.path_entry.grid(row=0, column=1, padx=(0, 5), pady=5, sticky=tk.EW)

        self.browse_button = ttk.Button(path_frame, text="浏览...", command=self._browse_directory)
        self.browse_button.grid(row=0, column=2, padx=(0, 5), pady=5)

        control_frame = ttk.LabelFrame(self, text="服务器控制")
        control_frame.pack(padx=10, pady=5, fill=tk.X)

        ttk.Label(control_frame, text="端口:").grid(row=0, column=0, padx=(5, 2), pady=5, sticky=tk.W)
        self.port_entry = ttk.Entry(control_frame, textvariable=self.port_var, width=8)
        self.port_entry.grid(row=0, column=1, padx=(0, 10), pady=5, sticky=tk.W)

        button_frame = ttk.Frame(control_frame)
        control_frame.columnconfigure(2, weight=1)
        button_frame.grid(row=0, column=2, padx=(10, 5), pady=5, sticky=tk.E)

        self.start_button = ttk.Button(button_frame, text="启动服务器", command=start_server_thread)
        self.start_button.pack(side=tk.LEFT, padx=(0, 5))

        self.stop_button = ttk.Button(button_frame, text="停止服务器", command=stop_server_thread, state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT)

        log_frame = ttk.LabelFrame(self, text="日志输出")
        log_frame.pack(padx=10, pady=(5, 0), fill=tk.BOTH, expand=tk.YES)

        self.log_text_widget = scrolledtext.ScrolledText(log_frame, state=tk.DISABLED, wrap=tk.WORD, height=18, font=("Consolas", 9))
        self.log_text_widget.pack(fill=tk.BOTH, expand=tk.YES, padx=5, pady=5)

        status_bar = ttk.Label(self, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W, padding=(5, 2))
        status_bar.pack(side=tk.BOTTOM, fill=tk.X, pady=(5, 0))

        self.main_repo_path_var.trace_add("write", self.path_changed)

    def _configure_logging_to_widget(self):
        if not self.log_text_widget: return

        text_handler = TextHandler(self.log_text_widget)
        text_handler.setFormatter(log_formatter)
        text_handler.setLevel(logging.DEBUG)
        logger.addHandler(text_handler)
        logger.info("GUI 日志处理程序已配置。")

    def _browse_directory(self):
        initial_dir = None
        current_path_str = self.main_repo_path_var.get()
        if current_path_str:
            try:
                initial_dir = str(Path(current_path_str).parent)
            except Exception:
                 pass

        directory = filedialog.askdirectory(
            title="选择主仓库文件夹 (例如 Miao-Plugin-MBT)",
            initialdir=initial_dir
        )
        if directory:
            self.main_repo_path_var.set(directory)

    def path_changed(self, *args):
        global app_context
        path_str = self.main_repo_path_var.get()
        logger.info(f"GUI 中的路径已更改: {path_str}")

        is_valid = app_context.set_main_repo_path(path_str)

        if is_valid and app_context.main_repo_path:
            repo_list_str = ", ".join(app_context.detected_repositories.keys())
            self.update_status_async(f"仓库已加载 ({len(app_context.detected_repositories)}): {repo_list_str[:80]}...")
            if server_thread and server_thread.is_alive():
                 self.show_messagebox_async("warning", "路径已更改", "服务器运行时仓库路径已更改。\n请停止并重新启动服务器以应用更改。")
        elif not path_str:
             self.update_status_async("状态：未选择仓库")
        else:
             self.update_status_async("状态：无效的仓库路径")

    def update_status_async(self, message: str):
        if self.winfo_exists():
             self.master.after(0, lambda: self.status_var.set(f"状态：{message}"))

    def show_messagebox_async(self, msg_type: str, title: str, message: str):
         if self.winfo_exists():
              func = None
              if msg_type == "info": func = messagebox.showinfo
              elif msg_type == "warning": func = messagebox.showwarning
              elif msg_type == "error": func = messagebox.showerror
              else: func = messagebox.showinfo

              self.master.after(0, lambda t=title, m=message: func(t, m))

    def _set_widget_state(self, state: str):
        widgets = [
            self.path_entry, self.browse_button,
            self.port_entry, self.start_button
        ]
        for widget in widgets:
            if widget and widget.winfo_exists():
                try:
                    widget.config(state=state)
                except tk.TclError: pass

    def server_started_ui_update(self):
        self.master.after(0, self._server_started_ui_update_sync)

    def _server_started_ui_update_sync(self):
        self._set_widget_state(tk.DISABLED)
        if self.stop_button and self.stop_button.winfo_exists():
             self.stop_button.config(state=tk.NORMAL)

    def server_stopped_ui_update(self):
        self.master.after(0, self._server_stopped_ui_update_sync)

    def _server_stopped_ui_update_sync(self):
        self._set_widget_state(tk.NORMAL)
        if self.stop_button and self.stop_button.winfo_exists():
             self.stop_button.config(state=tk.DISABLED)

    def get_port_var(self) -> str:
         return self.port_var.get()

    def set_port_var(self, value: str):
         self.port_var.set(value)

    def _on_closing(self):
        logger.info("请求关闭窗口。正在关闭...")
        self.update_status_async("正在关闭...")

        if server_thread and server_thread.is_alive():
            logger.info("服务器正在运行。尝试正常关闭...")
            stop_server_thread()
            server_thread.join(timeout=2.0)

            if server_thread.is_alive():
                 logger.warning("服务器线程在超时内未退出。")
            else:
                 logger.info("服务器线程已退出。")
        else:
            logger.info("服务器未运行。")

        logger.info("正在销毁 Tkinter 窗口。")
        self.master.destroy()

class TextHandler(logging.Handler):
    def __init__(self, text_widget):
        logging.Handler.__init__(self)
        self.text_widget = text_widget
        self.queue = []
        self.polling_interval = 100
        self._schedule_poll()

    def emit(self, record):
        msg = self.format(record)
        self.queue.append(msg)

    def _schedule_poll(self):
         if self.text_widget.winfo_exists():
              self.text_widget.after(self.polling_interval, self._process_queue)

    def _process_queue(self):
        if not self.text_widget.winfo_exists():
            logger.warning("日志组件已销毁，停止 TextHandler 处理。")
            try:
                 logger.removeHandler(self)
            except Exception: pass
            return

        try:
            while self.queue:
                 message = self.queue.pop(0)
                 self.text_widget.configure(state=tk.NORMAL)
                 current_lines = int(self.text_widget.index('end-1c').split('.')[0])
                 if current_lines > 1500:
                      lines_to_delete = current_lines - 1000
                      self.text_widget.delete('1.0', f'{lines_to_delete + 1}.0')

                 self.text_widget.insert(tk.END, message + "\n")
                 self.text_widget.see(tk.END)
                 self.text_widget.configure(state=tk.DISABLED)
                 self.text_widget.update_idletasks()
        except tk.TclError as e:
             if "invalid command name" in str(e):
                 logger.warning("日志组件在队列处理期间变为无效。")
                 self.queue.clear()
                 return
             else:
                 raise
        except Exception as e:
             print(f"错误：为 GUI 处理日志队列时出错: {e}", file=sys.stderr)
             traceback.print_exc(file=sys.stderr)

        self._schedule_poll()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logger.info("应用程序正在启动...")

    if sys.platform == "win32":
        try:
            from ctypes import windll
            windll.shcore.SetProcessDpiAwareness(1)
            logger.info("已将 DPI 感知设置为系统感知。")
        except Exception as e:
            logger.warning(f"无法设置 DPI 感知: {e}")

    root = tk.Tk()
    main_app_instance = Application(master=root)

    logger.info("正在启动 Tkinter 主循环。")
    root.mainloop()

    logger.info("Tkinter 主循环已结束。应用程序正在退出。")