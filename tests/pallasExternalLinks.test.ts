import { describe, expect, it } from "vitest";
import { PALLAS_BOT_DOC } from "../src/utils/pallasExternalLinks";

describe("Pallas-Bot documentation links", () => {
  it("exposes the AI Runtime installation guide", () => {
    expect(PALLAS_BOT_DOC.aiRuntime).toBe(
      "https://PallasBot.github.io/Pallas-Bot-Docs/maintainer/install/ai-runtime",
    );
  });
});
