import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOT_FAVORITES_STORAGE_KEY,
  createBotFavoritesStore,
  normalizeBotFavoriteAccounts,
  type BotFavoritesRemoteState,
} from "@/hooks/botFavoritesStore";

function installMemoryStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  } satisfies Storage;
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
}

function remote(initialized: boolean, accounts: number[]): BotFavoritesRemoteState {
  return { initialized, accounts };
}

describe("bot favorites store", () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it("normalizes positive account ids", () => {
    expect(normalizeBotFavoriteAccounts([2927116873, "10001", 2927116873, 0, -1, true])).toEqual([
      10001,
      2927116873,
    ]);
  });

  it("uses initialized server favorites instead of local cache", async () => {
    localStorage.setItem(BOT_FAVORITES_STORAGE_KEY, JSON.stringify([10001]));
    const putRemote = vi.fn();
    const store = createBotFavoritesStore({
      fetchRemote: vi.fn().mockResolvedValue(remote(true, [2927116873])),
      putRemote,
    });

    await store.initialize();

    expect([...store.getSnapshot()]).toEqual([2927116873]);
    expect(localStorage.getItem(BOT_FAVORITES_STORAGE_KEY)).toBe("[2927116873]");
    expect(putRemote).not.toHaveBeenCalled();
  });

  it("migrates legacy local favorites when server is uninitialized", async () => {
    localStorage.setItem(BOT_FAVORITES_STORAGE_KEY, JSON.stringify([2927116873, 10001]));
    const putRemote = vi.fn().mockResolvedValue(remote(true, [10001, 2927116873]));
    const store = createBotFavoritesStore({
      fetchRemote: vi.fn().mockResolvedValue(remote(false, [])),
      putRemote,
    });

    await store.initialize();

    expect(putRemote).toHaveBeenCalledWith([10001, 2927116873]);
    expect([...store.getSnapshot()]).toEqual([10001, 2927116873]);
  });

  it("initializes an empty server so old browsers cannot restore cleared favorites", async () => {
    const putRemote = vi.fn().mockResolvedValue(remote(true, []));
    const store = createBotFavoritesStore({
      fetchRemote: vi.fn().mockResolvedValue(remote(false, [])),
      putRemote,
    });

    await store.initialize();

    expect(putRemote).toHaveBeenCalledWith([]);
    expect([...store.getSnapshot()]).toEqual([]);
  });

  it("rolls back an optimistic toggle when the server write fails", async () => {
    const onError = vi.fn();
    const store = createBotFavoritesStore({
      fetchRemote: vi.fn().mockResolvedValue(remote(true, [10001])),
      putRemote: vi.fn().mockRejectedValue(new Error("network down")),
      onError,
    });
    await store.initialize();

    await store.toggle(2927116873);

    expect([...store.getSnapshot()]).toEqual([10001]);
    expect(localStorage.getItem(BOT_FAVORITES_STORAGE_KEY)).toBe("[10001]");
    expect(onError).toHaveBeenCalledOnce();
  });
});
