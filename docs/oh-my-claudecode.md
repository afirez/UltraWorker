# oh-my-claudecode（OMC）机制源码级参考文档

> 本文档基于仓库快照编写。仓库: `https://github.com/Yeachan-Heo/oh-my-claudecode`（38.5K stars，MIT）。npm 包名: `oh-my-claude-sisyphus`（`package.json:2`；品牌为 oh-my-claudecode，见 `README.md:241`）。
> 所有 `file:line` 引用均指向该快照的源码文件，并已抽查核实。本文档为源码级参考：每项机制给出 **能力说明 / 用法 / 源码实现原理 / 实现链路**，最终附**源码引用索引**。

---

## 1. 概览

oh-my-claudecode（OMC）是面向 Claude Code 的「团队优先」(Teams-first) 多智能体编排层，核心理念是「不要学 Claude Code，直接用 OMC」（`README.md:14-16`）。它由四套互锁系统组成：**Hooks** 检测生命周期事件 → **Skills** 注入行为 → **Agents** 执行专业任务 → **State** 跨上下文压缩跟踪进度（`docs/ARCHITECTURE.md:7`）。

OMC 暴露两个不同表面（`docs/GETTING-STARTED.md:26-33`；`README.md:135-149`）：

| 表面 | 内容 | 安装方式 |
|---|---|---|
| **Claude Code 插件**（品牌 oh-my-claudecode） | 会话内 `/team` `/autopilot` `/ralph` `/ultrawork` 等 40+ 斜杠技能、19 个智能体、hooks、HUD 状态栏、MCP 服务器 | `/plugin marketplace add` + `/plugin install`（`README.md:57-65`） |
| **终端 CLI**（npm 包 oh-my-claude-sisyphus） | `omc setup` / `omc team` / `omc ask` / `omc hud` 等命令 | `npm i -g oh-my-claude-sisyphus@latest`（`README.md:70`） |

**定位差异（重要）**：`/autopilot` `/ralph` `/ultrawork` `/deep-interview` 是**会话内技能**，仓库里不存在 `omc autopilot` / `omc ralph` / `omc ultrawork` CLI 子命令（`README.md:147`）；`omc team` 与 `/team` 是**两套不同的运行时**——前者启动 tmux CLI worker，后者运行会话内原生团队工作流（`README.md:174`）。

**OpenCode 插件适配现状（重要）**：经对仓库全量 `grep "opencode"` 核实，仓库内**不存在** OpenCode 插件代码：没有 `opencode.json`、没有 plugins 打包；`src/interop/` 是 OMX（Codex）互操作而非 OpenCode。所有 `opencode` 命中分三类：(1) 灵感来源项目 oh-my-opencode 的署名（如 `package.json:4` `README.md:635`）；(2) HUD 的一个名为 `opencode` 的渲染预设（`src/hud/types.ts:451,905`）；(3) `.omx/` 目录仅含 4 篇内部规划文档（`.omx/plans/source-overall-cleanup/*.md`）。各机制小节中的「OpenCode 适配」均基于此事实给出**适配差异与改造指引**，而非描述已存在代码。

---

## 2. 机制清单表

| # | 机制 | 入口 | 核心源码 | 一句话原理 |
|---|---|---|---|---|
| 1 | `/team` 会话内团队 | `/team N:agent-type "task"` | `src/hooks/team-pipeline/*`、`skills/team/SKILL.md` | 5 阶段状态机 `team-plan→team-prd→team-exec→team-verify→team-fix` |
| 2 | `omc team` CLI 团队 | `omc team 2:codex "..."` | `src/cli/team.ts`、`src/cli/commands/team.ts`、`src/team/runtime-v2.ts` | tmux 分裂窗格拉起真实 CLI worker |
| 3 | `/autopilot` 自主执行 | `/autopilot "idea"` / `autopilot:` 关键词 | `src/hooks/autopilot/pipeline.ts`、`skills/autopilot/SKILL.md` | 单主导智能体分阶段管线（ralplan→execution→ralph/qa） |
| 4 | `/ralph` 持久循环 | `ralph` 关键词 / `/ralph` | `src/hooks/persistent-mode/index.ts:1099`、`src/hooks/ralph/*` | Stop 钩子阻塞直到验证通过，迭代计数 |
| 5 | `/ultrawork` 最大并行 | `ultrawork`/`ulw` 关键词 | `src/hooks/ultrawork/index.ts`、`src/hooks/keyword-detector/ultrawork/` | 非团队模式的并行执行增强层 |
| 6 | `/ultragoal` 制品化目标 | `omc ultragoal create-goals` | `src/ultragoal/artifacts.ts`、`src/cli/commands/ultragoal.ts` | 不启动循环，仅落盘 brief/goals/ledger 制品 |
| 7 | `/ultraqa` QA 循环 | `/ultraqa --tests` | `src/hooks/ultraqa/index.ts` | 质量门循环，默认最多 5 轮 |
| 8 | `/pipeline` 顺序管线 | 技能 | `README.md:311` | 严格顺序的多阶段转换（未独立源码目录，见技能体系） |
| 9 | `/ccg` 三模型顾问 | `/ccg review this PR` | `skills/ccg/SKILL.md` | `/ask codex` + `/ask antigravity` 后 Claude 综合 |
| 10 | `/ralplan` 规划共识 | `ralplan` 关键词 | `src/hooks/keyword-detector/index.ts:1077`、`skills/ralplan/SKILL.md` | 模糊任务门禁 + Planner/Architect/Critic 迭代共识 |
| 11 | `/plan` 规划 | `/oh-my-claudecode:plan --consensus` | `skills/plan/SKILL.md` | 4 模式（Interview/Direct/Consensus/Review） |
| 12 | `/deep-interview` 苏格拉底访谈 | `/deep-interview "idea"` | `skills/deep-interview/SKILL.md` | 数学化模糊度门控的澄清访谈 → `.omc/specs/` |
| 13 | 智能体体系（19 个） | `Task(subagent_type="oh-my-claudecode:executor")` | `agents/*.md`、`src/agents/definitions.ts` | 按模型档位分派的专业 agent |
| 14 | 模型路由 | 自动 | `src/features/model-routing/router.ts`、`src/config/models.ts` | Haiku 简单 / Sonnet 标准 / Opus 复杂 |
| 15 | 技能系统 | `/skill` `/skillify` `/learner` | `skills/skill/SKILL.md`、`src/hooks/learner/*` | 从会话提取可复用模式并自动注入 |
| 16 | Hooks | `hooks/hooks.json` | `src/hooks/bridge.ts`、`src/hooks/index.ts` | 监听 Claude Code 11 个生命周期事件 |
| 17 | HUD 状态栏 | `settings.json` statusLine / `omc hud` | `src/hud/index.ts`、`src/hud/state.ts` | 读取模式状态实时渲染 |
| 18 | 记忆（notepad/project-memory/wiki/共享） | MCP 工具 | `src/hooks/notepad/*`、`src/hooks/project-memory/*`、`src/hooks/wiki/*`、`src/lib/shared-memory.ts` | 分层持久化知识 |
| 19 | 通知（Discord/Telegram/Slack/OpenClaw） | `/configure-notifications`、`omc config-stop-callback` | `src/notifications/dispatcher.ts`、`src/openclaw/*` | Stop 回调/生命周期事件推送 |
| 20 | 团队运行时（任务包/泳道/worktree/交接） | `omc team` | `src/team/state-paths.ts`、`src/team/git-worktree.ts`、`src/team/role-router.ts` | 文件系统协作协议 |
| 21 | CLI（omc 二进制） | `bin/oh-my-claudecode.js` | `src/cli/index.ts`（commander） | 30+ 子命令 |
| 22 | cancel | `cancelomc`/`stopomc` | `src/hooks/keyword-detector/index.ts:47`、`skills/cancel/SKILL.md` | 最高优先级关键词，逐模式清理 |
| 23 | verify | `/verify`、`skills/verify` | `src/verification/tier-selector.ts` | 按变更规模选择验证档位 |
| 24 | 会话搜索 | `omc session search` | `src/features/session-history-search/index.ts` | 跨项目 JSONL 全量搜索 |

---

## 3. 各机制详解

### 3.1 `/team` —— 会话内原生团队工作流

**能力说明**：协调 N 个 Claude 智能体共享任务列表，运行 5 阶段管线 `team-plan → team-prd → team-exec → team-verify → team-fix (loop)`（`README.md:178`；`skills/team/SKILL.md:95-99`）。v4.1.7 起 team 是 OMC 的规范编排表面，旧 `swarm` 关键词/技能已移除（`README.md:168`）。

