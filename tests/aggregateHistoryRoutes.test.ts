import { describe, expect, it } from "vitest";

import { aggregateHistoryRoutes } from "@/utils/aiTaskStats";
import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";

describe("aggregateHistoryRoutes", () => {
  it("excludes Repeater corpus_select even when bucketed under other task", () => {
    const rows: LlmTaskStatsHistoryRow[] = [
      {
        date: "2026-07-26",
        bot: {
          source: "bot",
          day_key: "2026-07-26",
          by_task: {
            llm_chat: {
              route_counts: { plain_llm_chat: 3, alias: 2 },
            },
            other: {
              route_counts: { corpus_select: 334 },
            },
          },
          totals: {},
        },
      },
    ];

    const out = aggregateHistoryRoutes(rows, "2026-07-26", "2026-07-26");
    expect(out).toEqual({ plain_llm_chat: 3, alias: 2 });
    expect(out.corpus_select).toBeUndefined();
  });
});
