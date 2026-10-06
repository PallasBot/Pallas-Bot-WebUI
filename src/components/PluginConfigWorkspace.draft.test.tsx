// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createMemoryRouter, Route, Routes, RouterProvider, useNavigate, useParams } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PluginRow } from "@/api/pallasTypes";
import { DraftProtectionProvider } from "@/components/DraftProtection";
import PluginConfigDialog from "@/components/PluginConfigDialog";
import PluginConfigWorkspace from "@/components/PluginConfigWorkspace";

const api = vi.hoisted(() => ({
  fetchPluginConfig: vi.fn(),
  fetchPluginConfigRaw: vi.fn(),
  putPluginConfig: vi.fn(),
  putPluginConfigRaw: vi.fn(),
  postPluginConfigCheck: vi.fn(),
}));

vi.mock("@/api/console", () => api);
vi.mock("@/api/fullConsole", () => ({
  fetchPluginBundledReadme: vi.fn(),
  fetchPluginStoreReadme: vi.fn(),
  fetchPlugins: vi.fn(async () => []),
  postPluginConfigCheck: api.postPluginConfigCheck,
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
vi.mock("@/components/provider/ProviderGatewayPanel", () => ({ default: () => null }));

let serverValue = "server value";
let serverRaw = "original = true\n";
function WorkspacePage() {
  const queryClient = useQueryClient();
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <output aria-label="dirty state">{String(dirty)}</output>
      <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["plugin-config", "draft-test"] })}>
        refresh plugin
      </button>
      <button type="button" onClick={() => void queryClient.invalidateQueries({ queryKey: ["plugin-config-raw", "draft-test"] })}>
        refresh plugin raw
      </button>
      <PluginConfigWorkspace
        pluginName="draft-test"
        initialPluginRow={{ name: "draft-test" } as PluginRow}
        onStatusChange={(status) => {
          setDirty(Boolean((status as unknown as { dirty?: boolean }).dirty));
        }}
      />
    </>
  );
}

function TestRoot() {
  return (
    <DraftProtectionProvider>
      <Routes>
        <Route path="/edit" element={<WorkspacePage />} />
        <Route path="/dialog" element={<DialogPage />} />
        <Route path="/draw-dialog" element={<DrawDialogPage />} />
        <Route path="/plugins/:name?" element={<RoutedDialogPage />} />
        <Route path="/away" element={<p>away</p>} />
      </Routes>
    </DraftProtectionProvider>
  );
}

function DialogPage() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <output aria-label="dialog open">{String(open)}</output>
      <PluginConfigDialog
        open={open}
        pluginName="draft-test"
        pluginRow={{ name: "draft-test" } as PluginRow}
        officialExtensions={[]}
        communityPlugins={[]}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function DrawDialogPage() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <output aria-label="dialog open">{String(open)}</output>
      <PluginConfigDialog
        open={open}
        pluginName="draw"
        pluginRow={{ name: "draw" } as PluginRow}
        officialExtensions={[]}
        communityPlugins={[]}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

function RoutedDialogPage() {
  const { name } = useParams();
  const navigate = useNavigate();
  return (
      <PluginConfigDialog
        open={Boolean(name)}
        pluginName={name || ""}
        pluginRow={name ? { name } as PluginRow : null}
        officialExtensions={[]}
        communityPlugins={[]}
        closeHandledByNavigation
        onClose={() => navigate("/plugins", { replace: true })}
      />
  );
}

function renderWorkspace(initialEntry = "/edit") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "*", element: <TestRoot /> }], {
    initialEntries: [initialEntry],
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  serverValue = "server value";
  serverRaw = "original = true\n";
  api.fetchPluginConfig.mockImplementation(async () => ({
    plugin: "draft-test",
    fields: [{ name: "test_value", kind: "string", current: serverValue }],
  }));
  api.fetchPluginConfigRaw.mockImplementation(async () => serverRaw);
  api.postPluginConfigCheck.mockResolvedValue({ lines: ["检查通过"] });
  api.putPluginConfig.mockImplementation(async (_name: string, values: Record<string, string>) => {
    serverValue = values.test_value;
  });
  api.putPluginConfigRaw.mockImplementation(async (_name: string, value: string) => {
    serverRaw = value;
  });
});

afterEach(cleanup);

