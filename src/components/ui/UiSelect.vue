<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue?: string;
    disabled?: boolean;
    invalid?: boolean;
    ariaLabel?: string;
  }>(),
  {
    modelValue: "",
    disabled: false,
    invalid: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function onChange(ev: Event) {
  emit("update:modelValue", (ev.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    class="sel ui-select"
    :class="{ 'ui-select--invalid': invalid }"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :aria-invalid="invalid || undefined"
    @change="onChange"
  >
    <slot />
  </select>
</template>

<style scoped>
.ui-select {
  width: 100%;
}

.ui-select--invalid {
  border-color: color-mix(in srgb, var(--danger, #ef4444) 55%, var(--control-border));
}
</style>
