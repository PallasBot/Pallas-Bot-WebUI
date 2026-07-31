import { describe, expect, it } from "vitest";
import { querySettled } from "@/utils/querySettled";

describe("querySettled", () => {
  it("true when fetched", () => {
    expect(querySettled({ isFetched: true, data: undefined })).toBe(true);
  });

  it("true when data present before fetch flag", () => {
    expect(querySettled({ isFetched: false, data: { ok: 1 } })).toBe(true);
  });

  it("false when neither fetched nor data", () => {
    expect(querySettled({ isFetched: false, data: undefined })).toBe(false);
    expect(querySettled({ isFetched: false, data: null })).toBe(false);
  });
});
