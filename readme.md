# badminton-reserve

HDU 综合馆羽毛球场地自动抢场。每天 20:00 开放预约，脚本卡点并发请求，第一个可用场地立即下单。

## 推荐网址中使用

- 访问网站： https://soul-kk.top

## 脚本使用

1. 用 Stream 抓取钉钉预约页面请求，将 `Authorization: Bearer <token>` 中的 token 填入 `config.json`
2. 修改 `config.json` 中的 `date` 为目标日期
3. 运行：

```bash
npm start      # 倒计时等待至 20:00 自动抢场
npm run now    # 立即执行（测试用）
```

## config.json

```json
{
  "token": "eyJhbGci...",
  "date": "2026-4-22",
  "openid": "24050511",
  "nickname": "刘振科",
  "phone": "15934125523",
  "preferred_time_slots": [
    { "start_time": "19:00", "end_time": "21:00" },
    { "start_time": "16:00", "end_time": "18:00" }
  ]
}
```

`token` 和 `date` 每次抢场前更新。`preferred_time_slots` 按优先级排列，只需填 `start_time` / `end_time`。

## 常见错误

| 错误  | 原因与处理                       |
| ----- | -------------------------------- |
| `401` | Token 过期，重新抓包更新         |
| `502` | 服务器整点过载，脚本自动重试     |
| `403` | 触发限流，查看 `.logs/` 中的日志 |
