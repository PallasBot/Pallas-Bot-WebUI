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
    id: "friends-groups-account",
    path: "/friends-groups",
    hash: "#fg-account",
    label: "好友与群 · 当前账号",
    description: "选 Bot",
    icon: "⊞",
    section: "对话与对象",
  },
  {
    id: "friends-groups-friends",
    path: "/friends-groups",
    hash: "#fg-friends",
    label: "好友与群 · 好友列表",
    description: "好友配置",
    icon: "⊞",
    section: "对话与对象",
  },
  {
    id: "friends-groups-groups",
    path: "/friends-groups",
    hash: "#fg-groups",
    label: "好友与群 · 群聊列表",
    description: "群配置",
    icon: "⊞",
    section: "对话与对象",
  },
  {
    id: "friends-groups-friend-req",
    path: "/friends-groups",
    hash: "#friends-groups-friend-requests",
    label: "好友与群 · 好友申请",
    description: "好友审批",
    icon: "⊞",
    section: "对话与对象",
  },
  {
    id: "friends-groups-group-req",
    path: "/friends-groups",
    hash: "#friends-groups-group-requests",
    label: "好友与群 · 入群请求",
    description: "入群审批",
    icon: "⊞",
    section: "对话与对象",
  },
  {
    id: "database-group-configs",
    path: "/database",
    hash: "#db-group-configs",
    label: "数据库 · 群配置",
    description: "群表",
    icon: "▤",
    section: "数据与扩展",
  },
  {
    id: "database-user-configs",
    path: "/database",
    hash: "#db-user-configs",
    label: "数据库 · 好友配置",
    description: "好友表",
    icon: "▤",
    section: "数据与扩展",
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
