import { onUnmounted, ref } from "vue";

/** 高频写入 ref 后，节流触发 version 递增以驱动 computed 重算（借鉴 gsuid ConsolePage）。 */
export function useThrottledVersion(intervalMs = 100) {
  const version = ref(0);
  let pendingTimer: number | null = null;
  let lastFlushAt = 0;

  function bump() {
    const now = Date.now();
    const sinceLast = now - lastFlushAt;
    if (sinceLast >= intervalMs) {
      lastFlushAt = now;
      version.value += 1;
      return;
    }
    if (pendingTimer != null) return;
    pendingTimer = window.setTimeout(() => {
      pendingTimer = null;
      lastFlushAt = Date.now();
      version.value += 1;
    }, intervalMs - sinceLast);
  }

  function flushNow() {
    if (pendingTimer != null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    lastFlushAt = Date.now();
    version.value += 1;
  }

  onUnmounted(() => {
    if (pendingTimer != null) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  });

  return { version, bump, flushNow };
}
