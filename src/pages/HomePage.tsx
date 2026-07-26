import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Bot, MessagesSquare, Puzzle, Zap, Activity, Package, Server } from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import {
  fetchBotUpdateCheck,
  fetchCommunityStats,
  fetchConsoleDailyStats,
  fetchFriendList,
  fetchGroupList,
  fetchHomeOverview,
  fetchMessageStats,
  fetchPluginRunStats,
  fetchRequestOverview,
  fetchSystem,
  fetchUpdateCheck,
  refreshInstancesCatalogGlobal,
} from "@/api/fullConsole";
import type { BotConfigPublic, InstancesData } from "@/api/pallasTypes";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { qqAvatarUrl } from "@/utils/botDisplay";
import { mergeProtocolDisplayAccounts } from "@/utils/protocolDisplayAccounts";
import { protocolBackendDisplayName } from "@/utils/protocolUi";
import { pluginCountsAsLoadedInCatalog } from "@/utils/pluginLoadRoleLabel";
import {
  consoleResourceVersionLabel,
  displayVersionWithoutSha,
  pallasBotVersionLabel,
} from "@/utils/versionDisplay";
import { useBotFavorites } from "@/hooks/useBotFavorites";
import {
  isHomeActionDismissed,
  loadHomeActionDismissals,
  saveHomeActionDismissal,
} from "@/utils/homeActionDismissals";
import { readSavedHomeAccount, writeSavedHomeAccount } from "@/utils/chartsPageHelpers";
import RefreshIconButton from "@/components/RefreshIconButton";
import ConsolePageSkeleton, { SkelValue } from "@/components/ConsolePageSkeleton";
import HomeLazyReveal from "@/components/HomeLazyReveal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HOME_SYSTEM_POLL_MS = 5000;
const HOME_THROUGHPUT_POLL_MS = 5 * 60 * 1000;
const HOME_CONN_DURATION_TICK_MS = 1000;
const RESOURCE_WARN_PCT = 90;

/** shadcn Card + hub home 旧度量（圆角/描边/阴影/内边距由 home-page.css 扣） */
const HOME_PANEL = "home-panel flex h-full flex-col shadow-none";
const HOME_PANEL_HD =
  "home-panel__hd flex-row items-center justify-between space-y-0 border-b p-0";
const HOME_PANEL_BD = "home-panel__bd p-0";
const HOME_PANEL_TITLE = "home-panel__title leading-tight tracking-[-0.015em]";
const HOME_PANEL_TAG = "home-panel__tag";

