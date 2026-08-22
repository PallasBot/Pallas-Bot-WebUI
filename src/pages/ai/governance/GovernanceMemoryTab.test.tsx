// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const fetchMemoryGraphStats = vi.fn().mockResolvedValue({
  episode_count: 5,
  entity_count: 3,
  speaker_entity_count: 1,
  active_edge_count: 2,
  edge_count: 3,
  category_count: 2,
  scope_keys: ["bot_10001_group_20002"],
  scope_key: "bot_10001_group_20002",
});
const fetchMemoryGraph = vi.fn().mockResolvedValue({
  nodes: [],
  edges: [],
  total_nodes: 0,
  total_edges: 0,
  scope_key: "bot_10001_group_20002",
});
const fetchMemoryGraphEpisodes = vi.fn().mockResolvedValue({ items: [] });
const fetchMemoryGraphEntities = vi
  .fn()
  .mockResolvedValue({ items: [{ id: "e1", name: "老周", kind: "person", is_speaker: true }] });
const fetchMemoryGraphEdges = vi.fn().mockResolvedValue({ items: [] });
const fetchMemoryGraphScopes = vi.fn().mockResolvedValue({ items: [] });
const fetchMemoryGraphCategories = vi.fn().mockResolvedValue({ items: [], total: 0 });
const fetchMemoryGraphHierStatus = vi.fn().mockResolvedValue({
  max_layer: 2,
  last_rebuild_at: 1700000000,
  group_summary: "群摘要",
  entity_count_at_rebuild: 1,
});
const fetchMemoryGraphTrash = vi.fn().mockResolvedValue({ entities: [], edges: [], categories: [] });
const postMemoryGraphExtract = vi.fn().mockResolvedValue({ entities_upserted: 1, edges_upserted: 0, episodes: 0 });
const postMemoryGraphHierRebuild = vi.fn().mockResolvedValue({ max_layer: 2, categories: 1 });
const postMemoryGraphCategory = vi.fn().mockResolvedValue({});
const postMemoryGraphCategoryDelete = vi.fn().mockResolvedValue({});
const postMemoryGraphEntity = vi.fn().mockResolvedValue({});
const postMemoryGraphEntityDelete = vi.fn().mockResolvedValue({});
const postMemoryGraphEdge = vi.fn().mockResolvedValue({});
const postMemoryGraphEdgeDelete = vi.fn().mockResolvedValue({});
const postMemoryGraphEdgeRestore = vi.fn().mockResolvedValue({});
const postMemoryGraphSearch = vi.fn().mockResolvedValue({ query: "", episodes: [], entities: [], edges: [], count: 0 });
const postMemoryGraphTrashRestore = vi.fn().mockResolvedValue({});
const postMemoryGraphTrashPurge = vi.fn().mockResolvedValue({});
const postMemoryGraphImport = vi.fn().mockResolvedValue({ entities_upserted: 1, edges_upserted: 0, categories_upserted: 0 });
const postMemoryGraphClear = vi.fn().mockResolvedValue({ entities: 0, edges: 0, categories: 0 });
const fetchMemoryGraphExport = vi.fn().mockResolvedValue({ nodes: [], edges: [] });
const postConversationKernelMemory = vi.fn().mockResolvedValue({});
const postConversationKernelMemoryDelete = vi.fn().mockResolvedValue({});
const postConversationKernelMemoryClear = vi.fn().mockResolvedValue({ deleted: 2 });
const postConversationKernelMemoryLifecycle = vi.fn().mockResolvedValue({});
const postConversationKernelMemoryPreference = vi.fn().mockResolvedValue({});
const fetchConversationKernelMemoryPreferences = vi.fn().mockResolvedValue({ items: [] });
const fetchConversationKernelMidTerm = vi.fn().mockResolvedValue({ items: [] });

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchConversationKernelMemoryPreferences,
  fetchConversationKernelMidTerm,
  postConversationKernelMemory,
  postConversationKernelMemoryClear,
  postConversationKernelMemoryDelete,
  postConversationKernelMemoryLifecycle,
  postConversationKernelMemoryPreference,
}));
vi.mock("@/api/memoryGraphApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/memoryGraphApi")>()),
  fetchMemoryGraph,
  fetchMemoryGraphCategories,
  fetchMemoryGraphEdges,
  fetchMemoryGraphEntities,
  fetchMemoryGraphEpisodes,
  fetchMemoryGraphExport,
  fetchMemoryGraphHierStatus,
  fetchMemoryGraphScopes,
  fetchMemoryGraphStats,
  fetchMemoryGraphTrash,
  postMemoryGraphCategory,
  postMemoryGraphCategoryDelete,
  postMemoryGraphClear,
  postMemoryGraphEdge,
  postMemoryGraphEdgeDelete,
  postMemoryGraphEdgeRestore,
  postMemoryGraphEntity,
  postMemoryGraphEntityDelete,
  postMemoryGraphExtract,
  postMemoryGraphHierRebuild,
  postMemoryGraphImport,
  postMemoryGraphSearch,
  postMemoryGraphTrashPurge,
  postMemoryGraphTrashRestore,
}));
vi.mock("@/components/ai/MemoryForceGraph", () => ({
  default: () => <div data-testid="memory-force-graph" />,
}));
vi.mock("@/components/ConsoleSetupGuard", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/layout/AppShell", () => ({ default: () => <Outlet /> }));
vi.mock("@/pages/ai/AiObservationLayout", () => ({
  default: () => (
    <>
      <button role="tab">统计</button>
      <Outlet />
    </>
  ),
}));
vi.mock("@/components/ai/AiGovernanceScopeFields", () => ({ default: () => <div /> }));

beforeAll(() => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
});

