import { describe, expect, it } from "vitest";
import { formatLifecycleBytes, lifecycleRiskMeta, objectMaintenanceAllowed } from "./model";

describe("database lifecycle view model", () => {
  it("formats storage sizes without hiding unavailable values", () => {
    expect(formatLifecycleBytes(null)).toBe("—");
    expect(formatLifecycleBytes(0)).toBe("0 B");
    expect(formatLifecycleBytes(20 * 1024 ** 3)).toBe("20 GiB");
  });

  it("maps risk levels to explicit console states", () => {
    expect(lifecycleRiskMeta("low").label).toBe("低风险");
    expect(lifecycleRiskMeta("medium").className).toContain("warn");
    expect(lifecycleRiskMeta("high").className).toContain("err");
  });

  it("never exposes maintenance controls for protected objects", () => {
    expect(objectMaintenanceAllowed({ protected: true, error: null })).toBe(false);
    expect(objectMaintenanceAllowed({ protected: false, error: "统计失败" })).toBe(false);
    expect(objectMaintenanceAllowed({ protected: false, error: null })).toBe(true);
  });
});
