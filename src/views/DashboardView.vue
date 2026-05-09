<script setup lang="ts">
import {
  fetchAiExtensionConfig,
  fetchDbOverview,
  fetchFriendList,
  fetchGroupList,
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
  LogScope,
  NapcatAccountRow,
} from "@/api/pallasTypes";
import { useMergedBotRows } from "@/composables/useMergedBotRows";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { pallasBotContextKey } from "@/types/pallas-bot-context";
import { getBotServiceBaseRef } from "@/utils/botServiceBase";
import PallasLogLines from "@/components/PallasLogLines.vue";
import { getDashboardPollMs } from "@/utils/pallasUiPrefs";
import { protocolDashboardUrl } from "@/utils/pallasProtocolPaths";
import { CircleCloseFilled, Cpu, DataLine, OfficeBuilding, Warning } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const conn = inject(pallasConnectionKey);
const botCtx = inject(pallasBotContextKey, null);
if (!conn) {
  throw new Error("Pallas: missing pallasConnection");
}
const { ok, last, healthTick } = conn;
const consoleVersion = computed(() => last.value?.console?.version || last.value?.pallas_bot || "未知");

const logLines = ref<string[]>([]);
const logN = ref(200);
const logScope = ref<LogScope>("all");
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
const isMobile = ref(false);
const mobileDashSection = ref<"bot" | "system" | "connect">("bot");

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
const baseUrl = import.meta.env.BASE_URL;
const introText = "我是来自米诺斯的祭司帕拉斯，会在罗德岛休息一段时间......";
const introText2 = "虽然这么说，我渴望以美酒和戏剧被招待，更渴望走向战场。";
const gpu = computed(() => sysData.value?.runtime?.gpu ?? { available: false, reason: "", devices: [] });
const hostName = computed(() => {
  const h = sysData.value?.runtime?.hostname;
  return typeof h === "string" && h.trim() ? h.trim() : "—";
});
const uptimeLabel = computed(() => {
  const bt = sysData.value?.runtime?.boot_time;
  const st = sysData.value?.server_time;
  if (typeof bt !== "number" || typeof st !== "number") return "—";
  return formatUptime(st - bt);
});
const dbItems = computed(() => {
  const data = dbOverview.value;
  if (!data) return [] as Array<{ name: string; count: number; module: string }>;
  if ("collections" in data && Array.isArray(data.collections)) {
    return data.collections.map((x: { name: string; document?: string; count: number }) => ({
      name: x.name,
      count: x.count,
      module: typeof x.document === "string" ? x.document : "",
    }));
  }
  if ("tables" in data && Array.isArray(data.tables)) {
    return data.tables.map((x: { table: string; count: number }) => ({
      name: x.table,
      count: x.count,
      module: "",
    }));
  }
  return [];
});
const dbTopThree = computed(() => {
  const rows = dbItems.value.slice();
  rows.sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
  return rows.slice(0, 3);
});
const dbAvgPerBucketLabel = computed(() => {
  if (dbBackend.value === "mongodb") return "平均每集合记录";
  if (dbBackend.value === "postgres") return "平均每表记录";
  return "平均每桶记录";
});
const dbAvgPerBucket = computed(() => {
  const n = dbItems.value.length;
  if (!n) return "—";
  return String(Math.round(dbItemsTotal.value / n));
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

function formatUptime(sec: number): string {
  const s = Math.floor(Math.max(0, sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
}

function gpuDisplayName(name: string): string {
  const trimmed = name.trim();
  const short = trimmed
    .replace(/^NVIDIA\s+/i, "")
    .replace(/\s+NVIDIA\s+/gi, " ")
    .replace(/\s+Laptop\s+GPU$/i, "")
    .trim();
  const base = short || trimmed;
  if (base.length <= 40) return base;
  return `${base.slice(0, 38)}…`;
}

function gpuVramPercent(g: { memory_used: number; memory_total: number }): number {
  const t = Number(g.memory_total);
  if (!t || t <= 0) return 0;
  return Math.min(100, Math.round((Number(g.memory_used) / t) * 100));
}

function gpuVramBarColor(pct: number): string {
  if (pct >= 92) return "var(--el-color-danger)";
  if (pct >= 78) return "var(--el-color-warning)";
  return "var(--el-color-success)";
}

function stopLogPoll() {
  if (logPollTimer) {
    clearInterval(logPollTimer);
    logPollTimer = null;
  }
}

function startLogPoll() {
  stopLogPoll();
  const ms = getDashboardPollMs();
  if (ms <= 0) return;
  logPollTimer = setInterval(() => {
    void loadLogs(true);
  }, ms);
}

function onDashboardPollSettingChanged() {
  if (ok.value === true) startLogPoll();
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
      fetchGroupList(parseInt(selfId, 10), 5000),
    ]);
    botFriendCount.value = friends.friends.length;
    botGroupCount.value = groups.groups.length;
  } catch {
    botFriendCount.value = null;
    botGroupCount.value = null;
  }
}

function syncMobileMode() {
  if (typeof window === "undefined") return;
  isMobile.value = window.innerWidth <= 768;
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
    const d = await fetchLogs(logN.value, logScope.value);
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

watch(logScope, () => {
  if (ok.value === true) {
    void loadLogs(true);
  }
});

onMounted(() => {
  syncMobileMode();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", syncMobileMode, { passive: true });
    window.addEventListener("pallas-dashboard-poll-changed", onDashboardPollSettingChanged);
  }
});

onUnmounted(() => {
  stopLogPoll();
  if (typeof window !== "undefined") {
    window.removeEventListener("resize", syncMobileMode);
    window.removeEventListener("pallas-dashboard-poll-changed", onDashboardPollSettingChanged);
  }
});
</script>

<template>
  <div class="view-page dashboard">
    <div class="dash-shell">
      <div class="dash-main">
    <section class="dash-sec">
      <div
        v-if="isMobile"
        class="mobile-dash-switch"
      >
        <el-segmented
          v-model="mobileDashSection"
          :options="[
            { label: 'Bot', value: 'bot' },
            { label: '系统', value: 'system' },
            { label: '连接', value: 'connect' },
          ]"
          block
        />
      </div>
      <div class="dash-top-grid">
        <div
          v-show="!isMobile || mobileDashSection === 'bot'"
          class="dash-left"
        >
          <el-card
            v-if="selectedDashboardBot"
            class="nb-conn-card bot-hero bot-hero-vertical"
            shadow="never"
          >
            <div class="bot-hero-top">
              <div class="bot-hero-online-title">在线的牛牛（{{ onlineBotCount }}）</div>
            </div>
            <div class="bot-hero-main">
              <div class="bot-hero-head">
                <el-avatar
                  v-if="selectedDashboardBotAvatar"
                  :size="isMobile ? 200 : 76"
                  :src="selectedDashboardBotAvatar"
                />
                <el-avatar
                  v-else
                  :size="isMobile ? 100 : 76"
                >BOT</el-avatar>
                <div class="bot-hero-title">
                  <strong>{{ botNickname(selectedDashboardBot.selfId, selectedDashboardBot.account) }}</strong>
                  <span class="bot-hero-sub mono">账号 {{ selectedDashboardBotQq }}</span>
                </div>
              </div>
              <el-tag
                class="bot-status-badge"
                :type="selectedDashboardBot.online ? 'success' : 'info'"
                size="small"
              >
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
                <span class="k">控制台版本</span>
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
          <el-card
            v-else
            class="nb-conn-card bot-hero bot-hero-vertical bot-hero--empty"
            shadow="never"
          >
            <div class="bot-hero-top">
              <div class="bot-hero-online-title">在线的牛牛（{{ onlineBotCount }}）</div>
            </div>
            <div class="bot-hero-empty-body">
              <p class="bot-hero-empty-title">暂无账号卡片</p>
              <p v-if="ok !== true" class="bot-hero-empty-desc">连接控制台成功后，将显示当前 Bot 头像与账号信息。</p>
              <p v-else-if="!mergedRows.length" class="bot-hero-empty-desc">后端未返回实例：请确认 Bot 已连接，或到「实例」页排查。</p>
              <p v-else class="bot-hero-empty-desc">正在同步所选实例… 若长时间如此，请在侧栏「实例」中确认账号。</p>
              <router-link v-if="ok === true" class="bot-hero-empty-link" :to="{ name: 'accounts' }">前往实例</router-link>
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
            <div v-if="dbItems.length" class="bot-db-kv">
              <span class="k">{{ dbAvgPerBucketLabel }}</span>
              <span class="v">{{ dbAvgPerBucket }}</span>
            </div>
            <div v-if="dbTopThree.length" class="bot-db-top-block bot-db-top-block--compact">
              <div class="bot-db-section-hd">记录量前三</div>
              <div
                v-for="row in dbTopThree"
                :key="row.name"
                class="bot-db-top-row-compact"
              >
                <span class="bot-db-top-line mono">
                  {{ row.name }}<template v-if="row.module"><span class="bot-db-mod-inline"> · {{ row.module }}</span></template>
                </span>
                <span class="bot-db-top-n">{{ row.count }}</span>
              </div>
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
          <div class="dash-col-fill" aria-hidden="true" />
        </div>

        <div
          v-show="!isMobile || mobileDashSection === 'system'"
          class="dash-system"
        >
          <el-card class="intro-card intro-card--dash" shadow="never">
            <div class="intro-main">
              <el-avatar
                  :size="68"
                  :src="`${baseUrl}pallas-priest.png`"
                shape="square"
                class="intro-avatar"
              />
              <div class="intro-text">
                <p class="intro-name">牛牛！</p>
                <p>{{ introText }}</p>
                <p>{{ introText2 }}</p>
              </div>
            </div>
          </el-card>

          <h4 class="dash-h dash-h--after">资源占用</h4>
          <el-row :gutter="[8, 8]" class="stat-row stat-row-dash" justify="space-between">
            <el-col :xs="8" :sm="8" :md="8">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-inner">
                  <el-icon class="stat-ico"><Cpu /></el-icon>
                  <div class="stat-body">
                    <div class="stat-label">CPU 占用</div>
                    <div class="stat-value" :class="metricClass(cpuPercent)">{{ cpuPercent == null ? "-" : `${cpuPercent.toFixed(1)}%` }}</div>
                    <div class="stat-sub">实时占用率</div>
                  </div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="8" :sm="8" :md="8">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-inner">
                  <el-icon class="stat-ico"><DataLine /></el-icon>
                  <div class="stat-body">
                    <div class="stat-label">内存占用</div>
                    <div class="stat-value" :class="metricClass(memPercent)">{{ memPercent == null ? "-" : `${memPercent.toFixed(1)}%` }}</div>
                    <div class="stat-sub">{{ formatBytes(memUsed) }} / {{ formatBytes(memTotal) }}</div>
                  </div>
                </div>
              </el-card>
            </el-col>
            <el-col :xs="8" :sm="8" :md="8">
              <el-card shadow="hover" class="stat-card">
                <div class="stat-inner">
                  <el-icon class="stat-ico"><OfficeBuilding /></el-icon>
                  <div class="stat-body">
                    <div class="stat-label">磁盘占用</div>
                    <div class="stat-value" :class="metricClass(diskPercent)">{{ diskPercent == null ? "-" : `${diskPercent.toFixed(1)}%` }}</div>
                    <div class="stat-sub">{{ formatBytes(diskUsed) }} / {{ formatBytes(diskTotal) }}</div>
                  </div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-card class="nb-conn-card gpu-card gpu-card--compact" shadow="never">
            <div class="nb-conn-hd gpu-dash-hd">GPU 监控</div>
            <div v-if="!gpu.available" class="gpu-dash-off">
              未启用 GPU 监控：{{ gpu.reason || "无可用 GPU 或未安装 pynvml" }}
            </div>
            <div v-else-if="!(gpu.devices || []).length" class="gpu-dash-off">暂无 GPU 设备数据</div>
            <div v-else class="gpu-dash-list">
              <div
                v-for="g in gpu.devices || []"
                :key="g.index"
                class="gpu-dash-device"
              >
                <div class="gpu-dash-device-top">
                  <span class="gpu-dash-title mono" :title="g.name">{{ gpuDisplayName(g.name) }}</span>
                  <el-tag size="small" type="info" effect="plain" class="gpu-dash-idx">#{{ g.index }}</el-tag>
                </div>
                <el-progress
                  :percentage="gpuVramPercent(g)"
                  :stroke-width="4"
                  :show-text="false"
                  :color="gpuVramBarColor(gpuVramPercent(g))"
                />
                <div class="gpu-dash-vram-line">
                  <span>显存 {{ formatBytes(g.memory_used) }} / {{ formatBytes(g.memory_total) }}（{{ gpuVramPercent(g) }}%） · 空闲 {{ formatBytes(g.memory_free) }}</span>
                </div>
                <div class="gpu-dash-inline-meters">
                  <span class="gpu-dash-im-i">GPU <strong :class="metricClass(g.utilization_gpu)">{{ g.utilization_gpu }}%</strong></span>
                  <span class="gpu-dash-im-dot" aria-hidden="true">·</span>
                  <span class="gpu-dash-im-i">显存控制 <strong :class="metricClass(g.utilization_memory)">{{ g.utilization_memory }}%</strong></span>
                  <span class="gpu-dash-im-dot" aria-hidden="true">·</span>
                  <span class="gpu-dash-im-i">
                    温度
                    <strong
                      :class="
                        g.temperature == null ? 'is-unknown' : g.temperature >= 85 ? 'is-crit' : g.temperature >= 75 ? 'is-warn' : 'is-ok'
                      "
                    >{{ g.temperature == null ? "—" : `${g.temperature}°C` }}</strong>
                  </span>
                </div>
              </div>
            </div>
          </el-card>

          <el-card class="log-card log-card-compact log-card--dash-fill" shadow="hover">
            <template #header>
              <div class="log-hd">
                <span>连接日志</span>
                <div class="log-ctl">
                  <el-radio-group v-model="logScope" size="small" :disabled="ok !== true">
                    <el-radio-button label="all">全部</el-radio-button>
                    <el-radio-button label="webui">控制台</el-radio-button>
                    <el-radio-button label="protocol">协议</el-radio-button>
                  </el-radio-group>
                  <el-button type="primary" size="small" :loading="logLoading" :disabled="ok !== true" @click="loadLogs(false)">刷新</el-button>
                </div>
              </div>
            </template>
            <el-scrollbar ref="logScrollRef" v-loading="logLoading" class="log-scroll log-scroll--dash" @scroll="onLogScroll">
              <PallasLogLines :lines="logLines" :empty-text="ok === true ? '（暂无输出）' : '—'" />
            </el-scrollbar>
          </el-card>
          <div class="dash-col-fill" aria-hidden="true" />
        </div>

        <div
          v-show="!isMobile || mobileDashSection === 'connect'"
          class="dash-right"
        >
          <el-card class="nb-conn-card side-conn-card side-conn-card--nb" shadow="never">
            <div class="nb-conn-hd">NoneBot</div>
            <div class="nb-conn-grid nb-conn-grid--nb-compact">
              <div class="nb-item"><span class="k">主机名</span><span class="v mono" :title="hostName">{{ hostName }}</span></div>
              <div class="nb-item"><span class="k">运行时间</span><span class="v">{{ uptimeLabel }}</span></div>
              <div class="nb-item nb-item--full">
                <span class="k">系统平台</span><span class="v platform-line" :title="platformLabel">{{ platformLabel }}</span>
              </div>
              <div class="nb-item"><span class="k">Python</span><span class="v mono">{{ pythonLabel }}</span></div>
              <div class="nb-item"><span class="k">已加载插件</span><span class="v">{{ sysData?.plugin_count ?? "-" }}</span></div>
              <div class="nb-item"><span class="k">驱动监听</span><span class="v mono">{{ driverHostPort }}</span></div>
              <div class="nb-item"><span class="k">超管</span><span class="v">{{ sysData?.superuser_count ?? "-" }}</span></div>
            </div>
          </el-card>
          <el-card class="nb-conn-card side-conn-card side-conn-card--ai" shadow="never">
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
          <div class="dash-col-fill" aria-hidden="true" />
        </div>
      </div>
    </section>

    </div>
    </div>

    <div v-if="ok === false" class="pallas-dash-banner pallas-dash-banner--error" role="alert">
      <div class="pallas-dash-banner__icon" aria-hidden="true">
        <el-icon><CircleCloseFilled /></el-icon>
      </div>
      <div class="pallas-dash-banner__body">
        <p class="pallas-dash-banner__title">无法连接控制台后端</p>
        <p class="pallas-dash-banner__desc">
          健康检查 <code class="pallas-code-inline">GET /pallas/api/health</code> 失败。请确认 Pallas-Bot 已运行且已加载
          <code class="pallas-code-inline">pallas_webui</code> 插件；若使用
          <code class="pallas-code-inline">npm run dev</code>，请核对 Vite 代理与
          <code class="pallas-code-inline">.env</code> 中 <code class="pallas-code-inline">PORT</code> 是否与后端一致。
        </p>
      </div>
    </div>

    <div v-if="ok === null" class="pallas-dash-banner pallas-dash-banner--pending" role="status">
      <div class="pallas-dash-banner__icon pallas-dash-banner__icon--muted" aria-hidden="true">
        <el-icon><Warning /></el-icon>
      </div>
      <div class="pallas-dash-banner__body">
        <p class="pallas-dash-banner__title pallas-dash-banner__title--solo">正在连接控制台…</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.view-page.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: 100%;
  flex: 1;
  box-sizing: border-box;
  padding-bottom: 20px;
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
  gap: 12px;
  min-height: 0;
}
.dash-top-grid {
  display: grid;
  grid-template-columns: minmax(244px, 0.82fr) minmax(332px, 1.34fr) minmax(232px, 0.76fr);
  gap: 10px;
  align-items: stretch;
  justify-items: stretch;
  min-height: 0;
}
.dash-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  align-self: stretch;
}
.dash-system {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  align-self: stretch;
}
.dash-right {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  width: 100%;
  min-height: 0;
  align-self: stretch;
}
.dash-col-fill {
  display: none;
}
@media (min-width: 769px) {
  /* 填满主视区高度：中间列日志区随视窗伸展，左右列末卡吸收余量 */
  .view-page.dashboard {
    flex: 1;
    min-height: 0;
    height: 100%;
    padding-bottom: 8px;
    gap: 12px;
  }
  .dash-shell {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .dash-main {
    flex: 1;
    min-height: 0;
  }
  .dash-sec {
    flex: 1;
    min-height: 0;
  }
  .dash-top-grid {
    flex: 1;
    min-height: 0;
  }
  .dash-left .bot-hero,
  .dash-left .bot-db-card {
    flex-shrink: 0;
  }
  .dash-system .intro-card--dash,
  .dash-system .dash-h--after,
  .dash-system .stat-row-dash {
    flex-shrink: 0;
  }
  /* 列尾占位：真实 DOM + flex-basis 0，比 ::after 在各浏览器里更稳定 */
  /* 列尾占位改为由「末张卡片」伸展填满行高，避免短列底部大块留白 */
  .dash-col-fill {
    display: block;
    flex: 0 0 0;
    height: 0;
    min-height: 0;
    overflow: hidden;
    width: 100%;
  }
  .dash-system > .intro-card,
  .dash-system > h4.dash-h,
  .dash-system > .stat-row {
    flex-shrink: 0;
  }
  .dash-left .msg-stats-card,
  .dash-right .side-conn-card--ai {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .dash-system .gpu-card {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
  }
  .dash-left .msg-stats-card :deep(.el-card__body),
  .dash-right .side-conn-card--ai :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .dash-system .gpu-card :deep(.el-card__body) {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
  }
  .dash-right .side-conn-card--ai .mini-actions {
    margin-top: auto;
  }
  .dash-system .log-card--dash-fill {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    :deep(.el-card) {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    :deep(.el-card__header) {
      flex-shrink: 0;
      padding: 9px 13px;
    }
    :deep(.el-card__body) {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding-top: 9px;
      padding-bottom: 11px;
    }
  }
  /* 覆盖文末 .log-scroll--dash 的 max-height:170px，否则滚动区只剩半块卡片高 */
  .dash-system .log-scroll--dash {
    flex: 1 1 auto;
    flex-basis: 120px;
    min-height: 0;
    max-height: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .dash-system .log-scroll--dash :deep(.el-scrollbar) {
    flex: 1 1 auto;
    min-height: 0;
    height: auto;
  }
  .dash-system .log-scroll--dash :deep(.el-scrollbar__wrap) {
    max-height: none !important;
    height: 100%;
  }
}
.mobile-dash-switch {
  display: none;
}
@media (max-width: 768px) {
  .mobile-dash-switch {
    display: block;
    margin-bottom: 0;
  }
  .dash-main {
    max-width: none;
    gap: 10px;
  }
  .dash-top-grid {
    display: block;
    min-height: auto;
  }
  .view-page.dashboard {
    gap: 8px;
    padding-bottom: 8px;
    height: auto;
    flex: none;
  }
  .dash-left,
  .dash-system,
  .dash-right {
    width: 100%;
    gap: 8px;
    margin-bottom: 10px;
    height: auto;
  }
  .dash-col-fill {
    display: none !important;
  }
  .dash-system .log-card--dash-fill {
    flex: none !important;
    min-height: 0 !important;
    :deep(.el-card__body) {
      display: block !important;
    }
  }
  .dash-system .log-scroll--dash {
    max-height: 170px;
  }
  .dash-system .log-scroll--dash :deep(.el-scrollbar__wrap) {
    max-height: 170px !important;
  }
  .nb-conn-card :deep(.el-card__body),
  .intro-card :deep(.el-card__body),
  .side-conn-card :deep(.el-card__body) {
    padding: 8px;
  }
  .nb-conn-card {
    border-color: color-mix(in srgb, var(--pallas-accent) 20%, var(--el-border-color-lighter));
    box-shadow: 0 2px 8px rgba(13, 52, 106, 0.1);
  }
  .intro-main {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
  }
  .intro-text p {
    line-height: 1.45;
  }
  .bot-hero .bot-hero-main {
    align-items: center;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }
  .bot-hero .bot-hero-head {
    width: 100%;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }
  .bot-hero .bot-hero-title {
    align-items: center;
    text-align: center;
  }
  .bot-hero .bot-hero-title strong {
    font-size: 16px;
    line-height: 1.22;
    word-break: break-word;
  }
  .bot-hero .bot-hero-sub {
    margin-top: 2px;
    font-size: 11px;
  }
  .bot-status-badge {
    align-self: center;
    min-width: 64px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    border-radius: 999px;
  }
  .bot-inline-stats {
    flex-direction: row;
    align-items: stretch;
    gap: 6px;
  }
  .bot-inline-item {
    padding: 4px 6px;
  }
  .bot-inline-item .k {
    font-size: 11px;
  }
  .bot-inline-item .v {
    font-size: 13px;
  }
  .stat-card :deep(.el-card__body) {
    padding: 10px 8px 12px;
  }
  .stat-card .stat-inner {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 0;
    gap: 6px;
    padding: 4px 0;
  }
  .stat-card .stat-body {
    align-items: center;
    width: 100%;
  }
  .stat-card .stat-ico {
    font-size: 1.45rem;
    margin-bottom: 0;
  }
  .stat-card .stat-label {
    font-size: 11px;
    line-height: 1.2;
  }
  .stat-card .stat-value {
    font-size: 0.98rem;
    line-height: 1.15;
  }
  .stat-card .stat-sub {
    font-size: 10px;
    line-height: 1.25;
    max-width: 100%;
    hyphens: auto;
  }
  .log-scroll :deep(.pallas-log-lines) {
    padding: 7px 8px;
    font-size: 11px;
    line-height: 1.35;
  }
  .nb-conn-grid {
    grid-template-columns: 1fr;
  }
  .nb-conn-hd {
    font-size: 12px;
    margin-bottom: 6px;
  }
  .nb-item {
    padding: 6px 7px;
    gap: 3px;
  }
  .nb-item .k {
    font-size: 11px;
  }
  .nb-item .v {
    font-size: 12px;
  }
  .bot-hero-db-title {
    font-size: 12px;
  }
  .bot-db-kv .k {
    font-size: 11px;
  }
  .bot-db-kv .v {
    font-size: 12px;
  }
  .bot-db-sub {
    font-size: 11px;
    line-height: 1.35;
  }
  .bot-hero-actions {
    margin-bottom: 6px;
  }
  .bot-hero-actions :deep(.el-link) {
    font-size: 12px;
  }
  .mini-actions :deep(.el-button) {
    font-size: 12px;
    padding: 5px 9px;
  }
  .msg-stats-card,
  .gpu-card {
    min-height: 0;
  }
}
/* 过窄屏：三列过挤，改回单列横排信息条 */
@media (max-width: 360px) {
  .stat-row :deep(.el-col) {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  .stat-card :deep(.el-card__body) {
    padding: 10px 12px;
  }
  .stat-card .stat-inner {
    flex-direction: row;
    align-items: center;
    text-align: left;
    min-height: 60px;
    padding: 0;
    gap: 10px;
  }
  .stat-card .stat-body {
    align-items: flex-start;
  }
  .stat-card .stat-ico {
    font-size: 1.5rem;
  }
  .stat-card .stat-label {
    font-size: 12px;
  }
  .stat-card .stat-value {
    font-size: 1rem;
  }
  .stat-card .stat-sub {
    font-size: 11px;
  }
}
@media (max-width: 1200px) {
  .dash-top-grid {
    grid-template-columns: 1fr 1.18fr 0.9fr;
    gap: 11px;
    min-height: auto;
  }
}

@media (min-width: 769px) and (max-width: 1200px) {
  .stat-row-dash :deep(.el-col) {
    flex: 0 0 100% !important;
    max-width: 100% !important;
  }
  .stat-row-dash :deep(.el-col:not(:last-child)) {
    margin-bottom: 4px;
  }
  .stat-card .stat-inner {
    flex-direction: row;
    align-items: center;
    text-align: left;
    min-height: 76px;
    padding: 4px 0;
  }
  .stat-card .stat-body {
    align-items: flex-start;
  }
}
.dash-sec { display: flex; flex-direction: column; gap: 10px; }
.dash-h { margin: 0; font-size: 14px; font-weight: 600; color: var(--c-main); letter-spacing: 0.03em; }
.dash-h--after { margin-top: 0; }
.bot-hero-top {
  margin-bottom: 6px;
}
.stat-row {
  width: 100%;
}
.stat-row :deep(.el-col) {
  display: flex;
}
.stat-card {
  width: 100%;
  height: 100%;
  border-radius: var(--pallas-radius-md);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 16%, var(--el-border-color-lighter));
  border-left: 3px solid var(--c-main);
  box-shadow: var(--pallas-elev-1);
  :deep(.el-card__body) {
    padding: 14px 16px;
    background: linear-gradient(165deg, color-mix(in srgb, var(--el-bg-color) 94%, var(--pallas-accent)) 0%, var(--el-bg-color) 100%);
  }
  .stat-inner {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 84px;
  }
  .stat-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .stat-ico { font-size: 1.8rem; color: var(--c-main); flex-shrink: 0; }
  .stat-label { color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 0; }
  .stat-value { font-size: 1.05rem; font-weight: 700; line-height: 1.2; }
  .stat-value.is-ok { color: var(--el-color-success); }
  .stat-value.is-warn { color: var(--el-color-warning); }
  .stat-value.is-crit { color: var(--el-color-danger); }
  .stat-value.is-unknown { color: var(--el-text-color-secondary); }
  .stat-sub {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.3;
    word-break: break-word;
  }
}
@media (min-width: 769px) {
  .dash-system .stat-row .stat-card :deep(.el-card__body) {
    padding: 10px 11px;
  }
  .dash-system .stat-row .stat-card .stat-inner {
    min-height: 76px;
    gap: 10px;
  }
  .dash-system .stat-row .stat-card .stat-ico {
    font-size: 1.55rem;
  }
  .dash-left .nb-conn-hd,
  .dash-right .nb-conn-hd {
    margin-bottom: 6px;
  }
}
.nb-conn-card {
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 12%, var(--el-border-color-lighter));
  background: var(--el-bg-color);
  box-shadow: 0 3px 10px color-mix(in srgb, var(--pallas-accent) 8%, rgba(0, 0, 0, 0.06));
}
.bot-hero {
  &.bot-hero-vertical {
    min-height: auto;
    .bot-hero-main {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
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
.bot-hero--empty {
  min-height: 168px;
  :deep(.el-card__body) {
    padding-top: 12px;
  }
}
.bot-hero-empty-body {
  padding: 12px 6px 16px;
  text-align: center;
}
.bot-hero-empty-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.bot-hero-empty-desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--el-text-color-secondary);
}
.bot-hero-empty-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  text-decoration: none;
}
.bot-hero-empty-link:hover {
  opacity: 0.88;
}
.bot-meta-card {
  :deep(.el-card__body) {
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  background: var(--el-bg-color);
  border-color: color-mix(in srgb, var(--pallas-accent) 16%, var(--el-border-color-lighter));
}
.bot-db-card {
  :deep(.el-card__body) {
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
    gap: 4px;
    padding: 11px 13px;
  }
}
.bot-hero-db-title {
  font-size: 13px;
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
.bot-db-top-block {
  width: 100%;
  margin-top: 2px;
  padding-top: 5px;
  border-top: 1px solid var(--el-border-color-lighter);
}
.bot-db-top-block--compact .bot-db-section-hd {
  margin-bottom: 3px;
}
.bot-db-section-hd {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.bot-db-top-row-compact {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 2px;
  font-size: 11px;
  line-height: 1.28;
}
.bot-db-top-row-compact:last-child {
  margin-bottom: 0;
}
.bot-db-top-line {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}
.bot-db-mod-inline {
  font-weight: 400;
  color: var(--el-text-color-secondary);
}
.bot-db-top-block--compact .bot-db-top-n {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--c-main);
}
.bot-inline-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.bot-inline-item {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 14%, var(--el-border-color-lighter));
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
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 20%, var(--el-border-color-lighter));
  background: var(--el-bg-color);
  :deep(.el-card__body) {
    padding: 18px 22px;
  }
}
.intro-card--dash {
  border-color: var(--el-border-color-lighter);
  box-shadow: none;
  background: color-mix(in srgb, var(--el-bg-color) 96%, var(--pallas-accent));
  :deep(.el-card__body) {
    padding: 13px 15px;
  }
  .intro-main {
    gap: 14px;
  }
  .intro-text {
    gap: 3px;
  }
  .intro-text .intro-name {
    margin: 0;
    font-size: 16px;
  }
  .intro-text p {
    font-size: 12px;
    line-height: 1.5;
  }
}
.intro-avatar {
  flex-shrink: 0;
  background: color-mix(in srgb, var(--pallas-accent) 10%, transparent) !important;
}
.platform-line {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.side-conn-card--nb .nb-conn-hd {
  margin-bottom: 4px;
}
.side-conn-card--nb .nb-conn-grid--nb-compact {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 6px;
}
.side-conn-card--nb .nb-conn-grid--nb-compact .nb-item--full {
  grid-column: 1 / -1;
}
.side-conn-card--nb .nb-conn-grid--nb-compact .nb-item {
  padding: 5px 6px;
  gap: 2px;
}
.side-conn-card--nb .nb-conn-grid--nb-compact .nb-item .k {
  font-size: 11px;
}
.side-conn-card--nb .nb-conn-grid--nb-compact .nb-item .v {
  font-size: 12px;
  line-height: 1.35;
}
.pallas-dash-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  width: 100%;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}
.pallas-dash-banner--error {
  border-color: color-mix(in srgb, var(--el-color-danger) 35%, var(--el-border-color-lighter));
  background: color-mix(in srgb, var(--el-color-danger) 6%, var(--el-bg-color));
}
.pallas-dash-banner--pending {
  border-color: var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-color-warning) 5%, var(--el-bg-color));
}
.pallas-dash-banner__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #fff;
  background: linear-gradient(145deg, var(--el-color-danger), color-mix(in srgb, var(--el-color-danger) 75%, #000));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--el-color-danger) 35%, transparent);
}
.pallas-dash-banner__icon--muted {
  background: var(--el-fill-color-dark);
  color: var(--el-color-warning);
  box-shadow: none;
}
.pallas-dash-banner--pending .pallas-dash-banner__icon--muted {
  background: color-mix(in srgb, var(--el-color-warning) 15%, var(--el-fill-color-blank));
  color: var(--el-color-warning);
}
.pallas-dash-banner__body {
  flex: 1;
  min-width: 0;
}
.pallas-dash-banner__title {
  margin: 0 0 8px;
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--el-text-color-primary);
}
.pallas-dash-banner__title--solo {
  margin: 0;
  line-height: 1.5;
}
.pallas-dash-banner__desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.65;
  font-weight: 450;
  color: var(--el-text-color-regular);
}
.pallas-code-inline {
  font-family: ui-monospace, var(--pallas-font-mono-em, monospace);
  font-size: 0.84em;
  font-weight: 500;
  padding: 0.12em 0.35em;
  border-radius: 4px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
}
html.dark .pallas-dash-banner--error {
  background: color-mix(in srgb, var(--el-color-danger) 12%, var(--el-bg-color));
}
html.dark .pallas-dash-banner__icon {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}
.intro-main {
  display: flex;
  gap: 16px;
  align-items: center;
}
.intro-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  .intro-name {
    margin: 0 0 2px;
    font-size: 16px;
    font-weight: 700;
    color: var(--c-main);
    line-height: 1.2;
  }
  p {
    margin: 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--el-text-color-secondary);
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
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 14%, var(--el-border-color-lighter));
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
  min-height: 72px;
}
.gpu-card {
  min-height: 0;
}
.gpu-card--compact .gpu-dash-hd {
  margin-bottom: 4px;
  font-size: 12px;
}
.gpu-dash-off {
  font-size: 11px;
  line-height: 1.45;
  color: var(--el-text-color-secondary);
}
.gpu-dash-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.gpu-dash-device {
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 12%, var(--el-border-color-lighter));
  border-radius: 6px;
  padding: 5px 7px;
  background: color-mix(in srgb, var(--el-fill-color-light) 88%, var(--el-bg-color));
}
.gpu-dash-device-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 3px;
  min-width: 0;
}
.gpu-dash-title {
  font-size: 11px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.gpu-dash-idx {
  flex-shrink: 0;
}
.gpu-card :deep(.el-progress) {
  display: block;
  margin-bottom: 0;
  line-height: 1;
}
.gpu-dash-vram-line {
  margin-top: 3px;
  margin-bottom: 2px;
  font-size: 10px;
  color: var(--el-text-color-secondary);
  line-height: 1.35;
  word-break: break-word;
}
.gpu-dash-inline-meters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 6px;
  font-size: 10px;
  line-height: 1.3;
  color: var(--el-text-color-secondary);
}
.gpu-dash-inline-meters strong {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--c-main);
}
.gpu-dash-inline-meters strong.is-ok {
  color: var(--el-color-success);
}
.gpu-dash-inline-meters strong.is-warn {
  color: var(--el-color-warning);
}
.gpu-dash-inline-meters strong.is-crit {
  color: var(--el-color-danger);
}
.gpu-dash-inline-meters strong.is-unknown {
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.gpu-dash-im-dot {
  opacity: 0.45;
  user-select: none;
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
  margin-top: 8px;
}
.mono { font-family: ui-monospace, Consolas, monospace; }
.v-mid { vertical-align: middle; }
.log-card {
  border: 1px solid color-mix(in srgb, var(--pallas-accent) 12%, var(--el-border-color-lighter));
  :deep(.el-card__header) {
    padding: 12px 16px;
  }
}
.log-card-compact {
  max-width: 100%;
}
.log-hd { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; width: 100%; }
.log-ctl { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.log-scroll { background: var(--el-fill-color-light); border-radius: 8px; border: 1px solid var(--el-border-color-lighter); }
.log-scroll--dash {
  max-height: 170px;
}
</style>
