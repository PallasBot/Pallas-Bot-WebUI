import { useCallback, useState } from "react";

const STORAGE_KEY = "pallas_console_prefs_v1";

type StoredPrefs = {
  tablePageSize?: number;
  /** Bot git 更新面板历史列表默认条数（5–50，默认 10） */
  botGitHistoryLimit?: number;
  friendsPageFriendsListOpen?: boolean;
  friendsPageGroupsListOpen?: boolean;
  databasePageGroupConfigsOpen?: boolean;
  databasePageUserConfigsOpen?: boolean;
};

function loadStored(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredPrefs;
  } catch {
    return {};
  }
}

function persistPatch(patch: StoredPrefs) {
  const next = { ...loadStored(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function useConsolePrefs() {
  const [stored, setStored] = useState<StoredPrefs>(loadStored);

  const patch = useCallback((next: StoredPrefs) => {
    persistPatch(next);
    setStored((prev) => ({ ...prev, ...next }));
  }, []);

  const tablePageSize = Math.min(80, Math.max(4, stored.tablePageSize ?? 12));
  const setTablePageSize = useCallback(
    (v: number) => {
      const n = Math.min(80, Math.max(4, Math.floor(v) || 12));
      patch({ tablePageSize: n });
    },
    [patch],
  );

  const setDatabasePageGroupConfigsOpen = useCallback(
    (open: boolean) => patch({ databasePageGroupConfigsOpen: open }),
    [patch],
  );
  const setDatabasePageUserConfigsOpen = useCallback(
    (open: boolean) => patch({ databasePageUserConfigsOpen: open }),
    [patch],
  );
  const setFriendsPageFriendsListOpen = useCallback(
    (open: boolean) => patch({ friendsPageFriendsListOpen: open }),
    [patch],
  );
  const setFriendsPageGroupsListOpen = useCallback(
    (open: boolean) => patch({ friendsPageGroupsListOpen: open }),
    [patch],
  );

  const botGitHistoryLimit = Math.min(50, Math.max(5, stored.botGitHistoryLimit ?? 10));
  const setBotGitHistoryLimit = useCallback(
    (v: number) => {
      const n = Math.min(50, Math.max(5, Math.floor(v) || 10));
      patch({ botGitHistoryLimit: n });
    },
    [patch],
  );

  return {
    tablePageSize,
    setTablePageSize,
    botGitHistoryLimit,
    setBotGitHistoryLimit,
    friendsPageFriendsListOpen: stored.friendsPageFriendsListOpen ?? true,
    friendsPageGroupsListOpen: stored.friendsPageGroupsListOpen ?? true,
    databasePageGroupConfigsOpen: stored.databasePageGroupConfigsOpen ?? true,
    databasePageUserConfigsOpen: stored.databasePageUserConfigsOpen ?? true,
    setDatabasePageGroupConfigsOpen,
    setDatabasePageUserConfigsOpen,
    setFriendsPageFriendsListOpen,
    setFriendsPageGroupsListOpen,
  };
}
