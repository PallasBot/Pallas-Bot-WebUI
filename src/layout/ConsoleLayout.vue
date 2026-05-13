<script setup lang="ts">
import { fetchInstances } from "@/api/consoleApi";
import { pallasBotContextKey } from "@/types/pallas-bot-context";
import { useConnectionStatus } from "@/composables/useConnectionStatus";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import {
  AdjustmentIcon,
  ApplicationIcon,
  ChevronDownIcon,
  DataBaseIcon,
  GridViewIcon,
  InfoCircleFilledIcon,
  LinkIcon,
  LoadingIcon,
  MapConnectionIcon,
  MenuFoldIcon,
  MenuUnfoldIcon,
  MoonIcon,
  RefreshIcon,
  SettingIcon,
  SunnyIcon,
  TicketIcon,
  ViewListIcon,
  ViewModuleIcon,
  BookIcon,
} from "tdesign-icons-vue-next";
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { buildDocumentTitle, documentTitleExtra } from "@/utils/documentTitle";
import { setTabFavicon } from "@/utils/tabFavicon";
import { isDark, toggleTheme } from "@/utils/theme";

const route = useRoute();
const router = useRouter();
const { ok, last, refresh, healthTick } = useConnectionStatus(20000);
provide(pallasConnectionKey, { ok, last, refresh, healthTick });
const refreshing = ref(false);
const pageLoading = ref(false);
const refreshQueued = ref(false);
const BOT_PICK_KEY = "pallas.selected_bot_self_id";
const selectedBotSelfId = ref<string | null>(null);
type BotOption = {
  selfId: string;
  label: string;
  nickname: string;
  qq: string;
  avatar: string;
};
const botOptions = ref<BotOption[]>([]);

function setSelectedBotSelfId(selfId: string | null) {
  selectedBotSelfId.value = selfId;
  if (typeof localStorage === "undefined") return;
  const val = (selfId || "").trim();
  if (val) localStorage.setItem(BOT_PICK_KEY, val);
  else localStorage.removeItem(BOT_PICK_KEY);
}

provide(pallasBotContextKey, { selectedBotSelfId, setSelectedBotSelfId });

const NAV_DRAWER_MQ = "(max-width: 900px)";
const SIDEBAR_COLLAPSED_KEY = "pallas.sidebar.collapsed";
const isNarrowLayout = ref(false);
const navDrawerOpen = ref(false);
const sidebarCollapsed = ref(false);

function loadSidebarCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
}

function toggleSidebarCollapsed(): void {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? "1" : "0");
  }
}

function syncNarrowLayout() {
  if (typeof window === "undefined") return;
  const next = window.matchMedia(NAV_DRAWER_MQ).matches;
  isNarrowLayout.value = next;
  if (!next) navDrawerOpen.value = false;
}

let removeBeforeEach: (() => void) | undefined;

onMounted(() => {
  removeBeforeEach = router.beforeEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
      documentTitleExtra.value = "";
    }
  });
  void ensureBotServiceBaseUrl();
  setTabFavicon(`${import.meta.env.BASE_URL}pallas-priest.png`, "image/png");
  if (typeof localStorage !== "undefined") {
    const saved = (localStorage.getItem(BOT_PICK_KEY) || "").trim();
    if (saved) selectedBotSelfId.value = saved;
  }
  void loadBotOptions();
  sidebarCollapsed.value = loadSidebarCollapsed();
  syncNarrowLayout();
  window.addEventListener("resize", syncNarrowLayout);
});

