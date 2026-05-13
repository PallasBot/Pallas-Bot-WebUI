import { reactive } from "vue";

const STORAGE_KEY = "pallas_console_prefs_v1";

export type ThemeMode = "dark" | "light" | "system";
export type RadiusMode = "tight" | "default" | "round";
export type DensityMode = "comfortable" | "compact";

export interface ConsolePrefsState {
  theme: ThemeMode;
  radius: RadiusMode;
  density: DensityMode;
}

const defaults: ConsolePrefsState = {
  theme: "dark",
  radius: "default",
  density: "comfortable",
};

function load(): ConsolePrefsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<ConsolePrefsState>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export const consolePrefs = reactive<ConsolePrefsState>(load());

function resolvedTheme(): "dark" | "light" {
  if (consolePrefs.theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return consolePrefs.theme;
}

export function applyConsolePrefsToDocument(): void {
  if (typeof document === "undefined") return;
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.radius = consolePrefs.radius;
  document.documentElement.dataset.density = consolePrefs.density;
  document.documentElement.style.colorScheme = t;
}

export function persistConsolePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consolePrefs));
  } catch {
    /* ignore */
  }
}

export function setConsolePrefs(patch: Partial<ConsolePrefsState>): void {
  Object.assign(consolePrefs, patch);
  persistConsolePrefs();
  applyConsolePrefsToDocument();
}

export function initConsolePrefs(): void {
  applyConsolePrefsToDocument();
  if (typeof window === "undefined") return;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (consolePrefs.theme === "system") {
      applyConsolePrefsToDocument();
    }
  });
}
