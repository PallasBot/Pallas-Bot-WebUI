import { describe, expect, it } from "vitest";
import {
  parsePersonaOutputFirewall,
  updatePersonaOutputFirewall,
} from "@/utils/personaOutputFirewall";

describe("personaOutputFirewall", () => {
  it("parses defaults when empty", () => {
    expect(parsePersonaOutputFirewall("")).toEqual({
      enabled: false,
      severity: "strict",
      strategy: "retry_then_fallback",
      maxRetries: 1,
    });
  });

  it("preserves unknown keys while updating form fields", () => {
    const raw = JSON.stringify({
      version: 1,
      enabled: false,
      severity: "soft",
      strategy: "fallback",
      max_retries: 0,
      note: "keep-me",
    });
    const next = updatePersonaOutputFirewall(raw, {
      enabled: true,
      severity: "strict",
      strategy: "retry_then_fallback",
      maxRetries: 1,
    });
    expect(JSON.parse(next)).toMatchObject({
      version: 1,
      enabled: true,
      severity: "strict",
      strategy: "retry_then_fallback",
      max_retries: 1,
      note: "keep-me",
    });
  });
});
