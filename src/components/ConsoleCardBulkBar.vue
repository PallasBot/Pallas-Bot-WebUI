<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";

defineProps<{
  pageAllSelected: boolean;
  selectedCount: number;
  deleteBusy?: boolean;
  deleteDisabled?: boolean;
}>();

const emit = defineEmits<{
  toggleSelectAll: [];
  clearSelection: [];
  delete: [];
}>();
</script>

<template>
  <div class="inst-db-bulk-bar">
    <UiButton
      size="sm"
      @click="emit('toggleSelectAll')"
    >
      {{ pageAllSelected ? "取消全选" : "全选本页" }}
    </UiButton>
    <UiButton
      size="sm"
      :disabled="selectedCount === 0"
      @click="emit('clearSelection')"
    >
      清除选择
    </UiButton>
    <UiButton
      size="sm"
      variant="destructive"
      :disabled="selectedCount === 0 || deleteBusy || deleteDisabled"
      :busy="deleteBusy"
      @click="emit('delete')"
    >
      删除选中<span v-if="selectedCount > 0">（{{ selectedCount }}）</span>
    </UiButton>
  </div>
</template>
