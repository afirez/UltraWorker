# Oh My OpenAgent（OmO / 前身 oh-my-opencode，现 LazyCodex）机制全解

> 本文档基于 `code-yeongyu/oh-my-openagent` 仓库 `dev` 分支快照（版本 `5.0.0-beta.7`，package.json:3）编写。
> 所有源码引用均以「仓库根相对路径 + 行号/函数名」给出，路径前缀默认是 `packages/`，未加前缀的 `src/` 指 `packages/omo-opencode/src/`。
> 快照源码树已完整核对，引用均为真实存在的文件与行。

---

## 1. 概览

**Oh My OpenAgent（OmO）** 是一个面向 **OpenCode** 宿主（Ultimate 版）、**OpenAI Codex CLI**（Light 版）以及 **Senpi**（独立 beta 版）的多模型 Agent 编排层（"Multi-Harness Agent OS"）。它把单个 AI Agent 改造成一个可并行、可委派、可自证完成的开发团队。

**命名与改名史**（README.md:174-178、docs/manifesto.md:7）：

- 原名 **oh-my-opencode**（npm 包名至今仍是 `oh-my-opencode`，并双发布为 `oh-my-openagent`；package.json:2、bin 同时注册 `oh-my-opencode` / `oh-my-openagent` / `omo-agent-toolkit` / `lazycodex` / `lazycodex-ai`，package.json:40-46）。
- 仓库与项目现名 **oh-my-openagent**；`opencode.json` 中插件条目优先识别 `oh-my-openagent`，旧条目 `oh-my-opencode` 仍可加载但告警（docs/reference/features.md:256）。
- 面向 Codex 的继任产品 **LazyCodex** 在独立仓库 `code-yeongyu/lazycodex`，通过 `npx lazycodex-ai install` 安装；本仓库是 LazyCodex 的载体与上游（README.md:1-9、docs/guide/installation.md:14）。本文档主体覆盖 oh-my-openagent 仓库本身，LazyCodex 仅作为演化方向简述。

**三款发行版**（README.md:114-141、docs/guide/installation.md:3-8）：

| 版本 | 宿主 | 安装命令 | 内容 |
| --- | --- | --- | --- |
| Ultimate | OpenCode | `bunx oh-my-openagent install` | 全量：11 个 Agent、54+ 生命周期钩子、5 个内置 MCP、全部斜杠命令、Team Mode、ulw-loop、hashline 编辑 |
| Light | Codex CLI | `npx lazycodex-ai install` | 可移植组件：rules / comment-checker / git-bash / lsp / ultrawork / ulw-loop / start-work-continuation / telemetry 等 |
| Senpi（beta） | 独立 | `npm i -g omo-ai@beta` | 内置 OMO 扩展的 senpi 发行版，命令为 `omo` |

---

## 2. 机制清单表

| # | 机制 | 实现核心（源码引用） | 对应小节 |
| --- | --- | --- | --- |
| 1 | `ultrawork` / `ulw` 关键词流水线 | `src/hooks/keyword-detector/`（constants.ts:33-38、hook.ts:38） | §4.1 |
| 2 | Sisyphus 主编排 Agent | `src/agents/sisyphus/`（default.ts:138 `buildDefaultSisyphusPrompt`） | §4.2 |
| 3 | Hephaestus 深度工作 Agent | `src/agents/hephaestus/agent.ts:152` `createHephaestusAgent` | §4.3 |
| 4 | Prometheus 规划 Agent | `src/agents/prometheus/system-prompt.ts:18` | §4.4 |
| 5 | Goal / 目标续跑（ultragoal 演化） | `src/hooks/goal/`（controller.ts:24、index.ts:36） | §4.5 |
| 6 | 子代理委派 `task` / `call_omo_agent` | `src/tools/delegate-task/tools.ts:81`、`src/tools/call-omo-agent/tools.ts:110` | §4.6 |
| 7 | 背景 Agent（并行执行） | `src/features/background-agent/`（manager.ts:559 `launch`、concurrency.ts:25） | §4.7 |
| 8 | 任务包（task packet / 委派提示结构） | `src/tools/delegate-task/types.ts:54`、prompt-builder.ts:95 | §4.8 |
| 9 | Team Mode（并行多 Agent） | `src/features/team-mode/`、`packages/team-core/` | §4.9 |
| 10 | Hash-Anchored Edit（hashline） | `packages/hashline-core/src/`、`src/tools/hashline-edit/` | §4.10 |
| 11 | 项目记忆 / notepad | `packages/memory-core/src/`、`src/features/context-injector/` | §4.11 |
| 12 | 验证循环（todo 续跑、诊断门禁） | `src/hooks/todo-continuation-enforcer/`、`src/hooks/hashline-read-enhancer/` | §4.12 |
| 13 | 多模型编排（模型路由 + 回退链） | `packages/model-core/src/agent-model-requirements.ts:3`、`src/hooks/model-fallback/`、`src/hooks/runtime-fallback/` | §4.13 |
| 14 | Agent 目录（11 个内置 Agent） | `src/agents/builtin-agents.ts:32-45` | §4.14 |
| 15 | Skills 技能系统 | `src/features/builtin-skills/`、`packages/skills-loader-core/`、`packages/shared-skills/` | §4.15 |
| 16 | MCP 集成（内置 + skill 内嵌 + .mcp.json） | `src/mcp/index.ts:36`、`src/plugin-handlers/mcp-config-handler.ts:28`、`packages/mcp-client-core/src/skill-mcp-manager/manager.ts:41` | §4.16 |
| 17 | 钩子系统（hook） | `src/create-hooks.ts:36`、`src/config/schema/hooks.ts:3-62` | §4.17 |
| 18 | LSP / AST-grep / tmux 工具 | `packages/lsp-core/src/tools/definitions.ts:10`、`packages/ast-grep-mcp/src/mcp.ts:119`、`packages/tmux-core/src/runner.ts:84` | §4.18 |
| 19 | 配置系统（omo.jsonc 统一配置 + 迁移） | `packages/omo-config-core/`、`src/config-migration/`、`src/startup-migration.ts` | §4.19 |
| 20 | Claude Code 兼容层 | `packages/claude-code-compat-core/src/index.ts:1`、`src/features/claude-code-*-loader/` | §4.20 |
| 21 | 任务系统（task_create 等，跨会话文件持久化） | `src/tools/task/`、`src/features/claude-tasks/` | §4.21 |
| 22 | 会话工具 / 会话恢复 | `src/tools/session-manager/tools.ts:62` | §4.22 |
| 23 | OpenClaw 外联通知 | `src/openclaw/`、`packages/openclaw-core/` | §4.23 |
| 24 | 遥测 | `packages/telemetry-core/` | §4.24 |

---

## 3. 总架构与数据流

### 3.1 插件加载链路（Ultimate / OpenCode）

```
opencode.json 插件条目 "oh-my-openagent"
  → packages/omo-opencode/src/index.ts:3-5 createPluginModule()（测试工厂，生产同构）
  → 逐项装配：
      installAgentSortShim / initConfigContext("opencode") / logLegacyPluginStartupWarning
      migrateLegacyWorkspaceDirectory（旧配置目录迁移）
      runOpenCodeStartupMigration（锁定+日志式迁移，startup-migration.ts）
      loadConfigChain（配置链加载，validatePluginConfig）
      recordPluginTelemetry（遥测）
      createManagers（TmuxSessionManager / BackgroundManager / SkillMcpManager /
                      ConfigHandler / ModelFallbackControllerAccessor 等）
      createTools（工具注册表，12–38 个工具按配置门控）
      createHooks（钩子装配）
      createPluginInterface（向宿主暴露的插件接口）
  → 返回 Hooks 对象，OpenCode 宿主按事件回调
```

源码引用：`src/index.ts:3-5`；`src/testing/create-plugin-module.ts:159`（`createPluginModule`，其内部按序调用 `loadConfigChain`/`createManagers`/`createTools`/`createHooks`/`createPluginInterface`，见 :107-122 的依赖清单）；`src/plugin-interface.ts:20-109`（`createPluginInterface` 返回 `tool`、`chat.params`、`chat.headers`、`command.execute.before`、`chat.message`、`experimental.chat.messages.transform`、`experimental.chat.system.transform`、`config`、`event`、`tool.definition`、`tool.execute.before`、`tool.execute.after`）。

### 3.2 一次 `ultrawork` 任务的端到端数据流

