import { describe, expect, it } from "vitest";
import { decimalInputDraft } from "../src/utils/decimalInput";

describe("decimalInputDraft", () => {
  it("keeps a trailing decimal point while exposing a numeric value", () => {
    expect(decimalInputDraft("0.")).toEqual({ raw: "0.", value: 0 });
  });

  it("parses nonnegative decimal prices", () => {
    expect(decimalInputDraft("0.02")).toEqual({ raw: "0.02", value: 0.02 });
  });
});
