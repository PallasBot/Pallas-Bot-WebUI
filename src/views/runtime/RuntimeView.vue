<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import { fetchBots, fetchLogs, fetchSystem } from "@/api/consoleApi";
import { pallasConnectionKey } from "@/types/pallas-connection";
import type { SystemData, BotRow } from "@/api/pallasTypes";
import { Cpu, Document, Link } from "@element-plus/icons-vue";
import { inject, nextTick, ref, watch } from "vue";
import { ElMessage } from "element-plus";

type RtSection = "sys" | "bots" | "log";

const section = ref<RtSection>("sys");
const conn = inject(pallasConnectionKey, null);
const sectionTitle: Record<RtSection, string> = {
  sys: "系统与驱动",
  bots: "OneBot 连接",
  log: "运行日志",
};
const sectionSub: Record<RtSection, string> = {
  sys: "NoneBot 监听、超管数、插件数等（只读）。",
  bots: "当前已连接的协议账号列表。",
  log: "最近日志只读预览；不提供写配置。",
};
const navItems = [
  { index: "sys", label: "系统与驱动", icon: Cpu },
  { index: "bots", label: "OneBot 连接", icon: Link },
  { index: "log", label: "运行日志", icon: Document },
];

const loading = ref(false);

const system = ref<SystemData | null>(null);
const bots = ref<BotRow[]>([]);
const logLines = ref<string[]>([]);
const logN = ref(300);
const logMax = ref(2000);
const logFollow = ref(true);
const logStickToBottom = ref(true);
const logScrollRef = ref<{
  setScrollTop?: (v: number) => void;
  wrapRef?: HTMLElement;
} | null>(null);

async function loadSystem() {
  system.value = await fetchSystem();
}
async function loadBots() {
  bots.value = await fetchBots();
}
async function loadLog() {
  const shouldFollow = logFollow.value && logStickToBottom.value;
  const d = await fetchLogs(logN.value);
  logLines.value = d.lines;
  logMax.value = d.max;
  if (shouldFollow) {
    await nextTick();
    logScrollRef.value?.setScrollTop?.(Number.MAX_SAFE_INTEGER);
  }
}

function onLogScroll({ scrollTop }: { scrollTop: number }) {
  const wrap = logScrollRef.value?.wrapRef;
  if (!wrap) return;
  const distToBottom = wrap.scrollHeight - (scrollTop + wrap.clientHeight);
  logStickToBottom.value = distToBottom <= 24;
}

