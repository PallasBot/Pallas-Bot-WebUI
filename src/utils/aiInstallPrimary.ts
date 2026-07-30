/** AI Runtime 安装区主按钮：按 can_* / has_update 在下载 / 更新 / 仅 bootstrap 间切换。 */

export type AiInstallAction = "clone" | "bootstrap" | "clone_and_bootstrap" | "update";

export type AiInstallPrimary = {
  action: AiInstallAction;
  label: string;
  title: string;
  enabled: boolean;
  /** false 时不渲染主按钮（已是最新）。默认 true。 */
  visible?: boolean;
};

export function resolveAiInstallPrimary(opts: {
  canClone: boolean;
  canBootstrap: boolean;
  canUpdate: boolean;
  hasUpdate?: boolean | null;
}): AiInstallPrimary {
  if (opts.canClone) {
    return {
      action: "clone_and_bootstrap",
      label: "下载并安装",
      title: "首次使用：拉取媒体服务源码并安装依赖",
      enabled: true,
    };
  }
  if (opts.canUpdate) {
    if (opts.hasUpdate === true) {
      return {
        action: "update",
        label: "更新 Runtime",
        title: "托管目录：git pull --ff-only 后重新 bootstrap",
        enabled: true,
      };
    }
    if (opts.hasUpdate === false) {
      return {
        action: "update",
        label: "更新 Runtime",
        title: "已是最新",
        enabled: false,
        visible: false,
      };
    }
    return {
      action: "update",
      label: "检查并更新",
      title: "未能确认是否有新版本：仍可 fetch 并尝试更新",
      enabled: true,
    };
  }
  if (opts.canBootstrap) {
    return {
      action: "bootstrap",
      label: "安装依赖",
      title: "已有源码目录：只重装依赖（非托管仓请自行 git pull）",
      enabled: true,
    };
  }
  return {
    action: "clone_and_bootstrap",
    label: "下载并安装",
    title: "当前环境无法在此安装或更新",
    enabled: false,
  };
}

/** 托管路径下提供「仅重装依赖」作修复入口（有更新 / 已最新 / 检查失败皆可）。 */
export function showAiInstallBootstrapSecondary(opts: {
  canBootstrap: boolean;
  canUpdate: boolean;
}): boolean {
  return opts.canUpdate && opts.canBootstrap;
}

/** 「安装与运行」区副文案：随安装 / 更新探测状态变化。 */
export function aiInstallSubtitle(opts: {
  localInstallUi: boolean;
  canClone: boolean;
  canUpdate: boolean;
  hasUpdate?: boolean | null;
}): string {
  if (!opts.localInstallUi) {
    return "Docker / 远端部署时，请在宿主机管理媒体服务。";
  }
  if (opts.canClone) {
    return "未安装时可「下载并安装」。";
  }
  if (opts.canUpdate && opts.hasUpdate === true) {
    return "有新版本可「更新 Runtime」；仅重装依赖用于修复。";
  }
  if (opts.canUpdate && opts.hasUpdate === false) {
    return "已是最新；依赖异常时用「仅重装依赖」修复。";
  }
  if (opts.canUpdate) {
    return "可「检查并更新」；仅重装依赖用于修复。刷新页面会重新探测远端。";
  }
  return "已有源码时可安装依赖；非托管仓请自行 git pull。";
}
