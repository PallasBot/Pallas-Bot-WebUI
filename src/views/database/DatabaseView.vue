<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import {
  deleteDbTableRow,
  fetchBotConfigById,
  fetchDbTableRow,
  fetchDbOverview,
  fetchGroupConfigById,
  postMongoAggregate,
  putDbTableRow,
  putBotConfig,
  putGroupConfig,
  putUserConfig,
} from "@/api/consoleApi";
import { pallasConnectionKey } from "@/types/pallas-connection";
import type { BotConfigPublic, DbOverviewData, GroupConfigPublic } from "@/api/pallasTypes";
import { Histogram, Operation, Search } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { Component } from "vue";
import { computed, inject, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

type DbSection = "query" | "overview" | "pipeline";

const router = useRouter();
const conn = inject(pallasConnectionKey, null);
const section = ref<DbSection>("query");
const loading = ref(true);
const overview = ref<DbOverviewData | null>(null);

const sectionTitle: Record<DbSection, string> = {
  query: "生产查询与配置变更",
  overview: "容量与健康概览",
  pipeline: "受控聚合审计",
};
const sectionSub: Record<DbSection, string> = {
  query: "面向生产值守：支持按账号/群号读取配置，并通过受控字段写回，避免直接执行高风险语句。",
  overview: "展示当前后端及各表容量，便于判断异常膨胀、清理窗口和扩容节奏。",
  pipeline:
    "仅 MongoDB；阶段限制为 $match/$project/$sort/$limit/$skip，最多 16 段，强制截断 200 行，适用于审计和排障。",
};

const navItems = computed((): { index: DbSection; label: string; icon: Component }[] => {
  const base: { index: DbSection; label: string; icon: Component }[] = [
    { index: "query", label: "按条件查询", icon: Search },
    { index: "overview", label: "存储概览", icon: Histogram },
  ];
  if (overview.value?.backend === "mongodb") {
    base.push({ index: "pipeline", label: "Mongo 管道", icon: Operation });
  }
  return base;
});

const mongoCollection = ref("config");
const pipelineJson = ref(`[
  {"$limit": 10}
]`);
const pipelineBusy = ref(false);
const pipelineRows = ref<Record<string, unknown>[]>([]);
const pipelineCols = ref<string[]>([]);
const opSnippetKind = ref<"mongodb" | "postgres">("mongodb");
const selectedSnippetName = ref("");

const mongoOpSnippets = [
  {
    name: "按账号查询 Bot 配置",
    code: `db.getCollection("config").findOne({ account: 913934574 });`,
  },
  {
    name: "更新 Bot 配置（安全/自动同意/管理员）",
    code: `db.getCollection("config").updateOne(
  { account: 913934574 },
  {
    $set: {
      security: false,
      auto_accept_friend: true,
      auto_accept_group: true,
      admins: [3023094357, 2336313914]
    }
  },
  { upsert: false }
);`,
  },
  {
    name: "查询被封禁群",
    code: `db.getCollection("group_config")
  .find({ banned: true })
  .sort({ group_id: 1 })
  .limit(100)
  .toArray();`,
  },
  {
    name: "批量解封用户",
    code: `db.getCollection("user_config").updateMany(
  { banned: true, user_id: { $in: [3023094357, 123456789] } },
  { $set: { banned: false } }
);`,
  },
  {
    name: "聚合示例（可直接填入管道）",
    code: `[
  { "$match": { "banned": true } },
  { "$project": { "_id": 0, "group_id": 1, "roulette_mode": 1 } },
  { "$sort": { "group_id": 1 } },
  { "$limit": 50 }
]`,
    isPipeline: true,
  },
] as const;

const postgresOpSnippets = [
  {
    name: "按账号查询 Bot 配置",
    code: `SELECT account, security, auto_accept_friend, auto_accept_group, admins, disabled_plugins
FROM bot_config
WHERE account = 913934574;`,
  },
  {
    name: "更新群封禁状态",
    code: `UPDATE group_config
SET banned = true
WHERE group_id = 858278443;`,
  },
  {
    name: "查询被封禁用户",
    code: `SELECT user_id, banned
FROM user_config
WHERE banned = true
ORDER BY user_id
LIMIT 200;`,
  },
  {
    name: "统计各表记录数",
    code: `SELECT 'bot_config' AS table_name, COUNT(*) AS cnt FROM bot_config
UNION ALL
SELECT 'group_config', COUNT(*) FROM group_config
UNION ALL
SELECT 'user_config', COUNT(*) FROM user_config
ORDER BY table_name;`,
  },
] as const;

const currentOpSnippets = computed(() =>
  opSnippetKind.value === "mongodb" ? mongoOpSnippets : postgresOpSnippets,
);
const selectedSnippet = computed(
  () => currentOpSnippets.value.find((x) => x.name === selectedSnippetName.value) ?? currentOpSnippets.value[0],
);

const unknownBackendNote = computed(() => {
  const o = overview.value;
  if (!o || o.backend === "mongodb" || o.backend === "postgres") return "";
  return (o as { note?: string }).note || "本页暂无该后端的表结构展示。";
});

const qGroup = ref("");
const qBot = ref("");
const qLoading = ref(false);
const qResult = ref<{ type: "group" | "bot"; data: GroupConfigPublic | BotConfigPublic } | null>(null);
const qDialog = ref(false);
const queryHistory = ref<string[]>([]);
const opBusy = ref(false);
const opBotQq = ref("");
const opBotSecurity = ref(false);
const opBotAutoFriend = ref(false);
const opBotAutoGroup = ref(false);
const opGroupId = ref("");
const opGroupBanned = ref(false);
const opGroupRoulette = ref<0 | 1>(1);
const opUserId = ref("");
const opUserBanned = ref(false);
const tableEditName = ref<"config" | "group_config" | "user_config">("config");
const tableEditRowId = ref("");
const tableEditJson = ref("{\n  \n}");

const storageRows = computed(() => {
  if (!overview.value) return [] as { name: string; detail: string; count: number }[];
  if (overview.value.backend === "mongodb" && "collections" in overview.value) {
    return overview.value.collections.map((x) => ({
      name: x.name,
      detail: x.document,
      count: x.count,
    }));
  }
  if (overview.value.backend === "postgres" && "tables" in overview.value) {
    return overview.value.tables.map((x) => ({
      name: x.table,
      detail: "table",
      count: x.count,
    }));
  }
  return [] as { name: string; detail: string; count: number }[];
});
const backendDisplayName = computed(() => {
  const b = overview.value?.backend;
  if (b === "mongodb") return "MongoDB";
  if (b === "postgres") return "PostgreSQL";
  return b ? String(b) : "—";
});

function pushHistory(text: string) {
  const v = text.trim();
  if (!v) return;
  queryHistory.value = [v, ...queryHistory.value.filter((x) => x !== v)].slice(0, 12);
}

async function copySelectedSnippet() {
  const txt = selectedSnippet.value?.code || "";
  if (!txt) return;
  try {
    if (!navigator?.clipboard?.writeText) {
      throw new Error("clipboard unavailable");
    }
    await navigator.clipboard.writeText(txt);
    ElMessage.success("已复制到剪贴板");
  } catch {
    ElMessage.warning("复制失败，请手动复制下方内容");
  }
}

function useSnippetAsPipeline() {
  const sn = selectedSnippet.value;
  if (!sn || !("isPipeline" in sn) || !sn.isPipeline) {
    ElMessage.warning("当前模板不是聚合管道");
    return;
  }
  pipelineJson.value = sn.code;
  mongoCollection.value = "group_config";
  section.value = "pipeline";
  ElMessage.success("已填入管道编辑器");
}

async function load() {
  loading.value = true;
  try {
    overview.value = await fetchDbOverview();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
    overview.value = null;
  } finally {
    loading.value = false;
  }
}

async function queryGroup() {
  const raw = qGroup.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字群号");
    return;
  }
  qLoading.value = true;
  try {
    const gid = parseInt(raw, 10);
    const data = await fetchGroupConfigById(gid);
    qResult.value = { type: "group", data };
    pushHistory(`group:${gid}`);
    qDialog.value = true;
  } catch {
    ElMessage.error("未找到该群的配置（可能尚未产生过群级记录）");
    qResult.value = null;
  } finally {
    qLoading.value = false;
  }
}

