import { describe, expect, it } from "vitest";
import { buildPluginGovernancePatch } from "../src/components/config/pluginGovernancePatch";

describe("buildPluginGovernancePatch", () => {
  it("does not carry stale runtime state while saving another governance field", () => {
    expect(
      buildPluginGovernancePatch({
        action: { kind: "help_hidden", value: true },
        permissionOverrides: { "dream.start": "staff" },
        limitOverrides: { "dream.start": 12 },
      }),
    ).toEqual({ help_hidden: true });

    expect(
      buildPluginGovernancePatch({
        action: { kind: "permissions" },
        permissionOverrides: { "dream.start": "staff" },
        limitOverrides: { "dream.start": 12 },
      }),
    ).toEqual({ command_permission_overrides: { "dream.start": "staff" } });
  });
});
