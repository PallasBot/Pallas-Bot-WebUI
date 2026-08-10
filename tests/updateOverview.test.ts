import { describe, expect, it } from "vitest";
import { aiRuntimeUpdateOverview } from "@/utils/updateOverview";

describe("aiRuntimeUpdateOverview", () => {
  it("marks a managed runtime behind its upstream as updateable", () => {
    expect(
      aiRuntimeUpdateOverview({
        can_update: true,
        has_update: true,
        installed_ref: "abc123",
        latest_ref: "def456",
      }),
    ).toEqual({
      state: "update_available",
      label: "有更新",
      current: "abc123",
      remote: "def456",
    });
  });

  it("keeps an up-to-date managed runtime visually quiet", () => {
    expect(
      aiRuntimeUpdateOverview({
        can_update: true,
        has_update: false,
        installed_ref: "abc123",
        latest_ref: "abc123",
      }),
    ).toMatchObject({ state: "current", label: "已是最新" });
  });

  it("does not offer updates for externally managed runtimes", () => {
    expect(
      aiRuntimeUpdateOverview({ deployment: "docker", layout: "docker" }),
    ).toMatchObject({ state: "external", label: "外部管理" });
  });

  it("reports a failed update check without claiming the runtime is current", () => {
    expect(
      aiRuntimeUpdateOverview({ can_update: true, update_check_error: "network down" }),
    ).toMatchObject({ state: "unknown", label: "待检查" });
  });
});
