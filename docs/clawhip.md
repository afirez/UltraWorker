# clawhip（gajae-claw）源码级参考文档

> 本文档基于仓库克隆版本 **v0.6.11**（`Cargo.toml:3`，CHANGELOG 最新条目 `CHANGELOG.md:3`）。
> 品牌定位（README.md:15）：**「gajae-claw (clawhip) is the control plane for agents」**——把 GitHub、Discord、tmux 等工具的事件路由给正确的人或代理，记录发生了什么，并把"可自动执行的动作"与"需要人工批准的动作"分开。
> 架构分水岭为 **v0.3.0**（`CHANGELOG.md:203-217`）：类型化事件模型、多投递路由、事件源抽取、渲染/传输分离。本仓库当前已演进到 0.6.x，但 v0.3+ 的机制骨架全部保留并扩展。
> 引用路径均相对于克隆根 `repos/clawhip/`。所有行号均已在克隆文件中核对。

---

## 一、概览

clawhip 是一个 **daemon-first（守护进程优先）** 的「事件→频道」通知路由器，用 Rust 编写（axum HTTP + tokio 运行时）。

### 1.1 总体数据流（ARCHITECTURE.md:16-23，README.md:370-379）

```text
[CLI / webhook / git / GitHub / tmux / cron / workspace / 原生钩子]
              -> [sources（事件源）]
              -> [mpsc 队列（bounded, 256）]
              -> [dispatcher（分发器）]
              -> [router（路由 0..N） -> renderer（渲染） -> sink（传输）]
              -> [Discord REST / Slack webhook / localfile 投递]
```

### 1.2 核心组件分层（ARCHITECTURE.md:25-81）

