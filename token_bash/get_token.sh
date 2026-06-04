#!/bin/bash

# ============================================================
#  get_token.sh  —  一键获取场地预约系统 Token
#  使用方式: bash get_token.sh
# ============================================================

set -e

PROXY_PORT=18888
TOKEN_FILE="$(dirname "$0")/token.txt"
ADDON_FILE="$(dirname "$0")/extractor.py"
CA_INSTALL_GUIDE="$(dirname "$0")/ca_install.md"
MITM_PID_FILE="/tmp/get_token_mitm.pid"

# 自动检测当前活跃网卡的 networksetup 服务名
get_active_interface() {
  local device
  device=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  [ -z "$device" ] && echo "Wi-Fi" && return
  networksetup -listallhardwareports | awk -v dev="$device" '
    /Hardware Port:/ { port = substr($0, index($0,$3)) }
    /Device: / && $2 == dev { print port }
  '
}

INTERFACE=$(get_active_interface)

# ---- 颜色 ----
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

# ---- 检查依赖 ----
check_deps() {
  print_step "检查依赖"
  if ! command -v mitmdump &>/dev/null; then
    print_err "未找到 mitmdump，请先安装 mitmproxy："
    echo "    pip install mitmproxy"
    exit 1
  fi
  print_ok "mitmproxy 已安装：$(mitmdump --version 2>&1 | head -1)"
}

# ---- 设置系统代理 ----
set_proxy() {
  print_step "设置系统网络代理 → 127.0.0.1:$PROXY_PORT"
  networksetup -setwebproxy "$INTERFACE" 127.0.0.1 $PROXY_PORT
  networksetup -setsecurewebproxy "$INTERFACE" 127.0.0.1 $PROXY_PORT
  networksetup -setwebproxystate "$INTERFACE" on
  networksetup -setsecurewebproxystate "$INTERFACE" on
  _proxy_enabled=1
  print_ok "代理已开启"
}

# ---- 恢复系统代理 ----
restore_proxy() {
  networksetup -setwebproxystate "$INTERFACE" off
  networksetup -setsecurewebproxystate "$INTERFACE" off
  _proxy_enabled=0
  print_ok "代理已关闭，网络恢复正常"
}

# ---- 启动 mitmdump ----
start_mitmdump() {
  print_step "启动流量拦截（后台运行）"
  # 清理上次残留
  rm -f "$TOKEN_FILE"
  mitmdump \
    --listen-port $PROXY_PORT \
    --ssl-insecure \
    -s "$ADDON_FILE" \
    --set "token_file=$TOKEN_FILE" \
    --quiet \
    &
  echo $! >"$MITM_PID_FILE"
  sleep 1
  print_ok "mitmdump 已启动（PID: $(cat $MITM_PID_FILE)）"
}

# ---- 停止 mitmdump ----
stop_mitmdump() {
  if [ -f "$MITM_PID_FILE" ]; then
    kill "$(cat $MITM_PID_FILE)" 2>/dev/null || true
    rm -f "$MITM_PID_FILE"
  fi
}

# ---- 检查证书 ----
check_cert() {
  print_step "检查 mitmproxy CA 证书"
  CERT_PATH="$HOME/.mitmproxy/mitmproxy-ca-cert.pem"
  if [ ! -f "$CERT_PATH" ]; then
    print_warn "未找到 mitmproxy 证书，首次使用需要安装证书"
    echo ""
    echo "  1. 脚本会先启动一次 mitmdump 来生成证书"
    echo "  2. 然后引导你安装证书到系统钥匙串"
    echo ""
    # 启动一次生成证书
    mitmdump --listen-port $PROXY_PORT --quiet &
    TEMP_PID=$!
    sleep 2
    kill $TEMP_PID 2>/dev/null
  fi

  if [ -f "$CERT_PATH" ]; then
    # 检查是否已经信任（用 security find-certificate 直接按名字查，避免 openssl 只解析首个证书的问题）
    TRUSTED=$(security find-certificate -a -c "mitmproxy" /Library/Keychains/System.keychain 2>/dev/null | grep -c "mitmproxy" || true)
    if [ "$TRUSTED" -eq 0 ]; then
      print_warn "证书未安装到系统钥匙串，正在安装..."
      sudo security add-trusted-cert -d -r trustRoot \
        -k /Library/Keychains/System.keychain "$CERT_PATH"
      print_ok "证书已安装并信任"
    else
      print_ok "mitmproxy 证书已信任"
    fi
  fi
}

# ---- 等待 token ----
wait_for_token() {
  print_step "等待捕获 Token"
  echo ""
  echo -e "  ${BOLD}现在请：${NC}"
  echo "  1. 打开钉钉"
  echo "  2. 如果已经打开了「场馆速约」应用，请先关闭！"
  echo "  3. （重新）打开「场馆速约」应用，触发登录"
  echo ""
  echo "  ⚠ 如果没有触发登录，请关闭「场馆速约」应用，重新进入！"
  echo -e "  ${YELLOW}脚本会自动检测到 Token，最多等待 4 分钟...${NC}"
  echo ""

  for i in $(seq 1 240); do
    if [ -f "$TOKEN_FILE" ] && [ -s "$TOKEN_FILE" ]; then
      return 0
    fi
    printf "\r  等待中... %d:%02d" $((i / 60)) $((i % 60))
    sleep 1
  done

  echo ""
  return 1
}

# ---- 保存 token ----
save_token() {
  TOKEN=$(cat "$TOKEN_FILE")

  echo ""
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}${BOLD}  ✓ Token 获取成功！${NC}"
  echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${BOLD}Token：${NC}"
  echo "$TOKEN"
  echo ""
  echo -e "  ${BOLD}保存至：${NC}$TOKEN_FILE"

  # 复制到剪切板
  if command -v pbcopy &>/dev/null; then
    echo "$TOKEN" | pbcopy
    echo -e "  ${GREEN}✓ 【已自动复制到剪切板】${NC}"
  fi

  echo ""
  # 提示音
  afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
}

# ---- 清理函数（任何退出路径都触发）----
_proxy_enabled=0  # 标记代理是否已开启，避免未开启时打印误导信息

cleanup() {
  echo ""
  print_warn "中断，正在清理..."
  stop_mitmdump
  [ "$_proxy_enabled" -eq 1 ] && restore_proxy
  exit 1
}

exit_cleanup() {
  # EXIT trap：脚本正常结束时不需要额外操作（主流程已手动 restore），
  # 但若因 set -e 异常退出且代理已开，则补救恢复
  if [ "$_proxy_enabled" -eq 1 ]; then
    stop_mitmdump
    restore_proxy
  fi
}

trap cleanup INT TERM
trap exit_cleanup EXIT

# ============================================================
#  主流程
# ============================================================
echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   场地预约 Token 一键获取工具    ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════╝${NC}"

check_deps
check_cert
set_proxy
start_mitmdump

if wait_for_token; then
  stop_mitmdump
  restore_proxy
  save_token
else
  stop_mitmdump
  restore_proxy
  echo ""
  print_err "超时未捕获到 Token，请检查："
  echo "  1. 是否打开了「场馆速约」并点击了功能"
  echo "  2. 证书是否已正确安装（运行 bash get_token.sh 重试）"
  exit 1
fi
