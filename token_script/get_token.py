#!/usr/bin/env python3
"""
get_token.py — 跨平台一键获取场地预约系统 Token
支持 macOS / Windows
使用方式: python get_token.py
"""

import atexit
import argparse
import json
import os
import sys
import time
import signal
import tempfile
import subprocess
import multiprocessing
import platform
from datetime import datetime, timedelta, timezone

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
BEIJING_TZ = timezone(timedelta(hours=8), name="Asia/Shanghai")

PROJECT_ROOT = os.path.abspath(os.environ.get("BADMINTON_REPO_ROOT") or (
    os.getcwd() if getattr(sys, "_MEIPASS", None)
    else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
))
CAPTURE_RECORD = os.path.join(PROJECT_ROOT, ".badminton-reserve", "token-capture.json")

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


def parse_args():
    parser = argparse.ArgumentParser(description="获取场馆速约 Token")
    parser.add_argument(
        "--test",
        action="store_true",
        help="仅用于用户明确要求的流程测试，允许北京时间 15:00 前抓取",
    )
    return parser.parse_args()


def enforce_capture_time(test_mode):
    now = datetime.now(BEIJING_TZ)
    if not test_mode and now.hour < 15:
        print_err("正式预约禁止在北京时间 15:00 前抓取 Token")
        print("  请等待到今天北京时间 15:00 后重试；仅流程测试可使用 --test。")
        sys.exit(1)


def write_capture_record(test_mode):
    os.makedirs(os.path.dirname(CAPTURE_RECORD), mode=0o700, exist_ok=True)
    record = {
        "version": 1,
        "capturedAt": datetime.now(BEIJING_TZ).isoformat(),
        "mode": "test" if test_mode else "formal",
    }
    temp_path = f"{CAPTURE_RECORD}.{os.getpid()}.tmp"
    with open(temp_path, "w", encoding="utf-8") as file:
        json.dump(record, file, ensure_ascii=False, indent=2)
        file.write("\n")
    os.chmod(temp_path, 0o600)
    os.replace(temp_path, CAPTURE_RECORD)
    os.chmod(CAPTURE_RECORD, 0o600)


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
        proc = multiprocessing.Process(
            target=_mitmdump_cert_gen_worker,
            args=(PROXY_PORT,),
            daemon=True,
        )
        proc.start()
        time.sleep(2)
        proc.terminate()
        proc.join()

    if not os.path.exists(cert_path):
        print_err("证书生成失败，请手动运行一次 mitmdump")
        sys.exit(1)

    if IS_MACOS:
        _install_cert_mac(cert_path)
    elif IS_WINDOWS:
        _install_cert_win(cert_path)


def _install_cert_mac(cert_path):
    # 检查证书是否已被信任（不仅仅是存在）
    verify_result = _run(
        ["security", "verify-cert", "-c", cert_path],
        check=False
    )
    if verify_result.returncode == 0:
        print_ok("mitmproxy 证书已信任")
    else:
        print_warn("证书未信任，正在安装到系统钥匙串（需要输入系统密码）...")
        _run(["sudo", "security", "add-trusted-cert", "-d", "-r", "trustRoot",
              "-k", "/Library/Keychains/System.keychain", cert_path])
        print_ok("证书已安装并信任")


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
#  mitmproxy 进程工作函数（必须在模块顶层，multiprocessing 序列化需要）
# ============================================================

def _mitmdump_worker(listen_port, addon_file, token_file):
    """在独立子进程中通过 Python API 启动 mitmproxy，无需外部 mitmdump 命令"""
    from mitmproxy.tools.main import mitmdump
    mitmdump([
        "--listen-port", str(listen_port),
        "--ssl-insecure",
        "-s", addon_file,
        "--set", f"token_file={token_file}",
        "--quiet",
    ])


def _mitmdump_cert_gen_worker(listen_port):
    """启动 mitmproxy 片刻以生成 CA 证书，完成后由外部 terminate()"""
    from mitmproxy.tools.main import mitmdump
    mitmdump(["--listen-port", str(listen_port), "--quiet"])


