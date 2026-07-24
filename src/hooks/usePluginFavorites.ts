import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pallas_fav_plugin_names_v1";

function readSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return new Set();
    const s = new Set<string>();
    for (const x of data) {
      const t = String(x ?? "").trim();
      if (t) s.add(t);
    }
    return s;
  } catch {
    return new Set();
  }
}

function writeSet(s: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s].sort((a, b) => a.localeCompare(b))));
  } catch {
    /* ignore */
  }
}

export function usePluginFavorites() {
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => readSet());

  useEffect(() => {
    function sync(ev: StorageEvent) {
      if (ev.key !== STORAGE_KEY) return;
      setFavorites(readSet());
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggleFavorite = useCallback((name: string) => {
    const t = (name || "").trim();
    if (!t) return;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      writeSet(next);
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
