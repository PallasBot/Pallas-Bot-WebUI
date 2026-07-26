/**
 * 读写 Vue 同款 localStorage，同步 html dataset 与圆角 CSS 变量。
 */

const STORAGE_KEY = "pallas_console_prefs_v1";

export type ThemeMode = "dark" | "light" | "system";
export type RadiusMode = "tight" | "default" | "round";
export type SurfaceStyle = "solid" | "glass";
export type DensityMode = "comfortable" | "compact";
export type UiPreset = "gs" | "shadcn";
export type AccentPreset = "sky" | "indigo" | "emerald" | "rose" | "amber" | "violet";

export type PrefsSlice = {
  theme: ThemeMode;
  controlRadius: number;
  radius: RadiusMode;
  surfaceStyle: SurfaceStyle;
  density: DensityMode;
  accentPreset: AccentPreset;
  uiPreset: UiPreset;
  sidebarCollapsed: boolean;
  glassBlur: number;
  cardGlassOpacity: number;
  /** 卡片/壳层阴影强度倍率（0.4–1.8，默认 1） */
  shadowIntensity: number;
  /** 应用 WebUI/Bot 更新后是否自动弹出 CHANGELOG（默认开） */
  showUpdateChangelog: boolean;
};

const DEFAULTS: PrefsSlice = {
  theme: "system",
  controlRadius: 10,
  radius: "default",
  surfaceStyle: "glass",
  density: "comfortable",
  accentPreset: "violet",
  uiPreset: "shadcn",
  sidebarCollapsed: false,
  glassBlur: 12,
  cardGlassOpacity: 0.25,
  shadowIntensity: 1,
  showUpdateChangelog: true,
};

const ACCENTS = new Set<AccentPreset>(["sky", "indigo", "emerald", "rose", "amber", "violet"]);

/** shadcn HSL 分量（无 hsl() 包裹），与 tokens.css 各 data-accent 对齐。 */
const ACCENT_HSL: Record<AccentPreset, { dark: string; light: string; fgDark: string; fgLight: string }> = {
  sky: { dark: "199 89% 60%", light: "199 89% 40%", fgDark: "210 40% 98%", fgLight: "0 0% 100%" },
  indigo: { dark: "239 84% 74%", light: "239 84% 60%", fgDark: "240 10% 8%", fgLight: "0 0% 100%" },
  emerald: { dark: "160 84% 52%", light: "160 84% 32%", fgDark: "160 20% 8%", fgLight: "0 0% 100%" },
  rose: { dark: "350 89% 72%", light: "347 77% 50%", fgDark: "0 0% 100%", fgLight: "0 0% 100%" },
  amber: { dark: "43 96% 56%", light: "32 95% 44%", fgDark: "30 20% 10%", fgLight: "0 0% 100%" },
  violet: { dark: "258 90% 76%", light: "263 70% 58%", fgDark: "260 20% 10%", fgLight: "0 0% 100%" },
};

function clampControlRadius(px: number): number {
  return Math.min(20, Math.max(4, Math.round(Number.isFinite(px) ? px : 16)));
}

function clampShadowIntensity(v: number): number {
  const n = Number.isFinite(v) ? v : DEFAULTS.shadowIntensity;
  return Math.min(1.8, Math.max(0.4, Math.round(n * 100) / 100));
}

function radiusModeFromControlPx(px: number): RadiusMode {
  if (px <= 8) return "tight";
  if (px >= 16) return "round";
  return "default";
}

