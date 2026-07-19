import { describe, expect, it } from "vitest";
import type { PluginRow } from "@/api/pallasTypes";
import {
  listHelpPreviewFunctionOptions,
  listHelpPreviewPluginOptions,
  pickDefaultHelpPreviewFunction,
} from "@/utils/helpPreviewOptions";

describe("helpPreviewOptions", () => {
  it("builds plugin and function select options", () => {
    const rows: PluginRow[] = [
      {
        name: "draw",
        module: "packages.draw",
        metadata: {
          name: "牛牛画画",
          extra: {
            menu_data: [
              { func: "画画", help_audience: "user" },
              { func: "维护项", help_audience: "maintainer" },
            ],
          },
        },
      },
      {
        name: "admin",
        module: "packages.admin",
        metadata: {
          name: "维护插件",
          extra: { help_audience: "maintainer" },
        },
      },
    ];
    expect(listHelpPreviewPluginOptions(rows)).toEqual([{ value: "draw", label: "牛牛画画（draw）" }]);
    expect(listHelpPreviewFunctionOptions(rows[0])).toEqual([
      { value: "1", label: "画画" },
    ]);
    expect(pickDefaultHelpPreviewFunction([{ value: "2", label: "b" }], "9")).toBe("2");
  });
});
