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

const PREFS_SWITCH_CLASS = "data-[state=checked]:bg-[var(--accent)]";

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
  }

  function onGlassBlurInput(v: number) {
    setGlassBlurDraft(Math.min(40, Math.max(8, Math.round(v))));
  }

  function onGlassBlurCommit() {
    patchPrefs({ glassBlur: glassBlurDraft });
  }

  function onCardGlassOpacityInput(v: number) {
    setCardGlassOpacityDraft(Math.min(0.72, Math.max(0.12, v)));
  }

  function onCardGlassOpacityCommit() {
    patchPrefs({ cardGlassOpacity: cardGlassOpacityDraft });
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
    void qc.invalidateQueries({ queryKey: ["health"] });
  }

  async function submitPassword() {
    setPwdErr("");
    setPwdOk("");
    if (pwd.length < 8) {
      setPwdErr("新口令至少 8 位。");
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
      pushConsoleToast("控制台口令已更新", "ok");
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
      <PageMasthead title="偏好与口令" description="外观与安全设置。" />

      {setupQ.data?.requires_setup ? (
        <div className="alert alert--warn">
          当前仍处于首次引导阶段，请先完成控制台口令改密。
          {setupQ.data.default_password_active ? <span> 默认口令仍有效，生产环境请勿继续保留。</span> : null}
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

        <PrefsSettingCard title="界面风格" lead="毛玻璃更有层次，纯色更省资源。">
          <div className="prefs-switch-row">
            <span className="prefs-switch-row__label" id="prefs-glass-label">
              毛玻璃效果
            </span>
            <div className="prefs-switch-row__control">
              <Switch
                checked={surfaceStyle === "glass"}
                onCheckedChange={(on) => patchPrefs({ surfaceStyle: on ? "glass" : "solid" })}
                aria-labelledby="prefs-glass-label"
                className={PREFS_SWITCH_CLASS}
              />
              <span className="prefs-switch-row__state" aria-hidden="true">
                {surfaceStyle === "glass" ? "开" : "关"}
              </span>
            </div>
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard title="开发模式" lead="联调时可跳过控制台登录与 API token；生产环境务必关闭。">
          <ConsoleDevModePanel
            active={webuiDevModeActive}
            showBanner={false}
            toolbar
            onUpdated={onWebuiDevModeUpdated}
          />
        </PrefsSettingCard>

        {surfaceStyle === "glass" ? (
          <>
            <PrefsSettingCard
              title="模糊强度"
              lead="调节背景模糊半径；数值越大越朦胧，饱和度会随强度略增。"
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
                  onChange={onGlassBlurCommit}
                />
              </div>
            </PrefsSettingCard>
            <PrefsSettingCard title="卡片不透明度" lead="调节毛玻璃面板底色浓度；数值越低越透、模糊越明显。">
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
                  min={12}
                  max={72}
                  step={1}
                  value={Math.round(cardGlassOpacityDraft * 100)}
                  onInput={(e) => onCardGlassOpacityInput(Number(e.currentTarget.value) / 100)}
                  onChange={onCardGlassOpacityCommit}
                />
              </div>
            </PrefsSettingCard>
          </>
        ) : null}

        {uiPreset === "gs" ? (
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
        ) : null}

        <PrefsSettingCard
          title="圆角风格"
          lead="滑块调节按钮与输入框圆角；分段为快捷预设。开关与 Chip 保持胶囊，不受滑块影响。"
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
                className={PREFS_SWITCH_CLASS}
              />
              <span className="prefs-switch-row__state" aria-hidden="true">
                {density === "compact" ? "开" : "关"}
              </span>
            </div>
          </div>
        </PrefsSettingCard>

        <PrefsSettingCard cardId="console-password" title="控制台口令" lead="用于登录 WebUI，至少 8 位。" wide>
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
            <label className="prefs-form-field__label">新口令</label>
            <input className="inp" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="prefs-form-field">
            <label className="prefs-form-field__label">确认口令</label>
            <input className="inp" type="password" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
          <button type="button" className="btn btn--primary" disabled={pwdBusy} onClick={() => void submitPassword()}>
            {pwdBusy ? "提交中…" : "保存口令"}
          </button>
        </PrefsSettingCard>
      </div>
    </div>
  );
}
