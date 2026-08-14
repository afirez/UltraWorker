# 飞书直桥替换 Discord（不通过 OpenClaw）：部署实施方案

> 交付物：deep-interview 规格 `di-feishu-direct-20260814`（歧义度 13%，已通过，见 `.omc/specs/deep-interview-feishu-direct.md`）
> v2 对齐（2026-08-14）：deep-interview 规格 `di-align-discord-usage-20260814`（歧义度 16%，已通过，见 `.omc/specs/deep-interview-discord-align.md`）——指令处理对齐 omx/clawhip 源码揭示的 Discord 真实使用模式（**白名单全注入/免前缀/`!` 可选标记/运行中会话优先/exec 回退/非白名单默认忽略**），详见 §2
> 范围：oh-my-codex（OMX，宿主 Codex CLI）+ clawhip + 飞书（替换 Discord）；**不涉及 OpenClaw 任何方案**
> 交互：**双向**（飞书 → agent 指令注入；agent 状态 → 飞书推送），对齐 Discord 能力
> 基础代码：https://github.com/afirez/clawhip-feishu （2026-08-07 核实，JavaScript 10 文件），本次在其 `feishu-bridge.mjs` 上改造
> 环境：Windows（PowerShell 5.1）；Node ≥ 20.6（`--env-file`）；已验证本机 codex-cli 0.147.0 / oh-my-codex v0.20.3 / Node v25.6.0
> 日期：2026-08-14
> 交付文件：本文档 + `bridge/` 目录（`feishu-bridge.mjs`、`package.json`、`.env.example`、`clawhip.config.example.toml`）

---

## 1. 结论速览

| 问题 | 结论 | 一句话理由 |
|---|---|---|
| **不通过 OpenClaw，飞书能否直桥替换 Discord？** | **能（双向）** | 接收方向：飞书自建应用 + 事件订阅（websocket 长连接）→ 自建 Node 桥（`feishu-bridge.mjs`）→ **白名单全注入**（免前缀；`!` 可选标记）→ 调 `codex exec` / `omx exec` 执行（`deliver` 优先注入运行中 tmux 会话、回退 exec）→ 结果回推飞书；发送方向：**复用 clawhip 路由**（`RouteRule.slack_webhook` 指向桥）把 agent 生命周期事件推到飞书 |
| **指令注入走什么？** | `codex exec --skip-git-repo-check -C <目录> "<指令>"`（默认）或 `omx exec …`；`INJECT_MODE=deliver` 时**优先注入运行中 tmux 会话**、失败自动**回退 exec** | 桥按 `INJECT_MODE` 选择，deliver 带 exec 回退（`INJECT_FALLBACK_MODE`）；白名单用户**免 `!` 前缀全注入**；Windows 下自动解析 npm shim 用 `node <js>` 直调（已实测 `shell:false` 可跑） |
| **结果怎么回？** | 默认**回复原消息**（`im/v1/messages/:message_id/reply`），可切「发到群」 | 回复 = 飞书的话题回帖语义，对齐 Discord 回复/线程观感 |
| **Agent 状态推送怎么到飞书？** | clawhip 多投递路由：`session.*`/`tmux.*`/`github.*`/`custom.*` → `slack_webhook = http://127.0.0.1:8787/feishu` → 桥转飞书消息 API | 与 Discord 时代同一套 clawhip 事件管线，只换 sink 目标 |
| **omx 自带的 notifications.webhook 能否直连桥？** | **不能（默认配置下）** | omx `sendWebhook` 强制 `https:` URL（`oh-my-codex/src/notifications/dispatcher.ts:100-107,336-341`）；本地 `http://127.0.0.1` 会被拒。**通知统一走 clawhip 路由出口**（推荐），或把桥挂到 HTTPS 后使用 |
| **能力对齐程度** | 指令/推送/回复/进群策略/富文本 ✅ 或 🔧；线程 ⚠️ 部分；按钮交互 ❌ | 详见 §2 源码对齐、§3 能力对齐检查表 |

**决策建议**：只需「任务完成 → 飞书群通知」→ 现有 clawhip 路由把 `slack_webhook` 指向桥即可（30 分钟）；需要「飞书里发指令给 agent 并收到结果」→ 部署本桥（`bridge/` 全部文件 + 飞书自建应用 + 配置），两条都在本文范围内。

---

## 2. 源码对齐：真实模式 vs 桥现状（v2 规格 di-align-discord-usage-20260814）

> 本桥的**指令处理**与 omx / clawhip **源码**揭示的 Discord 真实使用模式对齐。omx/clawhip 仓库仅作**只读基准**，零改动；全部对齐在飞书桥内实现（`feishu-bridge.mjs` + 环境变量）。

### 2.1 源码对齐基准（已取证，只读引用）

| 机制 | 源码证据 | 真实模式（Discord） |
|---|---|---|
| omx Reply Listener | `oh-my-codex/src/notifications/reply-listener.ts`（Reply Listener Daemon：轮询 Discord/Telegram 回复，清洗输入，`sendToPane()` 注入**运行中** agent 会话；**授权 = 配置用户 ID 白名单**） | 授权用户的消息/回复 → 注入「已运行」会话；**无前缀过滤** |
| omx 通知发送 | `oh-my-codex/src/notifications/index.ts`（notifyLifecycle → Discord/Telegram/Slack/webhook） | agent 状态推送出站（桥 Sink 已覆盖，§4） |
| clawhip deliver | `clawhip/src/hooks/prompt_deliver.rs`（向 tmux 会话注入 prompt 按键；`PROMPT_CHARS=['$','%','>','#',...]` 仅用于 prompt 态检测） | 通用 **tmux 会话注入**（运行中会话） |
| clawhip discord watch | `clawhip/src/discord_watch.rs`（Discord 消息 → `discord-watch.nudge-intent` local-only 持久化，不进通用路由） | 接收侧旁路提醒（桥不复制此旁路；指令注入走白名单全注入） |

### 2.2 桥现状 vs 真实模式的差异与对齐

| # | 关键差异（桥 v1 现状） | 源码真实模式 | 桥 v2 改造后（本规格） |
|---|---|---|---|
| ① | `!` 前缀**强制门控**：非 `!` 消息只 POST /event，不注入 | **无前缀过滤**：授权用户消息/回复直接注入 | 白名单用户**全注入（免前缀）**，含 omx `$关键词`；`!` 变为**可选**显式指令标记（`!` 开头 = 强制按指令处理，仅对白名单用户生效） |
| ② | 指令**新开 exec 会话**（codex/omx exec） | 注入**运行中**会话（reply-listener `sendToPane` / clawhip deliver tmux） | `INJECT_MODE=deliver` 时**优先注入运行中 tmux 会话**，deliver 不可用（无运行中会话等）时**回退 exec**（`INJECT_FALLBACK_MODE=codex|omx`）；`codex|omx` 模式维持直接 exec |
| ③ | **无用户白名单**（任何能发消息的人都可触发指令） | **授权白名单**（配置用户 ID 白名单） | `FEISHU_ALLOWED_OPEN_IDS` 白名单；非白名单用户消息**默认忽略**（`FEISHU_FORWARD_NON_WHITELIST=1` 可保留 POST /event 普通事件，不注入） |

### 2.3 行为对照清单（每个对齐点均可核验）

| 对齐点 | 状态 | 桥内可核验位置 | 文档依据 |
|---|---|---|---|
| 无前缀注入（免 `!`） | ✅ | handler：无 `COMMAND_PREFIX` 前缀时 prompt = 整条文本 → `runExec()` | §2.2 ① / §3 #1 / §6.2 |
| 白名单（`FEISHU_ALLOWED_OPEN_IDS`） | ✅ | `ALLOWED_OPEN_IDS` 集合判定；**空 = 全部放行**（向后兼容默认） | §2.2 ③ / §6.2 / §8 |
| 运行中会话优先（deliver） | ✅ | `runExec()`：`INJECT_MODE=deliver` → `deliverToSession()` 优先 | §2.2 ② / §6.2 / §8 |
| exec 回退 | ✅ | `deliverToSession()` 返回 `{ok:false}` → `execPrompt(prompt, INJECT_FALLBACK_MODE)` | §2.2 ② / §6.2 / §8 |
| 非白名单默认忽略 | ✅ | handler：非白名单 → 默认直接 `return`（无事件、无注入） | §2.2 ③ / §6.2 / §8 |
| `!` 可选显式标记 | ✅ | `explicitCommand = text.startsWith(COMMAND_PREFIX)`；仅白名单用户生效 | §2.2 ① / §6.2 |

