// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

HTMLElement.prototype.scrollIntoView = vi.fn();

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
      <input aria-label="原页面输入框" />
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
        { path: "database", element: <h1>Database route</h1> },
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
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
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

it("opens searchable navigation with Ctrl+K and restores the mobile entry after routing", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const { router } = renderShell();
  const trigger = screen.getByRole("button", { name: "打开快速导航" });
  trigger.focus();

  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const dialog = await screen.findByRole("dialog", { name: "快速导航" });
  const search = within(dialog).getByRole("combobox", { name: "搜索页面" });
  await user.type(search, "数据库");
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{Enter}");

  await waitFor(() => expect(router.state.location.pathname).toBe("/database"));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "快速导航" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it.each(["input", "textarea", "select", "contenteditable"])(
  "does not steal Ctrl+K from an editable %s",
  (kind) => {
    const { container } = renderShell();
    let editor: HTMLElement;
    if (kind === "input") {
      editor = screen.getByRole("textbox", { name: "原页面输入框" });
    } else {
      editor = document.createElement(kind === "textarea" ? "textarea" : kind === "select" ? "select" : "div");
      if (kind === "contenteditable") editor.setAttribute("contenteditable", "true");
      container.append(editor);
    }
    editor.focus();

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    editor.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("dialog", { name: "快速导航" })).toBeNull();
  },
);

it.each(["dialog", "alertdialog"])(
  "does not steal Ctrl+K while another %s is open with body focus",
  (role) => {
    const { container } = renderShell();
    const otherDialog = document.createElement("div");
    otherDialog.setAttribute("role", role);
    otherDialog.setAttribute("aria-modal", "true");
    container.append(otherDialog);
    document.body.focus();

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("dialog", { name: "快速导航" })).toBeNull();
  },
);

it.each(["Ctrl+K", "Escape"])("restores the original focus target after quick-nav closes with %s", async (closeKey) => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  renderShell();
  const trigger = screen.getByRole("button", { name: "打开快速导航" });
  trigger.focus();

  fireEvent.keyDown(trigger, { key: "k", ctrlKey: true });
  const search = await screen.findByRole("combobox", { name: "搜索页面" });
  expect(document.activeElement).toBe(search);

  if (closeKey === "Ctrl+K") {
    fireEvent.keyDown(search, { key: "k", ctrlKey: true });
  } else {
    await user.keyboard("{Escape}");
  }

  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(screen.queryByRole("combobox", { name: "搜索页面" })).toBeNull();
});

it("keeps a dirty config draft behind quick-nav route confirmation", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const { router } = renderShell();
  await user.click(screen.getByRole("button", { name: "标记草稿" }));

  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  const search = await screen.findByRole("combobox", { name: "搜索页面" });
  await user.type(search, "数据库");
  await user.keyboard("{ArrowDown}{Enter}");

  const confirm = await screen.findByRole("alertdialog");
  expect(router.state.location.pathname).toBe("/plugins");
  expect(confirm.textContent).toContain("有未保存的配置草稿");
  await user.click(within(confirm).getByRole("button", { name: "取消" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(router.state.location.pathname).toBe("/plugins");
  expect(screen.getByText("保留的草稿")).toBeTruthy();
});

it("offers a visible desktop quick-navigation entry", async () => {
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  renderShell();
  act(() => setShellNarrow(false));
  const trigger = await screen.findByRole("button", { name: "打开快速导航" });

  await user.click(trigger);
  expect(await screen.findByRole("combobox", { name: "搜索页面" })).not.toBeNull();
});
