<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch, watchEffect } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import {
  fetchBots,
  fetchBotUpdateCheck,
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchConsoleDailyStats,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  fetchRequestOverview,
  fetchSystem,
  fetchUpdateCheck,
  peekBotsCache,
  peekInstancesCache,
  peekPluginsCache,
} from "@/api/consoleApi";
import type {
  BotRow,
  BotUpdateCheckData,
  FriendListData,
  GroupListData,
  InstancesData,
  ConsoleDailyStatsData,
  MessageStatsData,
  PluginRow,
  PluginRunStatsData,
  RequestOverviewData,
  SystemData,
  UpdateCheckData,
} from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import HomePluginRunCharts from "@/components/HomePluginRunCharts.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts, toggleFavoriteBot } from "@/utils/botFavorites";
import { qqAvatarUrl } from "@/utils/botDisplay";
import {
  cachePutFriendGroupLists,
  cachePutRequestOverview,
  cacheTryGetFriendGroupLists,
  cacheTryGetRequestOverview,
} from "@/utils/consoleSocialCache";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@/utils/pluginRunHistory";
import { displayVersionWithoutSha } from "@/utils/versionDisplay";
import { instancesCatalogEpoch } from "@/utils/catalogSync";
import { refreshInstancesCatalogGlobal } from "@/api/consoleApi";

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
const stats = ref<MessageStatsData | null>(null);
const statsScoped = ref<MessageStatsData | null>(null);
const pluginRunStats = ref<PluginRunStatsData | null>(null);
const pluginRunStatsScoped = ref<PluginRunStatsData | null>(null);
/** 当前选中账号的按日持久化统计（GET /console-daily-stats） */
const consoleDailyStats = ref<ConsoleDailyStatsData | null>(null);
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
const selectedAccount = ref<number | null>(null);
const friendSnap = ref<FriendListData | null>(null);
const groupSnap = ref<GroupListData | null>(null);
const requestOverviewSnap = ref<RequestOverviewData | null>(null);
const socialBusy = ref(false);
/** 首屏主内容区：首包 API 返回后即展示，不再等待按账号拉取的社交/统计 */
const pageReady = ref(false);
/** 概况接口（健康/系统/实例等）拉取中；用于刷新按钮与轻提示 */
const overviewBusy = ref(false);

const pluginsList = ref<PluginRow[]>([]);
{
  const warmPl = peekPluginsCache();
  if (warmPl?.length) pluginsList.value = warmPl;
}

const accountPickerOpen = ref(false);
const accountPickerRoot = ref<HTMLElement | null>(null);
/** 双列布局下账号信息卡，用于宽屏锁定右侧图表区高度与之对齐 */
const accountCardRef = ref<HTMLElement | null>(null);
const accountHeroLockHeightPx = ref(0);

const accountUnifiedHeroLockStyle = computed((): Record<string, string> => {
  if (typeof window === "undefined") return {};
  if (!window.matchMedia("(min-width: 561px)").matches) return {};
  const h = accountHeroLockHeightPx.value;
  if (h < 120) return {};
  return { "--home-account-hero-lock-px": `${h}px` };
});

/** 图表壳层直接写死 px，避免 flex 子项 min-height:auto 撑破 max-height 变量 */
const accountChartsShellLockStyle = computed((): Record<string, string> => {
  if (typeof window === "undefined") return {};
  if (!window.matchMedia("(min-width: 561px)").matches) return {};
  const h = accountHeroLockHeightPx.value;
  if (h < 120) return {};
  return {
    height: `${h}px`,
    maxHeight: `${h}px`,
    minHeight: "0",
  };
});

function measureAccountHeroLockHeight() {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(min-width: 561px)").matches) {
    accountHeroLockHeightPx.value = 0;
    return;
  }
  const el = accountCardRef.value;
  if (!el) {
    accountHeroLockHeightPx.value = 0;
    return;
  }
  accountHeroLockHeightPx.value = Math.round(el.getBoundingClientRect().height);
}

function scheduleAccountHeroLockMeasure() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      measureAccountHeroLockHeight();
    });
  });
}

/** matcher 异常 details 开合会改变卡高，需在布局稳定后重测以免锁高滞留 */
function onMatcherDetailsToggle() {
  scheduleAccountHeroLockMeasure();
}