---

## 3. 能力对齐检查表（核心验收项）

> 图例：✅原生支持（飞书平台原生能力）｜🔧桥接实现（本方案 `feishu-bridge.mjs` 实现）｜⚠️部分（有等价但有差异）｜❌不支持（本方案范围外）

| # | Discord 场景 | 飞书方案实现方式 | 支持度 | 说明与出处 |
|---|---|---|---|---|
| 1 | **发指令给 agent**（如 `!继续处理当前任务`、`@bot 总结一下进度`，或白名单用户直接发 `继续处理当前任务`） | 飞书长连接收到 `im.message.receive_v1` → **白名单全注入**：`FEISHU_ALLOWED_OPEN_IDS` 内用户的所有消息默认注入 agent（含 omx `$关键词`，**免 `!` 前缀**）；`!` 前缀为**可选显式指令标记**（强制按指令处理）→ 注入目标**优先运行中 tmux 会话**（`INJECT_MODE=deliver`），deliver 不可用时**回退 exec**（codex/omx，`INJECT_FALLBACK_MODE`）；非白名单默认忽略（`FEISHU_FORWARD_NON_WHITELIST=1` 可配转发普通事件） | 🔧桥接实现 | 桥 `runExec()`/`deliverToSession()`/`execPrompt()` 与 `ALLOWED_OPEN_IDS` 判定；对齐 omx reply-listener 授权/免前缀/运行中会话模式（§2）；SDK `WSClient` 长连接（事件注册 `im.message.receive_v1`，SDK `types/index.d.ts:55853`） |
| 2 | **收状态推送**（SessionStart/Stop/提问/失败 → 群通知） | Codex 五事件钩子 → clawhip native hook（`clawhip hooks install`）→ `session.*` 等事件 → `RouteRule.slack_webhook` → 桥 sink → 飞书消息 API | ✅原生支持（复用 clawhip 管线） | clawhip 多投递路由；桥 sink 兼容 Slack 载荷 `{"text":…}`（`clawhip/src/slack.rs webhook_payload`） |
| 3 | **@回复**（`@` 机器人提问/被 `@` 才应答） | 入站：`MENTION_REQUIRED=1` 时仅处理 `message.mentions` 非空的消息（`receive_v1` 事件自带 `mentions`）；出站：结果用 `im/v1/messages/:message_id/reply` **回复原消息** | ⚠️部分 | 入站 @检测 ✅；出站「@ 回发送者」需通讯录 API 取名字，未内置（见 §9 扩展）。回复本身已形成「针对那条消息」的话题回帖，观感等价 |
| 4 | **线程**（Discord thread 里继续对话） | `FEISHU_RESULT_MODE=reply`：每条指令的结果都回复到原消息下，形成话题式父子结构（事件带 `root_id`/`parent_id`） | ⚠️部分 | clawhip `RouteRule.thread`（Discord 专属，`config.rs:190-191`）无飞书等价物；飞书用「回复」近似线程。跨轮上下文仍需在工作目录里持久化（OMX 会话天然如此） |
| 5 | **进群策略**（谁的消息能指挥 agent） | 飞书侧：应用权限范围 + 机器人拉进哪些群 + `im:message.group_at_msg`（仅 @）/ `im:message.group_msg`（全部）控制能收到什么；桥侧：`MENTION_REQUIRED` + `FEISHU_ALLOWED_OPEN_IDS` 白名单（`COMMAND_PREFIX` 变可选标记） | ✅原生支持 | 权限控制是飞书平台能力；白名单在桥内过滤（安全注意见 §9） |
| 6 | **富文本卡片**（状态卡片/结果排版） | `FEISHU_MSG_TYPE=interactive`：结果以 `msg_type=interactive` 消息卡片（header + lark_md div）推送 | 🔧桥接实现 | 桥 `buildCard()`；标准消息卡片 schema（`content` 为卡片 JSON 字符串）。lark_md 支持 markdown 子集，非 Discord embeds 全量 |
| 7 | **按钮/交互回调** | 无 | ❌不支持 | 本方案桥是「文本指令 → 执行 → 文本/卡片结果」；飞书卡片按钮回调需另建 card action 回调服务（范围外，见 §9 扩展） |
| 8 | **私聊（DM）** | 机器人支持单聊；`im.message.receive_v1` 的 `chat_type=p2p` 消息同样进入桥，回复模式照常 | ✅原生支持 | 私聊无需任何群权限；`im:message` 单聊消息权限即可 |
| 9 | **消息去重 / 回声防护** | 桥内按 `message_id` 去重（长连接 at-least-once 重投）+ `sender_type === "app"` 过滤机器人自身消息 | ✅原生支持（桥内实现） | 原版 `feishu-bridge.mjs` 保留逻辑 |
| 10 | **审计**（谁发了什么指令） | 白名单用户消息/指令 → `POST clawhip /event`（`!` 指令记 `feishu.command`；免前缀注入记 `feishu.message`（`injected:true`））；非白名单默认不审计（`FEISHU_FORWARD_NON_WHITELIST=1` 时记 `feishu.message`（`whitelisted:false`））→ 落 `localfile` JSONL | ✅原生支持 | 桥 `postToClawhip()`；`clawhip.config.example.toml` 提供 localfile 审计路由 |

**一句话验收结论**：Discord 的「发指令 / 收推送 / 回复 / 进群策略」四类高频场景全部覆盖（🔧/✅）；线程与富文本以「话题回复 + 消息卡片」近似（⚠️）；按钮交互不在本方案（❌，已在规格 Non-Goals 内）。

---

## 4. 架构与链路图

### 4.1 总览（ASCII，双向）

