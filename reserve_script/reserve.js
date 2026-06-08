#!/usr/bin/env node
/**
 * 羽毛球场地本地抢场脚本
 * 使用方式: node reserve.js
 * 要求: Node.js 18+（使用内置 fetch）
 */

const fs = require('fs');
const path = require('path');

// ─── 常量 ──────────────────────────────────────────────────────────────────

const BASE_URL = 'https://sportmeta.hdu.edu.cn/book/client';
const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK';

const VENUE_NAME = '综合馆羽毛球';
const VENUE_TYPE = 'badminton';
const RETRY_DELAYS_MS = [500, 1000];

const TIME_INDEX = {
  '08:00': 0, '09:00': 1, '10:00': 2, '11:00': 3,
  '11:40': 4, '13:20': 5, '14:00': 6, '15:00': 7,
  '16:00': 8, '17:00': 9, '18:00': 10, '19:00': 11,
  '20:00': 12, '21:00': 13,
};

const INDEX_TO_TIME = Object.fromEntries(
  Object.entries(TIME_INDEX).map(([t, i]) => [i, t]),
);

// ─── 终端颜色 ──────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg) { console.log(msg); }
function logInfo(msg) { console.log(`${CYAN}[INFO]${NC} ${msg}`); }
function logOk(msg) { console.log(`${GREEN}[OK]${NC} ${msg}`); }
function logWarn(msg) { console.log(`${YELLOW}[WARN]${NC} ${msg}`); }
function logErr(msg) { console.log(`${RED}[ERROR]${NC} ${msg}`); }

// ─── helpers ───────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildHeaders(token, withOrigin = true) {
  const h = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: '*/*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'User-Agent': USER_AGENT,
    Referer: 'https://sportmeta.hdu.edu.cn/book/dingtalk/',
    'DingTalk-Flag': '1',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };
  if (withOrigin) h['Origin'] = 'https://sportmeta.hdu.edu.cn';
  return h;
}

