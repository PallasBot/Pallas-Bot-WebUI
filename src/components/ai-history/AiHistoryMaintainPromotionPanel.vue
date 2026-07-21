<script setup lang="ts">
import type { LlmPromotionCandidate } from "@/api/pallasTypes";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import UiButton from "@/components/ui/UiButton.vue";
import { formatCompactDateTime } from "@/utils/formatDateTime";

const includeResolved = defineModel<boolean>("includeResolved", { default: false });

defineProps<{
  expanded?: boolean;
  summary?: string;
  err?: string;
  busy?: boolean;
  feedbackGroupId?: number | null;
  candidates: ReadonlyArray<LlmPromotionCandidate>;
  pendingCount?: number;
  resolveBusyId?: string;
  expandedTextKeys?: Readonly<Record<string, boolean>>;
  statusLabel: (item: LlmPromotionCandidate) => string;
  writebackHint: (item: LlmPromotionCandidate) => string;
}>();

const emit = defineEmits<{
  toggle: [];
  refresh: [];
  "include-resolved-change": [];
  resolve: [item: LlmPromotionCandidate, action: "promote" | "reject"];
  "toggle-text": [key: string];
}>();

function textKey(id: string): string {
  return `promo-${id}`;
}

function isLongText(content: string): boolean {
  return content.length > 120 || content.split("\n").length > 3;
}

function isTextExpanded(
  id: string,
  expanded: Readonly<Record<string, boolean>> | undefined,
): boolean {
  return !!expanded?.[textKey(id)];
}
</script>

<template>
  <section class="ai-history-page__feedback">
    <AiHistoryPanelShell
      title="晋升候选"
      purpose="批准后写入本群接话语料"
      :summary="summary"
      :expanded="expanded"
      @toggle="emit('toggle')"
    >
      <div class="ai-history-page__filters-card">
        <div class="ai-history-page__filters-head">
          <strong>候选筛选</strong>
          <span class="muted">与上方反馈共用群号；需在对话策略中开启「写回语料」后才会生成候选</span>
        </div>
        <div class="ai-history-page__filters ai-history-page__filters--aligned">
          <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
            <label class="ai-history-page__behavior-check">
              <input
                v-model="includeResolved"
                type="checkbox"
                @change="emit('include-resolved-change')"
              >
              显示已处理
            </label>
          </div>
          <div class="ai-history-page__filter-action">
            <UiButton
              size="sm"
              variant="outline"
              :busy="busy"
              :disabled="!feedbackGroupId"
              @click="emit('refresh')"
            >
              刷新候选
            </UiButton>
          </div>
        </div>
      </div>
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <div class="ai-stat-grid ai-history-page__feedback-summary">
        <div class="ai-stat ai-history-page__summary-stat">
          <span class="ai-stat__label">待审批</span>
          <strong class="ai-stat__value ai-stat__value--accent">{{ pendingCount ?? 0 }}</strong>
        </div>
        <div class="ai-stat ai-history-page__summary-stat">
          <span class="ai-stat__label">列表条目</span>
          <strong class="ai-stat__value">{{ candidates.length }}</strong>
        </div>
      </div>
      <div
        v-if="candidates.length"
        class="ai-history-page__feedback-list"
      >
        <article
          v-for="item in candidates"
          :key="item.candidate_id"
          class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
        >
          <div class="ai-history-page__feedback-top">
            <strong
              class="ai-history-page__feedback-reply"
              :class="{
                'is-clamped': isLongText(item.reply_text || '') && !isTextExpanded(item.candidate_id, expandedTextKeys),
              }"
            >
              {{ item.reply_text }}
            </strong>
            <span
              class="ai-history-page__outcome-badge"
              :class="{
                'is-engaged': item.promoted,
                'is-bad': Boolean(item.rejected_reason),
                'is-pending': !item.promoted && !item.rejected_reason,
              }"
            >
              {{ statusLabel(item) }}
            </span>
          </div>
          <div class="ai-history-page__feedback-meta">
            <span>支持 {{ item.support_count }} 次</span>
            <span v-if="item.behavior_scene">{{ item.behavior_scene }}</span>
            <span>{{ formatCompactDateTime(item.last_seen_at) }}</span>
            <span v-if="writebackHint(item)">{{ writebackHint(item) }}</span>
          </div>
          <p
            class="ai-history-page__feedback-user"
            :class="{
              'is-clamped': isLongText(item.trigger_text || '') && !isTextExpanded(item.candidate_id, expandedTextKeys),
            }"
          >
            触发：{{ item.trigger_text || "—" }}
          </p>
          <button
            v-if="isLongText(item.reply_text || '') || isLongText(item.trigger_text || '')"
            type="button"
            class="ai-history-page__turn-toggle"
            @click="emit('toggle-text', textKey(item.candidate_id))"
          >
            {{ isTextExpanded(item.candidate_id, expandedTextKeys) ? "收起" : "展开全文" }}
          </button>
          <div
            v-if="!item.promoted && !item.rejected_reason"
            class="row-actions ai-history-page__promotion-actions"
          >
            <UiButton
              size="sm"
              variant="primary"
              :busy="resolveBusyId === item.candidate_id"
              :disabled="Boolean(resolveBusyId)"
              @click="emit('resolve', item, 'promote')"
            >
              批准晋升
            </UiButton>
            <UiButton
              size="sm"
              variant="outline"
              :busy="resolveBusyId === item.candidate_id"
              :disabled="Boolean(resolveBusyId)"
              @click="emit('resolve', item, 'reject')"
            >
              拒绝
            </UiButton>
          </div>
        </article>
      </div>
      <p
        v-else
        class="muted ai-history-page__empty-hint"
      >
        <span>
          {{
            busy
              ? "正在读取候选…"
              : (feedbackGroupId ? "当前群暂无晋升候选" : "请先输入群号并读取反馈")
          }}
        </span>
      </p>
    </AiHistoryPanelShell>
  </section>
</template>
