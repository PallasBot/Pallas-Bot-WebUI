import axios from "axios";

// API 基础路径
const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;

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
