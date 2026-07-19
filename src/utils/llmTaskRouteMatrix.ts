import type { LlmProviderConfigRow } from "@/api/pallasTypes";

export function resolveTaskRouteProvider(
  task: string,
  routingTasks: Record<string, string>,
  chainFallback: readonly string[],
): string {
  return (routingTasks[task] || "").trim() || (chainFallback[0] || "").trim();
}

export function resolveTaskRouteModel(
  task: string,
  providerId: string,
  providers: readonly LlmProviderConfigRow[],
  envTaskModels: Record<string, string>,
): string {
  if (providerId) {
    const provider = providers.find((row) => row.id === providerId);
    const model = String(provider?.task_models?.[task] || "").trim();
    if (model) return model;
  }
  return String(envTaskModels[task] || "").trim();
}

export function taskModelUsesEnvFallback(
  task: string,
  providerId: string,
  providers: readonly LlmProviderConfigRow[],
  envTaskModels: Record<string, string>,
): boolean {
  if (!providerId) return Boolean(String(envTaskModels[task] || "").trim());
  const provider = providers.find((row) => row.id === providerId);
  return !String(provider?.task_models?.[task] || "").trim() && Boolean(String(envTaskModels[task] || "").trim());
}
