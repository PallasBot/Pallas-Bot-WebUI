import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const updatePageStyles = readFileSync(resolve(process.cwd(), "src/styles/update-page.css"), "utf8");
const updatePage = readFileSync(resolve(process.cwd(), "src/pages/UpdatePage.tsx"), "utf8");

describe("更新页状态标签", () => {
  it("使用共享成功与警告变体，而非页面专用颜色", () => {
    expect(updatePage).toContain('variant="success"');
    expect(updatePage).toContain('variant="warn"');
    expect(updatePageStyles).not.toContain(".update-page__status-pill--current,");
    expect(updatePageStyles).not.toContain(".update-page__status-pill--available {");
  });
});
