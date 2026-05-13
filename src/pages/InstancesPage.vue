<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { fetchInstances, fetchPlugins, putBotConfig } from "@/api/consoleApi";
import type { BotConfigPublic, InstancesData, NapcatManagerSnapshot, PluginRow } from "@/api/pallasTypes";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { visibleBots } from "@/utils/botDisplay";
import { formatDisabledPluginIds, pluginPickListFromRows } from "@/utils/pluginDisplay";
import { slicePage, totalPages } from "@/utils/paginate";
import { protocolDisp } from "@/utils/protocolUi";

const err = ref("");
const data = ref<InstancesData | null>(null);
const plugins = ref<PluginRow[]>([]);
const pluginLoadErr = ref("");

const botView = ref<"table" | "cards">(consolePrefs.instancesBotView);
const protoView = ref<"table" | "cards">(consolePrefs.instancesProtoView);

const editModalAccount = ref<number | null>(null);
const draft = ref<{
  security: boolean;
  auto_accept_friend: boolean;
  auto_accept_group: boolean;
  disabled_plugins: string[];
  admins: number[];
} | null>(null);

const extraAdminIds = ref<number[]>([]);
const addAdminInput = ref<string>("");

const saveBusy = ref(false);
const saveErr = ref("");

watch(editModalAccount, (acc) => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = acc != null ? "hidden" : "";
});

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});

const protocolSnap = computed<NapcatManagerSnapshot | null>(
  () => data.value?.pallas_protocol ?? data.value?.napcat ?? null,
);

const protocolAccountRows = computed(() =>
  (protocolSnap.value?.accounts ?? []).map((a, i) => ({
    key: `pa-${i}-${String(a.qq ?? a.id ?? i)}`,
    raw: a,
    run: protocolDisp(a.process_running ?? a.running, "运行", "停止"),
    conn: protocolDisp(a.connected, "已连接", "未连接"),
  })),
);

const PAGE_SIZE = 12;

const instNbPage = ref(1);
const instDbPage = ref(1);
const instProtoPage = ref(1);
const expNonebot = ref(true);
const expDbBots = ref(true);
const expProtocol = ref(true);

const sortedNonebotBots = computed(() => {
  const rows = visibleBots([...(data.value?.nonebot_bots ?? [])]);
  rows.sort((a, b) => {
    const ia = parseSelfId(a.self_id);
    const ib = parseSelfId(b.self_id);
    const na = (ia != null ? botNickname(ia) ?? "" : "").toLowerCase();
    const nb = (ib != null ? botNickname(ib) ?? "" : "").toLowerCase();
    const cmp = na.localeCompare(nb, "zh-CN");
    if (cmp !== 0) return cmp;
    return a.self_id.localeCompare(b.self_id, "zh-CN", { numeric: true });
  });
  return rows;
});

