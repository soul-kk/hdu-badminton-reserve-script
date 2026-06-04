#!/bin/bash
# ============================================================
#  install_and_run.command — macOS 双击即可运行
#  自动检测并安装 Python3 + mitmproxy，然后执行 get_token.py
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GET_TOKEN="$SCRIPT_DIR/get_token.py"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}${BOLD}▶ $1${NC}"; }
print_ok() { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err() { echo -e "${RED}✗ $1${NC}"; }

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   Token 获取工具 — 环境自动配置     ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"

# ---- 检查 Python3 ----
print_step "检查 Python3"
if command -v python3 &>/dev/null; then
  PYTHON=python3
  print_ok "Python3 已安装：$(python3 --version)"
else
  print_warn "未找到 Python3，正在安装 Xcode Command Line Tools..."
  echo "  （弹出窗口后请点击「安装」，等待完成）"
  xcode-select --install 2>/dev/null || true
  # 等待安装完成
  echo -e "  ${YELLOW}等待安装完成后按回车继续...${NC}"
  read -r
  if command -v python3 &>/dev/null; then
    PYTHON=python3
    print_ok "Python3 已安装：$(python3 --version)"
  else
    print_err "Python3 安装失败，请手动安装后重试"
    echo "  下载地址: https://www.python.org/downloads/"
    echo ""
    echo "按回车退出..."
    read -r
    exit 1
  fi
fi

# ---- 检查 pip ----
print_step "检查 pip"
if ! $PYTHON -m pip --version &>/dev/null; then
  print_warn "pip 未找到，正在安装..."
  $PYTHON -m ensurepip --upgrade 2>/dev/null || true
fi
print_ok "pip 可用"

# ---- 检查 mitmproxy ----
print_step "检查 mitmproxy"
if ! command -v mitmdump &>/dev/null; then
  print_warn "mitmproxy 未安装，正在安装（可能需要 1-2 分钟）..."
  $PYTHON -m pip install mitmproxy --quiet --break-system-packages 2>/dev/null \
    || $PYTHON -m pip install mitmproxy --quiet
  if command -v mitmdump &>/dev/null; then
    print_ok "mitmproxy 安装成功"
  else
    # pip 安装的路径可能不在 PATH 中
    export PATH="$PATH:$HOME/Library/Python/$(python3 -c 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")')/bin"
    if command -v mitmdump &>/dev/null; then
      print_ok "mitmproxy 安装成功"
    else
      print_err "mitmproxy 安装失败，请手动运行: pip install mitmproxy"
      echo ""
      echo "按回车退出..."
      read -r
      exit 1
    fi
  fi
else
  print_ok "mitmproxy 已安装"
fi

# ---- 运行主脚本 ----
print_step "启动 Token 获取工具"
echo ""
$PYTHON "$GET_TOKEN"

# 保持终端窗口打开
echo ""
echo "按回车关闭窗口..."
read -r
