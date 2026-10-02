import { describe, expect, it } from "vitest";
import { safeInternalRedirect } from "@/utils/safeInternalRedirect";

describe("safeInternalRedirect", () => {
  it("preserves same-origin paths, query, and hash", () => {
    expect(safeInternalRedirect("/ai/session?bot=1#latest", "https://console.example")).toBe(
      "/ai/session?bot=1#latest",
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\\\evil.example/path",
    "/%5C%5Cevil.example/path",
    "/%2F%2Fevil.example/path",
    "/%ZZ",
  ])("rejects unsafe redirect %s", (value) => {
    expect(safeInternalRedirect(value, "https://console.example")).toBe("/");
  });
});
