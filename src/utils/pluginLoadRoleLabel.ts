import type { PluginLoadRole, PluginRow } from "@/api/pallasTypes";

const LOAD_WHERE: Record<PluginLoadRole, string> = {
  hub: "Hub",
  worker: "Worker",
  both: "Hub + Worker",
  infra: "依赖",
  internal: "Worker",
};

export type PluginCatalogProcessRole = "hub" | "worker" | "unified";

/** 分片部署下的角色文案；unified 时显示「本进程」，避免误解为 hub/worker 双进程。 */
export function loadRoleDisplayLabel(
  role: PluginLoadRole,
  catalog?: PluginCatalogProcessRole,
): string {
  if (catalog === "unified") {
    if (role === "infra") return "依赖";
    return "本进程";
  }
  return LOAD_WHERE[role] ?? "";
}

export function pluginLoadProcessTags(
  p: Pick<PluginRow, "load_role" | "catalog_process_role">,
): string[] {
  const catalog = p.catalog_process_role;
  if (!catalog || catalog === "unified") return [];
  const role = p.load_role;
  if (!role || role === "infra") return [];
  if (role === "both") return ["Hub", "Worker"];
  if (role === "hub") return ["Hub"];
  if (role === "worker" || role === "internal") return ["Worker"];
  return [];
}

export function pluginExpectsCatalogProcess(
  p: Pick<PluginRow, "load_role" | "expected_in_catalog_process">,
): boolean {
  if (p.expected_in_catalog_process !== undefined) {
    return p.expected_in_catalog_process;
  }
  const role = p.load_role;
  if (!role) return true;
  return role === "hub" || role === "infra" || role === "both";
}

export function pluginLoadWhere(
  p: Pick<PluginRow, "load_role" | "loaded_in_process" | "catalog_process_role" | "expected_in_catalog_process">,
): string {
  const role = p.load_role;
  if (!role) return "";
  const catalog = p.catalog_process_role;
  const loaded = p.loaded_in_process !== false;
  const expectsHere = pluginExpectsCatalogProcess(p);

  if ((role === "worker" || role === "internal") && catalog === "hub" && !loaded) {
    return "Worker 进程";
  }
  if (role === "infra") {
    if (!loaded && expectsHere) {
      return catalog === "hub" ? "Hub 未加载" : "未加载";
    }
    if (!loaded) {
      return "依赖";
    }
    return catalog === "hub" ? "依赖 · Hub" : "依赖";
  }
  if (!loaded && expectsHere) {
    if (catalog === "hub") return "Hub 未加载";
    if (catalog === "worker") return "Worker 未加载";
    return "未加载";
  }
  if (!loaded) {
    return loadRoleDisplayLabel(role, catalog);
  }
  if (catalog === "hub" && (role === "worker" || role === "internal")) {
    return "Worker 进程";
  }
  return loadRoleDisplayLabel(role, catalog);
}

export function pluginLoadBadgeText(
  p: Pick<
    PluginRow,
    "load_role" | "loaded_in_process" | "catalog_process_role" | "expected_in_catalog_process"
  >,
): string | null {
  if (p.loaded_in_process !== false) return null;
  if (!pluginExpectsCatalogProcess(p)) return null;
  const catalog = p.catalog_process_role;
  if (catalog === "hub") return "Hub 未加载";
  if (catalog === "worker") return "Worker 未加载";
  return "未加载";
}

export function pluginCountsAsLoadedInCatalog(
  p: Pick<PluginRow, "loaded_in_process" | "expected_in_catalog_process">,
): boolean {
  if (p.loaded_in_process !== false) return true;
  return !pluginExpectsCatalogProcess(p);
}

export function pluginCountsAsCatalogLoadProblem(
  p: Pick<PluginRow, "loaded_in_process" | "expected_in_catalog_process">,
): boolean {
  if (p.loaded_in_process !== false) return false;
  return pluginExpectsCatalogProcess(p);
}

export function hasPluginLoadWhere(
  p: Pick<PluginRow, "load_role" | "loaded_in_process">,
): boolean {
  return Boolean(p.load_role);
}

export function catalogProcessHint(catalog?: PluginCatalogProcessRole): string {
  if (catalog === "unified") {
    return "当前为单进程部署：下列「加载」均为本进程；启用多进程分片后，请以 Hub / 各 Worker 进程内的插件目录为准。";
  }
  if (catalog === "hub") {
    return "目录来自 Hub 进程：标注 Worker 的插件在分片 worker 中运行，Hub 未加载属正常。";
  }
  if (catalog === "worker") {
    return "目录来自 Worker 进程：仅反映本分片已加载的插件。";
  }
  return "";
}
