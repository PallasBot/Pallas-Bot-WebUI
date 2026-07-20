<script setup lang="ts">
import { computed, ref, watch } from "vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import {
  fetchGitMirrorInfo,
  postGitMirrorApplyCommunity,
  postGitMirrorApplyPlugin,
  postGitMirrorProbe,
  putGitMirrorPreferred,
} from "@/api/consoleApi";
import type { GitMirrorInfo, GitMirrorOption, GitMirrorPluginRow } from "@/api/pallasTypes";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const loadErr = ref("");
const info = ref<GitMirrorInfo | null>(null);
const preferredId = ref("github");
const customPrefix = ref("");
const saveBusy = ref(false);
const applyCommunityBusy = ref(false);
const probeBusy = ref(false);
const applyPluginBusy = ref<string | null>(null);
const confirmApplyCommunityOpen = ref(false);

const selectedMirror = computed(() =>
  info.value?.available_mirrors.find((row) => row.id === preferredId.value) ?? null,
);

const showCustomPrefix = computed(
  () => preferredId.value === "custom" || selectedMirror.value?.type === "custom",
);

const mirrorLabelMap = computed(() => {
  const map = new Map<string, string>();
  for (const row of info.value?.available_mirrors ?? []) {
    map.set(row.id, row.label);
  }
  map.set("unknown", "未知");
  return map;
});

function mirrorBadgeVariant(mirrorId: string): "ok" | "warn" | "muted" | "secondary" {
  if (mirrorId === "unknown") return "muted";
  if (mirrorId === preferredId.value) return "ok";
  return "secondary";
}

function mirrorLabel(mirrorId: string): string {
  return mirrorLabelMap.value.get(mirrorId) ?? mirrorId;
}

function shortRemote(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "—";
  if (raw.length <= 72) return raw;
  return `${raw.slice(0, 36)}…${raw.slice(-28)}`;
}

function syncFormFromInfo(data: GitMirrorInfo) {
  info.value = data;
  preferredId.value = data.preferred_id || "github";
  customPrefix.value = data.custom_proxy_prefix || "";
}

async function loadInfo() {
  loading.value = true;
  loadErr.value = "";
  try {
    syncFormFromInfo(await fetchGitMirrorInfo());
  } catch (e) {
    info.value = null;
    loadErr.value = "加载 Git 镜像配置失败";
    toastApiError(e, loadErr.value);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void loadInfo();
    else {
      confirmApplyCommunityOpen.value = false;
      applyPluginBusy.value = null;
    }
  },
);

function requestClose() {
  if (saveBusy.value || applyCommunityBusy.value || probeBusy.value || applyPluginBusy.value) return;
  emit("close");
}

function isFormDirty(): boolean {
  if (!info.value) return false;
  const savedPreferred = info.value.preferred_id || "github";
  const savedCustom = info.value.custom_proxy_prefix || "";
  if (preferredId.value !== savedPreferred) return true;
  if (showCustomPrefix.value && customPrefix.value !== savedCustom) return true;
  return false;
}

async function savePreferred(): Promise<boolean> {
  if (saveBusy.value) return false;
  saveBusy.value = true;
  try {
    syncFormFromInfo(
      await putGitMirrorPreferred({
        preferred_id: preferredId.value,
        custom_proxy_prefix: showCustomPrefix.value ? customPrefix.value : "",
      }),
    );
    toastSaveSuccess("Git 镜像偏好已保存");
    return true;
  } catch (e) {
    toastApiError(e, "保存失败");
    return false;
  } finally {
    saveBusy.value = false;
  }
}

async function ensureSavedIfDirty(): Promise<boolean> {
  if (!isFormDirty()) return true;
  return savePreferred();
}

async function runProbe() {
  if (probeBusy.value) return;
  if (!(await ensureSavedIfDirty())) return;
  probeBusy.value = true;
  try {
    const result = await postGitMirrorProbe();
    if (result.ok) {
      const label = mirrorLabel(result.mirror_id || preferredId.value);
      pushConsoleToast(`连通正常：${label}`, "ok");
    } else {
      const label = mirrorLabel(result.mirror_id || preferredId.value);
      pushConsoleToast(`${label} 不可用${result.error ? `：${result.error}` : ""}`, "err");
    }
  } catch (e) {
    toastApiError(e, "连通检测失败");
  } finally {
    probeBusy.value = false;
  }
}

async function applyCommunity() {
  if (applyCommunityBusy.value) return;
  if (!(await ensureSavedIfDirty())) return;
  applyCommunityBusy.value = true;
  try {
    const summary = await postGitMirrorApplyCommunity();
    const { total, success_count, fail_count } = summary.summary;
    const level = fail_count === 0 ? "ok" : success_count === 0 ? "err" : "warn";
    pushConsoleToast(`已应用到社区插件：${success_count}/${total} 成功`, level);
    await loadInfo();
  } catch (e) {
    toastApiError(e, "批量应用失败");
  } finally {
    applyCommunityBusy.value = false;
    confirmApplyCommunityOpen.value = false;
  }
}

