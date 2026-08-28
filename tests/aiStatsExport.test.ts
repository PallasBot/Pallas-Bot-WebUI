import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";
import {
  aiBillingExportFilename,
  aiBillingHasData,
  buildAiBillingCsv,
  type AiBillingExportData,
} from "@/utils/aiStatsExport";
import {
  aggregateHistoryImages,
  aggregateHistoryTokens,
  buildRangeCostSummary,
} from "@/utils/aiTaskStats";

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
        by_task: { llm_chat: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost_total: 0.5 } },
        by_provider: {
          "ds, main": { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost_total: 0.5 },
        },
        by_model: { m1: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cost_total: 0.5 } },
      },
      images: {
        ok_count: 2,
        fail_count: 1,
        image_count: 3,
        cost_total: 0.2,
        cost_currency: "CNY",
        by_gateway: { provider: { ok_count: 2, fail_count: 1, image_count: 3, cost_total: 0.2 } },
        by_provider: { packy: { ok_count: 2, fail_count: 1, image_count: 3, cost_total: 0.2 } },
        by_model: { flux: { ok_count: 2, fail_count: 1, image_count: 3, cost_total: 0.2 } },
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
        cost_total: 0.25,
        cost_currency: "CNY",
        by_task: {},
        by_provider: { ds: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost_total: 0.25 } },
        by_model: { m2: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost_total: 0.25 } },
      },
    },
  },
  // 区间外与无用量日：都不应出现在每日明细里
  {
    date: "2026-07-25",
    ai: {
      tokens: {
        source: "ledger",
        day_key: "2026-07-25",
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
        cost_total: 1,
        by_task: {},
        by_provider: {},
        by_model: {},
      },
    },
  },
  { date: "2026-07-28", ai: { tokens: { source: "ledger", day_key: "2026-07-28", prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, by_task: {}, by_provider: {}, by_model: {} } } },
];

function buildExportData(start = "2026-07-26", end = "2026-07-27"): AiBillingExportData {
  return {
    start,
    end,
    historyRows: rows,
    rangeTokens: aggregateHistoryTokens(rows, start, end),
    rangeImages: aggregateHistoryImages(rows, start, end),
    rangeCost: buildRangeCostSummary(rows, start, end),
  };
}

function csvLines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, "").split("\r\n");
}

describe("AI 计费导出", () => {
  it("按区间汇总 / 每日 / Token / 画画分节导出 CSV", () => {
    const { csv, rowCount } = buildAiBillingCsv(buildExportData());
    expect(csv).toBeTruthy();

    const lines = csvLines(csv);
    expect(lines[0]).toBe("AI 计费统计");
    expect(lines[2]).toBe("区间汇总");
    expect(lines).toContain("统计区间,2026-07-26 ~ 2026-07-27");
    expect(lines).toContain("费用币种,CNY");
    expect(lines).toContain("Token 总量,135");
    expect(lines).toContain("合计费用,0.95");

    expect(lines).toContain("每日明细");
    expect(lines).toContain("2026-07-26,120,100,20,0,0,0.5,2,1,3,0.2,0.7");
    expect(lines).toContain("2026-07-27,15,10,5,0,0,0.25,0,0,0,0,0.25");
    expect(lines.join("\n")).not.toContain("2026-07-25");
    expect(lines.join("\n")).not.toContain("2026-07-28");

    expect(lines).toContain("Token 按 Provider");
    expect(lines).toContain('"ds, main",120,100,20,0,0,0.5');
    expect(lines).toContain("ds,15,10,5,0,0,0.25");
    expect(lines).toContain("Token 按任务");
    expect(lines).toContain("对话,120,100,20,0,0,0.5");

    expect(lines).toContain("画画按 Provider");
    expect(lines).toContain("packy,2,1,3,0.2");

    // 段顺序：汇总 → 每日 → Token 三维 → 画画三维
    const titles = [
      "区间汇总",
      "每日明细",
      "Token 按 Provider",
      "Token 按模型",
      "Token 按任务",
      "画画按网关",
      "画画按 Provider",
      "画画按模型",
    ];
    const indexes = titles.map((title) => lines.indexOf(title));
    expect(indexes.every((idx) => idx > 0)).toBe(true);
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);

    expect(rowCount).toBe(13 + 2 + 2 + 2 + 1 + 3);
  });

  it("单日区间与无画画时省略画画分节", () => {
    const data = buildExportData("2026-07-27", "2026-07-27");
    const { csv } = buildAiBillingCsv(data);
    const lines = csvLines(csv);
    expect(lines).toContain("统计区间,2026-07-27");
    expect(lines).not.toContain("画画按网关");
    expect(lines).toContain("每日明细");
  });

  it("区间无任何用量时返回空 CSV", () => {
    const empty = buildExportData("2026-08-01", "2026-08-02");
    expect(aiBillingHasData(empty)).toBe(false);
    expect(buildAiBillingCsv(empty)).toEqual({ csv: "", rowCount: 0 });
  });

  it("文件名带区间与时间戳", () => {
    expect(aiBillingExportFilename("2026-07-26", "2026-07-27")).toMatch(
      /^pallas-ai-billing_2026-07-26_2026-07-27_\d{8}-\d{4}\.csv$/,
    );
  });

  it("统计页把导出按钮注册到观测工具条 trailing", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ai/AiStatisticsPage.tsx"),
      "utf8",
    );
    expect(page).toContain("trailing: exportButton");
    expect(page).toContain("buildAiBillingCsv(data)");
  });
});
