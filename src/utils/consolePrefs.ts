import { reactive } from "vue";
import {
  DEFAULT_SIDEBAR_NAV_ORDER,
  migrateSidebarOrderUpdateToEnd,
  normalizeMainNavOrder,
} from "@/config/mainNav";
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
  /** 实例页：数据库中的实例表格/卡片默认视图 */
  instancesBotView: DataViewMode;
  /** 控制台各列表默认每页条数（4–80） */
  tablePageSize: number;
  /** 侧栏 token 顺序（path 或 pin:id，见 mainNav / sidebarPins） */
  sidebarNavOrder: string[];
  /** 侧栏项 token → 自定义分组标题（仅影响侧栏与「未在侧栏」列表的分组展示） */
  sidebarNavSectionByToken: Record<string, string>;
  /** 侧栏布局版本：用于一次性迁移默认顺序等 */
  sidebarNavLayoutVersion: number;
  /** 好友与群页：好友列表面板是否展开 */
  friendsPageFriendsListOpen: boolean;
  /** 好友与群页：群聊列表面板是否展开 */
  friendsPageGroupsListOpen: boolean;
  /** 颗粒配置页：群配置下列表区域是否展开 */
  botSocialPageGroupListOpen: boolean;
}
const defaults: ConsolePrefsState = {
  theme: "system",
  radius: "default",
  density: "comfortable",
  sidebarCollapsed: false,
  instancesBotView: "table",
  tablePageSize: 12,
  sidebarNavOrder: [...DEFAULT_SIDEBAR_NAV_ORDER],
  sidebarNavSectionByToken: {},
  sidebarNavLayoutVersion: 2,
  friendsPageFriendsListOpen: true,
  friendsPageGroupsListOpen: true,
  botSocialPageGroupListOpen: true,
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

    const layoutVerRaw = (parsed as { sidebarNavLayoutVersion?: unknown }).sidebarNavLayoutVersion;
    const layoutVer =
      typeof layoutVerRaw === "number" && Number.isFinite(layoutVerRaw) ? Math.floor(layoutVerRaw) : 0;

    let nextOrder = Array.isArray(parsed.sidebarNavOrder) ? (parsed.sidebarNavOrder as string[]) : undefined;
    if (layoutVer < 2) {
      nextOrder = migrateSidebarOrderUpdateToEnd(nextOrder);
      merged.sidebarNavLayoutVersion = 2;
    } else {
      merged.sidebarNavLayoutVersion = Math.max(2, layoutVer);
    }
    merged.sidebarNavOrder = normalizeMainNavOrder(nextOrder);

    if (typeof parsed.friendsPageFriendsListOpen === "boolean") {
      merged.friendsPageFriendsListOpen = parsed.friendsPageFriendsListOpen;
    }
    if (typeof parsed.friendsPageGroupsListOpen === "boolean") {
      merged.friendsPageGroupsListOpen = parsed.friendsPageGroupsListOpen;
    }
    if (typeof (parsed as { botSocialPageGroupListOpen?: unknown }).botSocialPageGroupListOpen === "boolean") {
      merged.botSocialPageGroupListOpen = (parsed as { botSocialPageGroupListOpen: boolean }).botSocialPageGroupListOpen;
    }
    const sectRaw = (parsed as { sidebarNavSectionByToken?: unknown }).sidebarNavSectionByToken;
    if (sectRaw && typeof sectRaw === "object" && !Array.isArray(sectRaw)) {
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(sectRaw as Record<string, unknown>)) {
        if (typeof k !== "string" || typeof v !== "string") continue;
        const kt = k.trim();
        const vt = v.trim();
        if (kt && vt) cleaned[kt] = vt;
      }
      merged.sidebarNavSectionByToken = cleaned;
    }
    if (merged.theme !== "dark" && merged.theme !== "light" && merged.theme !== "system") {      merged.theme = defaults.theme;
    }
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
  if (next.sidebarNavSectionByToken !== undefined) {
    const o = next.sidebarNavSectionByToken;
    const cleaned: Record<string, string> = {};
    if (o && typeof o === "object" && !Array.isArray(o)) {
      for (const [k, v] of Object.entries(o)) {
        if (typeof k !== "string" || typeof v !== "string") continue;
        const kt = k.trim();
        const vt = v.trim();
        if (kt && vt) cleaned[kt] = vt;
      }
    }
    next.sidebarNavSectionByToken = cleaned;
  }
  Object.assign(consolePrefs, next);
  persistConsolePrefs();
  applyConsolePrefsToDocument();
}

/** 恢复侧栏默认顺序与固定项（含「更新」在末尾） */
export function resetSidebarNavToDefaults(): void {
  setConsolePrefs({
    sidebarNavOrder: [...DEFAULT_SIDEBAR_NAV_ORDER],
    sidebarNavLayoutVersion: 2,
  });
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
