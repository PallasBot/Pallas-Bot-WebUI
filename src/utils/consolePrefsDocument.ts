import type { AccentPreset } from "@/config/accentPresets";
import type { DensityMode, RadiusMode, SurfaceStyle, ThemeMode, UiPreset } from "@/utils/consolePrefs";

export type ConsoleDocumentDataset = {
  theme: "dark" | "light";
  radius: RadiusMode;
  surface: SurfaceStyle;
  density: DensityMode;
  accent: AccentPreset;
  uiPreset: UiPreset;
  layout: "hub";
};

export function resolveConsoleTheme(theme: ThemeMode, systemPrefersDark: boolean): "dark" | "light" {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}

export function buildConsoleDocumentDataset(
  prefs: {
    theme: ThemeMode;
    radius: RadiusMode;
    surfaceStyle: SurfaceStyle;
    density: DensityMode;
    accentPreset: AccentPreset;
    uiPreset: UiPreset;
  },
  systemPrefersDark: boolean,
): ConsoleDocumentDataset {
  return {
    theme: resolveConsoleTheme(prefs.theme, systemPrefersDark),
    radius: prefs.radius,
    surface: prefs.surfaceStyle,
    density: prefs.density,
    accent: prefs.accentPreset,
    uiPreset: prefs.uiPreset === "shadcn" ? "shadcn" : "gs",
    layout: "hub",
  };
}

export function applyConsoleDocumentDataset(el: HTMLElement, dataset: ConsoleDocumentDataset): void {
  el.dataset.theme = dataset.theme;
  el.dataset.radius = dataset.radius;
  el.dataset.surface = dataset.surface;
  el.dataset.density = dataset.density;
  el.dataset.accent = dataset.accent;
  el.dataset.uiPreset = dataset.uiPreset;
  el.dataset.layout = dataset.layout;
  el.style.colorScheme = dataset.theme;
}
