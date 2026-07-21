<script setup lang="ts">
import { computed } from "vue";
import UiButton from "@/components/ui/UiButton.vue";

const props = withDefaults(
  defineProps<{
    busy?: boolean;
    disabled?: boolean;
    label?: string;
    busyLabel?: string;
    showLabel?: boolean;
    /**
     * 标题 / masthead 旁默认嵌入（ghost）。
     * 工具条等需实心描边时显式 `:embedded="false"`。
     */
    embedded?: boolean;
  }>(),
  {
    busy: false,
    disabled: false,
    label: "刷新",
    busyLabel: "刷新中…",
    showLabel: false,
    embedded: true,
  },
);
const emit = defineEmits<{ click: [] }>();

/** Boolean 属性可能编译为 ""；仅显式 false / "false" 时走 outline */
const isEmbedded = computed(() => {
  const v = props.embedded as unknown;
  return !(v === false || v === "false");
});

function onClick() {
  if (props.busy || props.disabled) return;
  emit("click");
}
</script>

<template>
  <UiButton
    :variant="isEmbedded ? 'ghost' : 'outline'"
    class="btn-refresh-action"
    :class="{
      'btn-refresh-action--busy': busy,
      'btn-refresh-action--icon-only': !showLabel,
      'btn-refresh-action--embedded': isEmbedded,
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

<style scoped>
/* 不依赖父级 .panel__title：嵌入态始终弱边框，避免仍呈 outline */
.btn-refresh-action--embedded.ui-btn {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--text-muted);
}

.btn-refresh-action--embedded.ui-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
  color: var(--text);
}
</style>
