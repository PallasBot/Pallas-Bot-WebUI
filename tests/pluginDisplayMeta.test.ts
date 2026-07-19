import { describe, expect, it } from "vitest";
import {
  isTechnicalPluginModuleName,
  pluginDisplaySubtitle,
} from "../src/utils/pluginDisplayMeta";
import type { PluginRow } from "../src/api/pallasTypes";

describe("pluginDisplayMeta", () => {
  it("detects technical module prefixes", () => {
    expect(isTechnicalPluginModuleName("pallas_plugin_chat")).toBe(true);
    expect(isTechnicalPluginModuleName("nonebot_plugin_memes")).toBe(true);
    expect(isTechnicalPluginModuleName("chat")).toBe(false);
  });

  it("hides technical module names from subtitle", () => {
    const row = {
      name: "pallas_plugin_chat",
      resolved_plugin_id: "pallas_plugin_chat",
      metadata: { name: "酒后聊天" },
    } as PluginRow;
    expect(pluginDisplaySubtitle(row)).toBe("");
  });

  it("keeps short plugin id subtitle", () => {
    const row = {
      name: "chat",
      resolved_plugin_id: "chat",
      metadata: { name: "酒后聊天" },
    } as PluginRow;
    expect(pluginDisplaySubtitle(row)).toBe("chat");
  });
});
