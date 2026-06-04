#!/usr/bin/env python3
"""
get_token.py — 跨平台一键获取场地预约系统 Token
支持 macOS / Windows
使用方式: python get_token.py
"""

import os
import sys
import time
import shutil
import signal
import tempfile
import subprocess
import platform

# ============================================================
#  配置
# ============================================================
PROXY_PORT = 18888

# PyInstaller 打包后，资源文件会解压到 sys._MEIPASS 临时目录
if getattr(sys, "_MEIPASS", None):
    _BUNDLE_DIR = sys._MEIPASS
else:
    _BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))

# 进程间通信用的临时文件，读完即删，不持久化
TOKEN_FILE = tempfile.mktemp(prefix="badminton_token_", suffix=".tmp")
ADDON_FILE = os.path.join(_BUNDLE_DIR, "extractor.py")
TIMEOUT = 240  # 4 分钟

IS_WINDOWS = platform.system() == "Windows"
IS_MACOS = platform.system() == "Darwin"

# ============================================================
#  终端颜色（Windows 10+ 支持 ANSI）
# ============================================================
if IS_WINDOWS:
    os.system("")  # 启用 Windows ANSI 支持

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
NC = "\033[0m"


def print_step(msg):
    print(f"\n{CYAN}{BOLD}▶ {msg}{NC}")


def print_ok(msg):
    print(f"{GREEN}✓ {msg}{NC}")


def print_warn(msg):
    print(f"{YELLOW}⚠ {msg}{NC}")


def print_err(msg):
    print(f"{RED}✗ {msg}{NC}")


# ============================================================
#  代理管理
# ============================================================
_proxy_enabled = False


def _run(cmd, check=True, **kwargs):
    """执行系统命令，静默输出"""
    return subprocess.run(
        cmd, check=check, capture_output=True, text=True, **kwargs
    )


# ---- macOS 代理 ----
def _get_active_interface_mac():
    """获取当前活跃网卡的 networksetup 服务名"""
    try:
        result = _run(["route", "-n", "get", "default"], check=False)
        device = None
        for line in result.stdout.splitlines():
            if "interface:" in line:
                device = line.strip().split()[-1]
                break
        if not device:
            return "Wi-Fi"

        result = _run(["networksetup", "-listallhardwareports"])
        lines = result.stdout.splitlines()
        port = ""
        for line in lines:
            if "Hardware Port:" in line:
                port = line.split("Hardware Port:")[-1].strip()
            elif "Device:" in line and device in line:
                return port
    except Exception:
        pass
    return "Wi-Fi"


_mac_interface = None


def set_proxy_mac():
    global _mac_interface
    _mac_interface = _get_active_interface_mac()
    iface = _mac_interface
    _run(["networksetup", "-setwebproxy", iface, "127.0.0.1", str(PROXY_PORT)])
    _run(["networksetup", "-setsecurewebproxy", iface, "127.0.0.1", str(PROXY_PORT)])
    _run(["networksetup", "-setwebproxystate", iface, "on"])
    _run(["networksetup", "-setsecurewebproxystate", iface, "on"])


def restore_proxy_mac():
    iface = _mac_interface or "Wi-Fi"
    _run(["networksetup", "-setwebproxystate", iface, "off"], check=False)
    _run(["networksetup", "-setsecurewebproxystate", iface, "off"], check=False)


# ---- Windows 代理 ----
_win_original_proxy = None


def set_proxy_win():
    global _win_original_proxy
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
    try:
        # 保存原始状态
        try:
            orig_enable, _ = winreg.QueryValueEx(key, "ProxyEnable")
            orig_server, _ = winreg.QueryValueEx(key, "ProxyServer")
        except FileNotFoundError:
            orig_enable, orig_server = 0, ""
        _win_original_proxy = (orig_enable, orig_server)

        # 设置代理
        winreg.SetValueEx(key, "ProxyEnable", 0, winreg.REG_DWORD, 1)
        winreg.SetValueEx(key, "ProxyServer", 0, winreg.REG_SZ, f"127.0.0.1:{PROXY_PORT}")
    finally:
        winreg.CloseKey(key)
    # 通知系统代理变更
    _notify_win_proxy_change()


def restore_proxy_win():
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Internet Settings"
    key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
    try:
        if _win_original_proxy:
            winreg.SetValueEx(key, "ProxyEnable", 0, winreg.REG_DWORD, _win_original_proxy[0])
            winreg.SetValueEx(key, "ProxyServer", 0, winreg.REG_SZ, _win_original_proxy[1])
        else:
            winreg.SetValueEx(key, "ProxyEnable", 0, winreg.REG_DWORD, 0)
    finally:
        winreg.CloseKey(key)
    _notify_win_proxy_change()


