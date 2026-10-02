import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const network = vi.hoisted(() => ({
  openapiGet: vi.fn(),
  openapiPut: vi.fn(),
  httpGet: vi.fn(),
  httpPut: vi.fn(),
  handlers: new Map<string, Array<() => Promise<unknown>>>(),
}));

vi.mock("./consoleOpenapiClient", () => ({
  consoleOpenapiDelete: vi.fn(),
  consoleOpenapiGet: network.openapiGet,
  consoleOpenapiPatch: vi.fn(),
  consoleOpenapiPost: vi.fn(),
  consoleOpenapiPut: network.openapiPut,
}));

vi.mock("./http", () => ({
  DB_BACKUP_TIMEOUT_MS: 10,
  DB_HEAVY_READ_TIMEOUT_MS: 20,
  http: {
    delete: vi.fn(),
    get: network.httpGet,
    patch: vi.fn(),
    post: vi.fn(),
    put: network.httpPut,
  },
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

function plugin(name: string) {
  return { name, module: name, metadata: null };
}

function instances() {
  return { nonebot_bots: [], db_bot_configs: [], pallas_protocol: null };
}

function overview(plugins: ReturnType<typeof plugin>[] = [], bots: never[] = []) {
  return {
    health: null,
    system: null,
    bots,
    instances: instances(),
    plugins,
    message_stats: null,
    plugin_run_stats: null,
    community_stats: null,
  };
}

async function loadApis() {
  vi.resetModules();
  const [api, legacy] = await Promise.all([import("./consoleApi"), import("./console")]);
  return { api, legacy };
}

function queue(url: string, ...handlers: Array<() => Promise<unknown>>) {
  network.handlers.set(url, [...handlers]);
}

beforeEach(() => {
  vi.clearAllMocks();
  network.handlers.clear();
  network.openapiGet.mockImplementation((url: string) => {
    const handler = network.handlers.get(url)?.shift();
    if (!handler) throw new Error(`Unexpected GET ${url}`);
    return handler();
  });
  network.openapiPut.mockResolvedValue({ plugin: "demo", module: "demo", fields: [] });
  network.httpGet.mockRejectedValue(new Error("legacy HTTP path used"));
  network.httpPut.mockRejectedValue(new Error("legacy HTTP path used"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("plugin and instance catalog cache", () => {
  it("accepts nullable catalog metadata returned for non-uninstallable plugins", async () => {
    const { api } = await loadApis();
    const rows = [{
      ...plugin("pb_core"),
      metadata: {
        name: null,
        description: "",
        usage: "",
        extra: "future metadata shape",
        backend_extension: { revision: 2 },
      },
      uninstallable: false,
      uninstall_kind: null,
      uninstall_target: null,
    }];
    queue("/plugins", async () => rows);

    await expect(api.fetchPlugins()).resolves.toEqual(rows);
    expect(api.peekPluginsCache()).toEqual(rows);
  });

  it.each(["putPluginConfig", "putPluginConfigRaw"] as const)(
    "invalidates the shared plugin snapshot after a legacy %s write",
    async (method) => {
      const { api, legacy } = await loadApis();
      queue("/plugins", async () => [plugin("before")], async () => [plugin("after")]);
      await api.fetchPlugins();
      if (method === "putPluginConfig") await legacy.putPluginConfig("demo", { enabled: true });
      else await legacy.putPluginConfigRaw("demo", "enabled = true");

      await expect(api.fetchPlugins()).resolves.toEqual([plugin("after")]);
      expect(network.openapiGet).toHaveBeenCalledTimes(2);
    },
  );

  it("shares the same plugins implementation and snapshot through the legacy export", async () => {
    const { api, legacy } = await loadApis();
    const expected = [plugin("demo")];
    queue("/plugins", async () => expected);

    await expect(Promise.all([legacy.fetchPlugins(), api.fetchPlugins()])).resolves.toEqual([
      expected,
      expected,
    ]);

    expect(network.openapiGet).toHaveBeenCalledTimes(1);
    expect(network.httpGet).not.toHaveBeenCalled();
  });

  it("retries a failed stale-while-revalidate request while preserving explicit read errors", async () => {
    const { api } = await loadApis();
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const failedRequest = deferred<unknown>();
    const retryRequest = deferred<unknown>();
    const previous = [plugin("previous")];
    const current = [plugin("current")];
    queue("/plugins", async () => previous, () => failedRequest.promise, () => retryRequest.promise);

    await api.fetchPlugins();
    now += 45_001;
    await expect(api.fetchPlugins()).resolves.toEqual(previous);
    failedRequest.reject(new Error("offline"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await expect(api.fetchPlugins()).resolves.toEqual(previous);
    expect(network.openapiGet).toHaveBeenCalledTimes(3);
    retryRequest.resolve(current);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(api.peekPluginsCache()).toEqual(current);

    const readError = new Error("explicit read failed");
    queue("/plugins", () => Promise.reject(readError));
    await expect(api.fetchPlugins({ bypassCache: true })).rejects.toBe(readError);
  });

  it("preserves plugin config values, extension metadata, nullable flags, and rejects malformed payloads", async () => {
    const { api } = await loadApis();
    const config = {
      plugin: "demo",
      module: "demo",
      fields: [{
        name: "api_key",
        kind: "string",
        default: "fallback",
        current: "configured",
        secret: true,
        ui_group: null,
        ui_order: null,
        ui_hidden: null,
        ui_widget: null,
        provider_metadata: { source: "backend", revision: 3 },
      }],
      hot_reload: null,
      gateway_editor: null,
      supports_connectivity_check: null,
      llm_model_admin: null,
      dev_mode_hot_reload: null,
      future_metadata: { version: 2 },
    };
    queue("/plugins/demo/config", async () => config);

    await expect(api.fetchPluginConfig("demo")).resolves.toEqual(config);

    queue("/plugins/broken/config", async () => ({
      plugin: "broken",
      module: "broken",
      fields: [{ name: 42, kind: "string" }],
    }));
    await expect(api.fetchPluginConfig("broken")).rejects.toThrow("插件配置: 响应异常");

    queue("/plugins/demo/config/raw", async () => ({ toml: "token = 'kept'\n" }));
    await expect(api.fetchPluginConfigRaw("demo")).resolves.toBe("token = 'kept'\n");
    queue("/plugins/demo/config/raw", async () => ({ toml: null }));
    await expect(api.fetchPluginConfigRaw("demo")).rejects.toThrow("插件原始配置: 响应异常");
  });

  it("keeps a new plugins single-flight alive when an invalidated request settles", async () => {
    const { api } = await loadApis();
    const oldRequest = deferred<unknown>();
    const newRequest = deferred<unknown>();
    queue("/plugins", () => oldRequest.promise, () => newRequest.promise);

    const oldFetch = api.fetchPlugins();
    api.invalidatePluginsCache();
    const newFetch = api.fetchPlugins();
    oldRequest.resolve([plugin("old")]);
    await oldFetch;

    const joinedFetch = api.fetchPlugins();
    expect(network.openapiGet).toHaveBeenCalledTimes(2);
    newRequest.resolve([plugin("new")]);
    await expect(Promise.all([newFetch, joinedFetch])).resolves.toEqual([
      [plugin("new")],
      [plugin("new")],
    ]);
    expect(api.peekPluginsCache()).toEqual([plugin("new")]);
  });

  it("lets the latest forced plugins response own the snapshot", async () => {
    const { api } = await loadApis();
    const older = deferred<unknown>();
    const newer = deferred<unknown>();
    queue("/plugins", () => older.promise, () => newer.promise);

    const oldFetch = api.fetchPlugins({ bypassCache: true });
    const newFetch = api.fetchPlugins({ bypassCache: true });
    newer.resolve([plugin("new")]);
    await newFetch;
    older.resolve([plugin("old")]);
    await oldFetch;

    expect(api.peekPluginsCache()).toEqual([plugin("new")]);
  });

  it("lets the latest forced instances response own the snapshot", async () => {
    const { api } = await loadApis();
    const older = deferred<unknown>();
    const newer = deferred<unknown>();
    const newData = { ...instances(), bot_profiles: { "2": { nickname: "new" } } };
    queue("/instances", () => older.promise, () => newer.promise);

    const oldFetch = api.fetchInstances({ bypassCache: true });
    const newFetch = api.fetchInstances({ bypassCache: true });
    newer.resolve(newData);
    await newFetch;
    older.resolve(instances());
    await oldFetch;

    expect(api.peekInstancesCache()).toEqual(newData);
  });

  it("does not let an old home overview reseed catalogs after a plugin write", async () => {
    const { api } = await loadApis();
    const oldRequest = deferred<{ data: { ok: boolean; data: ReturnType<typeof overview> } }>();
    network.httpGet.mockImplementation((url: string) => {
      if (url === "/home/overview") return oldRequest.promise;
      throw new Error(`Unexpected HTTP GET ${url}`);
    });
    const oldFetch = api.fetchHomeOverview();
    await api.putPluginConfig("demo", { enabled: true });
    oldRequest.resolve({ data: { ok: true, data: overview([plugin("stale")]) } });
    await oldFetch;

    expect(api.peekHomeOverviewCache()).toBeNull();
    expect(api.peekPluginsCache()).toBeNull();
  });

  it("allows a successful empty home catalog to clear previous snapshots", async () => {
    const { api } = await loadApis();
    queue("/plugins", async () => [plugin("old")]);
    await api.fetchPlugins();
    network.httpGet.mockResolvedValue({ data: { ok: true, data: overview() } });

    await api.fetchHomeOverview({ bypassCache: true });

    expect(api.peekPluginsCache()).toEqual([]);
    expect(api.peekBotsCache()).toEqual([]);
  });

  it("does not swallow failed plugin writes or invalidate a valid snapshot", async () => {
    const { api } = await loadApis();
    const expected = [plugin("cached")];
    queue("/plugins", async () => expected);
    await api.fetchPlugins();
    network.openapiPut.mockRejectedValueOnce(new Error("write failed"));

    await expect(api.putPluginConfig("demo", {})).rejects.toThrow("write failed");
    await expect(api.fetchPlugins()).resolves.toEqual(expected);
    expect(network.openapiGet).toHaveBeenCalledTimes(1);
  });

  it("forces a fresh instance read after the catalog refresh is invalidated", async () => {
    const { api } = await loadApis();
    const oldRequest = deferred<unknown>();
    const currentRequest = deferred<unknown>();
    queue("/instances", () => oldRequest.promise, () => currentRequest.promise);

    const oldRefresh = api.refreshInstancesCatalogGlobal();
    api.invalidateInstancesCache();
    const currentRefresh = api.refreshInstancesCatalogGlobal();
    oldRequest.resolve(instances());
    await oldRefresh;
    const joinedRefresh = api.refreshInstancesCatalogGlobal();

    expect(network.openapiGet).toHaveBeenCalledTimes(2);
    currentRequest.resolve(instances());
    await Promise.all([currentRefresh, joinedRefresh]);
  });
});
