<script setup lang="ts">
import type { LlmHistoryBehaviorAgentTrace } from "@/api/pallasTypes";
import type { AiHistoryStatItem } from "@/components/ai-history/types";

withDefaults(
  defineProps<{
    expanded?: boolean;
    traceExpanded?: boolean;
    highlights?: ReadonlyArray<Pick<AiHistoryStatItem, "label" | "value">>;
    trace?: LlmHistoryBehaviorAgentTrace | null;
    replayBusy?: boolean;
    copyBusy?: boolean;
  }>(),
  {
    expanded: false,
    traceExpanded: false,
    highlights: () => [],
    trace: null,
    replayBusy: false,
    copyBusy: false,
  },
);

const emit = defineEmits<{
  toggle: [];
  "toggle-trace": [];
  "run-replay": [];
  "copy-replay": [];
}>();
</script>

<template>
  <button
    type="button"
    class="ai-history-page__turn-toggle"
    @click="emit('toggle')"
  >
    {{ expanded ? "收起高级" : "高级：决策轨迹与重放" }}
  </button>
  <div
    v-if="expanded"
    class="ai-history-page__advanced-debug"
  >
    <div
      v-if="highlights.length"
      class="ai-history-page__trace-highlights"
    >
      <span
        v-for="item in highlights"
        :key="item.label"
      >
        {{ item.label }}：{{ item.value }}
      </span>
    </div>
    <pre
      v-if="traceExpanded && trace"
      class="ai-history-page__kernel-trace-json"
    >{{ JSON.stringify(trace, null, 2) }}</pre>
    <div class="row-actions ai-history-page__trace-actions">
      <button
        type="button"
        class="ai-history-page__turn-toggle"
        @click="emit('toggle-trace')"
      >
        {{ traceExpanded ? "收起决策轨迹" : "查看决策轨迹" }}
      </button>
      <button
        type="button"
        class="ai-history-page__turn-toggle"
        :disabled="replayBusy"
        @click="emit('run-replay')"
      >
        {{ replayBusy ? "重放中…" : "执行重放" }}
      </button>
      <button
        type="button"
        class="ai-history-page__turn-toggle"
        :disabled="copyBusy"
        @click="emit('copy-replay')"
      >
        复制重放数据
      </button>
    </div>
  </div>
</template>
