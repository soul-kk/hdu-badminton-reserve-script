# 羽毛球场地自动抢场脚本 - 技术实现文档

> 最后更新：2026-04-28

---

## 一、项目概述

**目标**：自动抢杭电（HDU）钉钉工作台内的综合馆羽毛球场地。

**技术路线**：Node.js + 协议模拟（直接发 HTTPS 请求，不依赖浏览器/WebView）。

**运行方式**：手动启动脚本 → 内部倒计时等待 20:00 → 精确时刻并发抢场。

---

## 二、当前完成进度

### 已完成

| 模块         | 状态 | 说明                                        |
| ------------ | ---- | ------------------------------------------- |
| 项目初始化    | ✅   | package.json（ESM，无额外依赖）                          |
| 配置模块      | ✅   | config.json 读取，index.js 内手动解析 .env               |
| HTTP 请求模块 | ✅   | src/api.js，原生 fetch 封装                              |
| 时间同步模块  | ✅   | src/timer.js，3 次采样取中位数 offset                    |
| 抢场核心逻辑  | ✅   | src/reserve.js，并发竞速 + 串行降级                      |
| 倒计时等待    | ✅   | src/timer.js waitUntilOpen，每秒刷新，最后 5s 精确等待   |
| 终端输出      | ✅   | src/logger.js，彩色日志（INFO/SUCCESS/WARN/ERROR）       |

### 待开发

> 所有模块已开发完成。

---

## 三、核心业务规则

| 规则         | 值                             |
| ------------ | ------------------------------ |
| 场地数量     | 12 片（site_id: 1-12）         |
| 可提前预约   | 2 天（今天约后天的场地）       |
| 开放时间     | 每天 20:00                     |
| 单次预约上限 | 1 片场地 + 最多 2 个连续时间段 |
| 费用         | 免费（total_price: 0）         |

### 时间段索引表

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

## 四、抢场技术方案

### 4.1 整体流程

```
启动脚本
  │
  ├─ 1. 读取 config.json（日期、首选时间段、备选场地列表）
  ├─ 2. 读取 .env（token）
  ├─ 3. 调用 post_server_time 获取服务器时间，计算时间差 offset
  ├─ 4. 倒计时等待至 20:00（基于服务器时间修正）
  │
  ├─ 5. 精确时刻触发 → 并发抢场
  │     ├─ 对首选时间段的所有备选场地，并发发送 creat_book_info
  │     ├─ 第一个返回"可用"的场地 → 立即发送 creat_order 确认
  │     ├─ 成功 → 输出预约信息，退出
  │     └─ 全部冲突 → 尝试备选时间段（降级策略）
  │
  └─ 6. 输出最终结果（成功/失败）
```

### 4.2 并发抢场策略

**核心原则：时间段优先，场地号不限。同一时间段内场地并行竞速，不同时间段之间按优先级串行。**

> **为什么必须并行？** 实测 `creat_book_info` 单次耗时 1~2 秒。如果对 12 个场地串行请求，最坏需要 12~24 秒，热门时间段早在第 2 秒就被抢光。并行请求可以在 1~2 秒内同时探测所有场地，第一个返回可用的立即下单。

配置示例：

```json
{
  "preferred_time_slots": [
    { "time_list": [5, 6], "start_time": "13:20", "end_time": "15:00" },
    { "time_list": [6, 7], "start_time": "14:00", "end_time": "16:00" }
  ],
  "preferred_sites": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}
```

执行逻辑：

```
for 时间段 in preferred_time_slots（串行，按优先级）:

    并行发送所有场地的 creat_book_info（Promise.all 竞速）
        ├─ 场地1 creat_book_info ──→ 1.2s 返回冲突
        ├─ 场地2 creat_book_info ──→ 0.9s 返回可用 ✓ ──→ 立即 creat_order
        ├─ 场地3 creat_book_info ──→ 1.5s 返回可用（但场地2已胜出，忽略）
        └─ ...

    if creat_order 成功 → 输出结果，退出
    if creat_order 失败 → 继续当前时间段剩余可用场地
    if 所有场地都冲突 → 进入下一个时间段
```

关键细节：

1. **并行发送**：对当前时间段，用 `Promise.all` 同时发送所有场地的 `creat_book_info`，但不等全部返回
2. **竞速取胜**：哪个场地先返回 `conflict_times: []`（可用），立即对该场地发 `creat_order`
3. **串行降级**：当前时间段所有场地都冲突后，才进入下一个优先级的时间段
4. **成功即停**：任何一个 `creat_order` 返回 `status: "success"` 即终止整个流程

### 4.3 时间同步方案

```
本地时间 + offset ≈ 服务器时间
offset = 服务器时间戳 - 本地时间戳（请求 post_server_time 时计算，考虑网络延迟取中值）
```

- 启动时调用 3 次 `post_server_time`，取中位数计算 offset
- 倒计时基于修正后的时间，确保在服务器 20:00:00.000 的瞬间发出请求

