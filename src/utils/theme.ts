import { ref, type Ref } from "vue";

import { applyPallasUiPrefsFromStorage } from "./pallasUiPrefs";

export type ThemeDisplayMode = "light" | "dark" | "system";

const MODE_KEY = "pallas-theme-mode";
const LEGACY_KEY = "pallas-webui-theme";

export const isDark: Ref<boolean> = ref(false);
export const themeDisplayMode: Ref<ThemeDisplayMode> = ref("system");

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function effectiveDark(mode: ThemeDisplayMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return prefersDark();
}

function applyDomDark(dark: boolean): void {
  isDark.value = dark;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
    applyPallasUiPrefsFromStorage();
  }
}

export function setThemeDisplayMode(mode: ThemeDisplayMode): void {
  themeDisplayMode.value = mode;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MODE_KEY, mode);
  }
  applyDomDark(effectiveDark(mode));
}

export function initThemeFromStorage(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  let m = localStorage.getItem(MODE_KEY) as ThemeDisplayMode | null;
  if (!m || (m !== "light" && m !== "dark" && m !== "system")) {
    const leg = localStorage.getItem(LEGACY_KEY);
    if (leg === "dark" || leg === "light") {
      m = leg;
      localStorage.setItem(MODE_KEY, leg);
    } else {
      m = "system";
      localStorage.setItem(MODE_KEY, "system");
    }
  }
  themeDisplayMode.value = m;
  applyDomDark(effectiveDark(m));
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (themeDisplayMode.value === "system") {
        applyDomDark(effectiveDark("system"));
      }
    });
  } catch {
    /* ignore */
  }
}

/** 兼容头部切换：写入明确浅色 / 深色（非跟随系统） */
export function setTheme(dark: boolean): void {
  setThemeDisplayMode(dark ? "dark" : "light");
}

export function toggleTheme(): void {
  setThemeDisplayMode(isDark.value ? "light" : "dark");
}