**用法**：
- 会话内：`/team 3:executor "fix all TypeScript errors"`（`README.md:171`）；`/oh-my-claudecode:team`（技能名，`skills/team/SKILL.md:1-7`）。
- 需要开启 Claude Code 原生 teams：`~/.claude/settings.json` 设 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`（`README.md:180-188`）；未开启时 OMC 警告并尽量回退非团队执行。
- team 关键词被刻意禁用（`src/hooks/keyword-detector/index.ts:53` 永不匹配占位、`:836-838` 跳过）——team **必须显式** `/team` 调用。

**源码实现原理**：
- 阶段枚举：`src/hooks/team-pipeline/types.ts:9-17`（`TeamPipelinePhase` = team-plan/prd/exec/verify/fix/complete/failed/cancelled）。
- 状态机：`src/hooks/team-pipeline/state.ts:74` `initTeamPipelineState`（初始 phase=team-plan，`max_iterations:25`）、`:118` `readTeamPipelineState`、`:148` `writeTeamPipelineState`、`:186` `markTeamPhase`（team-fix 递增 `fix_loop.attempt`，达 `max_attempts:3` 置 failed，`:222`）。
- 转换规则：`src/hooks/team-pipeline/transitions.ts:5-14` `ALLOWED` 映射；`:25` `hasRequiredArtifactsForPhase`（team-exec 需 plan/prd 路径，team-verify 需 `tasks_completed>=tasks_total`）；`:50` `transitionTeamPhase`；`:96` `requestTeamCancel`（`preserve_for_resume`）。
- 阶段交接：`skills/team/SKILL.md:153-190`，每阶段写 `.omc/handoffs/<stage-name>.md`，lead 在启动下一阶段前读取先前 handoff，可取消后续航（resume）。
- 状态文件：`.omc/state/team-state.json` 或会话隔离 `.omc/state/sessions/{sessionId}/team-state.json`（`state.ts:17-22`）。
- ralph 与 team 联动：`src/hooks/ralph/loop.ts:528-556` `getTeamPhaseDirective` 读取团队阶段指令。

**实现链路**：`/team 3:executor "task"` → lead（planner）分解任务 → `initTeamPipelineState` → 逐阶段 `transitionTeamPhase` 写 `.omc/state/sessions/{id}/team-state.json` → `Task(name="worker-N")` 拉起团队成员 → team-exec 完成计数 → team-verify（verifier agent）→ 通过置 `complete`；失败进 team-fix（受 `fix_loop.max_attempts=3` 约束，超出置 `failed`）→ `/cancel` 请求关停 teammate 并写 `phase=cancelled, preserve_for_resume`。

**OpenCode 适配**：原生 teams 依赖 Claude Code 的 Task/团队机制；OpenCode 无对应能力，需改用 OMC 的 CLI 团队（`omc team`，见 3.2）或 ultrawork 并行作为替代。状态机 `team-pipeline` 本身与宿主无关，可复用。

---

### 3.2 `omc team` —— tmux CLI 团队运行时

**能力说明**：在 tmux 分裂窗格中启动**真实**的 CLI worker 进程（`claude`/`codex`/`gemini`/`antigravity`/`grok`/`cursor-agent`），按需拉起、任务完成即消亡（`README.md:192-224`）。v4.4.0 起移除了 Codex/Gemini MCP 服务器（x/g provider），改走 CLI-first 团队运行时（`README.md:194`）。`/omc-teams` 为遗留兼容技能，路由到 `omc team ...`（`README.md:206`）。

**用法**：`omc team 2:codex "review auth module"`、`omc team 1:claude "implement payment flow"`、`omc team status <team>`、`omc team shutdown <team>`（`README.md:197-204`）。需安装对应 CLI + tmux。

**源码实现原理**：
- CLI 注册：`src/cli/index.ts:1472-1481` `.command('team')`。
- 参数解析：`src/cli/commands/team.ts:399` `parseTeamArgs`（`N:agent-type[:role]`）；`:29` `VALID_TEAM_CLI_AGENT_TYPES`；任务分解 `splitTaskString:206`、`buildTeamLaunchTasks:535`。
- 生命周期：`handleTeamStart:721`（v2 启用则 `startTeamV2` 否则 v1）、`handleTeamStatus:832`、`handleTeamShutdown:893`、`handleTeamApi:914`（25 个 worker API 操作，字段映射 `:80-113`）。
- 运行时：v2 `src/team/runtime-v2.ts`（`startTeamV2:3007`、`monitorTeamV2:3808`、`shutdownTeamV2:4034`、`resumeTeamV2:4529`、`recoverDeadWorkerV2:192`）；v1 `src/team/runtime.ts`。
- tmux 通信：`src/team/tmux-comm.ts`（`sendTmuxTrigger:106`、`queueInboxInstruction:128`、`queueBroadcastMessage:185`、`readMailbox:221`）；窗格管理 `src/team/tmux-session.ts`（`createTeamSession:1144`、`spawnWorkerInPane:1312`、`killTeamSession:2133`）。
- 状态路径：`src/team/state-paths.ts:32-216` `TeamPaths`，根目录 `.omc/state/team/{teamName}/`，含 `config.json`、`tasks/task-{id}.json`、`workers/{worker}/heartbeat.json`、`inbox.md`、`outbox.jsonl`、`mailbox/`、`events.jsonl`、`approvals/`。
- 卸载时清理：`src/cli/team.ts:488` `cleanupTeamJob`。

**实现链路**：`omc team 2:codex "task"` → `parseTeamArgs` → `splitTaskString` 分解 → `buildTeamLaunchTasks` → `startTeamV2` 用 tmux 建会话分裂窗格（`tmux new-session` + `send-keys`），每个窗格跑带 `OMC_TEAM_WORKER=team/worker-N` 环境变量的 provider CLI → worker 通过 `omc team api claim-task / update-worker-heartbeat` 认领任务并心跳 → `monitorTeamV2` 轮询 → `omc team shutdown` 拆窗格并清理 `.omc/state/team/{teamName}/`。

**OpenCode 适配**：`src/team/` 整层基于 tmux + git worktree，与宿主无关，可直接复用；仅需将 `buildWorkerStartCommand`（`tmux-session.ts:771`）的 worker 启动命令改为 OpenCode CLI（若 OpenCode 提供 headless CLI）。worker API 操作由 `omc team api` 提供，OpenCode 侧可通过 shell 调用。

---

### 3.3 `/autopilot` —— 自主执行管线

**能力说明**：单主导智能体的全自主 5 阶段管线：expansion（analyst/architect）→ planning（planner/critic）→ execution（executor）→ QA（自动修复再验证）→ validation（专家复核），全部通过才算完成（`docs/GETTING-STARTED.md:178-198`）。支持命名阶段档案 `--workflow <name>`（`README.md:105-130`）。

**用法**：`/autopilot "build a REST API"`；自然语言 `autopilot: build me a todo app`（`README.md:97-101`）；档案 `autopilot.workflows` 配于 `.claude/omc.jsonc` 或 `~/.config/claude-omc/config.jsonc`（`README.md:111-124`），合法序列 `[ralplan,execution]`、`[ralplan,execution,ralph]`、`[ralplan,execution,qa]`、`[ralplan,execution,ralph,qa]`。档案模式需 Linux + `flock`（`README.md:128`）。

**源码实现原理**：
- 关键词触发：`src/hooks/keyword-detector/index.ts:49` `autopilot: /\b(autopilot|fullsend|full\s+auto)\b|\b(?:build|create|make)\s+me\s+…` 及 "I want a …" 别名。
- 管线：`src/hooks/autopilot/pipeline.ts` —— `WORKFLOW_STAGE_SEQUENCES:87`、`initPipeline:343`、`buildPipelineTracking:255`、`getCurrentStageAdapter:386`/`getNextStageAdapter:408`、**`advanceStage:434`**（标记当前完成、激活下一阶段、调用 adapter `onExit`/`onEnter`）、`failCurrentStage:509`、`incrementStageIteration:533`。
- 阶段适配器：`src/hooks/autopilot/adapters/index.ts:24-28` `ALL_ADAPTERS = [ralplanAdapter, executionAdapter, ralphAdapter, qaAdapter]`。
- 状态/控制：`src/hooks/autopilot/state.ts`（`readAutopilotState`/`writeAutopilotState`/`initAutopilot`）、`cancel.ts`、`enforcement.ts`（`checkAutopilot`）；Stop 钩子集成于 `src/hooks/persistent-mode/index.ts:57`。

**实现链路**：`/autopilot "idea"` → `initPipeline` 在 autopilot 状态写入 `pipelineTracking` → 每次 Stop 事件 `checkAutopilot` → `advanceStage` 依 adapter 发出的完成信号（`RALPLAN_COMPLETION_SIGNAL` 等）推进 ralplan→execution→(ralph)→(qa) → resume/cancel 依据持久化的档案哈希。状态在 `.omc/state/autopilot*.json`（会话变体 `.omc/state/sessions/{id}/autopilot.json`）。

**OpenCode 适配**：`/autopilot` 无 CLI 子命令（`README.md:147`），会话内技能依赖 Claude Code 的 Stop 钩子续跑机制；OpenCode 需将 `checkAutopilot`（persistent-mode）映射到 OpenCode 的 turn 结束事件。阶段适配器与状态机本身可移植。

---

### 3.4 `/ralph` —— 持久验证/修复循环

**能力说明**：自我指涉循环，直到验证完成才停止（"cannot stop until verified done"，`skills/ralph/SKILL.md:1-6`）。ralph 自动包含 ultrawork 的并行执行（`README.md:410`）。可选验证评审者 `--critic=architect|critic|codex`。

**用法**：`/ralph "refactor auth"` 或自然语言 `ralph:` / `don't stop` / `must complete`（`README.md:400`；`docs/ARCHITECTURE.md:236-241`）。

**源码实现原理**：
- **魔法关键词定义**：`src/hooks/keyword-detector/index.ts:48` `ralph: /\b(ralph)\b(?!-)|(랄프)(?!로렌)|(ラルフ)(?!・?ローレン)/i`；优先级 `cancel > ralph > autopilot > …`（`:94-98`）。
- 循环状态：`src/hooks/ralph/loop.ts` —— `RalphLoopState:89`（active/iteration/max_iterations/linked_ultrawork/critic_mode）、`readRalphState:142`、`writeRalphState:164`、**`incrementRalphIteration:207`**、`createRalphLoopHook:282`（`startLoop:283` 自动写联动 ultrawork 状态 `:352-363`；`cancelLoop:369`）。
- **循环主体（Stop 钩子阻塞）**：`src/hooks/persistent-mode/index.ts:1099` `checkRalphLoop` —— 会话隔离 `:1125`、linked-ultrawork 自愈 `:1145`、团队阶段协调 `:1165`、待验证处理 `:1205-1283`、单故事 `passes && !architectVerified` 门 → `startVerification` `:1290-1309`、PRD 全完成 → 验证 `:1313`、硬上限 `getHardMaxIterations()` `:1336`、软 `max_iterations` 自动 +10 `:1358`、**`incrementRalphIteration:1375`** 与续跑提示 `[RALPH - ITERATION n/max]` `:1387-1406`。
- 评审者：`src/hooks/ralph/verifier.ts` —— `startVerification:160`、`recordArchitectFeedback:188`（最多 3 次 `:210`）、`getArchitectVerificationPrompt:224`（输出 `<ralph-approved critic="…">VERIFIED_COMPLETE</ralph-approved>` 标签 `:226`）、`detectArchitectApproval:323`、`detectArchitectRejection:362`。
- PRD：`src/hooks/ralph/prd.ts`（`ensurePrdForStartup`/`markStoryComplete`/`markStoryArchitectVerified`）；进度 `progress.ts`（`progress.txt`）；遗留巨石状态 `src/features/boulder-state/constants.ts`（`boulder.json`）。
- 状态文件：`.omc/state/ralph.json`（会话变体 `.omc/state/sessions/{sessionId}/ralph.json`）、`prd.json`、`ralph-verification.json`（`verifier.ts:98-103`）。

