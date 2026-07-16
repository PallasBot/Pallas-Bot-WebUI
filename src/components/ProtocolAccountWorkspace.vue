<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { fetchSystem } from "@/api/consoleApi";
import type { NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import {
  protocolApiErrorMessage,
  protocolDeleteAccount,
  protocolFetchAccount,
  protocolFetchAccountLogs,
  protocolFetchQrcodeImageBlob,
  protocolFetchQrcodeMeta,
  protocolRefreshAccountQrcode,
  protocolRestartAccount,
  protocolSnowlumaInjectHook,
  protocolStartAccount,
  protocolStopAccount,
  protocolUpdateAccount,
} from "@/api/protocolApi";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import StatCard from "@/components/StatCard.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import {
  accountSnowlumaNovncHref,
  accountWebUiHref,
  snowlumaManagedWebuiPassword,
  snowlumaNovncPasswordHint,
  snowlumaRuntimeWebuiPassword,
  yn,
} from "@/utils/protocolLinks";
import { copyTextToClipboard } from "@/utils/clipboard";
import { pushConsoleToast } from "@/utils/consoleToast";
import { protocolBackendDisplayName } from "@/utils/protocolUi";

export type ProtocolAccountTab = "overview" | "settings";

const props = withDefaults(
  defineProps<{
    accountId: string;
    mountUrl: string | null;
    system?: SystemData | null;
    activeTab?: ProtocolAccountTab;
    presentation?: "dialog" | "embedded";
  }>(),
  {
    activeTab: "overview",
    presentation: "embedded",
  },
);

const emit = defineEmits<{
  "update:activeTab": [tab: ProtocolAccountTab];
  deleted: [];
  "account-loaded": [row: NapcatAccountRow];
}>();

const account = ref<NapcatAccountRow | null>(null);
const logs = ref<string[]>([]);
const loadBusy = ref(false);
const actionBusy = ref(false);
const injectBusy = ref(false);
const saveBusy = ref(false);
const systemLocal = ref<SystemData | null>(props.system ?? null);

const displayName = ref("");
const webuiPort = ref("");
const wsUrl = ref("");
const wsName = ref("");
const wsToken = ref("");

const qrHint = ref("");
const qrExists = ref(false);
const qrUpdatedAt = ref(0);
const qrRefreshBusy = ref(false);
const qrImageUrl = ref("");
let qrPollTimer: ReturnType<typeof setInterval> | null = null;
let logsPollTimer: ReturnType<typeof setInterval> | null = null;

const resolvedSystem = computed(() => props.system ?? systemLocal.value);

const pageTitle = computed(() => {
  const name = (account.value?.display_name || "").trim();
  return name ? `账号 ${props.accountId} · ${name}` : `账号 ${props.accountId}`;
});

const statusLine = computed(() => {
  const a = account.value;
  if (!a) return "加载中…";
  if (a.process_running) {
    let s = `运行中 · PID ${a.pid ?? "—"}`;
    if (a.connected) s += " · 已连接";
    return s;
  }
  if (a.connected) return "已连接（进程可能已脱离）";
  if (a.launch_ready) return "已停止";
  const issues = Array.isArray(a.launch_issues) ? a.launch_issues.join("; ") : "";
  return issues || "未就绪";
});

const statusMetrics = computed(() => {
  const a = account.value;
  return [
    { label: "协议", value: a ? protocolBackendDisplayName(a) : "—", hint: "" },
    { label: "QQ", value: String(a?.qq ?? props.accountId), hint: "" },
    {
      label: "已连接",
      value: yn(a?.connected),
      hint: a?.connected ? "Bot 侧 WS 已连上" : "尚未建立连接",
    },
    {
      label: "进程",
      value: yn(a?.process_running),
      hint: a?.process_running && a.pid != null ? `PID ${a.pid}` : "协议端进程状态",
    },
  ];
});

const nativeWebUiHref = computed(() =>
  account.value ? accountWebUiHref(account.value, resolvedSystem.value) : null,
);

const isSnowluma = computed(
  () => String(account.value?.protocol_backend ?? "").toLowerCase() === "snowluma",
);

const isSnowlumaDocker = computed(() => account.value?.snowluma_linux_docker === true);

const snowlumaNovncHref = computed(() =>
  accountSnowlumaNovncHref(account.value, resolvedSystem.value),
);

const snowlumaManagedPassword = computed(() =>
  snowlumaManagedWebuiPassword(account.value),
);

