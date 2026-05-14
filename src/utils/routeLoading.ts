import type { Router } from "vue-router";
import { ref } from "vue";

/** 首次进入控制台直至首屏路由就绪 */
export const initialShellLoading = ref(true);

let initialHideTimer: ReturnType<typeof setTimeout> | undefined;
let initialHideScheduled = false;

export function installRouteLoading(router: Router): void {
  router.afterEach(() => {
    if (initialShellLoading.value && !initialHideScheduled) {
      initialHideScheduled = true;
      initialHideTimer = setTimeout(() => {
        initialShellLoading.value = false;
        initialHideTimer = undefined;
      }, 40);
    }
  });

  router.onError(() => {
    initialShellLoading.value = false;
    initialHideScheduled = true;
    if (initialHideTimer) clearTimeout(initialHideTimer);
  });
}
