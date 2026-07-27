import type {
  LlmImageMetricBreakdownRow,
  LlmImageMetricsSlice,
  LlmRuntimeDimensionStatsRow,
  LlmTaskMetricRow,
  LlmTaskMetricsSlice,
  LlmTaskStatsData,
  LlmTaskStatsHistoryRow,
  LlmTokenMetricBreakdownRow,
  LlmTokenMetricsSlice,
  LlmRagMetricsSlice,
  LlmGatesSlice,
} from "@/api/pallasTypes";
import { AI_TOKEN_METRIC_LABELS } from "@/config/aiConstants";

export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return todayIso(d);
}

export function formatCompactNumber(n: number): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  // 百万级用两位小数（1.84M），避免一日内增长被一位小数「卡」在 1.8M
  if (abs >= 1_000_000) {
    const digits = abs >= 100_000_000 ? 0 : abs >= 10_000_000 ? 1 : 2;
    return `${(v / 1_000_000).toFixed(digits)}M`;
  }
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

export function metricSum(slice: LlmTaskMetricsSlice | undefined, key: keyof LlmTaskMetricRow): number {
  if (!slice?.by_task) return 0;
  let sum = 0;
  for (const row of Object.values(slice.by_task)) {
    sum += Number(row[key]) || 0;
  }
  return sum;
}

export function stateCount(slice: LlmTaskMetricsSlice | undefined, key: string): number {
  return Number(slice?.state_counts?.[key] ?? 0);
}

/** AI 成功/失败：优先 by_task，其次 state_counts，再回退 provider_stats。 */
export function aiOutcomesFromSlice(ai: LlmTaskMetricsSlice | undefined | null): {
  ok: number;
  fail: number;
} {
  let ok = metricSum(ai ?? undefined, "task_ok");
  let fail = metricSum(ai ?? undefined, "task_fail");
  if (ok + fail > 0) return { ok, fail };
  ok = stateCount(ai ?? undefined, "succeeded");
  fail = stateCount(ai ?? undefined, "failed");
  if (ok + fail > 0) return { ok, fail };
  for (const row of Object.values(ai?.provider_stats ?? {})) {
    ok += Number(row.succeeded ?? (row as { ok?: number }).ok ?? 0) || 0;
    fail += Number(row.failed ?? (row as { fail?: number }).fail ?? 0) || 0;
  }
  return { ok, fail };
}

export function aggregateHistoryAiOutcomes(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): { ok: number; fail: number } {
  let ok = 0;
  let fail = 0;
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const day = aiOutcomesFromSlice(row.ai ?? null);
    ok += day.ok;
    fail += day.fail;
  }
  return { ok, fail };
}

export type DimensionRow = {
  key: string;
  requests: number;
  succeeded: number;
  failed: number;
  avgLatencyMs: number | null;
  recentFailureClass: string;
};

export function dimensionRows(
  source: Record<string, LlmRuntimeDimensionStatsRow> | undefined,
): DimensionRow[] {
  return Object.entries(source ?? {})
    .map(([key, row]) => {
      const succeeded = Number(row.succeeded ?? (row as { ok?: number }).ok ?? 0);
      const failed = Number(row.failed ?? (row as { fail?: number }).fail ?? 0);
      const requests = Number(row.requests ?? 0) || succeeded + failed;
      return {
        key,
        requests,
        succeeded,
        failed,
        avgLatencyMs:
          row.avg_latency_ms != null && Number.isFinite(Number(row.avg_latency_ms))
            ? Number(row.avg_latency_ms)
            : null,
        recentFailureClass: String(row.recent_failure_class ?? "").trim(),
      };
    })
    .filter((row) => row.requests > 0 || row.succeeded > 0 || row.failed > 0)
    .sort((a, b) => b.requests - a.requests || b.failed - a.failed || a.key.localeCompare(b.key));
}

export type DimensionBreakdown = "provider_stats" | "model_stats";

