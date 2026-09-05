import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appCss = readFileSync(fileURLToPath(new URL("./app.css", import.meta.url)), "utf8");

function ruleFor(selector: string): string {
  const start = appCss.lastIndexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const end = appCss.indexOf("\n}", start);
  return appCss.slice(start, end);
}

describe("日志报错列表布局", () => {
  it("列表溢出时保持展开卡片完整并让堆栈在卡片内滚动", () => {
    const cardRule = ruleFor(".log-error-card");
    const expandedRule = ruleFor(".log-error-card--expanded");
    const tracebackRule = ruleFor(".log-error-card--expanded .log-error-card__tb");

    expect(cardRule).toContain("flex: 0 0 auto;");
    expect(expandedRule).toContain("flex: 0 0 auto;");
    expect(expandedRule).not.toContain("flex: 1 1 0;");
    expect(tracebackRule).toContain("max-height: min(70vh, 720px);");
    expect(tracebackRule).toContain("overflow: auto;");
  });
});
