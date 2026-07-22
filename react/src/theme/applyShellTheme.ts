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
};

const DEFAULTS: PrefsSlice = {
  theme: "system",
  controlRadius: 16,
  radius: "round",
  surfaceStyle: "glass",
  density: "comfortable",
  accentPreset: "sky",
  uiPreset: "shadcn",
  sidebarCollapsed: false,
  glassBlur: 12,
  cardGlassOpacity: 0.25,
};

const ACCENTS = new Set<AccentPreset>(["sky", "indigo", "emerald", "rose", "amber", "violet"]);

function clampControlRadius(px: number): number {
  return Math.min(20, Math.max(4, Math.round(Number.isFinite(px) ? px : 16)));
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
  const md = r + 2;
  const lg = r + 4;
  const shell = r + 2;
  el.style.setProperty("--radius-control", `${r}px`);
  el.style.setProperty("--radius-sm", `${sm}px`);
  el.style.setProperty("--radius-md", `${md}px`);
  el.style.setProperty("--radius-lg", `${lg}px`);
  el.style.setProperty("--radius-shell", `${shell}px`);
  el.style.setProperty("--radius-textarea", `${sm}px`);
  el.style.setProperty("--radius", `${r}px`);
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
  const blur = prefs.glassBlur;
  const saturate = 1.08 + ((blur - 8) / 32) * 0.18;
  const glassPct = Math.round(prefs.cardGlassOpacity * 100);
  el.style.setProperty("--surface-blur", `${blur}px`);
  el.style.setProperty("--card-glass-opacity", String(prefs.cardGlassOpacity));
  el.style.setProperty("--shell-glass-pct", `${glassPct}%`);
  el.style.setProperty("--glass-saturate", saturate.toFixed(2));
}
