const STORAGE_PREFIX = "pallas:logs:last-event-id:";

export function logsStreamResumeKey(scope: string, source: string): string {
  return `${scope}:${source || "all"}`;
}

export function loadLogsLastEventId(scope: string, source: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${logsStreamResumeKey(scope, source)}`);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function persistLogsLastEventId(scope: string, source: string, id: number): void {
  if (typeof sessionStorage === "undefined" || !(id > 0)) return;
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${logsStreamResumeKey(scope, source)}`,
      String(Math.floor(id)),
    );
  } catch {
    /* quota / private mode */
  }
}
