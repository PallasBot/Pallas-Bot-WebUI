<script setup lang="ts">
import type { ConversationKernelStatus, ConversationKernelTraceRow } from "@/api/pallasTypes";
import AiHistoryPanelShell from "@/components/ai-history/AiHistoryPanelShell.vue";
import type { AiHistoryStatItem } from "@/components/ai-history/types";
import { formatCompactDateTime } from "@/utils/formatDateTime";

defineProps<{
  expanded?: boolean;
  statusErr?: string;
  tracesErr?: string;
  statusOverview: ReadonlyArray<AiHistoryStatItem>;
  status?: ConversationKernelStatus | null;
  statusBusy?: boolean;
  memoryPolicyLine?: string;
  traces: ReadonlyArray<ConversationKernelTraceRow>;
  tracesBusy?: boolean;
  expandedTraceKeys?: Readonly<Record<string, boolean>>;
  traceKey: (row: ConversationKernelTraceRow, index: number) => string;
  traceSummary: (row: ConversationKernelTraceRow) => string;
  opportunityClass: (row: ConversationKernelTraceRow) => string;
  opportunityLabel: (row: ConversationKernelTraceRow) => string;
}>();

const emit = defineEmits<{
  toggle: [];
  "toggle-trace": [key: string];
}>();
</script>

<template>
  <section class="ai-history-page__feedback ai-history-page__kernel-panel">
    <AiHistoryPanelShell
      title="对话内核"
      purpose="查看学习链路是否打开；排障时再展开"
      summary="学习开关与决策轨迹"
      :expanded="expanded"
      panel-class="ai-history-page__panel--compact"
      @toggle="emit('toggle')"
    >
      <div
        v-if="statusErr"
        class="alert alert--err"
      >
        {{ statusErr }}
      </div>
      <div
        v-if="tracesErr"
        class="alert alert--err"
      >
        {{ tracesErr }}
      </div>
      <div class="ai-history-page__kernel-chip-row">
        <span
          v-for="item in statusOverview"
          :key="item.label"
          class="ai-history-page__kernel-chip"
          :class="{ 'is-on': item.accent }"
        >
          {{ item.label }}：{{ item.value }}
        </span>
      </div>
      <p
        v-if="status && !statusBusy && memoryPolicyLine"
        class="muted ai-history-page__kernel-policy"
      >
        {{ memoryPolicyLine }}
      </p>
      <div
        v-if="traces.length"
        class="ai-history-page__feedback-list ai-history-page__kernel-trace-list"
      >
        <article
          v-for="(row, index) in traces"
          :key="traceKey(row, index)"
          class="ai-history-page__feedback-card ai-history-page__feedback-card--behavior"
        >
          <div class="ai-history-page__feedback-top">
            <strong class="ai-history-page__feedback-reply">{{ traceSummary(row) }}</strong>
            <span
              class="ai-history-page__outcome-badge"
              :class="opportunityClass(row)"
            >
              {{ opportunityLabel(row) }}
            </span>
          </div>
          <div class="ai-history-page__feedback-meta">
            <span v-if="row.group_id">群 {{ row.group_id }}</span>
            <span v-if="row.created_at">{{ formatCompactDateTime(row.created_at) }}</span>
          </div>
          <button
            type="button"
            class="ai-history-page__turn-toggle"
            @click="emit('toggle-trace', traceKey(row, index))"
          >
            {{ expandedTraceKeys?.[traceKey(row, index)] ? "收起原始数据" : "查看原始数据" }}
          </button>
          <pre
            v-if="expandedTraceKeys?.[traceKey(row, index)]"
            class="ai-history-page__kernel-trace-json"
          >{{ JSON.stringify(row, null, 2) }}</pre>
        </article>
      </div>
      <p
        v-else
        class="muted ai-history-page__empty-hint"
      >
        {{ tracesBusy ? "正在读取决策轨迹…" : "当前筛选下暂无决策轨迹" }}
      </p>
    </AiHistoryPanelShell>
  </section>
</template>
