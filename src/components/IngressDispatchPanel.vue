<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import StatCard from "@/components/StatCard.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { computed, onMounted, ref } from "vue";
import { fetchIngressDispatch, fetchShardObservability } from "@/api/consoleApi";
import type { IngressDispatchData, ShardObservabilityData } from "@/api/pallasTypes";

const ingressDispatch = ref<IngressDispatchData | null>(null);
const shardObs = ref<ShardObservabilityData | null>(null);
const loading = ref(true);

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

const shardObsVisible = computed(() => shardObs.value?.sharded === true);

const panelVisible = computed(() => ingressDispatch.value != null || shardObsVisible.value);

const ingressDispatchP95 = computed(() => fmtMs(ingressDispatch.value?.ingress_duration_ms_p95 ?? null));

const ingressDispatchMatcherRatio = computed(() =>
  fmtRatio(ingressDispatch.value?.matchers_selected_ratio ?? null),
);

const ingressDispatchGroupMessages = computed(() => {
  const n = ingressDispatch.value?.group_messages;
  return n == null ? "—" : String(n);
});

const ingressDispatchMatcherHint = computed(() => {
  const d = ingressDispatch.value;
  if (!d) return "matcher considered · selected · run";
  return `筛选 ${d.matchers_considered ?? 0} · 命中 ${d.matchers_selected ?? 0} · 执行 ${d.matchers_run ?? 0}`;
});

const ingressDispatchLaneWait = computed(() => fmtMs(ingressDispatch.value?.lane_wait_ms_avg ?? null));

const ingressDispatchP95Hint = computed(() => {
  const d = ingressDispatch.value;
  if (!d) return "95% 群消息入站耗时低于此值";
  const cmd = d.command_traffic ?? 0;
  const chat = d.chatter_traffic ?? 0;
  if (cmd > 0 || chat > 0) return `指令 ${cmd} · 闲聊 ${chat}`;
  return "95% 群消息入站耗时低于此值";
});

const ingressDispatchLaneHint = computed(() => {
  const d = ingressDispatch.value;
  if (!d) return "并发槽占用与过载信号";
  const parts = [`槽满 ${d.lane_busy ?? 0}`];
  if ((d.overload_signals ?? 0) > 0) parts.push(`过载 ${d.overload_signals}`);
  if ((d.prefetch_paused ?? 0) > 0) parts.push(`预取暂停 ${d.prefetch_paused}`);
  return parts.join(" · ");
});

const ingressDispatchPgUtil = computed(() => {
  const util = ingressDispatch.value?.pool_budget?.utilization;
  if (util == null || Number.isNaN(util)) return "—";
  return `${(util * 100).toFixed(1)}%`;
});

const ingressDispatchPgHint = computed(() => {
  const pool = ingressDispatch.value?.pool_budget;
  if (!pool) return "SQLAlchemy 连接池占用";
  const cap = pool.capacity;
  return cap != null ? `池容量 ${cap}` : "SQLAlchemy 连接池占用";
});

const ingressDispatchAlerts = computed(() => {
  const alerts = ingressDispatch.value?.alerts;
  if (!alerts?.length) return "";
  return alerts.map((a) => INGRESS_DISPATCH_ALERT_LABELS[a] ?? a).join("、");
});

const ingressDispatchPgWarn = computed(() =>
  (ingressDispatch.value?.pool_budget?.utilization ?? 0) >= 0.85,
);

const shardIngressHitRate = computed(() =>
  ratioPct(shardObs.value?.ingress_cluster?.claim_hit_rate ?? null),
);

const shardIngressGateHint = computed(() => {
  const ing = shardObs.value?.ingress_cluster;
  if (!ing) return "代表牛 claim 成功 ÷（成功+失败）";
  const won = ing.claim_won ?? 0;
  const lost = ing.claim_lost ?? 0;
  return `成功 ${won} · 失败 ${lost}`;
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

const lede = computed(() =>
  shardObsVisible.value
    ? "Hub 汇总 worker 今日 ingress_dispatch；配置见通用配置 → ingress_dispatch。"
    : "单进程今日 ingress_dispatch；配置见通用配置 → ingress_dispatch。",
);

async function load() {
  loading.value = true;
  try {
    const [ing, obs] = await Promise.allSettled([
      fetchIngressDispatch().catch(() => null),
      fetchShardObservability(),
    ]);
    ingressDispatch.value = ing.status === "fulfilled" ? ing.value : null;
    shardObs.value = obs.status === "fulfilled" ? obs.value : null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});

defineExpose({ refresh: load });
</script>

<template>
  <UiCard
    v-if="panelVisible || loading"
    tag="section"
    glass
    class="ingress-dispatch-panel"
    :class="{ 'ingress-dispatch-panel--standalone': !shardObsVisible }"
    :aria-busy="loading || undefined"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">
        <ConsoleNavIcon class="panel__title-ico" name="timer" />
        流量编排
      </h2>
      <span class="home-card__tag muted">{{ shardObsVisible ? "分片" : "单进程" }}</span>
    </div>
    <div class="panel__bd">
      <p v-if="loading" class="muted ingress-dispatch-panel__loading">正在加载…</p>
      <template v-else-if="panelVisible">
        <p class="muted ingress-dispatch-panel__lede">{{ lede }}</p>
        <div v-if="ingressDispatchAlerts" class="home-net-alert">告警：{{ ingressDispatchAlerts }}</div>
        <div class="home-net-section">
          <p class="home-net-section__label">延迟</p>
          <div class="home-net-kpis home-net-kpis--latency">
            <StatCard
              dense
              label="P95"
              :value="ingressDispatchP95"
              :hint="ingressDispatchP95Hint"
              :class="{ 'stat-card--metric-warn': Boolean(ingressDispatchAlerts) }"
            />
            <StatCard dense label="槽等待" :value="ingressDispatchLaneWait" :hint="ingressDispatchLaneHint" />
            <StatCard
              v-if="shardObsVisible"
              dense
              label="Ingress 命中"
              :value="shardIngressHitRate"
              :hint="shardIngressGateHint"
            />
          </div>
        </div>
        <div class="home-net-section">
          <p class="home-net-section__label">吞吐</p>
          <div class="home-net-kpis home-net-kpis--throughput">
            <StatCard dense label="群消息" :value="ingressDispatchGroupMessages" :hint="ingressDispatchMatcherHint" />
            <StatCard dense label="命中率" :value="ingressDispatchMatcherRatio" hint="命中 ÷ 筛选" />
            <StatCard v-if="shardObsVisible" dense label="Coord 积压" :value="shardCoordValue" :hint="shardCoordHint" />
            <StatCard
              dense
              label="PG 连接池"
              :class="{ 'stat-card--metric-warn': ingressDispatchPgWarn || shardPgHintWarn }"
              :value="shardObsVisible ? shardPgPeakValue : ingressDispatchPgUtil"
              :hint="shardObsVisible ? shardPgHint : ingressDispatchPgHint"
              :hint-title="shardPgHintTitle"
            />
          </div>
        </div>
      </template>
    </div>
  </UiCard>
</template>

<style scoped>
.ingress-dispatch-panel__lede {
  margin: 0 0 12px;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.ingress-dispatch-panel__loading {
  margin: 0;
}
</style>
