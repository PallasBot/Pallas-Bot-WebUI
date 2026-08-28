import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  CircleOff,
  Cloud,
  Coins,
  Database,
  Download,
  Filter,
  ImageIcon,
  Library,
  LineChart,
  MessageCircle,
  Send,
  Wifi,
  WifiOff,
  Wrench,
  XCircle,
} from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import ConsoleHint from "@/components/ConsoleHint";
import AiProgressBar from "@/components/ai/AiProgressBar";
import {
  fetchConversationKernelKnowledgeSources,
  fetchLlmTaskStats,
} from "@/api/fullConsole";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import ShareDistribution from "@/components/ai/ShareDistribution";
import ChartsNamedSeriesTrend from "@/components/ChartsNamedSeriesTrend";
import DateModeFilter from "@/components/DateModeFilter";
import IconStatCard from "@/components/IconStatCard";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import StatsSectionLabel from "@/components/StatsSectionLabel";
import PendingValue from "@/components/PendingValue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  addDaysIso,
  aggregateHistoryAiOutcomes,
  aggregateHistoryDimensionRows,
  aggregateHistoryGates,
  aggregateHistoryImages,
  aggregateHistoryImageRows,
  aggregateHistoryRag,
  aggregateHistoryRoutes,
  aggregateHistorySpeak,
  aggregateHistoryTokenRows,
  aggregateHistoryTokens,
  aggregateHistoryTools,
  buildPersistenceHint,
  buildRangeCostSummary,
  dailyAiSuccessTrend,
  dailyCostTrend,
  dailyFieldToTrendPoints,
  dailyProviderTokenSeries,
  dailyRagTrend,
  dailyTokenIoTrend,
  dailyTokenTrend,
  daysWithTokenActivity,
  formatCompactNumber,
  hourTokenRows,
  hourlyTokenIoTrendSeries,
  padDailyTrendPoints,
  ragDocumentRows,
  speakTriggerTotal,
  summarizeKnowledgeInventory,
  summarizeTaskStats,
  todayIso,
  toolCallTotal,
  type DimensionRow,
  type ImageRow,
  type TokenBucket,
  type TokenRow,
} from "@/utils/aiTaskStats";
import { AI_TOKEN_METRIC_LABELS } from "@/config/aiConstants";
import { Button } from "@/components/ui/button";
import { fixedChartPalette } from "@/utils/chartTheme";
import { countShareRows } from "@/utils/shareDistribution";
import { labelLlmRoute, labelLlmTask } from "@/utils/aiHistoryLabels";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  aiBillingExportFilename,
  aiBillingHasData,
  buildAiBillingCsv,
  downloadCsvFile,
  type AiBillingExportData,
} from "@/utils/aiStatsExport";
import type { LlmStickerVisionStats } from "@/api/pallasTypes";
import type { NamedSeriesInput } from "@/utils/namedSeriesTrend";

const TAB_STORAGE_KEY = "pallas.ai-statistics.active-tab";
const EMPTY_STICKER_VISION: LlmStickerVisionStats = {
  requests: 0,
  selected: 0,
  failed: 0,
  skipped: 0,
  no_match: 0,
  sent: 0,
  delivery_failed: 0,
  candidate_total: 0,
  avg_duration_ms: null,
  recent_error: null,
  recent: [],
};
const TAB_OPTIONS = [
  { value: "overview", label: "概览" },
  { value: "token", label: "Token" },
  { value: "cost", label: "费用" },
  { value: "rag", label: "RAG" },
  { value: "calls", label: "调用" },
] as const;

type StatsTab = (typeof TAB_OPTIONS)[number]["value"];

function readStoredTab(): StatsTab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw && TAB_OPTIONS.some((opt) => opt.value === raw))
      return raw as StatsTab;
  } catch {
    /* ignore */
  }
  return "overview";
}

