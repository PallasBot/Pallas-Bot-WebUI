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
