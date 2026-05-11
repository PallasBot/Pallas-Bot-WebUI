<script setup lang="ts">
import type { Component } from "vue";
import { Select as SelectIcon } from "@element-plus/icons-vue";

export interface PallasNavItem {
  index: string;
  label: string;
  icon?: Component;
}

withDefaults(
  defineProps<{
    asideTitle: string;
    navItems: PallasNavItem[];
    modelValue: string;
    menuAriaLabel?: string;
    hideAside?: boolean;
    /** true：标题区固定，插槽区域占满剩余高度且不滚动（由页面内层自行滚动，如好友/群列表） */
    lockBody?: boolean;
  }>(),
  { lockBody: false },
);

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

function pickNav(key: string) {
  emit("update:modelValue", key);
}
</script>

<template>
  <div
    class="pallas-sidebar-page view-page"
    :class="{ 'is-body-locked': lockBody }"
  >
    <div class="pallas-sidebar-mobile">
      <el-icon class="m-ico">
        <SelectIcon />
      </el-icon>
      <el-select
        :model-value="modelValue"
        class="pallas-sidebar-mobile-select"
        size="large"
        @update:model-value="(v: string) => emit('update:modelValue', v)"
      >
        <el-option
          v-for="n in navItems"
          :key="n.index"
          :label="n.label"
          :value="n.index"
        />
      </el-select>
    </div>

    <div class="pallas-sidebar-body">
      <aside
        v-if="!hideAside"
        class="pallas-sidebar-aside"
        :aria-label="menuAriaLabel || '页面分节'"
      >
        <div class="aside-t">{{ asideTitle }}</div>
        <el-menu
          :key="`sidebar-nav-${modelValue}`"
          :default-active="modelValue"
          class="side-menu"
          @select="pickNav"
        >
          <el-menu-item
            v-for="n in navItems"
            :key="n.index"
            :index="n.index"
          >
            <el-icon
              v-if="n.icon"
              class="nav-ico"
            >
              <component :is="n.icon" />
            </el-icon>
            <span>{{ n.label }}</span>
          </el-menu-item>
        </el-menu>
        <div
          v-if="$slots['aside-extra']"
          class="aside-extra"
        >
          <slot name="aside-extra" />
        </div>
      </aside>

      <main class="pallas-sidebar-main">
        <div class="main-hd">
          <slot
            name="header"
            :section="modelValue"
          />
        </div>
        <div class="main-scroll">
          <div class="main-scroll-inner">
            <slot />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pallas-sidebar-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
  height: 100%;
  width: 100%;
}
.pallas-sidebar-mobile {
  display: none;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  .m-ico {
    color: var(--c-main);
  }
  .pallas-sidebar-mobile-select {
    flex: 1;
  }
}
.pallas-sidebar-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 20px;
  align-items: stretch;
}
.pallas-sidebar-aside {
  width: 220px;
  flex-shrink: 0;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 14%, var(--el-border-color-lighter));
  box-shadow: var(--pallas-elev-1);
  padding: 12px 0 16px;
  .aside-t {
    padding: 4px 20px 12px;
    font-size: var(--pallas-text-sm);
    font-weight: var(--pallas-weight-semibold);
    color: var(--c-main);
    letter-spacing: 0.02em;
  }
  :deep(.side-menu) {
    border-right: none;
    background: transparent;
  }
  :deep(.el-menu-item) {
    margin: 2px 8px;
    border-radius: var(--pallas-radius-sm);
    height: 44px;
    line-height: 44px;
    font-size: var(--pallas-text-base);
    font-weight: var(--pallas-weight-medium);
  }
  :deep(.el-menu-item.is-active) {
    color: #fff !important;
    background: var(--el-color-primary-dark-2) !important;
  }
  .nav-ico {
    margin-right: 8px;
  }
  .aside-extra {
    margin-top: 10px;
    padding: 0 12px 4px;
    border-top: 1px dashed color-mix(in srgb, var(--pallas-accent) 22%, var(--el-border-color-lighter));
  }
}
.pallas-sidebar-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 14%, var(--el-border-color-lighter));
  box-shadow: var(--pallas-elev-1);
  padding: 0 0 12px;
  overflow: hidden;
}
.main-hd {
  flex-shrink: 0;
  padding: 20px 24px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}
.main-scroll {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0 8px 0 0;
}
.main-scroll-inner {
  text-align: left;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 8px 16px 20px 24px;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}
.pallas-sidebar-page.is-body-locked .main-scroll-inner {
  overflow: hidden;
}
html.dark {
  .pallas-sidebar-aside,
  .pallas-sidebar-main {
    border-color: rgba(100, 160, 255, 0.2);
  }
  .main-hd {
    border-color: rgba(100, 160, 255, 0.15);
  }
}
@media (max-width: 900px) {
  .pallas-sidebar-mobile {
    display: flex;
  }
  .pallas-sidebar-aside {
    display: none;
  }
  .pallas-sidebar-body {
    flex-direction: column;
  }
  .main-scroll-inner {
    max-width: none;
  }
  /* lockBody 在桌面用于内层分区滚动；窄屏改为整区可滚，避免内容被 overflow:hidden 裁死 */
  .pallas-sidebar-page.is-body-locked .main-scroll-inner {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
}
@media (max-width: 768px) {
  .pallas-sidebar-page {
    gap: 8px;
  }
  .pallas-sidebar-mobile {
    padding: 2px 0 6px;
  }
  .pallas-sidebar-main {
    padding-bottom: 8px;
  }
  .main-hd {
    padding: 14px 12px 8px;
  }
  .main-scroll {
    padding-right: 0;
  }
  .main-scroll-inner {
    padding: 6px 10px 14px;
  }
}
</style>
