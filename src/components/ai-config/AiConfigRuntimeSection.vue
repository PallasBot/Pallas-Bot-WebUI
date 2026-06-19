<script setup lang="ts">
import { onMounted } from "vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useAiRuntimeSnapshot } from "@/composables/useAiRuntimeSnapshot";
import type { AiRuntimeState } from "@/config/aiRuntimeRegistry";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import type { AiRuntimeSnapshotItem } from "@/utils/aiRuntimeTypes";

const panelNavIcon = usePanelNavIcon();
const { loading, err, groups, overview, focusItems, quickActions, pageActions, mediaTaskQueue, mediaTaskCapabilities, llmProviderStatus, llmRuntimeSummary, ttsHealth, refresh } = useAiRuntimeSnapshot();

function stateClass(state: AiRuntimeState): string {
  if (state === "healthy") return "tag--ok";
  if (state === "degraded") return "tag--warn";
  return "tag--muted";
}

function itemKey(item: AiRuntimeSnapshotItem): string {
  return item.capabilityId;
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel ai-runtime-console"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />AI 控制台首页
      </h2>
      <div class="row-actions ai-runtime-console__action-strip">
        <UiButton
          v-for="action in pageActions"
          :key="action.id"
          :variant="action.kind === 'refresh' ? 'primary' : 'ghost'"
          :busy="action.kind === 'refresh' ? loading : false"
          :href="action.kind === 'navigate' ? action.to : null"
          @click="action.kind === 'refresh' ? refresh() : undefined"
        >
          {{ action.label }}
        </UiButton>
      </div>
    </div>
    <div class="panel__bd">
      <p class="muted ai-config-section__intro">
        基于统一 capability registry 与 runtime snapshot 展示 AI 扩展、对话、媒体、自动化能力的当前运行态。
      </p>

      <div
        v-if="err"
        class="alert alert--err ai-runtime-console__alert"
      >
        {{ err }}
      </div>

      <section class="ai-runtime-console__hero">
        <div class="ai-runtime-console__hero-main">
          <div class="ai-runtime-console__hero-eyebrow">Unified AI Runtime</div>
          <h3 class="ai-runtime-console__hero-title">{{ overview.title }}</h3>
          <p class="muted ai-runtime-console__hero-lead">{{ overview.lead }}</p>
        </div>
        <span
          class="tag ai-runtime-console__hero-badge"
          :class="stateClass(overview.state)"
        >
          {{ overview.total ? overview.title.replace(/^AI 运行时|AI 运行中|当前 /, "").slice(0, 6) || "状态" : "待确认" }}
        </span>
      </section>

      <div class="ai-runtime-console__summary">
        <div class="ai-runtime-console__stat">
          <span class="ai-runtime-console__stat-label">异常能力</span>
          <strong class="ai-runtime-console__stat-value">{{ overview.degradedCount }}</strong>
        </div>
        <div class="ai-runtime-console__stat">
          <span class="ai-runtime-console__stat-label">未启用</span>
          <strong class="ai-runtime-console__stat-value">{{ overview.disabledCount }}</strong>
        </div>
        <div class="ai-runtime-console__stat">
          <span class="ai-runtime-console__stat-label">正常能力</span>
          <strong class="ai-runtime-console__stat-value">{{ overview.healthyCount }}</strong>
        </div>
        <div class="ai-runtime-console__stat">
          <span class="ai-runtime-console__stat-label">含回退策略</span>
          <strong class="ai-runtime-console__stat-value">{{ overview.fallbackCount }}</strong>
        </div>
        <div
          v-if="mediaTaskQueue"
          class="ai-runtime-console__stat"
        >
          <span class="ai-runtime-console__stat-label">媒体任务队列</span>
          <strong class="ai-runtime-console__stat-value">
            {{ mediaTaskQueue.queue_depth }}
            <span
              v-if="mediaTaskQueue.active_tasks"
              class="muted ai-runtime-console__stat-sub"
            >/{{ mediaTaskQueue.active_tasks }} 执行</span>
          </strong>
        </div>
      </div>

      <div
        v-if="mediaTaskCapabilities.length"
        class="ai-runtime-console__cap-queue"
      >
        <span
          v-for="item in mediaTaskCapabilities"
          :key="item.capability"
          class="ai-runtime-console__cap-chip"
        >
          {{ item.capability }}
          <strong>{{ item.queue_depth }}/{{ item.active_tasks }}</strong>
        </span>
      </div>

      <div
        v-if="llmProviderStatus.length"
        class="ai-runtime-console__cap-queue"
      >
        <span
          v-for="item in llmProviderStatus"
          :key="item.id"
          class="ai-runtime-console__cap-chip"
        >
          LLM {{ item.id }}
          <strong>{{ item.health_state || (item.reachable ? "healthy" : "unknown") }}</strong>
        </span>
      </div>

      <section class="ai-runtime-console__llm-brief">
        <div class="ai-runtime-console__focus-head">
          <h3>LLM 运行态摘要</h3>
          <span class="muted">实时 task/provider 面板</span>
        </div>
        <div class="ai-runtime-console__llm-stats">
          <div class="ai-runtime-console__llm-stat">
            <span>排队</span>
            <strong>{{ llmRuntimeSummary.queued }}</strong>
          </div>
          <div class="ai-runtime-console__llm-stat">
            <span>执行中</span>
            <strong>{{ llmRuntimeSummary.running }}</strong>
          </div>
          <div class="ai-runtime-console__llm-stat">
            <span>成功</span>
            <strong>{{ llmRuntimeSummary.succeeded }}</strong>
          </div>
          <div class="ai-runtime-console__llm-stat">
            <span>失败</span>
            <strong>{{ llmRuntimeSummary.failed }}</strong>
          </div>
        </div>
        <div class="ai-runtime-console__llm-boards">
          <div class="ai-runtime-console__llm-mini">
            <div class="muted ai-runtime-console__llm-mini-title">热点 Provider</div>
            <div
              v-if="llmRuntimeSummary.providers.length"
              class="ai-runtime-console__llm-mini-list"
            >
              <div
                v-for="item in llmRuntimeSummary.providers"
                :key="item.key"
                class="ai-runtime-console__llm-mini-row"
              >
                <span>{{ item.key }}</span>
                <strong>{{ item.requests }}</strong>
              </div>
            </div>
            <p
              v-else
              class="muted ai-runtime-console__group-empty"
            >
              暂无 provider 请求统计。
            </p>
          </div>
          <div class="ai-runtime-console__llm-mini">
            <div class="muted ai-runtime-console__llm-mini-title">失败热点</div>
            <div
              v-if="llmRuntimeSummary.failures.length"
              class="ai-runtime-console__llm-mini-list"
            >
              <div
                v-for="item in llmRuntimeSummary.failures"
                :key="item.key"
                class="ai-runtime-console__llm-mini-row"
              >
                <span>{{ item.key }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
            <p
              v-else
              class="muted ai-runtime-console__group-empty"
            >
              当前没有失败分布。
            </p>
          </div>
        </div>
      </section>

      <div
        v-if="ttsHealth"
        class="ai-runtime-console__cap-queue"
      >
        <span class="ai-runtime-console__cap-chip">
          TTS
          <strong>{{ ttsHealth.health_state || "unknown" }}</strong>
          <span
            v-if="ttsHealth.celery_enabled === false"
            class="muted"
          >· worker 未注册</span>
        </span>
      </div>

      <div class="ai-runtime-console__content">
        <section class="ai-runtime-console__groups">
          <article
            v-for="group in groups"
            :key="group.id"
            class="ai-runtime-console__group-card"
          >
            <div class="ai-runtime-console__group-head">
              <div class="ai-runtime-console__group-title-wrap">
                <div class="ai-runtime-console__group-icon">
                  <ConsoleNavIcon :name="group.icon" />
                </div>
                <div>
                  <h3 class="ai-runtime-console__group-title">{{ group.title }}</h3>
                  <p class="muted ai-runtime-console__group-lead">{{ group.lead }}</p>
                </div>
              </div>
              <span
                class="tag"
                :class="stateClass(group.state)"
              >
                {{ group.state === "healthy" ? "正常" : group.state === "degraded" ? "降级" : group.state === "disabled" ? "未启用" : "待确认" }}
              </span>
            </div>

            <div class="ai-runtime-console__group-metrics">
              <span>{{ group.total }} 项能力</span>
              <span v-if="group.degradedCount">{{ group.degradedCount }} 项异常</span>
              <span v-if="group.disabledCount">{{ group.disabledCount }} 项未启用</span>
              <span v-if="group.fallbackCount">{{ group.fallbackCount }} 项回退中</span>
            </div>

            <div
              v-if="group.items.length"
              class="ai-runtime-console__item-list"
            >
              <div
                v-for="item in group.items"
                :key="itemKey(item)"
                class="ai-runtime-console__item"
              >
                <div class="ai-runtime-console__item-head">
                  <strong>{{ item.title }}</strong>
                  <span
                    class="tag"
                    :class="stateClass(item.state)"
                    :title="item.statusTitle"
                  >
                    {{ item.statusLabel }}
                  </span>
                </div>
                <div class="muted ai-runtime-console__item-detail">
                  {{ item.detail }}
                </div>
              </div>
            </div>
            <div
              v-else
              class="muted ai-runtime-console__group-empty"
            >
              当前没有接入该分组的运行态数据。
            </div>

            <div class="ai-runtime-console__group-actions">
              <template v-if="group.items[0]?.actions?.length">
                <UiButton
                  v-for="action in group.items[0].actions.filter((item) => item.surfaces.includes('card'))"
                  :key="action.id"
                  variant="ghost"
                  :href="action.to"
                >
                  {{ action.label }}
                </UiButton>
              </template>
            </div>
          </article>
        </section>

        <aside class="ai-runtime-console__aside">
          <section class="ai-runtime-console__focus-card">
            <div class="ai-runtime-console__focus-head">
              <h3>当前重点</h3>
              <span class="muted">按 capability snapshot 排序</span>
            </div>
            <div
              v-if="focusItems.length"
              class="ai-runtime-console__focus-list"
            >
              <div
                v-for="item in focusItems"
                :key="itemKey(item)"
                class="ai-runtime-console__focus-item"
              >
                <div class="ai-runtime-console__item-head">
                  <strong>{{ item.title }}</strong>
                  <span
                    class="tag"
                    :class="stateClass(item.state)"
                    :title="item.statusTitle"
                  >
                    {{ item.statusLabel }}
                  </span>
                </div>
                <div class="muted ai-runtime-console__item-detail">
                  {{ item.detail }}
                </div>
              </div>
            </div>
            <p
              v-else
              class="muted"
            >
              暂无重点项。
            </p>
          </section>

          <section class="ai-runtime-console__focus-card">
            <div class="ai-runtime-console__focus-head">
              <h3>动作流入口</h3>
              <span class="muted">按 capability action 展开</span>
            </div>
            <div class="ai-runtime-console__quick-links">
              <a
                v-for="action in quickActions"
                :key="action.id"
                class="ai-runtime-console__quick-link"
                :href="action.action.to"
              >
                <div>
                  <strong>{{ action.title }}</strong>
                  <div class="muted">{{ action.capabilityTitle }}</div>
                </div>
                <span
                  class="tag"
                  :class="stateClass(action.state)"
                >
                  {{ action.state === "healthy" ? "正常" : action.state === "degraded" ? "降级" : action.state === "disabled" ? "未启用" : "待确认" }}
                </span>
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.ai-runtime-console__alert {
  margin-bottom: 12px;
}

.ai-runtime-console__action-strip {
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.ai-runtime-console__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 18px 20px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--pri) 18%, transparent), transparent 44%),
    linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 88%, white 12%), var(--bg-card));
}

