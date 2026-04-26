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
import { isDark, toggleTheme } from "@/utils/theme";
import { getBotServiceBaseRef } from "@/utils/botServiceBase";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";

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

const botBase = getBotServiceBaseRef();
const protocolUrl = computed(() => protocolDashboardUrl(botBase.value || "http://localhost:8088", null));
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
  { name: "ai-extension" as const, to: { name: "ai-extension" }, label: "AI拓展", icon: Connection },
  { name: "napcat-web" as const, to: { name: "napcat" }, label: "协议管理", icon: Link, external: true },
  { name: "plugins" as const, to: { name: "plugins" }, label: "插件列表", icon: Grid },
  { name: "database" as const, to: { name: "database" }, label: "数据库管理", icon: DataBoard },
  { name: "settings" as const, to: { name: "settings" }, label: "偏好与连接", icon: Setting },
  { name: "about" as const, to: { name: "about" }, label: "关于", icon: InfoFilled },
  { name: "update" as const, to: { name: "update" }, label: "更新", icon: Refresh },
];

function onNavClick(item: (typeof nav)[number]) {
  if (item.external) {
    if (typeof window !== "undefined") {
      window.open(protocolUrl.value, "_blank", "noopener");
    }
    return;
  }
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
      // 补跑一次刷新
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
</script>

<template>
  <div class="pallas-root">
    <header class="pallas-header">
      <div class="pallas-title">
        Pallas-Bot Console
        <el-tag
          class="tag-beta"
          type="info"
          effect="light"
          size="small"
        >
          Beta
        </el-tag>
      </div>
      <div class="pallas-header-right">
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
          class="account-switch account-switch-floating"
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
  height: 50px;
  padding: 0 20px;
  color: var(--c-header-fg);
  background: var(--c-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 22;
}

.pallas-title {
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tag-beta {
  height: 22px;
  line-height: 20px;
  margin: 0;
  --el-tag-bg-color: rgba(255, 255, 255, 0.22);
  --el-tag-text-color: #fff;
  --el-tag-border-color: rgba(255, 255, 255, 0.35);
}

.pallas-header-right {
  display: flex;
  align-items: center;
  gap: 4px 16px;
  padding-right: 254px;
}

.header-icon-btn {
  --el-button-bg-color: #ffffff30;
  --el-button-border-color: #ffffff4a;
  --el-button-hover-bg-color: #ffffff3a;
  --el-button-hover-border-color: #ffffff66;
  --el-color: #fff;
  width: 34px;
  height: 34px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
  :deep(.el-icon) {
    color: #fff;
  }
}

.header-link {
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 0;

  &:hover {
    text-decoration: underline;
  }
}
.account-switch-btn {
  --el-button-bg-color: #ffffff30;
  --el-button-border-color: #ffffff55;
  --el-button-hover-bg-color: #ffffff3a;
  --el-button-hover-border-color: #ffffff6e;
  --el-color: #fff;
  gap: 8px;
  border-radius: 999px;
  padding: 0 12px;
  height: 34px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
  color: #fff !important;
  span {
    color: #fff !important;
  }
  :deep(.el-icon) {
    color: #fff !important;
  }
  &.is-empty {
    opacity: 0.88;
    --el-color: #fff;
  }
}
.account-switch-btn.is-empty,
.account-switch-btn.is-empty span,
.account-switch-btn.is-empty :deep(.el-icon) {
  color: #fff !important;
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
  line-height: 1.15;
  strong {
    font-size: 12px;
    font-weight: 600;
  }
  span {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }
}
.account-switch {
  :deep(.el-dropdown-menu__item.is-selected) {
    color: var(--c-main);
    font-weight: 600;
  }
}
.account-switch-floating {
  position: fixed;
  top: 8px;
  right: 14px;
  z-index: 60;
}

.pallas-connect {
  display: flex;
  align-items: center;
  font-size: 14px;
  min-height: 32px;
  padding-left: 4px;
  margin-left: 8px;
  padding: 0 10px 0 16px;
  gap: 6px;
  border-radius: 999px;
  background: #ffffff26;
  border: 1px solid #ffffff4a;
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
  color: #b8d9ff;
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
    min-height: 100vh;
  }
  .pallas-header {
    height: auto;
    padding: 10px 12px;
    align-items: flex-start;
    gap: 8px;
    flex-direction: column;
  }
  .pallas-title {
    font-size: 17px;
  }
  .pallas-header-right {
    width: 100%;
    gap: 8px 10px;
    flex-wrap: wrap;
    padding-right: 0;
  }
  .account-switch-btn {
    max-width: min(62vw, 220px);
  }
  .account-switch-floating {
    top: 8px;
    right: 10px;
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
    flex-direction: column;
  }
  .pallas-nav {
    width: 100%;
    padding: 10px 10px 0;
    overflow: visible;
  }
  .main-nav {
    box-shadow: none;
    background: transparent;
    border-radius: 0;
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 6px;
  }
  .menu-item {
    min-width: max-content;
    height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    background: var(--c-nav-bg);
    border: 1px solid rgba(22, 100, 196, 0.16);
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  }
  .pallas-main {
    padding: 10px;
  }
}
</style>
