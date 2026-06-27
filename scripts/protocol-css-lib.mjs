/** 协议端 console-shared.css 抽取逻辑（sync / check 共用） */
import fs from "node:fs";

export const EXTRACT_RANGES = [
  [1, 245],
  [247, 306],
  [308, 2131],
  [2189, 2233],
  [1366, 1369],
  [1946, 2009],
  [3675, 4093],
  [4718, 4835],
  [4837, 4843],
  [5215, 5363],
  [5424, 5429],
  [5431, 5693],
  [7467, 7540],
];

export function buildConsoleSharedCss(appCssPath, generatedAt = new Date().toISOString()) {
  const lines = fs.readFileSync(appCssPath, "utf8").split("\n");
  const chunks = EXTRACT_RANGES.map(([start, end]) => lines.slice(start - 1, end).join("\n"));
  return `/* 由 Pallas-Bot-WebUI/scripts/sync-protocol-console-css.mjs 生成 — 勿手改 */
/* 源文件：src/styles/app.css  生成时间：${generatedAt} */

${chunks.join("\n\n")}
`;
}
