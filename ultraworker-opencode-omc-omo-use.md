# OpenCode 使用 OMC 与 OMO 指南

> 基于当前机器实际安装状态整理：OpenCode 1.18.18，OMO 插件 `oh-my-openagent@latest`，OMC 当前未安装。

## 结论

当前机器上：

- OMO：已经在 OpenCode 里启用，可以直接用。
- OMC：没有在当前 OpenCode 配置或 PATH 中启用，`omc` 命令也不存在，因此“当前这台机器”还不能直接使用 OMC。

## 当前 OpenCode 配置

OpenCode 已安装：`/usr/local/bin/opencode`，版本 `1.18.18`。

全局配置只启用了 OMO 插件：

```json
{
  "plugin": [
    "oh-my-openagent@latest"
  ]
}
```

## OMO 在 OpenCode 里怎么用

进入 OpenCode TUI：

```bash
opencode
```

然后直接在会话里输入关键词：

```text
ultrawork 做这件事
ulw 做这件事
```

OMO 的内置 Agent 在 OpenCode 中这样调用：

```text
Tab 切换 primary agent：Sisyphus / Hephaestus / Prometheus / Atlas
@oracle
@librarian
@explore
@metis
@momus
@multimodal-looker
@sisyphus-junior
```

OpenCode 外部可以这样启动 OMO 会话：

```bash
opencode run "任务"
opencode run --agent Sisyphus "任务"
opencode run --agent Hephaestus "任务"
opencode agent list
opencode plugin oh-my-openagent@latest
```

已安装的 `omo` CLI 也可以跑 OpenCode 执行：

```bash
omo run "Fix the bug"
omo run --agent Sisyphus "Implement feature X"
omo run --json "任务"
```

`omo run` 就是 OpenCode 宿主入口，会等待 todos 和后台任务完成。

## OMC 在 OpenCode 里怎么用

当前状态是“不能用，因为没安装”：

- `omc` 命令不存在：`omc not found`
- `~/.config/opencode/opencode.json` 中没有 `oh-my-claudecode` 插件
- 仓库参考文档也明确说明 OMC 上游仓库没有原生 OpenCode 插件代码

如果想在 OpenCode 上用 OMC，需要先解决安装问题，例如独立分发版插件或 `omc team` CLI。按参考文档，若 OMC 已可用，会话内入口是：

```text
/team 3:executor "任务"
/ultrawork 任务
/ralph 验证并修复
/autopilot 任务
```

## 验证证据

- `opencode --version`：`1.18.18`
- `~/.config/opencode/opencode.json`：只有 `oh-my-openagent@latest`
- `which omc`：`omc not found`
- 仓库内存在 `.omc/specs/` 和 `.omo/`，说明此前 OpenCode 会话留下过 OMC/OMO 工作产物，但不等于当前机器已安装 OMC 运行时
