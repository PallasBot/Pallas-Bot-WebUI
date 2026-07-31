import { describe, expect, it } from "vitest";
import { buildNamedSeriesTrendPack } from "@/utils/namedSeriesTrend";

describe("buildNamedSeriesTrendPack dual axis", () => {
  it("scales prompt and completion on separate axes", () => {
    const t0 = 1_700_000_000;
    const pack = buildNamedSeriesTrendPack(
      [
        {
          id: "prompt",
          label: "输入",
          axis: "left",
          points: [
            { at: t0, total: 50000 },
            { at: t0 + 3600, total: 40000 },
            { at: t0 + 7200, total: 55000 },
          ],
        },
        {
          id: "completion",
          label: "输出",
          axis: "right",
          points: [
            { at: t0, total: 200 },
            { at: t0 + 3600, total: 180 },
            { at: t0 + 7200, total: 240 },
          ],
        },
      ],
      { axisUnit: "", compact: true },
    );
    expect(pack).not.toBeNull();
    expect(pack!.dualAxis).toBe(true);
    expect(pack!.yTicksRight.length).toBeGreaterThan(0);
    const promptPts = pack!.series.find((s) => s.def.id === "prompt")!.points;
    const completionPts = pack!.series.find((s) => s.def.id === "completion")!.points;
    // 输出虽远小于输入，但应占满右轴高度区间（不全贴底）
    const completionYs = completionPts.map((p) => p.y);
    const promptYs = promptPts.map((p) => p.y);
    const completionSpan = Math.max(...completionYs) - Math.min(...completionYs);
    const promptSpan = Math.max(...promptYs) - Math.min(...promptYs);
    expect(completionSpan).toBeGreaterThan(20);
    expect(promptSpan).toBeGreaterThan(20);
  });
});
