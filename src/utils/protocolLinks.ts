import type { InstancesData, NapcatAccountRow, NapcatManagerSnapshot, SystemData } from "@/api/pallasTypes";

/** 拼接 HTTP 基址与路径 */
export function joinHttpPath(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.trim();
  if (!p) return b;
  const p2 = p.startsWith("/") ? p : `/${p}`;
  return `${b}${p2}`;
}

/** 协议管理页挂载路径（站点根相对，如 ``/protocol/console``） */
export function resolveProtocolMountPath(snap: NapcatManagerSnapshot | null): string | null {
  if (!snap?.webui_enabled) return null;
  const raw = snap.webui_path?.trim();
  if (!raw) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) {
    try {
      const u = new URL(raw);
      const p = u.pathname.replace(/\/$/, "") || "/";
      return p;
    } catch {
      return null;
    }
  }
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.replace(/\/$/, "") || path;
}

/** 协议管理页绝对 URL（用于外链与协议 API 基址） */
export function protocolMountAbsoluteUrl(
  system: SystemData | null,
  snap: NapcatManagerSnapshot | null,
): string | null {
  const mount = resolveProtocolMountPath(snap);
  if (!mount) return null;
  const base = botHttpBaseFromSystem(system);
  if (base && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(base)) {
    return joinHttpPath(base, mount);
  }
  if (typeof window === "undefined") return mount;
  return `${window.location.origin}${mount}`;
}

/** 协议管理列表（Bot WebUI 内嵌页，非独立 HTML 壳） */
export function protocolDashboardUrl(
  _system: SystemData | null,
  snap: NapcatManagerSnapshot | null,
): string | null {
  if (!snap?.webui_enabled) return null;
  return `${consolePublicRoot()}/protocol`;
}

/** 协议账号工作区（详情） */
export function protocolAccountDetailUrl(
  _system: SystemData | null,
  snap: NapcatManagerSnapshot | null,
  accountId: string,
): string | null {
  if (!snap?.webui_enabled) return null;
  const id = String(accountId ?? "").trim();
  if (!id) return null;
  return `${consolePublicRoot()}/protocol/${encodeURIComponent(id)}`;
}

/** 协议账号设置（编辑） */
export function protocolAccountEditUrl(
  system: SystemData | null,
  snap: NapcatManagerSnapshot | null,
  accountId: string,
): string | null {
  const detail = protocolAccountDetailUrl(system, snap, accountId);
  if (!detail) return null;
  return `${detail}?tab=settings`;
}

/** 协议 API 与页面路由用的账号 id */
export function accountProtocolId(account: NapcatAccountRow): string | null {
  const id = String(account.id ?? account.qq ?? "").trim();
  return id || null;
}

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

/** 消息框架 driver 监听（可能为 0.0.0.0，仅作提示） */
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

/** 协议账号 WebUI：优先 native_url，否则用 console.http_base 替换端口 */
function parseUrlPort(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.port) {
      const p = parseInt(u.port, 10);
      return Number.isFinite(p) && p >= 1 && p <= 65535 ? p : null;
    }
    if (u.protocol === "wss:" || u.protocol === "https:") return 443;
    if (u.protocol === "ws:" || u.protocol === "http:") return 80;
  } catch {
    return null;
  }
  return null;
}

/** 协议账号配置的 OneBot WS 端口（自 ws_url 或 Docker 映射解析） */
export function accountOnebotWsPort(account: NapcatAccountRow): number | null {
  const wsUrl = typeof account.ws_url === "string" ? account.ws_url : null;
  const fromUrl = parseUrlPort(wsUrl);
  if (fromUrl != null) return fromUrl;

  const docker = account.snowluma_docker_host_onebot_ws;
  if (docker != null && String(docker).trim() !== "") {
    const p = parseInt(String(docker), 10);
    if (Number.isFinite(p) && p >= 1 && p <= 65535) return p;
  }

  const publish = account.snowluma_publish_ports as
    | { items?: { label?: string; host?: number }[] }
    | undefined;
  const item = publish?.items?.find((i) => i.label === "OneBot WS");
  if (item?.host != null && item.host >= 1 && item.host <= 65535) return item.host;

  return null;
}

/** 已连接时展示 WS 端口，未连接为 — */
export function accountConnectedWsPortLabel(account: NapcatAccountRow): string {
  if (account.connected !== true) return "—";
  const port = accountOnebotWsPort(account);
  return port != null ? String(port) : "—";
}

export function accountWebUiHref(account: NapcatAccountRow, system: SystemData | null): string | null {
  const direct = accountNativeWebUiUrl(account);
  if (direct) return direct;
  const port = account.webui_port;
  if (port == null || port === "") return null;
  const portStr = String(port).trim();
  if (!portStr) return null;
  return replaceUrlPort(system, portStr);
}

export interface SnowlumaDockerNovncMeta {
  url?: string;
  bind_host?: string;
  host_port?: number;
  uses_default_vnc_password?: boolean;
}

/** SnowLuma Docker noVNC 桌面链接（`/vnc.html`） */
export function accountSnowlumaNovncHref(
  account: NapcatAccountRow | null,
  system: SystemData | null,
): string | null {
  if (!account) return null;
  const nv = account.snowluma_docker_novnc as SnowlumaDockerNovncMeta | undefined;
  const direct = String(nv?.url ?? "").trim();
  if (direct) return direct;
  const port = nv?.host_port;
  if (port == null || port < 1 || port > 65535) return null;
  const href = replaceUrlPort(system, String(port));
  if (!href) return null;
  try {
    const u = new URL(href);
    u.pathname = "/vnc.html";
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

export function snowlumaManagedWebuiPassword(account: NapcatAccountRow | null): string {
  return String(account?.snowluma_managed_webui_password ?? "").trim();
}

export function snowlumaRuntimeWebuiPassword(account: NapcatAccountRow | null): string {
  return String(account?.snowluma_runtime_webui_password ?? "").trim();
}

export function snowlumaNovncPasswordHint(account: NapcatAccountRow | null): string {
  const nv = account?.snowluma_docker_novnc as SnowlumaDockerNovncMeta | undefined;
  if (nv?.uses_default_vnc_password === false) {
    return "见服务端 PALLAS_PROTOCOL_SNOWLUMA_DOCKER_VNC_PASSWD";
  }
  return "vncpasswd（默认）";
}

function replaceUrlPort(system: SystemData | null, portStr: string): string | null {
  const base = botHttpBaseFromSystem(system);
  if (base) {
    try {
      const raw = base.includes("://") ? base : `http://${base}`;
      const u = new URL(raw);
      u.port = portStr;
      return u.toString();
    } catch {
      return null;
    }
  }
  if (typeof window === "undefined") return null;
  return `${window.location.protocol}//${window.location.hostname}:${portStr}`;
}

export function protocolSnapshot(data: InstancesData | null) {
  return data?.pallas_protocol ?? data?.napcat ?? null;
}

export function yn(v: unknown): string {
  if (v === true) return "是";
  if (v === false) return "否";
  return "—";
}
