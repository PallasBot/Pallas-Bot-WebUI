import { reactive } from "vue";
import { normalizeMainNavOrder } from "@/config/mainNav";

const STORAGE_KEY = "pallas_console_prefs_v1";

export type ThemeMode = "dark" | "light" | "system";
export type RadiusMode = "tight" | "default" | "round";
export type DensityMode = "comfortable" | "compact";

export type DataViewMode = "table" | "cards";

export interface ConsolePrefsState {
  theme: ThemeMode;
  radius: RadiusMode;
  density: DensityMode;
  /** 桌面宽度下是否收起左侧主导航（仅图标条） */
  sidebarCollapsed: boolean;
  /** 实例页：数据库 Bot 配置表格/卡片默认视图 */
  instancesBotView: DataViewMode;
  /** 控制台各列表默认每页条数（4–80） */
  tablePageSize: number;
  /** 侧栏主导航 path 顺序（与 mainNav 对齐） */
  sidebarNavOrder: string[];
}

const defaults: ConsolePrefsState = {
  theme: "dark",
  radius: "default",
  density: "comfortable",
  sidebarCollapsed: false,
  instancesBotView: "table",
  tablePageSize: 12,
  sidebarNavOrder: normalizeMainNavOrder(undefined),
};

function load(): ConsolePrefsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<ConsolePrefsState>;
    const merged = { ...defaults, ...parsed };
    if (merged.instancesBotView !== "table" && merged.instancesBotView !== "cards") {
      merged.instancesBotView = defaults.instancesBotView;
    }
    const ps = Number(merged.tablePageSize);
    if (!Number.isFinite(ps)) merged.tablePageSize = defaults.tablePageSize;
    else merged.tablePageSize = Math.min(80, Math.max(4, Math.floor(ps)));
    merged.sidebarNavOrder = normalizeMainNavOrder(
      Array.isArray(parsed.sidebarNavOrder) ? (parsed.sidebarNavOrder as string[]) : undefined,
    );
    return merged;
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
  const next = { ...patch };
  if (next.sidebarNavOrder !== undefined) {
    next.sidebarNavOrder = normalizeMainNavOrder(next.sidebarNavOrder);
  }
  Object.assign(consolePrefs, next);
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
