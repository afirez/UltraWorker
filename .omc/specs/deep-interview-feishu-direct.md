# Deep Interview Spec: 飞书直接替换 Discord（不通过 OpenClaw）——自建桥接实施方案

## Metadata
- Interview ID: di-feishu-direct-20260814
- Rounds: 4
- Final Ambiguity Score: 13%
- Type: greenfield（部署实施方案）
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
产出一份**独立新文档**（中文）：在 oh-my-codex + clawhip + Discord 工具链中，用**飞书直接替换 Discord**（**不通过 OpenClaw**），实现**双向交互、对齐 Discord 能力**（人类在飞书发指令给 agent + agent 状态推回飞书）。核心是**自建轻量桥接服务**：飞书 websocket 事件订阅 → 解析指令 → 调 omx/codex 执行 → 结果推回飞书；发送方向复用 clawhip 路由。实际代码基于 **https://github.com/afirez/clawhip-feishu** 修改，文档给出完整代码与部署步骤。

## Constraints
- 工具链：oh-my-codex（宿主 Codex CLI）+ clawhip（通知路由）+ 飞书（替换 Discord）
- **排除 OpenClaw**（不使用其网关/渠道）
- 交互：双向（飞书 → agent 指令注入；agent → 飞书状态推送）
- 接收端形态：**自建轻量桥接服务**（Node 常驻进程，基于 afirez/clawhip-feishu 修改）
  - 已核实基础仓库：afirez/clawhip-feishu（2026-08-07，JavaScript，10 文件：`feishu-bridge.mjs`、`clawhip.config.example.toml`、`.omx/hooks/clawhip.mjs`、`.env.example`、`package.json`）
- 飞书侧：自建应用机器人 + 事件订阅（`im.message.receive_v1`，websocket 模式）
- 发送侧：复用 clawhip 路由（`RouteRule.webhook` 透传）或桥接服务直推飞书 API
- 环境：Windows；部署步骤含命令与配置示例
- 验收核心：**能力对齐检查表**（对照 Discord 场景逐项标注飞书方案实现方式与支持度）

## Non-Goals
- 不涉及 OpenClaw 任何方案（含其飞书渠道）
- 不评估其他渠道（Telegram/WhatsApp 等）
- 不实际部署测试（文档给完整代码+步骤，用户自行执行）
- 不涉及 claw-code 重写历史

## Acceptance Criteria
- [ ] **能力对齐检查表**：对照 Discord 场景（发指令/收推送/@回复/线程/进群策略/富文本）逐项标注飞书方案的实现方式与支持度
- [ ] **完整可运行代码**：基于 afirez/clawhip-feishu 修改的桥接服务（feishu 事件订阅接收 + 指令注入 omx/codex + 结果回推），代码完整可照抄执行
- [ ] **发送链路**：agent 状态 → omx 通知/clawhip 路由 → 飞书 API 的配置（含 clawhip config.toml 路由示例）
- [ ] **部署步骤**：飞书自建应用创建（权限/事件订阅/websocket）、环境变量、Windows 启动/常驻方案
- [ ] 引用真实（afirez/clawhip-feishu 实际文件结构、clawhip/omx 源码机制）

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 与已有文档的关系不明 | Round 1 问交付关系 | 独立新文档，深挖直桥 |
| 替换所需交互深度不明 | Round 2 问交互方向 | 双向交互，对齐 Discord 能力 |
| "对齐 Discord"不可验证 | Round 3 问验收标准 | 能力对齐检查表 |
| "不通过 OpenClaw"隐藏网关成本 | Round 4 逆反模式挑战 | 自建轻量桥接服务（Node），基于 afirez/clawhip-feishu 修改，发送复用 clawhip 路由 |

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| oh-my-codex (OmX) | core domain | 通知渠道、hooks | 工作流层，宿主 Codex CLI |
| clawhip | core domain | RouteRule.webhook、sinks | 发送路由层（复用） |
| Discord | channel | 被替换对象 | 人类界面 |
| 飞书 (Feishu/Lark) | channel | 自建应用机器人、事件订阅 | 界面层替换者 |
| 自建轻量桥接服务 | core domain | feishu-bridge.mjs、websocket 订阅、指令解析、exec 注入 | 接收路径核心 |
| afirez/clawhip-feishu | external system | 基础代码仓库（10 文件） | 桥接服务改造基础 |
| 事件订阅 im.message.receive_v1 | mechanism | websocket 模式 | 飞书→桥接服务 |
| omx/codex 执行注入 | mechanism | exec 调用 | 桥接服务→agent |
| 能力对齐检查表 | deliverable | Discord 场景×实现方式×支持度 | 验收核心 |
| 部署步骤 | deliverable | 应用创建/环境变量/常驻 | 文档后半 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 5 | 5 | 0 | - | - |
| 2 | 9 | 4 | 0 | 5 | 56% |
| 3 | 10 | 1 | 0 | 9 | 90% |
| 4 | 15 | 5 | 0 | 10 | 67% |

## Interview Transcript
<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** 交付物与已有文档（feishu-openclaw-replace-discord.md）的关系？
**A:** 独立新文档，深挖直桥（不涉及 OpenClaw）
**Ambiguity:** 56% (Goal: 0.65, Constraints: 0.35, Criteria: 0.25)

### Round 2
**Q:** "替换 Discord"需要哪些交互能力？
**A:** 双向交互，对齐 Discord 的能力
**Ambiguity:** 40% (Goal: 0.8, Constraints: 0.6, Criteria: 0.35)

### Round 3
**Q:** "对齐 Discord 能力"的验收标准？（可多选）
**A:** 能力对齐检查表
**Ambiguity:** 26% (Goal: 0.85, Constraints: 0.65, Criteria: 0.7)

### Round 4
**Q:** 挑战假设：排除 OpenClaw 后接收端必须自己造网关组件，选什么形态？
**A:** 自建轻量桥接服务（Node 常驻）：飞书 websocket 事件订阅 → 解析指令 → 调 omx/codex 执行 → 推回飞书；发送复用 clawhip 路由；代码基于 afirez/clawhip-feishu 修改
**Ambiguity:** 13% (Goal: 0.9, Constraints: 0.85, Criteria: 0.85)

</details>
