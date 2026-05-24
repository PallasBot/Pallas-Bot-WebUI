<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import brandMarkUrl from "@/assets/pallas-priest.png?url";
import { fetchBots, fetchInstances, fetchPlugins } from "@/api/consoleApi";
import { scheduleInstancesCatalogRefreshOnRoute } from "@/composables/useInstancesCatalogSync";
import { mainNavIconForPath, type MainNavItem } from "@/config/mainNav";
import { SIDEBAR_PIN_DEFINITIONS, type SidebarPinDefinition } from "@/config/sidebarPins";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { initialShellLoading } from "@/utils/routeLoading";
import { displayVersionWithoutSha, pallasBotVersionLabel } from "@/utils/versionDisplay";
import {
  CONSOLE_META_POLL_MS,
  consoleMetaBotUpdate,
  consoleMetaErr,
  consoleMetaHealth,
  consoleMetaLoading,
  refreshConsoleMeta,
} from "@/state/consoleMeta";
import { PALLAS_SHELL_EXTERNAL_LINKS } from "@/utils/pallasExternalLinks";
import ConsoleToastHost from "@/components/ConsoleToastHost.vue";
import { addNavTokenToSidebar, removeNavTokenFromSidebar } from "@/utils/sidebarNavActions";
import { useSidebarNavLists } from "@/composables/useSidebarNavLists";
import type { ThemeMode } from "@/utils/consolePrefs";

const route = useRoute();
const router = useRouter();
const dragPath = ref<string | null>(null);
const dragOverPath = ref<string | null>(null);

const gripMenu = ref<{ path: string; top: number; left: number; minWidth: number } | null>(null);
const gripPointerDown = ref<{ path: string; x: number; y: number } | null>(null);
let gripMenuDocRevoke: (() => void) | null = null;

const { sidebarNavRows, sidebarPoolRows } = useSidebarNavLists();

function isMainLinkActiveForPath(item: MainNavItem): boolean {
  const atPath = route.path === item.to || (item.to !== "/" && route.path.startsWith(`${item.to}/`));
  if (!atPath) return false;
  if (route.path !== item.to) return true;
  const h = (route.hash || "").trim();
  if (!h) return true;
  return !SIDEBAR_PIN_DEFINITIONS.some((p) => p.path === item.to && p.hash === h);
}

function isPinLinkActive(pin: SidebarPinDefinition): boolean {
  return route.path === pin.path && (route.hash || "").trim() === pin.hash;
}

function isMainLinkExact(item: MainNavItem): boolean {
  if (item.to === "/") return route.path === "/";
  if (route.path !== item.to) return false;
  return isMainLinkActiveForPath(item);
}

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

/** 控制台静态资源版本（与首页「控制台资源」一致） */
const brandVersionDisplay = computed(() => {
  const c = consoleMetaHealth.value?.console;
  const ver = (c?.version || "").trim();
  const cleaned = displayVersionWithoutSha(ver);
  if (cleaned) return cleaned;
  if (ver) return ver;
  return `v${webuiVersion}`;
});

/** 当前 API 所在 Pallas-Bot 进程版本（与首页「Pallas-Bot」一致） */
const brandBotVersionDisplay = computed(() =>
  pallasBotVersionLabel(consoleMetaHealth.value, consoleMetaBotUpdate.value),
);

const mainInnerClass = computed(() => ({
  "shell__main-inner": true,
  "shell__main-inner--logs": route.name === "logs",
  "shell__main-inner--home": route.name === "home",
}));

const pageLoadingVisible = computed(() => initialShellLoading.value);

const pageLoadingTitle = computed(() => {
  const t = route.meta?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "页面";
});

const matchedPinForTopBar = computed(() => {
  const h = (route.hash || "").trim();
  return SIDEBAR_PIN_DEFINITIONS.find((p) => p.path === route.path && p.hash === h);
});

const topBarIcon = computed(() => mainNavIconForPath(route.path, route.hash));

