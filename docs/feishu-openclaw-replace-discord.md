# 飞书 / OpenClaw 替换 Discord：可行性评估与部署实施方案

> 交付物：deep-interview 规格 `di-feishu-openclaw-20260814`（歧义度 11%，已通过）
> 范围：oh-my-codex（OmX）+ clawhip + Discord 工具链；oh-my-claudecode / oh-my-openagent 仅附注
> 环境：Windows（PowerShell 5.1），harness 为 OpenCode；omx 工作流层宿主于 Codex CLI
> 日期：2026-08-14

---

## 0. 双层理解（阅读本文的前提）

- **界面层替换（飞书）**：人类收发消息的 App 从 Discord 换成飞书。飞书是"聊天界面"，不是路由网关。
- **路由层替换（OpenClaw）**：OpenClaw 替换 clawhip 的"事件→渲染→送达"路由角色，并原生支持飞书渠道。OpenClaw 是本地网关进程，不是聊天 App。

两条路径独立可评估、独立可实施；**完整替换 = 路径 A（或 B 内嵌的飞书界面）+ 路径 B（OpenClaw 路由）**。

---

## 1. 结论速览

| 问题 | 结论 | 一句话理由 |
|---|---|---|
| **飞书能否替换 Discord？** | **能（界面层），单向开箱即用，双向有条件** | 自定义机器人 webhook 桥接即可把 omx/clawhip 的**出站通知**发到飞书群；但自定义机器人**无入站通道**，`@回复` 等双向交互需飞书自建应用 + 事件订阅（或直接走路径 B 的 OpenClaw） |
| **OpenClaw 能否替换 Discord？** | **按双层理解：能替换 clawhip 的路由层角色 + 原生提供飞书界面** | OpenClaw 不是聊天 App，不能"作为 App 替换 Discord"；它替换的是 **clawhip 的网关角色**，并内建 `@openclaw/feishu` 渠道插件让飞书成为界面层，补齐双向交互/流式卡片/文档工具 |

**决策建议**：
- 只要"任务完成 → 飞书群收到通知"：走 **路径 A**（30 分钟，桥接脚本 + 配置）。
- 需要"在飞书里 `@` 机器人提问、收到流式回复、命令机器人读文档/Bitable"：走 **路径 B**（OpenClaw 网关 + 飞书渠道），这也是唯一完整替换 clawhip 的路线。

---

## 2. 可行性评估

### 2.1 路径 A：飞书直桥（界面层替换，路由层不动）

**结论：可行（出站单向通知），但能力有缺口——双向交互（@回复/按钮/线程）、流式输出、文档工具均缺失。**

**证据**：
1. **两仓库均无飞书支持**：`grep -i "feishu\|lark"` 在 oh-my-codex 与 clawhip 源码中 **0 命中**（已实测）。omx 通知平台枚举为 `discord / discord-bot / telegram / slack / webhook`（`oh-my-codex/src/notifications/types.ts` `NotificationPlatform`）；clawhip sink 为 `discord / slack / localfile`（`clawhip/src/sink/mod.rs` + `clawhip/src/config.rs` `RouteRule`）。→ 必须靠"通用 webhook + 桥接"抵达飞书。
2. **omx 有通用 webhook 出口**：`notifications.webhook` 平台向任意 URL POST 结构化 JSON（`oh-my-codex/src/notifications/dispatcher.ts` 第 353–365 行：`{event, session_id, message, timestamp, tmux_session, project_name, ...}`）。桥接脚本只需提取 `.message` 并包装成飞书格式。
3. **omx 还有 CLI 出口（OpenClaw 门控下）**：`notifications.custom_cli_command` / `custom_webhook_command` 会被归一化为 OpenClaw 命令/HTTP 网关（`oh-my-codex/src/openclaw/config.ts` `normalizeFromCustomAliases`），但**仅当 `OMX_OPENCLAW=1` 时激活**（`config.ts` `activationGateEnabled`）。
4. **clawhip 的 webhook 字段是 Discord 格式透传**：`RouteRule.webhook` 被 `send_webhook()` 直接 POST `{"content": ...}`（`clawhip/src/discord.rs` 第 320–332 行），**不校验目标 host**，仅校验"channel/thread/webhook 三选一"（`clawhip/src/config.rs` 第 1005–1008 行）。→ 可将 `webhook` 指向本地代理做格式转换。
5. **clawhip 没有 `custom_webhook_command` / `custom_cli_command`**（源码 0 命中）。⚠️ 这是对 spec 约束"clawhip sink：…+ 通用网关别名"的**事实修正**：该别名是 **omx** 的配置键；clawhip 侧最接近的"路由到命令"机制是 `RouteRule.gajae = { subcommand, args }`（`clawhip/src/config.rs` `GajaeRouteAction`；`clawhip/README.md` gajae 示例）。
6. **飞书自定义机器人 webhook**（飞书开放平台官方文档，已查证）：`POST https://open.feishu.cn/open-apis/bot/v2/hook/{token}`，payload `{"msg_type":"text","content":{"text":"..."}}`。纯出站、文本、单条 ≤ 4KB，无签名时任何人可调用（生产建议开启"签名校验"）。

