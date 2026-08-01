import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/console";
import { isBotIdField } from "./pluginConfigFieldModel";

function field(partial: Partial<PluginConfigField>): PluginConfigField {
  return {
    name: "x",
    kind: "int",
    required: false,
    description: "",
    ...partial,
  };
}

describe("isBotIdField", () => {
  it("matches ui_widget bot_id", () => {
    expect(isBotIdField(field({ name: "foo", ui_widget: "bot_id" }))).toBe(true);
  });

  it("matches *_bot_id int fields", () => {
    expect(isBotIdField(field({ name: "git_watch_notify_bot_id" }))).toBe(true);
    expect(isBotIdField(field({ name: "pallas_auto_update_notify_bot_id" }))).toBe(true);
  });

  it("rejects unrelated int / string", () => {
    expect(isBotIdField(field({ name: "interval_minutes" }))).toBe(false);
    expect(isBotIdField(field({ name: "bot_id", kind: "string" }))).toBe(false);
  });
});
