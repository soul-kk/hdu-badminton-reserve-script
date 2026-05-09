// 抢场引擎 — 移植自 script/main/，适配 web 任务系统
// 通过 addLog 写入任务日志，通过 AbortSignal 支持取消

import { addLog, getTask, updateStatus } from "./task-manager";

const BASE_URL = "https://sportmeta.hdu.edu.cn/book/client";
const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK";

const VENUE_NAME = "综合馆羽毛球";
const VENUE_TYPE = "badminton";
const PREFERRED_SITES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const RETRY_STATUS = new Set([502, 403]);
const RETRY_DELAYS_MS = [500, 1000];
const SITE_STAGGER_MS = 50; // 每个场地请求错开 50ms，避免同时爆发触发限流

const TIME_INDEX: Record<string, number> = {
  "08:00": 0,
  "09:00": 1,
  "10:00": 2,
  "11:00": 3,
  "11:40": 4,
  "13:20": 5,
  "14:00": 6,
  "15:00": 7,
  "16:00": 8,
  "17:00": 9,
  "18:00": 10,
  "19:00": 11,
  "20:00": 12,
  "21:00": 13,
};

// reverse map: index → time string (e.g. 11 → "19:00")
const INDEX_TO_TIME: Record<number, string> = Object.fromEntries(
  Object.entries(TIME_INDEX).map(([t, i]) => [i, t]),
);

// ─── helpers ────────────────────────────────────────────────────────────────

function buildHeaders(token: string, withOrigin = true) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh-Hans;q=0.9",
    "User-Agent": USER_AGENT,
    Referer: "https://sportmeta.hdu.edu.cn/book/dingtalk/",
    "DingTalk-Flag": "1",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
  };
  if (withOrigin) h["Origin"] = "https://sportmeta.hdu.edu.cn";
  return h;
}

async function post(
  path: string,
  token: string,
  body: object | null,
  signal: AbortSignal,
  taskId: string,
) {
  const url = `${BASE_URL}${path}`;
  // addLog(taskId, 'api', `→ POST ${path}  ${body ? JSON.stringify(body) : ''}`);

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (signal.aborted) throw new Error("任务已取消");
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      addLog(
        taskId,
        "warn",
        `${path} 第 ${attempt} 次重试（等待 ${delay}ms）...`,
      );
      await sleep(delay, signal);
    }

    const res = await fetch(url, {
      method: "POST",
      headers: buildHeaders(token, body !== null),
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });

    const text = await res.text();
    // addLog(taskId, 'api', `← ${res.status}  ${text.slice(0, 200)}`);

    if (RETRY_STATUS.has(res.status)) {
      lastError = new Error(`HTTP ${res.status} on ${path}`);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);

    const data = JSON.parse(text);
    if (data?.status === "error")
      throw new Error(`业务错误: ${data.message ?? "未知"} on ${path}`);
    return data;
  }
  throw lastError!;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("任务已取消"));
      return;
    }
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("任务已取消"));
    };
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function resolveTimeList(start: string, end: string) {
  const s = TIME_INDEX[start];
  const e = TIME_INDEX[end];
  if (s === undefined) throw new Error(`无效的开始时间: ${start}`);
  if (e === undefined) throw new Error(`无效的结束时间: ${end}`);
  if (e <= s) throw new Error(`结束时间 ${end} 必须晚于开始时间 ${start}`);
  return Array.from({ length: e - s }, (_, i) => s + i);
}

// ─── time sync ──────────────────────────────────────────────────────────────

async function syncServerTime(
  token: string,
  signal: AbortSignal,
  taskId: string,
) {
  const offsets: number[] = [];
  for (let i = 0; i < 3; i++) {
    const before = Date.now();
    const data = await post("/post_server_time", token, null, signal, taskId);
    const after = Date.now();
    offsets.push((data.data as number) - Math.floor((before + after) / 2));
  }
  offsets.sort((a, b) => a - b);
  const offset = offsets[Math.floor(offsets.length / 2)];
  addLog(
    taskId,
    "info",
    `服务器时间同步完成，offset: ${offset >= 0 ? "+" : ""}${offset}ms`,
  );
  return offset;
}

function msUntilOpen(offset: number) {
  const serverNow = Date.now() + offset;
  const d = new Date(serverNow);
  const open = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    20,
    0,
    0,
    0,
  ).getTime();
  return open - serverNow;
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

async function waitUntilOpen(
  offset: number,
  signal: AbortSignal,
  taskId: string,
) {
  const ms = msUntilOpen(offset);
  if (ms <= 0) {
    addLog(taskId, "info", "当前已过 20:00，直接执行");
    return;
  }
  addLog(taskId, "info", `距离 20:00:00 还有 ${formatMs(ms)}，等待中...`);

  // 每 5s 写一条倒计时日志（前端轮询间隔 1s，5s 够用）
  let remaining = msUntilOpen(offset);
  while (remaining > 5000) {
    await sleep(5000, signal);
    remaining = msUntilOpen(offset);
    addLog(taskId, "info", `⏳ 还有 ${formatMs(remaining)}`);
  }
  if (remaining > 0) await sleep(remaining, signal);
}

// ─── reserve core ───────────────────────────────────────────────────────────

