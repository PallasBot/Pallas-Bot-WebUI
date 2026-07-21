<script setup lang="ts">
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";

withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    label?: string;
    /** 默认不显示旁侧文案（清爽） */
    showLabel?: boolean;
    ariaLabel?: string;
    tone?: "default" | "amber";
  }>(),
  {
    disabled: false,
    showLabel: false,
    tone: "default",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<template>
  <ConsoleSwitch
    class="ui-switch"
    :model-value="modelValue"
    :disabled="disabled"
    :label="label"
    :show-label="showLabel"
    :aria-label="ariaLabel || label"
    :tone="tone"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>
