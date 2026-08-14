# OVERVIEW —— 四工具参考系列总览

> 覆盖工具：**oh-my-codex（OMX）**、**oh-my-claudecode（OMC）**、**oh-my-openagent（OmO）**、**clawhip（gajae-claw）**
>
> 本文档是对四份单工具源码级参考文档的**综合合成**，是本系列的唯一总览交付物（对应规格 `.omc/specs/deep-interview-omc-tools.md` 的「端到端协作链路图」lane）。
>
> **引用约定**：本文所有出处均以 `工具文档名.md §章节号` 标注（如 `oh-my-codex.md §3.14`），括号内的 `文件:行号` / `函数名` 是**各单工具文档中已核实的源码引用**（即「各文档内的引用」的二次引用）。四份单工具文档是本文的唯一事实来源；**未新增任何源码级引用**。
>
> 单工具文档：`docs/oh-my-codex.md` · `docs/oh-my-claudecode.md` · `docs/oh-my-openagent.md` · `docs/clawhip.md`

---

## 1. 四工具定位总览

### 1.1 各工具定位

| 工具 | 一句话定位 | 宿主 | 形态 | 版本 |
|---|---|---|---|---|
| **oh-my-codex（OMX）** | Codex CLI 之上的**工作流层**：不替换 Codex，只提供更好的任务路由 + 工作流 + 运行时 | OpenAI Codex CLI | 独立 CLI `omx` + Codex 插件 | v0.20.5（npm `oh-my-codex`） |
| **oh-my-claudecode（OMC）** | Claude Code 之上的**团队优先（Teams-first）编排层**：「不要学 Claude Code，直接用 OMC」 | Claude Code | 双表面：Claude Code 插件（40+ 斜杠技能 / 19 agent）+ 终端 CLI `omc` | npm `oh-my-claude-sisyphus` |
| **oh-my-openagent（OmO）** | 面向 OpenCode 的**多宿主 Agent 编排层**（"Multi-Harness Agent OS"），把单 Agent 改造成可并行、可委派、可自证完成的开发团队 | OpenCode（Ultimate）/ Codex CLI（Light）/ Senpi（beta） | OpenCode **原生插件** + `omo` CLI + LazyCodex 分发 | 5.0.0-beta.7 |
| **clawhip（gajae-claw）** | **agents 的控制面（control plane）**：把 GitHub/Discord/tmux 等事件路由给正确的人或 agent，记录发生了什么，分离「可自动执行」与「需人工批准」 | 无（daemon-first 独立进程） | Rust daemon（axum + tokio）+ CLI + provider 钩子 | v0.6.11 |

逐工具定位：

- **oh-my-codex（OMX）**：架设在 OpenAI Codex CLI 之上的多智能体编排层，核心心智模型是「Codex 干活，OMX 提供更好的任务路由 + 更好的工作流 + 更好的运行时」（`oh-my-codex.md §1`，README.md:295-305）。它提供 30+ 原生 agent、40+ SKILL.md 技能、一套「澄清 → 计划共识 → 持久化执行」的工作流闭环（`$deep-interview → $ralplan → $ultragoal`，README.md:318-326），以及 `omx team`（tmux + worktree + 邮箱）团队运行时。所有状态统一放在仓库内 `.omx/`（`oh-my-codex.md §1`，README.md:38）。

- **oh-my-claudecode（OMC）**：面向 Claude Code 的「团队优先」编排层，由 Hooks → Skills → Agents → State 四套互锁系统组成（`oh-my-claudecode.md §1`，docs/ARCHITECTURE.md:7）。关键定位差异：`/autopilot` `/ralph` `/ultrawork` 是**会话内技能**，仓库不存在对应 CLI 子命令；`omc team` 与 `/team` 是两套不同运行时（README.md:147,174）。**仓库内不存在任何 OpenCode 插件代码**——`src/interop/` 是 OMX（Codex）互操作而非 OpenCode 适配（`oh-my-claudecode.md §1`）。

- **oh-my-openagent（OmO）**：原名 oh-my-opencode，三款发行版覆盖三个宿主（`oh-my-openagent.md §1`，README.md:114-141）：Ultimate（OpenCode 插件，**原生**）、Light（Codex CLI，`npx lazycodex-ai install`，LazyCodex 的载体与上游）、Senpi（beta 独立版）。核心是 Sisyphus 主编排 Agent（意图分类 → 并行探索 → 六段式委派 → 验证）+ 背景 Agent 并行 + Team Mode + 多模型回退链。其 `ultragoal` 概念源自 oh-my-codex，但重新实现为 **Goal 机制**（`oh-my-openagent.md §4.5`）。

- **clawhip**：daemon-first 的「事件→频道」通知路由器（Rust 编写），品牌定位是 agents 的 control plane（`clawhip.md §一`，README.md:15）。它**不是编排层**——不做规划、不写代码、不启动循环；它做的是：多来源事件（git/GitHub/tmux/workspace/cron/原生钩子）→ 类型化信封 → mpsc 队列 → dispatcher → 0..N 多投递路由 → 渲染 → sink（Discord/Slack/localfile），并把「可自动执行动作」与「需人工批准动作」分开（GAJAE 审批路由）。v0.6.0 起不再把自己包装为 launcher，而是让 Codex/Claude **拥有**会话与钩子，clawhip 只做路由/归一化/投递（`clawhip.md §M2.9`，README.md:142-175）。

### 1.2 关系与重叠