/** 从 history.rows 聚合区间内提供方/模型调用统计。 */
export function aggregateHistoryDimensionRows(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  dimension: DimensionBreakdown,
): DimensionRow[] {
  const merged: Record<
    string,
    {
      requests: number;
      succeeded: number;
      failed: number;
      total_latency_ms: number;
      recent_failure_class: string;
    }
  > = {};
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const slice = row.ai?.[dimension];
    if (!slice || typeof slice !== "object") continue;
    for (const [key, metrics] of Object.entries(slice)) {
      const name = String(key || "").trim();
      if (!name || !metrics || typeof metrics !== "object") continue;
      const succeeded = Number(metrics.succeeded ?? (metrics as { ok?: number }).ok ?? 0);
      const failed = Number(metrics.failed ?? (metrics as { fail?: number }).fail ?? 0);
      const requests = Number(metrics.requests ?? 0) || succeeded + failed;
      const latency = Number(metrics.total_latency_ms ?? 0);
      const dst = merged[name] || {
        requests: 0,
        succeeded: 0,
        failed: 0,
        total_latency_ms: 0,
        recent_failure_class: "",
      };
      dst.requests += requests;
      dst.succeeded += succeeded;
      dst.failed += failed;
      dst.total_latency_ms += Number.isFinite(latency) ? latency : 0;
      const cls = String(metrics.recent_failure_class ?? "").trim();
      if (cls) dst.recent_failure_class = cls;
      merged[name] = dst;
    }
  }
  return dimensionRows(
    Object.fromEntries(
      Object.entries(merged).map(([key, row]) => [
        key,
        {
          requests: row.requests,
          succeeded: row.succeeded,
          failed: row.failed,
          total_latency_ms: row.total_latency_ms,
          avg_latency_ms: row.requests > 0 ? row.total_latency_ms / row.requests : null,
          recent_failure_class: row.recent_failure_class || null,
        },
      ]),
    ),
  );
}

export type TokenRow = {
  key: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costTotal: number;
};

export function tokenRows(source: Record<string, LlmTokenMetricBreakdownRow> | undefined): TokenRow[] {
  return Object.entries(source ?? {})
    .map(([key, row]) => {
      const promptTokens = Number(row.prompt_tokens ?? 0);
      const completionTokens = Number(row.completion_tokens ?? 0);
      return {
        key,
        promptTokens,
        completionTokens,
        cacheReadTokens: Number(row.cache_read_tokens ?? 0),
        cacheWriteTokens: Number(row.cache_write_tokens ?? 0),
        totalTokens: Number(row.total_tokens ?? 0) || promptTokens + completionTokens,
        costTotal: Number(row.cost_total ?? 0),
      };
    })
    .filter((row) => row.totalTokens > 0 || row.cacheReadTokens > 0 || row.cacheWriteTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key));
}

export type TokenBucket = {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costTotal: number;
  costCurrency: string;
};

export function emptyTokenBucket(): TokenBucket {
  return {
    promptTokens: 0,
    completionTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalTokens: 0,
    costTotal: 0,
    costCurrency: "",
  };
}

export function tokensFromSlice(tokens: LlmTokenMetricsSlice | undefined | null): TokenBucket {
  if (!tokens) return emptyTokenBucket();
  const promptTokens = Number(tokens.prompt_tokens ?? 0);
  const completionTokens = Number(tokens.completion_tokens ?? 0);
  return {
    promptTokens,
    completionTokens,
    cacheReadTokens: Number(tokens.cache_read_tokens ?? 0),
    cacheWriteTokens: Number(tokens.cache_write_tokens ?? 0),
    totalTokens: Number(tokens.total_tokens ?? 0) || promptTokens + completionTokens,
    costTotal: Number(tokens.cost_total ?? 0),
    costCurrency: String(tokens.cost_currency || "").trim(),
  };
}

export function addTokenBuckets(a: TokenBucket, b: TokenBucket): TokenBucket {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    costTotal: a.costTotal + b.costTotal,
    costCurrency: a.costCurrency || b.costCurrency,
  };
}

/** 从 history.rows 聚合区间 token（优先 ai.tokens）。 */
export function aggregateHistoryTokens(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): TokenBucket & { days: number; daily: Array<TokenBucket & { date: string }> } {
  const daily: Array<TokenBucket & { date: string }> = [];
  let total = emptyTokenBucket();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const bucket = tokensFromSlice(row.ai?.tokens ?? null);
    daily.push({ date, ...bucket });
    total = addTokenBuckets(total, bucket);
  }
  return { ...total, days: daily.length, daily };
}

export type TokenBreakdownDimension = "by_provider" | "by_model" | "by_task";

