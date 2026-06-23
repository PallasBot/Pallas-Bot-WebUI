import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@/api/pallasTypes";
import {
  isStringListField,
  resolveConfigFieldLayout,
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

describe("resolveConfigFieldLayout", () => {
  it("uses compact for bool and tag-list json", () => {
    expect(resolveConfigFieldLayout(makeField({ kind: "bool" }))).toBe("compact");
    expect(resolveConfigFieldLayout(makeField({ current: ["a"], default: [] }))).toBe("compact");
    expect(
      resolveConfigFieldLayout(
        makeField({
          kind: "enum",
          choices: ["true", "false"],
        }),
      ),
    ).toBe("compact");
  });

  it("uses tall for structured json and multiline string", () => {
    expect(resolveConfigFieldLayout(makeField({ current: { a: 1 }, default: {} }))).toBe("tall");
    expect(
      resolveConfigFieldLayout(
        makeField({ kind: "string", multiline: true, current: "", default: "" }),
      ),
    ).toBe("tall");
  });

  it("uses standard for typical single-line fields", () => {
    expect(resolveConfigFieldLayout(makeField({ kind: "string", current: "", default: "" }))).toBe(
      "standard",
    );
    expect(resolveConfigFieldLayout(makeField({ kind: "int", current: 0, default: 0 }))).toBe(
      "standard",
    );
    expect(
      resolveConfigFieldLayout(
        makeField({ kind: "enum", choices: ["a", "b", "c"], current: "a", default: "a" }),
      ),
    ).toBe("standard");
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
