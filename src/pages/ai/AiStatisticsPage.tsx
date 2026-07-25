import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  CheckCircle2,
  Cloud,
  Coins,
  Database,
  Filter,
  Library,
  LineChart,
  Send,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { fetchLlmTaskStats } from "@/api/fullConsole";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import TokenShareBars from "@/components/ai/TokenShareBars";
import ChartsNamedSeriesTrend from "@/components/ChartsNamedSeriesTrend";
import DateModeFilter, { type DateMode } from "@/components/DateModeFilter";
import IconStatCard from "@/components/IconStatCard";
import SegTabs from "@/components/SegTabs";
import StateBlock from "@/components/StateBlock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDaysIso,
  aggregateHistoryAiOutcomes,
  aggregateHistoryGates,
  aggregateHistoryImages,
  aggregateHistoryRag,
  aggregateHistoryRoutes,
  aggregateHistoryTokens,
  buildPersistenceHint,
  dailyRagTrend,
  dailyTokenTrend,
  formatCompactNumber,
  hourlyTokenTrendPoints,
  ragDocumentRows,
  summarizeTaskStats,
  todayIso,
  type TokenBucket,
} from "@/utils/aiTaskStats";
import { labelLlmRoute } from "@/utils/aiHistoryLabels";
import type { NamedSeriesInput } from "@/utils/namedSeriesTrend";

const TAB_STORAGE_KEY = "pallas.ai-statistics.active-tab";
const TAB_OPTIONS = [
  { value: "overview", label: "概览" },
  { value: "token", label: "Token" },
  { value: "rag", label: "RAG" },
  { value: "calls", label: "调用" },
] as const;

type StatsTab = (typeof TAB_OPTIONS)[number]["value"];

