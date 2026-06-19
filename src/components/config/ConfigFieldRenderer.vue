<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import {
  binaryEnumIsOn,
  binaryEnumOffChoice,
  binaryEnumOnChoice,
  binaryEnumSwitchLabel,
  boolChoiceLabel,
  enumChoiceLabel,
  fieldDisplayTitle,
  isBinaryBoolEnum,
} from "@/utils/configFieldDisplay";

const props = withDefaults(
  defineProps<{
    field: PluginConfigField;
    modelValue: string;
    showLabel?: boolean;
    showMeta?: boolean;
    showDescription?: boolean;
    jsonTitle?: string;
    inputMaxWidth?: string;
  }>(),
  {
    showLabel: true,
    showMeta: true,
    showDescription: true,
    inputMaxWidth: "520px",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const usesBoolSwitch = computed(
  () => props.field.kind === "bool" || isBinaryBoolEnum(props.field),
);

const boolSwitchValue = computed(() => {
  if (props.field.kind === "bool") return props.modelValue === "true";
  return binaryEnumIsOn(props.field, props.modelValue);
});

const boolSwitchLabelText = computed(() => {
  if (props.field.kind === "bool") return boolChoiceLabel(props.modelValue);
  return binaryEnumSwitchLabel(props.field, props.modelValue);
});

function setValue(next: string) {
  emit("update:modelValue", next);
}

function onBoolChange(checked: boolean) {
  if (props.field.kind === "bool") {
    setValue(checked ? "true" : "false");
    return;
  }
  setValue(checked ? binaryEnumOnChoice(props.field) : binaryEnumOffChoice(props.field));
}
</script>

<template>
  <div
    class="config-field-renderer form-field"
    :class="{ 'config-field-renderer--bool': usesBoolSwitch }"
  >
    <div
      v-if="usesBoolSwitch && showLabel"
      class="config-field-renderer__bool-head"
    >
      <div class="config-field-renderer__title form-field__label form-field__label--title">
        {{ fieldDisplayTitle(field) }}
        <span
          v-if="!field.label"
          class="muted config-field-renderer__kind"
        >（{{ field.kind }}）</span>
      </div>
      <ConsoleSwitch
        :model-value="boolSwitchValue"
        :label="boolSwitchLabelText"
        @update:model-value="onBoolChange"
      />
    </div>
    <div
      v-else-if="usesBoolSwitch"
      class="config-field-renderer__bool-only"
    >
      <ConsoleSwitch
        :model-value="boolSwitchValue"
        :label="boolSwitchLabelText"
        @update:model-value="onBoolChange"
      />
    </div>
    <template v-else>
      <div
        v-if="showLabel"
        class="form-field__label form-field__label--title config-field-renderer__title"
      >
        {{ fieldDisplayTitle(field) }}
        <span
          v-if="!field.label"
          class="muted config-field-renderer__kind"
        >（{{ field.kind }}）</span>
      </div>
    </template>
    <div
      v-if="showDescription && field.description"
      class="muted common-config-field-desc config-field-renderer__desc"
    >
      {{ field.description }}
    </div>
    <div
      v-if="showMeta"
      class="muted config-field-renderer__meta"
    >
      配置键: <code>{{ field.env_key }}</code>
      · 默认：{{ JSON.stringify(field.default) }}
    </div>
    <select
      v-if="field.kind === 'enum' && field.choices?.length && !isBinaryBoolEnum(field)"
      :value="modelValue"
      class="sel form-field__control"
      @change="setValue(($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="opt in field.choices"
        :key="opt"
        :value="opt"
      >
        {{ enumChoiceLabel(opt, field) }}
      </option>
    </select>
    <JsonTextareaField
      v-else-if="field.kind === 'json'"
      :model-value="modelValue"
      :title="jsonTitle || `${field.name}（JSON）`"
      :rows="6"
      @update:model-value="setValue"
    />
    <input
      v-else-if="!usesBoolSwitch"
      :value="modelValue"
      class="inp form-field__control"
      type="text"
      :inputmode="field.kind === 'int' ? 'numeric' : field.kind === 'float' ? 'decimal' : undefined"
      @input="setValue(($event.target as HTMLInputElement).value)"
    >
  </div>
</template>

<style scoped>
.config-field-renderer__title {
  margin-bottom: 0;
}
.config-field-renderer__kind {
  font-weight: 500;
}
.config-field-renderer__desc {
  font-size: 13px;
  margin-bottom: 0;
}
.config-field-renderer__bool-only {
  display: flex;
  justify-content: flex-end;
}

.config-field-renderer :deep(.form-field__control),
.config-field-renderer :deep(.json-textarea-field),
.config-field-renderer :deep(.sel),
.config-field-renderer :deep(.inp) {
  width: 100%;
}

.config-field-renderer :deep(.form-field__control),
.config-field-renderer :deep(.json-textarea-field) {
  max-width: v-bind(inputMaxWidth);
}
</style>
