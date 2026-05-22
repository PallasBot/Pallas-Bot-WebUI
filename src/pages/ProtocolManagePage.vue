<script setup lang="ts">
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
import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";
import ConsoleCardBulkBar from "@/components/ConsoleCardBulkBar.vue";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal.vue";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import { useCardBulkSelection } from "@/composables/useCardBulkSelection";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
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
  type ProtocolDisp,
} from "@/utils/protocolUi";
import { slicePage } from "@/utils/paginate";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
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
const dashUrl = computed(() => protocolDashboardUrl(system.value, snap.value));
const protoMountUrl = computed(() => protocolMountAbsoluteUrl(system.value, snap.value));
const protoActionsEnabled = computed(() => Boolean(protoMountUrl.value && snap.value?.webui_enabled));

const bulk = useCardBulkSelection<string>();
const deleteModalOpen = ref(false);
const deleteBusy = ref(false);
const deleteErr = ref("");

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
const actionBusy = ref(new Set<string>());
/** 协议账号快照轮询（毫秒）；标签页隐藏时跳过 */
const PROTO_POLL_MS = 5000;
let protoPollTimer: ReturnType<typeof setInterval> | null = null;
/** 路由离屏后忽略在途轮询写回，避免切换页时触发全局目录 epoch */
const protoRouteActive = ref(false);

const webuiEnabledDisp = computed(() => protocolDisp(snap.value?.webui_enabled, "已启用", "未启用"));
const consoleAuthDisp = computed(() =>
  protocolDisp(snap.value?.console_auth_configured, "已配置", "未配置"),
);