async function queryBot() {
  const raw = qBot.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字 QQ 号");
    return;
  }
  qLoading.value = true;
  try {
    const acc = parseInt(raw, 10);
    const data = await fetchBotConfigById(acc);
    qResult.value = { type: "bot", data };
    pushHistory(`bot:${acc}`);
    qDialog.value = true;
  } catch {
    ElMessage.error("未找到该 Bot 的配置记录");
    qResult.value = null;
  } finally {
    qLoading.value = false;
  }
}

async function loadBotForOps() {
  const raw = opBotQq.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字 Bot QQ");
    return;
  }
  opBusy.value = true;
  try {
    const data = await fetchBotConfigById(parseInt(raw, 10));
    opBotSecurity.value = data.security;
    opBotAutoFriend.value = data.auto_accept_friend;
    opBotAutoGroup.value = data.auto_accept_group;
    ElMessage.success("已加载 Bot 当前配置");
  } catch {
    ElMessage.error("未找到该 Bot 配置记录");
  } finally {
    opBusy.value = false;
  }
}

async function saveBotOps() {
  const raw = opBotQq.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字 Bot QQ");
    return;
  }
  opBusy.value = true;
  try {
    await putBotConfig(parseInt(raw, 10), {
      security: opBotSecurity.value,
      auto_accept_friend: opBotAutoFriend.value,
      auto_accept_group: opBotAutoGroup.value,
    });
    ElMessage.success("Bot 配置已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "Bot 配置保存失败");
  } finally {
    opBusy.value = false;
  }
}

