import { isSidebarPinToken } from "@/config/sidebarPins";
import { mainNavItemByPath } from "@/config/mainNav";
import { consolePrefs, setConsolePrefs } from "@/utils/consolePrefs";

/** 将主导航 path 或 `pin:id` 追加到侧栏末尾（已存在则忽略） */
export function addNavTokenToSidebar(token: string): void {
  const t = (token || "").trim();
  if (!t || consolePrefs.sidebarNavOrder.includes(t)) return;
  if (!mainNavItemByPath(t) && !isSidebarPinToken(t)) return;
  setConsolePrefs({ sidebarNavOrder: [...consolePrefs.sidebarNavOrder, t] });
}

export function isNavTokenInSidebar(token: string): boolean {
  return consolePrefs.sidebarNavOrder.includes((token || "").trim());
}

/** 从侧栏移除一项（至少保留一项） */
export function removeNavTokenFromSidebar(token: string): void {
  const t = (token || "").trim();
  if (!t || consolePrefs.sidebarNavOrder.length <= 1) return;
  setConsolePrefs({
    sidebarNavOrder: consolePrefs.sidebarNavOrder.filter((x) => x !== t),
  });
}

/** 与相邻项交换顺序（用于设置页或触摸环境） */
export function moveNavTokenInOrder(token: string, delta: -1 | 1): void {
  const t = (token || "").trim();
  const order = [...consolePrefs.sidebarNavOrder];
  const i = order.indexOf(t);
  if (i < 0) return;
  const j = i + delta;
  if (j < 0 || j >= order.length) return;
  const a = order[i]!;
  order[i] = order[j]!;
  order[j] = a;
  setConsolePrefs({ sidebarNavOrder: order });
}
