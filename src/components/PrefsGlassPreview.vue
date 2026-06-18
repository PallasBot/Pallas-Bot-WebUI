<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 预览条文案 */
    label?: string;
  }>(),
  {
    label: "毛玻璃预览",
  },
);
</script>

<template>
  <div
    class="prefs-glass-preview"
    aria-hidden="true"
  >
    <div class="prefs-glass-preview__backdrop" />
    <div class="prefs-glass-preview__pane">
      {{ label }}
    </div>
  </div>
</template>
