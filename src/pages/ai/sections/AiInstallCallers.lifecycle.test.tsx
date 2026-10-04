// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiConfigChromeProvider, useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import { getActiveJob } from "@/utils/activeJobSession";
import AiConfigConnectionSection from "@/pages/ai/sections/AiConfigConnectionSection";
import AiConfigMediaSection from "@/pages/ai/sections/AiConfigMediaSection";

const api = vi.hoisted(() => ({
  config: vi.fn(),
  installStatus: vi.fn(),
  runtime: vi.fn(),
  installActive: vi.fn(),
  mediaDownloadActive: vi.fn(),
  install: vi.fn(),
  open: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchAiExtensionConfig: api.config,
  fetchAiInstallStatus: api.installStatus,
  fetchAiRuntimeStatus: api.runtime,
  fetchMediaAssetsDownloadActive: api.mediaDownloadActive,
  postAiInstall: api.install,
  openAiInstallJobEventSource: api.open,
}));

vi.mock("@/api/consoleApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/consoleApi")>()),
  fetchAiInstallJobActive: api.installActive,
}));

vi.mock("@/hooks/useConsoleConfirm", () => ({
  useConsoleConfirm: () => ({ confirm: vi.fn(async () => false), confirmDialog: null }),
}));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));

function ChromeSlot() {
  return <div>{useAiConfigChromeSlots().middle}</div>;
}

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
  api.config.mockResolvedValue({ base_url: "", api_prefix: "/api", timeout_sec: 30 });
  api.installStatus.mockResolvedValue({ can_clone: true, can_bootstrap: false, can_update: false });
  api.runtime.mockResolvedValue({ running: false, can_manage: true, health: { ok: true } });
  api.installActive.mockResolvedValue(null);
  api.mediaDownloadActive.mockResolvedValue(null);
  api.install.mockResolvedValue({ job_id: "ai-install-job" });
});

afterEach(cleanup);

it.each([
  ["connection", "/connection", <AiConfigConnectionSection />],
  ["media", "/media?panel=service", <AiConfigMediaSection />],
])("cancels the %s install watcher on unmount, not the job", async (_name, path, section) => {
  const user = userEvent.setup();
  const stream = new StubEventSource();
  api.open.mockReturnValue(stream);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{ path: "*", element: (
      <DraftProtectionProvider>
        <AiConfigChromeProvider search="" setSearch={() => undefined}>
          <ChromeSlot />
          {section}
        </AiConfigChromeProvider>
      </DraftProtectionProvider>
    ) }],
    { initialEntries: [path] },
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  if (_name === "connection") await user.click(await screen.findByRole("tab", { name: "运行时" }));
  await user.click(await screen.findByRole("button", { name: "下载并安装" }));
  await waitFor(() => expect(api.open).toHaveBeenCalledWith("ai-install-job"));
  expect(getActiveJob("ai-install")?.jobId).toBe("ai-install-job");

  view.unmount();

  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("ai-install")?.jobId).toBe("ai-install-job");
  stream.emit({ type: "complete", message: "late completion" });
  expect(api.toast).not.toHaveBeenCalled();
  expect(getActiveJob("ai-install")?.jobId).toBe("ai-install-job");
});