```
用户输入 "ultrawork ..."
  → chat.message 钩子：keyword-detector/hook.ts:38 createKeywordDetectorHook
      detector.ts:44 detectKeywordsWithType 匹配 /\b(ultrawork|ulw)\b/i（constants.ts:36）
      hook.ts:231-240 把 ultrawork 提示注入用户文本 → "ULTRAWORK MODE ENABLED!"
  → Sisyphus Agent（默认编排者）收到注入后的指令
  → Sisyphus 按默认提示（agents/sisyphus/default.ts:138）：
      意图分类（default.ts:216-244）
      并行探索：task(subagent_type="explore|librarian", run_in_background=true)
      （default.ts:297-338）
      委派实现：task(category="deep"|"quick"|..., prompt="六段式任务包")
      （default.ts:370-389）
      会话连续性：task(task_id="ses_...")（default.ts:391-417）
  → 委派经 delegate-task/tools.ts:81 createDelegateTask
      → background-task.ts:119 manager.launch 或 sync-task.ts:15 同步轮询
  → 子 Agent 完成 → 结果 + 学习收获回传
  → todo-continuation-enforcer 钩子（create-continuation-hooks.ts:60-66）：
      若 todo 未清空则在 session.idle 时注入续跑提示，直至完成
  → lsp_diagnostics 等验证门禁 → 完成
```

---

## 4. 各机制详解

### 4.1 `ultrawork` / `ulw` 关键词流水线

**能力说明**：用户在消息中键入 `ultrawork` 或 `ulw`，系统向当前对话注入完整的超工作协议（模式提示），使 Agent 进入"全自动、直到完成"的执行模式；同时按 Agent/模型家族路由到不同的提示变体。

**用法**：

- OpenCode（Ultimate）：直接键入 `ultrawork` 或 `ulw`，无需额外命令；可配合 `default_mode.ultrawork` 让新会话自动进入该模式（hook.ts:119-141）。
- Codex CLI（Light）：`ultrawork` 组件在 `UserPromptSubmit` 钩子中识别关键字（docs/guide/installation.md:807）。
- 可配置：`agents.sisyphus.ultrawork.model` / `reasoning` 覆盖 ultrawork 模式下的模型（docs/guide/overview.md:110、configuration.md:237）。

**源码实现原理**：

- 关键字定义：`src/hooks/keyword-detector/constants.ts:33-38` — `KEYWORD_DETECTORS` 数组中 `type: "ultrawork"`、`pattern: /\b(ultrawork|ulw)\b/i`、`message: getUltraworkMessage`；另有 `hyperplan-ultrawork` 组合模式（constants.ts:14-25）。
- 检测核心：`src/hooks/keyword-detector/detector.ts:44-71` `detectKeywordsWithType()` — 先移除代码块（:51 `removeCodeBlocks`），再过滤禁用/允许列表（:52-58）。
- 注入钩子：`src/hooks/keyword-detector/hook.ts:38` `createKeywordDetectorHook()` 返回 `"chat.message"` 转换器（:56）；跳过合成/系统/斜杠消息（:69-84）、非 OMO Agent（:88）、规划型 Agent（:98-106）、背景任务会话（:108-114）；去重后把模式提示追加到用户文本（:231-240）；并弹出 "Ultrawork Mode Activated" 通知（:173-189）。
- 消息路由：`src/hooks/keyword-detector/ultrawork/index.ts:43-62` `getUltraworkMessage(agentName, modelID)` 依 `getUltraworkSource`（source-detector.ts:45-71）选择 planner / gpt / gemini / glm / default 变体；`ultrawork/planner.ts:5-15` `getPlannerUltraworkMessage` 把 `ULTRAWORK_PLANNER_PROMPT` 包进 `<ultrawork-mode>` 信封。
- 提示内容：`packages/prompts-core/prompts/ultrawork/default.md`（默认变体，要求先声明 "ULTRAWORK MODE ENABLED!"、确定性协议、探索-委派-实现流程）；GPT/Gemini/GLM/planner/codex 变体在 `prompts/ultrawork/{gpt,gemini,glm,planner,codex}.md`；导出于 `packages/prompts-core/src/ultrawork-prompts.ts:9-14`（`ULTRAWORK_DEFAULT_PROMPT` 等）。
- 默认模式注入：`src/plugin/system-transform.ts:6-32` `createSystemTransformHandler` — 当 `default_mode.ultrawork` 为真（config/schema/default-mode.ts:9）且系统提示无 `<ultrawork-mode>` 标记时，把 ultrawork 消息压入 `output.system`（:24-30），同时调用 `reconcileSisyphusRuntimePrompt`（:18，实现于 agents/sisyphus-runtime-prompt-reconciler.ts:42-71）。
- 模型覆盖：`src/plugin/ultrawork-model-override.ts:60-95` `resolveUltraworkOverride`（读取 `agents.*.ultrawork.model/variant`）、:148-196 `applyUltraworkModelOverrideOnMessage`（校验变体后替换 `output.message.model`）；若模型已在运行，`src/plugin/ultrawork-db-model-override.ts:159-194` `scheduleDeferredModelOverride` 直接对 `opencode.db` 执行 `json_set` 补写（:74-101）；变体可用性校验 `src/plugin/ultrawork-variant-availability.ts:27-51` `resolveValidUltraworkVariant`（经 `provider.list()`）。注册于 `src/plugin/chat-message.ts:142-149`。
- 其他模式关键词：同一定义表还含 `search`、`analyze`、`team`、`hyperplan`、`hyperplan-ultrawork` 组合（constants.ts:33-54；features.md:871）。

**实现链路**：用户消息 → `chat.message`（runChatMessageHooks 中 keywordDetector 先行，chat-message.ts:65）→ keyword-detector（detect → 路由变体 → 注入到首个用户文本，hook.ts:240）→ `applyUltraworkModelOverrideOnMessage` 换模型/变体（或在途消息走 opencode.db 补写）→ Sisyphus 收到 ultrawork 协议 → 委派与验证（见 §3.2）；`default_mode.ultrawork` 路径改走 system-transform 注入。

### 4.2 Sisyphus：主编排 Agent

**能力说明**：Sisyphus 是默认主 Agent（"Discipline Agent"），负责意图分类、并行探索、按类别委派子代理、驱动任务直至完成。它是**提示驱动**的编排者（本身不是代码级循环）。

**用法**：OpenCode 中选择 Sisyphus（默认）；模型建议 `claude-opus-5` / `kimi-k3` / `glm-5.2`（docs/guide/overview.md:83-90）；可在 `[opencode]` 块 `agents.sisyphus` 覆盖模型/温度/提示（configuration.md:116-121）。

**源码实现原理**：

- 模型变体提示族：`src/agents/sisyphus/index.ts:18-36` 导出 `buildDefaultSisyphusPrompt`、`buildClaudeOpus5SisyphusPrompt`、`buildGpt55SisyphusPrompt`、`buildKimiK3SisyphusPrompt` 等，按模型自动选择（AGENTS.md:35-46 的变体选择规则）。
- 核心提示：`src/agents/sisyphus/default.ts:138` `buildDefaultSisyphusPrompt()` — 内含意图门（:189-214）、分类与"默认倾向委派"（:216-244）、并行背景探索（:297-338）、六段式委派提示结构（:370-389：TASK / EXPECTED OUTCOME / REQUIRED TOOLS / MUST DO / MUST NOT DO / CONTEXT）、会话连续性（:391-417）、验证/证据（:427-443）、失败恢复（:445-463）。
- Agent 装配：`src/agents/builtin-agents.ts:122-140` + `src/agents/builtin-agents/sisyphus-agent.ts:14` `maybeCreateSisyphusConfig`。
- 模型链：`packages/model-core/src/agent-model-requirements.ts:4-31` — claude-opus-5/max → kimi-k3 → gpt-5.6-sol/medium → glm-5.2 → big-pickle。
- 防滥用钩子：`src/hooks/no-sisyphus-gpt/`（阻止不兼容 GPT 模型跑 Sisyphus）。

**实现链路**：见 §3.2；Sisyphus 的"不停止"由 §4.12 验证循环（todo-continuation-enforcer / goal）机制保证。

### 4.3 Hephaestus：自主深度工作者

**能力说明**：Hephaestus（"The Legitimate Craftsman"）是 GPT-native 的自主深度工作者——只给目标、不给步骤；自己探索代码库、研究模式、端到端执行。适合深层架构推理、跨文件复杂调试。

**用法**：OpenCode Tab 切换至 Hephaestus；模型为 `gpt-5.6-sol`（medium effort，openai / github-copilot / vercel / opencode）。`no-hephaestus-non-gpt` 钩子阻止非 GPT 模型运行（docs/reference/features.md:946）。

**源码实现原理**：

- 工厂：`src/agents/hephaestus/agent.ts:152` `createHephaestusAgent(model)` — `mode: "primary"`（:187）、`maxTokens: 32000`（:176）、权限 `{ question: allow, call_omo_agent: deny }`（:179-183）、`reasoningEffort: "medium"`（:184）。
- 模型支持检查：`src/agents/hephaestus/agent.ts:44` `isHephaestusSupportedModel`（仅 gpt-5.3-codex / 5.4 / 5.5 / 5.6）；`getHephaestusPromptSource`（:61-75）选择提示变体。
- 提示：`src/agents/hephaestus/gpt-5-6.ts:28` HEPHAESTUS_GPT_5_6_TEMPLATE — "You receive goals, not step-by-step instructions"；自主性条款（:32-44）；用 2-5 个并行背景 explore/librarian 做发现（:54）。
- 注册：`src/agents/builtin-agents/hephaestus-agent.ts:13`；模型链 `packages/model-core/src/agent-model-requirements.ts:32-42`。

