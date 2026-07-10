import type { RouteLocationRaw } from "vue-router";

/** 已从通用配置迁往插件页的分区（含 legacy id）。 */
export const REMOVED_COMMON_CONFIG_SECTIONS = new Set([
  "cmd_perm",
  "command_limits",
  "pb_webui",
  "pb_protocol",
  "help",
  "pallas_webui",
  "pallas_protocol",
  "community_stats",
  "repeater_learn",
  "mail",
  "message_scrub",
  "ingress_fanout",
  "ingress_dispatch",
  "control_plane",
  "corpus_federation",
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
  if (id === "community_stats") {
    return { name: "plugins", params: { name: "pb_stats" } };
  }
  if (id === "repeater_learn") {
    return { name: "plugins", params: { name: "repeater" } };
  }
  if (
    id === "mail" ||
    id === "message_scrub" ||
    id === "ingress_fanout" ||
    id === "ingress_dispatch" ||
    id === "control_plane" ||
    id === "corpus_federation"
  ) {
    return { name: "plugins", params: { name: "pb_core" } };
  }
  return { name: "plugins", params: { name: "help" } };
}

/** 旧 /common-config 链接统一重定向（含 query.section 与 path 段 id）。 */
export function commonConfigLegacyRedirectTarget(sectionId: string): RouteLocationRaw {
  const id = sectionId.trim();
  if (id === "llm") {
    return { name: "ai-config", params: { section: "strategy" } };
  }
  if (id === "arknights_kb") {
    return { name: "ai-config", params: { section: "knowledge" } };
  }
  if (id === "service_gateways") {
    return { name: "plugins", params: { name: "draw" } };
  }
  const pluginRedirect = commonConfigSectionRedirectTarget(id);
  if (pluginRedirect) {
    return pluginRedirect;
  }
  return { name: "plugins" };
}
