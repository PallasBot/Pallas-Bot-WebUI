export const BOT_FAVORITES_STORAGE_KEY = "pallas_fav_bot_accounts_v1";

export type BotFavoritesRemoteState = {
  initialized: boolean;
  accounts: number[];
};

type BotFavoritesStoreDependencies = {
  fetchRemote: () => Promise<BotFavoritesRemoteState>;
  putRemote: (accounts: number[]) => Promise<BotFavoritesRemoteState>;
  onError?: (error: unknown) => void;
};

type Listener = () => void;

export function normalizeBotFavoriteAccounts(accounts: readonly unknown[]): number[] {
  const normalized = new Set<number>();
  for (const raw of accounts) {
    if (typeof raw === "boolean") continue;
    const account = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(account) && account > 0) normalized.add(Math.floor(account));
  }
  return [...normalized].sort((a, b) => a - b);
}

function readLocalAccounts(): number[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOT_FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? normalizeBotFavoriteAccounts(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: readonly number[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(BOT_FAVORITES_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // 浏览器禁用存储时仍可使用当前会话内的服务端状态。
  }
}

export function createBotFavoritesStore(deps: BotFavoritesStoreDependencies) {
  let snapshot: ReadonlySet<number> = new Set(readLocalAccounts());
  let initializePromise: Promise<void> | null = null;
  let initialized = false;
  let revision = 0;
  let writeQueue: Promise<void> = Promise.resolve();
  const listeners = new Set<Listener>();

  function emit(): void {
    for (const listener of listeners) listener();
  }

  function replace(accounts: readonly unknown[]): void {
    const normalized = normalizeBotFavoriteAccounts(accounts);
    snapshot = new Set(normalized);
    writeLocalAccounts(normalized);
    emit();
  }

  async function loadRemote(allowMigration: boolean): Promise<void> {
    const remote = await deps.fetchRemote();
    if (remote.initialized) {
      replace(remote.accounts);
      initialized = true;
      return;
    }
    if (allowMigration) {
      const migrated = await deps.putRemote([...snapshot]);
      replace(migrated.accounts);
      initialized = true;
    }
  }

  async function initialize(): Promise<void> {
    if (initialized) return;
    if (!initializePromise) {
      initializePromise = loadRemote(true)
        .catch(() => {
          // 读取失败时保留本地缓存，不阻断页面使用。
        })
        .finally(() => {
          initializePromise = null;
        });
    }
    await initializePromise;
  }

  async function refresh(): Promise<void> {
    try {
      await loadRemote(!initialized);
    } catch {
      // 刷新失败时保留最后一次成功状态。
    }
  }

  function toggle(account: number): Promise<void> {
    const normalized = normalizeBotFavoriteAccounts([account]);
    if (!normalized.length) return Promise.resolve();
    const target = normalized[0];
    const previous = snapshot;
    const next = new Set(snapshot);
    if (next.has(target)) next.delete(target);
    else next.add(target);
    const desired = normalizeBotFavoriteAccounts([...next]);
    const operationRevision = ++revision;
    replace(desired);

    const operation = writeQueue.then(async () => {
      try {
        const saved = await deps.putRemote(desired);
        initialized = true;
        if (operationRevision === revision) replace(saved.accounts);
      } catch (error) {
        if (operationRevision === revision) replace([...previous]);
        deps.onError?.(error);
      }
    });
    writeQueue = operation.catch(() => undefined);
    return operation;
  }

  function syncFromLocal(): void {
    replace(readLocalAccounts());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize,
    refresh,
    toggle,
    syncFromLocal,
  };
}

export type BotFavoritesStore = ReturnType<typeof createBotFavoritesStore>;
