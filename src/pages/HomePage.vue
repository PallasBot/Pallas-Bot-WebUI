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
  fetchCommunityStats,
  fetchConsoleDailyStats,
  fetchCorpusStatus,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  fetchRequestOverview,
  fetchShardObservability,
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
  CommunityStatsData,
  CorpusSourceStatusData,
  CorpusStatusData,
  ConsoleDailyStatsData,
  MessageStatsData,
  PluginRow,
  PluginRunStatsData,
  RequestOverviewData,
  ShardObservabilityData,
  ShardObservabilityWorker,
  SystemData,
  UpdateCheckData,
} from "@/api/pallasTypes";
import StatCard from "@/components/StatCard.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import ConsoleDevModePanel from "@/components/ConsoleDevModePanel.vue";
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
import { displayVersionWithoutSha, pallasBotVersionLabel } from "@/utils/versionDisplay";
import { patchConsoleMeta } from "@/state/consoleMeta";
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
const shardObs = ref<ShardObservabilityData | null>(null);
const communityStats = ref<CommunityStatsData | null>(null);
const corpusStatus = ref<CorpusStatusData | null>(null);
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
const accountHeroLockHeightPx = ref(loadStoredAccountHeroLockPx());
/** 锁高已稳定（刷新先用 localStorage，数据就绪后重测一次） */
const accountHeroLockSealed = ref(accountHeroLockHeightPx.value >= 120);

const CHART_DRAW_EXPANDED_KEY = "pallas_home_chart_draw_expanded_v1";
const CHART_FILTER_EXPANDED_KEY = "pallas_home_chart_filter_expanded_v1";
const ACCOUNT_HERO_LOCK_HEIGHT_KEY = "pallas_home_account_hero_lock_px_v1";
/** 宽屏图表区与账户区对齐时的最小锁高（给图表更多纵向空间） */
const ACCOUNT_HERO_LOCK_MIN_PX = 420;
/** 宽屏展开选项条时图表壳底部预留固定高度（可滚动） */
const ACCOUNT_CHART_FILTER_SLOT_PX = 132;

function effectiveAccountHeroLockPx(raw: number): number {
  if (!Number.isFinite(raw) || raw < 120) return 0;
  return Math.max(Math.round(raw), ACCOUNT_HERO_LOCK_MIN_PX);
}

function loadStoredAccountHeroLockPx(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const n = Number(localStorage.getItem(ACCOUNT_HERO_LOCK_HEIGHT_KEY));
    if (Number.isFinite(n) && n >= 120 && n <= 2400) return effectiveAccountHeroLockPx(n);
  } catch {
    /* ignore */
  }
  return 0;
}

function saveStoredAccountHeroLockPx(h: number) {
  if (typeof localStorage === "undefined") return;
  try {
    const eff = effectiveAccountHeroLockPx(h);
    if (eff >= 120) localStorage.setItem(ACCOUNT_HERO_LOCK_HEIGHT_KEY, String(eff));
  } catch {
    /* ignore */
  }
}

