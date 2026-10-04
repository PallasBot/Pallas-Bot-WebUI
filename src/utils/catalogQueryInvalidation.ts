import type { QueryClient } from "@tanstack/react-query";
import { invalidateInstancesCache } from "@/api/consoleApi";

export function invalidatePluginCatalogQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["plugins"] }),
    queryClient.invalidateQueries({ queryKey: ["plugins-catalog"] }),
    queryClient.invalidateQueries({ queryKey: ["plugin-row"] }),
    queryClient.invalidateQueries({ queryKey: ["home-overview"] }),
  ]);
}

export function invalidateInstanceCatalogQueries(queryClient: QueryClient) {
  invalidateInstancesCache();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["instances"] }),
    queryClient.invalidateQueries({ queryKey: ["home-overview"] }),
  ]);
}
