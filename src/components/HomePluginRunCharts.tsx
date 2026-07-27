import { useEffect, useMemo, useState } from "react";
import type {
  ApiCallNamedSeries,
  ConsoleDailyStatRow,
  MatcherDurationLogEntry,
  MatcherErrorLogEntry,
  PluginMatcherNamedSeries,
  PluginRow,
  PluginRunStatsRow,
} from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { matcherPluginDisplayName } from "@/utils/pluginDisplayLabel";
import GsDualAxisTrendChart from "@/components/GsDualAxisTrendChart";
import HomeBucketChartSvg from "@/components/HomeBucketChartSvg";
import HomeHourlyChartSvg from "@/components/HomeHourlyChartSvg";
import "@/styles/home-plugin-charts.css";
import "@/styles/home-bucket-chart.css";
import "@/styles/home-hourly-chart.css";
import { ConsoleBlockSkeleton } from "@/components/ConsolePageSkeleton";
import {
  aggregateLocalToday,
  buildBucketBarPack,
  buildHourlyChartPack,
  defaultTopKeys,
  fmtDurationMs,
  rankBarWidthPercent,
} from "@/utils/homePluginChartPack";

export type ChartPanelId =
  | "daily_msg_matcher"
  | "api_bucket"
  | "matcher_bucket"
  | "plugins_top"
  | "matcher_duration_hourly"
  | "matcher_err_bucket";

const PANEL_LABELS: Record<ChartPanelId, string> = {
  daily_msg_matcher: "消息 / Matcher（按日）",
  api_bucket: "协议 API · 按时间桶",
  matcher_bucket: "Matcher · 按时间桶",
  plugins_top: "插件今日次数",
  matcher_duration_hourly: "Matcher 耗时 · 今日各小时",
  matcher_err_bucket: "Matcher 异常 · 按时间桶",
};

const DEFAULT_DASHBOARD_PANELS: ChartPanelId[] = [
  "daily_msg_matcher",
  "api_bucket",
  "matcher_bucket",
  "plugins_top",
  "matcher_duration_hourly",
  "matcher_err_bucket",
];

const DASHBOARD_PANEL_SPAN2 = new Set<ChartPanelId>(["daily_msg_matcher", "matcher_duration_hourly"]);

type Props = {
  layoutMode?: "single" | "dashboard";
  dashboardPanels?: ChartPanelId[];
  plugins: PluginRunStatsRow[];
  pluginsMeta?: PluginRow[] | null;
  series: PluginRunSample[];
  busy: boolean;
  apiHistoryByApi?: ApiCallNamedSeries[];
  apiHistoryBucketSec?: number;
  matcherRunsByPlugin?: PluginMatcherNamedSeries[];
  matcherErrorsByPlugin?: PluginMatcherNamedSeries[];
  matcherAvgDurationMsByPlugin?: PluginMatcherNamedSeries[];
  matcherDurationMsByPlugin?: PluginMatcherNamedSeries[];
  matcherDurationLog?: MatcherDurationLogEntry[];
  matcherDurationLogCap?: number;
  matcherDurationLogPerPluginCap?: number;
  matcherHistoryBucketSec?: number;
  matcherErrorsToday?: number;
  matcherErrorLog?: MatcherErrorLogEntry[];
  dailyStatRows?: ConsoleDailyStatRow[] | null;
};

function pluginBarLabel(name: string, meta?: PluginRow[] | null): string {
  return matcherPluginDisplayName(name, meta ?? undefined);
}

