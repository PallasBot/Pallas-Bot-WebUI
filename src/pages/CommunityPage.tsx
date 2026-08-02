import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchCommunityStats,
  fetchCorpusStatus,
  fetchFederationOnboarding,
  peekCommunityStatsCache,
  peekHomeOverviewCache,
  probeCommunityConnectivity,
} from "@/api/fullConsole";
import type {
  CommunityConnectivityCheckData,
  CommunityHotTab,
  CommunityStatsData,
  CommunityVersionCountData,
  CorpusSourceStatusData,
  HomeOverviewData,
} from "@/api/pallasTypes";
import { PALLAS_COMMUNITY_HUB } from "@/utils/pallasExternalLinks";
import { copyTextToClipboard } from "@/utils/clipboard";
import CorpusWordCloud, { COMMUNITY_HOT_TAB_OPTIONS } from "@/components/CorpusWordCloud";
import ConsoleHint from "@/components/ConsoleHint";
import PageMasthead from "@/components/PageMasthead";
import PendingValue from "@/components/PendingValue";
import StatusTone from "@/components/StatusTone";
import ChromeField, { ChromeOptionLabel } from "@/components/ChromeField";
import ChromeTools, { CHROME_SELECT_TRIGGER, CHROME_TOOLS_TRAILING } from "@/components/ChromeTools";
import RefreshIconButton from "@/components/RefreshIconButton";
import CopyIconButton from "@/components/CopyIconButton";
import SegTabs from "@/components/SegTabs";
import UiBadge from "@/components/ui/UiBadge";
import UiButton from "@/components/ui/UiButton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pushConsoleToast } from "@/utils/consoleToast";
import { freezeShellMainScroll, preserveShellMainScroll } from "@/utils/preserveShellScroll";
import { querySettled } from "@/utils/querySettled";
import type { ReactNode } from "react";
import {
  Activity,
  Bot,
  Database,
  ExternalLink,
  Flame,
  Globe2,
  HardDrive,
  Layers,
  Library,
  List,
  Network,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import PanelTitleIcon from "@/components/PanelTitleIcon";
import BtnIco from "@/components/BtnIco";

const allSourceKeys = ["local", "fed", "community"] as const;
type SourceKey = (typeof allSourceKeys)[number];

type CommunitySectionId = "deploy" | "federation" | "corpus" | "hot";

const COMMUNITY_SECTIONS: Array<{
  id: CommunitySectionId;
  label: string;
  hash: string;
  icon: LucideIcon;
}> = [
  { id: "deploy", label: "全网部署", hash: "community-deploy", icon: Globe2 },
  { id: "federation", label: "多机协同", hash: "community-federation", icon: Network },
  { id: "corpus", label: "语料", hash: "community-corpus", icon: Library },
  { id: "hot", label: "热词", hash: "community-hot", icon: Flame },
];

/** 旧 hash（本机语料 / 本机热词独立页）仍落到合并后的面板 */
const LEGACY_HASH_TO_SECTION: Record<string, CommunitySectionId> = {
  "community-local": "corpus",
  "community-local-hot": "hot",
};

function communitySectionFromHash(hash: string): CommunitySectionId | null {
  const id = hash.replace(/^#/, "").trim();
  const hit = COMMUNITY_SECTIONS.find((s) => s.hash === id);
  if (hit) return hit.id;
  return LEGACY_HASH_TO_SECTION[id] ?? null;
}

function formatUnixRelative(unix: number | null | undefined): string {
  if (unix == null || !Number.isFinite(unix) || unix <= 0) return "尚无成功上报记录";
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - Math.floor(unix));
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  return `${Math.floor(sec / 86400)} 天前`;
}

function shortProbeHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
}

function formatCommunityStatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.floor(n).toLocaleString();
}

/** 中心是否开放共享语料：优先 corpus_enabled；/v1/stats 无该字段时用 corpus 块推断 */
function hubCorpusEnabled(stats: CommunityStatsData): boolean | null {
  if (typeof stats.corpus_enabled === "boolean") return stats.corpus_enabled;
  if (stats.corpus != null) return true;
  return null;
}

function formatUnixSec(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts) || ts <= 0) return "—";
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

function sourceLabel(key: SourceKey): string {
  if (key === "local") return "本机";
  if (key === "fed") return "协同接话库";
  return "共享池";
}

function mergeStrategyLabel(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "—";
  const map: Record<string, string> = {
    local_first: "本地优先",
    merge_counts: "合并使用次数",
  };
  return map[s] || s;
}

function remoteFailureLabel(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "—";
  const map: Record<string, string> = { local_only: "仅用本机语料" };
  return map[s] || s;
}

const sourceMatrixRows = [
  { key: "enabled", label: "启用" },
  { key: "enrolled", label: "已接入" },
  { key: "readable", label: "可读" },
  { key: "writable", label: "可写" },
  { key: "contribute", label: "可贡献" },
] as const;

type MatrixRowKey = (typeof sourceMatrixRows)[number]["key"];
const localMatrixNaRows = new Set<MatrixRowKey>(["enrolled", "contribute"]);