function readStoredTab(): StatsTab {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (raw && TAB_OPTIONS.some((opt) => opt.value === raw)) return raw as StatsTab;
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
}: {
  label: string;
  data: TokenBucket;
  loading: boolean;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-3 sm:p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold tabular-nums sm:text-2xl">
          {loading ? "…" : formatCompactNumber(data.totalTokens)}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>输入 {loading ? "…" : formatCompactNumber(data.promptTokens)}</span>
          <span>输出 {loading ? "…" : formatCompactNumber(data.completionTokens)}</span>
          <span>缓存读 {loading ? "…" : formatCompactNumber(data.cacheReadTokens)}</span>
          <span>缓存写 {loading ? "…" : formatCompactNumber(data.cacheWriteTokens)}</span>
        </div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

function cacheHitRateFromBucket(bucket: TokenBucket): number {
  const denom = bucket.promptTokens + bucket.cacheReadTokens;
  if (denom <= 0) return 0;
  return Math.round((1000 * bucket.cacheReadTokens) / denom) / 10;
}

export default function AiStatisticsPage() {
  const qc = useQueryClient();
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [dateMode, setDateMode] = useState<DateMode>("single");
  const [activeTab, setActiveTab] = useState<StatsTab>(readStoredTab);

  /** 查询窗口至少覆盖近 30 天，便于平铺 7d/30d 数值。 */
  const queryStart = useMemo(() => {
    const floor = addDaysIso(todayIso(), -29);
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

  const summary = useMemo(() => summarizeTaskStats(taskStatsQ.data), [taskStatsQ.data]);
  const historyRows = taskStatsQ.data?.history?.rows;

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

  const rangeCacheHitRate = useMemo(() => cacheHitRateFromBucket(selectedRange), [selectedRange]);
  const rangeAiTotal = selectedOutcomes.ok + selectedOutcomes.fail;
  const aiOk = rangeAiTotal > 0 ? selectedOutcomes.ok : summary.aiOk;
  const aiFail = rangeAiTotal > 0 ? selectedOutcomes.fail : summary.aiFail;
  const aiTotal = aiOk + aiFail;
  const aiSuccessRate = aiTotal > 0 ? (aiOk / aiTotal) * 100 : null;

  const tokenTrendSeries = useMemo((): NamedSeriesInput[] => {
    const daily = dailyTokenTrend(historyRows, start, end);
    if (daily.length >= 2) {
      return [
        {
          id: "tokens",
          label: "Token",
          points: daily.map((p) => ({
            at: Math.floor(new Date(`${p.date}T12:00:00`).getTime() / 1000),
            total: p.totalTokens,
          })),
        },
      ];
    }
    // 单日：改按小时，避免补点画成水平直线
    const day = start === end ? start : daily[0]?.date || start;
    const histRow = (historyRows ?? []).find((r) => String(r.date || "").slice(0, 10) === day);
    const fromHist = hourlyTokenTrendPoints(histRow?.ai?.tokens?.by_hour, day);
    const fromLive =
      day === todayIso() ? hourlyTokenTrendPoints(taskStatsQ.data?.ai?.tokens?.by_hour, day) : [];
    const hourly = fromHist.length >= 2 ? fromHist : fromLive;
    if (hourly.length >= 2) {
      return [{ id: "tokens", label: "Token", points: hourly }];
    }
    return [
      {
        id: "tokens",
        label: "Token",
        points: daily.map((p) => ({
          at: Math.floor(new Date(`${p.date}T12:00:00`).getTime() / 1000),
          total: p.totalTokens,
        })),
      },
    ];
  }, [end, historyRows, start, taskStatsQ.data?.ai?.tokens?.by_hour]);

  const tokenTrendIsHourly = useMemo(() => {
    const daily = dailyTokenTrend(historyRows, start, end);
    return daily.length < 2;
  }, [end, historyRows, start]);

  const ragTrendSeries = useMemo((): NamedSeriesInput[] => {
    const knowledge = dailyRagTrend(historyRows, start, end, "rag").map((p) => ({
      at: Math.floor(new Date(`${p.date}T12:00:00`).getTime() / 1000),
      total: p.hitRate,
    }));
    const memory = dailyRagTrend(historyRows, start, end, "memory_rag").map((p) => ({
      at: Math.floor(new Date(`${p.date}T12:00:00`).getTime() / 1000),
      total: p.hitRate,
    }));
    return [
      { id: "knowledge", label: "知识库命中率%", points: knowledge },
      { id: "memory", label: "记忆命中率%", points: memory },
    ];
  }, [end, historyRows, start]);

  const routeDonutRows = useMemo(
    () =>
      Object.entries(selectedRoutes)
        .map(([key, totalTokens]) => ({
          key: labelLlmRoute(key),
          totalTokens,
          promptTokens: 0,
          completionTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        }))
        .filter((r) => r.totalTokens > 0)
        .sort((a, b) => b.totalTokens - a.totalTokens),
    [selectedRoutes],
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
        mode={dateMode}
        onModeChange={setDateMode}
        start={start}
        end={end}
        onStartChange={setStart}
        onEndChange={setEnd}
      />
    ),
    [dateMode, end, start],
  );

  const onRefresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["llm-task-stats"] });
  }, [qc]);

  useRegisterAiObservationChrome({ middle: dateFilter, onRefresh });

  const onTabChange = useCallback((value: string) => {
    const next = TAB_OPTIONS.some((opt) => opt.value === value) ? (value as StatsTab) : "overview";
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
  const costCurrency = selectedRange.costCurrency || summary.tokens.costCurrency;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <SegTabs
          value={activeTab}
          onValueChange={onTabChange}
          options={TAB_OPTIONS}
          ariaLabel="AI 统计分类"
          listClassName="min-w-max"
        />
      </div>

      <StateBlock loading={loading} error={taskStatsQ.error}>
        {activeTab === "overview" ? (
          <div className="space-y-3">
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="size-3.5" />
                    当前区间总量
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.totalTokens)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">
                    费用{costCurrency ? ` (${costCurrency})` : ""}
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : selectedRange.costTotal > 0
                        ? selectedRange.costTotal.toFixed(4)
                        : selectedRange.totalTokens > 0
                          ? "未配置单价"
                          : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {selectedRange.costTotal > 0
                      ? "区间累计"
                      : selectedRange.totalTokens > 0
                        ? "在提供方里为模型填写单价后可估算"
                        : "暂无 Token 用量"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">AI 成功率</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : aiSuccessRate != null ? `${aiSuccessRate.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    成功 {aiOk} · 失败 {aiFail}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">缓存命中率</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${rangeCacheHitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">当前区间</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">门控放行</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : formatCompactNumber(selectedGates.proceed)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    skip {selectedGates.skip} · defer {selectedGates.defer}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">记忆命中</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : formatCompactNumber(selectedMemoryRag.hitCount)}
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
                hint="相对今天的固定窗口，不受顶栏日期影响"
              />
              <RangeMetricCard
                label="近 30 天"
                data={range30}
                loading={loading}
                hint="相对今天的固定窗口，不受顶栏日期影响"
              />
            </div>

            <div className="console-panel-grid grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    {tokenTrendIsHourly ? "Token 小时趋势" : "Token 日趋势"}
                  </CardTitle>
                  <CardDescription>
                    {tokenTrendIsHourly
                      ? "当前仅 1 天，按小时展示（扩大日期可看日趋势）"
                      : "当前区间按日总量"}
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
                  <CardDescription>当前区间路径次数占比</CardDescription>
                </CardHeader>
                <CardContent className="min-h-[260px] p-3 pt-0 sm:p-6 sm:pt-0">
                  <TokenShareBars rows={routeDonutRows} emptyText="暂无路径数据" />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Activity} />
                  提供方健康
                </CardTitle>
                <CardDescription>摘要前 5 条；完整明细见「调用」</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0 sm:p-6 sm:pt-0">
                {summary.providerRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">提供方</th>
                          <th className="pb-2 font-medium">次数</th>
                          <th className="pb-2 font-medium">成功</th>
                          <th className="pb-2 font-medium">失败</th>
                          <th className="pb-2 font-medium">平均耗时</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.providerRows.slice(0, 5).map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="py-2 font-mono text-xs">{row.key}</td>
                            <td className="py-2 tabular-nums">{row.requests}</td>
                            <td className="py-2 tabular-nums">{row.succeeded}</td>
                            <td className="py-2 tabular-nums">{row.failed}</td>
                            <td className="py-2 tabular-nums text-muted-foreground">
                              {row.avgLatencyMs != null ? `${Math.round(row.avgLatencyMs)}ms` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无调用数据</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "token" ? (
          <div className="space-y-3">
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-5">
              <Card className="col-span-2 lg:col-span-1">
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="size-3.5" />
                    当前区间总量
                  </div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.totalTokens)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">输入</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.promptTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">输出</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.completionTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">缓存读</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.cacheReadTokens)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">缓存写</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {formatCompactNumber(selectedRange.cacheWriteTokens)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="console-panel-grid grid-cols-1 lg:grid-cols-3">
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Boxes} />
                    按模型
                  </CardTitle>
                  <CardDescription>按 token 总量占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <TokenShareBars rows={summary.tokenModelRows} emptyText="暂无按模型数据" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Cloud} />
                    按提供方
                  </CardTitle>
                  <CardDescription>按 token 总量占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <TokenShareBars rows={summary.tokenProviderRows} emptyText="暂无按提供方数据" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Boxes} />
                    按任务
                  </CardTitle>
                  <CardDescription>按 token 总量占比</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <TokenShareBars rows={summary.tokenTaskRows} emptyText="暂无按任务数据" />
                </CardContent>
              </Card>
            </div>

            {summary.tokenHourRows.length ? (
              <Card>
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    今日按小时 Token
                  </CardTitle>
                  <CardDescription>当日实时桶（非历史区间）</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3 font-medium">小时</th>
                          <th className="py-2 pr-3 font-medium">总量</th>
                          <th className="py-2 pr-3 font-medium">输入</th>
                          <th className="py-2 font-medium">输出</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.tokenHourRows.map((row) => (
                          <tr key={row.key} className="border-t border-border/60">
                            <td className="py-2 pr-3 font-mono text-xs">{row.key}:00</td>
                            <td className="py-2 pr-3 tabular-nums">{row.totalTokens}</td>
                            <td className="py-2 pr-3 tabular-nums">{row.promptTokens}</td>
                            <td className="py-2 tabular-nums">{row.completionTokens}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Coins} />
                  画画用量
                </CardTitle>
                <CardDescription>出图成功/失败与张数；费用为可选字段。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardContent className="space-y-1 p-3">
                      <div className="text-xs text-muted-foreground">成功</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {loading ? "…" : formatCompactNumber(selectedImages.okCount)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-1 p-3">
                      <div className="text-xs text-muted-foreground">失败</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {loading ? "…" : formatCompactNumber(selectedImages.failCount)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-1 p-3">
                      <div className="text-xs text-muted-foreground">出图张数</div>
                      <div className="text-xl font-semibold tabular-nums">
                        {loading ? "…" : formatCompactNumber(selectedImages.imageCount)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-1 p-3">
                      <div className="text-xs text-muted-foreground">
                        费用{selectedImages.costCurrency ? ` (${selectedImages.costCurrency})` : ""}
                      </div>
                      <div className="text-xl font-semibold tabular-nums">
                        {loading
                          ? "…"
                          : selectedImages.costTotal > 0
                            ? selectedImages.costTotal.toFixed(4)
                            : "—"}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {summary.imageGatewayRows.length || summary.imageModelRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="py-2 pr-3 font-medium">类型</th>
                          <th className="py-2 pr-3 font-medium">键</th>
                          <th className="py-2 pr-3 font-medium">成功</th>
                          <th className="py-2 pr-3 font-medium">失败</th>
                          <th className="py-2 font-medium">张数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.imageGatewayRows.map((row) => (
                          <tr key={`gw-${row.key}`} className="border-t border-border/60">
                            <td className="py-2 pr-3 text-muted-foreground">网关</td>
                            <td className="py-2 pr-3 font-mono text-xs">{row.key}</td>
                            <td className="py-2 pr-3 tabular-nums">{row.okCount}</td>
                            <td className="py-2 pr-3 tabular-nums">{row.failCount}</td>
                            <td className="py-2 tabular-nums">{row.imageCount}</td>
                          </tr>
                        ))}
                        {summary.imageModelRows.map((row) => (
                          <tr key={`model-${row.key}`} className="border-t border-border/60">
                            <td className="py-2 pr-3 text-muted-foreground">模型</td>
                            <td className="py-2 pr-3 font-mono text-xs">{row.key}</td>
                            <td className="py-2 pr-3 tabular-nums">{row.okCount}</td>
                            <td className="py-2 pr-3 tabular-nums">{row.failCount}</td>
                            <td className="py-2 tabular-nums">{row.imageCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无画画数据（需较新的画画插件）。</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {activeTab === "rag" ? (
          <div className="space-y-3">
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">知识库命中率</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${selectedRag.hitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    hit {selectedRag.hitCount} · miss {selectedRag.missCount}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">知识库查询</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading
                      ? "…"
                      : formatCompactNumber(selectedRag.hitCount + selectedRag.missCount)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-1 p-3 sm:p-4">
                  <div className="text-xs text-muted-foreground">记忆命中率</div>
                  <div className="text-xl font-semibold tabular-nums sm:text-2xl">
                    {loading ? "…" : `${selectedMemoryRag.hitRate.toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    hit {selectedMemoryRag.hitCount} · miss {selectedMemoryRag.missCount}
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
                          selectedMemoryRag.hitCount + selectedMemoryRag.missCount,
                        )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{rangeLabel}</div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-3">
              <Card>
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={Library} />
                    文档命中 Top 8
                  </CardTitle>
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
                            <tr key={row.key} className="border-t border-border/60">
                              <td className="max-w-[14rem] truncate py-1.5 pr-3" title={row.key}>
                                {row.key}
                              </td>
                              <td className="py-1.5 tabular-nums">{row.hitCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无文档命中</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3 sm:p-4">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <PanelTitleIcon icon={LineChart} />
                    命中率趋势
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
                  <ChartsNamedSeriesTrend
                    series={ragTrendSeries}
                    emptyText="暂无 RAG 趋势"
                    showSummary={false}
                    axisUnit="%"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}

        {activeTab === "calls" ? (
          <div className="space-y-3">
            <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
              <IconStatCard
                title="LLM 统计"
                value={summary.reachable == null ? "…" : summary.reachable ? "正常" : "不可用"}
                icon={summary.reachable ? Wifi : WifiOff}
                subtitle={
                  summary.reachable == null
                    ? "正在读取…"
                    : summary.reachable
                      ? "本地 token / 任务数据"
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
                  summary.aiFail > 0 ? "text-rose-600 dark:text-rose-400" : undefined
                }
              />
            </div>

            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Database} />
                  提供方调用
                </CardTitle>
                <CardDescription>各上游成功 / 失败与耗时</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-3 pt-0 sm:p-6 sm:pt-0">
                {summary.providerRows.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">提供方</th>
                          <th className="pb-2 font-medium">次数</th>
                          <th className="pb-2 font-medium">成功</th>
                          <th className="pb-2 font-medium">失败</th>
                          <th className="pb-2 font-medium">平均耗时</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.providerRows.slice(0, 12).map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="py-2 font-mono text-xs">{row.key}</td>
                            <td className="py-2 tabular-nums">{row.requests}</td>
                            <td className="py-2 tabular-nums">{row.succeeded}</td>
                            <td className="py-2 tabular-nums">{row.failed}</td>
                            <td className="py-2 tabular-nums text-muted-foreground">
                              {row.avgLatencyMs != null ? `${Math.round(row.avgLatencyMs)}ms` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无调用数据</p>
                )}
                {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </StateBlock>
    </div>
  );
}
