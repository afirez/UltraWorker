#!/usr/bin/env node
/**
 * 飞书直桥替换 Discord —— 双向桥接服务（Node ESM，Windows / macOS / Linux）
 *
 * 基于 https://github.com/afirez/clawhip-feishu 的 feishu-bridge.mjs 修改而来。
 * 保留自原版的两条通道：
 *   1) Sink（出）：本地 HTTP 服务接收 clawhip 投递的 Slack 风格消息 {"text": "..."}
 *      → 转发为飞书消息（应用机器人 API 或自定义机器人 webhook）
 *   2) Source（入）：飞书长连接（websocket 模式）订阅 im.message.receive_v1
 *      → 白名单用户消息 → 注入 agent（免前缀全注入；! 前缀为可选显式指令标记）；
 *         非白名单默认忽略（FEISHU_FORWARD_NON_WHITELIST=1 可保留 POST clawhip /event 普通事件）
 *
 * 本次新增/修改（对齐「飞书直桥替换 Discord」规格 di-feishu-direct-20260814）：
 *   1) 指令注入模式 INJECT_MODE=codex|omx|deliver：
 *        - codex  ：codex exec --skip-git-repo-check -C <目录> --json -o <输出文件> "<指令>"
 *        - omx    ：omx exec --skip-git-repo-check -C <目录> "<指令>"（内部仍是 codex exec，多一层 OMX 工作流）
 *        - deliver：clawhip deliver --session <tmux> --prompt "<指令>"（tmux 会话注入）
 *      Windows 下 codex / omx 是 npm 生成的 .cmd 壳（shim），Node execFile 直接执行会 EINVAL/ENOENT；
 *      桥启动时自动解析 shim 内容定位真实 JS 入口，改用 `node <js> …` 调用（shell:false 直连，无注入面）。
 *   2) 执行结果回推：指令执行完成后把结果发回飞书
 *        - FEISHU_RESULT_MODE=reply：回复原消息（im/v1/messages/:message_id/reply，对齐 Discord 回复/线程语义）
 *        - FEISHU_RESULT_MODE=chat ：发到目标群（im/v1/messages?receive_id_type=chat_id）
 *   3) @提及策略：MENTION_REQUIRED=1 时仅响应「@机器人」的消息（对齐 Discord @ 语义）
 *   4) 富文本卡片：FEISHU_MSG_TYPE=interactive 时用 lark_md 消息卡片呈现结果
 *   5) Sink 载荷兼容：{text}（clawhip Slack sink）/ {content}（clawhip Discord webhook 透传）/ {message}（omx webhook）
 *
 * 本次对齐（规格 di-align-discord-usage-20260814：指令处理对齐 omx/clawhip 源码揭示的 Discord 真实使用模式，
 * omx/clawhip 源码零改动，全部对齐在桥内实现）：
 *   1) 白名单全注入：FEISHU_ALLOWED_OPEN_IDS（逗号分隔 open_id 列表）——白名单用户的所有消息默认
 *      注入 agent（含 omx $关键词，免 ! 前缀；对齐 reply-listener「无前缀过滤」+「授权=配置用户 ID 白名单」）。
 *      白名单为空 → 全部放行（向后兼容默认）。
 *   2) ! 变可选显式指令标记：! 开头 = 强制按指令处理（仅对白名单用户生效；非白名单仍不注入）。
 *   3) 注入目标优先级：INJECT_MODE=deliver 时优先注入「运行中」tmux 会话（对齐 reply-listener sendToPane /
 *      clawhip deliver 语义——注入运行中会话而非新开 exec）；deliver 不可用（无运行中会话等）时回退 exec
 *      （INJECT_FALLBACK_MODE=codex|omx）。INJECT_MODE=codex|omx 维持直接 exec。
 *   4) 非白名单用户消息：默认忽略（严格对齐 reply-listener 授权模型）；FEISHU_FORWARD_NON_WHITELIST=1
 *      时保留 POST clawhip /event 作为普通事件（feishu.message，不注入）。
 *
 * 启动（Node ≥ 20.6，--env-file 需要）：
 *   node --env-file=.env feishu-bridge.mjs
 */

import http from "node:http";
import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as lark from "@larksuiteoapi/node-sdk";

