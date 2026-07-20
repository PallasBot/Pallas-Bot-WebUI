<script setup lang="ts">
import { computed, ref, watch } from "vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiDialog from "@/components/ui/UiDialog.vue";
import {
  fetchGitMirrorInfo,
  postGitMirrorApplyAll,
  postGitMirrorApplyBot,
  postGitMirrorApplyCommunity,
  postGitMirrorApplyPlugin,
  postGitMirrorProbe,
  putGitMirrorPreferred,
} from "@/api/consoleApi";
import type {
  GitMirrorInfo,
  GitMirrorOption,
  GitMirrorScopes,
  GitMirrorTargetRow,
} from "@/api/pallasTypes";
import { pushConsoleToast } from "@/utils/consoleToast";
import { toastApiError, toastSaveSuccess } from "@/utils/consoleToastFeedback";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const INHERIT = "__inherit__";

const loading = ref(false);
const loadErr = ref("");
const info = ref<GitMirrorInfo | null>(null);
const preferredId = ref("github");
const customPrefix = ref("");
const scopeBot = ref(INHERIT);
const scopeWebui = ref(INHERIT);
const scopeCommunity = ref(INHERIT);
const saveBusy = ref(false);
const applyAllBusy = ref(false);
const probeBusy = ref(false);
const applyBusyKey = ref<string | null>(null);
const confirmApplyAllOpen = ref(false);
const switchTarget = ref<GitMirrorTargetRow | null>(null);
const switchMirrorId = ref("github");

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
  map.set("ssh", "SSH");
  return map;
});

const targetRows = computed(() => info.value?.targets ?? []);
const pluginRows = computed(() => info.value?.plugins ?? []);

const dialogBusy = computed(
  () =>
    saveBusy.value ||
    applyAllBusy.value ||
    probeBusy.value ||
    Boolean(applyBusyKey.value),
);

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

function scopeToSelect(value: string | undefined): string {
  return (value || "").trim() || INHERIT;
}

function selectToScope(value: string): string {
  return value === INHERIT ? "" : value;
}

function syncFormFromInfo(data: GitMirrorInfo) {
  info.value = data;
  preferredId.value = data.preferred_id || "github";
  customPrefix.value = data.custom_proxy_prefix || "";
  const scopes = data.scopes || ({ bot: "", webui: "", community: "" } as GitMirrorScopes);
  scopeBot.value = scopeToSelect(scopes.bot);
  scopeWebui.value = scopeToSelect(scopes.webui);
  scopeCommunity.value = scopeToSelect(scopes.community);
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
      confirmApplyAllOpen.value = false;
      applyBusyKey.value = null;
      switchTarget.value = null;
    }
  },
);

function requestClose() {
  if (dialogBusy.value) return;
  emit("close");
}

function currentScopesPayload(): GitMirrorScopes {
  return {
    bot: selectToScope(scopeBot.value),
    webui: selectToScope(scopeWebui.value),
    community: selectToScope(scopeCommunity.value),
  };
}

function isFormDirty(): boolean {
  if (!info.value) return false;
  const savedPreferred = info.value.preferred_id || "github";
  const savedCustom = info.value.custom_proxy_prefix || "";
  const saved = info.value.scopes || { bot: "", webui: "", community: "" };
  if (preferredId.value !== savedPreferred) return true;
  if (showCustomPrefix.value && customPrefix.value !== savedCustom) return true;
  const next = currentScopesPayload();
  return next.bot !== (saved.bot || "") ||
    next.webui !== (saved.webui || "") ||
    next.community !== (saved.community || "");
}

