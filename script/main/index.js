// 入口文件

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

import { logger } from "./logger.js";
import { syncServerTime, waitUntilOpen } from "./timer.js";
import { reserve } from "./reserve.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  const cfg = loadConfig();

  const { token } = cfg;
  if (!token) {
    logger.error("config.json 中未找到 token");
    process.exit(1);
  }

  const nowMode = process.argv.includes("--now");

  logger.info("读取配置完成");
  logger.info(`目标日期: ${cfg.date}`);
  logger.info(
    `时间段优先级: ${cfg.preferred_time_slots
      .map(s => `${s.start_time}-${s.end_time}`)
      .join(" → ")}`,
  );

  // 时间同步
  const offset = await syncServerTime(token);

  if (!nowMode) {
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
