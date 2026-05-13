<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchBots, fetchFriendList, fetchFriendRequests, postRequestAction } from "@/api/consoleApi";
import type { BotRow, FriendListData, FriendOverviewData } from "@/api/pallasTypes";

const err = ref("");
const busy = ref(false);
const bots = ref<BotRow[]>([]);
const selfIdStr = ref("");
const friends = ref<FriendListData | null>(null);
const requests = ref<FriendOverviewData | null>(null);

function selfIdNum(): number | null {
  const n = parseInt(selfIdStr.value, 10);
  return Number.isFinite(n) ? n : null;
}

async function loadBots() {
  try {
    bots.value = await fetchBots();
    if (!selfIdStr.value && bots.value.length) {
      selfIdStr.value = bots.value[0].self_id;
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
    const [fl, fr] = await Promise.all([fetchFriendList(sid), fetchFriendRequests()]);
    friends.value = fl;
    requests.value = fr;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

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
    flag: string;
  }> = [];
  const data = requests.value?.bots ?? [];
  for (const b of data) {
    for (const p of b.pending_friend_requests ?? []) {
      out.push({ self_id: b.self_id, source: "pending", user_id: p.user_id, flag: p.flag });
    }
    for (const d of b.doubt_friend_requests ?? []) {
      out.push({ self_id: b.self_id, source: "doubt", user_id: d.user_id, flag: d.flag });
    }
  }
  return out.filter((r) => !selfIdStr.value || r.self_id === selfIdStr.value);
});

async function act(
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
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Social</p>
      <h1 class="page-hero__title">好友</h1>
      <p class="page-hero__desc">按账号查看好友与申请，审批与处置走后端统一接口。</p>
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
            style="min-width: 220px"
          >
            <option
              v-for="b in bots"
              :key="b.self_id"
              :value="b.self_id"
            >
              {{ b.self_id }} · {{ b.adapter }}
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
                <th>用户</th>
                <th>flag</th>
                <th style="width: 200px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in requestRows"
                :key="i"
              >
                <td>{{ row.self_id }}</td>
                <td>{{ row.source }}</td>
                <td>{{ row.user_id }}</td>
                <td class="muted">{{ row.flag }}</td>
                <td>
                  <div class="row-actions">
                    <button
                      type="button"
                      class="btn btn--primary"
                      :disabled="busy"
                      @click="act(row.self_id, row.user_id, 'approve', row.source)"
                    >
                      同意
                    </button>
                    <button
                      type="button"
                      class="btn btn--danger"
                      :disabled="busy"
                      @click="act(row.self_id, row.user_id, 'reject', row.source)"
                    >
                      拒绝
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
                v-for="f in friends?.friends ?? []"
                :key="f.user_id"
              >
                <td>{{ f.user_id }}</td>
                <td>{{ f.nickname }}</td>
                <td class="muted">{{ f.remark }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
