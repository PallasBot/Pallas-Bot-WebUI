import { useEffect, useRef, useState } from "react";
import {
  protocolApiErrorMessage,
  protocolFetchSnowlumaRuntimeImageSwitchJob,
  protocolStartSnowlumaRuntimeImageSwitch,
  protocolStreamSnowlumaRuntimeImageSwitchJob,
  type SnowlumaRuntimeImageSwitchJob,
  type SnowlumaRuntimeImageSwitchMode,
} from "@/api/protocol";
import ConsoleConfirmModal from "@/components/ConsoleConfirmModal";
import ProtocolDockerImageSelect from "@/components/protocol/ProtocolDockerImageSelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pushConsoleToast } from "@/utils/consoleToast";

type Props = {
  open: boolean;
  mountUrl: string | null;
  runtimeCount: number;
  onClose: () => void;
  onFinished: () => void;
  onBusyChange: (busy: boolean) => void;
};

function isRunning(job: SnowlumaRuntimeImageSwitchJob | null): boolean {
  return job?.status === "running" || job?.status === "pending";
}

export default function ProtocolRuntimeImageSwitchDialog({
  open,
  mountUrl,
  runtimeCount,
  onClose,
  onFinished,
  onBusyChange,
}: Props) {
  const [image, setImage] = useState("");
  const [mode, setMode] = useState<SnowlumaRuntimeImageSwitchMode>("rebuild_all");
  const [job, setJob] = useState<SnowlumaRuntimeImageSwitchJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const completedJobRef = useRef<string | null>(null);
  const statusErrorJobRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const busy = starting || isRunning(job);
  const hasResults = Array.isArray(job?.results);
  const completed = job?.results?.length ?? 0;
  const total = runtimeCount;
  const terminalCompletedWithoutResults = job?.status === "completed" && !hasResults;
  const progressCompleted = terminalCompletedWithoutResults ? total : completed;
  const progressLabel = terminalCompletedWithoutResults
    ? `${total}/${total}`
    : !isRunning(job) && !hasResults
      ? "完成状态未知"
      : `${completed}/${total}`;
  const failed = (job?.results ?? []).filter((result) => result.error);
  const nextStartCount = (job?.results ?? []).filter(
    (result) => result.config_saved && !result.was_running && !result.error,
  ).length;

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setImage("");
      setMode("rebuild_all");
      setJob(null);
      setStarting(false);
      setConfirmOpen(false);
      completedJobRef.current = null;
      statusErrorJobRef.current = null;
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!mountUrl || !job?.job_id || !isRunning(job)) return;
    const jobId = job.job_id;
    let disposed = false;
    let eventSource: EventSource | null = null;
    let fallbackTimer: number | null = null;
    let inactivityTimer: number | null = null;
    let polling = false;

    const clearFallback = () => {
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      fallbackTimer = null;
      polling = false;
    };
    const clearInactivity = () => {
      if (inactivityTimer != null) window.clearTimeout(inactivityTimer);
      inactivityTimer = null;
    };
    const finish = (next: SnowlumaRuntimeImageSwitchJob) => {
      if (disposed || completedJobRef.current === jobId) return;
      completedJobRef.current = jobId;
      clearFallback();
      clearInactivity();
      eventSource?.close();
      eventSource = null;
      onFinished();
      pushConsoleToast(
        next.status === "completed" ? "批量镜像切换完成" : next.message || "批量镜像切换未完成",
        next.status === "completed" ? "ok" : "err",
      );
    };
    const apply = (next: SnowlumaRuntimeImageSwitchJob, fromSse = false) => {
      if (disposed) return;
      setJob(next);
      if (fromSse) clearFallback();
      if (!isRunning(next)) finish(next);
    };
    const startFallback = () => {
      if (disposed || polling) return;
      polling = true;
      eventSource?.close();
      eventSource = null;
      const poll = async () => {
        if (disposed || completedJobRef.current === jobId) return;
        try {
          const next = await protocolFetchSnowlumaRuntimeImageSwitchJob(mountUrl, jobId);
          apply(next);
          if (isRunning(next) && !disposed) fallbackTimer = window.setTimeout(() => void poll(), 900);
        } catch (error) {
          if (!disposed) {
            if (statusErrorJobRef.current !== jobId) {
              statusErrorJobRef.current = jobId;
              pushConsoleToast(protocolApiErrorMessage(error, "无法读取批量镜像切换任务状态"), "err");
            }
            fallbackTimer = window.setTimeout(() => void poll(), 2_000);
          }
        }
      };
      void poll();
    };
    const armInactivityFallback = () => {
      clearInactivity();
      inactivityTimer = window.setTimeout(startFallback, 5_000);
    };
    const receiveSse = (event: Event) => {
      try {
        apply(JSON.parse((event as MessageEvent).data) as SnowlumaRuntimeImageSwitchJob, true);
        armInactivityFallback();
      } catch {
        // Ignore malformed events and let the inactivity timeout enable polling.
      }
    };

    try {
      eventSource = protocolStreamSnowlumaRuntimeImageSwitchJob(mountUrl, jobId);
      eventSource.addEventListener("snapshot", receiveSse);
      eventSource.addEventListener("progress", receiveSse);
      eventSource.onerror = startFallback;
      armInactivityFallback();
    } catch {
      startFallback();
    }

    return () => {
      disposed = true;
      clearFallback();
      clearInactivity();
      eventSource?.close();
    };
  }, [job?.job_id, mountUrl, onFinished]);

  async function start() {
    if (!mountUrl || !image.trim()) return;
    setStarting(true);
    try {
      const response = await protocolStartSnowlumaRuntimeImageSwitch(mountUrl, {
        image: image.trim(),
        apply_mode: mode,
      });
      const nextJob = { ...response.job, job_id: response.job.job_id ?? response.job_id };
      completedJobRef.current = null;
      setJob(nextJob);
      if (!isRunning(nextJob)) {
        completedJobRef.current = nextJob.job_id ?? "immediate";
        onFinished();
        pushConsoleToast(
          nextJob.status === "completed" ? "批量镜像切换完成" : nextJob.message || "批量镜像切换未完成",
          nextJob.status === "completed" ? "ok" : "err",
        );
      }
    } catch (error) {
      pushConsoleToast(protocolApiErrorMessage(error, "启动批量镜像切换失败"), "err");
    } finally {
      setStarting(false);
    }
  }

  function requestStart() {
    if (mode === "rebuild_all") setConfirmOpen(true);
    else void start();
  }

  function requestClose() {
    if (!busy) onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
        <DialogContent
          className="protocol-runtime-image-switch-dialog bg-card sm:max-w-[560px]"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>批量切换镜像</DialogTitle>
            <DialogDescription>对全部 {runtimeCount} 个 SnowLuma Runtime 设置同一 Docker 镜像。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              目标 Docker 镜像
              <ProtocolDockerImageSelect mountUrl={mountUrl} protocol="snowluma" value={image} onValueChange={setImage} disabled={busy} />
            </label>
            <fieldset className="space-y-2" disabled={busy}>
              <legend className="text-sm font-medium">应用方式</legend>
              <label className="protocol-runtime-image-switch-option">
                <input type="radio" name="runtime-image-mode" checked={mode === "rebuild_all"} onChange={() => setMode("rebuild_all")} />
                <span><strong>逐个离线重建</strong><small>运行中的 Runtime 会依次停止、重建并启动；已停止项仅保存配置。</small></span>
              </label>
              <label className="protocol-runtime-image-switch-option">
                <input type="radio" name="runtime-image-mode" checked={mode === "next_start"} onChange={() => setMode("next_start")} />
                <span><strong>下次启动时使用</strong><small>只保存配置，不影响当前容器。</small></span>
              </label>
            </fieldset>

            {job ? (
              <section className="protocol-runtime-image-switch-progress" aria-live="polite">
                <div className="protocol-runtime-image-switch-progress__head"><span>{job.message || "正在处理…"}</span><span>{progressLabel}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${total ? Math.min(100, (progressCompleted / total) * 100) : 0}%` }} /></div>
                {isRunning(job) && job.message ? <p className="mt-2 break-all text-xs text-muted-foreground">{job.message}</p> : null}
                {!isRunning(job) ? <p className="mt-2 text-xs text-muted-foreground">{failed.length ? `失败 ${failed.length} 项` : "已完成"}{nextStartCount ? `；${nextStartCount} 项等待下次启动` : ""}</p> : null}
                {failed.length ? <ul className="mt-2 space-y-1 text-xs text-destructive">{failed.map((result) => <li key={result.id} className="break-all">{result.id}：{result.error}</li>)}</ul> : null}
              </section>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" disabled={busy || !image.trim()} onClick={requestStart}>{starting ? "正在提交…" : mode === "rebuild_all" ? "确认并重建" : "保存并等待下次启动"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConsoleConfirmModal
        open={confirmOpen}
        title="确认批量重建 Runtime"
        subtitle="运行中的 Runtime 将逐个短暂离线；共享 Runtime 下全部 QQ 都会暂时离线。"
        warnings={["镜像将应用到全部 SnowLuma Runtime。"]}
        confirmLabel="开始逐个重建"
        confirmVariant="destructive"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); void start(); }}
      />
    </>
  );
}
