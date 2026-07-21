<script setup lang="ts">
import { ref } from "vue";
import type { LlmHistorySessionSummary } from "@/api/pallasTypes";
import { formatRelativeDayLabel } from "@/utils/formatDateTime";

const showDecisionTraces = defineModel<boolean>("showDecisionTraces", { default: false });

defineProps<{
  selectedSession?: LlmHistorySessionSummary | null;
  contextLabel?: string;
  hasDetail?: boolean;
}>();

const detailAnchor = ref<HTMLElement | null>(null);

defineExpose({ detailAnchor });

function sessionIsPrivate(item: LlmHistorySessionSummary): boolean {
  return item.group_id === 0;
}

function relativeDayLabel(tsSeconds: number): string {
  return formatRelativeDayLabel(tsSeconds) ?? "";
}
</script>

<template>
  <main class="ai-history-split__detail">
    <div
      ref="detailAnchor"
      class="ai-history-page__detail-anchor"
    >
      <div class="ai-history-split__detail-top">
        <div class="ai-history-detail__intro">
          <h3 class="ai-history-split__detail-title">会话明细</h3>
          <div
            v-if="selectedSession"
            class="ai-history-detail__tags"
          >
            <span
              class="ai-history-session__tag"
              :class="sessionIsPrivate(selectedSession) ? 'is-dm' : 'is-group'"
            >
              {{ sessionIsPrivate(selectedSession) ? "私聊" : "群聊" }}
            </span>
            <span
              v-if="relativeDayLabel(selectedSession.last_created_at)"
              class="ai-history-session__tag is-day"
            >
              {{ relativeDayLabel(selectedSession.last_created_at) }}
            </span>
            <span class="ai-history-session__tag is-count">{{ selectedSession.turn_count }} 条</span>
            <span class="ai-history-session__tag is-bot">Bot {{ selectedSession.bot_id }}</span>
          </div>
          <p class="ai-history-split__detail-lede">
            {{ hasDetail ? (contextLabel || "当前选中会话") : "选择左侧会话查看完整对话" }}
          </p>
        </div>
        <label
          v-if="hasDetail"
          class="ai-history-page__detail-trace-toggle"
        >
          <input
            v-model="showDecisionTraces"
            type="checkbox"
          >
          判定详情
        </label>
      </div>
      <div
        v-if="hasDetail"
        class="ai-history-page__detail"
      >
        <slot />
      </div>
      <div
        v-else
        class="ai-empty"
      >
        <span>未选择会话</span>
        <span class="ai-empty__hint">点左侧任意会话查看完整对话。</span>
      </div>
    </div>
  </main>
</template>
