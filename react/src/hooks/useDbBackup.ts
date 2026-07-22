import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { axiosErrorDetail } from "@/api/http";
import {
  fetchActiveDbBackupJob,
  fetchDbBackupInfo,
  fetchDbBackupJob,
  postDbBackup,
} from "@/api/fullConsole";
import type { DbBackupInfo, DbBackupJobData, DbBackupResult } from "@pallas-vue/api/pallasTypes";
import { formatBackupBytes } from "@/utils/dbBackupFormat";

const BACKUP_POLL_MS = 1500;

export function useDbBackup(options?: { onCompleted?: () => void | Promise<void> }) {
  const [backupInfo, setBackupInfo] = useState<DbBackupInfo | null>(null);
  const [outputParent, setOutputParent] = useState("");
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"full" | "important">("full");
  const [pgFormat, setPgFormat] = useState<"custom" | "plain" | "directory">("custom");
  const [selectedPgTables, setSelectedPgTables] = useState<string[]>([]);
  const [selectedMongoCollections, setSelectedMongoCollections] = useState<string[]>([]);
  const [targetMode, setTargetMode] = useState<"all" | "selected">("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DbBackupResult | null>(null);
  const [job, setJob] = useState<DbBackupJobData | null>(null);
  const [jobSizeBytes, setJobSizeBytes] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toolReady = backupInfo?.tool_available === true;
  const progressComplete = job?.status === "completed";

  const scopeOptions = useMemo(() => {
    if (backupInfo?.backend === "mongodb") {
      return [
        { value: "full" as const, label: "整库（mongodump）" },
        { value: "important" as const, label: "关键集合（config / group_config / user_config 等）" },
      ];
    }
    return [{ value: "full" as const, label: "整库（pg_dump）" }];
  }, [backupInfo?.backend]);

  const backendLabel = useMemo(() => {
    const b = backupInfo?.backend;
    if (b === "postgres") return "PostgreSQL";
    if (b === "mongodb") return "MongoDB";
    return b ?? "—";
  }, [backupInfo?.backend]);

  const cleanupTimers = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current != null) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const progressHint = useCallback((): string => {
    const tool = backupInfo?.tool_name ?? "备份工具";
    const cur = job;
    const size = formatBackupBytes(jobSizeBytes);
    if (cur?.status === "queued") return `任务排队中，等待启动 ${tool}…`;
    const sec = elapsedSec;
    if (cur?.status === "running" && jobSizeBytes > 0) {
      return `正在写入备份文件，已落盘 ${size}。`;
    }
    if (sec >= 120) return `大库导出可能较久，${tool} 仍在运行，请勿关闭页面。`;
    if (sec >= 30) return "正在写入备份文件，请稍候…";
    return `正在启动 ${tool} 并连接数据库…`;
  }, [backupInfo?.tool_name, elapsedSec, job, jobSizeBytes]);

  const pollJobOnce = useCallback(
    async (jobId: string) => {
      const next = await fetchDbBackupJob(jobId);
      setJob(next);
      setJobSizeBytes(next.size_bytes ?? 0);
      if (next.status === "completed" && next.result) {
        setResult(next.result);
        setOk(next.result.message || "备份已完成。");
        setBusy(false);
        cleanupTimers();
        await options?.onCompleted?.();
      } else if (next.status === "failed") {
        setErr(next.error || "备份失败。");
        setBusy(false);
        cleanupTimers();
      }
    },
    [cleanupTimers, options],
  );

  const startPollTimer = useCallback(
    (jobId: string) => {
      if (pollTimerRef.current != null) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        void pollJobOnce(jobId).catch((e) => {
          setErr(axiosErrorDetail(e));
          setBusy(false);
          cleanupTimers();
        });
      }, BACKUP_POLL_MS);
    },
    [cleanupTimers, pollJobOnce],
  );

  const startProgressTimer = useCallback(() => {
    setElapsedSec(0);
    if (elapsedTimerRef.current != null) clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
  }, []);

  const loadInfo = useCallback(async () => {
    try {
      const info = await fetchDbBackupInfo();
      setBackupInfo(info);
      setOutputParent((prev) => prev.trim() || info.default_output_parent || "");
    } catch (e) {
      setErr(axiosErrorDetail(e));
    }
  }, []);

  const resumeActive = useCallback(async () => {
    try {
      const active = await fetchActiveDbBackupJob();
      if (!active?.job_id) return;
      setJob(active);
      setJobSizeBytes(active.size_bytes ?? 0);
      if (active.status === "queued" || active.status === "running") {
        if (active.job_kind === "restore") return;
        setBusy(true);
        startProgressTimer();
        startPollTimer(active.job_id);
        void pollJobOnce(active.job_id);
      }
    } catch {
      /* ignore */
    }
  }, [pollJobOnce, startPollTimer, startProgressTimer]);

  const runBackup = useCallback(async () => {
    setBusy(true);
    setResult(null);
    setJob(null);
    setJobSizeBytes(0);
    setErr("");
    setOk("");
    startProgressTimer();
    try {
      const parent = outputParent.trim();
      const body: Parameters<typeof postDbBackup>[0] = {
        output_parent: parent || null,
        label: label.trim(),
        scope,
        pg_format: pgFormat,
      };
      if (backupInfo?.backend === "postgres" && targetMode === "selected") {
        body.pg_tables = [...selectedPgTables];
      }
      if (backupInfo?.backend === "mongodb" && targetMode === "selected") {
        body.mongo_collections = [...selectedMongoCollections];
      }
      const started = await postDbBackup(body);
      setJob(started);
      setJobSizeBytes(started.size_bytes ?? 0);
      startPollTimer(started.job_id);
      await pollJobOnce(started.job_id);
    } catch (e) {
      setErr(axiosErrorDetail(e));
      setBusy(false);
      cleanupTimers();
    }
  }, [
    backupInfo?.backend,
    cleanupTimers,
    label,
    outputParent,
    pgFormat,
    pollJobOnce,
    scope,
    selectedMongoCollections,
    selectedPgTables,
    startPollTimer,
    startProgressTimer,
    targetMode,
  ]);

  useEffect(() => () => cleanupTimers(), [cleanupTimers]);

  return {
    backupInfo,
    outputParent,
    setOutputParent,
    label,
    setLabel,
    scope,
    setScope,
    pgFormat,
    setPgFormat,
    selectedPgTables,
    setSelectedPgTables,
    selectedMongoCollections,
    setSelectedMongoCollections,
    targetMode,
    setTargetMode,
    busy,
    result,
    job,
    jobSizeBytes,
    elapsedSec,
    err,
    setErr,
    ok,
    setOk,
    toolReady,
    scopeOptions,
    progressComplete,
    backendLabel,
    progressHint,
    loadInfo,
    resumeActive,
    runBackup,
  };
}
