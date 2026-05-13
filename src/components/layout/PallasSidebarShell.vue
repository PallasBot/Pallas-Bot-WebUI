<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import { ViewListIcon } from "tdesign-icons-vue-next";

export interface PallasNavItem {
  index: string;
  label: string;
  icon?: Component;
}

const props = withDefaults(
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

const mobileSelectOptions = computed(() => props.navItems.map((n) => ({ label: n.label, value: n.index })));

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
      <ViewListIcon class="m-ico" />
      <t-select
        :model-value="modelValue"
        class="pallas-sidebar-mobile-select"
        size="large"
        :options="mobileSelectOptions"
        @update:model-value="(v: string) => emit('update:modelValue', v)"
      />
    </div>

    <div class="pallas-sidebar-body">
      <div
        v-if="!hideAside"
        class="pallas-subnav-dock"
        tabindex="0"
        title="悬停展开分节菜单；键盘可 Tab 至此聚焦"
      >
        <div
          class="pallas-subnav-rail"
          aria-hidden="true"
        />
        <aside
          class="pallas-sidebar-aside"
          :aria-label="menuAriaLabel || '页面分节'"
        >
          <div class="aside-t">{{ asideTitle }}</div>
          <t-menu
            :key="`sidebar-nav-${modelValue}`"
            :value="modelValue"
            class="side-menu"
            @change="(v: string | number) => pickNav(String(v))"
          >
            <t-menu-item
              v-for="n in navItems"
              :key="n.index"
              :value="n.index"
            >
              <template v-if="n.icon" #icon>
                <component :is="n.icon" class="nav-ico" />
              </template>
              {{ n.label }}
            </t-menu-item>
          </t-menu>
          <div
            v-if="$slots['aside-extra']"
            class="aside-extra"
          >
            <slot name="aside-extra" />
          </div>
        </aside>
      </div>

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
  gap: var(--pallas-subnav-gap, 12px);
  align-items: stretch;
  position: relative;
}
.pallas-subnav-dock {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-self: stretch;
}
.pallas-subnav-rail {
  display: none;
}
.pallas-sidebar-aside {
  width: var(--pallas-subnav-width, 168px);
  flex-shrink: 0;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md);
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 14%, var(--el-border-color-lighter));
  box-shadow: var(--pallas-elev-1);
  padding: 8px 0 12px;
  .aside-t {
    padding: 2px 12px 8px;
    font-size: var(--pallas-text-xs);
    font-weight: var(--pallas-weight-semibold);
    color: var(--c-main);
    letter-spacing: 0.02em;
    line-height: 1.35;
  }
  :deep(.side-menu) {
    border-right: none;
    background: transparent;
  }
  :deep(.t-menu__item) {
    margin: 1px 6px;
    border-radius: var(--pallas-radius-sm);
    height: 36px;
    line-height: 36px;
    padding: 0 8px !important;
    font-size: var(--pallas-text-sm);
    font-weight: var(--pallas-weight-medium);
  }
  :deep(.t-menu__item .t-icon) {
    font-size: 15px;
  }
  :deep(.t-menu__item.t-is-active) {
    color: #fff !important;
    background: var(--td-brand-color-8) !important;
  }
  .nav-ico {
    margin-right: 6px;
  }
  .aside-extra {
    margin-top: 8px;
    padding: 0 8px 2px;
    border-top: 1px dashed color-mix(in srgb, var(--pallas-accent) 22%, var(--el-border-color-lighter));
  }
}

/* 桌面 + 可悬停精细指针：二级菜单为左侧抽屉，常关悬停/聚焦开 */
@media (min-width: 901px) and (hover: hover) and (pointer: fine) {
  .pallas-sidebar-body:has(.pallas-subnav-dock) {
    gap: 0;
  }
  .pallas-sidebar-body:has(.pallas-subnav-dock) .pallas-sidebar-main {
    padding-left: 12px;
  }
  .pallas-subnav-dock {
    display: block;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 14px;
    z-index: 8;
    overflow: visible;
    transition: width 0.16s ease;
    outline: none;
  }
  .pallas-subnav-dock:hover,
  .pallas-subnav-dock:focus-within {
    width: calc(var(--pallas-subnav-width, 168px) + 14px);
  }
  .pallas-subnav-rail {
    display: block;
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 14px;
    pointer-events: none;
    border-right: 1px solid color-mix(in srgb, var(--pallas-accent) 22%, var(--el-border-color-lighter));
    background: color-mix(in srgb, var(--pallas-accent) 7%, var(--el-bg-color));
    border-radius: 10px 0 0 10px;
  }
  .pallas-sidebar-aside {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: var(--pallas-subnav-width, 168px);
    transform: translateX(-100%);
    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease;
    pointer-events: none;
  }
  .pallas-subnav-dock:hover .pallas-sidebar-aside,
  .pallas-subnav-dock:focus-within .pallas-sidebar-aside {
    transform: translateX(0);
    pointer-events: auto;
    box-shadow: 8px 0 26px rgba(15, 35, 65, 0.14);
  }
}

/* 触控屏等粗指针：二级菜单保持常显，覆盖抽屉规则 */
@media (min-width: 901px) and (pointer: coarse) {
  .pallas-sidebar-body:has(.pallas-subnav-dock) {
    gap: var(--pallas-subnav-gap, 12px);
  }
  .pallas-sidebar-body:has(.pallas-subnav-dock) .pallas-sidebar-main {
    padding-left: 0;
  }
  .pallas-subnav-dock {
    position: relative;
    display: flex;
    flex-direction: column;
    width: auto;
    align-self: stretch;
    overflow: visible;
    z-index: auto;
  }
  .pallas-subnav-rail {
    display: none;
  }
  .pallas-sidebar-aside {
    position: relative;
    transform: none;
    pointer-events: auto;
    box-shadow: var(--pallas-elev-1);
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
  padding: 16px 20px 12px;
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
  padding: 8px 12px 16px 18px;
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
  @media (min-width: 901px) and (hover: hover) and (pointer: fine) {
    .pallas-subnav-rail {
      border-right-color: rgba(100, 160, 255, 0.28);
      background: color-mix(in srgb, var(--pallas-accent) 10%, rgba(18, 25, 37, 0.5));
    }
  }
}
@media (max-width: 900px) {
  .pallas-sidebar-mobile {
    display: flex;
  }
  .pallas-subnav-dock {
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
    gap: 6px;
  }
  .pallas-sidebar-mobile {
    padding: 2px 0 4px;
  }
  .pallas-sidebar-main {
    padding-bottom: 8px;
  }
  .main-hd {
    padding: 10px 12px 6px;
  }
  .main-scroll {
    padding-right: 0;
  }
  .main-scroll-inner {
    padding: 6px 10px 12px;
  }
}
</style>
