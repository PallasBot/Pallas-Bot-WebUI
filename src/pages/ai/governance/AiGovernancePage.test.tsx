// @vitest-environment jsdom
import { lazy, Suspense } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Outlet } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchLlmPromptPreview = vi.fn().mockResolvedValue({
  preview_mode: true,
  decision_source: "preview_default",
  system_prompt: "人格\n\n本轮策略",
  sections: [
    { id: "persona", title: "人设", source: "persona", active: true, content: "人格" },
    { id: "turn_policy", title: "本轮策略", source: "turn_policy", active: true, content: "本轮策略" },
    { id: "memory", title: "记忆", source: "memory", active: false, content: "" },
  ],
});
const fetchLlmPromptOverrides = vi.fn().mockResolvedValue({});
const saveLlmPromptOverrides = vi.fn().mockResolvedValue({});
const tryLlmPrompt = vi.fn().mockResolvedValue({
  text: "可以，周末一起玩。",
  model: "test-model",
  elapsed_ms: 321,
  test_call: true,
});

vi.mock("@/api/console", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/console")>()),
  fetchLlmPromptPreview,
  fetchLlmPromptOverrides,
  saveLlmPromptOverrides,
  tryLlmPrompt,
}));
vi.mock("@/components/ConsoleSetupGuard", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/layout/AppShell", () => ({ default: () => <Outlet /> }));
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

describe("AiGovernancePage route", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("defaults to the pipeline tab and exposes no reply profile tab", async () => {
    renderRoute("/ai/governance");

    expect(await screen.findByText("回复流水线", {}, { timeout: 5000 })).not.toBeNull();
    expect(screen.queryByRole("tab", { name: "回复画像" })).toBeNull();
  });

  it("builds a scoped prompt preview and removes only the local preview section", async () => {
    const user = userEvent.setup();
    renderRoute("/ai/governance?bot=10001&group=20002&scene=group_chat");

    await user.type(await screen.findByRole("textbox", { name: "用户 QQ" }), "90003");
    await user.type(screen.getByRole("textbox", { name: "模拟消息" }), "明天一起打游戏吗？");
    await user.click(screen.getByRole("button", { name: "刷新本轮上下文" }));

    await waitFor(() => expect(fetchLlmPromptPreview).toHaveBeenCalledWith({
      botId: 10001,
      groupId: 20002,
      userId: 90003,
      queryText: "明天一起打游戏吗？",
    }));
    expect(await screen.findByText("本轮 Prompt 组装")).not.toBeNull();
    expect(screen.getAllByText("人格").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "从预览移除人设" }));
    const result = document.querySelector(".ai-governance-prompt-result");
    expect(result?.textContent).not.toContain("人格");
    expect(result?.textContent).toContain("本轮策略");
  });

  it("saves an edited prompt section for the current bot and group", async () => {
    const user = userEvent.setup();
    renderRoute("/ai/governance?bot=10001&group=20002&scene=group_chat");

    await user.type(await screen.findByRole("textbox", { name: "用户 QQ" }), "90003");
    await user.type(screen.getByRole("textbox", { name: "模拟消息" }), "明天一起打游戏吗？");
    await user.click(screen.getByRole("button", { name: "刷新本轮上下文" }));

    const personaEditor = await screen.findByRole("textbox", { name: "人设覆盖内容" });
    await user.clear(personaEditor);
    await user.type(personaEditor, "新的群内人设");
    await user.click(screen.getByRole("button", { name: "保存人设覆盖" }));

    await waitFor(() => expect(saveLlmPromptOverrides).toHaveBeenCalledWith({
      botId: 10001,
      groupId: 20002,
      sections: { persona: { mode: "replace", content: "新的群内人设" } },
    }));
  });

  it("calls the model only after an explicit try-answer action", async () => {
    const user = userEvent.setup();
    renderRoute("/ai/governance?bot=10001&group=20002&scene=group_chat");

    await user.type(await screen.findByRole("textbox", { name: "用户 QQ" }), "90003");
    await user.type(screen.getByRole("textbox", { name: "模拟消息" }), "明天一起打游戏吗？");
    await user.click(screen.getByRole("button", { name: "刷新本轮上下文" }));
    await user.click(await screen.findByRole("button", { name: "调用模型试答" }));

    await waitFor(() => expect(tryLlmPrompt).toHaveBeenCalledWith(expect.objectContaining({
      botId: 10001,
      groupId: 20002,
      userId: 90003,
      queryText: "明天一起打游戏吗？",
    })));
    expect(await screen.findByText("可以，周末一起玩。")).not.toBeNull();
    expect(screen.getByText(/测试调用/)).not.toBeNull();
  });
});
