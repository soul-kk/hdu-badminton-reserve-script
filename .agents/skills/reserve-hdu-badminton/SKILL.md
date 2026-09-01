---
name: reserve-hdu-badminton
description: Automate local HDU badminton-court reservations in this repository, including first-run project profile setup, DingTalk 场馆速约 Token capture, reservation config preparation, 20:00 countdown, background execution, monitoring, and result reporting. Use when the user asks to 抢场、预约羽毛球场、获取或测试场馆速约 Token、创建预约任务、查看预约结果，or provides a reservation date/time for the HDU 综合馆羽毛球 workflow.
---

# HDU 羽毛球自动预约

把本 Skill 当作低自由度操作手册执行。用户给出预约信息后，持续推进到最终成功或失败；不要把中间步骤重新交给用户操作。

## 固定路径

- 仓库根目录：从本 Skill 向上四级定位，不依赖当前对话的工作目录。
- 项目档案：`.badminton-reserve/profile.json`，仅本机保存且被 Git 忽略。
- 运行配置：`reserve_script/config.json`，仅本机保存且被 Git 忽略。
- Token 工具：`token_script/get_token.py`。
- 预约程序：`reserve_script/main.js`。

## 每次任务先检查

在仓库根目录运行：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/profile.mjs status
```

如果 `configured` 为 `true`，直接使用档案，不再询问学号、姓名、手机号或首次准备事项。如果为 `false`，执行首次配置。

## 首次配置

只发送一次合并问题，要求用户同时确认并提供：

1. 已把钉钉「场馆速约」放在“工作台 → 我的”第一行。
2. 已允许当前 Agent 操控电脑与钉钉应用。
3. 学号、姓名、手机号。

说明这些数据只写入当前仓库的 Git 忽略文件，并将在同一项目的新对话中复用。收到回答后，将以下 JSON 通过标准输入传给 `profile.mjs init`，不要把个人信息放入命令行参数：

```json
{
  "venuePinned": true,
  "computerControlReady": true,
  "openid": "用户学号",
  "nickname": "用户姓名",
  "phone": "用户手机号"
}
```

默认场地优先级由脚本写入。除非用户主动要求修改，否则不再提问。

## 解析预约请求

- 把“今天、明天、后天”等相对日期按本机时区转换成明确的 `YYYY-MM-DD`，并向用户简短复述一次。
- 把时间整理成一个或多个按优先级排列的 `HH:MM-HH:MM`。
- 只接受预约程序支持的时间节点；让配置脚本完成最终校验。
- 沿用预约程序现有行为：目标时段部分可用时也会预约可用部分。只有用户明确要求“必须完整时段”时才暂停并说明当前程序需要先改造。

## 选择执行时机

- 正式预约：必须在开放日当天 15:00 后获取 Token。不要直接运行 `get_token.py`，必须使用下方的受控入口；它会在 15:00 前拒绝启动，并在成功后保存不含 Token 的抓取时间记录。
- 用户提前发出正式请求：如果宿主支持当前任务定时唤醒，安排在当天 15:00 继续；否则保持任务运行并等待到 15:00。不要提前获取 Token。
- 流程测试：只有用户明确说“测试/模拟并在倒计时后停止”时，才允许提前获取 Token，并在倒计时出现后立即停止任务。

## 获取 Token

1. 正式预约运行以下命令。它是唯一允许的抓取入口，15:00 前会拒绝启动；Windows 可用 `PYTHON` 环境变量指定仓库提供的可执行文件。

```bash
node .agents/skills/reserve-hdu-badminton/scripts/acquire-token.mjs
```

   只有用户明确要求流程测试时，才运行 `node .agents/skills/reserve-hdu-badminton/scripts/acquire-token.mjs --test`。
2. 系统代理、证书或访问令牌操作触发宿主强制确认时，在操作发生前集中请求一次。不要增加宿主并未要求的重复确认，也不要尝试绕过安全确认。
3. 启动后使用本机桌面控制能力操作钉钉。完整路径和失败恢复见 [dingtalk-control.md](references/dingtalk-control.md)。
4. 等待 Token 工具成功退出；确认本地代理端口已关闭。Token 已被复制到系统剪贴板，不要在回复或日志中打印它。

## 写入运行配置

运行以下命令；按用户的优先级重复传入 `--slot`：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/prepare-config.mjs \
  --date YYYY-MM-DD \
  --slot HH:MM-HH:MM \
  --token-clipboard
```

若是用户明确要求的提前流程测试，加上 `--allow-expire-before-open`。正式预约会同时验证 Token 抓取记录为今天 15:00 后、且 Token 至少覆盖今天 20:05。脚本会合并项目档案、校验 Token 和时段，并以仅本人可读写权限生成 `reserve_script/config.json`。

## 启动并托管预约

正式任务使用后台托管器启动：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/task.mjs start
```

随后运行一次：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/task.mjs status
```

只有日志同时出现“服务器时间同步完成”和“距离 20:00:00”时，才向用户说明任务已成功创建。不要在此时结束自己的监控责任。

后台托管器会在 macOS 上使用 `caffeinate` 防止睡眠，并把状态与日志写入 `.badminton-reserve/`。用户可以去做别的事情；持续监控直到状态变成 `success`、`failed`、`cancelled` 或 `interrupted`，再报告最终结果。

查询状态：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/task.mjs status
```

停止测试或用户取消：

```bash
node .agents/skills/reserve-hdu-badminton/scripts/task.mjs stop
```

## 结果与恢复

- 成功：报告日期、时间、场地和订单号；绝不报告 Token。
- 失败：给出日志中的具体原因和是否仍可重试，不要笼统说“可能是网络问题”。
- Token 获取异常：确认代理已经恢复、18888 端口已经关闭，再重试一次。
- Agent 或对话重启：重新运行 `profile.mjs status` 和 `task.mjs status`，使用项目文件恢复上下文，不要求用户重复提供身份信息。
- 不要提交 `.badminton-reserve/`、`reserve_script/config.json`、Token、学号、姓名或手机号。
