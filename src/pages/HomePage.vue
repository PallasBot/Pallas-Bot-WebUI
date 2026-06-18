<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from "vue";
import type { RouteLocationRaw } from "vue-router";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import {
  fetchBots,
  fetchBotUpdateCheck,
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchCommunityStats,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchConsoleDailyStats,
  fetchPlugins,
  fetchRequestOverview,
  fetchSystem,
  fetchUpdateCheck,
  peekBotsCache,
  peekInstancesCache,
  peekPluginsCache,
  refreshInstancesCatalogGlobal,
} from "@/api/consoleApi";
import type {
  BotRow,
  BotUpdateCheckData,
  FriendListData,
  GroupListData,
  InstancesData,
  CommunityStatsData,
  MessageStatsData,
  ConsoleDailyStatsData,
  PluginRow,
  PluginRunStatsData,
  RequestOverviewData,
  SystemData,
  UpdateCheckData,
} from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import HomeLazyReveal from "@/components/HomeLazyReveal.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts, toggleFavoriteBot } from "@/utils/botFavorites";
import { qqAvatarUrl } from "@/utils/botDisplay";
import {
  cachePutFriendGroupLists,
  cachePutRequestOverview,
  cacheTryGetFriendGroupLists,
  cacheTryGetRequestOverview,
} from "@/utils/consoleSocialCache";
import {
  consoleResourceVersionLabel,
  displayVersionWithoutSha,
  pallasBotVersionLabel,
} from "@/utils/versionDisplay";
import { patchConsoleMeta, consoleMetaBotUpdate, consoleMetaHealth, consoleMetaWebUpdate } from "@/state/consoleMeta";
import { instancesCatalogEpoch } from "@/utils/catalogSync";

/** 总览首屏当前选中的数据库 Bot 账号（刷新后恢复） */
const HOME_SELECTED_ACCOUNT_KEY = "pallas_home_selected_account_v1";
/** 系统性能 runtime 轮询间隔（毫秒） */
const HOME_SYSTEM_POLL_MS = 5000;
/** 消息吞吐（累计）等 message-stats 轮询间隔 */
const HOME_THROUGHPUT_POLL_MS = 5 * 60 * 1000;

function readSavedHomeAccount(): number | null {
  try {
    const v = localStorage.getItem(HOME_SELECTED_ACCOUNT_KEY);
    if (v == null || v === "") return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

function writeSavedHomeAccount(acc: number | null) {
  try {
    if (acc == null) localStorage.removeItem(HOME_SELECTED_ACCOUNT_KEY);
    else localStorage.setItem(HOME_SELECTED_ACCOUNT_KEY, String(Math.floor(acc)));
  } catch {
    /* ignore */
  }
}

const err = ref("");
const health = ref<HealthResponse | null>(null);
const botUpdateCheck = ref<BotUpdateCheckData | null>(null);
const webUpdateCheck = ref<UpdateCheckData | null>(null);
const system = ref<SystemData | null>(null);
const communityStats = ref<CommunityStatsData | null>(null);
const stats = ref<MessageStatsData | null>(null);
const statsScoped = ref<MessageStatsData | null>(null);
const pluginRunStats = ref<PluginRunStatsData | null>(null);
const pluginRunStatsScoped = ref<PluginRunStatsData | null>(null);
const consoleDailyStatsScoped = ref<ConsoleDailyStatsData | null>(null);
const botCount = ref(0);
const bots = ref<BotRow[]>([]);
{
  const warmBots = peekBotsCache();
  if (warmBots?.length) {
    bots.value = warmBots;
    botCount.value = warmBots.length;
  }
}
const instances = ref<InstancesData | null>(null);
{
  const warmInst = peekInstancesCache();
  if (warmInst) instances.value = warmInst;
}
const selectedAccount = ref<number | null>(null);
const friendSnap = ref<FriendListData | null>(null);
const groupSnap = ref<GroupListData | null>(null);
const requestOverviewSnap = ref<RequestOverviewData | null>(null);
const socialBusy = ref(false);
/** 账号图表/按 Bot 统计拉取中（不含好友群列表） */
const accountDetailBusy = ref(false);
/** 首屏主内容区：首包 API 返回后即展示，不再等待按账号拉取的社交/统计 */
const pageReady = ref(false);
/** 概况接口（健康/系统/实例等）拉取中；用于刷新按钮与轻提示 */
const overviewBusy = ref(false);
/** 首屏次要接口（统计/社区/分片等）拉取中 */
const homeDeferredBusy = ref(false);

const accountSocialPending = computed(() => {
  if (selectedAccount.value == null) return false;
  if (socialBusy.value) return true;
  return accountDetailBusy.value && statsScoped.value == null;
});
const versionMetaPending = computed(() => homeDeferredBusy.value);

const pluginsList = ref<PluginRow[]>([]);
{
  const warmPl = peekPluginsCache();
  if (warmPl?.length) pluginsList.value = warmPl;
}

const accountPickerOpen = ref(false);
const accountPickerRoot = ref<HTMLElement | null>(null);

function onAccountPickerDocDown(ev: MouseEvent) {
  if (!accountPickerOpen.value) return;
  const root = accountPickerRoot.value;
  const t = ev.target;
  if (!(t instanceof Node)) return;
  if (root?.contains(t)) return;
  accountPickerOpen.value = false;
}

watch(accountPickerOpen, (open) => {
  if (open) {
    nextTick(() => {
      requestAnimationFrame(() => {
        document.addEventListener("mousedown", onAccountPickerDocDown, true);
      });
    });
  } else {
    document.removeEventListener("mousedown", onAccountPickerDocDown, true);
  }
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onAccountPickerDocDown, true);
});

function toggleAccountPicker(ev: MouseEvent) {
  ev.stopPropagation();
  if (sortedDbBots.value.length <= 1) return;
  accountPickerOpen.value = !accountPickerOpen.value;
}

function pickAccountFromList(account: number) {
  selectedAccount.value = account;
  writeSavedHomeAccount(account);
  accountPickerOpen.value = false;
}

const runtime = computed(() => system.value?.runtime ?? null);
function fmtBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  const decimals = u === 0 ? 0 : u >= 3 ? 2 : 1;
  return `${v.toFixed(decimals)} ${units[u]}`;
}

function uptimeDisplayParts(boot: number | null | undefined): { value: string; unit: string; sub?: string } | null {
  if (boot == null) return null;
  const nowSec = Date.now() / 1000;
  let s = Math.max(0, nowSec - boot);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  if (d > 0) {
    return { value: String(d), unit: "天", sub: h > 0 ? `${h} 小时` : undefined };
  }
  if (h > 0) {
    return { value: String(h), unit: "小时", sub: m > 0 ? `${m} 分` : undefined };
  }
  return { value: String(m), unit: "分" };
}