async function loadTab() {
  loading.value = true;
  try {
    if (section.value === "sys") {
      await loadSystem();
    } else if (section.value === "bots") {
      await loadBots();
    } else {
      await loadLog();
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

watch(
  section,
  () => {
    void loadTab();
  },
  { immediate: true },
);

watch(
  () => conn?.healthTick.value,
  () => {
    if (conn?.ok.value && !loading.value) {
      void loadTab();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    const run = () => {
      void loadTab();
    };
    if (loading.value) {
      window.setTimeout(run, 80);
    } else {
      run();
    }
  },
  { immediate: true },
);

function fmtTime(t: number) {
  if (!t) return "—";
  return new Date(t * 1000).toLocaleString();
}
</script>

<template>
  <PallasSidebarShell
    v-model="section"
    aside-title="运行状态"
    menu-aria-label="运行状态分节"
    :nav-items="navItems"
  >
    <template #header="{ section: s }">
      <h1 class="main-title">{{ sectionTitle[s as RtSection] }}</h1>
      <p class="main-sub">{{ sectionSub[s as RtSection] }}</p>
    </template>

    <div
      v-show="section === 'sys'"
      class="panel"
    >
      <p class="intro">
        本页只读展示：NoneBot 驱动监听、已连接账号、插件与日志摘要。不提供写配置；修改监听地址或端口请调整
        <code>.env</code> 后重启进程。
      </p>
      <el-skeleton
        v-if="loading && !system"
        :rows="4"
        animated
      />
      <el-descriptions
        v-else-if="system"
        :column="1"
        border
      >
        <el-descriptions-item label="NoneBot 监听">
          <span class="pallas-kv">
            <code>host = {{ String(system.nonebot2_driver?.host) }}</code>
            <span class="kv-sep"> · </span>
            <code>port = {{ String(system.nonebot2_driver?.port) }}</code>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="超管账号数 (superusers)">
          {{ system.superuser_count }}
        </el-descriptions-item>
        <el-descriptions-item label="已连 Bot 数">
          {{ system.bot_count }}
        </el-descriptions-item>
        <el-descriptions-item label="已加载插件数">
          {{ system.plugin_count }}
        </el-descriptions-item>
        <el-descriptions-item label="服务端时间">
          {{ fmtTime(system.server_time) }}
        </el-descriptions-item>
        <el-descriptions-item
          v-if="system.console?.static_root"
          label="WebUI 静态 (后端)"
        >
          <span class="pallas-kv"><code>{{ system.console.static_root }}</code></span>
        </el-descriptions-item>
      </el-descriptions>
      <el-button
        v-if="system"
        class="rfb"
        plain
        type="primary"
        :loading="loading"
        @click="loadSystem"
      >仅刷新本页</el-button>
    </div>

    <div
      v-show="section === 'bots'"
      class="panel"
    >
      <el-skeleton
        v-if="loading && bots.length === 0"
        :rows="3"
        animated
      />
      <el-table
        v-else
        :data="bots"
        border
        size="default"
      >
        <el-table-column
          label="connection_key"
          prop="connection_key"
          min-width="160"
          show-overflow-tooltip
        />
        <el-table-column
          label="self_id"
          prop="self_id"
          width="140"
        />
        <el-table-column
          label="adapter"
          prop="adapter"
          min-width="100"
        />
      </el-table>
      <el-text
        v-if="!loading && bots.length === 0"
        class="emp"
      >当前无已连接账号；请检查协议端与 .env 中的 OneBot/反向 WS 配置</el-text>
      <el-button
        class="rfb"
        plain
        type="primary"
        :loading="loading"
        @click="loadBots"
      >仅刷新本页</el-button>
    </div>

    <div
      v-show="section === 'log'"
      class="panel"
    >
      <div class="log-bar">
        <el-input-number
          v-model="logN"
          :min="50"
          :max="logMax"
          :step="50"
          size="small"
          controls-position="right"
        />
        <el-text
          type="info"
          class="lhint"
          size="small"
        >最多 {{ logMax }} 行（受后端 pallas_webui_log_lines_max 限制）</el-text>
        <el-switch
          v-model="logFollow"
          size="small"
          active-text="自动跟随"
          inactive-text="手动查看"
        />
        <el-button
          type="primary"
          :loading="loading"
          @click="loadLog"
        >拉取</el-button>
      </div>
      <el-scrollbar
        ref="logScrollRef"
        v-loading="loading"
        max-height="50vh"
        class="log-box"
        @scroll="onLogScroll"
      >
        <pre class="log-pre">{{ logLines.length ? logLines.join("\n") : "（暂无，或日志环尚未有输出）" }}</pre>
      </el-scrollbar>
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
.intro {
  line-height: 1.5;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
  max-width: 900px;
}
.panel {
  width: 100%;
  max-width: none;
}
.rfb {
  margin-top: 12px;
}
.emp {
  display: block;
  margin: 8px 0 12px;
  font-size: 13px;
  color: var(--el-color-warning);
}
.log-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
  .lhint {
    font-size: 12px;
  }
}
.log-box {
  background: var(--el-fill-color-light);
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
  padding: 8px 10px;
}
.log-pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, Consolas, monospace;
}
.kv-sep {
  color: var(--el-text-color-secondary);
  font-weight: 400;
}
</style>
