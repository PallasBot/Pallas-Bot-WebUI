import { describe, expect, it } from "vitest";
import { formatLogDisplayDateTime, formatLogDisplayTime } from "@/utils/logDisplay";

describe("formatLogDisplayTime", () => {
  it("shows clock only for MM-DD HH:mm:ss text", () => {
    expect(formatLogDisplayTime("07-28 12:03:45")).toBe("12:03:45");
  });

  it("strips ISO date down to clock", () => {
    expect(formatLogDisplayTime("2026-07-28 12:03:45")).toBe("12:03:45");
  });
});

describe("formatLogDisplayDateTime", () => {
  it("keeps month-day for error lists", () => {
    expect(formatLogDisplayDateTime("2026-07-28 12:03:45")).toBe("07-28 12:03:45");
  });
});
