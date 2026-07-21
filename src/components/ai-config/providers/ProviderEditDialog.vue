<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import LlmModelSelect from "@/components/ai-config/LlmModelSelect.vue";
import ProviderPresetPicker from "@/components/ai-config/providers/ProviderPresetPicker.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import type { ProviderModelsState } from "@/composables/useLlmProviders";
import {
  LLM_PROVIDER_PRESETS,
  applyPresetToDraft,
  findPresetByBaseUrl,
} from "@/config/llmProviderPresets";
import type { LlmProviderPresetId } from "@/config/llmProviderPresets";
import {
  buildLlmModelSelectGroups,
  collectSavedProviderModels,
} from "@/utils/llmModelOptionSources";

const props = defineProps<{
  open: boolean;
  /** 编辑现有 provider 时传入；新增时为 null。 */
  row: LlmProviderConfigRow | null;
  /** 已存在的 provider id，用于新增时校验重名。 */
  existingIds: string[];
  /** 全部 Provider 登记（用于模型下拉聚合）。 */
  providers: LlmProviderConfigRow[];
  /** 当前 Ollama 运行模型。 */
  runtimeModel: string;
  /** 各 Provider 在线发现的模型。 */
  discoveredByProvider: Record<string, string[]>;
  /** 是否正在刷新模型列表。 */
  discoveringModels?: boolean;
  /** 当前编辑 Provider 的在线发现状态。 */
  modelsState?: ProviderModelsState;
}>();

const emit = defineEmits<{
  close: [];
  submit: [row: LlmProviderConfigRow];
  "refresh-models": [row: LlmProviderConfigRow];
}>();

const draft = ref<LlmProviderConfigRow>(blank());
const draftApiKey = ref("");
const useEnvVar = ref(false);
const localErr = ref("");

const isEdit = computed(() => props.row !== null);
const selectedPresetId = computed<LlmProviderPresetId>(() => {
  if (draft.value.kind === "local") return "custom";
  return findPresetByBaseUrl(draft.value.base_url)?.id ?? "custom";
});

function blank(): LlmProviderConfigRow {
  return {
    id: "",
    kind: "remote",
    base_url: "",
    api_key_env: "",
    api_key_set: false,
    default_model: "",
    enabled: true,
    task_models: {},
  };
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    localErr.value = "";
    draftApiKey.value = "";
    draft.value = props.row ? JSON.parse(JSON.stringify(props.row)) : blank();
    useEnvVar.value = Boolean(props.row?.api_key_env?.trim() && !props.row?.api_key_set);
  },
  { immediate: true },
);

const mergedDiscovered = computed(() => {
  const map = { ...props.discoveredByProvider };
  const id = draft.value.id.trim();
  if (id && props.modelsState?.models?.length) {
    map[id] = props.modelsState.models;
  }
  return map;
});

const savedModelValues = computed(() =>
  collectSavedProviderModels({
    default_model: draft.value.default_model,
    task_models: draft.value.task_models,
  }),
);

const modelSelectGroups = computed(() =>
  buildLlmModelSelectGroups({
    providers: props.providers,
    runtimeModel: props.runtimeModel,
    discoveredByProvider: mergedDiscovered.value,
    savedValues: savedModelValues.value,
  }),
);

function selectPreset(presetId: LlmProviderPresetId) {
  const preset = LLM_PROVIDER_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;
  const next = applyPresetToDraft(presetId, draft.value);
  draft.value = {
    ...next,
    id: isEdit.value || draft.value.id.trim() ? draft.value.id : preset.id,
    api_key_env: draft.value.api_key_env,
    api_key_set: draft.value.api_key_set,
    task_models: { ...(draft.value.task_models || {}) },
  };
  if (presetId !== "custom") localErr.value = "";
}

function buildDraftRow(): LlmProviderConfigRow | null {
  const id = draft.value.id.trim();
  if (!id) return null;
  const apiKeyInput = draftApiKey.value.trim();
  const apiKeyEnv = useEnvVar.value ? draft.value.api_key_env.trim() : "";
  return {
    id,
    kind: draft.value.kind,
    base_url: draft.value.base_url.trim(),
    api_key: apiKeyInput,
    api_key_env: apiKeyEnv,
    api_key_set: draft.value.api_key_set,
    default_model: draft.value.default_model.trim(),
    enabled: draft.value.enabled,
    task_models: { ...(draft.value.task_models || {}) },
  };
}

function refreshModels() {
  const row = buildDraftRow();
  if (!row) {
    localErr.value = "请先填写 Provider ID";
    return;
  }
  if (row.kind !== "local" && !row.base_url) {
    localErr.value = "远程 Provider 需要填写 Base URL";
    return;
  }
  localErr.value = "";
  emit("refresh-models", row);
}

