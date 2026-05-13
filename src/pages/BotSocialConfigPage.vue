<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  fetchBots,
  fetchGroupConfigById,
  fetchGroupConfigs,
  fetchInstances,
  fetchPlugins,
  fetchUserConfigById,
  putGroupConfig,
  putUserConfig,
} from "@/api/consoleApi";
import type { BotRow, GroupConfigPublic, InstancesData, PluginRow, UserConfigPublic } from "@/api/pallasTypes";
import { visibleBots } from "@/utils/botDisplay";
import { slicePage, totalPages } from "@/utils/paginate";
import { pluginPickListFromRows } from "@/utils/pluginDisplay";

const err = ref("");
const ok = ref("");
const busy = ref(false);

const bots = ref<BotRow[]>([]);
const instances = ref<InstancesData | null>(null);
const filterSelfId = ref("");

const GROUP_PAGE = 15;
const groupPage = ref(1);

const plugins = ref<PluginRow[]>([]);
const pluginLoadErr = ref("");

const groupList = ref<GroupConfigPublic[]>([]);
const groupIdInput = ref("");
const groupCfg = ref<GroupConfigPublic | null>(null);
const groupModalOpen = ref(false);
const groupDraft = ref<{
  roulette_mode: number;
  banned: boolean;
  disabled_plugins: string[];
} | null>(null);
const groupSaveBusy = ref(false);
const groupSaveErr = ref("");

const userIdInput = ref("");
const userCfg = ref<UserConfigPublic | null>(null);
const userModalOpen = ref(false);
const userDraft = ref<{ banned: boolean } | null>(null);
const userSaveBusy = ref(false);
const userSaveErr = ref("");

const pluginPickList = computed(() => pluginPickListFromRows(plugins.value));

const botsVisible = computed(() => visibleBots(bots.value));

function profileNick(selfId: string): string {
  return instances.value?.bot_profiles?.[selfId]?.nickname?.trim() || "";
}

function botFilterLabel(b: BotRow): string {
  const nick = profileNick(b.self_id);
  if (nick) return `${nick}（${b.self_id}）`;
  return b.self_id;
}

const pagedGroupList = computed(() => slicePage(groupList.value, groupPage.value, GROUP_PAGE));
const groupListMaxPage = computed(() => totalPages(groupList.value.length, GROUP_PAGE));

watch(groupList, () => {
  groupPage.value = 1;
});

watch(
  () => groupModalOpen.value || userModalOpen.value,
  (open) => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
  },
);

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});

async function loadBots() {
  try {
    const [b, inst] = await Promise.all([fetchBots(), fetchInstances()]);
    bots.value = b;
    instances.value = inst;
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

function syncGroupDraftFromConfig(g: GroupConfigPublic) {
  groupCfg.value = g;
  groupDraft.value = {
    roulette_mode: g.roulette_mode,
    banned: g.banned,
    disabled_plugins: [...(g.disabled_plugins ?? [])].sort((a, b) => a.localeCompare(b)),
  };
  groupSaveErr.value = "";
}

function cancelGroupModal() {
  groupModalOpen.value = false;
  groupDraft.value = null;
  groupCfg.value = null;
  groupSaveErr.value = "";
}

function boolSelectVal(v: boolean): string {
  return v ? "1" : "0";
}

function onGroupBannedSelect(raw: string) {
  if (!groupDraft.value) return;
  groupDraft.value.banned = raw === "1";
}

function toggleGroupPluginDisabled(name: string, checked: boolean) {
  if (!groupDraft.value) return;
  const set = new Set(groupDraft.value.disabled_plugins);
  if (checked) set.add(name);
  else set.delete(name);
  groupDraft.value.disabled_plugins = [...set].sort((a, b) => a.localeCompare(b));
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
    syncGroupDraftFromConfig(g);
    groupModalOpen.value = true;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    groupCfg.value = null;
    groupDraft.value = null;
  } finally {
    busy.value = false;
  }
}

async function openGroupEdit(g: GroupConfigPublic) {
  groupIdInput.value = String(g.group_id);
  await loadGroupById(String(g.group_id));
}

async function saveGroupModal() {
  if (!groupCfg.value || !groupDraft.value) return;
  groupSaveBusy.value = true;
  groupSaveErr.value = "";
  ok.value = "";
  try {
    const g = await putGroupConfig(groupCfg.value.group_id, {
      roulette_mode: groupDraft.value.roulette_mode,
      banned: groupDraft.value.banned,
      disabled_plugins: groupDraft.value.disabled_plugins,
    });
    syncGroupDraftFromConfig(g);
    ok.value = "群配置已保存。";
    await loadGroupList();
    cancelGroupModal();
  } catch (e) {
    groupSaveErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    groupSaveBusy.value = false;
  }
}

function cancelUserModal() {
  userModalOpen.value = false;
  userDraft.value = null;
  userCfg.value = null;
  userSaveErr.value = "";
}

function onUserBannedSelect(raw: string) {
  if (!userDraft.value) return;
  userDraft.value.banned = raw === "1";
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
    userDraft.value = { banned: u.banned };
    userSaveErr.value = "";
    userModalOpen.value = true;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
    userCfg.value = null;
    userDraft.value = null;
  } finally {
    busy.value = false;
  }
}

