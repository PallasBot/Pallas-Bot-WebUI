<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import { LLM_TASK_ROUTE_LABELS } from "@/config/configFieldLabels";
import type { ProviderModelsState } from "@/composables/useLlmProviders";

const props = defineProps<{
  open: boolean;
  /** 编辑现有 provider 时传入；新增时为 null。 */
  row: LlmProviderConfigRow | null;
  /** 已存在的 provider id，用于新增时校验重名。 */
  existingIds: string[];
  /** 在线发现的模型状态（由父组件按 id 提供）。 */
  modelsState?: ProviderModelsState;
}>();

const emit = defineEmits<{
  close: [];
  submit: [row: LlmProviderConfigRow];
  discover: [providerId: string];
}>();

const TASK_KEYS = Object.keys(LLM_TASK_ROUTE_LABELS).filter((k) => k !== "other");

const draft = ref<LlmProviderConfigRow>(blank());
const taskModelRows = ref<Array<{ task: string; model: string }>>([]);
const localErr = ref("");

const isEdit = computed(() => props.row !== null);

function blank(): LlmProviderConfigRow {
  return {
    id: "",
    kind: "remote",
    base_url: "",
    api_key_env: "",
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
    draft.value = props.row ? JSON.parse(JSON.stringify(props.row)) : blank();
    taskModelRows.value = Object.entries(draft.value.task_models || {}).map(([task, model]) => ({
      task,
      model,
    }));
  },
  { immediate: true },
);

const taskOptions = computed(() => {
  const used = new Set(taskModelRows.value.map((r) => r.task));
  return TASK_KEYS.filter((k) => !used.has(k));
});

function addTaskModel() {
  const next = taskOptions.value[0] ?? "";
  if (!next) return;
  taskModelRows.value = [...taskModelRows.value, { task: next, model: "" }];
}

function removeTaskModel(index: number) {
  taskModelRows.value = taskModelRows.value.filter((_, i) => i !== index);
}

function taskLabel(task: string): string {
  return LLM_TASK_ROUTE_LABELS[task] ?? task;
}

function submit() {
  const id = draft.value.id.trim();
  if (!id) {
    localErr.value = "请填写 Provider ID";
    return;
  }
  if (!isEdit.value && props.existingIds.includes(id)) {
    localErr.value = `Provider ID「${id}」已存在`;
    return;
  }
  if (draft.value.kind !== "local" && !draft.value.base_url.trim()) {
    localErr.value = "远程 Provider 需要填写 Base URL";
    return;
  }
  const task_models: Record<string, string> = {};
  for (const r of taskModelRows.value) {
    if (r.task && r.model.trim()) task_models[r.task] = r.model.trim();
  }
  emit("submit", {
    id,
    kind: draft.value.kind,
    base_url: draft.value.base_url.trim(),
    api_key_env: draft.value.api_key_env.trim(),
    default_model: draft.value.default_model.trim(),
    enabled: draft.value.enabled,
    task_models,
  });
}

function applyDiscoveredModel(model: string) {
  draft.value.default_model = model;
}
</script>

