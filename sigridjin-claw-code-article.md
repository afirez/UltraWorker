# 📄 文档 2 — X Article 长文（Sigrid Jin）

**来源**：https://x.com/realsigridjin/status/2039472968624185713
**作者**：@realsigridjin（Sigrid Jin 🌈🙏）
**发布时间**：2026-04-01 22:40 UTC
**数据**：回复 53 · 转发 170 · 点赞 804 · 收藏 1065 · 浏览 113,089
**标题**：What you need to learn from claw-code repo（正文为 X Article 长文，推文正文仅为文章链接）

---

## 原文（Original）
！[](images/omx-00.jpg)

# What you need to learn from claw-code repo
！[](images/omx-01.jpg)

## Stop Staring at the Files

People are losing their minds over the fact that the clean-room Python writing of claw-code took 2 hours. And we did Rust rewriting in a day (0.1.0 released!)

A complex agent system, reverse-engineered and re-implemented from scratch before sunrise on March 31st. The repository crossed 50,000 stars in two hours. It is past 117,000 now.

Developers are excited. A good number of them are terrified. Watching a codebase of that size get rebuilt at that speed feels like something broke in the timeline. For some it looks like a superpower they want to learn. For others it looks like a pink slip.

But if you are staring at the generated Python files, you are looking at the wrong layer.

The code is a byproduct. The Rust port that followed is also a byproduct. The thing worth studying in the claw-code repository is the system that produced all of it. claw-code was always a showcase. The point was never the Python files or the Rust crates. The point was the clawhip-based agent coordination system that built them while the developer was asleep.

Here is what that system actually looks like in practice: a person opens Discord on their phone, types a sentence, and puts the phone down. They might go make coffee. They might go to sleep. The agents read the message, break the work into tasks, assign roles among themselves, write code, test it, argue over it, fix what fails, and push when everything passes. The person checks back in the morning. The port is done.

No terminal. No IDE. No SSH session. No split-pane Vim setup. Discord. A chat app.

This is the part most people skip over. The README includes screenshots of the OmX workflow running in terminal panes, and people assume the developer was sitting in front of those panes the whole time, manually steering each step. The terminal sessions belong to the agents. The human's interface was a Discord channel. A text box. A send button.

Three tools make this work, and they each handle a different part of the problem.

oh-my-codex, usually called OmX, is a workflow layer that sits on top of OpenAI's Codex CLI. It gives you reusable keywords like $architect for analysis, $executor for implementation, $plan for structured planning. It also provides heavier workflow modes: $ralph runs persistent execution loops that keep going until the task is verified complete, and $team coordinates multiple agents working in parallel on different parts of the same problem. When the developer typed $team "implement the core runtime" in Discord, OmX turned that single sentence into a structured multi-step workflow and assigned it out.

clawhip is the notification and event router running as a background daemon. It watches Git commits, GitHub issues and PRs, tmux sessions, and agent lifecycle events, then sends status updates to the right Discord channel. The important design decision here is that clawhip keeps all monitoring work outside the agent's context window. An agent deep in a complex implementation task does not need its limited memory filled with notification logic and message formatting. clawhip owns the delivery so the agents can focus on the actual code.

oh-my-openagent provides the coordination logic between multiple agents. When the Architect agent's plan conflicts with what the Executor agent built, oh-my-openagent manages that disagreement. It handles information sharing between agents, task handoffs, and output verification loops.

None of these tools alone would have shipped claw-code in an hour. Wired together, they form a closed development loop. The human provides direction through Discord. The agents provide labor.

The agent team has defined roles, and they operate in a cycle.

！[](images/omx-02.jpg)

The Architect reads the directive and produces a plan. It analyzes the target system's structure, identifies what needs to be built, and writes out a sequence of steps. The Executor picks up that plan and starts building. It writes code, runs tools, generates tests. The Reviewer inspects the Executor's output, catches problems, and sends feedback. If the feedback is serious enough, the loop goes back to the Architect for re-planning. This cycle repeats until the output passes all checks.