it("keeps independent form/raw drafts on refetch and exposes their combined dirty state", async () => {
  const user = userEvent.setup();
  renderWorkspace();
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "form draft");
  expect(screen.getByLabelText("dirty state").textContent).toBe("true");

  await user.click(screen.getByRole("tab", { name: "Raw TOML" }));
  const raw = await screen.findByRole("textbox") as HTMLTextAreaElement;
  await user.clear(raw);
  await user.type(raw, "raw draft = true");
  await user.click(screen.getByRole("tab", { name: "表单" }));

  serverValue = "remote refresh";
  const formFetchesBeforeRefresh = api.fetchPluginConfig.mock.calls.length;
  await user.click(screen.getByRole("button", { name: "refresh plugin" }));
  await waitFor(() => expect(api.fetchPluginConfig.mock.calls.length).toBeGreaterThan(formFetchesBeforeRefresh));
  expect((screen.getByLabelText("test_value") as HTMLInputElement).value).toBe("form draft");
  expect(screen.getByLabelText("dirty state").textContent).toBe("true");

  await user.click(screen.getByRole("tab", { name: "Raw TOML" }));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("raw draft = true");
  serverRaw = "remote = true\n";
  const rawFetchesBeforeRefresh = api.fetchPluginConfigRaw.mock.calls.length;
  await user.click(screen.getByRole("button", { name: "refresh plugin raw" }));
  await waitFor(() => expect(api.fetchPluginConfigRaw.mock.calls.length).toBeGreaterThan(rawFetchesBeforeRefresh));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("raw draft = true");
});

it("asks before Escape closes a dirty plugin dialog", async () => {
  const user = userEvent.setup();
  renderWorkspace("/dialog");
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "dialog draft");

  fireEvent.pointerDown(document.body);
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByRole("dialog")).not.toBeNull();

  await user.keyboard("{Escape}");
  expect(await screen.findByRole("alertdialog")).not.toBeNull();
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(screen.getByRole("dialog")).not.toBeNull();

  await user.keyboard("{Escape}");
  await user.click(await screen.findByRole("button", { name: "放弃草稿" }));
  await waitFor(() => expect(screen.getByLabelText("dialog open").textContent).toBe("false"));
});

it("keeps the plugin dialog open during a save", async () => {
  const user = userEvent.setup();
  const saveControl: { finish?: () => void } = {};
  api.putPluginConfig.mockImplementation(async (_name: string, values: Record<string, string>) => {
    await new Promise<void>((resolve) => {
      saveControl.finish = () => {
        serverValue = values.test_value;
        resolve();
      };
    });
  });
  renderWorkspace("/dialog");
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "saving value");
  await user.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(saveControl.finish).toBeTypeOf("function"));

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByRole("dialog")).not.toBeNull();
  saveControl.finish?.();
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" })).toBeTruthy());
  expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
});

it("disables only clean saves in the dialog while keeping config checks available", async () => {
  const user = userEvent.setup();
  renderWorkspace("/draw-dialog");

  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  const save = screen.getByRole("button", { name: "保存" }) as HTMLButtonElement;
  const check = screen.getByRole("button", { name: "插件配置检测" }) as HTMLButtonElement;

  expect(save.disabled).toBe(true);
  expect(check.disabled).toBe(false);
  await user.click(check);
  await waitFor(() => expect(api.postPluginConfigCheck).toHaveBeenCalledOnce());
  expect(api.putPluginConfig).not.toHaveBeenCalled();

  await user.clear(field);
  await user.type(field, "changed value");
  expect(save.disabled).toBe(false);
  await user.click(save);
  await waitFor(() => expect(api.putPluginConfig).toHaveBeenCalledOnce());
});

it("confirms a route-backed plugin dialog close only once", async () => {
  const user = userEvent.setup();
  const router = renderWorkspace("/plugins/draft-test");
  const field = await screen.findByLabelText("test_value") as HTMLInputElement;
  await user.clear(field);
  await user.type(field, "routed draft");

  await user.keyboard("{Escape}");
  const cancelDialog = await screen.findByRole("alertdialog");
  expect(cancelDialog.textContent).toContain("有未保存的配置草稿");
  expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "取消" }));
  expect(router.state.location.pathname).toBe("/plugins/draft-test");
  expect(field.value).toBe("routed draft");

  await user.keyboard("{Escape}");
  const closeDialog = await screen.findByRole("alertdialog");
  expect(closeDialog.textContent).toContain("有未保存的配置草稿");
  expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "离开页面" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/plugins"));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});
