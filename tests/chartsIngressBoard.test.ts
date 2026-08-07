import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const chartsPage = readFileSync(resolve(process.cwd(), "src/pages/ChartsPage.tsx"), "utf8");
const appStyles = readFileSync(resolve(process.cwd(), "src/styles/console/app.css"), "utf8");

describe("入站调度看板布局", () => {
  it("让近期压力在趋势图下方独占整行", () => {
    expect(chartsPage).toContain('className={cn(CHART_PANEL, "charts-page__ingress-pressure-panel")}');
    expect(appStyles).toContain(".charts-page__ingress-pressure-panel { grid-column: 1 / -1; }");
  });

  it("让时间范围选择器使用控制台标准输入边框", () => {
    expect(appStyles).toContain("border: 1px solid var(--input);");
  });
});