- **宿主维度**：OMX 独占 Codex CLI；OMC 独占 Claude Code；OmO 以 OpenCode 为原生宿主（Ultimate），Light 版与 LazyCodex 覆盖 Codex；clawhip 无宿主概念，可**同时**挂接 Codex（`.codex/hooks.json`）与 Claude Code（`~/.claude/settings.json`）两套钩子（`clawhip.md §M10`，hooks/mod.rs:34-57）。三套编排层互不共宿主，clawhip 是唯一跨宿主组件。

- **工作流语义重叠（同源概念）**：`ralph`（持久完成循环）、`ultrawork`（最大并行）、`ultragoal`（持久化多目标）、`team`、`ralplan`（规划共识）、`deep-interview`（苏格拉底澄清）六组概念在 OMX 与 OMC 中**同名同构**（OMC 的实现是 OMX 的同源移植）；OmO 将 ultragoal 重实现为 Goal、将 ralph 的续跑逻辑并入 todo-continuation-enforcer（`oh-my-openagent.md §4.5,4.12`）。对同一任务，三套编排层是**互斥的可选路径**，而非叠加关系。

- **通知层重叠（OMC / OMX / OmO 三者 vs clawhip）**：三者都内置 Discord/Telegram/Slack/webhook 通知与 OpenClaw 外联（OMX §3.14、OMC §3.17、OmO §4.23）；clawhip 的通知是**独立事件路由层**——配置化 `[[routes]]`（event→filter→sink→channel）、四种渲染格式、限流/熔断/DLQ、例行批处理降噪、审批分离。差异：OMC/OMX 的通知是**事件侧内置 fan-out**（生命周期事件直接发 webhook），clawhip 是**可独立运行的路由器**（也可消费 OMC/OMX 产生的钩子事件——`clawhip.md §五` 的桥接路径 1/2）。当同时部署时，clawhip 可充当 OMC/OMX 通知的**下游统一出口**（把 hook 事件收敛成一条 Discord 投递管线），也可与二者各自的通知并存（重复提醒需自行去重）。

- **OpenClaw 网关角色**：OMC/OMX/OmO 都把 OpenClaw 当**外部 agent 回合入口**——`wakeOpenClaw` 把钩子事件变成 Discord 上的真实 agent 回合（OMX §3.14、OMC §3.17），OmO 另有 reply-listener 守护进程把 Discord 消息回写成 tmux pane 输入（§4.23）；clawhip 则从**投递合法性**角度与 Clawdbot 网关对接——路由频道 ID 必须也在网关 allowlist 中（`clawhip.md §M17`，gateway_allowlist.rs）。即：三编排层负责「唤醒网关」，clawhip 负责「校验网关投递目标」。

- **事件语义互补**：OMC/OMX 是 hook 事件**生产者**（11 个 / 4 层生命周期钩子），clawhip 是 hook 事件**下游消费者**（五个共享事件 SessionStart/PreToolUse/PostToolUse/UserPromptSubmit/Stop → `session.*` 家族，`clawhip.md §M2.9`，docs/native-event-contract.md:15-23）。一条 hook 事件可以同时驱动编排层的状态机（继续/续跑）与 clawhip 的通知路由（提醒人类）。

---

## 2. 机制横向对比表

> 列：四工具；行：关键机制。出处列在各单元格括号内（均为单工具文档章节号，`—` 表示该工具无此机制）。

