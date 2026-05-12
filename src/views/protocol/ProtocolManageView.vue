<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { fetchInstances } from "@/api/consoleApi";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { getBotServiceBaseRef, ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import { protocolDashboardUrl, protocolServiceHttpBase } from "@/utils/pallasProtocolPaths";
import { Download, Link, List, Position, QuestionFilled } from "@element-plus/icons-vue";
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
  { index: "url", label: "管理 URL", icon: Link },
  { index: "assets", label: "协议资产", icon: Download },
  { index: "flow", label: "推荐顺序", icon: List },
  { index: "faq", label: "常见问题", icon: QuestionFilled },
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
      <el-tag
        type="info"
        effect="plain"
        size="small"
        class="tag-row"
      >
        pallas_protocol
      </el-tag>
      <p class="lead lead-spaced pallas-doc-prose">
        与 Bot 同 <code>host:port</code>，默认 <code>/protocol/console</code>；单号 <code>…/account/&lt;ID&gt;</code>。NapCat
        等自带 WebUI 为另一端口，见「好友与群」<code>native_webui_url</code>。
      </p>
      <el-space
        direction="vertical"
        :size="16"
        style="width: 100%; align-items: flex-start"
      >
        <el-button
          type="primary"
          size="large"
          :icon="Link"
          @click="openProtocol"
        >
          打开协议管理
        </el-button>
        <el-descriptions
          :column="1"
          border
          size="small"
          class="nc-desc-table"
        >
          <el-descriptions-item label="管理总览">
            <el-link
              :href="protocolOpenUrl"
              type="primary"
              :icon="Position"
            >
              {{ protocolOpenUrl }}
            </el-link>
            <div class="sub">反代需透传该路径。</div>
          </el-descriptions-item>
          <el-descriptions-item label="进程">
            与 <code>/pallas</code> 同一 HTTP 服务，无单独端口。
          </el-descriptions-item>
          <el-descriptions-item label="鉴权">
            <code>pallas_protocol_token</code>：Query <code>token=</code> 或头
            <code>X-Pallas-Protocol-Token</code>。
          </el-descriptions-item>
        </el-descriptions>
      </el-space>
    </div>

    <div
      v-show="section === 'assets'"
      class="panel nc-card assets-panel"
    >
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="assets-alert"
        title="在协议插件页登录后即可下载。"
      />
      <p class="lead lead-spaced pallas-doc-prose">
        包在 <code>runtime_dist/*</code>，解压在 <code>runtime_extract/*</code>；清缓存在资产页顶部。个别实例可改账号
        <code>program_dir</code>。
      </p>
      <div class="assets-url-wrap">
        <span class="assets-label">完整 URL</span>
        <code class="assets-url">{{ protocolAssetsUrl }}</code>
      </div>
      <el-button
        type="primary"
        size="large"
        :icon="Download"
        @click="openProtocolAssets"
      >
        打开协议资产页
      </el-button>
    </div>

    <div
      v-show="section === 'flow'"
      class="panel nc-card"
    >
      <el-timeline>
        <el-timeline-item
          type="primary"
          hollow
        >
          协议端登录并确认账号在线
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          核对 <code>onebot*.json</code> 反向 WS 指向 Bot OneBot
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          Bot 侧验证连接后看 <code>/pallas/api/health</code>
        </el-timeline-item>
      </el-timeline>
    </div>

    <div
      v-show="section === 'faq'"
      class="panel nc-card"
    >
      <el-collapse
        v-model="activeFaq"
        accordion
      >
        <el-collapse-item
          name="1"
          title="打开管理路径为 404"
        >
          确认插件已启用；路径以 <code>/pallas/api/instances</code> 的 <code>webui_path</code> 为准。
        </el-collapse-item>
        <el-collapse-item
          name="2"
          title="新标签里要求 token"
        >
          使用 <code>pallas_protocol_token</code>（Query <code>token</code> 或头
          <code>X-Pallas-Protocol-Token</code>）。
        </el-collapse-item>
        <el-collapse-item
          name="3"
          title="Vite 开发端口与 Bot 不同"
        >
          协议页用 Bot 监听地址打开（如 <code>http://127.0.0.1:8088/protocol/console</code>）；控制台可走 Vite 代理
          <code>/pallas/api</code>。
        </el-collapse-item>
      </el-collapse>
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
.nc-url-panel :deep(.el-descriptions.nc-desc-table) {
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
.nc-card :deep(.el-descriptions__cell) {
  font-size: var(--pallas-text-base);
  line-height: 1.65;
}
.nc-card :deep(.el-descriptions__content) {
  font-family: var(--pallas-font-sans);
}
.nc-card :deep(.el-descriptions__content code) {
  font-family: var(--pallas-font-sans);
  font-size: 0.9em;
  font-weight: 500;
  padding: 0.1em 0.35em;
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.nc-card :deep(.el-timeline-item__content),
.nc-card :deep(.el-collapse-item__content) {
  font-size: var(--pallas-text-base);
  font-weight: var(--pallas-weight-body);
  line-height: 1.72;
  color: var(--el-text-color-regular);
  font-family: var(--pallas-font-sans);
}
.nc-card :deep(.el-timeline-item__content code),
.nc-card :deep(.el-collapse-item__content code) {
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
    :deep(.el-button) {
      width: 100%;
      margin-right: 0;
    }
    :deep(.el-descriptions__label),
    :deep(.el-descriptions__content) {
      word-break: break-word;
    }
  }
  .proto-overview {
    grid-template-columns: 1fr;
  }
}
</style>
