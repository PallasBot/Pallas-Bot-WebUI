<template>
  <div class="console-hub-page__filter-bar">
    <slot name="primary" />
    <div
      v-if="$slots.secondary || $slots.meta"
      class="console-hub-page__filter-row"
    >
      <slot name="secondary" />
      <slot name="meta" />
    </div>
    <slot />
  </div>
</template>
