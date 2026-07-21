<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import UiField from "@/components/ui/UiField.vue";
import { resolveConfigFieldLayout } from "@/utils/pluginConfigFieldModel";
import { fieldCompactMeta, fieldDisplayName } from "@/utils/pluginConfigWorkspaceModel";

const props = defineProps<{
  field: PluginConfigField;
  modelValue: string;
  helpExpanded?: boolean;
  jsonTitle?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "help-click": [event: MouseEvent];
  "help-hover": [event: MouseEvent];
  "help-hover-leave": [];
  "edit-click": [];
}>();

const layout = computed(() => resolveConfigFieldLayout(props.field));
const typeMeta = computed(() => fieldCompactMeta(props.field));
const title = computed(() => fieldDisplayName(props.field));
</script>

<template>
  <UiField
    class="plugin-config-form-item"
    :class="`plugin-config-form-item--${layout}`"
    :label="title"
    :required="field.required"
    :secret="Boolean(field.secret)"
  >
    <template #label-end>
      <button
        type="button"
        class="plugin-config-form-item__help-btn"
        :class="{ 'plugin-config-form-item__help-btn--has-desc': field.description }"
        :aria-expanded="helpExpanded"
        :aria-label="`查看 ${title} 说明`"
        @click.stop="emit('help-click', $event)"
        @mouseenter="emit('help-hover', $event)"
        @mouseleave="emit('help-hover-leave')"
      >
        ?
      </button>
    </template>
    <template #meta>
      <span
        v-for="meta in typeMeta"
        :key="`${field.name}-${meta}`"
        class="plugin-config-form-item__meta-pill"
      >
        {{ meta }}
      </span>
      <button
        type="button"
        class="plugin-config-form-item__edit-btn"
        :aria-label="`编辑 ${title}`"
        @click.stop="emit('edit-click')"
      >
        编辑
      </button>
    </template>
    <ConfigFieldRenderer
      :field="field"
      :model-value="modelValue"
      :show-label="false"
      :show-meta="false"
      :show-description="false"
      :json-title="jsonTitle"
      input-max-width="100%"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </UiField>
</template>

<style scoped>
.plugin-config-form-item--tall {
  grid-column: 1 / -1;
}

.plugin-config-form-item__meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  background: transparent;
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted);
}

.plugin-config-form-item__help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  min-width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: help;
  opacity: 0.45;
  transition: opacity 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}

.plugin-config-form-item__edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.plugin-config-form-item__edit-btn:hover {
  color: color-mix(in srgb, var(--accent) 82%, var(--text) 8%);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.plugin-config-form-item__help-btn:hover,
.plugin-config-form-item__help-btn[aria-expanded="true"] {
  opacity: 1;
  color: color-mix(in srgb, var(--accent) 78%, var(--text) 12%);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.plugin-config-form-item__help-btn--has-desc {
  opacity: 0.62;
  color: color-mix(in srgb, var(--accent) 68%, var(--text-muted) 32%);
}

.plugin-config-form-item :deep(.ui-field__control .config-field-renderer) {
  gap: 0;
}

.plugin-config-form-item :deep(.form-field__control),
.plugin-config-form-item :deep(.inp),
.plugin-config-form-item :deep(.sel),
.plugin-config-form-item :deep(.textarea),
.plugin-config-form-item :deep(.json-textarea-field__peek),
.plugin-config-form-item :deep(.tags-input--embedded),
.plugin-config-form-item :deep(.ui-input),
.plugin-config-form-item :deep(.ui-select) {
  border-radius: 8px;
  min-height: 40px;
  box-shadow: none;
}

.plugin-config-form-item :deep(.json-textarea-field__peek) {
  min-height: 132px;
}
</style>
