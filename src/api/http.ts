import axios, { isAxiosError } from "axios";

// API 基础路径
const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;

/** 从 FastAPI 4xx/5xx 响应中提取 detail，供配置保存等场景展示。 */
export function axiosErrorDetail(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data;
    if (d && typeof d === "object" && "detail" in d) {
      const detail = (d as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export const http = axios.create({
  baseURL: apiBase,
  timeout: 20000,
  withCredentials: true,
});

let authRedirectScheduled = false;

/** 会话失效：回到后端登录页（整页），避免停在 SPA 内无效状态 */
function redirectToLoginPage(reason: string) {
  if (typeof window === "undefined" || authRedirectScheduled) return;
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const path = window.location.pathname || "";
  if (path.endsWith("/login") || path.endsWith("/login/")) return;
  authRedirectScheduled = true;
  const q = new URLSearchParams({ reason });
  window.location.assign(`${root}/login?${q.toString()}`);
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      redirectToLoginPage("控制台登录已失效或口令不正确，请重新登录。");
    }
    return Promise.reject(err);
  },
);
