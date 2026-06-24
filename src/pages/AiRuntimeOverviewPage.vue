<script setup lang="ts">
import { computed, onMounted } from "vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useAiRuntimeSnapshot } from "@/composables/useAiRuntimeSnapshot";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { runtimeStateDotClass } from "@/utils/aiRuntimeState";
import { buildRuntimeOverviewRows, runtimeOverviewHeadline } from "@/utils/runtimeOverviewRows";

const panelNavIcon = usePanelNavIcon();
const {
  loading,
  err,
  focusItems,
  llmRuntimeSummary,
  runtimeOverview,
  refresh,
} = useAiRuntimeSnapshot();

const headline = computed(() => runtimeOverviewHeadline(runtimeOverview.value));
const rows = computed(() => buildRuntimeOverviewRows(runtimeOverview.value));
const dotClass = runtimeStateDotClass;

function healthTone(state: string): string {
  const normalized = state.toLowerCase();
  if (normalized === "healthy") return "ok";
  if (normalized === "degraded" || normalized === "half_open") return "warn";
  if (normalized === "unhealthy" || normalized === "open") return "danger";
  return "muted";
}

function circuitTone(state: string): string {
  const normalized = state.toLowerCase();
  if (normalized === "closed") return "ok";
  if (normalized === "half_open") return "warn";
  if (normalized === "open") return "danger";
  return "muted";
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="console-hub-page ai-surface ai-runtime-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        Runtime 总览
      </template>
      <template #lead>
        一屏查看 LLM、绘图、点歌与媒体任务的 health、队列、降级与熔断；维护者可在 30 秒内判断全局是否可用。
      </template>
      <template #actions>
        <UiButton variant="primary" :busy="loading" @click="refresh">
          刷新
        </UiButton>
        <RouterLink to="/ai/wizard">
          <UiButton variant="ghost">体检向导</UiButton>
        </RouterLink>
        <RouterLink to="/ai/home">
          <UiButton variant="ghost">AI 首页</UiButton>
        </RouterLink>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <UiCard class="ai-runtime-page__hero">
      <div class="ai-runtime-page__hero-head">
        <div>
          <div class="ai-runtime-page__hero-state">
            <span
              class="ai-dot"
              :class="headline.ok && headline.title === '全局运行正常' ? dotClass('healthy') : dotClass('degraded')"
            />
            <strong>{{ headline.title }}</strong>
          </div>
          <p class="muted ai-runtime-page__hero-detail">{{ headline.detail }}</p>
          <p v-if="runtimeOverview?.health?.url" class="muted ai-runtime-page__hero-url">
            探活 {{ runtimeOverview.health.url }}
            <template v-if="runtimeOverview.health.status_code != null">
              · HTTP {{ runtimeOverview.health.status_code }}
            </template>
          </p>
        </div>
        <div class="ai-runtime-page__hero-stats">
          <div class="ai-stat ai-runtime-page__hero-stat">
            <span class="ai-stat__label">LLM 排队</span>
            <strong class="ai-stat__value">{{ llmRuntimeSummary.queued }}</strong>
          </div>
          <div class="ai-stat ai-runtime-page__hero-stat">
            <span class="ai-stat__label">LLM 执行中</span>
            <strong class="ai-stat__value">{{ llmRuntimeSummary.running }}</strong>
          </div>
          <div class="ai-stat ai-runtime-page__hero-stat">
            <span class="ai-stat__label">LLM 失败</span>
            <strong
              class="ai-stat__value"
              :class="{ 'ai-stat__value--danger': llmRuntimeSummary.failed > 0 }"
            >
              {{ llmRuntimeSummary.failed }}
            </strong>
          </div>
        </div>
      </div>
    </UiCard>

    <UiCard class="ai-runtime-page__table-card">
      <div class="ai-head">
        <h3 class="ai-head__title">运行时分项</h3>
        <span class="ai-head__hint">数据来自 runtime-overview / AI /health</span>
      </div>
      <div v-if="rows.length" class="ai-runtime-page__table-wrap">
        <table class="ai-runtime-page__table">
          <thead>
            <tr>
              <th>能力</th>
              <th>Health</th>
              <th>Circuit</th>
              <th>Degraded</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td data-label="能力">
                <strong>{{ row.title }}</strong>
                <span class="muted ai-runtime-page__row-id">{{ row.id }}</span>
              </td>
              <td data-label="Health">
                <span class="ai-runtime-page__pill" :class="`ai-runtime-page__pill--${healthTone(row.healthState)}`">
                  {{ row.healthState }}
                </span>
              </td>
              <td data-label="Circuit">
                <span class="ai-runtime-page__pill" :class="`ai-runtime-page__pill--${circuitTone(row.circuitState)}`">
                  {{ row.circuitState }}
                </span>
              </td>
              <td data-label="Degraded">{{ row.degradedState }}</td>
              <td data-label="详情" class="muted">{{ row.detail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="ai-empty">
        <span>暂无分项数据</span>
        <span class="ai-empty__hint">确认 AI 服务在线后刷新；也可先走体检向导。</span>
      </div>
    </UiCard>

    <UiCard v-if="focusItems.length" class="ai-runtime-page__focus-card">
      <div class="ai-head">
        <h3 class="ai-head__title">网关探活需处理</h3>
        <span class="ai-head__hint">来自站点级连通检查</span>
      </div>
      <div class="ai-rows">
        <article
          v-for="item in focusItems"
          :key="item.capabilityId"
          class="ai-runtime-page__focus"
        >
          <div class="ai-runtime-page__focus-head">
            <span class="ai-dot" :class="dotClass(item.state)" />
            <strong>{{ item.title }}</strong>
          </div>
          <p class="muted">{{ item.description }}</p>
        </article>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-runtime-page__hero {
  display: grid;
  gap: 12px;
}

.ai-runtime-page__hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-runtime-page__hero-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 1.125rem;
}

.ai-runtime-page__hero-detail,
.ai-runtime-page__hero-url {
  margin: 8px 0 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ai-runtime-page__hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(88px, 1fr));
  gap: 10px;
}

.ai-runtime-page__hero-stat {
  min-width: 0;
  padding: 12px 14px;
}

.ai-runtime-page__table-wrap {
  overflow-x: auto;
}

.ai-runtime-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.ai-runtime-page__table th,
.ai-runtime-page__table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: top;
}

