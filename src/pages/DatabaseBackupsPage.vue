<script setup lang="ts">
import BackupDirPicker from "@/components/BackupDirPicker.vue";
import BackupTargetTree from "@/components/BackupTargetTree.vue";
import ConsoleNavIcon from "@/components/ConsoleNavIcon.vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  downloadDbBackupRun,
  fetchActiveDbBackupJob,
  fetchDbBackupJob,
  fetchDbBackupRuns,
  fetchDbOverview,
  postDbBackupRestore,
  postDbBackupRunsDelete,
} from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type { DbBackupJobData, DbBackupRunRow, DbOverviewData } from "@/api/pallasTypes";
import ConsoleHubMasthead from "@/components/ConsoleHubMasthead.vue";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import StatCard from "@/components/StatCard.vue";
import UiBadge from "@/components/ui/UiBadge.vue";
import UiButton from "@/components/ui/UiButton.vue";
import type { UiBadgeVariant } from "@/components/ui/UiBadge.vue";
import UiCard from "@/components/ui/UiCard.vue";
import { formatBackupBytes, formatBackupElapsed, useDbBackup } from "@/composables/useDbBackup";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

type DownloadState = {
  status: "idle" | "downloading" | "done" | "failed";
  progress: number;
  error?: string;
};

type RunViewStatus = "completed" | "in_progress" | "failed";
type RunProgressKind = "backup" | "restore" | null;

const RESTORE_POLL_MS = 1500;

const panelNavIcon = usePanelNavIcon();
const pageErr = ref("");
const pageOk = ref("");
const pageReady = ref(false);
const listBusy = ref(false);
const deleting = ref(false);
const runs = ref<DbBackupRunRow[]>([]);
const selected = ref<Set<string>>(new Set());
const overview = ref<DbOverviewData | null>(null);
const dirPickerOpen = ref(false);
const downloadStates = ref<Record<string, DownloadState>>({});
const restoreJob = ref<DbBackupJobData | null>(null);
const restoreBusy = ref(false);
const restoreFailedPaths = ref<Record<string, string>>({});

let restorePollTimer: ReturnType<typeof setInterval> | null = null;

const {
  backupInfo,
  outputParent,
  label,
  scope,
  pgFormat,
  selectedPgTables,
  selectedMongoCollections,
  targetMode,
  busy: backupBusy,
  result: backupResult,
  job: backupJob,
  jobSizeBytes: backupJobSizeBytes,
  elapsedSec: backupElapsedSec,
  err: backupErr,
  ok: backupOk,
  toolReady: backupToolReady,
  scopeOptions: backupScopeOptions,
  progressComplete: backupProgressComplete,
  backendLabel,
  progressHint: backupProgressHint,
  loadInfo,
  resumeActive,
  runBackup,
} = useDbBackup({
  onCompleted: async () => {
    await loadRuns();
  },
});

const err = computed({
  get: () => pageErr.value || backupErr.value,
  set(v: string) {
    pageErr.value = v;
    backupErr.value = v;
  },
});

const ok = computed({
  get: () => pageOk.value || backupOk.value,
  set(v: string) {
    pageOk.value = v;
    backupOk.value = v;
  },
});

