import { describe, expect, it } from "vitest";

import { aggregateHistoryDimensionRows } from "@/utils/aiTaskStats";
import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";

describe("aggregateHistoryDimensionRows", () => {
  const rows: LlmTaskStatsHistoryRow[] = [
    {
      date: "2026-07-26",
      ai: {
        source: "bot",
        day_key: "2026-07-26",
        by_task: {},
        totals: {},
        provider_stats: {
          ds: { requests: 10, succeeded: 9, failed: 1, total_latency_ms: 900, avg_latency_ms: 90 },
        },
        model_stats: {
          m1: { requests: 10, succeeded: 9, failed: 1, total_latency_ms: 900, avg_latency_ms: 90 },
        },
      },
    },
    {
      date: "2026-07-27",
      ai: {
        source: "bot",
        day_key: "2026-07-27",
        by_task: {},
        totals: {},
        provider_stats: {
          ds: { requests: 5, succeeded: 5, failed: 0, total_latency_ms: 500, avg_latency_ms: 100 },
          packy: { requests: 2, succeeded: 2, failed: 0, total_latency_ms: 200, avg_latency_ms: 100 },
        },
        model_stats: {},
      },
    },
  ];

  it("sums provider_stats across the selected range", () => {
    const out = aggregateHistoryDimensionRows(rows, "2026-07-26", "2026-07-27", "provider_stats");
    expect(out.find((r) => r.key === "ds")?.requests).toBe(15);
    expect(out.find((r) => r.key === "packy")?.requests).toBe(2);
  });
});
