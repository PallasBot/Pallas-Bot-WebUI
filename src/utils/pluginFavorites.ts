import { shallowRef } from "vue";

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

export const pluginFavoriteNames = shallowRef<ReadonlySet<string>>(readSet());

export function toggleFavoritePlugin(name: string): void {
  const t = (name || "").trim();
  if (!t) return;
  const s = new Set(pluginFavoriteNames.value);
  if (s.has(t)) s.delete(t);
  else s.add(t);
  pluginFavoriteNames.value = s;
  writeSet(s);
}

function syncFavoritesFromStorage(ev: StorageEvent) {
  if (ev.key !== STORAGE_KEY) return;
  pluginFavoriteNames.value = readSet();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", syncFavoritesFromStorage);
}
