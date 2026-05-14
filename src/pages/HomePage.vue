<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { fetchHealth } from "@/api/health";
import type { HealthResponse } from "@/api/health";
import {
  fetchBots,
  fetchBotUpdateCheck,
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchPlugins,
  fetchRequestOverview,
  fetchSystem,
  fetchUpdateCheck,
} from "@/api/consoleApi";
import type {
  BotRow,
  BotUpdateCheckData,
  FriendListData,
  GroupListData,
  InstancesData,
  MessageStatsData,
  NapcatAccountRow,
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
import standeeUrl from "@/assets/pallas-standee.webp?url";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts } from "@/utils/botFavorites";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { protocolSnapshot, accountWebUiHref, protocolDashboardUrl } from "@/utils/protocolLinks";
import type { PluginRunSample } from "@/utils/pluginRunHistory";
import { pushPluginRunSample, readPluginRunSeries } from "@/utils/pluginRunHistory";
import { displayVersionWithoutSha } from "@/utils/versionDisplay";

/** 总览首屏当前选中的数据库 Bot 账号（刷新后恢复） */
const HOME_SELECTED_ACCOUNT_KEY = "pallas_home_selected_account_v1";

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
const botCount = ref(0);
const bots = ref<BotRow[]>([]);
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
  return (
    r.cpu_percent != null ||
    r.memory?.percent != null ||
    (r.memory?.used != null && r.memory?.total != null) ||
    r.disk?.percent != null ||
    (r.disk?.used != null && r.disk?.total != null) ||
    r.boot_time != null
  );
});

const cpuDisplay = computed(() => pct(runtime.value?.cpu_percent ?? null));
const memDisplay = computed(() => {
  const m = runtime.value?.memory;
  if (m?.percent != null) return pct(m.percent);
  if (m?.used != null && m?.total != null && m.total > 0) return pct((m.used / m.total) * 100);
  return "—";
});
const memHint = computed(() => {
  const m = runtime.value?.memory;
  if (!m) return undefined;
  return `${fmtBytes(m.used)} / ${fmtBytes(m.total)}`;
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

function napcatAccountMatchesBot(row: NapcatAccountRow, account: number): boolean {
  const sid = String(account);
  const q = row.qq != null ? String(row.qq).trim() : "";
  if (q && q === sid) return true;
  const id = row.id != null ? String(row.id).trim() : "";
  return id === sid;
}

const napcatSnap = computed(() => protocolSnapshot(instances.value));

const matchedNapcatRow = computed((): NapcatAccountRow | null => {
  const acc = selectedAccount.value;
  if (acc == null) return null;
  const rows = napcatSnap.value?.accounts ?? [];
  return rows.find((r) => napcatAccountMatchesBot(r, acc)) ?? null;
});

const accountAdapterDisplay = computed(() => {
  const acc = selectedAccount.value;
  if (acc == null) return "—";
  const raw = instances.value?.bot_profiles?.[String(acc)]?.adapter;
  const ad = raw != null ? String(raw).trim() : "";
  return ad || "—";
});

const nativeProtocolWebUiHref = computed(() => {
  const row = matchedNapcatRow.value;
  if (!row) return null;
  return accountWebUiHref(row, system.value);
});

const protocolBuiltInManageHref = computed(() => protocolDashboardUrl(system.value, napcatSnap.value));

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
const memBarPct = computed(() =>
  barPct(runtime.value?.memory?.percent ?? null, runtime.value?.memory?.used ?? null, runtime.value?.memory?.total ?? null),
);
const diskBarPct = computed(() =>
  barPct(runtime.value?.disk?.percent ?? null, runtime.value?.disk?.used ?? null, runtime.value?.disk?.total ?? null),
);

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
  if (socialBusy.value) return "…";
  if (friendSnap.value == null) return "未拉取";
  return String(friendSnap.value.friends?.length ?? 0);
});

const groupCountDisplay = computed(() => {
  if (socialBusy.value) return "…";
  if (groupSnap.value == null) return "未拉取";
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
  if (socialBusy.value) return "…";
  const r = scopedRequestOverviewRow.value;
  if (r == null) return "—";
  const p = r.pending_friend_requests?.length ?? 0;
  const d = r.doubt_friend_requests?.length ?? 0;
  return String(p + d);
});

const groupPendingApplyDisplay = computed(() => {
  if (socialBusy.value) return "…";
  const r = scopedRequestOverviewRow.value;
  if (r == null) return "—";
  return String(r.pending_group_requests?.length ?? 0);
});

const friendCountNumPending = computed(() => !socialBusy.value && friendSnap.value == null);
const groupCountNumPending = computed(() => !socialBusy.value && groupSnap.value == null);