function formatModifiedAt(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw || "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

const totalBytes = computed(() => runs.value.reduce((s, r) => s + (r.size_bytes ?? 0), 0));

const allSelected = computed(() => {
  if (!runs.value.length) return false;
  return runs.value.every((r) => selected.value.has(r.path));
});

const selectedCount = computed(() => selected.value.size);

const selectedBytes = computed(() =>
  runs.value.filter((r) => selected.value.has(r.path)).reduce((s, r) => s + (r.size_bytes ?? 0), 0),
);

const connectionHint = computed(() => {
  const c = backupInfo.value?.connection;
  if (!c) return "—";
  return `${c.host}:${c.port} · ${c.database}`;
});

const restoreToolReady = computed(() => backupInfo.value?.restore_tool_available === true);

const restoreToolName = computed(() => backupInfo.value?.restore_tool_name ?? "复原工具");

const anyJobBusy = computed(() => backupBusy.value || restoreBusy.value);

function isMongoOverview(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "mongodb" }> {
  return o?.backend === "mongodb";
}

function isPostgresOverview(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "postgres" }> {
  return o?.backend === "postgres";
}

const pgTableOptions = computed(() => {
  if (!isPostgresOverview(overview.value)) return [];
  return overview.value.tables.map((t) => t.table);
});

const mongoCollectionOptions = computed(() => {
  if (!isMongoOverview(overview.value)) return [];
  return overview.value.collections.map((c) => c.name);
});

const targetOptions = computed(() => {
  if (backupInfo.value?.backend === "postgres") return pgTableOptions.value;
  if (backupInfo.value?.backend === "mongodb") return mongoCollectionOptions.value;
  return [];
});

const selectedTargets = computed({
  get() {
    if (backupInfo.value?.backend === "postgres") return selectedPgTables.value;
    if (backupInfo.value?.backend === "mongodb") return selectedMongoCollections.value;
    return [];
  },
  set(values: string[]) {
    if (backupInfo.value?.backend === "postgres") {
      selectedPgTables.value = values;
      return;
    }
    if (backupInfo.value?.backend === "mongodb") {
      selectedMongoCollections.value = values;
    }
  },
});

const allTargetsSelected = computed(() => {
  const opts = targetOptions.value;
  if (!opts.length) return false;
  return opts.every((name) => selectedTargets.value.includes(name));
});

function runProgressKind(row: DbBackupRunRow): RunProgressKind {
  const path = row.path.trim();
  const backupDir = backupBusy.value ? backupJob.value?.output_dir?.trim() : "";
  if (backupDir && path === backupDir) return "backup";
  const restoreDir = restoreBusy.value ? restoreJob.value?.output_dir?.trim() : "";
  if (restoreDir && path === restoreDir) return "restore";
  return null;
}

function runStatus(row: DbBackupRunRow): RunViewStatus {
  if (runProgressKind(row)) return "in_progress";
  if (restoreFailedPaths.value[row.path]) return "failed";
  return "completed";
}

function runStatusLabel(row: DbBackupRunRow): string {
  const status = runStatus(row);
  if (status === "in_progress") {
    return runProgressKind(row) === "restore" ? "复原中" : "备份中";
  }
  if (status === "failed") return "失败";
  return "已完成";
}

function runStatusBadgeVariant(row: DbBackupRunRow): UiBadgeVariant {
  const status = runStatus(row);
  if (status === "completed") return "ok";
  if (status === "failed") return "destructive";
  return "muted";
}

function stopRestorePollTimer() {
  if (restorePollTimer == null) return;
  clearInterval(restorePollTimer);
  restorePollTimer = null;
}

async function pollRestoreJobOnce(jobId: string) {
  const next = await fetchDbBackupJob(jobId);
  restoreJob.value = next;
  if (next.status === "completed") {
    restoreBusy.value = false;
    stopRestorePollTimer();
    pageOk.value = next.result?.message || "数据库复原已完成。";
    const failed = { ...restoreFailedPaths.value };
    delete failed[next.output_dir];
    restoreFailedPaths.value = failed;
  } else if (next.status === "failed") {
    restoreBusy.value = false;
    stopRestorePollTimer();
    const message = next.error || "复原失败。";
    restoreFailedPaths.value = {
      ...restoreFailedPaths.value,
      [next.output_dir]: message,
    };
    pageErr.value = message;
  }
}

function startRestorePollTimer(jobId: string) {
  stopRestorePollTimer();
  restorePollTimer = setInterval(() => {
    void pollRestoreJobOnce(jobId).catch((e) => {
      pageErr.value = axiosErrorDetail(e);
      restoreBusy.value = false;
      stopRestorePollTimer();
    });
  }, RESTORE_POLL_MS);
}

async function resumeRestoreJob() {
  try {
    const active = await fetchActiveDbBackupJob();
    if (!active?.job_id || active.job_kind !== "restore") return;
    restoreJob.value = active;
    if (active.status === "queued" || active.status === "running") {
      restoreBusy.value = true;
      startRestorePollTimer(active.job_id);
      void pollRestoreJobOnce(active.job_id);
    }
  } catch {
    /* 忽略恢复失败 */
  }
}

async function restoreRun(row: DbBackupRunRow) {
  if (runStatus(row) !== "completed") return;
  if (!restoreToolReady.value) {
    pageErr.value = `未检测到 ${restoreToolName.value}，无法从 WebUI 复原。`;
    return;
  }
  if (typeof window !== "undefined") {
    const okConfirm = window.confirm(
      `确定用备份「${row.name}」覆盖当前数据库？此操作不可撤销，进行中的备份/复原任务期间请勿重复发起。`,
    );
    if (!okConfirm) return;
  }
  restoreBusy.value = true;
  restoreJob.value = null;
  pageErr.value = "";
  pageOk.value = "";
  const failed = { ...restoreFailedPaths.value };
  delete failed[row.path];
  restoreFailedPaths.value = failed;
  try {
    const parent = outputParent.value.trim();
    const started = await postDbBackupRestore({
      path: row.path,
      output_parent: parent || null,
    });
    restoreJob.value = started;
    startRestorePollTimer(started.job_id);
    await pollRestoreJobOnce(started.job_id);
  } catch (e) {
    pageErr.value = axiosErrorDetail(e);
    restoreBusy.value = false;
    stopRestorePollTimer();
  }
}

function downloadState(path: string): DownloadState {
  return downloadStates.value[path] || { status: "idle", progress: 0 };
}

function toggleAllTargets(checked: boolean) {
  if (!checked) {
    selectedTargets.value = [];
    return;
  }
  selectedTargets.value = [...targetOptions.value];
}

function onDirPicked(path: string) {
  outputParent.value = path;
  dirPickerOpen.value = false;
  void applyDirectoryAndRefresh();
}

function toggleRow(path: string, checked: boolean) {
  const next = new Set(selected.value);
  if (checked) next.add(path);
  else next.delete(path);
  selected.value = next;
}

function toggleSelectAll(checked: boolean) {
  if (!checked) {
    selected.value = new Set();
    return;
  }
  selected.value = new Set(runs.value.map((r) => r.path));
}

async function loadRuns() {
  listBusy.value = true;
  pageErr.value = "";
  try {
    const parent = outputParent.value.trim();
    const data = await fetchDbBackupRuns(parent || null);
    runs.value = data.runs ?? [];
    const valid = new Set(runs.value.map((r) => r.path));
    selected.value = new Set([...selected.value].filter((p) => valid.has(p)));
  } catch (e) {
    pageErr.value = axiosErrorDetail(e);
    runs.value = [];
  } finally {
    listBusy.value = false;
    pageReady.value = true;
  }
}

async function loadAll() {
  await loadInfo();
  try {
    overview.value = await fetchDbOverview();
    if (targetMode.value === "selected" && !selectedTargets.value.length) {
      selectedTargets.value = [...targetOptions.value];
    }
  } catch (e) {
    pageErr.value = axiosErrorDetail(e);
  }
  await loadRuns();
}

async function downloadRun(row: DbBackupRunRow) {
  if (runStatus(row) !== "completed") return;
  downloadStates.value = {
    ...downloadStates.value,
    [row.path]: { status: "downloading", progress: 0 },
  };
  pageErr.value = "";
  try {
    const blob = await downloadDbBackupRun({
      path: row.path,
      outputParent: outputParent.value.trim() || null,
      onProgress: (percent) => {
        downloadStates.value = {
          ...downloadStates.value,
          [row.path]: { status: "downloading", progress: percent },
        };
      },
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${row.name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    downloadStates.value = {
      ...downloadStates.value,
      [row.path]: { status: "done", progress: 100 },
    };
    pageOk.value = `已开始下载 ${row.name}.zip`;
  } catch (e) {
    const message = axiosErrorDetail(e);
    downloadStates.value = {
      ...downloadStates.value,
      [row.path]: { status: "failed", progress: 0, error: message },
    };
    pageErr.value = message;
  }
}

async function applyDirectoryAndRefresh() {
  pageOk.value = "";
  await loadRuns();
}

async function startBackup() {
  if (targetMode.value === "selected" && !selectedTargets.value.length) {
    pageErr.value = `请至少选择一个${backupInfo.value?.backend === "postgres" ? "表" : "集合"}`;
    return;
  }
  await runBackup();
}

async function deleteSelected() {
  const paths = [...selected.value];
  if (!paths.length) return;
  const labelText = `${paths.length} 个备份（合计约 ${formatBackupBytes(selectedBytes.value)}）`;
  if (typeof window !== "undefined") {
    const okConfirm = window.confirm(`确定删除 ${labelText}？此操作不可恢复。`);
    if (!okConfirm) return;
  }
  deleting.value = true;
  pageErr.value = "";
  pageOk.value = "";
  try {
    const parent = outputParent.value.trim();
    const result = await postDbBackupRunsDelete({
      paths,
      output_parent: parent || null,
    });
    pageOk.value = `已删除 ${result.count} 个备份目录。`;
    selected.value = new Set();
    await loadRuns();
  } catch (e) {
    pageErr.value = axiosErrorDetail(e);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void loadAll();
  void resumeActive();
  void resumeRestoreJob();
});

onUnmounted(() => {
  stopRestorePollTimer();
});
</script>

<template>
  <div class="database-backups-page console-hub-page">
    <ConsoleHubMasthead :icon="panelNavIcon">
      <template #title>
        备份管理
      </template>
      <template #lead>
        创建逻辑备份、浏览历史目录并下载或批量清理；进行中的任务不可删。
      </template>
      <template #actions>
        <RefreshIconButton
          :busy="listBusy"
          label="刷新列表"
          @click="loadRuns"
        />
      </template>
    </ConsoleHubMasthead>

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

    <ConsolePageSkeleton
      v-if="!pageReady && !runs.length"
      :panels="2"
    />

    <template v-if="pageReady || runs.length">
      <section class="database-backups-page__kpi grid-stats">
        <StatCard
          dense
          label="数据库后端"
          :value="backendLabel"
          :hint="backupInfo?.tool_name ? `工具 ${backupInfo.tool_name}` : '加载中…'"
        />
        <StatCard
          dense
          label="连接"
          :value="backupInfo ? `${backupInfo.connection.host}:${backupInfo.connection.port}` : '—'"
          :hint="backupInfo?.connection.database ?? '—'"
        />
        <StatCard
          dense
          label="备份数量"
          :value="runs.length"
          hint="当前父目录下可清理的历史备份"
        />
        <StatCard
          dense
          label="合计体积"
          :value="formatBackupBytes(totalBytes)"
          :hint="connectionHint"
        />
      </section>

      <UiCard
        tag="section"
        glass
        class="database-backups-page__panel"
      >
        <div class="panel__hd panel__hd--split database-backups-page__create-hd">
          <h2 class="panel__title">
            <ConsoleNavIcon
              class="panel__title-ico"
              name="backup"
              :size="20"
            />创建备份
          </h2>
          <div class="row-actions">
            <UiButton
              variant="primary"
              :disabled="anyJobBusy || !backupToolReady"
              :busy="backupBusy"
              @click="startBackup"
            >
              {{ backupBusy ? "备份中…" : "开始备份" }}
            </UiButton>
          </div>
        </div>
        <div class="panel__bd">
          <div
            v-if="backupInfo && !backupInfo.tool_available"
            class="alert alert--err database-backups-page__tool-alert"
          >
            <p style="margin: 0 0 8px">
              未检测到 <strong>{{ backupInfo.tool_name }}</strong>，无法从 WebUI 备份。
              <template v-if="backupInfo.tool_download_url">
                请安装
                <a
                  :href="backupInfo.tool_download_url"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ backupInfo.tool_download_label || backupInfo.tool_name }}</a>
              </template>
              <template v-else>
                请安装 {{ backupInfo.tool_download_label || backupInfo.tool_name }}
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

          <div
            v-if="backupInfo && backupInfo.restore_tool_name && !backupInfo.restore_tool_available"
            class="alert alert--warn database-backups-page__tool-alert"
          >
            未检测到 <strong>{{ backupInfo.restore_tool_name }}</strong>，历史备份可下载但无法从 WebUI 复原。
          </div>

          <div class="database-backups-page__form">
            <div class="prefs-form-field">
              <label class="prefs-form-field__label">备份父目录</label>
              <div class="database-backups-page__dir-row">
                <input
                  v-model="outputParent"
                  class="inp"
                  placeholder="留空使用默认"
                  :disabled="listBusy || deleting || backupBusy"
                >
                <UiButton
                  variant="outline"
                  :disabled="listBusy || deleting || backupBusy"
                  @click="dirPickerOpen = true"
                >
                  浏览…
                </UiButton>
                <UiButton
                  variant="outline"
                  :disabled="listBusy || deleting || backupBusy"
                  :busy="listBusy"
                  @click="applyDirectoryAndRefresh"
                >
                  {{ listBusy ? "刷新中…" : "应用目录" }}
                </UiButton>
              </div>
              <p class="prefs-form-field__hint muted">
                将在该目录下创建带时间戳的子文件夹；列表扫描同一父目录。
              </p>
            </div>
            <div class="prefs-form-field">
              <label class="prefs-form-field__label">目录后缀（可选）</label>
              <input
                v-model="label"
                class="inp"
                placeholder="例如 before_upgrade"
                :disabled="backupBusy"
              >
            </div>
            <div class="prefs-form-field">
              <label class="prefs-form-field__label">备份范围</label>
              <select
                v-model="targetMode"
                class="sel"
                :disabled="backupBusy"
              >
                <option value="all">
                  {{ backupInfo?.backend === "mongodb" ? "整库 / 预设关键集合" : "整库" }}
                </option>
                <option value="selected">
                  指定{{ backupInfo?.backend === "postgres" ? "表" : "集合" }}
                </option>
              </select>
            </div>
            <div
              v-if="backupInfo?.backend === 'mongodb' && targetMode === 'all'"
              class="prefs-form-field"
            >
              <label class="prefs-form-field__label">MongoDB 预设</label>
              <select
                v-model="scope"
                class="sel"
                :disabled="backupBusy"
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
            <div
              v-if="backupInfo?.backend === 'postgres'"
              class="prefs-form-field"
            >
              <label class="prefs-form-field__label">PostgreSQL 格式</label>
              <select
                v-model="pgFormat"
                class="sel"
                :disabled="backupBusy"
              >
                <option value="custom">custom（.dump，推荐）</option>
                <option value="plain">plain SQL（.sql）</option>
                <option value="directory">directory（目录格式）</option>
              </select>
            </div>
            <div
              v-if="targetMode === 'selected' && targetOptions.length"
              class="prefs-form-field database-backups-page__targets"
            >
              <div class="database-backups-page__targets-hd">
                <label class="prefs-form-field__label">
                  选择{{ backupInfo?.backend === "postgres" ? "表" : "集合" }}
                </label>
                <label class="database-backups-page__targets-all">
                  <input
                    type="checkbox"
                    :checked="allTargetsSelected"
                    :disabled="backupBusy"
                    @change="toggleAllTargets(($event.target as HTMLInputElement).checked)"
                  >
                  全选
                </label>
              </div>
              <BackupTargetTree
                v-model="selectedTargets"
                :options="targetOptions"
                :backend="backupInfo?.backend ?? null"
                :disabled="backupBusy"
              />
            </div>
          </div>

          <div
            v-if="backupBusy"
            class="database-backup-progress"
            role="status"
            aria-live="polite"
          >
            <div class="database-backup-progress__head">
              <span class="database-backup-progress__label">
                {{ backupProgressComplete ? "备份完成" : "备份进行中" }}
              </span>
              <span class="database-backup-progress__elapsed muted">
                已用时 {{ formatBackupElapsed(backupElapsedSec) }}
                · 已写入 {{ formatBackupBytes(backupJobSizeBytes) }}
              </span>
            </div>
            <div
              class="database-backup-progress__bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="backupProgressComplete ? 100 : undefined"
              :aria-valuetext="backupProgressComplete ? '已完成' : `已写入 ${formatBackupBytes(backupJobSizeBytes)}`"
            >
              <span
                class="database-backup-progress__fill"
                :class="{ 'database-backup-progress__fill--done': backupProgressComplete }"
              />
            </div>
            <p class="muted database-backup-progress__hint">
              {{ backupProgressHint() }}
            </p>
          </div>

          <div
            v-if="restoreBusy"
            class="database-backup-progress"
            role="status"
            aria-live="polite"
          >
            <div class="database-backup-progress__head">
              <span class="database-backup-progress__label">数据库复原进行中</span>
              <span class="database-backup-progress__elapsed muted">
                {{ restoreJob?.output_dir || "—" }}
              </span>
            </div>
            <div
              class="database-backup-progress__bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span class="database-backup-progress__fill" />
            </div>
            <p class="muted database-backup-progress__hint">
              正在将备份写回数据库，请勿关闭页面或重复发起复原。
            </p>
          </div>

          <UiCard
            v-if="backupResult"
            tag="div"
            glass
            class="database-backups-page__result"
          >
            <div class="panel__bd">
              <p style="margin: 0 0 8px">
                <strong>输出目录</strong> {{ backupResult.output_dir }}
              </p>
              <p
                v-for="(art, i) in backupResult.artifacts"
                :key="i"
                class="muted"
                style="margin: 0 0 4px; word-break: break-all"
              >
                产物：{{ art }}
              </p>
              <p
                class="muted"
                style="margin: 8px 0 0"
              >
                大小：{{ formatBackupBytes(backupResult.size_bytes) }}
              </p>
            </div>
          </UiCard>
        </div>
      </UiCard>

      <UiCard
        tag="section"
        glass
        class="database-backups-page__panel database-backups-page__panel--list"
      >
        <div class="panel__hd panel__hd--split database-backups-page__list-hd">
          <h2 class="panel__title">
            <ConsoleNavIcon
              class="panel__title-ico"
              name="list"
              :size="20"
            />历史备份
            <span
              v-if="runs.length"
              class="muted database-backups-page__list-count"
            >{{ runs.length }} 项</span>
          </h2>
          <div class="row-actions database-backups-page__hd-actions">
            <UiButton
              variant="destructive"
              class="database-backups-page__delete-btn"
              :disabled="deleting || anyJobBusy || selectedCount === 0"
              :busy="deleting"
              :aria-label="deleting ? '删除中' : `删除所选 ${selectedCount} 个备份`"
              @click="deleteSelected"
            >
              <span class="database-backups-page__delete-label">{{ deleting ? "删除中…" : "删除所选" }}</span>
              <span
                v-if="!deleting && selectedCount > 0"
                class="database-backups-page__delete-count"
              >（{{ selectedCount }}）</span>
            </UiButton>
          </div>
        </div>
        <div class="panel__bd">
          <p
            v-if="listBusy && !runs.length"
            class="muted database-backups-page__empty"
          >
            正在扫描…
          </p>
          <p
            v-else-if="!runs.length"
            class="muted database-backups-page__empty"
          >
            暂无历史备份。可在上方创建新备份。
          </p>
          <div
            v-else
            class="database-backups-page__runs"
          >
            <div class="database-backups-page__mobile-toolbar">
              <label class="database-backups-page__mobile-select-all">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  aria-label="全选"
                  :disabled="deleting"
                  @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
                >
                全选
              </label>
              <span class="muted database-backups-page__mobile-count">{{ selectedCount }} / {{ runs.length }} 已选</span>
            </div>
            <ul
              class="database-backups-page__cards"
              aria-label="备份列表"
            >
              <li
                v-for="row in runs"
                :key="'card-' + row.path"
                class="database-backups-page__card"
                :class="{ 'is-selected': selected.has(row.path) }"
              >
                <div class="database-backups-page__card-hd">
                  <input
                    type="checkbox"
                    class="database-backups-page__card-check"
                    :checked="selected.has(row.path)"
                    :aria-label="`选择 ${row.name}`"
                    :disabled="deleting"
                    @change="toggleRow(row.path, ($event.target as HTMLInputElement).checked)"
                  >
                  <div class="database-backups-page__card-main">
                    <div
                      class="database-backups-page__card-name database-backups-page__path-hover"
                      :title="row.path"
                    >
                      {{ row.name }}
                    </div>
                    <div class="database-backups-page__card-meta">
                      <span class="database-backups-page__card-backend">{{ row.backend }}</span>
                      <span class="database-backups-page__card-time">{{ formatModifiedAt(row.modified_at) }}</span>
                    </div>
                  </div>
                  <div class="database-backups-page__card-size">
                    {{ formatBackupBytes(row.size_bytes) }}
                  </div>
                </div>
                <div class="database-backups-page__card-actions">
                  <UiBadge
                    class="database-backups-page__status-badge"
                    :variant="runStatusBadgeVariant(row)"
                  >
                    {{ runStatusLabel(row) }}
                  </UiBadge>
                  <div class="database-backups-page__row-btns">
                    <UiButton
                      variant="outline"
                      class="database-backups-page__restore-btn"
                      :disabled="runStatus(row) !== 'completed' || anyJobBusy || !restoreToolReady"
                      :busy="restoreBusy && restoreJob?.output_dir === row.path"
                      @click="restoreRun(row)"
                    >
                      {{ restoreBusy && restoreJob?.output_dir === row.path ? "复原中…" : "复原" }}
                    </UiButton>
                    <UiButton
                      variant="outline"
                      class="database-backups-page__download-btn"
                      :disabled="runStatus(row) !== 'completed' || downloadState(row.path).status === 'downloading'"
                      :busy="downloadState(row.path).status === 'downloading'"
                      @click="downloadRun(row)"
                    >
                      {{ downloadState(row.path).status === "downloading" ? "下载中…" : "下载" }}
                    </UiButton>
                  </div>
                </div>
                <div
                  v-if="downloadState(row.path).status === 'downloading'"
                  class="database-backups-page__download-progress"
                >
                  <div
                    class="database-backup-progress__bar"
                    role="progressbar"
                    :aria-valuenow="downloadState(row.path).progress"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <span
                      class="database-backup-progress__fill"
                      :style="{ width: `${Math.max(downloadState(row.path).progress, 8)}%` }"
                    />
                  </div>
                </div>
                <div
                  v-if="downloadState(row.path).status === 'failed'"
                  class="database-backups-page__download-error muted"
                >
                  {{ downloadState(row.path).error }}
                </div>
                <div
                  v-if="restoreFailedPaths[row.path]"
                  class="database-backups-page__download-error muted"
                >
                  {{ restoreFailedPaths[row.path] }}
                </div>
              </li>
            </ul>
            <div class="database-backups-page__table table-wrap">
              <table class="data console-data-table">
                <thead>
                  <tr>
                    <th style="width: 40px">
                      <input
                        type="checkbox"
                        :checked="allSelected"
                        aria-label="全选"
                        :disabled="deleting"
                        @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
                      >
                    </th>
                    <th>名称</th>
                    <th>后端</th>
                    <th style="text-align: right">体积</th>
                    <th>修改时间</th>
                    <th>状态</th>
                    <th style="text-align: right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in runs"
                    :key="row.path"
                    :class="{ 'is-selected': selected.has(row.path) }"
                  >
                    <td>
                      <input
                        type="checkbox"
                        :checked="selected.has(row.path)"
                        :aria-label="`选择 ${row.name}`"
                        :disabled="deleting"
                        @change="toggleRow(row.path, ($event.target as HTMLInputElement).checked)"
                      >
                    </td>
                    <td
                      style="font-weight: 600"
                      class="database-backups-page__path-hover"
                      :title="row.path"
                    >
                      {{ row.name }}
                    </td>
                    <td class="muted">{{ row.backend }}</td>
                    <td style="text-align: right; font-variant-numeric: tabular-nums">
                      {{ formatBackupBytes(row.size_bytes) }}
                    </td>
                    <td class="muted">{{ formatModifiedAt(row.modified_at) }}</td>
                    <td>
                      <UiBadge
                        class="database-backups-page__status-badge"
                        :variant="runStatusBadgeVariant(row)"
                      >
                        {{ runStatusLabel(row) }}
                      </UiBadge>
                    </td>
                    <td style="text-align: right">
                      <div class="database-backups-page__row-btns database-backups-page__row-btns--table">
                        <UiButton
                          variant="outline"
                          class="database-backups-page__restore-btn"
                          :disabled="runStatus(row) !== 'completed' || anyJobBusy || !restoreToolReady"
                          :busy="restoreBusy && restoreJob?.output_dir === row.path"
                          @click="restoreRun(row)"
                        >
                          {{ restoreBusy && restoreJob?.output_dir === row.path ? "复原中…" : "复原" }}
                        </UiButton>
                        <UiButton
                          variant="outline"
                          class="database-backups-page__download-btn"
                          :disabled="runStatus(row) !== 'completed' || downloadState(row.path).status === 'downloading'"
                          :busy="downloadState(row.path).status === 'downloading'"
                          @click="downloadRun(row)"
                        >
                          {{ downloadState(row.path).status === "downloading" ? "下载中…" : "下载" }}
                        </UiButton>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </UiCard>
    </template>

    <BackupDirPicker
      :open="dirPickerOpen"
      :initial-path="outputParent"
      @close="dirPickerOpen = false"
      @select="onDirPicked"
    />
  </div>
</template>
