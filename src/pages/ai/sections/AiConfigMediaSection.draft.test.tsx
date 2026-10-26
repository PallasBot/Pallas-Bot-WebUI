// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, Route, Routes, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiConfigChromeProvider, useAiConfigChromeSlots } from "@/components/ai/AiConfigChromeContext";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import AiConfigMediaSection from "@/pages/ai/sections/AiConfigMediaSection";

const api = vi.hoisted(() => ({
  fetchAiExtensionConfig: vi.fn(),
  fetchAiInstallStatus: vi.fn(),
  fetchAiRuntimeStatus: vi.fn(),
  fetchMediaAssetsDownloadActive: vi.fn(),
  fetchSingBackends: vi.fn(),
  fetchSingSpeakers: vi.fn(),
  fetchPluginConfig: vi.fn(),
  fetchPlugins: vi.fn(),
  fetchAiInstallJobActive: vi.fn(),
  fetchLlmProvidersConfig: vi.fn(),
}));

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchAiExtensionConfig: api.fetchAiExtensionConfig,
  fetchAiInstallStatus: api.fetchAiInstallStatus,
  fetchAiRuntimeStatus: api.fetchAiRuntimeStatus,
  fetchMediaAssetsDownloadActive: api.fetchMediaAssetsDownloadActive,
  fetchSingBackends: api.fetchSingBackends,
  fetchSingSpeakers: api.fetchSingSpeakers,
  fetchPluginConfig: api.fetchPluginConfig,
}));
vi.mock("@/api/consoleApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/consoleApi")>()),
  fetchAiInstallJobActive: api.fetchAiInstallJobActive,
  fetchLlmProvidersConfig: api.fetchLlmProvidersConfig,
}));
vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchPlugins: api.fetchPlugins,
}));
vi.mock("@/components/config/DynamicConfigPanel", () => ({
  default: ({
    fields,
    fieldValues,
    onFieldChange,
  }: {
    fields: Array<{ name: string }>;
    fieldValues: Record<string, string>;
    onFieldChange: (name: string, value: string) => void;
  }) => (
    <>
      {fields.map((field) => (
        <label key={field.name}>
          {field.name}
          <input
            aria-label={field.name}
            value={fieldValues[field.name] ?? ""}
            onChange={(event) => onFieldChange(field.name, event.target.value)}
          />
        </label>
      ))}
    </>
  ),
}));

function ChromeSlot() {
  const { middle } = useAiConfigChromeSlots();
  return <div data-testid="media-chrome">{middle}</div>;
}

function MediaPage() {
  return (
    <AiConfigChromeProvider search="" setSearch={() => undefined}>
      <ChromeSlot />
      <AiConfigMediaSection />
    </AiConfigChromeProvider>
  );
}

function renderMedia(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <DraftProtectionProvider>
            <Routes>
              <Route path="/media" element={<MediaPage />} />
            </Routes>
          </DraftProtectionProvider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => undefined },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
  });
  api.fetchAiExtensionConfig.mockResolvedValue({ base_url: "", timeout_sec: 30, token: "" });
  api.fetchAiInstallStatus.mockResolvedValue({});
  api.fetchAiRuntimeStatus.mockResolvedValue({ running: true, health: { ok: true } });
  api.fetchMediaAssetsDownloadActive.mockResolvedValue(null);
  api.fetchSingBackends.mockResolvedValue({ backends: [] });
  api.fetchSingSpeakers.mockResolvedValue({
    default_speaker: "speaker-a",
    preferred_backend: "",
    song_cache_days: 7,
    song_cache_size: 10,
    speaker_backends: {},
    speakers: [{ id: "speaker-a", ready: true }],
  });
  api.fetchPluginConfig.mockResolvedValue({
    plugin: "sing",
    fields: [{ name: "sing_speakers", kind: "string", current: "{}" }],
  });
  api.fetchLlmProvidersConfig.mockResolvedValue({ providers: [] });
  api.fetchPlugins.mockResolvedValue([{ name: "sing", resolved_plugin_id: "sing" }]);
  api.fetchAiInstallJobActive.mockResolvedValue(null);
});

afterEach(cleanup);

it("confirms switching away from a dirty sing audio mapping and preserves it on cancel", async () => {
  const user = userEvent.setup();
  const router = renderMedia("/media?panel=sing");
  const field = await screen.findByLabelText("sing_speakers") as HTMLInputElement;
  fireEvent.change(field, { target: { value: '{"speaker-a":"draft.wav"}' } });
  await router.navigate("/media?panel=sing&filter=keep#mapping");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(field.value).toBe('{"speaker-a":"draft.wav"}');

  const panelSelect = within(await screen.findByTestId("media-chrome")).getByRole("combobox");
  await user.click(panelSelect);
  await user.click(await screen.findByRole("option", { name: "画画" }));

  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "取消" }));
  await waitFor(() => expect(router.state.location.search).toBe("?panel=sing&filter=keep"));
  expect(router.state.location.hash).toBe("#mapping");
  expect(field.value).toBe('{"speaker-a":"draft.wav"}');

  await router.navigate("/media?panel=draw-raw&filter=keep#mapping");
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(await screen.findByRole("button", { name: "离开页面" }));
  await waitFor(() => expect(router.state.location.search).toBe("?panel=draw&filter=keep"));
  expect(screen.queryByLabelText("sing_speakers")).toBeNull();
});
