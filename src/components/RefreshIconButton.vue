<script setup lang="ts">
import UiButton from "@/components/ui/UiButton.vue";

const props = withDefaults(
  defineProps<{
    busy?: boolean;
    disabled?: boolean;
    label?: string;
    busyLabel?: string;
    showLabel?: boolean;
  }>(),
  {
    busy: false,
    disabled: false,
    label: "刷新",
    busyLabel: "刷新中…",
    showLabel: false,
  },
);
const emit = defineEmits<{ click: [] }>();

function onClick() {
  if (props.busy || props.disabled) return;
  emit("click");
}
</script>

<template>
  <UiButton
    variant="outline"
    class="btn-refresh-action"
    :class="{
      'btn-refresh-action--busy': busy,
      'btn-refresh-action--icon-only': !showLabel,
    }"
    :disabled="disabled"
    :busy="busy"
    :aria-label="label"
    :title="label"
    @click="onClick"
  >
    <svg
      class="ui-btn__ico btn-refresh-action__ico"
      :class="{ 'btn-refresh-action__ico--spin': busy }"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
      />
    </svg>
    <span
      v-if="showLabel"
      class="btn-refresh-action__text"
    >{{ busy ? busyLabel : label }}</span>
  </UiButton>
</template>
