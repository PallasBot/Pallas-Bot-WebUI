<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchFriendList,
  fetchFriendRequests,
  fetchGroupList,
  fetchInstances,
  fetchRequestOverview,
  postRequestAction,
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
import { accountHasNonebotBot } from "@/utils/botConnection";
import { botPickerRowsFromInstances } from "@/utils/botDisplay";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { slicePage } from "@/utils/paginate";

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
    if (!selfIdStr.value && botsVisible.value.length) {
      selfIdStr.value = botsVisible.value[0]!.self_id;
    }
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
    const [fr, ov] = await Promise.all([fetchFriendRequests(), fetchRequestOverview()]);
    requests.value = fr;
    overview.value = ov;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    reqsBusy.value = false;
  }
}

watch(botsVisible, (list) => {
  if (!list.length) return;
  if (!list.some((b) => b.self_id === selfIdStr.value)) {
    selfIdStr.value = list[0]!.self_id;
  }
});

async function refreshPage() {
  await loadBots();
  await loadListsOnly();
  void loadRequestsOnly();
}

watch(selfIdStr, () => {
  if (skipSelfIdWatch.value) return;
  reqsBusy.value = true;
  requests.value = null;
  overview.value = null;
  void loadListsOnly().finally(() => {
    void loadRequestsOnly();
  });
});

onMounted(async () => {
  try {
    await loadBots();
    await loadListsOnly();
    void loadRequestsOnly();
  } finally {
    pageReady.value = true;
    skipSelfIdWatch.value = false;
  }
});

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
  return out.filter((r) => !selfIdStr.value || r.self_id === selfIdStr.value);
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
  return out.filter((r) => !selfIdStr.value || r.self_id === selfIdStr.value);
});

const pagedRequestRows = computed(() => slicePage(requestRows.value, pageFriendReq.value, tablePageSize.value));

const pagedGroupRequestRows = computed(() => slicePage(groupRequestRows.value, pageGroupReq.value, tablePageSize.value));

const pagedFriends = computed(() => slicePage(friends.value?.friends ?? [], pageFriends.value, tablePageSize.value));

const pagedGroups = computed(() => slicePage(groups.value?.groups ?? [], pageGroups.value, tablePageSize.value));

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
    await Promise.all([loadListsOnly(), loadRequestsOnly()]);
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
    await Promise.all([loadListsOnly(), loadRequestsOnly()]);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
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
    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">当前账号</h2>
        <div class="row-actions">
          <select
            v-model="selfIdStr"
            class="sel"
            style="min-width: 280px"
          >
            <option
              v-for="b in botsVisible"
              :key="b.self_id"
              :value="b.self_id"
            >
              {{ botOptionLabel(b) }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy || listsBusy || reqsBusy || !selfIdStr"
            @click="refreshPage"
          >
            {{ busy || listsBusy || reqsBusy ? "加载中…" : "刷新" }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">好友列表</h2>
        <span
          v-if="listsBusy"
          class="muted"
          style="font-size: 12px"
        >列表加载中…</span>
        <span
          v-else-if="friends?.truncated"
          class="badge badge--warn"
        >已截断</span>
      </div>
      <div class="panel__bd">
        <p
          v-if="friends?.error"
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

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">群列表</h2>
        <span
          v-if="listsBusy"
          class="muted"
          style="font-size: 12px"
        >列表加载中…</span>
        <span
          v-else-if="groups?.truncated"
          class="badge badge--warn"
        >已截断 · limit {{ groups?.limit }}</span>
      </div>
      <div class="panel__bd">
        <p
          v-if="groups?.error"
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

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">好友申请</h2>
        <div class="row-actions">
          <span
            v-if="reqsBusy"
            class="muted"
            style="font-size: 12px"
          >审批数据加载中…</span>
          <span
            v-if="requestRows.length"
            class="badge badge--warn"
          >{{ requestRows.length }} 条</span>
          <button
            type="button"
            class="btn"
            :disabled="reqsBusy || busy || !selfIdStr"
            @click="loadRequestsOnly"
          >
            刷新审批
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="reqsBusy"
          class="muted"
        >
          正在拉取好友申请与可疑请求，请稍候；也可稍后点击「刷新审批」。
        </div>
        <div
          v-else-if="!requestRows.length"
          class="muted"
        >
          暂无待处理申请（或当前账号无数据）。
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>账号</th>
                <th>来源</th>
                <th>用户 QQ</th>
                <th>用户昵称</th>
                <th style="width: 200px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in pagedRequestRows"
                :key="i"
              >
                <td>{{ row.self_id }}</td>
                <td>{{ row.source }}</td>
                <td>{{ row.user_id }}</td>
                <td>{{ displayFriendReqNickname(row) }}</td>
                <td>
                  <div class="row-actions">
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

    <div class="panel">
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">入群请求</h2>
        <div class="row-actions">
          <span
            v-if="reqsBusy"
            class="muted"
            style="font-size: 12px"
          >审批数据加载中…</span>
          <span
            v-if="groupRequestRows.length"
            class="badge badge--warn"
          >{{ groupRequestRows.length }} 条</span>
          <button
            type="button"
            class="btn"
            :disabled="reqsBusy || busy || !selfIdStr"
            @click="loadRequestsOnly"
          >
            刷新审批
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="reqsBusy"
          class="muted"
        >
          正在拉取入群审批与概览，请稍候。
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
                <th>账号</th>
                <th>群号</th>
                <th>用户</th>
                <th>类型</th>
                <th>备注</th>
                <th style="width: 200px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in pagedGroupRequestRows"
                :key="i"
              >
                <td>{{ row.self_id }}</td>
                <td>{{ row.group_id }}</td>
                <td>{{ row.user_id }}</td>
                <td class="muted">{{ row.sub_type }}</td>
                <td class="muted">{{ row.comment }}</td>
                <td>
                  <div class="row-actions">
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
