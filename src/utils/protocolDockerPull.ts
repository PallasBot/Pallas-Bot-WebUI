import {
  protocolFetchDockerPullJob,
  protocolStreamDockerPullJob,
  type ProtocolDockerCapability,
  type ProtocolDockerPullJob,
} from "@/api/protocol";

export function dockerCapabilityHint(capability: ProtocolDockerCapability): string {
  if (capability.ready) {
    const version = capability.server_version?.trim();
    return version ? `Docker daemon 可用（Server ${version}）` : capability.message;
  }
  return `${capability.message}。也可在宿主机手动 pull 对应镜像。`;
}

export async function waitForDockerPullJob(
  mountUrl: string,
  jobId: string,
  options?: { onProgress?: (job: ProtocolDockerPullJob) => void; pollMs?: number; signal?: AbortSignal },
): Promise<ProtocolDockerPullJob> {
  const pollMs = options?.pollMs ?? 600;
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let es: EventSource | null = null;
    let pollInFlight = false;

    const stopPoll = () => {
      if (pollTimer != null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const schedulePoll = () => {
      if (settled || pollTimer != null) return;
      pollTimer = window.setTimeout(() => {
        pollTimer = null;
        void pollOnce();
      }, pollMs);
    };

    const finish = (job: ProtocolDockerPullJob | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      stopPoll();
      es?.close();
      es = null;
      options?.signal?.removeEventListener("abort", abort);
      if (err) reject(err);
      else if (job) resolve(job);
      else reject(new Error("拉取任务无结果"));
    };

    const apply = (job: ProtocolDockerPullJob) => {
      if (settled) return;
      options?.onProgress?.(job);
      if (job.status && job.status !== "running") finish(job);
    };

    const abort = () => finish(null, new DOMException("Docker pull watcher cancelled", "AbortError"));
    if (options?.signal?.aborted) {
      abort();
      return;
    }
    options?.signal?.addEventListener("abort", abort, { once: true });

    const pollOnce = async () => {
      if (settled || pollInFlight) return;
      pollInFlight = true;
      try {
        const job = await protocolFetchDockerPullJob(mountUrl, jobId);
        if (settled) return;
        apply(job);
        if (!settled && job.status === "running") schedulePoll();
      } catch (err) {
        if (settled) return;
        // SSE 仍可能可用；仅在没有 SSE 时失败
        if (!es || es.readyState === EventSource.CLOSED) finish(null, err);
        else schedulePoll();
      } finally {
        pollInFlight = false;
      }
    };

    try {
      es = protocolStreamDockerPullJob(mountUrl, jobId);
      es.addEventListener("snapshot", (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data) as ProtocolDockerPullJob);
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("progress", (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data) as ProtocolDockerPullJob);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        if (settled || !es) return;
        // 不断开轮询；流结束时由 poll / 最终 snapshot 收口
        if (es && es.readyState === EventSource.CLOSED) {
          void pollOnce();
        }
      };
    } catch {
      es = null;
    }

    if (!settled) void pollOnce();
  });
}

export function dockerPullPhaseLabel(job: ProtocolDockerPullJob | null | undefined): string {
  if (!job) return "";
  const phase =
    job.phase === "pulling"
      ? "拉取中"
      : job.phase === "rebuilding"
        ? "重建派生镜像"
        : job.phase === "completed"
          ? "完成"
          : job.phase === "failed"
            ? "失败"
            : job.phase === "pending"
              ? "排队中"
              : job.phase || "";
  return [phase, job.message].filter(Boolean).join(" · ");
}

export function dockerPullPercent(job: ProtocolDockerPullJob | null | undefined): number {
  if (!job) return 0;
  return Math.max(0, Math.min(100, Number(job.progress_percent) || 0));
}
