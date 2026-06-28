import type { PluginRow } from "@/api/pallasTypes";

/** 优先展示帮助里的中文名，否则内部名。 */
export function matcherPluginDisplayName(internalName: string, plugins: PluginRow[] | undefined | null): string {
  if (!plugins?.length) return internalName;
  const hit = plugins.find((p) => p.name === internalName);
  if (!hit) return internalName;
  const zh = hit.metadata?.name?.trim();
  if (zh) return zh;
  return hit.name || internalName;
}
