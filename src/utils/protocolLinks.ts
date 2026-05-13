import type { InstancesData, NapcatAccountRow, SystemData } from "@/api/pallasTypes";

/** 当前浏览器下的控制台根路径（含 base），末尾无斜杠 */
export function consolePublicRoot(): string {
  const base = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  if (typeof window === "undefined") return base || "/pallas";
  const { origin } = window.location;
  return `${origin}${base}`;
}

/** 后端声明的 HTTP 基址（若有） */
export function botHttpBaseFromSystem(system: SystemData | null): string | null {
  const raw = system?.console?.http_base?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** NoneBot driver 监听（仅供参考，可能为 0.0.0.0） */
export function nonebotDriverHint(system: SystemData | null): string | null {
  const host = system?.nonebot2_driver?.host;
  const port = system?.nonebot2_driver?.port;
  if (host == null || port == null) return null;
  return `${host}:${port}`;
}

export function accountNativeWebUiUrl(account: NapcatAccountRow): string | null {
  const u = account.native_webui_url || account.napcat_native_webui_url;
  if (typeof u !== "string" || !u.trim()) return null;
  return u.trim();
}

export function protocolSnapshot(data: InstancesData | null) {
  return data?.pallas_protocol ?? data?.napcat ?? null;
}
