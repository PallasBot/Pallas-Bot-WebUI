import { describe, expect, it } from "vitest";
import {
  communityActivationDetailHint,
  extensionActionStateLabel,
} from "@/config/extensionActivationSemantics";

describe("communityActivationSemantics", () => {
  it("shows community-specific install hint", () => {
    expect(communityActivationDetailHint("hot-reloadable")).toContain("首次安装可立即生效");
    expect(communityActivationDetailHint("hot-reloadable")).toContain("更新");
  });

  it("marks hot-reload community install as loaded", () => {
    expect(
      extensionActionStateLabel("hot-reloadable", {
        needs_restart: false,
        activation_action: "hot-reload",
      }),
    ).toBe("已热更新");
  });

  it("marks pending community update as worker restart", () => {
    expect(
      extensionActionStateLabel("workers-restart", {
        needs_restart: true,
        activation_action: "none",
      }),
    ).toBe("待重启分片节点");
  });
});
