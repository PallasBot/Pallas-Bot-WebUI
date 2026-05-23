import type { PluginLoadRole, PluginRow } from "@/api/pallasTypes";

const LOAD_WHERE: Record<PluginLoadRole, string> = {
  hub: "Hub",
  worker: "Worker",
  both: "Hub",
  infra: "依赖",
  internal: "Worker",
};

export function pluginLoadWhere(
  p: Pick<PluginRow, "load_role" | "loaded_in_process">,
): string {
  const role = p.load_role;
  if (!role) return "";
  if (role === "infra" && p.loaded_in_process === false) return "未加载";
  return LOAD_WHERE[role] ?? "";
}

export function hasPluginLoadWhere(
  p: Pick<PluginRow, "load_role" | "loaded_in_process">,
): boolean {
  return Boolean(p.load_role);
}