async function saveUserModal() {
  if (!userCfg.value || !userDraft.value) return;
  userSaveBusy.value = true;
  userSaveErr.value = "";
  ok.value = "";
  try {
    const u = await putUserConfig(userCfg.value.user_id, { banned: userDraft.value.banned });
    userCfg.value = u;
    userDraft.value = { banned: u.banned };
    ok.value = "用户配置已保存。";
    cancelUserModal();
  } catch (e) {
    userSaveErr.value = e instanceof Error ? e.message : String(e);
  } finally {
    userSaveBusy.value = false;
  }
}

onMounted(async () => {
  await loadBots();
  await loadGroupList();
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
    <header class="page-hero">
      <p class="page-hero__eyebrow">Bot policy</p>
      <h1 class="page-hero__title">好友与群颗粒配置</h1>
      <p class="page-hero__desc">
        按 QQ 或群号维护独立策略表，与账号级 Bot 配置分层；变更写入前请确认影响范围。
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
              v-for="b in botsVisible"
              :key="b.self_id"
              :value="b.self_id"
            >
              {{ botFilterLabel(b) }} · {{ b.adapter }}
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
        <p
          v-if="pluginLoadErr"
          class="muted"
          style="margin: 0 0 10px"
        >
          插件列表加载失败，群「禁用插件」弹窗勾选不可用：{{ pluginLoadErr }}
        </p>
        <p
          class="muted"
          style="margin: 0 0 12px"
        >
          下列为数据库中已有记录的群配置；也可直接输入群号加载（若不存在，保存时由后端按策略创建或报错）。编辑在弹窗中进行。
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
                v-for="g in pagedGroupList"
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
                    @click="openGroupEdit(g)"
                  >
                    编辑
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-if="groupList.length > GROUP_PAGE"
          class="console-pager"
        >
          <span class="muted">共 {{ groupList.length }} 条 · 第 {{ groupPage }} / {{ groupListMaxPage }} 页</span>
          <div class="row-actions">
            <button
              type="button"
              class="btn"
              :disabled="groupPage <= 1"
              @click="groupPage = Math.max(1, groupPage - 1)"
            >
              上一页
            </button>
            <button
              type="button"
              class="btn"
              :disabled="groupPage >= groupListMaxPage"
              @click="groupPage = Math.min(groupListMaxPage, groupPage + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">好友（用户）配置</h2>
      </div>
      <div class="panel__bd">
        <p
          class="muted"
          style="margin: 0 0 12px"
        >
          当前 API 仅暴露用户级 <code>banned</code> 字段。输入 QQ 并加载后在弹窗中编辑。
        </p>
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
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="groupModalOpen && groupCfg && groupDraft"
        class="console-modal"
        role="dialog"
        :aria-modal="true"
        aria-labelledby="group-policy-modal-title"
      >
        <div
          class="console-modal__backdrop"
          :aria-hidden="true"
          @click="cancelGroupModal"
        />
        <div
          class="console-modal__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                id="group-policy-modal-title"
                class="console-modal__title"
              >
                编辑群颗粒配置
              </h2>
              <p class="console-modal__subtitle">
                <span class="console-modal__subtitle-strong">群 {{ groupCfg.group_id }}</span>
                <span class="muted"> · roulette / banned / 禁用插件</span>
              </p>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="cancelGroupModal"
            >
              ×
            </button>
          </div>
          <div class="console-modal__bd">
            <div class="bot-config-edit bot-config-edit--modal">
              <p
                v-if="groupSaveErr"
                class="alert alert--err"
                style="margin-bottom: 12px"
              >
                {{ groupSaveErr }}
              </p>
              <div class="bot-config-edit__grid">
                <div class="bot-config-edit__field">
                  <label>轮盘模式</label>
                  <input
                    v-model.number="groupDraft.roulette_mode"
                    class="inp"
                    type="number"
                    style="width: 100%"
                  >
                </div>
                <div class="bot-config-edit__field">
                  <label>封禁（banned）</label>
                  <select
                    class="sel"
                    style="width: 100%"
                    :value="boolSelectVal(groupDraft.banned)"
                    @change="onGroupBannedSelect(($event.target as HTMLSelectElement).value)"
                  >
                    <option value="1">是</option>
                    <option value="0">否</option>
                  </select>
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
                    :key="`gpl-${groupCfg.group_id}-${p.name}`"
                  >
                    <input
                      type="checkbox"
                      :checked="groupDraft.disabled_plugins.includes(p.name)"
                      @change="
                        toggleGroupPluginDisabled(p.name, ($event.target as HTMLInputElement).checked)
                      "
                    >
                    <span>{{ p.label }}</span>
                  </label>
                </div>
              </div>
              <div class="bot-config-edit__field">
                <label>sing_progress（只读）</label>
                <pre class="pre-block" style="max-height: 200px; overflow: auto; margin: 0">{{
                  JSON.stringify(groupCfg.sing_progress, null, 2)
                }}</pre>
              </div>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="groupSaveBusy"
                  @click="saveGroupModal"
                >
                  {{ groupSaveBusy ? "保存中…" : "保存" }}
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="groupSaveBusy"
                  @click="cancelGroupModal"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="userModalOpen && userCfg && userDraft"
        class="console-modal"
        role="dialog"
        :aria-modal="true"
        aria-labelledby="user-policy-modal-title"
      >
        <div
          class="console-modal__backdrop"
          :aria-hidden="true"
          @click="cancelUserModal"
        />
        <div
          class="console-modal__dialog"
          @click.stop
        >
          <div class="console-modal__hd">
            <div class="console-modal__head-text">
              <h2
                id="user-policy-modal-title"
                class="console-modal__title"
              >
                编辑用户颗粒配置
              </h2>
              <p class="console-modal__subtitle">
                <span class="console-modal__subtitle-strong">QQ {{ userCfg.user_id }}</span>
                <span class="muted"> · banned</span>
              </p>
            </div>
            <button
              type="button"
              class="console-modal__close"
              aria-label="关闭"
              @click="cancelUserModal"
            >
              ×
            </button>
          </div>
          <div class="console-modal__bd">
            <div class="bot-config-edit bot-config-edit--modal">
              <p
                v-if="userSaveErr"
                class="alert alert--err"
                style="margin-bottom: 12px"
              >
                {{ userSaveErr }}
              </p>
              <div class="bot-config-edit__field">
                <label>封禁（banned）</label>
                <select
                  class="sel"
                  style="width: 100%"
                  :value="boolSelectVal(userDraft.banned)"
                  @change="onUserBannedSelect(($event.target as HTMLSelectElement).value)"
                >
                  <option value="1">是</option>
                  <option value="0">否</option>
                </select>
              </div>
              <div class="row-actions">
                <button
                  type="button"
                  class="btn btn--primary"
                  :disabled="userSaveBusy"
                  @click="saveUserModal"
                >
                  {{ userSaveBusy ? "保存中…" : "保存" }}
                </button>
                <button
                  type="button"
                  class="btn"
                  :disabled="userSaveBusy"
                  @click="cancelUserModal"
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