```text
┌───────────────────────────── 接收方向（飞书 → agent）─────────────────────────────┐
│                                                                                  │
│  飞书群 / 单聊                                                                   │
│    用户发：继续处理当前任务   或   !继续处理当前任务  或   @机器人 xxx                                    │
│       │                                                                          │
│       ▼                                                                          │
│  飞书自建应用  ──websocket 长连接（im.message.receive_v1）──▶  feishu-bridge.mjs │
│   （事件订阅选「长连接」，无需公网回调地址）         （node 常驻，127.0.0.1:8787）│
│                                                                │                 │
│                          ┌─────────────────────────────────────┤                 │
│                          │ 白名单：所有消息 → 注入 agent         │ 非白名单：默认忽略               │
│                          │ （免 ! 前缀全注入；! 为可选标记）         │ FORWARD_=1 仅 POST       │
│                          ▼                             │ ▼ /event（不注入）           │
│              POST clawhip /event                           ┌──▶ 注入 agent：        │
│              （feishu.message/command 审计）                   │    deliver→运行中      │
│                          │                                 │    tmux 会话（优先）      │
│                          │                                 ├──▶ 回退 exec：         │
│                          │                                 │    codex/omx exec   │
│                          │                                 │    目录+指令            │
│                          ▼                                 └──▶ 执行结果（stdout）     │
│                  clawhip daemon                              │                   │
│                   （路由/审计）                                    │                   │
│                                                               ▼                 │
│                                            im/v1/messages/:message_id/reply     │
│                                            （默认回复原消息，话题式回帖）          │
│                                                               │                 │
│                                                               ▼                 │
│                                                            飞书群 ← 用户看到结果 │
└──────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────── 发送方向（agent → 飞书）─────────────────────────────┐
│                                                                                  │
│  Codex 会话五事件（SessionStart / PreToolUse / PostToolUse /                      │
│                        UserPromptSubmit / Stop）                                  │
│       │  .codex/hooks.json（omx 与 clawhip 的 native hook 并存注册）              │
│       ▼                                                                          │
│  clawhip native hook（clawhip hooks install 安装）──▶  clawhip daemon             │
│                                                  （127.0.0.1:25294）              │
│       │  Router 0..N 多投递：session.* / tmux.* / github.* / custom.*             │
│       ▼                                                                          │
│  RouteRule.slack_webhook = http://127.0.0.1:8787/feishu                          │
│       │  Slack 风格载荷 {"text": "<渲染后的通知>"}                                │
│       ▼                                                                          │
│  feishu-bridge sink ──▶ im/v1/messages?receive_id_type=chat_id ──▶ 飞书群        │
│   （消息类型 text；FEISHU_MSG_TYPE=interactive 时发卡片）                          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 关键 API / 事件一览（全部为仓库内或标准飞书 OpenAPI，未杜撰）

| 方向 | 端点 / 事件 | 出处 |
|---|---|---|
| 接收 | `im.message.receive_v1`（websocket 长连接模式，SDK `WSClient` + `EventDispatcher`） | 原版 `feishu-bridge.mjs:125-169`；SDK `types/index.d.ts:55853` |
| 接收 | 指令注入 `codex exec --skip-git-repo-check -C <dir> --json -o <out> "<prompt>"`（或 `omx exec …`） | 本机实测 codex-cli 0.147.0 `exec --help`；`omx exec` 内部同走 codex exec（`oh-my-codex.md §3.3`） |
| 接收→审计 | `POST {clawhip}/event`（`feishu.message`/`feishu.command`） | 原版 `feishu-bridge.mjs:100-109` |
| 回推（回复） | `POST /open-apis/im/v1/messages/:message_id/reply`，SDK `client.im.message.reply({path:{message_id}, data:{msg_type, content}})` | SDK `types/index.d.ts:45221-45261` |
| 回推（发群） | `POST /open-apis/im/v1/messages?receive_id_type=chat_id`，SDK `client.im.message.create` | 原版 `feishu-bridge.mjs:73-80` |
| 发送 sink | clawhip Slack webhook 载荷 `{"text":…,"blocks":[…]}` → 桥提取 `.text` | `clawhip/src/slack.rs webhook_payload`（55-96 行） |
| 发送 sink | clawhip Discord 透传 `{"content":…}`（`RouteRule.webhook`）→ 桥兼容提取 `.content` | `clawhip/src/discord.rs:320-332 send_webhook` |
| 凭证 | App ID/Secret → `tenant_access_token`（`POST /open-apis/auth/v3/tenant_access_token/internal`，SDK 内部完成） | SDK `Client` 自建应用模式（`feishu-bridge.mjs:50-57`） |
| 富文本 | `msg_type=interactive` 消息卡片（header + elements + lark_md） | 标准飞书消息卡片 schema（桥 `buildCard()`） |

### 4.3 为什么不走 omx 自带通知直连桥（重要事实）

omx `notifications.webhook` 的 `sendWebhook` 对 URL 做 `https:` 强校验（`oh-my-codex/src/notifications/dispatcher.ts:100-107`、`336-341`），本地 `http://127.0.0.1:8787` 会被拒绝（报 `Invalid URL (HTTPS required)`）。`notifications.slack` 同理只认 `hooks.slack.com`（`dispatcher.ts:87-97`）。因此：

- **推荐**：通知走 **clawhip 路由出口**（clawhip 对 `slack_webhook` 目标无此限制，纯 POST），omx 侧不配 `notifications.*`，让 clawhip 当唯一通知出口——这与本方案「发送方向复用 clawhip 路由」的规格一致。
- 若确需 omx 通知直连：把桥暴露为 HTTPS（如本地自签证书 + 桥前加 TLS 代理），URL 写 `https://localhost:8443/feishu` 即可通过校验（`Node fetch` 对自签证书需 `NODE_TLS_REJECT_UNAUTHORIZED=0` 或信任证书，注意安全权衡）。

---

## 5. 完整代码

> 文件：`bridge/feishu-bridge.mjs`（可照抄；同一文件即 `bridge/` 目录交付物）。
> 派生自 `afirez/clawhip-feishu/feishu-bridge.mjs`（保留 Sink/Source 骨架、去重、回声防护），修改点见文件头注释与 §10。

