<script lang="ts">
export default { name: "LogsPage" };
</script>

<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import LogVirtualFeed from "@/components/LogVirtualFeed.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from "vue";
import { fetchLogs, openLogsEventSource } from "@/api/consoleApi";
import type { LogEntry, LogEntryLevel, LogScope, LogsData } from "@/api/pallasTypes";
import { useThrottledVersion } from "@/composables/useThrottledVersion";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import {
  loadLogsEnabledLevels,
  LOG_ENTRY_LEVELS,
  normalizeLogEntryDisplay,
  mergeLogEntryContinuations,
  isLogMessageContinuation,
  parseLogLineLevel,
  persistLogsEnabledLevels,
  stripYearFromLogLine,
} from "@/utils/logDisplay";
import {
  loadLogsLastEventId,
  persistLogsLastEventId,
} from "@/utils/logStreamResume";

const panelNavIcon = usePanelNavIcon();
const liveTick = useThrottledVersion(100);

type LogsSnapshot = {
  scope: LogScope;
  logSource: string;
  n: number;
  payload: LogsData;
};

let logsSnapshotCache: LogsSnapshot | null = null;

const err = ref("");
const pageReady = ref(false);
const loading = ref(false);
/** 运行中轮询间隔（毫秒）；隐藏标签页时跳过请求 */
const LOG_POLL_MS = 8000;
let logPollTimer: number | null = null;
let logBootRaf = 0;
let logScrollBottomRaf = 0;
const scope = ref<LogScope>("all");
const logSource = ref("all");
const logSources = ref<string[]>([]);
const n = ref(200);
const payload = ref<LogsData | null>(null);
const view = ref<"feed" | "raw">("feed");
const q = ref("");
const enabledLevels = ref<Set<LogEntryLevel>>(loadLogsEnabledLevels());
/** SSE 追加的实时条目 */
const liveEntries = ref<LogEntry[]>([]);
const MAX_LIVE_ENTRIES = 1200;
const streamReconnectCount = ref(0);
const streamReconnecting = ref(false);
const lastStreamEventId = ref(0);
let streamReconnectTimer: number | null = null;

let logEs: EventSource | null = null;

const rawScrollEl = ref<HTMLElement | null>(null);
const logFeedRef = ref<InstanceType<typeof LogVirtualFeed> | null>(null);
const followLogTail = ref(true);
const advancedOpen = ref(false);
const streamLive = ref(false);
const LOG_ROW_HEIGHT = 34;
let suppressRawFollowUpdate = 0;

function logScrollThreshold(el: HTMLElement): number {
  const h = el.clientHeight;
  return Math.min(80, Math.max(24, Math.floor(h * 0.08)));
}

function isNearBottom(el: HTMLElement): boolean {
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  const slack = Math.max(logScrollThreshold(el), LOG_ROW_HEIGHT * 3);
  return gap <= slack;
}

function onFeedScrollState(nearBottom: boolean) {
  followLogTail.value = nearBottom;
}

function onRawScroll(ev: Event) {
  if (suppressRawFollowUpdate > 0) return;
  const el = ev.target as HTMLElement | null;
  if (!el) return;
  followLogTail.value = isNearBottom(el);
}

async function scrollActiveLogToBottom(force = false) {
  await nextTick();
  if (view.value === "feed") {
    if (force || followLogTail.value) {
      await logFeedRef.value?.scrollToBottom(force || followLogTail.value);
    }
    return;
  }
  const el = rawScrollEl.value;
  if (!el || (!force && !followLogTail.value)) return;
  suppressRawFollowUpdate += 1;
  const apply = () => {
    el.scrollTop = el.scrollHeight;
  };
  apply();
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      apply();
      window.requestAnimationFrame(() => {
        apply();
        suppressRawFollowUpdate = Math.max(0, suppressRawFollowUpdate - 1);
        followLogTail.value = isNearBottom(el);
      });
    });
  } else {
    suppressRawFollowUpdate = Math.max(0, suppressRawFollowUpdate - 1);
  }
}