| 机制 | oh-my-codex（Codex CLI） | oh-my-claudecode（Claude Code） | oh-my-openagent（OpenCode） | clawhip（独立 daemon） |
|---|---|---|---|---|
| **规划关键词** | `$deep-interview` / `$ralplan` / `$plan` / `$prometheus-strict`（§3.5） | `/deep-interview` / `ralplan` / `/plan`（4 模式：Interview/Direct/Consensus/Review）（§3.9-3.11） | Prometheus 面试式澄清 → `.omo/plans/*.md` + `/start-work`（§4.4） | —（不参与规划） |
| **执行模式** | `$autopilot` / `$ultrawork` / `$ultragoal` / `$ralph` / `$team` / `$ultraqa`（§3.7, 3.20-3.22） | `/autopilot` / `ralph` / `ultrawork` / `ultragoal` / `ultraqa` / `/team` / `/pipeline`（§3.1-3.7） | `ultrawork`/`ulw` 注入、Goal 续跑、Todo Enforcer（§4.1, 4.5, 4.12） | —（只路由；`agent started/blocked/finished/failed` 观察执行状态 M2.7） |
| **关键词检测与状态机** | `KEYWORD_TRIGGER_DEFINITIONS` + `workflow-transition` 共享转换策略（重叠/自动完成/拒绝）（§3.10） | `KEYWORD_PATTERNS` + ralplan 执行门禁（≤15 词判模糊）+ bridge 状态激活（§3.14, 3.9） | `chat.message` 检测 + 变体路由（planner/gpt/gemini/glm）+ 模型覆盖（§4.1） | tmux 关键字监控是**事件源**（`tmux.keyword`），非模式状态机（§M2.4） |
| **Hooks** | Codex 原生 4 层（插件级/传统/OMX 插件/tmux 回退）+ PreToolUse 写保护安全闸（§3.11） | 11 个生命周期事件 21 钩子，`<system-reminder>` 注入（§3.14） | 56 个钩子、5 层（session/tool-guard/transform/continuation/skill）（§4.17） | 消费 Codex/Claude 五共享事件 + 自装钩子（M2.9, M10） |
| **通知** | Discord（webhook+bot+回复监听）/Telegram/Slack/webhook，`notifyLifecycle` 派发（§3.14） | 同上 + Stop 回调会话摘要 + @提及标签（Discord/Telegram/Slack 语义各异）（§3.17） | OpenClaw 外联（idle/error/completion）+ reply-listener 回写 tmux（§4.23） | **核心功能**：Discord（频道/线程/webhook）/Slack webhook/localfile JSONL sink，限流+熔断+DLQ（§M6） |
| **OpenClaw 网关** | `wakeOpenClaw`，`OMX_OPENCLAW=1`（HTTP）/`OMX_OPENCLAW_COMMAND=1`（命令）双激活门 + clawdbot agent 回合（§3.14） | `wakeOpenClaw`，`OMC_OPENCLAW=1`，bridge 6 个事件唤醒点（§3.17） | `openclaw` 配置块 + 入站 reply-listener 守护进程（§4.23） | Clawdbot 网关白名单校验（路由频道须 allowlist）（§M17） |
| **记忆** | `.omx/state`（模式状态）+ `.omx/project-memory.json` + notepad 三区 + `omx_wiki/` 知识层（§3.13, 3.18） | 5 层：notepad（7 天清理）/project-memory/wiki/shared-memory（namespace+TTL）/session-search（§3.16） | memory-core（git 仓库式）+ `.omo/notepads/` + compaction-context-injector 保留（§4.11） | `MEMORY.md` 热指针 + `memory/` 结构化分片（daily/project/channel/agent/…）（§M12） |
| **团队/lane 编排** | `omx team`：tmux 会话 + 独立 worktree + 邮箱通信，`DEFAULT_MAX_WORKERS=20`，混合 CLI worker（codex+claude）（§3.20） | `/team` 会话内 5 阶段管线（team-plan→prd→exec→verify→fix）+ `omc team` tmux CLI worker（§3.1, 3.2） | Team Mode：8 成员 / 12 个 `team_*` 工具 / 共享邮箱任务列表；背景 Agent 并发默认 5（§4.9, 4.7） | 观察方：agent 生命周期事件源 + workspace/tmux 监控（§M2.4-2.7） |
| **HUD** | tmux 状态面板（`omx hud --watch`）（§3.12） | `statusLine` 状态栏 + `omc hud` 轮询版（§3.15） | 无 HUD；team mode 的 tmux 分屏可视化（`team-layout-tmux`）（§4.9） | 无（`clawhip status` 为 daemon 健康查询 M13） |
| **MCP** | 6 个 stdio 服务器：state/memory/code-intel/trace/wiki/hermes（`omx mcp-serve`）（§3.15） | notepad/project-memory/wiki/shared-memory 等 MCP 工具集（§3.16） | 内置 5 个 MCP（websearch/context7/grep_app/lsp/codegraph）运行时注入 + 技能内嵌 MCP（§4.16） | 无 MCP；HTTP API（`/event`、`/api/native/hook`、`/health`…）（§M7） |
| **技能系统** | `skills/*/SKILL.md` + 目录清单 `manifest.json`（active/deprecated/internal）（§3.9） | skill/skillify/learner：从会话提取 + 相关时自动注入（`<learner>` 标签）（§3.13） | skills-loader-core + `load_skills` 强制加载 + SKILL.md frontmatter 内嵌 MCP（§4.15） | 插件架构：plugin.toml + bridge.sh shell 桥（§M19） |
| **配置** | `.omx-config.json`（模型/环境路由 + 通知/wiki/autoNudge），user/project 双作用域（§3.17） | `.claude/omc.jsonc` / `~/.config/claude-omc/config.jsonc` + `settings.json`（§3.10, 3.19） | `omo.jsonc` 统一配置 + 迁移引擎（旧 `oh-my-opencode.json[c]` 一次性导入）（§4.19） | `~/.clawhip/config.toml`：`[[routes]]` + monitors + cron + providers（§M3） |
| **持久化执行状态** | ultragoal 工件 `.omx/ultragoal/{brief,goals,ledger}` + Codex goal 握手（§3.21） | ultragoal 制品（brief/goals/ledger，不启动循环）（§3.6） | Goal 机制（`.omo/goal/{session}.json`，session.idle 续跑注入 + 完成审计）（§4.5） | 事件账本（`events.jsonl`/localfile sink）+ workspace 状态文件（§M2.5, M6） |
| **终止/取消** | `omx cancel` + `$cancel`（§3.1） | `cancelomc`/`stopomc` 最高优先级关键词，逐模式清理（§3.20） | `/stop-continuation` + stop-continuation-guard 钩子（§4.5） | `shutdown` 清理 daemon/systemd（§M15） |

---

## 3. 端到端协作链路图

### 3.1 总览（mermaid，简化版）

```mermaid
flowchart LR
    H[人类指令：Discord / 终端]
    G[OpenClaw 网关（可选）]
    S[宿主 CLI：Claude Code / Codex CLI / OpenCode]
    W[工作流层：OMC / OMX 关键词+状态机]
    O[协调层：OmO Sisyphus]
    L[并行 lane / workers]
    K[hook 事件]
    C[clawhip 事件路由：sources→queue→dispatcher→router→render→sink]
    D[Discord 通知回传人类]

    H --> G
    G --> S
    H --> S
    S --> W
    W --> O
    O --> L
    L --> K
    K --> C
    C --> D
    D --> H
```

### 3.2 带源码引用的详细链路图（ASCII）

> 每跳标注「工具 + 出处」：章节号指向单工具文档，括号内为该文档中已核实的源码引用。

