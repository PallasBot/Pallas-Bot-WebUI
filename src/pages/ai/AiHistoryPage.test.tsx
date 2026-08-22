// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiHistoryPage from "./AiHistoryPage";
import { AiObservationChromeProvider } from "@/components/ai/AiObservationChromeContext";
import {
  AiObservationScopeProvider,
} from "@/components/ai/AiObservationScopeContext";

const {
  fetchLlmHistorySessions,
  fetchLlmHistorySession,
  fetchConversationKernelStatus,
  fetchLlmPromotionCandidates,
  fetchLlmRepeaterFeedback,
  fetchLlmBehaviorPatterns,
} = vi.hoisted(() => ({
  fetchLlmHistorySessions: vi.fn(),
  fetchLlmHistorySession: vi.fn().mockResolvedValue({ turns: [], behavior_runs: [], feedback_entries: [] }),
  fetchConversationKernelStatus: vi.fn().mockResolvedValue({}),
  fetchLlmPromotionCandidates: vi.fn().mockResolvedValue({ items: [] }),
  fetchLlmRepeaterFeedback: vi.fn().mockResolvedValue({ items: [] }),
  fetchLlmBehaviorPatterns: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchLlmHistorySessions,
  fetchLlmHistorySession,
  fetchConversationKernelStatus,
  fetchLlmPromotionCandidates,
  fetchLlmRepeaterFeedback,
  fetchLlmBehaviorPatterns,
}));

function renderPage(sessions: object[], search = "?bot=10001&group=20002") {
  fetchLlmHistorySessions.mockResolvedValueOnce({ items: sessions });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/ai/history${search}`]}>
        <AiObservationScopeProvider>
          <AiObservationChromeProvider>
            <AiHistoryPage />
          </AiObservationChromeProvider>
        </AiObservationScopeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("AiHistoryPage promotion candidates", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not reuse candidates when sessions in one group belong to different Bots", async () => {
    const user = userEvent.setup();
    renderPage([
      { session_key: "bot-1", bot_id: 10001, group_id: 20002, user_id: 30001, turn_count: 1 },
      { session_key: "bot-2", bot_id: 10002, group_id: 20002, user_id: 30002, turn_count: 1 },
    ]);

    await user.click(await screen.findByTitle(/用户 30001/));
    await user.click(await screen.findByRole("tab", { name: "入库" }));
    await waitFor(() => expect(fetchLlmPromotionCandidates).toHaveBeenCalledWith({
      botId: 10001,
      groupId: 20002,
      includeResolved: false,
      limit: 40,
    }));

    await user.click(screen.getByTitle(/用户 30002/));
    await user.click(screen.getByRole("tab", { name: "入库" }));
    await waitFor(() => expect(fetchLlmPromotionCandidates).toHaveBeenCalledWith({
      botId: 10002,
      groupId: 20002,
      includeResolved: false,
      limit: 40,
    }));
    expect(fetchLlmPromotionCandidates).toHaveBeenCalledTimes(2);
  });

  it("does not request candidates when the selected session has no Bot", async () => {
    const user = userEvent.setup();
    renderPage([{ session_key: "missing-bot", bot_id: null, group_id: 20002, user_id: 30001, turn_count: 1 }], "?group=20002");

    await user.click(await screen.findByTitle(/用户 30001/));
    await user.click(await screen.findByRole("tab", { name: "入库" }));

    expect(fetchLlmPromotionCandidates).not.toHaveBeenCalled();
  });
});
