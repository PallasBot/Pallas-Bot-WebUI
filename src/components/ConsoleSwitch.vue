<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    label?: string;
    showLabel?: boolean;
    /** 开发模式等场景保留琥珀色轨道 */
    tone?: "default" | "amber";
    ariaLabel?: string;
  }>(),
  {
    disabled: false,
    showLabel: true,
    tone: "default",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function onChange(ev: Event) {
  emit("update:modelValue", (ev.target as HTMLInputElement).checked);
}
</script>

<template>
  <label
    class="console-bool-switch"
    :class="{
      'console-bool-switch--on': modelValue,
      'console-bool-switch--amber': tone === 'amber',
    }"
  >
    <input
      type="checkbox"
      class="console-bool-switch__input"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || label"
      @change="onChange"
    >
    <span
      class="console-bool-switch__track"
      aria-hidden="true"
    >
      <span class="console-bool-switch__thumb" />
    </span>
    <span
      v-if="showLabel && label"
      class="console-bool-switch__label"
    >{{ label }}</span>
  </label>
</template>
