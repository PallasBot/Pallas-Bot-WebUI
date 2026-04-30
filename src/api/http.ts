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

function showAuthMessageOnce(msg: string) {
  const now = Date.now();
  if (now - lastAuthMsgAt < AUTH_MSG_COOLDOWN_MS) return;
  lastAuthMsgAt = now;
  ElMessage.error(msg);
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
      showAuthMessageOnce("API 鉴权失败：请前往「偏好与连接 → 访问与鉴权」填写控制台 Token。");
    } else if (status === 403 && detail.includes("pallas_webui_api_token 未配置")) {
      showAuthMessageOnce(
        "后端未配置 PALLAS_WEBUI_API_TOKEN：请先在 .env 设置后重启 Bot，再到「偏好与连接 → 访问与鉴权」填写同值。",
      );
    }
    return Promise.reject(err);
  },
);
