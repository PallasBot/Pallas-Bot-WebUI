<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchLlmLocalRoutingConfig } from "@/api/consoleApi";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal.vue";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useLlmProviders } from "@/composables/useLlmProviders";
import { useLlmModelPickerOptions } from "@/composables/useLlmModelPickerOptions";
import { collectSavedProviderModels } from "@/utils/llmModelOptionSources";
import { providerAuthSummary } from "@/utils/llmProviderAuth";
import ProviderEditDialog from "./ProviderEditDialog.vue";
import ProviderRoutingEditor from "./ProviderRoutingEditor.vue";
import AiObservationLinks from "@/components/ai-config/AiObservationLinks.vue";
import { AI_TASK_CONFIG_HINTS } from "@/config/aiEntrySemantics";

const props = withDefaults(defineProps<{ simpleMode?: boolean }>(), { simpleMode: false });

const store = useLlmProviders();
const picker = useLlmModelPickerOptions();
const runtimeModel = picker.runtimeModel;
const discoveredModels = picker.discoveredModels;
const discoveringModels = picker.discoveringModels;
const {
  doc,
  providers,
  providerIds,
  loading,
  saving,
  err,
  dirty,
  providerStatus,
  testStates,
  modelsStates,
} = store;

const dialogOpen = ref(false);
const editIndex = ref<number | null>(null);
const editRow = ref<LlmProviderConfigRow | null>(null);
const deleteIndex = ref<number | null>(null);
const envTaskModels = ref<Record<string, string>>({});

const modelSelectGroups = computed(() =>
  picker.buildGroups({
    providers: providers.value,
    savedValues: collectSavedProviderModels({
      taskModelRows: providers.value.flatMap((provider) =>
        Object.values(provider.task_models || {}).map((model) => ({ model: String(model) })),
      ),
    }),
  }),
);

const statusById = computed(() => {
  const map = new Map<string, (typeof providerStatus.value)[number]>();
  for (const row of providerStatus.value) map.set(row.id, row);
  return map;
});
const providerSummary = computed(() => {
  let enabledCount = 0;
  let reachableCount = 0;
  let unreachableCount = 0;
  let disabledCount = 0;
  for (const row of providers.value) {
    if (!row.enabled) {
      disabledCount += 1;
      continue;
    }
    enabledCount += 1;
    const status = statusById.value.get(row.id);
    if (status?.reachable === true) reachableCount += 1;
    else if (status?.reachable === false) unreachableCount += 1;
  }
  return [
    { label: "Provider 总数", value: String(providers.value.length), accent: true },
    { label: "已启用", value: String(enabledCount) },
    { label: "可达", value: String(reachableCount), tone: reachableCount > 0 ? "ok" : undefined },
    { label: "异常/不可达", value: String(unreachableCount), tone: unreachableCount > 0 ? "warn" : undefined },
    { label: "已停用", value: String(disabledCount), tone: disabledCount > 0 ? "muted" : undefined },
  ];
});

function openAdd() {
  editIndex.value = null;
  editRow.value = null;
  dialogOpen.value = true;
}

function openEdit(index: number) {
  editIndex.value = index;
  editRow.value = providers.value[index] ?? null;
  dialogOpen.value = true;
}

async function loadEnvTaskModels() {
  try {
    const routing = await fetchLlmLocalRoutingConfig();
    envTaskModels.value = { ...(routing.task_models || {}) };
  } catch {
    envTaskModels.value = {};
  }
}

async function onRefreshDialogModels(providerId: string) {
  await picker.refreshPickerContext(providers.value);
  if (providerId) await store.discoverModels(providerId);
}

function onSubmit(row: LlmProviderConfigRow) {
  if (editIndex.value === null) store.addProvider(row);
  else store.updateProvider(editIndex.value, row);
  dialogOpen.value = false;
}

const deleteRow = computed(() =>
  deleteIndex.value === null ? null : providers.value[deleteIndex.value] ?? null,
);

function confirmDelete() {
  if (deleteIndex.value !== null) store.removeProvider(deleteIndex.value);
  deleteIndex.value = null;
}

