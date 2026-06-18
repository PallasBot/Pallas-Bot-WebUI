<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, onMounted, ref, watch } from "vue";
import { fetchConsoleDailyStats, fetchInstances, fetchLlmTaskStats, fetchPluginRunStats } from "@/api/consoleApi";
import type {
  BotConfigPublic,
  ConsoleDailyStatRow,
  ConsoleDailyStatsData,
  InstancesData,
  LlmTaskMetricRow,
  LlmTaskStatsData,
} from "@/api/pallasTypes";
import ChartsDailyBarChart from "@/components/ChartsDailyBarChart.vue";
import ChartsMonthlyCommandChart from "@/components/ChartsMonthlyCommandChart.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import IngressDispatchPanel from "@/components/IngressDispatchPanel.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import HomePluginRunCharts from "@/components/HomePluginRunCharts.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import StatTrendCard from "@/components/StatTrendCard.vue";
import UiCard from "@/components/ui/UiCard.vue";
import {
  readSavedHomeAccount,
  useAccountPluginCharts,
  writeSavedHomeAccount,
} from "@/composables/useAccountPluginCharts";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const pageReady = ref(false);
const err = ref("");
const instances = ref<InstancesData | null>(null);
const llmTaskStats = ref<LlmTaskStatsData | null>(null);
const dailyStatsRange = ref<ConsoleDailyStatsData | null>(null);
const rangeBusy = ref(false);

const selectedAccount = ref<number | null>(readSavedHomeAccount());
const pluginRunGlobal = ref<Awaited<ReturnType<typeof fetchPluginRunStats>> | null>(null);

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

const selectedMonth = ref(currentMonthIso());
const rangeStart = ref("");
const rangeEnd = ref(todayIso());

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

function dbNick(account: number): string {
  return instances.value?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
}

const sortedBots = computed(() => {
  const rows = [...(instances.value?.db_bot_configs ?? [])];
  rows.sort((a, b) => {
    const na = dbNick(a.account).toLowerCase();
    const nb = dbNick(b.account).toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return a.account - b.account;
  });
  return rows;
});

function botLabel(row: BotConfigPublic): string {
  return dbNick(row.account) || "BOT";
}

function ensureSelectedBot() {
  const rows = sortedBots.value;
  if (!rows.length) {
    selectedAccount.value = null;
    return;
  }
  const cur = selectedAccount.value;
  if (cur != null && rows.some((r) => r.account === cur)) return;
  selectedAccount.value = rows[0]?.account ?? null;
}

watch(selectedAccount, (acc) => {
  writeSavedHomeAccount(acc);
});

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

