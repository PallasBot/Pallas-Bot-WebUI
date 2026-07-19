<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 无搜索框、仅操作区（如统计与语料页刷新） */
    actionsOnly?: boolean;
  }>(),
  {
    actionsOnly: false,
  },
);
</script>

<template>
  <div
    class="console-hub-toolbar-strip"
    :class="{ 'console-hub-toolbar-strip--actions-only': actionsOnly }"
  >
    <div class="console-hub-toolbar-strip__main">
      <div
        v-if="$slots.search"
        class="console-hub-toolbar-strip__search"
      >
        <slot name="search" />
      </div>
      <div
        v-if="$slots.middle"
        class="console-hub-toolbar-strip__middle"
      >
        <slot name="middle" />
      </div>
      <div
        v-if="$slots.actions"
        class="console-hub-toolbar-strip__actions"
      >
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
