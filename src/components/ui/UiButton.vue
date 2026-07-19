<script setup lang="ts">
import { computed } from "vue";

export type UiButtonVariant = "default" | "primary" | "destructive" | "outline" | "ghost" | "latest";
export type UiButtonSize = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    variant?: UiButtonVariant;
    size?: UiButtonSize;
    block?: boolean;
    disabled?: boolean;
    busy?: boolean;
    type?: "button" | "submit" | "reset";
    href?: string | null;
    target?: string;
    rel?: string;
  }>(),
  {
    variant: "default",
    size: "md",
    block: false,
    disabled: false,
    busy: false,
    type: "button",
    href: null,
    target: undefined,
    rel: undefined,
  },
);

const emit = defineEmits<{ click: [ev: MouseEvent] }>();

const classNames = computed(() => [
  "ui-btn",
  `ui-btn--${props.variant}`,
  props.size !== "md" ? `ui-btn--${props.size}` : "",
  props.block ? "ui-btn--block" : "",
]);

function onClick(ev: MouseEvent) {
  if (props.disabled || props.busy) {
    ev.preventDefault();
    return;
  }
  emit("click", ev);
}
</script>

<template>
  <a
    v-if="href"
    :class="classNames"
    :href="href"
    :target="target"
    :rel="rel"
    :aria-disabled="disabled || busy || undefined"
    @click="onClick"
  >
    <slot />
  </a>
  <button
    v-else
    :type="type"
    :class="classNames"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
    @click="onClick"
  >
    <slot />
  </button>
</template>