/** 从 history.rows 聚合区间内 by_provider / by_model / by_task 分桶。 */
export function aggregateHistoryTokenRows(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  dimension: TokenBreakdownDimension,
): TokenRow[] {
  const merged: Record<
    string,
    {
      prompt_tokens: number;
      completion_tokens: number;
      cache_read_tokens: number;
      cache_write_tokens: number;
      total_tokens: number;
      cost_total: number;
    }
  > = {};
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const slice = row.ai?.tokens?.[dimension];
    if (!slice || typeof slice !== "object") continue;
    for (const [key, metrics] of Object.entries(slice)) {
      const name = String(key || "").trim();
      if (!name || !metrics || typeof metrics !== "object") continue;
      const promptTokens = Number(metrics.prompt_tokens ?? 0);
      const completionTokens = Number(metrics.completion_tokens ?? 0);
      const cacheReadTokens = Number(metrics.cache_read_tokens ?? 0);
      const cacheWriteTokens = Number(metrics.cache_write_tokens ?? 0);
      const totalTokens =
        Number(metrics.total_tokens ?? 0) || promptTokens + completionTokens;
      const costTotal = Number(metrics.cost_total ?? 0);
      const dst = merged[name] || {
        prompt_tokens: 0,
        completion_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        total_tokens: 0,
        cost_total: 0,
      };
      dst.prompt_tokens += promptTokens;
      dst.completion_tokens += completionTokens;
      dst.cache_read_tokens += cacheReadTokens;
      dst.cache_write_tokens += cacheWriteTokens;
      dst.total_tokens += totalTokens;
      dst.cost_total += costTotal;
      merged[name] = dst;
    }
  }
  return tokenRows(merged);
}

/** 仅保留有费用的 token 分桶（费用明细用）。 */
export function aggregateHistoryTokenCostRows(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  dimension: TokenBreakdownDimension,
): TokenRow[] {
  return aggregateHistoryTokenRows(rows, start, end, dimension)
    .filter((row) => row.costTotal > 0)
    .sort((a, b) => b.costTotal - a.costTotal || a.key.localeCompare(b.key));
}

export type ImageBucket = {
  okCount: number;
  failCount: number;
  imageCount: number;
  costTotal: number;
  costCurrency: string;
};

export function emptyImageBucket(): ImageBucket {
  return { okCount: 0, failCount: 0, imageCount: 0, costTotal: 0, costCurrency: "" };
}

export function imagesFromSlice(images: LlmImageMetricsSlice | undefined | null): ImageBucket {
  if (!images) return emptyImageBucket();
  return {
    okCount: Number(images.ok_count ?? 0),
    failCount: Number(images.fail_count ?? 0),
    imageCount: Number(images.image_count ?? 0),
    costTotal: Number(images.cost_total ?? 0),
    costCurrency: String(images.cost_currency || "").trim(),
  };
}

export function addImageBuckets(a: ImageBucket, b: ImageBucket): ImageBucket {
  return {
    okCount: a.okCount + b.okCount,
    failCount: a.failCount + b.failCount,
    imageCount: a.imageCount + b.imageCount,
    costTotal: a.costTotal + b.costTotal,
    costCurrency: a.costCurrency || b.costCurrency,
  };
}

export function aggregateHistoryImages(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): ImageBucket {
  let total = emptyImageBucket();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    total = addImageBuckets(total, imagesFromSlice(row.ai?.images ?? null));
  }
  return total;
}

export type ImageRow = {
  key: string;
  okCount: number;
  failCount: number;
  imageCount: number;
  costTotal: number;
};

export function imageRows(source: Record<string, LlmImageMetricBreakdownRow> | undefined): ImageRow[] {
  return Object.entries(source ?? {})
    .map(([key, row]) => ({
      key,
      okCount: Number(row.ok_count ?? 0),
      failCount: Number(row.fail_count ?? 0),
      imageCount: Number(row.image_count ?? 0),
      costTotal: Number(row.cost_total ?? 0),
    }))
    .filter((row) => row.okCount > 0 || row.failCount > 0 || row.imageCount > 0 || row.costTotal > 0)
    .sort((a, b) => b.okCount - a.okCount || b.failCount - a.failCount || a.key.localeCompare(b.key));
}

