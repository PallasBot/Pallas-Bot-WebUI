<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { LlmProviderConfigRow } from "@/api/pallasTypes";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal.vue";
import ConsoleSwitch from "@/components/ConsoleSwitch.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { useLlmProviders } from "@/composables/useLlmProviders";
import ProviderEditDialog from "./ProviderEditDialog.vue";
import ProviderRoutingEditor from "./ProviderRoutingEditor.vue";

const store = useLlmProviders();
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

const statusById = computed(() => {
  const map = new Map<string, (typeof providerStatus.value)[number]>();
  for (const row of providerStatus.value) map.set(row.id, row);
  return map;
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

onMounted(() => {
  void store.load();
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
      <p class="muted provider-manager__intro">
        配置本地与远程 LLM Provider 及各 task 的路由；保存写入 AI 服务
        <code>providers.toml</code>，无需重启 Celery。远程密钥以环境变量名引用，明文仍在 .env。
      </p>

      <div
        v-if="err"
        class="alert alert--err provider-manager__alert"
      >
        {{ err }}
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
              <span v-if="p.api_key_env">· key=${{ p.api_key_env }}</span>
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
        v-if="providers.length"
        class="provider-manager__routing"
      >
        <ProviderRoutingEditor
          :tasks="doc.routing.tasks"
          :chain-fallback="doc.routing.chain_fallback"
          :provider-ids="providerIds"
          @set-task="store.setTaskRoute"
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
    :models-state="editRow ? modelsStates[editRow.id] : modelsStates['']"
    @close="dialogOpen = false"
    @submit="onSubmit"
    @discover="store.discoverModels"
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
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
}

.provider-manager__alert {
  margin-bottom: 12px;
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
