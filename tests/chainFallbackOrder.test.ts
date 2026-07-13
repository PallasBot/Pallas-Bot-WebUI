import { describe, expect, it } from "vitest";
import { moveFallbackIndex, addFallbackId, removeFallbackId } from "../src/utils/chainFallbackOrder";

describe("chainFallbackOrder", () => {
  it("moves item up and down", () => {
    expect(moveFallbackIndex(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveFallbackIndex(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("adds unique ids and removes by index", () => {
    expect(addFallbackId(["a"], "b")).toEqual(["a", "b"]);
    expect(addFallbackId(["a"], "a")).toEqual(["a"]);
    expect(removeFallbackId(["a", "b"], 0)).toEqual(["b"]);
  });
});
