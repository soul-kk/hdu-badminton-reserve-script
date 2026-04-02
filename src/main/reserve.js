// 抢场核心逻辑

import { createBookInfo, createOrder } from './api.js';
import { logger } from './logger.js';

/**
 * 对一个时间段，并行检查所有备选场地，第一个可用的立即下单。
 * 返回成功的订单数据，或 null（该时间段全部冲突）。
 */
async function tryTimeSlot(token, cfg, timeSlot) {
  const { date, venue_name, venue_type, openid, nickname, phone, preferred_sites } = cfg;
  const { time_list, start_time, end_time } = timeSlot;

  logger.info(
    `尝试时间段 ${start_time}-${end_time}，并发请求 ${preferred_sites.length} 个场地的 creat_book_info...`
  );

  // 用于标记是否已有场地胜出（避免重复下单）
  let won = false;

  // 构造每个场地的 orderData
  function buildOrderData(site_id) {
    return {
      openid,
      nickname,
      phone,
      date,
      venue_name,
      venue_type,
      site_id,
      total_price: 0,
      time_list,
      start_time,
      end_time,
    };
  }

  // 对每个场地，发起 creat_book_info → 若可用立即 creat_order
  // 用 Promise.race-style 手动实现：哪个先返回可用就下单，下单成功则 resolve 整个 Promise
  return new Promise((resolve) => {
    let pending = preferred_sites.length;
    let resolved = false;

    function finish(result) {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    }

    for (const site_id of preferred_sites) {
      const orderData = buildOrderData(site_id);

      createBookInfo(token, orderData)
        .then(async (checkRes) => {
          // 已有其他场地胜出，忽略
          if (won) return;

          const hasConflict = checkRes.conflict_times && checkRes.conflict_times.length > 0;
          if (hasConflict) {
            logger.info(`  场地 ${site_id} 冲突: ${checkRes.conflict_times.join(', ')}`);
          } else {
            // 该场地可用，尝试抢占
            if (won) return; // double-check
            won = true;
            logger.success(`  场地 ${site_id} 可用！正在确认预约...`);

            try {
              const orderRes = await createOrder(token, orderData);
              if (orderRes.status === 'success') {
                finish(orderRes.data);
              } else {
                logger.error(`  场地 ${site_id} creat_order 失败: ${orderRes.message}`);
                won = false; // 释放，允许其他场地尝试（但并发窗口已过，此时可能无效）
                checkPending();
              }
            } catch (e) {
              logger.error(`  场地 ${site_id} creat_order 异常: ${e.message}`);
              won = false;
              checkPending();
            }
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
      // 所有请求都已结束且没有成功下单，说明该时间段全部冲突
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
      logger.warn(
        `时间段 ${slot.start_time}-${slot.end_time} 全部场地冲突，尝试备选时间段...`
      );
    }
  }

  logger.error('所有时间段均已被占满，抢场失败。');
  return false;
}