export default function HomePluginRunCharts({
  layoutMode = "dashboard",
  dashboardPanels,
  plugins,
  pluginsMeta,
  busy,
  apiHistoryByApi = [],
  matcherRunsByPlugin = [],
  matcherErrorsByPlugin = [],
  matcherDurationMsByPlugin = [],
  dailyStatRows = [],
}: Props) {
  const isDashboard = layoutMode === "dashboard";
  const effectivePanels = dashboardPanels?.length ? dashboardPanels : DEFAULT_DASHBOARD_PANELS;
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    function refresh() {
      setNarrow(window.matchMedia("(max-width: 560px)").matches);
    }
    refresh();
    window.addEventListener("resize", refresh, { passive: true });
    return () => window.removeEventListener("resize", refresh);
  }, []);

  const selectedApiKeys = useMemo(() => {
    const keys = apiHistoryByApi.filter((s) => (s.points?.length ?? 0) > 0).map((s) => s.api);
    return keys.length ? defaultTopKeys(keys, (k) => apiHistoryByApi.find((r) => r.api === k)?.points ?? [], 6) : [];
  }, [apiHistoryByApi]);

  const selectedMatcherKeys = useMemo(() => {
    const keys = matcherRunsByPlugin.filter((s) => (s.points?.length ?? 0) > 0).map((s) => s.plugin);
    return keys.length ? defaultTopKeys(keys, (k) => matcherRunsByPlugin.find((r) => r.plugin === k)?.points ?? [], 6) : [];
  }, [matcherRunsByPlugin]);

  const selectedMatcherErrKeys = useMemo(() => {
    const keys = matcherErrorsByPlugin.filter((s) => (s.points?.length ?? 0) > 0).map((s) => s.plugin);
    return keys.length ? defaultTopKeys(keys, (k) => matcherErrorsByPlugin.find((r) => r.plugin === k)?.points ?? [], 4) : [];
  }, [matcherErrorsByPlugin]);

  const topPlugins = useMemo(
    () =>
      [...plugins]
        .filter((p) => p.runs_today > 0)
        .sort((a, b) => b.runs_today - a.runs_today || a.name.localeCompare(b.name)),
    [plugins],
  );

  const maxRunsToday = Math.max(1, ...topPlugins.map((p) => p.runs_today));

  const apiBucketPack = useMemo(() => {
    const rows = apiHistoryByApi
      .filter((s) => selectedApiKeys.includes(s.api) && (s.points?.length ?? 0) > 0)
      .map((s) => ({ label: s.api, points: s.points }));
    return buildBucketBarPack(rows, narrow);
  }, [apiHistoryByApi, narrow, selectedApiKeys]);

  const matcherBucketPack = useMemo(() => {
    const rows = matcherRunsByPlugin
      .filter((s) => selectedMatcherKeys.includes(s.plugin) && (s.points?.length ?? 0) > 0)
      .map((s) => ({
        label: pluginBarLabel(s.plugin, pluginsMeta),
        points: s.points,
      }));
    return buildBucketBarPack(rows, narrow);
  }, [matcherRunsByPlugin, narrow, pluginsMeta, selectedMatcherKeys]);

  const matcherErrBucketPack = useMemo(() => {
    const rows = matcherErrorsByPlugin
      .filter((s) => selectedMatcherErrKeys.includes(s.plugin) && (s.points?.length ?? 0) > 0)
      .map((s) => ({
        label: pluginBarLabel(s.plugin, pluginsMeta),
        points: s.points,
      }));
    return buildBucketBarPack(rows, narrow);
  }, [matcherErrorsByPlugin, narrow, pluginsMeta, selectedMatcherErrKeys]);

  const hourlyMatcherDurationPack = useMemo(() => {
    const rows = matcherDurationMsByPlugin
      .filter((s) => (s.points?.length ?? 0) > 0)
      .slice(0, 4)
      .map((s) => ({
        label: pluginBarLabel(s.plugin, pluginsMeta),
        hours: aggregateLocalToday(s.points),
      }));
    return buildHourlyChartPack(rows);
  }, [matcherDurationMsByPlugin, pluginsMeta]);

  const panelAvailable: Record<ChartPanelId, boolean> = {
    daily_msg_matcher: (dailyStatRows?.length ?? 0) >= 1,
    api_bucket: apiHistoryByApi.some((s) => (s.points?.length ?? 0) > 0),
    matcher_bucket: matcherRunsByPlugin.some((s) => (s.points?.length ?? 0) > 0),
    plugins_top: topPlugins.length > 0,
    matcher_duration_hourly: matcherDurationMsByPlugin.some((s) => (s.points?.length ?? 0) > 0),
    matcher_err_bucket: matcherErrorsByPlugin.some((s) => (s.points?.length ?? 0) > 0),
  };

  function dashboardCellClass(id: ChartPanelId): string {
    const parts = ["home-plugin-charts__block"];
    if (isDashboard) {
      parts.push("home-plugin-charts-dashboard__cell");
      if (DASHBOARD_PANEL_SPAN2.has(id)) parts.push("home-plugin-charts-dashboard__cell--span-2");
    }
    return parts.join(" ");
  }

  function renderPanel(id: ChartPanelId) {
    if (!effectivePanels.includes(id) || !panelAvailable[id]) return null;

    if (id === "plugins_top") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          {busy && !topPlugins.length ? (
            <ConsoleBlockSkeleton lines={4} label="插件图表加载中" className="home-plugin-charts__empty" />
          ) : !topPlugins.length ? (
            <p className="muted home-plugin-charts__empty">暂无今日 Matcher 数据。</p>
          ) : (
            <div className="home-plugin-bars home-plugin-bars--fill home-plugin-bars--plugin-rank home-plugin-charts__viz">
              {topPlugins.slice(0, 12).map((p) => {
                const label = pluginBarLabel(p.name, pluginsMeta);
                return (
                  <div key={p.name} className="home-plugin-bars__row home-plugin-bars__row--plugin-rank">
                    <span className="home-plugin-bars__name" title={label}>
                      {label}
                    </span>
                    <div className="home-plugin-bars__track">
                      <span
                        className="home-plugin-bars__fill home-plugin-bars__fill--runs"
                        style={{ width: `${rankBarWidthPercent(p.runs_today, maxRunsToday)}%` }}
                      />
                    </div>
                    <span className="home-plugin-bars__val home-plugin-bars__val--stack">
                      <span className="home-plugin-bars__val-line">今日 {p.runs_today} 次</span>
                      {p.avg_duration_ms_today != null ? (
                        <span className="home-plugin-bars__val-line muted">
                          均 {fmtDurationMs(p.avg_duration_ms_today)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (id === "daily_msg_matcher") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          <GsDualAxisTrendChart
            className="home-plugin-charts__viz"
            chartUid="home-daily-msg"
            rows={dailyStatRows ?? []}
            busy={busy}
            emptyText="暂无按日持久化数据。请保持 Bot 运行，跨自然日后会自动写入。"
            showSummary={false}
          />
        </div>
      );
    }

    if (id === "api_bucket") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          {apiBucketPack ? (
            <div className="home-plugin-multi home-plugin-charts__viz">
              <HomeBucketChartSvg pack={apiBucketPack} />
              <div className="home-plugin-legend">
                {apiBucketPack.series.map((s, idx) => (
                  <span key={idx} className="home-plugin-legend__item">
                    <i className="home-plugin-legend__sw" style={{ background: s.color }} />
                    <span title={s.label}>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted home-plugin-charts__empty">暂无协议 API 时序数据。</p>
          )}
        </div>
      );
    }

    if (id === "matcher_bucket") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          {matcherBucketPack ? (
            <div className="home-plugin-multi home-plugin-charts__viz">
              <HomeBucketChartSvg pack={matcherBucketPack} />
              <div className="home-plugin-legend">
                {matcherBucketPack.series.map((s, idx) => (
                  <span key={idx} className="home-plugin-legend__item">
                    <i className="home-plugin-legend__sw" style={{ background: s.color }} />
                    <span title={s.label}>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted home-plugin-charts__empty">暂无 Matcher 时序数据。</p>
          )}
        </div>
      );
    }

    if (id === "matcher_duration_hourly") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          {hourlyMatcherDurationPack ? (
            <div className="home-plugin-multi home-plugin-charts__viz">
              <HomeHourlyChartSvg pack={hourlyMatcherDurationPack} />
              <div className="home-plugin-legend">
                {hourlyMatcherDurationPack.layers.map((ly, idx) => (
                  <span key={idx} className="home-plugin-legend__item">
                    <i className="home-plugin-legend__sw" style={{ background: ly.color }} />
                    <span title={ly.label}>{ly.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted home-plugin-charts__empty">暂无 Matcher 耗时时序数据。</p>
          )}
        </div>
      );
    }

    if (id === "matcher_err_bucket") {
      return (
        <div key={id} className={dashboardCellClass(id)} data-panel={id}>
          {isDashboard ? <h3 className="home-plugin-charts-dashboard__title">{PANEL_LABELS[id]}</h3> : null}
          {matcherErrBucketPack ? (
            <div className="home-plugin-multi home-plugin-charts__viz">
              <HomeBucketChartSvg pack={matcherErrBucketPack} />
              <div className="home-plugin-legend">
                {matcherErrBucketPack.series.map((s, idx) => (
                  <span key={idx} className="home-plugin-legend__item">
                    <i className="home-plugin-legend__sw" style={{ background: s.color }} />
                    <span title={s.label}>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="muted home-plugin-charts__empty">暂无 Matcher 异常时序数据。</p>
          )}
        </div>
      );
    }

    return null;
  }

  if (!isDashboard) {
    return <div className="home-plugin-charts muted">单图模式暂未在 React 版实现。</div>;
  }

  return (
    <div className="home-plugin-charts home-plugin-charts--dashboard">
      <div className="home-plugin-charts-dashboard">
        {effectivePanels.map((id) => renderPanel(id))}
      </div>
    </div>
  );
}
