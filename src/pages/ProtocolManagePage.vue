<script setup lang="ts">
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, unref, watch } from "vue";
import {
  fetchInstances,
  fetchSystem,
  patchInstancesProtocolAccounts,
  peekInstancesCache,
} from "@/api/consoleApi";
import {
  protocolApiErrorMessage,
  protocolDeleteAccount,
  protocolListAccounts,
  protocolRestartAccount,
  protocolStartAccount,
  protocolStopAccount,
} from "@/api/protocolApi";
import { useProtocolAccountBatch } from "@/composables/useProtocolAccountBatch";
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import ConsoleCardBulkBar from "@/components/ConsoleCardBulkBar.vue";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal.vue";
import ProtocolAccountQrcodeModal from "@/components/ProtocolAccountQrcodeModal.vue";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import { useCardBulkSelection } from "@/composables/useCardBulkSelection";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
import { isProtocolExtensionInstalled } from "@/utils/protocolExtension";
import {
  isExternalProtocolAccount,
  isPluginManagedProtocolAccount,
  mergeProtocolDisplayAccounts,
} from "@/utils/protocolDisplayAccounts";
import {
  accountConnectedWsPortLabel,
  accountProtocolId,
  accountWebUiHref,
  protocolAccountDetailUrl,
  protocolDashboardUrl,
  protocolMountAbsoluteUrl,
  protocolSnapshot,
} from "@/utils/protocolLinks";
import {
  coerceBoolean,
  protocolBackendDisplayName,
  protocolDisp,
  protocolRuntimeModeLabel,
  protocolRuntimeVersionText,
  protocolAccountsSignature,
  type ProtocolDisp,
} from "@/utils/protocolUi";
import { slicePage } from "@/utils/paginate";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import UiButton from "@/components/ui/UiButton.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { botFavoriteAccounts, toggleFavoriteBot } from "@/utils/botFavorites";
import { useInstancesCatalogSync } from "@/composables/useInstancesCatalogSync";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const system = ref<SystemData | null>(null);
const instances = ref<InstancesData | null>(null);
{
  const warmInst = peekInstancesCache();
  if (warmInst) instances.value = warmInst;
}

const protoAccountsLive = ref<NapcatAccountRow[] | null>(null);

const snap = computed(() => {
  const base = protocolSnapshot(instances.value);
  if (!base) return null;
  if (protoAccountsLive.value != null) {
    return { ...base, accounts: protoAccountsLive.value };
  }
  return base;
});
const protocolExtensionInstalled = computed(() =>
  isProtocolExtensionInstalled(instances.value),
);
const skeletonPanels = computed(() => (protocolExtensionInstalled.value ? 2 : 1));
const dashUrl = computed(() => protocolDashboardUrl(system.value, snap.value));
const protoMountUrl = computed(() => protocolMountAbsoluteUrl(system.value, snap.value));
const protoActionsEnabled = computed(() => Boolean(protoMountUrl.value && snap.value?.webui_enabled));

const bulk = useCardBulkSelection<string>();
const deleteModalOpen = ref(false);
const deleteBusy = ref(false);
const deleteErr = ref("");
const restartSelectedBusy = ref(false);
const restartAllBusy = ref(false);
const batch = useProtocolAccountBatch(() => protoMountUrl.value);
const qrcodeModalOpen = ref(false);
const qrcodeTarget = ref<{ id: string; title: string } | null>(null);

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

const protoAccPage = ref(1);
const protoSearchQ = ref("");
const protoView = ref<"table" | "cards">(consolePrefs.protocolAccountsView);
const expProtocolAccounts = ref(true);
const loadBusy = ref(false);
type ProtocolAccountAction = "power" | "restart";
const actionBusy = ref(new Set<string>());
/** 协议账号快照轮询（毫秒）；标签页隐藏时跳过 */
const PROTO_POLL_MS = 5000;
let protoPollTimer: ReturnType<typeof setInterval> | null = null;
/** 路由离屏后忽略在途轮询写回，避免切换页时触发全局目录 epoch */
const protoRouteActive = ref(false);
let lastLiveProtocolAccountsSig = "";

const webuiEnabledDisp = computed(() => protocolDisp(snap.value?.webui_enabled, "已启用", "未启用"));
const consoleAuthDisp = computed(() =>
  protocolDisp(snap.value?.console_auth_configured, "已配置", "未配置"),
);

