<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ChartsDailyBarChart from "@/components/ChartsDailyBarChart.vue";
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
  historyAiPoints,
  persistenceHint,
  refresh,
  resetMonthRange,
} = useAiTaskStatsPage();

const palette = ref(readChartPalette(4));
const botAccent = computed(() => palette.value[0] ?? "#38bdf8");
const aiAccent = computed(() => palette.value[2] ?? "#34d399");

type DimRow = (typeof providerRows.value)[number];
type TokenRow = (typeof tokenProviderRows.value)[number];

const dimColumns = (head: string): StatColumn<DimRow>[] => [
  {
    key: "name",
    label: head,
    value: (r) => r.key,
    sub: (r) => (r.recentFailureClass ? `最近失败：${r.recentFailureClass}` : ""),
  },
  { key: "requests", label: "请求", value: (r) => r.requests.toLocaleString(), align: "right" },
  {
    key: "ratio",
    label: "成功 / 失败",
    value: (r) => `${r.succeeded.toLocaleString()} / ${r.failed.toLocaleString()}`,
    align: "right",
  },
  { key: "latency", label: "均延迟", value: (r) => (r.avgLatencyMs != null ? `${r.avgLatencyMs} ms` : "—"), align: "right" },
];

const tokenColumns = (head: string): StatColumn<TokenRow>[] => [
  { key: "name", label: head, value: (r) => r.key },
  { key: "total", label: "总计", value: (r) => r.totalTokens.toLocaleString(), align: "right" },
  { key: "prompt", label: "提示", value: (r) => r.promptTokens.toLocaleString(), align: "right" },
  { key: "completion", label: "补全", value: (r) => r.completionTokens.toLocaleString(), align: "right" },
];

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

    <section class="ai-stat-grid ai-stats-page__kpis">
      <div class="ai-stat">
        <span class="ai-stat__label">Bot 提交 + 回调</span>
        <strong class="ai-stat__value">{{ botSuccess.toLocaleString() }}</strong>
      </div>
      <div class="ai-stat">
        <span class="ai-stat__label">AI 成功</span>
        <strong class="ai-stat__value ai-stat__value--accent">{{ aiSuccess.toLocaleString() }}</strong>
      </div>
      <div class="ai-stat">
        <span class="ai-stat__label">AI 失败</span>
        <strong class="ai-stat__value" :class="{ 'ai-stat__value--danger': aiFailed > 0 }">{{ aiFailed.toLocaleString() }}</strong>
      </div>
      <div class="ai-stat">
        <span class="ai-stat__label">队列中</span>
        <strong class="ai-stat__value">{{ aiQueued.toLocaleString() }}</strong>
      </div>
      <div class="ai-stat">
        <span class="ai-stat__label">执行中</span>
        <strong class="ai-stat__value">{{ aiRunning.toLocaleString() }}</strong>
      </div>
      <div class="ai-stat">
        <span class="ai-stat__label">AI 可达</span>
        <strong class="ai-stat__value" :class="stats?.ai_reachable ? 'ai-stat__value--accent' : 'ai-stat__value--danger'">
          {{ stats?.ai_reachable ? "是" : "否" }}
        </strong>
      </div>
    </section>

    <section class="ai-stats-page__charts">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">Bot 提交与回调</h3>
          <span class="ai-head__hint">每日 Bot 侧任务量</span>
        </div>
        <ChartsDailyBarChart
          :points="historyBotPoints"
          title=""
          unit="次"
          :accent="botAccent"
          empty-text="所选时间窗暂无 Bot 侧历史快照。"
        />
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">AI 成功任务</h3>
          <span class="ai-head__hint">每日 AI 侧完成量</span>
        </div>
        <ChartsDailyBarChart
          :points="historyAiPoints"
          title=""
          unit="次"
          :accent="aiAccent"
          :empty-text="stats?.ai_reachable ? '所选时间窗暂无 AI 历史快照。' : 'AI 当前不可达，无法获取 AI 历史快照。'"
        />
      </UiCard>
    </section>

    <section class="ai-stats-page__boards">
      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">失败分布</h3>
          <span class="ai-head__hint">出现最多的失败原因</span>
        </div>
        <div v-if="failureRows.length" class="ai-rows">
          <div v-for="row in failureRows.slice(0, AI_STATS_LIMITS.topRows)" :key="row.key" class="ai-row">
            <span class="ai-row__key">{{ row.label }}</span>
            <strong class="ai-row__val">{{ row.count.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span>没有失败记录</span>
          <span class="ai-empty__hint">所选时间窗内 AI 没有失败任务。</span>
        </div>
      </UiCard>

      <UiCard class="ai-stats-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">回复路径</h3>
          <span class="ai-head__hint">去重后实际命中的回复方式</span>
        </div>
        <div v-if="routeRowsTop.length" class="ai-rows">
          <div v-for="row in routeRowsTop" :key="row.key" class="ai-row">
            <span class="ai-row__key">{{ row.key }}</span>
            <strong class="ai-row__val">{{ row.count.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span>暂无路径数据</span>
          <span class="ai-empty__hint">这段时间还没有产生回复路径统计。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-stats-page__boards">
      <StatTable
        title="Provider 视图"
        hint="请求量、成功 / 失败与平均延迟"
        :rows="providerRows"
        :columns="dimColumns('Provider')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无 Provider 统计"
      />
      <StatTable
        title="模型视图"
        hint="按模型拆分的请求与错误"
        :rows="modelRows"
        :columns="dimColumns('模型')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无模型统计"
      />
    </section>

    <section class="ai-stats-page__boards">
      <StatTable
        title="Token · 按 Provider"
        hint="各 Provider 的 Token 消耗"
        :rows="tokenProviderRows"
        :columns="tokenColumns('Provider')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无 Token 统计"
      />
      <StatTable
        title="Token · 按模型"
        hint="各模型的 Token 消耗"
        :rows="tokenModelRows"
        :columns="tokenColumns('模型')"
        :page-size="AI_STATS_LIMITS.topRows"
        :row-key="(r) => r.key"
        empty-text="暂无 Token 统计"
      />
    </section>
  </div>
</template>

<style scoped>
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
}
</style>
