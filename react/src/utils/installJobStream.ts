/** 监听插件/扩展安装 job 的 SSE，直到 complete 或失败。 */

export type InstallJobCompletePayload = {
  type?: string;
  phase?: string;
  message?: string;
  error?: string;
  result?: {
    message?: string;
    needs_restart?: boolean;
    restart_scheduled?: boolean;
  } | null;
};

export class InstallJobFailedError extends Error {
  result: InstallJobCompletePayload["result"];

  constructor(message: string, result: InstallJobCompletePayload["result"] = null) {
    super(message);
    this.name = "InstallJobFailedError";
    this.result = result;
  }
}

export function waitForInstallJob(
  jobId: string,
  openStream: (id: string) => EventSource,
  onProgress?: (message: string) => void,
): Promise<InstallJobCompletePayload> {
  return new Promise((resolve, reject) => {
    const stream = openStream(jobId);
    const closeStream = () => stream.close();
    stream.onmessage = (ev) => {
      if (!ev.data) return;
      try {
        const payload = JSON.parse(ev.data) as InstallJobCompletePayload;
        if (payload.type === "progress" && payload.message) {
          onProgress?.(payload.message);
        }
        if (payload.type === "complete") {
          if (payload.phase === "failed") {
            closeStream();
            reject(new InstallJobFailedError(payload.error || payload.message || "安装失败", payload.result));
            return;
          }
          closeStream();
          resolve(payload);
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
