<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { fetchInstances } from "@/api/consoleApi";
import { getBotServiceBaseRef, ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";
import { Link, List, Position, QuestionFilled } from "@element-plus/icons-vue";
import { computed, onMounted, ref } from "vue";

type NcSection = "url" | "flow" | "faq";

const section = ref<NcSection>("url");
const sectionTitle: Record<NcSection, string> = {
  url: "协议端管理 URL",
  flow: "推荐操作顺序",
  faq: "常见问题",
};
const sectionSub: Record<NcSection, string> = {
  url: "Pallas 托管页路径、鉴权与 NapCat 自带 Web 的区别（数据来自已加载的 pallas_protocol）。",
  flow: "从登录到验证连接的推荐步骤。",
  faq: "404、token、开发端口等高频问题。",
};
const navItems = [
  { index: "url", label: "管理 URL", icon: Link },
  { index: "flow", label: "推荐顺序", icon: List },
  { index: "faq", label: "常见问题", icon: QuestionFilled },
];

const botBase = getBotServiceBaseRef();
const webuiPath = ref<string | null>(null);

const protocolOpenUrl = computed(() => protocolDashboardUrl(botBase.value || "http://localhost:8088", webuiPath.value));

const activeFaq = ref<string[]>([]);

function openProtocol() {
  window.open(protocolOpenUrl.value, "_blank", "noopener");
}

onMounted(async () => {
  void ensureBotServiceBaseUrl();
  try {
    const data = await fetchInstances();
    const snap = data.pallas_protocol ?? data.napcat ?? null;
    webuiPath.value = snap?.webui_path ?? null;
  } catch {
    webuiPath.value = null;
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
      class="panel nc-card"
    >
      <el-tag
        type="info"
        effect="plain"
        size="small"
        class="tag-row"
      >
        pallas_protocol
      </el-tag>
      <p class="lead lead-spaced">
        ① 下表为 <strong>Pallas 协议插件托管的管理页</strong>，与 Bot 使用同一
        <code>host:port</code>（由 <code>/pallas/api/system</code> 的驱动地址生成，未连上时回退
        <code>http://localhost:8088</code>），默认路径段为
        <code>/protocol/napcat</code>；可在配置中用 <code>pallas_protocol_webui_path</code> 覆盖整段挂载。
        单号页为 <code>…/protocol/napcat/account/&lt;账号ID&gt;</code>（账号 ID 与插件内登记一致，多为 QQ 号）。
      </p>
      <p class="lead lead-spaced">
        ② <strong>NapCat 内嵌 Web</strong> 在 <strong>独立 webui 端口</strong>，形如
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
          <code>/protocol/napcat</code>）。
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
          <code>http://127.0.0.1:8088/protocol/napcat</code>，与
          <code>PORT</code> 一致。
        </el-collapse-item>
      </el-collapse>
    </div>
  </PallasSidebarShell>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}
.panel {
  max-width: 920px;
}
.tag-row {
  margin-bottom: 12px;
}
.nc-card {
  .lead {
    line-height: 1.7;
    color: var(--el-text-color-regular);
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
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
  }
  code {
    font-size: 0.9em;
  }
}
html.dark .nc-card {
  border-color: rgba(100, 160, 255, 0.2);
}
</style>