！[](images/omx-03.jpg)

The whole time, the person who kicked this off might be asleep. The agents file updates to the Discord channel. If something is blocked, they mention the developer in a message. If nothing is blocked, they keep going.

！[](images/omx-04.jpg)

If you went to Ralphthon (https://luma.com/kxoq82yq) or OmOCon (https://luma.com/omocon-sf), you already know this idea. The philosophy behind those events was specific and practical: stop staying up all night at hackathons typing code by hand. That era is over. Instead, spend your energy designing agent systems and setting up the coordination between them. You sleep. They work.

Ralphthon participants who understood this consistently shipped more than the people who tried to out-type the machines. The ones who built good agent coordination, gave clear direction, and then stepped back had working products in the morning. The ones who tried to micromanage every line of code burned out halfway through the night and delivered less.

The lesson was simple and it was obvious by the end of the event. The bottleneck is no longer how fast your fingers can produce syntax.

When a system can port an entire codebase in sixty minutes, what becomes expensive? Knowing what to build. Knowing why. Understanding how the pieces should fit together. Having a clear mental model of the target architecture, being able to decompose that into tasks an agent can execute, and knowing how to set up the coordination so multiple agents stay productive in parallel.

These are the skills that get more valuable as agents get stronger. A faster agent does not reduce the need for clear thinking. It increases it. A badly directed team of fast agents will produce a lot of wrong code very quickly.

We had a precise view of what the final system should look like. He knew which parts could be parallelized and which had dependencies. He set the constraints, gave the agents room to work, and got out of the way. That is what produced the result. The Python files are evidence.

There is a specific fear floating around developer communities right now. The worry is that AI will type faster than humans and make them unnecessary. claw-code looks like confirmation of that fear on the surface. One hour. An entire system rebuilt.

But look at what the developer actually did during that hour. He typed maybe ten sentences into a Discord channel. The skill that produced claw-code was not typing speed. It was architectural clarity, task decomposition, and system design. Those do not get cheaper as agents improve. They get scarce.

When you look at the claw-code repository, skip the src/ directory. Go read about the OmX workflow that built it. Go look at how clawhip kept the agents focused by routing notifications out of their context. Go study how the Architect, Executor, and Reviewer agents coordinated through oh-my-openagent without a human babysitting each step.

The person never opened a terminal. They typed in Discord. And by morning, claw-code became a meme. 117,000 stars for a repository most people misread. They saw a fast port. What they should have seen was a demo. claw-code is a showcase of what a clawhip-based coordination system can do when a human with a clear vision points it at a hard problem and walks away. The code was never the product. The system that wrote it is.

## Philosophical Questions - What's Left?

Something strange happened after claw-code hit 100,000 stars. People I had never spoken to started sending me messages. Old acquaintances who had ignored my DMs for months suddenly replied within minutes. Investors who had passed on calls were now asking if I had time this week. I am the same person I was two weeks ago. I did not get smarter overnight. The repository got popular, and the social math changed.

I watched this happen and thought about Cluely. A Columbia dropout builds a product that goes viral, and suddenly every conversation about him is framed around funding rounds and press coverage. The product itself almost becomes secondary. What mattered was that people were talking about it. The noise created gravity, and gravity pulled in money, attention, and status. This is a pattern that repeats constantly in San Francisco right now.

Something shifted in the city over the past year. Developers used to compete on what they could build. The quality of your code, the reliability of your infrastructure, the elegance of your architecture. These things used to separate people. They do not separate people anymore. When everyone has access to the same intelligence through the same APIs, the code itself stops being a differentiator. A junior developer with good prompting instincts and a clear spec can now produce output that would have taken a senior engineer a week, in an afternoon. The gap between "can build" and "cannot build" is closing fast.

So what do people compete on instead? Noise. Visibility. Social positioning. San Francisco's tech scene has turned into a status game where the goal is to be loud enough that people assume you must be important. You post constantly, you get invited to dinners, you speak on panels, you accumulate followers, and then you convert that attention into funding. The funding lets you hire, the hiring lets you ship, the shipping gives you more to post about, and the cycle continues. The actual quality of what gets shipped matters less than whether people are paying attention to it.

GitHub stars used to mean something specific. Before AI-assisted development became normal, putting up a repository with thousands of stars required real engineering effort. People had to write the code themselves, debug it, maintain it, respond to issues. Star counts and fork counts were a rough but honest proxy for product quality. If a repository had 10,000 stars, you could reasonably assume that a skilled team had built something useful. That assumption is breaking down. claw-code crossed 50,000 stars in two hours. The code works, but the star count reflects virality, not months of careful engineering. Anyone watching this trend understands what it means: the old signals are losing their reliability.

There is a post circulating that says only four jobs will survive in tech companies going forward. Vibe coders who move fast with AI tools and think in product terms. Security and infrastructure people who stitch everything together and keep it stable, because the sheer volume of AI-generated output will demand serious operational attention. People-facing roles for those who are pleasant to deal with and can present a good experience to the world. And adults in the room, the ones who slow things down just enough to keep an accelerating organization from flying apart. Legal, finance, the human governors.

I think about this list and it feels roughly right, even if the framing is blunt. The common thread across all four categories is that none of them are about writing code. They are about judgment, taste, stability, and human connection. The things that AI is bad at. The things that do not compress into a prompt.

So what is left for the tech industry when intelligence becomes a commodity? I keep coming back to the same answer. Conviction about what is worth building. The ability to look at a problem and know which parts matter and which parts are noise. The patience to design systems that work correctly even when no one is watching. The honesty to admit when something is a demo and when it is a real product.

claw-code is a demo. I have said this from the beginning. It is a showcase of what the coordination layer can do. The 117,000 stars are a meme. The interesting question is what you build after the meme fades and the DMs slow down. That is when the real work starts, and that work has nothing to do with how fast your agents can type.

## Two Kinds of People

Watching the reactions to claw-code split cleanly into two camps, and the split tells you more about the future of this industry than any technical analysis could.

One camp is people who built their careers inside established systems. They climbed the ladder at big companies, optimized for promotions, collected the right credentials, and got comfortable inside structures that rewarded them for following rules well. These are the people now posting on Blind with a tone that swings between panic and resignation. The FAANG identity that felt so solid two years ago is cracking. Their skills were real, but those skills were priced on scarcity, and the scarcity is evaporating. If you go read those threads right now, the mood is genuinely bleak. Senior engineers wondering out loud whether their experience still matters. Staff-level people quietly updating their LinkedIn bios to include "AI" somewhere. It is entertaining to watch if you are being honest about it, and a little sad if you think about it longer.

The other camp is people who never fit neatly into those structures to begin with. The ones who started things from zero, who built products because they had a specific idea they could not let go of, who treated constraints as creative problems rather than career obstacles. These people are having the time of their lives right now. The ability to turn what is in your head into something real has gotten dramatically stronger in the past year. If you always had more ideas than you could execute, you are suddenly in a world where execution bandwidth is almost free. That feels like being handed a superpower, not a pink slip.

The dividing line between these two groups has nothing to do with technical skill. It is about where your value comes from. If your value was "I can write code that other people cannot write," you are watching that moat fill in month by month. PhD-level development ability and white-collar expertise are becoming a basic utility. Everyone can access them through the same APIs for the same price. The floor of what a single person can build has risen so fast that the old markers of competence are losing meaning.

What does not commoditize is taste. Conviction. A specific point of view about how something should work and why. Think about the products that still feel distinct even in a world full of AI-generated everything. Figma has opinions about how design collaboration should feel. Notion has opinions about how information should be structured. Linear has opinions about how engineering teams should track work. These products are not successful because their code is better. They are successful because the people who made them had a clear, stubborn vision of what the experience should be, and they refused to compromise on it. That vision is the product. The code is how it gets delivered.

This is where the entrepreneurial instinct matters more than it ever has. AI gives you an incredible first draft. It gives you speed, breadth, coverage. What it does not give you is the push past that first draft. The moment where you look at what the agents produced and say "this is not good enough, and here is specifically why, and here is what it should feel like instead." That judgment call, that willingness to reject a technically correct output because it does not match the product you see in your head, is something $ralph cannot do for you. $team will not develop taste on your behalf. No amount of agent coordination replaces the founder who knows what the thing should feel like when a real person uses it.

The people panicking on Blind are scared because they sense, correctly, that the system they optimized for is changing underneath them. The people celebrating are excited because they sense, also correctly, that the constraint they always struggled against was never intelligence. It was bandwidth. And bandwidth just got cheap.

What remains expensive is knowing what is worth building in the first place.

## References

claw-code, the showcase of clawhip-based orchestration: https://github.com/instructkr/claw-code

clawhip, the event-to-channel notification router: https://github.com/Yeachan-Heo/clawhip

oh-my-codex (OmX), workflow layer for Codex CLI: https://github.com/Yeachan-Heo/oh-my-codex

---

## 中文翻译（Translation）

！[](images/omx-00.jpg)

# 你需要从 claw-code 仓库学到什么
！[](images/omx-01.jpg)

## 别盯着文件看

人们正为 claw-code 的洁净室 Python 重写只花了 2 小时而疯狂。而我们用一天时间完成了 Rust 重写（0.1.0 已发布！）

一个复杂的智能体系统，在 3 月 31 日日出之前被逆向工程并从零重新实现。仓库在两小时内突破了 50,000 星。现在已超过 117,000。

开发者们很兴奋。其中相当一部分人感到恐惧。看着一个那么大规模的代码库以那样的速度被重建，感觉像是时间线上有什么东西断裂了。对一些人来说，它看起来像是一项想要学习的超能力。对另一些人来说，它看起来像一张解雇通知单。

但如果你盯着生成的 Python 文件看，那你就是在看错误的层面。

代码是副产品。随后的 Rust 移植也是副产品。claw-code 仓库里值得研究的是产出这一切的系统。claw-code 从来都是一个展示品。重点从来不是 Python 文件或 Rust crate。重点是那套基于 clawhip 的智能体协调系统——在开发者睡觉时把它们构建了出来。

这套系统在实践中长这样：一个人打开手机上的 Discord，打出一句话，然后把手机放下。他们可能去冲咖啡。他们可能去睡觉。智能体读取消息、把工作拆成任务、在彼此之间分配角色、写代码、测试、争论、修复失败的部分，并在全部通过时推送。这个人早上回来查看。移植完成了。

没有终端。没有 IDE。没有 SSH 会话。没有分屏 Vim 配置。Discord。一个聊天应用。

这是大多数人略过的部分。README 里包含了 OmX 工作流在终端面板中运行的截图，人们以为开发者全程坐在那些面板前，手动操控每一步。那些终端会话属于智能体。人类的界面是一个 Discord 频道。一个文本框。一个发送按钮。

三个工具实现了这一切，每个处理问题的一个不同部分。

oh-my-codex，通常称为 OmX，是构建在 OpenAI Codex CLI 之上的工作流层。它提供可复用的关键词，比如 $architect 用于分析，$executor 用于实现，$plan 用于结构化规划。它还提供更重的工作流模式：$ralph 运行持续的执行循环，直到任务被验证完成；$team 协调多个智能体并行处理同一问题的不同部分。当开发者在 Discord 里输入 $team "implement the core runtime" 时，OmX 把这一句话转化为结构化的多步骤工作流并分派出去。

clawhip 是一个以后台守护进程运行的通知与事件路由器。它监视 Git 提交、GitHub issue 和 PR、tmux 会话以及智能体生命周期事件，然后把状态更新发送到正确的 Discord 频道。这里重要的设计决策是：clawhip 把所有监视工作保持在智能体的上下文窗口之外。一个深陷复杂实现任务的智能体，不需要让有限的内存被通知逻辑和消息格式化填满。clawhip 拥有投递权，这样智能体就能专注于真正的代码。

oh-my-openagent 提供多个智能体之间的协调逻辑。当 Architect 智能体的计划与 Executor 智能体构建的东西冲突时，oh-my-openagent 管理这个分歧。它处理智能体之间的信息共享、任务交接和输出验证循环。

这些工具中任何一个单独使用都无法在一小时内交付 claw-code。把它们接在一起，就形成了一个闭环的开发回路。人类通过 Discord 提供方向。智能体提供劳动。

智能体团队有明确的角色分工，它们按一个循环运转。

！[](images/omx-02.jpg)

Architect 读取指令并产出计划。它分析目标系统的结构，识别需要构建什么，并写出一系列步骤。Executor 接手计划开始构建。它写代码、运行工具、生成测试。Reviewer 检查 Executor 的输出、发现问题并发送反馈。如果反馈足够严重，循环回到 Architect 重新规划。这个循环不断重复，直到输出通过所有检查。

！[](images/omx-03.jpg)

整个过程里，发起这一切的人可能正在睡觉。智能体把更新发到 Discord 频道。如果有什么被卡住，它们会在消息里 @ 开发者。如果没有被卡住，它们就继续推进。

！[](images/omx-04.jpg)

如果你参加过 Ralphthon（https://luma.com/kxoq82yq）或 OmOCon（https://luma.com/omocon-sf），你已经知道这个想法。那些活动背后的哲学具体而务实：别再在黑客马拉松里通宵手打代码了。那个时代结束了。取而代之的是，把你的精力花在设计智能体系统和搭建它们之间的协调上。你睡觉。它们干活。

理解这一点的 Ralphthon 参与者，交付的成果始终多于那些试图打字快过机器的人。那些搭好了良好的智能体协调、给出清晰方向然后退后一步的人，早上醒来时手里已有能用的产品。那些试图微观管理每一行代码的人，在半夜就耗尽精力，交付得更少。

这个教训很简单，活动结束时已经显而易见。瓶颈不再是你的手指产出语法的速度。

当一个系统能在 60 分钟内移植整个代码库，什么开始变得昂贵？知道要构建什么。知道为什么。理解各个部分应该如何拼合。对目标架构有清晰的思维模型，能够把它拆解成智能体可执行的任务，并且知道如何搭建协调，让多个智能体在并行中保持高效。

这些技能会随着智能体变强而变得更有价值。更快的智能体并不会降低对清晰思考的需求。它提高了需求。一支方向混乱的快速智能体团队，会很快产出大量错误的代码。

我们对最终系统应该长什么样有精确的视图。他知道哪些部分可以并行、哪些存在依赖关系。他设定约束，给智能体留出工作空间，然后让开。这才是产出结果的原因。Python 文件只是证据。

开发者社区里现在流传着一种特定的恐惧。担忧是 AI 打字比人类快，会让他们变得多余。表面上，claw-code 看起来是这个恐惧的证实。一小时。整个系统重建。

但看看开发者在那一小时里实际做了什么。他在 Discord 频道里打出了大概十句话。产出 claw-code 的技能不是打字速度。是架构清晰度、任务拆解和系统设计。这些不会随着智能体的进步而变便宜。它们会变得稀缺。

当你看到 claw-code 仓库时，跳过 src/ 目录。去读构建它的 OmX 工作流。去看看 clawhip 如何通过把通知路由出它们的上下文，让智能体保持专注。去研究 Architect、Executor 和 Reviewer 智能体如何通过 oh-my-openagent 协调，而无需人类在每一步陪跑。

那个人从未打开过终端。他在 Discord 里打字。而到早上，claw-code 成了一个梗。一个被大多数人误读的仓库，117,000 星。他们看到了一个快速的移植。他们本该看到的是一场演示。claw-code 是一个展示：当一位拥有清晰愿景的人类把一套基于 clawhip 的协调系统指向一个难题然后走开时，它能做到什么。代码从来不是产品。写出它的系统才是。

## 哲学问题——还剩下什么？

claw-code 突破 100,000 星后，发生了一件奇怪的事。我从未交谈过的人开始给我发消息。几个月没理我私信的旧相识突然在几分钟内回复。之前推掉电话的投资人现在问我这周有没有时间。我还是两周前的同一个人。我没有一夜之间变聪明。仓库火了，社交层面的算计变了。

我看着这一切发生，想到了 Cluely。一个从哥伦比亚大学辍学的人做出了一个病毒式传播的产品，突然间关于他的所有讨论都围绕融资轮和媒体报道展开。产品本身几乎变得次要。重要的是人们在谈论它。噪音创造了引力，引力拉来了金钱、注意力和地位。这是旧金山此刻不断重复的模式。

过去一年里，这座城市有什么东西变了。开发者过去比拼的是能构建什么。你代码的质量、你基础设施的可靠性、你架构的优雅。这些东西曾经把人区分开。它们不再把人区分开了。当每个人都能通过同样的 API 获得同样的智能，代码本身就不再是差异化因素。一个有良好提示直觉和清晰规格的初级开发者，现在一个下午就能产出过去资深工程师要花一周的输出。"能构建"和"不能构建"之间的差距正在快速闭合。

那么人们转而比拼什么？噪音。可见度。社交站位。旧金山的科技圈已经变成一场地位游戏，目标是足够响亮，让人家默认你必然重要。你持续发帖，被邀请参加晚宴，上台发言，积累粉丝，然后把注意力兑换成融资。融资让你招人，招人让你出货，出货给你更多可发的帖子，循环继续。实际交付的质量，不如是否有人关注重要。

GitHub 星标曾经有特定的含义。在 AI 辅助开发成为常态之前，挂出一个数千星的仓库需要真正的工程努力。人们必须自己写代码、调试、维护、回应 issue。星标数和 fork 数曾是产品质量粗糙但诚实的代理指标。如果一个仓库有 10,000 星，你可以合理假设一个熟练的团队构建了有用的东西。这个假设正在崩塌。claw-code 两小时内跨过了 50,000 星。代码能跑，但星标反映的是病毒式传播，不是数月的精心工程。任何关注这个趋势的人都明白它的含义：旧的信号正在失去可靠性。

有一篇流传的帖子说，未来科技公司里只有四类工作能存活。Vibe coder——用 AI 工具快速行动、以产品思维思考的人。安全和基础设施人员——把所有东西缝合在一起并保持稳定，因为 AI 产出的海量输出将要求严肃的运营关注。面向人的角色——那些好相处、能向世界呈现良好体验的人。还有房间里的大人——那些恰到好处地踩刹车、防止一个加速运转的组织散架的人。法务、财务、人类的治理者。

我思考这个列表，感觉大致是对的，即使框架有些直白。四个类别的共同主线是：它们没有一个是关于写代码的。它们关乎判断、品味、稳定和人际关系。那些 AI 不擅长的东西。那些无法压缩进一条提示词的东西。

那么，当智能变成一种商品，科技行业还剩下什么？我总是回到同一个答案。对什么值得构建的信念。看待一个问题、知道哪些部分重要、哪些部分是噪音的能力。设计系统的耐心——即便无人监督也能正确运转的系统。承认某物是演示还是真实产品的诚实。

claw-code 是一个演示。我从一开始就这么说。它是对协调层能力的展示。那 117,000 星是一个梗。有趣的问题是：在梗淡去、私信变少之后，你构建什么。那才是真正工作的开始，而那项工作与你智能体的打字速度毫无关系。

## 两种人

观察对 claw-code 的反应，可以干净地分成两个阵营，而这个分野比任何技术分析都更能告诉你这个行业的未来。

一个阵营是在既有系统内部建立职业生涯的人。他们在大公司里爬梯子，为晋升优化，收集正确的资历，在奖励循规蹈矩的结构里安顿下来。这些人现在在 Blind 上发帖，语气在恐慌和听天由命之间摇摆。两年前还那么坚实的 FAANG 身份正在开裂。他们的技能是真的，但这些技能是按稀缺性定价的，而稀缺性正在蒸发。如果你现在去读那些帖子，情绪真的很灰暗。资深工程师公开质疑自己的经验是否还有意义。Staff 级的人在悄悄更新 LinkedIn 简介，往里面塞个 "AI"。诚实地说，看着挺有娱乐性；多想一会儿，又有点悲哀。

另一个阵营是从一开始就没能整齐融入那些结构的人。从零开始做东西的人，因为有一个放不下的具体想法而做产品的人，把约束当作创造性问题而非职业障碍的人。这些人现在正享受人生中最好的时光。把脑子里东西变成现实的能力，在过去一年里急剧增强。如果你一直有比能执行的更多的想法，你会突然发现自己身处一个执行带宽几乎免费的世界。那感觉像是被递来一项超能力，而不是一张解雇通知。

这两个群体的分界线与技术技能无关。它关乎你的价值从哪里来。如果你的价值是"我能写出别人写不出的代码"，你在看着那条护城河一月一月地被填平。博士级开发能力和白领专长正在变成基础公用设施。每个人都能通过同样的 API、以同样的价格访问它们。一个人能构建的东西的下限抬升得太快，旧的胜任力标记正在失去意义。

不会被商品化的是品味。信念。关于某样东西应该如何运转以及为什么的具体观点。想想在一个满是 AI 生成物的世界里仍然感觉独特的产品。Figma 对设计协作应该是什么感觉有主张。Notion 对信息应该如何被组织有主张。Linear 对工程团队应该如何跟踪工作有主张。这些产品成功不是因为它们的代码更好。它们成功是因为创造它们的人对体验应该是什么样有清晰而固执的愿景，并且拒绝妥协。那个愿景才是产品。代码只是交付它的方式。

这正是创业本能比以往任何时候都重要的地方。AI 给你一份难以置信的初稿。它给你速度、广度、覆盖率。它不给你的是越过初稿的推动力——那个时刻：你看着智能体产出的东西说"这不够好，具体原因如下，它应该让人感觉怎样"。那个判断，那种拒绝一个技术上正确、但不符合你脑中产品的输出的意愿，是 $ralph 无法替你做的。$team 不会替你发展品味。再多的智能体协调，也替代不了那个知道真实用户使用某物时它应该是什么感觉的创始人。

在 Blind 上恐慌的人害怕，是因为他们正确地感觉到，他们为之优化的系统正在脚下改变。庆祝的人兴奋，是因为他们也正确地感觉到，他们一直与之斗争的约束从来不是智能。是带宽。而带宽刚刚变便宜了。

仍然昂贵的，是首先知道什么值得构建。

## 参考

claw-code，clawhip 编排的展示：https://github.com/instructkr/claw-code

clawhip，事件到频道的通知路由器：https://github.com/Yeachan-Heo/clawhip

oh-my-codex（OmX），Codex CLI 的工作流层：https://github.com/Yeachan-Heo/oh-my-codex

---

> **说明**：本文正文为 X Article 长文（推文本体只有文章链接）。文中 `[图片]` 标记对应原文嵌入的 3 张配图位置（另有 1 张封面图，已下载为 `images/cover.jpg` 并嵌入上方）。正文 3 张内嵌图位于 X 登录墙后，无法匿名获取。
