<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import type { ThemeMode } from "@/utils/consolePrefs";

const nav = [
  { to: "/", label: "总览", icon: "◆", description: "容量、接入与账号一览" },
  { to: "/logs", label: "运行日志", icon: "≡", description: "检索与导出运行期输出" },
  { to: "/instances", label: "实例与连接", icon: "◎", description: "在线状态与协议快照" },
  { to: "/plugins", label: "插件", icon: "▣", description: "已启用模块与可调参数" },
  { to: "/common-config", label: "通用配置", icon: "⚙", description: "跨模块公共项" },
  { to: "/protocol", label: "协议端", icon: "⎈", description: "协议控制台入口与策略" },
  { to: "/friends-groups", label: "好友与群", icon: "☺", description: "列表与好友/入群审批" },
  { to: "/bot-social-config", label: "颗粒配置", icon: "✧", description: "按对象覆盖策略" },
  { to: "/database", label: "数据库", icon: "▤", description: "存储规模与维护" },
  { to: "/update", label: "更新", icon: "↑", description: "发行版与变更窗口" },
  { to: "/ai", label: "AI 扩展", icon: "◇", description: "扩展服务与运行记录" },
  { to: "/security", label: "安全", icon: "◈", description: "控制台访问凭据" },
];

const route = useRoute();
const mobileNavOpen = ref(false);
const isNarrow = ref(false);

function updateNarrow() {
  isNarrow.value = window.matchMedia("(max-width: 960px)").matches;
}

function closeMobileNav() {
  mobileNavOpen.value = false;
}

function setTheme(mode: ThemeMode) {
  setConsolePrefs({ theme: mode });
}

function toggleSidebar() {
  setConsolePrefs({ sidebarCollapsed: !consolePrefs.sidebarCollapsed });
}

const shellClass = computed(() => ({
  shell: true,
  "shell--sidebar-collapsed": consolePrefs.sidebarCollapsed,
}));

function navCollapsedLabel(collapsed: boolean, label: string) {
  return collapsed ? label : undefined;
}

onMounted(() => {
  updateNarrow();
  window.addEventListener("resize", updateNarrow);
});

watch(mobileNavOpen, (open) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
});

watch(
  () => route.fullPath,
  () => {
    closeMobileNav();
  },
);

