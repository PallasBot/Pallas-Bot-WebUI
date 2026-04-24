import { ref, type Ref } from "vue";

const isDark: Ref<boolean> = ref(false);

export { isDark };

export function initThemeFromStorage(): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  const t = localStorage.getItem("pallas-webui-theme");
  isDark.value =
    t === "dark" || (t === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark.value);
}

export function setTheme(dark: boolean): void {
  isDark.value = dark;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("pallas-webui-theme", dark ? "dark" : "light");
  }
}

export function toggleTheme(): void {
  setTheme(!isDark.value);
}
