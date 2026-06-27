import { ref } from "vue";
import { fetchHealth, type HealthResponse } from "@/api/health";
import { fetchBotUpdateCheck, fetchUpdateCheck } from "@/api/consoleApi";
import type { BotUpdateCheckData, UpdateCheckData } from "@/api/pallasTypes";
import { botRestartInProgress } from "@/state/botRestartSession";

/** 侧栏品牌区与首页共用的 /health、更新检查快照 */
export const consoleMetaHealth = ref<HealthResponse | null>(null);
export const consoleMetaBotUpdate = ref<BotUpdateCheckData | null>(null);
export const consoleMetaWebUpdate = ref<UpdateCheckData | null>(null);
export const consoleMetaErr = ref("");
export const consoleMetaLoading = ref(false);

/** 侧栏品牌 Bot 版本轮询间隔（与首页 load 写入共用快照） */
export const CONSOLE_META_POLL_MS = 12_000;

export function patchConsoleMeta(
  health: HealthResponse | null,
  botUpdate?: BotUpdateCheckData | null,
  webUpdate?: UpdateCheckData | null,
): void {
  consoleMetaHealth.value = health;
  if (botUpdate !== undefined) consoleMetaBotUpdate.value = botUpdate;
  if (webUpdate !== undefined) consoleMetaWebUpdate.value = webUpdate;
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
  if (botRestartInProgress.value) return;
  if (!silent) {
    consoleMetaLoading.value = true;
    consoleMetaErr.value = "";
  }
  try {
    const [h, bot, web] = await Promise.all([
      fetchHealth(),
      fetchBotUpdateCheck().catch(() => null),
      fetchUpdateCheck().catch(() => null),
    ]);
    consoleMetaErr.value = "";
    consoleMetaHealth.value = h;
    if (bot) consoleMetaBotUpdate.value = bot;
    if (web) consoleMetaWebUpdate.value = web;
  } catch (e) {
    consoleMetaErr.value = e instanceof Error ? e.message : String(e);
    if (!silent) consoleMetaHealth.value = null;
  } finally {
    if (!silent) consoleMetaLoading.value = false;
  }
}
