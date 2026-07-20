<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchLlmModelAdminStatus } from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import LlmModelSelect from "@/components/ai-config/LlmModelSelect.vue";
import ModelAdminPanel from "@/components/ai-config/ModelAdminPanel.vue";
import ProviderPresetPicker from "@/components/ai-config/providers/ProviderPresetPicker.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useLlmProviders } from "@/composables/useLlmProviders";
import {
  LLM_PROVIDER_PRESETS,
  applyPresetToDraft,
  findPresetByBaseUrl,
} from "@/config/llmProviderPresets";
import type { LlmProviderPresetId } from "@/config/llmProviderPresets";
import { buildLlmModelSelectGroups, collectSavedProviderModels } from "@/utils/llmModelOptionSources";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  TRAFFIC_ROUTE_PRESET_OPTIONS,
  buildTrafficChainFallback,
  buildTrafficRouteTasks,
  detectTrafficRoutePreset,
  trafficPresetSummary,
  type TrafficRoutePresetId,
} from "@/utils/trafficRoutePreset";

type AccessMode = "cloud" | "local";
type ResultTone = "ok" | "err" | "muted";

const providerStore = useLlmProviders();
const {
  doc,
  providers,
  saving,
  loading,
  err: providerErr,
  testStates,
  modelsStates,
} = providerStore;

const accessMode = ref<AccessMode>("cloud");
const trafficPreset = ref<TrafficRoutePresetId>("default_split");
const trafficPresetTouched = ref(false);
const localSaving = ref(false);
const selectedCloudId = ref("");
const selectedPresetId = ref<LlmProviderPresetId>("openai");
const customBaseUrl = ref("");
const cloudApiKey = ref("");
const defaultModel = ref("");
const localRuntimeModel = ref("");
const showAddVendor = ref(false);
const resultText = ref("选择已配置上游或添加服务商，再选定模型即可。");
const resultTone = ref<ResultTone>("muted");

const configuredCloudProviders = computed(() =>
  providers.value.filter((row) => row.kind !== "local" && row.id !== "local"),
);

const localProvider = computed(
  () => providers.value.find((row) => row.kind === "local" || row.id === "local") ?? null,
);

const dualUpstreamReady = computed(
  () => configuredCloudProviders.value.length > 0 && Boolean(localProvider.value),
);

const primaryProvider = computed(() => {
  const enabled = providers.value.filter((row) => row.enabled !== false);
  for (const id of doc.value.routing.chain_fallback) {
    const hit = enabled.find((row) => row.id === id);
    if (hit) return hit;
  }
  return enabled[0] ?? providers.value[0] ?? null;
});

const preferredCloudId = computed(() => {
  if (selectedCloudId.value && configuredCloudProviders.value.some((row) => row.id === selectedCloudId.value)) {
    return selectedCloudId.value;
  }
  const primary = primaryProvider.value;
  if (primary && primary.kind !== "local" && primary.id !== "local") return primary.id;
  return configuredCloudProviders.value[0]?.id || "";
});

const detectedTrafficPreset = computed(() => {
  const cloudId = preferredCloudId.value;
  const localId = localProvider.value?.id || "";
  if (!cloudId || !localId) return "custom" as const;
  return detectTrafficRoutePreset(doc.value.routing.tasks, cloudId, localId);
});

const trafficPresetHint = computed(() => {
  if (!dualUpstreamReady.value) return "两侧都配好后可选择流量预设";
  if (!trafficPresetTouched.value && detectedTrafficPreset.value === "custom") {
    return trafficPresetSummary("custom");
  }
  const preset = trafficPresetTouched.value ? trafficPreset.value : detectedTrafficPreset.value;
  return trafficPresetSummary(preset === "custom" ? trafficPreset.value : preset);
});

const activeTrafficPresetId = computed(() => {
  if (trafficPresetTouched.value) return trafficPreset.value;
  return detectedTrafficPreset.value === "custom" ? "" : detectedTrafficPreset.value;
});

const activeSourceLabel = computed(() => {
  const row = primaryProvider.value;
  if (!row) return "未配置";
  if (row.kind === "local" || row.id === "local") return "本地";
  return cloudProviderLabel(row);
});

const activeModelLabel = computed(() => {
  const row = primaryProvider.value;
  if (!row) return "尚未配置上游";
  if ((row.kind === "local" || row.id === "local") && localRuntimeModel.value) {
    return localRuntimeModel.value;
  }
  const model = (row.default_model || "").trim();
  return model || "未设置默认模型";
});

