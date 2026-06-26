<script setup lang="ts">
import { computed } from "vue";
import { consolePrefs } from "@/utils/consolePrefs";

const props = withDefaults(
  defineProps<{
    /** 预览条文案 */
    label?: string;
    /** 预览用模糊半径；未传则读当前偏好 */
    blur?: number;
    /** 预览用不透明度；未传则读当前偏好 */
    opacity?: number;
  }>(),
  {
    label: "毛玻璃预览",
  },
);

const previewStyle = computed(() => {
  const blur = props.blur ?? consolePrefs.glassBlur;
  const opacity = props.opacity ?? consolePrefs.cardGlassOpacity;
  const saturate = 1.05 + ((blur - 8) / 32) * 0.75;
  return {
    "--surface-blur": `${blur}px`,
    "--card-glass-opacity": String(opacity),
    "--glass-saturate": saturate.toFixed(2),
  };
});
</script>

<template>
  <div
    class="prefs-glass-preview"
    :style="previewStyle"
    aria-hidden="true"
  >
    <div class="prefs-glass-preview__backdrop" />
    <div class="prefs-glass-preview__pane">
      {{ label }}
    </div>
  </div>
</template>
