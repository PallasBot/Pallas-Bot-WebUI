<script setup lang="ts">
import LlmTaskRouteMatrix from "@/components/ai-config/LlmTaskRouteMatrix.vue";
import ChainFallbackChips from "@/components/ai-config/providers/ChainFallbackChips.vue";
import TaskRouteRows from "@/components/ai-config/providers/TaskRouteRows.vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import type { LlmModelSelectGroup } from "@/utils/llmModelOptionSources";

defineProps<{
  providers: LlmProviderConfigRow[];
  tasks: Record<string, string>;
  chainFallback: string[];
  providerIds: string[];
  envTaskModels: Record<string, string>;
  modelSelectGroups: LlmModelSelectGroup[];
  discoveredByProvider?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  "set-task": [task: string, providerId: string];
  "set-task-model": [task: string, providerId: string, model: string];
  "set-chain": [ids: string[]];
}>();
</script>

<template>
  <div class="routing-editor">
    <TaskRouteRows
      :providers="providers"
      :tasks="tasks"
      :chain-fallback="chainFallback"
      :provider-ids="providerIds"
      :env-task-models="envTaskModels"
      :model-select-groups="modelSelectGroups"
      :discovered-by-provider="discoveredByProvider || {}"
      @set-task="(task, providerId) => emit('set-task', task, providerId)"
      @set-task-model="(task, providerId, model) => emit('set-task-model', task, providerId, model)"
    />

    <ChainFallbackChips
      :chain-fallback="chainFallback"
      :provider-ids="providerIds"
      @set-chain="(ids) => emit('set-chain', ids)"
    />

    <details class="routing-editor__matrix-details">
      <summary class="routing-editor__matrix-summary">表格视图</summary>
      <LlmTaskRouteMatrix
        :providers="providers"
        :tasks="tasks"
        :chain-fallback="chainFallback"
        :provider-ids="providerIds"
        :env-task-models="envTaskModels"
        :model-select-groups="modelSelectGroups"
        @set-task="(task, providerId) => emit('set-task', task, providerId)"
        @set-task-model="(task, providerId, model) => emit('set-task-model', task, providerId, model)"
      />
    </details>
  </div>
</template>

<style scoped>
.routing-editor {
  display: grid;
  gap: 20px;
}

.routing-editor__matrix-details {
  border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  padding-top: 12px;
}

.routing-editor__matrix-summary {
  cursor: pointer;
  color: var(--text-muted, #94a3b8);
  font-size: 12px;
  font-weight: 650;
}

.routing-editor__matrix-details > :deep(.task-route-matrix) {
  margin-top: 12px;
}
</style>
