import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const network = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("./consoleOpenapiClient", () => ({
  consoleOpenapiDelete: vi.fn(),
  consoleOpenapiGet: network.get,
  consoleOpenapiPatch: vi.fn(),
  consoleOpenapiPost: vi.fn(),
  consoleOpenapiPut: vi.fn(),
}));

vi.mock("./http", () => ({
  DB_BACKUP_TIMEOUT_MS: 10,
  DB_HEAVY_READ_TIMEOUT_MS: 20,
  http: { delete: vi.fn(), get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function loadApi() {
  vi.resetModules();
  return import("./consoleApi");
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logs cache", () => {
  it("absorbs a failed background stale refresh and allows a later retry", async () => {
    const api = await loadApi();
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const failure = deferred<unknown>();
    network.get.mockResolvedValueOnce({ entries: [{ message: "cached" }] });
    network.get.mockReturnValueOnce(failure.promise);
    network.get.mockResolvedValueOnce({ entries: [{ message: "fresh" }] });

    await expect(api.fetchLogs(20, "all", "hub")).resolves.toEqual({ entries: [{ message: "cached" }] });
    now += 1_000;
    await expect(api.fetchLogs(20, "all", "hub")).resolves.toEqual({ entries: [{ message: "cached" }] });
    failure.reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(api.fetchLogs(20, "all", "hub")).resolves.toEqual({ entries: [{ message: "cached" }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    now += 500;
    await expect(api.fetchLogs(20, "all", "hub")).resolves.toEqual({ entries: [{ message: "fresh" }] });
  });

  it("does not let a request started before invalidation repopulate or remove a newer request", async () => {
    const api = await loadApi();
    const old = deferred<unknown>();
    const current = deferred<unknown>();
    network.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);

    const oldRead = api.fetchLogs(20, "all", "hub", { bypassCache: true });
    api.invalidateLogsCache();
    const currentRead = api.fetchLogs(20, "all", "hub", { bypassCache: true });
    old.resolve({ entries: [{ message: "old" }] });
    await oldRead;
    const joinedCurrentRead = api.fetchLogs(20, "all", "hub", { bypassCache: true });
    expect(network.get).toHaveBeenCalledTimes(2);

    current.resolve({ entries: [{ message: "current" }] });
    await expect(Promise.all([currentRead, joinedCurrentRead])).resolves.toEqual([
      { entries: [{ message: "current" }] },
      { entries: [{ message: "current" }] },
    ]);
  });
});
