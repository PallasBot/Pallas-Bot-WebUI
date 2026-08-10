import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("图表悬停提示定位", () => {
  it("让各类图表按悬停点的纵坐标定位提示", () => {
    for (const path of [
      "src/components/ChartsNamedSeriesTrend.tsx",
      "src/components/GsDualAxisTrendChart.tsx",
      "src/components/ChartsDailyBarChart.tsx",
      "src/components/HomeBucketChartSvg.tsx",
      "src/components/HomeHourlyChartSvg.tsx",
    ]) {
      expect(read(path)).toContain("tooltipY");
    }

    const appStyles = read("src/styles/console/app.css");
    const trendStyles = read("src/styles/gs-trend-chart.css");
    expect(appStyles).not.toContain(".home-plugin-chart-tooltip {\n  position: absolute;\n  top:");
    expect(appStyles).not.toContain(".charts-daily-bar__tooltip {\n  position: absolute;\n  top:");
    expect(trendStyles).not.toContain(".gs-trend-chart__tooltip {\n  position: absolute;\n  top:");
  });
});
