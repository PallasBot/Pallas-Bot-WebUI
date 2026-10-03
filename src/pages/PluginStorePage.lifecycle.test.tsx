// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getActiveJob, setActiveJob } from "@/utils/activeJobSession";
import PluginStorePage from "@/pages/PluginStorePage";

const api = vi.hoisted(() => ({
  active: vi.fn(),
  community: vi.fn(),
  open: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchPluginStoreJobActive: api.active,
  fetchOfficialExtensions: vi.fn(async () => []),
  fetchCommunityPluginStore: api.community,
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
  useBotSystemRestart: () => ({
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
  }),
}));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));

class StubEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.active.mockResolvedValue(null);
  api.community.mockResolvedValue({ plugins: [], source: "fixture" });
});

afterEach(cleanup);

it("closes the resumed store watcher on unmount while retaining the job session", async () => {
  const stream = new StubEventSource();
  api.open.mockReturnValue(stream);
  setActiveJob("plugin-store", "job-store", { kind: "community", target: "fixture", action: "install" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/plugin-store"]}>
        <PluginStorePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(api.open).toHaveBeenCalledWith("job-store"));
  view.unmount();
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-store");

  stream.emit({ type: "complete", result: { message: "late completion" } });
  expect(api.toast).not.toHaveBeenCalled();
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-store");
});
