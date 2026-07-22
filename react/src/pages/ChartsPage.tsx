import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  fetchConsoleDailyStats,
  fetchInstances,
  fetchPluginRunStats,
} from "@/api/fullConsole";
import type { BotConfigPublic, ConsoleDailyStatRow } from "@pallas-vue/api/pallasTypes";
import ChartsDailyBarChart from "@/components/ChartsDailyBarChart";
import ChartsMonthlyCommandChart from "@/components/ChartsMonthlyCommandChart";
import HomePluginRunCharts from "@/components/HomePluginRunCharts";
import IngressDispatchPanel from "@/components/IngressDispatchPanel";
import PageHeader from "@/components/PageHeader";
import Panel from "@/components/Panel";
import StatTrendCard from "@/components/StatTrendCard";
import { useAccountPluginCharts } from "@/hooks/useAccountPluginCharts";
import {
  currentMonthIso,
  fillDailyRows,
  monthBounds,
  readSavedHomeAccount,
  todayIso,
  writeSavedHomeAccount,
} from "@/utils/chartsPageHelpers";

export default function ChartsPage() {
  const [rangeStart, setRangeStart] = useState(() => monthBounds(currentMonthIso()).start);
  const [rangeEnd, setRangeEnd] = useState(todayIso);
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
    pluginRunTimeSamples,
    scopedPluginPlugins,
    scopedApiCallsByApi,
    scopedMatcherRunsByPlugin,
    scopedMatcherErrorsByPlugin,
    scopedMatcherAvgDurationByPlugin,
    scopedMatcherDurationMsByPlugin,
    scopedMatcherDurationLog,
    scopedMatcherErrorLog,
    scopedPluginRunRow,
    scopedBotStatsRow,
    pluginRunStatsScoped,
    consoleDailyStats,
    accountMessageStats,
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

  const rangeCommandPoints = useMemo(
    () => dailyRowsScoped.map((r) => ({ date: r.date, value: r.matcher_runs })),
    [dailyRowsScoped],
  );
  const rangeApiPoints = useMemo(
    () => dailyRowsScoped.map((r) => ({ date: r.date, value: r.api_calls ?? 0 })),
    [dailyRowsScoped],
  );

  const pluginRunMain = pluginRunStatsScoped ?? pluginRunGlobalQ.data;

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

  const msgSparkValues = useMemo((): number[] => {
    const intraday =
      scopedBotStatsRow?.message_traffic_history?.map((p) => p.received + p.sent) ?? [];
    if (intraday.length >= 2) return intraday;
    const rows = [...(consoleDailyStats?.rows ?? [])]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
    return rows.map((r) => r.received + r.sent);
  }, [consoleDailyStats?.rows, scopedBotStatsRow]);

  const apiSparkValues = useMemo((): number[] => {
    const api = scopedBotStatsRow?.api_calls_history?.map((p) => p.total) ?? [];
    return api.length >= 2 ? api : [];
  }, [scopedBotStatsRow]);

  const matcherSparkValues = useMemo((): number[] => {
    const series = scopedMatcherRunsByPlugin;
    if (!series.length) return [];
    const maxLen = Math.max(...series.map((s) => s.points.length));
    if (maxLen < 2) return [];
    const out = new Array<number>(maxLen).fill(0);
    for (const s of series) {
      for (let i = 0; i < s.points.length; i++) {
        out[i] += Number(s.points[i]?.total) || 0;
      }
    }
    return out;
  }, [scopedMatcherRunsByPlugin]);

  const rangeBusy = dailyRangeQ.isFetching;
  const refreshing = instQ.isFetching || pluginRunGlobalQ.isFetching || chartsBusy || rangeBusy;
  const commandTotal = rangeCommandPoints.reduce((s, p) => s + p.value, 0);
  const dashboardReady = !chartsBusy;

  async function refreshAll() {
    await Promise.all([
      instQ.refetch(),
      pluginRunGlobalQ.refetch(),
      dailyRangeQ.refetch(),
      refreshChartStats(),
    ]);
  }

  return (
    <div className="console-hub-page charts-page charts-page--dashboard">
      <PageHeader
        title="数据看板"
        description="流量编排、月度命令、API、LLM 与详细图表；悬停各图可查看明细。"
        className="charts-page__masthead"
        actions={
          <div className="charts-page__masthead-tools">
            {sortedBots.length > 1 ? (
              <label className="charts-page__account-label charts-page__account-label--masthead">
                <span className="charts-page__account-label-text">账号</span>
                <select
                  className="sel charts-page__account-sel"
                  aria-label="选择 Bot 账号"
                  value={selectedAccount ?? ""}
                  onChange={(e) => setSelectedAccount(Number(e.target.value) || null)}
                >
                  {sortedBots.map((b) => {
                    const nick = instQ.data?.bot_profiles?.[String(b.account)]?.nickname?.trim() || "BOT";
                    return (
                      <option key={b.account} value={b.account}>
                        {nick} · {b.account}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
            <button type="button" className="btn" disabled={refreshing} onClick={() => void refreshAll()}>
              <RefreshCw className={refreshing ? "animate-spin" : undefined} size={16} />
              刷新
            </button>
          </div>
        }
      />

      <div className="charts-page__ingress">
        <IngressDispatchPanel />
      </div>

      {sortedBots.length ? (
        <div className="charts-page__filter-toolbar">
          <div className="charts-page__filter-group">
            <label className="charts-page__date-label">
              <span className="charts-page__date-label-text">起始</span>
              <input
                className="charts-page__date-inp inp"
                type="date"
                aria-label="起始日期"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
            </label>
            <label className="charts-page__date-label">
              <span className="charts-page__date-label-text">结束</span>
              <input
                className="charts-page__date-inp inp"
                type="date"
                aria-label="结束日期"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </label>
          </div>
        </div>
      ) : (
        <p className="muted charts-page__empty">数据库中暂无 Bot 配置。请先在「数据库实例」创建账号。</p>
      )}

      {selectedAccount != null ? (
        <div className="charts-page__layout">
          <div className="charts-page__main" aria-busy={refreshing || undefined}>
            <section id="charts-monthly" className="charts-page__section">
              <Panel className="charts-page__panel" title="月度命令统计">
                <p className="muted charts-page__section-lead">
                  按自然日汇总（磁盘持久化）；左轴为发送/接收消息，右轴为 Matcher 与协议 API。鼠标悬停查看每日明细。
                </p>
                <ChartsMonthlyCommandChart
                  rows={monthlyDailyRows}
                  busy={rangeBusy || chartsBusy}
                  emptyText="所选区间暂无持久化数据，请保持 Bot 运行并跨日写入。"
                />
              </Panel>
            </section>

            <section id="charts-commands" className="charts-page__section">
              <Panel className="charts-page__panel" title="命令使用量">
                <ChartsDailyBarChart points={rangeCommandPoints} title="Matcher" unit="次" accent="#d946ef" />
                {rangeCommandPoints.length ? (
                  <dl className="home-dl charts-page__summary-dl">
                    <dt>区间合计</dt>
                    <dd>{commandTotal.toLocaleString()} 次</dd>
                    <dt>日均</dt>
                    <dd>
                      {Math.round(commandTotal / Math.max(1, rangeCommandPoints.length)).toLocaleString()} 次
                    </dd>
                  </dl>
                ) : null}
              </Panel>
            </section>

            <section id="charts-api" className="charts-page__section">
              <Panel className="charts-page__panel" title="API 使用量">
                <ChartsDailyBarChart
                  points={rangeApiPoints}
                  title="协议 API 调用"
                  unit="次"
                  accent="#38bdf8"
                  emptyText="所选区间暂无 API 按日落盘数据；新版起随 console_daily_stats 一并持久化。"
                />
                <p className="muted charts-page__section-note">
                  今日实时曲线见下方「详细图表」中的协议 API 桶图；此处为按自然日汇总。
                </p>
              </Panel>
            </section>

            <section id="charts-detail" className="charts-page__section charts-page__section--detail">
              <section className="charts-page__kpi">
                <StatTrendCard
                  dense
                  label="今日消息"
                  value={accountTodayMsg}
                  hint="收 / 发 · 当前账号"
                  sparkValues={msgSparkValues}
                  chartVariant="msg"
                />
                <StatTrendCard
                  dense
                  label="协议 API"
                  value={accountTodayApi}
                  hint="今日成功调用 · 当前账号"
                  sparkValues={apiSparkValues}
                  chartVariant="api"
                />
                <StatTrendCard
                  dense
                  label="Matcher"
                  value={accountMatcherRuns}
                  hint={`今日执行 · 异常 ${accountMatcherErrors}`}
                  sparkValues={matcherSparkValues}
                  chartVariant="matcher"
                />
              </section>

              <div className="charts-page__board">
                <HomePluginRunCharts
                  layoutMode="dashboard"
                  plugins={scopedPluginPlugins}
                  pluginsMeta={pluginsList}
                  series={pluginRunTimeSamples}
                  busy={chartsBusy}
                  apiHistoryByApi={scopedApiCallsByApi}
                  apiHistoryBucketSec={accountMessageStats?.api_calls_history_bucket_sec}
                  matcherRunsByPlugin={scopedMatcherRunsByPlugin}
                  matcherErrorsByPlugin={scopedMatcherErrorsByPlugin}
                  matcherAvgDurationMsByPlugin={scopedMatcherAvgDurationByPlugin}
                  matcherDurationMsByPlugin={scopedMatcherDurationMsByPlugin}
                  matcherDurationLog={scopedMatcherDurationLog}
                  matcherDurationLogCap={scopedPluginRunRow?.matcher_duration_log_cap ?? 150}
                  matcherDurationLogPerPluginCap={scopedPluginRunRow?.matcher_duration_log_per_plugin_cap ?? 30}
                  matcherHistoryBucketSec={pluginRunMain?.matcher_calls_history_bucket_sec}
                  matcherErrorsToday={scopedPluginRunRow?.errors_today ?? 0}
                  matcherErrorLog={scopedMatcherErrorLog}
                  dailyStatRows={consoleDailyStats?.rows ?? []}
                />
                {dashboardReady && !msgSparkValues.length && !apiSparkValues.length ? (
                  <p className="muted charts-page__board-note">
                    部分曲线需进程运行一段时间后才有时间桶数据；按日汇总图依赖历史落盘。
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
