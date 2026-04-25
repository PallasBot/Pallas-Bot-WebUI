import type { InjectionKey, Ref, ShallowRef } from "vue";
import type { HealthResponse } from "@/api/health";

export interface PallasConnection {
  ok: Ref<boolean | null>;
  last: ShallowRef<HealthResponse | null>;
  refresh: () => Promise<void>;
  /** health 刷新计数 */
  healthTick: Ref<number>;
}

export const pallasConnectionKey: InjectionKey<PallasConnection> = Symbol("pallasConnection");
