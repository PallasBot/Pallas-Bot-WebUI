import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchIngressDispatch, fetchShardObservability } from "@/api/fullConsole";
import type { IngressDispatchData, ShardObservabilityData } from "@/api/pallasTypes";
import Metric from "@/components/Metric";
import Panel from "@/components/Panel";
import { cn } from "@/lib/utils";

const INGRESS_DISPATCH_ALERT_LABELS: Record<string, string> = {
  ingress_p95_over_100ms: "入站处理 P95 超过 100ms",
  pg_pool_over_85pct: "数据库连接池利用率 ≥ 85%",
};

function fmtMs(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} ms`;
}

function fmtRatio(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function ratioPct(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export default function IngressDispatchPanel() {
  const [ingressDispatch, setIngressDispatch] = useState<IngressDispatchData | null>(null);
  const [shardObs, setShardObs] = useState<ShardObservabilityData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ing, obs] = await Promise.allSettled([
        fetchIngressDispatch().catch(() => null),
        fetchShardObservability(),
      ]);
      setIngressDispatch(ing.status === "fulfilled" ? ing.value : null);
      setShardObs(obs.status === "fulfilled" ? obs.value : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shardObsVisible = shardObs?.sharded === true;
  const panelVisible = ingressDispatch != null || shardObsVisible;

  const ingressDispatchAlerts = useMemo(() => {
    const alerts = ingressDispatch?.alerts;
    if (!alerts?.length) return "";
    return alerts.map((a) => INGRESS_DISPATCH_ALERT_LABELS[a] ?? a).join("、");
  }, [ingressDispatch]);

  const ingressDispatchPgWarn = (ingressDispatch?.pool_budget?.utilization ?? 0) >= 0.85;
  const shardPgHintWarn = Boolean((shardObs?.pg_pool?.warning || "").trim());

  const lede = shardObsVisible
    ? "分片部署下由主节点汇总各节点今日消息分发统计；配置见通用配置 → 消息处理与发送。"
    : "单进程今日消息分发统计；配置见通用配置 → 消息处理与发送。";

  if (!panelVisible && !loading) return null;

  const ingressDispatchP95Hint = (() => {
    const d = ingressDispatch;
    if (!d) return "95% 群消息入站耗时低于此值";
    const cmd = d.command_traffic ?? 0;
    const chat = d.chatter_traffic ?? 0;
    if (cmd > 0 || chat > 0) return `指令 ${cmd} · 闲聊 ${chat}`;
    return "95% 群消息入站耗时低于此值";
  })();

  const ingressDispatchMatcherHint = (() => {
    const d = ingressDispatch;
    if (!d) return "matcher considered · selected · run";
    return `筛选 ${d.matchers_considered ?? 0} · 命中 ${d.matchers_selected ?? 0} · 执行 ${d.matchers_run ?? 0}`;
  })();

  const ingressDispatchLaneHint = (() => {
    const d = ingressDispatch;
    if (!d) return "并发槽占用与过载信号";
    const parts = [`槽满 ${d.lane_busy ?? 0}`];
    if ((d.overload_signals ?? 0) > 0) parts.push(`过载 ${d.overload_signals}`);
    if ((d.prefetch_paused ?? 0) > 0) parts.push(`预取暂停 ${d.prefetch_paused}`);
    return parts.join(" · ");
  })();

  const shardIngressGateHint = (() => {
    const ing = shardObs?.ingress_cluster;
    if (!ing) return "代表牛 claim 成功 ÷（成功+失败）";
    return `成功 ${ing.claim_won ?? 0} · 失败 ${ing.claim_lost ?? 0}`;
  })();

  const shardCoordValue = (() => {
    const c = shardObs?.coord_pending_live;
    if (!c) return "—";
    const actionable = c.actionable_total ?? c.bot_action_open;
    if (actionable != null) return String(actionable);
    return String(c.total_json ?? 0);
  })();

  const shardCoordHint = (() => {
    const c = shardObs?.coord_pending_live;
    if (!c) return "扫描 data/pallas_shard/coord";
    const parts = [`bot_action 待办 ${c.bot_action_open ?? 0}`];
    const stale = c.bot_action_stale_open ?? 0;
    if (stale > 0) parts.push(`超时 ${stale}`);
    const hist = c.historical_retained;
    if (hist != null && hist > 0) parts.push(`历史残留 ${hist}`);
    return parts.join(" · ");
  })();

  const shardPgPeakValue = (() => {
    const p = shardObs?.pg_pool;
    if (p?.estimated_pg_connections_peak == null) return "—";
    return `~${p.estimated_pg_connections_peak}`;
  })();

  const shardPgHint = (() => {
    const p = shardObs?.pg_pool;
    if (!p) return "宜低于 PostgreSQL max_connections";
    const warning = (p.warning || "").trim();
    if (warning) return warning;
    return `${p.estimated_processes ?? "?"} 进程 · 单进程上限 ${p.per_process_max ?? "?"}`;
  })();

  const ingressDispatchPgHint = (() => {
    const pool = ingressDispatch?.pool_budget;
    if (!pool) return "SQLAlchemy 连接池占用";
    const cap = pool.capacity;
    return cap != null ? `池容量 ${cap}` : "SQLAlchemy 连接池占用";
  })();

  return (
    <Panel
      className="charts-page__panel charts-page__ingress-panel"
      title={
        <>
          流量编排
          <span className="muted" style={{ marginLeft: 8, fontSize: "0.75rem", fontWeight: 500 }}>
            {shardObsVisible ? "分片" : "单进程"}
          </span>
        </>
      }
      hdNowrap
    >
      <div className="space-y-4" aria-busy={loading || undefined}>
        {loading ? (
          <p className="muted text-sm">正在加载…</p>
        ) : panelVisible ? (
          <>
            <p className="muted text-sm">{lede}</p>
            {ingressDispatchAlerts ? (
              <p className="alert alert--warn">告警：{ingressDispatchAlerts}</p>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium muted">延迟</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label="P95" value={fmtMs(ingressDispatch?.ingress_duration_ms_p95 ?? null)} />
                <Metric label="槽等待" value={fmtMs(ingressDispatch?.lane_wait_ms_avg ?? null)} />
                {shardObsVisible ? (
                  <Metric
                    label="Ingress 命中"
                    value={ratioPct(shardObs?.ingress_cluster?.claim_hit_rate ?? null)}
                  />
                ) : null}
              </div>
              <p className="muted text-xs">{ingressDispatchP95Hint}</p>
              <p className="muted text-xs">{ingressDispatchLaneHint}</p>
              {shardObsVisible ? <p className="muted text-xs">{shardIngressGateHint}</p> : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium muted">吞吐</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="群消息"
                  value={
                    ingressDispatch?.group_messages == null ? "—" : String(ingressDispatch.group_messages)
                  }
                />
                <Metric label="命中率" value={fmtRatio(ingressDispatch?.matchers_selected_ratio ?? null)} />
                {shardObsVisible ? <Metric label="Coord 积压" value={shardCoordValue} /> : null}
                <Metric
                  label="PG 连接池"
                  value={
                    shardObsVisible
                      ? shardPgPeakValue
                      : (() => {
                          const util = ingressDispatch?.pool_budget?.utilization;
                          if (util == null || Number.isNaN(util)) return "—";
                          return `${(util * 100).toFixed(1)}%`;
                        })()
                  }
                />
              </div>
              <p className="muted text-xs">{ingressDispatchMatcherHint}</p>
              {shardObsVisible ? (
                <p className={cn("text-xs", shardPgHintWarn ? "text-amber-300" : "muted")}>{shardPgHint}</p>
              ) : (
                <p className={cn("text-xs", ingressDispatchPgWarn ? "text-amber-300" : "muted")}>
                  {ingressDispatchPgHint}
                </p>
              )}
              {shardObsVisible ? <p className="muted text-xs">{shardCoordHint}</p> : null}
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  );
}
