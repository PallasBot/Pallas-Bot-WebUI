import { computed, onMounted, ref } from "vue";
import { fetchLlmWizardStatus } from "@/api/consoleApi";

/** AI 扩展是否可达；不可达时侧栏/配置轨收成「接入 + 观测」 */
const aiReachable = ref<boolean | null>(null);
const aiGateLoaded = ref(false);
let inflight: Promise<void> | null = null;

async function refreshAiReachability(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  inflight = (async () => {
    try {
      const status = await fetchLlmWizardStatus();
      aiReachable.value = Boolean(status?.ai_reachable);
    } catch {
      aiReachable.value = false;
    } finally {
      aiGateLoaded.value = true;
      inflight = null;
    }
  })();
  return inflight;
}

export function useAiNavGate() {
  onMounted(() => {
    void refreshAiReachability();
  });

  const essentialsOnly = computed(
    () => aiGateLoaded.value && aiReachable.value === false,
  );

  return {
    aiReachable,
    aiGateLoaded,
    essentialsOnly,
    refreshAiReachability,
  };
}

/** 未就绪时侧栏只保留观测总览与配置接入 */
export function aiSidebarPathAllowed(path: string, essentialsOnly: boolean): boolean {
  if (!essentialsOnly) return true;
  if (path.startsWith("/ai/config/")) return path === "/ai/config/provider" || path.startsWith("/ai/config/provider");
  if (path === "/ai/home" || path.startsWith("/ai/home")) return true;
  if (path === "/ai/history" || path.startsWith("/ai/history")) return true;
  return false;
}
