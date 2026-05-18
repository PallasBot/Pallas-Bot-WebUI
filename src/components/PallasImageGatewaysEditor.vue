<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  applyGatewaysToFieldValues,
  defaultGatewayDisplayName,
  gatewayFieldValuesEqual,
  gatewayRowsEqual,
  maskApiKey,
  migrateLegacyGatewayFieldValues,
  parseGatewaysFromFieldValues,
  type PallasImageGatewayRow,
} from "@/utils/pallasImageGateways";

const props = defineProps<{
  fieldValues: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:fieldValues": [value: Record<string, string>];
}>();

const rows = ref<PallasImageGatewayRow[]>([]);
const modalOpen = ref(false);
const modalError = ref("");
const editingId = ref<string | null>(null);
const draft = ref({
  name: "",
  base_url: "",
  api_key: "",
  model: "",
  omit_response_format: false,
});
const draftRole = ref<"primary" | "fallback">("fallback");
const draftKeepApiKey = ref("");

let syncingFromParent = false;

function syncFromFieldValues(fv: Record<string, string>) {
  syncingFromParent = true;
  const migrated = migrateLegacyGatewayFieldValues(fv);
  const parsed = parseGatewaysFromFieldValues(migrated);
  if (!gatewayRowsEqual(rows.value, parsed)) {
    rows.value = parsed;
  }
  const merged = { ...fv, ...migrated };
  if (!gatewayFieldValuesEqual(fv, merged)) {
    emit("update:fieldValues", merged);
  }
  syncingFromParent = false;
}

watch(
  () => props.fieldValues,
  (fv) => syncFromFieldValues(fv),
  { immediate: true, deep: true },
);

watch(
  rows,
  (list) => {
    if (syncingFromParent) return;
    const next = applyGatewaysToFieldValues(props.fieldValues, list);
    if (!gatewayFieldValuesEqual(props.fieldValues, next)) {
      emit("update:fieldValues", next);
    }
  },
  { deep: true },
);

const modalTitle = computed(() => {
  if (editingId.value === null) return "添加备选网关";
  return draftRole.value === "primary" ? "编辑主网关" : "编辑备选网关";
});

function openAddFallback() {
  editingId.value = null;
  draftRole.value = "fallback";
  draftKeepApiKey.value = "";
  draft.value = {
    name: "",
    base_url: "",
    api_key: "",
    model: "",
    omit_response_format: false,
  };
  modalError.value = "";
  modalOpen.value = true;
}

function openEdit(row: PallasImageGatewayRow) {
  editingId.value = row.id;
  draftRole.value = row.role;
  draftKeepApiKey.value = row.api_key;
  draft.value = {
    name: row.name,
    base_url: row.base_url,
    api_key: "",
    model: row.model,
    omit_response_format: row.omit_response_format,
  };
  modalError.value = "";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
  modalError.value = "";
}

function saveModal() {
  modalError.value = "";
  const base_url = draft.value.base_url.trim();
  const name = draft.value.name.trim();
  const model = draft.value.model.trim();
  const api_key_input = draft.value.api_key.trim();
  const api_key = api_key_input || draftKeepApiKey.value.trim();

  if (!base_url) {
    modalError.value = "请填写 base_url。";
    return;
  }
  if (!api_key) {
    modalError.value = "请填写 api_key。";
    return;
  }

  const payload: PallasImageGatewayRow = {
    id: editingId.value ?? `gw-${Date.now().toString(36)}`,
    role: draftRole.value,
    name,
    base_url,
    api_key,
    model,
    omit_response_format: draftRole.value === "fallback" ? draft.value.omit_response_format : false,
  };

  closeModal();
  if (editingId.value === null) {
    rows.value = [...rows.value, payload];
  } else {
    rows.value = rows.value.map((r) => (r.id === editingId.value ? payload : r));
  }
}

function removeRow(id: string) {
  const row = rows.value.find((r) => r.id === id);
  if (!row || row.role === "primary") return;
  rows.value = rows.value.filter((r) => r.id !== id);
}

