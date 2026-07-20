<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchAiInstallStatus,
  openAiInstallJobEventSource,
  postAiInstall,
  postAiRuntimeStart,
  postAiRuntimeStop,
  type AiInstallStatus,
} from "@/api/consoleApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import AiExtensionStatusBar from "@/components/ai-config/AiExtensionStatusBar.vue";
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
const runtimeBusy = ref(false);
const installProgress = ref("");
const installErr = ref("");
const installOutputTail = ref("");
const installOutputOpen = ref(false);
const remoteOnly = ref(true);
const withMedia = ref(false);
const useGpu = ref(false);
const noStart = ref(false);

const runtime = computed(() => installStatus.value?.runtime ?? null);
const runtimeRunning = computed(() => Boolean(runtime.value?.running));
const canManageRuntime = computed(() => Boolean(runtime.value?.can_manage));

function layoutLabel(layout: string | undefined): string {
  switch (layout) {
    case "managed":
      return "托管目录";
    case "sibling":
      return "同级仓库";
    case "env":
      return "PALLAS_AI_ROOT";
    case "docker":
      return "Docker / 远程连接";
    case "remote":
      return "远程连接";
    case "missing":
      return "未安装";
    default:
      return layout || "未知";
  }
}

function onRemoteOnlyChange() {
  if (remoteOnly.value) {
    withMedia.value = false;
    useGpu.value = false;
  }
}

function onWithMediaChange() {
  if (withMedia.value) {
    remoteOnly.value = false;
  } else {
    useGpu.value = false;
  }
}

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
      with_media: withMedia.value,
      use_gpu: useGpu.value,
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

async function runRuntimeStart() {
  runtimeBusy.value = true;
  installErr.value = "";
  try {
    await postAiRuntimeStart({ with_media: withMedia.value });
    pushConsoleToast("AI Runtime 已启动", "ok");
    await Promise.all([loadInstallStatus(), load()]);
  } catch (e) {
    toastApiError(e, "启动 AI Runtime 失败");
  } finally {
    runtimeBusy.value = false;
  }
}

