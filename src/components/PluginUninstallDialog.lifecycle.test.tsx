// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginRow } from "@/api/pallasTypes";
import { getActiveJob } from "@/utils/activeJobSession";
import PluginUninstallDialog from "@/components/PluginUninstallDialog";

const api = vi.hoisted(() => ({ uninstall: vi.fn(), openStream: vi.fn() }));

vi.mock("@/api/console", () => ({
  uninstallLocalPluginAsync: api.uninstall,
  openPluginInstallJobEventSource: api.openStream,
}));

vi.mock("@/hooks/useBotSystemRestart", () => ({
  useBotSystemRestart: () => ({
    restartAvailable: false,
    ensureRestartContext: vi.fn(),
    restartBot: vi.fn(),
    restartBusy: false,
    restartConfirmDialog: null,
  }),
}));

class StubEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

const pluginRow = {
  name: "pb_long_plugin",
  module: "pb_long_plugin",
  uninstallable: true,
  uninstall_kind: "dir",
} as PluginRow;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.uninstall.mockResolvedValue({ job_id: "job-uninstall" });
});

afterEach(() => {
  cleanup();
});

it("cancels the dialog's job watcher on unmount but keeps its resumable session", async () => {
  const user = userEvent.setup();
  const stream = new StubEventSource();
  api.openStream.mockReturnValue(stream);
  const onUninstalled = vi.fn();
  const view = render(
    <PluginUninstallDialog open pluginRow={pluginRow} onClose={vi.fn()} onUninstalled={onUninstalled} />,
  );

  await user.type(screen.getByPlaceholderText("pb_long_plugin"), "pb_long_plugin");
  await user.click(screen.getByRole("button", { name: "确认删除" }));
  await waitFor(() => expect(api.openStream).toHaveBeenCalledWith("job-uninstall"));
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-uninstall");

  view.unmount();

  expect(stream.close).toHaveBeenCalledTimes(1);
  expect(getActiveJob("plugin-store")?.jobId).toBe("job-uninstall");
  expect(onUninstalled).not.toHaveBeenCalled();
});
