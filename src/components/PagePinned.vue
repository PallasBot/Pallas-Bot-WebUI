<script setup lang="ts">
/**
 * 钉在 PageFill 顶部的 chrome（标题 / 工具条），不参与内部滚动伸缩。
 */
withDefaults(
  defineProps<{
    tag?: "div" | "header" | "section";
  }>(),
  {
    tag: "div",
  },
);
</script>

<template>
  <component
    :is="tag"
    class="page-pinned"
  >
    <slot />
  </component>
</template>