const protocolAccountsSorted = computed(() => {
  const list = [...(snap.value?.accounts ?? [])];
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
    .map((a) => accountProtocolId(a))
    .filter((id): id is string => Boolean(id)),
);

const protoCardsPageAllSelected = computed(() => bulk.pageAllSelected(pagedProtocolIds.value));

const protocolConnectedCount = computed(
  () => protocolAccountsSorted.value.filter((a) => a.connected === true).length,
);

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
    `将从协议端移除以下账号（共 ${bulk.sortedSelected.value.length} 个），相关数据目录是否保留取决于主仓配置，操作不可撤销。`,
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
    out.push(`以下账号当前仍显示为已连接：${connected.join("、")}。删除后请检查 NoneBot 连接配置。`);
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

watch([snap, () => snap.value?.accounts?.length], () => {
  protoAccPage.value = 1;
  const known = new Set<string>();
  for (const a of snap.value?.accounts ?? []) {
    const id = accountProtocolId(a);
    if (id) known.add(id);
  }
  bulk.pruneSelection(known);
});

function syncBodyOverflow() {
  if (typeof document === "undefined") return;
  document.body.style.overflow = deleteModalOpen.value ? "hidden" : "";
}

watch(deleteModalOpen, () => {
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
  return String(a.qq ?? a.id ?? "—");
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
  return isProcessRunning(a)
    ? "data-conn-capsule data-conn-capsule--run"
    : "data-conn-capsule data-conn-capsule--off";
}

function cardKey(a: NapcatAccountRow, index: number): string {
  return accountProtocolId(a) ?? `row-${index}`;
}

function isActionBusy(a: NapcatAccountRow): boolean {
  const id = accountProtocolId(a);
  return Boolean(id && actionBusy.value.has(id));
}

function setActionBusy(accountId: string, busy: boolean) {
  const next = new Set(actionBusy.value);
  if (busy) next.add(accountId);
  else next.delete(accountId);
  actionBusy.value = next;
}

function togglePowerLabel(a: NapcatAccountRow): string {
  const running = isProcessRunning(a);
  if (isActionBusy(a)) return running ? "停止中…" : "启动中…";
  return running ? "停止" : "启动";
}

function restartLabel(a: NapcatAccountRow): string {
  return isActionBusy(a) ? "重启中…" : "重启";
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

function shouldSkipProtoPoll(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return true;
  if (deleteModalOpen.value || deleteBusy.value) return true;
  if (actionBusy.value.size > 0) return true;
  return false;
}

function applyProtocolAccounts(accounts: NapcatAccountRow[]) {
  if (!protoRouteActive.value) return;
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
  if (isActionBusy(a)) return;
  const stop = isProcessRunning(a);
  setActionBusy(id, true);
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
    setActionBusy(id, false);
  }
}

async function restartAccount(a: NapcatAccountRow) {
  const mount = protoMountUrl.value;
  const id = accountProtocolId(a);
  if (!mount || !id) {
    pushConsoleToast("无法操作：协议端未启用或缺少账号 ID", "warn");
    return;
  }
  if (isActionBusy(a)) return;
  setActionBusy(id, true);
  try {
    await protocolRestartAccount(mount, id);
    pushConsoleToast(`已重启 ${primaryTitle(a)}`, "ok");
    await refreshAfterAction();
  } catch (e) {
    pushConsoleToast(protocolApiErrorMessage(e, "重启失败"), "err");
  } finally {
    setActionBusy(id, false);
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
    pushConsoleToast(`已删除 ${ids.length} 个协议账号`, "warn");
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
  stopProtoPolling();
  deleteModalOpen.value = false;
  deleteErr.value = "";
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

  <ConsolePageSkeleton
    v-if="!pageReady"
    :panels="2"
  />
  <template v-else>
    <div
      v-if="(snap?.accounts?.length ?? 0) > 0"
      class="panel"
    >
      <div class="panel__hd panel__hd--split inst-db-panel__hd">
        <h2 class="panel__title">
          <span
            class="panel__title-ico"
            aria-hidden="true"
          >{{ panelNavIcon }}</span>协议账号
          <RefreshIconButton
            :busy="loadBusy"
            label="刷新协议账号"
            @click="load"
          />
        </h2>
        <div class="inst-db-panel__hd-side">
          <button
            type="button"
            class="btn panel-hd-collapse-btn"
            @click="expProtocolAccounts = !expProtocolAccounts"
          >
            {{ expProtocolAccounts ? "收起" : "展开" }}
          </button>
          <div
            class="console-view-toggle"
            role="group"
            aria-label="协议账号表格或卡片视图"
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
              已连接
              <strong class="inst-db-stat__num">{{ protocolConnectedCount }}</strong>
              / {{ protocolAccountsSorted.length }} 账号
            </span>
            <input
              v-model="protoSearchQ"
              class="inp inst-db-search"
              type="search"
              placeholder="搜索 QQ / 昵称 / 账号 ID"
              title="按 QQ、昵称、协议账号 ID 筛选"
            >
          </div>
          <PanelSidebarAdd main-path="/protocol" />
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
                <th>进程</th>
                <th>连接</th>
                <th>WebUI</th>
                <th style="width: 168px">操作</th>
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
                  <span :class="runningCapsuleClass(a)">{{
                    isProcessRunning(a) ? "运行中" : "未运行"
                  }}</span>
                </td>
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
                <td>
                  <div class="inst-actions protocol-acc-table-actions">
                    <a
                      v-if="detailHref(a)"
                      class="btn"
                      :href="detailHref(a)!"
                      target="_blank"
                      rel="noopener noreferrer"
                    >详情</a>
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
                    <button
                      type="button"
                      class="btn"
                      :disabled="!protoActionsEnabled || isActionBusy(a)"
                      @click="restartAccount(a)"
                    >
                      {{ restartLabel(a) }}
                    </button>
                    <button
                      type="button"
                      :class="isProcessRunning(a) ? 'btn' : 'btn btn--primary'"
                      :disabled="!protoActionsEnabled || isActionBusy(a)"
                      @click="toggleAccountPower(a)"
                    >
                      {{ togglePowerLabel(a) }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else-if="protoView === 'cards'"
          class="data-card-grid data-card-grid--bots protocol-acc-grid"
        >
          <div
            v-for="(a, i) in pagedProtocolAccounts"
            :key="cardKey(a, i)"
            class="data-summary-card data-summary-card--kv data-summary-card--bot protocol-acc-card"
          >
            <div class="data-summary-card__head data-summary-card__head--bot">
              <label
                v-if="accountProtocolId(a)"
                class="inst-db-card-select"
                @click.stop
              >
                <input
                  type="checkbox"
                  :checked="bulk.isSelected(accountProtocolId(a)!)"
                  :aria-label="`选择协议账号 ${accountProtocolId(a)}`"
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
                      class="protocol-acc-card__title-link"
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
                  账号 {{ a.qq ?? a.id ?? "—" }}
                </div>
              </div>
              <div class="data-summary-card__head-badges">
                <span :class="runningCapsuleClass(a)">{{
                  isProcessRunning(a) ? "运行中" : "未运行"
                }}</span>
                <span
                  :class="
                    a.connected === true
                      ? 'data-conn-capsule data-conn-capsule--on'
                      : 'data-conn-capsule data-conn-capsule--off'
                  "
                >{{ a.connected === true ? "已连接" : "未连接" }}</span>
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
            </div>
            <div class="data-summary-card__tags data-summary-card__foot inst-card-actions protocol-acc-card__actions">
              <a
                v-if="detailHref(a)"
                class="btn"
                :href="detailHref(a)!"
                target="_blank"
                rel="noopener noreferrer"
              >详情</a>
              <button
                type="button"
                class="btn"
                :disabled="!protoActionsEnabled || isActionBusy(a)"
                @click="restartAccount(a)"
              >
                {{ restartLabel(a) }}
              </button>
              <button
                type="button"
                :class="isProcessRunning(a) ? 'btn' : 'btn btn--primary'"
                :disabled="!protoActionsEnabled || isActionBusy(a)"
                @click="toggleAccountPower(a)"
              >
                {{ togglePowerLabel(a) }}
              </button>
            </div>
          </div>
        </div>
        <ConsolePagerBar
          v-if="filteredProtocolAccounts.length > 0"
          v-model:page="protoAccPage"
          v-model:page-size="tablePageSize"
          :total="filteredProtocolAccounts.length"
        />
        <ConsoleCardBulkBar
          v-if="protoView === 'cards' && filteredProtocolAccounts.length > 0"
          :page-all-selected="protoCardsPageAllSelected"
          :selected-count="unref(bulk.selectedCount)"
          :delete-busy="deleteBusy"
          :delete-disabled="!protoActionsEnabled"
          @toggle-select-all="bulk.toggleSelectAllOnPage(pagedProtocolIds)"
          @clear-selection="bulk.clearSelection()"
          @delete="openDeleteModal"
        />
        <p
          v-if="!protoActionsEnabled"
          class="muted protocol-page__hint"
        >
          协议内置页未启用时，无法在控制台内启停或删除；请使用下方「协议端入口」或检查主仓配置。
        </p>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd panel__hd--split inst-db-panel__hd">
        <h2 class="panel__title">
          <span
            class="panel__title-ico"
            aria-hidden="true"
          >{{ panelNavIcon }}</span>协议端入口
          <RefreshIconButton
            :busy="loadBusy"
            label="刷新协议端数据"
            @click="load"
          />
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/protocol" />
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
        <div class="row-actions protocol-page__actions">
          <a
            v-if="dashUrl"
            class="btn btn--primary"
            :href="dashUrl"
            target="_blank"
            rel="noopener noreferrer"
          >打开协议端管理</a>
          <span
            v-else
            class="muted"
          >当前无法拼接管理页 URL（请检查 http_base、webui_enabled 与 webui_path）。</span>
          <RouterLink
            class="btn"
            to="/instances"
          >实例与连接</RouterLink>
          <RouterLink
            class="btn"
            to="/"
          >返回总览</RouterLink>
        </div>
      </div>
    </div>

    <ConsoleDeleteConfirmModal
      :open="deleteModalOpen"
      title="删除协议账号"
      :subtitle="protoDeleteSubtitle"
      :items="deleteModalItems"
      :warnings="deleteModalWarnings"
      :busy="deleteBusy"
      :error="deleteErr"
      title-id="proto-delete-modal-title"
      @close="closeDeleteModal"
      @confirm="confirmDeleteSelected"
    />
  </template>
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
.protocol-page__hint {
  margin: 12px 0 0;
  font-size: 12px;
}
.protocol-acc-grid {
  margin-bottom: 12px;
}
.protocol-acc-card__title-link {
  color: inherit;
  text-decoration: none;
}
.protocol-acc-card__title-link:hover {
  color: var(--accent);
}
.protocol-acc-card__actions {
  flex-wrap: wrap;
  gap: 6px;
}

.protocol-acc-table-actions {
  flex-wrap: wrap;
  gap: 4px;
}
</style>
