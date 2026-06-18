<script setup lang="ts">
import { computed, ref, watch } from "vue";
import PluginDefaultIcon from "@/components/PluginDefaultIcon.vue";
import { pluginCoverHue } from "@/utils/pluginReadme";

const props = withDefaults(
  defineProps<{
    pluginId: string;
    label?: string;
    iconUrl?: string | null;
    size?: "sm" | "md" | "lg" | "xl";
  }>(),
  {
    label: "",
    iconUrl: null,
    size: "md",
  },
);

const imgFailed = ref(false);

const sizeClass = computed(() => `plugin-icon--${props.size}`);

const resolvedUrl = computed(() => (props.iconUrl || "").trim() || null);

const fallbackStyle = computed(() => ({
  "--plugin-icon-hue": String(pluginCoverHue(props.pluginId || props.label || "plugin")),
}));

const defaultIconSize = computed(() => {
  if (props.size === "xl") return 26;
  if (props.size === "lg") return 22;
  if (props.size === "sm") return 11;
  return 14;
});

watch(
  () => [props.pluginId, props.iconUrl],
  () => {
    imgFailed.value = false;
  },
);
</script>

<template>
  <span
    class="plugin-icon"
    :class="sizeClass"
    aria-hidden="true"
  >
    <img
      v-if="resolvedUrl && !imgFailed"
      class="plugin-icon__img"
      :src="resolvedUrl"
      alt=""
      @error="imgFailed = true"
    >
    <span
      v-else
      class="plugin-icon__fallback"
      :style="fallbackStyle"
    >
      <PluginDefaultIcon :size="defaultIconSize" />
    </span>
  </span>
</template>

<style scoped>
.plugin-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.plugin-icon--sm {
  width: 18px;
  height: 18px;
}

.plugin-icon--md {
  width: 22px;
  height: 22px;
}

.plugin-icon--lg {
  width: 40px;
  height: 40px;
}

.plugin-icon--xl {
  width: 48px;
  height: 48px;
}

.plugin-icon__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: calc(var(--radius-shell, 10px) * 0.45);
}

.plugin-icon--xl .plugin-icon__img {
  padding: 6px;
  border-radius: 999px;
  box-sizing: border-box;
}

.plugin-icon__fallback {
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--radius-shell, 10px) * 0.45);
  color: rgba(255, 255, 255, 0.94);
  background: hsl(var(--plugin-icon-hue, 210), 52%, 46%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.plugin-icon--xl .plugin-icon__fallback {
  border-radius: 999px;
}

html[data-theme="light"] .plugin-icon__fallback {
  color: color-mix(in srgb, var(--foreground) 72%, #ffffff);
  background: color-mix(in srgb, hsl(var(--plugin-icon-hue, 210), 42%, 88%) 88%, #ffffff);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground) 10%, transparent);
}

html[data-ui-preset="shadcn"] .plugin-icon__fallback {
  color: color-mix(in srgb, var(--foreground) 78%, transparent);
  background: color-mix(in srgb, var(--foreground) 6%, var(--background));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground) 12%, transparent);
}
</style>
