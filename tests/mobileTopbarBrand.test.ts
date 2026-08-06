import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const appShell = readFileSync(resolve(process.cwd(), "src/layout/AppShell.tsx"), "utf8");

describe("移动顶栏品牌", () => {
  it("使用带连字符的 Pallas-Bot 名称", () => {
    const mobileTopbar = appShell.match(/\{isNarrow \? \([\s\S]*?\) : null\}/)?.[0];

    expect(mobileTopbar).toContain("Pallas-Bot");
    expect(mobileTopbar).not.toContain("Pallas Bot");
  });
});
