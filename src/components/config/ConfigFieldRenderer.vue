<script setup lang="ts">
import { computed, ref } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import NumberStepperInput from "@/components/config/NumberStepperInput.vue";
import TagsInput from "@/components/config/TagsInput.vue";
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

const showSecret = ref(false);

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
      v-if="usesEnumSelect"
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
    <TagsInput
      v-else-if="usesTagsInput"
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
    <div
      v-else-if="usesSecretInput"
      class="config-field-renderer__secret"
    >
      <input
        :value="modelValue"
        class="inp form-field__control config-field-renderer__secret-input"
        :type="showSecret ? 'text' : 'password'"
        autocomplete="off"
        spellcheck="false"
        @input="setValue(($event.target as HTMLInputElement).value)"
      >
      <button
        type="button"
        class="config-field-renderer__eye"
        :aria-label="showSecret ? '隐藏密钥' : '显示密钥'"
        :aria-pressed="showSecret"
        @click="showSecret = !showSecret"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="showSecret">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.4 5.2A9.4 9.4 0 0 1 12 4.9c5 0 9 4.1 9 7.1a11 11 0 0 1-2.4 3.3" />
            <path d="M6.2 6.7A11 11 0 0 0 3 12c0 3 4 7.1 9 7.1a9.6 9.6 0 0 0 3.3-.6" />
          </template>
          <template v-else>
            <path d="M3 12c0-3 4-7.1 9-7.1s9 4.1 9 7.1-4 7.1-9 7.1S3 15 3 12Z" />
            <circle cx="12" cy="12" r="2.4" />
          </template>
        </svg>
      </button>
    </div>
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
    <input
      v-else-if="!usesBoolSwitch"
      :value="modelValue"
      class="inp form-field__control"
      type="text"
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
  justify-content: flex-start;
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

.config-field-renderer__secret {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: v-bind(inputMaxWidth);
}

.config-field-renderer__secret-input {
  width: 100%;
  padding-right: 40px;
}

.config-field-renderer__eye {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm, 6px);
  background: transparent;
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease;
}

.config-field-renderer__eye:hover {
  background: color-mix(in srgb, var(--accent, #ec4899) 10%, transparent);
}

.config-field-renderer__textarea {
  width: 100%;
  max-width: v-bind(inputMaxWidth);
  resize: vertical;
  font-family: inherit;
}
</style>
