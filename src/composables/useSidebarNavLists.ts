import { computed } from "vue";
import { MAIN_NAV_ITEMS, mainNavItemByPath, type MainNavItem } from "@/config/mainNav";
import {
  parseSidebarPinToken,
  SIDEBAR_PIN_DEFINITIONS,
  sidebarPinToken,
  type SidebarPinDefinition,
} from "@/config/sidebarPins";
import { consolePrefs } from "@/utils/consolePrefs";
import { effectiveSidebarSection } from "@/utils/sidebarSectionLabels";

export type SidebarNavRow =
  | { kind: "main"; token: string; item: MainNavItem }
  | { kind: "pin"; token: string; pin: SidebarPinDefinition };

export type SidebarNavRowView = SidebarNavRow & { section: string; showSection: boolean };

export type SidebarPoolRow =
  | { kind: "main"; token: string; item: MainNavItem; section: string; showSection: boolean }
  | { kind: "pin"; token: string; pin: SidebarPinDefinition; section: string; showSection: boolean };

export function useSidebarNavLists() {
  const sidebarNavRows = computed((): SidebarNavRowView[] => {
    const raw: SidebarNavRow[] = [];
    for (const token of consolePrefs.sidebarNavOrder) {
      const pin = parseSidebarPinToken(token);
      if (pin) {
        raw.push({ kind: "pin", token, pin });
        continue;
      }
      const item = mainNavItemByPath(token);
      if (item) raw.push({ kind: "main", token, item });
    }
    let prevSection: string | null = null;
    return raw.map((r) => {
      const fallback = r.kind === "main" ? r.item.section : r.pin.section;
      const section = effectiveSidebarSection(r.token, fallback);
      const showSection = section !== prevSection;
      prevSection = section;
      return { ...r, section, showSection };
    });
  });

  const sidebarPoolRows = computed((): SidebarPoolRow[] => {
    const order = new Set(consolePrefs.sidebarNavOrder);
    const tmp: SidebarPoolRow[] = [];
    for (const item of MAIN_NAV_ITEMS) {
      if (!order.has(item.to)) {
        const section = effectiveSidebarSection(item.to, item.section);
        tmp.push({ kind: "main", token: item.to, item, section, showSection: false });
      }
    }
    for (const pin of SIDEBAR_PIN_DEFINITIONS) {
      const tok = sidebarPinToken(pin.id);
      if (!order.has(tok)) {
        const section = effectiveSidebarSection(tok, pin.section);
        tmp.push({ kind: "pin", token: tok, pin, section, showSection: false });
      }
    }
    let prev: string | null = null;
    for (const r of tmp) {
      const show = r.section !== prev;
      prev = r.section;
      r.showSection = show;
    }
    return tmp;
  });

  return { sidebarNavRows, sidebarPoolRows };
}
