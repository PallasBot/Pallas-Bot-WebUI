<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { fetchLogErrors, postLogErrorsCleanup, type LogErrorsData } from "@/api/consoleApi";
import type { MatcherErrorLogEntry } from "@/api/pallasTypes";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsoleHubSearch from "@/components/ConsoleHubSearch.vue";
import ConsoleHubToolbarStrip from "@/components/ConsoleHubToolbarStrip.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { formatLogDisplayTime } from "@/utils/logDisplay";
import {
  formatLogErrorExcType,
  formatLogErrorFull,
  formatLogErrorSummary,
  isTracebackTruncated,
  parseLogErrorPlugin,
} from "@/utils/logErrorDisplay";

let logErrorsCache: LogErrorsData | null = null;

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(Boolean(logErrorsCache));
const loading = ref(false);
const clearing = ref(false);
const entries = ref<MatcherErrorLogEntry[]>([]);
const logSources = ref<string[]>([]);
const shardedLogErrors = ref(false);
const logSource = ref("all");
const q = ref("");

async function load(opts?: { bypassCache?: boolean }) {
  loading.value = true;
  err.value = "";
  try {
    const stats = await fetchLogErrors(logSource.value, {
      tbLimit: 0,
      bypassCache: opts?.bypassCache === true,
    });
    logErrorsCache = stats;
    entries.value = stats.log_error_log ?? [];
    shardedLogErrors.value = Boolean(stats.sharded_log_errors);
    if (stats.log_error_sources?.length) {
      logSources.value = stats.log_error_sources;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    if (!entries.value.length) entries.value = [];
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
  displayExcType: string;
};

const displayEntries = computed((): ErrorRow[] => {
  const needle = q.value.trim().toLowerCase();
  const rows: ErrorRow[] = [...entries.value].reverse().map((it) => ({
    ...it,
    meta: parseLogErrorPlugin(it.plugin),
    displayExcType: formatLogErrorExcType(it.exc_type, it.traceback),
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

async function clearLogErrors() {
  if (clearing.value || loading.value || !entries.value.length) return;
  if (
    typeof window !== "undefined" &&
    !window.confirm("确定清空全部日志报错记录？将删除 log_errors.jsonl 与分片 errors 归档，不可恢复。")
  ) {
    return;
  }
  clearing.value = true;
  err.value = "";
  try {
    await postLogErrorsCleanup();
    entries.value = [];
    pushConsoleToast("已清理日志报错记录", "ok");
    await load();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    pushConsoleToast("清理失败", "err");
  } finally {
    clearing.value = false;
  }
}

onMounted(() => {
  void load();
});

onActivated(() => {
  if (logErrorsCache && !loading.value) {
    entries.value = logErrorsCache.log_error_log ?? [];
    shardedLogErrors.value = Boolean(logErrorsCache.sharded_log_errors);
    if (logErrorsCache.log_error_sources?.length) {
      logSources.value = logErrorsCache.log_error_sources;
    }
    pageReady.value = true;
  }
  void load();
});
</script>

<template>
  <div class="log-errors-page console-hub-page console-hub-page--fill">
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
      <ConsoleHubMasthead :icon="panelNavIcon">
        <template #title>
          日志报错
        </template>
        <template #lead>
          每条报错独立成卡；分片时可按来源筛选。「清理全部」与每日 4:00 自动清理中的日志报错部分一致。
        </template>
        <template #actions>
          <div class="console-hub-toolbar-strip__masthead-actions">
            <select
              v-if="shardedLogErrors"
              v-model="logSource"
              class="sel log-errors-page__source-sel"
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
            <UiButton
              variant="destructive"
              class="log-errors-page__clear-btn"
              :disabled="clearing || loading || !entries.length"
              :title="entries.length ? '清空 log_errors 与分片 errors 归档' : '暂无记录可清理'"
              @click="clearLogErrors"
            >
              {{ clearing ? "清理中…" : "清理全部" }}
            </UiButton>
            <RefreshIconButton
              :busy="loading"
              label="刷新"
              @click="load({ bypassCache: true })"
            />
          </div>
        </template>
      </ConsoleHubMasthead>

      <ConsoleHubSearch
        v-model="q"
        class="hub-search-wide-only"
        placeholder="搜索消息、类型、来源…"
      />

      <ConsoleHubToolbarStrip>
        <template #search>
          <ConsoleHubSearch
            v-model="q"
            placeholder="搜索消息、类型、来源…"
          />
        </template>
        <template #middle>
          <select
            v-if="shardedLogErrors"
            v-model="logSource"
            class="sel log-errors-page__source-sel log-errors-page__source-sel--strip"
            aria-label="报错来源"
          >
            <option
              v-for="s in sourceOptions"
              :key="`err-src-strip-${s}`"
              :value="s"
            >
              {{ s === "all" ? "全部来源" : s }}
            </option>
          </select>
          <UiButton
            variant="destructive"
            class="log-errors-page__clear-btn log-errors-page__clear-btn--strip"
            :disabled="clearing || loading || !entries.length"
            :title="entries.length ? '清空 log_errors 与分片 errors 归档' : '暂无记录可清理'"
            @click="clearLogErrors"
          >
            {{ clearing ? "清理中…" : "清理" }}
          </UiButton>
        </template>
        <template #actions>
          <RefreshIconButton
            :busy="loading"
            label="刷新"
            @click="load({ bypassCache: true })"
          />
        </template>
      </ConsoleHubToolbarStrip>

      <UiCard tag="div" glass class="log-errors-page__panel">
        <div class="panel__bd">
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
                  <span
                    class="log-error-card__type"
                    :title="it.exc_type !== it.displayExcType ? it.exc_type : undefined"
                  >{{ it.displayExcType }}</span>
                  <span class="log-error-card__source">
                    <span class="log-error-card__source-tag">{{ it.meta.source }}</span>
                    <span
                      v-if="it.meta.module && it.meta.module !== 'log'"
                      class="log-error-card__module"
                    >{{ it.meta.module }}</span>
                  </span>
                  <span
                    v-if="it.traceback?.trim() && isTracebackTruncated(it.traceback)"
                    class="log-error-card__trunc-badge muted"
                  >落盘时已截断</span>
                </header>
                <pre
                  v-if="it.traceback?.trim()"
                  class="log-error-card__tb log-error-card__tb--full"
                >{{ it.traceback }}</pre>
                <p
                  v-else
                  class="log-error-card__summary"
                >
                  {{ it.message || "（无摘要）" }}
                </p>
                <div class="log-error-card__actions">
                  <UiButton
                    variant="outline"
                    size="sm"
                    class="log-error-card__copy-btn"
                    title="复制时间与摘要"
                    @click="copySummary(it)"
                  >
                    复制摘要
                  </UiButton>
                  <UiButton
                    v-if="it.traceback?.trim()"
                    variant="outline"
                    size="sm"
                    class="log-error-card__copy-btn"
                    title="复制堆栈文本"
                    @click="copyTraceback(it)"
                  >
                    复制堆栈
                  </UiButton>
                  <UiButton
                    variant="outline"
                    size="sm"
                    class="log-error-card__copy-btn"
                    title="复制时间与完整堆栈"
                    @click="copyFull(it)"
                  >
                    复制全部
                  </UiButton>
                </div>
              </article>
            </div>
          </div>
        </div>
      </UiCard>
    </template>
  </div>
</template>
