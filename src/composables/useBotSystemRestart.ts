import { computed, ref } from "vue";
import { fetchBotUpdateCheck, fetchShardObservability, postSystemRestart } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";
import { fetchHealth } from "@/api/health";
import { axiosErrorDetail } from "@/api/http";
import {
  patchBotRestartSession,
  resetBotRestartSession,
} from "@/state/botRestartSession";
import {
  botRestartPhaseLabel,
  healthBootFingerprint,
  waitForBotRestartOnline,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";

function syncRestartSession(patch: {
  open?: boolean;
  busy?: boolean;
  phase?: BotRestartPhase;
  msg?: string;
  err?: string;
  progressPercent?: number;
}): void {
  patchBotRestartSession(patch);
}

export type TrackBotRestartOptions = {
  workersOnly?: boolean;
  skipConfirm?: boolean;
  baselineFingerprint?: string;
  onPhase?: (phase: BotRestartPhase) => void;
  onProgress?: (percent: number) => void;
};

export async function trackBotRestartProgress(
  options: TrackBotRestartOptions = {},
): Promise<boolean> {
  const workersOnly = Boolean(options.workersOnly);
  let baselineFingerprint = (options.baselineFingerprint || "").trim();
  if (!baselineFingerprint) {
    try {
      const health = await fetchHealth({ bypassCache: true });
      baselineFingerprint = healthBootFingerprint(health);
    } catch {
      baselineFingerprint = "";
    }
  }

  syncRestartSession({
    open: true,
    busy: true,
    phase: "scheduled",
    msg: botRestartPhaseLabel("scheduled"),
    err: "",
    progressPercent: 0,
  });
  options.onPhase?.("scheduled");
  options.onProgress?.(0);

  try {
    const online = await waitForBotRestartOnline({
      workersOnly,
      baselineFingerprint,
      onPhase: (phase) => {
        const label = botRestartPhaseLabel(phase);
        syncRestartSession({
          phase,
          msg: label || undefined,
          err: "",
        });
        options.onPhase?.(phase);
      },
      onProgress: (percent) => {
        syncRestartSession({ progressPercent: percent });
        options.onProgress?.(percent);
      },
    });
    if (online) {
      syncRestartSession({
        phase: "online",
        msg: botRestartPhaseLabel("online"),
        err: "",
        progressPercent: 100,
        busy: false,
      });
      window.setTimeout(() => {
        resetBotRestartSession();
      }, 1800);
      return true;
    }
    const timeoutMsg = botRestartPhaseLabel("timeout");
    syncRestartSession({
      phase: "timeout",
      msg: timeoutMsg,
      err: timeoutMsg,
      busy: false,
    });
    return false;
  } catch (e) {
    const err = axiosErrorDetail(e);
    syncRestartSession({
      phase: "failed",
      err,
      busy: false,
    });
    return false;
  } finally {
    syncRestartSession({ busy: false });
  }
}

export async function trackRestartFromPluginResult(
  result: {
    restart_scheduled?: boolean;
    activation_action?: string | null;
  } | null | undefined,
): Promise<boolean> {
  if (!result?.restart_scheduled) return true;
  const workersOnly = result.activation_action === "workers-restart";
  return trackBotRestartProgress({ workersOnly, skipConfirm: true });
}

export function useBotSystemRestart(options?: {
  botUpdateCheck?: { value: BotUpdateCheckData | null };
}) {
  const restartBusy = ref(false);
  const restartMsg = ref("");
  const restartErr = ref("");
  const restartPhase = ref<BotRestartPhase>("idle");
  const shardedRuntime = ref<boolean | null>(null);
  const internalBotCheck = ref<BotUpdateCheckData | null>(null);

  const effectiveBotCheck = computed(
    () => options?.botUpdateCheck?.value ?? internalBotCheck.value,
  );

  const restartAvailable = computed(() => {
    const b = effectiveBotCheck.value;
    return Boolean(b?.restart_available && b?.deployment_mode !== "docker");
  });

  const restartProgressLabel = computed(() => botRestartPhaseLabel(restartPhase.value));

  const restartInProgress = computed(
    () =>
      restartBusy.value
      || (restartPhase.value !== "idle"
        && restartPhase.value !== "online"
        && restartPhase.value !== "timeout"
        && restartPhase.value !== "failed"),
  );

  async function ensureRestartContext(): Promise<void> {
    if (!options?.botUpdateCheck && !internalBotCheck.value) {
      try {
        internalBotCheck.value = await fetchBotUpdateCheck();
      } catch {
        internalBotCheck.value = null;
      }
    }
    await ensureShardMode();
  }

  async function ensureShardMode(): Promise<boolean> {
    if (shardedRuntime.value != null) return shardedRuntime.value;
    try {
      const obs = await fetchShardObservability();
      shardedRuntime.value = Boolean(obs.sharded);
    } catch {
      shardedRuntime.value = false;
    }
    return shardedRuntime.value;
  }

  async function restartBot(workersOnly = false): Promise<boolean> {
    await ensureRestartContext();
    if (!restartAvailable.value) return false;
    const prompt = workersOnly
      ? "确定仅重启分片节点进程？主节点与其它组件不受影响。"
      : "确定重启 Bot 进程？数秒内连接会短暂中断。";
    if (!confirm(prompt)) return false;
    restartBusy.value = true;
    restartErr.value = "";
    restartMsg.value = "";
    restartPhase.value = "idle";
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
      restartPhase.value = "scheduled";
      restartMsg.value = r.message || botRestartPhaseLabel("scheduled");
      const online = await trackBotRestartProgress({
        workersOnly,
        skipConfirm: true,
        baselineFingerprint,
        onPhase: (phase) => {
          restartPhase.value = phase;
          const label = botRestartPhaseLabel(phase);
          if (label) restartMsg.value = label;
        },
      });
      if (online) {
        restartErr.value = "";
        return true;
      }
      restartErr.value = botRestartPhaseLabel("timeout");
      return false;
    } catch (e) {
      restartPhase.value = "failed";
      restartErr.value = axiosErrorDetail(e);
      syncRestartSession({
        phase: "failed",
        err: restartErr.value,
        busy: false,
      });
      return false;
    } finally {
      restartBusy.value = false;
      syncRestartSession({ busy: false });
    }
  }

  return {
    restartBusy,
    restartMsg,
    restartErr,
    restartPhase,
    restartProgressLabel,
    restartInProgress,
    restartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
    trackBotRestartProgress,
    trackRestartFromPluginResult,
  };
}