**实现链路**：提示含 `ralph` → keyword-detector 注入模式 → `createRalphLoopHook.startLoop` 写 ralph 状态（+ 联动 ultrawork）并搭 PRD → 每次 Stop 事件跑 `checkRalphLoop`：iteration++，从 PRD 取故事，经 ultrawork 并行实现 → 故事 `passes:true` 触发 architect/critic 验证 → 检测到 `VERIFIED_COMPLETE` 标签则 `clearRalphState` 并提示完成；被拒则 `getArchitectRejectionContinuationPrompt` 继续循环。

**OpenCode 适配**：ralph 循环机制全部依赖 Stop 钩子注入续跑提示（system-reminder "The boulder never stops"，`docs/ARCHITECTURE.md:362`）。OpenCode 需在 turn 结束时提供等价续跑注入；其余（PRD、verifier、状态机）为纯文件逻辑可复用。

---

### 3.5 `/ultrawork` —— 最大并行（非团队）

**能力说明**：并行执行引擎，一次性拉起多个智能体同时工作；作为 ralph/autopilot 之上的增强层（`skills/ultrawork/SKILL.md:1-6`）。

**用法**：`ultrawork implement OAuth` / `ulw` / `uw` 关键词；`/ultrawork "fix all errors"`（`README.md:401`）。

**源码实现原理**：
- 关键词：`src/features/magic-keywords.ts:68-76` `ultraworkEnhancement`（triggers `['ultrawork','ulw','uw']`，前插 `getUltraworkMessage(agentName, modelId)`）；`src/hooks/keyword-detector/index.ts:50` 正则；config 可自定义该四类关键词之一（`docs/GETTING-STARTED.md:362-384`，注意 autopilot/ralph/ccg 硬编码不可改）。
- 状态/强化：`src/hooks/ultrawork/index.ts` —— `readUltraworkState:81`、`writeUltraworkState:107`、`activateUltrawork:123`、`deactivateUltrawork:151`、`incrementReinforcement:197`、`shouldReinforceUltrawork:220`、`getUltraworkPersistenceMessage:243`。
- 持久消息模板：`src/hooks/keyword-detector/ultrawork/index.js`。
- Stop 阻塞：`src/hooks/persistent-mode/index.ts`（优先级 `Ralph > Ultrawork > Todo Continuation`，`:1-11`）。
- 执行协议：`skills/ultrawork/SKILL.md:30-60`（并行波次、依赖矩阵、档位路由）。

**实现链路**：`ultrawork`/`ulw` 进入提示 → magic-keyword 处理器追加并行执行指令 → ralph/autopilot 叠加其上；独立 ultrawork 写 `.omc/state/ultrawork-state.json`（带 `linked_to_ralph` 标记，ralph 的 `loop.ts:190-202 clearLinkedUltraworkState` 负责解链）。

---

### 3.6 `/ultragoal` —— 制品化目标/检查点/证据

**能力说明**：持久化多目标工作流，仅落盘 `.omc/ultragoal/` 制品（brief/goals/ledger），**不启动循环**；适合交接、审计或循环运行时不可用场景（`README.md:310`；`skills/ultragoal/SKILL.md:1-6`）。

**用法**：`omc ultragoal create-goals --brief "..."`、`complete-goals`、`add-goal`、`record-review-blockers`、`checkpoint --status complete|failed|blocked`、`status`、`list-plans`（`src/cli/commands/ultragoal.ts:23-64`）；多仓库并行：`.omc-workspace` 标记（`README.md:374-387`）。

**源码实现原理**：
- CLI 注册：`src/cli/index.ts:1523-1533`。
- 制品：`src/ultragoal/artifacts.ts` —— `ULTRAGOAL_DIR='.omc/ultragoal'` `:11`、`brief.md`/`goals.json`/`ledger.jsonl` `:12-14`、多计划 `plans/{planId}/` 布局 `:17-33`；`UltragoalItem:38`（status/attempt/evidence）、`UltragoalLedgerEntry:82`（plan_created/goal_started/goal_completed 等事件）。
- 函数：`createUltragoalPlan`、`startNextUltragoal`、`checkpointUltragoal`、`addUltragoalGoal`、`summarizeUltragoalPlan`、`listUltragoalPlanIds`、`resolveActivePlanId`、`recordFinalReviewBlockers`（`src/cli/commands/ultragoal.ts:9-20` 导入）。
- Claude `/goal` 快照对齐：`src/goal-workflows/claude-goal-snapshot.js` `reconcileClaudeGoalSnapshot`。
- 文档：`docs/ultragoal.md`。

**实现链路**：`create-goals` 写 `.omc/ultragoal/{brief.md, goals.json, ledger.jsonl}` → `complete-goals` 追加 ledger 事件、更新状态并打印面向模型的交接指令（指示活跃 agent 设置 Claude Code `/goal`）→ `checkpoint` 记录证据 → 最终完成受 `record-review-blockers` + `--quality-gate-json APPROVE` 门控。

---

### 3.7 `/ultraqa` —— QA 循环

**能力说明**：测试/构建/ lint/typecheck 质量门循环：test → verify → fix → repeat，直到目标达成（`skills/ultraqa/SKILL.md:1-6`）。

**用法**：`/ultraqa --tests|--build|--lint|--typecheck|--custom <pattern> [--interactive]`（`skills/ultraqa/SKILL.md:22-34`）；ralph 激活期间拒绝启动 UltraQA（`src/hooks/ralph/loop.ts:51-87 isUltraQAActive`，门 `:289`）。

**源码实现原理**：`src/hooks/ultraqa/index.ts` —— `UltraQAGoalType:11`、`DEFAULT_MAX_CYCLES=5:52`、`readUltraQAState:59`、`startUltraQA:89`、`recordFailure:122`（递增 `state.cycle:150`，`cycle>max_cycles` 终止 `:153`）、`completeUltraQA:168`、`stopUltraQA:188`（reason max_cycles/same_failure/env_error）、`cancelUltraQA:214`、`getGoalCommand:235`、`formatProgressMessage:253`。状态文件 `.omc/state/ultraqa-state.json` / 会话变体。

**实现链路**：`/ultraqa --tests` → `startUltraQA` → 跑 `getGoalCommand` → 通过 `completeUltraQA`；失败 → architect 诊断（SKILL.md 步骤 3）→ `recordFailure` cycle++ → 重试至 `max_cycles` 或 `same_failure`。

---

### 3.8 `/ccg` —— Claude-Codex-Antigravity 三模型顾问

**能力说明**：同时 fan-out 到 Codex 与 Antigravity，Claude 综合结果；Gemini 作为企业/API-key 回退（`docs/ARCHITECTURE.md:256-261`）。

**用法**：`/ccg review this PR`（`README.md:210-212`）；混合 Codex + Antigravity 单命令协作。

**源码实现原理**：技能文件 `skills/ccg/SKILL.md`；经由 `/ask codex` + `/ask antigravity`（3.21 的 ask 机制）路由，Claude 综合。`ccg` 关键词硬编码于 keyword-detector（`docs/ARCHITECTURE.md:317`）。

---

### 3.9 `/ralplan` —— 迭代规划共识 + 执行门禁

**能力说明**：Planner → Architect → Critic 循环直至达成共识的规划入口，且**自动门禁**模糊的 ralph/autopilot/team/ultrawork 请求（`skills/ralplan/SKILL.md:1-6`）。

**用法**：`ralplan this feature`（`README.md:402`）；`/oh-my-claudecode:plan --consensus` 别名；`--interactive`/`--deliberate`/`--architect codex`/`--critic codex` 旗标（`skills/ralplan/SKILL.md:20-23`）。旧 `plan this`/`plan the` 关键词已移除（`README.md:412`）。

**源码实现原理**：
- **程序化门禁**：`src/hooks/keyword-detector/index.ts` —— `EXECUTION_GATE_KEYWORDS={ralph,autopilot,team,ultrawork}` `:991-996`、`GATE_BYPASS_PREFIXES=['force:','!']` `:1001`、`WELL_SPECIFIED_SIGNALS` 正则 `:1007-1039`、`isUnderspecifiedForExecution()` `:1047-1069`（≤15 有效词判定模糊）、`applyRalplanGate()` `:1077-1113`（将执行关键词替换为 ralplan）。
- 状态机：`src/hooks/bridge.ts` `activateRalplanState:664`（写 `mode:"ralplan", active:true`）、`deactivateRalplanState:678`、`seedRalplanStartupState:718`；状态文件 `ralplan-state.json`（`src/lib/mode-names.ts:64`），会话隔离 `.omc/state/sessions/{sessionId}/ralplan-state.json`；取消清理 `src/hooks/autopilot/cancel.ts:49`。
- 参与 agent：planner（`src/agents/planner.ts:35-40`，opus）、architect（`architect.ts:42-46`，只读）、critic（`critic.ts:36-40`，只读）。
- 共识流程：`skills/ralplan/SKILL.md:44-65`（Planner → RALPLAN-DR 摘要 → Architect 抗辩 → Critic → 最多 5 轮重审 → pending approval → team/ralph 交接）。

**实现链路**：用户提示 → keyword-detector 门禁 → ralplan 技能 → `plan --consensus` → Planner 写计划 + RALPLAN-DR → Architect/Critic 独立评审（≤5 轮）→ 合并改进 + ADR → `.omc/plans/ralplan-*.md` 置 `pending approval` → `state_write(active=false)` → `Skill("omc:team")` 或 `Skill("omc:ralph")`。

---

### 3.10 `/plan`（omc-plan）—— 战略规划

**能力说明**：带可选访谈工作流的战略规划技能，4 模式：Interview（默认，适用于宽泛任务）、Direct（`--direct`）、Consensus（`--consensus`/"ralplan"）、Review（`--review`）（`skills/plan/SKILL.md:53-58`）。

**用法**：`/oh-my-claudecode:plan [--direct|--consensus|--review] [--interactive] [--deliberate] <task>`；frontmatter `pipeline: [deep-interview]`、`handoff-policy: approval-required`、`handoff: .omc/plans/ralplan-*.md`（`skills/plan/SKILL.md:1-9`）。`/planner`、`/ralplan`、`/review` 已并入 `/plan`（`:291`）。