```text
① 人类指令（Discord / 终端）
   │
   ├─ [入口 A · Discord 消息]
   │    clawhip Discord Watch sidecar：判定 nudge intent，本地持久化（不入队）
   │    出处：clawhip.md §M2.8（src/discord_watch.rs:103 process_message）
   │
   ├─ [入口 B · 终端 / CLI 面]
   │    ├─ omx <command>（launch/exec/mission/team…）—— omx CLI 入口与分发
   │    │    出处：oh-my-codex.md §3.1（src/cli/omx.ts、src/cli/index.ts:3333）
   │    ├─ omc 二进制（bin shim → commander 30+ 子命令）
   │    │    出处：oh-my-claudecode.md §3.19（bin/oh-my-claudecode.js、src/cli/index.ts:98）
   │    ├─ OpenCode TUI（opencode.json 插件条目 "oh-my-openagent"）
   │    │    出处：oh-my-openagent.md §3.1（packages/omo-opencode/src/index.ts:3-5）
   │    └─ clawhip CLI（emit / agent / tmux / native hook）
   │         出处：clawhip.md §M1 / §M2.7 / §M9（src/main.rs:88-469 real_main）
   │
   └─ [入口 C · OpenClaw 网关（可选）—— 远端指令 / 外部 agent 回合]
        ├─ OMX：wakeOpenClaw（OMX_OPENCLAW=1 HTTP 网关 / OMX_OPENCLAW_COMMAND=1 命令网关）
        │     → clawdbot agent 把钩子事件变成 Discord 上的真实 agent 回合
        │     出处：oh-my-codex.md §3.14（src/openclaw/index.ts:76 wakeOpenClaw；
        │            docs/openclaw-integration.md:8-23 激活门）
        ├─ OMC：wakeOpenClaw（OMC_OPENCLAW=1），bridge 6 个事件唤醒点
        │     出处：oh-my-claudecode.md §3.17（src/openclaw/index.ts:75 wakeOpenClaw；
        │            src/hooks/bridge.ts:2310-2323 _openclaw 包装）
        ├─ OmO：openclaw 外联 + reply-listener 守护进程回写 tmux pane
        │     出处：oh-my-openagent.md §4.23（src/openclaw/、packages/openclaw-core/）
        └─ clawhip：Clawdbot 网关白名单校验（路由频道须 allowlist）
              出处：clawhip.md §M17（src/gateway_allowlist.rs:110-141 verify）
   │
   ▼
② 宿主 CLI（会话承载层）
   ├─ Claude Code ← OMC（插件 + CLI 双表面；40+ 斜杠技能 / 19 agent）
   │    出处：oh-my-claudecode.md §1（README.md:135-149；docs/ARCHITECTURE.md:7）
   ├─ Codex CLI ← OMX（工作流层，不替换 Codex）
   │    出处：oh-my-codex.md §1（README.md:295-305「Codex 干活，OMX 提供更好的…」）
   │          ← OmO Light / LazyCodex（npx lazycodex-ai install；规则/ultrawork/ulw-loop 等组件）
   │    出处：oh-my-openagent.md §1、§5（README.md:114-141；docs/guide/installation.md:798-810）
   │          ← clawhip 钩子注册（.codex/hooks.json 五事件）
   │    出处：clawhip.md §M10（src/hooks/mod.rs:34-57 run_install；write_codex_hooks）
   └─ OpenCode ← OmO Ultimate（原生插件，createPluginModule 装配）
        出处：oh-my-openagent.md §3.1（src/testing/create-plugin-module.ts:159）
   │
   ▼
③ 工作流层（关键词 → 模式状态机）
   ├─ OMX：UserPromptSubmit 钩子 → keyword-registry 关键词表 → workflow-transition
   │       评估转换（重叠/自动完成/拒绝）→ 写 <mode>-state.json → 注入上下文
   │    出处：oh-my-codex.md §3.10（src/hooks/keyword-registry.ts:8-68；
   │            src/hooks/keyword-detector.ts；src/state/workflow-transition.ts:765）
   ├─ OMC：UserPromptSubmit → keyword-detector（优先级 cancel>ralph>autopilot>…）
   │       → ralplan 执行门禁（≤15 词判模糊）→ bridge 激活模式状态 → <system-reminder>
   │    出处：oh-my-claudecode.md §3.14 / §3.9（src/hooks/keyword-detector/index.ts:46-67,
   │           94-98；applyRalplanGate:1077；src/hooks/bridge.ts activateRalplanState:664）
   └─ OmO：chat.message → keyword-detector（ultrawork/team/hyperplan 组合）→ 模式提示注入
          + 模型/变体覆盖（opencode.db json_set 补写）
       出处：oh-my-openagent.md §4.1（src/hooks/keyword-detector/hook.ts:38；
               src/hooks/keyword-detector/constants.ts:33-38；detector.ts:44-71）
   │
   ▼
④ 协调层（OmO 编排者 —— 唯一显式编排层）
   ├─ Sisyphus 主编排 Agent：意图门 → 分类 → 并行背景探索（explore/librarian）
   │    → 委派六段式任务包 → 验证/证据 → 失败恢复
   │    出处：oh-my-openagent.md §4.2（src/agents/sisyphus/default.ts:138 buildDefaultSisyphusPrompt；
   │           六段式 TASK/EXPECTED OUTCOME/REQUIRED TOOLS/MUST DO/MUST NOT DO/CONTEXT :370-389）
   └─ 委派工具：task(category/subagent_type/load_skills/task_id) 与 call_omo_agent
        （后台 background-task / 同步 sync-task 两模式）
        出处：oh-my-openagent.md §4.6 / §4.7（src/tools/delegate-task/tools.ts:81；
               src/tools/call-omo-agent/tools.ts:110；background-task.ts:119；sync-task.ts:15）
   │
   ▼
⑤ 并行 lane / workers
   ├─ OMC /team：5 阶段管线 team-plan→team-prd→team-exec→team-verify→team-fix(loop)，
   │   每阶段写 .omc/handoffs/<stage>.md 交接，fix_loop max_attempts=3
   │    出处：oh-my-claudecode.md §3.1（src/hooks/team-pipeline/state.ts:74 initTeamPipelineState；
   │            transitions.ts:50 transitionTeamPhase；skills/team/SKILL.md:153-190）
   │    （CLI 变体 omc team：tmux 分裂窗格拉真实 worker CLI —— §3.2，tmux-session.ts:1144）
   ├─ OMX omx team：tmux 会话 + 独立 worktree + 邮箱通信 + claim-safe 任务生命周期，
   │   混合 CLI worker（codex+claude），DEFAULT_MAX_WORKERS=20
   │    出处：oh-my-codex.md §3.20（src/team/runtime.ts；src/team/state.ts:471；
   │            src/team/worktree.ts:382 ensureWorktree；src/team/api-interop.ts:99）
   ├─ OmO 背景 Agent（并发默认 5，深度上限 3）+ Team Mode（8 成员 / 12 个 team_* 工具）
   │    出处：oh-my-openagent.md §4.7 / §4.9（src/features/background-agent/manager.ts:559 launch；
   │            concurrency.ts:25；team-runtime/create.ts:124 createTeamRun；
   │            tool-registry-team-tools.ts:20-48）
   └─ clawhip：观察方 —— agent started/blocked/finished/failed 生命周期事件
        出处：clawhip.md §M2.7（src/main.rs:157-199；events.rs:186/209/232/256）
   │
   ▼
⑥ hook 事件（生命周期信号）
   ├─ OMC：11 事件 21 钩子（UserPromptSubmit/PreToolUse/PostToolUse/Stop/PreCompact/…）
   │   → bridge 分发 → HookOutput JSON → <system-reminder> 注入（含续跑提示）
   │    出处：oh-my-claudecode.md §3.14（hooks/hooks.json；src/hooks/bridge.ts:3071 processHook；
   │            persistent-mode checkPersistentModes:2217）
   ├─ OMX：4 层 hooks（插件级原生 / 传统 / OMX 插件 .omx/hooks/*.mjs / tmux 回退）
   │   + PreToolUse 写保护安全闸（leader 写保护 + agent_id 身份校验 + git 命令消毒）
   │    出处：oh-my-codex.md §3.11（docs/codex-native-hooks.md:48-74 映射矩阵；
   │            src/scripts/codex-native-hook.ts:20657 buildConductorPreToolUseWriteGuardOutput）
   ├─ OmO：56 钩子 5 层，事件分发器固定顺序调 26 个事件处理
   │    出处：oh-my-openagent.md §4.17（src/create-hooks.ts:36 createHooks；
   │            src/config/schema/hooks.ts:3-62 HookNameSchema；
   │            src/plugin/event-hook-dispatcher.ts:37-71）
   └─ clawhip：五共享事件（SessionStart/PreToolUse/PostToolUse/UserPromptSubmit/Stop）
       → map_shared_event → session.* 家族（started/blocked/finished/failed/…）
        出处：clawhip.md §M2.9（docs/native-event-contract.md:15-23；
               src/native_hooks.rs:759-771 map_shared_event；events.rs:765-788 canonical_kind）
   │
   ▼
⑦ clawhip 事件路由（事件 → 频道，daemon-first）
   ├─ 事件源：git/GitHub 轮询 + GitHub webhook + tmux + workspace + cron + 原生钩子
   │        → 统一 IncomingEvent → 类型化 EventEnvelope → mpsc 有界队列（容量 256）
   │    出处：clawhip.md §M1 / §M2.x / §M7（src/event/compat.rs:14 from_incoming_event；
   │            src/daemon.rs:42 EVENT_QUEUE_CAPACITY=256；src/daemon.rs:104 mpsc channel）
   ├─ 分发器：队列消费者，例行批（5s）/ GitHub CI 批（30s）降噪，单条失败继续
   │    出处：clawhip.md §M8（src/dispatch.rs:73-103 Dispatcher::run；
   │            GitHubCiBatcher:526、RoutineDeliveryBatcher:559）
   ├─ 路由：Router 0..N 多投递（事件族匹配 + payload filter + 特异性排序
   │        worktree_path>repo_path>repo_name）；令牌门控 allow_dynamic_tokens
   │    出处：clawhip.md §M4（src/router.rs:100-120 resolve；route_specificity_score:569-597；
   │            src/router.rs:233-252 allow_dynamic_tokens_for）
   ├─ 渲染：compact/alert/inline/raw 四格式 + 模板 {key} + 动态令牌（{sh:}/{tmux_tail:}/{env:}…）
   │    出处：clawhip.md §M5 / §M16（src/render/default.rs:14 DefaultRenderer；
   │            src/dynamic_tokens.rs:13-48 render_template）
   └─ 传输：Sink —— Discord（频道/线程/webhook）、Slack webhook、localfile JSONL；
        熔断 + 限流（TokenBucket）+ 重试 + DLQ
        出处：clawhip.md §M6（src/sink/discord.rs:11 DiscordSink；src/discord.rs:93-223 send；
               core/circuit_breaker.rs、core/rate_limit.rs、core/dlq.rs）
   │
   ▼
⑧ Discord 通知回传人类
   ├─ clawhip：DiscordClient.send → 频道/线程/webhook（429 重试 + 抖动 + DLQ 耗尽）
   │    出处：clawhip.md §M6（src/discord.rs:93-223）
   ├─ OMC：dispatchNotifications 并行 fan-out（15s 上限）+ Stop 回调 @提及标签
   │    出处：oh-my-claudecode.md §3.17（src/notifications/dispatcher.ts:749；sendDiscord:308；
   │            src/hooks/session-end/callbacks.ts triggerStopCallbacks:149）
   └─ OMX：notifyLifecycle 组装 payload → dispatchNotifications（sendDiscord/sendDiscordBot…）
        出处：oh-my-codex.md §3.14（src/notifications/index.ts:206 notifyLifecycle；
               src/notifications/dispatcher.ts:388）
   │
   └──▶ 回到 ①（人类在 Discord 回复 → Discord Watch nudge → 新一轮）
```

