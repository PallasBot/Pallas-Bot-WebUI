import axios, { isAxiosError } from "axios";

const baseRoot = () => ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
const apiBase = () => `${baseRoot()}/api`;

/** 登录页 / 401 跳转共用：校验 next，必须落在控制台基址下。 */
export function sanitizeConsoleNext(raw: string | null | undefined): string {
  const root = baseRoot();
  const fallback = `${root}/`;
  const next = (raw || "").trim();
  if (!next) return fallback;
  if (/^https?:\/\//i.test(next)) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (!next.startsWith(root)) return fallback;
  if (next === `${root}/login` || next.startsWith(`${root}/login?`) || next.startsWith(`${root}/login/`)) {
    return fallback;
  }
  return next;
}

export function isConsoleLoginPath(pathname = typeof window !== "undefined" ? window.location.pathname : ""): boolean {
  return pathname.endsWith("/login") || pathname.endsWith("/login/");
}

/** 会话失效：整页进入 SPA 登录（携带 next + reason）。 */
export function redirectToConsoleLogin(reason: string) {
  if (typeof window === "undefined") return;
  if (isConsoleLoginPath()) return;
  const root = baseRoot();
  const next = `${window.location.pathname || ""}${window.location.search || ""}${window.location.hash || ""}`;
  const q = new URLSearchParams();
  if (reason.trim()) q.set("reason", reason.trim());
  const safeNext = sanitizeConsoleNext(next);
  if (safeNext !== `${root}/`) q.set("next", safeNext);
  const qs = q.toString();
  window.location.assign(`${root}/login${qs ? `?${qs}` : ""}`);
}

/** POST /api/auth/login —— 不走全局 401 拦截，避免密码错误时循环跳转。 */
export async function postConsoleAuthLogin(password: string): Promise<void> {
  try {
    await axios.post(
      `${apiBase()}/auth/login`,
      { password },
      {
        timeout: 20000,
        withCredentials: true,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 401) {
      throw new Error("密码无效，请重试。");
    }
    if (isAxiosError(e)) {
      const d = e.response?.data;
      if (d && typeof d === "object") {
        const detail = (d as { detail?: unknown }).detail;
        if (typeof detail === "string" && detail.trim()) {
          throw new Error(detail);
        }
        const err = (d as { error?: unknown }).error;
        if (typeof err === "string" && err.trim() && err !== "validation_error") {
          throw new Error(err);
        }
      }
      if (e.response?.status === 422) {
        throw new Error("登录请求无效，请刷新页面后重试；若仍失败请重启 Bot。");
      }
      throw new Error(e.message || "登录失败");
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}
