<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  fetchBots,
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
import { visibleBots } from "@/utils/botDisplay";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { slicePage } from "@/utils/paginate";

const err = ref("");
const busy = ref(false);
const bots = ref<BotRow[]>([]);
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
  if (nick) return `${nick}（${b.self_id}）· ${b.adapter}`;
  return `${b.self_id} · ${b.adapter}`;
}

const botsVisible = computed(() => visibleBots(bots.value));

function friendRequestNickname(userId: number): string {
  const sid = selfIdStr.value;
  if (!friends.value || friends.value.self_id !== sid) return `QQ ${userId}`;
  const hit = friends.value.friends?.find((f) => f.user_id === userId);
  return hit?.nickname?.trim() || `QQ ${userId}`;
}

function selfIdNum(): number | null {
  const n = parseInt(selfIdStr.value, 10);
  return Number.isFinite(n) ? n : null;
}

async function loadBots() {
  try {
    const [b, inst] = await Promise.all([fetchBots(), fetchInstances()]);
    bots.value = b;
    instances.value = inst;
    if (!selfIdStr.value && botsVisible.value.length) {
      selfIdStr.value = botsVisible.value[0]!.self_id;
    }
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadData() {
  const sid = selfIdNum();
  if (sid == null) return;
  busy.value = true;
  err.value = "";
  try {
    const [fl, fr, gl, ov] = await Promise.all([
      fetchFriendList(sid),
      fetchFriendRequests(),
      fetchGroupList(sid),
      fetchRequestOverview(),
    ]);
    friends.value = fl;
    requests.value = fr;
    groups.value = gl;
    overview.value = ov;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

watch(botsVisible, (list) => {
  if (!list.length) return;
  if (!list.some((b) => b.self_id === selfIdStr.value)) {
    selfIdStr.value = list[0]!.self_id;
  }
});

watch(selfIdStr, () => {
  void loadData();
});

onMounted(async () => {
  await loadBots();
  await loadData();
});

const requestRows = computed(() => {
  const out: Array<{
    self_id: string;
    source: "pending" | "doubt";
    user_id: number;
  }> = [];
  const data = requests.value?.bots ?? [];
  for (const b of data) {
    for (const p of b.pending_friend_requests ?? []) {
      out.push({ self_id: b.self_id, source: "pending", user_id: p.user_id });
    }
    for (const d of b.doubt_friend_requests ?? []) {
      out.push({ self_id: b.self_id, source: "doubt", user_id: d.user_id });
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
    await loadData();
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
    await loadData();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Social</p>
      <h1 class="page-hero__title">好友与群</h1>
      <p class="page-hero__desc">
        在同一页切换账号，查看好友与群列表，并处理好友申请与入群请求；操作经后端统一鉴权与审计。
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>

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
            :disabled="busy || !selfIdStr"
            @click="loadData"
          >
            {{ busy ? "加载中…" : "刷新" }}
          </button>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">好友申请</h2>
        <span
          v-if="requestRows.length"
          class="badge badge--warn"
        >{{ requestRows.length }} 条</span>
      </div>
      <div class="panel__bd">
        <div
          v-if="!requestRows.length"
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
                <td>{{ friendRequestNickname(row.user_id) }}</td>
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
      <div class="panel__hd">
        <h2 class="panel__title">好友列表</h2>
        <span
          v-if="friends?.truncated"
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
      <div class="panel__hd">
        <h2 class="panel__title">入群请求</h2>
        <span
          v-if="groupRequestRows.length"
          class="badge badge--warn"
        >{{ groupRequestRows.length }} 条</span>
      </div>
      <div class="panel__bd">
        <div
          v-if="!groupRequestRows.length"
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

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">群列表</h2>
        <span
          v-if="groups?.truncated"
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
  </div>
</template>
