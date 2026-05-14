<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref, watch } from "vue";
import { useRoute } from "vue-router";
import brandMarkUrl from "@/assets/pallas-priest.png?url";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import { mainNavIconForPath, mainNavItemByPath, type MainNavItem } from "@/config/mainNav";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { initialShellLoading } from "@/utils/routeLoading";
import { displayVersionWithoutSha } from "@/utils/versionDisplay";
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

const mainInnerRef = ref<HTMLElement | null>(null);
const backTopVisible = ref(false);
/** 运行日志页：主区域不滚动，监听列表/原始视图滚动容器 */
let logsScrollEl: HTMLElement | null = null;
const BACK_TOP_SCROLL_THRESHOLD = 200;
let logsScrollRaf = 0;

function detachLogsScrollListener() {
  if (logsScrollEl) {
    logsScrollEl.removeEventListener("scroll", onLogsScrollScroll);
    logsScrollEl = null;
  }
}

function scanLogsScrollTarget(root: HTMLElement): HTMLElement | null {
  const feed = root.querySelector(".log-feed");
  const raw = root.querySelector(".pre-block--logs-tall");
  for (const el of [feed, raw]) {
    if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 2) return el;
  }
  if (feed instanceof HTMLElement) return feed;
  if (raw instanceof HTMLElement) return raw;
  return null;
}

function bindLogsScrollTarget() {
  detachLogsScrollListener();
  if (route.name !== "logs") return;
  const root = mainInnerRef.value;
  if (!root) return;
  logsScrollEl = scanLogsScrollTarget(root);
  if (logsScrollEl) {
    logsScrollEl.addEventListener("scroll", onLogsScrollScroll, { passive: true });
  }
  updateBackTopVisibility();
}

function onLogsScrollScroll() {
  updateBackTopVisibility();
}

function updateBackTopVisibility() {
  const main = mainInnerRef.value;
  const mainScrolled = main ? main.scrollTop > BACK_TOP_SCROLL_THRESHOLD : false;
  const logsScrolled = logsScrollEl ? logsScrollEl.scrollTop > BACK_TOP_SCROLL_THRESHOLD : false;
  backTopVisible.value = mainScrolled || logsScrolled;
}

function onMainInnerScroll() {
  updateBackTopVisibility();
}

function scrollPageToTop() {
  const smooth = typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  mainInnerRef.value?.scrollTo({ top: 0, behavior });
  if (logsScrollEl) {
    logsScrollEl.scrollTo({ top: 0, behavior });
  }
}

const webuiVersion = __WEBUI_VERSION__;

/** 与首屏「控制台资源」一致：展示服务端上报版本（去掉哈希片段），缺失时回退构建号 */
const brandVersionDisplay = computed(() => {
  const c = health.value?.console;
  const ver = (c?.version || "").trim();
  const cleaned = displayVersionWithoutSha(ver);
  if (cleaned) return cleaned;
  if (ver) return ver;
  return `v${webuiVersion}`;
});

const mainInnerClass = computed(() => ({
  "shell__main-inner": true,
  "shell__main-inner--logs": route.name === "logs",
}));

const pageLoadingVisible = computed(() => initialShellLoading.value);

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
    return { text: "已连接", cls: "shell__topbar-conn shell__topbar-conn--ok" as const };
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
  isNarrow.value = window.matchMedia("(max-width: 860px)").matches;
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

function exitConsole() {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  try {
    const ref = document.referrer;
    if (ref) {
      const u = new URL(ref);
      if (u.origin === window.location.origin) {
        window.location.assign(ref);
        return;
      }
    }
  } catch {
    /* ignore */
  }
  window.close();
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
  void nextTick(() => {
    bindLogsScrollTarget();
    updateBackTopVisibility();
  });
});

onUpdated(() => {
  if (route.name !== "logs") return;
  if (typeof window === "undefined") return;
  if (logsScrollRaf) window.cancelAnimationFrame(logsScrollRaf);
  logsScrollRaf = window.requestAnimationFrame(() => {
    logsScrollRaf = 0;
    const root = mainInnerRef.value;
    if (!root) return;
    const next = scanLogsScrollTarget(root);
    const cur = logsScrollEl;
    const curBad = cur != null && !cur.isConnected;
    if (next !== cur || curBad) {
      bindLogsScrollTarget();
    }
  });
});

