<script setup lang="ts">
import { ref } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";

const props = withDefaults(
  defineProps<{
    modelValue: number[];
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number[]];
}>();

const addInput = ref("");
const addHint = ref("");

function normalizeIds(ids: number[]): number[] {
  const next = [...new Set(ids.map((n) => Math.floor(Number(n))))].filter((n) => Number.isFinite(n) && n > 0);
  next.sort((a, b) => a - b);
  return next;
}

function emitNext(ids: number[]) {
  emit("update:modelValue", normalizeIds(ids));
}

function addFromInput() {
  addHint.value = "";
  const raw = addInput.value.trim();
  if (!raw) return;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    addHint.value = "请输入有效的 QQ 号。";
    return;
  }
  if (props.modelValue.includes(n)) {
    addHint.value = "该 QQ 已在名单中。";
    return;
  }
  emitNext([...props.modelValue, n]);
  addInput.value = "";
}

function removeId(id: number) {
  emitNext(props.modelValue.filter((x) => x !== id));
}
</script>

<template>
  <div class="plugin-acl-blocked-users">
    <div class="plugin-acl-blocked-users__add row-actions">
      <UiInput
        v-model="addInput"
        class="plugin-acl-blocked-users__input"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="QQ 号"
        :disabled="disabled"
        @keydown.enter.prevent="addFromInput"
      />
      <UiButton
        :disabled="disabled"
        @click="addFromInput"
      >
        添加
      </UiButton>
    </div>
    <p
      v-if="addHint"
      class="alert alert--err plugin-acl-blocked-users__hint"
    >
      {{ addHint }}
    </p>
    <div
      v-if="modelValue.length"
      class="admin-chip-list plugin-acl-blocked-users__chips"
    >
      <div
        v-for="id in modelValue"
        :key="`plugin-block-${id}`"
        class="admin-chip"
      >
        <span class="admin-chip__id">{{ id }}</span>
        <button
          type="button"
          class="admin-chip__rm"
          :aria-label="`移除禁用 ${id}`"
          title="移除"
          :disabled="disabled"
          @click="removeId(id)"
        >
          ×
        </button>
      </div>
    </div>
    <p
      v-else
      class="muted plugin-acl-blocked-users__empty"
    >
      暂无禁用用户。
    </p>
  </div>
</template>

<style scoped>
.plugin-acl-blocked-users {
  display: grid;
  gap: 8px;
}

.plugin-acl-blocked-users__add {
  flex-wrap: wrap;
  gap: 8px;
}

.plugin-acl-blocked-users__input {
  max-width: 200px;
  min-width: 0;
  flex: 1 1 140px;
}

.plugin-acl-blocked-users__hint {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
}

.plugin-acl-blocked-users__empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
}

@media (max-width: 560px) {
  .plugin-acl-blocked-users__input {
    max-width: none;
    width: 100%;
    flex: 1 1 100%;
  }

  .plugin-acl-blocked-users__add > .btn,
  .plugin-acl-blocked-users__add > .ui-btn {
    flex: 1 1 auto;
  }
}
</style>