export type ImageBreakdownDimension = "by_gateway" | "by_provider" | "by_model";

/** 从 history.rows 聚合区间内画画分桶。 */
export function aggregateHistoryImageRows(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  dimension: ImageBreakdownDimension,
): ImageRow[] {
  const merged: Record<string, LlmImageMetricBreakdownRow> = {};
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const slice = row.ai?.images?.[dimension];
    if (!slice || typeof slice !== "object") continue;
    for (const [key, metrics] of Object.entries(slice)) {
      const name = String(key || "").trim();
      if (!name || !metrics || typeof metrics !== "object") continue;
      const dst = merged[name] || {
        ok_count: 0,
        fail_count: 0,
        image_count: 0,
        cost_total: 0,
      };
      dst.ok_count = Number(dst.ok_count ?? 0) + Number(metrics.ok_count ?? 0);
      dst.fail_count = Number(dst.fail_count ?? 0) + Number(metrics.fail_count ?? 0);
      dst.image_count = Number(dst.image_count ?? 0) + Number(metrics.image_count ?? 0);
      dst.cost_total = Number(dst.cost_total ?? 0) + Number(metrics.cost_total ?? 0);
      merged[name] = dst;
    }
  }
  return imageRows(merged).sort(
    (a, b) => b.costTotal - a.costTotal || b.imageCount - a.imageCount || a.key.localeCompare(b.key),
  );
}

export type RangeCostSummary = {
  tokenCost: number;
  imageCost: number;
  totalCost: number;
  currency: string;
  hasImages: boolean;
  tokenProviderRows: TokenRow[];
  tokenModelRows: TokenRow[];
  tokenTaskRows: TokenRow[];
  imageGatewayRows: ImageRow[];
  imageProviderRows: ImageRow[];
  imageModelRows: ImageRow[];
};

export function buildRangeCostSummary(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): RangeCostSummary {
  const tokens = aggregateHistoryTokens(rows, start, end);
  const images = aggregateHistoryImages(rows, start, end);
  const hasImages =
    images.okCount > 0 || images.failCount > 0 || images.imageCount > 0 || images.costTotal > 0;
  const currency = tokens.costCurrency || images.costCurrency || "";
  return {
    tokenCost: tokens.costTotal,
    imageCost: images.costTotal,
    totalCost: tokens.costTotal + images.costTotal,
    currency,
    hasImages,
    tokenProviderRows: aggregateHistoryTokenCostRows(rows, start, end, "by_provider"),
    tokenModelRows: aggregateHistoryTokenCostRows(rows, start, end, "by_model"),
    tokenTaskRows: aggregateHistoryTokenCostRows(rows, start, end, "by_task"),
    imageGatewayRows: hasImages
      ? aggregateHistoryImageRows(rows, start, end, "by_gateway").filter((r) => r.costTotal > 0)
      : [],
    imageProviderRows: hasImages
      ? aggregateHistoryImageRows(rows, start, end, "by_provider").filter((r) => r.costTotal > 0)
      : [],
    imageModelRows: hasImages
      ? aggregateHistoryImageRows(rows, start, end, "by_model").filter((r) => r.costTotal > 0)
      : [],
  };
}

export type RagBucket = {
  hitCount: number;
  missCount: number;
  skipCount: number;
  hitRate: number;
  byDocument: Record<string, number>;
};

export function emptyRagBucket(): RagBucket {
  return { hitCount: 0, missCount: 0, skipCount: 0, hitRate: 0, byDocument: {} };
}

export function ragFromSlice(rag: LlmRagMetricsSlice | undefined | null): RagBucket {
  if (!rag) return emptyRagBucket();
  const hitCount = Number(rag.hit_count ?? 0);
  const missCount = Number(rag.miss_count ?? 0);
  const skipCount = Number(rag.skip_count ?? 0);
  const total = hitCount + missCount;
  const hitRate =
    rag.hit_rate != null && Number.isFinite(Number(rag.hit_rate))
      ? Number(rag.hit_rate)
      : total > 0
        ? Math.round((1000 * hitCount) / total) / 10
        : 0;
  const byDocument: Record<string, number> = {};
  for (const [key, value] of Object.entries(rag.by_document ?? {})) {
    const name = String(key || "").trim();
    if (!name) continue;
    byDocument[name] = Number(value ?? 0);
  }
  return { hitCount, missCount, skipCount, hitRate, byDocument };
}

