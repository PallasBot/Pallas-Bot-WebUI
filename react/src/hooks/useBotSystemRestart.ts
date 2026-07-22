import { useCallback, useRef, useState } from "react";
import {
  fetchBotUpdateCheck,
  fetchShardObservability,
  postSystemRestart,
} from "@/api/fullConsole";
import type { BotUpdateCheckData } from "@pallas-vue/api/pallasTypes";
import { fetchHealth } from "@/api/health";
import { axiosErrorDetail } from "@/api/http";

export type BotRestartPhase =
  | "idle"
  | "scheduled"
  | "disconnecting"
  | "reconnecting"
  | "online"
  | "timeout"
  | "failed";

function botRestartPhaseLabel(phase: BotRestartPhase): string {
  switch (phase) {
    case "scheduled":
      return "已安排重启…";
    case "disconnecting":
      return "连接断开…";
    case "reconnecting":
      return "探测 Bot 恢复…";
    case "online":
      return "Bot 已恢复在线";
    case "timeout":
      return "重启超时，请手动刷新页面";
    case "failed":
      return "重启失败";
    default:
      return "";
  }
}

async function waitForBotOnline(timeoutMs = 120_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await fetchHealth();
      if (health.ok) return true;
    } catch {
      /* still restarting */
    }
    await new Promise((r) => window.setTimeout(r, 1500));
  }
  return false;
}

export async function trackRestartFromPluginResult(
  result: {
    restart_scheduled?: boolean;
    activation_action?: string | null;
  } | null | undefined,
  onPhase?: (phase: BotRestartPhase) => void,
): Promise<boolean> {
  if (!result?.restart_scheduled) return true;
  onPhase?.("scheduled");
  const online = await waitForBotOnline();
  onPhase?.(online ? "online" : "timeout");
  return online;
}

export function useBotSystemRestart() {
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartErr, setRestartErr] = useState("");
  const [restartPhase, setRestartPhase] = useState<BotRestartPhase>("idle");
  const [shardedRuntime, setShardedRuntime] = useState<boolean | null>(null);
  const botCheckRef = useRef<BotUpdateCheckData | null>(null);

  const restartProgressLabel = botRestartPhaseLabel(restartPhase);
  const restartInProgress =
    restartBusy
    || (restartPhase !== "idle"
      && restartPhase !== "online"
      && restartPhase !== "timeout"
      && restartPhase !== "failed");
  const restartAvailable = Boolean(
    botCheckRef.current?.restart_available && botCheckRef.current?.deployment_mode !== "docker",
  );

  const ensureRestartContext = useCallback(async () => {
    if (!botCheckRef.current) {
      try {
        botCheckRef.current = await fetchBotUpdateCheck();
      } catch {
        botCheckRef.current = null;
      }
    }
    if (shardedRuntime != null) return;
    try {
      const obs = await fetchShardObservability();
      setShardedRuntime(Boolean(obs.sharded));
    } catch {
      setShardedRuntime(false);
    }
  }, [shardedRuntime]);

  const restartBot = useCallback(async (workersOnly = false): Promise<boolean> => {
    await ensureRestartContext();
    if (!restartAvailable) return false;
    const prompt = workersOnly
      ? "确定仅重启分片节点进程？主节点与其它组件不受影响。"
      : "确定重启 Bot 进程？数秒内连接会短暂中断。";
    if (!window.confirm(prompt)) return false;

    setRestartBusy(true);
    setRestartErr("");
    setRestartPhase("scheduled");
    try {
      await postSystemRestart({ workersOnly });
      setRestartPhase("reconnecting");
      const online = await waitForBotOnline();
      if (online) {
        setRestartPhase("online");
        setRestartErr("");
        return true;
      }
      setRestartPhase("timeout");
      setRestartErr(botRestartPhaseLabel("timeout"));
      return false;
    } catch (e) {
      setRestartPhase("failed");
      setRestartErr(axiosErrorDetail(e));
      return false;
    } finally {
      setRestartBusy(false);
    }
  }, [ensureRestartContext, restartAvailable]);

  return {
    restartBusy,
    restartErr,
    restartProgressLabel,
    restartInProgress,
    restartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
    trackRestartFromPluginResult: (result: Parameters<typeof trackRestartFromPluginResult>[0]) =>
      trackRestartFromPluginResult(result, (phase) => setRestartPhase(phase)),
  };
}
