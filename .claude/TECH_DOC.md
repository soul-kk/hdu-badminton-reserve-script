# 羽毛球场地自动抢场脚本 - 技术文档

> 最后更新：2026-04-07

---

## 一、项目概述

自动抢杭电（HDU）钉钉工作台内的综合馆羽毛球场地。通过抓包逆向 H5 页面的 HTTPS 接口，用 Node.js 直接模拟请求。配合 mitmproxy 常驻代理，手机打开预约页面即可自动捕获并更新 Token，无需手动维护。

---

## 二、核心业务规则

| 规则 | 值 |
| --- | --- |
| 场地数量 | 12 片（site_id: 1-12） |
| 可提前预约 | 最多 2 天 |
| 开放抢场时间 | 每天 20:00 |
| 费用 | 免费（total_price: 0） |

### 时间段索引表

`time_list` 字段填写对应时间段的索引值，两小时时间段需填写起始和结束两个索引。

| 索引 | 时间  | 索引 | 时间  |
| ---- | ----- | ---- | ----- |
| 0    | 08:00 | 7    | 15:00 |
| 1    | 09:00 | 8    | 16:00 |
| 2    | 10:00 | 9    | 17:00 |
| 3    | 11:00 | 10   | 18:00 |
| 4    | 11:40 | 11   | 19:00 |
| 5    | 13:20 | 12   | 20:00 |
| 6    | 14:00 | 13   | 21:00 |

---

## 三、抢场方案

### 执行流程

```
启动
 → 读取 config.json + .env
 → 同步服务器时间（×3 取中位数）
 → 倒计时等待至 20:00:00
 → 并发发送所有场地的 creat_book_info
 → 第一个可用场地立即 creat_order
 → 成功退出 / 全部冲突则降级到下一优先时间段
```

### 并发策略

- **同一时间段内**：所有 `preferred_sites` 并行发送 `creat_book_info`，第一个返回可用的立即抢占下单，已胜出后其余结果忽略。
- **不同时间段之间**：串行按 `preferred_time_slots` 优先级顺序降级尝试。

> 实测 `creat_book_info` 单次耗时 1~2s，12 个场地串行最坏需 24s，热门场地早被抢完，并行是必须的。

### 时间同步

启动时串行调用 3 次 `post_server_time`，每次记录请求前后本地时间，用请求中点计算单程延迟误差，最终取中位数 offset。倒计时基于 `Date.now() + offset` 保证精确触发。

### API 调用链

| 接口 | 用途 | 调用时机 |
| --- | --- | --- |
| `POST /post_server_time` | 获取服务器时间戳（ms） | 启动时 ×3 |
| `POST /creat_book_info` | 预约可用性检查 | 20:00 并发 |
| `POST /creat_order` | 确认下单 | 检查通过后立即 |

所有请求共用 Headers：iPhone DingTalk UA、`DingTalk-Flag: 1`、`Authorization: Bearer <token>`，详见 `.claude/api/`。

---

## 四、Token 自动化

### 方案原理

mitmproxy 在 Mac 本机监听 8888 端口作为 HTTP 代理，手机钉钉将 WiFi 代理指向该端口后，访问预约页面的流量经过 Mac，`token_extractor.py` 从中自动提取 Bearer Token 并写入 `.env`。全程无需手动操作。

### 组件说明

| 组件 | 说明 |
| --- | --- |
| `mitmproxy` | Python HTTPS 代理工具，解密 TLS 流量 |
| `scripts/token_extractor.py` | mitmproxy addon，过滤目标域名、提取 Token、写入 `.env` |
| `launchd` plist | macOS 开机自启，进程崩溃自动重启 |

### token_extractor.py 行为

- 过滤所有流向 `sportmeta.hdu.edu.cn` 的请求
- 提取 `Authorization: Bearer <token>`
- Token 与上次相同 → 日志打印 `token 已经是最新：<token>`，跳过写入
- Token 有变化 → 覆盖写入 `.env`，日志打印更新时间和完整 Token