export function addRagBuckets(a: RagBucket, b: RagBucket): RagBucket {
  const byDocument: Record<string, number> = { ...a.byDocument };
  for (const [key, value] of Object.entries(b.byDocument)) {
    byDocument[key] = (byDocument[key] || 0) + value;
  }
  const hitCount = a.hitCount + b.hitCount;
  const missCount = a.missCount + b.missCount;
  const skipCount = a.skipCount + b.skipCount;
  const total = hitCount + missCount;
  return {
    hitCount,
    missCount,
    skipCount,
    hitRate: total > 0 ? Math.round((1000 * hitCount) / total) / 10 : 0,
    byDocument,
  };
}

/** 从 history.rows 聚合区间 RAG（优先 ai.rag）。 */
export function aggregateHistoryRag(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  pick: "rag" | "memory_rag" = "rag",
): RagBucket {
  let total = emptyRagBucket();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    total = addRagBuckets(total, ragFromSlice(row.ai?.[pick] ?? null));
  }
  return total;
}

export type RagDocumentRow = {
  key: string;
  hitCount: number;
};

export function ragDocumentRows(byDocument: Record<string, number> | undefined): RagDocumentRow[] {
  return Object.entries(byDocument ?? {})
    .map(([key, hitCount]) => ({ key, hitCount: Number(hitCount) || 0 }))
    .filter((row) => row.hitCount > 0)
    .sort((a, b) => b.hitCount - a.hitCount || a.key.localeCompare(b.key));
}

export type GatesBucket = { skip: number; defer: number; proceed: number };

export function emptyGatesBucket(): GatesBucket {
  return { skip: 0, defer: 0, proceed: 0 };
}

export function gatesFromSlice(gates: LlmGatesSlice | undefined | null): GatesBucket {
  if (!gates) return emptyGatesBucket();
  return {
    skip: Number(gates.skip ?? 0),
    defer: Number(gates.defer ?? 0),
    proceed: Number(gates.proceed ?? 0),
  };
}

export function aggregateHistoryGates(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): GatesBucket {
  const total = emptyGatesBucket();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const g = gatesFromSlice(row.ai?.gates ?? null);
    total.skip += g.skip;
    total.defer += g.defer;
    total.proceed += g.proceed;
  }
  return total;
}

export type DailyTokenPoint = { date: string; totalTokens: number; cacheHitRate: number };

export function dailyTokenTrend(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): DailyTokenPoint[] {
  const out: DailyTokenPoint[] = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const bucket = tokensFromSlice(row.ai?.tokens ?? null);
    const denom = bucket.promptTokens + bucket.cacheReadTokens;
    const cacheHitRate = denom > 0 ? Math.round((1000 * bucket.cacheReadTokens) / denom) / 10 : 0;
    out.push({ date, totalTokens: bucket.totalTokens, cacheHitRate });
  }
  return out;
}

export type DailyRagPoint = { date: string; hitRate: number; queries: number };

export function dailyRagTrend(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  pick: "rag" | "memory_rag" = "rag",
): DailyRagPoint[] {
  const out: DailyRagPoint[] = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const rag = ragFromSlice(row.ai?.[pick] ?? null);
    out.push({
      date,
      hitRate: rag.hitRate,
      queries: rag.hitCount + rag.missCount,
    });
  }
  return out;
}

/** 闭区间逐日 ISO 日期（含起止）。 */
export function eachIsoDay(start: string, end: string): string[] {
  const sd = String(start || "").slice(0, 10);
  const ed = String(end || "").slice(0, 10);
  if (!sd || !ed || sd > ed) return [];
  const out: string[] = [];
  let cur = sd;
  while (cur <= ed) {
    out.push(cur);
    cur = addDaysIso(cur, 1);
  }
  return out;
}

export type TrendPoint = { at: number; total: number };

/** 按日补齐缺失日为 0，保证折线连续。 */
export function padDailyTrendPoints(
  points: TrendPoint[],
  start: string,
  end: string,
): TrendPoint[] {
  const byDay = new Map<string, number>();
  for (const p of points) {
    const day = new Date((Number(p.at) || 0) * 1000);
    if (Number.isNaN(day.getTime())) continue;
    const key = todayIso(day);
    byDay.set(key, Number(p.total) || 0);
  }
  return eachIsoDay(start, end).map((day) => ({
    at: Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000),
    total: byDay.get(day) ?? 0,
  }));
}

