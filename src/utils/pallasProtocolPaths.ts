export const DEFAULT_PROTOCOL_WEB_PATH = "/protocol/console";

/**
 * 当前浏览器访问下的控制台根 URL（``origin`` + 挂载路径），用于打开协议嵌入页等。
 * @param serverHttpBase 可选：来自 ``/pallas/api/health`` 的 ``console.http_base``（与 ``pallas_webui_http_base`` 一致），
 *   优先于构建期 ``import.meta.env.BASE_URL``，避免反代子路径与构建不一致时走错。
 */
export function consoleBrowserBaseUrl(serverHttpBase?: string | null): string {
  if (typeof window === "undefined") return "";
  const fromServer = (serverHttpBase ?? "").trim();
  const fromEnv = ((import.meta.env.BASE_URL as string) || "/pallas/").trim();
  const pick = fromServer || fromEnv;
  let root = pick.replace(/\/$/, "");
  if (!root || root === ".") {
    root = "/pallas";
  }
  if (!root.startsWith("/")) {
    root = `/${root}`;
  }
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
