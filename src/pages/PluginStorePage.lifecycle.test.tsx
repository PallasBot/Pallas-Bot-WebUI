// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getActiveJob, setActiveJob } from "@/utils/activeJobSession";
import PluginStorePage from "@/pages/PluginStorePage";

const api = vi.hoisted(() => ({
  active: vi.fn(),
  community: vi.fn(),
  open: vi.fn(),
  snapshot: vi.fn(),
  readme: vi.fn(),
  toast: vi.fn(),
  restart: {
    restartBusy: false,
    restartErr: "",
    restartProgressLabel: "",
    restartInProgress: false,
    restartAvailable: false,
    shardedRuntime: false,
    ensureRestartContext: vi.fn(async () => false),
    restartBot: vi.fn(),
    restartConfirmDialog: null,
    trackRestartFromPluginResult: vi.fn(async () => false),
  },
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchPluginStoreJobActive: api.active,
  fetchOfficialExtensions: vi.fn(async () => []),
  fetchCommunityPluginStore: api.community,
  fetchPluginStoreReadme: api.readme,
  refreshPluginUpdateSnapshot: api.snapshot,
  fetchPlugins: vi.fn(async () => []),
}));

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  openPluginInstallJobEventSource: api.open,
}));

vi.mock("@/hooks/useConsoleConfirm", () => ({
  useConsoleConfirm: () => ({ confirm: vi.fn(async () => false), confirmDialog: null }),
}));
vi.mock("@/hooks/useBotSystemRestart", () => ({
  useBotSystemRestart: () => api.restart,
}));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));
vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Context = React.createContext<{ value: string; onValueChange: (value: string) => void; open: boolean; setOpen: (open: boolean) => void } | null>(null);
  return {
    Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => {
      const [open, setOpen] = React.useState(false);
      return <Context.Provider value={{ value, onValueChange, open, setOpen }}>{children}</Context.Provider>;
    },
    SelectTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
      const context = React.useContext(Context)!;
      return <button {...props} role="combobox" type="button" onClick={() => context.setOpen(!context.open)}>{children}</button>;
    },
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const context = React.useContext(Context)!;
      return context.open ? <div>{children}</div> : null;
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
      const context = React.useContext(Context)!;
      return <button role="option" type="button" onClick={() => { context.onValueChange(value); context.setOpen(false); }}>{children}</button>;
    },
    SelectValue: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

class StubEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function renderPage(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/plugin-store"]}>
        <PluginStorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function selectSection(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "商店类型" }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  api.active.mockResolvedValue(null);
  api.community.mockResolvedValue({ plugins: [], source: "fixture" });
  api.snapshot.mockResolvedValue({ community_count: 0, official_count: 0 });
  api.readme.mockResolvedValue("");
});

afterEach(cleanup);