/** 按小时补齐 00..(endHour) 为 0；endHour 默认取已有最大小时或 23。 */
export function padHourlyTrendPoints(points: TrendPoint[], dayIso: string, endHour?: number): TrendPoint[] {
  const day = String(dayIso || "").slice(0, 10);
  if (!day) return [];
  const byHour = new Map<number, number>();
  let maxH = 0;
  for (const p of points) {
    const d = new Date((Number(p.at) || 0) * 1000);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    byHour.set(h, Number(p.total) || 0);
    if (h > maxH) maxH = h;
  }
  const last =
    endHour != null && Number.isFinite(endHour)
      ? Math.min(23, Math.max(0, Math.floor(endHour)))
      : Math.max(maxH, points.length ? maxH : 0);
  const out: TrendPoint[] = [];
  for (let h = 0; h <= last; h += 1) {
    out.push({
      at: Math.floor(new Date(`${day}T${String(h).padStart(2, "0")}:00:00`).getTime() / 1000),
      total: byHour.get(h) ?? 0,
    });
  }
  return out;
}

export type DailyIoPoint = {
  date: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costTotal: number;
};

/** 区间按日输入 / 输出 / 费用（缺日不出现，配合 padDailyTrendPoints）。 */
export function dailyTokenIoTrend(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): DailyIoPoint[] {
  const out: DailyIoPoint[] = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const bucket = tokensFromSlice(row.ai?.tokens ?? null);
    out.push({
      date,
      promptTokens: bucket.promptTokens,
      completionTokens: bucket.completionTokens,
      totalTokens: bucket.totalTokens,
      costTotal: bucket.costTotal,
    });
  }
  return out;
}

export type DailyCostPoint = {
  date: string;
  tokenCost: number;
  imageCost: number;
  totalCost: number;
};

export function dailyCostTrend(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): DailyCostPoint[] {
  const out: DailyCostPoint[] = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const tokenCost = tokensFromSlice(row.ai?.tokens ?? null).costTotal;
    const imageCost = imagesFromSlice(row.ai?.images ?? null).costTotal;
    out.push({
      date,
      tokenCost,
      imageCost,
      totalCost: tokenCost + imageCost,
    });
  }
  return out;
}

export type DailySuccessPoint = { date: string; successRate: number; total: number };

export function dailyAiSuccessTrend(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): DailySuccessPoint[] {
  const out: DailySuccessPoint[] = [];
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const { ok, fail } = aiOutcomesFromSlice(row.ai ?? null);
    const total = ok + fail;
    out.push({
      date,
      total,
      successRate: total > 0 ? Math.round((1000 * ok) / total) / 10 : 0,
    });
  }
  return out;
}

function dayAtNoonSec(day: string): number {
  return Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000);
}

/** 把按日字段转成可补零的趋势点。 */
export function dailyFieldToTrendPoints(
  rows: Array<{ date: string; value: number }>,
): TrendPoint[] {
  return rows.map((r) => ({
    at: dayAtNoonSec(String(r.date).slice(0, 10)),
    total: Number(r.value) || 0,
  }));
}

/** 区间内有 Token / 检索等用量的日期（供日历禁空日）。 */
export function daysWithTokenActivity(
  rows: LlmTaskStatsHistoryRow[] | undefined,
): Set<string> {
  const out = new Set<string>();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date) continue;
    const tokens = tokensFromSlice(row.ai?.tokens ?? null);
    if (tokens.totalTokens > 0 || tokens.cacheReadTokens > 0) {
      out.add(date);
      continue;
    }
    const rag = ragFromSlice(row.ai?.rag ?? null);
    const mem = ragFromSlice(row.ai?.memory_rag ?? null);
    if (rag.hitCount + rag.missCount + mem.hitCount + mem.missCount > 0) {
      out.add(date);
    }
  }
  return out;
}