function scheduleScrollActiveLogToBottom(force = false) {
  if (typeof window === "undefined") return;
  if (logScrollBottomRaf) window.cancelAnimationFrame(logScrollBottomRaf);
  logScrollBottomRaf = window.requestAnimationFrame(() => {
    logScrollBottomRaf = 0;
    void scrollActiveLogToBottom(force);
  });
}

function cancelLogBoot() {
  if (logBootRaf && typeof window !== "undefined") {
    window.cancelAnimationFrame(logBootRaf);
    logBootRaf = 0;
  }
}

async function bootLogsPage() {
  if (document.visibilityState === "hidden") return;
  await load({ silent: pageReady.value });
  startLogPolling();
  startLogStream();
}

function scheduleBootLogsPage() {
  if (typeof window === "undefined") return;
  cancelLogBoot();
  logBootRaf = window.requestAnimationFrame(() => {
    logBootRaf = 0;
    void bootLogsPage();
  });
}

function stopLogPolling() {
  if (logPollTimer == null) return;
  window.clearInterval(logPollTimer);
  logPollTimer = null;
}

function startLogPolling() {
  if (typeof window === "undefined") return;
  if (logPollTimer != null) return;
  logPollTimer = window.setInterval(() => {
    if (document.visibilityState === "hidden") return;
    void load({ silent: true });
  }, LOG_POLL_MS);
}

function stopLogStreamConnection() {
  if (logEs) {
    logEs.close();
    logEs = null;
  }
  if (streamReconnectTimer != null) {
    window.clearTimeout(streamReconnectTimer);
    streamReconnectTimer = null;
  }
}

function closeLogStream() {
  stopLogStreamConnection();
  streamLive.value = false;
  liveEntries.value = [];
  liveTick.flushNow();
}

function pushLiveEntry(raw: LogEntry) {
  const row = normalizeLogEntryDisplay({
    ...raw,
    id: raw.id ?? Date.now() + Math.floor(Math.random() * 1000),
  });
  const buf = liveEntries.value;
  const prev = buf[buf.length - 1];
  if (prev && isLogMessageContinuation(row.message)) {
    prev.message = prev.message ? `${prev.message}\n${row.message}` : row.message;
    liveTick.bump();
    return;
  }
  buf.push(row);
  if (buf.length > MAX_LIVE_ENTRIES) {
    buf.splice(0, buf.length - MAX_LIVE_ENTRIES);
  }
  liveTick.bump();
}

function startLogStream() {
  stopLogStreamConnection();
  streamLive.value = false;
  streamReconnecting.value = false;
  try {
    const resumeId = lastStreamEventId.value > 0 ? lastStreamEventId.value : undefined;
    logEs = openLogsEventSource(scope.value, logSource.value, resumeId);
    logEs.onopen = () => {
      streamLive.value = true;
      streamReconnecting.value = false;
    };
    logEs.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const row = JSON.parse(ev.data) as LogEntry & { type?: string };
        if (row && typeof row === "object" && row.type === "ready") return;
        if (row.message != null) {
          if (typeof row.id === "number" && row.id > 0) {
            lastStreamEventId.value = row.id;
            persistLogsLastEventId(scope.value, logSource.value, row.id);
          } else if (ev.lastEventId) {
            const parsed = Number(ev.lastEventId);
            if (Number.isFinite(parsed) && parsed > 0) {
              lastStreamEventId.value = parsed;
              persistLogsLastEventId(scope.value, logSource.value, parsed);
            }
          }
          pushLiveEntry(row);
        }
      } catch {
        /* ignore malformed */
      }
    };
    logEs.onerror = () => {
      streamLive.value = false;
      stopLogStreamConnection();
      if (streamReconnectTimer != null) return;
      streamReconnecting.value = true;
      streamReconnectTimer = window.setTimeout(() => {
        streamReconnectTimer = null;
        streamReconnectCount.value += 1;
      }, 3000);
    };
  } catch {
    stopLogStreamConnection();
  }
}