function MetricTile({
  icon: Icon,
  label,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="metric-tile">
      <div className="metric-tile__head">
        {Icon ? (
          <Icon className="metric-tile__ico" size={14} strokeWidth={2} aria-hidden />
        ) : null}
        <span className="metric-tile__label">{label}</span>
      </div>
      <div className="metric-tile__value-slot">{children}</div>
    </div>
  );
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

function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
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

function barPct(
  direct: number | null | undefined,
  used: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (direct != null && !Number.isNaN(direct)) return Math.min(100, Math.max(0, direct));
  if (used != null && total != null && total > 0) return Math.min(100, Math.max(0, (used / total) * 100));
  return null;
}

function gpuUtilBarPct(util: number | null | undefined): number | null {
  return barPct(util ?? null, null, null);
}

function gpuMemBarPct(used: number, total: number): number | null {
  return barPct(null, used, total);
}

function uptimeDisplayParts(boot: number | null | undefined, nowSec: number, slotCount = 7) {
  if (boot == null) return null;
  let s = Math.max(0, nowSec - boot);
  const d = Math.floor(s / 86400);
  s %= 86400;
  const h = Math.floor(s / 3600);
  s %= 3600;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const dayRemSec = h * 3600 + m * 60 + sec;
  const slots = Math.max(1, Math.floor(slotCount) || 7);
  const slotSec = 86400 / slots;
  const dayHourFills = Array.from({ length: slots }, (_, i) => {
    const slotStart = i * slotSec;
    const slotEnd = slotStart + slotSec;
    if (dayRemSec >= slotEnd) return 100;
    if (dayRemSec <= slotStart) return 0;
    return Math.min(100, ((dayRemSec - slotStart) / slotSec) * 100);
  });
  if (d > 0) {
    return {
      value: String(d),
      unit: "天",
      remainder: h > 0 ? `${h} 小时` : m > 0 ? `${m} 分` : undefined,
      dayHourFills,
    };
  }
  if (h > 0) {
    return { value: String(h), unit: "小时", remainder: m > 0 ? `${m} 分` : undefined, dayHourFills };
  }
  return { value: String(m), unit: "分", dayHourFills };
}

function formatBootAt(boot: number): string {
  const d = new Date(boot * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function formatMatcherErrorAt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  try {
    return new Date(sec * 1000).toLocaleString();
  } catch {
    return String(sec);
  }
}

function tempDisplay(c: number | null | undefined): string {
  if (c == null || Number.isNaN(c)) return "—";
  return `${Math.round(c)}°C`;
}

function gpuNameShort(name: string, maxLen = 28): string {
  const t = name.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export default function HomePage() {
  const overviewQ = useQuery({ queryKey: ["home-overview"], queryFn: () => fetchHomeOverview() });
  const botUpdateQ = useQuery({ queryKey: ["bot-update-check"], queryFn: fetchBotUpdateCheck });
  const webUpdateQ = useQuery({ queryKey: ["web-update-check"], queryFn: fetchUpdateCheck });
  const systemQ = useQuery({
    queryKey: ["home-system"],
    queryFn: fetchSystem,
    refetchInterval: HOME_SYSTEM_POLL_MS,
    refetchIntervalInBackground: false,
  });
  const communityQ = useQuery({
    queryKey: ["home-community"],
    queryFn: () => fetchCommunityStats(),
    refetchInterval: HOME_SYSTEM_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const [selectedAccount, setSelectedAccount] = useState<number | null>(() => readSavedHomeAccount());
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [homeActionDismissals, setHomeActionDismissals] = useState(loadHomeActionDismissals);
  const [connectionClockTick, setConnectionClockTick] = useState(() => Date.now());
  const accountPickerRoot = useRef<HTMLDivElement | null>(null);
  const { favorites, toggleFavorite } = useBotFavorites();

  useEffect(() => {
    void refreshInstancesCatalogGlobal().catch(() => {});
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setConnectionClockTick(Date.now()), HOME_CONN_DURATION_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!accountPickerOpen) return;
    function onDocDown(ev: MouseEvent) {
      const root = accountPickerRoot.current;
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (root?.contains(t)) return;
      setAccountPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, [accountPickerOpen]);

  const health = overviewQ.data?.health;
  const system = systemQ.data ?? overviewQ.data?.system;
  const bots = overviewQ.data?.bots ?? [];
  const plugins = overviewQ.data?.plugins ?? [];
  const instances = (overviewQ.data?.instances ?? undefined) as InstancesData | undefined;
  const stats = overviewQ.data?.message_stats;
  const pluginRunStats = overviewQ.data?.plugin_run_stats;
  const communityStats = communityQ.data ?? overviewQ.data?.community_stats;
  const botUpdate = botUpdateQ.data;
  const webUpdate = webUpdateQ.data;

  const throughputQ = useQuery({
    queryKey: ["home-throughput"],
    queryFn: () => fetchMessageStats(),
    refetchInterval: HOME_THROUGHPUT_POLL_MS,
    refetchIntervalInBackground: false,
  });

  const accountStatsQ = useQuery({
    queryKey: ["home-account-stats", selectedAccount],
    queryFn: async () => {
      const acc = selectedAccount!;
      const [ms, pr, daily] = await Promise.all([
        fetchMessageStats(acc),
        fetchPluginRunStats(acc),
        fetchConsoleDailyStats({ selfId: acc }),
      ]);
      return { ms, pr, daily };
    },
    enabled: selectedAccount != null,
  });

  const socialQ = useQuery({
    queryKey: ["home-social", selectedAccount],
    queryFn: async () => {
      const acc = selectedAccount!;
      const [fl, gl, ov] = await Promise.all([
        fetchFriendList(acc),
        fetchGroupList(acc),
        fetchRequestOverview({ selfId: acc }),
      ]);
      return { fl, gl, ov };
    },
    enabled: selectedAccount != null,
  });

  const sortedDbBots = useMemo(() => {
    const rows = [...(instances?.db_bot_configs ?? [])] as BotConfigPublic[];
    rows.sort((a, b) => {
      const fa = favorites.has(a.account) ? 1 : 0;
      const fb = favorites.has(b.account) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const ca = accountHasNonebotBot(instances?.nonebot_bots, a.account) ? 1 : 0;
      const cb = accountHasNonebotBot(instances?.nonebot_bots, b.account) ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const na = (instances?.bot_profiles?.[String(a.account)]?.nickname?.trim() || "").toLowerCase();
      const nb = (instances?.bot_profiles?.[String(b.account)]?.nickname?.trim() || "").toLowerCase();
      const cmp = na.localeCompare(nb, "zh-CN");
      if (cmp !== 0) return cmp;
      return a.account - b.account;
    });
    return rows;
  }, [favorites, instances]);

  useEffect(() => {
    // overview 未返回前 sortedDbBots 为空，勿清空与数据看板共用的已选账号
    if (overviewQ.isPending && !overviewQ.data) return;
    if (!sortedDbBots.length) {
      setSelectedAccount(null);
      writeSavedHomeAccount(null);
      return;
    }
    if (selectedAccount != null && sortedDbBots.some((r) => r.account === selectedAccount)) return;
    const saved = readSavedHomeAccount();
    if (saved != null && sortedDbBots.some((r) => r.account === saved)) {
      setSelectedAccount(saved);
      return;
    }
    setSelectedAccount(sortedDbBots[0]!.account);
    writeSavedHomeAccount(sortedDbBots[0]!.account);
  }, [overviewQ.data, overviewQ.isPending, sortedDbBots, selectedAccount]);

  const dbNick = (account: number) => instances?.bot_profiles?.[String(account)]?.nickname?.trim() || "";

  const selectedBotConfig = useMemo(() => {
    if (selectedAccount == null) return null;
    return sortedDbBots.find((r) => r.account === selectedAccount) ?? null;
  }, [selectedAccount, sortedDbBots]);

  const selectedAdmins = selectedBotConfig?.admins?.map((id) => String(id)) ?? [];
  const selectedAdminsLabel =
    !selectedAdmins.length
      ? "未配置管理员"
      : selectedAdmins.length > 2 || selectedAdmins.join(" · ").length > 28
        ? `管理员 · ${selectedAdmins.length}`
        : `管理员 · ${selectedAdmins.join(" · ")}`;
  const selectedAdminsTitle = selectedAdmins.length
    ? `管理员 · ${selectedAdmins.join(" · ")}`
    : "未配置管理员";

  const clusterStats = throughputQ.data ?? stats;
  const statsScoped = accountStatsQ.data?.ms;
  const pluginRunStatsScoped = accountStatsQ.data?.pr;
  const pluginRunMain = pluginRunStatsScoped ?? pluginRunStats;

  const scopedBotStatsRow = useMemo(() => {
    if (selectedAccount == null) return null;
    const st = statsScoped ?? stats;
    if (!st?.bots?.length) return null;
    return st.bots.find((b) => b.self_id === String(selectedAccount)) ?? null;
  }, [selectedAccount, stats, statsScoped]);

  const scopedPluginRunRow = useMemo(() => {
    if (selectedAccount == null || !pluginRunMain?.bots?.length) return null;
    return pluginRunMain.bots.find((b) => b.self_id === String(selectedAccount)) ?? null;
  }, [pluginRunMain, selectedAccount]);

  const scopedMatcherErrorLog = scopedPluginRunRow?.matcher_error_log ?? [];

  const runtime = system?.runtime;
  const selectedConnected =
    selectedAccount != null && accountHasNonebotBot(instances?.nonebot_bots, selectedAccount);

  const selectedNonebotRuntimeBot = useMemo(() => {
    if (selectedAccount == null) return null;
    const sid = String(selectedAccount);
    return instances?.nonebot_bots?.find((b) => String(b.self_id) === sid) ?? null;
  }, [instances, selectedAccount]);

  const selectedConnAnchorUnix = (() => {
    const ts = selectedNonebotRuntimeBot?.connected_at_unix;
    if (ts == null || !Number.isFinite(Number(ts))) return null;
    return Math.floor(Number(ts));
  })();

  const selectedConnDurationDisplay = (() => {
    if (!selectedConnected) return "—";
    if (selectedConnAnchorUnix == null) return "—";
    const elapsedSec = Math.max(0, Math.floor(connectionClockTick / 1000) - selectedConnAnchorUnix);
    return formatZhConnDuration(elapsedSec);
  })();

  const selectedConnDateDisplay = (() => {
    if (!selectedConnected || selectedConnAnchorUnix == null) return "—";
    try {
      return new Date(selectedConnAnchorUnix * 1000).toLocaleString();
    } catch {
      return "—";
    }
  })();

  const accountAdapterDisplay = (() => {
    if (selectedAccount == null) return "—";
    const sid = String(selectedAccount);
    const pluginAccounts = instances?.pallas_protocol?.accounts ?? instances?.napcat?.accounts ?? [];
    const row = mergeProtocolDisplayAccounts(instances, pluginAccounts).find((a) => {
      const qq = String(a.qq ?? "").trim();
      const id = String(a.id ?? "").trim();
      return qq === sid || id === sid;
    });
    if (row) {
      const name = protocolBackendDisplayName(row as Record<string, unknown>).trim();
      if (name) return name;
    }
    const fromProfile = String(instances?.bot_profiles?.[sid]?.adapter ?? "").trim();
    if (fromProfile) return fromProfile;
    const fromBot = String(
      instances?.nonebot_bots?.find((b) => String(b.self_id ?? "").trim() === sid)?.adapter ?? "",
    ).trim();
    if (fromBot && fromBot !== "未连接") return fromBot;
    return "—";
  })();

  const clusterTodayApiCalls = useMemo(() => {
    const rows = clusterStats?.bots;
    if (!rows?.length) return null;
    let sum = 0;
    let any = false;
    for (const b of rows) {
      const n = b.today_api_calls;
      if (n == null || !Number.isFinite(Number(n))) continue;
      sum += Number(n);
      any = true;
    }
    return any ? sum : null;
  }, [clusterStats]);

  const clusterTodayPluginRuns = useMemo(() => {
    const rows = pluginRunStats?.bots;
    if (!rows?.length) return null;
    let sum = 0;
    let any = false;
    for (const b of rows) {
      const n = b.runs_today;
      if (n == null || !Number.isFinite(Number(n))) continue;
      sum += Number(n);
      any = true;
    }
    return any ? sum : null;
  }, [pluginRunStats]);

  const kpiPluginLoadedDisplay = plugins.length
    ? String(plugins.filter(pluginCountsAsLoadedInCatalog).length)
    : system?.plugin_count == null
      ? "—"
      : String(system.plugin_count);
  const kpiPluginTotalDisplay = plugins.length
    ? String(plugins.length)
    : system?.plugin_count == null
      ? "—"
      : String(system.plugin_count);

  const accountStatsBusy = overviewQ.isFetching || accountStatsQ.isFetching;
  const accountTodayApiCallsDisplay = (() => {
    const n = scopedBotStatsRow?.today_api_calls;
    if (n == null || !Number.isFinite(Number(n))) {
      return accountStatsBusy ? <SkelValue className="skel-value--narrow" /> : "—";
    }
    return String(Math.floor(Number(n)));
  })();
  const accountTodayRxDisplay = scopedBotStatsRow
    ? String(scopedBotStatsRow.today_received ?? "—")
    : accountStatsBusy
      ? <SkelValue className="skel-value--narrow" />
      : "—";
  const accountTodayTxDisplay = scopedBotStatsRow
    ? String(scopedBotStatsRow.today_sent ?? "—")
    : accountStatsBusy
      ? <SkelValue className="skel-value--narrow" />
      : "—";

  const accountSocialPending =
    selectedAccount != null && (socialQ.isFetching || (accountStatsQ.isFetching && statsScoped == null));

  const scopedReqRow = useMemo(() => {
    if (selectedAccount == null || !socialQ.data?.ov?.bots?.length) return null;
    return socialQ.data.ov.bots.find((b) => b.self_id === String(selectedAccount)) ?? null;
  }, [selectedAccount, socialQ.data]);

  const friendPendingLine = (() => {
    if (!scopedReqRow) return "—";
    const n =
      (scopedReqRow.pending_friend_requests?.length ?? 0) +
      (scopedReqRow.doubt_friend_requests?.length ?? 0);
    return `${n}条待同意`;
  })();
  const groupPendingLine = scopedReqRow
    ? `${scopedReqRow.pending_group_requests?.length ?? 0}条待同意`
    : "—";

  const homeActionItems = useMemo(() => {
    const items: { key: string; label: string; to: string; dismissToken: string }[] = [];
    if (botUpdate?.has_update) {
      items.push({
        key: "bot-update",
        label: "Pallas-Bot 有更新",
        to: "/update#console-update-bot",
        dismissToken: botUpdate.latest_tag || botUpdate.current_tag || "bot-update",
      });
    }
    if (webUpdate?.has_update) {
      items.push({
        key: "web-update",
        label: "控制台有更新",
        to: "/update#console-update-webui",
        dismissToken: webUpdate.latest_tag || webUpdate.current_tag || "web-update",
      });
    }
    return items;
  }, [botUpdate, webUpdate]);

  const visibleHomeActionItems = homeActionItems.filter(
    (item) => !isHomeActionDismissed(homeActionDismissals, item.key, item.dismissToken),
  );

  const perfSampled = (() => {
    const r = runtime;
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
  })();

  const cpuPerCorePercents = (() => {
    const raw = runtime?.cpu_per_core;
    if (!Array.isArray(raw) || raw.length === 0) return [] as number[];
    return raw.map((x) => {
      const n = typeof x === "number" ? x : Number(x);
      if (!Number.isFinite(n)) return 0;
      return Math.min(100, Math.max(0, n));
    });
  })();

  const memHint = (() => {
    const m = runtime?.memory;
    if (!m) return undefined;
    const parts: string[] = [];
    if (m.used != null && m.total != null && m.total > 0) {
      parts.push(`已用 ${fmtBytes(m.used)} / 共 ${fmtBytes(m.total)}`);
    } else if (m.total != null && m.total > 0) {
      parts.push(`共 ${fmtBytes(m.total)}`);
    }
    if (m.available != null) parts.push(`可用 ${fmtBytes(m.available)}`);
    else if (m.free != null && m.free > 0) parts.push(`空闲 ${fmtBytes(m.free)}`);
    return parts.length ? parts.join(" · ") : undefined;
  })();

  const diskHint = runtime?.disk
    ? `${fmtBytes(runtime.disk.used)} / ${fmtBytes(runtime.disk.total)} · 可用 ${fmtBytes(runtime.disk.free)}`
    : undefined;

  const uptimeNowSec =
    typeof system?.server_time === "number" && Number.isFinite(system.server_time)
      ? system.server_time
      : Date.now() / 1000;
  const uptimeParts = uptimeDisplayParts(
    runtime?.boot_time ?? null,
    uptimeNowSec,
    cpuPerCorePercents.length || 7,
  );
  const uptimeHint = (() => {
    const boot = runtime?.boot_time;
    if (boot == null) return undefined;
    const parts: string[] = [];
    if (uptimeParts?.remainder) parts.push(uptimeParts.remainder);
    parts.push(`启动于 ${formatBootAt(boot)}`);
    return parts.join(" · ");
  })();

  const cpuBarPct = barPct(runtime?.cpu_percent ?? null, null, null);
  const memBarPct = barPct(runtime?.memory?.percent ?? null, runtime?.memory?.used ?? null, runtime?.memory?.total ?? null);
  const diskBarPct = barPct(runtime?.disk?.percent ?? null, runtime?.disk?.used ?? null, runtime?.disk?.total ?? null);
  const memResourceWarn = (memBarPct ?? 0) >= RESOURCE_WARN_PCT;
  const diskResourceWarn = (diskBarPct ?? 0) >= RESOURCE_WARN_PCT;
  const sysResourceWarn = diskResourceWarn || memResourceWarn;

  const gpuDevices = runtime?.gpu?.available ? runtime.gpu.devices ?? [] : [];

  const botDevelopmentBuildTitle = (() => {
    const b = botUpdate;
    if (!b?.development_build) return "";
    const parts = ["当前为开发构建，代码超前于最新发行版。"];
    if (b.latest_tag) parts.push(`最新发行：${b.latest_tag}。`);
    if (b.current_commit) parts.push(`commit：${b.current_commit}。`);
    return parts.join("");
  })();

  async function refreshAll(force = false) {
    await Promise.all([
      overviewQ.refetch(),
      botUpdateQ.refetch(),
      webUpdateQ.refetch(),
      systemQ.refetch(),
      communityQ.refetch(),
      throughputQ.refetch(),
      accountStatsQ.refetch(),
      socialQ.refetch(),
    ]);
    if (force) void refreshInstancesCatalogGlobal().catch(() => {});
  }

  const pageReady = Boolean(overviewQ.data);
  const overviewRefreshing = overviewQ.isFetching && Boolean(overviewQ.data);
  const versionMetaPending = botUpdateQ.isFetching || webUpdateQ.isFetching;

  return (
    <div className="home-page console-hub-page" aria-busy={overviewQ.isFetching && !overviewQ.data || undefined}>
      {overviewQ.error ? (
        <div className="alert alert--err">{overviewQ.error instanceof Error ? overviewQ.error.message : String(overviewQ.error)}</div>
      ) : null}

      {!pageReady ? (
        <ConsolePageSkeleton panels={3} />
      ) : (
        <div className={overviewRefreshing ? "home-body home-page__body--syncing" : "home-body"}>
          {overviewRefreshing ? (
            <p className="home-sync visually-hidden" role="status" aria-live="polite">
              正在加载概况…
            </p>
          ) : null}
          <div className="home-kpi-head">
            <div className="home-kpi-bar">
              <MetricTile icon={Bot} label="在线 Bot">
                <span className="metric-tile__value metric-tile__value--inline">
                  {String(bots.length)}
                  <span className="metric-tile__sep"> / </span>
                  {String(sortedDbBots.length || bots.length)}
                </span>
              </MetricTile>
              <MetricTile icon={MessagesSquare} label="消息 收 / 发">
                <span className="metric-tile__value metric-tile__value--inline">
                  {clusterStats ? String(clusterStats.total_received) : "—"}
                  <span className="metric-tile__sep"> / </span>
                  {clusterStats ? String(clusterStats.total_sent) : "—"}
                </span>
              </MetricTile>
              <MetricTile icon={Zap} label="API / 插件">
                <span className="metric-tile__value metric-tile__value--inline">
                  {clusterTodayApiCalls == null ? "—" : String(Math.floor(clusterTodayApiCalls))}
                  <span className="metric-tile__sep"> / </span>
                  {clusterTodayPluginRuns == null ? "—" : String(Math.floor(clusterTodayPluginRuns))}
                </span>
              </MetricTile>
              <MetricTile icon={Puzzle} label="已加载插件">
                <span className="metric-tile__value metric-tile__value--inline">
                  {kpiPluginLoadedDisplay}
                  <span className="metric-tile__sep"> / </span>
                  {kpiPluginTotalDisplay}
                </span>
              </MetricTile>
            </div>
            <div className="home-kpi-head__side">
              <Link className="home-kpi-community" to="/community" title="社区统计与语料">
                社区
                <span className="home-kpi-community__val">
                  {communityStats?.deployments_online?.toLocaleString() ?? "—"}
                </span>
                <span className="home-kpi-community__hint muted">安装</span>
                <span className="home-kpi-community__sep muted">·</span>
                <span className="home-kpi-community__val">
                  {communityStats?.bots_online_sum?.toLocaleString() ?? "—"}
                </span>
                <span className="home-kpi-community__hint muted">牛牛</span>
              </Link>
              <Link
                className="home-kpi-community home-kpi-quick"
                to={selectedAccount != null ? `/charts?self_id=${selectedAccount}` : "/charts"}
                title="数据看板"
              >
                <span>数据看板</span>
              </Link>
            </div>
          </div>

          {visibleHomeActionItems.length ? (
            <ul className="home-action-strip" role="status" aria-label="可用更新">
              {visibleHomeActionItems.map((item) => (
                <li key={item.key} className="home-action-strip__chip home-action-strip__chip--warn">
                  <Link className="home-action-strip__item" to={item.to}>
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    className="home-action-strip__dismiss"
                    aria-label={`关闭「${item.label}」提示`}
                    onClick={() => {
                      saveHomeActionDismissal(item.key, item.dismissToken);
                      setHomeActionDismissals(loadHomeActionDismissals());
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="home-grid">
            <Card
              className={cn(HOME_PANEL, "home-card--acct overflow-visible")}
              style={{ gridArea: "acct" }}
            >
              <CardHeader className={cn(HOME_PANEL_HD, "home-acct__hd items-start")}>
                <div className="home-acct__hd-left">
                  <div className="home-acct__avatar">
                    {selectedAccount != null ? (
                      <img
                        src={qqAvatarUrl(selectedAccount)}
                        alt=""
                        width={44}
                        height={44}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    ) : null}
                  </div>
                  <div ref={accountPickerRoot} className="home-acct__title-wrap">
                    <CardTitle className="home-acct__title">
                      <span className="home-acct__name">
                        {selectedAccount != null ? dbNick(selectedAccount) || "BOT" : "BOT"}
                      </span>
                      {sortedDbBots.length > 1 ? (
                        <button
                          type="button"
                          className="home-acct__caret"
                          aria-expanded={accountPickerOpen}
                          aria-haspopup="listbox"
                          aria-label="切换账号"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setAccountPickerOpen((v) => !v);
                          }}
                        >
                          <span className="home-acct__caret-ico" aria-hidden="true" />
                        </button>
                      ) : null}
                      {selectedAccount != null ? (
                        <button
                          type="button"
                          className="home-acct__fav"
                          aria-pressed={favorites.has(selectedAccount)}
                          title={favorites.has(selectedAccount) ? "取消收藏" : "收藏该 Bot"}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleFavorite(selectedAccount);
                          }}
                        >
                          ★
                        </button>
                      ) : null}
                    </CardTitle>
                    <p className="home-acct__qq muted">QQ {selectedAccount ?? "—"}</p>
                    {accountPickerOpen && sortedDbBots.length > 1 ? (
                      <div className="home-acct-picker" role="listbox" aria-label="选择 Bot 账号">
                        {sortedDbBots.map((c) => (
                          <button
                            key={c.account}
                            type="button"
                            className={`home-acct-picker__item${c.account === selectedAccount ? " is-active" : ""}`}
                            role="option"
                            aria-selected={c.account === selectedAccount}
                            onClick={() => {
                              setSelectedAccount(c.account);
                              writeSavedHomeAccount(c.account);
                              setAccountPickerOpen(false);
                            }}
                          >
                            <img
                              src={qqAvatarUrl(c.account)}
                              alt=""
                              width={32}
                              height={32}
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="home-acct-picker__avatar"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.visibility = "hidden";
                              }}
                            />
                            <span className="home-acct-picker__text">
                              <span className="home-acct-picker__name">{dbNick(c.account) || "BOT"}</span>
                              <span className="home-acct-picker__qq muted">{c.account}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="home-acct__hd-actions">
                  {selectedAccount != null && selectedConnected ? (
                    <span className="home-acct__conn home-acct__conn--on">
                      <span className="home-acct__conn-dot" aria-hidden="true" />
                      已连接
                    </span>
                  ) : selectedAccount != null ? (
                    <span className="home-acct__conn home-acct__conn--off">未连接</span>
                  ) : null}
                  <RefreshIconButton
                    embedded
                    showLabel={false}
                    busy={overviewRefreshing}
                    label="刷新概况"
                    onClick={() => void refreshAll(true)}
                  />
                </div>
              </CardHeader>
              {selectedAccount != null ? (
                <CardContent className={cn(HOME_PANEL_BD, "home-acct__bd flex flex-1 flex-col")}>
                  <div className="home-acct-meta">
                    <Link className="home-acct-meta__tag" to="/protocol">
                      协议 · {accountAdapterDisplay}
                    </Link>
                    <span className="home-acct-meta__tag home-acct-meta__tag--muted" title={selectedAdminsTitle}>
                      {selectedAdminsLabel}
                    </span>
                  </div>
                  <HomeLazyReveal
                    loading={accountSocialPending && socialQ.data?.fl == null && socialQ.data?.gl == null}
                    variant="account-social"
                    ariaLabel="账号概况加载中"
                  >
                    <div className="home-acct-grid">
                      <div className="home-acct-tile">
                        <span className="home-acct-tile__label">好友</span>
                        <span className="home-acct-tile__value">
                          {socialQ.data?.fl != null ? (
                            String(socialQ.data.fl.friends?.length ?? 0)
                          ) : accountSocialPending ? (
                            <SkelValue className="skel-value--narrow" />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                      <div className="home-acct-tile">
                        <span className="home-acct-tile__label">群聊</span>
                        <span className="home-acct-tile__value">
                          {socialQ.data?.gl != null ? (
                            String(socialQ.data.gl.groups?.length ?? 0)
                          ) : accountSocialPending ? (
                            <SkelValue className="skel-value--narrow" />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                      <div className="home-acct-tile home-acct-tile--sub">
                        <span className="home-acct-tile__label">今日 API</span>
                        <span className="home-acct-tile__value">{accountTodayApiCallsDisplay}</span>
                      </div>
                      <div className="home-acct-tile home-acct-tile--sub">
                        <span className="home-acct-tile__label">今日消息</span>
                        <span className="home-acct-tile__value home-acct-tile__value--duo">
                          <span>{accountTodayRxDisplay}</span>
                          <span className="home-acct-tile__sep">/</span>
                          <span>{accountTodayTxDisplay}</span>
                        </span>
                      </div>
                    </div>
                    {friendPendingLine !== "—" || groupPendingLine !== "—" ? (
                      <div className="home-acct-pending-row">
                        {friendPendingLine !== "—" ? (
                          <Link
                            className="home-acct-pending-pill home-acct-pending-pill--friend"
                            to={{
                              pathname: "/friends-groups",
                              search: selectedAccount != null ? `?self_id=${selectedAccount}` : "",
                              hash: "#friends-groups-friend-requests",
                            }}
                          >
                            好友申请 · {friendPendingLine}
                          </Link>
                        ) : null}
                        {groupPendingLine !== "—" ? (
                          <Link
                            className="home-acct-pending-pill home-acct-pending-pill--group"
                            to={{
                              pathname: "/friends-groups",
                              search: selectedAccount != null ? `?self_id=${selectedAccount}` : "",
                              hash: "#friends-groups-group-requests",
                            }}
                          >
                            入群邀请 · {groupPendingLine}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </HomeLazyReveal>
                  <div className="home-acct__foot">
                    {scopedMatcherErrorLog.length ? (
                      <details className="home-acct-matcher">
                        <summary className="home-acct-matcher__toggle">
                          Matcher 异常 <strong>{scopedPluginRunRow?.errors_today ?? 0}</strong> · 点击展开
                        </summary>
                        <ul className="home-acct-matcher__list">
                          {scopedMatcherErrorLog.map((it, idx) => (
                            <li key={`${it.at}-${idx}-${it.plugin}`} className="home-acct-matcher__item">
                              <div className="home-acct-matcher__head">
                                <span>{formatMatcherErrorAt(it.at)}</span>
                                <span className="home-acct-matcher__plugin">{it.plugin}</span>
                                <span>{it.exc_type}</span>
                              </div>
                              <div className="home-acct-matcher__msg">{it.message}</div>
                              <pre className="home-acct-matcher__tb">{it.traceback}</pre>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      <div
                        className={`home-acct-matcher__plain${(scopedPluginRunRow?.errors_today ?? 0) > 0 ? " home-acct-matcher__plain--warn" : ""}`}
                      >
                        Matcher 异常{" "}
                        <strong>
                          {scopedPluginRunRow == null ? "—" : String(scopedPluginRunRow.errors_today ?? 0)}
                        </strong>
                      </div>
                    )}
                    <div className="home-acct__session muted">
                      已连接 {selectedConnDurationDisplay} · {selectedConnDateDisplay}
                    </div>
                  </div>
                </CardContent>
              ) : sortedDbBots.length ? (
                <CardContent className={cn(HOME_PANEL_BD, "flex min-h-[120px] flex-1 items-center justify-center")}>
                  <p className="muted">请选择一个 Bot 账号</p>
                </CardContent>
              ) : (
                <CardContent className={cn(HOME_PANEL_BD, "flex min-h-[120px] flex-1 items-center justify-center")}>
                  <p className="muted">数据库中暂无牛牛账号记录，请先添加账号配置后刷新。</p>
                </CardContent>
              )}
            </Card>

            <Card
              className={cn(
                HOME_PANEL,
                "home-card--sys overflow-hidden",
                sysResourceWarn && "home-card--resource-warn",
              )}
              style={{ gridArea: "sys" }}
            >
              <CardHeader className={HOME_PANEL_HD}>
                <CardTitle className={cn(HOME_PANEL_TITLE, "flex items-center gap-1.5")}>
                  <PanelTitleIcon icon={Activity} />
                  系统性能
                </CardTitle>
                <span className={HOME_PANEL_TAG}>节点采样</span>
              </CardHeader>
              <CardContent className={HOME_PANEL_BD}>
                {!perfSampled ? (
                  <p className="muted" style={{ margin: 0 }}>
                    当前未上报 CPU/内存/磁盘/GPU 等指标。
                  </p>
                ) : (
                  <div className="home-sys-grid">
                    <div className="home-sys-card">
                      <div className="home-sys-card__head">
                        <span className="home-sys-card__label">CPU</span>
                        <span className="home-sys-card__value">{pct(runtime?.cpu_percent ?? null)}</span>
                      </div>
                      <div className="home-sys-card__viz">
                        {cpuPerCorePercents.length ? (
                          <div className="home-sys-card__cores" role="img" aria-label={`${cpuPerCorePercents.length} 核心`}>
                            {cpuPerCorePercents.map((p, i) => (
                              <div key={i} className="home-sys-card__core" title={`核心 ${i}：${p.toFixed(1)}%`}>
                                <span className="home-sys-card__core-fill" style={{ height: `${Math.min(100, Math.max(0, p))}%` }} />
                              </div>
                            ))}
                          </div>
                        ) : cpuBarPct != null ? (
                          <div className="home-sys-card__bar">
                            <span style={{ width: `${cpuBarPct}%` }} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="home-sys-card home-sys-card--uptime">
                      <div className="home-sys-card__head">
                        <span className="home-sys-card__label">运行时长</span>
                        {uptimeParts ? (
                          <span className="home-sys-card__value home-uptime-value">
                            <span className="home-uptime-value__num">{uptimeParts.value}</span>
                            <span className="home-uptime-value__unit">{uptimeParts.unit}</span>
                          </span>
                        ) : (
                          <span className="home-sys-card__value">—</span>
                        )}
                      </div>
                      <div className="home-sys-card__viz">
                        {uptimeParts?.dayHourFills.length ? (
                          <div className="home-uptime-hours" role="img" aria-label={`已运行 ${uptimeParts.value} ${uptimeParts.unit}`}>
                            {uptimeParts.dayHourFills.map((fill, i) => {
                              const n = uptimeParts.dayHourFills.length;
                              const startH = (i * 24) / n;
                              const endH = ((i + 1) * 24) / n;
                              const fmt = (h: number) => {
                                const whole = Math.floor(h);
                                const mins = Math.round((h - whole) * 60);
                                return mins ? `${whole}:${String(mins).padStart(2, "0")}` : `${whole}`;
                              };
                              return (
                                <div
                                  key={i}
                                  className="home-uptime-hours__slot"
                                  title={`今日 ${fmt(startH)}–${fmt(endH)}`}
                                >
                                  <span className="home-uptime-hours__fill" style={{ height: `${fill}%` }} />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      {uptimeHint ? (
                        <p className="home-sys-card__hint" title={uptimeHint}>
                          {uptimeHint}
                        </p>
                      ) : null}
                    </div>
                    <div className={`home-sys-card${memResourceWarn ? " home-sys-card--warn" : ""}`}>
                      <div className="home-sys-card__head">
                        <span className="home-sys-card__label">内存</span>
                        <span className="home-sys-card__value">{pct(runtime?.memory?.percent ?? null, 2)}</span>
                      </div>
                      <div className="home-sys-card__viz">
                        {memBarPct != null ? (
                          <div className="home-sys-card__bar">
                            <span style={{ width: `${memBarPct}%` }} />
                          </div>
                        ) : null}
                      </div>
                      {memHint ? (
                        <p className="home-sys-card__hint" title={memHint}>
                          {memHint}
                        </p>
                      ) : null}
                    </div>
                    <div className={`home-sys-card${diskResourceWarn ? " home-sys-card--warn" : ""}`}>
                      <div className="home-sys-card__head">
                        <span className="home-sys-card__label">磁盘</span>
                        <span className="home-sys-card__value">{pct(runtime?.disk?.percent ?? null)}</span>
                      </div>
                      <div className="home-sys-card__viz">
                        {diskBarPct != null ? (
                          <div className="home-sys-card__bar">
                            <span style={{ width: `${diskBarPct}%` }} />
                          </div>
                        ) : null}
                      </div>
                      {diskHint ? (
                        <p className="home-sys-card__hint" title={diskHint}>
                          {diskHint}
                        </p>
                      ) : null}
                    </div>
                    {gpuDevices.map((dev) => {
                      const utilPct = gpuUtilBarPct(dev.utilization_gpu);
                      const memPct =
                        gpuMemBarPct(dev.memory_used, dev.memory_total)
                        ?? barPct(dev.utilization_memory ?? null, null, null);
                      const memLabel =
                        dev.memory_total > 0
                          ? pct((dev.memory_used / dev.memory_total) * 100)
                          : pct(dev.utilization_memory);
                      const gpuFoot = `${fmtBytes(dev.memory_used)} / ${fmtBytes(dev.memory_total)}${
                        dev.temperature != null ? ` · ${tempDisplay(dev.temperature)}` : ""
                      }`;
                      return (
                        <div key={dev.index} className="home-sys-card home-sys-card--gpu">
                          <div className="home-sys-card__head">
                            <span className="home-sys-card__label">GPU {dev.index}</span>
                          </div>
                          <p className="home-sys-card__hint" title={dev.name || undefined}>
                            {gpuNameShort(dev.name || "", 36)}
                          </p>
                          <div className="home-sys-card__gpu-metrics">
                            <div className="home-sys-card__gpu-metric">
                              <div className="home-sys-card__row home-sys-card__row--sub">
                                <span className="home-sys-card__label">利用率</span>
                                <span className="home-sys-card__value home-sys-card__value--sm">
                                  {pct(dev.utilization_gpu)}
                                </span>
                              </div>
                              {utilPct != null ? (
                                <div className="home-sys-card__bar">
                                  <span style={{ width: `${utilPct}%` }} />
                                </div>
                              ) : null}
                            </div>
                            <div className="home-sys-card__gpu-metric">
                              <div className="home-sys-card__row home-sys-card__row--sub">
                                <span className="home-sys-card__label">显存</span>
                                <span className="home-sys-card__value home-sys-card__value--sm">{memLabel}</span>
                              </div>
                              {memPct != null ? (
                                <div className="home-sys-card__bar">
                                  <span style={{ width: `${memPct}%` }} />
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <p className="home-sys-card__hint" title={gpuFoot}>
                            {gpuFoot}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cn(HOME_PANEL, "home-card--ver overflow-hidden")} style={{ gridArea: "verL" }}>
              <CardHeader className={HOME_PANEL_HD}>
                <CardTitle className={cn(HOME_PANEL_TITLE, "flex items-center gap-1.5")}>
                  <PanelTitleIcon icon={Package} />
                  版本
                </CardTitle>
                {botUpdate?.has_update || webUpdate?.has_update ? (
                  <span className="badge badge--warn">有更新</span>
                ) : null}
              </CardHeader>
              <CardContent className={HOME_PANEL_BD}>
                <HomeLazyReveal loading={versionMetaPending && !botUpdate && !webUpdate} variant="version-dl" ariaLabel="版本信息加载中">
                  <dl className="home-ver-dl">
                    <div className="home-ver-dl__row">
                      <dt>消息框架</dt>
                      <dd>
                        {(() => {
                          const s = (health?.nonebot2 ?? "").trim();
                          const x = displayVersionWithoutSha(s);
                          const label = x || s || "—";
                          return (
                            <span className="home-ver-dl__val" title={label === "—" ? undefined : label}>
                              {label}
                            </span>
                          );
                        })()}
                        <span className="home-ver-dl__meta">
                          <span className="home-ver-dl__tag">Nonebot</span>
                        </span>
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>Pallas-Bot</dt>
                      <dd>
                        {(() => {
                          const label = pallasBotVersionLabel(health ?? null, botUpdate ?? null);
                          return (
                            <span className="home-ver-dl__val" title={label && label !== "—" ? label : undefined}>
                              {label}
                            </span>
                          );
                        })()}
                        <span className="home-ver-dl__meta">
                          {botUpdate?.has_update ? (
                            <Link className="home-ver-dl__link" to="/update#console-update-bot">
                              <span className="badge badge--warn">有更新</span>
                            </Link>
                          ) : botUpdate?.development_build ? (
                            <span className="badge badge--secondary" title={botDevelopmentBuildTitle}>
                              开发构建
                            </span>
                          ) : null}
                          <span className="home-ver-dl__tag">core</span>
                        </span>
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>控制台资源</dt>
                      <dd>
                        {(() => {
                          const label = consoleResourceVersionLabel(health ?? null, webUpdate ?? null, {
                            webuiBuildVersion: __WEBUI_VERSION__,
                          });
                          return (
                            <span className="home-ver-dl__val" title={label && label !== "—" ? label : undefined}>
                              {label}
                            </span>
                          );
                        })()}
                        {webUpdate?.has_update ? (
                          <span className="home-ver-dl__meta">
                            <Link className="home-ver-dl__link" to="/update#console-update-webui">
                              <span className="badge badge--warn">有更新</span>
                            </Link>
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>Python</dt>
                      <dd>
                        {(() => {
                          const label = runtime?.python?.trim() || "—";
                          return (
                            <span
                              className="home-ver-dl__val home-ver-dl__val--mono"
                              title={label === "—" ? undefined : label}
                            >
                              {label}
                            </span>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>
                </HomeLazyReveal>
              </CardContent>
            </Card>

            <Card className={cn(HOME_PANEL, "home-card--ver overflow-hidden")} style={{ gridArea: "verR" }}>
              <CardHeader className={HOME_PANEL_HD}>
                <CardTitle className={cn(HOME_PANEL_TITLE, "flex items-center gap-1.5")}>
                  <PanelTitleIcon icon={Server} />
                  环境
                </CardTitle>
                {health?.ok ? (
                  <span className={cn(HOME_PANEL_TAG, "home-card__tag--ok")}>API 已连接</span>
                ) : null}
              </CardHeader>
              <CardContent className={HOME_PANEL_BD}>
                <HomeLazyReveal loading={versionMetaPending && !system} variant="version-dl" ariaLabel="环境信息加载中">
                  <dl className="home-ver-dl">
                    <div className="home-ver-dl__row">
                      <dt>服务时间</dt>
                      <dd>
                        <span className="home-ver-dl__val home-ver-dl__val--mono">
                          {system?.server_time != null
                            ? new Date(system.server_time * 1000).toLocaleString()
                            : "—"}
                        </span>
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>监听地址</dt>
                      <dd>
                        <span className="home-ver-dl__val home-ver-dl__val--mono">
                          {(() => {
                            const d = system?.nonebot2_driver;
                            if (!d?.host && d?.port == null) return "—";
                            const host = (d.host ?? "0.0.0.0").trim() || "0.0.0.0";
                            return `${host}:${d.port ?? "—"}`;
                          })()}
                        </span>
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>系统</dt>
                      <dd>
                        <span className="home-ver-dl__val">{osFamilyLabel(runtime?.platform)}</span>
                      </dd>
                    </div>
                    <div className="home-ver-dl__row">
                      <dt>主机</dt>
                      <dd>
                        <span className="home-ver-dl__val">{runtime?.hostname?.trim() || "—"}</span>
                      </dd>
                    </div>
                  </dl>
                </HomeLazyReveal>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
