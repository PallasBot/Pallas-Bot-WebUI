import { describe, expect, it } from "vitest";
import { botRestartPhaseLabel } from "@/utils/botRestartProgress";
import { normalizeBundledReadmeMarkdown } from "@/utils/pluginReadme";

describe("botRestartPhaseLabel", () => {
  it("describes reconnecting phase", () => {
    expect(botRestartPhaseLabel("reconnecting")).toContain("探测");
  });
});

describe("normalizeBundledReadmeMarkdown", () => {
  it("rewrites bundled asset paths to console static", () => {
    expect(normalizeBundledReadmeMarkdown('<img src="../assets/brand-avatar.png">')).toContain(
      "/pallas/assets/brand-avatar.png",
    );
  });
});