async function loadGroupForOps() {
  const raw = opGroupId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字群号");
    return;
  }
  opBusy.value = true;
  try {
    const data = await fetchGroupConfigById(parseInt(raw, 10));
    opGroupBanned.value = data.banned;
    opGroupRoulette.value = data.roulette_mode === 1 ? 1 : 0;
    ElMessage.success("已加载群当前配置");
  } catch {
    ElMessage.error("未找到该群配置记录");
  } finally {
    opBusy.value = false;
  }
}

async function saveGroupOps() {
  const raw = opGroupId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字群号");
    return;
  }
  opBusy.value = true;
  try {
    await putGroupConfig(parseInt(raw, 10), {
      banned: opGroupBanned.value,
      roulette_mode: opGroupRoulette.value,
    });
    ElMessage.success("群配置已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "群配置保存失败");
  } finally {
    opBusy.value = false;
  }
}

async function saveUserOps() {
  const raw = opUserId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字用户 QQ");
    return;
  }
  opBusy.value = true;
  try {
    await putUserConfig(parseInt(raw, 10), {
      banned: opUserBanned.value,
    });
    ElMessage.success("用户配置已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "用户配置保存失败");
  } finally {
    opBusy.value = false;
  }
}

async function loadTableRowForOps() {
  const raw = tableEditRowId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字主键");
    return;
  }
  opBusy.value = true;
  try {
    const row = await fetchDbTableRow({
      table: tableEditName.value,
      row_id: parseInt(raw, 10),
    });
    tableEditJson.value = JSON.stringify(row, null, 2);
    ElMessage.success("已读取表行");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "读取失败");
  } finally {
    opBusy.value = false;
  }
}

async function saveTableRowForOps() {
  const raw = tableEditRowId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字主键");
    return;
  }
  let parsed: Record<string, unknown>;
  try {
    const obj = JSON.parse(tableEditJson.value) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("JSON 必须是对象");
    }
    parsed = obj as Record<string, unknown>;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "JSON 格式错误");
    return;
  }
  opBusy.value = true;
  try {
    const row = await putDbTableRow({
      table: tableEditName.value,
      row_id: parseInt(raw, 10),
      data: parsed,
    });
    tableEditJson.value = JSON.stringify(row, null, 2);
    ElMessage.success("表行已保存");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    opBusy.value = false;
  }
}

async function deleteTableRowForOps() {
  const raw = tableEditRowId.value.trim();
  if (!/^\d+$/.test(raw)) {
    ElMessage.warning("请输入纯数字主键");
    return;
  }
  opBusy.value = true;
  try {
    await deleteDbTableRow({
      table: tableEditName.value,
      row_id: parseInt(raw, 10),
    });
    ElMessage.success("表行已删除");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  } finally {
    opBusy.value = false;
  }
}

function goEditInInstances() {
  qDialog.value = false;
  if (qResult.value?.type === "group") {
    router.push({
      name: "instances",
      query: { tab: "group", gid: String((qResult.value.data as GroupConfigPublic).group_id) },
    });
  } else if (qResult.value?.type === "bot") {
    router.push({ name: "accounts" });
  }
}

onMounted(() => {
  void load();
});

