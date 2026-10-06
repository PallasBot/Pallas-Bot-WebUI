import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const consoleHubCss = readFileSync(fileURLToPath(new URL("./console-hub.css", import.meta.url)), "utf8");
const mobileStart = consoleHubCss.indexOf(
  "@media (max-width: 560px) {\n  :is(.plugins-page, .instances-page, .protocol-page, .database-page, .plugin-config-workspace__chrome)",
);
const mobileEnd = consoleHubCss.indexOf("\n}\n", mobileStart);
const mobileStyles = consoleHubCss.slice(mobileStart, mobileEnd);

describe("插件配置工具条窄屏布局", () => {
  it("保留单行局部横滚，右侧操作静态显示以避免重叠", () => {
    expect(mobileStart).toBeGreaterThan(-1);
    expect(mobileEnd).toBeGreaterThan(mobileStart);
    expect(mobileStyles).toMatch(
      /\.plugin-config-workspace__chrome\)\s+\.console-hub-page__chrome-row \{\s+flex-wrap: nowrap;\s+overflow-x: auto;/,
    );
    expect(mobileStyles).toMatch(
      /\.plugin-config-workspace__chrome\)\s+\.console-hub-page__chrome-row > \.chrome-tools__trailing \{\s+position: static;/,
    );

    const desktopRow = consoleHubCss.match(/\.console-hub-page__chrome-row \{[^}]+\}/)?.[0];
    expect(desktopRow).toContain("flex-wrap: nowrap;");
    expect(desktopRow).toContain("overflow-x: auto;");
  });
});
