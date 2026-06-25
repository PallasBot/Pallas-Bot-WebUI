import { http } from "./http";

export interface HealthResponse {
  ok: boolean;
  nonebot2: string;
  pallas_bot: string;
  boot_id?: string;
  restarting?: boolean;
  restart_workers_only?: boolean;
  console: {
    static_root?: string;
    http_base?: string;
    version?: string;
    commit?: string;
    build_time?: string;
    pallas_webui_dev_mode?: boolean;
  };
}

let healthInflight: Promise<HealthResponse> | null = null;

export async function fetchHealth(options?: {
  bypassCache?: boolean;
  /** 重启探测：更短超时，避免离线阶段长时间挂起 */
  probe?: boolean;
}): Promise<HealthResponse> {
  if (options?.bypassCache || options?.probe) {
    const { data } = await http.get<HealthResponse>("/health", {
      params: { _ts: Date.now() },
      timeout: options?.probe ? 4000 : undefined,
    });
    return data;
  }
  if (!healthInflight) {
    healthInflight = (async () => {
      const { data } = await http.get<HealthResponse>("/health");
      return data;
    })().finally(() => {
      healthInflight = null;
    });
  }
  return healthInflight;
}