function osFamilyLabel(platform: string | null | undefined): string {
  if (!platform) return "—";
  const p = platform.toLowerCase();
  if (p.includes("windows") || p.startsWith("win")) return "Windows";
  if (p.includes("linux")) return "Linux";
  if (p.includes("darwin") || p.includes("mac")) return "macOS";
  const head = platform.split("-")[0]?.trim();
  return head || platform;
}

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

const perfSampled = computed(() => {
  const r = runtime.value;
  if (!r) return false;
  const gpuOk = Boolean(r.gpu?.available && (r.gpu.devices?.length ?? 0) > 0);
  return (
    r.cpu_percent != null ||
    (Array.isArray(r.cpu_per_core) && r.cpu_per_core.length > 0) ||
    (Array.isArray(r.cpu_load_avg) && r.cpu_load_avg.length >= 3) ||
    r.memory?.percent != null ||
    (r.memory?.available != null && r.memory?.available >= 0) ||
    (r.memory?.used != null && r.memory?.total != null) ||
    r.disk?.percent != null ||
    (r.disk?.used != null && r.disk?.total != null) ||
    r.boot_time != null ||
    gpuOk
  );
});

const cpuDisplay = computed(() => pct(runtime.value?.cpu_percent ?? null));
const memDisplay = computed(() => {
  const m = runtime.value?.memory;
  if (m?.percent != null) return pct(m.percent, 2);
  if (m?.used != null && m?.total != null && m.total > 0) return pct((m.used / m.total) * 100, 2);
  return "—";
});
const memHint = computed(() => {
  const m = runtime.value?.memory;
  if (!m) return undefined;
  const parts: string[] = [];
  if (m.used != null && m.total != null && m.total > 0) {
    parts.push(`已用 ${fmtBytes(m.used)} / 共 ${fmtBytes(m.total)}`);
  } else if (m.total != null && m.total > 0) {
    parts.push(`共 ${fmtBytes(m.total)}`);
  }
  if (m.available != null) {
    parts.push(`可用 ${fmtBytes(m.available)}`);
  } else if (m.free != null && m.free > 0) {
    parts.push(`空闲 ${fmtBytes(m.free)}`);
  }
  const sub: string[] = [];
  if (m.cached != null && m.cached > 0) {
    sub.push(`缓存 ${fmtBytes(m.cached)}`);
  }
  if (m.buffers != null && m.buffers > 0) {
    sub.push(`缓冲 ${fmtBytes(m.buffers)}`);
  }
  if (m.shared != null && m.shared > 0) {
    sub.push(`共享 ${fmtBytes(m.shared)}`);
  }
  if (m.wired != null && m.wired > 0) {
    sub.push(`常驻 ${fmtBytes(m.wired)}`);
  }
  if (sub.length) {
    parts.push(sub.join(" · "));
  }
  return parts.length ? parts.join(" · ") : undefined;
});
const diskDisplay = computed(() => {
  const d = runtime.value?.disk;
  if (d?.percent != null) return pct(d.percent);
  if (d?.used != null && d?.total != null && d.total > 0) return pct((d.used / d.total) * 100);
  return "—";
});
const diskHint = computed(() => {
  const d = runtime.value?.disk;
  if (!d) return undefined;
  return `${fmtBytes(d.used)} / ${fmtBytes(d.total)} · 可用 ${fmtBytes(d.free)}`;
});
const uptimeParts = computed(() => uptimeDisplayParts(runtime.value?.boot_time ?? null));
const osFamilyDisplay = computed(() => osFamilyLabel(runtime.value?.platform));
const hostnameDisplay = computed(() => runtime.value?.hostname?.trim() || "—");
const pythonVersionDisplay = computed(() => runtime.value?.python?.trim() || "—");

const nonebotListenDisplay = computed(() => {
  const d = system.value?.nonebot2_driver;
  if (!d?.host && d?.port == null) return "—";
  const host = (d.host ?? "0.0.0.0").trim() || "0.0.0.0";
  const port = d.port ?? "—";
  return `${host}:${port}`;
});

const nonebot2VersionDisplay = computed(() => {
  const s = (health.value?.nonebot2 ?? "").trim();
  const x = displayVersionWithoutSha(s);
  return x || s || "—";
});

const pallasBotVersionDisplay = computed(() =>
  pallasBotVersionLabel(health.value, botUpdateCheck.value),
);

const botDevelopmentBuildTitle = computed(() => {
  const b = botUpdateCheck.value;
  if (!b?.development_build) return "";
  const latest = (b.latest_tag || "").trim();
  const commit = (b.current_commit || "").trim();
  const parts = ["当前为开发构建，代码超前于最新发行版。"];
  if (latest) parts.push(`最新发行：${latest}。`);
  if (commit) parts.push(`commit：${commit}。`);
  return parts.join("");
});

const consoleResourceVersionDisplay = computed(() =>
  consoleResourceVersionLabel(health.value, webUpdateCheck.value, {
    webuiBuildVersion: __WEBUI_VERSION__,
  }),
);

/** 待同意跳转：带上当前选中账号，好友与群页自动选中对应 Bot */
const friendsGroupsFriendPendingTo = computed(() => {
  const acc = selectedAccount.value;
  const q = acc != null ? { self_id: String(acc) } : {};
  return { path: "/friends-groups", query: q, hash: "#friends-groups-friend-requests" };
});

const friendsGroupsGroupPendingTo = computed(() => {
  const acc = selectedAccount.value;
  const q = acc != null ? { self_id: String(acc) } : {};
  return { path: "/friends-groups", query: q, hash: "#friends-groups-group-requests" };
});

const versionServerTimeStr = computed(() => {
  const t = system.value?.server_time;
  if (t == null) return "—";
  return new Date(t * 1000).toLocaleString();
});

const accountAdapterDisplay = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return "—";
  const raw = instances.value?.bot_profiles?.[String(acc)]?.adapter;
  const ad = raw != null ? String(raw).trim() : "";
  return ad || "—";
});

function barPct(
  direct: number | null | undefined,
  used: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (direct != null && !Number.isNaN(direct)) return Math.min(100, Math.max(0, direct));
  if (used != null && total != null && total > 0) return Math.min(100, Math.max(0, (used / total) * 100));
  return null;
}

const cpuBarPct = computed(() => barPct(runtime.value?.cpu_percent ?? null, null, null));

/** 各逻辑核心占用 0–100，供迷你柱可视化 */
const cpuPerCorePercents = computed((): number[] => {
  const raw = runtime.value?.cpu_per_core;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((x) => {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  });
});

