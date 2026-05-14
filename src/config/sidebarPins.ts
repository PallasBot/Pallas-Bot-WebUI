/** 侧栏可固定的「子区块」：路径 + hash，与页面内锚点 id 一致 */

export const SIDEBAR_PIN_PREFIX = "pin:" as const;

export interface SidebarPinDefinition {
  id: string;
  path: string;
  hash: string;
  /** 侧栏主标题 */
  label: string;
  /** 顶栏副标题等 */
  description: string;
  icon: string;
  /** 与主导航分组标签对齐 */
  section: string;
}

export const SIDEBAR_PIN_DEFINITIONS: SidebarPinDefinition[] = [
  {
    id: "bot-social-groups",
    path: "/bot-social-config",
    hash: "#bsc-group-config",
    label: "群颗粒列表",
    description: "颗粒配置 · 群配置与列表",
    icon: "✧",
    section: "对话与对象",
  },
  {
    id: "bot-social-users",
    path: "/bot-social-config",
    hash: "#bsc-user-config",
    label: "用户颗粒",
    description: "颗粒配置 · 好友（用户）策略",
    icon: "✧",
    section: "对话与对象",
  },
];

const byId = new Map(SIDEBAR_PIN_DEFINITIONS.map((p) => [p.id, p]));

export function sidebarPinToken(id: string): string {
  return `${SIDEBAR_PIN_PREFIX}${id}`;
}

export function parseSidebarPinToken(token: string): SidebarPinDefinition | undefined {
  if (!token.startsWith(SIDEBAR_PIN_PREFIX)) return undefined;
  const id = token.slice(SIDEBAR_PIN_PREFIX.length);
  return byId.get(id);
}

export function isSidebarPinToken(token: string): boolean {
  return Boolean(parseSidebarPinToken(token));
}
