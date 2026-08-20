import { describe, expect, it } from "vitest";
import {
  AI_CONFIG_SECTIONS,
  aiConfigSectionMeta,
  normalizeAiConfigSection,
  legacyAiConfigPanel,
} from "../src/config/aiConfigSections";

describe("aiConfigSections", () => {
  it("keeps three top-level sections with stable ids", () => {
    expect(AI_CONFIG_SECTIONS.map((s) => s.id)).toEqual(["provider", "dialogue", "media", "kernel"]);
    expect(AI_CONFIG_SECTIONS.map((s) => s.label)).toEqual(["接入", "接话", "媒体", "会话内核"]);
  });

  it("normalizes legacy section aliases", () => {
    expect(normalizeAiConfigSection("strategy")).toBe("dialogue");
    expect(normalizeAiConfigSection("connection")).toBe("media");
    expect(legacyAiConfigPanel("draw")).toBe("draw");
    expect(aiConfigSectionMeta("dialogue").label).toBe("接话");
  });
});
