export const REPLY_STYLE_CHOICES = [
  { id: "cool", label: "简短冷静" },
  { id: "playful", label: "轻松俏皮" },
  { id: "direct", label: "认真直接" },
  { id: "rhetorical", label: "半句收口" },
  { id: "follow", label: "顺着接话" },
] as const;

export type ReplyStyleId = (typeof REPLY_STYLE_CHOICES)[number]["id"];

const DEFAULT_STYLES: ReplyStyleId[] = REPLY_STYLE_CHOICES.map((item) => item.id);

export type ReplyStyleVariantsFormValue = {
  enabled: boolean;
  probabilityPercent: number;
  styles: ReplyStyleId[];
};

function normalizeStyles(value: unknown): ReplyStyleId[] {
  if (!Array.isArray(value)) return DEFAULT_STYLES;
  const selected = value.filter((item): item is ReplyStyleId =>
    REPLY_STYLE_CHOICES.some((choice) => choice.id === item),
  );
  return selected.length ? selected : DEFAULT_STYLES;
}

function parsePolicy(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function parseReplyStyleVariants(raw: string): ReplyStyleVariantsFormValue {
  const policy = parsePolicy(raw);
  const probability = Number(policy.base_probability);
  const affectStyles = policy.affect_styles;
  const defaultStyles =
    affectStyles && typeof affectStyles === "object" && !Array.isArray(affectStyles)
      ? (affectStyles as Record<string, unknown>).default
      : undefined;
  return {
    enabled: policy.enabled !== false,
    probabilityPercent: Math.round(Math.min(1, Math.max(0, Number.isFinite(probability) ? probability : 0.25)) * 100),
    styles: normalizeStyles(defaultStyles),
  };
}

export function updateReplyStyleVariants(
  raw: string,
  next: ReplyStyleVariantsFormValue,
): string {
  const policy = parsePolicy(raw);
  const affectStyles =
    policy.affect_styles && typeof policy.affect_styles === "object" && !Array.isArray(policy.affect_styles)
      ? policy.affect_styles as Record<string, unknown>
      : {};
  const probability = Math.min(100, Math.max(0, Number(next.probabilityPercent) || 0)) / 100;
  return JSON.stringify({
    ...policy,
    version: Number(policy.version) || 1,
    enabled: next.enabled,
    base_probability: probability,
    affect_styles: {
      ...affectStyles,
      default: normalizeStyles(next.styles),
    },
  });
}
