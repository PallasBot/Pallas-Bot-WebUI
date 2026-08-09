import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const appStyles = readFileSync(resolve(process.cwd(), "src/styles/console/app.css"), "utf8");
const panelBorder = "var(--surface-edge, var(--border))";

describe("日志面板描边", () => {
  it("在浅色 solid 表面保留现有 hub 面板描边", () => {
    const logPanels = appStyles.match(/html\[data-layout="hub"\]\[data-surface="solid"\]\[data-theme="light"\][\s\S]*?\.logs-page > \.logs-page__panel \{[\s\S]*?\}/)?.[0];
    const errorPanels = appStyles.match(/html\[data-layout="hub"\]\[data-surface="solid"\]\[data-theme="light"\][\s\S]*?\.log-errors-page > \.log-errors-page__panel \{[\s\S]*?\}/)?.[0];

    expect(logPanels).toContain(panelBorder);
    expect(errorPanels).toContain(panelBorder);
  });
});