async function post(path, token, body) {
  const url = `${BASE_URL}${path}`;
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      logWarn(`${path} 第 ${attempt} 次重试（等待 ${delay}ms）...`);
      await sleep(delay);
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(token, body !== null),
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    // 只重试 502
    if (res.status === 502) {
      lastError = new Error(`HTTP 502 on ${path}`);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}: ${text}`);

    const data = JSON.parse(text);
    if (data?.status === 'error') {
      throw new Error(`业务错误: ${data.message ?? '未知'} on ${path}`);
    }
    return data;
  }
  throw lastError;
}

function resolveTimeList(start, end) {
  const s = TIME_INDEX[start];
  const e = TIME_INDEX[end];
  if (s === undefined) throw new Error(`无效的开始时间: ${start}`);
  if (e === undefined) throw new Error(`无效的结束时间: ${end}`);
  if (e <= s) throw new Error(`结束时间 ${end} 必须晚于开始时间 ${start}`);
  return Array.from({ length: e - s }, (_, i) => s + i);
}

// ─── 时间同步 ──────────────────────────────────────────────────────────────

async function syncServerTime(token) {
  const offsets = [];
  for (let i = 0; i < 3; i++) {
    const before = Date.now();
    const data = await post('/post_server_time', token, null);
    const after = Date.now();
    offsets.push(data.data - Math.floor((before + after) / 2));
  }
  offsets.sort((a, b) => a - b);
  const offset = offsets[Math.floor(offsets.length / 2)];
  logInfo(`服务器时间同步完成，offset: ${offset >= 0 ? '+' : ''}${offset}ms`);
  return offset;
}

function msUntilOpen(offset) {
  const serverNow = Date.now() + offset;
  const d = new Date(serverNow);
  const open = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20, 0, 0, 0).getTime();
  return open - serverNow;
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function waitUntilOpen(offset) {
  let remaining = msUntilOpen(offset);
  if (remaining <= 0) {
    logInfo('当前已过 20:00，直接执行');
    return;
  }
  logInfo(`距离 20:00:00 还有 ${formatMs(remaining)}，等待中...`);

  while (remaining > 5000) {
    await sleep(5000);
    remaining = msUntilOpen(offset);
    process.stdout.write(`\r  ⏳ 还有 ${formatMs(remaining)}   `);
  }
  if (remaining > 0) await sleep(remaining);
  process.stdout.write('\r                              \r');
  logOk('20:00 到达，开始抢场！');
}

// ─── 预约核心 ──────────────────────────────────────────────────────────────

async function trySite(token, orderData, siteId) {
  try {
    const checkRes = await post('/creat_book_info', token, { orderData });
    const available = checkRes.available_times ?? [];
    const conflicts = checkRes.conflict_times ?? [];

    if (available.length === 0) {
      const reason = conflicts.length > 0
        ? `冲突时段: ${conflicts.join(', ')}`
        : (checkRes.message ?? '无可用时段');
      logInfo(`  场地 ${siteId} 不可用 — ${reason}`);
      return null;
    }

    let finalOrderData = orderData;

    // 部分时段可用
    if (conflicts.length > 0) {
      const sorted = [...available].sort((a, b) => a - b);
      const partialStart = INDEX_TO_TIME[sorted[0]];
      const partialEnd = INDEX_TO_TIME[sorted[sorted.length - 1] + 1];
      if (!partialStart || !partialEnd) {
        logWarn(`  场地 ${siteId} 部分可用但时段索引无法解析，跳过`);
        return null;
      }
      finalOrderData = {
        ...finalOrderData,
        time_list: sorted,
        start_time: partialStart,
        end_time: partialEnd,
      };
      logInfo(`  场地 ${siteId} 部分可用（${partialStart}-${partialEnd}），正在确认预约...`);
    } else {
      logOk(`  场地 ${siteId} 可用！正在确认预约...`);
    }

    const orderRes = await post('/creat_order', token, { orderData: finalOrderData });
    return orderRes.data ?? orderRes;
  } catch (e) {
    logErr(`  场地 ${siteId} 异常: ${e.message}`);
    return null;
  }
}

async function tryTimeSlot(token, config, slot, sites) {
  const { date, openid, nickname, phone } = config;
  const { start_time, end_time } = slot;
  const time_list = resolveTimeList(start_time, end_time);

  logInfo(`尝试时间段 ${start_time}-${end_time}，共 ${sites.length} 个场地...`);

  for (const siteId of sites) {
    const orderData = {
      openid, nickname, phone, date,
      venue_name: VENUE_NAME,
      venue_type: VENUE_TYPE,
      site_id: siteId,
      total_price: 0,
      time_list,
      start_time,
      end_time,
    };

    const result = await trySite(token, orderData, siteId);
    if (result) return result;
  }

  return null;
}

// ─── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
  log('');
  log(`${CYAN}${BOLD}╔══════════════════════════════════╗${NC}`);
  log(`${CYAN}${BOLD}║   羽毛球场地 本地抢场脚本       ║${NC}`);
  log(`${CYAN}${BOLD}╚══════════════════════════════════╝${NC}`);
  log('');

  // 读取配置
  const configPath = path.join(__dirname, 'config.json');
  if (!fs.existsSync(configPath)) {
    logErr(`未找到配置文件: ${configPath}`);
    logErr('请复制 config.json 并填写你的预约信息');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { token, date, openid, nickname, phone, preferred_time_slots, sites } = config;

  // 校验必填字段
  if (!token || !date || !openid || !nickname || !phone) {
    logErr('config.json 缺少必填字段（token/date/openid/nickname/phone）');
    process.exit(1);
  }
  if (!preferred_time_slots || !preferred_time_slots.length) {
    logErr('config.json 缺少 preferred_time_slots');
    process.exit(1);
  }
  if (!sites || !sites.length) {
    logErr('config.json 缺少 sites');
    process.exit(1);
  }

  logOk('配置读取完成');
  logInfo(`用户: ${nickname} | 日期: ${date}`);
  logInfo(`时间段: ${preferred_time_slots.map(s => `${s.start_time}-${s.end_time}`).join(' → ')}`);
  logInfo(`场地优先级: [${sites.join(', ')}]`);
  log('');

  // 同步时间
  const offset = await syncServerTime(token);

  // 等待 20:00
  await waitUntilOpen(offset);
  log('');

  // 开始抢场
  logInfo('=== 开始抢场 ===');

  for (let i = 0; i < preferred_time_slots.length; i++) {
    const slot = preferred_time_slots[i];
    const result = await tryTimeSlot(token, config, slot, sites);

    if (result) {
      log('');
      log(`${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
      log(`${GREEN}${BOLD}  ✓ 预约成功！${NC}`);
      log(`${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}`);
      log('');
      log(`  订单号: ${result.order_num}`);
      log(`  场地: ${result.venue_name} ${result.site_id}号`);
      log(`  时间: ${result.order_date} ${result.start_time}-${result.end_time}`);
      log('');
      process.exit(0);
    }

    if (i < preferred_time_slots.length - 1) {
      logWarn(`时间段 ${slot.start_time}-${slot.end_time} 全部场地不可用，1.5s 后尝试备选...`);
      await sleep(1500);
    }
  }

  log('');
  logErr('所有时间段均已被占满，抢场失败。');
  process.exit(1);
}

main().catch(e => {
  logErr(`脚本异常: ${e.message}`);
  process.exit(1);
});
