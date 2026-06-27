<script setup lang="ts">
import { computed } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import LlmTaskRouteMatrix from "@/components/ai-config/LlmTaskRouteMatrix.vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import type { LlmModelSelectGroup } from "@/utils/llmModelOptionSources";

const props = defineProps<{
  providers: LlmProviderConfigRow[];
  tasks: Record<string, string>;
  chainFallback: string[];
  providerIds: string[];
  envTaskModels: Record<string, string>;
  modelSelectGroups: LlmModelSelectGroup[];
}>();

const emit = defineEmits<{
  "set-task": [task: string, providerId: string];
  "set-task-model": [task: string, providerId: string, model: string];
  "set-chain": [ids: string[]];
}>();

const fallbackChoices = computed(() =>
  props.providerIds.filter((id) => !props.chainFallback.includes(id)),
);

function moveFallback(index: number, dir: -1 | 1) {
  const next = [...props.chainFallback];
  const target = index + dir;
  if (target < 0 || target >= next.length) return;
  [next[index], next[target]] = [next[target]!, next[index]!];
  emit("set-chain", next);
}

function removeFallback(index: number) {
  emit("set-chain", props.chainFallback.filter((_, i) => i !== index));
}

function addFallback(id: string) {
  if (!id) return;
  emit("set-chain", [...props.chainFallback, id]);
}
</script>

<template>
  <div class="routing-editor">
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

    <div class="routing-editor__block">
      <h4 class="routing-editor__title">链路兜底顺序（chain_fallback）</h4>
      <p class="muted routing-editor__hint">
        未命中 task 路由时，按此顺序依次尝试。
      </p>
      <ol
        v-if="chainFallback.length"
        class="routing-editor__chain"
      >
        <li
          v-for="(id, i) in chainFallback"
          :key="id"
          class="routing-editor__chain-row"
        >
          <span class="routing-editor__chain-id">{{ i + 1 }}. {{ id }}</span>
          <div class="routing-editor__chain-actions">
            <UiButton
              variant="ghost"
              size="sm"
              :disabled="i === 0"
              @click="moveFallback(i, -1)"
            >
              ↑
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              :disabled="i === chainFallback.length - 1"
              @click="moveFallback(i, 1)"
            >
              ↓
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              @click="removeFallback(i)"
            >
              移除
            </UiButton>
          </div>
        </li>
      </ol>
      <p
        v-else
        class="muted routing-editor__empty"
      >
        未设置兜底顺序。
      </p>
      <div
        v-if="fallbackChoices.length"
        class="routing-editor__chain-add"
      >
        <select
          class="inp"
          @change="addFallback(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
        >
          <option value="">+ 添加 Provider 到兜底链…</option>
          <option
            v-for="pid in fallbackChoices"
            :key="pid"
            :value="pid"
          >
            {{ pid }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.routing-editor {
  display: grid;
  gap: 20px;
}

.routing-editor__title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 700;
}

.routing-editor__hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
}

.routing-editor__chain {
  list-style: none;
  margin: 0 0 10px;
  padding: 0;
  display: grid;
  gap: 6px;
}

.routing-editor__chain-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
}

.routing-editor__chain-id {
  font-size: 13px;
  font-weight: 600;
}

.routing-editor__chain-actions {
  display: flex;
  gap: 4px;
}

.routing-editor__empty {
  margin: 0 0 10px;
  font-size: 12px;
}

@media (max-width: 560px) {
  .routing-editor__chain-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