function RangeMetricCard({
  label,
  data,
  loading,
  hint,
  costCurrency,
}: {
  label: string;
  data: TokenBucket;
  loading: boolean;
  hint?: string;
  costCurrency?: string;
}) {
  const currency = costCurrency || data.costCurrency;
  return (
    <Card>
      <CardContent className="space-y-2 p-3 sm:p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums sm:text-2xl">
          {loading ? "…" : formatCompactNumber(data.totalTokens)}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {AI_TOKEN_METRIC_LABELS.prompt}{" "}
            {loading ? "…" : formatCompactNumber(data.promptTokens)}
          </span>
          <span>
            {AI_TOKEN_METRIC_LABELS.completion}{" "}
            {loading ? "…" : formatCompactNumber(data.completionTokens)}
          </span>
          <span>
            {AI_TOKEN_METRIC_LABELS.cacheRead}{" "}
            {loading ? "…" : formatCompactNumber(data.cacheReadTokens)}
          </span>
          {loading || data.cacheWriteTokens > 0 ? (
            <span>
              {AI_TOKEN_METRIC_LABELS.cacheWrite}{" "}
              {loading ? "…" : formatCompactNumber(data.cacheWriteTokens)}
            </span>
          ) : null}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          费用{currency ? ` (${currency})` : ""}{" "}
          {loading ? (
            <PendingValue pending narrow />
          ) : data.costTotal > 0 ? (
            data.costTotal.toFixed(4)
          ) : data.totalTokens > 0 ? (
            "未配置单价"
          ) : (
            "—"
          )}
        </div>
        {hint ? (
          <div className="text-[11px] text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function cacheHitRateFromBucket(bucket: TokenBucket): number {
  const denom = bucket.promptTokens + bucket.cacheReadTokens;
  if (denom <= 0) return 0;
  return Math.round((1000 * bucket.cacheReadTokens) / denom) / 10;
}

function formatCostAmount(value: number): string {
  if (value > 0) return value.toFixed(4);
  return "—";
}

function formatTokenUnitCost(row: TokenRow): string {
  if (row.totalTokens <= 0 || row.costTotal <= 0) return "—";
  const costPerMillion = (row.costTotal * 1_000_000) / row.totalTokens;
  return costPerMillion >= 1
    ? costPerMillion.toFixed(2)
    : costPerMillion.toFixed(4);
}

function CostDetailTable({
  title,
  rows,
  kind,
  currency,
  showUnitCost = false,
  className,
}: {
  title: string;
  rows: Array<TokenRow | ImageRow>;
  kind: "token" | "image";
  currency: string;
  showUnitCost?: boolean;
  className?: string;
}) {
  if (!rows.length) return null;
  const totalVolume = rows.reduce(
    (total, row) =>
      total +
      (kind === "token"
        ? (row as TokenRow).totalTokens
        : (row as ImageRow).imageCount),
    0,
  );
  const palette = fixedChartPalette(Math.max(rows.length, 8));
  return (
    <Card className={className}>
      <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>仅显示有费用的项</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="overflow-x-auto">
          <table
            className={`w-full ${showUnitCost ? "min-w-[31rem]" : "min-w-[22rem]"} text-left text-sm`}
          >
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3 font-medium">名称</th>
                {kind === "token" ? (
                  <th className="pb-2 pr-3 font-medium">Token</th>
                ) : (
                  <th className="pb-2 pr-3 font-medium">张数</th>
                )}
                <th className="pb-2 font-medium">
                  费用{currency ? ` (${currency})` : ""}
                </th>
                {kind === "token" && showUnitCost ? (
                  <th className="pb-2 pl-3 font-medium">
                    每百万 Token{currency ? ` (${currency})` : ""}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const volume =
                  kind === "token"
                    ? (row as TokenRow).totalTokens
                    : (row as ImageRow).imageCount;
                const share =
                  totalVolume > 0
                    ? Math.round((volume / totalVolume) * 1000) / 10
                    : 0;
                return (
                  <tr key={row.key} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <div
                        className="truncate font-mono text-xs"
                        title={row.key}
                      >
                        {row.key}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <AiProgressBar
                          className="min-w-0 flex-1"
                          value={share}
                          color={palette[i % palette.length]}
                          ariaLabel={`${row.key} 用量占比`}
                        />
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatCompactNumber(volume)}
                    </td>
                    <td className="py-2 tabular-nums">
                      {formatCostAmount(row.costTotal)}
                    </td>
                    {kind === "token" && showUnitCost ? (
                      <td className="py-2 pl-3 tabular-nums">
                        {formatTokenUnitCost(row as TokenRow)}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function DrawBreakdownTable({
  title,
  rows,
  emptyText,
  className,
}: {
  title: string;
  rows: ImageRow[];
  emptyText: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <PanelTitleIcon icon={Boxes} />
          {title}
        </CardTitle>
        <CardDescription>按维度查看出图结果</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[16rem] table-fixed text-sm">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
                <col className="w-[20%]" />
              </colgroup>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-2 text-left font-medium">名称</th>
                  <th className="pb-2 pr-2 text-right font-medium">成功</th>
                  <th className="pb-2 pr-2 text-right font-medium">失败</th>
                  <th className="pb-2 text-right font-medium">张数</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const attempts = row.okCount + row.failCount;
                  const okRate =
                    attempts > 0
                      ? Math.round((1000 * row.okCount) / attempts) / 10
                      : null;
                  return (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="max-w-0 py-2 pr-2">
                        <div
                          className="truncate font-mono text-xs"
                          title={row.key}
                        >
                          {row.key}
                        </div>
                        {okRate != null ? (
                          <div className="mt-1 flex items-center gap-2">
                            <AiProgressBar
                              className="min-w-0 flex-1"
                              value={okRate}
                              fillClassName={okRateBarClass(okRate)}
                              ariaLabel={`${row.key} 成功率`}
                            />
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {okRate.toFixed(1)}%
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.okCount}
                      </td>
                      <td
                        className={`py-2 pr-2 text-right tabular-nums ${
                          row.failCount > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : ""
                        }`}
                      >
                        {row.failCount}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {row.imageCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

function okRateBarClass(okRate: number): string {
  if (okRate >= 80) return "bg-emerald-500/80";
  if (okRate >= 60) return "bg-amber-500/80";
  return "bg-rose-500/80";
}

function formatCallLatency(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function callLatencyClass(ms: number | null): string | undefined {
  if (ms == null || !Number.isFinite(ms)) return undefined;
  if (ms >= 10_000) return "text-rose-600 dark:text-rose-400";
  if (ms >= 3_000) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function CallBreakdownTable({
  title,
  nameHeader,
  rows,
  emptyText,
  limit = 12,
  icon: Icon = Database,
}: {
  title: string;
  nameHeader: string;
  rows: DimensionRow[];
  emptyText: string;
  limit?: number;
  icon?: typeof Database;
}) {
  const shown = rows.slice(0, limit);
  return (
    <Card>
      <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <PanelTitleIcon icon={Icon} />
          {title}
        </CardTitle>
        <CardDescription>按维度查看调用次数与耗时</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] table-fixed text-sm">
              <colgroup>
                <col className="w-[36%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[22%]" />
              </colgroup>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-2 text-left font-medium">
                    {nameHeader}
                  </th>
                  <th className="pb-2 pr-2 text-right font-medium">次数</th>
                  <th className="pb-2 pr-2 text-right font-medium">成功</th>
                  <th className="pb-2 pr-2 text-right font-medium">失败</th>
                  <th className="pb-2 text-right font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const okRate =
                    row.requests > 0
                      ? Math.round((1000 * row.succeeded) / row.requests) / 10
                      : null;
                  return (
                    <tr key={row.key} className="border-t border-border/60">
                      <td className="max-w-0 py-2 pr-2">
                        <div
                          className="truncate font-mono text-xs"
                          title={row.key}
                        >
                          {row.key}
                        </div>
                        {okRate != null ? (
                          <div className="mt-1 flex items-center gap-2">
                            <AiProgressBar
                              className="min-w-0 flex-1"
                              value={okRate}
                              fillClassName={okRateBarClass(okRate)}
                              ariaLabel={`${row.key} 成功率`}
                            />
                            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                              {okRate.toFixed(1)}%
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.requests}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {row.succeeded}
                      </td>
                      <td
                        className={`py-2 pr-2 text-right tabular-nums ${
                          row.failed > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : ""
                        }`}
                      >
                        {row.failed}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${callLatencyClass(row.avgLatencyMs) ?? ""}`}
                      >
                        {formatCallLatency(row.avgLatencyMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AiStatisticsPage() {
  const qc = useQueryClient();
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [activeTab, setActiveTab] = useState<StatsTab>(readStoredTab);

  /** 查询窗口至少覆盖近 90 天，便于日历禁空日与 7d/30d。 */
  const queryStart = useMemo(() => {
    const floor = addDaysIso(todayIso(), -89);
    return start < floor ? start : floor;
  }, [start]);
  const queryEnd = useMemo(() => {
    const today = todayIso();
    return end > today ? end : today;
  }, [end]);

  const taskStatsQ = useQuery({
    queryKey: ["llm-task-stats", queryStart, queryEnd],
    queryFn: () => fetchLlmTaskStats({ start: queryStart, end: queryEnd }),
  });

  const knowledgeSourcesQ = useQuery({
    queryKey: ["conversation-kernel-knowledge-sources"],
    queryFn: fetchConversationKernelKnowledgeSources,
  });

  const summary = useMemo(
    () => summarizeTaskStats(taskStatsQ.data),
    [taskStatsQ.data],
  );
  const historyRows = taskStatsQ.data?.history?.rows;
  const knowledgeInventory = useMemo(
    () => summarizeKnowledgeInventory(knowledgeSourcesQ.data?.items || []),
    [knowledgeSourcesQ.data?.items],
  );

  const activeTokenDays = useMemo(
    () => daysWithTokenActivity(historyRows),
    [historyRows],
  );
  const isCalendarDayDisabled = useCallback(
    (iso: string) => {
      const day = String(iso || "").slice(0, 10);
      if (!day) return false;
      if (day === todayIso() || day === start || day === end) return false;
      if (day < queryStart || day > queryEnd) return false;
      if (activeTokenDays.size === 0) return false;
      return !activeTokenDays.has(day);
    },
    [activeTokenDays, end, queryEnd, queryStart, start],
  );

  const selectedRange = useMemo(
    () => aggregateHistoryTokens(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedImages = useMemo(
    () => aggregateHistoryImages(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedRag = useMemo(
    () => aggregateHistoryRag(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedMemoryRag = useMemo(
    () => aggregateHistoryRag(historyRows, start, end, "memory_rag"),
    [end, historyRows, start],
  );
  const selectedGates = useMemo(
    () => aggregateHistoryGates(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedSpeak = useMemo(
    () => aggregateHistorySpeak(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedTools = useMemo(
    () => aggregateHistoryTools(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedRoutes = useMemo(
    () => aggregateHistoryRoutes(historyRows, start, end),
    [end, historyRows, start],
  );
  const selectedRagDocs = useMemo(
    () => ragDocumentRows(selectedRag.byDocument),
    [selectedRag.byDocument],
  );
  const selectedOutcomes = useMemo(
    () => aggregateHistoryAiOutcomes(historyRows, start, end),
    [end, historyRows, start],
  );
  const rangeTokenProviderRows = useMemo(
    () => aggregateHistoryTokenRows(historyRows, start, end, "by_provider"),
    [end, historyRows, start],
  );
  const rangeTokenModelRows = useMemo(
    () => aggregateHistoryTokenRows(historyRows, start, end, "by_model"),
    [end, historyRows, start],
  );
  const rangeTokenTaskRows = useMemo(
    () => aggregateHistoryTokenRows(historyRows, start, end, "by_task"),
    [end, historyRows, start],
  );
  const stickerVision = taskStatsQ.data?.ai?.sticker_vision;
  const stickerLabel = taskStatsQ.data?.ai?.sticker_label;
  const stickerVisionData = stickerVision ?? EMPTY_STICKER_VISION;
  const stickerVisionTokens = useMemo(
    () => rangeTokenTaskRows.find((row) => row.key === "sticker_vision"),
    [rangeTokenTaskRows],
  );
  const rangeTokenTaskDisplayRows = useMemo(
    () => rangeTokenTaskRows.map((row) => ({ ...row, key: labelLlmTask(row.key) })),
    [rangeTokenTaskRows],
  );

  const rangeCacheHitRate = useMemo(
    () => cacheHitRateFromBucket(selectedRange),
    [selectedRange],
  );
  const rangeAiTotal = selectedOutcomes.ok + selectedOutcomes.fail;
  const aiOk = rangeAiTotal > 0 ? selectedOutcomes.ok : summary.aiOk;
  const aiFail = rangeAiTotal > 0 ? selectedOutcomes.fail : summary.aiFail;
  const aiTotal = aiOk + aiFail;
  const aiSuccessRate = aiTotal > 0 ? (aiOk / aiTotal) * 100 : null;

  const tokenTrendSeries = useMemo((): NamedSeriesInput[] => {
    const dailyIo = dailyTokenIoTrend(historyRows, start, end);
    if (dailyIo.length >= 2 || (start !== end && dailyIo.length >= 1)) {
      const prompt = padDailyTrendPoints(
        dailyFieldToTrendPoints(
          dailyIo.map((p) => ({ date: p.date, value: p.promptTokens })),
        ),
        start,
        end,
      );
      const completion = padDailyTrendPoints(
        dailyFieldToTrendPoints(
          dailyIo.map((p) => ({ date: p.date, value: p.completionTokens })),
        ),
        start,
        end,
      );
      if (prompt.length >= 2) {
        return [
          {
            id: "prompt",
            label: AI_TOKEN_METRIC_LABELS.prompt,
            axis: "left",
            points: prompt,
          },
          {
            id: "completion",
            label: AI_TOKEN_METRIC_LABELS.completion,
            axis: "right",
            points: completion,
          },
        ];
      }
    }
    // 单日：按小时输入 / 输出，缺小时补 0
    const day = start === end ? start : dailyIo[0]?.date || start;
    const histRow = (historyRows ?? []).find(
      (r) => String(r.date || "").slice(0, 10) === day,
    );
    const liveHourRows =
      day === todayIso()
        ? hourTokenRows(taskStatsQ.data?.ai?.tokens?.by_hour)
        : [];
    const histSeries = hourlyTokenIoTrendSeries(
      hourTokenRows(histRow?.ai?.tokens?.by_hour),
      day,
    );
    const liveSeries = hourlyTokenIoTrendSeries(
      liveHourRows,
      day,
      new Date().getHours(),
    );
    const series = histSeries[0]?.points.length >= 2 ? histSeries : liveSeries;
    if (series[0]?.points.length >= 2) return series as NamedSeriesInput[];
    return [];
  }, [end, historyRows, start, taskStatsQ.data?.ai?.tokens?.by_hour]);

  const tokenHourIoSeries = useMemo(() => {
    const hour =
      start === end && start === todayIso() ? new Date().getHours() : undefined;
    return hourlyTokenIoTrendSeries(
      summary.tokenHourRows,
      todayIso(),
      hour,
    ) as NamedSeriesInput[];
  }, [start, end, summary.tokenHourRows]);

  const tokenTrendIsHourly = useMemo(() => {
    const daily = dailyTokenTrend(historyRows, start, end);
    return daily.length < 2 && start === end;
  }, [end, historyRows, start]);

  const ragTrendSeries = useMemo((): NamedSeriesInput[] => {
    const knowledgeRaw = dailyRagTrend(historyRows, start, end, "rag");
    const memoryRaw = dailyRagTrend(historyRows, start, end, "memory_rag");
    const hasAny =
      knowledgeRaw.some((p) => p.queries > 0) ||
      memoryRaw.some((p) => p.queries > 0);
    if (!hasAny || start === end) {
      return [
        { id: "knowledge", label: "知识库命中率%", points: [] },
        { id: "memory", label: "记忆命中率%", points: [] },
      ];
    }
    const knowledge = padDailyTrendPoints(
      dailyFieldToTrendPoints(
        knowledgeRaw.map((p) => ({ date: p.date, value: p.hitRate })),
      ),
      start,
      end,
    );
    const memory = padDailyTrendPoints(
      dailyFieldToTrendPoints(
        memoryRaw.map((p) => ({ date: p.date, value: p.hitRate })),
      ),
      start,
      end,
    );
    return [
      { id: "knowledge", label: "知识库命中率%", points: knowledge },
      { id: "memory", label: "记忆命中率%", points: memory },
    ];
  }, [end, historyRows, start]);

  const ragTrendEmptyText =
    start === end ? "请扩大日期查看日趋势" : "本区间暂无检索数据，请扩大日期";

  const costTrendSeries = useMemo((): NamedSeriesInput[] => {
    const daily = dailyCostTrend(historyRows, start, end);
    if (start === end) return [];
    const token = padDailyTrendPoints(
      dailyFieldToTrendPoints(
        daily.map((p) => ({ date: p.date, value: p.tokenCost })),
      ),
      start,
      end,
    );
    const image = padDailyTrendPoints(
      dailyFieldToTrendPoints(
        daily.map((p) => ({ date: p.date, value: p.imageCost })),
      ),
      start,
      end,
    );
    if (token.every((p) => p.total <= 0) && image.every((p) => p.total <= 0))
      return [];
    return [
      { id: "token-cost", label: "Token 费用", points: token },
      { id: "image-cost", label: "画画费用", points: image },
    ];
  }, [end, historyRows, start]);

  const callsSuccessTrendSeries = useMemo((): NamedSeriesInput[] => {
    const daily = dailyAiSuccessTrend(historyRows, start, end);
    if (start === end) return [];
    const rate = padDailyTrendPoints(
      dailyFieldToTrendPoints(
        daily.map((p) => ({ date: p.date, value: p.successRate })),
      ),
      start,
      end,
    );
    if (daily.every((p) => p.total <= 0)) return [];
    return [{ id: "success-rate", label: "AI 成功率%", points: rate }];
  }, [end, historyRows, start]);

  const providerStackSeries = useMemo((): NamedSeriesInput[] => {
    if (start === end) return [];
    return dailyProviderTokenSeries(
      historyRows,
      start,
      end,
      8,
    ) as NamedSeriesInput[];
  }, [end, historyRows, start]);

  const routeShareRows = useMemo(
    () =>
      Object.entries(selectedRoutes)
        .map(([key, totalTokens]) => ({
          key: labelLlmRoute(key),
          totalTokens,
          promptTokens: 0,
          completionTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          costTotal: 0,
        }))
        .filter((r) => r.totalTokens > 0)
        .sort((a, b) => b.totalTokens - a.totalTokens),
    [selectedRoutes],
  );

  const gateShareRows = useMemo(
    () =>
      countShareRows([
        { key: "放行", count: selectedGates.proceed },
        { key: "跳过", count: selectedGates.skip },
        { key: "延后", count: selectedGates.defer },
      ]),
    [selectedGates.defer, selectedGates.proceed, selectedGates.skip],
  );

  const speakShareRows = useMemo(
    () =>
      countShareRows([
        { key: "别名提及", count: selectedSpeak.mention },
        { key: "氛围插嘴", count: selectedSpeak.ambient },
        { key: "续聊", count: selectedSpeak.followup },
        { key: "未触发", count: selectedSpeak.skip },
      ]),
    [
      selectedSpeak.ambient,
      selectedSpeak.followup,
      selectedSpeak.mention,
      selectedSpeak.skip,
    ],
  );

  const toolShareRows = useMemo(
    () =>
      countShareRows([
        { key: "调用成功", count: selectedTools.callOk },
        { key: "调用失败", count: selectedTools.callFail },
      ]),
    [selectedTools.callFail, selectedTools.callOk],
  );

  const toolSessionShareRows = useMemo(
    () =>
      countShareRows([
        { key: "有工具调用", count: selectedTools.sessionCalled },
        { key: "未调工具", count: selectedTools.sessionNoCall },
      ]),
    [selectedTools.sessionCalled, selectedTools.sessionNoCall],
  );

  const speakTriggered = speakTriggerTotal(selectedSpeak);
  const toolCalls = toolCallTotal(selectedTools);
  const toolCallSuccessRate =
    toolCalls > 0 ? (selectedTools.callOk / toolCalls) * 100 : null;
  const toolSessionTotal =
    selectedTools.sessionCalled + selectedTools.sessionNoCall;

  const aiOutcomeShareRows = useMemo(
    () =>
      countShareRows([
        { key: "成功", count: aiOk },
        { key: "失败", count: aiFail },
      ]),
    [aiFail, aiOk],
  );

  const knowledgeRagShareRows = useMemo(
    () =>
      countShareRows([
        { key: "命中", count: selectedRag.hitCount },
        { key: "未命中", count: selectedRag.missCount },
        { key: "跳过", count: selectedRag.skipCount },
      ]),
    [selectedRag.hitCount, selectedRag.missCount, selectedRag.skipCount],
  );

  const memoryRagShareRows = useMemo(
    () =>
      countShareRows([
        { key: "命中", count: selectedMemoryRag.hitCount },
        { key: "未命中", count: selectedMemoryRag.missCount },
      ]),
    [selectedMemoryRag.hitCount, selectedMemoryRag.missCount],
  );

  const cacheShareRows = useMemo(
    () =>
      countShareRows([
        {
          key: AI_TOKEN_METRIC_LABELS.cacheRead,
          count: selectedRange.cacheReadTokens,
        },
        {
          key: AI_TOKEN_METRIC_LABELS.uncachedPrompt,
          count: Math.max(0, selectedRange.promptTokens),
        },
      ]),
    [selectedRange.cacheReadTokens, selectedRange.promptTokens],
  );

  const rangeCost = useMemo(
    () => buildRangeCostSummary(historyRows, start, end),
    [end, historyRows, start],
  );
  const rangeTaskCostDisplayRows = useMemo(
    () => rangeCost.tokenTaskRows.map((row) => ({ ...row, key: labelLlmTask(row.key) })),
    [rangeCost.tokenTaskRows],
  );

  const rangeImageGatewayRows = useMemo(
    () => aggregateHistoryImageRows(historyRows, start, end, "by_gateway"),
    [end, historyRows, start],
  );
  const rangeImageProviderRows = useMemo(
    () => aggregateHistoryImageRows(historyRows, start, end, "by_provider"),
    [end, historyRows, start],
  );
  const rangeImageModelRows = useMemo(
    () => aggregateHistoryImageRows(historyRows, start, end, "by_model"),
    [end, historyRows, start],
  );
  const rangeProviderRows = useMemo(
    () =>
      aggregateHistoryDimensionRows(historyRows, start, end, "provider_stats"),
    [end, historyRows, start],
  );
  const rangeModelRows = useMemo(
    () => aggregateHistoryDimensionRows(historyRows, start, end, "model_stats"),
    [end, historyRows, start],
  );

  const range7 = useMemo(() => {
    const endDay = todayIso();
    return aggregateHistoryTokens(historyRows, addDaysIso(endDay, -6), endDay);
  }, [historyRows]);

  const range30 = useMemo(() => {
    const endDay = todayIso();
    return aggregateHistoryTokens(historyRows, addDaysIso(endDay, -29), endDay);
  }, [historyRows]);

  const dateFilter = useMemo(
    () => (
      <DateModeFilter
        size="toolbar"
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
        isDayDisabled={isCalendarDayDisabled}
      />
    ),
    [end, isCalendarDayDisabled, start],
  );

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["llm-task-stats"] });
    void qc.invalidateQueries({
      queryKey: ["conversation-kernel-knowledge-sources"],
    });
  }, [qc]);

  const onExportBilling = useCallback(() => {
    const data: AiBillingExportData = {
      start,
      end,
      historyRows,
      rangeTokens: selectedRange,
      rangeImages: selectedImages,
      rangeCost,
    };
    if (!aiBillingHasData(data)) {
      pushConsoleToast("当前区间无可导出的计费数据", "warn");
      return;
    }
    const { csv, rowCount } = buildAiBillingCsv(data);
    downloadCsvFile(aiBillingExportFilename(start, end), csv);
    pushConsoleToast(`已导出计费统计 ${rowCount} 行`, "ok");
  }, [end, historyRows, rangeCost, selectedImages, selectedRange, start]);

  const exportButton = useMemo(
    () => (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="shrink-0"
        icon={Download}
        iconMotion="down"
        disabled={taskStatsQ.isLoading}
        onClick={onExportBilling}
      >
        导出
      </Button>
    ),
    [onExportBilling, taskStatsQ.isLoading],
  );

  // trailing 引用需稳定（useMemo），否则 setSlots 每次渲染都触发会造成死循环
  useRegisterAiObservationChrome({
    middle: dateFilter,
    trailing: exportButton,
    onRefresh,
  });

  const onTabChange = useCallback((value: string) => {
    const next = TAB_OPTIONS.some((opt) => opt.value === value)
      ? (value as StatsTab)
      : "overview";
    setActiveTab(next);
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const hint = buildPersistenceHint(taskStatsQ.data?.persistence);
  const loading = taskStatsQ.isLoading;
  const rangeLabel = `${start}${start !== end ? ` ~ ${end}` : ""}`;
  const costCurrency =
    rangeCost.currency ||
    selectedRange.costCurrency ||
    summary.tokens.costCurrency;
  const combinedCost = rangeCost.totalCost;
  const hasDrawInRange = rangeCost.hasImages;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <SegTabs
          value={activeTab}
          onValueChange={onTabChange}
          options={TAB_OPTIONS}
          ariaLabel="AI 统计分类"
          tone="accent"
          listClassName="min-w-max"
        />
      </div>

      <StateBlock loading={loading} error={taskStatsQ.error}>
        {activeTab === "overview" ? (
          <div className="space-y-3">
            <StatsSectionLabel>区间摘要</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="size-3.5" />
                    {AI_TOKEN_METRIC_LABELS.total}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.totalTokens)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeLabel}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    费用{costCurrency ? ` (${costCurrency})` : ""}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? (
                      <PendingValue pending />
                    ) : combinedCost > 0 ? (
                      combinedCost.toFixed(4)
                    ) : selectedRange.totalTokens > 0 || hasDrawInRange ? (
                      "未配置单价"
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {loading
                      ? "…"
                      : combinedCost > 0
                        ? hasDrawInRange
                          ? `Token ${selectedRange.costTotal.toFixed(4)} · 画画 ${selectedImages.costTotal.toFixed(4)}`
                          : `Token ${selectedRange.costTotal.toFixed(4)}`
                        : selectedRange.totalTokens > 0
                          ? "在 Provider 里为模型填写单价后可估算"
                          : "暂无费用"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">AI 成功率</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : aiSuccessRate != null
                        ? `${aiSuccessRate.toFixed(1)}%`
                        : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    成功 {aiOk} · 失败 {aiFail}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    {AI_TOKEN_METRIC_LABELS.cacheHitRate}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${rangeCacheHitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    当前区间
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">门控放行</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : formatCompactNumber(selectedGates.proceed)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    跳过 {selectedGates.skip} · 延后 {selectedGates.defer}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">记忆命中</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : formatCompactNumber(selectedMemoryRag.hitCount)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    命中率 {selectedMemoryRag.hitRate.toFixed(1)}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="console-panel-grid grid-cols-2">
              <RangeMetricCard
                label="近 7 天"
                data={range7}
                loading={loading}
                costCurrency={costCurrency}
                hint="相对今天的固定窗口，不受顶栏日期影响"
              />
              <RangeMetricCard
                label="近 30 天"
                data={range30}
                loading={loading}
                costCurrency={costCurrency}
                hint="相对今天的固定窗口，不受顶栏日期影响"
              />
            </div>

            <StatsSectionLabel>趋势与路径</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    {tokenTrendIsHourly
                      ? `小时趋势（${AI_TOKEN_METRIC_LABELS.ioPair}）`
                      : `日趋势（${AI_TOKEN_METRIC_LABELS.ioPair}）`}
                  </CardTitle>
                  <CardDescription>
                    {tokenTrendIsHourly
                      ? "仅 1 天时按小时展示，缺小时补 0；扩大日期可看日趋势"
                      : "按日展示当前区间，缺日补 0"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <ChartsNamedSeriesTrend
                    series={tokenTrendSeries}
                    emptyText={
                      tokenTrendIsHourly
                        ? "暂无按小时数据，请扩大日期查看日趋势"
                        : "暂无 token 日趋势"
                    }
                    showSummary={false}
                    axisUnit=""
                    compact
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Filter} />
                    回复路径
                  </CardTitle>
                  <CardDescription>
                    实际发出按来源/触发拆分：接话·语料选句、@ 直出、别名感知、主动发言、续聊
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-h-[260px] p-3 pt-0 sm:p-6 sm:pt-0">
                  <ShareDistribution
                    rows={routeShareRows}
                    emptyText="暂无路径数据"
                    prefer="bars"
                  />
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>结果占比</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={CheckCircle2} />
                    AI 结果
                  </CardTitle>
                  <CardDescription>成功与失败次数占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={aiOutcomeShareRows}
                    emptyText="暂无调用结果"
                    prefer="donut"
                    centerTitle="成功率"
                    centerValue={
                      aiSuccessRate != null
                        ? `${aiSuccessRate.toFixed(1)}%`
                        : "—"
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Filter} />
                    门控结果
                  </CardTitle>
                  <CardDescription>放行、跳过与延后占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={gateShareRows}
                    emptyText="暂无门控数据"
                    prefer="donut"
                    centerTitle="放行"
                    centerValue={formatCompactNumber(selectedGates.proceed)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Coins} />
                    {AI_TOKEN_METRIC_LABELS.cacheHitShare}
                  </CardTitle>
                  <CardDescription>
                    {AI_TOKEN_METRIC_LABELS.cacheRead} ·{" "}
                    {AI_TOKEN_METRIC_LABELS.uncachedPrompt}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={cacheShareRows}
                    emptyText="暂无缓存数据"
                    prefer="donut"
                    centerTitle="命中率"
                    centerValue={`${rangeCacheHitRate.toFixed(1)}%`}
                  />
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>发言与工具</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={MessageCircle} />
                    发言感知
                  </CardTitle>
                  <CardDescription>
                    非 @ 时别名提及 / 氛围插嘴 / 续聊触发与未触发占比
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={speakShareRows}
                    emptyText="暂无发言感知数据"
                    prefer="donut"
                    centerTitle="触发"
                    centerValue={formatCompactNumber(speakTriggered)}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Wrench} />
                    工具调用
                  </CardTitle>
                  <CardDescription>单次工具执行成功与失败</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={toolShareRows}
                    emptyText="暂无工具调用"
                    prefer="donut"
                    centerTitle="成功率"
                    centerValue={
                      toolCallSuccessRate != null
                        ? `${toolCallSuccessRate.toFixed(1)}%`
                        : "—"
                    }
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Wrench} />
                    工具会话
                  </CardTitle>
                  <CardDescription>
                    开启工具能力的对话里，是否实际发起了工具调用
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={toolSessionShareRows}
                    emptyText="暂无工具会话"
                    prefer="donut"
                    centerTitle="有调用"
                    centerValue={formatCompactNumber(
                      selectedTools.sessionCalled,
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>Provider</StatsSectionLabel>
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Cloud} />
                  Provider 堆叠
                </CardTitle>
                <CardDescription>
                  {start === end
                    ? "单日请看下方占比；扩大日期可看按日堆叠"
                    : "按日堆叠各 Provider 的 Token 总量，缺日补 0"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <ChartsNamedSeriesTrend
                  series={providerStackSeries}
                  emptyText={
                    start === end
                      ? "请扩大日期查看按 Provider 日趋势"
                      : "本区间暂无 Provider Token 趋势"
                  }
                  showSummary={false}
                  axisUnit=""
                  stacked
                  maxSeries={8}
                />
              </CardContent>
            </Card>

            <CallBreakdownTable
              title="Provider 调用"
              nameHeader="Provider"
              rows={rangeProviderRows}
              emptyText="暂无调用数据"
              limit={5}
              icon={Cloud}
            />
          </div>
        ) : null}

        {activeTab === "token" ? (
          <div className="space-y-3">
            <StatsSectionLabel>Token 用量</StatsSectionLabel>
            <div
              className={`console-panel-grid grid-cols-2 ${
                selectedRange.cacheWriteTokens > 0
                  ? "lg:grid-cols-5"
                  : "lg:grid-cols-4"
              }`}
            >
              <Card className="col-span-2 lg:col-span-1">
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="size-3.5" />
                    {AI_TOKEN_METRIC_LABELS.total}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.totalTokens)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeLabel}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    {AI_TOKEN_METRIC_LABELS.prompt}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.promptTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    {AI_TOKEN_METRIC_LABELS.completion}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.completionTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    {AI_TOKEN_METRIC_LABELS.cacheRead}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.cacheReadTokens)}
                  </div>
                </CardContent>
              </Card>
              {selectedRange.cacheWriteTokens > 0 ? (
                <Card>
                  <CardContent className="space-y-1 p-3 sm:p-4">
                    <div className="text-xs text-muted-foreground">
                      {AI_TOKEN_METRIC_LABELS.cacheWrite}
                    </div>
                    <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                      {formatCompactNumber(selectedRange.cacheWriteTokens)}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Boxes} />
                    按模型
                  </CardTitle>
                  <CardDescription>按 Token 总量看占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <ShareDistribution
                    rows={rangeTokenModelRows}
                    emptyText="暂无按模型数据"
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Cloud} />按 Provider
                  </CardTitle>
                  <CardDescription>按 Token 总量看占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <ShareDistribution
                    rows={rangeTokenProviderRows}
                    emptyText="暂无按 Provider 数据"
                  />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Boxes} />
                  按任务
                </CardTitle>
                <CardDescription>
                  按 Token 总量排行
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <ShareDistribution
                  rows={rangeTokenTaskDisplayRows}
                  limit={12}
                  prefer="bars"
                  emptyText="暂无按任务数据"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Cloud} />
                  Provider 堆叠
                </CardTitle>
                <CardDescription>
                  {start === end
                    ? "单日请看上方占比；扩大日期可看按日堆叠"
                    : "按日堆叠各 Provider 的 Token 总量，缺日补 0"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <ChartsNamedSeriesTrend
                  series={providerStackSeries}
                  emptyText={
                    start === end
                      ? "请扩大日期查看按 Provider 日趋势"
                      : "本区间暂无 Provider Token 趋势"
                  }
                  showSummary={false}
                  axisUnit=""
                  stacked
                  maxSeries={8}
                />
              </CardContent>
            </Card>

            {summary.tokenHourRows.length ? (
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    今日小时趋势
                  </CardTitle>
                  <CardDescription>
                    今日实时的 {AI_TOKEN_METRIC_LABELS.ioPair}，不随历史区间切换
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <ChartsNamedSeriesTrend
                    series={tokenHourIoSeries}
                    emptyText="暂无按小时数据"
                    showSummary={false}
                    axisUnit=""
                  />
                </CardContent>
              </Card>
            ) : null}

            {hasDrawInRange ? (
              <div className="space-y-3">
                <StatsSectionLabel>画画用量</StatsSectionLabel>
                <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
                  <IconStatCard
                    title="出图成功"
                    value={
                      loading
                        ? "…"
                        : formatCompactNumber(selectedImages.okCount)
                    }
                    icon={CheckCircle2}
                    subtitle={
                      selectedImages.okCount + selectedImages.failCount > 0
                        ? `成功率 ${(
                            (selectedImages.okCount /
                              (selectedImages.okCount +
                                selectedImages.failCount)) *
                            100
                          ).toFixed(1)}% · ${rangeLabel}`
                        : rangeLabel
                    }
                  />
                  <IconStatCard
                    title="出图失败"
                    value={
                      loading
                        ? "…"
                        : formatCompactNumber(selectedImages.failCount)
                    }
                    icon={XCircle}
                    subtitle={
                      selectedImages.okCount + selectedImages.failCount > 0
                        ? `占比 ${(
                            (selectedImages.failCount /
                              (selectedImages.okCount +
                                selectedImages.failCount)) *
                            100
                          ).toFixed(1)}%`
                        : "暂无数据"
                    }
                    valueClassName={
                      selectedImages.failCount > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : undefined
                    }
                  />
                  <IconStatCard
                    title="出图张数"
                    value={
                      loading
                        ? "…"
                        : formatCompactNumber(selectedImages.imageCount)
                    }
                    icon={ImageIcon}
                    subtitle="当前区间生成张数"
                  />
                  <IconStatCard
                    title={`费用${selectedImages.costCurrency ? ` (${selectedImages.costCurrency})` : ""}`}
                    value={
                      loading
                        ? "…"
                        : selectedImages.costTotal > 0
                          ? selectedImages.costTotal.toFixed(4)
                          : "—"
                    }
                    icon={Coins}
                    subtitle={
                      selectedImages.costTotal > 0
                        ? rangeLabel
                        : selectedImages.imageCount > 0
                          ? "未配置单价"
                          : "暂无费用"
                    }
                  />
                </div>
                <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
                  <DrawBreakdownTable
                    title="按网关"
                    rows={rangeImageGatewayRows}
                    emptyText="暂无网关数据"
                  />
                  <DrawBreakdownTable
                    title="按 Provider"
                    rows={rangeImageProviderRows}
                    emptyText="暂无 Provider 数据"
                  />
                  <DrawBreakdownTable
                    title="按模型"
                    rows={rangeImageModelRows}
                    emptyText="暂无模型数据"
                    className="lg:col-span-2"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "cost" ? (
          <div className="space-y-3">
            <StatsSectionLabel>费用摘要</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="size-3.5" />
                    合计{costCurrency ? ` (${costCurrency})` : ""}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : formatCostAmount(combinedCost)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeLabel}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    Token 费用
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : formatCostAmount(rangeCost.tokenCost)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedRange.totalTokens > 0 && rangeCost.tokenCost <= 0
                      ? "未配置单价"
                      : "LLM 调用"}
                  </div>
                </CardContent>
              </Card>
              {hasDrawInRange ? (
                <Card>
                  <CardContent className="space-y-1 p-3 sm:p-4">
                    <div className="text-xs text-muted-foreground">
                      画画费用
                    </div>
                    <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                      {loading ? "…" : formatCostAmount(rangeCost.imageCost)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedImages.imageCount > 0
                        ? `${formatCompactNumber(selectedImages.imageCount)} 张`
                        : "出图"}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <StatsSectionLabel>费用趋势</StatsSectionLabel>
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={LineChart} />
                  费用日趋势
                </CardTitle>
                <CardDescription>
                  {start === end
                    ? "单日无日趋势，请扩大日期"
                    : "按日展示费用，缺日补 0"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <ChartsNamedSeriesTrend
                  series={costTrendSeries}
                  emptyText={
                    start === end
                      ? "请扩大日期查看日趋势"
                      : "本区间暂无费用趋势"
                  }
                  showSummary={false}
                  axisUnit=""
                />
              </CardContent>
            </Card>

            <div className="space-y-2">
              <StatsSectionLabel>Token 明细</StatsSectionLabel>
              <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
                <CostDetailTable
                  title="按 Provider"
                  rows={rangeCost.tokenProviderRows}
                  kind="token"
                  currency={costCurrency}
                />
                <CostDetailTable
                  title="按模型"
                  rows={rangeCost.tokenModelRows}
                  kind="token"
                  currency={costCurrency}
                />
                <CostDetailTable
                  title="按任务"
                  rows={rangeTaskCostDisplayRows}
                  kind="token"
                  currency={costCurrency}
                  showUnitCost
                  className="lg:col-span-2"
                />
              </div>
              {!rangeCost.tokenProviderRows.length &&
              !rangeCost.tokenModelRows.length &&
              !rangeCost.tokenTaskRows.length ? (
                <p className="text-sm text-muted-foreground">
                  {selectedRange.totalTokens > 0
                    ? "当前区间有 Token 用量，但尚未配置模型单价。"
                    : "当前区间暂无 Token 费用。"}
                </p>
              ) : null}
            </div>

            {hasDrawInRange ? (
              <div className="space-y-2">
                <StatsSectionLabel>画画明细</StatsSectionLabel>
                <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
                  <CostDetailTable
                    title="按网关"
                    rows={rangeCost.imageGatewayRows}
                    kind="image"
                    currency={costCurrency}
                  />
                  <CostDetailTable
                    title="按 Provider"
                    rows={rangeCost.imageProviderRows}
                    kind="image"
                    currency={costCurrency}
                  />
                  <CostDetailTable
                    title="按模型"
                    rows={rangeCost.imageModelRows}
                    kind="image"
                    currency={costCurrency}
                    className="lg:col-span-2"
                  />
                </div>
                {!rangeCost.imageGatewayRows.length &&
                !rangeCost.imageProviderRows.length &&
                !rangeCost.imageModelRows.length ? (
                  <p className="text-sm text-muted-foreground">
                    有画画用量，但当前区间无画画费用记录。
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "rag" ? (
          <div className="space-y-3">
            <StatsSectionLabel>检索摘要</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    知识库命中率
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${selectedRag.hitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    实际检索 hit {selectedRag.hitCount} · miss{" "}
                    {selectedRag.missCount}
                    {selectedRag.skipCount > 0
                      ? ` · 跳过 ${selectedRag.skipCount}`
                      : ""}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    知识库检索
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : formatCompactNumber(
                          selectedRag.hitCount + selectedRag.missCount,
                        )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeLabel}
                    {selectedRag.skipCount > 0
                      ? ` · 另有跳过 ${formatCompactNumber(selectedRag.skipCount)}`
                      : ""}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    记忆命中率
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${selectedMemoryRag.hitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    hit {selectedMemoryRag.hitCount} · miss{" "}
                    {selectedMemoryRag.missCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">记忆查询</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : formatCompactNumber(
                          selectedMemoryRag.hitCount +
                            selectedMemoryRag.missCount,
                        )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {rangeLabel}
                  </div>
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>检索结果</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Library} />
                    知识库检索
                  </CardTitle>
                  <CardDescription>命中、未命中与跳过占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={knowledgeRagShareRows}
                    emptyText="暂无知识库检索"
                    prefer="donut"
                    centerTitle="命中率"
                    centerValue={`${selectedRag.hitRate.toFixed(1)}%`}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="space-y-1.5 border-b border-border/60 p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Library} />
                    记忆检索
                  </CardTitle>
                  <CardDescription>命中与未命中占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6">
                  <ShareDistribution
                    rows={memoryRagShareRows}
                    emptyText="暂无记忆检索"
                    prefer="donut"
                    centerTitle="命中率"
                    centerValue={`${selectedMemoryRag.hitRate.toFixed(1)}%`}
                  />
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>知识库存</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-1 lg:grid-cols-3">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    知识源数量
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {knowledgeSourcesQ.isLoading
                      ? "…"
                      : formatCompactNumber(knowledgeInventory.sourceCount)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    已启用的知识源
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    知识片段总量
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {knowledgeSourcesQ.isLoading
                      ? "…"
                      : formatCompactNumber(knowledgeInventory.chunkCount)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    库存口径，与命中率无关
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    片段最多的知识源
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  {knowledgeInventory.topSources.length ? (
                    <ul className="space-y-1 text-sm">
                      {knowledgeInventory.topSources.slice(0, 4).map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="min-w-0 truncate" title={row.title}>
                            {row.title}
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {row.chunkCount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无知识源</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <StatsSectionLabel>命中明细</StatsSectionLabel>
            <div className="space-y-3">
              <Card>
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Library} />
                    文档命中 Top 8
                  </CardTitle>
                  <CardDescription>知识库检索命中最多的文档。</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  {selectedRagDocs.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs text-muted-foreground">
                          <tr>
                            <th className="py-1.5 pr-3 font-medium">文档</th>
                            <th className="py-1.5 font-medium">次数</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRagDocs.slice(0, 8).map((row) => (
                            <tr
                              key={row.key}
                              className="border-t border-border/60"
                            >
                              <td
                                className="max-w-[14rem] truncate py-1.5 pr-3"
                                title={row.key}
                              >
                                {row.key}
                              </td>
                              <td className="py-1.5 tabular-nums">
                                {row.hitCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      暂无文档命中
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    命中率趋势
                  </CardTitle>
                  <CardDescription>
                    知识库与记忆检索命中率的日趋势。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  <ChartsNamedSeriesTrend
                    series={ragTrendSeries}
                    emptyText={ragTrendEmptyText}
                    showSummary={false}
                    axisUnit="%"
                    keepZeroSeries
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {activeTab === "calls" ? (
          <div className="space-y-3">
            <StatsSectionLabel>调用摘要</StatsSectionLabel>
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
              <IconStatCard
                title="统计通道"
                value={
                  summary.reachable == null
                    ? "…"
                    : summary.reachable
                      ? "正常"
                      : "不可用"
                }
                icon={summary.reachable ? Wifi : WifiOff}
                subtitle={
                  summary.reachable == null
                    ? "正在读取…"
                    : summary.reachable
                      ? "本地 Token / 任务数据可读"
                      : "读取失败，仍可看历史趋势"
                }
                valueClassName={
                  summary.reachable == null
                    ? undefined
                    : summary.reachable
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                }
              />
              <IconStatCard
                title="Bot 提交"
                value={loading ? "…" : formatCompactNumber(summary.botOk)}
                icon={Send}
                subtitle="提交成功并完成回调的次数"
              />
              <IconStatCard
                title="AI 成功"
                value={loading ? "…" : formatCompactNumber(summary.aiOk)}
                icon={CheckCircle2}
                subtitle={
                  summary.aiOk + summary.aiFail > 0
                    ? `成功率 ${((summary.aiOk / (summary.aiOk + summary.aiFail)) * 100).toFixed(1)}%`
                    : "暂无数据"
                }
              />
              <IconStatCard
                title="AI 失败"
                value={loading ? "…" : formatCompactNumber(summary.aiFail)}
                icon={XCircle}
                subtitle={
                  summary.aiOk + summary.aiFail > 0
                    ? `占比 ${((summary.aiFail / (summary.aiOk + summary.aiFail)) * 100).toFixed(1)}%`
                    : "暂无数据"
                }
                valueClassName={
                  summary.aiFail > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : undefined
                }
              />
            </div>

            <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
              <IconStatCard
                title="发言触发"
                value={loading ? "…" : formatCompactNumber(speakTriggered)}
                icon={MessageCircle}
                subtitle={`提及 ${selectedSpeak.mention} · 插嘴 ${selectedSpeak.ambient} · 续聊 ${selectedSpeak.followup}`}
              />
              <IconStatCard
                title="发言未触发"
                value={loading ? "…" : formatCompactNumber(selectedSpeak.skip)}
                icon={MessageCircle}
                subtitle="命令/旁观/噪声等跳过"
              />
              <IconStatCard
                title="工具调用"
                value={loading ? "…" : formatCompactNumber(toolCalls)}
                icon={Wrench}
                subtitle={
                  toolCallSuccessRate != null
                    ? `成功 ${selectedTools.callOk} · 失败 ${selectedTools.callFail}`
                    : "暂无工具执行"
                }
              />
              <IconStatCard
                title="工具会话"
                value={loading ? "…" : formatCompactNumber(toolSessionTotal)}
                icon={Wrench}
                subtitle={
                  toolSessionTotal > 0
                    ? `有调用 ${selectedTools.sessionCalled} · 未调 ${selectedTools.sessionNoCall}`
                    : "暂无工具会话"
                }
              />
            </div>

            {stickerLabel ? (
              <>
                <StatsSectionLabel>表情标签</StatsSectionLabel>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-base font-semibold">
                      <PanelTitleIcon icon={ImageIcon} />
                      表情语义标签
                    </div>
                    <p className="text-sm text-muted-foreground">
                      对候选表情图建立语义标签的当日状态；缓存命中不消耗模型调用。
                    </p>
                  </div>
                  <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
                    <IconStatCard
                      title="入队"
                      value={formatCompactNumber(stickerLabel.submitted ?? 0)}
                      icon={ImageIcon}
                      subtitle={`待处理 ${stickerLabel.pending ?? 0}`}
                    />
                    <IconStatCard
                      title="已标注"
                      value={formatCompactNumber(stickerLabel.labeled ?? 0)}
                      icon={CheckCircle2}
                      subtitle={`成功建立语义标签`}
                    />
                    <IconStatCard
                      title="失败"
                      value={formatCompactNumber((stickerLabel.failed ?? 0) + (stickerLabel.timeout ?? 0) + (stickerLabel.parse_error ?? 0))}
                      icon={XCircle}
                      subtitle={`超时 ${stickerLabel.timeout ?? 0} · 解析失败 ${stickerLabel.parse_error ?? 0}`}
                      valueClassName={
                        (stickerLabel.failed ?? 0) + (stickerLabel.timeout ?? 0) + (stickerLabel.parse_error ?? 0) > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : undefined
                      }
                    />
                    <IconStatCard
                      title="跳过"
                      value={formatCompactNumber((stickerLabel.no_vision ?? 0) + (stickerLabel.circuit_open ?? 0))}
                      icon={CircleOff}
                      subtitle={`无视觉模型 ${stickerLabel.no_vision ?? 0} · 熔断 ${stickerLabel.circuit_open ?? 0}`}
                    />
                  </div>
                  {stickerLabel.recent_errors?.length ? (
                    <Card>
                      <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
                        <CardTitle className="text-sm">最近错误</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[30rem] table-fixed text-sm">
                            <colgroup>
                              <col className="w-[28%]" />
                              <col className="w-[15%]" />
                              <col className="w-[57%]" />
                            </colgroup>
                            <thead className="text-xs text-muted-foreground">
                              <tr>
                                <th className="pb-2 pr-2 text-left font-medium">任务</th>
                                <th className="pb-2 pr-2 text-left font-medium">状态</th>
                                <th className="pb-2 text-left font-medium">错误</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stickerLabel.recent_errors.map((row) => (
                                <tr key={row.job_id} className="border-t border-border/60">
                                  <td className="truncate py-2 pr-2 font-mono text-xs" title={row.job_id}>
                                    {row.job_id}
                                  </td>
                                  <td className="truncate py-2 pr-2 text-xs">{row.state}</td>
                                  <td className="truncate py-2 text-xs" title={row.error}>
                                    {row.error}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </>
            ) : null}

            {stickerVisionData && (
              <>
                <StatsSectionLabel>表情视觉</StatsSectionLabel>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-base font-semibold">
                      <PanelTitleIcon icon={ImageIcon} />
                      VLM 选图
                    </div>
                    <p className="text-sm text-muted-foreground">
                      durable work 任务的当日实时状态；Token
                      与费用按当前日期区间汇总。
                    </p>
                  </div>
                  <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
                    <IconStatCard
                      title="调用 / 命中"
                      value={`${stickerVisionData.requests} / ${stickerVisionData.selected}`}
                      icon={ImageIcon}
                      subtitle={`候选 ${stickerVisionData.candidate_total ?? 0} · 未匹配 ${stickerVisionData.no_match ?? 0}`}
                    />
                    <IconStatCard
                      title="发送"
                      value={formatCompactNumber(stickerVisionData.sent ?? 0)}
                      icon={Send}
                      subtitle={`投递失败 ${stickerVisionData.delivery_failed ?? 0}`}
                    />
                    <IconStatCard
                      title="平均耗时"
                      value={formatCallLatency(
                        stickerVisionData.avg_duration_ms ?? null,
                      )}
                      icon={LineChart}
                      subtitle={`模型失败 ${stickerVisionData.failed} · 跳过 ${stickerVisionData.skipped ?? 0}`}
                      valueClassName={
                        stickerVisionData.failed > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : undefined
                      }
                    />
                    <IconStatCard
                      title="Token / 费用"
                      value={formatCompactNumber(
                        stickerVisionTokens?.totalTokens ?? 0,
                      )}
                      icon={Coins}
                      subtitle={
                        stickerVisionTokens?.costTotal
                          ? `${stickerVisionTokens.costTotal.toFixed(4)} ${costCurrency || ""}`.trim()
                          : "Provider 未返回 usage 或未配置单价"
                      }
                    />
                  </div>
                  {stickerVisionData.recent.length || stickerVisionData.recent_error ? (
                    <Card>
                      <CardHeader className="p-3 pb-0 sm:p-4 sm:pb-0">
                        <CardTitle className="text-sm">最近任务</CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 sm:p-4">
                        {stickerVisionData.recent_error ? (
                          <ConsoleHint className="mb-3 border-rose-300/70 bg-rose-50/70 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
                            最近错误：{stickerVisionData.recent_error}
                          </ConsoleHint>
                        ) : null}
                        {stickerVisionData.recent.length ? (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[34rem] table-fixed text-sm">
                              <colgroup>
                                <col className="w-[18%]" />
                                <col className="w-[15%]" />
                                <col className="w-[25%]" />
                                <col className="w-[12%]" />
                                <col className="w-[12%]" />
                                <col className="w-[18%]" />
                              </colgroup>
                              <thead className="text-xs text-muted-foreground">
                                <tr>
                                  <th className="pb-2 pr-2 text-left font-medium">
                                    任务
                                  </th>
                                  <th className="pb-2 pr-2 text-left font-medium">
                                    结果
                                  </th>
                                  <th className="pb-2 pr-2 text-left font-medium">
                                    模型
                                  </th>
                                  <th className="pb-2 pr-2 text-right font-medium">
                                    候选
                                  </th>
                                  <th className="pb-2 pr-2 text-right font-medium">
                                    耗时
                                  </th>
                                  <th className="pb-2 text-left font-medium">
                                    发送 / 错误
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {stickerVisionData.recent.map((row) => (
                                  <tr
                                    key={row.job_id}
                                    className="border-t border-border/60"
                                  >
                                    <td
                                      className="truncate py-2 pr-2 font-mono text-xs"
                                      title={row.job_id}
                                    >
                                      {row.job_id}
                                    </td>
                                    <td className="truncate py-2 pr-2 text-xs">
                                      {row.state}
                                    </td>
                                    <td
                                      className="truncate py-2 pr-2 font-mono text-xs"
                                      title={`${row.provider} / ${row.model}`}
                                    >
                                      {[row.provider, row.model]
                                        .filter(Boolean)
                                        .join(" / ") || "—"}
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums">
                                      {row.candidate_count}
                                    </td>
                                    <td className="py-2 pr-2 text-right tabular-nums">
                                      {formatCallLatency(
                                        row.duration_ms ?? null,
                                      )}
                                    </td>
                                    <td
                                      className="truncate py-2 text-xs"
                                      title={row.error ?? row.delivery_state}
                                    >
                                      {row.error || row.delivery_state}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </>
            )}

            <StatsSectionLabel>成功率趋势</StatsSectionLabel>
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={LineChart} />
                  AI 成功率日趋势
                </CardTitle>
                <CardDescription>
                  {start === end
                    ? "单日无日趋势，请扩大日期"
                    : "按日展示 AI 成功率，缺日补 0"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <ChartsNamedSeriesTrend
                  series={callsSuccessTrendSeries}
                  emptyText={
                    start === end
                      ? "请扩大日期查看日趋势"
                      : "本区间暂无成功率趋势"
                  }
                  showSummary={false}
                  axisUnit="%"
                  keepZeroSeries
                />
              </CardContent>
            </Card>

            <StatsSectionLabel>调用明细</StatsSectionLabel>
            <div className="space-y-3">
              <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
                <CallBreakdownTable
                  title="按 Provider"
                  nameHeader="Provider"
                  rows={rangeProviderRows}
                  emptyText="暂无 Provider 调用"
                  icon={Cloud}
                />
                <CallBreakdownTable
                  title="按模型"
                  nameHeader="模型"
                  rows={rangeModelRows}
                  emptyText="暂无模型调用"
                  icon={Boxes}
                />
              </div>
              {hint ? (
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </StateBlock>
    </div>
  );
}
