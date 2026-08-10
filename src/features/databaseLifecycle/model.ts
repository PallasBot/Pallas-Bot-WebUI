type LifecycleRisk = "low" | "medium" | "high";

export function formatLifecycleBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0 B";
  const gib = 1024 ** 3;
  const mib = 1024 ** 2;
  if (value >= gib) return `${(value / gib).toFixed(value >= 10 * gib ? 0 : 1)} GiB`;
  if (value >= mib) return `${(value / mib).toFixed(value >= 10 * mib ? 0 : 1)} MiB`;
  return `${Math.round(value / 1024)} KiB`;
}

export function lifecycleRiskMeta(risk: LifecycleRisk): { label: string; className: string } {
  if (risk === "high") return { label: "高风险", className: "badge badge--err" };
  if (risk === "medium") return { label: "中风险", className: "badge badge--warn" };
  return { label: "低风险", className: "badge badge--ok" };
}

export function objectMaintenanceAllowed(object: { protected: boolean; error?: string | null }): boolean {
  return !object.protected && !object.error;
}
