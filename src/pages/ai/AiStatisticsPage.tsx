import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  CheckCircle2,
  Cloud,
  Coins,
  Database,
  Library,
  Send,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import { fetchLlmTaskStats } from "@/api/fullConsole";
import { useRegisterAiObservationChrome } from "@/components/ai/AiObservationChromeContext";
import TokenDonutChart from "@/components/ai/TokenDonutChart";
import DateModeFilter, { type DateMode } from "@/components/DateModeFilter";
import IconStatCard from "@/components/IconStatCard";
import StateBlock from "@/components/StateBlock";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDaysIso,
  aggregateHistoryImages,
  aggregateHistoryRag,
  aggregateHistoryTokens,
  buildPersistenceHint,
  formatCompactNumber,
  ragDocumentRows,
  summarizeTaskStats,
  todayIso,
  type TokenBucket,
} from "@/utils/aiTaskStats";

function RangeMetricCard({
  label,
  data,
  loading,
}: {
  label: string;
  data: TokenBucket;
  loading: boolean;
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
      </CardContent>
    </Card>
  );
}

export default function AiStatisticsPage() {
  const qc = useQueryClient();
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [dateMode, setDateMode] = useState<DateMode>("single");

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
  const selectedRagDocs = useMemo(
    () => ragDocumentRows(selectedRag.byDocument),
    [selectedRag.byDocument],
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

  const hint = buildPersistenceHint(taskStatsQ.data?.persistence);
  const loading = taskStatsQ.isLoading;

  return (
    <div className="space-y-3">
      <StateBlock loading={loading} error={taskStatsQ.error}>
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
                <div className="text-[11px] text-muted-foreground">
                  {start}
                  {start !== end ? ` ~ ${end}` : ""}
                </div>
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

          <div className="console-panel-grid grid-cols-2">
            <RangeMetricCard label="近 7 天" data={range7} loading={loading} />
            <RangeMetricCard label="近 30 天" data={range30} loading={loading} />
          </div>

          <div className="console-panel-grid grid-cols-1 sm:grid-cols-2">
            <Card>
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <PanelTitleIcon icon={Boxes} />
                  按模型
                </CardTitle>
                <CardDescription>按 token 总量占比</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <TokenDonutChart rows={summary.tokenModelRows} emptyText="暂无按模型数据" />
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
                <TokenDonutChart rows={summary.tokenProviderRows} emptyText="暂无按提供方数据" />
              </CardContent>
            </Card>
          </div>

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

          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-1.5 text-base">
                <PanelTitleIcon icon={Library} />
                RAG 效果
              </CardTitle>
              <CardDescription>知识库检索：有结果为 hit，空结果为 miss；下表为文档命中次数。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="console-panel-grid grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="space-y-1 p-3">
                    <div className="text-xs text-muted-foreground">命中率</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {loading ? "…" : `${selectedRag.hitRate.toFixed(1)}%`}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${Math.min(100, Math.max(0, selectedRag.hitRate))}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-3">
                    <div className="text-xs text-muted-foreground">命中查询</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {loading ? "…" : formatCompactNumber(selectedRag.hitCount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-3">
                    <div className="text-xs text-muted-foreground">空结果</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {loading ? "…" : formatCompactNumber(selectedRag.missCount)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="space-y-1 p-3">
                    <div className="text-xs text-muted-foreground">总查询</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {loading
                        ? "…"
                        : formatCompactNumber(selectedRag.hitCount + selectedRag.missCount)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {selectedRagDocs.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[20rem] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-3 font-medium">文档</th>
                        <th className="py-2 font-medium">命中次数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRagDocs.slice(0, 20).map((row) => (
                        <tr key={row.key} className="border-t border-border/60">
                          <td className="max-w-[16rem] truncate py-2 pr-3" title={row.key}>
                            {row.key}
                          </td>
                          <td className="py-2 tabular-nums">{row.hitCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  暂无 RAG 数据。开启知识库并产生检索对话后会出现。
                </p>
              )}
            </CardContent>
          </Card>

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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="size-4" />
                提供方请求
              </CardTitle>
              <CardDescription>{hint}</CardDescription>
            </CardHeader>
            <CardContent>
              {summary.providerRows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 font-medium">提供方</th>
                        <th className="pb-2 font-medium">请求</th>
                        <th className="pb-2 font-medium">成功</th>
                        <th className="pb-2 font-medium">失败</th>
                        <th className="pb-2 font-medium">均耗时</th>
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
                <p className="text-sm text-muted-foreground">暂无提供方数据</p>
              )}
            </CardContent>
          </Card>
        </div>
      </StateBlock>
    </div>
  );
}