const selectedPreset = computed(
  () => LLM_PROVIDER_PRESETS.find((preset) => preset.id === selectedPresetId.value) ?? LLM_PROVIDER_PRESETS[0]!,
);

const existingProvider = computed(
  () => providers.value.find((row) => row.id === selectedCloudId.value) ?? null,
);

const isConfiguredSelection = computed(() => Boolean(existingProvider.value));

const providerHasStoredKey = computed(() =>
  Boolean(existingProvider.value?.api_key_set || existingProvider.value?.api_key_env),
);

const activeModelsState = computed(() => modelsStates.value[selectedCloudId.value]);
const simpleSaving = computed(() => saving.value || localSaving.value);
const simpleBusy = computed(() => loading.value || saving.value || localSaving.value);
const currentSaving = computed(() => (accessMode.value === "local" ? localSaving.value : saving.value));

const modelSelectGroups = computed(() =>
  buildLlmModelSelectGroups({
    providers: providers.value,
    discoveredByProvider: activeModelsState.value?.models?.length
      ? { [selectedCloudId.value]: activeModelsState.value.models }
      : {},
    savedValues: collectSavedProviderModels({
      default_model: defaultModel.value || existingProvider.value?.default_model || "",
      task_models: existingProvider.value?.task_models,
    }),
  }),
);

function cloudProviderLabel(row: LlmProviderConfigRow): string {
  const byId = LLM_PROVIDER_PRESETS.find((preset) => preset.id === row.id);
  if (byId) return byId.label;
  const byUrl = findPresetByBaseUrl(row.base_url || "");
  if (byUrl) return byUrl.label;
  return row.id;
}

function resolvePresetId(row: LlmProviderConfigRow): LlmProviderPresetId {
  const byId = LLM_PROVIDER_PRESETS.find((preset) => preset.id === row.id);
  if (byId) return byId.id;
  const byUrl = findPresetByBaseUrl(row.base_url || "");
  if (byUrl) return byUrl.id;
  return "custom";
}

function blankProvider(id: string): LlmProviderConfigRow {
  return {
    id,
    kind: selectedPreset.value.kind,
    base_url: "",
    api_key_env: "",
    api_key_set: false,
    default_model: "",
    enabled: true,
    task_models: {},
  };
}

function baseUrlForDraft(): string {
  if (existingProvider.value?.base_url?.trim() && selectedPresetId.value !== "custom") {
    return existingProvider.value.base_url.trim();
  }
  if (selectedPresetId.value === "custom") return customBaseUrl.value.trim();
  return selectedPreset.value.base_url || existingProvider.value?.base_url?.trim() || "";
}

function buildProviderRow(): LlmProviderConfigRow {
  const id = selectedCloudId.value || selectedPresetId.value;
  const existing = providers.value.find((row) => row.id === id);
  const presetRow = applyPresetToDraft(selectedPresetId.value, existing ?? blankProvider(id));
  return {
    ...presetRow,
    id,
    kind: selectedPreset.value.kind,
    base_url: baseUrlForDraft() || existing?.base_url || "",
    api_key: cloudApiKey.value.trim(),
    api_key_env: existing?.api_key_env ?? "",
    api_key_set: existing?.api_key_set ?? false,
    default_model: defaultModel.value.trim(),
    enabled: true,
    task_models: { ...(existing?.task_models || {}) },
  };
}

function buildLocalProviderRow(model: string): LlmProviderConfigRow {
  const existing = providers.value.find((row) => row.id === "local" || row.kind === "local");
  return {
    id: existing?.id || "local",
    kind: "local",
    base_url: existing?.base_url || "",
    api_key_env: existing?.api_key_env || "",
    api_key_set: existing?.api_key_set ?? false,
    default_model: model || existing?.default_model || "",
    enabled: true,
    task_models: { ...(existing?.task_models || {}) },
  };
}

function validateCloudDraft(): boolean {
  if (!baseUrlForDraft()) {
    resultTone.value = "err";
    resultText.value = "请填写 OpenAI 兼容 Base URL。";
    return false;
  }
  if (!defaultModel.value.trim()) {
    resultTone.value = "err";
    resultText.value = "请选择模型。";
    return false;
  }
  if (!cloudApiKey.value.trim() && !providerHasStoredKey.value) {
    resultTone.value = "err";
    resultText.value = "请填写 API Key；已保存密钥时可留空复用。";
    return false;
  }
  return true;
}

