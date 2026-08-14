# 用 OpenCode 复现 Claw Code 式重写流程（oh-my-claudecode + clawhip + oh-my-openagent）

> 基于一手证据核实：oh-my-claudecode / clawhip / oh-my-openagent 官方 README、本会话运行实例、claw-code 重写事件原始取证。
> 整理日期：2026-08-13

---

## 一、结论

**可以复现**——OpenCode 是这个生态的原生发源地（oh-my-openagent 前身即 oh-my-opencode），且当前环境本身就是实例（本会话 = OpenCode + oh-my-claudecode 插件）。唯一缺口是 clawhip 对 OpenCode 的原生 hook 支持，有两条补路可绕开。

## 二、三个组件的 OpenCode 适配现状

| 组件 | OpenCode 适配 | 证据 |
|---|---|---|
| **oh-my-claudecode** | ✅ 插件版存在 | 本会话即实例：`oh-my-claudecode_t_*` 工具 + `/team`、`/ultrawork`、`/ralph`、`/autopilot`、`/ulw-plan` 等命令全套可用（官方 README 主打 Claude Code，但 OpenCode 插件已可安装运行） |
| **oh-my-openagent** | ✅ 原生 | 前身即 oh-my-opencode，npm 包装进 `opencode.json`；LazyCodex 描述 "For your Codex, for your OpenCode" |
| **clawhip** | ⚠️ 半适配 | 已改名 **gajae-claw**（"control plane for agents"），原生 provider hooks 仅 **Codex + Claude（含 OMC/OMX wrapper）**；事件模型通用（typed envelopes + sources→queue→sinks），但 **OpenCode 无原生 provider hook** |

补充事实（本轮取证）：
- clawhip v0.3+ 的 provider-native hooks 只有两个：`clawhip native hook --provider codex`、`clawhip native hook --provider claude`；`clawhip deliver` 可识别 OMC/OMX wrapper 会话
- oh-my-claudecode 官方 README 对 opencode 仅 1 处提及（"Inspired by: oh-my-opencode"），仓库树中无 opencode 文件——OpenCode 插件版走独立分发渠道
- clawhip 现在的定位："gajae-claw (clawhip) is the control plane for agents: route events from GitHub, Discord, tmux, and other tools to the right human or agent"

## 三、逐环节复现对照表

| claw-code 流程环节 | OpenCode 栈对应 | 状态 |
|---|---|---|
| Discord 收指令/报进度 | clawhip sinks（discord）+ OMC `configure-notifications`（Discord/Telegram/Slack）或 OpenClaw 网关 | ✅ |
| 一句话 → 结构化工作流 | OMC `$ultrawork` / `$plan` / `deep-interview` | ✅ 原生 |
| 多 agent 并行（$team） | OMC `$team` on OpenCode（并行 subagent 线程） | ✅ 原生 |
| 持续执行+验证循环（$ralph） | OMC `$ralph` / `$ultragoal` / ultraqa 验证循环 | ✅ 原生 |
| 角色分工（Architect/Executor/Reviewer） | OMC `$architect`/`$executor` + OmO 分歧收敛 | ✅ 原生 |
| 并行 lane（隔离分支） | git 分支隔离——harness 无关 | ✅ |
| 批量合并 | git merge 脚本——harness 无关 | ✅ |
| 通知路由出上下文 | clawhip 守护进程 | ⚠️ 需适配（见下） |
| 卡死恢复/事件追踪 | OMC hooks + clawhip sources（git/tmux） | ✅/⚠️ |

## 四、唯一缺口：clawhip 的 OpenCode 接入（两条补路）

```bash
# clawhip 现有原生 hook（只有 Codex + Claude）
clawhip native hook --provider codex --file payload.json
clawhip native hook --provider claude --file payload.json
```

**补路 1：桥接脚本** —— OpenCode 自身有 hooks 系统（`session.idle`、`notification` 等事件）→ 写小脚本把事件转成 clawhip 的 typed envelope 灌进 daemon queue（clawhip 的 sources 模型可扩展）。

**补路 2：替代方案** —— 跳过 clawhip 的通知职责，用 **OMC 自带 `configure-notifications`**（Discord/Telegram/Slack webhook）+ **OpenClaw 网关**（GJC Coordinator MCP bridge 模式同样适用 OMC，OMC 生态本有 openclaw-integration 文档）。

## 五、实操复现配方

```
1. 安装：OpenCode CLI + oh-my-claudecode 插件（= 当前这套）
   bunx oh-my-openagent install      # OmO 装进 opencode.json
   npm i -g clawhip                  # 或 gajae-claw，启动守护进程

2. 配置：
   ~/.clawhip/config.toml            # routes: git/github 事件 → Discord
   /setup + /omc-setup               # OMC 初始化
   /oh-my-claudecode:configure-notifications   # 或接 OpenClaw

3. 执行重写（复刻 claw-code 流程）：
   $team "rewrite X"                 # 拆 lane、并行 agent
   $ralph "verify until green"       # 验证循环
   $ultragoal "…"                    # 完成判定 + ledger
   git merge --no-ff（批量合 lane）  # 脚本化合并
   clawhip / notifications           # 进度推 Discord，人睡觉
```

## 六、诚实结论

- **流程层面**：完全可复现。$team 并行 lane、$ralph 验证循环、Architect/Executor/Reviewer 分工、通知外置——这些模式与底层 CLI 无关，OpenCode 上 OMC + OmO 是原生级实现，且比 3-31 当天用的 OmX-on-Codex 更新（OMC 38.5K⭐、OmO 67.8K⭐ 持续演进中）
- **组件层面**：clawhip 需要一个适配器（或直接用 OMC 通知 + OpenClaw 替代）；其余零改造
- **最大差异**：claw-code 的 lane 基础设施（task packets、lane lineage、branch-lock）是他们在 Rust 版里自己建进运行时的；用现成 OMC/OmO 拿到的是一般化的 lane 能力，**无需自己造**——除非要复刻"让仓库对 agent 自治友好"那一层，那才是 claw-code 真正独有的部分
