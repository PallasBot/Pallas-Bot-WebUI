/** 监听 Bot / WebUI 更新 job 的 SSE，直到 complete 或失败。 */

import { clearActiveJob, setActiveJob } from "@/utils/activeJobSession";
import { InstallJobFailedError, InstallJobStreamInterruptedError } from "@/utils/installJobStream";

export type UpdateApplyProgressEvent = {
  type?: string;
  phase?: string;
  message?: string;
  error?: string;
  progress_percent?: number;
  result?: {
    tag?: string;
    version?: string;
    message?: string;
    restart_scheduled?: boolean;
    tick?: {
      result?: string;
      reason?: string;
      error?: string;
      targets?: Record<string, { result?: string; error?: string; reason?: string }>;
    };
    last_error?: string | null;
  } | null;
};

export type UpdateApplyCompletePayload = UpdateApplyProgressEvent & {
  type: "complete";
};

export function waitForUpdateApplyJob(
  jobId: string,
  openStream: (id: string) => EventSource,
  onProgress?: (progress: { percent: number; message: string; phase: string }) => void,
  meta?: Record<string, string>,
): Promise<UpdateApplyCompletePayload> {
  const id = String(jobId || "").trim();
  if (id) setActiveJob("update-apply", id, meta);
  return new Promise((resolve, reject) => {
    const stream = openStream(id);
    const closeStream = () => stream.close();
    stream.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const payload = JSON.parse(ev.data) as UpdateApplyProgressEvent;
        if (payload.type === "progress") {
          onProgress?.({
            percent: Math.max(0, Math.min(100, Number(payload.progress_percent) || 0)),
            message: payload.message || "",
            phase: payload.phase || "running",
          });
        }
        if (payload.type === "complete") {
          if (payload.phase === "failed") {
            clearActiveJob("update-apply", id);
            closeStream();
            reject(new InstallJobFailedError(payload.error || payload.message || "更新失败", payload.result));
            return;
          }
          clearActiveJob("update-apply", id);
          closeStream();
          resolve(payload as UpdateApplyCompletePayload);
        }
        if (payload.type === "error") {
          clearActiveJob("update-apply", id);
          closeStream();
          reject(new Error(payload.error || "更新任务不存在"));
        }
      } catch {
        /* ignore malformed */
      }
    };
    stream.onerror = () => {
      closeStream();
      reject(new InstallJobStreamInterruptedError("更新进度连接中断"));
    };
  });
}
