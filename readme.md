# badminton-reserve

HDU 综合馆羽毛球场地自动抢场脚本。每天 20:00 开放预约，脚本精确卡点并发请求所有场地，第一个可用场地立即下单。

---

## 快速开始

**1. 更新 Token**

用 Stream（iOS 抓包工具）抓取钉钉预约页面的请求，复制 `Authorization: Bearer <token>` 中的 token，粘贴到 `config.json` 的 `token` 字段。

**2. 修改预约日期**

编辑 `config.json`，将 `date` 改为目标日期：

```json
{ "date": "2026-4-23" }
```

**3. 运行脚本**

```bash
npm start        # 倒计时等待至 20:00 自动抢场
npm run now      # 立即执行（用于测试）
```

---

## 抢场命令

| 命令          | 作用                           |
| ------------- | ------------------------------ |
| `npm start`   | 正常抢场，内部倒计时等待 20:00 |
| `npm run now` | 立即执行，跳过等待             |

---

## 配置说明

### `config.json`

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

- `token`：每次抢场前从 Stream 抓包更新
- `date`：每次抢场前修改
- `preferred_time_slots`：时间段优先级，从上到下依次降级，只需填 `start_time` / `end_time`

---

## 项目结构

```
badminton-reserve/
├── config.json                  # 预约配置（token + date，每次修改）
├── package.json
├── script/main/
│   ├── index.js                 # 入口
│   ├── api.js                   # HTTP 请求封装
│   ├── timer.js                 # 时间同步与倒计时
│   ├── reserve.js               # 抢场核心逻辑
│   └── logger.js                # 日志
├── scripts/
│   └── token_extractor.py       # mitmproxy addon（备用）
└── .logs/                       # 每次运行的完整请求日志
```

---

## 常见问题

**为什么抢场失败？**

查看 `.logs/` 中最新的日志文件，常见原因：

| 错误               | 原因                                           |
| ------------------ | ---------------------------------------------- |
| `401 Unauthorized` | Token 过期，用 Stream 重新抓取更新             |
| `502 Bad Gateway`  | 服务器整点过载，脚本自动重试 2 次              |
| `403 Forbidden`    | 触发限流，轮间已有冷却；若持续出现可减少场地数 |

详细技术说明见 [.claude/TECH_DOC.md](.claude/TECH_DOC.md)。
