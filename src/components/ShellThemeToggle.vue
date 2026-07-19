<script setup lang="ts">
import { computed } from "vue";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import type { ThemeMode } from "@/utils/consolePrefs";

withDefaults(
  defineProps<{
    /** 侧栏收起：单图标循环切换 */
    iconOnly?: boolean;
  }>(),
  {
    iconOnly: false,
  },
);

const cycleLabel = computed(() => {
  if (consolePrefs.theme === "dark") return "深色";
  if (consolePrefs.theme === "light") return "浅色";
  return "跟随系统";
});

function setTheme(mode: ThemeMode) {
  setConsolePrefs({ theme: mode });
}

function cycleTheme() {
  const order: ThemeMode[] = ["dark", "light", "system"];
  const idx = order.indexOf(consolePrefs.theme);
  setTheme(order[(idx + 1) % order.length]!);
}
</script>

<template>
  <button
    v-if="iconOnly"
    type="button"
    class="shell__theme-cycle"
    :title="`颜色模式：${cycleLabel}（点击切换）`"
    :aria-label="`颜色模式 ${cycleLabel}`"
    @click="cycleTheme"
  >
    <span
      v-if="consolePrefs.theme === 'dark'"
      class="shell__theme-ico"
      aria-hidden="true"
    >
      <svg
        class="shell__ico"
        viewBox="0 0 24 24"
        fill="currentColor"
      ><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
    </span>
    <span
      v-else-if="consolePrefs.theme === 'light'"
      class="shell__theme-ico"
      aria-hidden="true"
    >
      <svg
        class="shell__ico"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.31 11.31l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41" />
      </svg>
    </span>
    <span
      v-else
      class="shell__theme-ico"
      aria-hidden="true"
    >
      <svg
        class="shell__ico"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    </span>
  </button>
  <div
    v-else
    class="shell-toolbar__seg shell-toolbar__seg--compact shell__sidebar-theme"
    role="group"
    aria-label="颜色模式"
  >
    <button
      type="button"
      :class="{ 'is-on': consolePrefs.theme === 'dark' }"
      title="深色"
      aria-label="深色"
      @click="setTheme('dark')"
    >
      <span class="shell__theme-ico" aria-hidden="true">
        <svg
          class="shell__ico"
          viewBox="0 0 24 24"
          fill="currentColor"
        ><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
      </span>
    </button>
    <button
      type="button"
      :class="{ 'is-on': consolePrefs.theme === 'light' }"
      title="浅色"
      aria-label="浅色"
      @click="setTheme('light')"
    >
      <span class="shell__theme-ico" aria-hidden="true">
        <svg
          class="shell__ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.31 11.31l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41" />
        </svg>
      </span>
    </button>
    <button
      type="button"
      :class="{ 'is-on': consolePrefs.theme === 'system' }"
      title="跟随系统"
      aria-label="跟随系统"
      @click="setTheme('system')"
    >
      <span class="shell__theme-ico" aria-hidden="true">
        <svg
          class="shell__ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </span>
    </button>
  </div>
</template>