### 4.4 请求构造

所有请求共用 Headers：

```
Authorization: Bearer <token>
Content-Type: application/json
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) ... AliApp(DingTalk/7.8.1) ...
Referer: https://sportmeta.hdu.edu.cn/book/dingtalk/
DingTalk-Flag: 1
```

Base URL: `https://sportmeta.hdu.edu.cn/book/client/`

### 4.5 API 调用链

| 步骤 | 接口                        | 用途               | 时机                           |
| ---- | --------------------------- | ------------------ | ------------------------------ |
| 1    | `POST /post_server_time`    | 获取服务器时间戳   | 启动时（3次）                  |
| 2    | `POST /post_venue_info`     | 获取场馆时间配置   | 启动时（可选，验证配置有效性） |
| 3    | `POST /post_site_situation` | 查询场地占用情况   | 启动时（可选，预览当前余量）   |
| 4    | `POST /creat_book_info`     | 预约检查（第一步） | 20:00 并发触发                 |
| 5    | `POST /creat_order`         | 确认预约（第二步） | 检查通过后立即发送             |

---

## 五、配置文件说明

### `.env`（手动维护）

```
token = eyJhbGciOiJIUzI1N...（从钉钉抓包获取的 JWT token）
```

token 过期后需手动抓包替换。JWT payload 中 `exp` 字段为过期时间。

### `config.json`（预约参数）

```json
{
  "date": "2026-4-3",
  "venue_name": "综合馆羽毛球",
  "venue_type": "badminton",
  "openid": "24050511",
  "nickname": "刘振科",
  "phone": "15934125523",

  "preferred_time_slots": [
    {
      "time_list": [5, 6],
      "start_time": "13:20",
      "end_time": "15:00"
    },
    {
      "time_list": [6, 7],
      "start_time": "14:00",
      "end_time": "16:00"
    }
  ],

  "preferred_sites": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}
```

| 字段                   | 说明                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `date`                 | 要预约的日期（格式 `YYYY-M-D`）                                                          |
| `venue_name`           | 场馆名称，固定值                                                                         |
| `venue_type`           | 场馆类型，固定值                                                                         |
| `openid`               | 用户 ID（来自 token 解码）                                                               |
| `nickname`             | 用户昵称                                                                                 |
| `phone`                | 手机号                                                                                   |
| `preferred_time_slots` | 时间段偏好列表，按优先级排序。每项包含 `time_list`（索引数组）、`start_time`、`end_time` |
| `preferred_sites`      | 场地号偏好列表，按优先级排序。默认 1-12 全部                                             |

---

## 六、脚本使用方式

### 前置条件

1. 安装 Node.js >= 18
2. `npm install` 安装依赖

### 使用步骤

```bash
# 1. 确保 .env 中的 token 有效（手动从钉钉抓包获取）

# 2. 编辑 config.json，填写预约日期、首选时间段等

# 3. 启动脚本（内部会倒计时等待 20:00）
node index.js

# 4. 如需立即执行（测试/抢空闲场地），加 --now 参数
node index.js --now
```

### 终端输出示例（预期）

```
[INFO] 读取配置完成
[INFO] 目标日期: 2026-4-3 | 首选时段: 13:20-15:00 | 备选场地: 1-12号
[INFO] 服务器时间同步完成，offset: +32ms
[INFO] 距离 20:00:00 还有 00:12:34，等待中...
[INFO] === 20:00:00.000 开始抢场 ===
[INFO] 并发请求 12 个场地的 creat_book_info...
[SUCCESS] 3号场地可用！正在确认预约...
[SUCCESS] 预约成功！订单号: 17749584052849
[SUCCESS] 场地: 综合馆羽毛球 3号 | 时间: 2026-04-03 13:20-15:00
```

---

## 七、项目结构（规划）

```
badminton-reserve/
├── .env                    # JWT token（手动维护）
├── config.json             # 预约配置（每次抢场前编辑）
├── package.json            # 项目依赖
├── index.js                # 入口文件
├── src/
│   ├── api.js              # HTTP 请求封装（所有 API 调用）
│   ├── timer.js            # 时间同步 & 倒计时
│   ├── reserve.js          # 抢场核心逻辑（并发 + 降级）
│   └── logger.js           # 终端日志输出
├── .claude/
│   ├── context.md          # 项目背景 & 进度
│   ├── TECH_DOC.md         # 本文档（技术实现同步）
│   └── api/                # API 接口文档
└── reserve-netSessions/    # 原始抓包数据
```

---

## 八、变更记录

| 日期       | 变更内容                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 2026-03-31 | 初始版本：完成需求确认、技术方案设计                                                              |
| 2026-04-28 | 编写所有源码模块：index.js、src/api.js、src/timer.js、src/reserve.js、src/logger.js，本地验证通过（token 过期返回 401/403 符合预期） |
