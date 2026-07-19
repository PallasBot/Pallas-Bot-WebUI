<script setup lang="ts">
import { computed } from "vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

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
  <UiDialog
    :open="open"
    :title-id="headingId"
    :title="title"
    :subtitle="subtitle"
    :busy="busy"
    :show-close="true"
    @close="emit('close')"
  >
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
      <UiButton
        variant="destructive"
        :disabled="busy"
        @click="emit('confirm')"
      >
        {{ busy ? "删除中…" : (confirmLabel || "确认删除") }}
      </UiButton>
      <UiButton
        :disabled="busy"
        @click="emit('close')"
      >
        取消
      </UiButton>
    </div>
  </UiDialog>
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
