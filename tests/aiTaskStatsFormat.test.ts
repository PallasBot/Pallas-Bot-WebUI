import { describe, expect, it } from "vitest";

import { formatCompactNumber } from "@/utils/aiTaskStats";

describe("formatCompactNumber", () => {
  it("shows two decimals for 1M–10M so daily growth is visible", () => {
    expect(formatCompactNumber(1_843_886)).toBe("1.84M");
    expect(formatCompactNumber(1_849_999)).toBe("1.85M");
    expect(formatCompactNumber(9_999_999)).toBe("10.00M");
  });

  it("reduces precision at larger magnitudes", () => {
    expect(formatCompactNumber(12_345_678)).toBe("12.3M");
    expect(formatCompactNumber(123_456_789)).toBe("123M");
  });
});
