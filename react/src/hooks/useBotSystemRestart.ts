import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchBotUpdateCheck,
  fetchShardObservability,
  postSystemRestart,
} from "@/api/fullConsole";
import type { BotUpdateCheckData } from "@pallas-vue/api/pallasTypes";
import { fetchHealth } from "@/api/health";
import { axiosErrorDetail } from "@/api/http";
import {
  botRestartPhaseLabel,
  healthBootFingerprint,
  waitForBotRestartOnline,
  type BotRestartPhase,
} from "@pallas-vue/utils/botRestartProgress";
import { syncRestartSession } from "@/state/botRestartSession";

export type { BotRestartPhase };

export async function trackRestartFromPluginResult(
  result: {
    restart_scheduled?: boolean;
    activation_action?: string | null;
  } | null | undefined,
  onPhase?: (phase: BotRestartPhase) => void,
): Promise<boolean> {
  if (!result?.restart_scheduled) return true;
  syncRestartSession({ open: true, busy: true, phase: "scheduled", msg: "", err: "", progressPercent: 0 });
  onPhase?.("scheduled");
  const online = await waitForBotRestartOnline({
    onPhase: (phase) => {
      syncRestartSession({ phase, msg: botRestartPhaseLabel(phase) });
      onPhase?.(phase);
    },
    onProgress: (percent) => syncRestartSession({ progressPercent: percent }),
  });
  syncRestartSession({
    phase: online ? "online" : "timeout",
    msg: botRestartPhaseLabel(online ? "online" : "timeout"),
    busy: false,
    progressPercent: online ? 100 : undefined,
  });
  onPhase?.(online ? "online" : "timeout");
  return online;
}

export function useBotSystemRestart(options?: {
  botUpdateCheck?: BotUpdateCheckData | null;
}) {
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartMsg, setRestartMsg] = useState("");
  const [restartErr, setRestartErr] = useState("");
  const [restartPhase, setRestartPhase] = useState<BotRestartPhase>("idle");
  const [shardedRuntime, setShardedRuntime] = useState<boolean | null>(null);
  const [internalBotCheck, setInternalBotCheck] = useState<BotUpdateCheckData | null>(null);
  const shardedRef = useRef<boolean | null>(null);

  useEffect(() => {
    shardedRef.current = shardedRuntime;
  }, [shardedRuntime]);

  const effectiveBotCheck = options?.botUpdateCheck ?? internalBotCheck;

  const restartAvailable = Boolean(
    effectiveBotCheck?.restart_available && effectiveBotCheck?.deployment_mode !== "docker",
  );

  const restartProgressLabel = useMemo(
    () => botRestartPhaseLabel(restartPhase) || restartMsg,
    [restartPhase, restartMsg],
  );

  const restartInProgress =
    restartBusy
    || (restartPhase !== "idle"
      && restartPhase !== "online"
      && restartPhase !== "timeout"
      && restartPhase !== "failed");

  const ensureRestartContext = useCallback(async () => {
    if (options?.botUpdateCheck == null && !internalBotCheck) {
      try {
        setInternalBotCheck(await fetchBotUpdateCheck());
      } catch {
        setInternalBotCheck(null);
      }
    }
    if (shardedRef.current != null) return;
    try {
      const obs = await fetchShardObservability();
      setShardedRuntime(Boolean(obs.sharded));
    } catch {
      setShardedRuntime(false);
    }
  }, [internalBotCheck, options?.botUpdateCheck]);

  const restartBot = useCallback(
    async (workersOnly = false): Promise<boolean> => {
      await ensureRestartContext();
      const bot = options?.botUpdateCheck ?? internalBotCheck;
      const available = Boolean(bot?.restart_available && bot?.deployment_mode !== "docker");
      if (!available) return false;
      const prompt = workersOnly
        ? "确定仅重启分片节点进程？主节点与其它组件不受影响。"
        : "确定重启 Bot 进程？数秒内连接会短暂中断。";
      if (!window.confirm(prompt)) return false;

      setRestartBusy(true);
      setRestartErr("");
      setRestartMsg("");
      setRestartPhase("idle");
      syncRestartSession({
        open: true,
        busy: true,
        phase: "idle",
        msg: "",
        err: "",
        progressPercent: 0,
      });
      try {
        let baselineFingerprint = "";
        try {
          baselineFingerprint = healthBootFingerprint(await fetchHealth({ bypassCache: true }));
        } catch {
          baselineFingerprint = "";
        }
        const r = await postSystemRestart({ workersOnly });
        setRestartPhase("scheduled");
        setRestartMsg(r.message || botRestartPhaseLabel("scheduled"));
        syncRestartSession({
          phase: "scheduled",
          msg: r.message || botRestartPhaseLabel("scheduled"),
        });
        const online = await waitForBotRestartOnline({
          workersOnly,
          baselineFingerprint,
          onPhase: (phase) => {
            setRestartPhase(phase);
            const label = botRestartPhaseLabel(phase);
            if (label) setRestartMsg(label);
            syncRestartSession({ phase, msg: label || undefined });
          },
          onProgress: (percent) => syncRestartSession({ progressPercent: percent }),
        });
        if (online) {
          setRestartPhase("online");
          setRestartMsg(botRestartPhaseLabel("online"));
          setRestartErr("");
          syncRestartSession({
            phase: "online",
            msg: botRestartPhaseLabel("online"),
            err: "",
            progressPercent: 100,
          });
          return true;
        }
        setRestartPhase("timeout");
        const timeoutMsg = botRestartPhaseLabel("timeout");
        setRestartMsg(timeoutMsg);
        setRestartErr(timeoutMsg);
        syncRestartSession({ phase: "timeout", msg: timeoutMsg, err: timeoutMsg });
        return false;
      } catch (e) {
        setRestartPhase("failed");
        const detail = axiosErrorDetail(e);
        setRestartErr(detail);
        syncRestartSession({ phase: "failed", err: detail, busy: false });
        return false;
      } finally {
        setRestartBusy(false);
        syncRestartSession({ busy: false });
      }
    },
    [ensureRestartContext, internalBotCheck, options?.botUpdateCheck],
  );

  return {
    restartBusy,
    restartMsg,
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
