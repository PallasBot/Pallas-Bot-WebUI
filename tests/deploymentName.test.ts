import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("does not reset an in-progress deployment name edit when the query refetches", () => {
    const source = readFileSync(resolve(__dirname, "../src/pages/CommunityPage.tsx"), "utf8");
    expect(source).toContain("[configuredDeploymentName, deploymentNameQ.isFetched]");
    expect(source).not.toContain("[configuredDeploymentName, deploymentNameQ.data]");
  });

  it("uses a compatible flex alignment for deployment name controls", () => {
    const source = readFileSync(resolve(__dirname, "../src/styles/console/app.css"), "utf8");
    expect(source).toContain(".community-page__federation-deployment-name {\n  display: flex;\n  align-items: flex-end;");
  });
});
