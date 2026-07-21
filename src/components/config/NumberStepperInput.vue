<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    kind?: "int" | "float";
    min?: number;
    max?: number;
    disabled?: boolean;
    ariaLabel?: string;
    maxWidth?: string;
  }>(),
  {
    kind: "int",
    maxWidth: "100%",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

// float 字段按 0.1 递增，避免步长 1 把 0–1 范围的取值夹成只有 0/1。
const stepSize = computed(() => (props.kind === "float" ? 0.1 : 1));
const inputStep = computed(() => (props.kind === "float" ? "any" : "1"));
const inputMode = computed(() => (props.kind === "int" ? "numeric" : "decimal"));

function normalize(n: number): number {
  if (props.kind !== "float") return n;
  // 修正 0.1 + 0.2 之类的浮点误差
  return Number(n.toFixed(6));
}

function clampNumber(raw: string, opts: { min?: boolean; max?: boolean } = { min: true, max: true }): string {
  const text = raw.trim();
  if (text === "") return text;
  const n = Number(text);
  if (!Number.isFinite(n)) return raw;
  let clamped = n;
  if (opts.min && props.min !== undefined && clamped < props.min) clamped = props.min;
  if (opts.max && props.max !== undefined && clamped > props.max) clamped = props.max;
  return String(normalize(clamped));
}

function setValue(next: string) {
  emit("update:modelValue", next);
}

// 输入中只夹住上界，避免输入「64」过程中把「6」夹成 min 而打断输入；下界在失焦时补夹。
function onInput(raw: string) {
  setValue(clampNumber(raw, { max: true }));
}

function onBlur(raw: string) {
  setValue(clampNumber(raw));
}

function step(direction: 1 | -1) {
  const current = Number(props.modelValue);
  const start = Number.isFinite(current) ? current : props.min ?? 0;
  const next = normalize(start + direction * stepSize.value);
  setValue(clampNumber(String(next)));
}
</script>

<template>
  <div class="num-stepper">
    <input
      :value="modelValue"
      class="inp form-field__control num-stepper__input"
      type="number"
      :inputmode="inputMode"
      :min="min"
      :max="max"
      :step="inputStep"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="onInput(($event.target as HTMLInputElement).value)"
      @blur="onBlur(($event.target as HTMLInputElement).value)"
    >
    <div class="num-stepper__buttons">
      <button
        type="button"
        class="num-stepper__step"
        aria-label="增加"
        :disabled="disabled"
        @click="step(1)"
      >
        ▲
      </button>
      <button
        type="button"
        class="num-stepper__step"
        aria-label="减少"
        :disabled="disabled"
        @click="step(-1)"
      >
        ▼
      </button>
    </div>
  </div>
</template>

<style scoped>
.num-stepper {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  max-width: v-bind(maxWidth);
}

.num-stepper__input {
  width: 100%;
  padding-right: 34px;
  -moz-appearance: textfield;
  appearance: textfield;
}

.num-stepper__input::-webkit-outer-spin-button,
.num-stepper__input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.num-stepper__buttons {
  position: absolute;
  top: 1px;
  right: 1px;
  bottom: 1px;
  display: flex;
  flex-direction: column;
  width: 28px;
}

.num-stepper__step {
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
  opacity: 0.6;
  transition: background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;
}

.num-stepper__step:first-child {
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 80%, transparent);
}

.num-stepper__step:hover:not(:disabled) {
  opacity: 1;
  background: color-mix(in srgb, var(--accent, #ec4899) 12%, transparent);
  color: var(--text, #fff);
}

.num-stepper__step:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
