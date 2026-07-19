const STORAGE_KEY = "pallas_home_action_dismissals_v1";

export function loadHomeActionDismissals(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== "string" || typeof value !== "string") continue;
      const cleanKey = key.trim();
      const cleanValue = value.trim();
      if (cleanKey && cleanValue) out[cleanKey] = cleanValue;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveHomeActionDismissal(key: string, token: string): void {
  const cleanKey = key.trim();
  const cleanToken = token.trim();
  if (!cleanKey || !cleanToken) return;
  const next = { ...loadHomeActionDismissals(), [cleanKey]: cleanToken };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function isHomeActionDismissed(
  dismissals: Record<string, string>,
  key: string,
  token: string | null | undefined,
): boolean {
  const cleanToken = (token || "").trim();
  if (!cleanToken) return false;
  return dismissals[key] === cleanToken;
}
