// 所有 API 请求封装

import { logger } from './logger.js';

const BASE_URL = 'https://sportmeta.hdu.edu.cn/book/client';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK';

function buildHeaders(token, withOrigin = true) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'User-Agent': USER_AGENT,
    'Referer': 'https://sportmeta.hdu.edu.cn/book/dingtalk/',
    'DingTalk-Flag': '1',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };
  if (withOrigin) {
    headers['Origin'] = 'https://sportmeta.hdu.edu.cn';
  }
  return headers;
}

// 502 是整点瞬时过载，短暂等待后重试成功率较高；其他错误不重试
const RETRY_STATUS = new Set([502]);
const RETRY_DELAYS_MS = [300, 600]; // 最多重试 2 次，间隔递增

async function post(path, token, body = null) {
  const url = `${BASE_URL}${path}`;
  const headers = buildHeaders(token, body !== null);
  logger.api(`→ POST ${url}\n  body: ${body ? JSON.stringify(body) : '(none)'}`);

  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      logger.warn(`  ${path} 第 ${attempt} 次重试（等待 ${delay}ms）...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const resText = await res.text();
    logger.api(`← ${res.status} ${res.statusText}\n  body: ${resText}`);

    if (RETRY_STATUS.has(res.status)) {
      lastError = new Error(`HTTP ${res.status} ${res.statusText} on ${path}`);
      continue; // 触发重试
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}`);
    }

    const data = JSON.parse(resText);

    // 部分接口以 2xx 状态码返回业务错误（如 201 + {status:"error"}），统一抛出
    if (data && data.status === 'error') {
      throw new Error(`业务错误: ${data.message || '未知错误'} on ${path}`);
    }

    return data;
  }

  throw lastError;
}

// 获取服务器时间戳（毫秒）
export async function getServerTime(token) {
  const data = await post('/post_server_time', token);
  return data.data;
}

// 获取场馆时间配置
export async function getVenueInfo(token, date, venue_name) {
  return post('/post_venue_info', token, { date, venue_name });
}

// 查询场地占用情况
export async function getSiteSituation(token, date, venue_name) {
  return post('/post_site_situation', token, { date, venue_name, is_permanent: 0 });
}

// 预约检查（第一步）
export async function createBookInfo(token, orderData) {
  return post('/creat_book_info', token, { orderData });
}

// 确认预约（第二步）
export async function createOrder(token, orderData) {
  return post('/creat_order', token, { orderData });
}
