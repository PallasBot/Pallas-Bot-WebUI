<script setup lang="ts">
import type { LlmHistorySessionSummary } from "@/api/pallasTypes";
import AiHistorySessionFilterBar from "@/components/ai-history/AiHistorySessionFilterBar.vue";
import { formatCompactDateTime, formatRelativeDayLabel } from "@/utils/formatDateTime";

const filterBot = defineModel<string>("filterBot", { default: "" });
const filterGroup = defineModel<string>("filterGroup", { default: "" });
const filterUser = defineModel<string>("filterUser", { default: "" });
const selectedSessionKey = defineModel<string>("selectedSessionKey", { default: "" });
const showAllSessions = defineModel<boolean>("showAllSessions", { default: false });

defineProps<{
  sessions: ReadonlyArray<LlmHistorySessionSummary>;
  visibleSessions: ReadonlyArray<LlmHistorySessionSummary>;
  busy?: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

function sessionIsPrivate(item: LlmHistorySessionSummary): boolean {
  return item.group_id === 0;
}

function relativeDayLabel(tsSeconds: number): string {
  return formatRelativeDayLabel(tsSeconds) ?? "";
}
</script>

<template>
  <aside class="ai-history-split__list">
    <div class="ai-history-split__list-top">
      <div class="ai-history-split__list-title">
        <h3>会话列表</h3>
        <span class="muted">{{ visibleSessions.length }}/{{ sessions.length }}</span>
      </div>
      <AiHistorySessionFilterBar
        v-model:filter-bot="filterBot"
        v-model:filter-group="filterGroup"
        v-model:filter-user="filterUser"
        :busy="busy"
        @apply="emit('apply')"
        @reset="emit('reset')"
      />
    </div>
    <div
      v-if="sessions.length"
      class="ai-history-page__session-list ai-history-page__session-list--scroll"
    >
      <button
        v-for="item in visibleSessions"
        :key="item.session_key"
        type="button"
        class="ai-history-session"
        :class="{ 'is-on': selectedSessionKey === item.session_key }"
        @click="selectedSessionKey = item.session_key"
      >
        <div class="ai-history-session__head">
          <div class="ai-history-session__tags">
            <span
              class="ai-history-session__tag"
              :class="sessionIsPrivate(item) ? 'is-dm' : 'is-group'"
            >
              {{ sessionIsPrivate(item) ? "私聊" : "群聊" }}
            </span>
            <span
              v-if="relativeDayLabel(item.last_created_at)"
              class="ai-history-session__tag is-day"
            >
              {{ relativeDayLabel(item.last_created_at) }}
            </span>
            <span class="ai-history-session__tag is-count">{{ item.turn_count }} 条</span>
            <span class="ai-history-session__tag is-bot">Bot {{ item.bot_id }}</span>
          </div>
          <time class="ai-history-session__time muted">{{ formatCompactDateTime(item.last_created_at) }}</time>
        </div>
        <div class="ai-history-session__title">
          <strong v-if="sessionIsPrivate(item)">用户 {{ item.user_id }}</strong>
          <template v-else>
            <strong>群 {{ item.group_id }}</strong>
            <span class="ai-history-session__title-sub muted">用户 {{ item.user_id }}</span>
          </template>
        </div>
        <p class="ai-history-session__preview">{{ item.last_content || "（空消息）" }}</p>
      </button>
      <button
        v-if="sessions.length > visibleSessions.length"
        type="button"
        class="ai-history-page__more"
        @click="showAllSessions = true"
      >
        展开其余 {{ sessions.length - visibleSessions.length }} 个会话
      </button>
      <button
        v-else-if="sessions.length > 8"
        type="button"
        class="ai-history-page__more"
        @click="showAllSessions = false"
      >
        收起到前 8 个会话
      </button>
    </div>
    <div
      v-else
      class="ai-empty"
    >
      <span>暂无会话记录</span>
      <span class="ai-empty__hint">AI 产生对话后会显示在这里。</span>
    </div>
  </aside>
</template>
