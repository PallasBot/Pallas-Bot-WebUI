// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { PointerEventsCheckLevel } from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { useState } from "react";
import { DraftProtectionProvider, useDraftProtection } from "@/components/DraftProtection";
import AppShell from "@/layout/AppShell";

const api = vi.hoisted(() => ({
  fetchHealth: vi.fn(),
  fetchCommunityPluginStore: vi.fn(),
  fetchOfficialExtensions: vi.fn(),
  fetchUpdateCheckAll: vi.fn(),
  fetchWebuiAutoUpdateStatus: vi.fn(),
  fetchAiInstallStatus: vi.fn(),
  fetchShardObservability: vi.fn(),
  fetchSystemRestartAvailability: vi.fn(),
  postSystemRestart: vi.fn(),
}));

vi.mock("@/api/health", () => ({ fetchHealth: api.fetchHealth }));
vi.mock("@/api/console", () => ({ fetchAiInstallStatus: api.fetchAiInstallStatus }));
vi.mock("@/api/fullConsole", () => ({
  fetchCommunityPluginStore: api.fetchCommunityPluginStore,
  fetchOfficialExtensions: api.fetchOfficialExtensions,
  fetchUpdateCheckAll: api.fetchUpdateCheckAll,
  fetchWebuiAutoUpdateStatus: api.fetchWebuiAutoUpdateStatus,
  fetchShardObservability: api.fetchShardObservability,
  fetchSystemRestartAvailability: api.fetchSystemRestartAvailability,
  postSystemRestart: api.postSystemRestart,
}));
vi.mock("@/utils/prefetchConsoleShell", () => ({ prefetchConsoleShell: vi.fn() }));

let shellNarrow = true;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

function setShellNarrow(next: boolean) {
  shellNarrow = next;
  for (const listener of mediaListeners) {
    listener({ matches: next, media: "(max-width: 860px)" } as MediaQueryListEvent);
  }
}

function DirtyPluginsRoute() {
  const [dirty, setDirty] = useState(false);
  useDraftProtection(dirty);
  return (
    <>
      <h1>Plugins route</h1>
      <button type="button" onClick={() => setDirty(true)}>标记草稿</button>
      {dirty ? <output>保留的草稿</output> : null}
    </>
  );
}

function renderShell(path = "/plugins") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [{
      path: "/",
      element: <DraftProtectionProvider><AppShell /></DraftProtectionProvider>,
      children: [
        { path: "plugins", element: <DirtyPluginsRoute /> },
        { path: "instances", element: <h1>Instances route</h1> },
      ],
    }],
    { initialEntries: [path] },
  );
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, queryClient, router };
}

beforeEach(() => {
  vi.stubGlobal("__WEBUI_VERSION__", "test-version");
  shellNarrow = true;
  mediaListeners.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      media,
      get matches() { return media.includes("860px") ? shellNarrow : false; },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
    })),
  });
  api.fetchHealth.mockResolvedValue({ ok: true, version: "fixture" });
  api.fetchCommunityPluginStore.mockResolvedValue({ plugins: [] });
  api.fetchOfficialExtensions.mockResolvedValue([]);
  api.fetchUpdateCheckAll.mockResolvedValue({});
  api.fetchWebuiAutoUpdateStatus.mockResolvedValue({});
  api.fetchAiInstallStatus.mockResolvedValue({});
  api.fetchShardObservability.mockResolvedValue({ sharded: false });
  api.fetchSystemRestartAvailability.mockResolvedValue({ restart_available: true, deployment_mode: "venv" });
  api.postSystemRestart.mockResolvedValue({ message: "scheduled" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("traps menu focus, closes on Escape/backdrop, restores focus and releases modal effects on unmount", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const result = renderShell();
  const trigger = screen.getByRole("button", { name: "打开菜单" });

  await user.click(trigger);
  const menu = await screen.findByRole("dialog", { name: "主导航" });
  expect(menu.contains(document.activeElement)).toBe(true);
  for (let i = 0; i < 20; i++) {
    await user.tab();
    expect(menu.contains(document.activeElement)).toBe(true);
  }

  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "主导航" })).toBeNull());
  expect(document.activeElement).toBe(trigger);
  expect(result.container.getAttribute("aria-hidden")).not.toBe("true");

  await user.click(trigger);
  await screen.findByRole("dialog", { name: "主导航" });
  await user.click(document.querySelector(".shell-mobile-nav__backdrop")!);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "主导航" })).toBeNull());
  expect(document.activeElement).toBe(trigger);

  await user.click(trigger);
  await screen.findByRole("dialog", { name: "主导航" });
  result.unmount();
  expect(document.body.style.pointerEvents).not.toBe("none");
  expect(result.container.getAttribute("aria-hidden")).not.toBe("true");
});

