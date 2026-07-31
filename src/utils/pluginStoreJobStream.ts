/** 监听插件商店装/更/卸 job 的 SSE，直到 complete 或失败。 */

import { clearActiveJob, setActiveJob } from "@/utils/activeJobSession";
import { InstallJobFailedError, InstallJobStreamInterruptedError } from "@/utils/installJobStream";

export type PluginStoreJobProgressEvent = {
  type?: string;
  phase?: string;
  message?: string;
  error?: string;
  progress_percent?: number;
  result?: {
    message?: string;
    needs_restart?: boolean;
    restart_scheduled?: boolean;
  } | null;
};

export type PluginStoreJobCompletePayload = PluginStoreJobProgressEvent & {
  type: "complete";
};

export function waitForPluginStoreJob(
  jobId: string,
  openStream: (id: string) => EventSource,
  onProgress?: (progress: { percent: number; message: string; phase: string }) => void,
  meta?: Record<string, string>,
): Promise<PluginStoreJobCompletePayload> {
  const id = String(jobId || "").trim();
  if (id) setActiveJob("plugin-store", id, meta);
  return new Promise((resolve, reject) => {
    const stream = openStream(id);
    const closeStream = () => stream.close();
    stream.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const payload = JSON.parse(ev.data) as PluginStoreJobProgressEvent;
        if (payload.type === "progress") {
          onProgress?.({
            percent: Math.max(0, Math.min(100, Number(payload.progress_percent) || 0)),
            message: payload.message || "",
            phase: payload.phase || "running",
          });
        }
        if (payload.type === "complete") {
          if (payload.phase === "failed") {
            clearActiveJob("plugin-store", id);
            closeStream();
            reject(
              new InstallJobFailedError(
                payload.error || payload.message || "操作失败",
                payload.result,
              ),
            );
            return;
          }
          clearActiveJob("plugin-store", id);
          closeStream();
          resolve(payload as PluginStoreJobCompletePayload);
        }
        if (payload.type === "error") {
          clearActiveJob("plugin-store", id);
          closeStream();
          reject(new Error(payload.error || "任务不存在"));
        }
      } catch {
        /* ignore malformed */
      }
    };
    stream.onerror = () => {
      closeStream();
      reject(new InstallJobStreamInterruptedError("插件商店进度连接中断"));
    };
  });
}
