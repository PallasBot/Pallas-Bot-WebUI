<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import {
  deleteBotConfig,
  fetchFriendList,
  fetchFriendRequests,
  fetchGroupConfigs,
  fetchInstances,
  fetchPlugins,
  fetchUserConfigById,
  putBotConfig,
  putGroupConfig,
  putUserConfig,
} from "@/api/consoleApi";
import type {
  BotConfigPublic,
  FriendListData,
  FriendOverviewBotRow,
  GroupConfigPublic,
  NapcatAccountRow,
  PluginRow,
  UserConfigPublic,
} from "@/api/pallasTypes";
import { pallasConnectionKey } from "@/types/pallas-connection";
import { pallasBotContextKey } from "@/types/pallas-bot-context";
import { getBotServiceBaseRef, ensureBotServiceBaseUrl } from "@/utils/botServiceBase";
import { accountNativeWebUiUrl, protocolAccountUrl } from "@/utils/pallasProtocolPaths";
import { useMergedBotRows, type MergedBotRow } from "@/composables/useMergedBotRows";
import { Connection } from "@element-plus/icons-vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { computed, inject, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const conn = inject(pallasConnectionKey, null);
const botCtx = inject(pallasBotContextKey, null);

const pallasApiOk = computed(() => conn?.ok.value === true);

type InstSection = "inst" | "friends" | "group";

/** 路由页面范围 */
const pageScope = computed(() => (route.meta.pallasScope === "accounts" ? "accounts" : "social"));

const navItems = computed(() => [{ index: "inst", label: "实例", icon: Connection }]);

const sectionTitle: Record<InstSection, string> = {
  inst: "实例",
  friends: "好友管理",
  group: "群管理",
};
const sectionSub = computed<Record<InstSection, string>>(() => ({
  inst: "",
  friends: "",
  group: "",
}));
const active = ref<InstSection>("friends");
const loading = ref(true);
const groupIdFilter = ref("");
const nonebot = ref<Awaited<ReturnType<typeof fetchInstances>>["nonebot_bots"]>([]);
const dbBots = ref<BotConfigPublic[]>([]);
const protocolSnap = ref<Awaited<ReturnType<typeof fetchInstances>>["pallas_protocol"]>(null);
const botProfiles = ref<Record<string, { nickname?: string }>>({});

const groupLoading = ref(false);
const groups = ref<GroupConfigPublic[]>([]);
const socialPullLimit = ref(1500);

const filteredGroups = computed(() => {
  const q = groupIdFilter.value.trim();
  if (!q) return groups.value;
  return groups.value.filter((g) => String(g.group_id).includes(q));
});

const protocolAccountRows = computed(
  () => (protocolSnap.value?.accounts as NapcatAccountRow[] | undefined) ?? [],
);

const pluginNames = ref<string[]>([]);

const botBase = getBotServiceBaseRef();

function pallasProtocolAccountUrl(row: NapcatAccountRow): string {
  return protocolAccountUrl(
    botBase.value || "http://localhost:8088",
    protocolSnap.value?.webui_path,
    String(row.id ?? row.qq ?? "").trim(),
  );
}

const { mergedRows } = useMergedBotRows(nonebot, dbBots);
const socialSelectedBotSelfId = ref<string | null>(null);
watch(
  mergedRows,
  (rows) => {
    if (!rows.length) {
      socialSelectedBotSelfId.value = null;
      return;
    }
    const cur = socialSelectedBotSelfId.value;
    const has = cur ? rows.some((r) => r.selfId === cur || String(r.account) === cur) : false;
    if (!has) {
      const preferred = botCtx?.selectedBotSelfId.value;
      const pick = preferred && rows.some((r) => r.selfId === preferred || String(r.account) === preferred)
        ? preferred
        : rows[0]!.selfId;
      socialSelectedBotSelfId.value = pick;
    }
  },
  { immediate: true },
);
const socialSelectedBot = computed(
  () =>
    mergedRows.value.find(
      (r) => r.selfId === socialSelectedBotSelfId.value || String(r.account) === socialSelectedBotSelfId.value,
    ) ?? null,
);

const selectedInstanceKey = ref<string | null>(null);
watch(
  mergedRows,
  (rows) => {
    if (!rows.length) {
      selectedInstanceKey.value = null;
      return;
    }
    const cur = selectedInstanceKey.value;
    if (!cur || !rows.some((r) => r.key === cur)) {
      selectedInstanceKey.value = rows[0]!.key;
    }
  },
  { immediate: true },
);
const selectedMergedRow = computed(
  () => mergedRows.value.find((r) => r.key === selectedInstanceKey.value) ?? null,
);
const napcatForSelection = computed(() => {
  const row = selectedMergedRow.value;
  if (!row) return [];
  const ids = new Set<string>();
  if (row.account >= 0) ids.add(String(row.account));
  ids.add(String(row.selfId).trim());
  return protocolAccountRows.value.filter((r) => {
    const q = String(r.qq ?? r.id ?? "").trim();
    return q && ids.has(q);
  });
});
function onInstRowClick(row: MergedBotRow) {
  selectedInstanceKey.value = row.key;
  if (botCtx) botCtx.setSelectedBotSelfId(row.selfId);
}

watch(
  () => botCtx?.selectedBotSelfId.value,
  (sid) => {
    if (!sid) return;
    if (socialSelectedBotSelfId.value === sid) return;
    if (mergedRows.value.some((r) => r.selfId === sid || String(r.account) === sid)) {
      socialSelectedBotSelfId.value = sid;
    }
  },
  { immediate: true },
);

watch(
  socialSelectedBotSelfId,
  (sid) => {
    if (!sid || !botCtx) return;
    if (botCtx.selectedBotSelfId.value !== sid) botCtx.setSelectedBotSelfId(sid);
  },
);

