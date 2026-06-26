<script setup lang="ts">
import { computed, onMounted } from "vue";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useAiRuntimeSnapshot } from "@/composables/useAiRuntimeSnapshot";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { runtimeStateDotClass } from "@/utils/aiRuntimeState";
import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";
import { AI_STATS_LIMITS } from "@/config/aiConstants";
import { AI_CONFIG_LAYER_LINKS, AI_ENTRY_SITE_GATEWAY_CHECK } from "@/config/aiEntrySemantics";
import type { AiRuntimeSnapshotItem } from "@/utils/aiRuntimeTypes";

const panelNavIcon = usePanelNavIcon();
const {
  loading,
  err,
  groups,
  overview,
  focusItems,
  mediaTaskQueue,
  mediaTaskCapabilities,
  llmProviderStatus,
  llmRuntimeSummary,
  runtimeOverview,
  wizardStatus,
  refresh,
} = useAiRuntimeSnapshot();

const dotClass = runtimeStateDotClass;

function stateLabel(state: AiRuntimeState): string {
  if (state === "healthy") return "运行良好";
  if (state === "degraded") return "部分降级";
  if (state === "disabled") return "暂未启用";
  return "状态未知";
}

const routeRows = computed(() =>
  Object.entries(llmRuntimeSummary.value.routeCounts ?? {})
    .map(([key, count]) => ({ key, count: Number(count) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, AI_STATS_LIMITS.topRoutes),
);

const homeHeroStats = computed(() => [
  {
    label: "正常模块",
    value: overview.value.healthyCount,
    accent: true,
  },
  {
    label: "降级模块",
    value: overview.value.degradedCount,
    tone: overview.value.degradedCount > 0 ? "warn" : undefined,
  },
  {
    label: "未启用",
    value: overview.value.disabledCount,
  },
  {
    label: "配置回退",
    value: overview.value.fallbackCount,
  },
  {
    label: "大模型失败",
    value: llmRuntimeSummary.value.failed,
    tone: llmRuntimeSummary.value.failed > 0 ? "danger" : undefined,
  },
  {
    label: "排队中任务",
    value: mediaTaskQueue.value?.queue_depth ?? 0,
  },
]);

const wizardAlert = computed(() => {
  const status = wizardStatus.value;
  if (!status) return "";
  if (status.next_step) return `体检建议：${status.next_step}`;
  if (!status.ai_reachable) return "服务断开连接，请检查扩展连接与地址配置。";
  return "";
});

const runtimeHealthSummary = computed(() => {
  const health = runtimeOverview.value?.health;
  if (!health) return "";
  if (!health.ok) return health.error || "大模型后端当前不可达";
  return health.llm_runtime_detail || "大模型后端连接正常";
});

function primaryNavigateAction(item: AiRuntimeSnapshotItem) {
  return item.actions.find((action) => action.kind === "navigate" && action.to) ?? null;
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="console-hub-page ai-surface ai-home-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 运行总览
      </template>
      <template #actions>
        <RouterLink :to="AI_CONFIG_LAYER_LINKS.runtime.path">
          <UiButton variant="primary">管理配置</UiButton>
        </RouterLink>
        <RouterLink :to="AI_ENTRY_SITE_GATEWAY_CHECK.path">
          <UiButton variant="outline">{{ AI_ENTRY_SITE_GATEWAY_CHECK.label }}</UiButton>
        </RouterLink>
        <UiButton variant="ghost" :busy="loading" @click="refresh">
          刷新数据
        </UiButton>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>
    <div v-else-if="wizardAlert" class="alert alert--warn ai-home-page__wizard-alert">
      <span>{{ wizardAlert }}</span>
      <RouterLink to="/ai/wizard">
        <UiButton variant="ghost" size="sm">打开体检向导</UiButton>
      </RouterLink>
    </div>

    <!-- 顶部数据卡片行 (gsuid_hub 风格 Metric Cards) -->
    <div class="ai-home-page__top-metrics">
      <div
        v-for="item in homeHeroStats"
        :key="item.label"
        class="ai-home-page__metric-card"
      >
        <span class="ai-home-page__metric-label">{{ item.label }}</span>
        <strong
          class="ai-home-page__metric-value"
          :class="{
            'text-ok': item.accent,
            'text-warn': item.tone === 'warn',
            'text-danger': item.tone === 'danger',
          }"
        >
          {{ item.value }}
        </strong>
      </div>
    </div>

    <!-- 运行状态横幅 -->
    <UiCard class="ai-home-page__hero">
      <div class="ai-home-page__hero-head">
        <div class="ai-home-page__hero-copy">
          <div class="ai-home-page__hero-state">
            <span class="ai-dot" :class="dotClass(overview.state)" />
            <span class="ai-home-page__hero-state-text">{{ stateLabel(overview.state) }}</span>
          </div>
          <h3 class="ai-home-page__hero-title">{{ overview.title }}</h3>
          <p v-if="runtimeHealthSummary" class="muted ai-home-page__hero-runtime">{{ runtimeHealthSummary }}</p>
        </div>
        <div class="ai-home-page__hero-actions">
          <RouterLink to="/ai/runtime" class="ai-home-page__hero-btn">
            进入诊断中心
          </RouterLink>
        </div>
      </div>
    </UiCard>

    <section class="ai-home-page__grid">
      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <ConsoleNavIcon name="alert" class="ai-head__icon" />
          <h3 class="ai-head__title">需要关注</h3>
        </div>
        <div v-if="focusItems.length" class="ai-rows">
          <div
            v-for="item in focusItems"
            :key="item.capabilityId"
            class="ai-home-page__focus"
          >
            <div class="ai-home-page__focus-head">
              <span class="ai-dot" :class="dotClass(item.state)" />
              <strong>{{ item.title }}</strong>
              <span class="muted ai-home-page__focus-tag">
                {{ item.state === "degraded" ? "已降级" : item.state === "disabled" ? "未启用" : "正常" }}
              </span>
            </div>
            <p class="ai-home-page__focus-desc">{{ item.description }}</p>
            <div v-if="primaryNavigateAction(item)" class="ai-home-page__focus-actions">
              <RouterLink :to="primaryNavigateAction(item)?.to || '/ai/home'" class="ai-head__link">
                {{ primaryNavigateAction(item)?.label || "前往处理" }} &rarr;
              </RouterLink>
            </div>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">状态良好</span>
          <span class="ai-empty__hint">当前没有需要紧急处理的降级或异常情况。</span>
        </div>
      </UiCard>

      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <ConsoleNavIcon name="activity" class="ai-head__icon" />
          <h3 class="ai-head__title">近期调用动态</h3>
          <RouterLink to="/ai/statistics" class="ai-head__link">详细统计 &rarr;</RouterLink>
        </div>
        <div class="ai-home-page__runtime-grid">
          <div class="ai-home-page__runtime-stat">
            <span class="ai-home-page__metric-label">等待中</span>
            <strong class="ai-home-page__metric-value">{{ llmRuntimeSummary.queued }}</strong>
          </div>
          <div class="ai-home-page__runtime-stat">
            <span class="ai-home-page__metric-label">处理中</span>
            <strong class="ai-home-page__metric-value">{{ llmRuntimeSummary.running }}</strong>
          </div>
          <div class="ai-home-page__runtime-stat">
            <span class="ai-home-page__metric-label">请求成功</span>
            <strong class="ai-home-page__metric-value text-ok">{{ llmRuntimeSummary.succeeded }}</strong>
          </div>
          <div class="ai-home-page__runtime-stat">
            <span class="ai-home-page__metric-label">请求失败</span>
            <strong class="ai-home-page__metric-value" :class="{ 'text-danger': llmRuntimeSummary.failed > 0 }">{{ llmRuntimeSummary.failed }}</strong>
          </div>
        </div>
        <div v-if="routeRows.length" class="ai-rows ai-home-page__routes">
          <div v-for="row in routeRows" :key="row.key" class="ai-row">
            <span class="ai-row__key">{{ row.key }}</span>
            <strong class="ai-row__val">{{ row.count.toLocaleString() }} 次</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">暂无数据</span>
          <span class="ai-empty__hint">当前统计窗口内还没有大模型的调用记录。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-home-page__grid">
      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <ConsoleNavIcon name="blocks" class="ai-head__icon" />
          <h3 class="ai-head__title">能力模块视图</h3>
        </div>
        <div class="ai-rows">
          <div
            v-for="group in groups"
            :key="group.id"
            class="ai-home-page__group"
          >
            <span class="ai-home-page__group-title">
              <ConsoleNavIcon :name="group.icon" />
              <strong>{{ group.title }}</strong>
            </span>
            <span class="ai-row__val muted">{{ group.total }} 项</span>
          </div>
        </div>
      </UiCard>

      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <ConsoleNavIcon name="radio" class="ai-head__icon" />
          <h3 class="ai-head__title">服务连通与队列</h3>
        </div>
        <div
          v-if="llmProviderStatus.length || mediaTaskCapabilities.length"
          class="ai-rows"
        >
          <div
            v-for="provider in llmProviderStatus"
            :key="provider.id"
            class="ai-row"
          >
            <span class="ai-row__key">{{ provider.id }} (Provider)</span>
            <strong class="ai-row__val">{{ provider.health_state || (provider.reachable ? "在线" : "未知") }}</strong>
          </div>
          <div
            v-for="cap in mediaTaskCapabilities"
            :key="cap.capability"
            class="ai-row"
          >
            <span class="ai-row__key">{{ cap.capability }} (多媒体)</span>
            <strong class="ai-row__val">{{ cap.queue_depth }} 排队 / {{ cap.active_tasks }} 运行</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">暂无外部服务状态</span>
          <span class="ai-empty__hint">您可能还未连接独立的 Pallas-Bot-AI 扩展节点。</span>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.ai-home-page__top-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.ai-home-page__metric-card {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-home-page__metric-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-home-page__metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.ai-home-page__hero {
  display: grid;
  gap: 20px;
  padding: 24px;
  margin-bottom: 24px;
}

.ai-home-page__hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.ai-home-page__hero-copy {
  min-width: 0;
  flex: 1;
}

.ai-home-page__hero-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-muted);
  padding: 6px 12px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  border-radius: 8px;
  margin-bottom: 12px;
}

.ai-home-page__hero-title {
  margin: 0 0 8px;
  font-size: clamp(1.5rem, 2.5vw, 1.875rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.ai-home-page__hero-runtime {
  margin: 12px 0 0;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-home-page__hero-actions {
  flex-shrink: 0;
}

.ai-home-page__hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 25%, transparent);
  transition: transform 0.15s, box-shadow 0.15s;
}

.ai-home-page__hero-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--brand) 30%, transparent);
}

