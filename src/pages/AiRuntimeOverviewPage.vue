<script setup lang="ts">
import { computed, onMounted } from "vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
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
const submitGate = computed(() => runtimeOverview.value?.health?.submit_gate);
const taskRoutingRows = computed(() => {
  const preview = runtimeOverview.value?.task_routing_preview;
  if (!preview || typeof preview !== "object") return [];
  return Object.entries(preview).map(([task, raw]) => {
    const row = raw as {
      primary_model?: string | null;
      chain?: Array<{ resolved_model?: string | null }>;
    };
    const chain = Array.isArray(row.chain) ? row.chain : [];
    const fallbacks = chain
      .slice(1)
      .map((item) => String(item.resolved_model ?? "").trim())
      .filter(Boolean);
    return {
      task,
      label: LLM_TASK_ROUTE_LABELS[task as keyof typeof LLM_TASK_ROUTE_LABELS] ?? task,
      primary: String(row.primary_model ?? chain[0]?.resolved_model ?? "").trim() || "—",
      fallbacks,
    };
  });
});
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
        Runtime 诊断中心
      </template>
      <template #lead>
        全方位监控大模型及多媒体任务的运行状态。您可以在此快速排查降级、熔断与队列堆积问题，确认全局可用性。
      </template>
      <template #actions>
        <RouterLink to="/ai/wizard">
          <UiButton variant="outline">体检向导</UiButton>
        </RouterLink>
        <RouterLink to="/ai/home">
          <UiButton variant="outline">返回首页</UiButton>
        </RouterLink>
        <UiButton variant="primary" :busy="loading" @click="refresh">
          刷新数据
        </UiButton>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <!-- 顶部数据卡片 -->
    <div class="ai-runtime-page__top-metrics">
      <div class="ai-runtime-page__metric-card">
        <span class="ai-runtime-page__metric-label">排队中请求</span>
        <strong class="ai-runtime-page__metric-value">{{ llmRuntimeSummary.queued }}</strong>
      </div>
      <div class="ai-runtime-page__metric-card">
        <span class="ai-runtime-page__metric-label">处理中请求</span>
        <strong class="ai-runtime-page__metric-value">{{ llmRuntimeSummary.running }}</strong>
      </div>
      <div class="ai-runtime-page__metric-card">
        <span class="ai-runtime-page__metric-label">最近失败数</span>
        <strong
          class="ai-runtime-page__metric-value"
          :class="{ 'text-danger': llmRuntimeSummary.failed > 0 }"
        >
          {{ llmRuntimeSummary.failed }}
        </strong>
      </div>
    </div>

    <!-- 运行状态横幅 -->
    <UiCard class="ai-runtime-page__hero">
      <div class="ai-runtime-page__hero-head">
        <div class="ai-runtime-page__hero-main">
          <div class="ai-runtime-page__hero-state">
            <span
              class="ai-dot"
              :class="headline.ok && headline.title === '全局运行正常' ? dotClass('healthy') : dotClass('degraded')"
            />
            <strong class="ai-runtime-page__hero-title">{{ headline.title }}</strong>
          </div>
          <p class="muted ai-runtime-page__hero-detail">{{ headline.detail }}</p>
          <p
            v-if="submitGate && submitGate.allowed === false"
            class="alert alert--warn ai-runtime-page__gate-hint"
          >
            当前拒接新 LLM 请求：{{ submitGate.status || "未知原因" }}
          </p>
          <p v-if="runtimeOverview?.health?.url" class="muted ai-runtime-page__hero-url">
            <span>服务节点：{{ runtimeOverview.health.url }}</span>
            <span v-if="runtimeOverview.health.status_code != null" class="ai-runtime-page__hero-code">
              · HTTP {{ runtimeOverview.health.status_code }}
            </span>
          </p>
        </div>
      </div>
    </UiCard>

    <UiCard v-if="focusItems.length" class="ai-runtime-page__focus-card">
      <div class="ai-head">
        <ConsoleNavIcon name="alert" class="ai-head__icon" />
        <h3 class="ai-head__title">网关连通性异常</h3>
      </div>
      <div class="ai-rows">
        <div
          v-for="item in focusItems"
          :key="item.capabilityId"
          class="ai-runtime-page__focus"
        >
          <div class="ai-runtime-page__focus-head">
            <span class="ai-dot" :class="dotClass(item.state)" />
            <strong>{{ item.title }}</strong>
          </div>
          <p class="ai-runtime-page__focus-desc">{{ item.description }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard class="ai-runtime-page__table-card">
      <div class="ai-head">
        <ConsoleNavIcon name="activity" class="ai-head__icon" />
        <h3 class="ai-head__title">核心能力健康状态</h3>
      </div>
      <div v-if="rows.length" class="ai-runtime-page__table-wrap">
        <table class="ai-runtime-page__table">
          <thead>
            <tr>
              <th>能力项</th>
              <th>健康度 (Health)</th>
              <th>熔断器 (Circuit)</th>
              <th>降级状态</th>
              <th>详细信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td data-label="能力项">
                <strong>{{ row.title }}</strong>
                <span class="muted ai-runtime-page__row-id">{{ row.id }}</span>
              </td>
              <td data-label="健康度">
                <span class="ai-runtime-page__pill" :class="`ai-runtime-page__pill--${healthTone(row.healthState)}`">
                  {{ row.healthState }}
                </span>
              </td>
              <td data-label="熔断器">
                <span class="ai-runtime-page__pill" :class="`ai-runtime-page__pill--${circuitTone(row.circuitState)}`">
                  {{ row.circuitState }}
                </span>
              </td>
              <td data-label="降级状态">{{ row.degradedState }}</td>
              <td data-label="详细信息" class="muted">{{ row.detail }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="ai-empty">
        <span class="ai-empty__title">暂无核心能力数据</span>
        <span class="ai-empty__hint">请确认 AI 服务在线，或通过体检向导进行诊断。</span>
      </div>
    </UiCard>

    <UiCard v-if="taskRoutingRows.length" class="ai-runtime-page__routing-card">
      <div class="ai-head">
        <ConsoleNavIcon name="blocks" class="ai-head__icon" />
        <h3 class="ai-head__title">模型任务路由与降级链</h3>
      </div>
      <div class="ai-runtime-page__table-wrap">
        <table class="ai-runtime-page__table">
          <thead>
            <tr>
              <th>任务场景</th>
              <th>主用模型</th>
              <th>备选模型 (Fallback)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in taskRoutingRows" :key="row.task">
              <td data-label="任务场景">
                <strong>{{ row.label }}</strong>
                <span class="muted ai-runtime-page__row-id">{{ row.task }}</span>
              </td>
              <td data-label="主用模型"><code>{{ row.primary }}</code></td>
              <td data-label="备选模型" class="muted">
                <span v-if="row.fallbacks.length" class="ai-runtime-page__fallback-chain">
                  {{ row.fallbacks.join(" → ") }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </div>
</template>

<style scoped>
.ai-runtime-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.ai-runtime-page__top-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.ai-runtime-page__metric-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-runtime-page__metric-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-runtime-page__metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.ai-runtime-page__hero,
.ai-runtime-page__table-card,
.ai-runtime-page__routing-card,
.ai-runtime-page__focus-card {
  padding: 24px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border: none;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-runtime-page__hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ai-runtime-page__hero-main {
  flex: 1;
  min-width: 0;
}

.ai-runtime-page__hero-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1.375rem;
  margin-bottom: 8px;
}

.ai-runtime-page__hero-title {
  font-weight: 700;
  letter-spacing: -0.01em;
}

.ai-runtime-page__hero-detail {
  margin: 0 0 12px;
  font-size: 0.9375rem;
  line-height: 1.6;
  max-width: 48rem;
}

.ai-runtime-page__hero-url {
  margin: 0;
  font-size: 0.8125rem;
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  border-radius: 6px;
}

.ai-runtime-page__hero-code {
  margin-left: 6px;
  font-weight: 600;
  color: var(--text);
}

.ai-runtime-page__gate-hint {
  margin: 0 0 12px;
  font-size: 0.875rem;
  border-radius: 8px;
}

.ai-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
}

.ai-head__icon {
  color: var(--text-muted);
}

.ai-head__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.ai-runtime-page__table-wrap {
  overflow-x: auto;
}

.ai-runtime-page__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.ai-runtime-page__table th,
.ai-runtime-page__table td {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  text-align: left;
  vertical-align: top;
  line-height: 1.5;
}

.ai-runtime-page__table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.8125rem;
  white-space: nowrap;
}

.ai-runtime-page__table tr:last-child td {
  border-bottom: none;
}

.ai-runtime-page__row-id {
  display: block;
  font-size: 0.75rem;
  margin-top: 4px;
  font-family: var(--font-mono);
}

.ai-runtime-page__pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.ai-runtime-page__pill--ok {
  background: color-mix(in srgb, var(--ok, #16a34a) 12%, transparent);
  color: var(--ok, #16a34a);
}

.ai-runtime-page__pill--warn {
  background: color-mix(in srgb, var(--warn, #d97706) 12%, transparent);
  color: var(--warn, #d97706);
}

.ai-runtime-page__pill--danger {
  background: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
  color: var(--danger, #dc2626);
}

.ai-runtime-page__pill--muted {
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--text-muted);
}

.ai-runtime-page__fallback-chain {
  display: inline-block;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.ai-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-runtime-page__focus {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
  border-radius: 12px;
}

.ai-runtime-page__focus-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-runtime-page__focus-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.ai-empty__title {
  font-weight: 500;
  margin-bottom: 8px;
}

.ai-empty__hint {
  font-size: 0.875rem;
  color: var(--text-muted);
}

@media (max-width: 960px) {
  .ai-runtime-page__hero-head {
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .ai-runtime-page__top-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  
  .ai-runtime-page__hero,
  .ai-runtime-page__table-card,
  .ai-runtime-page__routing-card,
  .ai-runtime-page__focus-card {
    padding: 16px;
  }

  .ai-runtime-page__table thead {
    display: none;
  }

  .ai-runtime-page__table tr {
    display: grid;
    gap: 8px;
    padding: 16px 0;
  }

  .ai-runtime-page__table td {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 12px;
    padding: 0;
    border: 0;
    align-items: baseline;
  }

  .ai-runtime-page__table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 0.8125rem;
  }
}
</style>
