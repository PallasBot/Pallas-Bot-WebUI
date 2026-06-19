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

    <div class="provider-edit-dialog__grid">
      <label class="form-field">
        <span class="form-field__label">Provider ID</span>
        <input
          v-model="draft.id"
          class="inp"
          :disabled="isEdit"
          placeholder="local / deepseek"
        >
        <span class="form-field__hint muted">唯一标识；local 为内置本地后端。</span>
      </label>

      <label class="form-field">
        <span class="form-field__label">类型</span>
        <select
          v-model="draft.kind"
          class="inp"
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
          :placeholder="draft.kind === 'local' ? '留空则用 AI 服务内置地址' : 'https://api.deepseek.com'"
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

      <div class="form-field">
        <span class="form-field__label">默认模型</span>
        <div class="provider-edit-dialog__model-row">
          <input
            v-model="draft.default_model"
            class="inp"
            placeholder="qwen2.5:7b / deepseek-chat"
          >
          <UiButton
            variant="outline"
            size="sm"
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

    <div class="provider-edit-dialog__tasks">
      <div class="provider-edit-dialog__tasks-head">
        <strong>按 task 覆盖模型</strong>
        <UiButton
          variant="outline"
          size="sm"
          :disabled="!taskOptions.length"
          @click="addTaskModel"
        >
          + 添加
        </UiButton>
      </div>
      <p class="muted provider-edit-dialog__tasks-hint">
        不配则该 task 用上面的默认模型。
      </p>
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
          size="sm"
          @click="removeTaskModel(i)"
        >
          删除
        </UiButton>
      </div>
    </div>

    <template #footer>
      <div class="provider-edit-dialog__footer">
        <UiButton
          variant="ghost"
          @click="emit('close')"
        >
          取消
        </UiButton>
        <UiButton
          variant="primary"
          @click="submit"
        >
          {{ isEdit ? "应用修改" : "添加" }}
        </UiButton>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.provider-edit-dialog__alert {
  margin: 0 0 12px;
}

.provider-edit-dialog__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.provider-edit-dialog__col-span {
  grid-column: 1 / -1;
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
  align-items: center;
}

.provider-edit-dialog__model-row .inp {
  flex: 1 1 auto;
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
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}

.provider-edit-dialog__tasks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.provider-edit-dialog__tasks-hint {
  margin: 6px 0 10px;
  font-size: 12px;
}

.provider-edit-dialog__task-row {
  display: grid;
  grid-template-columns: minmax(120px, 200px) 1fr auto;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.provider-edit-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 560px) {
  .provider-edit-dialog__grid {
    grid-template-columns: 1fr;
  }

  .provider-edit-dialog__task-row {
    grid-template-columns: 1fr;
  }
}
</style>