**链路要点**：

- **clawhip 双端身份**：它既在链路最末端（⑦⑧ 统一事件路由与 Discord 回传），也在最前端（① 入口 A，Discord Watch 读取人类指令）；中段还以观察方身份（⑤）消费 agent 生命周期。
- **OpenClaw 网关（① 入口 C）是可选旁路**：不经过它时，链路为 终端 → 宿主 → 编排 → hook → clawhip → Discord 的纯单向执行流；经过它时，人类可从 Discord 反向驱动编排层（回复 → wakeOpenClaw → 注入回合）。
- **hook 事件（⑥）是唯一的跨层共用信号**：同一事件同时驱动编排层状态机（续跑/验证）与 clawhip 通知（提醒人类）——这是 OMC/OMX 的「通知」与 clawhip 的「事件路由」可以合并的天然接口点。

### 3.3 引用核对说明（抽查记录）

上图中每个「出处」均在四份单工具文档中**实际存在**。抽查（已 grep 复核）：

| # | 引用 | 所在文档行 | 核对 |
|---|---|---|---|
| 1 | `wakeOpenClaw`（`src/openclaw/index.ts:76`）—— oh-my-codex.md §3.14 | oh-my-codex.md:346,609 | ✅ 存在 |
| 2 | `wakeOpenClaw`（`src/openclaw/index.ts:75`）+ `OMC_OPENCLAW=1` —— oh-my-claudecode.md §3.17 | oh-my-claudecode.md:366 | ✅ 存在 |
| 3 | 五共享事件 `docs/native-event-contract.md:15-23` + `map_shared_event` `:759-771` —— clawhip.md §M2.9 | clawhip.md:242,252 | ✅ 存在 |
| 4 | `KEYWORD_TRIGGER_DEFINITIONS`（`src/hooks/keyword-registry.ts:8-68`）+ `workflow-transition.ts:765` —— oh-my-codex.md §3.10 | oh-my-codex.md:263,585 | ✅ 存在 |
| 5 | `KEYWORD_PATTERNS:46-67` / `KEYWORD_PRIORITY:94-98` —— oh-my-claudecode.md §3.14 | oh-my-claudecode.md:297 | ✅ 存在 |
| 6 | `manager.ts:559` / `concurrency.ts:25` / `create.ts:124` —— oh-my-openagent.md §4.7/§4.9 | oh-my-openagent.md:228-229,268 | ✅ 存在 |
| 7 | `daemon.rs:73-185 run` + `EVENT_QUEUE_CAPACITY=256` —— clawhip.md §M7 | clawhip.md:341 | ✅ 存在 |
| 8 | `router.rs:100-120 resolve`（0..N 投递）—— clawhip.md §M4 | clawhip.md:605 | ✅ 存在 |
| 9 | `team-pipeline/state.ts:74 initTeamPipelineState` —— oh-my-claudecode.md §3.1 | oh-my-claudecode.md:69 | ✅ 存在 |
| 10 | `dispatchNotifications:749`（并行 + 15s 上限）—— oh-my-claudecode.md §3.17 | oh-my-claudecode.md:364 | ✅ 存在 |

