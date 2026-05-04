<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { fetchInstances } from "@/api/consoleApi";
import { getBotServiceBaseRef, ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";
import { Download, Link, List, Position, QuestionFilled } from "@element-plus/icons-vue";
import { computed, onMounted, ref } from "vue";

type NcSection = "url" | "assets" | "flow" | "faq";

const section = ref<NcSection>("url");
const sectionTitle: Record<NcSection, string> = {
  url: "协议运行仪表盘",
  assets: "协议资产",
  flow: "上线与巡检流程",
  faq: "故障排查 FAQ",
};
const sectionSub: Record<NcSection, string> = {
  url: "集中查看协议端开关、账号在线情况与访问入口（基于已加载的 pallas_protocol 快照）。",
  assets: "在 Bot 托管页打开 NapCat / SnowLuma 发行包下载（与实例数据目录下的 runtime_dist、runtime_extract 对应）。",
  flow: "从协议端登录到回连验证的建议执行顺序，减少上线遗漏。",
  faq: "覆盖 404、token、端口冲突等高频问题，并给出可执行排查路径。",
};
const navItems = [
  { index: "url", label: "管理 URL", icon: Link },
  { index: "assets", label: "协议资产", icon: Download },
  { index: "flow", label: "推荐顺序", icon: List },
  { index: "faq", label: "常见问题", icon: QuestionFilled },
];

const botBase = getBotServiceBaseRef();
const webuiPath = ref<string | null>(null);
const webuiEnabled = ref(false);
const accountCount = ref(0);
const connectedCount = ref(0);

const protocolOpenUrl = computed(() => protocolDashboardUrl(botBase.value || "http://localhost:8088", webuiPath.value));

const protocolAssetsUrl = computed(() => {
  const base = protocolOpenUrl.value.replace(/\/$/, "");
  return `${base}/assets`;
});

const activeFaq = ref<string[]>([]);

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
      <h1 class="main-title">{{ sectionTitle[s as NcSection] }}</h1>
      <p class="main-sub">{{ sectionSub[s as NcSection] }}</p>
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
        ① 下表为 Pallas 协议插件托管的管理页，与 Bot 使用同一
        <code>host:port</code>（由 <code>/pallas/api/system</code> 的驱动地址生成，未连上时回退
        <code>http://localhost:8088</code>），默认路径段为
        <code>/protocol/console</code>；可在配置中用 <code>pallas_protocol_webui_path</code> 覆盖整段挂载。
        单号页为 <code>…/protocol/console/account/&lt;账号ID&gt;</code>（账号 ID 与插件内登记一致，多为 QQ 号）。
      </p>
      <p class="lead lead-spaced pallas-doc-prose">
        ② NapCat 内嵌 Web 在独立 webui 端口，形如
        <code>http://[bind]:[webui_port]/webui/?token=</code>，与 ① 不是同一地址；在「好友与群」中按行展示（字段
        <code>native_webui_url</code>）。进程未起或未取到端口时该列为空。
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
          打开 ① Pallas 协议端管理总览
        </el-button>
        <el-descriptions
          :column="1"
          border
          size="small"
          class="nc-desc-table"
        >
          <el-descriptions-item label="① 管理总览">
            <el-link
              :href="protocolOpenUrl"
              type="primary"
              :icon="Position"
            >
              {{ protocolOpenUrl }}
            </el-link>
            <div class="sub">与当前控制台同主机、同端口，仅路径不同；若 Nginx
              反代需保证该路径透传。</div>
          </el-descriptions-item>
          <el-descriptions-item label="与 Bot Console 同机">
            与 <code>/pallas</code> 共走同一 HTTP
            服务（NoneBot / uvicorn），仅路径段不同，无需为协议端管理页单独开端口。
          </el-descriptions-item>
          <el-descriptions-item label="鉴权">
            以 <code>pallas_protocol_token</code> 为准：Query
            <code>token=</code> 或请求头
            <code>X-Pallas-Protocol-Token</code>。详见主仓 <code>pallas_protocol</code> 配置说明。
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
        title="需在浏览器中登录协议插件页面（与协议管理相同的 token）后即可下载。"
      />
      <p class="lead lead-spaced pallas-doc-prose">
        压缩包保存在 Bot 数据目录 <code>runtime_dist/napcat</code>、<code>runtime_dist/snowluma</code>；解压结果在
        <code>runtime_extract/napcat</code>、<code>runtime_extract/snowluma</code>。
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
        打开协议资产页（NapCat / SnowLuma）
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
          打开协议端面板，完成登录或确认账号已在线
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          核对各账号目录下 <code>onebot*.json</code> 中反向 WS 指向 Pallas
          监听的 OneBot 地址
        </el-timeline-item>
        <el-timeline-item
          type="primary"
          hollow
        >
          在 Pallas 中验证连接（bot 日志 / 发消息测试）后，再回到本页或控制台总览
          查看 <code>/pallas/api/health</code>
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
          请确认 <code>pallas_protocol</code> 已加载且
          <code>pallas_protocol_webui_enabled</code> 为开启；路径以
          <code>/pallas/api/instances</code> 返回的 <code>webui_path</code> 为准（默认
          <code>/protocol/console</code>）。
        </el-collapse-item>
        <el-collapse-item
          name="2"
          title="新标签里要求 token"
        >
          与 <code>pallas_protocol_token</code>
          一致，可在 <code>.env</code> 与插件配置中核对；请求头
          <code>X-Pallas-Protocol-Token</code> 亦可。
        </el-collapse-item>
        <el-collapse-item
          name="3"
          title="Vite 开发端口与 Bot 不同"
        >
          本管理 URL 以 Bot 进程
          监听地址为准。开发时若前端跑在 5173，应通过 Vite 代理
          <code>/pallas/api</code>；要打开协议端页面请用 Bot 的根地址，例如
          <code>http://127.0.0.1:8088/protocol/console</code>，与
          <code>PORT</code> 一致。
        </el-collapse-item>
      </el-collapse>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: var(--pallas-text-xl);
  font-weight: var(--pallas-weight-semibold);
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: var(--pallas-text-sm);
  font-weight: var(--pallas-weight-medium);
  line-height: 1.62;
  color: var(--el-text-color-secondary);
}
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
  .main-title {
    font-size: var(--pallas-text-lg);
  }
  .main-sub {
    margin-top: 6px;
    font-size: var(--pallas-text-sm);
    line-height: 1.58;
  }
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
