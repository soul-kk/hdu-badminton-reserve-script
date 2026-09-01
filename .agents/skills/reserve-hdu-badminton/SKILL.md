---
name: reserve-hdu-badminton
description: Automate local HDU 综合馆 badminton reservations from first-run setup through DingTalk 场馆速约 Token capture, config generation, 20:00 countdown, execution, and result reporting. Use for 抢场、预约羽毛球场、测试 Token、创建或查看预约任务, or when the user provides a reservation date/time.
---

# HDU 羽毛球自动预约

持续执行到成功、失败或明确阻塞，尽量不让用户处理过程步骤。

## 规则

- 从本文件向上四级定位仓库根目录；所有命令都在根目录运行。
- 所有日期和 `15:00`、`20:00`、`20:05` 一律为北京时间 `Asia/Shanghai`，相对日期也按北京时间换算。
- 自动化优先显式使用 `Asia/Shanghai`；若只接受 UTC，15:00 对应 07:00 UTC，20:00 对应 12:00 UTC。创建后复核界面必须显示北京时间 15:00，错误时立即修正。
- Token、身份、`.badminton-reserve/` 和 `reserve_script/config.json` 仅存本机，不得输出或提交。

## 1. 检查环境与档案

运行 `node .agents/skills/reserve-hdu-badminton/scripts/environment.mjs status`。必须有 Node.js 18+、Python 3 和 `mitmproxy`。

- 没有 Node/Python：检测系统包管理器，集中请求一次安装与联网授权，自动安装后复检。
- 只有 `mitmproxy` 缺失：运行 `node .agents/skills/reserve-hdu-badminton/scripts/environment.mjs install-mitmproxy`，使用项目私有 `.badminton-reserve/venv`。
- 仅当 `status` 输出 `ok: true` 时继续；管理员密码及系统安全确认不可绕过。

运行 `node .agents/skills/reserve-hdu-badminton/scripts/profile.mjs status`。若未配置，一次性询问并确认：

1. 已把钉钉「场馆速约」放在“工作台 → 我的”第一行。
2. 已允许 Agent 操控电脑与钉钉。
3. 学号、姓名、手机号。

将回答作为 JSON 从标准输入传给 `profile.mjs init`；同一项目后续对话复用档案，不再询问。

## 2. 解析请求与安排时间

- 将日期明确为北京时间 `YYYY-MM-DD`，将时段整理为一个或多个 `HH:MM-HH:MM` 并简短复述。
- 沿用 `main.js` 行为：完整时段不可用时可预约连续的可用部分；用户要求完整时段才说明需先改程序。
- 正式预约必须在当天北京时间 15:00 后抓 Token。提前收到请求时，优先创建北京时间 15:00 的宿主唤醒，否则保持任务等待；不得提前抓取。
- 只有用户明确说测试/模拟时才使用测试模式，并在确认倒计时后停止。

## 3. 获取 Token

直接运行原脚本，Python 命令优先采用环境检查返回的 `projectPython`：

```bash
<python> token_script/get_token.py
```

测试模式才可加 `--test`。`get_token.py` 会拒绝北京时间 15:00 前的正式抓取，并在成功后记录不含 Token 的抓取时间。

脚本监听后，使用桌面控制操作钉钉；路径与恢复见 [dingtalk-control.md](references/dingtalk-control.md)。等待脚本成功退出并确认代理和 18888 端口已恢复。宿主要求代理、证书或令牌确认时集中请求一次，不得绕过。

## 4. 生成配置并运行

按优先级重复传入 `--slot`：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/prepare-config.mjs \
  --date YYYY-MM-DD \
  --slot HH:MM-HH:MM \
  --token-clipboard
```

测试模式加 `--allow-expire-before-open`；正式模式会验证 Token 为今天北京时间 15:00 后抓取且至少覆盖北京时间 20:05。

直接运行预约脚本并保持终端任务存活：

```bash
node reserve_script/main.js
```

macOS 可用 `/usr/bin/caffeinate -dimsu node reserve_script/main.js` 防止空闲睡眠。日志出现“服务器时间同步完成”和“距离 20:00:00”后才报告任务已创建；继续监控进程到退出。

## 5. 报告与恢复

- 成功：报告日期、实际时段、场地和订单号，不报告 Token。
- 失败：引用终端中的具体原因并判断是否能重试；Token 异常时确认代理恢复后只重试一次。
- Agent/对话重启：重新检查环境、档案以及正在运行的 `main.js`，不重复询问身份。
