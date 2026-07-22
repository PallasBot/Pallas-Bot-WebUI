import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { axiosErrorDetail } from "@/api/http";
import {
  downloadDbBackupRun,
  fetchActiveDbBackupJob,
  fetchDbBackupJob,
  fetchDbBackupRuns,
  fetchDbOverview,
  postDbBackupRestore,
  postDbBackupRunsDelete,
} from "@/api/fullConsole";
import type { DbBackupJobData, DbBackupRunRow, DbOverviewData } from "@pallas-vue/api/pallasTypes";
import BackupDirPicker from "@/components/BackupDirPicker";
import BackupTargetTree from "@/components/BackupTargetTree";
import PageHeader from "@/components/PageHeader";
import RefreshIconButton from "@/components/RefreshIconButton";
import { useDbBackup } from "@/hooks/useDbBackup";
import { formatBackupBytes, formatBackupElapsed } from "@/utils/dbBackupFormat";

type DownloadState = {
  status: "idle" | "downloading" | "done" | "failed";
  progress: number;
  error?: string;
};

type RunViewStatus = "completed" | "in_progress" | "failed";
type RunProgressKind = "backup" | "restore" | null;

const RESTORE_POLL_MS = 1500;

function isMongoOverview(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "mongodb" }> {
  return o?.backend === "mongodb";
}

function isPostgresOverview(o: DbOverviewData | null): o is Extract<DbOverviewData, { backend: "postgres" }> {
  return o?.backend === "postgres";
}

