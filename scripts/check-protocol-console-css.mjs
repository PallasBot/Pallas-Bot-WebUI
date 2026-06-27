/**
 * 校验 Protocol 插件 console-shared.css 是否与 app.css 抽取结果一致。
 * Protocol 仓不在工作区时跳过（exit 0）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConsoleSharedCss } from "./protocol-css-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webuiRoot = path.resolve(__dirname, "..");
const appCssPath = path.join(webuiRoot, "src/styles/app.css");
const sharedPath = path.resolve(
  webuiRoot,
  "../Pallas-Plugin-Protocol/src/pallas_plugin_protocol/web/static/pallas_ui/console-shared.css",
);

if (!fs.existsSync(sharedPath)) {
  console.warn(`skip check: ${sharedPath} not found`);
  process.exit(0);
}

const expected = buildConsoleSharedCss(appCssPath);
const actual = fs.readFileSync(sharedPath, "utf8");

function normalizeCss(text) {
  return text
    .replace(/^\/\* 源文件：.*\n/m, "")
    .replace(/^\/\*  生成时间：.*\n/m, "")
    .trim();
}

if (normalizeCss(expected) !== normalizeCss(actual)) {
  console.error(
    "console-shared.css is out of date — run: npm run sync:protocol-css (in Pallas-Bot-WebUI)",
  );
  process.exit(1);
}

console.log("protocol console-shared.css is in sync with app.css");
