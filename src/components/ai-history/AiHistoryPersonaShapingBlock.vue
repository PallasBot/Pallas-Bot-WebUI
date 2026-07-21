<script setup lang="ts">
import type { LlmPersonaShapingSummary } from "@/api/pallasTypes";

withDefaults(
  defineProps<{
    busy?: boolean;
    error?: string;
    summary?: LlmPersonaShapingSummary | null;
  }>(),
  {
    busy: false,
    error: "",
    summary: null,
  },
);

function taskLabel(summary: LlmPersonaShapingSummary | null): string {
  const task = String(summary?.source_task || "").trim();
  if (!task) return "未知任务";
  if (task === "llm_chat") return "@ 闲聊";
  if (task.startsWith("repeater")) return "复读 / 语料";
  return task;
}
</script>

<template>
  <section class="ai-history-page__maintain-section ai-history-page__persona-shaping-section">
    <h5 class="ai-history-page__maintain-section-title">
      牛格塑形
    </h5>
    <p class="muted ai-history-page__maintain-hint">
      展示本轮请求注入的塑形摘要；@ 闲聊含完整塑形块，复读链路通常较轻。
    </p>
    <div
      v-if="busy"
      class="muted ai-history-page__maintain-hint"
    >
      加载塑形摘要…
    </div>
    <p
      v-else-if="error"
      class="ai-history-page__maintain-empty"
    >
      未找到 runtime 快照：{{ error }}
    </p>
    <template v-else-if="summary">
      <div class="ai-history-page__maintain-meta">
        <span>任务：{{ taskLabel(summary) }}</span>
        <span>
          塑形块：
          {{ summary.persona_shaping_active ? "已注入" : "未注入" }}
        </span>
      </div>
      <p
        v-if="!summary.persona_shaping_active"
        class="muted ai-history-page__maintain-hint"
      >
        未注入表示本轮请求未写入【本轮牛格塑形】；常见于复读/语料链路、功能上线前的旧记录，或当时未解析到 persona。
      </p>
      <ul
        v-if="summary.lines?.length"
        class="ai-history-page__persona-shaping-lines"
      >
        <li
          v-for="(line, lineIndex) in summary.lines"
          :key="`shaping-line-${lineIndex}`"
        >
          {{ line }}
        </li>
      </ul>
      <p
        v-if="summary.dynamic_expression"
        class="ai-history-page__persona-shaping-extra"
      >
        {{ summary.dynamic_expression }}
      </p>
      <p
        v-if="summary.variation_hint"
        class="ai-history-page__persona-shaping-extra muted"
      >
        {{ summary.variation_hint }}
      </p>
      <p class="muted ai-history-page__maintain-hint ai-history-page__persona-shaping-note">
        {{ summary.compare_note }}
      </p>
    </template>
    <p
      v-else
      class="ai-history-page__maintain-empty"
    >
      暂无塑形摘要（可能为旧请求或未落盘 runtime 快照）。
    </p>
  </section>
</template>