const protocolAccountsSorted = computed(() => {
  const pluginAccounts = protoAccountsLive.value ?? snap.value?.accounts ?? [];
  const list = mergeProtocolDisplayAccounts(instances.value, pluginAccounts);
  list.sort((a, b) => {
    const fa = protocolAccountNumber(a);
    const fb = protocolAccountNumber(b);
    const favA = fa != null && botFavoriteAccounts.value.has(fa) ? 1 : 0;
    const favB = fb != null && botFavoriteAccounts.value.has(fb) ? 1 : 0;
    if (favA !== favB) return favB - favA;
    const ca = a.connected === true ? 1 : 0;
    const cb = b.connected === true ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = profileNick(a).toLowerCase();
    const nb = profileNick(b).toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return String(a.qq ?? a.id ?? "").localeCompare(String(b.qq ?? b.id ?? ""), "zh-CN", { numeric: true });
  });
  return list;
});

const filteredProtocolAccounts = computed(() => {
  const q = protoSearchQ.value.trim().toLowerCase();
  if (!q) return protocolAccountsSorted.value;
  return protocolAccountsSorted.value.filter((a) => {
    const hay = [
      String(a.qq ?? ""),
      String(a.id ?? ""),
      profileNick(a),
      primaryTitle(a),
      accountProtocolId(a) ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
});

const pagedProtocolAccounts = computed(() =>
  slicePage(filteredProtocolAccounts.value, protoAccPage.value, tablePageSize.value),
);

const pagedProtocolIds = computed(() =>
  pagedProtocolAccounts.value
    .filter((a) => isPluginManagedProtocolAccount(a))
    .map((a) => accountProtocolId(a))
    .filter((id): id is string => Boolean(id)),
);

const protoCardsPageAllSelected = computed(() => bulk.pageAllSelected(pagedProtocolIds.value));

const protocolConnectedCount = computed(
  () => protocolAccountsSorted.value.filter((a) => a.connected === true).length,
);

const protocolAccountsTotalCount = computed(() => protocolAccountsSorted.value.length);

const accountById = computed(() => {
  const map = new Map<string, NapcatAccountRow>();
  for (const a of protocolAccountsSorted.value) {
    const id = accountProtocolId(a);
    if (id) map.set(id, a);
  }
  return map;
});

const deleteModalItems = computed(() =>
  bulk.sortedSelected.value.map((id) => {
    const a = accountById.value.get(id);
    const title = a ? primaryTitle(a) : id;
    const qq = a?.qq ?? a?.id ?? id;
    return { key: id, label: `${title} · ${qq}` };
  }),
);

const protoDeleteSubtitle = computed(
  () =>
    `将删除以下账号（共 ${bulk.sortedSelected.value.length} 个），协议端账号将被移除，数据目录是否保留取决于主仓配置，操作不可撤销。`,
);

const deleteModalWarnings = computed(() => {
  const running: string[] = [];
  const connected: string[] = [];
  for (const id of bulk.sortedSelected.value) {
    const a = accountById.value.get(id);
    if (!a) continue;
    if (isProcessRunning(a)) running.push(id);
    if (a.connected === true) connected.push(id);
  }
  const out: string[] = [];
  if (running.length) {
    out.push(`以下账号进程仍在运行：${running.join("、")}。删除前将尝试停止，请确认。`);
  }
  if (connected.length) {
    out.push(
      `其中以下账号当前仍在线连接：${connected.join("、")}。删除后可能导致运行异常，请确认。`,
    );
  }
  return out;
});

watch(
  () => consolePrefs.tablePageSize,
  () => {
    protoAccPage.value = 1;
  },
);

watch(protoSearchQ, () => {
  protoAccPage.value = 1;
});

function setProtoView(v: "table" | "cards") {
  protoView.value = v;
  setConsolePrefs({ protocolAccountsView: v });
}

watch(
  () =>
    (snap.value?.accounts ?? [])
      .map((a) => accountProtocolId(a))
      .filter((id): id is string => Boolean(id))
      .join("\0"),
  (next, prev) => {
    if (next === prev) return;
    protoAccPage.value = 1;
    const known = new Set(next ? next.split("\0") : []);
    bulk.pruneSelection(known);
  },
);

function syncBodyOverflow() {
  if (typeof document === "undefined") return;
  document.body.style.overflow =
    deleteModalOpen.value || qrcodeModalOpen.value ? "hidden" : "";
}

watch(deleteModalOpen, () => {
  syncBodyOverflow();
});

watch(qrcodeModalOpen, () => {
  syncBodyOverflow();
});


function protocolAccountNumber(a: NapcatAccountRow): number | null {
  const q = parseInt(String(a.qq ?? a.id ?? "").replace(/\s/g, ""), 10);
  if (Number.isFinite(q) && q > 0) return Math.floor(q);
  return null;
}

function profileNick(a: NapcatAccountRow): string {
  const q = protocolAccountNumber(a);
  const nick = q != null ? instances.value?.bot_profiles?.[String(q)]?.nickname?.trim() : "";
  if (nick) return nick;
  return String(a.display_name ?? "").trim();
}

function webUiHref(a: NapcatAccountRow): string | null {
  return accountWebUiHref(a, system.value);
}

function detailHref(a: NapcatAccountRow): string | null {
  const id = accountProtocolId(a);
  if (!id) return null;
  return protocolAccountDetailUrl(system.value, snap.value, id);
}

function primaryTitle(a: NapcatAccountRow): string {
  const nick = profileNick(a);
  if (nick) return nick;
  return "BOT";
}

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

function pillLabel(d: ProtocolDisp): string {
  return d.kind === "pill" ? (d.on ? d.onLabel : d.offLabel) : d.text;
}

function pillOn(d: ProtocolDisp): boolean {
  return d.kind === "pill" && d.on;
}

function isProcessRunning(a: NapcatAccountRow): boolean {
  return coerceBoolean(a.process_running ?? a.running) === true;
}

function runningCapsuleClass(a: NapcatAccountRow): string {
  if (isExternalProtocolAccount(a)) return "muted";
  return isProcessRunning(a)
    ? "data-conn-capsule data-conn-capsule--run"
    : "data-conn-capsule data-conn-capsule--off";
}

function processStateLabel(a: NapcatAccountRow): string {
  if (isExternalProtocolAccount(a)) return "—";
  return isProcessRunning(a) ? "运行中" : "未运行";
}

function cardKey(a: NapcatAccountRow, index: number): string {
  return accountProtocolId(a) ?? `row-${index}`;
}

function actionBusyKey(accountId: string, action: ProtocolAccountAction): string {
  return `${action}:${accountId}`;
}

function isAccountActionBusy(a: NapcatAccountRow, action: ProtocolAccountAction): boolean {
  const id = accountProtocolId(a);
  return Boolean(id && actionBusy.value.has(actionBusyKey(id, action)));
}

function isAnyAccountActionBusy(a: NapcatAccountRow): boolean {
  return isAccountActionBusy(a, "power") || isAccountActionBusy(a, "restart");
}

function setAccountActionBusy(accountId: string, action: ProtocolAccountAction, busy: boolean) {
  const key = actionBusyKey(accountId, action);
  const next = new Set(actionBusy.value);
  if (busy) next.add(key);
  else next.delete(key);
  actionBusy.value = next;
}

function togglePowerLabel(a: NapcatAccountRow): string {
  const running = isProcessRunning(a);
  if (isAccountActionBusy(a, "power")) return running ? "停止中…" : "启动中…";
  return running ? "停止" : "启动";
}

function restartLabel(a: NapcatAccountRow): string {
  return isAccountActionBusy(a, "restart") ? "重启中…" : "重启";
}

function openDeleteModal() {
  if (bulk.selectedCount.value === 0) return;
  deleteErr.value = "";
  deleteModalOpen.value = true;
}

function closeDeleteModal() {
  if (deleteBusy.value) return;
  deleteModalOpen.value = false;
  deleteErr.value = "";
}

function openQrcodeModal(a: NapcatAccountRow) {
  const id = accountProtocolId(a);
  if (!protoMountUrl.value || !id) {
    pushConsoleToast("无法打开二维码：协议端未启用或缺少账号 ID", "warn");
    return;
  }
  qrcodeTarget.value = { id, title: primaryTitle(a) };
  qrcodeModalOpen.value = true;
}

function closeQrcodeModal() {
  qrcodeModalOpen.value = false;
  qrcodeTarget.value = null;
}

function shouldSkipProtoPoll(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return true;
  if (deleteModalOpen.value || deleteBusy.value) return true;
  if (qrcodeModalOpen.value) return true;
  if (restartSelectedBusy.value) return true;
  if (actionBusy.value.size > 0) return true;
  return false;
}

function applyProtocolAccounts(accounts: NapcatAccountRow[]) {
  if (!protoRouteActive.value) return;
  const sig = protocolAccountsSignature(accounts);
  if (sig === lastLiveProtocolAccountsSig && protoAccountsLive.value != null) return;
  lastLiveProtocolAccountsSig = sig;
  protoAccountsLive.value = accounts;
  patchInstancesProtocolAccounts(accounts, instances.value);
  const warm = peekInstancesCache();
  if (warm) instances.value = warm;
}

async function pollProtocolAccounts() {
  if (!protoRouteActive.value) return;
  const mount = protoMountUrl.value;
  if (!mount) return;
  try {
    const accounts = await protocolListAccounts(mount);
    applyProtocolAccounts(accounts);
  } catch {
    /* 保留上一轮账号快照 */
  }
}

function startProtoPolling() {
  if (typeof window === "undefined" || protoPollTimer != null) return;
  protoPollTimer = setInterval(() => {
    if (shouldSkipProtoPoll()) return;
    void pollProtocolAccounts();
  }, PROTO_POLL_MS);
}

function stopProtoPolling() {
  if (protoPollTimer == null) return;
  clearInterval(protoPollTimer);
  protoPollTimer = null;
}

function onProtoVisibilityChange() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible" && !shouldSkipProtoPoll()) {
    void pollProtocolAccounts();
  }
}

async function load(opts?: { silent?: boolean }) {
  const silent = Boolean(opts?.silent);
  if (!silent) {
    err.value = "";
    loadBusy.value = true;
  }
  try {
    const [s, i] = await Promise.all([fetchSystem(), fetchInstances({ bypassCache: true })]);
    system.value = s;
    instances.value = i;
  } catch (e) {
    if (!silent) err.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (!silent) loadBusy.value = false;
  }
}

async function refreshAfterAction() {
  protoAccountsLive.value = null;
  lastLiveProtocolAccountsSig = "";
  try {
    instances.value = await fetchInstances({ bypassCache: true });
    await pollProtocolAccounts();
  } catch {
    /* 操作已成功，快照刷新失败不阻断 */
  }
}

async function toggleAccountPower(a: NapcatAccountRow) {
  const mount = protoMountUrl.value;
  const id = accountProtocolId(a);
  if (!mount || !id) {
    pushConsoleToast("无法操作：协议端未启用或缺少账号 ID", "warn");
    return;
  }
  if (isAnyAccountActionBusy(a)) return;
  const stop = isProcessRunning(a);
  setAccountActionBusy(id, "power", true);
  try {
    if (stop) {
      await protocolStopAccount(mount, id);
      pushConsoleToast(`已停止 ${primaryTitle(a)}`, "warn");
    } else {
      await protocolStartAccount(mount, id);
      pushConsoleToast(`已启动 ${primaryTitle(a)}`, "ok");
    }
    await refreshAfterAction();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, stop ? "停止失败" : "启动失败"), "err");
  } finally {
    setAccountActionBusy(id, "power", false);
  }
}

