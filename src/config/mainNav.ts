import { isSidebarPinToken, SIDEBAR_PIN_DEFINITIONS } from "./sidebarPins";

export interface MainNavItem {
  to: string;
  label: string;
  icon: string;
  description: string;
  /** 侧栏分组：相邻项相同则只显示一次分组标题 */
  section: string;
}

/** 侧栏主导航默认项与顺序（「更新」固定在最后） */
export const MAIN_NAV_ITEMS: MainNavItem[] = [
  { to: "/", label: "仪表盘", icon: "◆", description: "容量与账号摘要", section: "运行与观测" },
  {
    to: "/community-center",
    label: "社区中心",
    icon: "◉",
    description: "社区统计与 24h 趋势",
    section: "运行与观测",
  },
  { to: "/logs", label: "运行日志", icon: "≡", description: "检索与导出", section: "运行与观测" },
  { to: "/log-errors", label: "日志报错", icon: "⚠", description: "ERROR 快照与归档", section: "运行与观测" },
  { to: "/instances", label: "数据库实例", icon: "◎", description: "库内 Bot 与 NoneBot 连接", section: "接入与实例" },
  { to: "/protocol", label: "协议端实例", icon: "◎", description: "协议账号与运维入口", section: "接入与实例" },
  { to: "/plugins", label: "插件", icon: "▣", description: "已启用模块", section: "模块与配置" },
  { to: "/common-config", label: "通用配置", icon: "⛭", description: "审查、语料、协议端等公共项", section: "模块与配置" },
  { to: "/friends-groups", label: "好友与群聊", icon: "⊞", description: "列表、配置与审批", section: "对话与对象" },
  { to: "/database", label: "数据库", icon: "▤", description: "存储体量", section: "数据与扩展" },
  { to: "/corpus-config", label: "语料联邦", icon: "⧉", description: "社区语料与多读源", section: "数据与扩展" },
  { to: "/ai", label: "AI 扩展", icon: "◇", description: "扩展服务", section: "数据与扩展" },
  { to: "/preferences", label: "偏好", icon: "✦", description: "外观与控制台口令", section: "本机与维护" },
  { to: "/update", label: "更新", icon: "↑", description: "发行与升级", section: "本机与维护" },
];

/** 顶栏/路由与侧栏图标对齐 */
export function mainNavIconForPath(routePath: string, routeHash?: string): string {
  const path = routePath || "/";
  const hash = (routeHash || "").trim();
  for (const pin of SIDEBAR_PIN_DEFINITIONS) {
    if (pin.path === path && pin.hash === hash) return pin.icon;
  }
  if (path.startsWith("/plugins/") && path !== "/plugins") {
    return MAIN_NAV_ITEMS.find((i) => i.to === "/plugins")?.icon ?? "▣";
  }
  const first = path.split("/").filter(Boolean)[0];
  const key = first ? `/${first}` : "/";
  const row = MAIN_NAV_ITEMS.find((i) => i.to === key);
  if (row) return row.icon;
  return "◇";
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

const CORPUS_CONFIG_PATH = "/corpus-config";

/** 侧栏布局 v3：为已保存顺序补入「语料联邦」（不覆盖用户显式隐藏的项以外的顺序） */
export function migrateSidebarOrderCorpusConfig(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes(CORPUS_CONFIG_PATH)) return base;
  for (const anchor of ["/ai", "/preferences", "/update"]) {
    const i = base.indexOf(anchor);
    if (i >= 0) {
      const next = [...base];
      next.splice(i, 0, CORPUS_CONFIG_PATH);
      return next;
    }
  }
  const dbIdx = base.indexOf("/database");
  if (dbIdx >= 0) {
    const next = [...base];
    next.splice(dbIdx + 1, 0, CORPUS_CONFIG_PATH);
    return next;
  }
  const updIdx = base.indexOf("/update");
  if (updIdx >= 0) {
    const next = [...base];
    next.splice(updIdx, 0, CORPUS_CONFIG_PATH);
    return next;
  }
  return [...base, CORPUS_CONFIG_PATH];
}

const COMMUNITY_CENTER_PATH = "/community-center";

/** 侧栏布局 v4：为已保存顺序补入「社区中心」（仪表盘之后） */
export function migrateSidebarOrderCommunityCenter(saved: string[] | undefined | null): string[] {
  const base = normalizeMainNavOrder(saved);
  if (base.includes(COMMUNITY_CENTER_PATH)) return base;
  const homeIdx = base.indexOf("/");
  if (homeIdx >= 0) {
    const next = [...base];
    next.splice(homeIdx + 1, 0, COMMUNITY_CENTER_PATH);
    return next;
  }
  return [COMMUNITY_CENTER_PATH, ...base];
}

export function mainNavItemByPath(to: string): MainNavItem | undefined {
  return MAIN_NAV_ITEMS.find((i) => i.to === to);
}
