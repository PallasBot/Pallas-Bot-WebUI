<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import {
  fetchDbBackupInfo,
  fetchDbOverview,
  fetchGroupConfigs,
  fetchPlugins,
  fetchUserConfigs,
  peekPluginsCache,
  postDbBackup,
  postMongoAggregate,
} from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type {
  DbBackupInfo,
  DbBackupResult,
  DbOverviewData,
  GroupConfigPublic,
  PluginRow,
  UserConfigPublic,
} from "@/api/pallasTypes";
import ConsolePagerBar from "@/components/ConsolePagerBar.vue";
import ConsoleTableEdit from "@/components/ConsoleTableEdit.vue";
import JsonTextareaField from "@/components/JsonTextareaField.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import GroupSocialConfigModal from "@/components/social/GroupSocialConfigModal.vue";
import UserSocialConfigModal from "@/components/social/UserSocialConfigModal.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";
import { formatDisabledPluginIds } from "@/utils/pluginDisplay";
import { slicePage } from "@/utils/paginate";
import { rouletteModeLabel } from "@/utils/rouletteMode";

/** 上次成功拉取的总览，用于再次进入页面时直接展示，减少骨架屏 */
let dbOverviewCache: DbOverviewData | null = null;

const CONFIG_LIST_LIMIT = 10_000;

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const ok = ref("");
/** 仅首次无缓存时阻塞展示（轻量骨架）；有缓存时只走 dbRefreshBusy */
const blockingLoad = ref(false);
const dbRefreshBusy = ref(false);
const overview = ref<DbOverviewData | null>(dbOverviewCache);

const collection = ref("");
const pipelineText = ref("[\n  { \"$limit\": 20 }\n]");
const aggResult = ref<string>("");
const aggLoading = ref(false);

const backupInfo = ref<DbBackupInfo | null>(null);
const backupOutputParent = ref("");
const backupLabel = ref("");
const backupScope = ref<"full" | "important">("full");
const backupPgFormat = ref<"custom" | "plain" | "directory">("custom");
const backupBusy = ref(false);
const backupResult = ref<DbBackupResult | null>(null);

const socialConfigsBusy = ref(false);
const groupConfigs = ref<GroupConfigPublic[]>([]);
const userConfigs = ref<UserConfigPublic[]>([]);
const groupListQ = ref("");
const userListQ = ref("");
const pageGroups = ref(1);
const pageUsers = ref(1);

const groupConfigOpen = ref(false);
const groupConfigId = ref<number | null>(null);
const userConfigOpen = ref(false);
const userConfigId = ref<number | null>(null);

const plugins = ref<PluginRow[]>([]);
{
  const warmPl = peekPluginsCache();
  if (warmPl?.length) plugins.value = warmPl;
}
const pluginLoadErr = ref("");

const tablePageSize = computed({
  get: () => Math.min(80, Math.max(4, consolePrefs.tablePageSize ?? 12)),
  set(v: number) {
    const n = Math.min(80, Math.max(4, Math.floor(Number(v)) || 12));
    if (n !== consolePrefs.tablePageSize) setConsolePrefs({ tablePageSize: n });
  },
});

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

const backupToolReady = computed(() => backupInfo.value?.tool_available === true);

const backupScopeOptions = computed(() => {
  if (backupInfo.value?.backend === "mongodb") {
    return [
      { value: "full" as const, label: "整库（mongodump）" },
      { value: "important" as const, label: "关键集合（config / group_config / user_config 等）" },
    ];
  }
  return [{ value: "full" as const, label: "整库（pg_dump）" }];
});

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const totalDocuments = computed(() => {
  if (!isMongo(overview.value)) return null;
  return overview.value.collections.reduce((s: number, c: { count: number }) => s + (c.count ?? 0), 0);
});

const totalRows = computed(() => {
  if (!isPostgres(overview.value)) return null;
  return overview.value.tables.reduce((s: number, t: { count: number }) => s + (t.count ?? 0), 0);
});

function listNeedle(raw: string): string {
  return raw.trim().toLowerCase();
}

function rowMatchesNeedle(
  needle: string,
  parts: Array<string | number | null | undefined | boolean>,
): boolean {
  if (!needle) return true;
  return parts.some((p) => String(p ?? "").toLowerCase().includes(needle));
}

const sortedGroupConfigs = computed(() =>
  [...groupConfigs.value].sort((a, b) => a.group_id - b.group_id),
);

const sortedUserConfigs = computed(() =>
  [...userConfigs.value].sort((a, b) => a.user_id - b.user_id),
);

