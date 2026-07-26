import type { ConsoleDailyStatRow as DailyStatRow } from "@/api/pallasTypes";

export const HOME_SELECTED_ACCOUNT_KEY = "pallas_home_selected_account_v1";

export function readSavedHomeAccount(): number | null {
  try {
    const v = localStorage.getItem(HOME_SELECTED_ACCOUNT_KEY);
    if (v == null || v === "") return null;
    const n = parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  } catch {
    return null;
  }
}

export function writeSavedHomeAccount(acc: number | null) {
  try {
    if (acc == null) localStorage.removeItem(HOME_SELECTED_ACCOUNT_KEY);
    else localStorage.setItem(HOME_SELECTED_ACCOUNT_KEY, String(Math.floor(acc)));
  } catch {
    /* ignore */
  }
}

/** 解析 `?self_id=` / 账号字符串；无效则 null。 */
export function parseBotAccountId(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map((x) => Number(x));
  if (!y || !m) {
    const t = todayIso();
    return { start: t, end: t };
  }
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const endD = new Date(`${end}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime())) return out;
  while (cur <= endD) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function fillDailyRows(
  rows: DailyStatRow[],
  start: string,
  end: string,
  selfId: string,
): DailyStatRow[] {
  const map = new Map(rows.map((r) => [r.date, r]));
  return daysInRange(start, end).map((date) => {
    const row = map.get(date);
    if (row) return row;
    return {
      date,
      self_id: selfId,
      received: 0,
      sent: 0,
      matcher_runs: 0,
      api_calls: 0,
      active_groups: 0,
    };
  });
}
