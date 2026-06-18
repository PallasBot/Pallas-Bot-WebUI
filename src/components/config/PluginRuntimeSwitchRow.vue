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
