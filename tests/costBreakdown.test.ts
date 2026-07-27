import { describe, expect, it } from "vitest";

import {
  aggregateHistoryImageRows,
  aggregateHistoryTokenCostRows,
  buildRangeCostSummary,
} from "@/utils/aiTaskStats";
import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";

const rows: LlmTaskStatsHistoryRow[] = [
  {
    date: "2026-07-26",
    ai: {
      tokens: {
        source: "ledger",
        day_key: "2026-07-26",
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        cost_total: 0.5,
        cost_currency: "CNY",
        by_task: {},
        by_provider: {
          ds: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            cost_total: 0.5,
          },
        },
        by_model: {
          m1: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
            cost_total: 0.5,
          },
        },
      },
      images: {
        ok_count: 2,
        fail_count: 0,
        image_count: 2,
        cost_total: 0.2,
        cost_currency: "CNY",
        by_provider: { packy: { ok_count: 2, image_count: 2, cost_total: 0.2 } },
        by_model: { flux: { ok_count: 2, image_count: 2, cost_total: 0.2 } },
        by_gateway: { provider: { ok_count: 2, image_count: 2, cost_total: 0.2 } },
      },
    },
  },
  {
    date: "2026-07-27",
    ai: {
      tokens: {
        source: "ledger",
        day_key: "2026-07-27",
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
        cost_total: 0.1,
        cost_currency: "CNY",
        by_task: {
          llm_chat: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            cost_total: 0.1,
          },
        },
        by_provider: {
          packy: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15,
            cost_total: 0.1,
          },
        },
        by_model: {},
      },
    },
  },
];

describe("cost breakdown helpers", () => {
  it("aggregates token cost rows by provider for the range", () => {
    const out = aggregateHistoryTokenCostRows(rows, "2026-07-26", "2026-07-27", "by_provider");
    expect(out.map((r) => r.key).sort()).toEqual(["ds", "packy"]);
    expect(out.find((r) => r.key === "ds")?.costTotal).toBeCloseTo(0.5);
    expect(out.find((r) => r.key === "packy")?.costTotal).toBeCloseTo(0.1);
  });

  it("aggregates image cost rows and omits empty days", () => {
    const out = aggregateHistoryImageRows(rows, "2026-07-26", "2026-07-27", "by_provider");
    expect(out).toHaveLength(1);
    expect(out[0]?.key).toBe("packy");
    expect(out[0]?.costTotal).toBeCloseTo(0.2);
  });

  it("builds combined cost summary", () => {
    const summary = buildRangeCostSummary(rows, "2026-07-26", "2026-07-27");
    expect(summary.tokenCost).toBeCloseTo(0.6);
    expect(summary.imageCost).toBeCloseTo(0.2);
    expect(summary.totalCost).toBeCloseTo(0.8);
    expect(summary.hasImages).toBe(true);
    expect(summary.currency).toBe("CNY");
  });

  it("marks hasImages false when no draw activity in range", () => {
    const summary = buildRangeCostSummary(rows, "2026-07-27", "2026-07-27");
    expect(summary.hasImages).toBe(false);
    expect(summary.imageCost).toBe(0);
    expect(summary.totalCost).toBeCloseTo(0.1);
  });
});