watchEffect((onCleanup) => {
  if (typeof window === "undefined") return;
  if (selectedAccount.value == null || !pageReady.value) {
    accountHeroLockHeightPx.value = 0;
    return;
  }
  const el = accountCardRef.value;
  if (!el) {
    accountHeroLockHeightPx.value = 0;
    return;
  }
  const mql = window.matchMedia("(min-width: 561px)");
  const onMql = () => {
    measureAccountHeroLockHeight();
  };
  mql.addEventListener("change", onMql);
  const ro = new ResizeObserver(() => {
    measureAccountHeroLockHeight();
  });
  ro.observe(el);
  scheduleAccountHeroLockMeasure();
  onCleanup(() => {
    ro.disconnect();
    mql.removeEventListener("change", onMql);
    accountHeroLockHeightPx.value = 0;
  });
});

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

function uptimeFromBoot(boot: number | null | undefined): string {
  if (boot == null) return "—";
  const nowSec = Date.now() / 1000;
  let s = Math.max(0, nowSec - boot);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分`;
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
const uptimeDisplay = computed(() => uptimeFromBoot(runtime.value?.boot_time ?? null));
const uptimeHint = computed(() => runtime.value?.platform || undefined);

const nonebot2VersionDisplay = computed(() => {
  const s = (health.value?.nonebot2 ?? "").trim();
  const x = displayVersionWithoutSha(s);
  return x || s || "—";
});

const pallasBotVersionDisplay = computed(() => {
  const b = botUpdateCheck.value;
  const tag = (b?.current_tag || "").trim();
  if (tag) return tag;
  const pb = (health.value?.pallas_bot ?? "").trim();
  const x = displayVersionWithoutSha(pb);
  return x || pb || "—";
});

const consoleResourceVersionDisplay = computed(() => {
  const v = (health.value?.console?.version ?? "").trim();
  const x = displayVersionWithoutSha(v);
  return x || v || "—";
});

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

const accountProtocolIsUnknown = computed(() => accountAdapterDisplay.value === "—");

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

const friendCountNumPending = computed(() => friendSnap.value == null);
const groupCountNumPending = computed(() => groupSnap.value == null);

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

const msgMainStats = computed(() => statsScoped.value ?? stats.value);

const msgTotalStr = computed(() => {
  const s = msgMainStats.value;
  if (!s) return "—";
  return `${s.total_received} / ${s.total_sent}`;
});

const scopedBotStatsRow = computed(() => {
  const acc = selectedAccount.value;
  const st = msgMainStats.value;
  if (acc == null || !st?.bots?.length) return null;
  const sid = String(acc);
  return st.bots.find((b) => b.self_id === sid) ?? null;
});

const scopedApiCallsByApi = computed(() => scopedBotStatsRow.value?.api_calls_history_by_api ?? []);

const pluginRunMain = computed(() => pluginRunStatsScoped.value ?? pluginRunStats.value);

const scopedPluginRunRow = computed(() => {
  const acc = selectedAccount.value;
  const pr = pluginRunMain.value;
  if (acc == null || !pr?.bots?.length) return null;
  const sid = String(acc);
  return pr.bots.find((b) => b.self_id === sid) ?? null;
});

const scopedPluginPlugins = computed(() => scopedPluginRunRow.value?.plugins ?? []);

watch(
  () => scopedPluginPlugins.value.length,
  () => {
    scheduleAccountHeroLockMeasure();
  },
);

watch(socialBusy, (busy, wasBusy) => {
  if (wasBusy && !busy) scheduleAccountHeroLockMeasure();
});

const scopedMatcherRunsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_runs_by_plugin ?? []);

const scopedMatcherErrorsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_errors_by_plugin ?? []);

const scopedMatcherAvgDurationByPlugin = computed(
  () => scopedPluginRunRow.value?.matcher_avg_duration_ms_by_plugin ?? [],
);

const scopedMatcherDurationMsByPlugin = computed(
  () => scopedPluginRunRow.value?.matcher_duration_ms_by_plugin ?? [],
);

const scopedMatcherErrorLog = computed(() => scopedPluginRunRow.value?.matcher_error_log ?? []);

const scopedMatcherDurationLog = computed(() => scopedPluginRunRow.value?.matcher_duration_log ?? []);

/** 图表工具栏旁小字：API 今日调用次数片段（与 message-stats 账户行一致） */
const chartToolbarSummaryApi = computed(() => {
  const row = scopedBotStatsRow.value;
  if (row == null) return "";
  const n = row.today_api_calls;
  if (n == null) return "API —";
  const num = Number(n);
  if (!Number.isFinite(num)) return "API —";
  return `API ${Math.floor(num)}`;
});

/** 图表工具栏旁小字：插件 Matcher 今日次数片段（与 plugin-run-stats 账户行一致） */
const chartToolbarSummaryPlugin = computed(() => {
  const row = scopedPluginRunRow.value;
  if (row == null) return "";
  const n = row.runs_today;
  if (n == null) return "插件 —";
  const num = Number(n);
  if (!Number.isFinite(num)) return "插件 —";
  return `插件 ${Math.floor(num)}`;
});

/** 图表工具栏旁小字：今日有耗时样本的插件简单平均 Matcher 耗时 */
const chartToolbarSummaryDuration = computed(() => {
  const plugins = scopedPluginPlugins.value;
  if (!plugins.length) return "";
  let sum = 0;
  let cnt = 0;
  for (const p of plugins) {
    const avg = p.avg_duration_ms_today;
    if (avg != null && Number.isFinite(avg) && avg > 0) {
      sum += avg;
      cnt += 1;
    }
  }
  if (cnt <= 0) return "";
  const ms = Math.round(sum / cnt);
  if (ms >= 1000) return `均耗 ${(ms / 1000).toFixed(1)}s`;
  return `均耗 ${ms}ms`;
});

function formatMatcherErrorAt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}

const pluginRunTimeSamples = ref<PluginRunSample[]>([]);

function syncPluginRunSeriesFromStorage() {
  const acc = selectedAccount.value;
  pluginRunTimeSamples.value = acc != null ? readPluginRunSeries(String(acc)) : [];
}

const msgCapacityHint = computed(() => {
  const s = msgMainStats.value;
  if (!s || (s.today_received == null && s.today_sent == null)) return "全部账号合计";
  return `本日收 ${s.today_received ?? "—"} / 发 ${s.today_sent ?? "—"}（合计）`;
});

async function refreshSelectedBotDetails() {
  const acc = selectedAccount.value;
  if (acc == null) {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    consoleDailyStats.value = null;
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
      fetchMessageStats(acc),
      fetchPluginRunStats(acc),
      fetchConsoleDailyStats({ selfId: acc }),
      fetchFriendList(acc),
      fetchGroupList(acc),
      fetchRequestOverview(),
    ]);
    function take<T>(i: number): T | null {
      const r = settled[i];
      return r.status === "fulfilled" ? (r.value as T) : null;
    }
    statsScoped.value = take<MessageStatsData>(0);
    pluginRunStatsScoped.value = take<PluginRunStatsData>(1);
    consoleDailyStats.value = take<ConsoleDailyStatsData>(2);
    friendSnap.value = take<FriendListData>(3);
    groupSnap.value = take<GroupListData>(4);
    requestOverviewSnap.value = take<RequestOverviewData>(5);
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
      cachePutRequestOverview(requestOverviewSnap.value);
    }
  } finally {
    socialBusy.value = false;
  }
}

watch(selectedAccount, (acc, prev) => {
  accountPickerOpen.value = false;
  if (prev != null && acc != null && prev !== acc) {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    consoleDailyStats.value = null;
    const sidKey = String(acc);
    const cachedLists = cacheTryGetFriendGroupLists(sidKey);
    if (cachedLists) {
      friendSnap.value = cachedLists.friends;
      groupSnap.value = cachedLists.groups;
    } else {
      friendSnap.value = null;
      groupSnap.value = null;
    }
    const cachedOv = cacheTryGetRequestOverview();
    if (cachedOv) requestOverviewSnap.value = cachedOv;
    else requestOverviewSnap.value = null;
  }
  syncPluginRunSeriesFromStorage();
  void refreshSelectedBotDetails();
});

watch([scopedPluginRunRow, selectedAccount, socialBusy], ([row, acc, busy]) => {
  if (busy || acc == null || !row) return;
  pushPluginRunSample(String(acc), row.runs_today, row.plugins ?? []);
  syncPluginRunSeriesFromStorage();
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

async function load() {
  if (overviewBusy.value) return;
  err.value = "";
  overviewBusy.value = true;
  try {
    const [h, s, m, pr, botList, inst, pl, botCh, webCh] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchPluginRunStats(),
      fetchBots(),
      fetchInstances(),
      fetchPlugins(),
      fetchBotUpdateCheck().catch(() => null),
      fetchUpdateCheck().catch(() => null),
    ]);
    health.value = h;
    botUpdateCheck.value = (botCh as BotUpdateCheckData | null) ?? null;
    webUpdateCheck.value = (webCh as UpdateCheckData | null) ?? null;
    system.value = s;
    stats.value = m;
    pluginRunStats.value = pr;
    bots.value = botList;
    instances.value = inst;
    pluginsList.value = pl;
    botCount.value = botList.length;
    const accBefore = selectedAccount.value;
    ensureSelectedAccount();
    const accAfter = selectedAccount.value;
    pageReady.value = true;
    if (accBefore === accAfter) {
      void refreshSelectedBotDetails();
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    pageReady.value = true;
  } finally {
    overviewBusy.value = false;
  }
}

async function refreshSystemRuntimeOnly() {
  try {
    const s = await fetchSystem();
    system.value = s;
  } catch {
    /* 保留上一次 system */
  }
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
  <div
    class="home-page"
    :aria-busy="overviewBusy || undefined"
  >
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="4"
    />
    <Transition name="home-shell-fade">
      <div
        v-if="pageReady"
        class="home-page__body"
        :class="{ 'home-page__body--syncing': overviewBusy }"
      >
        <p
          v-if="overviewBusy"
          class="home-page__sync-line muted"
          role="status"
        >正在同步概况…</p>
    <div class="home-dashboard">
      <section class="home-dashboard__accounts">
        <div class="panel home-page__panel">
          <div class="panel__hd home-account-panel__hd panel__hd--split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">◎</span>账户信息
              <RefreshIconButton
                :busy="overviewBusy"
                label="刷新概况"
                @click="load"
              />
            </h2>
            <div class="row-actions">
              <PanelSidebarAdd main-path="/" />
              <RouterLink
                class="home-instances-capsule"
                to="/instances"
              >实例与连接</RouterLink>
            </div>
          </div>
          <div class="panel__bd">
            <p
              v-if="!sortedDbBots.length"
              class="muted"
              style="margin: 0"
            >
              数据库中暂无 Bot 配置记录。请在后端创建 <code>bot_config</code> 后刷新。
            </p>
            <template v-else>
              <div
                v-if="selectedAccount != null"
                class="home-account-split-bd"
                :style="accountUnifiedHeroLockStyle"
              >
                <div
                  ref="accountCardRef"
                  class="home-account-split-bd__col home-account-split-bd__col--hero home-account-card home-account-hero--color"
                >
                  <div class="home-account-hero__lead">
                        <div class="home-account-hero__avatar">
                          <img
                            :src="qqAvatarUrl(selectedAccount)"
                            alt=""
                            width="76"
                            height="76"
                            decoding="async"
                            referrerpolicy="no-referrer"
                            @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"
                          >
                        </div>
                        <div class="home-account-hero__main">
                          <div
                            ref="accountPickerRoot"
                            class="home-account-hero__picker"
                          >
                            <div class="home-account-hero__title home-account-hero__title--picker">
                              <span class="home-account-hero__title-name">{{ dbNick(selectedAccount) || "BOT" }}</span>
                              <button
                                v-if="sortedDbBots.length > 1"
                                type="button"
                                class="home-account-hero__picker-toggle"
                                :aria-expanded="accountPickerOpen"
                                aria-haspopup="listbox"
                                aria-label="切换账号"
                                @click="toggleAccountPicker"
                              >
                                <span
                                  class="home-account-hero__picker-caret"
                                  aria-hidden="true"
                                />
                              </button>
                              <button
                                v-if="selectedAccount != null"
                                type="button"
                                class="home-account-hero__fav-star"
                                :aria-pressed="botFavoriteAccounts.has(selectedAccount)"
                                :title="botFavoriteAccounts.has(selectedAccount) ? '取消收藏' : '收藏该 Bot'"
                                @click.stop="toggleFavoriteBot(selectedAccount)"
                              >
                                ★
                              </button>
                              <span
                                v-if="selectedConnected"
                                class="home-account-conn-pill home-account-conn-pill--on"
                                aria-label="已连接"
                              >
                                <span class="home-account-conn-pill__txt">已连接</span>
                                <span
                                  class="home-account-conn-pill__dot"
                                  aria-hidden="true"
                                />
                              </span>
                              <span
                                v-else
                                class="home-account-conn-pill home-account-conn-pill--off"
                                aria-label="未连接"
                              >
                                <span class="home-account-conn-pill__txt">未连接</span>
                              </span>
                            </div>
                            <div
                              v-if="accountPickerOpen && sortedDbBots.length > 1"
                              class="home-account-hero__picker-menu"
                              role="listbox"
                              aria-label="选择 Bot 账号"
                            >
                              <div
                                v-for="c in sortedDbBots"
                                :key="c.account"
                                class="home-account-hero__picker-item"
                                :class="{ 'is-active': c.account === selectedAccount }"
                                role="option"
                                :aria-selected="c.account === selectedAccount"
                              >
                                <button
                                  type="button"
                                  class="home-account-hero__picker-item-hit"
                                  @click="pickAccountFromList(c.account)"
                                >
                                  <span
                                    class="home-account-hero__picker-item-avatar"
                                    aria-hidden="true"
                                  >
                                    <img
                                      :src="qqAvatarUrl(c.account)"
                                      alt=""
                                      width="32"
                                      height="32"
                                      decoding="async"
                                      referrerpolicy="no-referrer"
                                      @error="($event.target as HTMLImageElement).style.visibility = 'hidden'"
                                    >
                                  </span>
                                  <span class="home-account-hero__picker-item-text">
                                    <span class="home-account-hero__picker-item-main">{{ dbNick(c.account) || "BOT" }}</span>
                                    <span class="home-account-hero__picker-item-sub muted">{{ c.account }}</span>
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  class="home-account-hero__fav-star home-account-hero__fav-star--sm"
                                  :aria-pressed="botFavoriteAccounts.has(c.account)"
                                  :title="botFavoriteAccounts.has(c.account) ? '取消收藏' : '收藏'"
                                  @click.stop="toggleFavoriteBot(c.account)"
                                >
                                  ★
                                </button>
                              </div>
                            </div>
                          </div>
                          <p class="home-account-hero__sub muted">账号 {{ selectedAccount }}</p>
                          <p class="home-account-hero__proto">
                            <RouterLink
                              class="home-account-hero__proto-link"
                              :to="{ name: 'protocol' }"
                            >
                              <template v-if="!accountProtocolIsUnknown">
                                协议 · {{ accountAdapterDisplay }}
                              </template>
                              <template v-else>
                                协议 · <span class="home-account-hero__proto-hint">未上报</span>
                              </template>
                            </RouterLink>
                          </p>
                          <p class="home-account-hero__admin home-account-hero__admin--under-proto">
                            <span class="home-account-hero__admin-label">管理员</span>
                            <span
                              class="home-account-hero__admin-values"
                              :class="{ 'home-account-hero__admin-values--placeholder': !(selectedBotConfig?.admins?.length) }"
                            >{{ selectedAdminsDisplay }}</span>
                          </p>
                        </div>
                      </div>
                      <div
                        class="home-account-hero__detail home-account-hero__detail--social-usage"
                      >
                        <div
                          class="home-account-hero__social-panel"
                          aria-label="好友与群聊"
                        >
                          <div class="home-account-hero__counts-chips home-account-hero__counts-chips--social">
                            <div class="home-account-hero__counts-chip">
                              <span class="home-account-hero__counts-chip__k">好友</span>
                              <strong
                                class="home-account-hero__counts-num home-account-hero__counts-chip__v"
                                :class="{ 'home-account-hero__counts-num--pending': friendCountNumPending }"
                              >{{ friendCountDisplay }}</strong>
                            </div>
                            <div class="home-account-hero__counts-chip">
                              <span class="home-account-hero__counts-chip__k">群聊</span>
                              <strong
                                class="home-account-hero__counts-num home-account-hero__counts-chip__v"
                                :class="{ 'home-account-hero__counts-num--pending': groupCountNumPending }"
                              >{{ groupCountDisplay }}</strong>
                            </div>
                          </div>
                          <div
                            class="home-account-hero__social-pending-wrap"
                            aria-label="待处理请求"
                          >
                            <div class="home-account-hero__social-pending">
                              <div class="home-account-hero__pending-shell">
                                <div class="home-account-hero__pending-card">
                                  <div class="home-account-hero__pending-title home-account-hero__pending-title--friend">好友申请</div>
                                  <div class="home-account-hero__pending-val">
                                    <RouterLink
                                      class="home-account-hero__pending-count-link home-account-hero__pending-count-link--single-line"
                                      :to="friendsGroupsFriendPendingTo"
                                    >
                                      <span class="home-account-hero__pending-line">{{ friendPendingLine }}</span>
                                    </RouterLink>
                                  </div>
                                </div>
                              </div>
                              <div class="home-account-hero__pending-shell">
                                <div class="home-account-hero__pending-card">
                                  <div class="home-account-hero__pending-title home-account-hero__pending-title--group">入群邀请</div>
                                  <div class="home-account-hero__pending-val">
                                    <RouterLink
                                      class="home-account-hero__pending-count-link home-account-hero__pending-count-link--single-line"
                                      :to="friendsGroupsGroupPendingTo"
                                    >
                                      <span class="home-account-hero__pending-line">{{ groupPendingLine }}</span>
                                    </RouterLink>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                  <div class="home-account-hero__matcher-stack">
                      <div
                        class="home-account-hero__matcher-foot"
                        :class="{
                          'home-account-hero__matcher-foot--bad':
                            (scopedPluginRunRow?.errors_today ?? 0) > 0,
                        }"
                      >
                        <span class="muted home-account-hero__matcher-foot__k">Matcher 异常（今日）</span>
                        <span class="home-account-hero__matcher-foot__v">{{
                          scopedPluginRunRow == null
                            ? "—"
                            : String(scopedPluginRunRow.errors_today ?? 0)
                        }}</span>
                      </div>
                      <details
                        v-if="scopedMatcherErrorLog.length"
                        class="home-account-hero__matcher-details muted"
                        @toggle="onMatcherDetailsToggle"
                      >
                        <summary class="home-account-hero__matcher-details-summary">最近异常（{{ scopedMatcherErrorLog.length }}）</summary>
                        <ul class="home-account-hero__matcher-details-list">
                          <li
                            v-for="(it, idx) in scopedMatcherErrorLog"
                            :key="`${it.at}-${idx}-${it.plugin}`"
                            class="home-account-hero__matcher-details-item"
                          >
                            <div class="home-account-hero__matcher-details-head">
                              <span>{{ formatMatcherErrorAt(it.at) }}</span>
                              <span class="home-account-hero__matcher-details-plugin">{{ it.plugin }}</span>
                              <span>{{ it.exc_type }}</span>
                            </div>
                            <div class="home-account-hero__matcher-details-msg">{{ it.message }}</div>
                            <pre class="home-account-hero__matcher-details-tb">{{ it.traceback }}</pre>
                          </li>
                        </ul>
                      </details>
                      <div
                        class="home-account-hero__session-meta muted"
                        aria-label="协议会话接入信息"
                      >
                        <div class="home-account-hero__session-meta-row">
                          <span class="home-account-hero__session-meta-k">连接时长</span>
                          <span class="home-account-hero__session-meta-v">{{ selectedConnDurationDisplay }}</span>
                        </div>
                        <div class="home-account-hero__session-meta-row">
                          <span class="home-account-hero__session-meta-k">连接日期</span>
                          <span class="home-account-hero__session-meta-v">{{ selectedConnDateDisplay }}</span>
                        </div>
                      </div>
                  </div>
                </div>
                <div class="home-account-split-bd__col home-account-split-bd__col--charts">
                    <div
                      class="home-account-charts-shell home-account-charts-shell--hero-side"
                      :style="accountChartsShellLockStyle"
                    >
                      <HomePluginRunCharts
                        :plugins="scopedPluginPlugins"
                        :plugins-meta="pluginsList"
                        :series="pluginRunTimeSamples"
                        :busy="socialBusy"
                        :api-history-by-api="scopedApiCallsByApi"
                        :api-history-bucket-sec="msgMainStats?.api_calls_history_bucket_sec"
                        :matcher-runs-by-plugin="scopedMatcherRunsByPlugin"
                        :matcher-errors-by-plugin="scopedMatcherErrorsByPlugin"
                        :matcher-avg-duration-ms-by-plugin="scopedMatcherAvgDurationByPlugin"
                        :matcher-duration-ms-by-plugin="scopedMatcherDurationMsByPlugin"
                        :matcher-duration-log="scopedMatcherDurationLog"
                        :matcher-duration-log-cap="scopedPluginRunRow?.matcher_duration_log_cap ?? 80"
                        :matcher-history-bucket-sec="pluginRunMain?.matcher_calls_history_bucket_sec"
                        :toolbar-summary-duration="chartToolbarSummaryDuration"
                        :daily-stat-rows="consoleDailyStats?.rows ?? []"
                        chart-filter-teleport="#home-account-chart-config-outlet"
                        :toolbar-summary-api="chartToolbarSummaryApi"
                        :toolbar-summary-plugin="chartToolbarSummaryPlugin"
                      />
                    </div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div
          v-if="selectedAccount != null && sortedDbBots.length"
          id="home-account-chart-config-outlet"
          class="home-account-chart-config-outlet"
        />
      </section>

      <section class="home-dashboard__capacity">
        <div class="grid-stats home-page__capacity-grid">
          <StatCard
            dense
            label="已加载插件"
            :value="system?.plugin_count ?? '—'"
            hint="进程内模块"
          />
          <StatCard
            dense
            label="在线 Bot"
            :value="botCount"
            :hint="`登记账号 ${system?.bot_count ?? '—'}`"
          />
          <StatCard
            dense
            label="消息 收/发"
            :value="msgTotalStr"
            :hint="msgCapacityHint"
          />
        </div>
      </section>

      <section class="home-dashboard__perf">
        <div class="panel home-page__panel">
          <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">▤</span>系统性能
            </h2>
            <div class="row-actions">
              <PanelSidebarAdd main-path="/" />
              <span class="home-page__hd-capsule home-page__hd-capsule--muted">节点采样</span>
            </div>
          </div>
          <div class="panel__bd">
            <p
              v-if="!perfSampled"
              class="muted home-page__empty"
            >
              当前未上报 CPU/内存/磁盘/GPU 等指标。请确认后端已启用系统快照并刷新。
            </p>
            <template v-else>
              <div class="home-metric-grid">
                <div class="home-metric home-metric--cpu">
                  <div class="home-metric__row">
                    <span class="home-metric__label">CPU</span>
                    <span class="home-metric__val">{{ cpuDisplay }}</span>
                  </div>
                  <div
                    v-if="cpuPerCorePercents.length"
                    class="home-cpu-cores"
                    role="img"
                    :aria-label="`共 ${cpuPerCorePercents.length} 个逻辑核心，柱高表示各核占用率`"
                  >
                    <div
                      v-for="(p, i) in cpuPerCorePercents"
                      :key="i"
                      class="home-cpu-core"
                      :title="`核心 ${i}：${p.toFixed(1)}%`"
                    >
                      <span
                        class="home-cpu-core__fill"
                        :style="{ height: `${Math.min(100, Math.max(0, p))}%` }"
                      />
                    </div>
                  </div>
                  <div
                    v-else-if="cpuBarPct != null"
                    class="home-metric__bar"
                    aria-hidden="true"
                  >
                    <span :style="{ width: `${cpuBarPct}%` }" />
                  </div>
                  <p
                    v-if="cpuFootHint"
                    class="home-metric__hint"
                  >
                    {{ cpuFootHint }}
                  </p>
                </div>
                <div class="home-metric">
                  <div class="home-metric__row">
                    <span class="home-metric__label">内存</span>
                    <span class="home-metric__val">{{ memDisplay }}</span>
                  </div>
                  <div
                    v-if="memBarPct != null"
                    class="home-metric__bar"
                    aria-hidden="true"
                  >
                    <span :style="{ width: `${memBarPct}%` }" />
                  </div>
                  <p
                    v-if="memHint"
                    class="home-metric__hint"
                  >
                    {{ memHint }}
                  </p>
                </div>
                <div class="home-metric">
                  <div class="home-metric__row">
                    <span class="home-metric__label">磁盘</span>
                    <span class="home-metric__val">{{ diskDisplay }}</span>
                  </div>
                  <div
                    v-if="diskBarPct != null"
                    class="home-metric__bar"
                    aria-hidden="true"
                  >
                    <span :style="{ width: `${diskBarPct}%` }" />
                  </div>
                  <p
                    v-if="diskHint"
                    class="home-metric__hint"
                  >
                    {{ diskHint }}
                  </p>
                </div>
                <div class="home-metric home-metric--plain">
                  <div class="home-metric__row">
                    <span class="home-metric__label">运行时长</span>
                    <span class="home-metric__val home-metric__val--sm">{{ uptimeDisplay }}</span>
                  </div>
                  <p
                    v-if="uptimeHint"
                    class="home-metric__hint"
                  >
                    {{ uptimeHint }}
                  </p>
                </div>
                <div
                  v-for="dev in gpuDevices"
                  :key="dev.index"
                  class="home-metric home-metric--gpu"
                >
                  <div class="home-metric__row">
                    <span class="home-metric__label">GPU {{ dev.index }}</span>
                    <span class="home-metric__val">{{ pct(dev.utilization_gpu) }}</span>
                  </div>
                  <p
                    class="home-metric__hint home-metric__hint--gpu-name"
                    :title="(dev.name || '').trim() || undefined"
                  >
                    {{ gpuNameShort(dev.name || '', 36) }}
                  </p>
                  <div
                    v-if="gpuUtilBarPct(dev.utilization_gpu) != null"
                    class="home-metric__bar"
                    aria-hidden="true"
                  >
                    <span :style="{ width: `${gpuUtilBarPct(dev.utilization_gpu)}%` }" />
                  </div>
                  <div class="home-metric__row home-metric__row--gpu-sub">
                    <span class="home-metric__label">显存</span>
                    <span class="home-metric__val home-metric__val--sm">{{
                      dev.memory_total > 0
                        ? pct((dev.memory_used / dev.memory_total) * 100)
                        : pct(dev.utilization_memory)
                    }}</span>
                  </div>
                  <div
                    v-if="gpuMemBarPct(dev.memory_used, dev.memory_total) != null"
                    class="home-metric__bar"
                    aria-hidden="true"
                  >
                    <span :style="{ width: `${gpuMemBarPct(dev.memory_used, dev.memory_total)}%` }" />
                  </div>
                  <p class="home-metric__hint">
                    {{ fmtBytes(dev.memory_used) }} / {{ fmtBytes(dev.memory_total) }}
                    <template v-if="dev.temperature != null"> · {{ tempDisplay(dev.temperature) }}</template>
                  </p>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>
    </div>

    <div class="panel home-page__panel home-page__version-panel">
      <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">◇</span>版本与运行环境
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/" />
          <span
            v-if="health?.ok"
            class="home-page__hd-capsule home-page__hd-capsule--ok"
          >API 连接</span>
        </div>
      </div>
      <div class="panel__bd muted home-page__version home-page__version--grid">
        <dl class="home-dl home-dl--version-rows home-version-dl">
          <dt>NoneBot2</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ nonebot2VersionDisplay }}</span>
            <span class="home-dl__sub muted">框架</span>
          </dd>
          <dt>Pallas-Bot</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ pallasBotVersionDisplay }}</span>
            <RouterLink
              v-if="botUpdateCheck?.has_update"
              class="home-version-update-link"
              to="/update#console-update-bot"
            >
              <span class="badge badge--warn">有更新</span>
              <span
                v-if="(botUpdateCheck?.latest_tag || '').trim()"
                class="home-version-update-meta muted"
              >{{ (botUpdateCheck?.latest_tag || "").trim() }}</span>
            </RouterLink>
            <span class="home-dl__sub muted">业务</span>
          </dd>
          <dt>控制台资源</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ consoleResourceVersionDisplay }}</span>
            <RouterLink
              v-if="webUpdateCheck?.has_update"
              class="home-version-update-link"
              to="/update#console-update-webui"
            >
              <span class="badge badge--warn">有更新</span>
              <span
                v-if="(webUpdateCheck?.latest_tag || '').trim()"
                class="home-version-update-meta muted"
              >{{ (webUpdateCheck?.latest_tag || "").trim() }}</span>
            </RouterLink>
          </dd>
          <dt>服务时间</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ versionServerTimeStr }}</span>
          </dd>
          <dt>主机 / Python</dt>
          <dd>
            <span class="home-dl__pill home-dl__pill--version">{{ system?.runtime?.hostname ?? "—" }}</span>
            <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ system?.runtime?.python ?? "—" }}</span>
          </dd>
        </dl>
      </div>
    </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.home-account-hero__title--picker .home-account-hero__fav-star {
  padding: 0 2px;
}
.home-account-hero__fav-star {
  flex-shrink: 0;
  margin: 0;
  padding: 6px 10px;
  font-size: 16px;
  line-height: 1;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.38;
}
.home-account-hero__fav-star:hover,
.home-account-hero__fav-star:focus-visible {
  background: transparent;
  box-shadow: none;
  opacity: 0.55;
}
.home-account-hero__fav-star--sm {
  padding: 4px 8px;
  font-size: 15px;
}
.home-account-hero__fav-star[aria-pressed="true"] {
  opacity: 1;
  color: #fbbf24;
}
</style>