**源码实现原理**：共识循环步骤 1-9（`skills/plan/SKILL.md:94-132`）；状态生命周期规则 `:85-92`（进入写 `state_write(mode="ralplan")`，交接前 `active=false`，终态 `state_clear`）；管线机制 `src/utils/skill-pipeline.ts`（approval 门控 `:134`）；技能注册/解析 `src/features/builtin-skills/skills.ts`（`parseFrontmatter:16`、`getBuiltinSkill:365`）。autopilot 若发现 `.omc/plans/ralplan-*.md` 或 `consensus-*.md` 则跳过其 Phase 0/1（`skills/autopilot/SKILL.md:84`）。

---

### 3.11 `/deep-interview` —— 苏格拉底深度访谈

**能力说明**：以数学化模糊度门控（weighted-dimension clarity scoring）的苏格拉底式澄清访谈，写码前暴露隐含假设，衡量多维度清晰度（`README.md:161-164`；`skills/deep-interview/SKILL.md:1-9`）。

**用法**：`/deep-interview "I want to build a task management app"`；`[--quick|--standard|--deep] [--autoresearch]`；输出 `.omc/specs/deep-interview-{slug}.md`。

**源码实现原理**（均在 `skills/deep-interview/SKILL.md`）：
- **Phase 0 阈值解析** `:72-92`：`omc.deepInterview.ambiguityThreshold` 优先级 user `~/.claude/settings.json` → project → 默认 `0.2`。
- Phase 1 初始化 `:94-157`（explore/haiku agent 判定 brownfield/greenfield，`state_write(mode="deep-interview")`）。
- Round 0 拓扑门 `:159-220`（一次性组件枚举 + 确认）。
- Phase 2 访谈循环 `:222-370`：最弱维度定向提问、每轮一次 `AskUserQuestion`、**打分 prompt**（opus，temp 0.1，`:271-314`）、**模糊度数学** `:316-319`（greenfield `1-(goal*.40+constraints*.30+criteria*.30)`；brownfield 含 context 0.15）、本体抽取 + 稳定性比 `:303-336`、进度表 `:338-360`、软上限轮次 3/10/20 `:366-370`。
- Phase 3 挑战 agent `:372-388`（Contrarian 第 4 轮+、Simplifier 第 6 轮+、Ontologist 第 8 轮+，提示注入而非 spawn）。
- Phase 4 规格结晶 `:390-489` → `.omc/specs/deep-interview-{slug}.md`。
- Phase 5 执行桥 `:491-546`（5 个 AskUserQuestion 选项，**绝不自动执行**）。
- `--autoresearch` `:55-64` → `Skill("oh-my-claudecode:autoresearch")`；CLI `omc autoresearch` 为 hard-deprecated shim（`src/cli/index.ts:1488`；`src/cli/autoresearch-guided.ts:28` `AUTORESEARCH_SETUP_SLASH_COMMAND='/deep-interview --autoresearch'`）。
- 状态：`.omc/state/deep-interview-state.json`（`src/lib/mode-names.ts:65`；resume `SKILL.md:720`）。

**实现链路**：模糊想法 → Phase 0 阈值 → Phase 1 状态初始化 → Round 0 拓扑 → Phase 2 循环（状态更新 + 本体快照）→ Phase 4 `.omc/specs/deep-interview-{slug}.md`（pending approval）→ Phase 5 用户显式选择 → `Skill("omc:plan") --consensus --direct`（写 `.omc/plans/ralplan-*.md`）→ 独立执行审批 → team/ralph/autopilot。

**OpenCode 适配**：依赖 Claude Code `AskUserQuestion` 工具做每轮提问；OpenCode 需映射到其交互式输入机制。打分逻辑（权重、阈值、挑战轮次）为纯提示文本，可平移。

---

### 3.12 智能体体系（19 个专业智能体 + 模型路由）

**能力说明**：19 个专业智能体（含档位变体），按 4 条泳道组织：Build/Analysis（explore/analyst/planner/architect/debugger/executor/verifier/tracer）、Review（security-reviewer/code-reviewer）、Domain（test-engineer/designer/writer/qa-tester/scientist/git-master/document-specialist/code-simplifier）、Coordination（critic）（`docs/ARCHITECTURE.md:48-99`）。智能模型路由：Haiku 简单任务、Sonnet 标准、Opus 复杂推理，节省 30-50% token（`README.md:288`）。

**用法**：`Task(subagent_type="oh-my-claudecode:executor", model="sonnet", prompt="...")`（`docs/ARCHITECTURE.md:120-126`）；每 agent 默认模型表见 `docs/GETTING-STARTED.md:340-360`（explore/writer=haiku，executor/debugger/designer/verifier/tracer/security-reviewer/test-engineer/qa-tester/scientist/git-master/document-specialist=sonnet，architect/planner/critic/analyst/code-reviewer/code-simplifier=opus）。

**源码实现原理**：
- 19 个提示文件 `agents/*.md`（YAML frontmatter name/description/model/level/disallowedTools + XML `<Agent_Prompt>`，非 markdown 标题结构）；注册表 `src/agents/definitions.ts:202` `getAgentDefinitions()`（L213-252，分 Build/Analysis/Review/Domain/Coordination 组），模型优先级 `:264` `override?.model ?? inheritModel ?? configuredModel ?? agentConfig.model`。
- 提示装载：`src/agents/utils.ts:88` `loadAgentPrompt()`（esbuild 注入 `__AGENT_PROMPTS__` 或运行时读 `agents/{name}.md` 并 strip frontmatter `:76`；路径穿越防护 `:91-93`）。
- 编排器提示：`omcSystemPrompt`（`definitions.ts:290-405`，硬编码 19-agent 目录 "Available Subagents (19 Agents)" `:299`）。
- **模型路由**：静态默认 `defaultModel`（`types.ts:79`）+ 复杂度评分动态路由 `src/features/model-routing/` —— `router.ts:25` `routeTask()`、`:281` `getModelForTask()`；`types.ts:29` `TIER_TO_MODEL_TYPE`（LOW:haiku/MEDIUM:sonnet/HIGH:opus）、`DEFAULT_ROUTING_CONFIG:205`、`COMPLEXITY_KEYWORDS:237`；默认值 `src/config/models.ts`（`getDefaultModelHigh:161`/`Medium:165`/`Low:169`、`resolveInheritedModelFromEnv:137`、`shouldAutoForceInherit:408`）。配置见 `.claude/omc.jsonc` 的 `agents`/`routing`（`docs/GETTING-STARTED.md:319-407`）。
- **档位变体**：`docs/agents/model-compatibility.md:50-97` Premium/Balanced/Budget 三预设；代码侧 `src/agents/prompt-sections/index.ts:31-58` 处理 `-low/-high` 变体；验证档位 `src/verification/tier-selector.ts:24-40`（LIGHT=architect-low/haiku、STANDARD=architect-medium/sonnet、THOROUGH=architect/opus）。

**Sisyphus / Hephaestus / Prometheus 命名（澄清）**：这些是 **OMO（oh-my-opencode）的品牌名**，非 OMC 运行时 agent 名。仓库内仅 5 处命中：`docs/agents/model-compatibility.md:14-20`（矩阵：Prometheus=Planning、Sisyphus/Hephaestus=Implementation）、`research/hephaestus-vs-deep-executor-comparison.md`（整篇对比研究）、`src/installer/legacy-claude-md-corpus.ts:325-390`（遗留迁移语料 "# Sisyphus Multi-Agent System"）、`src/installer/__tests__/fixtures/legacy-guides.json:334-404`、`src/__tests__/ralph-prd-mandatory.test.ts:447`（偶然文本）。README 与 `src/` 运行时 agent 代码均无此命名。

**实现链路**：调用方 `Task(subagent_type=...)` → Claude Code 加载 `agents/{name}.md` 提示 → `getAgentDefinitions` 解析配置 → `loadAgentPrompt` 注入 → `routeTask`/`getModelForTask` 选档（config override > inherit > 默认）→ 执行 → subagent-tracker 跟踪（3.16）。

**OpenCode 适配**：agent 定义为 `.md` 提示 + 模型档位，OpenCode 的 agent 定义（name/description/prompt/model）可直接映射；`disallowedTools` 映射到 OpenCode 的工具白名单/黑名单。

---

### 3.13 技能系统（skill / skillify / learner / 自动注入）

**能力说明**：OMC 将踩坑得来的调试知识提取为可移植技能文件，相关时自动注入上下文——"学一次，永久复用"（`README.md:339-364`）。

**用法**：`/skill list|add|remove|edit|search`（`README.md:360`）；`/skillify`（提取，三道质量门）；`/learner`（兼容别名）；项目级 `.omc/skills/`（可提交共享，优先级高）vs 用户级 `~/.omc/skills/`（跨项目，回退低优先级）（`README.md:343-348`）。