.ai-runtime-console__hero-eyebrow {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted, #94a3b8);
}

.ai-runtime-console__hero-title {
  margin: 6px 0 8px;
  font-size: 28px;
  line-height: 1.15;
}

.ai-runtime-console__hero-lead {
  margin: 0;
  max-width: 56ch;
  line-height: 1.7;
}

.ai-runtime-console__hero-badge {
  flex: none;
}

.ai-runtime-console__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.ai-runtime-console__stat {
  padding: 14px 16px;
  border-radius: 14px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 88%, white 12%), var(--bg-card));
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}

.ai-runtime-console__stat-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.ai-runtime-console__stat-value {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  line-height: 1;
}

.ai-runtime-console__cap-queue {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -6px 0 16px;
}

.ai-runtime-console__cap-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  background: color-mix(in srgb, var(--bg-card) 90%, white 10%);
}

.ai-runtime-console__cap-chip strong {
  font-size: 12px;
}

.ai-runtime-console__llm-brief {
  display: grid;
  gap: 12px;
  margin-bottom: 18px;
}

.ai-runtime-console__llm-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.ai-runtime-console__llm-stat,
.ai-runtime-console__llm-mini {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--bg-card) 88%, white 12%);
}

.ai-runtime-console__llm-stat {
  display: grid;
  gap: 4px;
}

