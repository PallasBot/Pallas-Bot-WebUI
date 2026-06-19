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
          :disabled="busy"
          @click="emit('close')"
        >
          取消
        </UiButton>
        <UiButton
          :variant="tone === 'danger' ? 'destructive' : 'primary'"
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
  gap: 8px;
}
</style>
