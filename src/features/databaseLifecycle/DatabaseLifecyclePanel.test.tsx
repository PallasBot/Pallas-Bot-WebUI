// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchJob: vi.fn(),
  preview: vi.fn(),
  save: vi.fn(),
  start: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/api/fullConsole", () => ({
  fetchDbLifecycleCatalog: api.fetchCatalog,
  fetchDbLifecycleJob: api.fetchJob,
  previewDbLifecycle: api.preview,
  putDbLifecyclePolicies: api.save,
  startDbLifecycleJob: api.start,
}));
vi.mock("@/utils/consoleToast", () => ({ pushConsoleToast: api.toast }));

import DatabaseLifecyclePanel from "./DatabaseLifecyclePanel";

const catalog = {
  backend: "postgresql",
  datasets: [{
    dataset_id: "message_history",
    label: "消息历史",
    risk: "medium",
    present_objects: ["message"],
    row_count: 10,
    size_bytes: 2048,
    policy: { enabled: true, retention_days: 30, max_bytes: null },
    supports_retention: true,
    supports_max_bytes: true,
    errors: [],
  }],
  unmanaged_objects: [],
};

const preview = {
  dataset_id: "message_history",
  candidate_rows: 3,
  candidate_bytes: 300,
  confirmation_token: "preview-token",
  expires_at: 9999999999,
};

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DatabaseLifecyclePanel />
    </QueryClientProvider>,
  );
}

async function openPolicy(user: ReturnType<typeof userEvent.setup>) {
  await screen.findAllByRole("button", { name: "管理" });
  await user.click(screen.getAllByRole("button", { name: "管理" })[0]);
  await screen.findByRole("dialog", { name: "消息历史" });
}

async function changeRetention(user: ReturnType<typeof userEvent.setup>, days: string) {
  const input = screen.getByRole("spinbutton", { name: /保留天数/ });
  await user.clear(input);
  await user.type(input, days);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchCatalog.mockResolvedValue(catalog);
  api.fetchJob.mockResolvedValue({
    job_id: "job-1",
    dataset_id: "message_history",
    status: "queued",
    deleted_rows: 0,
    freed_bytes: 0,
  });
  api.preview.mockResolvedValue(preview);
  api.save.mockResolvedValue({ policies: {} });
  api.start.mockResolvedValue({ job_id: "job-1" });
});

afterEach(() => cleanup());

describe("DatabaseLifecyclePanel", () => {
  it("previews the edited draft without saving it", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openPolicy(user);
    await changeRetention(user, "45");

    await user.click(screen.getByRole("button", { name: "预估影响" }));

    await waitFor(() => expect(api.preview).toHaveBeenCalledWith("message_history", {
      enabled: true,
      retention_days: 45,
      max_bytes: null,
    }));
    expect(api.save).not.toHaveBeenCalled();
  });

  it("still saves the edited policy when explicitly requested", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openPolicy(user);
    await changeRetention(user, "45");

    await user.click(screen.getByRole("button", { name: "保存策略" }));

    await waitFor(() => expect(api.save).toHaveBeenCalledWith({
      message_history: { enabled: true, retention_days: 45, max_bytes: null },
    }));
    expect(api.toast).toHaveBeenCalledWith("生命周期策略已保存", "ok");
  });

  it("shows a preview failure", async () => {
    const user = userEvent.setup();
    api.preview.mockRejectedValue(new Error("预估失败 fixture"));
    renderPanel();
    await openPolicy(user);

    await user.click(screen.getByRole("button", { name: "预估影响" }));

    expect(await screen.findByText("预估失败 fixture")).toBeTruthy();
    expect(api.save).not.toHaveBeenCalled();
  });

  it("shows a start failure inside the confirmation dialog", async () => {
    const user = userEvent.setup();
    api.start.mockRejectedValue(new Error("启动失败 fixture"));
    renderPanel();
    await openPolicy(user);
    await user.click(screen.getByRole("button", { name: "预估影响" }));
    const confirm = await screen.findByRole("alertdialog");

    await user.click(within(confirm).getByRole("button", { name: "开始维护" }));

    expect(await within(confirm).findByText("启动失败 fixture")).toBeTruthy();
    expect(api.start).toHaveBeenCalledWith("message_history", {
      enabled: true,
      retention_days: 30,
      max_bytes: null,
    }, "preview-token");
  });

  it("keeps save failures visible without rejecting the button callback", async () => {
    const user = userEvent.setup();
    api.save.mockRejectedValue(new Error("保存失败 fixture"));
    renderPanel();
    await openPolicy(user);

    await user.click(screen.getByRole("button", { name: "保存策略" }));

    expect(await screen.findByText("保存失败 fixture")).toBeTruthy();
    expect(api.toast).toHaveBeenCalledWith("保存失败 fixture", "err");
  });

  it("locks policy inputs while previewing an in-flight draft", async () => {
    const user = userEvent.setup();
    let resolvePreview!: (value: typeof preview) => void;
    api.preview.mockImplementation(() => new Promise((resolve) => { resolvePreview = resolve; }));
    renderPanel();
    await openPolicy(user);
    await changeRetention(user, "45");

    await user.click(screen.getByRole("button", { name: "预估影响" }));

    await waitFor(() => expect(api.preview).toHaveBeenCalled());
    expect((screen.getByRole("spinbutton", { name: /保留天数/ }) as HTMLInputElement).disabled).toBe(true);
    await act(async () => {
      resolvePreview(preview);
      await Promise.resolve();
    });
  });
});