```javascript
#!/usr/bin/env node
/**
 * 飞书直桥替换 Discord —— 双向桥接服务（Node ESM，Windows / macOS / Linux）
 *
 * 基于 https://github.com/afirez/clawhip-feishu 的 feishu-bridge.mjs 修改而来。
 * 保留自原版的两条通道：
 *   1) Sink（出）：本地 HTTP 服务接收 clawhip 投递的 Slack 风格消息 {"text": "..."}
 *      → 转发为飞书消息（应用机器人 API 或自定义机器人 webhook）
 *   2) Source（入）：飞书长连接（websocket 模式）订阅 im.message.receive_v1
 *      → 白名单用户消息 → 注入 agent（免前缀全注入；! 前缀为可选显式指令标记）；
 *         非白名单默认忽略（FEISHU_FORWARD_NON_WHITELIST=1 可保留 POST clawhip /event 普通事件）
 *
 * 本次新增/修改（对齐「飞书直桥替换 Discord」规格 di-feishu-direct-20260814）：
 *   1) 指令注入模式 INJECT_MODE=codex|omx|deliver：
 *        - codex  ：codex exec --skip-git-repo-check -C <目录> --json -o <输出文件> "<指令>"
 *        - omx    ：omx exec --skip-git-repo-check -C <目录> "<指令>"（内部仍是 codex exec，多一层 OMX 工作流）
 *        - deliver：clawhip deliver --session <tmux> --prompt "<指令>"（tmux 会话注入）
 *      Windows 下 codex / omx 是 npm 生成的 .cmd 壳（shim），Node execFile 直接执行会 EINVAL/ENOENT；
 *      桥启动时自动解析 shim 内容定位真实 JS 入口，改用 `node <js> …` 调用（shell:false 直连，无注入面）。
 *   2) 执行结果回推：指令执行完成后把结果发回飞书
 *        - FEISHU_RESULT_MODE=reply：回复原消息（im/v1/messages/:message_id/reply，对齐 Discord 回复/线程语义）
 *        - FEISHU_RESULT_MODE=chat ：发到目标群（im/v1/messages?receive_id_type=chat_id）
 *   3) @提及策略：MENTION_REQUIRED=1 时仅响应「@机器人」的消息（对齐 Discord @ 语义）
 *   4) 富文本卡片：FEISHU_MSG_TYPE=interactive 时用 lark_md 消息卡片呈现结果
 *   5) Sink 载荷兼容：{text}（clawhip Slack sink）/ {content}（clawhip Discord webhook 透传）/ {message}（omx webhook）
 *
 * 本次对齐（规格 di-align-discord-usage-20260814：指令处理对齐 omx/clawhip 源码揭示的 Discord 真实使用模式，
 * omx/clawhip 源码零改动，全部对齐在桥内实现）：
 *   1) 白名单全注入：FEISHU_ALLOWED_OPEN_IDS（逗号分隔 open_id 列表）——白名单用户的所有消息默认
 *      注入 agent（含 omx $关键词，免 ! 前缀；对齐 reply-listener「无前缀过滤」+「授权=配置用户 ID 白名单」）。
 *      白名单为空 → 全部放行（向后兼容默认）。
 *   2) ! 变可选显式指令标记：! 开头 = 强制按指令处理（仅对白名单用户生效；非白名单仍不注入）。
 *   3) 注入目标优先级：INJECT_MODE=deliver 时优先注入「运行中」tmux 会话（对齐 reply-listener sendToPane /
 *      clawhip deliver 语义——注入运行中会话而非新开 exec）；deliver 不可用（无运行中会话等）时回退 exec
 *      （INJECT_FALLBACK_MODE=codex|omx）。INJECT_MODE=codex|omx 维持直接 exec。
 *   4) 非白名单用户消息：默认忽略（严格对齐 reply-listener 授权模型）；FEISHU_FORWARD_NON_WHITELIST=1
 *      时保留 POST clawhip /event 作为普通事件（feishu.message，不注入）。
 *
 * 启动（Node ≥ 20.6，--env-file 需要）：
 *   node --env-file=.env feishu-bridge.mjs
 */

import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as lark from "@larksuiteoapi/node-sdk";

// ---------------- 环境变量（.env / 进程环境） ----------------
const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_CHAT_ID,
  FEISHU_CUSTOM_BOT_WEBHOOK,
  FEISHU_SINK_MODE = "app",        // app = 应用机器人 API（推荐）；webhook = 自定义机器人
  CLAWHIP_DAEMON = "http://127.0.0.1:25294",
  CLAWHIP_SESSION = "",            // 仅 INJECT_MODE=deliver 时使用（tmux 会话名）
  COMMAND_PREFIX = "!",            // 可选显式指令标记（! 开头 = 强制按指令处理；白名单用户免前缀全注入）
  BRIDGE_PORT = "8787",            // Sink 监听端口
  INJECT_MODE = "codex",           // 指令注入模式：codex | omx | deliver
  INJECT_FALLBACK_MODE = "codex",  // INJECT_MODE=deliver 不可用时的回退 exec：codex | omx
  CODEX_BIN = "",                  // codex 可执行文件覆盖（Windows 下建议留空自动解析 shim）
  OMX_BIN = "",                    // omx 可执行文件覆盖
  CODEX_WORKDIR = "",              // codex/omx exec 的工作目录（默认 process.cwd()）
  EXEC_TIMEOUT_MS = "600000",      // 指令执行超时（默认 10 分钟）
  FEISHU_RESULT_MODE = "reply",    // 结果回推：reply = 回复原消息；chat = 发到群
  MENTION_REQUIRED = "0",          // 1 = 仅响应 @机器人 的消息
  FEISHU_MSG_TYPE = "text",        // text = 纯文本；interactive = 富文本卡片
  RESULT_MAX_CHARS = "3000",       // 回推结果最大字符数（超出截断）
  FEISHU_ALLOWED_OPEN_IDS = "",    // 白名单 open_id 列表（逗号分隔）；空 = 全部放行（向后兼容默认）
  FEISHU_FORWARD_NON_WHITELIST = "0", // 1 = 非白名单消息仍 POST clawhip /event（普通事件，不注入）；0 = 忽略
} = process.env;

const WORKDIR = CODEX_WORKDIR || process.cwd();
const EXEC_TIMEOUT = Number(EXEC_TIMEOUT_MS) || 600000;
const RESULT_LIMIT = Number(RESULT_MAX_CHARS) || 3000;

// 白名单解析：逗号分隔的飞书 open_id；集合为空 → 所有用户视为白名单（向后兼容默认）
const ALLOWED_OPEN_IDS = new Set(
  FEISHU_ALLOWED_OPEN_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// ---------------- 飞书 SDK 客户端（自建应用） ----------------
// 底层凭证流程由 SDK 内部完成：App ID + App Secret → POST /open-apis/auth/v3/tenant_access_token/internal
const client =
  FEISHU_APP_ID && FEISHU_APP_SECRET
    ? new lark.Client({
        appId: FEISHU_APP_ID,
        appSecret: FEISHU_APP_SECRET,
        appType: lark.AppType.SelfBuild,
      })
    : null;

// 飞书长连接是 at-least-once 投递，断线重连可能重投同一条消息，按 message_id 去重
const recentMessageIds = new Set();
const MAX_RECENT_MESSAGE_IDS = 200;
function isDuplicateMessage(messageId) {
  if (!messageId || recentMessageIds.has(messageId)) return true;
  recentMessageIds.add(messageId);
  if (recentMessageIds.size > MAX_RECENT_MESSAGE_IDS) {
    const oldest = recentMessageIds.values().next().value;
    recentMessageIds.delete(oldest);
  }
  return false;
}

// ---------------- Windows npm shim 解析 ----------------
// Windows 下全局安装的 codex / omx 是 npm 生成的 .cmd 壳（shim），内容形如：
//   "%_prog%"  "%dp0%\node_modules\oh-my-codex\dist\cli\omx.js" %*
// execFile 直接执行 .cmd 会抛 EINVAL / ENOENT。这里解析 shim 定位真实 JS 入口，
// 统一用 `node <js>` 调用（shell:false，参数不走 shell，无注入面）。
function resolveShim(cmd) {
  const npmDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm")
    : null;
  const candidates = [];
  if (npmDir) {
    candidates.push(path.join(npmDir, cmd + ".cmd"));
    candidates.push(path.join(npmDir, cmd + ".exe"));
    candidates.push(path.join(npmDir, cmd));
  }
  // 从 PATH 补查（含用户自定义安装位置）
  try {
    const out = execFileSync("where", [cmd], { encoding: "utf8", shell: false });
    for (const line of out.split(/\r?\n/)) if (line.trim()) candidates.push(line.trim());
  } catch { /* 不在 PATH，继续 */ }
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    if (/\.cmd$/i.test(c)) {
      const content = fs.readFileSync(c, "utf8");
      // npm shim 特征：%dp0%\node_modules\<pkg>\...\<入口>.js
      const m = content.match(/%dp0%[\\]([^"%\r\n]+\.js)/);
      const js = m ? path.join(path.dirname(c), m[1]) : null;
      if (js && fs.existsSync(js)) return { bin: process.execPath, args: [js] };
      return null; // 是 .cmd 但解析不出 JS 入口
    }
    return { bin: c, args: [] }; // 真实二进制（.exe / Unix 路径）
  }
  return { bin: cmd, args: [] }; // 非 Windows 或不在 PATH：交给系统解析
}

// ---------------- 文本工具 ----------------
function truncate(text, limit) {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "\n…（结果过长已截断）";
}

function tail(text, limit) {
  return text.length <= limit ? text : "…（输出过长，仅保留末尾）\n" + text.slice(-limit);
}

// 去掉消息文本里的 @占位符（content.mention 的 key，形如 @_user_1）
function stripMentions(text, mention) {
  let t = text;
  if (Array.isArray(mention)) {
    for (const m of mention) {
      if (m && m.key) t = t.split(m.key).join("");
    }
  }
  return t.replace(/@_user_\d+/g, "").trim();
}

// ---------------- 发送到飞书 ----------------
// 富文本卡片（msg_type=interactive，标准消息卡片 schema：header + elements）
function buildCard(title, text) {
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: title },
      template: "blue",
    },
    elements: [{ tag: "div", text: { tag: "lark_md", content: text } }],
  });
}

// 统一发送入口：
//   mode=reply → POST /open-apis/im/v1/messages/:message_id/reply（回复原消息）
//   mode=chat  → POST /open-apis/im/v1/messages?receive_id_type=chat_id（发到群）
async function sendMessage(text, { messageId, chatId, title = "桥接通知" }) {
  const msgType = FEISHU_MSG_TYPE === "interactive" ? "interactive" : "text";
  const content =
    msgType === "interactive" ? buildCard(title, text) : JSON.stringify({ text });

  if (FEISHU_SINK_MODE === "webhook" && FEISHU_CUSTOM_BOT_WEBHOOK) {
    // 自定义机器人 webhook：POST /open-apis/bot/v2/hook/{token}（无 reply 能力，一律发群）
    const res = await fetch(FEISHU_CUSTOM_BOT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: msgType, content: msgType === "interactive" ? JSON.parse(content) : { text } }),
    });
    if (!res.ok) throw new Error(`feishu webhook ${res.status}`);
    return;
  }
  if (!client) throw new Error("需要 FEISHU_APP_ID / FEISHU_APP_SECRET（或改用 webhook 模式）");

  if (FEISHU_RESULT_MODE === "reply" && messageId) {
    await client.im.message.reply({
      path: { message_id: messageId },
      data: { msg_type: msgType, content },
    });
  } else {
    await client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: { receive_id: chatId || FEISHU_CHAT_ID, msg_type: msgType, content },
    });
  }
}

// ---------------- Sink：clawhip 投递 → 飞书 ----------------
async function sendToFeishu(text) {
  await sendMessage(text, { chatId: FEISHU_CHAT_ID });
}

const sinkServer = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const payload = JSON.parse(body || "{}");
    // 兼容三种载荷：clawhip Slack sink {"text"} / clawhip Discord 透传 {"content"} / omx webhook {"message"}
    const text = (payload.text || payload.content || payload.message || "").trim();
    if (text) await sendToFeishu(text);
    res.writeHead(200).end("ok");
  } catch (err) {
    console.error("[sink]", err.message);
    res.writeHead(502).end(err.message);
  }
});
sinkServer.listen(Number(BRIDGE_PORT), "127.0.0.1", () => {
  console.log(`[sink] listening http://127.0.0.1:${BRIDGE_PORT}/feishu`);
});

