import type { ConsoleNavIconId } from "@/config/consoleNavIcons";

/** GS 风格侧栏二次菜单：将相关路由折叠为一组 */
export interface SidebarNavGroupDef {
  id: string;
  label: string;
  icon: ConsoleNavIconId;
  paths: readonly string[];
}

export const SIDEBAR_NAV_GROUPS: SidebarNavGroupDef[] = [
  { id: "logs", label: "日志", icon: "logs", paths: ["/logs", "/log-errors"] },
  { id: "instances", label: "实例", icon: "server", paths: ["/instances", "/protocol"] },
  { id: "plugins", label: "插件", icon: "blocks", paths: ["/plugins", "/plugin-store"] },
  { id: "ai", label: "AI", icon: "sparkles", paths: ["/ai/home", "/ai/wizard", "/ai/config/runtime"] },
  { id: "database", label: "数据库", icon: "database", paths: ["/database", "/database/backups"] },
];

const PATH_TO_GROUP = new Map<string, SidebarNavGroupDef>();
for (const g of SIDEBAR_NAV_GROUPS) {
  for (const p of g.paths) PATH_TO_GROUP.set(p, g);
}

export function sidebarGroupForPath(path: string): SidebarNavGroupDef | undefined {
  return PATH_TO_GROUP.get(path);
}
