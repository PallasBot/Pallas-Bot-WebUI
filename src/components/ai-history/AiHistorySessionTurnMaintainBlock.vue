<script setup lang="ts">
import type {
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmHistoryBehaviorRun,
  LlmPersonaShapingSummary,
  LlmRepeaterFeedbackEntry,
} from "@/api/pallasTypes";
import AiHistoryAdvancedDebugBlock from "@/components/ai-history/AiHistoryAdvancedDebugBlock.vue";
import AiHistoryBehaviorAnnotateControls from "@/components/ai-history/AiHistoryBehaviorAnnotateControls.vue";
import AiHistoryPersonaShapingBlock from "@/components/ai-history/AiHistoryPersonaShapingBlock.vue";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import UiButton from "@/components/ui/UiButton.vue";
import { labelActions, labelOutcome, labelScene } from "@/utils/aiHistoryLabels";

withDefaults(
  defineProps<{
    feedbackEntry?: LlmRepeaterFeedbackEntry | null;
    behaviorRun?: LlmHistoryBehaviorRun | null;
    expanded?: boolean;
    feedbackBusy?: boolean;
    correctionDraft?: string;
    correctionBusy?: boolean;
    requestId?: string;
    personaShapingBusy?: boolean;
    personaShapingError?: string;
    personaShaping?: LlmPersonaShapingSummary | null;
    labelOptions?: ReadonlyArray<string>;
    behaviorBusy?: boolean;
    advancedDebugExpanded?: boolean;
    traceExpanded?: boolean;
    agentTrace?: LlmHistoryBehaviorAgentTrace | null;
    agentHighlights?: ReadonlyArray<Pick<AiHistoryStatItem, "label" | "value">>;
    replayBusy?: boolean;
    copyBusy?: boolean;
  }>(),
  {
    feedbackEntry: null,
    behaviorRun: null,
    expanded: false,
    feedbackBusy: false,
    correctionDraft: "",
    correctionBusy: false,
    requestId: "",
    personaShapingBusy: false,
    personaShapingError: "",
    personaShaping: null,
    labelOptions: () => [],
    behaviorBusy: false,
    advancedDebugExpanded: false,
    traceExpanded: false,
    agentTrace: null,
    agentHighlights: () => [],
    replayBusy: false,
    copyBusy: false,
  },
);

const emit = defineEmits<{
  toggle: [];
  manage: [action: "invalidate" | "restore" | "delete"];
  "update:correction": [value: string];
  "save-correction": [];
  "clear-correction": [];
  "focus-pattern": [patternId: string, scene: string, groupId?: number | null];
  "toggle-advanced": [];
  "toggle-trace": [];
  "run-replay": [];
  "copy-replay": [];
  "toggle-label": [label: string];
  "update:outcome": [outcome: string];
  "toggle-disabled": [];
}>();

function learningLabel(entry: LlmRepeaterFeedbackEntry | null | undefined): string {
  if (!entry) return "未收录反哺";
  return entry.eligible_for_bias ? "参与学习" : "已排除";
}

function learningClass(entry: LlmRepeaterFeedbackEntry | null | undefined): string {
  if (!entry) return "is-none";
  return entry.eligible_for_bias ? "is-active" : "is-excluded";
}

function outcomeClass(outcome?: string | null): string {
  const value = outcome || "";
  if (value === "engaged") return "is-engaged";
  if (value === "ignored") return "is-ignored";
  if (value === "derailed" || value === "awkward") return "is-bad";
  if (value === "neutral") return "is-neutral";
  return "is-pending";
}

function formatOutcomeLabel(outcome?: string | null): string {
  return labelOutcome(outcome);
}

function formatSource(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  const source = payload?.source || "";
  if (source === "ambient") return "群环境";
  if (source === "session") return "同会话";
  if (source === "mixed") return "混合";
  if (source === "timeout") return "超时";
  return "未知";
}

