/** 解析自动更新 pending_notice（兼容旧单条与 items 列表）。 */
export function pendingAutoUpdateItems(
  notice: { items?: unknown; tag?: unknown; kind?: unknown } | null | undefined,
): Array<{ kind?: string; tag?: string }> {
  if (!notice || typeof notice !== "object") return [];
  const rawItems = notice.items;
  if (Array.isArray(rawItems)) {
    return rawItems.filter((x): x is { kind?: string; tag?: string } => !!x && typeof x === "object");
  }
  if (notice.tag || notice.kind) {
    return [{ kind: String(notice.kind || "webui"), tag: String(notice.tag || "") }];
  }
  return [];
}

export function pendingAutoUpdateLabel(
  notice: { items?: unknown; tag?: unknown; kind?: unknown } | null | undefined,
): string | null {
  const items = pendingAutoUpdateItems(notice);
  if (!items.length) return null;
  if (items.length === 1) {
    const tag = String(items[0]?.tag || "").trim();
    const kind = String(items[0]?.kind || "").trim();
    if (kind === "plugins") return tag ? `已自动更新 ${tag}` : "已自动更新插件";
    if (kind === "bot") return tag ? `已自动更新 Bot ${tag}` : "已自动更新 Bot";
    return tag ? `已自动更新到 ${tag}` : "已自动更新控制台";
  }
  return `已自动更新 ${items.length} 项`;
}