---

## 4. 双视角总结：原生宿主 vs OpenCode 适配

### 4.1 适配状态速览

| 工具 | 原生宿主 | 原生实现形态 | OpenCode 适配状态 | 判定依据（文档出处） |
|---|---|---|---|---|
| **oh-my-codex** | Codex CLI | 独立 CLI `omx` + Codex 插件（plugin bundle + marketplace） | **需桥接 / 部分可移植**——独立 CLI 的运维/状态/通知子命令与 6 个 MCP 服务器可复用；launch/team/HUD 路径为 Codex+tmux 专属 | oh-my-codex.md §3.1, §3.15, 附注 |
| **oh-my-claudecode** | Claude Code | 插件（40+ 技能 / 19 agent / hooks / HUD）+ 终端 CLI 双表面 | **需桥接（无 OpenCode 插件代码）**——仓库内不存在 opencode.json / plugins 打包；`src/interop/` 是 OMX 互操作；各机制的「OpenCode 适配」是改造指引而非现成代码 | oh-my-claudecode.md §1, §3.x 各小节 |
| **oh-my-openagent** | OpenCode（Ultimate）/ Codex（Light）/ Senpi（beta） | **OpenCode 原生插件** + `omo` CLI + LazyCodex 分发 | **原生（插件）**——Ultimate 版即 OpenCode 插件，经 `createPluginModule` 装配；Light 版为 Codex 组件集 | oh-my-openagent.md §1, §3.1, §5 |
| **clawhip** | 无（daemon-first 独立进程） | Rust daemon + CLI + Codex/Claude 钩子注册 | **需桥接**——无 OpenCode 原生 provider 钩子；提供 5 条推荐桥接路径 | clawhip.md §M2.9, §五 |

