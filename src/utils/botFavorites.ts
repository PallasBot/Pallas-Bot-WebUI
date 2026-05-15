import { shallowRef } from "vue";

const STORAGE_KEY = "pallas_fav_bot_accounts_v1";

function readSet(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return new Set();
    const s = new Set<number>();
    for (const x of data) {
      const n = typeof x === "number" ? x : parseInt(String(x), 10);
      if (Number.isFinite(n) && n > 0) s.add(Math.floor(n));
    }
    return s;
  } catch {
    return new Set();
  }
}

function writeSet(s: Set<number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s].sort((a, b) => a - b)));
  } catch {
    /* ignore */
  }
}

/** 供排序等 computed 依赖，变更收藏时会替换引用 */
export const botFavoriteAccounts = shallowRef<ReadonlySet<number>>(readSet());

export function isFavoriteBot(account: number): boolean {
  return botFavoriteAccounts.value.has(account);
}

export function toggleFavoriteBot(account: number): void {
  const s = new Set(botFavoriteAccounts.value);
  if (s.has(account)) s.delete(account);
  else s.add(account);
  botFavoriteAccounts.value = s;
  writeSet(s);
}

/** 其它标签页 / 窗口写入同一 localStorage 键时同步（同 origin） */
function syncFavoritesFromStorage(ev: StorageEvent) {
  if (ev.key !== STORAGE_KEY) return;
  botFavoriteAccounts.value = readSet();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", syncFavoritesFromStorage);
}
