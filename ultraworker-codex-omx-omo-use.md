# Codex 使用 OMX 与 OMO 指南

> 基于当前机器安装状态整理：OMX catalog `2026.02.28.1`，OMO plugin `omo@4.19.4`。

## 结论

Codex 上的 OMX 和 OMO 都是“内部使用为主，外部 CLI 为辅”。

- 内部：在 Codex 会话里通过关键词、skills、hooks、agent 角色使用，不需要额外启动服务。
- 外部：用 `omx` 和 `omo` 命令做安装、诊断、团队、目标、状态等管理。

## OMX 在 Codex 内部怎么用

OMX 是 Codex 工作流层，当前已安装并激活相关 skills：

```text
$ultrawork 任务描述
$ultragoal 目标描述
$team 3:executor "任务"
$ralph "验证并修复"
$analyze 问题
$plan / $ralplan 任务
$code-review 变更
```

内部 agent 可以按角色调用，例如 `explore`、`analyst`、`planner`、`architect`、`debugger`、`executor`、`verifier`、`code-reviewer`、`researcher`、`critic`。它们在 `~/.codex/agents/` 中注册为原生 agent。

## OMX 在 Codex 外部怎么用

```bash
omx exec "执行任务"
omx setup
omx doctor
omx status
omx list
omx state write --input '{"mode":"ultrawork","active":true}' --json
omx team 3:executor "并行任务"
omx ultragoal create "目标"
omx ralph "持续验证循环"
```

`omx exec` 适合非交互执行，`omx team` 需要 tmux OMX CLI，`omx status` 用来查看当前激活模式。

## OMO 在 Codex 内部怎么用

OMO 已作为 Codex 插件安装，版本 `omo@4.19.4`，配置已启用：`/Users/afirez/.codex/config.toml`。它的 hooks、skills、agents、MCP 会在 Codex 会话内自动生效。

内部触发示例：

```text
$ultrawork 执行并给出证据
ulw 执行并给出证据
用 omo:debugging 排查这个问题
用 omo:programming 实现这个模块
用 omo:refactor 重构这段代码
用 omo:visual-qa 检查页面
```

内置技能包括 `omo:ultrawork`、`omo:ulw-loop`、`omo:debugging`、`omo:frontend`、`omo:programming`、`omo:refactor`、`omo:remove-ai-slops`、`omo:visual-qa`、`omo:review-work` 等。MCP 包括 `grep_app`、`context7`、`codegraph`、`git_bash`、`lsp`。

## OMO 在 Codex 外部怎么用

```bash
omo --help
omo doctor --platform=codex --status
omo config migrate
omo ulw-loop status --json
omo ulw-loop create-goals --brief "..."
omo ulw-loop record-evidence --goal-id <id> --criterion-id <id> --status pass --evidence "..."
omo ulw-loop checkpoint --goal-id <id> --status complete --evidence "..."
```

组件 CLI 也安装在 `~/.local/bin`：

```text
omo-rules
omo-lsp
omo-comment-checker
omo-ultrawork
omo-start-work-continuation
omo-telemetry
omo-git-bash-hook
lazycodex-executor-verify
ulw
ulw-loop
```

注意：`omo run` 是 OpenCode 宿主执行命令，不是 Codex 版 OMO 的执行入口。

## 验证证据

- `omx list`：目录 `2026.02.28.1`，Skills 50（28 active），Agents 34（20 active）。
- `omo doctor --platform=codex --status`：Codex `/usr/local/bin/codex`、Plugin `omo@4.19.4`、Config enabled，并列出全部 `omo-*` Bins 和 agents。
- `omx status`：本指南保存前已确认没有遗留 active 执行模式。