async function applyPlugin(row: GitMirrorPluginRow) {
  if (applyPluginBusy.value || !row.is_git_repo) return;
  if (!(await ensureSavedIfDirty())) return;
  applyPluginBusy.value = row.id;
  try {
    const result = await postGitMirrorApplyPlugin(row.id, { preferred_id: preferredId.value });
    pushConsoleToast(
      result.success ? `${row.id}：${result.message}` : `${row.id} 失败：${result.message}`,
      result.success ? "ok" : "err",
    );
    await loadInfo();
  } catch (e) {
    toastApiError(e, `${row.id} 应用失败`);
  } finally {
    applyPluginBusy.value = null;
  }
}

const pluginRows = computed(() => info.value?.plugins ?? []);
const dialogBusy = computed(
  () =>
    saveBusy.value ||
    applyCommunityBusy.value ||
    probeBusy.value ||
    Boolean(applyPluginBusy.value),
);
</script>

<template>
  <UiDialog
    :open="open"
    title-id="git-mirror-dialog-title"
    panel-class="git-mirror-dialog"
    body-class="git-mirror-dialog__bd"
    :close-on-backdrop="!dialogBusy"
    :busy="dialogBusy"
    @close="requestClose"
  >
    <template #header>
      <div class="console-modal__head-text">
        <h2
          id="git-mirror-dialog-title"
          class="console-modal__title"
        >
          Git 镜像源
        </h2>
        <p class="console-modal__subtitle muted">
          切换 GitHub 克隆/拉取镜像，并批量更新已安装的社区插件 remote。
        </p>
      </div>
      <button
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        :disabled="dialogBusy"
        @click="requestClose"
      >
        ×
      </button>
    </template>

    <div
      v-if="loading"
      class="git-mirror-dialog__state muted"
      role="status"
      aria-live="polite"
    >
      正在加载…
    </div>
    <div
      v-else-if="loadErr"
      class="git-mirror-dialog__state"
      role="status"
      aria-live="polite"
    >
      <p class="git-mirror-dialog__err">{{ loadErr }}</p>
      <UiButton
        size="sm"
        variant="outline"
        @click="loadInfo"
      >
        重试
      </UiButton>
    </div>
    <template v-else-if="info">
      <section class="git-mirror-dialog__section">
        <label
          class="git-mirror-dialog__label"
          for="git-mirror-preferred"
        >
          首选镜像
        </label>
        <select
          id="git-mirror-preferred"
          v-model="preferredId"
          class="git-mirror-dialog__select"
        >
          <option
            v-for="opt in info.available_mirrors"
            :key="opt.id"
            :value="opt.id"
          >
            {{ opt.label }}
          </option>
          <option
            v-if="!info.available_mirrors.some((row: GitMirrorOption) => row.id === 'custom')"
            value="custom"
          >
            自定义代理前缀
          </option>
        </select>
        <label
          v-if="showCustomPrefix"
          class="git-mirror-dialog__label"
          for="git-mirror-custom-prefix"
        >
          自定义 https 前缀
        </label>
        <input
          v-if="showCustomPrefix"
          id="git-mirror-custom-prefix"
          v-model="customPrefix"
          type="url"
          class="git-mirror-dialog__input"
          placeholder="https://ghproxy.example/https://github.com"
          autocomplete="off"
        />
        <div class="git-mirror-dialog__actions">
          <UiButton
            variant="primary"
            size="sm"
            :busy="saveBusy"
            @click="savePreferred"
          >
            保存
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            :busy="probeBusy"
            @click="runProbe"
          >
            测试连通
          </UiButton>
          <UiButton
            v-if="!confirmApplyCommunityOpen"
            variant="outline"
            size="sm"
            @click="confirmApplyCommunityOpen = true"
          >
            应用到社区插件
          </UiButton>
        </div>
        <div
          v-if="confirmApplyCommunityOpen"
          class="git-mirror-dialog__confirm"
        >
          <p class="git-mirror-dialog__confirm-msg">
            将按当前首选镜像重写各插件 git origin；非 GitHub 仓库会跳过。确认继续？
          </p>
          <div class="git-mirror-dialog__confirm-actions">
            <UiButton
              variant="ghost"
              size="sm"
              :disabled="applyCommunityBusy"
              @click="confirmApplyCommunityOpen = false"
            >
              取消
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              :busy="applyCommunityBusy"
              @click="applyCommunity"
            >
              确认应用
            </UiButton>
          </div>
        </div>
      </section>

      <section class="git-mirror-dialog__section">
        <div class="git-mirror-dialog__section-head">
          <h3 class="git-mirror-dialog__section-title">
            已安装社区插件
          </h3>
          <span class="muted git-mirror-dialog__section-meta">{{ pluginRows.length }} 项</span>
        </div>

        <div
          v-if="!pluginRows.length"
          class="git-mirror-dialog__empty muted"
        >
          暂无 local/plugins 下的社区插件目录。
        </div>

        <div
          v-else
          class="git-mirror-dialog__table-wrap"
        >
          <table class="data console-data-table git-mirror-dialog__table">
            <thead>
              <tr>
                <th>插件</th>
                <th>Remote</th>
                <th>镜像</th>
                <th class="git-mirror-dialog__col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in pluginRows"
                :key="row.id"
              >
                <td>
                  <div class="git-mirror-dialog__plugin-id">{{ row.id }}</div>
                  <div class="muted git-mirror-dialog__plugin-path">{{ row.path }}</div>
                </td>
                <td
                  class="git-mirror-dialog__remote"
                  :title="row.remote_url || undefined"
                >
                  {{ shortRemote(row.remote_url) }}
                </td>
                <td>
                  <UiBadge :variant="mirrorBadgeVariant(row.mirror)">
                    {{ mirrorLabel(row.mirror) }}
                  </UiBadge>
                </td>
                <td class="git-mirror-dialog__col-action">
                  <UiButton
                    variant="ghost"
                    size="sm"
                    :disabled="!row.is_git_repo"
                    :busy="applyPluginBusy === row.id"
                    @click="applyPlugin(row)"
                  >
                    应用
                  </UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="git-mirror-dialog__cards">
          <li
            v-for="row in pluginRows"
            :key="`card-${row.id}`"
            class="git-mirror-dialog__card"
          >
            <div class="git-mirror-dialog__card-head">
              <div>
                <div class="git-mirror-dialog__plugin-id">{{ row.id }}</div>
                <div class="muted git-mirror-dialog__plugin-path">{{ row.path }}</div>
              </div>
              <UiBadge :variant="mirrorBadgeVariant(row.mirror)">
                {{ mirrorLabel(row.mirror) }}
              </UiBadge>
            </div>
            <p
              class="git-mirror-dialog__card-remote muted"
              :title="row.remote_url || undefined"
            >
              {{ shortRemote(row.remote_url) }}
            </p>
            <UiButton
              variant="outline"
              size="sm"
              block
              :disabled="!row.is_git_repo"
              :busy="applyPluginBusy === row.id"
              @click="applyPlugin(row)"
            >
              应用当前镜像
            </UiButton>
          </li>
        </ul>
      </section>
    </template>
  </UiDialog>
