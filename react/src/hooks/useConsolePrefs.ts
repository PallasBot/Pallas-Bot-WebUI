import { useCallback, useState } from "react";

const STORAGE_KEY = "pallas_console_prefs_v1";

export type DataViewMode = "table" | "cards";

type StoredPrefs = {
  tablePageSize?: number;
  friendsPageFriendsListOpen?: boolean;
  friendsPageGroupsListOpen?: boolean;
  databasePageGroupConfigsOpen?: boolean;
  databasePageUserConfigsOpen?: boolean;
  instancesBotView?: DataViewMode;
  protocolAccountsView?: DataViewMode;
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

  return {
    tablePageSize,
    setTablePageSize,
    friendsPageFriendsListOpen: stored.friendsPageFriendsListOpen ?? true,
    friendsPageGroupsListOpen: stored.friendsPageGroupsListOpen ?? true,
    databasePageGroupConfigsOpen: stored.databasePageGroupConfigsOpen ?? true,
    databasePageUserConfigsOpen: stored.databasePageUserConfigsOpen ?? true,
    setDatabasePageGroupConfigsOpen: (open: boolean) => patch({ databasePageGroupConfigsOpen: open }),
    setDatabasePageUserConfigsOpen: (open: boolean) => patch({ databasePageUserConfigsOpen: open }),
    instancesBotView: stored.instancesBotView === "table" ? "table" : "cards",
    protocolAccountsView: stored.protocolAccountsView === "table" ? "table" : "cards",
    setFriendsPageFriendsListOpen: (open: boolean) => patch({ friendsPageFriendsListOpen: open }),
    setFriendsPageGroupsListOpen: (open: boolean) => patch({ friendsPageGroupsListOpen: open }),
    setInstancesBotView: (mode: DataViewMode) => patch({ instancesBotView: mode }),
    setProtocolAccountsView: (mode: DataViewMode) => patch({ protocolAccountsView: mode }),
  };
}
