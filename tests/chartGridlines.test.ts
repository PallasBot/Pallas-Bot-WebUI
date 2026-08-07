import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const trendStyles = readFileSync(resolve(process.cwd(), "src/styles/gs-trend-chart.css"), "utf8");
const bucketStyles = readFileSync(resolve(process.cwd(), "src/styles/home-bucket-chart.css"), "utf8");
const hourlyStyles = readFileSync(resolve(process.cwd(), "src/styles/home-hourly-chart.css"), "utf8");
const appStyles = readFileSync(resolve(process.cwd(), "src/styles/console/app.css"), "utf8");
const hourlyChart = readFileSync(resolve(process.cwd(), "src/components/HomeHourlyChartSvg.tsx"), "utf8");

function rule(styles: string, selector: string) {
  return styles.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
}

describe("图表纵轴网格线", () => {
  it("将所有带纵轴刻度图表的横线设为统一虚线", () => {
    expect(rule(trendStyles, ".gs-trend-chart__grid")).toContain("stroke-dasharray: 4 4;");
    expect(rule(bucketStyles, ".home-plugin-bucket-chart__svg .home-plugin-bucket__grid")).toContain("stroke-dasharray: 4 4;");
    expect(rule(hourlyStyles, ".home-plugin-hourly-chart__svg .home-plugin-bucket__grid")).toContain("stroke-dasharray: 4 4;");
    expect(rule(appStyles, ".charts-daily-bar__grid")).toContain("stroke-dasharray: 4 4;");
  });

  it("略微加深纵轴网格虚线，同时保持四类图表一致", () => {
    for (const styles of [trendStyles, bucketStyles, hourlyStyles, appStyles]) {
      expect(styles).toContain("stroke: color-mix(in srgb, var(--border-strong) 100%, transparent);");
    }
  });

  it("让小时图使用共享的纵轴网格和刻度样式", () => {
    expect(hourlyChart).toContain('className="home-plugin-bucket__grid"');
    expect(hourlyChart).toContain('className="home-plugin-bucket__ytick"');
    expect(hourlyChart).toContain('className="home-plugin-bucket__xtick"');
  });
});
