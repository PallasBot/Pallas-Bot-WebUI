<script setup lang="ts">
import { useConnectionStatus } from "@/composables/useConnectionStatus";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import {
  Connection,
  DataBoard,
  Grid,
  InfoFilled,
  Link,
  Loading,
  Moon,
  Monitor,
  Platform,
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

onMounted(() => {
  void ensureBotServiceBaseUrl();
});

const pageTitle = computed(
  () => (route.meta.title as string) || (route.name as string) || "",
);

const botBase = getBotServiceBaseRef();
const protocolUrl = computed(() => protocolDashboardUrl(botBase.value || "http://localhost:8088", null));

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
      // 连点切页时把被合并掉的刷新补跑一轮，避免数据页错过 tick。
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
        <el-card
          v-if="last"
          class="side-meta"
          shadow="never"
        >
          <div class="side-meta-t">版本摘要</div>
          <div class="side-meta-row">
            <span>NB</span>
            <em>{{ last.nonebot2 }}</em>
          </div>
          <div class="side-meta-row">
            <span>Bot</span>
            <em>{{ last.pallas_bot }}</em>
          </div>
        </el-card>
      </aside>

      <main class="pallas-main">
        <div class="pallas-main-top">
          <div class="page-line">
            <h2 class="page-title">
              <el-icon class="page-ico">
                <component
                  :is="nav.find((n) => n.name === route.name)?.icon || Monitor"
                />
              </el-icon>
              {{ pageTitle }}
            </h2>
            <div
              v-if="route.name === 'dashboard'"
              class="page-actions"
            >
              <el-button
                type="primary"
                size="small"
                :loading="ok === null || refreshing"
                @click="doRefresh"
              >
                {{ refreshing ? "刷新中..." : "刷新连接" }}
              </el-button>
            </div>
            <div
              v-else
              class="page-actions"
            />
          </div>
        </div>
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
}

.header-icon-btn {
  --el-button-bg-color: #ffffff22;
  --el-button-border-color: transparent;
  --el-button-hover-bg-color: #fff3;
  --el-button-hover-border-color: transparent;
  --el-color: #fff;
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

.pallas-connect {
  display: flex;
  align-items: center;
  font-size: 14px;
  min-height: 28px;
  padding-left: 4px;
  border-left: 1px solid #ffffff40;
  margin-left: 8px;
  padding-left: 16px;
  gap: 6px;
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
  width: 260px;
  flex-shrink: 0;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}
.main-nav {
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
.side-meta {
  --el-card-padding: 10px 12px;
  border-radius: var(--pallas-radius-md, 12px) !important;
  font-size: 12px;
  .side-meta-t {
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
  }
  .side-meta-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    line-height: 1.5;
    em {
      font-style: normal;
      text-align: right;
      color: var(--el-text-color-regular);
    }
  }
}
.pallas-main {
  flex: 1;
  min-width: 0;
  padding: 20px 20px 20px 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pallas-main-top {
  flex-shrink: 0;
  background: var(--c-nav-bg);
  border-radius: var(--pallas-radius-md, 12px);
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.08);
  padding: 10px 16px 12px;
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: 0;
}
.page-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}
.page-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  .page-ico {
    color: var(--c-main);
  }
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
  background: rgba(242, 246, 252, 0.68);
  color: var(--c-main);
  font-weight: 600;
  backdrop-filter: blur(2px);
  pointer-events: none;
}
:deep(html.dark) .page-loading-mask {
  background: rgba(20, 26, 36, 0.62);
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
</style>


