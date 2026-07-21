<script setup lang="ts">
import type { LlmRepeaterFeedbackEntry } from "@/api/pallasTypes";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import UiButton from "@/components/ui/UiButton.vue";
import { labelScene } from "@/utils/aiHistoryLabels";
import { formatCompactDateTime } from "@/utils/formatDateTime";

defineProps<{
  expanded?: boolean;
  summary?: string;
  err?: string;
  items: ReadonlyArray<LlmRepeaterFeedbackEntry>;
  feedbackGroupId?: number | null;
  observeScene?: string;
  correctionDrafts?: Readonly<Record<string, string>>;
  manageBusy?: Readonly<Record<string, boolean>>;
  expandedTextKeys?: Readonly<Record<string, boolean>>;
}>();

const emit = defineEmits<{
  toggle: [];
  "apply-scene": [scene: string];
  "update-correction": [item: LlmRepeaterFeedbackEntry, value: string];
  "save-correction": [item: LlmRepeaterFeedbackEntry];
  "clear-correction": [item: LlmRepeaterFeedbackEntry];
  manage: [item: LlmRepeaterFeedbackEntry, action: "invalidate" | "restore" | "delete"];
  "toggle-text": [key: string];
}>();

function itemKey(item: LlmRepeaterFeedbackEntry): string {
  return item.entry_id || item.request_id || "";
}

function draftKey(item: LlmRepeaterFeedbackEntry): string {
  return itemKey(item);
}

function textKey(item: LlmRepeaterFeedbackEntry): string {
  return `card-${itemKey(item)}`;
}

function isLongText(content: string): boolean {
  return content.length > 120 || content.split("\n").length > 3;
}

function correctionValue(
  item: LlmRepeaterFeedbackEntry,
  drafts: Readonly<Record<string, string>> | undefined,
): string {
  const key = draftKey(item);
  if (key && drafts && Object.prototype.hasOwnProperty.call(drafts, key)) {
    return drafts[key];
  }
  return item.corrected_reply_text ?? "";
}

function isBusy(
  item: LlmRepeaterFeedbackEntry,
  busy: Readonly<Record<string, boolean>> | undefined,
): boolean {
  const key = itemKey(item);
  return !!(key && busy?.[key]);
}

function isTextExpanded(
  item: LlmRepeaterFeedbackEntry,
  expanded: Readonly<Record<string, boolean>> | undefined,
): boolean {
  return !!expanded?.[textKey(item)];
}
</script>

<template>
  <section class="ai-history-page__feedback">
    <AiHistoryPanelShell
      title="反哺样本"
      purpose="挑出适合继续学的接话，排除不合适样本"
      :summary="summary"
      :expanded="expanded"
      @toggle="emit('toggle')"
    >
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <div
        v-if="items.length"
        class="ai-history-page__feedback-list"
      >
        <article
          v-for="item in items"
          :key="itemKey(item)"
          class="ai-history-page__feedback-card"
        >
          <div class="ai-history-page__feedback-top">
            <strong
              class="ai-history-page__feedback-reply"
              :class="{
                'is-clamped': isLongText(item.reply_text || '') && !isTextExpanded(item, expandedTextKeys),
              }"
            >
              {{ item.reply_text || "（空回复）" }}
            </strong>
            <button
              v-if="item.behavior_scene"
              type="button"
              class="ai-history-page__scene-pill ai-history-page__scene-pill--btn"
              @click="emit('apply-scene', item.behavior_scene || '')"
            >
              {{ labelScene(item.behavior_scene) }}
            </button>
            <span
              v-else
              class="ai-history-page__scene-pill"
            >未标注</span>
          </div>
          <div class="ai-history-page__feedback-meta">
            <span>{{ formatCompactDateTime(item.created_at) }}</span>
            <span>路由：{{ item.llm_route || "未知" }}</span>
            <span>{{ item.eligible_for_bias ? "参与学习" : "已排除" }}</span>
            <span v-if="item.corrected_reply_text">已校正</span>
          </div>
          <div
            v-if="item.corrected_reply_text"
            class="ai-history-page__correction-preview"
          >
            期望：{{ item.corrected_reply_text }}
          </div>
          <div class="ai-history-page__correction-editor ai-history-page__correction-editor--card">
            <label class="ai-history-page__correction-label">期望回复</label>
            <textarea
              class="inp ai-history-page__pattern-textarea ai-history-page__correction-textarea"
              :value="correctionValue(item, correctionDrafts)"
              placeholder="填写更好的接话示例"
              rows="2"
              @input="emit('update-correction', item, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
          </div>
          <div class="row-actions ai-history-page__feedback-card-actions">
            <UiButton
              size="sm"
              variant="primary"
              :busy="isBusy(item, manageBusy)"
              @click="emit('save-correction', item)"
            >
              保存校正
            </UiButton>
            <UiButton
              v-if="item.corrected_reply_text"
              size="sm"
              variant="ghost"
              :busy="isBusy(item, manageBusy)"
              @click="emit('clear-correction', item)"
            >
              清除
            </UiButton>
            <UiButton
              v-if="item.eligible_for_bias"
              size="sm"
              variant="outline"
              :busy="isBusy(item, manageBusy)"
              @click="emit('manage', item, 'invalidate')"
            >
              不适合
            </UiButton>
            <UiButton
              v-else
              size="sm"
              variant="outline"
              :busy="isBusy(item, manageBusy)"
              @click="emit('manage', item, 'restore')"
            >
              恢复
            </UiButton>
            <UiButton
              size="sm"
              variant="ghost"
              class="ai-history-page__danger-btn"
              :busy="isBusy(item, manageBusy)"
              @click="emit('manage', item, 'delete')"
            >
              删除
            </UiButton>
          </div>
          <p
            class="ai-history-page__feedback-user"
            :class="{
              'is-clamped': isLongText(item.user_text || '') && !isTextExpanded(item, expandedTextKeys),
            }"
          >
            用户：{{ item.user_text || "（空）" }}
          </p>
          <button
            v-if="isLongText(item.reply_text || '') || isLongText(item.user_text || '')"
            type="button"
            class="ai-history-page__turn-toggle"
            @click="emit('toggle-text', textKey(item))"
          >
            {{ isTextExpanded(item, expandedTextKeys) ? "收起" : "展开全文" }}
          </button>
        </article>
      </div>
      <div
        v-else
        class="ai-empty"
      >
        <span>
          {{
            feedbackGroupId
              ? (observeScene ? "当前群当前场景下暂无反馈样本" : "当前群暂无反馈样本")
              : "输入群号查看反馈"
          }}
        </span>
        <span class="ai-empty__hint">可在此排除不适合学习的样本，或彻底删除反哺记录。</span>
      </div>
    </AiHistoryPanelShell>
  </section>
</template>