function reachLabel(id: string, enabled: boolean): { label: string; cls: string } {
  const test = testStates.value[id];
  if (test && !test.testing && test.reachable !== null) {
    return test.reachable
      ? { label: test.latencyMs != null ? `可达 ${test.latencyMs}ms` : "可达", cls: "tag--ok" }
      : { label: "不可达", cls: "tag--warn" };
  }
  const status = statusById.value.get(id);
  if (!enabled) return { label: "已停用", cls: "tag--muted" };
  if (!status) return { label: "待测试", cls: "tag--muted" };
  if (!status.configured) return { label: "未配置", cls: "tag--warn" };
  if (status.reachable === true) return { label: "可达", cls: "tag--ok" };
  if (status.reachable === false) return { label: "不可达", cls: "tag--warn" };
  return { label: "待测试", cls: "tag--muted" };
}

defineExpose({ save: store.save, canSave: () => dirty.value && !saving.value, saving });

onMounted(async () => {
  await store.load();
  await Promise.all([picker.refreshPickerContext(providers.value), loadEnvTaskModels()]);
});
</script>

<template>
  <UiCard
    tag="div"
    glass
    class="provider-manager"
  >
    <div class="panel__hd panel__hd--split">
      <h2 class="panel__title">Provider 与路由</h2>
      <div class="row-actions">
        <UiButton
          variant="outline"
          :disabled="loading || saving"
          @click="store.load()"
        >
          刷新
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!dirty || saving"
          :busy="saving"
          title="Ctrl+S"
          @click="store.save()"
        >
          {{ saving ? "保存中…" : dirty ? "保存改动" : "已保存" }}
        </UiButton>
      </div>
    </div>

    <div class="panel__bd">
      <div class="provider-manager__summary">
        <div
          v-for="item in providerSummary"
          :key="item.label"
          class="provider-manager__summary-item"
        >
          <span class="provider-manager__summary-label">{{ item.label }}</span>
          <strong
            class="provider-manager__summary-value"
            :class="[
              item.accent ? 'provider-manager__summary-value--accent' : '',
              item.tone === 'ok' ? 'ok' : '',
              item.tone === 'warn' ? 'warn' : '',
              item.tone === 'muted' ? 'muted' : '',
            ]"
          >
            {{ item.value }}
          </strong>
        </div>
      </div>

      <div class="provider-manager__meta">
        <p class="muted provider-manager__intro">
          {{ AI_TASK_CONFIG_HINTS.providerIntro }}
        </p>
        <div class="provider-manager__links">
          <AiObservationLinks />
        </div>

        <div
          v-if="err"
          class="alert alert--err provider-manager__alert"
        >
          {{ err }}
        </div>
      </div>

      <div class="provider-manager__list-head">
        <strong>Providers（{{ providers.length }}）</strong>
        <UiButton
          variant="outline"
          size="sm"
          @click="openAdd"
        >
          + 新增 Provider
        </UiButton>
      </div>

      <p
        v-if="!loading && !providers.length"
        class="muted provider-manager__empty"
      >
        还没有配置 Provider，点「新增 Provider」开始。
      </p>

      <ul class="provider-manager__cards">
        <li
          v-for="(p, i) in providers"
          :key="p.id"
          class="provider-manager__card"
          :class="{ 'is-disabled': !p.enabled }"
        >
          <div class="provider-manager__card-main">
            <div class="provider-manager__card-head">
              <strong class="provider-manager__card-id">{{ p.id }}</strong>
              <span class="tag provider-manager__kind">{{ p.kind === "local" ? "本地" : "远程" }}</span>
              <span
                class="tag"
                :class="reachLabel(p.id, p.enabled).cls"
              >
                {{ reachLabel(p.id, p.enabled).label }}
              </span>
            </div>
            <div class="muted provider-manager__card-meta">
              <span v-if="p.default_model">模型 {{ p.default_model }}</span>
              <span v-if="p.base_url">· {{ p.base_url }}</span>
              <span v-if="p.kind !== 'local'">· {{ providerAuthSummary(p) }}</span>
              <span v-if="Object.keys(p.task_models).length">· {{ Object.keys(p.task_models).length }} 个 task 覆盖</span>
            </div>
          </div>
          <div class="provider-manager__card-actions">
            <ConsoleSwitch
              :model-value="p.enabled"
              :show-label="false"
              aria-label="启用 Provider"
              @update:model-value="(v) => store.updateProvider(i, { ...p, enabled: v })"
            />
            <UiButton
              variant="outline"
              size="sm"
              :busy="testStates[p.id]?.testing"
              @click="store.testProvider(p.id)"
            >
              测试
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              @click="openEdit(i)"
            >
              编辑
            </UiButton>
            <UiButton
              variant="ghost"
              size="sm"
              @click="deleteIndex = i"
            >
              删除
            </UiButton>
          </div>
        </li>
      </ul>

      <div
        v-if="providers.length && !props.simpleMode"
        class="provider-manager__routing"
      >
        <ProviderRoutingEditor
          :providers="providers"
          :tasks="doc.routing.tasks"
          :chain-fallback="doc.routing.chain_fallback"
          :provider-ids="providerIds"
          :env-task-models="envTaskModels"
          :model-select-groups="modelSelectGroups"
          @set-task="store.setTaskRoute"
          @set-task-model="store.setTaskModelRoute"
          @set-chain="store.setChainFallback"
        />
      </div>

      <p
        v-if="doc.providers_file"
        class="muted provider-manager__file"
      >
        配置文件：{{ doc.providers_file }}
      </p>
    </div>
  </UiCard>

  <ProviderEditDialog
    :open="dialogOpen"
    :row="editRow"
    :existing-ids="providerIds"
    :providers="providers"
    :runtime-model="runtimeModel"
    :discovered-by-provider="discoveredModels"
    :discovering-models="discoveringModels"
    :models-state="editRow ? modelsStates[editRow.id] : modelsStates['']"
    @close="dialogOpen = false"
    @submit="onSubmit"
    @discover="store.discoverModels"
    @refresh-models="onRefreshDialogModels"
  />

  <ConsoleDeleteConfirmModal
    :open="deleteIndex !== null"
    title="删除 Provider"
    :subtitle="deleteRow ? `将从配置中移除「${deleteRow.id}」，并清理对它的路由引用。` : ''"
    :items="deleteRow ? [{ key: deleteRow.id, label: deleteRow.id }] : []"
    confirm-label="删除"
    @close="deleteIndex = null"
    @confirm="confirmDelete"
  />
