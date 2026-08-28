/**
 * AI 统计计费导出：把统计页当前区间的费用 / Token / 画画聚合结果拼成多段 CSV。
 * 纯前端生成（与日志导出同思路），口径与页面各卡片、明细表一致。
 */
import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";
import { labelLlmTask } from "@/utils/aiHistoryLabels";
import {
  imagesFromSlice,
  tokensFromSlice,
  type ImageBucket,
  type ImageRow,
  type RangeCostSummary,
  type TokenBucket,
  type TokenRow,
} from "@/utils/aiTaskStats";

export type AiBillingExportData = {
  start: string;
  end: string;
  historyRows: LlmTaskStatsHistoryRow[] | undefined;
  /** 选中区间的 Token 汇总（selectedRange）。 */
  rangeTokens: TokenBucket;
  /** 选中区间的画画汇总（selectedImages）。 */
  rangeImages: ImageBucket;
  /** 费用 tab 的区间费用明细（rangeCost）。 */
  rangeCost: RangeCostSummary;
};

type CsvSection = {
  title: string;
  header: string[];
  rows: Array<Array<string | number>>;
};

/** 区间内是否有任何计费 / 用量数据，用于导出前的空数据提示。 */
export function aiBillingHasData(data: AiBillingExportData): boolean {
  const { rangeTokens: tokens, rangeImages: images } = data;
  return (
    tokens.totalTokens > 0 ||
    tokens.cacheWriteTokens > 0 ||
    tokens.costTotal > 0 ||
    images.okCount > 0 ||
    images.failCount > 0 ||
    images.imageCount > 0 ||
    images.costTotal > 0
  );
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 费用保留 4 位小数（与页面展示一致），去掉求和产生的浮点噪声。 */
function csvCost(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function csvSectionsToText(sections: CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (!section.rows.length) continue;
    if (lines.length) lines.push("");
    lines.push(section.title);
    lines.push(section.header.map(csvCell).join(","));
    for (const row of section.rows) {
      lines.push(row.map(csvCell).join(","));
    }
  }
  if (!lines.length) return "";
  return lines.join("\r\n") + "\r\n";
}

function tokenSection(title: string, rows: TokenRow[]): CsvSection {
  return {
    title,
    header: [
      "名称",
      "Token 总量",
      "输入 Token",
      "输出 Token",
      "缓存读 Token",
      "缓存写 Token",
      "费用",
    ],
    rows: rows.map((row) => [
      labelLlmTask(row.key),
      row.totalTokens,
      row.promptTokens,
      row.completionTokens,
      row.cacheReadTokens,
      row.cacheWriteTokens,
      csvCost(row.costTotal),
    ]),
  };
}

function imageSection(title: string, rows: ImageRow[]): CsvSection {
  return {
    title,
    header: ["名称", "成功", "失败", "张数", "费用"],
    rows: rows.map((row) => [
      row.key,
      row.okCount,
      row.failCount,
      row.imageCount,
      csvCost(row.costTotal),
    ]),
  };
}

function dailyBillingRows(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): Array<Array<string | number>> {
  const result: Array<Array<string | number>> = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const tokens = tokensFromSlice(row.ai?.tokens ?? null);
    const images = imagesFromSlice(row.ai?.images ?? null);
    const active =
      tokens.totalTokens > 0 ||
      tokens.cacheWriteTokens > 0 ||
      tokens.costTotal > 0 ||
      images.okCount > 0 ||
      images.failCount > 0 ||
      images.imageCount > 0 ||
      images.costTotal > 0;
    if (!active) continue;
    result.push([
      date,
      tokens.totalTokens,
      tokens.promptTokens,
      tokens.completionTokens,
      tokens.cacheReadTokens,
      tokens.cacheWriteTokens,
      csvCost(tokens.costTotal),
      images.okCount,
      images.failCount,
      images.imageCount,
      csvCost(images.costTotal),
      csvCost(tokens.costTotal + images.costTotal),
    ]);
  }
  return result.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

/**
 * 生成计费统计 CSV（BOM + CRLF，Excel 可直接打开）。
 * 返回 csv 与数据行数（不含段标题 / 表头）；区间无数据时 csv 为空字符串。
 */
export function buildAiBillingCsv(
  data: AiBillingExportData,
): { csv: string; rowCount: number } {
  if (!aiBillingHasData(data)) return { csv: "", rowCount: 0 };
  const { start, end, rangeTokens: tokens, rangeImages: images, rangeCost } = data;
  const currency = rangeCost.currency || tokens.costCurrency || images.costCurrency || "";
  const summary: CsvSection = {
    title: "区间汇总",
    header: ["指标", "数值"],
    rows: [
      ["统计区间", start === end ? start : `${start} ~ ${end}`],
      ["费用币种", currency || "未指定"],
      ["Token 总量", tokens.totalTokens],
      ["输入 Token", tokens.promptTokens],
      ["输出 Token", tokens.completionTokens],
      ["缓存读 Token", tokens.cacheReadTokens],
      ["缓存写 Token", tokens.cacheWriteTokens],
      ["Token 费用", csvCost(rangeCost.tokenCost)],
      ["出图成功", images.okCount],
      ["出图失败", images.failCount],
      ["出图张数", images.imageCount],
      ["画画费用", csvCost(rangeCost.imageCost)],
      ["合计费用", csvCost(rangeCost.totalCost)],
    ],
  };
  const daily: CsvSection = {
    title: "每日明细",
    header: [
      "日期",
      "Token 总量",
      "输入 Token",
      "输出 Token",
      "缓存读 Token",
      "缓存写 Token",
      "Token 费用",
      "出图成功",
      "出图失败",
      "出图张数",
      "画画费用",
      "合计费用",
    ],
    rows: dailyBillingRows(data.historyRows, start, end),
  };
  const sections = [
    summary,
    daily,
    tokenSection("Token 按 Provider", rangeCost.tokenProviderRows),
    tokenSection("Token 按模型", rangeCost.tokenModelRows),
    tokenSection("Token 按任务", rangeCost.tokenTaskRows),
  ];
  if (rangeCost.hasImages) {
    sections.push(
      imageSection("画画按网关", rangeCost.imageGatewayRows),
      imageSection("画画按 Provider", rangeCost.imageProviderRows),
      imageSection("画画按模型", rangeCost.imageModelRows),
    );
  }
  const body = csvSectionsToText(sections);
  if (!body) return { csv: "", rowCount: 0 };
  const rowCount = sections.reduce((sum, section) => sum + section.rows.length, 0);
  return { csv: `\uFEFFAI 计费统计\r\n\r\n${body}`, rowCount };
}

function exportStamp(): string {
  const now = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

export function aiBillingExportFilename(start: string, end: string): string {
  return `pallas-ai-billing_${start}_${end}_${exportStamp()}.csv`;
}

export function downloadCsvFile(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
