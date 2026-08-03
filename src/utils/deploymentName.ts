type PluginConfigFields = {
  fields?: Array<{ name?: unknown; current?: unknown }>;
};

export function deploymentNameFromPluginConfig(config: PluginConfigFields | null | undefined): string {
  const value = config?.fields?.find((field) => field.name === "deployment_name")?.current;
  return typeof value === "string" ? value : "";
}