function upsertProvider(row: LlmProviderConfigRow) {
  const index = providers.value.findIndex((provider) => provider.id === row.id);
  if (index >= 0) providerStore.updateProvider(index, row);
  else providerStore.addProvider(row);
  const shouldApplyPreset =
    dualUpstreamReady.value
    && (trafficPresetTouched.value || detectedTrafficPreset.value !== "custom");
  if (shouldApplyPreset) {
    applyTrafficPreset(trafficPreset.value, row);
    return;
  }
  providerStore.setChainFallback([
    row.id,
    ...doc.value.routing.chain_fallback.filter((id) => id !== row.id),
  ]);
}

function applyTrafficPreset(preset: TrafficRoutePresetId, preferredRow?: LlmProviderConfigRow) {
  const local = localProvider.value;
  const cloudId =
    (preferredRow && preferredRow.kind !== "local" && preferredRow.id !== "local" ? preferredRow.id : "")
    || preferredCloudId.value
    || configuredCloudProviders.value[0]?.id
    || "";
  const localId = local?.id || "";
  if (!cloudId || !localId) return;
  providerStore.setRoutingTasks(buildTrafficRouteTasks(preset, cloudId, localId));
  providerStore.setChainFallback(
    buildTrafficChainFallback(preset, cloudId, localId, doc.value.routing.chain_fallback),
  );
  trafficPreset.value = preset;
}

async function selectTrafficPreset(preset: TrafficRoutePresetId) {
  trafficPresetTouched.value = true;
  applyTrafficPreset(preset);
  if (!dualUpstreamReady.value) return;
  providerErr.value = "";
  resultTone.value = "muted";
  resultText.value = "正在保存对话流量预设…";
  await providerStore.save();
  if (providerErr.value) {
    resultTone.value = "err";
    resultText.value = `保存流量预设失败：${providerErr.value}`;
    pushConsoleToast(resultText.value, "warn");
    return;
  }
  resultTone.value = "ok";
  resultText.value = `${trafficPresetSummary(preset)}，已保存。`;
  pushConsoleToast(resultText.value, "ok");
}

async function maybeDiscoverModels(providerId: string) {
  const row = providers.value.find((item) => item.id === providerId);
  if (!row) return;
  if (!(row.api_key_set || row.api_key_env)) return;
  await providerStore.discoverModels(providerId);
}

async function selectConfiguredProvider(id: string) {
  const row = providers.value.find((item) => item.id === id);
  if (!row) return;
  showAddVendor.value = false;
  selectedCloudId.value = row.id;
  selectedPresetId.value = resolvePresetId(row);
  customBaseUrl.value = resolvePresetId(row) === "custom" ? (row.base_url || "") : "";
  defaultModel.value = (row.default_model || "").trim();
  cloudApiKey.value = "";
  resultTone.value = "muted";
  resultText.value = row.default_model
    ? `已载入 ${cloudProviderLabel(row)}，可直接改模型或测通并保存。`
    : `已载入 ${cloudProviderLabel(row)}，请选择模型。`;
  await maybeDiscoverModels(row.id);
}

function selectPreset(id: LlmProviderPresetId) {
  const existing = providers.value.find((row) => row.id === id);
  if (existing) {
    void selectConfiguredProvider(existing.id);
    return;
  }
  selectedCloudId.value = id;
  selectedPresetId.value = id;
  customBaseUrl.value = id === "custom" ? customBaseUrl.value : "";
  defaultModel.value = "";
  cloudApiKey.value = "";
  resultTone.value = "muted";
  resultText.value = "填写密钥并选择模型后，可测通并保存。";
}

