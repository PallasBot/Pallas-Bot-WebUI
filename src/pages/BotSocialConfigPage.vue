<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  fetchBots,
  fetchGroupConfigById,
  fetchGroupConfigs,
  fetchUserConfigById,
  putGroupConfig,
  putUserConfig,
} from "@/api/consoleApi";
import type { BotRow, GroupConfigPublic, UserConfigPublic } from "@/api/pallasTypes";

const err = ref("");
const ok = ref("");
const busy = ref(false);

const bots = ref<BotRow[]>([]);
const filterSelfId = ref("");

const groupList = ref<GroupConfigPublic[]>([]);
const groupIdInput = ref("");
const groupCfg = ref<GroupConfigPublic | null>(null);
const groupRoulette = ref(0);
const groupBanned = ref(false);
const groupPluginsText = ref("");

const userIdInput = ref("");
const userCfg = ref<UserConfigPublic | null>(null);
const userBanned = ref(false);

function parsePlugins(raw: string): string[] {
  return raw
    .split(/[\n,，]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatPlugins(list: string[]): string {
  return list.join("\n");
}

async function loadBots() {
  try {
    bots.value = await fetchBots();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadGroupList() {
  err.value = "";
  ok.value = "";
  busy.value = true;
  try {
    const sid = filterSelfId.value ? parseInt(filterSelfId.value, 10) : undefined;
    const sidArg = sid != null && Number.isFinite(sid) ? sid : undefined;
    groupList.value = await fetchGroupConfigs(500, sidArg);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    groupList.value = [];
  } finally {
    busy.value = false;
  }
}

function applyGroupToForm(g: GroupConfigPublic) {
  groupCfg.value = g;
  groupRoulette.value = g.roulette_mode;
  groupBanned.value = g.banned;
  groupPluginsText.value = formatPlugins(g.disabled_plugins ?? []);
}

async function loadGroupById(raw?: string) {
  const idStr = raw ?? groupIdInput.value;
  const gid = parseInt(idStr.trim(), 10);
  if (!Number.isFinite(gid) || gid < 1) {
    err.value = "请输入有效群号。";
    return;
  }
  err.value = "";
  ok.value = "";
  busy.value = true;
  try {
    const g = await fetchGroupConfigById(gid);
    groupIdInput.value = String(g.group_id);
    applyGroupToForm(g);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    groupCfg.value = null;
  } finally {
    busy.value = false;
  }
}

function editGroupRow(g: GroupConfigPublic) {
  groupIdInput.value = String(g.group_id);
  void loadGroupById(String(g.group_id));
}

async function saveGroup() {
  if (!groupCfg.value) return;
  err.value = "";
  ok.value = "";
  busy.value = true;
  try {
    const g = await putGroupConfig(groupCfg.value.group_id, {
      roulette_mode: groupRoulette.value,
      banned: groupBanned.value,
      disabled_plugins: parsePlugins(groupPluginsText.value),
    });
    applyGroupToForm(g);
    ok.value = "群配置已保存。";
    await loadGroupList();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

async function loadUser() {
  const uid = parseInt(userIdInput.value.trim(), 10);
  if (!Number.isFinite(uid) || uid < 1) {
    err.value = "请输入有效用户 QQ。";
    return;
  }
  err.value = "";
  ok.value = "";
  busy.value = true;
  try {
    const u = await fetchUserConfigById(uid);
    userCfg.value = u;
    userBanned.value = u.banned;
    ok.value = "";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    userCfg.value = null;
  } finally {
    busy.value = false;
  }
}

async function saveUser() {
  if (!userCfg.value) return;
  err.value = "";
  ok.value = "";
  busy.value = true;
  try {
    const u = await putUserConfig(userCfg.value.user_id, { banned: userBanned.value });
    userCfg.value = u;
    userBanned.value = u.banned;
    ok.value = "用户配置已保存。";
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  await loadBots();
  await loadGroupList();
});
</script>

<template>
  <div>
    <header class="page-hero">
      <p class="page-hero__eyebrow">Bot policy</p>
      <h1 class="page-hero__title">好友与群颗粒配置</h1>
      <p class="page-hero__desc">
        按群号或用户 QQ 读写数据库中的独立配置（<code>group_config</code> / <code>user_config</code>），与账号级 Bot 配置不同。
      </p>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="ok"
      class="alert alert--ok"
    >
      {{ ok }}
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">群配置</h2>
        <div class="row-actions">
          <select
            v-model="filterSelfId"
            class="sel"
            style="min-width: 200px"
          >
            <option value="">全部账号</option>
            <option
              v-for="b in bots"
              :key="b.self_id"
              :value="b.self_id"
            >
              {{ b.self_id }}
            </option>
          </select>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            @click="loadGroupList"
          >
            刷新列表
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">
          下列为数据库中已有记录的群配置；也可直接输入群号加载（若不存在，保存时由后端按策略创建或报错）。
        </p>
        <div
          class="row-actions"
          style="margin-bottom: 16px"
        >
          <input
            v-model="groupIdInput"
            class="inp"
            type="text"
            inputmode="numeric"
            placeholder="群号"
            style="max-width: 200px"
            @keyup.enter="loadGroupById()"
          >
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            @click="loadGroupById()"
          >
            加载该群
          </button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>群号</th>
                <th>禁言/封禁</th>
                <th>轮盘模式</th>
                <th>禁用插件数</th>
                <th style="width: 100px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="g in groupList"
                :key="g.group_id"
              >
                <td style="font-weight: 600">{{ g.group_id }}</td>
                <td>{{ g.banned ? "是" : "否" }}</td>
                <td>{{ g.roulette_mode }}</td>
                <td class="muted">{{ g.disabled_plugins?.length ?? 0 }}</td>
                <td>
                  <button
                    type="button"
                    class="btn"
                    :disabled="busy"
                    @click="editGroupRow(g)"
                  >
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-if="groupCfg"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">编辑群 {{ groupCfg.group_id }}</h2>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="busy"
          @click="saveGroup"
        >
          保存
        </button>
      </div>
      <div class="panel__bd">
        <div style="margin-bottom: 14px">
          <label class="muted" style="display: block; margin-bottom: 6px">轮盘模式 roulette_mode</label>
          <input
            v-model.number="groupRoulette"
            class="inp"
            type="number"
            style="max-width: 160px"
          >
        </div>
        <div style="margin-bottom: 14px">
          <label class="muted" style="display: flex; align-items: center; gap: 8px; cursor: pointer">
            <input
              v-model="groupBanned"
              type="checkbox"
            >
            banned（封禁/禁用群侧能力，以后端语义为准）
          </label>
        </div>
        <div style="margin-bottom: 14px">
          <label class="muted" style="display: block; margin-bottom: 6px">disabled_plugins（每行一个或英文逗号分隔）</label>
          <textarea
            v-model="groupPluginsText"
            class="textarea"
            rows="6"
            placeholder="例如：&#10;plugin_a&#10;plugin_b"
          />
        </div>
        <div>
          <div class="muted" style="margin-bottom: 6px">sing_progress（只读）</div>
          <pre class="pre-block">{{ JSON.stringify(groupCfg.sing_progress, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">好友（用户）配置</h2>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">当前 API 仅暴露用户级 <code>banned</code> 字段。</p>
        <div class="row-actions" style="margin-bottom: 16px">
          <input
            v-model="userIdInput"
            class="inp"
            type="text"
            inputmode="numeric"
            placeholder="用户 QQ"
            style="max-width: 200px"
            @keyup.enter="loadUser"
          >
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            @click="loadUser"
          >
            加载
          </button>
        </div>
        <template v-if="userCfg">
          <div style="margin-bottom: 12px">
            <span class="muted">user_id：</span>
            <strong style="color: var(--text)">{{ userCfg.user_id }}</strong>
          </div>
          <label class="muted" style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 14px">
            <input
              v-model="userBanned"
              type="checkbox"
            >
            banned
          </label>
          <button
            type="button"
            class="btn btn--primary"
            :disabled="busy"
            @click="saveUser"
          >
            保存用户配置
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
