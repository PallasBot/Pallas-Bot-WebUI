import { reactive } from "vue";
import { type AccentPreset, isAccentPreset } from "@/config/accentPresets";
import {
  DEFAULT_SIDEBAR_NAV_ORDER,
  migrateSidebarOrderChartsPage,
  migrateSidebarOrderCommunityPage,
  migrateSidebarOrderDatabaseBackups,
  migrateSidebarOrderAiConfig,
  migrateSidebarOrderAiHubSingle,
  migrateSidebarOrderPluginStore,
  migrateSidebarOrderRemoveCommonConfig,
  migrateSidebarOrderUpdateToEnd,
  normalizeMainNavOrder,
} from "@/config/mainNav";
import {
  applyConsoleDocumentDataset,
  buildConsoleDocumentDataset,
} from "@/utils/consolePrefsDocument";

const STORAGE_KEY = "pallas_console_prefs_v1";

export type ThemeMode = "dark" | "light" | "system";
export type RadiusMode = "tight" | "default" | "round";
export type SurfaceStyle = "solid" | "glass";
/** GS 彩色胶囊 vs shadcn 纯黑白 */
export type UiPreset = "gs" | "shadcn";
export type DensityMode = "comfortable" | "compact";
export type { AccentPreset };

export type DataViewMode = "table" | "cards";

