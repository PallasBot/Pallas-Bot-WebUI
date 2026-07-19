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
import LlmModelSelect from "@/components/ai-config/LlmModelSelect.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useLlmModelPickerOptions } from "@/composables/useLlmModelPickerOptions";
import { AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";
import { collectSavedRoutingModels } from "@/utils/llmModelOptionSources";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

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
const picker = useLlmModelPickerOptions();
const { discoveringModels } = picker;

const dirty = computed(() => JSON.stringify(draft.value) !== baseline.value);
const modelSelectGroups = computed(() =>
  picker.buildGroups({
    providers: providers.value,
    savedValues: collectSavedRoutingModels(draft.value),
  }),
);
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
    await picker.refreshPickerContext(providers.value);
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
    :glass="!compact"
    class="local-routing-panel"
    :class="{ 'local-routing-panel--compact': compact }"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">本地分流</h2>
      <div class="row-actions">
        <UiButton
          variant="outline"
          size="sm"
          :disabled="loading || discoveringModels || !providers.length"
          :busy="discoveringModels"
          @click="picker.discoverProviderModels(providers)"
        >
          {{ discoveringModels ? "发现中…" : "刷新模型列表" }}
        </UiButton>
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
          {{ saving ? "保存中…" : dirty ? "保存" : "已保存" }}
        </UiButton>
      </div>
    </div>

    <div class="panel__bd local-routing-panel__body">
      <p
        v-if="!compact"
        class="muted local-routing-panel__intro"
      >
        {{ AI_TASK_CONFIG_HINTS.routingIntro }}
        任务→Provider / 模型请在上方 Provider 区的「任务路由与模型」统一配置；本面板只管默认本地模型与多模型分档。
        保存写入 <code>.env</code>。
      </p>
      <p
        v-else
        class="muted local-routing-panel__intro local-routing-panel__intro--compact"
      >
        任务编排优先；未指定时按下方默认模型与分档。保存写入 <code>.env</code>。
      </p>

      <div
        v-if="!compact"
        class="local-routing-panel__rule-callout"
      >
        <strong>分流规则</strong>
        <span>任务编排优先；未指定任务模型且启用多模型分流时，才按简单 / 中等 / 复杂 / 视觉选择本地模型。</span>
      </div>

      <div
        v-if="err"
        class="alert alert--err"
      >
        {{ err }}
      </div>

      <div
        v-if="!compact"
        class="local-routing-panel__summary"
      >
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
          <h3 v-if="!compact">基础策略</h3>
          <label class="form-field">
            <span class="form-field__label">默认本地模型</span>
            <LlmModelSelect
              v-model="draft.llm_model"
              :groups="modelSelectGroups"
              empty-label="（回退当前运行模型）"
              :disabled="loading"
              aria-label="默认本地模型"
            />
          </label>
          <label class="form-field local-routing-panel__switch-field">
            <span class="form-field__label">多模型分流</span>
            <ConsoleSwitch
              :model-value="draft.local_multi_model_enabled"
              :show-label="false"
              aria-label="启用本地多模型分流"
              @update:model-value="(v) => (draft.local_multi_model_enabled = v)"
            />
            <span
              v-if="!compact"
              class="form-field__hint muted"
            >关闭时跟随当前运行模型；开启后未命中任务编排时按分档分流。</span>
          </label>
        </section>

        <section
          v-if="draft.local_multi_model_enabled || !compact"
          class="local-routing-panel__block"
        >
          <h3>分档模型</h3>
          <p
            v-if="!compact"
            class="muted local-routing-panel__block-hint"
          >
            按简单 / 中等 / 复杂 / 视觉选择模型；仅在启用多模型分流且任务编排没有指定模型时生效。
          </p>
          <div class="local-routing-panel__field-grid">
            <label
              v-for="row in moeRows"
              :key="row.tier"
              class="form-field"
            >
              <span class="form-field__label">{{ row.label }}</span>
              <LlmModelSelect
                v-model="draft.moe_models[row.tier]"
                :groups="modelSelectGroups"
                :disabled="loading"
                :aria-label="`${row.label} 分档模型`"
              />
            </label>
          </div>
        </section>
      </div>

      <div
        v-if="!compact"
        class="local-routing-panel__grid"
      >
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
          <h3>Provider 任务覆盖（摘要）</h3>
          <p class="muted local-routing-panel__block-hint">
            在上方 Provider 区「任务路由与模型」统一编辑；此处只读展示 Provider 配置中的结果。
          </p>
          <p
            v-if="!localProviderTaskModels.length"
            class="muted"
          >
            当前没有本地 provider 自身的任务覆盖。
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
.local-routing-panel--compact {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
}

.local-routing-panel--compact .local-routing-panel__body {
  gap: 12px;
}

.local-routing-panel--compact .local-routing-panel__block {
  padding: 12px;
}

.local-routing-panel--compact .local-routing-panel__intro--compact {
  font-size: 0.78rem;
  line-height: 1.45;
}

.local-routing-panel--compact :deep(.panel__hd--split) {
  flex-wrap: wrap;
  gap: 8px;
}

.local-routing-panel--compact :deep(.row-actions) {
  flex-wrap: wrap;
}

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

.local-routing-panel__rule-callout {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
}

.local-routing-panel__rule-callout strong {
  flex: 0 0 auto;
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

.local-routing-panel__block-hint {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.55;
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

  .local-routing-panel__rule-callout {
    flex-direction: column;
    gap: 4px;
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