function matrixCellState(
  sourceKey: SourceKey,
  source: CorpusSourceStatusData | undefined,
  rowKey: MatrixRowKey,
): "on" | "off" | "na" {
  if (sourceKey === "local" && localMatrixNaRows.has(rowKey)) return "na";
  if (!source) return "na";
  if (rowKey === "enabled") return source.enabled ? "on" : "off";
  if (!source.enabled) return "na";
  return source[rowKey] ? "on" : "off";
}

function matrixCellText(state: "on" | "off" | "na"): string {
  if (state === "on") return "是";
  if (state === "off") return "否";
  return "—";
}

function ingressEnabledLabel(raw: string | undefined): string {
  const s = (raw || "auto").trim() || "auto";
  if (s === "true") return "开启";
  if (s === "false") return "关闭";
  return "自动";
}

export default function CommunityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const redirectToGallery = location.hash.replace(/^#/, "").trim() === "community-gallery";
  const [section, setSection] = useState<CommunitySectionId>(
    () => communitySectionFromHash(typeof window !== "undefined" ? window.location.hash : "") ?? "deploy",
  );
  const [hotTab, setHotTab] = useState<CommunityHotTab>("fleet");
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [hotReloadToken, setHotReloadToken] = useState(0);
  const [err, setErr] = useState("");
  const [connectivityBusy, setConnectivityBusy] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState<CommunityConnectivityCheckData | null>(null);

  const statsSeed = useMemo((): CommunityStatsData | undefined => {
    const peek = peekCommunityStatsCache();
    if (peek) return peek;
    const fromQc = qc.getQueryData<HomeOverviewData>(["home-overview"])?.community_stats;
    if (fromQc) return fromQc;
    return peekHomeOverviewCache()?.community_stats ?? undefined;
  }, [qc]);

  const statsQ = useQuery({
    queryKey: ["community-stats"],
    queryFn: () => fetchCommunityStats({}),
    initialData: statsSeed,
    initialDataUpdatedAt: statsSeed ? Date.now() - 1_000 : undefined,
    staleTime: 30_000,
  });
  const corpusStatusQ = useQuery({
    queryKey: ["corpus-status"],
    queryFn: fetchCorpusStatus,
    staleTime: 15_000,
  });
  const federationQ = useQuery({
    queryKey: ["federation-onboarding"],
    queryFn: fetchFederationOnboarding,
    retry: false,
    staleTime: 60_000,
  });

  const communityStats = statsQ.data ?? null;
  const statsPending = !querySettled(statsQ);
  const corpusStatus = corpusStatusQ.data ?? null;
  const corpusStatusPending = !querySettled(corpusStatusQ);
  const federationOnboarding = federationQ.data ?? null;
  const federationOnboardingUnavailable = federationQ.isFetched && federationOnboarding == null;
  // 默认「全网部署」不依赖 corpus-status；勿挡整页骨架
  const statsUnavailable = statsQ.isFetched && !communityStats;

  const onlineHint = useMemo(() => {
    const sec = communityStats?.online_ttl_sec;
    if (sec == null || !Number.isFinite(sec) || sec < 60) return "近期有上报";
    return `近 ${Math.max(1, Math.round(sec / 60))} 分钟内有上报`;
  }, [communityStats]);

  const deploymentsOnlineHint = `${onlineHint}的自托管安装套数`;
  const botsOnlineHint = useMemo(() => {
    const sum = communityStats?.bots_online_sum;
    const onlineDep = communityStats?.deployments_online;
    if (sum != null && onlineDep != null && onlineDep > 0) {
      const avg = sum / onlineDep;
      return `各安装上报的在线牛牛合计，平均每套约 ${avg >= 10 ? Math.round(avg) : avg.toFixed(1)} 只`;
    }
    return "各安装向社区中心上报的在线牛牛总数";
  }, [communityStats]);

  const activeRecentHint = useMemo(() => {
    const parts: string[] = [];
    if (communityStats?.deployments_total != null) parts.push(`历史累计 ${formatCommunityStatNum(communityStats.deployments_total)} 套`);
    if (communityStats?.catalog_bots_online_sum != null) parts.push(`当前在线名册 ${formatCommunityStatNum(communityStats.catalog_bots_online_sum)} 只牛牛`);
    return parts.length ? parts.join(" · ") : "近 24 小时内有统计上报的安装数";
  }, [communityStats]);

  const corpusPoolValue = useMemo(() => {
    const ctx = formatCommunityStatNum(communityStats?.corpus?.contexts_total);
    const ans = formatCommunityStatNum(communityStats?.corpus?.answers_total);
    if (ctx === "—" && ans === "—") return "—";
    return `${ctx} 词条 · ${ans} 回复`;
  }, [communityStats]);

  const corpusPoolHint = useMemo(() => {
    const hits = communityStats?.corpus?.answer_hits_sum;
    if (hits != null && Number.isFinite(hits)) return `回复累计被引用 ${formatCommunityStatNum(hits)} 次`;
    return "共享池中的触发词与回复条目";
  }, [communityStats]);

  const corpusOnlineEnrollHint = useMemo(() => {
    const total = communityStats?.corpus?.enrollments_total;
    const parts: string[] = [`${onlineHint}且已接入共享语料`];
    if (total != null) parts.push(`历史累计 ${formatCommunityStatNum(total)} 套`);
    return parts.join(" · ");
  }, [communityStats, onlineHint]);

  const corpusTotalEnrollHint = useMemo(() => {
    const recent = communityStats?.corpus?.enrollments_recent_24h;
    const contrib = communityStats?.corpus?.contribute_enabled_total;
    const parts: string[] = ["曾经接入过社区共享语料的安装总数"];
    if (recent != null && recent > 0) parts.push(`近 24 小时新增 ${formatCommunityStatNum(recent)} 套`);
    if (contrib != null) parts.push(`其中 ${formatCommunityStatNum(contrib)} 套允许上传新回复`);
    return parts.join(" · ");
  }, [communityStats]);

  const onlineVersions = useMemo((): CommunityVersionCountData[] => {
    const rows = communityStats?.online_versions;
    if (!Array.isArray(rows)) return [];
    return [...rows].sort((a, b) => b.count - a.count);
  }, [communityStats]);

  const onlineVersionsTotal = useMemo(
    () => onlineVersions.reduce((sum, row) => sum + (row.count || 0), 0),
    [onlineVersions],
  );
  const hubCorpusTone = useMemo(
    () => (communityStats ? hubCorpusEnabled(communityStats) : null),
    [communityStats],
  );

  const statsAsOfText = (communityStats?.as_of || "").trim() ? `快照 ${communityStats?.as_of}` : "";
  const statsUrl = (communityStats?.stats_url || "").trim();
  const communityHubUrl = (federationOnboarding?.stats_primary_url || PALLAS_COMMUNITY_HUB).trim() || PALLAS_COMMUNITY_HUB;

  const federationSecret = (federationOnboarding?.instance_secret || "").trim();
  const federationCoordDisplay = useMemo(() => {
    const c = federationOnboarding?.coord;
    if (!c) return "";
    const display = (c.redis_url_display || "").trim();
    if (display) return display;
    const host = (c.host || "").trim();
    if (!host) return "";
    const port = c.port != null ? `:${c.port}` : "";
    const db = c.db != null ? `/${c.db}` : "";
    return `redis://${host}${port}${db}`;
  }, [federationOnboarding]);
  const federationCoordEndpoint = useMemo(() => {
    const c = federationOnboarding?.coord;
    if (!c) return "";
    const host = (c.host || "").trim();
    if (!host) return "";
    const port = c.port != null ? String(c.port) : "";
    const db = c.db != null ? `/${c.db}` : "";
    return port ? `${host}:${port}${db}` : `${host}${db}`;
  }, [federationOnboarding]);
  const federationCoordActiveLabel = useMemo(() => {
    const n = federationOnboarding?.pool_stats?.coord_active_deployments
      ?? communityStats?.federation?.coord_active_deployments;
    if (n == null) return "—";
    return formatCommunityStatNum(n);
  }, [communityStats, federationOnboarding]);

  async function copyFederationSecret(): Promise<boolean> {
    if (!federationSecret) {
      pushConsoleToast("中心未提供入池密钥", "err");
      return false;
    }
    if (!(await copyTextToClipboard(federationSecret))) {
      pushConsoleToast("复制失败", "err");
      return false;
    }
    pushConsoleToast("已复制入池密钥", "ok");
    return true;
  }

  async function copyCoordAddress(): Promise<boolean> {
    const text = federationCoordDisplay || federationCoordEndpoint;
    if (!text) {
      pushConsoleToast("暂无去重服务器地址", "err");
      return false;
    }
    if (!(await copyTextToClipboard(text))) {
      pushConsoleToast("复制失败", "err");
      return false;
    }
    pushConsoleToast("已复制去重服务器地址（不含密码）", "ok");
    return true;
  }

  const fedSourceVisible = (fed: CorpusSourceStatusData | undefined) => !!(fed?.configured || fed?.enabled);
  const visibleSourceKeys = useMemo((): SourceKey[] => {
    const keys: SourceKey[] = ["local"];
    if (fedSourceVisible(corpusStatus?.sources?.fed)) keys.push("fed");
    keys.push("community");
    return keys;
  }, [corpusStatus]);

  const sourceApiEntries = useMemo(() => {
    return visibleSourceKeys
      .map((key) => ({ key, url: (corpusStatus?.sources?.[key]?.api_base || "").trim() }))
      .filter((row) => row.url);
  }, [corpusStatus, visibleSourceKeys]);

  const mergeOrderSteps = useMemo(() => {
    const order = corpusStatus?.merge_order;
    if (!Array.isArray(order) || !order.length) return [] as Array<"local" | "fed" | "community">;
    const allowed = new Set(["local", "fed", "community"]);
    const visible = new Set(visibleSourceKeys);
    return order.filter((s): s is "local" | "fed" | "community" => allowed.has(s) && visible.has(s as SourceKey));
  }, [corpusStatus, visibleSourceKeys]);

  const corpusSummaryFlow = mergeOrderSteps.map((k) => sourceLabel(k)).join(" → ");

  const corpusMultiSourceBadge = useMemo(() => {
    if (!corpusStatus) return { label: "多源接话未启用", ok: false };
    const community = corpusStatus.sources?.community;
    if (corpusStatus.composite_active) {
      if (community?.wanted && !community?.readable) return { label: "多源接话已启用（待接入）", ok: true };
      return { label: "多源接话已启用", ok: true };
    }
    if (community?.wanted) return { label: "多源接话已开启（待就绪）", ok: false };
    const mode = String(corpusStatus.remote_find_mode || "").trim();
    if (mode === "prefetch" || mode === "sync") return { label: "本机未命中时查社区已开", ok: true };
    return { label: "多源接话未启用", ok: false };
  }, [corpusStatus]);

  const controlPlane = corpusStatus?.control_plane;
  const federationPoolStats = federationOnboarding?.pool_stats ?? communityStats?.federation ?? null;

  const refresh = useCallback(async () => {
    setRefreshBusy(true);
    try {
      await Promise.all([statsQ.refetch(), corpusStatusQ.refetch(), federationQ.refetch()]);
      setHotReloadToken((t) => t + 1);
    } finally {
      setRefreshBusy(false);
    }
  }, [corpusStatusQ, federationQ, statsQ]);

  useEffect(() => {
    const fromHash = communitySectionFromHash(location.hash);
    if (fromHash && fromHash !== section) setSection(fromHash);
  }, [location.hash, section]);

  function selectSection(id: CommunitySectionId) {
    preserveShellMainScroll(() => {
      setSection(id);
      const meta = COMMUNITY_SECTIONS.find((s) => s.id === id) ?? COMMUNITY_SECTIONS[0];
      const nextHash = `#${meta.hash}`;
      if (location.hash !== nextHash) {
        navigate({ pathname: location.pathname, search: location.search, hash: nextHash }, { replace: true });
      }
    });
  }

  async function runConnectivityCheck() {
    if (connectivityBusy) return;
    setConnectivityBusy(true);
    try {
      setConnectivityResult(await probeCommunityConnectivity());
    } catch (e) {
      setConnectivityResult(null);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setConnectivityBusy(false);
    }
  }

  if (redirectToGallery) {
    return <Navigate to="/community-gallery" replace />;
  }

  return (
    <div className="community-page console-hub-page">
      <PageMasthead title="统计与语料" description="社区统计、语料与多机协同（只读）。" />

      <ChromeTools>
        <ChromeField label="选择" icon={Layers} className="shrink-0">
          <Select
            value={section}
            onValueChange={(v) => selectSection(v as CommunitySectionId)}
            onOpenChange={(open) => {
              if (open) freezeShellMainScroll(160);
            }}
          >
            <SelectTrigger className={CHROME_SELECT_TRIGGER} aria-label="面板分类">
              <SelectValue placeholder="选择面板" />
            </SelectTrigger>
            <SelectContent
              align="start"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              {COMMUNITY_SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <ChromeOptionLabel icon={s.icon}>{s.label}</ChromeOptionLabel>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ChromeField>

        {section === "hot" ? (
          <SegTabs
            size="toolbar"
            ariaLabel="共享热词统计范围"
            value={hotTab}
            onValueChange={(v) => setHotTab(v as CommunityHotTab)}
            options={COMMUNITY_HOT_TAB_OPTIONS}
          />
        ) : null}

        <div className={CHROME_TOOLS_TRAILING}>
          <Button type="button" variant="outline" size="sm" asChild className="group">
            <a href={communityHubUrl} target="_blank" rel="noopener noreferrer">
              <BtnIco icon={ExternalLink} motion="external" />
              社区主站
            </a>
          </Button>
          <RefreshIconButton
            busy={refreshBusy}
            label="刷新"
            showLabel
            onClick={() => void refresh()}
          />
        </div>
      </ChromeTools>

      {err ? <p className="alert alert--err community-page__alert">{err}</p> : null}

      {statsUnavailable ? (
        <ConsoleHint className="community-page__alert">
          <span>
            暂时无法从社区中心获取数据，下列数字以 — 占位。请确认本机已开启「上报在线统计」，且网络能访问社区中心。
          </span>
          <UiButton
            variant="ghost"
            size="sm"
            className="community-page__alert-probe-btn"
            disabled={connectivityBusy}
            onClick={() => void runConnectivityCheck()}
          >
            {connectivityBusy ? "检测中…" : "检测连通"}
          </UiButton>
          <Link className="community-page__inline-link" to="/community-stats-config">
            前往在线统计设置
          </Link>
        </ConsoleHint>
      ) : null}

      {section === "deploy" ? (
      <section className="community-page__section community-page__section--deploy">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd community-page__deploy-panel-hd">
            <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
              <PanelTitleIcon icon={Globe2} />
              全网部署
              <RefreshIconButton embedded className="hub-refresh-narrow-only" showLabel={false} busy={refreshBusy} label="刷新" onClick={() => void refresh()} />
            </h2>
            <div className="row-actions community-page__hd-actions community-page__deploy-hd-actions">
              <UiButton
                variant="ghost"
                size="sm"
                className="community-page__deploy-probe-btn"
                disabled={connectivityBusy}
                onClick={() => void runConnectivityCheck()}
              >
                {connectivityBusy ? "检测中…" : "检测连通"}
              </UiButton>
              <Link to="/community-stats-config" className="btn community-page__deploy-settings-btn">
                在线统计设置
              </Link>
            </div>
          </div>
          <div className="panel__bd">
            {connectivityResult ? (
              <div className={`community-page__probe-card ${connectivityResult.summary.any_ok ? "is-ok" : "is-bad"}`}>
                <p className="community-page__probe-hint">{connectivityResult.summary.hint}</p>
                <ul className="community-page__probe-list">
                  {connectivityResult.probes.map((row) => (
                    <li key={row.url} className="community-page__probe-row">
                      <span className={`badge ${row.ok ? "badge--ok" : "badge--warn"}`}>{row.ok ? "可达" : "失败"}</span>
                      <code className="community-page__mono community-page__probe-url">{shortProbeHost(row.url)}</code>
                      <span className="muted community-page__probe-meta">
                        {row.ok ? (row.latency_ms != null ? `${row.latency_ms} ms` : "—") : row.error || (row.http_status != null ? `HTTP ${row.http_status}` : "失败")}
                      </span>
                    </li>
                  ))}
                </ul>
                <dl className="home-dl community-page__detail-dl community-page__probe-reporting">
                  <dt>上报开关</dt>
                  <dd>{connectivityResult.reporting.enabled ? "已开启" : "已关闭"}</dd>
                  <dt>配置 endpoint</dt>
                  <dd className="community-page__mono">{connectivityResult.reporting.endpoint || "—"}</dd>
                  <dt>最近成功入口</dt>
                  <dd className="community-page__mono">{connectivityResult.reporting.active_heartbeat_endpoint || "—"}</dd>
                  <dt>上次成功上报</dt>
                  <dd>{formatUnixRelative(connectivityResult.reporting.last_heartbeat_ok_unix)}</dd>
                </dl>
              </div>
            ) : null}

            <div className="community-page__kpi-bar home-kpi-bar community-page__deploy-grid">
              <MetricTile
                icon={Globe2}
                label="活跃安装"
                value={statsPending ? <PendingValue pending /> : formatCommunityStatNum(communityStats?.deployments_online)}
                hint={deploymentsOnlineHint}
              />
              <MetricTile
                icon={Bot}
                label="在线牛牛"
                value={statsPending ? <PendingValue pending /> : formatCommunityStatNum(communityStats?.bots_online_sum)}
                hint={botsOnlineHint}
              />
              <MetricTile
                icon={Layers}
                label="分片安装"
                value={
                  statsPending ? (
                    <PendingValue pending />
                  ) : (
                    `${formatCommunityStatNum(communityStats?.deployments_online_sharded)} / ${formatCommunityStatNum(communityStats?.shard_workers_online_sum)}`
                  )
                }
                hint="采用分片架构的安装数 / 在线工作进程数"
              />
              <MetricTile
                icon={Activity}
                label="近 24 小时"
                value={statsPending ? <PendingValue pending /> : formatCommunityStatNum(communityStats?.active_recent_24h)}
                hint={activeRecentHint}
              />
            </div>

            <dl className="home-dl community-page__detail-dl community-page__meta-dl">
              <dt>历史安装</dt>
              <dd>
                {statsPending ? <PendingValue pending /> : <>{formatCommunityStatNum(communityStats?.deployments_total)} 套</>}
              </dd>
              <dt>在线名册</dt>
              <dd>
                {statsPending ? (
                  <PendingValue pending />
                ) : (
                  <>{formatCommunityStatNum(communityStats?.catalog_bots_online_sum)} 只牛牛</>
                )}
              </dd>
              <dt>共享语料</dt>
              <dd>
                {statsPending ? (
                  <StatusTone pending pendingLabel="加载中" okLabel="已接入" offLabel="未接入" />
                ) : hubCorpusTone == null ? (
                  "—"
                ) : (
                  <StatusTone
                    ok={hubCorpusTone}
                    pendingLabel="加载中"
                    okLabel="已接入"
                    offLabel="未接入"
                  />
                )}
              </dd>
              {statsAsOfText || statsUrl ? (
                <>
                  <dt>数据来源</dt>
                  <dd className="community-page__meta-stack">
                    {statsAsOfText ? <span className="community-page__meta-line">{statsAsOfText}</span> : null}
                    {statsUrl ? (
                      <a className="community-page__ext-link community-page__meta-line community-page__mono" href={statsUrl} target="_blank" rel="noopener noreferrer">
                        {statsUrl}
                      </a>
                    ) : null}
                  </dd>
                </>
              ) : null}
            </dl>

            {onlineVersions.length ? (
              <div className="community-page__versions">
                <h3 className="community-page__subhd">在线版本分布</h3>
                <ul className="community-page__version-list">
                  {onlineVersions.map((row, index) => {
                    const count = row.count || 0;
                    const share =
                      onlineVersionsTotal > 0 ? Math.min(100, (count / onlineVersionsTotal) * 100) : 0;
                    const isTop = index === 0 && count > 0;
                    return (
                      <li
                        key={row.version}
                        className={`community-page__version-row${isTop ? " community-page__version-row--top" : ""}`}
                      >
                        <div className="community-page__version-head">
                          <span className="community-page__version-name community-page__mono">
                            {row.version || "—"}
                          </span>
                          <span className="community-page__version-count">
                            {formatCommunityStatNum(count)} 套
                          </span>
                        </div>
                        <div
                          className="community-page__version-track"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(share)}
                          aria-label={`${row.version || "未知"} 占比 ${Math.round(share)}%`}
                        >
                          <span
                            className="community-page__version-fill"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {section === "federation" ? (
      <section className="community-page__section community-page__section--federation">
        <div className="panel community-page__panel community-page__federation-panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
              <PanelTitleIcon icon={Network} />
              {federationOnboarding?.title || "多机协同"}
            </h2>
            <div className="row-actions community-page__hd-actions">
              <Link to="/plugins/pb_core" className="btn">
                多机协同
              </Link>
            </div>
          </div>
          <div className="panel__bd community-page__federation-bd">
            {federationOnboarding?.summary ? (
              <p className="community-page__federation-summary">{federationOnboarding.summary}</p>
            ) : federationOnboardingUnavailable ? (
              <p className="muted community-page__federation-summary">
                社区中心暂未提供入池说明；多机协同默认开启时，较新版本会在启动时自动写入密钥并拉取配置，也可在「多机协同」里手动填写。
              </p>
            ) : null}
            {federationOnboarding ? (
              <p className="muted community-page__federation-summary">
                较新版本 Bot：多机协同开启且密钥为空时，启动会从中心自动写入入池密钥并拉取池编号 / 去重地址；下方步骤仍适用于手动核对或旧版本。
              </p>
            ) : null}
            {federationOnboarding?.ingress_note ? (
              <p className="community-page__federation-ingress-note muted">{federationOnboarding.ingress_note}</p>
            ) : null}
            <p className="muted community-page__federation-pool-note">
              左两列为已登记协同配置且近期上报在线统计的安装；右列为去重服务上仍有活跃标记的安装。
            </p>
            <div className="community-page__kpi-bar home-kpi-bar community-page__federation-pool-grid">
              <MetricTile icon={Users} label="累计入池" value={formatCommunityStatNum(federationPoolStats?.members_total)} hint="曾成功从社区中心领取协同配置的安装套数" />
              <MetricTile icon={Network} label="在线入池" value={formatCommunityStatNum(federationPoolStats?.members_online)} hint="已入池且近期有在线统计上报的安装套数" />
              <MetricTile icon={Activity} label="去重活跃" value={federationCoordActiveLabel} hint="去重服务上仍有活跃标记的安装数，表示近期有牛牛在处理群消息" />
            </div>

            {federationSecret ? (
              <div className="community-page__federation-secret">
                <div className="community-page__federation-secret-hd">
                  <span className="community-page__federation-secret-label">
                    {federationOnboarding?.instance_secret_label || "入池密钥"}
                  </span>
                  <CopyIconButton
                    label="复制入池密钥"
                    onClick={() => copyFederationSecret()}
                  />
                </div>
                <code className="community-page__federation-secret-value community-page__mono">{federationSecret}</code>
                {federationOnboarding?.instance_secret_hint ? (
                  <p className="community-page__federation-secret-hint muted">{federationOnboarding.instance_secret_hint}</p>
                ) : null}
              </div>
            ) : null}

            {federationOnboarding ? (
              <dl className="home-dl community-page__detail-dl community-page__federation-meta">
                <dt>协同池</dt>
                <dd className="community-page__mono">{federationOnboarding.federate_id || "—"}</dd>
                <dt>自动拉取配置</dt>
                <dd>
                  <UiBadge variant={federationOnboarding.bootstrap_enabled ? "ok" : "secondary"}>
                    {federationOnboarding.bootstrap_enabled ? "已开启" : "已关闭"}
                  </UiBadge>
                </dd>
                <dt>去重服务器</dt>
                <dd className="community-page__federation-coord-dd">
                  {federationCoordDisplay || federationCoordEndpoint ? (
                    <div className="community-page__federation-coord-row">
                      <code className="community-page__federation-coord-value community-page__mono">
                        {federationCoordDisplay || federationCoordEndpoint}
                      </code>
                      <CopyIconButton
                        label="复制去重服务器地址"
                        onClick={() => copyCoordAddress()}
                      />
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                  {federationOnboarding.coord_redis_hint ? (
                    <p className="community-page__federation-coord-hint muted">{federationOnboarding.coord_redis_hint}</p>
                  ) : null}
                </dd>
              </dl>
            ) : null}

            {controlPlane ? (
              <div className="community-page__federation-local">
                <h3 className="community-page__subhd">本部署状态</h3>
                <div className="community-page__corpus-meta-bar">
                  <span className="community-page__corpus-meta-item">
                    <span className="community-page__corpus-meta-k">多机协同</span>
                    <span className={`community-page__corpus-meta-v ${controlPlane.enabled ? "is-ok" : "is-off"}`}>
                      {controlPlane.enabled ? "已开启" : "已关闭"}
                    </span>
                  </span>
                  <span className="community-page__corpus-meta-item">
                    <span className="community-page__corpus-meta-k">入池密钥</span>
                    <span className={`community-page__corpus-meta-v ${controlPlane.instance_secret_configured ? "is-ok" : "is-off"}`}>
                      {controlPlane.instance_secret_configured ? "已配置" : "未配置（可自动写入）"}
                    </span>
                  </span>
                  <span className="community-page__corpus-meta-item">
                    <span className="community-page__corpus-meta-k">中心配置</span>
                    <span className={`community-page__corpus-meta-v ${controlPlane.bootstrap_valid ? "is-ok" : "is-off"}`}>
                      {controlPlane.bootstrap_valid ? "已获取" : "待拉取或过期"}
                    </span>
                  </span>
                  <span className="community-page__corpus-meta-item">
                    <span className="community-page__corpus-meta-k">消息去重</span>
                    <span className="community-page__corpus-meta-v">{ingressEnabledLabel(controlPlane.federate_ingress_enabled)}</span>
                  </span>
                  {controlPlane.federate_id ? (
                    <span className="community-page__corpus-meta-item community-page__corpus-meta-item--grow">
                      <span className="community-page__corpus-meta-k">池编号</span>
                      <span className="community-page__corpus-meta-v community-page__mono">{controlPlane.federate_id}</span>
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {federationOnboarding?.steps?.length ? (
              <ol className="community-page__federation-steps">
                {federationOnboarding.steps.map((step) => (
                  <li key={step.order} className="community-page__federation-step">
                    <span className="community-page__federation-step-title">{step.title}</span>
                    <span className="community-page__federation-step-detail">{step.detail}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {section === "corpus" ? (
        <>
          <section className="community-page__section community-page__section--corpus">
            <div className="panel community-page__panel">
              <div className="panel__hd panel__hd--split community-page__panel-hd">
                <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
                  <PanelTitleIcon icon={Library} />
                  共享语料
                </h2>
                <div className="row-actions community-page__hd-actions">
                  <Link to="/corpus-config" className="btn">
                    语料设置
                  </Link>
                </div>
              </div>
              <div className="panel__bd">
                <div className="community-page__kpi-bar home-kpi-bar community-page__corpus-grid">
                  <MetricTile
                    icon={List}
                    label="词条规模"
                    value={statsPending ? <PendingValue pending /> : corpusPoolValue}
                    hint={corpusPoolHint}
                  />
                  <MetricTile
                    icon={Globe2}
                    label="在线接入"
                    value={
                      statsPending ? (
                        <PendingValue pending />
                      ) : (
                        formatCommunityStatNum(communityStats?.corpus?.enrollments_online)
                      )
                    }
                    hint={corpusOnlineEnrollHint}
                  />
                  <MetricTile
                    icon={Users}
                    label="累计接入"
                    value={
                      statsPending ? (
                        <PendingValue pending />
                      ) : (
                        formatCommunityStatNum(communityStats?.corpus?.enrollments_total)
                      )
                    }
                    hint={corpusTotalEnrollHint}
                  />
                  <MetricTile
                    icon={Activity}
                    label="允许上传"
                    value={
                      statsPending ? (
                        <PendingValue pending />
                      ) : (
                        formatCommunityStatNum(communityStats?.corpus?.contribute_enabled_total)
                      )
                    }
                    hint="已接入且允许把本机新回复同步到共享池的安装数"
                  />
                  <MetricTile
                    icon={Sparkles}
                    label="回复被引用"
                    value={
                      statsPending ? (
                        <PendingValue pending />
                      ) : (
                        formatCommunityStatNum(communityStats?.corpus?.answer_hits_sum)
                      )
                    }
                    hint="共享池中各回复条目被接话引用的累计次数"
                  />
                  <MetricTile
                    icon={Database}
                    label="允许读取"
                    value={
                      statsPending ? (
                        <PendingValue pending />
                      ) : (
                        formatCommunityStatNum(communityStats?.corpus?.read_enabled_total)
                      )
                    }
                    hint="已接入且允许从共享池读取语料的安装数"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="community-page__section community-page__section--local">
            <div className="panel community-page__panel">
              <div className="panel__hd panel__hd--split community-page__panel-hd">
                <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
                  <PanelTitleIcon icon={HardDrive} />
                  本机语料
                </h2>
                <div className="row-actions community-page__hd-actions">
                  <Link to="/plugins/pb_core" className="btn">
                    语料设置
                  </Link>
                </div>
              </div>
              {corpusStatusPending && !corpusStatus ? (
                <div className="panel__bd muted community-page__empty">
                  <PendingValue pending narrow={false} />
                </div>
              ) : corpusStatus ? (
                <div className="panel__bd community-page__local-bd">
                  <div className="community-page__corpus-board">
                    <div className="community-page__corpus-summary">
                      <div className="community-page__corpus-summary-main">
                        <span className={`badge community-page__status-badge ${corpusMultiSourceBadge.ok ? "badge--ok" : ""}`}>
                          {corpusMultiSourceBadge.label}
                        </span>
                        {corpusSummaryFlow ? <span className="community-page__corpus-summary-flow">查找顺序：{corpusSummaryFlow}</span> : null}
                      </div>
                      <div className="community-page__corpus-summary-meta">
                        <span>{mergeStrategyLabel(corpusStatus.merge_strategy)}</span>
                        <span className="community-page__corpus-summary-sep">·</span>
                        <span>远端失败时 {remoteFailureLabel(corpusStatus.on_remote_failure)}</span>
                        <span className="community-page__corpus-summary-sep">·</span>
                        <span>快照 {formatUnixSec(corpusStatus.as_of)}</span>
                      </div>
                    </div>

                    <div className="table-wrap community-page__matrix-wrap">
                      <table className="tbl community-page__source-matrix">
                        <thead>
                          <tr>
                            <th scope="col">能力</th>
                            {visibleSourceKeys.map((key) => (
                              <th key={key} scope="col" className="community-page__matrix-src-th">
                                <span className={`community-page__matrix-src ${corpusStatus.sources?.[key]?.enabled ? "is-on" : "is-off"}`}>
                                  {sourceLabel(key)}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sourceMatrixRows.map((row) => (
                            <tr key={row.key}>
                              <th scope="row">{row.label}</th>
                              {visibleSourceKeys.map((key) => {
                                const state = matrixCellState(key, corpusStatus.sources?.[key], row.key);
                                return (
                                  <td key={`${row.key}-${key}`}>
                                    <span className={`community-page__matrix-cell community-page__matrix-cell--${state}`}>
                                      {matrixCellText(state)}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {sourceApiEntries.length ? (
                      <ul className="community-page__api-list">
                        {sourceApiEntries.map((entry) => (
                          <li key={entry.key} className="community-page__api-list-item">
                            <span className="community-page__api-list-k">{sourceLabel(entry.key)}</span>
                            <code className="community-page__api-list-v">{entry.url}</code>
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <div className="community-page__corpus-meta-bar">
                      <span className="community-page__corpus-meta-item">
                        <span className="community-page__corpus-meta-k">多机协同</span>
                        <span className={`community-page__corpus-meta-v ${controlPlane?.enabled ? "is-ok" : "is-off"}`}>
                          {controlPlane?.enabled ? "已开启" : "已关闭"}
                        </span>
                      </span>
                      <span className="community-page__corpus-meta-item">
                        <span className="community-page__corpus-meta-k">在线统计</span>
                        <span className={`community-page__corpus-meta-v ${corpusStatus.deployment?.community_stats_enabled ? "is-ok" : "is-off"}`}>
                          {corpusStatus.deployment?.community_stats_enabled ? "已开启" : "已关闭"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="panel__bd muted community-page__empty">无法读取本机语料状态。</div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {section === "hot" ? (
        <>
          <section className="community-page__section community-page__section--hot">
            <div className="panel community-page__panel">
              <div className="panel__hd panel__hd--split community-page__panel-hd">
                <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
                  <PanelTitleIcon icon={Flame} />
                  共享热词
                </h2>
              </div>
              <div className="panel__bd">
                <p className="muted community-page__hot-lead">机群：近24h叠加 · 高频池：共享累计 · 本月：近期活跃</p>
                <CorpusWordCloud
                  source="community"
                  tab={hotTab}
                  onTabChange={setHotTab}
                  showTabs={false}
                  reloadToken={hotReloadToken}
                />
              </div>
            </div>
          </section>

          <section className="community-page__section community-page__section--local-hot">
            <div className="panel community-page__panel">
              <div className="panel__hd panel__hd--split community-page__panel-hd">
                <h2 className="panel__title community-page__section-title flex items-center gap-1.5">
                  <PanelTitleIcon icon={Flame} />
                  本机热词
                </h2>
              </div>
              <div className="panel__bd">
                <p className="muted community-page__hot-lead">本机全部群的学习语料累计热度，与共享池独立统计。</p>
                <CorpusWordCloud source="local" reloadToken={hotReloadToken} />
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="metric-tile">
      <div className="metric-tile__head">
        {Icon ? <Icon className="metric-tile__ico" size={14} strokeWidth={2} aria-hidden /> : null}
        <span className="metric-tile__label">{label}</span>
      </div>
      <div className="metric-tile__value-slot">
        <span className="metric-tile__value metric-tile__value--inline">{value}</span>
        <span className="community-page__kpi-hint muted" title={hint}>
          {hint}
        </span>
      </div>
    </div>
  );
}
