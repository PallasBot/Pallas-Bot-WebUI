import { computed } from "vue";
import { MAIN_NAV_ITEMS, mainNavItemByPath, type MainNavItem } from "@/config/mainNav";
import { sidebarGroupForPath } from "@/config/sidebarGroups";
import type { ConsoleNavIconId } from "@/config/consoleNavIcons";
import {
  parseSidebarPinToken,
  SIDEBAR_PIN_DEFINITIONS,
  sidebarPinToken,
  type SidebarPinDefinition,
} from "@/config/sidebarPins";
import { aiSidebarPathAllowed, useAiNavGate } from "@/composables/useAiNavGate";
import { consolePrefs } from "@/utils/consolePrefs";
import { effectiveSidebarSection } from "@/utils/sidebarSectionLabels";

export type SidebarNavRow =
  | { kind: "main"; token: string; item: MainNavItem }
  | { kind: "pin"; token: string; pin: SidebarPinDefinition };

export type SidebarNavRowView = SidebarNavRow & { section: string; showSection: boolean };

export type SidebarPoolRow =
  | { kind: "main"; token: string; item: MainNavItem; section: string; showSection: boolean }
  | { kind: "pin"; token: string; pin: SidebarPinDefinition; section: string; showSection: boolean };

export type SidebarNavMainRowView = SidebarNavRowView & { kind: "main" };

export type SidebarNavEntry =
  | { kind: "single"; row: SidebarNavRowView }
  | {
      kind: "group";
      groupId: string;
      label: string;
      icon: ConsoleNavIconId;
      children: SidebarNavMainRowView[];
    };

function buildSidebarNavEntries(rows: SidebarNavRowView[]): SidebarNavEntry[] {
  const emitted = new Set<string>();
  const entries: SidebarNavEntry[] = [];
  for (const row of rows) {
    if (row.kind === "pin") {
      entries.push({ kind: "single", row });
      continue;
    }
    const group = sidebarGroupForPath(row.item.to);
    if (!group) {
      entries.push({ kind: "single", row });
      continue;
    }
    if (emitted.has(group.id)) continue;
    emitted.add(group.id);
    const children = rows.filter(
      (r): r is SidebarNavRowView & { kind: "main" } =>
        r.kind === "main" && group.paths.includes(r.item.to),
    );
    if (children.length <= 1) {
      entries.push({ kind: "single", row: children[0] ?? row });
      continue;
    }
    entries.push({
      kind: "group",
      groupId: group.id,
      label: group.label,
      icon: group.icon,
      children,
    });
  }
  return entries;
}

/** 收起侧栏时展平分组，保留各子项图标入口 */
export function flattenSidebarNavEntries(entries: SidebarNavEntry[]): SidebarNavEntry[] {
  const flat: SidebarNavEntry[] = [];
  for (const entry of entries) {
    if (entry.kind === "group") {
      for (const child of entry.children) flat.push({ kind: "single", row: child });
    } else {
      flat.push(entry);
    }
  }
  return flat;
}

export function useSidebarNavLists() {
  const { essentialsOnly } = useAiNavGate();

  const sidebarNavRows = computed((): SidebarNavRowView[] => {
    const raw: SidebarNavRow[] = [];
    for (const token of consolePrefs.sidebarNavOrder) {
      const pin = parseSidebarPinToken(token);
      if (pin) {
        raw.push({ kind: "pin", token, pin });
        continue;
      }
      const item = mainNavItemByPath(token);
      if (item) {
        if (item.to.startsWith("/ai/") && !aiSidebarPathAllowed(item.to, essentialsOnly.value)) {
          continue;
        }
        raw.push({ kind: "main", token, item });
      }
    }
    return raw.map((r) => {
      const fallback = r.kind === "main" ? r.item.section : r.pin.section;
      const section = effectiveSidebarSection(r.token, fallback);
      return { ...r, section, showSection: false };
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

  const sidebarNavEntries = computed(() => buildSidebarNavEntries(sidebarNavRows.value));

  const sidebarNavEntriesDisplay = computed(() =>
    consolePrefs.sidebarCollapsed
      ? flattenSidebarNavEntries(sidebarNavEntries.value)
      : sidebarNavEntries.value,
  );

  return { sidebarNavRows, sidebarNavEntries, sidebarNavEntriesDisplay, sidebarPoolRows };
}
