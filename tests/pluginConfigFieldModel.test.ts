import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/pallasTypes";
import {
  isStringListField,
  tagsFromJsonText,
  tagsToJsonText,
} from "@/utils/pluginConfigFieldModel";

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
  return {
    name: "groups",
    env_key: "GROUPS",
    kind: "json",
    label: "群列表",
    description: "",
    required: false,
    default: [],
    current: [],
    ...overrides,
  };
}

describe("isStringListField", () => {
  it("treats string-array json as a tags field", () => {
    expect(isStringListField(makeField({ current: ["a", "b"], default: [] }))).toBe(true);
    expect(isStringListField(makeField({ current: [], default: ["x"] }))).toBe(true);
  });

  it("rejects non-string arrays and objects", () => {
    expect(isStringListField(makeField({ current: [1, 2], default: [] }))).toBe(false);
    expect(isStringListField(makeField({ current: { a: 1 }, default: {} }))).toBe(false);
  });

  it("rejects when no array sample is present", () => {
    expect(isStringListField(makeField({ current: null, default: null }))).toBe(false);
  });

  it("only applies to json kind", () => {
    expect(isStringListField(makeField({ kind: "string", current: ["a"] }))).toBe(false);
  });
});

describe("tags serialization round-trip", () => {
  it("parses JSON array text into string tags", () => {
    expect(tagsFromJsonText('["123", "456"]')).toEqual(["123", "456"]);
    expect(tagsFromJsonText("[]")).toEqual([]);
    expect(tagsFromJsonText("")).toEqual([]);
  });

  it("coerces non-string array items to strings", () => {
    expect(tagsFromJsonText("[1, 2]")).toEqual(["1", "2"]);
  });

  it("falls back to splitting plain text on commas/newlines", () => {
    expect(tagsFromJsonText("a, b\nc")).toEqual(["a", "b", "c"]);
  });

  it("serializes tags back to JSON text", () => {
    expect(tagsToJsonText(["123", "456"])).toBe('["123","456"]');
    expect(tagsFromJsonText(tagsToJsonText(["x", "y"]))).toEqual(["x", "y"]);
  });
});
