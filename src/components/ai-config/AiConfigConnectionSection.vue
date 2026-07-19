<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchAiInstallStatus,
  openAiInstallJobEventSource,
  postAiInstall,
  type AiInstallStatus,
} from "@/api/consoleApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { AI_EXTENSION_DEFAULTS, AI_EXTENSION_DOCKER_LOG_MOUNT } from "@/config/aiConstants";
import { AI_ENTRY_CONNECTION_DIAG, AI_ENTRY_RUNTIME } from "@/config/aiEntrySemantics";
import { useAiExtensionConnection } from "@/composables/useAiExtensionConnection";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError } from "@/utils/consoleToastFeedback";
import { InstallJobFailedError, waitForInstallJob } from "@/utils/installJobStream";

const panelNavIcon = usePanelNavIcon();
const conn = useAiExtensionConnection();
const {
  err,
  saving,
  testOut,
  baseScheme,
  baseHostPort,
  apiPrefix,
  token,
  healthPathsText,
  uvicornLogFile,
  celeryLogFile,
  celeryMediaLogFile,
  timeoutSec,
  load,
  save,
  runTest,
  canSave,
} = conn;

const installStatus = ref<AiInstallStatus | null>(null);
const installBusy = ref(false);
const installProgress = ref("");
const installErr = ref("");
const installOutputTail = ref("");
const installOutputOpen = ref(false);
const remoteOnly = ref(true);
const noStart = ref(false);

async function loadInstallStatus() {
  try {
    installStatus.value = await fetchAiInstallStatus();
  } catch {
    installStatus.value = null;
  }
}

function takeOutputTail(result: { output_tail?: string } | null | undefined): string {
  const raw = result?.output_tail;
  return typeof raw === "string" ? raw.trim() : "";
}

async function runInstall(action: "clone" | "bootstrap" | "clone_and_bootstrap") {
  installErr.value = "";
  installProgress.value = "";
  installOutputTail.value = "";
  installOutputOpen.value = false;
  installBusy.value = true;
  try {
    const job = await postAiInstall({
      action,
      no_start: noStart.value,
      remote_only: remoteOnly.value,
    });
    const complete = await waitForInstallJob(job.job_id, openAiInstallJobEventSource, (message) => {
      installProgress.value = message;
    });
    const result = complete.result ?? null;
    installOutputTail.value = takeOutputTail(result);
    const wroteExt = Boolean(result?.wrote_ai_extension);
    const wroteServer = Boolean(result?.wrote_ai_server);
    if (wroteExt || wroteServer) {
      pushConsoleToast("AI Runtime 安装完成，已写入默认连接", "ok");
    } else {
      pushConsoleToast("AI Runtime 安装任务完成", "ok");
    }
    await Promise.all([loadInstallStatus(), load()]);
  } catch (e) {
    if (e instanceof InstallJobFailedError) {
      installOutputTail.value = takeOutputTail(e.result);
      if (installOutputTail.value) {
        installOutputOpen.value = true;
      }
    }
    installErr.value = e instanceof Error ? e.message : String(e);
    toastApiError(e, "AI 安装失败");
  } finally {
    installBusy.value = false;
  }
}

onMounted(() => {
  void load();
  void loadInstallStatus();
});

