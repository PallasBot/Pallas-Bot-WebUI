import { ref } from "vue";

export const APP_DOC_TITLE = "Pallas-Bot 控制台";

/** 路由 `meta.title` 之后的可选片段（例如协议管理页内分节） */
export const documentTitleExtra = ref("");

export function buildDocumentTitle(routeTitle: unknown, extra: string): string {
  const base = typeof routeTitle === "string" ? routeTitle.trim() : "";
  const tail = extra.trim();
  return [APP_DOC_TITLE, base, tail].filter(Boolean).join(" · ");
}
