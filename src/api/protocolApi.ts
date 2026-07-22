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
export type ProtocolQrcodeMeta = {
  exists?: boolean;
  updated_at?: number;
  host_deps?: { qr_capture_ready?: boolean; issues?: string[] };
  login_mode?: string;
  message?: string;
  available?: boolean;
  inject_hook?: Record<string, unknown>;
  inject_hook_error?: string;
};

export async function protocolFetchQrcodeImageBlob(
  mountUrl: string,
  accountId: string,
  updatedAt?: number,
): Promise<Blob> {
  const params =
    updatedAt != null && updatedAt > 0 ? { t: String(updatedAt) } : undefined;
  const { data } = await protocolHttp(mountUrl).get<Blob>(
    `/api/accounts/${encodeURIComponent(accountId)}/qrcode`,
    { params, responseType: "blob" },
  );
  return data;
}

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

export type ProtocolRuntimeProfile = {
  runtime_mode?: string;
  napcat_runtime_mode?: string;
  snowluma_runtime_mode?: string;
  target_platform?: string;
  docker_image?: string;
  snowluma_docker_image?: string;
  follow_bot_lifecycle?: boolean;
};

export type ProtocolRuntimeJob = {
  status?: string;
  message?: string;
  tag?: string;
};

export async function protocolFetchRuntimeProfile(mountUrl: string): Promise<ProtocolRuntimeProfile> {
  const { data } = await protocolHttp(mountUrl).get<{ profile?: ProtocolRuntimeProfile }>(
    "/api/runtime/profile",
  );
  return data?.profile ?? {};
}

export async function protocolUpdateRuntimeProfile(
  mountUrl: string,
  payload: ProtocolRuntimeProfile & { prune_containers?: string },
): Promise<ProtocolRuntimeProfile> {
  const { data } = await protocolHttp(mountUrl).put<{ profile?: ProtocolRuntimeProfile }>(
    "/api/runtime/profile",
    payload,
  );
  return data?.profile ?? {};
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

export async function protocolDownloadSnowlumaRuntime(
  mountUrl: string,
  params?: { tag?: string; target_platform?: string },
): Promise<Record<string, unknown>> {
  const q = new URLSearchParams();
  if (params?.tag) q.set("tag", params.tag);
  if (params?.target_platform) q.set("target_platform", params.target_platform);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    `/api/snowluma/runtime/download${suffix}`,
  );
  return data ?? {};
}

export async function protocolPullDockerImage(
  mountUrl: string,
  image?: string,
): Promise<{ ok?: boolean; image?: string; output?: string; code?: number }> {
  const body = image?.trim() ? { image: image.trim() } : {};
  const { data } = await protocolHttp(mountUrl).post<{
    ok?: boolean;
    image?: string;
    output?: string;
    code?: number;
  }>("/api/runtime/docker/pull", body);
  return data ?? {};
}

export async function protocolListDockerImages(
  mountUrl: string,
  protocol?: "napcat" | "snowluma",
): Promise<{ ok?: boolean; detail?: string; images?: string[] }> {
  const params = protocol ? { protocol } : undefined;
  const { data } = await protocolHttp(mountUrl).get<{
    ok?: boolean;
    detail?: string;
    images?: string[];
  }>("/api/runtime/docker/images", { params });
  return data ?? {};
}

export async function protocolCleanupRuntimeDist(mountUrl: string): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    "/api/runtime/cleanup-dist",
  );
  return data ?? {};
}

/** 协议内置页账号列表（运行态实时，与内置管理页 refreshAccounts 一致） */
export async function protocolListAccounts(mountUrl: string): Promise<NapcatAccountRow[]> {
  const { data } = await protocolHttp(mountUrl).get<AccountsListBody>("/api/accounts");
  return Array.isArray(data?.accounts) ? data.accounts : [];
}

export type SnowlumaRuntimeRow = {
  id: string;
  display_name?: string;
  data_dir?: string;
  webui_port?: number | string;
  member_account_ids?: string[];
  member_count?: number;
  process_running?: boolean;
  snowluma_managed_webui_password?: string;
  [key: string]: unknown;
};

