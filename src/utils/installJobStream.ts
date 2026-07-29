/** 监听插件/扩展安装 job 的 SSE，直到 complete 或失败。 */

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

export function waitForInstallJob(
  jobId: string,
  openStream: (id: string) => EventSource,
  onProgress?: (progress: InstallJobProgress) => void,
): Promise<InstallJobCompletePayload> {
  return new Promise((resolve, reject) => {
    const stream = openStream(jobId);
    const closeStream = () => stream.close();
    stream.onmessage = (ev) => {
      if (!ev.data) return;
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
            closeStream();
            reject(
              new InstallJobFailedError(
                payload.error || payload.message || "安装失败",
                payload.result,
                Array.isArray(payload.log_lines) ? payload.log_lines.map(String) : [],
              ),
            );
            return;
          }
          closeStream();
          resolve(payload);
        }
        if (payload.type === "error") {
          closeStream();
          reject(new Error(payload.error || "任务不存在"));
        }
      } catch {
        /* ignore malformed */
      }
    };
    stream.onerror = () => {
      closeStream();
      reject(new Error("安装进度连接中断"));
    };
  });
}
