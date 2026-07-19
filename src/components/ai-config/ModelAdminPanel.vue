<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  fetchLlmModelAdminStatus,
  fetchLlmProviderModels,
  postLlmModelAdminNumGpu,
  postLlmModelAdminReload,
  postLlmModelAdminSwitch,
  postLlmModelAdminUnload,
} from "@/api/consoleApi";
import type { LlmModelAdminStatus } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import AiConfirmDialog from "@/components/ai-config/AiConfirmDialog.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const props = withDefaults(defineProps<{ embedded?: boolean; simpleMode?: boolean }>(), {
  embedded: false,
  simpleMode: false,
});

type ConfirmAction = "switch" | "numGpu" | "reload" | "unload";

const status = ref<LlmModelAdminStatus | null>(null);
const loading = ref(false);
const busy = ref(false);
const err = ref("");
const draftModel = ref("");
const draftNumGpu = ref("");
const pullOnSwitch = ref(true);
/** 本地 Ollama 已安装模型名（用于下拉建议）；空表示尚未拉取 */
const localModels = ref<string[]>([]);
const SUGGESTED_MODELS = ["qwen2.5:7b", "qwen2.5:0.5b", "qwen3:8b"] as const;

const confirm = reactive<{ open: boolean; action: ConfirmAction | null; title: string; message: string; tone: "default" | "danger" }>({
  open: false,
  action: null,
  title: "",
  message: "",
  tone: "default",
});

const reachable = computed(() => status.value?.ai_reachable ?? false);
const statusSummary = computed(() => {
  const items: Array<{
    label: string;
    value: string | number;
    accent?: boolean;
    tone?: string;
  }> = [
    {
      label: "当前模型",
      value: loading.value ? "读取中…" : status.value?.model || "—",
      accent: true,
    },
    {
      label: "GPU 层数",
      value: loading.value ? "…" : status.value?.num_gpu ?? "—",
    },
    {
      label: "AI 服务",
      value: loading.value ? "检测中…" : reachable.value ? "可达" : "不可达",
      tone: loading.value ? "muted" : reachable.value ? "ok" : "warn",
    },
  ];
  if (!props.embedded) {
    items.push({
      label: "路由模式",
      value: status.value?.provider_mode || "—",
    });
  }
  return items;
});

async function refresh() {
  loading.value = true;
  err.value = "";
  try {
    const data = await fetchLlmModelAdminStatus();
    status.value = data;
    if (!draftModel.value.trim()) draftModel.value = data.model || "";
    if (draftNumGpu.value === "" && data.num_gpu != null) draftNumGpu.value = String(data.num_gpu);
  } catch (e) {
    err.value = axiosErrorDetail(e);
    status.value = null;
  }
  try {
    const result = await fetchLlmProviderModels("local");
    localModels.value = Array.isArray(result?.models)
      ? result.models.map((m) => String(m || "").trim()).filter(Boolean)
      : [];
  } catch {
    localModels.value = [];
  } finally {
    loading.value = false;
  }
}

const showEmptyModelGuide = computed(
  () => Boolean(status.value?.ai_reachable) && localModels.value.length === 0 && !loading.value,
);

function askSwitch() {
  const model = draftModel.value.trim();
  if (!model) {
    err.value = "请填写 Ollama 模型名，例如 qwen2.5:7b";
    return;
  }
  confirm.action = "switch";
  confirm.title = "切换模型";
  confirm.message = `切换为「${model}」？将先卸载常驻模型${pullOnSwitch.value ? "并尝试拉取" : ""}；无需重启后台任务。`;
  confirm.tone = "default";
  confirm.open = true;
}

function askNumGpu() {
  const raw = draftNumGpu.value.trim();
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0 || n > 999) {
    err.value = "GPU 层数须为 0–999 的整数";
    return;
  }
  confirm.action = "numGpu";
  confirm.title = "设置 GPU 层数";
  confirm.message = `将 GPU 层数设为 ${n}？会先卸载常驻权重，下次对话按新层数加载；无需重启后台任务。`;
  confirm.tone = "default";
  confirm.open = true;
}

function askReload() {
  confirm.action = "reload";
  confirm.title = "从配置重载";
  confirm.message = "从 AI 服务 .env 重载模型与 GPU 层数？将自动卸载常驻权重，无需重启后台任务。";
  confirm.tone = "default";
  confirm.open = true;
}

function askUnload() {
  confirm.action = "unload";
  confirm.title = "卸载模型";
  confirm.message = "卸载 Ollama 当前常驻模型？下次对话将按配置重新加载。";
  confirm.tone = "danger";
  confirm.open = true;
}

