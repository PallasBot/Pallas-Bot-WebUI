import { describe, expect, it, beforeEach } from "vitest";
import { loadLogsEnabledLevels, persistLogsEnabledLevels } from "@/utils/logDisplay";

function installMemoryStorage() {
  const store = new Map<string, string>();
  const api = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: api, configurable: true });
}

describe("loadLogsEnabledLevels", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
  });

  it("defaults to info+ (no debug) when unset", () => {
    const levels = loadLogsEnabledLevels();
    expect(levels.has("debug")).toBe(false);
    expect(levels.has("info")).toBe(true);
    expect(levels.has("error")).toBe(true);
  });

  it("persists and reloads selection", () => {
    persistLogsEnabledLevels(new Set(["warn", "error"]));
    const levels = loadLogsEnabledLevels();
    expect([...levels].sort()).toEqual(["error", "warn"]);
  });
});