**源码实现原理**：
- CRUD 规范（由 Claude 执行）：`skills/skill/SKILL.md` —— `list:14-47`、`add:50-120`（用户级 `${CLAUDE_CONFIG_DIR}/skills/omc-learned/<name>/SKILL.md`、项目级 `.omc/skills/<name>/SKILL.md` `:63-65`）、`remove:124-154`、`edit:158-202`、`search:206-249`、`sync:297-357`、`setup:361-484`、模板 `:496-656`。
- 程序化后端 `src/hooks/learner/`：`writer.ts:49` `writeSkill()`（frontmatter 生成、去重 `:106`）、`loader.ts:26` `loadAllSkills()`（项目优先覆盖用户 `:52,56-58`）、`:82` `findMatchingSkills()`（trigger +10、tag +5、质量/使用加成）、`finder.ts:64` `findSkillFiles()`（项目目录优先、symlink 逃逸防护）。
- **存储路径常量**：`src/hooks/learner/constants.ts` —— `USER_SKILLS_DIR`（`~/.claude/skills/omc-learned`）`:11`、`GLOBAL_SKILLS_DIR`（`~/.omc/skills`）`:14`、`PROJECT_SKILLS_SUBDIR`（`.omc/skills`）`:17`、`.agents/skills` 兼容只读 `:20`。
- **自动注入**：`hooks/hooks.json:14-16` UserPromptSubmit 第二命令 `scripts/skill-injector.mjs`（`main():567-621`，读取 stdin 提示、`findMatchingSkills():482-499`、去重状态 `.omc/state/sessions/{sid}/skill-sessions-fallback-state.json`）；桥接路径 `src/hooks/learner/index.ts` `processMessageForSkills():126-178`（`MAX_SKILLS_PER_SESSION=10`）→ `formatSkillsForContext():89-121`（3000 字符预算，`<learner>` 标签）。
- **frontmatter 解析**：`src/utils/frontmatter.ts` `parseFrontmatter():26-48`；`src/hooks/learner/parser.ts` `parseSkillFile():19`、`generateSkillFrontmatter():210`；内置技能 `src/features/builtin-skills/skills.ts` `loadSkillFromFile():234-289`。
- skillify 质量门：`skills/skillify/SKILL.md:16-22` 三问（5 分钟内能 Google 到？→No / 特定于本代码库？→Yes / 付出过真实调试努力？→Yes）；程序化 `src/hooks/learner/validator.ts` `validateExtractionRequest()`、`auto-learner.ts`（`calculateSkillWorthiness`/`extractTriggers`）。
- 学习检测：`src/hooks/learner/detection-hook.ts` `processResponseForDetection():58-90`（阈值 60、冷却 5 条消息）。

**实现链路**：`/skill add` →（Claude）按 `skills/skill/SKILL.md` 向导写 `.omc/skills/<name>/SKILL.md`；程序化路径经 `learner/writer.ts → getSkillsDir → writeFileSync`。注入链路：用户提交 → skill-injector.mjs（hooks.json）→ `findMatchingSkills` → `<mnemosyne>` 附加上下文进 `<system-reminder>`。

**OpenCode 适配**：SKILL.md 目录（frontmatter 触发词）需转为 OpenCode 插件的 `prompt()`/agent 指令逻辑；自动注入的 UserPromptSubmit 钩子对应 OpenCode 的 chat.message 事件。

---

### 3.14 Hooks（生命周期钩子系统）

**能力说明**：OMC 的核心机制载体。监听 Claude Code 11 个生命周期事件（UserPromptSubmit/SessionStart/PreToolUse/PermissionRequest/PostToolUse/PostToolUseFailure/SubagentStart/SubagentStop/PreCompact/Stop/SessionEnd），通过 `<system-reminder>` 注入上下文（`docs/ARCHITECTURE.md:327-343`）。21 个钩子、事件→脚本映射表见 `docs/HOOKS.md:99-213`。

**用法**：无需用户操作，安装时自动配置。禁用：`export DISABLE_OMC=1`（全部）；`export OMC_SKIP_HOOKS="keyword-detector,persistent-mode"`（部分）（`docs/ARCHITECTURE.md:414-424`）。

**源码实现原理**：
- **投递机制**：插件 `hooks/hooks.json`（219 行，11 事件 ~28 命令）是现行投递方式；旧 `settings.json` hooks 写入已废弃（`src/installer/hooks.ts:383-385`，`HOOKS_SETTINGS_CONFIG_NODE:307-378` 仅供历史/回退）。
- **事件分发器**：`src/hooks/bridge.ts` `processHook:3071`（HookInput/HookOutput JSON 协议 `:1109-1149`）、`processPreToolUse:2329`、`buildSessionStartAdditionalContext:190`。
- **核心钩子**：
  - keyword-detector（UserPromptSubmit）：`src/hooks/keyword-detector/index.ts`（`KEYWORD_PATTERNS:46-67`、`KEYWORD_PRIORITY:94-98`、`detectKeywordsWithType:806`、`getAllKeywords:877`、`applyRalplanGate:1077`）。
  - persistent-mode（Stop，循环续跑核心）：`src/hooks/persistent-mode/index.ts` `checkPersistentModes:2217`、`createHookOutput:2556`。
  - notepad/project-memory/pre-compact（上下文保持）：见 3.18。
  - permission-handler（PermissionRequest）：`src/hooks/permission-handler/index.ts` `processPermissionRequest:642`、`isSafeCommand:556`。
  - subagent-tracker（SubagentStart/Stop）：`src/hooks/subagent-tracker/index.ts` `processSubagentStart`/`processSubagentStop`。
  - 其余：setup、session-end、mode-registry、auto-slash-command、think-mode（ultrathink）、rules-injector、todo-continuation、recovery、preemptive-compaction、code-simplifier、wiki、learner、skill-state、omc-orchestrator、background-notification 等（完整注册表 `src/hooks/index.ts`，822 行导出桶）。
- 状态文件统一经 `src/lib/mode-state-io.ts`（`writeModeState:1102`、`withStateFileMutationLock:146`），会话隔离 `.omc/state/sessions/{sessionId}/<mode>.json`。

**注入模式含义**：`hook success: Success`（继续）、`hook additional context: ...`（注意）、`[MAGIC KEYWORD: ...]`（激活技能）、`The boulder never stops`（ralph/ultrawork 激活）（`docs/ARCHITECTURE.md:355-362`）。

**实现链路**：Claude Code 事件 → `hooks/hooks.json` 匹配脚本（`scripts/run.cjs` 包装）→ stdin JSON → `src/hooks/bridge.ts` 分发到对应处理器 → 处理函数读写 `.omc/state/**` → 输出 HookOutput JSON → 注入 `<system-reminder>`。

**OpenCode 适配**：Claude Code hooks（settings.json/hooks.json + JSON stdin/stdout 协议）需映射到 OpenCode 插件事件 API：UserPromptSubmit→chat.message、PreToolUse/PostToolUse→tool.execute、Stop→turn 结束、SessionStart/End→session 生命周期；`bridge.ts` 的每个 `processXxxHook(input): HookOutput` 函数可作为语义映射基准（Agent D 结论：`processKeywordDetector:1444`、`processPreToolUse:2329`、session-start ~1962 一一对应 OpenCode 事件）。

---

### 3.15 HUD 状态栏

**能力说明**：状态栏实时显示编排指标：`[OMC] autopilot:execution | agents:3 | todos:2/5 | ctx:45%`（`docs/GETTING-STARTED.md:204-214`）。

**用法**：`/oh-my-claudecode:hud setup`（安装/修复，`skills/hud/SKILL.md:16-25`）；预设 `hud minimal|focused|full|status`（`:107-128`）；实时渲染 `omc hud`（`src/cli/index.ts:1427-1440`）；配置 `omcHud` 键于 `settings.json`（`skills/hud/SKILL.md:160-211`）。

**源码实现原理**：
- 入口：`src/hud/index.ts` `main():256-594`（读 stdin JSON → 解析 transcript → 读模式状态 → usage → 渲染 → stdout 状态栏）。
- 配置：`src/hud/state.ts` `readHudConfig():345`（读 `omcHud` 键 `:352-378`）、`writeHudConfig():458`、`applyPreset():504`；HUD 状态 `.omc/state/hud-state.json`。
- 模式状态读取：`src/hud/omc-state.ts` `resolveStatePath:49-113`（会话 → `.omc/state/` → 遗留）、`readRalphStateForHud:131`、`readUltraworkStateForHud:176`、`readPrdStateForHud:222`、`readAutopilotStateForHud:334`、`isAnyModeActive:381`；陈旧阈值 2h（`MAX_STATE_AGE_MS:25`）。
- 渲染：`src/hud/render.ts` `render():232`、`truncateLineToMaxWidth:90`；28 个元素模块 `src/hud/elements/`（git/context/todos/skills/agents/autopilot/ralph/session/token-usage/call-counts 等）。
- 安装：`skills/hud/SKILL.md:29-106`（复制 `scripts/lib/hud-wrapper-template.txt` 到 `~/.claude/hud/omc-hud.mjs` + settings.json `statusLine` 对象，Windows 绝对路径处理 `:78-96`）；`src/installer/index.ts:816-862` 写入 statusLine。
- 观看循环：`src/cli/hud-watch.ts` `runHudWatchLoop():17-51`。
- **HUD 预设 `opencode`**：`src/hud/types.ts:451`（HudPreset 联合类型含 `'opencode'`）、`:905`（`PRESET_CONFIGS.opencode`）——这是仓库中唯一真实的 "opencode" 配置项（渲染预设，非插件互操作）。

**实现链路**：Claude Code 状态栏调用 `omc-hud.mjs`（statusLine.command）→ stdin 传入 {model, context_window, rate_limit...}（`src/hud/stdin.ts`）→ `main()` 读 `.omc/state/**` 模式状态 → `render()` 组合 28 元素 → 一行状态输出。`omc hud --watch` 为终端轮询版。

**OpenCode 适配**：Claude Code 的 `statusLine.command` JSON-on-stdin 契约（`src/hud/stdin.ts:4`）在 OpenCode 无对应；回退方案：tmux 窗格跑 `omc hud --watch`（宿主无关），或经 OpenCode 通知/日志输出。

---

### 3.16 记忆系统（notepad / project-memory / wiki / 共享内存 / 会话搜索）

**能力说明**：五层记忆：notepad（抗压缩便签，7 天自动清理）、project-memory（跨会话项目知识 JSON）、wiki（LLM 知识库，跨会话累积）、shared-memory（跨 agent 交接的带命名空间 + TTL KV）、session-search（历史会话检索）。统一路径根 `OmcPaths`（`src/lib/worktree-paths.ts:33-49`，含 `NOTEPAD`/`PROJECT_MEMORY`/`SHARED_MEMORY` 等 15 个路径）。

**用法**（MCP 工具）：notepad：`notepad_read`/`notepad_write_priority`/`notepad_write_working`/`notepad_write_manual`/`notepad_prune`/`notepad_stats`（`src/tools/notepad-tools.ts:34-364`）；project-memory：`project_memory_read`/`write`/`add_note`/`add_directive`（`src/tools/memory-tools.ts:28-214`）；wiki：`wiki_ingest`/`wiki_query`/`wiki_lint`/`wiki_add`/`wiki_list`/`wiki_read`/`wiki_delete`（`src/tools/wiki-tools.ts:35-120`）；共享：`shared_memory_write`/`read`/`list`/`delete`/`cleanup`（`src/tools/shared-memory-tools.ts:53-255`）；`<remember>`（7 天）/`<remember priority>`（永久）标签（`docs/ARCHITECTURE.md:579-592`）。

