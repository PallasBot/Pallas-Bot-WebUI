// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchGroupStyleGovernance = vi
  .fn()
  .mockResolvedValue({ collection_enabled: true, injection_enabled: true });
const fetchLlmRepeaterSemanticStyle = vi.fn().mockResolvedValue({
  enabled: true,
  collection_enabled: true,
  injection_enabled: true,
  direct_enabled: true,
  example_count: 3,
  profile_count: 2,
});
const fetchLlmStickerLabelOverview = vi.fn().mockResolvedValue({
  labels: { total: 10, sticker: 5, not_sticker: 5, low_confidence: 2, current_version: 3 },
  jobs: { pending: 1, failed: 0 },
  lazy_labels_paused: false,
  label_circuit_open: false,
  vlm_refine_avoided: 4,
  vlm_refine_actual: 3,
  send_hits: 2,
});
const postGroupStyleGovernanceManage = vi.fn().mockResolvedValue({});
const postLlmRepeaterSemanticStyleManage = vi.fn().mockResolvedValue({
  enabled: true,
  collection_enabled: true,
  injection_enabled: true,
  example_count: 3,
  profile_count: 2,
});
const postLlmStickerLabelManage = vi.fn().mockResolvedValue({});
const fetchLlmPersonaGroupStyle = vi.fn().mockResolvedValue({
  aggregate: {
    sample_count: 10,
    window_hours: 24,
    message_count: 100,
    answer_count: 40,
    distinct_answer_keywords: 5,
    active_hour_count: 8,
    messages_per_active_hour: 12.5,
    message_length: { p50: 30, p90: 80 },
    answer_ratio: 0.4,
    repetition_rate: 0.1,
    forced_teach_weight: 0.5,
    contamination_skipped_messages: 0,
    contamination_skipped_answers: 0,
  },
  reply_shape: {
    length_pref: "medium",
    bubble_count_p50: 1,
    bubble_count_p90: 3,
    segment_char_length_p50: 50,
    segment_char_length_p90: 120,
    rhythm_distribution: { fast: 2 },
  },
  examples_summary: {
    profile_ref: "p",
    scene: "banter",
    sample_count: 5,
    direct_example_count: 2,
    direct_pair_count: 1,
    rewrite_seed_count: 3,
    intensity_counts: { low: 1 },
    form_counts: { question: 2 },
  },
  updated_at: "2026-01-01",
});
const fetchLlmPersonaSemanticStyleExamples = vi.fn().mockResolvedValue({
  total: 1,
  items: [{
    example_id: "42:100:7",
    created_at: 100,
    pair_relation: "quoted",
    trigger_text: "前句",
    reply_text: "接话",
    learning_type: "observed",
    label: {
      interaction_actions: ["接住"],
      semantic_relations: ["回应"],
      intensity: "soft",
      forms: ["短句"],
    },
    behavior_strategy: {
      scene: "轻松闲聊",
      action: "接住前句",
      outcome: "保持互动",
      learning_type: "observed",
      count: 1,
    },
  }],
});
const fetchLlmPersonaExport = vi.fn().mockResolvedValue({});
const fetchSceneDialogueExamples = vi.fn().mockResolvedValue({ items: [], count: 0 });
const postSceneDialogueExample = vi.fn().mockResolvedValue({});
const putSceneDialogueExample = vi.fn().mockResolvedValue({});
const deleteSceneDialogueExample = vi.fn().mockResolvedValue({ id: "example-1" });

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchGroupStyleGovernance,
  fetchLlmRepeaterSemanticStyle,
  fetchLlmStickerLabelOverview,
  postGroupStyleGovernanceManage,
  postLlmRepeaterSemanticStyleManage,
  postLlmStickerLabelManage,
}));
vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchLlmPersonaGroupStyle,
  fetchLlmPersonaSemanticStyleExamples,
  fetchLlmPersonaExport,
  fetchSceneDialogueExamples,
  postSceneDialogueExample,
  putSceneDialogueExample,
  deleteSceneDialogueExample,
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

const fullScope = "/ai/governance?bot=10001&group=20002&scene=group_chat&tab=style";
const botOnlyScope = "/ai/governance?bot=10001&scene=group_chat&tab=style";

