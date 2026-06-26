<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import AiDailyTrendChart from "@/components/ai-config/stats/AiDailyTrendChart.vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import StatTable, { type StatColumn } from "@/components/ai-config/stats/StatTable.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_STATS_LIMITS } from "@/config/aiConstants";
import { useAiTaskStatsPage } from "@/composables/useAiTaskStatsPage";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { installChartThemeWatcher, readChartPalette } from "@/utils/chartTheme";

const panelNavIcon = usePanelNavIcon();
const {
  loading,
  err,
  month,
  start,
  end,
  stats,
  botSuccess,
  aiSuccess,
  aiFailed,
  aiQueued,
  aiRunning,
  failureRows,
  providerRows,
  modelRows,
  tokenProviderRows,
  tokenModelRows,
  routeRowsTop,
  historyBotPoints,
  historyBotCallbackPoints,
  historyAiPoints,
  historyAiFailPoints,
  historyPlainLlmChatPoints,
  historyPlainLlmChatSuccessPoints,
  historyPlainLlmChatFailPoints,
  historyRouteHeatPoints,
  persistenceHint,
  refresh,
  resetMonthRange,
} = useAiTaskStatsPage();

const palette = ref(readChartPalette(4));
const botAccent = computed(() => palette.value[0] ?? "#38bdf8");
const aiAccent = computed(() => palette.value[2] ?? "#34d399");
const aiFailAccent = computed(() => palette.value[3] ?? "#fb7185");
const statsSummary = computed(() => [
  {
    label: "服务连通性",
    value: stats.value?.ai_reachable ? "正常" : "异常",
    tone: stats.value?.ai_reachable ? "accent" : "danger",
  },
  {
    label: "请求与回调 (Bot)",
    value: botSuccess.value.toLocaleString(),
  },
  {
    label: "处理成功 (AI)",
    value: aiSuccess.value.toLocaleString(),
    tone: "accent",
  },
  {
    label: "处理失败 (AI)",
    value: aiFailed.value.toLocaleString(),
    tone: aiFailed.value > 0 ? "danger" : undefined,
  },
  {
    label: "队列积压",
    value: aiQueued.value.toLocaleString(),
  },
  {
    label: "正在处理",
    value: aiRunning.value.toLocaleString(),
  },
]);

type DimRow = (typeof providerRows.value)[number];
type TokenRow = (typeof tokenProviderRows.value)[number];
type CountRow = { key: string; count: number };

function dimSuccessRate(row: DimRow): string {
  if (!row.requests) return "0%";
  return `${Math.round((row.succeeded / row.requests) * 100)}%`;
}

const dimColumns = (head: string): StatColumn<DimRow>[] => [
  {
    key: "name",
    label: head,
    value: (r) => r.key,
    sub: (r) => (r.recentFailureClass ? `最新报错：${r.recentFailureClass}` : ""),
  },
  { key: "requests", label: "请求数", value: (r) => r.requests.toLocaleString(), align: "right" },
  { key: "success", label: "成功", value: (r) => r.succeeded.toLocaleString(), align: "right" },
  {
    key: "failed",
    label: "失败",
    value: (r) => r.failed.toLocaleString(),
    align: "right",
  },
  {
    key: "success-rate",
    label: "成功率",
    value: (r) => dimSuccessRate(r),
    align: "right",
  },
  { key: "latency", label: "均延迟", value: (r) => (r.avgLatencyMs != null ? `${r.avgLatencyMs} ms` : "—"), align: "right" },
];

function tokenPromptPercent(row: TokenRow): number {
  if (!row.totalTokens) return 0;
  return Math.max(0, Math.min(100, Math.round((row.promptTokens / row.totalTokens) * 100)));
}

function tokenCompletionPercent(row: TokenRow): number {
  return Math.max(0, 100 - tokenPromptPercent(row));
}

