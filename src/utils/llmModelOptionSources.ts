import type { LlmProviderConfigRow } from "@/api/pallasTypes";

export interface LlmModelSelectOption {
  value: string;
  label: string;
}

export interface LlmModelSelectGroup {
  id: string;
  label: string;
  options: LlmModelSelectOption[];
}

function uniqueStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function providerConfiguredModels(providers: LlmProviderConfigRow[]): LlmModelSelectOption[] {
  const options: LlmModelSelectOption[] = [];
  const seen = new Set<string>();
  for (const provider of providers) {
    const defaultModel = (provider.default_model || "").trim();
    if (defaultModel && !seen.has(defaultModel)) {
      seen.add(defaultModel);
      options.push({
        value: defaultModel,
        label: `${defaultModel} · ${provider.id} 默认`,
      });
    }
    for (const [task, model] of Object.entries(provider.task_models || {})) {
      const taskModel = String(model || "").trim();
      if (!taskModel || seen.has(taskModel)) continue;
      seen.add(taskModel);
      options.push({
        value: taskModel,
        label: `${taskModel} · ${provider.id}/${task}`,
      });
    }
  }
  return options.sort((a, b) => a.value.localeCompare(b.value));
}

function discoveredModelOptions(discoveredByProvider: Record<string, string[]>): LlmModelSelectOption[] {
  const modelSources = new Map<string, string[]>();
  for (const [providerId, models] of Object.entries(discoveredByProvider)) {
    for (const raw of models) {
      const model = String(raw || "").trim();
      if (!model) continue;
      const sources = modelSources.get(model) ?? [];
      if (!sources.includes(providerId)) sources.push(providerId);
      modelSources.set(model, sources);
    }
  }
  return [...modelSources.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, sources]) => ({
      value,
      label: `${value} · ${sources.join("、")} 在线`,
    }));
}

export function collectSavedRoutingModels(draft: {
  llm_model?: string;
  task_models?: Record<string, string>;
  moe_models?: Record<string, string>;
}): string[] {
  return uniqueStrings([
    draft.llm_model || "",
    ...Object.values(draft.task_models || {}),
    ...Object.values(draft.moe_models || {}),
  ]);
}

export function collectSavedProviderModels(params: {
  default_model?: string;
  task_models?: Record<string, string>;
  taskModelRows?: Array<{ model: string }>;
}): string[] {
  return uniqueStrings([
    params.default_model || "",
    ...Object.values(params.task_models || {}),
    ...(params.taskModelRows || []).map((row) => row.model),
  ]);
}

export function buildLlmModelSelectGroups(params: {
  providers: LlmProviderConfigRow[];
  runtimeModel?: string;
  discoveredByProvider?: Record<string, string[]>;
  savedValues?: string[];
}): LlmModelSelectGroup[] {
  const groups: LlmModelSelectGroup[] = [];
  const known = new Set<string>();

  const runtime = (params.runtimeModel || "").trim();
  if (runtime) {
    known.add(runtime);
    groups.push({
      id: "runtime",
      label: "当前运行（Ollama）",
      options: [{ value: runtime, label: runtime }],
    });
  }

  const providerOptions = providerConfiguredModels(params.providers);
  for (const option of providerOptions) known.add(option.value);
  if (providerOptions.length) {
    groups.push({
      id: "provider",
      label: "Provider 登记",
      options: providerOptions,
    });
  }

  const onlineOptions = discoveredModelOptions(params.discoveredByProvider || {});
  for (const option of onlineOptions) known.add(option.value);
  if (onlineOptions.length) {
    groups.push({
      id: "online",
      label: "在线发现",
      options: onlineOptions,
    });
  }

  const orphanSaved = uniqueStrings(params.savedValues || []).filter((value) => !known.has(value));
  if (orphanSaved.length) {
    groups.push({
      id: "saved",
      label: "已保存（未在上列出现）",
      options: orphanSaved.map((value) => ({
        value,
        label: `${value} · 已保存`,
      })),
    });
  }

  return groups;
}

export function flattenLlmModelSelectGroups(groups: LlmModelSelectGroup[]): Set<string> {
  const values = new Set<string>();
  for (const group of groups) {
    for (const option of group.options) values.add(option.value);
  }
  return values;
}
