import { describe, expect, it } from "vitest";
import {
  accountPersonaPayload,
  readBotPersonaSeedPrefs,
  updateAccountPersonaAxis,
  type BotPersonaDraftSeed,
} from "@/utils/accountPersonaProfile";
import type { PersonaDispositionDraft } from "@/utils/personaDisposition";

const empty = {
  energy: 0,
  warmth: 0,
  mischief: 0,
  restraint: 0,
  source: "manual" as const,
};

const emptySeed: BotPersonaDraftSeed = { prefs: [], manual: false };
const emptyDisposition: PersonaDispositionDraft = {
  approach: "",
  initiative: "",
  conflict: "",
  do: "",
  dont: "",
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
    expect(accountPersonaPayload(empty, false, emptySeed, emptyDisposition)).toEqual({
      account_profile: null,
      seed_override: null,
      disposition: {
        version: 1,
        approach: "",
        initiative: "",
        conflict: "",
        do: [],
        dont: [],
      },
    });
    expect(
      accountPersonaPayload(
        { ...empty, warmth: 0.7 },
        true,
        { prefs: ["warm"], manual: true },
        { ...emptyDisposition, approach: "先接住再判断" },
      ),
    ).toEqual({
      account_profile: { ...empty, warmth: 0.7 },
      seed_override: { prefs: ["warm"] },
      disposition: {
        version: 1,
        approach: "先接住再判断",
        initiative: "",
        conflict: "",
        do: [],
        dont: [],
      },
    });
  });

  it("读取 seed 时优先取手改覆盖，其次自动派生", () => {
    expect(
      readBotPersonaSeedPrefs({ seed_override: { prefs: ["chaotic"] }, seed: { prefs: ["warm"] } }),
    ).toEqual({ prefs: ["chaotic"], manual: true });
    expect(readBotPersonaSeedPrefs({ seed: { prefs: ["restrained"] } })).toEqual({
      prefs: ["restrained"],
      manual: false,
    });
    expect(readBotPersonaSeedPrefs({ seed_override: { prefs: ["unknown", "warm"] } })).toEqual({
      prefs: ["warm"],
      manual: true,
    });
    expect(readBotPersonaSeedPrefs(null)).toEqual({ prefs: [], manual: false });
  });
});
