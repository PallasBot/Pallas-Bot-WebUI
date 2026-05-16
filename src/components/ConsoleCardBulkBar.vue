<script setup lang="ts">
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
    <button
      type="button"
      class="btn"
      @click="emit('toggleSelectAll')"
    >
      {{ pageAllSelected ? "取消全选" : "全选本页" }}
    </button>
    <button
      type="button"
      class="btn"
      :disabled="selectedCount === 0"
      @click="emit('clearSelection')"
    >
      清除选择
    </button>
    <button
      type="button"
      class="btn btn--danger"
      :disabled="selectedCount === 0 || deleteBusy || deleteDisabled"
      @click="emit('delete')"
    >
      删除选中<span v-if="selectedCount > 0">（{{ selectedCount }}）</span>
    </button>
  </div>
</template>
