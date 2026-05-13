export interface MainNavItem {
  to: string;
  label: string;
  icon: string;
  description: string;
}

/** 侧栏主导航默认项与顺序（含外观偏好） */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", icon: "◆", description: "容量、接入与账号一览" },
  { to: "/logs", label: "运行日志", icon: "≡", description: "检索与导出运行期输出" },
  { to: "/instances", label: "实例与连接", icon: "◎", description: "在线状态与协议快照" },
  { to: "/plugins", label: "插件", icon: "▣", description: "已启用模块与可调参数" },
  { to: "/common-config", label: "通用配置", icon: "⚙", description: "跨模块公共项" },
  { to: "/protocol", label: "协议端", icon: "⎈", description: "协议控制台入口与策略" },
  { to: "/friends-groups", label: "好友与群", icon: "☺", description: "列表与好友/入群审批" },
  { to: "/bot-social-config", label: "颗粒配置", icon: "✧", description: "按对象覆盖策略" },
  { to: "/database", label: "数据库", icon: "▤", description: "存储规模与维护" },
  { to: "/update", label: "更新", icon: "↑", description: "发行版与变更窗口" },
  { to: "/ai", label: "AI 扩展", icon: "◇", description: "扩展服务与运行记录" },
  { to: "/security", label: "控制台口令", icon: "◈", description: "控制台访问凭据" },
  { to: "/preferences", label: "外观偏好", icon: "✦", description: "本机界面呈现" },
];

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
