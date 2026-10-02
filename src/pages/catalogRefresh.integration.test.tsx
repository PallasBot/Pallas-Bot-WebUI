// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  fetchPlugins,
  invalidateBotsCache,
  invalidateInstancesCache,
  invalidatePluginsCache,
  peekHomeOverviewCache,
} from "@/api/consoleApi";
import type { InstancesData, PluginRow } from "@/api/pallasTypes";
import PluginConfigWorkspace from "@/components/PluginConfigWorkspace";
import HomePage from "@/pages/HomePage";
import PluginsPage from "@/pages/PluginsPage";
import InstancesPage from "@/pages/InstancesPage";

const network = vi.hoisted(() => ({ openapiGet: vi.fn(), openapiPut: vi.fn(), httpGet: vi.fn() }));

vi.mock("@/api/consoleOpenapiClient", () => ({
  consoleOpenapiDelete: vi.fn(),
  consoleOpenapiGet: network.openapiGet,
  consoleOpenapiPatch: vi.fn(),
  consoleOpenapiPost: vi.fn(),
  consoleOpenapiPut: network.openapiPut,
}));

vi.mock("@/api/http", () => ({
  DB_BACKUP_TIMEOUT_MS: 10,
  DB_HEAVY_READ_TIMEOUT_MS: 20,
  http: { delete: vi.fn(), get: network.httpGet, patch: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchCommunityPluginStore: vi.fn(async () => ({ plugins: [] })),
  fetchOfficialExtensions: vi.fn(async () => []),
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchBotUpdateCheck: vi.fn(async () => ({})),
  fetchCommunityStats: vi.fn(async () => ({})),
  fetchConsoleDailyStats: vi.fn(async () => ({})),
  fetchFriendList: vi.fn(async () => ({})),
  fetchGroupList: vi.fn(async () => ({})),
  fetchMessageStats: vi.fn(async () => ({})),
  fetchPluginRunStats: vi.fn(async () => ({})),
  fetchPluginsGlobalDisable: vi.fn(async () => ({
    disabled_plugins: [],
    revision: "test",
    protected_plugins: [],
  })),
  fetchRequestOverview: vi.fn(async () => ({})),
  fetchSystem: vi.fn(async () => ({})),
  fetchUpdateCheck: vi.fn(async () => ({})),
  fetchWebuiAutoUpdateStatus: vi.fn(async () => ({})),
}));

let pluginRows: PluginRow[] = [{ name: "before", module: "before", metadata: null }];
let instanceData: InstancesData = { nonebot_bots: [], db_bot_configs: [], pallas_protocol: null };
let configData = {
  plugin: "demo",
  module: "demo",
  fields: [{ name: "display_name", kind: "string", current: "before" }],
};

function CatalogProbe() {
  const query = useQuery({ queryKey: ["plugins"], queryFn: () => fetchPlugins() });
  return <output data-testid="catalog-probe">{(query.data || []).map((row) => row.name).join(",")}</output>;
}

function RouteButtons() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate("/")}>前往首页</button>
      <button type="button" onClick={() => navigate("/plugins")}>前往插件管理</button>
    </>
  );
}

function renderPage(path: string, page: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "*", element: page }], { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePluginsCache();
  invalidateInstancesCache();
  invalidateBotsCache();
  pluginRows = [{ name: "before", module: "before", metadata: null }];
  instanceData = { nonebot_bots: [], db_bot_configs: [], pallas_protocol: null };
  configData = {
    plugin: "demo",
    module: "demo",
    fields: [{ name: "display_name", kind: "string", current: "before" }],
  };
  network.openapiGet.mockImplementation((url: string) => {
    if (url === "/plugins") return Promise.resolve(pluginRows);
    if (url === "/instances") return Promise.resolve(instanceData);
    if (url === "/plugins/demo/config") return Promise.resolve(configData);
    if (url === "/plugins/global-disable") {
      return Promise.resolve({ disabled_plugins: [], revision: "test", protected_plugins: [] });
    }
    throw new Error(`Unexpected GET ${url}`);
  });
  network.openapiPut.mockResolvedValue({ plugin: "test", module: "test", fields: [] });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("PluginsPage refresh bypasses the module snapshot and renders the new directory", async () => {
  const user = userEvent.setup();
  renderPage("/plugins", <PluginsPage />);
  await screen.findByRole("heading", { name: "before" });

  pluginRows = [{ name: "after", module: "after", metadata: null }];
  await user.click(screen.getByRole("button", { name: "刷新" }));

  await screen.findByRole("heading", { name: "after" });
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/plugins")).toHaveLength(2);
});

it("InstancesPage refresh bypasses both catalog snapshots and renders the new instance", async () => {
  const user = userEvent.setup();
  renderPage("/instances", <InstancesPage />);
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "刷新" }) as HTMLButtonElement).disabled).toBe(false),
  );

  instanceData = {
    nonebot_bots: [{ self_id: "123456", connection_key: "test", adapter: "onebot" }],
    db_bot_configs: [],
    pallas_protocol: null,
  };
  pluginRows = [{ name: "after", module: "after", metadata: null }];
  await user.click(screen.getByRole("button", { name: "刷新" }));

  await screen.findByText("123456");
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/instances")).toHaveLength(2);
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/plugins")).toHaveLength(2);
});

