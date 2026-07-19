import { onActivated, onDeactivated, ref, watch, type Ref } from "vue";
import { fetchInstances, peekInstancesCache, peekInstancesCacheAgeMs, refreshInstancesCatalogGlobal } from "@/api/consoleApi";
import type { InstancesData } from "@/api/pallasTypes";
import { instancesCatalogEpoch } from "@/utils/catalogSync";

type SyncOptions = {
  pageReady?: Ref<boolean>;
  reload?: (opts?: { bypassCache?: boolean }) => void | Promise<void>;
};

/**
 * keep-alive 页面：激活时强制对齐 /instances；协议端轮询 patch 缓存时通过 epoch 同步本地 ref。
 */
export function useInstancesCatalogSync(instancesRef: Ref<InstancesData | null>, opts?: SyncOptions) {
  const routeActive = ref(false);

  function applyCache() {
    const warm = peekInstancesCache();
    if (warm) instancesRef.value = warm;
  }

  async function refreshFromNetwork() {
    if (opts?.reload) {
      await opts.reload({ bypassCache: true });
      return;
    }
    try {
      instancesRef.value = await fetchInstances({ bypassCache: true });
    } catch {
      applyCache();
    }
  }

  watch(instancesCatalogEpoch, () => {
    if (!routeActive.value) return;
    applyCache();
  });

  onActivated(() => {
    routeActive.value = true;
    applyCache();
    if (opts?.pageReady && !opts.pageReady.value) return;
    void refreshFromNetwork();
  });

  onDeactivated(() => {
    routeActive.value = false;
  });

  return { applyCache, refreshFromNetwork };
}

/** AppShell 路由切换：缓存仍新鲜时跳过后台强制刷新，减轻与目标页抢带宽 */
export function scheduleInstancesCatalogRefreshOnRoute(): void {
  const age = peekInstancesCacheAgeMs();
  if (age != null && age < 45_000) return;
  void refreshInstancesCatalogGlobal().catch(() => {});
}
