import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchConsoleDailyStats,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  peekPluginsCache,
} from "@/api/fullConsole";
import type {
  ConsoleDailyStatsData,
  MessageStatsData,
  PluginRow,
  PluginRunStatsData,
} from "@pallas-vue/api/pallasTypes";
import type { PluginRunSample } from "@pallas-vue/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@pallas-vue/utils/pluginRunHistory";

export function useAccountPluginCharts(selectedAccount: number | null) {
  const [pluginsList, setPluginsList] = useState<PluginRow[]>(() => peekPluginsCache() ?? []);
  const [statsScoped, setStatsScoped] = useState<MessageStatsData | null>(null);
  const [pluginRunStatsScoped, setPluginRunStatsScoped] = useState<PluginRunStatsData | null>(null);
  const [consoleDailyStats, setConsoleDailyStats] = useState<ConsoleDailyStatsData | null>(null);
  const [chartsBusy, setChartsBusy] = useState(false);
  const [pluginRunTimeSamples, setPluginRunTimeSamples] = useState<PluginRunSample[]>([]);

  const accountMessageStats = statsScoped;

  const scopedBotStatsRow = useMemo(() => {
    if (selectedAccount == null || !statsScoped?.bots?.length) return null;
    const sid = String(selectedAccount);
    return statsScoped.bots.find((b) => b.self_id === sid) ?? null;
  }, [selectedAccount, statsScoped]);

  const scopedApiCallsByApi = scopedBotStatsRow?.api_calls_history_by_api ?? [];

  const scopedPluginRunRow = useMemo(() => {
    if (selectedAccount == null || !pluginRunStatsScoped?.bots?.length) return null;
    const sid = String(selectedAccount);
    return pluginRunStatsScoped.bots.find((b) => b.self_id === sid) ?? null;
  }, [selectedAccount, pluginRunStatsScoped]);

  const scopedPluginPlugins = scopedPluginRunRow?.plugins ?? [];
  const scopedMatcherRunsByPlugin = scopedPluginRunRow?.matcher_runs_by_plugin ?? [];
  const scopedMatcherErrorsByPlugin = scopedPluginRunRow?.matcher_errors_by_plugin ?? [];
  const scopedMatcherAvgDurationByPlugin = scopedPluginRunRow?.matcher_avg_duration_ms_by_plugin ?? [];
  const scopedMatcherDurationMsByPlugin = scopedPluginRunRow?.matcher_duration_ms_by_plugin ?? [];
  const scopedMatcherErrorLog = scopedPluginRunRow?.matcher_error_log ?? [];
  const scopedMatcherDurationLog = scopedPluginRunRow?.matcher_duration_log ?? [];

  const syncPluginRunSeriesFromStorage = useCallback(() => {
    setPluginRunTimeSamples(selectedAccount != null ? readPluginRunSeries(String(selectedAccount)) : []);
  }, [selectedAccount]);

  const refreshChartStats = useCallback(async () => {
    if (selectedAccount == null) {
      setStatsScoped(null);
      setPluginRunStatsScoped(null);
      setConsoleDailyStats(null);
      setPluginRunTimeSamples([]);
      return;
    }
    setChartsBusy(true);
    try {
      const settled = await Promise.allSettled([
        fetchMessageStats(selectedAccount),
        fetchPluginRunStats(selectedAccount),
        fetchConsoleDailyStats({ selfId: selectedAccount }),
      ]);
      function take<T>(i: number): T | null {
        const r = settled[i];
        return r.status === "fulfilled" ? (r.value as T) : null;
      }
      setStatsScoped(take<MessageStatsData>(0));
      setPluginRunStatsScoped(take<PluginRunStatsData>(1));
      setConsoleDailyStats(take<ConsoleDailyStatsData>(2));
      setPluginRunTimeSamples(readPluginRunSeries(String(selectedAccount)));
    } finally {
      setChartsBusy(false);
    }
  }, [selectedAccount]);

  const ensurePluginsList = useCallback(async () => {
    if (pluginsList.length) return;
    try {
      const rows = await fetchPlugins();
      setPluginsList(rows);
    } catch {
      /* ignore */
    }
  }, [pluginsList.length]);

  useEffect(() => {
    void refreshChartStats();
  }, [refreshChartStats]);

  useEffect(() => {
    if (chartsBusy || selectedAccount == null || !scopedPluginRunRow) return;
    pushPluginRunSample(String(selectedAccount), scopedPluginRunRow.runs_today, scopedPluginRunRow.plugins ?? []);
    syncPluginRunSeriesFromStorage();
  }, [chartsBusy, scopedPluginRunRow, selectedAccount, syncPluginRunSeriesFromStorage]);

  return {
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
  };
}
