import { isSidebarPinToken, SIDEBAR_PIN_DEFINITIONS } from "./sidebarPins";
import {
  AI_CONFIG_MAIN_NAV_ITEM,
  AI_CONFIG_SECTION_PATHS,
  AI_CONFIG_SIDEBAR_PATH,
} from "./aiConfigSections";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import { resolveConsoleNavIcon } from "@/config/consoleNavIcons";

export interface MainNavItem {
  to: string;
  label: string;
  icon: ConsoleNavIconId;
  description: string;
  /** 侧栏分组：相邻项相同则只显示一次分组标题 */
  section: string;
}

/** 侧栏主导航默认项与顺序（「更新」固定在最后） */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", icon: "dashboard", description: "运行概览", section: "运行与观测" },
  { to: "/charts", label: "数据看板", icon: "charts", description: "Bot 与 LLM 趋势", section: "运行与观测" },
  { to: "/logs", label: "运行日志", icon: "logs", description: "检索导出", section: "运行与观测" },
  { to: "/log-errors", label: "日志报错", icon: "alert", description: "错误归档", section: "运行与观测" },
  { to: "/instances", label: "数据库实例", icon: "server", description: "Bot 连接", section: "接入与实例" },
  { to: "/protocol", label: "协议端实例", icon: "radio", description: "协议运维", section: "接入与实例" },
  { to: "/plugins", label: "插件", icon: "blocks", description: "已加载", section: "模块与配置" },
  { to: "/plugin-store", label: "插件商店", icon: "store", description: "官方扩展与社区插件", section: "模块与配置" },
  { to: "/common-config", label: "通用配置", icon: "settings", description: "公共项", section: "模块与配置" },
  AI_CONFIG_MAIN_NAV_ITEM,
  { to: "/friends-groups", label: "好友与群聊", icon: "users", description: "列表审批", section: "对话与对象" },
  { to: "/database", label: "数据库", icon: "database", description: "存储明细", section: "数据与扩展" },
  { to: "/database/backups", label: "备份管理", icon: "backup", description: "创建与清理", section: "数据与扩展" },
  { to: "/community", label: "统计与语料", icon: "globe", description: "社区统计", section: "数据与扩展" },
  { to: "/preferences", label: "偏好", icon: "palette", description: "外观口令", section: "本机与维护" },
  { to: "/update", label: "更新", icon: "download", description: "版本升级", section: "本机与维护" },
];

/** 顶栏/路由与侧栏图标对齐 */
export function mainNavIconForPath(routePath: string, routeHash?: string): ConsoleNavIconId {
  const path = routePath || "/";
  const hash = (routeHash || "").trim();
  for (const pin of SIDEBAR_PIN_DEFINITIONS) {
    if (pin.path === path && pin.hash === hash) return resolveConsoleNavIcon(pin.icon);
  }
  if (path.startsWith("/plugins/") && path !== "/plugins") {
    return MAIN_NAV_ITEMS.find((i) => i.to === "/plugins")?.icon ?? "blocks";
  }
  if (path === "/plugin-store") {
    return MAIN_NAV_ITEMS.find((i) => i.to === "/plugin-store")?.icon ?? "store";
  }
  if (path === AI_CONFIG_SIDEBAR_PATH || path.startsWith("/ai/")) {
    return AI_CONFIG_MAIN_NAV_ITEM.icon;
  }
  if (path === "/database/backups" || path.startsWith("/database/backups/")) {
    return "backup";
  }
  const first = path.split("/").filter(Boolean)[0];
  const key = first ? `/${first}` : "/";
  const row = MAIN_NAV_ITEMS.find((i) => i.to === key);
  if (row) return row.icon;
  return "default";
}

const DEFAULT_ORDER = MAIN_NAV_ITEMS.map((i) => i.to);
const ALLOWED_MAIN = new Set(DEFAULT_ORDER);

/** 与 `normalizeMainNavOrder` 同步：新装或重置时的默认顺序 */
export const DEFAULT_SIDEBAR_NAV_ORDER = [...DEFAULT_ORDER];

/** 旧侧栏顺序中的路径归并（移除独立「控制台口令」入口后兼容本地存储） */
function canonicalNavPath(path: string): string {
  const p = path.trim();
  if (p === "/security") return "/preferences";
  if (p === "/bot-social-config") return "/friends-groups";
  if (p === "/corpus-config") return "/common-config";
  if (p === "/community-stats-config") return "/common-config";
  if (p === "/ai" || p.startsWith("/ai/")) return AI_CONFIG_SIDEBAR_PATH;
  return p;
}

/**
 * 校验并去重侧栏 token 列表。
 * - 合法项：`/` 起主导航 path，或 `pin:` 固定子区块（见 sidebarPins）。
 * - 不再自动补全被用户隐藏的项；若结果为空则回退为默认顺序。
 */
