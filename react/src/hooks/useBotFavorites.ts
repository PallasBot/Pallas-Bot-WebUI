import { useCallback, useEffect, useState } from "react";

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

export function useBotFavorites() {
  const [favorites, setFavorites] = useState<ReadonlySet<number>>(() => readSet());

  useEffect(() => {
    function sync(ev: StorageEvent) {
      if (ev.key !== STORAGE_KEY) return;
      setFavorites(readSet());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggleFavorite = useCallback((account: number) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      writeSet(next);
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
