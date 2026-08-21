/** 任务编排：按当前提供方收窄模型候选项（不含其它提供方的模型）。 */

export type ProviderModelSource = {
  id: string;
  default_model?: string;
  task_models?: Record<string, string>;
  models?: Array<{ name?: string }>;
};

function providerForId(providerId: string, providers: ProviderModelSource[]): ProviderModelSource | undefined {
  const id = (providerId || "").trim();
  return id ? providers.find((provider) => provider.id === id) : undefined;
}

function registeredModelNames(provider: ProviderModelSource | undefined): string[] {
  if (!provider) return [];
  return (provider.models || []).map((model) => String(model?.name || "").trim()).filter(Boolean);
}

/** 用于模型选择器「常用」列表的提供方默认模型。 */
export function providerDefaultModel(providerId: string, providers: ProviderModelSource[]): string {
  const provider = providerForId(providerId, providers);
  return String(provider?.default_model || "").trim();
}

/** 已注册模型用于任务选择器的「常用」，默认模型始终置顶。 */
export function providerCommonModels(providerId: string, providers: ProviderModelSource[]): string[] {
  const provider = providerForId(providerId, providers);
  if (!provider) return [];
  const values = [String(provider.default_model || "").trim(), ...registeredModelNames(provider)];
  return [...new Set(values.filter(Boolean))];
}

/** 实时发现列表（不排除已常用/已注册的模型，均可在「模型发现」中直接选用）。 */
export function modelDiscoveryOptionsForProvider(
  providerId: string,
  providers: ProviderModelSource[],
  fetchedByProvider: Record<string, string[]>,
): string[] {
  const provider = providerForId(providerId, providers);
  const id = (providerId || "").trim();
  if (!provider || !id) return [];
  return (fetchedByProvider[id] || []).map((model) => String(model || "").trim()).filter(Boolean);
}

export function modelOptionsForProvider(
  providerId: string,
  providers: ProviderModelSource[],
  fetchedByProvider: Record<string, string[]>,
): string[] {
  const id = (providerId || "").trim();
  const provider = providerForId(id, providers);
  if (!provider) return [];

  const values: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined) => {
    const model = String(raw || "").trim();
    if (!model || seen.has(model)) return;
    seen.add(model);
    values.push(model);
  };

  for (const model of providerCommonModels(id, providers)) add(model);
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