const throughputTodayInline = computed(() => {
  if (socialBusy.value) return "…";
  const acc = selectedAccount.value;
  if (acc == null) return "";
  const r = scopedBotStatsRow.value;
  if (!r) return "";
  const tr = r.today_received;
  const ts = r.today_sent;
  if (tr == null && ts == null) return "本日收发在后端上报后显示";
  return `本日收 ${tr ?? "—"} · 发 ${ts ?? "—"}`;
});

const throughputHeadNote = computed(() => {
  if (socialBusy.value) return "正在拉取本 Bot 统计…";
  const acc = selectedAccount.value;
  if (acc == null) return "选中账号后展示本 Bot 吞吐与调用明细";
  const r = scopedBotStatsRow.value;
  if (!r) return "本账号暂无统计行，可稍后刷新";
  return "";
});

function metricIsEmpty(v: string): boolean {
  return v === "—";
}

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

const msgRecvSentPair = computed(() => {
  const s = msgMainStats.value;
  if (!s) return { recv: "—", sent: "—" };
  return {
    recv: s.total_received != null ? String(s.total_received) : "—",
    sent: s.total_sent != null ? String(s.total_sent) : "—",
  };
});

const scopedBotStatsRow = computed(() => {
  const acc = selectedAccount.value;
  const st = msgMainStats.value;
  if (acc == null || !st?.bots?.length) return null;
  const sid = String(acc);
  return st.bots.find((b) => b.self_id === sid) ?? null;
});

type ThroughputBarRect = { x: number; y: number; w: number; h: number };

type ThroughputBarBucket = { recv: ThroughputBarRect; sent: ThroughputBarRect };

const scopedMessageTrafficHistory = computed(() => scopedBotStatsRow.value?.message_traffic_history ?? []);

/** 吞吐迷你图高度（viewBox 与柱/折线计算共用） */
const THROUGHPUT_MINI_SVG_H = 34;

/** 迷你图横轴覆盖的时长（秒）；桶越细同屏桶数越多 */
const THROUGHPUT_CHART_VISIBLE_SEC = 6 * 3600;

/** 迷你图最多取的桶数（避免超宽屏仍一次拉满 24h 的 1 分钟桶） */
const THROUGHPUT_BAR_VISIBLE_BUCKETS_MAX = 480;

function throughputHistBucketSec(): number {
  const st = msgMainStats.value;
  const a = st?.message_traffic_history_bucket_sec;
  const b = st?.api_calls_history_bucket_sec;
  if (typeof a === "number" && a > 0) return a;
  if (typeof b === "number" && b > 0) return b;
  return 300;
}

function throughputVisibleBucketCount(): number {
  const bs = throughputHistBucketSec();
  const n = Math.ceil(THROUGHPUT_CHART_VISIBLE_SEC / bs);
  return Math.min(THROUGHPUT_BAR_VISIBLE_BUCKETS_MAX, Math.max(48, n));
}

function sliceThroughputBarPoints<T extends { at: number }>(arr: T[]): T[] {
  const maxN = throughputVisibleBucketCount();
  if (arr.length <= maxN) return arr;
  return arr.slice(-maxN);
}

const throughputSparklineMode = computed<"message" | "api" | null>(() => {
  if (socialBusy.value) return null;
  if (scopedMessageTrafficHistory.value.length) return "message";
  const pts = scopedBotStatsRow.value?.api_calls_history;
  return pts?.length ? "api" : null;
});

const throughputMessageBarBuckets = computed((): ThroughputBarBucket[] => {
  if (socialBusy.value) return [];
  const W = 100;
  const H = THROUGHPUT_MINI_SVG_H;
  const pad = 1.5;
  const bottom = H - pad;
  const chartH = H - 2 * pad;

  const pts = sliceThroughputBarPoints(scopedMessageTrafficHistory.value);
  if (!pts.length) return [];
  const recvVals = pts.map((p) => Number(p.received ?? 0));
  const sentVals = pts.map((p) => Number(p.sent ?? 0));
  const max = Math.max(...recvVals, ...sentVals, 1);
  const n = pts.length;
  const slot = (W - 2 * pad) / n;
  const bwScale = n > 120 ? 0.3 : n > 72 ? 0.34 : n > 48 ? 0.37 : n > 36 ? 0.4 : n > 24 ? 0.37 : 0.34;
  return pts.map((_, i) => {
    const r = recvVals[i]! / max;
    const s = sentVals[i]! / max;
    const bw = slot * bwScale;
    const gap = slot * Math.min(0.08, 0.12 - bwScale * 0.15);
    const left = pad + i * slot + (slot - 2 * bw - gap) / 2;
    const hr = Math.max(chartH * r, 0.4);
    const hs = Math.max(chartH * s, 0.4);
    return {
      recv: { x: left, y: bottom - hr, w: bw, h: hr },
      sent: { x: left + bw + gap, y: bottom - hs, w: bw, h: hs },
    };
  });
});