const cpuFootHint = computed(() => {
  const chunks: string[] = [];
  const la = runtime.value?.cpu_load_avg;
  if (Array.isArray(la) && la.length >= 3) {
    const a = typeof la[0] === "number" ? la[0] : Number(la[0]);
    const b = typeof la[1] === "number" ? la[1] : Number(la[1]);
    const c = typeof la[2] === "number" ? la[2] : Number(la[2]);
    if ([a, b, c].every((x) => Number.isFinite(x))) {
      chunks.push(`负载 ${a.toFixed(2)} / ${b.toFixed(2)} / ${c.toFixed(2)}`);
    }
  }
  const n = cpuPerCorePercents.value.length;
  if (n > 0) {
    chunks.push(`${n} 逻辑核心 · 均值`);
  }
  if (!chunks.length) return undefined;
  return chunks.join(" · ");
});
const memBarPct = computed(() =>
  barPct(runtime.value?.memory?.percent ?? null, runtime.value?.memory?.used ?? null, runtime.value?.memory?.total ?? null),
);
const diskBarPct = computed(() =>
  barPct(runtime.value?.disk?.percent ?? null, runtime.value?.disk?.used ?? null, runtime.value?.disk?.total ?? null),
);

const gpuDevices = computed(() => {
  const g = runtime.value?.gpu;
  if (!g?.available) return [];
  return g.devices ?? [];
});

function gpuUtilBarPct(util: number | null | undefined): number | null {
  return barPct(util ?? null, null, null);
}

function gpuMemBarPct(used: number, total: number): number | null {
  return barPct(null, used, total);
}

function gpuNameShort(name: string, maxLen = 28): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function tempDisplay(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return "—";
  return `${Math.round(c)}°C`;
}

function dbNick(account: number): string {
  return instances.value?.bot_profiles?.[String(account)]?.nickname?.trim() || "";
}

const sortedDbBots = computed(() => {
  const rows = [...(instances.value?.db_bot_configs ?? [])];
  rows.sort((a, b) => {
    const fa = botFavoriteAccounts.value.has(a.account) ? 1 : 0;
    const fb = botFavoriteAccounts.value.has(b.account) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ca = accountHasNonebotBot(instances.value?.nonebot_bots, a.account) ? 1 : 0;
    const cb = accountHasNonebotBot(instances.value?.nonebot_bots, b.account) ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = (dbNick(a.account) || "").toLowerCase();
    const nb = (dbNick(b.account) || "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return a.account - b.account;
  });
  return rows;
});

const selectedBotConfig = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return null;
  return sortedDbBots.value.find((r) => r.account === acc) ?? null;
});

const selectedAdminsDisplay = computed(() => {
  const admins = selectedBotConfig.value?.admins;
  if (!admins?.length) return "未配置管理员";
  return admins.map((id) => String(id)).join(" ");
});

const friendCountDisplay = computed(() => {
  if (friendSnap.value == null) return "—";
  return String(friendSnap.value.friends?.length ?? 0);
});

const groupCountDisplay = computed(() => {
  if (groupSnap.value == null) return "—";
  return String(groupSnap.value.groups?.length ?? 0);
});

const scopedRequestOverviewRow = computed(() => {
  const acc = selectedAccount.value;
  const ov = requestOverviewSnap.value;
  if (acc == null || !ov?.bots?.length) return null;
  const sid = String(acc);
  return ov.bots.find((b) => b.self_id === sid) ?? null;
});

const friendPendingApplyDisplay = computed(() => {
  const r = scopedRequestOverviewRow.value;
  if (r == null) return "—";
  const p = r.pending_friend_requests?.length ?? 0;
  const d = r.doubt_friend_requests?.length ?? 0;
  return String(p + d);
});

const groupPendingApplyDisplay = computed(() => {
  const r = scopedRequestOverviewRow.value;
  if (r == null) return "—";
  return String(r.pending_group_requests?.length ?? 0);
});

/** 好友申请行内展示（无数据时不拼「条待同意」以免歧义） */
const friendPendingLine = computed(() => {
  const d = friendPendingApplyDisplay.value;
  if (d === "—") return "—";
  return `${d}条待同意`;
});

/** 入群邀请行内展示 */
const groupPendingLine = computed(() => {
  const d = groupPendingApplyDisplay.value;
  if (d === "—") return "—";
  return `${d}条待同意`;
});

const RESOURCE_WARN_PCT = 90;

const diskResourceWarn = computed(() => (diskBarPct.value ?? 0) >= RESOURCE_WARN_PCT);
const memResourceWarn = computed(() => (memBarPct.value ?? 0) >= RESOURCE_WARN_PCT);
const sysResourceWarn = computed(() => diskResourceWarn.value || memResourceWarn.value);

type HomeActionItem = {
  key: string;
  label: string;
  to?: RouteLocationRaw;
  level: "warn" | "err";
};

const homeActionItems = computed((): HomeActionItem[] => {
  const items: HomeActionItem[] = [];
  if (botUpdateCheck.value?.has_update) {
    items.push({
      key: "bot-update",
      label: "Pallas-Bot 有更新",
      to: { path: "/update", hash: "#console-update-bot" },
      level: "warn",
    });
  }
  if (webUpdateCheck.value?.has_update) {
    items.push({
      key: "web-update",
      label: "控制台有更新",
      to: { path: "/update", hash: "#console-update-webui" },
      level: "warn",
    });
  }
  return items;
});

const homeActionStripVisible = computed(() => homeActionItems.value.length > 0);

const versionHasUpdate = computed(
  () => Boolean(botUpdateCheck.value?.has_update || webUpdateCheck.value?.has_update),
);

function ensureSelectedAccount() {
  const rows = sortedDbBots.value;
  if (!rows.length) {
    selectedAccount.value = null;
    writeSavedHomeAccount(null);
    return;
  }
  if (selectedAccount.value != null && rows.some((r) => r.account === selectedAccount.value)) return;
  const saved = readSavedHomeAccount();
  if (saved != null && rows.some((r) => r.account === saved)) {
    selectedAccount.value = saved;
    return;
  }
  selectedAccount.value = rows[0]!.account;
  writeSavedHomeAccount(selectedAccount.value);
}

const selectedConnected = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return false;
  return accountHasNonebotBot(instances.value?.nonebot_bots, acc);
});

/** 全 Bot 合计（容量区）；始终用首屏/轮询的全量 message-stats */
const clusterMessageStats = computed(() => stats.value);

/** 当前账号 message-stats（账户卡、协议 API 时序）；优先 statsScoped */
const accountMessageStats = computed(() => statsScoped.value ?? stats.value);

const clusterTodayApiCalls = computed(() => {
  const bots = clusterMessageStats.value?.bots;
  if (!bots?.length) return null;
  let sum = 0;
  let any = false;
  for (const b of bots) {
    const n = b.today_api_calls;
    if (n == null || !Number.isFinite(Number(n))) continue;
    sum += Number(n);
    any = true;
  }
  return any ? sum : null;
});

const clusterTodayPluginRuns = computed(() => {
  const bots = pluginRunStats.value?.bots;
  if (!bots?.length) return null;
  let sum = 0;
  let any = false;
  for (const b of bots) {
    const n = b.runs_today;
    if (n == null || !Number.isFinite(Number(n))) continue;
    sum += Number(n);
    any = true;
  }
  return any ? sum : null;
});

function formatCommunityStatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.floor(n).toLocaleString();
}