const listItems = computed(() => {
  let fallbackIdx = 0;
  return rows.value.map((row) => {
    if (row.role === "fallback") fallbackIdx += 1;
    const fbIndex = row.role === "fallback" ? fallbackIdx : 0;
    const title = defaultGatewayDisplayName(row, fbIndex);
    const modelText = row.model.trim() || "（默认模型）";
    const metaParts = [`模型 ${modelText}`, `密钥 ${maskApiKey(row.api_key)}`];
    if (row.role === "fallback" && row.omit_response_format) {
      metaParts.push("不含 response_format");
    }
    return {
      row,
      title,
      url: row.base_url.trim() || "未设置 URL",
      meta: metaParts.join(" · "),
      canDelete: row.role === "fallback",
    };
  });
});

const editingKeyHint = computed(() => {
  if (!editingId.value || !draftKeepApiKey.value.trim()) return "";
  return `当前密钥：${maskApiKey(draftKeepApiKey.value)}，留空表示不修改`;
});
</script>

<template>
  <div class="pallas-gw-editor">
    <div class="pallas-gw-editor__hd">
      <div>
        <div class="pallas-gw-editor__title">
          画图网关
        </div>
        <p class="pallas-gw-editor__desc muted">
          主网关与备选按顺序回退；密钥在列表中脱敏。修改后请点击页顶「保存」。
        </p>
      </div>
      <button
        type="button"
        class="btn btn--primary"
        @click="openAddFallback"
      >
        添加备选网关
      </button>
    </div>

    <ul
      v-if="listItems.length"
      class="pallas-gw-editor__list"
    >
      <li
        v-for="item in listItems"
        :key="item.row.id"
        class="pallas-gw-editor__item"
      >
        <div class="pallas-gw-editor__item-main">
          <div class="pallas-gw-editor__item-title">
            <span
              v-if="item.row.role === 'primary'"
              class="pallas-gw-editor__badge"
            >主</span>
            {{ item.title }}
          </div>
          <div class="pallas-gw-editor__item-url muted">
            {{ item.url }}
          </div>
          <div class="pallas-gw-editor__item-meta muted">
            {{ item.meta }}
          </div>
        </div>
        <div class="pallas-gw-editor__item-actions">
          <button
            type="button"
            class="btn"
            @click="openEdit(item.row)"
          >
            编辑
          </button>
          <button
            v-if="item.canDelete"
            type="button"
            class="btn btn--danger"
            @click="removeRow(item.row.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
    <p
      v-else
      class="muted"
      style="margin: 0"
    >
      尚未配置网关，请编辑主网关或添加备选。
    </p>

    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="console-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pallas-gw-modal-title"
      >
        <div
          class="console-modal__backdrop"
          aria-hidden="true"
          @click="closeModal"
        />
        <div
          class="console-modal__dialog pallas-gw-modal__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                id="pallas-gw-modal-title"
                class="console-modal__title"
              >
                {{ modalTitle }}
              </h2>
              <p class="console-modal__subtitle muted">
                base_url 建议以 <code>/</code> 结尾，插件会拼接 <code>v1/images/…</code>
              </p>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="closeModal"
            >
              ×
            </button>
          </div>
          <div class="console-modal__bd pallas-gw-modal__bd">
            <p
              v-if="modalError"
              class="alert alert--err pallas-gw-modal__alert"
            >
              {{ modalError }}
            </p>
            <div class="bot-config-edit bot-config-edit--modal pallas-gw-modal__form">
              <div class="bot-config-edit__field">
                <label for="pallas-gw-name">显示名称</label>
                <input
                  id="pallas-gw-name"
                  v-model="draft.name"
                  class="inp pallas-gw-modal__inp"
                  type="text"
                  placeholder="留空则用「主网关」或「备线 N」"
                >
              </div>
              <div class="bot-config-edit__field">
                <label for="pallas-gw-base-url">base_url</label>
                <input
                  id="pallas-gw-base-url"
                  v-model="draft.base_url"
                  class="inp pallas-gw-modal__inp"
                  type="url"
                  placeholder="https://your-gateway.example.com/"
                  autocomplete="off"
                >
              </div>
              <div class="bot-config-edit__field">
                <label for="pallas-gw-api-key">api_key</label>
                <input
                  id="pallas-gw-api-key"
                  v-model="draft.api_key"
                  class="inp pallas-gw-modal__inp"
                  type="password"
                  :placeholder="editingId ? '留空则不修改' : '必填'"
                  autocomplete="new-password"
                >
                <p
                  v-if="editingKeyHint"
                  class="pallas-gw-modal__hint muted"
                >
                  {{ editingKeyHint }}
                </p>
              </div>
              <div class="bot-config-edit__field">
                <label for="pallas-gw-model">model</label>
                <input
                  id="pallas-gw-model"
                  v-model="draft.model"
                  class="inp pallas-gw-modal__inp"
                  type="text"
                  placeholder="留空则使用全局 pallas_image_model"
                >
              </div>
              <div
                v-if="draftRole === 'fallback'"
                class="pallas-gw-modal__option"
              >
                <label class="pallas-gw-modal__check">
                  <input
                    v-model="draft.omit_response_format"
                    type="checkbox"
                  >
                  <span class="pallas-gw-modal__check-text">
                    <strong>omit_response_format</strong>
                    <span class="muted">请求体不含 response_format（部分厂商网关需要）</span>
                  </span>
                </label>
              </div>
              <p
                v-else
                class="pallas-gw-modal__hint muted"
              >
                主网关返回格式由全局项 <code>pallas_image_response_format</code> 控制。
              </p>
            </div>
          </div>
          <div class="pallas-gw-modal__ft row-actions">
            <button
              type="button"
              class="btn"
              @click="closeModal"
            >
              取消
            </button>
            <button
              type="button"
              class="btn btn--primary"
              @click="saveModal"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.pallas-gw-editor {
  margin-bottom: 28px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}

