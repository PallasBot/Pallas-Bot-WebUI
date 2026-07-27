import { describe, expect, it } from "vitest";

import { aggregateHistoryTokenRows } from "@/utils/aiTaskStats";
import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";

describe("aggregateHistoryTokenRows", () => {
  const rows: LlmTaskStatsHistoryRow[] = [
    {
      date: "2026-07-26",
      ai: {
        tokens: {
          by_provider: {
            ds: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
            local: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
          },
          by_model: {
            "deepseek-v4-flash": { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
          },
          by_task: {
            llm_chat: { prompt_tokens: 110, completion_tokens: 21, total_tokens: 131 },
          },
        },
      },
    },
    {
      date: "2026-07-27",
      ai: {
        tokens: {
          by_provider: {
            packy: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
            ds: { prompt_tokens: 50, completion_tokens: 5, total_tokens: 55 },
          },
          by_model: {
            "gpt-x": { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
          },
          by_task: {
            llm_chat: { prompt_tokens: 80, completion_tokens: 15, total_tokens: 95 },
          },
        },
      },
    },
  ];

  it("merges by_provider across the selected date range", () => {
    const out = aggregateHistoryTokenRows(rows, "2026-07-26", "2026-07-27", "by_provider");
    const byKey = Object.fromEntries(out.map((r) => [r.key, r.totalTokens]));
    expect(byKey.ds).toBe(175);
    expect(byKey.packy).toBe(40);
    expect(byKey.local).toBe(11);
  });

  it("respects the date filter", () => {
    const out = aggregateHistoryTokenRows(rows, "2026-07-27", "2026-07-27", "by_provider");
    expect(out.map((r) => r.key).sort()).toEqual(["ds", "packy"]);
    expect(out.find((r) => r.key === "ds")?.totalTokens).toBe(55);
  });
});