export interface ConsolePrefsState {
  theme: ThemeMode;
  radius: RadiusMode;
  /** 面板/卡片视觉：纯色或毛玻璃 */
  surfaceStyle: SurfaceStyle;
  /** 毛玻璃 blur 像素（8–40） */
  glassBlur: number;
  /** 卡片毛玻璃不透明度（0.12–0.72） */
  cardGlassOpacity: number;
  density: DensityMode;
  /** 强调色预设（链接、主按钮、高亮等） */
  accentPreset: AccentPreset;
  /** 界面主题预设：GS 或 shadcn monochrome */
  uiPreset: UiPreset;
  /** 桌面宽度下是否收起左侧主导航（仅图标条） */
  sidebarCollapsed: boolean;
  /** 实例页：数据库中的实例表格/卡片默认视图 */
  instancesBotView: DataViewMode;
  /** 协议端页：协议端中的实例表格/卡片默认视图 */
  protocolAccountsView: DataViewMode;
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
  /** 数据库页：群配置面板是否展开 */
  databasePageGroupConfigsOpen: boolean;
  /** 数据库页：好友配置面板是否展开 */
  databasePageUserConfigsOpen: boolean;
}
const defaults: ConsolePrefsState = {
  theme: "system",
  radius: "round",
  surfaceStyle: "glass",
  glassBlur: 12,
  cardGlassOpacity: 0.25,
  density: "comfortable",
  accentPreset: "sky",
  uiPreset: "shadcn",
  sidebarCollapsed: false,
  instancesBotView: "cards",
  protocolAccountsView: "cards",
  tablePageSize: 12,
  sidebarNavOrder: [...DEFAULT_SIDEBAR_NAV_ORDER],
  sidebarNavSectionByToken: {},
  sidebarNavLayoutVersion: 13,
  friendsPageFriendsListOpen: true,
  friendsPageGroupsListOpen: true,
  databasePageGroupConfigsOpen: true,
  databasePageUserConfigsOpen: true,
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
    if (merged.protocolAccountsView !== "table" && merged.protocolAccountsView !== "cards") {
      merged.protocolAccountsView = defaults.protocolAccountsView;
    }
    const ps = Number(merged.tablePageSize);
    if (!Number.isFinite(ps)) merged.tablePageSize = defaults.tablePageSize;
    else merged.tablePageSize = Math.min(80, Math.max(4, Math.floor(ps)));

    const layoutVerRaw = (parsed as { sidebarNavLayoutVersion?: unknown }).sidebarNavLayoutVersion;
    const layoutVer =
      typeof layoutVerRaw === "number" && Number.isFinite(layoutVerRaw) ? Math.floor(layoutVerRaw) : 0;

    let nextOrder = Array.isArray(parsed.sidebarNavOrder) ? (parsed.sidebarNavOrder as string[]) : undefined;
    let layoutVerOut = layoutVer;
    if (layoutVerOut < 2) {
      nextOrder = migrateSidebarOrderUpdateToEnd(nextOrder);
      layoutVerOut = 2;
    }
    if (layoutVerOut < 3) {
      nextOrder = migrateSidebarOrderCommunityPage(nextOrder);
      layoutVerOut = 3;
    }
    if (layoutVerOut < 4) {
      nextOrder = migrateSidebarOrderPluginStore(nextOrder);
      layoutVerOut = 4;
    }
    if (layoutVerOut < 5) {
      nextOrder = migrateSidebarOrderChartsPage(nextOrder);
      layoutVerOut = 5;
    }
    if (layoutVerOut < 6) {
      nextOrder = migrateSidebarOrderDatabaseBackups(nextOrder);
      layoutVerOut = 6;
    }
    if (layoutVerOut < 7) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 7;
    }
    if (layoutVerOut < 8) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 8;
    }
    if (layoutVerOut < 9) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 9;
    }
    if (layoutVerOut < 10) {
      nextOrder = migrateSidebarOrderAiHubSingle(nextOrder);
      layoutVerOut = 10;
    }
    if (layoutVerOut < 11) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 11;
    }
    if (layoutVerOut < 12) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 12;
    }
    if (layoutVerOut < 13) {
      nextOrder = migrateSidebarOrderAiConfig(nextOrder);
      layoutVerOut = 13;
    }
    if (layoutVerOut < 14) {
      nextOrder = migrateSidebarOrderRemoveCommonConfig(nextOrder);
      layoutVerOut = 14;
    }
    const layoutMigrated = layoutVerOut !== layoutVer;
    merged.sidebarNavLayoutVersion = layoutVerOut;
    merged.sidebarNavOrder = normalizeMainNavOrder(nextOrder);

    if (typeof parsed.friendsPageFriendsListOpen === "boolean") {
      merged.friendsPageFriendsListOpen = parsed.friendsPageFriendsListOpen;
    }
    if (typeof parsed.friendsPageGroupsListOpen === "boolean") {
      merged.friendsPageGroupsListOpen = parsed.friendsPageGroupsListOpen;
    }
    if (typeof parsed.databasePageGroupConfigsOpen === "boolean") {
      merged.databasePageGroupConfigsOpen = parsed.databasePageGroupConfigsOpen;
    }
    if (typeof parsed.databasePageUserConfigsOpen === "boolean") {
      merged.databasePageUserConfigsOpen = parsed.databasePageUserConfigsOpen;
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
    if (merged.theme !== "dark" && merged.theme !== "light" && merged.theme !== "system") {
      merged.theme = defaults.theme;
    }
    if (merged.radius !== "tight" && merged.radius !== "default" && merged.radius !== "round") {
      merged.radius = defaults.radius;
    }
    if (merged.surfaceStyle !== "solid" && merged.surfaceStyle !== "glass") {
      merged.surfaceStyle = defaults.surfaceStyle;
    }
    const blurRaw = Number((parsed as { glassBlur?: unknown }).glassBlur ?? merged.glassBlur);
    if (Number.isFinite(blurRaw)) merged.glassBlur = Math.min(40, Math.max(8, Math.round(blurRaw)));
    const opRaw = Number((parsed as { cardGlassOpacity?: unknown }).cardGlassOpacity ?? merged.cardGlassOpacity);
    if (Number.isFinite(opRaw)) merged.cardGlassOpacity = Math.min(0.72, Math.max(0.12, opRaw));
    if (merged.density !== "comfortable" && merged.density !== "compact") {
      merged.density = defaults.density;
    }
    if (!isAccentPreset(merged.accentPreset)) {
      merged.accentPreset = defaults.accentPreset;
    }
    const uiRaw = (parsed as { uiPreset?: unknown }).uiPreset;
    if (uiRaw === "gs" || uiRaw === "shadcn") {
      merged.uiPreset = uiRaw;
    } else {
      merged.uiPreset = defaults.uiPreset;
    }
    if (layoutMigrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
    }
    return merged;
  } catch {
    return { ...defaults };
  }
}

export const consolePrefs = reactive<ConsolePrefsState>(load());

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyConsolePrefsToDocument(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  applyConsoleDocumentDataset(el, buildConsoleDocumentDataset(consolePrefs, systemPrefersDark()));
  const blur = consolePrefs.glassBlur;
  const saturate = 1.08 + ((blur - 8) / 32) * 0.18;
  const glassPct = Math.round(consolePrefs.cardGlassOpacity * 100);
  el.style.setProperty("--surface-blur", `${blur}px`);
  el.style.setProperty("--card-glass-opacity", String(consolePrefs.cardGlassOpacity));
  el.style.setProperty("--shell-glass-pct", `${glassPct}%`);
  el.style.setProperty("--glass-saturate", saturate.toFixed(2));
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
    sidebarNavLayoutVersion: 9,
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