// ---------------- 环境变量（.env / 进程环境） ----------------
const {
  FEISHU_APP_ID,
  FEISHU_APP_SECRET,
  FEISHU_CHAT_ID,
  FEISHU_CUSTOM_BOT_WEBHOOK,
  FEISHU_SINK_MODE = "app",        // app = 应用机器人 API（推荐）；webhook = 自定义机器人
  CLAWHIP_DAEMON = "http://127.0.0.1:25294",
  CLAWHIP_SESSION = "",            // 仅 INJECT_MODE=deliver 时使用（tmux 会话名）
  COMMAND_PREFIX = "!",            // 可选显式指令标记（! 开头 = 强制按指令处理；白名单用户免前缀全注入）
  BRIDGE_PORT = "8787",            // Sink 监听端口
  INJECT_MODE = "codex",           // 指令注入模式：codex | omx | deliver
  INJECT_FALLBACK_MODE = "codex",  // INJECT_MODE=deliver 不可用时的回退 exec：codex | omx
  CODEX_BIN = "",                  // codex 可执行文件覆盖（Windows 下建议留空自动解析 shim）
  OMX_BIN = "",                    // omx 可执行文件覆盖
  CODEX_WORKDIR = "",              // codex/omx exec 的工作目录（默认 process.cwd()）
  EXEC_TIMEOUT_MS = "600000",      // 指令执行超时（默认 10 分钟）
  FEISHU_RESULT_MODE = "reply",    // 结果回推：reply = 回复原消息；chat = 发到群
  MENTION_REQUIRED = "0",          // 1 = 仅响应 @机器人 的消息
  FEISHU_MSG_TYPE = "text",        // text = 纯文本；interactive = 富文本卡片
  RESULT_MAX_CHARS = "3000",       // 回推结果最大字符数（超出截断）
  FEISHU_ALLOWED_OPEN_IDS = "",    // 白名单 open_id 列表（逗号分隔）；空 = 全部放行（向后兼容默认）
  FEISHU_FORWARD_NON_WHITELIST = "0", // 1 = 非白名单消息仍 POST clawhip /event（普通事件，不注入）；0 = 忽略
} = process.env;

const WORKDIR = CODEX_WORKDIR || process.cwd();
const EXEC_TIMEOUT = Number(EXEC_TIMEOUT_MS) || 600000;
const RESULT_LIMIT = Number(RESULT_MAX_CHARS) || 3000;

