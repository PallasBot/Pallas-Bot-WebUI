<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  expanded: boolean;
  /** 面板名称，用于 aria-label：收起/展开 + label */
  label: string;
}>();

defineEmits<{
  toggle: [];
}>();

const ariaLabel = computed(() =>
  props.expanded ? `收起${props.label}` : `展开${props.label}`,
);
</script>

<template>
  <button
    type="button"
    class="panel-hd-collapse-caret"
    :aria-expanded="expanded"
    :aria-label="ariaLabel"
    @click="$emit('toggle')"
  >
    <span class="panel-hd-collapse-caret-ico" aria-hidden="true" />
  </button>
</template>
