import { describe, expect, it } from "vitest";
import type { PluginRow } from "../src/api/pallasTypes";
import { matcherPluginDisplayName } from "../src/utils/pluginDisplayLabel";

describe("matcherPluginDisplayName", () => {
  it("uses metadata Chinese name when plugin row matches module key", () => {
    const rows = [
      {
        name: "bot_status",
        resolved_plugin_id: "bot_status",
        module: "pallas_plugin_bot_status",
        metadata: { name: "牛牛状态" },
      },
    ] as PluginRow[];
    expect(matcherPluginDisplayName("pallas_plugin_bot_status", rows)).toBe("牛牛状态");
  });

  it("falls back to official extension title for known modules", () => {
    expect(matcherPluginDisplayName("pallas_plugin_bot_status", [])).toBe("牛牛状态");
    expect(matcherPluginDisplayName("pallas_plugin_duel", null)).toBe("牛牛决斗");
    expect(matcherPluginDisplayName("pallas_plugin_sing", undefined)).toBe("牛牛唱歌");
    expect(matcherPluginDisplayName("pallas_plugin_maa_hub", [])).toBe("MAA 远控");
  });

  it("keeps unknown keys as-is", () => {
    expect(matcherPluginDisplayName("some_custom_plugin", [])).toBe("some_custom_plugin");
  });
});