function submit() {
  const row = buildDraftRow();
  if (!row) {
    localErr.value = "请填写 Provider ID";
    return;
  }
  const id = row.id;
  if (!isEdit.value && props.existingIds.includes(id)) {
    localErr.value = `Provider ID「${id}」已存在`;
    return;
  }
  if (draft.value.kind !== "local" && !draft.value.base_url.trim()) {
    localErr.value = "远程 Provider 需要填写 Base URL";
    return;
  }
  const apiKeyInput = draftApiKey.value.trim();
  const apiKeyEnv = useEnvVar.value ? draft.value.api_key_env.trim() : "";
  if (draft.value.kind !== "local") {
    const hasStoredKey = Boolean(isEdit.value && draft.value.api_key_set);
    if (!apiKeyInput && !apiKeyEnv && !hasStoredKey) {
      localErr.value = "请填写 API Key，或选择使用环境变量";
      return;
    }
  }
  emit("submit", row);
}

</script>

<template>
  <UiDialog
    :open="open"
    :title="isEdit ? `编辑 Provider · ${row?.id}` : '新增 Provider'"
    subtitle="远程 Provider 可直接填写 API Key；高级用户也可改用环境变量。"
    panel-class="provider-edit-dialog"
    @close="emit('close')"
  >
    <div
      v-if="localErr"
      class="alert alert--err provider-edit-dialog__alert"
    >
      {{ localErr }}
    </div>

    <div class="provider-edit-dialog__stack">
      <section
        v-if="draft.kind !== 'local'"
        class="provider-edit-dialog__section"
      >
        <div class="provider-edit-dialog__section-head">
          <strong>服务商预设</strong>
          <span class="muted">选择常见 OpenAI 兼容服务商后，会自动填入 Base URL。</span>
        </div>
        <ProviderPresetPicker
          :selected-id="selectedPresetId"
          @select="selectPreset"
        />
      </section>

      <section class="provider-edit-dialog__section">
        <div class="provider-edit-dialog__section-head">
          <strong>基础信息</strong>
          <span class="muted">先定义 Provider 标识与接入方式。</span>
        </div>
        <div class="provider-edit-dialog__grid">
          <label class="form-field">
            <span class="form-field__label">Provider ID</span>
            <input
              v-model="draft.id"
              class="inp"
              :disabled="isEdit"
              placeholder="local / openai-compatible"
            >
            <span class="form-field__hint muted">唯一标识；local 为内置本地后端。</span>
          </label>

          <label class="form-field">
            <span class="form-field__label">类型</span>
            <select
              v-model="draft.kind"
              class="inp provider-edit-dialog__select"
            >
              <option value="local">本地（Ollama）</option>
              <option value="openai-compatible">远程（OpenAI 兼容）</option>
              <option
                v-if="draft.kind === 'remote'"
                value="remote"
              >
                远程（旧配置）
              </option>
            </select>
          </label>

          <label class="form-field provider-edit-dialog__col-span">
            <span class="form-field__label">Base URL</span>
            <input
              v-model="draft.base_url"
              class="inp"
              :placeholder="draft.kind === 'local' ? '留空则用 AI 服务内置地址' : 'https://api.openai.com/v1 / 自建兼容地址'"
            >
          </label>

          <label
            v-if="draft.kind !== 'local' && !useEnvVar"
            class="form-field provider-edit-dialog__col-span"
          >
            <span class="form-field__label">API Key</span>
            <input
              v-model="draftApiKey"
              class="inp"
              type="password"
              autocomplete="off"
              :placeholder="isEdit && draft.api_key_set ? '已配置，留空不修改' : 'sk-…'"
            >
            <span class="form-field__hint muted">
              保存后写入 AI 服务 Provider 配置；控制台不会回显明文。
              <template v-if="isEdit && draft.api_key_set">当前已配置。</template>
            </span>
          </label>

          <details
            v-if="draft.kind !== 'local'"
            class="provider-edit-dialog__advanced provider-edit-dialog__col-span"
            :open="useEnvVar"
            @toggle="useEnvVar = ($event.target as HTMLDetailsElement).open"
          >
            <summary class="provider-edit-dialog__advanced-summary">高级：改用环境变量</summary>
            <label class="form-field">
              <span class="form-field__label">API Key 环境变量名</span>
              <input
                v-model="draft.api_key_env"
                class="inp"
                placeholder="LLM_REMOTE_API_KEY"
                :disabled="!useEnvVar"
              >
              <span class="form-field__hint muted">填 AI 服务进程 .env 中的变量名，不是 sk- 密钥本身。</span>
            </label>
          </details>

          <label class="form-field provider-edit-dialog__switch-field">
            <span class="form-field__label">启用</span>
            <ConsoleSwitch
              :model-value="draft.enabled"
              :show-label="false"
              aria-label="启用该 Provider"
              @update:model-value="(v) => (draft.enabled = v)"
            />
          </label>
        </div>
      </section>

      <section class="provider-edit-dialog__section">
        <div class="provider-edit-dialog__section-head">
          <strong>默认模型</strong>
          <span class="muted">用于未单独指定 task 的默认落点。</span>
        </div>
        <div class="provider-edit-dialog__grid provider-edit-dialog__grid--single">
          <div class="form-field">
            <span class="form-field__label">默认模型</span>
            <div class="provider-edit-dialog__model-row">
              <LlmModelSelect
                v-model="draft.default_model"
                :groups="modelSelectGroups"
                empty-label="（未指定，回退路由）"
                aria-label="Provider 默认模型"
              />
              <UiButton
                variant="outline"
                class="provider-edit-dialog__row-btn"
                :busy="discoveringModels || modelsState?.loading"
                :disabled="!draft.id.trim()"
                @click="refreshModels"
              >
                刷新模型列表
              </UiButton>
            </div>
            <span
              v-if="modelsState?.loaded && modelsState.error"
              class="muted provider-edit-dialog__models-err"
            >
              当前 Provider 发现失败：{{ modelsState.error }}
            </span>
          </div>
          <p class="muted provider-edit-dialog__task-note">
            各 task 的模型请在关闭弹窗后，于下方「Task 路由与模型」矩阵统一配置。
          </p>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="provider-edit-dialog__footer">
        <UiButton
          variant="ghost"
          class="provider-edit-dialog__footer-btn"
          @click="emit('close')"
        >
          取消
        </UiButton>
        <UiButton
          variant="primary"
          class="provider-edit-dialog__footer-btn"
          @click="submit"
        >
          {{ isEdit ? (draftApiKey.trim() || useEnvVar ? "保存" : "应用修改") : "添加" }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
:deep(.provider-edit-dialog) {
  width: min(1040px, calc(100vw - 40px));
}

:deep(.provider-edit-dialog .ui-dialog__bd) {
  display: grid;
  gap: 16px;
  padding-bottom: 4px;
}

.provider-edit-dialog__alert {
  margin: 0 0 12px;
}

.provider-edit-dialog__stack {
  display: grid;
  gap: 16px;
}

.provider-edit-dialog__section {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  border-radius: 16px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--text) 2%, transparent), transparent 64%),
    color-mix(in srgb, var(--bg-card) 88%, var(--text) 2%);
}