async function restartAccount(a: NapcatAccountRow) {
  const mount = protoMountUrl.value;
  const id = accountProtocolId(a);
  if (!mount || !id) {
    pushConsoleToast("无法操作：协议端未启用或缺少账号 ID", "warn");
    return;
  }
  if (isAnyAccountActionBusy(a)) return;
  setAccountActionBusy(id, "restart", true);
  try {
    await protocolRestartAccount(mount, id);
    pushConsoleToast(`已重启 ${primaryTitle(a)}`, "ok");
    await refreshAfterAction();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "重启失败"), "err");
  } finally {
    setAccountActionBusy(id, "restart", false);
  }
}

async function restartSelectedAccounts() {
  const mount = protoMountUrl.value;
  const ids = bulk.sortedSelected.value;
  if (!mount) {
    pushConsoleToast("无法操作：协议端未启用", "warn");
    return;
  }
  if (!ids.length) {
    pushConsoleToast("请先勾选要重启的账号", "warn");
    return;
  }
  if (restartSelectedBusy.value) return;
  restartSelectedBusy.value = true;
  try {
    const job = await batch.runBatch(
      { action: "restart", account_ids: ids, mode: "rolling" },
      `将按间隔依次重启 ${ids.length} 个账号，以降低系统负载。继续？`,
    );
    if (!job) {
      if (batch.batchErr.value) pushConsoleToast(batch.batchErr.value, "err");
      return;
    }
    const failed = (job.results ?? []).filter((r) => !r.ok).length;
    pushConsoleToast(
      failed ? `重启完成，${failed} 个失败` : `已重启 ${ids.length} 个账号`,
      failed ? "warn" : "ok",
    );
    await refreshAfterAction();
  } finally {
    restartSelectedBusy.value = false;
    batch.closeBatchPanel();
  }
}