**实现链路**：用户选 Hephaestus → `createHephaestusAgent` 生成 Agent → 模型解析（gpt-5.6-sol medium）→ 自主探索（背景 explore/librarian）→ 直接写码 → lsp_diagnostics 验证。

### 4.4 Prometheus：战略规划 Agent

**能力说明**：Prometheus 以"面试模式"工作——先提问澄清需求、识别范围与歧义，再产出 `.omo/plans/*.md` 计划文件，供 `/start-work` 交给 Atlas 执行。只读 Agent，仅能写 `.omo/` 下的 markdown（prometheus-md-only 钩子强制）。

**用法**：OpenCode Tab 选 Prometheus，或 `@plan "任务描述"` 快捷切换（docs/guide/orchestration.md:409-440）。执行：`/start-work`。

**源码实现原理**：

- 系统提示：`src/agents/prometheus/system-prompt.ts:18` `PROMETHEUS_SYSTEM_PROMPT`（自 `packages/prompts-core/prompts/prometheus/default.md`）；权限 edit/bash/webfetch/question 全 allow（:3-8）。
- 模型链：`packages/model-core/src/agent-model-requirements.ts:102-111` — claude-fable-5/xhigh → kimi-k3/max。
- 计划族限制：`src/tools/delegate-task/constants.ts:378` `PLAN_FAMILY_NAMES = ["plan","prometheus"]`；`COORDINATOR_AGENT_NAMES`（:404）禁止 Prometheus 作为 `task()` 子代理目标（:410 `isCoordinatorAgent`）。
- 计划输出契约：constants.ts:21-288 定义依赖图 + 并行波次 + 类别/技能推荐 + `<plan>...</plan>` 信封；`PLAN_DELIVERABLE_TAG = "plan"`（:363）。
- 仅 markdown：`src/hooks/prometheus-md-only/` 钩子在 PreToolUse 拦截非 md 写操作。

**实现链路**：`@plan` / Tab 切换 → Prometheus 提示加载 → 面试循环（提问-澄清-再问）→ 生成 `.omo/plans/{name}.md` → 用户 `/start-work` → 见 §4.2/§4.5（Atlas / boulder 状态）。

### 4.5 Goal 目标续跑（"$ultragoal" 的现代表现）

**能力说明**：**本仓库快照中不存在字面意义的 `$ultragoal`**（对 `ultragoal` / `ultra[-_ ]?goal` 的全库不区分大小写检索均为 0 命中）。其功能由 **Goal 机制**承接：持久化的会话级目标，每次 `session.idle` 自动注入续跑提示，直到完成审计通过。README.md:236 称之为 "Goal / `/goal`"；README.md:509 说明 Ultragoal 与 UltraQA 概念来自 oh-my-codex，OmO 重新实现为 Goal。旧的 `ralph_loop` 配置在加载时自动迁移到 `goal`（docs/reference/features.md:386）。

**用法**：`/goal "目标"`、`/goal`（查看）、`/goal pause|resume|clear`；配置 `goal.enabled: true`（默认关闭）后可注册 `create_goal` / `update_goal` / `get_goal` 工具（docs/reference/features.md:364-384）。

**源码实现原理**：

- 控制器：`src/hooks/goal/controller.ts:24` `createGoalController` — 状态目录 `.omo/goal/{sessionID}.json`（:26）；setGoal / pauseGoal / resumeGoal / clearGoal / markComplete / accountUsage（:51-100）。
- 续跑注入：`src/hooks/goal/index.ts:36` `createGoalHook()` — `session.idle` 且有 active 目标时构造续跑提示并派发（:40-73）；TUI 镜像写 `.omo/ulw-loop/{sessionID}/goals.json`（controller.ts:29-48）。
- 完成审计：`src/hooks/goal/prompt.ts:19-30` — 续跑提示要求先做"提示→产物"逐项核对审计，通过后才允许 `update_goal status:"complete"`。
- 工具：`src/hooks/goal/tools.ts:14-89`；注册于 `src/plugin/tool-registry-core-tools.ts:142`。
- 存储：`src/hooks/goal/store.ts:8-10`（goalFilePath）、:32-39（原子写）、:54-97（create/update）。

**实现链路**：`/goal "x"` → controller.setGoal 写 `.omo/goal/*.json` + TUI 镜像 → `session.idle` → createGoalHook 注入续跑提示 → Agent 继续执行 → 完成审计 → update_goal(complete) → 停止注入。`/stop-continuation` 可中止（stop-continuation-guard 钩子）。

### 4.6 子代理委派：`task` / `call_omo_agent`

**能力说明**：Sisyphus 通过两个委派工具调度子代理：`task`（类别委派，走 Sisyphus-Junior，或 `subagent_type` 直选 Agent）与 `call_omo_agent`（仅 explore/librarian）。支持同步/后台两种模式与 `run_in_background`、`load_skills`、`task_id`（会话续跑）。

**用法**（docs/reference/features.md:673-680、orchestration.md:112-117）：

```typescript
task({ category: "visual-engineering", load_skills: ["frontend"], prompt: "..." })   // 类别委派
task({ subagent_type: "oracle", prompt: "..." })                                      // 直选 Agent
call_omo_agent({ subagent_type: "explore", prompt: "...", run_in_background: true })  // 后台探索
background_output({ task_id: "bg_..." })                                              // 取回结果
```

**源码实现原理**：

- `task` 工具：`src/tools/delegate-task/tools.ts:81` `createDelegateTask()` — 参数 schema（:61-79）；执行（:87）：`resolveSkillContent`（:93）、`buildSystemContent`（:113）、`resolveParentContext`（:121）、`task_id` 续跑（:123-128）、类别路径 `resolveCategoryExecution`（:157，category-resolver.ts:65）或子代理路径 `resolveSubagentExecution`（:197，subagent-resolver.ts:11）、`executeBackgroundTask`（:219）或 `executeSyncTask`（:222）。
- 后台执行：`src/tools/delegate-task/background-task.ts:119` → `manager.launch`（见 §4.7）。
- 同步执行：`src/tools/delegate-task/sync-task.ts:15` → `src/tools/delegate-task/sync-task-runner.ts:67` `runSyncTaskLoop`（轮询循环，`retrySyncPromptWithFallbacks` :117 支持模型回退重试）。
- `call_omo_agent`：`src/tools/call-omo-agent/tools.ts:110` `createCallOmoAgent()` — 仅允许 explore/librarian；执行（:150）：`resolveModelAndFallbackChain`（:37-108）、后台/同步分发（:186-197）。
- 共享核心：`packages/delegate-core/`（"Harness-neutral delegate task selection and retry primitives"，package.json:6）— src/index.ts 重导出 model-selection.ts / retry-guidance.ts / retry-patterns.ts。

**实现链路**：编排 Agent 调用 `task` → 类别解析（category-resolver）或子代理解析（subagent-resolver）→ 构建任务包（§4.8）→ 后台（manager.launch）或同步（sync-task-runner 轮询）→ 子 Agent 会话执行 → 结果/学习收获回传。

### 4.7 背景 Agent（并行执行）

**能力说明**：可同时启动 5+ 个专业 Agent 并行工作（研究、实现、验证同时进行），上下文保持精简，完成后通知取回。并发限制默认 5，可按 provider/model 配置。

**用法**：`task(..., run_in_background: true)`；`background_output(task_id)` / `background_cancel(task_id)` 管理。并发配置 `background_task.defaultConcurrency / providerConcurrency / modelConcurrency`（docs/reference/configuration.md:473-499）。

**源码实现原理**：

- 生成器：`src/features/background-agent/spawner.ts:30` `startTask()` — `client.session.create`（:57-68）、`setSessionAgent`（:78-79）、`buildTaskPromptBody`（:108）、fire-and-forget `promptWithRetryInDirectory`（:119）、失败回退 Agent（:123-147）、tmux 回调（:154）。`createTask()`（:26）生成 `bg_{uuid8}` ID。
- 管理器：`src/features/background-agent/manager.ts:559` `async launch(input)` — 入队、并发获取（~:678）、调 `startTask`（~:694）；`reserveSubagentSpawn`（:360）与后代计数（:385-399）。
- 并发：`src/features/background-agent/concurrency.ts:25` `getConcurrencyLimit()` — 优先级 model > provider > default > **默认 5**（:39）；`acquire`（:55）/`release`（:87）。
- 深度上限：`src/features/background-agent/subagent-spawn-limits.ts:4` `DEFAULT_MAX_SUBAGENT_DEPTH = 3`；`manager.ts:345-358` `assertCanSpawn`。
- 通知：`background-notification` 钩子在后台任务完成时通知（create-continuation-hooks.ts:73-75）。

**实现链路**：委派（§4.6）→ manager.launch → 并发准入 → spawner.startTask 创建子会话 → 完成事件 → background-notification 通知 → `background_output` 取回。

### 4.8 任务包（task packet）

