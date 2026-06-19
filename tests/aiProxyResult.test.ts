import { describe, expect, it } from "vitest";
import type { AiProxyResult } from "../src/api/pallasTypes";
import { proxyCodeEquals, proxyDataRecord, proxyString } from "../src/utils/aiProxyResult";

function result(data: unknown): AiProxyResult {
  return { ok: true, status_code: 200, url: "/x", data: data as Record<string, unknown>, error: null };
}

describe("aiProxyResult", () => {
  it("returns the object payload as-is", () => {
    expect(proxyDataRecord(result({ a: 1 }))).toEqual({ a: 1 });
  });

  it("falls back to empty object for null / array / primitive payloads", () => {
    expect(proxyDataRecord(null)).toEqual({});
    expect(proxyDataRecord(result([1, 2]))).toEqual({});
    expect(proxyDataRecord(result("nope"))).toEqual({});
  });

  it("reads string fields with fallback", () => {
    expect(proxyString({ message: "hi" }, "message")).toBe("hi");
    expect(proxyString({ message: 42 }, "message")).toBe("");
    expect(proxyString({}, "message", "def")).toBe("def");
  });

  it("compares code across number and string forms", () => {
    expect(proxyCodeEquals({ code: 200 }, 200)).toBe(true);
    expect(proxyCodeEquals({ code: "200" }, 200)).toBe(true);
    expect(proxyCodeEquals({ code: 400 }, 200)).toBe(false);
    expect(proxyCodeEquals({}, 200)).toBe(false);
  });
});
