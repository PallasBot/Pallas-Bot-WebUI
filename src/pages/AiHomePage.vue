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
  refresh,
} = useAiRuntimeSnapshot();

const dotClass = runtimeStateDotClass;

function stateLabel(state: AiRuntimeState): string {
  if (state === "healthy") return "正常运行";
  if (state === "degraded") return "存在降级";
  if (state === "disabled") return "未启用";
  return "待确认";
}

const routeRows = computed(() =>
  Object.entries(llmRuntimeSummary.value.routeCounts ?? {})
    .map(([key, count]) => ({ key, count: Number(count) || 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, AI_STATS_LIMITS.topRoutes),
);

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="console-hub-page ai-surface ai-home-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        AI 首页
      </template>
      <template #lead>
        AI 能力的运行总览：先看整体是否健康、有没有需要处理的降级项，再看 LLM 调用走向，最后进入统计或配置。
      </template>
      <template #actions>
        <UiButton variant="primary" :busy="loading" @click="refresh">
          刷新状态
        </UiButton>
        <UiButton variant="ghost" href="/ai/statistics">查看统计</UiButton>
        <UiButton variant="ghost" href="/ai/config/model">进入配置</UiButton>
      </template>
    </ConsoleHubMasthead>

    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <UiCard class="ai-home-page__hero">
      <div class="ai-home-page__hero-head">
        <div class="ai-home-page__hero-state">
          <span class="ai-dot" :class="dotClass(overview.state)" />
          <span class="ai-home-page__hero-state-text">{{ stateLabel(overview.state) }}</span>
        </div>
        <h3 class="ai-home-page__hero-title">{{ overview.title }}</h3>
        <p class="muted ai-home-page__hero-lead">{{ overview.lead }}</p>
      </div>
      <div class="ai-stat-grid ai-home-page__hero-stats">
        <div class="ai-stat">
          <span class="ai-stat__label">正常能力</span>
          <strong class="ai-stat__value ai-stat__value--accent">{{ overview.healthyCount }}</strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">降级能力</span>
          <strong class="ai-stat__value" :class="{ 'ai-stat__value--warn': overview.degradedCount > 0 }">{{ overview.degradedCount }}</strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">未启用</span>
          <strong class="ai-stat__value">{{ overview.disabledCount }}</strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">媒体任务排队</span>
          <strong class="ai-stat__value">{{ mediaTaskQueue?.queue_depth ?? 0 }}</strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">LLM 失败</span>
          <strong class="ai-stat__value" :class="{ 'ai-stat__value--danger': llmRuntimeSummary.failed > 0 }">{{ llmRuntimeSummary.failed }}</strong>
        </div>
        <div class="ai-stat">
          <span class="ai-stat__label">配置回退策略</span>
          <strong class="ai-stat__value">{{ overview.fallbackCount }}</strong>
        </div>
      </div>
    </UiCard>

    <section class="ai-home-page__grid">
      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">需要处理</h3>
          <span class="ai-head__hint">降级或未启用的能力优先列在这里</span>
        </div>
        <div v-if="focusItems.length" class="ai-rows">
          <article
            v-for="item in focusItems"
            :key="item.capabilityId"
            class="ai-home-page__focus"
          >
            <div class="ai-home-page__focus-head">
              <span class="ai-dot" :class="dotClass(item.state)" />
              <strong>{{ item.title }}</strong>
              <span class="muted ai-home-page__focus-tag">{{ item.state === "degraded" ? "降级" : item.state === "disabled" ? "未启用" : "正常" }}</span>
            </div>
            <p class="muted ai-home-page__focus-desc">{{ item.description }}</p>
          </article>
        </div>
        <div v-else class="ai-empty">
          <span>一切正常</span>
          <span class="ai-empty__hint">当前没有需要立即处理的能力。</span>
        </div>
      </UiCard>

      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">LLM 调用</h3>
          <span class="ai-head__hint">本时间窗内的任务状态与回复路径</span>
        </div>
        <div class="ai-stat-grid ai-home-page__mini" style="--ai-stat-cols: 4">
          <div class="ai-stat">
            <span class="ai-stat__label">排队</span>
            <strong class="ai-stat__value">{{ llmRuntimeSummary.queued }}</strong>
          </div>
          <div class="ai-stat">
            <span class="ai-stat__label">执行中</span>
            <strong class="ai-stat__value">{{ llmRuntimeSummary.running }}</strong>
          </div>
          <div class="ai-stat">
            <span class="ai-stat__label">成功</span>
            <strong class="ai-stat__value ai-stat__value--accent">{{ llmRuntimeSummary.succeeded }}</strong>
          </div>
          <div class="ai-stat">
            <span class="ai-stat__label">失败</span>
            <strong class="ai-stat__value" :class="{ 'ai-stat__value--danger': llmRuntimeSummary.failed > 0 }">{{ llmRuntimeSummary.failed }}</strong>
          </div>
        </div>
        <div v-if="routeRows.length" class="ai-rows ai-home-page__routes">
          <div v-for="row in routeRows" :key="row.key" class="ai-row">
            <span class="ai-row__key">{{ row.key }}</span>
            <strong class="ai-row__val">{{ row.count.toLocaleString() }}</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span>暂无调用记录</span>
          <span class="ai-empty__hint">这段时间还没有产生 LLM 回复路径数据。</span>
        </div>
      </UiCard>
    </section>

    <section class="ai-home-page__grid">
      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">能力分组</h3>
          <span class="ai-head__hint">概览摘要，详细开关在「AI 配置」</span>
        </div>
        <div class="ai-rows">
          <article
            v-for="group in groups"
            :key="group.id"
            class="ai-row ai-home-page__group"
          >
            <span class="ai-row__key ai-home-page__group-title">
              <ConsoleNavIcon :name="group.icon" />
              <strong>{{ group.title }}</strong>
            </span>
            <span class="ai-row__val muted">{{ group.total }} 项</span>
          </article>
        </div>
      </UiCard>

      <UiCard class="ai-home-page__panel">
        <div class="ai-head">
          <h3 class="ai-head__title">扩展侧状态</h3>
          <span class="ai-head__hint">Provider 健康与媒体任务队列</span>
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
            <span class="ai-row__key">Provider · {{ provider.id }}</span>
            <strong class="ai-row__val">{{ provider.health_state || (provider.reachable ? "healthy" : "unknown") }}</strong>
          </div>
          <div
            v-for="cap in mediaTaskCapabilities"
            :key="cap.capability"
            class="ai-row"
          >
            <span class="ai-row__key">媒体 · {{ cap.capability }}</span>
            <strong class="ai-row__val">队列 {{ cap.queue_depth }} / 执行 {{ cap.active_tasks }}</strong>
          </div>
        </div>
        <div v-else class="ai-empty">
          <span>暂无扩展状态</span>
          <span class="ai-empty__hint">连接到 Pallas-Bot-AI 后会显示 Provider 与任务队列。</span>
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.ai-home-page__hero-head {
  margin-bottom: 18px;
}

.ai-home-page__hero-state {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-muted);
}

.ai-home-page__hero-title {
  margin: 10px 0 6px;
  font-size: clamp(1.25rem, 2vw, 1.625rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.ai-home-page__hero-lead {
  margin: 0;
  max-width: 52rem;
  line-height: 1.6;
}

.ai-home-page__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.ai-home-page__panel {
  height: 100%;
}

.ai-home-page__mini {
  margin-bottom: 14px;
}

.ai-home-page__focus {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 2.5%, transparent);
}

.ai-home-page__focus-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-home-page__focus-tag {
  font-size: 0.75rem;
}

.ai-home-page__focus-desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ai-home-page__group-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: normal;
}

@media (max-width: 960px) {
  .ai-home-page__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