const snowlumaInitialPassword = computed(() => {
  const initial = snowlumaRuntimeWebuiPassword(account.value);
  const managed = snowlumaManagedPassword.value;
  if (!initial || initial === managed) return "";
  return initial;
});

const snowlumaWebuiUser = computed(() =>
  String(account.value?.snowluma_webui_default_user ?? "admin").trim() || "admin",
);

const snowlumaNovncHint = computed(() => snowlumaNovncPasswordHint(account.value));

const showSnowlumaAccess = computed(
  () =>
    isSnowluma.value &&
    (snowlumaNovncHref.value ||
      isSnowlumaDocker.value ||
      snowlumaManagedPassword.value ||
      snowlumaInitialPassword.value ||
      nativeWebUiHref.value),
);

const isDialog = computed(() => props.presentation === "dialog");

async function copySnowlumaSecret(label: string, text: string) {
  const ok = await copyTextToClipboard(text);
  pushConsoleToast(ok ? `${label}已复制` : "复制失败", ok ? "ok" : "err");
}

function switchTab(tab: ProtocolAccountTab) {
  emit("update:activeTab", tab);
}

function revokeQrUrl() {
  if (!qrImageUrl.value) return;
  try {
    URL.revokeObjectURL(qrImageUrl.value);
  } catch {
    /* ignore */
  }
  qrImageUrl.value = "";
}

async function loadQrImage(ts: number) {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id) return;
  const blob = await protocolFetchQrcodeImageBlob(mount, id, ts || undefined);
  revokeQrUrl();
  qrImageUrl.value = URL.createObjectURL(blob);
}

async function refreshQrcode(force = false) {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id || qrRefreshBusy.value) return;
  if (force) {
    qrRefreshBusy.value = true;
    qrHint.value = "正在恢复登录…";
  }
  try {
    const meta = force
      ? await protocolRefreshAccountQrcode(mount, id)
      : await protocolFetchQrcodeMeta(mount, id);
    if (meta.login_mode === "quick_login") {
      qrExists.value = false;
      revokeQrUrl();
      qrHint.value = meta.message || "已点击 QQ「登录」，请稍候确认上线";
      if (meta.inject_hook) {
        pushConsoleToast("已自动注入 SnowLuma Hook", "ok");
        await loadAccount(false);
      } else if (meta.inject_hook_error) {
        pushConsoleToast(meta.inject_hook_error, "warn");
      }
      return;
    }
    const nowExists = meta.exists === true;
    const ts = meta.updated_at ?? 0;
    if (nowExists && (force || ts !== qrUpdatedAt.value)) {
      qrUpdatedAt.value = ts;
      await loadQrImage(force ? Date.now() : ts);
    }
    qrExists.value = nowExists;
    qrHint.value = nowExists
      ? `更新于 ${new Date((ts || Date.now() / 1000) * 1000).toLocaleString()} · 可直接扫码`
      : meta.message || "暂无二维码；可点「恢复登录」尝试一键登录或刷新二维码";
  } catch (e) {
    if (force) {
      qrExists.value = false;
      revokeQrUrl();
      qrHint.value = protocolApiErrorMessage(e, "恢复登录失败");
    }
  } finally {
    if (force) qrRefreshBusy.value = false;
  }
}

async function loadAccount(brief = false) {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id) return;
  if (!brief) loadBusy.value = true;
  try {
    const row = await protocolFetchAccount(mount, id, { brief });
    if (!row) throw new Error("账号不存在");
    account.value = row;
    emit("account-loaded", row);
    if (!brief) {
      displayName.value = String(row.display_name ?? "");
      webuiPort.value = row.webui_port != null ? String(row.webui_port) : "";
      wsUrl.value = String(row.ws_url ?? "");
      wsName.value = String(row.ws_name ?? "");
      wsToken.value = String(row.ws_token ?? "");
    }
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "加载账号失败"), "err");
  } finally {
    if (!brief) loadBusy.value = false;
  }
}

async function loadLogs() {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id) return;
  try {
    logs.value = await protocolFetchAccountLogs(mount, id, 120);
  } catch {
    /* polling */
  }
}

async function bootWorkspace() {
  if (!props.system) {
    systemLocal.value = await fetchSystem().catch(() => null);
  }
  if (!props.mountUrl || !props.accountId) return;
  await loadAccount(true);
  void loadAccount(false);
  void refreshQrcode(false);
  void loadLogs();
}

