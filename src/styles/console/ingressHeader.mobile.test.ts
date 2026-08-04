import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const appCss = readFileSync(fileURLToPath(new URL("./app.css", import.meta.url)), "utf8");

describe("入站调度标题栏窄屏样式", () => {
  it("状态与刷新控件保持在标题同一行", () => {
    const baseRule = appCss.indexOf(".charts-page__ingress-header {\n  display: flex;");
    const mobileRule = appCss.lastIndexOf("@media (max-width: 560px) {\n  .charts-page__ingress-header {");

    expect(baseRule).toBeGreaterThan(-1);
    expect(mobileRule).toBeGreaterThan(baseRule);
    const mobileStyles = appCss.slice(mobileRule, mobileRule + 360);
    expect(mobileStyles).toContain("flex-direction: row;");
    expect(mobileStyles).toContain("flex-wrap: nowrap;");
    expect(mobileStyles).not.toContain("width: 100%;");
  });
});
