export type DecimalInputDraft = { raw: string; value: number };

export function decimalInputDraft(raw: string): DecimalInputDraft | null {
  if (!/^\d*\.?\d*$/.test(raw)) return null;
  const value = raw === "" || raw === "." ? 0 : Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return { raw, value };
}

export function formatDecimalInput(value: number | undefined): string {
  return value ? String(value) : "";
}
