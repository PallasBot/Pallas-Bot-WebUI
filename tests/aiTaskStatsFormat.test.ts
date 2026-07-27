import { describe, expect, it } from "vitest";

import {
  formatCompactNumber,
  hourlyTokenIoTrendSeries,
  padDailyTrendPoints,
  padHourlyTrendPoints,
  summarizeKnowledgeInventory,
  type TokenRow,
} from "@/utils/aiTaskStats";

describe("formatCompactNumber", () => {
  it("shows two decimals for 1M–10M so daily growth is visible", () => {
    expect(formatCompactNumber(1_843_886)).toBe("1.84M");
    expect(formatCompactNumber(1_849_999)).toBe("1.85M");
    expect(formatCompactNumber(9_999_999)).toBe("10.00M");
  });

  it("reduces precision at larger magnitudes", () => {
    expect(formatCompactNumber(12_345_678)).toBe("12.3M");
    expect(formatCompactNumber(123_456_789)).toBe("123M");
  });
});

describe("hourlyTokenIoTrendSeries", () => {
  it("builds prompt and completion series and pads missing hours", () => {
    const rows: TokenRow[] = [
      {
        key: "13",
        promptTokens: 100,
        completionTokens: 20,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 120,
        costTotal: 0,
      },
      {
        key: "14",
        promptTokens: 50,
        completionTokens: 80,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalTokens: 130,
        costTotal: 0,
      },
    ];
    const series = hourlyTokenIoTrendSeries(rows, "2026-07-27");
    expect(series.map((s) => s.id)).toEqual(["prompt", "completion"]);
    expect(series[0].points).toHaveLength(15);
    expect(series[0].points[13].total).toBe(100);
    expect(series[0].points[14].total).toBe(50);
    expect(series[1].points[13].total).toBe(20);
    expect(series[1].points[14].total).toBe(80);
  });
});

describe("padDailyTrendPoints / padHourlyTrendPoints", () => {
  it("fills missing days with zeros", () => {
    const padded = padDailyTrendPoints(
      [{ at: Math.floor(new Date("2026-07-25T12:00:00").getTime() / 1000), total: 10 }],
      "2026-07-25",
      "2026-07-27",
    );
    expect(padded).toHaveLength(3);
    expect(padded.map((p) => p.total)).toEqual([10, 0, 0]);
  });

  it("fills missing hours with zeros", () => {
    const day = "2026-07-27";
    const at2 = Math.floor(new Date(`${day}T02:00:00`).getTime() / 1000);
    const padded = padHourlyTrendPoints([{ at: at2, total: 5 }], day, 3);
    expect(padded.map((p) => p.total)).toEqual([0, 0, 5, 0]);
  });
});

describe("summarizeKnowledgeInventory", () => {
  it("sums sources and chunks", () => {
    const inv = summarizeKnowledgeInventory([
      { source_id: "a", title: "A", chunk_count: 3 },
      { source_id: "b", title: "B", chunk_count: 10 },
    ]);
    expect(inv.sourceCount).toBe(2);
    expect(inv.chunkCount).toBe(13);
    expect(inv.topSources[0]?.id).toBe("b");
  });
});
