import { describe, expect, it } from "vitest";

import { buildPersistenceHint } from "@/composables/useAiTaskStatsPage";

describe("buildPersistenceHint", () => {
  it("uses human friendly copy instead of exposing store file name", () => {
    const text = buildPersistenceHint({
      bot_collecting: true,
      ai_collecting: true,
      ai_reachable: true,
      store_file: "llm_daily_stats.json",
    });

    expect(text).toContain("按天自动保存");
    expect(text).toContain("服务重启后仍可查看");
    expect(text).not.toContain("llm_daily_stats.json");
    expect(text).not.toContain("落盘");
  });
});
