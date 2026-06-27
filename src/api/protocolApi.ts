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
type AccountsListBody = { accounts?: NapcatAccountRow[] };
export type ProtocolBatchJobPayload = {
  job_id: string;
  action: string;
  mode: string;
  account_ids: string[];
  phase: string;
  total: number;
  completed: number;
  current_account_id?: string | null;
  status: string;
  message?: string;
  results?: { account_id: string; ok: boolean; error?: string }[];
};

export type ProtocolBatchRequest = {
  action: "restart" | "start" | "stop";
  account_ids?: string[];
  mode?: "rolling" | "parallel";
  max_concurrency?: number;
  stagger_ms?: number;
};

export type ProtocolRuntimeOverview = Record<string, unknown>;
export type ProtocolQrcodeMeta = { exists?: boolean; updated_at?: number };

export async function protocolStartAccountBatch(
  mountUrl: string,
  body: ProtocolBatchRequest,
): Promise<{ job_id: string; job: ProtocolBatchJobPayload }> {
  const { data } = await protocolHttp(mountUrl).post<{ job_id: string; job: ProtocolBatchJobPayload }>(
    "/api/accounts/batch",
    body,
  );
  return data;
}

export async function protocolFetchBatchJob(
  mountUrl: string,
  jobId: string,
): Promise<ProtocolBatchJobPayload> {
  const { data } = await protocolHttp(mountUrl).get<{ job: ProtocolBatchJobPayload }>(
    `/api/accounts/batch/${encodeURIComponent(jobId)}`,
  );
  return data.job;
}

export function protocolStreamBatchJob(mountUrl: string, jobId: string): EventSource {
  const base = mountUrl.replace(/\/$/, "");
  return new EventSource(`${base}/api/accounts/batch/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
}

export async function protocolCreateAccount(
  mountUrl: string,
  payload: Record<string, unknown>,
): Promise<NapcatAccountRow | null> {
  const { data } = await protocolHttp(mountUrl).post<AccountActionBody>("/api/accounts", payload);
  return data?.account ?? null;
}

export async function protocolImportAccounts(
  mountUrl: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    "/api/accounts/import",
    payload,
  );
  return data ?? {};
}

export async function protocolFetchRuntimeOverview(mountUrl: string): Promise<ProtocolRuntimeOverview> {
  const { data } = await protocolHttp(mountUrl).get<ProtocolRuntimeOverview>("/api/runtime");
  return data ?? {};
}

export async function protocolFetchRuntimeProfile(mountUrl: string): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).get<Record<string, unknown>>("/api/runtime/profile");
  return data ?? {};
}

export async function protocolDownloadRuntime(
  mountUrl: string,
  params?: { tag?: string; target_platform?: string },
): Promise<Record<string, unknown>> {
  const q = new URLSearchParams();
  if (params?.tag) q.set("tag", params.tag);
  if (params?.target_platform) q.set("target_platform", params.target_platform);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    `/api/runtime/download${suffix}`,
  );
  return data ?? {};
}

/** 协议内置页账号列表（运行态实时，与内置管理页 refreshAccounts 一致） */
export async function protocolListAccounts(mountUrl: string): Promise<NapcatAccountRow[]> {
  const { data } = await protocolHttp(mountUrl).get<AccountsListBody>("/api/accounts");
  return Array.isArray(data?.accounts) ? data.accounts : [];
}

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

export async function protocolRestartAccount(
  mountUrl: string,
  accountId: string,
): Promise<NapcatAccountRow | null> {
  const { data } = await protocolHttp(mountUrl).post<AccountActionBody>(
    `/api/accounts/${encodeURIComponent(accountId)}/restart`,
  );
  return data?.account ?? null;
}

export async function protocolDeleteAccount(mountUrl: string, accountId: string): Promise<void> {
  await protocolHttp(mountUrl).delete(`/api/accounts/${encodeURIComponent(accountId)}`);
}

export async function protocolFetchQrcodeMeta(
  mountUrl: string,
  accountId: string,
): Promise<ProtocolQrcodeMeta> {
  const { data } = await protocolHttp(mountUrl).get<ProtocolQrcodeMeta>(
    `/api/accounts/${encodeURIComponent(accountId)}/qrcode/meta`,
  );
  return data ?? {};
}

export function protocolQrcodeImageUrl(
  mountUrl: string,
  accountId: string,
  updatedAt?: number,
): string {
  const base = mountUrl.replace(/\/$/, "");
  const q = updatedAt != null && updatedAt > 0 ? `?t=${updatedAt}` : "";
  return `${base}/api/accounts/${encodeURIComponent(accountId)}/qrcode${q}`;
}