/** API 吞吐迷你图：折线（与消息柱图同 viewBox；有消息柱时在柱上叠画，按桶 at 对齐） */
const throughputApiLineModel = computed((): {
  polyline: string;
  areaPath: string;
} => {
  const empty = {
    polyline: "",
    areaPath: "",
  };
  if (socialBusy.value) return empty;

  const apiRaw = scopedBotStatsRow.value?.api_calls_history ?? [];
  const apiSlice = sliceThroughputBarPoints(apiRaw);
  if (!apiSlice.length) return empty;

  const W = 100;
  const H = THROUGHPUT_MINI_SVG_H;
  const pad = 1.5;
  const bottom = H - pad;
  const chartH = H - 2 * pad;

  const msgSlice = sliceThroughputBarPoints(scopedMessageTrafficHistory.value);
  let vals: number[];
  let n: number;
  if (msgSlice.length) {
    const apiByAt = new Map(apiSlice.map((p) => [p.at, Number(p.total ?? 0)]));
    vals = msgSlice.map((m) => apiByAt.get(m.at) ?? 0);
    n = vals.length;
    if (!vals.some((v) => v > 0)) return empty;
  } else {
    vals = apiSlice.map((p) => Number(p.total ?? 0));
    n = vals.length;
    if (!vals.some((v) => v > 0)) return empty;
  }

  const max = Math.max(...vals, 1);
  const slot = (W - 2 * pad) / n;
  const xy: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = pad + i * slot + slot / 2;
    const y = bottom - (vals[i]! / max) * chartH;
    xy.push({ x, y });
  }
  if (xy.length === 1) {
    return empty;
  }
  const polyline = xy.map((p) => `${p.x},${p.y}`).join(" ");
  const first = xy[0]!;
  const last = xy[xy.length - 1]!;
  let areaPath = "";
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i]!;
    areaPath += i === 0 ? `M${first.x},${bottom}L${p.x},${p.y}` : `L${p.x},${p.y}`;
  }
  areaPath += `L${last.x},${bottom}Z`;
  return { polyline, areaPath };
});

type ThroughputBarTick = { leftPct: number; label: string };

function localDayStartSec(tsSec: number): number {
  const d = new Date(tsSec * 1000);
  d.setHours(0, 0, 0, 0);
  d.setMilliseconds(0);
  return Math.floor(d.getTime() / 1000);
}

/** 将时刻向下对齐到 strideSec 的本地自然日偏移网格（stride 须整除 86400 或常用 60/300/3600） */
function alignDownLocalGrid(tsSec: number, strideSec: number): number {
  if (strideSec <= 0) return tsSec;
  const d0 = localDayStartSec(tsSec);
  const off = tsSec - d0;
  return d0 + Math.floor(off / strideSec) * strideSec;
}

/** 时间轴：按可视跨度自适应步长；minGap 须覆盖「HH:mm」居中占位，避免刻度挤成一团 */
const THROUGHPUT_AXIS_MAX_TICKS = 6;
const THROUGHPUT_AXIS_MIN_GAP_PCT = 15;

const THROUGHPUT_AXIS_STRIDE_CANDIDATES_SEC = [
  60, 120, 300, 600, 900, 1200, 1800, 3600, 7200, 14400, 28800, 43200, 86400,
] as const;

function throughputAxisStrideSec(rangeLo: number, rangeHi: number): number {
  const span = Math.max(rangeHi - rangeLo, 60);
  const minStride = span / THROUGHPUT_AXIS_MAX_TICKS;
  for (const c of THROUGHPUT_AXIS_STRIDE_CANDIDATES_SEC) {
    if (c >= minStride) return c;
  }
  // 跨度大于候选表最大步长时，86400 会小于 minStride，若仍用它会在循环里生成过多刻度
  return Math.max(60, Math.ceil(span / THROUGHPUT_AXIS_MAX_TICKS));
}

function thinThroughputTicksByMinGap(ticks: ThroughputBarTick[], minGapPct: number): ThroughputBarTick[] {
  const sorted = [...ticks].sort((a, b) => a.leftPct - b.leftPct);
  const out: ThroughputBarTick[] = [];
  let last = -Infinity;
  for (const t of sorted) {
    if (t.leftPct - last >= minGapPct - 0.05) {
      out.push(t);
      last = t.leftPct;
    }
  }
  return out;
}

