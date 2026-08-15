# UltraWorker 工具链使用总览：OMX / OMC / OMO / clawhip

> 汇总日期：2026-08-15（基于本机安装实测 + Sigrid Jin Claw Code 重写工作流取证）
> 关联文档：`claw-code-rewrite-workflow.md` · `docs/OVERVIEW.md` · `docs/oh-my-codex.md` · `docs/oh-my-claudecode.md` · `docs/oh-my-openagent.md` · `docs/clawhip.md`

## 一、codex：OMX + OMO

### OMX（oh-my-codex v0.20.5）✅ 已装

**关键词路由**（提示词里直接打）：

```
$architect  架构咨询        $plan / $ralplan  规划（访谈收敛）
$executor   聚焦执行        $deep-interview   苏格拉底需求澄清
$analyze    只读深度分析    $ralph            自循环直到验证完成
$team       并行多 agent    $code-review      代码评审
$ai-slop-cleaner           清理 AI 味代码
```

**CLI**：`omx`（tmux 会话）/ `omx exec "任务"`（非交互）/ `omx mission <file>` / `omx team` / `omx resume` / `omx sparkshell` / `omx doctor`

**角色**：`~/.codex/agents/` 20+ 个 TOML（architect/executor/planner/code-reviewer/debugger/designer/critic/metis/momus/librarian/explore…）

**状态**：`.omx/state/`

### OMO（omo@sisyphuslabs 4.19.4 Light）✅ 已装

**关键词**：`ultrawork` / `ulw`（执行指令注入：目标+3+ QA 场景+手动 QA 渠道+notepad+原子 todo）、`ulw-plan`（访谈式计划）、`ulw-research`（饱和研究）

**CLI**：`omo ulw-loop create-goals|status|checkpoint|steer|record-evidence`、`ulw` 快捷入口，状态存 `.omo/ulw-loop/`

**自动 hooks**（22 个）：session-start 载规则 / tool-use 查注释与 LSP / stop 自动续跑

**角色**：`lazycodex-code-reviewer`、`lazycodex-qa-executor`、`lazycodex-gate-reviewer`（binding 裁决）、`lazycodex-worker-{low,medium,high}`

**安装/更新**（注意 PATH 遮蔽坑）：

```bash
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.bun/bin"
npx lazycodex-ai install --no-tui --no-codex-autonomous
# 装完须同步 cc-switch（kill app → 更新 settings.common_config_codex → 重启）
```

---

## 二、opencode：OMC + OMO

### OMC（oh-my-claudecode）✅ 自动注入

**形态**：`~/.claude/CLAUDE.md` 每会话自动加载编排指令（含委派规则/模型路由/验证门禁）

**关键词**：`autopilot`、`ralph`、`ulw`/`ultrawork`、`ccg`（三模型编排）、`ralplan`、`deep interview`、`deep-analyze`、`tdd`、`deepsearch`、`ultrathink`、`cancelomc`

**斜杠命令**：`/oh-my-claudecode:team|ralph|ultrawork|ultraqa|autopilot|deep-interview|omc-plan|wiki|skill|doctor|trace|self-improve|omc-teams|ccg…`

**技能**：`omc-reference`（编排目录，自动加载）、`skills-creator`（中文技能创建）

### OMO（oh-my-openagent 完整版）✅ 当前主控

**形态**：opencode 插件（`opencode.json` → `oh-my-openagent@latest`），Sisyphus 主 agent

**直接用**：说需求即可——自动并行调度子 agent（oracle/librarian/explore/prometheus/metis/momus/atlas/sisyphus-junior）+ 类别路由模型（visual→claude-opus-5、ultrabrain→gpt-5.6-sol、quick→qwen3.6-flash…）

**$命令**：`$plan`（Prometheus 访谈规划）、`$ralph`、`$team`（tmux 并行）、`$architect`、`$executor`

**配置**：`~/.omo/omo.jsonc`（11 agent 模型链 + categories 路由；当前全链以 `opencode-go/deepseek-v4-flash` 为首选，reasoning 随模型对齐），改完重启生效

---

## 三、claude code：OMC + OMO

### OMC（oh-my-claudecode 4.15.10）✅ 已装

装于 `~/.claude/plugins/cache/omc/oh-my-claudecode/4.15.10`（市场 `omc`）

**斜杠命令**（29 个）：

