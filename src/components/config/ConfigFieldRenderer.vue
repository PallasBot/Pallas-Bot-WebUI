<script setup lang="ts">
import { computed, ref } from "vue";
import type { PluginConfigField } from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
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

const numberStep = computed(() => (props.field.kind === "float" ? "any" : "1"));

const boolSwitchValue = computed(() => {
  if (props.field.kind === "bool") return props.modelValue === "true";
  return binaryEnumIsOn(props.field, props.modelValue);
});

const boolSwitchLabelText = computed(() => {
  if (props.field.kind === "bool") return boolChoiceLabel(props.modelValue);
  return binaryEnumSwitchLabel(props.field, props.modelValue);
});

const tagsValue = computed(() => tagsFromJsonText(props.modelValue));

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

function clampNumber(raw: string, opts: { min?: boolean; max?: boolean } = { min: true, max: true }): string {
  const text = raw.trim();
  if (text === "") return text;
  const n = Number(text);
  if (!Number.isFinite(n)) return raw;
  let clamped = n;
  if (opts.min && props.field.min_value !== undefined && clamped < props.field.min_value) {
    clamped = props.field.min_value;
  }
  if (opts.max && props.field.max_value !== undefined && clamped > props.field.max_value) {
    clamped = props.field.max_value;
  }
  return String(clamped);
}

// 输入中只夹住上界，避免输入「64」过程中把「6」夹成 min 而打断输入；下界在失焦时补夹。
function onNumberInput(raw: string) {
  setValue(clampNumber(raw, { max: true }));
}

function onNumberBlur(raw: string) {
  setValue(clampNumber(raw));
}

function stepNumber(direction: 1 | -1) {
  const current = Number(props.modelValue);
  const start = Number.isFinite(current) ? current : props.field.min_value ?? 0;
  setValue(clampNumber(String(start + direction)));
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
        {{ showSecret ? "🙈" : "👁" }}
      </button>
    </div>
    <div
      v-else-if="usesNumberStepper"
      class="config-field-renderer__number"
    >
      <input
        :value="modelValue"
        class="inp form-field__control config-field-renderer__number-input"
        type="number"
        :inputmode="field.kind === 'int' ? 'numeric' : 'decimal'"
        :min="field.min_value"
        :max="field.max_value"
        :step="numberStep"
        @input="onNumberInput(($event.target as HTMLInputElement).value)"
        @blur="onNumberBlur(($event.target as HTMLInputElement).value)"
      >
      <div class="config-field-renderer__steppers">
        <button
          type="button"
          class="config-field-renderer__step"
          aria-label="增加"
          @click="stepNumber(1)"
        >
          ▲
        </button>
        <button
          type="button"
          class="config-field-renderer__step"
          aria-label="减少"
          @click="stepNumber(-1)"
        >
          ▼
        </button>
      </div>
    </div>
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

.config-field-renderer__secret,
.config-field-renderer__number {
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

.config-field-renderer__number-input {
  width: 100%;
  padding-right: 34px;
  -moz-appearance: textfield;
  appearance: textfield;
}

.config-field-renderer__number-input::-webkit-outer-spin-button,
.config-field-renderer__number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.config-field-renderer__steppers {
  position: absolute;
  top: 1px;
  right: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  width: 28px;
}

.config-field-renderer__step {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-left: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 80%, transparent);
  background: transparent;
  color: var(--text-muted, rgba(255, 255, 255, 0.6));
  font-size: 8px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.config-field-renderer__step:first-child {
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 80%, transparent);
}

.config-field-renderer__step:hover {
  background: color-mix(in srgb, var(--accent, #ec4899) 12%, transparent);
  color: var(--text, #fff);
}

.config-field-renderer__textarea {
  width: 100%;
  max-width: v-bind(inputMaxWidth);
  resize: vertical;
  font-family: inherit;
}
</style>
