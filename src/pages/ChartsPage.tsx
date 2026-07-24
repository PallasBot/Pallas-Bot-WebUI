import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bot, LineChart } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import {
  fetchConsoleDailyStats,
  fetchInstances,
  fetchPluginRunStats,
} from "@/api/fullConsole";
import type { BotConfigPublic, ConsoleDailyStatRow } from "@/api/pallasTypes";
import ChartsDailyBarChart from "@/components/ChartsDailyBarChart";
import ChartsMonthlyCommandChart from "@/components/ChartsMonthlyCommandChart";
import ChartsNamedSeriesTrend from "@/components/ChartsNamedSeriesTrend";
import ChromeField from "@/components/ChromeField";
import ChromeTools from "@/components/ChromeTools";
import DateModeFilter, { type DateMode } from "@/components/DateModeFilter";
import PageMasthead from "@/components/PageMasthead";
import RefreshIconButton from "@/components/RefreshIconButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccountPluginCharts } from "@/hooks/useAccountPluginCharts";
import { cn } from "@/lib/utils";
import {
  currentMonthIso,
  fillDailyRows,
  monthBounds,
  readSavedHomeAccount,
  todayIso,
  writeSavedHomeAccount,
} from "@/utils/chartsPageHelpers";
import { defaultTopKeys } from "@/utils/homePluginChartPack";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";

const CHART_PANEL = "charts-page__panel flex flex-col overflow-hidden shadow-none";
const CHART_PANEL_HD =
  "panel__hd panel__hd--split home-page__panel-hd-nowrap flex-row items-center justify-between space-y-0 border-b px-4 py-3";
const CHART_PANEL_BD = "panel__bd space-y-3 px-4 pb-4 pt-3";
const ACCOUNT_SEL =
  "charts-page__account-sel h-8 w-[7rem] min-w-[5rem] max-w-[7rem] shrink-0 overflow-hidden";
