import type {
  ExtensionActivationAction,
  ExtensionActivationPolicy,
} from "@/api/pallasTypes";

/** 官方扩展 activation_policy 在商店中的展示文案 */
export const EXTENSION_ACTIVATION_POLICY_LABELS: Record<
  Exclude<ExtensionActivationPolicy, null | undefined>,
  { catalog: string; detail: string; short: string }
> = {
  "hot-reloadable": {
    catalog: "尽量热更新",
    detail: "安装后通常不用重启；部分变更仍可能需要重启",
    short: "尽量热更新",
  },
  "workers-restart": {
    catalog: "须重启分片节点",
    detail: "分片部署下重启对应节点即可；单机需重启牛牛",
    short: "须重启分片节点",
  },
  "full-restart": {
    catalog: "须重启全部进程",
    detail: "变更后需重启牛牛进程才生效",
    short: "须重启全部",
  },
};

/** 社区插件商店展示（安装/更新策略与官方扩展不同） */
export const COMMUNITY_ACTIVATION_POLICY_LABELS: Record<
  Exclude<ExtensionActivationPolicy, null | undefined>,
  { catalog: string; detail: string; short: string }
> = {
  "hot-reloadable": {
    catalog: "单机可热更新",
    detail: "单机首次安装可立即生效；更新或卸载后通常须重启",
    short: "单机可热更新",
  },
  "workers-restart": {
    catalog: "须重启分片节点",
    detail: "更新后须重启分片节点或牛牛；不支持运行中热更",
    short: "须重启分片节点",
  },
  "full-restart": {
    catalog: "须重启全部进程",
    detail: "卸载后须重启牛牛，才能从内存中完全移除",
    short: "须重启全部",
  },
};

export function activationPolicyShortLabel(
  policy: ExtensionActivationPolicy | string | null | undefined,
): string {
  const key = (policy || "").trim() as ExtensionActivationPolicy;
  if (!key) return "";
  return (
    EXTENSION_ACTIVATION_POLICY_LABELS[key]?.short
    || COMMUNITY_ACTIVATION_POLICY_LABELS[key]?.short
    || key
  );
}

export function communityActivationCatalogHint(
  policy: ExtensionActivationPolicy | null | undefined,
): string {
  if (!policy) return "社区插件";
  return COMMUNITY_ACTIVATION_POLICY_LABELS[policy].catalog;
}

export function communityActivationDetailHint(
  policy: ExtensionActivationPolicy | null | undefined,
): string {
  if (!policy) return "社区插件";
  return COMMUNITY_ACTIVATION_POLICY_LABELS[policy].detail;
}

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
  if (action === "hot-reload") return "已热更新";
  if (result?.restart_scheduled) {
    if (action === "workers-restart") return "已安排重启分片节点";
    if (action === "full-restart") return "已安排重启全部进程";
    return "已安排重启";
  }
  if (extensionResultNeedsRestart(result)) {
    if (policy === "workers-restart") return "待重启分片节点";
    if (policy === "full-restart") return "待重启全部进程";
    return "待重启";
  }
  return "";
}