.provider-edit-dialog__section-head {
  display: grid;
  gap: 4px;
}

.provider-edit-dialog__section-head strong {
  font-size: 0.96rem;
}

.provider-edit-dialog__section-head span {
  font-size: 0.8rem;
  line-height: 1.5;
}

.provider-edit-dialog__section-head--tight {
  gap: 2px;
}

.provider-edit-dialog__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 16px;
}

.provider-edit-dialog__grid--single {
  grid-template-columns: minmax(0, 1fr);
}

.provider-edit-dialog__col-span {
  grid-column: 1 / -1;
}

.provider-edit-dialog__select {
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
  line-height: 1.2;
  padding-top: var(--ui-ctrl-pad-y);
  padding-bottom: var(--ui-ctrl-pad-y);
}

.form-field {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.form-field__label {
  font-weight: 600;
}

.form-field__hint {
  font-size: 12px;
  line-height: 1.4;
}

.provider-edit-dialog__model-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.provider-edit-dialog__model-row .inp {
  flex: 1 1 auto;
  min-width: 0;
}

.provider-edit-dialog__row-btn:deep(.ui-btn) {
  flex: 0 0 auto;
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
  padding-inline: 14px;
}

.provider-edit-dialog__models-err {
  font-size: 12px;
  line-height: 1.45;
}

.provider-edit-dialog__task-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.provider-edit-dialog__switch-field {
  align-content: start;
}

.provider-edit-dialog__advanced {
  border: 1px dashed var(--border);
  border-radius: 12px;
  padding: 10px 12px;
}

.provider-edit-dialog__advanced-summary {
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
}

.provider-edit-dialog__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  padding-right: 2px;
}

.provider-edit-dialog__footer :deep(.ui-btn) {
  min-width: 0;
}

.provider-edit-dialog__footer-btn:deep(.ui-btn) {
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
  padding-inline: 14px;
}

@media (max-width: 560px) {
  :deep(.provider-edit-dialog) {
    width: calc(100vw - 16px);
  }

  .provider-edit-dialog__grid {
    grid-template-columns: 1fr;
  }

  .provider-edit-dialog__section {
    padding: 14px;
  }

  .provider-edit-dialog__model-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .provider-edit-dialog__model-row :deep(.ui-btn) {
    width: 100%;
  }

  .provider-edit-dialog__footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .provider-edit-dialog__footer :deep(.ui-btn) {
    width: 100%;
  }
}
</style>
