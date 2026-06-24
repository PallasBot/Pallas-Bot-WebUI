import type { Router } from "vue-router";
import { consoleSetupSatisfied, loadConsoleSetupStatus, requiresConsoleSetup } from "@/state/consoleSetup";

function routeAllowsPendingSetup(routeName: string | null | undefined): boolean {
  return routeName === "setup-wizard" || routeName === "preferences";
}

export function installConsoleSetupGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const routeName = typeof to.name === "string" ? to.name : null;
    if (routeAllowsPendingSetup(routeName)) {
      return true;
    }
    const status = await loadConsoleSetupStatus();
    if (consoleSetupSatisfied(status)) {
      return true;
    }
    if (status && !requiresConsoleSetup(status)) {
      return true;
    }
    return {
      name: "setup-wizard",
      query: to.fullPath && to.fullPath !== "/setup" ? { redirect: to.fullPath } : undefined,
    };
  });
}