watch(mobileNavOpen, (open) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = open ? "hidden" : "";
});

watch(
  () => route.fullPath,
  () => {
    closeMobileNav();
    detachLogsScrollListener();
    backTopVisible.value = false;
    void nextTick(() => {
      bindLogsScrollTarget();
      updateBackTopVisibility();
    });
  },
);

watch(pageLoadingVisible, async (vis) => {
  if (vis) return;
  await nextTick();
  bindLogsScrollTarget();
  updateBackTopVisibility();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateNarrow);
  if (healthPollTimer != null) {
    clearInterval(healthPollTimer);
    healthPollTimer = null;
  }
  detachLogsScrollListener();
  if (typeof window !== "undefined" && logsScrollRaf) {
    window.cancelAnimationFrame(logsScrollRaf);
    logsScrollRaf = 0;
  }
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div :class="shellClass">
    <div class="shell__bg" aria-hidden="true" />
    <header
      class="shell__topbar"
      aria-label="当前页与连接"
    >
      <div class="shell__topbar-start">
        <div class="shell__topbar-rail">
          <button
            v-if="!isNarrow"
            type="button"
            class="shell__topbar-collapse"
            :aria-expanded="!consolePrefs.sidebarCollapsed"
            :aria-label="consolePrefs.sidebarCollapsed ? '展开菜单栏' : '收起菜单栏'"
            @click="toggleSidebar"
          >
            {{ consolePrefs.sidebarCollapsed ? "»" : "«" }}
          </button>
          <button
            v-else
            type="button"
            class="shell__topbar-menu"
            aria-label="打开导航菜单"
            aria-controls="shell-mobile-nav-panel"
            @click="mobileNavOpen = true"
          >
            ☰
          </button>
          <span class="shell__topbar-vrule" aria-hidden="true" />
        </div>
      </div>
      <div class="shell__topbar-lead">
        <h1 class="shell__topbar-title">
          <span class="shell__topbar-ico" aria-hidden="true">{{ topBarIcon }}</span>
          <span class="shell__topbar-title-text">{{ topBarTitle }}</span>
        </h1>
        <p
          v-if="topBarDesc"
          class="shell__topbar-desc muted"
          :class="{ 'shell__topbar-desc--hide-narrow': isNarrow }"
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
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                />
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
                <rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </span>
          </button>
        </div>
        <button
          type="button"
          class="shell__topbar-exit"
          title="退出控制台"
          aria-label="退出控制台"
          @click="exitConsole"
        >
          <svg
            class="shell__ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>
        </button>
      </div>
    </header>
    <aside
      class="shell__sidebar"
      :aria-hidden="isNarrow"
    >
      <div class="shell__sidebar-top">
        <div class="shell__brand">
          <img
            class="shell__brand-mark"
            :src="brandMarkUrl"
            alt=""
            width="28"
            height="28"
            decoding="async"
          >
          <div class="shell__brand-main">
            <div class="shell__title">Pallas-Bot</div>
            <div class="shell__version">{{ brandVersionDisplay }}</div>
          </div>
        </div>
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
            <div class="shell-mobile-nav__brand-block">
              <img
                class="shell-mobile-nav__mark"
                :src="brandMarkUrl"
                alt=""
                width="28"
                height="28"
                decoding="async"
              >
              <div class="shell-mobile-nav__brand-text">
                <span class="shell-mobile-nav__brand">Pallas-Bot</span>
                <span class="shell-mobile-nav__ver">{{ brandVersionDisplay }}</span>
              </div>
            </div>
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
      <div
        ref="mainInnerRef"
        :class="mainInnerClass"
        @scroll.passive="onMainInnerScroll"
      >
        <router-view v-slot="{ Component, route: r }">
          <transition
            name="shell-page"
            mode="out-in"
          >
            <keep-alive :max="24">
              <component
                :is="Component"
                :key="r.path"
              />
            </keep-alive>
          </transition>
        </router-view>
      </div>
      <Teleport to="body">
        <button
          v-show="backTopVisible"
          type="button"
          class="shell-back-top"
          aria-label="返回顶部"
          title="返回顶部"
          @click="scrollPageToTop"
        >
          <svg
            class="shell-back-top__ico"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M6 7h12M12 19L12 9M8 13l4-4 4 4"
            />
          </svg>
        </button>
      </Teleport>
    </div>
  </div>
</template>
