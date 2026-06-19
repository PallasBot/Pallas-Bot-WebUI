import { describe, expect, it } from "vitest";
import {
  runtimeStateClass,
  runtimeStateDotClass,
  runtimeStateLabel,
} from "../src/utils/aiRuntimeState";

describe("aiRuntimeState", () => {
  it("maps each state to its label", () => {
    expect(runtimeStateLabel("healthy")).toBe("正常");
    expect(runtimeStateLabel("degraded")).toBe("降级");
    expect(runtimeStateLabel("disabled")).toBe("未启用");
    expect(runtimeStateLabel("unknown")).toBe("待确认");
  });

  it("maps states to tag modifier classes", () => {
    expect(runtimeStateClass("healthy")).toBe("tag--ok");
    expect(runtimeStateClass("degraded")).toBe("tag--warn");
    expect(runtimeStateClass("disabled")).toBe("tag--muted");
    expect(runtimeStateClass("unknown")).toBe("tag--muted");
  });

  it("returns dot classes (empty for healthy/disabled to reuse base dot)", () => {
    expect(runtimeStateDotClass("healthy")).toBe("ai-dot--ok");
    expect(runtimeStateDotClass("degraded")).toBe("ai-dot--warn");
    expect(runtimeStateDotClass("disabled")).toBe("");
    expect(runtimeStateDotClass("unknown")).toBe("ai-dot--warn");
  });
});
