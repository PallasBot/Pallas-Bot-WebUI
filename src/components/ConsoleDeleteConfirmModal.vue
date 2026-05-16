<script setup lang="ts">
import { computed } from "vue";

export type ConsoleDeleteListItem = {
  key: string;
  label: string;
};

const props = defineProps<{
  open: boolean;
  title: string;
  subtitle: string;
  items: ConsoleDeleteListItem[];
  busy?: boolean;
  error?: string;
  warnings?: string[];
  confirmLabel?: string;
  titleId?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const headingId = computed(() => props.titleId || "console-delete-modal-title");
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="console-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="headingId"
    >
      <div
        class="console-modal__backdrop"
        aria-hidden="true"
        @click="emit('close')"
      />
      <div
        class="console-modal__dialog"
        @click.stop
      >
        <div class="console-modal__hd">
          <div class="console-modal__head-text">
            <h2
              :id="headingId"
              class="console-modal__title"
            >
              {{ title }}
            </h2>
            <p class="console-modal__subtitle muted">
              {{ subtitle }}
            </p>
          </div>
          <button
            type="button"
            class="console-modal__close"
            aria-label="关闭"
            :disabled="busy"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
        <div class="console-modal__bd">
          <p
            v-if="error"
            class="alert alert--err"
            style="margin: 0 0 12px"
          >
            {{ error }}
          </p>
          <p
            v-for="(w, wi) in warnings ?? []"
            :key="`warn-${wi}`"
            class="alert alert--err"
            style="margin: 0 0 12px"
          >
            {{ w }}
          </p>
          <p
            class="muted"
            style="margin: 0 0 8px; font-size: 13px"
          >
            账号列表
          </p>
          <ul class="inst-delete-account-list muted">
            <li
              v-for="item in items"
              :key="item.key"
            >
              {{ item.label }}
            </li>
          </ul>
          <div
            class="row-actions"
            style="margin-top: 18px; flex-wrap: wrap; gap: 8px"
          >
            <button
              type="button"
              class="btn btn--danger"
              :disabled="busy"
              @click="emit('confirm')"
            >
              {{ busy ? "删除中…" : (confirmLabel || "确认删除") }}
            </button>
            <button
              type="button"
              class="btn"
              :disabled="busy"
              @click="emit('close')"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
.inst-delete-account-list {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.55;
  font-size: 13px;
  max-height: 200px;
  overflow: auto;
}
</style>
