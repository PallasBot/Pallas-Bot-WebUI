import type { PluginLoadRole, PluginRow } from "@/api/pallasTypes";

const LOAD_WHERE: Record<PluginLoadRole, string> = {
  hub: "Hub",
  worker: "Worker",
  both: "Hub",
  infra: "Hub",
  internal: "Worker",
};

export function pluginLoadWhere(p: Pick<PluginRow, "load_role">): string {
  const role = p.load_role;
  if (!role) return "";
  return LOAD_WHERE[role] ?? "";
}

export function hasPluginLoadWhere(p: Pick<PluginRow, "load_role">): boolean {
  const role = p.load_role;
  return Boolean(role && role !== "infra");
}
