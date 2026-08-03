export const NAVIGATION_NOTICE_SEEN_KEY = "pallas.navigation-notice.revisions";
export const NAVIGATION_NOTICE_SEEN_EVENT = "pallas-navigation-notice-seen";

type SeenRevisions = Record<string, number>;

function readSeenRevisions(): SeenRevisions {
  try {
    const raw = localStorage.getItem(NAVIGATION_NOTICE_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: SeenRevisions = {};
    for (const [path, revision] of Object.entries(parsed)) {
      const value = Number(revision);
      if (path && Number.isInteger(value) && value > 0) out[path] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function readNavigationNoticeRevision(path: string): number {
  return readSeenRevisions()[path] || 0;
}

export function isNavigationNoticeUnseen(path: string, revision: number): boolean {
  return Number.isInteger(revision) && revision > readNavigationNoticeRevision(path);
}

export function markNavigationNoticeSeen(path: string, revision: number): void {
  if (!path || !Number.isInteger(revision) || revision < 1) return;
  const seen = readSeenRevisions();
  if ((seen[path] || 0) >= revision) return;
  seen[path] = revision;
  try {
    localStorage.setItem(NAVIGATION_NOTICE_SEEN_KEY, JSON.stringify(seen));
    window.dispatchEvent(new Event(NAVIGATION_NOTICE_SEEN_EVENT));
  } catch {
    /* ignore unavailable storage */
  }
}
