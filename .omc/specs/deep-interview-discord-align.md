# Deep Interview Spec: 飞书直桥对齐 Discord 真实使用模式（源码基准，仅改桥）

## Metadata
- Interview ID: di-align-discord-usage-20260814
- Rounds: 4
- Final Ambiguity Score: 16%
- Type: greenfield（桥代码改造 + 文档更新）
- Generated: 2026-08-14
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.40 | 0.38 |
| Constraint Clarity | 0.85 | 0.30 | 0.26 |
| Success Criteria | 0.70 | 0.30 | 0.21 |
| **Total Clarity** | | | **0.84** |
| **Ambiguity** | | | **16%** |

## Goal
将飞书直桥（`bridge/feishu-bridge.mjs` + `docs/feishu-direct-bridge.md`）的指令处理**对齐 omx/clawhip 源码揭示的 Discord 真实使用模式**。**只改桥代码与文档，不改动 omx 和 clawhip 源码**。

## 源码对齐基准（已取证）
| 机制 | 源码证据 | 真实模式 |
|------|---------|---------|
| omx Reply Listener | `src/notifications/reply-listener.ts`（Reply Listener Daemon：轮询 Discord/Telegram 回复，清洗输入，`sendToPane()` 注入运行中会话，**授权=配置用户 ID 白名单**） | 授权用户的消息/回复 → 注入「已运行」agent 会话；**无前缀过滤** |
| omx 通知发送 | `notifications/index.ts`（notifyLifecycle → Discord/Telegram/Slack/webhook） | agent 状态推送出站 |
| clawhip deliver | `src/hooks/prompt_deliver.rs`（向 tmux 会话注入 prompt 按键，`PROMPT_CHARS=['$','%','>','#',...]` 检测提示符） | 通用 tmux 会话注入 |
| clawhip discord watch | `src/discord_watch.rs`（Discord 消息 → `discord-watch.nudge-intent`，local-only 持久化，不进通用路由） | 接收侧旁路提醒 |

**关键差异（桥现状 vs 源码模式）**：① `!` 前缀强制门控（源码无此概念）② 新开 exec 会话（源码是注入运行中会话）③ 无用户白名单（源码有授权模型）

## Constraints
- **不改动 omx 和 clawhip 源码**——对齐全部在飞书桥内实现
- 消息注入策略：**白名单全注入**——白名单用户的所有消息默认注入 agent（含 omx `$关键词`，无需 `!` 前缀）；`!` 变为**可选**的显式指令标记（`!` 开头 = 强制按指令处理）
- 注入目标：**优先运行中会话**（对齐 reply-listener/deliver 语义，INJECT_MODE=deliver 时注入 tmux 会话），无运行中会话时**回退 exec**（codex/omx 模式）
- 非白名单用户消息：桥内配置决定（默认忽略，严格对齐 reply-listener 授权模型；可配开关保留 POST clawhip /event 普通事件）
- 白名单配置：环境变量（如 FEISHU_ALLOWED_OPEN_IDS），与现有 .env 风格一致
- 环境：Windows，Node 桥；保持 `node --check` 通过；保留现有 Sink（clawhip 投递 → 飞书）与 Source（飞书事件订阅）结构

## Non-Goals
- 不改 omx / clawhip / afirez/clawhip-feishu 任何源码
- 不引入 OpenClaw
- 不实现按钮交互/卡片回调（能力检查表已标 ❌/范围外）
- 不实际部署测试（代码+文档交付，用户自行验证）

## Acceptance Criteria
- [ ] `bridge/feishu-bridge.mjs` 更新：白名单机制（env 配置）、全注入逻辑（免前缀）、`!` 可选前缀、注入目标优先运行中会话（deliver）回退 exec、非白名单处理（默认忽略+可配）
- [ ] `docs/feishu-direct-bridge.md` 更新：新增「源码对齐」章节（真实模式 vs 现状差异表）、新配置项说明（白名单/注入策略/非白名单行为）、行为对照清单更新
- [ ] **行为对照清单**：每个对齐点（无前缀注入 ✅/白名单 ✅/运行中会话优先 ✅/exec 回退 ✅/非白名单默认忽略 ✅/`!` 可选标记 ✅）在代码与文档中可核验
- [ ] `node --check` 语法通过；omx/clawhip 源码零改动（git 状态或文件哈希确认未触碰）

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "对齐 Discord 真实场景"基准不清 | Round 1 问基准 | 以 omx/clawhip 源码为基准（用户指定） |
| 对齐产出形态不明 | Round 2 问产出 | 改桥代码 + 更新文档 |
| 注入策略未定 | Round 3 问策略 | 白名单全注入（免前缀），`!` 变可选标记 |
| 非白名单消息处理（保留 POST vs 忽略） | Round 4 逆反模式挑战 | 桥内配置决定：默认忽略（严格对齐 reply-listener 授权模型），可配保留 POST；**omx/clawhip 源码零改动** |

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| 飞书直桥 (bridge) | core domain | feishu-bridge.mjs、白名单、注入策略 | 对齐实施载体 |
| omx Reply Listener | reference | 授权白名单、sendToPane、轮询 | 对齐基准（只读） |
| clawhip deliver | reference | tmux 注入、PROMPT_CHARS | 对齐基准（只读） |
| Discord 真实模式 | concept | 免前缀、运行中会话注入、授权 | 对齐目标 |
| 白名单全注入 | mechanism | FEISHU_ALLOWED_OPEN_IDS | 桥内实现 |
| ! 可选前缀 | mechanism | COMMAND_PREFIX 可配 | 桥内实现 |
| 注入目标优先级 | mechanism | deliver（运行中）→ exec（回退） | 桥内实现 |
| 非白名单处理 | mechanism | 默认忽略，可配 POST | 桥内实现 |
| 源码对齐章节 | deliverable | 差异表+配置说明+对照清单 | 文档更新 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | 0 | - | - |
| 2 | 9 | 4 | 0 | 5 | 56% |
| 3 | 12 | 3 | 0 | 9 | 75% |
| 4 | 15 | 3 | 0 | 12 | 80% |

## Interview Transcript
<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** "对齐 Discord 真实使用场景"以哪个为基准？
**A:** 查 omx 和 clawhip 源码对齐（源码取证完成：reply-listener 授权注入/无前缀/deliver tmux 注入）
**Ambiguity:** 51% (Goal: 0.7, Constraints: 0.4, Criteria: 0.3)

### Round 2
**Q:** 源码对齐后的产出是什么？
**A:** 改桥代码 + 更新文档
**Ambiguity:** 32% (Goal: 0.85, Constraints: 0.65, Criteria: 0.5)

### Round 3
**Q:** 对齐后的消息注入策略？
**A:** 白名单全注入（免前缀，! 变可选标记；优先运行中会话，回退 exec）
**Ambiguity:** 22% (Goal: 0.9, Constraints: 0.8, Criteria: 0.6)

### Round 4
**Q:** 挑战假设：非白名单消息如何处理（保留 POST vs 忽略）？
**A:** 不改动 omx 和 clawhip 源码，飞书直桥对齐 discord 能力（桥内配置：默认忽略，可配保留 POST）
**Ambiguity:** 16% (Goal: 0.95, Constraints: 0.85, Criteria: 0.7)

</details>
