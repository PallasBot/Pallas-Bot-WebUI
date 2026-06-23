<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConfigFieldRenderer from "@/components/config/ConfigFieldRenderer.vue";
import { pluginConfigFieldIcon } from "@/utils/pluginConfigFieldIcon";
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
</script>

<template>
  <div
    class="plugin-config-form-item"
    :class="`plugin-config-form-item--${layout}`"
  >
    <div class="plugin-config-form-item__label-row">
      <label class="plugin-config-form-item__label">
        <span
          class="plugin-config-form-item__icon"
          aria-hidden="true"
        >{{ pluginConfigFieldIcon(field) }}</span>
        <span class="plugin-config-form-item__label-text">
          {{ fieldDisplayName(field) }}
        </span>
        <span
          v-if="field.required"
          class="plugin-config-form-item__required"
        >*</span>
      </label>
      <div class="plugin-config-form-item__label-side">
        <div class="plugin-config-form-item__meta-list">
          <span
            v-if="field.secret"
            class="plugin-config-form-item__meta-pill plugin-config-form-item__meta-pill--secret"
          >
            密钥
          </span>
          <span
            v-for="meta in fieldCompactMeta(field)"
            :key="`${field.name}-${meta}`"
            class="plugin-config-form-item__meta-pill"
          >
            {{ meta }}
          </span>
        </div>
        <button
          type="button"
          class="plugin-config-form-item__edit-btn"
          :aria-label="`编辑 ${fieldDisplayName(field)}`"
          @click.stop="emit('edit-click')"
        >
          编辑
        </button>
        <button
          type="button"
          class="plugin-config-form-item__help-btn"
          :class="{ 'plugin-config-form-item__help-btn--has-desc': field.description }"
          :aria-expanded="helpExpanded"
          :aria-label="`查看 ${fieldDisplayName(field)} 说明`"
          @click.stop="emit('help-click', $event)"
          @mouseenter="emit('help-hover', $event)"
          @mouseleave="emit('help-hover-leave')"
        >
          ?
        </button>
      </div>
    </div>
    <div class="plugin-config-form-item__control">
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
    </div>
  </div>
</template>

<style scoped>
.plugin-config-form-item {
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 0;
  box-shadow: none;
  min-width: 0;
  display: grid;
  gap: 6px;
  align-content: start;
}

.plugin-config-form-item--tall {
  grid-column: 1 / -1;
}

.plugin-config-form-item__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 20px;
}

.plugin-config-form-item__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--text-muted, rgba(255, 255, 255, 0.82));
  font-size: 12px;
  line-height: 1.35;
  font-weight: 600;
}

.plugin-config-form-item__label-text {
  min-width: 0;
}

.plugin-config-form-item__icon {
  flex: 0 0 auto;
  font-size: 13px;
  line-height: 1;
}

.plugin-config-form-item__meta-pill--secret {
  color: color-mix(in srgb, #f59e0b 84%, var(--text, #fff) 8%);
  border-color: color-mix(in srgb, #f59e0b 42%, transparent);
  background: color-mix(in srgb, #f59e0b 8%, transparent);
  font-weight: 700;
}

.plugin-config-form-item__required {
  color: color-mix(in srgb, var(--danger, #ef4444) 80%, var(--text, #fff) 10%);
  font-size: 12px;
  line-height: 1;
}

.plugin-config-form-item__label-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.plugin-config-form-item__meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.plugin-config-form-item__meta-pill {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
  background: transparent;
  font-size: 10px;
  line-height: 1;
  color: var(--text-muted, rgba(255, 255, 255, 0.72));
}

.plugin-config-form-item__help-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.02)) 98%, transparent);
  color: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.plugin-config-form-item__edit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
  background: transparent;
  color: var(--text-muted, rgba(255, 255, 255, 0.76));
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.plugin-config-form-item__edit-btn:hover {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 16%, transparent);
  background: color-mix(in srgb, var(--accent, #ec4899) 6%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 82%, var(--text, #fff) 8%);
}

.plugin-config-form-item__help-btn:hover,
.plugin-config-form-item__help-btn[aria-expanded="true"] {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 16%, transparent);
  background: color-mix(in srgb, var(--accent, #ec4899) 6%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 82%, var(--text, #fff) 8%);
}

.plugin-config-form-item__control {
  min-width: 0;
}

.plugin-config-form-item__control :deep(.config-field-renderer) {
  gap: 0;
}

.plugin-config-form-item__control :deep(.form-field__control),
.plugin-config-form-item__control :deep(.inp),
.plugin-config-form-item__control :deep(.sel),
.plugin-config-form-item__control :deep(.textarea),
.plugin-config-form-item__control :deep(.json-textarea-field__peek) {
  border-radius: 8px;
  min-height: 38px;
}

.plugin-config-form-item__control :deep(.json-textarea-field__peek) {
  min-height: 132px;
}

.plugin-config-form-item__control :deep(.json-textarea-field__expand) {
  min-height: 30px;
}

.plugin-config-form-item__help-btn--has-desc {
  border-color: color-mix(in srgb, var(--accent, #ec4899) 22%, transparent);
  color: color-mix(in srgb, var(--accent, #ec4899) 78%, var(--text, #fff) 12%);
}

@media (max-width: 560px) {
  .plugin-config-form-item__label-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .plugin-config-form-item__label-side,
  .plugin-config-form-item__meta-list {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
