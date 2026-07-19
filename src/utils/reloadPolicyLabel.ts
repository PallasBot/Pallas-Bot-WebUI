/** PluginMetadata.extra reload_policy → 控制台展示文案 */
export function reloadPolicyLabel(policy?: string | null): string {
  switch ((policy || "config_only").trim().toLowerCase()) {
    case "metadata":
      return "配置与说明";
    case "full":
      return "含代码变更";
    default:
      return "仅配置";
  }
}