async function runConfirm() {
  const action = confirm.action;
  confirm.open = false;
  if (!action) return;
  busy.value = true;
  err.value = "";
  try {
    if (action === "switch") {
      const data = await postLlmModelAdminSwitch(draftModel.value.trim(), pullOnSwitch.value);
      draftModel.value = data.model;
      toastSaveSuccess(`已切换模型：${data.model}`);
    } else if (action === "numGpu") {
      const data = await postLlmModelAdminNumGpu(Number(draftNumGpu.value.trim()));
      if (data.model) draftModel.value = data.model;
      if (data.num_gpu != null) draftNumGpu.value = String(data.num_gpu);
      toastSaveSuccess(`已设置 GPU 层数：${data.num_gpu ?? draftNumGpu.value}`);
    } else if (action === "reload") {
      const data = await postLlmModelAdminReload();
      draftModel.value = data.model;
      if (data.num_gpu != null) draftNumGpu.value = String(data.num_gpu);
      toastSaveSuccess(`已重载：${data.model}`);
    } else if (action === "unload") {
      await postLlmModelAdminUnload();
      toastSaveSuccess("已请求卸载模型");
    }
    await refresh();
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "操作失败");
  } finally {
    busy.value = false;
    confirm.action = null;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <UiCard
    tag="section"
    :glass="!embedded"
    class="model-admin"
    :class="{ 'model-admin--embedded': embedded }"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">Ollama 与推理</h2>
      <UiButton
        variant="outline"
        size="sm"
        :disabled="busy || loading"
        @click="refresh"
      >
        刷新
      </UiButton>
    </div>

    <div class="panel__bd">
      <div class="model-admin__summary">
        <div
          v-for="item in statusSummary"
          :key="item.label"
          class="model-admin__summary-item"
        >
          <span class="model-admin__summary-label">{{ item.label }}</span>
          <strong
            class="model-admin__summary-value"
            :class="[
              item.accent ? 'model-admin__summary-value--accent' : '',
              item.tone === 'ok' ? 'ok' : '',
              item.tone === 'warn' ? 'warn' : '',
              item.tone === 'muted' ? 'muted' : '',
            ]"
          >
            {{ item.value }}
          </strong>
        </div>
      </div>

      <dl
        v-if="!embedded && !props.simpleMode && (status?.provider_mode || status?.categorizer_enabled || status?.moe_tier_routing)"
        class="model-admin__status"
      >
        <div
          v-if="status?.provider_mode"
          class="model-admin__status-row"
        >
          <dt>路由模式</dt>
          <dd>{{ status.provider_mode }}</dd>
        </div>
        <div
          v-if="status?.categorizer_enabled"
          class="model-admin__status-row"
        >
          <dt>请求分类</dt>
          <dd>{{ status.categorizer_model || "小模型" }}</dd>
        </div>
        <div
          v-if="status?.moe_tier_routing"
          class="model-admin__status-row"
        >
          <dt>按难度选模型</dt>
          <dd>已启用</dd>
        </div>
        <div
          v-if="status?.local_model_policy"
          class="model-admin__status-row"
        >
          <dt>本地模型策略</dt>
          <dd>{{ status.local_model_policy === "single_runtime" ? "单模型：当前运行模型优先" : "多模型：按任务与分档分流" }}</dd>
        </div>
      </dl>

      <p
        v-if="!embedded"
        class="muted model-admin__intro"
      >
        热切换本地模型与 GPU 层数；下方登记上游 Provider，专家模式页底可编辑任务路由与多模型分流。
      </p>
      <p
        v-else
        class="muted model-admin__intro model-admin__intro--embedded"
      >
        热切换当前 Ollama 模型与 GPU 层数；勾选「切换时拉取」可首次下载权重。
      </p>
      <p
        v-if="!embedded && status?.local_multi_model_enabled"
        class="muted model-admin__hint"
      >
        当前启用了本地多模型路由：切换上方「当前模型」后，部分本地请求仍可能按任务场景、分档或 Provider 默认模型分流。
      </p>

      <div
        v-if="showEmptyModelGuide"
        class="alert alert--warn model-admin__alert"
        role="status"
      >
        本地尚无 Ollama 模型。填写模型名（如 qwen2.5:7b），勾选「切换时拉取」后点切换即可下载；无需重启 AI 服务。
        <span class="model-admin__suggest">
          常用：
          <button
            v-for="name in SUGGESTED_MODELS"
            :key="name"
            type="button"
            class="model-admin__suggest-btn"
            :disabled="busy || loading"
            @click="draftModel = name"
          >
            {{ name }}
          </button>
        </span>
      </div>

      <div
        v-if="err"
        class="alert alert--err model-admin__alert"
        role="alert"
      >
        {{ err }}
      </div>

      <div class="model-admin__form">
        <label class="form-field">
          <span class="form-field__label">切换为</span>
          <input
            v-model="draftModel"
            class="inp"
            type="text"
            list="model-admin-local-models"
            placeholder="qwen2.5:7b"
            :disabled="busy || loading"
          >
          <datalist id="model-admin-local-models">
            <option
              v-for="name in localModels"
              :key="name"
              :value="name"
            />
          </datalist>
        </label>
        <label class="model-admin__check">
          <input
            v-model="pullOnSwitch"
            type="checkbox"
            :disabled="busy || loading"
          >
          切换时拉取模型
        </label>
        <label class="form-field model-admin__gpu">
          <span class="form-field__label">GPU 层数</span>
          <input
            v-model="draftNumGpu"
            class="inp"
            type="number"
            min="0"
            max="999"
            step="1"
            inputmode="numeric"
            placeholder="24"
            :disabled="busy || loading"
          >
        </label>
      </div>

      <div class="row-actions model-admin__actions">
        <UiButton
          variant="primary"
          :busy="busy"
          :disabled="busy || loading"
          @click="askSwitch"
        >
          切换模型
        </UiButton>
        <UiButton
          variant="outline"
          :disabled="busy || loading"
          @click="askNumGpu"
        >
          应用 GPU
        </UiButton>
        <UiButton
          v-if="!props.simpleMode"
          variant="outline"
          :disabled="busy || loading"
          @click="askReload"
        >
          从配置重载
        </UiButton>
        <UiButton
          v-if="!props.simpleMode"
          variant="destructive"
          :disabled="busy || loading"
          @click="askUnload"
        >
          卸载模型
        </UiButton>
      </div>

      <p
        v-if="status?.error && !err"
        class="muted model-admin__hint"
      >
        {{ status.error }}
      </p>
    </div>

    <AiConfirmDialog
      :open="confirm.open"
      :title="confirm.title"
      :message="confirm.message"
      :tone="confirm.tone"
      :busy="busy"
      :confirm-label="confirm.action === 'unload' ? '卸载' : '确定'"
      @close="confirm.open = false"
      @confirm="runConfirm"
    />
  </UiCard>