const filteredGroupConfigs = computed(() => {
  const needle = listNeedle(groupListQ.value);
  if (!needle) return sortedGroupConfigs.value;
  return sortedGroupConfigs.value.filter((g) =>
    rowMatchesNeedle(needle, [
      g.group_id,
      rouletteModeLabel(g.roulette_mode),
      g.banned ? "封禁" : "正常",
      formatDisabledPluginIds(g.disabled_plugins, plugins.value),
      (g.blocked_user_ids ?? []).length,
      ...(g.blocked_user_ids ?? []),
    ]),
  );
});

const filteredUserConfigs = computed(() => {
  const needle = listNeedle(userListQ.value);
  if (!needle) return sortedUserConfigs.value;
  return sortedUserConfigs.value.filter((u) =>
    rowMatchesNeedle(needle, [u.user_id, u.banned ? "封禁" : "正常"]),
  );
});

const pagedGroupConfigs = computed(() =>
  slicePage(filteredGroupConfigs.value, pageGroups.value, tablePageSize.value),
);

const pagedUserConfigs = computed(() =>
  slicePage(filteredUserConfigs.value, pageUsers.value, tablePageSize.value),
);

watch(groupListQ, () => {
  pageGroups.value = 1;
});

watch(userListQ, () => {
  pageUsers.value = 1;
});

async function loadPluginsCatalog() {
  pluginLoadErr.value = "";
  try {
    plugins.value = await fetchPlugins();
  } catch (e) {
    pluginLoadErr.value = e instanceof Error ? e.message : String(e);
  }
}

async function loadSocialConfigs() {
  socialConfigsBusy.value = true;
  try {
    const [groups, users] = await Promise.all([
      fetchGroupConfigs(CONFIG_LIST_LIMIT),
      fetchUserConfigs(CONFIG_LIST_LIMIT),
    ]);
    groupConfigs.value = groups;
    userConfigs.value = users;
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  } finally {
    socialConfigsBusy.value = false;
  }
}

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
  void loadSocialConfigs();
}

async function loadBackupInfo() {
  try {
    const info = await fetchDbBackupInfo();
    backupInfo.value = info;
    if (!backupOutputParent.value.trim()) {
      backupOutputParent.value = info.default_output_parent;
    }
  } catch (e) {
    err.value = axiosErrorDetail(e);
  }
}

async function runDbBackup() {
  backupBusy.value = true;
  backupResult.value = null;
  err.value = "";
  ok.value = "";
  try {
    const parent = backupOutputParent.value.trim();
    const result = await postDbBackup({
      output_parent: parent || null,
      label: backupLabel.value.trim(),
      scope: backupScope.value,
      pg_format: backupPgFormat.value,
    });
    backupResult.value = result;
    ok.value = result.message || "备份已完成。";
  } catch (e) {
    err.value = axiosErrorDetail(e);
  } finally {
    backupBusy.value = false;
  }
}

onMounted(() => {
  void loadPluginsCatalog();
  void loadAll();
  void loadBackupInfo();
});

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

function toggleGroupConfigsPanel() {
  setConsolePrefs({
    databasePageGroupConfigsOpen: !consolePrefs.databasePageGroupConfigsOpen,
  });
}

function toggleUserConfigsPanel() {
  setConsolePrefs({
    databasePageUserConfigsOpen: !consolePrefs.databasePageUserConfigsOpen,
  });
}

function openGroupConfig(groupId: number) {
  groupConfigId.value = groupId;
  groupConfigOpen.value = true;
}

function openUserConfig(userId: number) {
  userConfigId.value = userId;
  userConfigOpen.value = true;
}

function onSocialConfigSaved(kind: "group" | "user") {
  ok.value = kind === "group" ? "群配置已保存。" : "好友配置已保存。";
  void loadSocialConfigs();
}

watch(
  () => groupConfigOpen.value || userConfigOpen.value,
  (anyOpen) => {
    if (typeof document === "undefined") return;
    if (!anyOpen) document.body.style.overflow = "";
  },
);

