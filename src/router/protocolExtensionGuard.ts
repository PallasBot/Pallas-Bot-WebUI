import type { Router } from "vue-router";
import { fetchInstances, peekInstancesCache } from "@/api/consoleApi";
import { isProtocolExtensionInstalled } from "@/utils/protocolExtension";

const PROTOCOL_SUBPAGE_ROUTE_NAMES = new Set([
  "protocol-create",
  "protocol-import",
  "protocol-assets",
]);

export function installProtocolExtensionGuard(router: Router): void {
  router.beforeEach(async (to) => {
    const routeName = typeof to.name === "string" ? to.name : null;
    if (!routeName || !PROTOCOL_SUBPAGE_ROUTE_NAMES.has(routeName)) {
      return true;
    }
    let instances = peekInstancesCache();
    if (!instances) {
      try {
        instances = await fetchInstances();
      } catch {
        return { name: "protocol" };
      }
    }
    if (!isProtocolExtensionInstalled(instances)) {
      return { name: "protocol" };
    }
    return true;
  });
}
