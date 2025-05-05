import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
import os
import threading
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

# --- 加密配置与JS端保持一致 ---
ENCRYPTION_PASSWORD = b"1004031540" # 使用字节串
SALT = b'guguniumbtpm18salt' # 固定盐值，必须与 JS 端一致
KEY_LENGTH = 32 # AES-256
ITERATIONS = 100000 # PBKDF2 迭代次数
# --- 配置结束 ---

# --- 密钥派生 ---
def derive_key(password, salt):
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=ITERATIONS,
        backend=default_backend()
    )
    return kdf.derive(password)

ENCRYPTION_KEY = derive_key(ENCRYPTION_PASSWORD, SALT)

# --- PKCS7 填充 ---
def pkcs7_pad(data, block_size):
    padder = padding.PKCS7(block_size * 8).padder()
    padded_data = padder.update(data) + padder.finalize()
    return padded_data

# --- 加密函数 ---
def encrypt_file(input_path, output_path, key, log_callback):
    try:
        with open(input_path, 'rb') as f:
            plaintext = f.read()

        # 生成随机 IV
        iv = os.urandom(16) # AES block size is 16 bytes

        # PKCS7 填充
        padded_data = pkcs7_pad(plaintext, algorithms.AES.block_size // 8)

        # 创建 AES CBC 加密器
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
        encryptor = cipher.encryptor()

        # 加密
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()

        # 写入 IV + 密文
        with open(output_path, 'wb') as f:
            f.write(iv)
            f.write(ciphertext)
        log_callback(f"✅ 加密成功: {os.path.basename(input_path)} -> {os.path.basename(output_path)}")
        return True
    except Exception as e:
        log_callback(f"❌ 加密失败: {os.path.basename(input_path)} - {e}")
        return False

# --- GUI 部分 ---
class EncryptorApp:
    def __init__(self, master):
        self.master = master
        master.title("咕咕牛PM工具 (WEBP -> MBT)")
        master.geometry("500x400")

        self.label_info = tk.Label(master, text="选择 .webp 文件或包含 .webp 文件的文件夹进行加密:")
        self.label_info.pack(pady=5)

        self.frame_select = tk.Frame(master)
        self.frame_select.pack(fill=tk.X, padx=10)

        self.btn_select_files = tk.Button(self.frame_select, text="选择文件", command=self.select_files)
        self.btn_select_files.pack(side=tk.LEFT, padx=5)

        self.btn_select_folder = tk.Button(self.frame_select, text="选择文件夹", command=self.select_folder)
        self.btn_select_folder.pack(side=tk.LEFT, padx=5)

        self.label_selected = tk.Label(master, text="已选择: 0 文件/文件夹", wraplength=480)
        self.label_selected.pack(pady=5)

        self.btn_encrypt = tk.Button(master, text="开始加密", command=self.start_encryption_thread, state=tk.DISABLED)
        self.btn_encrypt.pack(pady=10)

        self.log_area = scrolledtext.ScrolledText(master, height=10, state=tk.DISABLED)
        self.log_area.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)

        self.selected_paths = []

    def log(self, message):
        self.log_area.config(state=tk.NORMAL)
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)
        self.log_area.config(state=tk.DISABLED)
        self.master.update_idletasks() # 强制刷新界面

    def select_files(self):
        files = filedialog.askopenfilenames(title="选择 WebP 文件", filetypes=[("WebP 图片", "*.webp")])
        if files:
            self.selected_paths = list(files)
            self.label_selected.config(text=f"已选择: {len(self.selected_paths)} 文件")
            self.btn_encrypt.config(state=tk.NORMAL)
            self.log(f"已选择 {len(self.selected_paths)} 个文件。")

    def select_folder(self):
        folder = filedialog.askdirectory(title="选择包含 WebP 文件的文件夹")
        if folder:
            self.selected_paths = [folder]
            self.label_selected.config(text=f"已选择文件夹: {os.path.basename(folder)}")
            self.btn_encrypt.config(state=tk.NORMAL)
            self.log(f"已选择文件夹: {folder}")

    def start_encryption_thread(self):
        if not self.selected_paths:
            messagebox.showwarning("未选择", "请先选择文件或文件夹！")
            return

        self.btn_encrypt.config(state=tk.DISABLED)
        self.btn_select_files.config(state=tk.DISABLED)
        self.btn_select_folder.config(state=tk.DISABLED)
        self.log_area.config(state=tk.NORMAL)
        self.log_area.delete(1.0, tk.END)
        self.log_area.config(state=tk.DISABLED)
        self.log("🚀 开始加密任务...")

        # 使用线程避免 GUI 卡死
        thread = threading.Thread(target=self.process_encryption)
        thread.start()

    def process_encryption(self):
        success_count = 0
        fail_count = 0
        total_processed = 0

        for item_path in self.selected_paths:
            if os.path.isfile(item_path):
                if item_path.lower().endswith(".webp"):
                    total_processed += 1
                    output_dir = os.path.dirname(item_path)
                    base_name = os.path.basename(item_path)
                    output_name = os.path.splitext(base_name)[0] + ".MBT"
                    output_path = os.path.join(output_dir, output_name)
                    if encrypt_file(item_path, output_path, ENCRYPTION_KEY, self.log):
                        success_count += 1
                    else:
                        fail_count += 1
            elif os.path.isdir(item_path):
                self.log(f"📂 正在扫描文件夹: {item_path}")
                for root, _, files in os.walk(item_path):
                    for file in files:
                        if file.lower().endswith(".webp"):
                            total_processed += 1
                            input_file_path = os.path.join(root, file)
                            output_dir = root # 默认输出到同目录
                            output_name = os.path.splitext(file)[0] + ".MBT"
                            output_path = os.path.join(output_dir, output_name)
                            if encrypt_file(input_file_path, output_path, ENCRYPTION_KEY, self.log):
                                success_count += 1
                            else:
                                fail_count += 1

        self.log("--------------------")
        self.log(f"🏁 加密任务完成！")
        self.log(f"总处理 WebP 文件数: {total_processed}")
        self.log(f"成功加密: {success_count}")
        self.log(f"加密失败: {fail_count}")

        # 恢复按钮状态
        self.btn_encrypt.config(state=tk.NORMAL)
        self.btn_select_files.config(state=tk.NORMAL)
        self.btn_select_folder.config(state=tk.NORMAL)
        if fail_count > 0:
             messagebox.showerror("加密完成", f"加密完成，但有 {fail_count} 个文件失败，请查看日志。")
        elif success_count > 0:
             messagebox.showinfo("加密完成", f"成功加密 {success_count} 个文件！")
        else:
             messagebox.showinfo("加密完成", "未找到需要加密的 WebP 文件。")


if __name__ == "__main__":
    root = tk.Tk()
    app = EncryptorApp(root)
    root.mainloop()