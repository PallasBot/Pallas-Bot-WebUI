<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, onUpdated, ref, watch } from "vue";
import { useRoute, type RouteLocationNormalizedLoaded } from "vue-router";
import brandMarkUrl from "@/assets/brand-avatar.png?url";
import { fetchBots, fetchInstances, fetchPlugins } from "@/api/consoleApi";
import { scheduleInstancesCatalogRefreshOnRoute } from "@/composables/useInstancesCatalogSync";
import { prefetchPriorityRouteChunks, prefetchRouteChunkByPath } from "@/utils/routePrefetch";
import { MAIN_NAV_ITEMS, type MainNavItem } from "@/config/mainNav";
import { AI_CONFIG_SIDEBAR_PATH } from "@/config/aiConfigSections";
import { AI_OBSERVATION_PATHS, AI_OBSERVATION_SIDEBAR_PATH } from "@/config/aiObservationNav";
import { SIDEBAR_PIN_DEFINITIONS, type SidebarPinDefinition } from "@/config/sidebarPins";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { initialShellLoading } from "@/utils/routeLoading";
import { consoleResourceVersionLabel } from "@/utils/versionDisplay";
import {
  CONSOLE_META_POLL_MS,
  consoleMetaErr,
  consoleMetaHealth,
  consoleMetaLoading,
  consoleMetaWebUpdate,
  refreshConsoleMeta,
} from "@/state/consoleMeta";
import { botRestartInProgress, botRestartBusy, botRestartDialogOpen, botRestartPhase, resetBotRestartSession } from "@/state/botRestartSession";
import BotRestartProgressDialog from "@/components/BotRestartProgressDialog.vue";
import { PALLAS_SHELL_EXTERNAL_LINKS } from "@/utils/pallasExternalLinks";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsoleToastHost from "@/components/ConsoleToastHost.vue";
import { useSidebarNavLists, type SidebarNavMainRowView } from "@/composables/useSidebarNavLists";

const route = useRoute();
const { sidebarNavEntries, sidebarNavEntriesDisplay } = useSidebarNavLists();

/** keep-alive 缓存键：同一路由名只保留一个实例（如 /plugins/a → /plugins/b 不 remount） */
function keepAliveRouteKey(r: RouteLocationNormalizedLoaded): string {
  const name = r.name;
  if (name != null && String(name).trim()) return String(name);
  return r.path;
}

const SIDEBAR_GROUP_OPEN_KEY = "pallas.sidebarGroupOpen";

function readSidebarGroupOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUP_OPEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

const sidebarGroupOpen = ref<Record<string, boolean>>(readSidebarGroupOpen());

function sidebarGroupHasActiveChild(children: SidebarNavMainRowView[]): boolean {
  return children.some((c) => isMainLinkActiveForPath(c.item));
}

function sidebarGroupExpanded(groupId: string, children: SidebarNavMainRowView[]): boolean {
  if (groupId in sidebarGroupOpen.value) return sidebarGroupOpen.value[groupId];
  return sidebarGroupHasActiveChild(children);
}

function toggleSidebarGroup(groupId: string, children: SidebarNavMainRowView[]) {
  const nextOpen = !sidebarGroupExpanded(groupId, children);
  sidebarGroupOpen.value = { ...sidebarGroupOpen.value, [groupId]: nextOpen };
  try {
    localStorage.setItem(SIDEBAR_GROUP_OPEN_KEY, JSON.stringify(sidebarGroupOpen.value));
  } catch {
    /* ignore */
  }
}