</template>

<style scoped>
.git-mirror-dialog__bd {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.git-mirror-dialog__state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}

.git-mirror-dialog__err {
  margin: 0;
  color: var(--console-danger, #f87171);
}

.git-mirror-dialog__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.git-mirror-dialog__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.git-mirror-dialog__section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.git-mirror-dialog__section-meta {
  font-size: 12px;
}

.git-mirror-dialog__label {
  font-size: 13px;
  font-weight: 500;
}

.git-mirror-dialog__select,
.git-mirror-dialog__input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--console-border, rgba(255, 255, 255, 0.12));
  background: var(--console-surface-2, rgba(255, 255, 255, 0.04));
  color: inherit;
  font: inherit;
}

.git-mirror-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
}

.git-mirror-dialog__empty {
  font-size: 13px;
  padding: 8px 0;
}

.git-mirror-dialog__table-wrap {
  overflow-x: auto;
}

.git-mirror-dialog__table th,
.git-mirror-dialog__table td {
  vertical-align: top;
}

.git-mirror-dialog__plugin-id {
  font-weight: 600;
  font-size: 13px;
}

.git-mirror-dialog__plugin-path {
  font-size: 11px;
  margin-top: 2px;
  word-break: break-all;
}

.git-mirror-dialog__remote {
  font-size: 12px;
  max-width: 280px;
  word-break: break-all;
}

.git-mirror-dialog__col-action {
  width: 88px;
  white-space: nowrap;
}

.git-mirror-dialog__cards {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: 10px;
}

.git-mirror-dialog__card {
  border: 1px solid var(--console-border, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.git-mirror-dialog__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.git-mirror-dialog__card-remote {
  margin: 0;
  font-size: 12px;
  word-break: break-all;
}

.git-mirror-dialog__confirm {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--console-border, rgba(255, 255, 255, 0.12));
  background: var(--console-surface-2, rgba(255, 255, 255, 0.04));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.git-mirror-dialog__confirm-msg {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.git-mirror-dialog__confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 560px) {
  .git-mirror-dialog__actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .git-mirror-dialog__actions :deep(.ui-btn) {
    width: 100%;
  }

  .git-mirror-dialog__confirm-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .git-mirror-dialog__confirm-actions :deep(.ui-btn) {
    width: 100%;
  }

  .git-mirror-dialog__table-wrap {
    display: none;
  }

  .git-mirror-dialog__cards {
    display: flex;
    flex-direction: column;
  }
}
</style>