async function runAction(kind: "start" | "stop" | "restart") {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id || actionBusy.value) return;
  actionBusy.value = true;
  try {
    if (kind === "start") await protocolStartAccount(mount, id);
    else if (kind === "stop") await protocolStopAccount(mount, id);
    else await protocolRestartAccount(mount, id);
    pushConsoleToast("操作已提交", "ok");
    await loadAccount(false);
    if (kind !== "stop") void refreshQrcode(true);
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "操作失败"), "err");
  } finally {
    actionBusy.value = false;
  }
}

async function saveSettings() {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id || saveBusy.value) return;
  saveBusy.value = true;
  try {
    const body: Record<string, unknown> = {
      display_name: displayName.value.trim(),
      ws_url: wsUrl.value.trim(),
      ws_name: wsName.value.trim(),
      ws_token: wsToken.value,
    };
    const wp = parseInt(webuiPort.value.trim(), 10);
    if (webuiPort.value.trim() && !Number.isNaN(wp)) body.webui_port = wp;
    await protocolUpdateAccount(mount, id, body, true);
    pushConsoleToast("已保存并重启协议进程", "ok");
    await loadAccount(false);
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "保存失败"), "err");
  } finally {
    saveBusy.value = false;
  }
}

async function injectHook() {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id || injectBusy.value) return;
  injectBusy.value = true;
  try {
    await protocolSnowlumaInjectHook(mount, id);
    pushConsoleToast("SnowLuma Hook 注入成功", "ok");
    await loadAccount(false);
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "注入失败"), "err");
  } finally {
    injectBusy.value = false;
  }
}

async function deleteAccount() {
  const mount = props.mountUrl;
  const id = props.accountId;
  if (!mount || !id) return;
  if (!window.confirm(`确定删除协议账号 ${id}？`)) return;
  try {
    await protocolDeleteAccount(mount, id);
    pushConsoleToast("账号已删除", "ok");
    emit("deleted");
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "删除失败"), "err");
  }
}

function startPollers() {
  if (qrPollTimer == null) {
    qrPollTimer = setInterval(() => {
      void refreshQrcode(false);
    }, 8000);
  }
  if (logsPollTimer == null) {
    logsPollTimer = setInterval(() => {
      void loadLogs();
    }, 5000);
  }
}

function stopPollers() {
  if (qrPollTimer != null) {
    clearInterval(qrPollTimer);
    qrPollTimer = null;
  }
  if (logsPollTimer != null) {
    clearInterval(logsPollTimer);
    logsPollTimer = null;
  }
}

watch(
  () => [props.accountId, props.mountUrl] as const,
  () => {
    stopPollers();
    revokeQrUrl();
    account.value = null;
    logs.value = [];
    if (props.accountId && props.mountUrl) {
      void bootWorkspace();
      startPollers();
    }
  },
  { immediate: true },
);

watch(
  () => props.system,
  (next) => {
    if (next) systemLocal.value = next;
  },
);

onUnmounted(() => {
  stopPollers();
  revokeQrUrl();
});

defineExpose({
  saveSettings,
  saveBusy,
  loadBusy,
  pageTitle,
  statusLine,
  account,
});
</script>

