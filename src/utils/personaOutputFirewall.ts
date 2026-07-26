export type FirewallSeverity = "soft" | "strict";
export type FirewallStrategy = "fallback" | "retry_then_fallback";

export const FIREWALL_SEVERITY_OPTIONS: Array<{ value: FirewallSeverity; label: string; hint: string }> = [
  { value: "strict", label: "严格", hint: "明显人设崩了就拦" },
  { value: "soft", label: "宽松", hint: "只拦很离谱的情况" },
];

export const FIREWALL_STRATEGY_OPTIONS: Array<{ value: FirewallStrategy; label: string; hint: string }> = [
  { value: "retry_then_fallback", label: "先重说再兜底", hint: "违规时最多再生成一次，仍不行再用安全回复" },
  { value: "fallback", label: "直接兜底", hint: "违规时不再重试，直接用安全回复" },
];

export type PersonaOutputFirewallFormValue = {
  enabled: boolean;
  severity: FirewallSeverity;
  strategy: FirewallStrategy;
  maxRetries: 0 | 1;
};

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

export function parsePersonaOutputFirewall(raw: string): PersonaOutputFirewallFormValue {
  const policy = parsePolicy(raw);
  const severity = String(policy.severity || "strict").toLowerCase() === "soft" ? "soft" : "strict";
  const strategy =
    String(policy.strategy || "retry_then_fallback").toLowerCase() === "fallback"
      ? "fallback"
      : "retry_then_fallback";
  const retries = Number(policy.max_retries);
  return {
    enabled: Boolean(policy.enabled),
    severity,
    strategy,
    maxRetries: retries === 0 ? 0 : 1,
  };
}

export function updatePersonaOutputFirewall(
  raw: string,
  next: PersonaOutputFirewallFormValue,
): string {
  const policy = parsePolicy(raw);
  return JSON.stringify({
    ...policy,
    version: Number(policy.version) || 1,
    enabled: next.enabled,
    severity: next.severity,
    strategy: next.strategy,
    max_retries: next.maxRetries,
  });
}
