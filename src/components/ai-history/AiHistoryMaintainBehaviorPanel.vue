<script setup lang="ts">
import type {
  LlmHistoryBehaviorAgentTrace,
  LlmHistoryBehaviorAutoFeedbackPayload,
  LlmHistoryBehaviorRun,
} from "@/api/pallasTypes";
import AiHistoryAdvancedDebugBlock from "@/components/ai-history/AiHistoryAdvancedDebugBlock.vue";
import AiHistoryBehaviorAnnotateControls from "@/components/ai-history/AiHistoryBehaviorAnnotateControls.vue";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import {
  BEHAVIOR_OUTCOME_OPTIONS,
  BEHAVIOR_SCENE_OPTIONS,
  labelOutcome,
  labelScene,
} from "@/utils/aiHistoryLabels";
import { formatCompactDateTime } from "@/utils/formatDateTime";

const runsGroup = defineModel<string>("runsGroup", { default: "" });
const runsScene = defineModel<string>("runsScene", { default: "" });
const runsOutcome = defineModel<string>("runsOutcome", { default: "" });
const includeDisabled = defineModel<boolean>("includeDisabled", { default: false });

const props = defineProps<{
  expanded?: boolean;
  summary?: string;
  err?: string;
  busy?: boolean;
  overview: ReadonlyArray<AiHistoryStatItem>;
  items: ReadonlyArray<LlmHistoryBehaviorRun>;
  labelOptions: ReadonlyArray<string>;
  expandedTextKeys?: Readonly<Record<string, boolean>>;
  advancedDebugKeys?: Readonly<Record<string, boolean>>;
  expandedTraceKeys?: Readonly<Record<string, boolean>>;
  annotateExpandedIds?: Readonly<Record<string, boolean>>;
  behaviorBusy?: Readonly<Record<string, boolean>>;
  replayBusy?: Readonly<Record<string, boolean>>;
  replayCopyBusy?: Readonly<Record<string, boolean>>;
  agentTrace: (payload?: LlmHistoryBehaviorAutoFeedbackPayload | null) => LlmHistoryBehaviorAgentTrace | null;
  agentTraceHighlights: (
    trace?: LlmHistoryBehaviorAgentTrace | null,
  ) => Array<{ label: string; value: string }>;
  sessionKeyForRun: (run: LlmHistoryBehaviorRun) => string;
}>();

const emit = defineEmits<{
  toggle: [];
  refresh: [];
  "group-touched": [value: string];
  "apply-scene": [scene: string];
  "toggle-text": [key: string];
  "focus-pattern": [patternId: string, scene: string, groupId?: number | null];
  "toggle-advanced": [key: string];
  "toggle-trace": [key: string];
  "run-replay": [requestId: string];
  "copy-replay": [requestId: string];
  "toggle-annotate": [requestId: string];
  "toggle-label": [run: LlmHistoryBehaviorRun, label: string];
  "update-outcome": [run: LlmHistoryBehaviorRun, outcome: string];
  "toggle-disabled": [run: LlmHistoryBehaviorRun];
  "open-session": [run: LlmHistoryBehaviorRun];
}>();

function textKey(requestId: string): string {
  return `card-${requestId}`;
}

function traceKey(requestId: string): string {
  return `observe:${requestId}`;
}

function isLongText(content: string): boolean {
  return content.length > 120 || content.split("\n").length > 3;
}

function isTextExpanded(requestId: string): boolean {
  return !!props.expandedTextKeys?.[textKey(requestId)];
}