function loadAccountChartsDrawExpanded(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const v = localStorage.getItem(CHART_DRAW_EXPANDED_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

function loadAccountChartsFilterExpanded(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    if (localStorage.getItem(CHART_FILTER_EXPANDED_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

const accountChartsDrawExpanded = ref(loadAccountChartsDrawExpanded());
const accountChartsFilterExpanded = ref(loadAccountChartsFilterExpanded());

const accountHeroHeightCapActive = computed(
  () => accountHeroLockHeightPx.value >= 120 && typeof window !== "undefined" && window.matchMedia("(min-width: 561px)").matches,
);

const accountHeroLockHeightEffectivePx = computed(() =>
  effectiveAccountHeroLockPx(accountHeroLockHeightPx.value),
);

/** 硬上限：仅在图表收起时更新，值为左侧账户区高度（≈ 无图表展开时的整块高度） */
const accountUnifiedHeroLockStyle = computed((): Record<string, string> => {
  if (!accountHeroHeightCapActive.value) return {};
  return { "--home-account-hero-lock-px": `${accountHeroLockHeightEffectivePx.value}px` };
});

/** 图表壳层直接写死 px，避免 flex 子项 min-height:auto 撑破 max-height 变量 */
const accountChartsShellLockStyle = computed((): Record<string, string> => {
  if (typeof window === "undefined") return {};
  if (!window.matchMedia("(min-width: 561px)").matches) return {};
  if (!accountChartsDrawExpanded.value) {
    return { minHeight: "0", height: "auto", maxHeight: "none" };
  }
  const h = accountHeroLockHeightEffectivePx.value;
  if (h < 120) return {};
  const style: Record<string, string> = {
    height: `${h}px`,
    maxHeight: `${h}px`,
    minHeight: "0",
    overflow: "hidden",
  };
  if (accountChartsFilterExpanded.value) {
    style["--home-account-chart-filter-slot-px"] = `${ACCOUNT_CHART_FILTER_SLOT_PX}px`;
  }
  return style;
});

function onAccountChartsDrawToggle(expanded: boolean) {
  accountChartsDrawExpanded.value = expanded;
  if (!expanded) {
    accountHeroLockSealed.value = false;
    scheduleAccountHeroLockMeasure(true);
    return;
  }
  applyStoredAccountHeroLock();
}

function onAccountChartsFilterToggle(expanded: boolean) {
  accountChartsFilterExpanded.value = expanded;
}

/** 锁账户卡自然高度；有封存锁高时默认不重测，避免刷新后布局跳动 */
function measureAccountHeroLockHeight(force = false) {
  if (typeof window === "undefined") return;
  if (!window.matchMedia("(min-width: 561px)").matches) {
    accountHeroLockHeightPx.value = 0;
    accountHeroLockSealed.value = false;
    return;
  }
  const el = accountCardRef.value;
  if (!el) {
    if (force) {
      accountHeroLockHeightPx.value = 0;
      accountHeroLockSealed.value = false;
    }
    return;
  }
  if (!force && accountHeroLockSealed.value && accountHeroLockHeightPx.value >= 120) {
    return;
  }
  const h = Math.round(el.getBoundingClientRect().height);
  if (h < 120) return;
  const eff = effectiveAccountHeroLockPx(h);
  accountHeroLockHeightPx.value = eff;
  saveStoredAccountHeroLockPx(eff);
  accountHeroLockSealed.value = true;
}

function scheduleAccountHeroLockMeasure(force = false) {
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        measureAccountHeroLockHeight(force);
      });
    });
  });
}

function applyStoredAccountHeroLock() {
  const stored = loadStoredAccountHeroLockPx();
  if (stored >= 120) {
    accountHeroLockHeightPx.value = stored;
    accountHeroLockSealed.value = true;
    return true;
  }
  accountHeroLockSealed.value = false;
  return false;
}

/** matcher 异常 details 开合会改变左侧卡高，需重测硬上限 */
function onMatcherDetailsToggle() {
  accountHeroLockSealed.value = false;
  scheduleAccountHeroLockMeasure(true);
}

watchEffect((onCleanup) => {
  if (typeof window === "undefined") return;
  if (selectedAccount.value == null) {
    accountHeroLockHeightPx.value = 0;
    accountHeroLockSealed.value = false;
    return;
  }
  if (!pageReady.value) {
    applyStoredAccountHeroLock();
    return;
  }
  const el = accountCardRef.value;
  if (!el) return;
  const mql = window.matchMedia("(min-width: 561px)");
  const mqlRow = window.matchMedia("(min-width: 1200px)");
  const onMql = () => {
    accountHeroLockSealed.value = false;
    scheduleAccountHeroLockMeasure(true);
  };
  mql.addEventListener("change", onMql);
  mqlRow.addEventListener("change", onMql);
  const ro = new ResizeObserver(() => {
    if (accountHeroLockSealed.value) return;
    measureAccountHeroLockHeight(false);
  });
  ro.observe(el);
  if (!applyStoredAccountHeroLock()) {
    scheduleAccountHeroLockMeasure(false);
  }
  onCleanup(() => {
    ro.disconnect();
    mql.removeEventListener("change", onMql);
    mqlRow.removeEventListener("change", onMql);
  });
});

