/** 监听插件商店装/更/卸 job 的 SSE，直到 complete 或失败。 */

import { clearActiveJob, setActiveJob } from "@/utils/activeJobSession";
import {
  InstallJobFailedError,
  InstallJobStreamCancelledError,
  InstallJobStreamInterruptedError,
} from "@/utils/installJobStream";

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
  signal?: AbortSignal,
): Promise<PluginStoreJobCompletePayload> {
  const id = String(jobId || "").trim();
  if (id) setActiveJob("plugin-store", id, meta);
  return new Promise((resolve, reject) => {
    let settled = false;
    let stream: EventSource | null = null;
    const finish = (error?: unknown, payload?: PluginStoreJobCompletePayload) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (stream) {
        stream.onmessage = null;
        stream.onerror = null;
        stream.close();
      }
      if (error) reject(error);
      else resolve(payload!);
    };
    const onAbort = () => finish(new InstallJobStreamCancelledError());
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      stream = openStream(id);
    } catch (error) {
      finish(error);
      return;
    }
    if (settled) {
      stream.close();
      return;
    }
    stream.onmessage = (ev) => {
      if (settled || !ev.data) return;
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
            finish(
              new InstallJobFailedError(
                payload.error || payload.message || "操作失败",
                payload.result,
              ),
            );
            return;
          }
          clearActiveJob("plugin-store", id);
          finish(undefined, payload as PluginStoreJobCompletePayload);
        }
        if (payload.type === "error") {
          clearActiveJob("plugin-store", id);
          finish(new Error(payload.error || "任务不存在"));
        }
      } catch {
        /* ignore malformed */
      }
    };
    stream.onerror = () => {
      finish(new InstallJobStreamInterruptedError("插件商店进度连接中断"));
    };
  });
}
