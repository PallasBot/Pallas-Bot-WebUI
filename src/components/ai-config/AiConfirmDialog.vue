<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";

defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  tone?: "default" | "danger";
}>();

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <UiDialog
    :open="open"
    :title="title"
    :busy="busy"
    panel-class="ai-confirm-dialog"
    @close="emit('close')"
  >
    <p class="ai-confirm-dialog__msg">{{ message }}</p>
    <template #footer>
      <div class="ai-confirm-dialog__footer">
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="busy"
          @click="emit('close')"
        >
          取消
        </UiButton>
        <UiButton
          :variant="tone === 'danger' ? 'destructive' : 'primary'"
          size="sm"
          :busy="busy"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? "确定" }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.ai-confirm-dialog__msg {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.ai-confirm-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding-right: 2px;
}

.ai-confirm-dialog__footer :deep(.ui-btn) {
  min-width: 0;
  padding-inline: 10px;
  border-radius: 10px;
}

@media (max-width: 560px) {
  .ai-confirm-dialog__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-confirm-dialog__footer :deep(.ui-btn) {
    width: 100%;
  }
}
</style>
