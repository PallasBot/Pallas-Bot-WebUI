<script setup lang="ts">
withDefaults(
  defineProps<{
    disabled?: boolean;
    label?: string;
  }>(),
  { disabled: false, label: "编辑" },
);

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    type="button"
    class="console-table-edit"
    :disabled="disabled"
    @click="emit('click')"
  >
    {{ label }}
  </button>
</template>
