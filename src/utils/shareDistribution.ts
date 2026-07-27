import { type TokenRow } from "@/utils/aiTaskStats";

/** 占比文案：小份额保留一位小数，避免被抹成 0%。 */
export function formatSharePercent(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return "0%";
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}

/** 把计数项转成 Share 图用的 TokenRow（复用 totalTokens 字段）。 */
export function countShareRows(parts: Array<{ key: string; count: number }>): TokenRow[] {
  return parts
    .filter((p) => p.count > 0)
    .map((p) => ({
      key: p.key,
      totalTokens: p.count,
      promptTokens: 0,
      completionTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      costTotal: 0,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key));
}