**能力缺口对比（Discord 通知端 vs 飞书自定义机器人桥 vs 飞书自建应用）**：

| 维度 | Discord（omx/clawhip 通知端现状） | 飞书自定义机器人（直桥） | 飞书自建应用（事件订阅） |
|---|---|---|---|
| 出站通知 | ✅ webhook / bot | ✅ text 消息（≤4KB/条） | ✅ 消息 API |
| @回复 | ✅ mention 字段；omx reply listener（bot+轮询） | ❌ 无入站通道 | ✅ 事件订阅 + 回复 API |
| 按钮/交互卡片 | ❌ 文本 only | ❌ 文本 only | ✅ 消息卡片 + 回调 |
| 线程 | ✅ clawhip `thread` ID | ❌ | ✅ |
| 群组策略 | 手动 channel 权限 | 机器人需被加入群 | 应用权限 + 群配置 |
| 流式输出 | ❌ | ❌ | ✅ 流式卡片（v2/v3 卡片） |
| 文档工具 | ❌ | ❌ | ✅ docx / wiki / drive / Bitable API |
| 维护成本 | 低 | 最低（webhook 即可） | 中（开放平台建应用 + 权限） |

### 2.2 路径 B：OpenClaw 网关（路由层替换 + 原生飞书界面）

**结论：可行，且是唯一能"完整替换 clawhip + Discord"的路径**——OpenClaw 原生支持飞书渠道（双向、流式卡片、文档工具），并与 omx 有官方定义的网关集成契约。

**证据**：
1. **omx 内建 OpenClaw 网关集成**：`OMX_OPENCLAW=1` 激活；配置位于 `~/.codex/.omx-config.json` 的 `notifications.openclaw`（`{enabled, gateways, hooks}`），或通用别名 `custom_webhook_command` / `custom_cli_command`；显式 `notifications.openclaw` 优先于别名（`oh-my-codex/src/openclaw/config.ts`；`docs/openclaw-integration.md` "Canonical precedence contract"）。配置文件路径可用 `OMX_OPENCLAW_CONFIG` 覆盖；`codexHome() = $CODEX_HOME || ~/.codex`（`oh-my-codex/src/utils/paths.ts` 第 14–15 行）。
2. **回执路由契约**：omx 发往网关的 payload 含 `channel / to / threadId` 字段（`oh-my-codex/src/openclaw/types.ts` `OpenClawPayload`），由 `OPENCLAW_REPLY_CHANNEL / OPENCLAW_REPLY_TARGET / OPENCLAW_REPLY_THREAD` 环境变量注入——这是"飞书群里 `@` 回复能回到正确会话"的对接点。
3. **OpenClaw 官方飞书支持**（OpenClaw 官方文档，已查证）：
   - `openclaw channels login --channel feishu`（交互式登录）
   - 官方插件 `@openclaw/feishu`：需 **OpenClaw ≥ 2026.5.29**
   - 飞书官方插件 `larksuite/openclaw-lark`：需 **OpenClaw ≥ 2026.2.26**
   - 渠道配置键 `channels.feishu`：`domain`（`feishu` / `lark`）、`connectionMode`（`websocket` 长连接 / `webhook` 事件回调）、`groupPolicy`（群聊应答策略）、`requireMention`（仅被 `@` 时响应）、流式卡片（streaming card）
   - 支持 bot 私聊/群聊、流式卡片、doc/wiki/drive/Bitable 工具
