import { describe, expect, it } from "vitest";
import {
  buildTrafficChainFallback,
  buildTrafficRouteTasks,
  detectTrafficRoutePreset,
} from "../src/utils/trafficRoutePreset";

describe("trafficRoutePreset", () => {
  it("builds all_cloud / all_local / default_split task maps", () => {
    expect(buildTrafficRouteTasks("all_cloud", "openai", "local").llm_chat).toBe("openai");
    expect(buildTrafficRouteTasks("all_cloud", "openai", "local").repeater_select).toBe("openai");
    expect(buildTrafficRouteTasks("all_local", "openai", "local").llm_chat).toBe("local");
    expect(buildTrafficRouteTasks("default_split", "openai", "local").llm_chat).toBe("local");
    expect(buildTrafficRouteTasks("default_split", "openai", "local").repeater_select).toBe("openai");
  });

  it("orders chain fallback by preset", () => {
    expect(buildTrafficChainFallback("all_cloud", "openai", "local", ["local", "openai"])).toEqual([
      "openai",
      "local",
    ]);
    expect(buildTrafficChainFallback("all_local", "openai", "local", ["openai"])).toEqual([
      "local",
      "openai",
    ]);
  });

  it("detects empty tasks as default_split", () => {
    expect(detectTrafficRoutePreset({}, "openai", "local")).toBe("default_split");
  });

  it("detects explicit presets and custom", () => {
    const allCloud = buildTrafficRouteTasks("all_cloud", "openai", "local");
    expect(detectTrafficRoutePreset(allCloud, "openai", "local")).toBe("all_cloud");
    expect(detectTrafficRoutePreset({ llm_chat: "openai", drunk: "local" }, "openai", "local")).toBe(
      "custom",
    );
  });
});
