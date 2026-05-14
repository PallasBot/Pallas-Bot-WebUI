import { consolePrefs } from "@/utils/consolePrefs";

/** 侧栏分组标题：有自定义则用自定义，否则用内置 section */
export function effectiveSidebarSection(token: string, fallback: string): string {
  const raw = consolePrefs.sidebarNavSectionByToken[token];
  if (typeof raw !== "string") return fallback;
  const t = raw.trim();
  return t || fallback;
}
