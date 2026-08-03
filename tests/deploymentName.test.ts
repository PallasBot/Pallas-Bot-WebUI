import { describe, expect, it } from "vitest";
import { deploymentNameFromPluginConfig } from "@/utils/deploymentName";

describe("deploymentNameFromPluginConfig", () => {
  it("reads the deployment display name from the pb_core config field", () => {
    expect(
      deploymentNameFromPluginConfig({
        plugin: "pb_core",
        fields: [
          { name: "federate_id", current: "pool-1" },
          { name: "deployment_name", current: "部署 B" },
        ],
      }),
    ).toBe("部署 B");
  });

  it("returns an empty value when the display name has not been configured", () => {
    expect(deploymentNameFromPluginConfig({ plugin: "pb_core", fields: [] })).toBe("");
  });
});
