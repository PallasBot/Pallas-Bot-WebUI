/** 插件商店侧栏提醒：上新与可更新均在进入商店后视为已阅。 */

export const PLUGIN_STORE_SEEN_IDS_KEY = "pallas.react.plugin-store.seen-ids";
export const PLUGIN_STORE_SEEN_UPDATE_IDS_KEY = "pallas.react.plugin-store.seen-update-ids";
export const PLUGIN_STORE_SEEN_EVENT = "pallas-plugin-store-seen";

export type PluginStoreNoticeCounts = {
  newCount: number;
  updateCount: number;
};

export function normalizePluginStoreIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].map((x) => String(x || "").trim()).filter(Boolean))].sort();
}

export function readSeenPluginStoreIds(): Set<string> | null {
  try {
    const raw = localStorage.getItem(PLUGIN_STORE_SEEN_IDS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = normalizePluginStoreIds(parsed.map((x) => String(x ?? "")));
    // 空数组是历史误写入（目录未就绪时建基线）——当作无基线，避免整店标成上新
    if (!ids.length) return null;
    return new Set(ids);
  } catch {
    // 无 localStorage / 解析失败：视为尚未建立基线，避免把整店标成上新
    return null;
  }
}

export function writeSeenPluginStoreIds(ids: Iterable<string>): void {
  const list = normalizePluginStoreIds(ids);
  try {
    localStorage.setItem(PLUGIN_STORE_SEEN_IDS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function readSeenPluginStoreUpdateIds(): Set<string> | null {
  try {
    const raw = localStorage.getItem(PLUGIN_STORE_SEEN_UPDATE_IDS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return new Set(normalizePluginStoreIds(parsed.map((x) => String(x ?? ""))));
  } catch {
    return null;
  }
}

function writeSeenPluginStoreUpdateIds(ids: Iterable<string>): void {
  try {
    localStorage.setItem(PLUGIN_STORE_SEEN_UPDATE_IDS_KEY, JSON.stringify(normalizePluginStoreIds(ids)));
  } catch {
    /* ignore quota */
  }
}

/** 首次无基线时写入当前全部 ID，避免首次打开把整店标成「上新」。 */
export function ensurePluginStoreSeenBaseline(allIds: string[]): Set<string> {
  const existing = readSeenPluginStoreIds();
  if (existing != null) return existing;
  const normalized = normalizePluginStoreIds(allIds);
  // 目录尚未就绪时不要落盘空基线，否则随后整表会被当成「上新」
  if (!normalized.length) return new Set();
  writeSeenPluginStoreIds(normalized);
  return new Set(normalized);
}

/** 相对本机已见表尚未见过的 ID（无基线时返回空，避免首次进店整表标新）。 */
export function listUnseenPluginStoreIds(allIds: string[]): string[] {
  const seen = readSeenPluginStoreIds();
  if (seen == null) return [];
  const out: string[] = [];
  for (const id of allIds) {
    const key = String(id || "").trim();
    if (key && !seen.has(key)) out.push(key);
  }
  return out;
}

/** 打开商店页：把当前条目及可更新条目记为已见，清除侧栏绿点。 */
export function markPluginStoreIdsSeen(allIds: string[], updateIds: string[] = []): void {
  const prev = readSeenPluginStoreIds() ?? new Set<string>();
  for (const id of allIds) {
    const key = String(id || "").trim();
    if (key) prev.add(key);
  }
  writeSeenPluginStoreIds(prev);
  writeSeenPluginStoreUpdateIds(updateIds);
  try {
    window.dispatchEvent(new Event(PLUGIN_STORE_SEEN_EVENT));
  } catch {
    /* ignore */
  }
}

export function countNewPluginStoreIds(allIds: string[], seen: Set<string>): number {
  let n = 0;
  for (const id of allIds) {
    const key = String(id || "").trim();
    if (key && !seen.has(key)) n += 1;
  }
  return n;
}

export function pluginStoreNoticeLabel(counts: PluginStoreNoticeCounts): string | null {
  const parts: string[] = [];
  if (counts.updateCount > 0) parts.push(`${counts.updateCount} 个可更新`);
  if (counts.newCount > 0) parts.push(`${counts.newCount} 个上新`);
  if (!parts.length) return null;
  return `有 ${parts.join(" · ")}`;
}

export function summarizePluginStoreNotice(input: {
  catalogIds: string[];
  updateIds: string[];
}): PluginStoreNoticeCounts & { label: string | null } {
  const seen = ensurePluginStoreSeenBaseline(input.catalogIds);
  const newCount = countNewPluginStoreIds(input.catalogIds, seen);
  const seenUpdates = readSeenPluginStoreUpdateIds();
  const updateCount = input.updateIds.filter((id) => !seenUpdates?.has(String(id || "").trim())).length;
  const counts = { newCount, updateCount };
  return { ...counts, label: pluginStoreNoticeLabel(counts) };
}