async function load(opts?: { silent?: boolean; bypassCache?: boolean }) {
  const silent = Boolean(opts?.silent);
  if (!silent) loading.value = true;
  err.value = "";
  try {
    const src = logSource.value === "all" ? undefined : logSource.value;
    const data = await fetchLogs(n.value, scope.value, src, {
      bypassCache: opts?.bypassCache === true,
    });
    payload.value = data;
    if (payload.value.log_sources?.length) {
      logSources.value = payload.value.log_sources;
    }
    logsSnapshotCache = {
      scope: scope.value,
      logSource: logSource.value,
      n: n.value,
      payload: data,
    };
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    if (!payload.value) payload.value = null;
  } finally {
    if (!silent) loading.value = false;
    pageReady.value = true;
    if (!silent) {
      followLogTail.value = true;
      scheduleScrollActiveLogToBottom(true);
    }
  }
}

function applyLogsSnapshotCache(): boolean {
  const snap = logsSnapshotCache;
  if (!snap) return false;
  scope.value = snap.scope;
  logSource.value = snap.logSource;
  n.value = snap.n;
  payload.value = snap.payload;
  if (snap.payload.log_sources?.length) {
    logSources.value = snap.payload.log_sources;
  }
  pageReady.value = true;
  return true;
}

watch([scope, n, logSource], () => {
  void load();
});

const baseEntries = computed(() => payload.value?.entries ?? []);
const entries = computed(() => {
  liveTick.version.value;
  if (!liveEntries.value.length) return baseEntries.value;
  const seen = new Set(baseEntries.value.map((e) => `${e.time}|${e.scope}|${e.message}`));
  const extra = liveEntries.value.filter(
    (e) => !seen.has(`${e.time}|${e.scope}|${e.message}`),
  );
  return [...baseEntries.value, ...extra];
});
const lines = computed(() => payload.value?.lines ?? []);
const displayLines = computed(() => lines.value.map(stripYearFromLogLine));

const sourceOptions = computed(() => {
  const opts = logSources.value.length ? logSources.value : ["hub"];
  if (!opts.includes("all")) return ["all", ...opts];
  return ["all", ...opts.filter((s) => s !== "all")];
});

const displayEntries = computed(() =>
  mergeLogEntryContinuations(entries.value.map((e) => normalizeLogEntryDisplay(e))),
);

function entryPassesLevel(level: LogEntryLevel): boolean {
  return enabledLevels.value.has(level);
}

function toggleLogLevel(lv: LogEntryLevel) {
  const next = new Set(enabledLevels.value);
  if (next.has(lv)) next.delete(lv);
  else next.add(lv);
  enabledLevels.value = next;
  persistLogsEnabledLevels(next);
}

const levelFilteredEntries = computed(() =>
  displayEntries.value.filter((e) => entryPassesLevel(e.level)),
);

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  const base = levelFilteredEntries.value;
  if (!needle) return base;
  return base.filter(
    (e) =>
      e.message.toLowerCase().includes(needle) ||
      e.scope.toLowerCase().includes(needle) ||
      e.level.toLowerCase().includes(needle) ||
      e.time.toLowerCase().includes(needle),
  );
});

const historyEntryCount = computed(() => baseEntries.value.length);

const liveExtraCount = computed(() => {
  liveTick.version.value;
  if (!liveEntries.value.length) return 0;
  const seen = new Set(baseEntries.value.map((e) => `${e.time}|${e.scope}|${e.message}`));
  return liveEntries.value.filter((e) => !seen.has(`${e.time}|${e.scope}|${e.message}`)).length;
});

const visibleCount = computed(() =>
  view.value === "feed" ? filtered.value.length : filteredRawLines.value.length,
);

const activeFilterCount = computed(() => {
  let count = 0;
  if (q.value.trim()) count += 1;
  if (scope.value !== "all") count += 1;
  if (logSource.value !== "all") count += 1;
  if (n.value !== 200) count += 1;
  if (enabledLevels.value.size < LOG_ENTRY_LEVELS.length) count += 1;
  return count;
});

const streamBadgeLabel = computed(() => {
  if (streamLive.value) return "实时";
  if (streamReconnecting.value) return "重连中";
  return "连接中";
});

const streamBadgeClass = computed(() => {
  if (streamLive.value) return "logs-page__badge--live";
  if (streamReconnecting.value) return "logs-page__badge--reconnect";
  return "logs-page__badge--pending";
});