const App = lazy(() => import("@/App"));

function renderRoute(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

const fullScope = "/ai/governance?bot=10001&group=20002&scene=group_chat&tab=memory";
const botOnlyScope = "/ai/governance?bot=10001&scene=group_chat&tab=memory";

describe("GovernanceMemoryTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for a Bot before rendering memory controls", async () => {
    renderRoute("/ai/governance?scene=group_chat&tab=memory");

    expect(await screen.findByText("请先选择 Bot QQ。", {}, { timeout: 5000 })).not.toBeNull();
    expect(fetchMemoryGraphStats).not.toHaveBeenCalled();
  });

  it("uses global scope when only Bot is selected", async () => {
    renderRoute(botOnlyScope);

    expect(await screen.findByText("未指定群号时默认使用全局作用域。")).not.toBeNull();
    await waitFor(() =>
      expect(fetchMemoryGraphStats).toHaveBeenCalledWith({ botId: 10001, groupId: null }),
    );
  });

  it("loads overview stats for the scoped group", async () => {
    renderRoute(fullScope);

    expect(await screen.findByRole("heading", { name: "记忆条目" })).not.toBeNull();
    expect(await screen.findByRole("heading", { name: "实体" })).not.toBeNull();
    await waitFor(() =>
      expect(fetchMemoryGraphStats).toHaveBeenCalledWith({ botId: 10001, groupId: 20002 }),
    );
    expect(await screen.findByTestId("memory-force-graph")).not.toBeNull();
  });

  it("writes a memory episode and clears the draft", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("tab", { name: "条目" }));
    await waitFor(() =>
      expect(fetchMemoryGraphEpisodes).toHaveBeenCalledWith({
        botId: 10001,
        groupId: 20002,
        query: "",
        limit: 50,
      }),
    );

    await user.type(screen.getByPlaceholderText("新建群内旧事…"), "大家常在周末约饭");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(postConversationKernelMemory).toHaveBeenCalledWith(
        {
          botId: 10001,
          groupId: 20002,
          content: "大家常在周末约饭",
        },
        expect.anything(),
      ),
    );
  });

  it("adds and deletes an entity", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("tab", { name: "实体" }));
    expect(await screen.findByText("老周")).not.toBeNull();

    await user.type(screen.getByPlaceholderText("实体名称"), "奶茶店");
    await user.click(screen.getByRole("button", { name: "添加" }));
    await waitFor(() =>
      expect(postMemoryGraphEntity).toHaveBeenCalledWith(
        {
          botId: 10001,
          groupId: 20002,
          name: "奶茶店",
        },
        expect.anything(),
      ),
    );

    await user.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() =>
      expect(postMemoryGraphEntityDelete).toHaveBeenCalledWith(
        { id: "e1", botId: 10001 },
        expect.anything(),
      ),
    );
  });

  it("requires confirmation before purging an entity from trash", async () => {
    fetchMemoryGraphTrash.mockResolvedValueOnce({
      entities: [{ id: "e1", name: "废弃实体" }],
      edges: [],
      categories: [],
    });
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("tab", { name: "回收站" }));
    expect(await screen.findByText("废弃实体")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "彻底删除" }));
    expect(postMemoryGraphTrashPurge).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("此操作不可恢复。")).not.toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "彻底删除" }));

    await waitFor(() =>
      expect(postMemoryGraphTrashPurge).toHaveBeenCalledWith(
        { kind: "entity", id: "e1", botId: 10001 },
        expect.anything(),
      ),
    );
  });

  it("adds a preference rule (polarity dont)", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("tab", { name: "偏好" }));
    await waitFor(() =>
      expect(fetchConversationKernelMemoryPreferences).toHaveBeenCalledWith({
        botId: 10001,
        groupId: 20002,
      }),
    );

    await user.type(screen.getByPlaceholderText("例如：少提考试"), "少提考试");
    await user.click(screen.getByRole("button", { name: "添加偏好" }));
    await waitFor(() =>
      expect(postConversationKernelMemoryPreference).toHaveBeenCalledWith(
        {
          botId: 10001,
          groupId: 20002,
          rule: "少提考试",
          polarity: "dont",
        },
        expect.anything(),
      ),
    );
  });
});