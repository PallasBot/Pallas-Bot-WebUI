import { describe, expect, it } from "vitest";
import { formatCompactDateTime } from "../src/utils/formatDateTime";

describe("formatCompactDateTime", () => {
  it("returns an em dash for falsy timestamps", () => {
    expect(formatCompactDateTime(0)).toBe("—");
  });

  it("formats a positive unix-seconds timestamp to a non-empty string", () => {
    const out = formatCompactDateTime(1_700_000_000);
    expect(typeof out).toBe("string");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
  });
});
