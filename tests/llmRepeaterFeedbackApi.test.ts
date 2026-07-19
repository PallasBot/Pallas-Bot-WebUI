import { describe, expect, it, vi } from "vitest";

vi.mock("../src/api/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("fetchLlmRepeaterFeedback", async () => {
  it("loads recent feedback entries for a group", async () => {
    const { http } = await import("../src/api/http");
    const { fetchLlmRepeaterFeedback } = await import("../src/api/consoleApi");
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ok: true,
        data: {
          items: [
            {
              request_id: "req-1",
              group_id: 123,
              user_text: "摸摸",
              reply_text: "摸摸。",
            },
          ],
          limit: 20,
        },
      },
    } as never);

    await expect(fetchLlmRepeaterFeedback({ groupId: 123, limit: 20 })).resolves.toEqual({
      items: [
        {
          request_id: "req-1",
          group_id: 123,
          user_text: "摸摸",
          reply_text: "摸摸。",
        },
      ],
      limit: 20,
    });
    expect(http.get).toHaveBeenCalledWith("/llm/repeater-feedback", {
      params: { group_id: 123, limit: 20 },
    });
  });
});

describe("fetchLlmRepeaterFeedbackSummary", async () => {
  it("loads summary snapshot for a group", async () => {
    const { http } = await import("../src/api/http");
    const { fetchLlmRepeaterFeedbackSummary } = await import("../src/api/consoleApi");
    vi.mocked(http.get).mockResolvedValue({
      data: {
        ok: true,
        data: {
          count: 3,
          top_replies: ["摸摸。", "好哦。"],
          scenes: ["smalltalk", "banter"],
        },
      },
    } as never);

    await expect(fetchLlmRepeaterFeedbackSummary({ groupId: 123, limit: 40 })).resolves.toEqual({
      count: 3,
      top_replies: ["摸摸。", "好哦。"],
      scenes: ["smalltalk", "banter"],
    });
    expect(http.get).toHaveBeenCalledWith("/llm/repeater-feedback/summary", {
      params: { group_id: 123, limit: 40 },
    });
  });
});
