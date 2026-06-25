import { fetchHealth, type HealthResponse } from "@/api/health";

export type BotRestartPhase =
  | "idle"
  | "scheduled"
  | "disconnecting"
  | "reconnecting"
  | "online"
  | "timeout"
  | "failed";

export const BOT_RESTART_PROGRESS_CAP = 99;
export const BOT_RESTART_ESTIMATE_MS = 90_000;
export const BOT_RESTART_POLL_MS = 500;

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

export function healthBootFingerprint(health: HealthResponse | null | undefined): string {
  if (!health) return "";
  const bootId = (health.boot_id || "").trim();
  if (bootId) return bootId;
  const commit = (health.console?.commit || "").trim();
  const buildTime = (health.console?.build_time || "").trim();
  const version = (health.pallas_bot || "").trim();
  return [commit, buildTime, version].filter(Boolean).join(":");
}

export function isHealthRestartComplete(
  health: HealthResponse,
  baselineFingerprint: string,
  flags: { sawOffline: boolean; sawRestarting: boolean },
  workersOnly: boolean,
): boolean {
  if (!health.ok || health.restarting) return false;
  const fingerprint = healthBootFingerprint(health);
  const bootChanged = Boolean(
    baselineFingerprint && fingerprint && fingerprint !== baselineFingerprint,
  );
  if (workersOnly) {
    return flags.sawRestarting || flags.sawOffline;
  }
  return bootChanged || flags.sawOffline || flags.sawRestarting;
}

function estimateRestartProgress(elapsedMs: number, estimateMs: number): number {
  return Math.min(BOT_RESTART_PROGRESS_CAP, (elapsedMs / estimateMs) * BOT_RESTART_PROGRESS_CAP);
}

export async function waitForBotRestartOnline(options?: {
  timeoutMs?: number;
  pollMs?: number;
  estimateMs?: number;
  workersOnly?: boolean;
  baselineFingerprint?: string;
  onPhase?: (phase: BotRestartPhase) => void;
  onProgress?: (percent: number) => void;
}): Promise<boolean> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const pollMs = options?.pollMs ?? BOT_RESTART_POLL_MS;
  const estimateMs = options?.estimateMs ?? BOT_RESTART_ESTIMATE_MS;
  const workersOnly = Boolean(options?.workersOnly);
  const baselineFingerprint = (options?.baselineFingerprint || "").trim();
  const started = Date.now();
  let sawOffline = false;
  let sawRestarting = false;

  const emitProgress = () => {
    options?.onProgress?.(estimateRestartProgress(Date.now() - started, estimateMs));
  };

  options?.onPhase?.("scheduled");
  emitProgress();

  while (Date.now() - started < timeoutMs) {
    if (sawOffline || sawRestarting) {
      options?.onPhase?.("reconnecting");
    }
    await sleep(pollMs);
    emitProgress();

    try {
      const health = await fetchHealth({ bypassCache: true, probe: true });
      if (health.restarting) {
        sawRestarting = true;
        options?.onPhase?.("scheduled");
        continue;
      }
      if (isHealthRestartComplete(health, baselineFingerprint, { sawOffline, sawRestarting }, workersOnly)) {
        options?.onProgress?.(100);
        options?.onPhase?.("online");
        return true;
      }
      if (!health.ok) {
        sawOffline = true;
        options?.onPhase?.("disconnecting");
        continue;
      }
      options?.onPhase?.(sawOffline || sawRestarting ? "reconnecting" : "scheduled");
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
