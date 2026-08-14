# 📄 文档 1 — PHILOSOPHY.md（Claw Code Philosophy）

**来源**：https://raw.githubusercontent.com/ultraworkers/claw-code-parity/master/PHILOSOPHY.md

## 原文（Original）

# Claw Code Philosophy

## Stop Staring at the Files

If you only look at the generated files in this repository, you are looking at the wrong layer.

The Python rewrite was a byproduct. The Rust rewrite was also a byproduct. The real thing worth studying is the **system that produced them**: a clawhip-based coordination loop where humans give direction and autonomous claws execute the work.

Claw Code is not just a codebase. It is a public demonstration of what happens when:

- a human provides clear direction,
- multiple coding agents coordinate in parallel,
- notification routing is pushed out of the agent context window,
- planning, execution, review, and retry loops are automated,
- and the human does **not** sit in a terminal micromanaging every step.

## The Human Interface Is Discord

The important interface here is not tmux, Vim, SSH, or a terminal multiplexer.

The real human interface is a Discord channel.

A person can type a sentence from a phone, walk away, sleep, or do something else. The claws read the directive, break it into tasks, assign roles, write code, run tests, argue over failures, recover, and push when the work passes.

That is the philosophy: **humans set direction; claws perform the labor.**

## The Three-Part System

### 1. OmX (`oh-my-codex`)
[oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) provides the workflow layer.

It turns short directives into structured execution:
- planning keywords
- execution modes
- persistent verification loops
- parallel multi-agent workflows

This is the layer that converts a sentence into a repeatable work protocol.

### 2. clawhip
[clawhip](https://github.com/Yeachan-Heo/clawhip) is the event and notification router.

It watches:
- git commits
- tmux sessions
- GitHub issues and PRs
- agent lifecycle events
- channel delivery

Its job is to keep monitoring and delivery **outside** the coding agent's context window so the agents can stay focused on implementation instead of status formatting and notification routing.

### 3. OmO (`oh-my-openagent`)
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) handles multi-agent coordination.

This is where planning, handoffs, disagreement resolution, and verification loops happen across agents.

When Architect, Executor, and Reviewer disagree, OmO provides the structure for that loop to converge instead of collapse.

## The Real Bottleneck Changed

The bottleneck is no longer typing speed.

When agent systems can rebuild a codebase in hours, the scarce resource becomes:
- architectural clarity
- task decomposition
- judgment
- taste
- conviction about what is worth building
- knowing which parts can be parallelized and which parts must stay constrained

A fast agent team does not remove the need for thinking. It makes clear thinking even more valuable.

## What Claw Code Demonstrates

Claw Code demonstrates that a repository can be:

- **autonomously built in public**
- coordinated by claws/lobsters rather than human pair-programming alone
- operated through a chat interface
- continuously improved by structured planning/execution/review loops
- maintained as a showcase of the coordination layer, not just the output files

The code is evidence.
The coordination system is the product lesson.

## What Still Matters

As coding intelligence gets cheaper and more available, the durable differentiators are not raw coding output.

What still matters:
- product taste
- direction
- system design
- human trust
- operational stability
- judgment about what to build next

In that world, the job of the human is not to out-type the machine.
The job of the human is to decide what deserves to exist.

## Short Version

**Claw Code is a demo of autonomous software development.**

Humans provide direction.
Claws coordinate, build, test, recover, and push.
The repository is the artifact.
The philosophy is the system behind it.

## Related explanation

For the longer public explanation behind this philosophy, see:

- https://x.com/realsigridjin/status/2039472968624185713

---

## 中文翻译（Translation）

# Claw Code 哲学

## 别盯着文件看

如果你只看这个仓库里生成的文件，那你是在看错误的层面。

Python 重写是副产品。Rust 重写也是副产品。真正值得研究的是**产出它们的那套系统**：一个基于 clawhip 的协调循环——人类给出方向，自主的 claws 执行工作。

Claw Code 不只是一个代码库。它是一个公开的示范，展示当以下条件同时成立时会发生什么：

- 人类提供清晰的方向，
- 多个编码智能体并行协调，
- 通知路由被移出智能体的上下文窗口，
- 规划、执行、审查和重试循环被自动化，
- 人类**不**坐在终端前对每一步进行微观管理。

## 人类界面是 Discord

这里重要的界面不是 tmux、Vim、SSH 或终端复用器。

真正的人类界面是一个 Discord 频道。

一个人可以用手机打出一句话，然后走开、睡觉或去做别的事。claws 读取指令，把任务拆解、分配角色、写代码、跑测试、为失败争论、恢复，并在工作通过检查后推送。

这就是这套哲学：**人类设定方向；claws 承担劳动。**

## 三部分系统

### 1. OmX（`oh-my-codex`）
[oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) 提供工作流层。

它把简短的指令转化为结构化的执行：
- 规划关键词
- 执行模式
- 持续验证循环
- 并行多智能体工作流

这一层负责把一句话转化为可重复的工作协议。

### 2. clawhip
[clawhip](https://github.com/Yeachan-Heo/clawhip) 是事件与通知路由器。

它监视：
- git 提交
- tmux 会话
- GitHub issue 和 PR
- 智能体生命周期事件
- 频道投递

它的职责是把监控和投递保持在编码智能体的上下文窗口**之外**，这样智能体可以专注于实现，而不是状态格式化和通知路由。

### 3. OmO（`oh-my-openagent`）
[oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) 处理多智能体协调。

跨智能体的规划、交接、分歧解决和验证循环都在这里发生。

当 Architect、Executor 和 Reviewer 意见不一致时，OmO 提供让这个循环收敛而非崩溃的结构。

## 真正的瓶颈已经改变

瓶颈不再是打字速度。

当智能体系统可以在数小时内重建一个代码库时，稀缺资源变成了：
- 架构清晰度
- 任务拆解能力
- 判断力
- 品味
- 对什么值得构建的信念
- 知道哪些部分可以并行、哪些部分必须保持约束

一支快速的智能体团队并不会消除思考的需要。它让清晰的思考变得更有价值。

## Claw Code 展示了什么

Claw Code 展示了仓库可以：

- **在公众面前自主构建**
- 由 claws/lobsters 协调，而非仅靠人类结对编程
- 通过聊天界面操作
- 通过结构化的规划/执行/审查循环持续改进
- 作为协调层的展示品来维护，而不只是输出文件

代码是证据。
协调系统才是产品层面的经验教训。

## 什么仍然重要

随着编码智能越来越便宜、越来越普及，持久的差异化因素不是原始的编码产出。

仍然重要的是：
- 产品品味
- 方向
- 系统设计
- 人类信任
- 运营稳定性
- 对接下来该构建什么的判断

在那个世界里，人类的工作不是打字快过机器。
人类的工作是决定什么值得存在。

## 简版

**Claw Code 是一个自主软件开发的演示。**

人类提供方向。
Claws 协调、构建、测试、恢复并推送。
仓库是产物。
哲学是背后的系统。

## 相关说明

关于这套哲学更长的公开解释，见：

- https://x.com/realsigridjin/status/2039472968624185713