async function restartAllAccounts() {
  const mount = protoMountUrl.value;
  const ids = protocolAccountsSorted.value
    .map((a) => accountProtocolId(a))
    .filter((id): id is string => Boolean(id));
  if (!mount || !ids.length) {
    pushConsoleToast("当前没有可重启的账号", "warn");
    return;
  }
  if (restartAllBusy.value) return;
  restartAllBusy.value = true;
  try {
    const job = await batch.runBatch(
      { action: "restart", account_ids: ids, mode: "rolling" },
      `将按间隔依次重启全部 ${ids.length} 个账号。继续？`,
    );
    if (!job) {
      if (batch.batchErr.value) pushConsoleToast(batch.batchErr.value, "err");
      return;
    }
    const failed = (job.results ?? []).filter((r) => !r.ok).length;
    pushConsoleToast(failed ? `重启完成，${failed} 个失败` : "已重启全部账号", failed ? "warn" : "ok");
    await refreshAfterAction();
  } finally {
    restartAllBusy.value = false;
    batch.closeBatchPanel();
  }
}

async function confirmDeleteSelected() {
  const mount = protoMountUrl.value;
  const ids = bulk.sortedSelected.value;
  if (!mount || !ids.length) return;
  deleteBusy.value = true;
  deleteErr.value = "";
  try {
    for (const id of ids) {
      await protocolDeleteAccount(mount, id);
    }
    pushConsoleToast(`已删除 ${ids.length} 个账号`, "warn");
    bulk.clearSelection();
    deleteModalOpen.value = false;
    await refreshAfterAction();
  } catch (e) {
    deleteErr.value = protocolApiErrorMessage(e, "删除失败");
    await refreshAfterAction();
  } finally {
    deleteBusy.value = false;
  }
}

