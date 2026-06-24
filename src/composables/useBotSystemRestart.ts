import { computed, ref } from "vue";
import { fetchBotUpdateCheck, fetchShardObservability, postSystemRestart } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";
import {
  botRestartPhaseLabel,
  waitForBotRestartOnline,
  type BotRestartPhase,
} from "@/utils/botRestartProgress";

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
    try {
      const r = await postSystemRestart({ workersOnly });
      restartPhase.value = "scheduled";
      restartMsg.value = r.message || botRestartPhaseLabel("scheduled");
      const online = await waitForBotRestartOnline({
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
      return false;
    } finally {
      restartBusy.value = false;
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
