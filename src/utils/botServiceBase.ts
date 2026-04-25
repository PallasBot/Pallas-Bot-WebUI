import { ref } from "vue";
import { fetchSystem } from "@/api/consoleApi";
import type { SystemData } from "@/api/pallasTypes";

/** 归一化展示主机名 */
function hostForDisplay(h: string | null | undefined): string {
  const s = (h || "").trim().toLowerCase();
  if (!s || s === "0.0.0.0" || s === "::" || s === "[::]") {
    return "localhost";
  }
  return String(h);
}

/** 生成 Bot 服务地址 */
export function buildBotServiceBaseUrl(s: SystemData): string {
  const p = s.nonebot2_driver.port;
  const port = p != null && !Number.isNaN(Number(p)) ? Number(p) : 8088;
  const host = hostForDisplay(s.nonebot2_driver.host);
  return `http://${host}:${port}`;
}

const botServiceBase = ref("");

let inflight: Promise<string> | null = null;

/** 加载并缓存 Bot 服务地址 */
export async function ensureBotServiceBaseUrl(): Promise<string> {
  if (botServiceBase.value) {
    return botServiceBase.value;
  }
  if (!inflight) {
    inflight = (async () => {
      try {
        const sys = await fetchSystem();
        const u = buildBotServiceBaseUrl(sys);
        botServiceBase.value = u;
        return u;
      } catch {
        botServiceBase.value = "http://localhost:8088";
        return botServiceBase.value;
      }
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function getBotServiceBaseRef() {
  return botServiceBase;
}
