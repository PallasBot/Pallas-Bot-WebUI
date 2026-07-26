import { describe, expect, it } from "vitest";
import {
  parseReplyStyleVariants,
  updateReplyStyleVariants,
} from "../src/utils/replyStyleVariants";

describe("reply style variants", () => {
  it("uses the beginner-friendly defaults for an empty policy", () => {
    expect(parseReplyStyleVariants("")).toMatchObject({
      enabled: true,
      probabilityPercent: 25,
      styles: ["cool", "playful", "direct", "rhetorical", "follow"],
    });
  });

  it("preserves legacy affect mappings while changing visible settings", () => {
    const value = JSON.stringify({
      version: 7,
      enabled: false,
      base_probability: 0.4,
      affect_styles: {
        warm: ["playful"],
        custom: ["direct"],
        default: ["cool"],
      },
    });

    const next = JSON.parse(
      updateReplyStyleVariants(value, {
        enabled: true,
        probabilityPercent: 35,
        styles: ["follow", "direct"],
      }),
    );

    expect(next).toMatchObject({
      version: 7,
      enabled: true,
      base_probability: 0.35,
      affect_styles: {
        warm: ["playful"],
        custom: ["direct"],
        default: ["follow", "direct"],
      },
    });
  });
});
