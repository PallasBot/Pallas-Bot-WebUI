<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { fetchAiExtensionLogs, openAiExtensionLogsEventSource } from "@/api/consoleApi";
import type { AiExtensionLogsData } from "@/api/pallasTypes";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import {
  AI_EXTENSION_DOCKER_LOG_MOUNT,
  AI_EXTENSION_LOG_KINDS,
  AI_LOG_DEFAULTS,
  type AiExtensionLogKind,
} from "@/config/aiConstants";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";
import { AI_ENTRY_RUNTIME } from "@/config/aiEntrySemantics";

const props = withDefaults(
  defineProps<{
    embedded?: boolean;
    defaultKind?: AiExtensionLogKind;
  }>(),
  {
    embedded: false,
    defaultKind: "uvicorn",
  },
);

const MAX_LIVE_LINES = 2000;

const panelNavIcon = usePanelNavIcon();
const logKind = ref<AiExtensionLogKind>(props.defaultKind);
const logLines = ref<number>(AI_LOG_DEFAULTS.lines);
const logData = ref<AiExtensionLogsData | null>(null);
const liveLines = ref<string[]>([]);
const livePath = ref("");
const logErr = ref("");
const busy = ref(false);
const liveMode = ref(true);
const streamLive = ref(false);
const streamReconnecting = ref(false);
const lastStreamEventId = ref(0);
const logListEl = ref<HTMLElement | null>(null);
const followLogTail = ref(true);

let logEs: EventSource | null = null;
let streamReconnectTimer: number | null = null;

const kindMeta = computed(() => AI_EXTENSION_LOG_KINDS.find((row) => row.id === logKind.value));

const lines = computed(() =>
  liveMode.value ? liveLines.value : (logData.value?.lines ?? []),
);

const displayPath = computed(() =>
  liveMode.value ? livePath.value || logData.value?.path || "" : logData.value?.path || "",
);

const logSourceLabel = computed(() => {
  const source = liveMode.value ? undefined : logData.value?.source;
  if (source === "remote") return "远端 HTTP";
  if (source === "local") return "本机文件";
  return "";
});

const dockerHintVisible = computed(
  () =>
    Boolean(logErr.value) &&
    (logErr.value.includes("不存在") ||
      logErr.value.includes("越界") ||
      logErr.value.includes("未找到") ||
      logErr.value.includes("远端")),
);

function stopLogStreamConnection() {
  if (logEs) {
    logEs.close();
    logEs = null;
  }
  streamLive.value = false;
}

function stopLogStream() {
  stopLogStreamConnection();
  if (streamReconnectTimer != null) {
    window.clearTimeout(streamReconnectTimer);
    streamReconnectTimer = null;
  }
  streamReconnecting.value = false;
}

function pushLiveLine(line: string) {
  liveLines.value.push(line);
  if (liveLines.value.length > MAX_LIVE_LINES) {
    liveLines.value.splice(0, liveLines.value.length - MAX_LIVE_LINES);
  }
}

function isLogListNearBottom(el: HTMLElement): boolean {
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  return gap <= Math.max(48, Math.floor(el.clientHeight * 0.12));
}

async function scrollLogListToBottom(force = false) {
  if (!force && !followLogTail.value) return;
  await nextTick();
  const el = logListEl.value;
  if (!el) return;
  const apply = () => {
    el.scrollTop = el.scrollHeight;
  };
  apply();
  if (typeof window !== "undefined") {
    window.requestAnimationFrame(() => {
      apply();
      window.requestAnimationFrame(apply);
    });
  }
}

function onLogListScroll() {
  const el = logListEl.value;
  if (!el) return;
  followLogTail.value = isLogListNearBottom(el);
}

function startLogStream() {
  stopLogStreamConnection();
  streamLive.value = false;
  streamReconnecting.value = false;
  logErr.value = "";
  try {
    const resumeId = lastStreamEventId.value > 0 ? lastStreamEventId.value : undefined;
    logEs = openAiExtensionLogsEventSource(logKind.value, resumeId);
    logEs.onopen = () => {
      streamLive.value = true;
      streamReconnecting.value = false;
    };
    logEs.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const row = JSON.parse(ev.data) as {
          type?: string;
          line?: string;
          path?: string;
          error?: string;
          kind?: string;
        };
        if (row.type === "ready") {
          if (row.path) livePath.value = row.path;
          void scrollLogListToBottom(true);
          return;
        }
        if (row.type === "error") {
          logErr.value = row.error || "日志流不可用";
          if (row.path) livePath.value = row.path;
          stopLogStreamConnection();
          return;
        }
        if (row.type === "line" && typeof row.line === "string") {
          if (row.path) livePath.value = row.path;
          pushLiveLine(row.line);
          void scrollLogListToBottom();
          if (ev.lastEventId) {
            const parsed = Number(ev.lastEventId);
            if (Number.isFinite(parsed) && parsed > 0) {
              lastStreamEventId.value = parsed;
            }
          }
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
        if (liveMode.value) startLogStream();
      }, 3000);
    };
  } catch (e) {
    logErr.value = e instanceof Error ? e.message : String(e);
    stopLogStreamConnection();
  }
}