/** 刻度已按步长生成但仍偏多时，沿时间轴均匀保留若干条，避免与柱宽解耦后标签互相遮挡 */
function capThroughputTickLabels(ticks: ThroughputBarTick[], maxN: number): ThroughputBarTick[] {
  if (ticks.length <= maxN) return ticks;
  const sorted = [...ticks].sort((a, b) => a.leftPct - b.leftPct);
  if (maxN <= 2) {
    return [sorted[0]!, sorted[sorted.length - 1]!];
  }
  const out: ThroughputBarTick[] = [];
  const lastIdx = sorted.length - 1;
  for (let k = 0; k < maxN; k++) {
    const idx = Math.round((k / (maxN - 1)) * lastIdx);
    out.push(sorted[idx]!);
  }
  const dedup: ThroughputBarTick[] = [];
  for (const t of out) {
    if (!dedup.length || Math.abs(dedup[dedup.length - 1]!.leftPct - t.leftPct) > 0.35) {
      dedup.push(t);
    }
  }
  return dedup.length ? dedup : sorted.slice(0, maxN);
}

function formatThroughputHistTick(atSec: number, rangeLo: number, rangeHi: number, strideSec: number): string {
  const a = new Date(atSec * 1000);
  const lo = new Date(rangeLo * 1000);
  const hi = new Date(rangeHi * 1000);
  const sameCal = (x: Date, y: Date) =>
    x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
  const sameDayLoHi = sameCal(lo, hi);
  const hm = `${a.getHours().toString().padStart(2, "0")}:${a.getMinutes().toString().padStart(2, "0")}`;
  if (strideSec < 3600 && sameDayLoHi && sameCal(a, lo)) {
    return hm;
  }
  if (strideSec < 86400 && sameDayLoHi && sameCal(a, lo)) {
    return `${a.getHours()}`;
  }
  return a.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const throughputBarTimeTicks = computed((): ThroughputBarTick[] => {
  if (socialBusy.value) return [];
  const mode = throughputSparklineMode.value;
  if (mode !== "message" && mode !== "api") return [];
  const pts =
    mode === "message"
      ? sliceThroughputBarPoints(scopedMessageTrafficHistory.value)
      : sliceThroughputBarPoints(scopedBotStatsRow.value?.api_calls_history ?? []);
  if (!pts.length) return [];
  const pad = 1.5;
  const W = 100;
  const inner = W - 2 * pad;
  const atOf = (p: { at: number }) => Number(p.at);
  const rangeLo = atOf(pts[0]!);
  const rangeHi = atOf(pts[pts.length - 1]!);
  const span = Math.max(rangeHi - rangeLo, 60);

  const strideSec = throughputAxisStrideSec(rangeLo, rangeHi);
  const raw: ThroughputBarTick[] = [];
  for (let t = alignDownLocalGrid(rangeLo, strideSec); t <= rangeHi + strideSec; t += strideSec) {
    const xNorm = (t - rangeLo) / span;
    if (xNorm < -0.02 || xNorm > 1.02) continue;
    const clamped = Math.max(0, Math.min(1, xNorm));
    const rawPct = ((pad + clamped * inner) / W) * 100;
    const leftPct = Math.min(96, Math.max(4, rawPct));
    raw.push({
      leftPct,
      label: formatThroughputHistTick(t, rangeLo, rangeHi, strideSec),
    });
  }

  let ticks = thinThroughputTicksByMinGap(raw, THROUGHPUT_AXIS_MIN_GAP_PCT);
  if (ticks.length > THROUGHPUT_AXIS_MAX_TICKS) {
    ticks = capThroughputTickLabels(ticks, THROUGHPUT_AXIS_MAX_TICKS);
    ticks = thinThroughputTicksByMinGap(ticks, THROUGHPUT_AXIS_MIN_GAP_PCT);
  }

  if (!ticks.length) {
    return [
      {
        leftPct: Math.min(96, Math.max(4, (pad / W) * 100)),
        label: formatThroughputHistTick(rangeLo, rangeLo, rangeHi, strideSec),
      },
      {
        leftPct: Math.min(96, Math.max(4, ((pad + inner) / W) * 100)),
        label: formatThroughputHistTick(rangeHi, rangeLo, rangeHi, strideSec),
      },
    ];
  }
  return ticks;
});

const showThroughputMiniChart = computed(
  () =>
    throughputMessageBarBuckets.value.length > 0 ||
    Boolean(throughputApiLineModel.value.polyline),
);

type ThroughputMiniLegendItem = { key: string; label: string; swatch: "recv" | "sent" | "api" };

const throughputMiniLegendItems = computed((): ThroughputMiniLegendItem[] => {
  const items: ThroughputMiniLegendItem[] = [];
  if (throughputMessageBarBuckets.value.length) {
    items.push({ key: "recv", label: "消息收", swatch: "recv" });
    items.push({ key: "sent", label: "消息发", swatch: "sent" });
  }
  const api = throughputApiLineModel.value;
  if (api.polyline || api.areaPath) {
    items.push({ key: "api", label: "协议 API（成功）", swatch: "api" });
  }
  return items;
});

const throughputMiniLegendAria = computed(() => {
  const xs = throughputMiniLegendItems.value.map((x) => x.label);
  return xs.length ? `迷你图图例：${xs.join("，")}` : "";
});

const apiTodayTotalStr = computed(() => {
  const r = scopedBotStatsRow.value;
  if (!r || r.today_api_calls == null) return "—";
  return String(r.today_api_calls);
});

const apiTodayTopMain = computed((): { title: string; sub: string } => {
  const r = scopedBotStatsRow.value;
  if (!r) return { title: "—", sub: "" };
  const name = r.today_top_api?.trim();
  if (!name) return { title: "—", sub: "" };
  const c = r.today_top_api_count ?? 0;
  return { title: name, sub: `${c} 次` };
});

const apiTodayTopStr = computed(() => {
  const m = apiTodayTopMain.value;
  if (m.title === "—") return "—";
  return m.sub ? `${m.title}（${m.sub}）` : m.title;
});

function pluginModuleDisplayName(moduleName: string): string {
  const row = pluginsList.value.find((p) => p.name === moduleName);
  const t = row?.metadata?.name?.trim();
  return t || moduleName;
}

const pluginTodayTopMain = computed((): { title: string; sub: string } => {
  const row = scopedPluginRunRow.value;
  const plugins = row?.plugins ?? [];
  if (!plugins.length) return { title: "—", sub: "" };
  const byToday = [...plugins].sort((a, b) => (b.runs_today ?? 0) - (a.runs_today ?? 0));
  const topT = byToday[0]!;
  const nt = topT.runs_today ?? 0;
  if (nt > 0) {
    return { title: pluginModuleDisplayName(topT.name), sub: `${nt} 次` };
  }
  const byRuns = [...plugins].sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0));
  const topR = byRuns[0]!;
  const nr = topR.runs ?? 0;
  if (nr > 0) return { title: pluginModuleDisplayName(topR.name), sub: `累计 ${nr}` };
  return { title: "—", sub: "" };
});