it("closes the resumed store watcher on unmount while retaining the job session", async () => {
  const stream = new StubEventSource();
  api.open.mockReturnValue(stream);
  setActiveJob("plugin-store", "job-store", { kind: "community", target: "fixture", action: "install" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderPage(queryClient);

  await waitFor(() => expect(api.open).toHaveBeenCalledWith("job-store"));
  view.unmount();
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-store");

  stream.emit({ type: "complete", result: { message: "late completion" } });
  expect(api.toast).not.toHaveBeenCalled();
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-store");
});

it("ignores stale community refreshes without reverting detail versions", async () => {
  const older = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  const newer = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  api.community.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["plugins-community-store", "nav-notice"], { plugins: [] });
  renderPage(queryClient);

  await screen.findByText("共 0 项");
  await selectSection("社区插件");
  expect(api.community).toHaveBeenCalledTimes(1);
  await selectSection("官方插件");
  await selectSection("社区插件");
  expect(api.community).toHaveBeenCalledTimes(2);

  const current = {
    plugins: [{
      plugin_id: "fixture", name: "Current catalog", index_version: "2.0", installed_version: "1.9",
      loaded: true, repository_url: "https://example.com/fixture",
    }],
  };
  await act(async () => newer.resolve(current));
  expect(queryClient.getQueryData(["plugins-community-store", "nav-notice"])).toEqual(current);
  fireEvent.click(screen.getByText("Current catalog"));
  expect(await screen.findByText(/已安装：1\.9 · 索引：2\.0/)).toBeTruthy();

  await act(async () => older.resolve({
    plugins: [{ plugin_id: "fixture", name: "Stale catalog", index_version: "1.0" }],
  }));
  expect(screen.queryByText("Stale catalog")).toBeNull();
  expect(screen.getByText(/已安装：1\.9 · 索引：2\.0/)).toBeTruthy();
  expect(queryClient.getQueryData(["plugins-community-store", "nav-notice"])).toEqual(current);
});

it("safely refreshes an open detail from a response without plugins", async () => {
  const response = deferred<{ plugins?: never }>();
  api.community.mockResolvedValueOnce({
    plugins: [{ plugin_id: "fixture", name: "Fixture", repository_url: "https://example.com/fixture", loaded: true }],
  }).mockReturnValueOnce(response.promise);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["plugins-community-store", "nav-notice"], { plugins: [] });
  renderPage(queryClient);
  await screen.findByText("共 0 项");
  await selectSection("社区插件");
  await screen.findByText("Fixture");
  fireEvent.click(screen.getByText("Fixture"));
  expect((await screen.findAllByText(/已安装：未知/)).length).toBeGreaterThan(0);
  fireEvent.click([...document.querySelectorAll("button")].find((button) => button.textContent?.includes("检查更新"))!);
  await act(async () => response.resolve({}));
  expect(queryClient.getQueryData(["plugins-community-store", "nav-notice"])).toEqual({});
  expect(screen.getAllByText(/已安装：未知/).length).toBeGreaterThan(0);
});

it("refreshes through the page before the nav query resolves, without cache rollback", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const oldQuery = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  const key = ["plugins-community-store", "nav-notice"];
  const refreshed = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  queryClient.setQueryData(key, { plugins: [] });
  void queryClient.invalidateQueries({ queryKey: key, exact: true });
  api.community.mockReturnValueOnce(oldQuery.promise).mockReturnValueOnce(refreshed.promise);
  renderPage(queryClient);
  await waitFor(() => expect(api.community).toHaveBeenCalledTimes(1));
  await screen.findByText("共 0 项");
  await selectSection("社区插件");
  await waitFor(() => expect(api.community).toHaveBeenCalledTimes(2));
  const latest = { plugins: [{ plugin_id: "fixture", name: "Latest", index_version: "2.0" }] };
  await act(async () => refreshed.resolve(latest));
  expect(queryClient.getQueryData(key)).toEqual(latest);
  await act(async () => oldQuery.resolve({ plugins: [{ plugin_id: "fixture", name: "Old", index_version: "1.0" }] }));
  expect(queryClient.getQueryData(key)).toEqual(latest);
});

it("does not let an unmounted page overwrite or reject over the next page", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const oldRequest = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  const newRequest = deferred<{ plugins: { plugin_id: string; name: string; index_version: string }[] }>();
  const key = ["plugins-community-store", "nav-notice"];
  queryClient.setQueryData(key, { plugins: [] });
  api.community.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
  const oldPage = renderPage(queryClient);
  await screen.findByText("共 0 项");
  await selectSection("社区插件");
  await waitFor(() => expect(api.community).toHaveBeenCalledTimes(1));
  oldPage.unmount();

  renderPage(queryClient);
  await screen.findByText("共 0 项");
  await selectSection("社区插件");
  await waitFor(() => expect(api.community).toHaveBeenCalledTimes(2));
  const latest = { plugins: [{ plugin_id: "fixture", name: "Latest", index_version: "2.0" }] };
  await act(async () => newRequest.resolve(latest));
  expect(queryClient.getQueryData(key)).toEqual(latest);
  await act(async () => oldRequest.reject(new Error("stale failure")));
  expect(queryClient.getQueryData(key)).toEqual(latest);
});
