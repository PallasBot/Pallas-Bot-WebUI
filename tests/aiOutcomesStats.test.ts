import { describe, expect, it } from "vitest";

import {
  aggregateHistoryAiOutcomes,
  aiOutcomesFromSlice,
  summarizeTaskStats,
} from "@/utils/aiTaskStats";
import type { LlmTaskStatsData, LlmTaskStatsHistoryRow } from "@/api/pallasTypes";

describe("aiOutcomesFromSlice", () => {
  it("falls back to provider_stats when by_task is empty", () => {
    const out = aiOutcomesFromSlice({
      by_task: {},
      state_counts: { succeeded: 0, failed: 0 },
      provider_stats: {
        ds: { requests: 10, succeeded: 8, failed: 2 },
        local: { requests: 5, succeeded: 4, failed: 1 },
      },
    } as never);
    expect(out).toEqual({ ok: 12, fail: 3 });
  });

  it("prefers by_task over provider_stats", () => {
    const out = aiOutcomesFromSlice({
      by_task: { llm_chat: { task_ok: 3, task_fail: 1 } },
      provider_stats: { ds: { succeeded: 100, failed: 50 } },
    } as never);
    expect(out).toEqual({ ok: 3, fail: 1 });
  });
});

describe("aggregateHistoryAiOutcomes", () => {
  it("sums provider outcomes across selected days", () => {
    const rows: LlmTaskStatsHistoryRow[] = [
      {
        date: "2026-07-24",
        ai: {
          provider_stats: { ds: { succeeded: 10, failed: 1 } },
        } as never,
      },
      {
        date: "2026-07-25",
        ai: {
          provider_stats: { ds: { succeeded: 20, failed: 2 } },
        } as never,
      },
    ];
    expect(aggregateHistoryAiOutcomes(rows, "2026-07-25", "2026-07-25")).toEqual({
      ok: 20,
      fail: 2,
    });
    expect(aggregateHistoryAiOutcomes(rows, "2026-07-24", "2026-07-25")).toEqual({
      ok: 30,
      fail: 3,
    });
  });
});

describe("summarizeTaskStats", () => {
  it("exposes provider-backed aiOk/aiFail", () => {
    const stats: LlmTaskStatsData = {
      ai_reachable: true,
      bot: { by_task: {} },
      ai: {
        by_task: {},
        tokens: {
          source: "bot",
          day_key: "2026-07-25",
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          by_task: {},
        },
        provider_stats: { ds: { requests: 10, succeeded: 9, failed: 1 } },
      },
    } as never;
    const summary = summarizeTaskStats(stats);
    expect(summary.aiOk).toBe(9);
    expect(summary.aiFail).toBe(1);
  });
});