async function loadBotOptions() {
  if (ok.value !== true) return;
  try {
    const data = await fetchInstances();
    const out: BotOption[] = [];
    const seen = new Set<string>();
    const profileMap = data.bot_profiles ?? {};
    const accountNameMap = new Map<string, string>();
    const accounts = data.pallas_protocol?.accounts ?? data.napcat?.accounts ?? [];
    for (const row of accounts) {
      const qq = String(row.qq ?? row.id ?? "").trim();
      const name = String(row.display_name ?? "").trim();
      if (qq && name && !accountNameMap.has(qq)) accountNameMap.set(qq, name);
    }
    for (const row of data.nonebot_bots || []) {
      const sid = String(row.self_id || "").trim();
      if (!sid || seen.has(sid)) continue;
      seen.add(sid);
      const profileName = String(profileMap[sid]?.nickname ?? "").trim();
      const accountName = accountNameMap.get(sid) ?? "";
      const nickname = profileName || accountName || "Bot";
      out.push({
        selfId: sid,
        label: sid,
        nickname,
        qq: sid,
        avatar: /^\d+$/.test(sid) ? `https://q1.qlogo.cn/g?b=qq&nk=${sid}&s=100` : "",
      });
    }
    botOptions.value = out;
    if (!out.length) {
      setSelectedBotSelfId(null);
      return;
    }
    if (!selectedBotSelfId.value || !out.some((x) => x.selfId === selectedBotSelfId.value)) {
      setSelectedBotSelfId(out[0]!.selfId);
    }
  } catch {}
}

