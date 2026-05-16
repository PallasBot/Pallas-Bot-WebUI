/**
 * 从 WebUI app.css 抽取与协议端共用的控制台样式，写入 Pallas-Bot 静态资源。
 * 运行：npm run sync:protocol-css（在 Pallas-Bot-WebUI 目录）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webuiRoot = path.resolve(__dirname, "..");
const appCssPath = path.join(webuiRoot, "src/styles/app.css");
const outShared = path.resolve(
  webuiRoot,
  "../Pallas-Bot/src/plugins/pallas_protocol/web/static/pallas_ui/console-shared.css",
);
const outShell = path.resolve(
  webuiRoot,
  "../Pallas-Bot/src/plugins/pallas_protocol/web/static/pallas_ui/shell.css",
);
const shellProtocolPath = path.resolve(
  webuiRoot,
  "../Pallas-Bot/src/plugins/pallas_protocol/web/static/pallas_ui/shell-protocol.css",
);

/** 与 app.css 行号同步；结构大改时需更新 */
const EXTRACT_RANGES = [
  [1, 245],
  [247, 306],
  [308, 2131],
  [1366, 1369],
  [1946, 2009],
  [4718, 4835],
  [4837, 4843],
  [5215, 5363],
  [5424, 5429],
  [5431, 5693],
];

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
}

.btn.danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-color: rgba(252, 165, 165, 0.55);
  color: #fff;
  box-shadow: 0 1px 6px rgba(220, 38, 38, 0.35);
}
.btn.danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border-color: rgba(254, 202, 202, 0.75);
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

/* 协议页：无 secondary 的 .btn 视为主按钮（WebUI 默认 .btn 为中性） */
.proto-shell .btn:not(.secondary):not(.danger):not(.linkish):not(.active):not(.btn--primary) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 78%, #ffffff 22%) 0%,
    color-mix(in srgb, var(--accent) 92%, #000000 8%) 100%
  );
  border-color: color-mix(in srgb, var(--accent) 48%, transparent);
  color: #fff;
  box-shadow: 0 0 24px var(--accent-glow);
}
.proto-shell .btn:not(.secondary):not(.danger):not(.linkish):not(.active):not(.btn--primary):hover:not(:disabled) {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 62%, #ffffff 38%) 0%,
    color-mix(in srgb, var(--accent) 82%, #ffffff 18%) 100%
  );
  border-color: color-mix(in srgb, var(--accent) 58%, transparent);
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
const chunks = EXTRACT_RANGES.map(([start, end]) => lines.slice(start - 1, end).join("\n"));
const sharedBody = `/* 由 Pallas-Bot-WebUI/scripts/sync-protocol-console-css.mjs 生成 — 勿手改 */
/* 源文件：src/styles/app.css  生成时间：${new Date().toISOString()} */

${chunks.join("\n\n")}
`;

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
if (protocolExtras.includes(PROTOCOL_EXTRAS_MARKER)) {
  protocolBody = stripProtocolCompatBlock(
    protocolExtras.split(PROTOCOL_EXTRAS_MARKER)[0].trim(),
  );
} else if (protocolExtras.includes("协议端壳层")) {
  protocolBody = pruneProtocolCss(protocolExtras);
} else {
  protocolBody = stripProtocolCompatBlock(protocolExtras);
}

if (protocolBody || fs.existsSync(shellProtocolPath) || protocolExtras) {
  fs.writeFileSync(
    shellProtocolPath,
    `${PROTOCOL_COMPAT}\n\n${protocolBody.trim()}\n${PROTOCOL_EXTRAS_MARKER}\n`,
    "utf8",
  );
}

console.log(`Wrote ${outShared} (${sharedBody.length} bytes)`);
console.log(`Wrote ${outShell}`);