const statusDetail = computed(() => {
  const parts: string[] = [];
  if (payload.value?.max != null) parts.push(`单次拉取上限 ${payload.value.max} 条`);
  parts.push(`历史条目 ${historyEntryCount.value} 条`);
  if (liveExtraCount.value) parts.push(`SSE 追加 ${liveExtraCount.value} 条（去重后）`);
  if (lastStreamEventId.value > 0) parts.push(`续传 ID ${lastStreamEventId.value}`);
  if (view.value === "feed") {
    parts.push(`级别筛选后 ${levelFilteredEntries.value.length} 条`);
  } else {
    parts.push(`原始行 ${lines.value.length} 行`);
  }
  if (payload.value?.sharded_logs) {
    parts.push(
      logSource.value === "all" ? "分片：已合并 hub/worker" : `分片：仅 ${logSource.value}`,
    );
  }
  if (q.value.trim()) parts.push(`关键词「${q.value.trim()}」`);
  return parts.join(" · ");
});

const levelCounts = computed(() => {
  liveTick.version.value;
  const counts: Record<LogEntryLevel, number> = {
    debug: 0,
    info: 0,
    success: 0,
    warn: 0,
    error: 0,
  };
  for (const entry of displayEntries.value) {
    counts[entry.level] += 1;
  }
  return counts;
});

const filteredRawLines = computed(() => {
  const rows = displayLines.value;
  if (enabledLevels.value.size >= LOG_ENTRY_LEVELS.length) return rows;
  return rows.filter((line) => entryPassesLevel(parseLogLineLevel(line)));
});

watch(
  [view, () => payload.value?.entries?.length, () => filtered.value.length, () => filteredRawLines.value.length],
  () => {
    scheduleScrollActiveLogToBottom();
  },
  { flush: "post" },
);

watch(
  () => liveTick.version.value,
  () => {
    scheduleScrollActiveLogToBottom(followLogTail.value);
  },
  { flush: "post" },
);

watch(
  () => [scope.value, logSource.value] as const,
  () => {
    lastStreamEventId.value = loadLogsLastEventId(scope.value, logSource.value);
  },
  { immediate: true },
);

watch(
  () => [scope.value, logSource.value, streamReconnectCount.value] as const,
  () => {
    startLogStream();
  },
);

onMounted(() => {
  applyLogsSnapshotCache();
  scheduleBootLogsPage();
});

onActivated(() => {
  applyLogsSnapshotCache();
  scheduleBootLogsPage();
});

function teardownLogsPage() {
  cancelLogBoot();
  if (logScrollBottomRaf && typeof window !== "undefined") {
    window.cancelAnimationFrame(logScrollBottomRaf);
    logScrollBottomRaf = 0;
  }
  stopLogPolling();
  closeLogStream();
}

onDeactivated(() => {
  teardownLogsPage();
});

onUnmounted(() => {
  teardownLogsPage();
});
</script>

