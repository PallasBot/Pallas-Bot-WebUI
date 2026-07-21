<script setup lang="ts" generic="T extends { turn: LlmHistoryTurn; index: number }">
import type { LlmHistoryTurn } from "@/api/pallasTypes";
import { AI_ASSISTANT_NAME } from "@/config/aiConstants";
import { formatCompactDateTime, formatRelativeDayLabel } from "@/utils/formatDateTime";

const props = withDefaults(
  defineProps<{
    rows: ReadonlyArray<T>;
    expandedKeys?: Readonly<Record<string, boolean>>;
    longTurnChars?: number;
    assistantName?: string;
  }>(),
  {
    expandedKeys: () => ({}),
    longTurnChars: 220,
    assistantName: AI_ASSISTANT_NAME,
  },
);

const emit = defineEmits<{
  "toggle-expand": [key: string];
}>();

function turnKey(createdAt: string | number, index: number): string {
  return `${createdAt}-${index}`;
}

function isLongTurn(content: string): boolean {
  const text = String(content || "");
  return text.length > props.longTurnChars || text.split("\n").length > 6;
}

function isExpanded(key: string): boolean {
  return !!props.expandedKeys[key];
}

function relativeDayLabel(tsSeconds: number): string {
  return formatRelativeDayLabel(tsSeconds) ?? "";
}

defineExpose({ turnKey });
</script>

<template>
  <div class="ai-history-page__thread">
    <article
      v-for="row in rows"
      :key="turnKey(row.turn.created_at, row.index)"
      class="ai-history-page__turn"
      :class="row.turn.role === 'assistant' ? 'is-assistant' : 'is-user'"
    >
      <div class="ai-history-page__turn-head">
        <strong>{{ row.turn.role === "assistant" ? assistantName : `用户 ${row.turn.user_id}` }}</strong>
        <div class="ai-history-page__turn-meta">
          <span
            v-if="relativeDayLabel(row.turn.created_at)"
            class="ai-history-page__turn-day-tag"
          >
            {{ relativeDayLabel(row.turn.created_at) }}
          </span>
          <time class="ai-history-page__turn-time">{{ formatCompactDateTime(row.turn.created_at) }}</time>
        </div>
      </div>
      <div
        class="ai-history-page__turn-body"
        :class="{ 'is-expanded': isExpanded(turnKey(row.turn.created_at, row.index)) }"
      >
        <p>{{ row.turn.content }}</p>
      </div>
      <button
        v-if="isLongTurn(row.turn.content)"
        type="button"
        class="ai-history-page__turn-toggle"
        @click="emit('toggle-expand', turnKey(row.turn.created_at, row.index))"
      >
        {{ isExpanded(turnKey(row.turn.created_at, row.index)) ? "收起" : "展开全文" }}
      </button>
      <slot
        :row="row"
        :turn-key="turnKey(row.turn.created_at, row.index)"
      />
    </article>
  </div>
</template>