/** 按提供方拆分的日 Token 序列（缺日补 0 后可堆叠）。 */
export function dailyProviderTokenSeries(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
  maxProviders = 8,
): NamedSeriesLike[] {
  const byProvider = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const breakdown = row.ai?.tokens?.by_provider;
    if (!breakdown || typeof breakdown !== "object") continue;
    for (const [key, metrics] of Object.entries(breakdown)) {
      const name = String(key || "").trim();
      if (!name || !metrics || typeof metrics !== "object") continue;
      const prompt = Number((metrics as LlmTokenMetricBreakdownRow).prompt_tokens ?? 0);
      const completion = Number((metrics as LlmTokenMetricBreakdownRow).completion_tokens ?? 0);
      const total =
        Number((metrics as LlmTokenMetricBreakdownRow).total_tokens ?? 0) || prompt + completion;
      if (total <= 0) continue;
      if (!byProvider.has(name)) byProvider.set(name, new Map());
      const dayMap = byProvider.get(name)!;
      dayMap.set(date, (dayMap.get(date) || 0) + total);
      totals.set(name, (totals.get(name) || 0) + total);
    }
  }
  const ranked = [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, maxProviders)
    .map(([name]) => name);
  return ranked.map((name) => {
    const dayMap = byProvider.get(name) || new Map();
    const raw = eachIsoDay(start, end).map((day) => ({
      at: dayAtNoonSec(day),
      total: dayMap.get(day) || 0,
    }));
    return { id: `provider:${name}`, label: name, points: raw };
  });
}

type NamedSeriesLike = {
  id: string;
  label: string;
  points: TrendPoint[];
};

export type KnowledgeInventory = {
  sourceCount: number;
  chunkCount: number;
  topSources: Array<{ id: string; title: string; chunkCount: number }>;
};

export function summarizeKnowledgeInventory(
  items: Array<{
    source_id?: string;
    title?: string;
    chunk_count?: number;
  }>,
): KnowledgeInventory {
  const topSources = items
    .map((row) => ({
      id: String(row.source_id || "").trim(),
      title: String(row.title || row.source_id || "").trim() || "未命名",
      chunkCount: Number(row.chunk_count ?? 0) || 0,
    }))
    .filter((row) => row.id)
    .sort((a, b) => b.chunkCount - a.chunkCount || a.title.localeCompare(b.title, "zh-CN"));
  return {
    sourceCount: topSources.length,
    chunkCount: topSources.reduce((s, r) => s + r.chunkCount, 0),
    topSources: topSources.slice(0, 8),
  };
}

export function aggregateHistoryRoutes(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  start: string,
  end: string,
): Record<string, number> {
  const routes: Record<string, number> = {};
  for (const row of rows ?? []) {
    const date = String(row.date || "").slice(0, 10);
    if (!date || date < start || date > end) continue;
    const byTask = row.bot?.by_task ?? {};
    for (const taskRow of Object.values(byTask)) {
      const rc = taskRow?.route_counts;
      if (!rc) continue;
      for (const [route, count] of Object.entries(rc)) {
        const key = String(route || "").trim();
        if (!key) continue;
        routes[key] = (routes[key] || 0) + (Number(count) || 0);
      }
    }
  }
  return routes;
}