async function loadLogs() {
  logErr.value = "";
  busy.value = true;
  try {
    logData.value = await fetchAiExtensionLogs(logKind.value, logLines.value);
    if (logData.value.error) logErr.value = logData.value.error;
  } catch (e) {
    logErr.value = e instanceof Error ? e.message : String(e);
    logData.value = null;
  } finally {
    busy.value = false;
    void scrollLogListToBottom(true);
  }
}

async function copyLogs() {
  const text = lines.value.join("\n");
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    pushConsoleToast("日志已复制到剪贴板", "ok");
  } catch (e) {
    toastApiError(e, "复制失败");
  }
}

function onToggleLive(on: boolean) {
  liveMode.value = on;
  if (on) {
    liveLines.value = [];
    lastStreamEventId.value = 0;
    startLogStream();
  } else {
    stopLogStream();
  }
}

watch(logKind, () => {
  lastStreamEventId.value = 0;
  liveLines.value = [];
  logData.value = null;
  logErr.value = "";
  followLogTail.value = true;
  if (liveMode.value) startLogStream();
});

watch(
  () => lines.value.length,
  () => {
    void scrollLogListToBottom();
  },
  { flush: "post" },
);

onMounted(() => {
  if (liveMode.value) startLogStream();
  void scrollLogListToBottom(true);
});

onBeforeUnmount(() => {
  stopLogStream();
});
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel"
    :class="{ 'ai-logs--embedded': embedded }"
  >
    <div class="panel__hd panel__hd--split ai-logs__hd">
      <h2 class="panel__title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />{{ embedded ? "服务日志" : "扩展日志" }}
      </h2>
      <div class="row-actions ai-logs__actions">
        <select
          v-model="logKind"
          class="sel"
          aria-label="日志类型"
        >
          <option
            v-for="row in AI_EXTENSION_LOG_KINDS"
            :key="row.id"
            :value="row.id"
          >
            {{ row.label }}
          </option>
        </select>
        <label class="ai-logs__live-toggle">
          <input
            type="checkbox"
            :checked="liveMode"
            @change="onToggleLive(($event.target as HTMLInputElement).checked)"
          />
          实时
        </label>
        <template v-if="!liveMode">
          <select
            v-model.number="logLines"
            class="sel"
            aria-label="拉取行数"
          >
            <option
              v-for="n in AI_LOG_DEFAULTS.lineOptions"
              :key="n"
              :value="n"
            >
              最近 {{ n }} 行
            </option>
          </select>
          <UiButton
            variant="primary"
            :busy="busy"
            @click="loadLogs"
          >
            拉取
          </UiButton>
        </template>
        <UiButton
          v-if="lines.length"
          @click="copyLogs"
        >
          复制
        </UiButton>
      </div>
    </div>
    <div class="panel__bd">
      <p
        v-if="embedded"
        class="muted ai-config-section__intro"
      >
        跟读 Pallas-Bot-AI 落盘日志（由 Bot 本机路径提供 SSE）。
        路径在 <RouterLink to="/ai/config/connection">AI 配置 · 媒体服务</RouterLink> 配置或留空自动探测。
      </p>
      <p
        v-else-if="!lines.length && !logErr && liveMode"
        class="muted ai-config-section__intro"
      >
        实时跟读扩展服务本地日志。也可在
        <RouterLink to="/ai/home#ai-service-logs">AI 观测</RouterLink>
        查看；路径在「媒体服务」配置。
      </p>
      <p
        v-else-if="!logData && !logErr && !liveMode"
        class="muted ai-config-section__intro"
      >
        选择日志类型与行数后点「拉取」。日常排障建议在
        <RouterLink to="/ai/home#ai-service-logs">AI 观测 · 服务日志</RouterLink>。
      </p>
      <div
        v-if="!lines.length && !logErr"
        class="ai-logs__links"
      >
        <RouterLink to="/ai/config/connection">配置日志路径</RouterLink>
        <RouterLink :to="AI_ENTRY_RUNTIME.path">{{ AI_ENTRY_RUNTIME.label }}</RouterLink>
      </div>
      <div
        v-if="logErr"
        class="alert alert--err ai-logs__err"
      >
        {{ logErr }}
      </div>
      <p
        v-if="dockerHintVisible"
        class="muted ai-logs__docker-hint"
      >
        Docker 部署请确认 compose 已将 AI 日志目录挂到 Bot 的
        <code>{{ AI_EXTENSION_DOCKER_LOG_MOUNT }}</code>，或在「媒体服务」填写 Bot 可读路径。
        远端 AI 需将日志共享到 Bot 本机；未本地启动 AI 时不会有落盘日志。
        容器内也可执行：<code>docker exec -it pallasbot-ai tail -f /server/logs/{{ logKind === 'uvicorn' ? 'uvicorn.log' : logKind === 'celery-media' ? 'celery-media.log' : 'celery.log' }}</code>
      </p>
      <div
        v-if="lines.length || displayPath"
        class="ai-logs__meta muted"
      >
        <span
          v-if="liveMode"
          class="ai-logs__status"
          :data-on="streamLive ? '1' : '0'"
        >
          {{ streamLive ? "已连接" : streamReconnecting ? "重连中…" : "未连接" }}
        </span>
        <span>{{ kindMeta?.shortLabel ?? logKind }}</span>
        <span v-if="logSourceLabel">{{ logSourceLabel }}</span>
        <code v-if="displayPath">{{ displayPath }}</code>
        <span>{{ lines.length }} 行</span>
      </div>
      <ol
        v-if="lines.length"
        ref="logListEl"
        class="ai-logs__list"
        @scroll.passive="onLogListScroll"
      >
        <li
          v-for="(line, idx) in lines"
          :key="idx"
          class="ai-logs__line"
        >
          <span class="ai-logs__lineno">{{ idx + 1 }}</span>
          <span class="ai-logs__text">{{ line }}</span>
        </li>
      </ol>
      <p
        v-else-if="logData && !liveMode"
        class="muted"
      >
        日志为空。
      </p>
    </div>
  </UiCard>