<template>
  <UiDialog
    :open="open"
    :title="isEdit ? `编辑 Provider · ${row?.id}` : '新增 Provider'"
    subtitle="远程 Provider 的密钥通过环境变量名引用，明文密钥仍写在 AI 服务 .env 中。"
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
              <option value="remote">远程（OpenAI 兼容）</option>
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
            v-if="draft.kind !== 'local'"
            class="form-field"
          >
            <span class="form-field__label">API Key 环境变量名</span>
            <input
              v-model="draft.api_key_env"
              class="inp"
              placeholder="LLM_REMOTE_API_KEY"
            >
            <span class="form-field__hint muted">填环境变量名，不是密钥本身。</span>
          </label>

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
              <input
                v-model="draft.default_model"
                class="inp"
                placeholder="gpt-4o-mini / qwen2.5:7b / 自定义模型名"
              >
              <UiButton
                variant="outline"
                class="provider-edit-dialog__row-btn"
                :busy="modelsState?.loading"
                :disabled="!draft.id.trim()"
                @click="emit('discover', draft.id.trim())"
              >
                在线发现
              </UiButton>
            </div>
            <div
              v-if="modelsState?.loaded"
              class="provider-edit-dialog__models"
            >
              <span
                v-if="modelsState.error"
                class="muted provider-edit-dialog__models-err"
              >发现失败：{{ modelsState.error }}</span>
              <template v-else-if="modelsState.models.length">
                <button
                  v-for="m in modelsState.models"
                  :key="m"
                  type="button"
                  class="provider-edit-dialog__model-chip"
                  :class="{ 'is-on': draft.default_model === m }"
                  @click="applyDiscoveredModel(m)"
                >
                  {{ m }}
                </button>
              </template>
              <span
                v-else
                class="muted provider-edit-dialog__models-err"
              >未发现模型</span>
            </div>
          </div>
        </div>
      </section>

      <section class="provider-edit-dialog__section provider-edit-dialog__tasks">
        <div class="provider-edit-dialog__tasks-head">
          <div class="provider-edit-dialog__section-head provider-edit-dialog__section-head--tight">
            <strong>按 task 覆盖模型</strong>
            <span class="muted">不配置时，沿用上面的默认模型。</span>
          </div>
          <UiButton
            variant="outline"
            class="provider-edit-dialog__row-btn"
            :disabled="!taskOptions.length"
            @click="addTaskModel"
          >
            + 添加
          </UiButton>
        </div>
        <div
          v-if="taskModelRows.length"
          class="provider-edit-dialog__task-list"
        >
          <div
            v-for="(r, i) in taskModelRows"
            :key="i"
            class="provider-edit-dialog__task-row"
          >
            <select
              v-model="r.task"
              class="inp"
            >
              <option
                :value="r.task"
              >
                {{ taskLabel(r.task) }}
              </option>
              <option
                v-for="opt in taskOptions"
                :key="opt"
                :value="opt"
              >
                {{ taskLabel(opt) }}
              </option>
            </select>
            <input
              v-model="r.model"
              class="inp"
              placeholder="模型名"
            >
            <UiButton
              variant="ghost"
              class="provider-edit-dialog__row-btn provider-edit-dialog__row-btn--ghost"
              @click="removeTaskModel(i)"
            >
              删除
            </UiButton>
          </div>
        </div>
        <div
          v-else
          class="provider-edit-dialog__task-empty muted"
        >
          当前没有按 task 的覆盖规则。
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
          {{ isEdit ? "应用修改" : "添加" }}
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
  font-weight: 650;
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

.provider-edit-dialog__task-row .inp {
  min-height: var(--ui-ctrl-height);
  height: var(--ui-ctrl-height);
}

.provider-edit-dialog__models {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.provider-edit-dialog__models-err {
  font-size: 12px;
}

.provider-edit-dialog__model-chip {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  background: color-mix(in srgb, var(--text) 5%, transparent);
  cursor: pointer;
}

.provider-edit-dialog__model-chip.is-on {
  border-color: var(--primary, var(--accent));
  background: color-mix(in srgb, var(--primary, var(--accent)) 16%, transparent);
}

.provider-edit-dialog__switch-field {
  align-content: start;
}

.provider-edit-dialog__tasks {
  gap: 12px;
}

.provider-edit-dialog__tasks-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.provider-edit-dialog__task-list {
  display: grid;
  gap: 10px;
}

.provider-edit-dialog__task-row {
  display: grid;
  grid-template-columns: minmax(120px, 200px) 1fr auto;
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--text) 2%, transparent);
  align-items: center;
}

.provider-edit-dialog__task-empty {
  padding: 14px 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--text) 3%, transparent);
  font-size: 0.82rem;
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

  .provider-edit-dialog__tasks-head {
    display: grid;
  }

  .provider-edit-dialog__task-row {
    grid-template-columns: 1fr;
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