.ai-runtime-console__llm-stat span,
.ai-runtime-console__llm-mini-title {
  font-size: 12px;
}

.ai-runtime-console__llm-stat strong {
  font-size: 22px;
  line-height: 1;
}

.ai-runtime-console__llm-boards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ai-runtime-console__llm-mini-list {
  display: grid;
  gap: 8px;
}

.ai-runtime-console__llm-mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
}

.ai-runtime-console__content {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
  gap: 16px;
}

.ai-runtime-console__groups {
  display: grid;
  gap: 14px;
}

.ai-runtime-console__group-card,
.ai-runtime-console__focus-card {
  padding: 16px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 92%, white 8%), var(--bg-card));
}

.ai-runtime-console__group-head,
.ai-runtime-console__focus-head,
.ai-runtime-console__item-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-runtime-console__group-title-wrap {
  display: flex;
  gap: 12px;
  min-width: 0;
}

.ai-runtime-console__group-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--pri) 12%, transparent);
  color: var(--pri);
}

.ai-runtime-console__group-title,
.ai-runtime-console__focus-head h3 {
  margin: 0;
  font-size: 18px;
}

.ai-runtime-console__group-lead {
  margin: 4px 0 0;
  line-height: 1.6;
}

.ai-runtime-console__group-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.ai-runtime-console__item-list,
.ai-runtime-console__focus-list,
.ai-runtime-console__quick-links {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.ai-runtime-console__item,
.ai-runtime-console__focus-item,
.ai-runtime-console__quick-link {
  padding: 12px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--bg-card) 85%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 6%, transparent);
}

