<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink } from "vue-router";
import { fetchAiExtensionLogs } from "@/api/consoleApi";
import type { AiExtensionLogsData } from "@/api/pallasTypes";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_LOG_DEFAULTS } from "@/config/aiConstants";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";

const panelNavIcon = usePanelNavIcon();
const logKind = ref<"uvicorn" | "celery">("uvicorn");
const logLines = ref<number>(AI_LOG_DEFAULTS.lines);
const logData = ref<AiExtensionLogsData | null>(null);
const logErr = ref("");
const busy = ref(false);

const lines = computed(() => logData.value?.lines ?? []);

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
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />扩展日志
      </h2>
      <div class="row-actions ai-logs__actions">
        <select v-model="logKind" class="sel">
          <option value="uvicorn">Web 服务（uvicorn）</option>
          <option value="celery">任务队列（celery）</option>
        </select>
        <select v-model.number="logLines" class="sel" aria-label="拉取行数">
          <option v-for="n in AI_LOG_DEFAULTS.lineOptions" :key="n" :value="n">最近 {{ n }} 行</option>
        </select>
        <UiButton variant="primary" :busy="busy" @click="loadLogs">拉取</UiButton>
        <UiButton v-if="lines.length" @click="copyLogs">复制</UiButton>
      </div>
    </div>
    <div class="panel__bd">
      <p
        v-if="!logData && !logErr"
        class="muted ai-config-section__intro"
      >
        选择日志类型与行数后点「拉取」，读取扩展服务最近若干行日志。路径在「扩展连接」配置。
      </p>
      <div v-if="!logData && !logErr" class="ai-logs__links">
        <RouterLink to="/ai/config/connection">前往扩展连接</RouterLink>
        <RouterLink to="/ai/home">查看运行态总览</RouterLink>
      </div>
      <div
        v-if="logErr"
        class="alert alert--err ai-logs__err"
      >
        {{ logErr }}
      </div>
      <div v-if="logData" class="ai-logs__meta muted">
        <span>{{ logData.kind === "uvicorn" ? "Web 服务" : "任务队列" }}</span>
        <code>{{ logData.path }}</code>
        <span>{{ lines.length }} 行</span>
      </div>
      <ol v-if="lines.length" class="ai-logs__list">
        <li v-for="(line, idx) in lines" :key="idx" class="ai-logs__line">
          <span class="ai-logs__lineno">{{ idx + 1 }}</span>
          <span class="ai-logs__text">{{ line }}</span>
        </li>
      </ol>
      <p v-else-if="logData" class="muted">日志为空。</p>
    </div>
  </UiCard>
</template>

<style scoped>
.ai-logs__actions {
  flex-wrap: wrap;
  gap: 8px;
}

.ai-logs__err {
  margin-bottom: 10px;
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
</style>
