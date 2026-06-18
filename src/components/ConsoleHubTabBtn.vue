<script setup lang="ts">
withDefaults(
  defineProps<{
    active?: boolean;
    ariaSelected?: boolean | "true" | "false";
  }>(),
  {
    active: false,
  },
);

defineEmits<{
  click: [ev: MouseEvent];
}>();
</script>

<template>
  <button
    type="button"
    role="tab"
    class="console-hub-page__tab-btn"
    :class="{ 'is-on': active }"
    :aria-selected="ariaSelected ?? active"
    @click="$emit('click', $event)"
  >
    <span class="console-hub-page__tab-btn-inner">
      <slot />
    </span>
  </button>
</template>
