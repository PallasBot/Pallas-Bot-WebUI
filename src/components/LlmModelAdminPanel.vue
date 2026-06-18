<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchLlmModelAdminStatus,
  fetchLlmProvidersConfig,
  fetchLlmTaskStats,
  postLlmModelAdminNumGpu,
  postLlmModelAdminReload,
  postLlmModelAdminSwitch,
  postLlmModelAdminUnload,
  putLlmProvidersConfig,
} from "@/api/consoleApi";
import type { LlmModelAdminStatus, LlmProvidersConfig, LlmTaskStatsData } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import {
  LLM_CLASSIFY_METRIC_LABELS,
  LLM_TASK_ROUTE_LABELS,
  llmTaskRouteLabel,
} from "@/config/aiConfigFieldLabels";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

withDefaults(
  defineProps<{
    /** 嵌入 AI 配置卡片内时去掉外层分隔线 */
    embedded?: boolean;
  }>(),
  { embedded: false },
);

const status = ref<LlmModelAdminStatus | null>(null);
const loading = ref(false);
const busy = ref(false);
const err = ref("");
const draftModel = ref("");
const draftNumGpu = ref("");
const pullOnSwitch = ref(true);
const providersDoc = ref<LlmProvidersConfig | null>(null);
const routeLlmChat = ref("");
const routeDrunk = ref("");
const routeRepeaterFallback = ref("");
const routeRepeaterPolish = ref("");

const taskStats = ref<LlmTaskStatsData | null>(null);

const taskLabelMap = LLM_TASK_ROUTE_LABELS;

const taskStatRows = [
  "llm_chat",
  "repeater_select",
  "repeater_polish_lite",
  "repeater_fallback",
  "repeater_polish",
] as const;

function metricOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0;
}

function taskLabel(task: string): string {
  return taskLabelMap[task] ?? task;
}

function gateSkipTotal(): number {
  const bot = taskStats.value?.bot;
  if (!bot?.by_task) return 0;
  return taskStatRows.reduce(
    (sum, task) => sum + metricOrZero(bot.by_task?.[task]?.reply_gate_skip),
    0,
  );
}

function gateDeferTotal(): number {
  const bot = taskStats.value?.bot;
  if (!bot?.by_task) return 0;
  return taskStatRows.reduce(
    (sum, task) => sum + metricOrZero(bot.by_task?.[task]?.reply_gate_defer),
    0,
  );
}

const classifyMetricLabels = LLM_CLASSIFY_METRIC_LABELS;

function classificationRows(): Array<{ key: string; label: string; count: number }> {
  const totals = taskStats.value?.ai?.classification?.totals;
  if (!totals) return [];
  return Object.entries(classifyMetricLabels)
    .map(([key, label]) => ({
      key,
      label,
      count: metricOrZero(totals[key as keyof typeof totals]),
    }))
    .filter((row) => row.count > 0);
}

function syncRouteDrafts(doc: LlmProvidersConfig | null) {
  const tasks = doc?.routing?.tasks ?? {};
  routeLlmChat.value = tasks.llm_chat ?? "";
  routeDrunk.value = tasks.drunk ?? "";
  routeRepeaterFallback.value = tasks.repeater_fallback ?? "";
  routeRepeaterPolish.value = tasks.repeater_polish ?? "";
}

async function loadProviders() {
  try {
    const doc = await fetchLlmProvidersConfig();
    providersDoc.value = doc;
    syncRouteDrafts(doc);
  } catch {
    providersDoc.value = null;
  }
}

async function loadTaskStats() {
  try {
    taskStats.value = await fetchLlmTaskStats();
  } catch {
    taskStats.value = null;
  }
}

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    const data = await fetchLlmModelAdminStatus();
    await Promise.all([loadProviders(), loadTaskStats()]);
    status.value = data;
    if (!draftModel.value.trim()) {
      draftModel.value = data.model || "";
    }
    if (draftNumGpu.value === "" && data.num_gpu != null) {
      draftNumGpu.value = String(data.num_gpu);
    }
  } catch (e) {
    err.value = axiosErrorDetail(e);
    status.value = null;
  } finally {
    loading.value = false;
  }
}

async function switchModel() {
  const model = draftModel.value.trim();
  if (!model) {
    err.value = "请填写 Ollama 模型名，例如 qwen3.5:9b";
    return;
  }
  if (
    !window.confirm(
      `切换为「${model}」？将先卸载 Ollama 常驻模型${pullOnSwitch.value ? "，并尝试拉取新模型" : ""}；无需重启 Celery。`,
    )
  ) {
    return;
  }
  busy.value = true;
  err.value = "";
  try {
    const data = await postLlmModelAdminSwitch(model, pullOnSwitch.value);
    draftModel.value = data.model;
    await refresh();
    toastSaveSuccess(`已切换模型：${data.model}`);
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "切换失败");
  } finally {
    busy.value = false;
  }
}

