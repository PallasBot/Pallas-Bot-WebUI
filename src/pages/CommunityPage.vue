<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchCommunityStats,
  fetchCorpusStatus,
  fetchFederationOnboarding,
  peekCommunityStatsCache,
  probeCommunityConnectivity,
} from "@/api/consoleApi";
import type {
  CommunityConnectivityCheckData,
  CommunityStatsData,
  CommunityVersionCountData,
  CorpusSourceStatusData,
  CorpusStatusData,
  FederationOnboardingData,
} from "@/api/pallasTypes";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";
import { copyTextToClipboard } from "@/utils/clipboard";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import CorpusWordCloud from "@/components/CorpusWordCloud.vue";
import PageChrome from "@/components/PageChrome.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import StatCard from "@/components/StatCard.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { PALLAS_COMMUNITY_HUB } from "@/utils/pallasExternalLinks";

const panelNavIcon = usePanelNavIcon();
const warmCommunity = peekCommunityStatsCache();
const pageReady = ref(Boolean(warmCommunity));
const refreshBusy = ref(false);
const hotReloadToken = ref(0);
const err = ref("");
const communityStats = ref<CommunityStatsData | null>(warmCommunity);
const corpusStatus = ref<CorpusStatusData | null>(null);
const federationOnboarding = ref<FederationOnboardingData | null>(null);
const federationOnboardingUnavailable = ref(false);
const connectivityBusy = ref(false);
const connectivityResult = ref<CommunityConnectivityCheckData | null>(null);

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

async function runConnectivityCheck() {
  if (connectivityBusy.value) return;
  connectivityBusy.value = true;
  try {
    connectivityResult.value = await probeCommunityConnectivity();
    const hint = connectivityResult.value.summary?.hint || "检测完成";
    pushConsoleToast(hint, connectivityResult.value.summary?.any_ok ? "ok" : "err");
  } catch (e) {
    connectivityResult.value = null;
    toastApiError(e, "连通检测失败");
  } finally {
    connectivityBusy.value = false;
  }
}

function formatCommunityStatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.floor(n).toLocaleString();
}

const onlineHint = computed(() => {
  const sec = communityStats.value?.online_ttl_sec;
  if (sec == null || !Number.isFinite(sec) || sec < 60) return "近期有上报";
  const m = Math.max(1, Math.round(sec / 60));
  return `近 ${m} 分钟内有上报`;
});

const deploymentsOnlineHint = computed(
  () => `${onlineHint.value}的自托管安装套数`,
);

const botsOnlineHint = computed(() => {
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
    return `各安装上报的在线牛牛合计，平均每套约 ${avgText} 只`;
  }
  return "各安装向社区中心上报的在线牛牛总数";
});

const activeRecentHint = computed(() => {
  const total = communityStats.value?.deployments_total;
  const catalog = communityStats.value?.catalog_bots_online_sum;
  const parts: string[] = [];
  if (total != null) {
    parts.push(`历史累计 ${formatCommunityStatNum(total)} 套`);
  }
  if (catalog != null && Number.isFinite(catalog)) {
    parts.push(`当前在线名册 ${formatCommunityStatNum(catalog)} 只牛牛`);
  }
  return parts.length ? parts.join(" · ") : "近 24 小时内有统计上报的安装数";
});

const corpusPoolValue = computed(() => {
  const ctx = formatCommunityStatNum(communityStats.value?.corpus?.contexts_total);
  const ans = formatCommunityStatNum(communityStats.value?.corpus?.answers_total);
  if (ctx === "—" && ans === "—") return "—";
  return `${ctx} 词条 · ${ans} 回复`;
});

const corpusPoolHint = computed(() => {
  const hits = communityStats.value?.corpus?.answer_hits_sum;
  if (hits != null && Number.isFinite(hits)) {
    return `回复累计被引用 ${formatCommunityStatNum(hits)} 次`;
  }
  return "共享池中的触发词与回复条目";
});

