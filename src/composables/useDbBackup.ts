import { computed, onUnmounted, ref } from "vue";
import {
  fetchActiveDbBackupJob,
  fetchDbBackupInfo,
  fetchDbBackupJob,
  postDbBackup,
} from "@/api/consoleApi";
import { axiosErrorDetail } from "@/api/http";
import type { DbBackupInfo, DbBackupJobData, DbBackupResult } from "@/api/pallasTypes";

const BACKUP_POLL_MS = 1500;

export function formatBackupBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatBackupElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useDbBackup(options?: { onCompleted?: () => void | Promise<void> }) {
  const backupInfo = ref<DbBackupInfo | null>(null);
  const outputParent = ref("");
  const label = ref("");
  const scope = ref<"full" | "important">("full");
  const pgFormat = ref<"custom" | "plain" | "directory">("custom");
  const selectedPgTables = ref<string[]>([]);
  const selectedMongoCollections = ref<string[]>([]);
  const targetMode = ref<"all" | "selected">("all");
  const busy = ref(false);
  const result = ref<DbBackupResult | null>(null);
  const job = ref<DbBackupJobData | null>(null);
  const jobSizeBytes = ref(0);
  const elapsedSec = ref(0);
  const err = ref("");
  const ok = ref("");

  let elapsedTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const toolReady = computed(() => backupInfo.value?.tool_available === true);

  const scopeOptions = computed(() => {
    if (backupInfo.value?.backend === "mongodb") {
      return [
        { value: "full" as const, label: "整库（mongodump）" },
        { value: "important" as const, label: "关键集合（config / group_config / user_config 等）" },
      ];
    }
    return [{ value: "full" as const, label: "整库（pg_dump）" }];
  });

  const progressComplete = computed(() => job.value?.status === "completed");

  const backendLabel = computed(() => {
    const b = backupInfo.value?.backend;
    if (b === "postgres") return "PostgreSQL";
    if (b === "mongodb") return "MongoDB";
    return b ?? "—";
  });

  function progressHint(): string {
    const tool = backupInfo.value?.tool_name ?? "备份工具";
    const cur = job.value;
    const size = formatBackupBytes(jobSizeBytes.value);
    if (cur?.status === "queued") return `任务排队中，等待启动 ${tool}…`;
    const sec = elapsedSec.value;
    if (cur?.status === "running" && jobSizeBytes.value > 0) {
      return `正在写入备份文件，已落盘 ${size}。`;
    }
    if (sec >= 120) return `大库导出可能较久，${tool} 仍在运行，请勿关闭页面。`;
    if (sec >= 30) return `正在写入备份文件，请稍候…`;
    return `正在启动 ${tool} 并连接数据库…`;
  }

  function stopPollTimer() {
    if (pollTimer == null) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function stopProgressTimer() {
    if (elapsedTimer == null) return;
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }

  function cleanupTimers() {
    stopPollTimer();
    stopProgressTimer();
  }

  async function pollJobOnce(jobId: string) {
    const next = await fetchDbBackupJob(jobId);
    job.value = next;
    jobSizeBytes.value = next.size_bytes ?? 0;
    if (next.status === "completed" && next.result) {
      result.value = next.result;
      ok.value = next.result.message || "备份已完成。";
      busy.value = false;
      stopPollTimer();
      stopProgressTimer();
      await options?.onCompleted?.();
    } else if (next.status === "failed") {
      err.value = next.error || "备份失败。";
      busy.value = false;
      stopPollTimer();
      stopProgressTimer();
    }
  }

  function startPollTimer(jobId: string) {
    stopPollTimer();
    pollTimer = setInterval(() => {
      void pollJobOnce(jobId).catch((e) => {
        err.value = axiosErrorDetail(e);
        busy.value = false;
        cleanupTimers();
      });
    }, BACKUP_POLL_MS);
  }

  function startProgressTimer() {
    elapsedSec.value = 0;
    stopProgressTimer();
    elapsedTimer = setInterval(() => {
      elapsedSec.value += 1;
    }, 1000);
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

  async function resumeActive() {
    try {
      const active = await fetchActiveDbBackupJob();
      if (!active?.job_id) return;
      job.value = active;
      jobSizeBytes.value = active.size_bytes ?? 0;
      if (active.status === "queued" || active.status === "running") {
        if (active.job_kind === "restore") return;
        busy.value = true;
        startProgressTimer();
        startPollTimer(active.job_id);
        void pollJobOnce(active.job_id);
      }
    } catch {
      /* 忽略恢复失败 */
    }
  }

  async function runBackup() {
    busy.value = true;
    result.value = null;
    job.value = null;
    jobSizeBytes.value = 0;
    err.value = "";
    ok.value = "";
    startProgressTimer();
    try {
      const parent = outputParent.value.trim();
      const body: Parameters<typeof postDbBackup>[0] = {
        output_parent: parent || null,
        label: label.value.trim(),
        scope: scope.value,
        pg_format: pgFormat.value,
      };
      if (backupInfo.value?.backend === "postgres" && targetMode.value === "selected") {
        body.pg_tables = [...selectedPgTables.value];
      }
      if (backupInfo.value?.backend === "mongodb" && targetMode.value === "selected") {
        body.mongo_collections = [...selectedMongoCollections.value];
      }
      const started = await postDbBackup(body);
      job.value = started;
      jobSizeBytes.value = started.size_bytes ?? 0;
      startPollTimer(started.job_id);
      await pollJobOnce(started.job_id);
    } catch (e) {
      err.value = axiosErrorDetail(e);
      busy.value = false;
      cleanupTimers();
    }
  }

  onUnmounted(() => {
    cleanupTimers();
  });

  return {
    backupInfo,
    outputParent,
    label,
    scope,
    pgFormat,
    selectedPgTables,
    selectedMongoCollections,
    targetMode,
    busy,
    result,
    job,
    jobSizeBytes,
    elapsedSec,
    err,
    ok,
    toolReady,
    scopeOptions,
    progressComplete,
    backendLabel,
    progressHint,
    loadInfo,
    resumeActive,
    runBackup,
    cleanupTimers,
  };
}