const topBarTitle = computed(() => {
  const pin = matchedPinForTopBar.value;
  if (pin) return pin.label;
  if (route.name === "plugin-config") {
    const n = route.params.name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  const t = route.meta?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "控制台";
});

const topBarDesc = computed(() => {
  const pin = matchedPinForTopBar.value;
  if (pin) return pin.description;
  const d = route.meta?.description;
  return typeof d === "string" && d.trim() ? d.trim() : "";
});

const pageBackVisible = computed(() => route.path !== "/" && route.name !== "home");

function pageBackFallback(): RouteLocationRaw {
  if (route.name === "plugin-config") return "/plugins";
  const h = (route.hash || "").trim();
  if (h) return { path: route.path, hash: "" };
  const segs = route.path.split("/").filter(Boolean);
  if (segs.length > 1) return `/${segs.slice(0, -1).join("/")}`;
  return "/";
}

function goPageBack() {
  const back = (window.history.state as { back?: string } | null)?.back;
  if (typeof back === "string" && back.trim()) {
    router.back();
    return;
  }
  void router.push(pageBackFallback());
}

const connectionBadge = computed(() => {
  if (consoleMetaLoading.value) {
    return { text: "API …", cls: "shell__topbar-conn shell__topbar-conn--pending" as const };
  }
  if (consoleMetaErr.value) {
    return { text: "未连接", cls: "shell__topbar-conn shell__topbar-conn--err" as const };
  }
  if (consoleMetaHealth.value?.ok) {
    return { text: "已连接", cls: "shell__topbar-conn shell__topbar-conn--ok" as const };
  }
  return { text: "API 异常", cls: "shell__topbar-conn shell__topbar-conn--warn" as const };
});

let healthPollTimer: ReturnType<typeof setInterval> | null = null;

function onConsoleMetaVisibility() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") {
    void refreshConsoleMeta({ silent: true });
  }
}

function clearGripMenuDocListeners() {
  gripMenuDocRevoke?.();
  gripMenuDocRevoke = null;
}

function closeNavGripMenu() {
  clearGripMenuDocListeners();
  gripMenu.value = null;
  gripPointerDown.value = null;
}

function armNavGripMenuDismiss() {
  clearGripMenuDocListeners();
  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;
    if (t.closest(".shell__nav-grip-dropdown")) return;
    if (t.closest(".shell__nav-grip")) return;
    closeNavGripMenu();
  };
  const onScrollResize = () => closeNavGripMenu();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeNavGripMenu();
  };
  document.addEventListener("click", onDocClick, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("scroll", onScrollResize, true);
  window.addEventListener("resize", onScrollResize);
  gripMenuDocRevoke = () => {
    document.removeEventListener("click", onDocClick, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("scroll", onScrollResize, true);
    window.removeEventListener("resize", onScrollResize);
  };
}

function onNavGripPointerDown(path: string, e: PointerEvent) {
  gripPointerDown.value = { path, x: e.clientX, y: e.clientY };
}

function onNavGripClick(path: string, e: MouseEvent) {
  const anchor = e.currentTarget as HTMLElement | null;
  if (!anchor) return;
  const p = gripPointerDown.value;
  gripPointerDown.value = null;
  if (p != null) {
    if (p.path !== path) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dx * dx + dy * dy > 100) return;
  }
  e.stopPropagation();
  if (gripMenu.value?.path === path) {
    closeNavGripMenu();
    return;
  }
  closeNavGripMenu();
  const r = anchor.getBoundingClientRect();
  const minWidth = Math.max(160, Math.round(r.width));
  const vw = window.innerWidth;
  const left = Math.min(Math.round(r.left), Math.max(8, vw - minWidth - 8));
  gripMenu.value = {
    path,
    top: Math.round(r.bottom + 4),
    left,
    minWidth,
  };
  void nextTick(() => {
    armNavGripMenuDismiss();
  });
}

function removeFromOpenGripMenu() {
  const path = gripMenu.value?.path;
  if (!path) return;
  removeNavTokenFromSidebar(path);
  closeNavGripMenu();
}