defineExpose({ save, canSave, saving });
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
        />AI 服务连接
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
          @click="() => save()"
        >
          {{ saving ? "保存中…" : "保存" }}
        </UiButton>
        <UiButton
          :disabled="saving"
          @click="() => runTest()"
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
      <div class="ai-config-connection__install">
        <h3 class="ai-config-connection__install-title">安装 AI Runtime（源码）</h3>
        <p class="muted ai-config-section__intro">
          可一键克隆同级 <code>Pallas-Bot-AI</code> 并运行 <code>ai_bootstrap.sh</code>。Docker 不代跑，请按下方提示在宿主机执行。
        </p>
        <div
          v-if="installStatus"
          class="ai-config-connection__install-meta muted"
        >
          <span>{{ installStatus.detected ? "已检测到" : "未检测到" }} AI 仓</span>
          <code v-if="installStatus.ai_root || installStatus.clone_target">
            {{ installStatus.ai_root || installStatus.clone_target }}
          </code>
          <span v-if="!installStatus.git_available">本机无 git，无法克隆</span>
        </div>
        <div class="row-actions ai-config-connection__install-opts">
          <label class="ai-config-connection__opt">
            <input
              v-model="remoteOnly"
              type="checkbox"
            >
            remote-only（跳过本机 Ollama）
          </label>
          <label class="ai-config-connection__opt">
            <input
              v-model="noStart"
              type="checkbox"
            >
            仅安装不启动
          </label>
        </div>
        <div class="row-actions ai-config-connection__install-actions">
          <UiButton
            variant="primary"
            :busy="installBusy"
            :disabled="installBusy || (installStatus != null && !installStatus.can_clone && !installStatus.can_bootstrap)"
            @click="runInstall(installStatus?.can_clone ? 'clone_and_bootstrap' : 'bootstrap')"
          >
            {{ installStatus?.can_clone ? "克隆并安装" : "运行 bootstrap" }}
          </UiButton>
          <UiButton
            :disabled="installBusy"
            @click="loadInstallStatus"
          >
            刷新状态
          </UiButton>
        </div>
        <p
          v-if="installProgress"
          class="muted"
        >
          {{ installProgress }}
        </p>
        <div
          v-if="installErr"
          class="alert alert--err"
        >
          {{ installErr }}
        </div>
        <details
          v-if="installOutputTail"
          class="ai-config-connection__output"
          :open="installOutputOpen"
        >
          <summary>安装输出</summary>
          <pre class="ai-config-connection__output-pre">{{ installOutputTail }}</pre>
        </details>
        <pre
          v-if="installStatus?.docker_hint"
          class="ai-config-connection__docker-hint"
        >{{ installStatus.docker_hint }}</pre>
      </div>
      <p class="muted ai-config-section__intro">
        Bot 访问 <strong>Pallas-Bot-AI</strong> 的地址与鉴权（智能对话依赖此项）；保存后写入 <code>ai_extension.json</code>。日志路径供「扩展日志」页拉取片段。
        <strong>{{ AI_ENTRY_CONNECTION_DIAG.label }}</strong>：{{ AI_ENTRY_CONNECTION_DIAG.shortLead }}
      </p>
      <div class="ai-config-connection__links">
        <RouterLink :to="AI_ENTRY_RUNTIME.path">{{ AI_ENTRY_RUNTIME.label }}</RouterLink>
        <RouterLink to="/ai/config/logs">扩展日志</RouterLink>
        <RouterLink to="/ai/config/ncm">网易云登录</RouterLink>
      </div>
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
            placeholder="与 AI 侧 PALLAS_AI_API_TOKEN 一致；留空则不鉴权"
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
            :placeholder="`${AI_EXTENSION_DOCKER_LOG_MOUNT}/uvicorn.log`"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">任务队列日志 · LLM（default）</label>
          <input
            v-model="celeryLogFile"
            class="inp"
            type="text"
            autocomplete="off"
            :placeholder="`${AI_EXTENSION_DOCKER_LOG_MOUNT}/celery.log`"
          >
        </div>
        <div class="form-field">
          <label class="form-field__label">任务队列日志 · 媒体（media）</label>
          <input
            v-model="celeryMediaLogFile"
            class="inp"
            type="text"
            autocomplete="off"
            :placeholder="`${AI_EXTENSION_DOCKER_LOG_MOUNT}/celery-media.log`"
          >
        </div>
        <p class="muted ai-config-connection__log-hint">
          留空时 Bot 会按 uvicorn / api / app 与 celery / celery-media 自动探测。
          Docker 全栈请将 AI 日志卷挂到 Bot 的 <code>{{ AI_EXTENSION_DOCKER_LOG_MOUNT }}</code>（见 compose 注释）。
          实时查看请用 <RouterLink to="/ai/home#ai-service-logs">AI 观测 · 服务日志</RouterLink>。
        </p>
      </div>
      <div
        v-if="testOut"
        class="ai-config-connection__test-result"
      >
        <p class="muted ai-config-connection__test-label">AI 扩展诊断结果</p>
        <div class="ai-config-connection__diag-card">
          <div class="ai-config-connection__diag-head">
            <strong>{{ testOut.ok ? "AI 扩展在线" : "AI 扩展不可达" }}</strong>
            <span
              class="tag"
              :class="testOut.ok ? 'tag--ok' : 'tag--warn'"
            >
              {{ testOut.ok ? "在线" : "不可达" }}
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
.ai-config-connection__log-hint {
  margin: 4px 0 0;
  font-size: 0.75rem;
  line-height: 1.55;
}

.ai-config-connection__log-hint code {
  word-break: break-all;
}

.ai-config-connection__links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-bottom: 12px;
  font-size: 0.8125rem;
}

.ai-config-connection__install {
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}

.ai-config-connection__install-title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.ai-config-connection__install-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  font-size: 0.75rem;
  margin-bottom: 10px;
}

.ai-config-connection__install-meta code {
  word-break: break-all;
}

.ai-config-connection__install-opts {
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.ai-config-connection__install-actions {
  flex-wrap: wrap;
}

.ai-config-connection__opt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  user-select: none;
}

.ai-config-connection__output {
  margin-top: 10px;
  font-size: 0.8125rem;
}

.ai-config-connection__output summary {
  cursor: pointer;
  user-select: none;
}

.ai-config-connection__output-pre,
.ai-config-connection__docker-hint {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-x: auto;
  max-height: 240px;
  overflow-y: auto;
}

.ai-config-connection__docker-hint {
  margin-top: 12px;
  max-height: none;
}

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

@media (max-width: 560px) {
  .ai-config-connection__url-row {
    grid-template-columns: 1fr;
  }

  .ai-config-connection__install-actions.row-actions > :deep(.btn),
  .ai-config-connection__install-actions.row-actions > :deep(button) {
    flex: 1 1 auto;
    min-width: 0;
  }
}
</style>
