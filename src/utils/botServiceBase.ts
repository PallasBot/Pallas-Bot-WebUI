import { ref } from "vue";
import { fetchSystem } from "@/api/consoleApi";
import type { SystemData } from "@/api/pallasTypes";

/** 0.0.0.0 / :: 在浏览器中无法作为主机访问，用于展示/复制时换成本机名 */
function hostForDisplay(h: string | null | undefined): string {
  const s = (h || "").trim().toLowerCase();
  if (!s || s === "0.0.0.0" || s === "::" || s === "[::]") {
    return "localhost";
  }
  return String(h);
}

/**
 * 与 Pallas/NoneBot 监听的 host:port 一致，用于拼 /napcat、/pallas 等绝对 URL。
 * 缺省 8088 与常见 .env 及文档示例对齐。
 */
export function buildBotServiceBaseUrl(s: SystemData): string {
  const p = s.nonebot2_driver.port;
  const port = p != null && !Number.isNaN(Number(p)) ? Number(p) : 8088;
  const host = hostForDisplay(s.nonebot2_driver.host);
  return `http://${host}:${port}`;
}

const botServiceBase = ref("");

let inflight: Promise<string> | null = null;

/**
 * 拉取 /pallas/api/system 并缓存 http://host:port，供各页与 Bot 同端口（如 /napcat）。
 */
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