4. **omx→OpenClaw 的既有生产参考**：`docs/openclaw-integration.md` Option A（HTTP 网关 `http://127.0.0.1:18789/hooks/agent`）与 Option C（command 网关执行 agent 回合）均可直接复用，仅把"送达渠道"从 Discord 换成飞书。

**能力缺口对比（Discord 通知端 vs OpenClaw 网关）**：

| 维度 | Discord（omx/clawhip 通知端现状） | OpenClaw 网关（飞书渠道） |
|---|---|---|
| 双向人机交互 | 部分（omx reply listener 仅限 Discord bot） | ✅ 多渠道统一会话 + 回复路由 |
| @回复 / 提及 | ✅（Discord 语法） | ✅ requireMention + 渠道原生提及 |
| 按钮/交互卡片 | ❌ | ✅ 流式卡片 |
| 线程 | ✅ clawhip thread ID | ✅ 渠道线程模型 |
| 群组策略 | 手动 | ✅ groupPolicy（群聊应答策略） |
| 流式输出 | ❌ | ✅ streaming card |
| 文档工具 | ❌ | ✅ doc/wiki/drive/Bitable（飞书插件） |
| 渠道数量 | 1（Discord） | 29（含飞书/Telegram/Slack/Discord 等） |
| 路由层角色 | clawhip（Discord 专用 sink） | ✅ 通用网关（Coordinator MCP bridge） |
| 部署形态 | SaaS 通知端 | 本地网关进程（Node.js） |

---

## 3. 实施部分（Windows 实际部署级）

### 3.0 前置说明（两条路径通用）

- **omx 链需要 Codex CLI 已安装**（omx 是 Codex CLI 的工作流宿主层）。
- **配置文件位置**（Windows）：
  - omx：`%USERPROFILE%\.codex\.omx-config.json`（或 `$env:CODEX_HOME\.omx-config.json`，见 `oh-my-codex/src/utils/paths.ts`）
  - clawhip：`%USERPROFILE%\.clawhip\config.toml`（`clawhip/README.md`）
- **环境变量**：PowerShell 会话内 `$env:FEISHU_WEBHOOK_URL='...'`；永久 `setx FEISHU_WEBHOOK_URL "..."`（注意 setx 只对新开的进程生效）。
- **没有 jq**：文档中的 JSON 更新一律给 PowerShell 等价写法（`ConvertFrom-Json` / `ConvertTo-Json`）或直接改文件。
- **clawhip 的 tmux 源在 Windows 原生不可用**（tmux 是类 Unix 程序）；git / GitHub 源不受影响。tmux 相关事件路由若需保留，请在 WSL 中运行 clawhip。
- **编码**：PowerShell 5.1 的 `Invoke-RestMethod -Body "字符串"` 可能以非 UTF-8 发送中文，桥接脚本统一用 `[System.Text.Encoding]::UTF8.GetBytes(...)` 发送，避免飞书侧乱码。
- 本文档不执行任何安装/部署，以下均为用户可自行执行的步骤与配置。

---

### 3.1 路径 A：飞书替换界面层（不换路由层）

目标：`omx 通知 / clawhip 事件 → 飞书群`。保留 clawhip 路由层不变。

#### A.1 创建飞书自定义机器人

1. 飞书桌面端 → 目标群 → 设置 → **群机器人** → **添加机器人** → **自定义机器人**。
2. 填写名称（如 `omx-bot`），勾选安全设置（生产建议勾选"签名校验"并保存密钥）。
3. 复制 **Webhook 地址**：`https://open.feishu.cn/open-apis/bot/v2/hook/{token}`。
4. 保存：`setx FEISHU_WEBHOOK_URL "https://open.feishu.cn/open-apis/bot/v2/hook/你的token"`

#### A.2 冒烟测试（PowerShell）

```powershell
$body = @{ msg_type = "text"; content = @{ text = "omx 飞书桥接测试 $(Get-Date)" } } |
  ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri $env:FEISHU_WEBHOOK_URL `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