**能力说明**：OmO 把委派给子代理的结构化任务描述称为"任务包"——由参数接口 + 六段式提示模板 + 元数据构成，确保子代理拿到自足、可执行的单目标任务。

**源码实现原理**：

- 参数接口：`src/tools/delegate-task/types.ts:54-65` `DelegateTaskArgs`（description / prompt / category / subagent_type / run_in_background / task_id / command / load_skills）。
- 系统内容：`src/tools/delegate-task/types.ts:128-140` `BuildSystemContentInput`；`src/tools/delegate-task/prompt-builder.ts:95` `buildTaskPrompt()` 组装最终提示；`src/features/background-agent/spawner/task-prompt-body.ts` `buildTaskPromptBody` 构建后台任务体。
- 六段式结构：`src/agents/sisyphus/default.ts:370-389` 规定 TASK / EXPECTED OUTCOME / REQUIRED TOOLS / MUST DO / MUST NOT DO / CONTEXT。
- 元数据发布：`src/tools/delegate-task/sync-task-metadata.ts`（同步任务元数据，含 model/task_id 一致性）。

**实现链路**：编排 Agent 构造 DelegateTaskArgs → prompt-builder 渲染六段式任务包 → 类别/技能解析注入 → 交给 §4.6 分发。

### 4.9 Team Mode（v4.0，并行多 Agent）

**能力说明**：把 OmO 从"单 Agent + 子代理"升级为真正的多 Agent 系统：一个 lead Agent 编排最多 8 个并行成员，通过 12 个 `team_*` 工具通信（共享邮箱、共享任务列表、可选 git worktree、可选 tmux 可视化）。**默认关闭**。

**用法**（docs/guide/team-mode.md:15-33）：

```jsonc
{ "team_mode": { "enabled": true, "max_parallel_members": 4, "max_members": 8, "tmux_visualization": false } }
```

重启 OpenCode 后 12 个工具解锁：`team_create` / `team_delete` / `team_shutdown_request` / `team_approve_shutdown` / `team_reject_shutdown` / `team_send_message` / `team_task_create` / `team_task_list` / `team_task_update` / `team_task_get` / `team_status` / `team_list`。团队规格放 `~/.omo/teams/{name}/config.json` 或 `<project>/.omo/teams/{name}/config.json`。两个预置技能：`hyperplan`（5 个敌对批评者）与 `security-research`（3 猎人 + 2 PoC）。

**源码实现原理**：

- 工具注册：`src/plugin/tool-registry-team-tools.ts:20-48` `createTeamModeToolsRecord`（未启用返回 `{}`）；12 个工具工厂：
  - `team_create` — `src/features/team-mode/tools/lifecycle-create-tool.ts:60` `createTeamCreateTool`（execute :75 → `createTeamRun` :97-115）
  - `team_delete` / `team_shutdown_request` / `team_approve_shutdown` / `team_reject_shutdown` — `tools/lifecycle-shutdown-tools.ts:37/64/81/98`
  - `team_send_message` — `src/features/team-mode/tools/messaging.ts:38`（`to:"*"` 为 lead 广播）
  - `team_task_*` — `tools/tasks.ts:72/97/114/137`（`status:"claimed"` 走 `claimTask` :128-130）
  - `team_status` / `team_list` — `tools/query.ts:34/51`
- 运行时：`src/features/team-mode/team-runtime/create.ts:124` `createTeamRun` — `Promise.all` 工作池并行生成成员（:168-254，`bgMgr.launch` :195-220）；`src/features/team-mode/team-runtime/status.ts:102` `aggregateStatus` 汇总；`src/features/team-mode/team-runtime/shutdown.ts` 关闭流程。
- tmux 可视化：`src/features/team-mode/team-runtime/activate-team-layout.ts:16` → `packages/team-core/src/team-layout-tmux/layout.ts:138` `createTeamLayout`（分屏 + `opencode attach`，:54-56, :104-136）。
- 成员资格：可 `sisyphus / atlas / sisyphus-junior`；条件 `hephaestus`；硬拒 `oracle / librarian / explore / multimodal-looker / metis / momus / prometheus`（team-mode.md:75-81，由 `AGENT_ELIGIBILITY_REGISTRY` 判定，packages/team-core/src/types.ts:190 `AGENT_ELIGIBILITY_REGISTRY`；成员资格校验 team-core/src/team-registry/validator.ts:91 `validateMemberEligibility`）。
- 关键词检测：`src/hooks/keyword-detector/team/default.ts:10` `TEAM_PATTERN`；组合检测与状态注入钩子 `src/hooks/team-mode-status-injector/hook.ts:119`。
- 共享核心：`packages/team-core/src/index.ts:1-11` 重导出 config / logger / member-parser / session-client / types / team-registry / team-mailbox / team-tasklist / team-state-store / team-worktree / team-layout-tmux。
- 两个技能：`packages/omo-senpi/skills/hyperplan/SKILL.md`（5 个敌对成员：skeptic/validator/researcher/architect/creative，3 轮辩论 + lead 提炼 + 强制 `task(load_skills:["ulw-plan"])` 交接 + `team_delete(force:true)`，:218-236, :388-435）；`src/features/builtin-skills/security-research/SKILL.md`（3 猎人 + 2 PoC 的 `team_create` inline spec，:34-87；严重度须经 PoC 复现/证伪后才定级，:132-189）。

**实现链路**：`team mode` 关键字 / `/hyperplan` → keyword-detector 注入 Team Mode 提示 → `team_create` 生成运行时状态（state.json + inboxes + tasks，team-mode.md:133-147）→ 工作池并行生成成员会话 → 成员 `team_task_update(claimed)` 认领 + `team_send_message` 协作 → lead `team_status` 汇总 → 关闭流程 → `team_delete` 清理。

### 4.10 Hash-Anchored Edit（hashline）

**能力说明**：`Read` 输出每行带 `LINE#ID` 内容哈希标签；`edit` 工具按 `LINE#ID` 引用目标行，编辑前校验哈希——文件在读取后发生变化则拒绝编辑并给出 `>>>` 变更上下文。消除行号过期与空白复制问题（README.md:326-344；基准：Grok Code Fast 1 成功率 6.7%→68.3%）。

**用法**：配置 `hashline_edit: true` 启用（默认关闭，docs/reference/configuration.md:1165-1173）；关闭 `disabled_hooks: ["hashline-read-enhancer"]`。`LINE#ID` 字符集为 `ZPMQVRWSNKTXJBYH`（features.md:652）。

**源码实现原理**：

- 哈希算法：`packages/hashline-core/src/hash-computation.ts:7-17` — `computeNormalizedLineHash`（xxHash32，种子 0 或行号，:9）+ `computeLineHash`（:15）；`:23-26` `formatHashLine` 产出 `${lineNumber}#${hash}|${content}`；流式 `streamHashLinesFromUtf8`（:62-123，200 行/64KB 分块）。
- 字符集：`packages/hashline-core/src/constants.ts:1-10` — `NIBBLE_STR = "ZPMQVRWSNKTXJBYH"`、`HASHLINE_DICT`（256 个两字符 ID）、`HASHLINE_REF_PATTERN` / `HASHLINE_OUTPUT_PATTERN`。
- 校验：`packages/hashline-core/src/validation.ts:67-80` `validateLineRef`、:162-181 `validateLineRefs`；`isCompatibleLineHash`（:18-20）兼容新旧哈希；`HashlineMismatchError`（:82-137）输出 `>>>` 变更标记 + 重映射表。
- 应用：`packages/hashline-core/src/edit-operations.ts:28-99` `applyHashlineEditsWithReport` — 去重 → 按行自底向上排序 → 校验 → 检测重叠 → 应用。
- 工具：`src/tools/hashline-edit/tools.ts:14-42` `createHashlineEditTool`（args: filePath / edits[]（op: replace|append|prepend, pos/end 为 LINE#ID 锚点）/ delete / rename）；执行器 `src/tools/hashline-edit/hashline-edit-executor.ts:79-178`，哈希不匹配错误提示（:171-177）。
- 读取标注钩子：`src/hooks/hashline-read-enhancer/hook.ts:192-216` `createHashlineReadEnhancerHook` — 在 `tool.execute.after` 把 read 输出中 `N: content` / `N| content` 改写成 `N#HASH|content`（:56-66, :64-65）。
- 门控注册：`src/plugin/tool-registry-gated-tools.ts:32`（`pluginConfig.hashline_edit` 为真才注册 `edit` 工具）；read 钩子注册于 `src/plugin/hooks/create-tool-guard-hooks.ts:125`。
- 配套 diff 增强钩子 `src/hooks/hashline-edit-diff-enhancer/`（定义存在但当前快照中未被接线，仅其自身文件被引用）。

**实现链路**：Read（hashline-read-enhancer 打标签）→ Agent 按 `LINE#ID` 构造 edit 参数 → `edit` 工具（hashline-edit）→ validation.validateLineRefs 校验当前文件哈希 → 匹配则应用（edit-operations），不匹配抛 HashlineMismatchError 返回 `>>>` 更新后的引用。

### 4.11 项目记忆 / notepad

