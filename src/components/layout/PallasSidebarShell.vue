<script setup lang="ts">
import type { Component } from "vue";
import { Select as SelectIcon } from "@element-plus/icons-vue";

export interface PallasNavItem {
  index: string;
  label: string;
  icon?: Component;
}

defineProps<{
  asideTitle: string;
  navItems: PallasNavItem[];
  /** 当前导航键 */
  modelValue: string;
  menuAriaLabel?: string;
  hideAside?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

function pickNav(key: string) {
  emit("update:modelValue", key);
}
</script>

<template>
  <div class="pallas-sidebar-page view-page">
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
        <el-scrollbar class="main-scroll">
          <div class="main-scroll-inner">
            <slot />
          </div>
        </el-scrollbar>
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
  border: 1px solid rgba(22, 100, 196, 0.12);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
  padding: 12px 0 16px;
  .aside-t {
    padding: 4px 20px 12px;
    font-size: 13px;
    font-weight: 600;
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
  }
  :deep(.el-menu-item.is-active) {
    color: #fff;
    background: var(--c-main) !important;
  }
  .nav-ico {
    margin-right: 8px;
  }
  .aside-extra {
    margin-top: 10px;
    padding: 0 12px 4px;
    border-top: 1px dashed rgba(22, 100, 196, 0.18);
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
  border: 1px solid rgba(22, 100, 196, 0.12);
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
  padding: 0 0 12px;
  overflow: hidden;
}
.main-hd {
  flex-shrink: 0;
  padding: 20px 24px 10px;
  border-bottom: 1px solid rgba(22, 100, 196, 0.1);
}
.main-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 8px 0 0;
  :deep(.el-scrollbar__wrap) {
    max-height: calc(100vh - 220px);
  }
  :deep(.el-scrollbar__view) {
    padding: 8px 16px 20px 24px;
  }
}
.main-scroll-inner {
  text-align: left;
  width: 100%;
  max-width: none;
  margin: 0;
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
  .main-scroll :deep(.el-scrollbar__wrap) {
    max-height: none;
    overflow: visible !important;
  }
  .main-scroll {
    overflow: visible;
  }
  .main-scroll-inner {
    max-width: none;
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
  .main-scroll :deep(.el-scrollbar__view) {
    padding: 6px 10px 14px;
  }
}
</style>
