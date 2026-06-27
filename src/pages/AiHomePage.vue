<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import AiRuntimeDiagnosticPanel from "@/components/ai-config/AiRuntimeDiagnosticPanel.vue";
import AiConfigHealthFlow from "@/components/ai-config/AiConfigHealthFlow.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";
import { useAiRuntimeSnapshot } from "@/composables/useAiRuntimeSnapshot";
import { runtimeStateDotClass } from "@/utils/aiRuntimeState";
import type { AiRuntimeSnapshotItem } from "@/utils/aiRuntimeTypes";

const route = useRoute();
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

const overviewStats = computed(() => [
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
    label: "大模型失败",
    value: llmRuntimeSummary.value.failed,
    tone: llmRuntimeSummary.value.failed > 0 ? "danger" : undefined,
  },
  {
    label: "排队任务",
    value: mediaTaskQueue.value?.queue_depth ?? llmRuntimeSummary.value.queued,
  },
]);

const wizardAlert = computed(() => {
  const status = wizardStatus.value;
  if (!status) return "";
  if (status.next_step) return `体检建议：${status.next_step}`;
  if (!status.ai_reachable) return "扩展服务不可达，请检查「AI 配置 → 扩展连接」。";
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

function scrollToRuntimeDiagnostic() {
  document.getElementById("runtime-diagnostic")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

watch(
  () => route.query.panel,
  (panel) => {
    if (String(panel ?? "").trim() === "runtime") {
      void nextTick(() => scrollToRuntimeDiagnostic());
    }
  },
  { immediate: true },
);

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="ai-home-page">
    <div class="ai-hub-toolbar">
      <UiButton
        variant="ghost"
        size="sm"
        :busy="loading"
        @click="refresh"
      >
        刷新
      </UiButton>
    </div>

    <div v-if="err" class="alert alert--err">{{ err }}</div>
    <AiConfigHealthFlow />
    <div v-if="!err && wizardAlert" class="alert alert--warn ai-home-page__wizard-alert">
      <span>{{ wizardAlert }}</span>
      <RouterLink to="/ai/wizard">
        <UiButton variant="ghost" size="sm">打开体检向导</UiButton>
      </RouterLink>
    </div>

    <UiCard
      glass
      class="ai-hub-panel ai-home-page__hero-compact"
    >
      <div class="ai-home-page__hero-head">
        <div class="ai-home-page__hero-copy">
          <div class="ai-home-page__hero-state">
            <span class="ai-dot" :class="dotClass(overview.state)" />
            <span class="ai-home-page__hero-state-text">{{ stateLabel(overview.state) }}</span>
          </div>
          <h2 class="ai-home-page__hero-title">{{ overview.title }}</h2>
          <p v-if="runtimeHealthSummary" class="muted ai-home-page__hero-runtime">{{ runtimeHealthSummary }}</p>
        </div>
        <button
          type="button"
          class="ai-home-page__hero-btn"
          @click="scrollToRuntimeDiagnostic"
        >
          Runtime 诊断
        </button>
      </div>
      <div
        class="ai-stat-grid ai-home-page__kpi"
        style="--ai-stat-cols: 4"
      >
        <div
          v-for="item in overviewStats"
          :key="item.label"
          class="ai-stat"
        >
          <span class="ai-stat__label">{{ item.label }}</span>
          <strong
            class="ai-stat__value"
            :class="{
              'ai-stat__value--accent': item.accent,
              'text-warn': item.tone === 'warn',
              'text-danger': item.tone === 'danger',
            }"
          >
            {{ item.value }}
          </strong>
        </div>
      </div>
    </UiCard>

    <section class="ai-home-page__grid">
      <UiCard
        glass
        class="ai-hub-panel ai-home-page__panel"
      >
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
              <RouterLink :to="primaryNavigateAction(item)?.to || '/ai/config/connection'" class="ai-head__link">
                {{ primaryNavigateAction(item)?.label || "前往处理" }} &rarr;
              </RouterLink>
            </div>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span class="ai-empty__title">状态良好</span>
          <span class="ai-empty__hint">当前没有需要紧急处理的降级或异常。</span>
        </div>
      </UiCard>

      <UiCard
        glass
        class="ai-hub-panel ai-home-page__panel"
      >
        <div class="ai-head">
          <ConsoleNavIcon name="blocks" class="ai-head__icon" />
          <h3 class="ai-head__title">模块与连通</h3>
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
          <div
            v-for="provider in llmProviderStatus"
            :key="provider.id"
            class="ai-row"
          >
            <span class="ai-row__key">{{ provider.id }}</span>
            <strong class="ai-row__val">{{ provider.health_state || (provider.reachable ? "在线" : "未知") }}</strong>
          </div>
          <div
            v-for="cap in mediaTaskCapabilities"
            :key="cap.capability"
            class="ai-row"
          >
            <span class="ai-row__key">{{ cap.capability }}</span>
            <strong class="ai-row__val">{{ cap.queue_depth }} 排队 · {{ cap.active_tasks }} 运行</strong>
          </div>
        </div>
        <div
          v-if="!groups.some((g) => g.total) && !llmProviderStatus.length && !mediaTaskCapabilities.length"
          class="ai-empty"
        >
          <span class="ai-empty__title">暂无运行态数据</span>
          <span class="ai-empty__hint">完成扩展连接配置后刷新本页。</span>
        </div>
      </UiCard>
    </section>

    <AiRuntimeDiagnosticPanel
      id="runtime-diagnostic"
      embedded
      :loading="loading"
      :err="err"
      :focus-items="focusItems"
      :llm-runtime-summary="llmRuntimeSummary"
      :runtime-overview="runtimeOverview"
      @refresh="refresh"
    />
  </div>
</template>

<style scoped>
.ai-home-page {
  display: flex;
  flex-direction: column;
  gap: var(--hub-page-gap, 18px);
}

.ai-home-page .ai-hub-toolbar {
  justify-content: flex-end;
}

.ai-home-page__hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
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
}

.ai-home-page__hero-runtime {
  margin: 8px 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.ai-home-page__hero-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 16px;
  border: none;
  cursor: pointer;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
}

.ai-home-page__hero-btn:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.ai-home-page__kpi {
  margin-top: 4px;
}

.ai-home-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--hub-page-gap, 18px);
}

.ai-home-page__panel :deep(.ui-card__content) {
  padding: 18px 20px 20px;
}

.ai-home-page__focus {
  padding: 12px 14px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
}

.ai-home-page__focus-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ai-home-page__focus-desc {
  margin: 8px 0 0;
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.ai-home-page__group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
}

.ai-home-page__group:last-child {
  border-bottom: none;
}

.ai-home-page__group-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-home-page__wizard-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 860px) {
  .ai-home-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-home-page__kpi {
    --ai-stat-cols: 2;
  }
}

@media (max-width: 560px) {
  .ai-home-page__hero-head {
    flex-direction: column;
  }

  .ai-home-page__hero-btn {
    width: 100%;
  }
}
</style>
