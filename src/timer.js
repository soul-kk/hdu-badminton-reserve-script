// 时间同步与倒计时

import { getServerTime } from './api.js';
import { logger } from './logger.js';

// 调用 N 次 post_server_time，取中位数计算本地与服务器的时间差
export async function syncServerTime(token, times = 3) {
  const offsets = [];
  for (let i = 0; i < times; i++) {
    const localBefore = Date.now();
    const serverTs = await getServerTime(token);
    const localAfter = Date.now();
    // 用请求中点作为本地参考时刻，减少网络单程延迟误差
    const localMid = Math.floor((localBefore + localAfter) / 2);
    offsets.push(serverTs - localMid);
  }
  offsets.sort((a, b) => a - b);
  const offset = offsets[Math.floor(offsets.length / 2)];
  logger.info(`服务器时间同步完成，offset: ${offset >= 0 ? '+' : ''}${offset}ms`);
  return offset;
}

// 返回当前修正后的服务器时间戳（毫秒）
export function now(offset) {
  return Date.now() + offset;
}

// 计算距离今天 20:00:00.000 的毫秒数（基于服务器时间）
export function msUntilOpen(offset) {
  const serverNow = now(offset);
  const d = new Date(serverNow);
  // 构造今天 20:00:00.000 的时间戳
  const open = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0, 0).getTime();
  return open - serverNow;
}

// 等待至 20:00:00，期间每秒打印倒计时
export async function waitUntilOpen(offset) {
  const ms = msUntilOpen(offset);

  if (ms <= 0) {
    logger.info('当前已过 20:00，直接执行。');
    return;
  }

  logger.info(`距离 20:00:00 还有 ${formatMs(ms)}，等待中...`);

  // 每秒刷新一次倒计时（最后 5s 停止刷新，减少干扰）
  let remaining = ms;
  while (remaining > 5000) {
    await sleep(1000);
    remaining = msUntilOpen(offset);
    process.stdout.write(`\r  ⏳ 还有 ${formatMs(remaining)}   `);
  }
  process.stdout.write('\n');

  // 最后 5s 精确等待
  const finalWait = msUntilOpen(offset);
  if (finalWait > 0) {
    await sleep(finalWait);
  }
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
