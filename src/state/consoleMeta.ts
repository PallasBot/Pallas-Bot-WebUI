import { ref } from "vue";
import { fetchHealth, type HealthResponse } from "@/api/health";
import { fetchBotUpdateCheck } from "@/api/consoleApi";
import type { BotUpdateCheckData } from "@/api/pallasTypes";

/** 侧栏品牌区与首页共用的 /health、Bot 更新检查快照 */
export const consoleMetaHealth = ref<HealthResponse | null>(null);
export const consoleMetaBotUpdate = ref<BotUpdateCheckData | null>(null);
export const consoleMetaErr = ref("");
export const consoleMetaLoading = ref(false);

/** 侧栏品牌 Bot 版本轮询间隔（与首页 load 写入共用快照） */
export const CONSOLE_META_POLL_MS = 12_000;

export function patchConsoleMeta(
  health: HealthResponse | null,
  botUpdate?: BotUpdateCheckData | null,
): void {
  consoleMetaHealth.value = health;
  if (botUpdate !== undefined) consoleMetaBotUpdate.value = botUpdate;
}

export function patchWebuiDevMode(active: boolean): void {
  const h = consoleMetaHealth.value;
  if (!h) return;
  consoleMetaHealth.value = {
    ...h,
    console: { ...h.console, pallas_webui_dev_mode: active },
  };
}

export async function refreshConsoleMeta(options?: { silent?: boolean }): Promise<void> {
  const silent = options?.silent ?? false;
  if (!silent) {
    consoleMetaLoading.value = true;
    consoleMetaErr.value = "";
  }
  try {
    const [h, bot] = await Promise.all([
      fetchHealth(),
      fetchBotUpdateCheck().catch(() => null),
    ]);
    consoleMetaHealth.value = h;
    if (bot) consoleMetaBotUpdate.value = bot;
  } catch (e) {
    consoleMetaErr.value = e instanceof Error ? e.message : String(e);
    if (!silent) consoleMetaHealth.value = null;
  } finally {
    if (!silent) consoleMetaLoading.value = false;
  }
}
