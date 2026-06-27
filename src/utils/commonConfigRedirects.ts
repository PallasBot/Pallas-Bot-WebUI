/** 已从通用配置迁往插件页的分区（含 legacy id）。 */
export const REMOVED_COMMON_CONFIG_SECTIONS = new Set([
  "cmd_perm",
  "command_limits",
  "pb_webui",
  "pb_protocol",
  "help",
  "pallas_webui",
  "pallas_protocol",
]);

export function commonConfigSectionRedirectTarget(
  sectionId: string,
): { name: "plugins"; params?: { name: string } } | null {
  const id = sectionId.trim();
  if (!id || !REMOVED_COMMON_CONFIG_SECTIONS.has(id)) return null;
  if (id === "cmd_perm" || id === "command_limits") {
    return { name: "plugins" };
  }
  if (id === "pb_webui" || id === "pallas_webui") {
    return { name: "plugins", params: { name: "pb_webui" } };
  }
  if (id === "pb_protocol" || id === "pallas_protocol") {
    return { name: "plugins", params: { name: "pb_protocol" } };
  }
  return { name: "plugins", params: { name: "help" } };
}
