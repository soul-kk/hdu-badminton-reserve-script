"""
extractor.py — mitmproxy addon
拦截 sportmeta.hdu.edu.cn 的响应，提取登录返回的新 token
"""

import os
from mitmproxy import http, ctx


TARGET_HOST = "sportmeta.hdu.edu.cn"


class TokenExtractor:
    def __init__(self):
        self.token_file: str = ""
        self.captured = False

    def load(self, loader):
        loader.add_option(
            name="token_file",
            typespec=str,
            default="token.txt",
            help="Path to write the captured token",
        )

    def running(self):
        self.token_file = ctx.options.token_file

    def response(self, flow: http.HTTPFlow):
        """只从登录响应 body 里提取新 token，不碰请求头里的旧 token"""
        if self.captured:
            return
        if TARGET_HOST not in flow.request.pretty_host:
            return

        try:
            content_type = flow.response.headers.get("content-type", "")
            if "json" not in content_type:
                return
            import json
            body = json.loads(flow.response.text)
            token = (
                body.get("token")
                or body.get("accessToken")
                or body.get("access_token")
                or body.get("data", {}).get("token")
                or body.get("data", {}).get("accessToken")
            )
            if token:
                self._write_token(token)
        except Exception:
            pass

    def _write_token(self, token: str):
        if self.captured:
            return
        self.captured = True
        try:
            os.makedirs(os.path.dirname(os.path.abspath(self.token_file)), exist_ok=True)
            with open(self.token_file, "w") as f:
                f.write(token.strip())
            ctx.log.info(f"[extractor] Token 已写入: {self.token_file}")
        except Exception as e:
            ctx.log.error(f"[extractor] 写入失败: {e}")


addons = [TokenExtractor()]
