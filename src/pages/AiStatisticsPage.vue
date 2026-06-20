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
    label: "AI 可达",
    value: stats.value?.ai_reachable ? "是" : "否",
    tone: stats.value?.ai_reachable ? "accent" : "danger",
  },
  {
    label: "Bot 提交 + 回调",
    value: botSuccess.value.toLocaleString(),
  },
  {
    label: "AI 成功",
    value: aiSuccess.value.toLocaleString(),
    tone: "accent",
  },
  {
    label: "AI 失败",
    value: aiFailed.value.toLocaleString(),
    tone: aiFailed.value > 0 ? "danger" : undefined,
  },
  {
    label: "队列中",
    value: aiQueued.value.toLocaleString(),
  },
  {
    label: "执行中",
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
    sub: (r) => (r.recentFailureClass ? `最近失败：${r.recentFailureClass}` : ""),
  },
  { key: "requests", label: "请求", value: (r) => r.requests.toLocaleString(), align: "right" },
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
        AI 统计
      </template>
      <template #lead>
        按时间窗汇总 LLM 的调用量、成功与失败、回复路径，以及各 Provider / 模型的请求量和 Token 消耗。
      </template>
      <template #actions>
        <label class="ai-date-field">
          <span>月份</span>
          <input v-model="month" class="inp" type="month" aria-label="选择月份">
        </label>
        <label class="ai-date-field">
          <span>起始</span>
          <input v-model="start" class="inp" type="date" aria-label="选择起始日期">
        </label>
        <label class="ai-date-field">
          <span>结束</span>
          <input v-model="end" class="inp" type="date" aria-label="选择结束日期">
        </label>
        <UiButton variant="primary" :busy="loading" @click="refresh">刷新</UiButton>
      </template>
      <template #extra>
        <p class="muted ai-stats-page__hint">{{ persistenceHint }}</p>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <section class="ai-stats-page__summary">
      <UiCard class="ai-stats-page__summary-card">
        <div class="ai-head">
          <h3 class="ai-head__title">运行摘要</h3>
          <span class="ai-head__hint">先判断 AI 是否可达，再看当前队列压力</span>
        </div>
        <div class="ai-stat-grid ai-stats-page__kpis">
          <div
            v-for="item in statsSummary"
            :key="item.label"
            class="ai-stat ai-stats-page__stat-card"
          >
            <span class="ai-stat__label">{{ item.label }}</span>
            <strong
              class="ai-stat__value"
              :class="{
                'ai-stat__value--accent': item.tone === 'accent',
                'ai-stat__value--danger': item.tone === 'danger',
              }"
            >
              {{ item.value }}
            </strong>
          </div>
        </div>
      </UiCard>
    </section>

    <section class="ai-stats-page__charts">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Bot 提交与回调</h3>
          <span class="ai-head__hint">按日观察提交与回调是否失衡</span>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'submit', label: 'Bot 提交', color: botAccent, unit: '次', points: historyBotPoints },
            { id: 'callback', label: 'Bot 回调', color: aiAccent, unit: '次', points: historyBotCallbackPoints },
          ]"
          :summary="[
            `Bot 提交 ${historyBotPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `Bot 回调 ${historyBotCallbackPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          empty-text="所选时间窗暂无 Bot 侧历史快照。"
        />
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">AI 成功任务</h3>
          <span class="ai-head__hint">同时看成功与失败的日走势</span>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'success', label: 'AI 成功', color: aiAccent, unit: '次', points: historyAiPoints },
            { id: 'fail', label: 'AI 失败', color: aiFailAccent, unit: '次', points: historyAiFailPoints },
          ]"
          :summary="[
            `AI 成功 ${historyAiPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `AI 失败 ${historyAiFailPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          :empty-text="stats?.ai_reachable ? '所选时间窗暂无 AI 历史快照。' : 'AI 当前不可达，无法获取 AI 历史快照。'"
        />
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">plain_llm_chat 调用趋势</h3>
          <span class="ai-head__hint">一张图同时看总量、成功与失败波动</span>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'plain-total', label: '总调用', color: botAccent, unit: '次', points: historyPlainLlmChatPoints },
            { id: 'plain-ok', label: '成功', color: aiAccent, unit: '次', style: 'bar', points: historyPlainLlmChatSuccessPoints },
            { id: 'plain-fail', label: '失败', color: aiFailAccent, unit: '次', style: 'bar', points: historyPlainLlmChatFailPoints },
          ]"
          :summary="[
            `总调用 ${historyPlainLlmChatPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `成功 ${historyPlainLlmChatSuccessPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
            `失败 ${historyPlainLlmChatFailPoints.reduce((sum, item) => sum + item.value, 0).toLocaleString()} 次`,
          ]"
          empty-text="所选时间窗暂无 plain_llm_chat 调用历史。"
        />
      </UiCard>
    </section>

    <section class="ai-stats-page__boards">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">失败分布</h3>
          <span class="ai-head__hint">出现最多的失败原因</span>
        </div>
        <div v-if="failureRows.length" class="ai-dist-list">
          <article
            v-for="row in failureRows.slice(0, AI_STATS_LIMITS.topRows)"
            :key="row.key"
            class="ai-dist-row"
          >
            <div class="ai-dist-row__head">
              <span class="ai-dist-row__label ai-stats-page__row-key">{{ row.label }}</span>
              <strong class="ai-dist-row__value">{{ row.count.toLocaleString() }}</strong>
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
          <span>没有失败记录</span>
          <span class="ai-empty__hint">所选时间窗内 AI 没有失败任务。</span>
        </div>
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">回复路径</h3>
          <span class="ai-head__hint">先看每日热点，再看当前区间最常命中的路径</span>
        </div>
        <AiDailyTrendChart
          :series="[
            { id: 'route-heat', label: '路径命中', color: '#22c55e', unit: '次', points: historyRouteHeatPoints },
          ]"
          :summary="[
            `路径命中 ${historyRouteHeatPoints.reduce((sum, row) => sum + row.value, 0).toLocaleString()} 次`,
            routeRowsTop[0] ? `当前最热 ${routeRowsTop[0].key} · ${routeRowsTop[0].count.toLocaleString()} 次` : '当前区间暂无热点路径',
          ]"
          empty-text="这段时间还没有产生回复路径统计。"
        />
        <div v-if="routeRowsTop.length" class="ai-dist-list ai-stats-page__route-list">
          <article
            v-for="(row, index) in routeRowsTop"
            :key="row.key"
            class="ai-dist-row"
          >
            <div class="ai-dist-row__head">
              <span class="ai-dist-row__label ai-stats-page__row-key">{{ row.key }}</span>
              <strong class="ai-dist-row__value">{{ row.count.toLocaleString() }}</strong>
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
        title="Provider 视图"
        hint="按 Provider 对比请求量、成功率与平均延迟"
        :rows="providerRows"
        :columns="dimColumns('Provider')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无 Provider 统计"
      />
      <StatTable
        title="模型视图"
        hint="按模型对比请求量、成功率与平均延迟"
        :rows="modelRows"
        :columns="dimColumns('模型')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无模型统计"
      />
    </section>

    <section class="ai-stats-page__boards">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Token · 按 Provider</h3>
          <span class="ai-head__hint">先看总量，再看提示词与补全占比</span>
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
                <span class="ai-token-chip__label">提示</span>
                <strong>{{ row.promptTokens.toLocaleString() }}</strong>
              </span>
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">补全</span>
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
          <span>暂无 Token 统计</span>
        </div>
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Token · 按模型</h3>
          <span class="ai-head__hint">观察高消耗模型，避免单模型异常拉高成本</span>
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
                <span class="ai-token-chip__label">提示</span>
                <strong>{{ row.promptTokens.toLocaleString() }}</strong>
              </span>
              <span class="ai-token-chip">
                <span class="ai-token-chip__label">补全</span>
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
          <span>暂无 Token 统计</span>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.ai-stats-page__summary {
  display: block;
}