it("cleans up the open drawer when the shell crosses back to desktop width", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const result = renderShell();
  await user.click(screen.getByRole("button", { name: "打开菜单" }));
  await screen.findByRole("dialog", { name: "主导航" });

  setShellNarrow(false);
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "主导航" })).toBeNull());
  expect(document.body.style.pointerEvents).not.toBe("none");
  expect(result.container.getAttribute("aria-hidden")).not.toBe("true");
});

it("keeps one usable dirty-route confirmation when leaving from the drawer", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const { router } = renderShell();
  await user.click(screen.getByRole("button", { name: "标记草稿" }));
  await user.click(screen.getByRole("button", { name: "打开菜单" }));
  const menu = await screen.findByRole("dialog", { name: "主导航" });
  await user.click(within(menu).getByRole("link", { name: "数据库实例" }));

  const confirm = await screen.findByRole("alertdialog");
  expect(confirm.textContent).toContain("有未保存的配置草稿");
  expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  for (let i = 0; i < 4; i++) {
    await user.tab();
    expect(confirm.contains(document.activeElement)).toBe(true);
  }
  await user.click(within(confirm).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(router.state.location.pathname).toBe("/plugins");
  expect(screen.getByText("保留的草稿")).toBeTruthy();
  expect(menu.contains(document.activeElement)).toBe(true);

  await user.click(within(menu).getByRole("link", { name: "数据库实例" }));
  await user.click(await screen.findByRole("button", { name: "离开页面" }));
  await screen.findByRole("heading", { name: "Instances route" });
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("keeps the drawer usable beneath the restart confirmation", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const { queryClient } = renderShell();
  await user.click(screen.getByRole("button", { name: "打开菜单" }));
  const menu = await screen.findByRole("dialog", { name: "主导航" });
  await user.click(within(menu).getByRole("button", { name: "重启 Bot" }));

  const confirm = await screen.findByRole("alertdialog");
  expect(confirm.textContent).toContain("重启 Bot");
  expect(menu.isConnected).toBe(true);
  expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  for (let i = 0; i < 4; i++) {
    await user.tab();
    expect(confirm.contains(document.activeElement)).toBe(true);
  }
  await user.click(within(confirm).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("dialog", { name: "主导航" })).toBe(menu);
  expect(menu.contains(document.activeElement)).toBe(true);
  queryClient.clear();
});

it("marks stale successful health data as expired after a background failure and recovers", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  api.fetchHealth
    .mockResolvedValueOnce({ ok: true, version: "fixture" })
    .mockRejectedValueOnce(new Error("503 fixture"))
    .mockResolvedValueOnce({ ok: true, version: "fixture" });
  const { queryClient } = renderShell();
  await user.click(screen.getByRole("button", { name: "打开菜单" }));
  let menu = await screen.findByRole("dialog", { name: "主导航" });
  await within(menu).findByText("已连接");

  await queryClient.refetchQueries({ queryKey: ["health"] });
  await within(menu).findByText("状态过期");
  expect(queryClient.getQueryData<{ ok: boolean }>(["health"])?.ok).toBe(true);

  await queryClient.refetchQueries({ queryKey: ["health"] });
  menu = screen.getByRole("dialog", { name: "主导航" });
  await within(menu).findByText("已连接");
});