const communityDeploymentsOnline = computed(() =>
  formatCommunityStatNum(communityStats.value?.deployments_online),
);
const communityBotsOnlineSum = computed(() =>
  formatCommunityStatNum(communityStats.value?.bots_online_sum),
);

const kpiTodayApiDisplay = computed(() => {
  const api = clusterTodayApiCalls.value;
  return api == null ? "—" : String(Math.floor(api));
});

const kpiTodayPluginDisplay = computed(() => {
  const plug = clusterTodayPluginRuns.value;
  return plug == null ? "—" : String(Math.floor(plug));
});

const kpiMsgRxDisplay = computed(() => {
  const s = clusterMessageStats.value;
  if (!s) return "—";
  return String(s.total_received);
});

const kpiMsgTxDisplay = computed(() => {
  const s = clusterMessageStats.value;
  if (!s) return "—";
  return String(s.total_sent);
});

const scopedBotStatsRow = computed(() => {
  const acc = selectedAccount.value;
  const st = accountMessageStats.value;
  if (acc == null || !st?.bots?.length) return null;
  const sid = String(acc);
  return st.bots.find((b) => b.self_id === sid) ?? null;
});

const pluginRunMain = computed(() => pluginRunStatsScoped.value ?? pluginRunStats.value);

const scopedPluginRunRow = computed(() => {
  const acc = selectedAccount.value;
  const pr = pluginRunMain.value;
  if (acc == null || !pr?.bots?.length) return null;
  const sid = String(acc);
  return pr.bots.find((b) => b.self_id === sid) ?? null;
});

const scopedMatcherErrorLog = computed(() => scopedPluginRunRow.value?.matcher_error_log ?? []);

function formatMatcherErrorAt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}

const accountStatsBusy = computed(() => overviewBusy.value || accountDetailBusy.value);

const accountTodayApiCallsDisplay = computed(() => {
  const n = scopedBotStatsRow.value?.today_api_calls;
  if (n == null || !Number.isFinite(Number(n))) return accountStatsBusy.value ? "…" : "—";
  return String(Math.floor(Number(n)));
});

const accountTodayRxDisplay = computed(() => {
  const b = scopedBotStatsRow.value;
  if (!b) return accountStatsBusy.value ? "…" : "—";
  return String(b.today_received ?? "—");
});

const accountTodayTxDisplay = computed(() => {
  const b = scopedBotStatsRow.value;
  if (!b) return accountStatsBusy.value ? "…" : "—";
  return String(b.today_sent ?? "—");
});

function scheduleIdleWork(fn: () => void) {
  if (typeof window === "undefined") {
    fn();
    return;
  }
  const ric = window.requestIdleCallback;
  if (ric) {
    ric(() => fn(), { timeout: 2500 });
    return;
  }
  window.setTimeout(fn, 1);
}

async function refreshSelectedBotAccountStats() {
  const acc = selectedAccount.value;
  if (acc == null) {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    consoleDailyStatsScoped.value = null;
    return;
  }
  accountDetailBusy.value = true;
  try {
    const settled = await Promise.allSettled([
      fetchMessageStats(acc),
      fetchPluginRunStats(acc),
      fetchConsoleDailyStats({ selfId: acc }),
    ]);
    function take<T>(i: number): T | null {
      const r = settled[i];
      return r.status === "fulfilled" ? (r.value as T) : null;
    }
    statsScoped.value = take<MessageStatsData>(0);
    pluginRunStatsScoped.value = take<PluginRunStatsData>(1);
    consoleDailyStatsScoped.value = take<ConsoleDailyStatsData>(2);
  } finally {
    accountDetailBusy.value = false;
  }
}

async function refreshSelectedBotSocialLists() {
  const acc = selectedAccount.value;
  if (acc == null) {
    friendSnap.value = null;
    groupSnap.value = null;
    requestOverviewSnap.value = null;
    return;
  }
  const sidKey = String(acc);
  socialBusy.value = true;
  try {
    const cachedListsWarm = cacheTryGetFriendGroupLists(sidKey);
    if (cachedListsWarm) {
      friendSnap.value = cachedListsWarm.friends;
      groupSnap.value = cachedListsWarm.groups;
    }
    const settled = await Promise.allSettled([
      fetchFriendList(acc),
      fetchGroupList(acc),
      fetchRequestOverview({ selfId: acc }),
    ]);
    function take<T>(i: number): T | null {
      const r = settled[i];
      return r.status === "fulfilled" ? (r.value as T) : null;
    }
    friendSnap.value = take<FriendListData>(0);
    groupSnap.value = take<GroupListData>(1);
    requestOverviewSnap.value = take<RequestOverviewData>(2);
    if (!friendSnap.value || !groupSnap.value) {
      const fb = cacheTryGetFriendGroupLists(sidKey);
      if (fb) {
        if (!friendSnap.value) friendSnap.value = fb.friends;
        if (!groupSnap.value) groupSnap.value = fb.groups;
      }
    }
    if (friendSnap.value && groupSnap.value) {
      cachePutFriendGroupLists(sidKey, friendSnap.value, groupSnap.value);
    }
    if (requestOverviewSnap.value) {
      cachePutRequestOverview(requestOverviewSnap.value, acc);
    }
  } finally {
    socialBusy.value = false;
  }
}

function refreshSelectedBotDetails(options?: { deferSocial?: boolean }) {
  void refreshSelectedBotAccountStats();
  if (options?.deferSocial) {
    scheduleIdleWork(() => void refreshSelectedBotSocialLists());
    return;
  }
  void refreshSelectedBotSocialLists();
}

watch(selectedAccount, (acc, prev) => {
  accountPickerOpen.value = false;
  if (prev != null && acc != null && prev !== acc) {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    consoleDailyStatsScoped.value = null;
    const sidKey = String(acc);
    const cachedLists = cacheTryGetFriendGroupLists(sidKey);
    if (cachedLists) {
      friendSnap.value = cachedLists.friends;
      groupSnap.value = cachedLists.groups;
    } else {
      friendSnap.value = null;
      groupSnap.value = null;
    }
    const cachedOv = cacheTryGetRequestOverview(acc);
    if (cachedOv) requestOverviewSnap.value = cachedOv;
    else requestOverviewSnap.value = null;
  }
  void refreshSelectedBotDetails();
});

watch(sortedDbBots, () => {
  if (sortedDbBots.value.length <= 1) {
    accountPickerOpen.value = false;
  }
  ensureSelectedAccount();
});

const HOME_CONN_DURATION_TICK_MS = 1_000;

/** NoneBot 在线会话中与当前选中账号对应的条目（含接入时刻） */
const selectedNonebotRuntimeBot = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return null;
  const sid = String(acc);
  const bots = instances.value?.nonebot_bots ?? [];
  return bots.find((b) => String(b.self_id) === sid) ?? null;
});

const selectedConnAnchorUnix = computed((): number | null => {
  const ts = selectedNonebotRuntimeBot.value?.connected_at_unix;
  if (ts == null || !Number.isFinite(Number(ts))) return null;
  return Math.floor(Number(ts));
});