**源码实现原理**：
- **notepad**：`src/hooks/notepad/index.ts` —— 存储 `{omcRoot}/notepad.md`（`getNotepadPath:119-121`），三区：`## Priority Context`（常载，≤500 字符）、`## Working Memory`（7 天清理）、`## MANUAL`（永不清）；`pruneOldEntries():391-452` 实现 7 天截止；原子写 + 文件锁（`src/lib/file-lock.ts`）；上下文注入 `formatNotepadContext():513-537`（`<notepad-priority>` 标签）。`src/features/notepad-wisdom/index.ts`（`initPlanNotepad:53`、`addLearning:162` 等）支撑 `.omc/notepads/{plan}/wisdom.md` 每计划知识捕获。
- **project-memory**：`src/hooks/project-memory/index.ts` `registerProjectMemoryContext():52-117`（会话缓存、rescan、`contextCollector.register` 优先级 high）；存储 `storage.ts` `getMemoryPath:17`（`.omc/project-memory.json`）、`loadProjectMemory:39`、`saveProjectMemory:62`、`withProjectMemoryLock:89`、`shouldRescan:100`；合并 `src/lib/project-memory-merge.ts`。钩子接线：project-memory-session.mjs（SessionStart）、project-memory-posttool.mjs（PostToolUse）、project-memory-precompact.mjs（PreCompact）。
- **wiki**：`src/hooks/wiki/storage.ts` `getWikiDir:43`（`.omc/wiki`）、`readPage:216`、`writePage:371`、`appendLog:390`、`titleToSlug:401`、`withWikiLock:87`；ingest/query/lint 在 `ingest.ts`/`query.ts`/`lint.ts`；会话钩子 `session-hooks.ts`（`onSessionStart:200` 注入 wiki 索引、`onSessionEnd:245` 捕获会话为 wiki 页、`onPreCompact:252`）。
- **shared-memory**：`src/lib/shared-memory.ts` —— 存储 `.omc/state/shared-memory/{namespace}/{key}.json`（`SHARED_MEMORY_DIR:80`）；`writeEntry:148-204`（原子 tmp+rename + 文件锁，TTL→`expiresAt:180-183`）、`readEntry:212-236`（读时自动删过期 `:227-230`）、`cleanupExpired:307-368`；开关 `isSharedMemoryEnabled:63-74`（读 `~/.claude/.omc-config.json` 的 `agents.sharedMemory.enabled`）。被 /team 与 /pipeline 用于跨 agent 交接（文件头注释 `:1-19`）。
- **会话搜索**：`src/features/session-history-search/index.ts` `searchSessionHistory():497`（当前项目 + 兄弟项目 transcripts + JSON 制品；`buildCurrentProjectTargets:142`、`buildAllProjectTargets:184`、`createExcerpt:378`）；CLI `src/cli/commands/session-search.ts` `sessionSearchCommand():56`；数据源 `.omc/sessions/*.json` + transcript `.jsonl` + replay `.omc/state/agent-replay-*.jsonl`。

**实现链路**：PreCompact 钩子把关键信息写 notepad/project-memory → 压缩后 SessionStart 重新注入（`<notepad-priority>`、project-memory 上下文、wiki 索引）→ agent 恢复上下文；跨 agent 交接经 shared-memory（namespace/TTL）或 wiki 页；事后检索经 `omc session search`。

**OpenCode 适配**：全部为文件系统 + MCP 工具，与宿主无关；唯一依赖宿主的是 SessionStart/PreCompact/PostToolUse 钩子时机——需映射到 OpenCode 会话事件。

---

### 3.17 通知（configure-notifications：Discord/Telegram/Slack/webhook）与 OpenClaw

**能力说明**：Stop 回调在会话结束（Stop/SessionEnd）发送会话摘要到 Discord/Telegram/Slack/webhook/文件；支持 @提及标签；另可前向事件到 OpenClaw 网关实现自动化响应（`README.md:481-570`）。

**用法**：
- 交互式配置：`/oh-my-claudecode:configure-notifications`（`skills/configure-notifications/SKILL.md`，写 `~/.claude/.omc-config.json`）。
- CLI：`omc config-stop-callback telegram --enable --token <t> --chat <c> --tag-list "@alice,bob"`；discord `--webhook <url> --tag-list "@here,role:987..."`；slack `--webhook <url> --tag-list "<!here>,<@U123>"`；增量 `--add-tag/--remove-tag/--clear-tags`（`README.md:485-495`）。
- 标签语义：Telegram `alice`→`@alice`；Discord 支持 `@here`/`@everyone`/数字 ID/`role:<id>`；Slack 支持 `<@MEMBER_ID>`/`<!channel>`/`<!here>`/`<!everyone>`/`<!subteam^GROUP_ID>`（`README.md:498-502`）。
- OpenClaw 快速配置：`/configure-notifications` → 输入 "openclaw"（`README.md:511-513`）。

**源码实现原理**：
- **Provider 分发**：`src/notifications/dispatcher.ts` —— `sendDiscord:308`（+ bot `:363`）、`sendTelegram:429`（原生 https，IPv4+代理 `:92-208`）、`sendSlack:531`（+ bot `:587`）、`sendWebhook:648`、`sendCustomWebhook:900`/`sendCustomCli:957`；fan-out `dispatchNotifications:749`（并行 + 15s 上限）。
- **Stop 回调**：`src/hooks/session-end/callbacks.ts` —— `triggerStopCallbacks:149`、`runLegacyCallbacks:136`、`formatSessionSummary:22`、`prefixMessageWithTags:89`、`normalizeTelegramTagList:85`/`normalizeDiscordTagList:76`；`runSessionEndDeferredAction:184`（legacy-callback:192 / notification:200 / openclaw-wake:208）。CLI 配置 `src/cli/index.ts:252-566`（tag 操作 `:458-492`，档案 `--profile:295-425`）、`config-notify-profile:571`、`OMC_NOTIFY_PROFILE` env `:608`。
- **OpenClaw**：`src/openclaw/` —— 配置 `~/.claude/omc_config.openclaw.json`（`config.ts:14-15`）、`getOpenClawConfig:29`（需 `OMC_OPENCLAW=1`）、事件→网关映射 `resolveGateway:64`；入口 `index.ts:75` `wakeOpenClaw`（`buildOpenClawSignal:signal.ts:175`，routeKey 契约见 `docs/OPENCLAW-ROUTING.md:77-91`）；HTTP `wakeGateway:90` / shell `wakeCommandGateway:143`；突发去重 `dedupe.ts shouldCollapseOpenClawBurst`。
- **bridge 的 6 个事件唤醒点**：`src/hooks/bridge.ts` `_openclaw` 包装 `:2310-2323`，唤醒点 keyword-detector `:1617-1624`、stop `:1858`、session-start `:1962`、ask-user-question `:2517`、pre-tool-use `:2735`、post-tool-use `:2969`；session-end 走 manifest 动作（`callbacks.ts:208-214`）。
- 参考网关：`scripts/openclaw-gateway-demo.mjs`；env：`OMC_OPENCLAW`/`OMC_OPENCLAW_DEBUG`/`OMC_OPENCLAW_CONFIG`/`OPENCLAW_REPLY_CHANNEL/TARGET/THREAD`（`README.md:543-568`）。

**实现链路**：会话 Stop/SessionEnd → session-end 钩子 → `triggerStopCallbacks` → `dispatchNotifications`（并行发各平台）+ `openclaw-wake` 动作 → `wakeOpenClaw` → `resolveGateway` 选网关 → HTTP/shell 唤醒。事件钩子（keyword-detector 等）经 bridge `_openclaw` 包装发送带 routeKey 的信号。

**OpenCode 适配**：`wakeOpenClaw` 与 `dispatchNotifications` 是与 Claude Code 解耦的纯函数，可直接复用，只需从 OpenCode 事件 API 喂入事件（Agent D 结论：直接适配，无需重写）。

---

### 3.18 团队运行时（任务包 / 泳道 / worktree / 交接）

**能力说明**：支撑 `omc team` 的文件系统协作协议：任务包（task packet）JSON 文件、泳道（lane）推断、git worktree 隔离、inbox/outbox 交接（见 3.2 数据流）。控制面（`.omc/state/**`）与数据面（`.omc/plans/`、`.omc/notepads/`、`.omc/state/interop/artifacts/**`）分离（`docs/ARCHITECTURE.md:461-476`）。

**源码实现原理**：
- **任务包/状态**：`src/team/state-paths.ts:32-216` `TeamPaths`（`tasks/task-{id}.json` `:46`、`workers/{w}/heartbeat.json`/`inbox.md`/`outbox.jsonl` `:48-49`、`mailbox/`、`dispatch/requests.json`、`checkpoints/`、`recovery/`）；任务生命周期 `pending|blocked|in_progress|completed|failed`；OMX 变体 `src/interop/omx-team-state.ts:47-61`。
- **泳道**：`src/team/role-router.ts:151` `inferLaneIntent`（从任务文本推断泳道意图）；`src/team/task-router.ts:63-76` 作为任务分配适配度加成。
- **交接**：inbox/outbox 文件 + `leader-inbox.ts`/`inbox-outbox.ts`/`delegation-evidence.ts`；`.omc/handoffs/` 交接制品；mission-board 交接事件 `src/hud/mission-board.ts:482-487`。
- **worktree**：`src/team/git-worktree.ts` —— `ensureWorkerWorktree:454`/`createWorkerWorktree:521`/`removeWorkerWorktree:606`/`cleanupTeamWorktrees:689`；脏工作树保护 `isWorktreeDirty:174`/`assertCleanLeaderWorktree:110`（拒绝脏 lead）；根 AGENTS 备份 `installWorktreeRootAgents:252`/`restoreWorktreeRootAgents:297`；元数据账本 `readMetadata:359`/`recordMetadata:397`。契约文档 `docs/TEAM-WORKTREE-MODE.md`（布局 `<repo>/.omc/team/{team}/worktrees/{worker}` `:17`、协调根 `.omc/state/team/{team}` `:18`、`OMC_TEAM_STATE_ROOT` `:20`、脏工作树保留策略 `:45`）；opt-in `normalizeTeamWorktreeMode:441` / `OMC_TEAM_WORKTREE_MODE`。
- **worker 引导**：`src/team/worker-bootstrap.ts`（worker overlay/inbox 生成 `:157,301`）；detached job runner `bridge/runtime-cli.cjs`（由 `src/cli/team.ts:406-414` `startTeamJob` 启动）。
- **交接制品规范**：`docs/ARCHITECTURE.md:478-497`（descriptor 形状：kind/path/contentHash/createdAt/producer/sizeBytes/retention/expiresAt；有界交接规则：小载荷内联、大载荷用 descriptor）。

