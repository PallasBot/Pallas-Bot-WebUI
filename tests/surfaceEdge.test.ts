import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const hubStyles = readFileSync(resolve(process.cwd(), "src/styles/console/console-hub.css"), "utf8");
const tokens = readFileSync(resolve(process.cwd(), "src/styles/console/tokens.css"), "utf8");

describe("控制台外框", () => {
  it("让浅色纯色与玻璃外框使用更淡的统一基准", () => {
    for (const styles of [hubStyles, tokens]) {
      expect(styles).toContain("--border-base: hsl(240 4% 85%);");
      expect(styles).toContain("--surface-edge-glass: hsl(240 4% 85% / 0.4);");
    }
  });
});
