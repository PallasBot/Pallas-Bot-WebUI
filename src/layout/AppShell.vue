<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import { mainNavIconForPath, mainNavItemByPath, type MainNavItem } from "@/config/mainNav";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { initialShellLoading, routeNavLoading } from "@/utils/routeLoading";
import type { ThemeMode } from "@/utils/consolePrefs";

const dragPath = ref<string | null>(null);
const dragOverPath = ref<string | null>(null);

const orderedNav = computed((): MainNavItem[] =>
  consolePrefs.sidebarNavOrder
    .map((to) => mainNavItemByPath(to))
    .filter((item): item is MainNavItem => item != null),
);

const route = useRoute();
const mobileNavOpen = ref(false);
const isNarrow = ref(false);

const mainInnerClass = computed(() => ({
  "shell__main-inner": true,
  "shell__main-inner--logs": route.name === "logs",
}));

const pageLoadingVisible = computed(() => routeNavLoading.value || initialShellLoading.value);

const pageLoadingTitle = computed(() => {
  const t = route.meta?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "页面";
});

const topBarTitle = computed(() => {
  if (route.name === "plugin-config") {
    const n = route.params.name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  const t = route.meta?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "控制台";
});

const topBarIcon = computed(() => mainNavIconForPath(route.path));

const topBarDesc = computed(() => {
  const d = route.meta?.description;
  return typeof d === "string" && d.trim() ? d.trim() : "";
});

const health = ref<HealthResponse | null>(null);
const healthErr = ref("");
const healthLoading = ref(true);

const connectionBadge = computed(() => {
  if (healthLoading.value) {
    return { text: "API …", cls: "shell__topbar-conn shell__topbar-conn--pending" as const };
  }
  if (healthErr.value) {
    return { text: "未连接", cls: "shell__topbar-conn shell__topbar-conn--err" as const };
  }
  if (health.value?.ok) {
    return { text: "API 正常", cls: "shell__topbar-conn shell__topbar-conn--ok" as const };
  }
  return { text: "API 异常", cls: "shell__topbar-conn shell__topbar-conn--warn" as const };
});

let healthPollTimer: ReturnType<typeof setInterval> | null = null;

async function refreshHealth() {
  healthLoading.value = true;
  healthErr.value = "";
  try {
    health.value = await fetchHealth();
  } catch (e) {
    healthErr.value = e instanceof Error ? e.message : String(e);
    health.value = null;
  } finally {
    healthLoading.value = false;
  }
}

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

function reorderNavPaths(fromPath: string, toPath: string) {
  if (fromPath === toPath) return;
  const order = [...consolePrefs.sidebarNavOrder];
  const fi = order.indexOf(fromPath);
  const ti = order.indexOf(toPath);
  if (fi < 0 || ti < 0) return;
  const [moved] = order.splice(fi, 1);
  order.splice(ti, 0, moved);
  setConsolePrefs({ sidebarNavOrder: order });
}

function onGripDragStart(path: string, e: DragEvent) {
  dragPath.value = path;
  e.dataTransfer?.setData("text/plain", path);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
}

function onNavDragOver(path: string, e: DragEvent) {
  if (!dragPath.value) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  dragOverPath.value = path;
}

function onNavDragLeave(path: string) {
  if (dragOverPath.value === path) dragOverPath.value = null;
}

function onNavDrop(targetPath: string, e: DragEvent) {
  e.preventDefault();
  const fromPath = (e.dataTransfer?.getData("text/plain") || "").trim() || dragPath.value || "";
  reorderNavPaths(fromPath, targetPath);
  dragPath.value = null;
  dragOverPath.value = null;
}

function onGripDragEnd() {
  dragPath.value = null;
  dragOverPath.value = null;
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
  void refreshHealth();
  healthPollTimer = setInterval(() => {
    void refreshHealth();
  }, 45000);
});

watch(mobileNavOpen, (open) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
});

watch(
  () => route.fullPath,
  () => {
    closeMobileNav();
    void refreshHealth();
  },
);

onUnmounted(() => {
  window.removeEventListener("resize", updateNarrow);
  if (healthPollTimer != null) {
    clearInterval(healthPollTimer);
    healthPollTimer = null;
  }
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
        <div
          v-for="item in orderedNav"
          :key="item.to"
          class="shell__nav-item"
          :class="{
            'shell__nav-item--drag-over':
              dragOverPath === item.to && dragPath != null && dragPath !== item.to,
          }"
          @dragover="onNavDragOver(item.to, $event)"
          @dragleave="onNavDragLeave(item.to)"
          @drop="onNavDrop(item.to, $event)"
        >
          <span
            v-if="!isNarrow && !consolePrefs.sidebarCollapsed"
            class="shell__nav-grip"
            draggable="true"
            aria-label="拖动调整顺序"
            title="拖动排序"
            @dragstart="onGripDragStart(item.to, $event)"
            @dragend="onGripDragEnd"
          >⋮</span>
          <RouterLink
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
        </div>
      </nav>
      <div class="shell__sidebar-bottom">
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
              v-for="item in orderedNav"
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
          </nav>
        </aside>
        <div
          class="shell-mobile-nav__backdrop"
          aria-hidden="true"
          @click="closeMobileNav"
        />
      </div>
    </Teleport>

    <div class="shell__main">
      <div
        v-if="pageLoadingVisible"
        class="shell-page-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <div class="shell-page-loading__card">
          <div
            class="shell-page-loading__spinner"
            aria-hidden="true"
          />
          <p class="shell-page-loading__title">
            加载中
          </p>
          <p class="shell-page-loading__route muted">
            {{ pageLoadingTitle }}
          </p>
        </div>
      </div>
      <header
        class="shell__topbar"
        aria-label="当前页与连接"
      >
        <button
          v-if="isNarrow"
          type="button"
          class="shell__topbar-menu"
          aria-label="打开导航菜单"
          aria-controls="shell-mobile-nav-panel"
          @click="mobileNavOpen = true"
        >
          ☰
        </button>
        <div class="shell__topbar-lead">
          <h1 class="shell__topbar-title">
            <span class="shell__topbar-ico" aria-hidden="true">{{ topBarIcon }}</span>
            <span class="shell__topbar-title-text">{{ topBarTitle }}</span>
          </h1>
          <p
            v-if="topBarDesc"
            class="shell__topbar-desc muted"
            :title="topBarDesc"
          >
            {{ topBarDesc }}
          </p>
        </div>
        <div class="shell__topbar-end">
          <span
            :class="connectionBadge.cls"
            :title="healthErr || (healthLoading ? '正在探测 API' : undefined)"
          >{{ connectionBadge.text }}</span>
          <div
            class="shell-toolbar__seg shell-toolbar__seg--compact shell__topbar-theme"
            role="group"
            aria-label="颜色模式"
          >
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'dark' }"
              title="深色"
              @click="setTheme('dark')"
            >
              深
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'light' }"
              title="浅色"
              @click="setTheme('light')"
            >
              浅
            </button>
            <button
              type="button"
              :class="{ 'is-on': consolePrefs.theme === 'system' }"
              title="跟随系统"
              @click="setTheme('system')"
            >
              自
            </button>
          </div>
        </div>
      </header>
      <div :class="mainInnerClass">
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