.ai-runtime-console__item-detail {
  margin-top: 8px;
  line-height: 1.6;
  font-size: 13px;
}

.ai-runtime-console__group-empty {
  margin-top: 14px;
  line-height: 1.6;
}

.ai-runtime-console__group-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 14px;
}

.ai-runtime-console__aside {
  display: grid;
  gap: 14px;
  align-content: start;
}

.ai-runtime-console__quick-link {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  color: inherit;
  text-decoration: none;
}

@media (max-width: 900px) {
  .ai-runtime-console__content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .ai-runtime-console__llm-stats,
  .ai-runtime-console__llm-boards {
    grid-template-columns: 1fr;
  }

  .ai-runtime-console__hero,
  .ai-runtime-console__group-head,
  .ai-runtime-console__focus-head,
  .ai-runtime-console__item-head,
  .ai-runtime-console__quick-link {
    flex-direction: column;
  }

  .ai-runtime-console__hero-title {
    font-size: 22px;
  }

  .ai-runtime-console__group-actions {
    justify-content: stretch;
  }

  .ai-runtime-console__group-actions :deep(.ui-btn) {
    width: 100%;
  }

  .ai-runtime-console__action-strip {
    width: 100%;
    justify-content: stretch;
  }

  .ai-runtime-console__action-strip :deep(.ui-btn) {
    width: 100%;
  }
}
</style>
