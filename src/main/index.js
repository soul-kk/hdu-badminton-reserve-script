// 入口文件

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { logger } from "./logger.js";
import { syncServerTime, waitUntilOpen } from "./timer.js";
import { reserve } from "./reserve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 加载 .env
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, "../../.env"), "utf-8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^\s*(\w+)\s*=\s*(.+)\s*$/);
      if (match) {
        process.env[match[1]] = match[2].trim();
      }
    }
  } catch {
    logger.error(".env 文件不存在或无法读取");
    process.exit(1);
  }
}

// 加载 config.json
function loadConfig() {
  try {
    const raw = readFileSync(resolve(__dirname, "../../config.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    logger.error("config.json 文件不存在或格式错误");
    process.exit(1);
  }
}

async function main() {
  loadEnv();
  const token = process.env.token;
  if (!token) {
    logger.error(".env 中未找到 token");
    process.exit(1);
  }

  const cfg = loadConfig();
  const nowMode = process.argv.includes("--now");

  logger.info("读取配置完成");
  logger.info(`目标日期: ${cfg.date}`);
  logger.info(
    `时间段优先级: ${cfg.preferred_time_slots
      .map(s => `${s.start_time}-${s.end_time}`)
      .join(" → ")}`,
  );
  logger.info(`备选场地: ${cfg.preferred_sites.join(", ")} 号`);

  // 时间同步
  const offset = await syncServerTime(token);

  if (!nowMode) {
    // 倒计时等待 20:00
    await waitUntilOpen(offset);
  } else {
    logger.info("--now 模式，立即执行");
  }

  logger.info("=== 开始抢场 ===");
  await reserve(token, cfg);
}

main().catch(e => {
  logger.error(`未捕获异常: ${e.message}`);
  process.exit(1);
});
