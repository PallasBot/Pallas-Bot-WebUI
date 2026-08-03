export type PersonaDispositionDraft = {
  approach: string;
  initiative: string;
  conflict: string;
  do: string;
  dont: string;
};

const EMPTY_DISPOSITION: PersonaDispositionDraft = {
  approach: "",
  initiative: "",
  conflict: "",
  do: "",
  dont: "",
};

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readLines(value: unknown): string[] {
  return Array.isArray(value) ? value.map(readText).filter(Boolean) : [];
}

function normalizeLines(value: string): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const raw of value.split("\n")) {
    const text = raw.trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push(text);
    if (lines.length >= 4) break;
  }
  return lines;
}

export function readPersonaDisposition(persona: Record<string, unknown> | null | undefined): PersonaDispositionDraft {
  const raw = persona?.disposition;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...EMPTY_DISPOSITION };
  const disposition = raw as Record<string, unknown>;
  return {
    approach: readText(disposition.approach),
    initiative: readText(disposition.initiative),
    conflict: readText(disposition.conflict),
    do: readLines(disposition.do).join("\n"),
    dont: readLines(disposition.dont).join("\n"),
  };
}

export function serializePersonaDisposition(draft: PersonaDispositionDraft): Record<string, unknown> {
  return {
    version: 1,
    approach: draft.approach.trim(),
    initiative: draft.initiative.trim(),
    conflict: draft.conflict.trim(),
    do: normalizeLines(draft.do),
    dont: normalizeLines(draft.dont),
  };
}