async function tryTimeSlot(
  token: string,
  cfg: { date: string; openid: string; nickname: string; phone: string },
  slot: { start_time: string; end_time: string },
  signal: AbortSignal,
  taskId: string,
) {
  const { date, openid, nickname, phone } = cfg;
  const { start_time, end_time } = slot;
  const time_list = resolveTimeList(start_time, end_time);

  addLog(
    taskId,
    "info",
    `尝试时间段 ${start_time}-${end_time}（time_list: [${time_list}]），并发请求 ${PREFERRED_SITES.length} 个场地...`,
  );

  function buildOrderData(site_id: number) {
    return {
      openid,
      nickname,
      phone,
      date,
      venue_name: VENUE_NAME,
      venue_type: VENUE_TYPE,
      site_id,
      total_price: 0,
      time_list,
      start_time,
      end_time,
    };
  }

  return new Promise<object | null>(resolve => {
    let pending = PREFERRED_SITES.length;
    let resolved = false;
    let won = false;

    function finish(result: object | null) {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }
    function checkPending() {
      if (pending <= 0 && !resolved) finish(null);
    }

    PREFERRED_SITES.forEach((site_id, idx) => {
      const orderData = buildOrderData(site_id);
      const launch = idx === 0
        ? Promise.resolve()
        : sleep(idx * SITE_STAGGER_MS, signal).catch(() => { /* aborted */ });
      launch.then(() => post("/creat_book_info", token, { orderData }, signal, taskId))
        .then(async checkRes => {
          if (won || signal.aborted) return;
          const available = (checkRes.available_times ?? []) as number[];
          const conflicts = (checkRes.conflict_times ?? []) as number[];

          // Case C: nothing available
          if (available.length === 0) {
            const reason =
              conflicts.length > 0
                ? `冲突时段: ${conflicts.join(", ")}`
                : (checkRes.message ?? "无可用时段");
            addLog(taskId, "info", `  场地 ${site_id} 不可用 — ${reason}`);
            return;
          }

          // Case A: fully available (no conflicts)
          // Case B: partially available (server has pre-reserved available slots for us)
          const isPartial = conflicts.length > 0;
          let finalOrderData = orderData;

          if (isPartial) {
            // Reconstruct orderData with only the available sub-slots
            const sorted = [...available].sort((a, b) => a - b);
            const partialStart = INDEX_TO_TIME[sorted[0]];
            const partialEnd = INDEX_TO_TIME[sorted[sorted.length - 1] + 1];
            if (!partialStart || !partialEnd) {
              addLog(
                taskId,
                "warn",
                `  场地 ${site_id} 部分可用但时段索引无法解析，跳过`,
              );
              return;
            }
            finalOrderData = {
              ...orderData,
              time_list: sorted,
              start_time: partialStart,
              end_time: partialEnd,
            };
            addLog(
              taskId,
              "info",
              `  场地 ${site_id} 部分可用（${partialStart}-${partialEnd}），冲突时段: ${conflicts.join(", ")}，正在确认预约...`,
            );
          }

          if (won) return;
          won = true;
          if (!isPartial)
            addLog(
              taskId,
              "success",
              `  场地 ${site_id} 可用！正在确认预约...`,
            );
          try {
            const orderRes = await post(
              "/creat_order",
              token,
              { orderData: finalOrderData },
              signal,
              taskId,
            );
            finish(orderRes.data ?? orderRes);
          } catch (e) {
            addLog(
              taskId,
              "error",
              `  场地 ${site_id} 下单异常: ${(e as Error).message}`,
            );
            won = false;
            checkPending();
          }
        })
        .catch((e: Error) => {
          if (!signal.aborted)
            addLog(taskId, "error", `  场地 ${site_id} 查询异常: ${e.message}`);
        })
        .finally(() => {
          pending--;
          checkPending();
        });
    });
  });
}

// ─── main entry ─────────────────────────────────────────────────────────────

export async function executeReserve(taskId: string) {
  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  const {
    token,
    date,
    openid,
    nickname,
    phone,
    preferred_time_slots,
    abortController,
  } = task;
  const signal = abortController.signal;

  updateStatus(taskId, "running");
  addLog(taskId, "info", "读取配置完成");
  addLog(taskId, "info", `目标日期: ${date}`);
  addLog(
    taskId,
    "info",
    `时间段优先级: ${preferred_time_slots.map(s => `${s.start_time}-${s.end_time}`).join(" → ")}`,
  );

  const offset = await syncServerTime(token, signal, taskId);
  await waitUntilOpen(offset, signal, taskId);

  if (signal.aborted) return;

  addLog(taskId, "info", "=== 开始抢场 ===");

  for (let i = 0; i < preferred_time_slots.length; i++) {
    if (signal.aborted) return;
    const slot = preferred_time_slots[i];
    const result = await tryTimeSlot(
      token,
      { date, openid, nickname, phone },
      slot,
      signal,
      taskId,
    );

    if (result) {
      const r = result as {
        order_num: string;
        venue_name: string;
        site_id: number;
        order_date: string;
        start_time: string;
        end_time: string;
      };
      addLog(taskId, "success", `预约成功！订单号: ${r.order_num}`);
      addLog(
        taskId,
        "success",
        `场地: ${r.venue_name} ${r.site_id}号 | 时间: ${r.order_date} ${r.start_time}-${r.end_time}`,
      );
      updateStatus(taskId, "success", r);
      return;
    }

    if (i < preferred_time_slots.length - 1) {
      addLog(
        taskId,
        "warn",
        `时间段 ${slot.start_time}-${slot.end_time} 全部场地冲突，等待 1.5s 后尝试备选...`,
      );
      await sleep(1500, signal);
    }
  }

  addLog(taskId, "error", "所有时间段均已被占满，抢场失败。");
  updateStatus(taskId, "failed");
}