# 返回 {"StatusCode":0,"StatusMessage":"success"} 即通过
```

#### A.3 omx 通知 → 飞书（两条子路径，任选其一）

**子路径 A-3-1（推荐，免常驻服务）：`custom_cli_command` 别名 + 桥接脚本**

> ⚠️ 事实前提：omx 的 `custom_cli_command` / `custom_webhook_command` 属于 OpenClaw 子系统，**必须 `OMX_OPENCLAW=1` 才激活**（`oh-my-codex/src/openclaw/config.ts` `activationGateEnabled`）。设置该变量**不要求** OpenClaw 进程运行——只是把别名归一化为命令/HTTP 网关执行。

1) 桥接脚本 `%USERPROFILE%\scripts\feishu-notify.ps1`：

```powershell
# feishu-notify.ps1 — omx 事件 -> 飞书自定义机器人
param(
  [string]$Event,
  [string]$Text,
  [string]$Webhook = $env:FEISHU_WEBHOOK_URL
)
if (-not $Webhook) { throw "缺少 FEISHU_WEBHOOK_URL" }
if (-not $Event)   { $Event = "unknown" }

$text = "[omx:$Event] $Text"
if ($text.Length -gt 4000) { $text = $text.Substring(0, 4000) }  # 飞书 text 上限 4KB

$body = @{ msg_type = "text"; content = @{ text = $text } } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method Post -Uri $Webhook `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
```

2) 激活门控 + 配置 `%USERPROFILE%\.codex\.omx-config.json`：

```powershell
setx OMX_OPENCLAW 1
```

```json
{
  "notifications": {
    "enabled": true,
    "verbosity": "session",
    "custom_cli_command": {
      "enabled": true,
      "command": "powershell -NoProfile -ExecutionPolicy Bypass -File \"%USERPROFILE%\\scripts\\feishu-notify.ps1\" -Event \"{{event}}\" -Text \"{{instruction}}\"",
      "timeout": 20000,
      "events": ["session-start", "session-end", "session-idle", "ask-user-question"],
      "instruction": "OMX {{event}} @ {{projectName}}"
    }
  }
}
```

> schema 依据：`custom_cli_command` 的 `enabled/command/timeout/events/instruction` 字段见 `oh-my-codex/src/notifications/types.ts` `CustomCliCommandConfig` + `oh-my-codex/src/openclaw/config.ts` `normalizeFromCustomAliases`；`events` 合法值仅 `session-start / session-end / session-idle / ask-user-question / stop`（`oh-my-codex/src/openclaw/config.ts` `VALID_HOOK_EVENTS`）。

3) 验证：运行一次任意 omx 会话，飞书群应收到 `[omx:session-end] ...`。

**子路径 A-3-2（保持 webhook 形态）：`notifications.webhook` + 本地桥接服务**

omx 通用 webhook 平台向任意 URL POST 全量 payload（`dispatcher.ts` 第 353–365 行），需要一个常驻本地服务做格式转换：

1) 桥接服务 `%USERPROFILE%\scripts\feishu-bridge.ps1`（基于 .NET HttpListener，**无需任何第三方依赖**）：

