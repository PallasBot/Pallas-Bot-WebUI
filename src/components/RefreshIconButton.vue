<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    busy?: boolean;
    disabled?: boolean;
    /** 无障碍名称，默认「刷新」 */
    label?: string;
  }>(),
  { busy: false, disabled: false },
);
const emit = defineEmits<{ click: [] }>();

function onClick() {
  if (props.busy || props.disabled) return;
  emit("click");
}
</script>

<template>
  <button
    type="button"
    class="btn-refresh-icon"
    :class="{ 'btn-refresh-icon--busy': busy }"
    :disabled="disabled"
    :aria-busy="busy || undefined"
    :aria-label="label ?? '刷新'"
    :title="label ?? '刷新'"
    @click="onClick"
  >
    <svg
      class="btn-refresh-icon__svg"
      :class="{ 'btn-refresh-icon__svg--spin': busy }"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7.1c2.32 0 4.2 1.88 4.2 4.2 0 1.03-.38 1.98-1 2.7l1.45 1.45A7.93 7.93 0 0 0 20 11.3c0-1.84-.63-3.54-1.69-4.95zM6.35 17.65A7.95 7.95 0 0 0 12 20v3l5-5-5-5v2.9c-2.32 0-4.2-1.88-4.2-4.2 0-1.03.38-1.98 1-2.7L6.34 6.54A7.93 7.93 0 0 0 4 12.7c0 1.84.63 3.54 1.69 4.95l1.66-1z"
      />
    </svg>
  </button>
</template>