### 4.2 差异细目表（逐工具：可移植 vs 不可移植）

| 工具 | ✅ 可直接复用（宿主无关 / 已原生） | ⚠️ 需改造或桥接 | 桥接/替代方案（出处） |
|---|---|---|---|
| **oh-my-codex** | `SKILL.md` 技能（格式与 OpenCode 一致）、`prompts/*.md` 角色文本、`.omx/` 状态布局与 JSON 状态文件、6 个 MCP 服务器（`omx mcp-serve`，完全可移植）、通知配置 schema、`omx_wiki/` 知识层、Sparkshell 原生侧车 | Codex 原生 hooks（`.codex/hooks.json`/`codex-native-hook.mjs`）、HUD tmux 布局、`omx exec/team` 对 `codex`/tmux 二进制依赖、`config.toml`/native agent TOML | OpenCode 中只使用运维/状态/通知子命令，执行交给 OpenCode 自身；`opencode.json` 的 `mcp` 段注册 `{"type":"local","command":["omx","mcp-serve","state"]}`（§3.1, §3.15, 附注） |
| **oh-my-claudecode** | `SKILL.md` 技能目录（frontmatter 触发词）、模式状态机（team-pipeline/autopilot/ralph 的纯文件逻辑）、PRD/verifier、5 层记忆（文件系统 + MCP 工具）、`wakeOpenClaw` 与 `dispatchNotifications` 纯函数（直接适配）、`omc` CLI 面（`buildProgram().parseAsync` 可直接调用） | 会话内技能依赖 Claude Code 原生机制：Stop 钩子续跑（ralph/autopilot/ultrawork）、`AskUserQuestion`（deep-interview）、原生 teams Task/团队机制（/team）、statusLine JSON-on-stdin 契约（HUD） | 钩子事件映射：UserPromptSubmit→chat.message、PreToolUse/PostToolUse→tool.execute、Stop→turn 结束、SessionStart/End→session 生命周期；/team 走 `omc team` CLI 或 ultrawork 并行替代；HUD 回退 tmux 窗格跑 `omc hud --watch`（§3.1, §3.3, §3.4, §3.14, §3.15, §3.17） |
| **oh-my-openagent** | **全部**（OpenCode 为原生宿主）：11 agent、56 钩子、5 内置 MCP、Team Mode、hashline 编辑、`omo.jsonc` 配置、Claude Code 兼容层（hooks/commands/skills/agents/MCPs 原样加载） | 无（OpenCode 侧）；Light 版需 Codex CLI 环境 | 多宿主视图：同一 `omo.jsonc` 的 `[opencode]`/`[codex]`/`[senpi]` 块；Codex 侧用 LazyCodex 分发（§1, §4.20, §5） |
| **clawhip** | daemon + CLI + 全部路由/渲染/sink 机制（与宿主无关）；`clawhip agent` 薄客户端（最稳路径）；`clawhip explain` 排障；`clawhip status` 健康检查 | 无 OpenCode 原生 provider 钩子（`native_hooks.rs:17-22` 只认 Codex/Claude）；`deliver` 的目标探测硬编码 Codex/Claude（`prompt_deliver.rs:73-86`）；非 git 目录的 native 事件被丢弃（daemon.rs:417-442） | 5 条桥接路径按推荐度：① 薄客户端直接桥（`clawhip agent started/…`）② native-hook 适配器（映射 v1 信封 → `clawhip native hook --provider codex`）③ 复用 `.clawhip/hooks/native-hook.mjs` 作管道端 ④ workspace monitor（状态 JSON → `[monitors.workspace]`）⑤ tmux 兜底（`clawhip tmux watch`；deliver 需先扩展 ProviderKind）（§五） |

**一句话总结**：OmO 是**唯一原生 OpenCode 插件**（OpenCode 用户首选）；OMX 是「部分可移植」——把 Codex 专属的启动/团队/HUD 留在 Codex，把状态/MCP/技能搬到 OpenCode；OMC 是「改造指引」——状态机与文件逻辑可平移，但所有依赖 Stop 钩子续跑与原生团队的能力都需在 OpenCode 事件模型上重建；clawhip 是「与宿主解耦的独立层」——不管 OpenCode 适配做不做，它都作为事件路由与通知出口独立存在。

---

## 5. 阅读导引

按「先总览 → 再逐工具 → 最后回到协作」的顺序阅读：

### 5.1 本文档（OVERVIEW.md）—— 四工具合订

| 章节 | 内容 | 何时读 |
|---|---|---|
| §1 四工具定位总览 | 各工具一句话定位 + 宿主 + 关系与重叠（通知/OpenClaw/事件语义） | 第一次接触本系列 |
| §2 机制横向对比表 | 14 行机制 × 4 工具矩阵 | 需要横向比较任一机制（如「谁的记忆系统怎么用」） |
| §3 端到端协作链路图 | mermaid 总览 + 带 10 处源码引用的 ASCII 详细链路 | 理解四工具如何串成一条完整流水线 |
| §4 双视角总结 | OpenCode 适配状态速览 + 逐工具可移植/桥接细目 | 决定「我的宿主下该用哪个工具、怎么接线」 |
| §5 阅读导引 | 本表 | 定位具体内容 |

