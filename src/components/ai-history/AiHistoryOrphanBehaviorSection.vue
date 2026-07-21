<script setup lang="ts">
import type {
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmHistoryBehaviorRun,
} from "@/api/pallasTypes";
import AiHistoryAdvancedDebugBlock from "@/components/ai-history/AiHistoryAdvancedDebugBlock.vue";
import AiHistoryBehaviorAnnotateControls from "@/components/ai-history/AiHistoryBehaviorAnnotateControls.vue";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import { labelActions, labelOutcome, labelScene } from "@/utils/aiHistoryLabels";

withDefaults(
  defineProps<{
    runs: ReadonlyArray<LlmHistoryBehaviorRun>;
    labelOptions?: ReadonlyArray<string>;
    formatSource?: (payload?: LlmHistoryBehaviorAutoFeedbackPayload | null) => string;
    formatSignal?: (payload?: LlmHistoryBehaviorAutoFeedbackPayload | null) => string;
    formatTokens?: (payload?: LlmHistoryBehaviorAutoFeedbackPayload | null) => string;
    outcomeClass?: (outcome?: string | null) => string;
    agentTrace?: (payload?: LlmHistoryBehaviorAutoFeedbackPayload | null) => LlmHistoryBehaviorAgentTrace | null;
    agentHighlights?: (
      trace?: LlmHistoryBehaviorAgentTrace | null,
    ) => ReadonlyArray<Pick<AiHistoryStatItem, "label" | "value">>;
    isAdvancedExpanded?: (requestId: string) => boolean;
    isTraceExpanded?: (requestId: string) => boolean;
    isBusy?: (requestId: string) => boolean;
    isReplayBusy?: (requestId: string) => boolean;
    isCopyBusy?: (requestId: string) => boolean;
  }>(),
  {
    labelOptions: () => [],
    formatSource: () => "未知",
    formatSignal: () => "未标注",
    formatTokens: () => "无",
    outcomeClass: () => "is-pending",
    agentTrace: () => null,
    agentHighlights: () => [],
    isAdvancedExpanded: () => false,
    isTraceExpanded: () => false,
    isBusy: () => false,
    isReplayBusy: () => false,
    isCopyBusy: () => false,
  },
);

const emit = defineEmits<{
  "focus-pattern": [patternId: string, scene: string, groupId?: number | null];
  "toggle-advanced": [requestId: string];
  "toggle-trace": [requestId: string];
  "run-replay": [requestId: string];
  "copy-replay": [requestId: string];
  "toggle-label": [run: LlmHistoryBehaviorRun, label: string];
  "update:outcome": [run: LlmHistoryBehaviorRun, outcome: string];
  "toggle-disabled": [run: LlmHistoryBehaviorRun];
}>();

function formatOutcomeLabel(outcome?: string | null): string {
  return labelOutcome(outcome);
}
</script>

<template>
  <section
    v-if="runs.length"
    class="ai-history-page__orphan-behavior"
  >
    <div class="ai-head ai-history-page__orphan-behavior-head">
      <h4 class="ai-head__title">未挂上会话的行为记录</h4>
    </div>
    <article
      v-for="run in runs"
      :key="run.request_id"
      class="ai-history-page__behavior-card"
    >
      <div class="ai-history-page__behavior-top">
        <strong>{{ labelScene(run.scene) }}</strong>
        <span
          class="ai-history-page__outcome-badge"
          :class="outcomeClass(run.final_outcome)"
        >
          {{ formatOutcomeLabel(run.final_outcome) }}
        </span>
      </div>
      <div class="ai-history-page__behavior-meta">
        <span>动作：{{ labelActions(run.selected_actions) }}</span>
        <span class="ai-history-page__pattern-links">
          规则：
          <template v-if="run.selected_pattern_ids.length">
            <button
              v-for="patternId in run.selected_pattern_ids"
              :key="`${run.request_id}-${patternId}`"
              type="button"
              class="ai-history-page__pattern-link"
              @click="emit('focus-pattern', patternId, run.scene, run.group_id)"
            >
              {{ patternId }}
            </button>
          </template>
          <template v-else>无</template>
        </span>
        <span>结果：{{ run.final_outcome || "未判定" }}</span>
      </div>
      <p
        v-if="run.reply_text"
        class="ai-history-page__behavior-hint"
      >
        回复：{{ run.reply_text }}
      </p>
      <div
        v-if="run.auto_feedback_payload"
        class="ai-history-page__behavior-evidence"
      >
        <span>依据来源：{{ formatSource(run.auto_feedback_payload) }}</span>
        <span>命中信号：{{ formatSignal(run.auto_feedback_payload) }}</span>
        <span>命中词：{{ formatTokens(run.auto_feedback_payload) }}</span>
        <span>观察消息：{{ run.auto_feedback_payload.observed_turn_count ?? 0 }} 条</span>
      </div>
      <AiHistoryAdvancedDebugBlock
        v-if="agentTrace(run.auto_feedback_payload)"
        :expanded="isAdvancedExpanded(run.request_id)"
        :trace-expanded="isTraceExpanded(run.request_id)"
        :highlights="agentHighlights(agentTrace(run.auto_feedback_payload))"
        :trace="agentTrace(run.auto_feedback_payload)"
        :replay-busy="isReplayBusy(run.request_id)"
        :copy-busy="isCopyBusy(run.request_id)"
        @toggle="emit('toggle-advanced', run.request_id)"
        @toggle-trace="emit('toggle-trace', run.request_id)"
        @run-replay="emit('run-replay', run.request_id)"
        @copy-replay="emit('copy-replay', run.request_id)"
      />
      <p
        v-if="run.behavior_hint_text"
        class="ai-history-page__behavior-hint"
      >
        {{ run.behavior_hint_text }}
      </p>
      <AiHistoryBehaviorAnnotateControls
        :labels="labelOptions"
        :selected-labels="run.manual_labels"
        :outcome="run.final_outcome"
        :busy="isBusy(run.request_id)"
        :disabled-sample="!!run.disabled"
        outcome-label="结果"
        action-btn-class="ai-history-page__behavior-action-btn"
        @toggle-label="emit('toggle-label', run, $event)"
        @update:outcome="emit('update:outcome', run, $event)"
        @toggle-disabled="emit('toggle-disabled', run)"
      />
    </article>
  </section>
</template>