it("BotConfigModal save reloads the real instances query with the saved config", async () => {
  const user = userEvent.setup();
  const originalConfig = {
    account: 123456,
    admins: [654321],
    auto_accept_friend: false,
    auto_accept_group: false,
    security: false,
    taken_name: {},
    drunk: {},
    disabled_plugins: [],
    community_roster_show_qq: true,
  };
  instanceData = { ...instanceData, db_bot_configs: [originalConfig] };
  network.openapiPut.mockImplementation((url: string, body: unknown) => {
    expect(url).toBe("/bot-configs/123456");
    const savedConfig = { ...originalConfig, ...(body as Partial<typeof originalConfig>) };
    instanceData = { ...instanceData, db_bot_configs: [savedConfig] };
    return Promise.resolve(savedConfig);
  });

  const queryClient = renderPage("/instances", <InstancesPage />);
  await user.click(await screen.findByRole("button", { name: "BOT" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("checkbox", { name: /安全模式/ }));
  await user.click(screen.getByRole("button", { name: "保存" }));

  await screen.findByText("开启");
  await waitFor(() => expect(network.openapiGet.mock.calls.filter(([url]) => url === "/instances")).toHaveLength(2));
  expect(network.openapiPut).toHaveBeenCalledWith(
    "/bot-configs/123456",
    expect.objectContaining({ security: true }),
  );
  expect(queryClient.getQueryData(["instances"])).toEqual(instanceData);
});

it("plugin config save refetches an active catalog query after invalidating the module snapshot", async () => {
  const user = userEvent.setup();
  network.openapiPut.mockImplementation((url: string, body: unknown) => {
    expect(url).toBe("/plugins/demo/config");
    const values = (body as { values: Record<string, string> }).values;
    configData = {
      ...configData,
      fields: configData.fields.map((field) => ({ ...field, current: values[field.name] })),
    };
    pluginRows = [{ name: "after", module: "after", metadata: { name: "After save" } }];
    return Promise.resolve(configData);
  });

  const queryClient = renderPage(
    "/",
    <>
      <CatalogProbe />
      <PluginConfigWorkspace pluginName="demo" compact initialPluginRow={pluginRows[0]} />
    </>,
  );
  await screen.findByText("before");
  const field = screen.getByDisplayValue("before") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "updated");
  await user.click(screen.getByRole("button", { name: "保存配置" }));

  await screen.findByText("after");
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/plugins")).toHaveLength(2);
  expect(queryClient.getQueryData(["plugins"])).toEqual(pluginRows);
});

it("HomePage forced refresh synchronizes the existing plugin query caches before navigation", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("__WEBUI_VERSION__", "test");
  let homePlugins = [...pluginRows];
  network.httpGet.mockImplementation((url: string) => {
    if (url === "/home/overview") {
      return Promise.resolve({
        data: {
          ok: true,
          data: {
            health: null,
            system: null,
            bots: [],
            instances: instanceData,
            plugins: homePlugins,
            message_stats: null,
            plugin_run_stats: null,
            community_stats: null,
          },
        },
      });
    }
    if (url === "/preferences/bot-favorites") {
      return Promise.resolve({ data: { ok: true, data: { initialized: true, accounts: [] } } });
    }
    throw new Error(`Unexpected HTTP GET ${url}`);
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["plugins-catalog"], pluginRows);
  const router = createMemoryRouter(
    [
      { path: "/", element: <><RouteButtons /><HomePage /></> },
      { path: "/plugins", element: <><RouteButtons /><PluginsPage /></> },
    ],
    { initialEntries: ["/plugins"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await screen.findByRole("heading", { name: "before" });
  expect(queryClient.getQueryData(["plugins"])).toEqual(pluginRows);
  await user.click(screen.getByRole("button", { name: "前往首页" }));
  await screen.findByRole("button", { name: "刷新概况" });

  homePlugins = [{ name: "after", module: "after", metadata: null }];
  await user.click(screen.getByRole("button", { name: "刷新概况" }));

  await waitFor(() => {
    expect(queryClient.getQueryData(["plugins"])).toEqual(homePlugins);
    expect(queryClient.getQueryData(["plugins-catalog"])).toEqual(homePlugins);
  });
  expect(peekHomeOverviewCache()?.plugins).toEqual(homePlugins);
  expect(queryClient.getQueryData(["instances"])).toEqual(instanceData);
  await user.click(screen.getByRole("button", { name: "前往插件管理" }));
  await screen.findByRole("heading", { name: "after" });
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/plugins")).toHaveLength(1);
  expect(network.openapiGet.mock.calls.filter(([url]) => url === "/instances")).toHaveLength(0);
});
