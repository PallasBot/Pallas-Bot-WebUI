import { useState } from "react";
import { Link } from "react-router-dom";
import { axiosErrorDetail } from "@/api/http";
import { putPluginConfig } from "@/api/console";
import ConsoleSwitch from "@/components/ConsoleSwitch";
import { pushConsoleToast } from "@/utils/consoleToast";

const PB_WEBUI_PLUGIN = "pb_webui";

const DEV_MODE_TOOLTIP =
  "联调时可跳过登录与 API token；保存后立即生效，无需重启 Bot。CORS 等中间件变更仍需重启 hub。";

const enableConfirmText =
  "开启开发模式将跳过控制台 JSON API 与静态页登录鉴权，任何能访问该地址的人均可读写控制台。\n\n仅在受信任的本机/内网联调时使用，生产环境务必保持关闭。\n\n确定开启？";

export default function ConsoleDevModePanel({
  active,
  compact = false,
  toolbar = false,
  prefsRow = false,
  showBanner = true,
  showPanel = true,
  onUpdated,
}: {
  active: boolean;
  compact?: boolean;
  toolbar?: boolean;
  /** 偏好页：与其它开关同行左文案右开关 */
  prefsRow?: boolean;
  showBanner?: boolean;
  showPanel?: boolean;
  onUpdated?: (active: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const switchLabel = active ? "开发模式已开启" : "开发模式已关闭";
  const showDevBanner = showBanner && active && !toolbar && !prefsRow;

  async function applyDevMode(next: boolean) {
    if (busy) return;
    if (next && !window.confirm(enableConfirmText)) return;
    if (!next && !window.confirm("关闭后将恢复控制台 API 与页面登录鉴权。确定关闭开发模式？")) return;
    setBusy(true);
    setErr("");
    try {
      await putPluginConfig(PB_WEBUI_PLUGIN, { pallas_webui_dev_mode: next });
      onUpdated?.(next);
      pushConsoleToast(
        next ? "开发模式已开启（鉴权已跳过，立即生效）" : "开发模式已关闭（鉴权已恢复）",
        "ok",
      );
    } catch (e) {
      const detail = axiosErrorDetail(e) || "保存失败";
      setErr(detail);
      pushConsoleToast(detail, "err");
    } finally {
      setBusy(false);
    }
  }

  function onToggleInput(want: boolean) {
    if (want === active) return;
    void applyDevMode(want);
  }

  if (showDevBanner) {
    return (
      <div className="console-dev-mode-banner alert alert--warn" role="status">
        <strong>开发模式已开启</strong>
        <span>
          控制台 API 与页面鉴权已跳过；请勿在公网或生产环境长期开启。
          <Link to={`/plugins/${PB_WEBUI_PLUGIN}`}>网页控制台配置</Link>
        </span>
      </div>
    );
  }

  if (showPanel && prefsRow) {
    return (
      <div className="prefs-dev-mode-row" title={DEV_MODE_TOOLTIP}>
        <div className="prefs-switch-row">
          <span className="prefs-switch-row__label">开发模式</span>
          <div className="prefs-switch-row__control">
            <ConsoleSwitch
              checked={active}
              disabled={busy}
              tone="amber"
              showLabel={false}
              ariaLabel={active ? "关闭开发模式" : "开启开发模式"}
              onCheckedChange={onToggleInput}
            />
            <span className="prefs-switch-row__state" aria-hidden="true">
              {active ? "开" : "关"}
            </span>
          </div>
        </div>
        {err ? <div className="alert alert--err">{err}</div> : null}
      </div>
    );
  }

  if (showPanel && toolbar) {
    return (
      <div
        className={cnShellTopbar(active)}
        title={DEV_MODE_TOOLTIP}
      >
        <span className="shell__topbar-dev__label">开发模式</span>
        <ConsoleSwitch
          checked={active}
          disabled={busy}
          tone="amber"
          showLabel={false}
          ariaLabel={active ? "关闭开发模式" : "开启开发模式"}
          onCheckedChange={onToggleInput}
        />
      </div>
    );
  }

  if (!showPanel) return null;

  return (
    <div
      className={[
        "console-dev-mode-panel",
        compact ? "console-dev-mode-panel--compact" : "",
        active ? "console-dev-mode-panel--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {err ? <div className="alert alert--err">{err}</div> : null}
      <div className="console-dev-mode-panel__row">
        <div>
          <div className="console-dev-mode-panel__title">{switchLabel}</div>
          <p className="console-dev-mode-panel__desc muted">
            联调时可跳过登录与 API token；保存后立即生效，无需重启 Bot。
            {!compact ? " CORS 等中间件变更仍需重启 hub。" : null}
          </p>
        </div>
        <ConsoleSwitch
          checked={active}
          disabled={busy}
          tone="amber"
          showLabel={false}
          ariaLabel={active ? "关闭开发模式" : "开启开发模式"}
          onCheckedChange={onToggleInput}
        />
      </div>
    </div>
  );
}

function cnShellTopbar(active: boolean): string {
  return ["shell__topbar-dev", active ? "shell__topbar-dev--active" : ""].filter(Boolean).join(" ");
}
