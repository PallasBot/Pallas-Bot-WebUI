<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchCommunityStats, fetchCommunityStatsHistory } from "@/api/consoleApi";
import type { CommunityStatsData, CommunityStatsHistoryPoint } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import StatCard from "@/components/StatCard.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { buildTrendSparkPoints, formatDelta, formatHistoryBucketAt } from "@/utils/communityStatsChart";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const busy = ref(false);
const stats = ref<CommunityStatsData | null>(null);
const history = ref<CommunityStatsHistoryPoint[]>([]);
const historyMeta = ref<{ bucket_sec: number; point_count: number } | null>(null);

const HISTORY_HOURS = 24;
const HISTORY_BUCKET_SEC = 300;
const POLL_MS = 60_000;
let pollId: ReturnType<typeof setInterval> | null = null;

function formatNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.floor(n));
}

const onlineTtlHint = computed(() => {
  const sec = stats.value?.online_ttl_sec;
  if (sec == null || !Number.isFinite(sec)) return "在线判定窗口见 stats 中心";
  const m = Math.max(1, Math.round(sec / 60));
  return `在线判定：${m} 分钟内有心跳`;
});

const corpusHint = computed(() => {
  const c = stats.value?.corpus;
  if (!c) return "语料池未启用或未返回";
  return `enroll ${formatNum(c.enrollments_total)} · 可写回 ${formatNum(c.contribute_enabled_total)}`;
});

const asOfDisplay = computed(() => {
  const raw = stats.value?.as_of;
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("zh-CN", { hour12: false });
});

const historyRows = computed(() => {
  const asc = history.value;
  const desc = [...asc].reverse();
  return desc.map((p, i) => {
    const older = i < desc.length - 1 ? desc[i + 1] : undefined;
    return {
      ...p,
      timeLabel: formatHistoryBucketAt(p.at),
      depDelta: formatDelta(p.deployments_online, older?.deployments_online),
      botsDelta: formatDelta(p.bots_online_sum, older?.bots_online_sum),
    };
  });
});

const depSparkValues = computed(() => history.value.map((p) => p.deployments_online));
const botsSparkValues = computed(() => history.value.map((p) => p.bots_online_sum));

const depSparkPoints = computed(() => buildTrendSparkPoints(depSparkValues.value));
const botsSparkPoints = computed(() => buildTrendSparkPoints(botsSparkValues.value));

const historyEmptyHint = computed(() => {
  if (history.value.length) return "";
  return "暂无 24h 采样。本 Bot 约每 5 分钟在成功拉取社区统计后落盘一条；请保持运行并稍后刷新。";
});

async function load() {
  if (busy.value) return;
  busy.value = true;
  err.value = "";
  try {
    const [cur, hist] = await Promise.all([
      fetchCommunityStats({ bypassCache: true }),
      fetchCommunityStatsHistory({ hours: HISTORY_HOURS, bucketSec: HISTORY_BUCKET_SEC }),
    ]);
    stats.value = cur;
    history.value = hist.points ?? [];
    historyMeta.value = { bucket_sec: hist.bucket_sec, point_count: hist.point_count };
    pageReady.value = true;
  } catch (e) {
    err.value = axiosErrorDetail(e) || "加载失败";
    pageReady.value = true;
  } finally {
    busy.value = false;
  }
}

function startPoll() {
  stopPoll();
  pollId = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void load();
  }, POLL_MS);
}

function stopPoll() {
  if (pollId != null) {
    clearInterval(pollId);
    pollId = null;
  }
}

onMounted(() => {
  void load();
  startPoll();
});

onUnmounted(() => stopPoll());
</script>

<template>
  <div class="community-center-page">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="3"
    />
    <template v-else>
      <div class="panel community-center-page__panel">
        <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span
              class="panel__title-ico"
              aria-hidden="true"
            >{{ panelNavIcon }}</span>社区中心
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/community-center" />
            <RefreshIconButton
              :busy="busy"
              label="刷新社区统计"
              @click="load"
            />
            <RouterLink
              class="btn btn--ghost btn--sm"
              to="/corpus-config"
            >语料联邦配置</RouterLink>
          </div>
        </div>
        <div class="panel__bd">
          <p
            v-if="stats?.stats_url"
            class="community-center-page__lede muted"
          >
            数据源 <code class="community-center-page__url">{{ stats.stats_url }}</code>
            · 快照 {{ asOfDisplay }}
            · {{ onlineTtlHint }}
          </p>
          <div class="grid-stats community-center-page__stats">
            <StatCard
              dense
              label="在线部署"
              :value="formatNum(stats?.deployments_online)"
              :hint="`${formatNum(stats?.deployments_total)} 套历史登记`"
            />
            <StatCard
              dense
              label="在线牛合计"
              :value="formatNum(stats?.bots_online_sum)"
              :hint="onlineTtlHint"
            />
            <StatCard
              dense
              label="分片 / Worker"
              :value="`${formatNum(stats?.deployments_online_sharded)} / ${formatNum(stats?.shard_workers_online_sum)}`"
              hint="在线分片部署与 worker 合计"
            />
            <StatCard
              dense
              label="语料池"
              :value="stats?.corpus ? `${formatNum(stats.corpus.contexts_total)} ctx · ${formatNum(stats.corpus.answers_total)} ans` : '—'"
              :hint="corpusHint"
            />
          </div>
        </div>
      </div>

      <div class="panel community-center-page__panel">
        <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span
              class="panel__title-ico"
              aria-hidden="true"
            >▥</span>在线部署（24h）
          </h2>
          <span
            v-if="historyMeta"
            class="home-page__hd-capsule home-page__hd-capsule--muted"
          >{{ historyMeta.point_count }} 桶 · {{ Math.round((historyMeta.bucket_sec || 300) / 60) }} 分钟</span>
        </div>
        <div class="panel__bd community-center-page__trend-bd">
          <p
            v-if="historyEmptyHint"
            class="muted community-center-page__empty"
          >{{ historyEmptyHint }}</p>
          <template v-else>
            <div class="community-center-page__chart-wrap">
              <svg
                v-if="depSparkPoints"
                class="community-center-page__chart"
                viewBox="0 0 440 120"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  :points="depSparkPoints"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div class="table-wrap">
              <table class="data community-center-page__table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>在线部署</th>
                    <th>较上桶</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in historyRows"
                    :key="row.at"
                  >
                    <td>{{ row.timeLabel }}</td>
                    <td>{{ row.deployments_online }}</td>
                    <td>{{ row.depDelta }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>

      <div class="panel community-center-page__panel">
        <div class="panel__hd panel__hd--split home-page__panel-hd-nowrap">
          <h2 class="panel__title">
            <span
              class="panel__title-ico"
              aria-hidden="true"
            >▥</span>在线牛（24h）
          </h2>
        </div>
        <div class="panel__bd community-center-page__trend-bd">
          <p
            v-if="historyEmptyHint"
            class="muted community-center-page__empty"
          >{{ historyEmptyHint }}</p>
          <template v-else>
            <div class="community-center-page__chart-wrap">
              <svg
                v-if="botsSparkPoints"
                class="community-center-page__chart"
                viewBox="0 0 440 120"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  :points="botsSparkPoints"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
            <div class="table-wrap">
              <table class="data community-center-page__table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>在线牛</th>
                    <th>较上桶</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in historyRows"
                    :key="`b-${row.at}`"
                  >
                    <td>{{ row.timeLabel }}</td>
                    <td>{{ row.bots_online_sum }}</td>
                    <td>{{ row.botsDelta }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
