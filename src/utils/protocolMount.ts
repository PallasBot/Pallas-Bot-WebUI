import type { ProtocolSnap, SystemData } from "@/api/console";

function joinHttpPath(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.trim();
  if (!p) return b;
  const p2 = p.startsWith("/") ? p : `/${p}`;
  return `${b}${p2}`;
}

export function resolveProtocolMountPath(snap: ProtocolSnap | null | undefined): string | null {
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

export function resolveProtocolMountUrl(
  system: SystemData | null | undefined,
  snap: ProtocolSnap | null | undefined,
): string | null {
  const mount = resolveProtocolMountPath(snap);
  if (!mount) return null;
  const httpBase = (system?.console as { http_base?: string } | undefined)?.http_base?.trim();
  if (httpBase && /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(httpBase)) {
    return joinHttpPath(httpBase, mount);
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}${mount}`;
  }
  return mount;
}
