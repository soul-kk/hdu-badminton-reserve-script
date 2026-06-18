# badminton-reserve

HDU 综合馆羽毛球场地自动抢场。每天 20:00 开放预约，脚本卡点并发请求，第一个可用场地立即下单。

## 网址中使用

> 在服务器上运行任务，用的人越多成功率越低（会触发限流）

- 访问网站： [https://badminton.soul-kk.top](https://badminton.soul-kk.top) (内含教程)

## 使用本地脚本

> 适合有软件基础的朋友，在自己电脑上运行，请求从本地 IP 发出，不受服务器限流影响，成功率近乎 100%。

### 前置要求

- Node.js 18+（[下载](https://nodejs.org/)）
- 更新Token（通过[token抓取工具](https://badminton.soul-kk.top/guide)获取）

### 步骤

1. 编辑 `reserve_script/config.json`，填写你的预约信息
2. 运行脚本：

```bash
 node reserve_script/main.js
```

3. 脚本会自动同步服务器时间，等待到 20:00 后开始抢场。这期间请保持脚本处于运行状态！

### config.json 字段说明

| 字段                   | 说明                               | 示例                                          |
| ---------------------- | ---------------------------------- | --------------------------------------------- |
| `token`                | 场馆速约 Token                     | `eyJhbG...`                                   |
| `date`                 | 预约日期                           | `2026-06-10` （YYYY-MM-DD）                   |
| `openid`               | 你的 学号                          | 24010123                                      |
| `nickname`             | 你的 姓名                          | 石宇奇                                        |
| `phone`                | 你的 手机号                        |                                               |
| `preferred_time_slots` | 时间段优先级，按顺序尝试           | `[{"start_time":"19:00","end_time":"21:00"}]` |
| `sites`                | 场地号优先级，可以根据自己喜好修改 | `[6, 5, 2, 3, 4, 1, 7, 8]`                    |
