// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense, type ReactNode } from "react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
});

const apiMocks = vi.hoisted(() => ({
  fetchAgentPersonFacts: vi.fn(),
  saveAgentPersonFact: vi.fn(),
  fetchAgentCatchphrases: vi.fn(),
  resolveAgentCatchphrase: vi.fn(),
  fetchFriendList: vi.fn(),
  fetchConversationKernelRelationshipNotes: vi.fn(),
  postConversationKernelRelationshipNoteSetContent: vi.fn(),
  postConversationKernelRelationshipNoteSetAffinity: vi.fn(),
  postConversationKernelRelationshipNoteDelete: vi.fn(),
}));

vi.mock("@/api/agentPlatformApi", () => apiMocks);
vi.mock("@/api/console", () => apiMocks);
vi.mock("@/components/ConsoleSetupGuard", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/layout/AppShell", () => ({ default: () => <Outlet /> }));
vi.mock("@/pages/ai/AiObservationLayout", () => ({
  default: () => <main>观测占位</main>,
}));
vi.mock("@/components/ai/AiGovernanceScopeFields", () => ({ default: () => <div /> }));

const App = lazy(() => import("@/App"));

function renderRoute(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[entry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

const fullScope = "/ai/governance?bot=10001&group=20002&scene=group_chat&tab=people";
const botOnlyScope = "/ai/governance?bot=10001&scene=group_chat&tab=people";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GovernancePeopleTab", () => {
  it("hides group-scoped sections and skips group queries when no group selected", async () => {
    renderRoute(botOnlyScope);

    await screen.findByText("请在顶部选择群号，以查看群内人物资料。", {}, { timeout: 5000 });
    expect(apiMocks.fetchAgentPersonFacts).not.toHaveBeenCalled();
    expect(apiMocks.fetchConversationKernelRelationshipNotes).not.toHaveBeenCalled();
  });

  it("loads person facts with current bot and group", async () => {
    apiMocks.fetchAgentPersonFacts.mockResolvedValue({
      items: [{ fact_id: "f1", content: "叫小明", user_id: 90001, scope: "group", status: "active" }],
      count: 1,
    });
    apiMocks.fetchFriendList.mockResolvedValue({ friends: [{ user_id: 90001, nickname: "友人" }] });

    renderRoute(fullScope);

    expect(await screen.findByText("叫小明")).not.toBeNull();
    expect(apiMocks.fetchAgentPersonFacts).toHaveBeenCalledWith({ botId: 10001, groupId: 20002 });
  });

  it("hides the save button when no bot selected", async () => {
    renderRoute("/ai/governance?scene=group_chat&tab=people");
    await screen.findByText("请先选择 Bot QQ。");
    expect(apiMocks.fetchAgentPersonFacts).not.toHaveBeenCalled();
  });

  it("saves a person fact via the write form with validation", async () => {
    apiMocks.fetchAgentPersonFacts.mockResolvedValue({ items: [], count: 0 });
    apiMocks.fetchFriendList.mockResolvedValue({ friends: [] });
    apiMocks.saveAgentPersonFact.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    renderRoute(fullScope);

    await screen.findByText("还没有人物事实。");
    await user.click(screen.getByRole("combobox", { name: "用户 QQ" }));
    const searchInput = await screen.findByPlaceholderText("搜索好友昵称 / QQ…");
    await user.type(searchInput, "90003{Enter}");
    const contentInput = await screen.findByPlaceholderText("例如：希望被叫作小明");
    await user.type(contentInput, "喜欢被叫大佬");
    await user.click(screen.getByRole("button", { name: "写入" }));

    await waitFor(() => {
      expect(apiMocks.saveAgentPersonFact).toHaveBeenCalledWith({
        botId: 10001,
        groupId: 20002,
        userId: 90003,
        content: "喜欢被叫大佬",
      });
    });
  });

  it("does not show the disconnected observations queue", async () => {
    renderRoute(fullScope);

    expect(await screen.findByText("人物事实")).not.toBeNull();
    expect(screen.queryByText("待整理观察")).toBeNull();
  });

  it("renders relationship notes with editing, affinity save and delete", async () => {
    apiMocks.fetchConversationKernelRelationshipNotes.mockResolvedValue({
      items: [{ id: 1, user_id: 90001, content: "老朋友", affinity: 0.6 }],
    });
    apiMocks.postConversationKernelRelationshipNoteSetAffinity.mockResolvedValue({ affinity: 0.6 });
    apiMocks.postConversationKernelRelationshipNoteDelete.mockResolvedValue({ id: 1 });
    const user = userEvent.setup();

    renderRoute(fullScope);

    expect(await screen.findByText("老朋友")).not.toBeNull();
    expect(screen.getByText("朋友")).not.toBeNull();

    const affinityInput = screen.getByRole("spinbutton", { name: "" });
    await user.type(affinityInput, "0.8");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(apiMocks.postConversationKernelRelationshipNoteSetAffinity).toHaveBeenCalled();
    });

    await user.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(apiMocks.postConversationKernelRelationshipNoteDelete).toHaveBeenCalledWith({
        id: 1,
        botId: 10001,
      });
    });
    expect(apiMocks.postConversationKernelRelationshipNoteSetContent).not.toHaveBeenCalled();
  });

  it("filters candidate catchphrases and approves/rejects", async () => {
    apiMocks.fetchAgentCatchphrases.mockResolvedValue({
      items: [{ entry_id: "c1", saying: "主打一个真诚", status: "candidate", support: 3, groups_seen: [1] }],
      count: 1,
      total: 1,
      counts: { candidate: 1, active: 0, all: 1 },
    });
    apiMocks.resolveAgentCatchphrase.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    renderRoute(fullScope);

    expect(await screen.findByText("主打一个真诚")).not.toBeNull();
    expect(screen.getByText("待审 1")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "通过" }));
    await waitFor(() => {
      expect(apiMocks.resolveAgentCatchphrase).toHaveBeenCalledWith("c1", "approve");
    });

    await user.click(screen.getByRole("button", { name: "驳回" }));
    await waitFor(() => {
      expect(apiMocks.resolveAgentCatchphrase).toHaveBeenCalledWith("c1", "reject");
    });
  });

  it("shows working catchphrase with 停用 in active filter", async () => {
    apiMocks.fetchAgentCatchphrases.mockResolvedValue({
      items: [{ entry_id: "a1", saying: "稳了", status: "active", support: 8, groups_seen: [1, 2] }],
      count: 1,
      total: 1,
      counts: { candidate: 0, active: 1, all: 1 },
    });
    const user = userEvent.setup();

    renderRoute(fullScope);

    await user.click(await screen.findByRole("button", { name: "已启用 1" }));

    expect(await screen.findByText("稳了")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "停用" }));
    await waitFor(() => {
      expect(apiMocks.resolveAgentCatchphrase).toHaveBeenCalledWith("a1", "reject");
    });
  });
});