function countBarWidth(row: CountRow, rows: CountRow[]): number {
  const max = Math.max(1, ...rows.map((item) => item.count));
  return Math.max(8, Math.round((row.count / max) * 100));
}

function routeBarColor(index: number): string {
  return palette.value[index % palette.value.length] ?? botAccent.value;
}

watch(month, () => {
  resetMonthRange();
  void refresh();
});

watch([start, end], () => {
  void refresh();
});

let stopThemeWatch: (() => void) | null = null;

onMounted(() => {
  resetMonthRange();
  void refresh();
  stopThemeWatch = installChartThemeWatcher(() => {
    palette.value = readChartPalette(4);
  });
});

onUnmounted(() => {
  stopThemeWatch?.();
});
</script>

<template>
  <div class="console-hub-page ai-surface ai-stats-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        <ConsoleNavIcon name="chart-line-up-solid" :size="24" />
        AI 数据看板
      </template>
      <template #actions>
        <div class="ai-stats-page__date-filters">
          <label class="ai-date-field">
            <span class="ai-date-field__label">月份</span>
            <input v-model="month" class="inp" type="month" aria-label="选择月份">
          </label>
          <label class="ai-date-field">
            <span class="ai-date-field__label">起始</span>
            <input v-model="start" class="inp" type="date" aria-label="选择起始日期">
          </label>
          <label class="ai-date-field">
            <span class="ai-date-field__label">结束</span>
            <input v-model="end" class="inp" type="date" aria-label="选择结束日期">
          </label>
          <UiButton variant="primary" :busy="loading" @click="refresh">刷新</UiButton>
        </div>
      </template>
      <template #extra>
        <p v-if="persistenceHint" class="muted ai-stats-page__hint">{{ persistenceHint }}</p>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <div class="ai-stats-page__top-metrics">
      <UiCard
        v-for="item in statsSummary"
        :key="item.label"
        class="ai-stats-page__metric-card"
      >
        <span class="ai-stats-page__metric-label">{{ item.label }}</span>
        <strong
          class="ai-stats-page__metric-value"
          :class="{
            'text-ok': item.tone === 'accent',
            'text-danger': item.tone === 'danger',
          }"
        >
          {{ item.value }}
        </strong>
      </UiCard>
    </div>

    <section class="ai-stats-page__charts">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Bot 端请求趋势</h3>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'submit', label: '请求发起', color: botAccent, unit: '次', points: historyBotPoints },
            { id: 'callback', label: '接收回调', color: aiAccent, unit: '次', points: historyBotCallbackPoints },
          ]"
          :summary="[
            `请求发起 ${historyBotPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `接收回调 ${historyBotCallbackPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          empty-text="暂无记录"
        />
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">模型成功与失败趋势</h3>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'success', label: '处理成功', color: aiAccent, unit: '次', points: historyAiPoints },
            { id: 'fail', label: '处理失败', color: aiFailAccent, unit: '次', points: historyAiFailPoints },
          ]"
          :summary="[
            `处理成功 ${historyAiPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `处理失败 ${historyAiFailPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          :empty-text="stats?.ai_reachable ? '暂无记录' : '服务断开'"
        />
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">直接对话调用趋势</h3>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'plain-total', label: '总调用量', color: botAccent, unit: '次', points: historyPlainLlmChatPoints },
            { id: 'plain-ok', label: '成功', color: aiAccent, unit: '次', style: 'bar', points: historyPlainLlmChatSuccessPoints },
            { id: 'plain-fail', label: '失败', color: aiFailAccent, unit: '次', style: 'bar', points: historyPlainLlmChatFailPoints },
          ]"
          :summary="[
            `总计调用 ${historyPlainLlmChatPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `成功 ${historyPlainLlmChatSuccessPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `失败 ${historyPlainLlmChatFailPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          empty-text="暂无记录"
        />
      </UiCard>
    </section>

    <section class="ai-stats-page__boards">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">高频失败原因</h3>
        </div>
        <div v-if="failureRows.length" class="ai-dist-list">
          <article
            v-for="row in failureRows.slice(0, AI_STATS_LIMITS.topRows)"
            :key="row.key"
            class="ai-dist-row"
          >
            <div class="ai-dist-row__head">
              <span class="ai-dist-row__label ai-stats-page__row-key">{{ row.label }}</span>
              <strong class="ai-dist-row__value">{{ row.count.toLocaleString() }} 次</strong>
            </div>
            <div class="ai-dist-row__track" aria-hidden="true">
              <span
                class="ai-dist-row__fill ai-dist-row__fill--danger"
                :style="{ width: `${countBarWidth(row, failureRows)}%` }"
              />
            </div>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">运行平稳</span>
          <span class="ai-empty__hint">该时段内未发生任何失败异常。</span>
        </div>
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">路由命中排行</h3>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'route-heat', label: '触发次数', color: '#22c55e', unit: '次', points: historyRouteHeatPoints },
          ]"
          :summary="[
            `累计触发 ${historyRouteHeatPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
            routeRowsTop[0] ? `最热节点 ${routeRowsTop[0].key} (${routeRowsTop[0].count.toLocaleString()} 次)` : '暂无数据',
          ]"
          empty-text="所选时间段内暂无热度记录。"
        />
        <div v-if="routeRowsTop.length" class="ai-dist-list ai-stats-page__route-list">
          <article
            v-for="(row, index) in routeRowsTop"
            :key="row.key"
            class="ai-dist-row"
          >
            <div class="ai-dist-row__head">
              <span class="ai-dist-row__label ai-stats-page__row-key">{{ row.key }}</span>
              <strong class="ai-dist-row__value">{{ row.count.toLocaleString() }} 次</strong>
            </div>
            <div class="ai-dist-row__track" aria-hidden="true">
              <span
                class="ai-dist-row__fill"
                :style="{ width: `${countBarWidth(row, routeRowsTop)}%`, background: routeBarColor(index) }"
              />
            </div>
          </article>
        </div>
      </UiCard>
    </section>

    <section class="ai-stats-page__boards">
      <StatTable
        title="模型提供商表现"
        hint=""
        :rows="providerRows"
        :columns="dimColumns('Provider')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无数据"
      />
      <StatTable
        title="单一模型表现"
        hint=""
        :rows="modelRows"
        :columns="dimColumns('模型')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无数据"
      />
    </section>

    <section class="ai-stats-page__boards">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Token 消耗 (按 Provider)</h3>
        </div>
        <div v-if="tokenProviderRows.length" class="ai-token-list">
          <article
            v-for="row in tokenProviderRows.slice(0, AI_STATS_LIMITS.topRows)"
            :key="row.key"
            class="ai-token-card"
          >
            <div class="ai-token-card__head">
              <strong class="ai-token-card__name">{{ row.key }}</strong>
              <span class="ai-token-card__total">{{ row.totalTokens.toLocaleString() }}</span>
            </div>
            <div class="ai-token-card__meta">
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">输入 (Prompt)</span>
                <strong>{{ row.promptTokens.toLocaleString() }}</strong>
              </span>
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">输出 (Completion)</span>
                <strong>{{ row.completionTokens.toLocaleString() }}</strong>
              </span>
            </div>
            <div class="ai-token-bar" aria-hidden="true">
              <span class="ai-token-bar__prompt" :style="{ width: `${tokenPromptPercent(row)}%` }" />
              <span class="ai-token-bar__completion" :style="{ width: `${tokenCompletionPercent(row)}%` }" />
            </div>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">暂无 Token 数据</span>
        </div>
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Token 消耗 (按模型)</h3>
        </div>
        <div v-if="tokenModelRows.length" class="ai-token-list">
          <article
            v-for="row in tokenModelRows.slice(0, AI_STATS_LIMITS.topRows)"
            :key="row.key"
            class="ai-token-card"
          >
            <div class="ai-token-card__head">
              <strong class="ai-token-card__name">{{ row.key }}</strong>
              <span class="ai-token-card__total">{{ row.totalTokens.toLocaleString() }}</span>
            </div>
            <div class="ai-token-card__meta">
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">输入 (Prompt)</span>
                <strong>{{ row.promptTokens.toLocaleString() }}</strong>
              </span>
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">输出 (Completion)</span>
                <strong>{{ row.completionTokens.toLocaleString() }}</strong>
              </span>
            </div>
            <div class="ai-token-bar" aria-hidden="true">
              <span class="ai-token-bar__prompt" :style="{ width: `${tokenPromptPercent(row)}%` }" />
              <span class="ai-token-bar__completion" :style="{ width: `${tokenCompletionPercent(row)}%` }" />
            </div>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">暂无 Token 数据</span>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.ai-stats-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ai-stats-page__date-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.ai-date-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  padding: 4px 8px;
  border-radius: 8px;
}