const selectedBotOption = computed(
  () => botOptions.value.find((x) => x.selfId === selectedBotSelfId.value) ?? botOptions.value[0] ?? null,
);
const selectedBotAvatar = computed(() => {
  const qq = String(selectedBotOption.value?.selfId || "").trim();
  if (!/^\d+$/.test(qq)) return "";
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100`;
});

const nav = [
  { name: "dashboard" as const, to: { name: "dashboard" }, label: "仪表盘", icon: ViewModuleIcon },
  { name: "accounts" as const, to: { name: "accounts" }, label: "实例", icon: ApplicationIcon },
  { name: "instances" as const, to: { name: "instances" }, label: "好友与群", icon: MapConnectionIcon },
  { name: "ai-extension" as const, to: { name: "ai-extension" }, label: "AI 扩展", icon: MapConnectionIcon },
  { name: "protocol" as const, to: { name: "protocol" }, label: "协议管理", icon: LinkIcon },
  { name: "logs" as const, to: { name: "logs" }, label: "运行日志", icon: TicketIcon },
  { name: "plugins" as const, to: { name: "plugins" }, label: "插件列表", icon: GridViewIcon },
  { name: "common-config" as const, to: { name: "common-config" }, label: "通用配置", icon: AdjustmentIcon },
  { name: "database" as const, to: { name: "database" }, label: "数据库管理", icon: DataBaseIcon },
  { name: "settings" as const, to: { name: "settings" }, label: "偏好与连接", icon: SettingIcon },
  { name: "about" as const, to: { name: "about" }, label: "关于", icon: InfoCircleFilledIcon },
  { name: "update" as const, to: { name: "update" }, label: "更新", icon: RefreshIcon },
];

const accountDropdownOptions = computed(() =>
  botOptions.value.map((b) => ({
    value: b.selfId,
    content: `${b.nickname}  ·  QQ ${b.qq}`,
    active: b.selfId === selectedBotSelfId.value,
  })),
);

function onAccountDropdownClick(data: { value?: string | number }) {
  if (data.value != null) setSelectedBotSelfId(String(data.value));
}

function onNavClick(item: (typeof nav)[number]) {
  void router.push(item.to);
}

const hostLabel = computed(() => {
  if (typeof window === "undefined") return "";
  return window.location.host;
});

const DOCS = "https://github.com/PallasBot/Pallas-Bot";
const REPO = "https://github.com/PallasBot/Pallas-Bot";

async function doRefresh() {
  if (refreshing.value) {
    refreshQueued.value = true;
    return;
  }
  refreshing.value = true;
  pageLoading.value = true;
  try {
    await refresh();
  } finally {
    refreshing.value = false;
    if (refreshQueued.value) {
      refreshQueued.value = false;
      void doRefresh();
      return;
    }
    window.setTimeout(() => {
      pageLoading.value = false;
    }, 280);
  }
}

watch(
  () => route.fullPath,
  async () => {
    navDrawerOpen.value = false;
    pageLoading.value = true;
    void doRefresh();
    await nextTick();
    window.setTimeout(() => {
      if (!refreshing.value && !refreshQueued.value) {
        pageLoading.value = false;
      }
    }, 280);
  },
);

watch(healthTick, () => {
  if (ok.value === true) void loadBotOptions();
});

watch(
  () => [route.fullPath, route.meta.title, documentTitleExtra.value] as const,
  () => {
    document.title = buildDocumentTitle(route.meta.title, documentTitleExtra.value);
  },
  { immediate: true },
);

const qqAvatarImgProps = { referrerPolicy: "no-referrer" as const };

onUnmounted(() => {
  removeBeforeEach?.();
  if (typeof window !== "undefined") window.removeEventListener("resize", syncNarrowLayout);
});

function onMobileNavClick(item: (typeof nav)[number]) {
  navDrawerOpen.value = false;
  void router.push(item.to);
}

const currentNavLabel = computed(() => {
  const hit = nav.find((x) => x.name === route.name);
  return hit?.label ?? "控制台";
});

const footerYear = new Date().getFullYear();
</script>

<template>
  <div
    class="pallas-root"
    :class="{ 'is-sidebar-collapsed': sidebarCollapsed && !isNarrowLayout }"
  >
    <header class="pallas-header">
      <div class="pallas-header-lead">
        <t-button
          v-if="!isNarrowLayout"
          class="pallas-sidebar-toggle"
          shape="circle"
          variant="outline"
          :title="sidebarCollapsed ? '展开侧栏' : '收起侧栏'"
          @click="toggleSidebarCollapsed"
        >
          <template #icon>
            <component :is="sidebarCollapsed ? MenuUnfoldIcon : MenuFoldIcon" />
          </template>
        </t-button>
        <t-button
          v-if="isNarrowLayout"
          class="pallas-menu-btn"
          shape="circle"
          variant="outline"
          aria-label="打开导航菜单"
          @click="navDrawerOpen = true"
        >
          <template #icon>
            <ViewListIcon />
          </template>
        </t-button>
        <div class="pallas-title">
          <span class="pallas-title-mark" aria-hidden="true" />
          <div class="pallas-title-stack">
            <span class="pallas-title-text">Pallas-Bot 控制台</span>
            <span
              v-if="isNarrowLayout"
              class="pallas-route-hint"
            >{{ currentNavLabel }}</span>
          </div>
          <t-tag class="tag-beta" variant="light-outline" size="small">
            Beta
          </t-tag>
        </div>
      </div>
      <div class="pallas-header-right">
        <div
          v-if="!isNarrowLayout"
          class="pallas-header-actions"
        >
          <div
            class="pallas-connect"
            title="基于 /pallas/api/health"
          >
            <span
              class="pallas-dot"
              :class="{ off: ok === false, unk: ok === null }"
            />
            <span
              v-if="ok"
              class="pallas-host"
            >已连接 <span class="pallas-host-addr">@{{ hostLabel }}</span></span>
            <span v-else-if="ok === null">检查中</span>
            <span
              v-else
              class="pallas-host pallas-err"
            >未连接</span>
          </div>
          <span class="pallas-header-actions-gap" aria-hidden="true" />
          <div class="pallas-header-toolbar">
            <t-button
              shape="circle"
              variant="outline"
              class="header-icon-btn"
              title="切换浅色 / 深色"
              @click="toggleTheme"
            >
              <template #icon>
                <component :is="isDark ? SunnyIcon : MoonIcon" />
              </template>
            </t-button>
            <a
              class="header-link"
              :href="DOCS"
              target="_blank"
              rel="noopener"
            >文档</a>
            <a
              class="header-link"
              :href="REPO"
              target="_blank"
              rel="noopener"
            >GitHub</a>
            <t-dropdown
              class="account-switch"
              trigger="click"
              :disabled="!botOptions.length"
              :options="accountDropdownOptions"
              @click="onAccountDropdownClick"
            >
              <t-button size="small" variant="outline" class="account-switch-btn" :class="{ 'is-empty': !botOptions.length }">
                <span class="switch-dot" />
                <span>{{ botOptions.length ? "切换账号" : "暂无账号" }}</span>
                <t-avatar v-if="selectedBotAvatar && botOptions.length" shape="circle" :image="selectedBotAvatar" :image-props="qqAvatarImgProps" size="small" />
                <t-avatar v-else shape="circle" size="small">B</t-avatar>
                <ChevronDownIcon />
              </t-button>
            </t-dropdown>
          </div>
        </div>

        <div
          v-else
          class="pallas-header-toolbar pallas-header-toolbar--narrow"
        >
          <t-button
            shape="circle"
            variant="outline"
            class="header-icon-btn"
            title="切换浅色 / 深色"
            @click="toggleTheme"
          >
            <template #icon>
              <component :is="isDark ? SunnyIcon : MoonIcon" />
            </template>
          </t-button>
          <t-tooltip content="文档" placement="bottom">
            <a
              class="header-icon-link"
              :href="DOCS"
              target="_blank"
              rel="noopener"
              aria-label="文档"
            >
              <BookIcon />
            </a>
          </t-tooltip>
          <t-tooltip content="GitHub" placement="bottom">
            <a
              class="header-icon-link"
              :href="REPO"
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
            >
              <LinkIcon />
            </a>
          </t-tooltip>
          <t-dropdown
            class="account-switch account-switch--toolbar-narrow"
            trigger="click"
            :disabled="!botOptions.length"
            :options="accountDropdownOptions"
            @click="onAccountDropdownClick"
          >
            <t-button size="small" variant="outline" class="account-switch-btn account-switch-btn--toolbar-narrow" :class="{ 'is-empty': !botOptions.length }">
              <span class="switch-dot" />
              <span class="account-switch-label">{{ botOptions.length ? "切换账号" : "暂无账号" }}</span>
              <t-avatar v-if="selectedBotAvatar && botOptions.length" shape="circle" :image="selectedBotAvatar" :image-props="qqAvatarImgProps" size="small" />
              <t-avatar v-else shape="circle" size="small">B</t-avatar>
              <ChevronDownIcon />
            </t-button>
          </t-dropdown>
        </div>
      </div>
    </header>

    <t-drawer
      v-model:visible="navDrawerOpen"
      placement="left"
      size="288px"
      class="pallas-nav-drawer-wrap"
      :footer="false"
      attach="body"
      destroy-on-close
    >
      <template #header>
        <div class="pallas-drawer-hd">
          <span class="pallas-drawer-title">导航</span>
          <span class="pallas-drawer-sub">{{ currentNavLabel }}</span>
        </div>
      </template>
      <div class="pallas-drawer-body-inner">
        <nav
          class="pallas-drawer-nav"
          aria-label="主导航"
        >
          <button
            v-for="item in nav"
            :key="item.name"
            type="button"
            class="drawer-nav-item"
            :class="{ selected: route.name === item.name }"
            @click="onMobileNavClick(item)"
          >
            <component :is="item.icon" class="drawer-nav-ico" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <div
          class="pallas-drawer-connect"
          title="基于 /pallas/api/health"
        >
          <div class="pallas-connect pallas-connect--drawer">
            <span
              class="pallas-dot"
              :class="{ off: ok === false, unk: ok === null }"
            />
            <span
              v-if="ok"
              class="pallas-host"
            >已连接 <span class="pallas-host-addr">@{{ hostLabel }}</span></span>
            <span v-else-if="ok === null">检查中</span>
            <span
              v-else
              class="pallas-host pallas-err"
            >未连接</span>
          </div>
        </div>
      </div>
    </t-drawer>

    <div class="pallas-body">
      <aside class="pallas-nav">
        <nav class="main-nav">
          <div
            v-for="item in nav"
            :key="item.name"
            class="menu-item"
            :class="{ selected: route.name === item.name }"
            :title="sidebarCollapsed && !isNarrowLayout ? item.label : undefined"
            @click="onNavClick(item)"
          >
            <component :is="item.icon" class="micon" />
            <span>{{ item.label }}</span>
          </div>
        </nav>
      </aside>

      <main class="pallas-main">
        <div class="pallas-viewport">
          <transition name="fade-fast">
            <div
              v-if="pageLoading"
              class="page-loading-mask"
            >
              <LoadingIcon class="spin" />
              <span>加载中...</span>
            </div>
          </transition>
          <div class="pallas-route-body">
            <router-view v-slot="{ Component }">
              <transition
                name="slide-fade"
                mode="out-in"
              >
                <component
                  :is="Component"
                  :key="String(route.name || route.path)"
                />
              </transition>
            </router-view>
          </div>
        </div>
      </main>
    </div>

    <footer
      class="pallas-console-footer"
      role="contentinfo"
    >
      © {{ footerYear }} Pallas-Bot
    </footer>
  </div>
</template>

<style scoped lang="scss">
.pallas-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  color: var(--el-text-color-primary);
}

.pallas-header {
  height: 52px;
  padding: 0 20px;
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 22;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
html.dark .pallas-header {
  background: var(--el-bg-color);
  border-bottom-color: var(--el-border-color);
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.35);
}

.pallas-header-lead {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.pallas-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.pallas-title-stack {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.pallas-route-hint {
  font-size: 11px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  line-height: 1.15;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 56vw;
}

.pallas-menu-btn {
  flex-shrink: 0;
}

.pallas-sidebar-toggle {
  flex-shrink: 0;
}

.pallas-connect--drawer {
  font-size: 12px;
  min-height: 22px;
}

.pallas-header-toolbar--narrow {
  flex-wrap: nowrap !important;
  gap: 4px !important;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.header-icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--el-border-color);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}
.header-icon-link:hover {
  color: var(--el-color-primary);
  border-color: var(--el-border-color-hover);
  background: var(--el-fill-color-light);
}

.pallas-title-mark {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--el-color-primary-light-3), var(--el-color-primary-dark-2));
  flex-shrink: 0;
}

.pallas-title-text {
  font-family: var(--pallas-font-sans);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-beta {
  height: 22px;
  line-height: 20px;
  margin: 0;
  padding: 0 9px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  border-radius: 6px;
  flex-shrink: 0;
}

.pallas-header-right {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 8px 12px;
}

.pallas-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px 10px;
  padding: 4px 10px 4px 12px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  max-width: min(100%, 72vw);
  min-width: 0;
  flex: 0 1 auto;
}

.pallas-header-actions-gap {
  width: 1px;
  height: 18px;
  align-self: center;
  flex-shrink: 0;
  background: var(--el-border-color);
  opacity: 0.65;
}

.pallas-header-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px 12px;
  flex-shrink: 0;
}

.header-icon-btn {
  width: 34px;
  height: 34px;
  box-shadow: none;
  :deep(svg) {
    color: var(--el-text-color-regular);
  }
}

.header-link {
  color: var(--el-text-color-secondary);
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s ease;

  &:hover {
    color: var(--el-color-primary);
    text-decoration: none;
  }
}
.account-switch-btn {
  gap: 8px;
  border-radius: 999px;
  padding: 0 12px;
  height: 34px;
  box-shadow: none;
  font-weight: 550;
  color: var(--el-text-color-primary) !important;
  span {
    color: inherit !important;
  }
  :deep(svg) {
    color: var(--el-text-color-secondary) !important;
  }
  &.is-empty {
    opacity: 0.85;
  }
}
.account-switch-btn.is-empty,
.account-switch-btn.is-empty span {
  color: var(--el-text-color-secondary) !important;
}
.account-switch-btn.is-empty :deep(svg) {
  color: var(--el-text-color-placeholder) !important;
}
.switch-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    circle at 30% 30%,
    #fff 0%,
    color-mix(in srgb, var(--pallas-accent) 35%, #ffe8f4) 38%,
    var(--pallas-accent) 100%
  );
}
.account-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.account-option-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  strong {
    font-size: 0.8125rem;
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  span {
    font-size: 11px;
    font-weight: 450;
    color: var(--el-text-color-secondary);
  }
}
.account-switch {
  :deep(.t-dropdown__item--active) {
    color: var(--c-main);
    font-weight: 600;
  }
}

.pallas-connect {
  display: flex;
  align-items: center;
  font-size: 0.8125rem;
  font-weight: 500;
  min-height: 28px;
  margin-left: 0;
  padding: 0 2px 0 0;
  gap: 8px;
  border-radius: 0;
  background: transparent;
  border: none;
  color: var(--el-text-color-regular);
  flex: 0 1 auto;
  min-width: 0;
}

.pallas-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #67c23a;
  flex-shrink: 0;
}
.pallas-dot.off {
  background: #ff9800;
}
.pallas-dot.unk {
  background: #c0c4cc;
}
.pallas-host-addr {
  max-width: min(180px, 28vw);
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  margin-left: 2px;
}
.pallas-err {
  color: var(--el-color-danger);
}
.pallas-console-footer {
  flex-shrink: 0;
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 6px 12px 8px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color-page);
}

.pallas-body {
  flex: 1;
  min-height: 0;
  display: flex;
  background: var(--c-body-bg);
}
.pallas-nav {
  width: var(--pallas-primnav-width, 156px);
  flex-shrink: 0;
  padding: 12px 10px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
}
.main-nav {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-lg, 14px);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
.menu-item {
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  .micon {
    margin-right: 6px;
    font-size: 15px;
    width: 1.05em;
    height: 1.05em;
    flex-shrink: 0;
  }
}
.menu-item:hover:not(.selected) {
  color: #fff;
  background: var(--c-main);
  .micon {
    color: #fff;
  }
}
html.dark .menu-item:hover:not(.selected) {
  color: #fff;
}
.menu-item.selected {
  color: var(--c-main);
  background: var(--c-main-light);
  font-weight: 600;
}

.pallas-root.is-sidebar-collapsed .pallas-nav {
  width: var(--pallas-primnav-collapsed-width, 52px);
  padding: 12px 8px;
}
.pallas-root.is-sidebar-collapsed .main-nav {
  border-radius: var(--pallas-radius-md, 14px);
}
.pallas-root.is-sidebar-collapsed .menu-item {
  justify-content: center;
  padding: 0 8px;
}
.pallas-root.is-sidebar-collapsed .menu-item span {
  display: none;
}
.pallas-root.is-sidebar-collapsed .menu-item .micon {
  margin-right: 0;
}

.pallas-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 12px 14px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.pallas-viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: var(--pallas-radius-lg, 14px);
  overflow: hidden;
}
.pallas-route-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* 路由根节点填满 route-body；默认不在此层滚动，由各页最内层承担 */
.pallas-route-body > :deep(.view-page),
.pallas-route-body > :deep(.logs-page),
.pallas-route-body > :deep(.update-view),
.pallas-route-body > :deep(.pallas-sidebar-page) {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.pallas-route-body > :deep(.update-view) {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.page-loading-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent !important;
  color: var(--c-main);
  font-weight: 600;
  backdrop-filter: none !important;
  pointer-events: none;
}
:global(html.dark) .page-loading-mask,
:global(body.dark) .page-loading-mask {
  color: #ffffff !important;
}
:global(html.dark) .page-loading-mask :deep(svg),
:global(body.dark) .page-loading-mask :deep(svg) {
  color: #ffffff !important;
}
.spin {
  animation: pallas-spin 0.9s linear infinite;
}
@keyframes pallas-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.2s ease;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}

/* 桌面窄宽：避免右侧工具条折行裁切；接近移动端时再走抽屉布局 */
@media (max-width: 1320px) and (min-width: 901px) {
  .pallas-header {
    padding: 0 12px;
  }
  .pallas-header-actions {
    max-width: min(100%, 68vw);
    gap: 6px 8px;
    padding: 4px 8px 4px 10px;
  }
  .pallas-header-toolbar {
    gap: 4px 8px;
  }
  .pallas-connect {
    font-size: 0.76rem;
  }
  .header-link {
    font-size: 0.76rem;
    letter-spacing: 0;
  }
  .account-switch-btn {
    padding: 0 8px;
    max-width: min(200px, 36vw);
    overflow: hidden;
  }
  .account-switch-btn span:not(.switch-dot) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 8rem;
  }
  .pallas-host-addr {
    max-width: min(120px, 18vw);
  }
}

@media (max-width: 900px) {
  .pallas-root {
    height: 100%;
    min-height: 0;
  }
  .pallas-header {
    height: 48px;
    padding: 0 10px;
    align-items: center;
    gap: 8px;
    flex-direction: row;
    flex-wrap: nowrap;
  }
  .pallas-title {
    font-size: 14px;
    align-items: flex-start;
  }
  .pallas-title-mark {
    margin-top: 3px;
  }
  .pallas-header-right {
    width: auto;
    flex: 0 0 auto;
    gap: 4px;
    flex-wrap: nowrap;
    justify-content: flex-end;
    padding-right: 0;
  }
  .pallas-body {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .pallas-nav {
    display: none;
  }
  .pallas-main {
    padding: 8px;
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .pallas-viewport {
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }
  /* 窄屏：路由根可纵向滚动（插件页等大卡片由内层滚动，见 :not） */
  .pallas-route-body > :deep(.view-page:not(.plugins-page):not(.common-config-page)),
  .pallas-route-body > :deep(.logs-page) {
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }
  .pallas-drawer-connect .pallas-host-addr {
    max-width: min(220px, 72vw);
  }
  .account-switch--toolbar-narrow.account-switch {
    flex: 1 1 auto;
    min-width: 0;
    max-width: min(200px, 38vw);
  }
  .account-switch-btn--toolbar-narrow {
    max-width: 100%;
    min-width: 0;
    padding: 0 8px;
    gap: 6px;
  }
  .account-switch-btn--toolbar-narrow .account-switch-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .pallas-header {
    padding: 0 8px;
    height: 46px;
  }
  .pallas-title-text {
    font-size: 13px;
  }
  .header-icon-btn {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
  }
  .header-icon-link {
    width: 30px;
    height: 30px;
  }
  .pallas-route-hint {
    max-width: 42vw;
    font-size: 10px;
  }
}
</style>

<style lang="scss">
/* Drawer 挂载到 body，需非 scoped */
.pallas-nav-drawer-wrap .t-drawer__header {
  margin-bottom: 0;
  padding: 16px 16px 10px;
}
.pallas-nav-drawer-wrap .t-drawer__body {
  padding: 8px 12px 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.pallas-drawer-body-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}
.pallas-drawer-body-inner .pallas-drawer-nav {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.pallas-drawer-connect {
  flex-shrink: 0;
  margin-top: auto;
}
.pallas-drawer-hd {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}
.pallas-drawer-title {
  font-size: 1rem;
  font-weight: 650;
  color: var(--el-text-color-primary);
}
.pallas-drawer-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.pallas-drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.drawer-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin: 0;
  padding: 11px 12px;
  border: none;
  border-radius: var(--td-radius-default);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  color: var(--td-text-color-primary);
  background: transparent;
  transition: background 0.15s ease;
}
.drawer-nav-item:hover {
  background: var(--td-bg-color-secondarycontainer);
}
.drawer-nav-item.selected {
  color: var(--td-brand-color-7);
  background: color-mix(in srgb, var(--td-brand-color-7) 12%, transparent);
  font-weight: 600;
}
.drawer-nav-ico {
  font-size: 18px;
  flex-shrink: 0;
  width: 1.15em;
  height: 1.15em;
}
html.dark .drawer-nav-item.selected {
  background: color-mix(in srgb, var(--td-brand-color-7) 22%, transparent);
}
</style>
