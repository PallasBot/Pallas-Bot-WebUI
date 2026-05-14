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
  }>(),
  {
    rows: 6,
    title: "编辑 JSON",
    placeholder: undefined,
    expandLabel: "弹窗编辑",
    inlineEditable: true,
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
    <div class="json-textarea-field__toolbar">
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
        class="console-modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
      >
        <div
          class="console-modal__backdrop"
          aria-hidden="true"
          @click="cancel"
        />
        <div
          class="console-modal__dialog json-textarea-field__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                :id="titleId"
                class="console-modal__title"
              >
                {{ title }}
              </h2>
              <p class="console-modal__subtitle muted">
                {{ inlineEditable ? "大窗口编辑；确定后与页内输入框同步。" : "在弹窗中编辑；确定后写回表单。" }}
              </p>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="cancel"
            >
              ×
            </button>
          </div>
          <div class="console-modal__bd">
            <textarea
              ref="bigTa"
              v-model="draft"
              class="textarea json-textarea-field__editor"
              spellcheck="false"
              @keydown.escape.prevent="cancel"
            />
            <div class="row-actions" style="margin-top: 14px">
              <button
                type="button"
                class="btn btn--primary"
                @click="apply"
              >
                确定
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
    </Teleport>
  </div>
</template>

<style scoped>
.json-textarea-field__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.json-textarea-field__expand {
  padding: 6px 12px;
  font-size: 12px;
}

.json-textarea-field__peek {
  width: 100%;
  max-width: 100%;
  resize: vertical;
}

.json-textarea-field__peek[readonly] {
  cursor: default;
}

.json-textarea-field__peek:not([readonly]) {
  cursor: text;
}

.json-textarea-field__dialog {
  max-width: min(960px, 96vw);
  width: 100%;
}

.json-textarea-field__editor {
  width: 100%;
  min-height: min(72vh, 560px);
  resize: vertical;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 560px) {
  .json-textarea-field__dialog {
    max-width: calc(100vw - 16px);
    margin: 0 8px;
  }

  .json-textarea-field__editor {
    min-height: min(52vh, 360px);
    font-size: 12px;
  }
}
</style>
