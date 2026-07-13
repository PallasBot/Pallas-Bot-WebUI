<script setup lang="ts">
import { LLM_PROVIDER_PRESETS } from "@/config/llmProviderPresets";
import type { LlmProviderPresetId } from "@/config/llmProviderPresets";

defineProps<{
  selectedId: LlmProviderPresetId;
}>();

const emit = defineEmits<{
  select: [id: LlmProviderPresetId];
}>();
</script>

<template>
  <div
    class="provider-preset-picker"
    role="listbox"
    aria-label="选择云端服务商"
  >
    <button
      v-for="preset in LLM_PROVIDER_PRESETS"
      :key="preset.id"
      type="button"
      class="provider-preset-picker__item"
      :class="{ 'is-selected': preset.id === selectedId }"
      role="option"
      :aria-selected="preset.id === selectedId"
      @click="emit('select', preset.id)"
    >
      {{ preset.label }}
    </button>
  </div>
</template>

<style scoped>
.provider-preset-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.provider-preset-picker__item {
  text-align: left;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  border-radius: 14px;
  color: var(--text);
  background: color-mix(in srgb, var(--bg-card) 88%, transparent);
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
}

.provider-preset-picker__item:hover {
  border-color: color-mix(in srgb, var(--primary, var(--accent)) 45%, var(--border));
}

.provider-preset-picker__item.is-selected {
  border-color: color-mix(in srgb, var(--primary, var(--accent)) 72%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 10%, var(--bg-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary, var(--accent)) 24%, transparent);
}

@media (max-width: 560px) {
  .provider-preset-picker {
    grid-template-columns: 1fr;
  }
}
</style>