**实现链路**：`omc team` 启动 → 任务分解 → worker 窗格 → 认领任务（`omc team api claim-task`）→ 心跳 → 完成写 task JSON + outbox → lead 汇总 → 交接下一阶段/清理 worktree。

**OpenCode 适配**：整层基于 tmux + git，宿主无关；worker 若为 OpenCode 会话，仅需调整 `buildWorkerStartCommand`（`tmux-session.ts:771`）与 worker-bootstrap 消费的输入字段。

---

### 3.19 CLI（omc 二进制）

**能力说明**：终端命令面。30+ 子命令覆盖安装、团队、顾问、监控、会话检索、通知配置等（`README.md:135-149`）。

**用法**：`omc setup`、`omc team ...`、`omc ask codex "..."`、`omc hud`、`omc wait --start`、`omc session search`、`omc config-stop-callback ...`、`omc ultragoal create-goals` 等（见 README 各节）。

**源码实现原理**：
- 入口链：`bin/oh-my-claudecode.js`（2 行 shim：`import '../bridge/cli.cjs'`）→ `bridge/cli.cjs`（`src/cli/index.ts` 的 esbuild CJS 打包，见 `scripts/build-cli.mjs:6,19-26`）→ commander program（`src/cli/index.ts:98`，`program.parse()` `:1553-1555`）。`package.json:18-22` bin 别名：`oh-my-claudecode`/`omc` → shim，`omc-cli` → `bridge/cli.cjs`。
- 参数库：`commander ^12.1.0`（`package.json:89`）。
- 子命令注册表（`src/cli/index.ts`）：默认动作 `:105-117` → `launchCommand`（`launch.ts:1119`）、`launch:130`、`interop:158`、`ask:173`、`config:186`、`config-stop-callback:252-566`、`config-notify-profile:571`、`info:659`、`update:732`、`version:845`、`install:881`、`wait:997-1056`（→ `commands/wait.ts`）、`teleport:1068-1133`、`session search/friction report:1139-1193`（→ `commands/session-search.ts`、`session-friction-report.ts`）、`capabilities:1198-1225`、`doctor:1230-1281`、`setup:1291`、`hud:1427-1440`（→ `src/hud/index.ts`）、`mission-board:1442-1463`、`team:1472-1481`（→ `src/cli/team.ts:1344`）、`autoresearch:1486-1495`（hard-deprecated shim）、`ralphthon:1503-1512`、`ultragoal:1523-1533`；`buildProgram()` 测试导出 `:1544`。

**OpenCode 适配**：CLI 面与宿主无关；OpenCode 插件可直接 exec `omc` 二进制或调用 `buildProgram().parseAsync(...)`（`src/cli/index.ts:1544`），无需重写 CLI。

---

### 3.20 cancel（`cancelomc` / `stopomc`）

**能力说明**：取消任何活跃 OMC 模式（autopilot/ralph/ultrawork/ultraqa/ultragoal/swarm/ultrapilot/pipeline/team）（`skills/cancel/SKILL.md:1-7`）。

**用法**：`cancelomc` / `stopomc` 关键词；`/cancel`（别名 cancel-ralph），`[--force|--all]`。

**源码实现原理**：
- **最高优先级关键词**：`src/hooks/keyword-detector/index.ts:47` `cancel: /\b(cancelomc|stopomc)\b/i`；优先级最高 `:94-98`；存在时 `getAllKeywords` 只返回 `['cancel']`（"cancel suppresses everything" `:885`）；`applyRalplanGate` 永不 gate cancel（`:1086`）。
- 逐模式行为：`skills/cancel/SKILL.md:21-31`（autopilot preserve-for-resume；ralph 清联动 ultrawork；ultragoal 保留 `.omc/ultragoal/` 制品仅清守卫状态；team 请求 teammate 关停 + 清团队状态）。
- 延迟工具处理：`skills/cancel/SKILL.md:41-49`（必须先 ToolSearch `state_clear`/`state_read`/`state_write`/`state_list_active`/`state_get_status`）。
- 代码路径：ralph `src/hooks/ralph/loop.ts:369-382` `cancelLoop`；autopilot `src/hooks/autopilot/cancel.ts`；ultraqa `src/hooks/ultraqa/index.ts:214` `cancelUltraQA`；team `src/hooks/team-pipeline/transitions.ts:96` `requestTeamCancel`（preserve_for_resume）。
- 陈旧状态兜底：`src/hooks/persistent-mode/index.ts:100` `STALE_STATE_THRESHOLD_MS = 2h`。
- 状态工具（MCP）：`state_read`/`state_write`/`state_clear`/`state_list_active`/`state_get_status`（`src/lib/mode-state-io.ts` 支撑，见 3.14）。

---

### 3.21 verify 与 ask（验证 / 顾问）

**能力说明**：verify —— 声明完成前先验证真正有效（`skills/verify/SKILL.md:1-4`），验证顺序 tests → typecheck/build → narrow commands → manual（`:20-24`）；ask —— 运行本地 provider CLI 并保存 markdown 制品到 `.omc/artifacts/ask/`（`README.md:416-435`）。

**用法**：`/verify`（`commands/verify.md`）；`omc ask codex "review this patch"` / `/ask codex "..."`（providers: claude/codex/gemini/antigravity/grok/cursor）；env `OMC_ASK_ADVISOR_SCRIPT`/`OMC_ASK_ORIGINAL_TASK`（旧别名 `OMX_ASK_*` 带弃用警告，`README.md:437-442`）。

**源码实现原理**：
- verify 档位：`src/verification/tier-selector.ts` —— `TIER_AGENTS:24-40`（LIGHT=architect-low/haiku、STANDARD=architect-medium/sonnet、THOROUGH=architect/opus）、`selectVerificationTier:45`（安全/架构变更→THOROUGH、>20 文件→THOROUGH、小+全覆盖→LIGHT、否则 STANDARD）、`getVerificationAgent:72`、`detectArchitecturalChanges:79`、`detectSecurityImplications:97`；被 ralph 与 autopilot 使用。
- ralph 强制评审：`src/hooks/ralph/verifier.ts`（见 3.4）。
- ask：`src/cli/ask.ts` `askCommand`；制品 `.omc/artifacts/ask/`。
- 验证标准检查：BUILD/TEST/LINT/FUNCTIONALITY/ARCHITECT/TODO/ERROR_FREE，证据须 5 分钟内新鲜（`docs/ARCHITECTURE.md:600-609`）。

---

### 3.22 会话内快捷键与魔法关键词总表

| 关键词 | 效果 | 定义处 |
|---|---|---|
| `team` | 显式 `/team`（bare 关键词禁用） | `src/hooks/keyword-detector/index.ts:53,836-838` |
| `autopilot`/`build me`/`I want a`/`fullsend` | 自主执行管线 | `index.ts:49`；`docs/ARCHITECTURE.md:294` |
| `ralph`/`don't stop`/`must complete`/`until done` | 持久循环 | `index.ts:48` |
| `ultrawork`/`ulw`/`uw` | 最大并行 | `src/features/magic-keywords.ts:68-76`；`index.ts:50` |
| `ccg`/`claude-codex-gemini` | 三模型顾问 | `docs/ARCHITECTURE.md:296` |
| `ralplan` | 规划共识 | `index.ts`（门禁）`;1077` |
| `deep interview`/`ouroboros` | 深度访谈 | `docs/ARCHITECTURE.md:298` |
| `deepsearch` | 代码库搜索 | `docs/ARCHITECTURE.md:301` |
| `deepanalyze`/`deep-analyze` | 深度分析 | `docs/ARCHITECTURE.md:302` |
| `ultrathink`/`think hard` | 深度推理（think-mode 钩子） | `src/hooks/think-mode/index.ts` |
| `tdd`/`test first`/`red green` | TDD 工作流 | `docs/ARCHITECTURE.md:304` |
| `deslop`/`anti-slop` | AI 表达清理（ai-slop-cleaner） | `docs/ARCHITECTURE.md:305` |
| `cancelomc`/`stopomc` | 取消模式 | `index.ts:47` |
| 自定义 4 类 | ultrawork/search/analyze/ultrathink（config `magicKeywords`） | `docs/GETTING-STARTED.md:362-384` |

---

## 4. 源码引用索引

> 以下为正文引用的全部源码文件（相对仓库根）。行号均经各专项勘察 agent 以 grep/read 核实，关键条目已人工抽查。

