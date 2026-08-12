import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { changeConsoleLogin } from "@/api/fullConsole";
import { fetchHealth } from "@/api/health";
import ConsoleDevModePanel from "@/components/ConsoleDevModePanel";
import PageMasthead from "@/components/PageMasthead";
import PrefsGlassPreview from "@/components/PrefsGlassPreview";
import PrefsSettingCard from "@/components/PrefsSettingCard";
import { Switch } from "@/components/ui/switch";
import { ACCENT_PRESET_OPTIONS } from "@/config/accentPresets";
import { cn } from "@/lib/utils";
import { pushConsoleToast } from "@/utils/consoleToast";
import {
  applyShellTheme,
  PREFS_DEFAULTS,
  readPrefs,
  writePrefs,
  type AccentPreset,
  type DensityMode,
  type RadiusMode,
  type SurfaceStyle,
  type ThemeMode,
  type UiPreset,
} from "@/theme/applyShellTheme";

const CONTROL_RADIUS_MIN = 4;
const CONTROL_RADIUS_MAX = 20;

function PrefsResetButton({ onClick, label = "复原" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="prefs-setting-card__reset" onClick={onClick} aria-label={label}>
      <RotateCcw className="size-3.5 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

export default function PreferencesPage() {
  const location = useLocation();
  const qc = useQueryClient();
  const prefs = readPrefs();
  const [theme, setTheme] = useState<ThemeMode>(prefs.theme);
  const [uiPreset, setUiPreset] = useState<UiPreset>(prefs.uiPreset);
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>(prefs.surfaceStyle);
  const [glassBlurDraft, setGlassBlurDraft] = useState(prefs.glassBlur);
  const [cardGlassOpacityDraft, setCardGlassOpacityDraft] = useState(prefs.cardGlassOpacity);
  const [accentPreset, setAccentPreset] = useState<AccentPreset>(prefs.accentPreset);
  const [radius, setRadius] = useState<RadiusMode>(prefs.radius);
  const [controlRadiusDraft, setControlRadiusDraft] = useState(prefs.controlRadius);
  const [density, setDensity] = useState<DensityMode>(prefs.density);
  const [shadowIntensityDraft, setShadowIntensityDraft] = useState(prefs.shadowIntensity);
  const [showUpdateChangelog, setShowUpdateChangelog] = useState(prefs.showUpdateChangelog);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [pwdOk, setPwdOk] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  const setupQ = useQuery({
    queryKey: ["auth-setup"],
    queryFn: async () => {
      const { fetchConsoleSetupStatus } = await import("@/api/fullConsole");
      return fetchConsoleSetupStatus();
    },
  });
  const healthQ = useQuery({ queryKey: ["health"], queryFn: () => fetchHealth() });
  const webuiDevModeActive = Boolean(healthQ.data?.console?.pallas_webui_dev_mode);

  useEffect(() => {
    if (location.hash === "#console-password") {
      document.getElementById("console-password")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  function patchPrefs(patch: Parameters<typeof writePrefs>[0]) {
    writePrefs(patch);
    applyShellTheme();
    const next = readPrefs();
    setTheme(next.theme);
    setUiPreset(next.uiPreset);
    setSurfaceStyle(next.surfaceStyle);
    setGlassBlurDraft(next.glassBlur);
    setCardGlassOpacityDraft(next.cardGlassOpacity);
    setAccentPreset(next.accentPreset);
    setRadius(next.radius);
    setControlRadiusDraft(next.controlRadius);
    setDensity(next.density);
    setShadowIntensityDraft(next.shadowIntensity);
    setShowUpdateChangelog(next.showUpdateChangelog);
  }

  function onGlassBlurInput(v: number) {
    const next = Math.min(40, Math.max(8, Math.round(v)));
    setGlassBlurDraft(next);
    patchPrefs({ glassBlur: next });
  }

  function onCardGlassOpacityInput(v: number) {
    const next = Math.min(0.88, Math.max(0.08, Math.round(v * 100) / 100));
    setCardGlassOpacityDraft(next);
    patchPrefs({ cardGlassOpacity: next });
  }

  function onControlRadiusInput(v: number) {
    const next = Math.min(CONTROL_RADIUS_MAX, Math.max(CONTROL_RADIUS_MIN, Math.round(v)));
    setControlRadiusDraft(next);
    patchPrefs({ controlRadius: next });
  }

  function onShadowIntensityInput(v: number) {
    const next = Math.min(1.8, Math.max(0.4, Math.round(v * 100) / 100));
    setShadowIntensityDraft(next);
    patchPrefs({ shadowIntensity: next });
  }

  function onWebuiDevModeUpdated(active: boolean) {
    qc.setQueryData(["health"], (prev: Awaited<ReturnType<typeof fetchHealth>> | undefined) =>
      prev
        ? {
            ...prev,
            console: { ...prev.console, pallas_webui_dev_mode: active },
          }
        : prev,
    );
  }

  async function submitPassword() {
    setPwdErr("");
    setPwdOk("");
    if (pwd.length < 6) {
      setPwdErr("新密钥至少 6 位。");
      return;
    }
    if (pwd !== pwd2) {
      setPwdErr("两次输入不一致。");
      return;
    }
    setPwdBusy(true);
    try {
      const r = await changeConsoleLogin(pwd);
      setPwd("");
      setPwd2("");
      setPwdOk(r.message || "已更新。");
      pushConsoleToast("控制台密钥已更新", "ok");
      void setupQ.refetch();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setPwdErr(message);
      pushConsoleToast(message, "err");
    } finally {
      setPwdBusy(false);
    }
  }

  return (
    <div className="console-hub-page prefs-page">
      <PageMasthead title="偏好与密钥" description="外观与安全设置。" />

      {setupQ.data?.requires_setup ? (
        <div className="alert alert--warn">
          当前仍处于首次引导阶段，请先完成控制台密钥改密。
          {setupQ.data.default_password_active ? <span> 默认密钥仍有效，生产环境请勿继续保留。</span> : null}
          <Link to="/setup" className="prefs-page__setup-link">
            打开 Setup Wizard
          </Link>
        </div>
      ) : null}

      <div className="prefs-page__grid">
        <PrefsSettingCard title="颜色模式" lead="切换深色、浅色或跟随系统。">
          <div className="prefs-segment prefs-segment--fill">
            {(
              [
                ["light", "浅色"],
                ["dark", "深色"],
                ["system", "跟随系统"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn("prefs-segment__btn", theme === id && "prefs-segment__btn--active")}
                onClick={() => patchPrefs({ theme: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard title="配色风格" lead="彩色模式可换主题色，毛玻璃会透出对应色调；黑白模式为纯灰阶，与主题色无关。">
          <div className="prefs-segment prefs-segment--fill">
            {(
              [
                ["gs", "彩色"],
                ["shadcn", "黑白"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn("prefs-segment__btn", uiPreset === id && "prefs-segment__btn--active")}
                onClick={() => patchPrefs({ uiPreset: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard
          title="界面风格"
          lead="纯色为实心底；毛玻璃让面板半透明并模糊背后渐变。深色更明显，浅色需调低不透明度才看得出。"
        >
          <div className="prefs-style-tiles" role="group" aria-label="界面风格">
            <button
              type="button"
              className={cn("prefs-style-tile", surfaceStyle === "solid" && "prefs-style-tile--active")}
              onClick={() => patchPrefs({ surfaceStyle: "solid" })}
              aria-pressed={surfaceStyle === "solid"}
            >
              <span className="prefs-style-tile__swatch prefs-style-tile__swatch--solid" aria-hidden />
              <span className="prefs-style-tile__label">纯色风格</span>
            </button>
            <button
              type="button"
              className={cn("prefs-style-tile", surfaceStyle === "glass" && "prefs-style-tile--active")}
              onClick={() => patchPrefs({ surfaceStyle: "glass" })}
              aria-pressed={surfaceStyle === "glass"}
            >
              <span className="prefs-style-tile__swatch prefs-style-tile__swatch--glass" aria-hidden />
              <span className="prefs-style-tile__label">毛玻璃风格</span>
            </button>
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard
          title="开发与更新"
          lead="开发模式仅供本机/内网联调；CHANGELOG 弹窗可随时在更新页手动打开。"
        >
          <div className="space-y-3">
            <ConsoleDevModePanel
              active={webuiDevModeActive}
              showBanner={false}
              prefsRow
              onUpdated={onWebuiDevModeUpdated}
            />
            <div className="prefs-switch-row">
              <span className="prefs-switch-row__label">应用更新后弹出 CHANGELOG</span>
              <div className="prefs-switch-row__control">
                <Switch
                  checked={showUpdateChangelog}
                  onCheckedChange={(v) => {
                    const next = Boolean(v);
                    setShowUpdateChangelog(next);
                    patchPrefs({ showUpdateChangelog: next });
                  }}
                  aria-label="应用更新后弹出 CHANGELOG"
                />
                <span className="prefs-switch-row__state" aria-hidden="true">
                  {showUpdateChangelog ? "开" : "关"}
                </span>
              </div>
            </div>
          </div>
        </PrefsSettingCard>

        {surfaceStyle === "glass" ? (
          <>
            <PrefsSettingCard
              title="模糊强度"
              lead="作用在面板 backdrop-blur（.panel / 带玻璃的卡片），模糊背后的壳层渐变；需半透明底色才能看出。"
              headerAction={
                glassBlurDraft !== PREFS_DEFAULTS.glassBlur ? (
                  <PrefsResetButton onClick={() => patchPrefs({ glassBlur: PREFS_DEFAULTS.glassBlur })} />
                ) : null
              }
            >
              <PrefsGlassPreview
                label="拖动滑块查看模糊变化"
                blur={glassBlurDraft}
                opacity={cardGlassOpacityDraft}
              />
              <div className="prefs-form-field prefs-form-field--range">
                <label className="prefs-form-field__label">模糊半径 {glassBlurDraft}px</label>
                <input
                  className="inp"
                  type="range"
                  min={8}
                  max={40}
                  step={1}
                  value={glassBlurDraft}
                  onInput={(e) => onGlassBlurInput(Number(e.currentTarget.value))}
                />
              </div>
            </PrefsSettingCard>
            <PrefsSettingCard
              title="卡片不透明度"
              lead="控制面板底色浓度；越低越透、模糊越明显。对应 GS 的卡片不透明度。"
              headerAction={
                Math.round(cardGlassOpacityDraft * 100) !==
                Math.round(PREFS_DEFAULTS.cardGlassOpacity * 100) ? (
                  <PrefsResetButton
                    onClick={() => patchPrefs({ cardGlassOpacity: PREFS_DEFAULTS.cardGlassOpacity })}
                  />
                ) : null
              }
            >
              <PrefsGlassPreview
                label="拖动滑块查看透明度变化"
                blur={glassBlurDraft}
                opacity={cardGlassOpacityDraft}
              />
              <div className="prefs-form-field prefs-form-field--range">
                <label className="prefs-form-field__label">
                  不透明度 {Math.round(cardGlassOpacityDraft * 100)}%
                </label>
                <input
                  className="inp"
                  type="range"
                  min={8}
                  max={88}
                  step={1}
                  value={Math.round(cardGlassOpacityDraft * 100)}
                  onInput={(e) => onCardGlassOpacityInput(Number(e.currentTarget.value) / 100)}
                />
              </div>
            </PrefsSettingCard>
          </>
        ) : null}

        <PrefsSettingCard title="主题色" lead="影响按钮、链接与选中高亮。">
          <div className="prefs-accent-row">
            {ACCENT_PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={cn("prefs-accent-swatch", accentPreset === opt.id && "prefs-accent-swatch--on")}
                aria-label={opt.label}
                aria-pressed={accentPreset === opt.id}
                onClick={() => patchPrefs({ accentPreset: opt.id })}
              >
                <span className="prefs-accent-swatch__dot" style={{ background: opt.swatch }} />
                <span className="prefs-accent-swatch__label">{opt.label}</span>
              </button>
            ))}
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard
          title="圆角风格"
          lead="滑块调节按钮与输入框圆角；分段为快捷预设。开关与 Chip 保持胶囊，不受滑块影响。"
          headerAction={
            controlRadiusDraft !== PREFS_DEFAULTS.controlRadius ||
            radius !== PREFS_DEFAULTS.radius ? (
              <PrefsResetButton
                onClick={() =>
                  patchPrefs({
                    controlRadius: PREFS_DEFAULTS.controlRadius,
                    radius: PREFS_DEFAULTS.radius,
                  })
                }
              />
            ) : null
          }
        >
          <div className="prefs-segment prefs-segment--fill">
            {(
              [
                ["tight", "紧凑"],
                ["default", "默认"],
                ["round", "更圆"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn("prefs-segment__btn", radius === id && "prefs-segment__btn--active")}
                onClick={() => patchPrefs({ radius: id })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="prefs-form-field prefs-form-field--range">
            <label className="prefs-form-field__label">控件圆角 {controlRadiusDraft}px</label>
            <input
              className="inp"
              type="range"
              min={CONTROL_RADIUS_MIN}
              max={CONTROL_RADIUS_MAX}
              step={1}
              value={controlRadiusDraft}
              onInput={(e) => onControlRadiusInput(Number(e.currentTarget.value))}
            />
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard
          title="阴影强度"
          lead="调节卡片与壳层投影深浅；输入框描边由边色控制，不受此滑块影响。"
          headerAction={
            Math.round(shadowIntensityDraft * 100) !==
            Math.round(PREFS_DEFAULTS.shadowIntensity * 100) ? (
              <PrefsResetButton
                onClick={() => patchPrefs({ shadowIntensity: PREFS_DEFAULTS.shadowIntensity })}
              />
            ) : null
          }
        >
          <div className="prefs-form-field prefs-form-field--range">
            <label className="prefs-form-field__label">
              阴影强度 {Math.round(shadowIntensityDraft * 100)}%
            </label>
            <input
              className="inp"
              type="range"
              min={40}
              max={180}
              step={5}
              value={Math.round(shadowIntensityDraft * 100)}
              onInput={(e) => onShadowIntensityInput(Number(e.currentTarget.value) / 100)}
            />
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard title="内容密度" lead="紧凑模式缩小间距与控件高度。">
          <div className="prefs-switch-row">
            <span className="prefs-switch-row__label" id="prefs-density-label">
              紧凑布局
            </span>
            <div className="prefs-switch-row__control">
              <Switch
                checked={density === "compact"}
                onCheckedChange={(on) => patchPrefs({ density: on ? "compact" : "comfortable" })}
                aria-labelledby="prefs-density-label"
              />
              <span className="prefs-switch-row__state" aria-hidden="true">
                {density === "compact" ? "开" : "关"}
              </span>
            </div>
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard cardId="console-password" title="控制台密钥" lead="用于登录 WebUI，至少 6 位。" wide>
          {pwdErr ? (
            <div className="alert alert--err" style={{ marginBottom: 12 }}>
              {pwdErr}
            </div>
          ) : null}
          {pwdOk ? (
            <div className="alert alert--ok" style={{ marginBottom: 12 }}>
              {pwdOk}
            </div>
          ) : null}
          <div className="prefs-form-field">
            <label className="prefs-form-field__label">新密钥</label>
            <input className="inp" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="prefs-form-field">
            <label className="prefs-form-field__label">确认密钥</label>
            <input className="inp" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
          <button type="button" className="btn btn--primary" disabled={pwdBusy} onClick={() => void submitPassword()}>
            {pwdBusy ? "提交中…" : "保存密钥"}
          </button>
        </PrefsSettingCard>
      </div>
    </div>
  );
}
