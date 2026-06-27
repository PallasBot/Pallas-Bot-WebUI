<script setup lang="ts">
import { computed } from "vue";
import type { LlmModelSelectGroup } from "@/utils/llmModelOptionSources";
import { flattenLlmModelSelectGroups } from "@/utils/llmModelOptionSources";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    groups: LlmModelSelectGroup[];
    emptyLabel?: string;
    disabled?: boolean;
    ariaLabel?: string;
  }>(),
  {
    emptyLabel: "（回退默认本地模型）",
    disabled: false,
    ariaLabel: "选择模型",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const knownValues = computed(() => flattenLlmModelSelectGroups(props.groups));

const orphanValue = computed(() => {
  const current = (props.modelValue || "").trim();
  if (!current || knownValues.value.has(current)) return "";
  return current;
});

function onChange(event: Event) {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    class="inp llm-model-select"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @change="onChange"
  >
    <option value="">
      {{ emptyLabel }}
    </option>
    <template
      v-for="group in groups"
      :key="group.id"
    >
      <optgroup :label="group.label">
        <option
          v-for="option in group.options"
          :key="`${group.id}-${option.value}`"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </optgroup>
    </template>
    <option
      v-if="orphanValue"
      :value="orphanValue"
    >
      {{ orphanValue }} · 已保存
    </option>
  </select>
</template>

<style scoped>
.llm-model-select {
  width: 100%;
}
</style>
