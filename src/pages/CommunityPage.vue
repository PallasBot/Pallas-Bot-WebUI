<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchCommunityStats, fetchCorpusStatus, fetchFederationOnboarding } from "@/api/consoleApi";
import type {
  CommunityStatsData,
  CommunityVersionCountData,
  CorpusSourceStatusData,
  CorpusStatusData,
  FederationOnboardingData,
} from "@/api/pallasTypes";
import { pushConsoleToast } from "@/utils/consoleToast";
import { copyTextToClipboard } from "@/utils/clipboard";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import StatCard from "@/components/StatCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { PALLAS_COMMUNITY_HUB } from "@/utils/pallasExternalLinks";

const panelNavIcon = usePanelNavIcon();
const pageReady = ref(false);
const refreshBusy = ref(false);
const err = ref("");
const communityStats = ref<CommunityStatsData | null>(null);
const corpusStatus = ref<CorpusStatusData | null>(null);
const federationOnboarding = ref<FederationOnboardingData | null>(null);
const federationOnboardingUnavailable = ref(false);

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
  name: "common-config" as const,
  query: {
    section: (federationOnboarding.value?.config_section_id || "control_plane").trim() || "control_plane",
  },
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
  if (key === "fed") return "联邦库";
  return "共享池";
}

async function load(options?: { bypassCache?: boolean }) {
  err.value = "";
  try {
    const [comm, corpus, fed] = await Promise.all([
      fetchCommunityStats({ bypassCache: options?.bypassCache }).catch(() => null),
      fetchCorpusStatus().catch(() => null),
      fetchFederationOnboarding().catch(() => null),
    ]);
    communityStats.value = comm;
    corpusStatus.value = corpus;
    federationOnboarding.value = fed;
    federationOnboardingUnavailable.value = fed == null;
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
  } finally {
    refreshBusy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="community-page">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="3"
    />
    <template v-else>
      <section class="community-page__intro panel">
        <div class="panel__bd">
          <p class="community-page__intro-lead">
            本页汇总<strong>社区中心</strong>的公开统计，以及<strong>本部署</strong>的语料与联邦状态。公开页面：
            <a
              class="community-page__inline-link"
              :href="communityHubUrl"
              target="_blank"
              rel="noopener noreferrer"
            >社区主站</a>。
            数据只读；改设置请前往
            <RouterLink to="/common-config?section=corpus_federation">语料联邦</RouterLink>
            或
            <RouterLink to="/common-config?section=community_stats">在线统计与社区主站</RouterLink>。
          </p>
          <ul class="community-page__intro-list muted">
            <li><strong>在线统计</strong>：默认开启，向社区中心上报本机在线牛牛数量（不含消息内容）。</li>
            <li><strong>共享语料</strong>：默认关闭，开启后可读取社区大家贡献的接话素材，也可选择上传本机新回复。</li>
            <li><strong>社区联邦</strong>：多套牛牛共池时，避免对同一条群消息重复回复；需填写入池密钥。</li>
          </ul>
        </div>
      </section>

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
        <RouterLink
          class="community-page__inline-link"
          to="/community-stats-config"
        >前往在线统计设置</RouterLink>
      </p>

      <section
        id="community-deploy"
        class="community-page__section"
      >
        <div class="panel community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd community-page__deploy-panel-hd">
            <h2 class="panel__title">
              <span
                class="panel__title-ico"
                aria-hidden="true"
              >{{ panelNavIcon }}</span>全网部署
              <RefreshIconButton
                :busy="refreshBusy"
                label="刷新本页数据"
                @click="refresh"
              />
            </h2>
            <div class="row-actions community-page__hd-actions community-page__deploy-hd-actions">
              <span class="friends-groups-hd-pin-wrap community-page__deploy-hd-pin-wrap">
                <PanelSidebarAdd main-path="/community" />
              </span>
              <RouterLink
                class="btn btn--ghost btn--sm community-page__deploy-settings-btn"
                to="/community-stats-config"
              >在线统计设置</RouterLink>
            </div>
          </div>
          <div class="panel__bd">
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
                <span
                  v-if="communityStats != null"
                  class="badge"
                  :class="communityStats.corpus_enabled ? 'badge--ok' : ''"
                >{{ communityStats.corpus_enabled ? "已接入" : "未接入" }}</span>
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
        </div>
      </section>

      <section
        id="community-federation"
        class="community-page__section"
      >
        <div class="panel community-page__panel community-page__federation-panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title">
              <span
                class="panel__title-ico"
                aria-hidden="true"
              >◇</span>{{ federationOnboarding?.title || "社区联邦" }}
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                class="btn btn--ghost btn--sm"
                :to="controlPlaneConfigLink"
              >联邦控制</RouterLink>
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
              社区中心暂未提供入池说明；你仍可在「联邦控制」中手动填写密钥与相关项。
            </p>
            <p
              v-if="federationOnboarding?.ingress_note"
              class="community-page__federation-ingress-note muted"
            >
              {{ federationOnboarding.ingress_note }}
            </p>

            <p class="muted community-page__federation-pool-note">
              左两列：已向中心登记联邦配置、并在近期上报在线统计的安装。右列：去重服务上仍有活跃标记的安装（表示近期确实处理过群消息），与左两列统计口径不同。
            </p>
            <div class="grid-stats community-page__federation-pool-grid">
              <StatCard
                dense
                label="累计入池"
                :value="formatCommunityStatNum(federationPoolStats?.members_total)"
                hint="曾成功从社区中心领取联邦配置的安装套数"
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
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  @click="copyFederationSecret"
                >
                  复制密钥
                </button>
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
              <dt>联邦池</dt>
              <dd class="community-page__mono">{{ federationOnboarding.federate_id || "—" }}</dd>
              <dt>自动拉取配置</dt>
              <dd>
                <span
                  class="badge"
                  :class="federationOnboarding.bootstrap_enabled ? 'badge--ok' : ''"
                >{{ federationOnboarding.bootstrap_enabled ? "已开启" : "已关闭" }}</span>
              </dd>
              <dt>去重服务器</dt>
              <dd class="community-page__federation-coord-dd">
                <div
                  v-if="federationCoordDisplay || federationCoordEndpoint"
                  class="community-page__federation-coord-row"
                >
                  <code class="community-page__federation-coord-value community-page__mono">{{ federationCoordDisplay || federationCoordEndpoint }}</code>
                  <button
                    type="button"
                    class="btn btn--ghost btn--sm"
                    @click="copyCoordAddress"
                  >
                    复制地址
                  </button>
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
                  <span class="community-page__corpus-meta-k">联邦控制</span>
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
        </div>
      </section>

      <section
        id="community-corpus"
        class="community-page__section"
      >
        <div class="panel community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title">
              <span
                class="panel__title-ico"
                aria-hidden="true"
              >▦</span>共享语料
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                class="btn btn--ghost btn--sm"
                to="/corpus-config"
              >语料设置</RouterLink>
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
        </div>
      </section>

      <section
        id="community-local"
        class="community-page__section"
      >
        <div class="panel community-page__panel">
          <div class="panel__hd panel__hd--split community-page__panel-hd">
            <h2 class="panel__title">
              <span
                class="panel__title-ico"
                aria-hidden="true"
              >◎</span>本部署语料
            </h2>
            <div class="row-actions community-page__hd-actions">
              <RouterLink
                class="btn btn--ghost btn--sm"
                to="/corpus-config"
              >语料设置</RouterLink>
            </div>
          </div>
          <div
            v-if="corpusStatus"
            class="panel__bd community-page__local-bd"
          >
            <div class="community-page__corpus-board">
              <div class="community-page__corpus-summary">
                <div class="community-page__corpus-summary-main">
                  <span
                    class="badge community-page__status-badge"
                    :class="corpusStatus.composite_active ? 'badge--ok' : ''"
                  >{{ corpusStatus.composite_active ? "多源接话已启用" : "多源接话未启用" }}</span>
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
        </div>
      </section>
    </template>
  </div>
</template>