function outcomeClass(outcome?: string | null): string {
  const value = outcome || "";
  if (value === "engaged") return "is-engaged";
  if (value === "ignored") return "is-ignored";
  if (value === "derailed" || value === "awkward") return "is-bad";
  if (value === "neutral") return "is-neutral";
  return "is-pending";
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
  <section class="ai-history-page__feedback">
    <AiHistoryPanelShell
      title="行为记录"
      purpose="看自动判定是否稳，快速扫最近结果"
      :summary="summary"
      :expanded="expanded"
      @toggle="emit('toggle')"
    >
      <div class="ai-history-page__filters-card">
        <div class="ai-history-page__filters-head">
          <strong>记录筛选</strong>
          <span class="muted">默认跟随当前选中会话的群号</span>
        </div>
        <div class="ai-history-page__filters ai-history-page__filters--aligned">
          <label class="ai-history-page__filter">
            <span>群号</span>
            <UiInput
              v-model="runsGroup"
              inputmode="numeric"
              placeholder="全部"
              aria-label="群号"
              @update:model-value="emit('group-touched', $event)"
              @keyup.enter="emit('refresh')"
            />
          </label>
          <label class="ai-history-page__filter">
            <span>场景</span>
            <UiSelect
              v-model="runsScene"
              aria-label="场景"
            >
              <option
                v-for="item in BEHAVIOR_SCENE_OPTIONS"
                :key="item.value || 'empty'"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </UiSelect>
          </label>
          <label class="ai-history-page__filter">
            <span>结果</span>
            <UiSelect
              v-model="runsOutcome"
              aria-label="结果"
            >
              <option
                v-for="item in BEHAVIOR_OUTCOME_OPTIONS"
                :key="item.value || 'empty'"
                :value="item.value"
              >
                {{ item.label }}
              </option>
            </UiSelect>
          </label>
          <div class="ai-history-page__filter-action ai-history-page__filter-action--check">
            <label class="ai-history-page__behavior-check">
              <input
                v-model="includeDisabled"
                type="checkbox"
              >
              <span>包含已禁用</span>
            </label>
          </div>
          <div class="ai-history-page__filter-action">
            <UiButton
              size="sm"
              variant="outline"
              :busy="busy"
              @click="emit('refresh')"
            >
              读取记录
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
        <div
          v-for="item in overview"
          :key="item.label"
          class="ai-stat ai-history-page__summary-stat"
        >
          <span class="ai-stat__label">{{ item.label }}</span>
          <strong
            class="ai-stat__value"
            :class="{ 'ai-stat__value--accent': item.accent }"
          >{{ item.value }}</strong>
        </div>
      </div>
      <div
        v-if="items.length"
        class="ai-history-page__feedback-list"
      >
        <article
          v-for="run in items"
          :key="run.request_id"
          class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior ai-history-page__observe-run"
        >
          <div class="ai-history-page__feedback-top">
            <button
              type="button"
              class="ai-history-page__scene-pill ai-history-page__scene-pill--btn"
              @click="emit('apply-scene', run.scene)"
            >
              {{ labelScene(run.scene) }}
            </button>
            <span
              class="ai-history-page__outcome-badge"
              :class="outcomeClass(run.final_outcome)"
            >
              {{ labelOutcome(run.final_outcome) }}
            </span>
          </div>
          <div class="ai-history-page__feedback-meta">
            <span v-if="run.created_at">{{ formatCompactDateTime(run.created_at) }}</span>
            <span>群：{{ run.group_id || "私聊" }}</span>
            <span>用户：{{ run.user_id || "—" }}</span>
            <span>分值变化：{{ run.score_delta ?? 0 }}</span>
            <span>已禁用：{{ run.disabled ? "是" : "否" }}</span>
          </div>
          <p
            v-if="run.user_text"
            class="ai-history-page__feedback-user"
            :class="{ 'is-clamped': isLongText(run.user_text) && !isTextExpanded(run.request_id) }"
          >
            用户：{{ run.user_text }}
          </p>
          <p
            v-if="run.reply_text"
            class="ai-history-page__feedback-user"
            :class="{ 'is-clamped': isLongText(run.reply_text) && !isTextExpanded(run.request_id) }"
          >
            回复：{{ run.reply_text }}
          </p>
          <button
            v-if="isLongText(run.user_text || '') || isLongText(run.reply_text || '')"
            type="button"
            class="ai-history-page__turn-toggle"
            @click="emit('toggle-text', textKey(run.request_id))"
          >
            {{ isTextExpanded(run.request_id) ? "收起" : "展开全文" }}
          </button>
          <div
            v-if="run.selected_pattern_ids?.length"
            class="ai-history-page__pattern-links ai-history-page__pattern-links--inline"
          >
            <span>命中规则</span>
            <button
              v-for="patternId in run.selected_pattern_ids"
              :key="`${run.request_id}-observe-${patternId}`"
              type="button"
              class="ai-history-page__pattern-link"
              @click="emit('focus-pattern', patternId, run.scene, run.group_id)"
            >
              {{ patternId }}
            </button>
          </div>
          <div class="ai-history-page__behavior-evidence">
            <span>依据来源：{{ formatSource(run.auto_feedback_payload) }}</span>
            <span>命中信号：{{ formatSignal(run.auto_feedback_payload) }}</span>
            <span>命中词：{{ formatTokens(run.auto_feedback_payload) }}</span>
            <span>观察消息：{{ run.auto_feedback_payload?.observed_turn_count ?? 0 }} 条</span>
          </div>
          <AiHistoryAdvancedDebugBlock
            v-if="agentTrace(run.auto_feedback_payload)"
            :expanded="!!advancedDebugKeys?.[traceKey(run.request_id)]"
            :trace-expanded="!!expandedTraceKeys?.[traceKey(run.request_id)]"
            :highlights="agentTraceHighlights(agentTrace(run.auto_feedback_payload))"
            :trace="agentTrace(run.auto_feedback_payload)"
            :replay-busy="!!replayBusy?.[run.request_id]"
            :copy-busy="!!replayCopyBusy?.[run.request_id]"
            @toggle="emit('toggle-advanced', traceKey(run.request_id))"
            @toggle-trace="emit('toggle-trace', traceKey(run.request_id))"
            @run-replay="emit('run-replay', run.request_id)"
            @copy-replay="emit('copy-replay', run.request_id)"
          />
          <p
            v-if="run.behavior_hint_text"
            class="ai-history-page__feedback-user"
          >
            提示：{{ run.behavior_hint_text }}
          </p>
          <button
            type="button"
            class="ai-history-page__turn-toggle"
            @click="emit('toggle-annotate', run.request_id)"
          >
            {{ annotateExpandedIds?.[run.request_id] ? "收起校正" : "校正这条记录" }}
          </button>
          <div
            v-if="annotateExpandedIds?.[run.request_id]"
            class="ai-history-page__observe-annotate"
          >
            <AiHistoryBehaviorAnnotateControls
              :labels="labelOptions"
              :selected-labels="run.manual_labels"
              :outcome="run.final_outcome"
              :busy="!!behaviorBusy?.[run.request_id]"
              :disabled-sample="!!run.disabled"
              outcome-label="人工结果"
              disable-variant="ghost"
              disable-size="sm"
              @toggle-label="emit('toggle-label', run, $event)"
              @update:outcome="emit('update-outcome', run, $event)"
              @toggle-disabled="emit('toggle-disabled', run)"
            />
          </div>
          <div class="row-actions ai-history-page__pattern-actions">
            <UiButton
              v-if="sessionKeyForRun(run)"
              size="sm"
              variant="outline"
              @click="emit('open-session', run)"
            >
              查看会话
            </UiButton>
          </div>
        </article>
      </div>
      <div
        v-else
        class="ai-empty"
      >
        <span>{{ busy ? "正在读取记录" : "当前筛选下暂无行为记录" }}</span>
        <span class="ai-empty__hint">适合快速观察最近哪些规则在生效、哪些结果被自动判成被无视或带偏。</span>
      </div>
    </AiHistoryPanelShell>
  </section>
</template>
