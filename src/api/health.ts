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

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>("/health");
  return data;
}
