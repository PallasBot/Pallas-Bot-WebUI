import { useCallback, useEffect, useSyncExternalStore } from "react";
import { fetchBotFavorites, putBotFavorites } from "@/api/consoleApi";
import { pushConsoleToast } from "@/utils/consoleToast";
import { BOT_FAVORITES_STORAGE_KEY, createBotFavoritesStore } from "./botFavoritesStore";

const store = createBotFavoritesStore({
  fetchRemote: fetchBotFavorites,
  putRemote: putBotFavorites,
  onError: () => pushConsoleToast("收藏保存失败，已恢复原状态", "err"),
});

let browserSyncConsumers = 0;
let stopBrowserSync: (() => void) | null = null;

function connectBrowserSync(): () => void {
  browserSyncConsumers += 1;
  if (!stopBrowserSync) {
    function sync(ev: StorageEvent) {
      if (ev.key === BOT_FAVORITES_STORAGE_KEY) store.syncFromLocal();
    }
    function refresh() {
      void store.refresh();
    }
    window.addEventListener("storage", sync);
    window.addEventListener("focus", refresh);
    stopBrowserSync = () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", refresh);
    };
  }
  return () => {
    browserSyncConsumers -= 1;
    if (browserSyncConsumers === 0) {
      stopBrowserSync?.();
      stopBrowserSync = null;
    }
  };
}

export function useBotFavorites() {
  const favorites = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  useEffect(() => {
    void store.initialize();
    return connectBrowserSync();
  }, []);

  const toggleFavorite = useCallback((account: number) => {
    void store.toggle(account);
  }, []);

  return { favorites, toggleFavorite };
}