async function refreshModels() {
  const existing = existingProvider.value;
  if (existing && providerHasStoredKey.value && !cloudApiKey.value.trim()) {
    providerErr.value = "";
    await providerStore.discoverModels(existing.id);
    const state = modelsStates.value[existing.id];
    if (state?.error) {
      resultTone.value = "err";
      resultText.value = `模型刷新失败：${state.error}`;
      return;
    }
    resultTone.value = "ok";
    resultText.value = state?.models?.length
      ? `已刷新 ${state.models.length} 个模型。`
      : "已请求刷新，未发现可选模型。";
    return;
  }

  if (!validateCloudDraft()) return;
  providerErr.value = "";
  const row = buildProviderRow();
  upsertProvider(row);
  await providerStore.save();
  if (providerErr.value) {
    resultTone.value = "err";
    resultText.value = `保存 Provider 失败：${providerErr.value}`;
    return;
  }
  selectedCloudId.value = row.id;
  await providerStore.discoverModels(row.id);
  const state = modelsStates.value[row.id];
  if (state?.error) {
    resultTone.value = "err";
    resultText.value = `模型刷新失败：${state.error}`;
    return;
  }
  resultTone.value = "ok";
  resultText.value = state?.models?.length ? `已刷新 ${state.models.length} 个模型。` : "已请求刷新，未发现可选模型。";
}

async function saveAndTestCloud() {
  if (!validateCloudDraft()) {
    pushConsoleToast(resultText.value, "warn");
    return;
  }
  providerErr.value = "";
  resultTone.value = "muted";
  resultText.value = "正在保存并测通云端 Provider…";

  const row = buildProviderRow();
  upsertProvider(row);
  await providerStore.save();
  if (providerErr.value) {
    resultTone.value = "err";
    resultText.value = `保存 Provider 失败：${providerErr.value}`;
    return;
  }
  selectedCloudId.value = row.id;
  showAddVendor.value = false;
  await providerStore.testProvider(row.id);
  const state = testStates.value[row.id];
  if (state?.reachable) {
    resultTone.value = "ok";
    resultText.value = state.latencyMs != null
      ? `云端 Provider 已测通并保存，延迟 ${state.latencyMs}ms。`
      : "云端 Provider 已测通并保存。";
    pushConsoleToast(resultText.value, "ok");
    await maybeDiscoverModels(row.id);
    return;
  }
  resultTone.value = "err";
  resultText.value = state?.error ? `Provider 测试失败：${state.error}` : "Provider 测试失败，请检查密钥、模型或 Base URL。";
  pushConsoleToast(resultText.value, "warn");
}

async function saveAndTestLocal() {
  localSaving.value = true;
  providerErr.value = "";
  resultTone.value = "muted";
  resultText.value = "正在保存并测通本地 Ollama 接入…";
  try {
    const status = await fetchLlmModelAdminStatus();
    const row = buildLocalProviderRow(status.model || "");
    upsertProvider(row);
    await providerStore.save();
    if (providerErr.value) {
      resultTone.value = "err";
      resultText.value = `保存本地 Provider 失败：${providerErr.value}`;
      return;
    }
    await providerStore.testProvider(row.id);
    const state = testStates.value[row.id];
    if (state?.reachable || status.ai_reachable) {
      localRuntimeModel.value = (status.model || "").trim();
      resultTone.value = "ok";
      resultText.value = status.model
        ? `本地 Ollama 已测通并保存，当前模型：${status.model}。`
        : "本地 Ollama 已测通并保存。";
      pushConsoleToast(resultText.value, "ok");
      return;
    }
    resultTone.value = "err";
    resultText.value = state?.error || status.error || "本地 Ollama 测试失败，请检查模型服务。";
    pushConsoleToast(resultText.value, "warn");
  } catch (e) {
    resultTone.value = "err";
    resultText.value = `本地接入失败：${axiosErrorDetail(e)}`;
    pushConsoleToast(resultText.value, "warn");
  } finally {
    localSaving.value = false;
  }
}

function saveCurrentMode() {
  return accessMode.value === "local" ? saveAndTestLocal() : saveAndTestCloud();
}

function canSaveCloud() {
  return !simpleBusy.value;
}

function canSaveLocal() {
  return !simpleBusy.value;
}

function canSaveCurrentMode() {
  return accessMode.value === "local" ? canSaveLocal() : canSaveCloud();
}

async function hydrateFromExistingProviders() {
  const primary = primaryProvider.value;
  if (primary && (primary.kind === "local" || primary.id === "local")) {
    accessMode.value = "local";
  }

  const preferred =
    (primary && primary.kind !== "local" && primary.id !== "local" ? primary : null)
    ?? configuredCloudProviders.value.find((row) => row.enabled !== false)
    ?? configuredCloudProviders.value[0]
    ?? null;

  if (preferred) {
    showAddVendor.value = false;
    await selectConfiguredProvider(preferred.id);
  } else {
    showAddVendor.value = true;
    selectPreset(selectedPresetId.value);
  }

  const detected = detectedTrafficPreset.value;
  if (detected !== "custom") trafficPreset.value = detected;
  else trafficPreset.value = "default_split";
  trafficPresetTouched.value = false;
}

