# Deep Interview Spec: OMC 工具家族能力使用与实现原理参考文档

## Metadata
- Interview ID: di-omc-tools-20260814
- Rounds: 5
- Final Ambiguity Score: 13%
- Type: greenfield（知识研究）
- Generated: 2026-08-14
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.90 | 0.40 | 0.36 |
| Constraint Clarity | 0.85 | 0.30 | 0.26 |
| Success Criteria | 0.85 | 0.30 | 0.26 |
| **Total Clarity** | | | **0.87** |
| **Ambiguity** | | | **13%** |

## Goal
产出一份**源码级参考文档**，覆盖 oh-my-codex、oh-my-claudecode、oh-my-openagent、Clawhip 四个工具：
- **怎么使用**：每个机制/能力的能力说明 + 用法（命令、关键词、配置、调用方式）
- **实现原理**：源码级解读（克隆四个仓库读源码，逐模块梳理代码路径）
- **实现链路**：数据流/事件流链路图（端到端）
- **双视角**：每个能力先写原生宿主用法（OMC→Claude Code、OmX→Codex CLI、OmO→OpenCode 原生、Clawhip→通用 daemon），再写 OpenCode 适配差异

## Constraints
- 深度：**源码级**——克隆四个仓库，梳理**所有机制**（hook 管线、$team 编排、事件路由等），逐模块解读代码路径
- 视角：**双视角**——原生宿主主视角 + OpenCode 适配差异附注
- 语言：中文
- 结构（默认约定）：每个工具一份文档 + 一份总览（含四工具协作端到端链路图）
- 引用以仓库当前 main/dev 分支为准，标注文件路径:行号/函数名
- 不要求示例可运行（用户未选择该验收项），用法部分以文档化命令/配置为准

## Non-Goals
- 不追溯 Claw Code 重写历史（已另有文档 `claw-code-rewrite-workflow.md`）
- 不要求逐步教程/可运行示例验证
- 不做四工具横向性能对比
- 不涉及 OpenClaw 网关的独立深度文档（仅在链路图中标注位置）

## Acceptance Criteria
- [ ] **机制清单全覆盖**：四个工具各产出完整机制清单（如 OMC：team/ralph/ultrawork/autopilot/hooks/HUD/memory/wiki/notifications…），逐项"能力+用法+原理+链路"四件套齐全，无遗漏
- [ ] **端到端链路图**：文档含完整链路图（如：指令→$team 拆分→worker 执行→hook 事件→clawhip 路由→Discord 通知）
- [ ] **源码引用可复核**：每个机制的说明标注源码文件:行号/函数名引用，可顺着代码路径复核

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 成果形态不明确 | Round 1 问目标产物 | 完整参考文档：使用+原理+链路 |
| "实现原理"深度不明 | Round 2 问深度边界 | 源码级：四仓库全读，所有机制逐模块代码路径 |
| "完整"无法验证 | Round 3 问验收标准 | 机制清单全覆盖 + 端到端链路图 + 源码引用可复核 |
| 环境视角未定 | Round 4 问宿主视角 | 原生宿主主视角 |
| 读者定位矛盾（自用 OpenCode vs 原生宿主视角） | Round 5 逆反模式挑战 | 双视角都写（原生宿主用法 + OpenCode 适配差异） |

## Technical Context
- 研究目标仓库：
  - oh-my-codex（Yeachan-Heo/oh-my-codex，32.6K⭐，Codex CLI 工作流层）
  - oh-my-claudecode（Yeachan-Heo/oh-my-claudecode，38.5K⭐，Claude Code 工作流层）
  - oh-my-openagent（code-yeongyu/oh-my-openagent，67.8K⭐，前身 oh-my-opencode，现名 LazyCodex）
  - clawhip（Yeachan-Heo/clawhip，927⭐，v0.3 改名 gajae-claw，事件→频道通知路由器）
- 宿主环境：Claude Code / Codex CLI / OpenCode（当前会话环境）
- 已知关系：OmX 与 OMC 同作者同哲学；OmO 原生支持 OpenCode；clawhip 原生 hooks 支持 Codex+Claude（含 OMC/OMX wrapper），OpenCode 需适配（桥接或 OMC notifications 替代）

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| oh-my-codex (OmX) | core domain | $architect/$executor/$plan/$team/$ralph/$ultragoal, hooks, HUD | 运行于 Codex CLI |
| oh-my-claudecode (OMC) | core domain | 同上工作流 + skills, wiki, notepad | 运行于 Claude Code / OpenCode 插件 |
| oh-my-openagent (OmO/LazyCodex) | core domain | ultrawork, subagents, task packets | 原生支持 OpenCode |
| Clawhip (gajae-claw) | core domain | sources, routes, sinks, typed envelopes | 事件→频道路由 |
| 能力/功能 | supporting | 各工具机制集合 | 属于工具集 |
| 使用方式 | supporting | 命令/关键词/配置 | 描述能力 |
| 实现原理 | supporting | 源码路径/机制 | 解释能力 |
| 实现链路 | supporting | 数据流/事件流 | 串联机制 |
| 参考文档 | deliverable | 四件套结构 | 由访谈产生 |
| 机制清单 | acceptance | 全覆盖列表 | 验收项 |
| 端到端链路图 | acceptance | 协作图 | 验收项 |
| 源码引用 | acceptance | 文件:行号 | 验收项 |
| 原生宿主 | constraint | Claude Code/Codex CLI | 使用视角 |
| OpenCode 适配 | constraint | 差异说明 | 第二视角 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 6 | 6 | - | - | - |
| 2 | 11 | 6 | 0 | 5 | 45% |
| 3 | 15 | 3 | 0 | 12 | 80% |
| 4 | 19 | 4 | 0 | 15 | 79% |
| 5 | 22 | 3 | 0 | 19 | 86% |

## Interview Transcript
<details>
<summary>Full Q&A (5 rounds)</summary>

### Round 1
**Q:** 最终想要的成果形态是什么？
**A:** 完整参考文档：使用+原理+链路
**Ambiguity:** 68% (Goal: 0.5, Constraints: 0.2, Criteria: 0.2)

### Round 2
**Q:** "实现原理与实现链路"要做到什么深度？
**A:** 源码级：克隆四个仓库读源码，对所有机制（hook 管线、$team 编排、事件路由等）逐模块解读代码路径
**Ambiguity:** 50% (Goal: 0.65, Constraints: 0.55, Criteria: 0.25)

### Round 3
**Q:** "完整"的验收标准是什么？（可多选）
**A:** 机制清单全覆盖 + 端到端链路图 + 源码引用可复核（未选"示例可运行"）
**Ambiguity:** 31% (Goal: 0.75, Constraints: 0.6, Criteria: 0.7)

### Round 4
**Q:** "使用方式"部分以哪个环境为撰写视角？
**A:** 原生宿主主视角（OMC→Claude Code、OmX→Codex CLI，OpenCode 作为适配说明附注）
**Ambiguity:** 23% (Goal: 0.8, Constraints: 0.75, Criteria: 0.75)

### Round 5
**Q:** 挑战核心假设：文档主要读者是谁？（你的实际环境是 OpenCode，原生宿主视角与自用矛盾）
**A:** 双视角都写（每个能力先写原生宿主用法，再写 OpenCode 适配差异）
**Ambiguity:** 13% (Goal: 0.9, Constraints: 0.85, Criteria: 0.85)

</details>
