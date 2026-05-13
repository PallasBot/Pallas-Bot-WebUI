import type { Router } from "vue-router";
import { ref } from "vue";

/** 路由切换时短暂展示（主内容区遮罩） */
export const routeNavLoading = ref(false);

/** 首次进入控制台直至首屏路由就绪 */
export const initialShellLoading = ref(true);

let initialHideTimer: ReturnType<typeof setTimeout> | undefined;
let navHideTimer: ReturnType<typeof setTimeout> | undefined;
let initialHideScheduled = false;

const NAV_MIN_MS = 220;

export function installRouteLoading(router: Router): void {
  router.beforeEach((to, from, next) => {
    if (from.matched.length > 0 && to.fullPath !== from.fullPath) {
      routeNavLoading.value = true;
      if (navHideTimer) {
        clearTimeout(navHideTimer);
        navHideTimer = undefined;
      }
    }
    next();
  });

  router.afterEach(() => {
    if (initialShellLoading.value && !initialHideScheduled) {
      initialHideScheduled = true;
      initialHideTimer = setTimeout(() => {
        initialShellLoading.value = false;
        initialHideTimer = undefined;
      }, 380);
    }

    if (routeNavLoading.value) {
      navHideTimer = setTimeout(() => {
        routeNavLoading.value = false;
        navHideTimer = undefined;
      }, NAV_MIN_MS);
    }
  });

  router.onError(() => {
    routeNavLoading.value = false;
    initialShellLoading.value = false;
    initialHideScheduled = true;
    if (initialHideTimer) clearTimeout(initialHideTimer);
    if (navHideTimer) clearTimeout(navHideTimer);
  });
}
