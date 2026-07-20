<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useId, watch } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    rows?: number;
    title?: string;
    placeholder?: string;
    /** 打开弹窗的按钮文案 */
    expandLabel?: string;
    /** 为 true 时页内文本框可直接编辑，仍保留「弹窗编辑」 */
    inlineEditable?: boolean;
    showExpandButton?: boolean;
  }>(),
  {
    rows: 6,
    title: "编辑 JSON",
    placeholder: undefined,
    expandLabel: "弹窗编辑",
    inlineEditable: true,
    showExpandButton: true,
  },
);

const peekPlaceholder = computed(() => {
  if (props.placeholder != null && props.placeholder !== "") return props.placeholder;
  return props.inlineEditable
    ? "可直接编辑 JSON；亦可点「弹窗编辑」在大窗口中修改"
    : "预览；点「弹窗编辑」打开编辑窗口";
});

const emit = defineEmits<{ "update:modelValue": [string] }>();

const titleId = useId();

const modalOpen = ref(false);
const draft = ref("");
const bigTa = ref<HTMLTextAreaElement | null>(null);
const peekTa = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.modelValue,
  (v) => {
    if (!modalOpen.value) draft.value = v;
  },
);

function setBodyScroll(lock: boolean) {
  if (typeof document === "undefined") return;
  document.body.style.overflow = lock ? "hidden" : "";
}

function onPeekInput(e: Event) {
  if (!props.inlineEditable) return;
  emit("update:modelValue", (e.target as HTMLTextAreaElement).value);
}

function openModal() {
  draft.value = props.modelValue;
  modalOpen.value = true;
  setBodyScroll(true);
  nextTick(() => {
    bigTa.value?.focus();
    bigTa.value?.setSelectionRange(bigTa.value.value.length, bigTa.value.value.length);
  });
}

function closeModal() {
  modalOpen.value = false;
  setBodyScroll(false);
  nextTick(() => {
    peekTa.value?.blur();
  });
}

function apply() {
  emit("update:modelValue", draft.value);
  closeModal();
}

function cancel() {
  draft.value = props.modelValue;
  closeModal();
}

onUnmounted(() => {
  setBodyScroll(false);
});
</script>

<template>
  <div class="json-textarea-field">
    <textarea
      ref="peekTa"
      class="textarea json-textarea-field__peek"
      :readonly="!inlineEditable"
      :tabindex="inlineEditable ? undefined : 0"
      spellcheck="false"
      :rows="rows"
      :value="modelValue"
      :placeholder="peekPlaceholder"
      :aria-label="title"
      @input="onPeekInput"
    />
    <div
      v-if="showExpandButton"
      class="json-textarea-field__toolbar"
    >
      <button
        type="button"
        class="btn json-textarea-field__expand"
        :aria-label="`${expandLabel}：${title}`"
        @click="openModal"
      >
        {{ expandLabel }}
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="json-textarea-field__modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div
          class="json-textarea-field__backdrop"
          aria-hidden="true"
          @click="cancel"
        />
        <div
          class="json-textarea-field__dialog-shell"
          @click.stop
        >
          <div class="json-textarea-field__dialog">
            <div class="json-textarea-field__header">
              <div class="json-textarea-field__header-copy">
                <p class="json-textarea-field__eyebrow">修改配置</p>
                <h2
                  :id="titleId"
                  class="json-textarea-field__title"
                >
                  {{ title }}
                </h2>
                <p class="json-textarea-field__subtitle muted">
                  {{ inlineEditable ? "在独立编辑区调整 JSON，保存后同步当前值。" : "在浮层中编辑 JSON，确认后写回配置。" }}
                </p>
              </div>
              <button
                type="button"
                class="json-textarea-field__close"
                aria-label="关闭"
                @click="cancel"
              >
                ×
              </button>
            </div>
            <div class="json-textarea-field__body">
              <textarea
                ref="bigTa"
                v-model="draft"
                class="textarea json-textarea-field__editor"
                spellcheck="false"
                @keydown.escape.prevent="cancel"
              />
              <div class="json-textarea-field__actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  @click="apply"
                >
                  保存
                </button>
                <button
                  type="button"
                  class="btn"
                  @click="cancel"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.json-textarea-field {
  display: grid;
  gap: 8px;
}

.json-textarea-field__toolbar {
  display: flex;
  justify-content: flex-end;
}

.json-textarea-field__expand {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  border-color: color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 84%, transparent);
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.02)) 98%, transparent);
}

.json-textarea-field__peek {
  width: 100%;
  max-width: 100%;
  resize: vertical;
  min-height: 120px;
  border-radius: var(--radius-textarea);
}

.json-textarea-field__peek[readonly] {
  cursor: default;
}

.json-textarea-field__peek:not([readonly]) {
  cursor: text;
}

.json-textarea-field__modal {
  position: fixed;
  inset: 0;
  z-index: 90;
}

.json-textarea-field__backdrop {
  position: absolute;
  inset: 0;
  background: var(--surface-overlay);
  backdrop-filter: blur(2px);
}

.json-textarea-field__dialog-shell {
  position: absolute;
  top: min(6vh, 48px);
  left: 50%;
  transform: translateX(-50%);
  width: min(1040px, calc(100vw - 32px));
  max-height: calc(100vh - 72px);
}

.json-textarea-field__dialog {
  width: 100%;
  max-height: inherit;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 86%, transparent);
  background: color-mix(in srgb, var(--surface, rgba(255, 255, 255, 0.04)) 99%, transparent);
  box-shadow: 0 16px 40px rgba(7, 10, 16, 0.2);
}

.json-textarea-field__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.08)) 86%, transparent);
}

.json-textarea-field__header-copy {
  min-width: 0;
}

.json-textarea-field__eyebrow {
  margin: 0 0 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, rgba(255, 255, 255, 0.58));
}

.json-textarea-field__title {
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
}

.json-textarea-field__subtitle {
  margin: 6px 0 0;
  line-height: 1.5;
}

.json-textarea-field__close {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.1)) 86%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-2, rgba(255, 255, 255, 0.02)) 98%, transparent);
  color: inherit;
  cursor: pointer;
}

.json-textarea-field__body {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 12px;
  padding: 12px 14px 14px;
  min-height: 0;
}

.json-textarea-field__editor {
  width: 100%;
  min-height: min(68vh, 720px);
  max-height: calc(100vh - 210px);
  resize: vertical;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  border-radius: var(--radius-textarea);
  padding: 12px 13px;
}

.json-textarea-field__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 560px) {
  .json-textarea-field {
    gap: 6px;
  }

  .json-textarea-field__peek {
    min-height: 116px;
  }

  .json-textarea-field__dialog-shell {
    top: 8px;
    bottom: 8px;
    width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    transform: translateX(-50%);
  }

  .json-textarea-field__dialog {
    border-radius: 12px;
  }

  .json-textarea-field__header {
    padding: 12px 12px 8px;
  }

  .json-textarea-field__title {
    font-size: 15px;
  }

  .json-textarea-field__body {
    gap: 10px;
    padding: 10px 12px 12px;
  }

  .json-textarea-field__editor {
    min-height: min(62vh, 520px);
    max-height: calc(100vh - 190px);
    font-size: 12px;
    padding: 10px 11px;
  }

  .json-textarea-field__actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
}
</style>
