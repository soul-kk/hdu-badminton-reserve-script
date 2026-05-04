import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // 限制文件追踪范围为 web/ 目录，防止 Turbopack 扫描整个家目录
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
