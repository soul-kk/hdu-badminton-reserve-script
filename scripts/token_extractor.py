"""
mitmproxy addon: 自动从钉钉请求中提取 JWT Token，写入 .env
"""

import os
import re
from datetime import datetime
from mitmproxy import http

TARGET_HOST = "sportmeta.hdu.edu.cn"
ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
ENV_PATH = os.path.abspath(ENV_PATH)

_last_token: str = ""


def request(flow: http.HTTPFlow) -> None:
    global _last_token

    if flow.request.pretty_host != TARGET_HOST:
        return

    auth = flow.request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return

    token = auth[len("Bearer "):]
    if token == _last_token:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] token 已经是最新：{token}", flush=True)
        return

    _last_token = token
    _write_token(token)


def _write_token(token: str) -> None:
    try:
        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.write(f"token = {token}\n")
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] Token 已更新 -> {ENV_PATH}\n  token = {token}", flush=True)
    except Exception as e:
        print(f"[ERROR] 写入 .env 失败: {e}", flush=True)