const corpusOnlineEnrollHint = computed(() => {
  const total = communityStats.value?.corpus?.enrollments_total;
  const parts: string[] = [`${onlineHint.value}且已接入共享语料`];
  if (total != null) {
    parts.push(`历史累计 ${formatCommunityStatNum(total)} 套`);
  }
  return parts.join(" · ");
});

const corpusTotalEnrollHint = computed(() => {
  const recent = communityStats.value?.corpus?.enrollments_recent_24h;
  const contrib = communityStats.value?.corpus?.contribute_enabled_total;
  const parts: string[] = ["曾经接入过社区共享语料的安装总数"];
  if (recent != null && recent > 0) {
    parts.push(`近 24 小时新增 ${formatCommunityStatNum(recent)} 套`);
  }
  if (contrib != null) {
    parts.push(`其中 ${formatCommunityStatNum(contrib)} 套允许上传新回复`);
  }
  return parts.join(" · ");
});

const communityStatsUnavailable = computed(() => communityStats.value == null);

const onlineVersions = computed((): CommunityVersionCountData[] => {
  const rows = communityStats.value?.online_versions;
  if (!Array.isArray(rows)) return [];
  return [...rows].sort((a, b) => b.count - a.count);
});

const statsAsOfText = computed(() => {
  const asOf = (communityStats.value?.as_of || "").trim();
  return asOf ? `快照 ${asOf}` : "";
});

const statsUrl = computed(() => (communityStats.value?.stats_url || "").trim());

const allSourceKeys = ["local", "fed", "community"] as const;

type SourceKey = (typeof allSourceKeys)[number];

function fedSourceVisible(fed: CorpusSourceStatusData | undefined): boolean {
  if (!fed) return false;
  return !!(fed.configured || fed.enabled);
}

const visibleSourceKeys = computed((): SourceKey[] => {
  const keys: SourceKey[] = ["local"];
  if (fedSourceVisible(corpusStatus.value?.sources?.fed)) keys.push("fed");
  keys.push("community");
  return keys;
});

const mergeOrderSteps = computed((): Array<"local" | "fed" | "community"> => {
  const order = corpusStatus.value?.merge_order;
  if (!Array.isArray(order) || !order.length) return [];
  const allowed = new Set(["local", "fed", "community"]);
  const visible = new Set(visibleSourceKeys.value);
  return order.filter(
    (s): s is "local" | "fed" | "community" => allowed.has(s) && visible.has(s as SourceKey),
  );
});

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

const corpusSummaryFlow = computed(() => {
  if (!mergeOrderSteps.value.length) return "";
  return mergeOrderSteps.value.map((k) => sourceLabel(k)).join(" → ");
});

const corpusMultiSourceBadge = computed((): { label: string; ok: boolean } => {
  const status = corpusStatus.value;
  if (!status) return { label: "多源接话未启用", ok: false };
  const community = status.sources?.community;
  if (status.composite_active) {
    if (community?.wanted && !community?.readable) {
      return { label: "多源接话已启用（待接入）", ok: true };
    }
    return { label: "多源接话已启用", ok: true };
  }
  if (community?.wanted) {
    return { label: "多源接话已开启（待就绪）", ok: false };
  }
  const mode = String(status.remote_find_mode || "").trim();
  if (mode === "prefetch" || mode === "sync") {
    return { label: "本机未命中时查社区已开", ok: true };
  }
  return { label: "多源接话未启用", ok: false };
});

const corpusSnapshotText = computed(() => formatUnixSec(corpusStatus.value?.as_of));

const communityUsage = computed(() => corpusStatus.value?.sources?.community?.usage ?? null);

const communityUsageUpdatedText = computed(() => formatUnixSec(communityUsage.value?.updated_at ?? undefined));

const deploymentIdShort = computed(() => {
  const id = (corpusStatus.value?.deployment?.deployment_id || "").trim();
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
});

const controlPlane = computed(() => corpusStatus.value?.control_plane);

const federationPoolStats = computed(
  () => federationOnboarding.value?.pool_stats ?? communityStats.value?.federation ?? null,
);

const federationSecret = computed(() => (federationOnboarding.value?.instance_secret || "").trim());

