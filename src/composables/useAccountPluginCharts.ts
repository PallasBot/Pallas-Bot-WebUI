import { computed, ref, watch } from "vue";
import {
  fetchConsoleDailyStats,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  peekPluginsCache,
} from "@/api/consoleApi";
import type {
  ConsoleDailyStatsData,
  MessageStatsData,
  PluginRow,
  PluginRunStatsData,
} from "@/api/pallasTypes";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@/utils/pluginRunHistory";

export const HOME_SELECTED_ACCOUNT_KEY = "pallas_home_selected_account_v1";

export function readSavedHomeAccount(): number | null {
  try {
    const v = localStorage.getItem(HOME_SELECTED_ACCOUNT_KEY);
    if (v == null || v === "") return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

export function writeSavedHomeAccount(acc: number | null) {
  try {
    if (acc == null) localStorage.removeItem(HOME_SELECTED_ACCOUNT_KEY);
    else localStorage.setItem(HOME_SELECTED_ACCOUNT_KEY, String(Math.floor(acc)));
  } catch {
    /* ignore */
  }
}

export function useAccountPluginCharts(selectedAccount: { value: number | null }) {
  const pluginsList = ref<PluginRow[]>([]);
  {
    const warm = peekPluginsCache();
    if (warm?.length) pluginsList.value = warm;
  }

  const statsScoped = ref<MessageStatsData | null>(null);
  const pluginRunStatsScoped = ref<PluginRunStatsData | null>(null);
  const consoleDailyStats = ref<ConsoleDailyStatsData | null>(null);
  const chartsBusy = ref(false);
  const pluginRunTimeSamples = ref<PluginRunSample[]>([]);

  const accountMessageStats = computed(() => statsScoped.value);

  const scopedBotStatsRow = computed(() => {
    const acc = selectedAccount.value;
    const st = accountMessageStats.value;
    if (acc == null || !st?.bots?.length) return null;
    const sid = String(acc);
    return st.bots.find((b) => b.self_id === sid) ?? null;
  });

  const scopedApiCallsByApi = computed(() => scopedBotStatsRow.value?.api_calls_history_by_api ?? []);

  const scopedPluginRunRow = computed(() => {
    const acc = selectedAccount.value;
    const pr = pluginRunStatsScoped.value;
    if (acc == null || !pr?.bots?.length) return null;
    const sid = String(acc);
    return pr.bots.find((b) => b.self_id === sid) ?? null;
  });

  const scopedPluginPlugins = computed(() => scopedPluginRunRow.value?.plugins ?? []);
  const scopedMatcherRunsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_runs_by_plugin ?? []);
  const scopedMatcherErrorsByPlugin = computed(
    () => scopedPluginRunRow.value?.matcher_errors_by_plugin ?? [],
  );
  const scopedMatcherAvgDurationByPlugin = computed(
    () => scopedPluginRunRow.value?.matcher_avg_duration_ms_by_plugin ?? [],
  );
  const scopedMatcherDurationMsByPlugin = computed(
    () => scopedPluginRunRow.value?.matcher_duration_ms_by_plugin ?? [],
  );
  const scopedMatcherErrorLog = computed(() => scopedPluginRunRow.value?.matcher_error_log ?? []);
  const scopedMatcherDurationLog = computed(() => scopedPluginRunRow.value?.matcher_duration_log ?? []);

  function syncPluginRunSeriesFromStorage() {
    const acc = selectedAccount.value;
    pluginRunTimeSamples.value = acc != null ? readPluginRunSeries(String(acc)) : [];
  }

  async function refreshChartStats() {
    const acc = selectedAccount.value;
    if (acc == null) {
      statsScoped.value = null;
      pluginRunStatsScoped.value = null;
      consoleDailyStats.value = null;
      pluginRunTimeSamples.value = [];
      return;
    }
    chartsBusy.value = true;
    try {
      const settled = await Promise.allSettled([
        fetchMessageStats(acc),
        fetchPluginRunStats(acc),
        fetchConsoleDailyStats({ selfId: acc }),
      ]);
      function take<T>(i: number): T | null {
        const r = settled[i];
        return r.status === "fulfilled" ? (r.value as T) : null;
      }
      statsScoped.value = take<MessageStatsData>(0);
      pluginRunStatsScoped.value = take<PluginRunStatsData>(1);
      consoleDailyStats.value = take<ConsoleDailyStatsData>(2);
      syncPluginRunSeriesFromStorage();
    } finally {
      chartsBusy.value = false;
    }
  }

  async function ensurePluginsList() {
    if (pluginsList.value.length) return;
    try {
      pluginsList.value = await fetchPlugins();
    } catch {
      /* ignore */
    }
  }

  watch(
    () => selectedAccount.value,
    () => {
      void refreshChartStats();
    },
  );

  watch([scopedPluginRunRow, () => selectedAccount.value, chartsBusy], ([row, acc, busy]) => {
    if (busy || acc == null || !row) return;
    pushPluginRunSample(String(acc), row.runs_today, row.plugins ?? []);
    syncPluginRunSeriesFromStorage();
  });

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
    syncPluginRunSeriesFromStorage,
  };
}
