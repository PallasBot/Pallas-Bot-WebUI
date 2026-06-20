<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  fetchLlmLocalRoutingConfig,
  fetchLlmProvidersConfig,
  putLlmLocalRoutingConfig,
} from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type {
  LlmLocalRoutingConfig,
  LlmProviderConfigRow,
} from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

function emptyRouting(): LlmLocalRoutingConfig {
  return {
    llm_model: "",
    local_multi_model_enabled: false,
    moe_models: { simple: "", medium: "", complex: "", vision: "" },
    task_models: {
      llm_chat: "",
      drunk: "",
      repeater_fallback: "",
      repeater_polish: "",
      repeater_polish_lite: "",
      repeater_select: "",
    },
    env_file: "",
  };
}

const loading = ref(false);
const saving = ref(false);
const err = ref("");
const baseline = ref("");
const draft = ref<LlmLocalRoutingConfig>(emptyRouting());
const providers = ref<LlmProviderConfigRow[]>([]);

const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value);
const localProviders = computed(() => providers.value.filter((row) => row.kind === "local"));
const localProviderDefaults = computed(() =>
  localProviders.value
    .filter((row) => (row.default_model || "").trim())
    .map((row) => ({ id: row.id, model: row.default_model.trim() })),
);
const localProviderTaskModels = computed(() =>
  localProviders.value.flatMap((row) =>
    Object.entries(row.task_models || {})
      .filter(([, model]) => String(model || "").trim())
      .map(([task, model]) => ({ providerId: row.id, task, model: String(model).trim() })),
  ),
);
const taskRows = computed(() =>
  (Object.entries(draft.value.task_models) as Array<[keyof LlmLocalRoutingConfig["task_models"], string]>).map(([task, model]) => ({
    task,
    label: LLM_TASK_ROUTE_LABELS[task] ?? task,
    model,
  })),
);
const moeRows = computed(() =>
  (Object.entries(draft.value.moe_models) as Array<[keyof LlmLocalRoutingConfig["moe_models"], string]>).map(([tier, model]) => ({
    tier,
    label: tier === "vision" ? "视觉" : tier,
    model,
  })),
);
const strategyLabel = computed(() =>
  draft.value.local_multi_model_enabled ? "多模型分流" : "单模型跟随当前运行态",
);

function markClean() {
  baseline.value = JSON.stringify(draft.value);
}