const federationCoordDisplay = computed(() => {
  const c = federationOnboarding.value?.coord;
  if (!c) return "";
  const display = (c.redis_url_display || "").trim();
  if (display) return display;
  const host = (c.host || "").trim();
  if (!host) return "";
  const port = c.port != null ? `:${c.port}` : "";
  const db = c.db != null ? `/${c.db}` : "";
  return `redis://${host}${port}${db}`;
});

const federationCoordActiveLabel = computed(() => {
  const n = federationPoolStats.value?.coord_active_deployments;
  if (n == null) return "—";
  return formatCommunityStatNum(n);
});

const federationCoordEndpoint = computed(() => {
  const c = federationOnboarding.value?.coord;
  if (!c) return "";
  const host = (c.host || "").trim();
  if (!host) return "";
  const port = c.port != null ? String(c.port) : "";
  const db = c.db != null ? `/${c.db}` : "";
  return port ? `${host}:${port}${db}` : `${host}${db}`;
});

const communityHubUrl = computed(
  () => (federationOnboarding.value?.stats_primary_url || PALLAS_COMMUNITY_HUB).trim() || PALLAS_COMMUNITY_HUB,
);

const controlPlaneConfigLink = computed(() => ({
  name: "plugins" as const,
  params: { name: "pb_core" },
}));

function ingressEnabledLabel(raw: string | undefined): string {
  const s = (raw || "auto").trim() || "auto";
  if (s === "true") return "开启";
  if (s === "false") return "关闭";
  return "自动";
}

async function copyFederationSecret() {
  const text = federationSecret.value;
  if (!text) {
    pushConsoleToast("中心未提供入池密钥", "err");
    return;
  }
  if (!(await copyTextToClipboard(text))) {
    pushConsoleToast("复制失败", "err");
    return;
  }
  pushConsoleToast("已复制入池密钥", "ok");
}