**能力说明**：两层记忆：① `packages/memory-core` 提供的跨宿主 Agent 记忆引擎（git 仓库存储、反思、事实抽取、dream 整合、人物档案等）；② OpenCode 插件的项目级 notepad（`.omo/notepads/{plan-name}/`，规划执行时累积 learnings/decisions/issues/verification）与上下文注入。

**用法**：memory 默认开启（`memory.enabled: true`，configuration.md:602-709），可配置 reflection/nudge/facts/dream/people；`/sleeptime` 查看解析结果。notepad 由 Atlas/Prometheus 工作流自动维护（docs/guide/orchestration.md:265-274）。

**源码实现原理**：

- 记忆引擎：`packages/memory-core/src/index.ts:1-16` 桶导出 git / identity / locks / memfs / tools / journal / facts / reflection / compile / search / soul / sync / people / reminders / seeds。git 仓库式存储（`git/` 目录、`GitMemoryRepo`）。
- 记忆暴露：`packages/omo-senpi/src/mcp/memory-server.ts:41-80`（stdio MCP 服务器，memory 命令 + apply_patch）。
- 上下文注入：`src/features/context-injector/injector.ts:53-68` `createContextInjectorHook`（chat.message 注入项目上下文）、:90-168 `createContextInjectorMessagesTransformHook`；`src/hooks/compaction-context-injector/hook.ts:15-174`（压缩前保存 Agent 检查点并注入上下文）。
- notepad：`src/hooks/sisyphus-junior-notepad/constants.ts:6`（`.omo/notepads/{plan-name}/`）；`src/hooks/notepad-write-guard/` 保护。
- AGENTS.md 注入：`directory-agents-injector`（PreToolUse+PostToolUse，从文件目录向上收集 AGENTS.md；OpenCode 1.1.37+ 原生支持时自动停用）；`hephaestus-agents-md-injector`。

**实现链路**：会话消息 → context-injector 注入 AGENTS.md/notepad 摘要 → 规划/执行写入 `.omo/notepads/` → 压缩时 compaction-context-injector 保留关键上下文 →（Senpi 版）memory-core 后台反思/事实抽取落库。

### 4.12 验证循环（todo 续跑、诊断门禁）

**能力说明**：保证 Agent"不半途而废"与"完工有据"：① Todo Enforcer 在 todo 未清空且会话空闲时强制拉回；② 任务包要求子代理通过 lsp_diagnostics 等门禁再回报；③ Atlas 对每项任务独立验证。

**用法**：默认开启（`todo-continuation-enforcer` 钩子）；`/stop-continuation` 停止本会话所有续跑机制；`disabled_hooks: ["todo-continuation-enforcer"]` 可关。

**源码实现原理**：

- Todo Enforcer：`src/hooks/todo-continuation-enforcer/index.ts:12` `createTodoContinuationEnforcer`；`handler.ts:119-133` 处理 `session.idle`；`idle-event.ts:20-249` 守卫链（全部完成 :42-45、恢复中 :47-50、后台任务 :82-90、待回答 :103-106、无 todo :127-131、未完成数为 0 :134-139、冷却 :160-165、压缩守卫 :190-215、停滞检测 :235-237）；通过后 `src/hooks/todo-continuation-enforcer/countdown.ts` 启动倒计时、`continuation-injection.ts` 注入内部续跑提示。
- 注册：`src/plugin/hooks/create-continuation-hooks.ts:60-66`；事件分发 `src/plugin/event-hook-dispatcher.ts:46`。
- 诊断门禁：任务包 MUST DO 要求子代理用 `lsp_diagnostics`（经 `lsp` MCP，见 §4.18）验证后回报（orchestration.md:244-253）。
- Atlas 验证：`src/hooks/atlas/`（todo 驱动的验证循环）；`start-work` 钩子 + `packages/boulder-state/`（`.omo/boulder-state/` 工作状态：active_plan / session_ids / per-task 计时）。

**实现链路**：子代理执行 → 完成回报前跑 lsp_diagnostics → 编排者记录结果 → 会话空闲且 todo 未清 → todo-continuation-enforcer 注入续跑 → 重复直至全部完成 →（规划流）boulder 状态推进 / goal 完成审计。

### 4.13 多模型编排（模型路由 + 回退链）

**能力说明**：OmO 的核心差异化——按任务类型（类别）而非模型名路由，为每个 Agent/类别配置多 provider 多模型的回退链，运行时自动选择可用模型，出错时自动降级。两套独立回退：`model-fallback`（主动链选择）与 `runtime-fallback`（API 失败后反应式恢复）。

**用法**：`[opencode]` 块 `agents.*.model` / `categories.*.model` 覆盖；`fallback_models` 可混合字符串与对象条目（docs/reference/features.md:258-281）；`bunx oh-my-openagent doctor --verbose` 查看解析结果。

**源码实现原理**：

- Agent→模型表：`packages/model-core/src/agent-model-requirements.ts:3-186` `AGENT_MODEL_REQUIREMENTS`（每 Agent 的 `fallbackChain: [{providers[], model, variant}]`）。
- 类别→模型表：`packages/model-core/src/category-model-requirements.ts`（8 个内置类别，configuration.md:448-461 有镜像表）。
- 回退链构建：`packages/model-core/src/fallback-chain-from-models.ts:115-134` `buildFallbackChainFromModels`；对象条目解析 :39-82；`findMostSpecificFallbackEntry` :90-113。
- 模型解析：`packages/model-core/src/model-resolver.ts`（resolveModel / resolveModelWithFallback / normalizeFallbackModels，index.ts:18-23 导出）。
- 主动回退：`src/hooks/model-fallback/`（chat.message 处理，fallback-state-controller.ts 会话级链状态）；注册 create-session-hooks.ts:110-129。
- 反应式回退：`src/hooks/runtime-fallback/hook.ts:29-123`（message.updated 重试信号、首提示看门狗）；错误分类 `packages/model-core/src/runtime-fallback-error-classifier.ts`；可重试模式 `packages/model-core/src/runtime-fallback-retryable-patterns.ts`。
- 能力兼容：`packages/model-core/src/model-settings-compatibility.ts`（reasoning/temperature/top_p/maxTokens 按能力归一化）；`src/shared/model-capabilities/`（models.dev 快照 + 刷新）。
- 类别委派门控：`src/tools/delegate-task/category-resolver.ts:65` `resolveCategoryExecution`；`packages/senpi-task/src/category/resolver.ts:288` `resolveCategory`（类别门、回退链可用性、`prompt_append` 选择 :261-270,:421）。

**实现链路**：委派/主会话 → 模型解析（UI 选择 > 用户覆盖 > 类别默认 > fallback_models > 内置链 > 系统默认，configuration.md:397-402）→ 生成模型参数 → 运行中出错 → runtime-fallback 按错误码/超时切换链上下一 rung → 通知切换。

### 4.14 Agent 目录（11 个内置 Agent）

**能力说明**：Ultimate 版内置 11 个 Agent：primary 4 个（sisyphus / hephaestus / prometheus / atlas）+ subagent 7 个（oracle / librarian / explore / multimodal-looker / metis / momus / sisyphus-junior）。每 Agent 有专属提示、模型链与工具权限。

**用法**：Tab 切换 primary Agent；`@oracle`、`@librarian`、`@explore` 在对话中引用（features.md:25-33）；`disabled_agents` 关闭（configuration.md:200）。

**源码实现原理**：

- 注册表：`src/agents/builtin-agents.ts:32-45`（agentSources）、:51-59（agentMetadata）。
- 模型链（`packages/model-core/src/agent-model-requirements.ts`）：

| Agent | 角色 | 主模型 → 回退链（节选） | 引用行 |
| --- | --- | --- | --- |
| sisyphus | 主编排 | claude-opus-5/max → kimi-k3 → gpt-5.6-sol/medium → glm-5.2 → big-pickle | :4 |
| hephaestus | 深度工作 | gpt-5.6-sol/medium（openai\|github-copilot\|vercel\|opencode） | :32 |
| oracle | 架构/调试 | gpt-5.6-sol/xhigh → gemini-3.1-pro/high → claude-opus-5/max → glm-5.2 | :43 |
| librarian | 文档/代码搜索 | gpt-5.6-luna-fast/low → deepseek-v4-flash/max → … → gpt-5.4-nano | :68 |
| explore | 快速 grep | 同 librarian | :81 |
| multimodal-looker | 视觉/PDF | gpt-5.6-sol/low → kimi-k3 → glm-4.6v → gpt-5-nano | :94 |
| prometheus | 规划 | claude-fable-5/xhigh → kimi-k3/max | :102 |
| metis | 计划差距分析 | claude-opus-5/high → kimi-k3/low | :112 |
| momus | 高精度评审 | gpt-5.6-terra/high → gpt-5.6-sol/xhigh → claude-opus-5/max → gemini-3.1-pro/high → glm-5.2 | :122 |
| atlas | todo 编排 | claude-sonnet-5 → kimi-k3 → gpt-5.6-sol/medium → minimax-m3 → MiniMax-M3 → minimax-m2.7 | :157 |
| sisyphus-junior | 类别委派执行者 | claude-sonnet-5 → kimi-k3 → gpt-5.6-sol/medium → minimax-* → big-pickle | :171 |

