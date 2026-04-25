<script setup lang="ts">
import {
  fetchAiExtensionConfig,
  fetchDbOverview,
  fetchFriendList,
  fetchGroupConfigs,
  fetchInstances,
  fetchLogs,
  fetchMessageStats,
  fetchSystem,
  postAiExtensionTest,
} from "@/api/consoleApi";
import type {
  AiExtensionConfig,
  AiExtensionTestData,
  BotConfigPublic,
  BotRow,
  DbOverviewData,
  NapcatAccountRow,
} from "@/api/pallasTypes";
import { useMergedBotRows } from "@/composables/useMergedBotRows";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { pallasBotContextKey } from "@/types/pallas-bot-context";
import { getBotServiceBaseRef } from "@/utils/botServiceBase";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";
import { Cpu, DataLine, OfficeBuilding, Warning } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, inject, nextTick, onUnmounted, ref, watch } from "vue";

const LOG_POLL_MS = 3000;

const conn = inject(pallasConnectionKey);
const botCtx = inject(pallasBotContextKey, null);
if (!conn) {
  throw new Error("Pallas: missing pallasConnection");
}
const { ok, last, healthTick } = conn;
const consoleVersion = computed(() => last.value?.console?.version || last.value?.pallas_bot || "unknown");

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
const dbBackend = ref("-");
const dbOverview = ref<DbOverviewData | null>(null);
const botFriendCount = ref<number | null>(null);
const botGroupCount = ref<number | null>(null);
const msgSent = ref<number | null>(null);
const msgReceived = ref<number | null>(null);

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
const dashboardBotSelfId = ref<string | null>(null);
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

const selectedDashboardBot = computed(
  () =>
    mergedRows.value.find(
      (r) => r.selfId === dashboardBotSelfId.value || String(r.account) === dashboardBotSelfId.value,
    ) ?? null,
);
const selectedDashboardBotQq = computed(() => {
  if (!selectedDashboardBot.value) return "";
  if (selectedDashboardBot.value.account >= 0) return String(selectedDashboardBot.value.account);
  return String(selectedDashboardBot.value.selfId || "");
});
const selectedDashboardBotAvatar = computed(() => {
  const qq = selectedDashboardBotQq.value.trim();
  if (!/^\d+$/.test(qq)) return "";
  return `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=140`;
});
const onlineBotCount = computed(() => mergedRows.value.filter((r) => r.online).length);
const selectedProtocolAccount = computed(() => {
  const qq = selectedDashboardBotQq.value.trim();
  if (!qq) return null;
  return protocolAccounts.value.find((r) => String(r.qq ?? r.id ?? "").trim() === qq) ?? null;
});
const botFriendCountDisplay = computed(() => {
  const fromProtocol = Number(selectedProtocolAccount.value?.friend_count ?? selectedProtocolAccount.value?.friends_count);
  if (Number.isFinite(fromProtocol) && fromProtocol >= 0) return fromProtocol;
  return botFriendCount.value;
});
const botGroupCountDisplay = computed(() => {
  const fromProtocol = Number(selectedProtocolAccount.value?.group_count ?? selectedProtocolAccount.value?.groups_count);
  if (Number.isFinite(fromProtocol) && fromProtocol >= 0) return fromProtocol;
  return botGroupCount.value;
});
const introText = "我是来自米诺斯的祭司帕拉斯，会在罗德岛休息一段时间......";
const introText2 = "虽然这么说，我渴望以美酒和戏剧被招待，更渴望走向战场。";
const gpu = computed(() => sysData.value?.runtime?.gpu ?? { available: false, reason: "", devices: [] });
const dbItems = computed(() => {
  const data = dbOverview.value;
  if (!data) return [] as Array<{ name: string; count: number }>;
  if ("collections" in data) {
    return data.collections.map((x: { name: string; count: number }) => ({ name: x.name, count: x.count }));
  }
  if ("tables" in data) {
    return data.tables.map((x: { table: string; count: number }) => ({ name: x.table, count: x.count }));
  }
  return [];
});
const dbItemsLabel = computed(() => (dbBackend.value === "mongodb" ? "集合数" : "表数"));
const dbItemsTotal = computed(() =>
  dbItems.value.reduce((sum: number, x: { name: string; count: number }) => sum + (Number(x.count) || 0), 0),
);
const dbOverviewNote = computed(() => {
  const data = dbOverview.value;
  if (!data || "note" in data === false) return "";
  return data.note || "";
});