watch(selectedAccount, (acc) => {
  if (acc == null) {
    accountHeroLockHeightPx.value = 0;
    accountHeroLockSealed.value = false;
    return;
  }
  if (!applyStoredAccountHeroLock()) {
    scheduleAccountHeroLockMeasure(false);
  }
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
const webuiDevModeActive = computed(() => Boolean(system.value?.console?.pallas_webui_dev_mode));

function onWebuiDevModeUpdated(active: boolean) {
  if (!system.value) return;
  system.value = {
    ...system.value,
    console: { ...(system.value.console ?? {}), pallas_webui_dev_mode: active },
  };
}

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

/** API 返回 0–1 比率（如 claim_hit_rate），需乘 100 再显示为百分数。 */
function ratioPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

const shardObsVisible = computed(() => shardObs.value?.sharded === true);

const shardIngressHitRate = computed(() =>
  ratioPct(shardObs.value?.ingress_cluster?.claim_hit_rate ?? null),
);

const shardIngressEvents = computed(() => {
  const ing = shardObs.value?.ingress_cluster;
  if (!ing) return "—";
  return String(ing.events ?? 0);
});

const shardIngressGateHint = computed(() => {
  const ing = shardObs.value?.ingress_cluster;
  if (!ing) return "代表牛 claim 成功 ÷（成功+失败）";
  const won = ing.claim_won ?? 0;
  const lost = ing.claim_lost ?? 0;
  return `成功 ${won} · 失败 ${lost}`;
});

const shardIngressEventsHint = computed(() => {
  const ing = shardObs.value?.ingress_cluster;
  if (!ing) return "今日进入门控的入站消息";
  const early = (ing.early_fleet ?? 0) + (ing.early_not_at_target ?? 0);
  const parts: string[] = [];
  const fanout = ing.fanout_bypass ?? 0;
  if (fanout > 0) parts.push(`全员同响 ${fanout}`);
  if (early > 0) parts.push(`提前丢弃 ${early}`);
  return parts.length ? parts.join(" · ") : "无 fanout / 提前丢弃";
});

const shardCoordValue = computed(() => {
  const c = shardObs.value?.coord_pending_live;
  if (!c) return "—";
  const actionable = c.actionable_total ?? c.bot_action_open;
  if (actionable != null) return String(actionable);
  return String(c.total_json ?? 0);
});

const shardCoordHint = computed(() => {
  const c = shardObs.value?.coord_pending_live;
  if (!c) return "扫描 data/pallas_shard/coord";
  const parts = [`bot_action 待办 ${c.bot_action_open ?? 0}`];
  const stale = c.bot_action_stale_open ?? 0;
  if (stale > 0) parts.push(`超时 ${stale}`);
  const hist = c.historical_retained;
  if (hist != null && hist > 0) parts.push(`历史残留 ${hist}`);
  return parts.join(" · ");
});

const shardPgPeakValue = computed(() => {
  const p = shardObs.value?.pg_pool;
  if (p?.estimated_pg_connections_peak == null) return "—";
  return `~${p.estimated_pg_connections_peak}`;
});

const shardPgHint = computed(() => {
  const p = shardObs.value?.pg_pool;
  if (!p) return "宜低于 PostgreSQL max_connections";
  const warning = (p.warning || "").trim();
  if (warning) return warning;
  return `${p.estimated_processes ?? "?"} 进程 · 单进程上限 ${p.per_process_max ?? "?"}`;
});

const shardPgHintTitle = computed(() => {
  if (!shardPgHintWarn.value) return undefined;
  return shardPgHint.value;
});

const shardPgHintWarn = computed(() => Boolean((shardObs.value?.pg_pool?.warning || "").trim()));

const shardWorkerRows = computed((): ShardObservabilityWorker[] => {
  const rows = shardObs.value?.workers;
  return Array.isArray(rows) ? rows : [];
});

function shardWorkerHitRate(row: ShardObservabilityWorker): string {
  const ing = row.ingress;
  if (!ing) return "无数据";
  return ratioPct(ing.claim_hit_rate ?? null);
}

function shardWorkerCell(row: ShardObservabilityWorker, field: "claim_won" | "claim_lost"): string {
  const ing = row.ingress;
  if (!ing) return "—";
  return String(ing[field] ?? 0);
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

/** 全 Bot 合计（容量区）；始终用首屏/轮询的全量 message-stats */
const clusterMessageStats = computed(() => stats.value);

/** 当前账号 message-stats（账户卡、协议 API 时序）；优先 statsScoped */
const accountMessageStats = computed(() => statsScoped.value ?? stats.value);

const msgTotalStr = computed(() => {
  const s = clusterMessageStats.value;
  if (!s) return "—";
  return `${s.total_received} / ${s.total_sent}`;
});

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

const communityDeploymentsTotal = computed(() =>
  formatCommunityStatNum(communityStats.value?.deployments_total),
);
const communityDeploymentsOnline = computed(() =>
  formatCommunityStatNum(communityStats.value?.deployments_online),
);
const communityBotsOnlineSum = computed(() =>
  formatCommunityStatNum(communityStats.value?.bots_online_sum),
);

const communityOnlineHint = computed(() => {
  const sec = communityStats.value?.online_ttl_sec;
  if (sec == null || !Number.isFinite(sec) || sec < 60) return "有心跳窗口内";
  const m = Math.max(1, Math.round(sec / 60));
  return `近 ${m} 分钟有心跳`;
});

const communityDeploymentsTotalHint = computed(() => "历史独立安装累计上报");

const communityDeploymentsOnlineHint = computed(
  () => `${communityOnlineHint.value}  活跃独立安装`,
);

const communityBotsOnlineHint = computed(() => {
  const sum = communityStats.value?.bots_online_sum;
  const onlineDep = communityStats.value?.deployments_online;
  if (
    sum != null &&
    Number.isFinite(sum) &&
    onlineDep != null &&
    onlineDep > 0 &&
    Number.isFinite(onlineDep)
  ) {
    const avg = sum / onlineDep;
    const avgText = avg >= 10 ? Math.round(avg).toString() : avg.toFixed(1);
    return `各部署在线合计  均约 ${avgText} 个/部署`;
  }
  return "各部署在线 Bot 合计";
});

const communityShardedOnline = computed(() =>
  formatCommunityStatNum(communityStats.value?.deployments_online_sharded),
);

const communityShardWorkersSum = computed(() =>
  formatCommunityStatNum(communityStats.value?.shard_workers_online_sum),
);

const communityCorpusContexts = computed(() =>
  formatCommunityStatNum(communityStats.value?.corpus?.contexts_total),
);

const communityCorpusAnswers = computed(() =>
  formatCommunityStatNum(communityStats.value?.corpus?.answers_total),
);

const communityCorpusEnrollments = computed(() =>
  formatCommunityStatNum(communityStats.value?.corpus?.enrollments_total),
);

const communityExtendedStatsVisible = computed(() => {
  const s = communityStats.value;
  if (!s) return false;
  return (
    s.deployments_online_sharded != null ||
    s.shard_workers_online_sum != null ||
    (s.corpus != null &&
      (s.corpus.contexts_total > 0 ||
        s.corpus.answers_total > 0 ||
        s.corpus.enrollments_total > 0))
  );
});

const corpusStatusVisible = computed(() => corpusStatus.value != null);

const corpusMergeSummary = computed(() => {
  const c = corpusStatus.value;
  if (!c) return "";
  return `${c.merge_order.join(" → ")} · ${c.merge_strategy}`;
});

const corpusDeploymentShort = computed(() => {
  const id = (corpusStatus.value?.deployment.deployment_id || "").trim();
  if (!id) return "—";
  if (id.length <= 13) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
});

type CorpusSourceKey = "local" | "fed" | "community";

const corpusSourceRows = computed(() => {
  const sources = corpusStatus.value?.sources;
  if (!sources) return [] as Array<{ key: CorpusSourceKey; label: string; summary: string; active: boolean }>;
  const labels: Record<CorpusSourceKey, string> = {
    local: "local",
    fed: "fed",
    community: "community",
  };
  return (["local", "fed", "community"] as CorpusSourceKey[]).map((key) => {
    const src = sources[key];
    return {
      key,
      label: labels[key],
      summary: corpusSourceSummary(key, src),
      active: Boolean(src?.enabled && (key === "local" || src.readable || src.configured || src.enrolled)),
    };
  });
});

function corpusSourceSummary(key: CorpusSourceKey, src: CorpusSourceStatusData | undefined): string {
  if (!src) return "—";
  if (key === "local") return "本地 PG 读写";
  if (!src.enabled) return "未启用";
  if (key === "fed") {
    return src.configured ? "第二 PG（待接入）" : "未配置 PG_CORPUS_FED_*";
  }
  if (src.enrolled) {
    const write = src.contribute ? "写回开" : "写回关";
    return `已 enroll · ${write}`;
  }
  if (src.manual) return "手动 token";
  if (src.auto_enroll) return "auto enroll 待完成";
  return "未就绪";
}

const todayCallsStatValue = computed(() => {
  const api = clusterTodayApiCalls.value;
  const plug = clusterTodayPluginRuns.value;
  if (api == null && plug == null) return "—";
  const apiStr = api == null ? "—" : String(Math.floor(api));
  const plugStr = plug == null ? "—" : String(Math.floor(plug));
  return `API ${apiStr} · 插件 ${plugStr}`;
});

const todayCallsStatHint = computed(() => {
  const acc = selectedAccount.value;
  if (acc != null && scopedBotStatsRow.value) {
    return `全账号合计；${acc} 见账户卡`;
  }
  return "协议 API 与 Matcher（全账号今日）";
});

const scopedBotStatsRow = computed(() => {
  const acc = selectedAccount.value;
  const st = accountMessageStats.value;
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

watch(socialBusy, (busy, wasBusy) => {
  if (wasBusy && !busy && selectedAccount.value != null && !accountHeroLockSealed.value) {
    scheduleAccountHeroLockMeasure(false);
  }
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

const accountStatsBusy = computed(() => overviewBusy.value || socialBusy.value);

const accountTodayMsgDisplay = computed(() => {
  const b = scopedBotStatsRow.value;
  if (!b) return accountStatsBusy.value ? "…" : "—";
  const rx = b.today_received ?? "—";
  const tx = b.today_sent ?? "—";
  return `${rx} / ${tx}`;
});

const accountTodayApiCallsDisplay = computed(() => {
  const n = scopedBotStatsRow.value?.today_api_calls;
  if (n == null || !Number.isFinite(Number(n))) return accountStatsBusy.value ? "…" : "—";
  return String(Math.floor(Number(n)));
});

const accountTodayTopApiTitle = computed(() => {
  const b = scopedBotStatsRow.value;
  if (!b?.today_top_api?.trim()) return "";
  const cnt = b.today_top_api_count;
  const cntLabel = cnt == null || !Number.isFinite(Number(cnt)) ? "?" : String(Math.floor(Number(cnt)));
  return `今日最多：${b.today_top_api} · ${cntLabel} 次`;
});

const msgCapacityHint = computed(() => {
  const s = clusterMessageStats.value;
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
      fetchRequestOverview({ selfId: acc }),
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
      cachePutRequestOverview(requestOverviewSnap.value, acc);
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
    const cachedOv = cacheTryGetRequestOverview(acc);
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
    const [h, s, m, pr, botList, inst, pl, botCh, webCh, comm, shard, corpus] = await Promise.all([
      fetchHealth(),
      fetchSystem(),
      fetchMessageStats(),
      fetchPluginRunStats(),
      fetchBots(),
      fetchInstances(),
      fetchPlugins(),
      fetchBotUpdateCheck().catch(() => null),
      fetchUpdateCheck().catch(() => null),
      fetchCommunityStats().catch(() => null),
      fetchShardObservability().catch(() => null),
      fetchCorpusStatus().catch(() => null),
    ]);
    health.value = h;
    botUpdateCheck.value = (botCh as BotUpdateCheckData | null) ?? null;
    patchConsoleMeta(h, botUpdateCheck.value);
    webUpdateCheck.value = (webCh as UpdateCheckData | null) ?? null;
    system.value = s;
    communityStats.value = (comm as CommunityStatsData | null) ?? null;
    corpusStatus.value = (corpus as CorpusStatusData | null) ?? null;
    shardObs.value = (shard as ShardObservabilityData | null) ?? null;
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

async function refreshHomeRuntimePanels() {
  const [sys, obs, comm, corpus] = await Promise.allSettled([
    fetchSystem(),
    fetchShardObservability(),
    fetchCommunityStats(),
    fetchCorpusStatus(),
  ]);
  if (sys.status === "fulfilled") system.value = sys.value;
  if (obs.status === "fulfilled") shardObs.value = obs.value;
  if (comm.status === "fulfilled") communityStats.value = comm.value;
  if (corpus.status === "fulfilled") corpusStatus.value = corpus.value;
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

    <ConsoleDevModePanel
      v-if="pageReady && webuiDevModeActive"
      :active="webuiDevModeActive"
      :show-panel="false"
      @updated="onWebuiDevModeUpdated"
    />

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
      <div class="home-dashboard__hero">
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
              >数据库实例</RouterLink>
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
                :class="{ 'home-account-split-bd--lock-h': accountHeroHeightCapActive }"
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
                            width="96"
                            height="96"
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
                            class="home-account-hero__counts-chips home-account-hero__counts-chips--traffic"
                            aria-label="今日协议与消息"
                          >
                            <div
                              class="home-account-hero__counts-chip"
                              :title="accountTodayTopApiTitle || undefined"
                            >
                              <span class="home-account-hero__counts-chip__k">协议 API</span>
                              <strong class="home-account-hero__counts-num home-account-hero__counts-chip__v">{{
                                accountTodayApiCallsDisplay
                              }}</strong>
                            </div>
                            <div
                              class="home-account-hero__counts-chip"
                              :title="accountTodayMsgDisplay"
                            >
                              <span class="home-account-hero__counts-chip__k">消息</span>
                              <strong class="home-account-hero__counts-num home-account-hero__counts-chip__v">{{
                                accountTodayMsgDisplay
                              }}</strong>
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
                      <details
                        v-if="scopedMatcherErrorLog.length"
                        class="home-account-hero__matcher-details muted"
                        @toggle="onMatcherDetailsToggle"
                      >
                        <summary
                          class="home-account-hero__matcher-foot home-account-hero__matcher-details-summary"
                          :class="{
                            'home-account-hero__matcher-foot--bad':
                              (scopedPluginRunRow?.errors_today ?? 0) > 0,
                          }"
                        >
                          <span class="home-account-hero__matcher-foot__k">Matcher 异常（今日）</span>
                          <span class="home-account-hero__matcher-foot__v">{{
                            scopedPluginRunRow == null
                              ? "—"
                              : String(scopedPluginRunRow.errors_today ?? 0)
                          }}</span>
                          <span class="home-account-hero__matcher-foot__link muted">点击展开 traceback</span>
                        </summary>
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
                        v-else
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
                        <span
                          v-if="(scopedPluginRunRow?.errors_today ?? 0) > 0"
                          class="home-account-hero__matcher-foot__link muted"
                        >仅有计数，暂无 traceback 快照</span>
                      </div>
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
                        @draw-toggle="onAccountChartsDrawToggle"
                        @filter-toggle="onAccountChartsFilterToggle"
                        :plugins="scopedPluginPlugins"
                        :plugins-meta="pluginsList"
                        :series="pluginRunTimeSamples"
                        :busy="socialBusy"
                        :api-history-by-api="scopedApiCallsByApi"
                        :api-history-bucket-sec="accountMessageStats?.api_calls_history_bucket_sec"
                        :matcher-runs-by-plugin="scopedMatcherRunsByPlugin"
                        :matcher-errors-by-plugin="scopedMatcherErrorsByPlugin"
                        :matcher-avg-duration-ms-by-plugin="scopedMatcherAvgDurationByPlugin"
                        :matcher-duration-ms-by-plugin="scopedMatcherDurationMsByPlugin"
                        :matcher-duration-log="scopedMatcherDurationLog"
                        :matcher-duration-log-cap="scopedPluginRunRow?.matcher_duration_log_cap ?? 150"
                        :matcher-duration-log-per-plugin-cap="
                          scopedPluginRunRow?.matcher_duration_log_per_plugin_cap ?? 30
                        "
                        :matcher-history-bucket-sec="pluginRunMain?.matcher_calls_history_bucket_sec"
                        :matcher-errors-today="scopedPluginRunRow?.errors_today ?? 0"
                        :matcher-error-log="scopedMatcherErrorLog"
                        :daily-stat-rows="consoleDailyStats?.rows ?? []"
                      />
                    </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </section>

      <aside class="home-dashboard__aside">
      <section class="home-dashboard__community">
        <div class="panel home-page__panel home-dashboard__community-panel">
          <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">◎</span>社区统计
            </h2>
            <div class="row-actions">
              <span class="home-page__hd-capsule home-page__hd-capsule--muted">stats 中心</span>
            </div>
          </div>
          <div class="panel__bd">
            <div class="grid-stats home-dashboard__aside-stats">
              <StatCard
                dense
                label="社区部署总数"
                :value="communityDeploymentsTotal"
                :hint="communityDeploymentsTotalHint"
              />
              <StatCard
                dense
                label="在线部署数"
                :value="communityDeploymentsOnline"
                :hint="communityDeploymentsOnlineHint"
                :hint-title="communityDeploymentsOnlineHint"
              />
              <StatCard
                dense
                label="在线牛总和"
                :value="communityBotsOnlineSum"
                :hint="communityBotsOnlineHint"
                :hint-title="communityBotsOnlineHint"
              />
            </div>
            <div
              v-if="communityExtendedStatsVisible"
              class="grid-stats home-dashboard__community-ext"
            >
              <StatCard
                dense
                label="分片在线"
                :value="communityShardedOnline"
                hint="在线部署中启用分片"
              />
              <StatCard
                dense
                label="Worker 片数"
                :value="communityShardWorkersSum"
                hint="分片部署 worker 合计"
              />
              <StatCard
                dense
                label="语料 context"
                :value="communityCorpusContexts"
                hint="社区池触发词"
              />
              <StatCard
                dense
                label="语料 answer"
                :value="communityCorpusAnswers"
                :hint="`enroll ${communityCorpusEnrollments}`"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        v-if="corpusStatusVisible"
        class="home-dashboard__corpus"
      >
        <div class="panel home-page__panel">
          <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">⧉</span>语料源
            </h2>
            <div class="row-actions">
              <span
                class="home-page__hd-capsule"
                :class="corpusStatus?.composite_active ? 'home-page__hd-capsule--ok' : 'home-page__hd-capsule--muted'"
              >{{ corpusStatus?.composite_active ? "composite" : "local only" }}</span>
            </div>
          </div>
          <div class="panel__bd home-corpus__bd">
            <p class="home-corpus__lede muted">
              {{ corpusMergeSummary }} · 远端失败 {{ corpusStatus?.on_remote_failure }}
            </p>
            <dl class="home-dl home-corpus__meta">
              <dt>deployment</dt>
              <dd><code class="home-dl__code">{{ corpusDeploymentShort }}</code></dd>
              <dt v-if="corpusStatus?.sources.community.api_base">community API</dt>
              <dd v-if="corpusStatus?.sources.community.api_base">
                <code class="home-dl__code home-corpus__api">{{ corpusStatus?.sources.community.api_base }}</code>
              </dd>
            </dl>
            <div class="home-corpus__table-wrap">
              <table class="home-corpus__table">
                <thead>
                  <tr>
                    <th scope="col">源</th>
                    <th scope="col">状态</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in corpusSourceRows"
                    :key="row.key"
                  >
                    <td>
                      <span
                        class="home-corpus__badge"
                        :class="{ 'home-corpus__badge--on': row.active }"
                      >{{ row.label }}</span>
                    </td>
                    <td>{{ row.summary }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

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
              <span
                v-else-if="botUpdateCheck?.development_build"
                class="badge badge--dev home-version-dev-badge"
                :title="botDevelopmentBuildTitle"
              >开发构建</span>
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
            <dt>NoneBot 监听</dt>
            <dd>
              <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ nonebotListenDisplay }}</span>
            </dd>
            <dt>主机 / Python</dt>
            <dd>
              <span class="home-dl__pill home-dl__pill--version">{{ system?.runtime?.hostname ?? "—" }}</span>
              <span class="home-dl__pill home-dl__pill--version home-dl__pill--mono">{{ system?.runtime?.python ?? "—" }}</span>
            </dd>
            <dt>控制台鉴权</dt>
            <dd class="home-version-dev-mode">
              <ConsoleDevModePanel
                :active="webuiDevModeActive"
                compact
                :show-banner="false"
                @updated="onWebuiDevModeUpdated"
              />
            </dd>
          </dl>
        </div>
      </div>
      </aside>
      </div>

      <section class="home-dashboard__capacity">
        <div class="grid-stats home-page__capacity-grid home-page__capacity-grid--compact">
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
          <StatCard
            dense
            label="今日调用"
            :value="todayCallsStatValue"
            :hint="todayCallsStatHint"
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

      <section
        v-if="shardObsVisible"
        class="home-dashboard__shard-obs"
      >
        <div class="panel home-page__panel">
          <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <span class="panel__title-ico" aria-hidden="true">⎇</span>分片可观测
            </h2>
            <div class="row-actions">
              <span class="home-page__hd-capsule home-page__hd-capsule--muted">ingress / coord / PG</span>
            </div>
          </div>
          <div class="panel__bd home-shard-obs__bd">
            <div class="home-shard-obs__explain">
              <p class="home-shard-obs__explain-lede muted">
                分片模式下 hub 汇总各 worker 今日指标；ingress 仅代表牛计数，避免多牛重复放大。
              </p>
              <dl class="home-shard-obs__glossary">
                <div class="home-shard-obs__glossary-item">
                  <dt>Ingress 命中率</dt>
                  <dd>入站消息进 matcher 前，本片代表牛抢到处理权的比例；多 worker 时理想约 1÷活跃片数。</dd>
                </div>
                <div class="home-shard-obs__glossary-item">
                  <dt>Ingress 事件</dt>
                  <dd>今日进入 ingress 门控的消息总数；含全员同响放行与提前丢弃（非目标片 / fleet 过滤）。</dd>
                </div>
                <div class="home-shard-obs__glossary-item">
                  <dt>Coord 积压</dt>
                  <dd>跨 worker 协同目录 <code>coord/</code> 中的待办 JSON，如 bot_action 代发；含超时未完结与历史残留。</dd>
                </div>
                <div class="home-shard-obs__glossary-item">
                  <dt>PG 连接池</dt>
                  <dd>hub + worker 各进程 SQLAlchemy 连接池峰值粗算，应低于数据库 <code>max_connections</code>。</dd>
                </div>
              </dl>
            </div>
            <div class="grid-stats home-shard-obs__kpis">
              <StatCard
                dense
                label="Ingress 命中率"
                :value="shardIngressHitRate"
                :hint="shardIngressGateHint"
              />
              <StatCard
                dense
                label="Ingress 事件"
                :value="shardIngressEvents"
                :hint="shardIngressEventsHint"
              />
              <StatCard
                dense
                label="Coord 积压"
                :value="shardCoordValue"
                :hint="shardCoordHint"
              />
              <div :class="{ 'home-shard-obs__pg-warn': shardPgHintWarn }">
                <StatCard
                  dense
                  label="PG 连接池"
                  :value="shardPgPeakValue"
                  :hint="shardPgHint"
                  :hint-title="shardPgHintTitle"
                />
              </div>
            </div>
            <div
              v-if="shardWorkerRows.length"
              class="home-shard-obs__workers"
            >
              <p class="home-shard-obs__workers-title">各 worker 命中率（今日）</p>
              <p class="home-shard-obs__workers-desc muted">
                按 worker 汇总 ingress；「成功 / 失败」为该片代表牛 claim 次数。
              </p>
              <div class="home-shard-obs__table-wrap">
                <table class="home-shard-obs__table">
                  <thead>
                    <tr>
                      <th scope="col">Worker</th>
                      <th scope="col">命中率</th>
                      <th scope="col">成功</th>
                      <th scope="col">失败</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in shardWorkerRows"
                      :key="row.shard_id"
                    >
                      <td>worker-{{ row.shard_id }}</td>
                      <td>{{ shardWorkerHitRate(row) }}</td>
                      <td>{{ shardWorkerCell(row, 'claim_won') }}</td>
                      <td>{{ shardWorkerCell(row, 'claim_lost') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
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
