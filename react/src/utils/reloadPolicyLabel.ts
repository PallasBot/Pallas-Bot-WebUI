export function reloadPolicyLabel(policy?: string | null): string {
  const p = (policy || "").trim().toLowerCase();
  if (!p || p === "none") return "无";
  if (p === "config") return "仅配置";
  if (p === "metadata") return "配置与说明";
  if (p === "code") return "含代码变更";
  return policy || "—";
}
