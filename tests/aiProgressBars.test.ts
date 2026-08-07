import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const progressPath = resolve(process.cwd(), "src/components/ai/AiProgressBar.tsx");
const tokenShareBars = readFileSync(resolve(process.cwd(), "src/components/ai/TokenShareBars.tsx"), "utf8");
const statisticsPage = readFileSync(resolve(process.cwd(), "src/pages/ai/AiStatisticsPage.tsx"), "utf8");

describe("AI 观测占比条", () => {
  it("将截图中的轨道样式收敛为共享组件", () => {
    expect(existsSync(progressPath)).toBe(true);
    const progress = readFileSync(progressPath, "utf8");
    expect(progress).toContain('"h-2.5 overflow-hidden rounded-full border border-border/80 bg-muted"');
    expect(progress).toContain('transition-[width]');
    expect(progress).toContain('role="progressbar"');
  });

  it("让占比列表与 AI 观测明细复用同一个进度条", () => {
    expect(tokenShareBars).toContain('import AiProgressBar from "@/components/ai/AiProgressBar";');
    expect(tokenShareBars).toContain("<AiProgressBar");
    expect(statisticsPage).toContain('import AiProgressBar from "@/components/ai/AiProgressBar";');
    expect(statisticsPage.match(/<AiProgressBar/g)).toHaveLength(3);
  });
});
