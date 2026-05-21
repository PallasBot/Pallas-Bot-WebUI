<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchPluginRunStats } from "@/api/consoleApi";
import type { MatcherErrorLogEntry } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { formatLogDisplayTime } from "@/utils/logDisplay";
import {
  formatLogErrorFull,
  formatLogErrorSummary,
  isTracebackTruncated,
  parseLogErrorPlugin,
  tracebackLineCount,
} from "@/utils/logErrorDisplay";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const loading = ref(false);
const entries = ref<MatcherErrorLogEntry[]>([]);
const logSources = ref<string[]>([]);
const shardedLogErrors = ref(false);
const logSource = ref("all");
const q = ref("");
const expandAllTb = ref(false);

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const stats = await fetchPluginRunStats(undefined, logSource.value, { tbLimit: 0 });
    entries.value = stats.log_error_log ?? [];
    shardedLogErrors.value = Boolean(stats.sharded_log_errors);
    if (stats.log_error_sources?.length) {
      logSources.value = stats.log_error_sources;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    entries.value = [];
  } finally {
    loading.value = false;
    pageReady.value = true;
  }
}

watch(logSource, () => {
  void load();
});

const sourceOptions = computed(() => {
  const opts = logSources.value.length ? logSources.value : ["hub"];
  return ["all", ...opts.filter((s) => s !== "all")];
});

type ErrorRow = MatcherErrorLogEntry & {
  meta: ReturnType<typeof parseLogErrorPlugin>;
  tbLines: number;
};

const displayEntries = computed((): ErrorRow[] => {
  const needle = q.value.trim().toLowerCase();
  const rows: ErrorRow[] = [...entries.value].reverse().map((it) => ({
    ...it,
    meta: parseLogErrorPlugin(it.plugin),
    tbLines: tracebackLineCount(it.traceback ?? ""),
  }));
  if (!needle) return rows;
  return rows.filter((it) => {
    const hay = [
      it.message,
      it.exc_type,
      it.plugin,
      it.meta.source,
      it.meta.module,
      it.traceback,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
});

function cardKey(it: MatcherErrorLogEntry, idx: number): string {
  return `logerr-${it.at}-${idx}-${it.plugin}-${it.exc_type}`;
}

async function runCopy(label: string, text: string) {
  if (!(await copyTextToClipboard(text))) {
    pushConsoleToast("复制失败", "err");
    return;
  }
  pushConsoleToast(`已复制${label}`, "ok");
}

async function copySummary(it: ErrorRow) {
  const timeLabel = formatLogDisplayTime(it.at);
  await runCopy("摘要", formatLogErrorSummary(it, timeLabel));
}

async function copyTraceback(it: ErrorRow) {
  const tb = (it.traceback ?? "").trim();
  if (!tb) {
    pushConsoleToast("无堆栈内容", "warn");
    return;
  }
  await runCopy("堆栈", tb);
}

async function copyFull(it: ErrorRow) {
  const timeLabel = formatLogDisplayTime(it.at);
  await runCopy("全部", formatLogErrorFull(it, timeLabel));
}

onMounted(load);
</script>

<template>
  <div class="log-errors-page">
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
    <div
      v-else
      class="log-errors-page__body"
    >
      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>日志报错
            <RefreshIconButton
              :busy="loading"
              label="刷新"
              @click="load"
            />
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/log-errors" />
            <div
              v-if="displayEntries.some((it) => it.traceback)"
              class="log-errors-page__toolbar"
            >
              <label class="log-errors-page__expand-all">
                <input
                  v-model="expandAllTb"
                  type="checkbox"
                >
                展开全部堆栈
              </label>
            </div>
            <div class="log-errors-page__filter-row">
              <input
                v-model="q"
                class="inp"
                type="search"
                placeholder="搜索消息、类型、来源…"
              >
              <select
                v-if="shardedLogErrors"
                v-model="logSource"
                class="sel"
                aria-label="报错来源"
              >
                <option
                  v-for="s in sourceOptions"
                  :key="`err-src-${s}`"
                  :value="s"
                >
                  {{ s === "all" ? "全部来源" : s }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <div class="panel__bd">
          <p class="muted log-errors-page__hint">
            每条报错独立成卡：上方为时间与类型，正文为摘要；堆栈默认折叠。分片时按 hub / worker 筛选，数据来自 logs/errors/*.jsonl。
          </p>
          <div class="log-errors-page__scroll">
            <p
              v-if="loading && !entries.length"
              class="muted log-errors-page__empty"
            >
              加载中…
            </p>
            <p
              v-else-if="!displayEntries.length"
              class="muted log-errors-page__empty"
            >
              {{ entries.length && q ? "无匹配结果。" : "暂无报错记录。" }}
            </p>
            <div
              v-else
              class="log-errors-page__list"
            >
              <article
                v-for="(it, idx) in displayEntries"
                :key="cardKey(it, idx)"
                class="log-error-card"
              >
                <header class="log-error-card__hd">
                  <time class="log-error-card__time">{{ formatLogDisplayTime(it.at) }}</time>
                  <span class="log-error-card__type">{{ it.exc_type || "LogError" }}</span>
                  <span class="log-error-card__source">
                    <span class="log-error-card__source-tag">{{ it.meta.source }}</span>
                    <span
                      v-if="it.meta.module && it.meta.module !== 'log'"
                      class="log-error-card__module"
                    >{{ it.meta.module }}</span>
                  </span>
                </header>
                <div class="log-error-card__summary-row">
                  <p class="log-error-card__summary">
                    {{ it.message || "（无摘要）" }}
                  </p>
                  <div class="log-error-card__actions">
                    <button
                      type="button"
                      class="btn log-error-card__copy-btn"
                      title="复制时间与摘要"
                      @click="copySummary(it)"
                    >
                      复制摘要
                    </button>
                    <button
                      v-if="it.traceback?.trim()"
                      type="button"
                      class="btn log-error-card__copy-btn"
                      title="复制堆栈文本"
                      @click="copyTraceback(it)"
                    >
                      复制堆栈
                    </button>
                    <button
                      type="button"
                      class="btn log-error-card__copy-btn"
                      title="复制摘要与堆栈"
                      @click="copyFull(it)"
                    >
                      复制全部
                    </button>
                  </div>
                </div>
                <details
                  v-if="it.traceback?.trim()"
                  class="log-error-card__details"
                  :open="expandAllTb"
                >
                  <summary class="log-error-card__details-summary">
                    堆栈跟踪（{{ it.tbLines }} 行<template v-if="isTracebackTruncated(it.traceback)"> · 落盘时已截断</template>）
                  </summary>
                  <pre class="log-error-card__tb">{{ it.traceback }}</pre>
                </details>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
