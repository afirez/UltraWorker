# Claude Code 使用 OMC 与 OMO 指南

> 基于当前机器实际安装状态整理：Claude Code 2.1.232，OMC 4.15.10，OMO 未作为 Claude Code 原生插件安装。

## 当前安装状态

- Claude Code：已安装，版本 `2.1.232`，路径 `/Users/afirez/.local/bin/claude`
- OMC：已作为 Claude Code 插件安装，版本 `4.15.10`
- OMO：没有作为 Claude Code 原生插件安装

## OMC 在 Claude Code 里怎么用

OMC 插件来自 `Yeachan-Heo/oh-my-claudecode`。

会话内直接使用：

```text
/team 3:executor "任务"
/ultrawork 任务
/ralph 验证并修复
/autopilot 任务
/ralplan 规划
/deep-interview 澄清需求
/ultragoal 目标
/ultraqa 质量验证
```

其中 `/team` 的会话内团队需要 Claude Code 原生 teams：

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

OMC 当前插件包含 19 个 agent 定义：`analyst`、`architect`、`code-reviewer`、`code-simplifier`、`critic`、`debugger`、`designer`、`document-specialist`、`executor`、`explore`、`git-master`、`planner`、`qa-tester`、`scientist`、`security-reviewer`、`test-engineer`、`tracer`、`verifier`、`writer`。

## OMC 的 CLI 入口

`omc` 不在当前 PATH 中，但插件自带 CLI 可以这样调用：

```bash
node /Users/afirez/.claude/plugins/cache/omc/oh-my-claudecode/4.15.10/bin/oh-my-claudecode.js --help
```

主命令包括：

```text
omc setup
omc install
omc doctor
omc team
omc hud
omc ultragoal
omc ask
omc config
omc session
```

如果全局安装 CLI，包名是 `oh-my-claude-sisyphus`：

```bash
npm install -g oh-my-claude-sisyphus
omc team 2:codex "任务"
omc team status <team>
omc team shutdown <team>
```

## OMO 在 Claude Code 里怎么用

当前机器没有 OMO 的 Claude Code 插件。`~/.claude/plugins` 中只有 `oh-my-claudecode@omc`，没有 `omo` 或 `oh-my-openagent` 插件。

OMO 的“Claude Code 兼容层”是反过来使用的：OMO 在 OpenCode 中加载 Claude Code 的 hooks、commands、skills、agents、MCPs，不是 Claude Code 原生加载 OMO。

结论：

- Claude Code 上现在可用的是 OMC。
- OMO 在 Claude Code 上没有原生插件；要使用 OMO，应到 OpenCode 或 Codex 环境，或在 OpenCode 中通过 OMO 的 Claude Code 兼容层读取 `.claude` 配置。

## 验证证据

- `claude --version`：`2.1.232`
- `~/.claude/plugins/installed_plugins.json`：只有 `oh-my-claudecode@omc` v4.15.10
- OMC marketplace 来自 `github.com/Yeachan-Heo/oh-my-claudecode.git`
- OMC CLI `--help` 已实际运行并列出 `setup/install/doctor/team/hud/ultragoal/ask` 等命令
- `~/.claude/plugins` 中没有 OMO/`oh-my-openagent` 插件
