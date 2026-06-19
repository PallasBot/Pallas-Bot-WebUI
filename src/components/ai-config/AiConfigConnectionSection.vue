<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchAiExtensionConfig,
  postAiExtensionTest,
  putAiExtensionConfig,
} from "@/api/consoleApi";
import type { AiExtensionConfig, AiExtensionTestData } from "@/api/pallasTypes";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_EXTENSION_DEFAULTS } from "@/config/aiConstants";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const saving = ref(false);
const testOut = ref<AiExtensionTestData | null>(null);

const baseScheme = ref<"http" | "https">("http");
const baseHostPort = ref<string>(AI_EXTENSION_DEFAULTS.hostPort);
const apiPrefix = ref<string>(AI_EXTENSION_DEFAULTS.apiPrefix);
const token = ref("");
const healthPathsText = ref<string>(AI_EXTENSION_DEFAULTS.healthPaths.join("\n"));
const uvicornLogFile = ref("");
const celeryLogFile = ref("");
const timeoutSec = ref<number>(AI_EXTENSION_DEFAULTS.timeoutSec);

function parseBaseUrlParts(raw: string): { scheme: "http" | "https"; hostPort: string } {
  const s = (raw || "").trim();
  const m = s.match(/^(https?):\/\/([^/?#]+)/i);
  if (m) {
    const scheme = m[1].toLowerCase() === "https" ? "https" : "http";
    return { scheme, hostPort: m[2] };
  }
  const t = s.replace(/\/+$/, "");
  if (t && !/\s/.test(t)) {
    const hostPart = t.split("/")[0] ?? "";
    if (hostPart) return { scheme: "http", hostPort: hostPart };
  }
  return { scheme: "http", hostPort: AI_EXTENSION_DEFAULTS.hostPort };
}

function buildBaseUrl(scheme: "http" | "https", hostPort: string): string {
  const hp = hostPort.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!hp) return `${scheme}://${AI_EXTENSION_DEFAULTS.hostPort}`;
  return `${scheme}://${hp}`;
}

function hydrateFromConfig(c: AiExtensionConfig): void {
  const { scheme, hostPort } = parseBaseUrlParts(c.base_url);
  baseScheme.value = scheme;
  baseHostPort.value = hostPort;
  apiPrefix.value = c.api_prefix || AI_EXTENSION_DEFAULTS.apiPrefix;
  token.value = c.token || "";
  healthPathsText.value = (c.health_paths?.length ? c.health_paths : AI_EXTENSION_DEFAULTS.healthPaths).join("\n");
  uvicornLogFile.value = c.uvicorn_log_file || "";
  celeryLogFile.value = c.celery_log_file || "";
  timeoutSec.value = c.timeout_sec ?? AI_EXTENSION_DEFAULTS.timeoutSec;
}

function buildConfigPayload(): AiExtensionConfig {
  const paths = healthPathsText.value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const ap = apiPrefix.value.trim();
  const api_prefix = ap.startsWith("/") ? ap : `/${ap}`;
  const t = Math.min(
    AI_EXTENSION_DEFAULTS.timeoutMax,
    Math.max(AI_EXTENSION_DEFAULTS.timeoutMin, Math.floor(Number(timeoutSec.value)) || AI_EXTENSION_DEFAULTS.timeoutSec),
  );
  return {
    base_url: buildBaseUrl(baseScheme.value, baseHostPort.value),
    api_prefix,
    token: token.value,
    health_paths: paths.length ? paths : [...AI_EXTENSION_DEFAULTS.healthPaths],
    uvicorn_log_file: uvicornLogFile.value.trim(),
    celery_log_file: celeryLogFile.value.trim(),
    timeout_sec: t,
  };
}

async function load() {
  err.value = "";
  try {
    const c = await fetchAiExtensionConfig();
    hydrateFromConfig(c);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function save() {
  err.value = "";
  saving.value = true;
  try {
    const c = await putAiExtensionConfig(buildConfigPayload());
    hydrateFromConfig(c);
    toastSaveSuccess("连接配置已保存");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "保存失败");
  } finally {
    saving.value = false;
  }
}

async function runTest() {
  err.value = "";
  testOut.value = null;
  try {
    const r = await postAiExtensionTest();
    testOut.value = r;
    pushConsoleToast("连通测试完成", "ok");
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "连通测试失败");
  }
}

onMounted(() => {
  void load();
});

defineExpose({ save, canSave: () => !saving.value, saving });
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="ai-config-section__panel ai-config-connection"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">
        <ConsoleNavIcon
          class="panel__title-ico"
          :name="panelNavIcon"
        />扩展服务连接
      </h2>
      <div class="row-actions">
        <UiButton
          :disabled="saving"
          @click="load"
        >
          重新加载
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="saving"
          title="Ctrl+S"
          @click="save"
        >
          {{ saving ? "保存中…" : "保存" }}
        </UiButton>
        <UiButton
          :disabled="saving"
          @click="runTest"
        >
          连接诊断
        </UiButton>
      </div>
    </div>
    <div class="panel__bd">
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <p class="muted ai-config-section__intro">
        Bot 访问 Pallas-Bot-AI 扩展服务所用的地址与鉴权；保存后写入 <code>ai_extension.json</code>。日志路径供「扩展日志」页拉取片段。
        统一健康状态请优先查看「运行态总览」，这里的结果仅用于排查当前连接参数。
      </p>
      <div class="ai-config-connection__form">
        <div class="ai-config-connection__url-row">
          <div class="ai-config-connection__scheme form-field">
            <label class="form-field__label">协议</label>
            <select
              v-model="baseScheme"
              class="sel"
            >
              <option value="http">http</option>
              <option value="https">https</option>
            </select>
          </div>
          <div class="ai-config-connection__host form-field">
            <label class="form-field__label">主机与端口</label>
            <input
              v-model="baseHostPort"
              class="inp"
              type="text"
              autocomplete="off"
              placeholder="127.0.0.1:9099 或 [::1]:9099"
            >
          </div>
        </div>
        <div class="form-field">
          <label class="form-field__label">API 前缀</label>
          <input
            v-model="apiPrefix"
            class="inp ai-config-connection__inp--api"
            type="text"
            autocomplete="off"
            placeholder="/api"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">Bearer Token（可选）</label>
          <input
            v-model="token"
            class="inp ai-config-connection__inp--token"
            type="password"
            autocomplete="off"
            placeholder="留空表示不携带 Authorization"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">健康检查路径（每行一条）</label>
          <textarea
            v-model="healthPathsText"
            class="textarea"
            rows="3"
            spellcheck="false"
            style="width: 100%; max-width: 560px; font-family: ui-monospace, monospace; font-size: 12px"
          />
        </div>
        <div class="bot-config-edit__field">
          <label>请求超时（秒）</label>
          <input
            v-model.number="timeoutSec"
            class="inp ai-config-connection__inp--timeout"
            type="number"
            :min="AI_EXTENSION_DEFAULTS.timeoutMin"
            :max="AI_EXTENSION_DEFAULTS.timeoutMax"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">Web 服务日志路径</label>
          <input
            v-model="uvicornLogFile"
            class="inp"
            type="text"
            autocomplete="off"
            placeholder="例如 /var/log/pallas-ai/uvicorn.log"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">任务队列日志路径</label>
          <input
            v-model="celeryLogFile"
            class="inp"
            type="text"
            autocomplete="off"
            placeholder="例如 /var/log/pallas-ai/celery.log"
          >
        </div>
      </div>
      <div
        v-if="testOut"
        class="ai-config-connection__test-result"
      >
        <p class="muted ai-config-connection__test-label">连接诊断结果</p>
        <div class="ai-config-connection__diag-card">
          <div class="ai-config-connection__diag-head">
            <strong>{{ testOut.ok ? "扩展连接正常" : "扩展连接异常" }}</strong>
            <span
              class="tag"
              :class="testOut.ok ? 'tag--ok' : 'tag--warn'"
            >
              {{ testOut.ok ? "正常" : "异常" }}
            </span>
          </div>
          <div class="ai-config-connection__diag-grid">
            <div class="ai-config-connection__diag-row">
              <span class="muted">健康地址</span>
              <code>{{ testOut.health_url }}</code>
            </div>
            <div class="ai-config-connection__diag-row">
              <span class="muted">状态码</span>
              <span>{{ testOut.status_code ?? "无响应" }}</span>
            </div>
            <div
              v-if="testOut.error"
              class="ai-config-connection__diag-row ai-config-connection__diag-row--full"
            >
              <span class="muted">错误信息</span>
              <span>{{ testOut.error }}</span>
            </div>
            <div
              v-if="testOut.tried_urls?.length"
              class="ai-config-connection__diag-row ai-config-connection__diag-row--full"
            >
              <span class="muted">尝试地址</span>
              <div class="ai-config-connection__diag-list">
                <code
                  v-for="url in testOut.tried_urls"
                  :key="url"
                >{{ url }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.ai-config-connection__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-config-connection__url-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 14px;
  align-items: end;
}

.ai-config-connection__scheme {
  min-width: 0;
}

.ai-config-connection__host {
  min-width: 0;
}

.ai-config-connection__inp--api {
  max-width: 480px;
}

.ai-config-connection__inp--token {
  max-width: 520px;
}

.ai-config-connection__inp--timeout {
  max-width: 200px;
}

.ai-config-connection__test-result {
  margin-top: 16px;
}

.ai-config-connection__test-label {
  margin-bottom: 8px;
}

.ai-config-connection__diag-card {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--bg-card) 90%, white 10%), var(--bg-card));
}

.ai-config-connection__diag-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-config-connection__diag-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
  margin-top: 12px;
}

.ai-config-connection__diag-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ai-config-connection__diag-row--full {
  grid-column: 1 / -1;
}

.ai-config-connection__diag-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 720px) {
  .ai-config-connection__diag-grid {
    grid-template-columns: 1fr;
  }
}
</style>
