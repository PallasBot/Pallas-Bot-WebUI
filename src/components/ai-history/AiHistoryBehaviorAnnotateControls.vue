<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import { BEHAVIOR_OUTCOME_OPTIONS } from "@/utils/aiHistoryLabels";

withDefaults(
  defineProps<{
    labels: ReadonlyArray<string>;
    selectedLabels?: ReadonlyArray<string> | null;
    outcome?: string | null;
    busy?: boolean;
    disabledSample?: boolean;
    outcomeLabel?: string;
    disableVariant?: "outline" | "ghost";
    disableSize?: "sm" | "md";
    actionBtnClass?: string;
  }>(),
  {
    selectedLabels: () => [],
    outcome: "",
    busy: false,
    disabledSample: false,
    outcomeLabel: "结果",
    disableVariant: "outline",
    disableSize: "md",
    actionBtnClass: "",
  },
);

const emit = defineEmits<{
  "toggle-label": [label: string];
  "update:outcome": [value: string];
  "toggle-disabled": [];
}>();

function isLabelOn(label: string, selected: ReadonlyArray<string> | null | undefined): boolean {
  return Array.isArray(selected) && selected.includes(label);
}
</script>

<template>
  <div class="ai-history-page__behavior-labels">
    <button
      v-for="label in labels"
      :key="label"
      type="button"
      class="ai-history-page__behavior-chip"
      :class="{ 'is-on': isLabelOn(label, selectedLabels) }"
      :disabled="busy"
      @click="emit('toggle-label', label)"
    >
      {{ label }}
    </button>
  </div>
  <div class="ai-history-page__behavior-actions">
    <label class="ai-history-page__behavior-select">
      <span>{{ outcomeLabel }}</span>
      <UiSelect
        :model-value="outcome || ''"
        :disabled="busy"
        @update:model-value="emit('update:outcome', $event)"
      >
        <option
          v-for="item in BEHAVIOR_OUTCOME_OPTIONS"
          :key="item.value || 'empty'"
          :value="item.value"
        >
          {{ item.label }}
        </option>
      </UiSelect>
    </label>
    <UiButton
      :size="disableSize"
      :variant="disableVariant"
      :class="actionBtnClass"
      :busy="busy"
      @click="emit('toggle-disabled')"
    >
      {{ disabledSample ? "恢复样本" : "禁用样本" }}
    </UiButton>
  </div>
</template>