/** 与区间趋势 Matcher 序列同色，柱图不跟主题走 */
const PLUGIN_TODAY_BAR_ACCENT = "#7c3aed";

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
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
  const [rangeStart, setRangeStart] = useState(() => monthBounds(currentMonthIso()).start);
  const [rangeEnd, setRangeEnd] = useState(todayIso);
  const [dateMode, setDateMode] = useState<DateMode>("range");
  const [selectedAccount, setSelectedAccount] = useState<number | null>(() => readSavedHomeAccount());

  const instQ = useQuery({ queryKey: ["instances"], queryFn: () => fetchInstances() });
  const pluginRunGlobalQ = useQuery({ queryKey: ["plugin-run-stats-global"], queryFn: () => fetchPluginRunStats() });

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

  useEffect(() => {
    void instQ.refetch();
    void pluginRunGlobalQ.refetch();
    void refreshChartStats();
  }, [refreshChartStats]);

  const sortedBots = useMemo(() => {
    const rows = [...((instQ.data?.db_bot_configs || []) as BotConfigPublic[])];
    const nick = (account: number) =>
      instQ.data?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
    rows.sort((a, b) => {
      const cmp = nick(a.account).localeCompare(nick(b.account), "zh-CN");
      return cmp !== 0 ? cmp : a.account - b.account;
    });
    return rows;
  }, [instQ.data]);

  useEffect(() => {
    if (!sortedBots.length) {
      setSelectedAccount(null);
      return;
    }
    if (selectedAccount != null && sortedBots.some((r) => r.account === selectedAccount)) return;
    setSelectedAccount(sortedBots[0]!.account);
  }, [sortedBots, selectedAccount]);

  useEffect(() => {
    writeSavedHomeAccount(selectedAccount);
  }, [selectedAccount]);

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

  const topPluginBars = useMemo(() => {
    return [...scopedPluginPlugins]
      .filter((p) => p.runs_today > 0)
      .sort((a, b) => b.runs_today - a.runs_today || a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((p) => {
        const label = matcherPluginDisplayName(p.name, pluginsList);
        return {
          date: label,
          value: p.runs_today,
          label: label.length > 8 ? `${label.slice(0, 7)}…` : label,
        };
      });
  }, [pluginsList, scopedPluginPlugins]);

  const matcherTrendSeries = useMemo(() => {
    const keys = scopedMatcherRunsByPlugin
      .filter((s) => (s.points?.length ?? 0) > 0)
      .map((s) => s.plugin);
    const top = keys.length
      ? defaultTopKeys(keys, (k) => scopedMatcherRunsByPlugin.find((r) => r.plugin === k)?.points ?? [], 6)
      : [];
    return top.map((plugin) => {
      const row = scopedMatcherRunsByPlugin.find((r) => r.plugin === plugin)!;
      return {
        id: plugin,
        label: matcherPluginDisplayName(plugin, pluginsList),
        points: row.points ?? [],
      };
    });
  }, [pluginsList, scopedMatcherRunsByPlugin]);

  const accountTodayMsg = scopedBotStatsRow
    ? `${scopedBotStatsRow.today_received ?? "—"} / ${scopedBotStatsRow.today_sent ?? "—"}`
    : "—";
  const accountTodayApi = (() => {
    const n = scopedBotStatsRow?.today_api_calls;
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return String(Math.floor(Number(n)));
  })();
  const accountMatcherRuns = (() => {
    const n = scopedPluginRunRow?.runs_today;
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return String(Math.floor(Number(n)));
  })();
  const accountMatcherErrors = (() => {
    const n = scopedPluginRunRow?.errors_today;
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return String(Math.floor(Number(n)));
  })();

  const rangeBusy = dailyRangeQ.isFetching;
  const refreshing = instQ.isFetching || pluginRunGlobalQ.isFetching || chartsBusy || rangeBusy;

  async function refreshAll() {
    await Promise.all([
      instQ.refetch(),
      pluginRunGlobalQ.refetch(),
      dailyRangeQ.refetch(),
      refreshChartStats(),
    ]);
  }

  function botLabel(account: number): string {
    const nick = instQ.data?.bot_profiles?.[String(account)]?.nickname?.trim() || "BOT";
    return `${nick} · ${account}`;
  }

  return (
    <div className="charts-page charts-page--dashboard">
      <PageMasthead
        className="charts-page__masthead"
        title="数据看板"
        description="流量与命令概览；趋势一张图，细节用排行与实时桶。"
      />

      {sortedBots.length ? (
        <ChromeTools>
          {sortedBots.length > 1 ? (
            <ChromeField label="账号" icon={Bot} className="shrink-0">
              <Select
                value={selectedAccount != null ? String(selectedAccount) : undefined}
                onValueChange={(v) => setSelectedAccount(Number(v) || null)}
              >
                <SelectTrigger
                  className={ACCOUNT_SEL}
                  aria-label="选择 Bot 账号"
                  title={selectedAccount != null ? botLabel(selectedAccount) : undefined}
                >
                  <SelectValue placeholder="选择账号" />
                </SelectTrigger>
                <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
                  {sortedBots.map((b) => (
                    <SelectItem key={b.account} value={String(b.account)}>
                      {botLabel(b.account)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChromeField>
          ) : null}
          <DateModeFilter
            size="toolbar"
            mode={dateMode}
            onModeChange={setDateMode}
            start={rangeStart}
            end={rangeEnd}
            onStartChange={setRangeStart}
            onEndChange={setRangeEnd}
          />
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <RefreshIconButton
              busy={refreshing}
              label="刷新"
              showLabel
              onClick={() => void refreshAll()}
            />
          </div>
        </ChromeTools>
      ) : null}

      {!sortedBots.length ? (
        <p className="muted charts-page__empty">数据库中暂无 Bot 配置。请先在「数据库实例」创建账号。</p>
      ) : null}

      {selectedAccount != null ? (
        <div className="charts-page__layout" aria-busy={refreshing || undefined}>
          <section className="charts-page__kpi home-kpi-bar" aria-label="今日与区间摘要">
            <MetricTile label="今日消息" value={accountTodayMsg} hint="收 / 发" />
            <MetricTile label="今日协议 API" value={accountTodayApi} hint="成功调用" />
            <MetricTile
              label="今日 Matcher"
              value={accountMatcherRuns}
              hint={`异常 ${accountMatcherErrors}`}
            />
            <MetricTile
              label="区间 Matcher"
              value={rangeCommandTotal.toLocaleString()}
              hint={`日均 ${Math.round(rangeCommandTotal / rangeDayCount).toLocaleString()}`}
            />
            <MetricTile
              label="区间协议 API"
              value={rangeApiTotal.toLocaleString()}
              hint={`日均 ${Math.round(rangeApiTotal / rangeDayCount).toLocaleString()}`}
            />
          </section>

          <section id="charts-trend" className="charts-page__section charts-page__section--hero">
            <Card className={cn(CHART_PANEL, "charts-page__panel--hero")}>
              <CardHeader className={CHART_PANEL_HD}>
                <CardTitle className="panel__title flex items-center gap-1.5">
                  <PanelTitleIcon icon={LineChart} />
                  区间趋势
                </CardTitle>
              </CardHeader>
              <CardContent className={CHART_PANEL_BD}>
                <p className="muted charts-page__section-lead">
                  按自然日汇总：左轴消息收发，右轴 Matcher 与协议 API。悬停查看每日明细。
                </p>
                <ChartsMonthlyCommandChart
                  rows={monthlyDailyRows}
                  busy={rangeBusy || chartsBusy}
                  emptyText="所选区间暂无持久化数据，请保持 Bot 运行并跨日写入。"
                />
              </CardContent>
            </Card>
          </section>

          <section id="charts-detail" className="charts-page__section charts-page__section--secondary">
            <div className="charts-page__board charts-page__board--cards">
              <Card className={cn(CHART_PANEL, "charts-page__panel--secondary")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={BarChart3} />
                    插件今日次数
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead">
                    今日 Matcher 调用排行（最多 12 个）。悬停查看名称与次数。
                  </p>
                  <ChartsDailyBarChart
                    points={topPluginBars}
                    unit="次"
                    accent={PLUGIN_TODAY_BAR_ACCENT}
                    emptyText={
                      chartsBusy
                        ? "加载中…"
                        : "暂无今日 Matcher 数据；进程运行一段时间后会出现。"
                    }
                  />
                </CardContent>
              </Card>

              <Card className={cn(CHART_PANEL, "charts-page__panel--secondary")}>
                <CardHeader className={CHART_PANEL_HD}>
                  <CardTitle className="panel__title flex items-center gap-1.5">
                    <PanelTitleIcon icon={Activity} />
                    Matcher · 按时间桶
                  </CardTitle>
                </CardHeader>
                <CardContent className={CHART_PANEL_BD}>
                  <p className="muted charts-page__section-lead">
                    进程内实时桶：Top 插件折线，悬停看各桶明细（与上方区间趋势同款呈现）。
                  </p>
                  <ChartsNamedSeriesTrend
                    series={matcherTrendSeries}
                    busy={chartsBusy}
                    chartUid="charts-matcher-bucket"
                    emptyText="暂无 Matcher 时序数据；需 Bot 运行并产生调用。"
                  />
                </CardContent>
              </Card>
            </div>
            {!chartsBusy && !scopedPluginPlugins.length ? (
              <p className="muted charts-page__board-note">
                插件排行与实时桶需进程运行一段时间后才有数据；区间趋势依赖按日落盘。
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