useInstancesCatalogSync(instances, { pageReady });

onMounted(async () => {
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onProtoVisibilityChange);
  }
  try {
    await load();
    await pollProtocolAccounts();
  } finally {
    pageReady.value = true;
  }
});

onActivated(() => {
  protoRouteActive.value = true;
  startProtoPolling();
  if (pageReady.value) {
    void pollProtocolAccounts();
    void fetchInstances({ bypassCache: true })
      .then((i) => {
        if (!protoRouteActive.value) return;
        instances.value = i;
      })
      .catch(() => {});
  }
});

onDeactivated(() => {
  protoRouteActive.value = false;
  lastLiveProtocolAccountsSig = "";
  stopProtoPolling();
  deleteModalOpen.value = false;
  deleteErr.value = "";
  qrcodeModalOpen.value = false;
  qrcodeTarget.value = null;
  syncBodyOverflow();
});

onUnmounted(() => {
  protoRouteActive.value = false;
  stopProtoPolling();
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onProtoVisibilityChange);
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div
    v-if="err"
    class="alert alert--err"
  >
    {{ err }}
  </div>

  <div class="console-hub-page">
    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="skeletonPanels"
    />
    <template v-else>
    <div
      v-if="batch.batchOpen.value"
      class="protocol-page__batch panel"
      role="status"
      aria-live="polite"
    >
      <div class="protocol-page__batch-track">
        <div
          class="protocol-page__batch-fill"
          :style="{ width: `${batch.batchProgressPercent()}%` }"
        />
      </div>
      <p class="muted protocol-page__batch-msg">
        {{ batch.batchBusy.value ? batch.batchPhaseLabel() || "批量任务进行中…" : batch.batchPhaseLabel() }}
      </p>
    </div>
    <UiCard
      tag="div"
      glass
      class="protocol-page__panel"
    >
      <div class="panel__hd panel__hd--split inst-db-panel__hd">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="panelNavIcon"
          />已连接账号
          <RefreshIconButton
            :show-label="false"
            :busy="loadBusy"
            label="刷新实例数据"
            @click="load"
          />
        </h2>
        <div class="inst-db-panel__hd-side">
          <UiButton
            variant="outline"
            class="panel-hd-collapse-btn"
            @click="expProtocolAccounts = !expProtocolAccounts"
          >
            {{ expProtocolAccounts ? "收起" : "展开" }}
          </UiButton>
          <div
            class="console-view-toggle"
            role="group"
            aria-label="实例表格或卡片视图"
          >
            <button
              type="button"
              :class="{ 'is-on': protoView === 'table' }"
              @click="setProtoView('table')"
            >
              表格
            </button>
            <button
              type="button"
              :class="{ 'is-on': protoView === 'cards' }"
              @click="setProtoView('cards')"
            >
              卡片
            </button>
          </div>
        </div>
        <div class="inst-db-panel__actions">
          <div class="inst-db-panel__stat-search">
            <span class="inst-db-stat muted">
              当前已连接
              <strong class="inst-db-stat__num">{{ protocolConnectedCount }}</strong>
              / {{ protocolAccountsTotalCount }} 账号
            </span>
            <input
              v-model="protoSearchQ"
              class="inp inst-db-search"
              type="search"
              placeholder="搜索账号 / 昵称 / 协议 / ID"
              title="按账号、昵称、协议、ID 筛选"
            >
          </div>
          <UiButton
            v-if="protoActionsEnabled"
            variant="outline"
            :disabled="
              restartAllBusy ||
              batch.batchBusy.value ||
              protocolAccountsTotalCount === 0 ||
              actionBusy.size > 0
            "
            :busy="restartAllBusy"
            @click="restartAllAccounts"
          >
            {{ restartAllBusy ? "重启全部中…" : "重启全部" }}
          </UiButton>
          <UiButton
            v-if="protoActionsEnabled"
            variant="outline"
            :disabled="
              restartSelectedBusy ||
              batch.batchBusy.value ||
              unref(bulk.selectedCount) === 0 ||
              actionBusy.size > 0
            "
            :busy="restartSelectedBusy"
            @click="restartSelectedAccounts"
          >
            {{ restartSelectedBusy ? "重启中…" : "重启所选" }}
          </UiButton>
        </div>
      </div>
      <div
        v-show="expProtocolAccounts"
        class="panel__bd"
      >
        <div v-if="protoView === 'table'" class="table-wrap">
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>昵称</th>
                <th>账号</th>
                <th>协议</th>
                <th>运行方式</th>
                <th>版本</th>
                <th>连接</th>
                <th>进程</th>
                <th>WebUI</th>
                <th>WS 端口</th>
                <th style="width: 220px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(a, i) in pagedProtocolAccounts"
                :key="'tbl-' + cardKey(a, i)"
              >
                <td style="font-weight: 600">{{ primaryTitle(a) }}</td>
                <td>{{ a.qq ?? a.id ?? "—" }}</td>
                <td>{{ protocolBackendDisplayName(a) }}</td>
                <td>{{ protocolRuntimeModeLabel(a) }}</td>
                <td
                  class="muted"
                  :title="String(a.runtime_source ?? '').trim() || undefined"
                >{{ protocolRuntimeVersionText(a) }}</td>
                <td>
                  <span
                    :class="
                      a.connected === true
                        ? 'data-conn-capsule data-conn-capsule--on'
                        : 'data-conn-capsule data-conn-capsule--off'
                    "
                  >{{ a.connected === true ? "已连接" : "未连接" }}</span>
                </td>
                <td>
                  <span :class="runningCapsuleClass(a)">{{ processStateLabel(a) }}</span>
                </td>
                <td>
                  <a
                    v-if="webUiHref(a)"
                    class="link-quiet"
                    :href="webUiHref(a)!"
                    target="_blank"
                    rel="noopener noreferrer"
                  >{{ a.webui_port ?? "打开" }}</a>
                  <span
                    v-else
                    class="muted"
                  >—</span>
                </td>
                <td>{{ isExternalProtocolAccount(a) ? "—" : accountConnectedWsPortLabel(a) }}</td>
                <td>
                  <div class="inst-actions protocol-acc-table-actions">
                    <template v-if="isPluginManagedProtocolAccount(a) && protoActionsEnabled">
                    <UiButton
                      v-if="detailHref(a)"
                      variant="outline"
                      size="sm"
                      :href="detailHref(a)!"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      详情
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      :disabled="isAnyAccountActionBusy(a)"
                      :busy="isAnyAccountActionBusy(a)"
                      @click="restartAccount(a)"
                    >
                      {{ restartLabel(a) }}
                    </UiButton>
                    <UiButton
                      variant="outline"
                      size="sm"
                      :disabled="!protoMountUrl || !accountProtocolId(a)"
                      @click="openQrcodeModal(a)"
                    >
                      二维码
                    </UiButton>
                    <UiButton
                      size="sm"
                      :variant="isProcessRunning(a) ? 'outline' : 'primary'"
                      :disabled="isAnyAccountActionBusy(a)"
                      :busy="isAnyAccountActionBusy(a)"
                      @click="toggleAccountPower(a)"
                    >
                      {{ togglePowerLabel(a) }}
                    </UiButton>
                    </template>
                    <button
                      v-if="protocolAccountNumber(a) != null"
                      type="button"
                      class="btn inst-fav-star"
                      :aria-pressed="botFavoriteAccounts.has(protocolAccountNumber(a)!)"
                      :title="
                        botFavoriteAccounts.has(protocolAccountNumber(a)!)
                          ? '取消收藏'
                          : '收藏'
                      "
                      @click="toggleFavoriteBot(protocolAccountNumber(a)!)"
                    >
                      ★
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="protoView === 'table' && filteredProtocolAccounts.length > 0"
          v-model:page="protoAccPage"
          v-model:page-size="tablePageSize"
          :total="filteredProtocolAccounts.length"
        />
        <div
          v-else-if="protoView === 'cards'"
          class="data-card-grid data-card-grid--bots"
        >
          <div
            v-for="(a, i) in pagedProtocolAccounts"
            :key="cardKey(a, i)"
            class="data-summary-card data-summary-card--kv data-summary-card--bot"
          >
            <div class="data-summary-card__head data-summary-card__head--bot">
              <label
                v-if="protoActionsEnabled && accountProtocolId(a) && isPluginManagedProtocolAccount(a)"
                class="inst-db-card-select"
                @click.stop
              >
                <input
                  type="checkbox"
                  :checked="bulk.isSelected(accountProtocolId(a)!)"
                  :aria-label="`选择账号 ${accountProtocolId(a)}`"
                  @change="
                    bulk.setSelected(
                      accountProtocolId(a)!,
                      ($event.target as HTMLInputElement).checked,
                    )
                  "
                >
              </label>
              <div class="data-summary-card__head-main">
                <div class="data-summary-card__title-line">
                  <div class="data-summary-card__primary">
                    <a
                      v-if="detailHref(a)"
                      class="data-summary-card__title-link"
                      :href="detailHref(a)!"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ primaryTitle(a) }}</a>
                    <span v-else>{{ primaryTitle(a) }}</span>
                  </div>
                  <button
                    v-if="protocolAccountNumber(a) != null"
                    type="button"
                    class="data-card-fav-star"
                    :aria-pressed="botFavoriteAccounts.has(protocolAccountNumber(a)!)"
                    :title="
                      botFavoriteAccounts.has(protocolAccountNumber(a)!)
                        ? '取消收藏'
                        : '收藏'
                    "
                    @click.stop="toggleFavoriteBot(protocolAccountNumber(a)!)"
                  >
                    ★
                  </button>
                </div>
                <div class="data-summary-card__secondary muted">
                  {{ a.qq ?? a.id ?? "—" }}
                </div>
              </div>
              <div class="data-summary-card__head-badges">
                <span
                  :class="
                    a.connected === true
                      ? 'data-conn-capsule data-conn-capsule--on'
                      : 'data-conn-capsule data-conn-capsule--off'
                  "
                >{{ a.connected === true ? "已连接" : "未连接" }}</span>
                <span :class="runningCapsuleClass(a)">{{ processStateLabel(a) }}</span>
              </div>
            </div>
            <div class="data-summary-card__body">
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">协议实现</span>
              <span class="data-summary-card__val">{{ protocolBackendDisplayName(a) }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">运行方式</span>
              <span class="data-summary-card__val data-summary-card__val--mode">{{
                protocolRuntimeModeLabel(a)
              }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">版本</span>
              <span
                class="data-summary-card__val data-summary-card__val--version"
                :title="String(a.runtime_source ?? '').trim() || undefined"
              >{{ protocolRuntimeVersionText(a) }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">内置 WebUI</span>
              <a
                v-if="webUiHref(a)"
                class="data-summary-card__val data-summary-card__val--link link-quiet"
                :href="webUiHref(a)!"
                target="_blank"
                rel="noopener noreferrer"
              >{{ a.webui_port ?? "打开" }}</a>
              <span
                v-else
                class="data-summary-card__val muted"
              >{{ a.webui_port ?? "—" }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">WS 端口</span>
              <span class="data-summary-card__val">{{
                isExternalProtocolAccount(a) ? "—" : accountConnectedWsPortLabel(a)
              }}</span>
            </div>
            </div>
            <div
              v-if="isPluginManagedProtocolAccount(a) && protoActionsEnabled"
              class="data-summary-card__tags data-summary-card__foot inst-card-actions"
            >
              <UiButton
                variant="outline"
                size="sm"
                :disabled="!protoActionsEnabled || isAnyAccountActionBusy(a)"
                :busy="isAnyAccountActionBusy(a)"
                @click="restartAccount(a)"
              >
                {{ restartLabel(a) }}
              </UiButton>
              <UiButton
                variant="outline"
                size="sm"
                :disabled="!protoMountUrl || !accountProtocolId(a)"
                @click="openQrcodeModal(a)"
              >
                二维码
              </UiButton>
              <UiButton
                size="sm"
                :variant="isProcessRunning(a) ? 'outline' : 'primary'"
                :disabled="!protoActionsEnabled || isAnyAccountActionBusy(a)"
                :busy="isAnyAccountActionBusy(a)"
                @click="toggleAccountPower(a)"
              >
                {{ togglePowerLabel(a) }}
              </UiButton>
            </div>
          </div>
        </div>
        <ConsolePagerBar
          v-if="protoView === 'cards' && filteredProtocolAccounts.length > 0"
          v-model:page="protoAccPage"
          v-model:page-size="tablePageSize"
          :total="filteredProtocolAccounts.length"
        />
        <ConsoleCardBulkBar
          v-if="protoActionsEnabled && protoView === 'cards' && filteredProtocolAccounts.length > 0"
          :page-all-selected="protoCardsPageAllSelected"
          :selected-count="unref(bulk.selectedCount)"
          :delete-busy="deleteBusy"
          :delete-disabled="!protoActionsEnabled"
          @toggle-select-all="bulk.toggleSelectAllOnPage(pagedProtocolIds)"
          @clear-selection="bulk.clearSelection()"
          @delete="openDeleteModal"
        />
      </div>
    </UiCard>

    <UiCard
      v-if="protocolExtensionInstalled"
      tag="div"
      glass
      class="protocol-page__panel"
    >
      <div class="panel__hd panel__hd--split inst-db-panel__hd">
        <h2 class="panel__title">
          <ConsoleNavIcon
            class="panel__title-ico"
            :name="panelNavIcon"
          />协议端入口
          <RefreshIconButton
            :show-label="false"
            :busy="loadBusy"
            label="刷新协议端数据"
            @click="load"
          />
        </h2>
        <div class="row-actions">
        </div>
      </div>
      <div class="panel__bd">
        <div class="protocol-page__meta console-kv-block">
          <div class="data-summary-card__row">
            <span class="data-summary-card__label">内置 WebUI</span>
            <span
              v-if="webuiEnabledDisp.kind === 'pill'"
              :class="boolPillClass(pillOn(webuiEnabledDisp))"
            >{{ pillLabel(webuiEnabledDisp) }}</span>
            <span
              v-else
              class="muted"
            >{{ pillLabel(webuiEnabledDisp) }}</span>
          </div>
          <p
            v-if="snap?.webui_path"
            class="muted protocol-page__meta-path"
          >
            路径 <code>{{ snap.webui_path }}</code>
          </p>
          <div class="data-summary-card__row">
            <span class="data-summary-card__label">控制台鉴权</span>
            <span
              v-if="consoleAuthDisp.kind === 'pill'"
              :class="boolPillClass(pillOn(consoleAuthDisp))"
            >{{ pillLabel(consoleAuthDisp) }}</span>
            <span
              v-else
              class="muted"
            >{{ pillLabel(consoleAuthDisp) }}</span>
          </div>
        </div>
        <div class="row-actions protocol-page__actions protocol-page__entry-actions">
          <RouterLink
            class="btn secondary"
            to="/protocol/create"
          >
            创建账号
          </RouterLink>
          <RouterLink
            class="btn secondary"
            to="/protocol/import"
          >
            导入账号
          </RouterLink>
          <RouterLink
            class="btn secondary"
            to="/protocol/assets"
          >
            协议资产
          </RouterLink>
          <UiButton
            v-if="dashUrl"
            variant="primary"
            :href="dashUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            内置管理页
          </UiButton>
        </div>
      </div>
    </UiCard>

    <ConsoleDeleteConfirmModal
      :open="deleteModalOpen"
      title="删除账号"
      :subtitle="protoDeleteSubtitle"
      :items="deleteModalItems"
      :warnings="deleteModalWarnings"
      :busy="deleteBusy"
      :error="deleteErr"
      title-id="proto-delete-modal-title"
      @close="closeDeleteModal"
      @confirm="confirmDeleteSelected"
    />
    <ProtocolAccountQrcodeModal
      :open="qrcodeModalOpen"
      :mount-url="protoMountUrl"
      :account-id="qrcodeTarget?.id ?? null"
      :account-title="qrcodeTarget?.title ?? ''"
      @close="closeQrcodeModal"
    />
    </template>
  </div>
</template>

<style scoped>
.protocol-page__meta {
  margin-bottom: 14px;
}

.protocol-page__meta.console-kv-block {
  gap: 2px;
}
.console-kv-block .data-summary-card__row > :not(.data-summary-card__label) {
  justify-self: end;
}
.protocol-page__meta-path {
  margin: 0;
  font-size: 12px;
}
.protocol-page__actions {
  margin-top: 4px;
}

.protocol-acc-table-actions {
  flex-wrap: wrap;
  gap: 4px;
}

</style>