const connectionClockTick = ref(0);
let homeConnDurationPollId: number | null = null;

function bumpConnectionClock() {
  connectionClockTick.value = Date.now();
}

function formatZhConnDuration(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return "—";
  const sec = Math.floor(totalSec);
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 48) return mm ? `${h} 小时 ${mm} 分` : `${h} 小时`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d} 天 ${hh} 小时` : `${d} 天`;
}

const selectedConnDurationDisplay = computed(() => {
  if (!selectedConnected.value) return "—";
  const anchor = selectedConnAnchorUnix.value;
  if (anchor == null) return "—";
  const elapsedSec = Math.max(0, Math.floor(connectionClockTick.value / 1000) - anchor);
  return formatZhConnDuration(elapsedSec);
});

const selectedConnDateDisplay = computed(() => {
  if (!selectedConnected.value) return "—";
  const anchor = selectedConnAnchorUnix.value;
  if (anchor == null) return "—";
  try {
    return new Date(anchor * 1000).toLocaleString();
  } catch {
    return "—";
  }
});

function startHomeConnDurationTick() {
  if (typeof window === "undefined") return;
  if (homeConnDurationPollId != null) return;
  bumpConnectionClock();
  homeConnDurationPollId = window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    bumpConnectionClock();
  }, HOME_CONN_DURATION_TICK_MS);
}

function stopHomeConnDurationTick() {
  if (homeConnDurationPollId == null) return;
  window.clearInterval(homeConnDurationPollId);
  homeConnDurationPollId = null;
}

async function loadHomeDeferred(refreshMeta: boolean) {
  homeDeferredBusy.value = true;
  try {
    const botUpdateP =
      !refreshMeta && consoleMetaBotUpdate.value
        ? Promise.resolve(consoleMetaBotUpdate.value)
        : fetchBotUpdateCheck().catch(() => null);
    const webUpdateP =
      !refreshMeta && consoleMetaWebUpdate.value
        ? Promise.resolve(consoleMetaWebUpdate.value)
        : fetchUpdateCheck().catch(() => null);
    const settled = await Promise.allSettled([
      fetchMessageStats(),
      fetchPluginRunStats(),
      botUpdateP,
      webUpdateP,
    ]);
    function take<T>(i: number): T | null {
      const r = settled[i];
      return r.status === "fulfilled" ? (r.value as T) : null;
    }
    stats.value = take<MessageStatsData>(0);
    pluginRunStats.value = take<PluginRunStatsData>(1);
    botUpdateCheck.value = take<BotUpdateCheckData | null>(2);
    webUpdateCheck.value = take<UpdateCheckData | null>(3);
    const h = consoleMetaHealth.value ?? health.value;
    if (h) health.value = h;
    patchConsoleMeta(health.value, botUpdateCheck.value, webUpdateCheck.value);
  } finally {
    homeDeferredBusy.value = false;
  }
}

type LoadOptions = {
  /** 手动刷新时等待次要接口并强制重拉更新检查 */
  refreshMeta?: boolean;
};

async function load(opts?: LoadOptions) {
  const refreshMeta = opts?.refreshMeta ?? false;
  if (overviewBusy.value) return;
  err.value = "";
  overviewBusy.value = true;
  try {
    const healthP = consoleMetaHealth.value ? Promise.resolve(consoleMetaHealth.value) : fetchHealth();
    const [h, s, botList, inst, pl, comm] = await Promise.all([
      healthP,
      fetchSystem(),
      fetchBots(),
      fetchInstances(),
      fetchPlugins(),
      fetchCommunityStats(refreshMeta ? { bypassCache: true } : undefined).catch(() => null),
    ]);
    health.value = h;
    patchConsoleMeta(h);
    system.value = s;
    bots.value = botList;
    instances.value = inst;
    pluginsList.value = pl;
    communityStats.value = comm;
    botCount.value = botList.length;
    const accBefore = selectedAccount.value;
    ensureSelectedAccount();
    const accAfter = selectedAccount.value;
    pageReady.value = true;
    if (accBefore === accAfter) {
      if (refreshMeta) {
        void refreshSelectedBotDetails();
      } else {
        void refreshSelectedBotDetails({ deferSocial: true });
      }
    }
    if (refreshMeta) {
      await loadHomeDeferred(true);
    } else {
      void loadHomeDeferred(false);
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    pageReady.value = true;
  } finally {
    overviewBusy.value = false;
  }
}

async function refreshHomeRuntimePanels() {
  const [sys, comm] = await Promise.allSettled([fetchSystem(), fetchCommunityStats()]);
  if (sys.status === "fulfilled") system.value = sys.value;
  if (comm.status === "fulfilled") communityStats.value = comm.value;
}

async function refreshSystemRuntimeOnly() {
  await refreshHomeRuntimePanels();
}

let homeSystemPollId: ReturnType<typeof setInterval> | null = null;

function startHomeSystemPolling() {
  if (homeSystemPollId != null) return;
  homeSystemPollId = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void refreshSystemRuntimeOnly();
  }, HOME_SYSTEM_POLL_MS);
}

function stopHomeSystemPolling() {
  if (homeSystemPollId == null) return;
  clearInterval(homeSystemPollId);
  homeSystemPollId = null;
}

function onHomeSystemVisibility() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") {
    void refreshSystemRuntimeOnly();
  }
}

async function refreshMessageStatsOnly() {
  try {
    const m = await fetchMessageStats();
    stats.value = m;
  } catch {
    /* 保留当前 stats */
  }
  const acc = selectedAccount.value;
  if (acc == null) return;
  try {
    const ms = await fetchMessageStats(acc);
    statsScoped.value = ms;
  } catch {
    /* 保留当前 statsScoped */
  }
}

async function refreshHomeCatalogFromCache() {
  const warm = peekInstancesCache();
  if (warm) instances.value = warm;
  try {
    const [inst, botList] = await Promise.all([fetchInstances({ bypassCache: true }), fetchBots()]);
    instances.value = inst;
    bots.value = botList;
    botCount.value = botList.length;
    ensureSelectedAccount();
  } catch {
    /* 保留当前目录快照 */
  }
}

const homeRouteActive = ref(false);

watch(instancesCatalogEpoch, () => {
  if (!homeRouteActive.value) return;
  const warm = peekInstancesCache();
  if (warm) instances.value = warm;
});

let homeThroughputPollId: ReturnType<typeof setInterval> | null = null;

function startHomeThroughputPolling() {
  if (homeThroughputPollId != null) return;
  homeThroughputPollId = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void refreshMessageStatsOnly();
  }, HOME_THROUGHPUT_POLL_MS);
}

function stopHomeThroughputPolling() {
  if (homeThroughputPollId == null) return;
  clearInterval(homeThroughputPollId);
  homeThroughputPollId = null;
}

onMounted(async () => {
  await load();
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHomeSystemVisibility);
  }
});

onActivated(() => {
  homeRouteActive.value = true;
  if (pageReady.value) {
    void refreshHomeCatalogFromCache();
    void refreshInstancesCatalogGlobal().catch(() => {});
  }
  startHomeSystemPolling();
  startHomeThroughputPolling();
  startHomeConnDurationTick();
});

onDeactivated(() => {
  homeRouteActive.value = false;
  stopHomeSystemPolling();
  stopHomeThroughputPolling();
  stopHomeConnDurationTick();
});

onUnmounted(() => {
  stopHomeSystemPolling();
  stopHomeThroughputPolling();
  stopHomeConnDurationTick();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onHomeSystemVisibility);
  }
});
</script>

<template>
  <div class="home-page console-hub-page" :aria-busy="overviewBusy || undefined">
    <div v-if="err" class="alert alert--err">{{ err }}</div>

    <ConsolePageSkeleton v-if="!pageReady" :panels="3" />

    <Transition name="home-shell-fade">
      <div v-if="pageReady" class="home-body" :class="{ 'home-body--syncing': overviewBusy }">
        <p v-if="overviewBusy" class="home-sync" role="status">正在同步概况…</p>

        <!-- ═══ KPI Bar（GsHub 风格） ═══ -->
        <div class="home-kpi-head">
          <div class="home-kpi-bar">
            <div class="home-kpi-cell">
              <div class="home-kpi-cell__head">
                <ConsoleNavIcon class="home-kpi-cell__ico" name="account" :size="16" />
                <span class="home-kpi-cell__label">在线 Bot</span>
              </div>
              <div class="home-kpi-cell__value-slot">
                <span class="home-kpi-cell__value">{{ botCount }}</span>
              </div>
            </div>
            <div class="home-kpi-cell">
              <div class="home-kpi-cell__head">
                <ConsoleNavIcon class="home-kpi-cell__ico" name="layers" :size="16" />
                <span class="home-kpi-cell__label">消息 收 / 发</span>
              </div>
              <div class="home-kpi-cell__value-slot">
                <span class="home-kpi-cell__value home-kpi-cell__value--inline">
                  {{ kpiMsgRxDisplay }}<span class="home-kpi-cell__sep"> / </span>{{ kpiMsgTxDisplay }}
                </span>
              </div>
            </div>
            <div class="home-kpi-cell">
              <div class="home-kpi-cell__head">
                <ConsoleNavIcon class="home-kpi-cell__ico" name="activity" :size="16" />
                <span class="home-kpi-cell__label">API / 插件</span>
              </div>
              <div class="home-kpi-cell__value-slot">
                <span class="home-kpi-cell__value home-kpi-cell__value--inline">
                  {{ kpiTodayApiDisplay }}<span class="home-kpi-cell__sep"> / </span>{{ kpiTodayPluginDisplay }}
                </span>
              </div>
            </div>
            <div class="home-kpi-cell">
              <div class="home-kpi-cell__head">
                <ConsoleNavIcon class="home-kpi-cell__ico" name="plugin" :size="16" />
                <span class="home-kpi-cell__label">已加载插件</span>
              </div>
              <div class="home-kpi-cell__value-slot">
                <span class="home-kpi-cell__value">{{ system?.plugin_count ?? '—' }}</span>
              </div>
            </div>
          </div>
          <div class="home-kpi-head__side">
            <RouterLink class="home-kpi-community" to="/community" title="社区统计与语料">
              社区
              <span class="home-kpi-community__val">{{ communityDeploymentsOnline }}</span>
              <span class="home-kpi-community__hint muted">安装</span>
              <span class="home-kpi-community__sep muted">·</span>
              <span class="home-kpi-community__val">{{ communityBotsOnlineSum }}</span>
              <span class="home-kpi-community__hint muted">牛牛</span>
            </RouterLink>
            <RouterLink class="home-kpi-quick" to="/charts" title="数据看板">
              <ConsoleNavIcon name="charts" :size="16" />
              <span>数据看板</span>
            </RouterLink>
          </div>
        </div>

        <div v-if="homeActionStripVisible" class="home-action-strip" role="status" aria-label="可用更新">
          <component
            :is="item.to ? 'RouterLink' : 'span'"
            v-for="item in homeActionItems"
            :key="item.key"
            class="home-action-strip__item"
            :class="`home-action-strip__item--${item.level}`"
            v-bind="item.to ? { to: item.to } : {}"
          >
            {{ item.label }}
          </component>
        </div>

        <!-- ═══ Main Grid ═══ -->
        <div class="home-grid">
          <!-- Account -->
          <div class="home-card home-card--acct" style="grid-area: acct">
            <div class="home-card__hd home-acct__hd">
              <div class="home-acct__hd-left">
                <div class="home-acct__avatar">
                  <img v-if="selectedAccount != null" :src="qqAvatarUrl(selectedAccount)" alt="" width="44" height="44" decoding="async" referrerpolicy="no-referrer" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
                </div>
                <div ref="accountPickerRoot" class="home-acct__title-wrap">
                  <h2 class="home-card__title home-acct__title">
                    <span class="home-acct__name">{{ selectedAccount != null ? (dbNick(selectedAccount) || "BOT") : "BOT" }}</span>
                    <button v-if="sortedDbBots.length > 1" type="button" class="home-acct__caret" :aria-expanded="accountPickerOpen" aria-haspopup="listbox" aria-label="切换账号" @click="toggleAccountPicker"><span class="home-acct__caret-ico" aria-hidden="true" /></button>
                    <button v-if="selectedAccount != null" type="button" class="home-acct__fav" :aria-pressed="botFavoriteAccounts.has(selectedAccount)" :title="botFavoriteAccounts.has(selectedAccount) ? '取消收藏' : '收藏该 Bot'" @click.stop="toggleFavoriteBot(selectedAccount)">★</button>
                  </h2>
                  <p class="home-acct__qq muted">QQ {{ selectedAccount ?? "—" }}</p>
                  <div v-if="accountPickerOpen && sortedDbBots.length > 1" class="home-acct-picker" role="listbox" aria-label="选择 Bot 账号">
                    <button v-for="c in sortedDbBots" :key="c.account" type="button" class="home-acct-picker__item" :class="{ 'is-active': c.account === selectedAccount }" role="option" :aria-selected="c.account === selectedAccount" @click="pickAccountFromList(c.account)">
                      <img :src="qqAvatarUrl(c.account)" alt="" width="32" height="32" decoding="async" referrerpolicy="no-referrer" class="home-acct-picker__avatar" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
                      <span class="home-acct-picker__text"><span class="home-acct-picker__name">{{ dbNick(c.account) || "BOT" }}</span><span class="home-acct-picker__qq muted">{{ c.account }}</span></span>
                    </button>
                  </div>
                </div>
              </div>
              <div class="home-acct__hd-actions">
                <span v-if="selectedAccount != null && selectedConnected" class="home-acct__conn home-acct__conn--on"><span class="home-acct__conn-dot" aria-hidden="true" />已连接</span>
                <span v-else-if="selectedAccount != null" class="home-acct__conn home-acct__conn--off">未连接</span>
                <RefreshIconButton :show-label="false" :busy="overviewBusy" label="刷新概况" @click="() => load({ refreshMeta: true })" />
              </div>
            </div>
            <div class="home-card__bd home-acct__bd" v-if="selectedAccount != null">
              <div class="home-acct-meta">
                <RouterLink class="home-acct-meta__tag" :to="{ name: 'protocol' }">协议 · {{ accountAdapterDisplay }}</RouterLink>
                <span class="home-acct-meta__tag home-acct-meta__tag--muted" :title="selectedAdminsDisplay">管理员 {{ selectedAdminsDisplay }}</span>
              </div>
              <HomeLazyReveal :loading="accountSocialPending" variant="account-social">
                <div class="home-acct-grid">
                  <div class="home-acct-tile">
                    <span class="home-acct-tile__label">好友</span>
                    <span class="home-acct-tile__value">{{ friendCountDisplay }}</span>
                  </div>
                  <div class="home-acct-tile">
                    <span class="home-acct-tile__label">群聊</span>
                    <span class="home-acct-tile__value">{{ groupCountDisplay }}</span>
                  </div>
                  <div class="home-acct-tile home-acct-tile--sub">
                    <span class="home-acct-tile__label">今日 API</span>
                    <span class="home-acct-tile__value">{{ accountTodayApiCallsDisplay }}</span>
                  </div>
                  <div class="home-acct-tile home-acct-tile--sub">
                    <span class="home-acct-tile__label">今日消息</span>
                    <span class="home-acct-tile__value home-acct-tile__value--duo">
                      <span>{{ accountTodayRxDisplay }}</span>
                      <span class="home-acct-tile__sep">/</span>
                      <span>{{ accountTodayTxDisplay }}</span>
                    </span>
                  </div>
                </div>
                <div v-if="friendPendingLine !== '—' || groupPendingLine !== '—'" class="home-acct-pending-row">
                  <RouterLink v-if="friendPendingLine !== '—'" class="home-acct-pending-pill home-acct-pending-pill--friend" :to="friendsGroupsFriendPendingTo">
                    好友申请 · {{ friendPendingLine }}
                  </RouterLink>
                  <RouterLink v-if="groupPendingLine !== '—'" class="home-acct-pending-pill home-acct-pending-pill--group" :to="friendsGroupsGroupPendingTo">
                    入群邀请 · {{ groupPendingLine }}
                  </RouterLink>
                </div>
              </HomeLazyReveal>
              <div class="home-acct__foot">
                <details v-if="scopedMatcherErrorLog.length" class="home-acct-matcher">
                  <summary class="home-acct-matcher__toggle">Matcher 异常 <strong>{{ scopedPluginRunRow?.errors_today ?? 0 }}</strong> · 点击展开</summary>
                  <ul class="home-acct-matcher__list">
                    <li v-for="(it, idx) in scopedMatcherErrorLog" :key="`${it.at}-${idx}-${it.plugin}`" class="home-acct-matcher__item">
                      <div class="home-acct-matcher__head"><span>{{ formatMatcherErrorAt(it.at) }}</span><span class="home-acct-matcher__plugin">{{ it.plugin }}</span><span>{{ it.exc_type }}</span></div>
                      <div class="home-acct-matcher__msg">{{ it.message }}</div>
                      <pre class="home-acct-matcher__tb">{{ it.traceback }}</pre>
                    </li>
                  </ul>
                </details>
                <div v-else class="home-acct-matcher__plain" :class="{ 'home-acct-matcher__plain--warn': (scopedPluginRunRow?.errors_today ?? 0) > 0 }">Matcher 异常 <strong>{{ scopedPluginRunRow == null ? '—' : String(scopedPluginRunRow.errors_today ?? 0) }}</strong></div>
                <div class="home-acct__session muted">已连接 {{ selectedConnDurationDisplay }} · {{ selectedConnDateDisplay }}</div>
              </div>
            </div>
            <div class="home-card__bd home-card__bd--empty" v-else-if="sortedDbBots.length">
              <p class="muted">请选择一个 Bot 账号</p>
            </div>
            <div class="home-card__bd home-card__bd--empty" v-else>
              <p class="muted">数据库中暂无 Bot 配置记录。请在后端创建 <code>bot_config</code> 后刷新。</p>
            </div>
          </div>

          <!-- System Health -->
          <div class="home-card home-card--sys" :class="{ 'home-card--resource-warn': sysResourceWarn }" style="grid-area: sys">
            <div class="home-card__hd">
              <h2 class="home-card__title"><ConsoleNavIcon class="home-card__title-ico" name="activity" />系统性能</h2>
              <span class="home-card__tag muted">节点采样</span>
            </div>
            <div class="home-card__bd">
              <p v-if="!perfSampled" class="muted" style="margin:0">当前未上报 CPU/内存/磁盘/GPU 等指标。</p>
              <template v-else>
                <div class="home-sys-grid">
                  <div class="home-sys-card">
                    <div class="home-sys-card__head">
                      <span class="home-sys-card__label">CPU</span>
                      <span class="home-sys-card__value">{{ cpuDisplay }}</span>
                    </div>
                    <div class="home-sys-card__viz">
                      <div v-if="cpuPerCorePercents.length" class="home-sys-card__cores" role="img" :aria-label="`${cpuPerCorePercents.length} 核心`">
                        <div v-for="(p, i) in cpuPerCorePercents" :key="i" class="home-sys-card__core" :title="`核心 ${i}：${p.toFixed(1)}%`">
                          <span class="home-sys-card__core-fill" :style="{ height: `${Math.min(100, Math.max(0, p))}%` }" />
                        </div>
                      </div>
                      <div v-else-if="cpuBarPct != null" class="home-sys-card__bar"><span :style="{ width: `${cpuBarPct}%` }" /></div>
                    </div>
                    <p v-if="cpuFootHint" class="home-sys-card__hint">{{ cpuFootHint }}</p>
                  </div>
                  <div class="home-sys-card" :class="{ 'home-sys-card--warn': memResourceWarn }">
                    <div class="home-sys-card__head">
                      <span class="home-sys-card__label">内存</span>
                      <span class="home-sys-card__value">{{ memDisplay }}</span>
                    </div>
                    <div class="home-sys-card__viz">
                      <div v-if="memBarPct != null" class="home-sys-card__bar"><span :style="{ width: `${memBarPct}%` }" /></div>
                    </div>
                    <p v-if="memHint" class="home-sys-card__hint">{{ memHint }}</p>
                  </div>
                  <div class="home-sys-card" :class="{ 'home-sys-card--warn': diskResourceWarn }">
                    <div class="home-sys-card__head">
                      <span class="home-sys-card__label">磁盘</span>
                      <span class="home-sys-card__value">{{ diskDisplay }}</span>
                    </div>
                    <div class="home-sys-card__viz">
                      <div v-if="diskBarPct != null" class="home-sys-card__bar"><span :style="{ width: `${diskBarPct}%` }" /></div>
                    </div>
                    <p v-if="diskHint" class="home-sys-card__hint">{{ diskHint }}</p>
                  </div>
                  <div class="home-sys-card home-sys-card--uptime">
                    <div class="home-sys-card__head">
                      <span class="home-sys-card__label">运行时长</span>
                      <span v-if="uptimeParts" class="home-sys-card__value home-uptime-value">
                        <span class="home-uptime-value__num">{{ uptimeParts.value }}</span><span class="home-uptime-value__unit">{{ uptimeParts.unit }}</span>
                      </span>
                      <span v-else class="home-sys-card__value">—</span>
                    </div>
                    <div class="home-sys-card__viz home-sys-card__viz--empty" aria-hidden="true" />
                    <p v-if="uptimeParts?.sub" class="home-sys-card__hint">{{ uptimeParts.sub }}</p>
                  </div>
                  <div v-for="dev in gpuDevices" :key="dev.index" class="home-sys-card home-sys-card--gpu">
                    <div class="home-sys-card__head">
                      <span class="home-sys-card__label">GPU {{ dev.index }}</span>
                      <span class="home-sys-card__value">{{ pct(dev.utilization_gpu) }}</span>
                    </div>
                    <p class="home-sys-card__hint">{{ gpuNameShort(dev.name || '', 36) }}</p>
                    <div class="home-sys-card__gpu-metrics">
                      <div class="home-sys-card__gpu-metric">
                        <span class="home-sys-card__label">利用率</span>
                        <div v-if="gpuUtilBarPct(dev.utilization_gpu) != null" class="home-sys-card__bar"><span :style="{ width: `${gpuUtilBarPct(dev.utilization_gpu)}%` }" /></div>
                      </div>
                      <div class="home-sys-card__gpu-metric">
                        <div class="home-sys-card__row home-sys-card__row--sub">
                          <span class="home-sys-card__label">显存</span>
                          <span class="home-sys-card__value home-sys-card__value--sm">{{ dev.memory_total > 0 ? pct((dev.memory_used / dev.memory_total) * 100) : pct(dev.utilization_memory) }}</span>
                        </div>
                        <div v-if="gpuMemBarPct(dev.memory_used, dev.memory_total) != null" class="home-sys-card__bar"><span :style="{ width: `${gpuMemBarPct(dev.memory_used, dev.memory_total)}%` }" /></div>
                      </div>
                    </div>
                    <p class="home-sys-card__hint">{{ fmtBytes(dev.memory_used) }} / {{ fmtBytes(dev.memory_total) }}<template v-if="dev.temperature != null"> · {{ tempDisplay(dev.temperature) }}</template></p>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Version & environment -->
          <div class="home-card home-card--ver" style="grid-area: verL">
            <div class="home-card__hd">
              <h2 class="home-card__title"><ConsoleNavIcon class="home-card__title-ico" name="download" />版本</h2>
              <span v-if="versionHasUpdate" class="home-card__tag"><UiBadge variant="warn">有更新</UiBadge></span>
            </div>
            <div class="home-card__bd">
              <HomeLazyReveal :loading="versionMetaPending" variant="version-dl">
                <dl class="home-ver-dl">
                  <div class="home-ver-dl__row"><dt>NoneBot2</dt><dd><span class="home-ver-dl__val">{{ nonebot2VersionDisplay }}</span><span class="home-ver-dl__tag">框架</span></dd></div>
                  <div class="home-ver-dl__row"><dt>Pallas-Bot</dt><dd>
                    <span class="home-ver-dl__val">{{ pallasBotVersionDisplay }}</span>
                    <RouterLink v-if="botUpdateCheck?.has_update" class="home-ver-dl__link" to="/update#console-update-bot"><UiBadge variant="warn">有更新</UiBadge></RouterLink>
                    <UiBadge v-else-if="botUpdateCheck?.development_build" variant="secondary" :title="botDevelopmentBuildTitle">开发构建</UiBadge>
                    <span class="home-ver-dl__tag">业务</span>
                  </dd></div>
                  <div class="home-ver-dl__row"><dt>控制台资源</dt><dd>
                    <span class="home-ver-dl__val">{{ consoleResourceVersionDisplay }}</span>
                    <RouterLink v-if="webUpdateCheck?.has_update" class="home-ver-dl__link" to="/update#console-update-webui"><UiBadge variant="warn">有更新</UiBadge></RouterLink>
                  </dd></div>
                  <div class="home-ver-dl__row"><dt>Python</dt><dd><span class="home-ver-dl__val home-ver-dl__val--mono">{{ pythonVersionDisplay }}</span></dd></div>
                </dl>
              </HomeLazyReveal>
            </div>
          </div>

          <div class="home-card home-card--ver" style="grid-area: verR">
            <div class="home-card__hd">
              <h2 class="home-card__title"><ConsoleNavIcon class="home-card__title-ico" name="server" />环境</h2>
              <span v-if="health?.ok" class="home-card__tag home-card__tag--ok muted">API 已连接</span>
            </div>
            <div class="home-card__bd">
              <HomeLazyReveal :loading="versionMetaPending" variant="version-dl">
                <dl class="home-ver-dl">
                  <div class="home-ver-dl__row"><dt>服务时间</dt><dd><span class="home-ver-dl__val home-ver-dl__val--mono">{{ versionServerTimeStr }}</span></dd></div>
                  <div class="home-ver-dl__row"><dt>监听地址</dt><dd><span class="home-ver-dl__val home-ver-dl__val--mono">{{ nonebotListenDisplay }}</span></dd></div>
                  <div class="home-ver-dl__row"><dt>系统</dt><dd><span class="home-ver-dl__val">{{ osFamilyDisplay }}</span></dd></div>
                  <div class="home-ver-dl__row"><dt>主机</dt><dd><span class="home-ver-dl__val">{{ hostnameDisplay }}</span></dd></div>
                </dl>
              </HomeLazyReveal>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Account picker avatar */
.home-acct-picker__avatar {
  width: 32px; height: 32px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: var(--bg-muted);
}

/* Favorite star */
.home-acct__fav {
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 15px;
  line-height: 1;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.35;
}
.home-acct__fav:hover { opacity: 0.6; }
.home-acct__fav[aria-pressed="true"] { opacity: 1; color: #fbbf24; }

/* Caret */
.home-acct__caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
}
.home-acct__caret:hover { opacity: 0.85; }
.home-acct__caret-ico {
  display: block;
  width: 0; height: 0;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 5px solid currentColor;
  transition: transform 0.16s ease;
}
.home-acct__caret[aria-expanded="true"] .home-acct__caret-ico { transform: rotate(180deg); }

/* Connection pill dot */
.home-acct__conn-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
</style>
