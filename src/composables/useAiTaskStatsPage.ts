import { computed, ref } from "vue";
import { fetchLlmTaskStats } from "@/api/consoleApi";
import type {
  LlmRuntimeDimensionStatsRow,
  LlmTaskMetricRow,
  LlmTaskMetricsSlice,
  LlmTaskStatsData,
  LlmTokenMetricBreakdownRow,
} from "@/api/pallasTypes";

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map((x) => Number(x));
  if (!y || !m) {
    const t = todayIso();
    return { start: t, end: t };
  }
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

function metricSum(slice: LlmTaskMetricsSlice | undefined, key: keyof LlmTaskMetricRow): number {
  if (!slice?.by_task) return 0;
  let sum = 0;
  for (const row of Object.values(slice.by_task)) {
    sum += Number(row[key]) || 0;
  }
  return sum;
}

function stateCount(slice: LlmTaskMetricsSlice | undefined, key: string): number {
  return Number(slice?.state_counts?.[key] ?? 0);
}

function taskMetricValue(slice: LlmTaskMetricsSlice | undefined, task: string, key: keyof LlmTaskMetricRow): number {
  const row = slice?.by_task?.[task];
  return Number(row?.[key] ?? 0);
}

function dimensionRows(
  source: Record<string, LlmRuntimeDimensionStatsRow> | undefined,
): Array<{
  key: string;
  requests: number;
  succeeded: number;
  failed: number;
  avgLatencyMs: number | null;
  recentFailureClass: string;
}> {
  return Object.entries(source ?? {})
    .map(([key, row]) => ({
      key,
      requests: Number(row.requests ?? 0),
      succeeded: Number(row.succeeded ?? 0),
      failed: Number(row.failed ?? 0),
      avgLatencyMs:
        row.avg_latency_ms != null && Number.isFinite(Number(row.avg_latency_ms))
          ? Number(row.avg_latency_ms)
          : null,
      recentFailureClass: String(row.recent_failure_class ?? "").trim(),
    }))
    .filter((row) => row.requests > 0 || row.succeeded > 0 || row.failed > 0)
    .sort((a, b) => b.requests - a.requests || b.failed - a.failed || a.key.localeCompare(b.key));
}

function tokenRows(
  source: Record<string, LlmTokenMetricBreakdownRow> | undefined,
): Array<{
  key: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
}> {
  return Object.entries(source ?? {})
    .map(([key, row]) => ({
      key,
      totalTokens: Number(row.total_tokens ?? 0) || Number(row.prompt_tokens ?? 0) + Number(row.completion_tokens ?? 0),
      promptTokens: Number(row.prompt_tokens ?? 0),
      completionTokens: Number(row.completion_tokens ?? 0),
    }))
    .filter((row) => row.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens || a.key.localeCompare(b.key));
}

