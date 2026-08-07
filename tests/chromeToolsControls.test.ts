import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const hubStyles = readFileSync(resolve(process.cwd(), "src/styles/console/console-hub.css"), "utf8");

describe("全局工具条控件", () => {
  it("使用更紧凑的统一控件高度", () => {
    const chromeTools = hubStyles.match(/\.console-hub-page__chrome-tools,\n\.chrome-tools \{[\s\S]*?\n\}/)?.[0];

    expect(chromeTools).toContain("--chrome-field-h: 32px;");
    expect(chromeTools).toContain("--chrome-tabs-h: 32px;");
  });

  it("让中性控件沿用 outline 按钮的描边", () => {
    const controls = hubStyles.match(/\/\* 工具条中性控件：描边与 outline 按钮一致 \*\/[\s\S]*?\n\}/)?.[0];

    expect(controls).toContain(".chrome-tools select");
    expect(controls).toContain(".chrome-tools input:not([type=\"checkbox\"]):not([type=\"radio\"])");
    expect(controls).toContain(".chrome-tools button[role=\"combobox\"]");
    expect(controls).toContain("border-color: color-mix(in srgb, var(--foreground, var(--text)) 10%, transparent) !important;");
  });
});