<template>
  <div
    class="protocol-account-workspace"
    :class="{ 'protocol-account-workspace--dialog': isDialog }"
  >
    <div
      v-if="loadBusy && !account"
      class="protocol-account-workspace__loading muted"
    >
      加载账号信息…
    </div>

    <template v-else>
      <nav
        class="protocol-account-workspace__tabs"
        aria-label="账号分区"
      >
        <div
          class="console-view-toggle console-view-toggle--full"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': activeTab === 'overview' }"
            :aria-selected="activeTab === 'overview'"
            @click="switchTab('overview')"
          >
            <ConsoleNavIcon
              name="activity"
              :size="16"
            />
            <span>概览</span>
          </button>
          <button
            type="button"
            role="tab"
            :class="{ 'is-on': activeTab === 'settings' }"
            :aria-selected="activeTab === 'settings'"
            @click="switchTab('settings')"
          >
            <ConsoleNavIcon
              name="settings"
              :size="16"
            />
            <span>设置</span>
          </button>
        </div>
      </nav>

      <section
        v-show="activeTab === 'overview'"
        class="protocol-account-workspace__section"
        aria-label="账号概览"
      >
        <div class="protocol-account-workspace__metrics">
          <StatCard
            v-for="metric in statusMetrics"
            :key="metric.label"
            dense
            :label="metric.label"
            :value="metric.value"
            :hint="metric.hint"
          />
        </div>

        <UiCard
          tag="div"
          glass
          class="protocol-account-workspace__panel"
          :class="{ 'protocol-account-workspace__panel--compact': isDialog }"
        >
          <div
            v-if="!isDialog"
            class="panel__hd panel__hd--split protocol-account-workspace__panel-hd"
          >
            <div>
              <h3 class="panel__title">
                进程控制
              </h3>
              <p class="muted protocol-account-workspace__panel-lead">
                启动、停止或重启本账号的协议端进程。
              </p>
            </div>
          </div>
          <div
            class="panel__bd protocol-account-workspace__process"
            :class="{ 'protocol-account-workspace__process--dialog': isDialog }"
          >
            <p
              v-if="isDialog"
              class="muted protocol-account-workspace__inline-lead"
            >
              启动、停止或重启协议端进程。
            </p>
            <div class="protocol-account-workspace__actions">
            <UiButton
              variant="outline"
              :disabled="actionBusy"
              @click="runAction('start')"
            >
              启动
            </UiButton>
            <UiButton
              variant="outline"
              :disabled="actionBusy"
              @click="runAction('stop')"
            >
              停止
            </UiButton>
            <UiButton
              variant="outline"
              :disabled="actionBusy"
              @click="runAction('restart')"
            >
              重启
            </UiButton>
            <UiButton
              v-if="isSnowluma"
              variant="outline"
              :disabled="injectBusy"
              @click="injectHook"
            >
              注入 Hook
            </UiButton>
            <UiButton
              variant="destructive"
              @click="deleteAccount"
            >
              删除账号
            </UiButton>
            </div>
            <div
              v-if="!isSnowluma && nativeWebUiHref"
              class="protocol-account-workspace__extras"
            >
              <a
                class="protocol-account-workspace__extra-link"
                :href="nativeWebUiHref"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开 NapCat WebUI
              </a>
            </div>
            <div
              v-if="showSnowlumaAccess"
              class="protocol-account-workspace__snowluma-access"
            >
              <div
                v-if="isSnowlumaDocker"
                class="protocol-account-workspace__snowluma-block"
              >
                <div class="protocol-account-workspace__snowluma-block-title">
                  SnowLuma 桌面（noVNC）
                </div>
                <p
                  v-if="snowlumaNovncHref"
                  class="muted protocol-account-workspace__snowluma-lead"
                >
                  容器启动后可通过 noVNC 进入 QQ 桌面；连接 VNC 时填写口令
                  <code class="mono">{{ snowlumaNovncHint }}</code>。
                </p>
                <p
                  v-else
                  class="muted protocol-account-workspace__snowluma-lead"
                >
                  当前未发布 noVNC 宿主机端口；请在「设置」中填写或留空以自动分配。
                </p>
                <a
                  v-if="snowlumaNovncHref"
                  class="protocol-account-workspace__extra-link"
                  :href="snowlumaNovncHref"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开 noVNC
                </a>
              </div>
              <div class="protocol-account-workspace__snowluma-secrets">
                <p
                  v-if="snowlumaManagedPassword"
                  class="protocol-account-workspace__extra-item muted"
                >
                  托管 WebUI 口令（Bot 自动改密）：
                  <code class="mono">{{ snowlumaWebuiUser }}</code>
                  /
                  <code class="mono">{{ snowlumaManagedPassword }}</code>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    class="protocol-account-workspace__copy-btn"
                    @click="copySnowlumaSecret('托管 WebUI 口令', `${snowlumaWebuiUser}/${snowlumaManagedPassword}`)"
                  >
                    复制
                  </UiButton>
                </p>
                <p
                  v-if="snowlumaInitialPassword"
                  class="protocol-account-workspace__extra-item muted"
                >
                  SnowLuma 初始口令（日志，改密前）：
                  <code class="mono">{{ snowlumaInitialPassword }}</code>
                  <UiButton
                    variant="ghost"
                    size="sm"
                    class="protocol-account-workspace__copy-btn"
                    @click="copySnowlumaSecret('初始口令', snowlumaInitialPassword)"
                  >
                    复制
                  </UiButton>
                </p>
                <a
                  v-if="nativeWebUiHref"
                  class="protocol-account-workspace__extra-link"
                  :href="nativeWebUiHref"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  打开 SnowLuma 原生 WebUI
                </a>
              </div>
            </div>
          </div>
        </UiCard>

        <UiCard
          tag="div"
          glass
          class="protocol-account-workspace__panel"
          :class="{ 'protocol-account-workspace__panel--compact': isDialog }"
        >
          <div
            class="panel__hd panel__hd--split friends-groups-hd-pin-wrap"
            :class="{ 'protocol-account-workspace__login-hd--dialog': isDialog }"
          >
            <div class="protocol-account-workspace__qr-head">
              <h3
                v-if="!isDialog"
                class="panel__title"
              >
                登录
              </h3>
              <p class="muted protocol-account-workspace__panel-lead">
                {{ qrHint || "加载中…" }}
              </p>
            </div>
            <UiButton
              variant="outline"
              :disabled="qrRefreshBusy"
              :busy="qrRefreshBusy"
              @click="refreshQrcode(true)"
            >
              恢复登录
            </UiButton>
          </div>
          <div
            v-if="qrExists && qrImageUrl"
            class="panel__bd protocol-account-workspace__qr-body"
          >
            <img
              :src="qrImageUrl"
              alt="登录二维码"
              class="protocol-account-workspace__qr-img"
            >
          </div>
        </UiCard>

        <UiCard
          tag="div"
          glass
          class="protocol-account-workspace__panel protocol-account-workspace__panel--logs"
          :class="{ 'protocol-account-workspace__panel--compact': isDialog }"
        >
          <div
            v-if="!isDialog"
            class="panel__hd panel__hd--split"
          >
            <div>
              <h3 class="panel__title">
                协议进程日志
              </h3>
              <p class="muted protocol-account-workspace__panel-lead">
                最近输出，每 5 秒自动刷新。
              </p>
            </div>
          </div>
          <div
            v-else
            class="panel__hd protocol-account-workspace__log-hd"
          >
            <span class="panel__title protocol-account-workspace__log-title">协议进程日志</span>
            <span class="muted protocol-account-workspace__log-meta">每 5 秒刷新</span>
          </div>
          <div class="panel__bd protocol-account-workspace__log-wrap">
            <pre class="protocol-account-workspace__log-pre">{{ logs.join("\n") || "暂无进程输出" }}</pre>
          </div>
        </UiCard>
      </section>

      <section
        v-show="activeTab === 'settings'"
        class="protocol-account-workspace__section"
        aria-label="账号设置"
      >
        <UiCard
          tag="div"
          glass
          class="protocol-account-workspace__panel"
          :class="{ 'protocol-account-workspace__panel--compact': isDialog }"
        >
          <div
            v-if="!isDialog"
            class="panel__hd panel__hd--split"
          >
            <div>
              <h3 class="panel__title">
                连接与实例
              </h3>
              <p class="muted protocol-account-workspace__panel-lead">
                保存后将重启协议进程以使配置生效。
              </p>
            </div>
          </div>
          <div
            v-else
            class="panel__hd protocol-account-workspace__settings-hd"
          >
            <h3 class="panel__title">
              连接与实例
            </h3>
            <p class="muted protocol-account-workspace__panel-lead">
              保存后将重启协议进程以使配置生效。
            </p>
          </div>
          <div class="panel__bd protocol-account-workspace__form-grid">
            <label class="field">
              <span class="field__label">实例名</span>
              <span class="field__hint muted">控制台与列表中的展示称呼。</span>
              <input
                v-model="displayName"
                class="inp"
                type="text"
                autocomplete="off"
              >
            </label>
            <label class="field">
              <span class="field__label">内置 WebUI 端口</span>
              <span class="field__hint muted">协议端自带 Web 控制台监听端口。</span>
              <input
                v-model="webuiPort"
                class="inp"
                type="number"
                min="1"
                max="65535"
              >
            </label>
            <label class="field field--full">
              <span class="field__label">WS 连接地址</span>
              <span class="field__hint muted">Bot 连接 OneBot WebSocket 的完整地址。</span>
              <input
                v-model="wsUrl"
                class="inp"
                type="text"
                autocomplete="off"
                placeholder="ws://127.0.0.1:8088/onebot/v11/ws"
              >
            </label>
            <label class="field">
              <span class="field__label">连接名</span>
              <span class="field__hint muted">实例列表里显示的连接标识。</span>
              <input
                v-model="wsName"
                class="inp"
                type="text"
                autocomplete="off"
              >
            </label>
            <label class="field">
              <span class="field__label">WS Token</span>
              <span class="field__hint muted">须与协议端鉴权配置一致。</span>
              <input
                v-model="wsToken"
                class="inp"
                type="password"
                autocomplete="off"
              >
            </label>
            <div
              v-if="!isDialog"
              class="field field--full protocol-account-workspace__save-row"
            >
              <UiButton
                variant="primary"
                :disabled="saveBusy"
                :busy="saveBusy"
                @click="saveSettings"
              >
                保存并重启
              </UiButton>
            </div>
          </div>
        </UiCard>
      </section>
    </template>
  </div>