- 工具限制（features.md:35-44）：oracle/librarian/explore 只读（禁 write/edit/task/call_omo_agent）；multimodal-looker 仅 read；momus 禁 write/edit 但可 task。
- 类别委派一律经 Sisyphus-Junior（orchestration.md:350）；Junior 不可再委派（防无限递归，features.md:245-251）。

**实现链路**：编排 Agent 按类别/子代理类型委派 → builtin-agents 注册表 + model-core 模型链解析 → Sisyphus-Junior（类别）或目标 Agent（subagent_type）会话 → 权限限制生效 → 结果回报。

### 4.15 Skills 技能系统

**能力说明**：技能不是简单提示——每技能可携带领域调优的系统指令、按需启动的内嵌 MCP 服务器、作用域权限。自动按描述匹配任务触发，也可 `load_skills` 强制加载。

**用法**：技能自动触发（描述匹配）；`task(..., load_skills: ["frontend", "playwright"])`；`/skill:名称` 或 `skill({name})` 工具调用；自定义技能放 `.opencode/skills/<name>/SKILL.md` 或 `~/.config/opencode/skills/<name>/SKILL.md`（features.md:553-587）；`disabled_skills` 关闭。

**源码实现原理**：

- 内置技能注册：`src/features/builtin-skills/`（skills/*.ts 与 skills/ 子目录：agent-browser / debugging / dev-browser / frontend / git-master / init-deep / playwright / remove-ai-slops / review-work / security-research / security-review / team-mode / visual-qa）。
- 技能加载优先级：project > opencode > user > builtin（orchestration.md:371-373）。
- 加载器：`packages/skills-loader-core/`（内置技能 SKILL.md 模板加载）；`src/features/opencode-skill-loader/`（同时发现 `.opencode/skills`、`~/.config/opencode/skills`、`.claude/skills` 等路径；loader.ts:96 `discoverSkills`）。
- 技能内嵌 MCP：SKILL.md frontmatter 声明 `mcp:`，`skill_mcp` 工具调用；客户端按 `${sessionID}:${skillName}:${serverName}` 隔离（features.md:1051）。
- 目录技能注入：`directory-agents-injector` / `category-skill-reminder`（提醒可用的类别技能）。
- 斜杠命令即技能：`src/features/builtin-commands/`（templates/ 下 goal / refactor / start-work / stop-continuation / remove-ai-slops / handoff / hyperplan / init-deep）。

**实现链路**：消息/委派 → 技能描述匹配或 load_skills → skills-loader-core 加载 SKILL.md → 解析 frontmatter 的 mcp 声明 → skill-mcp-manager 按需启动内嵌 MCP → 系统指令注入子代理提示。

### 4.16 MCP 集成

**能力说明**：三层 MCP 架构：① 内置 MCP（websearch-Exa / context7 / grep_app / lsp / codegraph），由插件**运行时注入**，`opencode mcp list` 不可见；② Claude Code `.mcp.json` 加载器（支持 `${VAR}` 展开）；③ SKILL.md frontmatter 声明的技能内嵌 MCP。

**用法**：`disabled_mcps: ["websearch", "grep_app"]` 关闭；`bunx oh-my-openagent doctor --verbose` 查看实际注入；`bunx oh-my-openagent mcp oauth login <server>` 预认证 OAuth MCP（features.md:1017-1083）。

**源码实现原理**：

- 内置 MCP 定义：`src/mcp/index.ts:36-71` `createBuiltinMcps(disabledMcps, config, options)`：
  - `websearch`（:39-44）— `src/mcp/websearch.ts:12-40`：Exa `https://mcp.exa.ai/mcp?tools=web_search_exa`（可选 EXA_API_KEY），Tavily 备选
  - `context7`（:46-48）— `src/mcp/context7.ts:9-19`：`https://mcp.context7.com/mcp`
  - `grep_app`（:50-52）— `src/mcp/grep-app.ts:1-6`：`https://mcp.grep.app`
  - `lsp`（:54-59）— `src/mcp/lsp.ts:136` `createLspMcpConfig`（本地 stdio）
  - `codegraph`（:61-68）— `src/mcp/codegraph.ts:49` `createCodegraphMcpConfig`（本地 stdio，可 `codegraph.enabled:false` 关）
- 运行时注入：`src/plugin-handlers/mcp-config-handler.ts:28-69` `applyMcpConfig` — 合并内置 MCP（:51）+ Claude Code `.mcp.json`（:39，`features/claude-code-mcp-loader`）+ 用户 mcp 块（:53）+ 插件组件 mcpServers（:54），处理 `enabled:false`（:57-61）与 `disabled_mcps` 删除（:63-66），写入 `params.config.mcp`。
- 技能内嵌 MCP：`packages/mcp-client-core/src/skill-mcp-manager/manager.ts:41-216` `SkillMcpManager` — 按 session+skill+server 建键（:19-26）、惰性 `getOrCreateClient`（:65-78）、`callTool` 重试（:106-117）、OAuth（McpOAuthProvider）、5 分钟空闲超时（:53）；`src/features/skill-mcp-manager/` 为薄重导出。
- `.mcp.json` 加载：`src/features/claude-code-mcp-loader/`（`loadMcpConfigs`，含 `${VAR}` 展开与安全 allowlist）。

**实现链路**：插件启动 → mcp-config-handler 合并三层 → 写入宿主 mcp 配置（运行时注入）→ 工具调用 →（技能 MCP）skill-mcp-manager 惰性启动客户端 → 结果返回。

### 4.17 钩子系统（hook）

**能力说明**：54+（可配置 56 个）生命周期钩子，跨 session / tool-guard / transform / continuation / skill 五层，在事件点拦截并修改行为：工具调用前/后、消息处理、会话事件、参数设置、压缩等。

**用法**：`disabled_hooks: ["comment-checker"]` 关闭（features.md:972-980）；完整名单见 configuration.md:719（56 个）。

**源码实现原理**：

- 装配：`src/create-hooks.ts:36` `createHooks()` → `createCoreHooks`（:61）/`createContinuationHooks`（:72）/`createSkillHooks`（:80）合并为 hooks 映射（:89-93）。
- 分层：`src/plugin/hooks/create-core-hooks.ts:12`（session:24 / tool-guard:18 / transform:7 等）；`create-session-hooks.ts:70`；`create-tool-guard-hooks.ts`；`create-transform-hooks.ts:55-68`（keyword-detector 等）；`create-continuation-hooks.ts:26`；`create-skill-hooks.ts`。
- 名字枚举：`src/config/schema/hooks.ts:3-62` `HookNameSchema`（56 个可配置钩子名）。
- 过滤：`src/testing/create-plugin-module.ts:280-282` `isHookEnabled = (name) => !disabledHooks.has(name)`；`shared/safe-create-hook.ts` 包裹工厂防崩。
- 事件分发：`src/plugin/event-hook-dispatcher.ts:37-71` `createEventHookDispatcher` — 按固定顺序调 26 个事件处理（goal :63、todoContinuationEnforcer :46、rulesInjector :51、runtimeFallback :59）。
- 代表性钩子与文件：
  - `comment-checker` — `src/hooks/comment-checker/hook.ts:36`（CLI 检查引擎在 `packages/comment-checker-core/`）
  - `rules-injector` — `src/hooks/rules-injector/hook.ts:38`（引擎 `packages/rules-engine/`）
  - `goal` — §4.5；`start-work` / `atlas` — §4.12
  - `model-fallback` / `runtime-fallback` — §4.13
  - `think-mode` — Params 钩子，检测"think deeply"等并调模型设置（features.md:872）
  - `claude-code-hooks` — 执行 Claude Code settings.json 钩子（features.md:949-970）

**实现链路**：宿主事件（tool.execute.before / after、chat.message、session.idle 等）→ createPluginInterface 路由 → createHooks 映射中的对应钩子 → isHookEnabled 过滤 → 执行（可修改输入/输出/注入消息）→ 返回宿主。

### 4.18 LSP / AST-grep / tmux 工具

**能力说明**：IDE 级工具集成：LSP 8 个别名工具（诊断、跳转、引用、重命名、符号等，由内置 `lsp` MCP 提供）；AST-grep 模式感知代码搜索/重写（`ast-grep` 技能 + `sg`）；tmux 全交互终端（`interactive_bash` 工具 + 背景 Agent 分屏）。

**用法**（features.md:654-671, 805-828）：`lsp_diagnostics` / `lsp_rename` / `lsp_goto_definition` / `lsp_find_references` 等；`/refactor` 斜杠命令整合 LSP+AST-grep+TDD；`interactive_bash(tmux_command="send-keys ...")`。

**源码实现原理**：

- LSP 工具定义：`packages/lsp-core/src/tools/definitions.ts:10-141` `LSP_MCP_TOOLS`（8 工具，各带 `lsp_*` 别名）；分发 `packages/lsp-core/src/tools/runtime.ts:5-13` `executeLspTool`；MCP 服务器 `packages/lsp-core/src/mcp.ts:33-79`；CLI 入口 `packages/lsp-tools-mcp/src/cli.ts:7-21`（`omo-lsp [mcp]`）。
- LSP daemon：`packages/lsp-daemon/src/index.ts:1-25`（ensureDaemonRunning / callToolViaDaemon / runMcpStdioProxy）。
- AST-grep：`packages/ast-grep-mcp/src/mcp.ts:119-200` `AST_GREP_MCP_TOOLS`（search / rewrite / scan，服务器名 `ast_grep` :30）；二进制解析 `resolveSgBinarySync`（:366-373）；错误分类 `AST_GREP_ERROR_CODES`（:38-58）。
- tmux：`packages/tmux-core/src/runner.ts:84-102` `runTmuxCommand`（重试 + cmux 兼容）；`src/tools/interactive-bash/tools.ts:226-232` `interactive_bash`（`tmux_command` 参数，执行器 :156-224，封禁 capture-pane/kill-server）；`src/features/tmux-subagent/`（tmux 后台子代理会话生命周期）；配置 `tmux.enabled`（features.md:108-127）。

**实现链路**：Agent 调 `lsp_diagnostics` → `lsp` MCP（lsp-core）→ lsp-daemon 连接语言服务器 → 返回诊断；`/refactor` → builtin-commands/templates/refactor → LSP 重命名 + AST-grep 匹配 + TDD 验证；`interactive_bash` → tmux-core runner → 持久终端会话。

### 4.19 配置系统

**能力说明**：统一配置文件 `omo.jsonc`（用户层 `~/.omo/omo.jsonc` + 项目层 `.omo/omo.jsonc` 自工作目录上溯至 `$HOME`，最近者优先）；旧 `oh-my-openagent.json[c]` / `oh-my-opencode.json[c]` 由迁移引擎一次性导入后不再读取。每宿主解析自己的视图（`[opencode]` / `[senpi]` / `[codex]` 块）。

**用法**：schema 自动补全 `"$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/omo.schema.json"`；手动迁移 `oh-my-openagent config migrate`（configuration.md:95-105）；配置文件优先级见 configuration.md:50-62。

**源码实现原理**：

- 配置链加载：`src/plugin-config.ts` `loadPluginConfig` / `validatePluginConfig`；统一配置核心 `packages/omo-config-core/`（omo.jsonc 解析、harness 视图）。
- 迁移引擎：`src/startup-migration.ts`（锁定+日志式迁移）；`src/config-migration/`（含 `2026-08-reasoning-unification` 等迁移模块）；迁移标记 `_migrations` 数组防重复。
- schema：`src/config/schema/`（hooks.ts / agent-overrides.ts / categories.ts / codegraph.ts / oh-my-opencode-config.ts 等，zod 定义）；`assets/omo.schema.json` 生成。
- 合并规则：原型污染安全的深度合并（installation.md:889-894）；`mcp_env_allowlist` 仅用户层可扩展（安全）。
- 原型污染防护：`src/plugin-config.prototype-pollution.test.ts`。

**实现链路**：宿主启动 → loadConfigChain（合并 项目层→用户层）→ 迁移引擎导入旧文件 → 按 harness 视图解析 → createManagers/createTools/createHooks 消费配置。

### 4.20 Claude Code 兼容层

**能力说明**：Claude Code 的 hooks / commands / skills / agents / MCPs / plugins 可原样加载到 OmO（README.md:305-309）。

**用法**：配置切换 `claude_code: { mcp:false, commands:false, ... }` 逐项关闭（features.md:1169-1204）；插件覆盖 `claude_code.plugins_override`。

**源码实现原理**：

- 核心包：`packages/claude-code-compat-core/src/index.ts:1-4`（重导出 plugin/mcp/command/agent 加载器）。
- 各加载器（src/features/）：`claude-code-command-loader`（`.claude/commands/`）、`claude-code-agent-loader`（`.claude/agents/*.md`）、`claude-code-mcp-loader`（`.mcp.json`）、`claude-code-plugin-loader`（marketplace 插件）、`claude-code-session-state`；技能兼容路径（`.claude/skills`）由 `opencode-skill-loader` 统一发现。
- 钩子执行：`src/hooks/claude-code-hooks/`（handlers/ 支持 chat.message、tool.execute.before/after）。

**实现链路**：插件启动 → 各 claude-code-*-loader 扫描 Claude Code 路径 → 合并进 commands/skills/agents/MCPs → claude-code-hooks 执行 settings.json 钩子。

### 4.21 任务系统（跨会话文件持久化）

**能力说明**：`experimental.task_system: true` 启用后，TodoWrite/TodoRead 被替换为文件持久化的任务工具（`task_create` / `task_get` / `task_list` / `task_update`），支持 `blockedBy`/`blocks` 依赖与跨会话存活（features.md:730-803）。

**用法**：配置 `experimental.task_system: true`；存储默认 OpenCode 配置目录 `tasks/<list-id>`，可用 `sisyphus.tasks.storage_path` 覆盖。

**源码实现原理**：

- 工具：`src/tools/task/`（task_create / task_get / task_list / task_update）；`src/features/claude-tasks/`（Task Schema：T-{uuid}、status、blockedBy 等，features.md:745-762）。
- 拦截：`src/hooks/tasks-todowrite-disabler/`（任务系统激活时禁用 TodoWrite）。
- 与 TodoWrite 区别：文件存储、重启存活、依赖支持、并行自动优化（features.md:794-801）。

### 4.22 会话工具 / 会话恢复

**能力说明**：`session_list` / `session_read` / `session_search` / `session_info` 读写 OpenCode 会话历史；自动恢复常见会话故障（缺工具结果、思考块违规、空消息、上下文超限、JSON 解析错误）。

**用法**：`session_search({query:"..."})` + `session_read({session_id})` + `/continue <id>` 找回旧会话（features.md:704-728）。

**源码实现原理**：

- 工具：`src/tools/session-manager/tools.ts:62` `createSessionManagerTools`（session_list :73 / session_read :102 / session_search :138 / session_info :179）。
- 恢复：`src/plugin/chat-message/`（recovery 逻辑）；`src/hooks/anthropic-context-window-limit-recovery/`（Claude 上下文上限优雅处理）；`src/hooks/json-error-recovery/`；`src/hooks/edit-error-recovery/`。

### 4.23 OpenClaw 外联通知

**能力说明**：双向外部集成：会话事件（idle/error/completion）向 Discord / Telegram / HTTP / shell 发送通知；可选入站 reply-listener 守护进程轮询并 `send-keys` 回写到跟踪的 tmux 窗格。

**用法**：`openclaw` 配置块；环境变量 `OMO_OPENCLAW_COMMAND_TIMEOUT_MS` / `OMO_OPENCLAW_DEBUG` 等（installation.md:927-941）。

**源码实现原理**：`src/openclaw/`（initializeOpenClaw、dispatchers、reply listener）；核心 `packages/openclaw-core/`。

### 4.24 遥测

**能力说明**：匿名日活遥测（默认开）：每机器每 UTC 日最多发一次事件，使用 SHA256 哈希安装标识，不建 PostHog 人物档案。主插件事件 `omo_daily_active`（plugin_loaded + run_started）；Codex Light 事件 `omo_codex_daily_active`（install_completed + session_start）。

**用法**：`telemetry: false` 或 `OMO_DISABLE_POSTHOG=1` / `OMO_SEND_ANONYMOUS_TELEMETRY=0`（installation.md:959-997）。

**源码实现原理**：`packages/telemetry-core/`（PostHog 客户端、哈希 ID、日去重）；插件侧 `src/testing/create-plugin-module.ts:222` 调用 `recordPluginTelemetry`（定义于 `src/shared/posthog.ts:176`）；Codex 组件 `packages/omo-codex/src/telemetry/`。

---

## 5. LazyCodex（演化方向简述）

LazyCodex 是 OmO 面向 OpenAI Codex CLI 的继任产品（README.md:1-9）：

- 独立仓库 `code-yeongyu/lazycodex` 承载 marketplace 包（marketplace 名 `sisyphuslabs`，插件名 `omo`，即 `omo@sisyphuslabs`；README.md:178）。
- 安装：`npx lazycodex-ai install`（Node/npm，无需 Bun；可选 `--codex-autonomous`）。
- 落地内容：`~/.codex/plugins/cache/sisyphuslabs/omo/<version>/`、`~/.codex/config.toml` 的 marketplace/plugin/hooks 块（SHA256 钩子信任哈希）、`~/.codex/agents/*.toml`（Codex 原生 Agent 角色）、`~/.local/bin` 组件 CLI（omo-rules / omo-lsp / ulw / ulw-loop 等）。
- 组件（docs/guide/installation.md:798-810）：rules / comment-checker / git-bash / codegraph / lazycodex-executor-verify / lsp / teammode / ultrawork / ulw-loop / start-work-continuation / telemetry。
- 与 OpenCode 版共存：各 harness 读同一 `omo.jsonc` 的不同视图（installation.md:812-816）。
- 代码：本仓库 `packages/omo-codex/`（src/install/ 安装器、plugin/components/ 组件源码）。

---

## 6. 源码引用索引（速查）

### 插件入口与装配

| 引用 | 说明 |
| --- | --- |
| `packages/omo-opencode/src/index.ts:3-5` | 插件模块入口 `omoPlugin` |
| `packages/omo-opencode/src/testing/create-plugin-module.ts:159` | `createPluginModule` 装配链 |
| `packages/omo-opencode/src/plugin-interface.ts:20-109` | `createPluginInterface` 宿主接口 |
| `packages/omo-opencode/src/plugin/types.ts:11-16` | `PluginInterface` 类型 |
| `packages/omo-opencode/package.json:2-45` | 包定义与依赖（@oh-my-opencode/* workspace） |
| `package.json:2,40-46` | 根包名 oh-my-opencode + 5 个 bin 别名 |

### 编排与委派

| 引用 | 说明 |
| --- | --- |
| `src/hooks/keyword-detector/constants.ts:33-38` | ultrawork 关键字 |
| `src/hooks/keyword-detector/detector.ts:44-71` | `detectKeywordsWithType` |
| `src/hooks/keyword-detector/hook.ts:38,231-240` | 注入钩子 |
| `src/hooks/keyword-detector/ultrawork/index.ts:43-62` | 消息变体路由 |
| `packages/prompts-core/prompts/ultrawork/default.md` | 默认 ultrawork 协议 |
| `src/agents/sisyphus/default.ts:138` | `buildDefaultSisyphusPrompt` |
| `src/agents/sisyphus/index.ts:18-36` | 模型变体导出 |
| `src/agents/hephaestus/agent.ts:152` | `createHephaestusAgent` |
| `src/agents/hephaestus/gpt-5-6.ts:28` | Hephaestus 提示模板 |
| `src/agents/prometheus/system-prompt.ts:18` | Prometheus 系统提示 |
| `src/tools/delegate-task/tools.ts:81` | `createDelegateTask`（task 工具） |
| `src/tools/delegate-task/category-resolver.ts:65` | `resolveCategoryExecution` |
| `src/tools/delegate-task/types.ts:54-65,128-140` | 任务包接口 |
| `src/tools/delegate-task/prompt-builder.ts:95` | `buildTaskPrompt` |
| `src/tools/call-omo-agent/tools.ts:110` | `createCallOmoAgent` |
| `src/tools/delegate-task/constants.ts:378,404` | 计划族/协调者限制 |
| `packages/delegate-core/package.json:6` | 委派核心包 |
| `src/agents/builtin-agents.ts:32-45` | Agent 注册表 |
| `packages/model-core/src/agent-model-requirements.ts:3-186` | Agent→模型链 |

### 并发与状态

| 引用 | 说明 |
| --- | --- |
| `src/features/background-agent/spawner.ts:30` | `startTask` |
| `src/features/background-agent/manager.ts:559` | `launch` |
| `src/features/background-agent/concurrency.ts:25` | 并发限制 |
| `src/features/background-agent/subagent-spawn-limits.ts:4` | 深度上限 3 |
| `src/hooks/todo-continuation-enforcer/index.ts:12` | Todo Enforcer |
| `src/hooks/todo-continuation-enforcer/idle-event.ts:20-249` | 空闲守卫链 |
| `src/hooks/goal/controller.ts:24` | Goal 控制器 |
| `src/hooks/goal/index.ts:36` | Goal 续跑钩子 |
| `src/hooks/goal/prompt.ts:19-30` | 完成审计 |
| `src/hooks/goal/store.ts:8-10` | `.omo/goal/*.json` |
| `packages/boulder-state/` | `.omo/boulder-state/` 工作状态 |

### Team Mode

| 引用 | 说明 |
| --- | --- |
| `src/plugin/tool-registry-team-tools.ts:20-48` | 12 个 team_* 工具注册 |
| `src/features/team-mode/tools/lifecycle-create-tool.ts:60` | team_create |
| `src/features/team-mode/team-runtime/create.ts:124` | `createTeamRun` |
| `src/features/team-mode/team-runtime/status.ts:102` | `aggregateStatus` |
| `src/features/team-mode/team-runtime/activate-team-layout.ts:16` | tmux 激活 |
| `packages/team-core/src/team-layout-tmux/layout.ts:138` | `createTeamLayout` |
| `packages/team-core/src/index.ts:1-11` | team-core 导出 |
| `src/hooks/keyword-detector/team/default.ts:10` | team 关键字 |
| `packages/omo-senpi/skills/hyperplan/SKILL.md:218-236,388-435` | hyperplan 技能 |
| `src/features/builtin-skills/security-research/SKILL.md:34-87,132-189` | security-research 技能 |
| `src/hooks/team-tool-gating/hook.ts:81` | team 工具授权门 |
| `src/hooks/team-mailbox-injector/hook.ts:90` | 邮箱注入 |

### Hashline

| 引用 | 说明 |
| --- | --- |
| `packages/hashline-core/src/hash-computation.ts:7-26` | 哈希算法与格式 |
| `packages/hashline-core/src/constants.ts:1-10` | 字符集与正则 |
| `packages/hashline-core/src/validation.ts:67-80,162-181` | 校验与拒绝 |
| `packages/hashline-core/src/edit-operations.ts:28-99` | 编辑应用管线 |
| `src/tools/hashline-edit/tools.ts:14-42` | `createHashlineEditTool` |
| `src/tools/hashline-edit/hashline-edit-executor.ts:79-178` | 执行器 |
| `src/hooks/hashline-read-enhancer/hook.ts:192-216` | 读取标注 |
| `src/plugin/tool-registry-gated-tools.ts:32` | 门控注册 |

### 钩子 / MCP / 配置 / 记忆

| 引用 | 说明 |
| --- | --- |
| `src/create-hooks.ts:36` | `createHooks` |
| `src/config/schema/hooks.ts:3-62` | 56 个钩子名 |
| `src/plugin/event-hook-dispatcher.ts:37-71` | 事件分发 |
| `src/mcp/index.ts:36-71` | 内置 MCP |
| `src/mcp/websearch.ts:12-40` | Exa websearch |
| `src/mcp/context7.ts:9-19` | context7 |
| `src/mcp/grep-app.ts:1-6` | grep_app |
| `src/plugin-handlers/mcp-config-handler.ts:28-69` | 运行时 MCP 注入 |
| `packages/mcp-client-core/src/skill-mcp-manager/manager.ts:41-216` | 技能 MCP 管理器 |
| `src/plugin-config.ts` / `packages/omo-config-core/` | 配置加载/统一配置 |
| `src/startup-migration.ts` / `src/config-migration/` | 迁移引擎 |
| `packages/memory-core/src/index.ts:1-16` | 记忆引擎导出 |
| `src/features/context-injector/injector.ts:53-68,90-168` | 上下文注入 |
| `src/hooks/compaction-context-injector/hook.ts:15-174` | 压缩上下文保留 |
| `packages/rules-engine/src/` | 规则引擎（AGENTS.md/.omo/rules） |
| `packages/claude-code-compat-core/src/index.ts:1-4` | 兼容层 |
| `packages/lsp-core/src/tools/definitions.ts:10-141` | LSP 工具 |
| `packages/ast-grep-mcp/src/mcp.ts:119-200` | AST-grep 工具 |
| `packages/tmux-core/src/runner.ts:84-102` | tmux 命令层 |
| `src/tools/session-manager/tools.ts:62` | 会话工具 |
| `packages/telemetry-core/` | 遥测 |
| `packages/pi-goal/README.md` | pi-goal 包（pi 宿主的 /goal） |
| `packages/omo-codex/plugin/components/ulw-loop/src/` | Codex ulw-loop 实现 |
| `packages/omo-opencode/src/cli/codex-ulw-loop.ts:55-73` | omo 侧 ulw-loop CLI 包装 |

---

## 7. 验收说明

- 本文档每个机制的「源码实现原理」小节均给出真实文件路径与行号/函数名；引用已对照 `C:\Users\alphazz\AppData\Local\Temp\opencode\repos\omo-x\oh-my-openagent-dev`（dev 分支快照）逐一核对（抽查含 keyword-detector/constants.ts:33-38、agent-model-requirements.ts:3-31、tool-registry-team-tools.ts:20-25、hashline-core/constants.ts:1-10、mcp/index.ts:36-71、delegate-task/tools.ts:81、goal/controller.ts:24 等）。
- 快照版本 `5.0.0-beta.7`；若上游持续演进，行号可能漂移，但函数名与文件路径具有稳定性。
- 特别说明：`$ultragoal` 在本快照中不存在字面实现，功能对应 Goal 机制（§4.5）；`ulw-loop` 完整实现位于 Codex 组件（§5），OpenCode 侧为 `.omo/ulw-loop/` TUI 镜像 + CLI 包装。
