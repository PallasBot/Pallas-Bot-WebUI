export function coerceBoolean(val: unknown): boolean | null {
  if (typeof val === "boolean") return val;
  if (typeof val === "number" && !Number.isNaN(val)) return val !== 0;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (["true", "1", "yes", "y", "on"].includes(s)) return true;
    if (["false", "0", "no", "n", "off"].includes(s)) return false;
  }
  return null;
}

export function protocolScalarText(val: unknown): string {
  if (val == null || val === "") return "—";
  return String(val);
}

export type ProtocolDisp =
  | { kind: "pill"; on: boolean; onLabel: string; offLabel: string }
  | { kind: "text"; text: string };

export function protocolDisp(v: unknown, onLabel: string, offLabel: string): ProtocolDisp {
  const b = coerceBoolean(v);
  if (b !== null) return { kind: "pill", on: b, onLabel, offLabel };
  return { kind: "text", text: protocolScalarText(v) };
}
