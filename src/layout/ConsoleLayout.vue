<script setup lang="ts">
import { fetchInstances } from "@/api/consoleApi";
import { pallasBotContextKey } from "@/types/pallas-bot-context";
import { useConnectionStatus } from "@/composables/useConnectionStatus";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import {
  CaretBottom,
  Connection,
  DataBoard,
  Grid,
  InfoFilled,
  Link,
  Loading,
  Moon,
  Monitor,
  Platform,
  Refresh,
  Setting,
  Sunny,
} from "@element-plus/icons-vue";
import { computed, nextTick, onMounted, provide, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
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

onMounted(() => {
  void ensureBotServiceBaseUrl();
  setTabFavicon(`${import.meta.env.BASE_URL}pallas-priest.png`, "image/png");
  if (typeof localStorage !== "undefined") {
    const saved = (localStorage.getItem(BOT_PICK_KEY) || "").trim();
    if (saved) selectedBotSelfId.value = saved;
  }
  void loadBotOptions();
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
  { name: "dashboard" as const, to: { name: "dashboard" }, label: "仪表盘", icon: Monitor },
  { name: "accounts" as const, to: { name: "accounts" }, label: "实例", icon: Platform },
  { name: "instances" as const, to: { name: "instances" }, label: "好友与群", icon: Connection },
  { name: "ai-extension" as const, to: { name: "ai-extension" }, label: "AI 扩展", icon: Connection },
  { name: "protocol" as const, to: { name: "protocol" }, label: "协议管理", icon: Link },
  { name: "plugins" as const, to: { name: "plugins" }, label: "插件列表", icon: Grid },
  { name: "database" as const, to: { name: "database" }, label: "数据库管理", icon: DataBoard },
  { name: "settings" as const, to: { name: "settings" }, label: "偏好与连接", icon: Setting },
  { name: "about" as const, to: { name: "about" }, label: "关于", icon: InfoFilled },
  { name: "update" as const, to: { name: "update" }, label: "更新", icon: Refresh },
];

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

const qqAvatarImgProps = { referrerPolicy: "no-referrer" as const };
</script>

<template>
  <div class="pallas-root">
    <header class="pallas-header">
      <div class="pallas-title">
        <span class="pallas-title-mark" aria-hidden="true" />
        <span class="pallas-title-text">Pallas 控制台</span>
        <el-tag
          class="tag-beta"
          effect="plain"
          size="small"
        >
          Beta
        </el-tag>
      </div>
      <div class="pallas-header-right">
        <div class="pallas-header-actions">
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
          <el-button
            :icon="isDark ? Sunny : Moon"
            circle
            class="header-icon-btn"
            @click="toggleTheme"
          />
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
          <el-dropdown
            class="account-switch"
            trigger="click"
            :disabled="!botOptions.length"
            @command="(v: string) => setSelectedBotSelfId(v)"
          >
            <el-button
              size="small"
              class="account-switch-btn"
              :class="{ 'is-empty': !botOptions.length }"
            >
              <span class="switch-dot" />
              <span>{{ botOptions.length ? "切换账号" : "暂无账号" }}</span>
              <el-avatar
                v-if="selectedBotAvatar && botOptions.length"
                :size="26"
                :src="selectedBotAvatar"
                :img-props="qqAvatarImgProps"
              />
              <el-avatar
                v-else
                :size="26"
              >B</el-avatar>
              <el-icon><CaretBottom /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="b in botOptions"
                  :key="b.selfId"
                  :command="b.selfId"
                  :class="{ 'is-selected': b.selfId === selectedBotSelfId }"
                >
                  <div class="account-option">
                    <el-avatar
                      v-if="b.avatar"
                      :size="20"
                      :src="b.avatar"
                      :img-props="qqAvatarImgProps"
                    />
                    <el-avatar
                      v-else
                      :size="20"
                    >B</el-avatar>
                    <div class="account-option-text">
                      <strong>{{ b.nickname }}</strong>
                      <span class="mono">QQ {{ b.qq }}</span>
                    </div>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        </div>
      </div>
    </header>

    <div class="pallas-body">
      <aside class="pallas-nav">
        <nav class="main-nav">
          <div
            v-for="item in nav"
            :key="item.name"
            class="menu-item"
            :class="{ selected: route.name === item.name }"
            @click="onNavClick(item)"
          >
            <el-icon class="micon">
              <component :is="item.icon" />
            </el-icon>
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
              <el-icon class="spin"><Loading /></el-icon>
              <span>加载中...</span>
            </div>
          </transition>
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
      </main>
    </div>
  </div>
</template>

<style scoped lang="scss">
.pallas-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
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

.pallas-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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
  --el-tag-bg-color: transparent;
  --el-tag-text-color: var(--el-text-color-secondary);
  --el-tag-border-color: var(--el-border-color);
}

.pallas-header-right {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px 16px;
}

.pallas-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 4px 12px 4px 14px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  max-width: 100%;
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
  flex-wrap: wrap;
  gap: 4px 16px;
}