### 5.2 docs/oh-my-codex.md —— OMX（Codex 工作流层，v0.20.5）

| 章节 | 内容 | 关键小节 |
|---|---|---|
| §1 概览 | 心智模型（Codex 干活，OMX 提供路由/工作流/运行时）+ 推荐默认流程 | README.md:295-305, 318-326 |
| §2 机制清单表 | 23 项机制速查（CLI/启动器/规划/执行/角色/技能/关键词/hooks/HUD/记忆/通知/MCP/插件/配置/Wiki/Sparkshell/Team/Ultragoal/Ralph） | 表内每行带入口与主要源码 |
| §3 各机制详解 | 3.1-3.24 逐机制（能力/用法/OpenCode 适配/源码原理/实现链路） | 3.10 关键词状态机、3.11 Hooks 四层、3.14 通知与 OpenClaw、3.20 Team、3.21 Ultragoal |
| §4 源码引用索引 | 分类引用表（CLI/关键词/状态机/hooks/通知/agent/执行模式） | 复核引用用 |
| §5 术语对照 + 附注 | 中文 ↔ 仓库术语；克隆基准与验证方式；OpenCode 适配总结 | 跨文档对齐术语 |

### 5.3 docs/oh-my-claudecode.md —— OMC（Claude Code 编排层）

| 章节 | 内容 | 关键小节 |
|---|---|---|
| §1 概览 | 双表面（插件/CLI）+ 关键定位差异 + **OpenCode 插件现状声明（不存在）** | README.md:135-149；§1 第三段 |
| §2 机制清单表 | 24 项机制速查 | 表内每行带入口/核心源码/一句话原理 |
| §3 各机制详解 | 3.1-3.22 逐机制 | 3.1 /team 管线、3.2 omc team、3.3-3.4 autopilot/ralph、3.9 ralplan 门禁、3.14 Hooks、3.16 记忆、3.17 通知与 OpenClaw、3.20 cancel |
| §4 源码引用索引 | 按 编排模式/智能体/技能/hooks/HUD/记忆/通知/团队运行时 分类 | 复核引用用 |
| §5 附注 | 5 条抽查核实记录（含 `opencode` 命中三分类） | 理解「无 OpenCode 插件」结论的证据 |

### 5.4 docs/oh-my-openagent.md —— OmO（OpenCode 编排层，5.0.0-beta.7）

| 章节 | 内容 | 关键小节 |
|---|---|---|
| §1 概览 | 命名史（oh-my-opencode → oh-my-openagent → LazyCodex）+ 三发行版（Ultimate/Light/Senpi） | README.md:114-141 |
| §2 机制清单表 | 24 项机制速查 | 表内每行带实现核心与对应小节 |
| §3 总架构与数据流 | 3.1 插件加载链路、3.2 一次 ultrawork 端到端数据流 | createPluginModule 装配链；Sisyphus 委派→背景 agent→todo 续跑 |
| §4 各机制详解 | 4.1-4.24 逐机制 | 4.1 ultrawork/ulw、4.2 Sisyphus、4.5 Goal、4.6-4.7 委派与背景 Agent、4.9 Team Mode、4.10 hashline、4.13 模型回退链、4.16 MCP、4.20 Claude Code 兼容层 |
| §5 LazyCodex | Codex 继任产品（npx lazycodex-ai install、组件清单） | Light 版读者必读 |
| §6 源码引用索引 | 速查表（插件入口/编排/并发/Team/hashline/钩子/MCP/配置/记忆） | 复核引用用 |
| §7 验收说明 | 快照版本、`$ultragoal` 不存在（对应 Goal）、ulw-loop 位置 | 版本对齐用 |

### 5.5 docs/clawhip.md —— clawhip（事件路由控制面，v0.6.11）

| 章节 | 内容 | 关键小节 |
|---|---|---|
| 一、概览 | 1.1 总体数据流（sources→queue→dispatcher→router→render→sink）、1.2 核心组件分层、1.3 默认端点与命令面 | ARCHITECTURE.md:16-81 |
| 二、机制清单表 | M1-M23 机制速查（事件模型/事件源/路由/渲染/传输/daemon/分发/钩子/deliver/memory/status/gajae/生命周期/令牌/白名单/绑定校验/插件/tmux/explain/预检/遥测） | 表内每行带源码位置 |
| 三、逐机制详解 | 每机制四段式（能力/用法+OpenCode 缺口/源码原理/实现链路） | M2.9 原生钩子（★）、M4 Router、M6 Sink、M7 daemon、M9-M10 钩子 CLI 与安装、M14 Gajae |
| 四、源码引用索引 | 入口/事件模型/事件来源/管道核心/配置/控制面 分类速查 | 复核引用用 |
| 五、OpenCode 适配缺口汇总 | **5 条桥接路径按推荐度排序** | OpenCode 用户接 clawhip 必读 |

### 5.6 建议阅读顺序

```
第一次接触：本文档 §1（定位）→ §2（横向对比）→ 选一个工具精读其单工具文档
编排层选型：OMX（Codex 用户）→ oh-my-codex.md；OMC（Claude Code 用户）→ oh-my-claudecode.md；
            OmO（OpenCode 用户）→ oh-my-openagent.md
通知/路由接入：clawhip.md §五（桥接路径）+ 本文档 §3 链路 ⑦⑧
```

---

*本总览基于四份单工具源码级参考文档合成，未新增独立源码引用；如需复核任一引用，请回查对应单工具文档的「源码引用索引」章节。*