function daysInMonth(month: string): string[] {
  const { start, end } = monthBounds(month);
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  while (cur <= endD) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const queryRange = computed((): { start: string; end: string } => {
  const month = monthBounds(selectedMonth.value);
  const start = rangeStart.value || month.start;
  const end = rangeEnd.value || todayIso();
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  const mergedStart = lo < month.start ? lo : month.start;
  const mergedEnd = hi > month.end ? hi : month.end;
  return { start: mergedStart, end: mergedEnd };
});

const dailyRowsScoped = computed((): ConsoleDailyStatRow[] => {
  const src = dailyStatsRange.value?.rows ?? consoleDailyStats.value?.rows ?? [];
  return [...src].sort((a, b) => a.date.localeCompare(b.date));
});

const dailyByDate = computed(() => {
  const map = new Map<string, ConsoleDailyStatRow>();
  for (const row of dailyRowsScoped.value) {
    map.set(row.date, row);
  }
  return map;
});

const monthlyDailyRows = computed((): ConsoleDailyStatRow[] => {
  const days = daysInMonth(selectedMonth.value);
  const selfId = selectedAccount.value != null ? String(selectedAccount.value) : "";
  return days.map((date) => {
    const row = dailyByDate.value.get(date);
    if (row) return row;
    return {
      date,
      self_id: selfId,
      received: 0,
      sent: 0,
      matcher_runs: 0,
      api_calls: 0,
    };
  });
});

const rangeCommandPoints = computed(() =>
  dailyRowsScoped.value.map((r) => ({
    date: r.date,
    value: r.matcher_runs,
  })),
);

const rangeApiPoints = computed(() =>
  dailyRowsScoped.value.map((r) => ({
    date: r.date,
    value: r.api_calls ?? 0,
  })),
);

const pluginRunMain = computed(() => pluginRunStatsScoped.value ?? pluginRunGlobal.value);

const accountTodayMsg = computed(() => {
  const b = scopedBotStatsRow.value;
  if (!b) return "—";
  return `${b.today_received ?? "—"} / ${b.today_sent ?? "—"}`;
});

const accountTodayApi = computed(() => {
  const n = scopedBotStatsRow.value?.today_api_calls;
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return String(Math.floor(Number(n)));
});

const accountMatcherRuns = computed(() => {
  const n = scopedPluginRunRow.value?.runs_today;
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return String(Math.floor(Number(n)));
});

const accountMatcherErrors = computed(() => {
  const n = scopedPluginRunRow.value?.errors_today;
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return String(Math.floor(Number(n)));
});

const msgSparkValues = computed((): number[] => {
  const intraday =
    scopedBotStatsRow.value?.message_traffic_history?.map((p) => p.received + p.sent) ?? [];
  if (intraday.length >= 2) return intraday;
  const rows = [...(consoleDailyStats.value?.rows ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  return rows.map((r) => r.received + r.sent);
});

const apiSparkValues = computed((): number[] => {
  const api = scopedBotStatsRow.value?.api_calls_history?.map((p) => p.total) ?? [];
  return api.length >= 2 ? api : [];
});

const matcherSparkValues = computed((): number[] => {
  const series = scopedMatcherRunsByPlugin.value;
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
});

function llmMetricSum(
  slice: LlmTaskStatsData["bot"] | LlmTaskStatsData["ai"] | undefined,
  key: keyof LlmTaskMetricRow,
): number {
  if (!slice?.by_task) return 0;
  let sum = 0;
  for (const row of Object.values(slice.by_task)) {
    sum += Number(row[key]) || 0;
  }
  return sum;
}


const llmHistoryBotPoints = computed(() => {
  const rows = llmTaskStats.value?.history?.rows ?? [];
  return rows.map((r) => {
    const by = r.bot?.by_task;
    let sum = 0;
    if (by) {
      for (const row of Object.values(by)) {
        sum += (row.submit_ok ?? 0) + (row.callback_ok ?? 0);
      }
    }
    return { date: r.date, value: sum };
  });
});

const llmHistoryAiPoints = computed(() => {
  const rows = llmTaskStats.value?.history?.rows ?? [];
  return rows.map((r) => {
    const by = r.ai?.by_task;
    let sum = 0;
    if (by) {
      for (const row of Object.values(by)) {
        sum += row.task_ok ?? 0;
      }
    }
    return { date: r.date, value: sum };
  });
});

const llmPersistenceHint = computed(() => {
  const p = llmTaskStats.value?.persistence;
  if (!p) return "持久化状态未知";
  const parts: string[] = [];
  parts.push(p.bot_collecting ? "Bot 侧正在采集" : "Bot 侧暂无任务计数");
  if (p.ai_reachable) {
    parts.push(p.ai_collecting ? "AI 侧正在采集" : "AI 侧暂无任务计数");
  } else {
    parts.push("AI 侧不可达");
  }
  parts.push(`落盘 ${p.store_file || "llm_daily_stats.json"}`);
  return parts.join(" · ");
});

const dashboardReady = computed(() => pageReady.value && !chartsBusy.value);

async function loadDailyRange() {
  const acc = selectedAccount.value;
  if (acc == null) {
    dailyStatsRange.value = null;
    return;
  }
  const { start, end } = queryRange.value;
  rangeBusy.value = true;
  try {
    dailyStatsRange.value = await fetchConsoleDailyStats({ selfId: acc, start, end });
  } catch {
    dailyStatsRange.value = null;
  } finally {
    rangeBusy.value = false;
  }
}

async function loadLlmStats() {
  const { start, end } = queryRange.value;
  try {
    llmTaskStats.value = await fetchLlmTaskStats({ start, end });
  } catch {
    llmTaskStats.value = null;
  }
}

async function loadRangeData() {
  await Promise.all([loadDailyRange(), loadLlmStats()]);
}

async function load() {
  err.value = "";
  try {
    instances.value = await fetchInstances();
    ensureSelectedBot();
    await ensurePluginsList();
    try {
      pluginRunGlobal.value = await fetchPluginRunStats();
    } catch {
      pluginRunGlobal.value = null;
    }
    await refreshChartStats();
    await loadRangeData();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
}

async function refreshAll() {
  await refreshChartStats();
  await loadRangeData();
}

watch([selectedAccount, selectedMonth, rangeStart, rangeEnd], () => {
  if (!pageReady.value) return;
  void loadRangeData();
});

onMounted(() => {
  const bounds = monthBounds(selectedMonth.value);
  rangeStart.value = bounds.start;
  rangeEnd.value = bounds.end;
  void load();
});
</script>

<template>
  <div class="console-hub-page charts-page charts-page--dashboard">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="3"
    />

    <template v-else>
      <ConsoleHubMasthead
        :icon="panelNavIcon"
        class="charts-page__masthead"
      >
        <template #title>
          数据看板
        </template>
        <template #lead>
          流量编排、月度命令、API、LLM 与详细图表；悬停各图可查看明细。
        </template>
        <template #actions>
          <div class="charts-page__masthead-tools">
            <label
              v-if="sortedBots.length > 1"
              class="charts-page__account-label charts-page__account-label--masthead"
            >
              <span class="charts-page__account-label-text">账号</span>
              <select
                v-model.number="selectedAccount"
                class="sel charts-page__account-sel"
                aria-label="选择 Bot 账号"
              >
                <option
                  v-for="b in sortedBots"
                  :key="b.account"
                  :value="b.account"
                >
                  {{ botLabel(b) }} · {{ b.account }}
                </option>
              </select>
            </label>
            <RefreshIconButton
              :show-label="true"
              :busy="chartsBusy || rangeBusy"
              label="刷新"
              @click="refreshAll"
            />
          </div>
        </template>
      </ConsoleHubMasthead>

      <IngressDispatchPanel class="charts-page__ingress" />

      <div
        v-if="sortedBots.length"
        class="charts-page__filter-toolbar"
      >
        <div class="charts-page__filter-group">
          <label class="charts-page__date-label">
            <span class="charts-page__date-label-text">月份</span>
            <input
              v-model="selectedMonth"
              class="inp charts-page__month-inp"
              type="month"
              aria-label="选择月份"
            >
          </label>
          <label class="charts-page__date-label">
            <span class="charts-page__date-label-text">起始</span>
            <input
              v-model="rangeStart"
              class="inp charts-page__date-inp"
              type="date"
              aria-label="起始日期"
            >
          </label>
          <label class="charts-page__date-label">
            <span class="charts-page__date-label-text">结束</span>
            <input
              v-model="rangeEnd"
              class="inp charts-page__date-inp"
              type="date"
              aria-label="结束日期"
            >
          </label>
        </div>
      </div>

      <p
        v-if="!sortedBots.length"
        class="muted charts-page__empty"
      >
        数据库中暂无 Bot 配置。请先在「数据库实例」创建账号。
      </p>

      <div
        v-else-if="selectedAccount != null"
        class="charts-page__layout"
      >
        <div
          class="charts-page__main"
          :aria-busy="rangeBusy || chartsBusy || undefined"
        >
          <section
            id="charts-monthly"
            class="charts-page__section"
          >
            <UiCard
              tag="div"
              glass
              class="charts-page__panel"
            >
              <div class="panel__hd">
                <h2 class="panel__title">
                  <ConsoleNavIcon
                    class="panel__title-ico"
                    name="charts"
                  />月度命令统计
                </h2>
              </div>
              <div class="panel__bd">
                <p class="muted charts-page__section-lead">
                  按自然日汇总（磁盘持久化）；左轴为发送/接收消息，右轴为 Matcher 与协议 API。鼠标悬停查看每日明细，与 GS 控制台同款交互折线。
                </p>
                <ChartsMonthlyCommandChart
                  :rows="monthlyDailyRows"
                  :busy="rangeBusy || chartsBusy"
                  :empty-text="`「${selectedMonth}」暂无持久化数据，请保持 Bot 运行并跨日写入。`"
                />
              </div>
            </UiCard>
          </section>

          <section
            id="charts-commands"
            class="charts-page__section"
          >
            <UiCard
              tag="div"
              glass
              class="charts-page__panel"
            >
              <div class="panel__hd">
                <h2 class="panel__title">
                  <ConsoleNavIcon
                    class="panel__title-ico"
                    name="terminal"
                  />命令使用量
                </h2>
              </div>
              <div class="panel__bd">
                <ChartsDailyBarChart
                  :points="rangeCommandPoints"
                  title="Matcher 执行"
                  unit="次"
                  accent="#d946ef"
                />
                <dl
                  v-if="rangeCommandPoints.length"
                  class="home-dl charts-page__summary-dl"
                >
                  <dt>区间合计</dt>
                  <dd>{{ rangeCommandPoints.reduce((s, p) => s + p.value, 0).toLocaleString() }} 次</dd>
                  <dt>日均</dt>
                  <dd>{{
                    Math.round(
                      rangeCommandPoints.reduce((s, p) => s + p.value, 0) / Math.max(1, rangeCommandPoints.length),
                    ).toLocaleString()
                  }} 次</dd>
                </dl>
              </div>
            </UiCard>
          </section>

          <section
            id="charts-api"
            class="charts-page__section"
          >
            <UiCard
              tag="div"
              glass
              class="charts-page__panel"
            >
              <div class="panel__hd">
                <h2 class="panel__title">
                  <ConsoleNavIcon
                    class="panel__title-ico"
                    name="swap"
                  />API 使用量
                </h2>
              </div>
              <div class="panel__bd">
                <ChartsDailyBarChart
                  :points="rangeApiPoints"
                  title="协议 API 调用"
                  unit="次"
                  accent="#38bdf8"
                  empty-text="所选区间暂无 API 按日落盘数据；新版起随 console_daily_stats 一并持久化。"
                />
                <p class="muted charts-page__section-note">
                  今日实时曲线见下方「详细图表」中的协议 API 桶图；此处为按自然日汇总。
                </p>
              </div>
            </UiCard>
          </section>

          <section
            id="charts-llm"
            class="charts-page__section charts-page__section--llm"
          >
            <UiCard
              tag="div"
              glass
              class="charts-page__panel"
            >
              <div class="panel__hd panel__hd--split">
                <h2 class="panel__title">
                  <ConsoleNavIcon
                    class="panel__title-ico"
                    name="sparkles"
                  />LLM 统计
                </h2>
                <div class="charts-page__llm-kpis">
                  <div class="charts-page__llm-kpi">
                    <span class="charts-page__llm-kpi-label">Bot</span>
                    <span class="charts-page__llm-kpi-val">{{ llmMetricSum(llmTaskStats?.bot, 'submit_ok') }}</span>
                    <span class="charts-page__llm-kpi-sep">/</span>
                    <span class="charts-page__llm-kpi-val charts-page__llm-kpi-val--sec">{{ llmMetricSum(llmTaskStats?.bot, 'callback_ok') }}</span>
                    <span class="charts-page__llm-kpi-hint">{{ llmTaskStats?.bot?.day_key ? `本日 ${llmTaskStats.bot.day_key}` : '' }}</span>
                  </div>
                  <div class="charts-page__llm-kpi">
                    <span class="charts-page__llm-kpi-label">AI</span>
                    <template v-if="llmTaskStats && !llmTaskStats.ai_reachable">
                      <span class="charts-page__llm-kpi-err">不可达</span>
                    </template>
                    <template v-else>
                      <span class="charts-page__llm-kpi-val">{{ llmMetricSum(llmTaskStats?.ai, 'task_ok') }}</span>
                      <span class="charts-page__llm-kpi-sep">/</span>
                      <span class="charts-page__llm-kpi-val charts-page__llm-kpi-val--sec">{{ llmMetricSum(llmTaskStats?.ai, 'task_fail') }}</span>
                      <span class="charts-page__llm-kpi-hint">{{ llmTaskStats?.ai?.day_key ? `本日 ${llmTaskStats.ai.day_key}` : '' }}</span>
                    </template>
                  </div>
                </div>
              </div>
              <div class="panel__bd">
                <p class="muted charts-page__section-lead">
                  {{ llmPersistenceHint }}
                </p>
                <ChartsDailyBarChart
                  :points="llmHistoryBotPoints"
                  title="Bot 提交+回调"
                  unit="次"
                  accent="#a78bfa"
                />
                <ChartsDailyBarChart
                  :points="llmHistoryAiPoints"
                  title="AI 任务成功"
                  unit="次"
                  accent="#22d3ee"
                  :empty-text="llmTaskStats?.ai_reachable ? '所选区间暂无 AI 历史快照' : 'AI 不可达，无法采集 AI 侧统计'"
                />
              </div>
            </UiCard>
          </section>

          <section
            id="charts-detail"
            class="charts-page__section charts-page__section--detail"
          >
            <section class="charts-page__kpi">
              <StatTrendCard
                dense
                label="今日消息"
                :value="accountTodayMsg"
                hint="收 / 发 · 当前账号"
                :spark-values="msgSparkValues"
                chart-variant="msg"
              />
              <StatTrendCard
                dense
                label="协议 API"
                :value="accountTodayApi"
                hint="今日成功调用 · 当前账号"
                :spark-values="apiSparkValues"
                chart-variant="api"
              />
              <StatTrendCard
                dense
                label="Matcher"
                :value="accountMatcherRuns"
                :hint="`今日执行 · 异常 ${accountMatcherErrors}`"
                :spark-values="matcherSparkValues"
                chart-variant="matcher"
              />
            </section>
            <div class="charts-page__board">
              <HomePluginRunCharts
                layout-mode="dashboard"
                :plugins="scopedPluginPlugins"
                :plugins-meta="pluginsList"
                :series="pluginRunTimeSamples"
                :busy="chartsBusy"
                :api-history-by-api="scopedApiCallsByApi"
                :api-history-bucket-sec="accountMessageStats?.api_calls_history_bucket_sec"
                :matcher-runs-by-plugin="scopedMatcherRunsByPlugin"
                :matcher-errors-by-plugin="scopedMatcherErrorsByPlugin"
                :matcher-avg-duration-ms-by-plugin="scopedMatcherAvgDurationByPlugin"
                :matcher-duration-ms-by-plugin="scopedMatcherDurationMsByPlugin"
                :matcher-duration-log="scopedMatcherDurationLog"
                :matcher-duration-log-cap="scopedPluginRunRow?.matcher_duration_log_cap ?? 150"
                :matcher-duration-log-per-plugin-cap="scopedPluginRunRow?.matcher_duration_log_per_plugin_cap ?? 30"
                :matcher-history-bucket-sec="pluginRunMain?.matcher_calls_history_bucket_sec"
                :matcher-errors-today="scopedPluginRunRow?.errors_today ?? 0"
                :matcher-error-log="scopedMatcherErrorLog"
                :daily-stat-rows="consoleDailyStats?.rows ?? []"
              />
              <p
                v-if="dashboardReady && !msgSparkValues.length && !apiSparkValues.length"
                class="muted charts-page__board-note"
              >
                部分曲线需进程运行一段时间后才有时间桶数据；按日汇总图依赖历史落盘。
              </p>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
