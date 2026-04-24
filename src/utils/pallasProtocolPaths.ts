/** 与主仓 pallas_protocol.contract 默认一致：未配置 webui_path 时为 /protocol/<DEFAULT_BACKEND> */
export const DEFAULT_PROTOCOL_WEB_PATH = "/protocol/napcat";

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

/** 账号行里 NapCat 内嵌 Web 的 URL（新字段 native_webui_url，旧 napcat_native_webui_url） */
export function accountNativeWebUiUrl(row: { native_webui_url?: string; napcat_native_webui_url?: string }): string {
  const u = row.native_webui_url ?? row.napcat_native_webui_url;
  return typeof u === "string" ? u : "";
}
