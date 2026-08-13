import type { PluginGovernanceBody } from "@/api/pallasTypes";

export type PluginGovernanceAction =
  | { kind: "global_disable"; value: boolean; revision?: string }
  | { kind: "help_hidden"; value: boolean }
  | { kind: "blocked_user_ids"; value: number[] }
  | { kind: "permissions" }
  | { kind: "limits" };

type BuildPluginGovernancePatchInput = {
  action: PluginGovernanceAction;
  permissionOverrides: Record<string, string>;
  limitOverrides: Record<string, number>;
};

export function buildPluginGovernancePatch({
  action,
  permissionOverrides,
  limitOverrides,
}: BuildPluginGovernancePatchInput): PluginGovernanceBody {
  switch (action.kind) {
    case "global_disable":
      return { global_disable: action.value, global_disable_revision: action.revision };
    case "help_hidden":
      return { help_hidden: action.value };
    case "blocked_user_ids":
      return { blocked_user_ids: action.value };
    case "permissions":
      return { command_permission_overrides: permissionOverrides };
    case "limits":
      return { command_limit_overrides: limitOverrides };
  }
}
