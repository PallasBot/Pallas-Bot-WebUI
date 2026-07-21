<script setup lang="ts">
import type {
  LlmHistoryBehaviorAgentTrace,
  LlmPersonaShapingSummary,
  LlmRuntimeReplayResult,
} from "@/api/pallasTypes";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

const open = defineModel<boolean>("open", { default: false });
const rawExpanded = defineModel<boolean>("rawExpanded", { default: false });

defineProps<{
  title?: string;
  subtitle?: string;
  error?: string;
  result?: LlmRuntimeReplayResult | null;
  summary?: ReadonlyArray<AiHistoryStatItem>;
  personaShaping?: LlmPersonaShapingSummary | null;
  replyText?: string;
  assistantPreview?: string;
  trace?: LlmHistoryBehaviorAgentTrace | null;
  traceHighlights?: ReadonlyArray<Pick<AiHistoryStatItem, "label" | "value">>;
}>();

const emit = defineEmits<{
  close: [];
  copy: [];
}>();
</script>

<template>
  <UiDialog
    :open="open"
    :title="title || '重放结果'"
    :subtitle="subtitle || ''"
    panel-class="ai-history-page__pattern-dialog"
    @close="emit('close')"
  >
    <div class="ai-history-page__replay-dialog">
      <p
        v-if="error"
        class="ai-history-page__replay-error"
      >
        {{ error }}
      </p>
      <template v-else-if="result">
        <p class="muted ai-history-page__replay-hint">
          用于快速核对重放回复与 Agent trace，不会改写现有历史样本。
        </p>
        <div
          v-if="summary?.length"
          class="ai-stat-grid ai-history-page__feedback-summary"
        >
          <div
            v-for="item in summary"
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
          v-if="personaShaping?.lines?.length"
          class="ai-history-page__replay-block"
        >
          <div class="ai-head ai-history-page__replay-block-head">
            <h4 class="ai-head__title">
              牛格塑形摘要
            </h4>
          </div>
          <ul class="ai-history-page__persona-shaping-lines">
            <li
              v-for="(line, lineIndex) in personaShaping.lines"
              :key="`replay-shaping-${lineIndex}`"
            >
              {{ line }}
            </li>
          </ul>
          <p
            v-if="personaShaping.dynamic_expression"
            class="ai-history-page__persona-shaping-extra"
          >
            {{ personaShaping.dynamic_expression }}
          </p>
          <p class="muted ai-history-page__maintain-hint ai-history-page__persona-shaping-note">
            {{ personaShaping.compare_note }}
          </p>
        </div>
        <div
          v-if="replyText || assistantPreview"
          class="ai-history-page__replay-block"
        >
          <div class="ai-head ai-history-page__replay-block-head">
            <h4 class="ai-head__title">
              重放回复
            </h4>
          </div>
          <pre class="ai-history-page__kernel-trace-json ai-history-page__kernel-trace-json--compact">{{ replyText || assistantPreview }}</pre>
        </div>
        <div
          v-if="trace"
          class="ai-history-page__replay-block"
        >
          <div class="ai-head ai-history-page__replay-block-head">
            <h4 class="ai-head__title">
              决策轨迹摘要
            </h4>
          </div>
          <div
            v-if="traceHighlights?.length"
            class="ai-history-page__trace-highlights"
          >
            <span
              v-for="item in traceHighlights"
              :key="`replay-${item.label}`"
            >
              {{ item.label }}：{{ item.value }}
            </span>
          </div>
          <p
            v-else
            class="muted"
          >
            本次重放未返回可展示的轨迹摘要。
          </p>
        </div>
        <button
          type="button"
          class="ai-history-page__turn-toggle"
          @click="rawExpanded = !rawExpanded"
        >
          {{ rawExpanded ? "收起完整结果" : "查看完整结果（高级）" }}
        </button>
        <pre
          v-if="rawExpanded"
          class="ai-history-page__kernel-trace-json"
        >{{ JSON.stringify(result, null, 2) }}</pre>
      </template>
      <p
        v-else
        class="muted"
      >
        暂无重放结果。
      </p>
    </div>
    <template #footer>
      <div class="row-actions ai-history-page__pattern-actions">
        <UiButton
          size="sm"
          variant="outline"
          :disabled="!result"
          @click="emit('copy')"
        >
          复制完整结果
        </UiButton>
        <UiButton
          size="sm"
          variant="ghost"
          @click="emit('close')"
        >
          关闭
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>
