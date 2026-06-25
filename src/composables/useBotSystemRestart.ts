import { computed, ref } from "vue";
import { fetchBotUpdateCheck, fetchShardObservability, postSystemRestart } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import {
  patchBotRestartSession,
  resetBotRestartSession,
} from "@/state/botRestartSession";
import {
  botRestartPhaseLabel,
  waitForBotRestartOnline,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";

function syncRestartSession(patch: {
  open?: boolean;
  busy?: boolean;
  phase?: BotRestartPhase;
  msg?: string;
  err?: string;
}): void {
  patchBotRestartSession(patch);
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
      ? "确定仅重启分片 worker 进程？Hub 与其它组件不受影响。"
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
    });
    try {
      const r = await postSystemRestart({ workersOnly });
      restartPhase.value = "scheduled";
      restartMsg.value = r.message || botRestartPhaseLabel("scheduled");
      syncRestartSession({
        phase: "scheduled",
        msg: restartMsg.value,
      });
      const online = await waitForBotRestartOnline({
        onPhase: (phase) => {
          restartPhase.value = phase;
          const label = botRestartPhaseLabel(phase);
          if (label) restartMsg.value = label;
          syncRestartSession({
            phase,
            msg: restartMsg.value,
            err: "",
          });
        },
      });
      if (online) {
        restartErr.value = "";
        syncRestartSession({
          phase: "online",
          msg: botRestartPhaseLabel("online"),
          err: "",
          busy: false,
        });
        window.setTimeout(() => {
          if (!restartBusy.value) resetBotRestartSession();
        }, 1800);
        return true;
      }
      restartErr.value = botRestartPhaseLabel("timeout");
      syncRestartSession({
        phase: "timeout",
        msg: restartErr.value,
        err: restartErr.value,
        busy: false,
      });
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
  };
}
