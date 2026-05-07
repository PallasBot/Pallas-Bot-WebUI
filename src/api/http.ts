import axios from "axios";
import { ElMessage } from "element-plus";

// API 基础路径
const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;

export const http = axios.create({
  baseURL: apiBase,
  timeout: 20000,
});

/** 写操作鉴权键名 */
export const PALLAS_API_TOKEN_KEY = "pallas_webui_login_token_session";
const AUTH_MSG_COOLDOWN_MS = 4000;
let lastAuthMsgAt = 0;
let authRedirectScheduled = false;

function showAuthMessageOnce(msg: string) {
  const now = Date.now();
  if (now - lastAuthMsgAt < AUTH_MSG_COOLDOWN_MS) return;
  lastAuthMsgAt = now;
  ElMessage.error(msg);
}

/** Token 失效等与 SnowLuma 网关一致：清会话并回到后端登录页（整页），避免停在 SPA 内无效状态 */
function redirectToLoginPage(reason: string) {
  if (typeof window === "undefined" || authRedirectScheduled) return;
  const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
  const path = window.location.pathname || "";
  if (path.endsWith("/login") || path.endsWith("/login/")) return;
  authRedirectScheduled = true;
  try {
    sessionStorage.removeItem(PALLAS_API_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  const q = new URLSearchParams({ reason });
  window.location.assign(`${root}/login?${q.toString()}`);
}

http.interceptors.request.use((config) => {
  if (typeof sessionStorage !== "undefined") {
    const t = (sessionStorage.getItem(PALLAS_API_TOKEN_KEY) || "").trim();
    if (t) {
      const h = config.headers;
      if (h && typeof (h as { set?: (a: string, b: string) => void }).set === "function") {
        (h as { set: (a: string, b: string) => void }).set("X-Pallas-Token", t);
      } else {
        (config.headers as Record<string, string>)["X-Pallas-Token"] = t;
      }
    }
  }
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const detail = String(err?.response?.data?.detail || "");
    if (status === 401) {
      redirectToLoginPage(
        "控制台登录已失效或 Token 不正确，请重新登录；若从偏好设置使用会话 Token，请在登录后重新保存。",
      );
    } else if (status === 403 && detail.includes("pallas_webui_api_token 未配置")) {
      showAuthMessageOnce(
        "后端未配置 PALLAS_WEBUI_API_TOKEN：请先在 .env 设置后重启 Bot，再到「偏好与连接 → 访问与鉴权」填写同值。",
      );
    }
    return Promise.reject(err);
  },
);
