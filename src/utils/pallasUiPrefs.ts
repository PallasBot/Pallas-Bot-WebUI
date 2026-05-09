import { buildElPrimaryCssVars, resolveEffectivePrimary } from "./accentPalette";

export const DASH_POLL_KEY = "pallas-dashboard-poll-ms";

const ACCENT_KEY = "pallas-accent-hex";
const RADIUS_KEY = "pallas-radius-rem";
const DENSITY_KEY = "pallas-density";

export const ACCENT_SWATCHES = [
  { id: "blue", label: "蓝", hex: "#2563eb" },
  { id: "emerald", label: "翠", hex: "#059669" },
  { id: "violet", label: "紫", hex: "#7c3aed" },
  { id: "rose", label: "玫", hex: "#e11d48" },
  { id: "amber", label: "琥珀", hex: "#d97706" },
  { id: "cyan", label: "青", hex: "#0891b2" },
];

export const RADIUS_PRESETS = [
  { value: 0.5, label: "较小" },
  { value: 0.75, label: "默认" },
  { value: 1, label: "更圆" },
];

export const POLL_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "暂停" },
  { value: 1500, label: "1.5 秒" },
  { value: 3000, label: "3 秒" },
  { value: 5000, label: "5 秒" },
  { value: 10000, label: "10 秒" },
  { value: 30000, label: "30 秒" },
];

export function applyPallasUiPrefsFromStorage(): void {
  if (typeof document === "undefined") return;
  applyAccentFromStorage();
  applyRadiusFromStorage();
  applyDensityFromStorage();
}

export function getAccentHex(): string {
  const h = (typeof localStorage !== "undefined" && localStorage.getItem(ACCENT_KEY)?.trim()) || "";
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h;
  return "#2563eb";
}

export function setAccentHex(hex: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACCENT_KEY, hex);
  applyAccentFromStorage();
}

function applyAccentFromStorage(): void {
  const hex = getAccentHex();
  const root = document.documentElement;
  root.style.setProperty("--pallas-accent", hex);
  root.style.setProperty("--c-main", hex);
  const dark = root.classList.contains("dark");
  const primaryEff = resolveEffectivePrimary(hex, dark);
  const vars = buildElPrimaryCssVars(primaryEff);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
}

export function getRadiusRem(): number {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RADIUS_KEY) : null;
  const r = raw != null ? parseFloat(raw) : 0.75;
  return Number.isFinite(r) ? r : 0.75;
}

export function setRadiusRem(rem: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RADIUS_KEY, String(rem));
  applyRadiusFromStorage();
}

function applyRadiusFromStorage(): void {
  const rem = getRadiusRem();
  const root = document.documentElement;
  const pxBase = `${Math.round(rem * 16)}px`;
  const pxLg = `${Math.round(rem * 18)}px`;
  root.style.setProperty("--el-border-radius-base", pxBase);
  root.style.setProperty("--el-border-radius-small", `${Math.round(rem * 14)}px`);
  root.style.setProperty("--pallas-radius-lg", pxLg);
  root.style.setProperty("--pallas-radius-md", `${Math.round(rem * 15)}px`);
  root.style.setProperty("--pallas-radius-sm", `${Math.round(rem * 13)}px`);
}

export type DensityPref = "cozy" | "compact";

export function getDensity(): DensityPref {
  return typeof localStorage !== "undefined" && localStorage.getItem(DENSITY_KEY) === "compact"
    ? "compact"
    : "cozy";
}

export function setDensity(d: DensityPref): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DENSITY_KEY, d);
  applyDensityFromStorage();
}

function applyDensityFromStorage(): void {
  const d = getDensity();
  document.documentElement.classList.toggle("pallas-density-compact", d === "compact");
}

export function getDashboardPollMs(): number {
  if (typeof localStorage === "undefined") return 3000;
  const raw = localStorage.getItem(DASH_POLL_KEY);
  if (raw === null) return 3000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 3000;
}

export function setDashboardPollMs(ms: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DASH_POLL_KEY, String(ms));
  try {
    window.dispatchEvent(new Event("pallas-dashboard-poll-changed"));
  } catch {
    /* ignore */
  }
}