export function normalizeMainNavOrder(saved: string[] | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(saved)) {
    for (const raw of saved) {
      if (typeof raw !== "string") continue;
      const p = canonicalNavPath(raw);
      if (!p || seen.has(p)) continue;
      if (ALLOWED_MAIN.has(p) || isSidebarPinToken(p)) {
        out.push(p);
        seen.add(p);
      }
    }
  }
  if (!out.length) return [...DEFAULT_ORDER];
  return out;
}

/** 将旧版存储中的「更新」统一挪到末尾（偏好之后） */
export function migrateSidebarOrderUpdateToEnd(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  const rest = base.filter((t) => t !== "/update");
  const had = base.includes("/update");
  if (had) return [...rest, "/update"];
  return rest.length ? rest : [...DEFAULT_ORDER];
}

/** WebUI 新增「插件商店」页：插入到「插件」之后 */
export function migrateSidebarOrderPluginStore(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes("/plugin-store")) return base;
  const pluginsIdx = base.indexOf("/plugins");
  if (pluginsIdx >= 0) {
    const out = [...base];
    out.splice(pluginsIdx + 1, 0, "/plugin-store");
    return out;
  }
  return [...base, "/plugin-store"];
}

/** WebUI 新增「数据看板」页：插入到「仪表盘」之后（已有则不动） */
export function migrateSidebarOrderChartsPage(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes("/charts")) return base;
  const homeIdx = base.indexOf("/");
  if (homeIdx >= 0) {
    const out = [...base];
    out.splice(homeIdx + 1, 0, "/charts");
    return out;
  }
  return ["/", "/charts", ...base.filter((t) => t !== "/")];
}

/** WebUI 新增「统计与语料」页：插入到「数据库」与「AI 扩展」之间（已有则不动） */
export function migrateSidebarOrderCommunityPage(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes("/community")) return base;
  const insertAfter = ["/database", "/common-config", "/friends-groups"].find((t) => base.includes(t));
  if (insertAfter) {
    const idx = base.indexOf(insertAfter);
    const out = [...base];
    out.splice(idx + 1, 0, "/community");
    return out;
  }
  const aiIdx = base.indexOf("/ai");
  if (aiIdx >= 0) {
    const out = [...base];
    out.splice(aiIdx, 0, "/community");
    return out;
  }
  const updIdx = base.indexOf("/update");
  if (updIdx >= 0) {
    const out = [...base];
    out.splice(updIdx, 0, "/community");
    return out;
  }
  return [...base, "/community"];
}

/** WebUI 备份管理独立页：插入到「数据库」之后 */
export function migrateSidebarOrderDatabaseBackups(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes("/database/backups")) return base;
  const dbIdx = base.indexOf("/database");
  if (dbIdx >= 0) {
    const out = [...base];
    out.splice(dbIdx + 1, 0, "/database/backups");
    return out;
  }
  const communityIdx = base.indexOf("/community");
  if (communityIdx >= 0) {
    const out = [...base];
    out.splice(communityIdx, 0, "/database/backups");
    return out;
  }
  return [...base, "/database/backups"];
}

/** WebUI AI 配置：拆为多页并置于「通用配置」之后（历史迁移 v7–v9） */
export function migrateSidebarOrderAiConfig(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  const without = base.filter((t) => t !== "/ai" && !AI_CONFIG_SECTION_PATHS.includes(t));
  const commonIdx = without.indexOf("/common-config");
  const insertAt = commonIdx >= 0 ? commonIdx + 1 : without.length;
  const slice = without.slice(0, insertAt);
  const tail = without.slice(insertAt);
  return [...slice, ...AI_CONFIG_SECTION_PATHS, ...tail];
}

/** AI Hub：侧栏仅保留单入口「AI配置」 */
export function migrateSidebarOrderAiHubSingle(saved: string[] | undefined | null): string[] {
  const raw = Array.isArray(saved) ? saved : [];
  const withoutAi = raw.filter((t) => {
    if (typeof t !== "string") return true;
    const p = t.trim();
    return p !== AI_CONFIG_SIDEBAR_PATH && !p.startsWith("/ai/");
  });
  const base = normalizeMainNavOrder(withoutAi);
  if (base.includes(AI_CONFIG_SIDEBAR_PATH)) return base;
  const commonIdx = base.indexOf("/common-config");
  const insertAt = commonIdx >= 0 ? commonIdx + 1 : base.length;
  const slice = base.slice(0, insertAt);
  const tail = base.slice(insertAt);
  return [...slice, AI_CONFIG_SIDEBAR_PATH, ...tail];
}

export function mainNavItemByPath(to: string): MainNavItem | undefined {
  return MAIN_NAV_ITEMS.find((i) => i.to === to);
}
