import { describe, expect, it } from "vitest";

import type { LlmTaskStatsHistoryRow } from "@/api/pallasTypes";
import {
  aggregateHistorySpeak,
  aggregateHistoryTools,
  botEventSum,
  speakFromBotSlice,
  speakTriggerTotal,
  toolsFromBotSlice,
  toolCallTotal,
} from "@/utils/aiTaskStats";

describe("botEventSum / speak / tools", () => {
  it("prefers totals when present", () => {
    const bot = {
      source: "bot",
      day_key: "2026-07-31",
      by_task: {
        llm_chat: { speak_mention: 1 },
      },
      totals: { speak_mention: 9 },
    };
    expect(botEventSum(bot, "speak_mention")).toBe(9);
  });

  it("falls back to by_task when totals omit the key", () => {
    const bot = {
      source: "bot",
      day_key: "2026-07-31",
      by_task: {
        llm_chat: { speak_ambient: 3, tool_call_ok: 2 },
        other: { tool_call_ok: 1 },
      },
      totals: {},
    };
    expect(botEventSum(bot, "speak_ambient")).toBe(3);
    expect(botEventSum(bot, "tool_call_ok")).toBe(3);
  });

  it("aggregates speak and tools across history rows", () => {
    const rows: LlmTaskStatsHistoryRow[] = [
      {
        date: "2026-07-30",
        bot: {
          source: "bot",
          day_key: "2026-07-30",
          by_task: {},
          totals: {
            speak_mention: 2,
            speak_ambient: 1,
            speak_followup: 1,
            speak_skip: 4,
            tool_call_ok: 5,
            tool_call_fail: 1,
            tool_session_called: 3,
            tool_session_no_call: 2,
          },
        },
      },
      {
        date: "2026-07-31",
        bot: {
          source: "bot",
          day_key: "2026-07-31",
          by_task: {
            llm_chat: {
              speak_mention: 1,
              tool_call_ok: 2,
              tool_session_called: 1,
            },
          },
          totals: {},
        },
      },
    ];
    const speak = aggregateHistorySpeak(rows, "2026-07-30", "2026-07-31");
    expect(speak).toEqual({ mention: 3, ambient: 1, followup: 1, skip: 4 });
    expect(speakTriggerTotal(speak)).toBe(5);

    const tools = aggregateHistoryTools(rows, "2026-07-30", "2026-07-31");
    expect(tools).toEqual({
      callOk: 7,
      callFail: 1,
      sessionCalled: 4,
      sessionNoCall: 2,
    });
    expect(toolCallTotal(tools)).toBe(8);
  });

  it("reads speak/tools helpers from a live bot slice", () => {
    const bot = {
      source: "bot",
      day_key: "2026-07-31",
      by_task: {},
      totals: {
        speak_mention: 1,
        speak_skip: 2,
        tool_call_ok: 3,
        tool_session_no_call: 4,
      },
    };
    expect(speakFromBotSlice(bot)).toEqual({
      mention: 1,
      ambient: 0,
      followup: 0,
      skip: 2,
    });
    expect(toolsFromBotSlice(bot)).toEqual({
      callOk: 3,
      callFail: 0,
      sessionCalled: 0,
      sessionNoCall: 4,
    });
  });
});
