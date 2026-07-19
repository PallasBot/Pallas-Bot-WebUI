<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string;
    extraClass?: string;
  }>(),
  { tag: "div" },
);
</script>

<template>
  <component
    :is="tag"
    class="console-hub-page"
    :class="extraClass"
  >
    <slot />
  </component>
</template>
