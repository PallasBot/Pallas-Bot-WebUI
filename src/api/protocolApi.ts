import axios, { type AxiosInstance, isAxiosError } from "axios";
import type { NapcatAccountRow } from "./pallasTypes";

function protocolHttp(mountUrl: string): AxiosInstance {
  const base = mountUrl.replace(/\/$/, "");
  const client = axios.create({
    baseURL: base,
    timeout: 120_000,
    withCredentials: true,
  });
  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err?.response?.status === 401 && typeof window !== "undefined") {
        const root = ((import.meta.env.BASE_URL as string) || "/pallas/").replace(/\/$/, "");
        const path = window.location.pathname || "";
        if (!path.endsWith("/login") && !path.endsWith("/login/")) {
          const q = new URLSearchParams({ reason: "控制台登录已失效，请重新登录。" });
          window.location.assign(`${root}/login?${q.toString()}`);
        }
      }
      return Promise.reject(err);
    },
  );
  return client;
}

export function protocolApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const d = err.response?.data;
    if (d && typeof d === "object" && "detail" in d) {
      const detail = (d as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }
    if (err.response?.status === 401) return "未登录或会话已失效";
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return fallback;
}

type AccountActionBody = { account?: NapcatAccountRow };

export async function protocolStartAccount(mountUrl: string, accountId: string): Promise<NapcatAccountRow | null> {
  const { data } = await protocolHttp(mountUrl).post<AccountActionBody>(
    `/api/accounts/${encodeURIComponent(accountId)}/start`,
  );
  return data?.account ?? null;
}

export async function protocolStopAccount(mountUrl: string, accountId: string): Promise<NapcatAccountRow | null> {
  const { data } = await protocolHttp(mountUrl).post<AccountActionBody>(
    `/api/accounts/${encodeURIComponent(accountId)}/stop`,
  );
  return data?.account ?? null;
}

export async function protocolDeleteAccount(mountUrl: string, accountId: string): Promise<void> {
  await protocolHttp(mountUrl).delete(`/api/accounts/${encodeURIComponent(accountId)}`);
}