function formatSignal(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  const signal = payload?.matched_signal || "";
  if (signal === "derailed_token") return "命中跑题信号";
  if (signal === "negative_token") return "命中负反馈信号";
  if (signal === "engaged_token") return "命中接话信号";
  if (signal === "ambient_continued_without_pickup") return "群里继续聊但没接 bot";
  if (signal === "timeout_without_followup") return "窗口内无人承接";
  if (signal === "followup_outside_window") return "有后续但超出观察窗";
  if (signal === "default_neutral") return "默认一般";
  return signal || "未标注";
}

function formatTokens(payload?: LlmHistoryBehaviorAutoFeedbackPayload | null): string {
  return payload?.matched_tokens?.length ? payload.matched_tokens.join(" / ") : "无";
}
</script>

<template>
  <div class="ai-history-page__turn-maintain">
    <div class="ai-history-page__turn-maintain-bar">
      <span
        class="ai-history-page__maintain-pill"
        :class="learningClass(feedbackEntry)"
      >
        {{ learningLabel(feedbackEntry) }}
      </span>
      <div
        v-if="feedbackEntry && !expanded"
        class="row-actions ai-history-page__turn-quick-actions"
      >
        <UiButton
          v-if="feedbackEntry.eligible_for_bias"
          size="sm"
          variant="outline"
          :busy="feedbackBusy"
          @click="emit('manage', 'invalidate')"
        >
          排除
        </UiButton>
        <UiButton
          v-else
          size="sm"
          variant="outline"
          :busy="feedbackBusy"
          @click="emit('manage', 'restore')"
        >
          恢复
        </UiButton>
        <UiButton
          size="sm"
          variant="ghost"
          class="ai-history-page__danger-btn"
          :busy="feedbackBusy"
          @click="emit('manage', 'delete')"
        >
          删除
        </UiButton>
      </div>
      <button
        type="button"
        class="ai-history-page__turn-toggle ai-history-page__turn-maintain-toggle"
        @click="emit('toggle')"
      >
        {{ expanded ? "收起" : (behaviorRun ? "行为标注" : "详情") }}
      </button>
    </div>
    <div
      v-if="expanded"
      class="ai-history-page__turn-maintain-body"
    >
      <AiHistoryPersonaShapingBlock
        v-if="requestId"
        :busy="personaShapingBusy"
        :error="personaShapingError"
        :summary="personaShaping"
      />
      <section class="ai-history-page__maintain-section">
        <h5 class="ai-history-page__maintain-section-title">反哺学习</h5>
        <p class="muted ai-history-page__maintain-hint">
          控制这条回复是否参与后续复读偏好；可填写期望回复，供后续 @ 闲聊参考。
        </p>
        <template v-if="feedbackEntry">
          <div class="ai-history-page__maintain-meta">
            <span>路由：{{ feedbackEntry.llm_route || "未知" }}</span>
            <span>场景：{{ labelScene(feedbackEntry.behavior_scene) }}</span>
            <span>状态：{{ feedbackEntry.eligible_for_bias ? "参与加权" : "已排除" }}</span>
          </div>
          <div class="row-actions ai-history-page__maintain-actions">
            <UiButton
              v-if="feedbackEntry.eligible_for_bias"
              size="sm"
              variant="outline"
              :busy="feedbackBusy"
              @click="emit('manage', 'invalidate')"
            >
              不适合，不参与学习
            </UiButton>
            <UiButton
              v-else
              size="sm"
              variant="outline"
              :busy="feedbackBusy"
              @click="emit('manage', 'restore')"
            >
              恢复参与学习
            </UiButton>
            <UiButton
              size="sm"
              variant="ghost"
              class="ai-history-page__danger-btn"
              :busy="feedbackBusy"
              @click="emit('manage', 'delete')"
            >
              删除反哺记录
            </UiButton>
          </div>
        </template>
        <p
          v-else
          class="ai-history-page__maintain-empty"
        >
          此回复未进入反哺池，仍可直接填写期望回复写回。
        </p>
        <div class="ai-history-page__correction-editor">
          <label class="ai-history-page__correction-label">期望回复（校正写回）</label>
          <textarea
            class="inp ai-history-page__pattern-textarea ai-history-page__correction-textarea"
            :value="correctionDraft"
            placeholder="例如：谢谢，还行吧"
            rows="3"
            @input="emit('update:correction', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
          <div class="row-actions ai-history-page__maintain-actions">
            <UiButton
              size="sm"
              variant="primary"
              :busy="correctionBusy"
              @click="emit('save-correction')"
            >
              保存期望回复
            </UiButton>
            <UiButton
              v-if="feedbackEntry?.corrected_reply_text"
              size="sm"
              variant="ghost"
              :busy="correctionBusy"
              @click="emit('clear-correction')"
            >
              清除校正
            </UiButton>
          </div>
        </div>
      </section>
      <section
        v-if="behaviorRun"
        class="ai-history-page__maintain-section"
      >
        <h5 class="ai-history-page__maintain-section-title">行为风格</h5>
        <div class="ai-history-page__turn-behavior-bar ai-history-page__maintain-behavior-bar">
          <strong>{{ labelScene(behaviorRun.scene) }}</strong>
          <span
            class="ai-history-page__outcome-badge"
            :class="outcomeClass(behaviorRun.final_outcome)"
          >
            {{ formatOutcomeLabel(behaviorRun.final_outcome) }}
          </span>
          <span class="muted ai-history-page__turn-behavior-actions">
            动作：{{ labelActions(behaviorRun.selected_actions) }}
          </span>
        </div>
        <div class="ai-history-page__behavior-meta">
          <span class="ai-history-page__pattern-links">
            规则：
            <template v-if="behaviorRun.selected_pattern_ids.length">
              <button
                v-for="patternId in behaviorRun.selected_pattern_ids"
                :key="`${behaviorRun.request_id}-${patternId}`"
                type="button"
                class="ai-history-page__pattern-link"
                @click="emit('focus-pattern', patternId, behaviorRun.scene, behaviorRun.group_id)"
              >
                {{ patternId }}
              </button>
            </template>
            <template v-else>无</template>
          </span>
          <span>结果：{{ behaviorRun.final_outcome || "未判定" }}</span>
        </div>
        <div
          v-if="behaviorRun.auto_feedback_payload"
          class="ai-history-page__behavior-evidence"
        >
          <span>依据来源：{{ formatSource(behaviorRun.auto_feedback_payload) }}</span>
          <span>命中信号：{{ formatSignal(behaviorRun.auto_feedback_payload) }}</span>
          <span>命中词：{{ formatTokens(behaviorRun.auto_feedback_payload) }}</span>
          <span>观察消息：{{ behaviorRun.auto_feedback_payload.observed_turn_count ?? 0 }} 条</span>
        </div>
        <AiHistoryAdvancedDebugBlock
          v-if="agentTrace"
          :expanded="advancedDebugExpanded"
          :trace-expanded="traceExpanded"
          :highlights="agentHighlights"
          :trace="agentTrace"
          :replay-busy="replayBusy"
          :copy-busy="copyBusy"
          @toggle="emit('toggle-advanced')"
          @toggle-trace="emit('toggle-trace')"
          @run-replay="emit('run-replay')"
          @copy-replay="emit('copy-replay')"
        />
        <p
          v-if="behaviorRun.behavior_hint_text"
          class="ai-history-page__behavior-hint"
        >
          {{ behaviorRun.behavior_hint_text }}
        </p>
        <p class="muted ai-history-page__maintain-hint">点选标签描述这条回复的问题；可配合下方结果一起标注。</p>
        <AiHistoryBehaviorAnnotateControls
          :labels="labelOptions"
          :selected-labels="behaviorRun.manual_labels"
          :outcome="behaviorRun.final_outcome"
          :busy="behaviorBusy"
          :disabled-sample="!!behaviorRun.disabled"
          outcome-label="对话结果"
          action-btn-class="ai-history-page__behavior-action-btn"
          @toggle-label="emit('toggle-label', $event)"
          @update:outcome="emit('update:outcome', $event)"
          @toggle-disabled="emit('toggle-disabled')"
        />
      </section>
    </div>
  </div>
</template>
