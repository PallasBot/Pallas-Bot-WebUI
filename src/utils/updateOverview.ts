export type AiRuntimeUpdateOverviewState = "update_available" | "current" | "external" | "unknown";

type AiRuntimeUpdateInput = {
  can_update?: boolean;
  has_update?: boolean | null;
  installed_ref?: string | null;
  latest_ref?: string | null;
  deployment?: string;
  layout?: string;
};

export function aiRuntimeUpdateOverview(input: AiRuntimeUpdateInput): {
  state: AiRuntimeUpdateOverviewState;
  label: string;
  current: string;
  remote: string;
} {
  const current = input.installed_ref || "—";
  const remote = input.latest_ref || "—";
  if (input.can_update && input.has_update === true) {
    return { state: "update_available", label: "有更新", current, remote };
  }
  if (input.can_update && input.has_update === false) {
    return { state: "current", label: "已是最新", current, remote };
  }
  if (input.deployment === "docker" || input.layout === "docker" || input.layout === "remote") {
    return { state: "external", label: "外部管理", current, remote };
  }
  return { state: "unknown", label: "待检查", current, remote };
}