function isMainLinkActiveForPath(item: MainNavItem): boolean {
  if (item.to === AI_OBSERVATION_SIDEBAR_PATH) {
    return AI_OBSERVATION_PATHS.some((p) => route.path === p || route.path.startsWith(`${p}/`));
  }
  if (item.to.startsWith("/ai/")) {
    return route.path === item.to || route.path.startsWith(`${item.to}/`);
  }
  if (item.to === AI_CONFIG_SIDEBAR_PATH) {
    return route.path === AI_CONFIG_SIDEBAR_PATH || route.path.startsWith(`${AI_CONFIG_SIDEBAR_PATH}/`);
  }
  const atPath = route.path === item.to || (item.to !== "/" && route.path.startsWith(`${item.to}/`));
  if (!atPath) return false;
  const moreSpecific = MAIN_NAV_ITEMS.some(
    (other) =>
      other.to !== item.to
      && other.to.startsWith(`${item.to}/`)
      && (route.path === other.to || route.path.startsWith(`${other.to}/`)),
  );
  if (moreSpecific) return false;
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
const routeEnterPulse = ref(false);
let routeEnterTimer: ReturnType<typeof setTimeout> | null = null;
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

function scrollMainToTop(instant: boolean) {
  const smooth =
    !instant && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  mainInnerRef.value?.scrollTo({ top: 0, behavior });
  if (logsScrollEl) {
    logsScrollEl.scrollTo({ top: 0, behavior });
  }
}

function scrollPageToTop() {
  scrollMainToTop(false);
}

function scrollPageToTopOnNav() {
  scrollMainToTop(true);
}

const webuiVersion = __WEBUI_VERSION__;

/** 控制台静态资源版本（与首页「控制台资源」一致） */
const brandVersionDisplay = computed(() =>
  consoleResourceVersionLabel(consoleMetaHealth.value, consoleMetaWebUpdate.value, {
    webuiBuildVersion: webuiVersion,
  }),
);

const mainInnerClass = computed(() => ({
  "shell__main-inner": true,
  "shell__main-inner--logs":
    route.name === "logs" || route.name === "log-errors",
  "shell__main-inner--fill":
    route.name === "logs" || route.name === "log-errors",
  "shell__main-inner--home": route.name === "home",
  "shell__main-inner--plugin-store": route.name === "plugin-store" || route.name === "plugins",
  "shell__main-inner--hub": true,
  "shell__main-inner--route-enter": routeEnterPulse.value,
}));

watch(
  () => keepAliveRouteKey(route),
  (_next, prev) => {
    if (prev == null) return;
    routeEnterPulse.value = true;
    if (routeEnterTimer != null) clearTimeout(routeEnterTimer);
    routeEnterTimer = setTimeout(() => {
      routeEnterPulse.value = false;
      routeEnterTimer = null;
    }, 140);
  },
);

const pageLoadingVisible = computed(() => initialShellLoading.value);

const pageLoadingTitle = computed(() => {
  const t = route.meta?.title;
  return typeof t === "string" && t.trim() ? t.trim() : "页面";
});

const connectionBadge = computed(() => {
  if (botRestartInProgress.value) {
    return { text: "重启中", cls: "shell__conn shell__conn--pending" as const };
  }
  if (consoleMetaLoading.value) {
    return { text: "API …", cls: "shell__conn shell__conn--pending" as const };
  }
  if (consoleMetaErr.value) {
    return { text: "未连接", cls: "shell__conn shell__conn--err" as const };
  }
  if (consoleMetaHealth.value?.ok) {
    return { text: "已连接", cls: "shell__conn shell__conn--ok" as const };
  }
  return { text: "API 异常", cls: "shell__conn shell__conn--warn" as const };
});

let healthPollTimer: ReturnType<typeof setInterval> | null = null;

function onConsoleMetaVisibility() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") {
    void refreshConsoleMeta({ silent: true });
  }
}

function updateNarrow() {
  isNarrow.value = window.matchMedia("(max-width: 860px)").matches;
}

function closeMobileNav() {
  mobileNavOpen.value = false;
}

function onShellNavClick(navigate: (e?: MouseEvent) => unknown, event?: MouseEvent) {
  scrollPageToTopOnNav();
  void navigate(event);
  closeMobileNav();
}

function onShellNavPrefetch(path: string) {
  prefetchRouteChunkByPath(path);
}

