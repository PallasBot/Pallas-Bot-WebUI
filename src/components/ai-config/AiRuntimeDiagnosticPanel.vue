<script setup lang="ts">
import { computed } from "vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
import type { LlmRuntimeOverviewData } from "@/api/pallasTypes";
import { runtimeStateDotClass } from "@/utils/aiRuntimeState";
import type { AiRuntimeSnapshotItem } from "@/utils/aiRuntimeTypes";
import { buildRuntimeOverviewRows, runtimeOverviewHeadline } from "@/utils/runtimeOverviewRows";

const props = withDefaults(
  defineProps<{
    loading: boolean;
    err: string;
    embedded?: boolean;
    focusItems: AiRuntimeSnapshotItem[];
    llmRuntimeSummary: {
      queued: number;
      running: number;
      failed: number;
    };
    runtimeOverview: LlmRuntimeOverviewData | null;
  }>(),
  {
    embedded: false,
  },
);

const emit = defineEmits<{
  refresh: [];
}>();

const headline = computed(() => runtimeOverviewHeadline(props.runtimeOverview));
const rows = computed(() => buildRuntimeOverviewRows(props.runtimeOverview));
const submitGate = computed(() => props.runtimeOverview?.health?.submit_gate);
const taskRoutingRows = computed(() => {
  const preview = props.runtimeOverview?.task_routing_preview;
  if (!preview || typeof preview !== "object") return [];
  return Object.entries(preview).map(([task, raw]) => {
    const row = raw as {
      primary_model?: string | null;
      chain?: Array<{ resolved_model?: string | null; provider_hint?: string | null }>;
    };
    const chain = Array.isArray(row.chain) ? row.chain : [];
    const primaryEntry = chain[0];
    const providerHint = String(primaryEntry?.provider_hint ?? "").trim();
    const model = String(row.primary_model ?? primaryEntry?.resolved_model ?? "").trim();
    const fallbacks = chain
      .slice(1)
      .map((item) => String(item.resolved_model ?? "").trim())
      .filter(Boolean);
    const primary = model || providerHint || "—";
    return {
      task,
      label: LLM_TASK_ROUTE_LABELS[task as keyof typeof LLM_TASK_ROUTE_LABELS] ?? task,
      providerHint,
      model,
      primary,
      primaryDisplay:
        model && providerHint ? `${providerHint} · ${model}` : primary,
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
</script>

<template>
  <section
    class="ai-runtime-diagnostic"
    :class="{ 'ai-runtime-diagnostic--embedded': embedded }"
  >
    <div class="ai-runtime-diagnostic__head">
      <div>
        <h3 class="ai-runtime-diagnostic__title">运行诊断</h3>
        <p class="muted ai-runtime-diagnostic__lead">
          健康度、熔断与任务路由链；用于排查降级与队列堆积。
        </p>
      </div>
      <UiButton
        variant="ghost"
        size="sm"
        :busy="loading"
        @click="emit('refresh')"
      >
        刷新诊断
      </UiButton>
    </div>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <div
      v-if="!embedded"
      class="ai-runtime-diagnostic__top-metrics"
    >
      <div class="ai-runtime-diagnostic__metric-card">
        <span class="ai-runtime-diagnostic__metric-label">排队中请求</span>
        <strong class="ai-runtime-diagnostic__metric-value">{{ llmRuntimeSummary.queued }}</strong>
      </div>
      <div class="ai-runtime-diagnostic__metric-card">
        <span class="ai-runtime-diagnostic__metric-label">处理中请求</span>
        <strong class="ai-runtime-diagnostic__metric-value">{{ llmRuntimeSummary.running }}</strong>
      </div>
      <div class="ai-runtime-diagnostic__metric-card">
        <span class="ai-runtime-diagnostic__metric-label">最近失败数</span>
        <strong
          class="ai-runtime-diagnostic__metric-value"
          :class="{ 'text-danger': llmRuntimeSummary.failed > 0 }"
        >
          {{ llmRuntimeSummary.failed }}
        </strong>
      </div>
    </div>

    <UiCard class="ai-runtime-diagnostic__hero">
      <div class="ai-runtime-diagnostic__hero-main">
        <div class="ai-runtime-diagnostic__hero-state">
          <span
            class="ai-dot"
            :class="headline.ok && headline.title === '全局运行正常' ? dotClass('healthy') : dotClass('degraded')"
          />
          <strong class="ai-runtime-diagnostic__hero-title">{{ headline.title }}</strong>
        </div>
        <p class="muted ai-runtime-diagnostic__hero-detail">{{ headline.detail }}</p>
        <p
          v-if="submitGate && submitGate.allowed === false"
          class="alert alert--warn ai-runtime-diagnostic__gate-hint"
        >
          当前拒接新 LLM 请求：{{ submitGate.status || "未知原因" }}
        </p>
        <p v-if="runtimeOverview?.health?.url" class="muted ai-runtime-diagnostic__hero-url">
          <span>服务节点：{{ runtimeOverview.health.url }}</span>
          <span v-if="runtimeOverview.health.status_code != null" class="ai-runtime-diagnostic__hero-code">
            · HTTP {{ runtimeOverview.health.status_code }}
          </span>
        </p>
      </div>
    </UiCard>

    <UiCard
      v-if="!embedded && focusItems.length"
      class="ai-runtime-diagnostic__focus-card"
    >
      <div class="ai-head">
        <ConsoleNavIcon name="alert" class="ai-head__icon" />
        <h3 class="ai-head__title">网关连通性异常</h3>
      </div>
      <div class="ai-rows">
        <div
          v-for="item in focusItems"
          :key="item.capabilityId"
          class="ai-runtime-diagnostic__focus"
        >
          <div class="ai-runtime-diagnostic__focus-head">
            <span class="ai-dot" :class="dotClass(item.state)" />
            <strong>{{ item.title }}</strong>
          </div>
          <p class="ai-runtime-diagnostic__focus-desc">{{ item.description }}</p>
        </div>
      </div>
    </UiCard>

    <UiCard class="ai-runtime-diagnostic__table-card">
      <div class="ai-head">
        <ConsoleNavIcon name="activity" class="ai-head__icon" />
        <h3 class="ai-head__title">核心能力健康状态</h3>
      </div>
      <div v-if="rows.length" class="ai-runtime-diagnostic__table-wrap">
        <table class="ai-runtime-diagnostic__table">
          <thead>
            <tr>
              <th>能力项</th>
              <th>健康度</th>
              <th>熔断状态</th>
              <th>降级状态</th>
              <th>详细信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td data-label="能力项">
                <strong>{{ row.title }}</strong>
                <span class="muted ai-runtime-diagnostic__row-id">{{ row.id }}</span>
              </td>
              <td data-label="健康度">
                <span class="ai-runtime-diagnostic__pill" :class="`ai-runtime-diagnostic__pill--${healthTone(row.healthStateRaw)}`">
                  {{ row.healthState }}
                </span>
              </td>
              <td data-label="熔断状态">
                <span class="ai-runtime-diagnostic__pill" :class="`ai-runtime-diagnostic__pill--${circuitTone(row.circuitStateRaw)}`">
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

    <UiCard v-if="taskRoutingRows.length" class="ai-runtime-diagnostic__routing-card">
      <div class="ai-head">
        <ConsoleNavIcon name="blocks" class="ai-head__icon" />
        <h3 class="ai-head__title">模型任务路由与降级链</h3>
      </div>
      <div class="ai-runtime-diagnostic__table-wrap">
        <table class="ai-runtime-diagnostic__table">
          <thead>
            <tr>
              <th>任务场景</th>
              <th>主用模型</th>
              <th>备选模型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in taskRoutingRows" :key="row.task">
              <td data-label="任务场景">
                <strong>{{ row.label }}</strong>
                <span class="muted ai-runtime-diagnostic__row-id">{{ row.task }}</span>
              </td>
              <td data-label="主用模型"><code>{{ row.primaryDisplay }}</code></td>
              <td data-label="备选模型" class="muted">
                <span v-if="row.fallbacks.length" class="ai-runtime-diagnostic__fallback-chain">
                  {{ row.fallbacks.join(" → ") }}
                </span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UiCard>
  </section>
</template>

<style scoped>
.ai-runtime-diagnostic {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ai-runtime-diagnostic__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-runtime-diagnostic__title {
  margin: 0 0 4px;
  font-size: 1.125rem;
}

.ai-runtime-diagnostic__lead {
  margin: 0;
  font-size: 0.875rem;
}

.ai-runtime-diagnostic__top-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.ai-runtime-diagnostic__metric-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border-radius: 12px;
}

.ai-runtime-diagnostic__metric-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-runtime-diagnostic__metric-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.ai-runtime-diagnostic__hero,
.ai-runtime-diagnostic__table-card,
.ai-runtime-diagnostic__routing-card,
.ai-runtime-diagnostic__focus-card {
  padding: 20px;
}

.ai-runtime-diagnostic__hero-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.ai-runtime-diagnostic__hero-title {
  font-weight: 700;
}

.ai-runtime-diagnostic__hero-detail {
  margin: 0 0 12px;
  line-height: 1.6;
}

.ai-runtime-diagnostic__hero-url {
  margin: 0;
  font-size: 0.8125rem;
}

.ai-runtime-diagnostic__hero-code {
  margin-left: 6px;
  font-weight: 600;
}

.ai-runtime-diagnostic__gate-hint {
  margin: 0 0 12px;
}

.ai-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 0 14px;
}

.ai-head__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.ai-runtime-diagnostic__table-wrap {
  overflow-x: auto;
}

.ai-runtime-diagnostic__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.ai-runtime-diagnostic__table th,
.ai-runtime-diagnostic__table td {
  padding: 12px 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  text-align: left;
  vertical-align: top;
}

.ai-runtime-diagnostic__table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.8125rem;
}

.ai-runtime-diagnostic__row-id {
  display: block;
  font-size: 0.75rem;
  margin-top: 4px;
  font-family: var(--font-mono);
}

.ai-runtime-diagnostic__pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.ai-runtime-diagnostic__pill--ok {
  background: color-mix(in srgb, var(--ok, #16a34a) 12%, transparent);
  color: var(--ok, #16a34a);
}

.ai-runtime-diagnostic__pill--warn {
  background: color-mix(in srgb, var(--warn, #d97706) 12%, transparent);
  color: var(--warn, #d97706);
}

.ai-runtime-diagnostic__pill--danger {
  background: color-mix(in srgb, var(--danger, #dc2626) 12%, transparent);
  color: var(--danger, #dc2626);
}

.ai-runtime-diagnostic__pill--muted {
  background: color-mix(in srgb, var(--text) 6%, transparent);
  color: var(--text-muted);
}

.ai-runtime-diagnostic__fallback-chain {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.ai-runtime-diagnostic__focus {
  padding: 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
}

.ai-runtime-diagnostic__focus-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-runtime-diagnostic__focus-desc {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

@media (max-width: 560px) {
  .ai-runtime-diagnostic__top-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ai-runtime-diagnostic__table thead {
    display: none;
  }

  .ai-runtime-diagnostic__table tr {
    display: grid;
    gap: 8px;
    padding: 12px 0;
  }

  .ai-runtime-diagnostic__table td {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr);
    gap: 10px;
    padding: 0;
    border: 0;
  }

  .ai-runtime-diagnostic__table td::before {
    content: attr(data-label);
    color: var(--text-muted);
    font-weight: 500;
    font-size: 0.8125rem;
  }
}
</style>
