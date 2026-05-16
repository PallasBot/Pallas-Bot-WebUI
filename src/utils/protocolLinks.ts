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

/** pallas_protocol 内置管理页 URL：``webui_path`` 在站点根下，勿与 ``console.http_base``（WebUI 前缀）拼接。 */
export function protocolDashboardUrl(system: SystemData | null, snap: NapcatManagerSnapshot | null): string | null {
  return protocolMountAbsoluteUrl(system, snap);
}

/** 协议账号工作区（详情） */
export function protocolAccountDetailUrl(
  system: SystemData | null,
  snap: NapcatManagerSnapshot | null,
  accountId: string,
): string | null {
  const root = protocolMountAbsoluteUrl(system, snap);
  const id = String(accountId ?? "").trim();
  if (!root || !id) return null;
  return `${root.replace(/\/$/, "")}/account/${encodeURIComponent(id)}`;
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

/** 协议账号 WebUI：优先 native_url，否则用 console.http_base 替换端口 */
export function accountWebUiHref(account: NapcatAccountRow, system: SystemData | null): string | null {
  const direct = accountNativeWebUiUrl(account);
  if (direct) return direct;
  const port = account.webui_port;
  if (port == null || port === "") return null;
  const base = botHttpBaseFromSystem(system);
  if (!base) return null;
  const portStr = String(port).trim();
  if (!portStr) return null;
  try {
    const raw = base.includes("://") ? base : `http://${base}`;
    const u = new URL(raw);
    u.port = portStr;
    return u.toString();
  } catch {
    return null;
  }
}

export function protocolSnapshot(data: InstancesData | null) {
  return data?.pallas_protocol ?? data?.napcat ?? null;
}

export function yn(v: unknown): string {
  if (v === true) return "是";
  if (v === false) return "否";
  return "—";
}
