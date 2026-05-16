<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, unref, watch } from "vue";
import {
  deleteBotConfig,
  fetchInstances,
  fetchPlugins,
  peekInstancesCache,
  peekPluginsCache,
  putBotConfig,
} from "@/api/consoleApi";
import type { BotConfigPublic, InstancesData, PluginRow } from "@/api/pallasTypes";
import ConsoleCardBulkBar from "@/components/ConsoleCardBulkBar.vue";
import ConsoleDeleteConfirmModal from "@/components/ConsoleDeleteConfirmModal.vue";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import ConsoleTableEdit from "@/components/ConsoleTableEdit.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { useCardBulkSelection } from "@/composables/useCardBulkSelection";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botFavoriteAccounts, toggleFavoriteBot } from "@/utils/botFavorites";
import { formatDisabledPluginIds, pluginPickListFromRows } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const pageReady = ref(false);
const data = ref<InstancesData | null>(null);
{
  const warm = peekInstancesCache();
  if (warm) data.value = warm;
}
const plugins = ref<PluginRow[]>([]);
{
  const warmPl = peekPluginsCache();
  if (warmPl?.length) plugins.value = warmPl;
}
const pluginLoadErr = ref("");

const botView = ref<"table" | "cards">(consolePrefs.instancesBotView);

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

const editModalAccount = ref<number | null>(null);
const draft = ref<{
  security: boolean;
  auto_accept_friend: boolean;
  auto_accept_group: boolean;
  disabled_plugins: string[];
  admins: number[];
} | null>(null);

const addAdminInput = ref<string>("");
const adminAddHint = ref("");

const saveBusy = ref(false);
const saveErr = ref("");

const dbBulk = useCardBulkSelection<number>();
const deleteModalOpen = ref(false);
const deleteBusy = ref(false);
const deleteErr = ref("");

function syncBodyOverflow() {
  if (typeof document === "undefined") return;
  document.body.style.overflow =
    editModalAccount.value != null || deleteModalOpen.value ? "hidden" : "";
}

watch(editModalAccount, (acc) => {
  if (acc == null) adminAddHint.value = "";
  syncBodyOverflow();
});

watch(deleteModalOpen, () => {
  syncBodyOverflow();
});

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});

const instNbPage = ref(1);
const instDbPage = ref(1);
const expNonebot = ref(true);
const expDbBots = ref(true);
const reloadBusy = ref(false);
const dbBotSearchQ = ref("");