function routeRows(slice: LlmTaskMetricsSlice | undefined): Array<{ key: string; count: number }> {
  const merged = new Map<string, number>();
  for (const row of Object.values(slice?.by_task ?? {})) {
    for (const [route, count] of Object.entries(row.route_counts ?? {})) {
      merged.set(route, (merged.get(route) ?? 0) + (Number(count) || 0));
    }
  }
  return [...merged.entries()]
    .map(([key, count]) => ({ key, count }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function dailyRouteHeatmap(rows: Array<{ date: string; ai?: LlmTaskMetricsSlice | null }>) {
  return rows
    .map((row) => ({
      date: row.date,
      value: routeRows(row.ai ?? undefined).reduce((sum, item) => sum + item.count, 0),
    }))
    .filter((row) => row.date);
}

export function buildPersistenceHint(p: {
  bot_collecting?: boolean;
  ai_collecting?: boolean;
  ai_reachable?: boolean;
  store_file?: string;
} | null | undefined): string {
  if (!p) return "统计持久化状态暂时未知。";
  const parts: string[] = [];
  parts.push(p.bot_collecting ? "Bot 侧正在持续记录任务变化" : "Bot 侧暂时没有新的任务统计");
  if (p.ai_reachable) {
    parts.push(p.ai_collecting ? "AI 侧正在持续记录调用结果" : "AI 侧暂时没有新的调用统计");
  } else {
    parts.push("AI 侧当前不可达，本页只显示已保存的历史趋势");
  }
  parts.push("统计会按天自动保存，刷新页面或服务重启后仍可查看近期趋势");
  return parts.join(" · ");
}

export function useAiTaskStatsPage() {
  const loading = ref(false);
  const err = ref("");
  const month = ref(currentMonthIso());
  const start = ref("");
  const end = ref(todayIso());
  const stats = ref<LlmTaskStatsData | null>(null);

  const queryRange = computed(() => {
    const bounds = monthBounds(month.value);
    const from = start.value || bounds.start;
    const to = end.value || bounds.end;
    return {
      start: from <= to ? from : to,
      end: from <= to ? to : from,
    };
  });

  const botSuccess = computed(() => metricSum(stats.value?.bot, "submit_ok") + metricSum(stats.value?.bot, "callback_ok"));
  const aiSuccess = computed(() => metricSum(stats.value?.ai, "task_ok"));
  const aiFailed = computed(() => metricSum(stats.value?.ai, "task_fail"));
  const aiQueued = computed(() => stateCount(stats.value?.ai, "queued"));
  const aiRunning = computed(() => stateCount(stats.value?.ai, "running"));

  const failureRows = computed(() =>
    Object.entries(stats.value?.ai?.failure_counts ?? {})
      .map(([key, count]) => ({
        key,
        label: key.split("_").join(" "),
        count: Number(count) || 0,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  );

  const providerRows = computed(() => dimensionRows(stats.value?.ai?.provider_stats));
  const modelRows = computed(() => dimensionRows(stats.value?.ai?.model_stats));
  const tokenProviderRows = computed(() => tokenRows(stats.value?.ai?.tokens?.by_provider));
  const tokenModelRows = computed(() => tokenRows(stats.value?.ai?.tokens?.by_model));
  const routeRowsTop = computed(() => routeRows(stats.value?.ai).slice(0, 8));

  const historyRows = computed(() => stats.value?.history?.rows ?? []);
  const historyBotPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: metricSum(row.bot ?? undefined, "submit_ok") + metricSum(row.bot ?? undefined, "callback_ok"),
    })),
  );
  const historyAiPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: metricSum(row.ai ?? undefined, "task_ok"),
    })),
  );
  const historyAiFailPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: metricSum(row.ai ?? undefined, "task_fail"),
    })),
  );
  const historyPlainLlmChatPoints = computed(() =>
    historyRows.value.map((row) => {
      const ok = taskMetricValue(row.ai ?? undefined, "plain_llm_chat", "task_ok");
      const fail = taskMetricValue(row.ai ?? undefined, "plain_llm_chat", "task_fail");
      return {
        date: row.date,
        value: ok + fail,
      };
    }),
  );
  const historyPlainLlmChatSuccessPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: taskMetricValue(row.ai ?? undefined, "plain_llm_chat", "task_ok"),
    })),
  );
  const historyPlainLlmChatFailPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: taskMetricValue(row.ai ?? undefined, "plain_llm_chat", "task_fail"),
    })),
  );
  const historyBotCallbackPoints = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      value: metricSum(row.bot ?? undefined, "callback_ok"),
    })),
  );
  const historyRouteHeatPoints = computed(() => dailyRouteHeatmap(historyRows.value));
  const historyDailyRows = computed(() =>
    historyRows.value.map((row) => ({
      date: row.date,
      botSubmit: metricSum(row.bot ?? undefined, "submit_ok"),
      botCallback: metricSum(row.bot ?? undefined, "callback_ok"),
      aiOk: metricSum(row.ai ?? undefined, "task_ok"),
      aiFail: metricSum(row.ai ?? undefined, "task_fail"),
      queued: stateCount(row.ai ?? undefined, "queued"),
      running: stateCount(row.ai ?? undefined, "running"),
      routes: routeRows(row.ai ?? undefined).slice(0, 3),
    })),
  );

  const persistenceHint = computed(() => {
    return buildPersistenceHint(stats.value?.persistence);
  });

  async function refresh() {
    loading.value = true;
    err.value = "";
    try {
      stats.value = await fetchLlmTaskStats(queryRange.value);
    } catch (e) {
      err.value = e instanceof Error ? e.message : String(e);
      stats.value = null;
    } finally {
      loading.value = false;
    }
  }

  function resetMonthRange() {
    const bounds = monthBounds(month.value);
    start.value = bounds.start;
    end.value = bounds.end;
  }

  return {
    loading,
    err,
    month,
    start,
    end,
    stats,
    queryRange,
    botSuccess,
    aiSuccess,
    aiFailed,
    aiQueued,
    aiRunning,
    failureRows,
    providerRows,
    modelRows,
    tokenProviderRows,
    tokenModelRows,
    routeRowsTop,
    historyBotPoints,
    historyBotCallbackPoints,
    historyAiPoints,
    historyAiFailPoints,
    historyPlainLlmChatPoints,
    historyPlainLlmChatSuccessPoints,
    historyPlainLlmChatFailPoints,
    historyRouteHeatPoints,
    historyDailyRows,
    persistenceHint,
    refresh,
    resetMonthRange,
  };
}
