import type { AccountPersonaAxis, AccountPersonaProfile } from "@/api/pallasTypes";

export const ACCOUNT_PERSONA_AXES: AccountPersonaAxis[] = ["energy", "warmth", "mischief", "restraint"];

export const EMPTY_ACCOUNT_PERSONA_PROFILE: AccountPersonaProfile = {
  energy: 0,
  warmth: 0,
  mischief: 0,
  restraint: 0,
  source: "manual",
};

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

export function accountPersonaPayload(
  profile: AccountPersonaProfile,
  manual: boolean,
): { account_profile: AccountPersonaProfile | null } {
  return { account_profile: manual ? profile : null };
}