async function refreshLocalRuntimeModel() {
  try {
    const status = await fetchLlmModelAdminStatus();
    localRuntimeModel.value = (status.model || "").trim();
  } catch {
    localRuntimeModel.value = "";
  }
}

defineExpose({
  save: saveCurrentMode,
  saveCloud: saveAndTestCloud,
  saveLocal: saveAndTestLocal,
  canSave: canSaveCurrentMode,
  canSaveCloud,
  canSaveLocal,
  activeMode: () => accessMode.value,
  saving: currentSaving,
  simpleSaving,
});

onMounted(async () => {
  await providerStore.load();
  await hydrateFromExistingProviders();
  await refreshLocalRuntimeModel();
});
</script>

<template>
  <div class="simple-access-panel">
    <div
      class="simple-access-panel__active"
      role="status"
      aria-live="polite"
    >
      <span class="simple-access-panel__active-kicker">当前使用</span>
      <div class="simple-access-panel__active-main">
        <strong class="simple-access-panel__active-model">{{ loading ? "读取中…" : activeModelLabel }}</strong>
        <span class="simple-access-panel__active-source">{{ loading ? "…" : activeSourceLabel }}</span>
      </div>
      <p class="muted simple-access-panel__active-hint">
        {{ trafficPresetHint }}；改接入或预设后需「测通并保存」才会生效。
      </p>
    </div>

    <div
      v-if="dualUpstreamReady"
      class="simple-access-panel__traffic"
    >
      <div class="simple-access-panel__section-hd">
        <h3 class="simple-access-panel__section-title">对话流量</h3>
        <span
          v-if="detectedTrafficPreset === 'custom'"
          class="muted"
        >当前为专家模式自定义</span>
      </div>
      <div
        class="console-view-toggle simple-access-panel__traffic-segments"
        role="radiogroup"
        aria-label="对话流量预设"
      >
        <button
          v-for="opt in TRAFFIC_ROUTE_PRESET_OPTIONS"
          :key="opt.id"
          type="button"
          role="radio"
          :class="{ 'is-on': activeTrafficPresetId === opt.id }"
          :aria-checked="activeTrafficPresetId === opt.id"
          :title="opt.hint"
          :disabled="saving || loading || localSaving"
          @click="selectTrafficPreset(opt.id)"
        >
          {{ opt.label }}
        </button>
      </div>
      <p class="muted simple-access-panel__traffic-hint">
        {{ TRAFFIC_ROUTE_PRESET_OPTIONS.find((opt) => opt.id === trafficPreset)?.hint }}
        。点选后立即保存任务路由。
      </p>
    </div>

    <div
      class="console-view-toggle simple-access-panel__segments"
      role="tablist"
      aria-label="接入方式"
    >
      <button
        type="button"
        role="tab"
        :class="{ 'is-on': accessMode === 'cloud' }"
        :aria-selected="accessMode === 'cloud'"
        @click="accessMode = 'cloud'"
      >
        云端
      </button>
      <button
        type="button"
        role="tab"
        :class="{ 'is-on': accessMode === 'local' }"
        :aria-selected="accessMode === 'local'"
        @click="accessMode = 'local'"
      >
        本地
      </button>
    </div>

    <UiCard
      v-if="accessMode === 'cloud'"
      tag="section"
      glass
      class="simple-access-panel__card"
    >
      <div class="panel__hd panel__hd--split">
        <div>
          <h2 class="panel__title">云端模型接入</h2>
          <p class="muted simple-access-panel__intro">
            {{
              configuredCloudProviders.length
                ? "先点选已配置上游，直接换模型；需要新服务商再展开添加。"
                : "选择服务商，填写密钥并选择模型；保存前会测通 Provider。"
            }}
          </p>
        </div>
      </div>

      <div class="panel__bd simple-access-panel__body">
        <section
          v-if="configuredCloudProviders.length"
          class="simple-access-panel__configured"
          aria-label="已配置上游"
        >
          <div class="simple-access-panel__section-hd">
            <h3 class="simple-access-panel__section-title">已配置</h3>
            <button
              type="button"
              class="simple-access-panel__link-btn"
              @click="showAddVendor = !showAddVendor"
            >
              {{ showAddVendor ? "收起添加" : "添加服务商" }}
            </button>
          </div>
          <div
            class="simple-access-panel__configured-grid"
            role="listbox"
            aria-label="已配置云端上游"
          >
            <button
              v-for="row in configuredCloudProviders"
              :key="row.id"
              type="button"
              class="simple-access-panel__configured-item"
              :class="{ 'is-selected': selectedCloudId === row.id && !showAddVendor }"
              role="option"
              :aria-selected="selectedCloudId === row.id && !showAddVendor"
              @click="selectConfiguredProvider(row.id)"
            >
              <strong>{{ cloudProviderLabel(row) }}</strong>
              <span>{{ (row.default_model || "").trim() || "未设默认模型" }}</span>
              <span
                v-if="row.api_key_set || row.api_key_env"
                class="simple-access-panel__configured-badge"
              >密钥已保存</span>
            </button>
          </div>
        </section>

        <section
          v-if="showAddVendor || !configuredCloudProviders.length"
          class="simple-access-panel__add"
        >
          <h3
            v-if="configuredCloudProviders.length"
            class="simple-access-panel__section-title"
          >
            添加服务商
          </h3>
          <ProviderPresetPicker
            :selected-id="selectedPresetId"
            @select="selectPreset"
          />
        </section>

        <label
          v-if="selectedPresetId === 'custom'"
          class="form-field"
        >
          <span class="form-field__label">Base URL</span>
          <input
            v-model="customBaseUrl"
            class="inp"
            placeholder="https://gateway.example/v1"
            :disabled="saving || loading"
          >
        </label>

        <p
          v-if="isConfiguredSelection && selectedPresetId !== 'custom'"
          class="muted simple-access-panel__reuse-hint"
        >
          {{ cloudProviderLabel(existingProvider!) }}
          · {{ existingProvider?.base_url || "—" }}
        </p>

        <label class="form-field">
          <span class="form-field__label">API Key</span>
          <input
            v-model="cloudApiKey"
            class="inp"
            type="password"
            autocomplete="off"
            :placeholder="providerHasStoredKey ? '已配置，留空复用' : selectedPreset.auth_hint"
            :disabled="saving || loading"
          >
        </label>

        <div class="simple-access-panel__model-row">
          <label class="form-field simple-access-panel__model-field">
            <span class="form-field__label">模型</span>
            <LlmModelSelect
              v-model="defaultModel"
              :groups="modelSelectGroups"
              :allow-empty="false"
              empty-label="请选择模型"
              aria-label="模型"
              :disabled="saving || loading"
            />
          </label>
          <UiButton
            variant="outline"
            :busy="activeModelsState?.loading"
            :disabled="saving || loading || activeModelsState?.loading"
            @click="refreshModels"
          >
            刷新列表
          </UiButton>
        </div>

        <div
          v-if="providerErr"
          class="alert alert--err simple-access-panel__alert"
          role="alert"
        >
          {{ providerErr }}
        </div>

        <div class="row-actions simple-access-panel__actions">
          <UiButton
            variant="primary"
            :busy="saving"
            :disabled="!canSaveCloud()"
            @click="saveAndTestCloud"
          >
            测通并保存
          </UiButton>
        </div>
      </div>
    </UiCard>

    <UiCard
      v-else
      tag="section"
      glass
      class="simple-access-panel__card"
    >
      <div class="panel__hd panel__hd--split">
        <div>
          <h2 class="panel__title">本地 Ollama 接入</h2>
          <p class="muted simple-access-panel__intro">
            使用现有本地模型热切换能力；多模型路由稍后在专家模式中配置。
          </p>
        </div>
      </div>
      <div class="panel__bd simple-access-panel__local-body">
        <ModelAdminPanel
          simple-mode
          embedded
        />
        <div class="row-actions simple-access-panel__actions">
          <UiButton
            variant="primary"
            :busy="localSaving"
            :disabled="!canSaveLocal()"
            @click="saveAndTestLocal"
          >
            测通并保存
          </UiButton>
        </div>
      </div>
    </UiCard>

    <p
      class="simple-access-panel__result"
      :class="`simple-access-panel__result--${resultTone}`"
    >
      {{ resultText }}
    </p>
  </div>
