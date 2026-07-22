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
  Stethoscope,
} from "lucide-react";

export type MainNavItem = {
  to: string;
  label: string;
  section: string;
  icon: LucideIcon;
};

/** 与 Vue MAIN_NAV_ITEMS 分组/顺序对齐（不含拖拽 pin） */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", section: "运行与观测", icon: LayoutDashboard },
  { to: "/charts", label: "数据看板", section: "运行与观测", icon: LineChart },
  { to: "/logs", label: "运行日志", section: "运行与观测", icon: ScrollText },
  { to: "/log-errors", label: "日志报错", section: "运行与观测", icon: Activity },
  { to: "/instances", label: "数据库实例", section: "接入与实例", icon: Server },
  { to: "/protocol", label: "协议连接", section: "接入与实例", icon: Radio },
  { to: "/plugins", label: "插件列表", section: "模块与配置", icon: Blocks },
  { to: "/plugin-store", label: "插件商店", section: "模块与配置", icon: Store },
  { to: "/ai/home", label: "AI 观测", section: "AI", icon: LayoutDashboard },
  { to: "/ai/wizard", label: "AI 体检", section: "AI", icon: Stethoscope },
  { to: "/ai/config/provider", label: "AI 配置", section: "AI", icon: Sparkles },
  { to: "/friends-groups", label: "好友与群聊", section: "对话与对象", icon: Users },
  { to: "/database", label: "数据库", section: "数据与扩展", icon: Database },
  { to: "/database/backups", label: "备份管理", section: "数据与扩展", icon: Archive },
  { to: "/community", label: "统计与语料", section: "数据与扩展", icon: Globe2 },
  { to: "/preferences", label: "偏好", section: "本机与维护", icon: Palette },
  { to: "/update", label: "更新", section: "本机与维护", icon: Download },
];

/** 分组头图标：取组内第一项 */
export function sectionIcon(section: string): LucideIcon {
  const first = MAIN_NAV_ITEMS.find((i) => i.section === section);
  return first?.icon ?? LayoutDashboard;
}
