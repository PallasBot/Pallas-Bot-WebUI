// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getActiveJob, setActiveJob } from "@/utils/activeJobSession";
import UpdatePage from "@/pages/UpdatePage";

const api = vi.hoisted(() => ({
  active: vi.fn(),
  open: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchUpdateApplyJobActive: api.active,
  openUpdateApplyJobEventSource: api.open,
  fetchUpdateCheckAll: vi.fn(async () => ({ webui: {}, bot: {}, plugins: [] })),
  fetchWebuiAutoUpdateStatus: vi.fn(async () => ({})),
  fetchInstances: vi.fn(async () => ({ nonebot_bots: [], db_bot_configs: [], bot_profiles: {} })),
}));

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchAiInstallStatus: vi.fn(async () => ({})),
  fetchPluginConfig: vi.fn(async () => ({ fields: [] })),
}));

vi.mock("@/hooks/useConsoleConfirm", () => ({
  useConsoleConfirm: () => ({ confirm: vi.fn(), confirmDialog: null }),
}));
vi.mock("@/hooks/useBotFavorites", () => ({ useBotFavorites: () => ({ favorites: new Set<number>() }) }));
vi.mock("@/components/BotGitUpdatePanel", () => ({ default: () => null }));
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
});

afterEach(cleanup);

it("closes the resumed update watcher on unmount without clearing the job or handling late completion", async () => {
  const stream = new StubEventSource();
  api.open.mockReturnValue(stream);
  setActiveJob("update-apply", "job-update", { kind: "web" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/update"]}>
        <UpdatePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  await waitFor(() => expect(api.open).toHaveBeenCalledWith("job-update"));
  view.unmount();
  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("update-apply")?.jobId).toBe("job-update");

  stream.emit({ type: "complete", result: { message: "late completion" } });
  expect(api.toast).not.toHaveBeenCalled();
  expect(getActiveJob("update-apply")?.jobId).toBe("job-update");
});

it("cancels the completed web update's delayed reload when leaving the page", async () => {
  const stream = new StubEventSource();
  api.open.mockReturnValue(stream);
  setActiveJob("update-apply", "job-completed", { kind: "web" });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/update"]}><UpdatePage /></MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(api.open).toHaveBeenCalledWith("job-completed"));
  const setTimeoutSpy = vi.spyOn(window, "setTimeout");
  const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
  try {
    stream.emit({ type: "complete", result: { message: "web update complete" } });
    await waitFor(() => expect(setTimeoutSpy.mock.calls.some((call) => call[1] === 800)).toBe(true));
    const index = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 800);
    const timer = setTimeoutSpy.mock.results[index].value;
    const lateReload = setTimeoutSpy.mock.calls[index][0] as () => void;
    view.unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      lateReload();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  } finally {
    // Keep the intentionally failing regression from actually reloading jsdom.
    for (let index = 0; index < setTimeoutSpy.mock.calls.length; index += 1) {
      if (setTimeoutSpy.mock.calls[index][1] === 800) window.clearTimeout(setTimeoutSpy.mock.results[index].value);
    }
    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  }
});
