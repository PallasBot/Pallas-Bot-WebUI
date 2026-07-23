import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCommunityStats,
  fetchCorpusStatus,
  fetchFederationOnboarding,
  probeCommunityConnectivity,
} from "@/api/fullConsole";
import type {
  CommunityConnectivityCheckData,
  CommunityVersionCountData,
  CorpusSourceStatusData,
} from "@/api/pallasTypes";
import { PALLAS_COMMUNITY_HUB } from "@/utils/pallasExternalLinks";
import { copyTextToClipboard } from "@/utils/clipboard";
import CorpusWordCloud from "@/components/CorpusWordCloud";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import UiBadge from "@/components/ui/UiBadge";
import UiButton from "@/components/ui/UiButton";
import { pushConsoleToast } from "@/utils/consoleToast";

const allSourceKeys = ["local", "fed", "community"] as const;
type SourceKey = (typeof allSourceKeys)[number];

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
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [hotReloadToken, setHotReloadToken] = useState(0);
  const [err, setErr] = useState("");
  const [connectivityBusy, setConnectivityBusy] = useState(false);
  const [connectivityResult, setConnectivityResult] = useState<CommunityConnectivityCheckData | null>(null);

  const statsQ = useQuery({ queryKey: ["community-stats"], queryFn: () => fetchCommunityStats({}) });
  const corpusStatusQ = useQuery({ queryKey: ["corpus-status"], queryFn: fetchCorpusStatus });
  const federationQ = useQuery({
    queryKey: ["federation-onboarding"],
    queryFn: fetchFederationOnboarding,
    retry: false,
  });

  const communityStats = statsQ.data ?? null;
  const corpusStatus = corpusStatusQ.data ?? null;
  const federationOnboarding = federationQ.data ?? null;
  const federationOnboardingUnavailable = federationQ.isFetched && federationOnboarding == null;
  const pageReady = statsQ.isFetched || corpusStatusQ.isFetched;

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

  async function copyFederationSecret() {
    if (!federationSecret) {
      pushConsoleToast("中心未提供入池密钥", "err");
      return;
    }
    if (!(await copyTextToClipboard(federationSecret))) {
      pushConsoleToast("复制失败", "err");
      return;
    }
    pushConsoleToast("已复制入池密钥", "ok");
  }

  async function copyCoordAddress() {
    const text = federationCoordDisplay || federationCoordEndpoint;
    if (!text) {
      pushConsoleToast("暂无去重服务器地址", "err");
      return;
    }
    if (!(await copyTextToClipboard(text))) {
      pushConsoleToast("复制失败", "err");
      return;
    }
    pushConsoleToast("已复制去重服务器地址（不含密码）", "ok");
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

  if (!pageReady) {
    return (
      <div className="community-page console-hub-page">
        <p className="muted">加载社区统计…</p>
      </div>
    );
  }

  return (
    <div className="community-page console-hub-page">
      <PageHeader
        title="统计与语料"
        description={
          <>
            <span>社区中心公开统计与本部署语料、多机协同状态；数据只读。</span>
            <p className="community-page__masthead-links muted">
              <a className="community-page__inline-link" href={communityHubUrl} target="_blank" rel="noopener noreferrer">
                社区主站
              </a>
              {" · "}
              <Link to="/plugins/pb_stats">在线统计</Link>
              {" · "}
              <Link to="/plugins/pb_core">共享接话库</Link>
              {" · "}
              <Link to="/corpus-config">语料设置</Link>
            </p>
          </>
        }
        actions={<RefreshIconButton embedded className="hub-refresh-wide-only" busy={refreshBusy} label="刷新" onClick={() => void refresh()} />}
      />

      {err ? <p className="alert alert--err community-page__alert">{err}</p> : null}

      {!communityStats ? (
        <p className="alert alert--warn community-page__alert">
          暂时无法从社区中心获取数据，下列数字以 — 占位。请确认本机已开启「上报在线统计」，且网络能访问社区中心。
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
        </p>
      ) : null}

      <section id="community-deploy" className="community-page__section">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd community-page__deploy-panel-hd">
            <h2 className="panel__title community-page__section-title">
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
              <MetricTile icon="globe" label="活跃安装" value={formatCommunityStatNum(communityStats?.deployments_online)} hint={deploymentsOnlineHint} />
              <MetricTile icon="account" label="在线牛牛" value={formatCommunityStatNum(communityStats?.bots_online_sum)} hint={botsOnlineHint} />
              <MetricTile
                icon="layers"
                label="分片安装"
                value={`${formatCommunityStatNum(communityStats?.deployments_online_sharded)} / ${formatCommunityStatNum(communityStats?.shard_workers_online_sum)}`}
                hint="采用分片架构的安装数 / 在线工作进程数"
              />
              <MetricTile icon="activity" label="近 24 小时" value={formatCommunityStatNum(communityStats?.active_recent_24h)} hint={activeRecentHint} />
            </div>

            <dl className="home-dl community-page__detail-dl community-page__meta-dl">
              <dt>历史安装</dt>
              <dd>{formatCommunityStatNum(communityStats?.deployments_total)} 套</dd>
              <dt>在线名册</dt>
              <dd>{formatCommunityStatNum(communityStats?.catalog_bots_online_sum)} 只牛牛</dd>
              <dt>共享语料</dt>
              <dd>
                {communityStats != null ? (
                  <span className={`badge ${communityStats.corpus_enabled ? "badge--ok" : ""}`}>
                    {communityStats.corpus_enabled ? "已接入" : "未接入"}
                  </span>
                ) : (
                  "—"
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
                  {onlineVersions.map((row) => (
                    <li key={row.version} className="community-page__version-row">
                      <span className="community-page__version-name community-page__mono">{row.version || "—"}</span>
                      <span className="community-page__version-count">{formatCommunityStatNum(row.count)} 套</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="community-federation" className="community-page__section">
        <div className="panel community-page__panel community-page__federation-panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title">{federationOnboarding?.title || "多机协同"}</h2>
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
                社区中心暂未提供入池说明；你仍可在「多机协同」配置中手动填写密钥与相关项。
              </p>
            ) : null}
            {federationOnboarding?.ingress_note ? (
              <p className="community-page__federation-ingress-note muted">{federationOnboarding.ingress_note}</p>
            ) : null}
            <p className="muted community-page__federation-pool-note">
              左两列为已登记协同配置且近期上报在线统计的安装；右列为去重服务上仍有活跃标记的安装。
            </p>
            <div className="community-page__kpi-bar home-kpi-bar community-page__federation-pool-grid">
              <MetricTile icon="users" label="累计入池" value={formatCommunityStatNum(federationPoolStats?.members_total)} hint="曾成功从社区中心领取协同配置的安装套数" />
              <MetricTile icon="network" label="在线入池" value={formatCommunityStatNum(federationPoolStats?.members_online)} hint="已入池且近期有在线统计上报的安装套数" />
              <MetricTile icon="activity" label="去重活跃" value={federationCoordActiveLabel} hint="去重服务上仍有活跃标记的安装数，表示近期有牛牛在处理群消息" />
            </div>

            {federationSecret ? (
              <div className="community-page__federation-secret">
                <div className="community-page__federation-secret-hd">
                  <span className="community-page__federation-secret-label">
                    {federationOnboarding?.instance_secret_label || "入池密钥"}
                  </span>
                  <UiButton variant="ghost" size="sm" onClick={() => void copyFederationSecret()}>
                    复制密钥
                  </UiButton>
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
                      <UiButton variant="ghost" size="sm" onClick={() => void copyCoordAddress()}>
                        复制地址
                      </UiButton>
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
                      {controlPlane.instance_secret_configured ? "已填写" : "未填写"}
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

      <section id="community-corpus" className="community-page__section">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title">共享语料</h2>
            <div className="row-actions community-page__hd-actions">
              <Link to="/corpus-config" className="btn">
                语料设置
              </Link>
            </div>
          </div>
          <div className="panel__bd">
            <div className="community-page__kpi-bar home-kpi-bar community-page__corpus-grid">
              <MetricTile icon="list" label="词条规模" value={corpusPoolValue} hint={corpusPoolHint} />
              <MetricTile icon="globe" label="在线接入" value={formatCommunityStatNum(communityStats?.corpus?.enrollments_online)} hint={corpusOnlineEnrollHint} />
              <MetricTile icon="users" label="累计接入" value={formatCommunityStatNum(communityStats?.corpus?.enrollments_total)} hint={corpusTotalEnrollHint} />
              <MetricTile icon="activity" label="允许上传" value={formatCommunityStatNum(communityStats?.corpus?.contribute_enabled_total)} hint="已接入且允许把本机新回复同步到共享池的安装数" />
              <MetricTile icon="sparkles" label="回复被引用" value={formatCommunityStatNum(communityStats?.corpus?.answer_hits_sum)} hint="共享池中各回复条目被接话引用的累计次数" />
              <MetricTile icon="database" label="允许读取" value={formatCommunityStatNum(communityStats?.corpus?.read_enabled_total)} hint="已接入且允许从共享池读取语料的安装数" />
            </div>
          </div>
        </div>
      </section>

      <section id="community-hot" className="community-page__section">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title">共享语料热词</h2>
          </div>
          <div className="panel__bd">
            <p className="muted community-page__hot-lead">默认展示近24h各部署热词叠加（机群榜）；「高频池」为共享语料累计。</p>
            <CorpusWordCloud source="community" reloadToken={hotReloadToken} />
          </div>
        </div>
      </section>

      <section id="community-local-hot" className="community-page__section">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title">本机语料热词</h2>
          </div>
          <div className="panel__bd">
            <p className="muted community-page__hot-lead">本部署全部群的学习语料累计热度，与共享池独立统计。</p>
            <CorpusWordCloud source="local" reloadToken={hotReloadToken} />
          </div>
        </div>
      </section>

      <section id="community-local" className="community-page__section">
        <div className="panel community-page__panel">
          <div className="panel__hd panel__hd--split community-page__panel-hd">
            <h2 className="panel__title community-page__section-title">本部署语料</h2>
            <div className="row-actions community-page__hd-actions">
              <Link to="/plugins/pb_core" className="btn">
                语料设置
              </Link>
            </div>
          </div>
          {corpusStatus ? (
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
            <div className="panel__bd muted community-page__empty">无法读取本部署语料状态。</div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  hint,
}: {
  icon?: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="metric-tile">
      <div className="metric-tile__head">
        {icon ? <span className={`metric-tile__ico metric-tile__ico--${icon}`} aria-hidden="true" /> : null}
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