.header-icon-btn {
  --el-button-bg-color: var(--el-fill-color-blank);
  --el-button-border-color: var(--el-border-color);
  --el-button-hover-bg-color: var(--el-fill-color-light);
  --el-button-hover-border-color: var(--el-border-color-hover);
  --el-color: var(--el-text-color-regular);
  width: 34px;
  height: 34px;
  box-shadow: none;
  :deep(.el-icon) {
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
  --el-button-bg-color: var(--el-bg-color);
  --el-button-border-color: var(--el-border-color);
  --el-button-hover-bg-color: var(--el-fill-color-light);
  --el-button-hover-border-color: var(--el-border-color-hover);
  --el-color: var(--el-text-color-primary);
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
  :deep(.el-icon) {
    color: var(--el-text-color-secondary) !important;
  }
  &.is-empty {
    opacity: 0.85;
    --el-color: var(--el-text-color-secondary);
  }
}
.account-switch-btn.is-empty,
.account-switch-btn.is-empty span {
  color: var(--el-text-color-secondary) !important;
}
.account-switch-btn.is-empty :deep(.el-icon) {
  color: var(--el-text-color-placeholder) !important;
}
.switch-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #fff 0%, #ffd4ef 34%, #a56bff 100%);
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
  :deep(.el-dropdown-menu__item.is-selected) {
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
  max-width: 200px;
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
.pallas-body {
  flex: 1;
  min-height: 0;
  display: flex;
  background: var(--c-body-bg);
}
.pallas-nav {
  width: 206px;
  flex-shrink: 0;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}
.main-nav {
  flex: 1;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-lg, 14px);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
.menu-item {
  height: 40px;
  padding: 0 20px;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  .micon {
    margin-right: 8px;
    font-size: 16px;
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
.pallas-main {
  flex: 1;
  min-width: 0;
  padding: 20px 20px 20px 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pallas-viewport {
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: 4px;
  > :deep(*) {
    height: 100%;
    min-height: 0;
  }
  overflow: auto;
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
:global(html.dark) .page-loading-mask :deep(.el-icon),
:global(body.dark) .page-loading-mask :deep(.el-icon) {
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

@media (max-width: 900px) {
  .pallas-root {
    height: auto;
    min-height: 100dvh;
  }
  .pallas-header {
    height: auto;
    padding: 6px 10px;
    align-items: flex-start;
    gap: 4px;
    flex-direction: column;
  }
  .pallas-title {
    font-size: 15px;
  }
  .pallas-header-right {
    width: 100%;
    gap: 4px 8px;
    flex-wrap: wrap;
    padding-right: 0;
  }
  .pallas-header-actions {
    width: 100%;
    justify-content: flex-end;
    box-sizing: border-box;
  }
  .account-switch-btn {
    max-width: min(62vw, 220px);
  }
  .pallas-connect {
    margin-left: 0;
    border-left: none;
    padding-left: 0;
    min-height: 22px;
    font-size: 13px;
  }
  .pallas-host-addr {
    max-width: 52vw;
  }
  .pallas-body {
    display: block;
  }
  .pallas-nav {
    width: 100%;
    padding: 6px 8px 0;
    overflow: visible;
  }
  .main-nav {
    box-shadow: none;
    background: transparent;
    border-radius: 0;
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .menu-item {
    min-width: max-content;
    height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--c-nav-bg);
    border: 1px solid rgba(22, 100, 196, 0.16);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
    font-size: 13px;
  }
  .pallas-main {
    padding: 8px;
    overflow: visible;
  }
  .pallas-viewport {
    flex: none;
    min-height: auto;
    overflow: visible;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: auto;
    > :deep(*) {
      height: auto;
      min-height: 0;
    }
  }
}
@media (max-width: 640px) {
  .pallas-header {
    padding: 4px 8px;
    gap: 4px;
  }
  .pallas-title {
    width: 100%;
    font-size: 14px;
    justify-content: space-between;
  }
  .pallas-header-right {
    align-items: center;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px 8px;
    max-width: 100%;
  }
  .header-icon-btn {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
  }
  .header-link {
    padding: 1px 0;
    font-size: 12px;
    line-height: 1;
  }
  .pallas-header-actions {
    flex-direction: column;
    align-items: stretch;
    padding: 8px 10px;
    border-radius: 12px;
    gap: 8px;
  }
  .pallas-header-actions-gap {
    display: none;
  }
  .pallas-header-toolbar {
    order: 1;
    width: 100%;
    justify-content: flex-end;
  }
  .account-switch-btn {
    width: auto;
    min-width: 150px;
    height: 30px;
    justify-content: flex-start;
    max-width: 100%;
    font-size: 12px;
    padding: 0 10px;
  }
  .pallas-connect {
    order: 2;
    width: auto;
    justify-content: flex-start;
    font-size: 11px;
    min-height: 26px;
    padding: 0;
    max-width: 100%;
    margin-left: 0;
  }
  .pallas-host-addr {
    max-width: 38vw;
  }
  .pallas-header-right {
    align-items: center;
  }
}
</style>
