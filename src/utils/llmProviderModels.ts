/** 任务编排：按当前提供方收窄模型候选项（不含其它提供方的模型）。 */

export type ProviderModelSource = {
  id: string;
  default_model?: string;
  task_models?: Record<string, string>;
};

export function modelOptionsForProvider(
  providerId: string,
  providers: ProviderModelSource[],
  fetchedByProvider: Record<string, string[]>,
): string[] {
  const id = (providerId || "").trim();
  if (!id) return [];
  const provider = providers.find((p) => p.id === id);
  if (!provider) return [];

  const values: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined) => {
    const model = String(raw || "").trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    values.push(model);
  };

  add(provider.default_model);
  for (const model of Object.values(provider.task_models || {})) add(model);
  for (const model of fetchedByProvider[id] || []) add(model);
  return values;
}

/** 换提供方时：模型仍属于新提供方则保留，否则清空。 */
export function modelAfterProviderChange(
  nextProviderId: string,
  currentModel: string,
  providers: ProviderModelSource[],
  fetchedByProvider: Record<string, string[]>,
): string {
  const model = (currentModel || "").trim();
  if (!model) return "";
  const options = modelOptionsForProvider(nextProviderId, providers, fetchedByProvider);
  return options.includes(model) ? model : "";
}
