<script setup lang="ts">
import { computed } from "vue";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import { boolSwitchLabel } from "@/utils/configFieldDisplay";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const switchLabel = computed(() => boolSwitchLabel(props.modelValue));
</script>

<template>
  <div
    class="plugin-runtime-switch"
    :class="{ 'plugin-runtime-switch--disabled': disabled }"
  >
    <div class="plugin-runtime-switch__row">
      <span class="plugin-runtime-switch__title">{{ title }}</span>
      <ConsoleSwitch
        :model-value="modelValue"
        :label="switchLabel"
        :disabled="disabled"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
    <div class="plugin-runtime-switch__desc">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.plugin-runtime-switch {
  display: grid;
  gap: 10px;
  padding: 14px 15px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 82%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.045)) 82%, transparent), transparent 72%),
    color-mix(in srgb, var(--surface-1, rgba(255, 255, 255, 0.028)) 97%, transparent);
}

.plugin-runtime-switch--disabled {
  opacity: 0.72;
}

.plugin-runtime-switch__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plugin-runtime-switch__title {
  font-size: 14px;
  line-height: 1.45;
  font-weight: 700;
}

.plugin-runtime-switch__desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-muted, rgba(255, 255, 255, 0.72));
}

.plugin-runtime-switch__desc :deep(p) {
  margin: 0;
}

@media (max-width: 560px) {
  .plugin-runtime-switch__row {
    align-items: flex-start;
  }
}
</style>
