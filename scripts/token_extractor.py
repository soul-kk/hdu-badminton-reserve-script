"""
mitmproxy addon: 记录所有请求，自动从目标域名提取 JWT Token 写入 .env
手动监听命令：  mitmdump --listen-port 8888 -s scripts/token_extractor.py
"""

import os
from datetime import datetime
from mitmproxy import http

TARGET_HOST = "sportmeta.hdu.edu.cn"
ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))

_last_token: str = ""


def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def request(flow: http.HTTPFlow) -> None:
    global _last_token

    host = flow.request.pretty_host
    method = flow.request.method
    path = flow.request.path

    # 所有请求都记录一行
    print(f"[{_ts()}] {method} {host}{path}", flush=True)

    # 非目标域名不做 token 处理
    if host != TARGET_HOST:
        return

    auth = flow.request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return

    token = auth[len("Bearer "):]

    if token == _last_token:
        print(
            f"[{_ts()}] ★ TOKEN (已是最新，未更新 .env)\n"
            f"  {'=' * 60}\n"
            f"  {token}\n"
            f"  {'=' * 60}",
            flush=True,
        )
        return

    _last_token = token
    _write_token(token)


def _write_token(token: str) -> None:
    try:
        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.write(f"token = {token}\n")
        print(
            f"\n[{_ts()}] {'#' * 64}\n"
            f"  ★★★  NEW TOKEN CAPTURED  ★★★\n"
            f"  已写入 {ENV_PATH}\n"
            f"  {'#' * 64}\n"
            f"  {token}\n"
            f"  {'#' * 64}\n",
            flush=True,
        )
    except Exception as e:
        print(f"[{_ts()}] [ERROR] 写入 .env 失败: {e}", flush=True)
