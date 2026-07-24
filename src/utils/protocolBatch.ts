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
  options?: { onProgress?: (job: ProtocolBatchJob) => void; pollMs?: number },
): Promise<ProtocolBatchJob> {
  const pollMs = options?.pollMs ?? 800;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (job: ProtocolBatchJob | null, err?: unknown) => {
      if (settled) return;
      settled = true;
      es?.close();
      if (err) reject(err);
      else if (job) resolve(job);
      else reject(new Error("批量任务无结果"));
    };

    const apply = (job: ProtocolBatchJob) => {
      options?.onProgress?.(job);
      if (job.status && job.status !== "running") finish(job);
    };

    let es: EventSource | null = null;
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
        void (async () => {
          try {
            finish(await protocolFetchBatchJob(mountUrl, jobId));
          } catch (e) {
            finish(null, e);
          }
        })();
      };
    } catch {
      void (async () => {
        while (!settled) {
          try {
            const job = await protocolFetchBatchJob(mountUrl, jobId);
            apply(job);
            if (job.status !== "running") {
              finish(job);
              return;
            }
          } catch (err) {
            finish(null, err);
            return;
          }
          await new Promise((r) => window.setTimeout(r, pollMs));
        }
      })();
    }
  });
}
