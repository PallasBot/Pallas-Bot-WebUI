/** PluginMetadata.extra reload_policy → 控制台展示文案 */
export function reloadPolicyLabel(policy?: string | null): string {
  switch ((policy || "config_only").trim().toLowerCase()) {
    case "metadata":
      return "L2 元数据";
    case "full":
      return "L3 代码";
    default:
      return "L1 配置";
  }
}
