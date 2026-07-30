/** AI Runtime 安装区主按钮：按 can_* 在下载 / 更新 / 仅 bootstrap 间切换。 */

export type AiInstallAction = "clone" | "bootstrap" | "clone_and_bootstrap" | "update";

export type AiInstallPrimary = {
  action: AiInstallAction;
  label: string;
  title: string;
  enabled: boolean;
};

export function resolveAiInstallPrimary(opts: {
  canClone: boolean;
  canBootstrap: boolean;
  canUpdate: boolean;
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
    return {
      action: "update",
      label: "更新 Runtime",
      title: "托管目录：git pull --ff-only 后重新 bootstrap",
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

/** 主按钮已是「更新」时，额外提供「仅重装依赖」作恢复入口。 */
export function showAiInstallBootstrapSecondary(opts: {
  canBootstrap: boolean;
  canUpdate: boolean;
}): boolean {
  return opts.canUpdate && opts.canBootstrap;
}