// 白名单解析：逗号分隔的飞书 open_id；集合为空 → 所有用户视为白名单（向后兼容默认）
const ALLOWED_OPEN_IDS = new Set(
  FEISHU_ALLOWED_OPEN_IDS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// ---------------- 飞书 SDK 客户端（自建应用） ----------------
// 底层凭证流程由 SDK 内部完成：App ID + App Secret → POST /open-apis/auth/v3/tenant_access_token/internal
const client =
  FEISHU_APP_ID && FEISHU_APP_SECRET
    ? new lark.Client({
        appId: FEISHU_APP_ID,
        appSecret: FEISHU_APP_SECRET,
        appType: lark.AppType.SelfBuild,
      })
    : null;

// 飞书长连接是 at-least-once 投递，断线重连可能重投同一条消息，按 message_id 去重
const recentMessageIds = new Set();
const MAX_RECENT_MESSAGE_IDS = 200;
function isDuplicateMessage(messageId) {
  if (!messageId || recentMessageIds.has(messageId)) return true;
  recentMessageIds.add(messageId);
  if (recentMessageIds.size > MAX_RECENT_MESSAGE_IDS) {
    const oldest = recentMessageIds.values().next().value;
    recentMessageIds.delete(oldest);
  }
  return false;
}

// ---------------- Windows npm shim 解析 ----------------
// Windows 下全局安装的 codex / omx 是 npm 生成的 .cmd 壳（shim），内容形如：
//   "%_prog%"  "%dp0%\node_modules\oh-my-codex\dist\cli\omx.js" %*
// execFile 直接执行 .cmd 会抛 EINVAL / ENOENT。这里解析 shim 定位真实 JS 入口，
// 统一用 `node <js>` 调用（shell:false，参数不走 shell，无注入面）。
function resolveShim(cmd) {
  const npmDir = process.env.APPDATA
    ? path.join(process.env.APPDATA, "npm")
    : null;
  const candidates = [];
  if (npmDir) {
    candidates.push(path.join(npmDir, cmd + ".cmd"));
    candidates.push(path.join(npmDir, cmd + ".exe"));
    candidates.push(path.join(npmDir, cmd));
  }
  // 从 PATH 补查（含用户自定义安装位置）
  try {
    const out = execFileSync("where", [cmd], { encoding: "utf8", shell: false });
    for (const line of out.split(/\r?\n/)) if (line.trim()) candidates.push(line.trim());
  } catch { /* 不在 PATH，继续 */ }
  for (const c of candidates) {
    if (!fs.existsSync(c)) continue;
    if (/\.cmd$/i.test(c)) {
      const content = fs.readFileSync(c, "utf8");
      // npm shim 特征：%dp0%\node_modules\<pkg>\...\<入口>.js
      const m = content.match(/%dp0%[\\]([^"%\r\n]+\.js)/);
      const js = m ? path.join(path.dirname(c), m[1]) : null;
      if (js && fs.existsSync(js)) return { bin: process.execPath, args: [js] };
      return null; // 是 .cmd 但解析不出 JS 入口
    }
    return { bin: c, args: [] }; // 真实二进制（.exe / Unix 路径）
  }
  return { bin: cmd, args: [] }; // 非 Windows 或不在 PATH：交给系统解析
}

// ---------------- 文本工具 ----------------
function truncate(text, limit) {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "\n…（结果过长已截断）";
}

function tail(text, limit) {
  return text.length <= limit ? text : "…（输出过长，仅保留末尾）\n" + text.slice(-limit);
}

// 去掉消息文本里的 @占位符（content.mention 的 key，形如 @_user_1）
function stripMentions(text, mention) {
  let t = text;
  if (Array.isArray(mention)) {
    for (const m of mention) {
      if (m && m.key) t = t.split(m.key).join("");
    }
  }
  return t.replace(/@_user_\d+/g, "").trim();
}

// ---------------- 发送到飞书 ----------------
// 富文本卡片（msg_type=interactive，标准消息卡片 schema：header + elements）
function buildCard(title, text) {
  return JSON.stringify({
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: title },
      template: "blue",
    },
    elements: [{ tag: "div", text: { tag: "lark_md", content: text } }],
  });
}

// 统一发送入口：
//   mode=reply → POST /open-apis/im/v1/messages/:message_id/reply（回复原消息）
//   mode=chat  → POST /open-apis/im/v1/messages?receive_id_type=chat_id（发到群）
async function sendMessage(text, { messageId, chatId, title = "桥接通知" }) {
  const msgType = FEISHU_MSG_TYPE === "interactive" ? "interactive" : "text";
  const content =
    msgType === "interactive" ? buildCard(title, text) : JSON.stringify({ text });

  if (FEISHU_SINK_MODE === "webhook" && FEISHU_CUSTOM_BOT_WEBHOOK) {
    // 自定义机器人 webhook：POST /open-apis/bot/v2/hook/{token}（无 reply 能力，一律发群）
    const res = await fetch(FEISHU_CUSTOM_BOT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msg_type: msgType, content: msgType === "interactive" ? JSON.parse(content) : { text } }),
    });
    if (!res.ok) throw new Error(`feishu webhook ${res.status}`);
    return;
  }
  if (!client) throw new Error("需要 FEISHU_APP_ID / FEISHU_APP_SECRET（或改用 webhook 模式）");

  if (FEISHU_RESULT_MODE === "reply" && messageId) {
    await client.im.message.reply({
      path: { message_id: messageId },
      data: { msg_type: msgType, content },
    });
  } else {
    await client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: { receive_id: chatId || FEISHU_CHAT_ID, msg_type: msgType, content },
    });
  }
}

// ---------------- Sink：clawhip 投递 → 飞书 ----------------
async function sendToFeishu(text) {
  await sendMessage(text, { chatId: FEISHU_CHAT_ID });
}

const sinkServer = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    const payload = JSON.parse(body || "{}");
    // 兼容三种载荷：clawhip Slack sink {"text"} / clawhip Discord 透传 {"content"} / omx webhook {"message"}
    const text = (payload.text || payload.content || payload.message || "").trim();
    if (text) await sendToFeishu(text);
    res.writeHead(200).end("ok");
  } catch (err) {
    console.error("[sink]", err.message);
    res.writeHead(502).end(err.message);
  }
});
sinkServer.listen(Number(BRIDGE_PORT), "127.0.0.1", () => {
  console.log(`[sink] listening http://127.0.0.1:${BRIDGE_PORT}/feishu`);
});