async function copyCoordAddress() {
  const text = federationCoordDisplay.value || federationCoordEndpoint.value;
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

function sourceApiBase(key: SourceKey): string {
  return (corpusStatus.value?.sources?.[key]?.api_base || "").trim();
}

const sourceApiEntries = computed(() =>
  visibleSourceKeys.value
    .map((key) => ({ key, url: sourceApiBase(key) }))
    .filter((row) => row.url),
);

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
  const map: Record<string, string> = {
    local_only: "仅用本机语料",
  };
  return map[s] || s;
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

async function load(options?: { bypassCache?: boolean }) {
  err.value = "";
  const commPromise = fetchCommunityStats({ bypassCache: options?.bypassCache }).catch(() => null);
  void Promise.all([fetchCorpusStatus().catch(() => null), fetchFederationOnboarding().catch(() => null)]).then(
    ([corpus, fed]) => {
      corpusStatus.value = corpus;
      federationOnboarding.value = fed;
      federationOnboardingUnavailable.value = fed == null;
    },
  );
  try {
    communityStats.value = await commPromise;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    pageReady.value = true;
  }
}

async function refresh() {
  refreshBusy.value = true;
  try {
    await load({ bypassCache: true });
    hotReloadToken.value += 1;
  } finally {
    refreshBusy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="community-page console-hub-page">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="3"
    />
    <template v-else>
      <PageChrome
        :icon="panelNavIcon"
        chrome-class="community-page__masthead"
        title="统计与语料"
        lead="社区中心公开统计与本部署语料、多机协同状态；数据只读。"
      >
        <template #extra>
          <p class="community-page__masthead-links muted">
            <a
              class="community-page__inline-link"
              :href="communityHubUrl"
              target="_blank"
              rel="noopener noreferrer"
            >社区主站</a>
            ·
            <RouterLink :to="{ name: 'plugins', params: { name: 'pb_stats' } }">在线统计</RouterLink>
            ·
            <RouterLink :to="{ name: 'plugins', params: { name: 'pb_core' } }">共享接话库</RouterLink>
            ·
            <RouterLink to="/corpus-config">语料设置</RouterLink>
          </p>
        </template>
        <template #actions>
          <RefreshIconButton
            embedded
            class="hub-refresh-wide-only"
            :busy="refreshBusy"
            label="刷新"
            @click="refresh"
          />
        </template>
      </PageChrome>

      <p
        v-if="err"
        class="alert alert--err community-page__alert"
      >
        {{ err }}
      </p>

      <p
        v-if="communityStatsUnavailable"
        class="alert alert--warn community-page__alert"
      >
        暂时无法从社区中心获取数据，下列数字以 — 占位。请确认本机已开启「上报在线统计」，且网络能访问社区中心。
        <UiButton
          variant="ghost"
          size="sm"
          class="community-page__alert-probe-btn"
          :busy="connectivityBusy"
          @click="runConnectivityCheck"
        >检测连通</UiButton>
        <RouterLink
          class="community-page__inline-link"
          to="/community-stats-config"
        >前往在线统计设置</RouterLink>
      </p>

      <section
        id="community-deploy"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd community-page__deploy-panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                :name="panelNavIcon"
              />全网部署
              <RefreshIconButton
                embedded
                class="hub-refresh-narrow-only"
                :show-label="false"
                :busy="refreshBusy"
                label="刷新"
                @click="refresh"
              />
            </h2>
            <div class="row-actions community-page__hd-actions community-page__deploy-hd-actions">
              <UiButton
                variant="ghost"
                size="sm"
                class="community-page__deploy-probe-btn"
                :busy="connectivityBusy"
                @click="runConnectivityCheck"
              >检测连通</UiButton>
              <RouterLink
                custom
                v-slot="{ navigate }"
                to="/community-stats-config"
              >
                <UiButton
                  variant="ghost"
                  size="sm"
                  class="community-page__deploy-settings-btn"
                  @click="navigate"
                >在线统计设置</UiButton>
              </RouterLink>
            </div>
          </div>
          <div class="panel__bd">
            <div
              v-if="connectivityResult"
              class="community-page__probe-card"
              :class="connectivityResult.summary.any_ok ? 'is-ok' : 'is-bad'"
            >
              <p class="community-page__probe-hint">{{ connectivityResult.summary.hint }}</p>
              <ul class="community-page__probe-list">
                <li
                  v-for="row in connectivityResult.probes"
                  :key="row.url"
                  class="community-page__probe-row"
                >
                  <UiBadge :variant="row.ok ? 'ok' : 'destructive'">{{ row.ok ? "可达" : "失败" }}</UiBadge>
                  <code class="community-page__mono community-page__probe-url">{{ shortProbeHost(row.url) }}</code>
                  <span class="muted community-page__probe-meta">
                    <template v-if="row.ok">{{ row.latency_ms != null ? `${row.latency_ms} ms` : "—" }}</template>
                    <template v-else>{{ row.error || (row.http_status != null ? `HTTP ${row.http_status}` : "失败") }}</template>
                  </span>
                </li>
              </ul>
              <dl class="home-dl community-page__detail-dl community-page__probe-reporting">
                <dt>上报开关</dt>
                <dd>{{ connectivityResult.reporting.enabled ? "已开启" : "已关闭" }}</dd>
                <dt>配置 endpoint</dt>
                <dd class="community-page__mono">{{ connectivityResult.reporting.endpoint || "—" }}</dd>
                <dt>最近成功入口</dt>
                <dd class="community-page__mono">{{ connectivityResult.reporting.active_heartbeat_endpoint || "—" }}</dd>
                <dt>上次成功上报</dt>
                <dd>{{ formatUnixRelative(connectivityResult.reporting.last_heartbeat_ok_unix) }}</dd>
              </dl>
            </div>
            <div class="grid-stats community-page__deploy-grid">
              <StatCard
                dense
                label="活跃安装"
                :value="formatCommunityStatNum(communityStats?.deployments_online)"
                :hint="deploymentsOnlineHint"
              />
              <StatCard
                dense
                label="在线牛牛"
                :value="formatCommunityStatNum(communityStats?.bots_online_sum)"
                :hint="botsOnlineHint"
              />
              <StatCard
                dense
                label="分片安装"
                :value="`${formatCommunityStatNum(communityStats?.deployments_online_sharded)} / ${formatCommunityStatNum(communityStats?.shard_workers_online_sum)}`"
                hint="采用分片架构的安装数 / 在线工作进程数"
              />
              <StatCard
                dense
                label="近 24 小时"
                :value="formatCommunityStatNum(communityStats?.active_recent_24h)"
                :hint="activeRecentHint"
              />
            </div>
            <dl class="home-dl community-page__detail-dl community-page__meta-dl">
              <dt>历史安装</dt>
              <dd>{{ formatCommunityStatNum(communityStats?.deployments_total) }} 套</dd>
              <dt>在线名册</dt>
              <dd>{{ formatCommunityStatNum(communityStats?.catalog_bots_online_sum) }} 只牛牛</dd>
              <dt>共享语料</dt>
              <dd>
                <UiBadge
                  v-if="communityStats != null"
                  :variant="communityStats.corpus_enabled ? 'ok' : 'secondary'"
                >{{ communityStats.corpus_enabled ? "已接入" : "未接入" }}</UiBadge>
                <span
                  v-else
                  class="community-page__mono"
                >—</span>
              </dd>
              <template v-if="statsAsOfText || statsUrl">
                <dt>数据来源</dt>
                <dd class="community-page__meta-stack">
                  <span
                    v-if="statsAsOfText"
                    class="community-page__meta-line"
                  >{{ statsAsOfText }}</span>
                  <a
                    v-if="statsUrl"
                    class="community-page__ext-link community-page__meta-line community-page__mono"
                    :href="statsUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ statsUrl }}</a>
                </dd>
              </template>
            </dl>
            <div
              v-if="onlineVersions.length"
              class="community-page__versions"
            >
              <h3 class="community-page__subhd">在线版本分布</h3>
              <ul class="community-page__version-list">
                <li
                  v-for="row in onlineVersions"
                  :key="row.version"
                  class="community-page__version-row"
                >
                  <span class="community-page__version-name community-page__mono">{{ row.version || "—" }}</span>
                  <span class="community-page__version-count">{{ formatCommunityStatNum(row.count) }} 套</span>
                </li>
              </ul>
            </div>
          </div>
        </UiCard>
      </section>

      <section
        id="community-federation"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel community-page__federation-panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                name="network"
              />{{ federationOnboarding?.title || "多机协同" }}
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                custom
                v-slot="{ navigate }"
                :to="controlPlaneConfigLink"
              >
                <UiButton
                  variant="ghost"
                  size="sm"
                  @click="navigate"
                >多机协同</UiButton>
              </RouterLink>
            </div>
          </div>
          <div class="panel__bd community-page__federation-bd">
            <p
              v-if="federationOnboarding?.summary"
              class="community-page__federation-summary"
            >
              {{ federationOnboarding.summary }}
            </p>
            <p
              v-else-if="federationOnboardingUnavailable"
              class="muted community-page__federation-summary"
            >
              社区中心暂未提供入池说明；你仍可在「多机协同」配置中手动填写密钥与相关项。
            </p>
            <p
              v-if="federationOnboarding?.ingress_note"
              class="community-page__federation-ingress-note muted"
            >
              {{ federationOnboarding.ingress_note }}
            </p>

            <p class="muted community-page__federation-pool-note">
              左两列为已登记协同配置且近期上报在线统计的安装；右列为去重服务上仍有活跃标记的安装。
            </p>
            <div class="grid-stats community-page__federation-pool-grid">
              <StatCard
                dense
                label="累计入池"
                :value="formatCommunityStatNum(federationPoolStats?.members_total)"
                hint="曾成功从社区中心领取协同配置的安装套数"
              />
              <StatCard
                dense
                label="在线入池"
                :value="formatCommunityStatNum(federationPoolStats?.members_online)"
                hint="已入池且近期有在线统计上报的安装套数"
              />
              <StatCard
                dense
                label="去重活跃"
                :value="federationCoordActiveLabel"
                hint="去重服务上仍有活跃标记的安装数，表示近期有牛牛在处理群消息"
              />
            </div>

            <div
              v-if="federationSecret"
              class="community-page__federation-secret"
            >
              <div class="community-page__federation-secret-hd">
                <span class="community-page__federation-secret-label">{{
                  federationOnboarding?.instance_secret_label || "入池密钥"
                }}</span>
                <UiButton
                  variant="ghost"
                  size="sm"
                  @click="copyFederationSecret"
                >
                  复制密钥
                </UiButton>
              </div>
              <code class="community-page__federation-secret-value community-page__mono">{{ federationSecret }}</code>
              <p
                v-if="federationOnboarding?.instance_secret_hint"
                class="community-page__federation-secret-hint muted"
              >
                {{ federationOnboarding.instance_secret_hint }}
              </p>
            </div>

            <dl
              v-if="federationOnboarding"
              class="home-dl community-page__detail-dl community-page__federation-meta"
            >
              <dt>协同池</dt>
              <dd class="community-page__mono">{{ federationOnboarding.federate_id || "—" }}</dd>
              <dt>自动拉取配置</dt>
              <dd>
                <UiBadge
                  :variant="federationOnboarding.bootstrap_enabled ? 'ok' : 'secondary'"
                >{{ federationOnboarding.bootstrap_enabled ? "已开启" : "已关闭" }}</UiBadge>
              </dd>
              <dt>去重服务器</dt>
              <dd class="community-page__federation-coord-dd">
                <div
                  v-if="federationCoordDisplay || federationCoordEndpoint"
                  class="community-page__federation-coord-row"
                >
                  <code class="community-page__federation-coord-value community-page__mono">{{ federationCoordDisplay || federationCoordEndpoint }}</code>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    @click="copyCoordAddress"
                  >
                    复制地址
                  </UiButton>
                </div>
                <span
                  v-else
                  class="muted"
                >—</span>
                <p
                  v-if="federationOnboarding.coord_redis_hint"
                  class="community-page__federation-coord-hint muted"
                >
                  {{ federationOnboarding.coord_redis_hint }}
                </p>
              </dd>
            </dl>

            <div
              v-if="controlPlane"
              class="community-page__federation-local"
            >
              <h3 class="community-page__subhd">本部署状态</h3>
              <div class="community-page__corpus-meta-bar">
                <span class="community-page__corpus-meta-item">
                  <span class="community-page__corpus-meta-k">多机协同</span>
                  <span
                    class="community-page__corpus-meta-v"
                    :class="controlPlane.enabled ? 'is-ok' : 'is-off'"
                  >{{ controlPlane.enabled ? "已开启" : "已关闭" }}</span>
                </span>
                <span class="community-page__corpus-meta-item">
                  <span class="community-page__corpus-meta-k">入池密钥</span>
                  <span
                    class="community-page__corpus-meta-v"
                    :class="controlPlane.instance_secret_configured ? 'is-ok' : 'is-off'"
                  >{{ controlPlane.instance_secret_configured ? "已填写" : "未填写" }}</span>
                </span>
                <span class="community-page__corpus-meta-item">
                  <span class="community-page__corpus-meta-k">中心配置</span>
                  <span
                    class="community-page__corpus-meta-v"
                    :class="controlPlane.bootstrap_valid ? 'is-ok' : 'is-off'"
                  >{{ controlPlane.bootstrap_valid ? "已获取" : "待拉取或过期" }}</span>
                </span>
                <span class="community-page__corpus-meta-item">
                  <span class="community-page__corpus-meta-k">消息去重</span>
                  <span class="community-page__corpus-meta-v">{{ ingressEnabledLabel(controlPlane.federate_ingress_enabled) }}</span>
                </span>
                <span
                  v-if="controlPlane.federate_id"
                  class="community-page__corpus-meta-item community-page__corpus-meta-item--grow"
                >
                  <span class="community-page__corpus-meta-k">池编号</span>
                  <span class="community-page__corpus-meta-v community-page__mono">{{ controlPlane.federate_id }}</span>
                </span>
              </div>
            </div>

            <ol
              v-if="federationOnboarding?.steps?.length"
              class="community-page__federation-steps"
            >
              <li
                v-for="step in federationOnboarding.steps"
                :key="step.order"
                class="community-page__federation-step"
              >
                <span class="community-page__federation-step-title">{{ step.title }}</span>
                <span class="community-page__federation-step-detail">{{ step.detail }}</span>
              </li>
            </ol>
          </div>
        </UiCard>
      </section>

      <section
        id="community-corpus"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                name="list"
              />共享语料
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                custom
                v-slot="{ navigate }"
                to="/corpus-config"
              >
                <UiButton
                  variant="ghost"
                  size="sm"
                  @click="navigate"
                >语料设置</UiButton>
              </RouterLink>
            </div>
          </div>
          <div class="panel__bd">
            <div class="grid-stats community-page__corpus-grid">
              <StatCard
                dense
                label="词条规模"
                :value="corpusPoolValue"
                :hint="corpusPoolHint"
              />
              <StatCard
                dense
                label="在线接入"
                :value="formatCommunityStatNum(communityStats?.corpus?.enrollments_online)"
                :hint="corpusOnlineEnrollHint"
              />
              <StatCard
                dense
                label="累计接入"
                :value="formatCommunityStatNum(communityStats?.corpus?.enrollments_total)"
                :hint="corpusTotalEnrollHint"
              />
              <StatCard
                dense
                label="允许上传"
                :value="formatCommunityStatNum(communityStats?.corpus?.contribute_enabled_total)"
                hint="已接入且允许把本机新回复同步到共享池的安装数"
              />
              <StatCard
                dense
                label="回复被引用"
                :value="formatCommunityStatNum(communityStats?.corpus?.answer_hits_sum)"
                hint="共享池中各回复条目被接话引用的累计次数"
              />
              <StatCard
                dense
                label="允许读取"
                :value="formatCommunityStatNum(communityStats?.corpus?.read_enabled_total)"
                hint="已接入且允许从共享池读取语料的安装数"
              />
            </div>
          </div>
        </UiCard>
      </section>

      <section
        id="community-hot"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                name="sparkles"
              />共享语料热词
            </h2>
          </div>
          <div class="panel__bd">
            <p class="muted community-page__hot-lead">
              默认展示近24h各部署热词叠加（机群榜）；「高频池」为共享语料累计，「本月」为近期活跃窗口。
            </p>
            <CorpusWordCloud
              source="community"
              :reload-token="hotReloadToken"
            />
          </div>
        </UiCard>
      </section>

      <section
        id="community-local-hot"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                name="globe"
              />本机语料热词
            </h2>
          </div>
          <div class="panel__bd">
            <p class="muted community-page__hot-lead">
              本部署全部群的学习语料累计热度，与共享池独立统计。
            </p>
            <CorpusWordCloud
              source="local"
              :reload-token="hotReloadToken"
            />
          </div>
        </UiCard>
      </section>

      <section
        id="community-local"
        class="community-page__section"
      >
        <UiCard tag="div" glass class="community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title community-page__section-title">
              <ConsoleNavIcon
                class="panel__title-ico"
                name="database"
              />本部署语料
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                custom
                v-slot="{ navigate }"
                to="/corpus-config"
              >
                <UiButton
                  variant="ghost"
                  size="sm"
                  @click="navigate"
                >语料设置</UiButton>
              </RouterLink>
            </div>
          </div>
          <div
            v-if="corpusStatus"
            class="panel__bd community-page__local-bd"
          >
            <div class="community-page__corpus-board">
              <div class="community-page__corpus-summary">
                <div class="community-page__corpus-summary-main">
                  <UiBadge
                    class="community-page__status-badge"
                    :variant="corpusMultiSourceBadge.ok ? 'ok' : 'secondary'"
                  >{{ corpusMultiSourceBadge.label }}</UiBadge>
                  <span
                    v-if="corpusSummaryFlow"
                    class="community-page__corpus-summary-flow"
                  >查找顺序：{{ corpusSummaryFlow }}</span>
                </div>
                <div class="community-page__corpus-summary-meta">
                  <span>{{ mergeStrategyLabel(corpusStatus.merge_strategy) }}</span>
                  <span class="community-page__corpus-summary-sep">·</span>
                  <span>远端失败时 {{ remoteFailureLabel(corpusStatus.on_remote_failure) }}</span>
                  <span class="community-page__corpus-summary-sep">·</span>
                  <span>快照 {{ corpusSnapshotText }}</span>
                </div>
              </div>

              <div class="grid-stats community-page__usage-grid">
                <StatCard
                  dense
                  label="查询共享池"
                  :value="formatCommunityStatNum(communityUsage?.read_lookups)"
                  hint="向社区共享池发起读取的次数（含未命中）"
                />
                <StatCard
                  dense
                  label="命中共享池"
                  :value="formatCommunityStatNum(communityUsage?.read_hits)"
                  hint="共享池实际返回可用语料的次数"
                />
                <StatCard
                  dense
                  label="上传到共享池"
                  :value="formatCommunityStatNum(communityUsage?.contribute_ok)"
                  :hint="communityUsage ? `成功上传的新回复条数；统计更新于 ${communityUsageUpdatedText}` : '社区中心暂未返回本部署用量'"
                />
              </div>

              <div class="table-wrap community-page__matrix-wrap">
                <table class="tbl community-page__source-matrix">
                  <thead>
                    <tr>
                      <th scope="col">能力</th>
                      <th
                        v-for="key in visibleSourceKeys"
                        :key="key"
                        scope="col"
                        class="community-page__matrix-src-th"
                      >
                        <span
                          class="community-page__matrix-src"
                          :class="corpusStatus.sources?.[key]?.enabled ? 'is-on' : 'is-off'"
                        >{{ sourceLabel(key) }}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in sourceMatrixRows"
                      :key="row.key"
                    >
                      <th scope="row">{{ row.label }}</th>
                      <td
                        v-for="key in visibleSourceKeys"
                        :key="`${row.key}-${key}`"
                      >
                        <span
                          class="community-page__matrix-cell"
                          :class="`community-page__matrix-cell--${matrixCellState(key, corpusStatus.sources?.[key], row.key)}`"
                        >{{ matrixCellText(matrixCellState(key, corpusStatus.sources?.[key], row.key)) }}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <ul
                v-if="sourceApiEntries.length"
                class="community-page__api-list"
              >
                <li
                  v-for="entry in sourceApiEntries"
                  :key="entry.key"
                  class="community-page__api-list-item"
                >
                  <span class="community-page__api-list-k">{{ sourceLabel(entry.key) }}</span>
                  <code class="community-page__api-list-v">{{ entry.url }}</code>
                </li>
              </ul>

              <div class="community-page__corpus-meta-bar">
                <span
                  class="community-page__corpus-meta-item"
                  :title="corpusStatus.deployment?.deployment_id || ''"
                >
                  <span class="community-page__corpus-meta-k">部署</span>
                  <span class="community-page__corpus-meta-v community-page__mono">{{ deploymentIdShort }}</span>
                </span>
                <span class="community-page__corpus-meta-item">
                  <span class="community-page__corpus-meta-k">在线统计</span>
                  <span
                    class="community-page__corpus-meta-v"
                    :class="corpusStatus.deployment?.community_stats_enabled ? 'is-ok' : 'is-off'"
                  >{{ corpusStatus.deployment?.community_stats_enabled ? "已开启" : "已关闭" }}</span>
                </span>
                <span
                  v-if="corpusStatus.deployment?.heartbeat_endpoint"
                  class="community-page__corpus-meta-item community-page__corpus-meta-item--grow"
                >
                  <span class="community-page__corpus-meta-k">上报地址</span>
                  <span class="community-page__corpus-meta-v community-page__mono">{{ corpusStatus.deployment.heartbeat_endpoint }}</span>
                </span>
              </div>
            </div>          </div>
          <div
            v-else
            class="panel__bd muted community-page__empty"
          >
            无法读取本部署语料状态。
          </div>
        </UiCard>
      </section>
    </template>
  </div>
</template>
