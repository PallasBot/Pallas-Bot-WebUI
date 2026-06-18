<script setup lang="ts">
import { computed, useSlots } from "vue";

const props = withDefaults(
  defineProps<{
    interactive?: boolean;
    active?: boolean;
    glass?: boolean;
    tag?: "article" | "div" | "section";
  }>(),
  {
    interactive: false,
    active: false,
    glass: true,
    tag: "article",
  },
);

const slots = useSlots();

const classNames = computed(() => [
  "ui-card",
  props.glass ? "ui-card--glass" : "",
  props.interactive ? "ui-card--interactive" : "",
  props.active ? "ui-card--active" : "",
]);

const hasHeader = computed(() => Boolean(slots.header));
const hasFooter = computed(() => Boolean(slots.footer));
</script>

<template>
  <component
    :is="tag"
    :class="classNames"
  >
    <div
      v-if="hasHeader"
      class="ui-card__header"
    >
      <slot name="header" />
    </div>
    <div
      class="ui-card__content"
      :class="{ 'ui-card__content--flush-top': hasHeader }"
    >
      <slot />
    </div>
    <div
      v-if="hasFooter"
      class="ui-card__footer"
    >
      <slot name="footer" />
    </div>
  </component>
</template>