export function readPrefs(): PrefsSlice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PrefsSlice>;
    const controlRadius = clampControlRadius(
      parsed.controlRadius != null ? Number(parsed.controlRadius) : DEFAULTS.controlRadius,
    );
    const accent = ACCENTS.has(parsed.accentPreset as AccentPreset)
      ? (parsed.accentPreset as AccentPreset)
      : DEFAULTS.accentPreset;
    return {
      ...DEFAULTS,
      ...parsed,
      controlRadius,
      radius:
        parsed.radius === "tight" || parsed.radius === "default" || parsed.radius === "round"
          ? parsed.radius
          : radiusModeFromControlPx(controlRadius),
      surfaceStyle: parsed.surfaceStyle === "solid" || parsed.surfaceStyle === "glass" ? parsed.surfaceStyle : DEFAULTS.surfaceStyle,
      density: parsed.density === "compact" || parsed.density === "comfortable" ? parsed.density : DEFAULTS.density,
      accentPreset: accent,
      uiPreset: parsed.uiPreset === "gs" || parsed.uiPreset === "shadcn" ? parsed.uiPreset : DEFAULTS.uiPreset,
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed),
      glassBlur: Number.isFinite(Number(parsed.glassBlur)) ? Number(parsed.glassBlur) : DEFAULTS.glassBlur,
      cardGlassOpacity: Number.isFinite(Number(parsed.cardGlassOpacity))
        ? Number(parsed.cardGlassOpacity)
        : DEFAULTS.cardGlassOpacity,
      shadowIntensity: clampShadowIntensity(
        Number.isFinite(Number(parsed.shadowIntensity))
          ? Number(parsed.shadowIntensity)
          : DEFAULTS.shadowIntensity,
      ),
      showUpdateChangelog:
        parsed.showUpdateChangelog === undefined
          ? DEFAULTS.showUpdateChangelog
          : Boolean(parsed.showUpdateChangelog),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(patch: Partial<PrefsSlice>): PrefsSlice {
  const cur = readPrefs();
  const next = { ...cur, ...patch };
  if (patch.controlRadius !== undefined && patch.radius === undefined) {
    next.controlRadius = clampControlRadius(patch.controlRadius);
    next.radius = radiusModeFromControlPx(next.controlRadius);
  } else if (patch.radius !== undefined && patch.controlRadius === undefined) {
    next.radius = patch.radius;
    next.controlRadius = patch.radius === "tight" ? 6 : patch.radius === "default" ? 12 : 16;
  } else if (patch.controlRadius !== undefined) {
    next.controlRadius = clampControlRadius(patch.controlRadius);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...next }));
  } catch {
    /* ignore */
  }
  applyShellTheme();
  return next;
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(theme: ThemeMode): "dark" | "light" {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function readSidebarCollapsed(): boolean {
  return Boolean(readPrefs().sidebarCollapsed);
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  writePrefs({ sidebarCollapsed: collapsed });
}

function applyRadiusCssVars(el: HTMLElement, controlPx: number): void {
  const r = clampControlRadius(controlPx);
  const sm = Math.max(2, r - 2);
  /* 圆角基准约 8px */
  const md = r;
  const lg = r + 2;
  const shell = r;
  el.style.setProperty("--radius-control", `${r}px`);
  el.style.setProperty("--radius-sm", `${sm}px`);
  el.style.setProperty("--radius-md", `${md}px`);
  el.style.setProperty("--radius-lg", `${lg}px`);
  el.style.setProperty("--radius-shell", `${shell}px`);
  el.style.setProperty("--radius-textarea", `${sm}px`);
  el.style.setProperty("--radius", `${r}px`);
}

/** 黑白预设：Tailwind `text-primary` / Switch 等走 --ui-*，须跟前景中性灰，勿留彩色 accent。 */
const MONO_PRIMARY_HSL = {
  dark: { primary: "240 5% 96%", primaryFg: "240 5% 8%" },
  light: { primary: "240 6% 10%", primaryFg: "0 0% 100%" },
} as const;

/** 把 hub accent / 黑白预设同步到 shadcn --ui-primary / --ui-ring（HSL 分量）。
 * 勿写 hub 的 --accent / --primary / --ring：那些是完整色值，供 color-mix 使用。
 */
function applyShadcnAccentVars(
  el: HTMLElement,
  accent: AccentPreset,
  theme: "dark" | "light",
  uiPreset: UiPreset,
): void {
  const mono = MONO_PRIMARY_HSL[theme];
  const row = ACCENT_HSL[accent] ?? ACCENT_HSL.violet;
  const primary = uiPreset === "shadcn" ? mono.primary : theme === "dark" ? row.dark : row.light;
  const primaryFg = uiPreset === "shadcn" ? mono.primaryFg : theme === "dark" ? row.fgDark : row.fgLight;
  // 清掉旧版误写的 HSL 分量，避免盖住 hub 完整色值
  el.style.removeProperty("--primary");
  el.style.removeProperty("--primary-foreground");
  el.style.removeProperty("--ring");
  el.style.removeProperty("--sidebar-primary");
  el.style.removeProperty("--sidebar-primary-foreground");
  el.style.removeProperty("--sidebar-ring");
  el.style.setProperty("--ui-primary", primary);
  el.style.setProperty("--ui-primary-foreground", primaryFg);
  el.style.setProperty("--ui-ring", primary);
  el.style.setProperty("--ui-sidebar-primary", primary);
  el.style.setProperty("--ui-sidebar-primary-foreground", primaryFg);
  el.style.setProperty("--ui-sidebar-ring", primary);
}

export function applyShellTheme(): void {
  const prefs = readPrefs();
  const theme = resolveTheme(prefs.theme);
  const el = document.documentElement;
  el.dataset.theme = theme;
  el.dataset.radius = prefs.radius;
  el.dataset.surface = prefs.surfaceStyle;
  el.dataset.density = prefs.density;
  el.dataset.accent = prefs.accentPreset;
  el.dataset.uiPreset = prefs.uiPreset;
  el.dataset.layout = "hub";
  el.classList.toggle("dark", theme === "dark");
  el.classList.toggle("light", theme === "light");
  el.style.colorScheme = theme;
  applyRadiusCssVars(el, prefs.controlRadius);
  applyShadcnAccentVars(el, prefs.accentPreset, theme, prefs.uiPreset);
  const blur = prefs.glassBlur;
  const saturate = 1.08 + ((blur - 8) / 32) * 0.18;
  const glassPct = Math.round(prefs.cardGlassOpacity * 100);
  el.style.setProperty("--surface-blur", `${blur}px`);
  el.style.setProperty("--card-glass-opacity", String(prefs.cardGlassOpacity));
  el.style.setProperty("--shell-glass-pct", `${glassPct}%`);
  el.style.setProperty("--glass-saturate", saturate.toFixed(2));
  el.style.setProperty("--shadow-intensity", String(clampShadowIntensity(prefs.shadowIntensity)));
}
