import type { InjectionKey, Ref, ShallowRef } from "vue";
import type { HealthResponse } from "@/api/health";

export interface PallasConnection {
  ok: Ref<boolean | null>;
  last: ShallowRef<HealthResponse | null>;
  refresh: () => Promise<void>;
  /** 每次 health 拉取完成（含顶栏「刷新连接」）后递增，供总览日志等联动 */
  healthTick: Ref<number>;
}

export const pallasConnectionKey: InjectionKey<PallasConnection> = Symbol("pallasConnection");