</template>

<style scoped>
.simple-access-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.simple-access-panel__active {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-card, transparent));
}

.simple-access-panel__active-kicker {
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted, #64748b);
}

.simple-access-panel__active-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  min-width: 0;
}

.simple-access-panel__active-model {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-word;
}

.simple-access-panel__active-source {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--accent) 88%, var(--text));
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 24%, transparent);
}

.simple-access-panel__active-hint {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
}

.simple-access-panel__traffic {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-card, transparent) 92%, var(--border));
}

.simple-access-panel__traffic-segments {
  width: 100%;
}

.simple-access-panel__traffic-segments :deep(button),
.simple-access-panel__traffic-segments button {
  flex: 1 1 0;
  min-width: 0;
}

.simple-access-panel__traffic-hint {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
}

.simple-access-panel__segments {
  align-self: flex-start;
}

.simple-access-panel__intro {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.simple-access-panel__body {
  display: grid;
  gap: 14px;
}

.simple-access-panel__local-body {
  display: grid;
  gap: 16px;
}

.simple-access-panel__section-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.simple-access-panel__section-title {
  margin: 0 0 8px;
  font-size: 0.8rem;
  font-weight: 650;
  color: var(--text-muted, #64748b);
}

.simple-access-panel__section-hd .simple-access-panel__section-title {
  margin: 0;
}

.simple-access-panel__link-btn {
  border: 0;
  background: transparent;
  color: var(--accent, #3b82f6);
  font-size: 0.78rem;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

.simple-access-panel__configured-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.simple-access-panel__configured-item {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  border-radius: 14px;
  color: var(--text);
  background: color-mix(in srgb, var(--bg-card) 88%, transparent);
  cursor: pointer;
}

.simple-access-panel__configured-item:hover {
  border-color: color-mix(in srgb, var(--primary, var(--accent)) 45%, var(--border));
}

.simple-access-panel__configured-item.is-selected {
  border-color: color-mix(in srgb, var(--primary, var(--accent)) 72%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 10%, var(--bg-card));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary, var(--accent)) 24%, transparent);
}

.simple-access-panel__configured-item strong {
  font-size: 14px;
  font-weight: 700;
}

.simple-access-panel__configured-item span {
  font-size: 12px;
  color: var(--text-muted, #64748b);
  word-break: break-word;
}

.simple-access-panel__configured-badge {
  width: fit-content;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 0.68rem !important;
  font-weight: 600;
  color: color-mix(in srgb, #15803d 88%, var(--text)) !important;
  background: color-mix(in srgb, #22c55e 14%, transparent);
  border: 1px solid color-mix(in srgb, #22c55e 28%, transparent);
}

.simple-access-panel__reuse-hint {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  word-break: break-all;
}

.simple-access-panel__model-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) auto;
  gap: 10px;
  align-items: end;
}

.simple-access-panel__model-field {
  min-width: 0;
}

.simple-access-panel__alert {
  margin: 0;
}

.simple-access-panel__actions {
  margin-top: 0;
}

.simple-access-panel__result {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  font-size: 13px;
  line-height: 1.5;
}

.simple-access-panel__result--muted {
  color: var(--text-muted, #64748b);
  background: color-mix(in srgb, var(--text) 4%, transparent);
}

.simple-access-panel__result--ok {
  color: var(--ok, #3d9a5c);
  background: color-mix(in srgb, var(--ok, #3d9a5c) 9%, transparent);
  border-color: color-mix(in srgb, var(--ok, #3d9a5c) 24%, transparent);
}

.simple-access-panel__result--err {
  color: var(--warn, #c9a227);
  background: color-mix(in srgb, var(--warn, #c9a227) 9%, transparent);
  border-color: color-mix(in srgb, var(--warn, #c9a227) 28%, transparent);
}

@media (max-width: 560px) {
  .simple-access-panel__segments,
  .simple-access-panel__traffic-segments {
    display: flex;
    width: 100%;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .simple-access-panel__segments button,
  .simple-access-panel__traffic-segments button {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    padding-inline: 8px;
    font-size: 12px;
  }

  .simple-access-panel__configured-grid,
  .simple-access-panel__model-row {
    grid-template-columns: 1fr;
  }

  .simple-access-panel__actions :deep(.ui-btn),
  .simple-access-panel__model-row :deep(.ui-btn) {
    width: 100%;
    justify-content: center;
  }
}
</style>