export type ProtocolAccountConfigs = {
  napcat?: {
    bypass_enabled?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type ProtocolAccountRuntimeSwitch = {
  protocol_backend: "napcat" | "snowluma";
  docker_image?: string;
  runtime_mode: "new" | "existing";
  runtime_id?: string;
};

export async function protocolListSnowlumaRuntimes(
  mountUrl: string,
): Promise<SnowlumaRuntimeRow[]> {
  const { data } = await protocolHttp(mountUrl).get<{ runtimes?: SnowlumaRuntimeRow[] }>(
    "/api/snowluma/runtimes",
  );
  return Array.isArray(data?.runtimes) ? data.runtimes : [];
}

export async function protocolFetchAccountConfigs(
  mountUrl: string,
  accountId: string,
): Promise<ProtocolAccountConfigs> {
  const { data } = await protocolHttp(mountUrl).get<ProtocolAccountConfigs>(
    `/api/accounts/${encodeURIComponent(accountId)}/configs`,
  );
  return data ?? {};
}

export async function protocolUpdateAccountConfigs(
  mountUrl: string,
  accountId: string,
  configs: ProtocolAccountConfigs,
): Promise<ProtocolAccountConfigs> {
  const { data } = await protocolHttp(mountUrl).put<ProtocolAccountConfigs>(
    `/api/accounts/${encodeURIComponent(accountId)}/configs`,
    configs,
  );
  return data ?? {};
}

export async function protocolSwitchAccountRuntime(
  mountUrl: string,
  accountId: string,
  payload: ProtocolAccountRuntimeSwitch,
): Promise<NapcatAccountRow | null> {
  const { data } = await protocolHttp(mountUrl).post<AccountActionBody>(
    `/api/accounts/${encodeURIComponent(accountId)}/runtime-switch`,
    payload,
  );
  return data?.account ?? null;
}

export async function protocolCreateSnowlumaRuntime(
  mountUrl: string,
  payload: Record<string, unknown>,
): Promise<SnowlumaRuntimeRow | null> {
  const { data } = await protocolHttp(mountUrl).post<{ runtime?: SnowlumaRuntimeRow }>(
    "/api/snowluma/runtimes",
    payload,
  );
  return data?.runtime ?? null;
}

export async function protocolStartSnowlumaRuntime(
  mountUrl: string,
  runtimeId: string,
): Promise<SnowlumaRuntimeRow | null> {
  const { data } = await protocolHttp(mountUrl).post<{ runtime?: SnowlumaRuntimeRow }>(
    `/api/snowluma/runtimes/${encodeURIComponent(runtimeId)}/start`,
  );
  return data?.runtime ?? null;
}

export async function protocolStopSnowlumaRuntime(
  mountUrl: string,
  runtimeId: string,
): Promise<SnowlumaRuntimeRow | null> {
  const { data } = await protocolHttp(mountUrl).post<{ runtime?: SnowlumaRuntimeRow }>(
    `/api/snowluma/runtimes/${encodeURIComponent(runtimeId)}/stop`,
  );
  return data?.runtime ?? null;
}

export async function protocolDeleteSnowlumaRuntime(
  mountUrl: string,
  runtimeId: string,
  force = false,
): Promise<void> {
  await protocolHttp(mountUrl).delete(
    `/api/snowluma/runtimes/${encodeURIComponent(runtimeId)}`,
    { params: force ? { force: "1" } : undefined },
  );
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

/** 触发协议端重新生成二维码（NapCat WebUI / SnowLuma 截屏），返回最新 meta */
export async function protocolRefreshAccountQrcode(
  mountUrl: string,
  accountId: string,
): Promise<ProtocolQrcodeMeta> {
  const { data } = await protocolHttp(mountUrl).post<ProtocolQrcodeMeta>(
    `/api/accounts/${encodeURIComponent(accountId)}/qrcode/refresh`,
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

export async function protocolFetchAccount(
  mountUrl: string,
  accountId: string,
  opts?: { brief?: boolean },
): Promise<NapcatAccountRow | null> {
  const params = opts?.brief ? { brief: "1" } : undefined;
  const { data } = await protocolHttp(mountUrl).get<AccountActionBody>(
    `/api/accounts/${encodeURIComponent(accountId)}`,
    { params },
  );
  return data?.account ?? null;
}

export async function protocolUpdateAccount(
  mountUrl: string,
  accountId: string,
  payload: Record<string, unknown>,
  restart = true,
): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).put<Record<string, unknown>>(
    `/api/accounts/${encodeURIComponent(accountId)}`,
    payload,
    { params: { restart: restart ? "true" : "false" } },
  );
  return data ?? {};
}

export async function protocolFetchAccountLogs(
  mountUrl: string,
  accountId: string,
  lines = 120,
): Promise<string[]> {
  const { data } = await protocolHttp(mountUrl).get<{ logs?: string[] }>(
    `/api/accounts/${encodeURIComponent(accountId)}/logs`,
    { params: { lines: String(lines) } },
  );
  return Array.isArray(data?.logs) ? data.logs : [];
}

export async function protocolSnowlumaInjectHook(
  mountUrl: string,
  accountId: string,
): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    `/api/accounts/${encodeURIComponent(accountId)}/snowluma/inject-hook`,
  );
  return data ?? {};
}
