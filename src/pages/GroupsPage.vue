<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { fetchBots, fetchGroupList, fetchRequestOverview, postRequestAction } from "@/api/consoleApi";
import type { BotRow, GroupListData, RequestOverviewData } from "@/api/pallasTypes";

const err = ref("");
const busy = ref(false);
const bots = ref<BotRow[]>([]);
const selfIdStr = ref("");
const groups = ref<GroupListData | null>(null);
const overview = ref<RequestOverviewData | null>(null);

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
    const [gl, ov] = await Promise.all([fetchGroupList(sid), fetchRequestOverview()]);
    groups.value = gl;
    overview.value = ov;
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

async function act(targetSelf: string, userId: number, groupId: number, action: "approve" | "reject") {
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
      <h1 class="page-hero__title">群</h1>
      <p class="page-hero__desc">实时拉取群列表，并在下方处理入群请求（与好友页共用同一套后端动作接口）。</p>
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
                v-for="(row, i) in groupRequestRows"
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
                      @click="act(row.self_id, row.user_id, row.group_id, 'approve')"
                    >
                      同意
                    </button>
                    <button
                      type="button"
                      class="btn btn--danger"
                      :disabled="busy"
                      @click="act(row.self_id, row.user_id, row.group_id, 'reject')"
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
                v-for="g in groups?.groups ?? []"
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
      </div>
    </div>
  </div>
</template>