// ---------------- Source：飞书消息 → clawhip / 指令注入 ----------------
async function postToClawhip(payload) {
  const res = await fetch(`${CLAWHIP_DAEMON}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`clawhip /event ${res.status}: ${await res.text()}`);
  }
}

// 原版路径：clawhip deliver 注入「正在运行」的 tmux 会话（如 WSL / msys2 下的 omx-main）。
// 对齐 reply-listener sendToPane / clawhip deliver 语义：注入运行中会话，而非新开 exec 会话。
// 返回 { ok, text, error }：ok=false 表示 deliver 不可用（无运行中会话 / 无 tmux / clawhip 缺失等），
// 供上层回退 exec。
function deliverToSession(prompt) {
  const clawhipBin =
    process.env.CLAWHIP_BIN ||
    (process.platform === "win32"
      ? (process.env.USERPROFILE
          ? path.join(process.env.USERPROFILE, ".cargo", "bin", "clawhip.exe")
          : "clawhip")
      : (process.env.HOME
          ? path.join(process.env.HOME, ".cargo", "bin", "clawhip")
          : "clawhip"));
  return new Promise((resolve) => {
    execFile(
      clawhipBin,
      ["deliver", "--session", CLAWHIP_SESSION, "--prompt", prompt, "--max-enters", "4"],
      { shell: false },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "").trim();
          console.error("[deliver]", msg || `exit ${err.code}`);
          resolve({
            ok: false,
            text: "",
            error: msg ? `deliver 失败：${msg.slice(0, 500)}` : `deliver 失败(${err.code})`,
          });
        } else {
          console.log("[deliver]", stdout);
          resolve({ ok: true, text: stdout || "已注入 tmux 会话" });
        }
      },
    );
  });
}

// codex / omx exec（直选与 deliver 回退共用）：target = 'codex' | 'omx'
async function execPrompt(prompt, target) {
  const override = target === "omx" ? OMX_BIN : CODEX_BIN;
  const resolved = override ? { bin: override, args: [] } : resolveShim(target);
  if (!resolved) throw new Error(`无法解析 ${target} 可执行文件（npm shim 解析失败），请设置 ${target.toUpperCase()}_BIN`);

  const outFile = path.join(os.tmpdir(), `feishu-bridge-${Date.now()}-${Math.random().toString(36).slice(2)}.out`);
  const args =
    target === "codex"
      ? ["exec", "--skip-git-repo-check", "-C", WORKDIR, "--json", "-o", outFile, prompt]
      : ["exec", "--skip-git-repo-check", "-C", WORKDIR, prompt];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXEC_TIMEOUT);
  try {
    const { stdout } = await new Promise((resolvePromise, reject) => {
      execFile(
        resolved.bin,
        [...resolved.args, ...args],
        { shell: false, signal: controller.signal, maxBuffer: 64 * 1024 * 1024 },
        (err, so, se) => {
          if (err) {
            const msg = controller.signal.aborted
              ? `执行超时（${EXEC_TIMEOUT / 1000}s）`
              : `exec 失败(${err.code})：${(se || err.message).slice(0, 400)}`;
            return reject(new Error(msg));
          }
          resolvePromise({ stdout: so });
        },
      );
    });

    // 优先取 -o 写入的「最后一条消息」（codex 模式）；兜底取 stdout 末尾
    let result = "";
    if (fs.existsSync(outFile)) {
      const raw = fs.readFileSync(outFile, "utf8").trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          result = typeof parsed.text === "string" ? parsed.text : raw;
        } catch { result = raw; }
      }
    }
    if (!result) result = tail(stdout || "", 4000);
    return truncate(result.trim() || "（执行完成，无输出）", RESULT_LIMIT);
  } finally {
    clearTimeout(timer);
    try { fs.unlinkSync(outFile); } catch { /* 忽略清理失败 */ }
  }
}

// 指令注入入口：串行队列防止并发撞车
// 注入目标优先级（对齐 reply-listener/deliver 语义，规格 di-align-discord-usage-20260814）：
//   INJECT_MODE=deliver → 优先注入「运行中」tmux 会话；deliver 不可用（无运行中会话等）→ 回退 exec（INJECT_FALLBACK_MODE）
//   INJECT_MODE=codex|omx → 直接 exec（维持原行为）
let execQueue = Promise.resolve();

function runExec(prompt) {
  const run = async () => {
    if (INJECT_MODE === "deliver") {
      const out = await deliverToSession(prompt);
      if (out.ok) return out.text;
      // deliver 不可用 → 回退 exec
      console.warn(`[deliver] 不可用，回退 ${INJECT_FALLBACK_MODE === "omx" ? "omx" : "codex"} exec（${out.error}）`);
      return execPrompt(prompt, INJECT_FALLBACK_MODE === "omx" ? "omx" : "codex");
    }
    return execPrompt(prompt, INJECT_MODE === "omx" ? "omx" : "codex");
  };
  // 串行化：前一条执行完才跑下一条
  const next = execQueue.then(run, run);
  execQueue = next.catch(() => {});
  return next;
}

if (client) {
  const dispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      // WSClient 长连接直接把事件本体传给 handler（顶层即 sender/message），
      // 不是 HTTP 模式的 { schema, header, event } 包装结构。
      const { message, sender } = data;
      if (!message || !sender) return;
      if (sender.sender_type === "app") return; // 防止机器人自己的消息形成回声
      if (isDuplicateMessage(message.message_id)) return; // 重投去重
      if (message.message_type !== "text") return; // 先只处理文本

      const content = JSON.parse(message.content || "{}");
      let text = (content.text || "").trim();
      if (!text) return;
      text = stripMentions(text, content.mention);

      // @提及策略：MENTION_REQUIRED=1 时仅响应群里 @机器人 的消息
      const mentioned = Array.isArray(message.mentions) && message.mentions.length > 0;
      if (MENTION_REQUIRED === "1" && !mentioned) return;

      const openId = sender.sender_id && sender.sender_id.open_id;
      console.log(`[source] chat=${message.chat_id} user=${openId}: ${text}`);

      // 白名单判定（对齐 reply-listener 授权模型：配置用户 ID 白名单，规格 di-align-discord-usage-20260814）
      //   FEISHU_ALLOWED_OPEN_IDS 为空 → 全部放行（向后兼容默认）
      //   白名单非空 → 仅列表内 open_id 的用户可注入；非白名单消息见下方处理
      const allowed =
        ALLOWED_OPEN_IDS.size === 0
          ? true
          : Boolean(openId && ALLOWED_OPEN_IDS.has(openId));

      const base = {
        source: "feishu",
        channel: message.chat_id,
        message: text,
        user: openId,
        message_id: message.message_id,
      };

      try {
        if (!allowed) {
          // 非白名单用户：默认忽略（严格对齐 reply-listener 授权模型，不注入、不 POST）
          if (FEISHU_FORWARD_NON_WHITELIST === "1") {
            // 可配保留：仅作为普通事件 POST clawhip /event（feishu.message，不注入）
            await postToClawhip({ ...base, event: "feishu.message", whitelisted: false });
            console.log(`[source] 非白名单消息已转发普通事件（user=${openId}，不注入）`);
          } else {
            console.log(`[source] 非白名单用户消息已忽略（user=${openId}）`);
          }
          return;
        }

        // 指令判定：! 前缀 = 可选显式指令标记（强制按指令处理）；
        // 无前缀时，白名单用户的所有消息默认注入（含 omx $关键词，免前缀，对齐 reply-listener 无前缀过滤）
        const explicitCommand = COMMAND_PREFIX && text.startsWith(COMMAND_PREFIX);
        const prompt = explicitCommand ? text.slice(COMMAND_PREFIX.length).trim() : text;
        if (!prompt) return;

        if (explicitCommand) {
          // 显式 ! 指令：先记一条 feishu.command 审计事件（clawhip 审计/路由），再注入执行
          await postToClawhip({ ...base, event: "feishu.command", command: prompt, whitelisted: true });
        } else {
          // 免前缀全注入：记 feishu.message 审计事件（标注 injected），再注入执行
          await postToClawhip({ ...base, event: "feishu.message", injected: true, whitelisted: true });
        }
        console.log(`[exec] ${INJECT_MODE} 注入：${prompt}`);
        const result = await runExec(prompt);
        console.log(`[exec] 完成，${result.length} 字符`);
        await sendMessage(result, {
          messageId: message.message_id,
          chatId: message.chat_id,
          title: "指令执行结果",
        });
      } catch (err) {
        console.error("[source]", err.message);
        // 执行失败也要回推，让人在飞书里看到错误
        try {
          await sendMessage(`❌ 执行失败：${err.message}`, {
            messageId: message.message_id,
            chatId: message.chat_id,
            title: "执行失败",
          });
        } catch { /* 回推失败仅记录 */ }
      }
    },
  });

  const ws = new lark.WSClient({
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    loggerLevel: lark.LoggerLevel.INFO,
  });

  ws.start({ eventDispatcher: dispatcher }).catch((err) => {
    console.error("[ws]", err);
    process.exit(1);
  });
} else {
  console.log("[source] 未配置飞书 App 凭证，仅启用 sink（可先用自定义机器人 webhook）");
}
