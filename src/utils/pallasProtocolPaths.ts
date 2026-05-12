export const DEFAULT_PROTOCOL_WEB_PATH = "/protocol/console";

/** 当前页面对应的控制台根 URL（与 API 同源路径），用于打开嵌入的协议 WebUI（穿透 FRP/反代）。 */
export function consoleBrowserBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const base = (import.meta.env.BASE_URL as string) || "/pallas/";
  const root = base.replace(/\/$/, "");
  return `${window.location.origin}${root}`;
}

export function resolveProtocolMountPath(webuiPath?: string | null): string {
  const raw = (webuiPath ?? "").trim();
  if (raw) {
    return raw.startsWith("/") ? raw.replace(/\/$/, "") : `/${raw.replace(/\/$/, "")}`;
  }
  return DEFAULT_PROTOCOL_WEB_PATH;
}

export function protocolDashboardUrl(botBase: string, webuiPath?: string | null): string {
  const b = (botBase || "http://127.0.0.1:8088").replace(/\/$/, "");
  return `${b}${resolveProtocolMountPath(webuiPath)}`;
}

export function protocolAccountUrl(botBase: string, webuiPath: string | null | undefined, accountId: string): string {
  const base = protocolDashboardUrl(botBase, webuiPath);
  const id = String(accountId ?? "").trim();
  if (!id) {
    return base;
  }
  return `${base}/account/${encodeURIComponent(id)}`;
}

export function accountNativeWebUiUrl(row: { native_webui_url?: string; napcat_native_webui_url?: string }): string {
  const u = row.native_webui_url ?? row.napcat_native_webui_url;
  return typeof u === "string" ? u : "";
}
