import { isAxiosError } from "axios";
import { fetchGroupConfigById, fetchInstances } from "@/api/consoleApi";
import { isCatchAllApiError } from "@/api/http";
import type {
  GroupStyleProfileSnapshot,
  PersonaAffectRefineSnapshot,
  PersonaAffectTriggerRow,
  PersonaAxisSnapshot,
  PersonaObserveBotRow,
  PersonaObserveData,
} from "@/api/pallasTypes";

function emptyAxis(): PersonaAxisSnapshot {
  return {
    warmth: 0,
    assertiveness: 0,
    bluntness: 0,
    chaos_bias: 0,
    reply_bias: 1,
    speak_bias: 1,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseAffectRefine(sample: Record<string, unknown> | null): PersonaAffectRefineSnapshot | null {
  const refine = asRecord(sample?.affect_refine);
  if (!refine) return null;
  return {
    source: String(refine.source ?? "none"),
    warmth_delta: Number(refine.warmth_delta) || 0,
    assertiveness_delta: Number(refine.assertiveness_delta) || 0,
    confidence: Number(refine.confidence) || 0,
    summary: String(refine.summary ?? ""),
    updated_at: typeof refine.updated_at === "number" ? refine.updated_at : null,
  };
}

function parseAffectTriggers(sample: Record<string, unknown> | null): PersonaAffectTriggerRow[] {
  const raw = sample?.affect_triggers;
  if (!Array.isArray(raw)) return [];
  const rows: PersonaAffectTriggerRow[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const phrase = String(row.phrase ?? "").trim();
    if (!phrase) continue;
    rows.push({
      phrase,
      warmth_delta: Number(row.warmth_delta) || 0,
      assertiveness_delta: Number(row.assertiveness_delta) || 0,
      weight: Number(row.weight) || 0,
      expires_at: typeof row.expires_at === "number" ? row.expires_at : null,
    });
  }
  return rows;
}

export function isPersonaObserveApiMissing(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  if (err.response?.status !== 404) return false;
  return isCatchAllApiError(err) || true;
}

export async function buildPersonaObserveFallback(
  groupId: number | null,
): Promise<PersonaObserveData> {
  const instances = await fetchInstances();
  const dbAccounts = instances.db_bot_configs.map((row) => row.account);
  const onlineAccounts = instances.nonebot_bots
    .map((row) => Number.parseInt(String(row.self_id), 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  const accounts = [...new Set([...dbAccounts, ...onlineAccounts])].sort((a, b) => a - b);

  let groupSnapshot: GroupStyleProfileSnapshot | null = null;
  let affectRefine: PersonaAffectRefineSnapshot | null = null;
  let affectTriggers: PersonaAffectTriggerRow[] = [];

  if (groupId != null && groupId > 0) {
    try {
      const groupCfg = await fetchGroupConfigById(groupId);
      groupSnapshot = groupCfg.style_profile_snapshot ?? null;
      const sample = asRecord(groupSnapshot?.sample ?? null);
      affectRefine = parseAffectRefine(sample);
      affectTriggers = parseAffectTriggers(sample);
    } catch {
      groupSnapshot = {
        ready: false,
        hints: ["未找到该群配置或尚无群风格画像"],
      };
    }
  }

  const bots: PersonaObserveBotRow[] = accounts.map((account) => ({
    account,
    group_style_enabled: true,
    seed_prefs: [],
    seed_source: "auto",
    base: emptyAxis(),
    base_hints: [],
    resolved: null,
    resolved_hints: [],
  }));

  return {
    group_id: groupId,
    group_style_snapshot: groupSnapshot,
    affect_refine: affectRefine,
    affect_triggers: affectTriggers,
    bots,
  };
}