async function applyNumGpu() {
  const raw = draftNumGpu.value.trim();
  if (!raw) {
    err.value = "请填写 GPU 层数（0–999）";
    return;
  }
  const numGpu = Number(raw);
  if (!Number.isInteger(numGpu) || numGpu < 0 || numGpu > 999) {
    err.value = "GPU 层数须为 0–999 的整数";
    return;
  }
  if (
    !window.confirm(
      `将 GPU 层数设为 ${numGpu}？会先卸载 Ollama 常驻权重，下次 @ 对话按新层数加载；无需重启 Celery。`,
    )
  ) {
    return;
  }
  busy.value = true;
  err.value = "";
  try {
    const data = await postLlmModelAdminNumGpu(numGpu);
    if (data.model) {
      draftModel.value = data.model;
    }
    if (data.num_gpu != null) {
      draftNumGpu.value = String(data.num_gpu);
    }
    await refresh();
    toastSaveSuccess(`已设置 GPU 层数：${data.num_gpu ?? numGpu}`);
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "设置 GPU 层数失败");
  } finally {
    busy.value = false;
  }
}

async function reloadFromEnv() {
  if (!window.confirm("从 AI 服务 .env 重载模型与 GPU 层数？将自动卸载 Ollama 常驻权重，无需重启 Celery。")) {
    return;
  }
  busy.value = true;
  err.value = "";
  try {
    const data = await postLlmModelAdminReload();
    draftModel.value = data.model;
    if (data.num_gpu != null) {
      draftNumGpu.value = String(data.num_gpu);
    }
    await refresh();
    toastSaveSuccess(`已重载：${data.model}`);
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "重载失败");
  } finally {
    busy.value = false;
  }
}

async function unloadModel() {
  if (!window.confirm("卸载 Ollama 中当前常驻模型？下次对话将按配置重新加载。")) {
    return;
  }
  busy.value = true;
  err.value = "";
  try {
    await postLlmModelAdminUnload();
    await refresh();
    toastSaveSuccess("已请求卸载模型");
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "卸载失败");
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void refresh();
});

function providerReachLabel(reachable: boolean | null | undefined, configured: boolean): string {
  if (!configured) return "未配置";
  if (reachable === true) return "可达";
  if (reachable === false) return "不可达";
  return "—";
}

function providerReachClass(reachable: boolean | null | undefined, configured: boolean): string {
  if (!configured) return "warn";
  return reachable ? "ok" : "warn";
}