```powershell
# feishu-bridge.ps1 — 本地 HTTP 桥：接收 omx webhook payload -> 转发飞书
param(
  [string]$ListenUrl    = "http://127.0.0.1:8765/",
  [string]$FeishuWebhook = $env:FEISHU_WEBHOOK_URL
)
if (-not $FeishuWebhook) { throw "缺少 FEISHU_WEBHOOK_URL" }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($ListenUrl)
$listener.Start()
Write-Host "桥接服务: $ListenUrl -> 飞书 (Ctrl+C 停止)"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $reader = New-Object System.IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
    $raw    = $reader.ReadToEnd()
    $p      = $raw | ConvertFrom-Json
    $text   = "[omx:$($p.event)] $($p.message)"
    if ($p.tmux_session) { $text += "`n[tmux] $($p.tmux_session)" }
    if ($p.question)     { $text += "`n[question] $($p.question)" }
    if ($text.Length -gt 4000) { $text = $text.Substring(0, 4000) }

    $body = @{ msg_type = "text"; content = @{ text = $text } } | ConvertTo-Json -Depth 4
    Invoke-RestMethod -Method Post -Uri $FeishuWebhook `
      -ContentType "application/json; charset=utf-8" `
      -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) | Out-Null
    $ctx.Response.StatusCode = 200
  } catch {
    $ctx.Response.StatusCode = 502
    Write-Warning $_.Exception.Message
  }
  $ctx.Response.Close()
}
```

2) **Windows 注意**：HttpListener 监听非管理员端口需先注册 URL ACL（管理员 PowerShell）：

```powershell
netsh http add urlacl url=http://127.0.0.1:8765/ user=Everyone
```

3) 启动服务（建议用计划任务开机自启），配置 `notifications.webhook`：

```json
{
  "notifications": {
    "enabled": true,
    "verbosity": "session",
    "webhook": {
      "enabled": true,
      "url": "http://127.0.0.1:8765/",
      "method": "POST"
    }
  }
}
```

> `notifications.webhook` 字段见 `oh-my-codex/src/notifications/types.ts` `WebhookNotificationConfig`（`enabled/url/headers/method`）。

#### A.4 clawhip 路由 → 飞书（保持路由层）

clawhip 没有飞书 sink，也没有 `custom_webhook_command`。两条真实可行的出路：

**子路径 A-4-1（推荐）：webhook 指向本地代理（复用 A.3 的桥接服务）**

clawhip 的 `RouteRule.webhook` 会被 `send_webhook()` 直接 POST `{"content": "..."}`（`clawhip/src/discord.rs` 第 320–332 行），不校验 host。让桥接服务同时挂一个 `/discord2feishu` 端点做格式转换即可（在 A.3-2 的脚本里加一段：当请求路径含 `discord2feishu` 时，取 `.content` 作为文本，其余逻辑相同）。

`%USERPROFILE%\.clawhip\config.toml`：

```toml
# 事件 -> 本地代理 -> 飞书（sink 保持 "discord" 以复用 webhook 字段透传）
[[routes]]
event = "tmux.keyword"
sink = "discord"
webhook = "http://127.0.0.1:8765/discord2feishu"
format = "compact"

[[routes]]
event = "github.pr-status-changed"
filter = { repo = "my-app" }
sink = "discord"
webhook = "http://127.0.0.1:8765/discord2feishu"
format = "compact"

# 说明：clawhip 会对 webhook URL 追加 ?wait=true 并期望 2xx + JSON 响应（src/discord.rs webhook_url_with_wait）
# 代理返回 {"id":"local-ok"} + 200 即可
```

> 路由字段依据：`clawhip/src/config.rs` `RouteRule`（`event/filter/sink/channel/thread/webhook/slack_webhook/local_path/mention/format/template`）；webhook 免 bot token 依据 `clawhip/README.md` "Discord webhook setup"（`clawhip setup --webhook "https://..."` 与 `[[routes]] event="tmux.keyword" webhook="..."` 示例）。

**子路径 A-4-2（最稳，无本地服务）：localfile sink + 定时转发**

```toml
[[routes]]
event = "tmux.keyword"
sink = "localfile"
local_path = "%USERPROFILE%\\.clawhip\\out\\feishu.log"
```

再用计划任务每分钟把新增行经 `feishu-notify.ps1` 转发。代价是延迟与去重逻辑，适合低频事件。

**关于 `gajae`**：clawhip 路由支持 `gajae = { subcommand = "...", args = [...] }`（`clawhip/src/config.rs` `GajaeRouteAction`；README gajae 示例）——这是 clawhip 侧"路由到自定义命令"的原生机制，若你已有 clawhip gajae handler，可在 handler 内调 `feishu-notify.ps1`。此处不展开（handler 需按 clawhip 插件契约编写）。

#### A.5 双向交互（可选增强，超出"直桥"范围）

自定义机器人 webhook 无入站能力。若需要在飞书里 `@` 机器人、收回复/卡片/流式输出，需在飞书开放平台创建**自建应用**（获取 `App ID / App Secret`），开启事件订阅（长连接或 HTTPS 回调）+ 机器人能力 + 相应权限（im:message、im:message.group_at_msg 等），自行实现事件循环与回复 API。**这与路径 B 的 OpenClaw 网关重叠——建议直接走 3.2**，避免重复造轮子。

---

### 3.2 路径 B：OpenClaw 替换路由层 + 接飞书

目标：`omx 事件 → OpenClaw 网关 → 飞书渠道（双向、流式、文档工具）`；clawhip 退居可选。

> OpenClaw 侧事实（OpenClaw 官方文档，已查证）：`openclaw channels login --channel feishu`；官方插件 `@openclaw/feishu` 需 **OpenClaw ≥ 2026.5.29**；飞书官方插件 `larksuite/openclaw-lark` 需 **OpenClaw ≥ 2026.2.26**。以下命令形态以官方文档为准，版本已满足要求。

#### B.1 安装 OpenClaw（Windows）

```powershell
# 按 OpenClaw 官方安装文档执行（Node.js 环境）：
npm install -g openclaw
openclaw --version        # 必须 >= 2026.5.29（使用 @openclaw/feishu 时）
```

#### B.2 安装飞书渠道插件（二选一）

```powershell
# 官方插件（推荐）
openclaw plugins install @openclaw/feishu
# 或飞书官方插件
openclaw plugins install larksuite/openclaw-lark
```

#### B.3 登录飞书渠道

```powershell
openclaw channels login --channel feishu
# 交互式输入飞书开放平台自建应用的 App ID / App Secret
# （先到 https://open.feishu.cn 创建企业自建应用，开启"机器人"能力，发布版本）
```

#### B.4 `channels.feishu` 配置要点

OpenClaw 配置中的飞书渠道块（示例，具体键值以 OpenClaw 官方渠道文档为准）：

```toml
[channels.feishu]
# 环境：国际版用 "lark"，中国版用 "feishu"
domain = "feishu"

