export interface MainNavItem {
  to: string;
  label: string;
  icon: string;
  description: string;
}

/** 侧栏主导航默认项与顺序（含外观偏好） */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", icon: "◆", description: "容量与账号摘要" },
  { to: "/logs", label: "运行日志", icon: "≡", description: "检索与导出" },
  { to: "/instances", label: "实例与连接", icon: "◎", description: "在线与协议快照" },
  { to: "/plugins", label: "插件", icon: "▣", description: "已启用模块" },
  { to: "/common-config", label: "通用配置", icon: "⚙", description: "跨模块公共项" },
  { to: "/protocol", label: "协议端", icon: "⎈", description: "协议控制台" },
  { to: "/friends-groups", label: "好友与群", icon: "☺", description: "列表与审批" },
  { to: "/bot-social-config", label: "颗粒配置", icon: "✧", description: "按对象策略" },
  { to: "/database", label: "数据库", icon: "▤", description: "存储体量" },
  { to: "/update", label: "更新", icon: "↑", description: "发行说明" },
  { to: "/ai", label: "AI 扩展", icon: "◇", description: "扩展服务" },
  { to: "/security", label: "控制台口令", icon: "◈", description: "访问凭据" },
  { to: "/preferences", label: "外观偏好", icon: "✦", description: "本机界面" },
];

/** 顶栏/路由与侧栏图标对齐 */
export function mainNavIconForPath(routePath: string): string {
  const path = routePath || "/";
  if (path.startsWith("/plugins/") && path !== "/plugins") {
    return MAIN_NAV_ITEMS.find((i) => i.to === "/plugins")?.icon ?? "▣";
  }
  const first = path.split("/").filter(Boolean)[0];
  const key = first ? `/${first}` : "/";
  return MAIN_NAV_ITEMS.find((i) => i.to === key)?.icon ?? "◇";
}

const DEFAULT_ORDER = MAIN_NAV_ITEMS.map((i) => i.to);

export function normalizeMainNavOrder(saved: string[] | undefined | null): string[] {
  const allowed = new Set(DEFAULT_ORDER);
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(saved)) {
    for (const p of saved) {
      if (typeof p !== "string") continue;
      if (!allowed.has(p) || seen.has(p)) continue;
      out.push(p);
      seen.add(p);
    }
  }
  for (const p of DEFAULT_ORDER) {
    if (!seen.has(p)) out.push(p);
  }
  return out;
}

export function mainNavItemByPath(to: string): MainNavItem | undefined {
  return MAIN_NAV_ITEMS.find((i) => i.to === to);
}
