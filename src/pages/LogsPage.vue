<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from "vue";
import { fetchLogs, openLogsEventSource } from "@/api/consoleApi";
import type { LogEntry, LogScope, LogsData } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import {
  formatLogDisplayTime,
  logEntryLevelClass,
  stripYearFromLogLine,
} from "@/utils/logDisplay";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const loading = ref(false);
/** 运行中轮询间隔（毫秒）；隐藏标签页时跳过请求 */
const LOG_POLL_MS = 8000;
let logPollTimer: number | null = null;
const scope = ref<LogScope>("all");
const logSource = ref("all");
const logSources = ref<string[]>([]);
const n = ref(200);
const payload = ref<LogsData | null>(null);
const view = ref<"feed" | "raw">("feed");
const q = ref("");
/** SSE 追加的实时条目（分片 hub） */
const liveEntries = ref<LogEntry[]>([]);
const MAX_LIVE_ENTRIES = 600;

let logEs: EventSource | null = null;

const feedScrollEl = ref<HTMLElement | null>(null);
const rawScrollEl = ref<HTMLElement | null>(null);
const followLogTail = ref(true);

function logScrollThreshold(el: HTMLElement): number {
  const h = el.clientHeight;
  return Math.min(80, Math.max(24, Math.floor(h * 0.08)));
}

function isNearBottom(el: HTMLElement): boolean {
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  return gap <= logScrollThreshold(el);
}

function onLogContainerScroll(ev: Event) {
  const el = ev.target as HTMLElement | null;
  if (!el) return;
  followLogTail.value = isNearBottom(el);
}

async function scrollActiveLogToBottom() {
  await nextTick();
  const el = view.value === "feed" ? feedScrollEl.value : rawScrollEl.value;
  if (!el || !followLogTail.value) return;
  el.scrollTop = el.scrollHeight;
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

function closeLogStream() {
  if (logEs) {
    logEs.close();
    logEs = null;
  }
  liveEntries.value = [];
}

function pushLiveEntry(raw: LogEntry) {
  const id = Date.now() + Math.floor(Math.random() * 1000);
  liveEntries.value = [...liveEntries.value, { ...raw, id }].slice(-MAX_LIVE_ENTRIES);
}

function startLogStream() {
  closeLogStream();
  if (!payload.value?.sharded_logs) return;
  try {
    logEs = openLogsEventSource(scope.value, logSource.value);
    logEs.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const row = JSON.parse(ev.data) as LogEntry & { type?: string };
        if (row && typeof row === "object" && row.type === "ready") return;
        if (row.message != null) pushLiveEntry(row);
      } catch {
        /* ignore malformed */
      }
    };
    logEs.onerror = () => {
      closeLogStream();
    };
  } catch {
    closeLogStream();
  }
}

async function load(opts?: { silent?: boolean }) {
  const silent = Boolean(opts?.silent);
  if (!silent) loading.value = true;
  err.value = "";
  try {
    const src = logSource.value === "all" ? undefined : logSource.value;
    payload.value = await fetchLogs(n.value, scope.value, src);
    if (payload.value.log_sources?.length) {
      logSources.value = payload.value.log_sources;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    payload.value = null;
  } finally {
    if (!silent) loading.value = false;
    pageReady.value = true;
  }
}

watch([scope, n, logSource], () => {
  void load();
});

const baseEntries = computed(() => payload.value?.entries ?? []);
const entries = computed(() => {
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

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase();
  if (!needle) return entries.value;
  return entries.value.filter(
    (e) =>
      e.message.toLowerCase().includes(needle) ||
      e.scope.toLowerCase().includes(needle) ||
      e.level.toLowerCase().includes(needle) ||
      e.time.toLowerCase().includes(needle),
  );
});

watch(
  [view, () => payload.value, () => filtered.value, () => lines.value],
  async () => {
    await scrollActiveLogToBottom();
  },
  { flush: "post" },
);

watch(
  () => [payload.value?.sharded_logs, scope.value, logSource.value] as const,
  () => {
    startLogStream();
  },
);

onMounted(() => {
  void load();
});

onActivated(() => {
  if (pageReady.value) void load({ silent: true });
  startLogPolling();
  startLogStream();
});

onDeactivated(() => {
  stopLogPolling();
  closeLogStream();
});

onUnmounted(() => {
  stopLogPolling();
  closeLogStream();
});
</script>

<template>
  <div class="logs-page">
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="2"
    />
    <div
      v-else
      class="logs-page__body"
    >
      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>筛选与视图
            <RefreshIconButton
              :busy="loading"
              label="刷新日志"
              @click="load"
            />
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/logs" />
            <div class="logs-page__filter-row">
              <input
                v-model="q"
                class="inp"
                type="search"
                placeholder="关键词…"
                title="按消息、scope、级别等过滤"
              >
              <select
                v-if="payload?.sharded_logs"
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
              <select
                v-model="scope"
                class="sel"
                aria-label="日志范围"
              >
                <option value="all">全</option>
                <option value="webui">WebUI</option>
                <option value="protocol">协议</option>
              </select>
              <input
                v-model.number="n"
                class="inp logs-page__n-inp"
                type="number"
                min="20"
                max="2000"
              >
            </div>
            <div class="logs-page__view-btns">
              <button
                type="button"
                class="btn"
                :class="{ 'btn--primary': view === 'feed' }"
                @click="view = 'feed'"
              >
                结构化
              </button>
              <button
                type="button"
                class="btn"
                :class="{ 'btn--primary': view === 'raw' }"
                @click="view = 'raw'"
              >
                原始行
              </button>
            </div>
          </div>
        </div>
        <div class="panel__bd">
          <p
            v-if="payload?.max != null"
            class="muted"
            style="margin: 0 0 12px"
          >
            单次上限 {{ payload.max }} 条 · 当前返回 {{ entries.length }} 条条目 · 原始行 {{ lines.length }} 行
            <template v-if="payload.sharded_logs">
              · 分片：{{ logSource === "all" ? "已合并 hub/worker 主日志" : `仅 ${logSource}` }}
              · SSE 实时追加 worker 增量
            </template>
          </p>

          <div class="logs-page__scroll">
            <template v-if="view === 'feed'">
              <div
                v-if="!filtered.length && !loading"
                class="muted"
              >
                暂无条目（或筛选无结果）。
              </div>
              <div
                v-else
                ref="feedScrollEl"
                class="log-feed"
                @scroll.passive="onLogContainerScroll"
              >
                <div
                  v-for="row in filtered"
                  :key="row.id"
                  class="log-line"
                >
                  <span class="log-line__time">{{ formatLogDisplayTime(row.time) }}</span>
                  <span :class="logEntryLevelClass(row.level)">{{ row.level }}</span>
                  <span class="log-line__scope">[{{ row.scope }}]</span>
                  <span class="log-line__msg">{{ row.message }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <div
                v-if="!lines.length && !loading"
                class="muted"
              >
                无原始行数据（后端可能仅返回结构化 entries）。
              </div>
              <pre
                v-else
                ref="rawScrollEl"
                class="pre-block pre-block--logs-tall"
                @scroll.passive="onLogContainerScroll"
              >{{ displayLines.join("\n") }}</pre>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