</template>

<style scoped>
.provider-manager__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.provider-manager__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}

.provider-manager__summary-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--primary, var(--accent)) 18%, var(--border));
  background: color-mix(in srgb, var(--primary, var(--accent)) 5%, var(--card, var(--bg-card)));
}

.provider-manager__summary-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-muted, #64748b);
}

.provider-manager__summary-value {
  font-size: 1rem;
  font-weight: 700;
}

.provider-manager__summary-value--accent {
  font-size: 1.08rem;
}

.provider-manager__summary-value.ok {
  color: var(--ok, #3d9a5c);
}

.provider-manager__summary-value.warn {
  color: var(--warn, #c9a227);
}

.provider-manager__summary-value.muted {
  color: var(--text-muted, #64748b);
}

.provider-manager__meta {
  margin: 0 0 12px;
}

.provider-manager__alert {
  margin-bottom: 12px;
}

.provider-manager__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 12px;
}

.provider-manager__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.provider-manager__empty {
  margin: 0 0 12px;
  font-size: 13px;
}

.provider-manager__cards {
  list-style: none;
  margin: 0 0 18px;
  padding: 0;
  display: grid;
  gap: 10px;
}

.provider-manager__card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--bg-card) 86%, transparent);
}

.provider-manager__card.is-disabled {
  opacity: 0.62;
}

.provider-manager__card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.provider-manager__card-id {
  font-size: 14px;
  font-weight: 700;
}

.provider-manager__kind {
  background: color-mix(in srgb, var(--text) 8%, transparent);
}

.provider-manager__card-meta {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.provider-manager__card-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.provider-manager__routing {
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}

.provider-manager__file {
  margin: 14px 0 0;
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 640px) {
  .provider-manager__card {
    flex-direction: column;
    align-items: flex-start;
  }

  .provider-manager__card-actions {
    flex-wrap: wrap;
  }
}
</style>
