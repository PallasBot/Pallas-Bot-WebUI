<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { fetchBotConfigs, fetchDbOverview, fetchInstances, postMongoAggregate } from "@/api/consoleApi";
import type { BotConfigPublic, DbOverviewData, InstancesData, NapcatManagerSnapshot } from "@/api/pallasTypes";

const err = ref("");
const overview = ref<DbOverviewData | null>(null);
const botConfigs = ref<BotConfigPublic[]>([]);
const instSnap = ref<NapcatManagerSnapshot | null>(null);
const botProfiles = ref<InstancesData["bot_profiles"]>(undefined);
const extraErr = ref("");

const botView = ref<"table" | "cards">("table");
const protoView = ref<"table" | "cards">("table");

const collection = ref("");
const pipelineText = ref("[\n  { \"$limit\": 20 }\n]");
const aggResult = ref<string>("");
const aggLoading = ref(false);

const nf = new Intl.NumberFormat("zh-CN");

const protocolSnap = computed<NapcatManagerSnapshot | null>(
  () => instSnap.value ?? null,
);

function botProfileEntry(account: number) {
  return botProfiles.value?.[String(account)];
}

function botNickname(account: number): string | undefined {
  const n = botProfileEntry(account)?.nickname?.trim();
  return n || undefined;
}