.ai-date-field__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-muted);
}

.ai-date-field .inp {
  border: none;
  background: transparent;
  padding: 2px 4px;
  min-height: 28px;
  font-size: 0.875rem;
  color: var(--text);
}

.ai-date-field .inp:focus {
  outline: none;
  box-shadow: none;
}

.ai-stats-page__top-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.ai-stats-page__metric-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px;
  border: none;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.ai-stats-page__metric-label {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.ai-stats-page__metric-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.ai-stats-page__hint {
  margin-top: 8px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.ai-stats-page__charts,
.ai-stats-page__boards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.ai-stats-page__panel {
  height: 100%;
  padding: 24px;
  background: var(--bg-card);
  border: none;
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.ai-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.ai-head__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.ai-head__hint {
  display: none;
}

.ai-stats-page__route-list {
  margin-top: 20px;
}

.ai-stats-page__row-key {
  min-width: 0;
  word-break: break-word;
}

.ai-dist-list {
  display: grid;
  gap: 16px;
}

.ai-dist-row {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.ai-dist-row__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-dist-row__label {
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.ai-dist-row__value {
  flex-shrink: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
}

.ai-dist-row__track {
  display: flex;
  align-items: center;
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 15%, transparent);
}

.ai-dist-row__fill {
  height: 100%;
  min-width: 8px;
  border-radius: inherit;
  background: var(--accent);
}

.ai-dist-row__fill--danger {
  background: #fb7185;
}

.ai-token-list {
  display: grid;
  gap: 16px;
}

.ai-token-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
  border-radius: 12px;
  border: none;
}

.ai-token-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-token-card__name {
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  word-break: break-word;
}

.ai-token-card__total {
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  font-family: var(--font-mono);
}

.ai-token-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.ai-token-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.ai-token-chip strong {
  color: var(--text);
  font-weight: 600;
}

.ai-token-chip__label {
  white-space: nowrap;
}

.ai-token-bar {
  display: flex;
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 15%, transparent);
}

.ai-token-bar__prompt {
  background: var(--brand);
}

.ai-token-bar__completion {
  background: color-mix(in srgb, var(--brand) 40%, transparent);
}

.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  text-align: center;
}

.ai-empty__title {
  font-weight: 600;
  margin-bottom: 8px;
}

.ai-empty__hint {
  font-size: 0.875rem;
  color: var(--text-muted);
}

@media (max-width: 1100px) {
  .ai-stats-page__charts,
  .ai-stats-page__boards {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .ai-stats-page__date-filters {
    flex-direction: column;
    align-items: stretch;
  }
  
  .ai-date-field {
    width: 100%;
    justify-content: space-between;
  }
  
  .ai-stats-page__top-metrics {
    grid-template-columns: 1fr;
  }

  .ai-stats-page__panel {
    padding: 16px;
  }
}
</style>
