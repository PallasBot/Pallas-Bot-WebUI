<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { fetchInstances } from "@/api/consoleApi";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { getBotServiceBaseRef, ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import { protocolDashboardUrl, protocolServiceHttpBase } from "@/utils/pallasProtocolPaths";
import { DownloadIcon, HelpCircleIcon, LinkIcon, ViewListIcon } from "tdesign-icons-vue-next";
import { documentTitleExtra } from "@/utils/documentTitle";
import { computed, inject, onMounted, onUnmounted, ref, watch } from "vue";

type ProtocolSection = "url" | "assets" | "flow" | "faq";

const section = ref<ProtocolSection>("url");
const sectionTitle: Record<ProtocolSection, string> = {
  url: "协议运行仪表盘",
  assets: "协议资产",
  flow: "上线与巡检流程",
  faq: "故障排查 FAQ",
};
const sectionSub: Record<ProtocolSection, string> = {
  url: "管理地址与在线概览。",
  assets: "在插件页下载发行包、Docker 镜像与全局 runtime。",
  flow: "建议上线顺序。",
  faq: "404、token、端口等常见问题。",
};
const navItems = [
  { index: "url", label: "管理 URL", icon: LinkIcon },
  { index: "assets", label: "协议资产", icon: DownloadIcon },
  { index: "flow", label: "推荐顺序", icon: ViewListIcon },
  { index: "faq", label: "常见问题", icon: HelpCircleIcon },
];

const webuiPath = ref<string | null>(null);
const webuiEnabled = ref(false);
const accountCount = ref(0);
const connectedCount = ref(0);

const conn = inject(pallasConnectionKey, null);
const botBase = getBotServiceBaseRef();

const protocolOpenUrl = computed(() =>
  protocolDashboardUrl(
    protocolServiceHttpBase(botBase.value, conn?.last.value?.console?.http_base),
    webuiPath.value,
  ),
);

const protocolAssetsUrl = computed(() => {
  const base = protocolOpenUrl.value.replace(/\/$/, "");
  return `${base}/assets`;
});

const activeFaq = ref<string[]>([]);

watch(
  section,
  (s) => {
    documentTitleExtra.value = sectionTitle[s];
  },
  { immediate: true },
);

onUnmounted(() => {
  documentTitleExtra.value = "";
});

function openProtocol() {
  window.open(protocolOpenUrl.value, "_blank", "noopener");
}

function openProtocolAssets() {
  window.open(protocolAssetsUrl.value, "_blank", "noopener");
}

onMounted(async () => {
  void ensureBotServiceBaseUrl();
  try {
    const data = await fetchInstances();
    const snap = data.pallas_protocol ?? data.napcat ?? null;
    webuiPath.value = snap?.webui_path ?? null;
    webuiEnabled.value = Boolean(snap?.webui_enabled);
    const accounts = snap?.accounts ?? [];
    accountCount.value = accounts.length;
    connectedCount.value = accounts.filter((x) => Boolean(x.connected)).length;
  } catch {
    webuiPath.value = null;
    webuiEnabled.value = false;
    accountCount.value = 0;
    connectedCount.value = 0;
  }
});
</script>

<template>
  <PallasSidebarShell
    v-model="section"
    aside-title="协议管理"
    menu-aria-label="协议端分节"
    :nav-items="navItems"
  >
    <template #header="{ section: s }">
      <h1 class="main-title">{{ sectionTitle[s as ProtocolSection] }}</h1>
      <p class="main-sub">{{ sectionSub[s as ProtocolSection] }}</p>
    </template>

    <div
      v-show="section === 'url'"
      class="panel nc-card nc-url-panel"
    >
      <div class="proto-overview">
        <div class="ov-card">
          <span class="k">协议管理状态</span>
          <strong>{{ webuiEnabled ? "已启用" : "未启用" }}</strong>
        </div>
        <div class="ov-card">
          <span class="k">协议账号总数</span>
          <strong>{{ accountCount }}</strong>
        </div>
        <div class="ov-card">
          <span class="k">当前在线账号</span>
          <strong>{{ connectedCount }}</strong>
        </div>
      </div>
      <t-tag
        theme="primary"
        variant="outline"
        size="small"
        class="tag-row"
      >
        pallas_protocol
      </t-tag>
      <p class="lead lead-spaced pallas-doc-prose">
        与 Bot 同 <code>host:port</code>，默认 <code>/protocol/console</code>；单号 <code>…/account/&lt;ID&gt;</code>。NapCat
        等自带 WebUI 为另一端口，见「好友与群」<code>native_webui_url</code>。
      </p>
      <t-space
        direction="vertical"
        :size="16"
        align="start"
        class="url-stack"
      >
        <t-button
          theme="primary"
          size="large"
          @click="openProtocol"
        >
          <template #icon>
            <LinkIcon />
          </template>
          打开协议管理
        </t-button>
        <t-descriptions
          :column="1"
          bordered
          size="small"
          class="nc-desc-table"
        >
          <t-descriptions-item label="管理总览">
            <t-link
              theme="primary"
              :href="protocolOpenUrl"
              target="_blank"
              hover="color"
            >
              {{ protocolOpenUrl }}
            </t-link>
            <div class="sub">
              反代需透传该路径。
            </div>
          </t-descriptions-item>
          <t-descriptions-item label="进程">
            与 <code>/pallas</code> 同一 HTTP 服务，无单独端口。
          </t-descriptions-item>
          <t-descriptions-item label="鉴权">
            <code>pallas_protocol_token</code>：Query <code>token=</code> 或头
            <code>X-Pallas-Protocol-Token</code>。
          </t-descriptions-item>
        </t-descriptions>
      </t-space>
    </div>

    <div
      v-show="section === 'assets'"
      class="panel nc-card assets-panel"
    >
      <t-alert
        theme="info"
        title="在协议插件页登录后即可下载。"
        :close-btn="false"
        class="assets-alert"
      />
      <p class="lead lead-spaced pallas-doc-prose">
        包在 <code>runtime_dist/*</code>，解压在 <code>runtime_extract/*</code>；清缓存在资产页顶部。个别实例可改账号
        <code>program_dir</code>。
      </p>
      <div class="assets-url-wrap">
        <span class="assets-label">完整 URL</span>
        <code class="assets-url">{{ protocolAssetsUrl }}</code>
      </div>
      <t-button
        theme="primary"
        size="large"
        @click="openProtocolAssets"
      >
        <template #icon>
          <DownloadIcon />
        </template>
        打开协议资产页
      </t-button>
    </div>

    <div
      v-show="section === 'flow'"
      class="panel nc-card"
    >
      <t-timeline layout="vertical">
        <t-timeline-item label="1">
          协议端登录并确认账号在线
        </t-timeline-item>
        <t-timeline-item label="2">
          核对 <code>onebot*.json</code> 反向 WS 指向 Bot OneBot
        </t-timeline-item>
        <t-timeline-item label="3">
          Bot 侧验证连接后看 <code>/pallas/api/health</code>
        </t-timeline-item>
      </t-timeline>
    </div>

    <div
      v-show="section === 'faq'"
      class="panel nc-card"
    >
      <t-collapse
        v-model="activeFaq"
        expand-mutex
        class="faq-collapse"
      >
        <t-collapse-panel
          value="1"
          header="打开管理路径为 404"
        >
          确认插件已启用；路径以 <code>/pallas/api/instances</code> 的 <code>webui_path</code> 为准。
        </t-collapse-panel>
        <t-collapse-panel
          value="2"
          header="新标签里要求 token"
        >
          使用 <code>pallas_protocol_token</code>（Query <code>token</code> 或头
          <code>X-Pallas-Protocol-Token</code>）。
        </t-collapse-panel>
        <t-collapse-panel
          value="3"
          header="Vite 开发端口与 Bot 不同"
        >
          协议页用 Bot 监听地址打开（如 <code>http://127.0.0.1:8088/protocol/console</code>）；控制台可走 Vite 代理
          <code>/pallas/api</code>。
        </t-collapse-panel>
      </t-collapse>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.panel {
  width: 100%;
  max-width: none;
  font-family: var(--pallas-font-sans);
}
.nc-url-panel {
  padding-bottom: 4px;
}
.url-stack {
  width: 100%;
}
.nc-url-panel :deep(.t-descriptions.nc-desc-table) {
  border-radius: var(--pallas-radius-md);
  overflow: hidden;
}
.tag-row {
  margin-bottom: 14px;
}
.nc-card {
  .lead {
    line-height: 1.75;
    margin: 0;
  }
  .lead-spaced {
    margin-bottom: 12px;
  }
  .lead-spaced:last-of-type {
    margin-bottom: 0;
  }
  .sub {
    margin-top: 6px;
    font-size: var(--pallas-text-xs);
    font-weight: var(--pallas-weight-body);
    color: var(--el-text-color-secondary);
    line-height: 1.55;
    word-break: break-word;
    font-family: var(--pallas-font-sans);
  }
}
.nc-card :deep(.t-descriptions__label),
.nc-card :deep(.t-descriptions__content) {
  font-size: var(--pallas-text-base);
  line-height: 1.65;
  font-family: var(--pallas-font-sans);
}
.nc-card :deep(.t-descriptions__content code) {
  font-family: var(--pallas-font-sans);
  font-size: 0.9em;
  font-weight: 500;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.nc-card :deep(.t-timeline-item__content),
.nc-card :deep(.t-collapse-panel__content) {
  font-size: var(--pallas-text-base);
  font-weight: var(--pallas-weight-body);
  line-height: 1.72;
  color: var(--el-text-color-regular);
  font-family: var(--pallas-font-sans);
}
.nc-card :deep(.t-timeline-item__content code),
.nc-card :deep(.t-collapse-panel__content code) {
  font-family: var(--pallas-font-sans);
  font-size: 0.9em;
  font-weight: 500;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.assets-alert {
  margin-bottom: 14px;
}
.assets-panel .assets-url-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}
.assets-label {
  font-size: var(--pallas-text-xs);
  font-weight: var(--pallas-weight-semibold);
  color: var(--el-text-color-secondary);
}
.assets-url {
  display: block;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--pallas-radius-sm);
  word-break: break-word;
  font-size: var(--pallas-text-base);
  font-family: var(--pallas-font-sans);
  font-weight: var(--pallas-weight-medium);
  line-height: 1.5;
  color: var(--el-text-color-primary);
}
.proto-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
@media (min-width: 901px) and (max-width: 1180px) {
  .proto-overview {
    grid-template-columns: 1fr;
    max-width: 460px;
  }
}
.ov-card {
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 18%, var(--el-border-color-lighter));
  border-radius: var(--pallas-radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: color-mix(in srgb, var(--el-bg-color) 94%, var(--pallas-accent));
  .k {
    font-size: var(--pallas-text-xs);
    font-weight: var(--pallas-weight-semibold);
    color: var(--el-text-color-secondary);
    line-height: 1.35;
  }
  strong {
    font-size: var(--pallas-text-stat);
    font-weight: var(--pallas-weight-bold);
    color: var(--c-main);
    line-height: 1.2;
    word-break: break-word;
  }
}
html.dark .nc-card {
  border-color: rgba(100, 160, 255, 0.2);
}

@media (max-width: 900px) {
  .panel {
    max-width: none;
  }
  .nc-card {
    .lead {
      font-size: var(--pallas-text-sm);
      line-height: 1.62;
      word-break: break-word;
    }
    :deep(code) {
      white-space: pre-wrap;
      word-break: break-all;
    }
    :deep(.t-button) {
      width: 100%;
      margin-right: 0;
    }
    :deep(.t-descriptions__label),
    :deep(.t-descriptions__content) {
      word-break: break-word;
    }
  }
  .proto-overview {
    grid-template-columns: 1fr;
  }
}
</style>
