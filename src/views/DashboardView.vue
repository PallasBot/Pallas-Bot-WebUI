<script setup lang="ts">
import {
  fetchAiExtensionConfig,
  fetchAiExtensionLogs,
  fetchInstances,
  fetchLogs,
  fetchSystem,
  postAiExtensionTest,
} from "@/api/consoleApi";
import type {
  AiExtensionConfig,
  AiExtensionLogsData,
  AiExtensionTestData,
  BotConfigPublic,
  BotRow,
  NapcatAccountRow,
} from "@/api/pallasTypes";
import { useMergedBotRows } from "@/composables/useMergedBotRows";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { getBotServiceBaseRef } from "@/utils/botServiceBase";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";
import { Cpu, DataLine, OfficeBuilding, Warning } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const LOG_POLL_MS = 3000;

const conn = inject(pallasConnectionKey);
if (!conn) {
  throw new Error("Pallas: missing pallasConnection");
}
const { ok, refresh, healthTick } = conn;

const logLines = ref<string[]>([]);
const logN = ref(200);
const logMax = ref(2000);
const logLoading = ref(false);
const logFollow = ref(true);
const logStickToBottom = ref(true);
const logScrollRef = ref<{
  setScrollTop?: (v: number) => void;
  wrapRef?: HTMLElement;
} | null>(null);
let logPollTimer: ReturnType<typeof setInterval> | null = null;

const sysLoading = ref(false);
const sysData = ref<Awaited<ReturnType<typeof fetchSystem>> | null>(null);
const cpuPercent = ref<number | null>(null);
const memPercent = ref<number | null>(null);
const diskPercent = ref<number | null>(null);
const memUsed = ref<number | null>(null);
const memTotal = ref<number | null>(null);
const diskUsed = ref<number | null>(null);
const diskTotal = ref<number | null>(null);
const platformLabel = ref("-");
const pythonLabel = ref("-");
const aiCfg = ref<AiExtensionConfig | null>(null);
const aiTest = ref<AiExtensionTestData | null>(null);
const aiTesting = ref(false);
const aiUv = ref<AiExtensionLogsData | null>(null);
const aiCel = ref<AiExtensionLogsData | null>(null);
const aiLogLoading = ref(false);

const driverHostPort = computed(() => {
  const drv = sysData.value?.nonebot2_driver;
  if (!drv?.host || !drv?.port) return "-";
  return `${drv.host}:${drv.port}`;
});

const nonebot = ref<BotRow[]>([]);
const dbBots = ref<BotConfigPublic[]>([]);
const protocolAccounts = ref<NapcatAccountRow[]>([]);
const botProfiles = ref<Record<string, { nickname?: string }>>({});
const protocolPath = ref<string | null>(null);
const { mergedRows } = useMergedBotRows(nonebot, dbBots);
const botBase = getBotServiceBaseRef();
const protocolManageUrl = computed(() =>
  protocolDashboardUrl(botBase.value || "http://localhost:8088", protocolPath.value),
);

function botNickname(selfId: string, account: number): string {
  const sid = String(selfId || "").trim();
  const aid = account >= 0 ? String(account) : "";
  const profile = botProfiles.value[sid] ?? (aid ? botProfiles.value[aid] : undefined);
  const profileName = String(profile?.nickname ?? "").trim();
  if (profileName) return profileName.toUpperCase();
  const ids = new Set<string>([String(selfId || "").trim()]);
  if (account >= 0) ids.add(String(account));
  for (const row of protocolAccounts.value) {
    const q = String(row.qq ?? row.id ?? "").trim();
    if (!q || !ids.has(q)) continue;
    const name = String(row.display_name ?? "").trim();
    if (name) return name.toUpperCase();
  }
  return "BOT";
}

function metricClass(v: number | null): string {
  if (v == null) return "is-unknown";
  if (v >= 85) return "is-crit";
  if (v >= 70) return "is-warn";
  return "is-ok";
}

