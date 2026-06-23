import type {
  ExtensionActivationAction,
  ExtensionActivationPolicy,
} from "@/api/pallasTypes";

/** 官方扩展 activation_policy 在商店中的展示文案（区分声明策略与当前实际行为） */
export const EXTENSION_ACTIVATION_POLICY_LABELS: Record<
  Exclude<ExtensionActivationPolicy, null | undefined>,
  { catalog: string; detail: string }
> = {
  "hot-reloadable": {
    catalog: "声明可热加载",
    detail: "声明可热加载 · 当前仍需重启生效",
  },
  "workers-restart": {
    catalog: "Worker 重启生效",
    detail: "分片部署下重启 Worker 即可；单机需重启 Bot",
  },
  "full-restart": {
    catalog: "全进程重启",
    detail: "需全进程重启后生效",
  },
};

export function extensionActivationCatalogHint(
  policy: ExtensionActivationPolicy | null | undefined,
): string {
  if (!policy) return "官方插件";
  return EXTENSION_ACTIVATION_POLICY_LABELS[policy].catalog;
}

export function extensionActivationDetailHint(
  policy: ExtensionActivationPolicy | null | undefined,
): string {
  if (!policy) return "官方插件";
  return EXTENSION_ACTIVATION_POLICY_LABELS[policy].detail;
}

export function extensionResultNeedsRestart(result: {
  needs_restart?: boolean;
  restart_scheduled?: boolean;
} | null): boolean {
  return Boolean(result?.needs_restart) && !Boolean(result?.restart_scheduled);
}

export function extensionResultAction(
  result: { activation_action?: ExtensionActivationAction | null } | null,
): ExtensionActivationAction | null {
  return (result?.activation_action || null) as ExtensionActivationAction | null;
}

export function extensionActionStateLabel(
  policy: ExtensionActivationPolicy | null | undefined,
  result: {
    needs_restart?: boolean;
    restart_scheduled?: boolean;
    activation_action?: ExtensionActivationAction | null;
  } | null,
): string {
  const action = extensionResultAction(result);
  if (action === "hot-reload") return "已热重载";
  if (result?.restart_scheduled) {
    if (action === "workers-restart") return "已安排 Worker 重启";
    if (action === "full-restart") return "已安排全栈重启";
    return "已安排重启";
  }
  if (extensionResultNeedsRestart(result)) {
    if (policy === "workers-restart") return "待重启 Worker";
    if (policy === "full-restart") return "待全栈重启";
    return "待重启";
  }
  return "";
}