</template>

<style scoped>
.protocol-account-workspace {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.protocol-account-workspace--dialog {
  gap: 12px;
}

.protocol-account-workspace__loading {
  padding: 24px 16px;
  text-align: center;
  font-size: 0.875rem;
}

.protocol-account-workspace__tabs {
  width: 100%;
}

.protocol-account-workspace__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.protocol-account-workspace__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.protocol-account-workspace__panel.ui-card :deep(.ui-card__content) {
  padding: 0;
}

.protocol-account-workspace__panel--compact.ui-card :deep(.panel__hd) {
  padding: 10px 14px 0;
}

.protocol-account-workspace__panel--compact.ui-card :deep(.panel__bd) {
  padding: 10px 14px 14px;
}

.protocol-account-workspace__process--dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.protocol-account-workspace__inline-lead {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.protocol-account-workspace__login-hd--dialog {
  padding-top: 10px;
}

.protocol-account-workspace__settings-hd {
  padding: 12px 14px 0;
}

.protocol-account-workspace__log-hd {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px 0;
}

.protocol-account-workspace__log-title {
  margin: 0;
  font-size: 0.9rem;
}

.protocol-account-workspace__log-meta {
  font-size: 0.75rem;
  white-space: nowrap;
}

.protocol-account-workspace__form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
}

.protocol-account-workspace__form-grid .field--full {
  grid-column: 1 / -1;
}

.protocol-account-workspace__form-grid .field__label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-muted);
  line-height: 1.35;
}

