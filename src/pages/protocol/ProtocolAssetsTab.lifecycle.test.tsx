// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  capability: vi.fn(),
  listImages: vi.fn(),
  overview: vi.fn(),
  profile: vi.fn(),
  pull: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/protocol", () => ({
  protocolApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  protocolCleanupRuntimeDist: vi.fn(),
  protocolDownloadRuntime: vi.fn(),
  protocolDownloadSnowlumaRuntime: vi.fn(),
  protocolFetchDockerCapability: api.capability,
  protocolFetchRuntimeOverview: api.overview,
  protocolFetchRuntimeProfile: api.profile,
  protocolListDockerImages: api.listImages,
  protocolPullDockerImage: api.pull,
  protocolUpdateRuntimeProfile: vi.fn(),
}));
vi.mock("@/hooks/useConsoleConfirm", () => ({
  useConsoleConfirm: () => ({ confirm: vi.fn(async () => true), confirmDialog: null }),
}));
vi.mock("@/components/protocol/ProtocolChromeContext", () => ({ useRegisterProtocolChrome: vi.fn() }));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));

import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import ProtocolAssetsTab from "@/pages/protocol/ProtocolAssetsTab";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

function renderAssets() {
  const reload = vi.fn(async () => undefined);
  return render(
    <MemoryRouter initialEntries={["/assets"]}>
      <Routes>
        <Route element={<Outlet context={{ mountUrl: "http://protocol.test/protocol/console", reload }} />}>
          <Route path="/assets" element={<ProtocolAssetsTab />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.capability.mockResolvedValue({ ready: true, message: "fixture ready" });
  api.listImages.mockResolvedValue({ ok: true, images: [] });
  api.overview.mockResolvedValue({});
  api.profile.mockResolvedValue({
    napcat_runtime_mode: "docker",
    snowluma_runtime_mode: "docker",
    docker_image: "fixture/napcat:latest",
    snowluma_docker_image: "fixture/snowluma:latest",
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("clears the soft progress interval immediately when the assets page unmounts during pull startup", async () => {
  const started = deferred<{ job_id: string; job: { job_id: string; status: string } }>();
  api.pull.mockReturnValue(started.promise);
  renderAssets();
  const pullButton = await screen.findByRole("button", { name: "拉取镜像" });
  const setIntervalSpy = vi.spyOn(window, "setInterval");
  const clearIntervalSpy = vi.spyOn(window, "clearInterval");

  fireEvent.click(pullButton);
  await waitFor(() => expect(api.pull).toHaveBeenCalledTimes(1));
  const softTimerIndex = setIntervalSpy.mock.calls.findIndex((call) => call[1] === 2_500);
  expect(softTimerIndex).toBeGreaterThanOrEqual(0);
  const softTimer = setIntervalSpy.mock.results[softTimerIndex].value;

  cleanup();
  expect(clearIntervalSpy).toHaveBeenCalledWith(softTimer);
  expect(api.pull).toHaveBeenCalledWith("http://protocol.test/protocol/console", "fixture/napcat:latest", "napcat");

  await act(async () => {
    started.resolve({ job_id: "server-job-still-running", job: { job_id: "server-job-still-running", status: "running" } });
    await started.promise;
  });
  expect(api.toast).not.toHaveBeenCalled();
});