**编排模式**
- `src/hooks/keyword-detector/index.ts`（`:46-67` 关键词表、`:47` cancel、`:48` ralph、`:49` autopilot、`:50` ultrawork、`:53` team 禁用、`:94-98` 优先级、`:806-865` detectKeywordsWithType、`:877-894` getAllKeywords、`:926-965` getAllKeywordsWithSizeCheck、`:991-1113` ralplan 门禁、`:127-136` SLASH_SKILL_TO_KEYWORD_TYPE、`:167` parseExplicitWorkflowSlashInvocation）
- `src/hooks/team-pipeline/types.ts:9-17,51-72`；`state.ts:17-22,74,118,148,186`；`transitions.ts:5-14,25,50,96`
- `skills/team/SKILL.md:1-7,95-99,101-190`
- `src/cli/index.ts:1472-1481`（team）、`:1427-1440`（hud）、`:1486-1495`（autoresearch shim）、`:1503-1512`（ralphthon）、`:1523-1533`（ultragoal）、`:1544`（buildProgram）
- `src/cli/commands/team.ts:29,80-113,399,535,721,832,893,914,996`；`src/cli/team.ts:385-414,488,1344`
- `src/team/runtime-v2.ts:3007,3808,4034,4529,4559`；`runtime.ts`（startTeam:372/monitorTeam:462/shutdownTeam:935/resumeTeam:1018）
- `src/team/tmux-comm.ts:106,128,150,185,221`；`tmux-session.ts:771,1136,1144,1312,1679,1856,2043,2072,2133`
- `src/team/state-paths.ts:32-216`
- `src/hooks/autopilot/pipeline.ts:87,255,343,386,408,434,509,533`；`adapters/index.ts:24-28`；`state.ts`；`cancel.ts`；`enforcement.ts`
- `skills/autopilot/SKILL.md:1-6,84,94,261`
- `src/hooks/ralph/loop.ts:89,142,164,180,207,282,369,410,441,528-556,561`；`verifier.ts:98-103,160,188,224,226,323,362`；`prd.ts`；`progress.ts`；`index.ts:22-102`
- `src/hooks/persistent-mode/index.ts:1-11,100,1099-1418,2217,2456,2556`
- `src/features/boulder-state/constants.ts`
- `src/hooks/ultrawork/index.ts:81,107,123,151,197,220,243,275`；`src/hooks/keyword-detector/ultrawork/index.js`
- `src/features/magic-keywords.ts:68-76`
- `src/ultragoal/artifacts.ts:11-33,38,62,82`；`src/cli/commands/ultragoal.ts:9-20,23-64`
- `src/goal-workflows/claude-goal-snapshot.js`
- `src/hooks/ultraqa/index.ts:11,52,59,89,122,150-157,168,188,214,235,253`
- `skills/ralplan/SKILL.md:1-6,20-23,44-65,71-142`；`skills/plan/SKILL.md:1-9,53-58,85-132,153,291`
- `skills/deep-interview/SKILL.md:1-9,55-64,72-92,94-157,159-220,222-370,271-319,372-388,390-489,491-546,720`
- `src/hooks/bridge.ts:190,664,678,718,1109-1149,1444,1543,1558,1617-1624,1727,1858,1962,2229,2276,2310-2323,2329,2517,2735,2969,3071`
- `src/lib/mode-state-io.ts:146,958,1102`；`src/lib/mode-names.ts:64,65`

**智能体**
- `agents/*.md`（19 个）；`src/agents/definitions.ts:202,213-252,264,290-405`；`utils.ts:30,76,88,91-116,169,300,338`；`types.ts:43,65,79,151`；`prompt-sections/index.ts:27-58`；`index.ts`
- `src/features/model-routing/router.ts:25,83-87,248-266,281,303`；`types.ts:29,205,224,237`
- `src/config/models.ts:10-26,137,161,165,169,359,408`
- `docs/agents/model-compatibility.md:12-21,27-42,50-97`；`research/hephaestus-vs-deep-executor-comparison.md`
- `src/verification/tier-selector.ts:24-40,45,72,79,97,119`

**技能**
- `skills/skill/SKILL.md`；`skills/skillify/SKILL.md:16-22,24-55`；`skills/learner/SKILL.md`
- `src/hooks/learner/constants.ts:11-41`；`finder.ts:64-171`；`loader.ts:26-133`；`writer.ts:49-162`；`parser.ts:19,78,148,162,210`；`validator.ts`；`auto-learner.ts`；`index.ts:29-51,89-121,126-178,190-223`；`detection-hook.ts:58-90`；`auto-invoke.ts`
- `scripts/skill-injector.mjs:48-63,102-120,135-148,394-499,534-564,567-621,634-636`
- `src/utils/frontmatter.ts:11-79`；`src/features/builtin-skills/skills.ts:16,161-182,223-289,294-384`
- `src/tools/skills-tools.ts:104-172`；`src/hooks/skill-state/index.ts:139,155,598,619,689`
- `src/utils/skill-pipeline.ts:134`

**Hooks**
- `hooks/hooks.json`（11 事件接线）；`src/hooks/index.ts`（导出桶）；`src/hooks/bridge.ts`（见上）
- `src/installer/hooks.ts:99-109,307-389`；`src/installer/index.ts:42,44,731-797,816-862,965`
- `templates/hooks/*.mjs`；`docs/HOOKS.md`
- 各钩子实现：`permission-handler/index.ts:130,196,556,602,642`；`session-end/index.ts:235,275,511,778`；`pre-compact/index.ts:99,346,544,552`；`subagent-tracker/index.ts`；`mode-registry/index.ts`；`auto-slash-command/*`；`think-mode/index.ts`；`rules-injector/index.ts`；`todo-continuation/index.ts`；`recovery/index.ts`；`preemptive-compaction/index.ts`；`code-simplifier/index.ts`；`omc-orchestrator/index.ts`；`background-notification/index.ts`

**HUD**
- `src/hud/index.ts:90-101,133-150,225-245,256-594`；`state.ts:51-68,80-82,201,262,345-378,458-489,504`；`omc-state.ts:25,49-113,131,176,222,334,381,392`；`render.ts:90,217,232`；`stdin.ts:4`；`types.ts:451,775,905`；`elements/`（28 模块）
- `src/cli/hud-watch.ts:17-51`；`src/hud/mission-board.ts:482-487`
- `skills/hud/SKILL.md:16-25,29-106,107-128,160-211,241-249`
- `scripts/lib/hud-wrapper-template.txt`

**记忆**
- `src/lib/worktree-paths.ts:33-49,543`；`src/utils/config-dir.ts:36-53`；`src/lib/file-lock.ts`
- `src/hooks/notepad/index.ts:76-86,119-121,126,166,221-245,261,299,348,391-452,461,513-537`
- `src/tools/notepad-tools.ts:34-365`；`src/features/notepad-wisdom/index.ts:32,53,121,162-206`
- `src/hooks/project-memory/index.ts:24-42,49-50,52-119`；`storage.ts:17,39,62,89,100,109`；`src/lib/project-memory-merge.ts`
- `src/tools/memory-tools.ts:28-276`
- `src/hooks/wiki/storage.ts:32,43,48,87,216,239,249,256,263,371,379,390,401`；`ingest.ts`；`query.ts`；`lint.ts`；`session-hooks.ts:110,138,200,245,252,278`
- `src/tools/wiki-tools.ts:35-120`
- `src/lib/shared-memory.ts:53-74,80,134-137,148-236,243-388`
- `src/tools/shared-memory-tools.ts:53-297`
- `src/features/session-history-search/index.ts:46,94,126,142,184,248,361,378,392,497`
- `src/cli/commands/session-search.ts:28,56`
- `skills/remember/SKILL.md`

**通知 / OpenClaw**
- `src/notifications/dispatcher.ts:92-208,308,363,429,531,587,648,716,749,900,957,989`
- `src/notifications/config.ts:146,161,176,509,1024`
- `src/hooks/session-end/callbacks.ts:22,76,85,89,94,108,119,126,136,149,184,192,200,208-214`
- `src/openclaw/config.ts:14-15,29,64`；`index.ts:75,95-97,119-137`；`dispatcher.ts:24,60,90,143`；`signal.ts:175`；`dedupe.ts`
- `scripts/openclaw-gateway-demo.mjs`；`docs/OPENCLAW-ROUTING.md`
- `skills/configure-notifications/SKILL.md`；`src/cli/index.ts:252-566,571-653,608`

**团队运行时**
- `src/team/state-paths.ts:32-262`；`role-router.ts:151`；`task-router.ts:63-76`；`leader-inbox.ts`；`inbox-outbox.ts`；`delegation-evidence.ts`；`dispatch-queue.ts`；`team-ops.ts`；`phase-controller.ts:34`
- `src/team/git-worktree.ts:110,174,197,211-224,252,297,359,397,441,454,521,540,588,606,689`
- `docs/TEAM-WORKTREE-MODE.md:17-45`
- `src/team/worker-bootstrap.ts:157,301`；`src/cli/team.ts:246-280,385-414,448,488,552-571,593,676,796,1344,1359-1398`
- `src/interop/omx-team-state.ts:1-13,47-61`

**CLI / 打包**
- `bin/oh-my-claudecode.js:1-2`；`bridge/cli.cjs`；`scripts/build-cli.mjs:6,19-26,37-47`；`package.json:2,4,18-22,89`
- `src/cli/index.ts`（全子命令，见 3.19）；`src/cli/launch.ts:611,649,1119`；`src/cli/ask.ts`
- `.claude-plugin/plugin.json`；`.claude-plugin/marketplace.json`；`commands/*.md`（28 个）；`.mcp.json`

**文档交叉引用**
- `README.md`、`docs/GETTING-STARTED.md`、`docs/ARCHITECTURE.md`、`docs/REFERENCE.md`、`docs/HOOKS.md`、`docs/ultragoal.md`、`docs/TEAM-WORKTREE-MODE.md`、`docs/OPENCLAW-ROUTING.md`、`docs/MIGRATION.md`、`docs/agents/model-compatibility.md`、`docs/adr/03487-named-autopilot-stage-profiles.md`

---

## 5. 附注：本仓库快照与抽样核实记录

- 抽查 1：`src/hooks/keyword-detector/index.ts:48` 存在 ralph 正则 `/\b(ralph)\b(?!-)|(랄프)(?!로렌)|(ラルフ)(?!・?ローレン)/i` ✓
- 抽查 2：`src/hooks/persistent-mode/index.ts:1099` 存在 `async function checkRalphLoop(`，且在 `:2456` 被 `checkPersistentModes` 调用 ✓
- 抽查 3：`src/hud/types.ts:451,905` 存在 HudPreset 联合类型含 `'opencode'` 及 `PRESET_CONFIGS.opencode` ✓
- 抽查 4：`package.json:4` 为 "Inspired by oh-my-opencode"（确认 opencode 命中为署名，非插件）✓
- 抽查 5：`src/team/state-paths.ts:33,42-49` 存在 `root`/`tasks`/`workers` 路径构造 ✓；`.omx/` 仅含 4 篇规划文档 ✓；`bin/oh-my-claudecode.js` 为 2 行 shim ✓；`skills/team/SKILL.md` frontmatter（name: team）✓

> **注**：仓库为 `--depth 1` 浅克隆快照；行号以该快照为准，若上游演进可能偏移。未对仓库做任何修改，未执行任何安装/运行。
