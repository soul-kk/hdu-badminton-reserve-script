#!/usr/bin/env python3
"""
build.py — 使用 PyInstaller 打包 get_token 为单文件可执行程序
使用方式: python build.py

打包前请确保已安装:
  pip install pyinstaller mitmproxy
"""

import subprocess
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    # 检查 PyInstaller
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("未找到 PyInstaller，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    # 检查 mitmproxy（打包时需要它在环境中）
    try:
        import mitmproxy  # noqa: F401
    except ImportError:
        print("未找到 mitmproxy，正在安装...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "mitmproxy"])

    entry = os.path.join(SCRIPT_DIR, "get_token.py")
    addon = os.path.join(SCRIPT_DIR, "extractor.py")

    # 构建 --add-data 参数（分隔符 macOS/Linux 用 :，Windows 用 ;）
    sep = ";" if sys.platform == "win32" else ":"
    add_data = f"{addon}{sep}."

    cmd = [
        sys.executable, "-m", "PyInstaller",
        entry,
        "--onefile",
        "--name", "get_token",
        "--add-data", add_data,
        "--hidden-import", "mitmproxy",
        "--hidden-import", "mitmproxy.addons",
        "--hidden-import", "mitmproxy.net",
        "--hidden-import", "mitmproxy.proxy",
        "--distpath", os.path.join(SCRIPT_DIR, "dist"),
        "--workpath", os.path.join(SCRIPT_DIR, "build"),
        "--specpath", SCRIPT_DIR,
        "--noconfirm",
    ]

    print(f"\n{'='*50}")
    print("开始打包...")
    print(f"{'='*50}\n")
    subprocess.check_call(cmd)

    # 打包完成
    if sys.platform == "win32":
        output = os.path.join(SCRIPT_DIR, "dist", "get_token.exe")
    else:
        output = os.path.join(SCRIPT_DIR, "dist", "get_token")

    print(f"\n{'='*50}")
    print(f"打包完成！")
    print(f"输出: {output}")
    print(f"大小: {os.path.getsize(output) / 1024 / 1024:.1f} MB")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
