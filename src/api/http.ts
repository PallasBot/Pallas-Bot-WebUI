import axios, { isAxiosError } from "axios";
import { isConsoleLoginPath, redirectToConsoleLogin } from "@/api/consoleAuth";

// API 基础路径
const base = (import.meta.env.BASE_URL as string) || "/pallas/";
const apiBase = `${base.replace(/\/$/, "")}/api`;

/** 从 FastAPI 4xx/5xx 响应中提取 detail，供配置保存等场景展示。 */
export function axiosErrorDetail(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data;
    if (d && typeof d === "object") {
      if ("error" in d) {
        const errorText = (d as { error: unknown }).error;
        if (typeof errorText === "string" && errorText.trim()) {
          return errorText.trim();
        }
      }
      if ("detail" in d) {
        const detail = (d as { detail: unknown }).detail;
        if (typeof detail === "string" && detail.trim()) {
          const text = detail.trim();
          if (text === "Method Not Allowed") return "请求方法不被允许，请重启牛牛并更新控制台静态资源后重试";
          if (text === "Field required") return "缺少必填字段";
          return text;
        }
        if (Array.isArray(detail)) {
          const parts = detail
            .map((item) => {
              if (item && typeof item === "object" && "msg" in item) {
                const msg = (item as { msg: unknown }).msg;
                if (typeof msg === "string") {
                  const text = msg.trim();
                  if (text === "Field required") return "缺少必填字段";
                  return text;
                }
                return "";
              }
              return "";
            })
            .filter(Boolean);
          if (parts.length) return parts.join("；");
        }
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/** 静态 catch-all 未匹配到 API 路由时的 404（分片下常见于未重启 Hub）。 */
export function isCatchAllApiError(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const detail = err.response?.data;
  if (detail && typeof detail === "object" && "detail" in detail) {
    const text = String((detail as { detail: unknown }).detail ?? "");
    if (text.includes("catch-all") || text.includes("勿走静态")) return true;
  }
  return false;
}

export function catchAllApiHint(): string {
  return "接口未注册：请确认访问的是分片部署的主节点控制台入口，并已重启主节点加载最新代码。";
}

export const http = axios.create({
  baseURL: apiBase,
  timeout: 20000,
  withCredentials: true,
});

/** 数据库概览/大批量配置列表首次拉取可能较慢（大表计数、万级行） */
export const DB_HEAVY_READ_TIMEOUT_MS = 120_000;

/** 逻辑备份与后端 subprocess 上限对齐（秒级大库可能较慢） */
export const DB_BACKUP_TIMEOUT_MS = 3_600_000;

let authRedirectScheduled = false;

/** 会话失效：回到 SPA 登录页（整页），避免停在壳内无效状态 */
function redirectToLoginPage(reason: string) {
  if (typeof window === "undefined" || authRedirectScheduled) return;
  if (isConsoleLoginPath()) return;
  authRedirectScheduled = true;
  redirectToConsoleLogin(reason);
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const url = String(err?.config?.url ?? "");
    if (status === 401 && !url.includes("/auth/login")) {
      redirectToLoginPage("控制台登录已失效或口令不正确，请重新登录。");
    }
    return Promise.reject(err);
  },
);
