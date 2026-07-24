import { describe, expect, it } from "vitest";
import {
  idTagsFromJsonText,
  idTagsToJsonText,
  isIdListField,
  isStringListField,
} from "@/utils/pluginConfigFieldModel";
import type { PluginConfigField } from "@/api/console";

function field(partial: Partial<PluginConfigField> & Pick<PluginConfigField, "name" | "kind">): PluginConfigField {
  return {
    description: "",
    default: null,
    current: null,
    ...partial,
  } as PluginConfigField;
}

describe("chip list field helpers", () => {
  it("detects number id lists", () => {
    expect(
      isIdListField(
        field({
          name: "pallas_image_draw_unlimited_group_ids",
          kind: "json",
          current: [123, 456],
          default: [],
        }),
      ),
    ).toBe(true);
    expect(
      isStringListField(
        field({
          name: "pallas_image_draw_unlimited_group_ids",
          kind: "json",
          current: [123, 456],
          default: [],
        }),
      ),
    ).toBe(false);
  });

  it("round-trips id tags json", () => {
    expect(idTagsFromJsonText("[1, 2, 2, 3]")).toEqual(["1", "2", "3"]);
    expect(idTagsToJsonText(["3", "1", "1", "x"])).toBe("[3,1]");
  });
});
