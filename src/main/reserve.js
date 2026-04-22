// 抢场核心逻辑

import { createBookInfo, createOrder } from './api.js';
import { logger } from './logger.js';

// 硬编码的场馆信息（一般不变）
const VENUE_NAME = '综合馆羽毛球';
const VENUE_TYPE = 'badminton';
const PREFERRED_SITES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 时间段索引映射表（start_time → index）
const TIME_INDEX = {
  '08:00': 0,
  '09:00': 1,
  '10:00': 2,
  '11:00': 3,
  '11:40': 4,
  '13:20': 5,
  '14:00': 6,
  '15:00': 7,
  '16:00': 8,
  '17:00': 9,
  '18:00': 10,
  '19:00': 11,
  '20:00': 12,
  '21:00': 13,
};

function resolveTimeList(start_time, end_time) {
  const startIdx = TIME_INDEX[start_time];
  const endIdx = TIME_INDEX[end_time];
  if (startIdx === undefined) throw new Error(`无效的开始时间: ${start_time}`);
  if (endIdx === undefined) throw new Error(`无效的结束时间: ${end_time}`);
  if (endIdx <= startIdx) throw new Error(`结束时间 ${end_time} 必须晚于开始时间 ${start_time}`);
  const result = [];
  for (let i = startIdx; i < endIdx; i++) result.push(i);
  return result;
}

/**
 * 对一个时间段，并行检查所有备选场地，第一个可用的立即下单。
 * 返回成功的订单数据，或 null（该时间段全部冲突）。
 */
async function tryTimeSlot(token, cfg, timeSlot) {
  const { date, openid, nickname, phone } = cfg;
  const { start_time, end_time } = timeSlot;
  const time_list = resolveTimeList(start_time, end_time);

  logger.info(
    `尝试时间段 ${start_time}-${end_time}（time_list: [${time_list}]），并发请求 ${PREFERRED_SITES.length} 个场地的 creat_book_info...`
  );

  let won = false;

  function buildOrderData(site_id) {
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

  return new Promise((resolve) => {
    let pending = PREFERRED_SITES.length;
    let resolved = false;

    function finish(result) {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }

    for (const site_id of PREFERRED_SITES) {
      const orderData = buildOrderData(site_id);

      createBookInfo(token, orderData)
        .then(async (checkRes) => {
          if (won) return;

          const available = checkRes.available_times ?? [];
          const conflicts = checkRes.conflict_times ?? [];
          const isAvailable = available.length > 0 && conflicts.length === 0;

          if (!isAvailable) {
            const reason = conflicts.length > 0
              ? `冲突时段: ${conflicts.join(', ')}`
              : (checkRes.message || '无可用时段');
            logger.info(`  场地 ${site_id} 不可用 — ${reason}`);
            return;
          }

          if (won) return;
          won = true;
          logger.success(`  场地 ${site_id} 可用！正在确认预约...`);

          try {
            const orderRes = await createOrder(token, orderData);
            finish(orderRes.data ?? orderRes);
          } catch (e) {
            logger.error(`  场地 ${site_id} creat_order 异常: ${e.message}`);
            won = false;
            checkPending();
          }
        })
        .catch((e) => {
          logger.error(`  场地 ${site_id} creat_book_info 异常: ${e.message}`);
        })
        .finally(() => {
          pending--;
          checkPending();
        });
    }

    function checkPending() {
      if (pending <= 0 && !resolved) {
        finish(null);
      }
    }
  });
}

/**
 * 主抢场逻辑：按优先级逐个时间段尝试（串行），每个时间段内并行抢所有场地。
 */
export async function reserve(token, cfg) {
  const { preferred_time_slots } = cfg;

  for (let i = 0; i < preferred_time_slots.length; i++) {
    const slot = preferred_time_slots[i];
    const result = await tryTimeSlot(token, cfg, slot);

    if (result) {
      logger.success(`预约成功！订单号: ${result.order_num}`);
      logger.success(
        `场地: ${result.venue_name} ${result.site_id}号 | 时间: ${result.order_date} ${result.start_time}-${result.end_time}`
      );
      return true;
    }

    if (i < preferred_time_slots.length - 1) {
      const cooldownMs = 1500;
      logger.warn(
        `时间段 ${slot.start_time}-${slot.end_time} 全部场地冲突，等待 ${cooldownMs}ms 后尝试备选时间段...`
      );
      await new Promise((r) => setTimeout(r, cooldownMs));
    }
  }

  logger.error('所有时间段均已被占满，抢场失败。');
  return false;
}