```
/omc-setup  /omc-doctor  /ccg  /omc-teams  /ralph  /ultrawork  /ultraqa
/autopilot  /deep-dive  /deepinit  /wiki  /skill  /skillify  /learner
/trace  /verify  /self-improve  /sciomc  /ask  /release  /psm  /remember
/mcp-setup  /hud  /debug  /compact  /external-context  /visual-verdict  /writer-memory
```

**关键词**：同 opencode（autopilot/ralph/ulw/ccg/ralplan/deep interview/tdd/deepsearch/ultrathink/cancelomc）

**技能**：`~/.claude/skills/`（omc-reference、skills-creator）

### OMO ❌ 无官方版

`--platform` 仅支持 opencode/codex/both。Claude Code 侧替代：**OMC 即对等物**（同理念编排层）；OMO 的共享技能（`~/.claude/skills/`）在 Claude Code 同样可加载。

---

## 四、Sigrid Jin 团队怎么用（omx/omc/omo + clawhip）

### 核心工作流：Discord 一句话 → 结构化多 agent 流水线

> 在 Discord 输入 `$team "implement the core runtime"` → OmX 把一句话转化为结构化多步骤工作流并分派出去

```
1. 人类（架构师角色）定目标/约束/边界 —— "知道要构建什么"
2. $plan / $deep-interview  收敛需求 → 拆解成 agent 可执行任务
3. $team 多 agent 并行 lane（git 分支隔离：rcc/*、ultraclaw/*）
4. agent 独立执行 + $ralph 验证循环（持续执行直到验证通过）
5. 批量合并 lane（git merge 脚本，六秒级批量合并）
6. clawhip 全程路由事件：Discord 收指令/报进度/审批分离
```

### 工具分工

| 工具 | 在 Sigrid 流水线里的角色 |
|---|---|
| **OMX**（主力） | 工作流层：`$architect`/`$executor`/`$plan`/`$ralph`/`$team` 一句话→多步工作流 |
| **clawhip** | **control plane**：GitHub/Discord/tmux 事件→类型化信封→路由给正确的人或 agent；分离"可自动执行"与"需人工批准"（GAJAE 审批路由）；唯一跨宿主组件（同时挂 Codex + Claude） |
| **OMC** | Claude 侧团队编排（`/team` 5 阶段管线：plan→prd→exec→verify→fix）；与 OMX 同源概念（ralph/ultrawork/ultragoal/team/ralplan/deep-interview 六组同名同构） |
| **OMO** | OpenCode 原生宿主版；Team Mode 8 成员并行 + OpenClaw 外联 + reply-listener 回写 tmux |

### 三个关键事实（调研结论）

1. **lane 基础设施是自建的**：task packets、lane lineage、branch-lock 是他们在 Rust 版运行时里自己建的（`docs/roadmap-*` 分支），现成 OMC/OmO 拿到的是通用并行能力，不需复刻那层
2. **并行 lane 与 harness 无关**：git 分支隔离 + 脚本化批量合并，任何编排层都能复现
3. **60 分钟移植整个代码库**：瓶颈不在写代码——"Python 文件只是证据"；贵的是架构决策、任务拆解、并行协调（人类做，agent 干活）

### 复刻配方

```
1. 安装：bunx oh-my-openagent install + npm i -g clawhip（或 gajae-claw）
2. 配置：~/.clawhip/config.toml（git/github 事件 → Discord）；/setup + /omc-setup
3. 跑：Discord 发 "$team 重写 X" → lane 并行 → 批量 merge → $ralph 验证
```

---

## 五、速查矩阵

| 需求 | codex | opencode | claude code |
|---|---|---|---|
| 深度规划 | `$plan` / `ulw-plan` | `$plan` / `/deep-interview` | `/deep-dive` |
| 并行执行 | `$team` / `ultrawork` | `$team` / `ultrawork` | `/omc-teams` |
| 需求澄清 | `$deep-interview` | `/deep-interview` | `/deep-interview` |
| 代码评审 | `$code-review` / lazycodex-reviewer | `/review-work` | `/verify` |
| 健康检查 | `omx doctor` | `/oh-my-claudecode:doctor` | `/omc-doctor` |
| 状态存储 | `.omx/` + `.omo/` | `.omo/`（opencode） | `~/.claude/` 插件区 |

**一句话总结 Sigrid 模式**：人类定架构和约束，编排层（omx/omc/omo 任选其一）把一句话拆成并行 lane 派给 agent，clawhip 管事件路由和审批，六秒批量合并 + 验证循环收尾——工具是手段，lane 思维和架构拆解才是产出效率的根源。
