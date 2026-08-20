import type { AccountPersonaAxis, AccountPersonaProfile } from "@/api/pallasTypes";
import {
  serializePersonaDisposition,
  type PersonaDispositionDraft,
} from "@/utils/personaDisposition";

export type PersonaSeedPref = "chaotic" | "restrained" | "warm";

export const ACCOUNT_PERSONA_AXES: AccountPersonaAxis[] = ["energy", "warmth", "mischief", "restraint"];

export const EMPTY_ACCOUNT_PERSONA_PROFILE: AccountPersonaProfile = {
  energy: 0,
  warmth: 0,
  mischief: 0,
  restraint: 0,
  source: "manual",
};

export const PERSONA_SEED_PREF_OPTIONS: { id: PersonaSeedPref; label: string }[] = [
  { id: "chaotic", label: "偏跳" },
  { id: "restrained", label: "偏克制" },
  { id: "warm", label: "偏暖" },
];

export function updateAccountPersonaAxis(
  profile: AccountPersonaProfile,
  axis: AccountPersonaAxis,
  rawValue: number,
): AccountPersonaProfile {
  const value = Math.max(-1, Math.min(1, Number.isFinite(rawValue) ? rawValue : 0));
  const otherActive = ACCOUNT_PERSONA_AXES.filter(
    (candidate) => candidate !== axis && profile[candidate] !== 0,
  ).length;
  if (value !== 0 && otherActive >= 2 && profile[axis] === 0) return profile;
  return { ...profile, [axis]: value, source: "manual" };
}

export type BotPersonaDraftSeed = {
  prefs: PersonaSeedPref[];
  manual: boolean;
};

export function readBotPersonaSeedPrefs(
  persona: Record<string, unknown> | null | undefined,
): BotPersonaDraftSeed {
  const readPrefs = (raw: unknown): PersonaSeedPref[] => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const prefs = (raw as { prefs?: unknown }).prefs;
    if (!Array.isArray(prefs)) return [];
    return prefs
      .map((item) => String(item ?? "").trim().toLowerCase())
      .filter((item): item is PersonaSeedPref =>
        PERSONA_SEED_PREF_OPTIONS.some((opt) => opt.id === item),
      )
      .slice(0, 2);
  };

  const override = persona?.seed_override;
  const overridePrefs = readPrefs(override);
  if (overridePrefs.length) return { prefs: overridePrefs, manual: true };

  const seed = persona?.seed;
  const seedPrefs = readPrefs(seed);
  if (seedPrefs.length) return { prefs: seedPrefs, manual: false };

  return { prefs: [], manual: false };
}

export function accountPersonaPayload(
  profile: AccountPersonaProfile,
  manual: boolean,
  seed: BotPersonaDraftSeed,
  disposition: PersonaDispositionDraft,
): {
  account_profile: AccountPersonaProfile | null;
  seed_override: { prefs: string[] } | null;
  disposition: Record<string, unknown>;
} {
  return {
    account_profile: manual ? profile : null,
    seed_override: seed.manual ? { prefs: seed.prefs } : null,
    disposition: serializePersonaDisposition(disposition),
  };
}