# 连接模式：长连接（内网友好，无需公网回调）vs 事件回调（需公网 HTTPS）
connectionMode = "websocket"   # websocket | webhook

# 群聊应答策略：是否响应群消息、哪些群响应（按官方枚举取值）
groupPolicy = "mention"        # 例如：仅被 @ 时响应群消息

# 仅当消息 @ 机器人时才响应（强烈建议开启，降低群聊噪音与误触发）
requireMention = true

# 流式输出：长回复以流式卡片逐段上屏
streamingCard = true
```

**Windows 注意**：
- `connectionMode = "websocket"`（长连接）是内网/家用网络的首选；`webhook` 事件回调需要**公网 HTTPS 地址**（Windows 内网需自建内网穿透，如 frp/ngrok，且需在飞书开放平台配置事件订阅 URL 与加密校验）。
- 登录与插件安装后的凭据存于 OpenClaw 本地配置目录（`~/.openclaw/`），勿提交到仓库。

#### B.5 与 oh-my-codex 的 OpenClaw 网关集成

1) 激活门控（PowerShell）：

```powershell
setx OMX_OPENCLAW 1
# 若使用 command 网关（Option C 形态）再加：
setx OMX_OPENCLAW_COMMAND 1
```

2) `%USERPROFILE%\.codex\.omx-config.json` —— HTTP 网关形态（对应 `docs/openclaw-integration.md` Option A）：

```json
{
  "notifications": {
    "enabled": true,
    "verbosity": "session",
    "openclaw": {
      "enabled": true,
      "gateways": {
        "local": {
          "type": "http",
          "url": "http://127.0.0.1:18789/hooks/agent",
          "headers": { "Authorization": "Bearer ${HOOKS_TOKEN}" }
        }
      },
      "hooks": {
        "session-end": {
          "enabled": true,
          "gateway": "local",
          "instruction": "[session-end]\nproject={{projectName}} session={{sessionId}} tmux={{tmuxSession}} reason={{reason}}\n请把结果发送到飞书会话"
        },
        "ask-user-question": {
          "enabled": true,
          "gateway": "local",
          "instruction": "[ask-user-question]\nsession={{sessionId}} question={{question}}\n等待飞书用户输入后继续"
        },
        "session-idle": {
          "enabled": true,
          "gateway": "local",
          "instruction": "[session-idle]\nsession={{sessionId}} tmux={{tmuxSession}}"
        }
      }
    }
  }
}
```

3) **回执路由**（让 OpenClaw 知道把回复送回哪个飞书会话）：OpenClaw 渠道会话 ID 经环境变量注入 payload 的 `channel / to / threadId` 字段（`oh-my-codex/src/openclaw/types.ts` `OpenClawPayload` + `OpenClawContext`：`OPENCLAW_REPLY_CHANNEL / OPENCLAW_REPLY_TARGET / OPENCLAW_REPLY_THREAD`）。在运行 omx 的会话中设置：

```powershell
$env:OPENCLAW_REPLY_CHANNEL = "feishu"
$env:OPENCLAW_REPLY_TARGET  = "oc:飞书群/单聊ID"   # 飞书 open_chat_id / open_id
$env:OPENCLAW_REPLY_THREAD  = "om_线程ID(可选)"
```

> OpenClaw 侧 `/hooks/agent` 收到 `channel/to/threadId` 后按其官方 hook 文档路由到对应飞书会话；`requireMention=true` 时，用户在群里 `@机器人` 的提问同样经渠道事件进入 OpenClaw 协调层形成新的 agent 回合。

4) **command 网关形态**（可选，OmX 文档 Option C 的同构改法）：把 `gateways.local.type` 改为 `"command"`，`command` 指向 OpenClaw CLI 触发一次 agent 回合，`timeout` 建议 120000，命令末尾加 `|| true` 防阻塞（依据 `docs/openclaw-integration.md` Option C 生产建议）。

#### B.6 验证（来自 `docs/openclaw-integration.md` "Verification"）

```powershell
# A) wake 冒烟
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/hooks/wake" `
  -Headers @{ Authorization = "Bearer $env:HOOKS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"text":"OMX wake smoke test","mode":"now"}'
# 期望 {"ok":true}

# B) 送达验证
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18789/hooks/agent" `
  -Headers @{ Authorization = "Bearer $env:HOOKS_TOKEN" } `
  -ContentType "application/json" `
  -Body '{"message":"delivery check","instruction":"delivery check","event":"session-end","sessionId":"manual-check"}'
# 期望 HTTP 2xx，飞书群收到机器人消息
```

#### B.7 clawhip 的去留建议

| 阶段 | 动作 |
|---|---|
| 过渡期（1–2 周） | **并行运行**：clawhip 继续承担 git/GitHub 源监视 → 经 A.4 桥接发飞书；OpenClaw 承担飞书渠道双向会话与 omx 回执循环。两者互不干扰 |
| 稳定后 | **移除 clawhip 的 discord/聊天类路由**（Discord 专用能力 thread/mention/verify-bindings 在飞书上无对应，无需保留）；若 omx→OpenClaw hook 全部验证通过，clawhip 可整体停用，其 git/GitHub 监视需求迁移到 OpenClaw cron/渠道或保留 clawhip 仅作监视器 |
| 最终形态 | `Codex CLI ←(omx hooks)→ OpenClaw(网关) ←(feishu 渠道)→ 飞书`，clawhip 仅作可选 git/GitHub 事件源 |

---

## 4. 能力缺口对比表（综合）

**Discord vs 飞书（作为 omx/clawhip 通知端）vs OpenClaw 网关**

| 维度 | Discord（omx/clawhip 通知端） | 飞书自定义机器人（直桥） | 飞书自建应用 | OpenClaw 网关（飞书渠道） |
|---|---|---|---|---|
| 出站通知 | ✅ webhook/bot | ✅ text（≤4KB/条） | ✅ | ✅ |
| 双向交互（@回复） | ⚠️ 仅 omx reply listener（bot+轮询，限 Discord） | ❌ | ✅ | ✅ |
| 按钮/交互卡片 | ❌ | ❌ | ✅ | ✅ 流式卡片 |
| 线程 | ✅ clawhip `thread` | ❌ | ✅ | ✅ |
| 群组策略 | 手动权限 | 机器人入群即收 | 应用权限 | ✅ `groupPolicy` |
| 群聊防误触 | — | — | — | ✅ `requireMention` |
| 流式输出 | ❌ | ❌ | ✅ 流式卡片 | ✅ streamingCard |
| 文档工具（doc/wiki/drive/Bitable） | ❌ | ❌ | ✅（API 自接） | ✅（插件内置） |
| 路由层能力 | clawhip（Discord 专用 sink） | 无（纯通道） | 无（纯通道） | ✅ 29 渠道 + Coordinator MCP bridge |
| 原生飞书支持（两仓库 0 命中） | ❌ | 需桥接 | 需自建 | ✅ 官方插件 |
| 部署形态 | SaaS 通知端 | SaaS webhook | SaaS 应用 | 本地网关进程（Node.js） |
| 相对复杂度 | 基准 | 低（脚本桥接） | 中（应用+事件订阅） | 中高（网关+渠道+hook 契约） |

**结论**：直桥满足"单向通知"场景（覆盖率约 60% 的日常需求）；一旦需要双向交互、流式、文档工具，唯一完整解是 OpenClaw 网关 + 飞书渠道。

---

## 5. 附注（其他工具链的对应能力，一行带过）

- **oh-my-claudecode（OMC）**：`configure-notifications` 支持 Discord / Telegram / Slack / 通用 webhook（`C:\Users\alphazz\.claude\CLAUDE.md` hooks 章节），无飞书原生支持——如需飞书，可把 webhook 同样指向 A.3/A.4 的桥接服务，或复用 OpenClaw 网关形态。
- **oh-my-openagent（OmO）**：通知模式与 omx 同构（webhook / 渠道别名），无飞书原生支持，桥接方式同上。
- **通用提醒**：若日后把 omx 链换成 OMC@OpenCode 宿主，本方案的"webhook 桥接 → 飞书"与"OpenClaw 网关 → 飞书"两条路径完全复用，只需把配置文件从 `~/.codex/.omx-config.json` 换成对应 harness 的 hooks 配置。

---

## 6. 引用清单

**克隆仓库（本文事实来源，路径为本地 clone）**：
- `oh-my-codex/src/notifications/types.ts` — 通知平台枚举、`FullNotificationConfig`、`custom_webhook_command`/`custom_cli_command` 别名、reply 配置
- `oh-my-codex/src/notifications/dispatcher.ts`（第 353–365 行）— 通用 webhook payload 结构
- `oh-my-codex/src/openclaw/config.ts` — `OMX_OPENCLAW=1` 激活门控、别名归一化、`notifications.openclaw` 优先权
- `oh-my-codex/src/openclaw/types.ts` — `OpenClawConfig`  schema、`OpenClawPayload.channel/to/threadId`、`OPENCLAW_REPLY_*` 环境变量
- `oh-my-codex/docs/openclaw-integration.md` — Option A/B/C 配置、激活门控、验证流程、生产建议
- `oh-my-codex/docs/discord-integration.md` — webhook / bot / reply listener 三模式
- `oh-my-codex/src/utils/paths.ts`（第 14–15 行）— `codexHome()` = `$CODEX_HOME || ~/.codex`
- `clawhip/src/config.rs` — `AppConfig`、`RouteRule`（含 `webhook/slack_webhook/local_path/gajae`）、webhook 目标三选一校验
- `clawhip/src/discord.rs`（第 320–332 行）— `send_webhook` 透传 `{"content":...}` 且不校验 host；`?wait=true`
- `clawhip/README.md` — 路由示例、webhook 免 token 快速开始、sources→queue→dispatcher→router→render→sink 流水线
- `clawhip/ARCHITECTURE.md` — typed event model、sink/render 分离
- `clawhip/integrations/omx/README.md` — `clawhip native hook --provider codex` 入站说明

**官方文档（已查证事实，未在本机复现）**：
- 飞书开放平台 — 自定义机器人 webhook：`https://open.feishu.cn/open-apis/bot/v2/hook/{token}`，text payload `{"msg_type":"text","content":{"text":"..."}}`
- OpenClaw 官方文档 — `openclaw channels login --channel feishu`；`@openclaw/feishu`（需 ≥ 2026.5.29）；`larksuite/openclaw-lark`（需 ≥ 2026.2.26）；`channels.feishu`（`domain`/`connectionMode`/`groupPolicy`/`requireMention`/流式卡片）
