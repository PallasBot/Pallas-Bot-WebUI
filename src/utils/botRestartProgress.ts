import { fetchHealth } from "@/api/health";

export type BotRestartPhase =
  | "idle"
  | "scheduled"
  | "disconnecting"
  | "reconnecting"
  | "online"
  | "timeout"
  | "failed";

export function botRestartPhaseLabel(phase: BotRestartPhase): string {
  switch (phase) {
    case "scheduled":
      return "已发送重启指令，等待进程退出…";
    case "disconnecting":
      return "Bot 已离线，等待重新拉起…";
    case "reconnecting":
      return "正在探测 Hub 是否恢复…";
    case "online":
      return "Bot 已恢复在线。";
    case "timeout":
      return "重启超时：请检查进程日志或手动确认状态。";
    case "failed":
      return "重启失败：未能确认 Bot 恢复在线。";
    default:
      return "";
  }
}

export async function waitForBotRestartOnline(options?: {
  timeoutMs?: number;
  pollMs?: number;
  onPhase?: (phase: BotRestartPhase) => void;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const pollMs = options?.pollMs ?? 2000;
  const started = Date.now();
  let sawOffline = false;
  options?.onPhase?.("scheduled");

  while (Date.now() - started < timeoutMs) {
    await sleep(pollMs);
    try {
      const health = await fetchHealth({ bypassCache: true });
      if (health?.ok) {
        options?.onPhase?.("online");
        return true;
      }
      options?.onPhase?.(sawOffline ? "reconnecting" : "scheduled");
    } catch {
      sawOffline = true;
      options?.onPhase?.("disconnecting");
    }
  }

  options?.onPhase?.("timeout");
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