const pluginTodayTopStr = computed(() => {
  const m = pluginTodayTopMain.value;
  if (m.title === "—") return "—";
  return m.sub ? `${m.title}（${m.sub}）` : m.title;
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

/** 当前账号各插件 Matcher 今日执行次数合计（插件运行统计 bots[].runs_today） */
const pluginMatcherTodayTotalStr = computed(() => {
  const row = scopedPluginRunRow.value;
  if (row == null) return "—";
  return String(row.runs_today ?? 0);
});

const scopedPluginPlugins = computed(() => scopedPluginRunRow.value?.plugins ?? []);

const scopedMatcherRunsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_runs_by_plugin ?? []);

const scopedMatcherErrorsByPlugin = computed(() => scopedPluginRunRow.value?.matcher_errors_by_plugin ?? []);

const scopedMatcherErrorLog = computed(() => scopedPluginRunRow.value?.matcher_error_log ?? []);

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
    friendSnap.value = null;
    groupSnap.value = null;
    requestOverviewSnap.value = null;
    return;
  }
  socialBusy.value = true;
  try {
    const [ms, prs, fl, gl, ro] = await Promise.all([
      fetchMessageStats(acc),
      fetchPluginRunStats(acc),
      fetchFriendList(acc),
      fetchGroupList(acc),
      fetchRequestOverview(),
    ]);
    statsScoped.value = ms;
    pluginRunStatsScoped.value = prs;
    friendSnap.value = fl;
    groupSnap.value = gl;
    requestOverviewSnap.value = ro;
  } catch {
    statsScoped.value = null;
    pluginRunStatsScoped.value = null;
    friendSnap.value = null;
    groupSnap.value = null;
    requestOverviewSnap.value = null;
  } finally {
    socialBusy.value = false;
  }
}

