# Deep Interview Spec: 飞书/OpenClaw 替换 Discord 的可行性评估与部署实施方案

## Metadata
- Interview ID: di-feishu-openclaw-20260814
- Rounds: 4
- Final Ambiguity Score: 11%
- Type: greenfield（知识研究 + 部署方案）
- Generated: 2026-08-14
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.95 | 0.40 | 0.38 |
| Constraint Clarity | 0.85 | 0.30 | 0.26 |
| Success Criteria | 0.85 | 0.30 | 0.26 |
| **Total Clarity** | | | **0.89** |
| **Ambiguity** | | | **11%** |

## Goal
产出一份中文文档：对 **oh-my-codex + clawhip + Discord** 工具链，评估"飞书替换 Discord"与"OpenClaw 替换 Discord"的可行性，并按**双层理解**给出**实际部署级**实施步骤：
- **界面层替换（飞书）**：人类收发消息的渠道从 Discord 换成飞书
- **路由层替换（OpenClaw）**：OpenClaw 替换 clawhip 的路由角色，并原生支持飞书渠道

## Constraints
- 范围：以 oh-my-codex + clawhip + discord 链为主；oh-my-claudecode / oh-my-openagent 仅作附注
- 深度：实际部署级——Windows 环境可跑通的完整配置（命令 + 配置文件示例）
- 语言：中文
- 已查证事实（作为文档论据，勿重复调研）：
  - clawhip / oh-my-codex / oh-my-claudecode 仓库中均无 feishu/lark 支持（源码 grep 0 命中）
  - OpenClaw 官方支持飞书：`@openclaw/feishu` 插件（需 OpenClaw ≥ 2026.5.29）+ 飞书官方 larksuite/openclaw-lark 插件（需 ≥ 2026.2.26）；`openclaw channels login --channel feishu`；支持 bot 私聊/群聊/流式卡片/doc/wiki/drive/Bitable 工具
  - oh-my-codex 通知渠道：Discord / Telegram / Slack / webhook + OpenClaw 网关（`OMX_OPENCLAW=1`、`notifications.openclaw` schema、`custom_webhook_command`/`custom_cli_command` 通用别名）
  - clawhip sink：Discord / Slack / local_file + 通用网关别名（custom_webhook_command / custom_cli_command）；事件模型为 typed envelopes（sources→queue→dispatcher→router→render→sink）

## Non-Goals
- 不评估 Telegram/WhatsApp 等渠道的完整对比（仅提及）
- 不实际部署测试（文档给步骤，用户自行执行）
- 不涉及 claw-code 重写历史

## Acceptance Criteria
- [ ] 可行性评估表：每条路径（飞书直桥 / OpenClaw 网关）含 结论 + 证据 + 能力缺口对比
- [ ] 实施步骤可运行：clawhip config.toml 路由配置、omx notifications 配置、OpenClaw 飞书渠道配置、飞书自定义机器人 webhook 桥接脚本，命令完整可执行
- [ ] 双层理解贯穿：界面层（飞书）与路由层（OpenClaw）两条路径清晰区分且都给出实施
- [ ] 附注：oh-my-claudecode / oh-my-openagent 的对应能力一行带过
- [ ] 源码/文档引用真实（基于已克隆仓库与官方文档）

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 交付形态不明 | Round 1 问目标 | 评估 + 实施写进一份文档 |
| 范围不清 | Round 2 问覆盖 | 只评估 omx+clawhip+discord 链，其他工具附注 |
| 实施深度不明 | Round 3 问深度 | 实际部署级（可跑通配置） |
| "OpenClaw 替换 Discord"理解有误（OpenClaw 是网关非聊天 App） | Round 4 逆反模式挑战 | 双层理解：飞书=界面层替换，OpenClaw=路由层替换 |

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| oh-my-codex (OmX) | core domain | 通知渠道（Discord/Telegram/Slack/webhook/OpenClaw 网关） | 工作流层，宿主 Codex CLI |
| clawhip | core domain | sinks（Discord/Slack/localfile）、routes、typed envelopes | 路由层 |
| Discord | channel | 人类界面 | 被替换对象 |
| 飞书 (Feishu/Lark) | channel | 自定义机器人 webhook、OpenClaw 渠道 | 界面层替换者 |
| OpenClaw | gateway | 29 渠道、@openclaw/feishu 插件、Coordinator MCP bridge | 路由层替换者 |
| 界面层替换 | concept | 飞书替代 Discord 收发消息 | 实施路径 1 |
| 路由层替换 | concept | OpenClaw 替代 clawhip 路由角色 | 实施路径 2 |
| 可行性评估 | deliverable | 结论+证据+缺口 | 文档前半 |
| 部署实施 | deliverable | 命令+配置示例 | 文档后半 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 6 | 6 | 0 | - | - |
| 2 | 8 | 2 | 0 | 6 | 75% |
| 3 | 10 | 2 | 0 | 8 | 80% |
| 4 | 13 | 3 | 0 | 10 | 77% |

## Interview Transcript
<details>
<summary>Full Q&A (4 rounds)</summary>

### Round 1
**Q:** 你最终想要什么成果？
**A:** 评估 + 实施都写（一份文档）
**Ambiguity:** 61% (Goal: 0.6, Constraints: 0.3, Criteria: 0.2)

### Round 2
**Q:** 文档覆盖哪条工具链？
**A:** 只评估 oh-my-codex + clawhip + discord 链，其他工具作附注
**Ambiguity:** 43% (Goal: 0.75, Constraints: 0.55, Criteria: 0.35)

### Round 3
**Q:** 实施方案的深度要求？
**A:** 实际部署级（可跑通的完整配置）
**Ambiguity:** 24% (Goal: 0.85, Constraints: 0.7, Criteria: 0.7)

### Round 4
**Q:** 挑战假设："OpenClaw 替换 Discord"是否按双层理解（飞书=界面层，OpenClaw=路由层）写？
**A:** 是，双层理解（两条路径都写进实施）
**Ambiguity:** 11% (Goal: 0.95, Constraints: 0.85, Criteria: 0.85)

</details>