/** 清理可能挡住点击的全局遮罩/滚动锁（如弹窗残留、首屏 loading 未收起） */
function clearShellInteractionBlockers() {
  if (typeof document === "undefined") return;
  document.body.style.overflow = "";
  if (initialShellLoading.value) {
    initialShellLoading.value = false;
  }
  if (
    botRestartDialogOpen.value
    && !botRestartBusy.value
    && botRestartPhase.value !== "scheduled"
    && botRestartPhase.value !== "disconnecting"
    && botRestartPhase.value !== "reconnecting"
  ) {
    resetBotRestartSession();
  }
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

const shellClass = computed(() => ({
  shell: true,
  "shell--sidebar-collapsed": consolePrefs.sidebarCollapsed,
}));

function navCollapsedLabel(collapsed: boolean, label: string) {
  return collapsed ? label : undefined;
}

onMounted(() => {
  clearShellInteractionBlockers();
  updateNarrow();
  window.addEventListener("resize", updateNarrow);
  void refreshConsoleMeta();
  void Promise.all([fetchInstances(), fetchPlugins(), fetchBots()]).catch(() => {});
  if (typeof window !== "undefined") {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 120));
    idle(() => prefetchPriorityRouteChunks());
  }
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
  window.removeEventListener("resize", updateNarrow);
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onConsoleMetaVisibility);
  }
  if (catalogRouteTimer != null) {
    clearTimeout(catalogRouteTimer);
    catalogRouteTimer = null;
  }
  if (routeEnterTimer != null) {
    clearTimeout(routeEnterTimer);
    routeEnterTimer = null;
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
    <div
      v-if="isNarrow"
      class="shell__mobile-topbar"
    >
      <button
        type="button"
        class="shell__mobile-topbar-btn"
        aria-label="打开导航菜单"
        aria-controls="shell-mobile-nav-panel"
        @click="mobileNavOpen = true"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <div class="shell__mobile-topbar-brand">
        <span class="shell__brand-mark-wrap">
          <img
            class="shell__brand-mark"
            :src="brandMarkUrl"
            alt=""
            width="44"
            height="44"
            decoding="async"
          >
        </span>
        <span class="shell__mobile-topbar-title">Pallas Bot</span>
      </div>
      <span class="shell__mobile-topbar-version">{{ brandVersionDisplay }}</span>
    </div>
    <aside
      class="shell__sidebar"
      :aria-hidden="isNarrow"
    >
      <div
        class="shell__sidebar-top"
        :class="{ 'shell__sidebar-top--collapsed': consolePrefs.sidebarCollapsed && !isNarrow }"
      >
        <template v-if="consolePrefs.sidebarCollapsed && !isNarrow">
          <div class="shell__brand-slot shell__brand-slot--avatar">
            <div class="shell__brand-mark-wrap">
              <img
                class="shell__brand-mark"
                :src="brandMarkUrl"
                alt=""
                width="44"
                height="44"
                decoding="async"
              >
            </div>
            <span
              :class="connectionBadge.cls"
              class="shell__sidebar-conn shell__sidebar-conn--brand shell__sidebar-conn--collapsed-dot"
              :title="consoleMetaErr || (consoleMetaLoading ? '正在探测 API' : undefined)"
              :aria-label="connectionBadge.text"
            >{{ connectionBadge.text }}</span>
          </div>
          <div class="shell__brand-slot shell__brand-slot--expand">
            <button
              type="button"
              class="shell__brand-collapse shell__brand-expand"
              aria-expanded="false"
              aria-label="展开菜单栏"
              @click="toggleSidebar"
            >
              <svg
                class="shell__brand-collapse-ico"
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
                  d="M5 5v14M10 8l4 4-4 4M19 5v14"
                />
              </svg>
            </button>
          </div>
        </template>
        <div
          v-else
          class="shell__brand"
        >
          <div class="shell__brand-mark-wrap">
            <img
              class="shell__brand-mark"
              :src="brandMarkUrl"
              alt=""
              width="44"
              height="44"
              decoding="async"
            >
          </div>
          <div class="shell__brand-main">
            <div class="shell__brand-title-row">
              <div class="shell__title">PBWebUI</div>
              <span
                class="shell__brand-badge"
                title="控制台资源版本"
              >{{ brandVersionDisplay }}</span>
            </div>
            <div class="shell__brand-meta">
              <span
                :class="connectionBadge.cls"
                class="shell__sidebar-conn shell__sidebar-conn--brand"
                :title="consoleMetaErr || (consoleMetaLoading ? '正在探测 API' : undefined)"
              >{{ connectionBadge.text }}</span>
            </div>
          </div>
          <button
            v-if="!isNarrow"
            type="button"
            class="shell__brand-collapse shell__brand-collapse--edge"
            :aria-expanded="!consolePrefs.sidebarCollapsed"
            aria-label="收起菜单栏"
            @click="toggleSidebar"
          >
            <svg
              class="shell__brand-collapse-ico"
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
                d="M5 5v14M14 8l-4 4 4 4M19 5v14"
              />
            </svg>
          </button>
        </div>
      </div>
      <nav class="shell__nav" aria-label="主导航">
        <template
          v-for="entry in sidebarNavEntriesDisplay"
          :key="entry.kind === 'group' ? `g-${entry.groupId}` : entry.row.token"
        >
          <div
            v-if="entry.kind === 'group'"
            class="shell__nav-group"
            :class="{ 'shell__nav-group--open': sidebarGroupExpanded(entry.groupId, entry.children) }"
          >
            <button
              type="button"
              class="shell__nav-group-toggle"
              :aria-expanded="sidebarGroupExpanded(entry.groupId, entry.children)"
              :aria-label="`${entry.label}菜单`"
              @click="toggleSidebarGroup(entry.groupId, entry.children)"
            >
              <ConsoleNavIcon
                class="shell__nav-ico"
                :name="entry.icon"
                :size="18"
              />
              <span class="shell__nav-text">
                <span class="shell__nav-label">{{ entry.label }}</span>
              </span>
              <span
                class="shell__nav-group-chevron"
                aria-hidden="true"
              >›</span>
            </button>
            <div
              v-show="sidebarGroupExpanded(entry.groupId, entry.children)"
              class="shell__nav-group-children"
            >
              <div
                v-for="child in entry.children"
                :key="child.token"
                class="shell__nav-item shell__nav-item--child"
              >
                <RouterLink
                  v-slot="{ navigate }"
                  custom
                  :to="child.item.to"
                  :end="child.item.to === '/'"
                >
                  <button
                    type="button"
                    class="shell__nav-link shell__nav-link--child"
                    :class="{
                      'shell__nav-link--heavy': ['/logs', '/instances', '/plugins', '/database'].includes(child.item.to),
                      'is-router-active': isMainLinkActiveForPath(child.item),
                      'is-router-exact': isMainLinkExact(child.item),
                    }"
                    :aria-current="isMainLinkExact(child.item) ? 'page' : undefined"
                    @pointerenter="onShellNavPrefetch(child.item.to)"
                    @click="onShellNavClick(navigate, $event)"
                  >
                    <ConsoleNavIcon
                      class="shell__nav-ico"
                      :name="child.item.icon"
                      :size="18"
                    />
                    <span class="shell__nav-text">
                      <span class="shell__nav-label">{{ child.item.label }}</span>
                    </span>
                  </button>
                </RouterLink>
              </div>
            </div>
          </div>
          <div
            v-else-if="entry.row.kind === 'main'"
            class="shell__nav-item"
          >
            <RouterLink
              v-slot="{ navigate }"
              custom
              :to="entry.row.item.to"
              :end="entry.row.item.to === '/'"
            >
              <button
                type="button"
                class="shell__nav-link"
                :class="{
                  'shell__nav-link--root': entry.row.item.to === '/',
                  'shell__nav-link--heavy': ['/logs', '/instances', '/plugins', '/database'].includes(entry.row.item.to),
                  'is-router-active': isMainLinkActiveForPath(entry.row.item),
                  'is-router-exact': isMainLinkExact(entry.row.item),
                }"
                :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, entry.row.item.label)"
                :aria-current="isMainLinkExact(entry.row.item) ? 'page' : undefined"
                @pointerenter="onShellNavPrefetch(entry.row.item.to)"
                @click="onShellNavClick(navigate, $event)"
              >
                <ConsoleNavIcon
                  class="shell__nav-ico"
                  :name="entry.row.item.icon"
                  :size="18"
                />
                <span class="shell__nav-text">
                  <span class="shell__nav-label">{{ entry.row.item.label }}</span>
                </span>
              </button>
            </RouterLink>
          </div>
          <div
            v-else
            class="shell__nav-item"
          >
            <RouterLink
              v-slot="{ navigate }"
              custom
              :to="{ path: entry.row.pin.path, hash: entry.row.pin.hash }"
            >
              <button
                type="button"
                class="shell__nav-link shell__nav-link--pin"
                :class="{ 'is-router-active': isPinLinkActive(entry.row.pin) }"
                :aria-label="navCollapsedLabel(consolePrefs.sidebarCollapsed, entry.row.pin.label)"
                :aria-current="isPinLinkActive(entry.row.pin) ? 'page' : undefined"
                @pointerenter="onShellNavPrefetch(entry.row.pin.path)"
                @click="onShellNavClick(navigate, $event)"
              >
                <ConsoleNavIcon
                  class="shell__nav-ico"
                  :name="entry.row.pin.icon"
                  :size="18"
                />
                <span class="shell__nav-text">
                  <span class="shell__nav-label">{{ entry.row.pin.label }}</span>
                </span>
              </button>
            </RouterLink>
          </div>
        </template>
      </nav>
      <div class="shell__sidebar-tools">
        <button
          type="button"
          class="shell__sidebar-exit"
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
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span class="shell__sidebar-exit-label">退出</span>
        </button>
      </div>
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
              <div class="shell__brand-mark-wrap">
                <img
                  class="shell__brand-mark"
                  :src="brandMarkUrl"
                  alt=""
                  width="44"
                  height="44"
                  decoding="async"
                >
              </div>
              <div class="shell-mobile-nav__brand-text">
                <div class="shell__brand-title-row">
                  <span class="shell-mobile-nav__brand">PBWebUI</span>
                  <span
                    class="shell__brand-badge"
                    title="控制台资源版本"
                  >{{ brandVersionDisplay }}</span>
                </div>
                <div class="shell__brand-meta shell__brand-meta--mobile">
                  <span
                    :class="connectionBadge.cls"
                    class="shell__sidebar-conn shell__sidebar-conn--brand"
                    :title="consoleMetaErr || (consoleMetaLoading ? '正在探测 API' : undefined)"
                  >{{ connectionBadge.text }}</span>
                </div>
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
            <template
              v-for="entry in sidebarNavEntries"
              :key="entry.kind === 'group' ? `m-g-${entry.groupId}` : `m-${entry.row.token}`"
            >
              <div
                v-if="entry.kind === 'group'"
                class="shell__nav-group shell__nav-group--mobile"
                :class="{ 'shell__nav-group--open': sidebarGroupExpanded(entry.groupId, entry.children) }"
              >
                <button
                  type="button"
                  class="shell-mobile-nav__link shell__nav-group-toggle"
                  :aria-expanded="sidebarGroupExpanded(entry.groupId, entry.children)"
                  @click="toggleSidebarGroup(entry.groupId, entry.children)"
                >
                  <ConsoleNavIcon
                class="shell__nav-ico"
                :name="entry.icon"
                :size="18"
              />
                  <span class="shell__nav-text">
                    <span class="shell__nav-label">{{ entry.label }}</span>
                  </span>
                  <span
                    class="shell__nav-group-chevron"
                    aria-hidden="true"
                  >›</span>
                </button>
                <div
                  v-show="sidebarGroupExpanded(entry.groupId, entry.children)"
                  class="shell__nav-group-children"
                >
                  <RouterLink
                    v-for="child in entry.children"
                    :key="`m-${child.token}`"
                    v-slot="{ navigate }"
                    custom
                    :to="child.item.to"
                  >
                    <button
                      type="button"
                      class="shell-mobile-nav__link shell__nav-link--child"
                      :class="{
                        'shell__nav-link--heavy': ['/logs', '/instances', '/plugins', '/database'].includes(child.item.to),
                        'is-router-active': isMainLinkActiveForPath(child.item),
                      }"
                      :aria-current="isMainLinkExact(child.item) ? 'page' : undefined"
                      @pointerenter="onShellNavPrefetch(child.item.to)"
                      @click="onShellNavClick(navigate, $event)"
                    >
                      <ConsoleNavIcon
                      class="shell__nav-ico"
                      :name="child.item.icon"
                      :size="18"
                    />
                      <span class="shell__nav-text">
                        <span class="shell__nav-label">{{ child.item.label }}</span>
                      </span>
                    </button>
                  </RouterLink>
                </div>
              </div>
              <RouterLink
                v-else-if="entry.row.kind === 'main'"
                v-slot="{ navigate }"
                custom
                :to="entry.row.item.to"
                :end="entry.row.item.to === '/'"
              >
                <button
                  type="button"
                  class="shell-mobile-nav__link"
                  :class="{
                    'shell__nav-link--root': entry.row.item.to === '/',
                    'shell__nav-link--heavy': ['/logs', '/instances', '/plugins', '/database'].includes(entry.row.item.to),
                    'is-router-active': isMainLinkActiveForPath(entry.row.item),
                    'is-router-exact': isMainLinkExact(entry.row.item),
                  }"
                  :aria-current="isMainLinkExact(entry.row.item) ? 'page' : undefined"
                  @pointerenter="onShellNavPrefetch(entry.row.item.to)"
                  @click="onShellNavClick(navigate, $event)"
                >
                  <ConsoleNavIcon
                  class="shell__nav-ico"
                  :name="entry.row.item.icon"
                  :size="18"
                />
                  <span class="shell__nav-text">
                    <span class="shell__nav-label">{{ entry.row.item.label }}</span>
                  </span>
                </button>
              </RouterLink>
              <RouterLink
                v-else
                v-slot="{ navigate }"
                custom
                :to="{ path: entry.row.pin.path, hash: entry.row.pin.hash }"
              >
                <button
                  type="button"
                  class="shell-mobile-nav__link shell__nav-link--pin"
                  :class="{ 'is-router-active': isPinLinkActive(entry.row.pin) }"
                  :aria-current="isPinLinkActive(entry.row.pin) ? 'page' : undefined"
                  @pointerenter="onShellNavPrefetch(entry.row.pin.path)"
                  @click="onShellNavClick(navigate, $event)"
                >
                  <ConsoleNavIcon
                  class="shell__nav-ico"
                  :name="entry.row.pin.icon"
                  :size="18"
                />
                  <span class="shell__nav-text">
                    <span class="shell__nav-label">{{ entry.row.pin.label }}</span>
                  </span>
                </button>
              </RouterLink>
            </template>
            <div class="shell-mobile-nav__tools">
              <button
                type="button"
                class="shell__sidebar-exit shell__sidebar-exit--mobile"
                @click="exitConsole"
              >
                退出控制台
              </button>
            </div>
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
          <keep-alive :max="24">
            <component
              :is="Component"
              v-if="Component && r.meta.keepAlive !== false"
              :key="keepAliveRouteKey(r)"
            />
          </keep-alive>
          <component
            :is="Component"
            v-if="Component && r.meta.keepAlive === false"
            :key="keepAliveRouteKey(r)"
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
      <BotRestartProgressDialog />
    </div>
  </div>
</template>