onUnmounted(() => {
  window.removeEventListener("resize", updateNarrow);
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div :class="shellClass">
    <div class="shell__bg" aria-hidden="true" />
    <aside
      class="shell__sidebar"
      :aria-hidden="isNarrow"
    >
      <div class="shell__sidebar-top">
        <div class="shell__brand">
          <div class="shell__logo">Operations</div>
          <div class="shell__title">Pallas-Bot</div>
        </div>
        <button
          type="button"
          class="shell__sidebar-toggle"
          :aria-expanded="!consolePrefs.sidebarCollapsed"
          :aria-label="consolePrefs.sidebarCollapsed ? '展开菜单栏' : '收起菜单栏'"
          @click="toggleSidebar"
        >
          {{ consolePrefs.sidebarCollapsed ? "»" : "«" }}
        </button>
      </div>
      <nav class="shell__nav" aria-label="主导航">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          v-slot="{ navigate, isActive, isExactActive }"
          custom
          :to="item.to"
          :end="item.to === '/'"
        >
          <button
            type="button"
            class="shell__nav-link"
            :class="{
              'shell__nav-link--root': item.to === '/',
              'is-router-active': isActive,
              'is-router-exact': isExactActive,
            }"
            :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, item.label)"
            :aria-current="isExactActive ? 'page' : undefined"
            @click="navigate"
          >
            <span class="shell__nav-ico">{{ item.icon }}</span>
            <span class="shell__nav-text">
              <span class="shell__nav-label">{{ item.label }}</span>
              <span class="shell__nav-desc">{{ item.description }}</span>
            </span>
          </button>
        </RouterLink>
        <RouterLink
          v-slot="{ navigate, isActive, isExactActive }"
          custom
          to="/preferences"
        >
          <button
            type="button"
            class="shell__nav-link"
            :class="{ 'is-router-active': isActive, 'is-router-exact': isExactActive }"
            :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, '外观偏好')"
            :aria-current="isExactActive ? 'page' : undefined"
            @click="navigate"
          >
            <span class="shell__nav-ico">✦</span>
            <span class="shell__nav-text">
              <span class="shell__nav-label">外观偏好</span>
              <span class="shell__nav-desc">本机界面呈现</span>
            </span>
          </button>
        </RouterLink>
      </nav>
      <div class="shell__sidebar-bottom">
        <div
          class="shell__sidebar-theme"
          role="group"
          aria-label="颜色模式"
        >
          <div class="shell-toolbar__seg shell-toolbar__seg--compact shell-toolbar__seg--sidebar">
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'dark' }"
              @click="setTheme('dark')"
            >
              深色
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'light' }"
              @click="setTheme('light')"
            >
              浅色
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'system' }"
              @click="setTheme('system')"
            >
              系统
            </button>
          </div>
        </div>
        <footer class="shell__foot">
          © PallasBot
        </footer>
      </div>
    </aside>

    <Teleport to="body">
      <div
        v-if="isNarrow && mobileNavOpen"
        class="shell-mobile-nav"
      >
        <aside
          id="shell-mobile-nav-panel"
          class="shell-mobile-nav__panel"
          role="dialog"
          aria-modal="true"
          aria-label="主导航"
        >
          <div class="shell-mobile-nav__head">
            <span class="shell-mobile-nav__brand">Pallas-Bot</span>
            <button
              type="button"
              class="shell-mobile-nav__close"
              aria-label="关闭菜单"
              @click="closeMobileNav"
            >
              ×
            </button>
          </div>
          <nav class="shell-mobile-nav__links" aria-label="主导航">
            <RouterLink
              v-for="item in nav"
              :key="`m-${item.to}`"
              v-slot="{ navigate, isActive, isExactActive }"
              custom
              :to="item.to"
              :end="item.to === '/'"
            >
              <button
                type="button"
                class="shell-mobile-nav__link"
                :class="{
                  'shell__nav-link--root': item.to === '/',
                  'is-router-active': isActive,
                  'is-router-exact': isExactActive,
                }"
                :aria-current="isExactActive ? 'page' : undefined"
                @click="
                  navigate();
                  closeMobileNav();
                "
              >
                <span class="shell__nav-ico">{{ item.icon }}</span>
                <span class="shell__nav-text">
                  <span class="shell__nav-label">{{ item.label }}</span>
                  <span class="shell__nav-desc">{{ item.description }}</span>
                </span>
              </button>
            </RouterLink>
            <RouterLink
              v-slot="{ navigate, isActive, isExactActive }"
              custom
              to="/preferences"
            >
              <button
                type="button"
                class="shell-mobile-nav__link"
                :class="{ 'is-router-active': isActive, 'is-router-exact': isExactActive }"
                :aria-current="isExactActive ? 'page' : undefined"
                @click="
                  navigate();
                  closeMobileNav();
                "
              >
                <span class="shell__nav-ico">✦</span>
                <span class="shell__nav-text">
                  <span class="shell__nav-label">外观偏好</span>
                  <span class="shell__nav-desc">本机界面呈现</span>
                </span>
              </button>
            </RouterLink>
          </nav>
          <div class="shell-mobile-nav__theme">
            <span class="shell-mobile-nav__theme-label">颜色模式</span>
            <div
              class="shell-toolbar__seg shell-toolbar__seg--compact"
              role="group"
              aria-label="颜色模式"
            >
              <button
                type="button"
                :class="{ 'is-on': consolePrefs.theme === 'dark' }"
                @click="setTheme('dark')"
              >
                深色
              </button>
              <button
                type="button"
                :class="{ 'is-on': consolePrefs.theme === 'light' }"
                @click="setTheme('light')"
              >
                浅色
              </button>
              <button
                type="button"
                :class="{ 'is-on': consolePrefs.theme === 'system' }"
                @click="setTheme('system')"
              >
                系统
              </button>
            </div>
          </div>
        </aside>
        <div
          class="shell-mobile-nav__backdrop"
          aria-hidden="true"
          @click="closeMobileNav"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <button
        v-if="isNarrow"
        type="button"
        class="shell__narrow-open"
        aria-label="打开导航菜单"
        aria-controls="shell-mobile-nav-panel"
        @click="mobileNavOpen = true"
      >
        ☰
      </button>
    </Teleport>

    <div class="shell__main">
      <div class="shell__main-inner">
        <router-view v-slot="{ Component, route: r }">
          <transition
            name="shell-page"
            mode="out-in"
          >
            <component
              :is="Component"
              :key="r.path"
            />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>
