<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  fetchDbBackupInfo,
  fetchDbBackupRuns,
  postDbBackupRunsDelete,
} from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type { DbBackupInfo, DbBackupRunRow } from "@/api/pallasTypes";
import ConsolePageSkeleton from "@/components/ConsolePageSkeleton.vue";
import PanelSidebarAdd from "@/components/PanelSidebarAdd.vue";
import RefreshIconButton from "@/components/RefreshIconButton.vue";
import { usePanelNavIcon } from "@/composables/usePanelNavIcon";

const panelNavIcon = usePanelNavIcon();
const err = ref("");
const ok = ref("");
const pageReady = ref(false);
const loading = ref(false);
const deleting = ref(false);
const backupInfo = ref<DbBackupInfo | null>(null);
const outputParent = ref("");
const runs = ref<DbBackupRunRow[]>([]);
const selected = ref<Set<string>>(new Set());

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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

async function loadInfo() {
  try {
    const info = await fetchDbBackupInfo();
    backupInfo.value = info;
    if (!outputParent.value.trim()) {
      outputParent.value = info.default_output_parent;
    }
  } catch (e) {
    err.value = axiosErrorDetail(e);
  }
}

async function loadRuns() {
  loading.value = true;
  err.value = "";
  try {
    const parent = outputParent.value.trim();
    const data = await fetchDbBackupRuns(parent || null);
    runs.value = data.runs ?? [];
    const valid = new Set(runs.value.map((r) => r.path));
    selected.value = new Set([...selected.value].filter((p) => valid.has(p)));
  } catch (e) {
    err.value = axiosErrorDetail(e);
    runs.value = [];
  } finally {
    loading.value = false;
    pageReady.value = true;
  }
}

async function loadAll() {
  await loadInfo();
  await loadRuns();
}

