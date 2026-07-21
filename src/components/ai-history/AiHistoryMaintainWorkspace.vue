<script setup lang="ts">
import AiHistoryWorkspaceHero from "@/components/ai-history/AiHistoryWorkspaceHero.vue";

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: "群维护",
    description: "按群整理接话学习：样本、晋升写回、行为判定与对话内核状态。",
  },
);
</script>

<template>
  <div class="ai-history-page__workspace ai-history-page__workspace--maintain plugin-config-page">
    <AiHistoryWorkspaceHero
      :title="title"
      :description="description"
    />
    <slot />
  </div>
</template>
