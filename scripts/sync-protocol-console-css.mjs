/**
 * 从 WebUI app.css 抽取与协议端共用的控制台样式，写入 Pallas-Plugin-Protocol 静态资源。
 * 运行：npm run sync:protocol-css（在 Pallas-Bot-WebUI 目录）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConsoleSharedCss } from "./protocol-css-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webuiRoot = path.resolve(__dirname, "..");
const appCssPath = path.join(webuiRoot, "src/styles/app.css");
const protoUiDir = path.resolve(
  webuiRoot,
  "../Pallas-Plugin-Protocol/src/pallas_plugin_protocol/web/static/pallas_ui",
);
const outShared = path.join(protoUiDir, "console-shared.css");
const outShell = path.join(protoUiDir, "shell.css");
const shellProtocolPath = path.join(protoUiDir, "shell-protocol.css");

/** 与 app.css 行号同步；结构大改时需更新 protocol-css-lib.mjs */

const PROTOCOL_COMPAT = `
/* —— 协议端 HTML 类名 / 变量别名（勿删）—— */
:root {
  --font: var(--font-sans);
  --bd: var(--border);
  --txt: var(--text);
  --muted: var(--text-muted);
  --card: var(--bg-card);
  --bg0: var(--bg-deep);
  --bg1: var(--bg-elev);
  --ok: var(--success);
  --err: var(--danger);
  --accent-subtle: var(--accent-soft);
  --radius-xl: var(--radius-lg);
  --pallas-text-xs: 0.75rem;
  --pallas-text-sm: var(--ui-field-label-size, 0.8125rem);
  --pallas-text-base: var(--ui-ctrl-font, 0.9375rem);
  --pallas-text-lg: var(--console-panel-title-size, 1.0625rem);
  --pallas-text-stat: 1.125rem;
  --pallas-weight-body: 450;
  --pallas-weight-semibold: 600;
  --pallas-weight-bold: 700;
}

.btn.linkish {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--text-muted);
}
.btn.linkish:hover:not(:disabled) {
  color: var(--accent);
  background: transparent;
}

.shell__topbar-rail .btn-refresh-icon {
  flex-shrink: 0;
}

.shell.proto-shell {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0;
}

body:has(.proto-shell) {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  overflow: hidden;
}

/* 主区同时挂 shell__main-inner + proto-shell__main-inner，样式由 console-shared 提供 */
`.trim();

/** 从 shell-protocol.css 去掉已迁入 console-shared 的区段（行号为原 shell.css） */
const PROTOCOL_PRUNE_RANGES = [
  [1, 275],
  [338, 407],
  [1172, 1753],
  [1384, 1409],
  [1420, 1428],
  [1648, 1688],
];

function pruneProtocolCss(content) {
  const lines = content.split("\n");
  const drop = new Set();
  for (const [start, end] of PROTOCOL_PRUNE_RANGES) {
    for (let i = start; i <= end; i++) drop.add(i);
  }
  return lines.filter((_, idx) => !drop.has(idx + 1)).join("\n");
}

const lines = fs.readFileSync(appCssPath, "utf8").split("\n");
const sharedBody = buildConsoleSharedCss(appCssPath, new Date().toISOString());

fs.mkdirSync(path.dirname(outShared), { recursive: true });
fs.writeFileSync(outShared, sharedBody, "utf8");

let protocolExtras = "";
const PROTOCOL_EXTRAS_MARKER = "/* @protocol-extras-v1 */";

if (fs.existsSync(shellProtocolPath)) {
  protocolExtras = fs.readFileSync(shellProtocolPath, "utf8");
} else if (fs.existsSync(outShell) && !fs.readFileSync(outShell, "utf8").includes("@import")) {
  protocolExtras = fs.readFileSync(outShell, "utf8");
  console.warn("从 shell.css 引导 shell-protocol.css（首次同步）");
} else {
  console.warn("shell-protocol.css 不存在，仅写入 console-shared 与 shell 入口");
}

function stripProtocolCompatBlock(text) {
  const start = text.indexOf("/* —— 协议端 HTML");
  if (start === -1) return text;
  const endTag = "console-shared 提供 */";
  const end = text.indexOf(endTag, start);
  if (end === -1) return text;
  return text.slice(end + endTag.length).trim();
}

const shellEntry = `/* 协议端样式入口：与 Pallas WebUI 共用 console-shared（npm run sync:protocol-css 同步） */
@import "./console-shared.css";
@import "./shell-protocol.css";
`;

fs.writeFileSync(outShell, shellEntry, "utf8");

let protocolBody = "";
let preservedExtras = "";
if (protocolExtras.includes(PROTOCOL_EXTRAS_MARKER)) {
  const parts = protocolExtras.split(PROTOCOL_EXTRAS_MARKER);
  protocolBody = stripProtocolCompatBlock(parts[0].trim());
  preservedExtras = parts.slice(1).join(PROTOCOL_EXTRAS_MARKER).trim();
} else if (protocolExtras.includes("协议端壳层")) {
  protocolBody = pruneProtocolCss(protocolExtras);
} else {
  protocolBody = stripProtocolCompatBlock(protocolExtras);
}

if (protocolBody || fs.existsSync(shellProtocolPath) || protocolExtras) {
  const extrasBlock = preservedExtras ? `\n${preservedExtras}\n` : "";
  fs.writeFileSync(
    shellProtocolPath,
    `${PROTOCOL_COMPAT}\n\n${protocolBody.trim()}\n${PROTOCOL_EXTRAS_MARKER}${extrasBlock}`,
    "utf8",
  );
}

console.log(`Wrote ${outShared} (${sharedBody.length} bytes)`);
console.log(`Wrote ${outShell}`);
if (fs.existsSync(shellProtocolPath)) {
  console.log(`Wrote ${shellProtocolPath}`);
}
