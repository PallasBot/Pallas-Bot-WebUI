import { onMounted, onUnmounted, ref, shallowRef } from "vue";
import { fetchHealth, type HealthResponse } from "@/api/health";

export function useConnectionStatus(intervalMs = 25000) {
  const ok = ref<boolean | null>(null);
  const last = shallowRef<HealthResponse | null>(null);
  const healthTick = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const h = await fetchHealth();
      last.value = h;
      ok.value = h.ok;
    } catch {
      ok.value = false;
      last.value = null;
    } finally {
      healthTick.value += 1;
    }
  }

  onMounted(() => {
    void refresh();
    timer = setInterval(() => void refresh(), intervalMs);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { ok, last, refresh, healthTick };
}
