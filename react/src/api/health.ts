import { http } from "./http";

export interface HealthResponse {
  ok: boolean;
  nonebot2: string;
  pallas_bot: string;
  boot_id?: string;
  console: {
    static_root?: string;
    http_base?: string;
    version?: string;
    frontend?: string;
    pallas_webui_dev_mode?: boolean;
  };
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await http.get<HealthResponse>("/health");
  return data;
}
