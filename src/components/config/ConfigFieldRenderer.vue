<script setup lang="ts">
import { computed } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import NumberStepperInput from "@/components/config/NumberStepperInput.vue";
import TagsInput from "@/components/config/TagsInput.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSelect from "@/components/ui/UiSelect.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";
import { isStringListField, tagsFromJsonText, tagsToJsonText } from "@/utils/pluginConfigFieldModel";
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
    showJsonExpandButton?: boolean;
    inputMaxWidth?: string;
  }>(),
  {
    showLabel: true,
    showMeta: true,
    showDescription: true,
    showJsonExpandButton: true,
    inputMaxWidth: "520px",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const usesBoolSwitch = computed(
  () => props.field.kind === "bool" || isBinaryBoolEnum(props.field),
);

const usesEnumSelect = computed(
  () =>
    props.field.kind === "enum" &&
    Boolean(props.field.choices?.length) &&
    !isBinaryBoolEnum(props.field),
);

const usesNumberStepper = computed(
  () => props.field.kind === "int" || props.field.kind === "float",
);

const usesSecretInput = computed(
  () => props.field.kind === "string" && Boolean(props.field.secret),
);

const usesMultiline = computed(
  () => props.field.kind === "string" && Boolean(props.field.multiline),
);

const usesTagsInput = computed(() => isStringListField(props.field));

const boolSwitchValue = computed(() => {
  if (props.field.kind === "bool") return props.modelValue === "true";
  return binaryEnumIsOn(props.field, props.modelValue);
});

const boolSwitchLabelText = computed(() => {
  if (props.field.kind === "bool") return boolChoiceLabel(props.modelValue);
  return binaryEnumSwitchLabel(props.field, props.modelValue);
});

const tagsValue = computed(() => tagsFromJsonText(props.modelValue));

const numberKind = computed<"int" | "float">(() => (props.field.kind === "float" ? "float" : "int"));

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

function onTagsChange(tags: string[]) {
  setValue(tagsToJsonText(tags));
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
      <UiSwitch
        :model-value="boolSwitchValue"
        :label="boolSwitchLabelText"
        :aria-label="boolSwitchLabelText"
        @update:model-value="onBoolChange"
      />
    </div>
    <div
      v-else-if="usesBoolSwitch"
      class="config-field-renderer__bool-only"
    >
      <UiSwitch
        :model-value="boolSwitchValue"
        :label="boolSwitchLabelText"
        :aria-label="boolSwitchLabelText"
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
    <UiSelect
      v-if="usesEnumSelect"
      class="form-field__control"
      :model-value="modelValue"
      @update:model-value="setValue"
    >
      <option
        v-for="opt in field.choices"
        :key="opt"
        :value="opt"
      >
        {{ enumChoiceLabel(opt, field) }}
      </option>
    </UiSelect>
    <TagsInput
      v-else-if="usesTagsInput"
      variant="embedded"
      :model-value="tagsValue"
      @update:model-value="onTagsChange"
    />
    <JsonTextareaField
      v-else-if="field.kind === 'json'"
      :model-value="modelValue"
      :title="jsonTitle || `${field.name}（JSON）`"
      :rows="6"
      :show-expand-button="showJsonExpandButton"
      @update:model-value="setValue"
    />
    <UiInput
      v-else-if="usesSecretInput"
      class="form-field__control"
      type="password"
      revealable
      autocomplete="off"
      :model-value="modelValue"
      @update:model-value="setValue"
    />
    <NumberStepperInput
      v-else-if="usesNumberStepper"
      :model-value="modelValue"
      :kind="numberKind"
      :min="field.min_value"
      :max="field.max_value"
      :max-width="inputMaxWidth"
      @update:model-value="setValue"
    />
    <textarea
      v-else-if="usesMultiline"
      :value="modelValue"
      class="textarea form-field__control config-field-renderer__textarea"
      rows="4"
      @input="setValue(($event.target as HTMLTextAreaElement).value)"
    />
    <UiInput
      v-else-if="!usesBoolSwitch"
      class="form-field__control"
      type="text"
      :model-value="modelValue"
      @update:model-value="setValue"
    />
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
  justify-content: flex-start;
}

.config-field-renderer :deep(.form-field__control),
.config-field-renderer :deep(.json-textarea-field),
.config-field-renderer :deep(.sel),
.config-field-renderer :deep(.inp),
.config-field-renderer :deep(.ui-input-wrap),
.config-field-renderer :deep(.ui-select) {
  width: 100%;
}

.config-field-renderer :deep(.form-field__control),
.config-field-renderer :deep(.json-textarea-field),
.config-field-renderer :deep(.ui-input-wrap) {
  max-width: v-bind(inputMaxWidth);
}

.config-field-renderer__textarea {
  width: 100%;
  max-width: v-bind(inputMaxWidth);
  resize: vertical;
  font-family: inherit;
}
</style>
