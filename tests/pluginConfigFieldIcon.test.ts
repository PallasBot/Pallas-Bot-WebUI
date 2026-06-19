import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/pallasTypes";
import { pluginConfigFieldIcon } from "@/utils/pluginConfigFieldIcon";

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
  return {
    name: "field",
    env_key: "FIELD",
    kind: "string",
    label: "",
    description: "",
    required: false,
    default: "",
    ...overrides,
  };
}

describe("pluginConfigFieldIcon", () => {
  it("maps key-like fields to the key icon", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "api_key" }))).toBe("🔑");
    expect(pluginConfigFieldIcon(makeField({ name: "access_token" }))).toBe("🔑");
  });

  it("maps url/host fields to the globe icon", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "base_url" }))).toBe("🌐");
    expect(pluginConfigFieldIcon(makeField({ name: "ai_server_host" }))).toBe("🌐");
  });

  it("maps numeric-bound fields to the slider icon", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "max_candidates" }))).toBe("🎚️");
    expect(pluginConfigFieldIcon(makeField({ name: "session_window" }))).toBe("🎚️");
  });

  it("maps time fields to the clock icon", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "chat_timeout_sec" }))).toBe("⏰");
    expect(pluginConfigFieldIcon(makeField({ name: "cooldown_sec" }))).toBe("⏰");
  });

  it("matches against the label too", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "x", label: "回复消息" }))).toBe("⚙️");
    expect(pluginConfigFieldIcon(makeField({ name: "x", label: "message text" }))).toBe("💬");
  });

  it("does not over-match the active keyword on unrelated words", () => {
    // "connection"/"configuration" 不应命中 ⚡（曾因 "on" 关键词误伤）
    expect(pluginConfigFieldIcon(makeField({ name: "connection_mode" }))).not.toBe("⚡");
    expect(pluginConfigFieldIcon(makeField({ name: "enabled" }))).toBe("⚡");
  });

  it("falls back to the gear icon", () => {
    expect(pluginConfigFieldIcon(makeField({ name: "mode" }))).toBe("⚙️");
  });
});