.ai-stats-page__summary-card {
  height: 100%;
}

.ai-stats-page__kpis {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.ai-stats-page__stat-card {
  min-width: 0;
  padding: 16px 16px 14px;
}

.ai-stats-page__hint {
  margin-top: 8px;
  font-size: 0.75rem;
}

.ai-stats-page__kpis {
  --ai-stat-cols: 6;
}

.ai-stats-page__charts,
.ai-stats-page__boards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ai-stats-page__panel {
  height: 100%;
}

.ai-stats-page__route-list {
  margin-top: 14px;
}

.ai-stats-page__row-key {
  min-width: 0;
  word-break: break-word;
}

.ai-dist-list {
  display: grid;
  gap: 12px;
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
  font-size: 0.9rem;
}

.ai-dist-row__value {
  flex-shrink: 0;
  font-size: 0.84rem;
  color: var(--text);
}

.ai-dist-row__track {
  display: flex;
  align-items: center;
  overflow: hidden;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 7%, transparent);
}

.ai-dist-row__fill {
  height: 100%;
  min-width: 10px;
  border-radius: inherit;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 78%, #ffffff), var(--accent));
}

.ai-dist-row__fill--danger {
  background: linear-gradient(90deg, color-mix(in srgb, #fb7185 78%, #ffffff), #ef4444);
}

.ai-token-list {
  display: grid;
  gap: 12px;
}

.ai-token-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, transparent), transparent 48%),
    color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-token-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.ai-token-card__name {
  min-width: 0;
  font-size: 0.95rem;
  word-break: break-word;
}

.ai-token-card__total {
  flex-shrink: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}

.ai-token-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-token-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  font-size: 0.78rem;
  color: var(--text-muted);
}

.ai-token-chip strong {
  color: var(--text);
  font-size: 0.82rem;
}

.ai-token-chip__label {
  white-space: nowrap;
}

.ai-token-bar {
  display: flex;
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text) 7%, transparent);
}

.ai-token-bar__prompt {
  background: color-mix(in srgb, var(--accent) 72%, #ffffff);
}

.ai-token-bar__completion {
  background: color-mix(in srgb, #f59e0b 72%, #ffffff);
}

@media (max-width: 1100px) {
  .ai-stats-page__kpis {
    --ai-stat-cols: 3;
  }
}

@media (max-width: 860px) {
  .ai-stats-page__charts,
  .ai-stats-page__boards {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .ai-stats-page__kpis {
    --ai-stat-cols: 2;
  }

  .ai-dist-row__head {
    display: grid;
    gap: 4px;
  }

  .ai-token-card__head {
    display: grid;
    gap: 4px;
  }
}
</style>
