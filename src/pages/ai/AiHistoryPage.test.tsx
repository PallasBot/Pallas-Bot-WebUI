// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  fetchLlmRepeaterFeedback,
  fetchLlmBehaviorPatterns,
} = vi.hoisted(() => ({
  fetchLlmHistorySessions: vi.fn(),
  fetchLlmHistorySession: vi.fn().mockResolvedValue({ turns: [], behavior_runs: [], feedback_entries: [] }),
  fetchConversationKernelStatus: vi.fn().mockResolvedValue({}),
  fetchLlmRepeaterFeedback: vi.fn().mockResolvedValue({ items: [] }),
  fetchLlmBehaviorPatterns: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock("@/api/fullConsole", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/fullConsole")>()),
  fetchLlmHistorySessions,
  fetchLlmHistorySession,
  fetchConversationKernelStatus,
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

describe("AiHistoryPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the session list given sessions", async () => {
    renderPage([
      { session_key: "bot-1", bot_id: 10001, group_id: 20002, user_id: 30001, turn_count: 1 },
    ]);
    expect(await screen.findByTitle(/用户 30001/)).toBeTruthy();
  });
});
