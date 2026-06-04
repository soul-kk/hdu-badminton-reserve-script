# 场地预约 Token 一键获取工具

普通用户只需运行一条命令，脚本自动完成代理配置、流量拦截、Token 提取，全程无需手动操作。

## 目录结构

```
get_token/
├── get_token.sh     # 主脚本（用户运行这个）
├── extractor.py     # mitmproxy addon（自动调用，无需关心）
└── .token           # 临时文件（自动生成）
```

运行后会在脚本同目录生成 `.env`：

```
SPORT_TOKEN=eyJhbGci...
```

---

## 使用方法

### 第一步：安装 mitmproxy（只需一次）

```bash
pip install mitmproxy
```

### 第二步：运行脚本

```bash
bash get_token.sh
```

脚本会自动：
1. 设置系统网络代理
2. 安装 mitmproxy CA 证书（首次需要输入 sudo 密码）
3. 启动流量拦截
4. 提示你打开钉钉

### 第三步：打开钉钉

按照脚本提示：
1. 打开钉钉
2. 进入「场馆速约」应用
3. 随便点击一下

脚本检测到 Token 后会自动：
- 停止代理
- 恢复网络
- 播放提示音
- 将 Token 写入 `.env`

---

## 首次使用：证书说明

第一次运行时需要安装 mitmproxy 的 CA 证书，脚本会自动完成，需要你：

- 输入一次 **sudo 密码**（用于安装证书到系统钥匙串）
- 在弹出的钥匙串提示中点击「始终信任」

之后不再需要重复操作。

---

## Token 过期了怎么办？

直接再运行一次 `bash get_token.sh`，脚本会自动覆盖 `.env` 里的旧 Token。

---

## 常见问题

**代理设置失败**
> 脚本默认操作 Wi-Fi 网卡，如果你用的是其他网络接口（如 USB 网络共享），需要修改 `get_token.sh` 里的 `networksetup` 命令，把 `"Wi-Fi"` 改成对应接口名。

**60 秒内没捕获到 Token**
> 确认打开了「场馆速约」并触发了网络请求（点击刷新或切换日期），再重新运行脚本。

**网络突然断了**
> 如果脚本意外中断（如强制关闭终端），代理可能没有恢复。手动关闭：
> ```bash
> networksetup -setwebproxystate "Wi-Fi" off
> networksetup -setsecurewebproxystate "Wi-Fi" off
> ```