const sortedNonebotBots = computed(() => {
  const rows = [...(data.value?.nonebot_bots ?? [])];
  rows.sort((a, b) => {
    const ia = parseSelfId(a.self_id);
    const ib = parseSelfId(b.self_id);
    const na = (ia != null ? botNickname(ia) ?? "" : "").toLowerCase();
    const nb = (ib != null ? botNickname(ib) ?? "" : "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return String(a.self_id).localeCompare(String(b.self_id), "zh-CN", { numeric: true });
  });
  return rows;
});

function isBotConnected(account: number): boolean {
  return accountHasNonebotBot(data.value?.nonebot_bots, account);
}

const sortedDbBotConfigs = computed(() => {
  const rows = [...(data.value?.db_bot_configs ?? [])];
  rows.sort((a, b) => {
    const fa = botFavoriteAccounts.value.has(a.account) ? 1 : 0;
    const fb = botFavoriteAccounts.value.has(b.account) ? 1 : 0;
    if (fa !== fb) return fb - fa;
    const ca = isBotConnected(a.account) ? 1 : 0;
    const cb = isBotConnected(b.account) ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const na = (botNickname(a.account) || "").toLowerCase();
    const nb = (botNickname(b.account) || "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return a.account - b.account;
  });
  return rows;
});

function dbBotMatchesSearch(c: BotConfigPublic, q: string): boolean {
  const hay = [
    String(c.account),
    botNickname(c.account) ?? "",
    ...sortedAdminsList(c.admins).map(String),
    formatDisabledPluginIds(c.disabled_plugins, plugins.value),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

const filteredDbBotConfigs = computed(() => {
  const q = dbBotSearchQ.value.trim().toLowerCase();
  if (!q) return sortedDbBotConfigs.value;
  return sortedDbBotConfigs.value.filter((c) => dbBotMatchesSearch(c, q));
});

const dbBotsConnectedCount = computed(
  () => sortedDbBotConfigs.value.filter((c) => isBotConnected(c.account)).length,
);
const dbBotsTotalCount = computed(() => sortedDbBotConfigs.value.length);

const pagedNonebotBots = computed(() => slicePage(sortedNonebotBots.value, instNbPage.value, tablePageSize.value));
const pagedDbBotConfigs = computed(() =>
  slicePage(filteredDbBotConfigs.value, instDbPage.value, tablePageSize.value),
);

const pagedDbAccountIds = computed(() => pagedDbBotConfigs.value.map((c) => c.account));

const dbCardsPageAllSelected = computed(() => dbBulk.pageAllSelected(pagedDbAccountIds.value));

const selectedConnectedAccounts = computed(() =>
  dbBulk.sortedSelected.value.filter((a) => isBotConnected(a)),
);

const deleteModalItems = computed(() =>
  dbBulk.sortedSelected.value.map((acc) => ({
    key: String(acc),
    label: `${botNickname(acc) || "BOT"} · ${acc}`,
  })),
);

const deleteModalWarnings = computed(() => {
  const connected = selectedConnectedAccounts.value;
  if (!connected.length) return [];
  return [
    `其中以下账号当前仍与 NoneBot 连接：${connected.join("、")}。删除后可能导致运行期行为异常，请确认。`,
  ];
});

const instDeleteSubtitle = computed(
  () =>
    `将从数据库移除以下账号的 bot_config 行（共 ${dbBulk.sortedSelected.value.length} 个），操作不可撤销。`,
);

function openDeleteModal() {
  if (dbBulk.selectedCount.value === 0) return;
  deleteErr.value = "";
  deleteModalOpen.value = true;
}

function closeDeleteModal() {
  if (deleteBusy.value) return;
  deleteModalOpen.value = false;
  deleteErr.value = "";
}

async function confirmDeleteSelectedDb() {
  const accounts = dbBulk.sortedSelected.value;
  if (!accounts.length) return;
  deleteBusy.value = true;
  deleteErr.value = "";
  try {
    for (const account of accounts) {
      await deleteBotConfig(account);
    }
    await reload();
    dbBulk.clearSelection();
    deleteModalOpen.value = false;
    if (
      editModalAccount.value != null &&
      !(data.value?.db_bot_configs ?? []).some((c) => c.account === editModalAccount.value)
    ) {
      cancelEdit();
    }
  } catch (e) {
    deleteErr.value = e instanceof Error ? e.message : String(e);
    await reload();
  } finally {
    deleteBusy.value = false;
  }
}

watch(data, () => {
  instNbPage.value = 1;
  instDbPage.value = 1;
  const known = new Set((data.value?.db_bot_configs ?? []).map((c) => c.account));
  dbBulk.pruneSelection(known);
});

watch(
  () => consolePrefs.tablePageSize,
  () => {
    instNbPage.value = 1;
    instDbPage.value = 1;
  },
);

watch(dbBotSearchQ, () => {
  instDbPage.value = 1;
});

function setBotView(v: "table" | "cards") {
  botView.value = v;
  setConsolePrefs({ instancesBotView: v });
}

function botProfileEntry(account: number) {
  return data.value?.bot_profiles?.[String(account)];
}

function botNickname(account: number): string | undefined {
  const n = botProfileEntry(account)?.nickname?.trim();
  return n || undefined;
}

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

function sortedAdminsList(admins: number[] | undefined | null): number[] {
  if (!admins?.length) return [];
  return [...admins].sort((a, b) => a - b);
}

const pluginPickList = computed(() => pluginPickListFromRows(plugins.value));

function nonebotRowNick(selfId: string): string {
  const n = parseSelfId(selfId);
  if (n == null) return "";
  return botNickname(n) ?? "";
}

function parseSelfId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function addAdminFromInput() {
  if (!draft.value) return;
  adminAddHint.value = "";
  const raw = addAdminInput.value.trim();
  if (!raw) return;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    adminAddHint.value = "请输入有效的 QQ 号。";
    return;
  }
  if (draft.value.admins.includes(n)) {
    adminAddHint.value = "该号码已在列表中。";
    return;
  }
  draft.value.admins = [...draft.value.admins, n].sort((a, b) => a - b);
  addAdminInput.value = "";
}

function removeAdminFromDraft(id: number) {
  if (!draft.value) return;
  draft.value.admins = draft.value.admins.filter((x) => x !== id);
}

function startEdit(c: BotConfigPublic) {
  editModalAccount.value = c.account;
  addAdminInput.value = "";
  adminAddHint.value = "";
  draft.value = {
    security: c.security,
    auto_accept_friend: c.auto_accept_friend,
    auto_accept_group: c.auto_accept_group,
    disabled_plugins: [...(c.disabled_plugins ?? [])],
    admins: [...(c.admins ?? [])],
  };
  saveErr.value = "";
}

function cancelEdit() {
  editModalAccount.value = null;
  draft.value = null;
  addAdminInput.value = "";
  adminAddHint.value = "";
  saveErr.value = "";
}

function togglePluginDisabled(name: string, checked: boolean) {
  if (!draft.value) return;
  const set = new Set(draft.value.disabled_plugins);
  if (checked) set.add(name);
  else set.delete(name);
  draft.value.disabled_plugins = [...set].sort((a, b) => a.localeCompare(b));
}

function boolSelectVal(v: boolean): string {
  return v ? "1" : "0";
}

function onBoolSelect(field: "security" | "auto_accept_friend" | "auto_accept_group", raw: string) {
  if (!draft.value) return;
  draft.value[field] = raw === "1";
}

async function reload(opts?: { bypassCache?: boolean }) {
  err.value = "";
  try {
    data.value = await fetchInstances({ bypassCache: Boolean(opts?.bypassCache) });
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function reloadFromUser() {
  reloadBusy.value = true;
  try {
    await reload({ bypassCache: true });
  } finally {
    reloadBusy.value = false;
  }
}

async function saveBotConfig() {
  const account = editModalAccount.value;
  if (!draft.value || account == null) return;
  saveBusy.value = true;
  saveErr.value = "";
  try {
    await putBotConfig(account, { ...draft.value });
    await reload();
    cancelEdit();
  } catch (e) {
    saveErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    saveBusy.value = false;
  }
}

onMounted(async () => {
  try {
    await reload();
    try {
      plugins.value = await fetchPlugins();
    } catch (e) {
      pluginLoadErr.value = e instanceof Error ? e.message : String(e);
      plugins.value = [];
    }
  } finally {
    pageReady.value = true;
  }
});
</script>

<template>
  <div>
    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady"
      :panels="4"
    />
    <template v-else-if="data">
      <div class="panel">
        <div class="panel__hd panel__hd--split inst-db-panel__hd">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>数据库中的实例
            <RefreshIconButton
              :busy="reloadBusy"
              label="刷新实例数据"
              @click="reloadFromUser"
            />
          </h2>
          <div class="inst-db-panel__hd-side">
            <button
              type="button"
              class="btn panel-hd-collapse-btn"
              @click="expDbBots = !expDbBots"
            >
              {{ expDbBots ? "收起" : "展开" }}
            </button>
            <div
              class="console-view-toggle"
              role="group"
              aria-label="实例表格或卡片视图"
            >
              <button
                type="button"
                :class="{ 'is-on': botView === 'table' }"
                @click="setBotView('table')"
              >
                表格
              </button>
              <button
                type="button"
                :class="{ 'is-on': botView === 'cards' }"
                @click="setBotView('cards')"
              >
                卡片
              </button>
            </div>
          </div>
          <div class="inst-db-panel__actions">
            <div class="inst-db-panel__stat-search">
              <span
                v-if="data"
                class="inst-db-stat muted"
              >
                当前已连接
                <strong class="inst-db-stat__num">{{ dbBotsConnectedCount }}</strong>
                / {{ dbBotsTotalCount }} 账号
              </span>
              <input
                v-model="dbBotSearchQ"
                class="inp inst-db-search"
                type="search"
                placeholder="搜索账号 / 昵称 / 管理员 / 插件"
                title="按账号、昵称、管理员、禁用插件筛选"
              >
            </div>
            <PanelSidebarAdd main-path="/instances" />
          </div>
        </div>
        <div
          v-show="expDbBots"
          class="panel__bd"
        >
          <p
            v-if="pluginLoadErr"
            class="muted"
            style="margin: 0 0 10px"
          >
            插件列表加载失败，禁用插件勾选不可用：{{ pluginLoadErr }}
          </p>

          <div
            v-if="botView === 'table'"
            class="table-wrap"
          >
            <table class="data console-data-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>账号</th>
                  <th>连接</th>
                  <th>安全模式</th>
                  <th>自动同意好友</th>
                  <th>自动同意入群</th>
                  <th>管理员</th>
                  <th>禁用插件</th>
                  <th style="width: 88px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in pagedDbBotConfigs"
                  :key="c.account"
                >
                  <td style="font-weight: 600">{{ botNickname(c.account) || "BOT" }}</td>
                  <td>{{ c.account }}</td>
                  <td>
                    <span :class="boolPillClass(isBotConnected(c.account))">{{
                      isBotConnected(c.account) ? "已连接" : "未连接"
                    }}</span>
                  </td>
                  <td>
                    <span :class="boolPillClass(c.security)">{{ c.security ? "开启" : "关闭" }}</span>
                  </td>
                  <td>
                    <span :class="boolPillClass(c.auto_accept_friend)">{{
                      c.auto_accept_friend ? "开启" : "关闭"
                    }}</span>
                  </td>
                  <td>
                    <span :class="boolPillClass(c.auto_accept_group)">{{
                      c.auto_accept_group ? "开启" : "关闭"
                    }}</span>
                  </td>
                  <td class="muted inst-db-admins-cell">
                    <template v-if="!sortedAdminsList(c.admins).length">—</template>
                    <span
                      v-else
                      class="inst-db-admins-wrap inst-db-admins-wrap--table"
                    >
                      <span
                        v-for="(id, idx) in sortedAdminsList(c.admins)"
                        :key="`${c.account}-adm-${id}`"
                        class="inst-db-admin-item"
                      ><template v-if="idx > 0">、</template>{{ id }}</span>
                    </span>
                  </td>
                  <td class="muted">{{ formatDisabledPluginIds(c.disabled_plugins, plugins) }}</td>
                  <td>
                    <div class="inst-actions">
                      <ConsoleTableEdit @click="startEdit(c)" />
                      <button
                        type="button"
                        class="btn inst-fav-star"
                        :aria-pressed="botFavoriteAccounts.has(c.account)"
                        :title="botFavoriteAccounts.has(c.account) ? '取消收藏' : '收藏'"
                        @click="toggleFavoriteBot(c.account)"
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
            v-if="botView === 'table' && filteredDbBotConfigs.length > 0"
            v-model:page="instDbPage"
            v-model:page-size="tablePageSize"
            :total="filteredDbBotConfigs.length"
          />

          <div
            v-else-if="botView === 'cards'"
            class="data-card-grid data-card-grid--bots"
          >
            <div
              v-for="c in pagedDbBotConfigs"
              :key="`card-${c.account}`"
              class="data-summary-card data-summary-card--kv data-summary-card--bot"
            >
              <div class="data-summary-card__head data-summary-card__head--bot">
                <label
                  class="inst-db-card-select"
                  @click.stop
                >
                  <input
                    type="checkbox"
                    :checked="dbBulk.isSelected(c.account)"
                    :aria-label="`选择账号 ${c.account}`"
                    @change="dbBulk.setSelected(c.account, ($event.target as HTMLInputElement).checked)"
                  >
                </label>
                <div class="data-summary-card__head-main">
                  <div class="data-summary-card__primary">{{ botNickname(c.account) || "BOT" }}</div>
                  <div class="data-summary-card__secondary muted">{{ c.account }}</div>
                </div>
                <span
                  :class="
                    isBotConnected(c.account)
                      ? 'data-conn-capsule data-conn-capsule--on'
                      : 'data-conn-capsule data-conn-capsule--off'
                  "
                >{{ isBotConnected(c.account) ? "已连接" : "未连接" }}</span>
              </div>
              <div class="data-summary-card__body">
                <div class="data-summary-card__row">
                <span class="data-summary-card__label">安全模式</span>
                <span :class="boolPillClass(c.security)">{{ c.security ? "开启" : "关闭" }}</span>
              </div>
              <div class="data-summary-card__row">
                <span class="data-summary-card__label">自动同意好友</span>
                <span :class="boolPillClass(c.auto_accept_friend)">{{ c.auto_accept_friend ? "开启" : "关闭" }}</span>
              </div>
              <div class="data-summary-card__row">
                <span class="data-summary-card__label">自动同意入群</span>
                <span :class="boolPillClass(c.auto_accept_group)">{{ c.auto_accept_group ? "开启" : "关闭" }}</span>
              </div>
              <div class="data-summary-card__row data-summary-card__row--admins">
                <span class="data-summary-card__label">管理员</span>
                <span class="muted data-summary-card__admins-text">
                  <template v-if="!sortedAdminsList(c.admins).length">—</template>
                  <span
                    v-else
                    class="inst-db-admins-wrap inst-db-admins-wrap--card"
                  >
                    <span
                      v-for="id in sortedAdminsList(c.admins)"
                      :key="`card-${c.account}-adm-${id}`"
                      class="inst-db-admin-item"
                    >{{ id }}</span>
                  </span>
                </span>
              </div>
              <div class="data-summary-card__plugins">
                <span class="data-summary-card__plugins-label">禁用插件</span>
                {{
                  c.disabled_plugins?.length
                    ? formatDisabledPluginIds(c.disabled_plugins, plugins)
                    : "无"
                }}
              </div>
              </div>
              <div class="data-summary-card__tags data-summary-card__foot inst-card-actions">
                <ConsoleTableEdit @click="startEdit(c)" />
                <button
                  type="button"
                  class="btn inst-fav-star"
                  :aria-pressed="botFavoriteAccounts.has(c.account)"
                  :title="botFavoriteAccounts.has(c.account) ? '取消收藏' : '收藏'"
                  @click="toggleFavoriteBot(c.account)"
                >
                  ★
                </button>
              </div>
            </div>
          </div>
          <ConsolePagerBar
            v-if="botView === 'cards' && filteredDbBotConfigs.length > 0"
            v-model:page="instDbPage"
            v-model:page-size="tablePageSize"
            :total="filteredDbBotConfigs.length"
          />

          <ConsoleCardBulkBar
            v-if="botView === 'cards' && filteredDbBotConfigs.length > 0"
            :page-all-selected="dbCardsPageAllSelected"
            :selected-count="unref(dbBulk.selectedCount)"
            :delete-busy="deleteBusy"
            @toggle-select-all="dbBulk.toggleSelectAllOnPage(pagedDbAccountIds)"
            @clear-selection="dbBulk.clearSelection()"
            @delete="openDeleteModal"
          />
        </div>
      </div>

      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">
            <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>NoneBot 框架
          </h2>
          <div class="row-actions">
            <PanelSidebarAdd main-path="/instances" />
            <button
              type="button"
              class="btn panel-hd-collapse-btn"
              @click="expNonebot = !expNonebot"
            >
              {{ expNonebot ? "收起" : "展开" }}
            </button>
          </div>
        </div>
        <div
          v-show="expNonebot"
          class="panel__bd"
        >
          <div class="table-wrap">
            <table class="data console-data-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>self_id</th>
                  <th>适配器</th>
                  <th>连接键</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(b, i) in pagedNonebotBots"
                  :key="i"
                >
                  <td style="font-weight: 600">{{ nonebotRowNick(b.self_id) || "—" }}</td>
                  <td>{{ b.self_id }}</td>
                  <td class="muted">{{ b.adapter }}</td>
                  <td class="muted">{{ b.connection_key }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ConsolePagerBar
            v-if="sortedNonebotBots.length > 0"
            v-model:page="instNbPage"
            v-model:page-size="tablePageSize"
            :total="sortedNonebotBots.length"
          />
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="editModalAccount != null && draft"
        class="console-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-config-modal-title"
      >
        <div
          class="console-modal__backdrop"
          aria-hidden="true"
          @click="cancelEdit"
        />
        <div
          class="console-modal__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                id="bot-config-modal-title"
                class="console-modal__title"
              >
                编辑 Bot 配置
              </h2>
              <p class="console-modal__subtitle">
                <span class="console-modal__subtitle-strong">{{
                  editModalAccount != null ? botNickname(editModalAccount) || "BOT" : ""
                }}</span>
                <span class="muted"> · 账号 {{ editModalAccount }}</span>
              </p>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="cancelEdit"
            >
              ×
            </button>
          </div>
          <div class="console-modal__bd">
            <div class="bot-config-edit bot-config-edit--modal">
              <p
                v-if="saveErr"
                class="alert alert--err"
                style="margin-bottom: 12px"
              >
                {{ saveErr }}
              </p>
              <div class="bot-config-edit__grid">
                <div class="bot-config-edit__field">
                  <label>安全模式</label>
                  <select
                    class="sel"
                    style="width: 100%"
                    :value="boolSelectVal(draft.security)"
                    @change="onBoolSelect('security', ($event.target as HTMLSelectElement).value)"
                  >
                    <option value="1">开启</option>
                    <option value="0">关闭</option>
                  </select>
                </div>
                <div class="bot-config-edit__field">
                  <label>自动同意好友</label>
                  <select
                    class="sel"
                    style="width: 100%"
                    :value="boolSelectVal(draft.auto_accept_friend)"
                    @change="
                      onBoolSelect('auto_accept_friend', ($event.target as HTMLSelectElement).value)
                    "
                  >
                    <option value="1">开启</option>
                    <option value="0">关闭</option>
                  </select>
                </div>
                <div class="bot-config-edit__field">
                  <label>自动同意入群</label>
                  <select
                    class="sel"
                    style="width: 100%"
                    :value="boolSelectVal(draft.auto_accept_group)"
                    @change="
                      onBoolSelect('auto_accept_group', ($event.target as HTMLSelectElement).value)
                    "
                  >
                    <option value="1">开启</option>
                    <option value="0">关闭</option>
                  </select>
                </div>
              </div>
              <div class="bot-config-edit__field">
                <label>管理员 QQ</label>
                <p
                  class="muted"
                  style="margin: 0 0 8px; font-size: 12px"
                >
                  输入号码后点击添加；每个账号右上角 × 可移除。
                </p>
                <div
                  class="row-actions"
                  style="margin-bottom: 4px; flex-wrap: wrap; gap: 8px"
                >
                  <input
                    v-model="addAdminInput"
                    class="inp"
                    type="text"
                    inputmode="numeric"
                    autocomplete="off"
                    placeholder="QQ 号"
                    style="max-width: 200px; min-width: 0; flex: 1 1 140px"
                    @keydown.enter.prevent="addAdminFromInput"
                  >
                  <button
                    type="button"
                    class="btn"
                    @click="addAdminFromInput"
                  >
                    添加
                  </button>
                </div>
                <p
                  v-if="adminAddHint"
                  class="alert alert--err"
                  style="margin: 0 0 8px; padding: 8px 10px; font-size: 12px"
                >
                  {{ adminAddHint }}
                </p>
                <div
                  v-if="draft.admins.length"
                  class="admin-chip-list"
                >
                  <div
                    v-for="id in draft.admins"
                    :key="`adm-${editModalAccount}-${id}`"
                    class="admin-chip"
                  >
                    <span class="admin-chip__id">{{ id }}</span>
                    <button
                      type="button"
                      class="admin-chip__rm"
                      :aria-label="`移除管理员 ${id}`"
                      title="移除"
                      @click="removeAdminFromDraft(id)"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <p
                  v-else
                  class="muted"
                  style="margin: 4px 0 0; font-size: 12px"
                >
                  尚未添加管理员。
                </p>
              </div>
              <div class="bot-config-edit__field">
                <label>禁用插件（勾选表示禁用）</label>
                <p
                  v-if="!pluginPickList.length"
                  class="muted"
                  style="margin: 0 0 8px; font-size: 12px"
                >
                  无插件清单，无法勾选禁用项。
                </p>
                <div
                  v-else
                  class="plugin-check-grid"
                >
                  <label
                    v-for="p in pluginPickList"
                    :key="`mod-pl-${editModalAccount}-${p.name}`"
                  >
                    <input
                      type="checkbox"
                      :checked="draft.disabled_plugins.includes(p.name)"
                      @change="
                        togglePluginDisabled(p.name, ($event.target as HTMLInputElement).checked)
                      "
                    >
                    <span>{{ p.label }}</span>
                  </label>
                </div>
              </div>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="saveBusy"
                  @click="saveBotConfig()"
                >
                  {{ saveBusy ? "保存中…" : "保存" }}
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="saveBusy"
                  @click="cancelEdit"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <ConsoleDeleteConfirmModal
      :open="deleteModalOpen"
      title="删除实例配置"
      :subtitle="instDeleteSubtitle"
      :items="deleteModalItems"
      :warnings="deleteModalWarnings"
      :busy="deleteBusy"
      :error="deleteErr"
      title-id="inst-delete-modal-title"
      @close="closeDeleteModal"
      @confirm="confirmDeleteSelectedDb"
    />
  </div>
</template>

<style scoped>
.inst-db-card-select {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  padding-top: 2px;
  margin-right: 2px;
  cursor: pointer;
}

.inst-db-card-select input {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
}

.inst-delete-account-list {
  margin: 0;
  padding-left: 1.2em;
  line-height: 1.55;
  font-size: 13px;
  max-height: 200px;
  overflow: auto;
}

.inst-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.inst-card-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.inst-fav-star {
  padding: 6px 10px;
  font-size: 16px;
  line-height: 1;
  opacity: 0.38;
}
.inst-fav-star[aria-pressed="true"] {
  opacity: 1;
  color: #fbbf24;
}

.inst-db-admins-cell {
  font-size: 12px;
  line-height: 1.45;
  max-width: 12rem;
}

.inst-db-admins-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: baseline;
}

.inst-db-admins-wrap--table {
  justify-content: flex-start;
}

.inst-db-admins-wrap--card {
  justify-content: flex-end;
  gap: 0 0.35em;
}

.inst-db-admin-item {
  white-space: nowrap;
}

.data-summary-card__row--admins {
  align-items: flex-start;
}

.data-summary-card__admins-text {
  flex: 1 1 auto;
  min-width: 0;
  text-align: right;
  font-size: 12px;
  line-height: 1.45;
  display: flex;
  justify-content: flex-end;
}
</style>
