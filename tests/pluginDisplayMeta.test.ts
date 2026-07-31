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

  it("shows pip package / module id even when technical", () => {
    const row = {
      name: "nonebot_plugin_apscheduler",
      resolved_plugin_id: "nonebot_plugin_apscheduler",
      plugin_source: "pip",
      metadata: { name: "定时任务" },
    } as PluginRow;
    expect(pluginDisplaySubtitle(row)).toBe("nonebot_plugin_apscheduler");
  });

  it("prefers extra_package for pip subtitle when present", () => {
    const row = {
      name: "draw",
      resolved_plugin_id: "draw",
      plugin_source: "pip",
      extra_package: "nonebot-plugin-apscheduler",
      metadata: { name: "定时任务" },
    } as PluginRow;
    expect(pluginDisplaySubtitle(row)).toBe("nonebot-plugin-apscheduler");
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
