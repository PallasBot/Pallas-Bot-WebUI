import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Activity, BarChart3, Bot, CircleAlert, LineChart, UsersRound } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import {
  fetchConsoleDailyStats,
  fetchInstances,
} from "@/api/fullConsole";
import { fetchIngressDispatch, fetchIngressDispatchHistory } from "@/api/consoleApi";
import type { BotConfigPublic, ConsoleDailyStatRow } from "@/api/pallasTypes";
import ChartsHorizontalRankBars from "@/components/ChartsHorizontalRankBars";
import ChartsMonthlyCommandChart from "@/components/ChartsMonthlyCommandChart";
import ChartsNamedSeriesTrend from "@/components/ChartsNamedSeriesTrend";
import IngressPressureStrips from "@/components/IngressPressureStrips";
import ChartsPluginFilter from "@/components/ChartsPluginFilter";
import ChromeField from "@/components/ChromeField";
import ChromeTools, { CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import DateModeFilter from "@/components/DateModeFilter";
import PageMasthead from "@/components/PageMasthead";
import PendingValue from "@/components/PendingValue";
import RefreshIconButton from "@/components/RefreshIconButton";
import BotAccountCombobox from "@/components/BotAccountCombobox";
import StatsSectionLabel from "@/components/StatsSectionLabel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountPluginCharts } from "@/hooks/useAccountPluginCharts";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import { cn } from "@/lib/utils";
import { botAccountFavoriteRank, botSelectDropdownLabel } from "@/utils/botDisplay";
import {
  currentMonthIso,
  fillDailyRows,
  monthBounds,
  parseBotAccountId,
  readSavedHomeAccount,
  todayIso,
  writeSavedHomeAccount,
} from "@/utils/chartsPageHelpers";
import {
  readChartsPluginFilter,
  resolveDisplayedPlugins,
  writeChartsPluginFilter,
  type ChartsPluginFilterScope,
  type ChartsPluginFilterState,
} from "@/utils/chartsPluginFilter";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";
import type { NamedSeriesInput } from "@/utils/namedSeriesTrend";
import { querySettled } from "@/utils/querySettled";
import { ingressCapacityMetrics, ingressSchedulerMetrics, ingressWorkAuxMetrics } from "@/utils/ingressDispatchWorkQueue";
import {
  buildIngressHistoryView,
  DEFAULT_INGRESS_HISTORY_WINDOW_SEC,
  INGRESS_HISTORY_WINDOWS,
} from "@/utils/ingressDispatchHistory";
import type { ReactNode } from "react";

const CHART_PANEL = "charts-page__panel flex flex-col overflow-hidden shadow-none";
const CHART_PANEL_HD =
  "panel__hd panel__hd--split home-page__panel-hd-nowrap flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const CHART_PANEL_BD = "panel__bd space-y-3 px-4 pb-4 pt-3";
/** 与区间趋势 Matcher 序列同色，柱图不跟主题走 */
const PLUGIN_TODAY_BAR_ACCENT = "#7c3aed";
const INGRESS_POLL_MS = 15_000;

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="metric-tile">
      <div className="metric-tile__head">
        <span className="metric-tile__label">{label}</span>
      </div>
      <div className="metric-tile__value-slot">
        <span className="metric-tile__value metric-tile__value--inline">{value}</span>
        {hint ? <span className="metric-tile__hint muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountFromQuery = parseBotAccountId(searchParams.get("self_id"));
  const [rangeStart, setRangeStart] = useState(() => monthBounds(currentMonthIso()).start);
  const [rangeEnd, setRangeEnd] = useState(todayIso);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(
    () => accountFromQuery ?? readSavedHomeAccount(),
  );
  const [rankFilterOpen, setRankFilterOpen] = useState(false);
  const [matcherFilterOpen, setMatcherFilterOpen] = useState(false);
  const [ingressHistoryWindowSec, setIngressHistoryWindowSec] = useState(DEFAULT_INGRESS_HISTORY_WINDOW_SEC);
  const [rankFilter, setRankFilter] = useState<ChartsPluginFilterState>(() =>
    readChartsPluginFilter(accountFromQuery ?? readSavedHomeAccount(), "rank"),
  );
  const [matcherFilter, setMatcherFilter] = useState<ChartsPluginFilterState>(() =>
    readChartsPluginFilter(accountFromQuery ?? readSavedHomeAccount(), "matcher"),
  );

  function selectAccount(next: number | null) {
    setSelectedAccount(next);
    if (searchParams.has("self_id")) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("self_id");
      setSearchParams(nextParams, { replace: true });
    }
  }

  const { favorites } = useBotFavorites();
  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const ingressQ = useQuery({
    queryKey: ["ingress-dispatch"],
    queryFn: fetchIngressDispatch,
    refetchInterval: INGRESS_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: INGRESS_POLL_MS,
  });
  const ingressHistoryQ = useQuery({
    queryKey: ["ingress-dispatch-history", ingressHistoryWindowSec],
    queryFn: () => fetchIngressDispatchHistory(ingressHistoryWindowSec),
    refetchInterval: INGRESS_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: INGRESS_POLL_MS,
  });

  const queryRange = useMemo(() => {
    const bounds = monthBounds(currentMonthIso());
    const start = rangeStart || bounds.start;
    const end = rangeEnd || todayIso();
    return start <= end ? { start, end } : { start: end, end: start };
  }, [rangeEnd, rangeStart]);

  const dailyRangeQ = useQuery({
    queryKey: ["console-daily-stats-range", queryRange.start, queryRange.end, selectedAccount],
    queryFn: () =>
      fetchConsoleDailyStats({
        start: queryRange.start,
        end: queryRange.end,
        ...(selectedAccount != null ? { selfId: selectedAccount } : {}),
      }),
    enabled: selectedAccount != null,
  });

  const {
    pluginsList,
    chartsBusy,
    scopedPluginPlugins,
    scopedMatcherRunsByPlugin,
    scopedPluginRunRow,
    scopedBotStatsRow,
    consoleDailyStats,
    refreshChartStats,
    ensurePluginsList,
  } = useAccountPluginCharts(selectedAccount);

  useEffect(() => {
    void ensurePluginsList();
  }, [ensurePluginsList]);

  const sortedBots = useMemo(() => {
    const rows = [...((instQ.data?.db_bot_configs || []) as BotConfigPublic[])];
    const nick = (account: number) =>
      instQ.data?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
    rows.sort((a, b) => {
      const fa = botAccountFavoriteRank(favorites, a.account);
      const fb = botAccountFavoriteRank(favorites, b.account);
      if (fa !== fb) return fb - fa;
      const cmp = nick(a.account).localeCompare(nick(b.account), "zh-CN");
      return cmp !== 0 ? cmp : a.account - b.account;
    });
    return rows;
  }, [favorites, instQ.data]);

  const instancesPending = !querySettled(instQ);
  const botsResolved = querySettled(instQ);

  useEffect(() => {
    // 实例列表未返回前不要当成「无 Bot」，否则会闪「未配置」并打断已选账号的图表请求
    if (!botsResolved) return;
    if (!sortedBots.length) {
      setSelectedAccount(null);
      return;
    }
    const inList = (acc: number | null) =>
      acc != null && sortedBots.some((r) => r.account === acc);
    // 优先 URL（仪表盘跳转）→ 当前选择 → 与仪表盘共用的本地记忆 → 列表第一项
    if (inList(accountFromQuery)) {
      if (selectedAccount !== accountFromQuery) setSelectedAccount(accountFromQuery);
      return;
    }
    if (inList(selectedAccount)) return;
    const saved = readSavedHomeAccount();
    if (inList(saved)) {
      setSelectedAccount(saved);
      return;
    }
    setSelectedAccount(sortedBots[0]!.account);
  }, [accountFromQuery, botsResolved, sortedBots, selectedAccount]);

  useEffect(() => {
    // 列表未就绪时不要把仪表盘已选账号写成 null
    if (selectedAccount != null) writeSavedHomeAccount(selectedAccount);
    else if (botsResolved && !sortedBots.length) writeSavedHomeAccount(null);
    setRankFilter(readChartsPluginFilter(selectedAccount, "rank"));
    setMatcherFilter(readChartsPluginFilter(selectedAccount, "matcher"));
  }, [botsResolved, selectedAccount, sortedBots.length]);

  const dailyRowsScoped = useMemo((): ConsoleDailyStatRow[] => {
    const src = dailyRangeQ.data?.rows ?? consoleDailyStats?.rows ?? [];
    return [...src].sort((a, b) => a.date.localeCompare(b.date));
  }, [consoleDailyStats?.rows, dailyRangeQ.data?.rows]);

  const monthlyDailyRows = useMemo(() => {
    if (selectedAccount == null) return [] as ConsoleDailyStatRow[];
    return fillDailyRows(dailyRowsScoped, queryRange.start, queryRange.end, String(selectedAccount));
  }, [dailyRowsScoped, queryRange.end, queryRange.start, selectedAccount]);

  const rangeCommandTotal = useMemo(
    () => dailyRowsScoped.reduce((s, r) => s + (r.matcher_runs || 0), 0),
    [dailyRowsScoped],
  );
  const rangeApiTotal = useMemo(
    () => dailyRowsScoped.reduce((s, r) => s + (r.api_calls ?? 0), 0),
    [dailyRowsScoped],
  );
  const rangeDayCount = Math.max(1, dailyRowsScoped.length);

  const pluginCandidates = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; runsToday: number }>();
    for (const p of scopedPluginPlugins) {
      const id = String(p.name || "").trim();
      if (!id) continue;
      const runs = Number(p.runs_today) || 0;
      if (runs <= 0) continue;
      byId.set(id, {
        id,
        label: matcherPluginDisplayName(id, pluginsList),
        runsToday: runs,
      });
    }
    for (const row of scopedMatcherRunsByPlugin) {
      const id = String(row.plugin || "").trim();
      if (!id || !(row.points?.length ?? 0)) continue;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          label: matcherPluginDisplayName(id, pluginsList),
          runsToday: 0,
        });
      }
    }
    return [...byId.values()].sort(
      (a, b) => b.runsToday - a.runsToday || a.label.localeCompare(b.label),
    );
  }, [pluginsList, scopedMatcherRunsByPlugin, scopedPluginPlugins]);

  const rankPluginIds = useMemo(
    () =>
      resolveDisplayedPlugins(
        pluginCandidates.map((p) => p.id),
        rankFilter,
        12,
      ),
    [pluginCandidates, rankFilter],
  );

  const matcherPluginIds = useMemo(
    () =>
      resolveDisplayedPlugins(
        pluginCandidates.map((p) => p.id),
        matcherFilter,
        12,
      ),
    [matcherFilter, pluginCandidates],
  );

  const rankIdSet = useMemo(() => new Set(rankPluginIds), [rankPluginIds]);

  const topPluginBars = useMemo(() => {
    return pluginCandidates
      .filter((p) => rankIdSet.has(p.id))
      .slice(0, 12)
      .map((p) => ({
        label: p.label,
        fullLabel: p.label,
        value: p.runsToday,
      }));
  }, [pluginCandidates, rankIdSet]);

  const groupMetrics = dailyRangeQ.data?.group_metrics;
  const groupMetricsPending = Boolean(selectedAccount) && !querySettled(dailyRangeQ);
  const dagValue = groupMetricsPending ? (
    <PendingValue pending />
  ) : groupMetrics && Number.isFinite(groupMetrics.dag) ? (
    String(groupMetrics.dag)
  ) : (
    "—"
  );
  const magValue = groupMetricsPending ? (
    <PendingValue pending />
  ) : groupMetrics && Number.isFinite(groupMetrics.mag) ? (
    String(groupMetrics.mag)
  ) : (
    "—"
  );
  const dagMagRatio = groupMetricsPending ? (
    <PendingValue pending />
  ) : groupMetrics?.dag_mag_ratio != null && Number.isFinite(groupMetrics.dag_mag_ratio) ? (
    groupMetrics.dag_mag_ratio.toFixed(2)
  ) : (
    "—"
  );

  const dagTrendSeries = useMemo((): NamedSeriesInput[] => {
    const byDate = new Map<string, number>();
    for (const row of dailyRowsScoped) {
      const date = String(row.date || "").slice(0, 10);
      if (!date) continue;
      byDate.set(date, (byDate.get(date) || 0) + (Number(row.active_groups) || 0));
    }
    const points = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, total]) => ({
        at: Math.floor(new Date(`${date}T12:00:00`).getTime() / 1000),
        total,
      }));
    return [{ id: "dag", label: "DAG", points }];
  }, [dailyRowsScoped]);

  const matcherTrendSeries = useMemo(() => {
    return matcherPluginIds
      .filter((plugin) => {
        const row = scopedMatcherRunsByPlugin.find((r) => r.plugin === plugin);
        return (row?.points?.length ?? 0) > 0;
      })
      .slice(0, 12)
      .map((plugin) => {
        const row = scopedMatcherRunsByPlugin.find((r) => r.plugin === plugin)!;
        return {
          id: plugin,
          label: matcherPluginDisplayName(plugin, pluginsList),
          points: row.points ?? [],
        };
      });
  }, [matcherPluginIds, pluginsList, scopedMatcherRunsByPlugin]);

  function persistFilter(scope: ChartsPluginFilterScope, next: ChartsPluginFilterState) {
    if (scope === "rank") setRankFilter(next);
    else setMatcherFilter(next);
    writeChartsPluginFilter(selectedAccount, scope, next);
  }

  function onTogglePlugin(scope: ChartsPluginFilterScope, id: string, checked: boolean) {
    const filter = scope === "rank" ? rankFilter : matcherFilter;
    const displayed = scope === "rank" ? rankPluginIds : matcherPluginIds;
    const base =
      filter.mode === "custom" && filter.selected.length ? [...filter.selected] : displayed;
    const set = new Set(base);
    if (checked) set.add(id);
    else set.delete(id);
    persistFilter(scope, { mode: "custom", selected: [...set] });
  }

  function onSelectTop(scope: ChartsPluginFilterScope, n: number) {
    persistFilter(scope, {
      mode: "custom",
      selected: pluginCandidates.slice(0, n).map((p) => p.id),
    });
  }

  function onResetAuto(scope: ChartsPluginFilterScope) {
    persistFilter(scope, { mode: "auto", selected: [] });
  }

  const rankSelectedSet = useMemo(() => {
    if (rankFilter.mode === "custom" && rankFilter.selected.length) {
      return new Set(rankFilter.selected);
    }
    return new Set(rankPluginIds);
  }, [rankFilter, rankPluginIds]);

  const matcherSelectedSet = useMemo(() => {
    if (matcherFilter.mode === "custom" && matcherFilter.selected.length) {
      return new Set(matcherFilter.selected);
    }
    return new Set(matcherPluginIds);
  }, [matcherFilter, matcherPluginIds]);

  const accountKpiPending = Boolean(selectedAccount) && chartsBusy && !scopedBotStatsRow;
  const accountTodayMsg = scopedBotStatsRow
    ? `${scopedBotStatsRow.today_received ?? "—"} / ${scopedBotStatsRow.today_sent ?? "—"}`
    : accountKpiPending
      ? <PendingValue pending />
      : "—";
  const accountTodayApi = (() => {
    const n = scopedBotStatsRow?.today_api_calls;
    if (n == null || !Number.isFinite(Number(n))) {
      return accountKpiPending ? <PendingValue pending /> : "—";
    }
    return String(Math.floor(Number(n)));
  })();
  const accountMatcherRuns = (() => {
    const n = scopedPluginRunRow?.runs_today;
    if (n == null || !Number.isFinite(Number(n))) {
      return accountKpiPending || (chartsBusy && !scopedPluginRunRow) ? <PendingValue pending /> : "—";
    }
    return String(Math.floor(Number(n)));
  })();
  const accountMatcherErrors = (() => {
    const n = scopedPluginRunRow?.errors_today;
    if (n == null || !Number.isFinite(Number(n))) {
      return accountKpiPending || (chartsBusy && !scopedPluginRunRow) ? "…" : "—";
    }
    return String(Math.floor(Number(n)));
  })();

  const ingressMetric = (value: number | null | undefined, suffix = ""): string => {
    if (value == null || !Number.isFinite(value)) {
      return ingressQ.isFetching && !ingressQ.data ? "…" : "—";
    }
    return `${Math.round(value).toLocaleString()}${suffix}`;
  };
  const ingress = ingressQ.data;
  const workAux = ingressWorkAuxMetrics(ingress?.work_aux);
  const scheduler = ingressSchedulerMetrics(ingress?.conversation_scheduler);
  const capacity = ingressCapacityMetrics(ingress?.lanes, {
    selected: ingress?.matchers_selected,
    completed: ingress?.matchers_run,
    laneBusy: ingress?.lane_busy,
  });
  const completionRate = capacity.completionRate == null ? "—" : `${Math.round(capacity.completionRate * 100)}%`;
  const chatLane = capacity.chatLimit > 0 ? `${capacity.chatInUse}/${capacity.chatLimit}` : "—";
  const ingressHistory = buildIngressHistoryView(ingressHistoryQ.data);
  const ingressAlerts = ingress?.alerts ?? [];
  const ingressUnavailable = Boolean(ingressQ.error);
  const ingressP95Critical = ingressAlerts.includes("ingress_p95_over_5000ms");
  const ingressP95Warning = ingressAlerts.includes("ingress_p95_over_1000ms");
  const ingressStatusLabel = ingressUnavailable ? "数据暂不可用" : ingressP95Critical ? "严重" : ingressAlerts.length ? "需关注" : "运行正常";
  const ingressStatusVariant = ingressUnavailable || ingressAlerts.length ? (ingressP95Critical ? "destructive" : "warn") : "success";
  const ingressAlertMessage = ingressUnavailable
    ? "入站调度数据暂不可用。"
    : ingressP95Critical
      ? "入站 P95 超过 5 秒，消息处理链路出现严重拥塞。"
      : ingressP95Warning
        ? "入站 P95 超过 1 秒，请关注消息处理链路的延迟。"
        : ingressAlerts.includes("pg_pool_over_85pct")
          ? "数据库连接池占用超过 85%，请关注数据库连接压力。"
          : "入站调度存在需要关注的状态。";

  const rangeBusy = dailyRangeQ.isFetching;
  const rangeTotalsPending = Boolean(selectedAccount) && rangeBusy && !dailyRangeQ.data;
  const refreshing = instQ.isFetching || ingressQ.isFetching || ingressHistoryQ.isFetching || chartsBusy || rangeBusy;

  async function refreshAll() {
    await Promise.all([
      instQ.refetch(),
      ingressQ.refetch(),
      ingressHistoryQ.refetch(),
      dailyRangeQ.refetch(),
      refreshChartStats(),
    ]);
  }

  function botNick(account: number): string {
    return instQ.data?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
  }

  function botTitle(account: number): string {
    return botSelectDropdownLabel(botNick(account) || "BOT", account);
  }

  const mastheadBot =
    sortedBots.length > 1 ? (
      <ChromeField label="账号" icon={Bot} className="shrink-0">
        <BotAccountCombobox
          value={selectedAccount != null ? String(selectedAccount) : ""}
          onValueChange={(v) => selectAccount(Number(v) || null)}
          bots={sortedBots.map((b) => ({
            id: String(b.account),
            nickname: botNick(b.account) || "BOT",
          }))}
          favorites={favorites}
          placeholder="选择账号"
          ariaLabel="选择 Bot 账号"
          title={selectedAccount != null ? botTitle(selectedAccount) : undefined}
        />
      </ChromeField>
    ) : null;

  return (
    <div className="charts-page charts-page--dashboard">
      <PageMasthead
        className="charts-page__masthead"
        title="数据看板"
        description="流量、命令与群活跃概览；趋势与排行同屏。"
        actions={mastheadBot}
      />

      {sortedBots.length || (selectedAccount != null && instancesPending) ? (
        <ChromeTools>
          <DateModeFilter
            size="toolbar"
            start={rangeStart}
            end={rangeEnd}
            onStartChange={setRangeStart}
            onEndChange={setRangeEnd}
          />
          <div className={CHROME_TOOLS_TRAILING}>
            <RefreshIconButton
              busy={refreshing}
              label="刷新"
              showLabel
              onClick={() => void refreshAll()}
            />
          </div>
        </ChromeTools>
      ) : null}

      {instancesPending && selectedAccount == null ? (
        <p className="muted charts-page__empty" role="status" aria-busy="true">
          账号列表加载中 <PendingValue pending />
        </p>
      ) : null}

      {botsResolved && !sortedBots.length ? (
        <p className="muted charts-page__empty">数据库中暂无 Bot 配置。请先在「数据库实例」创建账号。</p>
      ) : null}

      {selectedAccount != null ? (
        <div className="charts-page__layout" aria-busy={refreshing || undefined}>
          <StatsSectionLabel>摘要</StatsSectionLabel>
          <section className="charts-page__kpi home-kpi-bar" aria-label="今日与区间摘要">
            <MetricTile label="今日消息" value={accountTodayMsg} hint="收 / 发" />
            <MetricTile label="今日 API" value={accountTodayApi} hint="协议调用" />
            <MetricTile
              label="今日 Matcher"
              value={accountMatcherRuns}
              hint={`异常 ${accountMatcherErrors}`}
            />
            <MetricTile label="DAG" value={dagValue} hint="今日活跃群" />
            <MetricTile
              label="MAG"
              value={magValue}
              hint={`近 ${groupMetrics?.mag_days ?? 30} 日`}
            />
            <MetricTile label="DAG/MAG" value={dagMagRatio} hint="日活 / 月活" />
            <MetricTile
              label="区间 Matcher"
              value={rangeTotalsPending ? <PendingValue pending /> : rangeCommandTotal.toLocaleString()}
              hint={
                rangeTotalsPending
                  ? "加载中"
                  : `日均 ${Math.round(rangeCommandTotal / rangeDayCount).toLocaleString()}`
              }
            />
            <MetricTile
              label="区间 API"
              value={rangeTotalsPending ? <PendingValue pending /> : rangeApiTotal.toLocaleString()}
              hint={
                rangeTotalsPending
                  ? "加载中"
                  : `日均 ${Math.round(rangeApiTotal / rangeDayCount).toLocaleString()}`
              }
            />
          </section>

          <section
            id="charts-ingress"
            className={cn(
              "charts-page__section charts-page__ingress",
              ingressP95Critical ? "charts-page__ingress--critical" : ingressAlerts.length && "charts-page__ingress--warn",
            )}
            aria-label="入站调度状态"
          >
            <div className="charts-page__ingress-header">
              <div className="flex min-w-0 items-center gap-1.5">
                <PanelTitleIcon icon={Activity} />
                <h2 className="panel__title">入站调度</h2>
              </div>
              <div className="charts-page__ingress-actions">
                <Badge variant={ingressStatusVariant} role="status">
                  {ingressAlerts.length ? <CircleAlert className="size-3" aria-hidden /> : null}
                  {ingressStatusLabel}
                </Badge>
                <Badge variant="outline">每 15 秒刷新</Badge>
                <select
                  className="charts-page__ingress-window"
                  aria-label="入站历史时间范围"
                  value={ingressHistoryWindowSec}
                  onChange={(event) => setIngressHistoryWindowSec(Number(event.target.value))}
                >
                  {INGRESS_HISTORY_WINDOWS.map((window) => (
                    <option key={window.seconds} value={window.seconds}>{window.label}</option>
                  ))}
                </select>
                <RefreshIconButton
                  embedded
                  busy={ingressQ.isFetching}
                  label="刷新入站调度"
                  onClick={() => void ingressQ.refetch()}
                />
              </div>
            </div>
            <div className="charts-page__kpi home-kpi-bar charts-page__kpi--ingress-key" aria-label="入站调度关键指标">
              <MetricTile label="群消息" value={ingressMetric(ingress?.group_messages)} hint="今日累计" />
              <MetricTile label="入站分发 P95" value={ingressMetric(ingress?.ingress_duration_ms_p95, " ms")} hint={`背压 ${ingressMetric(ingress?.overload_signals)}`} />
              <MetricTile label="入站全执行 P95" value={ingressMetric(ingress?.ingress_full_ms_p95, " ms")} hint="含 matcher/handler 执行" />
              <MetricTile label="调度等待 P95" value={ingressMetric(scheduler.waitP95Ms, " ms")} hint={`执行 ${ingressMetric(scheduler.runP95Ms, " ms")} · 背压 ${ingressMetric(scheduler.backpressureWaits)}`} />
              <MetricTile label="Matcher 完成率" value={completionRate} hint={`完成 ${ingressMetric(capacity.completed)}/${ingressMetric(capacity.selected)} · 忙 ${ingressMetric(capacity.laneBusy)}`} />
              <MetricTile label="Chat Lane" value={chatLane} hint="执行中 / 上限" />
              <MetricTile label="后台任务" value={ingressMetric(workAux.pending)} hint={`执行中 ${ingressMetric(workAux.leased)} · ${ingressMetric(workAux.consumers)} 路`} />
            </div>
            <div className="charts-page__ingress-board">
              <Card className={CHART_PANEL}>
                <CardHeader className={CHART_PANEL_HD}><CardTitle className="panel__title">延迟趋势</CardTitle></CardHeader>
                <CardContent className={CHART_PANEL_BD}><ChartsNamedSeriesTrend series={ingressHistory.latency} busy={ingressHistoryQ.isFetching} chartUid="ingress-latency" showSummary={false} axisUnit=" ms" compact /></CardContent>
              </Card>
              <Card className={CHART_PANEL}>
                <CardHeader className={CHART_PANEL_HD}><CardTitle className="panel__title">学习流水线</CardTitle></CardHeader>
                <CardContent className={CHART_PANEL_BD}><ChartsNamedSeriesTrend series={ingressHistory.learning} busy={ingressHistoryQ.isFetching} chartUid="ingress-learning" showSummary={false} axisUnit=" 条" compact stacked /></CardContent>
              </Card>
              <Card className={cn(CHART_PANEL, "charts-page__ingress-pressure-panel")}>
                <CardHeader className={CHART_PANEL_HD}><CardTitle className="panel__title">近期压力</CardTitle></CardHeader>
                <CardContent className={CHART_PANEL_BD}><IngressPressureStrips points={ingressHistory.pressure} /></CardContent>
              </Card>
            </div>
            {ingressAlerts.length || ingressUnavailable ? (
              <div className={cn("charts-page__ingress-alert", ingressP95Critical && "charts-page__ingress-alert--critical")} role="status">
                <CircleAlert className="size-4 shrink-0" aria-hidden />
                <span>
                  {ingressAlertMessage}
                </span>
              </div>
            ) : null}
          </section>

          <StatsSectionLabel>趋势</StatsSectionLabel>
          <section id="charts-trend" className="charts-page__section charts-page__section--hero">
            <div className="charts-page__board charts-page__board--cards">
              <Card className={cn(CHART_PANEL, "charts-page__panel--hero")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={LineChart} />
                    区间趋势
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead">消息 · Matcher · API（按日）</p>
                  <ChartsMonthlyCommandChart
                    rows={monthlyDailyRows}
                    busy={rangeBusy || chartsBusy}
                    emptyText="所选区间暂无数据"
                  />
                </CardContent>
              </Card>
              <Card className={cn(CHART_PANEL, "charts-page__panel--hero")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={UsersRound} />
                    活跃群趋势
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead">区间内每日 DAG</p>
                  <ChartsNamedSeriesTrend
                    series={dagTrendSeries}
                    busy={rangeBusy}
                    showSummary={false}
                    axisUnit=""
                    emptyText="暂无活跃群数据"
                    compact
                  />
                </CardContent>
              </Card>
            </div>
          </section>

          <StatsSectionLabel>明细</StatsSectionLabel>
          <section id="charts-detail" className="charts-page__section charts-page__section--secondary">
            <div className="charts-page__board flex flex-col gap-[var(--console-panel-gap,18px)]">
              <Card className={cn(CHART_PANEL, "charts-page__panel--secondary")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={Activity} />
                    Matcher 实时
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead mb-0">时间桶趋势</p>
                  <ChartsNamedSeriesTrend
                    series={matcherTrendSeries}
                    busy={chartsBusy}
                    chartUid="charts-matcher-bucket"
                    maxSeries={12}
                    emptyText="暂无 Matcher 时序"
                  />
                  <ChartsPluginFilter
                    embedded
                    open={matcherFilterOpen}
                    onOpenChange={setMatcherFilterOpen}
                    options={pluginCandidates.slice(0, 20)}
                    selected={matcherSelectedSet}
                    mode={matcherFilter.mode}
                    onToggle={(id, checked) => onTogglePlugin("matcher", id, checked)}
                    onSelectTop={(n) => onSelectTop("matcher", n)}
                    onResetAuto={() => onResetAuto("matcher")}
                  />
                </CardContent>
              </Card>

              <Card className={cn(CHART_PANEL, "charts-page__panel--secondary")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={BarChart3} />
                    插件排行
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead mb-0">今日 Matcher 次数</p>
                  <ChartsHorizontalRankBars
                    points={topPluginBars}
                    unit="次"
                    accent={PLUGIN_TODAY_BAR_ACCENT}
                    softScale
                    emptyText={chartsBusy ? "加载中…" : "暂无今日数据"}
                  />
                  <ChartsPluginFilter
                    embedded
                    open={rankFilterOpen}
                    onOpenChange={setRankFilterOpen}
                    options={pluginCandidates.slice(0, 20)}
                    selected={rankSelectedSet}
                    mode={rankFilter.mode}
                    onToggle={(id, checked) => onTogglePlugin("rank", id, checked)}
                    onSelectTop={(n) => onSelectTop("rank", n)}
                    onResetAuto={() => onResetAuto("rank")}
                  />
                </CardContent>
              </Card>
            </div>
            {!chartsBusy && !scopedPluginPlugins.length ? (
              <p className="muted charts-page__board-note">
                排行与实时桶需 Bot 运行一段时间；区间趋势依赖按日落盘。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