watch(
  () => conn?.healthTick.value,
  () => {
    if (conn?.ok.value && !loading.value && !overview.value) {
      void load();
    }
  },
);

watch(
  () => conn?.ok.value,
  (v) => {
    if (v !== true) return;
    const run = () => {
      if (!overview.value) {
        void load();
      }
    };
    if (loading.value) {
      window.setTimeout(run, 80);
    } else {
      run();
    }
  },
  { immediate: true },
);

watch(overview, (o) => {
  if (section.value === "pipeline" && o && o.backend !== "mongodb") {
    section.value = "overview";
  }
});

watch(
  currentOpSnippets,
  (list) => {
    if (!list.length) {
      selectedSnippetName.value = "";
      return;
    }
    if (!list.some((x) => x.name === selectedSnippetName.value)) {
      selectedSnippetName.value = list[0]!.name;
    }
  },
  { immediate: true },
);

async function runPipeline() {
  let pipeline: unknown[];
  try {
    pipeline = JSON.parse(pipelineJson.value) as unknown[];
    if (!Array.isArray(pipeline)) {
      throw new Error("pipeline 须为 JSON 数组");
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "JSON 解析失败");
    return;
  }
  pipelineBusy.value = true;
  pipelineRows.value = [];
  pipelineCols.value = [];
  try {
    const { rows } = await postMongoAggregate({
      collection: mongoCollection.value.trim(),
      pipeline,
    });
    pushHistory(`agg:${mongoCollection.value.trim()}`);
    pipelineRows.value = rows;
    const keys = new Set<string>();
    for (const r of rows) {
      Object.keys(r).forEach((k) => keys.add(k));
    }
    pipelineCols.value = [...keys].sort();
    ElMessage.success(`已返回 ${rows.length} 行`);
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "执行失败");
  } finally {
    pipelineBusy.value = false;
  }
}
</script>