async function deleteSelected() {
  const paths = [...selected.value];
  if (!paths.length) return;
  const label = `${paths.length} 个备份（合计约 ${formatBytes(selectedBytes.value)}）`;
  if (typeof window !== "undefined") {
    const okConfirm = window.confirm(`确定删除 ${label}？此操作不可恢复。`);
    if (!okConfirm) return;
  }
  deleting.value = true;
  err.value = "";
  ok.value = "";
  try {
    const parent = outputParent.value.trim();
    const result = await postDbBackupRunsDelete({
      paths,
      output_parent: parent || null,
    });
    ok.value = `已删除 ${result.count} 个备份目录。`;
    selected.value = new Set();
    await loadRuns();
  } catch (e) {
    err.value = axiosErrorDetail(e);
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <div class="database-backups-page">
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
        <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>备份清理
        <RefreshIconButton
          :busy="loading"
          label="刷新备份列表"
          @click="loadRuns"
        />
      </h2>
      <p class="plugins-page__hero-note muted">
        浏览并删除 Bot 机器上的历史逻辑备份目录；进行中的备份不可删除。
        <RouterLink to="/database">返回数据库页</RouterLink>
      </p>
    </div>

    <ConsolePageSkeleton
      v-if="!pageReady && !runs.length"
      :panels="1"
    />

    <div
      v-if="pageReady || runs.length"
      class="panel"
    >
      <div class="panel__hd panel__hd--split">
        <h2 class="panel__title">
          <span class="panel__title-ico" aria-hidden="true">{{ panelNavIcon }}</span>备份目录
        </h2>
        <div class="row-actions database-backups-page__hd-actions">
          <span class="friends-groups-hd-pin-wrap">
            <PanelSidebarAdd main-path="/database/backups" />
          </span>
          <button
            type="button"
            class="btn btn--danger database-backups-page__delete-btn"
            :disabled="deleting || selectedCount === 0"
            :aria-label="deleting ? '删除中' : `删除所选 ${selectedCount} 个备份`"
            @click="deleteSelected"
          >
            <span class="database-backups-page__delete-label">{{ deleting ? "删除中…" : "删除所选" }}</span>
            <span
              v-if="!deleting && selectedCount > 0"
              class="database-backups-page__delete-count"
            >（{{ selectedCount }}）</span>
          </button>
        </div>
      </div>
      <div class="panel__bd">
        <div
          class="database-backups-page__filters"
          style="display: grid; gap: 12px; max-width: 720px; margin-bottom: 16px"
        >
          <div>
            <label class="muted" style="display: block; margin-bottom: 6px">备份父目录</label>
            <input
              v-model="outputParent"
              class="inp"
              style="width: 100%"
              placeholder="留空使用默认"
              :disabled="loading || deleting"
            >
            <p class="muted" style="margin: 6px 0 0; font-size: 0.9em">
              仅列出该目录下 <code>postgres_*</code> / <code>mongodb_*</code> 子文件夹。
            </p>
          </div>
          <div class="row-actions">
            <button
              type="button"
              class="btn"
              :disabled="loading || deleting"
              @click="loadRuns"
            >
              {{ loading ? "加载中…" : "应用目录并刷新" }}
            </button>
          </div>
        </div>

        <p
          v-if="backupInfo"
          class="muted"
          style="margin: 0 0 12px"
        >
          当前后端 {{ backupInfo.backend === "postgres" ? "PostgreSQL" : "MongoDB" }}
          · 共 {{ runs.length }} 项 · 合计 {{ formatBytes(totalBytes) }}
        </p>

        <p
          v-if="loading && !runs.length"
          class="muted"
          style="margin: 0"
        >
          正在扫描备份目录…
        </p>
        <p
          v-else-if="!runs.length"
          class="muted"
          style="margin: 0"
        >
          该目录下暂无备份。可在
          <RouterLink to="/database">数据库页</RouterLink>
          发起新备份。
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
            <span class="muted database-backups-page__mobile-count">{{ runs.length }} 项</span>
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
                  <div class="database-backups-page__card-name">{{ row.name }}</div>
                  <div class="database-backups-page__card-meta">
                    <span class="database-backups-page__card-backend">{{ row.backend }}</span>
                    <span class="database-backups-page__card-time">{{ formatModifiedAt(row.modified_at) }}</span>
                  </div>
                </div>
                <div class="database-backups-page__card-size">
                  {{ formatBytes(row.size_bytes) }}
                </div>
              </div>
              <div class="database-backups-page__card-path">
                {{ row.path }}
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
                  <th>路径</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in runs"
                  :key="row.path"
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
                  <td style="font-weight: 600">{{ row.name }}</td>
                  <td class="muted">{{ row.backend }}</td>
                  <td style="text-align: right; font-variant-numeric: tabular-nums">
                    {{ formatBytes(row.size_bytes) }}
                  </td>
                  <td class="muted">{{ formatModifiedAt(row.modified_at) }}</td>
                  <td
                    class="muted"
                    style="word-break: break-all; font-size: 12px"
                  >
                    {{ row.path }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.database-backups-page__filters code {
  font-size: 0.92em;
}
.database-backups-page__hd-actions {
  flex-shrink: 0;
}
.database-backups-page__delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 5.75rem;
  padding-inline: 12px 14px;
}
.database-backups-page__delete-label {
  line-height: 1.2;
}
.database-backups-page__delete-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.92;
}

.database-backups-page__runs {
  min-width: 0;
}

.database-backups-page__mobile-toolbar {
  display: none;
}

.database-backups-page__cards {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.database-backups-page__mobile-select-all {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}

.database-backups-page__mobile-count {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 560px) {
  .database-backups-page__mobile-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--bg-elev) 92%, transparent);
  }

  .database-backups-page__cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .database-backups-page__table {
    display: none;
  }

  .database-backups-page__card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-shell);
    background: var(--bg-elev);
  }

  .database-backups-page__card.is-selected {
    border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
    background: color-mix(in srgb, var(--accent) 7%, var(--bg-elev));
  }

  .database-backups-page__card-hd {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
  }

  .database-backups-page__card-check {
    margin-top: 3px;
  }

  .database-backups-page__card-name {
    font-size: 13px;
    font-weight: 650;
    line-height: 1.35;
    word-break: break-all;
    color: var(--text);
  }

  .database-backups-page__card-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.35;
    color: var(--text-muted);
  }

  .database-backups-page__card-backend {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--control-bg) 88%, transparent);
    border: 1px solid var(--border);
    font-size: 11px;
    font-weight: 650;
    text-transform: lowercase;
  }

  .database-backups-page__card-time {
    font-variant-numeric: tabular-nums;
  }

  .database-backups-page__card-size {
    font-size: 13px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--text);
    padding-top: 1px;
  }

  .database-backups-page__card-path {
    padding-top: 8px;
    border-top: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.45;
    word-break: break-all;
    color: var(--text-muted);
  }

  .database-backups-page__filters {
    max-width: none !important;
  }
}
</style>
