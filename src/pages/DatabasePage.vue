<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchDbOverview, postMongoAggregate } from "@/api/consoleApi";
import type { DbOverviewData } from "@/api/pallasTypes";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

/** 上次成功拉取的总览，用于再次进入页面时直接展示，减少骨架屏 */
let dbOverviewCache: DbOverviewData | null = null;

const panelNavIcon = usePanelNavIcon();
const err = ref("");
/** 仅首次无缓存时阻塞展示（轻量骨架）；有缓存时只走 dbRefreshBusy */
const blockingLoad = ref(false);
const dbRefreshBusy = ref(false);
const overview = ref<DbOverviewData | null>(dbOverviewCache);

const collection = ref("");
const pipelineText = ref("[\n  { \"$limit\": 20 }\n]");
const aggResult = ref<string>("");
const aggLoading = ref(false);

const nf = new Intl.NumberFormat("zh-CN");

function isMongo(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "mongodb" }> {
  return o != null && o.backend === "mongodb";
}

function isPostgres(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "postgres" }> {
  return o != null && o.backend === "postgres";
}

const mongoCollections = computed(() => (isMongo(overview.value) ? overview.value.collections : []));
const pgTables = computed(() => (isPostgres(overview.value) ? overview.value.tables : []));

const backendLabel = computed(() => {
  const o = overview.value;
  if (!o) return "—";
  if (o.backend === "mongodb") return "MongoDB";
  if (o.backend === "postgres") return "PostgreSQL";
  return o.backend;
});

const totalDocuments = computed(() => {
  if (!isMongo(overview.value)) return null;
  return overview.value.collections.reduce((s: number, c: { count: number }) => s + (c.count ?? 0), 0);
});

const totalRows = computed(() => {
  if (!isPostgres(overview.value)) return null;
  return overview.value.tables.reduce((s: number, t: { count: number }) => s + (t.count ?? 0), 0);
});

async function loadAll() {
  err.value = "";
  const noDataYet = overview.value == null;
  if (noDataYet) blockingLoad.value = true;
  dbRefreshBusy.value = true;
  try {
    const next = await fetchDbOverview();
    overview.value = next;
    dbOverviewCache = next;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    blockingLoad.value = false;
    dbRefreshBusy.value = false;
  }
}

onMounted(loadAll);

async function runAggregate() {
  aggLoading.value = true;
  aggResult.value = "";
  err.value = "";
  try {
    const pipeline = JSON.parse(pipelineText.value) as unknown[];
    const r = await postMongoAggregate({ collection: collection.value.trim(), pipeline });
    aggResult.value = JSON.stringify(r, null, 2);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    aggLoading.value = false;
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

    <div class="plugins-page__hero database-page__hero">
      <h2 class="panel__title">
        <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>数据库总览
        <RefreshIconButton
          :busy="dbRefreshBusy"
          :disabled="dbRefreshBusy"
          label="刷新数据库总览"
          @click="loadAll"
        />
      </h2>
    </div>

    <ConsolePageSkeleton
      v-if="blockingLoad && !overview"
      :panels="1"
    />

    <div
      v-if="overview"
      class="grid-stats"
    >
      <div class="card stat-card">
        <div class="card__body">
          <div class="stat-card__label">后端类型</div>
          <div class="stat-card__value">{{ backendLabel }}</div>
          <div
            v-if="overview && 'note' in overview && overview.note"
            class="stat-card__hint"
          >
            {{ overview.note }}
          </div>
        </div>
      </div>
      <div
        v-if="totalDocuments != null"
        class="card stat-card"
      >
        <div class="card__body">
          <div class="stat-card__label">集合文档（合计）</div>
          <div class="stat-card__value">{{ nf.format(totalDocuments) }}</div>
          <div class="stat-card__hint">{{ mongoCollections.length }} 个集合</div>
        </div>
      </div>
      <div
        v-if="totalRows != null"
        class="card stat-card"
      >
        <div class="card__body">
          <div class="stat-card__label">表行数（合计）</div>
          <div class="stat-card__value">{{ nf.format(totalRows) }}</div>
          <div class="stat-card__hint">{{ pgTables.length }} 张表</div>
        </div>
      </div>
    </div>

    <div
      v-if="overview?.backend === 'mongodb'"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>集合与文档数
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/database" />
        </div>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>集合</th>
                <th>文档字段</th>
                <th style="text-align: right">数量</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in mongoCollections"
                :key="c.name"
              >
                <td style="font-weight: 600">{{ c.name }}</td>
                <td class="muted">{{ c.document }}</td>
                <td style="text-align: right; font-variant-numeric: tabular-nums">{{ nf.format(c.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-else-if="overview?.backend === 'postgres'"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>表与行数
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/database" />
        </div>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>表名</th>
                <th style="text-align: right">行数</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in pgTables"
                :key="t.table"
              >
                <td style="font-weight: 600">{{ t.table }}</td>
                <td style="text-align: right; font-variant-numeric: tabular-nums">{{ nf.format(t.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div
      v-else-if="overview"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>概览
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/database" />
        </div>
      </div>
      <div class="panel__bd">
        <p class="muted" style="margin: 0 0 12px">后端类型：<strong style="color: var(--text)">{{ overview.backend }}</strong></p>
        <p
          v-if="overview && 'note' in overview && overview.note"
          class="muted"
          style="margin: 0"
        >
          {{ overview.note }}
        </p>
      </div>
    </div>

    <div
      v-if="overview && overview.backend === 'mongodb'"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>MongoDB 聚合
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/database" />
          <button
            type="button"
            class="btn btn--primary"
            :disabled="aggLoading || !collection.trim()"
            @click="runAggregate"
          >
            {{ aggLoading ? "执行中…" : "执行" }}
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div style="margin-bottom: 12px">
          <label class="muted" style="display: block; margin-bottom: 6px">集合名</label>
          <select
            v-if="mongoCollections.length"
            v-model="collection"
            class="sel"
            style="max-width: 420px; width: 100%"
          >
            <option value="">请选择集合</option>
            <option
              v-for="c in mongoCollections"
              :key="c.name"
              :value="c.name"
            >
              {{ c.name }}（{{ nf.format(c.count) }}）
            </option>
          </select>
          <input
            v-else
            v-model="collection"
            class="inp"
            style="max-width: 360px; width: 100%"
            placeholder="collection"
          >
        </div>
        <label class="muted" style="display: block; margin-bottom: 6px">Pipeline（JSON 数组）</label>
        <JsonTextareaField
          v-model="pipelineText"
          title="Pipeline（JSON 数组）"
          :rows="8"
          placeholder='页内或弹窗编辑；须为 JSON 数组，例如 [{"$limit":20}]'
        />
        <div
          v-if="aggResult"
          style="margin-top: 16px"
        >
          <div class="muted" style="margin-bottom: 8px">结果</div>
          <pre class="pre-block">{{ aggResult }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