.ai-home-page__wizard-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.ai-home-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

.ai-home-page__panel {
  height: 100%;
  min-width: 0;
  padding: 24px;
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  border: none;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.ai-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.ai-head__icon {
  color: var(--text-muted);
}

.ai-head__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}

.ai-head__link {
  margin-left: auto;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--brand);
  text-decoration: none;
}

.ai-head__link:hover {
  text-decoration: underline;
}

.ai-home-page__runtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.ai-home-page__runtime-stat {
  min-width: 0;
  padding: 16px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-home-page__routes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-home-page__routes .ai-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--text) 1.5%, transparent);
  border-radius: 8px;
}

.ai-home-page__routes .ai-row__key {
  min-width: 0;
  word-break: break-word;
  font-weight: 500;
}

.ai-home-page__focus {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
  border-radius: 12px;
  margin-bottom: 12px;
}

.ai-home-page__focus:last-child {
  margin-bottom: 0;
}

.ai-home-page__focus-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-home-page__focus-tag {
  margin-left: auto;
  font-size: 0.75rem;
  padding: 2px 8px;
  background: color-mix(in srgb, var(--text-muted) 15%, transparent);
  border-radius: 6px;
}

.ai-home-page__focus-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.ai-home-page__focus-actions {
  margin-top: 8px;
}

.ai-home-page__group {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: color-mix(in srgb, var(--text) 1.5%, transparent);
  border-radius: 8px;
  margin-bottom: 8px;
}

.ai-home-page__group:last-child {
  margin-bottom: 0;
}

.ai-home-page__group-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.ai-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: color-mix(in srgb, var(--text) 1.5%, transparent);
  border-radius: 8px;
}

.ai-row__key {
  font-weight: 500;
}

.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
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

@media (max-width: 960px) {
  .ai-home-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-home-page__hero-head {
    flex-direction: column;
    gap: 16px;
  }
}

@media (max-width: 560px) {
  .ai-home-page__wizard-alert {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-home-page__runtime-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  
  .ai-home-page__hero-actions {
    width: 100%;
  }

  .ai-home-page__hero-btn {
    width: 100%;
  }
}
</style>
