<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    type?: "text" | "password" | "email" | "url" | "search" | "number";
    placeholder?: string;
    disabled?: boolean;
    invalid?: boolean;
    /** 密码时显示内嵌眼睛 */
    revealable?: boolean;
    autocomplete?: string;
    ariaLabel?: string;
  }>(),
  {
    modelValue: "",
    type: "text",
    disabled: false,
    invalid: false,
    revealable: false,
    autocomplete: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const revealed = ref(false);

const inputType = computed(() => {
  if (props.type === "password" && props.revealable) {
    return revealed.value ? "text" : "password";
  }
  return props.type;
});

const showEye = computed(() => props.type === "password" && props.revealable);

function onInput(ev: Event) {
  emit("update:modelValue", (ev.target as HTMLInputElement).value);
}
</script>

<template>
  <div
    class="ui-input-wrap"
    :class="{ 'ui-input-wrap--revealable': showEye }"
  >
    <input
      class="inp ui-input"
      :class="{ 'ui-input--invalid': invalid }"
      :type="inputType"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocomplete="autocomplete"
      :aria-label="ariaLabel"
      :aria-invalid="invalid || undefined"
      @input="onInput"
    >
    <button
      v-if="showEye"
      type="button"
      class="ui-input__eye"
      :aria-label="revealed ? '隐藏内容' : '显示内容'"
      :aria-pressed="revealed"
      :disabled="disabled"
      @click="revealed = !revealed"
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
        <template v-if="revealed">
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.4 5.2A9.4 9.4 0 0 1 12 4.9c5 0 9 4.1 9 7.1a11 11 0 0 1-2.4 3.3" />
          <path d="M6.2 6.7A11 11 0 0 0 3 12c0 3 4 7.1 9 7.1a9.6 9.6 0 0 0 3.3-.6" />
        </template>
        <template v-else>
          <path d="M3 12c0-3 4-7.1 9-7.1s9 4.1 9 7.1-4 7.1-9 7.1S3 15 3 12Z" />
          <circle
            cx="12"
            cy="12"
            r="2.4"
          />
        </template>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.ui-input-wrap {
  position: relative;
  display: block;
  width: 100%;
  min-width: 0;
}

.ui-input {
  width: 100%;
}

.ui-input-wrap--revealable .ui-input {
  padding-right: 40px;
}

.ui-input--invalid {
  border-color: color-mix(in srgb, var(--danger, #ef4444) 55%, var(--control-border));
}

.ui-input__eye {
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
  color: var(--text-muted);
  cursor: pointer;
}

.ui-input__eye:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--text);
}

.ui-input__eye:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
