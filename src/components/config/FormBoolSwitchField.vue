<script setup lang="ts">
import { computed } from "vue";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import { boolSwitchLabel } from "@/utils/configFieldDisplay";

const props = withDefaults(
  defineProps<{
    label: string;
    modelValue: boolean;
    hint?: string;
    disabled?: boolean;
    labelStyle?: "onoff" | "yesno";
  }>(),
  {
    labelStyle: "onoff",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const switchLabel = computed(() => boolSwitchLabel(props.modelValue, props.labelStyle));
</script>

<template>
  <div class="form-bool-switch-field">
    <div class="form-bool-switch-field__row">
      <span class="form-bool-switch-field__label">{{ label }}</span>
      <ConsoleSwitch
        :model-value="modelValue"
        :label="switchLabel"
        :disabled="disabled"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
    <p
      v-if="hint"
      class="form-bool-switch-field__hint muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