export function hourTokenRows(
  byHour: Record<string, LlmTokenMetricBreakdownRow> | undefined,
): TokenRow[] {
  return Object.entries(byHour ?? {})
    .map(([key, row]) => {
      const promptTokens = Number(row.prompt_tokens ?? 0);
      const completionTokens = Number(row.completion_tokens ?? 0);
      return {
        key,
        promptTokens,
        completionTokens,
        cacheReadTokens: Number(row.cache_read_tokens ?? 0),
        cacheWriteTokens: Number(row.cache_write_tokens ?? 0),
        totalTokens: Number(row.total_tokens ?? 0) || promptTokens + completionTokens,
        costTotal: Number(row.cost_total ?? 0),
      };
    })
    .filter((row) => row.totalTokens > 0 || row.cacheReadTokens > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** 把 by_hour 桶转成趋势点；hourKey 支持 "0"/"00"/"0:00" 等。 */
export function hourlyTokenTrendPoints(
  byHour: Record<string, LlmTokenMetricBreakdownRow> | undefined,
  dayIso: string,
): Array<{ at: number; total: number }> {
  const day = String(dayIso || "").slice(0, 10);
  if (!day) return [];
  return hourTokenRows(byHour).map((row) => {
    const raw = String(row.key || "").trim();
    const hour = Math.min(23, Math.max(0, parseInt(raw.replace(/:.*/, ""), 10) || 0));
    const at = Math.floor(new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime() / 1000);
    return { at, total: row.totalTokens };
  });
}

/** 当日按小时：输入 / 输出两条序列（缺小时补 0）。 */
export function hourlyTokenIoTrendSeries(
  rows: TokenRow[],
  dayIso: string,
  endHour?: number,
): Array<{ id: string; label: string; points: Array<{ at: number; total: number }> }> {
  const day = String(dayIso || "").slice(0, 10);
  if (!day) return [];
  const promptRaw: TrendPoint[] = [];
  const completionRaw: TrendPoint[] = [];
  for (const row of rows) {
    const raw = String(row.key || "").trim();
    const hour = Math.min(23, Math.max(0, parseInt(raw.replace(/:.*/, ""), 10) || 0));
    const at = Math.floor(new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime() / 1000);
    promptRaw.push({ at, total: row.promptTokens });
    completionRaw.push({ at, total: row.completionTokens });
  }
  if (!promptRaw.length && !completionRaw.length) return [];
  return [
    {
      id: "prompt",
      label: AI_TOKEN_METRIC_LABELS.prompt,
      points: padHourlyTrendPoints(promptRaw, day, endHour),
    },
    {
      id: "completion",
      label: AI_TOKEN_METRIC_LABELS.completion,
      points: padHourlyTrendPoints(completionRaw, day, endHour),
    },
  ];
}

export function summarizeTaskStats(stats: LlmTaskStatsData | undefined) {
  const bot = stats?.bot;
  const ai = stats?.ai;
  const rag = ragFromSlice(ai?.rag);
  const memoryRag = ragFromSlice(ai?.memory_rag);
  const gates = gatesFromSlice(ai?.gates);
  const cacheDenom = Number(ai?.tokens?.prompt_tokens ?? 0) + Number(ai?.tokens?.cache_read_tokens ?? 0);
  const cacheHitRate =
    cacheDenom > 0
      ? Math.round((1000 * Number(ai?.tokens?.cache_read_tokens ?? 0)) / cacheDenom) / 10
      : 0;
  const tokens = tokensFromSlice(ai?.tokens);
  const outcomes = aiOutcomesFromSlice(ai);
  return {
    reachable: stats?.ai_reachable,
    botOk: metricSum(bot, "submit_ok") + metricSum(bot, "callback_ok"),
    aiOk: outcomes.ok,
    aiFail: outcomes.fail,
    aiQueued: stateCount(ai, "queued"),
    aiRunning: stateCount(ai, "running"),
    tokens,
    tokenModelRows: tokenRows(ai?.tokens?.by_model),
    tokenProviderRows: tokenRows(ai?.tokens?.by_provider),
    tokenTaskRows: tokenRows(ai?.tokens?.by_task),
    tokenHourRows: hourTokenRows(ai?.tokens?.by_hour),
    cacheHitRate,
    images: imagesFromSlice(ai?.images),
    imageGatewayRows: imageRows(ai?.images?.by_gateway),
    imageProviderRows: imageRows(ai?.images?.by_provider),
    imageModelRows: imageRows(ai?.images?.by_model),
    rag,
    memoryRag,

    ragDocumentRows: ragDocumentRows(rag.byDocument),
    gates,
    providerRows: dimensionRows(ai?.provider_stats),
    modelRows: dimensionRows(ai?.model_stats),
  };
}

export function historySparkPoints(
  rows: LlmTaskStatsHistoryRow[] | undefined,
  pick: (row: LlmTaskStatsHistoryRow) => number,
): number[] {
  return (rows ?? []).map((row) => pick(row));
}

export function buildPersistenceHint(p: LlmTaskStatsData["persistence"] | null | undefined): string {
  if (!p) return "持久化状态未知。";
  const parts: string[] = [];
  parts.push(p.bot_collecting ? "Bot 正在记录任务" : "Bot 暂无新任务统计");
  if (p.ai_reachable) {
    parts.push(p.ai_collecting ? "正在记录 token / 任务" : "暂无新的 token 数据");
  } else {
    parts.push("实时统计不可用时，仍可看已保存的历史");
  }
  parts.push("按天保存，重启后仍可查看近期趋势");
  return parts.join(" · ");
}