async function saveProviders() {
  if (!window.confirm("保存提供方与 task 路由到 AI 服务 providers.toml？无需重启 Celery。")) {
    return;
  }
  busy.value = true;
  err.value = "";
  try {
    const base = providersDoc.value ?? {
      providers: [],
      routing: { chain_fallback: [], tasks: {} },
      providers_file: "",
      file_exists: false,
    };
    const tasks: Record<string, string> = {};
    if (routeLlmChat.value.trim()) tasks.llm_chat = routeLlmChat.value.trim();
    if (routeDrunk.value.trim()) tasks.drunk = routeDrunk.value.trim();
    if (routeRepeaterFallback.value.trim()) tasks.repeater_fallback = routeRepeaterFallback.value.trim();
    if (routeRepeaterPolish.value.trim()) tasks.repeater_polish = routeRepeaterPolish.value.trim();
    const payload: LlmProvidersConfig = {
      ...base,
      routing: {
        chain_fallback: base.routing?.chain_fallback ?? [],
        tasks,
      },
    };
    await putLlmProvidersConfig(payload);
    await refresh();
    toastSaveSuccess("已保存提供方配置");
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "保存提供方配置失败");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section
    class="llm-model-admin"
    :class="{ 'llm-model-admin--embedded': embedded }"
    aria-labelledby="llm-model-admin-title"
  >
    <h3
      v-if="!embedded"
      id="llm-model-admin-title"
      class="llm-model-admin__title"
    >
      模型与推理
    </h3>
    <p
      v-if="!embedded"
      class="muted llm-model-admin__intro"
    >
      热切换本地 Ollama 模型并写入 AI 运行时配置；<strong>无需重启 Celery</strong>，切换时会自动卸载旧常驻权重。下方可单独调整 GPU 层数，或编辑各 task 对应的提供方路由。
    </p>
    <p
      v-else
      class="muted llm-model-admin__intro"
    >
      填写 Ollama 模型名后点「切换模型」；GPU 层数与提供方路由可在下方分别调整，均<strong>无需重启 Celery</strong>。
    </p>
    <div
      v-if="err"
      class="alert alert--err llm-model-admin__alert"
      role="alert"
    >
      {{ err }}
    </div>
    <div
      class="llm-model-admin__current"
      aria-live="polite"
    >
      <span class="llm-model-admin__current-label">当前模型</span>
      <strong class="llm-model-admin__current-value">
        {{ loading ? "读取中…" : status?.model || "—" }}
      </strong>
      <span class="llm-model-admin__current-meta muted">
        GPU {{ loading ? "…" : status?.num_gpu ?? "—" }}
        · AI 服务
        <span :class="status?.ai_reachable ? 'ok' : 'warn'">
          {{ loading ? "检测中…" : status?.ai_reachable ? "可达" : "不可达" }}
        </span>
      </span>
    </div>
    <dl
      v-if="status?.provider_mode || status?.categorizer_enabled || status?.moe_tier_routing"
      class="llm-model-admin__status"
    >
      <div
        v-if="status?.provider_mode"
        class="llm-model-admin__status-row"
      >
        <dt>路由模式</dt>
        <dd>{{ status.provider_mode }}</dd>
      </div>
      <div
        v-if="status?.categorizer_enabled"
        class="llm-model-admin__status-row"
      >
        <dt>请求分类</dt>
        <dd>{{ status.categorizer_model || "小模型" }}</dd>
      </div>
      <div
        v-if="status?.moe_tier_routing"
        class="llm-model-admin__status-row"
      >
        <dt>按难度选模型</dt>
        <dd>已启用</dd>
      </div>
    </dl>
    <div
      v-if="taskStats"
      class="llm-model-admin__task-stats"
    >
      <h4 class="llm-model-admin__providers-title">
        今日 LLM 任务统计
        <span class="muted">（{{ taskStats.bot.day_key || "—" }}）</span>
      </h4>
      <p class="muted llm-model-admin__routing-hint">
        计数仅在内存累加，约每 2 分钟落盘；AI 侧由 Celery 任务结束时统计，不占用消息热路径。
      </p>
      <div class="table-wrap">
        <table class="table llm-model-admin__providers-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>提交成功</th>
              <th>提交跳过</th>
              <th>回调成功</th>
              <th>回调失败</th>
              <th>AI 成功</th>
              <th>AI 失败</th>
              <th>门控跳过</th>
              <th>CD 排队</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="task in taskStatRows"
              :key="task"
            >
              <td>{{ taskLabel(task) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.submit_ok) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.submit_skip) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.callback_ok) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.callback_fail) }}</td>
              <td>{{ metricOrZero(taskStats.ai.by_task?.[task]?.task_ok) }}</td>
              <td>{{ metricOrZero(taskStats.ai.by_task?.[task]?.task_fail) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.reply_gate_skip) }}</td>
              <td>{{ metricOrZero(taskStats.bot.by_task?.[task]?.reply_gate_defer) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="gateSkipTotal() || gateDeferTotal()"
        class="muted llm-model-admin__routing-hint"
      >
        门控跳过 {{ gateSkipTotal() }} 次，CD 排队 {{ gateDeferTotal() }} 次。
      </p>
      <div
        v-if="taskStats.ai.tokens"
        class="llm-model-admin__token-stats"
      >
        <h4 class="llm-model-admin__providers-title">
          今日 Token 估算（AI）
          <span class="muted">（{{ taskStats.ai.tokens.day_key || "—" }}）</span>
        </h4>
        <p class="muted llm-model-admin__routing-hint">
          合计 {{ metricOrZero(taskStats.ai.tokens.total_tokens) }}（输入
          {{ metricOrZero(taskStats.ai.tokens.prompt_tokens) }} / 输出
          {{ metricOrZero(taskStats.ai.tokens.completion_tokens) }}），仅统计 provider 返回 usage 的请求。
        </p>
      </div>
      <div
        v-if="classificationRows().length"
        class="llm-model-admin__classify-stats"
      >
        <h4 class="llm-model-admin__providers-title">
          今日请求分类（AI）
          <span class="muted">（{{ taskStats.ai.day_key || "—" }}）</span>
        </h4>
        <dl class="llm-model-admin__status llm-model-admin__classify-grid">
          <div
            v-for="row in classificationRows()"
            :key="row.key"
            class="llm-model-admin__status-row"
          >
            <dt>{{ row.label }}</dt>
            <dd>{{ row.count }}</dd>
          </div>
        </dl>
      </div>
      <p
        v-if="!taskStats.ai_reachable"
        class="muted llm-model-admin__routing-hint warn"
      >
        AI 统计不可达{{ taskStats.error ? `：${taskStats.error}` : "" }}
      </p>
    </div>
    <div
      v-if="status?.provider_status?.length"
      class="llm-model-admin__providers"
    >
      <h4 class="llm-model-admin__providers-title">提供方状态</h4>
      <div class="table-wrap">
        <table class="table llm-model-admin__providers-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>类型</th>
              <th>模型</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in status.provider_status"
              :key="row.id"
            >
              <td>{{ row.id }}</td>
              <td>{{ row.kind }}</td>
              <td class="llm-model-admin__model-cell">{{ row.default_model || "—" }}</td>
              <td :class="providerReachClass(row.reachable, row.configured)">
                {{ providerReachLabel(row.reachable, row.configured) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="status.task_routing && Object.keys(status.task_routing).length"
        class="muted llm-model-admin__routing-hint"
      >
        当前 task 路由：
        <span
          v-for="(providerId, taskName) in status.task_routing"
          :key="taskName"
          class="llm-model-admin__routing-chip"
        >{{ llmTaskRouteLabel(String(taskName)) }}→{{ providerId }}</span>
      </p>
      <div class="llm-model-admin__route-form">
        <h4 class="llm-model-admin__providers-title">编辑 task 路由</h4>
        <p class="muted llm-model-admin__intro">
          填写提供方 id（如 local、deepseek）；保存后写入 AI 仓 config/providers.toml。
        </p>
        <div class="llm-model-admin__route-grid">
          <label class="llm-model-admin__label">@ 对话（llm_chat）</label>
          <input v-model="routeLlmChat" class="inp llm-model-admin__input" placeholder="local" />
          <label class="llm-model-admin__label">醉聊（drunk）</label>
          <input v-model="routeDrunk" class="inp llm-model-admin__input" placeholder="local" />
          <label class="llm-model-admin__label">接话兜底（repeater_fallback）</label>
          <input v-model="routeRepeaterFallback" class="inp llm-model-admin__input" placeholder="deepseek" />
          <label class="llm-model-admin__label">接话润色（repeater_polish）</label>
          <input v-model="routeRepeaterPolish" class="inp llm-model-admin__input" placeholder="deepseek" />
        </div>
        <div class="row-actions llm-model-admin__actions">
          <button type="button" class="btn btn--primary" :disabled="busy || loading" @click="saveProviders">
            保存提供方配置
          </button>
        </div>
        <p
          v-if="providersDoc?.providers_file"
          class="muted llm-model-admin__hint"
        >
          配置文件：{{ providersDoc.providers_file }}
        </p>
      </div>
    </div>
    <div class="llm-model-admin__form">
      <label class="llm-model-admin__label">
        <span>切换为</span>
        <input
          v-model="draftModel"
          class="inp llm-model-admin__input"
          type="text"
          placeholder="qwen3.5:9b"
          :disabled="busy || loading"
        >
      </label>
      <label class="llm-model-admin__check">
        <input
          v-model="pullOnSwitch"
          type="checkbox"
          :disabled="busy || loading"
        >
        切换时拉取模型
      </label>
      <div class="llm-model-admin__gpu-row">
        <label class="llm-model-admin__label llm-model-admin__label--gpu">
          <span>GPU 层数</span>
          <input
            v-model="draftNumGpu"
            class="inp llm-model-admin__input llm-model-admin__input--gpu"
            type="number"
            min="0"
            max="999"
            step="1"
            inputmode="numeric"
            placeholder="24"
            :disabled="busy || loading"
          >
        </label>
        <button
          type="button"
          class="btn llm-model-admin__gpu-btn"
          :disabled="busy || loading"
          :aria-busy="busy || undefined"
          @click="applyNumGpu"
        >
          应用 GPU
        </button>
      </div>
    </div>
    <div class="row-actions llm-model-admin__actions">
      <button
        type="button"
        class="btn"
        :disabled="busy || loading"
        @click="refresh"
      >
        刷新
      </button>
      <button
        type="button"
        class="btn btn--primary"
        :disabled="busy || loading"
        :aria-busy="busy || undefined"
        @click="switchModel"
      >
        {{ busy ? "处理中…" : "切换模型" }}
      </button>
      <button
        type="button"
        class="btn"
        :disabled="busy || loading"
        @click="reloadFromEnv"
      >
        从配置重载
      </button>
      <button
        type="button"
        class="btn btn--danger"
        :disabled="busy || loading"
        @click="unloadModel"
      >
        卸载模型
      </button>
    </div>
    <p
      v-if="status?.error && !err"
      class="muted llm-model-admin__hint"
    >
      {{ status.error }}
    </p>
    <p class="muted llm-model-admin__hint">
      上方可热改 GPU 层数（写入 AI 运行时，下次 @ 对话生效）。若需重启后仍保留默认值，请在 <strong>AI 服务 .env</strong> 改 <code>LLM_NUM_GPU</code> 后点「从配置重载」；<strong>无需重启 Celery</strong>。
    </p>
  </section>
</template>

<style scoped>
.llm-model-admin {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.llm-model-admin--embedded {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.llm-model-admin__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 700;
}

.llm-model-admin__intro {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.5;
}

.llm-model-admin__alert {
  margin-bottom: 12px;
}

.llm-model-admin__current {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0 0 14px;
  padding: 12px 14px;
  border-radius: calc(var(--radius-shell, 12px) * 0.65);
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 28%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 8%, var(--card, var(--bg-card)));
}

.llm-model-admin__current-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-muted, #64748b);
  letter-spacing: 0.02em;
}

.llm-model-admin__current-value {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
  color: var(--foreground, var(--text));
  word-break: break-word;
}

.llm-model-admin__current-meta {
  font-size: 12px;
  line-height: 1.45;
}

.llm-model-admin__current-meta .ok {
  color: var(--ok, #3d9a5c);
}

.llm-model-admin__current-meta .warn {
  color: var(--warn, #c9a227);
}

.llm-model-admin__status {
  display: grid;
  gap: 8px;
  margin: 0 0 14px;
}

.llm-model-admin__status-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  align-items: baseline;
  font-size: 14px;
}

.llm-model-admin__status-row dt {
  margin: 0;
  color: var(--text-muted, #64748b);
  font-weight: 600;
}

.llm-model-admin__status-row dd {
  margin: 0;
  word-break: break-word;
  color: var(--foreground, var(--text));
  font-weight: 500;
}

.llm-model-admin__status-row dd.ok {
  color: var(--ok, #3d9a5c);
}

.llm-model-admin__status-row dd.warn {
  color: var(--warn, #c9a227);
}

.llm-model-admin__form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.llm-model-admin__label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.llm-model-admin__input {
  width: 100%;
  max-width: 420px;
}

.llm-model-admin__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.llm-model-admin__gpu-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.llm-model-admin__label--gpu {
  flex: 1 1 160px;
  min-width: 0;
}

.llm-model-admin__input--gpu {
  max-width: 160px;
}

.llm-model-admin__gpu-btn {
  flex: 0 0 auto;
}

.llm-model-admin__actions {
  flex-wrap: wrap;
  gap: 8px;
}

.llm-model-admin__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.llm-model-admin__route-grid {
  display: grid;
  grid-template-columns: minmax(120px, 180px) 1fr;
  gap: 8px 12px;
  margin-bottom: 12px;
}

@media (max-width: 560px) {
  .llm-model-admin__route-grid {
    grid-template-columns: 1fr;
  }

  .llm-model-admin__route-grid > .llm-model-admin__input {
    max-width: none;
  }
}

.llm-model-admin__providers {
  margin-top: 12px;
}

.llm-model-admin__task-stats {
  margin-top: 12px;
}

.llm-model-admin__classify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px 16px;
}

.llm-model-admin__routing-hint.warn {
  color: var(--warn, #b45309);
}

.llm-model-admin__providers-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.llm-model-admin__providers-table td.ok {
  color: var(--ok, #2e7d32);
}

.llm-model-admin__providers-table td.warn {
  color: var(--warn, #b45309);
}

.llm-model-admin__model-cell {
  word-break: break-all;
}

.llm-model-admin__routing-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.llm-model-admin__routing-chip {
  display: inline-block;
  margin: 0 6px 4px 0;
}

@media (max-width: 560px) {
  .llm-model-admin__status-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .llm-model-admin__input {
    max-width: none;
  }

  .llm-model-admin__input--gpu {
    max-width: none;
  }

  .llm-model-admin__gpu-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .llm-model-admin__gpu-btn {
    width: 100%;
  }

  .llm-model-admin__actions > .btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }
}
</style>