.ai-runtime-page__table th {
  color: var(--text-muted);
  font-weight: 600;
}

.ai-runtime-page__row-id {
  display: block;
  font-size: 0.75rem;
  margin-top: 2px;
}

.ai-runtime-page__pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.ai-runtime-page__pill--ok {
  background: color-mix(in srgb, var(--ok, #16a34a) 14%, transparent);
  color: var(--ok, #16a34a);
}

.ai-runtime-page__pill--warn {
  background: color-mix(in srgb, var(--warn, #d97706) 14%, transparent);
  color: var(--warn, #d97706);
}

.ai-runtime-page__pill--danger {
  background: color-mix(in srgb, var(--danger, #dc2626) 14%, transparent);
  color: var(--danger, #dc2626);
}

.ai-runtime-page__pill--muted {
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--text-muted);
}

.ai-runtime-page__focus {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
}

.ai-runtime-page__focus-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 960px) {
  .ai-runtime-page__hero-head {
    flex-direction: column;
  }

  .ai-runtime-page__hero-stats {
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .ai-runtime-page__hero-stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-runtime-page__table thead {
    display: none;
  }

  .ai-runtime-page__table tr {
    display: grid;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }

  .ai-runtime-page__table td {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 8px;
    padding: 0;
    border: 0;
  }

  .ai-runtime-page__table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-weight: 600;
  }
}
</style>