function parseAdminQqs(s: string): number[] {
  return s
    .split(/[\s,，]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
}

const botDialog = ref(false);
const editAccount = ref(0);
const formAdminsText = ref("");
const formDisabled = ref<string[]>([]);
const formAutoFriend = ref(false);
const formAutoGroup = ref(false);
const formSecurity = ref(false);
const saving = ref(false);

function openEditBot(row: MergedBotRow) {
  if (row.account < 0) {
    ElMessage.warning("无法解析 self_id 为数字账号，请用数据库中已有账号行编辑或检查连接。");
    return;
  }
  const c = row.config;
  if (!c) {
    formAdminsText.value = "";
    formDisabled.value = [];
    formAutoFriend.value = false;
    formAutoGroup.value = false;
    formSecurity.value = false;
  } else {
    formAdminsText.value = (c.admins || []).join(", ");
    formDisabled.value = [...(c.disabled_plugins || [])];
    formAutoFriend.value = c.auto_accept_friend;
    formAutoGroup.value = c.auto_accept_group;
    formSecurity.value = c.security;
  }
  editAccount.value = row.account;
  botDialog.value = true;
}

const deleting = ref(false);
const selectedKeys = ref<Set<string>>(new Set());
const batchDeleting = ref(false);

const deletableRows = computed(() => mergedRows.value.filter((r) => r.account >= 0 && r.config));

const allDeletableSelected = computed(
  () => deletableRows.value.length > 0 && deletableRows.value.every((r) => selectedKeys.value.has(r.key)),
);

function toggleSelect(key: string) {
  const s = new Set(selectedKeys.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  selectedKeys.value = s;
}

function toggleSelectAll() {
  if (allDeletableSelected.value) {
    selectedKeys.value = new Set();
  } else {
    selectedKeys.value = new Set(deletableRows.value.map((r) => r.key));
  }
}

async function batchDeleteBots() {
  const toDelete = mergedRows.value.filter((r) => selectedKeys.value.has(r.key) && r.account >= 0 && r.config);
  if (!toDelete.length) return;
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${toDelete.length} 个实例配置？此操作不可撤销。`,
      "批量删除",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning" },
    );
  } catch {
    return;
  }
  batchDeleting.value = true;
  let successCount = 0;
  const failedAccounts: number[] = [];
  for (const row of toDelete) {
    try {
      await deleteBotConfig(row.account);
      dbBots.value = dbBots.value.filter((b) => b.account !== row.account);
      successCount++;
    } catch {
      failedAccounts.push(row.account);
    }
  }
  selectedKeys.value = new Set();
  if (selectedInstanceKey.value && !mergedRows.value.some((r) => r.key === selectedInstanceKey.value)) {
    selectedInstanceKey.value = mergedRows.value[0]?.key ?? null;
  }
  if (failedAccounts.length) {
    ElMessage.warning(`已删除 ${successCount} 个，${failedAccounts.length} 个失败：${failedAccounts.join(", ")}`);
  } else {
    ElMessage.success(`已删除 ${successCount} 个实例配置`);
  }
  batchDeleting.value = false;
}

async function deleteBot(row: MergedBotRow) {
  if (row.account < 0 || !row.config) return;
  try {
    await ElMessageBox.confirm(
      `确认删除 Bot QQ ${row.account} 的数据库配置？此操作不可撤销。`,
      "删除实例配置",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning" },
    );
  } catch {
    return;
  }
  deleting.value = true;
  try {
    await deleteBotConfig(row.account);
    dbBots.value = dbBots.value.filter((b) => b.account !== row.account);
    if (selectedInstanceKey.value === row.key) {
      selectedInstanceKey.value = mergedRows.value.find((r) => r.key !== row.key)?.key ?? null;
    }
    ElMessage.success("已删除");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    deleting.value = false;
  }
}

async function saveBot() {
  saving.value = true;
  try {
    const updated = await putBotConfig(editAccount.value, {
      admins: parseAdminQqs(formAdminsText.value),
      disabled_plugins: formDisabled.value,
      auto_accept_friend: formAutoFriend.value,
      auto_accept_group: formAutoGroup.value,
      security: formSecurity.value,
    });
    const i = dbBots.value.findIndex((b) => b.account === updated.account);
    if (i >= 0) dbBots.value[i] = updated;
    else dbBots.value = [...dbBots.value, updated];
    ElMessage.success("已保存");
    botDialog.value = false;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    saving.value = false;
  }
}

const editGroupId = ref(0);
const gFormDisabled = ref<string[]>([]);
const gFormRoulette = ref<0 | 1>(1);
const gFormBanned = ref(false);
const gSaving = ref(false);


async function saveGroup() {
  gSaving.value = true;
  try {
    const updated = await putGroupConfig(editGroupId.value, {
      disabled_plugins: gFormDisabled.value,
      roulette_mode: gFormRoulette.value === 1 ? 1 : 0,
      banned: gFormBanned.value,
    });
    const i = groups.value.findIndex((x) => x.group_id === updated.group_id);
    if (i >= 0) groups.value[i] = updated;
    ElMessage.success("已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    gSaving.value = false;
  }
}

const friendOvLoading = ref(false);
const friendOverview = ref<FriendOverviewBotRow[]>([]);

async function loadFriendOverview() {
  if (conn?.ok.value !== true) {
    friendOverview.value = [];
    return;
  }
  friendOvLoading.value = true;
  try {
    const d = await fetchFriendRequests({ doubt: true });
    friendOverview.value = d.bots;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "好友申请概览加载失败");
    friendOverview.value = [];
  } finally {
    friendOvLoading.value = false;
  }
}

const selectedFriendSelfId = ref<string | null>(null);
watch(
  () => friendOverview.value,
  (bots) => {
    if (!bots.length) {
      selectedFriendSelfId.value = null;
      return;
    }
    const cur = selectedFriendSelfId.value;
    if (!cur || !bots.some((b) => b.self_id === cur)) {
      selectedFriendSelfId.value = bots[0]!.self_id;
    }
  },
  { immediate: true, deep: true },
);
const selectedGroupId = ref<number | null>(null);
watch(
  () => filteredGroups.value,
  (groups) => {
    if (!groups.length) {
      selectedGroupId.value = null;
      return;
    }
    const cur = selectedGroupId.value;
    if (cur == null || !groups.some((g) => g.group_id === cur)) {
      selectedGroupId.value = groups[0]!.group_id;
    }
  },
  { immediate: true, deep: true },
);
const selectedGroup = computed(
  () => filteredGroups.value.find((g) => g.group_id === selectedGroupId.value) ?? null,
);
watch(selectedGroup, (g) => {
  if (!g) return;
  gFormDisabled.value = [...(g.disabled_plugins || [])];
  gFormRoulette.value = g.roulette_mode === 1 ? 1 : 0;
  gFormBanned.value = g.banned;
});
function onGroupRowClick(row: GroupConfigPublic) {
  selectedGroupId.value = row.group_id;
}

const socialFriendListLoading = ref(false);
const socialFriendList = ref<FriendListData | null>(null);
const friendIdFilter = ref("");
const selectedFriendUserId = ref<number | null>(null);
const selectedFriendRow = computed(() =>
  socialFriendList.value?.friends.find((f) => f.user_id === selectedFriendUserId.value) ?? null,
);
const filteredSocialFriends = computed(() => {
  const list = socialFriendList.value?.friends ?? [];
  const q = friendIdFilter.value.trim();
  if (!q) return list;
  return list.filter((f) => String(f.user_id).includes(q) || (f.nickname || "").includes(q));
});
const userCfgLoading = ref(false);
const userCfgSaving = ref(false);
const userCfg = ref<UserConfigPublic | null>(null);
const uFormBanned = ref(false);

function onFriendRowClick(userId: number) {
  selectedFriendUserId.value = userId;
}

async function loadSelectedUserConfig() {
  const uid = selectedFriendUserId.value;
  if (!uid) {
    userCfg.value = null;
    return;
  }
  userCfgLoading.value = true;
  try {
    const data = await fetchUserConfigById(uid);
    userCfg.value = data;
    uFormBanned.value = data.banned;
  } catch (e) {
    userCfg.value = null;
    ElMessage.error(e instanceof Error ? e.message : "用户配置加载失败");
  } finally {
    userCfgLoading.value = false;
  }
}

async function saveUserConfig() {
  const uid = selectedFriendUserId.value;
  if (!uid) return;
  userCfgSaving.value = true;
  try {
    const data = await putUserConfig(uid, { banned: uFormBanned.value });
    userCfg.value = data;
    ElMessage.success("已保存用户配置");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "用户配置保存失败");
  } finally {
    userCfgSaving.value = false;
  }
}

async function loadSocialFriendList(selfId: string | null) {
  if (!selfId || !/^\d+$/.test(selfId)) {
    socialFriendList.value = null;
    selectedFriendUserId.value = null;
    userCfg.value = null;
    return;
  }
  socialFriendListLoading.value = true;
  try {
    socialFriendList.value = await fetchFriendList(parseInt(selfId, 10), socialPullLimit.value);
    const first = socialFriendList.value.friends[0]?.user_id ?? null;
    if (
      selectedFriendUserId.value == null ||
      !socialFriendList.value.friends.some((f) => f.user_id === selectedFriendUserId.value)
    ) {
      selectedFriendUserId.value = first;
    }
  } catch {
    socialFriendList.value = null;
    selectedFriendUserId.value = null;
    userCfg.value = null;
  } finally {
    socialFriendListLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchInstances();
    nonebot.value = data.nonebot_bots;
    dbBots.value = data.db_bot_configs;
    botProfiles.value = data.bot_profiles ?? {};
    protocolSnap.value = data.pallas_protocol ?? data.napcat ?? null;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  groupLoading.value = true;
  try {
    groups.value = await fetchGroupConfigs(socialPullLimit.value);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "群配置加载失败");
    groups.value = [];
  } finally {
    groupLoading.value = false;
  }
}

async function loadPluginNames() {
  try {
    const rows: PluginRow[] = await fetchPlugins();
    pluginNames.value = rows.map((p) => p.name).filter(Boolean);
    pluginNames.value.sort();
  } catch {
    pluginNames.value = [];
  }
}

function rouletteModeLabel(v: number): string {
  return v === 1 ? "禁言" : "踢人";
}

function botNickname(row: MergedBotRow): string {
  const sid = String(row.selfId || "").trim();
  const aid = row.account >= 0 ? String(row.account) : "";
  const profile = botProfiles.value[sid] ?? (aid ? botProfiles.value[aid] : undefined);
  const profileName = String(profile?.nickname ?? "").trim();
  if (profileName) return profileName.toUpperCase();
  const ids = new Set<string>([String(row.selfId || "").trim()]);
  if (row.account >= 0) ids.add(String(row.account));
  for (const r of protocolAccountRows.value) {
    const q = String(r.qq ?? r.id ?? "").trim();
    if (!q || !ids.has(q)) continue;
    const name = String(r.display_name ?? "").trim();
    if (name) return name.toUpperCase();
  }
  return "BOT";
}

onMounted(() => {
  void ensureBotServiceBaseUrl();
  if (pageScope.value === "social") {
    const t = route.query.tab;
    if (t === "inst" || t === "instance" || t === "bot") {
      const rest = { ...route.query } as Record<string, string | string[] | undefined>;
      delete rest.tab;
      void router.replace({ name: "accounts", query: rest });
      return;
    }
  }
  if (pageScope.value === "accounts") {
    active.value = "inst";
    if ("tab" in route.query) {
      const q = { ...route.query };
      delete q.tab;
      void router.replace({ name: "accounts", query: q });
    }
  } else {
    active.value = "friends";
  }
  const gid = route.query.gid;
  if (typeof gid === "string" && gid) groupIdFilter.value = gid;
  void load();
  void loadPluginNames();
  void loadGroups();
  if (active.value === "friends") void loadFriendOverview();
});

watch(
  pageScope,
  (scope) => {
    if (scope === "accounts") {
      active.value = "inst";
    } else if (active.value === "inst") {
      active.value = "friends";
    }
  },
  { immediate: true },
);

watch(active, (tab) => {
  if (pageScope.value === "accounts") {
    if ("tab" in route.query) {
      const q = { ...route.query };
      delete q.tab;
      void router.replace({ name: "accounts", query: q });
    }
    return;
  }
  if (tab === "inst") void router.push({ name: "accounts" });
});

watch(
  () => socialSelectedBotSelfId.value,
  (sid) => {
    friendIdFilter.value = "";
    void loadSocialFriendList(sid);
  },
  { immediate: true },
);

watch(
  () => selectedFriendUserId.value,
  () => {
    void loadSelectedUserConfig();
  },
  { immediate: true },
);

watch(
  () => conn?.healthTick.value,
  () => {
    if (!conn?.ok.value) return;
    if (!loading.value && nonebot.value.length === 0 && dbBots.value.length === 0) {
      void load();
    }
    if (!groupLoading.value && groups.value.length === 0) {
      void loadGroups();
    }
    if (!friendOvLoading.value) {
      void loadFriendOverview();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    if (!loading.value && nonebot.value.length === 0 && dbBots.value.length === 0) {
      void load();
    }
    if (!groupLoading.value && groups.value.length === 0) {
      void loadGroups();
    }
    void loadFriendOverview();
  },
  { immediate: true },
);
</script>

<template>
  <div class="view-page instances-page">
    <PallasSidebarShell
    v-model="active"
    :aside-title="pageScope === 'accounts' ? '实例' : '好友与群'"
    :menu-aria-label="pageScope === 'accounts' ? '实例' : '好友与群分节'"
    :nav-items="navItems"
    :hide-aside="true"
  >
    <template #header="{ section: s }">
      <div class="head-row">
        <div class="head-left">
          <h1 class="main-title">{{ pageScope === "social" ? "好友与群管理" : sectionTitle[s as InstSection] }}</h1>
          <p
            v-if="sectionSub[s as InstSection]"
            class="main-sub"
          >{{ sectionSub[s as InstSection] }}</p>
        </div>
      </div>
    </template>

    <div
      v-show="pageScope === 'accounts'"
      class="inst-panel inst-panel--wide"
    >
      <div class="pan3 pan3--list-left">
        <section class="pan3-main">
          <el-card
            v-loading="loading"
            class="c"
            shadow="hover"
          >
            <template #header>
              <div class="hd">
                <span>当前连接与库内配置</span>
                <el-text
                  class="hd-info"
                  type="info"
                  size="small"
                >协议端连接与数据库缓存</el-text>
              </div>
            </template>
            <div class="card-list">
              <button
                v-for="row in mergedRows"
                :key="row.key"
                type="button"
                class="mini-card"
                :class="{ active: row.key === selectedInstanceKey }"
                @click="onInstRowClick(row)"
              >
                <div class="mini-card-hd">
                  <el-checkbox
                    v-if="row.account >= 0 && row.config"
                    :model-value="selectedKeys.has(row.key)"
                    class="mini-card-check"
                    @click.stop="toggleSelect(row.key)"
                  />
                  <span class="mini-card-bot-name">{{ botNickname(row) }}</span>
                  <el-tag :type="row.online ? 'success' : 'info'" size="small">{{ row.online ? "已连接" : "未连接" }}</el-tag>
                </div>
                <div class="mini-kv">Bot QQ：<span class="mono">{{ row.account >= 0 ? row.account : row.selfId }}</span></div>
                <div class="mini-kv">协议类型：{{ row.adapter }}</div>
                <div class="mini-kv">管理员：<span class="mono sm">{{ row.config?.admins?.length ? row.config.admins.join(", ") : "—" }}</span></div>
                <div class="mini-tags">
                  <el-tag
                    v-for="n in (row.config?.disabled_plugins || []).slice(0, 4)"
                    :key="n"
                    class="tag"
                    size="small"
                    type="warning"
                  >{{ n }}</el-tag>
                  <span class="mini-tags-empty" v-if="!(row.config?.disabled_plugins || []).length">无禁用插件</span>
                </div>
                <div class="mini-actions">
                  <el-button
                    v-if="row.account >= 0"
                    type="primary"
                    link
                    @click.stop="openEditBot(row)"
                  >修改</el-button>
                  <el-button
                    v-if="row.account >= 0 && row.config"
                    type="danger"
                    link
                    :loading="deleting"
                    @click.stop="deleteBot(row)"
                  >删除</el-button>
                </div>
              </button>
            </div>
            <div class="ft">
              <el-button
                type="primary"
                plain
                :loading="loading"
                @click="load"
              >刷新本页</el-button>
              <template v-if="deletableRows.length">
                <el-checkbox
                  :model-value="allDeletableSelected"
                  :indeterminate="selectedKeys.size > 0 && !allDeletableSelected"
                  @click="toggleSelectAll"
                >全选</el-checkbox>
                <el-button
                  v-if="selectedKeys.size > 0"
                  type="danger"
                  :loading="batchDeleting"
                  @click="batchDeleteBots"
                >批量删除 ({{ selectedKeys.size }})</el-button>
              </template>
            </div>
          </el-card>
        </section>
        <aside
          class="pan3-insp"
          aria-label="实例详情"
        >
          <el-card
            v-if="selectedMergedRow"
            class="c c-insp"
            shadow="hover"
          >
            <template #header>
              <span class="insp-h">当前实例</span>
            </template>
            <el-descriptions
              :column="1"
              border
              size="small"
              class="insp-desc"
            >
              <el-descriptions-item label="昵称">
                {{ botNickname(selectedMergedRow) }}
              </el-descriptions-item>
              <el-descriptions-item label="Bot QQ">
                {{ selectedMergedRow.account >= 0 ? selectedMergedRow.account : "?" }}
              </el-descriptions-item>
              <el-descriptions-item label="适配器">
                {{ selectedMergedRow.adapter }}
              </el-descriptions-item>
              <el-descriptions-item label="连接">
                <el-tag
                  :type="selectedMergedRow.online ? 'success' : 'info'"
                  size="small"
                >{{ selectedMergedRow.online ? "已连接" : "未连接" }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="管理员">
                <span
                  v-if="selectedMergedRow.config?.admins?.length"
                  class="mono sm"
                >{{ selectedMergedRow.config.admins.join(", ") }}</span>
                <span v-else>—</span>
              </el-descriptions-item>
              <el-descriptions-item label="禁用插件">
                <div class="insp-tags">
                  <el-tag
                    v-for="n in (selectedMergedRow.config?.disabled_plugins || []).slice(0, 10)"
                    :key="n"
                    class="tag"
                    size="small"
                    type="warning"
                  >{{ n }}</el-tag>
                  <span
                    v-if="(selectedMergedRow.config?.disabled_plugins || []).length > 10"
                    class="sm"
                  >+{{ (selectedMergedRow.config?.disabled_plugins || []).length - 10 }}</span>
                  <span
                    v-if="!(selectedMergedRow.config?.disabled_plugins || []).length"
                  >—</span>
                </div>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedMergedRow.config"
                label="自动同意"
              >
                <span class="insp-accept-tags">
                  <el-tag :type="selectedMergedRow.config.auto_accept_friend ? 'success' : 'info'" size="small">好友 {{ selectedMergedRow.config.auto_accept_friend ? "自动通过" : "手动审核" }}</el-tag>
                  <el-tag :type="selectedMergedRow.config.auto_accept_group ? 'success' : 'info'" size="small">入群 {{ selectedMergedRow.config.auto_accept_group ? "自动通过" : "手动审核" }}</el-tag>
                </span>
              </el-descriptions-item>
              <el-descriptions-item
                v-if="selectedMergedRow.config"
                label="安全模式"
              >{{ selectedMergedRow.config.security ? "开" : "关" }}</el-descriptions-item>
            </el-descriptions>
            <div class="insp-actions">
              <el-button
                type="primary"
                size="small"
                :disabled="selectedMergedRow.account < 0"
                @click="openEditBot(selectedMergedRow)"
              >修改配置</el-button>
              <el-button
                v-if="selectedMergedRow.account >= 0 && selectedMergedRow.config"
                type="danger"
                size="small"
                :loading="deleting"
                @click="deleteBot(selectedMergedRow)"
              >删除实例</el-button>
            </div>
            <div
              v-if="protocolSnap && napcatForSelection.length"
              class="insp-nap"
            >
              <div class="insp-nap-t">协议管理</div>
              <div
                v-for="r in napcatForSelection"
                :key="String(r.qq ?? r.id ?? '')"
                class="insp-nap-row"
              >
                <el-tag
                  size="small"
                  :type="r.connected ? 'success' : 'info'"
                >{{ r.connected ? "已连接" : "未连接" }}</el-tag>
                <el-link
                  v-if="protocolSnap.webui_enabled"
                  type="primary"
                  :href="pallasProtocolAccountUrl(r)"
                >Pallas管理</el-link>
                <el-link
                  v-if="accountNativeWebUiUrl(r)"
                  type="primary"
                  :href="accountNativeWebUiUrl(r)"
                >原生Web</el-link>
              </div>
            </div>
            <p
              v-else-if="protocolSnap"
              class="muted sm insp-tip"
            >协议账号表中无与本行 QQ 完全一致的登记。</p>
          </el-card>
          <el-card
            v-else
            class="c c-insp"
            shadow="hover"
          >
            <el-empty
              description="请选择实例"
              :image-size="64"
            />
          </el-card>
        </aside>
      </div>

    </div>

    <div
      v-show="pageScope === 'social'"
      class="inst-panel inst-panel--wide"
    >
      <div class="social-stack">
        <div class="pan3 pan3--list-left pan3--social">
          <aside
            class="pan3-insp pan3-insp-wide"
            aria-label="好友列表"
          >
            <el-card
              v-if="socialFriendList"
              class="c c-insp"
              shadow="hover"
            >
              <template #header>
                <div class="list-head">
                  <span class="insp-h">好友列表</span>
                  <el-input
                    v-model="friendIdFilter"
                    class="list-search"
                    size="small"
                    clearable
                    placeholder="按 QQ 或昵称筛选"
                  />
                </div>
              </template>
              <el-scrollbar max-height="44vh">
                <div class="list-box">
                  <div
                    v-for="f in filteredSocialFriends"
                    :key="f.user_id"
                    class="list-item list-item-btn"
                    :class="{ active: selectedFriendUserId === f.user_id }"
                    @click="onFriendRowClick(f.user_id)"
                  >
                    <div class="li-title">
                      <strong class="li-name">{{ f.nickname || "未命名" }}</strong>
                      <span v-if="f.remark && f.remark !== f.nickname" class="li-remark">{{ f.remark }}</span>
                    </div>
                    <div class="li-meta">
                      <span class="li-qq mono">{{ f.user_id }}</span>
                    </div>
                  </div>
                </div>
              </el-scrollbar>
            </el-card>
            <el-card
              v-else
              class="c c-insp"
              shadow="hover"
            >
              <el-empty
                description="该实例暂无可读好友列表"
                :image-size="64"
              />
            </el-card>
          </aside>
          <section class="pan3-main">
            <el-card
              v-loading="friendOvLoading || socialFriendListLoading"
              class="c"
              shadow="hover"
            >
              <template #header>
                <div class="hd2">
                  <div class="hd2-txt">
                    <span>好友配置面板</span>
                  </div>
                  <div class="hd2-ctl">
                    <span class="num-lab">拉取数量</span>
                    <el-input-number
                      v-model="socialPullLimit"
                      :min="50"
                      :max="10000"
                      :step="50"
                      size="small"
                      class="num"
                      @change="() => void loadSocialFriendList(socialSelectedBotSelfId)"
                    />
                    <el-button
                      type="primary"
                      plain
                      size="small"
                      :loading="friendOvLoading || socialFriendListLoading"
                      :disabled="!pallasApiOk"
                      @click="loadFriendOverview(); loadSocialFriendList(socialSelectedBotSelfId)"
                    >刷新</el-button>
                  </div>
                </div>
              </template>
              <div
                v-if="socialSelectedBot"
                class="cfg-panel cfg-panel--friend"
              >
                <div class="cfg-grid">
                  <div class="cfg-card">
                    <div class="cfg-card-title">实例概览</div>
                    <div class="cfg-row">
                      <span class="k">当前实例</span>
                      <span class="v mono">{{ socialSelectedBot.account >= 0 ? socialSelectedBot.account : socialSelectedBot.selfId }}</span>
                      <el-tag :type="socialSelectedBot.online ? 'success' : 'info'" size="small">{{ socialSelectedBot.online ? "已连接" : "未连接" }}</el-tag>
                    </div>
                    <div class="cfg-row">
                      <span class="k">自动同意好友</span>
                      <span class="v">{{ socialSelectedBot.config?.auto_accept_friend ? "开" : "关" }}</span>
                    </div>
                    <div class="cfg-row">
                      <span class="k">好友总数</span>
                      <span class="v">{{ socialFriendList?.friends.length ?? 0 }}</span>
                    </div>
                  </div>
                  <div class="cfg-card">
                    <div class="cfg-card-title">目标用户</div>
                    <div class="cfg-row">
                      <span class="k">当前用户</span>
                      <span class="v mono">{{ selectedFriendUserId ?? "未选择" }}</span>
                    </div>
                    <div class="cfg-row" v-if="selectedFriendRow">
                      <span class="k">昵称</span>
                      <span class="v sm">{{ selectedFriendRow.nickname || selectedFriendRow.remark || "—" }}</span>
                    </div>
                    <div class="cfg-row cfg-row-note" v-else>
                      <span class="sm">请选择左侧好友后再编辑配置</span>
                    </div>
                  </div>
                </div>
                <div class="cfg-card cfg-card--op">
                  <div class="cfg-card-title">用户控制</div>
                  <el-form v-loading="userCfgLoading" label-width="110px">
                    <el-form-item label="用户封禁">
                      <el-switch
                        v-model="uFormBanned"
                        :disabled="!selectedFriendUserId"
                        active-text="已封禁"
                        inactive-text="正常"
                      />
                    </el-form-item>
                  </el-form>
                  <div class="mini-actions">
                    <el-button
                      type="primary"
                      :disabled="!selectedFriendUserId"
                      :loading="userCfgSaving"
                      @click="saveUserConfig"
                    >保存用户配置</el-button>
                    <el-button
                      type="primary"
                      link
                      :disabled="socialSelectedBot.account < 0"
                      @click="openEditBot(socialSelectedBot)"
                    >编辑 Bot 配置</el-button>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                description="请先选择可用实例"
                :image-size="72"
              />
            </el-card>
          </section>
        </div>

        <div class="pan3 pan3--list-left pan3--social">
          <aside
            class="pan3-insp pan3-insp-wide"
            aria-label="群列表"
          >
            <el-card class="c c-insp" shadow="hover">
              <template #header>
                <div class="list-head">
                  <span class="insp-h">群列表</span>
                  <el-input
                    v-model="groupIdFilter"
                    class="list-search"
                    size="small"
                    clearable
                    placeholder="按群号筛选"
                  />
                </div>
              </template>
              <el-scrollbar max-height="44vh">
                <div class="list-box">
                  <button
                    v-for="g in filteredGroups"
                    :key="g.group_id"
                    type="button"
                    class="list-item list-item-btn"
                    :class="{ active: selectedGroupId === g.group_id }"
                    @click="onGroupRowClick(g)"
                  >
                    <div class="li-title">
                      <strong class="li-name mono">{{ g.group_id }}</strong>
                      <el-tag :type="g.banned ? 'danger' : 'success'" size="small">{{ g.banned ? "封禁" : "正常" }}</el-tag>
                    </div>
                    <div class="li-meta">
                      <span class="li-badge">轮盘 {{ rouletteModeLabel(g.roulette_mode) }}</span>
                      <span v-if="(g.disabled_plugins || []).length" class="li-badge li-badge--warn">禁用 {{ (g.disabled_plugins || []).length }} 插件</span>
                    </div>
                  </button>
                </div>
              </el-scrollbar>
            </el-card>
          </aside>
          <section class="pan3-main">
            <el-card
              v-loading="groupLoading"
              class="c"
              shadow="hover"
            >
              <template #header>
                <div class="hd2">
                  <div class="hd2-txt">
                    <span>群配置模板</span>
                  </div>
                  <div class="hd2-ctl">
                    <span class="num-lab">拉取数量</span>
                    <el-input-number
                      v-model="socialPullLimit"
                      :min="50"
                      :max="10000"
                      :step="50"
                      size="small"
                      class="num"
                      @change="() => void loadGroups()"
                    />
                    <el-button
                      type="primary"
                      plain
                      size="small"
                      :loading="groupLoading"
                      @click="loadGroups"
                    >刷新</el-button>
                  </div>
                </div>
              </template>
              <div
                v-if="selectedGroup"
                class="cfg-panel cfg-panel--group"
              >
                <div class="cfg-grid">
                  <div class="cfg-card">
                    <div class="cfg-card-title">群基础信息</div>
                    <div class="cfg-row">
                      <span class="k">群号</span>
                      <span class="v mono">{{ selectedGroup.group_id }}</span>
                    </div>
                    <div class="cfg-row">
                      <span class="k">已加载群数</span>
                      <span class="v">{{ groups.length }}</span>
                    </div>
                  </div>
                  <div class="cfg-card">
                    <div class="cfg-card-title">群策略</div>
                    <div class="cfg-row cfg-row-switch">
                      <span class="k">轮盘模式</span>
                      <el-switch
                        v-model="gFormRoulette"
                        :active-value="1"
                        :inactive-value="0"
                        active-text="禁言"
                        inactive-text="踢人"
                      />
                    </div>
                    <div class="cfg-row cfg-row-switch">
                      <span class="k">封禁</span>
                      <el-switch v-model="gFormBanned" />
                    </div>
                  </div>
                </div>
                <div class="cfg-card cfg-card--op">
                  <div class="cfg-card-title">插件控制</div>
                  <el-form label-width="120px">
                    <el-form-item label="本群禁用插件">
                      <el-select
                        v-model="gFormDisabled"
                        multiple
                        filterable
                        allow-create
                        default-first-option
                        class="w"
                      >
                        <el-option
                          v-for="n in pluginNames"
                          :key="n"
                          :label="n"
                          :value="n"
                        />
                      </el-select>
                    </el-form-item>
                  </el-form>
                  <div class="mini-actions">
                    <el-button
                      type="primary"
                      :loading="gSaving"
                      @click="saveGroup"
                    >保存群配置模板</el-button>
                  </div>
                </div>
              </div>
              <el-empty
                v-else
                description="请先在左侧选择群"
                :image-size="72"
              />
            </el-card>
          </section>
        </div>
      </div>
    </div>

    </PallasSidebarShell>

    <el-dialog
      v-model="botDialog"
      :title="`编辑 Bot（QQ ${editAccount}）`"
      width="min(92vw, 520px)"
      destroy-on-close
    >
      <el-form label-width="130px">
        <el-form-item label="管理员 QQ">
          <el-input
            v-model="formAdminsText"
            type="textarea"
            :rows="2"
            class="w"
            placeholder="逗号或空格分隔，如 12345, 67890"
          />
        </el-form-item>
        <el-form-item label="本号禁用的插件">
          <el-select
            v-model="formDisabled"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="从已加载插件中选，或直接输入后回车"
            class="w"
          >
            <el-option
              v-for="n in pluginNames"
              :key="n"
              :label="n"
              :value="n"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="好友与入群">
          <el-space>
            <el-checkbox v-model="formAutoFriend">自动同意好友请求</el-checkbox>
            <el-checkbox v-model="formAutoGroup">自动同意入群邀请</el-checkbox>
          </el-space>
        </el-form-item>
        <el-form-item label="安全模式">
          <el-switch v-model="formSecurity" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="botDialog = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="saveBot"
        >保存</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<style scoped lang="scss">
.main-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}
.main-sub {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--el-text-color-secondary);
}
.head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px 16px;
  flex-wrap: wrap;
}
.head-left {
  min-width: 0;
}
.head-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  :deep(.el-radio-button__inner) {
    min-width: 68px;
    text-align: center;
  }
}
.head-bot-picker {
  width: 220px;
  max-width: 70vw;
}
.head-bot-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.inst-panel {
  width: 100%;
  max-width: none;
  margin-left: 0;
  margin-right: auto;
}
.inst-panel--wide {
  max-width: none;
}
.social-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pan3 {
  display: flex;
  gap: 14px;
  align-items: stretch;
  margin-bottom: 14px;
  min-height: 0;
}
.pan3--social {
  .pan3-insp,
  .pan3-main {
    display: flex;
    min-height: 0;
  }
  .c {
    flex: 1;
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .c :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}
.pan3-rail {
  width: 210px;
  flex-shrink: 0;
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: var(--pallas-radius-md, 12px);
  background: var(--c-nav-bg);
  padding: 10px 8px 12px;
  max-height: min(58vh, 640px);
  overflow: auto;
}
.pan3-rail-h {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-main);
  padding: 2px 8px 10px;
  letter-spacing: 0.02em;
}
.pan3-rail-empty {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  padding: 12px 8px;
}
.pan3-rail-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  border-radius: var(--pallas-radius-sm, 8px);
  background: transparent;
  padding: 10px 8px;
  margin-bottom: 6px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
  color: inherit;
  font: inherit;
}
.pan3-rail-item:hover {
  background: rgba(22, 100, 196, 0.06);
}
.pan3-rail-item.active {
  border-color: rgba(22, 100, 196, 0.35);
  background: rgba(22, 100, 196, 0.1);
}
.pan3-rail-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  .nm {
    min-width: 0;
    word-break: break-all;
  }
}
.pan3-rail-meta {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #c0c4cc;
}
.dot.on {
  background: var(--el-color-success);
}
.inst-side .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #c0c4cc;
}
.inst-side .dot.on {
  background: var(--el-color-success);
}
.pan3-main {
  flex: 1;
  min-width: 0;
}
.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.card-list--proto {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
.mini-card {
  border: 1px solid rgba(22, 100, 196, 0.16);
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 12px;
  text-align: left;
  color: inherit;
  font: inherit;
}
button.mini-card {
  cursor: pointer;
  transition: all 0.15s;
}
button.mini-card:hover {
  border-color: rgba(22, 100, 196, 0.32);
  box-shadow: 0 4px 14px rgba(22, 100, 196, 0.08);
}
.mini-card.active {
  border-color: rgba(22, 100, 196, 0.45);
  box-shadow: 0 0 0 2px rgba(22, 100, 196, 0.12);
}
.mini-card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-weight: 600;
}
.mini-card-bot-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.mini-kv {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  margin-top: 2px;
  word-break: break-word;
}
.mini-tags {
  margin-top: 8px;
  font-size: 12px;
}
.mini-tags-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.mini-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pan3-insp {
  width: 280px;
  flex-shrink: 0;
  min-width: 240px;
}
.pan3-insp-wide {
  width: 280px;
}
.cfg-panel {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  padding: 12px;
}
.cfg-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}
.cfg-card {
  border: 1px solid rgba(22, 100, 196, 0.16);
  border-radius: 12px;
  background: #f7faff;
  padding: 12px;
}
.cfg-card--op {
  margin-top: 2px;
  background: #f3f8ff;
}
.cfg-panel--group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.cfg-panel--group .cfg-grid {
  display: contents;
}
.cfg-panel--group .cfg-card--op {
  margin-top: 12px;
  grid-column: 1 / -1;
}
.cfg-panel--group .cfg-card {
  min-height: 0;
}
.cfg-panel--group .cfg-card .cfg-row:last-child {
  margin-bottom: 0;
}
.cfg-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #2b5ea6;
  margin-bottom: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.cfg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.cfg-row-note {
  align-items: flex-start;
}
.cfg-row-switch {
  justify-content: space-between;
}
.cfg-row .k {
  width: 92px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.cfg-row .v {
  font-size: 14px;
  font-weight: 600;
}
.list-box {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}
.list-search {
  width: 180px;
  max-width: 100%;
}
.list-item {
  border: 1px solid rgba(22, 100, 196, 0.14);
  border-radius: 12px;
  padding: 10px 12px;
  background: #f8fbff;
  text-align: left;
  min-height: 68px;
}
.list-item-btn {
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    background 0.16s ease;
}
.list-item-btn:hover {
  border-color: rgba(22, 100, 196, 0.28);
  background: #f2f8ff;
}
.list-item-btn.active {
  border-color: rgba(22, 100, 196, 0.4);
  background: #eaf3ff;
  box-shadow: 0 0 0 2px rgba(22, 100, 196, 0.08);
}
html.dark .mini-card {
  border-color: rgba(125, 176, 255, 0.34);
  background: rgba(18, 25, 37, 0.88);
}
html.dark button.mini-card:hover {
  border-color: rgba(125, 176, 255, 0.52);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
html.dark .mini-card.active {
  border-color: rgba(125, 176, 255, 0.62);
  box-shadow: 0 0 0 2px rgba(125, 176, 255, 0.18);
}
html.dark .list-item {
  border-color: rgba(125, 176, 255, 0.3);
  background: #1a2536;
}
html.dark .list-item-btn:hover {
  border-color: rgba(125, 176, 255, 0.48);
  background: #1f2d42;
}
html.dark .list-item-btn.active {
  border-color: rgba(125, 176, 255, 0.56);
  background: #243753;
  box-shadow: 0 0 0 2px rgba(125, 176, 255, 0.14);
}
html.dark .cfg-card {
  border-color: rgba(125, 176, 255, 0.34);
  background: #1c2a3f;
}
html.dark .cfg-card--op {
  background: #1f3048;
}
html.dark .cfg-card-title {
  color: #9cc3ff;
}
.li-title {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
}
.li-name {
  font-size: 16px;
  line-height: 1.28;
  font-weight: 700;
}
.li-id {
  font-size: 12px;
}
.li-sub {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  flex-wrap: wrap;
}
.li-sub :deep(.el-tag) {
  height: 19px;
  line-height: 17px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  font-size: 11px;
  font-weight: 600;
}
.li-sub span {
  line-height: 19px;
}
.c-insp {
  margin-bottom: 0;
  :deep(.el-card__body) {
    padding-top: 12px;
  }
}
.insp-h {
  font-weight: 600;
  color: var(--c-main);
}
.insp-actions {
  margin-top: 12px;
}
.li-remark {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  background: rgba(22, 100, 196, 0.07);
  border-radius: 4px;
  padding: 1px 6px;
}
.li-meta {
  margin-top: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.li-qq {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.li-badge {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  background: rgba(22, 100, 196, 0.07);
  border-radius: 4px;
  padding: 1px 7px;
  line-height: 1.6;
}
.li-badge--warn {
  color: var(--el-color-warning);
  background: rgba(230, 162, 60, 0.1);
}
.li-status-tag {
  margin-left: auto;
}
.insp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.insp-accept-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.insp-desc :deep(.el-descriptions__label) {
  white-space: nowrap;
}
.mini-card-check {
  flex-shrink: 0;
  margin-right: 2px;
}
.insp-nap {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed rgba(22, 100, 196, 0.2);
}
.insp-nap-t {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}
.insp-nap-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.insp-tip,
.insp-pend {
  margin-top: 8px;
}
:deep(.el-table__body tr.is-pan3-picked > td.el-table__cell) {
  background: #ecf3ff !important;
}
html.dark :deep(.el-table__body tr.is-pan3-picked > td.el-table__cell) {
  background: rgba(22, 100, 196, 0.18) !important;
}
@media (max-width: 1024px) {
  .pan3 {
    flex-direction: column;
  }
  .pan3-rail {
    width: 100%;
    max-height: 220px;
  }
  .pan3-insp {
    width: 100%;
    min-width: 0;
  }
  .cfg-grid {
    grid-template-columns: 1fr;
  }
  .cfg-panel--group {
    grid-template-columns: 1fr;
  }
  .pan3-insp-wide {
    width: 100%;
    min-width: 0;
  }
}
.pan3--list-left {
  .pan3-insp {
    order: 1;
  }
  .pan3-main {
    order: 2;
  }
}
.c {
  border: 1px solid rgba(22, 100, 196, 0.1);
  margin-bottom: 14px;
}
.c2 {
  margin-top: 0;
}
.hd,
.hd2 {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  font-weight: 600;
  color: var(--c-main);
}
.hd-info {
  display: block;
  width: 100%;
  text-align: left;
  line-height: 1.6;
  font-weight: 400;
}
.hd2 {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
  flex-wrap: wrap;
  gap: 12px;
}
.hd2-txt {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 200px;
}
.hd2-ctl {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.g-search {
  width: 220px;
  max-width: 100%;
}
.num-lab {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tb-nap {
  width: 100%;
}
.h-t {
  font-weight: 600;
  color: var(--c-main);
  margin-right: 8px;
}
.tb {
  width: 100%;
  --el-table-border-color: rgba(22, 100, 196, 0.1);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(22, 100, 196, 0.08);
}
.tb-alt {
  :deep(.el-table__inner-wrapper) {
    border-radius: 10px;
    overflow: hidden;
  }
  :deep(.el-table__header th.el-table__cell) {
    background: #edf4ff;
  }
  :deep(.el-table__header .cell) {
    line-height: 1.45;
    font-weight: 600;
    color: #2b4770;
  }
  :deep(.el-table__body td.el-table__cell) {
    vertical-align: middle;
  }
  :deep(.el-table__row:hover > td.el-table__cell) {
    background: #f5f9ff !important;
  }
}
/* 表格样式 */
.tb-clean {
  :deep(.el-table__inner-wrapper) {
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
  }
  :deep(.el-table__header th.el-table__cell) {
    background: linear-gradient(180deg, #f9fbff 0%, #f2f6ff 100%);
    border-bottom: 1px solid rgba(22, 100, 196, 0.16);
  }
  :deep(.el-table__header .cell) {
    line-height: 1.5;
    font-weight: 700;
    color: #2b4770;
    letter-spacing: 0.01em;
  }
  :deep(.el-table__body td.el-table__cell) {
    vertical-align: middle;
    padding-top: 13px;
    padding-bottom: 13px;
    border-bottom: 1px solid rgba(22, 100, 196, 0.08);
    background: #fff;
  }
  :deep(.el-table__row:hover > td.el-table__cell) {
    background: #f7fbff !important;
  }
}
.fl-alert {
  margin-bottom: 10px;
}
.fl-hint {
  display: block;
  margin: 6px 0 10px;
}
.ft {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.tag {
  margin: 0 3px 3px 0;
}
.mono {
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
}
.sm,
.sm2 {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.muted {
  margin: 0 0 10px;
  line-height: 1.5;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  code {
    font-size: 0.9em;
  }
}
.lk {
  display: block;
  margin-top: 10px;
  font-size: 13px;
}
.w {
  width: 100%;
}
.num {
  max-width: 120px;
}
.req-ids {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
:deep(.main-scroll-inner) {
  margin-left: 0;
  margin-right: auto;
}
</style>
