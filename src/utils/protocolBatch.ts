import {
  protocolFetchBatchJob,
  protocolStreamBatchJob,
  type ProtocolBatchJobPayload,
} from "@/api/protocol";

export type ProtocolBatchJob = ProtocolBatchJobPayload;

export function protocolBatchProgressPercent(job: ProtocolBatchJob | null | undefined): number {
  if (!job?.total) return 0;
  return Math.min(100, Math.round((job.completed / job.total) * 100));
}

export function protocolBatchPhaseLabel(job: ProtocolBatchJob | null | undefined): string {
  if (!job) return "";
  const parts = [job.message, job.phase, job.current_account_id].filter(Boolean);
  return parts.join(" · ");
}

export async function waitForProtocolBatchJob(
  mountUrl: string,
  jobId: string,
  options?: { onProgress?: (job: ProtocolBatchJob) => void; pollMs?: number; signal?: AbortSignal },
): Promise<ProtocolBatchJob> {
  const pollMs = options?.pollMs ?? 800;
  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: number | null = null;
    let pollInFlight = false;
    let polling = false;
    let es: EventSource | null = null;

    const schedulePoll = () => {
      if (settled || pollTimer != null) return;
      pollTimer = window.setTimeout(() => {
        pollTimer = null;
        void poll();
      }, pollMs);
    };

    const finish = (job: ProtocolBatchJob | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      if (pollTimer != null) window.clearTimeout(pollTimer);
      es?.close();
      options?.signal?.removeEventListener("abort", abort);
      if (err) reject(err);
      else if (job) resolve(job);
      else reject(new Error("批量任务无结果"));
    };

    const apply = (job: ProtocolBatchJob) => {
      if (settled) return;
      options?.onProgress?.(job);
      if (job.status && job.status !== "running") finish(job);
    };

    const poll = async () => {
      if (settled || pollInFlight) return;
      pollInFlight = true;
      try {
        apply(await protocolFetchBatchJob(mountUrl, jobId));
      } catch (err) {
        finish(null, err);
      } finally {
        pollInFlight = false;
      }
      schedulePoll();
    };

    const abort = () => finish(null, new DOMException("Protocol batch watcher cancelled", "AbortError"));
    if (options?.signal?.aborted) {
      abort();
      return;
    }
    options?.signal?.addEventListener("abort", abort, { once: true });
    try {
      es = protocolStreamBatchJob(mountUrl, jobId);
      es.addEventListener("snapshot", (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data) as ProtocolBatchJob);
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("progress", (ev) => {
        try {
          apply(JSON.parse((ev as MessageEvent).data) as ProtocolBatchJob);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        if (settled || pollInFlight || polling || !es) return;
        if (es.readyState === EventSource.CLOSED) {
          polling = true;
          void poll();
          return;
        }
        pollInFlight = true;
        void (async () => {
          try {
            apply(await protocolFetchBatchJob(mountUrl, jobId));
            if (!settled && es?.readyState === EventSource.CLOSED) {
              polling = true;
              schedulePoll();
            }
          } catch (e) {
            if (!settled) finish(null, e);
          } finally {
            pollInFlight = false;
          }
        })();
      };
    } catch {
      polling = true;
      void poll();
    }
  });
}
