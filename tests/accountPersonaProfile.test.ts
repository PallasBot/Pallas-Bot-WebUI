import { describe, expect, it } from "vitest";
import {
  accountPersonaPayload,
  updateAccountPersonaAxis,
} from "@/utils/accountPersonaProfile";

const empty = {
  energy: 0,
  warmth: 0,
  mischief: 0,
  restraint: 0,
  source: "manual" as const,
};

describe("accountPersonaProfile", () => {
  it("最多保留两个非零倾向", () => {
    const two = updateAccountPersonaAxis(
      updateAccountPersonaAxis(empty, "energy", 0.5),
      "warmth",
      -0.4,
    );

    expect(updateAccountPersonaAxis(two, "mischief", 0.8)).toEqual(two);
    expect(updateAccountPersonaAxis(two, "energy", 0)).toEqual({ ...two, energy: 0 });
  });

  it("恢复自动时发送 account_profile null", () => {
    expect(accountPersonaPayload(empty, false)).toEqual({ account_profile: null });
    expect(accountPersonaPayload({ ...empty, warmth: 0.7 }, true)).toEqual({
      account_profile: { ...empty, warmth: 0.7 },
    });
  });
});