</template>

<style scoped>
.model-admin--embedded {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.model-admin__intro {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
}

.model-admin__intro--embedded {
  font-size: 0.78rem;
  line-height: 1.45;
  margin-bottom: 10px;
}

.model-admin--embedded .model-admin__summary {
  margin-bottom: 10px;
}

.model-admin--embedded .model-admin__summary-item {
  padding: 10px 12px;
}

.model-admin__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}

.model-admin__summary-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 20%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 6%, var(--card, var(--bg-card)));
}

.model-admin__summary-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-muted, #64748b);
}

.model-admin__summary-value {
  font-size: 0.98rem;
  font-weight: 700;
  word-break: break-word;
}

.model-admin__summary-value--accent {
  font-size: 1.05rem;
}

.model-admin__summary-value.ok {
  color: var(--ok, #3d9a5c);
}

.model-admin__summary-value.warn {
  color: var(--warn, #c9a227);
}

.model-admin__summary-value.muted {
  color: var(--text-muted, #64748b);
}

.model-admin__alert {
  margin-bottom: 12px;
}

.model-admin__suggest {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  align-items: center;
}

.model-admin__suggest-btn {
  border: 1px solid var(--border, #d0d5dd);
  background: var(--card, #fff);
  border-radius: 8px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  color: inherit;
}

.model-admin__suggest-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.model-admin__status {
  display: grid;
  gap: 8px;
  margin: 0 0 14px;
}

.model-admin__status-row {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 8px;
  align-items: baseline;
  font-size: 14px;
}

.model-admin__status-row dt {
  margin: 0;
  color: var(--text-muted, #64748b);
  font-weight: 600;
}

.model-admin__status-row dd {
  margin: 0;
  word-break: break-word;
}

.model-admin__form {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.form-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.form-field__label {
  font-weight: 600;
}

.form-field .inp {
  max-width: 420px;
}

.model-admin__gpu .inp {
  max-width: 160px;
}

.model-admin__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.model-admin__actions {
  flex-wrap: wrap;
  gap: 8px;
}

.model-admin__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 560px) {
  .form-field .inp,
  .model-admin__gpu .inp {
    max-width: none;
  }
}
</style>