def _notify_win_proxy_change():
    """通知 Windows 系统代理设置已变更"""
    try:
        import ctypes
        import ctypes.wintypes
        INTERNET_OPTION_SETTINGS_CHANGED = 39
        INTERNET_OPTION_REFRESH = 37
        internet_set_option = ctypes.windll.wininet.InternetSetOptionW
        internet_set_option(0, INTERNET_OPTION_SETTINGS_CHANGED, 0, 0)
        internet_set_option(0, INTERNET_OPTION_REFRESH, 0, 0)
    except Exception:
        pass


# ---- 统一接口 ----
def set_proxy():
    global _proxy_enabled
    print_step(f"设置系统代理 → 127.0.0.1:{PROXY_PORT}")
    if IS_MACOS:
        set_proxy_mac()
    elif IS_WINDOWS:
        set_proxy_win()
    else:
        print_err("不支持的操作系统，请手动设置代理")
        sys.exit(1)
    _proxy_enabled = True
    print_ok("代理已开启")


def restore_proxy():
    global _proxy_enabled
    if not _proxy_enabled:
        return
    if IS_MACOS:
        restore_proxy_mac()
    elif IS_WINDOWS:
        restore_proxy_win()
    _proxy_enabled = False
    print_ok("代理已关闭，网络恢复正常")


# ============================================================
#  证书管理
# ============================================================
def get_cert_path():
    return os.path.join(os.path.expanduser("~"), ".mitmproxy", "mitmproxy-ca-cert.pem")


