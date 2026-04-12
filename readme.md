# badminton-reserve

HDU 综合馆羽毛球场地自动抢场脚本。每天 20:00 开放预约，脚本精确卡点并发请求所有场地，第一个可用场地立即下单。

---

## 快速开始

**1. 修改预约日期**

编辑 `config.json`，将 `date` 改为目标日期：

```json
{ "date": "2026-4-14" }
```

**2. 确认 Token 有效**

手机钉钉配置 WiFi 代理（Mac IP:18888），打开羽毛球预约页面，Token 会自动写入 `.env`。

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

## Token 代理控制

mitmproxy 以 launchd 服务形式常驻，开机自启、崩溃自动重启。

| 命令                    | 作用                       |
| ----------------------- | -------------------------- |
| `npm run proxy:status`  | 查看进程状态和端口监听情况 |
| `npm run proxy:start`   | 手动启动                   |
| `npm run proxy:stop`    | 临时停止（开机仍会自启）   |
| `npm run proxy:restart` | 重启（修改脚本后使用）     |
| `npm run proxy:disable` | 彻底禁用，开机不再自启     |
| `npm run proxy:enable`  | 重新启用开机自启           |
| `npm run proxy:log`     | 实时查看 Token 更新日志    |

---

## 配置说明

### `config.json`

```json
{
  "date": "2026-4-14",
  "preferred_time_slots": [
    { "time_list": [11, 12], "start_time": "19:00", "end_time": "21:00" },
    { "time_list": [8, 9], "start_time": "16:00", "end_time": "18:00" }
  ],
  "preferred_sites": [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4]
}
```

- `date`：每次抢场前修改
- `preferred_time_slots`：时间段优先级，从上到下依次降级
- `preferred_sites`：所有场地并发抢，顺序不影响优先级

### `.env`

```
token = eyJhbGci...
```

由 mitmproxy 自动写入，通常不需要手动修改。

---

## 项目结构

```
badminton-reserve/
├── .env                         # JWT Token（自动维护）
├── config.json                  # 预约配置
├── package.json
├── src/main/
│   ├── index.js                 # 入口
│   ├── api.js                   # HTTP 请求封装
│   ├── timer.js                 # 时间同步与倒计时
│   ├── reserve.js               # 抢场核心逻辑
│   └── logger.js                # 日志
├── scripts/
│   └── token_extractor.py       # mitmproxy addon，自动捕获 Token
└── .logs/                       # 每次运行的完整请求日志
```

---

## 常见问题

**为什么抢场失败？**

查看 `.logs/` 中最新的日志文件，常见原因：

| 错误               | 原因                           |
| ------------------ | ------------------------------ |
| `401 Unauthorized` | Token 过期，重新打开预约页更新 |
| `502 Bad Gateway`  | 服务器整点过载，属于正常竞争   |
| `403 Forbidden`    | 触发限流，稍后重试             |

详细技术说明见 [.claude/TECH_DOC.md](.claude/TECH_DOC.md)。