async function savePreferred(): Promise<boolean> {
  if (saveBusy.value) return false;
  saveBusy.value = true;
  try {
    syncFormFromInfo(
      await putGitMirrorPreferred({
        preferred_id: preferredId.value,
        custom_proxy_prefix: showCustomPrefix.value ? customPrefix.value : "",
        scopes: currentScopesPayload(),
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
    const result = await postGitMirrorProbe({ mirror_id: preferredId.value });
    if (result.ok) {
      pushConsoleToast(`连通正常：${mirrorLabel(result.mirror_id || preferredId.value)}`, "ok");
    } else {
      pushConsoleToast(
        `${mirrorLabel(result.mirror_id || preferredId.value)} 不可用${result.error ? `：${result.error}` : ""}`,
        "err",
      );
    }
  } catch (e) {
    toastApiError(e, "连通检测失败");
  } finally {
    probeBusy.value = false;
  }
}

async function applyAll() {
  if (applyAllBusy.value) return;
  if (!(await ensureSavedIfDirty())) return;
  applyAllBusy.value = true;
  try {
    const summary = await postGitMirrorApplyAll({ preferred_id: preferredId.value });
    const { total, success_count, fail_count } = summary.summary;
    const level = fail_count === 0 ? "ok" : success_count === 0 ? "err" : "warn";
    pushConsoleToast(`已应用到 Bot + 社区插件：${success_count}/${total} 成功`, level);
    await loadInfo();
  } catch (e) {
    toastApiError(e, "批量应用失败");
  } finally {
    applyAllBusy.value = false;
    confirmApplyAllOpen.value = false;
  }
}

function openSwitch(row: GitMirrorTargetRow) {
  switchTarget.value = row;
  switchMirrorId.value = preferredId.value;
}

function closeSwitch() {
  if (applyBusyKey.value) return;
  switchTarget.value = null;
}

async function confirmSwitch() {
  const row = switchTarget.value;
  if (!row || applyBusyKey.value) return;
  if (!(await ensureSavedIfDirty())) return;
  const key = `${row.kind}:${row.id}`;
  applyBusyKey.value = key;
  try {
    if (row.kind === "bot") {
      const result = await postGitMirrorApplyBot({ preferred_id: switchMirrorId.value });
      pushConsoleToast(
        result.success ? `Bot：${result.message}` : `Bot 失败：${result.message}`,
        result.success ? "ok" : "err",
      );
    } else if (row.kind === "webui") {
      syncFormFromInfo(
        await putGitMirrorPreferred({
          preferred_id: preferredId.value,
          custom_proxy_prefix: showCustomPrefix.value ? customPrefix.value : "",
          scopes: { ...currentScopesPayload(), webui: switchMirrorId.value },
        }),
      );
      pushConsoleToast(`WebUI 下载源已设为 ${mirrorLabel(switchMirrorId.value)}`, "ok");
    } else {
      const result = await postGitMirrorApplyPlugin(row.id, { preferred_id: switchMirrorId.value });
      pushConsoleToast(
        result.success ? `${row.id}：${result.message}` : `${row.id} 失败：${result.message}`,
        result.success ? "ok" : "err",
      );
    }
    await loadInfo();
    switchTarget.value = null;
  } catch (e) {
    toastApiError(e, "切换失败");
  } finally {
    applyBusyKey.value = null;
  }
}

async function applyCommunityBatch() {
  if (applyBusyKey.value) return;
  if (!(await ensureSavedIfDirty())) return;
  applyBusyKey.value = "community-batch";
  try {
    const summary = await postGitMirrorApplyCommunity({ preferred_id: preferredId.value });
    const { total, success_count, fail_count } = summary.summary;
    const level = fail_count === 0 ? "ok" : success_count === 0 ? "err" : "warn";
    pushConsoleToast(`已应用到社区插件：${success_count}/${total} 成功`, level);
    await loadInfo();
  } catch (e) {
    toastApiError(e, "批量应用社区插件失败");
  } finally {
    applyBusyKey.value = null;
  }
}

function rowTitle(row: GitMirrorTargetRow): string {
  return row.label || row.id;
}

function canSwitch(row: GitMirrorTargetRow): boolean {
  if (row.kind === "official") return false;
  if (row.kind === "webui") return true;
  return Boolean(row.can_apply_remote ?? row.is_git_repo);
}

function rowActionLabel(row: GitMirrorTargetRow): string {
  if (row.kind === "official") return "随 Bot";
  if (row.kind === "webui") return "仅 scope";
  if (!canSwitch(row)) return "—";
  return "切换";
}

function rowScopeHint(row: GitMirrorTargetRow): string {
  if (row.kind === "bot" || row.kind === "official") return "Bot 更新 scope";
  if (row.kind === "webui") return "WebUI 下载 scope";
  if (row.kind === "plugin") return "社区插件 scope";
  return "";
}
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
          Bot 本体与 packages/ 官方插件、WebUI、社区插件均可配置镜像；下方列表逐项说明。
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
          全局首选
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
          placeholder="https://ghproxy.example"
          autocomplete="off"
        >

        <div class="git-mirror-dialog__scopes">
          <div class="git-mirror-dialog__scope">
            <label
              class="git-mirror-dialog__label"
              for="git-mirror-scope-bot"
            >Bot 更新</label>
            <select
              id="git-mirror-scope-bot"
              v-model="scopeBot"
              class="git-mirror-dialog__select"
            >
              <option :value="INHERIT">跟随全局首选</option>
              <option
                v-for="opt in info.available_mirrors"
                :key="`bot-${opt.id}`"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="git-mirror-dialog__scope">
            <label
              class="git-mirror-dialog__label"
              for="git-mirror-scope-webui"
            >WebUI 下载</label>
            <select
              id="git-mirror-scope-webui"
              v-model="scopeWebui"
              class="git-mirror-dialog__select"
            >
              <option :value="INHERIT">跟随全局首选</option>
              <option
                v-for="opt in info.available_mirrors"
                :key="`webui-${opt.id}`"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div class="git-mirror-dialog__scope">
            <label
              class="git-mirror-dialog__label"
              for="git-mirror-scope-community"
            >社区插件</label>
            <select
              id="git-mirror-scope-community"
              v-model="scopeCommunity"
              class="git-mirror-dialog__select"
            >
              <option :value="INHERIT">跟随全局首选</option>
              <option
                v-for="opt in info.available_mirrors"
                :key="`community-${opt.id}`"
                :value="opt.id"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="git-mirror-dialog__coverage muted">
          <p class="git-mirror-dialog__coverage-title">作用范围</p>
          <ul class="git-mirror-dialog__coverage-list">
            <li><strong>Bot 更新</strong>：Bot git 拉取 / 更新页；<strong>含 packages/ 官方插件</strong>（无独立 remote，随 Bot 仓库或 Docker 镜像）</li>
            <li><strong>WebUI 下载</strong>：控制台 dist / Release 包下载（无 git remote，仅 scope）</li>
            <li><strong>社区插件</strong>：<code>local/plugins/</code> 下从 Git 安装的插件（可改写 origin）</li>
          </ul>
        </div>

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
            v-if="!confirmApplyAllOpen"
            variant="outline"
            size="sm"
            @click="confirmApplyAllOpen = true"
          >
            应用到全部
          </UiButton>
          <UiButton
            variant="outline"
            size="sm"
            :busy="applyBusyKey === 'community-batch'"
            @click="applyCommunityBatch"
          >
            改写社区 remote
          </UiButton>
        </div>
        <div
          v-if="confirmApplyAllOpen"
          class="git-mirror-dialog__confirm"
        >
          <p class="git-mirror-dialog__confirm-msg">
            将按当前全局首选改写 Bot 的 git origin；官方插件随 Bot 一并更新。社区插件 origin 需点「改写社区 remote」。WebUI 仅靠上方 scope。确认继续？
          </p>
          <div class="git-mirror-dialog__confirm-actions">
            <UiButton
              variant="ghost"
              size="sm"
              :disabled="applyAllBusy"
              @click="confirmApplyAllOpen = false"
            >
              取消
            </UiButton>
            <UiButton
              variant="primary"
              size="sm"
              :busy="applyAllBusy"
              @click="applyAll"
            >
              确认应用
            </UiButton>
          </div>
        </div>
      </section>

      <section class="git-mirror-dialog__section">
        <div class="git-mirror-dialog__section-head">
          <h3 class="git-mirror-dialog__section-title">
            Bot / WebUI / 官方插件
          </h3>
          <span class="muted git-mirror-dialog__section-meta">{{ targetRows.length }} 项</span>
        </div>

        <div class="git-mirror-dialog__table-wrap">
          <table class="data console-data-table git-mirror-dialog__table">
            <thead>
              <tr>
                <th>目标</th>
                <th>Remote / 说明</th>
                <th>当前源</th>
                <th class="git-mirror-dialog__col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in targetRows"
                :key="`t-${row.id}`"
              >
                <td>
                  <div class="git-mirror-dialog__plugin-id">{{ rowTitle(row) }}</div>
                  <div class="muted git-mirror-dialog__plugin-path">{{ row.path }}</div>
                  <div
                    v-if="rowScopeHint(row)"
                    class="muted git-mirror-dialog__scope-hint"
                  >
                    {{ rowScopeHint(row) }}
                  </div>
                </td>
                <td
                  class="git-mirror-dialog__remote"
                  :title="row.remote_url || row.note || undefined"
                >
                  {{ row.remote_url ? shortRemote(row.remote_url) : (row.note || "—") }}
                </td>
                <td>
                  <UiBadge :variant="mirrorBadgeVariant(row.mirror)">
                    {{ mirrorLabel(row.mirror) }}
                  </UiBadge>
                </td>
                <td class="git-mirror-dialog__col-action">
                  <UiButton
                    v-if="canSwitch(row)"
                    variant="ghost"
                    size="sm"
                    :busy="applyBusyKey === `${row.kind}:${row.id}`"
                    @click="openSwitch(row)"
                  >
                    切换
                  </UiButton>
                  <span
                    v-else
                    class="muted git-mirror-dialog__action-muted"
                  >{{ rowActionLabel(row) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul class="git-mirror-dialog__cards git-mirror-dialog__cards--targets">
          <li
            v-for="row in targetRows"
            :key="`card-${row.kind}-${row.id}`"
            class="git-mirror-dialog__card"
          >
            <div class="git-mirror-dialog__card-head">
              <div>
                <div class="git-mirror-dialog__plugin-id">{{ rowTitle(row) }}</div>
                <div class="muted git-mirror-dialog__plugin-path">{{ row.path }}</div>
                <div
                  v-if="rowScopeHint(row)"
                  class="muted git-mirror-dialog__scope-hint"
                >
                  {{ rowScopeHint(row) }}
                </div>
              </div>
              <UiBadge :variant="mirrorBadgeVariant(row.mirror)">
                {{ mirrorLabel(row.mirror) }}
              </UiBadge>
            </div>
            <p
              class="git-mirror-dialog__card-remote muted"
              :title="row.remote_url || row.note || undefined"
            >
              {{ row.remote_url ? shortRemote(row.remote_url) : (row.note || "—") }}
            </p>
            <UiButton
              v-if="canSwitch(row)"
              variant="outline"
              size="sm"
              block
              :busy="applyBusyKey === `${row.kind}:${row.id}`"
              @click="openSwitch(row)"
            >
              切换镜像源
            </UiButton>
            <p
              v-else
              class="git-mirror-dialog__action-muted muted"
            >
              {{ rowActionLabel(row) }}
            </p>
          </li>
        </ul>
      </section>

      <section class="git-mirror-dialog__section">
        <div class="git-mirror-dialog__section-head">
          <h3 class="git-mirror-dialog__section-title">
            社区插件
          </h3>
          <span class="muted git-mirror-dialog__section-meta">{{ pluginRows.length }} 项</span>
        </div>
        <p class="git-mirror-dialog__section-desc muted">
          仅列出 <code>local/plugins/</code> 下已安装的 Git 社区插件；官方插件在上方，随 Bot 更新。
        </p>

        <div
          v-if="!pluginRows.length"
          class="git-mirror-dialog__empty muted"
        >
          暂无社区插件目录；从插件商店「从 Git 安装」后会出现在此。
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
                <th>当前源</th>
                <th class="git-mirror-dialog__col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in pluginRows"
                :key="`p-${row.id}`"
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
                    :disabled="!canSwitch(row)"
                    :busy="applyBusyKey === `plugin:${row.id}`"
                    @click="openSwitch(row)"
                  >
                    切换
                  </UiButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <ul
          v-if="pluginRows.length"
          class="git-mirror-dialog__cards git-mirror-dialog__cards--plugins"
        >
          <li
            v-for="row in pluginRows"
            :key="`card-p-${row.id}`"
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
              :disabled="!canSwitch(row)"
              :busy="applyBusyKey === `plugin:${row.id}`"
              @click="openSwitch(row)"
            >
              切换镜像源
            </UiButton>
          </li>
        </ul>
      </section>
    </template>
  </UiDialog>

  <UiDialog
    :open="Boolean(switchTarget)"
    title-id="git-mirror-switch-title"
    panel-class="git-mirror-switch-dialog"
    :close-on-backdrop="!applyBusyKey"
    :busy="Boolean(applyBusyKey)"
    @close="closeSwitch"
  >
    <template #header>
      <div class="console-modal__head-text">
        <h2
          id="git-mirror-switch-title"
          class="console-modal__title"
        >
          切换镜像源
        </h2>
        <p class="console-modal__subtitle muted">
          {{ switchTarget ? rowTitle(switchTarget) : "" }}
        </p>
      </div>
      <button
        type="button"
        class="console-modal__close"
        aria-label="关闭"
        :disabled="Boolean(applyBusyKey)"
        @click="closeSwitch"
      >
        ×
      </button>
    </template>
    <div
      v-if="switchTarget && info"
      class="git-mirror-dialog__section"
    >
      <label
        class="git-mirror-dialog__label"
        for="git-mirror-switch-select"
      >选择镜像源</label>
      <select
        id="git-mirror-switch-select"
        v-model="switchMirrorId"
        class="git-mirror-dialog__select"
      >
        <option
          v-for="opt in info.available_mirrors"
          :key="`sw-${opt.id}`"
          :value="opt.id"
        >
          {{ opt.label }}
        </option>
      </select>
      <div class="git-mirror-dialog__confirm-actions">
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="Boolean(applyBusyKey)"
          @click="closeSwitch"
        >
          取消
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :busy="Boolean(applyBusyKey)"
          @click="confirmSwitch"
        >
          确认
        </UiButton>
      </div>
    </div>
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

.git-mirror-dialog__scopes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.git-mirror-dialog__scope {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.git-mirror-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
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

.git-mirror-dialog__coverage {
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--console-border, rgba(255, 255, 255, 0.12));
  background: var(--console-surface-2, rgba(255, 255, 255, 0.04));
  font-size: 12px;
  line-height: 1.55;
}

.git-mirror-dialog__coverage-title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
  color: inherit;
}

.git-mirror-dialog__coverage-list {
  margin: 0;
  padding-left: 1.1em;
}

.git-mirror-dialog__coverage-list code {
  font-size: 11px;
}

.git-mirror-dialog__section-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.git-mirror-dialog__section-desc code {
  font-size: 11px;
}

.git-mirror-dialog__scope-hint {
  font-size: 11px;
  margin-top: 2px;
}

.git-mirror-dialog__action-muted {
  font-size: 12px;
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
  .git-mirror-dialog__scopes {
    grid-template-columns: minmax(0, 1fr);
  }

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

  .git-mirror-dialog__cards--targets,
  .git-mirror-dialog__cards--plugins {
    display: flex;
    flex-direction: column;
  }
}
</style>