<template>
  <div class="logs-page console-hub-page console-hub-page--fill">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="1"
    />
    <template v-else>
      <UiCard
        tag="div"
        glass
        class="logs-page__panel"
      >
        <div class="panel__hd logs-page__hd">
          <div class="panel__hd panel__hd--split logs-page__hd-split home-page__panel-hd-nowrap">
            <h2 class="panel__title">
              <ConsoleNavIcon
                class="panel__title-ico"
                :name="panelNavIcon"
                :size="20"
              />
              运行日志
            </h2>
            <div class="row-actions logs-page__hd-actions">
              <RefreshIconButton
                :busy="loading"
                label="刷新"
                @click="load"
              />
            </div>
          </div>
          <input
            v-model="q"
            class="inp logs-page__search"
            type="search"
            placeholder="搜索消息、scope、级别…"
            title="按消息、scope、级别等过滤"
          >
          <div class="logs-page__toolbar-row">
            <div class="logs-page__view-btns">
              <UiButton
                size="sm"
                :variant="view === 'feed' ? 'primary' : 'outline'"
                @click="view = 'feed'"
              >
                结构化
              </UiButton>
              <UiButton
                size="sm"
                :variant="view === 'raw' ? 'primary' : 'outline'"
                @click="view = 'raw'"
              >
                原始行
              </UiButton>
            </div>
            <UiButton
              class="logs-page__filter-toggle"
              size="sm"
              :variant="advancedOpen || activeFilterCount > 0 ? 'primary' : 'outline'"
              :aria-expanded="advancedOpen"
              @click="advancedOpen = !advancedOpen"
            >
              筛选<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span>
            </UiButton>
          </div>
          <div
            v-show="advancedOpen"
            class="logs-page__hd-advanced"
          >
            <div class="logs-page__filter-row form-toolbar">
              <label class="logs-page__field">
                <span class="logs-page__field-label">范围</span>
                <select
                  v-model="scope"
                  class="sel"
                  aria-label="日志范围"
                >
                  <option value="all">全部</option>
                  <option value="webui">WebUI</option>
                  <option value="protocol">协议</option>
                </select>
              </label>
              <label
                v-if="payload?.sharded_logs"
                class="logs-page__field"
              >
                <span class="logs-page__field-label">来源</span>
                <select
                  v-model="logSource"
                  class="sel"
                  aria-label="日志来源"
                >
                  <option
                    v-for="s in sourceOptions"
                    :key="`src-${s}`"
                    :value="s"
                  >
                    {{ s === "all" ? "全部来源" : s }}
                  </option>
                </select>
              </label>
              <label class="logs-page__field">
                <span class="logs-page__field-label">条数</span>
                <input
                  v-model.number="n"
                  class="inp logs-page__n-inp"
                  type="number"
                  min="20"
                  max="2000"
                  aria-label="拉取条数"
                >
              </label>
            </div>
          </div>
        </div>
        <div class="panel__bd">
          <div
            v-if="payload?.max != null"
            class="logs-page__status"
            :title="statusDetail"
          >
            <span
              class="logs-page__badge"
              :class="streamBadgeClass"
            >
              {{ streamBadgeLabel }}
            </span>
            <span class="logs-page__badge">历史 {{ historyEntryCount }}</span>
            <span
              v-if="liveExtraCount"
              class="logs-page__badge logs-page__badge--accent"
            >
              +{{ liveExtraCount }} 实时
            </span>
            <span class="logs-page__badge">显示 {{ visibleCount }}</span>
            <span
              v-if="activeFilterCount"
              class="logs-page__badge logs-page__badge--muted"
            >
              筛选中
            </span>
          </div>

          <div
            v-if="view === 'feed'"
            class="logs-page__level-bar"
          >
            <span class="logs-page__level-bar__label">日志级别:</span>
            <div
              class="logs-page__level-stats"
              role="group"
              aria-label="日志级别筛选"
            >
              <button
                v-for="lv in LOG_ENTRY_LEVELS"
                :key="`stat-${lv}`"
                type="button"
                class="logs-page__level-stat"
                :class="[
                  `logs-page__level-stat--${lv}`,
                  enabledLevels.has(lv) ? 'logs-page__level-stat--on' : 'logs-page__level-stat--off',
                ]"
                :aria-pressed="enabledLevels.has(lv)"
                @click="toggleLogLevel(lv)"
              >
                <span class="logs-page__level-stat__badge">{{ levelCounts[lv] > 0 ? levelCounts[lv] : '–' }}</span>
                <span class="logs-page__level-stat__label">{{ lv }}</span>
              </button>
            </div>
          </div>

          <div class="logs-page__scroll">
            <template v-if="view === 'feed'">
              <div
                v-if="!filtered.length && !loading"
                class="muted"
              >
                暂无条目（或筛选无结果）。
              </div>
              <LogVirtualFeed
                v-else
                ref="logFeedRef"
                :rows="filtered"
                :follow-tail="followLogTail"
                @scroll-state="onFeedScrollState"
              />
            </template>
            <template v-else>
              <div
                v-if="!lines.length && !loading"
                class="muted"
              >
                无原始行数据（后端可能仅返回结构化 entries）。
              </div>
              <div
                v-else-if="!filteredRawLines.length && !loading"
                class="muted"
              >
                暂无行（或级别/关键词筛选无结果）。
              </div>
              <pre
                v-else
                ref="rawScrollEl"
                class="pre-block pre-block--logs-tall"
                @scroll.passive="onRawScroll"
              >{{ filteredRawLines.join("\n") }}</pre>
            </template>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>