</template>

<style scoped>
.ai-logs__hd.panel__hd--split {
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ai-logs__hd > .panel__title {
  flex: 1 1 auto;
  min-width: 0;
}

.ai-logs__actions {
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 8px;
  margin-left: auto;
  max-width: 100%;
}

.ai-logs__actions > .sel {
  flex: 1 1 10rem;
  min-width: 0;
  max-width: min(100%, 16rem);
}

.ai-logs__live-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.8125rem;
  user-select: none;
}

.ai-logs__status[data-on="1"] {
  color: var(--ok, #2f9e44);
}

.ai-logs__err {
  margin-bottom: 10px;
}

.ai-logs__docker-hint {
  margin: 0 0 10px;
  font-size: 0.75rem;
  line-height: 1.55;
}

.ai-logs__docker-hint code {
  word-break: break-all;
}

.ai-logs__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-bottom: 10px;
  font-size: 0.8125rem;
}

.ai-logs__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  font-size: 0.75rem;
  margin-bottom: 10px;
}

.ai-logs__list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 460px;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.ai-logs--embedded .ai-logs__list {
  max-height: 360px;
}

.ai-logs__line {
  display: flex;
  gap: 12px;
  padding: 1px 12px;
}

.ai-logs__line:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.ai-logs__lineno {
  flex: 0 0 auto;
  width: 3ch;
  text-align: right;
  color: var(--text-muted);
  user-select: none;
}

.ai-logs__text {
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0;
}

/* 压过全局窄屏 .panel__hd .row-actions；含 select 需允许换行，不用 home-page__panel-hd-nowrap */
@media (max-width: 560px) {
  .ai-logs__hd.panel__hd--split {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .ai-logs__hd > .panel__title {
    width: auto;
    flex: 1 1 auto;
    min-width: 0;
  }

  .ai-logs__hd > .ai-logs__actions.row-actions {
    width: auto;
    max-width: 100%;
    margin-left: auto;
    flex: 1 1 12rem;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px 8px;
  }

  .ai-logs__hd > .ai-logs__actions > .sel {
    width: auto;
    min-width: 0 !important;
    max-width: 100%;
    flex: 1 1 9rem;
  }

  .ai-logs__hd > .ai-logs__actions :deep(.btn),
  .ai-logs__hd > .ai-logs__actions :deep(.ui-btn) {
    width: auto;
    flex: 0 0 auto;
    justify-content: center;
  }

  .ai-logs__live-toggle {
    flex: 0 0 auto;
  }
}
</style>
