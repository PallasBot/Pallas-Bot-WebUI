import { computed, ref, type Ref } from "vue";
import { fetchBotUpdateCheck, fetchShardObservability, postSystemRestart } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";
import { axiosErrorDetail } from "@/api/http";

export function useBotSystemRestart(options?: {
  botUpdateCheck?: Ref<BotUpdateCheckData | null>;
}) {
  const restartBusy = ref(false);
  const restartMsg = ref("");
  const restartErr = ref("");
  const shardedRuntime = ref<boolean | null>(null);
  const internalBotCheck = ref<BotUpdateCheckData | null>(null);

  const effectiveBotCheck = computed(
    () => options?.botUpdateCheck?.value ?? internalBotCheck.value,
  );

  const restartAvailable = computed(() => {
    const b = effectiveBotCheck.value;
    return Boolean(b?.restart_available && b?.deployment_mode !== "docker");
  });

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
    try {
      const r = await postSystemRestart({ workersOnly });
      restartMsg.value = r.message || "已安排重启。";
      return true;
    } catch (e) {
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
    restartAvailable,
    shardedRuntime,
    ensureRestartContext,
    restartBot,
  };
}
