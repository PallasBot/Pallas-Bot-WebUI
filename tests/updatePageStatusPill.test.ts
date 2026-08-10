import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const updatePageStyles = readFileSync(resolve(process.cwd(), "src/styles/update-page.css"), "utf8");

describe("更新页状态标签", () => {
  it("在深色模式为已是最新状态保留足够对比度", () => {
    expect(updatePageStyles).toContain('html[data-theme="dark"] .update-page__status-pill--current');
    expect(updatePageStyles).toContain("color: #bbf7d0;");
    expect(updatePageStyles).toContain("border-color: rgba(74, 222, 128, 0.5);");
    expect(updatePageStyles).toContain("background: rgba(34, 197, 94, 0.16);");
  });
});