| 层 | 模块 | 职责 |
|---|---|---|
| 事件模型 | `crate::event`（event/mod.rs, event/body.rs, event/compat.rs）+ `crate::events`（events.rs） | 旧式 `IncomingEvent` 入口归一化为类型化 `EventEnvelope` |
| 事件源 | `crate::source`（source/mod.rs, git.rs, github.rs, tmux.rs, workspace.rs）+ `crate::cron` + `crate::discord_watch` | 轮询/监听/入口，统一向 daemon 的 mpsc 队列推 `IncomingEvent` |
| 分发器 | `crate::dispatch`（dispatch.rs） | 队列消费者：解析投递→渲染→交给 sink，best-effort |
| 路由 | `crate::router`（router.rs） | 0..N 多投递解析、事件族匹配、filter、mention、令牌门控 |
| 渲染 | `crate::render`（render/mod.rs, render/default.rs） | compact/alert/inline/raw 四种格式 |
| 传输 | `crate::sink`（sink/*）+ `crate::discord` + `crate::slack` | Discord 频道/线程/webhook、Slack webhook、localfile |
| 配置 | `crate::config`（config.rs） | `~/.clawhip/config.toml` 全量配置 + 归一化 + 校验 |
| 控制面 | `crate::native_hooks`、`crate::hooks`、`crate::gajae`、`crate::memory`、`crate::lifecycle`、`crate::plugins` | 原生钩子、deliver、GAJAE 桥、内存脚手架、安装生命周期、插件 |

### 1.3 默认端点与命令面

- 默认 daemon 端点：`http://127.0.0.1:25294`（README.md:255；config.rs:596-600 `default_port`/`default_base_url`）
- 完整命令面：`cli.rs:44-166` 的 `Commands` 枚举（Start/Status/Setup/Send/Deliver/Emit/Git/Github/Agent/Tmux/Native/Cron/Install/Update/Uninstall/Plugin/Config/Memory/Hooks/Explain/Gajae/Release），入口分发在 `main.rs:88-469` `real_main`。

---

## 二、机制清单表

| # | 机制 | 源码位置 | 一句话说明 |
|---|---|---|---|
| M1 | 类型化事件模型 | event/mod.rs, body.rs, compat.rs, events.rs | 旧式事件→类型化 `EventEnvelope`（40+ 变体）归一化 |
| M2.1 | 事件源：git 轮询 | source/git.rs | `git worktree list` 轮询，产出 `git.commit`/`git.branch-changed` |
| M2.2 | 事件源：GitHub 轮询 | source/github.rs | 轮询 issue/PR/CI/release 快照差异 |
| M2.3 | 事件源：GitHub Webhook 入口 | daemon.rs:998 `post_github` | `/github` HTTP webhook 入站 |
| M2.4 | 事件源：tmux | source/tmux.rs | 关键字命中与 stale 检测 |
| M2.5 | 事件源：workspace 状态文件 | source/workspace.rs | inotify/轮询 diff 状态 JSON |
| M2.6 | 事件源：cron | cron.rs | 定时任务调度产出事件 |
| M2.7 | 事件源：Agent 生命周期 CLI | main.rs:157-199, events.rs:186-278 | `clawhip agent started/blocked/finished/failed` |
| M2.8 | 事件源：Discord Watch sidecar | discord_watch.rs | 消息→nudge intent，本地持久化、不入队 |
| M2.9 | 事件源：Provider 原生钩子（Codex/Claude） | native_hooks.rs + daemon.rs:339 | 五个共享钩子事件→session.* 家族 |
| M3 | 路由配置（config.toml） | config.rs | `[[routes]]` event→filter→sink→channel |
| M4 | 路由解析器 Router | router.rs | 0..N 多投递、事件族匹配、glob filter |
| M5 | 渲染器 Renderer | render/default.rs | compact/alert/inline/raw |
| M6 | 传输层 Sink | sink/*, discord.rs, slack.rs | Discord/线程/Webhook、Slack、localfile |
| M7 | 守护进程架构 | daemon.rs | sources→mpsc(256)→dispatcher→sinks |
| M8 | 分发器与批处理 | dispatch.rs | 队列消费 + CI/例行批处理 |
| M9 | Native Hook CLI | cli.rs:430-481, main.rs:283-303 | `clawhip native hook --provider codex/claude` |
| M10 | 钩子安装 + native-hook.mjs 桥 | hooks/mod.rs, native_hooks.rs:386 | `clawhip hooks install` 写入 `.codex/hooks.json`/`.claude/settings.json` |
| M11 | Deliver 提示恢复 | hooks/prompt_deliver.rs | 向已运行会话重试 Enter 注入 prompt |
| M12 | Memory 命令 | memory.rs | `memory init/status/scaffold-channels` |
| M13 | Status 命令 | main.rs:98-103, daemon.rs:285 | daemon 健康检查 |
| M14 | Gajae 集成 | gajae.rs + daemon.rs:714 | CLI 桥（status/preflight/doctor/profile…）+ daemon 侧处理器 |
| M15 | 生命周期 install/update/uninstall | lifecycle.rs, update.rs | 安装/更新/卸载 + systemd + star 提示 |
| M16 | 动态令牌 | dynamic_tokens.rs + router.rs:233 | `{sh:}` `{tmux_tail:}` 等 11 种令牌 |
| M17 | 网关白名单校验 | gateway_allowlist.rs | 校验 Clawdbot 网关 allowlist 覆盖 |
| M18 | 绑定校验 | binding_verify.rs + discord.rs:225 | Discord 频道实时绑定审计 |
| M19 | 插件架构 | plugins.rs | plugin.toml + bridge.sh 扫描 |
| M20 | tmux wrapper | tmux_wrapper.rs | `tmux new/watch/list` 启动与注册 |
| M21 | Explain 命令 | main.rs:652, router.rs:254 | 无投递的路由推演 |
| M22 | 发布预检 + 更新检查器 | release_preflight.rs, update.rs:63 | 发布一致性门禁 + daemon 内更新检查 |
| M23 | 遥测与可观测性 | telemetry.rs, native_observability.rs, provenance.rs | 事件追踪、原生钩子可观测、路由来源 |

---

## 三、逐机制详解

每个机制统一给出四部分：**能力说明 / 用法（原生宿主 + OpenCode 适配缺口）/ 源码实现原理 / 实现链路**。

---

### M1 类型化事件模型（Typed Event Envelopes）

**能力说明**：clawhip 对外仍接收旧式扁平事件 `IncomingEvent`，在内核将其归一化并转换成类型化内部事件 `EventEnvelope`，从而获得类型安全的事件管道（ARCHITECTURE.md:27-29 明确说明这是 v0.3.0 引入的架构）。

**用法**：
- 原生宿主：所有入口（HTTP `/api/event`、GitHub webhook、tmux/git/github 来源、原生钩子）最终都以 `IncomingEvent` 形态进入；CLI 侧 `clawhip emit/agent/git/github/tmux` 构造该形态（`main.rs:105-199`）。
- OpenCode 适配缺口：OpenCode 没有现成"事件信封"概念；适配层需要自行把 OpenCode 状态映射为 `IncomingEvent` JSON（`type` + `payload` 字段），再 POST 到 `/api/event`（见 M9 的桥接方案）。

**源码实现原理**：
- 入站线格式：`events.rs:45-59` `IncomingEvent`（`kind`（JSON 别名 `type`）、`channel`、`mention`、`format`、`template`、`payload`）；`events.rs:79-116` 自定义 `Deserialize`，把扁平额外字段并入 `payload`。
- 构造器家族：`events.rs:118-717`（`custom:130`、`agent_started:186`、`agent_blocked:209`、`agent_finished:232`、`agent_failed:256`、`github_issue_opened:280`、`git_commit:329`、`github_pr_status_changed:421`、`tmux_keyword:631`、`tmux_stale:695` 等）。
- 归一化管线：`events.rs:880-890` `normalize_event`（包装 payload、规范化 kind、注入元数据）；`events.rs:892` `canonical_event_kind`；`events.rs:900` `native_contract_kind`；`events.rs:919-953` `map_native_signal`（含 `question.requested→session.blocked` 的 `:923-925` 映射）；`events.rs:955-1271` `normalize_native_metadata`。
- 类型化信封：`event/mod.rs:18-24` `EventEnvelope`（id: Uuid、timestamp、source、body、metadata）；`event/mod.rs:26-66` `EventBody` 枚举（40+ 变体，覆盖 git/GitHub/Discord/tmux/Agent/Workspace/Custom 全部家族）；`event/mod.rs:68-75` `EventMetadata`；`event/mod.rs:77-84` `EventPriority`。
- 类型体结构：`event/body.rs:4-150`（`GitCommitEvent:4`、`GitCommitAggregatedEvent:13`、`GitHubIssueEvent:28`、`GitHubPRStatusEvent:44`、`GitHubCIEvent:54`、`AgentEvent:100`（26 字段）、`WorkspaceEvent:128`、`CustomEvent:146` 等）。
- 兼容转换层：`event/compat.rs:14-16` `from_incoming_event`；`:45-165` `body_for`（kind→EventBody 大派发）；`:167` `git_commit_body`；`:243` `github_pr_body`；`:315` `agent_event`；`:360` `workspace_event`；`:411` `priority_for`（failed→Critical、blocked/stale→High）。
- 入口强校验：`main.rs:82-86` `prepare_event`（先 `normalize_event` 再 `from_incoming_event` 验证，CLI 侧失败即报错）；daemon 侧 `daemon.rs:605-620` `accept_event` 同样用 `from_incoming_event` 验证，失败返回 400。

**实现链路**：CLI/HTTP/来源构造 `IncomingEvent` → `normalize_event`（events.rs:880）→ `from_incoming_event`（compat.rs:14）→ `EventEnvelope`（含 event_id）→ 入 mpsc 队列（daemon.rs:104）→ dispatcher 消费。

---

### M2.0 事件来源总览（Source trait 与 daemon 装配）

**能力说明**：v0.3.0 把监控逻辑抽成显式"来源"，统一实现 `Source` trait，向共享 mpsc 队列推事件（ARCHITECTURE.md:40-48）。

**源码实现原理**：
- `source/mod.rs:19-22` `trait Source: Send + Sync`：`fn name()` + `async fn run(&self, tx: mpsc::Sender<IncomingEvent>)`。
- daemon 装配：`daemon.rs:124-134` `spawn_source(GitSource::new(..), tx.clone())` 等五个来源 + `daemon.rs:187-217` 通用 `spawn_source`（启动/停止遥测，失败时 `daemon.rs:219` `source_failure_alert_event` 以 degraded alert 形式推入队列）。
- 队列容量：`daemon.rs:42` `EVENT_QUEUE_CAPACITY = 256`（bounded mpsc）。

**用法 / OpenCode 缺口**：OpenCode 适配不依赖任何特定来源；可借助 M2.5 workspace 状态文件轮询把 OpenCode 的状态 JSON（会话、回合、技能激活等）映射为 `workspace.*` 事件，或走 M2.7 的 agent 生命周期 CLI。

---

### M2.1 事件源：git 轮询

**能力说明**：轮询配置的本地 git 仓库（含 linked worktree），产出 `git.commit` 与 `git.branch-changed`（README.md:478-492 预设 #6）。

**用法**：配置 `[[monitors.git.repos]]`（`config.rs:327-349` `GitRepoMonitor`：path/name/remote/github_repo/emit 开关/channel/mention）；或薄客户端 `clawhip git commit ...` / `clawhip git branch-changed ...`（`main.rs:115-133`）。
- OpenCode 缺口：OpenCode 仓库的 commit 事件可用 `clawhip git commit` 或 daemon 轮询直接覆盖，无原生支持需求。

**源码实现原理**：
- `source/git.rs:16` `GitSource`；`:32` `Source::run`（无限轮询循环）；`:109` `poll_git`；`:117-243` `poll_git_at`（核心：`git worktree list --porcelain` 发现路径 → 快照 → 分支变化 `:170-187` 与提交 `:188-220` 事件通过 `send_event` 发出）。
- 状态与故障处理：`:45` `GitRepoState`、`:51` `GitMonitorState`、`:66` `GitMonitorFailureClass`、`:435-456` `should_skip_failed_monitor`、`:478-523` `record_monitor_failure`、`:525-532` `git_monitor_backoff`。
- 发送：`:285-289` `send_event`（直接推入 daemon tx）。

**实现链路**：`GitSource::run` → `poll_git_at`（快照 HEAD/分支/远程，git.rs:303 `snapshot_git_worktree`）→ 差异→ `IncomingEvent::git_commit`/`git_branch_changed`（events.rs:329/401）→ `send_event` → mpsc → dispatcher。

---

### M2.2 事件源：GitHub 轮询

**能力说明**：轮询配置仓库的 issue/PR/CI 状态，产出 `github.issue-opened/commented/closed`、`github.pr-status-changed`、`github.ci-started/passed/failed/cancelled`（README.md:406-477 预设 #2-#5）。

**用法**：配置 `[[monitors.git.repos]]` 的 `github_repo` 与 token（`config.rs:291-293` `github_token`/`github_api_base`；环境变量 `CLAWHIP_GITHUB_TOKEN`，`config.rs:1297-1300`）；薄客户端 `clawhip github issue-opened / pr-status-changed`（`main.rs:134-156`）。CI 事件受 `[dispatch].ci_batch_window_secs`（默认 30s，`config.rs:617`）批处理窗口影响。
- OpenCode 缺口：无；与 OpenCode 无关的纯 GitHub 轮询。

**源码实现原理**：
- `source/github.rs:18` `GitHubSource`；`:34` `Source::run`；`:117-132` `run_github_poll_cycle`；`:164-254` `poll_github`（每仓库协调 issue/PR/CI 轮询并持久化 `GitHubRepoState:60`）。
- `:256-303` `poll_issues`（fetch+diff，经 `:494-543` `collect_issue_events` 发新开/关闭/评论）；`:305-364` `poll_pull_requests`（状态转换 `:324-346` 发 PR 事件）；`:366-441` `poll_ci_statuses`（baseline 感知，`:545-597` `collect_ci_events` 发 CI 事件）。
- API 层：`:823-839` `build_github_client`（bearer token）；`:467-492` `github_get`；DTO `:841-905`。
- 发送：`:461-465` `send_event`。

**实现链路**：`GitHubSource::run` → `run_github_poll_cycle` → `poll_issues/poll_pull_requests/poll_ci_statuses` → 快照 diff → `IncomingEvent::github_*` → `send_event` → mpsc → dispatcher（CI 事件进 `GitHubCiBatcher`，见 M8）。

---

### M2.3 事件源：GitHub Webhook 入口

**能力说明**：`/github` HTTP 端点是 GitHub webhook 入站（README.md:409 提到 `issues.opened` 等）。

**源码实现原理**：
- 路由注册：`daemon.rs:156` `/.route("/github", post(post_github))`。
- 处理：`daemon.rs:998` `post_github`——解析 `x-github-event` 头，把 issues/release/PR 载荷构造成类型化事件；release/merge 动作会走 gajae hold 路由（`daemon.rs:976` `gajae_hold_target`），最终 `enqueue_event`（`daemon.rs:1267`）入队。

**实现链路**：GitHub webhook → POST `/github` → `post_github` → `IncomingEvent::github_*`（或 gajae hold 事件）→ 入队。

**用法 / OpenCode 缺口**：OpenCode 无 webhook 概念；若在 OpenCode 工作流里需要 GitHub 通知，直接用该端点 + GitHub webhook 配置即可，无需 OpenCode 参与。

---

### M2.4 事件源：tmux

**能力说明**：监控 tmux 会话的关键字命中（`tmux.keyword`）与 stale 检测（`tmux.stale`）（README.md:556-584 预设 #9-#10）；维护会话注册表 `SharedTmuxRegistry`。

**用法**：配置 `[[monitors.tmux.sessions]]`（`config.rs:369-399` `TmuxSessionMonitor`：session 模式/keywords/keyword_window_secs/stale_minutes/channel）；或 `clawhip tmux keyword/stale` 薄客户端（`main.rs:246-273`）；或 M20 的 `tmux new/watch` 注册路径。`stale_minutes = 0` 显式禁用 stale（CHANGELOG.md:191）。
- OpenCode 缺口：若 OpenCode 运行在 tmux pane 中，该机制可直接监控其输出关键字与停滞状态，是"桥接"最省事的路径之一（见 M20 备注）。

**源码实现原理**：
- `source/tmux.rs:93` `TmuxSource`；`:110` `Source::run`；`:307-507` `poll_tmux`（解析注册会话→快照 pane→stale `:447-462` 与关键字窗口 flush `:383`；死会话注销）。
- `:51-72` `RegisteredTmuxSession`（含 routing 元数据、parent_process、registration_source）；`:24` `SharedTmuxRegistry` 类型别名。
- 关键字聚合：`:824-852` `flush_pending_keyword_hits`、`:854-877` `flush_session_pending_keyword_hits`（窗口聚合，`keyword_window.rs` 提供窗口原语）；`:696-747` `tmux_keyword_event`（单条/聚合 payload）。
- stale：`:684-694` `should_emit_stale`；`:806-822` `tmux_stale_event`。
- 包装监控：`:177-282` `monitor_registered_session`（wrapper 前台监控，经 `DaemonClient` 发事件）；`:132-151` 私有 `EventEmitter` trait（mpsc Sender / DaemonClient 两种实现）。
- 注册列表：`:284-305` `list_active_tmux_registrations`（支撑 `clawhip tmux list`）。

**实现链路**：`TmuxSource::run`/wrapper → `poll_tmux`/`monitor_registered_session` → `tmux_keyword_event`/`tmux_stale_event` → `send_event`（daemon）/`DaemonClient`（wrapper）→ mpsc → dispatcher。

---

### M2.5 事件源：workspace 状态文件

**能力说明**：监听/轮询状态 JSON 文件（`.clawhip/state/`、会话/turn/技能/指标等），产出 `workspace.session-started`、`workspace.turn-complete`、`workspace.skill-activated`、`workspace.session-blocked`、`workspace.metrics-update` 等。

**用法**：配置 `[monitors.workspace]`（`config.rs:401-433` `WorkspaceMonitor`：path/watch_dirs/discover_worktrees/channel/mention/format/events/poll_interval_secs/debounce_ms）。
- OpenCode 缺口：**这是 OpenCode 适配的重要锚点**——把 OpenCode 的状态文件（若存在）注册为 workspace monitor，或为 OpenCode 写一个状态 JSON 落盘脚本，即可复用整个 `workspace.*` 事件管线。

**源码实现原理**：
- `source/workspace.rs:19` `WorkspaceSource`；`:35` `Source::run`（Linux 上 `:124-182` `run_with_inotify`，否则 `:114-122` `run_with_polling`；`:184-193` `inotifywait_available`）。
- 差异引擎：`:428-459` `diff_workspace_state`（按状态文件分发到 `diff_session:461`、`diff_skill_state:577`、`diff_metrics_state:620`、`diff_team_state:747` 等十余个 diff）；`:827-831` `workspace_event` 构造事件。
- 签名与去抖：`:365` `snapshot_signatures`、`:395` `file_signature`、`:852-861` `debounce_for_path`。

**实现链路**：inotify/轮询感知文件变化 → `reconcile` → `flush_due_with_topology`（workspace.rs:245）→ `diff_workspace_state` → `workspace_event` → 推入 tx。

---

### M2.6 事件源：cron

**能力说明**：cron 调度源，按 `[cron]` 配置定时产出事件（`custom-message` 等 kind）；含零积压（zero-backlog）抑制逻辑（cron.rs:434-594）。

**用法**：`[cron]` 段（`config.rs:516-578` `CronConfig`/`CronJob`，`CronJobKind:579`）；`clawhip cron run <id>` 手动触发（`main.rs:304-310` → `cron.rs:76` `run_configured_job`）。状态文件由 `cron.rs:118-123` `default_state_path` 决定。
- OpenCode 缺口：无；OpenCode 可用 `clawhip cron run` 或写 cron job 事件。

**源码实现原理**：`cron.rs:19` `CronSource`；`:36` `Source::run`；`:125-132` `CronScheduler`；`:175-253` `emit_due`（调度匹配 `:278` `matches`，构建事件 `:284-322` `build_job_event`，状态持久化 `:255` `persist_state`）；时间解析 `:637-763`（`CronSchedule`/`CronField`）。daemon 装配于 `daemon.rs:131-134`。

---

### M2.7 事件源：Agent 生命周期 CLI

**能力说明**：`clawhip agent` 薄客户端产出 `agent.started/blocked/finished/failed` 四类生命周期事件（README.md:534-555 预设 #8）。

**用法**（原生宿主）：`clawhip agent started --name worker-1 --session sess-123 --project my-repo`、`clawhip agent blocked/finished/failed`（参数见 `cli.rs:391-423` `AgentCommands`/`AgentEventArgs`/`AgentFailedArgs`）。
- **OpenCode 适配推荐**：OpenCode 无原生 agent 生命周期事件，可在 OpenCode 的 session start / stop 钩子脚本里调用 `clawhip agent started/blocked/finished/failed`（参数映射到 OpenCode 会话），这是当前最直接、经过验证的桥接方式之一（`main.rs:157-199` 把这些 CLI 命令构造成事件）。

**源码实现原理**：`main.rs:157-199` `Commands::Agent` 匹配分支 → `IncomingEvent::agent_started/blocked/finished/failed`（`events.rs:186/209/232/256`，共享私有构造器 `agent_event` `events.rs:142`）→ `send_incoming_event`（`main.rs:471-474`：先 `prepare_event` 校验再 `client.send_event` POST `/event`）。渲染侧见 M5（`render/default.rs:377` `agent_context_parts` 等）。

---

### M2.8 事件源：Discord Watch sidecar

**能力说明**：默认关闭的 Discord 消息观察器（CHANGELOG.md:42）：读取 Discord 消息 → 判定 nudge intent（关键词/直接 @ 等）→ 本地持久化，**不**入队实时投递（local-only，CHANGELOG.md:42，daemon.rs:622-635）。

**源码实现原理**：
- `discord_watch.rs:90-101` `process_incoming_event`；`:103-249` `process_message`（决策引擎：owner/banned/冷却/阈值，辅助 `:392` `in_cooldown`、`:411` `is_owner`、`:419` `is_banned`、`:442` `contains_keyword_signal`）；`:314-331` `append_intent`（去重持久化）；`:476-485` `intent_to_local_event`。
- daemon 接入：`daemon.rs:622-631`（`discord.message-create` 走 `handle_discord_watch:888`，返回 `local_only_event_response:698`）；`daemon.rs:633-635`（`discord-watch.nudge-intent` 同样 local-only）。
- 配置：`config.rs:435-466` `DiscordWatchConfig`（watched_channels/banned/thresholds/cooldowns/doctrine_template）。

**用法 / OpenCode 缺口**：面向 Discord 运营；OpenCode 无涉及。

---

### M2.9 事件源：Provider 原生钩子（Codex/Claude）★ 核心机制

**能力说明**：v0.6.0 起（CHANGELOG.md:134-155）clawhip 不再把自己包装为"launcher"，而是让 Codex/Claude **拥有**会话启动与钩子注册，clawhip 只做路由/归一化/投递（README.md:142-175）。共享 v1 钩子事件仅五个：`SessionStart`/`PreToolUse`/`PostToolUse`/`UserPromptSubmit`/`Stop`（docs/native-event-contract.md:15-23，冻结于 docs/event-contract-v1.md:14-22）。派生出的路由事件为 `session.*` 家族（README.md:683-692：started/blocked/finished/failed/retry-needed/pr-created/test-started/test-finished/test-failed/handoff-needed）。

**用法（原生宿主）**：安装见 M10；验证入口为 M9 的 `clawhip native hook --provider codex|claude --file payload.json`。路由元数据基准字段（docs/native-event-contract.md:63-89）：`provider`、`event`、`session_id`、`directory`、`worktree_path`、`repo_path`、`repo_name`、`branch`、`tool_name`、`command`、`summary`、`event_timestamp`；其中 `repo_path`/`worktree_path` 是权威路由身份，`repo_name` 仅是便利元数据。
- **OpenCode 适配缺口（关键）**：clawhip **没有** OpenCode 原生 provider 钩子（`native_hooks.rs:17-22` 只定义 `.codex/hooks.json` 与 `.claude/settings.json`；`map_shared_event` 只识别 Codex/Claude 事件名）。桥接选项：
  1. **适配器转发**：写一个 OpenCode 钩子脚本（OpenCode 的钩子机制）把 OpenCode 事件 JSON 变换成 v1 信封（五事件名 + provider 字段），然后执行 `clawhip native hook --provider codex --file <transformed.json>`（或直接 POST `/api/native/hook`）。
  2. **复用 native-hook.mjs**：把 `~/.clawhip/hooks/native-hook.mjs` 作为管道端，OpenCode 侧提供适配输入；桥接脚本本身已具备 git 根推导、project.json、tmux 元数据、`.clawhip/hooks/augment/` 增强加载（native_hooks.rs:489-497）。
  3. **非 git 目录注意**：v1 契约把 git 仓库外的输入归一化为 `non_git` 结果并丢弃（docs/native-event-contract.md:86-87；daemon.rs:417-442）。OpenCode 若在非 git 目录运行，需先 `git init` 或改走 M2.7/M2.5 桥。

**源码实现原理**：
- 归一化：`native_hooks.rs:31-377` `incoming_event_from_native_hook_json`（provider/event 提取 `:34-50`、目录与 worktree `:52-67`、non_git 判定 `:68-87`、project.json 元数据 `:88-92`、question 桥 `:183-218`、augmentation/stop_context `:354-366`）。
- 事件映射：`:759-771` `map_shared_event`（SessionStart→session.started、PreToolUse→tool.pre、PostToolUse→tool.post、UserPromptSubmit→session.prompt-submitted、Stop→session.stopped）；`:773-783` `normalized_event_label`。
- Question-request 桥：`:791-840` `detect_question_request`（仅 PreToolUse/PostToolUse + 显式 ask 工具 → `question.requested` 路由键，canonical 化到 `session.blocked`）；`:842-853` `is_question_tool_name`（ask/ask_user/ask_user_question/AskUserQuestion/askuserquestion 五种）；`:884-960` `safe_question_payload`（只暴露 bounded summary/question_summary，控制字符折叠，`docs/event-contract-v1.md:24-34`）。
- 路由身份：`:973-1012` `load_effective_project_metadata`/`load_project_metadata_file`/`canonicalize_repo_name`；`:1026-1068` `infer_repo_root`（worktree 感知）。
- 增强：`:1079-1111` `apply_augmentation`（只增不改基准字段，`docs/native-event-contract.md:93-106`）；`:1113-1149` `apply_stop_context`。
- daemon 入口：`daemon.rs:339-455` `post_native_hook`（原始可观测 `:344-346`、归一化失败丢弃 `:382-410`、non_git 丢弃 `:417-442`、stale 重放延迟 `:444-455`；辅助 `:460` `native_payload_is_non_git`、`:487` `native_hook_should_drop`、`:512` `stale_native_replay_defer`）。
- session 家族派生：`events.rs:765-788` `canonical_kind`（`session.retry-needed:776`、`session.pr-created:777`、`session.test-*:778-780`、`session.handoff-needed:781`）；`events.rs:919-953` `map_native_signal`。

**实现链路**：Codex/Claude 钩子触发 → `native-hook.mjs`（bridge）→ `clawhip native hook` → POST `/api/native/hook`（daemon.rs:152-153 路由）→ `incoming_event_from_native_hook_json` 归一化 → non_git/重放检查 → `accept_event` → mpsc → dispatcher → `session.*`/`tool.*` 路由 → 投递。

---

### M3 路由配置（config.toml）

**能力说明**：配置文件 `~/.clawhip/config.toml`（`config.rs:585-591` `default_config_path`）。路由模型 `[[routes]]` = event（支持 `*` 通配）→ filter（`BTreeMap<String,String>`，glob 匹配）→ sink → 目标（channel/thread/webhook/slack_webhook/local_path）→ mention → format → template → `allow_dynamic_tokens`（README.md:698-760 路由契约）。

**用法（原生宿主）**：见 README.md:708-741 路由示例（`github.*`→discord+channel、`session.*` filter `{tool="omx", repo_name=...}`、`agent.*` filter `{project=...}`）。Discord 线程目标用显式 `thread = "DISCORD_THREAD_ID"`（README.md:749-760；config.rs:190-196）。
- OpenCode 缺口：路由本身与宿主无关——OpenCode 桥接产生的事件直接用同套 `[[routes]]`；建议 filter 优先用 `provider`、`event`、`worktree_path`、`repo_path`、`repo_name`、`branch`、`tool_name`（docs/native-event-contract.md:108-132）。

**源码实现原理**：
- 根配置：`config.rs:14-38` `AppConfig`（discord/providers/dispatch/daemon/defaults/routes/monitors/cron/discord_watch/update/gajae 全字段）。
- 路由：`config.rs:180-208` `RouteRule`；`:210-217` `GajaeRouteAction`（subcommand/args/requires_approval）；`:246-285` 方法集（`effective_sink:247`——有 slack_webhook 且 sink 空或 discord 时归入 slack；`discord_webhook_target:258`、`discord_thread_target:264`、`slack_webhook_target:270`、`local_file_target:276`）。
- 提供者：`config.rs:80-86` `ProvidersConfig`；`:88-94` `DiscordConfig`（`bot_token` serde 别名 `token`，`legacy_default_channel` 别名 `default_channel`，实现 `[providers.discord]` 优先 + 旧 `[discord]` 兼容，README.md:302）。
- 归并与归一化：`:702-728` `merge_legacy_discord_field`、`:773-789` `merge_legacy_discord`（旧段迁入 providers 后清零）、`:757-771` `load_or_default`、`:1388-1490` `normalize`（全部文本字段 trim）。
- 校验：`:921-1114` `validate`（dispatch 窗口 ≥1、gajae 处理器参数、每路由 sink/目标互斥规则 `:969-1063`、token 存在性）。
- 设置编辑器：`:1119-1157` `apply_setup_edits`、`:1159-1217` `scaffold_webhook_quickstart`、`:1219-1265` `apply_repo_binding`、`:1304-1386` `run_interactive_editor`（`clawhip config`）。
- 分发配置：`:131-146` `DispatchConfig`（`ci_batch_window_secs` 默认 30、`routine_batch_window_secs` 默认 5）。

**实现链路**：启动读 `~/.clawhip/config.toml` → `load_or_default`（legacy 合并 + normalize）→ `validate` → `AppConfig`（Arc 共享）→ daemon/Router/来源各自引用。

---

### M4 路由解析器 Router（多投递）

**能力说明**：一次事件可解析出 **0..N 个投递**（ARCHITECTURE.md:61-69；README.md:743-747 解析规则：①事件族匹配 ②payload filter 匹配 ③套用 route 的 sink/target/format/template/mention ④缺失走默认）。一个事件不再停在第一个匹配路由。

**源码实现原理**：
- `router.rs:65-67` `Router`（持有 `Arc<AppConfig>`）；`:100-120` `resolve`——`matching_routes_for` → 无匹配时单个 fallback 投递（`resolve_delivery(event, None, None)`），有 N 个匹配则 N 个投递。
- 投递构造：`:132-179` `resolve_delivery`（sink=`effective_sink`/`default_sink_name`，target=`target_for`，format 优先级 event>route>defaults，mention route>event，trace=Matched/Fallback/None）。
- 目标解析：`:342-409` `target_for`（discord：webhook > 事件自带 channel > thread > route/default channel；slack：`slack_webhook_target`；localfile：`local_file_target`）。
- 匹配：`:497-518` `route_candidates`（事件族映射：`git.commit`→`github.commit`、`agent.*`↔`session.*`）；`:519-533` `route_matches`（`glob_match:633` 通配 + filter 全匹配）；`:535-567` `matching_routes_for`（元数据优先路由与 session 名前缀启发式路由分流，`:569-597` `route_specificity_score` 排序：worktree_path(3)>repo_path(2)>repo_name(1)）。
- 令牌门控：`:233-252` `allow_dynamic_tokens_for`（仅 route 显式 `allow_dynamic_tokens=true` 才放行动态令牌）。
- 推演：`:254-341` `explain`（返回 `Provenance`，供 `clawhip explain` 使用，见 M21）。

**用法 / OpenCode 缺口**：与宿主无关；OpenCode 桥接事件的 filter 建议用结构元数据而非渲染文本（docs/native-event-contract.md:122）。

**实现链路**：dispatcher 调 `router.resolve(event)` → `matching_routes_for`（匹配 + 排序）→ 每路由 `resolve_delivery` → `Vec<ResolvedDelivery>` → dispatcher 逐条渲染+发送（best-effort，一条失败不影响其他，ARCHITECTURE.md:111-113）。

---

### M5 渲染器 Renderer

**能力说明**：渲染与传输分离（ARCHITECTURE.md:71-75）。四种格式：compact（单行状态摘要）、inline（紧凑房间摘要）、alert（紧迫性框定）、raw（调试 JSON）（docs/native-event-contract.md:134-141）。

**源码实现原理**：
- `render/mod.rs:8-10` `Renderer` trait：`fn render(&self, event, format) -> Result<String>`。
- `render/default.rs:11` `DefaultRenderer`；`:14-333` `render` 按 canonical kind + format 大派发（fallback raw→pretty JSON）。
- 关键渲染函数：`:424` `render_session_event`（`:449` `session_status_label`、`:467` `session_detail_suffix`）、`:592` `render_github_ci`、`:621` `render_batched_github_ci`、`:707` `render_github_release`、`:739` `render_gajae_hold`、`:791` `render_aggregated_git_commit`、`:868` `render_aggregated_tmux_keyword`、`:931` `render_workspace_event`。
- 模板与令牌：`events.rs:795-829` `template_context`（扁平化 payload+别名）；`events.rs:871-878` `render_template`（`{key}` 替换，静态上下文）；M16 动态令牌在 `router.rs:195-231` `render_delivery_body` 串联。

**用法 / OpenCode 缺口**：OpenCode 桥接可给事件显式带 `format`/`template` 字段（`IncomingEvent` 支持，events.rs:50-56），或依赖 route 配置。

**实现链路**：dispatcher `send_delivery`（dispatch.rs:258）→ `router.render_delivery`（router.rs:181，mention 前缀）→ `render_delivery_body` → `DefaultRenderer::render` 或模板 → `SinkMessage` → sink。

---

### M6 传输层 Sink（Discord / Slack / localfile）

**能力说明**：`Sink` trait 抽象传输（ARCHITECTURE.md:77-81）。目标类型：Discord 频道/线程/webhook、Slack webhook、本地文件（JSONL）。

**源码实现原理**：
- `sink/mod.rs:16-22` `SinkTarget` 枚举；`:24-31` `SinkMessage`（event_kind/format/content/payload/telemetry）；`:42-45` `Sink` trait（`async fn send`）。
- `sink/discord.rs:11` `DiscordSink`（`:21` `from_config`；`:27` `send` 委托 `DiscordClient`）；`sink/slack.rs:8` `SlackSink`；`sink/local_file.rs:11` `LocalFileSink`（`:60-84` `send` 追加 JSONL：event_kind/format/content/摘要 payload）。
- daemon 装配：`daemon.rs:94-100` sinks map（"discord"/"slack"/"localfile"）。
- Discord 客户端（`discord.rs`）：`:26` `DiscordClient`；`:34` `DiscordState`（TokenBucket 限流 + 每目标 CircuitBreaker + DLQ）；`:19-24` 常量（MAX_ATTEMPTS=3、CIRCUIT_FAILURE_THRESHOLD=3、RATE_LIMIT_CAPACITY=5 等）；`:60-91` `from_config`（bot/webhook 双客户端，`CLAWHIP_DISCORD_API_BASE` 可覆盖）；`:93-223` `send`（熔断检查→限流延迟→按目标分发→429 重试（`retry_after`+抖动）→耗尽入 DLQ `:433`）；`:274` `send_message`、`:297` `send_thread_message`、`:320` `send_webhook`（追加 `?wait=true`，`:593`）；`:225-273` `lookup_channel`（绑定校验专用只读探测）；`:363` `allow_request`、`:388/402` `record_success/record_failure`。
- Slack 客户端（`slack.rs`）：`:7` `SlackClient`；`:19` `send`（只接受 `SlackWebhook`）；`:31` `send_webhook`；`:55-68` `webhook_payload`（text + Block Kit blocks `:70`）。
- 核心原语：`core/rate_limit.rs:4` `TokenBucket`；`core/circuit_breaker.rs:16` `CircuitBreaker`；`core/dlq.rs:22` `Dlq`。

**用法 / OpenCode 缺口**：与宿主无关；OpenCode 桥接事件同样经 route 的 sink 字段投递到任意 sink。

**实现链路**：dispatcher `send_sink_message`（dispatch.rs:392）→ `sink.send(target, message)` → Discord REST / Slack webhook POST / 文件追加 → 失败遥测（`SINK_SEND_FAILED`）但不中断其他投递。

---

### M7 守护进程架构（sources→queue→sinks）

**能力说明**：daemon 是唯一常驻进程：HTTP 入口 + 来源装配 + mpsc 队列 + dispatcher + 更新检查器（README.md:254-255 默认端点；ARCHITECTURE.md:109-114 投递语义：per-source FIFO、best-effort、无内置重试队列）。

**源码实现原理**：
- `daemon.rs:61-71` `AppState`（config/port/tx/tmux_registry/pending_update/native_observability/cron_state_path/discord_watch_lock）。
- `daemon.rs:73-185` `run`：`config.validate()` → sinks map（:94-100）→ renderer/router（:101-102）→ `mpsc::channel(EVENT_QUEUE_CAPACITY)`（:104，容量 256 见 :42）→ spawn dispatcher（:110-123）→ spawn 五个来源（:124-134）→ spawn 更新检查器（:141-144）→ axum 路由（:146-159）→ bind + serve（:172-183）。
- HTTP 路由表（:146-159）：`/health`（:147）、`/api/status`（:148）、`/event`|`/api/event`|`/events`→`post_event`（:149-151）、`/native/hook`|`/api/native/hook`→`post_native_hook`（:152-153）、`/api/tmux/register`→`register_tmux`（:154）、`/api/tmux`→`list_tmux`（:155）、`/github`→`post_github`（:156）、`/api/update/status|approve|dismiss`（:157-159）。
- 接受路径：`:323-337` `post_event`（stale 重放延迟 `:328-334` → `accept_event`）；`:605-642` `accept_event`（信封验证→discord-watch local-only→gajae handler→enqueue）；`:644-696` `enqueue_accepted_event`（202 + event_id 或 503）。
- 健康检查：`:285-317` `health`/`health_payload`（版本、token_source、路由数、监控数、tmux 注册、原生钩子可观测快照）。

**用法**：`clawhip` 或 `clawhip start`（`main.rs:93-97`）启动；`clawhip status` 查看健康（M13）。
- OpenCode 缺口：无；OpenCode 适配只作为事件生产者，daemon 全程不感知宿主差异。

**实现链路**：`main.rs:97` `daemon::run` → validate → 建队列 → 起 dispatcher/来源/更新检查器 → axum serve → 各入口入队 → dispatcher 出队分发。

---

### M8 分发器与批处理（Dispatcher）

**能力说明**：队列消费者。逐事件：①router 解析投递 ②渲染 ③交给 sink ④单条失败继续（ARCHITECTURE.md:50-59）。v0.5.2 起引入例行程式批处理（`[dispatch].routine_batch_window_secs`，默认 5s，0 关闭；CHANGELOG.md:190）与 GitHub CI 批处理（`ci_batch_window_secs`，默认 30s）。

**源码实现原理**：
- `dispatch.rs:22-31` `Dispatcher`；`:34` `new`；`:73-103` `run`（`tokio::select!`：rx.recv 与 1s ticker；CI 事件进 `ci_batcher.observe`，其他走 `resolve_and_dispatch`；`None => break` 干净停机）。
- 单事件分发：`:164-218` `resolve_and_dispatch`（解析→每条 delivery：例行批处理判定→`routine_batcher.observe` 或立即 `send_delivery`）；`:258-309` `send_delivery`（查 sink→渲染→`SinkMessage`→`send_sink_message`）。
- 例行批：`:559-637` `RoutineDeliveryBatcher`（`:494-504` `should_batch_routine_delivery` 仅 discord sink + 非 CI + 非 bypass；`:896-902` `should_bypass_routine_batch`：`*.failed`/`*.blocked`/`tmux.stale`/`github.ci-*` 绕过）；`:311-390` `send_routine_batch`（多条合并为单条 `dispatch.routine-batched` 消息，抑制 2+ 条的 mention，README.md:304）。
- CI 批：`:526-557` `GitHubCiBatcher`（`:649-770` `observe` 按 `ci_batch_key:858` 合并同 run 作业，`:790-845` `flush_batch` 聚合为单条 `github.ci-*`（`batched:true`））。
- 计时原语：`core/timer_wheel.rs:7` `TimerWheel`（`DelayedEntry` 版本化，防 stale flush，dispatch.rs:520 `ScheduledBatchKey`）。

**用法 / OpenCode 缺口**：OpenCode 桥接的大量例行事件（如 tool 记录）会自动受益于例行批处理降噪；需即时提醒的事件建议走 `*.failed`/`*.blocked` 等绕过路径。

**实现链路**：rx 收到事件 → `normalize_event` → CI？→`GitHubCiBatcher`/例行批 延迟 flush 或立即 `resolve_and_dispatch` → `router.resolve` → `send_delivery`/`send_routine_batch` → sink。

---

### M9 Native Hook CLI（`clawhip native hook`）

**能力说明**：把任意 provider 原生钩子载荷送入 daemon 的本地薄客户端入口（README.md:148-162、docs/native-event-contract.md:50-61）。

**用法（原生宿主）**：`clawhip native hook --provider codex --file payload.json`、`--provider claude`、或 `cat payload.json | clawhip native hook --provider codex`（`cli.rs:436-452` `NativeHookArgs`：provider/file/source；stdin 读取 `cli.rs:469` `read_payload_from_stdin`）。
- **OpenCode 适配缺口**：这是 OpenCode 桥接的**推荐挂载点**之一——OpenCode 钩子脚本把自身事件映射成 v1 信封后调用 `clawhip native hook --provider codex --file <json>`（`--provider` 会注入 payload.provider，`main.rs:287-292`；`--source` 同理 `:293-298`）。

**源码实现原理**：`cli.rs:430-434` `NativeCommands` 枚举；`main.rs:283-303` `Commands::Native` 分支（读 payload → 注入 provider/source → `client.send_native_hook(&payload)` → 打印响应）；`client.rs:28-30` `send_native_hook`（POST `/api/native/hook`）；daemon 侧见 M2.9。

**实现链路**：payload.json/stdin → `read_payload` → provider/source 注入 → POST `/api/native/hook` → `post_native_hook`（daemon.rs:339）→ 归一化/丢弃/延迟 → 入队。

---

### M10 钩子安装 + native-hook.mjs 桥（`clawhip hooks install`）

**能力说明**：一次性安装 Provider 原生钩子注册（CHANGELOG.md:161-171 演进自 OMC/OMX 一次性安装器）。把共享桥接脚本 `~/.clawhip/hooks/native-hook.mjs` 安装到 `~/.clawhip/hooks/`，并把五个共享事件写进 provider 自有配置文件（README.md:164-171 推荐安装模型）。

**用法（原生宿主）**：`clawhip hooks install --provider codex --scope global|project`（Codex 支持 project；写入 `~/.codex/hooks.json` 或 `<repo>/.codex/hooks.json`，README.md:167）；`clawhip hooks install --provider claude-code --scope global`（Claude 仅 global，写入 `~/.claude/settings.json`，README.md:168）；`--all --scope global --force` 刷新（CHANGELOG.md:153）。旧 `--scope project` 对 Claude 会拒绝（hooks/mod.rs:59-75）。
- **OpenCode 适配缺口**：clawhip 没有 OpenCode 的"provider 配置文件"概念。OpenCode 适配需把 M2.9 的适配器挂在 OpenCode 自己的钩子配置上（OpenCode 配置的 hooks 段），把输出指向 `clawhip native hook` 或直接 POST daemon；桥接脚本本体可复用（`.clawhip/hooks/native-hook.mjs` 的 git 根推导/project.json/增强加载均为通用逻辑，native_hooks.rs:386 起的内嵌脚本）。

**源码实现原理**：
- `cli.rs:852-866` `HookProvider`（Codex/ClaudeCode，值 "codex"/"claude-code"）；`:867-872` `HookInstallScope`（Project/Global）；`:874-897` `HooksCommands`/`HooksInstallArgs`（--all/--provider/--scope/--root/--force）。
- `hooks/mod.rs:21-32` `install`；`:34-57` `run_install`（先写桥 `~/.clawhip/hooks/native-hook.mjs`（`:37` home_dir().join(HOOK_SCRIPT)），再逐 provider 写配置）；`:91-103` `write_codex_hooks`（upsert 五事件到 `.codex/hooks.json`，`:119` matcher）；`:105-117` `write_claude_settings`；`:141-180` `upsert_hook_event`（幂等 group 插入）；`:204-221` `write_generated_file`（`--force` 语义：已存在且无 force 跳过；`.mjs` 置可执行 `:270`）。
- 内嵌桥接脚本：`native_hooks.rs:386-754` `generated_hook_script`（Node .mjs）：读 stdin → `inferWorktreeRoot`/`inferRepoRoot` → 读 `.clawhip/project.json`（:424）→ 收集 tmux 元数据（:515-585）→ prompt-submit 状态写 `.clawhip/state/prompt-submit.json`（:617/:636）→ 从 `.clawhip/hooks/augment/` 加载增强模块（:489-497）→ `spawnSync('clawhip', ['native','hook','--provider',provider])` 转发（:709）。

**实现链路**：`clawhip hooks install` → `run_install` → 写 `native-hook.mjs` + `.codex/hooks.json`/`.claude/settings.json` → 会话启动时 provider 调 `node native-hook.mjs` → 桥聚合并转发 `clawhip native hook` → daemon。

---

### M11 Deliver 命令（`clawhip deliver`）

**能力说明**：向**已在运行**的 hooked tmux 托管的 Codex/Claude（含 OMC/OMX wrapper）会话投递 prompt（README.md:176-184；CHANGELOG.md:125-128）。校验 prompt-submit 钩子安装、确认 pane 是活动的 Codex/Claude 会话、然后重试 Enter 直到 `.clawhip/state/prompt-submit.json` 变化或达到次数上限。

**用法（原生宿主）**：`clawhip deliver --session <tmux-session> --prompt "..." --max-enters 4`（`cli.rs:168-179` `DeliverArgs`；默认 `DEFAULT_MAX_ENTERS=4`，`prompt_deliver.rs:13`）。前置：`clawhip hooks install --provider codex --scope global|project` 或 `--provider claude-code --scope global`（README.md:628）。deliver 拒绝任意 shell，只面向已装钩子的会话。
- **OpenCode 适配缺口**：deliver 的目标探测硬编码为 Codex/Claude（`prompt_deliver.rs:73-86` `ProviderKind`：Omc(claude-code)/Omx(codex)）。OpenCode 需要：①自己实现等价"prompt-submit marker"写入（.clawhip/state/prompt-submit.json 协议，`prompt_deliver.rs:18`/`:617`）；②扩展 `detect_active_provider`/`provider_matches_command`（:394-455）识别 opencode 进程；或改走 tmux wrapper 的通用 send-keys 路径（M20）。

**源码实现原理**：`hooks/prompt_deliver.rs:119-132` `run`；`:134-191` `deliver`（解析 pane `:193` `resolve_target_pane` → 钩子设置检测 `:241` `detect_hook_setup`（`hook_setup_at:265`，探测 Claude/Codex/OMX 各形态 `:310-393`）→ 活动 provider 判定 `:394` `detect_active_provider` → marker 基线 `:641` `read_marker_hash` → 字面键发送 `:802` `send_literal_keys` → 重试 Enter `:817` `send_key` 直到 `:696` `marker_changed` 或上限 → 进度信号 `:705` `wait_for_progress_signal`）。

**实现链路**：`clawhip deliver` → `PromptDeliverConfig`（args 映射 `:49`）→ `deliver` → `resolve_target_pane`（tmux list-panes + TARGET_PANE_FORMAT）→ `detect_hook_setup`（cwd 上溯到 worktree）→ `detect_active_provider`（进程树匹配）→ send-literal prompt → 轮询 Enter → `prompt-submit.json` hash 变化确认 → 成功。

---

### M12 Memory 命令（filesystem-offloaded memory）

**能力说明**：Claw OS 风格内存卸载模式：`MEMORY.md` 作热指针/索引层，详细内存放在 `memory/` 下的结构化分片（daily/project/channel/agent/topics/rules/lessons/handoffs/archive）（README.md:186-216）。运行时提供 bootstrap/inspect 表面。

**用法**：`clawhip memory init --project clawhip --channel discord-alerts --agent codex`（建 MEMORY.md、memory/README.md、daily 分片、project 分片、topic 文件、可选 channel/agent 分片；不覆盖已有文件除非 `--force`）；`clawhip memory status --project ... --channel ... --agent ...`（检查期望文件/目录是否存在）；`clawhip memory scaffold-channels ...`（`main.rs:354-356`，从 memory 上下文自动生成渠道仓库档案，CHANGELOG.md:20）。配置参考 `docs/memory-offload-architecture.md` 与 `docs/examples/MEMORY.example.md`。
- OpenCode 缺口：无原生冲突；OpenCode 代理可直接读写该布局（MEMORY.md + memory/ 分片为纯文件协议）。

**源码实现原理**：`memory.rs:36-59` `init`；`:61-92` `status`；`:94-142` `MemoryLayout`（from_init_args/from_status_args/build）；`:144-211` 路径族（`memory_file:144`、`daily_file:160`、`project_file:168`、`channel_file:177`、`agent_file:187`、`topics_dir:193`、`rules_file:197`、`lessons_file:201`、`handoffs_dir:205`、`archive_dir:209`）；`:213-245` `expected_dirs`/`expected_files`；`:247-267` `initialize_layout`（--force 语义）；`:269-292` `inspect_layout`；`:294-320` `scaffold_files`；`:322-332` `write_scaffold_file`；`:334-402` `render_memory_md`；`:404` `render_memory_index`；`:460` `render_daily_file`；`:488` `render_project_file`；`:508` `render_channel_file`；`:531` `render_agent_file`；`:730-790` `scaffold_channels`；`:831` `build_channel_profile_plan`；`:918` `collect_raw_bindings`。

**实现链路**：`memory init` → MemoryLayout.build → initialize_layout → scaffold_files（各 render_* 模板）→ 按 force 写盘；`memory status` → inspect_layout → 逐文件/目录存在性报告。

---

### M13 Status 命令

**能力说明**：daemon 健康/状态查询（README.md:403-404 验证表面；README.md:893）。

**用法**：`clawhip status`（输出 JSON：版本、token_source、路由数、监控数、tmux 注册、原生钩子可观测快照）。
- OpenCode 缺口：无；OpenCode 可在启动/故障恢复时调 `clawhip status` 确认 daemon 可用。

**源码实现原理**：`main.rs:98-103` `Commands::Status` → `DaemonClient::health()`（`client.rs:53-66` GET `/health`）→ 打印；daemon 侧 `daemon.rs:285-317` `health`/`health_payload`（含 `daemon.rs:287` 附近的原生钩子可观测快照）。

---

### M14 Gajae 集成（CLI 桥 + daemon 处理器）★

**能力说明**：clawhip 与 GAJAE 双项目联动。两条面：
1. **CLI 桥**（`clawhip gajae ...`，README.md:908-920）：status（GAJAE_BIN→PATH 发现 + `gajae --help` 验证）、`profile install`（转发 `gajae clawhip profile install`，GAJAE 拥有 profile 更新）、`preflight`（#257 公开安全就绪检查，不修改 cron/config、不联网、不要求 GAJAE）、`doctor`（schema 能力、handler 命令漂移、可选 dry-run onboard-plan）、`profile verify`（检查已装 profile 与 handler 命令但不执行路由；doctor/verify 永不执行 `profile install` 不污染 live profile）。
2. **daemon 侧路由处理器**（README.md:922-938）：默认关闭（`[gajae] handlers_enabled = false`）。启用后在**已批准的路由**上挂 `gajae = { subcommand = "handle-event", args = [...] }`；处理器用 `GAJAE_BIN` 或 PATH 上的 `gajae`，只运行固定白名单子命令，事件 JSON 经子进程 stdin 传入并关闭父 stdin，强制超时/输出上限，输出经 `gajae.handler.completed/failed/timeout/approval-required` 走正常路由。变异形态输出转成 approval-required 事件，不自动执行。

**用法（原生宿主）**：`clawhip gajae status`、`clawhip gajae profile install`、`clawhip gajae preflight`、`clawhip gajae doctor --repo owner/repo`、`clawhip gajae profile verify`；路由级 `gajae = { subcommand = ..., args = [...] }`（`config.rs:211-217` `GajaeRouteAction`，含 `requires_approval`）。
- OpenCode 缺口：GAJAE 是独立工具链；OpenCode 桥接可把 GAJAE 处理器当作事件消费者/审批出口，与宿主无耦合。

**源码实现原理**（CLI 侧）：
- `gajae.rs:17-18` `GAJAE_ENV`/`GAJAE_PATH_NAME`；`:19` `PROFILE_INSTALL_ARGS`；`:40-70` `SUPPORTED_EVENTS`（session.* 家族等）；`:71-72` `HANDLER_ARGS_PREFIX`/`ALLOWED_HANDLER_SUBCOMMANDS`（`handle-event`/`route-action`/`summarize-event`）。
- `:984-989` `run`（GajaeCommand 分发，枚举 `:343`）；`:991-997` `discover_gajae_with`；`:998-1021` `run_status_with`；`:1023-1050` `run_doctor`/`run_doctor_with`；`:1052-1070` `run_profile_verify`；`:1382-1386` `run_preflight`、`:1387-1488` `run_preflight_with`（检查：发现 GAJAE `:1072`、schema 能力 `:1106`、receipt 校验器 `:1138`、profile+handlers `:1162`、handler 命令 `:1199`、profile 安全 `:1241`、onboard plan `:1266`）；`:1517-1538` `run_profile_install`（转发子进程，stdout/stderr 直连；失败消息 `:1540`）。
- 更多子面：`:1551` `ReceiptSource`、`:1714` `ingest_receipt`（receipt 摄取，CHANGELOG.md:18）、`:1777` `github_mutation_plan`（变异计划）、`:1668` `zero_backlog_followup_checkpoint`（零积压检查点）、`:1841` `normalize_action_kind`、`:1856` `protected_github_action`。
- CLI 枚举：`cli.rs:483-511` `GajaeCommands`；`:513-525` `GajaeProfileCommands`；`:577-600` `GajaeReceiptCommands`；`:602-631` `GajaeMutationPlanCommands`；`:633-663` `GajaeCheckpointCommands`。`main.rs:361-464` 全部分发。

（daemon 侧处理器）：
- `daemon.rs:714-744` `run_matching_gajae_handler`（`handlers_enabled` 门 `:718`；`HandlerLimits` 从 `config.gajae` 取：`config.rs:40-50`）；`:745-753` `matching_gajae_route`（`route_specificity:779` 取最特异路由）；`:808-815` `handler_action`（GajaeRouteAction→HandlerAction）；`:816-826` `handler_event_json`（事件 JSON 进子进程 stdin）；`:827-883` `handler_outcome_event`（completed/approval-required/failed/timeout 四事件）；`:884-886` `bounded_handler_text`（512 字符诊断上限）。
- 处理器执行（`gajae.rs:105-342`）：`:105` `run_handler`；`:116-228` `run_handler_with_bin`（发现 gajae → spawn → stdin 传 JSON → 关父 stdin）；`:229-248` `spawn_handler_command`；`:249-283` `read_bounded_output`（输出上限）；`:294-304` `validate_handler_action`（白名单校验）；`:314-325` `output_requests_mutation`（变异形态→approval）；`:327-329` `bounded_bytes`。
- hold 目标：`daemon.rs:976-996` `gajae_hold_target`（release/merge 边界动作路由到 hold 频道；`config.rs:49` `hold_target_channel`）。

**实现链路（daemon 处理器）**：`accept_event`（daemon.rs:637-639）→ `run_matching_gajae_handler` → `matching_gajae_route`（route.gajae 存在 + filter 匹配）→ `run_handler`（GAJAE_BIN/PATH 发现 → 白名单子命令 → stdin JSON → 超时/输出上限）→ `handler_outcome_event` 生成 `gajae.handler.*` → 入队走正常路由 → 投递/审批。

---

### M15 生命周期：install / update / uninstall + systemd

**能力说明**：仓库即运行时（README.md:241-252）。`clawhip install`（从克隆安装 + 可选 systemd + 可选 gh star 提示）、`clawhip update`（pull + 重装 + 可选重启；subcommand: check/approve/dismiss/status）、`clawhip uninstall`（清理运行产物/配置/systemd）。systemd 单元 `deploy/clawhip.service`（README.md:855-866）。仓库本地 `./install.sh`（先试预编译 release 再回退 `cargo install --path . --force`，README.md:831-840）。

**用法（原生宿主）**：`clawhip install [--systemd] [--skip-star-prompt]`、`clawhip update --restart`、`clawhip update check|approve|dismiss|status`、`clawhip uninstall [--remove-systemd --remove-config]`（`cli.rs:103-130`）。
- OpenCode 缺口：无；OpenCode 的"安装 clawhip"自动化契约见 SKILL.md:23-39（@openclaw install → install.sh → SKILL.md → scaffold 配置 → 启动 daemon → live verification）。

**源码实现原理**：
- `lifecycle.rs:14-28` `install`（`plugins::install_bundled_plugins` 调用见 `:21`）；`:30-35` `update`；`:38-74` `update_from_repo`/`update_repo`；`:104-123` `uninstall`；`:154-229` `maybe_prompt_to_star_repo`（交互终端 + 已认证 `gh` 才提示，`--skip-star-prompt`/`CLAWHIP_SKIP_STAR_PROMPT=1` 关闭，`README.md:12`）；`:256-270` `install_systemd`；`:272-306` systemd 卸载/重启/停止。
- `update.rs:44-61` `PendingUpdate`/`new_shared_pending_update`；`:63-120` `run_checker`（daemon 内后台，`daemon.rs:141-144` spawn）；`:122-147` `check_latest_version`/`check_latest_release`（GitHub API `https://api.github.com`，`update.rs:14-15`）；`:149-189` `approve_update`/`dismiss_update`；`:205-233` `version_is_newer`/`compare_versions`。
- daemon 更新端点：`daemon.rs:157-159` 路由；`:1206` `update_status`；`:1231` `approve_update`；`:1249` `dismiss_update`。
- `main.rs:200-245` 分发：Install→lifecycle::install、Update 各子命令、Uninstall→lifecycle::uninstall。

**实现链路**：`clawhip install` → lifecycle::install → ensure_config_dir → 编译/安装 → （可选）plugins 安装 → （可选）systemd → （交互且可选）star 提示；daemon 内 `update::run_checker` 定期查 GitHub Releases → 有新版本置 `PendingUpdate` → 操作者 `update status/approve/dismiss`（HTTP 端点）→ approve 后重启流程。

---

### M16 动态令牌（Dynamic Tokens）

**能力说明**：仅 `allow_dynamic_tokens = true` 的路由启用。支持令牌（README.md:784-809）：`{repo}`、`{number}`、`{title}`、`{session}`、`{keyword}`、`{sh:...}`、`{tmux_tail:session:lines}`、`{file_tail:/path:lines}`、`{env:NAME}`、`{now}`、`{iso_time}`。安全：白名单令牌种类、路由级 opt-in、2s 短超时、输出上限。

**源码实现原理**：`dynamic_tokens.rs:13-48` `render_template`（先静态 `events.rs:871` `render_template`，再按 `allow_dynamic_tokens` 展开动态令牌）；`:50-77` `evaluate_token`；`:79-91` `run_shell_token`（`sh -lc`，2s 超时 `:9`，1200 字符上限 `:10`）；`:93-113` `run_tmux_tail_token`（`tmux capture-pane -p -S -N`）；`:115-132` `run_file_tail_token`；`:134-138` `parse_tail_spec`（200 行上限 `:11`）。门控：`router.rs:233-252` `allow_dynamic_tokens_for`；应用点 `router.rs:195-231` `render_delivery_body`。

**用法 / OpenCode 缺口**：OpenCode 桥接可在模板里用 `{env:...}`/`{file_tail:...}`/`{sh:...}` 注入上下文；注意 `{sh:}` 为显式 shell 执行，只在可信路由开启。

---

### M17 网关白名单校验（Gateway Allowlist）

**能力说明**：当 clawhip 经本地 Clawdbot 网关发送时，路由频道 ID 必须也在网关的 Discord allowlist 中（README.md:762-782）。`clawhip config verify-gateway-allowlist` 读取 `~/.clawdbot/clawdbot.json`（或 `--gateway-config`）的 `channels.discord.guilds[*].channels.<id>.allow = true`，与 clawhip 配置的 Discord 目的地比对，缺失即非零退出。输出仅计数/source 标签/频道 ID（public-safe，不 dump token/webhook/原始配置）。webhook、Slack、localfile、纯 thread 目标不在检查范围。

**源码实现原理**：`gateway_allowlist.rs:61-104` `GatewayAllowlist`（`from_json_str:66`、`from_json_value:72`、`contains:101`）；`:106-108` `default_gateway_config_path`；`:110-141` `verify`；`:143-156` `verify_from_path`；报告类型 `:24-59`（`GatewayAllowlistVerdict`/`Status`/`Report::all_ok`）。CLI 侧 `main.rs:627-650` `run_verify_gateway_allowlist`；参数 `cli.rs:257-267`。

**用法 / OpenCode 缺口**：面向 Clawdbot 网关运营；OpenCode 无涉及。

---

### M18 绑定校验（Binding Verification）

**能力说明**：绑定审计确保 repo→频道 路由不漂移（CHANGELOG.md:96-99）。两条命令：`clawhip config verify-bindings [--json]`（审计配置中每个频道 ID 与 live Discord 状态，漂移即非零退出）；`clawhip setup --bind REPO=CHANNEL_ID [--expect-name REPO=NAME]`（实时解析频道、写带 `channel_name` 提示的路由、名称不匹配/404 在写盘前中止）。

**源码实现原理**：`binding_verify.rs`（`collect_bindings:74`、`resolve_verdict:222`、`verify:250`；`ChannelLookup` 结果用于 main.rs:552-590）；`discord.rs:225-273` `lookup_channel`（GET /channels/{id}，只读探测，不动 DLQ/熔断）；`main.rs:512-609` `run_setup`（`--bind` 循环 `:535-592`、`--expect-name` 硬失败解析 `:489-510`）；`:611-625` `run_verify_bindings`；`config.rs:1219-1265` `apply_repo_binding`（channel_name 提示）；`config.rs:192-196` RouteRule.channel_name 字段。

**用法 / OpenCode 缺口**：与宿主无关；OpenCode 改配置后可用 `clawhip config verify-bindings` 校验。

---

### M19 插件架构（Plugins）

**能力说明**：`plugins/` 目录存放工具特定 shell 桥接插件：每插件一个子目录，含 `plugin.toml`（元数据）+ `bridge.sh`（shell 钩子入口）（README.md:218-235）。内置 `plugins/codex/`、`plugins/claude-code/`。`clawhip plugin list` 列出已安装/内置插件。

**源码实现原理**：`plugins.rs:9` `PLUGIN_DIR_ENV`（`CLAWHIP_PLUGIN_DIR`）；`:21-26` `Plugin`；`:28-45` `Plugin::from_manifest`（要求 bridge.sh）；`:47-49` `default_plugins_dir`；`:51-76` `load_plugins`（扫描 plugin.toml）；`:78-86` `install_bundled_plugins`（`lifecycle.rs:21/68` 安装时调用）；`:93-115` `plugin_dir_candidates`；`:118-127` `bundled_plugins_dir`/`app_plugins_dir`。CLI：`cli.rs:425-428` `PluginCommands`；`main.rs:329-350` 列表渲染（NAME/BRIDGE/DESCRIPTION 表格）。

**用法 / OpenCode 缺口**：插件是"bridge.sh 钩子入口"形态，OpenCode 适配可新增 `plugins/opencode/`（plugin.toml + bridge.sh），从 OpenCode 钩子侧调用 clawhip CLI。

---

### M20 tmux wrapper（`clawhip tmux new / watch / list`）

**能力说明**：v0.3.0 起 tmux 变为可选、不再是主要钩子注册面（README.md:173-175）。wrapper 提供：`tmux new`（新建会话 + 注册监控 + 可选 retry-enter 发送 prompt）、`tmux watch`（接管已有会话）、`tmux list`（列出 daemon 已知监控：source/注册时间/父进程信息，README.md:626）。

**用法（原生宿主）**：`clawhip tmux new -s <session> --mention '<@id>' --keywords 'error,PR created' --stale-minutes 10 --format alert --shell /bin/zsh -- command args`；`clawhip tmux watch -s <existing-session> --keywords ...`；`clawhip tmux list`（`cli.rs:699-800` `TmuxCommands`/`TmuxNewArgs`/`TmuxWatchArgs`）。
- OpenCode 缺口：OpenCode 若在 tmux pane 内运行，`tmux watch` 是低成本桥接（关键字/stale 监控）；`deliver` 则需先扩展（见 M11）。

**源码实现原理**：`tmux_wrapper.rs:19-36` `run`（`tmux new`：`launch_session:251` + `register_and_start_monitor:221`）；`:38-62` `watch`；`:114-130` `into_registration`（`active_wrapper_monitor` 标志——false 时把监控交还 daemon，CHANGELOG.md:85）；`:243-249` `register_for_daemon_monitoring`（POST `/api/tmux/register`，`client.rs:32-36`）；`:291-312` `send_keys_reliable`（重试 Enter 退避 `:314`）；`:375-400` `build_command_to_send`/`build_child_command`（子命令退出后保留会话，CHANGELOG.md:7）；`:444-456` `current_parent_process_info`（`tmux list` 的父进程列）。daemon 侧 `daemon.rs:949-963` `register_tmux`、`:965-974` `list_tmux`。

**实现链路**：`clawhip tmux new/watch` → wrapper 启动/接管 pane → 注册（wrapper 前台监控或交还 daemon）→ 关键字/stale 事件（M2.4）→ mpsc → 路由 → 投递；`tmux list` → GET `/api/tmux`。

---

### M21 Explain 命令（`clawhip explain`）

**能力说明**：不投递地推演事件会如何路由——展示哪些路由匹配、哪些 filter 通过/失败、事件会被投到哪（CHANGELOG.md:87；`cli.rs:151-155`）。

**源码实现原理**：`main.rs:652-668` `run_explain`（只 normalize 不强制信封校验，`events.rs:880`；`router.explain` `:659`）；`router.rs:254-341` `explain`（逐路由 pattern/filter 评估 + `delivery_explanation:472`）；`provenance.rs:14` `Provenance`、`:29` `RouteExplanation`、`:44` `FilterResult`、`:60` `DeliveryExplanation`（Display 实现 `:70-150`）。参数 `cli.rs:194-212` `ExplainArgs`（--json 支持）。

**用法 / OpenCode 缺口**：OpenCode 适配排障利器——桥接事件先 `clawhip explain --<key> <value>` 推演，再决定路由配置。

---

### M22 发布预检 + 更新检查器

**能力说明**：`clawhip release preflight` 校验 Cargo.toml / Cargo.lock / CHANGELOG 版本一致性（CHANGELOG.md:86、100-101，release 工作流门禁）。daemon 内 `update` 后台检查器（M15 详述）。

**源码实现原理**：`release_preflight.rs:277-306` `run`；`:246-268` `run_preflight`；`:110-128` `check_cargo_toml`；`:130-188` `check_cargo_lock`；`:190-232` `check_changelog`（标题含版本 `:234`）；报告渲染 `:61-78`。`main.rs:466-467` 分发；参数 `cli.rs:664-677` `ReleaseCommands`。

**用法 / OpenCode 缺口**：发布工具面，OpenCode 无涉及。

---

### M23 遥测与可观测性

**能力说明**：结构化遥测（`telemetry::record/emit`，reason 码 + 事件名常量）贯穿 daemon/source/dispatch/sink；原生钩子专属可观测（received/normalized/dropped/deferred/routed 计数 + 采样，CHANGELOG.md:55）；路由来源 `Provenance`（M21）。daemon 健康端点暴露原生钩子快照。

**源码实现原理**：`telemetry.rs:140-150` `record`；`:152-159` `render_line`；`:161-164` `emit`；`:105-120` `safe_target_id`（目标脱敏）；`:96-103` `stable_correlation_id`。`native_observability.rs:16` `new_shared_native_hook_observability`；`:91` `observe_received_raw`、`:106` `observe_normalized`、`:122` `observe_dropped_raw`、`:139` `observe_dropped`、`:156` `observe_deferred`、`:173` `observe_routed`、`:208` `snapshot`、`:295` `is_native_hook_event`、`:311` `snapshot_shared`、`:318` `with_native_observability`。接入点：daemon.rs:344-346（received）、:382-411（normalized/dropped）、:424-426（non_git drop）、:444-447（deferred）；dispatch.rs:220-256（route outcome）。

**用法 / OpenCode 缺口**：OpenCode 桥接可把失败原因码（如 `DROP_NON_GIT_NATIVE_HOOK`、`ROUTE_NONE`）当作排障信号；`/health` 快照可作监控。

---

## 四、源码引用索引（速查）

### 入口与命令分发
| 引用 | 说明 |
|---|---|
| `src/main.rs:57-71` | `main`/`build_runtime`（tokio 多线程，`--worker-threads` 覆盖） |
| `src/main.rs:88-469` | `real_main` 全命令分发 |
| `src/main.rs:471-474` | `send_incoming_event`（prepare+POST） |
| `src/cli.rs:44-166` | `Commands` 枚举（全命令面） |
| `src/client.rs:11-114` | `DaemonClient`（/event、/native/hook、/tmux、/health、/update/*） |

### 事件模型
| 引用 | 说明 |
|---|---|
| `src/events.rs:14-43` | `MessageFormat`（compact/alert/inline/raw） |
| `src/events.rs:46-59` | `IncomingEvent`（wire 事件） |
| `src/events.rs:118-717` | 事件构造器家族 |
| `src/events.rs:765-788` | `canonical_kind`（session.* 家族派生） |
| `src/events.rs:880-953` | `normalize_event` / `map_native_signal` |
| `src/event/mod.rs:18-84` | `EventEnvelope`/`EventBody`/`EventMetadata`/`EventPriority` |
| `src/event/body.rs:4-150` | 15 个类型体结构 |
| `src/event/compat.rs:14-477` | `from_incoming_event`/`body_for`/各 body 构造 |

### 事件来源
| 引用 | 说明 |
|---|---|
| `src/source/mod.rs:19-22` | `Source` trait |
| `src/source/git.rs:32` / `:117` / `:285` | `run` / `poll_git_at` / `send_event` |
| `src/source/github.rs:34` / `:164` / `:461` | `run` / `poll_github` / `send_event` |
| `src/source/tmux.rs:110` / `:307` / `:696` / `:806` | `run` / `poll_tmux` / `tmux_keyword_event` / `tmux_stale_event` |
| `src/source/workspace.rs:35` / `:428` / `:827` | `run` / `diff_workspace_state` / `workspace_event` |
| `src/cron.rs:36` / `:175` / `:284` | `run` / `emit_due` / `build_job_event` |
| `src/discord_watch.rs:90` / `:103` / `:357` | `process_incoming_event` / `process_message` / `handle_local_intent_event` |
| `src/daemon.rs:998` | `post_github`（webhook 入口） |
| `src/daemon.rs:339` | `post_native_hook`（原生钩子入口） |

### 管道核心
| 引用 | 说明 |
|---|---|
| `src/daemon.rs:42` / `:73` / `:104` / `:187` | `EVENT_QUEUE_CAPACITY=256` / `run` / mpsc channel / `spawn_source` |
| `src/daemon.rs:146-159` | HTTP 路由表 |
| `src/daemon.rs:605-696` | `accept_event` / `enqueue_accepted_event` |
| `src/dispatch.rs:73-103` | `Dispatcher::run`（select 循环） |
| `src/dispatch.rs:164-218` | `resolve_and_dispatch`（例行批决策） |
| `src/dispatch.rs:526-557` / `:559-637` | `GitHubCiBatcher` / `RoutineDeliveryBatcher` |
| `src/router.rs:100-120` | `resolve`（0..N 投递） |
| `src/router.rs:519-567` | `route_matches` / `matching_routes_for` / 特异性排序 |
| `src/render/default.rs:14` | `DefaultRenderer::render` |
| `src/sink/mod.rs:42-45` | `Sink` trait |
| `src/discord.rs:93` | `DiscordClient::send`（熔断/限流/重试/DLQ） |

### 配置
| 引用 | 说明 |
|---|---|
| `src/config.rs:14-38` | `AppConfig` |
| `src/config.rs:180-208` | `RouteRule` |
| `src/config.rs:210-217` | `GajaeRouteAction` |
| `src/config.rs:246-285` | sink 目标解析方法 |
| `src/config.rs:757-789` | `load_or_default` / `merge_legacy_discord` |
| `src/config.rs:921-1114` | `validate` |
| `src/config.rs:1388-1490` | `normalize` |

### 控制面
| 引用 | 说明 |
|---|---|
| `src/native_hooks.rs:31-377` | `incoming_event_from_native_hook_json` |
| `src/native_hooks.rs:386-754` | `generated_hook_script`（内嵌 native-hook.mjs 桥） |
| `src/native_hooks.rs:759-771` | `map_shared_event`（五事件映射） |
| `src/native_hooks.rs:791-853` | `detect_question_request` / `is_question_tool_name` |
| `src/hooks/mod.rs:34-57` | `run_install`（钩子安装） |
| `src/hooks/prompt_deliver.rs:134-191` | `deliver`（prompt 恢复核心） |
| `src/gajae.rs:984-1538` | GAJAE CLI 桥（status/doctor/verify/preflight/install） |
| `src/gajae.rs:105-342` | 处理器执行（白名单/超时/输出上限） |
| `src/daemon.rs:714-883` | daemon 侧 GAJAE 处理器接线 |
| `src/memory.rs:36-61` / `:247-332` / `:730-790` | `init`/`status` / scaffold / `scaffold_channels` |
| `src/lifecycle.rs:14-123` | install/update/uninstall |
| `src/update.rs:63-233` | 更新检查器与版本比较 |
| `src/plugins.rs:47-86` | 插件发现与安装 |
| `src/tmux_wrapper.rs:19-62` | `run`（new）/`watch` |
| `src/gateway_allowlist.rs:110-156` | allowlist 校验 |
| `src/release_preflight.rs:246-306` | 发布预检 |
| `src/dynamic_tokens.rs:13-138` | 动态令牌渲染 |
| `src/telemetry.rs:140-164` / `src/native_observability.rs:16-330` | 遥测/可观测性 |

---

## 五、OpenCode 适配缺口汇总（桥接速查）

clawhip 没有任何 **OpenCode 原生 provider 钩子**（对比：Codex 有 `.codex/hooks.json`、Claude Code 有 `~/.claude/settings.json`，见 native_hooks.rs:17-22）。可行的桥接路径按推荐度排序：

1. **thin-client 直接桥**：OpenCode 钩子/脚本调用 `clawhip agent started/blocked/finished/failed`（M2.7）或 `clawhip emit`/`clawhip send`（M1），最稳、无需碰原生信封。
2. **native-hook 适配器**：OpenCode 钩子把自身事件映射成 v1 信封（五事件名 + `provider` 字段）后经 `clawhip native hook --provider codex --file <json>` 或直接 POST `/api/native/hook` 进入（M9/M2.9）。注意 git 目录要求（非 git 目录会被 `non_git` 丢弃，daemon.rs:417-442）。
3. **复用 native-hook.mjs**：`.clawhip/hooks/native-hook.mjs` 的 git 根推导/project.json/tmux 元数据/`.clawhip/hooks/augment/` 增强加载是通用逻辑（native_hooks.rs:386-754），OpenCode 适配器可作为其输入端复用。
4. **workspace monitor**：把 OpenCode 状态 JSON 注册为 `[monitors.workspace]` 来源（M2.5）或为 OpenCode 写状态落盘脚本。
5. **tmux 兜底**：OpenCode 跑在 tmux pane 内时用 `clawhip tmux watch`（M20）做关键字/stale 监控；`clawhip deliver`（M11）需先扩展 `ProviderKind` 与进程识别（prompt_deliver.rs:73-86/394-455）才能面向 OpenCode 会话。

> 本文档机制覆盖核对：事件来源（git/GitHub 轮询+webhook/tmux/workspace/cron/agent CLI/discord watch/原生钩子）✅、类型化信封 ✅、路由配置 ✅、Router 多投递 ✅、Renderer/Sink 分离 ✅、daemon sources→queue→sinks ✅、native hook CLI ✅、hooks install + mjs 桥 ✅、deliver ✅、memory/status ✅、gajae 集成 ✅、生命周期/插件/令牌/白名单/绑定校验/发布预检/遥测 ✅，无机制遗漏。
