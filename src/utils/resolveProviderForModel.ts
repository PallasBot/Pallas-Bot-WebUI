import type { LlmProviderConfigRow } from "@/api/pallasTypes";

function providerHasModel(
  provider: LlmProviderConfigRow,
  model: string,
  discoveredByProvider?: Record<string, string[]>,
): boolean {
  if ((provider.default_model || "").trim() === model) return true;
  for (const value of Object.values(provider.task_models || {})) {
    if (String(value || "").trim() === model) return true;
  }
  const discovered = discoveredByProvider?.[provider.id] || [];
  return discovered.some((item) => String(item || "").trim() === model);
}

/** 选模型时自动推断上游 Provider，避免「local + 模型」双选。 */
export function resolveProviderForModel(
  model: string,
  providers: readonly LlmProviderConfigRow[],
  options?: {
    preferredProviderId?: string;
    chainFallback?: readonly string[];
    discoveredByProvider?: Record<string, string[]>;
  },
): string {
  const target = (model || "").trim();
  if (!target || !providers.length) return "";

  const preferred = (options?.preferredProviderId || "").trim();
  if (preferred) {
    const row = providers.find((item) => item.id === preferred);
    if (row && providerHasModel(row, target, options?.discoveredByProvider)) return preferred;
  }

  const locals = providers.filter((item) => item.kind === "local");
  for (const row of locals) {
    if (providerHasModel(row, target, options?.discoveredByProvider)) return row.id;
  }

  for (const id of options?.chainFallback || []) {
    const row = providers.find((item) => item.id === id);
    if (row && providerHasModel(row, target, options?.discoveredByProvider)) return row.id;
  }

  for (const row of providers) {
    if (providerHasModel(row, target, options?.discoveredByProvider)) return row.id;
  }

  if (preferred && providers.some((item) => item.id === preferred)) return preferred;
  return (options?.chainFallback?.[0] || providers[0]?.id || "").trim();
}
