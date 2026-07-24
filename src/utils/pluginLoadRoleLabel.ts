import type { PluginLoadRole, PluginRow } from "@/api/pallasTypes";

const LOAD_WHERE: Record<PluginLoadRole, string> = {
  hub: "主节点",
  worker: "分片节点",
  both: "主节点 + 分片节点",
  infra: "依赖",
  internal: "分片节点",
};

export type PluginCatalogProcessRole = "hub" | "worker" | "unified";

/** 分片部署插件加载角色文案；单进程时 unified 显示「本进程」。 */
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
  if (role === "both") return ["主节点", "分片节点"];
  if (role === "hub") return ["主节点"];
  if (role === "worker" || role === "internal") return ["分片节点"];
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
    return "分片节点进程";
  }
  if (role === "infra") {
    if (!loaded && expectsHere) {
      return catalog === "hub" ? "主节点未加载" : "未加载";
    }
    if (!loaded) {
      return "依赖";
    }
    return catalog === "hub" ? "依赖 · 主节点" : "依赖";
  }
  if (!loaded && expectsHere) {
    if (catalog === "hub") return "主节点未加载";
    if (catalog === "worker") return "分片节点未加载";
    return "未加载";
  }
  if (!loaded) {
    return loadRoleDisplayLabel(role, catalog);
  }
  if (catalog === "hub" && (role === "worker" || role === "internal")) {
    return "分片节点进程";
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
  if (catalog === "hub") return "主节点未加载";
  if (catalog === "worker") return "分片节点未加载";
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
    return "单进程部署：下列加载状态均指本进程。";
  }
  if (catalog === "hub") {
    return "目录来自主节点；分片插件在各节点运行属正常。";
  }
  if (catalog === "worker") {
    return "目录来自当前分片节点。";
  }
  return "";
}