function updateNarrow() {
  isNarrow.value = window.matchMedia("(max-width: 860px)").matches;
  if (isNarrow.value) closeNavGripMenu();
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

function exitConsole(): void {
  if (typeof document === "undefined") return;
  
  const baseUrl = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${baseUrl}/logout`;
  form.style.display = "none";
  
  document.body.appendChild(form);
  form.submit();
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
  closeNavGripMenu();
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
  void refreshConsoleMeta();
  void Promise.all([fetchInstances(), fetchPlugins(), fetchBots()]).catch(() => {});
  healthPollTimer = setInterval(() => {
    void refreshConsoleMeta({ silent: true });
  }, CONSOLE_META_POLL_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onConsoleMetaVisibility);
  }
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

let catalogRouteTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => route.fullPath,
  () => {
    closeNavGripMenu();
    closeMobileNav();
    detachLogsScrollListener();
    backTopVisible.value = false;
    void nextTick(() => {
      bindLogsScrollTarget();
      updateBackTopVisibility();
    });
    if (catalogRouteTimer != null) clearTimeout(catalogRouteTimer);
    catalogRouteTimer = setTimeout(() => {
      catalogRouteTimer = null;
      scheduleInstancesCatalogRefreshOnRoute();
    }, 80);
  },
);

watch(pageLoadingVisible, async (vis) => {
  if (vis) return;
  await nextTick();
  bindLogsScrollTarget();
  updateBackTopVisibility();
});

onUnmounted(() => {
  closeNavGripMenu();
  window.removeEventListener("resize", updateNarrow);
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onConsoleMetaVisibility);
  }
  if (catalogRouteTimer != null) {
    clearTimeout(catalogRouteTimer);
    catalogRouteTimer = null;
  }
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
    <ConsoleToastHost />
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
            <svg
              v-if="consolePrefs.sidebarCollapsed"
              class="shell__topbar-collapse-ico"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 5v14M10 8l4 4-4 4M19 5v14"
              />
            </svg>
            <svg
              v-else
              class="shell__topbar-collapse-ico"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 5v14M14 8l-4 4 4 4M19 5v14"
              />
            </svg>
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
        <button
          v-if="pageBackVisible"
          type="button"
          class="shell__topbar-back"
          aria-label="返回上一级"
          title="返回上一级"
          @click="goPageBack"
        >
          <span class="shell__topbar-back-ico" aria-hidden="true">‹</span>
          <span class="shell__topbar-back-label">返回</span>
        </button>
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
          :title="consoleMetaErr || (consoleMetaLoading ? '正在探测 API' : undefined)"
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
            <div
              class="shell__brand-versions"
              aria-label="控制台与 Bot 版本"
            >
              <div
                class="shell__version"
                title="控制台资源版本"
              >
                控制台 {{ brandVersionDisplay }}
              </div>
              <div
                class="shell__version"
                title="当前 Bot 进程版本"
              >
                Bot {{ brandBotVersionDisplay }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <nav class="shell__nav" aria-label="主导航">
        <template v-for="row in sidebarNavRows" :key="row.token">
          <div
            v-if="row.showSection && !consolePrefs.sidebarCollapsed"
            class="shell__nav-section"
            role="presentation"
          >
            {{ row.section }}
          </div>
          <div
            class="shell__nav-item"
            :class="{
              'shell__nav-item--drag-over':
                dragOverPath === row.token && dragPath != null && dragPath !== row.token,
            }"
            @dragover="onNavDragOver(row.token, $event)"
            @dragleave="onNavDragLeave(row.token)"
            @drop="onNavDrop(row.token, $event)"
          >
            <button
              v-if="!isNarrow && !consolePrefs.sidebarCollapsed"
              type="button"
              class="shell__nav-grip"
              draggable="true"
              aria-label="侧栏项菜单（拖动排序、从侧栏移除）"
              aria-haspopup="menu"
              :aria-expanded="gripMenu?.path === row.token ? 'true' : 'false'"
              aria-controls="shell-nav-grip-menu-dropdown"
              title="点击菜单 · 拖动排序"
              @pointerdown="onNavGripPointerDown(row.token, $event)"
              @click="onNavGripClick(row.token, $event)"
              @dragstart="onGripDragStart(row.token, $event)"
              @dragend="onGripDragEnd"
            >
              ⋮
            </button>
            <RouterLink
              v-if="row.kind === 'main'"
              v-slot="{ navigate }"
              custom
              :to="row.item.to"
              :end="row.item.to === '/'"
            >
              <button
                type="button"
                class="shell__nav-link"
                :class="{
                  'shell__nav-link--root': row.item.to === '/',
                  'is-router-active': isMainLinkActiveForPath(row.item),
                  'is-router-exact': isMainLinkExact(row.item),
                }"
                :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, row.item.label)"
                :aria-current="isMainLinkExact(row.item) ? 'page' : undefined"
                @click="navigate"
              >
                <span class="shell__nav-ico">{{ row.item.icon }}</span>
                <span class="shell__nav-text">
                  <span class="shell__nav-label">{{ row.item.label }}</span>
                  <span class="shell__nav-desc">{{ row.item.description }}</span>
                </span>
              </button>
            </RouterLink>
            <RouterLink
              v-else
              v-slot="{ navigate }"
              custom
              :to="{ path: row.pin.path, hash: row.pin.hash }"
            >
              <button
                type="button"
                class="shell__nav-link shell__nav-link--pin"
                :class="{ 'is-router-active': isPinLinkActive(row.pin) }"
                :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, row.pin.label)"
                :aria-current="isPinLinkActive(row.pin) ? 'page' : undefined"
                @click="navigate"
              >
                <span class="shell__nav-ico">{{ row.pin.icon }}</span>
                <span class="shell__nav-text">
                  <span class="shell__nav-label">{{ row.pin.label }}</span>
                  <span class="shell__nav-desc">{{ row.pin.description }}</span>
                </span>
              </button>
            </RouterLink>
          </div>
        </template>
        <details
          v-if="!isNarrow && !consolePrefs.sidebarCollapsed && sidebarPoolRows.length"
          class="shell__nav-pool"
        >
          <summary class="shell__nav-pool-summary">未在侧栏（{{ sidebarPoolRows.length }}）</summary>
          <div class="shell__nav-pool-body">
            <template v-for="row in sidebarPoolRows" :key="'pool-' + row.token">
              <div
                v-if="row.showSection"
                class="shell__nav-pool-section"
                role="presentation"
              >
                {{ row.section }}
              </div>
              <button
                v-if="row.kind === 'main'"
                type="button"
                class="btn shell__nav-pool-btn"
                @click="addNavTokenToSidebar(row.token)"
              >
                <span class="shell__nav-pool-plus" aria-hidden="true">+</span>
                <span class="shell__nav-pool-ico" aria-hidden="true">{{ row.item.icon }}</span>
                {{ row.item.label }}
              </button>
              <button
                v-else
                type="button"
                class="btn shell__nav-pool-btn shell__nav-pool-btn--pin"
                @click="addNavTokenToSidebar(row.token)"
              >
                <span class="shell__nav-pool-plus" aria-hidden="true">+</span>
                <span class="shell__nav-pool-ico" aria-hidden="true">{{ row.pin.icon }}</span>
                {{ row.pin.label }}
              </button>
            </template>
          </div>
        </details>
      </nav>
      <div class="shell__sidebar-bottom">
        <footer class="shell__foot">
          <nav
            class="shell__foot-links"
            aria-label="外部链接"
          >
            <template
              v-for="(item, index) in PALLAS_SHELL_EXTERNAL_LINKS"
              :key="item.href"
            >
              <span
                v-if="index > 0"
                class="shell__foot-sep"
                aria-hidden="true"
              > · </span>
              <a
                class="shell__foot-link"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
              >{{ item.label }}</a>
            </template>
          </nav>
          <div class="shell__foot-copy">
            © PallasBot
          </div>
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
                <span
                  class="shell-mobile-nav__ver"
                  title="控制台资源版本"
                >控制台 {{ brandVersionDisplay }}</span>
                <span
                  class="shell-mobile-nav__ver"
                  title="当前 Bot 进程版本"
                >Bot {{ brandBotVersionDisplay }}</span>
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
            <template v-for="row in sidebarNavRows" :key="`m-${row.token}`">
              <div
                v-if="row.showSection"
                class="shell-mobile-nav__section"
                role="presentation"
              >
                {{ row.section }}
              </div>
              <RouterLink
                v-if="row.kind === 'main'"
                v-slot="{ navigate }"
                custom
                :to="row.item.to"
                :end="row.item.to === '/'"
              >
                <button
                  type="button"
                  class="shell-mobile-nav__link"
                  :class="{
                    'shell__nav-link--root': row.item.to === '/',
                    'is-router-active': isMainLinkActiveForPath(row.item),
                    'is-router-exact': isMainLinkExact(row.item),
                  }"
                  :aria-current="isMainLinkExact(row.item) ? 'page' : undefined"
                  @click="
                    navigate();
                    closeMobileNav();
                  "
                >
                  <span class="shell__nav-ico">{{ row.item.icon }}</span>
                  <span class="shell__nav-text">
                    <span class="shell__nav-label">{{ row.item.label }}</span>
                    <span class="shell__nav-desc">{{ row.item.description }}</span>
                  </span>
                </button>
              </RouterLink>
              <RouterLink
                v-else
                v-slot="{ navigate }"
                custom
                :to="{ path: row.pin.path, hash: row.pin.hash }"
              >
                <button
                  type="button"
                  class="shell-mobile-nav__link shell__nav-link--pin"
                  :class="{ 'is-router-active': isPinLinkActive(row.pin) }"
                  :aria-current="isPinLinkActive(row.pin) ? 'page' : undefined"
                  @click="
                    navigate();
                    closeMobileNav();
                  "
                >
                  <span class="shell__nav-ico">{{ row.pin.icon }}</span>
                  <span class="shell__nav-text">
                    <span class="shell__nav-label">{{ row.pin.label }}</span>
                    <span class="shell__nav-desc">{{ row.pin.description }}</span>
                  </span>
                </button>
              </RouterLink>
            </template>
            <RouterLink
              v-if="sidebarPoolRows.length"
              custom
              to="/preferences#sidebar-order"
              v-slot="{ navigate }"
            >
              <button
                type="button"
                class="shell-mobile-nav__prefs-link muted"
                @click="
                  navigate();
                  closeMobileNav();
                "
              >
                调整侧栏顺序与项目…
              </button>
            </RouterLink>
            <nav
              class="shell-mobile-nav__external"
              aria-label="外部链接"
            >
              <template
                v-for="(item, index) in PALLAS_SHELL_EXTERNAL_LINKS"
                :key="item.href"
              >
                <span
                  v-if="index > 0"
                  class="shell__foot-sep"
                  aria-hidden="true"
                > · </span>
                <a
                  class="shell-mobile-nav__external-link"
                  :href="item.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ item.label }}</a>
              </template>
            </nav>
          </nav>
        </aside>
        <div
          class="shell-mobile-nav__backdrop"
          aria-hidden="true"
          @click="closeMobileNav"
        />
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="gripMenu != null"
        id="shell-nav-grip-menu-dropdown"
        class="shell__nav-grip-dropdown shell__nav-grip-dropdown--floating"
        role="menu"
        :style="{
          top: `${gripMenu.top}px`,
          left: `${gripMenu.left}px`,
          minWidth: `${gripMenu.minWidth}px`,
        }"
        @click.stop
      >
        <button
          v-if="sidebarNavRows.length > 1"
          type="button"
          class="shell__nav-grip-dropdown__item shell__nav-grip-dropdown__item--danger"
          role="menuitem"
          @click="removeFromOpenGripMenu"
        >
          从侧栏移除
        </button>
        <p
          v-else
          class="shell__nav-grip-dropdown__hint muted"
        >
          侧栏至少保留一项。
        </p>
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
          <!-- keep-alive 为 transition 直接子节点时 out-in 易卡住（协议页轮询触发重绘后更明显） -->
          <keep-alive :max="24">
            <component
              :is="Component"
              v-if="r.meta.keepAlive !== false"
              :key="r.path"
            />
          </keep-alive>
          <component
            :is="Component"
            v-if="r.meta.keepAlive === false"
            :key="r.path"
          />
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