function formatModifiedAt(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw || "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function DatabaseBackupsPage() {
  const [pageErr, setPageErr] = useState("");
  const [pageOk, setPageOk] = useState("");
  const [pageReady, setPageReady] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runs, setRuns] = useState<DbBackupRunRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [overview, setOverview] = useState<DbOverviewData | null>(null);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Record<string, DownloadState>>({});
  const [restoreJob, setRestoreJob] = useState<DbBackupJobData | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreFailedPaths, setRestoreFailedPaths] = useState<Record<string, string>>({});
  const restorePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const backup = useDbBackup({
    onCompleted: async () => {
      await loadRuns();
    },
  });

  const err = pageErr || backup.err;
  const ok = pageOk || backup.ok;

  const totalBytes = useMemo(() => runs.reduce((s, r) => s + (r.size_bytes ?? 0), 0), [runs]);
  const allSelected = runs.length > 0 && runs.every((r) => selected.has(r.path));
  const selectedCount = selected.size;
  const selectedBytes = useMemo(
    () => runs.filter((r) => selected.has(r.path)).reduce((s, r) => s + (r.size_bytes ?? 0), 0),
    [runs, selected],
  );

  const connectionHint = backup.backupInfo?.connection
    ? `${backup.backupInfo.connection.host}:${backup.backupInfo.connection.port} · ${backup.backupInfo.connection.database}`
    : "—";

  const restoreToolReady = backup.backupInfo?.restore_tool_available === true;
  const restoreToolName = backup.backupInfo?.restore_tool_name ?? "复原工具";
  const anyJobBusy = backup.busy || restoreBusy;

  const pgTableOptions = isPostgresOverview(overview) ? overview.tables.map((t) => t.table) : [];
  const mongoCollectionOptions = isMongoOverview(overview) ? overview.collections.map((c) => c.name) : [];
  const targetOptions =
    backup.backupInfo?.backend === "postgres"
      ? pgTableOptions
      : backup.backupInfo?.backend === "mongodb"
        ? mongoCollectionOptions
        : [];

  const selectedTargets =
    backup.backupInfo?.backend === "postgres"
      ? backup.selectedPgTables
      : backup.backupInfo?.backend === "mongodb"
        ? backup.selectedMongoCollections
        : [];

  const setSelectedTargets = (values: string[]) => {
    if (backup.backupInfo?.backend === "postgres") backup.setSelectedPgTables(values);
    else if (backup.backupInfo?.backend === "mongodb") backup.setSelectedMongoCollections(values);
  };

  const allTargetsSelected =
    targetOptions.length > 0 && targetOptions.every((name) => selectedTargets.includes(name));

  const stopRestorePollTimer = useCallback(() => {
    if (restorePollRef.current != null) {
      clearInterval(restorePollRef.current);
      restorePollRef.current = null;
    }
  }, []);

  const loadRuns = useCallback(async () => {
    setListBusy(true);
    setPageErr("");
    try {
      const parent = backup.outputParent.trim();
      const data = await fetchDbBackupRuns(parent || null);
      const nextRuns = data.runs ?? [];
      setRuns(nextRuns);
      const valid = new Set(nextRuns.map((r) => r.path));
      setSelected((prev) => new Set([...prev].filter((p) => valid.has(p))));
    } catch (e) {
      setPageErr(axiosErrorDetail(e));
      setRuns([]);
    } finally {
      setListBusy(false);
      setPageReady(true);
    }
  }, [backup.outputParent]);

  const loadAll = useCallback(async () => {
    await backup.loadInfo();
    try {
      const ov = await fetchDbOverview();
      setOverview(ov);
      if (backup.targetMode === "selected") {
        const opts =
          backup.backupInfo?.backend === "postgres"
            ? ov && isPostgresOverview(ov)
              ? ov.tables.map((t) => t.table)
              : []
            : ov && isMongoOverview(ov)
              ? ov.collections.map((c) => c.name)
              : [];
        if (!selectedTargets.length && opts.length) setSelectedTargets([...opts]);
      }
    } catch (e) {
      setPageErr(axiosErrorDetail(e));
    }
    await loadRuns();
  }, [backup, loadRuns, selectedTargets.length]);

  useEffect(() => {
    void loadAll();
    void backup.resumeActive();
    void resumeRestoreJob();
    return () => stopRestorePollTimer();
  }, []);

  async function pollRestoreJobOnce(jobId: string) {
    const next = await fetchDbBackupJob(jobId);
    setRestoreJob(next);
    if (next.status === "completed") {
      setRestoreBusy(false);
      stopRestorePollTimer();
      setPageOk(next.result?.message || "数据库复原已完成。");
      setRestoreFailedPaths((prev) => {
        const failed = { ...prev };
        delete failed[next.output_dir];
        return failed;
      });
    } else if (next.status === "failed") {
      setRestoreBusy(false);
      stopRestorePollTimer();
      const message = next.error || "复原失败。";
      setRestoreFailedPaths((prev) => ({ ...prev, [next.output_dir]: message }));
      setPageErr(message);
    }
  }

  function startRestorePollTimer(jobId: string) {
    stopRestorePollTimer();
    restorePollRef.current = setInterval(() => {
      void pollRestoreJobOnce(jobId).catch((e) => {
        setPageErr(axiosErrorDetail(e));
        setRestoreBusy(false);
        stopRestorePollTimer();
      });
    }, RESTORE_POLL_MS);
  }

  async function resumeRestoreJob() {
    try {
      const active = await fetchActiveDbBackupJob();
      if (!active?.job_id || active.job_kind !== "restore") return;
      setRestoreJob(active);
      if (active.status === "queued" || active.status === "running") {
        setRestoreBusy(true);
        startRestorePollTimer(active.job_id);
        void pollRestoreJobOnce(active.job_id);
      }
    } catch {
      /* ignore */
    }
  }

  function runProgressKind(row: DbBackupRunRow): RunProgressKind {
    const path = row.path.trim();
    const backupDir = backup.busy ? backup.job?.output_dir?.trim() : "";
    if (backupDir && path === backupDir) return "backup";
    const restoreDir = restoreBusy ? restoreJob?.output_dir?.trim() : "";
    if (restoreDir && path === restoreDir) return "restore";
    return null;
  }

  function runStatus(row: DbBackupRunRow): RunViewStatus {
    if (runProgressKind(row)) return "in_progress";
    if (restoreFailedPaths[row.path]) return "failed";
    return "completed";
  }

  function runStatusLabel(row: DbBackupRunRow): string {
    const status = runStatus(row);
    if (status === "in_progress") return runProgressKind(row) === "restore" ? "复原中" : "备份中";
    if (status === "failed") return "失败";
    return "已完成";
  }

  function runStatusBadgeVariant(row: DbBackupRunRow): string {
    const status = runStatus(row);
    if (status === "completed") return "badge--ok";
    if (status === "failed") return "badge--warn";
    return "badge";
  }

  function downloadState(path: string): DownloadState {
    return downloadStates[path] || { status: "idle", progress: 0 };
  }

  function toggleRow(path: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(runs.map((r) => r.path)));
  }

  function toggleAllTargets(checked: boolean) {
    if (!checked) setSelectedTargets([]);
    else setSelectedTargets([...targetOptions]);
  }

  async function applyDirectoryAndRefresh() {
    setPageOk("");
    await loadRuns();
  }

  async function startBackup() {
    if (backup.targetMode === "selected" && !selectedTargets.length) {
      setPageErr(`请至少选择一个${backup.backupInfo?.backend === "postgres" ? "表" : "集合"}`);
      return;
    }
    setPageErr("");
    await backup.runBackup();
  }

  async function deleteSelected() {
    const paths = [...selected];
    if (!paths.length) return;
    if (!window.confirm(`确定删除 ${paths.length} 个备份（合计约 ${formatBackupBytes(selectedBytes)}）？此操作不可恢复。`)) return;
    setDeleting(true);
    setPageErr("");
    setPageOk("");
    try {
      const parent = backup.outputParent.trim();
      const result = await postDbBackupRunsDelete({ paths, output_parent: parent || null });
      setPageOk(`已删除 ${result.count} 个备份目录。`);
      setSelected(new Set());
      await loadRuns();
    } catch (e) {
      setPageErr(axiosErrorDetail(e));
    } finally {
      setDeleting(false);
    }
  }

  async function downloadRun(row: DbBackupRunRow) {
    if (runStatus(row) !== "completed") return;
    setDownloadStates((s) => ({ ...s, [row.path]: { status: "downloading", progress: 0 } }));
    setPageErr("");
    try {
      const blob = await downloadDbBackupRun({
        path: row.path,
        outputParent: backup.outputParent.trim() || null,
        onProgress: (percent) => {
          setDownloadStates((s) => ({ ...s, [row.path]: { status: "downloading", progress: percent } }));
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
      setDownloadStates((s) => ({ ...s, [row.path]: { status: "done", progress: 100 } }));
      setPageOk(`已开始下载 ${row.name}.zip`);
    } catch (e) {
      const message = axiosErrorDetail(e);
      setDownloadStates((s) => ({ ...s, [row.path]: { status: "failed", progress: 0, error: message } }));
      setPageErr(message);
    }
  }

  async function restoreRun(row: DbBackupRunRow) {
    if (runStatus(row) !== "completed") return;
    if (!restoreToolReady) {
      setPageErr(`未检测到 ${restoreToolName}，无法从 WebUI 复原。`);
      return;
    }
    if (!window.confirm(`确定用备份「${row.name}」覆盖当前数据库？此操作不可撤销，进行中的备份/复原任务期间请勿重复发起。`)) return;
    setRestoreBusy(true);
    setRestoreJob(null);
    setPageErr("");
    setPageOk("");
    setRestoreFailedPaths((prev) => {
      const failed = { ...prev };
      delete failed[row.path];
      return failed;
    });
    try {
      const parent = backup.outputParent.trim();
      const started = await postDbBackupRestore({ path: row.path, output_parent: parent || null });
      setRestoreJob(started);
      startRestorePollTimer(started.job_id);
      await pollRestoreJobOnce(started.job_id);
    } catch (e) {
      setPageErr(axiosErrorDetail(e));
      setRestoreBusy(false);
      stopRestorePollTimer();
    }
  }

  return (
    <div className="database-backups-page console-hub-page">
      {err ? <div className="alert alert--err">{err}</div> : null}
      {ok ? <div className="alert alert--ok">{ok}</div> : null}

      <PageHeader
        title="备份管理"
        description="创建逻辑备份、浏览历史目录并下载或批量清理；进行中的任务不可删。"
        actions={
          <div className="row-actions">
            <Link to="/database" className="btn">
              返回数据库
            </Link>
            <RefreshIconButton embedded busy={listBusy} label="刷新列表" onClick={() => void loadRuns()} />
          </div>
        }
      />

      {pageReady || runs.length ? (
        <>
          <section className="database-backups-page__kpi home-kpi-bar">
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">数据库后端</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{backup.backendLabel}</span>
                <span className="database-page__kpi-hint muted">
                  {backup.backupInfo?.tool_name ? `工具 ${backup.backupInfo.tool_name}` : "加载中…"}
                </span>
              </div>
            </div>
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">连接</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">
                  {backup.backupInfo
                    ? `${backup.backupInfo.connection.host}:${backup.backupInfo.connection.port}`
                    : "—"}
                </span>
                <span className="database-page__kpi-hint muted">{backup.backupInfo?.connection.database ?? "—"}</span>
              </div>
            </div>
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">备份数量</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{runs.length}</span>
                <span className="database-page__kpi-hint muted">当前父目录下可清理的历史备份</span>
              </div>
            </div>
            <div className="metric-tile">
              <div className="metric-tile__head">
                <span className="metric-tile__label">合计体积</span>
              </div>
              <div className="metric-tile__value-slot">
                <span className="metric-tile__value metric-tile__value--inline">{formatBackupBytes(totalBytes)}</span>
                <span className="database-page__kpi-hint muted" title={connectionHint}>
                  {connectionHint}
                </span>
              </div>
            </div>
          </section>

          <section className="panel database-backups-page__panel">
            <div className="panel__hd panel__hd--split database-backups-page__create-hd">
              <h2 className="panel__title">创建备份</h2>
              <div className="row-actions database-backups-page__hd-actions">
                <span className="friends-groups-hd-pin-wrap" />
                <button type="button" className="btn btn--primary" disabled={anyJobBusy || !backup.toolReady} onClick={() => void startBackup()}>
                  {backup.busy ? "备份中…" : "开始备份"}
                </button>
              </div>
            </div>
            <div className="panel__bd">
              {backup.backupInfo && !backup.backupInfo.tool_available ? (
                <div className="alert alert--err database-backups-page__tool-alert">
                  <p style={{ margin: "0 0 8px" }}>
                    未检测到 <strong>{backup.backupInfo.tool_name}</strong>，无法从 WebUI 备份。
                    {backup.backupInfo.tool_download_url ? (
                      <>
                        {" "}
                        请安装{" "}
                        <a href={backup.backupInfo.tool_download_url} target="_blank" rel="noopener noreferrer">
                          {backup.backupInfo.tool_download_label || backup.backupInfo.tool_name}
                        </a>
                      </>
                    ) : (
                      <> 请安装 {backup.backupInfo.tool_download_label || backup.backupInfo.tool_name}</>
                    )}
                    并加入 PATH。
                  </p>
                  {backup.backupInfo.tool_install_hint ? (
                    <p className="muted" style={{ margin: 0, fontSize: "0.92em" }}>
                      {backup.backupInfo.tool_install_hint}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {backup.backupInfo?.restore_tool_name && !backup.backupInfo.restore_tool_available ? (
                <div className="alert alert--warn database-backups-page__tool-alert">
                  未检测到 <strong>{backup.backupInfo.restore_tool_name}</strong>，历史备份可下载但无法从 WebUI 复原。
                </div>
              ) : null}

              <div className="database-backups-page__form">
                <div className="prefs-form-field">
                  <label className="prefs-form-field__label">备份父目录</label>
                  <div className="database-backups-page__dir-row">
                    <input
                      className="inp"
                      placeholder="留空使用默认"
                      value={backup.outputParent}
                      disabled={listBusy || deleting || backup.busy}
                      onChange={(e) => backup.setOutputParent(e.target.value)}
                    />
                    <button type="button" className="btn" disabled={listBusy || deleting || backup.busy} onClick={() => setDirPickerOpen(true)}>
                      浏览…
                    </button>
                    <button type="button" className="btn" disabled={listBusy || deleting || backup.busy} onClick={() => void applyDirectoryAndRefresh()}>
                      {listBusy ? "刷新中…" : "应用目录"}
                    </button>
                  </div>
                  <p className="prefs-form-field__hint muted">将在该目录下创建带时间戳的子文件夹；列表扫描同一父目录。</p>
                </div>
                <div className="prefs-form-field">
                  <label className="prefs-form-field__label">目录后缀（可选）</label>
                  <input className="inp" placeholder="例如 before_upgrade" value={backup.label} disabled={backup.busy} onChange={(e) => backup.setLabel(e.target.value)} />
                </div>
                <div className="prefs-form-field">
                  <label className="prefs-form-field__label">备份范围</label>
                  <select className="sel" value={backup.targetMode} disabled={backup.busy} onChange={(e) => backup.setTargetMode(e.target.value as "all" | "selected")}>
                    <option value="all">
                      {backup.backupInfo?.backend === "mongodb" ? "整库 / 预设关键集合" : "整库"}
                    </option>
                    <option value="selected">指定{backup.backupInfo?.backend === "postgres" ? "表" : "集合"}</option>
                  </select>
                </div>
                {backup.backupInfo?.backend === "mongodb" && backup.targetMode === "all" ? (
                  <div className="prefs-form-field">
                    <label className="prefs-form-field__label">MongoDB 预设</label>
                    <select className="sel" value={backup.scope} disabled={backup.busy} onChange={(e) => backup.setScope(e.target.value as "full" | "important")}>
                      {backup.scopeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {backup.backupInfo?.backend === "postgres" ? (
                  <div className="prefs-form-field">
                    <label className="prefs-form-field__label">PostgreSQL 格式</label>
                    <select className="sel" value={backup.pgFormat} disabled={backup.busy} onChange={(e) => backup.setPgFormat(e.target.value as "custom" | "plain" | "directory")}>
                      <option value="custom">custom（.dump，推荐）</option>
                      <option value="plain">plain SQL（.sql）</option>
                      <option value="directory">directory（目录格式）</option>
                    </select>
                  </div>
                ) : null}
                {backup.targetMode === "selected" && targetOptions.length ? (
                  <div className="prefs-form-field database-backups-page__targets">
                    <div className="database-backups-page__targets-hd">
                      <label className="prefs-form-field__label">
                        选择{backup.backupInfo?.backend === "postgres" ? "表" : "集合"}
                      </label>
                      <label className="database-backups-page__targets-all">
                        <input type="checkbox" checked={allTargetsSelected} disabled={backup.busy} onChange={(e) => toggleAllTargets(e.target.checked)} />
                        全选
                      </label>
                    </div>
                    <BackupTargetTree
                      value={selectedTargets}
                      options={targetOptions}
                      backend={backup.backupInfo?.backend ?? null}
                      disabled={backup.busy}
                      onChange={setSelectedTargets}
                    />
                  </div>
                ) : null}
              </div>

              {backup.busy ? (
                <div className="database-backup-progress" role="status" aria-live="polite">
                  <div className="database-backup-progress__head">
                    <span className="database-backup-progress__label">{backup.progressComplete ? "备份完成" : "备份进行中"}</span>
                    <span className="database-backup-progress__elapsed muted">
                      已用时 {formatBackupElapsed(backup.elapsedSec)} · 已写入 {formatBackupBytes(backup.jobSizeBytes)}
                    </span>
                  </div>
                  <div className="database-backup-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
                    <span className={`database-backup-progress__fill${backup.progressComplete ? " database-backup-progress__fill--done" : ""}`} />
                  </div>
                  <p className="muted database-backup-progress__hint">{backup.progressHint()}</p>
                </div>
              ) : null}

              {restoreBusy ? (
                <div className="database-backup-progress" role="status" aria-live="polite">
                  <div className="database-backup-progress__head">
                    <span className="database-backup-progress__label">数据库复原进行中</span>
                    <span className="database-backup-progress__elapsed muted">{restoreJob?.output_dir || "—"}</span>
                  </div>
                  <div className="database-backup-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
                    <span className="database-backup-progress__fill" />
                  </div>
                  <p className="muted database-backup-progress__hint">正在将备份写回数据库，请勿关闭页面或重复发起复原。</p>
                </div>
              ) : null}

              {backup.result ? (
                <div className="database-backups-page__result">
                  <p style={{ margin: "0 0 8px" }}>
                    <strong>输出目录</strong> {backup.result.output_dir}
                  </p>
                  {backup.result.artifacts.map((art, i) => (
                    <p key={i} className="muted" style={{ margin: "0 0 4px", wordBreak: "break-all" }}>
                      产物：{art}
                    </p>
                  ))}
                  <p className="muted" style={{ margin: "8px 0 0" }}>
                    大小：{formatBackupBytes(backup.result.size_bytes)}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel database-backups-page__panel database-backups-page__panel--list">
            <div className="panel__hd panel__hd--split database-backups-page__list-hd">
              <h2 className="panel__title">
                历史备份
                {runs.length ? <span className="muted database-backups-page__list-count">{runs.length} 项</span> : null}
              </h2>
              <div className="row-actions database-backups-page__hd-actions">
                <span className="friends-groups-hd-pin-wrap" />
                <button
                  type="button"
                  className="btn btn--danger database-backups-page__delete-btn"
                  disabled={deleting || anyJobBusy || selectedCount === 0}
                  aria-label={deleting ? "删除中" : `删除所选 ${selectedCount} 个备份`}
                  onClick={() => void deleteSelected()}
                >
                  <span className="database-backups-page__delete-label">{deleting ? "删除中…" : "删除所选"}</span>
                  {!deleting && selectedCount > 0 ? (
                    <span className="database-backups-page__delete-count">（{selectedCount}）</span>
                  ) : null}
                </button>
              </div>
            </div>
            <div className="panel__bd">
              {listBusy && !runs.length ? (
                <p className="muted database-backups-page__empty">正在扫描…</p>
              ) : !runs.length ? (
                <p className="muted database-backups-page__empty">暂无历史备份。可在上方创建新备份。</p>
              ) : (
                <div className="database-backups-page__runs">
                  <div className="database-backups-page__mobile-toolbar">
                    <label className="database-backups-page__mobile-select-all">
                      <input type="checkbox" checked={allSelected} aria-label="全选" disabled={deleting} onChange={(e) => toggleSelectAll(e.target.checked)} />
                      全选
                    </label>
                    <span className="muted database-backups-page__mobile-count">
                      {selectedCount} / {runs.length} 已选
                    </span>
                  </div>
                  <ul className="database-backups-page__cards" aria-label="备份列表">
                    {runs.map((row) => (
                      <li key={`card-${row.path}`} className={`database-backups-page__card${selected.has(row.path) ? " is-selected" : ""}`}>
                        <div className="database-backups-page__card-hd">
                          <input
                            type="checkbox"
                            className="database-backups-page__card-check"
                            checked={selected.has(row.path)}
                            aria-label={`选择 ${row.name}`}
                            disabled={deleting}
                            onChange={(e) => toggleRow(row.path, e.target.checked)}
                          />
                          <div className="database-backups-page__card-main">
                            <div className="database-backups-page__card-name database-backups-page__path-hover" title={row.path}>
                              {row.name}
                            </div>
                            <div className="database-backups-page__card-meta">
                              <span className="database-backups-page__card-backend">{row.backend}</span>
                              <span className="database-backups-page__card-time">{formatModifiedAt(row.modified_at)}</span>
                            </div>
                          </div>
                          <div className="database-backups-page__card-size">{formatBackupBytes(row.size_bytes)}</div>
                        </div>
                        <div className="database-backups-page__card-actions">
                          <span className={`badge ${runStatusBadgeVariant(row)} database-backups-page__status-badge`}>{runStatusLabel(row)}</span>
                          <div className="database-backups-page__row-btns">
                            <button type="button" className="btn database-backups-page__restore-btn" disabled={runStatus(row) !== "completed" || anyJobBusy || !restoreToolReady} onClick={() => void restoreRun(row)}>
                              {restoreBusy && restoreJob?.output_dir === row.path ? "复原中…" : "复原"}
                            </button>
                            <button type="button" className="btn database-backups-page__download-btn" disabled={runStatus(row) !== "completed" || downloadState(row.path).status === "downloading"} onClick={() => void downloadRun(row)}>
                              {downloadState(row.path).status === "downloading" ? "下载中…" : "下载"}
                            </button>
                          </div>
                        </div>
                        {downloadState(row.path).status === "downloading" ? (
                          <div className="database-backups-page__download-progress">
                            <div className="database-backup-progress__bar" role="progressbar" aria-valuenow={downloadState(row.path).progress} aria-valuemin={0} aria-valuemax={100}>
                              <span className="database-backup-progress__fill" style={{ width: `${Math.max(downloadState(row.path).progress, 8)}%` }} />
                            </div>
                          </div>
                        ) : null}
                        {downloadState(row.path).status === "failed" ? (
                          <div className="database-backups-page__download-error muted">{downloadState(row.path).error}</div>
                        ) : null}
                        {restoreFailedPaths[row.path] ? (
                          <div className="database-backups-page__download-error muted">{restoreFailedPaths[row.path]}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="database-backups-page__table table-wrap">
                    <table className="data console-data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>
                            <input type="checkbox" checked={allSelected} aria-label="全选" disabled={deleting} onChange={(e) => toggleSelectAll(e.target.checked)} />
                          </th>
                          <th>名称</th>
                          <th>后端</th>
                          <th style={{ textAlign: "right" }}>体积</th>
                          <th>修改时间</th>
                          <th>状态</th>
                          <th style={{ textAlign: "right" }}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((row) => (
                          <tr key={row.path} className={selected.has(row.path) ? "is-selected" : undefined}>
                            <td>
                              <input type="checkbox" checked={selected.has(row.path)} aria-label={`选择 ${row.name}`} disabled={deleting} onChange={(e) => toggleRow(row.path, e.target.checked)} />
                            </td>
                            <td style={{ fontWeight: 600 }} className="database-backups-page__path-hover" title={row.path}>
                              {row.name}
                            </td>
                            <td className="muted">{row.backend}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatBackupBytes(row.size_bytes)}</td>
                            <td className="muted">{formatModifiedAt(row.modified_at)}</td>
                            <td>
                              <span className={`badge ${runStatusBadgeVariant(row)} database-backups-page__status-badge`}>{runStatusLabel(row)}</span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <div className="database-backups-page__row-btns database-backups-page__row-btns--table">
                                <button type="button" className="btn database-backups-page__restore-btn" disabled={runStatus(row) !== "completed" || anyJobBusy || !restoreToolReady} onClick={() => void restoreRun(row)}>
                                  {restoreBusy && restoreJob?.output_dir === row.path ? "复原中…" : "复原"}
                                </button>
                                <button type="button" className="btn database-backups-page__download-btn" disabled={runStatus(row) !== "completed" || downloadState(row.path).status === "downloading"} onClick={() => void downloadRun(row)}>
                                  {downloadState(row.path).status === "downloading" ? "下载中…" : "下载"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      <BackupDirPicker
        open={dirPickerOpen}
        initialPath={backup.outputParent}
        onClose={() => setDirPickerOpen(false)}
        onSelect={(path) => {
          backup.setOutputParent(path);
          setDirPickerOpen(false);
          void applyDirectoryAndRefresh();
        }}
      />
    </div>
  );
}