// ---------------- Source：飞书消息 → clawhip / 指令注入 ----------------
async function postToClawhip(payload) {
  const res = await fetch(`${CLAWHIP_DAEMON}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`clawhip /event ${res.status}: ${await res.text()}`);
  }
}

// 原版路径：clawhip deliver 注入「正在运行」的 tmux 会话（如 WSL / msys2 下的 omx-main）。
// 对齐 reply-listener sendToPane / clawhip deliver 语义：注入运行中会话，而非新开 exec 会话。
// 返回 { ok, text, error }：ok=false 表示 deliver 不可用（无运行中会话 / 无 tmux / clawhip 缺失等），
// 供上层回退 exec。
function deliverToSession(prompt) {
  const clawhipBin =
    process.env.CLAWHIP_BIN ||
    (process.platform === "win32"
      ? (process.env.USERPROFILE
          ? path.join(process.env.USERPROFILE, ".cargo", "bin", "clawhip.exe")
          : "clawhip")
      : (process.env.HOME
          ? path.join(process.env.HOME, ".cargo", "bin", "clawhip")
          : "clawhip"));
  return new Promise((resolve) => {
    execFile(
      clawhipBin,
      ["deliver", "--session", CLAWHIP_SESSION, "--prompt", prompt, "--max-enters", "4"],
      { shell: false },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "").trim();
          console.error("[deliver]", msg || `exit ${err.code}`);
          resolve({
            ok: false,
            text: "",
            error: msg ? `deliver 失败：${msg.slice(0, 500)}` : `deliver 失败(${err.code})`,
          });
        } else {
          console.log("[deliver]", stdout);
          resolve({ ok: true, text: stdout || "已注入 tmux 会话" });
        }
      },
    );
  });
}

// codex / omx exec（直选与 deliver 回退共用）：target = 'codex' | 'omx'
async function execPrompt(prompt, target) {
  const override = target === "omx" ? OMX_BIN : CODEX_BIN;
  const resolved = override ? { bin: override, args: [] } : resolveShim(target);
  if (!resolved) throw new Error(`无法解析 ${target} 可执行文件（npm shim 解析失败），请设置 ${target.toUpperCase()}_BIN`);

  const outFile = path.join(os.tmpdir(), `feishu-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}.out`);
  const args =
    target === "codex"
      ? ["exec", "--skip-git-repo-check", "-C", WORKDIR, "--json", "-o", outFile, prompt]
      : ["exec", "--skip-git-repo-check", "-C", WORKDIR, prompt];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXEC_TIMEOUT);
  try {
    const { stdout } = await new Promise((resolvePromise, reject) => {
      execFile(
        resolved.bin,
        [...resolved.args, ...args],
        { shell: false, signal: controller.signal, maxBuffer: 64 * 1024 * 1024 },
        (err, so, se) => {
          if (err) {
            const msg = controller.signal.aborted
              ? `执行超时（${EXEC_TIMEOUT / 1000}s）`
              : `exec 失败(${err.code})：${(se || err.message).slice(0, 400)}`;
            return reject(new Error(msg));
          }
          resolvePromise({ stdout: so });
        },
      );
    });

    // 优先取 -o 写入的「最后一条消息」（codex 模式）；兜底取 stdout 末尾
    let result = "";
    if (fs.existsSync(outFile)) {
      const raw = fs.readFileSync(outFile, "utf8").trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          result = typeof parsed.text === "string" ? parsed.text : raw;
        } catch { result = raw; }
      }
    }
    if (!result) result = tail(stdout || "", 4000);
    return truncate(result.trim() || "（执行完成，无输出）", RESULT_LIMIT);
  } finally {
    clearTimeout(timer);
    try { fs.unlinkSync(outFile); } catch { /* 忽略清理失败 */ }
  }
}

// 指令注入入口：串行队列防止并发撞车
// 注入目标优先级（对齐 reply-listener/deliver 语义，规格 di-align-discord-usage-20260814）：
//   INJECT_MODE=deliver → 优先注入「运行中」tmux 会话；deliver 不可用（无运行中会话等）→ 回退 exec（INJECT_FALLBACK_MODE）
//   INJECT_MODE=codex|omx → 直接 exec（维持原行为）
let execQueue = Promise.resolve();

function runExec(prompt) {
  const run = async () => {
    if (INJECT_MODE === "deliver") {
      const out = await deliverToSession(prompt);
      if (out.ok) return out.text;
      // deliver 不可用 → 回退 exec
      console.warn(`[deliver] 不可用，回退 ${INJECT_FALLBACK_MODE === "omx" ? "omx" : "codex"} exec（${out.error}）`);
      return execPrompt(prompt, INJECT_FALLBACK_MODE === "omx" ? "omx" : "codex");
    }
    return execPrompt(prompt, INJECT_MODE === "omx" ? "omx" : "codex");
  };
  // 串行化：前一条执行完才跑下一条
  const next = execQueue.then(run, run);
  execQueue = next.catch(() => {});
  return next;
}

if (client) {
  const dispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      // WSClient 长连接直接把事件本体传给 handler（顶层即 sender/message），
      // 不是 HTTP 模式的 { schema, header, event } 包装结构。
      const { message, sender } = data;
      if (!message || !sender) return;
      if (sender.sender_type === "app") return; // 防止机器人自己的消息形成回声
      if (isDuplicateMessage(message.message_id)) return; // 重投去重
      if (message.message_type !== "text") return; // 先只处理文本

      const content = JSON.parse(message.content || "{}");
      let text = (content.text || "").trim();
      if (!text) return;
      text = stripMentions(text, content.mention);

      // @提及策略：MENTION_REQUIRED=1 时仅响应群里 @机器人 的消息
      const mentioned = Array.isArray(message.mentions) && message.mentions.length > 0;
      if (MENTION_REQUIRED === "1" && !mentioned) return;

      const openId = sender.sender_id && sender.sender_id.open_id;
      console.log(`[source] chat=${message.chat_id} user=${openId}: ${text}`);

      // 白名单判定（对齐 reply-listener 授权模型：配置用户 ID 白名单，规格 di-align-discord-usage-20260814）
      //   FEISHU_ALLOWED_OPEN_IDS 为空 → 全部放行（向后兼容默认）
      //   白名单非空 → 仅列表内 open_id 的用户可注入；非白名单消息见下方处理
      const allowed =
        ALLOWED_OPEN_IDS.size === 0
          ? true
          : Boolean(openId && ALLOWED_OPEN_IDS.has(openId));

      const base = {
        source: "feishu",
        channel: message.chat_id,
        message: text,
        user: openId,
        message_id: message.message_id,
      };

      try {
        if (!allowed) {
          // 非白名单用户：默认忽略（严格对齐 reply-listener 授权模型，不注入、不 POST）
          if (FEISHU_FORWARD_NON_WHITELIST === "1") {
            // 可配保留：仅作为普通事件 POST clawhip /event（feishu.message，不注入）
            await postToClawhip({ ...base, event: "feishu.message", whitelisted: false });
            console.log(`[source] 非白名单消息已转发普通事件（user=${openId}，不注入）`);
          } else {
            console.log(`[source] 非白名单用户消息已忽略（user=${openId}）`);
          }
          return;
        }

        // 指令判定：! 前缀 = 可选显式指令标记（强制按指令处理）；
        // 无前缀时，白名单用户的所有消息默认注入（含 omx $关键词，免前缀，对齐 reply-listener 无前缀过滤）
        const explicitCommand = COMMAND_PREFIX && text.startsWith(COMMAND_PREFIX);
        const prompt = explicitCommand ? text.slice(COMMAND_PREFIX.length).trim() : text;
        if (!prompt) return;

        if (explicitCommand) {
          // 显式 ! 指令：先记一条 feishu.command 审计事件（clawhip 审计/路由），再注入执行
          await postToClawhip({ ...base, event: "feishu.command", command: prompt, whitelisted: true });
        } else {
          // 免前缀全注入：记 feishu.message 审计事件（标注 injected），再注入执行
          await postToClawhip({ ...base, event: "feishu.message", injected: true, whitelisted: true });
        }
        console.log(`[exec] ${INJECT_MODE} 注入：${prompt}`);
        const result = await runExec(prompt);
        console.log(`[exec] 完成，${result.length} 字符`);
        await sendMessage(result, {
          messageId: message.message_id,
          chatId: message.chat_id,
          title: "指令执行结果",
        });
      } catch (err) {
        console.error("[source]", err.message);
        // 执行失败也要回推，让人在飞书里看到错误
        try {
          await sendMessage(`❌ 执行失败：${err.message}`, {
            messageId: message.message_id,
            chatId: message.chat_id,
            title: "执行失败",
          });
        } catch { /* 回推失败仅记录 */ }
      }
    },
  });

  const ws = new lark.WSClient({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    loggerLevel: lark.LoggerLevel.INFO,
  });

  ws.start({ eventDispatcher: dispatcher }).catch((err) => {
    console.error("[ws]", err);
    process.exit(1);
  });
} else {
  console.log("[source] 未配置飞书 App 凭证，仅启用 sink（可先用自定义机器人 webhook）");
}
```

配套文件：

- `bridge/package.json` —— 依赖 `@larksuiteoapi/node-sdk ^1.10.0`；`npm start` = `node --env-file=.env feishu-bridge.mjs`。
- `bridge/.env.example` —— 全部环境变量模板（含 Windows 注入与白名单相关新增项），见 §6.2。
- `bridge/clawhip.config.example.toml` —— 发送方向路由模板，见 §6.3。

---

## 6. 配置示例

### 6.1 飞书自建应用创建（一次性，参考原版 README §3 并补充权限细节）

1. 打开 [open.feishu.cn](https://open.feishu.cn) 开发者后台 → 创建**企业自建应用**（自建应用内部使用不需要应用商店认证）。
2. 应用能力 → 添加**机器人**。
3. **权限管理**至少添加（按你的交互深度选择）：
   - `im:message:send_as_bot` —— 机器人发消息（发送方向必需）
   - `im:message:group_at_msg` —— 仅接收群里 `@机器人` 的消息（配合 `MENTION_REQUIRED=1`，最省权限）
   - `im:message.group_msg` —— 接收群里所有消息（配合 `MENTION_REQUIRED=0` 默认模式，白名单用户可直接发消息/`!指令` 不 @）
   - `im:message:receive_p2p_msg`（获取用户发给机器人的单聊消息）—— 支持私聊（可选）
   - （可选）`im:chat:readonly` / `contact:user.base:readonly` —— 需要读群信息/成员名时再开
4. **事件订阅** → 添加事件 **接收消息 `im.message.receive_v1`**，订阅方式选 **长连接**（websocket，无需公网回调地址、无需签名/加密配置）。
5. **版本管理与发布** → 创建版本并发布到企业（不发布则长连接无法建立）。
6. 把机器人拉进目标群（群设置 → 群机器人 → 添加机器人）；记录 **App ID（`cli_` 开头）**、**App Secret**、**群 chat_id（`oc_` 开头，群设置 → 群信息可查）**。

> 说明：长连接模式下 `im.message.receive_v1` 事件由 SDK `WSClient` 自动维持，**不需要**配置事件回调 URL、Verification Token 或 Encrypt Key——签名校验只出现在 HTTP 回调模式（见 §8 排查）。

### 6.2 环境变量（`bridge/.env`，由 `.env.example` 复制）

| 变量 | 含义 | 默认 |
|---|---|---|
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书自建应用凭证（`cli_` 开头） | —（必填） |
| `FEISHU_CHAT_ID` | 通知目标群 `chat_id`（`oc_` 开头） | —（必填） |
| `FEISHU_SINK_MODE` | `app`（应用机器人 API，推荐）/ `webhook`（自定义机器人） | `app` |
| `FEISHU_CUSTOM_BOT_WEBHOOK` | 仅 webhook 模式：`https://open.feishu.cn/open-apis/bot/v2/hook/xxxx` | 空 |
| `CLAWHIP_DAEMON` | clawhip daemon 地址 | `http://127.0.0.1:25294` |
| `COMMAND_PREFIX` | **可选**显式指令标记：`!` 开头 = 强制按指令处理（仅白名单用户生效）；白名单用户免前缀全注入 | `!` |
| `INJECT_MODE` | `codex` / `omx` / `deliver`；`deliver` = 优先注入运行中 tmux 会话，deliver 不可用（无运行中会话）时**回退 exec**（`INJECT_FALLBACK_MODE`） | `codex` |
| `INJECT_FALLBACK_MODE` | `INJECT_MODE=deliver` 失败时的回退 exec 方式：`codex` / `omx` | `codex` |
| `FEISHU_ALLOWED_OPEN_IDS` | 白名单 open_id 列表（逗号分隔，如 `ou_xxx,ou_yyy`）；白名单用户**所有消息默认注入**（含 omx `$关键词`，免 `!` 前缀）；**留空 = 全部放行**（向后兼容默认） | 空 |
| `FEISHU_FORWARD_NON_WHITELIST` | `1` = 非白名单消息仍 POST clawhip `/event`（普通事件 `feishu.message`，不注入）；`0` = 直接忽略（对齐 reply-listener 授权模型） | `0` |
| `CODEX_BIN` / `OMX_BIN` | 可执行文件覆盖（一般留空，Windows 自动解析 npm shim） | 空 |
| `CODEX_WORKDIR` | `codex exec` 工作目录（建议你的 git 仓库根） | 桥启动目录 |
| `EXEC_TIMEOUT_MS` | 指令执行超时 | `600000`（10 分钟） |
| `FEISHU_RESULT_MODE` | `reply`（回复原消息）/ `chat`（发到群） | `reply` |
| `MENTION_REQUIRED` | `1` 仅响应 `@机器人`；`0` 响应群里所有消息 | `0` |
| `FEISHU_MSG_TYPE` | `text` / `interactive`（富文本卡片） | `text` |
| `RESULT_MAX_CHARS` | 回推结果截断长度 | `3000` |
| `BRIDGE_PORT` | 桥 Sink 监听端口 | `8787` |

完整模板见 `bridge/.env.example`。`.env` 含敏感凭证，勿提交仓库。

### 6.3 clawhip 路由（`%USERPROFILE%\.clawhip\config.toml`，由 `bridge/clawhip.config.example.toml` 复制）

发送方向把 `slack_webhook` 指向桥（字段与 `clawhip/src/config.rs:180-208` `RouteRule` 对齐；仅设 `slack_webhook` 时 sink 自动判为 slack，`config.rs:247-256`；`format` 取值 `compact/alert/inline/raw`，`src/events.rs:14-22`）：

```toml
# 发送方向：agent 生命周期 → 飞书（核心路由，保留原 Discord 通知体验）
[[routes]]
event = "session.*"
filter = { provider = "codex" }
slack_webhook = "http://127.0.0.1:8787/feishu"
format = "compact"

[[routes]]
event = "tmux.*"
slack_webhook = "http://127.0.0.1:8787/feishu"
format = "alert"

[[routes]]
event = "github.*"
slack_webhook = "http://127.0.0.1:8787/feishu"
format = "compact"

[[routes]]
event = "custom.*"
slack_webhook = "http://127.0.0.1:8787/feishu"
format = "compact"

# 接收方向审计：桥 POST 的 feishu.message / feishu.command → 本地 JSONL
# 注意：local_path 按字面使用，不做 %USERPROFILE% 展开，请写完整 Windows 路径。
[[routes]]
event = "feishu.message"
filter = { source = "feishu" }
sink = "localfile"
local_path = "C:\\Users\\你的用户名\\.clawhip\\events\\feishu.jsonl"
format = "compact"

[[routes]]
event = "feishu.command"
filter = { source = "feishu" }
sink = "localfile"
local_path = "C:\\Users\\你的用户名\\.clawhip\\events\\feishu.jsonl"
format = "compact"
```

要点：

- clawhip 是**多投递路由**，一个事件可同时命中多条路由——若想与 Discord 并行保留，加一条原 Discord webhook 路由即可；审计始终落盘。
- `feishu.message`/`feishu.command` 走 `localfile` 审计而非回声转发，避免用户消息被机器人原样发回群里（想回声可改回 `slack_webhook`，与原版 clawhip-feishu 一致）。
- **clawhip 对 `slack_webhook` 目标无 HTTPS 限制**（纯 POST，`clawhip/src/slack.rs:31-45`），这是发送方向选择 clawhip 而非 omx 直连的根本原因（对比 §4.3）。

### 6.4 omx 侧：不配 notifications，让 clawhip 当唯一通知出口

- omx 与 clawhip 的 Codex 钩子在 `.codex/hooks.json` 中**并存注册**（原版 README §5.3：`codex-native-hook.mjs` 与 clawhip `native-hook.mjs --provider codex` 合并到五个共享事件），由 `clawhip hooks install --all` 安装（`clawhip/src/cli.rs` `HooksCommands::Install`）。
- **不要**配置 `~/.codex/.omx-config.json` 的 `notifications.webhook` 指向本地桥——omx 强制 `https:`（§4.3）。保持 omx 通知不启用，生命周期事件全部经 clawhip 路由到飞书，语义与原来 Discord 时代一致。

---

## 7. 部署步骤（Windows）

### 7.1 前置条件

| 组件 | 版本 | 备注 |
|---|---|---|
| Node.js | ≥ 20.6（`--env-file`） | 本机已验证 v25.6.0 |
| codex-cli | ≥ 0.147.0（`codex exec` 可用） | 本机已验证 0.147.0（npm 全局安装） |
| oh-my-codex | ≥ 0.20.3（`omx exec` 可用） | 可选；`INJECT_MODE=codex` 时不需要 |
| clawhip | v0.6.x daemon | 本机未装；`cargo install --path .` 或下载 release（见 clawhip 仓库） |
| 飞书自建应用 | 已创建并发布（§6.1） | 凭证 + chat_id 就绪 |

### 7.2 安装与启动

```powershell
# 1) 安装桥依赖（在 bridge 目录）
cd F:\studio\ai_agent\UltraWorker\bridge
npm install

# 2) 配置环境变量
Copy-Item .env.example .env
# 编辑 .env：填 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_CHAT_ID / FEISHU_ALLOWED_OPEN_IDS（建议配置白名单）/ CODEX_WORKDIR 等

# 3) 启动 clawhip daemon（Windows 下先装 clawhip 二进制）
clawhip daemon
# 新开窗口验证：clawhip status

# 4) 安装 clawhip 的 Codex 原生钩子（发送方向事件源）
clawhip hooks install --all

# 5) 启动飞书桥（前台验证）
node --env-file=.env feishu-bridge.mjs
# 期望日志：
#   [sink] listening http://127.0.0.1:8787/feishu
#   [ws]   ... 长连接就绪（WSClient 事件日志）
```

### 7.3 验证步骤

```powershell
# 1) 桥的 sink 存活（不经过飞书凭证也返回，日志有记录）
curl.exe -X POST http://127.0.0.1:8787/feishu -H "Content-Type: application/json" -d '{\"text\":\"sink probe\"}'

# 2) 发送方向全链路：clawhip → 桥 → 飞书
clawhip send --channel test --message "全链路测试"
# 飞书群应出现消息；桥日志无 502 即成功

# 3) 接收方向：在飞书群里发一条普通消息
# 桥日志出现 [source] chat=oc_... user=ou_...: <消息>
# $env:USERPROFILE\.clawhip\events\feishu.jsonl 出现 feishu.message

# 4) 指令注入：白名单用户在飞书群里直接发消息（免前缀，如「回复 OK」）或发 !回复 OK（或 @机器人 后发指令）
# 桥日志出现 [exec] codex 注入；codex exec 结束后 [exec] 完成；
# 群里收到「指令执行结果」回复（reply 模式为原消息下的回帖）
```

### 7.4 常驻方案（三选一）

**方案 A：pm2（推荐，跨平台）**
```powershell
npm i -g pm2
cd F:\studio\ai_agent\UltraWorker\bridge
pm2 start feishu-bridge.mjs --name feishu-bridge --node-args="--env-file=.env"
pm2 save                    # 保存进程列表
pm2 startup                 # 生成开机自启命令并执行
pm2 logs feishu-bridge      # 查看日志
```

**方案 B：NSSM（Windows 服务）**
```powershell
# 下载 nssm（https://nssm.cc）
nssm install FeishuBridge "C:\Program Files\nodejs\node.exe" "--env-file=C:\studio\ai_agent\UltraWorker\bridge\.env C:\studio\ai_agent\UltraWorker\bridge\feishu-bridge.mjs"
nssm set FeishuBridge AppDirectory "F:\studio\ai_agent\UltraWorker\bridge"
nssm set FeishuBridge AppStdout "F:\studio\ai_agent\UltraWorker\bridge\bridge.out.log"
nssm set FeishuBridge AppStderr "F:\studio\ai_agent\UltraWorker\bridge\bridge.err.log"
nssm start FeishuBridge
```

**方案 C：任务计划程序（Task Scheduler，无额外依赖）**
```powershell
# 触发器：登录时/开机时；操作：启动程序
#   程序/脚本: C:\Program Files\nodejs\node.exe
#   添加参数: --env-file=F:\studio\ai_agent\UltraWorker\bridge\.env F:\studio\ai_agent\UltraWorker\bridge\feishu-bridge.mjs
#   起始于:   F:\studio\ai_agent\UltraWorker\bridge
# 勾选「如果任务失败，按此频率重新启动：1 分钟，尝试 3 次」
```

### 7.5 运维

```powershell
# 重启桥（改 .env 后必须重启）
pm2 restart feishu-bridge          # 或 nssm restart FeishuBridge

# 状态
clawhip status
pm2 status

# clawhip daemon 重启后重新注册 tmux 监控（若用 deliver 模式；注册在 daemon 内存中）
clawhip tmux watch --session omx-main --keywords "FAILED,error,blocked" --stale-minutes 15

# 日志
pm2 logs feishu-bridge             # 桥日志
Get-Content "$env:USERPROFILE\.clawhip\events\feishu.jsonl" -Tail 20   # 审计
```

---

## 8. 故障排查

| 现象 | 原因与处理 |
|---|---|
| 桥报 `230001 invalid receive_id` | `FEISHU_CHAT_ID` 为空或错误，检查 `.env` 后重启桥 |
| 长连接连不上（`ws client ready` 未出现） | 应用未发布版本 / 事件订阅未选长连接 / App Secret 错误。核对 §6.1 第 4、5 步 |
| 事件订阅报「签名校验失败」类错误 | 长连接模式**不需要**签名/encrypt key；若按 HTTP 回调模式配置才会涉及 `Verification Token`/`Encrypt Key`。统一改回「长连接」订阅方式 |
| 飞书收不到通知 | 应用未发布 / 机器人未进群 / 缺 `im:message:send_as_bot` 权限 |
| 群消息没进桥（`[source]` 日志无） | 消息发送者是机器人自己（`sender_type=app` 回声过滤）；或 `MENTION_REQUIRED=1` 但没 @ 机器人；或群消息权限只有 `group_at_msg` 而事件不是 @ 消息 |
| 发 `!指令` 没反应 | 发送者不在 `FEISHU_ALLOWED_OPEN_IDS` 白名单（非白名单默认忽略，**不注入**，日志出现「非白名单用户消息已忽略」）；前缀与 `COMMAND_PREFIX` 不一致；`MENTION_REQUIRED=1` 时未 @；或该群只授权了 `group_at_msg`（收不到非 @ 消息） |
| 白名单用户发普通消息（无 `!`）没注入 | 确认 `FEISHU_ALLOWED_OPEN_IDS` 已配置且包含该用户 open_id（或**留空 = 全部放行**）；`MENTION_REQUIRED=1` 时需 @ 机器人；白名单内确认无误后看桥日志 `[exec] … 注入` 是否出现 |
| 非白名单用户消息完全没反应 | **默认行为**：非白名单消息被忽略（严格对齐 reply-listener 授权模型，不注入、不 POST）。如需保留审计/转发，设 `FEISHU_FORWARD_NON_WHITELIST=1`（仅作为普通事件 POST /event，不注入） |
| deliver 模式没注入但也没报错 | deliver 不可用（无运行中 tmux 会话 / `CLAWHIP_SESSION` 未配 / clawhip 未装）时**自动回退 exec**（`INJECT_FALLBACK_MODE`），桥日志出现 `[deliver] 不可用，回退 … exec`；确认 tmux 会话名与 `CLAWHIP_SESSION` 一致 |
| 桥日志 `exec 失败(ENOENT/EINVAL)` | Windows npm shim 解析失败：确认 `codex`/`omx` 已全局安装（`where codex`）；或显式设 `CODEX_BIN`/`OMX_BIN` 指向真实可执行文件。桥默认已自动解析 shim（`resolveShim`），本机实测通过 |
| `exec 失败(ABORT_ERR)` / 「执行超时」 | `EXEC_TIMEOUT_MS` 太短；codex 首次调用可能触发登录/更新检查，把超时调大（如 1200000）或先手动跑一次 `codex exec "ok"` 预热 |
| 执行返回「不是 git 仓库」类错误 | codex exec 已带 `--skip-git-repo-check`；若你手动换用 omx/其他参数，需自行加该 flag |
| clawhip 报 `transport error` 到桥 | 桥没在运行：`pm2 restart feishu-bridge`；或 `BRIDGE_PORT` 与 clawhip 路由里的 URL 端口不一致 |
| clawhip `/event` 报错 | `CLAWHIP_DAEMON` 地址/端口与 `clawhip status` 显示不一致 |
| 代理/网络：飞书 API 超时、桥连不上 open.feishu.cn | 飞书 OpenAPI 需直连；若本机走 Clash/代理，确保 `open.feishu.cn` 与长连接域名放行（代理规则加直连，或桥进程 `NO_PROXY=open.feishu.cn`）。桥的本地 sink（127.0.0.1）不受代理影响 |
| 结果太长被截断 | `RESULT_MAX_CHARS` 调大；飞书单条 text 消息上限约 30KB，勿超 |
| 想看到卡片样式 | `FEISHU_MSG_TYPE=interactive` 重开桥；注意 `lark_md` 是 markdown 子集（支持粗体/链接/代码块，不支持表格等部分语法） |

---

## 9. 安全注意

- `.env` 里的 App Secret、webhook URL 等同密码，勿提交仓库、勿外发。
- 桥只监听 `127.0.0.1:8787`（仅本机）；clawhip daemon 默认监听 `0.0.0.0:25294`，如有内网风险建议改为仅本机绑定。
- 注入 = 「飞书群里能指挥 codex 在你的机器上执行」，**第一道闸门是 `FEISHU_ALLOWED_OPEN_IDS` 白名单**（默认留空 = 全部放行，请务必配置）。只把机器人加进可信群，并配合 `MENTION_REQUIRED=1` 与白名单共同收窄触发面；非白名单消息默认忽略（`FEISHU_FORWARD_NON_WHITELIST=1` 仅转发普通事件，不注入，安全影响小）。
- 桥以 `shell:false` 直调 `node <js>` 执行 codex/omx，指令文本不经过 shell，无命令注入面；但 codex 本身会执行仓库内命令，行为等同你亲自在终端运行 `codex exec`。

**可选扩展（不在本方案范围）**：出站「@ 回发送者」需调通讯录 API（`contact/v3/users/:user_id` 取姓名后把 `mention` 数组写进回复 content）；卡片按钮回调需另建 `card action` 回调服务并在事件订阅里加 `card.action.trigger`（HTTP 回调模式，涉及签名校验）。需要时再单独出方案。

---

## 10. 代码来源与修改说明

| 本方案文件 | 派生自 | 修改点 |
|---|---|---|
| `bridge/feishu-bridge.mjs` | `afirez/clawhip-feishu/feishu-bridge.mjs` | 保留 Sink/Source/去重/回声防护/`clawhip deliver` 路径；新增 `INJECT_MODE=codex/omx`（`execFile` 直调 + `resolveShim` 解析 Windows npm shim）、结果回推（`im.message.reply`/`create`）、`MENTION_REQUIRED`、`interactive` 卡片、sink 三载荷兼容、exec 串行队列与超时；**v2 对齐（di-align-discord-usage-20260814）**：白名单全注入（`FEISHU_ALLOWED_OPEN_IDS`，免前缀）、`!` 变可选显式标记、deliver 优先注入运行中会话 + exec 回退（`INJECT_FALLBACK_MODE`）、非白名单默认忽略（`FEISHU_FORWARD_NON_WHITELIST=1` 可配转发普通事件） |
| `bridge/package.json` | `afirez/clawhip-feishu/package.json` | 依赖不变（`@larksuiteoapi/node-sdk ^1.10.0`）；加 `engines.node>=20.6`、`start` 用 `--env-file` |
| `bridge/.env.example` | `afirez/clawhip-feishu/.env.example` | 保留原变量；新增 `INJECT_MODE`/`CODEX_BIN`/`OMX_BIN`/`CODEX_WORKDIR`/`EXEC_TIMEOUT_MS`/`FEISHU_RESULT_MODE`/`MENTION_REQUIRED`/`FEISHU_MSG_TYPE`/`RESULT_MAX_CHARS`；**v2 新增** `FEISHU_ALLOWED_OPEN_IDS`/`FEISHU_FORWARD_NON_WHITELIST`/`INJECT_FALLBACK_MODE`，`COMMAND_PREFIX` 语义改为「可选显式指令标记」 |
| `bridge/clawhip.config.example.toml` | `afirez/clawhip-feishu/clawhip.config.example.toml` | `feishu.message`/`feishu.command` 改走 `localfile` 审计（防回声）；新增 `custom.*` 路由；`local_path` 因 clawhip 不做环境变量展开，改用显式完整 Windows 路径 |

**关键事实核验记录**（均为克隆仓库实测，非推测）：

1. clawhip `RouteRule` 字段 `event/filter/sink/channel/thread/channel_name/webhook/slack_webhook/local_path/mention/allow_dynamic_tokens/format/template/gajae`（`clawhip/src/config.rs:180-208`）；仅设 `slack_webhook` 时 `effective_sink` 判为 `slack`（`:247-256`）；`format` kebab-case（`src/events.rs:14-22`）。
2. clawhip Slack webhook 载荷 `{"text": content, "blocks": […]}`（`clawhip/src/slack.rs:55-96`）→ 桥 sink 提取 `.text`；clawhip Discord webhook 透传 `{"content": content}`（`clawhip/src/discord.rs:320-332`）→ 桥兼容 `.content`。
3. omx `notifications.webhook` 强制 `https:` URL（`oh-my-codex/src/notifications/dispatcher.ts:100-107,336-341`），载荷含 `message` 字段（`:353-366`）→ 发送方向改用 clawhip 路由（§4.3、§6.3）。
4. lark SDK `im.message.reply({path:{message_id}, data:{msg_type, content}})`（`types/index.d.ts:45221-45261`，对应 `POST /open-apis/im/v1/messages/:message_id/reply`）；`im.message.create`（`POST /open-apis/im/v1/messages?receive_id_type=chat_id`）；`im.message.receive_v1` 事件体含 `sender`/`message.mentions`（`types/index.d.ts:55853-55892`）。
5. Windows npm shim 解析：`codex`/`omx` 全局安装后是 `.cmd` 壳，`execFile` 直接执行抛 EINVAL/ENOENT；桥 `resolveShim` 解析 `%dp0%\node_modules\...\*.js` 后用 `node <js>` 直调——本机实测 `codex --version`→`codex-cli 0.147.0`、`omx --version`→`oh-my-codex v0.20.3` 均通过（`shell:false`）。
6. `codex exec` 参数：`--skip-git-repo-check`、`-C <dir>`、`--json`、`-o/--output-last-message <file>`（本机 `codex exec --help` 实测）。
7. omx Reply Listener：`sendToPane()` 注入**运行中** agent 会话、**无前缀过滤**、**授权 = 配置用户 ID 白名单**（`oh-my-codex/src/notifications/reply-listener.ts`）——v2 桥白名单全注入/免前缀/运行中会话优先的基准（§2）。
8. clawhip deliver：`PROMPT_CHARS=['$','%','>','#',...]` 仅用于 prompt 态检测（`clawhip/src/hooks/prompt_deliver.rs`）；clawhip discord watch：Discord 消息 → `discord-watch.nudge-intent` local-only 持久化、不进通用路由（`clawhip/src/discord_watch.rs`）——v2 桥 deliver 语义与「非白名单不注入」的只读参考（§2）。

---

*本文为 `di-feishu-direct-20260814` + `di-align-discord-usage-20260814` 规格交付物；代码与配置在 `bridge/` 目录内可直接使用。未实际部署运行（规格 Non-Goals），验证步骤见 §7.3。omx/clawhip 源码零改动（只读基准）。*
