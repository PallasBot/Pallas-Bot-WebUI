<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import {
  fetchFriendList,
  fetchGroupList,
  fetchInstances,
  fetchRequestOverview,
  postRequestAction,
  postRequestActionsBatch,
} from "@/api/consoleApi";
import type {
  BotRow,
  FriendListData,
  FriendOverviewData,
  GroupListData,
  InstancesData,
  RequestOverviewData,
} from "@/api/pallasTypes";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botPickerRowsFromInstances } from "@/utils/botDisplay";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { slicePage } from "@/utils/paginate";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const route = useRoute();
const err = ref("");
const pageReady = ref(false);
const busy = ref(false);
const listsBusy = ref(false);
const reqsBusy = ref(false);
/** 避免首屏 loadBots 写入 selfId 时与 onMounted 内的列表加载竞态 */
const skipSelfIdWatch = ref(true);
const selfIdStr = ref("");
const friends = ref<FriendListData | null>(null);
const requests = ref<FriendOverviewData | null>(null);
const groups = ref<GroupListData | null>(null);
const overview = ref<RequestOverviewData | null>(null);
const instances = ref<InstancesData | null>(null);

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

const pageFriendReq = ref(1);
const pageGroupReq = ref(1);
const pageFriends = ref(1);
const pageGroups = ref(1);

function profileNick(selfId: string): string {
  const n = instances.value?.bot_profiles?.[selfId]?.nickname?.trim();
  return n || "";
}

function botOptionLabel(b: BotRow): string {
  const nick = profileNick(b.self_id);
  if (nick) return `${nick}（${b.self_id}）`;
  return b.self_id;
}

const botsVisible = computed(() => botPickerRowsFromInstances(instances.value));

function applySelfIdFromRouteQuery() {
  const raw = route.query.self_id ?? route.query.account;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const id = s != null ? String(s).trim() : "";
  if (!id) return;
  const list = botsVisible.value;
  if (!list.some((b) => b.self_id === id)) return;
  if (selfIdStr.value === id) return;
  const prevSkip = skipSelfIdWatch.value;
  skipSelfIdWatch.value = true;
  selfIdStr.value = id;
  nextTick(() => {
    skipSelfIdWatch.value = prevSkip;
  });
}

function displayFriendReqNickname(row: { user_id: number; nickname?: string | null }): string {
  const fromApi = row.nickname?.trim();
  if (fromApi) return fromApi;
  const sid = selfIdStr.value;
  if (friends.value && friends.value.self_id === sid) {
    const hit = friends.value.friends?.find((f) => f.user_id === row.user_id);
    const n = hit?.nickname?.trim();
    if (n) return n;
  }
  return `QQ ${row.user_id}`;
}

/** 好友申请来源（内部仍为 pending / doubt，表格展示中文） */
function friendSourceLabel(source: string): string {
  if (source === "pending") return "待确认";
  if (source === "doubt") return "被过滤";
  return source;
}

/** 入群请求 sub_type（协议枚举，表格展示中文） */
function groupRequestSubTypeLabel(subType: string): string {
  const raw = subType.trim();
  const k = raw.toLowerCase();
  const map: Record<string, string> = {
    invite: "邀请入群",
    add: "主动申请",
  };
  if (map[k]) return map[k];
  if (!raw) return "—";
  return `其他（${raw}）`;
}

function selfIdNum(): number | null {
  const n = parseInt(selfIdStr.value, 10);
  return Number.isFinite(n) ? n : null;
}

function offlineFriendPayload(selfId: string): FriendListData {
  return {
    self_id: selfId,
    connection_key: "",
    adapter: "",
    friends: [],
    truncated: false,
    limit: 800,
    error:
      "当前账号未在 NoneBot 上线，无法拉取好友列表。请在「实例与连接」确认协议端已接入框架后再试。",
  };
}

function offlineGroupPayload(selfId: string): GroupListData {
  return {
    self_id: selfId,
    connection_key: "",
    adapter: "",
    groups: [],
    truncated: false,
    limit: 1000,
    error:
      "当前账号未在 NoneBot 上线，无法拉取群列表。请在「实例与连接」确认协议端已接入框架后再试。",
  };
}

