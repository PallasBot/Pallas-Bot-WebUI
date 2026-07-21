<script setup lang="ts">
/**
 * 满高画布：占满 shell__main-inner--fill，子内容在内部滚动。
 * 与 .console-hub-page--fill 语义一致，可作页面根或内层包装。
 */
withDefaults(
  defineProps<{
    tag?: "div" | "section" | "main";
  }>(),
  {
    tag: "div",
  },
);
</script>

<template>
  <component
    :is="tag"
    class="page-fill"
  >
    <slot />
  </component>
</template>
