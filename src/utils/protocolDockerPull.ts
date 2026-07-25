import {
  protocolFetchDockerPullJob,
  protocolStreamDockerPullJob,
  type ProtocolDockerPullJob,
} from "@/api/protocol";

export async function waitForDockerPullJob(
  mountUrl: string,
  jobId: string,
  options?: { onProgress?: (job: ProtocolDockerPullJob) => void; pollMs?: number },
): Promise<ProtocolDockerPullJob> {
  const pollMs = options?.pollMs ?? 600;
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let es: EventSource | null = null;

    const stopPoll = () => {
      if (pollTimer != null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };

    const finish = (job: ProtocolDockerPullJob | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      stopPoll();
      es?.close();
      es = null;
      if (err) reject(err);
      else if (job) resolve(job);
      else reject(new Error("拉取任务无结果"));
    };

    const apply = (job: ProtocolDockerPullJob) => {
      options?.onProgress?.(job);
      if (job.status && job.status !== "running") finish(job);
    };

    const pollOnce = async () => {
      if (settled) return;
      try {
        const job = await protocolFetchDockerPullJob(mountUrl, jobId);
        apply(job);
        if (!settled && job.status === "running") {
          pollTimer = window.setTimeout(() => {
            void pollOnce();
          }, pollMs);
        }
      } catch (err) {
        // SSE 仍可能可用；仅在没有 SSE 时失败
        if (!es || es.readyState === EventSource.CLOSED) finish(null, err);
        else {
          pollTimer = window.setTimeout(() => {
            void pollOnce();
          }, pollMs);
        }
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
        // 不断开轮询；流结束时由 poll / 最终 snapshot 收口
        if (es && es.readyState === EventSource.CLOSED) {
          void protocolFetchDockerPullJob(mountUrl, jobId)
            .then((job) => apply(job))
            .catch(() => {
              /* keep polling */
            });
        }
      };
    } catch {
      es = null;
    }

    void pollOnce();
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
