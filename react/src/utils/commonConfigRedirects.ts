/** 对齐 Vue `src/utils/commonConfigRedirects.ts`：旧 /common-config 深链去向 */

const REMOVED_COMMON_CONFIG_SECTIONS = new Set([
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

function commonConfigSectionRedirectTarget(sectionId: string): string | null {
  const id = sectionId.trim();
  if (!id || !REMOVED_COMMON_CONFIG_SECTIONS.has(id)) return null;
  if (id === "cmd_perm" || id === "command_limits") return "/plugins";
  if (id === "pb_webui" || id === "pallas_webui") return "/plugins/pb_webui";
  if (id === "pb_protocol" || id === "pallas_protocol") return "/plugins/pb_protocol";
  if (id === "community_stats") return "/plugins/pb_stats";
  if (id === "repeater_learn") return "/plugins/repeater";
  if (
    id === "mail" ||
    id === "message_scrub" ||
    id === "ingress_fanout" ||
    id === "ingress_dispatch" ||
    id === "control_plane" ||
    id === "corpus_federation"
  ) {
    return "/plugins/pb_core";
  }
  return "/plugins/help";
}

/** 旧 /common-config 链接统一重定向目标 path */
export function commonConfigLegacyRedirectPath(sectionId: string): string {
  const id = sectionId.trim();
  if (id === "llm") return "/ai/config/strategy";
  if (id === "arknights_kb") return "/ai/config/knowledge";
  if (id === "service_gateways") return "/ai/config/draw";
  return commonConfigSectionRedirectTarget(id) || "/plugins";
}
