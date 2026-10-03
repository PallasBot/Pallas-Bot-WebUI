/** 监听插件/扩展安装 job 的 SSE，直到 complete 或失败。 */

import { clearActiveJob, setActiveJob } from "@/utils/activeJobSession";

export type InstallJobProgress = {
  percent: number;
  message: string;
  phase: string;
  line?: string;
};

export type InstallJobCompletePayload = {
  type?: string;
  phase?: string;
  message?: string;
  error?: string;
  progress_percent?: number;
  log_lines?: string[];
  result?: {
    message?: string;
    needs_restart?: boolean;
    restart_scheduled?: boolean;
    output_tail?: string;
    exit_code?: number;
    ai_root?: string;
    [key: string]: unknown;
  } | null;
};

export class InstallJobFailedError extends Error {
  result: InstallJobCompletePayload["result"];
  logLines: string[];

  constructor(
    message: string,
    result: InstallJobCompletePayload["result"] = null,
    logLines: string[] = [],
  ) {
    super(message);
    this.name = "InstallJobFailedError";
    this.result = result;
    this.logLines = logLines;
  }
}

/** 连接中断（切页等）时抛出；不清除 session，便于回页续连。 */
export class InstallJobStreamInterruptedError extends Error {
  constructor(message = "安装进度连接中断") {
    super(message);
    this.name = "InstallJobStreamInterruptedError";
  }
}

export class InstallJobStreamCancelledError extends Error {
  constructor() {
    super("已停止观看任务进度");
    this.name = "InstallJobStreamCancelledError";
  }
}

export function waitForInstallJob(
  jobId: string,
  openStream: (id: string) => EventSource,
  onProgress?: (progress: InstallJobProgress) => void,
  signal?: AbortSignal,
): Promise<InstallJobCompletePayload> {
  const id = String(jobId || "").trim();
  if (id) setActiveJob("ai-install", id);
  return new Promise((resolve, reject) => {
    let settled = false;
    let stream: EventSource | null = null;
    const finish = (error?: unknown, payload?: InstallJobCompletePayload) => {
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
        const payload = JSON.parse(ev.data) as InstallJobCompletePayload & {
          type?: string;
          line?: string;
        };
        if (payload.type === "progress") {
          onProgress?.({
            percent: Math.max(0, Math.min(100, Number(payload.progress_percent) || 0)),
            message: payload.message || "",
            phase: payload.phase || "running",
            line: typeof payload.line === "string" ? payload.line : undefined,
          });
        }
        if (payload.type === "complete") {
          if (payload.phase === "failed") {
            clearActiveJob("ai-install", id);
            finish(
              new InstallJobFailedError(
                payload.error || payload.message || "安装失败",
                payload.result,
                Array.isArray(payload.log_lines) ? payload.log_lines.map(String) : [],
              ),
            );
            return;
          }
          clearActiveJob("ai-install", id);
          finish(undefined, payload);
        }
        if (payload.type === "error") {
          clearActiveJob("ai-install", id);
          finish(new Error(payload.error || "任务不存在"));
        }
      } catch {
        /* ignore malformed */
      }
    };
    stream.onerror = () => {
      finish(new InstallJobStreamInterruptedError());
    };
  });
}
