/** 懒加载路由 chunk，供 router 与侧栏预取共用 */

export const routeChunkLoaders: Record<string, () => Promise<unknown>> = {
  charts: () => import("@/pages/ChartsPage.vue"),
  logs: () => import("@/pages/LogsPage.vue"),
  "log-errors": () => import("@/pages/LogErrorsPage.vue"),
  plugins: () => import("@/pages/PluginsPage.vue"),
  "plugin-store": () => import("@/pages/PluginStorePage.vue"),
  "common-config": () => import("@/pages/CommonConfigPage.vue"),
  instances: () => import("@/pages/InstancesPage.vue"),
  protocol: () => import("@/pages/ProtocolManagePage.vue"),
  database: () => import("@/pages/DatabasePage.vue"),
  "database-backups": () => import("@/pages/DatabaseBackupsPage.vue"),
  update: () => import("@/pages/UpdatePage.vue"),
  "ai-config": () => import("@/pages/AiExtensionPage.vue"),
  "ai-home": () => import("@/pages/AiHomePage.vue"),
  "ai-statistics": () => import("@/pages/AiStatisticsPage.vue"),
  "ai-history": () => import("@/pages/AiHistoryPage.vue"),
  "ai-wizard": () => import("@/pages/AiWizardPage.vue"),
  "ai-runtime": () => import("@/pages/AiRuntimeOverviewPage.vue"),
  "friends-groups": () => import("@/pages/FriendsGroupsPage.vue"),
  preferences: () => import("@/pages/PreferencesPage.vue"),
  "setup-wizard": () => import("@/pages/SetupWizardPage.vue"),
  community: () => import("@/pages/CommunityPage.vue"),
};

const prefetched = new Set<string>();

export function prefetchRouteChunkByName(name: string): void {
  const key = name.trim();
  if (!key || prefetched.has(key)) return;
  const loader = routeChunkLoaders[key];
  if (!loader) return;
  prefetched.add(key);
  void loader().catch(() => {
    prefetched.delete(key);
  });
}

/** 侧栏 path → 路由 name */
const pathToRouteName: Record<string, string> = {
  "/": "home",
  "/charts": "charts",
  "/logs": "logs",
  "/log-errors": "log-errors",
  "/plugins": "plugins",
  "/plugin-store": "plugin-store",
  "/common-config": "common-config",
  "/instances": "instances",
  "/protocol": "protocol",
  "/database": "database",
  "/database/backups": "database-backups",
  "/update": "update",
  "/ai/home": "ai-home",
  "/ai/statistics": "ai-statistics",
  "/ai/history": "ai-history",
  "/ai/wizard": "ai-wizard",
  "/ai/runtime": "ai-runtime",
  "/ai/config": "ai-config",
  "/friends-groups": "friends-groups",
  "/preferences": "preferences",
  "/setup": "setup-wizard",
  "/community": "community",
};

export function prefetchRouteChunkByPath(path: string): void {
  const normalized = path.trim() || "/";
  const name = pathToRouteName[normalized];
  if (!name || name === "home") return;
  prefetchRouteChunkByName(name);
}

const PRIORITY_PREFETCH_NAMES = ["charts", "logs", "log-errors"] as const;

export function prefetchPriorityRouteChunks(): void {
  for (const name of PRIORITY_PREFETCH_NAMES) {
    prefetchRouteChunkByName(name);
  }
}
