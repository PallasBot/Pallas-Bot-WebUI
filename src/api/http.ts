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
export const PALLAS_API_TOKEN_KEY = "pallas-api-token";

http.interceptors.request.use((config) => {
  if (typeof localStorage !== "undefined") {
    const t = (localStorage.getItem(PALLAS_API_TOKEN_KEY) || "").trim();
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
    if (status === 401) {
      ElMessage.error("API 鉴权失败：请在「设置」中填写 Pallas 写操作 Token（与 pallas_webui_api_token 一致）。");
    }
    return Promise.reject(err);
  },
);