function formatBytes(v: number | null): string {
  if (!v || v <= 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i <= 1 ? 0 : 1)} ${units[i]}`;
}

function stopLogPoll() {
  if (logPollTimer) {
    clearInterval(logPollTimer);
    logPollTimer = null;
  }
}

function startLogPoll() {
  stopLogPoll();
  logPollTimer = setInterval(() => {
    void loadLogs(true);
    void loadAiLogs(true);
  }, LOG_POLL_MS);
}

async function loadSystem(silent = true) {
  if (ok.value !== true) {
    return;
  }
  if (!silent) {
    sysLoading.value = true;
  }
  try {
    const s = await fetchSystem();
    sysData.value = s;
    const rt = s.runtime || {};
    cpuPercent.value = typeof rt.cpu_percent === "number" ? rt.cpu_percent : null;
    memPercent.value = typeof rt.memory?.percent === "number" ? rt.memory.percent : null;
    diskPercent.value = typeof rt.disk?.percent === "number" ? rt.disk.percent : null;
    memUsed.value = typeof rt.memory?.used === "number" ? rt.memory.used : null;
    memTotal.value = typeof rt.memory?.total === "number" ? rt.memory.total : null;
    diskUsed.value = typeof rt.disk?.used === "number" ? rt.disk.used : null;
    diskTotal.value = typeof rt.disk?.total === "number" ? rt.disk.total : null;
    platformLabel.value = typeof rt.platform === "string" && rt.platform ? rt.platform : "-";
    pythonLabel.value = typeof rt.python === "string" && rt.python ? rt.python : "-";
  } catch (e) {
    if (!silent) {
      ElMessage.error(e instanceof Error ? e.message : "拉取系统监控失败");
    }
  } finally {
    if (!silent) {
      sysLoading.value = false;
    }
  }
}

async function loadAiStatus(silent = true) {
  if (ok.value !== true) return;
  if (!silent) aiTesting.value = true;
  try {
    aiCfg.value = await fetchAiExtensionConfig();
    aiTest.value = await postAiExtensionTest();
  } catch (e) {
    if (!silent) ElMessage.error(e instanceof Error ? e.message : "AI 连接信息加载失败");
  } finally {
    if (!silent) aiTesting.value = false;
  }
}

async function loadAiLogs(silent = true) {
  if (ok.value !== true) return;
  if (!silent) aiLogLoading.value = true;
  try {
    const [u, c] = await Promise.all([fetchAiExtensionLogs("uvicorn", 120), fetchAiExtensionLogs("celery", 120)]);
    aiUv.value = u;
    aiCel.value = c;
  } catch (e) {
    if (!silent) ElMessage.error(e instanceof Error ? e.message : "AI 日志读取失败");
  } finally {
    if (!silent) aiLogLoading.value = false;
  }
}

async function loadInstances(silent = true) {
  if (ok.value !== true) {
    nonebot.value = [];
    dbBots.value = [];
    return;
  }
  try {
    const data = await fetchInstances();
    nonebot.value = data.nonebot_bots;
    dbBots.value = data.db_bot_configs;
    botProfiles.value = data.bot_profiles ?? {};
    protocolPath.value = data.pallas_protocol?.webui_path ?? data.napcat?.webui_path ?? null;
    protocolAccounts.value = (data.pallas_protocol?.accounts ??
      data.napcat?.accounts ??
      []) as NapcatAccountRow[];
  } catch (e) {
    if (!silent) {
      ElMessage.error(e instanceof Error ? e.message : "拉取实例数据失败");
    }
    nonebot.value = [];
    dbBots.value = [];
    botProfiles.value = {};
    protocolPath.value = null;
    protocolAccounts.value = [];
  }
}

/** @param silent 为 true 时不占满按钮 loading（用于轮询与顶栏联动） */
async function loadLogs(silent = false) {
  if (ok.value !== true) {
    logLines.value = [];
    return;
  }
  if (!silent) {
    logLoading.value = true;
  }
  try {
    const shouldFollow = logFollow.value && logStickToBottom.value;
    const d = await fetchLogs(logN.value);
    logLines.value = d.lines;
    logMax.value = d.max;
    if (shouldFollow) {
      await nextTick();
      logScrollRef.value?.setScrollTop?.(Number.MAX_SAFE_INTEGER);
    }
  } catch (e) {
    if (!silent) {
      ElMessage.error(e instanceof Error ? e.message : "拉取日志失败");
    }
    logLines.value = [];
  } finally {
    if (!silent) {
      logLoading.value = false;
    }
  }
}

function onLogScroll({ scrollTop }: { scrollTop: number }) {
  const wrap = logScrollRef.value?.wrapRef;
  if (!wrap) return;
  const distToBottom = wrap.scrollHeight - (scrollTop + wrap.clientHeight);
  logStickToBottom.value = distToBottom <= 24;
}

watch(ok, (v) => {
  if (v === true) {
    void loadLogs(true);
    void loadSystem(true);
    void loadInstances(true);
    void loadAiStatus(true);
    void loadAiLogs(true);
    startLogPoll();
  } else {
    stopLogPoll();
    if (v === false) {
      logLines.value = [];
      nonebot.value = [];
      dbBots.value = [];
      botProfiles.value = {};
    }
  }
}, { immediate: true });

watch(healthTick, () => {
  if (ok.value === true) {
    void loadLogs(true);
    void loadSystem(true);
    void loadInstances(true);
    void loadAiStatus(true);
    void loadAiLogs(true);
  }
});

onUnmounted(() => {
  stopLogPoll();
});
</script>

<template>
  <div class="view-page dashboard">
    <div class="dash-shell">
      <aside class="dash-rail">
        <div class="dash-rail-hd">
          <div class="dash-rail-title">实例</div>
        </div>
        <div
          v-if="ok !== true"
          class="dash-rail-muted"
        >连接控制台后显示</div>
        <div
          v-else-if="!mergedRows.length"
          class="dash-rail-muted"
        >暂无实例数据</div>
        <div
          v-else
          class="dash-rail-list"
        >
          <button
            v-for="row in mergedRows"
            :key="row.key"
            type="button"
            class="dash-rail-item"
            :class="{ on: row.online }"
            @click="router.push({ name: 'accounts' })"
          >
            <div class="dash-rail-name">
              <span class="dash-rail-nick">{{ botNickname(row.selfId, row.account) }}</span>
            </div>
            <div class="dash-rail-meta">
              <span
                class="dash-dot"
                :class="{ on: row.online }"
              />
              <span class="mono dash-rail-id">Bot QQ {{ row.account >= 0 ? row.account : row.selfId }}</span>
              <el-tag
                :type="row.online ? 'success' : 'info'"
                size="small"
              >{{ row.online ? "已连接" : "未连接" }}</el-tag>
            </div>
            <div class="dash-rail-adp mono">{{ row.adapter }}</div>
          </button>
        </div>
        <a
          class="dash-rail-foot"
          :href="protocolManageUrl"
          target="_blank"
          rel="noopener"
        >前往「协议管理 Web」</a>
      </aside>

      <div class="dash-main">
    <section class="dash-sec">
      <h4 class="dash-h">仪表盘</h4>
      <el-row :gutter="14" class="stat-row">
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-inner">
              <el-icon class="stat-ico"><Cpu /></el-icon>
              <div>
                <div class="stat-label">CPU 占用</div>
                <div
                  class="stat-value"
                  :class="metricClass(cpuPercent)"
                >{{ cpuPercent == null ? "-" : `${cpuPercent.toFixed(1)}%` }}</div>
                <div class="stat-sub">实时占用率</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-inner">
              <el-icon class="stat-ico"><DataLine /></el-icon>
              <div>
                <div class="stat-label">内存占用</div>
                <div
                  class="stat-value"
                  :class="metricClass(memPercent)"
                >{{ memPercent == null ? "-" : `${memPercent.toFixed(1)}%` }}</div>
                <div class="stat-sub">{{ formatBytes(memUsed) }} / {{ formatBytes(memTotal) }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
        <el-col :xs="24" :sm="8">
          <el-card shadow="hover" class="stat-card">
            <div class="stat-inner">
              <el-icon class="stat-ico"><OfficeBuilding /></el-icon>
              <div>
                <div class="stat-label">磁盘占用</div>
                <div
                  class="stat-value"
                  :class="metricClass(diskPercent)"
                >{{ diskPercent == null ? "-" : `${diskPercent.toFixed(1)}%` }}</div>
                <div class="stat-sub">{{ formatBytes(diskUsed) }} / {{ formatBytes(diskTotal) }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      <el-card class="nb-conn-card" shadow="never">
        <div class="nb-conn-hd">NoneBot 连接信息</div>
        <div class="nb-conn-grid">
          <div class="nb-item">
            <span class="k">驱动监听</span>
            <span class="v mono">{{ driverHostPort }}</span>
          </div>
          <div class="nb-item">
            <span class="k">运行平台</span>
            <span class="v">{{ platformLabel }}</span>
          </div>
          <div class="nb-item">
            <span class="k">Python</span>
            <span class="v">{{ pythonLabel }}</span>
          </div>
          <div class="nb-item">
            <span class="k">已加载插件</span>
            <span class="v">{{ sysData?.plugin_count ?? "-" }}</span>
          </div>
          <div class="nb-item">
            <span class="k">超管账号数</span>
            <span class="v">{{ sysData?.superuser_count ?? "-" }}</span>
          </div>
        </div>
      </el-card>
      <el-card class="nb-conn-card" shadow="never">
        <div class="nb-conn-hd">AI 连接信息</div>
        <div class="nb-conn-grid">
          <div class="nb-item">
            <span class="k">服务地址</span>
            <span class="v">{{ aiCfg?.base_url || "—" }}</span>
          </div>
          <div class="nb-item">
            <span class="k">健康探测</span>
            <span class="v">{{ aiTest?.health_url || "—" }}</span>
          </div>
          <div class="nb-item">
            <span class="k">状态</span>
            <span class="v">
              <el-tag :type="aiTest?.ok ? 'success' : 'danger'" size="small">{{ aiTest?.ok ? "已连接" : "未连接" }}</el-tag>
            </span>
          </div>
          <div class="nb-item">
            <span class="k">状态码</span>
            <span class="v">{{ aiTest?.status_code ?? "—" }}</span>
          </div>
        </div>
        <div class="mini-actions">
          <el-button type="primary" size="small" :loading="aiTesting" @click="loadAiStatus(false)">刷新 AI 连接</el-button>
        </div>
      </el-card>
    </section>

    <section class="dash-sec dash-sec--log">
      <el-card class="log-card" shadow="hover">
        <template #header>
          <div class="log-hd">
            <span>日志输出</span>
            <div class="log-ctl">
              <el-input-number v-model="logN" :min="50" :max="logMax" :step="50" size="small" controls-position="right" />
              <el-switch
                v-model="logFollow"
                size="small"
                active-text="自动跟随"
                inactive-text="手动查看"
              />
              <el-button type="primary" size="small" :loading="logLoading" :disabled="ok !== true" @click="loadLogs(false)">立即刷新</el-button>
              <el-button type="primary" plain size="small" :disabled="ok !== true" @click="refresh">刷新连接</el-button>
            </div>
          </div>
        </template>
        <el-scrollbar ref="logScrollRef" v-loading="logLoading" max-height="360px" class="log-scroll" @scroll="onLogScroll">
          <pre class="log-pre">{{ logLines.length ? logLines.join('\n') : (ok === true ? '（暂无输出）' : '—') }}</pre>
        </el-scrollbar>
      </el-card>
      <el-card class="log-card" shadow="hover">
        <template #header>
          <div class="log-hd">
            <span>AI 日志（Uvicorn / Celery）</span>
            <div class="log-ctl">
              <el-button type="primary" size="small" :loading="aiLogLoading" :disabled="ok !== true" @click="loadAiLogs(false)">刷新</el-button>
            </div>
          </div>
        </template>
        <el-row :gutter="12">
          <el-col :xs="24" :md="12">
            <el-text size="small" type="info">Uvicorn：{{ aiUv?.path || "—" }}</el-text>
            <el-scrollbar max-height="220px" class="log-scroll">
              <pre class="log-pre">{{ (aiUv?.lines || []).join('\n') || aiUv?.error || "（暂无输出）" }}</pre>
            </el-scrollbar>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-text size="small" type="info">Celery：{{ aiCel?.path || "—" }}</el-text>
            <el-scrollbar max-height="220px" class="log-scroll">
              <pre class="log-pre">{{ (aiCel?.lines || []).join('\n') || aiCel?.error || "（暂无输出）" }}</pre>
            </el-scrollbar>
          </el-col>
        </el-row>
      </el-card>
    </section>
      </div>
    </div>

    <el-alert v-if="ok === false" :closable="false" type="error" show-icon class="alert-top">
      <template #title>无法连接 /pallas/api/health</template>
      请确认 Pallas-Bot 已运行且已加载 <code>pallas_webui</code> 插件；若使用
      <code>npm run dev</code>，请核对 Vite 代理与 <code>.env</code> 中 <code>PORT</code> 是否一致。
    </el-alert>

    <el-card v-if="ok === null" class="tip-card" shadow="never">
      <p><el-icon class="v-mid"><Warning /></el-icon> 正在连接控制台…</p>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.view-page.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 28px;
  min-height: 100%;
}
.dash-shell {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.dash-rail {
  width: 260px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: calc(100vh - 140px);
  overflow: auto;
  padding: 14px 12px 12px;
  background: var(--c-nav-bg);
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.06);
}
.dash-rail-hd {
  margin-bottom: 10px;
}
.dash-rail-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--c-main);
  letter-spacing: 0.02em;
}
.dash-rail-muted {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.55;
}
.dash-rail-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dash-rail-item {
  width: 100%;
  text-align: left;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 10px;
  background: var(--el-fill-color-blank);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  &:hover {
    border-color: rgba(22, 100, 196, 0.35);
    background: #fafbfc;
  }
  &.on {
    border-color: rgba(22, 160, 90, 0.35);
  }
}
.dash-rail-name {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.dash-rail-nick {
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: var(--el-text-color-primary);
}
.dash-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--el-text-color-placeholder);
  &.on {
    background: var(--el-color-success);
  }
}
.dash-rail-nm {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.dash-rail-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}
.dash-rail-id {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.dash-rail-adp {
  font-size: 11px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dash-rail-foot {
  display: block;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(22, 100, 196, 0.18);
  font-size: 13px;
  font-weight: 500;
  color: var(--c-main);
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
.dash-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
@media (max-width: 768px) {
  .dash-shell {
    flex-direction: column;
  }
  .dash-rail {
    width: 100%;
    max-height: none;
    position: relative;
  }
}
.dash-sec { display: flex; flex-direction: column; gap: 10px; }
.dash-sec--log { padding-top: 4px; gap: 12px; }
.dash-h { margin: 0; font-size: 15px; font-weight: 600; color: var(--c-main); letter-spacing: 0.03em; }
.dash-h--after { margin-top: 2px; }
.stat-row { width: 100%; }
.stat-row :deep(.el-col) {
  display: flex;
}
.stat-card {
  width: 100%;
  height: 100%;
  border-left: 3px solid var(--c-main);
  .stat-inner { display: flex; align-items: center; gap: 12px; min-height: 84px; }
  .stat-ico { font-size: 1.8rem; color: var(--c-main); }
  .stat-label { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 2px; }
  .stat-value { font-size: 1.05rem; font-weight: 700; }
  .stat-value.is-ok { color: var(--el-color-success); }
  .stat-value.is-warn { color: var(--el-color-warning); }
  .stat-value.is-crit { color: var(--el-color-danger); }
  .stat-value.is-unknown { color: var(--el-text-color-secondary); }
  .stat-sub { font-size: 12px; color: var(--el-text-color-secondary); }
}
.nb-conn-card {
  border: 1px solid rgba(22, 100, 196, 0.12);
}
.nb-conn-hd {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-main);
  margin-bottom: 8px;
}
.nb-conn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.nb-item {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nb-item .k {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.nb-item .v {
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.mini-actions {
  margin-top: 10px;
}
.mono { font-family: ui-monospace, Consolas, monospace; }
.alert-top { width: 100%; }
.tip-card p { margin: 0; color: var(--el-text-color-secondary); display: flex; align-items: center; gap: 8px; }
.v-mid { vertical-align: middle; }
.log-card { border: 1px solid rgba(22, 100, 196, 0.12); :deep(.el-card__header) { padding: 12px 16px; } }
.log-hd { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; width: 100%; }
.log-ctl { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.log-scroll { background: var(--el-fill-color-light); border-radius: 8px; border: 1px solid var(--el-border-color-lighter); }
.log-pre { margin: 0; padding: 10px 12px; font-size: 12px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, Consolas, monospace; }
</style>