日志格式示例：
```
[2026-04-07 20:01:33] Token 已更新 -> /path/to/.env
  token = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
[2026-04-07 20:05:10] token 已经是最新：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 代理控制命令

| 命令 | 作用 |
| --- | --- |
| `npm run proxy:status` | 查看进程状态和端口监听情况 |
| `npm run proxy:start` | 手动启动代理 |
| `npm run proxy:stop` | 临时停止（开机仍自启） |
| `npm run proxy:restart` | 重启，修改脚本后使用 |
| `npm run proxy:disable` | 彻底禁用，开机不再自启 |
| `npm run proxy:enable` | 重新启用开机自启 |
| `npm run proxy:log` | 实时查看 Token 更新日志 |

> `stop` vs `disable`：`stop` 只停当前运行，重启 Mac 后仍会拉起；`disable` 从开机项摘除。

---

## 五、配置文件

### `.env`

```
token = eyJhbGci...
```

由 `token_extractor.py` 自动写入，通常无需手动修改。

### `config.json`

```json
{
  "date": "2026-4-14",
  "venue_name": "综合馆羽毛球",
  "venue_type": "badminton",
  "openid": "24050511",
  "nickname": "刘振科",
  "phone": "15934125523",
  "preferred_time_slots": [
    { "time_list": [11, 12], "start_time": "19:00", "end_time": "21:00" },
    { "time_list": [8,  9],  "start_time": "16:00", "end_time": "18:00" }
  ],
  "preferred_sites": [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4]
}
```

| 字段 | 说明 |
| --- | --- |
| `date` | 目标预约日期，**每次抢场前修改** |
| `preferred_time_slots` | 优先时间段列表，按顺序降级 |
| `preferred_sites` | 参与并发的场地列表，顺序不影响并发优先级 |

---

## 六、模块说明

| 文件 | 职责 |
| --- | --- |
| `src/main/index.js` | 入口：加载配置、时间同步、触发抢场 |
| `src/main/api.js` | HTTP 请求封装，统一管理 Headers 和日志 |
| `src/main/timer.js` | 服务器时间同步、倒计时等待逻辑 |
| `src/main/reserve.js` | 抢场核心：并发 `creat_book_info`、串行时间段降级 |
| `src/main/logger.js` | 终端彩色日志 + `.logs/` 文件日志（精确到秒） |
| `scripts/token_extractor.py` | mitmproxy addon，自动捕获 Token |

---

## 七、项目结构

```
badminton-reserve/
├── .env                         # JWT Token（token_extractor.py 自动写入）
├── config.json                  # 预约配置（每次修改 date）
├── package.json                 # npm scripts 入口
├── src/main/
│   ├── index.js
│   ├── api.js
│   ├── timer.js
│   ├── reserve.js
│   └── logger.js
├── scripts/
│   └── token_extractor.py       # mitmproxy addon
├── .logs/                       # 按时间命名的运行日志
└── .claude/
    ├── TECH_DOC.md              # 本文档
    ├── context.md
    └── api/                     # 原始抓包接口文档
        ├── creat_book_info.md
        ├── create_order.md
        ├── server_time.md
        ├── site_situation.md
        └── venue_info.md
```

---

## 八、常见失败原因

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 全部 `401 Unauthorized` | Token 过期 | 手机开代理打开预约页，等待自动更新 |
| 全部 `502 Bad Gateway` | 服务器整点并发过高崩溃 | 外部因素，无法规避，下次再试 |
| 全部 `403 Forbidden` | 短时高频请求触发限流 | 减少场地并发数或等待片刻重试 |

---

## 九、变更记录

| 日期 | 内容 |
| --- | --- |
| 2026-03-31 | 初始版本，需求确认与方案设计 |
| 2026-04-01 | 完成所有源码模块，本地验证通过 |
| 2026-04-02 | 修复请求头 Origin 逻辑；新增文件日志（.logs）；**实战验证：成功抢到 2号场地 13:20-15:00** |
| 2026-04-07 | 新增 `scripts/token_extractor.py` mitmproxy Token 自动捕获；新增 `proxy:*` npm scripts 控制 launchd 服务；日志时间戳升级为年月日格式并记录 Token 内容；新增常见失败原因分析 |
