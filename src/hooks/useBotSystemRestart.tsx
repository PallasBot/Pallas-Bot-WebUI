import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchShardObservability,
  fetchSystemRestartAvailability,
  postSystemRestart,
} from "@/api/fullConsole";
import type { BotUpdateCheckData, SystemRestartAvailabilityData } from "@/api/pallasTypes";
import { fetchHealth } from "@/api/health";
import { axiosErrorDetail } from "@/api/http";
import ConsoleConfirmModal from "@/components/ConsoleConfirmModal";
import {
  botRestartPhaseLabel,
  healthBootFingerprint,
  waitForBotRestartOnline,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";
import { syncRestartSession } from "@/state/botRestartSession";

export type { BotRestartPhase };

/** 与首页 `["bot-update-check"]` 共用，避免壳层再打一枪 */
export const BOT_UPDATE_CHECK_QUERY_KEY = ["bot-update-check"] as const;
export const BOT_UPDATE_CHECK_STALE_MS = 10 * 60 * 1000;

/** 壳层侧栏重启按钮能力探测：轻量、无 GitHub 等网络请求 */
export const SYSTEM_RESTART_AVAILABILITY_KEY = ["system-restart-availability"] as const;
export const SYSTEM_RESTART_AVAILABILITY_STALE_MS = 60 * 1000;

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
  const qc = useQueryClient();
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartMsg, setRestartMsg] = useState("");
  const [restartErr, setRestartErr] = useState("");
  const [restartPhase, setRestartPhase] = useState<BotRestartPhase>("idle");
  const [shardedRuntime, setShardedRuntime] = useState<boolean | null>(null);
  const [restartAvailability, setRestartAvailability] = useState<SystemRestartAvailabilityData | null>(
    null,
  );
  const [restartConfirm, setRestartConfirm] = useState<{ workersOnly: boolean } | null>(null);
  const restartConfirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const shardedRef = useRef<boolean | null>(null);

  useEffect(() => {
    shardedRef.current = shardedRuntime;
  }, [shardedRuntime]);

  const effectiveAvailability = options?.botUpdateCheck ?? restartAvailability;

  const restartAvailable = Boolean(
    effectiveAvailability?.restart_available && effectiveAvailability?.deployment_mode !== "docker",
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
    if (options?.botUpdateCheck == null && !restartAvailability) {
      try {
        const data = await qc.ensureQueryData({
          queryKey: SYSTEM_RESTART_AVAILABILITY_KEY,
          queryFn: fetchSystemRestartAvailability,
          staleTime: SYSTEM_RESTART_AVAILABILITY_STALE_MS,
        });
        setRestartAvailability(data);
      } catch {
        setRestartAvailability(null);
      }
    }
    if (shardedRef.current != null) return;
    try {
      const obs = await fetchShardObservability();
      setShardedRuntime(Boolean(obs.sharded));
    } catch {
      setShardedRuntime(false);
    }
  }, [options?.botUpdateCheck, qc, restartAvailability]);

  const restartBot = useCallback(
    async (workersOnly = false): Promise<boolean> => {
      await ensureRestartContext();
      const availability = options?.botUpdateCheck ?? restartAvailability;
      const available = Boolean(
        availability?.restart_available && availability?.deployment_mode !== "docker",
      );
      if (!available) return false;
      const ok = await new Promise<boolean>((resolve) => {
        restartConfirmResolver.current?.(false);
        restartConfirmResolver.current = resolve;
        setRestartConfirm({ workersOnly });
      });
      if (!ok) return false;

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
    [ensureRestartContext, options?.botUpdateCheck, restartAvailability],
  );

  const finishRestartConfirm = useCallback((ok: boolean) => {
    restartConfirmResolver.current?.(ok);
    restartConfirmResolver.current = null;
    setRestartConfirm(null);
  }, []);

  const restartConfirmDialog = (
    <ConsoleConfirmModal
      open={restartConfirm != null}
      title={restartConfirm?.workersOnly ? "重启分片节点" : "重启 Bot"}
      subtitle={
        restartConfirm?.workersOnly
          ? "将仅重启分片节点进程，主节点与其它组件不受影响。"
          : "将重启 Bot 进程，数秒内连接会短暂中断。"
      }
      confirmVariant="default"
      confirmLabel={restartConfirm?.workersOnly ? "确认重启节点" : "确认重启"}
      onClose={() => finishRestartConfirm(false)}
      onConfirm={() => finishRestartConfirm(true)}
    />
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
    restartConfirmDialog,
    trackRestartFromPluginResult: (result: Parameters<typeof trackRestartFromPluginResult>[0]) =>
      trackRestartFromPluginResult(result, (phase) => setRestartPhase(phase)),
  };
}
