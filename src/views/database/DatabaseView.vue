<script setup lang="ts">
import PallasSidebarShell from "@/components/layout/PallasSidebarShell.vue";
import {
  fetchBotConfigById,
  fetchDbOverview,
  fetchGroupConfigById,
  postMongoAggregate,
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
  query: "按条件查询",
  overview: "存储空间占用概览",
  pipeline: "MongoDB 聚合管道",
};
const sectionSub: Record<DbSection, string> = {
  query: "只读：从当前 Bot 使用的数据库取一条配置，不执行任意 SQL/管道。",
  overview: "各表/集合内大约有多少条数据（只读统计）。数据量大时属正常现象。",
  pipeline:
    "仅 MongoDB；阶段仅限 $match/$project/$sort/$limit/$skip，最多 16 段，结果强制上限 200 条。须配置 pallas_webui_api_token 并在设置页填入。",
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

function pushHistory(text: string) {
  const v = text.trim();
  if (!v) return;
  queryHistory.value = [v, ...queryHistory.value.filter((x) => x !== v)].slice(0, 12);
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
            <el-descriptions
              v-if="overview"
              :column="1"
              size="small"
              border
              class="d"
            >
              <el-descriptions-item label="当前库类型">MongoDB</el-descriptions-item>
            </el-descriptions>
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
            <el-descriptions
              :column="1"
              size="small"
              border
              class="d"
            >
              <el-descriptions-item label="当前库类型">PostgreSQL</el-descriptions-item>
            </el-descriptions>
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
.tb {
  width: 100%;
  --el-table-border-color: rgba(22, 100, 196, 0.1);
}
.tb-dense :deep(.cell) {
  padding: 6px 8px;
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
