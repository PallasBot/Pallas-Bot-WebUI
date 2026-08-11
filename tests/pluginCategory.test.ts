import { describe, expect, it } from "vitest";
import { PLUGIN_LIST_CATEGORY_TABS, pluginCategory } from "../src/utils/pluginCategory";
import type { PluginRow } from "../src/api/pallasTypes";

describe("plugin catalog categories", () => {
  it("exposes official, community, NoneBot, and local filters", () => {
    expect(PLUGIN_LIST_CATEGORY_TABS.map((item) => item.id)).toEqual([
      "all",
      "core",
      "official",
      "community",
      "nonebot",
      "local",
    ]);
  });

  it("uses the catalog source before fallback official metadata", () => {
    expect(pluginCategory({ name: "maa", plugin_source: "official" } as PluginRow)).toBe("official");
    expect(pluginCategory({ name: "demo", plugin_source: "community" } as PluginRow)).toBe("community");
    expect(pluginCategory({ name: "timer", plugin_source: "nonebot" } as PluginRow)).toBe("nonebot");
  });
});