async function runRuntimeStop() {
  runtimeBusy.value = true;
  installErr.value = "";
  try {
    await postAiRuntimeStop();
    pushConsoleToast("AI Runtime 已停止", "ok");
    await loadInstallStatus();
  } catch (e) {
    toastApiError(e, "停止 AI Runtime 失败");
  } finally {
    runtimeBusy.value = false;
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
        />媒体服务
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
      <AiExtensionStatusBar
        :connection="conn"
      />
      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>
      <div class="ai-config-connection__install">
        <h3 class="ai-config-connection__install-title">安装 / 连接 AI Runtime</h3>
        <p class="muted ai-config-section__intro">
          本机可安装到 <code>data/runtimes/pallas-bot-ai</code>。Docker 全栈请用 compose 起
          <code>pallasbot-ai</code>：控制台会探测 <code>AI_SERVER_*</code>，不在 Bot 容器内 clone。
        </p>
        <div
          v-if="installStatus"
          class="ai-config-connection__install-meta muted"
        >
          <span>{{ installStatus.detected ? "已检测到" : "未检测到" }} AI Runtime</span>
          <span>（{{ layoutLabel(installStatus.layout) }}）</span>
          <code v-if="installStatus.ai_root || installStatus.endpoint">
            {{
              installStatus.ai_root
                || (installStatus.endpoint
                  ? `${installStatus.endpoint.host}:${installStatus.endpoint.port}`
                  : installStatus.clone_target)
            }}
          </code>
          <span v-if="installStatus.in_docker">· Bot 在容器内</span>
          <span v-if="!installStatus.git_available && installStatus.can_clone">本机无 git，无法克隆</span>
        </div>
        <div
          v-if="runtime"
          class="ai-config-connection__runtime muted"
        >
          <span>进程：{{ runtimeRunning ? "运行中" : "未运行" }}</span>
          <span v-if="runtime.services?.api">· api {{ runtime.services.api.running ? "✓" : "—" }}</span>
          <span v-if="runtime.services?.llm">· llm {{ runtime.services.llm.running ? "✓" : "—" }}</span>
          <span v-if="runtime.services?.media">· media {{ runtime.services.media.running ? "✓" : "—" }}</span>
          <span>· health {{ runtime.health?.ok ? "✓" : "—" }}</span>
        </div>
        <div
          v-if="installStatus?.can_clone || installStatus?.can_bootstrap"
          class="row-actions ai-config-connection__install-opts"
        >
          <label class="ai-config-connection__opt">
            <input
              v-model="remoteOnly"
              type="checkbox"
              @change="onRemoteOnlyChange"
            >
            remote-only（跳过本机 Ollama）
          </label>
          <label class="ai-config-connection__opt">
            <input
              v-model="withMedia"
              type="checkbox"
              @change="onWithMediaChange"
            >
            含唱歌/TTS（--with-media）
          </label>
          <label class="ai-config-connection__opt">
            <input
              v-model="useGpu"
              type="checkbox"
              :disabled="!withMedia"
            >
            NVIDIA GPU torch
          </label>
          <label class="ai-config-connection__opt">
            <input
              v-model="noStart"
              type="checkbox"
            >
            仅安装不启动
          </label>
        </div>
        <p
          v-if="withMedia && remoteOnly && (installStatus?.can_clone || installStatus?.can_bootstrap)"
          class="muted"
        >
          已勾选媒体时会关闭 remote-only。
        </p>
        <p
          v-if="installStatus && !installStatus.can_clone && !installStatus.can_bootstrap"
          class="muted"
        >
          当前为连接已有 AI Runtime（Docker / 远程）；在宿主机用 compose 启停，无需在此 clone。
        </p>
        <p
          v-else
          class="muted"
        >
          媒体权重请到
          <RouterLink to="/ai/config/capabilities">能力包</RouterLink>
          查看或下载。
        </p>
        <div class="row-actions ai-config-connection__install-actions">
          <UiButton
            v-if="installStatus?.can_clone || installStatus?.can_bootstrap"
            variant="primary"
            :busy="installBusy"
            :disabled="installBusy || runtimeBusy || (installStatus != null && !installStatus.can_clone && !installStatus.can_bootstrap)"
            @click="runInstall(installStatus?.can_clone ? 'clone_and_bootstrap' : 'bootstrap')"
          >
            {{ installStatus?.can_clone ? "安装并启用" : "运行 bootstrap" }}
          </UiButton>
          <UiButton
            :busy="runtimeBusy"
            :disabled="installBusy || runtimeBusy || !canManageRuntime || runtimeRunning"
            @click="runRuntimeStart"
          >
            启动
          </UiButton>
          <UiButton
            :busy="runtimeBusy"
            :disabled="installBusy || runtimeBusy || !canManageRuntime || !runtimeRunning"
            @click="runRuntimeStop"
          >
            停止
          </UiButton>
          <UiButton
            :disabled="installBusy || runtimeBusy"
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
        Bot 访问 <strong>Pallas-Bot-AI</strong> 的地址与鉴权：唱歌/TTS 等媒体任务依赖此项；仅当
        <code>LLM_RUNTIME=ai_service</code> 时才影响聊天。默认 LLM 聊天走 Bot 内核 Provider，不必装 AI Runtime。保存后写入
        <code>ai_extension.json</code>。日志路径供「扩展日志」页拉取片段。
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
        <p class="muted ai-config-connection__test-label">AI Runtime 诊断结果</p>
        <div class="ai-config-connection__diag-card">
          <div class="ai-config-connection__diag-head">
            <strong>{{ testOut.ok ? "AI Runtime 在线" : "AI Runtime 不可达" }}</strong>
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
.ai-config-connection :deep(.panel__bd) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

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

.ai-config-connection__runtime {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 0.75rem;
  margin-bottom: 10px;
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
