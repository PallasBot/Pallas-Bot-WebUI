import { describe, expect, it } from "vitest";
import { resolveConsoleVersionMetadata } from "../scripts/write-console-version.mjs";

describe("console version metadata", () => {
  it("marks an untagged manual build with its short commit", async () => {
    await expect(
      resolveConsoleVersionMetadata({
        packageVersion: "0.6.49",
        env: {},
        runGit: async (args: string[]) =>
          args[0] === "describe" ? "" : "310ccb8f86ea64bc465f7ee5f1e10189ecf05f82",
      }),
    ).resolves.toEqual({
      version: "0.6.49-dev+310ccb8",
      commit: "310ccb8f86ea64bc465f7ee5f1e10189ecf05f82",
    });
  });

  it("keeps an exact Git tag as the manual build version", async () => {
    await expect(
      resolveConsoleVersionMetadata({
        packageVersion: "0.6.49",
        env: {},
        runGit: async (args: string[]) =>
          args[0] === "describe" ? "v0.6.49" : "310ccb8f86ea64bc465f7ee5f1e10189ecf05f82",
      }),
    ).resolves.toEqual({
      version: "v0.6.49",
      commit: "310ccb8f86ea64bc465f7ee5f1e10189ecf05f82",
    });
  });
});