function boolPillClass(on: boolean): string {
  return on ? "data-pill data-pill--on" : "data-pill data-pill--off";
}

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
  extraErr.value = "";
  try {
    overview.value = await fetchDbOverview();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
  try {
    const [bots, inst] = await Promise.all([fetchBotConfigs(), fetchInstances()]);
    botConfigs.value = bots;
    instSnap.value = inst.pallas_protocol ?? inst.napcat ?? null;
    botProfiles.value = inst.bot_profiles;
  } catch (e) {
    extraErr.value = e instanceof Error ? e.message : String(e);
    botConfigs.value = [];
    instSnap.value = null;
    botProfiles.value = undefined;
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
    <header class="page-hero page-hero--with-actions">
      <div class="page-hero__main">
        <p class="page-hero__eyebrow">Data</p>
        <h1 class="page-hero__title">数据库</h1>
        <p class="page-hero__desc">查看存储后端类型与对象体量；Bot 配置与协议快照为只读镜像，编辑请前往「实例与连接」。</p>
      </div>
      <div class="page-hero__actions">
        <button
          type="button"
          class="btn"
          @click="loadAll"
        >
          刷新
        </button>
      </div>
    </header>

    <div
      v-if="err"
      class="alert alert--err"
    >
      {{ err }}
    </div>
    <div
      v-if="extraErr"
      class="alert alert--err"
    >
      {{ extraErr }}
    </div>

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

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">Bot 配置（数据面）</h2>
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px">
          <RouterLink
            class="link-quiet"
            to="/instances"
            style="font-size: 13px"
          >去实例与连接编辑 →</RouterLink>
          <div
            class="console-view-toggle"
            role="group"
            aria-label="Bot 配置视图"
          >
            <button
              type="button"
              :class="{ 'is-on': botView === 'table' }"
              @click="botView = 'table'"
            >
              表格
            </button>
            <button
              type="button"
              :class="{ 'is-on': botView === 'cards' }"
              @click="botView = 'cards'"
            >
              卡片
            </button>
          </div>
        </div>
      </div>
      <div class="panel__bd">
        <p
          v-if="!botConfigs.length"
          class="muted"
          style="margin: 0"
        >
          暂无 Bot 配置记录。
        </p>
        <div
          v-else-if="botView === 'table'"
          class="table-wrap"
        >
          <table class="data">
            <thead>
              <tr>
                <th>account</th>
                <th>昵称</th>
                <th>security</th>
                <th>auto_accept_friend</th>
                <th>auto_accept_group</th>
                <th>disabled_plugins</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in botConfigs"
                :key="c.account"
              >
                <td style="font-weight: 600">{{ c.account }}</td>
                <td class="muted">{{ botNickname(c.account) || "—" }}</td>
                <td>{{ c.security }}</td>
                <td>{{ c.auto_accept_friend }}</td>
                <td>{{ c.auto_accept_group }}</td>
                <td class="muted">{{ c.disabled_plugins?.join(", ") || "—" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          v-else
          class="data-card-grid"
        >
          <div
            v-for="c in botConfigs"
            :key="`dbc-${c.account}`"
            class="data-summary-card data-summary-card--kv"
          >
            <div class="data-summary-card__head">
              <div class="data-summary-card__title">账号 {{ c.account }}</div>
              <template v-if="botNickname(c.account)">
                <div class="data-summary-card__nick-label">昵称</div>
                <div class="data-summary-card__nick">{{ botNickname(c.account) }}</div>
              </template>
              <p
                v-else
                class="muted"
                style="margin: 6px 0 0; font-size: 12px"
              >
                暂无昵称（实例接口未上报或账号未在线）
              </p>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">安全模式</span>
              <span :class="boolPillClass(c.security)">{{ c.security ? "开启" : "关闭" }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">自动同意好友</span>
              <span :class="boolPillClass(c.auto_accept_friend)">{{ c.auto_accept_friend ? "开启" : "关闭" }}</span>
            </div>
            <div class="data-summary-card__row">
              <span class="data-summary-card__label">自动同意入群</span>
              <span :class="boolPillClass(c.auto_accept_group)">{{ c.auto_accept_group ? "开启" : "关闭" }}</span>
            </div>
            <div class="data-summary-card__plugins">
              <span class="data-summary-card__plugins-label">禁用插件</span>
              {{ c.disabled_plugins?.length ? c.disabled_plugins.join("、") : "无" }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel__hd">
        <h2 class="panel__title">协议管理（快照）</h2>
        <div
          v-if="protocolSnap"
          class="console-view-toggle"
          role="group"
          aria-label="协议视图"
        >
          <button
            type="button"
            :class="{ 'is-on': protoView === 'table' }"
            @click="protoView = 'table'"
          >
            表格
          </button>
          <button
            type="button"
            :class="{ 'is-on': protoView === 'cards' }"
            @click="protoView = 'cards'"
          >
            卡片
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <p
          v-if="!protocolSnap"
          class="muted"
          style="margin: 0"
        >
          当前无协议管理器快照（可能未加载对应插件）。
        </p>
        <template v-else>
          <p class="muted" style="margin: 0 0 12px">
            {{ protocolSnap.plugin }} · WebUI {{ protocolSnap.webui_enabled ? "启用" : "关闭" }} · 路径
            {{ protocolSnap.webui_path }}
          </p>
          <div
            v-if="protoView === 'table'"
            class="table-wrap"
          >
            <table class="data">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>运行</th>
                  <th>已连接</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(a, i) in protocolSnap.accounts"
                  :key="i"
                >
                  <td>{{ a.qq || a.id }}</td>
                  <td>{{ a.process_running ?? a.running }}</td>
                  <td>{{ a.connected }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            v-else
            class="data-card-grid"
          >
            <div
              v-for="(a, i) in protocolSnap.accounts"
              :key="`dbp-${i}`"
              class="data-summary-card"
            >
              <div class="data-summary-card__title">{{ a.qq || a.id || "账号" }}</div>
              <div class="data-summary-card__meta">
                进程：{{ a.process_running ?? a.running ?? "—" }} · 连接：{{ a.connected ?? "—" }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="overview?.backend === 'mongodb'"
      class="panel"
    >
      <div class="panel__hd">
        <h2 class="panel__title">集合与文档数</h2>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data">
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
      <div class="panel__hd">
        <h2 class="panel__title">表与行数</h2>
      </div>
      <div class="panel__bd">
        <div class="table-wrap">
          <table class="data">
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
      <div class="panel__hd">
        <h2 class="panel__title">概览</h2>
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
      <div class="panel__hd">
        <h2 class="panel__title">MongoDB 聚合</h2>
        <button
          type="button"
          class="btn btn--primary"
          :disabled="aggLoading || !collection.trim()"
          @click="runAggregate"
        >
          {{ aggLoading ? "执行中…" : "执行" }}
        </button>
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
        <textarea
          v-model="pipelineText"
          class="textarea"
          rows="10"
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
