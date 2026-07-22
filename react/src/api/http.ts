import axios, { isAxiosError } from "axios";

const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;

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

let authRedirectScheduled = false;

function redirectToLoginPage(reason: string) {
  if (typeof window === "undefined" || authRedirectScheduled) return;
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const path = window.location.pathname || "";
  if (path.endsWith("/login") || path.endsWith("/login/")) return;
  authRedirectScheduled = true;
  const q = new URLSearchParams({ reason });
  window.location.assign(`${root}/login?${q.toString()}`);
}

export const http = axios.create({
  baseURL: apiBase,
  timeout: 20000,
  withCredentials: true,
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      redirectToLoginPage("控制台登录已失效或口令不正确，请重新登录。");
    }
    return Promise.reject(err);
  },
);
