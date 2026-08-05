import axios, { type AxiosInstance, isAxiosError } from "axios";
import { isConsoleLoginPath, redirectToConsoleLogin } from "@/api/consoleAuth";

export type NapcatAccountRow = {
  id?: string;
  qq?: string;
  display_name?: string;
  webui_port?: number | string;
  protocol_backend?: string;
  enabled?: boolean;
  ws_url?: string;
  connected?: boolean;
  process_running?: boolean;
  pid?: number;
  launch_ready?: boolean;
  launch_issues?: string[];
  [key: string]: unknown;
};

function protocolApiBase(mountUrl: string): string {
  const base = mountUrl.replace(/\/$/, "");
  if (base === "/pallas/protocol") return "/protocol/console";
  return base;
}

function protocolHttp(mountUrl: string): AxiosInstance {
  const client = axios.create({
    baseURL: protocolApiBase(mountUrl),
    timeout: 120_000,
    withCredentials: true,
  });
  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err?.response?.status === 401 && typeof window !== "undefined") {
        if (!isConsoleLoginPath()) {
          redirectToConsoleLogin("控制台登录已失效，请重新登录。");
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

export type ProtocolHotReloadResult = {
  attempted?: boolean;
  reloaded?: boolean;
  online?: boolean;
  applied?: boolean;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

export type ProtocolAccountUpdateResult = {
  account?: NapcatAccountRow;
  restarted?: boolean;
  needs_restart?: boolean;
  hot_reload?: ProtocolHotReloadResult | null;
};

type AccountActionBody = ProtocolAccountUpdateResult;
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

export type ProtocolRuntimeProfile = {
  runtime_mode?: string;
  napcat_runtime_mode?: string;
  snowluma_runtime_mode?: string;
  target_platform?: string;
  docker_image?: string;
  snowluma_docker_image?: string;
  follow_bot_lifecycle?: boolean;
  default_protocol_backend?: "napcat" | "snowluma";
};

export type ProtocolRuntimeJob = {
  status?: string;
  message?: string;
  tag?: string;
};

export type SnowlumaRuntimeRow = {
  id: string;
  display_name?: string;
  data_dir?: string;
  webui_port?: number | string;
  member_account_ids?: string[];
  member_count?: number;
  process_running?: boolean;
  snowluma_managed_webui_password?: string;
  snowluma_docker_image?: string;
  [key: string]: unknown;
};

export type SnowlumaRuntimeImageSwitchMode = "rebuild_all" | "next_start";

export type SnowlumaRuntimeImageSwitchResult = {
  id: string;
  was_running?: boolean;
  config_saved?: boolean;
  stopped?: boolean;
  removed?: boolean;
  started?: boolean;
  final_state?: string;
  error?: string;
};

export type SnowlumaRuntimeImageSwitchJob = {
  job_id?: string;
  status?: string;
  message?: string;
  image?: string;
  apply_mode?: SnowlumaRuntimeImageSwitchMode;
  results?: SnowlumaRuntimeImageSwitchResult[];
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
  snowluma_docker_image?: string;
  runtime_mode: "new" | "existing";
  runtime_id?: string;
};

export type ProtocolDockerImageRow = {
  name?: string;
  id?: string;
  created_since?: string;
  size?: string;
  [key: string]: unknown;
};

export async function protocolFetchQrcodeImageBlob(
  mountUrl: string,
  accountId: string,
  updatedAt?: number,
): Promise<Blob> {
  const params = updatedAt != null && updatedAt > 0 ? { t: String(updatedAt) } : undefined;
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

export async function protocolFetchBatchJob(mountUrl: string, jobId: string): Promise<ProtocolBatchJobPayload> {
  const { data } = await protocolHttp(mountUrl).get<{ job: ProtocolBatchJobPayload }>(
    `/api/accounts/batch/${encodeURIComponent(jobId)}`,
  );
  return data.job;
}

export function protocolStreamBatchJob(mountUrl: string, jobId: string): EventSource {
  const base = protocolApiBase(mountUrl);
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
  protocol?: "napcat" | "snowluma",
): Promise<{
  job_id?: string;
  job?: ProtocolDockerPullJob;
  ok?: boolean;
  image?: string;
  output?: string;
  code?: number;
  rebuild_image?: string;
  rebuild_ok?: boolean;
}> {
  const body: Record<string, string> = {};
  const img = image?.trim();
  if (img) body.image = img;
  if (protocol) body.protocol = protocol;
  const { data } = await protocolHttp(mountUrl).post<{
    job_id?: string;
    job?: ProtocolDockerPullJob;
    ok?: boolean;
    image?: string;
    output?: string;
    code?: number;
    rebuild_image?: string;
    rebuild_ok?: boolean;
  }>("/api/runtime/docker/pull", body);
  return data ?? {};
}

export type ProtocolDockerPullJob = {
  job_id: string;
  protocol?: string;
  image?: string;
  phase?: string;
  status?: string;
  message?: string;
  output?: string;
  rebuild_image?: string | null;
  rebuild_ok?: boolean | null;
  progress_percent?: number;
  code?: number | null;
  started_at?: string;
  finished_at?: string | null;
};

export async function protocolFetchDockerPullJob(
  mountUrl: string,
  jobId: string,
): Promise<ProtocolDockerPullJob> {
  const { data } = await protocolHttp(mountUrl).get<{ job?: ProtocolDockerPullJob }>(
    `/api/runtime/docker/pull/${encodeURIComponent(jobId)}`,
  );
  if (!data?.job) throw new Error("拉取任务不存在");
  return data.job;
}

export function protocolStreamDockerPullJob(mountUrl: string, jobId: string): EventSource {
  const base = protocolApiBase(mountUrl);
  return new EventSource(`${base}/api/runtime/docker/pull/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
}

export async function protocolListDockerImages(
  mountUrl: string,
  protocol?: "napcat" | "snowluma",
): Promise<{ ok?: boolean; detail?: string; images?: ProtocolDockerImageRow[] }> {
  const params = protocol ? { protocol } : undefined;
  const { data } = await protocolHttp(mountUrl).get<{
    ok?: boolean;
    detail?: string;
    images?: ProtocolDockerImageRow[];
  }>("/api/runtime/docker/images", { params });
  return data ?? {};
}

export async function protocolCleanupRuntimeDist(mountUrl: string): Promise<Record<string, unknown>> {
  const { data } = await protocolHttp(mountUrl).post<Record<string, unknown>>(
    "/api/runtime/cleanup-dist",
  );
  return data ?? {};
}

export async function protocolListAccounts(mountUrl: string): Promise<NapcatAccountRow[]> {
  const { data } = await protocolHttp(mountUrl).get<AccountsListBody>("/api/accounts");
  return Array.isArray(data?.accounts) ? data.accounts : [];
}

export async function protocolListSnowlumaRuntimes(
  mountUrl: string,
  opts?: { lite?: boolean },
): Promise<SnowlumaRuntimeRow[]> {
  const { data } = await protocolHttp(mountUrl).get<{ runtimes?: SnowlumaRuntimeRow[] }>(
    "/api/snowluma/runtimes",
    opts?.lite ? { params: { lite: 1 } } : undefined,
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

export async function protocolUpdateSnowlumaRuntime(
  mountUrl: string,
  runtimeId: string,
  payload: { snowluma_docker_image: string },
): Promise<SnowlumaRuntimeRow | null> {
  const { data } = await protocolHttp(mountUrl).put<{ runtime?: SnowlumaRuntimeRow }>(
    `/api/snowluma/runtimes/${encodeURIComponent(runtimeId)}`,
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
  await protocolHttp(mountUrl).delete(`/api/snowluma/runtimes/${encodeURIComponent(runtimeId)}`, {
    params: force ? { force: "1" } : undefined,
  });
}

export async function protocolStartSnowlumaRuntimeImageSwitch(
  mountUrl: string,
  body: { image: string; apply_mode: SnowlumaRuntimeImageSwitchMode },
): Promise<{ ok?: boolean; job_id: string; job: SnowlumaRuntimeImageSwitchJob }> {
  const { data } = await protocolHttp(mountUrl).post<{
    ok?: boolean;
    job_id: string;
    job: SnowlumaRuntimeImageSwitchJob;
  }>("/api/snowluma/runtimes/image-switch", body);
  return data;
}

export async function protocolFetchSnowlumaRuntimeImageSwitchJob(
  mountUrl: string,
  jobId: string,
): Promise<SnowlumaRuntimeImageSwitchJob> {
  const { data } = await protocolHttp(mountUrl).get<{ job: SnowlumaRuntimeImageSwitchJob }>(
    `/api/snowluma/runtimes/image-switch/${encodeURIComponent(jobId)}`,
  );
  return data.job;
}

export function protocolStreamSnowlumaRuntimeImageSwitchJob(mountUrl: string, jobId: string): EventSource {
  const base = protocolApiBase(mountUrl);
  return new EventSource(`${base}/api/snowluma/runtimes/image-switch/${encodeURIComponent(jobId)}/stream`, {
    withCredentials: true,
  });
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

export async function protocolFetchQrcodeMeta(mountUrl: string, accountId: string): Promise<ProtocolQrcodeMeta> {
  const { data } = await protocolHttp(mountUrl).get<ProtocolQrcodeMeta>(
    `/api/accounts/${encodeURIComponent(accountId)}/qrcode/meta`,
  );
  return data ?? {};
}

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
  const base = protocolApiBase(mountUrl);
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
): Promise<ProtocolAccountUpdateResult> {
  const { data } = await protocolHttp(mountUrl).put<ProtocolAccountUpdateResult>(
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