.pallas-gw-editor__hd {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.pallas-gw-editor__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pallas-gw-editor__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius, 8px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--surface-2, rgba(255, 255, 255, 0.03));
}

.pallas-gw-editor__item-title {
  font-weight: 600;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pallas-gw-editor__title {
  font-weight: 700;
  margin-bottom: 6px;
}

.pallas-gw-editor__desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
}

.pallas-gw-editor__item-main {
  flex: 1;
  min-width: 0;
}

.pallas-gw-editor__item-url {
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
  margin-top: 2px;
}

.pallas-gw-editor__item-meta {
  font-size: 12px;
  line-height: 1.45;
  margin-top: 4px;
}

.pallas-gw-editor__item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pallas-gw-editor__badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent-dim, rgba(99, 102, 241, 0.2));
  color: var(--accent, #818cf8);
}

.pallas-gw-modal__dialog {
  width: min(520px, 100%);
}

.pallas-gw-modal__bd {
  padding-bottom: 8px;
}

.pallas-gw-modal__alert {
  margin: 0 0 14px;
}

.pallas-gw-modal__form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.pallas-gw-modal__form :deep(.bot-config-edit__field) {
  margin-bottom: 14px;
}

.pallas-gw-modal__form :deep(.bot-config-edit__field label) {
  display: block;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  color: var(--text-dim, var(--text-muted));
  margin-bottom: 6px;
}

.pallas-gw-modal__inp {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
}

.pallas-gw-modal__hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
}

.pallas-gw-modal__hint code {
  font-size: 11px;
}

.pallas-gw-modal__option {
  margin-top: 2px;
  padding: 12px 14px;
  border-radius: var(--radius, 8px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--bg-deep, rgba(0, 0, 0, 0.15));
}

.pallas-gw-modal__check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
  margin: 0;
}

.pallas-gw-modal__check input {
  margin-top: 3px;
  flex-shrink: 0;
}

.pallas-gw-modal__check-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  line-height: 1.45;
  min-width: 0;
}

.pallas-gw-modal__check-text strong {
  font-weight: 600;
  color: var(--text);
}

.pallas-gw-modal__check-text .muted {
  font-size: 12px;
  font-weight: 400;
}

.pallas-gw-modal__ft {
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  margin: 0;
}
</style>