onUnmounted(() => {
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <div>
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

    <div class="plugins-page__hero database-page__hero">
      <h2 class="panel__title">
        <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>数据库总览
        <RefreshIconButton
          :busy="dbRefreshBusy"
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
      v-if="overview && (overview.backend === 'mongodb' || overview.backend === 'postgres')"
      id="db-backup"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>数据库备份
        </h2>
        <div class="row-actions">
          <PanelSidebarAdd main-path="/database" />
          <button
            type="button"
            class="btn btn--primary"
            :disabled="backupBusy || !backupToolReady"
            @click="runDbBackup"
          >
            {{ backupBusy ? "备份中…" : "开始备份" }}
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          v-if="backupInfo && !backupInfo.tool_available"
          class="alert alert--err"
          style="margin: 0 0 12px"
        >
          <p style="margin: 0 0 8px">
            未在运行 Bot 的环境中检测到 <strong>{{ backupInfo.tool_name }}</strong>，无法从 WebUI 发起备份。
            请先安装
            <template v-if="backupInfo.tool_download_url">
              <a
                :href="backupInfo.tool_download_url"
                target="_blank"
                rel="noopener noreferrer"
              >{{ backupInfo.tool_download_label || backupInfo.tool_name }}</a>
            </template>
            <template v-else>
              {{ backupInfo.tool_download_label || backupInfo.tool_name }}
            </template>
            并加入 PATH。
          </p>
          <p
            v-if="backupInfo.tool_install_hint"
            class="muted"
            style="margin: 0; font-size: 0.92em"
          >
            {{ backupInfo.tool_install_hint }}
          </p>
        </div>
        <p
          v-else-if="backupInfo"
          class="muted"
          style="margin: 0 0 12px"
        >
          当前后端：<strong style="color: var(--text)">{{ backendLabel }}</strong>
          · {{ backupInfo.connection.host }}:{{ backupInfo.connection.port }}
          · 库 <strong style="color: var(--text)">{{ backupInfo.connection.database }}</strong>
          · 工具 {{ backupInfo.tool_name }}
        </p>
        <div
          class="database-backup-form"
          style="display: grid; gap: 12px; max-width: 720px"
        >
          <div>
            <label class="muted" style="display: block; margin-bottom: 6px">备份父目录</label>
            <input
              v-model="backupOutputParent"
              class="inp"
              style="width: 100%; max-width: 100%"
              placeholder="例如 D:/Pallas/backups 或留空使用默认"
            >
            <p class="muted" style="margin: 6px 0 0; font-size: 0.9em">
              将在该目录下创建带时间戳的子文件夹；相对路径相对于 Bot 仓库根目录。
            </p>
          </div>
          <div>
            <label class="muted" style="display: block; margin-bottom: 6px">目录后缀（可选）</label>
            <input
              v-model="backupLabel"
              class="inp"
              style="width: 100%; max-width: 360px"
              placeholder="例如 before_upgrade"
            >
          </div>
          <div>
            <label class="muted" style="display: block; margin-bottom: 6px">备份范围</label>
            <select
              v-model="backupScope"
              class="sel"
              style="max-width: 420px; width: 100%"
              :disabled="backupInfo?.backend === 'postgres'"
            >
              <option
                v-for="opt in backupScopeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>
          <div v-if="backupInfo?.backend === 'postgres'">
            <label class="muted" style="display: block; margin-bottom: 6px">PostgreSQL 格式</label>
            <select
              v-model="backupPgFormat"
              class="sel"
              style="max-width: 420px; width: 100%"
            >
              <option value="custom">custom（.dump，推荐）</option>
              <option value="plain">plain SQL（.sql）</option>
              <option value="directory">directory（目录格式）</option>
            </select>
          </div>
        </div>
        <div
          v-if="backupResult"
          class="panel panel--nested"
          style="margin-top: 16px"
        >
          <div class="panel__bd">
            <p style="margin: 0 0 8px"><strong>输出目录</strong> {{ backupResult.output_dir }}</p>
            <p
              v-for="(art, i) in backupResult.artifacts"
              :key="i"
              class="muted"
              style="margin: 0 0 4px; word-break: break-all"
            >
              产物：{{ art }}
            </p>
            <p class="muted" style="margin: 8px 0 0">大小：{{ formatBytes(backupResult.size_bytes) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div
      id="db-group-configs"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>群配置
          <RefreshIconButton
            :busy="socialConfigsBusy"
            label="刷新群配置列表"
            @click="loadSocialConfigs"
          />
        </h2>
        <div class="row-actions friends-groups-list-hd-actions">
          <span class="friends-groups-hd-pin-wrap">
            <PanelSidebarAdd pin-id="database-group-configs" />
          </span>
          <input
            v-model="groupListQ"
            class="inp"
            type="search"
            placeholder="搜索群号 / 轮盘 / 封禁 / 插件 / 拉黑"
            title="按群号、轮盘模式、封禁状态、禁用插件、拉黑 QQ 筛选"
            :disabled="socialConfigsBusy"
          >
          <div class="friends-groups-list-hd-actions__tail">
            <span
              v-if="socialConfigsBusy"
              class="muted"
              style="font-size: 12px"
            >加载中…</span>
            <button
              type="button"
              class="btn"
              style="padding: 6px 12px; font-size: 12px"
              @click="toggleGroupConfigsPanel"
            >
              {{ consolePrefs.databasePageGroupConfigsOpen ? "收起" : "展开" }}
            </button>
          </div>
        </div>
      </div>
      <div
        v-show="consolePrefs.databasePageGroupConfigsOpen"
        class="panel__bd"
      >
        <p
          v-if="pluginLoadErr"
          class="muted"
          style="margin: 0 0 10px"
        >
          插件列表加载失败，禁用插件列可能不完整：{{ pluginLoadErr }}
        </p>
        <p
          v-if="socialConfigsBusy && !groupConfigs.length"
          class="muted"
          style="margin: 0"
        >
          正在加载群配置…
        </p>
        <div
          v-else-if="!filteredGroupConfigs.length"
          class="muted"
        >
          <template v-if="groupListQ.trim() && groupConfigs.length > 0">无匹配结果。</template>
          <template v-else>数据库中暂无群配置记录。</template>
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>群号</th>
                <th>封禁</th>
                <th>轮盘</th>
                <th>禁用插件</th>
                <th>拉黑</th>
                <th style="min-width: 88px; width: 1%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="g in pagedGroupConfigs"
                :key="g.group_id"
              >
                <td>{{ g.group_id }}</td>
                <td>
                  <span
                    class="badge"
                    :class="g.banned ? 'badge--warn' : 'badge--ok'"
                  >{{ g.banned ? "是" : "否" }}</span>
                </td>
                <td>{{ rouletteModeLabel(g.roulette_mode) }}</td>
                <td class="muted">{{ formatDisabledPluginIds(g.disabled_plugins, plugins) || "—" }}</td>
                <td class="muted">{{ (g.blocked_user_ids ?? []).length ? `${(g.blocked_user_ids ?? []).length} 人` : "—" }}</td>
                <td>
                  <ConsoleTableEdit @click="openGroupConfig(g.group_id)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="!socialConfigsBusy && filteredGroupConfigs.length > 0"
          v-model:page="pageGroups"
          v-model:page-size="tablePageSize"
          :total="filteredGroupConfigs.length"
        />
      </div>
    </div>

    <div
      id="db-user-configs"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>好友配置
          <RefreshIconButton
            :busy="socialConfigsBusy"
            label="刷新好友配置列表"
            @click="loadSocialConfigs"
          />
        </h2>
        <div class="row-actions friends-groups-list-hd-actions">
          <span class="friends-groups-hd-pin-wrap">
            <PanelSidebarAdd pin-id="database-user-configs" />
          </span>
          <input
            v-model="userListQ"
            class="inp"
            type="search"
            placeholder="搜索 QQ / 封禁状态"
            title="按 QQ、封禁状态筛选"
            :disabled="socialConfigsBusy"
          >
          <div class="friends-groups-list-hd-actions__tail">
            <span
              v-if="socialConfigsBusy"
              class="muted"
              style="font-size: 12px"
            >加载中…</span>
            <button
              type="button"
              class="btn"
              style="padding: 6px 12px; font-size: 12px"
              @click="toggleUserConfigsPanel"
            >
              {{ consolePrefs.databasePageUserConfigsOpen ? "收起" : "展开" }}
            </button>
          </div>
        </div>
      </div>
      <div
        v-show="consolePrefs.databasePageUserConfigsOpen"
        class="panel__bd"
      >
        <p
          v-if="socialConfigsBusy && !userConfigs.length"
          class="muted"
          style="margin: 0"
        >
          正在加载好友配置…
        </p>
        <div
          v-else-if="!filteredUserConfigs.length"
          class="muted"
        >
          <template v-if="userListQ.trim() && userConfigs.length > 0">无匹配结果。</template>
          <template v-else>数据库中暂无好友配置记录。</template>
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data console-data-table">
            <thead>
              <tr>
                <th>QQ</th>
                <th>封禁</th>
                <th style="min-width: 88px; width: 1%">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in pagedUserConfigs"
                :key="u.user_id"
              >
                <td>{{ u.user_id }}</td>
                <td>
                  <span
                    class="badge"
                    :class="u.banned ? 'badge--warn' : 'badge--ok'"
                  >{{ u.banned ? "是" : "否" }}</span>
                </td>
                <td>
                  <ConsoleTableEdit @click="openUserConfig(u.user_id)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ConsolePagerBar
          v-if="!socialConfigsBusy && filteredUserConfigs.length > 0"
          v-model:page="pageUsers"
          v-model:page-size="tablePageSize"
          :total="filteredUserConfigs.length"
        />
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
                <td
                  style="text-align: right; font-variant-numeric: tabular-nums"
                  :title="c.count_estimated ? 'Mongo 估算行数（大表）' : undefined"
                >
                  {{ c.count_estimated ? "≈" : "" }}{{ nf.format(c.count) }}
                </td>
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

    <GroupSocialConfigModal
      v-model:open="groupConfigOpen"
      :group-id="groupConfigId"
      @saved="onSocialConfigSaved('group')"
    />
    <UserSocialConfigModal
      v-model:open="userConfigOpen"
      :user-id="userConfigId"
      @saved="onSocialConfigSaved('user')"
    />
  </div>
</template>
