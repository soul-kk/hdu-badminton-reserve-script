// 所有 API 请求封装

const BASE_URL = 'https://sportmeta.hdu.edu.cn/book/client';

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23E246 AliApp(DingTalk/7.8.1) com.laiwang.DingTalk/46766536 Channel/201200 language/zh-Hans-CN UT4Aplus/0.0.6 WK';

function buildHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'User-Agent': USER_AGENT,
    'Referer': 'https://sportmeta.hdu.edu.cn/book/dingtalk/',
    'DingTalk-Flag': '1',
    'Origin': 'https://sportmeta.hdu.edu.cn',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };
}

async function post(path, token, body = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}`);
  }
  return res.json();
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