async function load() {
  loading.value = true;
  err.value = "";
  try {
    const [routing, doc] = await Promise.all([
      fetchLlmLocalRoutingConfig(),
      fetchLlmProvidersConfig(),
    ]);
    draft.value = JSON.parse(JSON.stringify(routing)) as LlmLocalRoutingConfig;
    providers.value = doc.providers || [];
    markClean();
  } catch (e) {
    err.value = axiosErrorDetail(e);
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!dirty.value) return;
  saving.value = true;
  err.value = "";
  try {
    const saved = await putLlmLocalRoutingConfig(draft.value);
    draft.value = JSON.parse(JSON.stringify(saved)) as LlmLocalRoutingConfig;
    markClean();
    toastSaveSuccess("已保存本地模型路由配置");
  } catch (e) {
    err.value = axiosErrorDetail(e);
    toastApiError(e, "保存本地模型路由配置失败");
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <UiCard
    tag="section"
    glass
    class="local-routing-panel"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">本地模型路由 / MoE</h2>
      <div class="row-actions">
        <UiButton
          variant="outline"
          size="sm"
          :disabled="loading || saving"
          @click="load"
        >
          刷新
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :disabled="loading || saving || !dirty"
          :busy="saving"
          @click="save"
        >
          {{ saving ? "保存中…" : dirty ? "保存改动" : "已保存" }}
        </UiButton>
      </div>
    </div>

    <div class="panel__bd local-routing-panel__body">
      <p class="muted local-routing-panel__intro">
        这里编辑 AI 服务本地模型解析链，保存写入 <code>.env</code>。单模型模式下，主本地 provider 默认跟随“当前运行模型”；多模型模式下，task / MoE / provider 默认模型可继续分流。
      </p>

      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>

      <div class="local-routing-panel__summary">
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">当前策略</span>
          <strong class="local-routing-panel__summary-value">{{ loading ? "读取中…" : strategyLabel }}</strong>
        </div>
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">默认本地模型</span>
          <strong class="local-routing-panel__summary-value">{{ loading ? "读取中…" : draft.llm_model || "—" }}</strong>
        </div>
        <div class="local-routing-panel__summary-item">
          <span class="local-routing-panel__summary-label">配置文件</span>
          <strong class="local-routing-panel__summary-value">{{ loading ? "读取中…" : draft.env_file || "—" }}</strong>
        </div>
      </div>

      <div class="local-routing-panel__editor">
        <section class="local-routing-panel__block">
          <h3>基础策略</h3>
          <label class="form-field">
            <span class="form-field__label">默认本地模型</span>
            <input
              v-model="draft.llm_model"
              class="inp"
              placeholder="qwen3:8b"
            >
          </label>
          <label class="form-field local-routing-panel__switch-field">
            <span class="form-field__label">启用本地多模型分流</span>
            <ConsoleSwitch
              :model-value="draft.local_multi_model_enabled"
              :show-label="false"
              aria-label="启用本地多模型分流"
              @update:model-value="(v) => (draft.local_multi_model_enabled = v)"
            />
            <span class="form-field__hint muted">关闭时，主本地 provider 优先跟随当前运行模型；开启后，下方 task / MoE / provider 默认模型可能继续分流。</span>
          </label>
        </section>

        <section class="local-routing-panel__block">
          <h3>AI 侧 task 模型覆盖</h3>
          <div class="local-routing-panel__field-grid">
            <label
              v-for="row in taskRows"
              :key="row.task"
              class="form-field"
            >
              <span class="form-field__label">{{ row.label }}</span>
              <input
                v-model="draft.task_models[row.task]"
                class="inp"
                :placeholder="`${row.label} 不填则回退默认本地模型`"
              >
            </label>
          </div>
        </section>

        <section class="local-routing-panel__block">
          <h3>本地 MoE 模型</h3>
          <div class="local-routing-panel__field-grid">
            <label
              v-for="row in moeRows"
              :key="row.tier"
              class="form-field"
            >
              <span class="form-field__label">{{ row.label }}</span>
              <input
                v-model="draft.moe_models[row.tier]"
                class="inp"
                :placeholder="`${row.label} 不填则回退默认本地模型`"
              >
            </label>
          </div>
        </section>
      </div>

      <div class="local-routing-panel__grid">
        <section class="local-routing-panel__block">
          <h3>本地 Provider 默认模型</h3>
          <p
            v-if="!localProviderDefaults.length"
            class="muted"
          >
            当前没有额外的本地 provider 默认模型。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localProviderDefaults"
              :key="`provider-default-${row.id}`"
            >
              <code>{{ row.id }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>

        <section class="local-routing-panel__block">
          <h3>Provider 内 task 覆盖</h3>
          <p
            v-if="!localProviderTaskModels.length"
            class="muted"
          >
            当前没有本地 provider 自身的 task 覆盖。
          </p>
          <ul
            v-else
            class="local-routing-panel__list"
          >
            <li
              v-for="row in localProviderTaskModels"
              :key="`provider-task-${row.providerId}-${row.task}`"
            >
              <code>{{ row.providerId }} / {{ row.task }}</code>
              <span>{{ row.model }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.local-routing-panel__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.local-routing-panel__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.local-routing-panel__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.local-routing-panel__summary-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 14%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 4%, var(--card, var(--bg-card)));
}

.local-routing-panel__summary-label {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
}

.local-routing-panel__summary-value {
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.local-routing-panel__editor {
  display: grid;
  gap: 12px;
}

.local-routing-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.local-routing-panel__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--bg-card) 88%, transparent);
}

.local-routing-panel__block h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
}

.local-routing-panel__field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.local-routing-panel__switch-field {
  gap: 8px;
}

.local-routing-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.local-routing-panel__list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  font-size: 12px;
}

.local-routing-panel__list code {
  color: var(--text-muted, #94a3b8);
  word-break: break-word;
}

.local-routing-panel__list span {
  text-align: right;
  word-break: break-word;
}

@media (max-width: 560px) {
  .local-routing-panel__grid,
  .local-routing-panel__field-grid {
    grid-template-columns: 1fr;
  }

  .local-routing-panel__list li {
    align-items: flex-start;
    flex-direction: column;
  }

  .local-routing-panel__list span {
    text-align: left;
  }
}
</style>