describe("GovernanceStyleTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps group cards hidden and global cards available when only a Bot is set", async () => {
    renderRoute(botOnlyScope);

    expect(await screen.findByText("请在顶部选择群号，以查看群级风格与语义。", {}, { timeout: 5000 })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "全局表情标签" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "场景正反例" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "人设导出" })).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "群风格" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "语义风格" })).toBeNull();

    expect(fetchGroupStyleGovernance).not.toHaveBeenCalled();
    expect(fetchLlmRepeaterSemanticStyle).not.toHaveBeenCalled();
    expect(fetchLlmPersonaGroupStyle).not.toHaveBeenCalled();
  });

  it("requests global data as soon as a Bot is ready in a Bot-only scope", async () => {
    const user = userEvent.setup();
    renderRoute(botOnlyScope);

    await screen.findByText("请在顶部选择群号，以查看群级风格与语义。");
    expect(fetchLlmStickerLabelOverview).toHaveBeenCalledTimes(1);
    expect(fetchSceneDialogueExamples).toHaveBeenCalledWith(10001);
    expect(fetchLlmPersonaExport).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "展开人设导出" }));
    await waitFor(() => expect(fetchLlmPersonaExport).toHaveBeenCalledWith({ botId: 10001, groupId: null, plainText: undefined }));
  });

  it("toggles direct_enabled through the semantic manage action", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("checkbox", { name: "直给倾向" }));

    await waitFor(() => expect(postLlmRepeaterSemanticStyleManage).toHaveBeenCalledWith({
      action: "direct_enabled",
      directEnabled: false,
      botId: 10001,
      groupId: 20002,
      scene: "group_chat",
    }));
  });

  it("renders the production semantic style examples for a group scope", async () => {
    renderRoute(fullScope);

    expect((await screen.findAllByText("前句")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("接话").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("引用接话")).not.toBeNull();
    expect(fetchLlmPersonaSemanticStyleExamples).toHaveBeenCalledWith({
      botId: 10001,
      groupId: 20002,
      scene: "group_chat",
      limit: 20,
    });
  });

  it("runs the quality action and renders the quality view", async () => {
    postLlmRepeaterSemanticStyleManage.mockResolvedValueOnce({
      status: {
        enabled: true,
        collection_enabled: true,
        injection_enabled: true,
        example_count: 3,
        profile_count: 2,
      },
      label_version: 5,
      positive_bot_style_count: 1,
    });
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("button", { name: "更多操作" }));
    await user.click(await screen.findByRole("menuitem", { name: "质量评价" }));

    await waitFor(() => expect(postLlmRepeaterSemanticStyleManage).toHaveBeenCalledWith({
      action: "quality",
      botId: 10001,
      groupId: 20002,
      scene: "group_chat",
    }));
    const qualityBlock = (await screen.findByText("质量评价结果")).parentElement?.parentElement;
    expect(qualityBlock).not.toBeNull();
    const exampleKv = (await within(qualityBlock ?? document.body).findByText("样例 / 画像")).closest("div");
    expect(exampleKv?.textContent ?? "").toContain("3 / 2");
    const versionKv = (await within(qualityBlock ?? document.body).findByText("标签版本")).closest("div");
    expect(versionKv?.textContent ?? "").toContain("5");
  });

  it("requires confirmation before clearing semantic style", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    const clearButtons = await screen.findAllByRole("button", { name: "清空数据…" });
    await user.click(clearButtons[1]);

    expect(postLlmRepeaterSemanticStyleManage).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("清空语义风格")).not.toBeNull();
    expect(within(dialog).getByText(/此操作不能恢复/)).not.toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "清空并继续学习" }));

    await waitFor(() => expect(postLlmRepeaterSemanticStyleManage).toHaveBeenCalledWith({
      action: "clear",
      botId: 10001,
      groupId: 20002,
      scene: "group_chat",
      continueLearning: true,
    }));
  });

  it("submits sticker label requeue and pause actions", async () => {
    const user = userEvent.setup();
    renderRoute(botOnlyScope);

    await user.click(await screen.findByRole("button", { name: "重排陈旧标签" }));
    await waitFor(() => expect(postLlmStickerLabelManage).toHaveBeenLastCalledWith(
      { action: "requeue" },
      expect.anything(),
    ));

    await user.click(await screen.findByRole("button", { name: "暂停懒标注" }));
    await waitFor(() => expect(postLlmStickerLabelManage).toHaveBeenLastCalledWith(
      { action: "pause", paused: true },
      expect.anything(),
    ));
  });

  it("sends the group id with persona export when a group is selected", async () => {
    const user = userEvent.setup();
    renderRoute(fullScope);

    await user.click(await screen.findByRole("button", { name: "展开人设导出" }));
    await waitFor(() => expect(fetchLlmPersonaExport).toHaveBeenCalledWith({
      botId: 10001,
      groupId: 20002,
      plainText: undefined,
    }));
  });

  it("keeps actual semantic samples visible when the group profile fails", async () => {
    fetchLlmPersonaGroupStyle.mockRejectedValueOnce(new Error("group profile unavailable"));
    renderRoute(fullScope);

    expect(await screen.findByText("实际语义样本")).not.toBeNull();
    expect((await screen.findAllByText("前句")).length).toBeGreaterThan(1);
    expect((await screen.findAllByText("接话")).length).toBeGreaterThan(1);
  });
});
