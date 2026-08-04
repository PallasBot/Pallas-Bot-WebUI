import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appCss = readFileSync(fileURLToPath(new URL("./app.css", import.meta.url)), "utf8");

describe("入站调度标题栏窄屏样式", () => {
  it("在基础标题栏样式之后覆盖为左对齐", () => {
    const baseRule = appCss.indexOf(".charts-page__ingress-header {\n  display: flex;");
    const mobileRule = appCss.lastIndexOf("@media (max-width: 560px) {\n  .charts-page__ingress-header {");

    expect(baseRule).toBeGreaterThan(-1);
    expect(mobileRule).toBeGreaterThan(baseRule);
    expect(appCss.slice(mobileRule, mobileRule + 180)).toContain("align-items: flex-start;");
  });
});