def check_cert():
    print_step("检查 mitmproxy CA 证书")
    cert_path = get_cert_path()

    if not os.path.exists(cert_path):
        print_warn("未找到证书，先启动一次 mitmdump 生成...")
        proc = subprocess.Popen(
            ["mitmdump", "--listen-port", str(PROXY_PORT), "--quiet"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        time.sleep(2)
        proc.terminate()
        proc.wait()

    if not os.path.exists(cert_path):
        print_err("证书生成失败，请手动运行一次 mitmdump")
        sys.exit(1)

    if IS_MACOS:
        _install_cert_mac(cert_path)
    elif IS_WINDOWS:
        _install_cert_win(cert_path)


def _install_cert_mac(cert_path):
    result = _run(
        ["security", "find-certificate", "-a", "-c", "mitmproxy",
         "/Library/Keychains/System.keychain"],
        check=False
    )
    if "mitmproxy" not in result.stdout:
        print_warn("证书未安装，正在安装到系统钥匙串（需要输入密码）...")
        _run(["sudo", "security", "add-trusted-cert", "-d", "-r", "trustRoot",
              "-k", "/Library/Keychains/System.keychain", cert_path])
        print_ok("证书已安装并信任")
    else:
        print_ok("mitmproxy 证书已信任")


def _install_cert_win(cert_path):
    result = _run(["certutil", "-store", "root"], check=False)
    if "mitmproxy" in result.stdout:
        print_ok("mitmproxy 证书已信任")
        return

    print_warn("证书未安装，正在安装到受信任的根证书（需要管理员权限）...")
    result = _run(
        ["certutil", "-addstore", "root", cert_path],
        check=False
    )
    if result.returncode == 0:
        print_ok("证书已安装并信任")
    else:
        print_err("证书安装失败，请以管理员身份运行此脚本")
        print_err(f"  或手动执行: certutil -addstore root \"{cert_path}\"")
        sys.exit(1)


# ============================================================
#  mitmdump 管理
# ============================================================
_mitm_proc = None


def start_mitmdump():
    global _mitm_proc
    print_step("启动流量拦截")

    cmd = [
        "mitmdump",
        "--listen-port", str(PROXY_PORT),
        "--ssl-insecure",
        "-s", ADDON_FILE,
        "--set", f"token_file={TOKEN_FILE}",
        "--quiet",
    ]
    _mitm_proc = subprocess.Popen(
        cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1)
    if _mitm_proc.poll() is not None:
        print_err("mitmdump 启动失败")
        sys.exit(1)
    print_ok(f"mitmdump 已启动（PID: {_mitm_proc.pid}）")


def stop_mitmdump():
    global _mitm_proc
    if _mitm_proc and _mitm_proc.poll() is None:
        _mitm_proc.terminate()
        try:
            _mitm_proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            _mitm_proc.kill()
    _mitm_proc = None


# ============================================================
#  等待 Token
# ============================================================
def wait_for_token():
    print_step("等待捕获 Token")
    print()
    print(f"  {BOLD}现在请：{NC}")
    print("  1. 打开钉钉")
    print("  2. 退出并重新打开「场馆速约」应用，触发登录")
    print("  3. 脚本自动获取 Token后，会有一个成功提示音")
    print()
    print("  ⚠ 如果没有触发登录，请关闭「场馆速约」应用，重新进入！")
    print(f"  {YELLOW}脚本会自动检测到 Token，最多等待 4 分钟...{NC}")
    print()

    for i in range(1, TIMEOUT + 1):
        if os.path.exists(TOKEN_FILE) and os.path.getsize(TOKEN_FILE) > 0:
            return True
        mins, secs = divmod(i, 60)
        print(f"\r  等待中... {mins}:{secs:02d}", end="", flush=True)
        time.sleep(1)

    print()
    return False


# ============================================================
#  展示 Token
# ============================================================
def save_token():
    with open(TOKEN_FILE, "r") as f:
        token = f.read().strip()

    # 读完立即删除临时文件
    try:
        os.remove(TOKEN_FILE)
    except OSError:
        pass

    print()
    print(f"{GREEN}{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}")
    print(f"{GREEN}{BOLD}  ✓ Token 获取成功！{NC}")
    print(f"{GREEN}{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{NC}")
    print()
    print(f"  {BOLD}Token：{NC}")
    print(token)
    print()

    # 复制到剪切板
    copied = False
    if IS_MACOS:
        try:
            subprocess.run(["pbcopy"], input=token.encode(), check=True)
            copied = True
        except Exception:
            pass
    elif IS_WINDOWS:
        try:
            subprocess.run(["clip"], input=token.encode(), check=True)
            copied = True
        except Exception:
            pass

    if copied:
        print(f"  {GREEN}✓ 【已自动复制到剪切板】{NC}")
    print()

    # 提示音
    if IS_MACOS:
        subprocess.run(
            ["afplay", "/System/Library/Sounds/Glass.aiff"],
            check=False, capture_output=True
        )
    elif IS_WINDOWS:
        try:
            import winsound
            winsound.Beep(800, 300)
        except Exception:
            pass


# ============================================================
#  Windows 打包模式下暂停等待用户确认
# ============================================================
def _pause_if_needed():
    """双击 .exe 运行时，程序结束前等待用户按回车，防止窗口瞬间关闭"""
    if IS_WINDOWS and getattr(sys, "_MEIPASS", None):
        print()
        input("按回车键关闭窗口...")


# ============================================================
#  清理
# ============================================================
def cleanup(signum=None, frame=None):
    print()
    print_warn("中断，正在清理...")
    stop_mitmdump()
    restore_proxy()
    _pause_if_needed()
    sys.exit(1)


# ============================================================
#  主流程
# ============================================================
def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # PyInstaller --onefile 启动时需要解压依赖，可能有几秒延迟，提前告知用户
    if getattr(sys, "_MEIPASS", None):
        print("正在启动，请稍候...", flush=True)

    print()
    print(f"{CYAN}{BOLD}╔══════════════════════════════════╗{NC}")
    print(f"{CYAN}{BOLD}║   场地预约 Token 一键获取工具    ║{NC}")
    print(f"{CYAN}{BOLD}╚══════════════════════════════════╝{NC}")

    # 检查依赖
    print_step("检查依赖")
    if not shutil.which("mitmdump"):
        print_err("未找到 mitmdump，请先安装：")
        print("    pip install mitmproxy")
        _pause_if_needed()
        sys.exit(1)
    result = _run(["mitmdump", "--version"], check=False)
    version = result.stdout.strip().splitlines()[0] if result.stdout else "unknown"
    print_ok(f"mitmproxy 已安装：{version}")

    check_cert()
    set_proxy()

    try:
        start_mitmdump()

        if wait_for_token():
            stop_mitmdump()
            restore_proxy()
            save_token()
            _pause_if_needed()
        else:
            stop_mitmdump()
            restore_proxy()
            print()
            print_err("超时未捕获到 Token，请检查：")
            print("  1. 是否打开了「场馆速约」并触发了登录")
            print("  2. 证书是否已正确安装")
            _pause_if_needed()
            sys.exit(1)
    except Exception as e:
        stop_mitmdump()
        restore_proxy()
        print_err(f"异常退出：{e}")
        _pause_if_needed()
        sys.exit(1)


if __name__ == "__main__":
    main()