watch(selectedAccount, () => {
  accountPickerOpen.value = false;
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

async function load() {
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

onMounted(load);
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
                :disabled="overviewBusy"
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
              >
                <div class="home-account-unified">
                  <div class="home-account-unified__col home-account-unified__col--hero">
                    <div class="home-account-hero home-account-hero--unified home-account-hero--color">
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
                              <span
                                class="home-account-conn"
                                :class="selectedConnected ? 'home-account-conn--on' : 'home-account-conn--off'"
                              >{{ selectedConnected ? "已连接" : "未连接" }}</span>
                            </div>
                            <div
                              v-if="accountPickerOpen && sortedDbBots.length > 1"
                              class="home-account-hero__picker-menu"
                              role="listbox"
                              aria-label="选择 Bot 账号"
                            >
                              <button
                                v-for="c in sortedDbBots"
                                :key="c.account"
                                type="button"
                                class="home-account-hero__picker-item"
                                :class="{ 'is-active': c.account === selectedAccount }"
                                role="option"
                                :aria-selected="c.account === selectedAccount"
                                @click="pickAccountFromList(c.account)"
                              >
                                <span class="home-account-hero__picker-item-main">{{ dbNick(c.account) || "BOT" }}</span>
                                <span class="home-account-hero__picker-item-sub muted">{{ c.account }}</span>
                              </button>
                            </div>
                          </div>
                          <p class="home-account-hero__sub muted">账号 {{ selectedAccount }}</p>
                          <p class="home-account-hero__proto muted">
                            <template v-if="!accountProtocolIsUnknown">
                              协议 · {{ accountAdapterDisplay }}
                            </template>
                            <template v-else>
                              协议 · <span class="home-account-hero__proto-hint">未上报</span>
                              <span class="home-account-hero__proto-sub muted">可在「实例与连接」核对适配器</span>
                            </template>
                          </p>
                        </div>
                      </div>
                      <div
                        class="home-account-hero__detail home-account-hero__detail--with-pending-rail"
                      >
                        <aside
                          class="home-account-hero__pending-rail"
                          aria-label="待同意请求"
                        >
                          <div class="home-account-hero__pending-card">
                            <div class="home-account-hero__pending-title home-account-hero__pending-title--friend">好友申请</div>
                            <div class="home-account-hero__pending-val">
                              <template v-if="socialBusy">…</template>
                              <RouterLink
                                v-else
                                class="home-account-hero__pending-count-link"
                                :to="friendsGroupsFriendPendingTo"
                              >
                                <span class="home-account-hero__pending-count-num">{{ friendPendingApplyDisplay }}</span>
                                <span class="home-account-hero__pending-count-suffix"> 条待同意</span>
                              </RouterLink>
                            </div>
                          </div>
                          <div class="home-account-hero__pending-card">
                            <div class="home-account-hero__pending-title home-account-hero__pending-title--group">入群邀请</div>
                            <div class="home-account-hero__pending-val">
                              <template v-if="socialBusy">…</template>
                              <RouterLink
                                v-else
                                class="home-account-hero__pending-count-link"
                                :to="friendsGroupsGroupPendingTo"
                              >
                                <span class="home-account-hero__pending-count-num">{{ groupPendingApplyDisplay }}</span>
                                <span class="home-account-hero__pending-count-suffix"> 条待同意</span>
                              </RouterLink>
                            </div>
                          </div>
                        </aside>
                        <div class="home-account-hero__detail-main">
                          <p class="home-account-hero__admin">
                            <span class="home-account-hero__admin-label">管理员</span>
                            <span
                              class="home-account-hero__admin-values"
                              :class="{ 'home-account-hero__admin-values--placeholder': !(selectedBotConfig?.admins?.length) }"
                            >{{ selectedAdminsDisplay }}</span>
                          </p>
                          <div class="home-account-hero__links-grid">
                            <div class="home-account-hero__links-grid__col home-account-hero__links-grid__col--friend">
                              <a
                                v-if="nativeProtocolWebUiHref"
                                class="home-account-hero__link"
                                :href="nativeProtocolWebUiHref"
                                target="_blank"
                                rel="noopener noreferrer"
                              >原生 WebUI</a>
                              <span
                                v-else
                                class="home-account-hero__link-ph"
                                aria-hidden="true"
                              > </span>
                            </div>
                            <div class="home-account-hero__links-grid__col home-account-hero__links-grid__col--group">
                              <a
                                v-if="protocolBuiltInManageHref"
                                class="home-account-hero__link"
                                :href="protocolBuiltInManageHref"
                                target="_blank"
                                rel="noopener noreferrer"
                              >协议管理页</a>
                              <span
                                v-else
                                class="home-account-hero__link-ph"
                                aria-hidden="true"
                              > </span>
                            </div>
                            <div class="home-account-hero__links-grid__counts">
                              <span class="home-account-hero__counts-pair home-account-hero__counts-pair--grid-cell">好友 <strong
                                class="home-account-hero__counts-num"
                                :class="{ 'home-account-hero__counts-num--pending': friendCountNumPending }"
                              >{{ friendCountDisplay }}</strong></span>
                              <span class="home-account-hero__counts-pair home-account-hero__counts-pair--grid-cell">群聊 <strong
                                class="home-account-hero__counts-num"
                                :class="{ 'home-account-hero__counts-num--pending': groupCountNumPending }"
                              >{{ groupCountDisplay }}</strong></span>
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
                            !socialBusy && (scopedPluginRunRow?.errors_today ?? 0) > 0,
                        }"
                      >
                        <span class="muted home-account-hero__matcher-foot__k">Matcher 异常（今日）</span>
                        <span class="home-account-hero__matcher-foot__v">{{
                          socialBusy
                            ? "…"
                            : scopedPluginRunRow == null
                              ? "—"
                              : String(scopedPluginRunRow.errors_today ?? 0)
                        }}</span>
                      </div>
                      <details
                        v-if="!socialBusy && scopedMatcherErrorLog.length"
                        class="home-account-hero__matcher-details muted"
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
                    </div>
                  </div>
                  <div class="home-account-unified__col home-account-unified__col--metrics">
                    <div class="home-account-metrics home-account-metrics--color">
                      <div class="home-account-metrics__head">吞吐（累计）</div>
                      <div class="home-account-metrics__big-row">
                        <div class="home-account-metrics__big">
                          <span class="home-account-metrics__recv">{{ socialBusy ? "…" : msgRecvSentPair.recv }}</span>
                          <span class="home-account-metrics__sep muted">/</span>
                          <span class="home-account-metrics__sent">{{ socialBusy ? "…" : msgRecvSentPair.sent }}</span>
                        </div>
                        <div
                          v-if="!socialBusy && throughputTodayInline"
                          class="home-account-metrics__today-inline muted"
                        >
                          {{ throughputTodayInline }}
                        </div>
                      </div>
                      <p
                        v-if="throughputHeadNote"
                        class="home-account-metrics__caption home-account-metrics__caption--note muted"
                      >
                        {{ throughputHeadNote }}
                      </p>
                      <div
                        v-if="showThroughputMiniChart"
                        class="home-account-metrics__bars-wrap"
                      >
                        <svg
                          class="home-account-metrics__bars-svg"
                          viewBox="0 0 100 34"
                          preserveAspectRatio="none"
                          overflow="hidden"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient
                              id="home-throughput-api-area-fill"
                              x1="50"
                              y1="34"
                              x2="50"
                              y2="0"
                              gradientUnits="userSpaceOnUse"
                            >
                              <stop
                                offset="0%"
                                stop-color="#ea580c"
                                stop-opacity="0"
                              />
                              <stop
                                offset="55%"
                                stop-color="#fb923c"
                                stop-opacity="0.08"
                              />
                              <stop
                                offset="100%"
                                stop-color="#fdba74"
                                stop-opacity="0.22"
                              />
                            </linearGradient>
                          </defs>
                          <template v-if="throughputMessageBarBuckets.length">
                            <g
                              v-for="(b, i) in throughputMessageBarBuckets"
                              :key="i"
                            >
                              <rect
                                class="home-account-metrics__bar home-account-metrics__bar--recv"
                                :x="b.recv.x"
                                :y="b.recv.y"
                                :width="b.recv.w"
                                :height="b.recv.h"
                                rx="0.65"
                              />
                              <rect
                                class="home-account-metrics__bar home-account-metrics__bar--sent"
                                :x="b.sent.x"
                                :y="b.sent.y"
                                :width="b.sent.w"
                                :height="b.sent.h"
                                rx="0.65"
                              />
                            </g>
                          </template>
                          <path
                            v-if="throughputApiLineModel.areaPath"
                            class="home-account-metrics__throughput-area"
                            :d="throughputApiLineModel.areaPath"
                            fill="url(#home-throughput-api-area-fill)"
                          />
                          <polyline
                            v-if="throughputApiLineModel.polyline"
                            class="home-account-metrics__throughput-line home-account-metrics__throughput-line--api"
                            fill="none"
                            stroke="#ea580c"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            vector-effect="non-scaling-stroke"
                            :points="throughputApiLineModel.polyline"
                          />
                        </svg>
                        <div
                          v-if="throughputMiniLegendItems.length"
                          class="home-account-metrics__bars-legend muted"
                          :aria-label="throughputMiniLegendAria || undefined"
                        >
                          <span
                            v-for="it in throughputMiniLegendItems"
                            :key="it.key"
                            class="home-account-metrics__legend-item"
                          >
                            <i
                              class="home-account-metrics__legend-swatch"
                              :class="`home-account-metrics__legend-swatch--${it.swatch}`"
                              aria-hidden="true"
                            />
                            {{ it.label }}
                          </span>
                        </div>
                        <div class="home-account-metrics__bars-ticks muted">
                          <span
                            v-for="(tk, ti) in throughputBarTimeTicks"
                            :key="ti"
                            class="home-account-metrics__bars-tick"
                            :style="{ left: `${tk.leftPct}%` }"
                          >{{ tk.label }}</span>
                        </div>
                      </div>
                      <div
                        v-else-if="!socialBusy"
                        class="home-account-metrics__spark home-account-metrics__spark--empty"
                        aria-hidden="true"
                      >
                        <span
                          v-for="n in 14"
                          :key="n"
                          class="home-account-metrics__spark-faint"
                        />
                      </div>
                      <div class="home-account-metrics__stats">
                        <div class="home-account-metrics__today-row">
                          <div
                            class="home-account-metrics__today-block"
                            :class="{ 'is-empty': !socialBusy && metricIsEmpty(apiTodayTotalStr) }"
                          >
                            <span class="muted home-account-metrics__k">今日 API 调用</span>
                            <span class="home-account-metrics__v">{{ socialBusy ? "…" : apiTodayTotalStr }}</span>
                            <div class="home-account-metrics__skel-track">
                              <span
                                v-for="n in 8"
                                :key="n"
                                class="home-account-metrics__skel-seg"
                              />
                            </div>
                          </div>
                          <div
                            class="home-account-metrics__today-block home-account-metrics__today-block--plugin"
                            :class="{ 'is-empty': !socialBusy && metricIsEmpty(pluginMatcherTodayTotalStr) }"
                          >
                            <span class="muted home-account-metrics__k">今日插件调用</span>
                            <span class="home-account-metrics__v">{{ socialBusy ? "…" : pluginMatcherTodayTotalStr }}</span>
                            <div class="home-account-metrics__skel-track">
                              <span
                                v-for="n in 8"
                                :key="n"
                                class="home-account-metrics__skel-seg"
                              />
                            </div>
                          </div>
                        </div>
                        <div class="home-account-metrics__tops-grid">
                          <div
                            class="home-account-metrics__stat-block home-account-metrics__stat-block--plugin"
                            :class="{ 'is-empty': !socialBusy && metricIsEmpty(pluginTodayTopMain.title) }"
                          >
                            <span class="muted home-account-metrics__k">调用次数最多插件</span>
                            <div class="home-account-metrics__stat-lines">
                              <span
                                class="home-account-metrics__v home-account-metrics__v--clip"
                                :title="pluginTodayTopStr"
                              >{{ socialBusy ? "…" : pluginTodayTopMain.title }}</span>
                              <span
                                v-if="!socialBusy && pluginTodayTopMain.sub"
                                class="home-account-metrics__stat-sub home-account-metrics__stat-sub--plugin"
                              >{{ pluginTodayTopMain.sub }}</span>
                            </div>
                            <div class="home-account-metrics__skel-track">
                              <span
                                v-for="n in 8"
                                :key="n"
                                class="home-account-metrics__skel-seg"
                              />
                            </div>
                          </div>
                          <div
                            class="home-account-metrics__stat-block home-account-metrics__stat-block--api"
                            :class="{ 'is-empty': !socialBusy && metricIsEmpty(apiTodayTopMain.title) }"
                          >
                            <span class="muted home-account-metrics__k">调用次数最多 API</span>
                            <div class="home-account-metrics__stat-lines">
                              <span
                                class="home-account-metrics__v home-account-metrics__v--clip"
                                :title="apiTodayTopStr"
                              >{{ socialBusy ? "…" : apiTodayTopMain.title }}</span>
                              <span
                                v-if="!socialBusy && apiTodayTopMain.sub"
                                class="home-account-metrics__stat-sub home-account-metrics__stat-sub--api"
                              >{{ apiTodayTopMain.sub }}</span>
                            </div>
                            <div class="home-account-metrics__skel-track">
                              <span
                                v-for="n in 8"
                                :key="n"
                                class="home-account-metrics__skel-seg"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="home-account-unified__col home-account-unified__col--standee">
                    <div class="home-account-standee">
                      <img
                        class="home-account-standee__img"
                        :src="standeeUrl"
                        alt="帕拉斯立绘"
                        width="560"
                        height="560"
                        decoding="async"
                      >
                    </div>
                  </div>
                </div>
                <div class="home-account-charts-span">
                  <HomePluginRunCharts
                    :plugins="scopedPluginPlugins"
                    :plugins-meta="pluginsList"
                    :series="pluginRunTimeSamples"
                    :busy="socialBusy"
                    :api-history-by-api="scopedApiCallsByApi"
                    :api-history-bucket-sec="msgMainStats?.api_calls_history_bucket_sec"
                    :matcher-runs-by-plugin="scopedMatcherRunsByPlugin"
                    :matcher-errors-by-plugin="scopedMatcherErrorsByPlugin"
                    :matcher-history-bucket-sec="pluginRunMain?.matcher_calls_history_bucket_sec"
                  />
                </div>
              </div>
            </template>
          </div>
        </div>
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
              当前未上报 CPU/内存/磁盘等指标。请确认后端已启用系统快照并刷新。
            </p>
            <div
              v-else
              class="home-metric-grid"
            >
              <div class="home-metric">
                <div class="home-metric__row">
                  <span class="home-metric__label">CPU</span>
                  <span class="home-metric__val">{{ cpuDisplay }}</span>
                </div>
                <div
                  v-if="cpuBarPct != null"
                  class="home-metric__bar"
                  aria-hidden="true"
                >
                  <span :style="{ width: `${cpuBarPct}%` }" />
                </div>
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
            </div>
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