function metricClass(v: number | null): string {
  if (v == null) return "is-unknown";
  if (v >= 85) return "is-crit";
  if (v >= 70) return "is-warn";
  return "is-ok";
}

function formatBytes(v: number | null): string {
  if (v == null || v < 0) return "-";
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

async function loadDbOverview() {
  if (ok.value !== true) return;
  try {
    const d = await fetchDbOverview();
    dbOverview.value = d;
    dbBackend.value = d?.backend || "-";
  } catch {
    dbOverview.value = null;
    dbBackend.value = "-";
  }
}

async function loadMessageStats(selfId: string | null) {
  if (ok.value !== true || !selfId || !/^\d+$/.test(selfId)) {
    msgSent.value = null;
    msgReceived.value = null;
    return;
  }
  try {
    const data = await fetchMessageStats(parseInt(selfId, 10));
    msgSent.value = data.total_sent ?? 0;
    msgReceived.value = data.total_received ?? 0;
  } catch {
    msgSent.value = null;
    msgReceived.value = null;
  }
}

async function loadBotSocialStats(selfId: string | null) {
  if (ok.value !== true || !selfId || !/^\d+$/.test(selfId)) {
    botFriendCount.value = null;
    botGroupCount.value = null;
    return;
  }
  try {
    const [friends, groups] = await Promise.all([
      fetchFriendList(parseInt(selfId, 10), 5000),
      fetchGroupConfigs(5000),
    ]);
    botFriendCount.value = friends.friends.length;
    botGroupCount.value = groups.length;
  } catch {
    botFriendCount.value = null;
    botGroupCount.value = null;
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

/** @param silent 是否静默刷新 */
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
    void loadDbOverview();
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

watch(
  mergedRows,
  (rows) => {
    if (!rows.length) {
      dashboardBotSelfId.value = null;
      return;
    }
    const preferred = botCtx?.selectedBotSelfId.value ?? null;
    const hasPreferred = preferred ? rows.some((r) => r.selfId === preferred || String(r.account) === preferred) : false;
    const cur = dashboardBotSelfId.value;
    const hasCur = cur ? rows.some((r) => r.selfId === cur || String(r.account) === cur) : false;
    if (!hasCur) {
      dashboardBotSelfId.value = hasPreferred ? preferred : rows[0]!.selfId;
    }
  },
  { immediate: true },
);

watch(
  () => botCtx?.selectedBotSelfId.value,
  (sid) => {
    if (!sid) return;
    if (dashboardBotSelfId.value === sid) return;
    if (mergedRows.value.some((r) => r.selfId === sid || String(r.account) === sid)) {
      dashboardBotSelfId.value = sid;
    }
  },
  { immediate: true },
);

watch(dashboardBotSelfId, (sid) => {
  if (!sid || !botCtx) return;
  if (botCtx.selectedBotSelfId.value !== sid) botCtx.setSelectedBotSelfId(sid);
  void loadBotSocialStats(sid);
  void loadMessageStats(sid);
});

watch(healthTick, () => {
  if (ok.value === true) {
    void loadLogs(true);
    void loadSystem(true);
    void loadInstances(true);
    void loadAiStatus(true);
    void loadDbOverview();
  }
});

onUnmounted(() => {
  stopLogPoll();
});
</script>

<template>
  <div class="view-page dashboard">
    <div class="dash-shell">
      <div class="dash-main">
    <section class="dash-sec">
      <div class="dash-top-grid">
        <div class="dash-left">
          <el-card class="nb-conn-card bot-meta-card" shadow="never">
            <div class="bot-hero-online-title">在线的牛牛（{{ onlineBotCount }}）</div>
          </el-card>

          <el-card
            v-if="selectedDashboardBot"
            class="nb-conn-card bot-hero bot-hero-vertical"
            shadow="never"
          >
            <div class="bot-hero-main">
              <div class="bot-hero-head">
                <el-avatar
                  v-if="selectedDashboardBotAvatar"
                  :size="76"
                  :src="selectedDashboardBotAvatar"
                />
                <el-avatar
                  v-else
                  :size="76"
                >BOT</el-avatar>
                <div class="bot-hero-title">
                  <strong>{{ botNickname(selectedDashboardBot.selfId, selectedDashboardBot.account) }}</strong>
                  <span class="bot-hero-sub mono">账号 {{ selectedDashboardBotQq }}</span>
                </div>
              </div>
              <el-tag :type="selectedDashboardBot.online ? 'success' : 'info'" size="small">
                {{ selectedDashboardBot.online ? "在线" : "离线" }}
              </el-tag>
            </div>
            <div class="bot-inline-stats">
              <div class="bot-inline-item">
                <span class="k">好友</span>
                <span class="v">{{ botFriendCountDisplay ?? "-" }}</span>
              </div>
              <div class="bot-inline-item">
                <span class="k">群组</span>
                <span class="v">{{ botGroupCountDisplay ?? "-" }}</span>
              </div>
            </div>
            <div class="nb-conn-grid">
              <div class="nb-item">
                <span class="k">适配器</span>
                <span class="v mono">{{ selectedDashboardBot.adapter }}</span>
              </div>
              <div class="nb-item">
                <span class="k">Console 版本</span>
                <span class="v mono">{{ consoleVersion }}</span>
              </div>
            </div>
            <div class="bot-hero-actions">
              <el-link
                type="primary"
                :href="protocolManageUrl"
                target="_blank"
                rel="noopener"
              >
                前往协议管理
              </el-link>
            </div>
          </el-card>

          <el-card class="nb-conn-card bot-meta-card bot-db-card" shadow="never">
            <div class="bot-hero-db-title">当前连接数据库：{{ dbBackend }}</div>
            <div class="bot-db-kv">
              <span class="k">{{ dbItemsLabel }}</span>
              <span class="v">{{ dbItems.length || "-" }}</span>
            </div>
            <div class="bot-db-kv">
              <span class="k">记录总量</span>
              <span class="v">{{ dbItems.length ? dbItemsTotal : "-" }}</span>
            </div>
            <div
              v-if="dbOverviewNote"
              class="bot-db-sub"
            >{{ dbOverviewNote }}</div>
          </el-card>
          <el-card class="nb-conn-card msg-stats-card" shadow="never">
            <div class="nb-conn-hd">消息统计</div>
            <div class="nb-conn-grid msg-stats-grid">
              <div class="nb-item"><span class="k">发送消息</span><span class="v">{{ msgSent ?? "-" }}</span></div>
              <div class="nb-item"><span class="k">接收消息</span><span class="v">{{ msgReceived ?? "-" }}</span></div>
            </div>
          </el-card>
        </div>

        <div class="dash-system">
          <el-card class="intro-card" shadow="never">
            <div class="intro-main">
              <el-avatar
                :size="56"
                src="https://user-images.githubusercontent.com/18511905/195892994-c1a231ec-147a-4f98-ba75-137d89578247.png"
              />
              <div class="intro-text">
                <p>{{ introText }}</p>
                <p>{{ introText2 }}</p>
              </div>
            </div>
          </el-card>
          <h4 class="dash-h">系统信息</h4>
          <el-row :gutter="0" class="stat-row">
            <el-col :xs="24" :sm="8">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-inner">
                  <el-icon class="stat-ico"><Cpu /></el-icon>
                  <div>
                    <div class="stat-label">CPU 占用</div>
                    <div class="stat-value" :class="metricClass(cpuPercent)">{{ cpuPercent == null ? "-" : `${cpuPercent.toFixed(1)}%` }}</div>
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
                    <div class="stat-value" :class="metricClass(memPercent)">{{ memPercent == null ? "-" : `${memPercent.toFixed(1)}%` }}</div>
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
                    <div class="stat-value" :class="metricClass(diskPercent)">{{ diskPercent == null ? "-" : `${diskPercent.toFixed(1)}%` }}</div>
                    <div class="stat-sub">{{ formatBytes(diskUsed) }} / {{ formatBytes(diskTotal) }}</div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-card class="log-card log-card-compact" shadow="hover">
            <template #header>
              <div class="log-hd">
                <span>连接日志</span>
                <div class="log-ctl">
                  <el-button type="primary" size="small" :loading="logLoading" :disabled="ok !== true" @click="loadLogs(false)">刷新</el-button>
                </div>
              </div>
            </template>
            <el-scrollbar ref="logScrollRef" v-loading="logLoading" max-height="170px" class="log-scroll" @scroll="onLogScroll">
              <pre class="log-pre">{{ logLines.length ? logLines.join('\n') : (ok === true ? '（暂无输出）' : '—') }}</pre>
            </el-scrollbar>
          </el-card>
          <el-card class="nb-conn-card gpu-card" shadow="never">
            <div class="nb-conn-hd">GPU 监控</div>
            <el-alert v-if="!gpu.available" type="info" :closable="false" show-icon>
              <template #title>未启用 GPU 监控（{{ gpu.reason || "无可用 GPU 或未安装 pynvml" }}）</template>
            </el-alert>
            <div v-else class="nb-conn-grid">
              <div v-for="g in (gpu.devices || [])" :key="g.index" class="nb-item">
                <span class="k">{{ g.name }} (GPU {{ g.index }})</span>
                <span class="v">显存 {{ formatBytes(g.memory_used) }} / {{ formatBytes(g.memory_total) }}</span>
                <span class="v">核心 {{ g.utilization_gpu }}% · 显存 {{ g.utilization_memory }}% · 温度 {{ g.temperature ?? "-" }}°C</span>
              </div>
            </div>
          </el-card>
        </div>

        <div class="dash-right">
          <el-card class="nb-conn-card side-conn-card" shadow="never">
            <div class="nb-conn-hd">NoneBot 连接</div>
            <div class="nb-conn-grid">
              <div class="nb-item"><span class="k">驱动监听</span><span class="v mono">{{ driverHostPort }}</span></div>
              <div class="nb-item"><span class="k">运行平台</span><span class="v">{{ platformLabel }}</span></div>
              <div class="nb-item"><span class="k">Python</span><span class="v">{{ pythonLabel }}</span></div>
              <div class="nb-item"><span class="k">已加载插件</span><span class="v">{{ sysData?.plugin_count ?? "-" }}</span></div>
              <div class="nb-item"><span class="k">超管账号数</span><span class="v">{{ sysData?.superuser_count ?? "-" }}</span></div>
            </div>
          </el-card>
          <el-card class="nb-conn-card side-conn-card" shadow="never">
            <div class="nb-conn-hd">AI 连接</div>
            <div class="nb-conn-grid">
              <div class="nb-item"><span class="k">服务地址</span><span class="v">{{ aiCfg?.base_url || "—" }}</span></div>
              <div class="nb-item"><span class="k">健康探测</span><span class="v">{{ aiTest?.health_url || "—" }}</span></div>
              <div class="nb-item"><span class="k">状态</span><span class="v"><el-tag :type="aiTest?.ok ? 'success' : 'danger'" size="small">{{ aiTest?.ok ? "已连接" : "未连接" }}</el-tag></span></div>
              <div class="nb-item"><span class="k">状态码</span><span class="v">{{ aiTest?.status_code ?? "—" }}</span></div>
            </div>
            <div class="mini-actions">
              <el-button type="primary" size="small" :loading="aiTesting" @click="loadAiStatus(false)">刷新 AI 连接</el-button>
            </div>
          </el-card>
        </div>
      </div>
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
  min-height: 100%;
  padding-bottom: 28px;
}
.dash-shell {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 0;
}
.dash-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}
.dash-top-grid {
  display: grid;
  grid-template-columns: 0.80fr 1.45fr 0.75fr;
  gap: 12px;
  align-items: start;
  min-height: 0;
}
.dash-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}
.dash-system {
  display: flex;
  flex-direction: column;
  gap: 11.3px;
  min-height: 0;
}
.dash-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  width: 100%;
  min-height: 0;
}
@media (max-width: 768px) {
  .dash-main {
    max-width: none;
  }
  .dash-top-grid {
    grid-template-columns: 1fr;
    min-height: auto;
  }
}
@media (max-width: 1200px) {
  .dash-top-grid {
    grid-template-columns: 1fr 1fr 0.92fr;
    min-height: auto;
  }
}
.dash-sec { display: flex; flex-direction: column; gap: 10px; }
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
.bot-hero {
  &.bot-hero-vertical {
    min-height: auto;
    .bot-hero-main {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .bot-hero-title strong {
      font-size: 20px;
    }
  }
  .bot-hero-online-title {
    font-size: 14px;
    font-weight: 800;
    color: var(--c-main);
    text-align: center;
  }
  .bot-hero-head {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .bot-hero-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .bot-hero-title {
    display: flex;
    flex-direction: column;
    min-width: 0;
    strong {
      font-size: 18px;
      line-height: 1.2;
      color: var(--el-text-color-primary);
    }
  }
  .bot-hero-sub {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-top: 2px;
  }
  .bot-hero-actions {
    margin-bottom: 10px;
  }
}
.bot-meta-card {
  :deep(.el-card__body) {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  background: var(--el-bg-color);
  border-color: rgba(22, 100, 196, 0.16);
}
.bot-db-card {
  :deep(.el-card__body) {
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    gap: 6px;
  }
}
.bot-hero-db-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.bot-db-kv {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  .k {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .v {
    font-size: 13px;
    font-weight: 700;
    color: var(--c-main);
  }
}
.bot-db-sub {
  width: 100%;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
  word-break: break-word;
}
.bot-inline-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.bot-inline-item {
  flex: 1;
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 8px;
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  .k {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
  .v {
    font-size: 14px;
    font-weight: 700;
    color: var(--c-main);
  }
}
.intro-card {
  border: 1px solid rgba(22, 100, 196, 0.2);
  background: var(--el-bg-color);
  :deep(.el-card__body) {
    padding: 18px 22px;
  }
}
.intro-main {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.intro-text {
  margin-left: 15px ;
  margin-top: 5px ;
  font-size: 14px;
  line-height: 1.65;
}
.intro-text {
  p {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--el-text-color-primary);
  }
  p + p {
    margin-top: 4px;
  }
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
.msg-stats-grid {
  grid-template-columns: 1fr;
}
.msg-stats-grid .nb-item {
  padding: 6px 9px;
  gap: 1px;
}
.msg-stats-card {
  min-height: 88px;
}
.gpu-card {
  min-height: 187px;
}
.side-conn-card {
  :deep(.el-card__body) {
    padding: 8px 8px 10px;
  }
  .nb-conn-grid {
    grid-template-columns: 1fr;
    gap: 4.8px;
  }
  .nb-item {
    padding: 6px 7px;
  }
}
.dash-system {
  min-width: 0;
}
.dash-system .log-card-compact {
  width: 100%;
}
.mini-actions {
  margin-top: 10px;
}
.mono { font-family: ui-monospace, Consolas, monospace; }
.alert-top { width: 100%; }
.tip-card p { margin: 0; color: var(--el-text-color-secondary); display: flex; align-items: center; gap: 8px; }
.v-mid { vertical-align: middle; }
.log-card { border: 1px solid rgba(22, 100, 196, 0.12); :deep(.el-card__header) { padding: 12px 16px; } }
.log-card-compact {
  max-width: 100%;
}
.log-hd { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; width: 100%; }
.log-ctl { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.log-scroll { background: var(--el-fill-color-light); border-radius: 8px; border: 1px solid var(--el-border-color-lighter); }
.log-pre { margin: 0; padding: 10px 12px; font-size: 12px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, Consolas, monospace; }
</style>