.protocol-account-workspace__form-grid .field__hint {
  display: block;
  margin: 0 0 6px;
  font-size: 0.75rem;
  line-height: 1.4;
}

.protocol-account-workspace__panel-lead {
  margin: 4px 0 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.protocol-account-workspace__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.protocol-account-workspace__extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
}

.protocol-account-workspace__snowluma-access {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.protocol-account-workspace__snowluma-block {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: color-mix(in srgb, var(--text) 3%, var(--bg-card));
}

.protocol-account-workspace__snowluma-block-title {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.35;
  margin-bottom: 6px;
}

.protocol-account-workspace__snowluma-lead {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.protocol-account-workspace__snowluma-secrets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.protocol-account-workspace__copy-btn {
  margin-left: 4px;
  vertical-align: middle;
}

.protocol-account-workspace__extra-item {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.protocol-account-workspace__extra-item code {
  font-size: 0.78rem;
}

.protocol-account-workspace__extra-link {
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--accent);
  text-decoration: none;
}

.protocol-account-workspace__extra-link:hover {
  text-decoration: underline;
}

.protocol-account-workspace__qr-head {
  min-width: 0;
}

.protocol-account-workspace__qr-body {
  display: flex;
  justify-content: center;
  padding-top: 0;
}

.protocol-account-workspace__qr-img {
  display: block;
  width: min(240px, 100%);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
}

.protocol-account-workspace__log-wrap {
  padding-top: 0;
}

.protocol-account-workspace__log-pre {
  max-height: min(36vh, 280px);
  overflow: auto;
  margin: 0;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--text) 4%, var(--bg-card));
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.protocol-account-workspace--dialog .protocol-account-workspace__log-pre {
  max-height: min(28vh, 220px);
}

.protocol-account-workspace__save-row {
  display: flex;
  justify-content: flex-start;
  padding-top: 4px;
}

@media (max-width: 900px) {
  .protocol-account-workspace__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .protocol-account-workspace__metrics {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .protocol-account-workspace__form-grid {
    grid-template-columns: 1fr;
  }

  .protocol-account-workspace__extras,
  .protocol-account-workspace__snowluma-secrets {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .protocol-account-workspace__panel-hd.panel__hd--split,
  .protocol-account-workspace__panel .panel__hd.friends-groups-hd-pin-wrap {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 8px 10px;
  }

  .protocol-account-workspace__actions .ui-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  .protocol-account-workspace__actions .ui-btn:last-child {
    flex-basis: 100%;
  }
}
</style>
