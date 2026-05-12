export const DEFAULT_PROTOCOL_WEB_PATH = "/protocol/console";

/**
 * 当前浏览器访问下的控制台根 URL（``origin`` + WebUI 挂载路径，如 ``/pallas``）。
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

function stripTrailingWebuiMountFromOriginPath(url: string): string {
  const u = url.replace(/\/$/, "");
  if (/\/pallas$/i.test(u)) return u.replace(/\/pallas$/i, "");
  return u;
}

/**
 * NapCat 等协议页所在的服务根（``http://host:port``），**不含** WebUI 挂载段（如 ``/pallas``）。
 * 优先 NoneBot driver 解析出的地址；未就绪时再从 ``console.http_base`` 去掉常见 ``/pallas`` 后缀，避免拼成 ``…/pallas/protocol/console``。
 */
export function protocolServiceHttpBase(driverBase: string, consoleHttpBase?: string | null): string {
  const d = (driverBase ?? "").trim().replace(/\/$/, "");
  if (d) return d;
  const fromConsole = stripTrailingWebuiMountFromOriginPath(consoleBrowserBaseUrl(consoleHttpBase));
  return fromConsole || "http://localhost:8088";
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