async function loadBots() {
  try {
    const inst = await fetchInstances();
    instances.value = inst;
    applySelfIdFromRouteQuery();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadListsOnly() {
  const sid = selfIdNum();
  if (sid == null) return;
  listsBusy.value = true;
  err.value = "";
  try {
    const connected = accountHasNonebotBot(instances.value?.nonebot_bots, sid);
    if (connected) {
      const [fl, gl] = await Promise.all([fetchFriendList(sid), fetchGroupList(sid)]);
      friends.value = fl;
      groups.value = gl;
    } else {
      const sidStr = String(sid);
      friends.value = offlineFriendPayload(sidStr);
      groups.value = offlineGroupPayload(sidStr);
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    listsBusy.value = false;
  }
}

async function loadRequestsOnly() {
  reqsBusy.value = true;
  err.value = "";
  try {
    // 仅拉 /request-overview：与 /friend-requests 在后端重复执行 _friend_requests_overview，
    // 并行会加倍协议调用，易导致「好友列表已 200 但审批区仍卡在加载」。
    const ov = await fetchRequestOverview();
    overview.value = ov;
    requests.value = {
      bots: ov.bots.map((b) => ({
        self_id: b.self_id,
        connection_key: b.connection_key,
        adapter: b.adapter,
        online: b.online,
        pending_friend_requests: b.pending_friend_requests,
        doubt_friend_requests: b.doubt_friend_requests,
      })),
    };
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    reqsBusy.value = false;
  }
}

watch(botsVisible, (list) => {
  const cur = selfIdStr.value.trim();
  if (!cur) return;
  if (!list.some((b) => b.self_id === cur)) {
    selfIdStr.value = "";
  }
});

async function refreshPage() {
  await loadBots();
  const tasks: Promise<void>[] = [loadRequestsOnly()];
  if (selfIdStr.value.trim()) tasks.push(loadListsOnly());
  await Promise.all(tasks);
}

watch(selfIdStr, () => {
  if (skipSelfIdWatch.value) return;
  const sid = selfIdStr.value.trim();
  if (!sid) {
    friends.value = null;
    groups.value = null;
    return;
  }
  reqsBusy.value = true;
  requests.value = null;
  overview.value = null;
  void loadListsOnly().finally(() => {
    void loadRequestsOnly().finally(() => {
      scrollFriendsGroupsHashIntoView();
    });
  });
});

function scrollFriendsGroupsHashIntoView() {
  const raw = (route.hash || "").replace(/^#/, "").trim();
  if (!raw) return;
  nextTick(() => {
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

watch(
  () => [route.hash, pageReady.value] as const,
  () => {
    if (!pageReady.value) return;
    scrollFriendsGroupsHashIntoView();
  },
);

const requestRows = computed(() => {
  const out: Array<{
    self_id: string;
    source: "pending" | "doubt";
    user_id: number;
    nickname?: string | null;
  }> = [];
  const data = requests.value?.bots ?? [];
  for (const b of data) {
    for (const p of b.pending_friend_requests ?? []) {
      out.push({
        self_id: b.self_id,
        source: "pending",
        user_id: p.user_id,
        nickname: p.nickname,
      });
    }
    for (const d of b.doubt_friend_requests ?? []) {
      out.push({
        self_id: b.self_id,
        source: "doubt",
        user_id: d.user_id,
        nickname: d.nickname,
      });
    }
  }
  return out.filter((r) => Boolean(selfIdStr.value.trim()) && r.self_id === selfIdStr.value);
});

const groupRequestRows = computed(() => {
  const out: Array<{
    self_id: string;
    group_id: number;
    user_id: number;
    comment: string;
    sub_type: string;
  }> = [];
  for (const b of overview.value?.bots ?? []) {
    for (const g of b.pending_group_requests ?? []) {
      out.push({
        self_id: b.self_id,
        group_id: g.group_id,
        user_id: g.user_id,
        comment: g.comment,
        sub_type: g.sub_type,
      });
    }
  }
  return out.filter((r) => Boolean(selfIdStr.value.trim()) && r.self_id === selfIdStr.value);
});

function friendReqKey(row: { self_id: string; source: string; user_id: number }): string {
  return `${row.self_id}\t${row.source}\t${row.user_id}`;
}

function groupReqKey(row: { self_id: string; group_id: number; user_id: number }): string {
  return `${row.self_id}\t${row.group_id}\t${row.user_id}`;
}

const pickedFriendKeys = shallowRef(new Set<string>());
const pickedGroupKeys = shallowRef(new Set<string>());

function setPickedFriends(next: Set<string>) {
  pickedFriendKeys.value = next;
}

function setPickedGroups(next: Set<string>) {
  pickedGroupKeys.value = next;
}

function togglePickFriend(key: string) {
  const s = new Set(pickedFriendKeys.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  setPickedFriends(s);
}

function togglePickGroup(key: string) {
  const s = new Set(pickedGroupKeys.value);
  if (s.has(key)) s.delete(key);
  else s.add(key);
  setPickedGroups(s);
}

const allFriendKeys = computed(() => requestRows.value.map(friendReqKey));

const allGroupKeys = computed(() => groupRequestRows.value.map(groupReqKey));

const allFriendsPicked = computed(
  () => allFriendKeys.value.length > 0 && allFriendKeys.value.every((k) => pickedFriendKeys.value.has(k)),
);

const someFriendsPicked = computed(() => pickedFriendKeys.value.size > 0 && !allFriendsPicked.value);

const allGroupsPicked = computed(
  () => allGroupKeys.value.length > 0 && allGroupKeys.value.every((k) => pickedGroupKeys.value.has(k)),
);

const someGroupsPicked = computed(() => pickedGroupKeys.value.size > 0 && !allGroupsPicked.value);

function togglePickAllFriends() {
  if (allFriendsPicked.value) setPickedFriends(new Set());
  else setPickedFriends(new Set(allFriendKeys.value));
}

function togglePickAllGroups() {
  if (allGroupsPicked.value) setPickedGroups(new Set());
  else setPickedGroups(new Set(allGroupKeys.value));
}

watch(requestRows, (rows) => {
  const allowed = new Set(rows.map(friendReqKey));
  const s = new Set([...pickedFriendKeys.value].filter((k) => allowed.has(k)));
  if (s.size !== pickedFriendKeys.value.size) setPickedFriends(s);
});

watch(groupRequestRows, (rows) => {
  const allowed = new Set(rows.map(groupReqKey));
  const s = new Set([...pickedGroupKeys.value].filter((k) => allowed.has(k)));
  if (s.size !== pickedGroupKeys.value.size) setPickedGroups(s);
});

const pagedRequestRows = computed(() => slicePage(requestRows.value, pageFriendReq.value, tablePageSize.value));

const pagedGroupRequestRows = computed(() => slicePage(groupRequestRows.value, pageGroupReq.value, tablePageSize.value));

const pagedFriends = computed(() => slicePage(friends.value?.friends ?? [], pageFriends.value, tablePageSize.value));

const pagedGroups = computed(() => slicePage(groups.value?.groups ?? [], pageGroups.value, tablePageSize.value));

const pageRefreshBusy = computed(() => busy.value || listsBusy.value || reqsBusy.value);

watch(
  () => consolePrefs.tablePageSize,
  () => {
    pageFriendReq.value = 1;
    pageGroupReq.value = 1;
    pageFriends.value = 1;
    pageGroups.value = 1;
  },
);

watch([requestRows, groupRequestRows, () => friends.value?.friends?.length, () => groups.value?.groups?.length, selfIdStr], () => {
  pageFriendReq.value = 1;
  pageGroupReq.value = 1;
  pageFriends.value = 1;
  pageGroups.value = 1;
});

async function actFriend(
  targetSelf: string,
  userId: number,
  action: "approve" | "reject",
  source: "pending" | "doubt",
) {
  const sid = parseInt(targetSelf, 10);
  if (!Number.isFinite(sid)) return;
  busy.value = true;
  err.value = "";
  try {
    await postRequestAction({
      self_id: sid,
      kind: "friend",
      action,
      source,
      user_id: userId,
    });
    const k = friendReqKey({ self_id: targetSelf, source, user_id: userId });
    const ns = new Set(pickedFriendKeys.value);
    ns.delete(k);
    setPickedFriends(ns);
    await loadRequestsOnly();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function actGroup(targetSelf: string, userId: number, groupId: number, action: "approve" | "reject") {
  const sid = parseInt(targetSelf, 10);
  if (!Number.isFinite(sid)) return;
  busy.value = true;
  err.value = "";
  try {
    await postRequestAction({
      self_id: sid,
      kind: "group",
      action,
      source: "pending",
      user_id: userId,
      group_id: groupId,
    });
    const k = groupReqKey({ self_id: targetSelf, group_id: groupId, user_id: userId });
    const ns = new Set(pickedGroupKeys.value);
    ns.delete(k);
    setPickedGroups(ns);
    await loadRequestsOnly();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

function formatBatchErr(
  label: string,
  ok: number,
  fail: number,
  errors: Array<{ error?: string }>,
): string {
  if (fail <= 0) return "";
  const first = errors[0]?.error?.trim();
  const tail = first ? `：${first}` : "";
  return `${label} 部分失败（成功 ${ok} / 失败 ${fail}）${tail}`;
}

async function actFriendBatch(rows: typeof requestRows.value, action: "approve" | "reject") {
  if (!rows.length) return;
  busy.value = true;
  err.value = "";
  try {
    const friends = rows
      .map((row) => {
        const sid = parseInt(row.self_id, 10);
        if (!Number.isFinite(sid)) return null;
        return { self_id: sid, user_id: row.user_id, source: row.source };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (!friends.length) return;
    const r = await postRequestActionsBatch({ action, friends, groups: [] });
    setPickedFriends(new Set());
    await loadRequestsOnly();
    if (r.friends_fail > 0) {
      err.value = formatBatchErr("好友申请", r.friends_ok, r.friends_fail, r.friends_errors);
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function actGroupBatch(rows: typeof groupRequestRows.value, action: "approve" | "reject") {
  if (!rows.length) return;
  busy.value = true;
  err.value = "";
  try {
    const groups = rows
      .map((row) => {
        const sid = parseInt(row.self_id, 10);
        if (!Number.isFinite(sid)) return null;
        return { self_id: sid, user_id: row.user_id, group_id: row.group_id };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (!groups.length) return;
    const r = await postRequestActionsBatch({ action, friends: [], groups });
    setPickedGroups(new Set());
    await loadRequestsOnly();
    if (r.groups_fail > 0) {
      err.value = formatBatchErr("入群请求", r.groups_ok, r.groups_fail, r.groups_errors);
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function approvePickedFriends() {
  const keys = [...pickedFriendKeys.value];
  const rows = requestRows.value.filter((r) => keys.includes(friendReqKey(r)));
  await actFriendBatch(rows, "approve");
}

async function approveAllFriends() {
  await actFriendBatch([...requestRows.value], "approve");
}

async function approvePickedGroups() {
  const keys = [...pickedGroupKeys.value];
  const rows = groupRequestRows.value.filter((r) => keys.includes(groupReqKey(r)));
  await actGroupBatch(rows, "approve");
}

async function approveAllGroups() {
  await actGroupBatch([...groupRequestRows.value], "approve");
}

async function rejectPickedFriends() {
  const keys = [...pickedFriendKeys.value];
  const rows = requestRows.value.filter((r) => keys.includes(friendReqKey(r)));
  await actFriendBatch(rows, "reject");
}

async function rejectPickedGroups() {
  const keys = [...pickedGroupKeys.value];
  const rows = groupRequestRows.value.filter((r) => keys.includes(groupReqKey(r)));
  await actGroupBatch(rows, "reject");
}

watch(
  () => String(route.query.self_id ?? route.query.account ?? "").trim(),
  async (sid, prev) => {
    applySelfIdFromRouteQuery();
    if (!pageReady.value) return;
    if (sid === prev) return;
    await Promise.all([loadListsOnly(), loadRequestsOnly()]);
    scrollFriendsGroupsHashIntoView();
  },
);

onMounted(async () => {
  try {
    await loadBots();
    const tasks: Promise<void>[] = [loadRequestsOnly()];
    if (selfIdStr.value.trim()) tasks.push(loadListsOnly());
    await Promise.all(tasks);
  } finally {
    pageReady.value = true;
    skipSelfIdWatch.value = false;
    scrollFriendsGroupsHashIntoView();
  }
});

function toggleFriendsListPanel() {
  setConsolePrefs({ friendsPageFriendsListOpen: !consolePrefs.friendsPageFriendsListOpen });
}

function toggleGroupsListPanel() {
  setConsolePrefs({ friendsPageGroupsListOpen: !consolePrefs.friendsPageGroupsListOpen });
}
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
      :panels="5"
    />
    <div v-else>
    <div
      id="fg-account"
      class="panel friends-groups-account-panel"
    >
      <div class="panel__hd friends-groups-account-panel__hd">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>当前账号
          <RefreshIconButton
            :busy="pageRefreshBusy"
            :disabled="pageRefreshBusy"
            label="刷新本页数据"
            @click="refreshPage"
          />
        </h2>
        <div class="friends-groups-account-hd-tail">
          <span class="friends-groups-account-hd-pin-wrap">
            <PanelSidebarAdd pin-id="friends-groups-account" />
          </span>
          <select
            v-model="selfIdStr"
            class="sel friends-groups-account-sel"
          >
            <option value="">请选择 Bot…</option>
            <option
              v-for="b in botsVisible"
              :key="b.self_id"
              :value="b.self_id"
            >
              {{ botOptionLabel(b) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div
      id="fg-friends"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>好友列表
        </h2>
        <div
          class="row-actions friends-groups-list-hd-actions"
          style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"
        >
          <PanelSidebarAdd pin-id="friends-groups-friends" />
          <span
            v-if="selfIdStr && listsBusy"
            class="muted"
            style="font-size: 12px"
          >列表加载中…</span>
          <span
            v-else-if="friends?.truncated"
            class="badge badge--warn"
          >已截断</span>
          <button
            type="button"
            class="btn"
            style="padding: 6px 12px; font-size: 12px"
            @click="toggleFriendsListPanel"
          >
            {{ consolePrefs.friendsPageFriendsListOpen ? "收起" : "展开" }}
          </button>
        </div>
      </div>
      <div
        v-show="consolePrefs.friendsPageFriendsListOpen"
        class="panel__bd"
      >
        <p
          v-if="!selfIdStr.trim()"
          class="muted"
          style="margin: 0"
        >
          请选择 Bot 后加载好友列表。
        </p>
        <p
          v-else-if="friends?.error"
          class="alert alert--err"
        >
          {{ friends.error }}
        </p>
        <div
          v-else-if="!friends?.friends?.length"
          class="muted"
        >
          暂无数据。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>QQ</th>
                <th>昵称</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="f in pagedFriends"
                :key="f.user_id"
              >
                <td>{{ f.user_id }}</td>
                <td>{{ f.nickname }}</td>
                <td class="muted">{{ f.remark }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="(friends?.friends?.length ?? 0) > 0"
          v-model:page="pageFriends"
          v-model:page-size="tablePageSize"
          :total="friends?.friends?.length ?? 0"
        />
      </div>
    </div>

    <div
      id="fg-groups"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>群聊列表
        </h2>
        <div
          class="row-actions friends-groups-list-hd-actions"
          style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"
        >
          <PanelSidebarAdd pin-id="friends-groups-groups" />
          <span
            v-if="selfIdStr && listsBusy"
            class="muted"
            style="font-size: 12px"
          >列表加载中…</span>
          <span
            v-else-if="groups?.truncated"
            class="badge badge--warn"
          >已截断 · limit {{ groups?.limit }}</span>
          <button
            type="button"
            class="btn"
            style="padding: 6px 12px; font-size: 12px"
            @click="toggleGroupsListPanel"
          >
            {{ consolePrefs.friendsPageGroupsListOpen ? "收起" : "展开" }}
          </button>
        </div>
      </div>
      <div
        v-show="consolePrefs.friendsPageGroupsListOpen"
        class="panel__bd"
      >
        <p
          v-if="!selfIdStr.trim()"
          class="muted"
          style="margin: 0"
        >
          请选择 Bot 后加载群聊列表。
        </p>
        <p
          v-else-if="groups?.error"
          class="alert alert--err"
        >
          {{ groups.error }}
        </p>
        <div
          v-else-if="!groups?.groups?.length"
          class="muted"
        >
          暂无数据。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>群号</th>
                <th>群名</th>
                <th>成员</th>
                <th>上限</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="g in pagedGroups"
                :key="g.group_id"
              >
                <td>{{ g.group_id }}</td>
                <td>{{ g.group_name }}</td>
                <td>{{ g.member_count }}</td>
                <td class="muted">{{ g.max_member_count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="(groups?.groups?.length ?? 0) > 0"
          v-model:page="pageGroups"
          v-model:page-size="tablePageSize"
          :total="groups?.groups?.length ?? 0"
        />
      </div>
    </div>

    <div
      id="friends-groups-friend-requests"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>好友申请
          <RefreshIconButton
            :busy="reqsBusy"
            :disabled="reqsBusy || busy || !selfIdStr.trim()"
            label="刷新审批数据"
            @click="loadRequestsOnly"
          />
        </h2>
        <div
          class="row-actions"
          style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"
        >
          <PanelSidebarAdd pin-id="friends-groups-friend-req" />
          <span
            v-if="reqsBusy"
            class="muted"
            style="font-size: 12px"
          >审批数据加载中…</span>
          <span
            v-if="requestRows.length"
            class="badge badge--warn"
          >{{ requestRows.length }} 条</span>
          <div class="friends-groups-req-hd-bulk-btns">
            <button
              type="button"
              class="btn btn--primary"
              :disabled="busy || pickedFriendKeys.size === 0"
              @click="approvePickedFriends"
            >
              同意所选
            </button>
            <button
              type="button"
              class="btn"
              :disabled="busy || pickedFriendKeys.size === 0"
              @click="rejectPickedFriends"
            >
              拒绝所选
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="busy || !requestRows.length"
              @click="approveAllFriends"
            >
              全部同意
            </button>
          </div>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="reqsBusy"
          class="muted"
        >
          <template v-if="listsBusy">正在加载好友/群列表，随后拉取审批数据…</template>
          <template v-else>正在拉取好友申请、可疑请求与入群审批；也可点击标题旁刷新图标重试。</template>
        </div>
        <div
          v-else-if="!selfIdStr.trim()"
          class="muted"
        >
          请选择 Bot 后查看与处理本账号的好友申请。
        </div>
        <div
          v-else-if="!requestRows.length"
          class="muted"
        >
          暂无待处理申请。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th style="width: 44px">
                  <input
                    type="checkbox"
                    title="全选当前筛选下的全部好友申请"
                    :checked="allFriendsPicked"
                    :indeterminate.prop="someFriendsPicked"
                    :disabled="!requestRows.length || busy"
                    @click.prevent="togglePickAllFriends()"
                  >
                </th>
                <th>用户 QQ</th>
                <th>用户昵称</th>
                <th>来源</th>
                <th style="min-width: 108px; width: 1%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in pagedRequestRows"
                :key="friendReqKey(row)"
              >
                <td>
                  <input
                    type="checkbox"
                    :checked="pickedFriendKeys.has(friendReqKey(row))"
                    :disabled="busy"
                    @click.prevent="togglePickFriend(friendReqKey(row))"
                  >
                </td>
                <td>{{ row.user_id }}</td>
                <td>{{ displayFriendReqNickname(row) }}</td>
                <td>{{ friendSourceLabel(row.source) }}</td>
                <td>
                  <div class="friends-req-actions">
                    <button
                      type="button"
                      class="btn btn--primary"
                      :disabled="busy"
                      @click="actFriend(row.self_id, row.user_id, 'approve', row.source)"
                    >
                      同意
                    </button>
                    <button
                      type="button"
                      class="btn btn--danger"
                      :disabled="busy"
                      @click="actFriend(row.self_id, row.user_id, 'reject', row.source)"
                    >
                      拒绝
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="requestRows.length > 0"
          v-model:page="pageFriendReq"
          v-model:page-size="tablePageSize"
          :total="requestRows.length"
        />
      </div>
    </div>

    <div
      id="friends-groups-group-requests"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>入群请求
          <RefreshIconButton
            :busy="reqsBusy"
            :disabled="reqsBusy || busy || !selfIdStr.trim()"
            label="刷新审批数据"
            @click="loadRequestsOnly"
          />
        </h2>
        <div
          class="row-actions"
          style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap"
        >
          <PanelSidebarAdd pin-id="friends-groups-group-req" />
          <span
            v-if="reqsBusy"
            class="muted"
            style="font-size: 12px"
          >审批数据加载中…</span>
          <span
            v-if="groupRequestRows.length"
            class="badge badge--warn"
          >{{ groupRequestRows.length }} 条</span>
          <div class="friends-groups-req-hd-bulk-btns">
            <button
              type="button"
              class="btn btn--primary"
              :disabled="busy || pickedGroupKeys.size === 0"
              @click="approvePickedGroups"
            >
              同意所选
            </button>
            <button
              type="button"
              class="btn"
              :disabled="busy || pickedGroupKeys.size === 0"
              @click="rejectPickedGroups"
            >
              拒绝所选
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="busy || !groupRequestRows.length"
              @click="approveAllGroups"
            >
              全部同意
            </button>
          </div>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="reqsBusy"
          class="muted"
        >
          正在拉取入群审批与概览，请稍候；也可点击标题旁刷新图标重试。
        </div>
        <div
          v-else-if="!selfIdStr.trim()"
          class="muted"
        >
          请选择 Bot 后查看与处理本账号的入群请求。
        </div>
        <div
          v-else-if="!groupRequestRows.length"
          class="muted"
        >
          暂无待处理入群请求。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th style="width: 44px">
                  <input
                    type="checkbox"
                    title="全选当前筛选下的全部入群请求"
                    :checked="allGroupsPicked"
                    :indeterminate.prop="someGroupsPicked"
                    :disabled="!groupRequestRows.length || busy"
                    @click.prevent="togglePickAllGroups()"
                  >
                </th>
                <th>群号</th>
                <th>用户 QQ</th>
                <th>类型</th>
                <th>备注</th>
                <th style="min-width: 108px; width: 1%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in pagedGroupRequestRows"
                :key="groupReqKey(row)"
              >
                <td>
                  <input
                    type="checkbox"
                    :checked="pickedGroupKeys.has(groupReqKey(row))"
                    :disabled="busy"
                    @click.prevent="togglePickGroup(groupReqKey(row))"
                  >
                </td>
                <td>{{ row.group_id }}</td>
                <td>{{ row.user_id }}</td>
                <td class="muted">{{ groupRequestSubTypeLabel(row.sub_type) }}</td>
                <td class="muted">{{ row.comment }}</td>
                <td>
                  <div class="friends-req-actions">
                    <button
                      type="button"
                      class="btn btn--primary"
                      :disabled="busy"
                      @click="actGroup(row.self_id, row.user_id, row.group_id, 'approve')"
                    >
                      同意
                    </button>
                    <button
                      type="button"
                      class="btn btn--danger"
                      :disabled="busy"
                      @click="actGroup(row.self_id, row.user_id, row.group_id, 'reject')"
                    >
                      拒绝
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="groupRequestRows.length > 0"
          v-model:page="pageGroupReq"
          v-model:page-size="tablePageSize"
          :total="groupRequestRows.length"
        />
      </div>
    </div>
    </div>
  </div>
</template>