const sortedDbBotConfigs = computed(() => {
  const rows = [...(data.value?.db_bot_configs ?? [])];
  rows.sort((a, b) => {
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

const sortedProtocolAccountRows = computed(() => {
  const rows = [...protocolAccountRows.value];
  rows.sort((a, b) => {
    const ca = a.raw.connected === true ? 1 : 0;
    const cb = b.raw.connected === true ? 1 : 0;
    if (ca !== cb) return cb - ca;
    const qa = parseSelfId(String(a.raw.qq ?? a.raw.id ?? ""));
    const qb = parseSelfId(String(b.raw.qq ?? b.raw.id ?? ""));
    const na = (qa != null ? botNickname(qa) : "") || String(a.raw.display_name ?? "").trim();
    const nb = (qb != null ? botNickname(qb) : "") || String(b.raw.display_name ?? "").trim();
    const cmp = na.toLowerCase().localeCompare(nb.toLowerCase(), "zh-CN");
    if (cmp !== 0) return cmp;
    return String(a.raw.qq ?? a.raw.id ?? "").localeCompare(String(b.raw.qq ?? b.raw.id ?? ""), "zh-CN", {
      numeric: true,
    });
  });
  return rows;
});

const pagedNonebotBots = computed(() => slicePage(sortedNonebotBots.value, instNbPage.value, PAGE_SIZE));
const pagedDbBotConfigs = computed(() => slicePage(sortedDbBotConfigs.value, instDbPage.value, PAGE_SIZE));
const pagedProtocolRows = computed(() => slicePage(sortedProtocolAccountRows.value, instProtoPage.value, PAGE_SIZE));

const instNbMaxPage = computed(() => totalPages(sortedNonebotBots.value.length, PAGE_SIZE));
const instDbMaxPage = computed(() => totalPages(sortedDbBotConfigs.value.length, PAGE_SIZE));
const instProtoMaxPage = computed(() => totalPages(sortedProtocolAccountRows.value.length, PAGE_SIZE));

watch(data, () => {
  instNbPage.value = 1;
  instDbPage.value = 1;
  instProtoPage.value = 1;
});

function protocolPrimaryTitle(row: (typeof sortedProtocolAccountRows.value)[0]): string {
  const q = parseSelfId(String(row.raw.qq ?? row.raw.id ?? ""));
  if (q != null) {
    const nick = botNickname(q);
    if (nick) return nick;
  }
  const d = String(row.raw.display_name ?? "").trim();
  if (d) return d;
  return String(row.raw.qq ?? row.raw.id ?? "—");
}

function isBotConnected(account: number): boolean {
  return accountHasNonebotBot(data.value?.nonebot_bots, account);
}

function setBotView(v: "table" | "cards") {
  botView.value = v;
  setConsolePrefs({ instancesBotView: v });
}

function setProtoView(v: "table" | "cards") {
  protoView.value = v;
  setConsolePrefs({ instancesProtoView: v });
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

const pluginPickList = computed(() => pluginPickListFromRows(plugins.value));

function parseSelfId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

const adminCandidates = computed(() => {
  const set = new Set<number>();
  for (const b of data.value?.nonebot_bots ?? []) {
    const n = parseSelfId(b.self_id);
    if (n != null) set.add(n);
  }
  for (const c of data.value?.db_bot_configs ?? []) {
    for (const a of c.admins ?? []) set.add(a);
  }
  for (const x of extraAdminIds.value) {
    if (Number.isFinite(x) && x > 0) set.add(Math.floor(x));
  }
  return [...set].sort((a, b) => a - b);
});

function addAdminCandidate() {
  const n = parseInt(addAdminInput.value.trim(), 10);
  if (!Number.isFinite(n) || n < 1) return;
  if (!extraAdminIds.value.includes(n)) extraAdminIds.value = [...extraAdminIds.value, n];
  addAdminInput.value = "";
}

function removeExtraAdmin(id: number) {
  extraAdminIds.value = extraAdminIds.value.filter((x) => x !== id);
}


function startEdit(c: BotConfigPublic) {
  editModalAccount.value = c.account;
  extraAdminIds.value = [];
  addAdminInput.value = "";
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
  extraAdminIds.value = [];
  addAdminInput.value = "";
  saveErr.value = "";
}

function togglePluginDisabled(name: string, checked: boolean) {
  if (!draft.value) return;
  const set = new Set(draft.value.disabled_plugins);
  if (checked) set.add(name);
  else set.delete(name);
  draft.value.disabled_plugins = [...set].sort((a, b) => a.localeCompare(b));
}

function toggleAdmin(id: number, checked: boolean) {
  if (!draft.value) return;
  const set = new Set(draft.value.admins);
  if (checked) set.add(id);
  else set.delete(id);
  draft.value.admins = [...set].sort((a, b) => a - b);
}

function boolSelectVal(v: boolean): string {
  return v ? "1" : "0";
}

function onBoolSelect(field: "security" | "auto_accept_friend" | "auto_accept_group", raw: string) {
  if (!draft.value) return;
  draft.value[field] = raw === "1";
}

async function reload() {
  err.value = "";
  try {
    data.value = await fetchInstances();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
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
  await reload();
  try {
    plugins.value = await fetchPlugins();
  } catch (e) {
    pluginLoadErr.value = e instanceof Error ? e.message : String(e);
    plugins.value = [];
  }
});
</script>

<template>
  <div>
    <header class="page-hero page-hero--with-actions">
      <div class="page-hero__main">
        <p class="page-hero__eyebrow">Topology</p>
        <h1 class="page-hero__title">实例与连接</h1>
        <p class="page-hero__desc">
          汇总编排器在线情况、数据面账号及协议管理器快照。Bot 数据面配置可在本页直接保存；好友与群、颗粒策略请用侧栏对应页面。
        </p>
      </div>
      <div class="page-hero__actions">
        <button
          type="button"
          class="btn"
          @click="reload"
        >
          刷新
        </button>
      </div>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

    <template v-if="data">
      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">NoneBot 连接</h2>
          <button
            type="button"
            class="btn"
            style="padding: 6px 12px; font-size: 12px"
            @click="expNonebot = !expNonebot"
          >
            {{ expNonebot ? "收起" : "展开" }}
          </button>
        </div>
        <div
          v-show="expNonebot"
          class="panel__bd"
        >
          <div class="table-wrap">
            <table class="data">
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
                  <td style="font-weight: 600">{{ (parseSelfId(b.self_id) != null ? botNickname(parseSelfId(b.self_id)!) : undefined) || "—" }}</td>
                  <td>{{ b.self_id }}</td>
                  <td class="muted">{{ b.adapter }}</td>
                  <td class="muted">{{ b.connection_key }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="sortedNonebotBots.length > PAGE_SIZE"
            class="console-pager"
          >
            <span class="muted">共 {{ sortedNonebotBots.length }} 条 · 第 {{ instNbPage }} / {{ instNbMaxPage }} 页</span>
            <div class="row-actions">
              <button
                type="button"
                class="btn"
                :disabled="instNbPage <= 1"
                @click="instNbPage = Math.max(1, instNbPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="btn"
                :disabled="instNbPage >= instNbMaxPage"
                @click="instNbPage = Math.min(instNbMaxPage, instNbPage + 1)"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">数据库中的 Bot 配置</h2>
          <div
            class="row-actions"
            style="flex-wrap: wrap; gap: 8px; align-items: center"
          >
            <button
              type="button"
              class="btn"
              style="padding: 6px 12px; font-size: 12px"
              @click="expDbBots = !expDbBots"
            >
              {{ expDbBots ? "收起" : "展开" }}
            </button>
            <div
              class="console-view-toggle"
              role="group"
              aria-label="Bot 配置视图"
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
            <table class="data">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>账号</th>
                  <th>连接</th>
                  <th>安全模式</th>
                  <th>自动同意好友</th>
                  <th>自动同意入群</th>
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
                  <td>{{ c.security }}</td>
                  <td>{{ c.auto_accept_friend }}</td>
                  <td>{{ c.auto_accept_group }}</td>
                  <td class="muted">{{ formatDisabledPluginIds(c.disabled_plugins, plugins) }}</td>
                  <td>
                    <button
                      type="button"
                      class="btn"
                      style="padding: 6px 10px; font-size: 12px"
                      @click="startEdit(c)"
                    >
                      编辑
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="botView === 'table' && sortedDbBotConfigs.length > PAGE_SIZE"
            class="console-pager"
          >
            <span class="muted">共 {{ sortedDbBotConfigs.length }} 条 · 第 {{ instDbPage }} / {{ instDbMaxPage }} 页</span>
            <div class="row-actions">
              <button
                type="button"
                class="btn"
                :disabled="instDbPage <= 1"
                @click="instDbPage = Math.max(1, instDbPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="btn"
                :disabled="instDbPage >= instDbMaxPage"
                @click="instDbPage = Math.min(instDbMaxPage, instDbPage + 1)"
              >
                下一页
              </button>
            </div>
          </div>

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
                <div class="data-summary-card__head-main">
                  <div class="data-summary-card__primary">{{ botNickname(c.account) || "BOT" }}</div>
                  <div class="data-summary-card__secondary muted">账号 {{ c.account }}</div>
                </div>
                <span
                  :class="
                    isBotConnected(c.account)
                      ? 'data-conn-capsule data-conn-capsule--on'
                      : 'data-conn-capsule data-conn-capsule--off'
                  "
                >{{ isBotConnected(c.account) ? "已连接" : "未连接" }}</span>
              </div>
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
              <div class="data-summary-card__plugins">
                <span class="data-summary-card__plugins-label">禁用插件</span>
                {{
                  c.disabled_plugins?.length
                    ? formatDisabledPluginIds(c.disabled_plugins, plugins)
                    : "无"
                }}
              </div>
              <div class="data-summary-card__tags">
                <button
                  type="button"
                  class="btn btn--primary"
                  style="padding: 6px 12px; font-size: 12px"
                  @click="startEdit(c)"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
          <div
            v-if="botView === 'cards' && sortedDbBotConfigs.length > PAGE_SIZE"
            class="console-pager"
          >
            <span class="muted">共 {{ sortedDbBotConfigs.length }} 条 · 第 {{ instDbPage }} / {{ instDbMaxPage }} 页</span>
            <div class="row-actions">
              <button
                type="button"
                class="btn"
                :disabled="instDbPage <= 1"
                @click="instDbPage = Math.max(1, instDbPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="btn"
                :disabled="instDbPage >= instDbMaxPage"
                @click="instDbPage = Math.min(instDbMaxPage, instDbPage + 1)"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="protocolSnap"
        class="panel"
      >
        <div class="panel__hd panel__hd--split">
          <h2 class="panel__title">协议管理（{{ protocolSnap.plugin }}）</h2>
          <div
            class="row-actions"
            style="flex-wrap: wrap; gap: 8px; align-items: center"
          >
            <button
              type="button"
              class="btn"
              style="padding: 6px 12px; font-size: 12px"
              @click="expProtocol = !expProtocol"
            >
              {{ expProtocol ? "收起" : "展开" }}
            </button>
            <div
              class="console-view-toggle"
              role="group"
              aria-label="协议视图"
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
        </div>
        <div
          v-show="expProtocol"
          class="panel__bd"
        >
          <p class="muted" style="margin: 0 0 12px">
            WebUI：{{ protocolSnap.webui_enabled ? "启用" : "关闭" }} · 路径 {{ protocolSnap.webui_path }}
          </p>
          <div
            v-if="protoView === 'table'"
            class="table-wrap"
          >
            <table class="data">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>账号</th>
                  <th>运行</th>
                  <th>已连接</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in pagedProtocolRows"
                  :key="row.key"
                >
                  <td style="font-weight: 600">{{ protocolPrimaryTitle(row) }}</td>
                  <td class="muted">{{ row.raw.qq || row.raw.id }}</td>
                  <td>
                    <template v-if="row.run.kind === 'pill'">
                      <span :class="boolPillClass(row.run.on)">{{ row.run.on ? row.run.onLabel : row.run.offLabel }}</span>
                    </template>
                    <span
                      v-else
                      class="muted"
                    >{{ row.run.text }}</span>
                  </td>
                  <td>
                    <template v-if="row.conn.kind === 'pill'">
                      <span :class="boolPillClass(row.conn.on)">{{ row.conn.on ? row.conn.onLabel : row.conn.offLabel }}</span>
                    </template>
                    <span
                      v-else
                      class="muted"
                    >{{ row.conn.text }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-if="protoView === 'table' && sortedProtocolAccountRows.length > PAGE_SIZE"
            class="console-pager"
          >
            <span class="muted">共 {{ sortedProtocolAccountRows.length }} 条 · 第 {{ instProtoPage }} / {{ instProtoMaxPage }} 页</span>
            <div class="row-actions">
              <button
                type="button"
                class="btn"
                :disabled="instProtoPage <= 1"
                @click="instProtoPage = Math.max(1, instProtoPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="btn"
                :disabled="instProtoPage >= instProtoMaxPage"
                @click="instProtoPage = Math.min(instProtoMaxPage, instProtoPage + 1)"
              >
                下一页
              </button>
            </div>
          </div>
          <div
            v-else-if="protoView === 'cards'"
            class="data-card-grid"
          >
            <div
              v-for="row in pagedProtocolRows"
              :key="row.key"
              class="data-summary-card data-summary-card--kv"
            >
              <div class="data-summary-card__title">{{ protocolPrimaryTitle(row) }}</div>
              <div class="data-summary-card__secondary muted" style="margin-top: 2px">
                账号 {{ row.raw.qq || row.raw.id || "—" }}
              </div>
              <div class="data-summary-card__row">
                <span class="data-summary-card__label">进程</span>
                <template v-if="row.run.kind === 'pill'">
                  <span :class="boolPillClass(row.run.on)">{{ row.run.on ? row.run.onLabel : row.run.offLabel }}</span>
                </template>
                <span
                  v-else
                  class="muted"
                  style="font-size: 12px"
                >{{ row.run.text }}</span>
              </div>
              <div class="data-summary-card__row">
                <span class="data-summary-card__label">连接</span>
                <template v-if="row.conn.kind === 'pill'">
                  <span :class="boolPillClass(row.conn.on)">{{ row.conn.on ? row.conn.onLabel : row.conn.offLabel }}</span>
                </template>
                <span
                  v-else
                  class="muted"
                  style="font-size: 12px"
                >{{ row.conn.text }}</span>
              </div>
            </div>
          </div>
          <div
            v-if="protoView === 'cards' && sortedProtocolAccountRows.length > PAGE_SIZE"
            class="console-pager"
          >
            <span class="muted">共 {{ sortedProtocolAccountRows.length }} 条 · 第 {{ instProtoPage }} / {{ instProtoMaxPage }} 页</span>
            <div class="row-actions">
              <button
                type="button"
                class="btn"
                :disabled="instProtoPage <= 1"
                @click="instProtoPage = Math.max(1, instProtoPage - 1)"
              >
                上一页
              </button>
              <button
                type="button"
                class="btn"
                :disabled="instProtoPage >= instProtoMaxPage"
                @click="instProtoPage = Math.min(instProtoMaxPage, instProtoPage + 1)"
              >
                下一页
              </button>
            </div>
          </div>
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
                <label>管理员 QQ（多选）</label>
                <div class="row-actions" style="margin-bottom: 8px; flex-wrap: wrap; gap: 8px">
                  <input
                    v-model="addAdminInput"
                    class="inp"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="补充 QQ 号"
                    style="max-width: 160px"
                    @keydown.enter.prevent="addAdminCandidate"
                  >
                  <button
                    type="button"
                    class="btn"
                    @click="addAdminCandidate"
                  >
                    加入候选
                  </button>
                </div>
                <p
                  v-if="extraAdminIds.length"
                  class="muted"
                  style="margin: 0 0 8px; font-size: 12px"
                >
                  手动候选：
                  <template
                    v-for="id in extraAdminIds"
                    :key="`mod-ex-${id}`"
                  >
                    <code>{{ id }}</code>
                    <button
                      type="button"
                      class="link-quiet"
                      @click="removeExtraAdmin(id)"
                    >
                      移除
                    </button>
                  </template>
                </p>
                <p
                  v-if="!adminCandidates.length"
                  class="muted"
                  style="margin: 0 0 8px; font-size: 12px"
                >
                  尚无候选：请用上方数字框添加 QQ，或让 NoneBot 先上线该账号。
                </p>
                <div
                  v-else
                  class="admin-check-grid"
                >
                  <label
                    v-for="id in adminCandidates"
                    :key="`mod-adm-${editModalAccount}-${id}`"
                  >
                    <input
                      type="checkbox"
                      :checked="draft.admins.includes(id)"
                      @change="toggleAdmin(id, ($event.target as HTMLInputElement).checked)"
                    >
                    <span>{{ id }}</span>
                  </label>
                </div>
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
  </div>
</template>
