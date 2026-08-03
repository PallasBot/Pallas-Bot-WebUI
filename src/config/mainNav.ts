import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Archive,
  Blocks,
  Database,
  Download,
  LayoutDashboard,
  LineChart,
  Palette,
  Radio,
  ScrollText,
  Server,
  Sparkles,
  Store,
  Users,
  Globe2,
  Images,
} from "lucide-react";
import { AI_OBSERVATION_DEFAULT_PATH } from "@/config/aiObservationSections";
import { COMMUNITY_FEDERATION_NOTICE } from "@/config/navigationNotices";
import type { NavigationNotice } from "@/config/navigationNotices";

export type MainNavItem = {
  to: string;
  label: string;
  /**
   * 分组名；空字符串表示顶层独立项（不套折叠分组头）。
   */
  section: string;
  icon: LucideIcon;
  /** 有用户可见更新时递增 revision；按声明的页面或分区标记已阅。 */
  notice?: NavigationNotice;
};

/**
 * 侧栏主导航：常用页独立置顶/置底，其余进折叠组。
 */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", section: "", icon: LayoutDashboard },
  { to: "/charts", label: "数据看板", section: "", icon: LineChart },
  { to: "/logs", label: "运行日志", section: "", icon: ScrollText },
  { to: "/log-errors", label: "日志报错", section: "", icon: Activity },
  { to: "/instances", label: "数据库实例", section: "接入与社交", icon: Server },
  { to: "/protocol", label: "协议连接", section: "接入与社交", icon: Radio },
  { to: "/friends-groups", label: "好友与群聊", section: "接入与社交", icon: Users },
  { to: "/plugins", label: "插件列表", section: "插件", icon: Blocks },
  { to: "/plugin-store", label: "插件商店", section: "插件", icon: Store },
  { to: AI_OBSERVATION_DEFAULT_PATH, label: "AI 观测", section: "AI", icon: LayoutDashboard },
  { to: "/ai/config/provider", label: "AI 配置", section: "AI", icon: Sparkles },
  { to: "/database", label: "数据库", section: "数据", icon: Database },
  { to: "/database/backups", label: "备份管理", section: "数据", icon: Archive },
  {
    to: "/community",
    label: "统计与语料",
    section: "数据",
    icon: Globe2,
    notice: COMMUNITY_FEDERATION_NOTICE,
  },
  { to: "/community-gallery", label: "社区投稿", section: "", icon: Images },
  { to: "/preferences", label: "偏好", section: "", icon: Palette },
  { to: "/update", label: "更新", section: "", icon: Download },
];

export type NavEntry =
  | { kind: "item"; item: MainNavItem }
  | { kind: "group"; section: string; items: MainNavItem[] };

/** 按 MAIN_NAV_ITEMS 顺序折叠：连续同 section 成组，section 为空则独立 */
export function buildNavEntries(items: MainNavItem[] = MAIN_NAV_ITEMS): NavEntry[] {
  const entries: NavEntry[] = [];
  for (const item of items) {
    const section = item.section.trim();
    if (!section) {
      entries.push({ kind: "item", item });
      continue;
    }
    const last = entries[entries.length - 1];
    if (last?.kind === "group" && last.section === section) {
      last.items.push(item);
    } else {
      entries.push({ kind: "group", section, items: [item] });
    }
  }
  return entries;
}

/** 分组头图标：取组内第一项 */
export function sectionIcon(section: string): LucideIcon {
  const first = MAIN_NAV_ITEMS.find((i) => i.section === section);
  return first?.icon ?? LayoutDashboard;
}

function isAiObservationPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  if (p === "/ai" || p === "/ai/home" || p.startsWith("/ai/home/")) return true;
  if (p === "/ai/wizard" || p.startsWith("/ai/wizard/")) return true;
  return (
    p === "/ai/statistics" ||
    p.startsWith("/ai/statistics/") ||
    p === "/ai/session" ||
    p.startsWith("/ai/session/") ||
    p === "/ai/memory" ||
    p.startsWith("/ai/memory/") ||
    p === "/ai/persona" ||
    p.startsWith("/ai/persona/") ||
    p === "/ai/history" ||
    p.startsWith("/ai/history/") ||
    p === "/ai/logs" ||
    p.startsWith("/ai/logs/")
  );
}

/** 与侧栏高亮规则一致：当前 path 对应哪条主导航 */
export function isNavActive(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/";
  if (to === AI_OBSERVATION_DEFAULT_PATH) {
    return isAiObservationPath(pathname);
  }
  if (to === "/ai/config/provider" || to.startsWith("/ai/config/")) {
    return pathname.startsWith("/ai/config");
  }
  if (pathname === to || pathname.startsWith(`${to}/`)) {
    const moreSpecific = MAIN_NAV_ITEMS.some(
      (other) =>
        other.to !== to &&
        other.to.startsWith(`${to}/`) &&
        (pathname === other.to || pathname.startsWith(`${other.to}/`)),
    );
    return !moreSpecific;
  }
  return false;
}

/** 当前路由命中的主导航项（图标与侧栏同源） */
export function mainNavItemForPath(pathname: string): MainNavItem | undefined {
  return MAIN_NAV_ITEMS.find((item) => isNavActive(pathname, item.to));
}

/** 页头标题前缀图标：复用 MAIN_NAV_ITEMS，勿另起一套 */
export function mainNavIconForPath(pathname: string): LucideIcon | undefined {
  return mainNavItemForPath(pathname)?.icon;
}
