<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    placeholder?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: "输入后回车添加…",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const draft = ref("");

function commitDraft() {
  const value = draft.value.trim();
  if (!value) return;
  if (props.modelValue.includes(value)) {
    draft.value = "";
    return;
  }
  emit("update:modelValue", [...props.modelValue, value]);
  draft.value = "";
}

function removeAt(index: number) {
  const next = props.modelValue.slice();
  next.splice(index, 1);
  emit("update:modelValue", next);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    commitDraft();
    return;
  }
  // 输入框为空时按退格删除最后一个标签
  if (event.key === "Backspace" && !draft.value && props.modelValue.length) {
    removeAt(props.modelValue.length - 1);
  }
}
</script>

<template>
  <div
    class="tags-input"
    :class="{ 'tags-input--disabled': disabled }"
  >
    <div
      v-if="modelValue.length"
      class="tags-input__chips"
    >
      <span
        v-for="(tag, index) in modelValue"
        :key="`${tag}-${index}`"
        class="admin-chip tags-input__chip"
      >
        <span class="tags-input__chip-text">{{ tag }}</span>
        <button
          type="button"
          class="admin-chip__rm"
          :aria-label="`移除 ${tag}`"
          :disabled="disabled"
          @click="removeAt(index)"
        >
          ×
        </button>
      </span>
    </div>
    <input
      v-model="draft"
      class="inp tags-input__field"
      type="text"
      :placeholder="placeholder"
      :disabled="disabled"
      @keydown="onKeydown"
      @blur="commitDraft"
    >
  </div>
</template>

<style scoped>
.tags-input {
  display: grid;
  gap: 8px;
}

.tags-input__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.tags-input__chip {
  font-weight: 600;
}

.tags-input__chip-text {
  word-break: break-all;
}

.tags-input__field {
  width: 100%;
}

.tags-input--disabled {
  opacity: 0.6;
}
</style>
