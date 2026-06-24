import { http } from "./http";

export interface HealthResponse {
  ok: boolean;
  nonebot2: string;
  pallas_bot: string;
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

export async function fetchHealth(options?: { bypassCache?: boolean }): Promise<HealthResponse> {
  if (options?.bypassCache) {
    const { data } = await http.get<HealthResponse>("/health", {
      params: { _ts: Date.now() },
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