# ============================================================
#  mitmdump 管理
# ============================================================
_mitm_proc = None


def start_mitmdump():
    global _mitm_proc
    print_step("启动流量拦截")

    _mitm_proc = multiprocessing.Process(
        target=_mitmdump_worker,
        args=(PROXY_PORT, ADDON_FILE, TOKEN_FILE),
        daemon=True,
    )
    _mitm_proc.start()
    time.sleep(2)
    if not _mitm_proc.is_alive():
        print_err("mitmdump 启动失败")
        sys.exit(1)
    print_ok(f"mitmdump 已启动（PID: {_mitm_proc.pid}）")


def stop_mitmdump():
    global _mitm_proc
    if _mitm_proc and _mitm_proc.is_alive():
        _mitm_proc.terminate()
        _mitm_proc.join(timeout=5)
        if _mitm_proc.is_alive():
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
def save_token(test_mode=False):
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
    write_capture_record(test_mode)
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


# atexit 兜底：覆盖 sys.exit() / 未捕获异常等所有正常退出路径
atexit.register(restore_proxy)
atexit.register(stop_mitmdump)

# Windows：点击窗口 X / 注销 / 关机时发送 CTRL_CLOSE_EVENT，
# 不经过 Python signal handler，必须通过 SetConsoleCtrlHandler 注册。
# 必须保持模块级引用，防止被 GC 回收导致回调失效。
_win_ctrl_handler = None

if IS_WINDOWS:
    import ctypes
    import ctypes.wintypes

    _CTRL_CLOSE_EVENT    = 2
    _CTRL_LOGOFF_EVENT   = 5
    _CTRL_SHUTDOWN_EVENT = 6

    @ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.DWORD)
    def _win_ctrl_handler(ctrl_type):
        if ctrl_type in (_CTRL_CLOSE_EVENT, _CTRL_LOGOFF_EVENT, _CTRL_SHUTDOWN_EVENT):
            stop_mitmdump()
            restore_proxy()
        return False  # 返回 False 让系统继续执行默认关闭流程

    ctypes.windll.kernel32.SetConsoleCtrlHandler(_win_ctrl_handler, True)


# ============================================================
#  主流程
# ============================================================
def main(test_mode=False):
    enforce_capture_time(test_mode)
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    # macOS：关闭终端窗口发送 SIGHUP，需单独注册（Windows 无此信号）
    if IS_MACOS:
        signal.signal(signal.SIGHUP, cleanup)

    # PyInstaller --onefile 启动时需要解压依赖，可能有几秒延迟，提前告知用户
    if getattr(sys, "_MEIPASS", None):
        print("正在启动，请稍候...", flush=True)

    print()
    print(f"{CYAN}{BOLD}╔══════════════════════════════════╗{NC}")
    print(f"{CYAN}{BOLD}║   场地预约 Token 一键获取工具    ║{NC}")
    print(f"{CYAN}{BOLD}╚══════════════════════════════════╝{NC}")

    # 检查依赖
    print_step("检查依赖")
    try:
        import mitmproxy  # noqa: F401
        import mitmproxy.tools.main  # noqa: F401
        import mitmproxy as _mitm
        version = getattr(_mitm, "__version__", "unknown")
        print_ok(f"mitmproxy 已就绪：{version}")
    except ImportError as e:
        if getattr(sys, "_MEIPASS", None):
            print_err(f"内置依赖加载失败（打包问题）：{e}")
            print_err("请联系开发者重新构建此工具")
        else:
            print_err("未找到 mitmproxy，请先安装：")
            print("    pip install mitmproxy")
        _pause_if_needed()
        sys.exit(1)

    check_cert()
    set_proxy()

    try:
        start_mitmdump()

        if wait_for_token():
            stop_mitmdump()
            restore_proxy()
            save_token(test_mode)
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
    multiprocessing.freeze_support()  # PyInstaller + Windows multiprocessing 必须
    args = parse_args()
    main(args.test)