<template>
  <div class="view-page database-page">
    <PallasSidebarShell
    v-model="section"
    aside-title="数据库管理"
    menu-aria-label="数据库管理分节"
    :nav-items="navItems"
  >
    <template #header="{ section: s }">
      <h1 class="main-title">{{ sectionTitle[s as DbSection] }}</h1>
      <p class="main-sub">{{ sectionSub[s as DbSection] }}</p>
    </template>

    <div
      v-show="section === 'query'"
      class="panel"
    >
      <el-card
        class="c"
        shadow="hover"
      >
        <el-alert
          :closable="false"
          type="info"
          class="db-banner"
          show-icon
          title="生产建议"
        >
          先读后改：先用“按条件查询”确认目标记录，再使用“面板直接操作”或“表行 JSON”最小化变更。涉及批量动作建议在低峰执行并保留回滚记录。
        </el-alert>
        <div class="q-layout">
          <aside class="q-left">
            <div class="q-left-hd">数据表 / 集合</div>
            <div class="q-left-list">
              <button
                v-for="item in storageRows"
                :key="item.name"
                type="button"
                class="q-left-item"
                @click="mongoCollection = item.name"
              >
                <div class="q-left-name">{{ item.name }}</div>
                <div class="q-left-sub">{{ item.detail }} · {{ item.count }}</div>
              </button>
            </div>
          </aside>
          <div class="q-right">
            <div class="q-grid">
              <div class="q-item">
                <div class="q-lab">按群号查「群配置」</div>
                <el-input
                  v-model="qGroup"
                  class="q-inp"
                  clearable
                  placeholder="输入群号，例如 123456789"
                  @keyup.enter="queryGroup"
                />
                <el-button
                  type="primary"
                  :loading="qLoading"
                  @click="queryGroup"
                >查询</el-button>
              </div>
              <div class="q-item">
                <div class="q-lab">按 QQ 查「Bot 账号配置」</div>
                <el-input
                  v-model="qBot"
                  class="q-inp"
                  clearable
                  placeholder="输入 Bot QQ 号"
                  @keyup.enter="queryBot"
                />
                <el-button
                  type="primary"
                  :loading="qLoading"
                  @click="queryBot"
                >查询</el-button>
              </div>
            </div>
            <div class="q-his">
              <span class="q-his-lab">历史记录</span>
              <el-tag
                v-for="h in queryHistory"
                :key="h"
                size="small"
                class="q-his-tag"
              >{{ h }}</el-tag>
              <span v-if="!queryHistory.length" class="q-his-empty">暂无</span>
            </div>
            <el-divider />
            <div class="ops-direct">
              <div class="ops-direct-hd">面板直接操作</div>
              <div class="ops-direct-grid">
                <div class="ops-card">
                  <div class="ops-card-t">Bot 配置</div>
                  <el-input
                    v-model="opBotQq"
                    placeholder="Bot QQ"
                    class="ops-inp"
                  />
                  <el-space wrap>
                    <el-switch v-model="opBotSecurity" active-text="安全模式" inactive-text="安全模式" />
                    <el-switch v-model="opBotAutoFriend" active-text="自动同意好友" inactive-text="自动同意好友" />
                    <el-switch v-model="opBotAutoGroup" active-text="自动同意入群" inactive-text="自动同意入群" />
                  </el-space>
                  <el-space>
                    <el-button size="small" :loading="opBusy" @click="loadBotForOps">读取</el-button>
                    <el-button type="primary" size="small" :loading="opBusy" @click="saveBotOps">保存</el-button>
                  </el-space>
                </div>
                <div class="ops-card">
                  <div class="ops-card-t">群配置</div>
                  <el-input
                    v-model="opGroupId"
                    placeholder="群号"
                    class="ops-inp"
                  />
                  <el-space wrap>
                    <el-switch v-model="opGroupBanned" active-text="群封禁" inactive-text="群封禁" />
                    <el-switch
                      v-model="opGroupRoulette"
                      :active-value="1"
                      :inactive-value="0"
                      active-text="轮盘:禁言"
                      inactive-text="轮盘:踢人"
                    />
                  </el-space>
                  <el-space>
                    <el-button size="small" :loading="opBusy" @click="loadGroupForOps">读取</el-button>
                    <el-button type="primary" size="small" :loading="opBusy" @click="saveGroupOps">保存</el-button>
                  </el-space>
                </div>
                <div class="ops-card">
                  <div class="ops-card-t">用户配置</div>
                  <el-input
                    v-model="opUserId"
                    placeholder="用户 QQ"
                    class="ops-inp"
                  />
                  <el-space wrap>
                    <el-switch v-model="opUserBanned" active-text="用户封禁" inactive-text="用户封禁" />
                  </el-space>
                  <el-space>
                    <el-button type="primary" size="small" :loading="opBusy" @click="saveUserOps">保存</el-button>
                  </el-space>
                </div>
                <div class="ops-card ops-card-wide">
                  <div class="ops-card-t">直接操作表行（JSON）</div>
                  <el-space wrap>
                    <el-select v-model="tableEditName" class="ops-sel-mini">
                      <el-option label="config (bot_config)" value="config" />
                      <el-option label="group_config" value="group_config" />
                      <el-option label="user_config" value="user_config" />
                    </el-select>
                    <el-input v-model="tableEditRowId" class="ops-id-inp" placeholder="主键 ID（账号/群号/用户号）" />
                  </el-space>
                  <el-input
                    v-model="tableEditJson"
                    type="textarea"
                    :rows="8"
                    spellcheck="false"
                    class="ops-json-inp"
                    placeholder='{"banned": true}'
                  />
                  <el-space>
                    <el-button size="small" :loading="opBusy" @click="loadTableRowForOps">读取</el-button>
                    <el-button type="primary" size="small" :loading="opBusy" @click="saveTableRowForOps">保存</el-button>
                    <el-button type="danger" size="small" :loading="opBusy" @click="deleteTableRowForOps">删除该行</el-button>
                  </el-space>
                </div>
              </div>
            </div>
            <el-divider />
            <div class="ops-box">
              <div class="ops-hd">
                <span>数据库常用函数</span>
                <el-radio-group v-model="opSnippetKind" size="small">
                  <el-radio-button label="mongodb">MongoDB</el-radio-button>
                  <el-radio-button label="postgres">PostgreSQL</el-radio-button>
                </el-radio-group>
              </div>
              <div class="ops-row">
                <el-select
                  v-model="selectedSnippetName"
                  class="ops-sel"
                  filterable
                >
                  <el-option
                    v-for="s in currentOpSnippets"
                    :key="s.name"
                    :label="s.name"
                    :value="s.name"
                  />
                </el-select>
                <el-button @click="copySelectedSnippet">复制</el-button>
                <el-button
                  v-if="opSnippetKind === 'mongodb'"
                  type="primary"
                  plain
                  @click="useSnippetAsPipeline"
                >填入管道</el-button>
              </div>
              <pre class="ops-code">{{ selectedSnippet?.code || "" }}</pre>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <div
      v-show="section === 'overview'"
      class="panel"
    >
      <el-card
        class="c"
        shadow="hover"
      >
        <div
          v-loading="loading"
          class="box"
        >
          <template v-if="overview && overview.backend === 'mongodb' && 'collections' in overview">
            <div class="db-type-line">
              <span class="db-type-label">当前数据库类型</span>
              <strong class="db-type-name">{{ backendDisplayName }}</strong>
            </div>
            <div class="ov-list">
              <div v-for="row in storageRows" :key="row.name" class="ov-item">
                <div class="ov-main">
                  <strong>{{ row.name }}</strong>
                  <span class="ov-sub">{{ row.detail }}</span>
                </div>
                <el-tag type="info" size="small">{{ row.count }}</el-tag>
              </div>
            </div>
          </template>
          <template
            v-else-if="overview && overview.backend === 'postgres' && 'tables' in overview"
          >
            <div class="db-type-line">
              <span class="db-type-label">当前数据库类型</span>
              <strong class="db-type-name">{{ backendDisplayName }}</strong>
            </div>
            <div class="ov-list">
              <div v-for="row in storageRows" :key="row.name" class="ov-item">
                <div class="ov-main">
                  <strong>{{ row.name }}</strong>
                  <span class="ov-sub">{{ row.detail }}</span>
                </div>
                <el-tag type="info" size="small">{{ row.count }}</el-tag>
              </div>
            </div>
          </template>
          <el-alert
            v-else-if="overview"
            :closable="false"
            type="warning"
            :title="`当前后端: ${overview.backend}`"
          >
            {{ unknownBackendNote }}
          </el-alert>
          <el-empty
            v-else-if="!loading"
            description="暂无数据"
          />
          <div class="ft">
            <el-button
              type="primary"
              plain
              :loading="loading"
              @click="load"
            >
              刷新概览
            </el-button>
          </div>
        </div>
      </el-card>
    </div>

    <div
      v-show="section === 'pipeline'"
      class="panel"
    >
      <el-card
        class="c"
        shadow="hover"
      >
        <el-alert
          :closable="false"
          type="warning"
          class="pipe-al"
          show-icon
          title="安全说明"
        >
          后端拒绝 $lookup/$out 等阶段；未配置或未携带写 Token 时接口返回 403/401。请勿在生产对公网裸奔开启。
        </el-alert>
        <div class="pipe-row">
          <span class="pipe-lab">集合名</span>
          <el-input
            v-model="mongoCollection"
            class="pipe-col"
            clearable
            placeholder="如 config、group_config"
          />
        </div>
        <div class="pipe-row pipe-stack">
          <span class="pipe-lab">pipeline（JSON 数组）</span>
          <el-input
            v-model="pipelineJson"
            class="pipe-json"
            type="textarea"
            :rows="10"
            spellcheck="false"
            placeholder='例如 [{"$match": {"account": 123}}, {"$limit": 5}]'
          />
        </div>
        <el-button
          type="primary"
          :loading="pipelineBusy"
          @click="runPipeline"
        >执行（只读）</el-button>
        <el-table
          v-if="pipelineCols.length"
          class="tb tb-dense pipe-out"
          size="small"
          border
          stripe
          :data="pipelineRows"
          max-height="45vh"
        >
          <el-table-column
            v-for="c in pipelineCols"
            :key="c"
            :label="c"
            :prop="c"
            min-width="100"
            show-overflow-tooltip
          />
        </el-table>
      </el-card>
    </div>
    </PallasSidebarShell>

    <el-dialog
    v-model="qDialog"
    :title="qResult?.type === 'group' ? '群配置（只读预览）' : 'Bot 配置（只读预览）'"
    width="min(92vw, 520px)"
    destroy-on-close
  >
    <el-scrollbar max-height="55vh">
      <pre
        v-if="qResult"
        class="json"
      >{{ JSON.stringify(qResult.data, null, 2) }}</pre>
    </el-scrollbar>
    <template #footer>
      <el-button @click="qDialog = false">关闭</el-button>
      <el-button
        type="primary"
        @click="goEditInInstances"
      >去「好友与群」里改</el-button>
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
.panel {
  max-width: 1100px;
}
.c {
  border: 1px solid rgba(22, 100, 196, 0.1);
}
.db-banner {
  margin-bottom: 12px;
}
.q-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.q-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 14px;
}
.q-left {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  padding: 10px;
  background: var(--el-fill-color-blank);
}
.q-left-hd {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-main);
  margin-bottom: 8px;
}
.q-left-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow: auto;
}
.q-left-item {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 8px;
  background: #fff;
  text-align: left;
  padding: 8px;
  cursor: pointer;
}
.q-left-name {
  font-size: 13px;
  font-weight: 600;
}
.q-left-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.45;
  word-break: break-word;
}
.q-right {
  min-width: 0;
}
.q-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.q-lab {
  width: 200px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  flex-shrink: 0;
}
.q-inp {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}
.q-his {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.q-his-lab {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.q-his-empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.ov-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ov-item {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ov-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ov-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.box {
  min-height: 120px;
}
.d {
  margin-bottom: 12px;
}
.db-type-line {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 8px;
  display: flex;
  align-items: baseline;
  gap: 12px;
  background: var(--el-fill-color-blank);
}
.db-type-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.db-type-name {
  font-size: 22px;
  line-height: 1.1;
  color: var(--c-main);
  letter-spacing: 0.02em;
}
.ops-box {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  padding: 10px;
}
.ops-direct {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 10px;
  padding: 10px;
}
.ops-direct-hd {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--c-main);
}
.ops-direct-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}
.ops-card {
  border: 1px solid rgba(22, 100, 196, 0.12);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--el-fill-color-blank);
}
.ops-card-wide {
  grid-column: 1 / -1;
}
.ops-card-t {
  font-size: 12px;
  font-weight: 700;
  color: var(--el-text-color-regular);
  line-height: 1.45;
}
.ops-inp {
  width: 100%;
}
.ops-sel-mini {
  min-width: 200px;
}
.ops-id-inp {
  min-width: 260px;
}
.ops-json-inp {
  width: 100%;
  :deep(textarea) {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 12px;
  }
}
.ops-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--c-main);
}
.ops-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.ops-sel {
  min-width: 260px;
  flex: 1;
}
.ops-code {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  border: 1px solid rgba(22, 100, 196, 0.1);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-fill-color-light);
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
:deep(.el-descriptions__content),
:deep(.el-table .cell) {
  word-break: break-word;
}
.tb {
  width: 100%;
  --el-table-border-color: rgba(22, 100, 196, 0.1);
}
.tb-dense :deep(.cell) {
  padding: 6px 8px;
}
html.dark .q-left-item,
html.dark .ov-item,
html.dark .ops-box,
html.dark .ops-direct,
html.dark .ops-card {
  background: rgba(18, 25, 37, 0.88);
  border-color: rgba(125, 176, 255, 0.34);
}
html.dark .q-left {
  background: rgba(18, 25, 37, 0.7);
  border-color: rgba(125, 176, 255, 0.28);
}
html.dark .db-type-line {
  background: rgba(18, 25, 37, 0.82);
  border-color: rgba(125, 176, 255, 0.3);
}
html.dark .ops-code {
  background: rgba(10, 14, 22, 0.86);
  border-color: rgba(125, 176, 255, 0.24);
}
html.dark .tb :deep(.el-table__inner-wrapper),
html.dark .tb :deep(.el-table__header-wrapper),
html.dark .tb :deep(.el-table__body-wrapper),
html.dark .tb :deep(.el-table__cell) {
  background-color: rgba(18, 25, 37, 0.92) !important;
}
html.dark .tb :deep(.el-table__row:hover > td.el-table__cell) {
  background: rgba(58, 121, 214, 0.22) !important;
}
.pipe-al {
  margin-bottom: 14px;
}
.pipe-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}
.pipe-row.pipe-stack {
  align-items: flex-start;
}
.pipe-lab {
  width: 120px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.pipe-col {
  flex: 1;
  min-width: 160px;
  max-width: 320px;
}
.pipe-json {
  flex: 1;
  min-width: 200px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
}
.pipe-out {
  margin-top: 14px;
}
.ft {
  margin-top: 12px;
}
.json {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, Consolas, monospace;
}
@media (max-width: 960px) {
  .q-layout {
    grid-template-columns: 1fr;
  }
}
</style>
